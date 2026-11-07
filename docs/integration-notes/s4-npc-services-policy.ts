/**
 * S4 NPC service resource policy.
 *
 * Evidence: RECOVERED_SECONDARY / 重构参考. This module exposes resource
 * inspection and conservative UI projection only. It does not emit wires,
 * mutate gameplay state, or enable business actions.
 *
 * IMPORTANT: optionOrdinal is a zero-based index among enabled kind=2 rows
 * inside one NPCScript program. It is NOT a network action ID.
 */

export type EvidenceLevel = "RECOVERED_SECONDARY";

export interface SourceProvenance {
  sourceProject: "ybcs-offline";
  sourceArtifact: string;
  sourceMember: string;
  sourceHash: string;
  sourceRecord: string;
  evidenceLevel: EvidenceLevel;
  evidenceLabel: "重构参考";
  runtimeVerified: false;
}

export interface NpcScriptMenuRow extends SourceProvenance {
  lineNumber: number;
  rawLine: string;
  rowIndex: number;
  kind: 1 | 2;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  enabled: boolean;
  optionOrdinal: number | null;
}

export interface NpcScriptProgram extends SourceProvenance {
  programIndex: number;
  title: string;
  declaredCount: number;
  headerLineNumber: number;
  rawHeaderLine: string;
  sourceLineStart: number;
  sourceLineEnd: number;
  menuRows: NpcScriptMenuRow[];
  greetingCount: number;
  selectableOptionCount: number;
  disabledDeclaredRowCount: number;
  businessActionsEnabled: false;
  autoActivation: false;
}

export interface NpcServiceSemanticMapping extends SourceProvenance {
  program_index: number;
  title: string;
  category: string;
  gameplay_effect: string;
  businessActionsEnabled: false;
  autoActivation: false;
}

export interface NpcSourceLine extends SourceProvenance {
  lineNumber: number;
  rawLine: string;
  lineRole: string;
  enabled?: boolean | null;
  programIndex?: number | null;
  optionOrdinal?: number | null;
  [key: string]: unknown;
}

export interface NpcServicesDataset {
  schemaVersion: 1;
  dataset: "s4.npcServices";
  npcScriptPrograms: NpcScriptProgram[];
  npcScriptSourceLines: NpcSourceLine[];
  semanticMappings: {
    mappingCount: number;
    programs: NpcServiceSemanticMapping[];
    sourceProject: "ybcs-offline";
    sourceArtifact: "ybcs_npc_service_catalog.py";
    sourceMember: string;
    sourceHash: string;
    sourceRecord: string;
    evidenceLevel: EvidenceLevel;
    evidenceLabel: "重构参考";
    runtimeVerified: false;
  };
  safeServicePolicy: {
    inspectionAllowed: true;
    uiPresentationAllowed: true;
    businessActionsEnabled: false;
    autoActivation: false;
    defaultActionState: "disabled-by-default";
    optionOrdinalMeaning: string;
    optionOrdinalIsNetworkActionId: false;
    semanticMappingsAreSeparateFromNpcScriptPrograms: true;
    retailServerResponse: "not recovered by this export";
    gameplayMutation: false;
    wireEmission: false;
  };
}

export const NPC_SERVICE_POLICY = {
  inspectionAllowed: true,
  uiPresentationAllowed: true,
  businessActionsEnabled: false,
  autoActivation: false,
  defaultActionState: "disabled-by-default",
  optionOrdinalIsNetworkActionId: false,
} as const;

export function getSelectableOptions(program: NpcScriptProgram): NpcScriptMenuRow[] {
  return program.menuRows.filter((row) => row.kind === 2 && row.enabled);
}

export function validateNpcServicesDataset(dataset: NpcServicesDataset): string[] {
  const errors: string[] = [];
  const expectedIndexes = Array.from({ length: 39 }, (_, index) => index + 11);
  const actualIndexes = dataset.npcScriptPrograms.map((program) => program.programIndex);

  if (dataset.schemaVersion !== 1 || dataset.dataset !== "s4.npcServices") {
    errors.push("unsupported NPC services dataset schema");
  }
  if (actualIndexes.length !== 39 || actualIndexes.some((value, index) => value !== expectedIndexes[index])) {
    errors.push("NPCScript program indexes must be exactly 11..49 in order");
  }
  if (dataset.semanticMappings.mappingCount !== 39 || dataset.semanticMappings.programs.length !== 39) {
    errors.push("semantic mapping count must be 39");
  }
  if (dataset.semanticMappings.sourceArtifact !== "ybcs_npc_service_catalog.py") {
    errors.push("semantic mapping provenance must remain separate from Quest.lib");
  }
  if (dataset.safeServicePolicy.businessActionsEnabled !== false || dataset.safeServicePolicy.autoActivation !== false) {
    errors.push("business actions and automatic activation must remain disabled");
  }
  if (dataset.safeServicePolicy.optionOrdinalIsNetworkActionId !== false) {
    errors.push("optionOrdinal must not be interpreted as a network action ID");
  }

  for (const program of dataset.npcScriptPrograms) {
    if (program.declaredCount !== program.menuRows.length) {
      errors.push(`program ${program.programIndex}: declaredCount does not match menuRows.length`);
    }
    if (program.businessActionsEnabled !== false || program.autoActivation !== false) {
      errors.push(`program ${program.programIndex}: business action policy is not disabled`);
    }
    let ordinal = 0;
    for (const row of program.menuRows) {
      if (row.kind === 2 && row.enabled) {
        if (row.optionOrdinal !== ordinal) {
          errors.push(`program ${program.programIndex}: optionOrdinal sequence is invalid at line ${row.lineNumber}`);
        }
        ordinal += 1;
      } else if (row.optionOrdinal !== null) {
        errors.push(`program ${program.programIndex}: non-selectable row has an optionOrdinal at line ${row.lineNumber}`);
      }
      if (row.evidenceLevel !== "RECOVERED_SECONDARY" || row.runtimeVerified !== false) {
        errors.push(`program ${program.programIndex}: invalid evidence metadata at line ${row.lineNumber}`);
      }
    }
    if (ordinal !== program.selectableOptionCount) {
      errors.push(`program ${program.programIndex}: selectableOptionCount mismatch`);
    }
  }

  for (const line of dataset.npcScriptSourceLines) {
    if (line.evidenceLevel !== "RECOVERED_SECONDARY" || line.runtimeVerified !== false) {
      errors.push(`source line ${line.lineNumber}: invalid evidence metadata`);
    }
  }
  for (const semantic of dataset.semanticMappings.programs) {
    if (semantic.evidenceLevel !== "RECOVERED_SECONDARY" || semantic.runtimeVerified !== false) {
      errors.push(`semantic mapping ${semantic.program_index}: invalid evidence metadata`);
    }
    if (semantic.businessActionsEnabled !== false || semantic.autoActivation !== false) {
      errors.push(`semantic mapping ${semantic.program_index}: action policy is not disabled`);
    }
  }
  return errors;
}
