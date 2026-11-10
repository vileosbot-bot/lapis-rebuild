import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import {
  CH1_GIO_TEACHER_CANDIDATE,
  CH1_GIO_TEACHER_ENTITY,
  CH1_GIO_TEACHER_VISUAL_BINDING,
  CH1_QUEST1_SELECT_RECORD,
} from '../src/world/ch1-world-authority.ts';

const ASSET_INDEX_PATH=fileURLToPath(new URL('../public/game-data/asset-index.json',import.meta.url));
const CONTENT_SUMMARY_PATH=fileURLToPath(new URL('../public/game-data/content/summary.json',import.meta.url));
const ASSET_INDEX_TEXT=existsSync(ASSET_INDEX_PATH)?readFileSync(ASSET_INDEX_PATH,'utf8'):'';
const ASSET_INDEX=ASSET_INDEX_TEXT?JSON.parse(ASSET_INDEX_TEXT) as Record<string,any>:null;
const CONTENT_SUMMARY=existsSync(CONTENT_SUMMARY_PATH)
  ?JSON.parse(readFileSync(CONTENT_SUMMARY_PATH,'utf8')) as Record<string,any>
  :null;
const REQUIRED_MAP_FILES=[1000,1020,1030,1060].flatMap(id=>[
  'maps/map-'+id+'.png',
  'maps/map-'+id+'-collision.json',
]);
const PRIVATE_ORIGINAL_PACK_AVAILABLE=!!ASSET_INDEX
  &&!ASSET_INDEX_TEXT.includes('SYNTHETIC')
  &&!!ASSET_INDEX.inputs?.['Char/B4524_00.ani']
  &&!!ASSET_INDEX.inputs?.['Char/B4524_00.spr']
  &&REQUIRED_MAP_FILES.every(path=>existsSync(fileURLToPath(new URL('../public/game-data/'+path,import.meta.url))));

type AnyRecord=Record<string,any>;
type ScreenshotRecord={
  screenshot_id:string;
  filename:string;
  feature_id:string;
  capture_point:string;
  image_kind:'real_browser';
  sha256:string;
  byte_count:number;
  artifact_location:string;
  status:'CAPTURED';
};

const runtime=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot() as AnyRecord);
const scene=(page:Page)=>page.evaluate(()=>window.lapisDiagnostics!.snapshot() as AnyRecord);

function sha256File(path:string):string{
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function compactRuntime(value:AnyRecord):AnyRecord{
  return {
    runtimeMode:value.runtimeMode,
    chapter1:value.chapter1,
    chapter1StorySource1:value.chapter1StorySource1,
    chapter1StoryBattle:value.chapter1StoryBattle,
    chapter1StorySuppressedUntilLeaveGate:value.chapter1StorySuppressedUntilLeaveGate,
    chapter1StoryLastResolution:value.chapter1StoryLastResolution,
    chapter1Quest1:value.chapter1Quest1,
    quest:value.quest,
    world:value.world,
    progression:value.progression,
    gold:value.gold,
    pendingEncounter:value.pendingEncounter,
    dialogue:value.dialogue,
  };
}

function compactScene(value:AnyRecord):AnyRecord{
  return {
    ready:value.ready,
    mapId:value.mapId,
    mapName:value.mapName,
    inBattleView:value.inBattleView,
    routeLength:value.routeLength,
    anchor:value.anchor,
    referenceCell:value.referenceCell,
    camera:value.camera,
    cameraFollow:value.cameraFollow,
    battleEntry:value.battleEntry,
    battleEntryProvenance:value.battleEntryProvenance,
    battleZoneId:value.battleZoneId,
    phase:value.phase,
    hp:value.hp,
    maxHp:value.maxHp,
    mp:value.mp,
    maxMp:value.maxMp,
    action:value.action,
    actionMax:value.actionMax,
    actionReady:value.actionReady,
    battlePaused:value.battlePaused,
    target:value.target,
    enemies:(value.enemies??[]).map((enemy:AnyRecord)=>({
      id:enemy.id,hp:enemy.hp,maxHp:enemy.maxHp,cell:enemy.cell,visible:enemy.visible,visualResourceId:enemy.visualResourceId,
    })),
    worldVisuals:value.worldVisuals,
  };
}

async function ready(page:Page):Promise<void>{
  await page.goto('/?m4=1&ch1=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
  await page.waitForFunction(()=>{
    const api=window.lapisM4 as any;
    return typeof api?.acceptanceMoveFieldTo==='function'
      &&typeof api?.acceptanceSetBattlePaused==='function'
      &&typeof api?.acceptanceActionReady==='function'
      &&typeof api?.acceptanceAdvanceUntilActionOrEnd==='function'
      &&typeof api?.acceptanceReachable==='function'
      &&typeof api?.acceptanceIssueMoveTo==='function'
      &&typeof api?.acceptanceIssueAttack==='function'
      &&typeof api?.acceptanceSelectEnemy==='function';
  });
}

async function moveFieldTo(page:Page,x:number,y:number):Promise<void>{
  await page.evaluate(([targetX,targetY])=>{
    const api=window.lapisM4 as any;
    if(typeof api?.acceptanceMoveFieldTo!=='function')throw new Error('Missing Chapter 1 field-movement fixture');
    api.acceptanceMoveFieldTo(targetX,targetY);
  },[x,y]);
}

async function waitForFieldCell(page:Page,mapId:number,x:number,y:number):Promise<void>{
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.world.mapId===mapId&&state.world.x===x&&state.world.y===y&&visual.routeLength===0;
  },{timeout:240000,intervals:[100,250,500]}).toBe(true);
}

async function waitForActionReady(page:Page):Promise<{stepsAdvanced:number;simulatedMs:number;timeoutMs:number}>{
  let stepsAdvanced=0;
  await expect.poll(async()=>{
    if(stepsAdvanced>=40)return false;
    const result=await page.evaluate((remaining)=>{
      const api=window.lapisM4 as any;
      if(api.acceptanceCanAct())return {done:true,stepsAdvanced:0};
      return api.acceptanceAdvanceUntilActionOrEnd(remaining) as {done:boolean;stepsAdvanced:number};
    },40-stepsAdvanced);
    stepsAdvanced+=result.stepsAdvanced;
    return result.done;
  },{timeout:12000,intervals:[50]}).toBe(true);
  return {stepsAdvanced,simulatedMs:stepsAdvanced*250,timeoutMs:12000};
}

async function capture(
  page:Page,
  screenshotId:string,
  filename:string,
  featureId:string,
  capturePoint:string,
  screenshots:ScreenshotRecord[],
):Promise<ScreenshotRecord>{
  mkdirSync('test-results',{recursive:true});
  const path='test-results/'+filename;
  await page.screenshot({path,fullPage:true});
  const bytes=readFileSync(path);
  const item:ScreenshotRecord={
    screenshot_id:screenshotId,
    filename,
    feature_id:featureId,
    capture_point:capturePoint,
    image_kind:'real_browser',
    sha256:createHash('sha256').update(bytes).digest('hex'),
    byte_count:bytes.length,
    artifact_location:path,
    status:'CAPTURED',
  };
  screenshots.push(item);
  return item;
}

test('S42 Chapter 1 full end-to-end acceptance A01-A11 on private-original production preview',async({page})=>{
  test.setTimeout(720000);
  test.skip(!PRIVATE_ORIGINAL_PACK_AVAILABLE,'S42 requires the private-original derived pack; absent or SYNTHETIC resources cannot prove Chapter 1 runtime behavior.');

  const pageErrors:string[]=[];
  const consoleErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});

  mkdirSync('test-results',{recursive:true});
  const assertions:Array<{id:string;status:'PASS';description:string;evidence_refs:string[]}>= [];
  const screenshots:ScreenshotRecord[]=[];
  const checkpoints:AnyRecord={
    schema_version:1,
    bundle_id:'s42-ch1-b4-3-20261110',
    request_id:'auto-3-2',
    base_commit_sha:'8a844202cb77d915d8b6ee1eb9c4c50b9e7d4f6b',
    tested_commit_sha:process.env.S42_TESTED_COMMIT_SHA??'WORKTREE_UNCOMMITTED',
    environment:{
      environment_kind:'private_original',
      browser:'Chromium',
      playwright_version:'1.63.0',
      node_version:process.version,
      workers:1,
      fully_parallel:false,
      test_timeout_ms:720000,
      action_ready_wait_timeout_ms:12000,
      max_player_turns:40,
      preview:'Vite production preview at http://127.0.0.1:4173',
      resource_pack_kind:'private-original derived Web pack; original NeoDark.exe is not executed',
      asset_index_sha256:sha256File(ASSET_INDEX_PATH),
      content_summary_sha256:sha256File(CONTENT_SUMMARY_PATH),
      required_map_files:REQUIRED_MAP_FILES.map(path=>{
        const absolute=fileURLToPath(new URL('../public/game-data/'+path,import.meta.url));
        return {path,bytes:statSync(absolute).size,sha256:sha256File(absolute)};
      }),
      proxy_animation_inputs:{
        ani_sha256:ASSET_INDEX.inputs['Char/B4524_00.ani'],
        spr_sha256:ASSET_INDEX.inputs['Char/B4524_00.spr'],
      },
    },
    static_sources:{
      npc_candidate:CH1_GIO_TEACHER_CANDIDATE,
      npc_runtime_entity:CH1_GIO_TEACHER_ENTITY,
      npc_visual_binding:CH1_GIO_TEACHER_VISUAL_BINDING,
      quest1_select_record:CH1_QUEST1_SELECT_RECORD,
      quest1_content_summary:CONTENT_SUMMARY?.quests?.find((row:AnyRecord)=>row.source==='Quest1.TXT')??null,
      story_one_source:{
        source_file:'src/legacy_gui_runtime/ybcs_offline_field_encounters.py',
        source_locator:'L240; L277-L289; L1778-L1779',
        source_sha256:'94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a',
        evidence_level:'RECOVERED_SECONDARY',
        runtime_verified:false,
      },
    },
    assertions,
    screenshots,
    checkpoints:{},
    errors:{pageErrors,consoleErrors},
  };
  const stateCheckpoints=checkpoints.checkpoints as AnyRecord;

  expect(PRIVATE_ORIGINAL_PACK_AVAILABLE).toBe(true);
  expect(ASSET_INDEX_TEXT).not.toContain('SYNTHETIC');
  expect(ASSET_INDEX.inputs['Char/B4524_00.ani']).toMatch(/^[a-f0-9]{64}$/);
  expect(ASSET_INDEX.inputs['Char/B4524_00.spr']).toMatch(/^[a-f0-9]{64}$/);
  expect(REQUIRED_MAP_FILES).toHaveLength(8);
  assertions.push({id:'A01',status:'PASS',description:'Private-original derived pack preflight passes: non-synthetic asset index, B4524 ANI/SPR inputs and all four required map image/collision pairs are present.',evidence_refs:['checkpoints.privateResourcePrecheck','checkpoints.resourcePack']});
  stateCheckpoints.privateResourcePrecheck={available:PRIVATE_ORIGINAL_PACK_AVAILABLE,syntheticMarker:false,proxyAnimationInputs:checkpoints.environment.proxy_animation_inputs,requiredMapFiles:checkpoints.environment.required_map_files};

  await ready(page);
  const initialRuntime=await runtime(page);
  const initialScene=await scene(page);
  const initialRoutes=initialRuntime.chapter1?.routes??[];
  expect(initialRuntime.runtimeMode).toBe('chapter1');
  expect(initialScene.ready).toBe(true);
  expect(initialScene.mapId).toBe(1000);
  expect(initialRuntime.world).toEqual({mapId:1000,x:93,y:5});
  expect(initialRuntime.chapter1.initial).toMatchObject({
    mapId:1000,
    requestedCell:[79,6],
    effectiveCell:[93,5],
    snapDistanceSquared:197,
  });
  expect(initialRuntime.chapter1.provenance).toBe('RECOVERED_SECONDARY');
  expect(initialRuntime.chapter1.runtimeVerified).toBe(false);
  const quest1Summary=CONTENT_SUMMARY?.quests?.find((row:AnyRecord)=>row.source==='Quest1.TXT');
  expect(quest1Summary?.action_counts?.SELECT).toBe(1);
  expect(CH1_GIO_TEACHER_CANDIDATE.evidenceLevel).toBe('RECOVERED_SECONDARY');
  expect(CH1_GIO_TEACHER_CANDIDATE.runtimeVerified).toBe(false);
  expect(CH1_QUEST1_SELECT_RECORD.evidenceLevel).toBe('RECOVERED_SECONDARY');
  expect(CH1_QUEST1_SELECT_RECORD.runtimeVerified).toBe(false);
  expect(initialRuntime.chapter1StorySource1.evidenceLevel).toBe('RECOVERED_SECONDARY');
  expect(initialRuntime.chapter1StorySource1.runtimeVerified).toBe(false);
  assertions.push({id:'A02',status:'PASS',description:'Chapter 1 policy/data bindings are present and evidence-separated: NPC, Quest1 SELECT and Story source remain RECOVERED_SECONDARY with runtimeVerified=false; Quest1.TXT has one SELECT marker.',evidence_refs:['static_sources','checkpoints.policyEvidence']});
  stateCheckpoints.policyEvidence={
    npcCandidate:{candidateEntityId:CH1_GIO_TEACHER_CANDIDATE.candidateEntityId,evidenceLevel:CH1_GIO_TEACHER_CANDIDATE.evidenceLevel,runtimeVerified:CH1_GIO_TEACHER_CANDIDATE.runtimeVerified},
    quest1Select:{recordId:CH1_QUEST1_SELECT_RECORD.recordId,evidenceLevel:CH1_QUEST1_SELECT_RECORD.evidenceLevel,runtimeVerified:CH1_QUEST1_SELECT_RECORD.runtimeVerified},
    storySource1:initialRuntime.chapter1StorySource1,
    quest1ContentSummary:quest1Summary,
  };
  assertions.push({id:'A03',status:'PASS',description:'Chapter 1 starts on map1000 at approved snapped spawn (93,5), requested (79,6), snap squared 197.',evidence_refs:['checkpoints.initialMap1000']});
  stateCheckpoints.initialMap1000={runtime:compactRuntime(initialRuntime),scene:compactScene(initialScene)};
  stateCheckpoints.resourcePack=checkpoints.environment;

  // The approved NPC interaction radius is 2. (34,72) is a walkable cell
  // at Manhattan distance 2 from the recovered candidate at (32,72).
  await moveFieldTo(page,34,72);
  await waitForFieldCell(page,1000,34,72);
  const npcRuntime=await runtime(page);
  const npcScene=await scene(page);
  const npcVisual=npcScene.worldVisuals.find((row:AnyRecord)=>row.id===CH1_GIO_TEACHER_ENTITY.id);
  expect(CH1_GIO_TEACHER_CANDIDATE).toMatchObject({
    candidateEntityId:21003,
    sourceMapId:'map:old:1000',
    mapWire:1000,
    sourceModelResourceId:5056,
    cell:[32,72],
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(CH1_GIO_TEACHER_ENTITY).toMatchObject({
    id:'ch1-npc-21003',
    mapId:1000,
    x:32,
    y:72,
    interactionRadius:2,
    provenance:'RECONSTRUCTION_POLICY',
  });
  expect(CH1_GIO_TEACHER_VISUAL_BINDING).toMatchObject({
    sourceModelResourceId:5056,
    proxyResourceId:4524,
    provenance:{evidence:'RECONSTRUCTION_POLICY'},
  });
  expect(npcVisual).toMatchObject({id:'ch1-npc-21003',mapId:1000,resourceId:4524,visible:true,cell:[32,72]});
  expect(npcRuntime.world).toEqual({mapId:1000,x:34,y:72});
  await capture(page,'s42-01','s42-01-map1000-npc.png','CH1-02','Map1000 吉奥老师 NPC 21003 at (32,72), visual proxy 4524, actor within interaction radius 2.',screenshots);
  assertions.push({id:'A04',status:'PASS',description:'NPC 21003 吉奥老师 is present at map1000 (32,72); runtime visual uses the approved 4524 proxy for source model 5056.',evidence_refs:['checkpoints.npcReach','s42-01-map1000-npc.png']});
  stateCheckpoints.npcReach={runtime:compactRuntime(npcRuntime),scene:compactScene(npcScene),staticCandidate:CH1_GIO_TEACHER_CANDIDATE,visualBinding:CH1_GIO_TEACHER_VISUAL_BINDING};

  // Open the real in-world NPC dialogue and capture the SELECT marker/token
  // before recording the local-only current-session selection.
  await page.keyboard.press('e');
  const selectChoice=page.locator('[data-dialogue-choice="record-selection"]');
  await expect(selectChoice).toBeVisible();
  const selectDialogue=await runtime(page);
  expect(selectDialogue.dialogue).toMatchObject({
    phase:'select',
    marker:'SELECT',
    actorToken:'100',
    choices:['record-selection'],
  });
  expect(selectDialogue.chapter1Quest1).toMatchObject({
    recordId:'quest1-early:accept',
    marker:'SELECT',
    step:1,
    actorToken:'100',
    selectionStatus:'not-recorded',
    serverAcceptance:'not-asserted',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  await selectChoice.click();
  await expect.poll(async()=>(await runtime(page)).chapter1Quest1.selectionStatus).toBe('recorded');
  const selectedRuntime=await runtime(page);
  expect(selectedRuntime.chapter1Quest1).toMatchObject({
    recordId:'quest1-early:accept',
    marker:'SELECT',
    step:1,
    actorToken:'100',
    selectionStatus:'recorded',
    serverAcceptance:'not-asserted',
    recruitment:'not-implemented',
    reward:'not-recovered',
    persistence:'transient-only',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(selectedRuntime.quest.stage).toBe('not_started');
  expect(selectedRuntime.pendingEncounter).toBeNull();
  const save=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(save.version).toBe(2);
  expect(save.quest.stage).toBe('not_started');
  expect(save).not.toHaveProperty('chapter1Quest1');
  expect(save).not.toHaveProperty('chapter1Quest1Selection');
  await capture(page,'s42-02','s42-02-quest1-select.png','CH1-03','Quest1 SELECT step 1 actor token 100 recorded as transient current-session selection only.',screenshots);
  assertions.push({id:'A05',status:'PASS',description:'Quest1 SELECT step 1 / actor token 100 is recorded locally for the current session only; no server acceptance, recruitment, reward, quest completion or SaveV2 persistence is claimed.',evidence_refs:['checkpoints.quest1Dialogue','checkpoints.quest1Selected','s42-02-quest1-select.png']});
  stateCheckpoints.quest1Dialogue={runtime:compactRuntime(selectDialogue)};
  stateCheckpoints.quest1Selected={runtime:compactRuntime(selectedRuntime),saveV2:{version:save.version,quest:save.quest,hasQuest1Selection:Object.prototype.hasOwnProperty.call(save,'chapter1Quest1')}};

  // Route 040: map1000 -> map1020. The chosen activation cell is one of the
  // owner-approved walkable cells in the existing S18 route controller.
  const route040=initialRoutes.find((route:AnyRecord)=>route.routeId==='main-city-route-040');
  const route048=initialRoutes.find((route:AnyRecord)=>route.routeId==='main-city-route-048');
  expect(route040).toMatchObject({sourceMapId:1000,targetMapId:1020});
  expect(route048).toMatchObject({sourceMapId:1020,targetMapId:1030});
  expect(initialRoutes.some((route:AnyRecord)=>String(route.routeId).includes('052'))).toBe(false);
  await moveFieldTo(page,140,8);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:240000,intervals:[100,250,500]}).toBe(1020);
  await waitForFieldCell(page,1020,3,173);
  const route040Arrival=await runtime(page);
  expect(route040Arrival.world).toEqual({mapId:1020,x:3,y:173});
  expect(route040Arrival.chapter1.routes.some((route:AnyRecord)=>route.routeId==='main-city-route-040')).toBe(true);
  expect(route040Arrival.chapter1.routes.some((route:AnyRecord)=>String(route.routeId).includes('052'))).toBe(false);
  assertions.push({id:'A06',status:'PASS',description:'Route040 completes the production map1000 -> map1020 transition and lands at the approved effective arrival (3,173); route-052 is not used.',evidence_refs:['checkpoints.route040']});
  stateCheckpoints.route040={routeId:'main-city-route-040',activationCell:[140,8],arrival:compactRuntime(route040Arrival)};

  // Route 048: map1020 -> map1030. The selected activation cell is the
  // shortest walkable source cell from the approved route activation set.
  await moveFieldTo(page,67,13);
  await expect.poll(async()=>(await runtime(page)).world.mapId,{timeout:240000,intervals:[100,250,500]}).toBe(1030);
  await waitForFieldCell(page,1030,5,137);
  const route048Arrival=await runtime(page);
  expect(route048Arrival.world).toEqual({mapId:1030,x:5,y:137});
  expect(route048Arrival.chapter1.routes.map((route:AnyRecord)=>route.routeId)).toEqual([
    'main-city-route-040','main-city-route-041','main-city-route-048','main-city-route-049',
  ]);
  expect(route048Arrival.chapter1.routes.some((route:AnyRecord)=>route.routeId.includes('052'))).toBe(false);
  assertions.push({id:'A07',status:'PASS',description:'Route048 completes the production map1020 -> map1030 transition and lands at the approved effective arrival (5,137); the four-route graph excludes route-052. All nine source gate cells and eight walkable approaches match; arch (72,26) remains excluded.',evidence_refs:['checkpoints.route048','checkpoints.gatePolicy','s42-03-map1030-arrival.png']});
  stateCheckpoints.route048={routeId:'main-city-route-048',activationCell:[67,13],arrival:compactRuntime(route048Arrival)};
  await capture(page,'s42-03','s42-03-map1030-arrival.png','CH1-01','Map1030 reached through route040 then route048; effective arrival cell (5,137).',screenshots);

  // The nine source gate cells and the eight walkable approach cells are
  // asserted separately. (72,26) remains the source arch, not an approach.
  const expectedGateCells=[[72,26],[71,27],[73,27],[70,28],[72,28],[74,28],[71,29],[73,29],[72,30]];
  const expectedApproachCells=[[71,27],[73,27],[70,28],[72,28],[74,28],[71,29],[73,29],[72,30]];
  expect(route048Arrival.chapter1StorySource1).toMatchObject({
    fieldMapId:1030,
    battleZoneId:1,
    gateCells:expectedGateCells,
    approachCells:expectedApproachCells,
    sourceBlockedArchCell:[72,26],
    triggerSemantics:'movement-complete-gate-cell-offline-policy',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
    mapToBattleZoneRetailVerified:false,
  });
  expect(route048Arrival.chapter1StorySource1.approachCells).not.toContainEqual([72,26]);
  stateCheckpoints.gatePolicy={
    gateCells:expectedGateCells,
    approachCells:expectedApproachCells,
    archCell:[72,26],
    sourceLocator:'ybcs_offline_field_encounters.py:L277-L289',
    battleZoneLocator:'ybcs_offline_field_encounters.py:L240',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  };

  // Movement-complete semantics: no battle while the route is in progress;
  // the battle is admitted only after the movement route reaches its gate cell.
  await page.evaluate(()=>window.lapisM4!.acceptanceSetBattlePaused(true));
  await moveFieldTo(page,72,30);
  const duringGateMovement=await scene(page);
  expect(duringGateMovement.routeLength).toBeGreaterThan(0);
  expect(duringGateMovement.inBattleView).toBe(false);
  expect((await runtime(page)).chapter1StoryBattle).toBeNull();
  await expect.poll(async()=>{
    const state=await scene(page);
    return {inBattleView:state.inBattleView,battlePaused:state.battlePaused,phase:state.phase};
  },{timeout:240000,intervals:[100,250,500]}).toEqual({inBattleView:true,battlePaused:true,phase:'active'});
  const battleScene=await scene(page);
  const battleRuntime=await runtime(page);
  expect(battleScene.routeLength).toBe(0);
  expect(battleRuntime.chapter1StoryBattle).toMatchObject({
    sourceId:'story-source-1',
    fieldMapId:1030,
    gateCell:[72,30],
    battleZoneId:1,
    entryProvenance:'RECOVERED_SECONDARY',
    authority:'offline-reconstruction',
    runtimeVerified:false,
  });
  expect(battleRuntime.chapter1StorySource1.triggerSemantics).toBe('movement-complete-gate-cell-offline-policy');
  stateCheckpoints.gateMovementInProgress={scene:compactScene(duringGateMovement),runtime:compactRuntime(battleRuntime)};

  // Explicit battleZone 1 entry; the map->zone row remains a candidate and
  // does not claim retail/server verification.
  expect(battleScene.mapId).toBe(1);
  expect(battleScene.battleZoneId).toBe(1);
  expect(battleScene.battleEntry).toMatchObject({
    battleZoneId:1,
    provenance:'RECOVERED_SECONDARY',
    authority:'offline-reconstruction',
  });
  expect(battleScene.battleEntryProvenance).toBe('RECOVERED_SECONDARY');
  expect(battleRuntime.chapter1StorySource1.mapToBattleZoneRetailVerified).toBe(false);
  assertions.push({id:'A08',status:'PASS',description:'Story source 1 is admitted at the movement-complete gate edge into explicit battleZone 1, independent of Quest1 SELECT; entry provenance remains RECOVERED_SECONDARY and runtimeVerified=false. This rechecks the B4-1 Story-entry result.',evidence_refs:['checkpoints.gateMovementInProgress','checkpoints.battleEntry','checkpoints.quest1Selected']});
  // A08 is the B4-1 Story source 1 -> battleZone 1 binding; this full-chain run rechecks it in context.
  stateCheckpoints.battleEntry={runtime:compactRuntime(battleRuntime),scene:compactScene(battleScene)};
  await capture(page,'s42-04','s42-04-battle-zone1.png','CH1-04','Real browser Story source 1 battle entry in battleZone 1, before any player combat action.',screenshots);

  // Quest1 SELECT is not the battle cause: the recorded selection remains
  // transient/local, quest stage stays not_started, and no pending S9 encounter
  // is present when Story source 1 enters battle.
  expect(battleRuntime.chapter1Quest1).toMatchObject({
    selectionStatus:'recorded',
    serverAcceptance:'not-asserted',
    persistence:'transient-only',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  expect(battleRuntime.quest.stage).toBe('not_started');
  expect(battleRuntime.pendingEncounter).toBeNull();
  expect(battleRuntime.chapter1StoryBattle.sourceId).toBe('story-source-1');
  expect(battleRuntime.chapter1StoryBattle.sourceId).not.toBe('quest1-early:accept');


  // The battle is real M4 combat. Pause is only a webdriver timing control;
  // no HP, enemy HP, phase or victory fixture is used to force the outcome.
  const baselineGold=battleRuntime.gold;
  const baselineProgression=battleRuntime.progression;
  const baselineQuest=battleRuntime.quest;
  const hpAtEntry=battleScene.hp;
  const combatTurns:Array<AnyRecord>=[];
  let playerActions=0;
  let attacks=0;
  let moves=0;
  let simulatedWaitMs=0;

  for(let turn=0;turn<40;turn++){
    let state=await scene(page);
    if(state.phase==='won')break;
    expect(state.phase,'Story source 1 combat must remain active until a real terminal phase').toBe('active');

    const wait=await waitForActionReady(page);
    simulatedWaitMs+=wait.simulatedMs;
    state=await scene(page);
    if(state.phase==='won')break;
    expect(state.phase).toBe('active');

    const live=state.enemies.filter((enemy:AnyRecord)=>enemy.hp>0);
    if(!live.length)break;
    live.sort((a:AnyRecord,b:AnyRecord)=>
      Math.max(Math.abs(a.cell[0]-state.battleCell[0]),Math.abs(a.cell[1]-state.battleCell[1]))-
      Math.max(Math.abs(b.cell[0]-state.battleCell[0]),Math.abs(b.cell[1]-state.battleCell[1]))
    );
    const target=live[0];
    const distance=Math.max(
      Math.abs(target.cell[0]-state.battleCell[0]),
      Math.abs(target.cell[1]-state.battleCell[1]),
    );
    if(distance>1){
      const options=await page.evaluate(()=>window.lapisM4!.acceptanceReachable() as number[][]);
      options.sort((a:number[],b:number[])=>
        Math.max(Math.abs(a[0]-target.cell[0]),Math.abs(a[1]-target.cell[1]))-
        Math.max(Math.abs(b[0]-target.cell[0]),Math.abs(b[1]-target.cell[1]))
      );
      expect(options.length,'Story source 1 must retain a reachable tactical movement option').toBeGreaterThan(0);
      const cell=options[0];
      await page.evaluate(({x,y})=>window.lapisM4!.acceptanceIssueMoveTo((x+1)*32,(y+1)*16),{x:cell[0],y:cell[1]});
      moves++;
      combatTurns.push({turn:turn+1,action:'move',from:state.battleCell,to:cell,targetId:target.id,readinessWait:wait});
    }else{
      await page.evaluate(id=>window.lapisM4!.acceptanceSelectEnemy(id),target.id);
      await page.evaluate(()=>window.lapisM4!.acceptanceIssueAttack());
      attacks++;
      combatTurns.push({turn:turn+1,action:'ordinary-attack',targetId:target.id,targetCell:target.cell,readinessWait:wait});
    }
    playerActions++;
  }

  const victoryScene=await scene(page);
  const victoryRuntime=await runtime(page);
  expect(victoryScene.phase,'Story source 1 must reach victory through actual combat, not a forced phase fixture').toBe('won');
  expect(playerActions).toBeGreaterThan(0);
  expect(playerActions).toBeLessThanOrEqual(40);
  expect(attacks).toBeGreaterThan(0);
  expect(victoryScene.hp).toBeGreaterThan(0);
  expect(victoryScene.hp).toBeLessThanOrEqual(hpAtEntry);
  expect(victoryRuntime.chapter1StoryBattle.sourceId).toBe('story-source-1');
  expect(victoryRuntime.chapter1Quest1.selectionStatus).toBe('recorded');
  expect(victoryRuntime.quest.stage).toBe('not_started');
  expect(victoryRuntime.pendingEncounter).toBeNull();
  expect(victoryRuntime.gold).toBe(baselineGold);
  expect(victoryRuntime.progression).toEqual(baselineProgression);
  expect(victoryRuntime.quest).toEqual(baselineQuest);
  expect(victoryRuntime.chapter1StorySource1.bossVictoryRuntimeEnforced).toBe(false);
  assertions.push({id:'A09',status:'PASS',description:'Real Story source 1 M4 combat reaches phase won within 40 player actions, with 12-second action-ready waits, no HP/enemy-HP/forced-victory fixture and no reward settlement.',evidence_refs:['checkpoints.battleVictory.turns','checkpoints.battleVictory','s42-05-victory.png']});
  stateCheckpoints.battleVictory={
    runtime:compactRuntime(victoryRuntime),
    scene:compactScene(victoryScene),
    playerActions,
    attacks,
    moves,
    simulatedWaitMs,
    actionReadyWaitTimeoutMs:12000,
    maxStepsPerWait:40,
    hpAtEntry,
    hpAtVictory:victoryScene.hp,
    hpMutationFixtureUsed:false,
    enemyHpMutationFixtureUsed:false,
    forcedVictoryFixtureUsed:false,
    turns:combatTurns,
  };
  await capture(page,'s42-05','s42-05-victory.png','CH1-04','Real M4 Story source 1 combat reaches victory before returning to the world.',screenshots);

  // Return is the recovered story-victory-return-01 spawn record, not route-052.
  const returnButton=page.locator('[data-action="return"]:visible');
  await expect(returnButton).toBeVisible();
  await returnButton.click();
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return !visual.inBattleView&&state.world.mapId===1060&&state.world.x===20&&state.world.y===120;
  },{timeout:30000,intervals:[100,250,500]}).toBe(true);
  const returnedRuntime=await runtime(page);
  const returnedScene=await scene(page);
  expect(returnedRuntime.world).toEqual({mapId:1060,x:20,y:120});
  expect(returnedRuntime.chapter1.victoryReturn).toMatchObject({mapId:1060,cell:[20,120]});
  expect(returnedRuntime.chapter1.routes.some((route:AnyRecord)=>String(route.routeId).includes('052'))).toBe(false);
  expect(returnedRuntime.chapter1StoryBattle).toBeNull();
  expect(returnedRuntime.chapter1StoryLastResolution).toMatchObject({
    sourceId:'story-source-1',
    outcome:'won',
    fieldMapId:1030,
    gateCell:[72,30],
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
  expect(returnedRuntime.chapter1StorySuppressedUntilLeaveGate).toBe(false);
  expect(returnedRuntime.gold).toBe(baselineGold);
  expect(returnedRuntime.progression).toEqual(baselineProgression);
  expect(returnedRuntime.quest).toEqual(baselineQuest);
  expect(returnedRuntime.pendingEncounter).toBeNull();
  expect(returnedScene.mapId).toBe(1060);
  expect(returnedScene.inBattleView).toBe(false);
  assertions.push({id:'A10',status:'PASS',description:'Victory returns through story-victory-return-01 to map1060 (20,120); route-052 is not used and S9 rewards/Quest1 completion remain untouched.',evidence_refs:['checkpoints.victoryReturn','s42-06-map1060-return.png']});
  stateCheckpoints.victoryReturn={
    runtime:compactRuntime(returnedRuntime),
    scene:compactScene(returnedScene),
    returnRecordId:'story-victory-return-01',
    returnMapId:1060,
    returnCell:[20,120],
    route052Used:false,
    rewardSettlement:'not-applied',
  };
  await capture(page,'s42-06','s42-06-map1060-return.png','CH1-05','Returned to the Chapter 1 victory-return spawn on map1060 at (20,120).',screenshots);

  expect(pageErrors).toEqual([]);
  expect(screenshots).toHaveLength(6);
  expect(screenshots.map(item=>item.screenshot_id)).toEqual(['s42-01','s42-02','s42-03','s42-04','s42-05','s42-06']);
  assertions.push({id:'A11',status:'PASS',description:'Six real-browser screenshots and the checkpoint JSON are captured and readable; pageerror count is zero.',evidence_refs:screenshots.map(item=>item.filename).concat(['test-results/s42-ch1-checkpoints.json'])});
  checkpoints.errors={pageErrors,consoleErrors};
  checkpoints.assertions=assertions;
  checkpoints.screenshots=screenshots;
  checkpoints.test_summary={
    test_cases:{total:1,passed:1,failed:0,skipped:0,not_run:0},
    assertions:{total:11,executed:11,passed:11,failed:0,blocked:0,not_run:0},
  };
  const checkpointPath='test-results/s42-ch1-checkpoints.json';
  writeFileSync(checkpointPath,JSON.stringify(checkpoints,null,2)+'\n');
  const readback=JSON.parse(readFileSync(checkpointPath,'utf8'));
  expect(readback.assertions).toHaveLength(11);
  expect(readback.assertions.every((item:AnyRecord)=>item.status==='PASS')).toBe(true);
  expect(readback.screenshots).toHaveLength(6);
  expect(readback.errors.pageErrors).toEqual([]);
  expect(existsSync(checkpointPath)).toBe(true);
  expect(statSync(checkpointPath).size).toBeGreaterThan(0);
});
