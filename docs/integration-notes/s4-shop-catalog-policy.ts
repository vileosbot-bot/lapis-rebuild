/**
 * S4 shop catalog policy (B4).
 *
 * Source facts: Set.lib::itemtbl.atr, parsed from the supplied YBCS offline archive.
 * Offline projections are explicitly YBCS-only and are not retail-server rules.
 * This file validates exported data; it does not execute purchases, sales, or mutations.
 */

export type EvidenceLevel = "RECOVERED_SECONDARY";

export interface SourceRecord {
  lineNumber?: number;
  lineStart?: number;
  lineEnd?: number;
  rawLineSha256?: string;
  sourceLinesSha256?: string;
  symbol?: string;
  numericColumnCount?: number;
  fieldCount?: number;
  decodedTextEncoding?: string;
}

export interface Provenance {
  sourceProject: "ybcs-offline";
  sourceArtifact: string;
  sourceMember: string;
  sourceHash: string;
  sourceMemberHash?: string;
  sourceRecord: SourceRecord;
  evidenceLevel: EvidenceLevel;
  evidenceLabel: "重构参考";
  runtimeVerified: false;
}

export interface ShopItemRecord extends Provenance {
  itemResourceId: number;
  graphicId: number;
  shopNumber: number;
  equipPosition: number;
  durability: number;
  price: number;
  name: string;
  description: string;
  numericColumns: number[];
}

export interface OfflineProgramShopMapping extends Provenance {
  npcProgramIndex: number;
  offlineShopNumber: number;
  rawItemTableCandidateCount: number;
  mappingScope: "YBCS_OFFLINE_PROJECTION_ONLY";
  retailMappingClaimed: false;
}

export interface OfflineSalePolicy {
  policyId: "old-new-same-id-half-old-price-sale-v1";
  rule: string;
  unitPriceColumnIndexZeroBased: 17;
  exactAuthoritativeInventoryRowRequired: true;
  soldItemsRestockCatalog: false;
  eligibleItemIds: readonly number[];
  eligibilitySourceProvided: true;
  eligibilitySource: Provenance;
  status: "PINNED_ID_SET_EXPORTED";
}

export interface OfflineCatalogPolicy {
  catalogLimit: 120;
  clientInventoryLimit: 28;
  finiteStock: true;
  purchasePriceColumnIndexZeroBased: 17;
  salePolicy: OfflineSalePolicy;
  retailRulesClaimed: false;
}

export const SHOP_CATALOG_EVIDENCE_LEVEL: EvidenceLevel = "RECOVERED_SECONDARY";
export const SHOP_CATALOG_RUNTIME_VERIFIED = false as const;
export const OFFLINE_SHOP_POLICY_IS_NOT_RETAIL = true as const;

export function assertShopItemRecord(row: ShopItemRecord): void {
  if (row.evidenceLevel !== "RECOVERED_SECONDARY" || row.evidenceLabel !== "重构参考") {
    throw new Error("shop item evidence must remain RECOVERED_SECONDARY / 重构参考");
  }
  if (row.runtimeVerified !== false) throw new Error("shop item runtimeVerified must remain false");
  if (row.numericColumns.length !== 53) throw new Error("itemtbl row must retain exactly 53 numeric columns");
  if (row.itemResourceId !== row.numericColumns[0]) throw new Error("itemResourceId does not match numericColumns[0]");
  if (row.graphicId !== row.numericColumns[1]) throw new Error("graphicId does not match numericColumns[1]");
  if (row.shopNumber !== row.numericColumns[2]) throw new Error("shopNumber does not match numericColumns[2]");
  if (row.equipPosition !== row.numericColumns[3]) throw new Error("equipPosition does not match numericColumns[3]");
  if (row.durability !== row.numericColumns[6]) throw new Error("durability does not match numericColumns[6]");
  if (row.price !== row.numericColumns[17]) throw new Error("price does not match numericColumns[17]");
  if (!row.sourceRecord.lineNumber || !row.sourceRecord.rawLineSha256) {
    throw new Error("shop item must retain source line number and raw-line SHA-256");
  }
}

export function assertUniqueItemResourceIds(rows: readonly ShopItemRecord[]): void {
  const seen = new Set<number>();
  for (const row of rows) {
    assertShopItemRecord(row);
    if (seen.has(row.itemResourceId)) throw new Error(`duplicate itemResourceId ${row.itemResourceId}`);
    seen.add(row.itemResourceId);
  }
}

export function assertOfflineProgramShopMapping(mapping: OfflineProgramShopMapping): void {
  if (mapping.evidenceLevel !== "RECOVERED_SECONDARY" || mapping.runtimeVerified !== false) {
    throw new Error("offline mapping evidence metadata is invalid");
  }
  if (mapping.mappingScope !== "YBCS_OFFLINE_PROJECTION_ONLY" || mapping.retailMappingClaimed !== false) {
    throw new Error("NPC program/shop mapping must not be represented as a retail mapping");
  }
}

export function countRawItemsByShopNumber(rows: readonly ShopItemRecord[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.shopNumber, (counts.get(row.shopNumber) ?? 0) + 1);
  return counts;
}

export function assertOfflineCatalogPolicy(policy: OfflineCatalogPolicy): void {
  assertOfflineSalePolicy(policy.salePolicy);
  if (policy.retailRulesClaimed !== false || policy.finiteStock !== true) {
    throw new Error("offline catalog policy boundary is invalid");
  }
  if (policy.purchasePriceColumnIndexZeroBased !== 17) {
    throw new Error("offline purchase price source must remain itemtbl numericColumns[17]");
  }
}

/** Pinned exact-ID eligibility recovered from ybcs offline sale compatibility module. */
export const OFFLINE_SHOP_SALE_POLICY_ID = "old-new-same-id-half-old-price-sale-v1" as const;

export const COMPATIBLE_HALF_PRICE_ITEM_IDS = [
  4, 11, 17, 26, 31, 211, 1004, 1011, 1017, 1026, 1031, 1211, 2004, 2011, 2017, 2026, 2031, 2211, 3004, 3011, 3017, 3026, 3031, 3211, 4001, 4002, 4003, 4004, 4007, 4008, 4009, 4012, 4013, 4014, 4015, 4016, 4017, 4018, 4022, 4024, 4026, 4027, 4028, 4037, 4038, 4039, 4040, 4041, 4042, 4043, 4044, 4045, 4046, 4047, 4048, 4049, 4050, 4051, 4052, 4053, 4054, 4055, 4056, 4057, 4058, 4059, 4060, 4062, 4063, 4064, 4065, 4066, 4067, 4068, 4069, 4074, 4075, 4078, 4089, 4090, 4104, 4105, 4107, 4108, 4109, 4110, 4111, 4114, 4116, 4401, 4402, 4403, 4404, 4405, 4406, 4407, 4408, 4409, 4410, 4411, 4412, 4413, 4414, 4415, 4416, 4417, 4418, 4716, 5000, 5001, 5002, 5003, 5004, 5005, 5100, 5101, 5102, 5103, 5104, 5105, 6000, 6001, 6011, 6021, 6031, 6032, 6042, 6052, 6062, 6063, 6073, 6083, 6093, 6094, 6104, 6114, 6124, 6125, 6135, 6145, 6155, 6156, 6166, 6176, 6186, 6187, 6197, 6207, 6800, 6801, 6802, 6803, 6804, 6805,
] as const;

const COMPATIBLE_HALF_PRICE_ITEM_ID_SET: ReadonlySet<number> =
  new Set<number>(COMPATIBLE_HALF_PRICE_ITEM_IDS);

export const SHOP_SALE_ELIGIBILITY_PROVENANCE: Provenance = {
  sourceProject: "ybcs-offline",
  sourceArtifact: "ybcs_shop_sale_compatibility.py",
  sourceMember: "COMPATIBLE_HALF_PRICE_ITEM_IDS / compatible_sale_unit_price",
  sourceHash: "044db91fab1b1618bdb1aae87eb7d36bc29051af98bff830d179cdfd210f71a0",
  sourceRecord: {
    lineStart: 18,
    lineEnd: 54,
    symbol: "COMPATIBLE_HALF_PRICE_ITEM_IDS",
    numericColumnCount: 154,
  },
  evidenceLevel: "RECOVERED_SECONDARY",
  evidenceLabel: "重构参考",
  runtimeVerified: false,
};

export interface PricedSaleItem {
  itemResourceId: number;
  price: number;
}

/** Exact whitelist lookup; unsupported IDs return null. */
export function compatibleSaleUnitPrice(item: PricedSaleItem): number | null {
  if (!COMPATIBLE_HALF_PRICE_ITEM_ID_SET.has(item.itemResourceId)) return null;
  if (!Number.isInteger(item.price) || item.price <= 0 || item.price % 2 !== 0) {
    throw new Error("pinned shop-sale compatibility row must have positive even old price");
  }
  return item.price / 2;
}

export function assertOfflineSalePolicy(policy: OfflineSalePolicy): void {
  if (policy.policyId !== OFFLINE_SHOP_SALE_POLICY_ID ||
      policy.eligibilitySourceProvided !== true ||
      policy.status !== "PINNED_ID_SET_EXPORTED" ||
      policy.eligibleItemIds.length !== COMPATIBLE_HALF_PRICE_ITEM_IDS.length ||
      new Set(policy.eligibleItemIds).size !== policy.eligibleItemIds.length ||
      policy.eligibleItemIds.some((id, index) => id !== COMPATIBLE_HALF_PRICE_ITEM_IDS[index])) {
    throw new Error("offline sale eligibility policy metadata is invalid");
  }
  if (policy.eligibilitySource.evidenceLevel !== "RECOVERED_SECONDARY" ||
      policy.eligibilitySource.evidenceLabel !== "重构参考" ||
      policy.eligibilitySource.runtimeVerified !== false) {
    throw new Error("offline sale eligibility provenance is invalid");
  }
}

export function assertOfflineSaleEligibility(
  rows: readonly ShopItemRecord[],
): void {
  const byId = new Map(rows.map(row => [row.itemResourceId, row]));
  for (const id of COMPATIBLE_HALF_PRICE_ITEM_IDS) {
    const row = byId.get(id);
    if (!row) throw new Error(`eligible item ${id} is missing from itemtbl export`);
    if (row.price <= 0 || row.price % 2 !== 0) {
      throw new Error(`pinned shop-sale compatibility row ${id} must have positive even old price`);
    }
  }
}
