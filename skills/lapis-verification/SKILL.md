---
name: lapis-verification
description: "为 vileosbot-bot/lapis-rebuild 的代码、数据和网页功能执行标准化验收。工人开工前确定 Feature Map 路径、实现完成后运行适用的 typecheck/unit/build/Chromium E2E、复核截图与运行日志，并交付总管可独立读回的证据束。用于功能开发、修复、数据接入、PR 前自检、验收失败复现和补充证据。"
---

# Lapis Verification

## 0. 显式引用与安装边界

本技能是仓库内的说明文件。**文件进入 Git 不代表 ChatGPT 已自动安装或会自动加载它。**

在未确认技能已安装并可调用前，任务提示词必须显式加入以下要求：

> 请先读取并遵循仓库中的 `skills/lapis-verification/SKILL.md`，并读取 `docs/verification/feature-map.schema.md`、`docs/verification/feature-map.ch1.yaml` 和 `skills/lapis-verification/references/harness-operations.md`。按 Feature Map 与本技能完成验证和证据交付。

如果已安装为 ChatGPT Skill，可按客户端支持的技能调用方式调用；否则以上仓库路径引用是必需步骤，不得声称技能已自动生效。

## 1. 输入与项目边界

开工前取得并记录：

- 目标仓库：`vileosbot-bot/lapis-rebuild`。
- 当前分支、完整基底 SHA、当前 HEAD SHA。
- 任务涉及的 Feature ID；若 Feature Map 尚无对应条目，先提出新增条目，不得临时编造通过标准。
- 变更文件、执行环境、适用命令及证据保存位置。
- 需要总管确认的绑定、权限或外部验收依赖。

先读取仓库根目录 `AGENTS.md` 和 `web/AGENTS.md`，其项目、安全和测试要求优先于本技能。普通 Worker 使用获准的云端/CI 环境；不得把用户桌面、Remote Desktop Commander 或本地克隆作为默认开发执行环境。

本技能不授权：向 main 写入、合并 PR、删除分支、修改主号只读仓库、公开部署或公开版权资源。

## 2. 不可突破的证据纪律

1. 来源证据等级与网页运行时验收状态必须分列。
2. ybcs-offline 来源只能标记 `RECOVERED_SECONDARY` 或 `INFERRED`，绝不能标记 `VERIFIED`。
3. `RECONSTRUCTION_POLICY`、训练策略和兼容行为不能包装成原版服务端事实。
4. E2E 通过只能证明所测网页行为在当前提交和测试条件下通过，不能升级静态来源等级。
5. synthetic fixture、synthetic HTML、`page.setContent()` 截图不能冒充真实游戏资源或真实网页玩法证据。
6. 不执行原安装器、`NeoDark.exe`、未知 DLL 或注入组件；不绕过浏览器/管理员策略。
7. 不得删减旧断言、跳过失败用例或改写 Feature Map 来制造绿色结果。
8. 不同提交的源码、测试结果、截图和 CI 产物不得混合成一个通过证据束。

## 3. 五段验证流程

### Launch — 锁定目标与启动

1. 读取 `AGENTS.md`、`web/AGENTS.md`、Feature Map Schema、目标 Feature 条目和 harness 操作索引。
2. 记录仓库、分支、基底 SHA、HEAD SHA；确认本次验证针对哪个精确提交。
3. 将任务拆到 Feature ID，逐项核对到达路径、前置状态、预期状态和证据类型。
4. 确认测试运行器、Node/Python 版本、依赖、Chromium 与资源包状态。
5. Web E2E 使用 production preview。当前 Playwright 配置会自动执行 `npm run preview -- --port 4173`，但运行前必须先有 `web/dist`。
6. synthetic pack 只能用于 synthetic 测试，且必须明确标注其来源；不要将其截图作为真实资源验收。

**第一章强制停止条件：** 对任何依赖第一章真实主链操作的 `CH1-*` Feature，如果 #3 尚未提供其真实 acceptance spec 和可调用的第一章专用操作杆，或总管尚未验收确认这些入口，立即将相关运行验收标记为 `BLOCKED`。不得拿 S14/M7 训练战斗、S18 synthetic harness、手工改状态、伪造 DOM 或自造 fixture 名称代替。可以继续完成不依赖这些入口的静态文档审查，但不得宣称第一章运行验收通过。

### Doctor — 环境与健康检查

按任务范围执行，不要把所有命令无差别地重复运行。

- Node 版本必须满足 `web/package.json` 的 `>=22.12.0`。
- 仓库规则要求 Python 3.12；若运行 Python parser tests，记录实际版本。
- 在 `web/` 安装锁定依赖：`npm ci --ignore-scripts`。
- Web 变更至少执行 `npm run typecheck`、`npm test`、`npm run build`。
- Parser 变更执行 `python3 -m unittest discover -s tests/parsers -v`。
- 需要 synthetic Web 数据时，按现有 CI 命令生成 `web/public/game-data`；生成器拒绝覆盖已存在目录。确认目标目录不存在后再运行。
- 运行 Chromium E2E 前确认浏览器已安装；CI 现有安装命令见 harness 操作索引。
- 涉及资源 manifest 时才执行 `npm run resource-manifest:verify`；生成命令会写文件，不作为通用 Doctor 步骤。
- 环境不可用、命令未执行或产物无法读取时，状态写 `NOT_RUN`，不得推断通过。

### Drive — 按 Feature Map 操作

1. 只沿 Feature Map 记录的真实到达路径驱动功能。
2. 每个关键动作之后读取对应 runtime snapshot，并执行该 Feature 的 assertion ID。
3. 使用仓库现有且经源码核实的 Playwright 操作杆；先检查其 webdriver 门控、参数边界和前置状态。
4. acceptance fixture 只用于自动化验收，不得当作普通玩家操作或原版行为证据。
5. 若实际 UI 路径、地图、NPC、遭遇、返回位置与 Feature Map 不一致，停止该 Feature 并记录偏差；不要临时修改预期来迁就实现。
6. 若 #3 的第一章操作杆缺失，遵守 Launch 中的 BLOCKED 条件；不得伪造运行状态宣布通过。

### Evidence — 生成证据束

每个提交至少记录：

- request-id、仓库、分支、基底 SHA、被测提交完整 SHA。
- Feature ID、变更文件和实际运行环境。
- 每条命令的完整命令文本、工作目录、退出码、结果和被测 SHA。
- typecheck、unit、build、E2E、parser、soak 的实际状态；不适用项标明原因。
- 断言 ID 总数、实际执行数、PASS/FAIL/SKIP/BLOCKED 数；测试用例数不能冒充断言数。
- 截图文件名、Feature ID、检查点、真实/synthetic 属性和 SHA-256。
- Playwright JSON、失败 trace、控制台/page error、关键状态快照。
- 来源证据等级、来源哈希、已知缺口和总管待核事项。

截图必须对应真实测试步骤。若测试只产生 synthetic 截图，证据束中明确标为 synthetic。证据文件先上传到获准的 CI artifact/私有证据位置并核验可读，再执行 Cleanup。

### Cleanup — 清理与交接

1. 确认浏览器、preview server 和其他测试进程已结束。
2. 先保存并校验截图、JSON、trace、日志和 SHA-256 清单，再清理临时文件。
3. 不提交依赖目录、合成资源包、测试结果或私有资源；当前忽略路径见 harness 操作索引。
4. 检查最终文件清单，确认没有超出授权范围的文件变化。
5. 提交证据束并明确列出 BLOCKED、NOT_RUN、FAIL 和未核实项。
6. 未获总管授权，不开 PR、不合并、不修改 main、不删除分支。

## 4. 交卷状态裁定

- `PASS`：所有必需断言均已执行并通过；必要截图/状态快照可读；提交 SHA 一致；没有阻塞绑定。
- `FAIL`：已执行的必需断言失败，或实际结果与 Feature Map 预期不符。
- `BLOCKED`：关键绑定、操作杆、权限或环境前置条件缺失，无法可靠执行。
- `NOT_RUN`：测试或证据尚未执行/采集。
- `PARTIAL`：仅部分独立 Feature 通过；不得提升整条主链状态。

整条第一章主链只有在 Feature Map 中所有必需 Feature 均通过、#3 证据经总管验收、且总管独立读回一致后，才可申请整体通过。

## 5. 标准交卷摘要

交卷正文至少包含：

1. request-id、仓库、分支、基底 SHA、提交 SHA。
2. Feature ID 与本次覆盖范围。
3. 实际运行命令、工作目录、退出码和结果。
4. 测试用例与断言计数，分别列出。
5. 截图/日志/trace/JSON 清单及 SHA-256。
6. 来源等级与运行状态，分别列出。
7. BLOCKED、NOT_RUN、FAIL 和其他已知缺口。
8. 工人自检结论；注明仍需总管独立读回的内容。

本技能不因文件已写入仓库而自动安装；未安装时必须在 Worker 提示词中显式引用本文件路径。
