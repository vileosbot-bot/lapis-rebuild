# S4 NPC Service Catalog Export Audit (B2)

## Scope

B2 only. This export separates the actual `NPCScript.txt` resource programs from the 39-row static semantic mapping in `ybcs_npc_service_catalog.py`. It does not implement B3 menu action routing, map placement, retail service responses, or gameplay mutations.

## Source identity

- Source project: `ybcs-offline`
- Archive: `Quest.lib` (21205 bytes)
- Quest.lib SHA-256: `23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397`
- Archive check: `0xd3eb5f05`
- Archive directory members: 15
- Member: `NPCScript.txt`
- Member offset: `0x1071`
- Member packed size: 1371 bytes
- Member unpacked size: 4572 bytes
- NPCScript member SHA-256: `401b8a2f75f5418953f98b3eb2344fdd7649aae3c9b01f02028f4a09d7aa046b`
- Decoded lines: 170
- Parser source: `ybcs_quest_runtime.py` SHA-256 `b4f6e6f968a3e2cf3b203f52ba60698df60cba578d47162c88c4b710c4a11d0d`; `decode_text` lines 171–172 and `parse_npc_programs` lines 230–273.
- Semantic source: `ybcs_npc_service_catalog.py` SHA-256 `f98449ee09143095ec326aca26625394ed9a1c31d63f4285cc68855f15eca643`; `_ROWS` lines 37–77.
- All exported records: `RECOVERED_SECONDARY` / `重构参考`; `runtimeVerified=false`.

## Actual NPCScript inventory

- Program count: 39.
- Program indexes: 11–49, contiguous and unique: **yes**.
- Declared menu rows: 125.
- Kind 1 rows: 50 (all enabled: 50).
- Kind 2 rows: 75 (all enabled: 75).
- Disabled rows inside `declared_count`: 0.
- Enabled selectable kind 2 rows with per-program ordinal: 75.
- Full source-line preservation: 170/170 lines.

`declared_count` equals the number of rows parsed for every program. The source also contains five semicolon-prefixed, syntactically menu-shaped commented rows outside all program `declared_count` blocks. They are retained separately as `commentedMenuRowCandidates`; no owning program is asserted. The final `;999` line is retained as a comment/sentinel, not promoted to a menu row.

### Per-program audit

| Program | Title | Header line | declared_count | Parsed rows | kind 1 | kind 2 | Enabled kind 2 | Disabled declared |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 11 | 装饰品商人 | 1 | 6 | 6 | 1 | 5 | 5 | 0 |
| 12 | 铁匠 | 8 | 5 | 5 | 1 | 4 | 4 | 0 |
| 13 | 武器商人 | 14 | 4 | 4 | 1 | 3 | 3 | 0 |
| 14 | 防御具商人 | 19 | 4 | 4 | 1 | 3 | 3 | 0 |
| 15 | 消耗品商人 | 24 | 4 | 4 | 1 | 3 | 3 | 0 |
| 16 | 魔法商人 | 29 | 4 | 4 | 1 | 3 | 3 | 0 |
| 17 | 仓库管理人 | 34 | 4 | 4 | 1 | 3 | 3 | 0 |
| 18 | 银行员 | 39 | 5 | 5 | 1 | 4 | 4 | 0 |
| 19 | 军团长 | 45 | 6 | 6 | 1 | 5 | 5 | 0 |
| 20 | 神官 | 52 | 4 | 4 | 1 | 3 | 3 | 0 |
| 21 | 龙兵的家 | 57 | 4 | 4 | 1 | 3 | 3 | 0 |
| 22 | 卡奥斯村庄亲卫兵 | 62 | 4 | 4 | 4 | 0 | 0 | 0 |
| 23 | 义勇军队长迪米 | 69 | 6 | 6 | 4 | 2 | 2 | 0 |
| 24 | 女孩 | 76 | 1 | 1 | 1 | 0 | 0 | 0 |
| 25 | 伤者 | 79 | 1 | 1 | 1 | 0 | 0 | 0 |
| 26 | 受伤的士兵 | 82 | 2 | 2 | 1 | 1 | 1 | 0 |
| 27 | 亏力伯 | 85 | 1 | 1 | 1 | 0 | 0 | 0 |
| 28 | 沙君特港龙兵之家 | 88 | 4 | 4 | 1 | 3 | 3 | 0 |
| 29 | 沙君特港防具商卡蓝特 | 93 | 4 | 4 | 1 | 3 | 3 | 0 |
| 30 | 沙君特港武器商 | 98 | 4 | 4 | 1 | 3 | 3 | 0 |
| 31 | 沙君特港消耗物品商 | 103 | 4 | 4 | 1 | 3 | 3 | 0 |
| 32 | 沙君特港铁匠 | 108 | 5 | 5 | 1 | 4 | 4 | 0 |
| 33 | 佣兵传说圣诞老人 | 114 | 3 | 3 | 2 | 1 | 1 | 0 |
| 34 | 特米礼物之家 | 118 | 4 | 4 | 1 | 3 | 3 | 0 |
| 35 | 托罗迷礼物之家 | 123 | 4 | 4 | 1 | 3 | 3 | 0 |
| 36 | 村庄标志板 | 128 | 1 | 1 | 1 | 0 | 0 | 0 |
| 37 | 村庄标志板 | 130 | 1 | 1 | 1 | 0 | 0 | 0 |
| 38 | 村庄标志板 | 132 | 1 | 1 | 1 | 0 | 0 | 0 |
| 39 | 村庄标志板 | 134 | 1 | 1 | 1 | 0 | 0 | 0 |
| 40 | 地区标志板1010 | 136 | 2 | 2 | 2 | 0 | 0 | 0 |
| 41 | 地区标志板1010 | 139 | 1 | 1 | 1 | 0 | 0 | 0 |
| 42 | 地区标志板1010 | 141 | 1 | 1 | 1 | 0 | 0 | 0 |
| 43 | 地区标志板1020 | 143 | 2 | 2 | 2 | 0 | 0 | 0 |
| 44 | 地区标志板1010 | 146 | 2 | 2 | 2 | 0 | 0 | 0 |
| 45 | 地区标志板1010 | 149 | 2 | 2 | 2 | 0 | 0 | 0 |
| 46 | 销售宠物物品 | 152 | 4 | 4 | 1 | 3 | 3 | 0 |
| 47 | 斯皮克 | 157 | 2 | 2 | 1 | 1 | 1 | 0 |
| 48 | 特里 | 160 | 4 | 4 | 1 | 3 | 3 | 0 |
| 49 | 特里 | 165 | 4 | 4 | 1 | 3 | 3 | 0 |

### Commented menu-shaped source rows (not in declared_count)

| NPCScript line | Adjacent preceding program (context only) | kind | Text | Association |
|---:|---:|---:|---|---|
| 67 | 22 | 2 | 进行对话 | unresolved; not assigned |
| 68 | 22 | 2 | 不需要 | unresolved; not assigned |
| 78 | 24 | 2 | 进行对话 | unresolved; not assigned |
| 81 | 25 | 2 | 进行对话 | unresolved; not assigned |
| 87 | 27 | 2 | 进行对话 | unresolved; not assigned |

### Other comment/sentinel lines

| NPCScript line | Raw line | Classification |
|---:|---|---|
| 170 | `;999` | comment/sentinel; not a menu row |

## Static semantic mapping (separate source and model)

- Static semantic mapping count: 39.
- Source: `ybcs_npc_service_catalog.py::_ROWS`, not an NPCScript member.
- Source SHA-256: `f98449ee09143095ec326aca26625394ed9a1c31d63f4285cc68855f15eca643`.
- The 39 semantic records are stored under `semanticMappings.programs`; actual resource programs are stored under `npcScriptPrograms`. They are not merged into one record collection.
- Every semantic mapping title was compared with the corresponding NPCScript program title; all 39 matched.
- The `gameplay_effect` value is preserved as a static YBCS semantic label, not interpreted as permission to execute the operation.

## Menu ordinal semantics and action boundary

- `optionOrdinal` is assigned only to enabled `kind == 2` rows.
- Ordinals start at zero and reset for each NPCScript program.
- `kind == 1` rows and disabled/commented candidates have `optionOrdinal=null`.
- `optionOrdinal` is a UI selectable-row ordinal. It is **not** a network action ID.
- B3 native menu action routing is out of scope and is not embedded in this dataset.

## Conservative runtime policy

- Inspection allowed: yes.
- UI presentation allowed: yes.
- Business actions enabled: **no**.
- Automatic activation: **no**.
- Wire emission: **no**.
- Gameplay mutation: **no**.
- Retail server responses: not recovered by this export.
- No map placement, shop stock, bank operation, repair operation, recruitment operation, transport execution, or other gameplay action is enabled by B2.

## Validation results

- Supplied canonical parser `parse_npc_programs` and line-tracked parser agree on all 39 programs and all 125 declared rows.
- Program index set equals exactly 11–49, with no duplicates.
- For every program, `declared_count == len(menuRows)`.
- All 170 decoded source lines are preserved with 1-based line numbers.
- All 39 static semantic titles match their corresponding NPCScript resource titles.
- All records carry the required source metadata and `RECOVERED_SECONDARY` / `runtimeVerified=false`.
- Original binary `Quest.lib` and extracted raw `NPCScript.txt` are not included in repository outputs.

## Known boundaries

- Five commented menu-shaped lines are outside the declared program blocks; their program ownership remains unresolved.
- The trailing `;999` is retained as a comment/sentinel; no semantics are inferred.
- NPC placement data is not present in this input and is not generated.
- Business actions and server responses remain unrecovered/disabled.
- This is secondary reconstruction evidence only, not original retail server verification.
