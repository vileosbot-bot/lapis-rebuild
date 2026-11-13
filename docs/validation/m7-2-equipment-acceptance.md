# S44 装备接入验收记录

- Request: `ch1-attr-s44-20261113-01`
- Branch: `feat/ch1-s44-equipment-combat`
- Implementation commit: `8c7308c55b0fc3c8094911a78df02e2d79243451`
- Base: `d87f4d46dae30d869a0dd9bacf93de5fdc9853bf`
- Current state: `IMPLEMENTED_NOT_VERIFIED`

## Implementation inventory

One implementation commit adds/modifies 17 files:
- Catalog: 612 filtered equipment rows, all source line/raw-line SHA/member provenance retained.
- Runtime: M6 three-slot loadout reused; no second equipment state system; inventory metadata expanded without changing legacy starter ownership; item 4 remains catalog-only.
- Policy: family/level/attribute eligibility and stat contribution conversions are explicitly RECONSTRUCTION_POLICY; stage requirement remains UNKNOWN.
- UI: slot display, owned candidates, rejection reasons, per-candidate stat delta preview.
- Combat: M6 equipment contribution and S43 attribute projection enter the same CombatantStats construction.
- Tests authored: 8 unit tests in `m7-2-equipment.test.ts`, 5 stat/combat policy tests in `m7-2-equipment-stat-policy.test.ts`, and two profession E2E cases with 240-second test timeout.

## Validation status

| Gate | Required | Current |
|---|---|---|
| Typecheck | `npm run typecheck` | NOT_RUN |
| Unit tests | `npm test` | NOT_RUN |
| Production build | `npm run build` | NOT_RUN |
| E2E | Swordsman + wizard, save/reload | NOT_RUN |
| Screenshots | equipment-empty/equipped/stat-delta/after-save-load | NOT_RUN |
| Screenshot SHA-256 / byte count | actual browser files | UNKNOWN / NOT_RUN |
| Checkpoint JSON | actual browser runtime snapshot | NOT_RUN |
| S42 | prohibited in S44 | NOT_RUN_BY_PLAN |

No validation command was executed in a local or remote runtime. No PASS is claimed.

## CI discovery and trigger result

The repository has 11 workflow files. The relevant `.github/workflows/web-ci.yml` runs parser checks, `npm ci`, typecheck, unit tests, production build, Chromium install, and Playwright E2E.

Its triggers are:
- push on `codex/**` with relevant paths;
- pull_request targeting `main`;
- `workflow_dispatch`.

The authorized S44 branch is `feat/ch1-s44-equipment-combat`, so its push does not match the workflow's push filter. A PR is prohibited for this task. The GitHub connector exposes no workflow-dispatch operation. After the implementation push, the commit has zero workflow runs and zero combined statuses. CI is therefore `BLOCKED_TRIGGER`, not a code failure and not a pass.

Other workflow files:
- `dependency-kit.yml`
- `m8e-cloudflare-pages.yml`
- `s16-npc-visual.yml`
- `s17-monster-visual-recovery.yml`
- `s20-original-ui-archaeology.yml`
- `s25-m6-dual-class-matrix.yml`
- `source-checkpoint.yml`
- `static-battle-unpack.yml`
- `static-quest-runtime.yml`
- `static-visual-recovery.yml`

These are specialized jobs and do not replace the general web-ci validation suite.

## Source retrieval record

The S4 source JSON was recovered via Git blob:
- Path: `docs/integration-notes/s4-shop-catalog-data.json`
- Blob: `80ebe2f663e3d46e8ec67da36d45a65a36ce4376`
- UTF-8 bytes: 1,837,517
- Lines: 2,964
- Parsed item records: 2,073

The catalog uses that readable blob as the actual source and records its blob SHA in every row. YBCS remains RECOVERED_SECONDARY; no ybcs source is labeled VERIFIED.

## Scope guards

- No S42 in S44.
- No durability wear, repair, enhancement, or save-schema redesign.
- No automatic item 4 grant.
- Old M6 schema 1 three-slot save extension remains readable.
- No PR, merge, main write, main-account repository access, remote computer, or Work/Codex execution.
