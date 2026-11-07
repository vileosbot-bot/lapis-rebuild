# S1 遭遇绑定对照表 — Batch 1（第 1–2 章）

## 1. 范围与来源

本批只覆盖可归属第 1–2 章的野外遭遇、剧情战，以及无法排除属于早期章节的 UNKNOWN 候选。没有修改任何运行时绑定。

对照源为本次对话附件，路径均相对于 `~/workspace/downloads/ybcs/extracted/`：

- `src/legacy_gui_runtime/ybcs_offline_world_catalog.py`：658 行；SHA-256 `34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703`。定义 `OFFLINE_WORLD_ROOT_MAP=1000`，地图资源文件名规则为 `sz-<数字>.imf`；`OfflineWorldMap` 提供 `map_wire` / `zone_name` / `map_id`，名称运行时来自 `Set.lib` 的 `zone_name.txt`。本次附件没有 Set.lib 数据，因此 `map_name` 一律保留 UNKNOWN。
- `src/legacy_gui_runtime/ybcs_offline_field_encounters.py`：5120 行；SHA-256 `94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a`。`YBCS_OFFLINE_FIELD_ENCOUNTERS` 从第 1028 行开始；`_YBCS_OFFLINE_STORY_BATTLE_DEFINITIONS` 从第 1704 行开始；`YBCS_OFFLINE_STORY_BATTLES` 从第 3242 行开始；合并集合 `_YBCS_OFFLINE_ENCOUNTERS` 从第 3248 行开始。

章节信息没有独立 Scenarioinfo 文件。本批不从外部文件或记忆补齐；只使用两个附件的结构/内容及文件内注释线索。

## 2. 章节归属规则

### Chapter 1

由部署文件中的显式常量建立章节归属：`STORY_ONE_CASTLE_GATE_ZONE_ID=1`、`STORY_ONE_DUNGEON_ZONE_ID=3`、`STORY_ONE_PALACE_ZONE_ID=7`（常量定义在第 240–246 行）。对应剧情部署的 `source_id` / `battle_zone_id` 为 1、3、7，部署地图分别为 `map:old:1030`、`map:old:1070`、`map:old:1090`。

野外记录中，map 1030 与 story source 1 同图；map 1090 与 story source 7 同图；map 1060 是 story source 1（1-1）明确记载的 `victory_return_map_id`，注释说明它是城堡走廊入口并连接 1-2。因此这三张地图上的野外部署归 Chapter 1。

### Chapter 2

由显式常量 `STORY_TWO_FORTRESS_GATE_ZONE_ID=11`、`STORY_TWO_VALLEY_ZONE_ID=13`、`STORY_TWO_FORTRESS_ZONE_ID=15` 归属。对应剧情部署地图为 map 1040、1045、1040。map 1040 上的六条野外部署与 Chapter 2 的 source 11/15 同图，故归 Chapter 2。

### UNKNOWN

- `ABANDONED_MINE_DUEL_ZONE_ID=9` 的注释明确称其为独立废矿决斗、不是 canonical main-story stage，因此不擅自归入 Chapter 1 或 Chapter 2。
- map 1010、1020、1050、1300 的野外部署没有可确认的章节阶段关联。map 1020 虽有注释路线 `1020->1030->1060->1090`，但道路相连本身不足以证明章节归属，故仍记 UNKNOWN。

map 1310、1341、1345 上的 5 条野外部署未纳入本批：这些地图分别与后续 story source 21（Chapter 3）、31（Chapter 4）、41（Chapter 5）同图，不属于 Batch 1。

## 3. 绑定与证据口径

- 每条 ybcs 记录的 `ybcs_evidence_level` 固定为 `RECOVERED_SECONDARY`。ybcs 是独立离线重构实现，不是原版零售服务器证据。
- Lapis 主线基线只读使用 `manifests/encounter-bindings-2.2.json`、`manifests/story-battle-scenes.json`、`docs/integration-notes/s1-encounter.md` 及 `docs/evidence-ledger.md`。
- Lapis S1 候选映射 `1030->1`、`1070->3`、`1090->7`、`1100->9` 均为 `RECOVERED_SECONDARY`，不是 VERIFIED。故事场景目录对 zone 1/3/7/9/11/13/15 的静态场景资源标题属于 `VERIFIED-STATIC-RESOURCE`，但场景资源存在不等于世界地图到战斗场景的遭遇绑定已经建立。
- Lapis VERIFIED 的原生交互边界（world entity、scene object）与 `0x98 mode 1` BattleEntry 接收边界保持不变；客户端交互请求不是战斗入口本身。不得把候选映射提升为 VERIFIED，也不得据此覆盖已验证 S1 路径。
- 野外部署的 `battle_zone_id` 在 ybcs placement 中未显式提供；`effective_battle_zone_id` 按代码回退为 `map_id` 中的旧地图编号。CSV 明确标注为 effective fallback，不声称这是零售服务器的通用 map->battleZone 规则。
- `map_name` 和野外 `battle_scene_title` 在本批附件中没有可直接读取的实际 Set.lib 名称值，故保持 UNKNOWN。剧情战标题仅取自 Lapis 的静态场景目录。

## 4. 本批统计

| 范围 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| Chapter 1 | 3 | 3 | 6 |
| Chapter 2 | 6 | 3 | 9 |
| UNKNOWN（保留候选） | 21 | 1 | 22 |
| **Batch 1 CSV** | **30** | **7** | **37** |

核对：`N_field=30`，`N_story=7`，`N_CSV=37`，且 `37 = 30 + 7`。原始字段源中有 35 条野外部署；其中 30 条进入本批（包括 21 条章节 UNKNOWN 候选），5 条位于后续章节地图而排除。剧情定义中有 28 条；本批纳入 6 条 canonical Chapter 1–2 剧情战及 1 条非 canonical 废矿支线 UNKNOWN。

## 5. Lapis 对照状态统计

| 状态 | 数量 | 说明 |
|---|---:|---|
| MATCH | 3 | `B1-S-001` 至 `B1-S-003`；Story source 1/3/7 分别匹配候选 1030->1、1070->3、1090->7 |
| DIRECT_CONFLICT | 0 | 没有证明同一逻辑事件出现不同 battleZone |
| TRIGGER_CONFLICT | 0 | 没有可与 Lapis 触发条件一一对应的已证实冲突 |
| PARTIAL_OVERLAP | 0 | 没有足够证据建立部分重叠关系 |
| UNRESOLVED_IDENTITY | 3 | `B1-F-001`、`B1-F-003`、`B1-S-007`；两条同图野外实体缺少事件级 join，废矿 zone 9 的触发地图/触发格关系内部不一致 |
| NO_LAPIS_BINDING | 31 | `B1-F-002`、`B1-F-004` 至 `B1-F-030`、`B1-S-004` 至 `B1-S-006`；没有对应的 S1 遭遇绑定，其中 Chapter 2 场景资源存在但地图到战斗区绑定不存在 |
| LAPIS_ONLY | 0 | 本批候选未发现无 ybcs 对照的 S1 候选项 |

另按章节归属统计，`chapter=UNKNOWN` 共 22 条：21 条野外记录和 1 条废矿支线（source 9）。逐条清单（CSV row_id / entity_id）：

- map 1010：`B1-F-010`/22010、`B1-F-011`/22710、`B1-F-012`/22711、`B1-F-013`/22012、`B1-F-014`/22013、`B1-F-015`/22014。
- map 1020：`B1-F-016`/22020、`B1-F-017`/22720、`B1-F-018`/22721、`B1-F-019`/22022、`B1-F-020`/22023、`B1-F-021`/22024。
- map 1050：`B1-F-022`/22050、`B1-F-023`/22750、`B1-F-024`/22751、`B1-F-025`/22052、`B1-F-026`/22053、`B1-F-027`/22054。
- map 1300：`B1-F-028`/22300、`B1-F-029`/22301、`B1-F-030`/22302。
- 废矿支线：`B1-S-007`，story source 9 / entity 22618 / map 1100。

章节 UNKNOWN 与 review_status 是不同维度；UNKNOWN 行仍保留在 CSV 并纳入数量核对。对应 review_status 为 `NO_LAPIS_BINDING` 的 UNKNOWN 野外行是 `B1-F-010` 至 `B1-F-030`；废矿支线 `B1-S-007` 为 `UNRESOLVED_IDENTITY`。

## 6. 未解决事项与逐条说明

### UNRESOLVED_IDENTITY（3 条）

1. **野外 map 1030 / entity 22030（麻黄草）**：Lapis 有地图级候选 `1030->1`，但没有把候选绑定连接到 ybcs 的具体 `entity_id=22030`。ybcs 该野外行的 effective fallback 为 1030。不能把地图级候选自动套用到该野外实体，也不能据此判定直接冲突。
2. **野外 map 1090 / entity 22090（野生草）**：同理，Lapis 的 `1090->7` 是地图级候选，不是该具体野外实体的事件级绑定；ybcs effective fallback 为 1090。保留 unresolved，不覆盖候选。
3. **Story source 9 / map 1100 / battle zone 9（废矿）**：Lapis 候选 `1100->9` 存在，但 ybcs placement 同时写 `server_driven_story_trigger=True`、`trigger_cells=STORY_ONE_PALACE_GATE_CELLS`，而该常量在源文件中定义为 old 1090 的宫殿门格；相邻注释却称 map 1100 的世界入口是 portable-Mora spawn。解析器按 movement-complete 的 player_cell 检查 trigger_cells。不能自行选择其中一种解释，故保留 unresolved。章节仍为 UNKNOWN。

### NO_LAPIS_BINDING（31 条）

- 野外 28 条：map 1010（6）、1020（6）、1040（6）、1050（6）、1300（3）、1060（1）。其中 map 1040 的 story scene zones 11/15 存在，但 S1 manifest 没有 map 1040 到 zone 11/15 的遭遇绑定。
- 剧情 3 条：source 11（map 1040）、source 13（map 1045）、source 15（map 1040）。Lapis `story-battle-scenes.json` 有相应静态场景资源和标题，但 `encounter-bindings-2.2.json` 没有对应地图到战斗区的候选绑定。场景资源不能替代遭遇绑定。

### 冲突说明

本批没有可成立的 DIRECT_CONFLICT / TRIGGER_CONFLICT / PARTIAL_OVERLAP。map 1040 同时承载 story source 11 和 15，是不同 `source_id` / `battle_zone_id` 的两个剧情事件，不视为冲突。map 1030/1090 的野外实体与地图级候选之间缺少事件身份 join，故归 UNRESOLVED_IDENTITY，而不是制造冲突。

### 其他待核实

- Set.lib 的 `zone_name.txt` 实际内容未随附件提供，因此所有 `map_name` 保持 UNKNOWN。
- 野外 effective battleZone 使用 `map_id` 回退值；没有证据证明它等于零售服务器的最终 `0x98 battleZoneId`。
- ybcs 野外实体使用 `FIELD_ENCOUNTER_ENTITY_TYPE=1`；Lapis S1 已验证的 typed near-action 明确覆盖 101–103，其他类型走独立 `08` 路径，但 encounter semantics 仍为 UNVERIFIED。没有把 ybcs entity ID 映射到 Lapis runtime entity/scene-object ID。
- Lapis 的 1070/1080 资源包字节相同，身份歧义仍在；本批只记录 1070->3，不从内容相同推断 1080。
- Scenarioinfo 无独立文件；不得在后续批次外找外部文件或凭记忆补章节。注释只能作为线索。

## 7. 本批边界

本批只新增本 CSV 与本 Markdown。没有修改既有 S1 文件、运行时代码、main、Plan.md、Backlog 或证据台账；没有创建 PR；Batch 2 未启动。所有冲突和未解决项仅记录，不覆盖任何已验证路径。

## Batch 2（第 3–4 章）

### 1. 范围与来源

本批在 Batch 1 原有内容后追加第 3–4 章对照，只新增 10 条：野外 2 条、剧情 8 条。没有修改 Batch 1 的任何记录。

对照源均为本次对话附件，路径相对于 `~/workspace/downloads/ybcs/extracted/`：

- `src/legacy_gui_runtime/ybcs_offline_field_encounters.py`：5120 行；SHA-256 `94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a`。
- `src/legacy_gui_runtime/ybcs_offline_world_catalog.py`：658 行；SHA-256 `34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703`。

章节常量：第 3 章 zone 21/23/25/27（源文件第 247–250 行）；第 4 章 zone 31/33/35/37（第 251–254 行）。实体常量：Chapter 3 entity 22612、Chapter 4 entity 22613（第 321–322 行）。没有独立 Scenarioinfo 文件，本批只使用附件内显式常量、placement 与注释线索。

### 2. 第 3 章遭遇清单

| row_id | 类型 | 地图 | source/entity | battle_zone_id |
|---|---|---:|---:|---:|
| B2-F-001 | WILD | 1310 | entity 22400（斯塔克） | 1310（effective fallback） |
| B2-S-001 | STORY | 1310 | source 21 | 21 |
| B2-S-002 | STORY | 1320 | source 23 | 23 |
| B2-S-003 | STORY | 1320 | source 25 | 25 |
| B2-S-004 | STORY | 1330 | source 27 | 27 |

### 3. 第 4 章遭遇清单

| row_id | 类型 | 地图 | source/entity | battle_zone_id |
|---|---|---:|---:|---:|
| B2-F-002 | WILD | 1341 | entity 22401（斯塔克B） | 1341（effective fallback） |
| B2-S-005 | STORY | 1341 | source 31 | 31 |
| B2-S-006 | STORY | 1342 | source 33 | 33 |
| B2-S-007 | STORY | 1342 | source 35 | 35 |
| B2-S-008 | STORY | 1343 | source 37 | 37 |

map 1310/entity 22400 与 map 1341/entity 22401 分别是本批第 3、4 章野外记录。map 1345 的 entity 22402/22403/22404 三条属于第 5 章，本批排除。

### 4. 章节归属与触发条件

#### 野外遭遇

- B2-F-001：map 1310、entity 22400、名称斯塔克、model 4013，配置坐标 (58,50)，approach (58,48)。
- B2-F-002：map 1341、entity 22401、名称斯塔克B、model 4014，配置坐标 (101,125)，approach (102,124)。
- 两条野外记录的 minimum_level 均为 36；配置中还存在 minimum_hired_skill_level=5，但 admission 逻辑对 source_kind='field' 跳过雇佣技能等级门槛，不将其写成实际生效条件。
- 野外 resolver 按地图筛选，优先使用实体实时位置（无实时位置时使用配置坐标），只在唯一候选且 Manhattan 距离严格小于 4 时返回。
- placement 未显式提供 battle_zone_id；effective_battle_zone_id 回退为 map_id 数值。因此 1310/1341 是 ybcs 离线实现的 fallback，不是原版服务器最终 battleZone 的证明。

#### 剧情战

- 第 3 章 source 21/23/25/27 分别对应地图 1310/1320/1320/1330，显式常量分别为 STORY_THREE_BORDER_ZONE_ID、STORY_THREE_OUTER_LINE_ZONE_ID、STORY_THREE_INNER_LINE_ZONE_ID、STORY_THREE_HEADQUARTERS_ZONE_ID。
- 第 4 章 source 31/33/35/37 分别对应地图 1341/1342/1342/1343，显式常量分别为 STORY_FOUR_FIRST_FORMATION_ZONE_ID、STORY_FOUR_SECOND_FORMATION_ZONE_ID、STORY_FOUR_THIRD_FORMATION_ZONE_ID、STORY_FOUR_FINAL_FORMATION_ZONE_ID。
- 八条剧情 placement 均为 server_driven_story_trigger=True、single_clear=True、minimum_level=1，未声明 trigger_cells。
- 解析逻辑是在普通移动完成后按地图寻找符合 admission 条件的剧情候选；候选必须唯一，且 prerequisite_story_source_ids 全部满足。没有固定 trigger_cells，不补造坐标触发格。
- 各条精确前置 source IDs、placement 行号和常量值见 CSV 的 trigger_condition 与 ybcs_source_locator。

### 5. Lapis 绑定对照

只读基线：`manifests/encounter-bindings-2.2.json`、`manifests/story-battle-scenes.json`、`docs/integration-notes/s1-encounter.md`、`docs/evidence-ledger.md`。

- Lapis S1 candidate_bindings 仅记录 field_map_id 1030、1070、1090、1100 的候选；没有本批 map 1310、1320、1330、1341、1342、1343 的对应地图绑定。
- Lapis 静态场景目录中存在 zone 21/23/25/27/31/33/35/37，标题已逐条写入 CSV。这仅证明静态场景资源目录存在，不证明地图到战斗场景的遭遇绑定。
- 因缺少同一逻辑事件的 Lapis 地图绑定，本批 10 条均判为 NO_LAPIS_BINDING；没有将场景目录存在误判为 MATCH。
- Lapis 已 VERIFIED 的 world-entity、scene-object 交互边界和 0x98 BattleEntry 边界不作任何修改；本批不新增或提升任何 VERIFIED 结论。

### 6. 本批数量统计

| 范围 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| Chapter 3 | 1 | 4 | 5 |
| Chapter 4 | 1 | 4 | 5 |
| **Batch 2** | **2** | **8** | **10** |

核对：`N_field=2`，`N_story=8`，`N_CSV=10=2+8`。新增 10 条均有 23 个逻辑字段，ybcs_evidence_level 全部为 RECOVERED_SECONDARY。

### 7. MATCH / CONFLICT / UNRESOLVED / UNKNOWN

| review_status | Batch 2 数量 | Batch 1 + Batch 2 累计 |
|---|---:|---:|
| MATCH | 0 | 3 |
| DIRECT_CONFLICT | 0 | 0 |
| TRIGGER_CONFLICT | 0 | 0 |
| PARTIAL_OVERLAP | 0 | 0 |
| UNRESOLVED_IDENTITY | 0 | 3 |
| NO_LAPIS_BINDING | 10 | 41 |
| LAPIS_ONLY | 0 | 0 |

Batch 2 无可成立的直接或部分冲突。10 条 NO_LAPIS_BINDING 清单：B2-F-001、B2-F-002、B2-S-001、B2-S-002、B2-S-003、B2-S-004、B2-S-005、B2-S-006、B2-S-007、B2-S-008。Chapter UNKNOWN 数量为 0；累计 UNKNOWN 仍为 Batch 1 的 22 条。

### 8. 待核实事项

1. Set.lib 的实际 zone_name.txt 内容未随本批附件提供，因此 map_name 保持 UNKNOWN。
2. 野外 1310/1341 的 effective_battle_zone_id 是 ybcs placement 的 map_id 回退值，不证明原版服务器最终 0x98 BattleEntry 的 battleZone。
3. 八个剧情 battle zone 虽有 Lapis 静态场景资源，但没有本批地图到 battleZone 的 S1 candidate binding。
4. 第 3、4 章野外 entity 与 Lapis runtime entity ID 之间没有事件级身份映射。
5. 第 4 章 source 37 胜利返回 map 1345；该地图的三条野外记录仍属于第 5 章，未混入本批。

### 9. Batch 2 边界

本批只追加 CSV 的 10 条数据和 Markdown 本节。未修改 Batch 1 原有 CSV 第 1–38 行及 Markdown 原有内容；未修改任何既有 S1 文件、运行时代码、main、Plan.md、Backlog 或证据台账；未创建 PR；未合并；未写入主号仓库。Batch 3 未启动。

### 10. Batch 1 + Batch 2 累计统计

| 范围 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| Batch 1 | 30 | 7 | 37 |
| Batch 2 | 2 | 8 | 10 |
| **累计** | **32** | **15** | **47** |

CSV 最终为 48 行（1 行表头 + 47 行数据），无空行；标准 CSV 引号解析后每行均为 23 个逻辑列。


## Batch 3（第 5–6 章）

### 1. 范围与来源

本批追加第 5–6 章的 7 条遭遇记录：野外 3 条、剧情 4 条。对照源为本次对话附件，路径相对于 ~/workspace/downloads/ybcs/extracted/：

- src/legacy_gui_runtime/ybcs_offline_field_encounters.py：5120 行；SHA-256 94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a。
- src/legacy_gui_runtime/ybcs_offline_world_catalog.py：658 行；SHA-256 34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703。

章节常量位于 field_encounters 第 255–258 行：第 5 章 41/43，第 6 章 51/53。实体常量位于第 323–324 行：第 5 章 entity 22614，第 6 章 entity 22609。没有独立 Scenarioinfo 文件；本批只使用附件内显式常量、placement、前置条件和源码注释线索。

### 2. 第 5 章遭遇清单

| row_id | 类型 | 地图 | scene/event | battle_zone_id |
|---|---|---:|---|---:|
| B3-F-001 | WILD | 1345 | entity 22402 石龟 | 1345（effective fallback） |
| B3-F-002 | WILD | 1345 | entity 22403 石龟B | 1345（effective fallback） |
| B3-F-003 | WILD | 1345 | entity 22404 石龟B（组合战斗） | 1345（effective fallback） |
| B3-S-001 | STORY | 1345 | source 41 | 41 |
| B3-S-002 | STORY | 1346 | source 43 | 43 |

三条野外部署的准确位置：entity22402 从第 1625 行开始，entity22403 从第 1645 行开始，entity22404 从第 1670 行开始。三条均位于 map:old:1345。source41 的显式 Chapter 5 部署也位于 map:old:1345。三条野外记录与两条剧情记录保持独立，不合并为同一事件。

### 3. 第 6 章遭遇清单

| row_id | 类型 | 地图 | scene/event | battle_zone_id |
|---|---|---:|---|---:|
| B3-S-003 | STORY | 1500 | source 51 | 51 |
| B3-S-004 | STORY | 1352 | source 53 | 53 |

source51 的 placement 从第 2556 行开始，source_id 在第 2585 行；source53 从第 2604 行开始，source_id 在第 2634 行。两条都使用 entity_id=22609，但触发路径不同，不得将相同 entity ID 误判为重复遭遇。

### 4. 章节归属及触发条件

#### 野外遭遇

- B3-F-001：map1345，entity22402，名称石龟，model4015，配置坐标 (97,125)，approach (97,123)，minimum_level=36，配置 minimum_hired_skill_level=5。
- B3-F-002：map1345，entity22403，名称石龟B，model4016，配置坐标 (99,89)，approach (101,89)，minimum_level=36，配置 minimum_hired_skill_level=5。
- B3-F-003：map1345，entity22404，名称石龟B，model4016，配置坐标 (99,53)，approach (99,51)，minimum_level=56，配置 minimum_hired_skill_level=7；reinforcements 包含 model4015 石龟。相邻 YB-341 注释明确说明这是独立的 level-56/current-solskill-Level-7 pack trigger 和版本化 offline policy。
- 三条 placement 均未显式提供 battle_zone_id。effective_battle_zone_id 属性在 battle_zone_id 缺失时回退为 map_id 数值，因此表中 1345 是 ybcs 离线实现的 fallback，不是原版服务器最终 BattleEntry battleZone 的证明。
- 野外解析按地图和精确实体定位，实时坐标可覆盖 authored anchor；候选须唯一且 Manhattan 距离严格小于 4。
- admission 对 source_kind=field 跳过 hired-skill gating。因此配置中的 skill level 5/7 必须保留为原始配置，不得写成实际生效的野外雇佣技能门槛。

#### 第 5 章剧情战

- source41：map1345，battle_zone_id=41，entity_id=22614，server_driven_story_trigger=True，single_clear=True，minimum_level=1；前置剧情 source IDs 为 1,3,7,11,13,15,21,23,25,27,31,33,35,37。没有 trigger_cells，普通移动完成后由剧情延续解析器按地图查找唯一合格候选。battle_anchor=(71,85)，胜利返回 map1346 cell=(63,87)。
- source43：map1346，battle_zone_id=43，entity_id=22614，server_driven_story_trigger=True，single_clear=True，minimum_level=1；前置剧情为 source41 以及全部前序剧情 source IDs。没有 trigger_cells；移动完成后解析唯一合格候选。battle_anchor=(19,71)，胜利返回 map1345 cell=(68,164)。
- 源码注释指出，第 5 章两场剧情战的敌方阵容数量属于离线玩法策略，旧 DEO 未提供可证明的原版服务端敌方人数。不能把离线阵容数量提升为原版证据。

#### 第 6 章剧情战

**source51（B3-S-003）：**

- map1500，battle_zone_id=51，entity_id=22609，minimum_level=15，minimum_hired_skill_level=2，battle_anchor=(80,52)，胜利返回 map1352 cell=(8,68)。
- server_driven_story_trigger 未显式设置，数据类默认 False。
- 因此 entity_record() 会发布 type-1 world actor；由精确 entity resolver 处理旧客户端 08 交互，距离要求 Manhattan <4。
- 剧情 admission 要求当前符合条件的 solskill offer，以及有效的已雇佣 Ability；不得描述成普通移动完成自动触发。
- 源码注释明确：新 Scenarioinfo 将 6-1 放在 successor-only plain map2291，旧安装没有可辩护的场景前身，因此 map1500 是明确的 compatibility proxy。该代理不代表已恢复原版 canonical map identity。

**source53（B3-S-004）：**

- map1352，battle_zone_id=53，entity_id=22609，minimum_level=15，minimum_hired_skill_level=2，battle_anchor=(25,59)，胜利返回 map1500 cell=(73,81)。
- server_driven_story_trigger=True，single_clear=True，前置剧情 source51。
- 没有 trigger_cells；普通移动完成后解析，必须有唯一合格候选。
- 源码注释称新 source map2330 的唯一旧地图前身为 map1352。该注释只作章节和地图关联线索，不视为独立 Scenarioinfo 文件或 VERIFIED 证据。

### 5. Lapis 绑定对照

只读基线为：

- manifests/encounter-bindings-2.2.json
- manifests/story-battle-scenes.json
- docs/integration-notes/s1-encounter.md
- docs/evidence-ledger.md

Lapis 的 S1 candidate_bindings 仍只有 1030→1、1070→3、1090→7、1100→9。本批地图 1345、1346、1500、1352 均没有候选地图绑定。

Lapis 静态场景目录存在 zone41、43、51、53，标题已写入 CSV。这仅证明静态场景元数据存在，不证明 map-to-battle-zone 遭遇绑定。

因此本批 7 条均按实际证据标记 NO_LAPIS_BINDING；不把静态场景存在误判为 MATCH，也不宣称存在直接冲突。

### 6. 本批数量统计

| 章节 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| 第 5 章 | 3 | 2 | 5 |
| 第 6 章 | 0 | 2 | 2 |
| **Batch 3** | **3** | **4** | **7** |

N_field=3，N_story=4，N_CSV=7。新增 7 条均有 23 个逻辑字段，ybcs_evidence_level 全部为 RECOVERED_SECONDARY。

### 7. MATCH / CONFLICT / UNRESOLVED / UNKNOWN

| review_status | Batch 3 | Batch 1–3 累计 |
|---|---:|---:|
| MATCH | 0 | 3 |
| DIRECT_CONFLICT | 0 | 0 |
| TRIGGER_CONFLICT | 0 | 0 |
| PARTIAL_OVERLAP | 0 | 0 |
| UNRESOLVED_IDENTITY | 0 | 3 |
| NO_LAPIS_BINDING | 7 | 48 |
| LAPIS_ONLY | 0 | 0 |

本批没有发现可成立的直接或部分冲突。七条 NO_LAPIS_BINDING 清单：B3-F-001、B3-F-002、B3-F-003、B3-S-001、B3-S-002、B3-S-003、B3-S-004。第 6 章 source51 的兼容代理地图身份限制已在 review_notes 明确说明，但其 story-source 51 与 battle zone 51 的源码身份明确；Lapis 没有对应地图绑定，故状态为 NO_LAPIS_BINDING。Batch 3 的 Chapter UNKNOWN 数量为 0；累计 UNKNOWN 仍为 Batch 1 的 22 条。

### 8. 待核实事项

1. Set.lib 的实际 zone_name.txt 内容未提供，本批 map_name 保持 UNKNOWN。
2. 三条 map1345 野外记录的 effective battle zone 是 ybcs map_id fallback，不证明原版服务器最终 BattleEntry battleZone。
3. source51 的 map1500 是兼容代理，不能当作原版 6-1 canonical map。
4. source53 的 map1352 与 successor map2330 的前身关系来自源码注释，不是独立 Scenarioinfo 文件。
5. 四个剧情 battle zone 有 Lapis 静态场景元数据，但没有对应 S1 地图绑定。
6. ybcs 野外 entity ID 与 Lapis runtime entity ID 之间仍没有事件级身份映射。
7. 第 5 章离线阵容数量是重构策略，不能当作原版服务端敌方人数证据。

### 9. Batch 3 边界

本批只追加 CSV 第 49–55 行和 Markdown 本节。没有修改前 48 行 CSV、Batch 1/2 Markdown 内容、其他仓库文件、运行时代码、main、Plan.md、Backlog 或证据台账。没有创建 PR、没有合并、没有写入主号仓库。Batch 4 未启动。

### 10. Batch 1–3 累计统计

| 范围 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| Batch 1 | 30 | 7 | 37 |
| Batch 2 | 2 | 8 | 10 |
| Batch 3 | 3 | 4 | 7 |
| **累计** | **35** | **19** | **54** |

CSV 最终为 55 行（1 行表头 + 54 行数据），标准 CSV 引号解析后每行均为 23 个逻辑列，无空白数据行。

## Batch 4（第 7–8 章）

### 1. 范围与来源

本批新增第 7–8 章六条剧情部署，不存在本批独立的 source_kind=field 野外遭遇部署。六条均使用 STORY_SEVEN_ENTITY_ID=22610，但 source_id、地图、battle_zone_id、前置剧情和触发方式各自独立，不能合并为一条记录。

对照源为本次对话附件，路径相对于 ~/workspace/downloads/ybcs/extracted/：

- src/legacy_gui_runtime/ybcs_offline_field_encounters.py：5120 行；SHA-256 94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a。
- src/legacy_gui_runtime/ybcs_offline_world_catalog.py：658 行；SHA-256 34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703。

第 7 章常量 61/63/65 位于 field_encounters 第 259–261 行；第 8 章常量 71/73/75 位于第 262–264 行。共享实体常量 STORY_SEVEN_ENTITY_ID=22610 位于第 325 行。源码没有 STORY_EIGHT_ENTITY_ID。

### 2. 第 7 章遭遇清单

| row_id | 类型 | 地图 | source_id | battle_zone_id | placement 行范围 |
|---|---|---:|---:|---:|---|
| B4-S-001 | STORY | 1500 | 61 | 61 | 2654–2693 |
| B4-S-002 | STORY | 1500 | 63 | 63 | 2699–2731 |
| B4-S-003 | STORY | 1500 | 65 | 65 | 2735–2775 |

三条均使用 entity_id=22610，世界实体位置为 (73,81)，approach 为 (73,79)，但各自具有不同的模型、剧情 source、battle anchor 和前置条件。

- source61：模型2016，名称“2等航海师”，battle_anchor=(63,107)，前置 source51、53。
- source63：模型2116，名称“队长”，battle_anchor=(25,49)，前置 source61。
- source65：模型2316，名称“海盗船长_阿肯”，battle_anchor=(26,42)，前置 source61、63；胜利返回 map1367 cell=(35,61)。

map1500 的第 7 章部署来自明确标注的兼容代理策略，不是对已退役零售剧情入口表的 VERIFIED 恢复。YB-345 注释说明 source63 复用同一个原生世界实体，并在 source61 首次胜利后推进。source65 要求前两阶段均完成。

### 3. 第 8 章遭遇清单

| row_id | 类型 | 地图 | source_id | battle_zone_id | placement 行范围 |
|---|---|---:|---:|---:|---|
| B4-S-004 | STORY | 1367 | 71 | 71 | 2784–2821 |
| B4-S-005 | STORY | 1368 | 73 | 73 | 2837–2883 |
| B4-S-006 | STORY | 1369 | 75 | 75 | 2889–2930 |

- source71：模型2315，名称“海盗成员D”，世界位置=(44,100)，approach=(44,98)，battle_anchor=(38,48)，前置 source61、63、65；胜利返回 map1368 cell=(34,70)。
- source73：模型2011，名称“刺客”，世界位置=(34,70)，approach=(34,68)，battle_anchor=(19,81)，前置 source61、63、65、71；胜利返回 map1369 cell=(19,87)。
- source75：模型2316，名称“海盗船长_阿肯”，世界位置=(19,87)，approach=(19,85)，battle_anchor=(60,34)，前置 source61、63、65、71、73；胜利返回 map1373 cell=(110,50)。

source75 的 map1373 是胜利返回目的地，不是本次遭遇发生地图。下一条 source81 从源文件第2938行开始，属于第9章，本批排除。

### 4. 章节归属与地图关联

章节归属来自源码显式常量：

- 第7章：STORY_SEVEN_ZONE_ID=61、STORY_SEVEN_SHIP_AMBUSH_ZONE_ID=63、STORY_SEVEN_CAPTAIN_ZONE_ID=65。
- 第8章：STORY_EIGHT_DEATH_ISLAND_ZONE_ID=71、STORY_EIGHT_FORTRESS_ZONE_ID=73、STORY_EIGHT_CAPTAIN_ZONE_ID=75。

部署地图顺序为：

| 章节 | source_id | 旧地图 | 说明 |
|---|---:|---:|---|
| 7 | 61 | 1500 | 兼容代理地图 |
| 7 | 63 | 1500 | 复用同一实体，前置 source61 |
| 7 | 65 | 1500 | 复用同一实体，前置 source61、63 |
| 8 | 71 | 1367 | 源码注释称为新地图2360的旧地图前身 |
| 8 | 73 | 1368 | 源码注释称新地图2361与旧地图1368场景布局相同 |
| 8 | 75 | 1369 | 第8章后续剧情阶段 |

没有独立 Scenarioinfo 文件。2360/2361 的地图关系只记录为源码注释线索，不当作独立文件来源或 VERIFIED 证据。

### 5. 触发方式及前置剧情

六条均为 source_kind=story、minimum_level=15、minimum_hired_skill_level=2、single_clear=True。剧情 admission 还要求符合条件的当前 solskill offer 与有效的已雇佣 Ability。

| source_id | server_driven_story_trigger | 触发方式 | 前置 source IDs |
|---:|---|---|---|
| 61 | 默认 False | 世界实体交互 | 51、53 |
| 63 | 默认 False | 世界实体交互 | 61 |
| 65 | 默认 False | 世界实体交互 | 61、63 |
| 71 | 默认 False | 世界实体交互 | 61、63、65 |
| 73 | True | 移动完成后的剧情延续 | 61、63、65、71 |
| 75 | True | 移动完成后的剧情延续 | 61、63、65、71、73 |

当 server_driven_story_trigger 为 False 时，entity_record() 发布 type-1 世界实体，旧客户端 08 精确实体交互按 Manhattan 距离严格小于4解析。source61/63/65/71 均属于此路径。

source73/75 显式设置 True，不伪造可点击实体；普通移动完成后按地图寻找唯一合格剧情候选，并检查前置剧情。两条均未声明 trigger_cells，不补造坐标触发格。

### 6. Lapis 绑定对照

只读基线：

- manifests/encounter-bindings-2.2.json
- manifests/story-battle-scenes.json
- docs/integration-notes/s1-encounter.md
- docs/evidence-ledger.md

Lapis S1 candidate_bindings 仍只有 1030→1、1070→3、1090→7、1100→9。本批地图1500、1367、1368、1369均无候选地图绑定。

Lapis 静态场景目录存在 zone61、63、65、71、73、75，标题已逐条写入 CSV。这只证明静态场景元数据存在，不证明地图到 battleZone 的遭遇绑定。

因此六条均标记 NO_LAPIS_BINDING；不把静态场景资源存在误判为 MATCH，也不声称存在直接冲突。

### 7. 本批数量统计

| 章节 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| 第7章 | 0 | 3 | 3 |
| 第8章 | 0 | 3 | 3 |
| **Batch 4** | **0** | **6** | **6** |

N_field=0，N_story=6，N_CSV=6。新增六条均为23个逻辑字段，ybcs_evidence_level 全部为 RECOVERED_SECONDARY。

### 8. MATCH / CONFLICT / UNRESOLVED / UNKNOWN

| review_status | Batch 4 | Batch 1–4 累计 |
|---|---:|---:|
| MATCH | 0 | 3 |
| DIRECT_CONFLICT | 0 | 0 |
| TRIGGER_CONFLICT | 0 | 0 |
| PARTIAL_OVERLAP | 0 | 0 |
| UNRESOLVED_IDENTITY | 0 | 3 |
| NO_LAPIS_BINDING | 6 | 54 |
| LAPIS_ONLY | 0 | 0 |

六条 NO_LAPIS_BINDING：B4-S-001 至 B4-S-006。本批没有发现可成立的直接冲突或身份未解决记录。Chapter UNKNOWN 本批为0，累计仍为 Batch 1 的22条。

### 9. 待核实事项

1. Set.lib 的实际 zone_name.txt 内容未提供，地图名称保持 UNKNOWN。
2. map1500 是第7章兼容代理地图，不代表原版 canonical map identity。
3. map1367/1368 与新地图2360/2361的关联来自源码注释，不是独立 Scenarioinfo 文件。
4. source73 的七单位混合堡垒阵容属于明确的离线策略；旧、新 DEO 未发布可确认敌方人数，零售敌方数量仍未知。
5. Lapis 六个静态战斗场景虽存在，但没有对应 S1 地图遭遇绑定。
6. 六条复用实体 ID 22610；与 Lapis runtime entity ID 的事件级映射尚未建立。

### 10. Batch 1–4 累计统计

| 范围 | 野外 | 剧情 | 合计 |
|---|---:|---:|---:|
| Batch 1–3 | 35 | 19 | 54 |
| Batch 4 | 0 | 6 | 6 |
| **累计** | **35** | **25** | **60** |

CSV 最终为61行（1行表头+60行数据），无空白数据行；标准 CSV 引号解析后每行均为23个逻辑列。

本批只追加 CSV 第56–61行及本 Markdown 章节。未修改此前55行 CSV 和 Batch 1–3 Markdown 内容；未修改其他文件、main、Plan.md、Backlog、证据台账或运行时代码；未创建 PR、未合并、未写入主号仓库。Batch 5 未启动。
