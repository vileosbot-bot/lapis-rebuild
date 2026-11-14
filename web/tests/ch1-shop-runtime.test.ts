import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,quantityOf} from '../src/progression/inventory.ts';
import {SHOP_INVENTORY_ROW_LIMIT} from '../src/shops/shop-runtime.ts';
import {createShopRuntimeState,purchaseShopItem,useShopPotion,validateShopRuntimeState} from '../src/shops/shop-runtime.ts';
import {CH1_SHOP_CATALOG} from '../src/shops/shop-catalog.ts';

const potion=CH1_SHOP_CATALOG.shops.find(x=>x.id==='caosia-potion')!;
const red=potion.items.find(x=>x.potionEffect?.resource==='hp')!;
const blue=potion.items.find(x=>x.potionEffect?.resource==='mp')!;
const empty=createInventory();
const bought=(itemId:number)=>purchaseShopItem({shopId:'caosia-potion',itemId,quantity:1,transactionId:'s45-test-'+itemId,gold:10000,inventory:empty,shopState:createShopRuntimeState()});

test('S45 potion purchase deducts price, grants one item and consumes finite listing',()=>{
 const result=bought(red.itemResourceId);
 assert.equal(result.ok,true);
 if(!result.ok)return;
 assert.equal(result.gold,10000-red.price);
 assert.equal(quantityOf(result.inventory,red.itemResourceId),1);
 assert.equal(result.shopState.availableItemIdsByShop['caosia-potion'].includes(red.itemResourceId),false);
});
test('S45 purchase rejects insufficient funds and duplicate transaction replays idempotently',()=>{
 const poor=purchaseShopItem({shopId:'caosia-potion',itemId:red.itemResourceId,quantity:1,transactionId:'poor',gold:0,inventory:empty,shopState:createShopRuntimeState()});
 assert.equal(poor.ok,false);if(!poor.ok)assert.equal(poor.reason,'insufficient-gold');
 const first=bought(blue.itemResourceId);assert.equal(first.ok,true);if(!first.ok)return;
 const duplicate=purchaseShopItem({shopId:'caosia-potion',itemId:blue.itemResourceId,quantity:1,transactionId:'s45-test-'+blue.itemResourceId,gold:first.gold,inventory:first.inventory,shopState:first.shopState});
 assert.equal(duplicate.ok,true);if(duplicate.ok){assert.equal(duplicate.applied,false);assert.equal(duplicate.gold,first.gold);assert.equal(quantityOf(duplicate.inventory,blue.itemResourceId),1);}
});
test('S45 UNKNOWN potion amount refuses use without consuming item or changing vitals',()=>{
 const purchase=bought(red.itemResourceId);assert.equal(purchase.ok,true);if(!purchase.ok)return;
 const vitals={hp:10,maxHp:100,mp:5,maxMp:50};
 const result=useShopPotion({inventory:purchase.inventory,itemId:red.itemResourceId,vitals,inBattle:false});
 assert.equal(result.ok,false);if(!result.ok)assert.equal(result.reason,'effect-unknown');
 assert.equal(quantityOf(result.inventory,red.itemResourceId),1);
 assert.deepEqual(result.vitals,vitals);
});
test('S45 potion use rejects battle use and empty inventory',()=>{
 const vitals={hp:10,maxHp:100,mp:5,maxMp:50};
 const emptyResult=useShopPotion({inventory:empty,itemId:red.itemResourceId,vitals,inBattle:false});
 assert.equal(emptyResult.ok,false);if(!emptyResult.ok)assert.equal(emptyResult.reason,'empty-inventory');
 const boughtResult=bought(red.itemResourceId);assert.equal(boughtResult.ok,true);if(!boughtResult.ok)return;
 const battle=useShopPotion({inventory:boughtResult.inventory,itemId:red.itemResourceId,vitals,inBattle:true});
 assert.equal(battle.ok,false);if(!battle.ok)assert.equal(battle.reason,'in-battle');
 assert.equal(quantityOf(battle.inventory,red.itemResourceId),1);
});
test('S45 runtime stock snapshot validates after SaveV2 JSON round-trip',()=>{
 const state=createShopRuntimeState();const restored=validateShopRuntimeState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored,state);
});

test('S45 quantity is bounded to one listing token and exhausted stock cannot be repurchased',()=>{
 const invalid=purchaseShopItem({shopId:'caosia-potion',itemId:red.itemResourceId,quantity:2,transactionId:'quantity-two',gold:10000,inventory:empty,shopState:createShopRuntimeState()});
 assert.equal(invalid.ok,false);if(!invalid.ok)assert.equal(invalid.reason,'invalid-quantity');
 const first=bought(red.itemResourceId);assert.equal(first.ok,true);if(!first.ok)return;
 const repeat=purchaseShopItem({shopId:'caosia-potion',itemId:red.itemResourceId,quantity:1,transactionId:'different-receipt',gold:first.gold,inventory:first.inventory,shopState:first.shopState});
 assert.equal(repeat.ok,false);if(!repeat.ok)assert.equal(repeat.reason,'stock-exhausted');
});
test('S45 purchase refuses a 29th distinct inventory row but permits an existing stack',()=>{
 const rows=CH1_SHOP_CATALOG.shops.flatMap(shop=>shop.items).slice(0,SHOP_INVENTORY_ROW_LIMIT);
 const full=createInventory(rows.map((item,index)=>({itemId:item.itemResourceId,quantity:1,source:{kind:'starter' as const,ref:'s45-capacity-'+index}})));
 assert.equal(full.items.length,SHOP_INVENTORY_ROW_LIMIT);
 const denied=purchaseShopItem({shopId:'caosia-potion',itemId:red.itemResourceId,quantity:1,transactionId:'full-bag-new-row',gold:10000,inventory:full,shopState:createShopRuntimeState()});
 assert.equal(denied.ok,false);if(!denied.ok)assert.equal(denied.reason,'inventory-full');
 const stackShop=rows[0].shopNumber===1?'caosia-weapon':rows[0].shopNumber===2?'caosia-armor':'caosia-potion';
 const stacked=purchaseShopItem({shopId:stackShop,itemId:rows[0].itemResourceId,quantity:1,transactionId:'full-bag-stack',gold:10000,inventory:full,shopState:createShopRuntimeState()});
 assert.equal(stacked.ok,true);if(stacked.ok)assert.equal(stacked.inventory.items.length,SHOP_INVENTORY_ROW_LIMIT);
});
