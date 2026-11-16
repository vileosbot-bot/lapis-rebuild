# P0-1 机器门禁规则

- request-id：agent-7x24-p01-gate-20261116-01
- 仓库：vileosbot-bot/lapis-rebuild
- 基线：main@5fbf1679367142b358b8d6ac3a0f288dc33d24b2
- 实施分支：feat/agent-ops-gate-20261116
- 运行方式：试运行参考模式，不启用必需检查分支保护，不自动合并。

## 1. 状态语义

| 状态 | 含义 | 是否可视为通过 |
| --- | --- | --- |
| PASS | 该项实际执行且通过 | 是 |
| FAIL | 实际失败、超时或检测到不符合规则 | 否 |
| UNKNOWN | CI/API 不可用、步骤未执行、依赖缺失或结果无法读回 | 否 |
| NOT_RUN | 尚未执行；汇总时按 UNKNOWN 处理 | 否 |

总体裁定顺序：任一 FAIL → 未通过；否则任一 UNKNOWN/NOT_RUN → 门禁未知；只有八项均 PASS 才显示通过。取消、超时、步骤跳过不能被折算为 PASS。

workflow 触发集合：push（分支 `codex/**`、`feat/ch1-m73-wild-encounters`，且须命中 paths 过滤）；pull_request（目标分支 main）；workflow_dispatch（手动触发）。synthetic job 在汇总后读取 summary.json，只有 overall=PASS 才以退出码 0 结束；FAIL/UNKNOWN/缺失均退出码 1，因此非 PR 事件也会保留失败信号。

## 2. 八项门禁

| # | 门禁 | 执行内容 | 单项超时 | 失败证据 |
| --- | --- | --- | ---: | --- |
| 1 | 单元测试 | Python parser unittest 与 web/package.json 的 npm test | 5 / 10 分钟 | 测试框架输出测试文件、断言位置；无法解析时由门禁汇总给出回退定位 |
| 2 | 构建 | npm run build，并验证 M7.3 synthetic fixture 构建 | 10 / 8 分钟 | TypeScript/Vite 原生诊断；回退定位 web/vite.config.ts |
| 3 | 类型检查 | npm run typecheck | 5 分钟 | TypeScript 文件、行、列；回退定位 web/tsconfig.json |
| 4 | 格式检查 | git diff --check 检查新增行行尾空白；检查变更文本文件的混合换行和末尾换行，新文件全量检查行尾空白 | 3 分钟 | 精确到变更文件和行号 |
| 5 | 静态检查 | 对变更 Python 文件执行 AST 解析；核验 web-ci.yml 的 PR 触发、门禁步骤超时、Action SHA 固定、gate-finalize 步骤存在及禁止另建 ci.yml | 3 分钟 | 精确到 Python 文件/行；工作流结构错误定位到 web-ci.yml 对应行 |
| 6 | 敏感信息扫描 | 扫描 PR 新增行中的常见云密钥、GitHub token、Slack token、私钥块和凭据赋值 | 3 分钟 | 精确到文件和新增行号 |
| 7 | 截图与 E2E | 单一聚合行：截图、Chromium E2E、M7.3 E2E、S41 E2E、Playwright 安装、独立预览、M7.3 夹具七项；S41 按分支条件可不执行，跳过显示“不适用”且不计为 PASS；其余适用状态共同决定聚合结果 | E2E 25 分钟；截图 5 分钟 | 评论在该行下方逐项列出七个子状态；浏览器错误、失败测试文件/行及截图格式错误定位到具体文件 |
| 8 | GitHub 独立读回 | 用 Actions token 从 GitHub API 读回 PR head/base、PR 文件清单、合并 PR 集合及审查台账；与本次 checkout 的 Git diff 对照 | 3 分钟 | 不一致为 FAIL；API 不可用为 UNKNOWN，绝不当作 PASS |

第 7 项保持一个聚合门禁行，不拆成多个门禁；聚合状态由适用的子状态共同决定。S41 按分支条件跳过时标记为 NOT_APPLICABLE（评论显示“不适用”），不折算为 PASS，也不参与聚合；若 S41 应执行却没有结果，则标记 UNKNOWN。评论必须在“截图与 E2E”行下方列出：截图、Chromium E2E、M7.3 E2E、S41 E2E、Playwright 安装、独立预览、M7.3 夹具。

依赖安装、synthetic fixture 生成、Chromium 安装也分别设有步骤超时。完整 Chromium E2E 采用 25 分钟上限；如果 Playwright 因超时留下 4173 端口的 preview server，后续 M7.3 E2E 与截图自检会先清理该端口，避免把残留进程误判为新的测试失败。整个 synthetic job 有总超时；总超时或未到达的检查均不能显示为通过。

### 失败定位规则

1. 单元测试、类型检查、构建和 E2E 优先保留工具原生诊断；运行器会解析常见文件/行号并生成 GitHub annotation。
2. 格式、静态和敏感信息检查由 tools/gate/check_gate.py 直接输出 file 与 line。
3. 对无源码定位的工具失败，汇总器必须给出对应门禁配置/入口文件及行号作为回退定位，同时保留原始日志；不得编造更具体的源码位置。
4. 超时、取消、步骤跳过都要在 PR 汇总中显示 FAIL 或 UNKNOWN，并给出日志/配置定位。

## 3. 改动清单输出

每次 PR 汇总至少包含：
- 文件路径、变更状态、增加行数、删除行数；
- 八项门禁状态及整体状态；
- “截图与 E2E”聚合行及其七个子状态；
- PR 的 base/head SHA 与 GitHub API 读回结果；
- 审查等级（绿/黄/红）及对应下一步；
- 九项反向测试的汇总状态。逐项输出只保留在 Actions 日志与 artifact，不写入 PR 评论；PR 评论展示八项聚合状态，并在“截图与 E2E”行下方列出七个子状态。

PR 评论由独立 gate-comment job 在 synthetic job 结束后写回，使用 artifact 传递 summary.md；该 job 仅授予 issues:write，不 checkout、不执行 PR 脚本。synthetic job 只读（contents:read），不授予 actions:read 或写权限；静态检查对两个 job 的 permissions 映射做精确集合比较，任何额外权限（包括额外 write）均失败。评论只更新作者为 github-actions[bot] 且包含固定标记的评论；不接管人工评论。评论 job 使用 if: always()，当 synthetic job 超时、失败或未上传 summary artifact 时，在成功读回当前 PR head 的前提下写回“门禁未知”，避免遗留旧的“通过”评论。被新提交取代的旧 head 运行会先读回当前 PR head 并跳过写回。若读取当前 PR head 的 GitHub API 请求本身失败，prepare 步骤会因 set -e 退出，写回步骤被跳过、finalize 失败，可能遗留旧评论；此情形列入试运行调优清单，后续需补足安全 fallback。评论 API 写入失败或权限不足时，评论 job 失败，PR 门禁不能显示通过。Actions Job Summary 和 web-synthetic-validation artifact 同时保留运行证据。

## 4. 敏感扫描边界

扫描使用 `git log -p base..head` 逐个检查提交历史中的新增行；即使密钥在后续提交中被删除，早先提交仍会被扫描。规则覆盖常见 AWS Access Key、GitHub classic/fine-grained token、Slack token、PEM 私钥头，以及带引号和无引号的高风险凭据赋值。

经总管批准，当前仅有四笔一次性历史误报排除，且每笔都必须同时匹配完整提交 SHA、文件路径 `tools/gate/check_gate.py` 和原始新增行 SHA-256：

1. `e4a4b5d9db8e095251d817ea9c0c2c0dd7ab16a9`：四条合成示例，分别为 PGP 私钥块头标记、ENCRYPTED 私钥头标记、DSA 私钥头标记、API_KEY 无引号赋值合成值；该提交使用外层单引号包裹的样例行写法。
2. `0522d7944d395674213f0b63e7feec2dc291be50`：同一批四条合成示例，使用四空格缩进及双引号样例行写法。
3. `779084fa369c5efbdf84d168d7b5892eef00b0c0`：同一批四条合成示例，使用八空格缩进及双引号样例行写法。
4. `f90c4ce2bc44997743bdd032543382b25cf1a1a4`：`test_secret_scan_commit_history` 内一条 DB_PASSWORD 合成赋值样例；原始新增行 SHA-256：`65ec8d91f00e3cd64d4f831f5d31299273d7fa1da3f0a1c0de800c784bd2a7a4`。

核实经过：前三笔由总管逐笔检查完整 GitHub commit patch 并复跑逐提交扫描，每笔恰好四条命中；第 4 笔由总管核对完整提交 SHA、文件路径和原始新增行 SHA-256，确认该行位于 `test_secret_scan_commit_history`，是合成测试样例而非真实凭据。当前 HEAD 的对应测试文本已改为动态拼接；反向测试重建原始新增行并断言其 SHA-256 精确等于上述值。前三笔共十二条、第 4 笔一条，合计十三条合成测试夹具；均非真实凭据，没有泄露风险，不需要轮换凭据。实现以完整 SHA、精确文件路径和每条原始新增行的 SHA-256 三重匹配；短 SHA、其他路径、其他提交中即使出现相同文字也不得排除，必须继续 FAIL。排除清单固定为上述四笔；任何新增排除都必须先取得总管明确批准，未经批准不得增加。

它是防误提交的启发式扫描，不等于完整 DLP，也不能保证识别任意编码、拆分或未知厂商密钥。命中即 FAIL；不命中只表示本规则未发现，不表示文件绝对无敏感信息。

## 5. 截图自检边界

截图来自当前 PR 的 production build 和 synthetic 测试数据，不是原版美术资源验收。自检验证页面可启动、canvas 可见、页面错误/横向溢出检查和 PNG 文件结构；不替代人工视觉审查，也不把 synthetic 截图包装成真实玩法证据。遵循 lapis-verification 的来源证据与运行状态分离规则。

## 6. GitHub 读回与参考模式

- PR 事件必须读回 PR 当前 head SHA、base ref/base SHA、状态和 changed files；与本次 checkout 的提交及 diff 文件集合逐项比较。
- 审查台账通过 GitHub API 的 pulls?state=closed&base=main 读取已合并 PR，逐项比较 PR 编号、merged_at 和 merge_commit_sha；台账解析跳过 fenced code block 与 HTML 注释。
- 当前读回按 main 的全部已合并 PR 做全局集合比较。因此，任何其他 PR 一旦合并、但台账尚未同步追加对应记录，后续 PR 的读回都会 FAIL。这是当前台账设计的已知耦合，本批接受并如实记录，后续再改为增量/冻结基准方案。
- 若 PR 修改 .github/workflows/** 或 tools/gate/**，机器分类强制红灯；PR 评论明确标注“本 PR 修改了门禁自身，结果不可信”。当前 CI 仍运行 PR 自己提交的 workflow/script，不能视为独立验证；长期方案是从可信 base SHA 获取并运行门禁脚本，本批仅记录、不实施可信脚本加载器。
- API 403、429、5xx、网络超时、读回结果缺失均标记 UNKNOWN；对象明确不一致标记 FAIL。
- 当前只提供检查结果、PR 评论和审查建议。没有修改 branch protection/ruleset，不把本检查设为必需状态，不自动合并。PR 缺少检查结果时，操作者必须按“门禁未知”处理，不能推断通过。

## 7. 九项反向测试

由 check_gate.py self-test 在 PR CI 中运行。九项测试是函数级/临时 Git 仓库级反向测试，不是九个独立 GitHub 测试 PR；逐项输出保存在 Actions 日志与 artifact。PR 评论显示八项聚合状态，并在“截图与 E2E”行下方列出七个子状态。review_decision() 目前仅是函数级策略判断，未接入 workflow，也不会生成 BLOCKED 状态；审查等级与盲审要求仍须由人工按审查阶梯执行。

| # | 反向场景 | 必须得到的结果 |
| --- | --- | --- |
| 1 | 单元测试失败 | 单元测试 FAIL，总体未通过 |
| 2 | 新增行含模拟密钥 | 敏感信息扫描 FAIL，并给出行号 |
| 3 | 新增行含行尾空白 | 格式检查 FAIL，并给出行号 |
| 4 | 八项全部通过且变更仅为少量文档 | 总体 PASS，建议等级为绿灯 |
| 5 | 单项超时 | 超时归 FAIL，不能被当作跳过或通过 |
| 6 | CI/API 不可用或结果缺失 | 状态 UNKNOWN，显示“门禁未知” |
| 7 | 红灯 PR 没有 Opus 盲审、权限集合有额外写权限或 workflow 缺少 gate-finalize | 函数级 review_decision() 返回 merge_allowed=false；精确权限断言拒绝额外权限；workflow 必须存在唯一的 Finalize machine gate status 步骤且含 id: gate-finalize、if: always()、1 分钟超时 |
| 8 | 绿灯 PR 没有子代理盲审 | reviewed=false，不得标记“已审查通过”；本项只调用 review_decision() 策略函数 |
| 9 | 审查台账 PR 集合/行数与已合并 PR 集合不一致 | 校验失败；一致才通过 |

第 8 项只验证 review_decision() 的策略函数，不调用评论写回代码，也不测试 GitHub 评论 API；PR 评论实际由 web-ci.yml 的独立 gate-comment job 使用 gh api 实现。第 7 项同时验证红灯/Opus 缺失策略、额外写权限反向断言，以及实际 workflow 中唯一的 `Finalize machine gate status` 步骤（`id: gate-finalize`、`if: always()`、1 分钟超时）存在；静态检查函数 `static_check()` 也要求该步骤 ID 存在并检查其超时。它们不代表 workflow 已接入 Opus/子代理盲审，更不是 GitHub branch protection 技术锁。试运行阶段仍由负责人遵守不得合并/不得标记审查通过的规则。Python 中未被 workflow 调用的 find_bot_comment/post_comment/finalize 函数及对应 CLI 子命令已删除。


## 8. 试运行调优清单（暂缓）

以下事项明确留待后续处理，本 PR 不改游戏代码或既有 E2E 测试：

- M7.3 金币断言是既有测试写法问题：`web/e2e/ch1-wild-encounters.spec.ts` 第 263/265 行检查胜利后的玩家总金币绝对值 40，而新角色初始金币为 20,000；奖励 40 后总额 20,040。应另行把测试改为奖励增量/胜利前后差值断言；本 PR 不修改游戏逻辑、该测试或结算代码。
- main 的 `.github/workflows/web-ci.yml` 在 Chromium E2E 失败后会跳过后续步骤；基线文件中 Chromium 步骤位于第 50 行，M7.3 synthetic fixture、preview build、E2E 分别位于第 62、66、69 行。main 的 Chromium 步骤没有 `continue-on-error`，后续步骤默认受失败传播影响；跨运行基线比较必须把 SKIPPED/NOT_RUN 与实际 PASS/FAIL 分开，不得把跳过当通过。
- 凭据规则的已知误报：把 `api_key` 赋值为 `settings.API_KEY_VALUE` 的代码表达式可能被无引号分支误报。误报按 fail-safe 处理，本 PR 不放宽规则。
- API 读 PR head 失败时，prepare 步骤会因 set -e 退出，后续无法写回“门禁未知”；需研究读不到 head 时使用事件中的 PR/base/head 安全写回 UNKNOWN 的方式。
- `git log -p` 默认不输出 merge commit 的 diff；后续评估使用 `--cc` 或 `-m` 补足合并提交扫描。
- `touches_gate_self()` 目前只检查 filename；改名移出门禁目录时应同时检查 GitHub changed-file 的 `previous_filename`。
- `format_check()` 的 subprocess.run 尚未显式指定 `encoding="utf-8", errors="replace"`；后续统一解码行为。
- 逐项反向测试结果已由 Run #95（HEAD `d5c5c46288c1cdcae63259ed74bdbcc0a24a3b38`）的 `web-synthetic-validation` Artifact #14192880317 实际下载核实：ZIP 内含 `_temp/agent-ops-gate/reverse-tests.log`，逐项九条 PASS；该项核验闭环，后续运行继续保留此日志。
- 门禁长期红问题：main 基线已存在 9 项 Chromium E2E 失败及 M7.3 金币绝对值断言问题；须另行修复既有测试或由负责人批准明确的既有失败基线比较机制，不能通过把失败/跳过改写为 PASS 解决。

## 9. 本轮基线证据与裁定

- PR #20 的 base..head compare 只包含六个文件：本 workflow、check_gate.py 和四份 agent-ops 文档；没有 `web/e2e/`、`web/src/` 游戏测试或逻辑文件。
- main@5fbf1679 与 PR #20 HEAD 上，`web/e2e/ch1-wild-encounters.spec.ts`、`web/src/m4-runtime-integration.ts`、`web/src/world/ch1-wild-encounter-settlement.ts` 的 Git blob SHA 分别相同：`24e98fac94f3090457f1f887cbbed8915d158694`、`83d3833908092de568e8f0afc5b36b87f818a770`、`ca598126936088596f9aab02bb62760326f84071`。测试第 263 行取得胜利后的完整玩家状态，第 265 行断言 `won.gold == 40`；M4 runtime 第 163 行新角色初始金币为 20,000；结算代码第 43 行奖励金币为 40。20,000 + 40 = 20,040，问题是测试用总余额绝对值断言，不是奖励结算错误。
- Run #43772129471（PR #20 HEAD 176c9ce3）Chromium 九项失败，与 PR #21 Run #43777684072 的 Chromium 九项失败按测试名一致。main@5fbf1679 的 `.github/workflows/web-ci.yml` 中 Chromium 步骤为第 50 行，M7.3 fixture/build/E2E 分别为第 62/66/69 行；Chromium 步骤没有 `continue-on-error`，失败后续步骤跳过。PR workflow 中 Chromium 步骤位于第 105–113 行并设置 `continue-on-error: true`，M7.3 E2E 位于第 139–151 行且只依赖 M7.3 build 与 Playwright 安装，因此 Chromium 失败后仍会执行。PR #21 Run #43777684072 的 M7.3 E2E 为 SKIPPED，PR #20 Run #43772129471 的 M7.3 E2E 为 FAIL；两种状态是执行路径不同，不是 PASS/FAIL 基线差异。按相同源文件 Blob SHA 证据，M7.3 是 main 已存在的测试写法问题，不是 PR #20 引入的新失败。SKIPPED 不代表 PASS。
