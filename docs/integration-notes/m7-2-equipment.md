# M7.2 / S44 装备数据与战斗接入

- Request: `ch1-attr-s44-20261113-01`
- Branch base: `d87f4d46dae30d869a0dd9bacf93de5fdc9853bf`
- Status: implementation candidate; automated verification pending.
- Scope: M6 three-slot loadout only; no second equipment authority, no durability wear/repair/enhancement, no automatic newbie spear grant.

## Catalog and evidence

`data/items/ch1-equipment-catalog.json` contains 612 candidate rows selected from S4 itemtbl candidates: shopNumber 1..4, equipPosition 0..6 or 8, requiredLevel <= 16. Slot mapping is a RECONSTRUCTION_POLICY: positions 3/8 -> weapon; 0/1/2/5 -> armor; 4/6 -> accessory. This is a candidate filter, not a verified retail first-chapter shop stock list.

Source catalog: `docs/integration-notes/s4-shop-catalog-data.json`, Git blob `80ebe2f663e3d46e8ec67da36d45a65a36ce4376`. Every row retains itemResourceId, source physical line, raw-line SHA-256, member hash, price, position, durability, level requirement, profession flags, six attribute requirements, physical/magic min/max/range, and raw numeric columns. All YBCS-derived rows remain RECOVERED_SECONDARY; runtimeVerified=false.

The raw attribute requirement order is con/str/dex/int/wis/reg. The runtime stores con/wis/str/dex/int/reg by name and never relies on positional copying. Itemtbl has no recovered stage ID requirement; stage restriction is UNKNOWN and no stage gate is invented.

## Reconstruction policies

- Profession selectors 0..4 map to swordsman family and 5..9 to wizard family: RECONSTRUCTION_POLICY based on the recovered ten-selector layout.
- Required level is enforced; zero source values normalize to runtime minimum level 1 while the raw value remains in catalog.
- Six attribute requirements are enforced when an attribute context is available. Current base attribute seed is 10 per dimension plus S43 automatic/allocated values: RECONSTRUCTION_POLICY, not original base-stat verification.
- Weapon physical/magic attack conversion uses rounded midpoint of authored min/max range. Armor/accessory use authored physical/magic defense. Raw ranges remain available and are not overwritten.
- No evidence-backed mapping is asserted for accuracy/evasion/critical columns yet; they remain preserved as raw fields.
- Durability is retained as metadata only. No wear, repair, or enhancement state is added to M6 Save schema 1.

## Runtime integration

M6 loadout remains exactly `weapon / armor / accessory`. Inventory ownership remains the existing unique itemId quantity model. Equipping does not consume the owned item; replacing or unequipping leaves the old item in the bag. No independent durability instance is introduced. M6 Save extension schema 1 remains readable; the three-slot loadout is restored into the combat projection.

The S44 panel lists owned candidates, eligibility rejection reasons and current slot state. Combat uses the same M6 loadout contributions, so the HUD/CombatantStats projection and equipment panel derive from the same rule set. Item 4 is a catalog candidate only and is not granted to new characters.

## Verification commands

- `cd web && npm run typecheck`
- `cd web && npm test`
- `cd web && npm run build`
- `cd web && npm run test:e2e -- e2e/m7-2-equipment.spec.ts` (240-second per-test timeout)

Do not claim PASS until commands actually execute. CI workflow `.github/workflows/web-ci.yml` supports push only on codex/**, PR to main, or workflow_dispatch. S44 branch feat/** will not trigger by push; this task does not create a PR and the GitHub connector exposes no dispatch action. Verification therefore remains NOT_RUN/BLOCKED until an authorized runner is available.
