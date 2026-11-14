import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CH1_SHOP_CATALOG,filterShopRows,validateCh1ShopCatalog} from '../src/shops/shop-catalog.ts';
import {Ch1ShopAuthority} from '../src/world/ch1-shop-authority.ts';

test('S45 three shop catalogs preserve source counts, caps, provenance and route gate',()=>{
 validateCh1ShopCatalog();
 assert.deepEqual(CH1_SHOP_CATALOG.shops.map(x=>x.items.length),[120,120,9]);
 assert.equal(CH1_SHOP_CATALOG.shops.reduce((n,x)=>n+x.items.length,0),249);
 assert.ok(CH1_SHOP_CATALOG.shops.every(x=>x.runtimeEnabled===false&&x.reachability==='UNKNOWN'));
 assert.equal(CH1_SHOP_CATALOG.sourceCountDiscrepancy.status,'MISMATCH');
 assert.equal(CH1_SHOP_CATALOG.shops[2].items.length,9);
});
test('S45 filtering follows shop, nonnegative price, NPC filter, source order, 120 cap',()=>{
 const rows=[
  {itemResourceId:3,numericColumns:[3,0,1,3,0,1,0,0,0,0,0,0,0,0,0,0,0,10],sourceRecord:{lineNumber:5}},
  {itemResourceId:2,numericColumns:[2,0,1,3,0,1,0,0,0,0,0,0,0,0,0,0,0,-1],sourceRecord:{lineNumber:4}},
  {itemResourceId:1,numericColumns:[1,0,2,3,0,1,0,0,0,0,0,0,0,0,0,0,0,10],sourceRecord:{lineNumber:3}},
 ];
 const result=filterShopRows(rows,{shopNumber:1,allowedEquipPositions:[3]});
 assert.deepEqual(result.items.map(x=>x.itemResourceId),[3]);
 assert.deepEqual(result.filterTrace,{afterShopNumber:2,afterNonNegativePrice:1,afterNpcSpecificFilter:1,afterCatalogOrder:1,finalAfter120Cap:1});
});
test('S45 shop authority reports all candidate interiors as UNKNOWN and closed',()=>{
 const authority=new Ch1ShopAuthority();
 const snapshot=authority.snapshot();
 assert.equal(snapshot.routeStatus,'UNKNOWN');
 assert.equal(snapshot.runtimeEnabled,false);
 assert.deepEqual(snapshot.candidates.map(x=>x.npcId),[21200,21210,21230]);
 assert.ok(snapshot.unknownReasons.some(x=>x.includes('approach cells')));
});
