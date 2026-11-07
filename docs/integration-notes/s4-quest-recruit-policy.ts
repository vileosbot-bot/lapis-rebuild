/**
 * S4 Quest/recruitment data policy.
 *
 * Source: ybcs-offline Quest.lib (RECOVERED_SECONDARY / 重构参考).
 * This module validates and reads exported resource evidence only. It does not
 * implement server quest conditions, recruitment mutations, rewards, or saves.
 */

export const S4_QUEST_RECRUIT_EVIDENCE_LEVEL = "RECOVERED_SECONDARY" as const;
export const S4_QUEST_RECRUIT_EVIDENCE_LABEL = "重构参考" as const;
export const S4_QUEST_RECRUIT_RUNTIME_VERIFIED = false as const;

export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type QuestScriptNumber = Brand<number, "QuestScriptNumber">;
export type QuestActorToken = Brand<string, "QuestActorToken">;
export type NpcTemplateId = Brand<number, "NpcTemplateId">;
export type NpcEntityId = Brand<number, "NpcEntityId">;
export type SmfObjectId = Brand<number, "SmfObjectId">;

export interface SourceRecord {
  readonly recordType: string;
  readonly [key: string]: unknown;
}

export interface SourceProvenance {
  readonly sourceProject: "ybcs-offline";
  readonly sourceArtifact: "Quest.lib";
  readonly sourceMember: string;
  readonly sourceHash: string;
  readonly sourceRecord: SourceRecord;
  readonly evidenceLevel: typeof S4_QUEST_RECRUIT_EVIDENCE_LEVEL;
  readonly evidenceLabel: typeof S4_QUEST_RECRUIT_EVIDENCE_LABEL;
  readonly runtimeVerified: false;
}

export interface QuestCommand extends SourceProvenance {
  readonly kind: string;
  readonly line: number;
  readonly step: number | null;
  readonly actor: QuestActorToken | null;
  readonly text: string;
  readonly choices: readonly string[];
}

export interface QuestTextLine extends SourceProvenance {
  readonly line: number;
  readonly text: string;
}

export interface QuestBranchMarker extends SourceProvenance {
  readonly marker: "SELECT" | "SCRIPT" | "CANCEL";
  readonly step: number | null;
  readonly actorReference: QuestActorToken | null;
  readonly actorReferenceSemantics: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly textLines: readonly QuestTextLine[];
}

export interface QuestRecruitmentEvidence extends SourceProvenance {
  readonly status: "scripted-selection-branch-present";
  readonly classification: "quest-selection-branch-with-companion-context";
  readonly candidateActorReference: QuestActorToken | null;
  readonly candidateActorReferenceSemantics: string;
  readonly selectionBranch: QuestBranchMarker;
  readonly step2BranchMarkers: readonly QuestBranchMarker[];
  readonly step3BranchMarkers: readonly QuestBranchMarker[];
  readonly selectionText: string;
  readonly semanticNote: string;
  readonly serverRecruitmentMutation: "not-recovered";
  readonly recruitmentConditions: null;
  readonly recruitmentRewards: null;
}

export interface QuestScriptRecord extends SourceProvenance {
  readonly scriptNumber: QuestScriptNumber;
  readonly memberName: string;
  readonly lineCount: number;
  readonly commandCount: number;
  readonly commandCounts: Readonly<Record<string, number>>;
  readonly unknownCommands: readonly string[];
  readonly commands: readonly QuestCommand[];
  readonly narrativeBlocks: readonly (SourceProvenance & {
    readonly nameLine: number;
    readonly actorReference: QuestActorToken | null;
    readonly actorReferenceSemantics: string;
    readonly textLines: readonly QuestTextLine[];
  })[];
  readonly recruitmentEvidence: QuestRecruitmentEvidence;
}

export interface S4QuestRecruitDataset {
  readonly schemaVersion: 1;
  readonly dataset: "s4.questRecruit";
  readonly provenance: {
    readonly sourceProject: "ybcs-offline";
    readonly sourceArtifact: "Quest.lib";
    readonly sourceHash: string;
    readonly evidenceLevel: typeof S4_QUEST_RECRUIT_EVIDENCE_LEVEL;
    readonly evidenceLabel: typeof S4_QUEST_RECRUIT_EVIDENCE_LABEL;
    readonly runtimeVerified: false;
    readonly parserArtifacts: Readonly<Record<string, string>>;
    readonly archiveCheck: string;
    readonly archiveEntryCount: number;
    readonly limitations: readonly string[];
  };
  readonly archiveInventory: readonly (SourceProvenance & {
    readonly memberName: string;
    readonly packedSize: number;
    readonly unpackedSize: number;
    readonly memberOffset: number;
  })[];
  readonly npcScriptInventory: SourceProvenance & {
    readonly memberName: string;
    readonly lineCount: number;
    readonly programCount: number;
    readonly programRange: readonly [number, number];
    readonly scopeNote: string;
  };
  readonly questScripts: readonly QuestScriptRecord[];
}

export interface PolicyIssue {
  readonly path: string;
  readonly message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validateProvenance(value: unknown, path: string, issues: PolicyIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "record must be an object with provenance" });
    return;
  }
  if (value.sourceProject !== "ybcs-offline") issues.push({ path, message: "sourceProject must be ybcs-offline" });
  if (value.sourceArtifact !== "Quest.lib") issues.push({ path, message: "sourceArtifact must be Quest.lib" });
  if (typeof value.sourceMember !== "string" || value.sourceMember.length === 0) issues.push({ path, message: "sourceMember is required" });
  if (typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceHash)) issues.push({ path, message: "sourceHash must be a SHA-256 hex digest" });
  if (!isRecord(value.sourceRecord) || typeof value.sourceRecord.recordType !== "string") issues.push({ path, message: "sourceRecord.recordType is required" });
  if (value.evidenceLevel !== S4_QUEST_RECRUIT_EVIDENCE_LEVEL) issues.push({ path, message: "evidenceLevel must remain RECOVERED_SECONDARY" });
  if (value.evidenceLabel !== S4_QUEST_RECRUIT_EVIDENCE_LABEL) issues.push({ path, message: "evidenceLabel must remain 重构参考" });
  if (value.runtimeVerified !== false) issues.push({ path, message: "runtimeVerified must remain false" });
}

/** Validate exported data without assigning retail/server semantics to it. */
export function validateS4QuestRecruitDataset(value: unknown): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  if (!isRecord(value)) return [{ path: "$", message: "dataset must be an object" }];
  if (value.schemaVersion !== 1) issues.push({ path: "schemaVersion", message: "unsupported schema version" });
  if (value.dataset !== "s4.questRecruit") issues.push({ path: "dataset", message: "unexpected dataset identifier" });
  const provenance = value.provenance;
  if (!isRecord(provenance)) {
    issues.push({ path: "provenance", message: "dataset provenance is required" });
  } else {
    if (provenance.sourceProject !== "ybcs-offline") issues.push({ path: "provenance.sourceProject", message: "must be ybcs-offline" });
    if (provenance.sourceArtifact !== "Quest.lib") issues.push({ path: "provenance.sourceArtifact", message: "must be Quest.lib" });
    if (provenance.evidenceLevel !== S4_QUEST_RECRUIT_EVIDENCE_LEVEL) issues.push({ path: "provenance.evidenceLevel", message: "must remain RECOVERED_SECONDARY" });
    if (provenance.evidenceLabel !== S4_QUEST_RECRUIT_EVIDENCE_LABEL) issues.push({ path: "provenance.evidenceLabel", message: "must remain 重构参考" });
    if (provenance.runtimeVerified !== false) issues.push({ path: "provenance.runtimeVerified", message: "must remain false" });
  }
  if (!Array.isArray(value.questScripts)) {
    issues.push({ path: "questScripts", message: "questScripts must be an array" });
    return issues;
  }
  const scripts = value.questScripts;
  if (scripts.length !== 8) issues.push({ path: "questScripts", message: "B1 requires exactly the eight source scripts Quest1–Quest8" });
  const seen = new Set<number>();
  scripts.forEach((entry, index) => {
    const path = `questScripts[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, message: "quest script must be an object" });
      return;
    }
    validateProvenance(entry, path, issues);
    const n = entry.scriptNumber;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 8) {
      issues.push({ path: `${path}.scriptNumber`, message: "scriptNumber must be 1..8" });
    } else if (seen.has(n)) {
      issues.push({ path: `${path}.scriptNumber`, message: "duplicate Quest script number" });
    } else {
      seen.add(n);
    }
    if (typeof entry.lineCount !== "number" || entry.lineCount <= 0) issues.push({ path: `${path}.lineCount`, message: "lineCount must be positive" });
    if (!Array.isArray(entry.commands)) {
      issues.push({ path: `${path}.commands`, message: "commands must be an array" });
    } else {
      if (entry.commandCount !== entry.commands.length) issues.push({ path: `${path}.commandCount`, message: "commandCount must equal commands.length" });
      entry.commands.forEach((command, commandIndex) => {
        const commandPath = `${path}.commands[${commandIndex}]`;
        validateProvenance(command, commandPath, issues);
        if (isRecord(command) && (!Number.isInteger(command.line) || typeof command.line !== "number" || command.line < 1 || command.line > Number(entry.lineCount))) {
          issues.push({ path: `${commandPath}.line`, message: "command line is outside source member" });
        }
      });
    }
    if (Array.isArray(entry.narrativeBlocks)) {
      entry.narrativeBlocks.forEach((block, blockIndex) => {
        validateProvenance(block, `${path}.narrativeBlocks[${blockIndex}]`, issues);
        if (isRecord(block) && Array.isArray(block.textLines)) {
          block.textLines.forEach((line, lineIndex) => validateProvenance(line, `${path}.narrativeBlocks[${blockIndex}].textLines[${lineIndex}]`, issues));
        }
      });
    }
    const recruitment = entry.recruitmentEvidence;
    validateProvenance(recruitment, `${path}.recruitmentEvidence`, issues);
    if (isRecord(recruitment)) {
      if (recruitment.status !== "scripted-selection-branch-present") issues.push({ path: `${path}.recruitmentEvidence.status`, message: "selection branch evidence is required" });
      if (recruitment.serverRecruitmentMutation !== "not-recovered") issues.push({ path: `${path}.recruitmentEvidence.serverRecruitmentMutation`, message: "must remain not-recovered" });
      if (recruitment.recruitmentConditions !== null) issues.push({ path: `${path}.recruitmentEvidence.recruitmentConditions`, message: "unrecovered conditions must remain null" });
      if (recruitment.recruitmentRewards !== null) issues.push({ path: `${path}.recruitmentEvidence.recruitmentRewards`, message: "unrecovered rewards must remain null" });
      validateProvenance(recruitment.selectionBranch, `${path}.recruitmentEvidence.selectionBranch`, issues);
      if (isRecord(recruitment.selectionBranch) && Array.isArray(recruitment.selectionBranch.textLines)) {
        recruitment.selectionBranch.textLines.forEach((line, lineIndex) => validateProvenance(line, `${path}.recruitmentEvidence.selectionBranch.textLines[${lineIndex}]`, issues));
      }
      if (!Array.isArray(recruitment.step2BranchMarkers) || recruitment.step2BranchMarkers.length === 0) {
        issues.push({ path: `${path}.recruitmentEvidence.step2BranchMarkers`, message: "step 2 branch evidence is required" });
      } else {
        recruitment.step2BranchMarkers.forEach((marker, markerIndex) => validateProvenance(marker, `${path}.recruitmentEvidence.step2BranchMarkers[${markerIndex}]`, issues));
      }
      if (!Array.isArray(recruitment.step3BranchMarkers) || recruitment.step3BranchMarkers.length === 0) {
        issues.push({ path: `${path}.recruitmentEvidence.step3BranchMarkers`, message: "step 3 branch evidence is required" });
      } else {
        recruitment.step3BranchMarkers.forEach((marker, markerIndex) => validateProvenance(marker, `${path}.recruitmentEvidence.step3BranchMarkers[${markerIndex}]`, issues));
      }
    }
  });
  for (let n = 1; n <= 8; n += 1) if (!seen.has(n)) issues.push({ path: "questScripts", message: `Quest${n} is missing` });
  return issues;
}

/** Return the source-backed branch record; this is inspection only. */
export function getQuestRecruitmentEvidence(
  dataset: S4QuestRecruitDataset,
  scriptNumber: number,
): QuestRecruitmentEvidence | undefined {
  return dataset.questScripts.find((script) => script.scriptNumber === scriptNumber)?.recruitmentEvidence;
}

/** Explicitly reports that server-side recruitment mutation is not recovered. */
export function isServerRecruitmentMutationRecovered(
  _dataset: S4QuestRecruitDataset,
  _scriptNumber: number,
): false {
  return false;
}
