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
