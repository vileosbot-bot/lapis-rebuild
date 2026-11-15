#!/usr/bin/env python3
"""Dependency-free machine gate helpers for lapis-rebuild."""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]


class ReadbackMismatch(ValueError):
    """A successful GitHub API read returned facts that contradict the PR event."""
SECRET_PATTERNS = (
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
    re.compile(r"""(?i)\b(?:password|passwd|secret|api[_-]?key|client[_-]?secret|access[_-]?token)\b\s*[:=]\s*["'][^"'\s]{12,}["']"""),
)
FALLBACKS = {
    "unit_tests": ("web/package.json", 1),
    "build": ("web/vite.config.ts", 1),
    "typecheck": ("web/tsconfig.json", 1),
    "format": ("tools/gate/check_gate.py", 1),
    "static": (".github/workflows/web-ci.yml", 1),
    "secrets": ("tools/gate/check_gate.py", 1),
    "screenshot": ("web/index.html", 1),
    "github_readback": (".github/workflows/web-ci.yml", 1),
}


def annotation(path: str, line: int, message: str, level: str = "error") -> None:
    safe = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    safe = safe.replace(":", "%3A").replace(",", "%2C")
    print(f"::{level} file={path},line={max(1, int(line))}::{safe}")


def write_json(path: str | Path, value: dict) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: str | Path, default: dict | None = None) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default or {}


def git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout


def diff_refs() -> tuple[str, str]:
    return os.environ.get("GATE_BASE_SHA", "main"), os.environ.get("GATE_HEAD_SHA", "HEAD")


def changed_paths(base: str, head: str) -> list[str]:
    output = git("diff", "--name-only", "--diff-filter=ACDMRT", f"{base}...{head}")
    return sorted({line.strip() for line in output.splitlines() if line.strip()})


def format_issues(content: str) -> list[tuple[int, str]]:
    issues = []
    lines = content.splitlines()
    for number, line in enumerate(lines, 1):
        if line.endswith((" ", "\t")):
            issues.append((number, "行尾存在空格或制表符"))
    if content and not content.endswith("\n"):
        issues.append((max(1, len(lines)), "文件缺少末尾换行"))
    if "\r" in content.replace("\r\n", ""):
        issues.append((1, "文件包含非 CRLF 配对的回车符"))
    return issues


def detect_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in SECRET_PATTERNS)


def normalize_status(value: str | None) -> str:
    value = (value or "").strip().lower()
    if value in {"success", "passed", "pass", "true"}:
        return "PASS"
    if value in {"failure", "failed", "fail", "cancelled", "timed_out", "timeout", "false"}:
        return "FAIL"
    return "UNKNOWN"


def combine_statuses(*values: str | None) -> str:
    states = [normalize_status(value) for value in values]
    if "FAIL" in states:
        return "FAIL"
    if "UNKNOWN" in states:
        return "UNKNOWN"
    return "PASS"


def overall_status(statuses: list[str]) -> str:
    if "FAIL" in statuses:
        return "FAIL"
    if "UNKNOWN" in statuses or "NOT_RUN" in statuses:
        return "UNKNOWN"
    return "PASS"


def classify_review(files: list[dict], changed_lines: int, diff_text: str = "") -> str:
    red_path = re.compile(
        r"(^|/)(payments?|billing|wallet|money|finance|economy|currency|gold|balance|price|transaction|delete|deletion|removal|deploy|deployment|release|publish|freeze|permissions?|access-control|auth)(/|[-_.]|$)",
        re.IGNORECASE,
    )
    for item in files:
        if red_path.search(str(item.get("filename", ""))) or item.get("status") == "removed":
            return "red"
    for line in diff_text.splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            if re.search(r"(?i)\b(?:permissions\s*:|issues\s*:\s*write|contents\s*:\s*write|pull-requests\s*:\s*write|id-token\s*:\s*write)\b", line[1:]):
                return "red"
    if changed_lines <= 50 and files:
        safe = {".md", ".txt", ".css", ".scss", ".less"}
        if all(Path(str(item.get("filename", ""))).suffix.lower() in safe for item in files):
            return "green"
    return "yellow"


def review_decision(level: str, gate_status: str, blind_review: str = "missing",
                    opus_review: str = "missing", manager_review: str = "missing") -> dict:
    if gate_status != "PASS":
        return {"reviewed": False, "merge_allowed": False, "reason": "门禁未通过或未知"}
    if level not in {"green", "yellow", "red"}:
        return {"reviewed": False, "merge_allowed": False, "reason": "审查等级未知，按高一级阻断"}
    if level == "red":
        passed = opus_review == "passed" and manager_review == "approved"
        return {"reviewed": passed, "merge_allowed": passed, "reason": "红灯需要 Opus 盲审和总管最终批准"}
    if level == "yellow":
        passed = blind_review == "passed" and manager_review == "approved"
        return {"reviewed": passed, "merge_allowed": passed, "reason": "黄灯需要子代理盲审和总管逐项验收"}
    passed = blind_review == "passed"
    manager_ok = manager_review in {"not_selected", "sampled_approved", "approved"}
    return {"reviewed": passed, "merge_allowed": passed and manager_ok, "reason": "绿灯必须先完成子代理盲审"}




def ledger_matches(merged: set[int], ledger_rows: list[int]) -> bool:
    ledger_numbers = set(ledger_rows)
    return merged == ledger_numbers and len(ledger_rows) == len(ledger_numbers)


def annotate_log(log_text: str, fallback_file: str, fallback_line: int) -> None:
    patterns = (
        re.compile(r'File "([^"]+)", line (\d+)'),
        re.compile(r"([A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|json|yml|yaml|css|html|md)):(\d+)(?::\d+)?"),
        re.compile(r"([A-Za-z0-9_./-]+\.(?:py|ts|tsx|js|mjs|json|yml|yaml|css|html|md))\((\d+),\d+\)"),
    )
    found = set()
    for pattern in patterns:
        for match in pattern.finditer(log_text):
            path = match.group(1).replace(str(ROOT) + "/", "")
            found.add((path, int(match.group(2))))
    if found:
        for path, line in sorted(found)[:20]:
            annotation(path, line, "门禁命令失败；请查看对应步骤日志")
    else:
        annotation(fallback_file, fallback_line, "门禁命令失败但工具未提供源码行号；回退定位，请查看日志")


def command_run(args: argparse.Namespace) -> int:
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        print("missing command after --", file=sys.stderr)
        return 2
    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            command, cwd=ROOT / args.cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, errors="replace"
        )
        assert process.stdout is not None
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            log.write(line)
        code = process.wait()
    if code:
        annotate_log(log_path.read_text(encoding="utf-8", errors="replace"), args.fallback_file, args.fallback_line)
    return code


def format_check() -> int:
    base, head = diff_refs()
    failed = False
    try:
        output = git("diff", "--check", f"{base}...{head}")
        if output.strip():
            for line in output.splitlines():
                match = re.match(r"(.+?):(\d+):\s*(.*)", line)
                if match:
                    annotation(match.group(1), int(match.group(2)), match.group(3))
                else:
                    annotation(".github/workflows/web-ci.yml", 1, line)
                failed = True
        status_rows = git("diff", "--name-status", f"{base}...{head}").splitlines()
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"格式检查无法读取 diff：{exc}")
        return 1
    # New files are checked in full. Modified legacy files are checked on added lines by git diff --check.
    for row in status_rows:
        parts = row.split("\t")
        if not parts or parts[0] != "A" or len(parts) < 2:
            continue
        name = parts[-1]
        path = ROOT / name
        if not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for number, message in format_issues(content):
            annotation(name, number, message)
            failed = True
    print(f"format_check: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def static_check() -> int:
    base, head = diff_refs()
    try:
        paths = changed_paths(base, head)
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"无法计算静态检查范围：{exc}")
        return 1
    failed = False
    for name in paths:
        if name.endswith(".py") and (ROOT / name).is_file():
            try:
                ast.parse((ROOT / name).read_text(encoding="utf-8"), filename=name)
            except SyntaxError as exc:
                annotation(name, exc.lineno or 1, f"Python AST 解析失败：{exc.msg}")
                failed = True
    workflow_path = ROOT / ".github/workflows/web-ci.yml"
    if workflow_path.exists():
        workflow = workflow_path.read_text(encoding="utf-8")
        required = (
            "pull_request:", "branches: [main]",
            "id: parser-unit", "id: deps", "id: typecheck", "id: web-unit", "id: build",
            "id: playwright-install", "id: standalone-preview", "id: chromium-e2e",
            "id: s41-e2e", "id: m73-fixture", "id: m73-build", "id: m73-e2e",
            "id: gate-format", "id: gate-static", "id: gate-secrets", "id: gate-screenshot",
            "id: gate-readback", "id: gate-self-test", "id: synthetic-artifact",
            "id: gate-summary", "id: gate-comment", "id: gate-finalize",
        )
        lines = workflow.splitlines()
        for token in required:
            if token not in workflow:
                annotation(".github/workflows/web-ci.yml", 1, f"工作流缺少必需结构：{token}")
                failed = True
        for number, line in enumerate(lines, 1):
            match = re.match(r"^\s*uses:\s*([^\s#]+)", line)
            if match:
                action = match.group(1)
                if "@" not in action or not re.fullmatch(r"[0-9a-fA-F]{40}", action.rsplit("@", 1)[-1]):
                    annotation(".github/workflows/web-ci.yml", number, f"Action 未固定到完整 40 位 SHA：{action}")
                    failed = True
        step_ids = [token.split(": ", 1)[1] for token in required if token.startswith("id: ")]
        for step_id in step_ids:
            indexes = [i for i, line in enumerate(lines) if line.strip() == f"id: {step_id}"]
            if not indexes:
                continue
            index = indexes[0]
            start = index
            while start > 0 and not re.match(r"^\s{6}- ", lines[start]):
                start -= 1
            end = index + 1
            while end < len(lines) and not re.match(r"^\s{6}- ", lines[end]):
                end += 1
            if not any("timeout-minutes:" in line for line in lines[start:end]):
                annotation(".github/workflows/web-ci.yml", index + 1, f"{step_id} 缺少单项超时")
                failed = True
    if (ROOT / ".github/workflows/ci.yml").exists():
        annotation(".github/workflows/ci.yml", 1, "检测到禁止另建的 ci.yml")
        failed = True
    print(f"static_check: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def secret_scan() -> int:
    base, head = diff_refs()
    try:
        diff = git("diff", "--unified=0", f"{base}...{head}")
    except RuntimeError as exc:
        annotation(".github/workflows/web-ci.yml", 1, f"无法读取 diff：{exc}")
        return 1
    filename = ".github/workflows/web-ci.yml"
    new_line = 1
    failed = False
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            filename = line[6:]
        elif line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,\d+)?", line)
            if match:
                new_line = int(match.group(1))
        elif line.startswith("+") and not line.startswith("+++"):
            if detect_secret(line[1:]):
                annotation(filename, new_line, "新增行疑似包含密钥/凭据，禁止提交")
                failed = True
            new_line += 1
    print(f"secret_scan: {'FAIL' if failed else 'PASS'}")
    return int(failed)


def screenshot_check(path_text: str) -> int:
    try:
        data = (ROOT / path_text).read_bytes()
    except OSError:
        annotation(path_text, 1, "截图文件不存在或不可读")
        return 1
    if len(data) < 512 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        annotation(path_text, 1, "截图不是有效 PNG 或文件过小")
        return 1
    width, height = struct.unpack(">II", data[16:24])
    if width < 640 or height < 360:
        annotation(path_text, 1, f"截图尺寸异常：{width}x{height}")
        return 1
    print(f"screenshot_check: PASS; bytes={len(data)}; dimensions={width}x{height}")
    return 0


def api_json(url: str, token: str, body: dict | None = None, method: str = "GET") -> object:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(url, data=data, method=method, headers={
        "Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json",
        "User-Agent": "lapis-agent-ops-gate",
    })
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def paged_api(url: str, token: str) -> list[dict]:
    output = []
    page = 1
    while True:
        sep = "&" if "?" in url else "?"
        batch = api_json(f"{url}{sep}per_page=100&page={page}", token)
        if not isinstance(batch, list):
            raise RuntimeError("GitHub API did not return a list")
        output.extend(x for x in batch if isinstance(x, dict))
        if len(batch) < 100:
            return output
        page += 1


def parse_ledger(path: Path) -> list[int]:
    rows = []
    pattern = re.compile(r"^\|\s*#(\d+)\s*\|\s*\d{4}-\d{2}-\d{2}T[^|]+\|\s*[0-9a-f]{40}\s*\|")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if match:
            rows.append(int(match.group(1)))
    return rows


def readback(args: argparse.Namespace) -> int:
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    number = os.environ.get("PR_NUMBER", "")
    head = os.environ.get("EXPECTED_HEAD_SHA", "")
    base = os.environ.get("EXPECTED_BASE_SHA", "")
    base_ref = os.environ.get("EXPECTED_BASE_REF", "main")
    if not all((token, repo, number, head, base)):
        write_json(args.output, {"status": "UNKNOWN", "reason": "PR/API 环境变量缺失"})
        print("github_readback: UNKNOWN")
        return 0
    try:
        root = f"https://api.github.com/repos/{repo}"
        pr = api_json(f"{root}/pulls/{number}", token)
        if pr.get("state") != "open" or pr.get("merged"):
            raise ReadbackMismatch("PR 不是 open 状态或已经合并")
        if pr.get("head", {}).get("sha") != head:
            raise ReadbackMismatch("GitHub PR head SHA 与事件 head SHA 不一致")
        if pr.get("base", {}).get("sha") != base or pr.get("base", {}).get("ref") != base_ref:
            raise ReadbackMismatch("GitHub PR base SHA/ref 与事件不一致")
        if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
            raise ReadbackMismatch("PR head repo 不是 bot 目标仓库")
        files = paged_api(f"{root}/pulls/{number}/files", token)
        api_names = {str(x.get("filename")) for x in files}
        local_names = set(changed_paths(base, head))
        if api_names != local_names:
            raise ReadbackMismatch(f"PR changed files 与本地 diff 不一致：API={sorted(api_names)} local={sorted(local_names)}")
        merged = paged_api(f"{root}/pulls?state=closed", token)
        merged_numbers = {int(x["number"]) for x in merged if x.get("merged_at")}
        ledger_rows = parse_ledger(ROOT / "docs/agent-ops/review-ledger.md")
        ledger_numbers = set(ledger_rows)
        if not ledger_matches(merged_numbers, ledger_rows):
            raise ReadbackMismatch(
                f"审查台账不一致：merged={len(merged_numbers)} ledger_rows={len(ledger_rows)} "
                f"ledger_unique={len(ledger_numbers)} missing={sorted(merged_numbers-ledger_numbers)} "
                f"extra={sorted(ledger_numbers-merged_numbers)}"
            )
        changed_lines = sum(int(x.get("additions", 0)) + int(x.get("deletions", 0)) for x in files)
        diff_text = git("diff", "--unified=0", f"{base}...{head}")
        level = classify_review(files, changed_lines, diff_text)
        payload = {
            "status": "PASS", "repository": repo, "pr_number": int(number),
            "head_sha": pr.get("head", {}).get("sha"), "base_ref": pr.get("base", {}).get("ref"),
            "base_sha": pr.get("base", {}).get("sha"),
            "changed_files": sorted([{
                "filename": x.get("filename"), "status": x.get("status"),
                "additions": int(x.get("additions", 0)), "deletions": int(x.get("deletions", 0))
            } for x in files], key=lambda x: str(x["filename"])),
            "changed_lines": changed_lines, "review_level": level,
            "merged_pr_count": len(merged_numbers), "review_ledger_count": len(ledger_rows),
            "review_ledger_matches": True,
        }
        write_json(args.output, payload)
        print(f"github_readback: PASS; PR=#{number}; level={level}; merged={len(merged_numbers)}; ledger={len(ledger_numbers)}")
        return 0
    except ReadbackMismatch as exc:
        write_json(args.output, {"status": "FAIL", "reason": str(exc)})
        annotation(".github/workflows/web-ci.yml", 1, f"GitHub 独立读回不一致：{exc}")
        print(f"github_readback: FAIL; {exc}")
        return 0
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError, json.JSONDecodeError, AttributeError, TypeError) as exc:
        write_json(args.output, {"status": "UNKNOWN", "reason": f"API/读回不可用：{type(exc).__name__}"})
        annotation(".github/workflows/web-ci.yml", 1, "GitHub API 不可用；状态为门禁未知，不得视为通过")
        print(f"github_readback: UNKNOWN; {type(exc).__name__}")
        return 0


def reverse_tests() -> int:
    tests = [
        ("1 单元测试失败被拦截", combine_statuses("failure", "success") == "FAIL"),
        ("2 模拟密钥被扫描", detect_secret("AKIA" + "A" * 16)),
        ("3 格式错误被拦截", bool(format_issues("bad line  \n"))),
        ("4 全通过时放行并正确分为绿灯",
         overall_status(["PASS"] * 8) == "PASS" and classify_review(
             [{"filename": "docs/agent-ops/example.md", "status": "modified"}], 10) == "green"),
        ("5 超时明确归为失败", normalize_status("timed_out") == "FAIL"),
        ("6 CI/API 不可用显示未知", normalize_status(None) == "UNKNOWN"),
        ("7 红灯缺少 Opus 盲审不得合并",
         not review_decision("red", "PASS", opus_review="missing", manager_review="approved")["merge_allowed"]),
        ("8 绿灯缺少子代理盲审不得标记已审查",
         not review_decision("green", "PASS", manager_review="not_selected")["reviewed"]),
        ("9 台账 PR 集合/行数与合并 PR 集合一致性校验",
         ledger_matches({1, 2, 3}, [1, 2, 3]) and
         not ledger_matches({1, 2, 3}, [1, 2, 2, 3]) and
         not ledger_matches({1, 2}, [1, 2, 3]) and
         not review_decision("unknown", "PASS", blind_review="passed", manager_review="approved")["merge_allowed"]),
    ]
    failed = 0
    for name, passed in tests:
        print(f"[{'PASS' if passed else 'FAIL'}] {name}")
        failed += int(not passed)
    print(f"reverse_tests: {len(tests)-failed}/{len(tests)} passed")
    return int(failed > 0)


def local_file_rows() -> list[dict]:
    base, head = diff_refs()
    try:
        names = changed_paths(base, head)
    except RuntimeError:
        return []
    rows = []
    for name in names:
        try:
            parts = git("diff", "--numstat", f"{base}...{head}", "--", name).strip().split("\t")
            additions = int(parts[0]) if parts[0].isdigit() else 0
            deletions = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        except (RuntimeError, ValueError, IndexError):
            additions, deletions = 0, 0
        rows.append({"filename": name, "status": "changed", "additions": additions, "deletions": deletions})
    return rows


def summarize(args: argparse.Namespace) -> int:
    is_pr = os.environ.get("IS_PR", "false").lower() == "true"
    readback_data = read_json(args.readback, {})
    dependencies = normalize_status(os.environ.get("GATE_DEPS"))
    build = combine_statuses(dependencies, os.environ.get("GATE_BUILD"), os.environ.get("GATE_M73_BUILD"))
    screenshot = combine_statuses(
        os.environ.get("GATE_SCREENSHOT"), os.environ.get("GATE_CHROMIUM_E2E"),
        os.environ.get("GATE_M73_E2E"), os.environ.get("GATE_PLAYWRIGHT_INSTALL"),
        os.environ.get("GATE_STANDALONE_PREVIEW"), os.environ.get("GATE_M73_FIXTURE"),
        os.environ.get("GATE_S41_E2E", "success")
    )
    readback_status = str(readback_data.get("status", "UNKNOWN")).upper() if is_pr else "NOT_APPLICABLE"
    gates = [
        ("单元测试", combine_statuses(dependencies, os.environ.get("GATE_PARSER_UNIT"), os.environ.get("GATE_WEB_UNIT")), "unit_tests"),
        ("构建", build, "build"),
        ("类型检查", combine_statuses(dependencies, os.environ.get("GATE_TYPECHECK")), "typecheck"),
        ("格式检查", normalize_status(os.environ.get("GATE_FORMAT")), "format"),
        ("静态检查", normalize_status(os.environ.get("GATE_STATIC")), "static"),
        ("敏感信息扫描", normalize_status(os.environ.get("GATE_SECRETS")), "secrets"),
        ("截图自检", screenshot, "screenshot"),
        ("GitHub 独立读回", readback_status, "github_readback"),
    ]
    reverse = normalize_status(os.environ.get("GATE_SELF_TEST"))
    artifact = normalize_status(os.environ.get("GATE_SYNTHETIC_ARTIFACT"))
    overall = overall_status([x[1] for x in gates] + [reverse])
    if artifact == "FAIL":
        overall = "FAIL"
    elif artifact != "PASS" and overall == "PASS":
        overall = "UNKNOWN"
    labels = {"PASS": "通过", "FAIL": "未通过", "UNKNOWN": "门禁未知", "NOT_APPLICABLE": "不适用"}
    rows = readback_data.get("changed_files") or local_file_rows()
    level = readback_data.get("review_level", "未判定")
    base_sha = readback_data.get("base_sha") or os.environ.get("GATE_BASE_SHA", "")
    head_sha = readback_data.get("head_sha") or os.environ.get("GATE_HEAD_SHA", "")
    lines = [
        "<!-- agent-ops-gate -->", f"## 机器门禁结果：{labels.get(overall, '门禁未知')}", "",
        "| 门禁 | 状态 |", "| --- | --- |",
    ]
    for title, status, _ in gates:
        lines.append(f"| {title} | {labels.get(status, '门禁未知')} |")
    lines += [
        f"| 九项反向测试 | {labels.get(reverse, '门禁未知')} |",
        f"| 验证产物上传 | {labels.get(artifact, '门禁未知')} |",
        "", f"**审查等级：** {level}", "", "**改动清单：**",
    ]
    if is_pr:
        lines.append(f"**PR：** #{readback_data.get('pr_number', os.environ.get('PR_NUMBER', 'unknown'))}；base={base_sha or 'unknown'}；head={head_sha or 'unknown'}")
    if rows:
        for item in rows:
            lines.append(f"- {item.get('filename')}（{item.get('status')}，+{item.get('additions', 0)} / -{item.get('deletions', 0)}）")
    else:
        lines.append("- 无法取得改动清单；按门禁未知处理。")
    if level == "red":
        lines += ["", "**审查路径：** 红灯；须先取得 Opus 盲审，再由总管作最终决定。在此之前不得合并。"]
    elif level == "yellow":
        lines += ["", "**审查路径：** 黄灯；须子代理盲审，再由总管逐项验收。"]
    elif level == "green":
        lines += ["", "**审查路径：** 绿灯；须子代理盲审，总管每 5 个抽查 1 个。"]
    lines += ["", "本门禁当前为参考模式，没有启用 required-check 分支保护，也不会自动合并。缺失/不可用的检查不得推断为通过。"]
    markdown = "\n".join(lines) + "\n"
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(markdown, encoding="utf-8")
    write_json(args.json_output, {
        "overall": overall, "gates": {key: status for _, status, key in gates},
        "reverse_tests": reverse, "evidence_upload": artifact, "review_level": level,
        "changed_files": rows, "readback": readback_data,
    })
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(markdown)
    for title, status, key in gates:
        if status in {"FAIL", "UNKNOWN"}:
            path, line = FALLBACKS[key]
            annotation(path, line, f"{title}：{labels.get(status, '门禁未知')}；查看对应日志/读回证据")
    if reverse != "PASS":
        annotation("tools/gate/check_gate.py", 1, "九项反向测试未通过或未执行")
    print(f"gate_summary: {overall}")
    return 0


def post_comment(args: argparse.Namespace) -> int:
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    number = os.environ.get("PR_NUMBER", "")
    if not all((token, repo, number)):
        write_json(args.output, {"status": "UNKNOWN", "reason": "PR 评论环境变量缺失"})
        print("pr_comment: UNKNOWN")
        return 0
    body = Path(args.summary).read_text(encoding="utf-8")
    marker = "<!-- agent-ops-gate -->"
    try:
        root = f"https://api.github.com/repos/{repo}"
        comments = paged_api(f"{root}/issues/{number}/comments", token)
        existing = next((x for x in comments if marker in str(x.get("body", ""))), None)
        if existing:
            result = api_json(f"{root}/issues/comments/{existing['id']}", token, {"body": body}, "PATCH")
            action = "updated"
        else:
            result = api_json(f"{root}/issues/{number}/comments", token, {"body": body}, "POST")
            action = "created"
        write_json(args.output, {"status": "PASS", "action": action, "comment_id": result.get("id")})
        print(f"pr_comment: PASS; {action}")
        return 0
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError, json.JSONDecodeError) as exc:
        write_json(args.output, {"status": "UNKNOWN", "reason": f"评论写回不可用：{type(exc).__name__}"})
        annotation(".github/workflows/web-ci.yml", 1, "PR 门禁结果无法写回评论；门禁未知")
        print(f"pr_comment: UNKNOWN; {type(exc).__name__}")
        return 0


def finalize(args: argparse.Namespace) -> int:
    summary = read_json(args.summary_json, {})
    overall = str(summary.get("overall", "UNKNOWN")).upper()
    if os.environ.get("IS_PR", "false").lower() == "true":
        comment = read_json(args.comment_json, {})
        if str(comment.get("status", "UNKNOWN")).upper() != "PASS" and overall == "PASS":
            overall = "UNKNOWN"
    labels = {"PASS": "通过", "FAIL": "未通过", "UNKNOWN": "门禁未知"}
    message = f"最终门禁状态：{labels.get(overall, '门禁未知')}。"
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write("\n" + message + "\n")
    print(message)
    return 0 if overall == "PASS" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="lapis-rebuild machine gate")
    sub = parser.add_subparsers(dest="command_name", required=True)
    run_p = sub.add_parser("run")
    run_p.add_argument("--log", required=True)
    run_p.add_argument("--cwd", default=".")
    run_p.add_argument("--fallback-file", default=".github/workflows/web-ci.yml")
    run_p.add_argument("--fallback-line", type=int, default=1)
    run_p.add_argument("command", nargs=argparse.REMAINDER)
    sub.add_parser("format")
    sub.add_parser("static")
    sub.add_parser("secrets")
    sub.add_parser("self-test")
    shot = sub.add_parser("screenshot")
    shot.add_argument("--path", required=True)
    rb = sub.add_parser("readback")
    rb.add_argument("--output", required=True)
    sm = sub.add_parser("summarize")
    sm.add_argument("--output", required=True)
    sm.add_argument("--json-output", required=True)
    sm.add_argument("--readback", default=os.environ.get("GATE_READBACK_FILE", ""))
    cm = sub.add_parser("comment")
    cm.add_argument("--summary", required=True)
    cm.add_argument("--output", required=True)
    fin = sub.add_parser("finalize")
    fin.add_argument("--summary-json", required=True)
    fin.add_argument("--comment-json", default="")
    args = parser.parse_args()
    actions = {
        "run": lambda: command_run(args),
        "format": format_check,
        "static": static_check,
        "secrets": secret_scan,
        "self-test": reverse_tests,
        "screenshot": lambda: screenshot_check(args.path),
        "readback": lambda: readback(args),
        "summarize": lambda: summarize(args),
        "comment": lambda: post_comment(args),
        "finalize": lambda: finalize(args),
    }
    return actions[args.command_name]()


if __name__ == "__main__":
    raise SystemExit(main())
