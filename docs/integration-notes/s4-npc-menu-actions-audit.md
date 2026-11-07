# S4 NPC Menu Action Routing Audit (B3)

## Scope

B3 only. This export derives NPC menu action routing metadata from `ybcs_npc_menu_actions.py`, the B2 NPCScript resource export, and the static semantic mapping in `ybcs_npc_service_catalog.py`. It does not implement or claim retail server responses.

## Inputs and hashes

| Input | SHA-256 | Use |
|---|---|---|
| `ybcs_npc_menu_actions.py` | `ffaa941d3c176f94d6619a99934b75dcc497eb2fdc8ecb4ee5b1bc97b98deff2` | Client-derived route dispatcher, request codecs, and zero-mutation session validation |
| `ybcs_npc_service_catalog.py` | `f98449ee09143095ec326aca26625394ed9a1c31d63f4285cc68855f15eca643` | Static NPC program semantic references |
| `Quest.lib` | `23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397` | Original container provenance for `NPCScript.txt` |
| B2 `s4-npc-services-data.json` | `470182becaf20d72d9f5ced486e3c150396048c714ed957e073f4ac4098ff8ac` | Previously exported NPCScript menu rows and semantic references |

The B2 JSON was read back from the target GitHub branch before this build. Its Git blob SHA was `c4d456f816a4a00aebe906abd7161cccbb850dce`.

## Resource and route counts

- NPCScript programs: **39**, indexes **11–49** continuous.
- Enabled `kind == 2` menu rows: **75**.
- Route mappings: **75**.
- Classification counts:
  - Dialogue uplink: **25**.
  - Service uplink: **25**.
  - Client-local dialog: **4**.
  - Close-only: **21**.
- Local child request shapes: **3**.

## Route mapping by program

| Program | Title | declared_count | kind=2 options | Dialogue | Service | Local dialog | Close-only |
|---:|---|---:|---:|---:|---:|---:|---:|
| 11 | 装饰品商人 | 6 | 5 | 1 | 1 | 2 | 1 |
| 12 | 铁匠 | 5 | 4 | 1 | 1 | 1 | 1 |
| 13 | 武器商人 | 4 | 3 | 1 | 1 | 0 | 1 |
| 14 | 防御具商人 | 4 | 3 | 1 | 1 | 0 | 1 |
| 15 | 消耗品商人 | 4 | 3 | 1 | 1 | 0 | 1 |
| 16 | 魔法商人 | 4 | 3 | 1 | 1 | 0 | 1 |
| 17 | 仓库管理人 | 4 | 3 | 1 | 1 | 0 | 1 |
| 18 | 银行员 | 5 | 4 | 1 | 2 | 0 | 1 |
| 19 | 军团长 | 6 | 5 | 1 | 3 | 0 | 1 |
| 20 | 神官 | 4 | 3 | 1 | 1 | 0 | 1 |
| 21 | 龙兵的家 | 4 | 3 | 1 | 1 | 0 | 1 |
| 22 | 卡奥斯村庄亲卫兵 | 4 | 0 | 0 | 0 | 0 | 0 |
| 23 | 义勇军队长迪米 | 6 | 2 | 1 | 1 | 0 | 0 |
| 24 | 女孩 | 1 | 0 | 0 | 0 | 0 | 0 |
| 25 | 伤者 | 1 | 0 | 0 | 0 | 0 | 0 |
| 26 | 受伤的士兵 | 2 | 1 | 1 | 0 | 0 | 0 |
| 27 | 亏力伯 | 1 | 0 | 0 | 0 | 0 | 0 |
| 28 | 沙君特港龙兵之家 | 4 | 3 | 1 | 1 | 0 | 1 |
| 29 | 沙君特港防具商卡蓝特 | 4 | 3 | 1 | 1 | 0 | 1 |
| 30 | 沙君特港武器商 | 4 | 3 | 1 | 1 | 0 | 1 |
| 31 | 沙君特港消耗物品商 | 4 | 3 | 1 | 1 | 0 | 1 |
| 32 | 沙君特港铁匠 | 5 | 4 | 1 | 1 | 1 | 1 |
| 33 | 佣兵传说圣诞老人 | 3 | 1 | 1 | 0 | 0 | 0 |
| 34 | 特米礼物之家 | 4 | 3 | 1 | 1 | 0 | 1 |
| 35 | 托罗迷礼物之家 | 4 | 3 | 1 | 1 | 0 | 1 |
| 36 | 村庄标志板 | 1 | 0 | 0 | 0 | 0 | 0 |
| 37 | 村庄标志板 | 1 | 0 | 0 | 0 | 0 | 0 |
| 38 | 村庄标志板 | 1 | 0 | 0 | 0 | 0 | 0 |
| 39 | 村庄标志板 | 1 | 0 | 0 | 0 | 0 | 0 |
| 40 | 地区标志板1010 | 2 | 0 | 0 | 0 | 0 | 0 |
| 41 | 地区标志板1010 | 1 | 0 | 0 | 0 | 0 | 0 |
| 42 | 地区标志板1010 | 1 | 0 | 0 | 0 | 0 | 0 |
| 43 | 地区标志板1020 | 2 | 0 | 0 | 0 | 0 | 0 |
| 44 | 地区标志板1010 | 2 | 0 | 0 | 0 | 0 | 0 |
| 45 | 地区标志板1010 | 2 | 0 | 0 | 0 | 0 | 0 |
| 46 | 销售宠物物品 | 4 | 3 | 1 | 1 | 0 | 1 |
| 47 | 斯皮克 | 2 | 1 | 1 | 0 | 0 | 0 |
| 48 | 特里 | 4 | 3 | 1 | 1 | 0 | 1 |
| 49 | 特里 | 4 | 3 | 1 | 1 | 0 | 1 |

## Identifier semantics

The following fields remain independent:

- `sourceLineNumber`: 1-based physical line number in `NPCScript.txt`.
- `sourceRowIndex`: zero-based row index within the declared program block.
- `optionOrdinal`: zero-based ordinal among enabled `kind == 2` rows in that program.
- `resourceKind`: resource row kind; for these mappings it is always `2` and is **not** a wire action ID.
- `serviceAction`: separate program-specific dispatcher value; it is not derived from `optionOrdinal` or `resourceKind`.
- `localDialogId`: client-local D2/D3/D4 dialog selector, distinct from service action and network response.

## Action categories and response boundary

Dialogue and service uplink routes are marked `validated-no-response`, matching the source module's `consume_action()` observation status. This means the client request shape and session-bound route can be validated by the YBCS offline validator; it does **not** mean a retail server response, business effect, or gameplay mutation has been recovered.

Local D2/D3/D4 child requests retain the source module's `validated-local-child-request` status. Their subsequent server response and business effects remain `not-recovered`.

Close-only routes have no menu-selection uplink. They are not assigned a fabricated action value.

The source module identifies outer `0x54` as the inventory double-click path, not the NPC menu opener; it is explicitly excluded from the menu protocol model.

## Protocol shapes

- Menu open downlink: `31 <u8 program> <i16 target> <i16 ability_selector>` (6 bytes).
- Dialogue uplink: `49 09 <i16 target_word>` (4 bytes).
- Service uplink: `30 <i16 target_word> <i16 action>` (5 bytes).
- Local child requests: `49 05`, `49 06`, and `49 07` fixed-shape follow-ups; selecting the local dialog row itself emits no menu-selection wire.

## Safety policy

- Business operations: disabled by default.
- Automatic activation: disabled.
- Wire emission by this data policy: disabled.
- Domain mutation: disabled.
- Retail/server response: not recovered.
- Runtime verification: false.
- Evidence level on every exported record: `RECOVERED_SECONDARY` / reconstruction reference.

## Validation

- All 39 program indexes checked against the B2 resource export and static semantic module.
- All 75 route mappings are generated only from enabled `kind == 2` rows.
- `optionOrdinal`, `sourceLineNumber`, and `sourceRowIndex` are stored separately.
- Service and local-dialog routes are stored in separate arrays.
- Every exported record carries source provenance and evidence metadata.
- No route enables a business operation or domain mutation.
- TypeScript policy is designed for strict type checking.

## Limitations

This is a secondary reconstruction of the client dispatcher and YBCS offline validation boundary. Retail server responses, gameplay business mutations, and runtime verification are not established by this export.
