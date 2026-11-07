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
  rule: string;
  unitPriceColumnIndexZeroBased: 17;
  exactAuthoritativeInventoryRowRequired: true;
  soldItemsRestockCatalog: false;
  eligibleItemIds: null;
  eligibilitySourceProvided: false;
  status: "RULE_TEXT_RECOVERED_ELIGIBLE_SET_NOT_EXPORTED";
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
  if (policy.retailRulesClaimed !== false || policy.finiteStock !== true) {
    throw new Error("offline catalog policy boundary is invalid");
  }
  if (policy.purchasePriceColumnIndexZeroBased !== 17) {
    throw new Error("offline purchase price source must remain itemtbl numericColumns[17]");
  }
  if (policy.salePolicy.eligibleItemIds !== null || policy.salePolicy.eligibilitySourceProvided !== false) {
    throw new Error("sale eligibility must remain unresolved until its source module is supplied");
  }
}
