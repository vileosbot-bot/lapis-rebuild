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

## 2. 八项门禁

| # | 门禁 | 执行内容 | 单项超时 | 失败证据 |
| --- | --- | --- | ---: | --- |
| 1 | 单元测试 | Python parser unittest 与 web/package.json 的 npm test | 5 / 10 分钟 | 测试框架输出测试文件、断言位置；无法解析时由门禁汇总给出回退定位 |
| 2 | 构建 | npm run build，并验证 M7.3 synthetic fixture 构建 | 10 / 8 分钟 | TypeScript/Vite 原生诊断；回退定位 web/vite.config.ts |
| 3 | 类型检查 | npm run typecheck | 5 分钟 | TypeScript 文件、行、列；回退定位 web/tsconfig.json |
| 4 | 格式检查 | git diff --check 检查新增行行尾空白；检查变更文本文件的混合换行和末尾换行，新文件全量检查行尾空白 | 3 分钟 | 精确到变更文件和行号 |
| 5 | 静态检查 | 对变更 Python 文件执行 AST 解析；核验 web-ci.yml 的 PR 触发、门禁步骤超时、Action SHA 固定及禁止另建 ci.yml | 3 分钟 | 精确到 Python 文件/行；工作流结构错误定位到 web-ci.yml 对应行 |
| 6 | 敏感信息扫描 | 扫描 PR 新增行中的常见云密钥、GitHub token、Slack token、私钥块和凭据赋值 | 3 分钟 | 精确到文件和新增行号 |
| 7 | 截图自检 | 现有 Chromium E2E + production preview 冒烟；确认 canvas 可见、页面无 pageerror/横向溢出，生成并校验 PNG | E2E 25 分钟；截图 5 分钟 | 浏览器错误、失败测试文件/行；截图格式错误定位到截图文件 |
| 8 | GitHub 独立读回 | 用 Actions token 从 GitHub API 读回 PR head/base、PR 文件清单、合并 PR 集合及审查台账；与本次 checkout 的 Git diff 对照 | 3 分钟 | 不一致为 FAIL；API 不可用为 UNKNOWN，绝不当作 PASS |

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
- PR 的 base/head SHA 与 GitHub API 读回结果；
- 审查等级（绿/黄/红）及对应下一步；
- 反向测试 1–9 的逐项结果。

GitHub PR 会收到带固定标记的门禁评论；重复运行更新同一条评论，不连续堆叠。被新提交取代的取消运行不写回评论，避免旧 head 覆盖新结果。若读回不可用，仍用事件中的 PR 编号/base/head 标识“门禁未知”。评论 API 写入失败或权限不足时，评论状态为 UNKNOWN，PR 门禁不能显示通过；日志保留 HTTP 状态与响应摘要。Actions Job Summary 和 web-synthetic-validation artifact 同时保留运行证据。

## 4. 敏感扫描边界

扫描只检查本次 diff 的新增行，不回扫整个历史仓库。当前规则覆盖常见 AWS Access Key、GitHub classic/fine-grained token、Slack token、PEM 私钥头和高风险凭据赋值。它是防误提交的启发式扫描，不等于完整 DLP，也不能保证识别任意编码、拆分或未知厂商密钥。命中即 FAIL；不命中只表示本规则未发现，不表示文件绝对无敏感信息。

## 5. 截图自检边界

截图来自当前 PR 的 production build 和 synthetic 测试数据，不是原版美术资源验收。自检验证页面可启动、canvas 可见、页面错误/横向溢出检查和 PNG 文件结构；不替代人工视觉审查，也不把 synthetic 截图包装成真实玩法证据。遵循 lapis-verification 的来源证据与运行状态分离规则。

## 6. GitHub 读回与参考模式

- PR 事件必须读回 PR 当前 head SHA、base ref/base SHA、状态和 changed files；与本次 checkout 的提交及 diff 文件集合逐项比较。
- 审查台账中的 PR 编号集合必须与 GitHub 当前已合并 PR 集合一致。
- API 403、429、5xx、网络超时、读回结果缺失均标记 UNKNOWN；对象明确不一致标记 FAIL。
- 当前只提供检查结果、PR 评论和审查建议。没有修改 branch protection/ruleset，不把本检查设为必需状态，不自动合并。PR 缺少检查结果时，操作者必须按“门禁未知”处理，不能推断通过。

## 7. 九项反向测试

由 check_gate.py self-test 在 PR CI 中运行；每次运行的真实输出保存在 Actions 日志和 PR 门禁评论中。

| # | 反向场景 | 必须得到的结果 |
| --- | --- | --- |
| 1 | 单元测试失败 | 单元测试 FAIL，总体未通过 |
| 2 | 新增行含模拟密钥 | 敏感信息扫描 FAIL，并给出行号 |
| 3 | 新增行含行尾空白 | 格式检查 FAIL，并给出行号 |
| 4 | 八项全部通过且变更仅为少量文档 | 总体 PASS，建议等级为绿灯 |
| 5 | 单项超时 | 超时归 FAIL，不能被当作跳过或通过 |
| 6 | CI/API 不可用或结果缺失 | 状态 UNKNOWN，显示“门禁未知” |
| 7 | 红灯 PR 没有 Opus 盲审 | merge decision 为 BLOCKED |
| 8 | 绿灯 PR 没有子代理盲审 | reviewed=false，不得标记“已审查通过” |
| 9 | 审查台账 PR 集合/行数与已合并 PR 集合不一致 | 校验失败；一致才通过 |

第 7 项的 BLOCKED 是审查策略裁定，不是当前 GitHub branch protection 的技术锁。试运行阶段仍由负责人遵守不得合并规则。
