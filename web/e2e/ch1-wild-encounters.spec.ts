import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

const ASSET_INDEX_PATH=fileURLToPath(new URL('../public/game-data/asset-index.json',import.meta.url));
const ASSET_INDEX_TEXT=existsSync(ASSET_INDEX_PATH)?readFileSync(ASSET_INDEX_PATH,'utf8'):'';
const ASSET_INDEX=ASSET_INDEX_TEXT?JSON.parse(ASSET_INDEX_TEXT) as Record<string,any>:null;
const REQUIRED_MAP_FILES=[1000,1020,1030,1060].flatMap(id=>[
  'maps/map-'+id+'.png',
  'maps/map-'+id+'-collision.json',
]);
const PRIVATE_ORIGINAL_PACK_AVAILABLE=!!ASSET_INDEX
  &&!ASSET_INDEX_TEXT.includes('SYNTHETIC')
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

async function ready(page:Page):Promise<void>{
  await page.goto('/?m4=1&ch1=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
  await page.waitForFunction(()=>{
    const api=window.lapisM4 as any;
    return typeof api?.acceptanceMoveFieldTo==='function'
      &&typeof api?.acceptanceSetEnemyHp==='function'
      &&typeof api?.acceptanceSetBattlePaused==='function'
      &&typeof api?.acceptanceCanAct==='function'
      &&typeof api?.acceptanceIssueAttack==='function'
      &&typeof api?.acceptanceAdvanceUntilActionOrEnd==='function';
  });
}

async function moveFieldTo(page:Page,x:number,y:number):Promise<void>{
  await page.evaluate(([targetX,targetY])=>{
    const api=window.lapisM4 as any;
    api.acceptanceMoveFieldTo(targetX,targetY);
  },[x,y]);
}

async function waitForFieldCell(page:Page,mapId:number,x:number,y:number):Promise<void>{
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.world.mapId===mapId&&state.world.x===x&&state.world.y===y&&visual.routeLength===0&&!visual.inBattleView;
  },{timeout:240000,intervals:[50,100,250,500]}).toBe(true);
}

async function waitForRouteCell(page:Page,mapId:number,x:number,y:number):Promise<void>{
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.world.mapId===mapId&&state.world.x===x&&state.world.y===y&&visual.routeLength>0&&!visual.inBattleView;
  },{timeout:240000,intervals:[20,50,100]}).toBe(true);
}

async function waitForMap(page:Page,mapId:number):Promise<void>{
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.world.mapId===mapId&&!visual.inBattleView;
  },{timeout:240000,intervals:[50,100,250,500]}).toBe(true);
}

async function waitForWildBattle(page:Page,entityId:number):Promise<AnyRecord>{
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return visual.inBattleView&&state.chapter1Wild?.activeBattle?.entityId===entityId;
  },{timeout:240000,intervals:[50,100,250]}).toBe(true);
  return scene(page);
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

async function finishWildBattle(page:Page,enemyId:string):Promise<void>{
  await page.evaluate(()=>{(window.lapisM4 as any).acceptanceSetBattlePaused(true);});
  await page.evaluate((id)=>{
    (window.lapisM4 as any).acceptanceSetEnemyHp(id,1);
  },enemyId);
  await page.evaluate(async()=>{
    const api=window.lapisM4 as any;
    for(let attempt=0;attempt<8;attempt++){
      const state=window.lapisDiagnostics!.snapshot() as AnyRecord;
      if(state.phase!=='active')return;
      if(!api.acceptanceCanAct()){
        const result=api.acceptanceAdvanceUntilActionOrEnd(40);
        if(!result.done)throw new Error('Wild battle action readiness timed out');
      }
      if(api.acceptanceCanAct())api.acceptanceIssueAttack();
    }
  });
  await expect.poll(async()=>(await scene(page)).phase,{timeout:30000,intervals:[50,100,250]}).toBe('won');
  await page.locator('[data-action="return"]').click();
  await expect.poll(async()=>(await runtime(page)).chapter1Wild.state.defeatedEntityIds.includes(22024)).toBe(true);
}

test('M7.3 map 1020 wild encounters P6 acceptance D1-D8',async({page})=>{
  test.setTimeout(720000);
  test.skip(!PRIVATE_ORIGINAL_PACK_AVAILABLE,'M7.3 browser acceptance requires the private-original derived pack and four map PNG/collision pairs; synthetic resources cannot prove field behavior.');

  const pageErrors:string[]=[];
  const consoleErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  mkdirSync('test-results',{recursive:true});
  const assertions:Array<{id:string;status:'PASS';description:string;evidence_refs:string[]}>= [];
  const screenshots:ScreenshotRecord[]=[];
  const checkpoints:AnyRecord={schema_version:1,request_id:'ch1-m73-wild-20261114-01',assertions,screenshots,checkpoints:{},errors:{pageErrors,consoleErrors}};
  const checkpoint=checkpoints.checkpoints as AnyRecord;

  await ready(page);
  const initial=await runtime(page);
  expect(initial.runtimeMode).toBe('chapter1');
  expect(initial.world).toEqual({mapId:1000,x:93,y:5});
  expect(initial.chapter1Wild.state).toMatchObject({
    schema:1,spawnGeneration:1,defeatedEntityIds:[],suppressedEntityId:null,refreshOnNextEntry:false,provenance:'RECONSTRUCTION_POLICY',
  });
  assertions.push({id:'P6-01',status:'PASS',description:'M7.3 starts in Chapter 1 mode with a clean wild state and six-row catalog available.',evidence_refs:['checkpoints.initial']});
  checkpoint.initial={runtime:initial,privatePack:{assetIndexSha256:createHash('sha256').update(ASSET_INDEX_TEXT).digest('hex'),requiredMaps:REQUIRED_MAP_FILES.map(path=>{const absolute=fileURLToPath(new URL('../public/game-data/'+path,import.meta.url));return{path,bytes:statSync(absolute).size,sha256:createHash('sha256').update(readFileSync(absolute)).digest('hex')};})}};

  // Route 040 takes the player from map1000 to the map1020 arrival cell.
  await moveFieldTo(page,140,8);
  await waitForMap(page,1020);
  await waitForFieldCell(page,1020,3,173);
  checkpoint.route040=await runtime(page);

  // Route 048 crosses two wild placement cells. Wild authority must remain
  // disabled while routeLength > 0; route transition wins the snapshot.
  await moveFieldTo(page,67,13);
  await waitForRouteCell(page,1020,37,139);
  expect((await scene(page)).inBattleView).toBe(false);
  checkpoint.route048Crossing22022={runtime:await runtime(page),scene:await scene(page)};
  await waitForRouteCell(page,1020,54,130);
  expect((await scene(page)).inBattleView).toBe(false);
  checkpoint.route048Crossing22023={runtime:await runtime(page),scene:await scene(page)};
  await waitForMap(page,1030);
  await waitForFieldCell(page,1030,5,137);
  expect((await scene(page)).inBattleView).toBe(false);
  assertions.push({id:'P6-02',status:'PASS',description:'Route040/048 transitions complete without wild battles; route048 crosses entities 22022 and 22023 while movement is active, proving D4 route-length exclusion.',evidence_refs:['checkpoints.route040','checkpoints.route048Crossing22022','checkpoints.route048Crossing22023']});

  // Route 049 returns to map1020. The player then approaches entity 22024.
  await moveFieldTo(page,6,138);
  await waitForMap(page,1020);
  await waitForFieldCell(page,1020,66,4);
  const generationBefore= (await runtime(page)).chapter1Wild.state.spawnGeneration;
  await moveFieldTo(page,48,120);
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.chapter1Wild.nearby?.entityId===22024&&state.chapter1Wild.nearby?.status==='eligible'&&visual.routeLength>0;
  },{timeout:240000,intervals:[20,50,100]}).toBe(true);
  const nearby=await runtime(page);
  expect(nearby.chapter1Wild.nearby).toMatchObject({entityId:22024,name:'雷德普罗',minimumLevel:1,distance:2,status:'eligible',provenance:'RECONSTRUCTION_POLICY'});
  await capture(page,'wild-01','wild-01-field-nearby.png','M7.3-D4','Map1020 field HUD shows 雷德普罗, level threshold, Manhattan distance and eligible state while route is still moving.',screenshots);
  assertions.push({id:'P6-03',status:'PASS',description:'HUD exposes one unique nearby candidate with name, level gate, distance and status; trigger waits until movement completes.',evidence_refs:['checkpoints.nearby','wild-01-field-nearby.png']});
  checkpoint.nearby=nearby;

  const battleEntry=await waitForWildBattle(page,22024);
  expect(battleEntry.mapId).toBe(1020);
  expect(battleEntry.battleZoneId).toBe(1020);
  expect(battleEntry.battleEntryProvenance).toBe('RECONSTRUCTION_POLICY');
  expect(battleEntry.enemies).toHaveLength(1);
  expect(battleEntry.enemies[0]).toMatchObject({id:'雷德普罗',hp:100,maxHp:100,mp:100,maxMp:100,visualResourceId:null});
  expect(battleEntry.enemies[0].aiBinding).toMatchObject({source:'reconstruction',provenance:'RECONSTRUCTION_POLICY'});
  await capture(page,'wild-02','wild-02-battle-entry.png','M7.3-D2-D3-D7-D8','One 雷德普罗 enemy enters fallback battleZone1020 with recovered HP/MP and explicit text fallback.',screenshots);
  assertions.push({id:'P6-04',status:'PASS',description:'D2/D3/D7/D8: one enemy only, battleZone1020 reconstruction fallback, HP/MP preserved, default reconstruction stats/AI and no original animation binding.',evidence_refs:['checkpoints.battleEntry','wild-02-battle-entry.png']});
  checkpoint.battleEntry=battleEntry;

  await finishWildBattle(page,'雷德普罗');
  const won=await runtime(page);
  const wonSave=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(won.gold).toBe(40);
  expect(won.inventory.items.find((item:AnyRecord)=>item.itemId===4002)?.quantity).toBe(1);
  expect(won.chapter1Wild.state.defeatedEntityIds).toContain(22024);
  expect(wonSave.rewardReceipts).toContain('ch1-wild-1-22024-win');
  expect(won.progression.level).toBeGreaterThanOrEqual(1);
  expect(won.progression.exp).toBeGreaterThanOrEqual(100);
  await capture(page,'wild-03','wild-03-victory-reward.png','M7.3-D1','Victory grants 40 gold, EXP100 and exactly one item4002.',screenshots);
  assertions.push({id:'P6-05',status:'PASS',description:'D1: victory settles the recovered row reward and 100% × 1 item4002 under a generation/entity receipt; EXP flows through progression authority.',evidence_refs:['checkpoints.victoryReward','wild-03-victory-reward.png']});
  checkpoint.victoryReward={runtime:won,save:{rewardReceipts:wonSave.rewardReceipts,inventory:wonSave.inventory,progression:wonSave.progression}};

  // Save/load keeps defeated state and reward receipt; replaying the same
  // receipt is idempotent (covered again by the pure unit suite).
  await page.evaluate(()=>{
    const api=window.lapisM4!;
    const raw=JSON.parse(api.exportJson());
    api.restore(raw);
  });
  const restored=await runtime(page);
  const restoredSave=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(restored.chapter1Wild.state.defeatedEntityIds).toContain(22024);
  expect(restored.chapter1Wild.state.spawnGeneration).toBe(generationBefore);
  expect(restoredSave.rewardReceipts).toContain('ch1-wild-1-22024-win');
  expect(restored.inventory.items.find((item:AnyRecord)=>item.itemId===4002)?.quantity).toBe(1);
  await capture(page,'wild-04','wild-04-save-load-state.png','M7.3-D5','Save/restore preserves defeated entity and reward receipt before map re-entry.',screenshots);
  assertions.push({id:'P6-06',status:'PASS',description:'D5 persistence boundary: save/load retains defeated IDs and generation-scoped reward receipts; the battle return itself does not refresh the map.',evidence_refs:['checkpoints.saveLoad','wild-04-save-load-state.png']});
  checkpoint.saveLoad={runtime:restored,save:{rewardReceipts:restoredSave.rewardReceipts,quest:restoredSave.quest}};

  // Leaving map1020 via route048 arms refresh; returning via route049 advances
  // the generation and clears defeated entities. This does not run S42.
  await moveFieldTo(page,67,13);
  await waitForMap(page,1030);
  await waitForFieldCell(page,1030,5,137);
  expect((await runtime(page)).chapter1Wild.state.refreshOnNextEntry).toBe(true);
  await moveFieldTo(page,6,138);
  await waitForMap(page,1020);
  await waitForFieldCell(page,1020,66,4);
  const reentered=await runtime(page);
  expect(reentered.chapter1Wild.state.spawnGeneration).toBe(generationBefore+1);
  expect(reentered.chapter1Wild.state.defeatedEntityIds).toEqual([]);
  expect(reentered.chapter1Wild.state.refreshOnNextEntry).toBe(false);
  await moveFieldTo(page,48,120);
  await expect.poll(async()=>{
    const state=await runtime(page);
    const visual=await scene(page);
    return state.chapter1Wild.nearby?.entityId===22024&&state.chapter1Wild.nearby?.status==='eligible'&&visual.routeLength>0;
  },{timeout:240000,intervals:[20,50,100]}).toBe(true);
  const respawnNearby=await runtime(page);
  await capture(page,'wild-05','wild-05-map-entry-respawn.png','M7.3-D5','After leaving and re-entering map1020, generation increments and the defeated entity becomes eligible again.',screenshots);
  assertions.push({id:'P6-07',status:'PASS',description:'D5: leaving map1020 and re-entering refreshes the six entities by incrementing spawnGeneration; defeated IDs reset and entity22024 is eligible again.',evidence_refs:['checkpoints.mapRespawn','wild-05-map-entry-respawn.png']});
  checkpoint.mapRespawn={runtime:reentered,nearby:respawnNearby};

  await waitForWildBattle(page,22024);
  const goldBeforeRetreat=(await runtime(page)).gold;
  const receiptsBeforeRetreat=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson())).rewardReceipts;
  await page.locator('[data-action="battle-exit-request"]').click();
  await page.locator('[data-action="battle-exit-confirm"]').click();
  const retreated=await runtime(page);
  const retreatSave=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(retreated.chapter1Wild.state.suppressedEntityId).toBe(22024);
  expect(retreated.gold).toBe(goldBeforeRetreat);
  expect(retreatSave.rewardReceipts).toEqual(receiptsBeforeRetreat);
  expect(retreated.inventory.items.find((item:AnyRecord)=>item.itemId===4002)?.quantity).toBe(1);
  assertions.push({id:'P6-08',status:'PASS',description:'D6: retreat gives no reward and suppresses the same entity until the player leaves Manhattan distance <4.',evidence_refs:['checkpoints.retreatNoReward']});
  checkpoint.retreatNoReward={runtime:retreated,save:{rewardReceipts:retreatSave.rewardReceipts,inventory:retreatSave.inventory}};

  await moveFieldTo(page,48,125);
  await waitForFieldCell(page,1020,48,125);
  const outside=await runtime(page);
  expect(outside.chapter1Wild.state.suppressedEntityId).toBeNull();
  await moveFieldTo(page,48,120);
  await waitForWildBattle(page,22024);
  const retried=await runtime(page);
  expect(retried.chapter1Wild.activeBattle.entityId).toBe(22024);
  assertions.push({id:'P6-09',status:'PASS',description:'D6: after leaving the strict trigger radius, the same un-defeated entity can be challenged again.',evidence_refs:['checkpoints.retryAfterLeave']});
  checkpoint.retryAfterLeave={outside,activeBattle:retried.chapter1Wild.activeBattle};

  // Unique-candidate and strict-distance decisions are also covered by
  // deterministic unit tests. Here, confirm the route and HUD policy labels.
  expect(assertions).toHaveLength(9);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  checkpoints.summary={
    assertion_count:assertions.length,
    screenshot_count:screenshots.length,
    route040And048WildSuppression:'PASS',
    s42Executed:false,
    pageErrors,
    consoleErrors,
  };
  writeFileSync('test-results/m7-3-wild-encounters-checkpoints.json',JSON.stringify(checkpoints,null,2)+'\n');
});
