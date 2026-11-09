# W5 / auto-2-1 — B0 source preflight and B1 world-catalog audit

## Scope and verdict
- Repository: `vileosbot-bot/lapis-rebuild`
- Work branch: `data/ch1-world-catalog`
- Baseline: `d9832eb186d46c971e0dbf853426c76347a948c0`
- Evidence for **all ybcs-derived rows**: `RECOVERED_SECONDARY`; `runtimeVerified=false`.
- **B0 verdict: PASS by supervising owner adjudication.** Missing local sources are treated as **总管本地核实，本会话未重读**, never as independently re-read by this worker.
- **B1 output state: PARTIAL_CATALOG_ROSTER / EVIDENCE_GAP**, not a completed 108-member physical roster. This records available evidence without inventing map IDs or map cells.
- This commit is a B0/B1 checkpoint only. No gameplay code, source binaries, routes, NPC placement or Quest runtime modified.

## B0 independently re-read and SHA-256 matched (7/7)
For these seven source texts, this worker read all available text content (for the 5,120-line source in six consecutive ranges), restored the source's final LF and SHA-256 matched the byte-count metadata. These checks occurred in this conversation.

| Source (under `src/legacy_gui_runtime/` unless specified) | Lines | SHA-256 | Attribution |
|---|---:|---|---|
| `ybcs_offline_world_catalog.py` | 658 | `34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703` | 本会话独立核实 |
| `ybcs_offline_field_encounters.py` | 5120 | `94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a` | 本会话独立核实 |
| `ybcs_npc_service_catalog.py` | 265 | `f98449ee09143095ec326aca26625394ed9a1c31d63f4285cc68855f15eca643` | 本会话独立核实 |
| `ybcs_quest_runtime.py` | 679 | `b4f6e6f968a3e2cf3b203f52ba60698df60cba578d47162c88c4b710c4a11d0d` | 本会话独立核实 |
| `ybcs_offline_npc_transport.py` | 93 | `ef885b8375dfdbe1696e9f4807906e580f51b0679f8954753da45f11eb9f5e92` | 本会话独立核实 |
| `lapis_lib.py` | 140 | `f742e0f8d6425bed20118a3e69bac1041943efc31262e078cc3679b8e4bbfcae` | 本会话独立核实 |
| `pkware_blast.py` | 250 | `8500511a4017742bc8a3271aff7013b7cac0c369ca75575c9d8136d4d7239e00` | 本会话独立核实 |

## B0 owner-local checked; worker did not re-read (6/6)
**All entries in this table are explicitly: 总管本地核实，本会话未重读.**

| Source | Size / lines | SHA-256 | Attribution |
|---|---|---|---|
| `ybcs_offline_route_resources.py` | 629 lines | `16936a583d5e7f6957bc181659b926ac7e66aa471ac3abe3d0ecdace33963119` | 总管本地核实，本会话未重读 |
| `ybcs_map_movement.py` | 424 lines | `27de2a0c39d0a6f9634199726415050a76db7bd362c40298a25a37c1411fef49` | 总管本地核实，本会话未重读 |
| `map_resource_dataset.py` | 485 lines | `ba82a1c3c05b3a622676b8fb2caa3060462218e1d7eee1f84c775c7be22b2f93` | 总管本地核实，本会话未重读 |
| `ybcs_map_render.py` | 801 lines | `755c6f0ab29b1007a9ce77c671717c325b8166cc1d3241ad939c82967a699e81` | 总管本地核实，本会话未重读 |
| `runtime/client/NRes/Set.lib` | 112730 bytes | `ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe` | 总管本地核实，本会话未重读 |
| `runtime/client/NRes/Quest.lib` | 21205 bytes | `23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397` | 总管本地核实，本会话未重读 |

- `runtime/client/SGRes/`: **413 files**, of which **32 are `sz-*.lib`**, **总管本地核实，本会话未重读**. The former reported 28 was corrected by the owner.
- The source docstring at `src/legacy_gui_runtime/ybcs_offline_world_catalog.py:L4-L20` reports **111 same-stem MMF/SMF/IMF triplet bundles** and a **108-map full exploration catalog**. Those are distinct claims from the 32 `sz-*.lib` count.
- Existing S4 audit references `Set.lib::zone_name.txt` SHA-256 `02541808ee6860c1fea4d7ca8cb31d1b0dfe326a3712e95eadbb3218370fa9dd` and `Quest.lib::NPCScript.txt` SHA-256 `401b8a2f75f5418953f98b3eb2344fdd7649aae3c9b01f02028f4a09d7aa046b`. **These member hashes were not independently recomputed in B0, and are not represented as owner-reverified.**

## B1 exact source-based candidate recovery

The world catalog source **does not contain a literal 108-member map-ID roster**. `build_old_offline_world_catalog(root)` enumerates `SGRes/sz-*.imf` at `src/legacy_gui_runtime/ybcs_offline_world_catalog.py:L517-L558`, then validates MMF/SMF/IMF, map names, spawn safety, and quarantines malformed resources. Therefore it is incorrect to pretend all 108 physical map identities have been enumerated without the resource tree.

| Count | Result | Derivation |
|---|---:|---|
| Expected explorable catalog size | 108 | world-catalog source docstring L16 |
| Expected MMF/SMF/IMF same-stem source bundles | 111 | source docstring L4-L5 |
| Explicit ordinary-Mora policy IDs | 49 | `GENERAL_ORDINARY_MORA_MAP_IDS` L67-L75 |
| S1 distinct referenced field-map IDs | 27 | 63-row S1 CSV |
| Additional S1-only IDs outside ordinary policy | 6 | 1070, 1320, 1330, 1343, 1346, 1352 |
| **Source-named candidate map IDs (union)** | **55** | 49 + 6 |
| Conditional remaining identities if all 55 are catalog members | 53 | 108 - 55, **not a verified completeness count** |
| Fully verified 108-catalog membership rows | **not-recovered** | SGRes files not re-read |

### S1 crosswalk constraints
- Input: `docs/integration-notes/s1-encounter-binding-crosswalk.csv` at baseline `d9832eb186d46c971e0dbf853426c76347a948c0`; Git blob SHA-1 `141e6abbbecc62baf86e0d20fdd8cbfa008f4ef3` (SHA-1, not SHA-256).
- Actual rows: **63**, columns **23**; WILD **35**, STORY **28**.
- Chapter 1: **6 rows**, maps 1030 / 1060 / 1070 / 1090.
- Chapter 2: **9 rows**, maps 1040 / 1045.
- Other chapters or UNKNOWN: **48 rows**.
- S1 map-to-story association is not an ID-namespace equivalence; story-source IDs, field-map IDs, NPC entities and battle-zone IDs are kept distinct.
- A map may belong to more than one S1 chapter reference, e.g. map 1500; preserve multi-valued chapter references.
- Neither ordinary-Mora membership nor S1 occurrence proves exact membership in the currently installed 108-item validated resource catalog.

### Catalog record policy
The `world-catalog.json` stores **55 uniquely keyed candidate map rows** (not 108 fabricated rows). Each row includes its evidence locator, ordinary-Mora inclusion, S1 row IDs, chapter references, null `zoneName`, null `explorationSpawn`, explicit `not-recovered` status and `RECOVERED_SECONDARY` evidence level.

Six `_AUDITED_SPAWN_OVERRIDES` constants from source L89-L99 are stored separately in applicable records as **unrevalidated offline-Mora override candidates**; they are **not** promoted to a verified resource spawn, map entry position or physical graph coordinate.

The 453/498/499 values at source L61 are only `_KNOWN_PLACEHOLDER_MAPS`, **not** asserted to be a measured catalog quarantine list. Quarantine contents are `not-recovered`.

## B1 tests performed
- Exact ordinary policy ID count: **49**, sorted unique.
- Exact S1 row count: **63**, parsed as CSV with quoted comma fields.
- S1 map count: **27**; candidate union **55**, all unique.
- Additional S1 IDs: **1070, 1320, 1330, 1343, 1346, 1352**.
- First chapter: **6** S1 records / **4** map IDs; second chapter: **9** records / **2** map IDs.
- Every candidate has `evidenceLevel=RECOVERED_SECONDARY`, `runtimeVerified=false`, and `catalogMembershipStatus=not-recovered`.
- No JSON row pretends to have read raw SGRes/Set.lib/Quest.lib bytes, to prove 108-member completeness, or to describe physical adjacency.

## Remaining evidence gaps / handoff
1. To complete the **exact 108-map** directory, obtain the owner-local `build_old_offline_world_catalog(root)` result or an audited enumeration of the 108 map wires plus quarantine reasons; independently accessible raw SGRes is not assumed.
2. Map names require the decoded `Set.lib::zone_name.txt` table, or a verified owner-local export; no default label is misrepresented as the original name.
3. Map-specific MMF/SMF/IMF bundle integrity, derived safe spawns, sparse clearance, component sizes, region grouping and actual quarantine identities remain `not-recovered`.
4. Route/gate, NPC placement and Quest policy extraction belong to later B4-B8 and were not performed here.
5. This checkpoint is ready for supervising-owner review, **not** a certification of an exact 108-member resource roster.

## Repository scope
Only `data/ch1-world-catalog/world-catalog.json` and this `data/ch1-world-catalog/audit.md` are new in the B1 checkpoint. The remaining four files in the approved six-file deliverable are reserved for future batches. Original .lib/.imf/.mmf/.smf/.txt resources are never committed.

## B2 — 108-map owner-local builder roster recovery (owner adjudication, 2026-11-08)

### Attribution and fixed source boundary

- **Source channel: 总管本地运行，本会话未重跑**.
- Exact attribution on every validated member: **总管本地运行 build_old_offline_world_catalog (extracted/)，本会话未重跑**.
- Producer: `src/legacy_gui_runtime/ybcs_offline_world_catalog.py` (`build_old_offline_world_catalog(root)` lines **517–558**), source file SHA-256 `34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703`. This SHA-256 identifies the **Python source file**, **not** an exported builder-run result file (no result-file SHA-256 was supplied).
- Input root `extracted/`; original client was **not run** by this worker or the builder.
- Owner-local builder outcome: **111 installed / 108 explorable / 3 quarantined**. All figures are from the owner's execution, not this worker's filesystem.
- All B2 records retain `evidenceLevel=RECOVERED_SECONDARY`, `runtimeVerified=false`. `catalogMembershipStatus=validated` means **validated in the owner-local static builder run**, not VERIFIED retail/runtime evidence.

### Full membership and B1 reconciliation

| Measure | B1 checkpoint | B2 owner-local builder result |
|---|---:|---:|
| Source-named candidate map IDs | 55 | 55 preserved |
| Newly identified catalog map IDs | 0 | **53** |
| Identified complete explorable map members | not-recovered | **108** |
| Runtime proof of original-client behavior | none | none |
| Map names & safe-cell counts | not-recovered | **108 supplied** |
| Regions | not-recovered | **8 groups + root page** |
| Quarantine | not-recovered | **3 rows** |

B2 supersedes B1's historical conditional `108-55=53` unknown-count discussion: the owner supplied a **full explicit 108-row enumerated builder output**; the previous 55 IDs all occur in the supplied 108 entries, and 53 additional member IDs were added. There are no synthetic numbered placeholders. Previously recorded S1 row IDs, chapter relations, ordinary-Mora membership and audited override **candidates** are preserved without changing their independent evidence semantics.

### Owner-provided regions (region key / zone title / membership)

| Key | Owner-local title | Maps |
|---|---|---:|
| `story-west` | 剧情场景·西线 | 18 |
| `story-east` | 剧情场景·东线 | 11 |
| `arena-event` | 竞技与活动场景 | 14 |
| `mainland-south` | 大陆南部 | 17 |
| `mainland-north` | 大陆北部 | 12 |
| `islands-west` | 群岛与港口·西 | 12 |
| `islands-east` | 群岛与港口·东 | 8 |
| `city-services` | 城市设施与小游戏 | 15 |

Separate root page: `map:old:1000` / `卡奥斯_村庄`, **one root map, not a region member**. Region membership totals **107**, plus root **1**, yields **108**. The eight region groups reflect the builder's paging/catalog grouping, **not** physical road connectivity.

### Quarantine (excluded from all 108 members)

| mapWire | Builder quarantine reason |
|---:|---|
| 453 | `ValueError: truncated SMF data` |
| 498 | `ValueError: truncated SMF data` |
| 499 | `ValueError: truncated SMF data` |

The three map wires match `_KNOWN_PLACEHOLDER_MAPS` at source line 61. Reasons and membership come from **总管本地运行，本会话未重跑**, not from this worker opening those SMF bytes. The top-level JSON `quarantine` array holds separate records and those three wires are excluded from `mapCandidates`.

### Preserve anomalies and not-recovered dimensions

- Map `400`, `401`, `402`, `403`: all use the identical builder-returned name `卡日_葛罗坎_纱坦_出没地图`; keep four separate map IDs.
- Map `406`/`407`/`408` have names `旧地图 0406` / `旧地图 0407` / `旧地图 0408`; map `1027` is `旧地图 1027`. No inferred replacement names.
- Map `1501` has **safeCellCount=0**, preserved literally. A source `_AUDITED_SPAWN_OVERRIDES` candidate exists for this ID but the B2 table did not supply the builder's actual spawn; `explorationSpawn=null` remains.
- No B2 per-map `spawn`, `componentSize`, `sparseClearance`, MMF/SMF/IMF file bytes, or per-file hashes were provided. All such fields stay `not-recovered`.
- `zoneName` is taken from the **owner-supplied builder output**; this worker has not read `Set.lib::zone_name.txt` or claimed to reproduce its decoding.
- Catalog membership and safe-cell counts are source-backed static **secondary evidence**, not a retail-authoritative map-warp policy.

### B2 acceptance checks

- Supplied rows: **108**, unique mapWire: **108**, sorted ascending: **yes**.
- Existing B1 candidate rows: **55/55** retained, original S1 crosswalk/ordinary-Mora/override/source references preserved: **yes**.
- Added rows: **53**.
- Regional membership: **107** across eight groups (18 / 11 / 14 / 17 / 12 / 12 / 8 / 15); root: **1**.
- Quarantined: **3** and none overlaps a catalog member.
- Ordinary Mora whitelist remains **49**, unchanged.
- B2 validated map rows with `RECOVERED_SECONDARY`, `runtimeVerified=false`, `catalogMembershipStatus=validated`: **108/108**.
- Cross-file JSON parse and source provenance checks: **passed**.
- No original resources imported, no game runtime touched, no PR/merge in B2.

### Scope for next batches

B2 includes exact owner-local membership, zone name, safe-cell count and region data only. Route/gates, NPC placements and Quest policy remain delegated to B4+ and need independent supplied evidence. The B1 section above remains a historical checkpoint; any earlier `not-recovered` roster statements therein describe **B1**, not the superseding **B2** result.
 
## B4-2 — 93 declared main-city route records and measured door-marker summary

### Scope and provenance

- This batch replaces the previous uncommitted 14-record draft attempt. No entities from that draft are included.
- Main source table: `_DECLARED_YBCS_MAIN_CITY_SCENE_ROUTES` in `ybcs_session_adapter.py`; assignment L242, first row L251, final row L934, close L935. Source class `YbcsOfflineSceneRoute` is L223-L240.
- Source file: 3,274 lines; SHA-256 `d35620d4611c93a6dc190332e5e7003eebc09f2c4b50b607ade3bf597f45b448`. Attribution: **总管本地核实，本会话未重读**.
- The 93 route rows and their source lines come from the owner-provided AST mechanical transcript. This worker independently rebuilt the directed edge set and recomputed graph statistics from that transcript.
- Route-resource helper source: `ybcs_offline_route_resources.py`, 629 lines, SHA-256 `16936a583d5e7f6957bc181659b926ac7e66aa471ac3abe3d0ecdace33963119`; attribution: **总管本地核实，本会话未重读**. `expand_routes_with_installed_portal_cells` starts L87; `align_route_spawns_to_reciprocal_portals` starts L362; minimum reciprocal spawn distance is 8 at L34.
- Movement helper source: `ybcs_map_movement.py`, 424 lines, SHA-256 `27de2a0c39d0a6f9634199726415050a76db7bd362c40298a25a37c1411fef49`; attribution: **总管本地核实，本会话未重读**. Walkable value 1 at L28, `cell_to_screen` L209, `find_offline_route` L246.
- Door-marker source: `ybcs_main_city_door_markers.py`, 207 lines, SHA-256 `309aeaeb55c37da4c0bc451427842569c5b7d16d96eb5fbdd5e4a541059798e`; attribution: **总管本地核实，本会话未重读**. `main_city_door_cells` L191-L197.

### Recomputed graph statistics

| Metric | Worker recomputation | Owner result |
|---|---:|---:|
| Declared route records | 93 | 93 |
| Unique source maps | 50 | 50 |
| Unique target maps | 50 | 50 |
| Unique directed edges | 93 | 93 |
| Reciprocal directed records | 92 | 92 |
| Reciprocal pairs | 46 | 46 |
| Non-reciprocal declarations | 1 | 1 |
| Self loops | 0 | 0 |
| Maximum out-degree | map 1000: 17 | map 1000: 17 |
| Second out-degree | map 1500: 5 | map 1500: 5 |
| Maximum in-degree | map 1000: 18 | map 1000: 18 |

Source and target map sets are identical (50 each). The sole non-reciprocal declaration is row #09, `3001 -> 1000`, source L372. No reverse declaration `1000 -> 3001` appears among the 93 rows. This records a missing reverse declaration only; it does not claim reverse physical movement is impossible.

### Core-six scope

Core maps: 1030 / 1060 / 1070 / 1090 / 1040 / 1045. The 93-row table has 14 records touching this set: 8 with both endpoints inside and 6 crossing to an external map. All 14 have a reciprocal declaration, forming 7 pairs.

The 14 route records are #01, #02, #38, #39, #48, #49, #52, #53, #54, #55, #56, #57, #58, #59. Their full declared approach-cell tuples are stored in `routeRecords` from the owner-provided coordinate schedule. The 14 tuples contain 91 cells in total. For other non-door rows, only the supplied approach-cell count is stored; full coordinate tuples remain `not-recovered` in this batch.

### Declared values vs derived values

- All route `declaredTargetSpawn` values are copied from the 93-row source transcript.
- Only source rows explicitly marked resource-validated (R) are `targetSpawnResourceValidated=true`; absence of R is preserved as false/default.
- `targetSpawnClientValidated=false` and `targetSpawnAtPortal=false` are class defaults, not independent validation claims.
- `expandResourceCells=true` by class default except route #02 (L260), explicitly false. Route #01 (L251) is true.
- `declaredApproachCells` are stored only for the 14 core records. For other ordinary route rows, the supplied count is retained without fabricating coordinates.
- For the 12 route rows that call `door(interior)`, approach cells are derived from `main_city_door_cells(interior)`; this batch records the call and interior ID but does not invent the helper's returned cell tuples.
- No resource expansion pass or reciprocal spawn alignment pass was run. `expandedApproachCells=null` and `alignedTargetSpawn=null` for all records. The declared spawn is not silently replaced by a derived spawn.
- Movement screen transform is not applied to route-cell coordinates. IMF walkability value 1 is a source rule, not a claim that this batch re-ran BFS or checked all map resources.

### Door-marker count correction

The actual measured count, supplied and locally checked by the owner, is:

- **13 tuple records**.
- **12 distinct target interiors**.
- Bank interior `map:old:2400` has **2 facade records**; the other 11 interiors have one each.
- 12 `door(interior)` call sites appear in the main-city route table: rows #12, #14, #16, #18, #20, #23, #25, #27, #29, #30, #32, #34. All are sourced from map 1000 and none touches the six core maps.
- The module docstring says 14; the measured tuple count is 13. The JSON stores `sourceDocstringReportedCount=14` separately and uses **13** as the measured count. The docstring value is not presented as an observed tuple count.
- Individual marker coordinates and tuple-level source lines were not provided in this batch; those fields remain null/`not-recovered`.

### B4-2 record counts

| Category | sourceTotal | coreScopeCount |
|---|---:|---:|
| Physical entry/exit route records | 93 | 14 |
| Bidirectional declared route records | 92 | 14 |
| Non-reciprocal declared route records | 1 | 0 |
| Door-marker tuple records | 13 | 0 |
| Distinct door target interiors | 12 | 0 |

These are overlapping classifications and must not be summed into a single edge count. Offline exploration index, Terry ferry references and story-battle victory returns are deferred to B4-3.

### Evidence and safety

All ybcs-derived route and door data in this batch are `RECOVERED_SECONDARY` and `runtimeVerified=false`. No retail runtime behavior is asserted. No edges are inferred from map-number proximity, visual adjacency or directory grouping. A missing target, if any, must be represented as `targetMapId=null` and `targetStatus=not-recovered`; all 93 supplied route rows have an explicit target.

No gameplay source, `world-catalog.json`, main branch, primary account repository, PR or merge was changed in this batch.

## B4-3 — Offline exploration index, Terry ferry references, and story-battle victory returns

### Scope and source attribution

This batch contains exactly the three approved categories: (1) offline exploration index, (2) two Terry ferry route references, and (3) 26 story-battle victory returns. No main-city route records, door-marker tuples, NPC placements, or Quest policy are added here.

All YBCS-derived entries are `RECOVERED_SECONDARY` and `runtimeVerified=false`. No runtime or retail behavior is asserted.

### Offline exploration index

- Source: `src/legacy_gui_runtime/ybcs_offline_world_catalog.py`, 658 lines, SHA-256 `34b577a0d41be8b4a24e619d73498db3a637c8571ca31d5802370f82ef5c0703`; this source hash was independently re-read and matched earlier in B0.
- Exact source: `GENERAL_ORDINARY_MORA_MAP_IDS` frozenset at L67-L77.
- Count: **49 map IDs**; all 49 resolve to entries in the B2-accepted 108-map catalog. Five are in the six-map core scope: 1030, 1040, 1045, 1060 and 1090. Map 1070 is not included.
- The 49-member set is the ordinary Mora map selection/index policy, not a physical adjacency list, not a route graph, and not the complete 108-map exploration catalog.
- Display names are copied from the B2-accepted `world-catalog.json` (commit `2dd665ab43463c45cc20d20df222c736f05861fb`, Git blob SHA-1 `8d25bee302eb70076cf9e010113ac8b9de2b2fdc`). B2 names retain the attribution **总管本地运行 build_old_offline_world_catalog (extracted/)，本会话未重跑**.
- No edge is inferred from index membership.

### Terry ferry references

- Source: `src/legacy_gui_runtime/ybcs_offline_npc_transport.py`, 93 lines, SHA-256 `ef885b8375dfdbe1696e9f4807906e580f51b0679f8954753da45f11eb9f5e92`; this source hash was independently re-read and matched earlier in B0.
- Entity constants: L15-L17. Two route literals: outbound L50-L56 and return L58-L64.
- Outbound: map 1500 → 1373; NPC entity 21500; NPCScript program 48; arrival `target_spawn=(110,50)`.
- Return: map 1373 → 1500; NPC entity 21373; NPCScript program 49; arrival `target_spawn=(57,121)`.
- The arrival cell is adjacent to the destination Terry; it is not the NPC's world placement cell. Both NPC placement coordinates remain `not-recovered`.
- Existing S4 B6 cross-reference: `s4-ferry-routes-data.json` at commit `d9832eb186d46c971e0dbf853426c76347a948c0`, Git blob SHA-1 `0e379cf471dbf94cc3fc093785a97c04c3e117dc`; corresponding audit Git blob SHA-1 `30fdc6af2dd383ac24d1c79ab4c5572a3e6f3069`. The B6 export also records that this is exactly two route literals, not a complete transport inventory.
- Ferry records touching the six core maps: **0**.

### Story-battle victory returns

- Source: `src/legacy_gui_runtime/ybcs_offline_field_encounters.py`, 5,120 lines, SHA-256 `94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a`; this source hash was independently re-read and matched earlier in B0.
- Exactly **26** explicit `victory_return_map_id` assignments were found. Each exported row preserves its source map-ID line and the adjacent `victory_return_cell` line.
- Core-scope target returns: **5** records: map 1060 (L1778), 1090 (L1830), 1030 (L1938), and map 1040 twice (L2003, L2054). No return targets 1045 or 1070.
- All 26 source records include a literal return cell. These are source literals only; this batch did not re-run walkability or movement validation.
- Four records do not explicitly declare `server_driven_story_trigger` (L1869, L2595, L2773, L2819); the JSON records this as not explicitly declared and does not infer false.
- Story return cells are not converted into ordinary route edges.

### B4-3 counts

| Category | sourceTotal | coreScopeCount |
|---|---:|---:|
| Offline exploration index | 49 | 5 |
| Terry ferry references | 2 | 0 |
| Story-battle victory returns | 26 | 5 |

Core-scope counts use index map membership for the index, either endpoint for ferry routes, and return target map for story victories. Categories are independent and are not summed into a single route count.

### Validation and boundaries

- Offline index entries: **49**, unique map IDs: **49**, all present in the B2 108-map catalog.
- Ferry route references: **2**, exact directions and arrival cells preserved.
- Story victory returns: **26**, all have an explicit map ID and return cell.
- Every B4-3 record carries `RECOVERED_SECONDARY` and `runtimeVerified=false`.
- Missing ferry NPC placement remains `null/not-recovered`.
- No coordinates are invented; no adjacency or route edges are inferred from index membership or victory return cells.
- No original client was run; no main-city route JSON, world catalog JSON, gameplay code, PR or main branch was changed.

## B4-4 — Cross-batch audit and consistency verdict

### Audit scope and baseline

- This is a cross-batch audit only. No new source-data extraction was performed.
- Audited snapshots: B2 world catalog, B4-2 route/gate markers, and B4-3 offline-index/ferry/story-return data, all read at branch commit `7626731354459556cbaf6920da292019dc59e1da`.
- Branch: `data/ch1-world-catalog`; parent checkpoint: B4-3 commit `7626731354459556cbaf6920da292019dc59e1da`.
- No accepted JSON file was edited as part of this audit. Only this audit document receives the B4-4 section.

### Cross-batch count reconciliation

| Dataset / measure | B2 / B4-2 / B4-3 value | Cross-check |
|---|---:|---|
| Installed map resources | 111 | pass |
| Explorable world-catalog members | 108 | pass |
| Quarantined maps | 3 (453, 498, 499) | pass |
| Region groups | 8 | pass |
| Regional members | 107 | pass |
| Root page | map 1000, 1 | pass |
| Main-city declared route records | 93 | pass |
| Unique route source / target maps | 50 / 50 | pass |
| Reciprocal route records / pairs | 92 / 46 | pass |
| Sole non-reciprocal declaration | 3001 -> 1000 | pass |
| Route self-loops | 0 | pass |
| Door-marker tuple records | 13 | pass |
| Distinct door target interiors | 12 | pass |
| Ordinary Mora offline-index members | 49 | pass |
| Terry ferry route references | 2 | pass |
| Story-battle victory-return assignments | 26 | pass |

B2 region counts are story-west 18, story-east 11, arena-event 14, mainland-south 17, mainland-north 12, islands-west 12, islands-east 8, and city-services 15. Their sum is 107; adding the separate root page 1000 yields 108. The three quarantined map wires are excluded from those 108 members.

### World-catalog cross-references

- All 93 route source and target map IDs resolve to the B2 108-member catalog. The set of route map IDs contains 50 unique IDs; no dangling route map reference was found.
- All 93 route source/target display names match the B2 world-catalog zone names; name mismatches: **0**.
- All 12 door target interior IDs resolve to world-catalog members. The 12 door-call target IDs and the 12 interior-summary IDs are the same set.
- All 49 offline-index IDs resolve to world-catalog members. The B4-3 index ID set is exactly equal to B2's GENERAL_ORDINARY_MORA_MAP_IDS set: no missing IDs, extra IDs, or duplicates.
- Offline-index core-scope count is 5: 1030, 1040, 1045, 1060, 1090. Map 1070 is correctly absent.
- All 26 story-return target maps resolve to world-catalog members; return-map display names match B2 zone names; name mismatches: **0**.
- All ferry source and target maps resolve to world-catalog members. The two routes are 1500 -> 1373 and 1373 -> 1500; neither endpoint is in the six-map core scope.

### Route graph and core-six reconciliation

- B4-1's independently recomputed 93-row graph result is consistent with the persisted B4-2 JSON: 50 unique source maps, 50 unique target maps, 92 reciprocal directed records forming 46 pairs, one non-reciprocal declaration, and zero self-loops.
- The only non-reciprocal declaration is route row #09, map 3001 -> map 1000. This means the reverse declaration is absent from this table; it does not assert that reverse physical movement is impossible.
- Degree checks remain: map 1000 out-degree 17 / in-degree 18; map 1500 out-degree 5 / in-degree 5; map 1020 out-degree 4 / in-degree 4; maps 1010, 1040, 1050, 1060 and 1341 each out-degree 3 / in-degree 3.
- The six-map core remains 1030, 1060, 1070, 1090, 1040 and 1045. Exactly 14 main-city route records touch this set: 8 have both endpoints inside and 6 cross its boundary. All 14 have reciprocal declarations and form 7 pairs.
- The 49-entry ordinary Mora index, two NPC ferry references, and 26 story victory returns are separate evidence categories. They are not silently added as edges to the 93-row main-city route graph.

### Door-marker count reconciliation

- The measured source tuple count is **13 records**, with **12 distinct target interiors**.
- There are **12** main-city route-table door() call sites, all sourced from map 1000; they cover the same 12 target interiors.
- Interior 2400 (bank) has two facade records; the other 11 interiors have one each. The 12 interior summary facade counts sum to 13.
- The source module docstring says 14. This is a documented source-docstring-versus-measured-tuple discrepancy, not the measured result. Persisted measured values remain 13 records / 12 interiors; 14 is retained only as the docstring-reported value.
- The 13 tuple records are represented by 12 interior aggregate summaries with facade counts; individual marker-cell coordinate tuples were not supplied and remain not-recovered. No coordinates are invented.

### B4-3 category reconciliation

| Category | sourceTotal | coreScopeCount | Cross-check |
|---|---:|---:|---|
| Offline exploration index | 49 | 5 | exact set match with B2 |
| Terry ferry references | 2 | 0 | exact two S4 B6 route literals |
| Story-battle victory returns | 26 | 5 | all 26 map/cell literals represented |

- The five core-scope story-return records target four distinct maps: 1060, 1090, 1030 and 1040 (1040 occurs twice).
- The 26 story-return rows preserve 22 explicit `server_driven_story_trigger=true` values and 4 records where that field is not explicitly declared. The four omissions are not rewritten as false.
- Ferry arrival cells are destination-adjacent arrival spawns, not NPC placement coordinates. Both ferry NPC placement coordinates remain not-recovered.
- Story victory-return cells remain source literals; B4-3 did not claim a fresh walkability validation.

### Evidence-level and safety consistency

- Recursive audit of the three JSON datasets found **709 objects carrying evidence/runtime fields**. All 709 use exactly `evidenceLevel=RECOVERED_SECONDARY` and `runtimeVerified=false`; no positive higher evidence label or runtime-verified claim was found.
- The source attribution distinction is preserved: source hashes and excerpts marked owner-local remain attributed as owner-local; this worker does not claim to have re-read those local-only sources.
- The B1 55-candidate / partial-roster state is historical. B2 explicitly superseded it with the owner-local 108-member builder roster. It is not a current catalog-count conflict.
- The 14 value in the door-marker source docstring is historical source wording; the accepted measured count is 13 tuple records / 12 interiors.
- Missing dimensions remain explicit rather than fabricated: per-map resource hashes and spawn/component metrics; expanded approach cells and aligned route spawns; door marker coordinates; ferry NPC placement; independent walkability rechecks; and server responses.
- All 93 declared main-city route records have explicit targets. The null/not-recovered target representation is therefore not needed for these 93 records; no missing target is fabricated.
- No map-number proximity, visual adjacency, region grouping, ordinary-index membership, ferry arrival, or story-return cell is converted into an inferred physical adjacency edge.

### B4-4 findings

- Cross-batch blocking inconsistencies: **0**.
- Dangling map references: **0**.
- Route/map-name mismatches: **0**.
- Offline-index set mismatches: **0**.
- Story-return map/name/cell mismatches: **0**.
- Door target-set mismatches: **0**.
- Evidence/runtime-field exceptions: **0**.
- Known documented discrepancy: source door-marker docstring says 14 while the measured tuple count is 13; accepted JSON and B4-2 audit correctly use 13 records / 12 interiors.

### B4-4 verdict and repository boundary

B4-1, B4-2 and B4-3 are mutually consistent within their declared scopes. No accepted JSON correction is indicated by this audit. B4-4 is audit-only: no new data extraction, no JSON edits, no gameplay-code edits, no main-branch changes, no primary-account repository changes, no PR creation and no merge. B5 is not started.

All YBCS-derived evidence remains `RECOVERED_SECONDARY`; all runtime flags remain `false`.

## B5-A / B5-B — NPC placement candidates and cross-validation

### Scope, source integrity and provenance

- Scope: only B5-A candidate extraction and B5-B static cross-validation. No B6 work, PR, merge, gameplay-code integration or runtime deployment.
- Source attachment: `ybcs_offline_npc_placements.py`, 613 lines.
- SHA-256 verified against the supplied digest: `16c76bd6b0335ab679a8c2c35192c3ee0b76974b8348a1e18f2031c8720478a1`.
- AST extraction: 29 `YbcsOfflineNpcPlacement` rows, 23 distinct `map_id` values, 24 rows with `npc_program_index`, and 11 rows with `quest_semantic`.
- **Provenance is offline-policy.** The source module docstring says no retail server placement table was recovered. Names, exact cells and service roles are explicit single-player policy, not retail identity or recovered retail placement.
- Every JSON record uses `provenance=offline-policy`, `evidenceLevel=RECOVERED_SECONDARY`, and `runtimeVerified=false`. No record is marked VERIFIED.
- The source module says these are transient session outputs and must not be copied into `GameDomain` saves or updated as followers.

### B5-A — Record inventory

- Output: `data/ch1-world-catalog/npc-placement-candidates.json`.
- Policy: `data/ch1-world-catalog/npc-placement-policy.ts`.
- Human-readable provenance and inventory: `data/ch1-world-catalog/npc-placements.md`.
- All source fields are preserved: `map_id`, `entity_id`, `name`, `model_id`, `first`, `second`, `role`, `dialog_text`, `quest_semantic`, `npc_program_index`. Absent optional source fields remain explicit `null`.
- Coordinate convention is sourced from `entity_record()` at `ybcs_offline_npc_placements.py:L120-L134`: `first=x`, `second=y`.
- Symbolic entity/model/semantic constants are retained with their defining source-line references. Ferry entity constants are resolved from `ybcs_offline_npc_transport.py:L16-L17`; no IDs are guessed.
- Exact map mapping rule: parse the four-digit suffix from `map:old:NNNN`, then require both `mapCandidates.mapWire === NNNN` and `mapCandidates.mapId === original map_id`. No fuzzy mapping.

| Source lines | map_id | entity_id | cell (first, second) | role | program | quest_semantic |
|---|---|---:|---|---|---:|---|
| L186 | map:old:1000 | 21000 | (30, 32) | guard | 22 | — |
| L187-L198 | map:old:1000 | 21001 | (65, 165) | trainer | 23 | quest0-step7-training-candidate |
| L199 | map:old:1000 | 21002 | (50, 76) | warehouse | 17 | — |
| L208-L217 | map:old:1000 | 21003 | (32, 72) | quest1-companion-giver | — | quest1-actor100-companion-recruitment |
| L224-L233 | map:old:1030 | 21103 | (76, 28) | story1-gate-soldier | — | — |
| L238-L250 | map:old:2450 | 21245 | (23, 29) | smith-interior | 12 | quest4-smith5003-actor102-companion-recruitment |
| L254 | map:old:2200 | 21220 | (17, 23) | accessory-interior | 11 | — |
| L258-L273 | map:old:2300 | 21230 | (34, 34) | articles-interior | 15 | quest9-merchant5018-single-holy-medicine-offer |
| L285-L295 | map:old:2300 | 21231 | (14, 30) | pet-onboarding-interior | 47 | program47-spick-pet-onboarding |
| L300-L314 | map:old:2400 | 21240 | (20, 30) | bank-interior | 18 | quest3-bill-actor107-companion-recruitment |
| L333 | map:old:2550 | 21255 | (28, 26) | guild-interior | 19 | — |
| L336 | map:old:2950 | 21295 | (14, 22) | gift-shop-interior | 34 | — |
| L340-L353 | map:old:2000 | 21200 | (28, 26) | weapon-interior | 13 | quest2-davis-actor101-companion-recruitment |
| L356 | map:old:2800 | 21280 | (21, 21) | magic-interior | 16 | — |
| L361-L373 | map:old:2800 | 21281 | (14, 30) | quest5-companion-giver | — | quest5-lian5014-actor103-companion-recruitment |
| L378-L388 | map:old:2900 | 21290 | (19, 35) | mercenary-interior | 21 | quest7-dragon-soldier5019-actor104-companion-recruitment |
| L400 | map:old:2100 | 21210 | (20, 26) | defense-interior | 14 | — |
| L401 | map:old:1501 | 21501 | (32, 52) | sandgent-weapon-interior | 30 | — |
| L402 | map:old:1502 | 21502 | (20, 46) | sandgent-smith-interior | 32 | — |
| L403 | map:old:1503 | 21503 | (20, 46) | sandgent-consumables-interior | 31 | — |
| L404 | map:old:1504 | 21504 | (20, 46) | sandgent-hotel-interior | 28 | — |
| L405-L419 | map:old:2600 | 21260 | (35, 95) | shrine-interior | 20 | quest6-priest5008-actor105-companion-recruitment |
| L420 | map:old:3002 | 21302 | (30, 34) | event-interior | 33 | — |
| L421 | map:old:3000 | 21300 | (9, 21) | gift-shop | 34 | — |
| L422 | map:old:3001 | 21301 | (13, 23) | room-guide | — | — |
| L423 | map:old:1040 | 21104 | (50, 166) | road-guard | 22 | — |
| L434-L443 | map:old:1040 | 21106 | (67, 153) | quest8-wounded-archer | — | quest8-wounded-archer106-companion-recruitment |
| L448-L457 | map:old:1500 | 21500 | (57, 123) | ferry-port | 48 | — |
| L458-L467 | map:old:1373 | 21373 | (111, 49) | ferry-island | 49 | — |

### B5-B — Three cross-validations

#### 1. NPCScript program-number correspondence — PASS

- Reference: `docs/integration-notes/s4-npc-services-data.json` at the B5 base commit.
- The S4 service directory contains 39 programs, numbered 11–49.
- 24/24 candidate rows with a non-null `npc_program_index` match a program number in that directory; unmatched program indices: **0**.
- Five candidate rows have no `npc_program_index` in the source; they remain null / not-declared-in-source.
- The program index is only a service-program reference. It is not converted to an entity ID or coordinate, and the service directory is not used as placement evidence.
- The 11 `quest_semantic` values remain source strings; no automatic join to Quest actor tokens or NPCScript program numbers is inferred.

#### 2. B2 108-map membership — PASS

- Reference: `data/ch1-world-catalog/world-catalog.json` at the B5 base commit.
- 29/29 candidate rows map to B2; all 23 distinct source map IDs are present in the 108-member catalog.
- Unmapped / `not-recovered` map IDs: **none**.
- No map proximity, region grouping or name similarity was used as a fallback.

#### 3. 93-route / door-marker coordinate conflict — PARTIAL, WITH EXPLICIT EVIDENCE GAPS

- Reference: `data/ch1-world-catalog/route-gate-markers.json` at the B5 base commit.
- All 93 declared route target-spawn coordinates were compared against candidate cells: **0 exact coordinate collisions**.
- B4-2 provides declared approach coordinates for 14 route records (91 cells); those supplied cells were compared against candidate cells: **0 exact coordinate collisions**.
- The other 79 route records have no approach coordinates in B4-2. Expanded approach cells and aligned target spawns were not run in B4-2; neither is invented here.
- B4-2's measured door-marker data contains 13 tuple records across 12 distinct target interiors. Its marker-cell coordinates are explicitly `null` / `not-provided-in-this-batch`.
- The door-marker source map is `map:old:1000`. Four NPC candidates are on that map (entity IDs 21000, 21001, 21002 and 21003); their exact collision against the 13 marker coordinate sets is **not-recovered**.
- All 12 door target interiors have at least one NPC candidate (14 candidate rows in total across those interiors). This is only a map-reference check and does not prove spatial separation from door cells.
- Therefore the overall geometry check is **PARTIAL / NOT_RECOVERED**, not a global no-conflict pass.

### B5 verdict and boundary

- Candidate extraction: **29 rows / 23 maps**.
- Program correspondence: **24/24 pass**.
- Map membership: **29/29 pass**.
- Route coordinate comparison: **0 collisions among supplied route coordinates**.
- Door marker coordinate comparison and 79 route approach geometries: **not-recovered** because B4-2 does not supply those coordinates.
- No retail placement identity is claimed; all evidence remains `RECOVERED_SECONDARY`, all runtime flags remain `false`.
- B5-A/B5-B only. No B6, no PR, no merge, no changes to the primary repository, and no runtime/gameplay integration.
