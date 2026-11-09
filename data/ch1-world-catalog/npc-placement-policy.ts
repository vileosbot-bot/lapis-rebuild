/**
 * B5-A/B5-B static policy for old-client NPC placement candidates.
 *
 * These records are explicit single-player offline policy, not recovered
 * retail placement data. This file validates references only; it does not
 * deploy NPCs, mutate GameDomain, create followers, or execute gameplay.
 */
export const NPC_PLACEMENT_POLICY = {
  datasetId: "ybcs-ch1-npc-placement-candidates",
  sourceArtifact: "src/legacy_gui_runtime/ybcs_offline_npc_placements.py",
  sourceSha256: "16c76bd6b0335ab679a8c2c35192c3ee0b76974b8348a1e18f2031c8720478a1",
  provenance: "offline-policy",
  evidenceLevel: "RECOVERED_SECONDARY",
  runtimeVerified: false,
  retailPlacementTableRecovered: false,
  mapIdNamespace: "map:old:NNNN",
  mapWireRule: "exact four-digit suffix NNNN; require exact B2 mapId and mapWire match",
  coordinateSpace: "old-imf-map-cell",
  coordinateFields: { first: "x", second: "y" },
  npcProgramIndex: {
    minimum: 11,
    maximum: 49,
    meaning: "NPCScript service-program reference only",
    mayBeUsedAsEntityId: false,
    mayBeUsedAsCoordinate: false,
    mayGeneratePlacement: false
  },
  questSemantic: {
    meaning: "source-declared offline semantic string",
    automaticQuestActorJoinAllowed: false,
    automaticNpcProgramJoinAllowed: false
  },
  persistence: {
    transientSessionOutputOnly: true,
    copyIntoGameDomainSave: false,
    promoteToFollower: false,
    runtimeDeploymentImplemented: false
  },
  crossValidation: {
    mapReferences: {
      status: "pass",
      candidateRows: 29,
      distinctMapIds: 23,
      matchedRows: 29,
      worldCatalogMembers: 108,
      unmatchedMapIds: []
    },
    npcScriptProgramAssociation: {
      status: "pass",
      programDirectoryCount: 39,
      programIndexRange: [11, 49],
      referencedRows: 24,
      matchedReferences: 24,
      unmatchedProgramIndices: []
    },
    routeAndDoorCoordinateConflicts: {
      status: "partial-not-recovered",
      routeRecords: 93,
      targetSpawnCoordinatesChecked: 93,
      targetSpawnCollisions: 0,
      routeRecordsWithDeclaredApproachCoordinates: 14,
      declaredApproachCellsChecked: 91,
      declaredApproachCellCollisions: 0,
      routeRecordsWithoutApproachCoordinates: 79,
      doorMarkerTupleRecords: 13,
      distinctDoorTargetInteriors: 12,
      doorMarkerCoordinates: "not-recovered",
      candidatesOnDoorMarkerSourceMap: 4
    }
  }
} as const;

export type NpcPlacementCandidate = {
  map_id: string;
  map_wire: number;
  entity_id: number;
  name: string;
  model_id: number;
  first: number;
  second: number;
  role: string;
  dialog_text: string | null;
  quest_semantic: string | null;
  npc_program_index: number | null;
  provenance: "offline-policy";
  evidenceLevel: "RECOVERED_SECONDARY";
  runtimeVerified: false;
};

export type NpcPlacementReferenceValidation = {
  mapReference: "matched" | "not-recovered";
  programReference: "catalog-program-match" | "not-declared-in-source" | "not-recovered";
};

/**
 * Convert only the exact map:old:NNNN namespace. No proximity or fuzzy
 * mapping is permitted. The caller must still verify the resulting mapWire
 * against B2's exact mapId/mapWire pair.
 */
export function mapWireFromOldMapId(mapId: string): number | null {
  const match = /^map:old:(\d{4})$/.exec(mapId);
  return match ? Number(match[1]) : null;
}

/**
 * Validate references only. npc_program_index remains a service-program
 * reference and is never converted into an entity ID or a coordinate.
 */
export function validateNpcPlacementReferences(
  candidate: NpcPlacementCandidate,
  knownMapWires: ReadonlySet<number>,
  npcScriptProgramIndices: ReadonlySet<number>
): NpcPlacementReferenceValidation {
  const parsedWire = mapWireFromOldMapId(candidate.map_id);
  const mapReference =
    parsedWire !== null &&
    parsedWire === candidate.map_wire &&
    knownMapWires.has(parsedWire)
      ? "matched"
      : "not-recovered";

  const programReference =
    candidate.npc_program_index === null
      ? "not-declared-in-source"
      : npcScriptProgramIndices.has(candidate.npc_program_index)
        ? "catalog-program-match"
        : "not-recovered";

  return { mapReference, programReference };
}

/**
 * The route/gate collision result is intentionally partial. B4-2 exposes all
 * 93 target spawns and 91 declared approach cells across 14 records, but
 * omits approach coordinates for 79 records and all 13 door-marker tuple
 * coordinate sets. Consumers must not reinterpret this as a global no-
 * collision proof.
 */
export const NPC_PLACEMENT_GEOMETRY_AUDIT_STATUS =
  "partial-not-recovered" as const;
