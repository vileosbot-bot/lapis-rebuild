# M7.2 / S43 — 第一章属性成长与分配

## 状态与边界

- Milestone：M7.2，GOAL 队列 7，第一包 S43。
- Runtime 等级范围：Lv1–65。数据文件保留 Lv1–100，Lv66–100 不进入运行时发点。
- 不开放洗点。
- 本任务不修改任何怪物 HP、攻击、防御、等级或遭遇阵容。
- 本阶段不运行 S42；S42 仅在 S46 最终集成版运行一次。
- 不触发 GitHub Actions，不创建 PR，不合并 main。

## 原始成长数据

数据文件：`data/progression/ch1-attribute-growth.json`

来源：
- 容器：`Set.lib`，SHA-256 `ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe`。
- 成员：`levelabl.atr`，SHA-256 `0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc`。
- canonical source chain：Ability 100，原始物理行 L2–L101。
- 十个职业链的成长/点数序列由 M6 双职业矩阵交叉对照；导入时采用剑士链作为 canonical 行序，并核对巫师链对应值一致。
- 每行保存全局等级、source ability/rank/row、来源阶段 ID/阶段内等级、六维自动增量、发点数、runtimeEnabled 与 evidenceLevel。
- YBCS 派生口径一律 `RECOVERED_SECONDARY`；离线运行规则一律 `RECONSTRUCTION_POLICY`。没有 row-level 原始哈希的地方不生成伪哈希。

点数序列：
- Lv1–5：每级 1 点。
- Lv6–65：每级 2 点。
- Lv66–85：源表仍为每级 2 点，但运行时关闭。
- Lv86–100：源表为每级 3 点，但运行时关闭。
- 自动成长：每个等级行六维各 +1；Lv1 创建时即应用第 1 行。

## 属性状态模型

`web/src/progression/attribute-points.ts` 保存：
- `level`：已应用的成长等级，最大 65。
- `automaticGrowth`：逐行累加的六维自动成长。
- `allocated`：玩家确认分配的六维点数。
- `unspentPoints`：可分配余额。
- `rewardReceipts`：等级奖励收据，防止重复发点。
- `provenance`：`RECONSTRUCTION_POLICY`。

约束：
- `sum(allocated) + unspentPoints = earned points through current level`。
- 自动成长每一维必须与等级表逐行累加一致。
- 所有分配值、余额和 draft 点数必须是非负整数。
- 未知属性、负数、小数、余额不足、过期 draft 和超额分配均拒绝。
- M6 同职业阶段晋阶保留属性状态；新建另一职业档时重置为该档 Lv1 初始状态。

## 属性到战斗数值投影

独立 policy：`web/src/progression/attribute-stat-policy.ts`

当前映射对自动成长值 + 已确认分配值的总和生效：

| 属性 | 战斗投影 | 每点数值 | policy id |
|---|---|---:|---|
| CON | 最大 HP | +50 | `m7-2-con-max-hp-50-v1` |
| WIS | 最大 MP | +50 | `m7-2-wis-max-mp-50-v1` |
| STR | 物理攻击、物理防御 | 各 +1 | `m7-2-str-physical-offense-defense-1-v1` |
| INT | 魔法攻击、魔法防御 | 各 +1 | `m7-2-int-magic-offense-defense-1-v1` |
| DEX | 未映射，不产生战斗数值贡献 | UNKNOWN | `m7-2-dex-unmapped-pending-s46-v1` |
| REG | 未映射，不产生战斗数值贡献 | UNKNOWN | `m7-2-reg-unmapped-pending-s46-v1` |

CON/WIS/STR/INT 的映射均独立记录 `policyId`、`provenance=RECONSTRUCTION_POLICY` 与 `evidenceLevel=RECOVERED_SECONDARY`。DEX/REG 只记录 `status=unmapped`、`evidenceLevel=UNKNOWN` 与 `provenance=RECONSTRUCTION_POLICY`，不编造数值。获批数值是离线重构策略，不代表零售服务器公式已验证；S46 可依据实测调整投影，而不改写已保存的六维状态。

## 发点与幂等

`rewards.ts` 在 M7.1 每个 level-up event 后发出：
- 原有 `skill_point` 事件保持不变。
- 新增独立 `attribute_point` 事件，金额来自当前等级成长行。
- 重复 reward receipt 不产生重复 level-up / attribute-point 事件。
- Runtime 仅在 reward application 实际生效时，以同一 receipt 更新属性状态。

Lv1 的首个点不依赖奖励事件，由角色创建时的成长行 1 初始化。

## M7 Save Extension schema 2

- `m7-save-extension.ts` 将嵌套 M7 extension schema 1 升级为 schema 2。
- 新字段 `attributes` 与 `skills` 完全分离；属性点绝不写入技能字段。
- schema 1 迁移：根据当前持久化等级重建自动六维成长，将历史应得属性点全部设为未分配，`allocated=0`。
- schema 1 的技能、HP/MP 原样保留。
- 无 M7 extension 的旧 SaveV2：经 M6 迁移后创建 M7 schema 2，历史应得属性点同样全部未分配。
- 现有 progression EXP、gold、reward receipts、inventory 和 M6 equipment 由既有 SaveV2/M6 迁移保留。
- 65 级以上的 M7 持久化属性轴封顶 65；不推导 Lv66–100 的运行时发点。

## UI

- 野外 HUD 的「状态」入口和系统菜单「角色属性」入口打开分配面板。
- 面板显示六维自动成长、已分配、待确认、总值和余额。
- 加点只修改 draft；取消丢弃 draft；确认才写入角色状态。
- 战斗中禁止打开/分配。
- 不提供洗点入口。
- 保存后经 SaveV2 reload 恢复属性状态。

## 验收边界

- `web/tests/m7-2-attribute-points.test.ts`：成长行、发点、跨级、重复收据、余额、输入校验、六维投影、职业阶段保留。
- `web/tests/m7-2-attribute-save-migration.test.ts`：schema 1→2、无 M7 extension 迁移、技能/HP/MP/EXP/M6 装备保留、schema 2 round-trip。
- `web/e2e/m7-2-attribute-allocation.spec.ts`：剑士和巫师通过奖励升级、取消/确认、SaveV2 reload；不直接修改属性 fixture；截图附 SHA-256、字节数、视口与 checkpoint。
- S42 不在 S43 执行。
