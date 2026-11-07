# S3 Dual Fixture Specification — Batch 1

- Request: auto-4-1
- Batch: 1 — record-level verification, dual Fixture specification, mapping finalization.
- Source evidence: all YBCS resource/code observations remain RECOVERED_SECONDARY. S19 code and reconstruction policies retain their existing provenance.
- Execution boundary: this file defines inputs only. It contains no expected damage values, calculated outputs or cross-engine formula results.
- Raw resource rule: Set.lib and extracted members are not committed. This spec records source member hashes, line numbers and selected field values only.

## 1. Fixture architecture

Two complementary fixtures are defined for the same 15 physical cases (P01–P15) and 15 magic cases (M01–M15).

| Fixture | Purpose | Construction |
|---|---|---|
| Fixture A — authored source | Preserve actual old authored Ability/Magictbl/magicatr inputs and exact YBCS profile construction. | Use selected Set.lib records, source line numbers and parser field indexes. No equipment rows or allocated attribute points are added. |
| Fixture B — controlled effective values | Isolate arithmetic by supplying explicit effective numeric profiles directly to each runtime. | Construct YBCS Offline*CombatProfile and S19 CombatantStats objects directly. Align stated offense/defence anchors where field semantics allow; retain each engine's own hit/critical/defence/element policies. |

Fixture A is a source-fidelity fixture, not a claim that every old monster Ability row has an S19 class counterpart. Fixture B is the paired controlled fixture for Batch 2.

### 1.1 Common provenance and identity fields

Every fixture record carries:

| Field | Type | Rule |
|---|---|---|
| fixture_id | string | P01–P15 or M01–M15, plus suffix A or B in serialized records. |
| fixture_family | enum | physical or magic. |
| fixture_variant | enum | authored-source (A) or controlled-effective (B). |
| evidence_level | enum | YBCS source values: RECOVERED_SECONDARY. S19 constants/behavior retain RECONSTRUCTION_POLICY. |
| source_archive_sha256 | string | Fixture A: ce1bb0425b367289f144e0780147f7c63abb833733035949853ce70dfb3c82fe. |
| source_member_sha256 | string | Fixture A: exact member hash listed in the inventory addendum. |
| source_line | integer or null | Physical line number in the extracted member; null for Fixture B. |
| notes | string | Intended branch/coverage only; never an expected damage result. |

### 1.2 Fixture A — authored physical profile fields

Raw Ability source fields are read from Set.lib/ability.atr:

| Raw field | Index | Header | Profile field |
|---|---:|---|---|
| ability_id | 0 | No | source_id |
| physical_accuracy | 18 | hit(명중) | physical_accuracy |
| physical_evasion | 19 | elu(회피) | physical_evasion |
| critical_rate | 20 | blow(필살) | critical_rate |
| physical_damage | 36 | 무기데미지 | minimum_damage / maximum_damage source |
| physical_defense | 37 | 방어력 | physical_defense |
| profession_selector | 24 | cla(병종) | retained source metadata |
| name | 44 | 이름 | name |

Construct the YBCS physical profile using the supplied ability_physical_profile behavior:

- source_id = ability_id.
- minimum_damage = maximum_damage = physical_damage when physical_damage is positive; otherwise both are the explicit unarmed fallback 10.
- physical_defense, physical_accuracy, physical_evasion and critical_rate are copied directly from the raw row.
- source_kind = ability.
- authored_damage = (raw physical_damage > 0). The fallback value 10 does not turn authored_damage on.
- equipped_item_ids = empty tuple.
- The defender is constructed from its own Ability row using the same rule.
- hit_roll and critical_roll are fixture controls in 0..99. They are not source-table fields.

Fixture A intentionally has no itemtbl equipment and no allocated attribute words. This keeps it within the Batch 1 itemtbl boundary.

### 1.3 Fixture A — authored magic profile and definition fields

Raw Ability source fields:

| Raw field | Index | Header | Profile field |
|---|---:|---|---|
| ability_id | 0 | No | source_id |
| magic_accuracy | 21 | mhit(마명) | magic_accuracy |
| magic_evasion | 22 | melu(마회) | magic_evasion |
| magic_damage | 38 | 마법데미지 | minimum_damage / maximum_damage source |
| magic_defense | 39 | 마법방어력 | magic_defense |
| profession_selector | 24 | cla(병종) | target profession metadata |
| name | 44 | 이름 | name |

Construct the YBCS magic profile using the supplied ability_magic_profile behavior:

- source_id = ability_id.
- minimum_damage = maximum_damage = raw magic_damage.
- magic_defense, magic_accuracy and magic_evasion are copied directly.
- source_kind = ability.
- authored_damage = (raw magic_damage > 0).
- equipped_item_ids = empty tuple.
- The defender is constructed from its own Ability row using the same rule.

The complete OldMagicDefinition input shape is:

| Field | Source |
|---|---|
| source_line | physical Magictbl.atr line |
| number | Magictbl Num, decimal |
| name | Magictbl Name |
| attack | Magictbl Att, decimal |
| distance | Magictbl Dist, parsed hexadecimal |
| area | Magictbl Area, parsed hexadecimal |
| mp_cost | MP, decimal |
| time | Time, decimal |
| team | Team, decimal |
| unit | Unit, decimal |
| effect_a / effect_b / effect_c | EA / EB / EC, decimal |
| tick | TICK, decimal |
| level_point | LVPT, decimal |
| magic_pattern | MagicPtn, decimal |
| icon_index | iconindex, decimal |
| iteration | Iter, decimal |
| explanation | final textual column |

Fixture A elemental_percent construction:
- target_profession is the defender Ability row's column-24 cla value.
- target_is_special_monster is explicitly false for all A cases below.
- elemental_percent is the result of OldMagicAttributeTable.percent_for_definition_attack(Att, target_profession, false).
- Att values outside {1,2,3,4} produce the table helper's neutral 100.
- This is a fixture-side materialization only. The supplied modules still have no production caller wiring percent_for_definition_attack into resolve_offline_direct_magic_damage.
- base_effect is null for all A cases; the resolver's default definition EA path is the intended input.
- magic_accuracy and magic_evasion are retained source profile fields, but the supplied direct-magic damage resolver does not consume them.

### 1.4 Fixture B — controlled physical schema

YBCS attacker and defender are direct OfflinePhysicalCombatProfile inputs. Complete fields:

| Field | Attacker | Defender |
|---|---|---|
| source_id | fixture-local positive ID | fixture-local positive ID |
| minimum_damage / maximum_damage | explicit pair from P table | 0 / 0 |
| physical_defense | 0 unless a case explicitly sets it | explicit defender defence |
| physical_accuracy | explicit attacker accuracy | 0 |
| physical_evasion | explicit attacker value, retained but not used as defender evasion | explicit defender evasion |
| critical_rate | integer percent | 0 |
| source_kind | character | ability |
| authored_damage | explicit boolean | false |
| equipped_item_ids | empty tuple | empty tuple |

S19 controlled CombatantStats fields are fully populated, even where the damage call does not consume them:

- Attacker: id=fixture-player, side=player, family=swordsman, rank=null, role=null, level=1, maxHp=200, maxMp=100, attack=case value, defense=0, magicAttack=0, magicDefense=0, accuracy=case value, magicAccuracy=0, evasion=case value, criticalChance=case fraction, criticalResistance=0, criticalMultiplier=1.5, authoredAnchors=null, provenance=COMBAT_BALANCE_PROVENANCE.
- Defender: id=fixture-enemy, side=enemy, family=null, rank=normal, role=melee, level=1, maxHp=case value, maxMp=0, attack=0, defense=case value, magicAttack=0, magicDefense=0, accuracy=0, magicAccuracy=0, evasion=case value, criticalChance=0, criticalResistance=case value (zero in this matrix), criticalMultiplier=1.5, authoredAnchors=null, provenance=COMBAT_BALANCE_PROVENANCE.
- AttackProfile for every P case: kind=physical, multiplier=1.0, hits=1, accuracyModifier=0, criticalBonus=0.
- S19 deterministic RNG values are listed as (hit_random, critical_random), each in [0,1). YBCS rolls are integers in 0..99.
- Controlled numeric values are aligned inputs, not aligned probabilities. YBCS and S19 intentionally retain their own hit-rate conversion, critical caps/multipliers, defence coefficient and HP cap. Do not normalize away those policy differences.

### 1.5 Fixture B — controlled magic schema

YBCS direct-magic inputs:
- Attacker OfflineMagicCombatProfile: source_id, minimum_damage, maximum_damage, magic_defense=0, magic_accuracy=100, magic_evasion=0, source_kind=character, authored_damage, equipped_item_ids=().
- Defender OfflineMagicCombatProfile: source_id, minimum_damage=0, maximum_damage=0, magic_defense=case value, magic_accuracy=0, magic_evasion=0, source_kind=ability, authored_damage=false, equipped_item_ids=().
- OldMagicDefinition fields are supplied as explicit case data; base_effect and elemental_percent are explicit fields.
- The direct resolver's input offense is the definition EA (or base_effect override) plus the attacker's authored midpoint only when authored_damage is true. The spec records that pre-defence offense as an input anchor, not as an output.

S19 controlled magic inputs:
- Use a fully populated CombatantStats object with side/player or enemy, family/rank/role, level=1, maxHp from the case, maxMp=100 for attacker and 0 for defender, magicAttack=the explicit pre-defence offense anchor, magicDefense=the same numeric defender defence input, magicAccuracy=100 for attacker and 0 for defender, evasion=0, criticalChance=0, criticalResistance=0, criticalMultiplier=1.5, authoredAnchors=null and normal S19 provenance.
- Invoke only deterministicDamage with kind=magic, multiplier=1.0 and critical=false for paired B cases. Do not invoke S19 SKILL_POLICY multipliers in this controlled fixture.
- S19 has no elemental-percent field. The absence is intentional and must remain visible in the Batch 2 comparison.
- The YBCS direct-magic resolver has no magic hit/critical decision. M cases therefore do not create a paired magic hit/critical result; those fields are outside the matched direct-damage fixture.

## 2. P01–P15 — Fixture A authored source inputs

Raw A physical tuple order is [hit / elu / blow / weapon-damage / defence]. The derived profile damage pair is shown as min=max and authored_damage T/F. Defender tuple is [elu / defence]. Rolls are test controls, not source values.

| Case | Attacker Ability row | Raw A physical | A profile damage/authored | Defender Ability row | Raw D [elu/def] | YBCS rolls [hit/crit] | Coverage |
|---|---|---|---|---|---|---|---|
| P01 | 100@2 见习剑士 | 160/2/2/0/5 | 10/10, F | 500@102 士兵G | 1/27 | 94/99 | zero authored damage uses fallback |
| P02 | 105@7 见习枪兵 | 160/2/3/2/0 | 2/2, T | 501@103 士兵F | 2/31 | 0/99 | small authored damage |
| P03 | 109@11 见习巫师 | 160/2/2/0/0 | 10/10, F | 502@104 士兵E | 3/35 | 99/99 | caster row / unarmed fallback |
| P04 | 110@12 剑士 | 160/4/2/0/5 | 10/10, F | 503@105 士兵D | 5/39 | 0/0 | promoted class row |
| P05 | 119@21 巫师 | 160/4/3/0/0 | 10/10, F | 504@106 士兵C | 5/43 | 94/0 | promoted caster row |
| P06 | 500@102 士兵G | 101/1/2/44/27 | 44/44, T | 501@103 士兵F | 2/31 | 50/99 | NPC authored physical damage |
| P07 | 501@103 士兵F | 103/2/2/52/31 | 52/52, T | 502@104 士兵E | 3/35 | 75/99 | second NPC damage tier |
| P08 | 502@104 士兵E | 105/3/2/60/35 | 60/60, T | 503@105 士兵D | 5/39 | 25/0 | third NPC damage tier |
| P09 | 503@105 士兵D | 107/5/2/68/39 | 68/68, T | 504@106 士兵C | 5/43 | 50/99 | fourth NPC damage tier |
| P10 | 504@106 士兵C | 109/5/2/76/43 | 76/76, T | 505@107 士兵B | 5/47 | 99/0 | fifth NPC damage tier |
| P11 | 1004@266 见习巫师 | 180/20/2/10/25 | 10/10, T | 500@102 士兵G | 1/27 | 94/99 | authored low-damage caster row |
| P12 | 1005@267 巫师 | 180/30/2/20/25 | 20/20, T | 501@103 士兵F | 2/31 | 0/0 | authored caster row |
| P13 | 1011@273 役使神 | 111/5/2/104/47 | 104/104, T | 502@104 士兵E | 3/35 | 50/99 | high-damage resource row |
| P14 | 1015@277 纱坦 | 125/5/2/160/75 | 160/160, T | 503@105 士兵D | 5/39 | 94/0 | higher authored damage/defence row |
| P15 | 2004@297 见习巫师A | 101/5/2/44/17 | 44/44, T | 504@106 士兵C | 5/43 | 99/99 | alternate monster family row |

## 3. P01–P15 — Fixture B controlled physical inputs

Notation:
- Y-A = YBCS attacker [min,max; attacker physical_defense; physical_accuracy; physical_evasion; critical_rate; authored_damage].
- Y-D = YBCS defender [physical_defense; physical_evasion].
- S-A = S19 attacker [attack; accuracy; evasion; criticalChance].
- S-D = S19 defender [defense; evasion; maxHp; criticalResistance].
- S RNG = [hit_random; critical_random].
- Unlisted YBCS profile fields use the common defaults in section 1.4; unlisted S19 CombatantStats fields use the common defaults in section 1.4.

| Case | Y-A | Y-D | YBCS rolls | S-A | S-D | S RNG | Coverage |
|---|---|---|---|---|---|---|---|
| P01 | 100,100;0;100;10;20;T | 20;10 | 10/10 | 100;100;10;0.20 | 20;10;200;0 | 0.10/0.10 | baseline paired inputs |
| P02 | 20,20;0;100;10;0;T | 40;10 | 99/99 | 20;100;10;0 | 40;10;200;0 | 0.99/0.99 | defence exceeds offense / minimum bound |
| P03 | 10,10;0;100;10;0;F | 100;10 | 0/99 | 10;100;10;0 | 100;10;200;0 | 0.00/0.99 | YBCS unarmed defence bypass versus S19 defence |
| P04 | 51,52;0;100;10;0;T | 10;10 | 20/99 | 51;100;10;0 | 10;10;200;0 | 0.20/0.99 | floor midpoint input |
| P05 | 100,150;0;100;10;0;T | 25;10 | 30/99 | 125;100;10;0 | 25;10;200;0 | 0.30/0.99 | range-to-scalar controlled input |
| P06 | 100,100;0;0;10;0;T | 0;200 | 99/99 | 100;0;10;0 | 0;200;200;0 | 0.99/0.99 | YBCS zero-accuracy special case |
| P07 | 100,100;0;10;0;0;T | 0;20 | 4/99 | 100;10;0;0 | 0;20;200;0 | 0.04/0.99 | YBCS lower hit clamp |
| P08 | 100,100;0;200;10;0;T | 0;10 | 94/99 | 100;200;10;0 | 0;10;200;0 | 0.96/0.99 | YBCS upper hit clamp / S19 upper hit clamp |
| P09 | 100,100;0;60;10;0;T | 0;10 | 49/99 | 100;60;10;0 | 0;10;200;0 | 0.49/0.99 | below YBCS 50-percent boundary |
| P10 | 100,100;0;60;10;0;T | 0;10 | 50/99 | 100;60;10;0 | 0;10;200;0 | 0.95/0.99 | at/above hit boundary |
| P11 | 100,100;0;100;10;0;T | 0;10 | 0/0 | 100;100;10;0 | 0;10;200;0 | 0.00/0.00 | zero critical input |
| P12 | 100,100;0;100;10;200;T | 0;10 | 0/50 | 100;100;10;1.00 | 0;10;200;0 | 0.00/0.50 | YBCS 95% critical cap versus S19 0.35 cap |
| P13 | 100,100;0;100;10;25;T | 0;10 | 0/24 | 100;100;10;0.25 | 0;10;200;0 | 0.00/0.24 | below critical boundary |
| P14 | 100,100;0;100;10;25;T | 0;10 | 0/25 | 100;100;10;0.25 | 0;10;200;0 | 0.00/0.25 | exactly on strict critical boundary |
| P15 | 32767,32767;0;100;0;95;T | 0;0 | 0/0 | 32767;100;0;0.95 | 0;0;100;0 | 0.00/0.00 | signed-i16 damage cap versus S19 45%-HP strike cap |

## 4. M01–M15 — Fixture A authored source inputs

Notation:
- Attacker Ability tuple is [magic_accuracy / magic_evasion / magic_damage / magic_defense].
- Defender tuple is [cla / magic_defense].
- Magictbl Dist and Area are hexadecimal because the supplied parser reads those columns as hex; Att and EA/EB/EC are decimal.
- Element percentage is selected from magicatr using the defender cla column and target_is_special_monster=false.
- All A cases use base_effect=null.

| Case | Attacker Ability row | A attacker magic tuple | Defender Ability row | D [cla/magicDef] | Magictbl source row | Att / EA-EB-EC / Dist-Area | element % | Classifier |
|---|---|---|---|---|---|---|---:|---|
| M01 | 1004@266 见习巫师 | 180/30/30/30 | 104@6 见习水手 | 3/4 | 5201@92 火箭(Lv1) | 1 / 45-0-0 / 0x104-0x1 | 150 | direct |
| M02 | 1005@267 巫师 | 180/30/40/40 | 108@10 见习僧侣 | 7/8 | 5301@98 冰箭(Lv1) | 2 / 50-0-0 / 0x104-0x1 | 90 | direct |
| M03 | 1011@273 役使神 | 180/5/60/30 | 105@7 见习枪兵 | 4/0 | 7201@134 闪电火(Lv1) | 3 / 45-0-0 / 0x4-0x1 | 75 | direct |
| M04 | 1015@277 纱坦 | 180/5/100/50 | 109@11 见习巫师 | 9/0 | 9201@176 沙漠旋风(Lv1) | 4 / 45-0-0 / 0x4-0x1 | 110 | direct |
| M05 | 1023@285 麻左 | 180/5/100/50 | 500@102 士兵G | 0/0 | 1101@2 重击(Lv1) | 8 / 40-10-5 / 0x1-0x0 | 100 | direct |
| M06 | 1024@286 千步长 | 180/30/100/50 | 501@103 士兵F | 0/0 | 3101@44 飞枪(Lv1) | 9 / 40-0-0 / 0x32-0x30 | 100 | direct |
| M07 | 1030@292 贝拉斯 | 180/5/100/50 | 502@104 士兵E | 0/0 | 5101@86 连射(Lv1) | 10 / 35-0-0 / 0x104-0x0 | 100 | direct |
| M08 | 2004@297 见习巫师A | 180/5/50/30 | 104@6 见习水手 | 3/4 | 17101@333 闪电火(Lv1) | 1 / 15-0-0 / 0x4-0x0 | 150 | direct |
| M09 | 2005@298 巫师A | 180/5/60/40 | 105@7 见习枪兵 | 4/0 | 17102@334 闪电火(Lv2) | 1 / 18-0-0 / 0x4-0x0 | 100 | direct |
| M10 | 2104@315 见习巫师B | 180/5/60/35 | 108@10 见习僧侣 | 7/8 | 7202@135 闪电火(Lv2) | 3 / 51-0-0 / 0x4-0x1 | 110 | direct |
| M11 | 2105@316 巫师B | 180/5/70/45 | 109@11 见习巫师 | 9/0 | 7301@140 闪电暴风(Lv1) | 3 / 50-0-0 / 0x4-0x2 | 90 | direct |
| M12 | 2204@333 见习巫师C | 180/5/70/45 | 104@6 见习水手 | 3/4 | 9202@177 沙漠旋风(Lv2) | 4 / 52-0-0 / 0x4-0x1 | 100 | direct |
| M13 | 2205@334 巫师C | 180/5/80/55 | 105@7 见习枪兵 | 4/0 | 9206@181 沙漠旋风(Lv6) | 4 / 80-0-0 / 0x6-0x3 | 100 | direct |
| M14 | 2304@351 见习巫师D | 180/5/80/55 | 500@102 士兵G | 0/0 | 5302@99 冰箭(Lv2) | 2 / 56-0-0 / 0x104-0x1 | 100 | direct |
| M15 | 2305@352 巫师D | 180/5/100/65 | 501@103 士兵F | 0/0 | 19101@387 黑暗之帐(Lv1) | 122 / 5-10-0 / 0x2-0x0 | 100 | reject: not direct |

M15 is a negative classifier control. Att=122 is admitted by the direct classifier only for the pure EA-only row where EB=EC=0; this row has EB=10 and is not a direct-damage definition.

## 5. M01–M15 — Fixture B controlled magic inputs

Notation:
- Y-A = YBCS attacker [minimum_damage, maximum_damage; authored_damage].
- Y-D = YBCS defender magic_defense.
- base_effect=null means use definition EA. M14 explicitly overrides the source EA.
- S19 magicAttack is the controlled pre-defence offense input, not a calculated output. S19 magicDefense equals the same numeric defender defence input; maxHp is supplied for S19's own strike cap.
- S19 uses kind=magic, multiplier=1.0, critical=false. The S19 side has no elemental-percent input.

| Case | Y-A | Y-D | base_effect | elemental_percent | S19 [magicAttack/magicDefense/maxHp] | Coverage |
|---|---|---:|---|---:|---|---|
| M01 | 20,20; T | 10 | null (EA45) | 100 | 65/10/200 | paired neutral element input |
| M02 | 20,20; T | 10 | null (EA50) | 50 | 70/10/200 | reduced element percentage |
| M03 | 30,30; T | 20 | null (EA45) | 75 | 75/20/200 | reduced percentage and defence |
| M04 | 40,40; T | 100 | null (EA45) | 110 | 85/100/200 | defence exceeds pre-defence offense |
| M05 | 0,0; F | 0 | null (EA40) | 100 | 40/0/200 | no authored attacker magic damage |
| M06 | 51,52; T | 5 | null (EA40) | 100 | 91/5/200 | floor midpoint input |
| M07 | 100,100; T | 50 | null (EA35) | 1000 | 135/50/200 | percentage upper bound |
| M08 | 50,50; T | 4 | null (EA15) | 1 | 65/4/200 | percentage lower bound |
| M09 | 60,60; T | 0 | null (EA18) | 50 | 78/0/200 | integer-percent floor case |
| M10 | 60,60; T | 8 | null (EA51) | 75 | 111/8/200 | non-neutral percentage |
| M11 | 70,70; T | 0 | null (EA50) | 150 | 120/0/200 | percentage above neutral |
| M12 | 70,70; T | 4 | null (EA52) | 200 | 122/4/200 | high percentage |
| M13 | 80,80; T | 0 | null (EA80) | 100 | 160/0/50 | S19 HP-ratio cap input |
| M14 | 80,80; T | 0 | 60 (override EA56) | 1000 | 140/0/200 | explicit base_effect override and percentage upper bound |
| M15 | 100,100; T | 0 | null (EA5; EB10; EC0; Att122) | 100 | not paired | negative classifier control; resolver must not be invoked |

For every M B case, the YBCS attacker profile also sets magic_accuracy=100, magic_evasion=0, source_kind=character and equipped_item_ids=(). The YBCS defender sets minimum_damage=maximum_damage=0, magic_accuracy=0, magic_evasion=0, source_kind=ability, authored_damage=false and equipped_item_ids=(). These fields make the profile objects complete; the supplied YBCS direct-magic damage resolver consumes the authored damage midpoint, defender magic_defense, definition/base_effect and elemental_percent, not magic accuracy/evasion.

## 6. Explicit non-claims and Batch 2 handoff

1. Fixture A is built from actual source records, but its table-derived elemental_percent is a fixture input because the production lookup-to-resolver caller is still absent.
2. Fixture B supplies effective values directly; it does not assert that YBCS or S19 derives those values from the same equipment, growth or attribute-point model.
3. YBCS physical hit chance and S19 hitChance use different conversions. P06–P10 expose that difference rather than forcing equal probabilities.
4. YBCS physical critical rate is an integer percent with a 95 cap and x2 critical damage. S19 uses fractional criticalChance, criticalResistance, a 0.35 cap and x1.5 multiplier. P11–P15 preserve those differences.
5. YBCS direct magic subtracts full magic defence and then applies elemental_percent. S19 controlled magic uses its 0.65 defence coefficient and has no elemental field. M01–M14 expose those differences.
6. YBCS magic accuracy/evasion are retained in source profiles, but no supplied direct-magic hit resolver consumes them. No YBCS magic-critical rule is inferred.
7. S19 SKILL_POLICY multipliers, hit counts, DOT and support behavior are not treated as recovered Magictbl formulas. Fixture B uses explicit multiplier 1.0 for controlled arithmetic.
8. No expected values, formula outputs, statistical distributions or cross-engine conclusions are included. Batch 2 owns all formula execution and result comparison.
