# S44 装备接入验收记录

## Current status

`PARTIAL_BLOCKED` — implementation files are being prepared. No typecheck, unit test, build, Playwright E2E or screenshot result is claimed PASS until actually executed.

| Gate | Required | Current |
|---|---|---|
| Catalog | 612 filtered rows with source line/hash/provenance | Prepared; commit pending |
| Typecheck | `npm run typecheck` | NOT_RUN |
| Unit tests | `npm test` plus S44 focused tests | NOT_RUN |
| Production build | `npm run build` | NOT_RUN |
| E2E | Swordsman + wizard, save/reload, 240s timeout | NOT_RUN |
| Screenshots | equipment-empty/equipped/stat-delta/after-save-load | NOT_RUN |
| Screenshot SHA-256 / byte count | actual browser files | UNKNOWN / NOT_RUN |
| Checkpoint JSON | actual browser runtime snapshot | NOT_RUN |
| S42 | prohibited in S44 | NOT_RUN_BY_PLAN |

## Workflow discovery

`.github/workflows/web-ci.yml` runs parser tests, npm ci, typecheck, npm test, production build, Chromium install, and Playwright E2E. Its triggers are push on `codex/**`, pull_request to `main`, and workflow_dispatch. The S44 branch is `feat/ch1-s44-equipment-combat`; push does not match. PR and manual dispatch are not authorized/available in this task. Other static workflows are not substitutes for web-ci.

## Known environment precedent

S43 acceptance reported DNS `EAI_AGAIN registry.npmjs.org`, missing Phaser dependencies, and no Node Playwright CLI. This is historical context only; S44 has not yet attempted commands, so current execution state remains NOT_RUN rather than assuming the same failure.

## Scope guards

- No S42 in S44.
- No durability wear, repair, enhancement or save-schema redesign.
- No automatic item 4 grant.
- YBCS provenance remains RECOVERED_SECONDARY.
- Requirement and stat conversion policies remain RECONSTRUCTION_POLICY; absent stage requirement remains UNKNOWN.
