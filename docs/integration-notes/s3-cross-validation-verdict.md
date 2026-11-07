# S3 Cross-Validation Verdict — Batches 0–4

- Task: auto-4-1
- Final batch: Batch 5 — adjudication document only.
- Scope: consolidate evidence and results from Batches 0–4. This document records findings and owner options; it does not implement any option.
- Target repository: vileosbot-bot/lapis-rebuild
- Working branch: docs/s3-damage-cross-validation
- Evidence rule: all YBCS code/resource observations and outputs remain RECOVERED_SECONDARY / reconstruction reference. S19 behavior remains RECONSTRUCTION_POLICY. No YBCS item is promoted to VERIFIED.
- Change boundary: no S19 code, balance tuning, simulator, class/skill catalog, Plan.md, main branch or raw resource binary is changed by this batch.

## 1. Executive verdict

The evidence supports sharing a limited set of authored source fields and their identifiers, but it does not support merging the two combat formula implementations or treating YBCS as the recovered retail-server formula.

The 19 adjudication items below are assigned only one of the four permitted categories:

| Category | Count | Meaning |
|---|---:|---|
| SHARED_CONFIRMED | 2 | Authored fields or source mappings match exactly within the tested scope and can share a data contract. |
| KEEP_INDEPENDENT | 9 | The two engines implement distinct policies; retain and label each policy rather than forcing equivalence. |
| OWNER_DECISION | 4 | The project owner must choose whether to change S19 or fund a separate workstream. Both change and no-change consequences are recorded. |
| EVIDENCE_GAP | 4 | Available sources do not establish the missing production behavior or mapping. Preserve unknowns; do not infer. |
| **Total** | **19** | |

### Overall recommendation

1. Reuse the confirmed authored class/skill field mappings as source-data alignment only.
2. Keep YBCS physical and magic arithmetic separate from S19 reconstruction policy unless the project owner explicitly approves a new policy.
3. Do not change S19 as part of this S3 stream. The S19 EA/EB path, M15 behavior, enemy-stat mapping and party simulation questions are owner decisions.
4. Keep the missing YBCS magic hit/critical behavior and production elemental lookup caller marked EVIDENCE_GAP.
5. Treat all encounter outcomes as comparisons between two independent reconstructions, not as evidence that either side reproduces the retired retail server.

## 2. Evidence baseline from Batches 0–1

### 2.1 Resource inventory

The supplied Set.lib archive was decompressed successfully. Its 12 members included ability.atr (724 data records), itemtbl.atr (2,073), levelabl.atr (1,397), Magictbl.atr (460), magicatr.atr (7), Magicptn.atr (281), solskill.atr (90), tileattb.atr (27), tileattr.atr (27), Effectptn.atr (8), SysHelp.atr and zone_name.txt. The archive and extracted members remain outside the repository.

The ability.atr header has 46 fields. The inspected data rows have either 45 or 46 fields; all 724 records have unique Ability IDs and valid numeric values at the physical/magic indexes used by the supplied parsers. The itemtbl.atr inspection was limited to row count and 55-column shape; item semantics remain in the S4 stream.

### 2.2 Authored mapping scope

The exact authored row comparison covered 20 shared playable class IDs (ten swordsman and ten wizard stages) and six S19 MVP skill IDs (1101, 1201, 1301, 19101, 19201, 19301). These comparisons establish authored-field alignment only. They do not establish equal profile construction, hit/critical policies, skill execution or damage formulas.

## 3. Adjudication items

### V01 — Shared authored class anchors

**Finding.** For the 20 shared playable class IDs, the Set.lib ability.atr rows match the corresponding S19 class JSON values for HP, MP, move, hit, magic_hit, range and class_name_raw. The S19 class helper copies those fields into authored class anchors.

**Evidence source.** Batch 0–1: s3-source-inventory.md §8.5; s3-attribute-mapping.csv; s3-fixture-spec.md §1.2–1.3.

**Quantified impact.** 20/20 shared class IDs matched across seven listed fields. The source archive contains 724 Ability records, but this join is not generalized to all 724 IDs.

**裁定类别：SHARED_CONFIRMED**

**给项目所有者的建议选项。**
- Recommended: share the raw authored field schema and class-ID join for these 20 tested classes.
- Keep level growth, equipment, allocated attributes and final CombatantStats construction as engine-specific policies unless separately verified.

### V02 — Shared authored MVP skill fields

**Finding.** Six shared S19 MVP skill IDs have matching authored Magictbl fields: Att, Dist, Area, MP, Time, Team, Unit, EA, EB, EC, TICK, LVPT, MagicPtn, iconindex, Iter and explanation. Dist/Area parsing as hexadecimal and the remaining listed numeric fields as decimal are preserved in the mapping.

**Evidence source.** Batch 1: s3-source-inventory.md §8.5; s3-attribute-mapping.csv; s3-fixture-spec.md §1.3.

**Quantified impact.** 6/6 tested skill rows match on the listed authored fields. This does not prove equal skill classification, support behavior, multiplier, hit count, DOT or damage execution.

**裁定类别：SHARED_CONFIRMED**

**给项目所有者的建议选项。**
- Recommended: share the authored skill data schema and exact source identifiers for these six rows.
- Keep runtime policy, target handling and damage execution separate until an explicit mapping is established.

### V03 — Physical base-damage formula

**Finding.** YBCS uses the integer midpoint of minimum/maximum physical damage, then applies its offline defence and critical policy. S19 computes attack minus 0.65 times defence, rounds with Math.round, and then applies its critical policy. These are different formula contracts.

**Evidence source.** Batch 2: s3-physical-cross-validation.csv; s3-source-inventory.md §9.2–9.6.

**Quantified impact.**
- Fixture A: 6/15 final-damage matches and 9/15 differences; sampled hit and critical decisions both match 15/15. Some equal final outcomes are shared misses, not proof that potential damage arithmetic is equal.
- Fixture B: 2/15 final-damage matches and 13/15 differences.
- Largest controlled physical delta: P15, YBCS 32,767 vs S19 45, delta +32,722. Largest authored delta: P14, 242 vs 67, delta +175.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: retain both formulas as named, versioned policies and expose their provenance in comparison output.
- Do not replace S19's formula with YBCS arithmetic based on this evidence; YBCS is RECOVERED_SECONDARY, not a recovered retail-server oracle.

### V04 — Physical defence application and unarmed gate

**Finding.** YBCS subtracts the defender's full physical defence only when the attacker's authored_damage flag is true. Its unarmed fallback can bypass that defence. S19 applies its 0.65 defence coefficient to the attacker's attack value regardless of the YBCS authored_damage gate.

**Evidence source.** Batch 2: s3-physical-cross-validation.csv P01–P05; s3-fixture-spec.md §1.4; s3-source-inventory.md §9.2–9.6.

**Quantified impact.** P03 controlled input deliberately sets YBCS authored_damage=false with a 100-point defender defence. YBCS keeps the 10-point fallback path while S19 applies its defence coefficient. This is a designed branch contrast, not a matched final-value assertion.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: preserve YBCS's authored/unarmed gate and S19's reconstruction defence rule as separate policies.
- If a common profile contract is desired, share the raw fields but retain an explicit authored_damage/defence-policy switch; do not silently normalize the gate.

### V05 — Physical hit and evasion

**Finding.** YBCS physical hit chance is 100% when attacker physical_accuracy is zero; otherwise it clamps accuracy minus defender evasion to 5–95%. S19 uses clamp(0.84 + (accuracy − evasion) × 0.002, 0.65, 0.97).

**Evidence source.** Batch 2: s3-physical-cross-validation.csv P06–P10; s3-source-inventory.md §9.2, §9.4 and §9.6.

**Quantified impact.**
- Fixture A sampled hit outcomes match 15/15, although YBCS positive-accuracy chance is 95% while S19 can reach 97%.
- Fixture B sampled hit outcomes match 14/15. P06 differs: YBCS zero-accuracy special case is 100%, while S19 is at its 65% minimum; the shared selected roll is 99/0.99, so YBCS hits and S19 misses.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: keep the two probability conversions and report both chance and sampled outcome.
- Do not infer YBCS magic hit behavior from this physical rule.

### V06 — Critical chance, decision and multiplier

**Finding.** YBCS treats critical_rate as an integer percentage clamped to 0–95 and doubles a critical hit. S19 subtracts criticalResistance from fractional criticalChance, clamps to 0–0.35 and uses a 1.5 multiplier.

**Evidence source.** Batch 2: s3-physical-cross-validation.csv P11–P14; s3-source-inventory.md §9.2–9.6.

**Quantified impact.** Fixture B critical outcomes match 14/15. P12 differs at the selected roll boundary: YBCS's 95% cap accepts roll 50, while S19's 35% cap rejects random 0.50. Fixture A sampled critical outcomes match 15/15, but the damage multipliers remain different.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: retain YBCS integer-percent/x2 and S19 fractional-cap/x1.5 as separate policy contracts.
- Any S19 critical tuning change should be a separately approved balance change, not an automatic consequence of this comparison.

### V07 — Physical single-hit damage cap

**Finding.** YBCS caps a physical hit at signed-i16 maximum 32,767. S19 caps a single strike at 45% of the target's max HP, with a minimum of one.

**Evidence source.** Batch 2: s3-physical-cross-validation.csv P15; s3-source-inventory.md §9.2, §9.5 and §9.6.

**Quantified impact.** Fixture B P15: YBCS final damage 32,767; S19 target HP 100 gives a 45-point cap; delta +32,722.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: keep protocol/value-bound and balance/target-HP-bound caps distinct.
- If S19 cap tuning changes, assess encounter balance independently; do not copy the YBCS numeric cap without owner approval.

### V08 — Rounding and integer conversion order

**Finding.** YBCS physical midpoint uses integer floor division. Its elemental helper also uses integer floor division after applying a percentage. S19 uses Math.round after defence and after critical multiplication. The locations of integer conversion are part of each policy.

**Evidence source.** Batch 2: s3-physical-cross-validation.csv P04–P05 and P15; Batch 3: s3-magic-cross-validation.csv M01–M14; s3-source-inventory.md §9.2 and §10.4.

**Quantified impact.** Physical P04–P05 use a 51/52 range to expose midpoint conversion. Magic M01 has YBCS 71 × 150 // 100 = 106, while S19's 65 − 0.65 × 10 = 58.5 rounds to 59. These values also include different defence and element policies, so they isolate the conversion point but do not make rounding the sole cause of the total delta.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: document each rounding point explicitly and test boundary values.
- Do not force one rounding convention across both engines unless the project owner chooses a new common arithmetic specification.

### V09 — Magic base damage and defence formula

**Finding.** YBCS direct magic computes EA (or explicit base_effect override) plus authored magic midpoint, subtracts full magic defence, then applies the explicit elemental percentage. S19 has no general authored EA damage path in the supplied balance resolver; its controlled magic arithmetic uses magicAttack minus 0.65 times magicDefense, followed by rounding and its HP-ratio cap.

**Evidence source.** Batch 3: s3-magic-cross-validation.csv; s3-source-inventory.md §10.3–10.5; s3-fixture-spec.md §1.3 and §1.5.

**Quantified impact.**
- Fixture A: YBCS M01–M14 produce numeric results, but 14 cases are not comparable to an S19 magic skill route (13 old IDs lack a policy entry; M05/1101 is physical). M15 is a separate path divergence.
- Fixture B: M01–M14 have 1 final-damage match and 13 differences; M15 is unpaired.
- Largest controlled deltas: M14 +1,310; M07 +760; M12 +146.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: retain the YBCS EA-plus-authored-midpoint resolver as a RECOVERED_SECONDARY offline policy and S19's magicAttack-based reconstruction policy as RECONSTRUCTION_POLICY.
- Do not describe the controlled deterministicDamage comparison as an S19 authored-EA implementation or as a retail formula comparison.

### V10 — Element-percent order in the supplied YBCS offline policy

**Finding.** The supplied YBCS offline resolver applies the element percentage after full magic-defence subtraction. The helper multiplies the defended integer by the percentage, floor-divides by 100, then clamps to 1–32,767. S19 has no corresponding element-percent stage in CombatantStats or deterministicDamage.

**Evidence source.** Batch 1: s3-source-inventory.md §8.6; Batch 3: s3-magic-cross-validation.csv and s3-source-inventory.md §10.4; s3-fixture-spec.md §1.3 and §1.5.

**Quantified impact.** Fixture A M01: EA45 + authored magic30 = 75; minus magic defence4 = 71; 71 × 150 // 100 = 106. Controlled M14 applies 1,000% after defence and reaches 1,400 before the S19 side's separate cap. The controlled M14 final delta is +1,310.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: preserve this exact ordering as the supplied YBCS offline implementation's behavior, and preserve the absence of an S19 element stage.
- Do not treat this ordering as proof of the retired retail server's behavior; the production caller and retail authority remain separate evidence questions.

### V11 — Production element lookup-to-resolver caller

**Finding.** The old magic attribute table helper and the YBCS damage resolver both exist, but the supplied source set does not contain the production call site that obtains a table percentage and passes it to the resolver. Batch 3 materialized the percentage as an explicit fixture input.

**Evidence source.** Batch 0–1: s3-source-inventory.md §8.6; Batch 3: s3-magic-cross-validation.csv and s3-source-inventory.md §10.2, §10.4 and §10.6.

**Quantified impact.** All Fixture A/B magic percentage values in Batch 3 and the neutral 100% values in Batch 4 are explicit fixture inputs. They do not prove production wiring. Batch 4's neutral 100% means element order was not a numerical driver in that encounter.

**裁定类别：EVIDENCE_GAP**

**给项目所有者的建议选项。**
- Recommended: keep the production caller marked unknown until the actual orchestration/call site is recovered.
- Alternatively, authorize a separate read-only source hunt for the caller and its target-profession/special-monster selection inputs. Do not patch a guessed caller into YBCS or S19.

### V12 — S19 has no authored EA damage path

**Finding.** S19 skill metadata preserves authored EA/EB/EC, but the supplied balance resolver uses SKILL_POLICY kind, multiplier and hit count for skill execution. The skill lookup returns policy and authored MP/provenance; resolveSkillAttack does not calculate damage from authored EA. The controlled Batch 3 magic path therefore calls deterministicDamage directly rather than claiming an EA-derived resolveSkillAttack path.

**Evidence source.** Batch 3: s3-magic-cross-validation.csv; s3-source-inventory.md §10.1, §10.5 and §10.6; data/skills/mvp.json.

**Quantified impact.** Fixture A has 14 cases without a paired S19 magic skill route: 13 old IDs have no S19 SKILL_POLICY entry and M05/1101 is classified physical. Fixture B can compare 14 controlled arithmetic cases, but that is not an authored EA skill-path test.

**裁定类别：OWNER_DECISION**

**给项目所有者的建议选项。**
- **改：** authorize a distinct authored-EA skill execution path, with explicit mapping from Att/EA/EB/EC and tests for direct damage, support, recovery and non-direct classifications. Cost: new implementation and test surface, a second skill policy path to maintain, balance review, and potential behavior changes for existing skills.
- **不改：** retain SKILL_POLICY as the only S19 damage execution policy. Cost: old Magictbl authored skills remain unpaired or require explicit per-skill reconstruction mappings; Batch 3 Fixture A remains mostly not comparable.
- This batch does not choose either option and does not modify S19.

### V13 — Fixture A skill mapping gap

**Finding.** Fixture A uses actual old Ability and Magictbl rows. Most old skill IDs do not have matching S19 SKILL_POLICY entries. A shared numeric ID is not enough: M05/1101 exists in S19 but its policy kind is physical while the old direct classifier accepts it as direct magic.

**Evidence source.** Batch 1: s3-fixture-spec.md §1.3 and §4; Batch 3: s3-magic-cross-validation.csv and s3-source-inventory.md §10.2.

**Quantified impact.** Of 15 authored magic cases: 13 IDs have no S19 policy; one (M05/1101) has a skill-kind mismatch; one (M15/19101) is a path divergence. Thus 14 are not comparable as paired numeric magic outcomes, one is a path divergence, and zero are paired numeric matches or divergences.

**裁定类别：EVIDENCE_GAP**

**给项目所有者的建议选项。**
- Recommended: keep each missing mapping explicit and do not manufacture an S19 policy row from the old skill ID alone.
- If exact authored skill comparisons are required, authorize a separate skill-mapping inventory with per-ID behavior evidence and owner-approved mappings.

### V14 — M15 EB isolation path divergence

**Finding.** M15 is Magictbl 19101 with Att=122, EA=5, EB=10, EC=0. YBCS direct-offensive classification requires EB=EC=0 for Att=122 and rejects the definition before damage arithmetic. S19 SKILL_POLICY[19101] is kind=magic, multiplier 0.45, hits=1, with a non-null accuracy-debuff support descriptor; resolveSkillAttack enters the magic damage path and does not inspect authored EB.

**Evidence source.** Batch 3: s3-magic-cross-validation.csv M15; s3-source-inventory.md §10.2 and §10.5; data/skills/mvp.json. The project owner's independent battle.ts check is recorded in the Batch 3 acceptance context.

**Quantified impact.** YBCS produces no damage result and raises “magic 19101 is not a direct offensive definition”. S19 enters the path and produces 45 in the comparison-only authored-field projection. This is a path divergence, not a paired damage delta.

**裁定类别：OWNER_DECISION**

**给项目所有者的建议选项。**
- **改：** add an explicit EB/EC/support classifier or route guard to S19 so a non-direct support definition cannot enter the direct-damage path. Cost: S19 code and tests change; existing 19101 behavior may change and needs regression review against battle.ts blind/debuff handling.
- **不改：** preserve current S19 SKILL_POLICY behavior. Cost: the path divergence remains; the S19 route must be documented as reconstruction policy rather than old direct-magic semantics.
- The Batch 4/5 S3 stream does not implement this change.

### V15 — YBCS magic hit and critical rules

**Finding.** The supplied YBCS direct-magic resolver calculates deterministic damage only. No supplied magic hit-chance or magic critical-chance resolver is available. Physical hit/critical functions must not be reused as magic rules.

**Evidence source.** Batch 0–1: s3-source-inventory.md §8.4 and §8.6; Batch 3: s3-magic-cross-validation.csv and s3-source-inventory.md §10.1 and §10.6; Batch 4: s3-full-simulation-report.md §3 and §6.

**Quantified impact.** Batch 3 M01–M14 direct damage values are deterministic resolver outputs, not hit/critical-resolved outcomes. In Batch 4, YBCS direct magic is marked hit/critical N/A for E1-01, E2-01 and E1-02; S19 independently reports magic hit chance 0.832 and critical chance 0.03. No probability delta can be computed for the missing YBCS side.

**裁定类别：EVIDENCE_GAP**

**给项目所有者的建议选项。**
- Recommended: preserve magic hit and critical as unknown and report YBCS direct damage as a deterministic resolver result only.
- If these mechanics are required, authorize a separate evidence-gathering task; do not borrow the physical probability policy or infer a magic rule from the current fixture outcomes.

### V16 — Enemy HP and combatant input construction

**Finding.** Batch 4 intentionally did not force identical final actor stats. YBCS enemy HP came from authored Ability rows, while S19 enemies came from generic reconstructed caster profiles. Player physical inputs also differ: YBCS Ability 100 takes its unarmed fallback path, while S19 playerStats builds its family/level-based attack profile.

**Evidence source.** Batch 4: s3-full-simulation-report.md §§1–3 and §6–7; s3-source-inventory.md §11.2–11.4.

**Quantified impact.**
- YBCS enemies: Ability 500 HP100 and Ability 502 HP150.
- S19 generic caster enemies: HP71 and HP71.
- YBCS player HP125; S19 player HP125, but the physical attack profile is not equal (YBCS unarmed fallback 10 versus S19 attack28).
- The encounter ends YBCS defeat at 3.8s/round 2 versus S19 victory at 10.15s/round 7. The HP/profile mismatch contributes to outcome interpretation and must not be removed from the record.

**裁定类别：OWNER_DECISION**

**给项目所有者的建议选项。**
- **改：** authorize a comparison-only authored-enemy adapter for S19, using the same source Ability HP and selected combat anchors. Cost: new adapters and fixtures, added coupling to old resource IDs, and a deliberate choice about which fields override S19 family/rank/role tuning.
- **不改：** retain generic S19 enemyStats and current family/rank/role balance. Cost: full encounter outcomes remain comparisons of different actor-construction policies, not like-for-like authored enemy simulations.
- Either choice must remain explicit in reports; do not silently alter either engine's inputs.

### V17 — Two-player party simulation as a separate workstream

**Finding.** The current S19 simulateCombat scenario supports one playerClassId and one to eight enemies. It does not accept a two-player party or a player roster. Batch 4 therefore used one authored swordsman versus two caster enemies, consistent with the owner's acceptance of the 1v2 adjustment.

**Evidence source.** Batch 4: s3-full-simulation-report.md §§1.1, 7; s3-source-inventory.md §11.1 and §11.4.

**Quantified impact.** Batch 4 covered one player and two enemies, not the initially suggested 2v2. It ran 7 S19 player actions and 6 enemy actions; the YBCS comparison harness ran 2 player actions and 3 enemy actions before defeat.

**裁定类别：OWNER_DECISION**

**给项目所有者的建议选项。**
- **改：** authorize a separate party-simulation workstream with a player roster, turn ordering, target selection, shared RNG contract and party-level terminal conditions. Cost: new simulator architecture, broader test matrix and a separate balance/behavior review.
- **不改：** keep the current single-player S19 simulator and treat party simulation as outside S3. Cost: no 2v2 full-encounter comparison can be claimed from the current simulator.
- Do not expand the current S3 scope by silently adding a party scheduler.

### V18 — Full encounter outcome divergence

**Finding.** The Batch 4 resolver-combination harness and the S19 native simulateCombat flow reach different terminal outcomes under the documented encounter setup. This is an integrated consequence of the previously listed formula, input-mapping and missing-mechanic differences; it is not a new standalone formula.

**Evidence source.** Batch 4: s3-full-simulation-report.md §§3–5 and s3-source-inventory.md §11.3–11.4.

**Quantified impact.**
- YBCS: defeat at 3.8 seconds / round 2; 2 player actions, 3 enemy actions; 30 damage dealt, 125 damage received; player HP0; enemy HP70/150.
- S19: victory at 10.15 seconds / round 7; 7 player actions, 6 enemy actions; 142 damage dealt, 90 damage received; player HP35; both enemies defeated.
- First divergence is P-01: YBCS20 versus S19 31, delta -11, with the same selected hit/critical roll pair.
- The largest common-event resolved-damage difference is +30 on each of E1-01, E2-01 and E1-02 (YBCS direct EA45 magic45 versus S19 generic caster magic15). E1-02 applies only 35 YBCS damage due to overkill clipping.

**裁定类别：KEEP_INDEPENDENT**

**给项目所有者的建议选项。**
- Recommended: retain this result as a comparative regression scenario with the two input policies and terminal outcomes visible.
- Do not use the win/loss result alone to declare either engine correct or to tune S19 toward YBCS.

### V19 — Retired retail-server formula authority

**Finding.** The YBCS source describes its physical and magic calculations as explicit offline policy. The old battle wire exposes requests and server-owned absolute HP updates, not a recoverable retail-server damage formula. Neither the supplied old resource tables nor the current reconstruction provide authoritative proof of the retired retail server's complete combat arithmetic.

**Evidence source.** Batch 0: s3-source-inventory.md source inventory and source-module notes; Batch 2: s3-source-inventory.md §9.1–9.2; Batch 3: s3-source-inventory.md §10.1 and §10.6; ybcs_physical_combat.py module docstring; ybcs_battle_wire.py authoritative-vitals boundary.

**Quantified impact.** All YBCS calculations across P01–P15, M01–M15 and Batch 4 remain RECOVERED_SECONDARY. No test count or exact numeric match upgrades that evidence level. S19 remains RECONSTRUCTION_POLICY.

**裁定类别：EVIDENCE_GAP**

**给项目所有者的建议选项。**
- Recommended: preserve the provenance boundary and describe all results as independent reconstruction comparisons.
- If retail-server truth is required, authorize a separate primary-evidence effort (for example, authoritative server source or independently validated runtime evidence). Until then, do not mark either implementation VERIFIED.

## 4. Owner decision register

The following items require explicit project-owner disposition. No choice is made by this Batch 5 document.

| Item | Decision question | Change option | No-change option |
|---|---|---|---|
| V12 | Add an S19 authored EA path? | Implement and test a second authored-data execution path; cost is code, policy and regression maintenance. | Keep SKILL_POLICY-only damage; cost is continued authored-skill non-comparability. |
| V14 | Guard S19 M15 by EB/EC/support semantics? | Add classification/route guard; cost is code change and behavior regression review. | Preserve current policy; cost is known YBCS/S19 path divergence. |
| V16 | Align S19 enemy profiles to authored Ability inputs for comparisons? | Add explicit comparison adapter; cost is resource coupling and override rules. | Keep generic S19 enemyStats; cost is non-identical enemy HP/profile inputs. |
| V17 | Build two-player party simulation? | Create a separate party-simulation workstream; cost is architecture, tests and balance review. | Keep single-player simulator; cost is no native 2v2 comparison. |

## 5. Non-negotiable evidence and change boundaries

1. YBCS remains RECOVERED_SECONDARY / reconstruction reference in every file and report. Do not label it VERIFIED.
2. S19 remains RECONSTRUCTION_POLICY.
3. The production element lookup-to-resolver caller remains EVIDENCE_GAP.
4. YBCS magic hit and magic critical remain EVIDENCE_GAP.
5. Fixture A's 14 non-comparable magic skill cases remain mapping gaps, not formula wins or losses.
6. M15 remains a confirmed path divergence; this document records options but does not change S19.
7. No S19 code, balance tuning, simulator, catalog or gameplay code is changed by S3.
8. Plan.md is not modified.
9. main is not modified. The branch remains a draft PR until the project owner or maintainer performs the separately authorized merge.
10. Set.lib and extracted .atr binaries remain outside the repository.

## 6. Batch evidence index

| Batch | Primary artifacts | What they establish |
|---|---|---|
| Batch 0 | s3-source-inventory.md; s3-attribute-mapping.csv | Formula source inventory, dependency graph, parser entrypoints, initial field mapping and elemental-percent helper boundary. |
| Batch 1 | s3-source-inventory.md; s3-attribute-mapping.csv; s3-fixture-spec.md | Set.lib member/record verification, ability field indexes, 20 class and six skill authored joins, Fixture A/B schema and 30 input cases. |
| Batch 2 | s3-physical-cross-validation.csv; s3-source-inventory.md | P01–P15 physical formula comparisons, separate A/B counts and registered physical difference categories. |
| Batch 3 | s3-magic-cross-validation.csv; s3-source-inventory.md | M01–M15 magic comparisons, element order, S19 EA path finding, skill mapping gaps and M15 EB isolation. |
| Batch 4 | s3-full-simulation-report.md; s3-source-inventory.md | 1v2 full encounter trace, fixed seed/roll handling, aggregate metrics, terminal outcomes and integrated divergence attribution. |
| Batch 5 | s3-cross-validation-verdict.md | Consolidated 19-item verdict and explicit owner decision register. |

## 7. S3 closeout

S3 work across Batches 0–5 is complete at the documentation and comparison level. No implementation change is implied by the verdict categories. The next action, if any, is for the project owner to disposition V12, V14, V16 and V17, and for the repository maintainer to review and merge PR #2 under the project's normal process.

This document is the final S3 batch. No Batch 6 or other follow-on task is started or implied.
