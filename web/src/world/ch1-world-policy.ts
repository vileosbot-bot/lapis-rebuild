import type {LoadedPack,Collision} from '../model.ts';
import {closestWalkable,findRoute,walkable} from '../coordinates.ts';
import type {Cell} from '../coordinates.ts';
import type {SpatialTrigger} from './spatial-trigger.ts';
import {validateSpatialTriggers} from './spatial-trigger.ts';
import type {WorldGraph,WorldSceneNode} from './world-graph.ts';
import {validateWorldGraph} from './world-graph.ts';

export type Ch1MapId=1000|1020|1030|1060;
export type Ch1SpawnAudit=Readonly<{
  id:string;mapId:Ch1MapId;requestedCell:Cell;effectiveCell:Cell;snapDistanceSquared:number;
  provenance:'RECOVERED_SECONDARY';runtimeVerified:false;
}>;
export type Ch1RoutePolicy=Readonly<{
  routeId:string;sourceMapId:Ch1MapId;targetMapId:Ch1MapId;objectIds:readonly number[];
  declaredApproachAnchors:readonly Cell[];sourceLocator:string;
  sourceArtifact:'src/legacy_gui_runtime/ybcs_session_adapter.py';sourceSha256:string;
  targetSpawn:Ch1SpawnAudit;activationCells:readonly Cell[];
  reachability:Readonly<{originSpawnId:string;originCell:Cell;nearestActivationCell:Cell;steps:number}>;
  provenance:'RECOVERED_SECONDARY';runtimeVerified:false;
}>;
export type Ch1WorldPolicy=Readonly<{
  graph:WorldGraph;triggers:readonly SpatialTrigger[];mapIds:readonly Ch1MapId[];
  spawns:readonly Ch1SpawnAudit[];initial:Ch1SpawnAudit;victoryReturn:Ch1SpawnAudit;
  routes:readonly Ch1RoutePolicy[];provenance:'RECOVERED_SECONDARY';runtimeVerified:false;
}>;

export const CH1_MAPS:readonly Readonly<{id:Ch1MapId;name:string}>[]=Object.freeze([
  Object.freeze({id:1000,name:'卡奥斯_村庄'}),
  Object.freeze({id:1020,name:'卡奥斯_北路'}),
  Object.freeze({id:1030,name:'布日古斯_城'}),
  Object.freeze({id:1060,name:'布日古斯_本城_入口'}),
]);
export const CH1_ROUTE_EXPANSION_SOURCE=Object.freeze({
  helper:'expand_routes_with_installed_portal_cells',artifact:'ybcs_offline_route_resources.py',
  sha256:'16936a583d5e7f6957bc181659b926ac7e66aa471ac3abe3d0ecdace33963119',locator:'L87',
  sourceArtifact:'src/legacy_gui_runtime/ybcs_session_adapter.py',
  sourceSha256:'d35620d4611c93a6dc190332e5e7003eebc09f2c4b50b607ade3bf597f45b448',
  evidence:'RECOVERED_SECONDARY' as const,runtimeVerified:false as const,
});
type SpawnSpec=Readonly<{
  id:string;mapId:Ch1MapId;requestedCell:Cell;expectedEffectiveCell:Cell;expectedSnapDistanceSquared:number;
}>;
const SPAWN_SPECS:readonly SpawnSpec[]=[
  {id:'chapter1-start',mapId:1000,requestedCell:[79,6],expectedEffectiveCell:[93,5],expectedSnapDistanceSquared:197},
  {id:'route-041-arrival',mapId:1000,requestedCell:[79,6],expectedEffectiveCell:[93,5],expectedSnapDistanceSquared:197},
  {id:'route-040-arrival',mapId:1020,requestedCell:[4,173],expectedEffectiveCell:[3,173],expectedSnapDistanceSquared:1},
  {id:'route-049-arrival',mapId:1020,requestedCell:[67,4],expectedEffectiveCell:[66,4],expectedSnapDistanceSquared:1},
  {id:'route-048-arrival',mapId:1030,requestedCell:[6,137],expectedEffectiveCell:[5,137],expectedSnapDistanceSquared:1},
  {id:'story-victory-return-01',mapId:1060,requestedCell:[20,120],expectedEffectiveCell:[20,120],expectedSnapDistanceSquared:0},
];
type RouteSpec=Readonly<{
  routeId:string;sourceMapId:Ch1MapId;targetMapId:Ch1MapId;objectIds:readonly number[];
  declaredApproachAnchors:readonly Cell[];sourceLocator:string;targetSpawnId:string;originSpawnId:string;
  activationCells:readonly Cell[];expectedNearestActivationCell:Cell;expectedReachabilitySteps:number;
}>;
/*
 * These activation arrays are the owner-approved expansion output. The helper
 * intersects kind-112 Route_* rectangles with installed SMF/IMF portal markers,
 * filters walkable cells, retains declared approach anchors, then deduplicates.
 * They are not locally inferred coordinates and do not promote source evidence.
 */
const ROUTE_SPECS:readonly RouteSpec[]=[
  {
    routeId:'main-city-route-040',sourceMapId:1000,targetMapId:1020,objectIds:[131,29],
    declaredApproachAnchors:[[79,6]],sourceLocator:'ybcs_session_adapter.py:L717',
    targetSpawnId:'route-040-arrival',originSpawnId:'chapter1-start',
    activationCells:[[79,6],[139,5],[139,7],[140,4],[140,6],[140,8],[141,3],[141,5],[141,7],[141,9],[142,4],[142,6],[142,8],[143,5],[143,7],[144,6]],
    expectedNearestActivationCell:[139,5],expectedReachabilitySteps:46,
  },
  {
    routeId:'main-city-route-041',sourceMapId:1020,targetMapId:1000,objectIds:[0,11],
    declaredApproachAnchors:[[4,173],[4,182]],sourceLocator:'ybcs_session_adapter.py:L718',
    targetSpawnId:'route-041-arrival',originSpawnId:'route-040-arrival',
    activationCells:[[2,176],[2,178],[3,175],[3,177],[3,179],[4,173],[4,174],[4,176],[4,178],[4,180],[4,182],[5,175],[5,177],[5,179],[6,176],[6,178],[7,177]],
    expectedNearestActivationCell:[4,174],expectedReachabilitySteps:1,
  },
  {
    routeId:'main-city-route-048',sourceMapId:1020,targetMapId:1030,objectIds:[1,12],
    declaredApproachAnchors:[[67,4],[67,13],[68,13]],sourceLocator:'ybcs_session_adapter.py:L735',
    targetSpawnId:'route-048-arrival',originSpawnId:'route-049-arrival',
    activationCells:[[65,7],[65,9],[66,6],[66,8],[66,10],[67,4],[67,5],[67,7],[67,9],[67,11],[67,13],[68,6],[68,8],[68,10],[68,13],[69,7],[69,9],[70,8]],
    expectedNearestActivationCell:[67,5],expectedReachabilitySteps:1,
  },
  {
    routeId:'main-city-route-049',sourceMapId:1030,targetMapId:1020,objectIds:[32,12],
    declaredApproachAnchors:[[6,137],[7,144]],sourceLocator:'ybcs_session_adapter.py:L736',
    targetSpawnId:'route-049-arrival',originSpawnId:'route-048-arrival',
    activationCells:[[4,140],[4,142],[5,139],[5,141],[5,143],[6,137],[6,138],[6,140],[6,142],[6,144],[7,139],[7,141],[7,143],[7,144],[8,140],[8,142],[9,141]],
    expectedNearestActivationCell:[6,138],expectedReachabilitySteps:1,
  },
];
const sameCell=(a:Cell,b:Cell)=>a[0]===b[0]&&a[1]===b[1];
const distanceSquared=(a:Cell,b:Cell)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
const sceneId=(mapId:Ch1MapId)=>'ch1-map-'+mapId;

function resolveSpawn(collision:Collision,spec:SpawnSpec):Ch1SpawnAudit{
  const effectiveCell=closestWalkable(collision,spec.requestedCell);
  const snapDistanceSquared=distanceSquared(spec.requestedCell,effectiveCell);
  if(!sameCell(effectiveCell,spec.expectedEffectiveCell)||snapDistanceSquared!==spec.expectedSnapDistanceSquared){
    throw new Error('Chapter 1 spawn drift for '+spec.id+': requested '+spec.requestedCell.join(',')+
      ', effective '+effectiveCell.join(',')+', snapDistanceSquared '+snapDistanceSquared);
  }
  if(!walkable(collision,effectiveCell))throw new Error('Chapter 1 effective spawn is not walkable: '+spec.id);
  return Object.freeze({
    id:spec.id,mapId:spec.mapId,
    requestedCell:Object.freeze([...spec.requestedCell]) as unknown as Cell,
    effectiveCell:Object.freeze([...effectiveCell]) as unknown as Cell,
    snapDistanceSquared,provenance:'RECOVERED_SECONDARY',runtimeVerified:false,
  });
}

export function createCh1WorldPolicy(pack:Pick<LoadedPack,'maps'>):Ch1WorldPolicy{
  const loaded=new Map<Ch1MapId,LoadedPack['maps'][string]>();
  for(const map of CH1_MAPS){
    const asset=pack.maps[String(map.id)];
    if(!asset)throw new Error('Chapter 1 mode requires map '+map.id+' in scene.pack.maps');
    if(asset.manifest.id!==map.id)throw new Error('Chapter 1 map key/id mismatch for '+map.id);
    const metadata=asset.manifest as typeof asset.manifest&{runtimeVerified?:boolean};
    if(metadata.evidence!=='RECOVERED_SECONDARY'||metadata.runtimeVerified!==false){
      throw new Error('Chapter 1 map evidence boundary mismatch for '+map.id);
    }
    loaded.set(map.id,asset);
  }

  const spawns=SPAWN_SPECS.map(spec=>resolveSpawn(loaded.get(spec.mapId)!.collision,spec));
  const spawnById=(id:string)=>{const spawn=spawns.find(candidate=>candidate.id===id);if(!spawn)throw new Error('Missing Chapter 1 spawn '+id);return spawn;};

  const routes:Ch1RoutePolicy[]=ROUTE_SPECS.map(spec=>{
    const collision=loaded.get(spec.sourceMapId)!.collision;
    const activationCells=spec.activationCells.map(cell=>Object.freeze([...cell]) as unknown as Cell);
    if(new Set(activationCells.map(cell=>cell.join(','))).size!==activationCells.length)throw new Error('Duplicate activation cell in '+spec.routeId);
    const declaredAnchors=new Set(spec.declaredApproachAnchors.map(cell=>cell.join(',')));
    // The source helper deliberately retains declared approach anchors even
    // when the collision grid blocks them; only installed portal cells are
    // required to pass its walkable-cell filter.
    for(const cell of activationCells)if(!declaredAnchors.has(cell.join(','))&&!walkable(collision,cell)){
      throw new Error('Non-walkable expanded portal cell in '+spec.routeId+': '+cell.join(','));
    }
    const origin=spawnById(spec.originSpawnId),target=spawnById(spec.targetSpawnId);
    const reachable=activationCells.map(cell=>({cell,path:findRoute(collision,origin.effectiveCell,cell)}))
      .filter((entry):entry is {cell:Cell;path:Cell[]}=>entry.path!==null)
      .map(entry=>({cell:entry.cell,steps:entry.path.length-1}));
    const minimumSteps=reachable.length?Math.min(...reachable.map(entry=>entry.steps)):Infinity;
    if(minimumSteps!==spec.expectedReachabilitySteps||!reachable.some(entry=>entry.steps===minimumSteps&&sameCell(entry.cell,spec.expectedNearestActivationCell))){
      throw new Error('Chapter 1 route reachability drift for '+spec.routeId+': expected '+spec.expectedReachabilitySteps+' steps');
    }
    return Object.freeze({
      routeId:spec.routeId,sourceMapId:spec.sourceMapId,targetMapId:spec.targetMapId,
      objectIds:Object.freeze([...spec.objectIds]),
      declaredApproachAnchors:Object.freeze(spec.declaredApproachAnchors.map(cell=>Object.freeze([...cell]) as unknown as Cell)),
      sourceLocator:spec.sourceLocator,sourceArtifact:'src/legacy_gui_runtime/ybcs_session_adapter.py',
      sourceSha256:CH1_ROUTE_EXPANSION_SOURCE.sourceSha256,targetSpawn:target,
      activationCells:Object.freeze(activationCells),
      reachability:Object.freeze({originSpawnId:origin.id,originCell:origin.effectiveCell,nearestActivationCell:spec.expectedNearestActivationCell,steps:minimumSteps}),
      provenance:'RECOVERED_SECONDARY',runtimeVerified:false,
    });
  });

  const scenes:WorldSceneNode[]=CH1_MAPS.map(map=>({
    id:sceneId(map.id),mapId:map.id,kind:'field',displayName:map.name,
    provenance:'RECOVERED_SECONDARY',
    spawns:spawns.filter(spawn=>spawn.mapId===map.id).map(spawn=>({
      id:spawn.id,cell:spawn.effectiveCell,provenance:'RECOVERED_SECONDARY',
    })),
  }));
  const transitions=routes.map(route=>({
    id:route.routeId,fromSceneId:sceneId(route.sourceMapId),toSceneId:sceneId(route.targetMapId),
    triggerId:'trigger:'+route.routeId,
    arrivalSpawnId:route.targetSpawn.id,
    reverseEdgeId:ROUTE_SPECS.find(candidate=>candidate.routeId!==route.routeId&&candidate.sourceMapId===route.targetMapId&&candidate.targetMapId===route.sourceMapId)?.routeId,
    provenance:'RECOVERED_SECONDARY' as const,
  }));
  const graph:WorldGraph=validateWorldGraph({
    schema:1,id:'chapter1-main-city',provenance:'RECOVERED_SECONDARY',scenes,transitions,
  });
  const triggers=validateSpatialTriggers(routes.map(route=>({
    id:'trigger:'+route.routeId,mapId:route.sourceMapId,activation:'enter' as const,
    purpose:'scene-transition' as const,zone:{shape:'cells' as const,cells:route.activationCells},
    priority:100,provenance:'RECOVERED_SECONDARY' as const,
  })));
  return Object.freeze({
    graph,triggers,mapIds:Object.freeze(CH1_MAPS.map(map=>map.id)),spawns:Object.freeze(spawns),
    initial:spawnById('chapter1-start'),victoryReturn:spawnById('story-victory-return-01'),
    routes:Object.freeze(routes),provenance:'RECOVERED_SECONDARY',runtimeVerified:false,
  });
}
