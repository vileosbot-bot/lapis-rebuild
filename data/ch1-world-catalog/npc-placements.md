# B5 — NPC placement candidates

## Source identity and provenance

- Repository: `vileosbot-bot/lapis-rebuild`
- Branch: `data/ch1-world-catalog`
- Source: `ybcs_offline_npc_placements.py` (613 lines)
- SHA-256: `16c76bd6b0335ab679a8c2c35192c3ee0b76974b8348a1e18f2031c8720478a1`
- Extracted records: **29**
- Distinct map IDs: **23**
- Rows with `npc_program_index`: **24**
- Rows with `quest_semantic`: **11**
- Evidence level: **RECOVERED_SECONDARY**
- `runtimeVerified`: **false**

**Mandatory provenance statement:** the source module docstring explicitly says no retail server placement table was recovered. These names, exact map cells and service roles are explicit single-player `offline-policy`; they are not retail NPC identity or recovered retail placement. All 29 JSON records carry `provenance="offline-policy"`, `evidenceLevel="RECOVERED_SECONDARY"`, and `runtimeVerified=false`.

The source also describes these rows as transient session output. They must not be copied into a player's `GameDomain` save or updated as followers.

## Mapping and coordinate semantics

- Map mapping is exact: `map:old:NNNN` → numeric suffix `NNNN` → B2 `mapCandidates.mapWire`, requiring the B2 `mapId` to equal the original source string. No fuzzy mapping is used.
- All 23 distinct source map IDs match the B2 108-map catalog.
- Source coordinate fields are retained unchanged: `first=x`, `second=y`. The source locator is `ybcs_offline_npc_placements.py:L120-L134`, where `entity_record()` assigns `x=self.first` and `y=self.second`.
- `npc_program_index` is a reference to an NPCScript service program only. It is not an entity ID, coordinate, or independent placement source.
- `quest_semantic` is retained as a source-declared semantic string. No automatic Quest actor, entity, or NPCScript association is inferred from it.

## B5-B cross-validation

| Check | Result | Detail |
|---|---|---|
| B2 map membership | PASS | 29/29 rows; 23/23 distinct map IDs; 108-map catalog |
| NPCScript program directory | PASS | 24/24 program references match the 39-program directory, indices 11–49 |
| Route / gate geometry | PARTIAL — NOT RECOVERED | 0 collisions among supplied route coordinates; door marker coordinates and 79 route approach sets are not supplied |

### Route and gate evidence boundary

- B4-2 contains 93 route records and 93 declared target-spawn coordinates. None of the 29 NPC candidate cells collides with a declared target spawn.
- B4-2 provides declared approach coordinates for 14 route records (91 cells). None of the 29 candidate cells collides with those supplied approach cells.
- The remaining 79 route records have `declaredApproachCellsStatus="not-provided-in-this-batch"`. Expanded approach cells and aligned target spawns were not run in B4-2.
- B4-2 measures 13 door-marker tuple records across 12 distinct target interiors, but marker-cell coordinates are `null` / `not-provided-in-this-batch`. Four candidates are on the marker source map `map:old:1000`; their exact geometric collision against door-marker cells is therefore **not-recovered**, not passed.
- All 12 door target interiors have at least one candidate (14 candidate rows across those interiors). This is a map-level reference check only, not a marker-coordinate check.

## Candidate inventory

| Source lines | map_id | entity_id | name | first/x | second/y | role | npc_program_index | quest_semantic |
|---|---|---:|---|---:|---:|---|---:|---|
| L186 | `map:old:1000` | 21000 | 城門守衛 | 30 | 32 | `guard` | 22 | — |
| L187-L198 | `map:old:1000` | 21001 | 訓練教官 | 65 | 165 | `trainer` | 23 | quest0-step7-training-candidate |
| L199 | `map:old:1000` | 21002 | 倉庫管理員 | 50 | 76 | `warehouse` | 17 | — |
| L208-L217 | `map:old:1000` | 21003 | 吉奥老师 | 32 | 72 | `quest1-companion-giver` | — | quest1-actor100-companion-recruitment |
| L224-L233 | `map:old:1030` | 21103 | 兵士A | 76 | 28 | `story1-gate-soldier` | — | — |
| L238-L250 | `map:old:2450` | 21245 | 鍛造師 | 23 | 29 | `smith-interior` | 12 | quest4-smith5003-actor102-companion-recruitment |
| L254 | `map:old:2200` | 21220 | 飾品商 | 17 | 23 | `accessory-interior` | 11 | — |
| L258-L273 | `map:old:2300` | 21230 | 道具商 | 34 | 34 | `articles-interior` | 15 | quest9-merchant5018-single-holy-medicine-offer |
| L285-L295 | `map:old:2300` | 21231 | 斯皮克 | 14 | 30 | `pet-onboarding-interior` | 47 | program47-spick-pet-onboarding |
| L300-L314 | `map:old:2400` | 21240 | 銀行員 | 20 | 30 | `bank-interior` | 18 | quest3-bill-actor107-companion-recruitment |
| L333 | `map:old:2550` | 21255 | 工會管理員 | 28 | 26 | `guild-interior` | 19 | — |
| L336 | `map:old:2950` | 21295 | 礼品屋店员 | 14 | 22 | `gift-shop-interior` | 34 | — |
| L340-L353 | `map:old:2000` | 21200 | 武器店主 | 28 | 26 | `weapon-interior` | 13 | quest2-davis-actor101-companion-recruitment |
| L356 | `map:old:2800` | 21280 | 魔法導師 | 21 | 21 | `magic-interior` | 16 | — |
| L361-L373 | `map:old:2800` | 21281 | 利安 | 14 | 30 | `quest5-companion-giver` | — | quest5-lian5014-actor103-companion-recruitment |
| L378-L388 | `map:old:2900` | 21290 | 龍兵介紹員 | 19 | 35 | `mercenary-interior` | 21 | quest7-dragon-soldier5019-actor104-companion-recruitment |
| L400 | `map:old:2100` | 21210 | 防具商 | 20 | 26 | `defense-interior` | 14 | — |
| L401 | `map:old:1501` | 21501 | 沙君特武器商 | 32 | 52 | `sandgent-weapon-interior` | 30 | — |
| L402 | `map:old:1502` | 21502 | 沙君特铁匠 | 20 | 46 | `sandgent-smith-interior` | 32 | — |
| L403 | `map:old:1503` | 21503 | 沙君特消耗品商 | 20 | 46 | `sandgent-consumables-interior` | 31 | — |
| L404 | `map:old:1504` | 21504 | 沙君特龙兵介绍员 | 20 | 46 | `sandgent-hotel-interior` | 28 | — |
| L405-L419 | `map:old:2600` | 21260 | 神殿祭司 | 35 | 95 | `shrine-interior` | 20 | quest6-priest5008-actor105-companion-recruitment |
| L420 | `map:old:3002` | 21302 | 活動嚮導 | 30 | 34 | `event-interior` | 33 | — |
| L421 | `map:old:3000` | 21300 | 禮品屋店員 | 9 | 21 | `gift-shop` | 34 | — |
| L422 | `map:old:3001` | 21301 | 房間管理員 | 13 | 23 | `room-guide` | — | — |
| L423 | `map:old:1040` | 21104 | 北路守衛 | 50 | 166 | `road-guard` | 22 | — |
| L434-L443 | `map:old:1040` | 21106 | 受伤的弓箭兵 | 67 | 153 | `quest8-wounded-archer` | — | quest8-wounded-archer106-companion-recruitment |
| L448-L457 | `map:old:1500` | 21500 | 特里 | 57 | 123 | `ferry-port` | 48 | — |
| L458-L467 | `map:old:1373` | 21373 | 特里 | 111 | 49 | `ferry-island` | 49 | — |

The complete source fields, including `dialog_text`, explicit nulls, resolved constant references, source line ranges, map-wire mappings, provenance and validation status, are preserved in `npc-placement-candidates.json`.
