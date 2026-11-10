import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {LoadedPack} from '../src/model.ts';
import {m4RuntimeModeFromSearch} from '../src/m4-mode.ts';
import {createCh1WorldPolicy,CH1_ROUTE_EXPANSION_SOURCE} from '../src/world/ch1-world-policy.ts';
import {SceneTransitionController} from '../src/world/scene-transition.ts';

const here=dirname(fileURLToPath(import.meta.url));
const packRoot=resolve(here,'../public/game-data');
const prototypePath=resolve(packRoot,'prototype.json');
const privatePackPresent=existsSync(prototypePath);

function readPrivateChapter1Pack():LoadedPack{
  const manifest=JSON.parse(readFileSync(prototypePath,'utf8'));
  const maps:LoadedPack['maps']={};
  for(const id of [1000,1020,1030,1060]){
    const mapManifest=manifest.maps[String(id)];
    if(!mapManifest)throw new Error('Private pack missing map '+id);
    const collision=JSON.parse(readFileSync(resolve(packRoot,mapManifest.collision),'utf8'));
    maps[String(id)]={manifest:mapManifest,collision,inspector:null};
  }
  return{
    manifest,maps,collision:maps['1000'].collision,inspector:null,
    animations:{},effects:{},images:{},content:null,digest:'private-chapter1-route-test',
  } as unknown as LoadedPack;
}
const pack=privatePackPresent?readPrivateChapter1Pack():null;

test('Chapter 1 mode requires the explicit m4=1&ch1=1 launch pair',()=>{
  assert.equal(m4RuntimeModeFromSearch('?m4=1&ch1=1'),'chapter1');
  assert.equal(m4RuntimeModeFromSearch('?ch1=1'),'default');
  assert.equal(m4RuntimeModeFromSearch('?m4=1'),'default');
  assert.equal(m4RuntimeModeFromSearch(''),'default');
});

test('Chapter 1 policy requires all four loaded scene.pack.maps entries',{skip:!privatePackPresent},()=>{
  const partial={...pack!,maps:{...pack!.maps}} as LoadedPack;
  delete partial.maps['1060'];
  assert.throws(()=>createCh1WorldPolicy(partial),/map 1060 in scene\.pack\.maps/);
});

test('Chapter 1 map nodes and victory-return node preserve recovered evidence',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  assert.deepEqual(policy.mapIds,[1000,1020,1030,1060]);
  assert.deepEqual(policy.graph.scenes.map(scene=>scene.mapId),[1000,1020,1030,1060]);
  assert.equal(policy.victoryReturn.id,'story-victory-return-01');
  assert.deepEqual(policy.victoryReturn.effectiveCell,[20,120]);
  assert.equal(policy.provenance,'RECOVERED_SECONDARY');
  assert.equal(policy.runtimeVerified,false);
  assert.ok(policy.routes.every(route=>route.provenance==='RECOVERED_SECONDARY'&&route.runtimeVerified===false));
  assert.equal(CH1_ROUTE_EXPANSION_SOURCE.helper,'expand_routes_with_installed_portal_cells');
  assert.equal(CH1_ROUTE_EXPANSION_SOURCE.evidence,'RECOVERED_SECONDARY');
  assert.equal(CH1_ROUTE_EXPANSION_SOURCE.runtimeVerified,false);
});

test('Chapter 1 route graph is bidirectional and retains the owner activation-cell oracle',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  const expected=[
    {id:'main-city-route-040',from:1000,to:1020,reverse:'main-city-route-041',anchors:[[79,6]],objects:[131,29],locator:'ybcs_session_adapter.py:L717',count:16,
      cells:[[79,6],[139,5],[139,7],[140,4],[140,6],[140,8],[141,3],[141,5],[141,7],[141,9],[142,4],[142,6],[142,8],[143,5],[143,7],[144,6]]},
    {id:'main-city-route-041',from:1020,to:1000,reverse:'main-city-route-040',anchors:[[4,173],[4,182]],objects:[0,11],locator:'ybcs_session_adapter.py:L718',count:17,
      cells:[[2,176],[2,178],[3,175],[3,177],[3,179],[4,173],[4,174],[4,176],[4,178],[4,180],[4,182],[5,175],[5,177],[5,179],[6,176],[6,178],[7,177]]},
    {id:'main-city-route-048',from:1020,to:1030,reverse:'main-city-route-049',anchors:[[67,4],[67,13],[68,13]],objects:[1,12],locator:'ybcs_session_adapter.py:L735',count:18,
      cells:[[65,7],[65,9],[66,6],[66,8],[66,10],[67,4],[67,5],[67,7],[67,9],[67,11],[67,13],[68,6],[68,8],[68,10],[68,13],[69,7],[69,9],[70,8]]},
    {id:'main-city-route-049',from:1030,to:1020,reverse:'main-city-route-048',anchors:[[6,137],[7,144]],objects:[32,12],locator:'ybcs_session_adapter.py:L736',count:17,
      cells:[[4,140],[4,142],[5,139],[5,141],[5,143],[6,137],[6,138],[6,140],[6,142],[6,144],[7,139],[7,141],[7,143],[7,144],[8,140],[8,142],[9,141]]},
  ];
  for(const item of expected){
    const route=policy.routes.find(candidate=>candidate.routeId===item.id)!;
    const edge=policy.graph.transitions.find(candidate=>candidate.id===item.id)!;
    assert.equal(route.sourceMapId,item.from);
    assert.equal(route.targetMapId,item.to);
    assert.equal(edge.reverseEdgeId,item.reverse);
    assert.deepEqual(route.declaredApproachAnchors,item.anchors);
    assert.equal(route.activationCells.length,item.count);
    assert.deepEqual(route.activationCells,item.cells);
    assert.deepEqual(route.objectIds,item.objects);
    assert.equal(route.sourceLocator,item.locator);
    assert.equal(route.sourceArtifact,'src/legacy_gui_runtime/ybcs_session_adapter.py');
    assert.equal(route.sourceSha256,'d35620d4611c93a6dc190332e5e7003eebc09f2c4b50b607ade3bf597f45b448');
  }
});

test('Chapter 1 starts and route arrivals preserve requested/effective cells and snap distances',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  const byId=(id:string)=>policy.spawns.find(spawn=>spawn.id===id)!;
  assert.deepEqual(policy.initial.requestedCell,[79,6]);
  assert.deepEqual(policy.initial.effectiveCell,[93,5]);
  assert.equal(policy.initial.snapDistanceSquared,197);
  assert.deepEqual(byId('route-040-arrival').requestedCell,[4,173]);
  assert.deepEqual(byId('route-040-arrival').effectiveCell,[3,173]);
  assert.equal(byId('route-040-arrival').snapDistanceSquared,1);
  assert.deepEqual(byId('route-041-arrival').requestedCell,[79,6]);
  assert.deepEqual(byId('route-041-arrival').effectiveCell,[93,5]);
  assert.equal(byId('route-041-arrival').snapDistanceSquared,197);
  assert.deepEqual(byId('route-048-arrival').requestedCell,[6,137]);
  assert.deepEqual(byId('route-048-arrival').effectiveCell,[5,137]);
  assert.equal(byId('route-048-arrival').snapDistanceSquared,1);
  assert.deepEqual(byId('route-049-arrival').requestedCell,[67,4]);
  assert.deepEqual(byId('route-049-arrival').effectiveCell,[66,4]);
  assert.equal(byId('route-049-arrival').snapDistanceSquared,1);
  assert.deepEqual(policy.victoryReturn.effectiveCell,[20,120]);
  assert.equal(policy.victoryReturn.snapDistanceSquared,0);
});

test('Chapter 1 route origins reach their nearest activation cells at the approved distances',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  assert.deepEqual(policy.routes.map(route=>({
    id:route.routeId,origin:route.reachability.originSpawnId,
    target:route.reachability.nearestActivationCell,steps:route.reachability.steps,
  })),[
    {id:'main-city-route-040',origin:'chapter1-start',target:[139,5],steps:46},
    {id:'main-city-route-041',origin:'route-040-arrival',target:[4,174],steps:1},
    {id:'main-city-route-048',origin:'route-049-arrival',target:[67,5],steps:1},
    {id:'main-city-route-049',origin:'route-048-arrival',target:[6,138],steps:1},
  ]);
});

test('S18 commit primes destination and route pairs do not immediately bounce',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  const controller=new SceneTransitionController(policy.graph,policy.triggers);
  controller.start({mapId:1000,cell:policy.initial.effectiveCell});
  const outbound=controller.update({mapId:1000,cell:[139,5]}).transition;
  assert.equal(outbound?.edgeId,'main-city-route-040');
  const north=controller.commit(outbound!);
  assert.deepEqual({mapId:north.mapId,cell:north.cell},{mapId:1020,cell:[3,173]});
  assert.equal(controller.update({mapId:1020,cell:north.cell}).transition,null);
  const back=controller.update({mapId:1020,cell:[4,174]}).transition;
  assert.equal(back?.edgeId,'main-city-route-041');
  const village=controller.commit(back!);
  assert.deepEqual({mapId:village.mapId,cell:village.cell},{mapId:1000,cell:[93,5]});
  assert.equal(controller.update({mapId:1000,cell:village.cell}).transition,null);

  const second=new SceneTransitionController(policy.graph,policy.triggers);
  second.start({mapId:1020,cell:[66,4]});
  const cityEntry=second.update({mapId:1020,cell:[67,5]}).transition;
  assert.equal(cityEntry?.edgeId,'main-city-route-048');
  const city=second.commit(cityEntry!);
  assert.deepEqual({mapId:city.mapId,cell:city.cell},{mapId:1030,cell:[5,137]});
  assert.equal(second.update({mapId:1030,cell:city.cell}).transition,null);
  const cityExit=second.update({mapId:1030,cell:[6,138]}).transition;
  assert.equal(cityExit?.edgeId,'main-city-route-049');
  const northReturn=second.commit(cityExit!);
  assert.deepEqual({mapId:northReturn.mapId,cell:northReturn.cell},{mapId:1020,cell:[66,4]});
  assert.equal(second.update({mapId:1020,cell:northReturn.cell}).transition,null);
});

test('S18 rejected transition remains suppressed until the actor exits the activation zone',{skip:!privatePackPresent},()=>{
  const policy=createCh1WorldPolicy(pack!);
  const controller=new SceneTransitionController(policy.graph,policy.triggers);
  controller.start({mapId:1000,cell:policy.initial.effectiveCell});
  const request=controller.update({mapId:1000,cell:[139,5]}).transition;
  assert.equal(request?.edgeId,'main-city-route-040');
  controller.rejectPending();
  assert.equal(controller.update({mapId:1000,cell:[139,7]}).transition,null);
  assert.equal(controller.update({mapId:1000,cell:[138,5]}).transition,null);
  assert.equal(controller.update({mapId:1000,cell:[139,5]}).transition?.edgeId,'main-city-route-040');
});
