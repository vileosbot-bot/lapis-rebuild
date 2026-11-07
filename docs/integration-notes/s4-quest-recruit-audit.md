# auto-6-1 B1｜Quest1–8任务与招募数据导出审计

## 1. 执行范围

- Worker：W3
- Batch：B1 only（Quest1–8任务与招募数据）
- Source project：`ybcs-offline`（第二个独立重构实现）
- Source artifact：`Quest.lib`
- Source SHA-256：`23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397`
- Source size：21205 bytes
- Archive directory check：`0xd3eb5f05`
- Evidence：`RECOVERED_SECONDARY` / 重构参考
- Runtime verified：`false`

本批只导出Quest1–8。NPCScript仅作归档成员盘点，不执行B2服务目录导出。B2–B6及其他批次均不在本次范围。

## 2. 解包与成员盘点

使用随附的`lapis_lib.py`目录解码逻辑及`pkware_blast.py`纯Python DCL解码器，通过`ybcs_quest_runtime.py`读取归档。15个归档成员均已在内存中成功解压，并逐项核对实际解压字节数与目录声明长度。没有将解压原始TXT写入GitHub。

实际成员数：**15**。

| 序号 | 实际成员名 | Packed bytes | Unpacked bytes | Member offset |
|---:|---|---:|---:|---:|
| 1 | `HelpScript.txt` | 255 | 617 | 0 |
| 2 | `Neohelp.txt` | 3954 | 8963 | 255 |
| 3 | `NPCScript.txt` | 1371 | 4572 | 4209 |
| 4 | `Prologue.txt` | 660 | 784 | 5580 |
| 5 | `Quest0.txt` | 2716 | 4640 | 6240 |
| 6 | `Quest1.TXT` | 675 | 861 | 8956 |
| 7 | `Quest2.TXT` | 916 | 1398 | 9631 |
| 8 | `Quest3.TXT` | 831 | 1134 | 10547 |
| 9 | `Quest4.TXT` | 843 | 1196 | 11378 |
| 10 | `Quest5.TXT` | 759 | 997 | 12221 |
| 11 | `Quest6.TXT` | 785 | 1118 | 12980 |
| 12 | `Quest7.TXT` | 875 | 1314 | 13765 |
| 13 | `Quest8.TXT` | 697 | 954 | 14640 |
| 14 | `Quest9.TXT` | 483 | 712 | 15337 |
| 15 | `Tutorial.txt` | 4807 | 10583 | 15820 |

目标成员核验：

- Quest1.TXT至Quest8.TXT：8/8存在，各出现一次。
- NPCScript.txt：存在一次；解压后170行，解析出39个程序，编号11–49。
- 本批不导出NPCScript程序数据；该数据留给独立B2批次。

## 3. Quest1–8行数与指令计数

行数按解码后的`splitlines()`物理行计数；指令数按当前Quest解析器输出的`QuestCommand`记录计数，不包括空行。

| 脚本 | 实际成员 | 解压 bytes | 原始行数 | 指令数 | STEP | SELECT | SCRIPT | CANCEL | TEXT | ACTOR | NAME | COMMENT |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Quest1 | `Quest1.TXT` | 861 | 38 | 36 | 3 | 1 | 1 | 8 | 10 | 6 | 6 | 1 |
| Quest2 | `Quest2.TXT` | 1398 | 72 | 70 | 3 | 1 | 1 | 16 | 18 | 15 | 15 | 1 |
| Quest3 | `Quest3.TXT` | 1134 | 51 | 50 | 3 | 1 | 1 | 11 | 13 | 10 | 10 | 1 |
| Quest4 | `Quest4.TXT` | 1196 | 62 | 60 | 3 | 1 | 1 | 13 | 15 | 13 | 13 | 1 |
| Quest5 | `Quest5.TXT` | 997 | 36 | 34 | 3 | 1 | 1 | 7 | 9 | 6 | 6 | 1 |
| Quest6 | `Quest6.TXT` | 1118 | 60 | 58 | 3 | 1 | 1 | 13 | 15 | 12 | 12 | 1 |
| Quest7 | `Quest7.TXT` | 1314 | 62 | 60 | 3 | 1 | 1 | 13 | 15 | 13 | 13 | 1 |
| Quest8 | `Quest8.TXT` | 954 | 46 | 44 | 3 | 1 | 1 | 9 | 11 | 9 | 9 | 1 |

所有8个脚本均包含3个STEP、1个SELECT和1个SCRIPT。各脚本完整`commandCounts`已写入JSON。

## 4. 招募分支证据

招募候选信息只从Quest1–8任务资源本身的结构化SELECT分支及其STEP2/STEP3分支提取，不从普通NPC服务对话推断。

| 脚本 | SELECT前原始Actor token | SELECT行 | STEP2分支标记行 | STEP3分支标记行 | 语义边界 |
|---|---:|---:|---|---|---|
| Quest1 | `100` | 20 | 26, 30 | 36 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest2 | `101` | 50 | 56, 60 | 66, 70 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest3 | `107` | 34 | 39, 43 | 49 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest4 | `102` | 44 | 50, 54 | 60 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest5 | `103` | 18 | 24 | 30, 34 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest6 | `105` | 34 | 40, 44 | 50, 54, 58 | SELECT后的文本主要为自我介绍，没有直接提出加入请求；Quest6的合作语义仅按STEP2/STEP3分支文本保留：STEP2出现“请多关照”，STEP3出现“目前我不需要朋友”。不据此声称服务端招募状态已改变。 |
| Quest7 | `104` | 32 | 38, 42, 46 | 52, 56, 60 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |
| Quest8 | `106` | 32 | 38 | 44 | SELECT分支及STEP2/STEP3后续分支均由Quest脚本资源直接提供；保留原文，不推导服务端招募条件、队伍变更、奖励或持久化结果。 |

Actor token只按原始脚本引用保留，不映射为NPC模板ID、NPC实体ID、SMF object_id或Quest内部服务端ID。

Quest6的SELECT后文字主要为自我介绍；其合作语义依据STEP2的“请多关照”与STEP3的“目前我不需要朋友”分支保留，未将SELECT文本改写成明确邀请。

本导出只证明资源中存在脚本选择/对话分支，不证明服务端已执行招募、队伍变更或持久化。`recruitmentConditions`与`recruitmentRewards`均保持`null`，并分别通过`recruitmentConditionsStatus`与`recruitmentRewardsStatus`显式标记`not-recovered`；`serverRecruitmentMutation`同样保持`not-recovered`。

## 5. 解析器与语义限制

1. Quest脚本编号来自`QuestN.TXT`成员文件名，不宣称等同于服务端内部任务ID。
2. 当前解析器把未识别的非指令行归类为`TEXT`；`unknown_commands`为空不构成未知语法不存在的证明。
3. `choices`字段在当前解析器中未从Quest文本独立恢复；JSON中的空数组只表示解析器未填充。
4. `SCRIPT`、`SELECT`、`CANCEL`是客户端资源指令标记，不足以恢复服务端条件、奖励、招募状态或业务响应。
5. NPC部署解析当前返回空集合；本批不建立Quest Actor到NPC Template、NPC Entity或SMF Object的关联。
6. 本数据集仅为`RECOVERED_SECONDARY` / 重构参考，不标记`VERIFIED`，`runtimeVerified=false`。

## 6. 解码工具来源

| 工具文件 | SHA-256 |
|---|---|
| `ybcs_quest_runtime.py` | `b4f6e6f968a3e2cf3b203f52ba60698df60cba578d47162c88c4b710c4a11d0d` |
| `lapis_lib.py` | `f742e0f8d6425bed20118a3e69bac1041943efc31262e078cc3679b8e4bbfcae` |
| `pkware_blast.py` | `8500511a4017742bc8a3271aff7013b7cac0c369ca75575c9d8136d4d7239e00` |

## 7. 导出文件与仓库边界

本批预期仅提交以下三个派生文件：

- `docs/integration-notes/s4-quest-recruit-data.json`
- `docs/integration-notes/s4-quest-recruit-policy.ts`
- `docs/integration-notes/s4-quest-recruit-audit.md`

铁律：`Quest.lib`、`Set.lib`等原始资源二进制绝不进入GitHub；从归档解压的原始TXT也绝不进入GitHub。仅允许提交解析导出的JSON、TypeScript policy和Markdown审计说明。

每条导出记录包含`sourceProject`、`sourceArtifact`、`sourceMember`、`sourceHash`、`sourceRecord`、`evidenceLevel=RECOVERED_SECONDARY`、`evidenceLabel=重构参考`、`runtimeVerified=false`。

## 8. 执行结果

- 归档读取：成功。
- 全部成员解压：成功（15/15）。
- Quest1–8：存在并解析成功（8/8）。
- NPCScript成员盘点：成功（仅盘点，不导出B2）。
- 招募分支证据：8/8脚本均有SELECT及STEP2/STEP3分支记录。
- 原始二进制和解压TXT：不纳入本批仓库提交。
- 运行时验证：未执行，`false`。
