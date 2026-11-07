# S3 Full Combat Simulation Comparison — Batch 4

- Request: auto-4-1
- Batch: 4 — complete encounter simulation and divergence attribution.
- Evidence: YBCS source/resource and all YBCS outcomes remain RECOVERED_SECONDARY; S19 behavior remains RECONSTRUCTION_POLICY.
- Scope: one authored swordsman against two caster enemies; physical player actions and magic enemy actions; both engines run to their own terminal state.
- Result: YBCS defeat at 3.8 seconds / round 2; S19 victory at 10.15 seconds / round 7.
- No S19 code, tuning, simulator, catalog or gameplay file was changed. The local trace harness and fixture adapters are not committed.

## 1. Scenario definition

### 1.1 Why this is a 1-vs-2 scenario

The repository's current S19 simulateCombat scenario type accepts one playerClassId and enemyCount 1..8. It has no party-member array or two-player turn scheduler. To avoid inventing a new S19 production rule, Batch 4 uses the native supported shape: one authored player against two enemies. The player is the shared authored swordsman class / Ability ID 100. The two enemy source identities are Ability IDs 500 and 502.

This is a scope constraint of the existing S19 simulator, not a claim that the game itself only supports one allied unit.

### 1.2 Source actors and action decisions

| Actor | YBCS source input / action | S19 input / action |
|---|---|---|
| Player | Set.lib ability.atr Ability 100; unarmed physical profile; basic physical action | S19 playerStats(100, level 1); useSkills=false; basic physical resolveAttack |
| Enemy 1 | Ability 500; direct Magictbl definition 5201, 火箭(Lv1), Att=1, EA=45 | enemyStats(level 1, rank normal, role caster); generic magic resolveAttack |
| Enemy 2 | Ability 502; direct Magictbl definition 7201, 闪电火(Lv1), Att=3, EA=45 | enemyStats(level 1, rank normal, role caster); generic magic resolveAttack |

Decision policy for both sides:
- Player always targets the first living enemy in original enemy order.
- Each enemy targets the sole player.
- Player action cadence is 1.45 seconds.
- Enemy 1 first acts at 1.90 seconds; enemy 2 first acts at 2.033 seconds (1.90 × (1 + 0.07)). Subsequent actions use the same S19 enemy cadence/stagger rule.
- At a timestamp, player action is processed first if due, then enemies in original index order.
- Stop when player HP reaches zero, all enemies are defeated, or the 120-second simulation timeout is reached.

YBCS enemy spell assignment (5201 for Ability 500 and 7201 for Ability 502) is an explicit deterministic test action script. It is not recovered enemy AI or a claim about native enemy skill selection. S19 has no matching SKILL_POLICY rows for old Magictbl IDs 5201/7201; therefore its enemy actions use the generic caster magic attack path, not an invented EA skill route.

### 1.3 Fixed seed and roll sequence

- Seed: 1.
- RNG source: the exact xorshift32 seededRandom implementation in combat-balance-simulator.ts (lines 61–70).
- The S19 trace runner records the actual random values consumed by each native-scheduler action. The traced S19 summary was checked against the repository's simulateCombat result for the same scenario and seed; victory, duration, remaining HP, player/enemy action counts, damage dealt and damage taken all match exactly.
- For every event executed by both engines, YBCS receives the exact same event-specific hit/critical roll pair recorded from S19. All five shared event IDs have byte-for-byte equal numeric roll pairs.
- YBCS direct magic reserves the same event pair but does not consume it: the supplied YBCS direct-magic resolver has no magic hit/critical function. This is explicitly EVIDENCE_GAP, not an inferred 100% hit rule.
- Because YBCS terminates earlier, it does not execute the later S19-only events. No missing event or roll is fabricated.

## 2. Effective actor inputs

### 2.1 YBCS — RECOVERED_SECONDARY

| Actor | HP | Physical profile | Magic profile / action |
|---|---:|---|---|
| Player Ability 100 | 125 | min=max 10 (unarmed fallback), accuracy 160, evasion 2, critical 2%, defence 5, authored_damage=false | magic defence 0; target profession selector 0 |
| Enemy Ability 500 | 100 | authored physical damage 44, physical defence 27 | magic damage 0, authored_damage=false; casts 5201 / EA45 |
| Enemy Ability 502 | 150 | authored physical damage 60, physical defence 35 | magic damage 0, authored_damage=false; casts 7201 / EA45 |

YBCS direct magic:
- Ability 500 uses Magictbl 5201 (Att=1, EA=45, EB=0, EC=0).
- Ability 502 uses Magictbl 7201 (Att=3, EA=45, EB=0, EC=0).
- The target is Ability 100, whose profession selector is 0.
- The fixture materialized the magicatr lookup directly using percent_for_definition_attack; both selected rows return 100%.
- The production lookup-to-resolver caller remains EVIDENCE_GAP. This batch passes the table result explicitly to the resolver; it does not claim the missing production wiring has been recovered.

### 2.2 S19 — RECONSTRUCTION_POLICY

Player class 100, level 1, built by playerStats:
- HP 125; MP 100.
- attack 28; defence 16; magicAttack 12; magicDefense 12.
- accuracy 160; magicAccuracy 160; evasion 158.
- criticalChance 0.10; criticalResistance 0.02; critical multiplier 1.5.

Both S19 enemies use enemyStats(level 1, rank normal, role caster):
- HP 71; attack 14; defence 9; magicAttack 23; magicDefense 13.
- accuracy 154; magicAccuracy 154; evasion 153.
- criticalChance 0.05; criticalResistance 0; critical multiplier 1.5.

The S19 enemies are generic reconstruction caster profiles. Ability IDs 500 and 502 label the paired encounter slots; their YBCS authored HP values (100 and 150) are not copied into S19. This HP/profile difference is an explicit INPUT_MAPPING distinction.

The local test harness supplied the exact class-100 authored row values from data/classes/swordsman.json to the class-catalog dependency. The S19 balance and simulator source were used read-only. The harness adapter is local-only and is not committed.

## 3. Full event-by-event comparison

Delta is YBCS resolved damage minus S19 resolved damage. For events that both engines execute, the same event-specific roll pair is used. HP values are shown as current HP before → after the event.

| Round | Event / time | Actor / action | YBCS result and HP | S19 result and HP | Delta | Difference classification |
|---:|---|---|---|---|---:|---|
| 1 | P-01 / 1.450s | Player physical | Hit + critical; 20 applied. Enemy 500: 100→80; player: 125 | Hit + critical; 31 applied. Enemy 500: 71→40; player: 125 | -11 | FORMULA; CRITICAL; CLAMP_CAP; INPUT_MAPPING |
| 1 | E1-01 / 1.900s | Enemy 500 magic | 5201 EA45; 45 applied; magic hit/crit N/A (EVIDENCE_GAP). Player: 125→80 | Magic hit, noncritical; 15 applied. Player: 125→110 | +30 | FORMULA; INPUT_MAPPING; HIT_EVASION:EVIDENCE_GAP; CRITICAL:EVIDENCE_GAP |
| 1 | E2-01 / 2.033s | Enemy 502 magic | 7201 EA45; 45 applied; magic hit/crit N/A (EVIDENCE_GAP). Player: 80→35 | Magic hit, noncritical; 15 applied. Player: 110→95 | +30 | FORMULA; INPUT_MAPPING; HIT_EVASION:EVIDENCE_GAP; CRITICAL:EVIDENCE_GAP |
| 2 | P-02 / 2.900s | Player physical | Hit, noncritical; 10 applied. Enemy 500: 80→70; player: 35 | Hit, noncritical; 22 applied. Enemy 500: 40→18; player: 95 | -12 | FORMULA; HIT_EVASION; INPUT_MAPPING |
| 2 | E1-02 / 3.800s | Enemy 500 magic | 5201 EA45; resolved 45, only 35 applied (overkill); player: 35→0 | Magic hit, noncritical; 15 applied. Player: 95→80 | +30 resolved / +20 applied | FORMULA; INPUT_MAPPING; HIT_EVASION:EVIDENCE_GAP; CRITICAL:EVIDENCE_GAP |
| 2 | E2-02 / 4.066s | Enemy 502 magic | Not executed: YBCS player already defeated | Magic hit, noncritical; 15 applied. Player: 80→65 | — | Different terminal time |
| 3 | P-03 / 4.350s | Player physical | Not executed: YBCS battle ended | Critical; 31 resolved, 18 applied. Enemy 500: 18→0 | — | Different terminal time |
| 4 | P-04 / 5.800s | Player physical | Not executed | Hit, noncritical; 22 applied. Enemy 502: 71→49 | — | Different terminal time |
| 4 | E2-03 / 6.099s | Enemy 502 magic | Not executed | Magic hit, noncritical; 15 applied. Player: 65→50 | — | Different terminal time |
| 5 | P-05 / 7.250s | Player physical | Not executed | Hit, noncritical; 22 applied. Enemy 502: 49→27 | — | Different terminal time |
| 5 | E2-04 / 8.132s | Enemy 502 magic | Not executed | Magic hit, noncritical; 15 applied. Player: 50→35 | — | Different terminal time |
| 6 | P-06 / 8.700s | Player physical | Not executed | Hit, noncritical; 22 applied. Enemy 502: 27→5 | — | Different terminal time |
| 7 | P-07 / 10.150s | Player physical | Not executed | Hit, noncritical; 22 resolved, 5 applied. Enemy 502: 5→0 | — | S19 victory |

### 3.1 First divergence

The first action event, P-01 in round 1, already diverges in damage despite identical hit and critical decisions:
- YBCS: raw midpoint 10; authored_damage=false; the unarmed fallback bypasses defender physical defence; critical doubles 10 to 20.
- S19: attack 28; caster defence 9; raw after defence = 28 − 9 × 0.65 = 22.15; Math.round gives 22; critical ×1.5 gives 33; 45%-of-71-HP cap reduces it to 31.

The sampled rolls are identical: hit roll 0.00006295018829405308 and critical roll 0.015747428173199296. Both engines hit and crit. The difference is therefore FORMULA / CRITICAL / CLAMP_CAP / INPUT_MAPPING, not RNG.

### 3.2 Largest common-event damage difference

The largest resolved per-action delta is +30, tied by E1-01, E2-01 and E1-02:
- YBCS direct magic: EA45 + authored magic damage 0 = 45; defender magic defence 0; elemental percentage 100%; final 45.
- S19 generic caster magic: magicAttack 23 − magicDefense 12 × 0.65 = 15.2; Math.round gives 15; no HP cap is active; final 15.
- YBCS does not calculate magic hit or critical. S19 hit chance is 0.832 and critical chance is 0.03. All selected S19 magic rolls hit and none crit in this encounter. The missing YBCS magic hit/critical functions remain EVIDENCE_GAP; no physical hit/critical formula is borrowed.

## 4. Aggregate metrics

### 4.1 Outcome and action totals

| Metric | YBCS | S19 |
|---|---:|---:|
| Outcome | Defeat | Victory |
| Last event | E1-02 | P-07 |
| Last event time | 3.800s | 10.150s |
| Rounds (one player action index per round) | 2 | 7 |
| Player actions | 2 | 7 |
| Enemy actions | 3 | 6 |
| Events executed | 5 | 13 |
| Player remaining HP | 0 | 35 |
| Enemy 500 remaining HP | 70 | 0 |
| Enemy 502 remaining HP | 150 | 0 |

### 4.2 Applied damage totals

| Damage metric | YBCS | S19 |
|---|---:|---:|
| Damage dealt to enemies (HP actually removed) | 30 | 142 |
| Damage received by player (HP actually removed) | 125 | 90 |
| Combined HP removed | 155 | 232 |
| Sum of resolved action damage before overkill clipping | 165 | 262 |

YBCS outgoing applied damage is 30 (20 + 10). Its incoming direct magic resolves to 45 + 45 + 45, but the last action applies only 35 because the player has 35 HP remaining. S19 outgoing applied damage is 142; incoming applied damage is 90.

### 4.3 Per-action damage distributions

- YBCS resolved action damage: [20, 45, 45, 10, 45].
- YBCS HP-applied action damage: [20, 45, 45, 10, 35].
- S19 resolved action damage: [31, 15, 15, 22, 15, 15, 31, 22, 15, 22, 15, 22, 22].
- S19 HP-applied action damage: [31, 15, 15, 22, 15, 15, 18, 22, 15, 22, 15, 22, 5].

## 5. Difference attribution

| Registered category | Observed in this encounter | Attribution |
|---|---|---|
| FORMULA | Yes | YBCS physical fallback damage 10 and direct EA45 magic differ from S19 family attack 28 and caster magicAttack 23 with 0.65 defence effectiveness. |
| INPUT_MAPPING | Yes | YBCS enemies use authored Ability HP 100/150; S19 generic caster enemies use reconstructed HP 71/71. YBCS magic uses Magictbl EA; S19 uses generic magicAttack rather than a matching authored EA skill. |
| CRITICAL | Yes | YBCS physical critical doubles damage; S19 uses ×1.5. Both crit on P-01, but final damage differs. |
| CLAMP_CAP | Yes | S19 P-01 critical damage is reduced from 33 to 31 by the 45%-of-target-HP cap. |
| HIT_EVASION | Probability policies differ | YBCS physical chance is 95%; S19 player physical chance is 0.854. Both selected physical hit rolls land. YBCS magic hit is EVIDENCE_GAP; S19 magic hit chance is 0.832. |
| ELEMENT_ORDER | Not numerically active here | YBCS passes table-derived 100% for both direct spells, so the post-defence element stage is neutral. S19 has no element stage. This encounter does not test a non-neutral element multiplier. |
| ROUNDING | Present in formula path, not the primary largest delta | S19 uses Math.round after defence; the magic example has 15.2 rounded to 15. |
| EB_ISOLATION | Not exercised in this scenario | Batch 3 M15 path divergence remains confirmed and unchanged; this encounter uses direct EA-only spells 5201/7201. |

These are measured differences between RECOVERED_SECONDARY offline policy and RECONSTRUCTION_POLICY. No side is described as erroneous or as the retired retail-server formula.

## 6. Element, hit/critical and skill-route boundaries

- YBCS element percentages for both encounter spells were materialized as 100 from the supplied magicatr table using target profession selector 0. This is a fixture-side lookup. The production lookup-to-resolver caller remains EVIDENCE_GAP.
- YBCS direct magic does not calculate hit or critical. In this encounter the deterministic resolver result is applied as specified by the supplied direct-damage policy, with hit/critical shown as N/A.
- S19 uses generic magic attacks for caster enemies. No S19 SKILL_POLICY entry exists for old skill IDs 5201/7201; this is not an authored-EA mapping.
- The S19 player uses basic physical attacks (useSkills=false). No S19 authored EA path is asserted.
- Batch 3 M15 EB_ISOLATION remains a confirmed path divergence; this battle does not attempt to repair or re-test it.

## 7. Harness validation and limitations

- YBCS event orchestration is a comparison harness that combines the supplied YBCS physical and direct-magic resolvers under the same cadence, first-living-target policy and terminal conditions. It is not claimed to be a recovered YBCS native full-battle scheduler.
- S19 trace instrumentation follows the native simulateCombat event schedule, action ordering, target selection, stop conditions and seededRandom implementation. The instrumented aggregate was checked against the native simulateCombat result for seed 1 and matched exactly: victory, 10.150 seconds, 35 remaining HP, 7 player actions, 6 enemy actions, 142 damage dealt and 90 damage taken.
- The current S19 simulator does not model a two-player party. The one-player/two-enemy constraint is retained rather than silently adding a party scheduler.
- The common event IDs P-01, E1-01, E2-01, P-02 and E1-02 use identical roll pairs in both engines. Later S19-only events have no YBCS counterpart because YBCS has already ended.
- No full native YBCS battle engine, targeting/area resolution, status persistence, or server-authoritative HP state is claimed by this resolver-combination simulation.
- No .lib/.atr binary or extracted resource was added to the repository. No S19 code or tuning was modified.

## 8. Batch 4 conclusion and handoff

The encounter outcome differs: YBCS loses in round 2 at 3.8 seconds; S19 wins in round 7 at 10.15 seconds. The earliest numeric divergence is P-01 (-11 YBCS vs S19); the largest shared-event resolved-damage difference is +30 on direct-magic events E1-01, E2-01 and E1-02.

The main drivers are the registered FORMULA and INPUT_MAPPING differences, with physical CRITICAL / CLAMP_CAP differences and the YBCS magic hit/critical EVIDENCE_GAP. The selected element percentage is neutral 100%, so element order is not a numeric driver in this encounter.

Batch 5 adjudication document is recommended to proceed. It should decide how to interpret the observed differences and record owner decisions; it must not modify S19 or promote YBCS evidence beyond RECOVERED_SECONDARY without separate authorization.
