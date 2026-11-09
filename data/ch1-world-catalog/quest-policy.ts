/**
 * B6 Quest1-8 offline Quest policy validator.
 *
 * This module validates exported secondary evidence only. It does not
 * execute quests, evaluate server conditions, recruit companions, award
 * rewards, emit wire messages, or mutate saves.
 */

export const QUEST_POLICY_DATASET_ID = "ybcs-ch1-quest-policy" as const;
export const QUEST_POLICY_EVIDENCE_LEVEL = "RECOVERED_SECONDARY" as const;
export const QUEST_POLICY_RUNTIME_VERIFIED = false as const;
export const QUEST_POLICY_EXPECTED_STAGE_COUNTS = {
  accept: 8,
  condition: 8,
  complete: 8,
  reward: 8
} as const;

export type QuestPolicyStage = keyof typeof QUEST_POLICY_EXPECTED_STAGE_COUNTS;
export type QuestPolicyEvidenceLevel = typeof QUEST_POLICY_EVIDENCE_LEVEL;
export type QuestPolicyServerBoundary = "client-dialogue" | "offline-policy";

export interface QuestPolicySourceReference {
  readonly sourceArtifact: "Quest.lib";
  readonly sourceMember: string;
  readonly archiveMemberOffset: number;
  readonly sourceHash: string;
  readonly s4ExportPath: string;
  readonly s4ExportBlobSha: string;
  readonly s4JsonPointer: string;
  readonly sourceLineRange: readonly [number, number] | null;
}

export interface QuestPolicyChainRecord {
  readonly recordId: string;
  readonly chainId: string;
  readonly questId: number;
  readonly questIdSemantics: string;
  readonly stage: QuestPolicyStage;
  readonly stageOrder: 1 | 2 | 3 | 4;
  readonly marker: string;
  readonly step: 1 | 2 | 3;
  readonly actorOrMarker: string;
  readonly actorTokenSemantics: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly evidence: string;
  readonly serverBoundary: QuestPolicyServerBoundary;
  readonly notes: string;
  readonly sourceReference: QuestPolicySourceReference;
  readonly evidenceLevel: QuestPolicyEvidenceLevel;
  readonly runtimeVerified: false;
}

export interface QuestPolicySemanticCrossReference {
  readonly questId: number;
  readonly semantic: string;
  readonly b5RecordIndex: number;
  readonly associationType: "semantic-cross-reference-only-not-identity-binding";
  readonly actorTokenJoinPerformed: false;
  readonly entityIdentityAsserted: false;
  readonly evidenceLevel: QuestPolicyEvidenceLevel;
  readonly runtimeVerified: false;
}

export interface QuestPolicyNotRecoveredRecord {
  readonly id: string;
  readonly status: "not-recovered";
  readonly affectedQuestScripts: readonly number[];
  readonly reason: string;
  readonly nextEvidenceNeeded: string;
  readonly evidenceLevel: QuestPolicyEvidenceLevel;
  readonly runtimeVerified: false;
}

export interface QuestPolicyDataset {
  readonly schemaVersion: 1;
  readonly datasetId: typeof QUEST_POLICY_DATASET_ID;
  readonly scope: {
    readonly questChainRecordCount: 32;
    readonly chainStageCounts: typeof QUEST_POLICY_EXPECTED_STAGE_COUNTS;
    readonly sourceRecordCount: 708;
    readonly sourceBranchMarkerCount: 37;
    readonly selectedChainBranchMarkerCount: 24;
    readonly excludedAdditionalCancelMarkerCount: 13;
  };
  readonly chainRecords: readonly QuestPolicyChainRecord[];
  readonly b5SemanticCrossReferences: readonly QuestPolicySemanticCrossReference[];
  readonly notRecovered: readonly QuestPolicyNotRecoveredRecord[];
}

export interface QuestPolicyIssue {
  readonly path: string;
  readonly message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validate counts and evidence boundaries without granting gameplay semantics. */
export function validateQuestPolicyDataset(value: unknown): QuestPolicyIssue[] {
  const issues: QuestPolicyIssue[] = [];
  if (!isRecord(value)) return [{ path: "$", message: "dataset must be an object" }];
  if (value.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "must equal 1" });
  if (value.datasetId !== QUEST_POLICY_DATASET_ID) issues.push({ path: "datasetId", message: "unexpected dataset identifier" });

  const scope = value.scope;
  if (!isRecord(scope)) {
    issues.push({ path: "scope", message: "scope metadata is required" });
  } else {
    if (scope.questChainRecordCount !== 32) issues.push({ path: "scope.questChainRecordCount", message: "must equal 32" });
    if (scope.sourceRecordCount !== 708) issues.push({ path: "scope.sourceRecordCount", message: "must equal 708" });
    if (scope.sourceBranchMarkerCount !== 37) issues.push({ path: "scope.sourceBranchMarkerCount", message: "must equal 37" });
    if (scope.selectedChainBranchMarkerCount !== 24) issues.push({ path: "scope.selectedChainBranchMarkerCount", message: "must equal 24" });
    if (scope.excludedAdditionalCancelMarkerCount !== 13) issues.push({ path: "scope.excludedAdditionalCancelMarkerCount", message: "must equal 13" });
  }

  if (!Array.isArray(value.chainRecords)) {
    issues.push({ path: "chainRecords", message: "chainRecords must be an array" });
  } else {
    const records = value.chainRecords;
    if (records.length !== 32) issues.push({ path: "chainRecords", message: "must contain exactly 32 records" });
    const counts: Record<string, number> = {};
    const ids = new Set<string>();
    for (let index = 0; index < records.length; index += 1) {
      const path = "chainRecords[" + index + "]";
      const row = records[index];
      if (!isRecord(row)) { issues.push({ path, message: "record must be an object" }); continue; }
      if (typeof row.recordId !== "string" || ids.has(row.recordId)) issues.push({ path: path + ".recordId", message: "recordId must be unique" });
      else ids.add(row.recordId);
      if (typeof row.stage === "string") counts[row.stage] = (counts[row.stage] || 0) + 1;
      if (row.evidenceLevel !== QUEST_POLICY_EVIDENCE_LEVEL) issues.push({ path: path + ".evidenceLevel", message: "must remain RECOVERED_SECONDARY" });
      if (row.runtimeVerified !== false) issues.push({ path: path + ".runtimeVerified", message: "must remain false" });
      if (row.stage === "accept" && (row.marker !== "SELECT" || row.step !== 1)) issues.push({ path, message: "accept must reference STEP 1 SELECT" });
      if (row.stage === "condition" && (row.marker !== "SCRIPT" || row.step !== 2)) issues.push({ path, message: "condition must reference STEP 2 SCRIPT" });
      if (row.stage === "complete" && (row.marker !== "CANCEL" || row.step !== 3)) issues.push({ path, message: "complete must reference STEP 3 CANCEL" });
      if (row.stage === "reward" && (row.marker !== "OFFLINE_POLICY" || row.lineStart !== 0 || row.lineEnd !== 0)) issues.push({ path, message: "reward must remain an explicit source-gap row" });
      if (!isRecord(row.sourceReference)) issues.push({ path: path + ".sourceReference", message: "source reference is required" });
    }
    for (const stage of Object.keys(QUEST_POLICY_EXPECTED_STAGE_COUNTS) as QuestPolicyStage[]) {
      if (counts[stage] !== QUEST_POLICY_EXPECTED_STAGE_COUNTS[stage]) issues.push({ path: "chainRecords", message: "stage count mismatch for " + stage });
    }
    for (let questId = 1; questId <= 8; questId += 1) {
      for (const stage of Object.keys(QUEST_POLICY_EXPECTED_STAGE_COUNTS) as QuestPolicyStage[]) {
        const matches = records.filter(row => isRecord(row) && row.questId === questId && row.stage === stage);
        if (matches.length !== 1) issues.push({ path: "chainRecords", message: "Quest" + questId + " must have exactly one " + stage + " row" });
      }
    }
  }

  if (!Array.isArray(value.b5SemanticCrossReferences)) {
    issues.push({ path: "b5SemanticCrossReferences", message: "must be an array" });
  } else {
    if (value.b5SemanticCrossReferences.length !== 8) issues.push({ path: "b5SemanticCrossReferences", message: "must contain eight Quest1-8 semantic references" });
    value.b5SemanticCrossReferences.forEach((entry, index) => {
      const path = "b5SemanticCrossReferences[" + index + "]";
      if (!isRecord(entry)) { issues.push({ path, message: "entry must be an object" }); return; }
      if (entry.associationType !== "semantic-cross-reference-only-not-identity-binding") issues.push({ path, message: "must remain a semantic-only cross-reference" });
      if (entry.actorTokenJoinPerformed !== false || entry.entityIdentityAsserted !== false) issues.push({ path, message: "must not assert an Actor/entity identity join" });
      if (entry.evidenceLevel !== QUEST_POLICY_EVIDENCE_LEVEL || entry.runtimeVerified !== false) issues.push({ path, message: "evidence boundary mismatch" });
    });
  }

  if (!Array.isArray(value.notRecovered)) {
    issues.push({ path: "notRecovered", message: "notRecovered must be an array" });
  } else {
    value.notRecovered.forEach((entry, index) => {
      const path = "notRecovered[" + index + "]";
      if (!isRecord(entry)) { issues.push({ path, message: "entry must be an object" }); return; }
      if (entry.status !== "not-recovered") issues.push({ path: path + ".status", message: "must remain not-recovered" });
      if (entry.evidenceLevel !== QUEST_POLICY_EVIDENCE_LEVEL || entry.runtimeVerified !== false) issues.push({ path, message: "evidence boundary mismatch" });
    });
  }
  return issues;
}

/** The policy is intentionally read-only; no quest execution API is exported. */
export const QUEST_POLICY_RUNTIME_MUTATIONS_ENABLED = false as const;
