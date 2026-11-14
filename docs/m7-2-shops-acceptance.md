# M7.2 Starting Gold Acceptance

- Request ID: `ch1-starting-gold-20261114-01`
- Branch: `feat/ch1-starting-gold-20000`
- Baseline: `main@0155c439ee9fde157ae700da9fbcabdca484abb5`
- Scope: new-game / new-character starting gold only; no PR or merge in this task.

## Decision and provenance

On 2026-11-14 at 13:45 (Beijing time), Wei Le approved the simplified starting-balance decision: a newly created character / new game begins with **20,000 gold**. This replaces, rather than adds to, the offline-pack tutorial's post-training bank-officer reward of 2,000 gold; the intended starting amount is 20,000, not 22,000.

This is an intentional `RECONSTRUCTION_POLICY` convenience decision. It is not a claim that the original retail client initialized a character with 20,000 gold.

The offline-pack tutorial record for the bank-officer step 9 and `POST_TRAINING_GOLD_REWARD = 2000` remains `RECOVERED_SECONDARY`. It is not promoted to a retail-verified rule.

## Runtime wiring

- `M4_STARTING_GOLD = 20_000` is the default for `createM4RewardState()`.
- The M4 runtime constructor now uses that default instead of inheriting `LabScene.gold`, whose legacy scene default is 0.
- The new swordsman / wizard character path (`changeClass`) uses the same default rather than explicitly passing 0.
- Runtime installation and new-character reset continue to call `syncSceneInventory()`, which mirrors the reward-state gold to `scene.gold`.

## No-stacking audit

The browser runtime does not implement the offline tutorial bank-officer step 9 or a `POST_TRAINING_GOLD_REWARD` settlement. Repository code search found no such constant or browser-runtime reward path. The bank officer appears in static world/catalog evidence, but that is not a connected runtime reward flow.

Decision for this task: **无此步骤、无需处理**. No bank reward is removed or gated because none exists in the current web runtime.

The existing training-guide quest turn-in reward (5 gold / 200 EXP in the M4 compatibility path) is a separate runtime reward and remains unchanged. Its existing receipt guard remains in place. The 20,000 starting balance is not combined with a second 2,000-gold bank tutorial grant.

## Save / load boundary

- Save creation continues to serialize the current reward balance into the existing `SaveV2.gold` field.
- `restore()` continues to assign `save.gold` directly to `this.rewards.gold`; it does not call the new-game initializer.
- `migrateSaveToM7()` preserves the saved gold value. The regression test covers 0, 2,000, 4,321, 20,000 and 22,000 gold through migration and serialization round-trip.

## Tests added or adjusted

- `web/tests/m4-runtime-integration.test.ts`: new-game default is exactly 20,000; the runtime constructor ignores the legacy scene's 0-gold default; initial reward receipts are empty; the separate 5-gold quest turn-in remains idempotent. The reward-pipeline fixture now passes 0 explicitly.
- `web/tests/s23-npc-dialogue-quest-flow.test.ts`: quest-reward fixture passes 0 explicitly so the test remains isolated from the new-game default.
- `web/tests/m7-2-attribute-save-migration.test.ts`: saved gold is preserved across M7 migration and serialization round-trip.

No shop prices/catalogs, S45 acceptance bridge, `acceptanceSetGold`, potion recovery values, Plan.md, wild encounters, or Chapter 1 Quest1 behavior are changed.
