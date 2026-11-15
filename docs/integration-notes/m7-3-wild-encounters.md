# M7.3 第一章野外遭遇 P0 前置核对记录

- request-id：`ch1-m73-wild-20261114-01`
- 仓库：`vileosbot-bot/lapis-rebuild`
- 执行分支：`feat/ch1-m73-wild-encounters`
- 基线：`0155c439ee9fde157ae700da9fbcabdca484abb5`
- 状态：P0 前置核对通过；尚未进入 P1；没有运行时代码修改。
- 证据约束：YBCS 放置和随包原始资源均按 `RECOVERED_SECONDARY` 记录；触发、路线 BFS、AI、奖励、重生均按 `RECONSTRUCTION_POLICY`；原版零售行为继续 `UNKNOWN`。不把任何 YBCS 内容标为 `VERIFIED`。

## 1. 权限、基线与分支

- GitHub 登录账号读回：`vileosbot-bot`。
- 仓库权限：Admin。
- main HEAD 读回：`0155c439ee9fde157ae700da9fbcabdca484abb5`，与审批基线一致。
- 新分支 `feat/ch1-m73-wild-encounters` 从该完整 SHA 创建。
- 当前分支最新提交以 GitHub 读回为准。
- 没有修改 main、创建 PR、合并或访问 `ViLeo06/lapis-rebuild`。

## 2. 探索报告与六条放置数据

探索报告：
- 分支：`docs/ch1-wild-monster-explore-20261113`
- HEAD：`e336e0f2`（任务输入）
- 文件：`docs/research/ch1-wild-monster-exploration.md`
- Git blob：`7a2a144df5f56f35a4d72bbcb86c4f89ad8e0e7c`

map 1020 六条放置数据逐项读回：

| Entity ID | 放置名称 | Model ID | xy | approach | HP/MP | Gold/EXP | Drop |
|---:|---|---:|---|---|---:|---:|---|
| 22020 | 普罗首领B | 4006 | (4,144) | (3,143) | 150/100 | 40/150 | item 4002 |
| 22720 | 雷德普罗 | 4001 | (12,142) | (11,141) | 100/100 | 40/100 | item 4002 |
| 22721 | 普罗首领B | 4006 | (37,153) | (36,152) | 150/100 | 40/150 | item 4002 |
| 22022 | 雷德普罗 | 4001 | (37,139) | (36,138) | 100/100 | 40/100 | item 4002 |
| 22023 | 普罗首领B | 4006 | (54,130) | (53,129) | 150/100 | 40/150 | item 4002 |
| 22024 | 雷德普罗 | 4001 | (49,121) | (48,120) | 100/100 | 40/100 | item 4002 |

六条记录均只标记 `RECOVERED_SECONDARY`；本表不表示原版零售服务端事实。

## 3. 找回并校验原始资源包

从已连接 Google Drive 取回 `ybcs-offline.zip`，只下载和静态读取，没有运行、安装或启动包内任何程序。

- 大小：192,893,156 bytes。
- SHA-256：`d79c012177c8b1701188a90825539466d28cc18dc87b3c62361b4960b315724d`。
- 与 Drive 中 `README-原包说明.md` 记录的大小和 SHA-256 完全一致。
- 资源目录：`runtime/client/SGRes/`。
- 原始地图资源文件 `sz-1000/1020/1030/1060.{imf,smf,mmf}` 已抽取到临时工作目录，未加入 Git。

四张地图的 IMF/SMF/MMF 文件大小和 SHA-256：

| Map | IMF bytes / SHA-256 | SMF bytes / SHA-256 | MMF bytes / SHA-256 |
|---:|---|---|---|
| 1000 | 103172 / `0477cab071e79464ce44310eedb747409253ae13703f7a9d41b67d5b13160eaf` | 11496 / `46cf8155b1c88292771918ac20275f7f27213808e2cc1eb6bb55369b8a529de5` | 52436 / `e687c2a0a51229b0f462141cae77ec71885a87b1c75f546514b82fc8d4d81225` |
| 1020 | 159302 / `5080eb88bb9137b019756d540d81c4646ee5a14e0bda1d5c3dd2ff247fc20bf8` | 7627 / `572b2c45209520e90266629ae46d9aec765d7ed338628349dad81da97746dd69` | 101761 / `3021c000051eef1e14ef6e1e3c83b9a970fbeef8d3ce2d6112f1d5a1c4a8b24e` |
| 1030 | 26692 / `0a91a68318f1aac7638c15380a9ec1ca4265e36f3378edd4b0b737ba424f837f` | 1359 / `1e3f651663a12e06bfca8c90eda0a65af1db2a5c543afdb450c4640066e89217` | 18633 / `1b739d3e962014bb8cb2512c30db61127fc1e9ba4290d95d12129d3c99d89c31` |
| 1060 | 44728 / `fe91d8692f707e44beb2d670e1507a23a1badd3cb83b91d5c6c9df79bfdd1262` | 5242 / `575bf1db7e5eeb3cf8138a197def6d0354215ac6ada36a6d79f08d0e3e75d1f4` | 23681 / `76418e19159c18f84ce25696b3034a146e69c78abb2bf787dab5a1ae89c8fe65` |

IMF 按包内已读到的旧版布局规则静态解码：校验头、尺寸、记录数量、文件长度、稀疏记录边界和终止字段；将压缩 second-major/even-columns-first 网格还原为 first-major。没有导入或执行 YBCS 包内模块。解码及派生碰撞表均为 `RECOVERED_SECONDARY`。

## 4. 地图尺寸、出生点和六条野怪碰撞核对

| Map | IMF dimensions | Walkable cells (grid value 1) | 当前 CH1 spawn / 相关 arrival | spawn grid |
|---:|---:|---:|---|---:|
| 1000 | 159×319 | 21069 | (93,5) | 1 |
| 1020 | 199×399 | 31502 | (3,173)、(66,4) | 1、1 |
| 1030 | 89×149 | 4690 | (5,137) | 1 |
| 1060 | 149×149 | 3349 | (20,120) | 1 |

map 1020 六条野怪的世界坐标和 approach 坐标全部在 IMF 边界内，且 grid value 均为 1：

| Entity ID | World xy | World grid | Approach | Approach grid | 结论 |
|---:|---|---:|---|---:|---|
| 22020 | (4,144) | 1 | (3,143) | 1 | walkable |
| 22720 | (12,142) | 1 | (11,141) | 1 | walkable |
| 22721 | (37,153) | 1 | (36,152) | 1 | walkable |
| 22022 | (37,139) | 1 | (36,138) | 1 | walkable |
| 22023 | (54,130) | 1 | (53,129) | 1 | walkable |
| 22024 | (49,121) | 1 | (48,120) | 1 | walkable |

由 IMF 静态解码派生的四份临时 collision JSON（不入库）：
- `/tmp/m73-derived/maps/map-1000-collision.json`：101505 bytes，SHA-256 `5c31aeb0a55687b8b9aa6718f6a83a9544af4764ab5a7938a4260795110e3b9d`。
- `/tmp/m73-derived/maps/map-1020-collision.json`：158865 bytes，SHA-256 `8d2c874f4f89f78888fd49395db41372a06b692592e85f8174cea811b82460d0`。
- `/tmp/m73-derived/maps/map-1030-collision.json`：26584 bytes，SHA-256 `c320357a351b56f87bf4b5801d147980bc1194b2c125f35e1a1c2825b23c34a2`。
- `/tmp/m73-derived/maps/map-1060-collision.json`：44465 bytes，SHA-256 `746f3c48a38dd8541f30d6c53b5578684dcda392cce792c0fdcbc0822f19187b`。

## 5. route 040/048 与野怪触发互斥的实测资源推导

SMF 路线资源交叉核对：

- map 1000 route 040：`Route_Turf_NE`，object ID 131；SMF interactive click ID 29 也解析到该记录。
- map 1020 route 048：`Route_Turf_N`，object ID 1；SMF interactive click ID 12 也解析到该记录。
- 这只证明随包静态地图资源中的路线矩形/记录身份，不证明原版零售战斗区或野怪触发语义。

当前 CH1 policy 激活格在 IMF 中的 walkability：
- route 040 map 1000：15/16 walkable；唯一非 walkable 的声明锚点是 (79,6)，其余 15 格可走。
- route 048 map 1020：16/18 walkable；非 walkable 的声明锚点是 (67,4)、(68,13)，其余 16 格可走。

关键发现：route 048 行走路径确实穿过野怪实体格，必须落实审批条件 D4，不能只在文档中声明。

- 起点：route 040 到达 map 1020 的 (3,173)。
- 当前 `findRoute()` 的八邻接顺序下，最近可达的 route 048 activation cell 是 (67,13)，路径长度 180 步。
- 该路径在第 34 步经过 entity 22022 的坐标 (37,139)；第 63 步经过 entity 22023 的坐标 (54,130)。
- 这两个点与野怪实体的 Manhattan 距离均为 0。
- 上述路径是按当前 Lapis 重建 BFS 算法对恢复碰撞网格计算的结果，算法口径标记 `RECONSTRUCTION_POLICY`；不是原版客户端的路径行为证明。

因此 P2 必须实现并测试以下顺序：
1. `onSnapshot()` 先处理 `handleChapter1Spatial()` 路线转换。
2. 野怪检查只允许在 map 1020、`routeLength===0` 时运行；任何非空移动 route 期间全部抑制野怪自动触发。
3. 当 route 048 到达激活格并产生 transition 时，路线处理提交地图切换并提前返回；不能在同一 snapshot 继续检查野怪。
4. 只有普通移动结束、没有路线转换、玩家仍在 map 1020 时，才执行 Manhattan <4 的唯一候选判断。

以上规则均为 `RECONSTRUCTION_POLICY`，不冒充原版触发语义。

## 6. item 4002 核对

从 main 的 `data/shops/ch1-shop-catalog.json` 读回：
- itemResourceId：4002
- 名称：便宜药草
- graphicId：1701
- 描述：到处都能获得的药草(生命力少量恢复)
- shopNumber：3
- sourceRecord lineNumber：1803
- evidenceLevel：`RECOVERED_SECONDARY`
- runtimeVerified：false

itemtbl 原始静态行证明物品 ID 4002 的名称与描述；S45 目录记录自身标记为 `RECOVERED_SECONDARY`。野怪放置表将其列为掉落物也是 `RECOVERED_SECONDARY`；D1 的 100%/每次 1 个则是 `RECONSTRUCTION_POLICY`，不属于 itemtbl 证据。

## 7. 模型与视觉资源边界

- 当前 S17 `monster-visual-catalog.ts` 仅有已人工审阅的视觉资源 4524、4525、4526、4544；没有 4001/4006 的可确认视觉绑定。
- 不把旧 model ID 数值相同或相近作为视觉绑定证据。
- 按 D7，4001/4006 没有可用动画时采用明确标记的重建 fallback（文本/占位外观），`RECONSTRUCTION_POLICY`。
- 原始地图 PNG 尚未生成；地图碰撞已从 IMF 派生。PNG 只作为后续本地 E2E/截图 fixture 准备，不作为本次 P0 坐标核验的前置条件。
- 本次没有检查或执行任何原版客户端。

## 8. 证据等级冻结

| 事项 | 标签 |
|---|---|
| 六条 map 1020 放置字段 | `RECOVERED_SECONDARY` |
| 随包 IMF/SMF/MMF 地图资源及其静态解析结果 | `RECOVERED_SECONDARY` |
| 派生 collision JSON、六条坐标与 approach 的 walkability | `RECOVERED_SECONDARY` |
| route 040/048 静态地图对象记录 | `RECOVERED_SECONDARY` |
| 当前 BFS 路径与实体格相交的计算 | `RECONSTRUCTION_POLICY` |
| itemtbl 静态行中的 item 4002 名称/描述 | `RECOVERED_SECONDARY` |
| YBCS 野怪放置行指向 item 4002 | `RECOVERED_SECONDARY` |
| Manhattan <4、唯一候选触发 | `RECONSTRUCTION_POLICY` |
| route 040/048 行走互斥 | `RECONSTRUCTION_POLICY` |
| 无技能、默认 AI | `RECONSTRUCTION_POLICY` |
| 独立野外奖励、100% 一份 item 4002、receipt 幂等 | `RECONSTRUCTION_POLICY` |
| battleZone 1020 fallback | `RECONSTRUCTION_POLICY` |
| 离图再入刷新 | `RECONSTRUCTION_POLICY` |
| 原版刷新节奏、掉落概率、原版 map→battleZone、map 1020 章节归属 | `UNKNOWN` |

YBCS 内容不会标记为 `VERIFIED`。

## 9. P0 结论

P0 前置 gate 通过：
- 账号、仓库、基线和新分支读回一致；
- 探索报告和六条野怪数据已读回；
- 原始资源包大小与 SHA-256 匹配；
- map 1000/1020/1030/1060 的 IMF/SMF/MMF 已抽取并静态解析；
- 六条野怪实体和六个 approach 坐标全部在界内且 walkable；
- route 040/048 静态记录和 activation cell walkability 已核对；
- 已发现 route 048 路径穿越两条野怪实体格，D4 的 route-length 抑制是强制实现要求。

**停止位置：P0 完成；允许进入 P1；尚无运行时代码修改。**
