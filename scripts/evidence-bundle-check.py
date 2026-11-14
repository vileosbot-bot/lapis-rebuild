#!/usr/bin/env python3
"""Lapis 验收证据整理脚本（P3 试点初稿）。

只做“整理与核对证据”，不跑测试，也不代替总管独立读回。
字段全部取自 docs/verification/evidence-bundle.schema.md 与
skills/lapis-verification/SKILL.md，不自造字段。

输入产物目录（--artifacts）约定：
  manifest.json       证据束草稿（JSON，字段名与 schema 的 YAML 字段相同）
  playwright.json     Playwright JSON reporter 产物
  checkpoints.json    {"checkpoints": [{"feature_id", "checkpoint",
                       "screenshot", "image_kind"}]}
  screenshots/<文件>  manifest.screenshots.items[*].filename 对应的真实文件
  logs_and_artifacts 中以 .json/.log/.zip 结尾的路径同样按相对路径核对存在性

输出（--out）：evidence-bundle.json 与 evidence-bundle.md。
退出码：0=全部核对通过；1=存在证据缺失或不一致（逐项列出，绝不静默跳过）；
2=命令行用法错误。缺失证据只报错、不补全、不推断通过。

用法：
  python3 scripts/evidence-bundle-check.py --artifacts <产物目录> --out <输出目录>
  python3 scripts/evidence-bundle-check.py --artifacts <产物目录> --out <输出目录> \
      --branch feat/p3-evidence-script-20261114 --commit-sha <完整 40 位 SHA>

Python 3.12，仅标准库。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

SCHEMA_VERSION = 1
REQUEST_ID = "lauren-p3-evidence-20261114-01"
BASE_SHA = "bec5b2d6daa608a68a5949fec7f2cab5c0218c62"  # 本分支基底：main 最新 HEAD

REQUIRED_TOP_FIELDS = [
    "schema_version", "bundle_id", "request_id", "repository", "revision",
    "scope", "changed_files", "environment", "command_execution",
    "static_verification", "runtime_acceptance", "test_summary",
    "screenshots", "logs_and_artifacts", "provenance", "known_gaps",
    "worker_verdict", "manager_review",
]
IMAGE_KINDS = {"real_browser", "synthetic_harness", "NOT_APPLICABLE"}
COMMAND_RESULTS = {"PASS", "FAIL", "SKIP", "NOT_RUN", "NOT_RECORDED", "BLOCKED"}
COMMAND_STATUSES = {"RECORDED", "NOT_RECORDED", "NOT_RUN", "BLOCKED"}
GAP_STATUSES = {"BLOCKED", "NOT_RUN", "NOT_RECORDED", "OPEN"}
EVIDENCE_LEVELS = {
    "VERIFIED", "INFERRED", "RECOVERED_SECONDARY",
    "RECONSTRUCTION_POLICY", "UNVERIFIED", "NOT_APPLICABLE",
}
CHANGE_STATUSES = {"added", "modified", "deleted", "renamed"}
_HEX = set("0123456789abcdef")


def is_sha(value, length):
    return (
        isinstance(value, str)
        and len(value) == length
        and all(ch in _HEX for ch in value.lower())
    )


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path, label, errors):
    if not path.is_file():
        errors.append(f"缺失文件：{label}（{path.name}）不存在")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        errors.append(f"无法读取 {label}（{path.name}）：{exc}")
        return None


def collect_playwright_tests(data):
    """遍历 Playwright JSON reporter，返回每条测试的最后一次结果状态。"""
    tests = []

    def visit(node):
        if isinstance(node, dict):
            results = node.get("results")
            if isinstance(results, list) and results:
                last = results[-1]
                status = last.get("status") if isinstance(last, dict) else None
                tests.append({
                    "title": node.get("title", ""),
                    "status": status,
                    "error": (last.get("error") or {}).get("message", "")
                    if isinstance(last, dict) else "",
                })
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(data)
    return tests


def check_bundle(artifacts, expected_branch=None, expected_commit=None,
                 expected_base=None):
    errors = []
    checks = []

    def record(check_id, name, ok, detail=""):
        checks.append({"id": check_id, "name": name,
                       "result": "PASS" if ok else "FAIL", "detail": detail})
        if not ok:
            errors.append(f"{check_id} {name}：{detail}" if detail else f"{check_id} {name}")
        return ok

    manifest_path = artifacts / "manifest.json"
    manifest = load_json(manifest_path, "证据束 manifest", errors)
    if manifest is None:
        record("manifest", "manifest.json 可读", False, "manifest.json 缺失或无法解析")
        return {"errors": errors, "checks": checks, "manifest": None,
                "playwright": None, "screenshots": [], "verdict": "FAIL"}
    if not isinstance(manifest, dict):
        record("manifest", "manifest.json 为对象", False, "顶层不是 JSON 对象")
        return {"errors": errors, "checks": checks, "manifest": None,
                "playwright": None, "screenshots": [], "verdict": "FAIL"}

    # 1. 顶层字段：缺失逐项报错。
    for field in REQUIRED_TOP_FIELDS:
        record(f"top.{field}", f"顶层字段 {field} 存在", field in manifest,
               f"缺失顶层字段 {field}" if field not in manifest else "")
    record("schema_version", "schema_version 为 1",
           manifest.get("schema_version") == SCHEMA_VERSION,
           f"实际值：{manifest.get('schema_version')!r}")
    record("request_id", "request_id 与任务一致",
           manifest.get("request_id") == REQUEST_ID,
           f"实际值：{manifest.get('request_id')!r}，期望：{REQUEST_ID}")

    # 2. 提交 SHA 与分支是否一致。
    revision = manifest.get("revision") or {}
    if not isinstance(revision, dict):
        record("revision", "revision 为对象", False, "revision 不是对象")
        revision = {}
    record("revision.branch", "revision.branch 为非空字符串",
           bool(revision.get("branch")), f"实际值：{revision.get('branch')!r}")
    if expected_branch is not None:
        record("revision.branch.expected", "分支与期望一致",
               revision.get("branch") == expected_branch,
               f"实际：{revision.get('branch')!r}，期望：{expected_branch!r}")
    for key in ("base_commit_sha", "commit_sha"):
        record(f"revision.{key}", f"{key} 为完整 40 位 SHA",
               is_sha(revision.get(key), 40), f"实际值：{revision.get(key)!r}")
    tested = revision.get("tested_commit_sha")
    record("revision.tested_commit_sha", "tested_commit_sha 为完整 SHA 或 NOT_RUN",
           tested == "NOT_RUN" or is_sha(tested, 40), f"实际值：{tested!r}")
    if expected_commit is not None:
        record("revision.commit.expected", "提交 SHA 与期望一致",
               revision.get("commit_sha") == expected_commit,
               f"实际：{revision.get('commit_sha')!r}，期望：{expected_commit!r}")
    if expected_base is not None:
        record("revision.base.expected", "基底 SHA 与期望一致",
               revision.get("base_commit_sha") == expected_base,
               f"实际：{revision.get('base_commit_sha')!r}，期望：{expected_base!r}")
    if is_sha(revision.get("base_commit_sha"), 40) and is_sha(revision.get("commit_sha"), 40):
        record("revision.base_ne_commit", "基底 SHA 与提交 SHA 不同",
               revision.get("base_commit_sha") != revision.get("commit_sha"),
               "基底 SHA 与提交 SHA 相同，无法区分基底与被测提交")

    # 3. Feature ID 与变更文件。
    scope = manifest.get("scope") or {}
    feature_ids = scope.get("feature_ids") if isinstance(scope, dict) else None
    record("scope.feature_ids", "scope.feature_ids 为非空列表",
           isinstance(feature_ids, list) and len(feature_ids) > 0,
           f"实际值：{feature_ids!r}")
    changed = manifest.get("changed_files")
    if isinstance(changed, list):
        for item in changed:
            path = item.get("path") if isinstance(item, dict) else None
            ok = (
                isinstance(item, dict)
                and bool(path)
                and item.get("change_status") in CHANGE_STATUSES
                and isinstance(item.get("line_count"), int)
                and is_sha(item.get("git_blob_sha"), 40)
            )
            record(f"changed_files.{path}", f"变更文件 {path} 有状态/行数/blob SHA",
                   ok, f"实际：{item!r}")
    else:
        record("changed_files", "changed_files 为列表", False, f"实际值：{changed!r}")
    record("environment", "environment 为非空对象（实际运行环境）",
           isinstance(manifest.get("environment"), dict) and bool(manifest.get("environment")),
           "environment 缺失或为空，未记录实际运行环境")

    # 4. 每条命令：完整文本/工作目录/退出码/结果/被测 SHA。
    execution = manifest.get("command_execution") or {}
    if isinstance(execution, dict):
        record("command_execution.status", "command_execution.status 取值合法",
               execution.get("status") in COMMAND_STATUSES,
               f"实际值：{execution.get('status')!r}")
        commands = execution.get("commands")
        if isinstance(commands, list):
            record("command_execution.commands", "命令清单非空（已记录时）",
                   not (execution.get("status") == "RECORDED" and not commands),
                   "status 为 RECORDED 但 commands 为空")
            for command in commands:
                name = command.get("command", "") if isinstance(command, dict) else ""
                ok = (
                    isinstance(command, dict)
                    and bool(command.get("command"))
                    and bool(command.get("working_directory"))
                    and isinstance(command.get("exit_code"), int)
                    and command.get("result") in COMMAND_RESULTS
                    and (command.get("tested_commit_sha") == "NOT_RUN"
                         or is_sha(command.get("tested_commit_sha"), 40))
                )
                record(f"command.{name[:40]}", f"命令可核对：{name[:40]}", ok,
                       f"实际：{command!r}")
        else:
            record("command_execution.commands", "commands 为列表", False,
                   f"实际值：{commands!r}")

    # 5. 测试用例数与断言数分开记录，且各自算术自洽。
    summary = manifest.get("test_summary") or {}
    test_cases = summary.get("test_cases") if isinstance(summary, dict) else None
    assertions = summary.get("assertions") if isinstance(summary, dict) else None
    record("test_summary.test_cases", "test_cases 分开记录",
           isinstance(test_cases, dict) and all(
               isinstance(test_cases.get(k), int)
               for k in ("total", "passed", "failed", "skipped", "not_run")),
           f"实际值：{test_cases!r}")
    record("test_summary.assertions", "assertions 分开记录（不与 test_cases 混用）",
           isinstance(assertions, dict) and all(
               isinstance(assertions.get(k), int)
               for k in ("total", "executed", "passed", "failed", "blocked", "not_run")),
           f"实际值：{assertions!r}")
    if isinstance(test_cases, dict) and all(isinstance(test_cases.get(k), int)
                                            for k in ("total", "passed", "failed", "skipped", "not_run")):
        record("test_summary.test_cases.sum", "test_cases 总数等于各分项之和",
               test_cases["total"] == test_cases["passed"] + test_cases["failed"]
               + test_cases["skipped"] + test_cases["not_run"],
               f"实际：{test_cases!r}")
    if isinstance(assertions, dict) and all(isinstance(assertions.get(k), int)
                                            for k in ("total", "executed", "passed", "failed", "blocked", "not_run")):
        record("test_summary.assertions.sum", "assertions executed 等于 passed+failed+blocked+not_run",
               assertions["executed"] == assertions["passed"] + assertions["failed"]
               + assertions["blocked"] + assertions["not_run"],
               f"实际：{assertions!r}")

    # 6. Playwright JSON：存在、可读、计数与 test_summary 一致。
    playwright_path = artifacts / "playwright.json"
    playwright = load_json(playwright_path, "Playwright JSON", errors)
    playwright_counts = {"total": 0, "passed": 0, "failed": 0, "skipped": 0, "not_run": 0}
    playwright_failures = []
    if playwright is not None:
        record("playwright.readable", "playwright.json 可读", True)
        for test in collect_playwright_tests(playwright):
            playwright_counts["total"] += 1
            status = test["status"]
            if status in ("passed", "expected"):
                playwright_counts["passed"] += 1
            elif status in ("failed", "timedOut"):
                playwright_counts["failed"] += 1
                playwright_failures.append(test)
            elif status == "skipped":
                playwright_counts["skipped"] += 1
            else:
                playwright_counts["not_run"] += 1
        if isinstance(test_cases, dict):
            for key in ("total", "passed", "failed", "skipped"):
                record(f"playwright.count.{key}", f"Playwright {key} 与 test_summary 一致",
                       playwright_counts[key] == test_cases.get(key),
                       f"Playwright：{playwright_counts[key]}，test_summary：{test_cases.get(key)}")
    else:
        record("playwright.readable", "playwright.json 可读", False, "playwright.json 缺失或无法解析")

    # 7. checkpoints.json 与截图清单互相核对。
    checkpoints_data = load_json(artifacts / "checkpoints.json", "checkpoint JSON", errors)
    checkpoints = []
    if isinstance(checkpoints_data, dict):
        checkpoints = checkpoints_data.get("checkpoints") or []
        record("checkpoints.list", "checkpoints 为列表", isinstance(checkpoints, list),
               f"实际值：{checkpoints!r}")
    elif checkpoints_data is not None:
        record("checkpoints.list", "checkpoints.json 顶层为对象", False,
               f"实际值：{checkpoints_data!r}")
    else:
        record("checkpoints.list", "checkpoints.json 可读", False, "checkpoints.json 缺失或无法解析")

    # 8. 截图：存在、SHA-256 可复算、真实/synthetic 分开标注。
    screenshots = manifest.get("screenshots") or {}
    items = screenshots.get("items") if isinstance(screenshots, dict) else None
    computed_screenshots = []
    if not isinstance(items, list):
        record("screenshots.items", "screenshots.items 为列表", False, f"实际值：{items!r}")
        items = []
    checkpoint_by_file = {}
    if isinstance(checkpoints, list):
        for point in checkpoints:
            if isinstance(point, dict) and point.get("screenshot"):
                checkpoint_by_file[point["screenshot"]] = point
    for item in items:
        filename = item.get("filename") if isinstance(item, dict) else None
        entry = {"filename": filename, "feature_id": item.get("feature_id") if isinstance(item, dict) else None,
                 "capture_point": item.get("capture_point") if isinstance(item, dict) else None,
                 "image_kind": item.get("image_kind") if isinstance(item, dict) else None,
                 "sha256_declared": item.get("sha256") if isinstance(item, dict) else None,
                 "sha256_computed": None, "size_bytes": None, "exists": False,
                 "status": item.get("status") if isinstance(item, dict) else None}
        computed_screenshots.append(entry)
        if not filename:
            record("screenshots.filename", "截图 filename 非空", False, f"实际：{item!r}")
            continue
        record(f"screenshots.{filename}.fields", f"截图 {filename} 有 Feature ID/检查点/状态",
               bool(item.get("feature_id")) and bool(item.get("capture_point")) and bool(item.get("status")),
               f"实际：{item!r}")
        kind = item.get("image_kind")
        record(f"screenshots.{filename}.image_kind", f"截图 {filename} 已标注真实/synthetic",
               kind in IMAGE_KINDS,
               f"image_kind 缺失或非法：{kind!r}（synthetic 未标注时不得冒充真实截图）")
        shot_path = artifacts / "screenshots" / filename
        if not shot_path.is_file():
            record(f"screenshots.{filename}.exists", f"截图文件存在：{filename}", False,
                   f"screenshots/{filename} 不存在")
            continue
        entry["exists"] = True
        entry["size_bytes"] = shot_path.stat().st_size
        computed = sha256_file(shot_path)
        entry["sha256_computed"] = computed
        record(f"screenshots.{filename}.sha256", f"截图 SHA-256 可复算且一致：{filename}",
               is_sha(item.get("sha256"), 64) and item.get("sha256") == computed,
               f"清单 SHA-256：{item.get('sha256')!r}，实算 SHA-256：{computed}")
        point = checkpoint_by_file.get(filename)
        if point is None:
            record(f"checkpoints.{filename}", f"检查点覆盖截图：{filename}", False,
                   f"checkpoints.json 中没有引用 {filename}")
        else:
            record(f"checkpoints.{filename}.kind", f"检查点与清单的 image_kind 一致：{filename}",
                   point.get("image_kind") == kind,
                   f"检查点：{point.get('image_kind')!r}，清单：{kind!r}")
            record(f"checkpoints.{filename}.feature", f"检查点 Feature ID 与清单一致：{filename}",
                   point.get("feature_id") == item.get("feature_id"),
                   f"检查点：{point.get('feature_id')!r}，清单：{item.get('feature_id')!r}")
    # 检查点引用了清单外/不存在的截图，也要报错。
    listed = {entry["filename"] for entry in computed_screenshots}
    for point in (checkpoints if isinstance(checkpoints, list) else []):
        if isinstance(point, dict) and point.get("screenshot") not in listed:
            record(f"checkpoints.{point.get('screenshot')}.listed",
                   f"检查点截图在清单中：{point.get('screenshot')}", False,
                   f"checkpoints.json 引用了清单外的截图 {point.get('screenshot')!r}")
        if isinstance(point, dict) and point.get("image_kind") not in IMAGE_KINDS:
            record(f"checkpoints.{point.get('screenshot')}.kind",
                   f"检查点已标注真实/synthetic：{point.get('screenshot')}", False,
                   f"image_kind 缺失或非法：{point.get('image_kind')!r}")

    # 9. 日志与产物：已列出的路径逐项核对存在性；NOT_RUN/NOT_RECORDED 不编造。
    logs = manifest.get("logs_and_artifacts")
    if isinstance(logs, dict):
        for key in ("playwright_json", "playwright_report", "failure_trace",
                    "console_log", "page_error_log", "trace"):
            value = logs.get(key)
            if isinstance(value, str) and value not in ("NOT_RUN", "NOT_RECORDED", "NOT_AVAILABLE"):
                target = artifacts / value
                record(f"logs.{key}", f"日志/产物存在：{key}={value}", target.is_file(),
                       f"{value} 不存在")
    else:
        record("logs_and_artifacts", "logs_and_artifacts 为对象", False, f"实际值：{logs!r}")

    # 10. 来源等级与运行状态分开；synthetic 不能支撑真实运行验收 PASS。
    provenance = manifest.get("provenance")
    if isinstance(provenance, list):
        for source in provenance:
            if not isinstance(source, dict):
                continue
            level = source.get("evidence_level")
            record(f"provenance.{source.get('source_artifact')}.level",
                   f"来源证据等级取值合法：{source.get('source_artifact')}",
                   level in EVIDENCE_LEVELS, f"实际值：{level!r}")
            if "ybcs-offline" in str(source.get("source_project", "")) and level == "VERIFIED":
                record(f"provenance.{source.get('source_artifact')}.ybcs",
                       "ybcs-offline 来源不得标记 VERIFIED", False,
                       "ybcs-offline 来源只能标记 RECOVERED_SECONDARY 或 INFERRED")
    else:
        record("provenance", "provenance 为列表", False, f"实际值：{provenance!r}")
    runtime = manifest.get("runtime_acceptance") or {}
    if isinstance(runtime, dict):
        kinds = {entry["image_kind"] for entry in computed_screenshots if entry["image_kind"]}
        if runtime.get("runtime_status") == "PASS" and kinds and kinds == {"synthetic_harness"}:
            record("runtime.synthetic", "全部为 synthetic 截图时运行验收不得为 PASS", False,
                   "截图全部为 synthetic_harness，不能证明真实游戏场景/玩法")
        if runtime.get("runtime_status") == "NOT_RUN" and isinstance(assertions, dict):
            record("runtime.not_run_assertions", "runtime_status 为 NOT_RUN 时断言执行数为 0",
                   assertions.get("executed", 0) == 0,
                   f"断言执行数：{assertions.get('executed')!r}")
        record("runtime.status_separate", "runtime_acceptance 与 static_verification 分开记录",
               "status" in runtime and "status" in (manifest.get("static_verification") or {}),
               "缺少 runtime_acceptance.status 或 static_verification.status")

    # 11. 已知缺口：逐项有解除条件。
    gaps = manifest.get("known_gaps")
    if isinstance(gaps, list):
        for gap in gaps:
            ok = (isinstance(gap, dict) and bool(gap.get("gap_id"))
                  and gap.get("status") in GAP_STATUSES and bool(gap.get("required_evidence")))
            record(f"known_gaps.{gap.get('gap_id') if isinstance(gap, dict) else gap}",
                   "已知缺口有 ID/状态/解除条件", ok, f"实际：{gap!r}")
    else:
        record("known_gaps", "known_gaps 为列表", False, f"实际值：{gaps!r}")

    # 12. Worker 结论不得与核对结果矛盾；总管读回不由本脚本代替。
    verdict_claimed = manifest.get("worker_verdict")
    if errors:
        record("worker_verdict", "worker_verdict 与核对结果一致",
               verdict_claimed in ("FAIL", "BLOCKED", "PARTIAL", "NOT_RUN"),
               f"核对发现 {len(errors)} 项错误，但 worker_verdict 为 {verdict_claimed!r}")
    manager = manifest.get("manager_review") or {}
    record("manager_review", "manager_review 已记录（未审核时写 NOT_RECORDED）",
           isinstance(manager, dict) and "status" in manager,
           "manager_review 缺失 status；总管独立读回尚未完成时应写 NOT_RECORDED")

    derived = "FAIL" if errors else ("FAIL" if playwright_counts["failed"] else "PASS")
    return {"errors": errors, "checks": checks, "manifest": manifest,
            "playwright": {"counts": playwright_counts, "failures": playwright_failures},
            "screenshots": computed_screenshots, "verdict": derived}


def render_markdown(result, artifacts, out):
    manifest = result["manifest"] or {}
    revision = manifest.get("revision") or {}
    lines = []
    lines.append("# 验收证据清单（P3 试点初稿）")
    lines.append("")
    lines.append(f"- request-id：{manifest.get('request_id', 'NOT_RECORDED')}")
    lines.append(f"- 仓库：{manifest.get('repository', 'NOT_RECORDED')}")
    lines.append(f"- 分支：{revision.get('branch', 'NOT_RECORDED')}")
    lines.append(f"- 基底 SHA：{revision.get('base_commit_sha', 'NOT_RECORDED')}")
    lines.append(f"- 被测提交 SHA：{revision.get('tested_commit_sha', 'NOT_RECORDED')}")
    lines.append(f"- 产物目录：{artifacts}")
    lines.append(f"- 核对结论：{result['verdict']}")
    lines.append("- 总管独立读回：未由本脚本代替，manager_review.status 见 JSON。")
    lines.append("")
    lines.append("## 核对结果")
    lines.append("")
    lines.append("| 检查 | 结果 | 说明 |")
    lines.append("| --- | --- | --- |")
    for check in result["checks"]:
        lines.append(f"| {check['id']} {check['name']} | {check['result']} | {check['detail']} |")
    lines.append("")
    lines.append("## 截图")
    lines.append("")
    lines.append("| 文件名 | Feature ID | 检查点 | 真实/synthetic | 字节数 | SHA-256（实算） |")
    lines.append("| --- | --- | --- | --- | --- |")
    for shot in result["screenshots"]:
        lines.append(f"| {shot['filename']} | {shot['feature_id']} | {shot['capture_point']} | "
                     f"{shot['image_kind']} | {shot['size_bytes']} | {shot['sha256_computed']} |")
    lines.append("")
    lines.append("## 缺失 / 不一致（缺口）")
    lines.append("")
    if result["errors"]:
        for error in result["errors"]:
            lines.append(f"- {error}")
    else:
        lines.append("- 无。")
    lines.append("")
    lines.append("## 本脚本不能覆盖的证据类型")
    lines.append("")
    lines.append("- 总管独立读回与最终裁定；本脚本只核对清单与文件，不代替人工读回。")
    lines.append("- 截图内容的真实性（画面是否确为所称 Feature/检查点）；只核对文件存在与 SHA-256。")
    lines.append("- CI artifact 的可读性与保留期限；只核对本地产物目录中的路径。")
    lines.append("- Git blob SHA 与 changed_files 行数的仓库侧读回；本脚本只核对格式。")
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(description="核对 Lapis 验收证据束（P3 试点初稿）")
    parser.add_argument("--artifacts", required=True, help="测试产物目录")
    parser.add_argument("--out", required=True, help="输出目录")
    parser.add_argument("--branch", default=None, help="期望分支")
    parser.add_argument("--commit-sha", default=None, help="期望提交完整 SHA")
    parser.add_argument("--base-sha", default=None, help="期望基底完整 SHA")
    args = parser.parse_args(argv)
    artifacts = Path(args.artifacts)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    result = check_bundle(artifacts, expected_branch=args.branch,
                          expected_commit=args.commit_sha, expected_base=args.base_sha)
    bundle = {
        "schema_version": SCHEMA_VERSION,
        "bundle_id": (result["manifest"] or {}).get("bundle_id", "NOT_RECORDED"),
        "request_id": (result["manifest"] or {}).get("request_id", "NOT_RECORDED"),
        "repository": (result["manifest"] or {}).get("repository", "NOT_RECORDED"),
        "revision": (result["manifest"] or {}).get("revision", {}),
        "scope": (result["manifest"] or {}).get("scope", {}),
        "changed_files": (result["manifest"] or {}).get("changed_files", []),
        "environment": (result["manifest"] or {}).get("environment", {}),
        "command_execution": (result["manifest"] or {}).get("command_execution", {}),
        "static_verification": (result["manifest"] or {}).get("static_verification", {}),
        "runtime_acceptance": (result["manifest"] or {}).get("runtime_acceptance", {}),
        "test_summary": (result["manifest"] or {}).get("test_summary", {}),
        "screenshots": {"status": (result["manifest"] or {}).get("screenshots", {}).get("status", "NOT_RECORDED"),
                       "items": result["screenshots"]},
        "logs_and_artifacts": (result["manifest"] or {}).get("logs_and_artifacts", {}),
        "provenance": (result["manifest"] or {}).get("provenance", []),
        "known_gaps": (result["manifest"] or {}).get("known_gaps", []),
        "worker_verdict": result["verdict"],
        "manager_review": (result["manifest"] or {}).get("manager_review", {}),
        "checks": result["checks"],
        "errors": result["errors"],
        "playwright": result["playwright"],
        "generator": "scripts/evidence-bundle-check.py (P3 试点初稿)",
    }
    (out / "evidence-bundle.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "evidence-bundle.md").write_text(
        render_markdown(result, artifacts, out), encoding="utf-8")
    if result["errors"]:
        print(f"证据核对失败：{len(result['errors'])} 项错误", file=sys.stderr)
        for error in result["errors"]:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("证据核对通过：无缺失或不一致。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
