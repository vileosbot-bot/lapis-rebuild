import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';

type Shot={filename:string;sha256:string;byteCount:number};
const snap=(page:Page)=>page.evaluate(()=>window.lapisM4!.snapshot() as Record<string,any>);
async function ready(page:Page){
 await page.goto('/?m4=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
 await page.waitForFunction(()=>document.body.classList.contains('m4-active'));
}
async function capture(page:Page,name:string,shots:Shot[]){
 mkdirSync('test-results',{recursive:true});const path='test-results/'+name;
 await page.screenshot({path,fullPage:true});const bytes=readFileSync(path);
 shots.push({filename:name,sha256:createHash('sha256').update(bytes).digest('hex'),byteCount:statSync(path).size});
}
test('S45 isolated shop acceptance: catalog, potion purchase, UNKNOWN use protection and SaveV2',async({page})=>{
 test.setTimeout(240000);await ready(page);
 await page.evaluate(()=>{const bridge=window.lapisM4 as any;if(typeof bridge.acceptanceSetGold!=='function')throw new Error('Missing S45 acceptance gold fixture');bridge.acceptanceSetGold(10000);});
 await page.evaluate(()=>{const bridge=window.lapisM4 as any;if(typeof bridge.acceptanceOpenShop!=='function')throw new Error('Missing S45 acceptance bridge');bridge.acceptanceOpenShop('caosia-potion');});
 await expect(page.locator('section.shop-panel[data-shop-id="caosia-potion"]')).toBeVisible();
 const shots:Shot[]=[];await capture(page,'shop-potion-use.png',shots);
 const before=await snap(page);expect(before.gold).toBe(10000);const itemId=4001;
 await page.evaluate((id)=>{(window.lapisM4 as any).acceptanceBuyShopItem('caosia-potion',id,'s45-e2e-red-potion');},itemId);
 const afterBuy=await snap(page);
 expect(afterBuy.gold).toBeLessThan(before.gold);
 expect(afterBuy.inventory.items.some((x:any)=>x.itemId===itemId&&x.quantity===1)).toBe(true);
 await page.locator('[data-action="shop-close"]').click();
 await page.locator('[data-action="menu"]:visible').click();
 await page.locator('[data-action="inventory"]:visible').click();
 const beforeUse=await snap(page);
 await page.evaluate((id)=>{(window.lapisM4 as any).acceptanceUsePotion(id);},itemId);
 const afterUse=await snap(page);
 expect(afterUse.inventory.items.find((x:any)=>x.itemId===itemId)?.quantity).toBe(1);
 expect(afterUse.vitals).toEqual(beforeUse.vitals);
 expect(afterUse.world).toEqual(beforeUse.world);
 expect(await page.locator('#m4-runtime-notice').textContent()).toContain('UNKNOWN');
 await capture(page,'shop-inventory-after-purchase.png',shots);
 await page.evaluate(async()=>{await (window.lapisM4 as any).save();});
 await expect.poll(async()=>page.locator('#m4-runtime-notice').textContent()).toContain('存档已写入');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.lapisDiagnostics?.snapshot().ready&&!!window.lapisM4);
 await page.evaluate(async()=>{await (window.lapisM4 as any).load();});
 await expect.poll(async()=>(await snap(page)).gold).toBe(afterBuy.gold);
 const restored=await snap(page);
 expect(restored.inventory.items.find((x:any)=>x.itemId===itemId)?.quantity).toBe(1);
 expect(restored.vitals).toEqual(afterUse.vitals);
 expect(restored.shopState.availableItemIdsByShop['caosia-potion']).not.toContain(itemId);
 const checkpoint={requestId:'ch1-attr-s45-20261113-01',routeEvidence:'NOT_VERIFIED',shopId:'caosia-potion',npcId:21230,mapId:'map:old:2300',itemId,quantityAfterPurchase:1,quantityAfterUnknownUse:1,goldBefore:before.gold,goldAfter:afterBuy.gold,vitalsBeforeUse:beforeUse.vitals,vitalsAfterUse:afterUse.vitals,vitalsAfterLoad:restored.vitals,shopStateAfterLoad:restored.shopState,potionEffectAmount:'UNKNOWN',shots};
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/ch1-shop-flow-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n');
});
test('S45 route reachability remains explicitly unverified',async({page})=>{
 test.setTimeout(240000);await ready(page);
 const state=await snap(page);
 expect(state.shop.routeStatus).toBe('UNKNOWN');
 expect(state.shop.runtimeEnabled).toBe(false);
 expect(state.shop.candidates).toHaveLength(3);
});

test('S45 isolated weapon catalog and purchase are separate from route evidence',async({page})=>{
 test.setTimeout(240000);await ready(page);
 await page.evaluate(()=>{const bridge=window.lapisM4 as any;if(typeof bridge.acceptanceSetGold!=='function')throw new Error('Missing S45 acceptance gold fixture');bridge.acceptanceSetGold(10000);});
 await page.evaluate(()=>{(window.lapisM4 as any).acceptanceOpenShop('caosia-weapon');});
 await expect(page.locator('section.shop-panel[data-shop-id="caosia-weapon"]')).toBeVisible();
 const shots:Shot[]=[];
 await capture(page,'shop-weapon-catalog.png',shots);
 const before=await snap(page);const itemId=1;
 await page.evaluate((id)=>{(window.lapisM4 as any).acceptanceBuyShopItem('caosia-weapon',id,'s45-e2e-weapon-'+id);},itemId);
 const purchased=await snap(page);
 expect(purchased.gold).toBeLessThan(before.gold);
 expect(purchased.inventory.items.some((x:any)=>x.itemId===itemId&&x.quantity>=1)).toBe(true);
 await expect(page.locator('#m4-runtime-notice')).toContainText('购买成功');
 await capture(page,'shop-purchase-confirmed.png',shots);
 await page.locator('[data-action="shop-close"]').click();
 await page.locator('[data-action="menu"]:visible').click();
 await page.locator('[data-action="inventory"]:visible').click();
 const equip=page.locator('[data-action="equipment-equip"][data-item-id="1"]');
 await expect(equip).toHaveCount(1);
 await equip.click();
 await expect.poll(async()=>(await snap(page)).equipment.weapon).toBe(1);
 const checkpoint={requestId:'ch1-attr-s45-20261113-01',routeEvidence:'NOT_VERIFIED',shopId:'caosia-weapon',npcId:21200,mapId:'map:old:2000',itemId,quantityAfterPurchase:purchased.inventory.items.find((x:any)=>x.itemId===itemId)?.quantity??0,goldBefore:before.gold,goldAfter:purchased.gold,equipmentAfter:(await snap(page)).equipment,screenshots:shots};
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/ch1-shop-weapon-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n');
});
