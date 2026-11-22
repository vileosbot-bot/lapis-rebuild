#!/usr/bin/env python3
"""Zero-token Lapis task patrol. Reads the registry and public GitHub checks only."""
from __future__ import annotations
import argparse, ast, json, re, subprocess, sys, urllib.error, urllib.parse, urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
try:
    from task_registry import load_registry, validate_task
except Exception as exc:
    raise RuntimeError("cannot import the existing task_registry module: %s" % exc) from exc
ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "docs/agent-ops/task-registry.yml"
STATE = ROOT / "tools/agent_ops/patrol-state.json"
LOG = ROOT / "docs/agent-ops/alert-log.md"
API = "https://api.github.com"
STUCK_MIN = 30
STALE_HOURS = 48
ROUND_LIMIT = .80
CONTEXT_LIMIT = 85
BAD_CHECKS = {"failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"}

class PatrolError(RuntimeError): pass

def parse_dt(value: Any, end_date: bool = False) -> datetime | None:
    if not isinstance(value, str) or not value.strip(): return None
    raw = value.strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            d = date.fromisoformat(raw)
            parsed = datetime.combine(d, time.max if end_date else time.min, tzinfo=timezone.utc)
        else:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError: return None

def stamp(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def read_json(path: Path, default: Any = None) -> Any:
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if default is not None: return default
        raise
    except (OSError, json.JSONDecodeError) as exc: raise PatrolError("cannot read JSON %s: %s" % (path, exc)) from exc

def empty_state() -> dict[str, Any]:
    return {"schema_version":1,"last_run_at":None,"tasks":{},"active_alerts":{},"metrics":{"daily_alerts":{},"false_positive_count":0,"missed_alert_count":0,"manager_handling_minutes_total":0,"manager_handling_samples":0}}

def read_state(path: Path) -> dict[str, Any]:
    if not path.exists(): return empty_state()
    s = read_json(path)
    if not isinstance(s,dict) or s.get("schema_version") != 1 or not all(isinstance(s.get(k),dict) for k in ("tasks","active_alerts","metrics")):
        raise PatrolError("state file is corrupt or has an unsupported schema; expected schema_version=1 and object fields")
    return s

def atomic_write(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp = path.with_name(path.name+".tmp")
    tmp.write_text(value,encoding="utf-8",newline="\n")
    tmp.replace(path)

def output_time(t: dict[str,Any]) -> datetime | None:
    for k in ("last_output_at","last_activity_at","last_event_at","last_updated_at","updated_at","last_updated"):
        v=t.get(k)
        if isinstance(v,str) and ("T" in v or " " in v):
            d=parse_dt(v)
            if d: return d
    return None

def update_time(t: dict[str,Any]) -> datetime | None:
    for k in ("last_updated","last_updated_at","updated_at"):
        d=parse_dt(t.get(k))
        if d: return d
    return None

def rounds_used(t: dict[str,Any]) -> int | None:
    for k in ("rounds_used","round_count","rounds_consumed","current_rounds"):
        if isinstance(t.get(k),int) and t[k]>=0: return t[k]
    b=t.get("cost_budget") or {}
    if isinstance(b,dict):
        for k in ("rounds_used","round_count","rounds_consumed"):
            if isinstance(b.get(k),int) and b[k]>=0: return b[k]
        records=b.get("cost_record")
        if isinstance(records,list):
            vals=[x.get("rounds",x.get("rounds_used",x.get("round_count"))) for x in records if isinstance(x,dict)]
            vals=[x for x in vals if isinstance(x,int) and x>=0]
            if vals: return sum(vals)
    return None

def context_reason(t: dict[str,Any]) -> str | None:
    b=t.get("cost_budget") or {}; maximum=b.get("max_rounds") if isinstance(b,dict) else None; used=rounds_used(t)
    if isinstance(maximum,int) and maximum>0 and used is not None and used/maximum>=ROUND_LIMIT: return "round budget near limit: %d/%d"%(used,maximum)
    for k in ("context_usage_percent","context_percent","context_window_percent"):
        if isinstance(t.get(k),(int,float)) and t[k]>=CONTEXT_LIMIT: return "context usage near limit: %s%%"%t[k]
    if str(t.get("context_status","")).lower() in {"near_limit","exhausted","insufficient","warning"}: return "context status: "+str(t["context_status"])
    meta=" ".join(str(t.get(k,"")) for k in ("progress","next_action","last_error")).lower()
    if any(x in meta for x in ("context exhausted","context window exceeded","上下文不足","上下文耗尽")): return "task metadata indicates context exhaustion"
    return None

def direction_reason(t: dict[str,Any]) -> str | None:
    count=next((t[k] for k in ("retry_count","retry_attempts","consecutive_failures","gate_failures") if isinstance(t.get(k),int)),0)
    gate=str(t.get("gate_status",t.get("last_gate_status",""))).lower()
    hist=t.get("retry_history")
    if count>=2 and gate in {"fail","failed","failure","rejected"}: return "at least two retries recorded while the gate remains failed"
    if isinstance(hist,list) and len(hist)>=2 and all(isinstance(x,dict) and str(x.get("result",x.get("status",""))).lower() in {"fail","failed","failure"} for x in hist[-2:]): return "last two retry outcomes failed; manual direction review required"
    return None

def alert(kind: str, severity: str, task: dict[str,Any], detail: str, advice: str, dependency: dict[str,Any] | None = None) -> dict[str,Any]:
    loc={"conversation_url":task.get("conversation_url") or None,"pull_request_url":task.get("pull_request_url") or None}
    if dependency: loc["dependency_pull_request_url"]=dependency.get("pull_request_url") or None
    rid=task.get("request_id",task.get("task_key","unknown"))
    return {"id":"%s:%s"%(rid,kind),"type":kind,"severity":severity,"task_key":task.get("task_key"),"request_id":task.get("request_id"),"task_name":task.get("task_name"),"detail":detail,"location":loc,"recommendation":advice,"action":"notify_manager" if severity=="high" else "record_only"}

def api_json(url: str) -> dict[str,Any]:
    req=urllib.request.Request(url,headers={"Accept":"application/vnd.github+json","User-Agent":"lapis-agent-ops-patrol/1.0","X-GitHub-Api-Version":"2022-11-28"})
    try:
        with urllib.request.urlopen(req,timeout=12) as r: data=json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e: raise PatrolError("GitHub API HTTP %s for %s: %s"%(e.code,url,e.read().decode("utf-8","replace")[:400])) from e
    except Exception as e: raise PatrolError("GitHub API request failed for %s: %s"%(url,e)) from e
    if not isinstance(data,dict): raise PatrolError("GitHub API returned non-object: "+url)
    return data

def pr_status(t: dict[str,Any], fixture: dict[str,Any] | None, no_network: bool) -> dict[str,Any] | None:
    url=t.get("pull_request_url")
    if not isinstance(url,str) or not url.strip(): return None
    for key in (str(t.get("request_id","")),str(t.get("task_key","")),url):
        if isinstance(fixture,dict) and key and isinstance(fixture.get(key),dict): return fixture[key]
    if no_network: raise PatrolError("missing PR fixture for task %s"%(t.get("request_id") or t.get("task_key")))
    p=urllib.parse.urlparse(url); parts=[x for x in p.path.split("/") if x]
    if p.netloc.lower()!="github.com" or len(parts)<4 or parts[2]!="pull" or not parts[3].isdigit(): raise PatrolError("unsupported pull_request_url: "+url)
    repo=parts[0]+"/"+parts[1]; pr=api_json("%s/repos/%s/pulls/%s"%(API,repo,parts[3])); sha=(pr.get("head") or {}).get("sha")
    if not sha: raise PatrolError("PR did not provide head.sha: "+url)
    checks=api_json("%s/repos/%s/commits/%s/check-runs"%(API,repo,sha))
    return {"merged":pr.get("merged",False),"check_runs":checks.get("check_runs",[]),"html_url":pr.get("html_url") or url}

def ci_failure(pr: dict[str,Any]) -> str | None:
    runs=pr.get("check_runs",[])
    if not isinstance(runs,list): raise PatrolError("check_runs must be an array")
    bad=["%s=%s"%(x.get("name","unnamed"),x.get("conclusion")) for x in runs if isinstance(x,dict) and str(x.get("status","")).lower()=="completed" and str(x.get("conclusion","")).lower() in BAD_CHECKS]
    return ", ".join(bad) if bad else None

def detect(data: dict[str,Any], now: datetime, fixture: dict[str,Any] | None=None, no_network: bool=False) -> list[dict[str,Any]]:
    tasks=data.get("tasks")
    if not isinstance(tasks,list): raise PatrolError("registry tasks must be an array")
    by={}
    for x in tasks:
        if isinstance(x,dict):
            for k in (x.get("task_key"),x.get("request_id")):
                if isinstance(k,str) and k: by[k]=x
    found=[]
    for t in tasks:
        if not isinstance(t,dict) or t.get("status") not in {"in_progress","awaiting_review"}: continue
        errors=validate_task(t)
        if errors: raise PatrolError("invalid active task %s: %s"%(t.get("request_id","unknown"),"; ".join(errors)))
        out=output_time(t)
        if out and now-out>timedelta(minutes=STUCK_MIN): found.append(alert("task_stuck","high",t,"no output for %d minutes"%int((now-out).total_seconds()//60),"Inspect the conversation/process and resume only after manager confirmation."))
        ctx=context_reason(t)
        if ctx: found.append(alert("context_exhaustion","high",t,ctx,"Stop expanding the context; ask the manager to split and redispatch."))
        deadline=parse_dt(t.get("deadline"),True)
        if deadline and now>deadline: found.append(alert("task_timeout","high",t,"deadline passed at "+stamp(deadline),"Stop retries and notify the manager for a new deadline or cancellation."))
        updated=update_time(t)
        if updated and now-updated>timedelta(hours=STALE_HOURS): found.append(alert("registry_stale","medium",t,"registry last_updated is %d hours old"%int((now-updated).total_seconds()//3600),"Ask the manager to verify progress; patrol never edits the registry."))
        wrong=direction_reason(t)
        if wrong: found.append(alert("direction_suspected_wrong","high",t,wrong,"Stop all automatic retries and request a manager direction review."))
        for dep_id in t.get("depends_on",[]):
            dep=by.get(str(dep_id)); ready=bool(dep and dep.get("status")=="completed")
            if dep and not ready and dep.get("pull_request_url"):
                dep_pr=pr_status(dep,fixture,no_network); ready=bool(dep_pr and dep_pr.get("merged") is True)
            if not ready:
                detail="dependency %s is missing or its upstream PR is not merged"%dep_id
                if dep: detail+=" (status=%s)"%dep.get("status")
                found.append(alert("dependency_blocked","medium",t,detail,"Check upstream task/PR; keep this task blocked until completed or merged.",dep))
        pr=pr_status(t,fixture,no_network)
        if pr:
            fail=ci_failure(pr)
            if fail: found.append(alert("ci_failure","medium",t,"PR checks failed: "+fail,"Open the linked PR checks and ask the manager before retrying."))
    return found

def append_log(path: Path, alerts: list[dict[str,Any]], now: datetime, old: dict[str,Any]) -> None:
    fresh=[x for x in alerts if x["id"] not in old]
    if not fresh: return
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists(): path.write_text("# Agent Ops Alert Log\n\n",encoding="utf-8")
    with path.open("a",encoding="utf-8",newline="\n") as f:
        f.write("\n## %s\n"%now.date().isoformat())
        for x in fresh:
            loc=x["location"]
            f.write("\n- **[%s] %s** — %s (%s)\n"%(x["severity"].upper(),x["type"],x.get("task_name") or x.get("request_id"),x.get("request_id")))
            f.write("  - Detail: %s\n  - Conversation: %s\n  - PR: %s\n  - Recommendation: %s\n"%(x["detail"],loc.get("conversation_url") or "not registered",loc.get("pull_request_url") or "not registered",x["recommendation"]))
            if loc.get("dependency_pull_request_url"): f.write("  - Dependency PR: %s\n"%loc["dependency_pull_request_url"])

def run(args: argparse.Namespace) -> tuple[int,dict[str,Any]]:
    now=parse_dt(args.now) if args.now else datetime.now(timezone.utc)
    if now is None: raise PatrolError("--now must be ISO-8601")
    data=load_registry(Path(args.registry).expanduser().resolve()); state=read_state(Path(args.state).expanduser().resolve())
    fixture=read_json(Path(args.pr_fixture).expanduser().resolve()) if args.pr_fixture else None
    alerts=detect(data,now,fixture,args.no_network); old=state.get("active_alerts",{}); new={x["id"] for x in alerts if x["id"] not in old}
    for x in alerts: x["is_new"]=x["id"] in new; x["action"]="notify_manager" if x["severity"]=="high" and x["is_new"] else "record_only"
    if not args.dry_run: append_log(Path(args.alert_log).expanduser().resolve(),alerts,now,old)
    active={}
    for x in alerts:
        prev=old.get(x["id"],{}); active[x["id"]]={"first_seen_at":prev.get("first_seen_at",stamp(now)),"last_seen_at":stamp(now),"occurrences":int(prev.get("occurrences",0))+1,"severity":x["severity"]}
    metrics=state.setdefault("metrics",{}); daily=metrics.setdefault("daily_alerts",{}); day=now.date().isoformat(); daily[day]=int(daily.get(day,0))+len(new)
    state["last_run_at"]=stamp(now); state["active_alerts"]=active
    for t in data.get("tasks",[]):
        if isinstance(t,dict) and t.get("status") in {"in_progress","awaiting_review"}:
            state.setdefault("tasks",{})[str(t.get("request_id") or t.get("task_key"))]={"status":t.get("status"),"last_output_at":stamp(output_time(t)) if output_time(t) else None,"last_observed_at":stamp(now)}
    if not args.dry_run: atomic_write(Path(args.state).expanduser().resolve(),json.dumps(state,ensure_ascii=False,indent=2,sort_keys=True)+"\n")
    payload={"schema_version":1,"run_at":stamp(now),"status":"ALERTS" if alerts else "OK","message":"exceptions found" if alerts else "no anomalies","alert_count":len(alerts),"alerts":alerts,"dry_run":bool(args.dry_run)}
    return (1 if alerts else 0),payload

def report(args: argparse.Namespace) -> int:
    s=read_state(Path(args.state).expanduser().resolve()); day=args.date or datetime.now(timezone.utc).date().isoformat(); m=s.get("metrics",{}); count=int(m.get("daily_alerts",{}).get(day,0)); fp=int(m.get("false_positive_count",0)); missed=int(m.get("missed_alert_count",0)); total=int(m.get("manager_handling_minutes_total",0)); samples=int(m.get("manager_handling_samples",0)); rate=fp/count*100 if count else 0.0
    memory="NOT_PROVIDED"
    if args.memory_report:
        value=read_json(Path(args.memory_report).expanduser().resolve()); memory=str(value.get("status","UNKNOWN")) if isinstance(value,dict) else "INVALID"
    lines=["## Daily Patrol Report — "+day,"","- Alert count: %d"%count,"- False positives: %d (%.1f%% of alerts)"%(fp,rate),"- Missed alerts: %d"%missed,"- Manager handling: %d minutes total across %d samples"%(total,samples),"- Memory integrity check: "+memory,"- Review note: update false-positive, missed-alert and handling-time metrics after manager review.",""]
    path=Path(args.alert_log).expanduser().resolve(); path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists(): path.write_text("# Agent Ops Alert Log\n\n",encoding="utf-8")
    with path.open("a",encoding="utf-8",newline="\n") as f: f.write("\n"+"\n".join(lines))
    print(json.dumps({"status":"PASS","date":day,"alert_count":count,"false_positive_count":fp,"false_positive_rate_percent":round(rate,1),"missed_alert_count":missed,"manager_handling_minutes_total":total,"manager_handling_samples":samples,"memory_integrity_status":memory,"written_to":str(path)},ensure_ascii=False,indent=2))
    return 0

def self_test() -> dict[str,Any]:
    now=datetime(2026,11,22,4,0,tzinfo=timezone.utc)
    base={"task_key":"T","request_id":"patrol-test","task_name":"fixture","conversation_url":"https://chatgpt.com/c/fixture","workspace":"test","model":"GPT-6","mode":"Chat","repository":"vileosbot-bot/lapis-rebuild","branch":"fixture","base_sha":"a"*40,"head_sha":"b"*40,"status":"in_progress","progress":"running","next_action":"continue","deadline":None,"risk_level":"medium","approval_required":True,"last_updated":"2026-11-22T03:55:00Z","head_sha_verified_at":"2026-11-22","cost_budget":{"max_rounds":30,"timeout_minutes":120,"cost_record":[]},"conflict_group":None,"shared_files":[],"depends_on":[],"blocked_by":[],"checkpoints":{},"legacy_import":False,"last_output_at":"2026-11-22T03:55:00Z"}
    tests=[]
    def check(name, ok): tests.append({"name":name,"passed":bool(ok)})
    a=detect({"tasks":[dict(base,last_output_at="2026-11-22T03:29:00Z")]},now,no_network=True); check("stuck_after_30_minutes",any(x["type"]=="task_stuck" for x in a))
    b=detect({"tasks":[dict(base,last_output_at="2026-11-22T02:59:00Z")]},now,no_network=True); check("alert_fingerprint_stable_as_elapsed_time_changes",a[0]["id"]==b[0]["id"])
    a=detect({"tasks":[dict(base,last_output_at="2026-11-22T03:30:00Z")]},now,no_network=True); check("exact_30_minute_boundary_not_fired",not any(x["type"]=="task_stuck" for x in a))
    t=dict(base,pull_request_url="https://github.com/vileosbot-bot/lapis-rebuild/pull/999"); fix={"patrol-test":{"check_runs":[{"name":"CI","status":"completed","conclusion":"failure"}]}}; a=detect({"tasks":[t]},now,fix,True); check("ci_failure_detected",any(x["type"]=="ci_failure" for x in a))
    a=detect({"tasks":[dict(base,deadline="2026-11-22T03:59:00Z")]},now,no_network=True); check("expired_deadline_detected",any(x["type"]=="task_timeout" for x in a))
    a=detect({"tasks":[dict(base,last_output_at="2026-11-22T03:59:00Z",last_updated="2026-11-22T03:59:00Z")]},now,no_network=True); check("normal_task_no_false_positive",not a)
    a=detect({"tasks":[dict(base,rounds_used=24)]},now,no_network=True); check("context_80_percent_threshold",any(x["type"]=="context_exhaustion" for x in a))
    a=detect({"tasks":[dict(base,last_updated="2026-11-19")]},now,no_network=True); check("registry_stale_48_hours",any(x["type"]=="registry_stale" for x in a))
    a=detect({"tasks":[dict(base,retry_count=2,gate_status="failed")]},now,no_network=True); check("direction_error_requires_human",any(x["type"]=="direction_suspected_wrong" for x in a))
    up=dict(base,task_key="UP",request_id="up"); down=dict(base,task_key="DOWN",request_id="down",depends_on=["up"]); a=detect({"tasks":[up,down]},now,no_network=True); check("dependency_blocked",any(x["type"]=="dependency_blocked" for x in a))
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        p=Path(td); reg=p/"r.json"; reg.write_text(json.dumps({"tasks":[base]})); bad=p/"s.json"; bad.write_text("{bad"); cmd=[sys.executable,str(Path(__file__).resolve()),"run","--registry",str(reg),"--state",str(bad),"--alert-log",str(p/"a.md"),"--dry-run","--now",stamp(now)]; r=subprocess.run(cmd,capture_output=True,text=True); check("corrupt_state_nonzero_fatal",r.returncode==2 and "PATROL_FATAL" in r.stderr)
    tree=ast.parse(Path(__file__).read_text(encoding="utf-8")); imports=set()
    for n in ast.walk(tree):
        if isinstance(n,ast.Import): imports.update(x.name.split(".")[0] for x in n.names)
        elif isinstance(n,ast.ImportFrom) and n.module: imports.add(n.module.split(".")[0])
    allowed={"__future__","argparse","ast","json","re","subprocess","sys","urllib","datetime","pathlib","typing","task_registry","tempfile"}
    check("stdlib_and_registry_imports_only","urllib" in imports and imports.issubset(allowed))
    return {"status":"PASS" if all(x["passed"] for x in tests) else "FAIL","tests":tests,"passed":sum(x["passed"] for x in tests),"total":len(tests)}

def main(argv: list[str] | None=None) -> int:
    p=argparse.ArgumentParser(description="Zero-token Agent Ops patrol"); sub=p.add_subparsers(dest="command",required=True)
    r=sub.add_parser("run"); r.add_argument("--registry",default=str(REGISTRY)); r.add_argument("--state",default=str(STATE)); r.add_argument("--alert-log",default=str(LOG)); r.add_argument("--pr-fixture"); r.add_argument("--now"); r.add_argument("--no-network",action="store_true"); r.add_argument("--dry-run",action="store_true")
    q=sub.add_parser("report"); q.add_argument("--state",default=str(STATE)); q.add_argument("--alert-log",default=str(LOG)); q.add_argument("--date"); q.add_argument("--memory-report")
    sub.add_parser("self-test"); args=p.parse_args(argv)
    if args.command=="self-test":
        result=self_test(); print(json.dumps(result,ensure_ascii=False,indent=2)); return 0 if result["status"]=="PASS" else 1
    if args.command=="report": return report(args)
    code,payload=run(args); print(json.dumps(payload,ensure_ascii=False,indent=2)); return code

if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as exc:
        print("PATROL_FATAL: %s: %s"%(type(exc).__name__,exc),file=sys.stderr); raise SystemExit(2)
