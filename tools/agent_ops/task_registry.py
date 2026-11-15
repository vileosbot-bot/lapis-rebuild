#!/usr/bin/env python3
"""Dependency-free Agent Ops registry manager.

task-registry.yml uses the JSON-compatible subset of YAML 1.2 so this tool
can parse it with the Python standard library. It only reads/writes the
registry. It never edits application code, merges PRs, or deploys software.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REGISTRY_REL = "docs/agent-ops/task-registry.yml"
HISTORY_INDEX_REL = "docs/agent-ops/task-history/README"
PLACEHOLDER_IDS = {"待派活时填"}
STATUSES = {
    "created", "dispatched", "in_progress", "awaiting_review", "completed",
    "blocked", "paused", "failed", "cancelled", "dead_letter",
}
ACTIVE_STATUSES = {"in_progress", "awaiting_review"}
REQUIRED_FIELDS = (
    "task_key", "request_id", "task_name", "conversation_url", "workspace",
    "model", "mode", "repository", "branch", "base_sha", "head_sha",
    "status", "progress", "next_action", "deadline", "risk_level",
    "approval_required", "last_updated", "cost_budget", "conflict_group",
    "shared_files", "depends_on", "blocked_by", "checkpoints",
)
TRANSITIONS = {
    "created": {"dispatched", "blocked", "paused", "cancelled"},
    "dispatched": {"in_progress", "blocked", "paused", "failed", "cancelled"},
    "in_progress": {"awaiting_review", "blocked", "paused", "failed", "cancelled", "dead_letter"},
    "awaiting_review": {"completed", "in_progress", "blocked", "paused", "failed", "cancelled", "dead_letter"},
    "blocked": {"in_progress", "paused", "failed", "cancelled", "dead_letter"},
    "paused": {"in_progress", "blocked", "failed", "cancelled", "dead_letter"},
    "failed": {"in_progress", "cancelled", "dead_letter"},
    "completed": set(), "cancelled": set(), "dead_letter": set(),
}


class RegistryError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_registry(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryError(f"registry not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryError(
            "task-registry.yml must use JSON-compatible YAML 1.2 syntax; "
            f"invalid JSON at line {exc.lineno}, column {exc.colno}"
        ) from exc
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
        raise RegistryError("registry root must be an object containing a tasks array")
    return data


def save_registry(path: Path, data: dict[str, Any]) -> None:
    """Atomically replace only the registry file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(payload)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def validate_task(task: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field in REQUIRED_FIELDS:
        if field not in task:
            errors.append(f"missing required field: {field}")
    if errors:
        return errors
    if not isinstance(task["task_key"], str) or not task["task_key"].strip():
        errors.append("task_key must be a non-empty string")
    if not isinstance(task["request_id"], str) or not task["request_id"].strip():
        errors.append("request_id must be non-empty or the explicit placeholder")
    if not isinstance(task["task_name"], str) or not task["task_name"].strip():
        errors.append("task_name must be a non-empty string")
    if task["status"] not in STATUSES:
        errors.append(f"illegal status: {task['status']}")
    if not isinstance(task["approval_required"], bool):
        errors.append("approval_required must be boolean")
    budget = task["cost_budget"]
    if not isinstance(budget, dict):
        errors.append("cost_budget must be an object")
    else:
        for key in ("max_rounds", "timeout_minutes", "cost_record"):
            if key not in budget:
                errors.append(f"cost_budget missing field: {key}")
        if not isinstance(budget.get("cost_record", []), list):
            errors.append("cost_budget.cost_record must be an array")
    if not isinstance(task["checkpoints"], dict):
        errors.append("checkpoints must be an object")
    for key in ("shared_files", "depends_on", "blocked_by"):
        if not isinstance(task[key], list):
            errors.append(f"{key} must be an array")
    if "write_files" in task and not isinstance(task["write_files"], list):
        errors.append("write_files must be an array")
    if task["status"] != "created" and not task.get("legacy_import", False):
        for key in ("conversation_url", "repository", "branch"):
            if not isinstance(task.get(key), str) or not task[key].strip():
                errors.append(f"{task['status']} requires non-empty {key}")
        if not task.get("base_sha") and not task.get("base_sha_note"):
            errors.append(f"{task['status']} requires base_sha or documented root-commit exception")
    if task["status"] in ACTIVE_STATUSES and not task.get("head_sha"):
        errors.append(f"{task['status']} requires a recorded head_sha")
    return errors


def capacity_errors(tasks: list[dict[str, Any]], limit: int) -> list[str]:
    active = [t for t in tasks if isinstance(t, dict) and t.get("status") in ACTIVE_STATUSES]
    return [f"parallel limit exceeded: {len(active)} active tasks > {limit}"] if len(active) > limit else []


def conflict_errors(tasks: list[dict[str, Any]]) -> list[str]:
    active = [t for t in tasks if isinstance(t, dict) and t.get("status") in ACTIVE_STATUSES]
    errors: list[str] = []
    for i, left in enumerate(active):
        for right in active[i + 1:]:
            if left.get("repository") == right.get("repository") and left.get("branch") == right.get("branch") and left.get("branch"):
                errors.append(f"same-branch concurrent work blocked: {left.get('request_id')} and {right.get('request_id')}")
            overlap = sorted(set(left.get("write_files", [])) & set(right.get("write_files", [])))
            if overlap:
                errors.append(f"shared-file concurrent write blocked: {', '.join(overlap)}")
    return errors


def registry_errors(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("unsupported or missing schema_version")
    if data.get("parallel_limit") != 10:
        errors.append("parallel_limit must remain exactly 10")
    if set(data.get("active_statuses", [])) != ACTIVE_STATUSES:
        errors.append("active_statuses must be exactly in_progress and awaiting_review")
    seen_ids: set[str] = set()
    seen_keys: set[str] = set()
    for index, task in enumerate(data.get("tasks", [])):
        if not isinstance(task, dict):
            errors.append(f"tasks[{index}] must be an object")
            continue
        errors.extend(f"tasks[{index}]: {e}" for e in validate_task(task))
        key = task.get("task_key")
        if key in seen_keys:
            errors.append(f"duplicate task_key: {key}")
        elif key:
            seen_keys.add(key)
        rid = task.get("request_id")
        if rid and rid not in PLACEHOLDER_IDS:
            if rid in seen_ids:
                errors.append(f"duplicate request_id: {rid}")
            seen_ids.add(rid)
    errors.extend(capacity_errors(data.get("tasks", []), 10))
    errors.extend(conflict_errors(data.get("tasks", [])))
    return errors


def checkpoint_warnings(task: dict[str, Any]) -> list[str]:
    if task.get("legacy_import"):
        return []
    required = {
        "dispatched": ("CP0",),
        "in_progress": ("CP0", "CP1"),
        "awaiting_review": ("CP0", "CP1", "CP2", "CP3"),
        "completed": ("CP0", "CP1", "CP2", "CP3"),
    }.get(task.get("status"), ())
    cps = task.get("checkpoints", {})
    missing = [name for name in required if not cps.get(name, {}).get("completed")]
    return [f"{task.get('request_id')}: missing checkpoint(s): {', '.join(missing)}"] if missing else []


def checkpoint_errors(task: dict[str, Any], name: str) -> list[str]:
    cps = task.get("checkpoints", {})
    item = cps.get(name, {})
    if name == "CP0":
        required = ("conversation_url", "branch")
        errors = [f"CP0 missing {key}" for key in required if not item.get(key)]
        if not item.get("base_sha") and not (item.get("base_sha_note") or task.get("base_sha_note")):
            errors.append("CP0 missing base_sha or documented root-commit exception")
        return errors
    if name == "CP1":
        errors = []
        if not item.get("authorization_scope"):
            errors.append("CP1 missing authorization_scope")
        if not item.get("plan_steps"):
            errors.append("CP1 missing plan_steps")
        if item.get("release_status") != "granted":
            errors.append("CP1 requires release_status=granted")
        return errors
    if name == "CP2":
        errors = []
        if not item.get("head_sha"):
            errors.append("CP2 missing head_sha")
        if not isinstance(item.get("tests_passed"), bool):
            errors.append("CP2 requires boolean tests_passed")
        if not isinstance(item.get("test_results"), list):
            errors.append("CP2 requires test_results array")
        return errors
    if name == "CP3":
        errors = []
        if not item.get("pull_request_url"):
            errors.append("CP3 missing pull_request_url")
        if item.get("ci_status") not in {"success", "failure", "pending", "unknown"}:
            errors.append("CP3 requires explicit ci_status")
        if not isinstance(item.get("pending_todos"), list):
            errors.append("CP3 requires pending_todos array")
        return errors
    return [f"unknown checkpoint: {name}"]


def validate_transition(
    task: dict[str, Any], target: str, *,
    release_approved: bool = False, resume_approved: bool = False,
    retry_approved: bool = False, changes_requested: bool = False,
    accepted_by: str | None = None,
) -> None:
    current = task.get("status")
    if target not in TRANSITIONS.get(current, set()):
        raise RegistryError(f"illegal status transition: {current} -> {target}")
    if target == "dispatched":
        errors = checkpoint_errors(task, "CP0")
        if errors:
            raise RegistryError("; ".join(errors))
    elif current == "dispatched" and target == "in_progress":
        if not release_approved or task.get("approval_status") != "granted":
            raise RegistryError("dispatched -> in_progress requires explicit release approval")
        errors = checkpoint_errors(task, "CP1")
        if errors:
            raise RegistryError("; ".join(errors))
    elif target == "awaiting_review":
        errors = checkpoint_errors(task, "CP2") + checkpoint_errors(task, "CP3")
        if errors:
            raise RegistryError("; ".join(errors))
        if task["checkpoints"]["CP2"].get("tests_passed") is not True:
            raise RegistryError("test gate blocked: CP2 tests are not passing")
        if task["checkpoints"]["CP3"].get("ci_status") != "success":
            raise RegistryError("CI gate blocked: CP3 ci_status must be success")
        if not task.get("pull_request_url"):
            raise RegistryError("awaiting_review requires a real PR URL")
    elif current == "awaiting_review" and target == "in_progress" and not changes_requested:
        raise RegistryError("awaiting_review -> in_progress requires a recorded changes-requested decision")
    elif current == "blocked" and target == "in_progress":
        if not resume_approved or task.get("blocked_by"):
            raise RegistryError("blocked -> in_progress requires resume approval and no remaining blockers")
    elif current == "paused" and target == "in_progress" and not resume_approved:
        raise RegistryError("paused -> in_progress requires explicit resume approval")
    elif current == "failed" and target == "in_progress" and not retry_approved:
        raise RegistryError("failed -> in_progress requires explicit retry approval")
    elif target == "completed":
        if not accepted_by:
            raise RegistryError("completed requires explicit total-manager acceptance (--accepted-by)")
        if any(not task.get("checkpoints", {}).get(n, {}).get("completed") for n in ("CP0", "CP1", "CP2", "CP3")):
            raise RegistryError("completed requires CP0, CP1, CP2 and CP3")
        if task.get("acceptance_status") != "accepted":
            raise RegistryError("completed requires acceptance_status=accepted")


def find_task(data: dict[str, Any], request_id: str) -> dict[str, Any]:
    matches = [t for t in data["tasks"] if t.get("request_id") == request_id]
    if len(matches) != 1:
        raise RegistryError(f"request-id must match exactly one task; found {len(matches)}")
    return matches[0]


def compare_head(recorded: str | None, observed: str | None, parent: str | None, files: list[str]) -> str:
    if not recorded or not observed:
        return "NOT_CHECKED"
    if recorded == observed:
        return "MATCH"
    if parent == recorded and files == [REGISTRY_REL]:
        return "REGISTRY_ONLY"
    return "HEAD_MISMATCH"


def git_state(root: Path) -> tuple[str, str, str | None, list[str]]:
    def run(args: list[str], check: bool = True) -> str:
        p = subprocess.run(["git", "-C", str(root), *args], text=True, capture_output=True, check=False)
        if check and p.returncode:
            raise RegistryError(p.stderr.strip() or f"git command failed: {' '.join(args)}")
        return p.stdout.strip()
    branch = run(["branch", "--show-current"])
    head = run(["rev-parse", "HEAD"])
    parent_p = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD^"], text=True, capture_output=True, check=False)
    parent = parent_p.stdout.strip() if parent_p.returncode == 0 else None
    files = run(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], check=False).splitlines()
    return branch, head, parent, files


def recovery_payload(task: dict[str, Any], observed: str | None, parent: str | None, files: list[str]) -> dict[str, Any]:
    status = compare_head(task.get("head_sha"), observed, parent, files)
    next_action = task.get("next_action")
    if status == "HEAD_MISMATCH":
        next_action = "STOP：GitHub HEAD 与登记表不一致；先调查父提交和 changed files，不改代码、不重复提交。"
    elif status == "REGISTRY_ONLY":
        next_action = "当前 HEAD 是登记表单文件登记提交；按登记的 next_action 继续前先核对其余证据。"
    return {
        "request_id": task.get("request_id"), "task_name": task.get("task_name"),
        "status": task.get("status"), "approval_status": task.get("approval_status"),
        "conversation_url": task.get("conversation_url"), "repository": task.get("repository"),
        "branch": task.get("branch"), "base_sha": task.get("base_sha"),
        "recorded_head_sha": task.get("head_sha"), "observed_head_sha": observed,
        "head_status": status, "progress": task.get("progress"), "next_action": next_action,
        "deadline": task.get("deadline"), "risk_level": task.get("risk_level"),
        "blocked_by": task.get("blocked_by", []), "depends_on": task.get("depends_on", []),
        "pull_request_url": task.get("pull_request_url"),
        "checkpoints": task.get("checkpoints", {}), "task_history_index": HISTORY_INDEX_REL,
    }


def command_check(args: argparse.Namespace) -> int:
    data = load_registry(Path(args.registry))
    errors = registry_errors(data)
    warnings = [w for t in data["tasks"] for w in checkpoint_warnings(t)]
    branch, observed, parent, files = args.branch, args.observed_head, args.observed_parent, args.observed_file or []
    if observed is None:
        try:
            current_branch, observed, parent, files = git_state(Path(args.repo_root))
            branch = branch or current_branch
            if args.branch and args.branch != current_branch:
                errors.append(f"checked-out branch is {current_branch}, not requested {args.branch}")
        except RegistryError as exc:
            warnings.append(f"local Git HEAD not checked: {exc}")
    if branch and observed:
        matches = [t for t in data["tasks"] if t.get("repository") == data.get("registry_repository") and t.get("branch") == branch]
        if not matches:
            warnings.append(f"no registry task found for branch {branch}")
        for task in matches:
            state = compare_head(task.get("head_sha"), observed, parent, files)
            print(f"HEAD_{state}: {task.get('request_id')} recorded={task.get('head_sha')} observed={observed}")
            if state == "HEAD_MISMATCH":
                errors.append(f"HEAD_MISMATCH for {task.get('request_id')}")
    else:
        warnings.append("branch/observed HEAD not supplied; actual HEAD comparison skipped")
    active = [t for t in data["tasks"] if t.get("status") in ACTIVE_STATUSES]
    print(f"ACTIVE_COUNT: {len(active)}/{data.get('parallel_limit', 10)}")
    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    if errors:
        print(f"CHECK: FAIL ({len(errors)} error(s), {len(warnings)} warning(s))")
        return 1
    print(f"CHECK: PASS ({len(warnings)} warning(s))")
    return 0


def command_register(args: argparse.Namespace) -> int:
    path = Path(args.registry)
    data = load_registry(path)
    try:
        task = json.loads(args.task_json)
    except json.JSONDecodeError as exc:
        raise RegistryError(f"--task-json invalid JSON: {exc}") from exc
    if not isinstance(task, dict) or task.get("status") != "created":
        raise RegistryError("new tasks must be a JSON object with status=created")
    errors = validate_task(task)
    if errors:
        raise RegistryError("; ".join(errors))
    rid = task.get("request_id")
    if rid not in PLACEHOLDER_IDS and any(t.get("request_id") == rid for t in data["tasks"]):
        raise RegistryError(f"duplicate request_id: {rid}")
    if any(t.get("task_key") == task.get("task_key") for t in data["tasks"]):
        raise RegistryError(f"duplicate task_key: {task.get('task_key')}")
    candidate = data["tasks"] + [task]
    errors = capacity_errors(candidate, data["parallel_limit"]) + conflict_errors(candidate)
    if errors:
        raise RegistryError("; ".join(errors))
    task["last_updated"] = now_iso()
    data["tasks"].append(task)
    save_registry(path, data)
    print(f"REGISTERED: {task['task_key']} ({rid}) status=created")
    return 0


def command_checkpoint(args: argparse.Namespace) -> int:
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError as exc:
        raise RegistryError(f"--payload invalid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise RegistryError("--payload must be a JSON object")
    payload["completed"] = True
    cps = task.setdefault("checkpoints", {})

    if args.checkpoint == "CP0":
        if task.get("status") != "created":
            raise RegistryError("CP0 can dispatch only a created task")
        for key in ("conversation_url", "branch"):
            if not payload.get(key):
                raise RegistryError(f"CP0 requires {key}")
        if not payload.get("base_sha") and not payload.get("base_sha_note"):
            raise RegistryError("CP0 requires base_sha or base_sha_note")
        task["conversation_url"] = payload["conversation_url"]
        task["branch"] = payload["branch"]
        task["base_sha"] = payload.get("base_sha", "")
        if payload.get("base_sha_note"):
            task["base_sha_note"] = payload["base_sha_note"]
        cps["CP0"] = payload
        validate_transition(task, "dispatched")
        task["status"] = "dispatched"
    elif args.checkpoint == "CP1":
        if task.get("status") != "dispatched":
            raise RegistryError("CP1 requires current status dispatched")
        cps["CP1"] = payload
        validate_transition(task, "in_progress", release_approved=True)
        task["status"] = "in_progress"
    elif args.checkpoint == "CP2":
        if task.get("status") != "in_progress":
            raise RegistryError("CP2 requires current status in_progress")
        temp = {**task, "checkpoints": {**cps, "CP2": payload}}
        errors = checkpoint_errors(temp, "CP2")
        if errors:
            raise RegistryError("; ".join(errors))
        task["head_sha"] = payload["head_sha"]
        cps["CP2"] = payload
    elif args.checkpoint == "CP3":
        if task.get("status") != "in_progress":
            raise RegistryError("CP3 requires current status in_progress")
        cps["CP3"] = payload
        errors = checkpoint_errors(task, "CP3")
        if errors:
            raise RegistryError("; ".join(errors))
        task["pull_request_url"] = payload["pull_request_url"]
        if payload["ci_status"] == "success":
            validate_transition(task, "awaiting_review")
            task["status"] = "awaiting_review"
        else:
            print(f"CP3_RECORDED: ci_status={payload['ci_status']}; task remains in_progress")
    else:
        raise RegistryError("checkpoint must be CP0, CP1, CP2 or CP3")

    task["last_updated"] = now_iso()
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"CHECKPOINT_RECORDED: {args.checkpoint} request-id={args.request_id} status={task['status']}")
    return 0


def command_transition(args: argparse.Namespace) -> int:
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    if args.to == "completed":
        if not args.accepted_by:
            raise RegistryError("completed requires --accepted-by")
        task["acceptance_status"] = "accepted"
    validate_transition(
        task, args.to, release_approved=args.release_approved,
        resume_approved=args.resume_approved, retry_approved=args.retry_approved,
        changes_requested=args.changes_requested, accepted_by=args.accepted_by,
    )
    if args.to == "completed":
        task["accepted_by"] = args.accepted_by
        task["accepted_at"] = now_iso()
        task["acceptance_note"] = args.acceptance_note or "总管明确验收"
    task["status"] = args.to
    task["last_updated"] = now_iso()
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"TRANSITIONED: {args.request_id} -> {args.to}")
    return 0


def command_recover(args: argparse.Namespace) -> int:
    data = load_registry(Path(args.registry))
    task = find_task(data, args.request_id)
    observed, parent, files = args.observed_head, args.observed_parent, args.observed_file or []
    if observed is None:
        try:
            current_branch, observed, parent, files = git_state(Path(args.repo_root))
            if current_branch != task.get("branch"):
                observed = None
        except RegistryError:
            observed = None
    payload = recovery_payload(task, observed, parent, files)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["head_status"] in {"MATCH", "REGISTRY_ONLY", "NOT_CHECKED"} else 2


def command_self_test(_: argparse.Namespace) -> int:
    passed = 0
    failed: list[str] = []

    def run(name: str, fn) -> None:
        nonlocal passed
        try:
            fn()
            passed += 1
            print(f"PASS: {name}")
        except Exception as exc:
            failed.append(name)
            print(f"FAIL: {name}: {exc}")

    def sample(key: str = "T1", rid: str = "req-1", status: str = "created") -> dict[str, Any]:
        return {
            "task_key": key, "request_id": rid, "task_name": "sample",
            "conversation_url": "https://chatgpt.com/c/example",
            "workspace": "0718 (EN) Business", "model": "GPT-6", "mode": "Chat",
            "repository": "owner/repo", "branch": f"branch-{key}",
            "base_sha": "1" * 40, "head_sha": "1" * 40, "status": status,
            "progress": "test", "next_action": "continue", "deadline": None,
            "risk_level": "medium", "approval_required": True, "last_updated": "2026-11-16",
            "cost_budget": {"max_rounds": None, "timeout_minutes": None, "cost_record": []},
            "conflict_group": None, "shared_files": [], "write_files": [],
            "depends_on": [], "blocked_by": [], "checkpoints": {},
        }

    def duplicate() -> None:
        a, b = sample("A", "same"), sample("B", "same")
        d = {"schema_version": 1, "parallel_limit": 10, "active_statuses": list(ACTIVE_STATUSES), "tasks": [a, b]}
        assert any("duplicate request_id" in e for e in registry_errors(d))

    def missing() -> None:
        a = sample()
        del a["task_name"]
        assert any("missing required field: task_name" in e for e in validate_task(a))

    def illegal_transition() -> None:
        try:
            validate_transition(sample(status="created"), "completed")
        except RegistryError:
            return
        raise AssertionError("created -> completed was accepted")

    def eleventh_active() -> None:
        tasks = [sample(f"A{i}", f"req-{i}", "in_progress") for i in range(10)]
        assert capacity_errors(tasks + [sample("A10", "req-10", "in_progress")], 10)

    def head_mismatch() -> None:
        assert compare_head("1" * 40, "2" * 40, None, []) == "HEAD_MISMATCH"

    def missing_checkpoint() -> None:
        a = sample(status="in_progress")
        a["checkpoints"] = {"CP0": {"completed": True}}
        assert any("CP1" in w for w in checkpoint_warnings(a))

    def recovery_fields() -> None:
        a = sample()
        p = recovery_payload(a, "1" * 40, None, [])
        assert p["conversation_url"] == a["conversation_url"] and p["observed_head_sha"] == "1" * 40

    def same_branch() -> None:
        a, b = sample("A", "req-A", "in_progress"), sample("B", "req-B", "awaiting_review")
        b["branch"] = a["branch"]
        assert any("same-branch" in e for e in conflict_errors([a, b]))

    def unaccepted() -> None:
        a = sample(status="awaiting_review")
        a["checkpoints"] = {n: {"completed": True} for n in ("CP0", "CP1", "CP2", "CP3")}
        a["checkpoints"]["CP2"].update({"tests_passed": True, "test_results": []})
        a["checkpoints"]["CP3"].update({"ci_status": "success", "pull_request_url": "https://github.com/o/r/pull/1", "pending_todos": []})
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        try:
            validate_transition(a, "completed")
        except RegistryError:
            return
        raise AssertionError("unaccepted task was marked completed")

    def ci_failure() -> None:
        a = sample(status="in_progress")
        a["checkpoints"] = {
            "CP2": {"completed": True, "head_sha": "2" * 40, "tests_passed": True, "test_results": []},
            "CP3": {"completed": True, "pull_request_url": "https://github.com/o/r/pull/1", "ci_status": "failure", "pending_todos": ["fix CI"]},
        }
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        try:
            validate_transition(a, "awaiting_review")
        except RegistryError:
            return
        raise AssertionError("CI failure was allowed into awaiting_review")

    def registry_only() -> None:
        assert compare_head("1" * 40, "2" * 40, "1" * 40, [REGISTRY_REL]) == "REGISTRY_ONLY"

    tests = [
        ("duplicate request-id rejected", duplicate),
        ("missing required field rejected", missing),
        ("illegal status transition rejected", illegal_transition),
        ("11th active task rejected", eleventh_active),
        ("actual HEAD mismatch flagged", head_mismatch),
        ("missing key checkpoint warned", missing_checkpoint),
        ("recovery includes real URL and SHA fields", recovery_fields),
        ("same-branch concurrent writing blocked", same_branch),
        ("unaccepted task cannot become completed", unaccepted),
        ("CI failure cannot become awaiting_review", ci_failure),
        ("registry-only self-update recognized", registry_only),
    ]
    for name, fn in tests:
        run(name, fn)
    print(f"SELF-TEST: {passed}/{len(tests)} passed; {len(failed)} failed")
    return 1 if failed else 0


def command_simulate(args: argparse.Namespace) -> int:
    data = load_registry(Path(args.registry))
    task = find_task(data, args.request_id)
    observed = args.observed_head or task.get("head_sha")
    parent, files = args.observed_parent, args.observed_file or []
    passed = 0

    def result(name: str, ok: bool, detail: str) -> None:
        nonlocal passed
        print(f"{'PASS' if ok else 'FAIL'}: {name} — {detail}")
        if ok:
            passed += 1

    # Cold-start recovery receives no browser/session/chat transcript.
    p1 = recovery_payload(task, observed, parent, files)
    ok1 = bool(p1["conversation_url"] and p1["repository"] and p1["branch"] and p1["recorded_head_sha"])
    result("browser completely closed", ok1, "uses registry + observed GitHub HEAD + task-history index only")

    # Simulate losing the original GPT conversation.
    p2 = recovery_payload(task, observed, parent, files)
    ok2 = p2["request_id"] == args.request_id and bool(p2["next_action"])
    result("GPT conversation interrupted", ok2, f"request-id/next_action recovered; head_status={p2['head_status']}")

    # A worker code commit is a direct child, but changes a source file, not just the registry.
    fake_worker_sha = "a" * 40
    s3 = compare_head(task.get("head_sha"), fake_worker_sha, task.get("head_sha"), ["tools/agent_ops/task_registry.py"])
    result("worker committed but registry not updated", s3 == "HEAD_MISMATCH", f"detected {s3}; head_sha not auto-rewritten")

    # The GitHub branch now points to an unrelated SHA.
    fake_diverged_sha = "b" * 40
    s4 = compare_head(task.get("head_sha"), fake_diverged_sha, None, [])
    result("GitHub HEAD differs from registry", s4 == "HEAD_MISMATCH", f"detected {s4}; recovery must stop")

    other = dict(task)
    other["task_key"] = "SIM-CONFLICT"
    other["request_id"] = "simulation-conflict"
    other["status"] = "in_progress"
    other["branch"] = "simulation-other-branch"
    other["write_files"] = [REGISTRY_REL]
    current = dict(task)
    current["status"] = "in_progress"
    current["write_files"] = [REGISTRY_REL]
    conflicts = conflict_errors([current, other])
    result("two tasks modify the same file", bool(conflicts), "same-file overlap rejected before concurrent write")

    print(f"INTERRUPTION-SIMULATION: {passed}/5 passed; {5 - passed} failed")
    return 0 if passed == 5 else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Agent Ops registry; registry-only writes.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check", help="validate registry, concurrency, checkpoints and current HEAD")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--repo-root", default=".")
    p.add_argument("--branch")
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_check)

    p = sub.add_parser("register", help="add one created task; writes only the registry")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--task-json", required=True)
    p.set_defaults(func=command_register)

    p = sub.add_parser("checkpoint", help="record CP0-CP3; writes only the registry")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--checkpoint", required=True, choices=("CP0", "CP1", "CP2", "CP3"))
    p.add_argument("--payload", required=True, help="JSON object containing checkpoint evidence")
    p.set_defaults(func=command_checkpoint)

    p = sub.add_parser("transition", help="record an explicit exceptional/acceptance transition")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--to", required=True, choices=sorted(STATUSES))
    p.add_argument("--release-approved", action="store_true")
    p.add_argument("--resume-approved", action="store_true")
    p.add_argument("--retry-approved", action="store_true")
    p.add_argument("--changes-requested", action="store_true")
    p.add_argument("--accepted-by")
    p.add_argument("--acceptance-note")
    p.set_defaults(func=command_transition)

    p = sub.add_parser("recover", help="generate recovery information from registry and observed GitHub state")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--repo-root", default=".")
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_recover)

    p = sub.add_parser("self-test", help="run built-in validator and transition tests")
    p.set_defaults(func=command_self_test)

    p = sub.add_parser("simulate", help="run five interruption-recovery simulations")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_simulate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except RegistryError as exc:
        print(f"REJECTED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
