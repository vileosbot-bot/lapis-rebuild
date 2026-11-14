import {
  CH1_SHOP_CATALOG,
  getCh1PotionItem,
  getCh1ShopById,
  getCh1ShopItem,
  type Ch1ShopId,
  type PotionResource,
  type ShopCatalogItem,
} from './shop-catalog.ts';
import {
  consumeItem,
  grantItem,
  quantityOf,
  validateInventory,
  type InventoryState,
} from '../progression/inventory.ts';

export const SHOP_INVENTORY_ROW_LIMIT=28;
export const SHOP_TRANSACTION_LIMIT=128;
export const SHOP_STOCK_PROVENANCE='RECONSTRUCTION_POLICY' as const;

export type ShopTransaction={
  id:string;
  shopId:Ch1ShopId;
  itemId:number;
  quantity:1;
  cost:number;
};

export type ShopRuntimeState={
  schemaVersion:1;
  provenance:'RECONSTRUCTION_POLICY';
  availableItemIdsByShop:Record<Ch1ShopId,number[]>;
  transactions:ShopTransaction[];
};

export type ShopPurchaseFailure=
  |'unknown-shop'
  |'unknown-item'
  |'invalid-quantity'
  |'invalid-transaction-id'
  |'transaction-id-conflict'
  |'stock-exhausted'
  |'insufficient-gold'
  |'inventory-full'
  |'invalid-gold'
  |'receipt-capacity';

export type ShopPurchaseResult=
  |{ok:true;applied:boolean;gold:number;inventory:InventoryState;shopState:ShopRuntimeState;cost:number;transaction:ShopTransaction}
  |{ok:false;reason:ShopPurchaseFailure;gold:number;inventory:InventoryState;shopState:ShopRuntimeState};

export type PotionVitals={hp:number;maxHp:number;mp:number;maxMp:number};
export type PotionEffectInput={resource:PotionResource;effectRef:number;restoreAmount:number|null};
export type PotionUseFailure=
  |'in-battle'
  |'not-a-potion'
  |'empty-inventory'
  |'effect-unknown'
  |'invalid-vitals'
  |'already-full';

export type PotionUseResult=
  |{ok:true;inventory:InventoryState;vitals:PotionVitals;resource:PotionResource;restored:number}
  |{ok:false;reason:PotionUseFailure;inventory:InventoryState;vitals:PotionVitals};

const shopIds=CH1_SHOP_CATALOG.shops.map(shop=>shop.id) as Ch1ShopId[];

function isRecord(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==='object'&&!Array.isArray(value);
}

function emptyStock():Record<Ch1ShopId,number[]>{
  const result={} as Record<Ch1ShopId,number[]>;
  for(const shop of CH1_SHOP_CATALOG.shops)result[shop.id]=shop.items.map(item=>item.itemResourceId);
  return result;
}

export function createShopRuntimeState():ShopRuntimeState{
  return{
    schemaVersion:1,
    provenance:'RECONSTRUCTION_POLICY',
    availableItemIdsByShop:emptyStock(),
    transactions:[],
  };
}

export function validateShopRuntimeState(raw:unknown):ShopRuntimeState{
  if(!isRecord(raw)||raw.schemaVersion!==1||raw.provenance!=='RECONSTRUCTION_POLICY')throw new Error('Invalid S45 shop runtime state');
  if(!isRecord(raw.availableItemIdsByShop)||!Array.isArray(raw.transactions)||raw.transactions.length>SHOP_TRANSACTION_LIMIT)throw new Error('Invalid S45 shop stock or transaction state');
  const stock={} as Record<Ch1ShopId,number[]>;
  for(const shopId of shopIds){
    const available=raw.availableItemIdsByShop[shopId];
    const shop=getCh1ShopById(shopId);
    if(!shop||!Array.isArray(available))throw new Error('Missing S45 shop stock: '+shopId);
    const known=new Set(shop.items.map(item=>item.itemResourceId));
    const ids=available.map(value=>{
      if(!Number.isInteger(value)||!known.has(value))throw new Error('Unknown S45 stock item in '+shopId);
      return value as number;
    });
    if(new Set(ids).size!==ids.length)throw new Error('Duplicate S45 stock item in '+shopId);
    stock[shopId]=ids;
  }
  const seen=new Set<string>();
  const transactions=raw.transactions.map(value=>{
    if(!isRecord(value)||typeof value.id!=='string'||!/^[A-Za-z0-9._:/-]{1,128}$/.test(value.id))throw new Error('Invalid S45 transaction id');
    if(seen.has(value.id))throw new Error('Duplicate S45 transaction id');
    seen.add(value.id);
    if(typeof value.shopId!=='string'||!shopIds.includes(value.shopId as Ch1ShopId))throw new Error('Invalid S45 transaction shop');
    if(!Number.isInteger(value.itemId)||!Number.isInteger(value.quantity)||value.quantity!==1||typeof value.cost!=='number'||!Number.isInteger(value.cost)||value.cost<0)throw new Error('Invalid S45 transaction fields');
    if(!getCh1ShopItem(value.shopId as Ch1ShopId,value.itemId as number))throw new Error('Unknown S45 transaction item');
    return{id:value.id,shopId:value.shopId as Ch1ShopId,itemId:value.itemId as number,quantity:1 as const,cost:value.cost as number};
  });
  return{schemaVersion:1,provenance:'RECONSTRUCTION_POLICY',availableItemIdsByShop:stock,transactions};
}

export function shopItemIsAvailable(state:ShopRuntimeState,shopId:Ch1ShopId,itemId:number):boolean{
  return state.availableItemIdsByShop[shopId]?.includes(itemId)??false;
}

export function purchaseShopItem(input:{
  shopId:string;
  itemId:number;
  quantity:number;
  transactionId:string;
  gold:number;
  inventory:InventoryState;
  shopState:ShopRuntimeState;
}):ShopPurchaseResult{
  const inventory=validateInventory(input.inventory);
  const shopState=validateShopRuntimeState(input.shopState);
  const gold=input.gold;
  const fail=(reason:ShopPurchaseFailure):ShopPurchaseResult=>({ok:false,reason,gold,inventory,shopState});
  if(!Number.isInteger(gold)||gold<0)return fail('invalid-gold');
  if(!shopIds.includes(input.shopId as Ch1ShopId))return fail('unknown-shop');
  const shopId=input.shopId as Ch1ShopId;
  const shop=getCh1ShopById(shopId);
  if(!shop)return fail('unknown-shop');
  const item=getCh1ShopItem(shopId,input.itemId);
  if(!item)return fail('unknown-item');
  if(!Number.isInteger(input.quantity)||input.quantity!==1)return fail('invalid-quantity');
  if(typeof input.transactionId!=='string'||!/^[A-Za-z0-9._:/-]{1,128}$/.test(input.transactionId))return fail('invalid-transaction-id');
  const existing=shopState.transactions.find(transaction=>transaction.id===input.transactionId);
  if(existing){
    if(existing.shopId!==shopId||existing.itemId!==input.itemId||existing.quantity!==1)return fail('transaction-id-conflict');
    return{ok:true,applied:false,gold,inventory,shopState,cost:existing.cost,transaction:existing};
  }
  if(!shopItemIsAvailable(shopState,shopId,input.itemId))return fail('stock-exhausted');
  if(shopState.transactions.length>=SHOP_TRANSACTION_LIMIT)return fail('receipt-capacity');
  const cost=item.price;
  if(!Number.isSafeInteger(cost)||cost<0)return fail('unknown-item');
  if(gold<cost)return fail('insufficient-gold');
  const alreadyOwned=quantityOf(inventory,input.itemId)>0;
  if(!alreadyOwned&&inventory.items.length>=SHOP_INVENTORY_ROW_LIMIT)return fail('inventory-full');
  let nextInventory:InventoryState;
  try{
    nextInventory=grantItem(inventory,input.itemId,1,{kind:'system',ref:'shop:'+shopId+':'+input.transactionId});
  }catch{
    return fail('unknown-item');
  }
  const transaction:ShopTransaction={id:input.transactionId,shopId,itemId:input.itemId,quantity:1,cost};
  const nextStock={...shopState.availableItemIdsByShop,[shopId]:shopState.availableItemIdsByShop[shopId].filter(id=>id!==input.itemId)};
  const nextState=validateShopRuntimeState({...shopState,availableItemIdsByShop:nextStock,transactions:[...shopState.transactions,transaction]});
  return{ok:true,applied:true,gold:gold-cost,inventory:nextInventory,shopState:nextState,cost,transaction};
}

export function applyPotionEffect(input:{
  inventory:InventoryState;
  itemId:number;
  effect:PotionEffectInput;
  vitals:PotionVitals;
  inBattle:boolean;
}):PotionUseResult{
  const inventory=validateInventory(input.inventory);
  const vitals={...input.vitals};
  const fail=(reason:PotionUseFailure):PotionUseResult=>({ok:false,reason,inventory,vitals});
  if(input.inBattle)return fail('in-battle');
  if(!Number.isInteger(vitals.hp)||!Number.isInteger(vitals.maxHp)||!Number.isInteger(vitals.mp)||!Number.isInteger(vitals.maxMp)||vitals.maxHp<1||vitals.maxMp<0||vitals.hp<0||vitals.mp<0||vitals.hp>vitals.maxHp||vitals.mp>vitals.maxMp)return fail('invalid-vitals');
  if(quantityOf(inventory,input.itemId)<1)return fail('empty-inventory');
  if(input.effect.restoreAmount===null||!Number.isInteger(input.effect.restoreAmount)||input.effect.restoreAmount<=0)return fail('effect-unknown');
  const current=input.effect.resource==='hp'?vitals.hp:vitals.mp;
  const maximum=input.effect.resource==='hp'?vitals.maxHp:vitals.maxMp;
  if(current>=maximum)return fail('already-full');
  const nextValue=Math.min(maximum,current+input.effect.restoreAmount);
  const restored=nextValue-current;
  if(restored<=0)return fail('already-full');
  const nextVitals=input.effect.resource==='hp'?{...vitals,hp:nextValue}:{...vitals,mp:nextValue};
  return{ok:true,inventory:consumeItem(inventory,input.itemId,1),vitals:nextVitals,resource:input.effect.resource,restored};
}

export function useShopPotion(input:{
  inventory:InventoryState;
  itemId:number;
  vitals:PotionVitals;
  inBattle:boolean;
}):PotionUseResult{
  const item:ShopCatalogItem|null=getCh1PotionItem(input.itemId);
  if(!item?.potionEffect){
    const inventory=validateInventory(input.inventory);
    return{ok:false,reason:'not-a-potion',inventory,vitals:{...input.vitals}};
  }
  return applyPotionEffect({
    inventory:input.inventory,
    itemId:input.itemId,
    effect:{resource:item.potionEffect.resource,effectRef:item.potionEffect.effectRef,restoreAmount:item.potionEffect.restoreAmount},
    vitals:input.vitals,
    inBattle:input.inBattle,
  });
}
