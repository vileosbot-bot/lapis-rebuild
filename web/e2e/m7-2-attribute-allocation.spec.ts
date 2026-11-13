import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

type RuntimeSnapshot=Record<string,any>;
type ScreenshotEvidence={
  filename:string;
  sha256:string;
  byteCount:number;
  viewport:{width:number;height:number}|null;
};

const runtime=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot() as RuntimeSnapshot);

async function ready(page:Page):Promise<void>{
  await page.goto('/?m4=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
}

async function openMenu(page:Page):Promise<void>{
  const menu=page.locator('[data-ui="game-menu"]');
  if(await menu.isVisible().catch(()=>false))return;
  await page.locator('[data-action="menu"]:visible').click();
  await expect(menu).toBeVisible();
}

async function openAttributePanel(page:Page):Promise<void>{
  await page.locator('[data-action="attribute-panel"]:visible').click();
  await expect(page.locator('[data-ui="attribute-allocation-panel"]')).toBeVisible();
}

async function capture(page:Page,filename:string,records:ScreenshotEvidence[]):Promise<void>{
  mkdirSync('test-results',{recursive:true});
  const path='test-results/'+filename;
  await page.screenshot({path,fullPage:false});
  const bytes=readFileSync(path);
  records.push({
    filename,
    sha256:createHash('sha256').update(bytes).digest('hex'),
    byteCount:statSync(path).size,
    viewport:page.viewportSize(),
  });
}

async function runProfession(
  page:Page,
  profession:'swordsman'|'wizard',
  screenshotSuffix:string,
  baseNames:boolean,
):Promise<void>{
  await ready(page);
  await openMenu(page);
  await page.locator(profession==='swordsman'?'[data-action="class-swordsman"]':'[data-action="class-wizard"]').click();
  const expectedCharacter=profession==='swordsman'?'100':'109';
  await expect.poll(async()=>(await runtime(page)).attributes?.level).toBe(1);
  await expect.poll(async()=>(await page.evaluate(()=>window.lapisDiagnostics!.snapshot().character))).toBe(expectedCharacter);

  // This webdriver hook grants EXP through applyBattleReward. It does not
  // write or mutate any attribute field; points arrive from level-up events.
  await page.evaluate(()=>{(window.lapisM4 as any).acceptanceGrantLevel(6);});
  await expect.poll(async()=>(await runtime(page)).progression.level).toBe(6);
  const levelSix=await runtime(page);
  expect(levelSix.character).toBe(expectedCharacter);
  expect(levelSix.attributes).toMatchObject({
    level:6,
    automaticGrowth:{con:6,wis:6,str:6,dex:6,int:6,reg:6},
    allocated:{con:0,wis:0,str:0,dex:0,int:0,reg:0},
    unspentPoints:7,
  });

  const screenshots:ScreenshotEvidence[]=[];
  const beforeName=baseNames?'attribute-before-allocation.png':'attribute-before-allocation-'+screenshotSuffix+'.png';
  const afterName=baseNames?'attribute-after-allocation.png':'attribute-after-allocation-'+screenshotSuffix+'.png';
  const loadName=baseNames?'attribute-after-save-load.png':'attribute-after-save-load-'+screenshotSuffix+'.png';

  await openAttributePanel(page);
  await expect(page.locator('[data-unspent-points="7"]')).toContainText('7');
  await capture(page,beforeName,screenshots);

  await page.locator('[data-action="attribute-add"][data-attribute="str"]').click();
  await expect(page.locator('[data-attribute-total="str"]')).toHaveText('7');
  await page.locator('[data-action="attribute-cancel"]').click();
  let state=await runtime(page);
  expect(state.attributes.allocated.str).toBe(0);
  expect(state.attributes.unspentPoints).toBe(7);

  await openAttributePanel(page);
  await page.locator('[data-action="attribute-add"][data-attribute="str"]').click();
  await page.locator('[data-action="attribute-confirm"]').click();
  await expect(page.locator('[data-ui="attribute-allocation-panel"]')).toHaveCount(0);
  state=await runtime(page);
  expect(state.attributes.allocated.str).toBe(1);
  expect(state.attributes.unspentPoints).toBe(6);
  await openAttributePanel(page);
  await capture(page,afterName,screenshots);
  await page.locator('[data-action="attribute-cancel"]').click();

  await page.evaluate(async()=>{await window.lapisM4!.save();});
  await expect.poll(async()=>page.locator('#m4-runtime-notice').textContent()).toContain('存档已写入');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
  await page.evaluate(async()=>{await window.lapisM4!.load();});
  await expect.poll(async()=>(await runtime(page)).attributes?.allocated?.str).toBe(1);
  state=await runtime(page);
  expect(state.attributes.unspentPoints).toBe(6);
  expect(state.attributes.allocated.str).toBe(1);
  await openAttributePanel(page);
  await capture(page,loadName,screenshots);

  const checkpoint={
    schemaVersion:1,
    requestId:'ch1-attr-s43-20261113-01',
    profession,
    characterId:expectedCharacter,
    viewport:page.viewportSize(),
    levelGrantMethod:'webdriver acceptanceGrantLevel -> production applyBattleReward -> M7.1 level_up events',
    directAttributeMutationFixtureUsed:false,
    assertions:{
      levelSixUnspentPoints:7,
      cancelPreservedCommittedState:true,
      confirmedAllocation:{str:1,unspentPoints:6},
      saveLoadPreservedAllocation:true,
    },
    finalAttributes:state.attributes,
    screenshots,
    screenshotHashAlgorithm:'SHA-256',
  };
  writeFileSync('test-results/m7-2-attribute-allocation-'+profession+'.json',JSON.stringify(checkpoint,null,2)+'\n');
  const readback=JSON.parse(readFileSync('test-results/m7-2-attribute-allocation-'+profession+'.json','utf8'));
  expect(readback.screenshots).toHaveLength(3);
  expect(readback.screenshots.every((row:ScreenshotEvidence)=>row.byteCount>0&&row.sha256.length===64)).toBe(true);
}

test('M7.2 swordsman attribute allocation, cancel/confirm and SaveV2 reload',async({page})=>{
  await runProfession(page,'swordsman','swordsman',true);
});

test('M7.2 wizard attribute allocation, cancel/confirm and SaveV2 reload',async({page})=>{
  await runProfession(page,'wizard','wizard',false);
});
