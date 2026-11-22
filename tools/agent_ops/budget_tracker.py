#!/usr/bin/env python3
"""Record and report task cost baselines from the Agent Ops registry.

The registry remains the single ledger. Inputs to `record` must be measured
from the actual task conversation and the existing P5 Routine cost audit log.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REGISTRY_REL = "docs/agent-ops/task-registry.yml"
TIERS = {
    "small": (15, 60),
    "medium": (30, 120),
    "large": (50, 240),
}
TIER_ORDER = ("small", "medium", "large", "custom", "unclassified")


class RegistryError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_registry(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RegistryError(f"registry not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RegistryError(f"invalid JSON-compatible YAML at {exc.lineno}:{exc.colno}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
        raise RegistryError("registry root must contain a tasks array")
    return data


def save_registry(path: Path, data: dict) -> None:
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


def find_task(data: dict, request_id: str) -> dict:
    matches = [task for task in data["tasks"] if task.get("request_id") == request_id]
    if len(matches) != 1:
        raise RegistryError(f"request-id must match exactly one task; found {len(matches)}")
    return matches[0]


def infer_tier(task: dict) -> str:
    budget = task.get("cost_budget", {})
    if not isinstance(budget, dict):
        return "unclassified"
    pair = (budget.get("max_rounds"), budget.get("timeout_minutes"))
    for tier, values in TIERS.items():
        if pair == values:
            return tier
    if pair == (None, None):
        return "unclassified"
    return "custom"


def _nonnegative_number(value, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise RegistryError(f"{name} must be a finite non-negative number")


def guard_budget(task: dict, current_rounds: int, elapsed_minutes: float) -> tuple[bool, list[str]]:
    budget = task.get("cost_budget", {})
    if not isinstance(budget, dict):
        return False, ["cost_budget is missing or invalid; fail closed"]
    max_rounds = budget.get("max_rounds")
    timeout_minutes = budget.get("timeout_minutes")
    if (isinstance(max_rounds, bool) or not isinstance(max_rounds, int) or max_rounds <= 0 or
            isinstance(timeout_minutes, bool) or not isinstance(timeout_minutes, int) or timeout_minutes <= 0):
        return False, ["missing or invalid max_rounds/timeout_minutes; fail closed"]
    reasons = []
    if current_rounds >= max_rounds:
        reasons.append(f"round limit reached ({current_rounds}/{max_rounds}); do not start another round")
    if elapsed_minutes >= timeout_minutes:
        reasons.append(f"timeout reached ({elapsed_minutes:.2f}/{timeout_minutes} minutes); stop now")
    return not reasons, reasons


def command_guard(args) -> int:
    data = load_registry(Path(args.registry))
    task = find_task(data, args.request_id)
    if isinstance(args.current_rounds, bool) or args.current_rounds < 0:
        raise RegistryError("current_rounds must be a non-negative integer")
    _nonnegative_number(args.elapsed_minutes, "elapsed_minutes")
    allowed, reasons = guard_budget(task, args.current_rounds, args.elapsed_minutes)
    if not allowed:
        print(f"STOP: {args.request_id}")
        for reason in reasons:
            print(f"REASON: {reason}")
        print("NEXT: do not send another work message or submit code; record evidence and request manager diagnosis")
        return 2
    print(f"CONTINUE: {args.request_id} rounds={args.current_rounds}/{task['cost_budget']['max_rounds']} elapsed_minutes={args.elapsed_minutes:.2f}/{task['cost_budget']['timeout_minutes']}")
    return 0


def command_record(args) -> int:
    path = Path(args.registry)
    data = load_registry(path)
    task = find_task(data, args.request_id)
    for name, value in (("actual_rounds", args.actual_rounds), ("merged_pr_count", args.merged_prs), ("retry_count", args.retries)):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise RegistryError(f"{name} must be a non-negative integer")
    _nonnegative_number(args.actual_minutes, "actual_minutes")
    budget = task.get("cost_budget")
    if not isinstance(budget, dict):
        raise RegistryError("cost_budget must be an object")
    records = budget.setdefault("cost_record", [])
    if not isinstance(records, list):
        raise RegistryError("cost_budget.cost_record must be an array")

    overrun_reasons = []
    if budget.get("max_rounds") is not None and args.actual_rounds > budget["max_rounds"]:
        overrun_reasons.append(f"rounds {args.actual_rounds}>{budget['max_rounds']}")
    if budget.get("timeout_minutes") is not None and args.actual_minutes > budget["timeout_minutes"]:
        overrun_reasons.append(f"minutes {args.actual_minutes}>{budget['timeout_minutes']}")
    exceeded = bool(args.exceeded or overrun_reasons)
    reason = args.exceeded_reason.strip() if isinstance(args.exceeded_reason, str) else ""
    if exceeded and not reason:
        reason = "; ".join(overrun_reasons) or "manager-classified overrun; details supplied by source ledger"
    if not exceeded and reason:
        raise RegistryError("--exceeded-reason requires --exceeded or a measured overrun")

    record = {
        "recorded_at": now_iso(),
        "source": args.source,
        "tier": infer_tier(task),
        "actual_rounds": args.actual_rounds,
        "actual_minutes": round(float(args.actual_minutes), 4),
        "merged_pr_count": args.merged_prs,
        "retry_count": args.retries,
        "exceeded": exceeded,
        "exceeded_reason": reason or None,
    }
    records.append(record)
    save_registry(path, data)
    print(f"COST_RECORDED: {args.request_id} tier={record['tier']} rounds={record['actual_rounds']} minutes={record['actual_minutes']:.2f} merged_prs={record['merged_pr_count']} retries={record['retry_count']} exceeded={str(record['exceeded']).lower()}")
    return 0


def command_report(args) -> int:
    data = load_registry(Path(args.registry))
    groups = {tier: [] for tier in TIER_ORDER}
    for task in data["tasks"]:
        budget = task.get("cost_budget", {})
        records = budget.get("cost_record", []) if isinstance(budget, dict) else []
        if not isinstance(records, list):
            raise RegistryError(f"{task.get('request_id')}: cost_record must be an array")
        for record in records:
            if not isinstance(record, dict):
                raise RegistryError(f"{task.get('request_id')}: cost_record entries must be objects")
            tier = record.get("tier") or infer_tier(task)
            if tier not in groups:
                tier = "custom"
            groups[tier].append(record)

    total = []
    print("COST REPORT (source: task-registry.yml cost_budget.cost_record)")
    print("tier | records | avg_rounds | avg_minutes | merged_prs | retries | exceeded")
    for tier in TIER_ORDER:
        records = groups[tier]
        if not records:
            continue
        total.extend(records)
        count = len(records)
        avg_rounds = sum(float(item.get("actual_rounds", 0)) for item in records) / count
        avg_minutes = sum(float(item.get("actual_minutes", 0)) for item in records) / count
        prs = sum(int(item.get("merged_pr_count", 0)) for item in records)
        retries = sum(int(item.get("retry_count", 0)) for item in records)
        exceeded = sum(bool(item.get("exceeded")) for item in records)
        print(f"{tier} | {count} | {avg_rounds:.2f} | {avg_minutes:.2f} | {prs} | {retries} | {exceeded}")
    if not total:
        print("NO_COST_RECORDS")
        return 0
    count = len(total)
    avg_rounds = sum(float(item.get("actual_rounds", 0)) for item in total) / count
    avg_minutes = sum(float(item.get("actual_minutes", 0)) for item in total) / count
    prs = sum(int(item.get("merged_pr_count", 0)) for item in total)
    retries = sum(int(item.get("retry_count", 0)) for item in total)
    exceeded = sum(bool(item.get("exceeded")) for item in total)
    print(f"TOTAL | {count} | {avg_rounds:.2f} | {avg_minutes:.2f} | {prs} | {retries} | {exceeded}")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="Record and report Agent Ops task costs.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("guard", help="fail closed before starting another work round")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--current-rounds", type=int, required=True)
    p.add_argument("--elapsed-minutes", type=float, required=True)
    p.set_defaults(func=command_guard)

    p = sub.add_parser("record", help="append measured task cost to the registry")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.add_argument("--request-id", required=True)
    p.add_argument("--actual-rounds", type=int, required=True)
    p.add_argument("--actual-minutes", type=float, required=True)
    p.add_argument("--merged-prs", type=int, required=True)
    p.add_argument("--retries", type=int, required=True)
    p.add_argument("--exceeded", action="store_true")
    p.add_argument("--exceeded-reason")
    p.add_argument("--source", required=True, help="Source/provenance label for this cost record")
    p.set_defaults(func=command_record)

    p = sub.add_parser("report", help="summarize recorded task costs by tier")
    p.add_argument("--registry", default=REGISTRY_REL)
    p.set_defaults(func=command_report)
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
