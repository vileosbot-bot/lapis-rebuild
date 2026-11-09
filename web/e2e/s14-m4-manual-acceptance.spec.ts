import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';

const snap=(page:Page)=>page.evaluate(()=>window.lapisDiagnostics!.snapshot());
const m4=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot());

async function ready(page:Page){
  await page.goto('/?m4=1');
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>typeof (window.lapisM4 as any)?.acceptanceSetBattlePaused==='function');
}

async function acceptanceSetBattlePaused(page:Page,paused=true){
  await page.evaluate(value=>{
    const api=window.lapisM4 as any;
    if(typeof api?.acceptanceSetBattlePaused!=='function')throw new Error('Missing S14 pause fixture');
    api.acceptanceSetBattlePaused(value);
  },paused);
}

async function acceptanceCanAct(page:Page):Promise<boolean>{
  return page.evaluate(()=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceCanAct!=='function')throw new Error('Missing S14 action fixture');return api.acceptanceCanAct();});
}

async function acceptanceActionReady(page:Page):Promise<boolean>{
  return page.evaluate(()=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceActionReady!=='function')throw new Error('Missing S14 readiness fixture');return api.acceptanceActionReady();});
}

async function acceptanceReachable(page:Page):Promise<number[][]>{
  return page.evaluate(()=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceReachable!=='function')throw new Error('Missing S14 reachability fixture');return api.acceptanceReachable();});
}

async function acceptanceIssueMoveTo(page:Page,x:number,y:number){
  await page.evaluate(({x,y})=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceIssueMoveTo!=='function')throw new Error('Missing S14 movement fixture');api.acceptanceIssueMoveTo(x,y);},{x,y});
}

async function acceptanceIssueAttack(page:Page){
  await page.evaluate(()=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceIssueAttack!=='function')throw new Error('Missing S14 attack fixture');api.acceptanceIssueAttack();});
}

async function advanceBattleStep(page:Page){
  await page.evaluate(()=>{const api=window.lapisM4 as any;if(typeof api?.acceptanceAdvanceLiveBattleStep!=='function')throw new Error('Missing S14 battle-step fixture');api.acceptanceAdvanceLiveBattleStep();});
}

async function m4Action(page:Page,action:string){
  await page.evaluate((value)=>{
    const button=document.querySelector<HTMLButtonElement>(`[data-action="${value}"]`);
    if(!button)throw new Error(`Missing M4 action ${value}`);
    button.click();
  },action);
}
async function chooseDialogue(page:Page,id:string){
  const choice=page.locator(`[data-dialogue-choice="${id}"]`);
  await expect(choice).toBeVisible();
  await choice.click();
}

async function selectLiveTarget(page:Page,targetId:string){
  await page.evaluate(id=>{
    const api=window.lapisM4 as any;
    if(typeof api?.acceptanceSelectEnemy!=='function')throw new Error('Missing S14 target fixture');
    api.acceptanceSelectEnemy(id);
  },targetId);
  await expect.poll(async()=>(await snap(page)).target,{intervals:[50]}).toBe(targetId);
}

async function waitForSwordsmanActionOrEnd(page:Page){
  let steps=0;
  await expect.poll(async()=>{
    if(steps>=40)return false;
    const result=await page.evaluate((remaining)=>{
      const api=window.lapisM4 as any;
      if(typeof api?.acceptanceAdvanceUntilActionOrEnd!=='function')throw new Error('Missing S14 batch-advance fixture');
      return api.acceptanceAdvanceUntilActionOrEnd(remaining) as {done:boolean;stepsAdvanced:number};
    },40-steps);
    steps+=result.stepsAdvanced;
    return result.done;
  },{timeout:10000,intervals:[50]}).toBe(true);
}

async function waitForWizardActionReady(page:Page){
  let steps=0;
  await expect.poll(async()=>{
    if(await acceptanceActionReady(page))return true;
    if(steps>=40)return false;
    await advanceBattleStep(page);
    steps+=1;
    return acceptanceActionReady(page);
  },{timeout:10000}).toBe(true);
}

async function waitForBattleCellChange(page:Page,from:string){
  let steps=0;
  await expect.poll(async()=>{
    const current=JSON.stringify((await snap(page)).battleCell);
    if(current!==from||steps>=40)return current;
    await advanceBattleStep(page);
    steps+=1;
    return JSON.stringify((await snap(page)).battleCell);
  },{timeout:10000}).not.toBe(from);
}

async function waitForBattleVictory(page:Page){
  let steps=0;
  await expect.poll(async()=>{
    const phase=(await snap(page)).phase;
    if(phase!=='active'||steps>=40)return phase;
    await advanceBattleStep(page);
    steps+=1;
    return (await snap(page)).phase;
  },{timeout:10000}).toBe('won');
}

test('S14 M4 swordsman completes the playable quest, rewards and SaveV2 path',async({page})=>{
  test.setTimeout(150000);
  const checkpoints:Record<string,unknown>={};
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));

  await ready(page);
  test.skip((await m4(page)).playableRecovery===true,'Superseded by M5 spatial playable-recovery acceptance on private-original packs.');
  const start=await m4(page);
  expect(start.world.mapId).toBe(1);
  expect(start.quest.stage).toBe('not_started');
  expect((await snap(page)).character).toBe('100');
  checkpoints.start={m4:start,scene:await snap(page)};
  await page.screenshot({path:'test-results/s14-01-m4-field.png',fullPage:true});

  // Use the actual M4 menu -> inventory path and the same legal swordsman
  // loadout already proven by the S7 real-resource acceptance. The authored
  // item text is retail data; these training bonuses remain reconstruction.
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ui="game-menu"]')).toBeVisible();
  await m4Action(page,'inventory');
  await expect(page.locator('.inventory-panel')).toBeVisible();
  await page.selectOption('#equip-weapon','3');
  await page.selectOption('#equip-armor','25');
  await expect.poll(async()=>{const state=await snap(page);return `${state.inventory.weapon}/${state.inventory.armor}/${state.equipment.attack}/${state.equipment.defense}`;}).toBe('3/25/7/2');
  checkpoints.equipped={m4:await m4(page),scene:await snap(page)};
  await m4Action(page,'inventory');
  await page.keyboard.press('Escape');

  // Player-facing world flow: E opens the dialogue; explicit Accept mutates
  // the reconstruction quest and then uses the compatibility warp.
  await page.keyboard.press('e');
  await chooseDialogue(page,'accept-quest');
  await expect.poll(async()=>(await m4(page)).quest.stage).toBe('accepted');
  expect((await m4(page)).world.mapId).toBe(1);
  checkpoints.accepted={m4:await m4(page),scene:await snap(page)};
  await page.screenshot({path:'test-results/s14-02-quest-accepted.png',fullPage:true});

  await acceptanceSetBattlePaused(page,true);
  await page.keyboard.press('e');
  await expect.poll(async()=>(await m4(page)).quest.stage).toBe('objective');
  await expect.poll(async()=>(await snap(page)).inBattleView).toBe(true);
  const entered=await snap(page);
  expect(entered.battleZoneId).toBe(0);
  expect(entered.battleEntryProvenance).toBe('RECONSTRUCTION_POLICY');
  expect(entered.damagePolicy.provenance).toBe('RECONSTRUCTION_POLICY');
  await expect(page.locator('[data-ui="battle-hud"]')).toBeVisible();
  checkpoints.entered={m4:await m4(page),scene:entered};
  await page.screenshot({path:'test-results/s14-03-swordsman-battle.png',fullPage:true});

  let capturedMove=false;
  let capturedAttack=false;
  for(let turn=0;turn<28;turn++){
    await waitForSwordsmanActionOrEnd(page);
    const state=await snap(page);
    if(state.phase==='won')break;
    expect(state.phase,`Battle ended unexpectedly: ${JSON.stringify({hp:state.hp,enemies:state.enemies})}`).toBe('active');
    const target=state.enemies.find(enemy=>enemy.hp>0);
    if(!target)break;

    if(state.target!==target.id)await selectLiveTarget(page,target.id);
    const current=await snap(page);
    const live=current.enemies.find(enemy=>enemy.id===target.id&&enemy.hp>0)!;
    const distance=Math.max(Math.abs(live.cell[0]-current.battleCell[0]),Math.abs(live.cell[1]-current.battleCell[1]));
    if(distance<=1){
      await acceptanceIssueAttack(page);
      if(!capturedAttack){
        await page.waitForTimeout(120);
        checkpoints.firstAttack=await snap(page);
        await page.screenshot({path:'test-results/s14-05-swordsman-attack.png',fullPage:true});
        capturedAttack=true;
      }
      continue;
    }

    const options=[...(await acceptanceReachable(page))].sort((a,b)=>
      Math.max(Math.abs(a[0]-live.cell[0]),Math.abs(a[1]-live.cell[1]))-
      Math.max(Math.abs(b[0]-live.cell[0]),Math.abs(b[1]-live.cell[1]))
    );
    expect(options.length).toBeGreaterThan(0);
    const from=JSON.stringify(current.battleCell);
    const cell=options[0];
    await acceptanceIssueMoveTo(page,(cell[0]+1)*32,(cell[1]+1)*16);
    await waitForBattleCellChange(page,from);
    if(!capturedMove){
      checkpoints.firstMove=await snap(page);
      await page.screenshot({path:'test-results/s14-04-swordsman-move.png',fullPage:true});
      capturedMove=true;
    }
  }

  await waitForBattleVictory(page);
  expect(capturedMove).toBe(true);
  expect(capturedAttack).toBe(true);
  checkpoints.victory=await snap(page);
  await page.screenshot({path:'test-results/s14-06-victory.png',fullPage:true});

  await m4Action(page,'return');
  await expect.poll(async()=>(await snap(page)).inBattleView).toBe(false);
  await expect.poll(async()=>(await m4(page)).quest.stage).toBe('ready_to_turn_in');
  let state=await m4(page);
  expect(state.gold).toBe(10);
  expect(state.progression.exp).toBe(100);
  expect(state.progression.level).toBe(1);
  checkpoints.returned={m4:state,scene:await snap(page)};
  await page.screenshot({path:'test-results/s14-07-returned.png',fullPage:true});

  await page.keyboard.press('e');
  await chooseDialogue(page,'turn-in-quest');
  await expect.poll(async()=>(await m4(page)).quest.stage).toBe('complete');
  state=await m4(page);
  expect(state.gold).toBe(15);
  expect(state.progression.exp).toBe(300);
  expect(state.progression.level).toBe(1);
  const save=JSON.parse(await page.evaluate(()=>window.lapisM4!.exportJson()));
  expect(save.version).toBe(2);
  expect(save.quest.stage).toBe('complete');
  expect(save.gold).toBe(15);
  expect(save.progression.exp).toBe(300);
  expect(save.progression.level).toBe(1);
  checkpoints.complete={m4:state,save};
  await page.screenshot({path:'test-results/s14-08-quest-complete.png',fullPage:true});

  expect(errors).toEqual([]);
  writeFileSync('test-results/s14-m4-swordsman-acceptance.json',JSON.stringify(checkpoints,null,2));
});

test('S14 M4 wizard uses authored vitals, visible magic and opt-in diagnostics',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await ready(page);
  test.skip((await m4(page)).playableRecovery===true,'Superseded by M5 private-original wizard/runtime validation.');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action="class-wizard"]')).toBeVisible();
  await page.evaluate(()=>{
    const button=document.querySelector<HTMLButtonElement>('[data-action="class-wizard"]');
    if(!button)throw new Error('Missing wizard class action');
    button.click();
  });
  await expect.poll(async()=>(await snap(page)).character).toBe('109');
  await page.keyboard.press('e');
  await chooseDialogue(page,'accept-quest');
  await acceptanceSetBattlePaused(page,true);
  await page.keyboard.press('e');
  await expect.poll(async()=>(await snap(page)).inBattleView).toBe(true);
  await expect(page.locator('[data-skill-id="19101"]')).toBeVisible();
  await expect(page.locator('[data-skill-id="19201"]')).toHaveCount(0);
  await expect(page.locator('[data-skill-id="19301"]')).toHaveCount(0);
  const before=await snap(page);
  expect(before.hp).toBe(100);
  expect(before.mp).toBe(130);
  await waitForWizardActionReady(page);
  await page.keyboard.press('1');
  await expect.poll(async()=>(await snap(page)).mp).toBeLessThan(before.mp);
  const after=await snap(page);
  expect(after.character).toBe('109');
  expect(after.damagePolicy.provenance).toBe('RECONSTRUCTION_POLICY');
  await page.screenshot({path:'test-results/s14-09-wizard-magic.png',fullPage:true});

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-action="dev-toggle"]')).toBeVisible();
  await page.evaluate(()=>{
    const toggle=document.querySelector<HTMLInputElement>('[data-action="dev-toggle"]');
    if(!toggle)throw new Error('Missing developer diagnostics toggle');
    toggle.checked=true;
    toggle.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(page.locator('body')).toHaveClass(/m4-dev-enabled/);
  await expect(page.locator('#m4-debug-root')).toContainText('RECONSTRUCTION_POLICY');
  await page.screenshot({path:'test-results/s14-10-developer-diagnostics.png',fullPage:true});

  expect(errors).toEqual([]);
  writeFileSync('test-results/s14-m4-wizard-acceptance.json',JSON.stringify({before,after,m4:await m4(page)},null,2));
});
