import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

const runtime=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot());
const scene=(page:Page)=>page.evaluate(()=>window.lapisDiagnostics!.snapshot());

async function ready(page:Page){
  await page.goto('/?m4=1&ch1=1');
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
}

async function moveFieldTo(page:Page,x:number,y:number){
  await page.evaluate(([targetX,targetY])=>{
    const move=window.lapisM4?.acceptanceMoveFieldTo;
    if(!move)throw new Error('Missing Chapter 1 field movement fixture');
    move(targetX,targetY);
  },[x,y]);
}

async function waitForFieldCell(page:Page,mapId:number,x:number,y:number){
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.world.mapId===mapId&&state.world.x===x&&state.world.y===y&&visual.routeLength===0;
  },{timeout:120000,intervals:[100,250,500]}).toBe(true);
}

test('B4-1 Story source 1 movement-complete gate enters explicit battleZone 1 independently of Quest1',async({page})=>{
  test.setTimeout(210000);
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));

  await ready(page);
  const initial=await runtime(page);
  expect(initial.runtimeMode).toBe('chapter1');
  expect(initial.chapter1StorySource1).toMatchObject({
    sourceId:'story-source-1',
    fieldMapId:1030,
    battleZoneId:1,
    gateCells:[
      [72,26],[71,27],[73,27],[70,28],[72,28],
      [74,28],[71,29],[73,29],[72,30],
    ],
    approachCells:[
      [71,27],[73,27],[70,28],[72,28],
      [74,28],[71,29],[73,29],[72,30],
    ],
    sourceBlockedArchCell:[72,26],
    deploymentLocalCell:[34,44],
    deploymentHostileCell:[52,24],
    deploymentApplied:false,
    replayable:true,
    bossVictory:true,
    mapToBattleZoneRetailVerified:false,
    triggerSemantics:'movement-complete-gate-cell-offline-policy',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });

  // Use the existing S18 production transition controller to reach map 1030.
  await moveFieldTo(page,139,5);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:120000,intervals:[100,250,500]}).toBe(1020);
  await moveFieldTo(page,67,5);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:120000,intervals:[100,250,500]}).toBe(1030);

  const beforeGate=await runtime(page);
  expect(beforeGate.chapter1Quest1).toMatchObject({
    marker:'SELECT',
    actorToken:'100',
    selectionStatus:'not-recorded',
    serverAcceptance:'not-asserted',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(beforeGate.quest.stage).toBe('not_started');
  expect(beforeGate.pendingEncounter).toBeNull();

  // The recovered source marks (72,26) as a blocked arch, not an approach
  // cell. The current reconstructed collision pack marks it walkable, so the
  // runtime must still exclude it from the eight-cell approach whitelist.
  await moveFieldTo(page,72,26);
  await waitForFieldCell(page,1030,72,26);
  expect((await scene(page)).inBattleView).toBe(false);
  expect((await runtime(page)).chapter1StoryBattle).toBeNull();

  // A valid approach cell triggers only after the movement route completes.
  await moveFieldTo(page,72,28);
  const duringMovement=await scene(page);
  expect(duringMovement.routeLength).toBeGreaterThan(0);
  expect(duringMovement.inBattleView).toBe(false);
  await expect.poll(async()=>(await scene(page)).inBattleView,{timeout:120000,intervals:[100,250,500]}).toBe(true);

  const battleScene=await scene(page);
  const battleRuntime=await runtime(page);
  expect(battleScene.mapId).toBe(1);
  expect(battleScene.battleZoneId).toBe(1);
  expect(battleScene.battleEntry).toMatchObject({
    battleZoneId:1,
    provenance:'RECOVERED_SECONDARY',
    authority:'offline-reconstruction',
  });
  expect(battleScene.battleEntryProvenance).toBe('RECOVERED_SECONDARY');
  expect(battleRuntime.chapter1StoryBattle).toMatchObject({
    sourceId:'story-source-1',
    fieldMapId:1030,
    gateCell:[72,28],
    battleZoneId:1,
    entryProvenance:'RECOVERED_SECONDARY',
    authority:'offline-reconstruction',
    runtimeVerified:false,
  });

  // Story source 1 is the sole entry cause: no Quest1 SCRIPT/CANCEL,
  // SELECT acceptance, S9 pending encounter, or quest battle resolution.
  expect(battleRuntime.chapter1Quest1.selectionStatus).toBe('not-recorded');
  expect(battleRuntime.chapter1Quest1.serverAcceptance).toBe('not-asserted');
  expect(battleRuntime.quest.stage).toBe('not_started');
  expect(battleRuntime.pendingEncounter).toBeNull();
  expect(pageErrors).toEqual([]);
});
