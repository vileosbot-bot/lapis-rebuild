# S4 Personal Bank Export Audit (B5)

## Scope

B5 exports the YBCS offline personal-bank codec and policy reference, plus the B2 NPCScript program-18 record and the B3 service-route crosswalk. It does not implement or claim family/guild bank behavior.

## Source inventory and hashes

| Source | Bytes | SHA-256 | Use |
|---|---:|---|---|
| `ybcs_single_player_bank.py` | 11838 | `aef23a5432773aa3f132d83e939a8dcf88024bb013de5b0a3535261acdab0f10` | Personal-bank request/result codec, service evaluator, offline economy defaults |
| `s4-npc-services-data.json` (B2 export) | 288841 | `470182becaf20d72d9f5ced486e3c150396048c714ed957e073f4ac4098ff8ac` | NPCScript program 18 resource record and semantic mapping |
| `s4-npc-menu-actions-data.json` (B3 export) | 260246 | `5c6523cf673d9ebb2cfe88606476417eb540110619f7a6da3158945ebbdc210d` | Program 18 option-ordinal to service-action crosswalk |
| `Quest.lib::NPCScript.txt` (upstream B2 source) | 4,572 | `23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397` | Original source member hash carried by B2 |

All exported evidence is `RECOVERED_SECONDARY` / `重构参考`; `runtimeVerified=false`. These are YBCS secondary-reconstruction facts, not VERIFIED retail-server facts.

## NPC program 18 binding

- Program index: 18; title: `银行员`; declared rows: 5.
- Header: `NPCScript.txt:L39` (`18,5,银行员`).
- Menu rows: `L40-L44`; one kind-1 greeting and four enabled kind-2 rows.
- Personal-bank menu row: `L42`, option ordinal 1, text `使用普通银行`.
- B3 route maps program 18 / option ordinal 1 to service action 10. `optionOrdinal` is a zero-based menu position, not a network action ID.
- The personal bank module separately defines `LEGACY_PERSONAL_BANK_ACTION=10` for the 0x64 service-open selector.
- Family-bank row `L43`, option ordinal 2, routes to action 11, but is excluded from B5 and remains B9 BLOCKED.

## Operation model

Four request operations are modeled:

| Operation | Subtype | Request shape | Amount |
|---|---:|---|---|
| Query | 1 | `66 01` (2 bytes) | None |
| Deposit | 2 | `66 02 <u32>` (6 bytes) | Positive u32 |
| Withdraw | 3 | `66 03 <u32>` (6 bytes) | Positive u32 |
| Close | 7 | `66 07` (2 bytes) | None |

The request/result outer opcode is `0x66`. Transfer amounts are little-endian u32, range 1..4,294,967,295. Zero is rejected for transfers. Balance fields may be zero.

## Result-code model

The codec domain contains 12 subtype/result-code combinations across query (3), deposit (4), and withdraw (5). There are five distinct result-byte values (1 through 5).

- Result 1 is success and carries a u32 amount. For query it is the bank balance; for deposit/withdraw it is the transferred amount.
- Deposit failure 2: insufficient player money; failure 4: bank balance would exceed u32 maximum.
- Withdraw failure 2: insufficient bank money; failure 4: player balance would exceed u32 maximum.
- Query failures 2/3, deposit failure 3, and withdraw failures 3/5 are accepted by the codec shape but have no recovered semantic mapping and are not emitted by `YbcsSinglePlayerBankService.accept`.
- Failure responses are bodyless 3-byte frames. Successful responses are 7-byte frames.
- Close has no `LegacyBankResult` subtype and the offline service returns no response payload.

## Supporting packet shapes

- NPC menu action: client-to-server `30 <i16 target_word> <i16 action=10>` (B3 crosswalk).
- Service-open selector: server-to-client `64 <i16 action=10> <i16 context_word>` (5 bytes).
- Player-money sync: server-to-client `3A <u32 player_money>` (5 bytes).
- Bank request/result outer opcode: `66`.

These are recovered YBCS/client-derived shapes; no retail-server response has been verified by this export.

## Offline economy defaults (not retail defaults)

- `OFFLINE_STARTING_PLAYER_MONEY = 1,000,000`.
- `OFFLINE_STARTING_BANK_MONEY = 0`.
- Extension: `offline_economy`, schema 1, fields `player_money` and `bank_money`.
- Both starting balances are explicitly classified as YBCS offline initialization policy. No original retail default is claimed.

## Family/guild bank exclusion

`LEGACY_FAMILY_BANK_ACTION=11` is present as a constant and the NPC menu/B3 route exposes a program-18 option for action 11. The supplied personal-bank module does not contain a family-bank service, account model, request/result codec, persistence rules, or transaction implementation. No family-bank operations are exported. B9 remains BLOCKED.

## Acceptance criteria and local checks

1. Query does not change either balance.
2. Successful deposit and withdrawal preserve `player_money + bank_money`.
3. All balances and response amounts fit u32; transfer amount must be positive.
4. Every failure path leaves both balances unchanged.
5. A deposit cannot overdraw player money or overflow bank money.
6. A withdrawal cannot overdraw bank money or overflow player money.
7. Close does not change balances and returns no response payload.
8. Unknown codec-accepted failure codes remain semantically unresolved.
9. Family/guild bank is not implemented or inferred from the personal-bank module.
10. All records carry source fields, `RECOVERED_SECONDARY`, and `runtimeVerified=false`.

## Evidence boundary

The bank module's docstring explicitly separates old-client wire shapes from YBCS offline starting-balance policy. The service code demonstrates a single-player `GameDomain` implementation. This does not establish original retail server behavior, default balances, family-bank behavior, or live runtime verification.
