# 第一章首战怪物对齐查证记录

- 任务编号：`ch1-monster-fix-20261113-01`
- 仓库：`vileosbot-bot/lapis-rebuild`
- 基线：`main@95c07edad560729c965941a961fb666b47c29197`
- 目标：第一章 Story source 1，gate cell `(72,30)`，`battleZone 1`
- 查证状态：**BLOCKED（第一阶段形成候选阵容，但不足以安全确认完整的怪物—视觉—战斗数据绑定）**
- 本分支仅新增本报告；没有修改运行时代码、测试、binding manifest 或截图。

## 0. 结论摘要

已找到一份 ybcs 离线实现源码副本，其中明确列出 Story source 1 的离线战斗候选阵容：`1010 十步长 ×1`、`1001 步兵 ×16`、`1003 枪兵 ×3`。旧 DEO 交接位置支持主敌人及前 18 个增援的位置；第 20 个单位明确是 ybcs 离线策略追加的单位。静态故事场景目录也列出 zone 1 的 DEO 模型集合 `1001/1002/1003/1010/577/COM0`。

但这还不足以证明它就是可直接替换当前 S42 训练占位战斗的完整、正确绑定：
1. ybcs 源码头部明确说明旧归档没有零售野外刷怪表；该模块提供的是可替换的单机 placement/drop policy。该源码副本来自 Library，不在当前云电脑指定目录。
2. 当前云电脑没有找到原始 `Set.lib` / `ability.atr` 或对应 B1001/B1003/B1010 ANI/SPR 资源，无法核实属性、移动/攻击范围和真实视觉槽位。
3. S2 walkman 原始日志及 excerpt 当前不在云电脑或可检索的 Drive 文件夹中；仅有此前的 prescan 报告。该报告未发现任何 6A69。
4. `manifests/enemy-ai-binding.json` 的 `concrete_historical_bindings` 仍是 `UNVERIFIED` 且 `entries=[]`。
5. S17 人工复核的 B4524/B4525/B4526/B4544 分别来自 zone 81 / zone 91 的视觉相关记录，不是 Chapter 1 模型 1001/1002/1003/1010 的已确认绑定。S17 明确禁止按数字相等自动绑定视觉 ID。

因此不把候选阵容冒充零售 VERIFIED，也不把 M7/S19 的 `RECONSTRUCTION_POLICY` 数值冒充原版事实。**停止第二、第三阶段：不改代码、不改测试、不改 binding、不运行 S42、不生成新截图、不创建 PR。**

## 1. 目标战斗定位

### 1.1 S1 绑定

- `docs/integration-notes/s1-encounter-binding-crosswalk.md:18-20`：Chapter 1 的 `STORY_ONE_CASTLE_GATE_ZONE_ID=1`，Story source 1 对应部署地图 `map:old:1030`。
- 同文件 `:35-39`：所有 ybcs 记录的证据等级固定为 `RECOVERED_SECONDARY`；候选 `1030 -> 1` 不是 VERIFIED；静态场景资源存在不等于地图到战斗场景的零售遭遇绑定成立。
- `docs/integration-notes/s1-encounter-binding-crosswalk.csv:5`：`B1-S-001`，entity `22608`，Story source 1，候选 `map 1030 -> battleZone 1`，状态 MATCH。
- ybcs 源码 `src/legacy_gui_runtime/ybcs_offline_field_encounters.py:237-289`：定义 zone 1 与 Story source 1 的 gate cells；目标 gate cell `(72,30)` 在该组中。
- 证据等级：S1/ybcs 绑定为 `RECOVERED_SECONDARY`，不能提升为零售 VERIFIED。

### 1.2 原始故事场景静态目录

`manifests/story-battle-scenes.json:1`（JSONPath `$.zones[?(@.zone_id==1)]`）记录：

- DEO：64 commands、24 CHARPOS，模型集合 `1001,1002,1003,1010,577,COM0`。
- DEE：36 commands、6 CHARPOS，模型集合 `1001,2010,577,COM0`。

这属于固定原始客户端故事场景资源的静态元数据（`VERIFIED-STATIC-RESOURCE`），只证明该故事场景资源包含这些模型 ID；它本身不提供战斗时的敌人数量、属性、AI 程序或逐单位视觉绑定。

## 2. ybcs Story source 1 离线阵容候选

### 2.1 来源与证据限制

Library 中可读到 `src/legacy_gui_runtime/ybcs_offline_field_encounters.py`（5120 行，194,299 字节）。当前云电脑没有 `/home/vileo/workspace/downloads/ybcs/extracted/`，也没有找到 `/mnt/d/nds/ybcs-offline`；因此本节使用的是 Library 源码副本，不声称是本次从云电脑原始包直接读取。

源码头部 `:1-24` 说明：旧归档保留 world/battle maps 与 B4000 系列角色资源，但没有零售 field-spawn table；该模块提供可替换的 single-player placement/drop policy。故以下一律标记 **RECOVERED_SECONDARY**，只作为 ybcs 单机实现候选，不是零售服务器事实。

### 2.2 候选阵容

源码 `:1704-1786` 的 Story source 1 定义给出：

| ybcs Ability ID | ybcs 标签 | 数量 | 单位 HP / MP | 单位胜利金币 / 经验 | 证据 |
|---:|---|---:|---:|---:|---|
| 1010 | 十步长 | 1 | 19 / 100 | 60 / 150 | RECOVERED_SECONDARY |
| 1001 | 步兵 | 16 | 13 / 100 | 20 / 50 | RECOVERED_SECONDARY |
| 1003 | 枪兵 | 3 | 13 / 100 | 20 / 50 | RECOVERED_SECONDARY |
| **合计** | | **20** | | | RECOVERED_SECONDARY |

重要限定：
- ybcs 源码注释说明 zone 1 的两个 `1002` 伏兵在 DEO 阶段、主阵出现前被击杀；它们是战场外观/剧情阶段单位，不应直接加入这场已启动战斗的 20 人 roster。
- 20 人中，主敌人 1010 加前 18 个增援共 19 个位置由旧 DEO battle-handoff 位置覆盖；最后一个 1001 是明确的 ybcs 离线追加单位，保留确定性 fallback cell `(44,36)`。不能把这第 20 个单位描述为已由原始 DEO 实证。
- encounter 的 `minimum_level=1` 是最低等级门槛，不等于每个单位都有已恢复的个体等级字段；逐单位等级仍 UNKNOWN。
- 主敌人记录的 `basic_damage=10`、`enemy_damage=8` 是 ybcs 离线战斗参数，不是已恢复的零售攻击/防御/魔攻/魔防属性。

### 2.3 位置

来源：
- `src/legacy_gui_runtime/ybcs_offline_field_encounters.py:3083-3105`：旧 DEO battle-handoff cells。
- 同文件 `:3190-3220`：handoff 位置覆盖逻辑。
- 同文件 `:1704-1786`：阵容顺序与单位标签。

玩家 handoff cell 为 `(16,62)`。下表的 `Δ` 是相对玩家的 ybcs 格子偏移 `(enemy_x-16, enemy_y-62)`；这是格子偏移，不是像素偏移。

| 顺序 | Ability ID | 标签 | ybcs cell | 相对玩家 Δ | 位置证据 |
|---:|---:|---|---|---|---|
| 1 | 1010 | 十步长 | (55,21) | (+39,-41) | DEO handoff |
| 2 | 1001 | 步兵 | (53,21) | (+37,-41) | DEO handoff |
| 3 | 1001 | 步兵 | (57,21) | (+41,-41) | DEO handoff |
| 4 | 1001 | 步兵 | (55,19) | (+39,-43) | DEO handoff |
| 5 | 1001 | 步兵 | (55,23) | (+39,-39) | DEO handoff |
| 6 | 1003 | 枪兵 | (53,29) | (+37,-33) | DEO handoff |
| 7 | 1001 | 步兵 | (51,27) | (+35,-35) | DEO handoff |
| 8 | 1001 | 步兵 | (55,31) | (+39,-31) | DEO handoff |
| 9 | 1001 | 步兵 | (51,31) | (+35,-31) | DEO handoff |
| 10 | 1001 | 步兵 | (55,27) | (+39,-35) | DEO handoff |
| 11 | 1003 | 枪兵 | (47,23) | (+31,-39) | DEO handoff |
| 12 | 1001 | 步兵 | (49,21) | (+33,-41) | DEO handoff |
| 13 | 1001 | 步兵 | (45,25) | (+29,-37) | DEO handoff |
| 14 | 1001 | 步兵 | (45,21) | (+29,-41) | DEO handoff |
| 15 | 1001 | 步兵 | (49,25) | (+33,-37) | DEO handoff |
| 16 | 1003 | 枪兵 | (45,31) | (+29,-31) | DEO handoff |
| 17 | 1001 | 步兵 | (47,29) | (+31,-33) | DEO handoff |
| 18 | 1001 | 步兵 | (42,32) | (+26,-30) | DEO handoff |
| 19 | 1001 | 步兵 | (44,34) | (+28,-28) | DEO handoff |
| 20 | 1001 | 步兵 | (44,36) | (+28,-26) | ybcs offline fallback addition |

友方 handoff cells：玩家 `(16,62)`；两个 companion cells `(13,59)`、`(13,63)`。像素换算需要对应战斗网格/资源几何参数；当前证据不支持像素偏移数字，故不编造。

### 2.4 可恢复与不可恢复的战斗参数

| 项目 | 当前结果 | 证据等级 / 说明 |
|---|---|---|
| 敌人 ID、y b c s 标签、候选数量 | 1010×1、1001×16、1003×3 | RECOVERED_SECONDARY；非零售 VERIFIED |
| 个体 HP / MP | 1010：19/100；1001/1003：13/100 | RECOVERED_SECONDARY |
| 最低等级 | encounter minimum_level=1；个体等级未知 | RECOVERED_SECONDARY / UNKNOWN |
| 攻击、物防、魔攻、魔防 | 无可核实逐单位值 | SERVER-BOUNDARY / UNKNOWN |
| basic_damage / enemy_damage | 仅主敌人 ybcs 离线参数 10 / 8 | RECOVERED_SECONDARY；不可等同原始攻击属性 |
| 移动范围、普通攻击范围 | 源码构造 roster 时读取 battle profile；需 `Set.lib` 中 `ability.atr` 数据 | 当前缺原始表，UNKNOWN |
| 技能、特性 | 当前 encounter roster 未列出逐单位技能/特性绑定 | UNKNOWN |
| 经验 / 金币 | 主敌人 150 EXP / 60 gold；每个增援 50 EXP / 20 gold | RECOVERED_SECONDARY；逐单位离线值 |
| AI 程序 / 6A69 | 无具体绑定号 | SERVER-BOUNDARY；见第 4 节 |
| 视觉 Bxxxx、ANI/SPR | 1001/1003/1010 没有已确认的 Bxxxx 绑定和 ANI/SPR 槽位 | UNKNOWN；见第 5 节 |

源码中 roster 序列化将成员 model ID 写入 resource ID，并从 profile 读取移动/攻击范围（`:4680-4705`）；这只是 ybcs 离线构造逻辑，不足以证明这些字段等于零售服务器最终战斗值。

## 3. 原始数据包与 `.atr` 核查

- 当前云电脑：`/home/vileo/workspace/downloads/ybcs/extracted/` 不存在；`/home/vileo/workspace/downloads/ybcs/` 不存在；`/mnt/d/nds/ybcs-offline/` 不存在。
- 当前云电脑在 WSL home、Windows 用户目录和挂载的 D: 范围内，未找到 `Set.lib`、`ability.atr` 或 B1001/B1003/B1010 ANI 文件。
- Drive 文件夹 `ybcs-offline-zip` 当前可读到的是解析报告，不是原始 ZIP。报告记录原包 `ybcs-offline.zip` 为 192,893,156 字节，SHA-256 `d79c012177c8b1701188a90825539466d28cc18dc87b3c62361b4960b315724d`；这是此前报告中的记录值，本轮未重新下载或重算。
- 缺少原始 `Set.lib` / `ability.atr`，不能恢复每个单位的攻击、防御、魔攻、魔防、个体等级、移动范围、攻击范围和技能细节。不得用 S19/M7 的 reconstruction 数值填补这些空缺。

## 4. walkman 实玩日志与 AI

- 当前云电脑未找到 walkman 原始日志文件 `ybcs-gui-client.jsonl` / `ybcs-gui-server.log` 或 `s2-prescan-excerpt.jsonl`。
- 可检索到此前的 `s2-log-prescan-2026-11-08.md` 报告摘要：记录客户端日志 32,695,814 字节、146,427 行；三种检查方法均为 0 个 6A69 命中；6A51 有两次相同帧记录。此处是既有 prescan 摘要，不冒充本轮读取原始日志。
- `manifests/enemy-ai-binding.json:110-114`：`concrete_historical_bindings.status=UNVERIFIED`，`entries=[]`；原因是没有保留包含历史非默认逐单位程序的 live roster/network payload。
- 结论：无法给 1001/1003/1010 绑定任何 6A69 程序号。AI 应标记 `SERVER-BOUNDARY`，不补默认 AI 伪装成原始绑定。

## 5. 视觉资源核查

- `docs/integration-notes/s17-monster-visual.md:61-68`：B4524/B4525/B4526/B4544 是人工复核的外观描述，不是 canonical retail monster/species 名称；前三者只与 zone 81 DEO token 有相关性，B4544 只与 zone 91 DEO token 有相关性。
- 同文件 `:84-93`：视觉目录不会按数字相等自动解析；battle unit 必须携带显式 visual ID。当前 `dummy-melee -> B4524`、`dummy-ranged -> B4544` 是 M5 reconstruction training bindings。
- `manifests/story-battle-scenes.json` 的 zone 1 模型 ID 为 1001/1002/1003/1010/577/COM0；现有 S17 人工复核没有建立这些 Chapter 1 模型到 B4524/B4525/B4526/B4544 的映射。
- `web/src/world/ch1-world-authority.ts:42-60`：吉奥老师的 source model resource ID 是 5056，当前 B4524 只是明确标记为 `RECONSTRUCTION_POLICY` 的 NPC presentation proxy。
- 因此不能把 B4524/B4525/B4526/B4544 直接分配给 1001/1003/1010；B1001/B1003/B1010 也不能只凭数字相等就认定存在。Chapter 1 正确视觉家族和 ANI/SPR 槽位仍 UNKNOWN。

## 6. 吉奥老师 NPC 是否应出现在战斗视图

- `web/src/world/ch1-world-authority.ts:52-61`：吉奥老师 placement 是 `kind='npc'`，使用其世界地图 placement。
- `web/src/m4-runtime-integration.ts:299-315`：M4 将吉奥老师作为 Chapter 1 world visual 配置；notice 明确其 B4524 是视觉替身、`RECONSTRUCTION_POLICY`。
- `web/src/scene.ts:583-590`：`refreshRecoveredVisualVisibility()` 对所有 world visual 使用 `!inBattleView && row.spec.mapId===mapId`；进入 battle view 时隐藏 world NPC 和 label。
- zone 1 DEO 静态模型集合不包含 NPC entity 21003 / source model 5056。
- 结论：吉奥老师不是这场战斗的敌人或友军；按当前场景契约不应出现在战斗视图。若抽查截图确实显示他站在战场中，应视为 world-visual visibility / battle-transition bug 或截图状态残留。本任务明确不改 NPC、地图、路线或 Quest1，因此只记录，不扩展修复范围。

## 7. S19 / M7 禁用证据

- `docs/integration-notes/s19-reconstruction-combat-balance.md:15-19` 明确所有推导战斗公式和调参值均为 `RECONSTRUCTION_POLICY`，不能描述为原始零售服务器公式。
- 同文件 `:183-191` 将历史逐怪服务器属性、历史奖励/经验曲线、最终怪物 roster/视觉绑定列为尚待证据的工作。
- `data/monsters/m7-monster-catalog.json:165-175`：`visualBinding`、`descriptiveIdentity`、`combatNumbers`、`aiBehavior`、`abilities` 均为 `RECONSTRUCTION_POLICY`；`retailEnemyStats`、`retailEnemyAi`、`fieldEncounterBinding` 为 `SERVER-BOUNDARY`。
- 本报告没有把 M7/S19 数值用于候选 roster，也没有把 B4524/B4544 training bindings 当作 Chapter 1 怪物绑定。

## 8. 阶段裁定

**verdict: BLOCKED**

理由不是“完全没有怪物 ID”：y b c s 离线源码确实给出 20 人候选 roster。但该 roster 是 `RECOVERED_SECONDARY` 的离线 placement/drop policy，其中第 20 个单位是明确的离线追加；原始 `.atr`、原始 walkman 日志和 Chapter 1 的显式 Bxxxx/ANI/SPR 视觉绑定均缺失。若现在改代码，就必须猜测至少一项关键视觉/战斗属性/AI 绑定，违反本任务证据规则。

执行结果：
- 第一阶段：查证报告完成。
- 第二阶段：未执行；没有代码、binding、断言或 S42 期望值改动。
- 第三阶段：未执行；typecheck、单元测试、build、S42 E2E 均未运行；没有生成 s42x-07/08/09/10 截图。
- GitHub：只新增本报告到指定分支；不创建 PR（硬门槛 BLOCKED），不合并、不动 main、不碰 ViLeo06 仓库。
- 当前 S42 基线仍是任务说明中的 dummy-melee / dummy-ranged 占位战斗。

## 9. 解阻所需材料

满足以下材料后才能重新评估第二阶段：
1. 将原始 `ybcs-offline.zip` 或解压目录恢复到当前云电脑，并可读到 `runtime/client/NRes/Set.lib` / `ability.atr`。
2. 提供/恢复 walkman 原始 `ybcs-gui-client.jsonl`、`ybcs-gui-server.log` 和 prescan excerpt，以便重新核实 S2 序列及 6A69 / roster program。
3. 提供 Chapter 1 模型 1001/1003/1010 到实际 Bxxxx ANI/SPR 槽位的显式绑定证据；不得以数字相等或 S17 的 zone81/91 人工样本替代。
