import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const ASSET_INDEX_PATH=fileURLToPath(new URL('../public/game-data/asset-index.json',import.meta.url));
const ASSET_INDEX_TEXT=existsSync(ASSET_INDEX_PATH)?readFileSync(ASSET_INDEX_PATH,'utf8'):'';
const ASSET_INDEX=ASSET_INDEX_TEXT?JSON.parse(ASSET_INDEX_TEXT) as Record<string,any>:null;
const REQUIRED_MAP_FILES=[1000,1020,1030,1060].flatMap(id=>[
  'maps/map-'+id+'.png',
  'maps/map-'+id+'-collision.json',
]);
const PRIVATE_ORIGINAL_PACK_AVAILABLE=!!ASSET_INDEX
  &&!ASSET_INDEX_TEXT.includes('SYNTHETIC')
  &&!!ASSET_INDEX.inputs?.['Char/B4524_00.ani']
  &&!!ASSET_INDEX.inputs?.['Char/B4524_00.spr']
  &&REQUIRED_MAP_FILES.every(path=>existsSync(fileURLToPath(new URL('../public/game-data/'+path,import.meta.url))));


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
  test.skip(!PRIVATE_ORIGINAL_PACK_AVAILABLE,'Chapter 1 integration acceptance requires the private-original derived pack; absent or SYNTHETIC resources cannot prove Chapter 1 runtime behavior.');
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
    replayPolicy:'after-leave-all-nine-gate-cells',
    bossVictory:true,
    bossVictoryRuntimeEnforced:false,
    victoryReturnCondition:'m4-battle-phase-won',
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

async function enterStoryOneFromMap1000(page:Page){
  await ready(page);
  await moveFieldTo(page,139,5);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:120000,intervals:[100,250,500]}).toBe(1020);
  await moveFieldTo(page,67,5);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:120000,intervals:[100,250,500]}).toBe(1030);
  await moveFieldTo(page,72,28);
  await expect.poll(async()=>(await scene(page)).inBattleView,{timeout:120000,intervals:[100,250,500]}).toBe(true);
}

async function returnFromTerminalBattle(page:Page){
  const button=page.locator('[data-action="return"]:visible');
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(async()=>(await scene(page)).inBattleView).toBe(false);
}

test('B4-2 Story source 1 retreat and defeat return to the original field gate and suppress re-entry until leaving all nine gate cells',async({page})=>{
  test.skip(!PRIVATE_ORIGINAL_PACK_AVAILABLE,'Chapter 1 integration acceptance requires the private-original derived pack; absent or SYNTHETIC resources cannot prove Chapter 1 runtime behavior.');
  test.setTimeout(210000);
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await enterStoryOneFromMap1000(page);

  const baseline=await runtime(page);
  const baselineGold=baseline.gold;
  const baselineProgression=baseline.progression;
  const baselineQuest=baseline.quest;

  // Active voluntary exit uses the existing M4 confirmation flow.
  await page.locator('[data-action="battle-exit-request"]:visible').click();
  await expect(page.locator('[data-ui="battle-exit-confirm"]')).toBeVisible();
  await page.locator('[data-action="battle-exit-confirm"]:visible').click();
  await expect.poll(async()=>(await scene(page)).inBattleView).toBe(false);
  let state=await runtime(page);
  expect(state.world).toEqual({mapId:1030,x:72,y:28});
  expect(state.chapter1StoryBattle).toBeNull();
  expect(state.chapter1StorySuppressedUntilLeaveGate).toBe(true);
  expect(state.chapter1StoryLastResolution).toMatchObject({
    sourceId:'story-source-1',
    outcome:'retreated',
    fieldMapId:1030,
    gateCell:[72,28],
    battleZoneId:1,
    returnMapId:1030,
    returnCell:[72,28],
    rewardSettlement:'not-applied',
    victoryCondition:'m4-battle-phase-won',
    bossVictorySourceFlag:true,
    bossVictoryRuntimeEnforced:false,
    replayPolicy:'after-leave-all-nine-gate-cells',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(state.gold).toBe(baselineGold);
  expect(state.progression).toEqual(baselineProgression);
  expect(state.quest).toEqual(baselineQuest);

  // Moving within the nine-cell source gate cluster must not immediately
  // retrigger. Leaving the complete cluster clears the one-shot suppression.
  await moveFieldTo(page,74,28);
  await waitForFieldCell(page,1030,74,28);
  expect((await scene(page)).inBattleView).toBe(false);
  expect((await runtime(page)).chapter1StorySuppressedUntilLeaveGate).toBe(true);

  await moveFieldTo(page,75,29);
  await waitForFieldCell(page,1030,75,29);
  expect((await runtime(page)).chapter1StorySuppressedUntilLeaveGate).toBe(false);

  // Re-entering a valid approach cell is allowed after the player has left
  // the gate area; lower HP through the existing automation fixture, then let
  // the production enemy action loop cause the defeat.
  await moveFieldTo(page,72,28);
  await expect.poll(async()=>(await scene(page)).inBattleView,{timeout:120000,intervals:[100,250,500]}).toBe(true);
  const defeated=await page.evaluate(()=>{
    const api=window.lapisM4 as any;
    const diagnostics=window.lapisDiagnostics as any;
    api.acceptanceSetBattlePaused(true);
    api.acceptanceSetPlayerVitals(1,0);
    for(let step=0;step<40&&diagnostics.snapshot().phase==='active';step++)api.acceptanceAdvanceLiveBattleStep();
    return diagnostics.snapshot();
  });
  expect(defeated.phase).toBe('lost');
  expect(defeated.battleZoneId).toBe(1);
  await returnFromTerminalBattle(page);

  state=await runtime(page);
  expect(state.world).toEqual({mapId:1030,x:72,y:28});
  expect(state.chapter1StoryBattle).toBeNull();
  expect(state.chapter1StorySuppressedUntilLeaveGate).toBe(true);
  expect(state.chapter1StoryLastResolution).toMatchObject({
    sourceId:'story-source-1',
    outcome:'lost',
    fieldMapId:1030,
    gateCell:[72,28],
    battleZoneId:1,
    returnMapId:1030,
    returnCell:[72,28],
    rewardSettlement:'not-applied',
    victoryCondition:'m4-battle-phase-won',
    bossVictorySourceFlag:true,
    bossVictoryRuntimeEnforced:false,
    replayPolicy:'after-leave-all-nine-gate-cells',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(state.gold).toBe(baselineGold);
  expect(state.progression).toEqual(baselineProgression);
  expect(state.quest).toEqual(baselineQuest);
  expect(state.pendingEncounter).toBeNull();
  expect(state.chapter1Quest1.selectionStatus).toBe('not-recorded');
  expect(pageErrors).toEqual([]);
});

test('B4-2 actual Story source 1 battle victory returns to story-victory-return-01 map 1060 cell 20,120 without S9 settlement',async({page})=>{
  test.skip(!PRIVATE_ORIGINAL_PACK_AVAILABLE,'Chapter 1 integration acceptance requires the private-original derived pack; absent or SYNTHETIC resources cannot prove Chapter 1 runtime behavior.');
  test.setTimeout(210000);
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await enterStoryOneFromMap1000(page);

  const baseline=await runtime(page);
  const baselineGold=baseline.gold;
  const baselineProgression=baseline.progression;
  const baselineQuest=baseline.quest;
  const result=await page.evaluate(()=>{
    const api=window.lapisM4 as any;
    const diagnostics=window.lapisDiagnostics as any;
    api.acceptanceSetBattlePaused(true);
    let attacks=0;
    let moves=0;
    for(let turn=0;turn<40;turn++){
      let state=diagnostics.snapshot();
      if(state.phase!=='active')break;
      if(!api.acceptanceActionReady()){
        const advanced=api.acceptanceAdvanceUntilActionOrEnd(40);
        if(!advanced.done)throw new Error('Story battle did not reach an action or terminal state within 40 steps');
        state=diagnostics.snapshot();
        if(state.phase!=='active')break;
      }
      const live=state.enemies.filter((enemy:any)=>enemy.hp>0);
      if(!live.length)break;
      live.sort((a:any,b:any)=>
        Math.max(Math.abs(a.cell[0]-state.battleCell[0]),Math.abs(a.cell[1]-state.battleCell[1]))-
        Math.max(Math.abs(b.cell[0]-state.battleCell[0]),Math.abs(b.cell[1]-state.battleCell[1]))
      );
      const target=live[0];
      const distance=Math.max(
        Math.abs(target.cell[0]-state.battleCell[0]),
        Math.abs(target.cell[1]-state.battleCell[1]),
      );
      if(distance>1){
        const reachable=api.acceptanceReachable() as number[][];
        reachable.sort((a:number[],b:number[])=>
          Math.max(Math.abs(a[0]-target.cell[0]),Math.abs(a[1]-target.cell[1]))-
          Math.max(Math.abs(b[0]-target.cell[0]),Math.abs(b[1]-target.cell[1]))
        );
        if(!reachable.length)throw new Error('No reachable battle cell while a Story source 1 enemy remains');
        const cell=reachable[0];
        api.acceptanceIssueMoveTo((cell[0]+1)*32,(cell[1]+1)*16);
        const advanced=api.acceptanceAdvanceUntilActionOrEnd(40);
        if(!advanced.done)throw new Error('Story battle movement did not complete within 40 steps');
        moves++;
        continue;
      }
      api.acceptanceSelectEnemy(target.id);
      api.acceptanceIssueAttack();
      attacks++;
    }
    return{snapshot:diagnostics.snapshot(),attacks,moves};
  });

  expect(result.snapshot.phase,'Story source 1 must be defeated by actual M4 combat, not a forced terminal fixture').toBe('won');
  expect(result.attacks).toBeGreaterThan(0);
  await returnFromTerminalBattle(page);

  const state=await runtime(page);
  expect(state.world).toEqual({mapId:1060,x:20,y:120});
  expect(state.chapter1StoryBattle).toBeNull();
  expect(state.chapter1StorySuppressedUntilLeaveGate).toBe(false);
  expect(state.chapter1StoryLastResolution).toMatchObject({
    sourceId:'story-source-1',
    outcome:'won',
    fieldMapId:1030,
    gateCell:[72,28],
    battleZoneId:1,
    returnMapId:1060,
    returnCell:[20,120],
    rewardSettlement:'not-applied',
    victoryCondition:'m4-battle-phase-won',
    bossVictorySourceFlag:true,
    bossVictoryRuntimeEnforced:false,
    replayPolicy:'after-leave-all-nine-gate-cells',
    triggerSemantics:'movement-complete-gate-cell-offline-policy',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(state.gold).toBe(baselineGold);
  expect(state.progression).toEqual(baselineProgression);
  expect(state.quest).toEqual(baselineQuest);
  expect(state.pendingEncounter).toBeNull();
  expect(state.chapter1Quest1.selectionStatus).toBe('not-recorded');
  expect(pageErrors).toEqual([]);
});
