/**
 * S4 Terry ferry route policy (B6).
 *
 * Evidence: RECOVERED_SECONDARY / 重构参考 only.
 * Sources: ybcs_offline_npc_transport.py static route literals, Quest.lib
 * NPCScript.txt programs 48/49, and the B3 NPC menu-action export.
 *
 * This module provides pure validation and exact route lookup only. It does
 * not emit packets, mutate game state, infer NPC placement coordinates, or
 * claim that retail/server ferry responses have been recovered.
 */

export const TERRY_FERRY_POLICY = {
  evidenceLevel: "RECOVERED_SECONDARY",
  evidenceLabel: "重构参考",
  runtimeVerified: false,
  allBusinessActionsDisabled: true,
  autoActivation: false,
  wireEmissionAllowed: false,
  domainMutation: false,
  retailServerBehaviorClaimed: false,
  scope: "two-static-YBCS-Terry-ferry-routes-only",
  routeModule: "ybcs_offline_npc_transport.py",
  requestedRouteModuleName: "ybcs_npc_travel.py",
  attachmentNameMismatch: true,
} as const;

export type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type OldMapId = Brand<string, "OldMapId">;
export type NpcEntityId = Brand<number, "NpcEntityId">;
export type NpcProgramIndex = 48 | 49;
export type NpcOptionOrdinal = Brand<number, "NpcOptionOrdinal">;
export type SmfObjectId = Brand<number, "SmfObjectId">;

export interface MapCell {
  x: number;
  y: number;
}

export interface FerryRoute {
  id: string;
  direction: "outbound" | "return";
  sourceMapId: OldMapId;
  npcEntityId: NpcEntityId;
  npcProgramIndex: NpcProgramIndex;
  targetMapId: OldMapId;
  targetMapWire: number;
  arrivalCoordinates: MapCell;
  routeActionSentinel: -1;
  resolverConsumesActionParameter: false;
}

/**
 * npcEntityId is the route module's npc_entity_id field.
 * It is not an SMF object_id, NPC template ID, or program index.
 */
export function isValidNpcEntityId(value: number): value is NpcEntityId {
  return Number.isInteger(value) && value >= 1 && value <= 0x7fff;
}

export function isValidOldMapId(value: string): value is OldMapId {
  return value.startsWith("map:old:");
}

export function isValidMapCell(value: MapCell): boolean {
  return Number.isInteger(value.x) && value.x >= 0 &&
    Number.isInteger(value.y) && value.y >= 0;
}

export function validateFerryRoute(route: FerryRoute): boolean {
  return route.id.length > 0 &&
    (route.direction === "outbound" || route.direction === "return") &&
    isValidOldMapId(route.sourceMapId) &&
    isValidOldMapId(route.targetMapId) &&
    isValidNpcEntityId(route.npcEntityId) &&
    (route.npcProgramIndex === 48 || route.npcProgramIndex === 49) &&
    Number.isInteger(route.targetMapWire) &&
    route.targetMapWire >= -0x8000 &&
    route.targetMapWire <= 0x7fff &&
    isValidMapCell(route.arrivalCoordinates) &&
    route.routeActionSentinel === -1 &&
    route.resolverConsumesActionParameter === false;
}

/**
 * Mirrors resolve_offline_npc_transport(map_id, npc_entity_id,
 * npc_program_index): exact source-scoped lookup, unique match only.
 * The native action sentinel is deliberately not an input to this resolver.
 */
export function resolveOfflineTerryFerryRoute(
  routes: readonly FerryRoute[],
  sourceMapId: string,
  npcEntityId: number,
  npcProgramIndex: number,
): FerryRoute | null {
  const matches = routes.filter(route =>
    route.sourceMapId === sourceMapId &&
    route.npcEntityId === npcEntityId &&
    route.npcProgramIndex === npcProgramIndex
  );
  return matches.length === 1 ? matches[0] : null;
}

export type FerryMenuRole =
  | "dialogue-option"
  | "destination-route-selector"
  | "close-menu";

export interface FerryMenuAction {
  programIndex: number;
  optionOrdinal: number;
  sourceLineNumber: number;
  sourceRowIndex: number;
  resourceKind: 2;
  role: FerryMenuRole;
  serviceAction: number | null;
  uplinkShape: string;
  validationStatus: string;
  serverResponseStatus: string;
}

/**
 * optionOrdinal, sourceLineNumber, sourceRowIndex, resourceKind and
 * serviceAction remain distinct fields. kind=2 is never an action ID.
 */
export function validateFerryMenuAction(action: FerryMenuAction): boolean {
  if (action.programIndex !== 48 && action.programIndex !== 49) return false;
  if (action.resourceKind !== 2 || !Number.isInteger(action.optionOrdinal)) return false;
  if (action.optionOrdinal < 0 || action.sourceLineNumber <= 0 || action.sourceRowIndex < 0) return false;

  if (action.role === "dialogue-option") {
    return action.optionOrdinal === 0 &&
      action.serviceAction === null &&
      action.uplinkShape === "49 09 <i16 target_word>" &&
      action.validationStatus === "validated-no-response";
  }
  if (action.role === "destination-route-selector") {
    return action.optionOrdinal === 1 &&
      action.serviceAction === -1 &&
      action.uplinkShape === "30 <i16 target_word> <i16 action=-1>" &&
      action.validationStatus === "validated-no-response" &&
      action.serverResponseStatus === "not-recovered";
  }
  return action.optionOrdinal === 2 &&
    action.serviceAction === null &&
    action.uplinkShape === "none" &&
    action.validationStatus === "close-only-no-uplink";
}

/** B3 local-child request shapes; none applies to ferry programs 48 or 49. */
export const LOCAL_CHILD_REQUEST_SHAPES = [
  {
    requestPrefix: "49 05",
    programIndexes: [12, 32],
    optionOrdinal: 2,
    localDialogId: 0xd2,
    expectedBytes: 24,
  },
  {
    requestPrefix: "49 06",
    programIndexes: [11],
    optionOrdinal: 2,
    localDialogId: 0xd3,
    expectedBytes: 4,
  },
  {
    requestPrefix: "49 07",
    programIndexes: [11],
    optionOrdinal: 3,
    localDialogId: 0xd4,
    expectedBytes: 6,
  },
] as const;

export function isLocalChildRequestApplicableToFerry(
  requestPrefix: "49 05" | "49 06" | "49 07",
  ferryProgramIndex: number,
): boolean {
  const shape = LOCAL_CHILD_REQUEST_SHAPES.find(
    item => item.requestPrefix === requestPrefix
  );
  return shape !== undefined && shape.programIndexes.includes(
    ferryProgramIndex as never
  );
}

/**
 * B3 action -1 and TERRY_FERRY_ACTION -1 are numerically aligned sentinels.
 * The offline route resolver does not consume an action argument; this
 * correlation does not establish a retail/server business response.
 */
export const TERRY_FERRY_ACTION_SENTINEL = -1 as const;
export const FERRY_PROGRAM_INDEXES = [48, 49] as const;
export const FERRY_MENU_OPTION_ORDINALS = {
  dialogue: 0,
  destination: 1,
  close: 2,
} as const;

export const FERRY_POLICY_LIMITATIONS = [
  "Only two static YBCS Terry ferry routes are represented.",
  "NPC placement coordinates are not recovered; arrivalCoordinates are target_spawn cells.",
  "NPC entity IDs are not SMF object IDs or NPC template IDs.",
  "B3 reports validated-no-response; retail/server responses remain unrecovered.",
  "B3 local-child requests 49 05/06/07 do not apply to ferry programs 48/49.",
  "Magic-stone destinations are outside B6 and remain B7 BLOCKED.",
] as const;
