# Agent 中断恢复流程

- request-id：agent-7x24-p03-registry-20261117-01
- 目标：浏览器关闭、电脑重启、GPT 对话中断后，不依赖总管回忆即可恢复任务

## 固定恢复顺序

1. 打开 task-registry.yml；
2. 按 request-id 找到唯一任务记录；
3. 读取 conversation_url，尝试打开原 GPT 对话；
4. 读取 repository 和 branch；
5. 从 GitHub 实际读取该分支最新 HEAD SHA；
6. 对照登记表的 base_sha、head_sha 和最近检查点；
7. 判断 GitHub 是否存在登记表未记录的新提交；
8. 确认 status、approval_status、blocked_by、depends_on 和检查点；
9. 只按 next_action 继续。

## 事实权威与不一致处理

- 代码事实以 GitHub 实际 repository/branch/HEAD/PR/CI 为准。
- 流程事实以 task-registry.yml 的状态、检查点、审批、风险、预算和 next_action 为准。
- `head_sha_verified_at` 表示 `head_sha` 最近一次与 GitHub 实际状态核对一致的日期；为 null 或已知过期时，不得把登记 SHA 当作当前已核验 HEAD。先检查 GitHub 提交图，再由总管按维护规则刷新。
- 总管每次验收或状态变更时，须刷新相关任务的 `head_sha`、`head_sha_verified_at`、PR head/base 与检查点证据；P0-1 在本次专项裁决下暂缓刷新，待其验收完成后另行通知。
- task-history 只提供已完成任务的历史证据，不覆盖当前登记表。
- GitHub HEAD 与登记表不一致时，先调查提交图和变更文件；不立即改代码，不重复执行提交，不自动更新 head_sha。
- 只有确认新提交属于登记表自身的单文件登记提交时，才可按 head_sha_policy 识别为 REGISTRY_ONLY。
- 发现未登记代码提交、分支被移动、base 漂移或文件冲突时，先标异常并暂停写操作，报告总管。

## 原对话可打开

打开 conversation_url，读取最后一个检查点之后的内容；随后独立读取 GitHub 当前分支和 HEAD。聊天记录只补充任务意图，不覆盖 GitHub 实际代码事实。对话里说“已提交”不等于提交已存在，必须读回 SHA。

## 原对话打不开或浏览器完全关闭

1. 不依赖浏览器标签、会话内存或总管回忆。
2. 新开 GPT 对话，粘贴登记表中的 request-id、目标、授权范围、最后检查点、repository、branch、base_sha、head_sha 和 next_action。
3. 明确写“从 branch 的已核实 HEAD 继续；先读 GitHub 当前版本，再动手”。
4. 先读取 GitHub 分支、HEAD、PR 和检查状态。
5. 对照登记表和 task-history；发现不一致先调查。
6. 原对话链接仍保留为来源链接，不得猜测新链接替代旧链接。

## 未登记新提交

若工人已提交但总管未更新登记表：
- 读取 GitHub 当前 HEAD、父提交、提交信息和 changed files；
- 与登记表最后确认的 head_sha 比较；
- 若是任务代码提交，标记 HEAD_MISMATCH，暂停后续写入；
- 若是登记表单文件的直接子提交，标记 REGISTRY_ONLY；
- 由总管核对后更新检查点；不得重复 cherry-pick、重复提交或重做已经完成的步骤。

## 恢复信息必须包含

恢复脚本至少输出 request-id、任务名、状态、审批状态、原对话真实 URL、repository、branch、base_sha、登记 head_sha、GitHub 实际 observed_head、HEAD 比对结论、最近 CP0–CP3、progress、next_action、deadline、risk_level、blocked_by、depends_on、PR URL 和 task-history 索引位置。

缺少真实链接或 SHA 时显示 null/待核实，不生成猜测值。

## 恢复后的操作边界

- 不重复执行已经存在的提交。
- 不自动合并 PR、不自动部署、不修改游戏代码或测试数据。
- 不把 blocked/paused/failed/dead_letter 自动改回 in_progress。
- 需要重新放行时，等待总管明确授权并记录来源。
- 上游 PR 合并后，下游任务必须重新核对 main HEAD、base_sha 和 shared_files。
