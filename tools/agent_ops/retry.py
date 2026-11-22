#!/usr/bin/env python3
"""Disabled-by-default, dry-run-only retry planner for Agent Ops."""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from typing import Any
DEFAULT_ENABLED = False
MAX_ATTEMPTS = 2
POLICIES = {
    "task_stuck": {"action":"send_continue","prompt":"\u7ee7\u7eed","max_attempts":2},
    "context_exhaustion": {"action":"split_and_redispatch","prompt":"Split the work into a smaller independently verifiable task.","max_attempts":2},
    "ci_failure": {"action":"retry_with_ci_error","prompt":"Retry only after including the exact CI failure output.","max_attempts":2},
    "direction_suspected_wrong": {"action":"manager_review","prompt":"Stop and wait for the total manager to review direction.","max_attempts":0},
    "task_timeout": {"action":"notify_manager","prompt":"Stop and notify the total manager; do not retry a timed-out task.","max_attempts":0},
}
def simulate(kind: str, outcomes: list[str], error_text: str = "") -> dict[str,Any]:
    policy=POLICIES.get(kind)
    if policy is None: return {"status":"manual_review","type":kind,"attempts":[],"budget_rounds_charged":0,"reason":"unknown type; no retry"}
    if policy["max_attempts"]==0: return {"status":"stop_for_manager","type":kind,"action":policy["action"],"attempts":[],"budget_rounds_charged":0,"reason":policy["prompt"]}
    if kind=="ci_failure" and not error_text.strip(): return {"status":"blocked_missing_ci_output","type":kind,"attempts":[],"budget_rounds_charged":0,"reason":"CI retry requires exact failure output"}
    attempts=[]
    for index in range(min(int(policy["max_attempts"]),MAX_ATTEMPTS)):
        outcome=outcomes[index] if index<len(outcomes) else "failed"; prompt=policy["prompt"]
        if kind=="ci_failure": prompt+="\n\nCI failure output:\n"+error_text
        attempts.append({"attempt":index+1,"reason":kind,"method":policy["action"],"prompt":prompt,"result":outcome,"budget_rounds_charged":1})
        if outcome in {"recovered","success","passed"}: return {"status":"recovered","type":kind,"attempts":attempts,"budget_rounds_charged":len(attempts),"reason":"recovered within retry limit"}
    return {"status":"dead_letter","type":kind,"attempts":attempts,"budget_rounds_charged":len(attempts),"reason":"retry limit reached; stop and wait for the manager"}
def approval_gate(path: str | None, request_id: str | None) -> tuple[bool,str]:
    if not path: return False,"missing manager approval record"
    try: record=json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as exc: return False,"cannot read manager approval record: %s"%exc
    if not isinstance(record,dict): return False,"approval record must be a JSON object"
    required=(record.get("status")=="approved",record.get("approved_by")=="\u603b\u7ba1",record.get("first_week_review_accepted") is True,isinstance(record.get("approved_at"),str) and bool(record.get("approved_at")),isinstance(record.get("request_id"),str) and bool(record.get("request_id")),isinstance(record.get("max_attempts"),int) and 0<=record.get("max_attempts")<=MAX_ATTEMPTS)
    if not all(required): return False,"approval record missing required approval, first-week review, date, request-id, or safe attempt cap"
    if request_id and record.get("request_id")!=request_id: return False,"approval request_id does not match the task"
    return True,"approval gate satisfied; execution adapter is not implemented in this pilot"
def self_test() -> dict[str,Any]:
    tests=[]
    def check(name,ok): tests.append({"name":name,"passed":bool(ok)})
    check("default_disabled",DEFAULT_ENABLED is False)
    x=simulate("task_stuck",["recovered"]); check("stuck_continue_recovers_first_try",x["status"]=="recovered" and x["attempts"][0]["prompt"]=="\u7ee7\u7eed")
    x=simulate("task_stuck",["failed","failed","recovered"]); check("stuck_stops_after_two",x["status"]=="dead_letter" and len(x["attempts"])==2 and x["budget_rounds_charged"]==2)
    x=simulate("context_exhaustion",["failed","recovered"]); check("context_uses_split_plan",x["status"]=="recovered" and all(a["method"]=="split_and_redispatch" for a in x["attempts"]))
    x=simulate("ci_failure",["failed","recovered"],"AssertionError: expected 2, got 1"); check("ci_error_in_prompt",x["status"]=="recovered" and "AssertionError" in x["attempts"][0]["prompt"])
    check("ci_requires_failure_output",simulate("ci_failure",["recovered"],"")["status"]=="blocked_missing_ci_output")
    x=simulate("direction_suspected_wrong",["recovered"]); check("direction_never_retries",x["status"]=="stop_for_manager" and not x["attempts"])
    x=simulate("task_timeout",["recovered"]); check("timeout_never_retries",x["status"]=="stop_for_manager" and not x["attempts"])
    x=simulate("unknown",["recovered"]); check("unknown_fails_closed",x["status"]=="manual_review" and not x["attempts"])
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/"approval.json"; p.write_text(json.dumps({"status":"approved","approved_by":"\u603b\u7ba1","first_week_review_accepted":True,"approved_at":"2026-12-01T00:00:00Z","request_id":"test-1","max_attempts":2}),encoding="utf-8")
        ok,reason=approval_gate(str(p),"test-1"); mismatch,_=approval_gate(str(p),"other"); check("explicit_switch_requires_matching_manager_approval",ok and not mismatch and "not implemented" in reason)
    return {"status":"PASS" if all(x["passed"] for x in tests) else "FAIL","tests":tests,"passed":sum(x["passed"] for x in tests),"total":len(tests)}
def main(argv: list[str] | None=None) -> int:
    p=argparse.ArgumentParser(description="Disabled-by-default Agent Ops retry planner"); sub=p.add_subparsers(dest="command",required=True); sub.add_parser("self-test")
    s=sub.add_parser("simulate"); s.add_argument("--type",required=True,choices=sorted(POLICIES)); s.add_argument("--outcomes",default="failed,failed"); s.add_argument("--error-text",default="")
    r=sub.add_parser("run"); r.add_argument("--type",required=True,choices=sorted(POLICIES)); r.add_argument("--request-id"); r.add_argument("--enable",action="store_true"); r.add_argument("--approval-record")
    a=p.parse_args(argv)
    if a.command=="self-test":
        result=self_test(); print(json.dumps(result,ensure_ascii=False,indent=2)); return 0 if result["status"]=="PASS" else 1
    if a.command=="simulate":
        outcomes=[v.strip() for v in a.outcomes.split(",") if v.strip()]; result=simulate(a.type,outcomes,a.error_text); result["dry_run"]=True; print(json.dumps(result,ensure_ascii=False,indent=2)); return 0
    if not a.enable or DEFAULT_ENABLED is False:
        print(json.dumps({"status":"disabled","type":a.type,"attempts":[],"side_effects":False,"reason":"retry is hard-coded disabled in this pilot; no messages or task actions were sent"},ensure_ascii=False,indent=2)); return 0
    ok,reason=approval_gate(a.approval_record,a.request_id); print(json.dumps({"status":"not_executed","type":a.type,"attempts":[],"side_effects":False,"approval_gate":ok,"reason":reason},ensure_ascii=False,indent=2)); return 0 if ok else 2
if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as exc:
        print("RETRY_FATAL: %s: %s"%(type(exc).__name__,exc),file=sys.stderr); raise SystemExit(2)
