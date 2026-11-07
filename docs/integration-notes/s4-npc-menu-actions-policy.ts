/**
 * S4 NPC menu action routing policy.
 *
 * Evidence: RECOVERED_SECONDARY / reconstruction reference only.
 * This policy reads route metadata. It does not emit wires, enable business
 * actions, recover server responses, or mutate gameplay state.
 */

export const NPC_MENU_ACTION_EVIDENCE_LEVEL = "RECOVERED_SECONDARY" as const;
export const NPC_MENU_ACTION_EVIDENCE_LABEL = "\u91cd\u6784\u53c2\u8003";

export type NpcMenuRouteClass = "dialogue" | "service" | "localDialog" | "closeOnly";
export type NpcMenuRouteKind =
  | "dialogue-uplink"
  | "service-uplink"
  | "local-dialog"
  | "close-only";
export type NpcMenuValidationStatus =
  | "validated-no-response"
  | "validated-local-child-request"
  | "close-only-no-uplink";

export interface NpcMenuSource {
  sourceProject: "ybcs-offline";
  sourceArtifact: string;
  sourceMember: string;
  sourceHash: string;
  sourceRecord: string;
  evidenceLevel: typeof NPC_MENU_ACTION_EVIDENCE_LEVEL;
  evidenceLabel: string;
  runtimeVerified: false;
}

export interface NpcMenuRoute extends NpcMenuSource {
  programIndex: number;
  programTitle: string;
  optionOrdinal: number;
  sourceLineNumber: number;
  sourceRowIndex: number;
  resourceKind: 2;
  resourceKindMeaning: string;
  rawLine: string;
  text: string;
  routeKind: NpcMenuRouteKind;
  routeClass: NpcMenuRouteClass;
  serviceAction: number | null;
  serviceActionMeaning: string | null;
  localDialogId: number | null;
  localDialogIdHex: string | null;
  callsite: number | null;
  callsiteHex: string | null;
  uplinkShape: string;
  menuSelectionWireEmitted: boolean;
  validationStatus: NpcMenuValidationStatus;
  serverResponseStatus: "not-recovered" | "not-applicable-no-uplink";
  businessResponseRecovered: false;
  businessOperationEnabled: false;
  autoActivation: false;
  wireEmissionAllowed: false;
  domainMutation: false;
  resourceSource: NpcMenuSource;
  semanticSource: NpcMenuSource;
}

export interface NpcMenuRouteGroup {
  dialogue: NpcMenuRoute[];
  service: NpcMenuRoute[];
  localDialog: NpcMenuRoute[];
  closeOnly: NpcMenuRoute[];
}

export interface NpcMenuActionDataset {
  schemaVersion: 1;
  dataset: "s4.npcMenuActions";
  routes: NpcMenuRouteGroup;
  policy: {
    businessActionsEnabled: false;
    autoActivation: false;
    wireEmissionAllowed: false;
    domainMutationAllowed: false;
    defaultActionState: "disabled-by-default";
    businessResponseRecovered: false;
  };
}

export function listNpcMenuRoutes(
  dataset: NpcMenuActionDataset,
  routeClass?: NpcMenuRouteClass,
): NpcMenuRoute[] {
  if (routeClass) return [...dataset.routes[routeClass]];
  return [
    ...dataset.routes.dialogue,
    ...dataset.routes.service,
    ...dataset.routes.localDialog,
    ...dataset.routes.closeOnly,
  ];
}

export function findNpcMenuRoute(
  dataset: NpcMenuActionDataset,
  programIndex: number,
  optionOrdinal: number,
): NpcMenuRoute | undefined {
  return listNpcMenuRoutes(dataset).find(
    (route) => route.programIndex === programIndex && route.optionOrdinal === optionOrdinal,
  );
}

export function isNpcMenuBusinessOperationEnabled(_route: NpcMenuRoute): false {
  return false;
}

export function isNpcMenuBusinessResponseRecovered(_route: NpcMenuRoute): false {
  return false;
}

export function validateNpcMenuRouteDataset(dataset: NpcMenuActionDataset): boolean {
  const routes = listNpcMenuRoutes(dataset);
  const keys = new Set<string>();
  for (const route of routes) {
    if (route.resourceKind !== 2) return false;
    if (route.optionOrdinal < 0 || route.sourceLineNumber < 1 || route.sourceRowIndex < 0) return false;
    if (route.evidenceLevel !== NPC_MENU_ACTION_EVIDENCE_LEVEL || route.runtimeVerified !== false) return false;
    if (route.businessOperationEnabled !== false || route.domainMutation !== false) return false;
    const key = `${route.programIndex}:${route.optionOrdinal}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}
