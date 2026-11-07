# S4 Terry Ferry Routes Export Audit (B6)

## Scope and verdict

B6 exports exactly two static YBCS-offline Terry ferry route literals and their B2/B3 NPC menu crosswalk. This is not a complete ferry, transport-point, or fast-travel inventory. Magic-stone destinations remain B7 BLOCKED.

All records are `RECOVERED_SECONDARY` / `重构参考`; `runtimeVerified=false`. No retail/server response or runtime behavior is claimed.

## Source filename note

The current conversation attachment inventory does not contain a file named `ybcs_npc_travel.py`. The previously attached source file is named `ybcs_offline_npc_transport.py` (2,935 bytes), and it contains the two exact static route literals specified for B6. The export records the actual artifact name and does not rename or misattribute it.

- Actual artifact: `ybcs_offline_npc_transport.py`
- SHA-256: `ef885b8375dfdbe1696e9f4807906e580f51b0679f8954753da45f11eb9f5e92`
- Route constants: L15-L17
- Route tuples: L49-L64
- Exact route resolver: L69-L83

## Source inputs

| Source | SHA-256 / Git blob | Relevant evidence |
|---|---|---|
| `ybcs_offline_npc_transport.py` | `ef885b8375dfdbe1696e9f4807906e580f51b0679f8954753da45f11eb9f5e92` | `TERRY_FERRY_ACTION`, entity constants, two route tuples and resolver |
| `Quest.lib::NPCScript.txt` | Archive SHA-256 `23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397`; member SHA-256 `401b8a2f75f5418953f98b3eb2344fdd7649aae3c9b01f02028f4a09d7aa046b` | 4,572-byte member; B2 programs 48/49 at L160-L169 |
| `ybcs_npc_service_catalog.py` | `f98449ee09143095ec326aca26625394ed9a1c31d63f4285cc68855f15eca643` | Static semantic entries for program 48 and 49, L75-L76 |
| `ybcs_npc_menu_actions.py` | `ffaa941d3c176f94d6619a99934b75dcc497eb2fdc8ecb4ee5b1bc97b98deff2` | Menu dispatcher L130-L197; local-child requests L341-L410 |
| B2 export | SHA-256 `470182becaf20d72d9f5ced486e3c150396048c714ed957e073f4ac4098ff8ac`; Git blob `c4d456f816a4a00aebe906abd7161cccbb850dce` | Program 48/49 resource rows and semantic mapping |
| B3 export | SHA-256 `5c6523cf673d9ebb2cfe88606476417eb540110619f7a6da3158945ebbdc210d`; Git blob `41ead13644f405b863dd31a9f9c37f73a92427da` | Dialogue/service/close-only routes, protocol shapes and local-child request shapes |

## Two route literals

| Direction | Source map | NPC entity ID | NPC program | Target map | target_map_wire | target_spawn |
|---|---|---:|---:|---|---:|---|
| Outbound | `map:old:1500` | 21500 | 48 | `map:old:1373` | 1373 | (110, 50) |
| Return | `map:old:1373` | 21373 | 49 | `map:old:1500` | 1500 | (57, 121) |

Route source locations:

- Outbound tuple: `ybcs_offline_npc_transport.py:L50-L56`.
- Return tuple: `ybcs_offline_npc_transport.py:L58-L64`.
- Entity constants: L16-L17.
- Resolver: L69-L83.

The resolver matches exactly `source_map_id`, `npc_entity_id`, and `npc_program_index`, returning a route only for exactly one match. It does not accept an action parameter and does not mutate state.

## NPC ID and coordinate semantics

- The source field is `npc_entity_id`; exported as `npcEntityId`.
- It is not an SMF `object_id`, NPC template ID, or NPCScript program index.
- The route module does not supply NPC placement coordinates. `npcPlacementCoordinates` remains null / not recovered.
- `target_spawn` is exported as `arrivalCoordinates`. The source comment at L46-L48 says the spawn is adjacent to the destination Terry, never on the NPC cell itself.
- `target_map_id` and `target_map_wire` remain separate fields, even where their numeric suffixes match.

## B2/B3 menu action crosswalk

Each of programs 48 and 49 has one kind-1 greeting and three enabled kind-2 selectable rows. The three selectable rows are alternatives after the menu opens, not a required three-step sequence.

| Program | Option ordinal | NPCScript line | Text | B3 classification | Wire shape |
|---:|---:|---:|---|---|---|
| 48 | 0 | 162 | 进行对话 | dialogue-uplink | `49 09 <i16 target_word>` |
| 48 | 1 | 163 | 西西里奥岛 | service-uplink; route selector | `30 <i16 target_word> <i16 action=-1>` |
| 48 | 2 | 164 | 没事了. | close-only | none |
| 49 | 0 | 167 | 进行对话. | dialogue-uplink | `49 09 <i16 target_word>` |
| 49 | 1 | 168 | 沙君特港口 | service-uplink; route selector | `30 <i16 target_word> <i16 action=-1>` |
| 49 | 2 | 169 | 没事了. | close-only | none |

Counts:

- Route records: 2.
- Associated menu action records: 6.
- Destination route-selector actions: 2.
- Dialogue options: 2.
- Close-only options: 2.

For each program, `optionOrdinal` is the zero-based ordinal among enabled kind-2 rows. It is not the physical source line number, source row index, kind byte, or network action ID.

The B3 service dispatcher returns `serviceAction=-1` for both route selectors and labels it a default/sentinel, not a recovered retail business operation. `TERRY_FERRY_ACTION=-1` is the same numeric sentinel in the route module. This is a static numeric correlation only: the route resolver does not consume an action argument. The B3 route status remains `validated-no-response`; server response and business mutation remain unrecovered.

## Explicit B3 local-child request association

The B3 export defines three local-child follow-up request shapes:

| Prefix | Allowed programs | Option ordinal | Local dialog | Bytes | Applies to ferry 48/49 |
|---|---|---:|---:|---:|---|
| `49 05` | 12, 32 | 2 | 0xD2 | 24 | No |
| `49 06` | 11 | 2 | 0xD3 | 4 | No |
| `49 07` | 11 | 3 | 0xD4 | 6 | No |

Explicit cross-check: neither program 48 nor 49 appears in any allowed `programIndexes` list. Therefore the number of applicable local-child request shapes for the ferry routes is **0**. These prefixes are recorded as non-applicable references, not appended to the ferry action chain. Ferry destination selection is the B3 service-uplink shape `30 ... action=-1`, not a local-child `49 05/06/07` request.

## Menu-open protocol shape

B3 menu-open downlink:

`31 <u8 program> <i16 target> <i16 ability_selector>` (6 bytes).

This opens the menu. The subsequent selectable rows above are separate alternatives.

## Safety and limitations

1. Exactly two static routes are exported; no extrapolation to all ferries or all transport points.
2. Magic-stone item IDs and destinations are not in this source set; B7 remains BLOCKED.
3. NPC placement coordinates remain not recovered.
4. NPC entity IDs are not SMF object IDs.
5. Arrival spawn cells are not NPC placement cells.
6. `serviceAction=-1` remains a sentinel; no retail service response is inferred.
7. B3 local-child requests 49 05/06/07 are explicitly non-applicable to programs 48/49.
8. Business actions, auto-activation, wire emission and domain mutation remain disabled.

## Acceptance results

- Two route literals modeled: pass.
- Source/target maps, NPC entity IDs, program indexes, target map wire values and arrival coordinates preserved: pass.
- B2 programs 48/49 each have declaredCount=4, one kind-1 row and three kind-2 rows: pass.
- B3 menu crosswalk: six records, exactly two route selectors: pass.
- Local-child request association: three shapes recorded, zero applicable to ferry programs: pass.
- All records carry source fields, `RECOVERED_SECONDARY` / `重构参考`, and `runtimeVerified=false`: pass.
- No raw binary resources or extracted TXT files are included.
- No retail/server behavior is claimed.
