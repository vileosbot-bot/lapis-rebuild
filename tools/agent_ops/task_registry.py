#!/usr/bin/env python3
"""Dependency-free Agent Ops registry manager.

The .yml registry uses the JSON-compatible subset of YAML 1.2 so only the
Python standard library is required. Writes are restricted to the registry.
This tool never edits application code, merges pull requests, or deploys.
"""
from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REGISTRY_REL = "docs/agent-ops/task-registry.yml"
HISTORY_INDEX_REL = "docs/agent-ops/task-history/README"
PLACEHOLDER_IDS = {"\u5f85\u6d3e\u6d3b\u65f6\u586b"}
STATUSES = {
    "created", "dispatched", "in_progress", "awaiting_review", "completed",
    "blocked", "paused", "failed", "cancelled", "dead_letter",
}
ACTIVE = {"in_progress", "awaiting_review"}
REQUIRED = (
    "task_key", "request_id", "task_name", "conversation_url", "workspace",
    "model", "mode", "repository", "branch", "base_sha", "head_sha",
    "status", "progress", "next_action", "deadline", "risk_level",
    "approval_required", "last_updated", "head_sha_verified_at", "cost_budget", "conflict_group",
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
        raise RegistryError(f"invalid JSON-compatible YAML at {exc.lineno}:{exc.colno}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
        raise RegistryError("registry root must contain a tasks array")
    return data


def save_registry(path: Path, data: dict[str, Any]) -> None:
    """Atomically write only the registry file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(payload)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def validate_task(task: dict[str, Any]) -> list[str]:
    errors = [f"missing required field: {k}" for k in REQUIRED if k not in task]
    if errors:
        return errors
    if not isinstance(task["task_key"], str) or not task["task_key"].strip():
        errors.append("task_key must be a non-empty string")
    if not isinstance(task["request_id"], str) or not task["request_id"].strip():
        errors.append("request_id must be non-empty")
    if not isinstance(task["task_name"], str) or not task["task_name"].strip():
        errors.append("task_name must be non-empty")
    if task["status"] not in STATUSES:
        errors.append(f"illegal status: {task['status']}")
    if not isinstance(task["approval_required"], bool):
        errors.append("approval_required must be boolean")
    if task["head_sha_verified_at"] is not None and not isinstance(task["head_sha_verified_at"], str):
        errors.append("head_sha_verified_at must be an ISO date string or null")
    budget = task["cost_budget"]
    if not isinstance(budget, dict):
        errors.append("cost_budget must be an object")
    else:
        for key in ("max_rounds", "timeout_minutes", "cost_record"):
            if key not in budget:
                errors.append(f"cost_budget missing {key}")
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
                errors.append(f"{task['status']} requires {key}")
        if not task.get("base_sha") and not task.get("base_sha_note"):
            errors.append("base_sha or documented root-commit exception required")
    if task["status"] in ACTIVE and not task.get("head_sha"):
        errors.append(f"{task['status']} requires head_sha")
    return errors


def capacity_errors(tasks: list[dict[str, Any]], limit: int) -> list[str]:
    count = sum(1 for task in tasks if task.get("status") in ACTIVE)
    return [f"parallel limit exceeded: {count} active tasks > {limit}"] if count > limit else []


def conflict_errors(tasks: list[dict[str, Any]]) -> list[str]:
    active = [task for task in tasks if task.get("status") in ACTIVE]
    errors: list[str] = []
    for index, left in enumerate(active):
        for right in active[index + 1:]:
            if left.get("repository") == right.get("repository") and left.get("branch") == right.get("branch") and left.get("branch"):
                errors.append(f"same-branch concurrent write: {left.get('request_id')} / {right.get('request_id')}")
            overlap = sorted(set(left.get("write_files", [])) & set(right.get("write_files", [])))
            if overlap:
                errors.append(f"shared-file concurrent write: {', '.join(overlap)}")
    return errors


def dependency_errors(data: dict[str, Any], task: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for dependency in task.get("depends_on", []):
        matches = [item for item in data.get("tasks", [])
                   if item.get("request_id") == dependency or item.get("task_key") == dependency]
        if len(matches) != 1:
            errors.append(f"dependency not uniquely registered: {dependency}")
        elif matches[0].get("status") != "completed":
            errors.append(f"dependency not completed: {dependency}")
    return errors


def registry_errors(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    if data.get("parallel_limit") != 10:
        errors.append("parallel_limit must remain exactly 10")
    if set(data.get("active_statuses", [])) != ACTIVE:
        errors.append("active_statuses must be in_progress and awaiting_review")
    ids: set[str] = set()
    keys: set[str] = set()
    for index, task in enumerate(data.get("tasks", [])):
        if not isinstance(task, dict):
            errors.append(f"tasks[{index}] must be an object")
            continue
        errors.extend(f"tasks[{index}]: {item}" for item in validate_task(task))
        key = task.get("task_key")
        if key in keys:
            errors.append(f"duplicate task_key: {key}")
        elif key:
            keys.add(key)
        rid = task.get("request_id")
        if rid and rid not in PLACEHOLDER_IDS:
            if rid in ids:
                errors.append(f"duplicate request_id: {rid}")
            ids.add(rid)
    errors.extend(capacity_errors(data.get("tasks", []), 10))
    errors.extend(conflict_errors(data.get("tasks", [])))
    for task in data.get("tasks", []):
        if task.get("status") in ACTIVE:
            errors.extend(dependency_errors(data, task))
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
    return [f"{task.get('request_id')}: missing checkpoints {','.join(missing)}"] if missing else []


def checkpoint_errors(task: dict[str, Any], name: str) -> list[str]:
    item = task.get("checkpoints", {}).get(name, {})
    if name == "CP0":
        errors = [f"CP0 missing {key}" for key in ("conversation_url", "branch") if not item.get(key)]
        if not item.get("base_sha") and not (item.get("base_sha_note") or task.get("base_sha_note")):
            errors.append("CP0 missing base_sha/root-commit note")
        return errors
    if name == "CP1":
        errors = []
        if not item.get("authorization_scope"):
            errors.append("CP1 missing authorization_scope")
        if not item.get("plan_steps"):
            errors.append("CP1 missing plan_steps")
        if item.get("release_status") != "granted":
            errors.append("CP1 release_status must be granted")
        return errors
    if name == "CP2":
        errors = []
        if not re.fullmatch(r"[0-9a-f]{40}", str(item.get("head_sha", ""))):
            errors.append("CP2 requires a 40-character head_sha")
        if not isinstance(item.get("tests_passed"), bool):
            errors.append("CP2 requires tests_passed boolean")
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


def completion_authorization_errors(task: dict[str, Any], supplied_accepted_by: str | None) -> list[str]:
    """Require the manager's acceptance to be recorded before the worker transition."""
    errors: list[str] = []
    if task.get("acceptance_status") != "accepted":
        errors.append("acceptance_status must be pre-recorded as accepted by the total manager")
    recorded = task.get("accepted_by")
    if not isinstance(recorded, str) or not recorded.strip():
        errors.append("accepted_by must be pre-recorded in the registry by the total manager")
    elif supplied_accepted_by != recorded:
        errors.append(" --accepted-by must exactly match the registry's pre-recorded accepted_by")
    return errors


def resolve_check_branch(current_branch: str, requested_branch: str | None):
    """Resolve branch association without treating detached HEAD as an empty branch mismatch."""
    if not current_branch:
        if requested_branch:
            return requested_branch, ["detached HEAD; using explicit --branch for task association"], []
        return None, [], ["detached HEAD requires --branch; HEAD comparison skipped"]
    if requested_branch and requested_branch != current_branch:
        return current_branch, [], [f"checked-out branch {current_branch} != requested {requested_branch}"]
    return requested_branch or current_branch, [], []


def checkpoint_gate_errors(tasks: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for task in tasks:
        errors.extend(f"checkpoint gate error: {warning}" for warning in checkpoint_warnings(task))
    return errors


def validate_transition(task: dict[str, Any], target: str, *, release=False, resume=False,
                        retry=False, changes_requested=False, accepted_by=None) -> None:
    current = task.get("status")
    if target not in TRANSITIONS.get(current, set()):
        raise RegistryError(f"illegal status transition: {current} -> {target}")
    if target == "dispatched":
        errors = checkpoint_errors(task, "CP0")
        if errors:
            raise RegistryError("; ".join(errors))
    elif current == "dispatched" and target == "in_progress":
        if not release or task.get("approval_status") != "granted":
            raise RegistryError("explicit release approval required")
        errors = checkpoint_errors(task, "CP1")
        if errors:
            raise RegistryError("; ".join(errors))
    elif target == "awaiting_review":
        errors = checkpoint_errors(task, "CP2") + checkpoint_errors(task, "CP3")
        if errors:
            raise RegistryError("; ".join(errors))
        if task["checkpoints"]["CP2"].get("tests_passed") is not True:
            raise RegistryError("test gate failed")
        if not task.get("pull_request_url"):
            raise RegistryError("PR URL required")
    elif current == "awaiting_review" and target == "in_progress" and not changes_requested:
        raise RegistryError("changes-requested decision required")
    elif current == "blocked" and target == "in_progress":
        if not resume or task.get("blocked_by"):
            raise RegistryError("resume approval and cleared blockers required")
    elif current == "paused" and target == "in_progress" and not resume:
        raise RegistryError("resume approval required")
    elif current == "failed" and target == "in_progress" and not retry:
        raise RegistryError("retry approval required")
    elif target == "dead_letter":
        evidence = task.get("dead_letter_evidence", {})
        kind = evidence.get("limit_type")
        limit = task.get("cost_budget", {}).get(kind)
        actual = evidence.get("actual_value")
        if kind not in {"max_rounds", "timeout_minutes"} or limit is None:
            raise RegistryError("dead_letter requires a configured max_rounds or timeout_minutes limit")
        if not isinstance(actual, (int, float)) or actual <= limit or not evidence.get("evidence"):
            raise RegistryError("dead_letter requires actual_value > limit and supporting evidence")
    elif target == "completed":
        authorization_errors = completion_authorization_errors(task, accepted_by)
        if authorization_errors:
            raise RegistryError("; ".join(authorization_errors))
        if any(not task.get("checkpoints", {}).get(n, {}).get("completed") for n in ("CP0", "CP1", "CP2", "CP3")):
            raise RegistryError("CP0-CP3 required before completion")
        if task.get("acceptance_status") != "accepted":
            raise RegistryError("acceptance_status must be accepted")
        if task.get("checkpoints", {}).get("CP3", {}).get("ci_status") != "success":
            raise RegistryError("cannot complete while CP3 CI status is not success")


def find_task(data: dict[str, Any], request_id: str) -> dict[str, Any]:
    matches = [task for task in data["tasks"] if task.get("request_id") == request_id]
    if len(matches) != 1:
        raise RegistryError(f"request-id must match exactly one task; found {len(matches)}")
    return matches[0]


def compare_head(recorded, observed, parent, files) -> str:
    if not recorded or not observed:
        return "NOT_CHECKED"
    if recorded == observed:
        return "MATCH"
    if parent == recorded and files == [REGISTRY_REL]:
        return "REGISTRY_ONLY"
    return "HEAD_MISMATCH"


def git_state(root: Path):
    def run(args, check=True):
        proc = subprocess.run(["git", "-C", str(root), *args], text=True, capture_output=True, check=False)
        if check and proc.returncode:
            raise RegistryError(proc.stderr.strip() or "git command failed")
        return proc.stdout.strip()
    branch = run(["branch", "--show-current"])
    head = run(["rev-parse", "HEAD"])
    parent_proc = subprocess.run(["git", "-C", str(root), "rev-parse", "HEAD^"], text=True, capture_output=True, check=False)
    parent = parent_proc.stdout.strip() if parent_proc.returncode == 0 else None
    files = run(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], check=False).splitlines()
    return branch, head, parent, files


def recovery_payload(task, observed, parent, files):
    state = compare_head(task.get("head_sha"), observed, parent, files)
    next_action = task.get("next_action")
    if state == "HEAD_MISMATCH":
        next_action = "STOP: inspect GitHub parent and changed files; do not edit or repeat a commit."
    elif state == "REGISTRY_ONLY":
        next_action = "Registry-only commit recognized; verify remaining evidence before continuing."
    return {
        "request_id": task.get("request_id"), "task_name": task.get("task_name"),
        "status": task.get("status"), "approval_status": task.get("approval_status"),
        "conversation_url": task.get("conversation_url"), "repository": task.get("repository"),
        "branch": task.get("branch"), "base_sha": task.get("base_sha"),
        "recorded_head_sha": task.get("head_sha"), "observed_head_sha": observed,
        "head_status": state, "progress": task.get("progress"), "next_action": next_action,
        "deadline": task.get("deadline"), "risk_level": task.get("risk_level"),
        "blocked_by": task.get("blocked_by", []), "depends_on": task.get("depends_on", []),
        "pull_request_url": task.get("pull_request_url"),
        "checkpoints": task.get("checkpoints", {}), "task_history_index": HISTORY_INDEX_REL,
    }


def command_check(args):
    data = load_registry(Path(args.registry))
    errors = registry_errors(data)
    errors.extend(checkpoint_gate_errors(data["tasks"]))
    warnings = []
    branch, observed, parent, files = args.branch, args.observed_head, args.observed_parent, args.observed_file or []
    if observed is None:
        try:
            current, observed, parent, files = git_state(Path(args.repo_root))
            branch, branch_warnings, branch_errors = resolve_check_branch(current, args.branch)
            warnings.extend(branch_warnings)
            errors.extend(branch_errors)
        except RegistryError as exc:
            warnings.append(f"local Git HEAD not checked: {exc}")
    if branch and observed:
        matches = [t for t in data["tasks"] if t.get("repository") == data.get("registry_repository") and t.get("branch") == branch]
        if not matches:
            warnings.append(f"no registry task for branch {branch}")
        for task in matches:
            state = compare_head(task.get("head_sha"), observed, parent, files)
            print(f"HEAD_{state}: {task.get('request_id')} recorded={task.get('head_sha')} observed={observed}")
            if state == "HEAD_MISMATCH":
                errors.append(f"HEAD_MISMATCH for {task.get('request_id')}")
    else:
        errors.append("HEAD comparison skipped: provide a branch association and an observed HEAD; CHECK cannot pass without a comparison")
    active_count = sum(1 for t in data["tasks"] if t.get("status") in ACTIVE)
    print(f"ACTIVE_COUNT: {active_count}/{data.get('parallel_limit', 10)}")
    for warning in warnings:
        print(f"WARN: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        print(f"CHECK: FAIL ({len(errors)} error(s), {len(warnings)} warning(s))")
        return 1
    print(f"CHECK: PASS ({len(warnings)} warning(s))")
    return 0


def command_register(args):
    path = Path(args.registry)
    data = load_registry(path)
    task = json.loads(args.task_json)
    if not isinstance(task, dict) or task.get("status") != "created":
        raise RegistryError("new task must be an object with status=created")
    errors = validate_task(task)
    if errors:
        raise RegistryError("; ".join(errors))
    rid = task.get("request_id")
    if rid not in PLACEHOLDER_IDS and any(t.get("request_id") == rid for t in data["tasks"]):
        raise RegistryError(f"duplicate request_id: {rid}")
    if any(t.get("task_key") == task.get("task_key") for t in data["tasks"]):
        raise RegistryError(f"duplicate task_key: {task.get('task_key')}")
    errors = capacity_errors(data["tasks"] + [task], 10) + conflict_errors(data["tasks"] + [task])
    if errors:
        raise RegistryError("; ".join(errors))
    task["last_updated"] = now_iso()
    data["tasks"].append(task)
    save_registry(path, data)
    print(f"REGISTERED: {task['task_key']} status=created")
    return 0


def command_checkpoint(args):
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    payload = json.loads(args.payload)
    if not isinstance(payload, dict):
        raise RegistryError("checkpoint payload must be an object")
    payload["completed"] = True
    cps = task.setdefault("checkpoints", {})
    name = args.checkpoint

    if name == "CP0":
        if task.get("status") != "created":
            raise RegistryError("CP0 requires created status")
        if not payload.get("conversation_url") or not payload.get("branch"):
            raise RegistryError("CP0 requires conversation_url and branch")
        if not payload.get("base_sha") and not payload.get("base_sha_note"):
            raise RegistryError("CP0 requires base_sha or root-commit note")
        task["conversation_url"] = payload["conversation_url"]
        task["branch"] = payload["branch"]
        task["base_sha"] = payload.get("base_sha", "")
        if payload.get("base_sha_note"):
            task["base_sha_note"] = payload["base_sha_note"]
        cps["CP0"] = payload
        validate_transition(task, "dispatched")
        task["status"] = "dispatched"
    elif name == "CP1":
        if task.get("status") != "dispatched":
            raise RegistryError("CP1 requires dispatched status")
        dep_errors = dependency_errors(data, task)
        if dep_errors:
            raise RegistryError("; ".join(dep_errors))
        cps["CP1"] = payload
        validate_transition(task, "in_progress", release=True)
        task["status"] = "in_progress"
    elif name == "CP2":
        if task.get("status") != "in_progress":
            raise RegistryError("CP2 requires in_progress status")
        temp = {**task, "checkpoints": {**cps, "CP2": payload}}
        errors = checkpoint_errors(temp, "CP2")
        if errors:
            raise RegistryError("; ".join(errors))
        task["head_sha"] = payload["head_sha"]
        cps["CP2"] = payload
    elif name == "CP3":
        if task.get("status") != "in_progress":
            raise RegistryError("CP3 requires in_progress status")
        cps["CP3"] = payload
        errors = checkpoint_errors(task, "CP3")
        if errors:
            raise RegistryError("; ".join(errors))
        task["pull_request_url"] = payload["pull_request_url"]
        validate_transition(task, "awaiting_review")
        task["status"] = "awaiting_review"
        if payload["ci_status"] != "success":
            print(f"CI_NOT_PASS: awaiting_review recorded with ci_status={payload['ci_status']}; not marked success")
    else:
        raise RegistryError("checkpoint must be CP0, CP1, CP2 or CP3")

    task["last_updated"] = now_iso()
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"CHECKPOINT_RECORDED: {name} {args.request_id} status={task['status']}")
    return 0


def command_transition(args):
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    if args.to == "in_progress":
        dep_errors = dependency_errors(data, task)
        if dep_errors:
            raise RegistryError("; ".join(dep_errors))
    if args.to == "dead_letter":
        if not args.dead_letter_evidence:
            raise RegistryError("dead_letter requires --dead-letter-evidence JSON")
        task["dead_letter_evidence"] = json.loads(args.dead_letter_evidence)
    if args.to == "completed":
        authorization_errors = completion_authorization_errors(task, args.accepted_by)
        if authorization_errors:
            raise RegistryError("; ".join(authorization_errors))
    validate_transition(
        task, args.to, release=args.release_approved, resume=args.resume_approved,
        retry=args.retry_approved, changes_requested=args.changes_requested,
        accepted_by=args.accepted_by,
    )
    task["status"] = args.to
    task["last_updated"] = now_iso()
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"TRANSITIONED: {args.request_id} -> {args.to}")
    return 0


def command_recover(args):
    data = load_registry(Path(args.registry))
    task = find_task(data, args.request_id)
    observed, parent, files = args.observed_head, args.observed_parent, args.observed_file or []
    if observed is None:
        try:
            current, observed, parent, files = git_state(Path(args.repo_root))
            if current != task.get("branch"):
                observed = None
        except RegistryError:
            observed = None
    payload = recovery_payload(task, observed, parent, files)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["head_status"] in {"MATCH", "REGISTRY_ONLY", "NOT_CHECKED"} else 2


def command_self_test(_args):
    passed, failed = 0, []

    def run(name, fn):
        nonlocal passed
        try:
            fn()
            passed += 1
            print(f"PASS: {name}")
        except Exception as exc:
            failed.append(name)
            print(f"FAIL: {name}: {exc}")

    def sample(key="T1", rid="req-1", status="created"):
        return {
            "task_key": key, "request_id": rid, "task_name": "sample",
            "conversation_url": "https://chatgpt.com/c/example",
            "workspace": "test", "model": "GPT-6", "mode": "Chat",
            "repository": "owner/repo", "branch": f"branch-{key}",
            "base_sha": "1" * 40, "head_sha": "1" * 40, "status": status,
            "progress": "test", "next_action": "continue", "deadline": None,
            "risk_level": "medium", "approval_required": True, "last_updated": "2026-11-16",
            "head_sha_verified_at": None,
            "cost_budget": {"max_rounds": None, "timeout_minutes": None, "cost_record": []},
            "conflict_group": None, "shared_files": [], "write_files": [],
            "depends_on": [], "blocked_by": [], "checkpoints": {},
        }

    def duplicate():
        a, b = sample("A", "same"), sample("B", "same")
        data = {"schema_version": 1, "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [a, b]}
        assert any("duplicate request_id" in e for e in registry_errors(data))

    def missing():
        a = sample()
        del a["task_name"]
        assert any("missing required field: task_name" in e for e in validate_task(a))

    def missing_head_sha_verified_at():
        a = sample()
        del a["head_sha_verified_at"]
        assert any("missing required field: head_sha_verified_at" in e for e in validate_task(a))

    def illegal():
        try:
            validate_transition(sample(status="created"), "completed")
        except RegistryError:
            return
        raise AssertionError("created -> completed accepted")

    def eleventh():
        tasks = [sample(f"A{i}", f"req-{i}", "in_progress") for i in range(10)]
        assert capacity_errors(tasks + [sample("A10", "req-10", "in_progress")], 10)

    def head_mismatch():
        assert compare_head("1" * 40, "2" * 40, None, []) == "HEAD_MISMATCH"

    def missing_cp():
        a = sample(status="in_progress")
        a["checkpoints"] = {"CP0": {"completed": True}}
        assert any("CP1" in w for w in checkpoint_warnings(a))

    def recovery():
        a = sample()
        p = recovery_payload(a, "1" * 40, None, [])
        assert p["conversation_url"] == a["conversation_url"] and p["observed_head_sha"] == "1" * 40

    def same_branch():
        a, b = sample("A", "req-A", "in_progress"), sample("B", "req-B", "awaiting_review")
        b["branch"] = a["branch"]
        assert any("same-branch" in e for e in conflict_errors([a, b]))

    def unaccepted():
        a = sample(status="awaiting_review")
        a["checkpoints"] = {n: {"completed": True} for n in ("CP0", "CP1", "CP2", "CP3")}
        a["checkpoints"]["CP2"].update({"tests_passed": True, "test_results": []})
        a["checkpoints"]["CP3"].update({"ci_status": "success", "pull_request_url": "https://github.com/o/r/pull/1", "pending_todos": []})
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        try:
            validate_transition(a, "completed")
        except RegistryError:
            return
        raise AssertionError("unaccepted task completed")

    def ci_failure():
        a = sample(status="in_progress")
        a["checkpoints"] = {
            "CP2": {"completed": True, "head_sha": "2" * 40, "tests_passed": True, "test_results": []},
            "CP3": {"completed": True, "pull_request_url": "https://github.com/o/r/pull/1", "ci_status": "failure", "pending_todos": ["fix CI"]},
        }
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        validate_transition(a, "awaiting_review")
        a["status"] = "awaiting_review"
        a["acceptance_status"] = "accepted"
        try:
            validate_transition(a, "completed", accepted_by="manager")
        except RegistryError:
            return
        raise AssertionError("CI failure was allowed to complete")

    def registry_only():
        assert compare_head("1" * 40, "2" * 40, "1" * 40, [REGISTRY_REL]) == "REGISTRY_ONLY"
    def dependency_blocked():
        a = sample(status="in_progress")
        a["depends_on"] = ["missing-upstream"]
        assert dependency_errors({"tasks": [a]}, a)
    def dead_letter_guard():
        a = sample(status="failed")
        try:
            validate_transition(a, "dead_letter")
        except RegistryError:
            return
        raise AssertionError("dead_letter accepted without exceeded budget evidence")

    def run_check_fixture(task, current_branch, requested_branch):
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [task],
            })
            original_git_state = globals()["git_state"]
            globals()["git_state"] = lambda _root: (current_branch, "1" * 40, None, [])
            output = io.StringIO()
            try:
                args = argparse.Namespace(
                    registry=str(registry_path), repo_root=directory,
                    branch=requested_branch, observed_head=None,
                    observed_parent=None, observed_file=[],
                )
                with contextlib.redirect_stdout(output):
                    result = command_check(args)
            finally:
                globals()["git_state"] = original_git_state
            return result, output.getvalue()

    def transition_cli_exit_code(acceptance_status, recorded_by, supplied_by):
        a = sample(status="awaiting_review")
        a["checkpoints"] = {n: {"completed": True} for n in ("CP0", "CP1", "CP2", "CP3")}
        a["checkpoints"]["CP2"].update({"tests_passed": True, "test_results": []})
        a["checkpoints"]["CP3"].update({"ci_status": "success", "pull_request_url": "https://github.com/o/r/pull/1", "pending_todos": []})
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        a["acceptance_status"] = acceptance_status
        a["accepted_by"] = recorded_by
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [a],
            })
            command = [sys.executable, __file__, "transition", "--registry", str(registry_path),
                       "--request-id", a["request_id"], "--to", "completed"]
            if supplied_by is not None:
                command.extend(["--accepted-by", supplied_by])
            result = subprocess.run(command, text=True, capture_output=True, check=False)
            assert result.returncode == 2, (result.returncode, result.stdout, result.stderr)
            assert "REJECTED:" in result.stderr, result.stderr
            after = load_registry(registry_path)["tasks"][0]
            assert after["status"] == "awaiting_review"
            assert after["acceptance_status"] == acceptance_status

    def completion_cli_missing_acceptance_flag_exit_2():
        transition_cli_exit_code("accepted", "total-manager", None)

    def completion_cli_mismatched_identity_exit_2():
        transition_cli_exit_code("accepted", "total-manager", "random-name")

    def transition_fixture(acceptance_status, recorded_by, supplied_by):
        a = sample(status="awaiting_review")
        a["checkpoints"] = {n: {"completed": True} for n in ("CP0", "CP1", "CP2", "CP3")}
        a["checkpoints"]["CP2"].update({"tests_passed": True, "test_results": []})
        a["checkpoints"]["CP3"].update({"ci_status": "success", "pull_request_url": "https://github.com/o/r/pull/1", "pending_todos": []})
        a["pull_request_url"] = "https://github.com/o/r/pull/1"
        a["acceptance_status"] = acceptance_status
        if recorded_by is not None:
            a["accepted_by"] = recorded_by
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [a],
            })
            args = argparse.Namespace(
                registry=str(registry_path), request_id=a["request_id"], to="completed",
                release_approved=False, resume_approved=False, retry_approved=False,
                changes_requested=False, accepted_by=supplied_by, acceptance_note=None,
                dead_letter_evidence=None,
            )
            before = load_registry(registry_path)["tasks"][0]
            try:
                command_transition(args)
            except RegistryError:
                after = load_registry(registry_path)["tasks"][0]
                assert after["status"] == "awaiting_review"
                assert after.get("acceptance_status") == acceptance_status
                return
            raise AssertionError("command_transition accepted unapproved completion")

    def completion_not_preaccepted():
        transition_fixture("pending", "total-manager", "total-manager")

    def completion_identity_mismatch():
        transition_fixture("accepted", "total-manager", "random-name")

    def missing_cp_check_fails():
        a = sample(status="awaiting_review")
        a["checkpoints"] = {
            "CP0": {"completed": True}, "CP1": {"completed": True},
            "CP2": {"completed": True, "tests_passed": True, "test_results": []},
        }
        result, output = run_check_fixture(a, "branch-T1", "branch-T1")
        assert result == 1 and "CHECK: FAIL" in output and "CP3" in output, output

    def detached_without_branch_fails():
        a = sample(status="created")
        result, output = run_check_fixture(a, "", None)
        assert result != 0 and "CHECK: FAIL" in output and "detached HEAD requires --branch" in output, output

    def detached_with_branch_uses_explicit_branch():
        a = sample(status="created")
        result, output = run_check_fixture(a, "", "branch-T1")
        assert result == 0 and "CHECK: PASS" in output and "HEAD_MATCH" in output, output
        assert "detached HEAD; using explicit --branch" in output, output

    tests = [
        ("duplicate request-id rejected", duplicate),
        ("missing required field rejected", missing),
        ("missing head_sha_verified_at rejected", missing_head_sha_verified_at),
        ("illegal status transition rejected", illegal),
        ("11th active task rejected", eleventh),
        ("actual HEAD mismatch flagged", head_mismatch),
        ("missing key checkpoint warned", missing_cp),
        ("recovery emits URL and SHA", recovery),
        ("same-branch concurrent write blocked", same_branch),
        ("unaccepted task cannot complete", unaccepted),
        ("CI failure is recorded honestly and cannot complete", ci_failure),
        ("registry-only metadata commit recognized", registry_only),
        ("uncompleted dependency blocks start", dependency_blocked),
        ("dead-letter requires exceeded budget evidence", dead_letter_guard),
        ("completion rejected without pre-recorded manager acceptance", completion_not_preaccepted),
        ("completion rejects mismatched --accepted-by identity", completion_identity_mismatch),
        ("CLI without --accepted-by exits 2", completion_cli_missing_acceptance_flag_exit_2),
        ("CLI with mismatched --accepted-by exits 2", completion_cli_mismatched_identity_exit_2),
        ("missing CP3 in awaiting_review makes check FAIL", missing_cp_check_fails),
        ("detached HEAD without --branch cannot PASS", detached_without_branch_fails),
        ("detached HEAD with --branch is associated without false mismatch", detached_with_branch_uses_explicit_branch),
    ]
    for name, fn in tests:
        run(name, fn)
    print(f"SELF-TEST: {passed}/{len(tests)} passed; {len(failed)} failed")
    return 1 if failed else 0


def command_simulate(args):
    data = load_registry(Path(args.registry))
    task = find_task(data, args.request_id)
    observed, parent, files = args.observed_head or task.get("head_sha"), args.observed_parent, args.observed_file or []
    passed = 0

    def report(name, ok, detail):
        nonlocal passed
        print(f"{'PASS' if ok else 'FAIL'}: {name} - {detail}")
        passed += int(ok)

    p1 = recovery_payload(task, observed, parent, files)
    report("browser closed", bool(p1["conversation_url"] and p1["repository"] and p1["branch"] and p1["recorded_head_sha"]),
           "registry + observed GitHub HEAD + history index only")
    p2 = recovery_payload(task, observed, parent, files)
    report("GPT conversation interrupted", p2["request_id"] == args.request_id and bool(p2["next_action"]),
           f"request-id/next_action recovered; head_status={p2['head_status']}")
    fake_worker = "a" * 40
    s3 = compare_head(task.get("head_sha"), fake_worker, task.get("head_sha"), ["tools/agent_ops/task_registry.py"])
    report("worker commit not yet registered", s3 == "HEAD_MISMATCH", f"detected {s3}; no auto-update")
    fake_diverged = "b" * 40
    s4 = compare_head(task.get("head_sha"), fake_diverged, None, [])
    report("GitHub HEAD mismatch", s4 == "HEAD_MISMATCH", f"detected {s4}; stop and investigate")
    left, right = dict(task), dict(task)
    left.update({"status": "in_progress", "write_files": [REGISTRY_REL]})
    right.update({"task_key": "SIM", "request_id": "sim-conflict", "status": "in_progress",
                  "branch": "other-branch", "write_files": [REGISTRY_REL]})
    report("two tasks write same file", bool(conflict_errors([left, right])), "shared path rejected")
    print(f"INTERRUPTION-SIMULATION: {passed}/5 passed; {5 - passed} failed")
    return 0 if passed == 5 else 1


def build_parser():
    parser = argparse.ArgumentParser(description="Agent Ops registry; registry-only writes.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--repo-root", default=".")
    p.add_argument("--branch")
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_check)

    p = sub.add_parser("register")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--task-json", required=True)
    p.set_defaults(func=command_register)

    p = sub.add_parser("checkpoint")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--checkpoint", required=True, choices=("CP0", "CP1", "CP2", "CP3"))
    p.add_argument("--payload", required=True)
    p.set_defaults(func=command_checkpoint)

    p = sub.add_parser("transition")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--to", required=True, choices=sorted(STATUSES))
    p.add_argument("--release-approved", action="store_true")
    p.add_argument("--resume-approved", action="store_true")
    p.add_argument("--retry-approved", action="store_true")
    p.add_argument("--changes-requested", action="store_true")
    p.add_argument("--accepted-by")
    p.add_argument("--acceptance-note")
    p.add_argument("--dead-letter-evidence")
    p.set_defaults(func=command_transition)

    p = sub.add_parser("recover")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--repo-root", default=".")
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_recover)

    p = sub.add_parser("self-test")
    p.set_defaults(func=command_self_test)

    p = sub.add_parser("simulate")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--observed-head")
    p.add_argument("--observed-parent")
    p.add_argument("--observed-file", action="append", default=[])
    p.set_defaults(func=command_simulate)
    return parser


def main():
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (RegistryError, json.JSONDecodeError) as exc:
        print(f"REJECTED: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
