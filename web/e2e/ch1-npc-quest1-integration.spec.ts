import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

const runtime=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot());
const scene=(page:Page)=>page.evaluate(()=>window.lapisDiagnostics!.snapshot());

async function ready(page:Page){
  await page.goto('/?m4=1&ch1=1');
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
  await expect(page.locator('#canvas-host canvas')).toBeVisible();
}

async function moveFieldTo(page:Page,cell:readonly[number,number]){
  await page.evaluate(([x,y])=>{
    const move=window.lapisM4?.acceptanceMoveFieldTo;
    if(!move)throw new Error('Missing Chapter 1 acceptance movement fixture');
    move(x,y);
  },cell);
}

async function clickVisibleNpc(page:Page){
  const state=await scene(page);
  const target=state.worldPointerTargets.find((row:{id:string;visible:boolean})=>row.id==='ch1-npc-21003'&&row.visible);
  if(!target)throw new Error('Visible Chapter 1 NPC pointer target is missing');
  const canvas=page.locator('#canvas-host canvas');
  const box=await canvas.boundingBox();
  if(!box)throw new Error('Missing Phaser canvas');
  const worldX=(target.bounds.left+target.bounds.right)/2;
  const worldY=(target.bounds.top+target.bounds.bottom)/2;
  await page.mouse.click(
    box.x+(worldX-state.camera.x)*state.camera.zoom,
    box.y+(worldY-state.camera.y)*state.camera.zoom,
  );
}

test('B3 Chapter 1 S18 route transitions keep NPC 21003 scoped to map 1000',async({page})=>{
  test.setTimeout(180000);
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));

  await ready(page);
  const initial=await runtime(page);
  expect(initial.runtimeMode).toBe('chapter1');
  expect(initial.chapter1?.mapIds).toEqual([1000,1020,1030,1060]);
  expect(initial.chapter1?.provenance).toBe('RECOVERED_SECONDARY');
  expect(initial.chapter1?.runtimeVerified).toBe(false);

  const start=await scene(page);
  expect(start.mapId).toBe(1000);
  const npcAtStart=start.worldVisuals.find((row:{id:string})=>row.id==='ch1-npc-21003');
  expect(npcAtStart).toMatchObject({mapId:1000,resourceId:4524,visible:true});
  expect(start.worldPointerTargets.some((row:{id:string;visible:boolean})=>row.id==='ch1-npc-21003'&&row.visible)).toBe(true);

  // Exercise the production movement path into the already-approved S18
  // activation cell; the coordinator must commit the route, not call setMap.
  await moveFieldTo(page,[139,5]);
  await expect.poll(async()=>(await scene(page)).mapId,{timeout:60000,intervals:[100]}).toBe(1020);
  await expect.poll(async()=>(await scene(page)).routeLength,{timeout:10000}).toBe(0);
  const northRoad=await scene(page);
  expect(northRoad.worldVisuals.find((row:{id:string})=>row.id==='ch1-npc-21003')).toMatchObject({mapId:1000,resourceId:4524,visible:false});
  expect(northRoad.worldPointerTargets.some((row:{id:string})=>row.id==='ch1-npc-21003')).toBe(false);

  await moveFieldTo(page,[4,174]);
  await expect.poll(async()=>(await scene(page)).mapId,{timeout:60000,intervals:[100]}).toBe(1000);
  await expect.poll(async()=>(await scene(page)).routeLength,{timeout:10000}).toBe(0);
  const returned=await scene(page);
  expect(returned.worldVisuals.find((row:{id:string})=>row.id==='ch1-npc-21003')).toMatchObject({mapId:1000,resourceId:4524,visible:true});
  expect(returned.worldPointerTargets.some((row:{id:string;visible:boolean})=>row.id==='ch1-npc-21003'&&row.visible)).toBe(true);
  expect((await runtime(page)).chapter1Quest1.selectionStatus).toBe('not-recorded');
  expect(pageErrors).toEqual([]);
});

test('B3 NPC 21003 supports pointer and E-key Quest1 SELECT without server or save claims',async({page})=>{
  test.setTimeout(180000);
  const pageErrors:string[]=[];
  page.on('pageerror',error=>pageErrors.push(error.message));

  await ready(page);
  const initial=await runtime(page);
  expect(initial.chapter1Quest1).toMatchObject({
    recordId:'quest1-early:accept',
    questFileNumber:1,
    marker:'SELECT',
    step:1,
    actorToken:'100',
    selectionStatus:'not-recorded',
    serverAcceptance:'not-asserted',
    recruitment:'not-implemented',
    reward:'not-recovered',
    persistence:'transient-only',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });

  // Cell (34,72) is walkable and within the explicit reconstruction radius 2
  // of the recovered candidate at (32,72).
  await moveFieldTo(page,[34,72]);
  await expect.poll(async()=>{
    const state=await scene(page);
    return state.mapId===1000&&state.routeLength===0
      &&Math.abs(state.anchor.x-1120)<1&&Math.abs(state.anchor.y-1168)<1;
  },{timeout:90000,intervals:[100]}).toBe(true);

  await clickVisibleNpc(page);
  const dialogue=page.locator('[data-ui="npc-dialogue"]');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toHaveAttribute('data-quest-file','Quest1');
  await expect(dialogue).toHaveAttribute('data-marker','SELECT');
  await expect(dialogue).toHaveAttribute('data-step','1');
  await expect(dialogue).toHaveAttribute('data-input-source','pointer');
  await expect(dialogue).toContainText('吉奥老师');
  await expect(dialogue).toContainText('您好. 早就久仰大名.');
  await expect(dialogue.locator('[data-dialogue-choice="record-selection"]')).toBeVisible();
  expect((await runtime(page)).chapter1Quest1.selectionStatus).toBe('not-recorded');

  await page.keyboard.press('Escape');
  await expect(dialogue).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toHaveAttribute('data-input-source','keyboard');
  await dialogue.locator('[data-dialogue-choice="record-selection"]').click();
  await expect(dialogue).toHaveCount(0);

  const selected=await runtime(page);
  expect(selected.chapter1Quest1).toMatchObject({
    actorToken:'100',
    selectionStatus:'recorded',
    serverAcceptance:'not-asserted',
    recruitment:'not-implemented',
    reward:'not-recovered',
    persistence:'transient-only',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
  // The Chapter 1 SELECT record does not mutate the legacy S9 training quest.
  expect(selected.quest.stage).toBe('not_started');

  const save=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(save).not.toHaveProperty('chapter1Quest1');
  expect(JSON.stringify(save)).not.toContain('selectionStatus');
  expect(pageErrors).toEqual([]);
});
