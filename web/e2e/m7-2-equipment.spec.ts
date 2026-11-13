import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

type Shot={filename:string;sha256:string;byteCount:number;viewport:{width:number;height:number}|null};
const snap=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot() as Record<string,any>);
async function ready(page:Page){await page.goto('/?m4=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);await page.waitForFunction(()=>document.body.classList.contains('m4-active'));}
async function menu(page:Page){const m=page.locator('[data-ui="game-menu"]');if(!(await m.isVisible().catch(()=>false))){await page.locator('[data-action="menu"]:visible').click();await expect(m).toBeVisible();}}
async function openEquipment(page:Page){await menu(page);await page.locator('[data-action="inventory"]:visible').click();await expect(page.locator('[data-ui="equipment-panel"]')).toBeVisible();}
async function shot(page:Page,name:string,rows:Shot[]){mkdirSync('test-results',{recursive:true});const path='test-results/'+name;await page.screenshot({path,fullPage:false});const b=readFileSync(path);rows.push({filename:name,sha256:createHash('sha256').update(b).digest('hex'),byteCount:statSync(path).size,viewport:page.viewportSize()});}
async function equipFlow(page:Page,family:'swordsman'|'wizard',id:number,slot:'weapon',captureBase:boolean){
 await ready(page);await menu(page);await page.locator(family==='swordsman'?'[data-action="class-swordsman"]':'[data-action="class-wizard"]').click();
 await openEquipment(page);
 const shots:Shot[]=[];
 for(const each of ['weapon','armor','accessory'] as const){const current=(await snap(page)).equipment[each];if(current!==null)await page.locator('[data-action="equipment-unequip"][data-slot="'+each+'"]').click();}
 const empty=await snap(page);expect(empty.equipment[slot]).toBeNull();
 const beforeStat=family==='swordsman'?empty.combatStats.attack:empty.combatStats.magicAttack;
 if(captureBase)await shot(page,'equipment-empty.png',shots);else await shot(page,'equipment-wizard-empty.png',shots);
 await page.locator('[data-action="equipment-equip"][data-item-id="'+id+'"]').click();
 await expect.poll(async()=>(await snap(page)).equipment[slot]).toBe(id);
 const equipped=await snap(page);
 const afterStat=family==='swordsman'?equipped.combatStats.attack:equipped.combatStats.magicAttack;
 expect(afterStat).toBeGreaterThan(beforeStat);
 if(captureBase)await shot(page,'equipment-equipped.png',shots);else await shot(page,'equipment-wizard-equipped.png',shots);
 await page.locator('[data-action="equipment-close"]').click();
 const panelStat=await snap(page);
 expect(family==='swordsman'?panelStat.combatStats.attack:panelStat.combatStats.magicAttack).toBe(afterStat);
 if(captureBase)await shot(page,'equipment-stat-delta.png',shots);else await shot(page,'equipment-wizard-stat-delta.png',shots);
 await page.evaluate(async()=>{await window.lapisM4!.save();});
 await expect.poll(async()=>page.locator('#m4-runtime-notice').textContent()).toContain('存档已写入');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
 await page.evaluate(async()=>{await window.lapisM4!.load();});
 await expect.poll(async()=>(await snap(page)).equipment[slot]).toBe(id);
 const restored=await snap(page);
 expect(family==='swordsman'?restored.combatStats.attack:restored.combatStats.magicAttack).toBe(afterStat);
 await openEquipment(page);
 if(captureBase)await shot(page,'equipment-after-save-load.png',shots);else await shot(page,'equipment-wizard-after-save-load.png',shots);
 const checkpoint={schemaVersion:1,requestId:'ch1-attr-s44-20261113-01',family,itemId:id,slot,loadout:restored.equipment,combatStats:restored.combatStats,inventory:restored.inventory,screenshots:shots,screenshotHashAlgorithm:'SHA-256',directLoadoutMutationFixtureUsed:false};
 writeFileSync('test-results/m7-2-equipment-'+family+'.json',JSON.stringify(checkpoint,null,2)+'\n');
 const readback=JSON.parse(readFileSync('test-results/m7-2-equipment-'+family+'.json','utf8'));
 expect(readback.screenshots).toHaveLength(4);
 expect(readback.screenshots.every((x:Shot)=>x.sha256.length===64&&x.byteCount>0)).toBe(true);
}
test('S44 swordsman equips a catalog weapon and retains combat stats across SaveV2 reload',async({page})=>{test.setTimeout(240000);await equipFlow(page,'swordsman',1,'weapon',true);});
test('S44 wizard equips a catalog staff and retains combat stats across SaveV2 reload',async({page})=>{test.setTimeout(240000);await equipFlow(page,'wizard',10,'weapon',false);});
