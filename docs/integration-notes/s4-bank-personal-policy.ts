/**
 * S4 personal-bank protocol and conservative offline policy (B5).
 *
 * Source: ybcs-offline / ybcs_single_player_bank.py and the B2/B3 NPC program-18
 * crosswalk. Evidence is RECOVERED_SECONDARY / 重构参考 only.
 *
 * This module is a pure reference evaluator. It does not emit packets, open a
 * socket, mutate a GameDomain, or enable a retail/gameplay bank operation.
 * Starting balances are YBCS offline initialization policy, not retail defaults.
 */

export const PERSONAL_BANK_POLICY = {
  evidenceLevel: "RECOVERED_SECONDARY",
  evidenceLabel: "重构参考",
  runtimeVerified: false,
  businessActionsEnabled: false,
  autoActivation: false,
  wireEmissionAllowed: false,
  runtimeDomainMutationAllowed: false,
  familyBankIncluded: false,
  sourceProject: "ybcs-offline",
  sourceArtifact: "ybcs_single_player_bank.py",
  sourceHash: "aef23a5432773aa3f132d83e939a8dcf88024bb013de5b0a3535261acdab0f10",
} as const;

export const BANK_PACKET = {
  outerOpcode: 0x66,
  query: 1,
  deposit: 2,
  withdraw: 3,
  close: 7,
  maxLegacyMoney: 0xffff_ffff,
} as const;

export const BANK_SUPPORT_PACKETS = {
  npcServiceMenuAction: 0x30,
  npcServiceOpen: 0x64,
  playerMoneySync: 0x3a,
} as const;

export const PERSONAL_BANK_BINDING = {
  npcProgramIndex: 18,
  menuOptionOrdinal: 1,
  menuSourceLineNumber: 42,
  menuText: "使用普通银行",
  serviceAction: 10,
  serviceOpenAction: 10,
  familyBankAction: 11,
  familyBankIncluded: false,
} as const;

export type BankSubtype = 1 | 2 | 3 | 7;
export type BankResultSubtype = 1 | 2 | 3;

export type BankRequest =
  | { subtype: 1 }
  | { subtype: 7 }
  | { subtype: 2 | 3; amount: number };

export interface BankState {
  playerMoney: number;
  bankMoney: number;
}

export interface BankResult {
  subtype: BankResultSubtype;
  resultCode: 1 | 2 | 4;
  amount?: number;
}

export interface OfflineBankEvaluation {
  replyName: string;
  response: BankResult | null;
  state: BankState;
  changed: boolean;
  policyId: "ybcs-offline-personal-bank-reference-v1";
}

export function isU32(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= 0 && value <= BANK_PACKET.maxLegacyMoney;
}

export function isPositiveU32(value: unknown): value is number {
  return isU32(value) && value > 0;
}

/** Request codec shape: query/close have no amount; transfers require positive u32. */
export function validateBankRequest(request: BankRequest): boolean {
  if (request.subtype === BANK_PACKET.query || request.subtype === BANK_PACKET.close) {
    return !("amount" in request);
  }
  return isPositiveU32(request.amount);
}

/**
 * Mirrors LegacyBankResult.parse/payload's accepted result-code domain.
 * It does not claim that every accepted failure code is emitted by the
 * YBCS offline service or that its retail meaning is known.
 */
export function validateBankResultShape(
  subtype: BankResultSubtype,
  resultCode: number,
  amount: number | undefined,
): boolean {
  if (resultCode === 1) return isU32(amount);
  const maximum: Record<BankResultSubtype, number> = { 1: 3, 2: 4, 3: 5 };
  return amount === undefined && Number.isInteger(resultCode) &&
    resultCode >= 2 && resultCode <= maximum[subtype];
}

/** Pure offline reference evaluator; never writes to a runtime domain. */
export function evaluateOfflineBankPolicy(
  state: BankState,
  request: BankRequest,
): OfflineBankEvaluation {
  if (!isU32(state.playerMoney) || !isU32(state.bankMoney)) {
    throw new RangeError("bank state fields must fit u32");
  }
  if (!validateBankRequest(request)) {
    throw new RangeError("invalid personal-bank request shape or amount");
  }
  const unchanged = { ...state };
  const policyId = "ybcs-offline-personal-bank-reference-v1" as const;

  if (request.subtype === BANK_PACKET.close) {
    return { replyName: "BANK_CLOSE", response: null, state: unchanged, changed: false, policyId };
  }
  if (request.subtype === BANK_PACKET.query) {
    return {
      replyName: "BANK_BALANCE",
      response: { subtype: BANK_PACKET.query, resultCode: 1, amount: state.bankMoney },
      state: unchanged,
      changed: false,
      policyId,
    };
  }

  const amount = request.amount;
  if (request.subtype === BANK_PACKET.deposit) {
    if (amount > state.playerMoney) {
      return {
        replyName: "BANK_DEPOSIT_INSUFFICIENT_PLAYER_MONEY",
        response: { subtype: BANK_PACKET.deposit, resultCode: 2 },
        state: unchanged,
        changed: false,
        policyId,
      };
    }
    if (state.bankMoney + amount > BANK_PACKET.maxLegacyMoney) {
      return {
        replyName: "BANK_DEPOSIT_ACCOUNT_CAP",
        response: { subtype: BANK_PACKET.deposit, resultCode: 4 },
        state: unchanged,
        changed: false,
        policyId,
      };
    }
    return {
      replyName: "BANK_DEPOSIT_SUCCESS",
      response: { subtype: BANK_PACKET.deposit, resultCode: 1, amount },
      state: { playerMoney: state.playerMoney - amount, bankMoney: state.bankMoney + amount },
      changed: true,
      policyId,
    };
  }

  if (amount > state.bankMoney) {
    return {
      replyName: "BANK_WITHDRAW_INSUFFICIENT_BANK_MONEY",
      response: { subtype: BANK_PACKET.withdraw, resultCode: 2 },
      state: unchanged,
      changed: false,
      policyId,
    };
  }
  if (state.playerMoney + amount > BANK_PACKET.maxLegacyMoney) {
    return {
      replyName: "BANK_WITHDRAW_PLAYER_CAP",
      response: { subtype: BANK_PACKET.withdraw, resultCode: 4 },
      state: unchanged,
      changed: false,
      policyId,
    };
  }
  return {
    replyName: "BANK_WITHDRAW_SUCCESS",
    response: { subtype: BANK_PACKET.withdraw, resultCode: 1, amount },
    state: { playerMoney: state.playerMoney + amount, bankMoney: state.bankMoney - amount },
    changed: true,
    policyId,
  };
}

/** Offline-only initialization defaults; never use as retail defaults. */
export const OFFLINE_ECONOMY_DEFAULTS = {
  extension: "offline_economy",
  schema: 1,
  startingPlayerMoney: 1_000_000,
  startingBankMoney: 0,
  classification: "YBCS offline initialization policy only",
  retailDefaultClaimed: false,
} as const;

/** Codec accepts these failure codes, but their meanings are not recovered. */
export const UNRESOLVED_FAILURE_CODES = {
  query: [2, 3],
  deposit: [3],
  withdraw: [3, 5],
} as const;
