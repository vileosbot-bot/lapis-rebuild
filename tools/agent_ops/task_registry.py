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
BUDGET_TIERS = {"small": (15, 60), "medium": (30, 120), "large": (50, 240)}
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
    "completed": set(), "cancelled": set(), "dead_letter": {"in_progress"},
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
        for key in ("max_rounds", "timeout_minutes"):
            value = budget.get(key)
            if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value <= 0):
                errors.append(f"cost_budget.{key} must be a positive integer or null")
        if "budget_decisions" in budget and not isinstance(budget["budget_decisions"], list):
            errors.append("cost_budget.budget_decisions must be an array")
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
                        retry=False, changes_requested=False, accepted_by=None,
                        approved_by=None, manager_diagnosis=None) -> None:
    current = task.get("status")
    if target not in TRANSITIONS.get(current, set()):
        raise RegistryError(f"illegal status transition: {current} -> {target}")
    if target == "dispatched":
        budget = task.get("cost_budget", {})
        missing_budget = [key for key in ("max_rounds", "timeout_minutes") if budget.get(key) is None]
        if missing_budget:
            raise RegistryError("dispatch requires configured cost_budget fields: " + ", ".join(missing_budget))
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
    elif current == "dead_letter" and target == "in_progress":
        if not retry or approved_by not in {"total-manager", "总管"} or not isinstance(manager_diagnosis, str) or not manager_diagnosis.strip():
            raise RegistryError("dead_letter retry requires --retry-approved, --approved-by total-manager/总管, and --manager-diagnosis")
        report = task.get("dead_letter_report", {})
        limit_type = report.get("limit_type")
        previous_limit = report.get("limit")
        new_limit = task.get("cost_budget", {}).get(limit_type)
        if limit_type not in {"max_rounds", "timeout_minutes"} or not isinstance(previous_limit, (int, float)) or not isinstance(new_limit, (int, float)) or new_limit <= previous_limit:
            raise RegistryError("dead_letter retry requires a manager-approved budget increase beyond the recorded limit")
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
        if not task.get("legacy_import") and any(not task.get("checkpoints", {}).get(n, {}).get("completed") for n in ("CP0", "CP1", "CP2", "CP3")):
            raise RegistryError("CP0-CP3 required before completion")
        if task.get("acceptance_status") != "accepted":
            raise RegistryError("acceptance_status must be accepted")
        if task.get("checkpoints", {}).get("CP3", {}).get("ci_status") != "success" and not _acceptance_basis(task):
            raise RegistryError("cannot complete while CP3 CI status is not success without a recorded acceptance_basis (manager baseline-comparison acceptance)")


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
        approved_by=getattr(args, "approved_by", None),
        manager_diagnosis=getattr(args, "manager_diagnosis", None),
    )
    if task.get("status") == "dead_letter" and args.to == "in_progress":
        task.setdefault("dead_letter_history", []).append({
            "report": task.get("dead_letter_report"),
            "approved_by": getattr(args, "approved_by", None),
            "manager_diagnosis": getattr(args, "manager_diagnosis", None),
            "reopened_at": now_iso(),
        })
    if args.to == "dead_letter":
        evidence = task["dead_letter_evidence"]
        limit_type = evidence["limit_type"]
        task["dead_letter_report"] = {
            "generated_at": now_iso(),
            "request_id": task.get("request_id"),
            "status_before": task.get("status"),
            "completed_progress": task.get("progress"),
            "stuck_reason": task.get("next_action"),
            "limit_type": limit_type,
            "limit": task.get("cost_budget", {}).get(limit_type),
            "actual_value": evidence.get("actual_value"),
            "evidence": evidence.get("evidence"),
            "action": "stopped; no automatic retry; await total-manager diagnosis",
        }
    task["status"] = args.to
    task["last_updated"] = now_iso()
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"TRANSITIONED: {args.request_id} -> {args.to}")
    return 0


def command_set_budget(args):
    """Set a manager-approved budget; the fixed tier table is pre-approved policy.

    Custom values and changes to an existing budget require an explicit manager
    identity and approval basis. The command never widens a live task budget
    without that evidence.
    """
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    if task.get("status") in {"completed", "cancelled"}:
        raise RegistryError(f"set-budget is not allowed for terminal status {task.get('status')}")

    budget = task.get("cost_budget")
    if not isinstance(budget, dict):
        raise RegistryError("cost_budget must be an object")
    tier = getattr(args, "tier", None)
    max_rounds = getattr(args, "max_rounds", None)
    timeout_minutes = getattr(args, "timeout_minutes", None)
    approved_by = getattr(args, "approved_by", None)
    approval_basis = getattr(args, "approval_basis", None)

    if tier is not None:
        if max_rounds is not None or timeout_minutes is not None:
            raise RegistryError("tier and explicit budget numbers are mutually exclusive")
        if tier not in BUDGET_TIERS:
            raise RegistryError(f"unknown budget tier: {tier}")
        max_rounds, timeout_minutes = BUDGET_TIERS[tier]
    else:
        if max_rounds is None or timeout_minutes is None:
            raise RegistryError("provide --tier or both --max-rounds and --timeout-minutes")
        for key, value in (("max_rounds", max_rounds), ("timeout_minutes", timeout_minutes)):
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise RegistryError(f"{key} must be a positive integer")

    old_rounds = budget.get("max_rounds")
    old_minutes = budget.get("timeout_minutes")
    changed = (max_rounds, timeout_minutes) != (old_rounds, old_minutes)
    initial_created_tier = tier is not None and old_rounds is None and old_minutes is None and task.get("status") == "created"
    requires_approval = not initial_created_tier and (tier is None or changed or task.get("status") != "created")
    if bool(approved_by) != bool(approval_basis):
        raise RegistryError("--approved-by and --approval-basis must be supplied together")
    if requires_approval and (not isinstance(approved_by, str) or approved_by.strip() not in {"total-manager", "总管"} or
                              not isinstance(approval_basis, str) or not approval_basis.strip()):
        raise RegistryError("custom values or budget changes require --approved-by total-manager/总管 and --approval-basis")

    budget["max_rounds"] = max_rounds
    budget["timeout_minutes"] = timeout_minutes
    decisions = budget.setdefault("budget_decisions", [])
    if not isinstance(decisions, list):
        raise RegistryError("cost_budget.budget_decisions must be an array")
    decisions.append({
        "recorded_at": now_iso(),
        "tier": tier or "custom",
        "max_rounds": max_rounds,
        "timeout_minutes": timeout_minutes,
        "approved_by": approved_by.strip() if isinstance(approved_by, str) and approved_by.strip() else "policy:budget-rules.md",
        "approval_basis": approval_basis.strip() if isinstance(approval_basis, str) and approval_basis.strip() else "fixed tier values pre-approved by total manager",
    })
    task["last_updated"] = now_iso()

    errors = validate_task(task)
    if errors:
        raise RegistryError("; ".join(errors))
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"BUDGET_SET: {task['request_id']} max_rounds={max_rounds} timeout_minutes={timeout_minutes} tier={tier or 'custom'}")
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

    def set_budget_fixture(task, tasks=None, **kwargs):
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": tasks or [task],
            })
            args = argparse.Namespace(
                registry=str(registry_path), request_id=task["request_id"],
                tier=kwargs.get("tier"), max_rounds=kwargs.get("max_rounds"),
                timeout_minutes=kwargs.get("timeout_minutes"),
                approved_by=kwargs.get("approved_by"), approval_basis=kwargs.get("approval_basis"),
            )
            before = registry_path.read_bytes()
            try:
                command_set_budget(args)
            except RegistryError:
                return False, load_registry(registry_path)["tasks"], before == registry_path.read_bytes()
            return True, load_registry(registry_path)["tasks"], before == registry_path.read_bytes()

    def set_budget_tier_writes_fixed_values():
        a = sample()
        ok, tasks, _ = set_budget_fixture(a, tier="medium")
        assert ok and tasks[0]["cost_budget"]["max_rounds"] == 30
        assert tasks[0]["cost_budget"]["timeout_minutes"] == 120
        assert tasks[0]["cost_budget"]["budget_decisions"][-1]["tier"] == "medium"

    def set_budget_explicit_values_require_manager_approval():
        a = sample()
        ok, tasks, _ = set_budget_fixture(
            a, max_rounds=7, timeout_minutes=45,
            approved_by="total-manager", approval_basis="explicitly approved for fixture",
        )
        assert ok and tasks[0]["cost_budget"]["max_rounds"] == 7
        assert tasks[0]["cost_budget"]["timeout_minutes"] == 45
        assert tasks[0]["cost_budget"]["budget_decisions"][-1]["approved_by"] == "total-manager"

    def set_budget_rejects_invalid_values():
        for value in (0, -1, True, 1.5):
            a = sample()
            ok, tasks, unchanged = set_budget_fixture(
                a, max_rounds=value, timeout_minutes=45,
                approved_by="total-manager", approval_basis="fixture approval",
            )
            assert not ok and unchanged and tasks[0]["cost_budget"]["max_rounds"] is None

    def set_budget_validation_failure_does_not_save():
        a = sample()
        left, right = sample("A", "active-A", "in_progress"), sample("B", "active-B", "in_progress")
        left["write_files"] = ["shared.py"]
        right["write_files"] = ["shared.py"]
        ok, tasks, unchanged = set_budget_fixture(a, tasks=[a, left, right], tier="small")
        assert not ok and unchanged and tasks[0]["cost_budget"]["max_rounds"] is None

    def set_budget_task_validation_failure_does_not_save():
        a = sample()
        del a["task_name"]
        ok, tasks, unchanged = set_budget_fixture(a, tier="small")
        assert not ok and unchanged and tasks[0]["cost_budget"]["max_rounds"] is None

    def dispatch_without_budget_is_rejected():
        a = sample()
        a["checkpoints"] = {"CP0": {"conversation_url": a["conversation_url"], "branch": a["branch"], "base_sha": a["base_sha"]}}
        try:
            validate_transition(a, "dispatched")
        except RegistryError as exc:
            assert "cost_budget" in str(exc)
            return
        raise AssertionError("created task without budget was dispatched")

    def dispatch_with_budget_is_allowed():
        a = sample()
        a["cost_budget"].update({"max_rounds": 30, "timeout_minutes": 120})
        a["checkpoints"] = {"CP0": {"conversation_url": a["conversation_url"], "branch": a["branch"], "base_sha": a["base_sha"]}}
        validate_transition(a, "dispatched")

    def historical_dispatched_task_without_budget_is_not_retroactively_blocked():
        a = sample(status="dispatched")
        a["approval_status"] = "granted"
        a["checkpoints"] = {"CP0": {"completed": True}, "CP1": {
            "authorization_scope": ["test"], "plan_steps": ["test"], "release_status": "granted",
        }}
        validate_transition(a, "in_progress", release=True)

    def budget_extension_without_manager_approval_is_rejected():
        a = sample()
        a["cost_budget"].update({"max_rounds": 2, "timeout_minutes": 60})
        ok, tasks, unchanged = set_budget_fixture(a, max_rounds=12, timeout_minutes=60)
        assert not ok and unchanged and tasks[0]["cost_budget"]["max_rounds"] == 2

    def dead_letter_generates_report_and_rejects_unauthorized_retry():
        a = sample(status="in_progress")
        a["cost_budget"].update({"max_rounds": 2, "timeout_minutes": 60})
        a["progress"] = "completed first pass"
        a["next_action"] = "blocked on final verification"
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [a],
            })
            args = argparse.Namespace(
                registry=str(registry_path), request_id=a["request_id"], to="dead_letter",
                release_approved=False, resume_approved=False, retry_approved=False,
                changes_requested=False, accepted_by=None, approved_by=None, manager_diagnosis=None,
                dead_letter_evidence=json.dumps({"limit_type": "max_rounds", "actual_value": 3,
                                                 "evidence": "round 3 was blocked before a new work message"}),
            )
            command_transition(args)
            after = load_registry(registry_path)["tasks"][0]
            report = after["dead_letter_report"]
            assert after["status"] == "dead_letter"
            assert report["completed_progress"] == "completed first pass"
            assert report["stuck_reason"] == "blocked on final verification"
            retry_args = argparse.Namespace(**{**vars(args), "to": "in_progress", "dead_letter_evidence": None})
            try:
                command_transition(retry_args)
            except RegistryError:
                assert load_registry(registry_path)["tasks"][0]["status"] == "dead_letter"
                return
            raise AssertionError("dead-letter task was restarted without manager diagnosis")

    def dead_letter_retry_requires_manager_diagnosis_and_budget_increase():
        a = sample(status="in_progress")
        a["cost_budget"].update({"max_rounds": 2, "timeout_minutes": 60})
        with tempfile.TemporaryDirectory() as directory:
            registry_path = Path(directory) / "task-registry.yml"
            save_registry(registry_path, {
                "schema_version": 1, "registry_repository": "owner/repo",
                "parallel_limit": 10, "active_statuses": list(ACTIVE), "tasks": [a],
            })
            dead_args = argparse.Namespace(
                registry=str(registry_path), request_id=a["request_id"], to="dead_letter",
                release_approved=False, resume_approved=False, retry_approved=False,
                changes_requested=False, accepted_by=None, approved_by=None, manager_diagnosis=None,
                dead_letter_evidence=json.dumps({"limit_type": "max_rounds", "actual_value": 3,
                                                 "evidence": "blocked round 3"}),
            )
            command_transition(dead_args)
            set_args = argparse.Namespace(
                registry=str(registry_path), request_id=a["request_id"], tier=None,
                max_rounds=12, timeout_minutes=60, approved_by="total-manager",
                approval_basis="manager diagnosis: root cause isolated; authorize +10 rounds",
            )
            command_set_budget(set_args)
            retry_args = argparse.Namespace(
                registry=str(registry_path), request_id=a["request_id"], to="in_progress",
                release_approved=False, resume_approved=False, retry_approved=True,
                changes_requested=False, accepted_by=None, approved_by="total-manager",
                manager_diagnosis="Root cause isolated; approve a bounded continuation of +10 rounds.",
                dead_letter_evidence=None,
            )
            command_transition(retry_args)
            after = load_registry(registry_path)["tasks"][0]
            assert after["status"] == "in_progress"
            assert after["cost_budget"]["max_rounds"] == 12
            assert after["dead_letter_history"][-1]["approved_by"] == "total-manager"

    tests = _ACCEPT_GATEFIX_TESTS + [
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
        ("set-budget tier writes fixed values", set_budget_tier_writes_fixed_values),
        ("set-budget explicit values require manager approval", set_budget_explicit_values_require_manager_approval),
        ("set-budget rejects invalid values", set_budget_rejects_invalid_values),
        ("set-budget validation failure does not save", set_budget_validation_failure_does_not_save),
        ("set-budget task validation failure does not save", set_budget_task_validation_failure_does_not_save),
        ("dispatch without budget is rejected", dispatch_without_budget_is_rejected),
        ("dispatch with budget is allowed", dispatch_with_budget_is_allowed),
        ("historical dispatched task without budget is not retroactively blocked", historical_dispatched_task_without_budget_is_not_retroactively_blocked),
        ("budget extension without manager approval is rejected", budget_extension_without_manager_approval_is_rejected),
        ("dead-letter generates report and rejects unauthorized retry", dead_letter_generates_report_and_rejects_unauthorized_retry),
        ("dead-letter retry requires manager diagnosis and budget increase", dead_letter_retry_requires_manager_diagnosis_and_budget_increase),
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
    p.add_argument("--approved-by")
    p.add_argument("--manager-diagnosis")
    p.add_argument("--dead-letter-evidence")
    p.set_defaults(func=command_transition)

    p = sub.add_parser("set-budget", help="set a manager-approved task budget")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--tier", choices=sorted(BUDGET_TIERS))
    p.add_argument("--max-rounds", type=int)
    p.add_argument("--timeout-minutes", type=int)
    p.add_argument("--approved-by")
    p.add_argument("--approval-basis")
    p.set_defaults(func=command_set_budget)

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
    p.set_defaults(func=command_simulate); _add_accept_parser(sub)  # accept: manager-only acceptance recording
    return parser


def main():
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (RegistryError, json.JSONDecodeError) as exc:
        print(f"REJECTED: {exc}", file=sys.stderr)
        return 2


# Entry point moved to the end of this file (see below).
# The live entry point is at the end of this file.


# --- Registry gatefix (request-id agent-7x24-registry-gatefix-20261116-01) ---
# Manager-only acceptance recording (accept) and its self-tests. These
# definitions live after main() so that the entry point at the end of this
# file runs last; they are resolved at call time, like the other commands.


def _acceptance_basis(task):
    """Return the recorded acceptance basis, or "" when none is recorded."""
    basis = task.get("acceptance_basis")
    return basis.strip() if isinstance(basis, str) else ""


def command_accept(args):
    """Record a manager acceptance decision (manager only).

    Workers must never call this command: acceptance values come only from
    the manager's decision. The command only records the decision; it does
    not change the task status. A later ``transition --to completed`` still
    requires --accepted-by to match the recorded accepted_by.
    """
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    if task.get("status") not in ("awaiting_review", "completed"):
        raise RegistryError(
            f"accept requires awaiting_review or completed status, got {task.get('status')}"
        )
    basis = args.acceptance_basis
    if not isinstance(basis, str) or not basis.strip():
        raise RegistryError("acceptance_basis must be a non-empty text stating evidence")
    if not isinstance(args.accepted_by, str) or not args.accepted_by.strip():
        raise RegistryError("accepted_by must be a non-empty value")
    head_sha = getattr(args, "head_sha", None)
    if head_sha is not None and not re.fullmatch(r"[0-9a-f]{40}", head_sha):
        raise RegistryError("head_sha must be 40 hex characters")
    verified_at = getattr(args, "head_sha_verified_at", None)
    if verified_at is not None:
        try:
            datetime.fromisoformat(verified_at)
        except ValueError as exc:
            raise RegistryError("head_sha_verified_at must be an ISO timestamp") from exc
    task["acceptance_status"] = "accepted"
    task["accepted_by"] = args.accepted_by
    task["acceptance_basis"] = basis.strip()
    if head_sha is not None:
        task["head_sha"] = head_sha
    if verified_at is not None:
        task["head_sha_verified_at"] = verified_at
    task["last_updated"] = now_iso()
    errors = validate_task(task)
    if errors:
        raise RegistryError("; ".join(errors))
    errors = capacity_errors(data["tasks"], data["parallel_limit"]) + conflict_errors(data["tasks"])
    if errors:
        raise RegistryError("; ".join(errors))
    save_registry(path, data)
    print(f"ACCEPTED: {task['request_id']} accepted_by={args.accepted_by}")
    return 0


def _add_accept_parser(sub):
    """Add the manager-only accept subcommand to the CLI parser."""
    p = sub.add_parser("accept", help="record a manager acceptance decision (manager only)")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--accepted-by", required=True)
    p.add_argument("--acceptance-basis", required=True)
    p.add_argument("--head-sha")
    p.add_argument("--head-sha-verified-at")
    p.set_defaults(func=command_accept)


def _gatefix_sample(key="T1", rid="req-1", status="created"):
    """A minimal valid task, mirroring the sample in command_self_test."""
    return {
        "task_key": key,
        "request_id": rid,
        "task_name": "sample",
        "conversation_url": "https://chatgpt.com/c/example",
        "workspace": "test",
        "model": "GPT-6",
        "mode": "Chat",
        "repository": "owner/repo",
        "branch": f"branch-{key}",
        "base_sha": "1" * 40,
        "head_sha": "1" * 40,
        "status": status,
        "progress": "test",
        "next_action": "continue",
        "deadline": None,
        "risk_level": "medium",
        "approval_required": True,
        "last_updated": "2026-11-16",
        "head_sha_verified_at": None,
        "cost_budget": {"max_rounds": None, "timeout_minutes": None, "cost_record": []},
        "conflict_group": None,
        "shared_files": [],
        "write_files": [],
        "depends_on": [],
        "blocked_by": [],
        "checkpoints": {},
    }


def _gatefix_registry(path, tasks):
    save_registry(path, {
        "schema_version": 1,
        "registry_repository": "owner/repo",
        "parallel_limit": 10,
        "active_statuses": list(ACTIVE),
        "tasks": tasks,
    })


def _gatefix_completion_ready(ci_status="success", basis=None, legacy_import=False, status="awaiting_review"):
    task = _gatefix_sample(status=status)
    task["legacy_import"] = legacy_import
    task["checkpoints"] = {
        "CP0": {"completed": True},
        "CP1": {"completed": True},
        "CP2": {"completed": True, "tests_passed": True, "test_results": []},
        "CP3": {"completed": True, "ci_status": ci_status, "pull_request_url": "https://github.com/o/r/pull/1", "pending_todos": []},
    }
    task["pull_request_url"] = "https://github.com/o/r/pull/1"
    task["acceptance_status"] = "accepted"
    task["accepted_by"] = "total-manager"
    task["acceptance_basis"] = basis
    return task


def accept_records_acceptance_and_head():
    task = _gatefix_completion_ready(ci_status="success")
    task["acceptance_status"] = "pending"
    task["accepted_by"] = None
    task["acceptance_basis"] = None
    with tempfile.TemporaryDirectory() as directory:
        registry_path = Path(directory) / "task-registry.yml"
        _gatefix_registry(registry_path, [task])
        command = [
            sys.executable, __file__, "accept", "--registry", str(registry_path),
            "--request-id", task["request_id"], "--accepted-by", "total-manager",
            "--acceptance-basis", "Baseline comparison: PR #1 CI failures pre-existing on main, no new failures; evidence: baseline CI run.",
            "--head-sha", "c" * 40, "--head-sha-verified-at", "2026-11-16T06:00:00+00:00",
        ]
        result = subprocess.run(command, text=True, capture_output=True, check=False)
        assert result.returncode == 0, (result.returncode, result.stdout, result.stderr)
        assert "ACCEPTED:" in result.stdout, result.stdout
        after = load_registry(registry_path)["tasks"][0]
        assert after["status"] == "awaiting_review"
        assert after["acceptance_status"] == "accepted"
        assert after["accepted_by"] == "total-manager"
        assert "Baseline comparison" in after["acceptance_basis"]
        assert after["head_sha"] == "c" * 40
        assert after["head_sha_verified_at"] == "2026-11-16T06:00:00+00:00"


def accept_empty_basis_rejected():
    task = _gatefix_completion_ready(ci_status="success")
    task["acceptance_status"] = "pending"
    task["accepted_by"] = None
    task["acceptance_basis"] = None
    with tempfile.TemporaryDirectory() as directory:
        registry_path = Path(directory) / "task-registry.yml"
        _gatefix_registry(registry_path, [task])
        args = argparse.Namespace(
            registry=str(registry_path), request_id=task["request_id"],
            accepted_by="total-manager", acceptance_basis="   ",
            head_sha=None, head_sha_verified_at=None,
        )
        try:
            command_accept(args)
        except RegistryError:
            after = load_registry(registry_path)["tasks"][0]
            assert after["acceptance_status"] == "pending"
            assert after.get("accepted_by") is None
            return
        raise AssertionError("accept allowed an empty acceptance_basis")


def ci_failure_with_basis_can_complete():
    task = _gatefix_completion_ready(
        ci_status="failure",
        basis="Baseline comparison: PR #1 CI failures pre-existing on main, no new failures; evidence: baseline CI run.",
    )
    validate_transition(task, "completed", accepted_by="total-manager")


def ci_failure_without_basis_cannot_complete():
    task = _gatefix_completion_ready(ci_status="failure", basis=None)
    try:
        validate_transition(task, "completed", accepted_by="total-manager")
    except RegistryError:
        return
    raise AssertionError("CI failure without acceptance_basis was allowed to complete")


def completion_accepted_by_mismatch_with_basis():
    task = _gatefix_completion_ready(
        ci_status="failure",
        basis="Baseline comparison: PR #1 CI failures pre-existing on main, no new failures; evidence: baseline CI run.",
    )
    try:
        validate_transition(task, "completed", accepted_by="someone-else")
    except RegistryError:
        return
    raise AssertionError("completion allowed a mismatched --accepted-by")


def legacy_only_cp0_with_basis_can_complete():
    task = _gatefix_sample(status="awaiting_review")
    task["legacy_import"] = True
    task["checkpoints"] = {"CP0": {"completed": True}}
    task["acceptance_status"] = "accepted"
    task["accepted_by"] = "total-manager"
    task["acceptance_basis"] = "Legacy import: historical checkpoints were not provided; acceptance based on manager review of the merged PR."
    task["pull_request_url"] = "https://github.com/o/r/pull/1"
    validate_transition(task, "completed", accepted_by="total-manager")


def accept_created_task_rejected():
    task = _gatefix_sample(status="created")
    with tempfile.TemporaryDirectory() as directory:
        registry_path = Path(directory) / "task-registry.yml"
        _gatefix_registry(registry_path, [task])
        args = argparse.Namespace(
            registry=str(registry_path), request_id=task["request_id"],
            accepted_by="total-manager",
            acceptance_basis="Baseline comparison: evidence.",
            head_sha="d" * 40, head_sha_verified_at="2026-11-16T06:00:00+00:00",
        )
        try:
            command_accept(args)
        except RegistryError:
            after = load_registry(registry_path)["tasks"][0]
            assert after["status"] == "created"
            assert "acceptance_status" not in after
            return
        raise AssertionError("accept allowed a created task")


_ACCEPT_GATEFIX_TESTS = [
    ("accept records acceptance and head", accept_records_acceptance_and_head),
    ("accept rejects empty acceptance basis", accept_empty_basis_rejected),
    ("CI failure with recorded basis can complete", ci_failure_with_basis_can_complete),
    ("CI failure without basis cannot complete", ci_failure_without_basis_cannot_complete),
    ("completion with basis rejects mismatched --accepted-by", completion_accepted_by_mismatch_with_basis),
    ("legacy task with only CP0 and basis can complete", legacy_only_cp0_with_basis_can_complete),
    ("accept on created task is rejected", accept_created_task_rejected),
]


if __name__ == "__main__":
    raise SystemExit(main())
