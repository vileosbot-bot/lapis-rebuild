# S3 Source Inventory and Batch 0 Dependency Closure

- Request: `auto-4-1`
- Batch: `Batch 0 — source inventory / dependency closure only`
- Evidence rule: all YBCS material in this document is `RECOVERED_SECONDARY` (reconstruction reference), never `VERIFIED`.
- Scope: source inventory, dependency graph, authored-field mapping draft, archive/member/parser inventory, and the elemental-percent implementation.
- Explicit exclusions: no .lib/.atr binary is copied; no S19 code or tuning is changed; no formula cross-calculation or record-level .atr audit is performed in Batch 0.

## 1. Source inventory

### 1.1 YBCS formula and directly attached support sources

All paths below are package-relative to `legacy_gui_runtime/`. The line ranges refer to the supplied source attachments.

| Source | Lines | Role and inspected entrypoints |
|---|---:|---|
| `ybcs_physical_combat.py` | 500 | Physical formula source. `OldAbilityPhysicalProfile` (70–79), `OfflinePhysicalCombatProfile` (82–112), `parse_old_ability_physical_profiles` (155–202), `ability_physical_profile` (218–248), `build_character_physical_profile` (251–380), `resolve_offline_physical_damage` (382–406), `offline_physical_hit_chance` (410–430), `offline_physical_critical_chance` (433–439), `resolve_offline_physical_action` (441–479). |
| `ybcs_magic_combat.py` | 501 | Direct magic formula source. `OldAbilityMagicProfile` (89–98), `OfflineMagicCombatProfile` (100–128), `parse_old_ability_magic_profiles` (169–214), `ability_magic_profile` (230–250), `build_character_magic_profile` (253–339), `is_direct_offensive_magic` (342–364), `is_recovery_magic` (367–382), `resolve_offline_magic_recovery` (412–439), `resolve_offline_direct_magic_damage` (442–481). |
| `game_domain.py` | 698 | Neutral domain model. `ProgressionState.attribute_words` (433–495), `GameDomain` and validation/serialization (497–591), equipment's seven slots (308–350). Carries inputs; it does not implement damage arithmetic. |
| `ybcs_old_magic_attribute.py` | 291 | Element table parser and percent policy. Attribute names/join IDs (26–78), table parser/loader (192–254), `apply_old_magic_attribute_percent` (257–275). |
| `ybcs_character_stats.py` | 256 | Legacy stat-code mapping and world vitals. Old stat codes and per-point policy (173–195); derived HP/MP handling (204–233). Imports old battle-growth policy at module initialization. |
| `ybcs_equipment_enhancement.py` | 223 | Packed enhancement decode and offline bonus composition. Category mapping (44–68), packed-word decode (91–108), per-record bonuses (111–134), character equipment aggregation (137–166). |
| `ybcs_battle_profiles.py` | 293 | Old Ability tactical profile and equipment eligibility. Ability parser/loader (94–173), `equipped_item_is_usable` (197–213). Also supplies the profession selector used by equipment checks. |
| `ybcs_battle_authority.py` | 1129 | Old magic definition data model/parser/loader. `OldMagicDefinition` (71–121), Magictbl parser and first-match lookup (142–220), `load_old_magic_definitions` (210–220). Its battle commit validates requests and MP cost; it explicitly does not apply HP/damage (926–972). |
| `ybcs_progression_magic.py` | 617 | Generic archive-member reader and progression/magic table inventory. Referenced Set.lib table names (48–55), `read_set_members` (219–247), table summary and associations (260–427). Imports archive functions from `ybcs_quest_runtime`. |

YBCS formula code and every YBCS support source above retain the same evidence level: `RECOVERED_SECONDARY`. The code's explicit offline-policy identifiers and comments are retained as implementation descriptions, not retail-server proof.

### 1.2 Lapis S19 sources and verified immediate data dependencies

| Repository path | Lines | Role |
|---|---:|---|
| `web/src/combat/reconstruction-combat-balance.ts` | 543 | S19 reconstruction policy: `CombatantStats` and profile types (7–96), tuning schema and constants (139–281), skill policy (283–289), player/enemy stat builders (354–423), hit/critical/damage/periodic/attack resolvers (437–518). |
| `web/src/combat/combat-balance-simulator.ts` | 230 | S19 full-combat simulator and seeded RNG (61–69, 104–202); calls the reconstruction balance resolver rather than defining a second damage formula. |
| `web/src/content/classes/class-catalog.ts` | 64 | Builds `CLASS_CATALOG`; `playableClassById` (39–45). Imports class JSON, class helpers, family definitions, stage IDs, and skill catalog. |
| `web/src/content/skills/skill-catalog.ts` | 116 | Builds `SKILL_CATALOG`; authored row mapping (50–94), `skillById` (106–110). Explicitly says EA/EB/EC are preserved authored fields and are not promoted to a universal formula (4–8). |
| `web/src/content/content-types.ts` | 116 | Defines `AuthoredClassStats` (12–20), `PlayableSkillDefinition` (34–86), and `PlayableClassDefinition` (96–110). |
| `web/src/content/classes/class-helpers.ts` | 112 | Maps class JSON fields into `baseAuthoredStats`: `authoredStats` (72–78), `buildPlayableClass` (99–110). |
| `web/src/content/classes/equipment-compatibility.ts` | 40 | S19 family equipment compatibility; imports `data/items/training-catalog.json`. This is a class-catalog load dependency, not a damage formula. |
| `web/src/content/classes/swordsman.ts`, `wizard.ts` | 10 each | Construct the initial playable class definitions from the corresponding class JSON. |
| `web/src/classes/swordsman-ten-stage.ts`, `wizard-ten-stage.ts` | 431 / 349 | Supply staged class ID lists and available-skill functions consumed by `class-catalog.ts`. They also import progression/battle-profile modules; those imports are outside the arithmetic itself. |
| `data/classes/swordsman.json`, `data/classes/wizard.json` | 13 each | Authored class rows; fields include `class_id`, `hp`, `mp`, `hit`, `magic_hit`, movement/range and stage-entry skill. |
| `data/skills/mvp.json` | 9 | Authored skill rows; fields include `skill_id`, `attack_type`, `effect_a/b/c`, MP, timing, masks, tick, iteration and pattern reference. |
| `data/items/training-catalog.json` | repository data file | Immediate JSON input to the S19 equipment-compatibility module. |

The S19 paths above were checked against the target repository's `main` tree. The two uploaded catalog files are at the paths shown above; the referenced JSON and helper files exist in that tree. This establishes file presence, not the retail meaning of any damage formula.

### 1.3 Archive/member and parser inventory

The YBCS formula loaders explicitly open `runtime/client/NRes/Set.lib` through `read_set_members`. The container is not attached to this Batch 0 task and is not copied into the target repository.

| Member table | Container / location | Parser or loader entrypoint evidenced by supplied source | Batch 0 status |
|---|---|---|---|
| `ability.atr` | `runtime/client/NRes/Set.lib` | `parse_old_ability_physical_profiles` / `load_old_ability_physical_profiles`; `parse_old_ability_magic_profiles` / `load_old_ability_magic_profiles`; `parse_old_ability_battle_profiles` / `load_old_ability_battle_profiles`. | Container and entrypoints identified; record audit deferred to Batch 1. |
| `itemtbl.atr` | `runtime/client/NRes/Set.lib` | `load_old_item_table` from `ybcs_single_player_shop`; its implementation was not among the supplied files. Used by physical, magic, battle-profile and enhancement builders. | Member/container and call-site identified; parser implementation is an EVIDENCE_GAP. |
| `Magictbl.atr` | `runtime/client/NRes/Set.lib` | `parse_old_magic_definition_rows`, `parse_old_magic_definitions`, `load_old_magic_definitions` in `ybcs_battle_authority`; `ybcs_progression_magic` also inventories the member. | Container and entrypoints identified; record audit deferred to Batch 1. |
| `magicatr.atr` | `runtime/client/NRes/Set.lib` | `parse_old_magic_attribute_table`, `load_old_magic_attribute_table` in `ybcs_old_magic_attribute`. | Container and entrypoints identified; record audit deferred to Batch 1. |
| `levelabl.atr` | `runtime/client/NRes/Set.lib` | Read through `read_set_members`; used by `build_id_associations` in `ybcs_progression_magic`. | Progression/magic inventory input; not a direct damage formula input in supplied code. |
| `solskill.atr` | `runtime/client/NRes/Set.lib` | Read through `read_set_members`; used by `build_id_associations`. | Skill inventory input; not a direct damage formula input in supplied code. |
| `Effectptn.atr`, `Magicptn.atr` | `runtime/client/NRes/Set.lib` | Listed in `REFERENCED_TABLE_NAMES`; read through `read_set_members`. S19 skill data also carries pattern/resource references. | Presentation/association inputs; not a direct numeric damage formula in supplied code. |
| `Quest.lib` | Old client archive family; exact combat member not established here | `ybcs_progression_magic` imports `read_quest_archive` and `extract_member` from `ybcs_quest_runtime`; its `read_set_members` function uses those generic archive helpers to read Set.lib. | No supplied combat formula loader directly selects a damage table from Quest.lib. Do not infer one. |

The `ybcs_quest_runtime` module name does not mean the combat loaders read Quest.lib: the attached call sites pass the explicit Set.lib path. No .lib or .atr binary is included in the proposed commit.

## 2. Dependency graph (text)

### 2.1 YBCS physical path

```text
runtime/client/NRes/Set.lib
  ├─ ability.atr ── read_set_members ── parse_old_ability_physical_profiles
  └─ itemtbl.atr ── load_old_item_table [implementation not attached]
                                      │
GameDomain ── character.class_id ── ability profile
    │                                 │
    ├─ inventory.equipment ───────────┼─ equipped_item_is_usable
    │                                 │    (slot / equip position / profession / durability)
    └─ progression.attribute_words ───┤
                                      ├─ enhancement_bonuses_for_record
                                      └─ build_character_physical_profile
                                           └─ OfflinePhysicalCombatProfile
                                                ├─ offline_physical_hit_chance
                                                ├─ offline_physical_critical_chance
                                                ├─ resolve_offline_physical_damage
                                                └─ resolve_offline_physical_action
```

Additional physical import chain:
- `ybcs_physical_combat` imports `game_domain`, `ybcs_battle_profiles`, `ybcs_character_stats`, `ybcs_equipment_enhancement`, `ybcs_progression_magic`, and `ybcs_single_player_shop`.
- `ybcs_character_stats` imports `ybcs_old_battle_growth` and initializes its old-resource policy at module import.
- `ybcs_progression_magic` imports `ybcs_quest_runtime` for `read_quest_archive` / `extract_member`.
- `ybcs_battle_profiles` and `ybcs_equipment_enhancement` also require `ybcs_single_player_shop`.

### 2.2 YBCS magic path

```text
runtime/client/NRes/Set.lib
  ├─ ability.atr ── parse_old_ability_magic_profiles
  ├─ itemtbl.atr ── load_old_item_table [implementation not attached]
  ├─ Magictbl.atr ── load_old_magic_definitions
  │                    └─ OldMagicDefinition (Att / EA / EB / EC / MP ...)
  └─ magicatr.atr ── load_old_magic_attribute_table
                       └─ OldMagicAttributeTable.percent_for_definition_attack
                            └─ elemental_percent argument [caller not attached]

resolve_offline_direct_magic_damage
  └─ post-defence apply_old_magic_attribute_percent(elemental_percent)

GameDomain ── ability / equipment / attribute_words
    └─ build_character_magic_profile
         └─ OfflineMagicCombatProfile
              └─ resolve_offline_direct_magic_damage
                   ├─ direct-magic classifier / targeting helper
                   ├─ EA + authored magic damage
                   ├─ magic defence subtraction
                   └─ elemental percent application
```

Additional magic import chain:
- `ybcs_magic_combat` imports `game_domain`, `ybcs_battle_profiles`, `ybcs_character_stats`, `ybcs_equipment_enhancement`, `ybcs_old_magic_attribute`, `ybcs_progression_magic`, `ybcs_single_player_shop`, and `ybcs_old_magic_targeting`.
- Its `OldMagicDefinition` type is imported under `TYPE_CHECKING` from `ybcs_battle_authority`; the caller supplies a parsed definition.
- `ybcs_battle_authority` imports `ybcs_battle_wire`, `ybcs_progression_magic`, `ybcs_battle_terrain`, and `ybcs_old_magic_targeting`. It parses Magictbl definitions and validates battle intent/MP, but does not apply HP damage.
- `ybcs_old_magic_attribute` imports `read_set_members` from `ybcs_progression_magic`.

### 2.3 S19 path

```text
web/src/combat/combat-balance-simulator.ts
  └─ ReconstructionCombatBalance
       ├─ playableClassById ── web/src/content/classes/class-catalog.ts
       │    ├─ data/classes/swordsman.json / wizard.json
       │    ├─ class-helpers.ts ── content-types.ts + equipment-compatibility.ts
       │    ├─ swordsman.ts / wizard.ts
       │    └─ swordsman-ten-stage.ts / wizard-ten-stage.ts
       └─ skillById ── web/src/content/skills/skill-catalog.ts
            ├─ data/skills/mvp.json
            └─ content-types.ts

playerStats / enemyStats
  └─ hitChance / criticalChance / deterministicDamage
       └─ resolveAttack / resolveSkillAttack
```

The class-catalog stage modules have additional progression and battle-profile imports. They are module-load dependencies of the current class catalog, but those subsystems are not damage arithmetic. Batch 1 should perform an actual import/build smoke test and record any further transitive blockers rather than treating this diagram as proof that the whole application dependency graph has been closed.

## 3. Elemental-percent implementation: exact result

### 3.1 Table loading and join

In `ybcs_old_magic_attribute.py`:
- `OLD_MAGIC_ATTRIBUTE_NAMES` defines row IDs 1 fire, 2 water, 3 lightning, 4 wind, 5 earth, 7 holy and 8 magic (30–38).
- `OLD_MAGIC_ATTRIBUTE_DIRECT_JOIN_IDS` is exactly `{1, 2, 3, 4}`; the neutral percent is 100 (76–78).
- `parse_old_magic_attribute_table` expects CP949 text with exactly nine lines: header, seven data rows and `;999` sentinel (192–239).
- Each data row has eleven integer percentages: ten old profession columns plus one special-monster column (104–110, 214–239).
- `load_old_magic_attribute_table` reads `magicatr.atr` from `runtime/client/NRes/Set.lib` (242–254).
- `percent_for_definition_attack` only joins Magictbl Att values 1–4. Other Att values return neutral 100; the source comment explicitly avoids guessing the ambiguous earth-looking Att=6 and compound Att values (168–189).

### 3.2 Calculation and rounding

`apply_old_magic_attribute_percent(damage, percent)` is at lines 257–275. It validates positive signed-i16 damage and a percentage in 1..1000, then returns:

```python
min(0x7FFF, max(1, damage * percent // 100))
```

Therefore:
1. The multiplication is integer multiplication.
2. `// 100` floors the positive integer product to an integer.
3. The result is clamped to at least 1 and at most 32767.
4. In `resolve_offline_direct_magic_damage`, this function is called after the magic-defence subtraction (442–481; especially 462–470).

This is the actual rounding rule of the supplied offline policy. The module's own docstring says the old resource proves integer percentage inputs but does not prove the retired server's ordering or rounding (257–265). Do not label this as the original retail-server rule.

Important integration boundary: the supplied magic resolver imports and calls `apply_old_magic_attribute_percent`, but it does not load `OldMagicAttributeTable` or call `percent_for_definition_attack`. Its caller supplies `elemental_percent` (default 100). The caller that joins Magictbl Att / target profession to the table and passes that value into the resolver is not present in the supplied files; this lookup-to-resolver wiring remains an EVIDENCE_GAP.

### 3.3 Limits of the element join

- The table has earth/holy/magic rows, but the current Magictbl Att join only accepts 1–4.
- The source comments identify Att=6 as an ambiguous earth-looking value and compound Att values 15/16 as collisions; those are intentionally neutral rather than guessed.
- The table lookup requires target profession 0..9 or the special-monster selector. The S19 class family is only `swordsman | wizard`; no evidenced lossless mapping to the ten old profession columns or special-monster flag exists yet.
- `elemental_percent` is a target-selected percentage input, not a proven standalone elemental-resistance stat. The lookup function exists, but its caller-to-resolver wiring is not in the supplied files. Its precise authored row/column values require the Batch 1 archive audit.

## 4. OldAbility-to-S19 authored attribute mapping draft

### 4.1 Source-field layers

YBCS has three distinct layers:
1. Old `ability.atr` fields parsed into `OldAbilityPhysicalProfile` / `OldAbilityMagicProfile`.
2. Effective offline profiles after eligible equipment, enhancement and allocated attribute words are composed.
3. Damage resolvers consume those effective profiles plus a defender profile and, for direct magic, an `OldMagicDefinition`.

S19 also has distinct layers:
1. Class JSON is transformed by `class-helpers.ts` into `baseAuthoredStats` (`hp`, `mp`, `move`, `hit`, `magicHit`, `range`).
2. `playerStats` combines those authored anchors with family tuning, level growth and `EquipmentCombatBonuses`.
3. `skill-catalog.ts` preserves authored skill fields, while `SKILL_POLICY` supplies reconstruction multipliers/hits/critical modifiers/DOT behavior.

Do not compare a raw OldAbility column directly to a final S19 `CombatantStats` value and call the result a formula difference.

### 4.2 Physical mapping

| Old YBCS field / contribution | S19 candidate | Mapping status and reason |
|---|---|---|
| `ability_id` / `character.class_id` | `classId` | Candidate numeric key join only. Verify each intended class row in Batch 1; do not infer all stage IDs are interchangeable. |
| `physical_accuracy` | `accuracy` | Semantic candidate. YBCS adds eligible item accuracy; S19 uses authored `hit` + level-flat growth + equipment bonus. Probability conversion differs. |
| `physical_evasion` | `evasion` | Semantic candidate, not direct equality. YBCS reads a physical-specific old field and item bonuses; S19 uses family tuning plus level growth/equipment and has one shared evasion field. |
| `critical_rate` | `criticalChance` | Candidate after unit normalization only. YBCS is integer percent bounded 0..95; S19 is fractional probability clamped to 0..0.35. S19 also subtracts defender `criticalResistance`, which has no direct YBCS counterpart in the supplied physical profile. |
| `physical_damage` | `attack` | Not directly equivalent. YBCS composes an old Ability base, item min/max, enhancement and STR allocation; S19 uses family base attack plus equipment, scaled by level. |
| `physical_defense` | `defense` | Semantic candidate, not direct equality. YBCS composes Ability/item/enhancement/DEF allocation; S19 uses family base defense, equipment and level scaling. |
| item `minimum_physical_damage` / `maximum_physical_damage` | `attack` | Range-to-scalar conversion is not identity. YBCS takes floor midpoint; S19 uses one attack scalar and a skill multiplier. |
| enhancement `physical_attack` / `physical_defense` | equipment `attack` / `defense` | Semantic candidate only. YBCS packed enhancement is an explicit offline compatibility policy; S19 equipment bonuses are separate reconstruction inputs. |
| STR stat code 2 / DEF stat code 3 | `attack` / `defense` | YBCS applies flat +1 per allocated point. S19 has no corresponding allocated-stat field in the supplied combat profile builder. |

YBCS physical special cases that must remain explicit in Batch 1:
- If physical accuracy is zero, the offline policy returns 100% hit; otherwise it clamps `accuracy - target evasion` to 5..95.
- Physical critical chance is the attacker's bounded integer critical rate; critical damage doubles the resolved base damage.
- Physical defence is applied only when the attacker's `authored_damage` flag is true; the unarmed fallback can bypass defence.
- Raw physical damage is floor midpoint of min/max; the final result has a 1..32767 bound.
- S19 uses 0.84 base hit chance, 0.65..0.97 hit bounds, 0.002 accuracy-point value, 1.5 critical multiplier, a 0.35 critical cap and a per-strike 45%-of-target-HP cap.

### 4.3 Magic mapping

| Old YBCS field / contribution | S19 candidate | Mapping status and reason |
|---|---|---|
| `magic_accuracy` | `magicAccuracy` | Semantic candidate. YBCS profile stores the field and item contribution; the supplied direct-magic damage resolver does not itself calculate a magic hit chance. |
| `magic_evasion` | `evasion` | No direct mapping. YBCS has a separate magic-evasion field; S19 has one shared evasion field. |
| `magic_damage` | `magicAttack` | Not directly equivalent. YBCS composes Ability/item min/max, enhancement and INT allocation; S19 uses family base magic attack plus equipment and level scaling. |
| `magic_defense` | `magicDefense` | Semantic candidate, not direct equality. YBCS applies full subtraction; S19 applies `defenseEffectiveness` 0.65. |
| item `minimum_magic_damage` / `maximum_magic_damage` | `magicAttack` | Range-to-scalar conversion is not identity. YBCS uses floor midpoint only when `authored_damage` is true. |
| enhancement `magic_attack` / `magic_defense` | equipment `magicAttack` / `magicDefense` | Semantic candidate only; composition and level scaling differ. |
| INT stat code 4 / magic-defence stat code 5 | `magicAttack` / `magicDefense` | YBCS adds flat +1 per allocated point. S19's supplied player builder has no corresponding allocated-stat input. |
| Magictbl `EA` | skill authored `effectA` | Same named authored source field is a candidate join through the old skill/definition ID. YBCS direct magic uses EA as a base effect; S19 preserves EA but delegates damage to reconstruction `SKILL_POLICY`. |
| Magictbl `Att` | skill authored `attackType` | Candidate authored-field join. YBCS uses Att in direct-spell classification and elemental join; S19 uses it as preserved authored metadata plus separate target/behavior policy. |
| `elemental_percent` / target profession / special-monster selector | No S19 field | Unsupported in the supplied S19 `CombatantStats` and tuning schema. No lossless old-profession-to-two-family mapping is established. |
| Magic critical chance / magic critical resistance | S19 `criticalChance` / `criticalResistance` | No corresponding magic critical fields or resolver are present in the supplied YBCS magic profile/resolver. Do not borrow physical critical rules. |

YBCS direct-magic order:
1. Use EA (or explicit `base_effect`) plus authored magic-damage midpoint when `authored_damage` is true; cap raw at 32767.
2. Subtract full defender magic defence with minimum 1 and the signed-i16 cap.
3. Apply target-selected elemental percentage with integer floor division and 1..32767 bounds.

S19 direct/skill magic instead uses the reconstruction skill multiplier and `magicAttack`, subtracts 0.65 of `magicDefense`, and then applies its own minimum/HP-ratio bounds. The S19 skill multiplier is reconstruction policy, not a direct replacement for old EA.

### 4.4 Class and skill authored anchors

- S19 `AuthoredClassStats` contains `hp`, `mp`, `move`, `hit`, `magicHit`, `range`, and `stageEntrySkillId`. The class helper copies these fields from `data/classes/swordsman.json` and `data/classes/wizard.json`.
- S19 `playerStats` consumes authored HP/MP/hit/magicHit. Attack, defence, magic attack, magic defence, evasion, critical chance and critical resistance come from S19 family tuning plus equipment/level rules, not from the class JSON rows.
- YBCS character stats identify old ability HP/MP at old Ability columns 2/3 via the old battle-growth policy; that policy implementation is not attached. The physical/magic profile builders separately read their named attack/defence/hit fields.
- S19 `PlayableSkillDefinition.authored` preserves attack type, EA/EB/EC, tick, iteration and other Magictbl-derived fields. S19 `SKILL_POLICY` independently sets multiplier, hits, accuracy modifier, critical bonus and DOT behavior. Do not equate those policy values with retail formulas.
- The current S19 sample poison row `19201` has negative EA and Att 16 in `data/skills/mvp.json`; it does not satisfy the supplied YBCS direct-offensive classifier's positive-EA / admitted-Att signature. Treat poison/status/DOT as a separate crosswalk case, not as a forced direct-damage match.

## 5. Dependency closure and evidence gaps

### 5.1 Closed for Batch 0 inventory purposes

- The physical and magic formula source attachments are present and their formula entrypoints are located.
- All eight newly supplied support/catalog files are present and inspected.
- The previously supplied `game_domain.py`, S19 reconstruction balance and simulator sources are present in the task context.
- The exact Set.lib path and parser/loader call sites for ability.atr, Magictbl.atr and magicatr.atr are identified.
- The itemtbl.atr call-site and loader name are identified.
- The exact elemental percentage function and floor-rounding behavior are verified from its supplied implementation.
- S19 class/skill catalog paths and immediate class/skill JSON inputs were confirmed in the repository tree.

### 5.2 Still EVIDENCE_GAP / required before runtime Batch 1

YBCS source dependencies not supplied:
- `ybcs_single_player_shop.py`: implementation of `load_old_item_table` and the itemtbl.atr parser.
- `ybcs_old_battle_growth.py`: imported by `ybcs_character_stats.py`; its policy is loaded at module initialization and supplies old HP/MP baseline lookup.
- `ybcs_quest_runtime.py`: implementation of `read_quest_archive` and `extract_member`, required by `read_set_members`.
- `ybcs_old_magic_targeting.py`: direct-magic classification dependency and battle-authority target helper.
- The orchestration/call site that selects `elemental_percent` from `OldMagicAttributeTable.percent_for_definition_attack` and passes it into `resolve_offline_direct_magic_damage`: not present in the supplied files.
- `ybcs_battle_wire.py` and `ybcs_battle_terrain.py`: top-level imports of `ybcs_battle_authority.py`; needed to import/use that module's Magictbl parser in the current package layout, although they are not arithmetic inputs.

Resource inputs not attached:
- `runtime/client/NRes/Set.lib` and its members, including ability.atr, itemtbl.atr, Magictbl.atr and magicatr.atr. They are intentionally retained outside the repository by the owner; Batch 1 requires controlled read-only access for record-level verification.
- No combat formula table has been proven to come directly from Quest.lib in the supplied call sites.

Remaining S19 runtime closure:
- The class and skill catalogs plus their immediate class/skill JSON inputs exist in the target repository.
- The class catalog imports stage modules which in turn import progression and battle-profile modules. Batch 1 must run a focused import/build smoke test and enumerate any additional transitive imports required by the actual test harness.
- Class JSON and skill JSON content is present in the repository, but record-level comparison against old Set.lib rows is deferred to Batch 1.

### 5.3 Evidence policy

Every YBCS source, field interpretation, policy and derived mapping in this inventory is labelled `RECOVERED_SECONDARY`. Source comments that identify an old-client column or a deterministic offline policy do not establish the retired retail server's damage arithmetic. S19's own `RECONSTRUCTION_POLICY` remains distinct. No raw .lib/.atr binary, extracted table or generated resource dump is added to this PR.

## 6. Batch 0 conclusion

**Batch 0 inventory is complete; the executable dependency graph is not yet fully closed.**

The main remaining YBCS blockers are the item-table loader, old battle-growth policy, archive helper, and old magic-targeting module; the battle wire/terrain imports are additional module-load dependencies for the magic-definition authority. Set.lib record-level inspection remains intentionally deferred to Batch 1.

**Batch 1 recommendation:** allow read-only fixture and table-audit preparation, but do not run the cross-calculation harness until the listed YBCS source dependencies and owner-controlled Set.lib input are available and the S19 catalog import smoke test passes.

## 7. Non-goals reaffirmed

- No S19 source, tuning, skill policy or simulator code is changed.
- No formula is selected as authoritative and no formula is merged.
- YBCS is not labelled `VERIFIED`.
- No binary archive or raw resource member is committed.
- This document and its mapping CSV are inventory artifacts only; Batch 1+ require separate authorization.


## 8. Batch 1 record-level verification addendum (auto-4-1)

This section supplements the Batch 0 inventory. It does not change the evidence classification: every YBCS source/table observation remains RECOVERED_SECONDARY.

### 8.1 Set.lib archive result

- Supplied Set.lib size: 112,730 bytes.
- SHA-256: ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe.
- Header: directory expanded size 528 bytes, packed directory size 241 bytes, data base offset 251, check word 0xE8356AB8 (recorded, not independently validated).
- All 12 directory entries and all 12 members were decompressed successfully. No decompression error occurred.
- Archive support used the existing Lapis extractor helpers from ViLeo06/lapis-rebuild at commit 51907f41365edb4be393579f3814d8e23116dd6e (tools/extract/lib_archive.py and tools/extract/pkware_blast.py). These helpers and the Set.lib binary are not copied into this PR.

| Member | Unpacked bytes | Data rows / non-comment lines | SHA-256 |
|---|---:|---:|---|
| ability.atr | 109,656 | 724 | 0bab4c622336378e52fb0d13b6e5d50a78f2c514d687332d47042c416a07c04b |
| itemtbl.atr | 339,967 | 2,073 | cf5c9786810b80619ae3133ad77a27d9fb51f2078c30c947c482483d1030eb2e |
| levelabl.atr | 70,666 | 1,397 | 0766b9ab5c357e1e830708ca90589cbe715bf02265e185a4c6ae900eefe287dc |
| magicatr.atr | 383 | 7 | dde12fc5e96359b6dc23dbc360672c08aad6d328fd25402a1dc27033fdb191c1 |
| Magicptn.atr | 18,664 | 281 | 5affdd750873e7ccb5a364cc372870b98cde95df905140fa88aedd79155cfceb |
| Magictbl.atr | 32,338 | 460 | d885bbd1bddffd3d4bf05b2b4e36232c62d94fc78209d46861b01986779ef0d9 |
| solskill.atr | 4,282 | 90 | 43ad7f975336e7c105d7eda7a48fe8afcee109ce81b618ca83ef7ce812fe1a41 |
| SysHelp.atr | 1,074 | 32 non-comment text lines | bfba64b0e68cef567895eb69989ee94f5120dbd10e1fc2f0fcb33cc26c81d240 |
| tileattb.atr | 2,566 | 27 | e0c90bf8132223af6fa908906487e2c20a5fdacd39df9c4f8be83e16daf7fd01 |
| tileattr.atr | 2,537 | 27 | fbdd1cf08e80c581d68c182ca1f28d9850fb63e05e25954ae02e2332b8a70dc9 |
| Effectptn.atr | 1,567 | 8 | a2dbac61fb4d2d2b8f08be16a4ddaa1138f6742f81cb91bee6174cd9eb3d6c44 |
| zone_name.txt | 4,099 | text member; 107 non-empty lines | 02541808ee6860c1fea4d7ca8cb31d1b0dfe326a3712e95eadbb3218370fa9dd |

The row-count convention is non-empty lines excluding lines beginning with semicolon. SysHelp.atr and zone_name.txt are text resources, not combat attribute tables.

### 8.2 ability.atr record count and parser-index check

- 724 data records; 724 unique Ability IDs, minimum 100 and maximum 6216.
- Header has 46 tab-separated fields. Actual data-row widths: 644 rows have 46 fields and 80 rows have 45 fields. Both widths satisfy the physical/magic parsers' minimum of 45 fields and retain field index 44 (name).
- All 724 records have numeric values at every target index used by the two parsers. No duplicate Ability ID or invalid target numeric field was found.
- ybcs_physical_combat.py reads indexes 18, 19, 20, 36, 37. ybcs_magic_combat.py reads 21, 22, 38, 39. The indexes match the installed header:

| Index | Installed header | Parser field |
|---:|---|---|
| 18 | hit(명중) | physical_accuracy |
| 19 | elu(회피) | physical_evasion |
| 20 | blow(필살) | critical_rate |
| 36 | 무기데미지 | physical_damage |
| 37 | 방어력 | physical_defense |
| 21 | mhit(마명) | magic_accuracy |
| 22 | melu(마회) | magic_evasion |
| 38 | 마법데미지 | magic_damage |
| 39 | 마법방어력 | magic_defense |

Representative source rows (physical tuple order [18/19/20/36/37], magic tuple order [21/22/38/39]):

| Ability ID / line | Name | Physical fields | Magic fields | cla |
|---|---|---|---|---:|
| 100 / 2 | 见习剑士 | 160 / 2 / 2 / 0 / 5 | 160 / 5 / 0 / 0 | 0 |
| 105 / 7 | 见习枪兵 | 160 / 2 / 3 / 2 / 0 | 160 / 5 / 0 / 0 | 4 |
| 109 / 11 | 见习巫师 | 160 / 2 / 2 / 0 / 0 | 160 / 10 / 0 / 0 | 9 |
| 500 / 102 | 士兵G | 101 / 1 / 2 / 44 / 27 | 101 / 5 / 0 / 0 | 0 |
| 1004 / 266 | 见习巫师 | 180 / 20 / 2 / 10 / 25 | 180 / 30 / 30 / 30 | 6 |
| 1005 / 267 | 巫师 | 180 / 30 / 2 / 20 / 25 | 180 / 30 / 40 / 40 | 8 |

These are raw table fields, not formula outputs.

### 8.3 itemtbl.atr scope boundary

- itemtbl.atr is present and has 2,073 non-comment records.
- All 2,073 rows have 55 tab-separated columns, matching the supplied loader shape of 53 numeric columns plus name and description.
- This batch did not inspect item IDs, prices, damage/defence columns, profession flags, enhancement fields or item semantics. That record-level work remains assigned to S4.

### 8.4 Additional source modules and parser results

| Supplied module | Lines | Batch 1 finding |
|---|---:|---|
| ybcs_old_battle_growth.py | 737 | Loaded the supplied Set.lib through the old resource loader. Parsed 724 Ability growth rows; parsed ten starter chains (100–109), each with 100 ordered levels; resolved 459 unique first-match magic definition IDs. |
| ybcs_old_magic_targeting.py | 747 | Imported successfully. Defines Dist/Area targeting interpretation and leaves unsupported client cursor inputs unsupported; it is not a damage arithmetic module. |
| ybcs_battle_wire.py | 2,832 | Imported successfully. Its own source says damage formula, result/reward fields, terminal uplink response and persistence timing remain unresolved. |
| ybcs_battle_terrain.py | 201 | Parsed tileattr.atr successfully as a 28-by-15 matrix built from 27 authored terrain rows and 11 authored movement profiles. |
| ybcs_single_player_shop.py | 1,520 | Inspected load_old_item_table at lines 372–413. Its parser contract matches the 2,073 itemtbl rows / 55-column overview; no item-record semantics were audited. |
| ybcs_quest_runtime.py | 679 | Imported with the existing archive helper API and used by read_set_members to decode Set.lib. It is a generic archive helper; this does not establish that combat data comes from Quest.lib. |

Additional parser checks:
- The exact ybcs_old_battle_growth loader returned 724 Ability rows and ten 100-level starter chains.
- The exact ybcs_old_magic_attribute parser accepted all seven magicatr rows.
- The exact ybcs_battle_authority Magictbl parser returned 460 physical rows; its first-match dictionary contains 459 unique IDs because definition 7305 occurs twice. First-match behavior is intentional in the supplied source.
- The exact ybcs_battle_terrain parser returned 28 runtime terrain rows by 15 movement profiles.

Import-scope qualification: ybcs_single_player_shop.py has additional top-level imports (including ybcs_inventory_items.py, ybcs_single_player_bank.py and ybcs_shop_sale_compatibility.py) that were not part of this upload. The itemtbl member count and row shape were therefore verified directly from archive bytes and against the supplied parser contract, without claiming a complete shop-service import smoke test.

### 8.5 OldAbility-to-S19 authored row matches

The target repository main was read without modification. Exact field-by-field comparison was performed for all 20 shared playable class IDs: swordsman 100, 110, 120, 130, 140, 150, 160, 170, 180, 190; wizard 109, 119, 129, 139, 149, 159, 169, 179, 189, 199.

For every one of these 20 IDs, Set.lib ability.atr exactly matches the corresponding S19 data/classes row for HP, MP, move, hit, magic_hit, range and class_name_raw. The S19 class helper copies these fields into its authored class definition. The playerStats builder then uses HP/MP/hit/magicHit with its own level and equipment adjustments. This verifies authored anchors only; it does not equate final YBCS and S19 combatant values.

The six S19 MVP skill rows (1101, 1201, 1301, 19101, 19201, 19301) were compared with their first-match Magictbl rows. Their authored Att, Dist, Area, MP, Time, Team, Unit, EA, EB, EC, TICK, LVPT, MagicPtn, iconindex, Iter and explanation values match exactly. S19 SKILL_POLICY behavior and damage multipliers remain separate reconstruction policy. A matching skill ID/row does not prove that both runtimes classify or execute it as the same damage kind.

### 8.6 Attribute-order correction and remaining evidence gaps

- ybcs_old_battle_growth.py defines OLD_ATTRIBUTE_ORDER as con, wis, str, dex, int, reg. Its Ability parser reads base values from columns 4, 6, 8, 10, 12, 14; levelabl growth values are columns 2–7.
- ybcs_character_stats.py maps stat code 2 to STR/physical attack, code 3 to DEX/physical defence, code 4 to INT/magic attack and code 5 to REG/magic defence. The constant name LEGACY_DEFENSE_STAT_CODE=3 refers to the DEX storage slot; it does not mean the third stat is named DEF.
- The earlier Batch 0 CSV wording “DEF stat code 3” is corrected in the Batch 1 mapping update to DEX.
- The elemental table lookup-to-resolver caller remains an EVIDENCE_GAP: the supplied modules define percent_for_definition_attack and resolve_offline_direct_magic_damage(elemental_percent=100), but no attached module calls the former and passes its result to the latter. Fixture A records an explicit table-derived elemental_percent as a test input only; it does not claim this missing production wiring was recovered.
- YBCS direct magic has no supplied magic hit/critical resolver. Fixture M therefore excludes paired magic hit/critical comparisons.
- No formula outputs or YBCS-versus-S19 damage calculations were produced in Batch 1.

### 8.7 Batch 1 boundary

The Set.lib binary and extracted members remain outside the repository. This addendum contains only inventory counts, hashes, field-index evidence and authored-field comparisons. Fixture inputs are specified in s3-fixture-spec.md. Batch 2 formula cross-calculation remains unperformed and requires separate authorization.
