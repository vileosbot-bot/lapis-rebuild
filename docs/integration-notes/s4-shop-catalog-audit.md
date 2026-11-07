# S4 Shop Catalog Export Audit (B4)

## Scope

B4 only. This export preserves the complete parsed `Set.lib::itemtbl.atr` item rows and separately records YBCS offline shop projections. It does not implement purchases, sales, inventory mutation, or retail-server behavior.

## Source verification

- `Set.lib` bytes: **112,730**
- `Set.lib` SHA-256: `ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe`
- Archive directory check: `0xe8356ab8`
- Archive members: **12**
- `itemtbl.atr` unpacked bytes: **339,967**
- `itemtbl.atr` SHA-256: `cf5c9786810b80619ae3133ad77a27d9fb51f2078c30c947c482483d1030eb2e`
- `itemtbl.atr` physical lines: **2,075**
- Header lines: **1** (line 1)
- Data rows: **2,073**
- Trailer/comment lines after header: **1** (`;999` at line 2075)
- Encoding used for text fields: `gb18030`

### Set.lib member inventory

| Member | Unpacked bytes | Member SHA-256 |
|---|---:|---|
| `ability.atr` | 109,656 | `0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b` |
| `itemtbl.atr` | 339,967 | `cf5c9786810b80619ae3133ad77a27d9fb51f2078c30c947c482483d1030eb2e` |
| `levelabl.atr` | 70,666 | `0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc` |
| `magicatr.atr` | 383 | `dde12fc5e96359b6dc23dbc360672c08aad6d328fd25402a1dc27033fdb191c1` |
| `Magicptn.atr` | 18,664 | `5affdd750873e7ccb5a364cc372870b98cde95df905140fa88aedd79155cfceb` |
| `Magictbl.atr` | 32,338 | `d885bbd1bddffd3d4bf05b2b4e36232c62d94fc78209d46861b01986779ef0d9` |
| `solskill.atr` | 4,282 | `43ad7f975336e7c105d7eda7a48fe8afcee109ce81b618ca83ef7ce812fe1a41` |
| `SysHelp.atr` | 1,074 | `bfba64b0e68cef567895eb69989ee94f5120dbd10e1fc2f0fcb33cc26c81d240` |
| `tileattb.atr` | 2,566 | `e0c90bf8132223af6fa908906487e2c20a5fdacd39df9c4f8be83e16daf7fd01` |
| `tileattr.atr` | 2,537 | `fbdd1cf08e80c581d68c182ca1f28d9850fb63e05e25954ae02e2332b8a70dc9` |
| `Effectptn.atr` | 1,567 | `a2dbac61fb4d2d2b8f08be16a4ddaa1138f6742f81cb91bee6174cd9eb3d6c44` |
| `zone_name.txt` | 4,099 | `02541808ee6860c1fea4d7ca8cb31d1b0dfe326a3712e95eadbb3218370fa9dd` |

## Item row validation

- Parsed item rows: **2,073**
- Unique `itemResourceId`: **2,073 / 2,073**
- Duplicate IDs: **0**
- Malformed rows: **0**
- All rows contain exactly 53 numeric columns: **yes**
- All rows contain 55 tab fields (53 numeric + name + description): **yes**
- ID range: **1–6805**
- Price source: `numericColumns[17]` (zero-based index retained exactly as the supplied shop parser reads it)
- Zero-price rows: **47**
- Negative-price rows: **0**
- Maximum price: **5,000,000**

### Raw shop number distribution

| shopNumber | raw item rows |
|---:|---:|
| 0 | 36 |
| 1 | 602 |
| 2 | 1200 |
| 3 | 103 |
| 4 | 128 |
| 5 | 4 |

## YBCS offline program-to-shop mapping

The supplied module explicitly says this mapping is an offline policy, not a recovered retail placement row. It is therefore exported separately from itemtbl records and every mapping has `retailMappingClaimed=false`.

| NPC program index | Offline shop number | Raw itemtbl candidate rows |
|---:|---:|---:|
| 11 | 4 | 128 |
| 13 | 1 | 602 |
| 14 | 2 | 1200 |
| 15 | 3 | 103 |
| 16 | 4 | 128 |
| 29 | 2 | 1200 |
| 30 | 1 | 602 |
| 31 | 3 | 103 |
| 34 | 5 | 4 |
| 46 | 3 | 103 |

Mapping source: `ybcs_single_player_shop.py`, `OFFLINE_PROGRAM_SHOP_NUMBERS`, lines 180–190, SHA-256 `b2feff867dc4b3df7fbf21cc88004842d8c67ef38edf94add34be518e409aa29`.

## Offline rules kept separate from raw item facts

- Native/offline catalog limit: 120 rows.
- Offline client inventory limit: 28 rows.
- Base offline projection filters by itemtbl shop-number column and non-negative price, then applies the catalog limit.
- Offline finite-stock policy is enabled; sold rows do not restock the active catalog.
- Offline purchase price reads `itemtbl.atr` numeric column index 17 and applies unit price times selected quantity.
- The module describes half-price sales for a pinned compatibility set and exact inventory-row matching. The exact set comes from `ybcs_shop_sale_compatibility.py`, which was not supplied in this B4 input. Accordingly `eligibleItemIds` is `null`; no eligible IDs are inferred.
- Counted purchase constants include programs 15/31, limit 30, equip positions 7/9/10/11/13/14 and special item ID 4116.
- **Source inconsistency preserved:** `build_offline_shop_audit()` separately emits literal counted IDs 4001–4010 at line 1326, which conflicts with the runtime constants above. The export records both declarations separately and does not reconcile them.
- Program 46 pet shop, special shop-3 rows, stateful item rows, gift rows, and accessory filtering remain explicitly YBCS offline policy declarations.

## Provenance and evidence boundary

Every item row includes `sourceProject`, `sourceArtifact`, `sourceMember`, `sourceHash`, `sourceMemberHash`, `sourceRecord.lineNumber`, `sourceRecord.rawLineSha256`, `evidenceLevel=RECOVERED_SECONDARY`, `evidenceLabel=重构参考`, and `runtimeVerified=false`.

Every mapping and offline policy declaration separately points to `ybcs_single_player_shop.py` with source hash and source line range/line number, also `RECOVERED_SECONDARY / 重构参考` and `runtimeVerified=false`.

## Limitations

1. The 10 NPC-program mappings are YBCS offline projections, not original retail mappings.
2. The exact half-price compatibility item IDs cannot be exported without `ybcs_shop_sale_compatibility.py`.
3. The full shop module imports additional runtime dependencies not supplied in this B4 input. This export therefore uses its static source declarations and the same itemtbl column extraction rules, rather than claiming the complete offline transaction service was executed.
4. Raw itemtbl row counts by shop number are candidate counts, not final NPC-specific catalogs; program-specific filters and appended rows remain separate policy.
5. No NPC placement, map reachability, retail purchase behavior, sale ratio, currency semantics, or server response is promoted to VERIFIED.

## Repository hygiene

Only the JSON export, TypeScript policy, and this audit document are intended for GitHub. `Set.lib`, extracted `itemtbl.atr`, other extracted members, and original source modules are not included.

All exported facts use `RECOVERED_SECONDARY` / `重构参考`; `runtimeVerified` remains false.
