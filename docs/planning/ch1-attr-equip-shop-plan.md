# 属性 + 装备 + 商店 第一章实施规划

- 请求编号：ch1-attr-equip-shop-plan-20261113-01
- 规划日期：2026-11-13
- 规划基线：vileosbot-bot/lapis-rebuild，95c07edad560729c965941a961fb666b47c29197
- 目标范围：第一章属性成长、装备、商店运行时及其 S42 综合验收
- 本文性质：实施规划，不是实现、测试结果或原版规则复原声明

## 0. 执行摘要

### 0.1 推荐实施顺序

采用严格的依赖顺序：

1. **S43 属性成长与分配**：先建立升级自动属性、可分配点、六维属性状态、分配规则接口和 SaveV2 迁移。
2. **S44 装备数据与战斗接入**：复用 M6 已有 weapon / armor / accessory 三槽位，补物品属性、装备要求、属性贡献和战斗数值投影。
3. **S45 第一章商店运行时**：复用已导出的 itemtbl 数据与商店候选目录，补商店 NPC、目录、购买和交易状态。
4. **S46 综合整合与 S42**：把成长、装备、商店放回第一章自然路线，最后只跑一次 S42 单链，验证实际战斗结果。

属性先于装备，是因为装备属性需要叠加到一个稳定的角色属性模型；装备先于商店，是因为商店售卖的物品必须先有可验证的装备规则和效果。商店数据导出不等于商店运行时，不能把现有队列 6 数据工作重复计为已完成。

### 0.2 建议新增里程碑与队列

- 建议新增里程碑：**M7.2 — Chapter 1 Growth & Economy**。
- 建议新增工作包：S43 属性点、S44 装备、S45 商店、S46 综合验收。
- 建议在 GOAL 队列 6 之后追加 **队列 7：第一章成长与经济运行时**。
- 队列 6 原有的 120 项商店数据导出保持不变；队列 7 消费其结果，不重做数据导出。
- M0–M8.0、S1–S5、M6、M7.1 的既有验收历史不重开、不覆盖。

本次规划提交不修改 Plan.md、Backlog.md 或 GOAL.md。只有用户批准新里程碑和队列后，集成负责人再按仓库治理规则更新主计划与 Backlog。

### 0.3 固定边界

- 所有怪物无技能：这是用户已给出的 OWNER_DECISION；运行时按 RECONSTRUCTION_POLICY 实施，不是 6A69 或旧服务器规则的 VERIFIED 结论。
- 怪物 AI：RECONSTRUCTION_POLICY，不冒充已恢复的原版 AI。
- YBCS 文件、解析器、离线投影和模拟结果一律不得标 VERIFIED；其结论最多标 RECOVERED_SECONDARY。
- 不运行原版客户端，不公开部署，不购买资源，不碰主号仓库，不触碰正在进行的 ch1-monster-fix / S42 重跑分支。
- 不在属性、装备、商店阶段重复运行 S42；最终整合阶段按本规划只跑一次 S42 单链。若失败，先报告，不自行反复重跑。
- 本规划提交仅包含本文一个文档，不建 PR、不合并、不动 main。

## 1. 证据标签与判定规则

本文统一使用以下四种标签：

- **VERIFIED**：固定哈希原始静态资源的字节/字段，或当前 bot main 仓库中确实存在的代码结构。标记为仓库实现事实时，不代表原版零售行为也已证实。
- **RECOVERED_SECONDARY**：由 YBCS 离线代码、兼容层、离线解析器、二手投影或既有重构报告得出的信息。不得升级成原版零售服务端事实。
- **RECONSTRUCTION_POLICY**：为单机版可玩性选择的实现规则，包括经验值消费方式、属性换算、装备资格、商店交易、AI 和战斗平衡。
- **UNKNOWN**：当前证据不能决定，或缺少单位/字段/地图/流程映射。不得用常识补齐。

重要区分：

1. 原始 Set.lib 成员的固定哈希与原始数值可以是 VERIFIED；YBCS 对这些数值的解释、分配规则和运行时行为仍是 RECOVERED_SECONDARY。
2. M6 三槽位、M7.1 EXP authority、SaveV2 schema 等是当前仓库实现事实，不等于旧服务器公式。
3. 每条新数据应保留 source file、source member hash、source row / raw-line hash、evidence level、policy id；运行时投影不得丢失 provenance。
4. 本文不把任何 ybcs_* 来源标为 VERIFIED。

## 2. 当前基线与缺口

### 2.1 既有里程碑

- **M0–M3**：固定样本、资源、Web 诊断、field→battle→return 基础闭环已完成；不因本任务重开。
- **S1–S5**：已完成客户端证据与服务器权威边界梳理。尤其 S3 明确禁止把客户端 authored fields 直接等同于服务器最终伤害公式；S4 明确 NPC/Quest/Employ/Warp 的部分决定属于 server boundary。
- **M4 S8–S14**：UI、World/Quest、战斗表现、双职业、Progression/SaveV2 与 runtime integration 已完成工程验收。本任务只扩展，不重开历史验收。
- **M6 S25–S29**：剑士/巫师十阶段、阶段晋升、装备约束、三槽位装备骨架、M6 SaveV2 已有。现有装备槽位为 weapon / armor / accessory；当前装备规则可表达职业、阶段、等级限制及 attack、defense、magicAttack、magicDefense、maxHp、maxMp 六类贡献。
- **M7.1 S35–S41**：EXP、升级、奖励、技能点、技能状态、训练入口、战斗 HUD 与 SaveV2 集成已完成工程收口。S38 已有技能点奖励，但技能点不等于六维属性点。
- **M8.0**：Web/PWA Foundation 已完成。M8 Web 发布仍是独立发布阶段，不属于本任务；本任务不部署。
- Plan.md / Backlog.md 仍记录 M7.1 修复版 standalone 的用户试玩门待确认。M7.2 不得自动关闭或改写该旧门禁。

### 2.2 属性与成长

- 原始资源：Set.lib::levelabl.atr，70,666 bytes，SHA-256 0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc。原始数值是静态资源事实（VERIFIED）。
- 调研记录中的表列解释、每级发点语义及六维应用路径经 YBCS parser 解释；在未独立复核 parser 前，语义结论标 RECOVERED_SECONDARY。
- 调研记录给出的成长候选：六维 con / wis / str / dex / int / reg 每级自动各 +1；第 1 阶段 Lv1–5 每级 1 个可分配点，Lv6 起每级 2 点。作为当前候选规则标 RECOVERED_SECONDARY；采用到网页运行时后标 RECONSTRUCTION_POLICY。
- 当前 Web 没有独立的六维属性点分配域模型。M7.1 已有的 skill points 不可复用为 attribute points。
- M7.1 当前等级轴覆盖 Lv1–65；原始 levelabl 表有 100 个目标等级行。Lv66–100 的新属性点接入与经验 authority 范围需明确分期，不能擅自把 M7.1 的 65 级上限改成 100。

### 2.3 EXP authority

当前仓库不是单一经验曲线：

- 旧 M4 默认 policy 为 m4-linear-100x-level-v1，totalExpForLevel 使用 50 × (level - 1) × level；这是 RECONSTRUCTION_POLICY。
- M7.1 有独立 m7-1-levelabl-experience-v1：读取 fixed-hash levelabl.atr 的 Lv1–65 experience_value 数值；当前 M4 runtime 已使用 initialM71Progression / M71_EXPERIENCE_POLICY。
- 原始 experience_value 数值是 VERIFIED-STATIC-ORIGINAL；把第一行解释为从该等级升到下一级所需 EXP，是 RECONSTRUCTION_POLICY；旧服务器真正如何累计、发放、惩罚、队伍分配仍 UNKNOWN。
- 因此第一章新角色和新奖励应沿用现有 M7.1 EXP authority，不另造第三条曲线；旧 M4 policy 仅保留兼容，不作为新功能的默认经验曲线。

### 2.4 装备

- M6 已有三个槽位与装备 loadout 验证，且 M6 Save extension schema 1 保存 equipment loadout。
- 当前 M6EquipmentStats 只包含 attack、defense、magicAttack、magicDefense、maxHp、maxMp；itemtbl 另有物伤/魔伤范围、命中、回避、暴击、六维要求、耐久、强化字段，尚未形成完整网页运行时映射。
- M6 装备 loadout 保存的是槽位与 item ID。若要保存每件装备实例的独立耐久/强化状态，现有 schema 不能直接表达，必须单独设计扩展与迁移。
- itemtbl.atr 原始表有 2,073 条记录；原始 Set.lib 成员和哈希见证据表。当前 B4 导出逐项标 RECOVERED_SECONDARY，不得把 YBCS 的物品解释、资格规则或交易语义写成 VERIFIED。

### 2.5 商店与 NPC

- 当前 bot main 的 B4 shop catalog audit 已明确：导出只保存 itemtbl 原始候选行与 YBCS offline shop projection，不实现购买、出售、背包变更或 retail-server behavior。
- YBCS offline program→shop 映射有 10 个 program 声明；每店目录上限 120 项；shopNumber 原始候选数为 1号 602、2号 1200、3号 103、4号 128、5号 4。以上映射、目录限制和运行时语义均为 RECOVERED_SECONDARY。
- 原始 itemtbl 价格列可作为静态价格字段输入；购买扣价、有限库存、28 行背包限制、半价出售白名单等仍是 YBCS offline policy / RECONSTRUCTION_POLICY，不是 retail-server fact。
- YBCS shop audit 明确说明候选行数不等于最终 NPC 目录；程序级过滤、附加行和每店 120 项截断顺序需要独立定义。
- NPC placement 文件明确说明没有恢复 retail server placement table；商店 NPC 的 map/cell/program/role 全部 RECOVERED_SECONDARY，runtimeVerified=false。
- weapon shop program 13 的 NPC 同时关联 Quest2 giver 语义。商店交互不能覆盖、吞掉原有 Quest2 交互。
- Caosia / Sandgent 商店地图与第一章首战前的真实可达路线尚未被现有证据完整闭合，标 UNKNOWN。不能仅因 NPC placement 存在就宣称第一章玩家能到达。

### 2.6 S42 当前验收基线

当前 S42 Chapter 1 full end-to-end spec：

- 从 map1000 经 map1020 到 map1030 的 story-source-1 gate，进入 battleZone 1；story source 的静态绑定仍标 RECOVERED_SECONDARY，runtimeVerified=false。
- 使用真实 M4 战斗循环，最多 40 次玩家行动；不使用设置玩家 HP、敌人 HP 或强制胜利的 fixture。
- 当前断言胜利、玩家 HP 大于 0、行动数不超过 40，并记录 HP at entry / victory、攻击、移动、行动序列。
- 当前故事战斗不结算金币或 EXP；这项行为应在新系统整合后保持，除非另有明确奖励设计。
- 当前 S42 记录六张真实浏览器截图与 checkpoint JSON。现有截图编号 s42-01 至 s42-06。
- **当前 spec 没有明确断言敌人数量为 20。** 因此“20 只怪”是本任务的目标验收要求，但现有测试并未证明当前 battleZone 1 的实际 roster 数量；需在 S46 前对齐目标 roster，未确认前标 UNKNOWN。

## 3. 分阶段实施计划

## S43 — 属性成长与分配

### 目标

1. 建立六维属性状态：con / wis / str / dex / int / reg。
2. 区分每级自动成长、可分配点、已分配值和未分配余额。
3. 将属性点发放接入 M7.1 level-up/reward authority；多级升级必须按经过的每一级发放，且不能重复发放。
4. 建立属性分配 UI 与合法性校验。
5. 把属性分配状态纳入现有 SaveV2 / M7 extension migration，不另建平行存档。
6. 让战斗属性投影使用独立、可替换的 RECONSTRUCTION_POLICY；不能把尚未恢复的旧公式散落硬编码。

### 输入材料

- Set.lib::levelabl.atr 固定哈希原始数值。
- web/src/progression/m7-1-experience-policy.ts：现有 Lv1–65 EXP 数值与 policy。
- web/src/progression/progression.ts：M7.1 / legacy progression 双 policy 与多级 level-up events。
- web/src/progression/rewards.ts：现有 reward receipts 与奖励应用。
- web/src/progression/m7-save-extension.ts：当前 M7 extension schema 1，仅 skills / vitals。
- web/src/progression/m7-save-migration.ts、save-schema.ts：现有 SaveV2 migration / validation。
- web/src/progression/m6-stage-promotion.ts：现有双职业阶段边界。
- docs/integration-notes/s3-source-inventory.md：YBCS 已提供的部分属性贡献候选及其证据边界。

### 计划产出文件

新增：
- data/progression/ch1-attribute-growth.json：保存可追溯的等级成长行、自动六维增量、可分配点数量、source hash、source row、evidence level；首期可导入 1–100 行，但运行时只启用已批准等级范围。
- web/src/progression/attribute-points.ts：属性状态、合法分配、剩余点、升级发点与状态验证。
- web/src/progression/attribute-stat-policy.ts：六维属性到战斗数值的独立 policy；每个映射字段带 provenance / policy id。
- web/src/ui/attribute-allocation-panel.ts：属性查看、加点、确认、余额显示。

修改：
- web/src/progression/m7-save-extension.ts：M7 extension 从 schema 1 扩展到 schema 2，增加 attribute allocation state；不得把 attribute points 塞进 skills。
- web/src/progression/m7-save-migration.ts：schema 1 → schema 2 的兼容迁移；老存档不得丢失技能、HP/MP、EXP、M6 装备。
- web/src/m4-runtime-integration.ts：升级发点、分配动作、属性状态读取与战斗属性投影。
- web/src/ui/types.ts、web/src/ui/field-hud.ts、web/src/ui/game-menu.ts：接入角色属性面板入口与显示。

测试与文档：
- web/tests/m7-2-attribute-points.test.ts
- web/tests/m7-2-attribute-save-migration.test.ts
- web/e2e/m7-2-attribute-allocation.spec.ts
- docs/integration-notes/m7-2-attribute-points.md
- docs/validation/m7-2-attribute-points-acceptance.md
- docs/evidence-ledger.md：只在实现验收后追加新证据，不在规划阶段更新。

### 验收标准

- **typecheck**：web 目录 npm run typecheck 通过。
- **单元测试**：覆盖六维自动 +1、1–5 级发 1 点、6 级起发 2 点、跨多级奖励、重复 reward receipt、余额不足、负数/小数/未知属性/超额分配、双职业阶段切换、SaveV2 schema 1→2、旧存档无 M7 extension 的迁移。
- **构建**：npm run build 通过；不得修改 M7.1 既有 EXP/技能逻辑来绕过测试。
- **S42 单链**：本阶段不跑 S42；属性单项未完成装备与商店，不具备最终首战平衡意义。
- **E2E**：剑士与巫师分别验证升级、查看未分配点、分配、取消/确认、刷新或重新载入后保持一致；不允许通过调试 fixture 直接改属性。
- **截图**：至少输出 attribute-before-allocation.png、attribute-after-allocation.png、attribute-after-save-load.png；记录 SHA-256、字节数、浏览器视口与状态 checkpoint。
- **阶段通过条件**：单测、typecheck、build、属性 E2E 全通过；属性到战斗的换算策略经用户裁定。未裁定的六维效果不得宣称已恢复。

## S44 — 装备数据与战斗接入

### 目标

1. 复用 M6 weapon / armor / accessory 三槽位与现有 loadout，不创建第二套装备系统。
2. 将第一章可用装备从 itemtbl 候选集中筛选为可追溯 catalog。
3. 补充装备等级/职业/阶段/属性要求与物品 stat contribution 的明确 policy。
4. 将装备贡献接入当前玩家战斗属性，避免“UI 显示已装备但战斗数值没变”。
5. 为装备切换、卸下、背包数量、存档恢复建立完整闭环。

### 输入材料

- docs/integration-notes/s4-shop-catalog-data.json 与 s4-shop-catalog-policy.ts：已有 2,073 项 itemtbl 导出及字段 provenance。
- docs/integration-notes/s4-shop-catalog-audit.md：itemtbl 字段、价格、装备候选数与 evidence boundary。
- web/src/progression/m6-equipment.ts：三槽位、资格检查、loadout 验证及六类现有 stat contribution。
- web/src/progression/m6-save-extension.ts：当前 equipment 持久化。
- web/src/progression/m6-growth-authority.ts：现有 M6 equipment authority。
- web/src/combat/reconstruction-combat-balance.ts：现有 EquipmentCombatBonuses 与 playerStats。
- S43 属性状态及 attribute-stat-policy。

### 计划产出文件

新增：
- data/items/ch1-equipment-catalog.json：只包含经筛选的第一章装备候选；保留 itemResourceId、原始行号、raw-line hash、价格、装备位置、等级/属性要求、伤害范围、耐久与 provenance。
- web/src/progression/equipment-stat-policy.ts：原始装备字段到 M6 / CombatantStats 的转换策略，保留原始范围字段。
- web/src/ui/equipment-panel.ts：装备槽位、背包候选、资格拒绝原因和属性变化预览。

修改：
- web/src/progression/m6-equipment.ts：按批准的字段扩展 M6EquipmentStats / M6EquipmentRule；保持旧三槽位存档可读。
- web/src/progression/m6-growth-authority.ts：确保装备状态与背包、阶段和属性状态一致。
- web/src/combat/reconstruction-combat-balance.ts：消费装备与属性的组合 bonus；所有新换算标 RECONSTRUCTION_POLICY。
- web/src/m4-runtime-integration.ts：装备/卸下、战斗数值刷新与 UI 投影。
- web/src/ui/types.ts、web/src/ui/game-menu.ts：接入装备面板。

测试与文档：
- web/tests/m7-2-equipment.test.ts
- web/tests/m7-2-equipment-stat-policy.test.ts
- web/e2e/m7-2-equipment.spec.ts
- docs/integration-notes/m7-2-equipment.md
- docs/validation/m7-2-equipment-acceptance.md

### 验收标准

- **typecheck**：npm run typecheck 通过。
- **单元测试**：覆盖三槽位、itemId 唯一、背包持有、职业/阶段/等级/属性要求、非法槽位、换装后旧装备回包、卸下、装备属性叠加、范围字段保留、战斗属性刷新、旧 M6 schema 1 存档读回。
- **构建**：npm run build 通过。
- **S42 单链**：本阶段不跑 S42；等商店接入后统一验收。
- **E2E**：至少一条剑士与一条巫师装备路径；装备前后角色面板和战斗属性一致；保存、刷新、读档后槽位与属性一致；不使用直接改 loadout 的测试捷径。
- **截图**：equipment-empty.png、equipment-equipped.png、equipment-stat-delta.png、equipment-after-save-load.png；记录 SHA-256、字节数与状态 checkpoint。
- **阶段通过条件**：装备数据、资格检查、背包/存档、战斗属性四者一致；任何没有证据的 item requirement / stat conversion 均明确标 RECONSTRUCTION_POLICY。

### 耐久、修理、强化的范围建议

- 第一轮 MVP 先完成三槽位、装备资格、基础属性贡献和存档。
- 耐久与修理需要独立的“每次战斗/攻击如何扣耐久、修理价格如何算、是否能修理全部、装备实例如何识别”规则。现有 M6 loadout 只有 item ID，不能自然表达同 ID 多件装备的独立耐久。
- 强化系统另有大量随机槽位与数值规则，第一章 MVP 不应与基础装备接入绑在一起。
- 建议耐久/修理作为 S44-B 后续子任务，强化作为后续队列；只有用户批准后再进入第一章范围。YBCS durability/repair/enhancement 结论保持 RECOVERED_SECONDARY。

## S45 — 第一章商店运行时

### 目标

1. 只把确认属于第一章可达路线的商店接入世界，不因 NPC placement 候选存在就擅自增加地图路线。
2. 使用既有 itemtbl 导出构造商店目录；每个目录不超过 120 项。
3. 实现商店 NPC → 目录 → 购买 → 背包 → 装备的完整路径。
4. program 13 武器店主同时具有 Quest2 语义，必须保留 NPC 多意图，不得让商店入口覆盖任务入口。
5. 购买、出售、库存、货币与 SaveV2 状态一致。

### 输入材料

- docs/integration-notes/s4-shop-catalog-data.json
- docs/integration-notes/s4-shop-catalog-policy.ts
- docs/integration-notes/s4-shop-sale-eligibility.json
- docs/integration-notes/s4-shop-catalog-audit.md
- data/ch1-world-catalog/npc-placements.md
- 现有 web/src/world/npc-dialogue-runtime.ts、web/src/world/ch1-world-authority.ts 与 web/src/m4-runtime-integration.ts
- S44 装备 catalog / inventory / equip rules。

### 计划产出文件

新增：
- data/shops/ch1-shop-catalog.json：只纳入已确认第一章可达商店；保存 program、shop number、NPC entity、map/cell、目录 item IDs、过滤过程、120 项截断规则与 provenance。
- web/src/shops/shop-catalog.ts：目录构建、过滤、排序与完整性检查。
- web/src/shops/shop-runtime.ts：打开商店、选数量、购买、库存、金币和有限库存状态。
- web/src/world/ch1-shop-authority.ts：第一章 NPC program / service intent 绑定；将 shop 与 quest intent 分离。
- web/src/ui/shop-panel.ts：目录、价格、数量、购买确认、余额和失败原因。

修改：
- web/src/world/npc-dialogue-runtime.ts：增加 shop service intent，不破坏既有 dialogue/quest intent。
- web/src/m4-runtime-integration.ts：把第一章已确认 NPC 交互接到 shop runtime。
- web/src/progression/save-schema.ts、web/src/progression/m7-save-migration.ts：仅在库存/有限库存状态需要新增持久化字段时扩展；优先复用现有 inventory / gold / SaveV2，不轻率增加顶层 schema version。

测试与文档：
- web/tests/ch1-shop-catalog.test.ts
- web/tests/ch1-shop-runtime.test.ts
- web/e2e/ch1-shop-flow.spec.ts
- docs/integration-notes/m7-2-shops.md
- docs/validation/m7-2-shops-acceptance.md

### 第一章商店范围建议

优先核对并考虑：
- program 13：Caosia 武器店，map:old:2000，NPC 21200；同时存在 Quest2 giver 语义。
- program 14：Caosia 防具店，map:old:2100，NPC 21210。
- program 11：饰品店，map:old:2200，NPC 21220。
- program 15：消耗品店，map:old:2300，NPC 21230。
- program 16：魔法店，map:old:2800，NPC 21280。

以上 map / NPC / program 信息全部 RECOVERED_SECONDARY；“第一章是否可达、到达顺序、是否应在首战前开放”均 UNKNOWN。Sandgent 1501–1504、礼品屋、宠物用品等先不纳入第一章 MVP，除非第一章流程证据和用户范围明确要求。

### 验收标准

- **typecheck**：npm run typecheck 通过。
- **单元测试**：覆盖 shop number / price / item eligibility 过滤、目录最多 120 项、目录 ID 唯一、程序级附加项、数量边界、余额不足、背包容量、库存耗尽、购买扣价、出售白名单、交易幂等、存档恢复、Quest2 与 shop 双 intent 不互相覆盖。
- **构建**：npm run build 通过。
- **S42 单链**：本阶段不跑 S42；先完成商店独立 E2E。
- **E2E**：从真实第一章地图路线到达已批准 NPC；打开目录、查看价格、购买一件装备、背包数量增加、金币正确扣减、装备面板可装备、Save/Load 后一致。program 13 必须另测 Quest2 对话仍可触发。
- **截图**：shop-weapon-catalog.png、shop-purchase-confirmed.png、shop-inventory-after-purchase.png、shop-quest2-intent.png；记录 SHA-256、字节数、NPC/map/item IDs 和交易 checkpoint。
- **阶段通过条件**：地图可达、NPC intent、目录、交易、背包、金币、装备、存档闭环全部通过；未证实的 NPC placement 仍保持 RECOVERED_SECONDARY。

### 交易策略建议

- 第一版优先购买闭环；出售可在 exact-ID 白名单、半价规则、库存行匹配和重复出售保护均被测试后启用。
- B4 audit 的 154 个出售 ID 与半价计算是 YBCS offline compatibility policy，标 RECOVERED_SECONDARY，不是 retail server fact。
- 每店 120 项限制、有限库存、28 行背包限制同样是 offline policy。若采用，运行时标 RECONSTRUCTION_POLICY。
- 过滤顺序建议固定为：shop number → 非负价格 → NPC 专属过滤 → 目录排序 → 120 项上限；但这只是建议，必须先确认是否与现有导出策略一致，不可将其称为原版排序。

## S46 — 综合整合与 S42 平衡验收

### 目标

1. 将属性点、装备、商店与第一章自然路线接通。
2. 确认首战前玩家能否通过真实路线获得可分配点、装备与补给。
3. 以实际 20 怪目标（若经确认）验证战斗，不通过修改敌人 HP 或强制胜利掩盖成长系统缺口。
4. 保留 S42 原 A01–A11 断言与原有六张截图，新增成长/装备/战斗证据。
5. S42 只跑一次单链；不得触碰另一个 ch1-monster-fix 重跑任务。

### 输入材料

- S43 属性点 authority 与迁移。
- S44 装备 catalog、资格、stat policy 与 combat adapter。
- S45 shop catalog、NPC intent、购买与存档。
- 当前 S42 A01–A11 spec 与 ch1-auto3-binding.yaml 历史证据。
- 私有 fixed-hash derived pack；不运行原版客户端。

### 计划产出文件

修改：
- web/e2e/s42-ch1-end-to-end-acceptance.spec.ts：保留 A01–A11，不合并 Feature Map assertion ID；增加成长状态、装备状态、敌人数和战斗结算检查。
- web/src/m4-runtime-integration.ts：仅做最终必要 glue；不得重建第二套成长/装备/商店 authority。

新增：
- web/e2e/ch1-attr-equip-shop.spec.ts：独立验证属性分配、商店购买、装备、Save/Load。
- docs/validation/ch1-attr-equip-shop-acceptance.md：完整记录 S43–S46 的测试与人工验收结果。
- docs/verification/ch1-attr-equip-shop-evidence.yaml：记录测试命令、commit、assertion、截图 SHA-256/字节数、checkpoint JSON、source provenance。
- test-results/s42-07-growth-before-gate.png
- test-results/s42-08-equipment-before-battle.png
- test-results/s42-09-battle-entry-roster.png
- test-results/s42-10-battle-victory.png
- test-results/s42-ch1-growth-checkpoints.json

### 验收标准

- **typecheck**：npm run typecheck 通过。
- **单元测试**：S43/S44/S45 新增单测全部通过；既有 S26/S27/S34/S38 等相关回归不减少覆盖、不通过跳过测试制造绿灯。
- **构建**：npm run build 通过。
- **S42 单链**：在最终集成候选 commit 上只运行一次 web/e2e/s42-ch1-end-to-end-acceptance.spec.ts；报告真实通过/失败、完整 commit SHA、run URL、退出码、行动数、攻击数、移动数、入场/胜利 HP、敌人总数/击杀数、实际伤害、金币/EXP 前后值。不得先在中间版本跑，再把结果冒充最终版本。
- **E2E**：S42 保留真实 M4 战斗循环，不使用玩家 HP、敌人 HP、phase 或 forced victory fixture；测试前的成长/购买/装备必须来自真实可达的游戏交互或经用户批准的自然存档准备步骤。故事战斗自身仍不发放金币/EXP，除非奖励策略另获批准。
- **截图**：原 s42-01 至 s42-06 保留；新增 s42-07 至 s42-10。每张必须由真实浏览器生成，并在测试内计算 SHA-256 与 byte_count；checkpoint JSON 保存完整战斗状态和 turns。
- **最终人工门**：自动化通过只代表工程验收。是否达到可玩性仍由用户实际试玩决定；不得自动写 USER-ACCEPTED。

### S42 目标断言建议

若最终确认首战 roster 是 20 只怪，新增断言：
- battle entry enemy count = 20；
- victory 时 defeated count = 20、live enemy count = 0；
- player HP at victory > 0；
- player actions ≤ 40（沿用当前 S42 上限；若真实路线要求更高，必须由用户批准调整）；
- no player-HP fixture / no enemy-HP fixture / no forced-victory fixture；
- 记录金币、EXP、属性点、装备 loadout 在战斗前后变化；
- story battle 不额外结算金币/EXP，除非独立奖励政策已批准。

若 20 只怪的目标 roster 尚未从可接受来源确认，则敌人数断言先标 UNKNOWN，不得为了满足测试而凭空补怪或改动原始 encounter 数据。

## 4. Plan.md / GOAL.md 对应关系

| 既有计划 | 已有工作 | 本任务关系 |
|---|---|---|
| M0–M3 | 资源、格式、Web 诊断、基础 field/battle/return | 只消费既有能力，不重开 |
| S1–S5 | Encounter / Enemy AI / Damage / Quest-NPC / Visual 证据边界 | 复用边界；不把 server-boundary 补成 VERIFIED |
| M4 S8–S14 | UI、World/Quest、双职业、Progression/SaveV2 | 属性分配、商店 UI 与 NPC service 是新增延伸 |
| M6 S25–S29 | 双职业十阶段、装备约束、三槽位、M6 SaveV2 | 装备数据与运行时效果扩展；不重做三槽位 |
| M7 S30–S34 | 怪物、技能、训练战、Recovery、综合验收 | S42 平衡使用现有战斗系统；不重做怪物/技能内容 |
| M7.1 S35–S41 | EXP、升级、技能点、奖励、存档、HUD | 属性点独立于技能点，接入既有 EXP/level/reward/save authority |
| M8.0 | Web/PWA foundation 已完成 | 不属于本任务；不公开部署、不改发布目标 |

### 4.1 GOAL 队列建议

依据本次用户附件中总管已核实的 GOAL 记录：

- 队列 6（S4）现有范围是 120 项商店数据导出（JSON + TS policy）；保留为已完成数据准备。
- 队列 0–6 没有属性点分配，也没有商店运行时。
- 建议在队列 6 后追加队列 7：**第一章属性成长 + 装备 + 商店运行时**。
- 队列 7 子项：
  1. 属性点状态、升级发放、分配 UI、SaveV2 migration。
  2. 装备 catalog、资格、属性贡献、战斗接入。
  3. 第一章商店目录、NPC intent、购买/交易/背包/货币。
  4. 第一章自然路线与 S42 单链验收。
- 队列 7 的先决条件是用户批准属性换算、首战前商店地图范围、交易与耐久规则。
- 本次在 bot main 上未找到根目录 GOAL.md；队列映射以随任务附件为依据，不声称已从仓库读取 GOAL.md。本文只提出队列建议，不写 GOAL.md。

### 4.2 新增队列与里程碑放置

建议把 M7.2 放在 M7.1 后、M8 发布工作前。理由：属性成长、装备与商店是游戏内容/成长系统，不是 PWA 基础设施或公开发布工作。M7.2 关闭后，才把第一章成长/经济作为新的可玩性基线纳入后续发布评估。

M7.2 不得改写：
- M6 S25–S29 已完成的双职业/三槽位/SaveV2 历史结果；
- M7.1 S38 已完成的 EXP、升级、技能点与奖励结果；
- M7.1 最终 standalone 尚待用户试玩的历史状态；
- S42 原 A01–A11 与 Feature Map assertion ID 的不同命名空间。

## 5. S42 平衡建议：成长后 20 怪是否可打赢

### 5.1 当前能否判断

**结论：UNKNOWN，不能仅凭现有材料承诺“20 怪必胜”。**

理由：
- 当前 S42 spec 的目标是 story-source-1 / battleZone 1，真实战斗在 40 个玩家行动内获胜，但没有显式断言敌人数为 20。
- 已有 S3 模拟只比较 1 名剑士对 2 名敌人的特定输入；YBCS secondary 轨在 3.8 秒 / round 2 阵亡，S19 reconstruction 轨在 10.15 秒 / round 7 获胜。该结果说明输入、HP、伤害与策略差异会改变结果，但不能线性外推为 20 怪结论。
- 第一章首战前是否能自然到达商店、是否有足够升级/分配点、装备与补给，目前仍有地图流程和经济缺口。
- 用户已决定所有怪物无技能，这能降低敌方技能复杂度，但不等于敌人攻击、行动节奏或总伤害已被验证。

推荐做法：
1. 不先削弱怪物 HP；先实现属性点、装备和可达商店。
2. 先以当前玩家基础状态跑确定性 simulator 对照，再用实际 S42 一次性验收自然路线。
3. 对剑士和巫师分别跑离线 balance matrix；S42 真实单链使用用户指定的正式首战角色/配置。
4. 优先调整玩家成长与装备政策，不把敌人 HP、AI 或数量改成“为了过测试”的值。
5. 如果 20 怪仍无法在目标行动数内胜出，先输出逐回合 HP / damage / action / target trace，再由用户决定是否调整成长、装备、初始物品或敌方重构参数。

### 5.2 HP 口径倾向

推荐：**按角色/怪物 ID 保留 ability.atr 原始 HP 锚点；不要用 YBCS 离线 13/13/19 替换原始 HP。**

证据与边界：
- 当前仓库的 class JSON 中，剑士 100 阶段 HP=125，巫师 109 阶段 HP=100；这些 class JSON 字段与 ability.atr authored HP/MP 字段有固定哈希静态匹配记录。
- S3 模拟报告的 YBCS secondary actor 表中，玩家 Ability 100 HP=125、敌方 Ability 500 HP=100、Ability 502 HP=150；S19 玩家 class 100 仍使用 HP=125，但 S19 两个 generic caster 敌人使用 reconstruction HP=71/71。不同角色/敌人行不能拼成一个“玩家 HP”。
- 用户提出的 100/100/150 与 13/13/19 两组值，在本次仓库材料中没有完整的逐 ID 对照表；13/13/19 是 YBCS 派生值时只能标 RECOVERED_SECONDARY，单位映射仍 UNKNOWN。
- 原始 Ability HP 字段可作为 base anchor；CON 等属性对 MaxHP 的增量、是否叠加现有 M7 6% level HP growth，必须是单独 RECONSTRUCTION_POLICY 并由用户裁定。不得把 13/13/19 直接当成原始 MaxHP。

### 5.3 EXP 曲线倾向

推荐：**第一章新角色沿用现有 M7.1 levelabl policy，不回退到旧 M4 的 50 × (level - 1) × level。**

- M7.1 policy 已将 fixed-hash levelabl.atr 的 65 个数值作为 Lv1–65 numeric input。
- 将每行 experience_value 消费为该级升到下一级所需 EXP，是当前明确的 RECONSTRUCTION_POLICY，不是旧服务器公式。
- 旧 M4 曲线继续服务旧 policy / 兼容路径，不作为新角色默认值。
- Lv66–100 虽有原始 100 行候选，但 M7.1 当前 authority maxLevel=65；本任务第一章 MVP 不擅自扩展上限。后续如需恢复 Lv66–100，单独立项、重新审核迁移与阶段映射。
- 属性点发放使用 level transition，不应另建经验阈值或改变 M7.1 的 EXP 累计算法。

### 5.4 属性和装备对平衡的建议

- 六维自动 +1 与可分配点数分开保存；不要把六维属性直接等同于当前 CombatantStats。
- YBCS secondary 材料只提供部分候选：STR stat code 2 对应物攻 +1/点，DEF stat code 3 对应物防 +1/点，INT stat code 4 对应魔攻 +1/点，magic-defence stat code 5 对应魔防 +1/点。六个命名属性与所有 stat code 的完整对应仍未闭合；CON/WIS/DEX/REG 的完整影响不能编造。
- itemtbl 的物伤/魔伤是 min/max 范围；YBCS 采用 floor midpoint 是 RECOVERED_SECONDARY。网页端如要映射为单一 attack/magicAttack，必须显式标 RECONSTRUCTION_POLICY，并保留原始 min/max。
- 先让装备真实改变 combat stats，再评估是否需要改 M7.1 level growth；避免把成长、装备、敌人调参同时改动，导致无法定位平衡变化。
- 首战目标建议先定义为：真实 20 怪（若确认）全部击杀、玩家 HP > 0、≤40 次玩家行动、无强制胜利 fixture。是否要求剑士与巫师都通过 S42，需用户决定；两职业至少都应通过 unit/simulator/E2E 的成长与装备覆盖。

## 6. 风险与待用户裁定事项

以下事项未获裁定前，不应由实现者擅自选择并写成原版事实。

| # | 待裁定事项 | 当前倾向 | 未裁定风险 |
|---:|---|---|---|
| 1 | Lv1 是否立即拥有第 1 个属性点，还是角色升到 Lv2 才首次发点 | 按 levelabl 第 1 行作为角色创建时可用点的候选，但需用户确认 | 直接影响首战前是否能加点 |
| 2 | 属性分配发生在升级弹窗、角色面板，还是任意非战斗时刻 | 建议角色面板非战斗分配；保留未分配点 | UI 流程与原版未知 |
| 3 | 六维属性对 HP/MP/物攻/物防/命中/回避/魔攻/魔防的完整映射 | 只采用有依据的部分候选，其余独立 policy 待批准 | 不能证明六维点数会提升首战战力 |
| 4 | 属性点是否允许洗点、洗点成本与次数 | MVP 暂不开放洗点 | 原版行为未知，可能影响长期 build |
| 5 | 老存档迁移时，当前等级历史应得属性点如何处理 | 建议全部转为 unspent，不回写成已分配 | 可能造成历史角色成长跳变 |
| 6 | 经验 authority 是否采用 M7.1 Lv1–65；Lv66–100 是否延期 | 建议采用 M7.1，66–100 单独立项 | 不同 policy 的旧存档迁移可能失真 |
| 7 | 100/100/150 与 13/13/19 的准确 Ability/actor ID 对照 | 建议逐 ID 用原始 HP 锚点；不采用 13/13/19 替换 | 混淆玩家与敌人 HP，导致平衡错误 |
| 8 | 第一章允许哪些装备槽位与物品类型 | MVP 先用现有 weapon/armor/accessory 三槽 | 原始 itemtbl 还包含其他装备位置 |
| 9 | 新手矛 item 4 是否应作为第一章默认装备/一次性补发 | 作为候选，不自动发放 | 来源为 YBCS offline policy |
| 10 | 装备属性要求、职业限制、阶段/等级要求如何映射 | 先保留原字段，运行时 eligibility 作为 RECONSTRUCTION_POLICY | 不同字段语义可能被错误解释 |
| 11 | 第一章是否需要耐久、修理与强化 | MVP 建议先不做；S44-B 单独审批 | 装备实例持久化和费用规则尚不完整 |
| 12 | 第一章首战前可达的商店地图、开放顺序与 NPC 清单 | 先核对 Caosia map 2000/2100 等路线；不臆造路线 | 商店可能无法在首战前提供装备 |
| 13 | 商店目录过滤顺序与 120 项截断顺序 | 采用显式、可测试的 reconstruction policy | 602/1200 候选行并非最终售卖清单 |
| 14 | 第一版商店是否只买不卖；是否启用 154 项半价出售白名单 | 建议先购买闭环，出售经批准后开放 | YBCS 白名单不是 retail server 规则 |
| 15 | 有限库存、卖出后是否补货、背包 28 行限制是否沿用 | 作为可选 offline policy，逐项批准 | 可能改变经济节奏和物品可获得性 |
| 16 | program 13 NPC 的商店与 Quest2 双重入口 | 必须保留两种 intent；具体对话选项待定 | 商店接入可能破坏 Quest2 |
| 17 | 首战 20 怪是否为正式目标 roster；两职业是否都必须过 S42 | 先把 20/20 作为验收目标，确认 roster 后锁断言 | 当前 S42 未断言敌人数 |
| 18 | 首战是否允许玩家使用技能，还是仅普通攻击 | 怪物无技能已确定；玩家技能按既有职业规则，不默认禁用 | 不同职业战力差异较大 |
| 19 | 首战故事战斗是否仍不奖励 EXP/金币 | 建议保持当前 S42 不结算；战前成长从先前可达活动获得 | 若无战前奖励来源，成长路径可能断裂 |
| 20 | 是否把 M7.2 / S43–S46 写入正式 Plan 与 GOAL | 本文建议新增；须用户批准后再改权威计划 | 未批准前只能视为 proposal |

## 7. 实施顺序的停止门

- S43 未通过：不进入 S44；避免装备数值建立在不稳定属性模型上。
- S44 未通过：不进入 S45；商店不能销售尚不能正确装备/计算的物品。
- S45 地图可达性未确认：不把 NPC 放入第一章主流程；先输出地图流程 UNKNOWN 清单。
- S45 交易/背包/金币/SaveLoad 任一失败：不进入 S46 S42。
- S46 S42 失败：报告失败与实测数值；不得靠改小怪物 HP、隐藏敌人、跳过战斗或强制胜利将结果改成 PASS。
- 任一阶段遇到证据冲突：保持 provenance，分离 raw data 与 reconstruction policy；不得升级 YBCS 为 VERIFIED。

## 8. 运行命令与交付口径

web/package.json 当前 scripts：
- typecheck：tsc --noEmit
- test：node --experimental-strip-types --test tests/*.test.ts
- build：tsc --noEmit && vite build
- test:e2e：playwright test

所有 Web 功能阶段至少执行 typecheck、unit tests、standard production build、Chromium E2E；与 PWA/离线能力相关时再增加 production dist PWA/offline 验收。本任务本身是文档规划提交，不运行上述测试。

每个实现阶段必须在报告中区分：
- 本阶段实际执行的命令、commit SHA、退出码；
- unit test 数、pass/fail/skip；
- E2E test 数、pass/fail/skip；
- S42 是否执行（前三阶段明确不执行，S46 只执行一次）；
- 截图 filename、SHA-256、byte_count、artifact path；
- checkpoint JSON 路径与 SHA-256；
- 证据状态与尚未验证项。

## 9. 主要证据索引

以下 Git blob SHA-1 对应 bot main 基线 95c07ed 的仓库文件；Set.lib 成员 SHA-256 是原始静态资源成员哈希。所有 YBCS 派生内容均保持 RECOVERED_SECONDARY。

| 结论/用途 | 原文出处 | 哈希与状态 |
|---|---|---|
| Plan 当前状态、M0–M8、M6、M7.1、M8.0 边界 | Plan.md：L13–35、L181–188、L269–278、L409–422、L453–518 | Git blob SHA-1 806d903ae4347116d851256d94363b848b521dac；VERIFIED（仓库计划文本） |
| Backlog 中 S28、S38、S41 与 M7.1 待办 | Backlog.md：L162–184、L257–303 | Git blob SHA-1 96fb593813fb94b6b9cca52f53c958f4e32acb97；VERIFIED（仓库计划文本） |
| 状态同步、证据等级、Git 与测试规则 | AGENTS.md：L34–71、L87–103、L167–175 | Git blob SHA-1 2ee8d46d2858bd26b9318153d873a9c81f889c12；VERIFIED（仓库治理文本） |
| itemtbl 2,073 行、成员哈希、商店候选数、120 上限、YBCS mapping 与限制 | docs/integration-notes/s4-shop-catalog-audit.md：L5–19、L38–61、L63–112、L114–150 | Git blob SHA-1 ec5aca9c35814deeb0249144473a7ec0c261a120；Set.lib SHA-256 ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe；itemtbl.atr SHA-256 cf5c9786810b80619ae3133ad77a27d9fb51f2078c30c947c482483d1030eb2e；raw bytes VERIFIED，YBCS shop projection RECOVERED_SECONDARY |
| ability / levelabl 原始成员哈希 | docs/integration-notes/s4-shop-catalog-audit.md：L21–36 | ability.atr SHA-256 0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b；levelabl.atr SHA-256 0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc；raw bytes VERIFIED |
| NPC placements、map/route 缺口、Quest2 双身份 | data/ch1-world-catalog/npc-placements.md：L5–26、L32–43、L46–68 | Git blob SHA-1 020ed8ab3f8e8cd477c352863f5932e5f7bab637；YBCS placement RECOVERED_SECONDARY，runtimeVerified=false |
| M7.1 levelabl EXP 数值、Lv1–65 映射和 per-level requirement policy | docs/research/m7-1-experience-authority.md：L8–15、L19–25、L31–43 | Git blob SHA-1 72990e28c9fd85e1cccbea20079f88ce1b01e316；原始值 VERIFIED，消费方式 RECONSTRUCTION_POLICY |
| M7.1 与 legacy 两条 EXP policy | web/src/progression/progression.ts：L1–18、L27–61、L74–84 | Git blob SHA-1 93f5e57bbcaeeae837eef8813785b67e92581dd2；VERIFIED（仓库实现） |
| M7.1 65 个 levelabl 值及 evidence contract | web/src/progression/m7-1-experience-policy.ts：L1–8、L10–35、L46–75 | Git blob SHA-1 aa8e902adcc2a13aa49c569ee84dadf8b8d57073；raw values VERIFIED，消费语义 RECONSTRUCTION_POLICY |
| M6 三槽位、当前装备 stat fields 与验证 | web/src/progression/m6-equipment.ts：L6–44、L63–72、L93–109、L112–216 | Git blob SHA-1 ec3358b51ebba52c61dd6141ba6fb5ba77fa6f66；VERIFIED（仓库实现） |
| M6 Save extension | web/src/progression/m6-save-extension.ts：L10–42 | Git blob SHA-1 fd9178157f3e456e5013ac2c3dbdbf71924658a8；VERIFIED（仓库实现） |
| M7 Save extension schema 1 | web/src/progression/m7-save-extension.ts：L8–68 | Git blob SHA-1 ea93adb83df7170486df42b720975bcddce98e47；VERIFIED（仓库实现） |
| M7 Save migration 与旧 M6 migration 接口 | web/src/progression/m7-save-migration.ts：L28–60 | Git blob SHA-1 01a8afbb962380836cc5dc736bfd4f686452600f；VERIFIED（仓库实现） |
| SaveV2 version 2 与 M6/M7 extension 验证 | web/src/progression/save-schema.ts：L11–36、L79–112 | Git blob SHA-1 fe4641b4042e03a9727b260cf2abcc80a33d9bec；VERIFIED（仓库实现） |
| YBCS 属性贡献候选、范围转标量差异、部分 stat code | docs/integration-notes/s3-source-inventory.md：L4–39、L41–69 | Git blob SHA-1 610e84c6cdb47d9814914cfd70282dd015fccb01；RECOVERED_SECONDARY / RECONSTRUCTION_POLICY，不是 VERIFIED |
| HP 125/100/150 的角色区分与 2 敌模拟结果 | docs/integration-notes/s3-full-simulation-report.md：L3–34、L49–75、L118–154、L175–179 | Git blob SHA-1 acd2c717ab030bf3a36992cf17c8b8dc1a290fe2；YBCS 结果 RECOVERED_SECONDARY，S19 结果 RECONSTRUCTION_POLICY |
| S42 真实战斗、40 行动上限、HP 与胜利检查 | web/e2e/s42-ch1-end-to-end-acceptance.spec.ts：L31–41、L470–570 | Git blob SHA-1 18f91405bfbe63b95eff0b3d1789b4dc64ab56af；VERIFIED（测试代码存在），测试结果需未来重新执行 |
| S42 六张截图、checkpoint 与历史证据口径 | docs/verification/ch1-auto3-binding.yaml：L61–82、L156–163、L449–502 | Git blob SHA-1 8b1b1c46d1179d2c5e93a7434298a4971faaff35；VERIFIED（历史绑定文档） |
| Story source 1 map1030 / battleZone1 绑定及 provenance | web/src/m4-runtime-integration.ts：L92–108、L1820–1854 | Git blob SHA-1 6a0c9f7777ecb9922aae727ced508a3121d6ecfc；source binding RECOVERED_SECONDARY |
| 当前 combat bonus 字段与 playerStats | web/src/combat/reconstruction-combat-balance.ts：L12–40、L356–384 | Git blob SHA-1 cfd76e345ce6089870881325ca4c6ecccf7dfde6；VERIFIED（仓库实现），公式 RECONSTRUCTION_POLICY |
| 当前 typecheck / unit / build / E2E 命令 | web/package.json：L1 | Git blob SHA-1 c6174e0d99a7f51a37f2c6f5a459981833c0b6bc；VERIFIED（仓库 scripts） |

用户随任务提供的 attr-equip-shop-research-20261113.md 是本规划的起点材料，使用其 §1–4 的总管核实结论；该附件不是 bot 仓库文件，因此本文不伪造其 Git blob SHA。根目录 GOAL.md 在 bot main 上未找到；GOAL 队列对应关系仅按该附件记录引用。

## 10. 本次提交范围

本规划本身只提交：
- docs/planning/ch1-attr-equip-shop-plan.md

不提交：
- 任何实现代码；
- Plan.md / Backlog.md / GOAL.md 改动；
- S42 测试改动或截图；
- 原始 Set.lib、提取资源或 YBCS 原始模块；
- PR、合并或 main 更新。

实施任务须在用户裁定第 6 节事项后另开分支、另立请求编号。
