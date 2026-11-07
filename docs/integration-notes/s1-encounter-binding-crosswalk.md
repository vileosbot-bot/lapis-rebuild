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