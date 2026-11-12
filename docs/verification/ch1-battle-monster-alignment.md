# 第一章首战怪物对齐查证记录

- 任务编号：ch1-monster-fix-20261113-01
- 本轮请求：ch1-monster-fix-20261113-02
- 仓库：vileosbot-bot/lapis-rebuild
- 基线：main@95c07edad560729c965941a961fb666b47c29197
- 分支：fix/ch1-battle-monster-20261113
- 目标：第一章 Story source 1，gate cell (72,30)，battleZone 1
- 本轮结论：**BLOCKED**
- 本轮仅更新本报告；没有修改运行时代码、测试、binding manifest、截图或主分支。

## 0. 结论摘要

本轮上传的 Set.lib 原件已成功解包并读取 ability.atr、levelabl.atr。三个目标怪物的原始基础属性、等级、移动范围、攻击范围、金币/经验字段均已提取；并且从 ability.atr 的显式 portrait_id 字段与原始 ybcs 资源校验代码确认了视觉家族映射：

- 1001 步兵 -> B1001
- 1003 枪兵 -> B1003
- 1010 十步长 -> B1010

这不是按 Ability ID 数字相等自动绑定：映射来自 ability.atr 第 1 列（职业图片 / portrait_id），原始 ybcs 源码再用该列生成 Char/B{portrait_id}_00.ani 与 .spr 路径。

但仍有两个关键缺项：
1. Set.lib 中没有可确认的 6A69 AI 程序编号或 AI 程序字段；本次提供的 Set.lib 也没有 walkman 原始日志，无法从实玩日志补回逐怪程序绑定。
2. levelabl.atr 对三种怪物的 sub_magic_id、usable_skill_id、hire_mercenary_id 均为 0；ability.atr 的 acom_raw / pcom_raw 等字段虽有数值，但当前没有足够的原始语义证据将其解释为技能/特性。具体技能、被动特性与 AI 行为仍为 UNKNOWN。

因此，虽然本轮已解决原始属性与显式视觉家族映射，但任务要求的 1) 逐怪技能/AI 信息仍有缺项。按本轮硬门槛：**不改代码、不改 S42 预期、不改 binding、不修 scene.ts、不运行测试、不截图、不创建 PR。只更新本报告。**

## 1. 上传原件与 Set.lib 解包验证

### 1.1 上传文件身份

| 文件 | 字节数 | SHA-256 | 状态 |
|---|---:|---|---|
| Set.lib | 112,730 | ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe | VERIFIED |
| ybcs_offline_field_encounters.py | 194,299 | 94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a | VERIFIED |

派发方提供的原始 ZIP 来源信息：192,893,156 字节，SHA-256 d79c012177c8b1701188a90825539466d28cc18dc87b3c62361b4960b315724d。本轮没有重新上传完整 ZIP，因此该 ZIP 哈希作为派发方提供的来源信息记录，不声称本轮重新计算过 ZIP 哈希。

### 1.2 Set.lib 容器校验

按 Lapis .lib 容器格式解析：

- 头部目录解压长度：528 字节
- 压缩目录长度：241 字节
- header check：0xe8356ab8
- 数据区起始偏移：251
- 解压目录长度：528 字节，与头部声明一致
- 目录项大小：44 字节
- 成员数量：12

12 个成员及解压后字节数：

| 成员 | 解压字节数 |
|---|---:|
| ability.atr | 109,656 |
| itemtbl.atr | 339,967 |
| levelabl.atr | 70,666 |
| magicatr.atr | 383 |
| Magicptn.atr | 18,664 |
| Magictbl.atr | 32,338 |
| solskill.atr | 4,282 |
| SysHelp.atr | 1,074 |
| tileattb.atr | 2,566 |
| tileattr.atr | 2,537 |
| Effectptn.atr | 1,567 |
| zone_name.txt | 4,099 |

所有 12 个成员均成功解压，解压字节数与目录项声明一致。目录中没有 .log、.jsonl 或 walkman 日志成员。

关键成员哈希：

| 成员 | SHA-256 | 状态 |
|---|---|---|
| ability.atr | 0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b | VERIFIED |
| levelabl.atr | 0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc | VERIFIED |
| Magictbl.atr | d885bbd1bddffd3d4bf05b2b4e36232c62d94fc78209d46861b01986779ef0d9 | VERIFIED |
| Magicptn.atr | 5affdd750873e7ccb5a364cc372870b98cde95df905140fa88aedd79155cfceb | VERIFIED |

ability.atr 的 SHA-256 与仓库既有原始资源校验记录一致。

### 1.3 walkman 日志核查

- 本轮 Set.lib 的 12 项目录中没有独立日志文件。
- 本轮上传的 ybcs_offline_field_encounters.py 是离线遭遇实现源码，不是实玩日志。
- 本轮没有收到 ybcs-gui-client.jsonl、ybcs-gui-server.log 或 s2-prescan-excerpt.jsonl。
- 因此本轮没有读取或重算 walkman 日志，也没有产生新的 6A69 实玩证据。
- 完整 192 MB ZIP 本轮未上传，故只对已上传 Set.lib 的内部成员目录作了直接核查；不声称本轮重新扫描了完整 ZIP 的所有路径。

状态：本轮提供材料中没有 walkman 原始日志；6A69 绑定仍 UNKNOWN。

## 2. ability.atr 原始属性提取

### 2.1 字段语义

ability.atr 使用 GB18030 解码，表头包含：

- 字段 0：职业 / Ability ID
- 字段 1：职业图片 / portrait_id
- 字段 2、3：HP、MP
- 字段 4、6、8、10、12、14：con、wis、str、dex、int、reg
- 字段 17：mov
- 字段 18、19、20：hit、evasion、blow
- 字段 21、22：mhit、melu
- 字段 23：ran
- 字段 24：cla
- 字段 26–29：移动/攻击/休息/魔法 tick decrement
- 字段 30–32：command_raw、acom_raw、pcom_raw
- 字段 33、34：gold、EXP
- 字段 36、37：物理伤害字段、物理防御字段
- 字段 38、39：魔法伤害字段、魔法防御字段
- 字段 40–43：sub_magic_raw、price、face、shadow
- 字段 44、45：职业名称、职业描述

物理与魔法字段解释也与旧资源解析代码所读取的 ability.atr 列索引一致。这里报告的是客户端资源表字段值，不把它们扩写成零售服务器最终伤害公式。

### 2.2 三个目标行

来源：本轮上传 Set.lib 解压后的 ability.atr。

- 1001：ability.atr 第 263 行
- 1003：ability.atr 第 265 行
- 1010：ability.atr 第 272 行

| 字段 | 1001 步兵 | 1003 枪兵 | 1010 十步长 | 状态 |
|---|---:|---:|---:|---|
| Ability ID | 1001 | 1003 | 1010 | VERIFIED |
| portrait_id | 1001 | 1003 | 1010 | VERIFIED |
| HP | 100 | 100 | 150 | VERIFIED |
| MP | 100 | 100 | 100 | VERIFIED |
| CON | 11 | 11 | 15 | VERIFIED |
| WIS | 10 | 10 | 10 | VERIFIED |
| STR | 10 | 10 | 15 | VERIFIED |
| DEX | 11 | 11 | 15 | VERIFIED |
| INT | 15 | 15 | 15 | VERIFIED |
| REG | 15 | 15 | 15 | VERIFIED |
| speed_sp | 20 | 20 | 20 | VERIFIED |
| mov | 5 | 5 | 5 | VERIFIED |
| hit | 100 | 100 | 109 | VERIFIED |
| evasion | 1 | 1 | 5 | VERIFIED |
| blow | 2 | 2 | 2 | VERIFIED |
| mhit | 180 | 180 | 180 | VERIFIED |
| melu | 5 | 5 | 5 | VERIFIED |
| ran | 1 | 2 | 1 | VERIFIED |
| cla | 0 | 0 | 0 | VERIFIED |
| cry | 0 | 0 | 0 | VERIFIED |
| 移动 tick decrement | 6 | 6 | 6 | VERIFIED |
| 攻击 tick decrement | 4 | 4 | 4 | VERIFIED |
| 休息 tick decrement | 6 | 6 | 6 | VERIFIED |
| 魔法 tick rate | 100 | 100 | 100 | VERIFIED |
| command_raw | 4 | 4 | 4 | VERIFIED（原始字段；语义不扩写） |
| acom_raw | 5 | 5 | 5 | VERIFIED（原始字段；语义 UNKNOWN） |
| pcom_raw | 3 | 3 | 3 | VERIFIED（原始字段；语义 UNKNOWN） |
| gold | 20 | 20 | 60 | VERIFIED |
| EXP | 50 | 50 | 150 | VERIFIED |
| attribute | 0 | 0 | 0 | VERIFIED |
| 物理伤害字段 | 50 | 50 | 86 | VERIFIED |
| 物理防御字段 | 25 | 25 | 33 | VERIFIED |
| 魔法伤害字段 | 0 | 0 | 0 | VERIFIED |
| 魔法防御字段 | 20 | 20 | 20 | VERIFIED |
| sub_magic_raw | 0 | 0 | 0 | VERIFIED（原始字段） |
| price | 0 | 0 | 0 | VERIFIED |
| face | 100 | 100 | 115 | VERIFIED |
| shadow | 2 | 2 | 2 | VERIFIED（原始字段；具体行为不扩写） |
| 名称 | 步兵 | 枪兵 | 十步长 | VERIFIED |
| 描述 | 空 | 空 | 空 | VERIFIED |

攻击范围取 ran 字段，移动范围取 mov 字段。不能将 hit、blow 或 raw command 字段误当成攻击力或技能 ID。

### 2.3 levelabl.atr 等级与技能引用

levelabl.atr 使用 CP949 解码，原始表头为韩文，明确包含 직업（职业/class）、레벨（等级）、섭마법（sub magic）、사용기술（usable skill）、고용용병（hire mercenary）等列。

三条目标记录：

| class_id | level | 源文件行 | sub_magic_id | usable_skill_id | hire_mercenary_id | 状态 |
|---:|---:|---:|---:|---:|---:|---|
| 1001 | 1 | 1012 | 0 | 0 | 0 | VERIFIED |
| 1003 | 1 | 1014 | 0 | 0 | 0 | VERIFIED |
| 1010 | 5 | 1021 | 0 | 0 | 0 | VERIFIED |

每种目标 class 在 levelabl.atr 中只有上述一条记录。class_link_raw 分别等于自身 ID；经验字段为 0。

结论：
- 三种怪物的 level 字段已恢复，修正第一阶段“个体等级 UNKNOWN”的结论。
- 三行没有非零的 sub_magic_id、usable_skill_id 或 hire_mercenary_id。
- 这只证明这些明确列出的资源字段为 0；不能据此断言所有被动特性、特殊动作或服务器端技能机制均不存在。
- ability.atr 的 acom_raw=5、pcom_raw=3、shadow=2 已原样记录，但没有足够证据为它们赋予具体技能/特性语义。

因此，技能/特性完整绑定仍为 UNKNOWN。

## 3. 第一阶段候选阵容复核

本轮以用户指定的上传原件 ybcs_offline_field_encounters.py 为准复核。

源码第 1704–1786 行仍明确记录：

| Ability ID | 名称 | 数量 | ybcs 离线战斗 HP / MP | gold / EXP | 证据 |
|---:|---|---:|---:|---:|---|
| 1010 | 十步长 | 1 | 19 / 100 | 60 / 150 | RECOVERED_SECONDARY |
| 1001 | 步兵 | 16 | 13 / 100 | 20 / 50 | RECOVERED_SECONDARY |
| 1003 | 枪兵 | 3 | 13 / 100 | 20 / 50 | RECOVERED_SECONDARY |
| 合计 | | 20 | | | RECOVERED_SECONDARY |

重要区分：

1. ability.atr 的原始 HP 是 100 / 100 / 150；ybcs 源码候选战斗成员 HP 是 13 / 13 / 19。两者属于不同数据字段/运行口径，不能互相覆盖。
2. ybcs 候选 gold / EXP 与 ability.atr 对应原始字段相符；原始字段本身为 VERIFIED，但这不自动证明零售服务器如何结算整场战斗奖励。
3. ybcs 源码明确说明 20 人中前 19 个位置使用旧 DEO handoff，最后一个 1001 是单机离线追加的 fallback 单位；不能把第 20 个单位宣称为原版 DEO 直接实证。
4. zone 1 的两个 1002 伏兵属于 DEO 阶段、主阵出现前被处理的 presentation actors，不加入这场 20 人战斗 roster。
5. ybcs 的 map 1030 -> Story source 1 / battleZone 1 及 gate cell 关系仍是 RECOVERED_SECONDARY，不升级为零售服务器遭遇绑定 VERIFIED。

原始 ybcs 位置仍见该文件第 3083–3105 行的 Story 1 handoff 与第 3191–3220 行的应用逻辑。第 20 个 fallback cell 为 (44,36)。

## 4. 6A69 AI 程序查证

### 4.1 Set.lib 内部检索

对 Set.lib 解压出的全部 12 个成员进行检索：

- ASCII 字符串 6A69 / 6a69：无命中。
- 十进制 27241：无命中。
- 两种字节序 69 6a / 6a 69：无命中。
- ability.atr、levelabl.atr 表头没有明确的 AI program / 6A69 程序字段。

这只能说明本次 Set.lib 中没有可确认的逐怪 6A69 程序绑定，不能证明服务器端不存在该绑定。

### 4.2 walkman 日志

本轮没有 walkman 原始日志文件。不能从 Set.lib 的 Ability 行、levelabl 行或 offline policy 反推出 6A69 程序号。

### 4.3 结论

| 怪物 | 6A69 AI 程序号 | 状态 |
|---|---|---|
| 1001 步兵 | UNKNOWN | Set.lib 无绑定；无原始 walkman 日志 |
| 1003 枪兵 | UNKNOWN | Set.lib 无绑定；无原始 walkman 日志 |
| 1010 十步长 | UNKNOWN | Set.lib 无绑定；无原始 walkman 日志 |

不得将默认 AI、Native AI 或 reconstruction 行为冒充为历史 6A69 绑定。

## 5. Bxxxx ANI/SPR 显式视觉映射

### 5.1 Set.lib 显式引用

ability.atr 字段 1 的表头为“职业图片”，对应 portrait_id：

| Ability ID | ability.atr 行 | portrait_id | 显式视觉家族 | 状态 |
|---:|---:|---:|---|---|
| 1001 | 263 | 1001 | B1001 | VERIFIED |
| 1003 | 265 | 1003 | B1003 | VERIFIED |
| 1010 | 272 | 1010 | B1010 | VERIFIED |

### 5.2 原始 ybcs 资源定位代码交叉核对

本轮上传的原始 ybcs_offline_field_encounters.py：

- 第 3527–3547 行：_old_ability_portrait_ids() 读取 ability.atr 的字段 0 与字段 1，构造 Ability ID -> portrait_id 映射。
- 第 3550–3574 行：_require_model_resources() 按 portrait_id 检查 Char/B{portrait_id}_00.ani 和 .spr，并兼容四位数字文件名。
- 该函数注释明确指出，高阶故事角色可以复用其他 portrait/art ID，因此必须读字段 1，不能要求 B<Ability ID>，也不能用数字相等代替显式绑定。

因此本次确认的是 Set.lib 的显式资源映射：
- 1001 -> portrait 1001 -> B1001
- 1003 -> portrait 1003 -> B1003
- 1010 -> portrait 1010 -> B1010

本轮上传文件没有 Char 目录或上述 ANI/SPR 原始文件，所以没有验证这些文件在完整客户端包中的实际存在、动作槽位完整性、字节数或 SHA-256。视觉家族 ID 的显式映射已解决；实际资源文件完整性未在本轮验证。

S17 的 B4524/B4525/B4526/B4544 仍不能替代这三条映射，也没有按数字相等进行推断。

## 6. 吉奥老师 NPC 21003 visibility bug

第一阶段已有结论仍保留：

- 吉奥老师不是 Story source 1 的敌人或友军。
- 原场景规则要求 world NPC 在 battle view 中隐藏。
- 先前检查的 web/src/scene.ts visibility 条件与该要求一致；若实际截图仍出现吉奥老师，应调查 battle transition / world visual visibility 状态。

本轮由于怪物数据门槛仍 BLOCKED，遵守“不得改任何代码”的要求：
- 未修改 web/src/scene.ts。
- 未新增回归测试。
- 未运行测试或实机验证。
- visibility bug 状态：**未修复，仍待独立处理**。

## 7. 阶段裁定与执行记录

**verdict: BLOCKED**

已解决：
- Set.lib 原件成功解析。
- 1001 / 1003 / 1010 的 ability.atr 原始属性字段。
- levelabl.atr 等级字段。
- mov / ran 移动和攻击范围字段。
- gold / EXP 原始字段。
- 1001 -> B1001、1003 -> B1003、1010 -> B1010 显式 portrait 资源映射。
- Set.lib 内没有独立 walkman 日志成员。

仍缺：
- 三种怪物的技能/特性完整语义；levelabl 明确技能引用字段为 0，但 acom_raw / pcom_raw 等字段尚不能解码为具体技能。
- 三种怪物的 6A69 AI 程序号；Set.lib 无直接绑定，walkman 原始日志未提供。
- 实际 Char ANI/SPR 文件字节与哈希未验证；Set.lib 显式 portrait 映射已确认。

由于 1) 逐怪技能/AI 仍有缺项，不能通过第二阶段的代码修改硬门槛。

本轮执行：
- 第二阶段代码修改：未执行。
- S42 预期、binding、测试断言：未修改。
- 吉奥老师 scene.ts 修复：未执行。
- typecheck：未运行。
- 单元测试：未运行。
- build：未运行。
- S42 单链：未运行。
- s42x-07 / 08 / 09 / 10：未生成。
- HP 13/125 与返回 125/125 的旧疑点：未复测。
- PR：未创建。
- 合并：未执行。
- main：保持 95c07edad560729c965941a961fb666b47c29197。
- ViLeo06 主号仓库：未访问、未修改。

## 8. 后续解阻条件

重新申请代码阶段前，至少需要：

1. walkman 原始日志或其他可信的逐怪 AI 程序证据，以确认 1001 / 1003 / 1010 的 6A69 绑定；不能从 Set.lib 的空白字段或默认 AI 推断。
2. 能够明确解释 ability.atr 的 acom_raw / pcom_raw 及相关字段，或提供能证明这些字段不代表目标技能/特性的原始资料。
3. 如需完成真实视觉文件验收，再提供 Char/B1001、B1003、B1010 对应 ANI/SPR 文件或完整客户端资源目录。

在这些证据补齐前，继续保持 BLOCKED，不改代码、不创建 PR。
