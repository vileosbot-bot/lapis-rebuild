# Verification 小样使用说明（Adoption）

## 1. 目的与当前状态

本说明介绍如何在 \`vileosbot-bot/lapis-rebuild\` 的 Worker 任务中使用 Feature Map、\`lapis-verification\` 技能和 Evidence Bundle。它定义的是一套可重复执行的工作约定，不代表项目已经自动启用或所有功能已通过运行验收。

**当前小样状态（截至本文件提交）：**

- Batch 1：Feature Map Schema 与第一章主链草案，已由总管验收通过。
- Batch 2：\`lapis-verification\` 技能三件套，已由总管验收通过。
- Batch 3：Evidence Bundle Schema 与 B6 静态示例，已由总管验收通过。
- Batch 4：本使用说明 \`adoption.md\`，按批准范围新增，提交后等待总管验收。
- 四批交付均安排在分支 \`docs/verification-mvp\`，每批一个提交；前三批的总管验收结论均为通过。
- 本小样尚未开 PR、尚未合并 main，也尚未在真实开发任务上完整跑过一次 Launch → Cleanup 的端到端验证。
- \`ch1-auto3-binding.yaml\` 尚未创建；第一章主链绑定等待 #3 经总管验收通过后再做。

因此目前应称为**已完成文档/技能小样，待集成与真实任务试用**，不得描述为已经全面启用、自动安装或已证明可在所有 Worker 会话中自动触发。

## 2. 这套机制由哪几部分组成

### 2.1 Feature Map：定义验收对象

文件：

- \`docs/verification/feature-map.schema.md\`
- \`docs/verification/feature-map.ch1.yaml\`

Feature Map 对每项功能记录：

- 功能位置与源码/数据锚点。
- 从可复现起点到达功能的路径。
- 前置状态与预期观察结果。
- 稳定的 assertion ID。
- 截图、状态快照和日志要求。
- 来源证据等级、运行时状态及未解决绑定。

Feature Map 是“验收什么、怎么到达、什么证据算通过”的索引，不是功能已经实现的证明。未知路线、目标地图、NPC 正式实体、遭遇和胜利返回绑定必须显式标记 \`BLOCKED\` 或 \`NOT_RUN\`，不得推测填充。

### 2.2 Verification Skill：规定如何执行

技能目录：

- \`skills/lapis-verification/SKILL.md\`
- \`skills/lapis-verification/agents/openai.yaml\`
- \`skills/lapis-verification/references/harness-operations.md\`

技能按五段组织：

1. Launch：锁定仓库、提交、Feature 和启动条件。
2. Doctor：检查运行环境、依赖、构建和测试前置条件。
3. Drive：沿 Feature Map 的真实路径执行功能并核对断言。
4. Evidence：收集命令结果、断言、截图、日志、trace 和来源信息。
5. Cleanup：归档证据、清理临时产物并按统一格式交卷。

\`harness-operations.md\` 是现有命令、源码入口和 fixture 的索引。源码或命令发生变化时，必须重新读取当前仓库，不能把历史行号或 fixture 名称视为永久接口。

### 2.3 Evidence Bundle：统一交付证据

文件：

- \`docs/verification/evidence-bundle.schema.md\`
- \`docs/verification/evidence-bundle.example.b6.yaml\`

Evidence Bundle 将以下内容分开：

- 提交身份和逐文件 Git blob 指纹。
- 实际执行的命令及退出结果。
- 静态数据/源码核验。
- 网页或游戏运行验收。
- 测试用例数与断言数。
- 截图、日志、trace、CI artifact。
- 来源证据等级与未解决缺口。
- Worker 自检和总管独立审核。

静态核验通过不等于运行验收通过；来源证据等级也不因网页 E2E 通过而升级。

## 3. 以后每个 Worker 任务如何显式引用技能

### 3.1 技能安装边界

技能文件入仓不等于 ChatGPT 已自动安装或会自动加载它。除非已经通过独立安装流程确认该技能在当前会话可调用，否则每个 Worker 任务提示词都必须显式要求读取仓库文件。

### 3.2 建议加入 Worker 提示词的固定段落

将以下段落放入每个相关 Worker 任务提示词，并按任务实际范围替换 Feature ID：

> **Verification 要求：** 开始工作前，先读取并遵循 \`skills/lapis-verification/SKILL.md\`，并读取 \`skills/lapis-verification/references/harness-operations.md\`。同时读取 \`docs/verification/feature-map.schema.md\` 和 \`docs/verification/feature-map.ch1.yaml\`，找到本任务对应的 Feature ID；若没有对应条目，先报告并提出新增条目，不得自行编造通过标准。交卷时按 \`docs/verification/evidence-bundle.schema.md\` 提交完整 Evidence Bundle。静态核验与运行验收分开记录；所有未执行或未核实项显式标记。不得把 synthetic harness、训练任务或手工构造状态冒充真实功能验收。

对非第一章任务，可将 \`feature-map.ch1.yaml\` 替换为该任务对应的 Feature Map 文件；若目前没有，应先明确 Feature Map 缺口，而不是硬套第一章条目。

### 3.3 Worker 开工时必须确认

- 当前仓库、分支、基底 SHA 和 HEAD SHA。
- 本任务的 Feature ID 与允许修改的文件范围。
- 需要使用的测试环境及现有操作杆。
- 哪些验收前置条件依赖其他 Worker 或总管裁定。
- 证据要保存到哪里，以及哪些内容不能公开。

如果任务依赖第一章真实主链操作，而 #3 尚未提供第一章专用 acceptance spec/操作杆，或总管尚未验收确认，相关运行验收必须标记 \`BLOCKED\`。不得用 S14/M7 训练战斗、S18 synthetic harness 或自造 fixture 宣布第一章通过。

## 4. 总管验收时核对哪些内容

总管独立验收不应只看 Worker 的文字结论，应按提交 SHA 逐项核对：

1. **提交身份：** 仓库、分支、基底 SHA、父提交、提交 SHA 与分支 HEAD 是否一致。
2. **文件范围：** commit changed-files 是否与授权清单一致；是否出现未批准的修改、删除或额外文件。
3. **文件指纹：** 每个文件的行数、Git blob SHA 与连接器独立读回是否一致。Git blob SHA-1 不得冒充文件内容 SHA-256。
4. **Feature Map：** 位置、到达路径、预期状态、断言 ID 和截图要求是否可执行；未知绑定是否明确标为 \`BLOCKED\`/\`NOT_RUN\`。
5. **操作杆：** 命令、源码入口、fixture 名称、webdriver 门控、参数边界和测试前置条件是否与当前仓库一致。
6. **命令结果：** 完整命令、工作目录、退出码、实际测试提交 SHA；未运行、跳过、失败和无历史记录必须区分。
7. **计数口径：** 测试用例数与 Feature assertion ID 数分开；不能用测试用例数代替断言数。
8. **截图与日志：** 文件是否真实可读、是否属于被测提交、截图是真实浏览器还是 synthetic harness；检查 JSON、trace、pageerror 和 console error。
9. **来源纪律：** ybcs-offline 来源只能是 \`RECOVERED_SECONDARY\` 或 \`INFERRED\`；静态来源等级不能因运行测试通过而升级。
10. **运行验收：** 对应 Feature 是否走真实到达路径、断言是否全部执行通过、运行状态是否与证据一致。
11. **缺口与边界：** BLOCKED、NOT_RUN、NOT_RECORDED、FAIL 是否保留；是否遵守不运行原版客户端、不公开部署和不越权修改的约束。

总管最终裁定必须独立记录。Worker 的 \`PASS\` 或 \`STATIC_ONLY\` 不能替代总管批准。

## 5. 第一章绑定文件为何暂缓

预留文件：

\`docs/verification/ch1-auto3-binding.yaml\`

该文件本轮不创建，原因是第一章端到端验收仍由 #3（auto-3-1，分支 \`test/ch1-e2e-acceptance\`）负责。必须先由 #3 提供实际 acceptance spec、真实操作杆、断言与证据，并经总管独立验收通过，才能把真实 spec 路径、提交 SHA、Feature 对应关系和证据清单写入绑定文件。

在此之前：

- 不引用 #3 开发中的临时结果作为已通过证据。
- 不复制或修改 #3 的 spec、fixture 或 runtime 文件。
- 不猜测路线 ID、目标地图、NPC 正式实体、遭遇 ID 或胜利返回记录。
- Feature Map 中相关绑定继续保持 \`BLOCKED\`/\`NOT_RUN\`。
- S14/M7 训练验收和 S18 synthetic harness 只作为现有 harness 参考，不能替代第一章主链。

等 #3 通过总管验收后，再单独批准并新增 \`ch1-auto3-binding.yaml\`；该文件只建立引用关系，不复制 #3 的实现。

## 6. Verification Skill 的维护方式

技能维护应与功能 Feature Map、Evidence Bundle 和运行时代码修改分开。

需要更新技能时：

1. 先读取当前分支 HEAD 和 \`skills/lapis-verification/\` 下全部现有文件。
2. 重新核实需要更新的命令、源码入口、fixture、状态规则或证据要求。
3. **只修改 \`skills/lapis-verification/\` 目录内的文件**：通常是 \`SKILL.md\`、\`agents/openai.yaml\` 或 \`references/harness-operations.md\`。
4. 不把无关 Feature Map、Evidence Bundle、应用代码或测试文件混入技能维护提交。
5. 单独创建一个清晰的技能维护提交，记录父提交、改动文件、行数和每个文件的 Git blob SHA。
6. 由总管独立读回并审核后再使用新版本；若技能尚未安装，Worker 仍须显式引用仓库路径。

如果需要修改 Feature Map Schema 或 Evidence Bundle Schema，应分别按其自身文档变更任务处理，不应借“技能维护”名义混入技能目录提交。

## 7. 当前小样的启用限制与后续建议

当前四批交付的目标是建立文档、技能规范和证据格式。前三批已经总管逐批验收通过；本文件为第四批，提交后等待总管验收。即使四批全部验收通过，也仍不代表已经开 PR、合并 main、自动安装 Skill 或完成真实任务试用。

建议后续由总管决定是否开 PR 合并。合并后再选择一个真实、范围明确的 Worker 任务，首次完整执行：

\`Launch → Doctor → Drive → Evidence → Cleanup\`

试用时记录实际 Worker 是否能按显式引用找到技能、能否使用现有 harness、Evidence Bundle 是否能被总管独立读回，以及是否需要修订 Schema。真实试用通过前，应继续称其为“已合并的验证规范/技能小样”，不称为“已全面启用的项目验收系统”。
