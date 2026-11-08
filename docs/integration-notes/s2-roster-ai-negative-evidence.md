# S2 6A/51 roster kind-7/8 短程序：第二份阴性证据报告

- Request ID: `auto-5-2`
- 交付类型：**NEGATIVE_EVIDENCE**（二选一的阴性报告；未生成绑定记录草案）
- 建议裁定：**关闭当前 S2 怪物—AI 绑定恢复工作流**；原因是现有静态材料不能支持任何一条具体单位与非默认程序的关联，不是证明所有离线路径都不存在非默认程序。
- 仓库基底：`vileosbot-bot/lapis-rebuild@d9832eb186d46c971e0dbf853426c76347a948c0`
- 来源性质：ybcs-offline 是独立重构实现。本文中从 ybcs 获得的证据等级统一为 **`RECOVERED_SECONDARY`**。不得提升为 `VERIFIED`，不得视为原版零售服务器行为。
- 方法：仅对总管核实的源码摘录和 bot 仓库已存档的静态研究文档进行对照；未运行任何原客户端、服务端、抓包程序或游戏二进制；未修改程序或 manifests。

## 0. 证据来源、复核范围及局限

| 证据 | 可用锚点 | SHA-256 / 来源状态 | 本轮实际可核实内容 |
| --- | --- | --- | --- |
| `src/legacy_gui_runtime/ybcs_old_ai_behavior.py` | L5–L9、L320 起、L323 起 | `b86d63c0b439e0a5734f03c83e789966eb66c01c87296d873380d2087cdaa013`（总管提供，未在本会话重新计算） | 文件头说明 kind 7/8 的短程序为 `order action_rows`，以及空串默认；解析函数入口、`_ORDER_BY_TOKEN` 关系 |
| `src/legacy_gui_runtime/ybcs_battle_wire.py` | L186、L583–L761、L1388 起、L1434 起 | `26b9f5263856f41bf6dd0784bbb591e001a9743b2050adb8baa72b3232be8fe0`（总管提供，未重新计算） | 九个 roster 字段及行号、`native_kind` 和 `behavior_template` 属性、builder/parser 规则 |
| `src/legacy_gui_runtime/ybcs_offline_training_battle.py` | L439–L449 附近 | **本次输入未提供该份解压源码哈希** | `tail_words=(native_unit_kind,0,0,0,0)`，`extra_text=b""` |
| `src/legacy_gui_runtime/ybcs_single_player_battle_runtime.py` | L118–L119、L134–L135、L351–L352、L367–L368、L1091、L1178–L1182；另 L2248、L2276、L2305 附近 | **未提供哈希** | 导入和使用 `BattleUnitRoster51`，以及使用 `record.native_kind` 作重放比对；**无足够赋值原文** |
| 客户端日志 `ybcs-gui-client.jsonl` | L98047、L98049 | **本次未重新读取原日志、未重新核算哈希** | 同一帧的两次 16 字节观察：`6a510000000081008100000009000000` |
| bot 仓库已存档 S2 文档及 manifest | 固定基底 `d9832eb1` | GitHub 连接器实际读取；见文末链接 | 现存 `concrete_historical_bindings.entries` 为空；其既有零售客户端分析不是 ybcs 绑定记录 |

**复核边界：**总管已确认上述摘录内容，本会话无法访问 `~/workspace/downloads/ybcs/extracted/` 的完整源文件。因此，本文不把摘录检查说成已逐行复核所有函数，也不把未提供的行号或哈希补造出来。下列阴性是**未获得足以生成绑定行的证据**，不等于对所有潜在实现路径作了穷尽性否定。

## Q1. BattleUnitRoster51 字段与 kind 7/8 程序

`ybcs_battle_wire.py:L583–L761` 的类声明共 **9 个字段**。下表逐字段映射至本次文档审计的候选记录字段；`raw_roster.*` 是**审计映射名称**，不是声称源代码定义了同名字段，也不会写入 manifests。

| 源字段 | 声明行 | builder 输入约束（总管摘录） | 文档映射 | 可证实/不可擅推的语义 |
| --- | ---: | --- | --- | --- |
| `words` | 586 | 23 个 | `raw_roster.words` | 可保留原数组；**不能在未读赋值代码前指定某下标为单位 ID** |
| `vector_words` | 587 | 11 个 | `raw_roster.vector_words` | 原值保留；不可推断向量的游戏含义 |
| `reserved_22` | 588 | 22 字节 `bytes` | `raw_roster.reserved_22` | 原字节保留；保留字段的语义未知 |
| `dwords` | 589 | 5 个 | `raw_roster.dwords` | 原值保留；不可擅命名为战斗/程序 ID |
| `primary_text` | 590 | `bytes` | `raw_roster.primary_text` | 未得到其是否为名称或其他文本的独立证明 |
| `secondary_text` | 591 | `bytes` | `raw_roster.secondary_text` | 同上 |
| `tail_words` | 592 | 5 个 | `raw_roster.tail_words`；另从 `[0]` 提取 `roster_kind` | `native_kind = tail_words[0]`（类内属性约 L744–L749） |
| `optional_words` | 593 | 4 个 `BattleOptionalWord` | `raw_roster.optional_words` | 仅能确认四元素字段；未提供内部结构及用途的逐行证据 |
| `extra_text` | 594 | `bytes | None`，默认 `None` | `raw_roster.extra_text`；kind 7/8 时可候选 `ai_program_raw` | `behavior_template = extra_text`（类内属性约 L750–L758）；**唯一已指明的本地短程序承载字段** |

规则及含义（`ybcs_battle_wire.py:L1388+`、`L1434+`，以及 `ybcs_old_ai_behavior.py:L5–L9,L320+`）：

1. `needs_extra = tail_words[0] in (7, 8)`；builder 要求 `extra_text` 的存在性与 `needs_extra` 一致。空字节串 `b""` 是“存在但内容为空”，不同于 `None`。
2. parser 至少要求 132 字节；kind 7/8 时读取一字节长度并提取 `extra_text`，其他 kind 的 `extra_text=None`。
3. `parse_old_live_ai_behavior` 将 `order action_rows` 文本解析为旧式 live-unit 程序，order 经 `_ORDER_BY_TOKEN`；空串使用内置 `ODNORMAL REST(20),ATTACK(80)`。
4. 总管提供的类别/偏移说明：kind 信息进入 live 单位 `+0x2C8`；本地行为在反序列化 roster 的 `+0xC4` 描述符路径处理，安装到 live `+0x344`。**`+0xC4` 不是已经证实的原始网络包固定偏移。**
5. 6A/51 的本地短程序不同于 6A/69 的完整网络 AI 模板；不能把解析后动作序列当作已恢复的 6A/69 程序 ID。

Q1 裁定：**字段结构与解析入口可按总管核实摘录成立；没有发现具体单位的非默认程序值。** 由于未获得构造函数完整函数体及 `BattleOptionalWord` 具体定义，不声称所有字段的实际序列化偏移和游戏语义已经逐项验证。

## Q2. 构造时有无真实非默认填充

| 路径 | 目前证据 | 当前裁定 | 不能推断的内容 |
| --- | --- | --- | --- |
| 离线训练 `ybcs_offline_training_battle.py:L439–L449` | 赋值 `tail_words=(native_unit_kind,0,0,0,0)`、`extra_text=b""` | **该已给出构造点未提供非默认短程序**；若 kind=7/8，解析器仅能走空串默认 | `native_unit_kind` 究竟取哪些值、是否另有赋值/改写、训练路径是否确实成功构造所有目标 kind |
| 单人战斗 `ybcs_single_player_battle_runtime.py` | 已给出类引用与重放 `record.native_kind` 对比位置 | **未获得非默认程序填充证据，亦未证明其不存在** | 全部 roster 创建处的 `extra_text` 实参、Profile 及数据表来源、是否存在覆盖/复用 |
| bot 仓库现存 S2 历史静态研究 | 现存 `concrete_historical_bindings.entries=[]` | 与“当前没有具体历史绑定行”的结论相容 | 不能替代 ybcs 单人战斗运行时的源码检查 |

**逻辑一致性检查：**已知 builder 要求 `extra_text` 的有无与 kind 7/8 对齐，而训练摘录固定传入 `b""`。如果这段代码确实经该 builder 成功构造 roster，则必须满足对应的 `needs_extra` 条件（或另有未提供的控制/转换逻辑）。这只是由摘录推出的**条件关系**，不是已执行成功、也不是 `native_unit_kind` 的实测取值。

当前没有提供完整的训练赋值函数、单人战斗构造函数或其 Profile 数据文件。故不能写“两条链均为空”。本轮 Q2 的正确答案是：**训练锚点为空；单人战斗实际填充仍是证据缺口**。

## Q3. 能否建立「遭遇/单位 → AI 程序」记录

执行 R2 的三个门槛，不允许跨级升级：

| 门槛 | 必要证据 | 本轮结果 |
| --- | --- | --- |
| L1：非默认程序存在 | 至少一条有来源的非默认 `extra_text` 原值 | **0 条可提取**：训练摘录只有空串，单人战斗未给出实际值 |
| L2：具体单位绑定 | 明确的单位键 + 该非默认原值 + 赋值链 | **0 条可审计绑定**：尚无 L1 数据与稳定单位键的连接 |
| L3：具体遭遇绑定 | 遭遇/Profile 键 → 单位键 → 非默认程序的完整链 | **0 条可审计绑定**：未提供完整遭遇/Profile 关联链 |

**0 条**表示“本次能够提交的合格记录数量为零”，不是对包内全部怪物或战斗的数量统计，也不是证明不存在其他未见数据。不能用怪物名、地图 ID、静态解析器能力、默认 `ODNORMAL` 或已经关闭的 6A/69 日志路线凑数。

本次没有产生 `encounter_id`、`unit_id`、`program_raw` 的具体绑定行，因而**不生成** `s2-roster-ai-binding-draft.md`，不更新 `manifests/enemy-ai-binding.json`。既有零售端 AI 恢复文档中的协议规则只作为边界对照，不转写成 ybcs 的具体绑定记录。

## Q4. 16 字节日志样本与 roster 头部

- 观察来源：客户端日志 L98047 / L98049，为同一帧的重复记录，**不计为两份独立样本**。
- 样本：`6a510000000081008100000009000000`，共 **16 字节**。
- 可直接判断：起始两字节为 `6A 51`，与 `BATTLE_UNIT_ROSTER_51_SUBTYPE = 0x51` 的操作码组合相容；但样本短于已知 parser 的 **132 字节**最小输入要求。
- **不能判断：**后续字节究竟对应完整 roster 的哪些字段，样本是否为真实完整帧、某种短消息、日志裁切或封装层观察。没有 builder 实际输入、完整函数体与日志封装代码，无法对“完整构造帧的前 16 字节”逐字节验证。

Q4 分类：**部分结构一致（仅 6A51 前缀）；完整帧头精确一致性未成立**。不能依此解析任何 kind、单位标识、`extra_text`，更不能声称恢复 6A/69。

## 5. 明确缺失的原文和数据（记录缺口，不阻断本次阴性报告）

1. `ybcs_old_ai_behavior.py`：`parse_old_live_ai_behavior` 自 L320 起至函数结束、其调用 `_ORDER_BY_TOKEN` 与行为行解析辅助函数的完整原文；其确切终止行未提供。
2. `ybcs_battle_wire.py`：`build_battle_unit_roster_51` 自 L1388 起的完整函数体、`parse_battle_unit_roster_51` 自 L1434 起的完整函数体、L583–L761 属性及字段实现、`BattleOptionalWord` 的定义；没有完整原文不能计算每个字段的实际 wire 偏移。
3. `ybcs_offline_training_battle.py`：包围 L439–L449 构造调用的完整函数和 `native_unit_kind` 的赋值链，及该份解压文件的 SHA-256；确切函数首尾行未给。
4. `ybcs_single_player_battle_runtime.py`：包含 L134–L135、L351–L352、L367–L368、L1091、L1178–L1182 处 roster 创建/传输/使用的完整函数，以及 L2248、L2276、L2305 处 `record.native_kind` 重放比对函数；尤其是**所有 `BattleUnitRoster51` 实例化处对 `extra_text` 的赋值**。其源文件 SHA-256 未提供。
5. 上述函数实际引用的 Battle Profile、单位定义与遭遇静态数据文件及各自 SHA-256；在未获原代码引用前，不臆造数据文件名。
6. `ybcs-gui-client.jsonl` 中对应两条完整 JSON 记录、日志包记录/裁切函数，以及客户端日志文件 SHA-256；本报告只引用总管已核实的行号与 16 字节文本。

**闭环建议：**这些缺口使“没有可提交的绑定行”成立，但不足以证明“单人战斗绝不填充非默认程序”。若未来取得明确的新证据，应由总管另立任务评估；本次小范围 S2 路径按当前门槛关闭。

## 6. 交付裁定和修改范围

- 最终交付：**本阴性证据报告（唯一文件）**。
- 可交付非默认单位绑定：**0**；可交付遭遇绑定：**0**。
- 建议总管：**关闭 S2 当前绑定恢复路线**；保留现有协议/解析能力研究，但不标记具体怪物 AI 已恢复。
- 本文涉及 ybcs 的来源结论全部为 **`RECOVERED_SECONDARY`**；无法确定的地方直接写“缺口”，不借用 bot 零售端原有等级。
- 无程序运行、无新的抓包、无 6A/69 日志恢复、无零售 AI 语义升级；不修改游戏代码、`manifests`、`Plan.md`、主号仓库或任何已存在的系统文档。
- 提交遵守单次提交，且**不开 PR、不合并**。

## 7. 已实读的 bot 仓库交叉参照

以下均在固定 `d9832eb1` 基底上通过 GitHub 连接器读取（**不是**本次 ybcs 源文件的替代证明）：

- [现有 S2 实例绑定研究](../systems/enemy-ai-binding-recovery.md)：声明没有留存历史非默认逐单位程序，且内存记录 `+0xC4` 不能当作固定 wire 偏移。
- [现有 S2 接入边界](s2-enemy-ai.md)：只在恢复真实 roster 或网络程序以后补具体行。
- [现有绑定 manifest](../../manifests/enemy-ai-binding.json)：`concrete_historical_bindings.entries=[]`，本轮保持不变。
- [静态调查探针](../../tools/probe_ai_binding.py)：描述旧客户端中网络程序优先、本地 kind 7/8 及默认程序的来源优先级。
- [S2 测试](../../tests/parsers/test_ai_binding.py)：约束 manifest 中不应凭空产生具体历史实例绑定。

**最终说明：**报告只交付可追溯的阴性结论与证据缺口；不对未提供的单人运行时构造体、战斗 Profile 或日志截断实现作肯定性猜测。
