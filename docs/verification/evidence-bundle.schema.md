# Evidence Bundle Schema

## 1. Purpose

Evidence Bundle 是每个 Worker 交卷时提交的统一证据索引。它把提交身份、静态核验、运行验收、命令结果、断言、截图、日志、来源等级和未解决缺口分开记录，使总管能够按同一提交 SHA 独立复核。

本规范不要求每个任务都运行所有测试。它要求每个适用检查都有明确结果；不适用、未执行、没有历史记录和被阻塞必须使用不同状态，不得用空字段暗示通过。

## 2. 顶层字段

Evidence Bundle 使用 YAML，顶层字段如下：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| \`schema_version\` | integer | 是 | 当前为 \`1\` |
| \`bundle_id\` | string | 是 | 本证据束的稳定 ID |
| \`request_id\` | string | 是 | 原任务编号；无可核实记录时写 \`NOT_RECORDED\` |
| \`repository\` | string | 是 | \`owner/repo\` |
| \`revision\` | object | 是 | 分支、基底、提交、父提交和被测版本 |
| \`scope\` | object | 是 | 任务类型、Feature ID 和交付范围 |
| \`changed_files\` | array | 是 | 逐文件路径、状态、行数与 Git blob SHA |
| \`environment\` | object | 是 | 实际执行环境；未知字段明确标记 |
| \`command_execution\` | object | 是 | 命令清单与执行状态 |
| \`static_verification\` | object | 是 | 静态数据/源码核验 |
| \`runtime_acceptance\` | object | 是 | 浏览器/游戏运行验收 |
| \`test_summary\` | object | 是 | 测试用例数与断言数，分开统计 |
| \`screenshots\` | object | 是 | 截图清单及真实性/哈希 |
| \`logs_and_artifacts\` | object | 是 | 日志、trace、JSON、CI artifact |
| \`provenance\` | array | 是 | 来源、哈希类型、证据等级和运行边界 |
| \`known_gaps\` | array | 是 | 未核实项、阻塞项和解除条件 |
| \`worker_verdict\` | string | 是 | Worker 对本次交付的结论 |
| \`manager_review\` | object | 是 | 总管独立读回与裁定；尚未审核时写明 |

## 3. Revision 与文件指纹

### 3.1 Revision

\`revision\` 至少记录：

- \`branch\`：实际交付分支。
- \`base_commit_sha\`：本次工作开始时的完整 40 位 SHA。
- \`commit_sha\`：交付提交的完整 40 位 SHA。
- \`parent_commit_sha\`：该提交的父提交完整 SHA。
- \`tested_commit_sha\`：测试实际针对的提交；没有运行测试时写 \`NOT_RUN\`。
- \`observed_main_head_sha\`：若记录主线基线，写明读取时的完整 SHA 和读取时间；未读取时写 \`NOT_RECORDED\`。

不得只写短 SHA 作为唯一身份。报告中可用短 SHA 辅助展示，但证据束保留完整值。

### 3.2 Changed Files

每个文件至少记录：

- \`path\`
- \`change_status\`：\`added / modified / deleted / renamed\`
- \`line_count\`：按 LF 换行符计数（等同于该文件的 \`wc -l\` 口径；不要把末尾换行后的空 split 项多算一行）
- \`git_blob_sha\`：Git blob SHA-1，完整值
- \`commit_additions\`、\`commit_deletions\`：可从提交 diff 读取时填写；未读取写 \`NOT_RECORDED\`

Git blob SHA-1 与文件内容 SHA-256 是不同指纹，必须分别命名，不得互换。若任务需要内容 SHA-256，应对实际文件字节计算并记录；没有实际字节时写 \`NOT_AVAILABLE\`，不得从 blob SHA 推导。

## 4. Command Execution

\`command_execution\` 包含：

- \`status\`：\`RECORDED / NOT_RECORDED / NOT_RUN / BLOCKED\`
- \`commands\`：数组；每项记录完整命令、工作目录、退出码、结果和被测提交 SHA。

每条命令至少包含：

| 字段 | 说明 |
|---|---|
| \`command\` | 完整命令文本，不用含糊的“运行测试”代替 |
| \`working_directory\` | 仓库内工作目录或明确路径 |
| \`exit_code\` | 整数；未执行/无记录时使用显式状态，不填虚构数字 |
| \`result\` | \`PASS / FAIL / SKIP / NOT_RUN / NOT_RECORDED / BLOCKED\` |
| \`tested_commit_sha\` | 命令运行所针对的完整提交 SHA |
| \`notes\` | 运行环境、重试、限制或失败摘要 |

状态含义：

- \`NOT_RUN\`：明确没有执行。
- \`NOT_RECORDED\`：历史资料没有记录是否执行，不能推断执行或未执行。
- \`BLOCKED\`：因前置条件缺失无法执行。
- \`SKIP\`：测试运行器实际报告跳过，必须附原因。

## 5. Static Verification 与 Runtime Acceptance 必须分开

这是本规范的核心要求。静态数据核验通过不能自动变成运行验收通过；运行时 E2E 通过也不能升级来源证据等级。

### 5.1 Static Verification

\`static_verification\` 至少包含：

- \`status\`：\`PASS_RECORDED / FAIL_RECORDED / PARTIAL_RECORDED / NOT_RUN / NOT_RECORDED / BLOCKED\`
- \`basis\`：\`repository_audit / source_review / reproducible_command / independent_readback / mixed\`
- \`checks\`：逐项检查 ID、检查对象、预期值、实际值、结果及引用位置。
- \`independent_replay\`：总管或 Worker 是否重新执行静态核验；必须单独记录。
- \`notes\`：边界与解释。

\`PASS_RECORDED\` 表示仓库内已有审计记录明确记载静态检查通过；它不表示本次交卷者重新运行了命令。若未重放，\`independent_replay.status\` 必须为 \`NOT_RUN\`。

### 5.2 Runtime Acceptance

\`runtime_acceptance\` 至少包含：

- \`status\`：\`PASS / FAIL / PARTIAL / NOT_RUN / BLOCKED\`
- \`runtime_status\`：与 Feature Map 使用同一状态值。
- \`environment_kind\`：\`synthetic / private_original / production_preview / other / NOT_RUN\`
- \`tested_commit_sha\`
- \`feature_results\`：每个 Feature 的状态和证据引用。
- \`notes\`

数据整理、静态资源导出或策略校验任务，若没有真实浏览器/游戏运行证据，\`runtime_status\` 必须是 \`NOT_RUN\`，即使静态核验已经通过。

### 5.3 测试用例数与断言数

不得把测试用例数、断言调用数、Feature 断言 ID 数混为一谈。

分别记录：

- \`test_cases.total / passed / failed / skipped / not_run\`
- \`assertions.total / executed / passed / failed / blocked / not_run\`

若历史资料没有计数，整个计数项的 \`status\` 写 \`NOT_RECORDED\`。如果任务没有运行时验收，断言执行数应为 0，\`runtime_status\` 仍为 \`NOT_RUN\`。

静态核验项放在 \`static_verification.checks\`，不计入网页 E2E assertion 数。

## 6. Screenshots、Logs 与 Artifacts

### 6.1 Screenshots

\`screenshots\` 至少包含 \`status\` 和 \`items\`。每张图记录：

- \`filename\`
- \`feature_id\` 或明确的静态核验用途
- \`capture_point\`
- \`image_kind\`：\`real_browser / synthetic_harness / NOT_APPLICABLE\`
- \`sha256\`：真实文件字节 SHA-256；未取得文件时写 \`NOT_AVAILABLE\`
- \`artifact_location\`
- \`status\`：\`CAPTURED / NOT_RUN / BLOCKED\`

使用 \`page.setContent()\` 构造的 synthetic 截图必须标记 \`synthetic_harness\`，不能证明真实游戏场景、地图、NPC 或玩法。

### 6.2 Logs and Artifacts

至少记录：

- Playwright JSON reporter 路径与可读性。
- 失败 screenshot / trace。
- 浏览器 pageerror 与 console error。
- 关键 runtime state snapshot。
- CI artifact 名称、run ID、保留期限和读取状态（如适用）。

未采集的文件写 \`NOT_RUN\`；历史资料没有记录写 \`NOT_RECORDED\`。不要编造文件路径、artifact ID 或 SHA-256。

## 7. Provenance 与证据等级

每个来源项至少记录：

- \`source_project\`
- \`source_artifact\`
- \`source_locator\`
- \`fingerprint_type\`：\`git_blob_sha1 / sha256 / other / NOT_RECORDED\`
- \`fingerprint\`
- \`fingerprint_origin\`：实际文件字节、仓库元数据、审计记录等
- \`raw_source_in_repository\`：\`true / false / NOT_RECORDED\`
- \`evidence_level\`
- \`runtime_verified\`

允许的来源证据等级：

- \`VERIFIED\`
- \`INFERRED\`
- \`RECOVERED_SECONDARY\`
- \`RECONSTRUCTION_POLICY\`
- \`UNVERIFIED\`
- \`NOT_APPLICABLE\`

ybcs-offline 来源内容只能标记 \`RECOVERED_SECONDARY\` 或 \`INFERRED\`，绝不能标记 \`VERIFIED\`。若 SHA-256 只是从仓库 JSON/audit 中读取的来源元数据，必须注明没有直接读取原始文件字节，不得称为本次重新计算的哈希。

## 8. Known Gaps、Verdict 与 Manager Review

每项缺口至少包含：

- \`gap_id\`
- \`description\`
- \`status\`：\`BLOCKED / NOT_RUN / NOT_RECORDED / OPEN\`
- \`required_evidence\`：解除缺口所需的具体材料。

\`worker_verdict\` 建议值：

- \`PASS\`：适用检查全部执行并通过。
- \`STATIC_ONLY\`：静态核验有记录通过，但没有运行验收。
- \`PARTIAL\`：部分独立 Feature 通过。
- \`BLOCKED\`：关键前置条件缺失。
- \`FAIL\`：已执行检查失败。
- \`NOT_RUN\`：未执行足以形成结论的检查。

\`manager_review\` 至少记录 \`status\`、\`reviewed_commit_sha\`、\`readback_checks\` 和 \`verdict\`。尚未总管审核时写 \`NOT_RECORDED\`，不得代替总管批准。

## 9. 提交前自检

- [ ] 仓库、分支、基底、父提交和被测 SHA 都是完整值。
- [ ] changed_files 与实际 commit diff 完全一致。
- [ ] 每个文件的行数和 Git blob SHA 都可由连接器独立读回。
- [ ] Git blob SHA-1 与内容 SHA-256 没有混用。
- [ ] 静态核验与运行验收分列。
- [ ] B6 这类纯数据批次的 runtime_status 为 NOT_RUN。
- [ ] 测试用例数与 assertion 数分开统计。
- [ ] 截图标明 real/synthetic，缺少截图时没有编造 SHA。
- [ ] ybcs 来源证据等级没有升级为 VERIFIED。
- [ ] 所有未知项显式标记 BLOCKED、NOT_RUN 或 NOT_RECORDED。
- [ ] Worker 结论没有冒充总管最终验收。
