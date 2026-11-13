# 第一章野怪（野外遭遇）包内深挖探索报告

- 请求编号：ch1-wild-monster-explore-20261113-01
- 仓库：vileosbot-bot/lapis-rebuild
- 基线：main 95c07edad560729c965941a961fb666b47c29197
- 执行分支：docs/ch1-wild-monster-explore-20261113
- 范围：只读探索；不执行原版客户端、不部署、不修改运行时代码、不改 main、不建 PR、不合并。

## 0. 结论摘要

1. YBCS 合并遭遇集合的 63 条是 35 条野外放置 + 28 条剧情战斗，不是 63 条野怪。野外放置表从源码第 1028 行开始，剧情定义从第 1704 行开始，合并集合在第 3248 行形成。
2. 与第一章路线最相关的候选是 map 1020 的 6 条普罗系野怪，以及 map 1030 的 1 条麻黄草。注意：S1 crosswalk 将 map 1020 的 6 条仍标为章节归属 UNKNOWN；map 1030 的麻黄草归 Chapter 1，但它与地图级候选 1030→1 尚无事件级绑定。
3. 第一章明确归属的野外记录共 3 条：map 1030/entity 22030「麻黄草」、map 1060/entity 22060「蛇」、map 1090/entity 22090「野生草」。map 1060 是 1-1 胜利返回图，map 1090 与 story source 7 同图；不能把三者都说成 1-1 前的野怪。
4. 野外触发距离是 Manhattan 距离严格小于 4；20 是局部战场几何半径，不是野外触发半径。野外实体类型为 1；固定客户端已验证的 49/21 typed-near 路径只覆盖类型 101–103，类型 1 走另一个 08 路径，但 08 的 encounter 语义仍未验证。
5. YBCS 离线策略有 1–3 名野外敌人的数量策略标识，但实际随机抽取调用方不在本文件中。可见的 launch 函数接收可选 field_hostile_count；未传时默认按已配置 battle members 数量，早期单模型记录默认一名。
6. 野怪行有金币、经验和掉落字段；这些是 YBCS 离线兼容/重构数据，不是原版服务器奖励证明。原版零售野外刷新、数量、重生节奏、掉落关联和奖励值仍 UNKNOWN。
7. 用户记忆中的「史莱姆」没有出现在 35 条野外放置名称中。草类最接近候选是 model/Ability ID 4010「麻黄草」和 4012「野生草」，但这两个中文名是 YBCS 放置表的标签；由于本轮无法读取 ability.atr 的实际记录正文，不能声称它们就是 ability.atr 原始名称。
8. 当前 Lapis Web 没有第一章野怪运行时接入。S1 crosswalk 对野怪做过审计，但 3 条 MATCH 全是剧情战；野外条目是 unresolved 或 no binding，不是运行时实现。
9. 建议把野怪循环作为独立工作包，放在 S45 商店后、最终 S46 综合验收前；不要把世界实体、触发、战斗入口、掉落/重生硬塞进 S43 属性或 S44 装备模块。

## 1. 证据等级与源文件清单

### 1.1 本报告使用的标签

- VERIFIED：固定哈希的原始静态资源/仓库代码事实；不代表原版服务器运行时行为。
- RECOVERED_SECONDARY：YBCS 2026 离线兼容/重构代码中恢复出的放置、触发或奖励策略；不是原版零售服务器证明。
- RECONSTRUCTION_POLICY：建议 Lapis 为单机可玩性明确采用的规则。
- UNKNOWN：缺少原始服务端/资源记录/事件级映射，不能确认。

本报告不把任何 YBCS 野怪放置或 YBCS 野怪奖励标为 VERIFIED。

### 1.2 主要输入与哈希

| 源文件 / 成员 | 大小 / 规模 | SHA-256 | 本报告用途与等级 |
|---|---:|---|---|
| src/legacy_gui_runtime/ybcs_offline_field_encounters.py | 5,120 行 | 94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a | 35 条野外放置、解析、准入、战斗组装、离线边界；RECOVERED_SECONDARY |
| runtime/client/NRes/Set.lib | 112,730 bytes | ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe | 原始资源归档；VERIFIED 静态资源 |
| Set.lib::ability.atr | 109,656 bytes；724 条数据记录 | 0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b | Ability/怪物属性成员；哈希与记录规模 VERIFIED，4001–4016 实际名称本轮 UNKNOWN |
| Set.lib::itemtbl.atr | 339,967 bytes；2,073 条数据记录 | cf5c9786810b80619ae3133ad77a27d9fb51f2078c30c947c482483d1030eb2e | item 4002/4003 名称和描述；VERIFIED 静态资源 |
| Set.lib::levelabl.atr | 70,666 bytes | 0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc | 当前 M7.1 EXP authority 的原始数值成员 |
| docs/integration-notes/s1-encounter-binding-crosswalk.md | 623 行 | Git blob 7817014d0b697c1cdab752d38c132e1c177d1975 | S1 野外/剧情归属与绑定审计 |
| docs/integration-notes/s1-encounter-binding-crosswalk.csv | CSV 对照表 | Git blob 141e6abbbecc62baf86e0d20fdd8cbfa008f4ef3 | 逐条事件对照；本报告使用 Chapter 1 野外记录 |
| manifests/encounter-bindings-2.2.json | 160 行 | Git blob ae1438c38900fdf95c6a862cb10870e971bd34a1 | 原生交互边界与候选 map→battleZone |

说明：
- S3 source inventory 记录 ability.atr 的 46 字段布局、724 个唯一 Ability ID，名称字段在 index 44（0-based）；本轮能确认成员哈希与布局，但当前 Library 文件接口没有提供该二进制成员的可读行正文/授权 raw-byte materialization。因此 4001–4016 的 ability.atr 原始名称、韩文拼写和逐行号均保持 UNKNOWN。
- itemtbl 导出中的 4002/4003 行级记录分别指向原始 itemtbl.atr 第 1803/1804 行，包含 raw-line SHA-256；它们的物品身份/名称可由固定哈希资源确认。
- ybcs_offline_field_encounters.py 的 35 条野外行和所有离线规则均为 RECOVERED_SECONDARY，不是原版零售服务端数据。

## 2. 野外遭遇全表：35 条

### 2.1 字段说明

- entity_id：YBCS 离线世界实体 ID。
- model_id：旧 Ability/模型资源 ID；不要与 entity_id 混淆。
- xy：世界地图格坐标 (first, second)。
- approach：放置表声明的接近坐标 (approach_first, approach_second)。
- HP/MP、basic/enemy、gold/EXP：放置行中的字段值。basic/enemy 是源码字段，不应直接当成最终每击伤害；实际战斗伤害仍由旧 Ability 物理档案及离线战斗策略计算。
- 掉落名是放置策略标签；实际 item identity 需由 itemtbl 校验。

### 2.2 map 1010 — 6 条

| entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---|---|---|---:|---:|---:|---|---:|
| 22010 / 4004 | 普罗首领R | (158,36) / (157,35) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1029–1046 |
| 22710 / 4002 | 格林普罗 | (157,45) / (156,44) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1047–1064 |
| 22711 / 4004 | 普罗首领R | (143,49) / (142,48) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1065–1083 |
| 22012 / 4002 | 格林普罗 | (127,57) / (126,56) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1084–1102 |
| 22013 / 4004 | 普罗首领R | (137,69) / (136,68) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1103–1121 |
| 22014 / 4002 | 格林普罗 | (136,84) / (135,83) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1122–1140 |

### 2.3 map 1020 — 6 条（第一章路线重点候选）

| entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---|---|---|---:|---:|---:|---|---:|
| 22020 / 4006 | 普罗首领B | (4,144) / (3,143) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1141–1158 |
| 22720 / 4001 | 雷德普罗 | (12,142) / (11,141) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1159–1176 |
| 22721 / 4006 | 普罗首领B | (37,153) / (36,152) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1177–1195 |
| 22022 / 4001 | 雷德普罗 | (37,139) / (36,138) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1196–1214 |
| 22023 / 4006 | 普罗首领B | (54,130) / (53,129) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1215–1233 |
| 22024 / 4001 | 雷德普罗 | (49,121) / (48,120) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1234–1252 |

map 1020 的六条都是最低等级 1 的普罗系放置。若把六条记录各按一次胜利字段相加，合计为 750 EXP、240 金币；这是放置表数值求和，不是实机实测 payout，也不证明六条在原版服务器中均可重复击杀。

### 2.4 map 1040 — 6 条

| entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---|---|---|---:|---:|---:|---|---:|
| 22040 / 4005 | 普罗首领G | (119,147) / (118,146) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1253–1270 |
| 22740 / 4003 | 布鲁普罗 | (102,142) / (101,141) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1271–1288 |
| 22741 / 4005 | 普罗首领G | (104,132) / (103,131) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1289–1307 |
| 22042 / 4003 | 布鲁普罗 | (105,123) / (104,122) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1308–1326 |
| 22043 / 4005 | 普罗首领G | (93,107) / (92,106) | 150/100 | 10/8 | 40/150 | 4002 便宜药草 | 1327–1345 |
| 22044 / 4003 | 布鲁普罗 | (85,105) / (84,104) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1346–1364 |

map 1040 的六条在 crosswalk 中归 Chapter 2：该地图与 story source 11/15 同图。不能把它们列为第一章 1-1 前置野怪。

### 2.5 map 1050 — 6 条

| entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---|---|---|---:|---:|---:|---|---:|
| 22050 / 4009 | 花蛇 | (5,239) / (4,238) | 150/100 | 10/8 | 100/200 | 4003 普通药草 | 1365–1382 |
| 22750 / 4011 | 蛇 | (22,250) / (21,249) | 150/100 | 10/8 | 100/150 | 4003 普通药草 | 1383–1400 |
| 22751 / 4009 | 花蛇 | (24,240) / (23,239) | 150/100 | 10/8 | 100/200 | 4003 普通药草 | 1401–1419 |
| 22052 / 4011 | 蛇 | (41,239) / (40,238) | 150/100 | 10/8 | 100/150 | 4003 普通药草 | 1420–1438 |
| 22053 / 4009 | 花蛇 | (50,238) / (49,237) | 150/100 | 10/8 | 100/200 | 4003 普通药草 | 1439–1457 |
| 22054 / 4011 | 蛇 | (61,223) / (60,222) | 150/100 | 10/8 | 100/150 | 4003 普通药草 | 1458–1476 |

map 1050 的章节归属 UNKNOWN；不能仅凭它在路线图附近就认定是第一章。

### 2.6 map 1300 — 3 条

| entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---|---|---|---:|---:|---:|---|---:|
| 22300 / 4001 | 雷德普罗 | (106,142) / (104,142) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1477–1494 |
| 22301 / 4002 | 格林普罗 | (130,142) / (128,142) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1495–1512 |
| 22302 / 4003 | 布鲁普罗 | (154,142) / (152,142) | 100/100 | 10/8 | 40/100 | 4002 便宜药草 | 1513–1530 |

map 1300 的章节归属 UNKNOWN。源码注释把它描述为后续可达的 western field，并指出模型资源组为 B4001/B4002/B4003；这仍是离线路线/放置说明。

### 2.7 map 1030 / 1060 / 1090 — Chapter 1 的三条野外记录

| map | entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | drop | 源码行 |
|---:|---|---|---|---:|---:|---:|---|---:|
| 1030 | 22030 / 4010 | 麻黄草 | (67,105) / (66,104) | 150/100 | 10/8 | 150/200 | 4003 普通药草 | 1531–1548 |
| 1060 | 22060 / 4011 | 蛇 | (59,97) / (58,96) | 150/100 | 10/8 | 100/150 | 4003 普通药草 | 1549–1566 |
| 1090 | 22090 / 4012 | 野生草 | (74,64) / (73,63) | 150/100 | 10/8 | 100/150 | 4003 普通药草 | 1567–1584 |

章节归属依据：
- map 1030 与 story source 1（1-1）同图；
- map 1060 是 story source 1 的明确胜利返回图，注释称其为城堡走廊入口并连接 1-2；
- map 1090 与 story source 7 同图。
其中 22030 和 22090 与 Lapis map-level 候选有身份未解决问题；22060 没有 S1 candidate binding。

### 2.8 后续章节高阶野怪

| map | entity/model | 放置名称 | xy / approach | HP/MP | basic/enemy | gold/EXP | 最低等级 | skill 字段 | drop | 源码行 |
|---:|---|---|---|---:|---:|---:|---:|---:|---|---:|
| 1310 | 22400 / 4013 | 斯塔克 | (58,50) / (58,48) | 250/100 | 10/8 | 250/350 | 36 | 5 | 4003 普通药草 | 1585–1603 |
| 1341 | 22401 / 4014 | 斯塔克B | (101,125) / (102,124) | 250/100 | 10/8 | 300/400 | 36 | 5 | 4003 普通药草 | 1605–1623 |
| 1345 | 22402 / 4015 | 石龟 | (97,125) / (97,123) | 250/100 | 10/8 | 300/400 | 36 | 5 | 4003 普通药草 | 1625–1644 |
| 1345 | 22403 / 4016 | 石龟B | (99,89) / (101,89) | 300/100 | 10/8 | 350/450 | 36 | 5 | 4003 普通药草 | 1645–1664 |
| 1345 | 22404 / 4016 | 石龟B | (99,53) / (99,51) | 300/100 | 10/8 | 350/450 + 援军 300/400 | 56 | 7 | 4003 encounter-level 一份 | 1670–1700 |

22404 的援军是 model 4015「石龟」，HP/MP 250/100、金币/经验 300/400；因此该组合配置的总战斗 HP 为 550，配置总金币/经验为 650/850。源码注释明确说这是版本化 offline policy：B4016+B4015 组成一组，共享 encounter-level item 4003 一份。map 1310、1341、1345 分别属于后续 Chapter 3/4/5 地图，不属于第一章 1-1 前置内容。

### 2.9 地图分布与求和核对

| map | 放置数 | 放置表金币合计 | 放置表 EXP 合计 | 章节审计 |
|---:|---:|---:|---:|---|
| 1010 | 6 | 240 | 750 | UNKNOWN |
| 1020 | 6 | 240 | 750 | UNKNOWN；但在当前 Web route 040/048 路线上 |
| 1030 | 1 | 150 | 200 | Chapter 1 |
| 1040 | 6 | 240 | 750 | Chapter 2 |
| 1050 | 6 | 600 | 1,050 | UNKNOWN |
| 1060 | 1 | 100 | 150 | Chapter 1 |
| 1090 | 1 | 100 | 150 | Chapter 1 |
| 1300 | 3 | 120 | 300 | UNKNOWN |
| 1310 | 1 | 250 | 350 | Chapter 3 |
| 1341 | 1 | 300 | 400 | Chapter 4 |
| 1345 | 3 | 1,300 | 1,700 | Chapter 5 |
| **合计** | **35** | **3,640** | **6,550** | — |

map 1345 的求和已把 22404 的援军奖励计入。表内求和是配置字段加总，不等于已验证的原版奖励发放或实机掉落数量。

## 3. 用户记忆中的史莱姆与草类怪

### 3.1 史莱姆

- 35 条野外放置的 name 字段中没有「史莱姆」。
- 本轮没有取得 ability.atr 的 4001–4016 原始名称行，因此不能断言「史莱姆」在原始 Ability 表中不存在，也不能猜一个 ID。
- 结论：UNKNOWN。目前只能说它不是这 35 条 YBCS 放置表直接使用的名称。

### 3.2 草类候选

| model/Ability ID | YBCS 放置标签 | 地图 | 行号 | 判断 |
|---:|---|---:|---:|---|
| 4010 | 麻黄草 | 1030 | 1531–1548 | 草类最接近候选；RECOVERED_SECONDARY |
| 4012 | 野生草 | 1090 | 1567–1584 | 草类最接近候选；RECOVERED_SECONDARY |

另有 4009「花蛇」、4011「蛇」，不属于草类标签。

重要限制：上表名称是 YBCS placement 的显式字符串，不是本轮直接读取的 ability.atr name 字段。只有原始 ability.atr 的第 44 列（名称列）才可以最终确认原始中文/韩文名称。该名称映射保持 UNKNOWN，不能把「麻黄草/野生草」写成已核实的 Ability 原名。

## 4. 触发、准入、敌人数与奖励

### 4.1 世界触发

RECOVERED_SECONDARY：
- YbcsOfflineFieldEncounterPlacement.entity_record() 将野怪发布为旧世界实体记录：entity ID、GB18030 名称、entity type 1、世界坐标 x/y、model ID。
- resolve_offline_field_encounter() 默认 exclusive_manhattan_limit=4，实际条件为 Manhattan 距离严格小于 4。
- 若传入 entity_positions，用当前实体实时位置；否则用放置表 (first,second)。
- 只在候选恰好一条时返回；0 条或多条都返回 None。
- resolve_offline_field_encounter_entity() 支持按实体 ID 精确匹配，并再次检查距离。

源码：
- 常量与战场几何：src/legacy_gui_runtime/ybcs_offline_field_encounters.py L217–244。
- Placement 字段与 entity record：同文件 L575–590、L979–988。
- 唯一候选和距离解析：同文件 L3431–3509。

不是 20 格触发：
- FIELD_ENCOUNTER_BATTLE_RADIUS=20 是 0x98 扩展战斗入口使用的局部战场几何半径；注释解释为 40×40 战斗格。
- 它不是世界地图上的怪物检测/交互距离。
- 当前文件有 OFFLINE_FIELD_RANDOM_HOSTILE_MINIMUM=1、MAXIMUM=3 和 offline-field-uniform-hostile-count-1-to-3-v1 策略 ID。battle launch 可选接收 field_hostile_count，并校验范围 1..3；若调用方不传，代码默认使用配置的 battle members 数量。早期单模型行默认一名；若显式传 2/3，会循环使用已配置模型成员。
- 该文件没有展示产生均匀随机数的调用方，因此只能确认 1–3 人数量策略接口，不能宣称本文件已经恢复了完整随机抽取实现。

源码：同文件 L232–244、L3888–3985；随机数量策略名是 RECOVERED_SECONDARY，不是 VERIFIED。

### 4.2 原生网络边界与 DEO

固定客户端 S1 审计的 VERIFIED 边界：
- entity type 101–103 且 Manhattan <4：49/21 typed-near action；
- 其他 entity type：独立 08 路径；
- 49/21 不可直接命名为 start encounter；两种交互路径的 encounter semantics 都是 UNVERIFIED；
- 战斗入口由显式 0x98 mode 1 BattleEntry 提供 battleZoneId，不应简单把客户端交互包等同于战斗启动。

YBCS 野怪实体 type=1，因此不能把 101–103 的 49/21 路径直接套用到它；S1 对照表明确记录 type 1 走 08 路径。DEO/地图资源不是已证明的世界接近触发器；本轮恢复到的是实体发布、近距离解析和显式战斗入口链路。

出处：
- manifests/encounter-bindings-2.2.json L20–47、L84–120。
- docs/integration-notes/s1-encounter.md L31–57。
- docs/integration-notes/s1-encounter-binding-crosswalk.md L94–97。

### 4.3 等级准入

Placement 默认 minimum_level=1，合法范围 1..100。实际有效规则：

- map 1010/1020/1030/1040/1050/1060/1090/1300：minimum_level=1。
- map 1310、1341、1345 的 4 条普通高阶记录：minimum_level=36。
- map 1345/entity 22404：minimum_level=56。

容易误判的地方：高阶行还配置 minimum_hired_skill_level=5/7，但 offline_field_encounter_admission_reason() 在检查角色等级后，对 source_kind == 'field' 直接返回通过，不会进入 hired-skill 检查。因此 5/7 是 placement 原始配置字段，不是当前野外准入的实际技能门槛。

源码：同文件 L575–590、L827–913、L3277–3354。

### 4.4 战斗区与战斗组装

- 野外 placement 未显式设置 battle_zone_id。
- effective_battle_zone_id 因此回退到 map_id 的旧地图编号：例如 map 1020 → effective zone 1020、map 1030 → effective zone 1030。
- 这是 YBCS offline fallback，不是已恢复的原版零售 map→battleZone 规则。
- S1 manifest 的 1030→1 是 story source 1 的候选绑定；不能自动套到 map 1030 的 wild entity 22030。
- battle launch 使用旧 Ability battle profiles 和 offline battlefield geometry；随机 1–3 的实际调用方、原版部署格、原版最终战斗区仍未证明。

源码：同文件 L950–958、L3888–3985、L4872–4910；S1 crosswalk L39、L79–80。

### 4.5 金币、经验与掉落

YBCS offline 口径：
- placement 行保存 victory_gold、victory_experience、drop_item_id、drop_item_name。
- total_victory_gold / total_victory_experience 将主怪和显式 reinforcements 的旧行奖励相加。
- 22404 的 B4016+B4015 组合因此配置为 650 金币、850 EXP、一个 encounter-level item 4003。
- 文件边界把 fixed/summed gold、versioned offline EXP/drop selection、map-load respawn 明确列为离线策略。
- 原版 retail 的怪物—物品关联、掉落概率、奖励值和重生节奏仍 UNKNOWN。

itemtbl 静态物品身份：VERIFIED
- item 4002：便宜药草，原始 itemtbl.atr 第 1803 行，raw-line SHA-256 816b4bbb221eb9c14502852e835d1630ef0add57261084081c6f3acb5d55f1f5；描述为到处可获得、少量恢复生命力。
- item 4003：普通药草，原始 itemtbl.atr 第 1804 行，raw-line SHA-256 284a6beca7805901835790ac9bea2490047c18e9d7151ca8dc832d6ef36ba3cf；描述为容易得到、一般恢复生命力。
- YBCS 的 validate_offline_field_drop_resources() 会确认选定 ID 存在于 itemtbl，并校验名称一致；它不恢复原版掉落概率或怪物掉落表。

源码：野怪行 L1029–1700；掉落验证 L3577–3610；策略边界 L4872–4910。itemtbl 记录见 docs/integration-notes/s4-shop-catalog-data.json 的 itemTable.records 中 itemResourceId 4002/4003。

### 4.6 与 Lapis 当前 S42 故事战斗的奖励对照

当前 Lapis 第一章 story source 1：
- fieldMapId=1030，battleZoneId=1；
- 进入条件是移动路线完成后命中 story gate cells，不是野怪 proximity；
- story resolution 明确写 rewardSettlement='not-applied'；
- returnFromBattle() 对 activeChapter1StoryBattle 单独处理，不调用普通 training settlement。

所以当前 S42 的故事首战不发金币/EXP，是 Lapis 当前重构策略；野外战若要承担首战前练级/打钱功能，必须拥有独立、明确的 field reward settlement，不能把 story settlement 打开，也不能把 YBCS 字段值冒充原版服务器奖励。

出处：web/src/m4-runtime-integration.ts L92–132、L1389–1444；规划文件 docs/planning/ch1-attr-equip-shop-plan.md L108–112、L337–350。

## 5. 第一章 Web 现状与接入缺口

### 5.1 S1 遭遇绑定到底覆盖什么

结论：S1 做过野外数据审计，但没有把野外实体接入 Lapis 运行时。当前三个 MATCH 是 story source 1/3/7；不是三条野怪。

- S1 candidate bindings：1030→1、1070→3、1090→7、1100→9，全部 RECOVERED_SECONDARY，retail_verified=false。
- Chapter 1 野外：
  - B1-F-001 map 1030/entity 22030：UNRESOLVED_IDENTITY；1030→1 是地图级候选，未 join 到该 wild entity。
  - B1-F-002 map 1060/entity 22060：NO_LAPIS_BINDING。
  - B1-F-003 map 1090/entity 22090：UNRESOLVED_IDENTITY；1090→7 是地图级候选，未 join 到该 wild entity。
- map 1020 六条野怪 B1-F-016–021 在 crosswalk 中是 chapter UNKNOWN / NO_LAPIS_BINDING。
- 其余 map 1010/1040/1050/1300 等也没有第一章野怪 runtime binding。

出处：
- docs/integration-notes/s1-encounter-binding-crosswalk.md L55–86。
- docs/integration-notes/s1-encounter-binding-crosswalk.csv L2–4、L8–13、L17–22。
- manifests/encounter-bindings-2.2.json L84–120。

### 5.2 当前已经有的基础

| 已有能力 | 当前文件/函数 | 实际范围 |
|---|---|---|
| 第一章地图节点 | web/src/world/ch1-world-policy.ts CH1_MAPS | 只列 1000、1020、1030、1060 |
| route 040 | 同文件 ROUTE_SPECS | 1000→1020 |
| route 048 | 同文件 ROUTE_SPECS | 1020→1030 |
| 路线触发/提交 | m4-runtime-integration.ts handleChapter1Spatial() | 只处理场景切换 |
| 1-1 剧情入口 | m4-runtime-integration.ts handleChapter1StoryGate() | map 1030 的 story gate cells → battleZone 1 |
| 通用世界实体类型 | world-model.ts WorldEntityKind | 类型包含 encounter，但没有野怪目录/实体集合 |
| 通用交互范围 | world-model.ts canInteract() | Manhattan entity radius |
| 通用 spatial interaction trigger | spatial-trigger.ts InteractionZoneTrigger | 可表达交互区，但当前 CH1 policy 没有野怪 triggers |
| 战斗 UI | scene.ts enterBattle()/applyBattleEntry()；battle.ts beginBattle() | 能进入指定 battleZone，并可用 ReconstructionBattleSetup 提供敌人 |
| M7 怪物 catalog | monster-archetype-catalog.ts、m7-encounter-groups.ts | M7 训练怪物/战斗内分组；不是 4001–4016 的世界野怪目录 |

### 5.3 缺口清单

| 缺口 | 现有文件/函数 | 还缺什么 |
|---|---|---|
| 地图/路线覆盖 | ch1-world-policy.ts L9、L28–33、L63–84 | route 040/048 已有；map 1010/1040/1050/1300 不在 CH1_MAPS。若只做第一章候选，先确定 map 1020 六条是否作为 reconstruction content 纳入，不能因路线相连就提升章节归属。 |
| 野怪世界数据 | data/ch1-world-catalog/world-catalog.json、route-gate-markers.json | 现有目录是地图/路线准备数据，不含 35 条野怪实体 runtime catalog。需要单独的数据表：map、entity ID、model ID、格坐标、approach、最低等级、battle roster、奖励、掉落策略、证据标签。 |
| 野怪实体/交互 | world-model.ts、ch1-world-authority.ts、m4-runtime-integration.ts interactWorld() | CH1 authority 目前只建吉奥老师 NPC；interactWorld 的实体列表是 M5 training entities 或通用 WORLD_ENTITIES，没有 CH1 wild actors。需加 field encounter authority、实体 ID 校验、唯一候选、等级拒绝提示和战后重生状态。 |
| 触发语义 | runtime-boundaries.ts、spatial-trigger.ts、s1-encounter.md | 可复用 Manhattan trigger / interact trigger 结构，但 type 1 的 08 行为 encounter 语义仍 UNKNOWN。把 YBCS 的 <4 用作 Lapis 行为时必须标 RECONSTRUCTION_POLICY，不能称为已恢复零售语义。 |
| BattleEntry | runtime-boundaries.ts BattleEntry；scene.ts enterBattle() | 当前 BattleEntry 主要携带 battleZoneId/geometry/provenance；没有 wild entity ID、source kind、return state、reward source、drop source、respawn generation。story 1030→1 不能覆盖 wild 1030→effective fallback 1030。 |
| 敌人数据适配 | battle.ts beginBattle()；monster-archetype-catalog.ts | 需把旧 model 4001–4016、ability.atr stats、visual family、AI/role、battle group 转为 ReconstructionBattleSetup.enemies。现有 M7 archetype IDs 是 m7-* 训练怪物 ID，不是旧 Ability IDs。 |
| 战斗结算 | m4-runtime-integration.ts returnFromBattle()/applyBattleSettlement() | 现有结算针对 M5/M7 training；story source 1 明确不结算。需独立 field settlement：EXP、金币、item 4002/4003 policy、receipt 防重、失败/撤退、等级提升与技能/属性点联动。 |
| 重生与存档 | M7 Save/Progression/Inventory 相关 authority | 需定义 map-load respawn、击杀后状态、奖励 receipt、重复进入地图、断线/刷新读档和 item 背包满时行为。YBCS 的 map-load respawn 只是 offline policy，不是 retail cadence。 |
| 野外 UI | web/src/ui/field-hud.ts renderFieldHud() | 当前只有通用 E 交互提示；没有野怪名、等级门槛、距离/可交互状态、怪物刷新状态。 |
| 战斗结果 UI | web/src/ui/battle-hud.ts renderBattleHud() | 有目标、HP、阶段、技能和返回按钮；没有 field encounter source、金币/EXP/掉落结果和重生提示。 |
| 自动验收 | web/e2e/s42-ch1-end-to-end-acceptance.spec.ts | S42 是 story source 1 验收；需要独立 wild encounter E2E 验证路线、单实体触发、battle roster、等级门槛、奖励、掉落、返回、重生，再由最终 S46 验证 wild progression + story 1-1。 |

### 5.4 route 040/048 的实际边界

当前 Lapis CH1 policy：
- CH1_MAPS：1000、1020、1030、1060。
- route 040：1000→1020。
- route 048：1020→1030。
- route 041/049 是返回方向。

所以 map 1020 的六条野怪是最值得优先评估的路线候选；map 1030 的麻黄草是 1-1 gate 同图的另一个独立野外实体。map 1010、1040、1050、1300 不能直接称为当前 Lapis 第一章路线已经可达。尤其 map 1040 已由 crosswalk 归 Chapter 2。

## 6. 与《属性 + 装备 + 商店 第一章实施规划》的对接

### 6.1 规划文件核对

调研读取的规划文件：
- 分支：docs/ch1-attr-equip-shop-plan-20261113
- 文件：docs/planning/ch1-attr-equip-shop-plan.md
- Git blob SHA-1：af23febeb785a72a977c990235db5867a351452c

该文件的裁定事项表实际编号为 #1–#20，共 20 项，不是 21 项；第 20 项是是否把 M7.2/S43–S46 写入 Plan/GOAL。表中没有第 21 行。本报告按实际存在的 20 项逐项核对，不补造第 21 项。

### 6.2 20 项待裁定事项受野怪影响的逐项判断

| # | 规划待裁定事项 | 野怪带来的影响 | 判断 |
|---:|---|---|---|
| 1 | Lv1 是否立即有第 1 个属性点 | 野怪提供 EXP，不改变创建角色是否立即发点的规则 | 不变 |
| 2 | 属性分配发生时机 | 野怪可能让角色升级，但不决定属性 UI/分配时机 | 不变 |
| 3 | 六维属性到战斗属性的完整映射 | 野怪会成为验证属性贡献的额外战斗样本；不提供新的六维映射证据 | 不变，增加验收样本 |
| 4 | 是否允许洗点 | 与野怪触发/奖励无直接关系 | 不变 |
| 5 | 老存档历史属性点迁移 | 野怪奖励只增加新 EXP，不改变历史属性点迁移原则 | 不变 |
| 6 | M7.1 Lv1–65 EXP authority / Lv66–100 延期 | 野怪 EXP 必须进入现有 M7.1 authority，不能另造第三条经验曲线；地图重生可重复获取 EXP，需做经济/升级节奏验收 | 直接受影响 |
| 7 | 100/100/150 与 13/13/19 的 Ability/actor ID 对照 | 野怪又提供 4001–4016 的 HP/MP 锚点；必须把野怪 ID 与 story roster ID 分开。用户已选择②：story HP 100/100/150 保留，不削弱 story 怪，靠成长/装备/分波解决 | 直接受影响；story HP 决策不变 |
| 8 | 第一章装备槽位/类型 | 野怪当前配置掉落 4002/4003 药草，不改变 weapon/armor/accessory 三槽 | 不变 |
| 9 | 新手矛 item 4 是否默认发放 | 野怪掉落表没有 item 4，不改变默认装备发放决策 | 不变 |
| 10 | 装备要求/职业/阶段/等级映射 | 不改变装备资格规则；野怪可用于验证装备加成是否生效 | 不变，增加测试 |
| 11 | 耐久、修理、强化 | 若未来引入装备耐久，重复刷野怪会成为耐久消耗场景；MVP 暂不做的建议仍成立 | 间接受影响 |
| 12 | 首战前商店地图、开放顺序、NPC | 现在还需确认 route 040/048 上的野怪是否构成首战前成长路线；商店地图仍必须独立核对，不能把野怪可达当成商店可达 | 直接受影响 |
| 13 | 商店目录过滤和 120 项截断 | 不改变 itemtbl 商店候选过滤规则 | 不变 |
| 14 | 只买不卖/154 项半价白名单 | 野怪金币会改变玩家现金流，卖出白名单的经济影响更大；白名单规则本身不由野怪证据决定 | 间接受影响 |
| 15 | 有限库存、补货、背包 28 行限制 | 野怪掉落 4002/4003；需定义物品堆叠、背包满、重复掉落、map-load respawn 后重复获取规则 | 直接受影响 |
| 16 | program 13 NPC 商店与 Quest2 双重入口 | 与野怪触发/结算无关 | 不变 |
| 17 | story 首战 20 怪 roster、两职业是否都过 S42 | 野怪 1–3 敌人策略必须与 story 20 怪验收分开；不得因野怪更弱而减少 story roster | 直接受影响；story 20 目标不变 |
| 18 | 玩家是否允许使用技能 | 野怪使用同一玩家战斗规则；不构成禁用技能的理由 | 不变 |
| 19 | story 首战是否仍不发 EXP/金币 | 建议继续保持 story settlement not-applied；野怪循环成为战前 EXP/金币/补给来源 | 直接受影响；建议维持不奖励 |
| 20 | M7.2/S43–S46 是否写入 Plan/GOAL | 现在需要为野怪世界实体、触发、BattleEntry、结算、重生增加单独工作包/队列 | 直接受影响 |

### 6.3 推荐工作包结构

不建议把野怪实现混进 S43 属性模型、S44 装备 stat adapter 或 S45 商店交易代码。野怪是独立的世界遭遇闭环，涉及地图实体、交互协议、战斗入口、敌人组装、奖励、掉落和重生。

推荐结构：
1. M7.2 / GOAL 队列 7 保持聚焦：S43 属性成长、S44 装备、S45 商店。不要把野怪的世界实体/触发逻辑塞进这三个阶段。
2. 新增 M7.3 / GOAL 队列 8：第一章野外遭遇循环，放在 S45 后、最终验收前。范围包括：
   - 野怪目录与证据标签；
   - route 040/048 的可达性与地图格碰撞校验；
   - map 1020 六条候选与 map 1030 麻黄草的范围批准；
   - entity ID / model ID / ability stats / visual binding；
   - 唯一候选、Manhattan <4、等级门槛；
   - field BattleEntry、战斗 roster、返回位置；
   - M7.1 EXP、金币、掉落、receipt 防重、重生、背包满处理；
   - field UI 与独立 E2E。
3. 当前 S46 保留为最终综合验收，但验收范围扩展为：野怪成长/补给循环 → 1-1 story battle。S42 单链仍只在最终集成候选上跑一次；story roster/HP 不因野怪接入而修改。

如果项目希望不改变 S43–S46 编号，可把新增实现工作包标为 S45-W（M7.3/queue8 的野怪实现），插在 S45 与 S46 之间；S46 仍负责最终集成验收。关键是工作包职责分离，不是编号名称。

### 6.4 对 1-1 平衡的具体影响

- map 1020 六条低阶放置的表内总奖励为 750 EXP / 240 金币；如果六条都各结算一次，足以成为早期成长来源，但 map 1020 的 Chapter attribution 仍 UNKNOWN。
- map 1030 麻黄草单条配置 200 EXP / 150 金币，和 story gate 位于同一张地图，但它是独立 world entity，不得复用 story source 1 的 BattleEntry。
- map 1020 的普通怪 HP 100、首领 HP 150；每次野外战斗数量策略候选为 1–3 人。因此单次 encounter 的总敌人数量和总 HP 通常远小于 story 1-1 的 20 怪目标，但单个怪物 HP 会与 story 100/150 锚点重叠。
- map 1310/1341/1345 的 250–550 HP 高阶怪与第一章早期平衡无关；其等级门槛分别为 36/56。
- 若采用 map-load respawn，750 EXP/240 金币的 map 1020 记录和 200 EXP/150 金币的 map 1030 记录可能形成可重复 farm。必须明确重生、奖励 receipt、等级成长速度和补给消耗；不能默认无限重复奖励不会影响 S42。
- 用户已选②：story 怪 HP 100/100/150 保持原值；优先用属性成长、装备、补给和分波/战斗入口来验证是否能赢。野怪数据不构成削弱 story 怪的理由。

## 7. 未解决事项与停止门

| 项目 | 状态 | 下一步所需证据 |
|---|---|---|
| ability.atr 中 4001–4016 的原始中文/韩文名称 | UNKNOWN | 可读的 ability.atr 行导出或原始成员字节；按 name 列 index 44 精确解析 |
| 「史莱姆」对应 Ability/model ID | UNKNOWN | 原始 ability.atr 名称行及世界放置实体 join；不凭记忆猜 ID |
| 原版零售野怪刷新表、实际刷新坐标/数量/重生周期 | UNKNOWN | 原版服务端/历史原始表或可重复的隔离证据；YBCS 离线表不能升级 |
| 原版 monster→item 掉落关联、概率、数量 | UNKNOWN | 原版资源/服务端证据；itemtbl 只证明物品存在 |
| 野外 map→battleZone 原版映射 | UNKNOWN | 显式 BattleEntry/session 历史证据；不得把 YBCS map_id fallback 当成零售规则 |
| map 1020 六条是否正式归第一章 | UNKNOWN | Scenario/路线阶段归属证据；crosswalk 当前保留 UNKNOWN |
| 野怪 model 4001–4016 到 Lapis visual/CombatantStats 的映射 | UNKNOWN | 原始 Ability/动画资源解析与逐 ID crosswalk |
| 1–3 名随机敌人的实际抽取调用方 | UNKNOWN | 调用 build_offline_field_encounter_launch 的完整 caller/随机源 |
| 掉落和重生的 Lapis 持久化/防重规则 | RECONSTRUCTION_POLICY 待批准 | 明确 reward receipt、地图重生、背包满/堆叠行为 |

本轮未执行原版客户端、未运行任何未知二进制、未公开部署、未付费；没有修改任何运行时代码、main、主号仓库、规划分支或 S1 相关分支。没有创建 PR，也没有合并。

## 8. 主要代码与文档定位索引

| 路径 | 行号 | Git blob SHA-1 / SHA-256 | 用途 |
|---|---:|---|---|
| src/legacy_gui_runtime/ybcs_offline_field_encounters.py | 1028–1701 | SHA-256 94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a | 35 条野外放置 |
| 同上 | 217–244 | 同上 | type、等级门槛常量、20 战场半径、1–3 敌人策略 |
| 同上 | 575–590、827–946 | 同上 | placement 数据模型、准入字段、reinforcement 总奖励 |
| 同上 | 979–988 | 同上 | entity_record / entity_type=1 |
| 同上 | 3277–3354 | 同上 | minimum_level 与 field hired-skill bypass |
| 同上 | 3431–3509 | 同上 | Manhattan <4、唯一候选、精确 entity ID |
| 同上 | 3577–3610 | 同上 | itemtbl 掉落物验证 |
| 同上 | 3888–3985 | 同上 | 野外战斗组装、可选 field_hostile_count |
| 同上 | 4872–4910 | 同上 | offline policy 与 retail unresolved 边界 |
| docs/integration-notes/s1-encounter-binding-crosswalk.md | 16–40、55–96 | Git blob 7817014d0b697c1cdab752d38c132e1c177d1975 | 章节归属、S1 绑定状态、UNKNOWN 边界 |
| docs/integration-notes/s1-encounter-binding-crosswalk.csv | 2–4、17–22 | Git blob 141e6abbbecc62baf86e0d20fdd8cbfa008f4ef3 | Chapter 1 野外和 map 1020 候选逐行对照 |
| manifests/encounter-bindings-2.2.json | 20–47、84–120 | Git blob ae1438c38900fdf95c6a862cb10870e971bd34a1 | VERIFIED 原生边界、RECOVERED_SECONDARY map bindings |
| docs/integration-notes/s1-encounter.md | 31–75 | Git blob 65dbb670b2a32358354092d0028886c36808d43a | 49/21、08、0x98 边界 |
| web/src/world/ch1-world-policy.ts | 9、28–33、63–84 | Git blob 25fcd9af9e3553abd6fe3d8c87c5eb21447b8d73 | CH1 map list、route 040/048 |
| web/src/m4-runtime-integration.ts | 92–132、1362–1444、1777–1850 | Git blob 6a0c9f7777ecb9922aae727ced508a3121d6ecfc | story 1030→1、story no reward、CH1 route/story handlers |
| web/src/scene.ts | 726–755 | Git blob 2627bb94e23f58737ffc7f9a7d504be7206406f8 | BattleEntry 与 battle setup |
| web/src/battle.ts | 184–240 | Git blob 078af64538ba396ced0ef8fbd64e0d3671d4bceb | ReconstructionBattleSetup enemy construction |
| web/src/world/world-model.ts | 1–65 | Git blob 17365dab98fe0c6847e18de4eb2ccc17309e2bf3 | 通用 WorldEntity/EncounterRequest |
| web/src/world/spatial-trigger.ts | 1–82 | Git blob b11847f083660b23ec964c25d1299446fc4e3ce4 | interact/enter trigger runtime |
| web/src/world/world-authority.ts | 54–124 | Git blob 237dd393173795cbeba0eea885f61873230e6134 | 当前 M5 training entity authority |
| web/src/world/ch1-world-authority.ts | 1–70 | Git blob 0b9a8613561e6adc230600dc6fc705cc755d63bd | 当前 CH1 NPC authority |
| web/src/ui/field-hud.ts | 13–20 | Git blob a1a2008afd055c7e6ef5aff66f614e4047afefa1 | 当前通用交互提示 |
| web/src/ui/battle-hud.ts | 15–27 | Git blob 57b1d9e8b2ad65c53b20e02981a7996ccff281b7 | 当前通用 battle HUD |
| web/src/content/monsters/monster-archetype-catalog.ts | 1–63、121–1255 | Git blob fa5aa59a8bb2997f1f924834cd6c23173de840eb | M7 训练怪物 archetypes，不是野外旧 Ability IDs |
| docs/planning/ch1-attr-equip-shop-plan.md | 438–464、366–383、391–436 | Git blob af23febeb785a72a977c990235db5867a351452c | 20 项裁定、队列 7、S42 平衡口径 |

## 9. 本轮交付边界

本分支只新增本报告。没有改动 Plan.md、Backlog、evidence-ledger、任何 TS/Python 运行时代码、测试、原始资源或其他任务分支。报告中的 M7.3/queue8 是建议，不是已批准的实现范围；需由总管/用户另行裁定后才能进入实现。
