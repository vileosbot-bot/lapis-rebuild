import catalogData from '../../../data/shops/ch1-shop-catalog.json' with {type:'json'};

export type Ch1ShopId='caosia-weapon'|'caosia-armor'|'caosia-potion';
export type ShopItemKind='weapon'|'armor'|'potion'|'consumable';
export type PotionResource='hp'|'mp';

export type PotionEffectDefinition={
  resource:PotionResource;
  effectRef:number;
  restoreAmount:number|null;
  amountStatus:'UNKNOWN'|'RECOVERED';
  resourceEvidence:string;
  evidenceLevel:'RECOVERED_SECONDARY'|'RECONSTRUCTION_POLICY';
};

export type ShopCatalogItem={
  itemResourceId:number;
  graphicId:number;
  name:string;
  description:string;
  price:number;
  shopNumber:number;
  equipPosition:number;
  requiredLevel:number;
  durability:number;
  slot:'weapon'|'armor'|null;
  itemKind:ShopItemKind;
  potionEffect?:PotionEffectDefinition;
  rawNumericColumns:number[];
  sourceRecord:{lineNumber:number;rawLineSha256:string;numericColumnCount:number;fieldCount:number;decodedTextEncoding:string};
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
};

export type Ch1ShopDefinition={
  id:Ch1ShopId;
  name:string;
  program:number;
  mapId:string;
  npcId:number;
  shopNumber:number;
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
  reachability:'UNKNOWN'|'CONFIRMED';
  runtimeEnabled:boolean;
  sourceMapping:Record<string,unknown>;
  routeEvidence:Record<string,unknown>|null;
  npcPlacement:Record<string,unknown>|null;
  catalogPolicy:{
    provenance:'RECONSTRUCTION_POLICY';
    filterOrder:readonly string[];
    npcFilter:Record<string,unknown>;
    catalogOrder:string;
    limit:120;
    filterTrace:{
      afterShopNumber:number;
      afterNonNegativePrice:number;
      afterNpcSpecificFilter:number;
      afterCatalogOrder:number;
      finalAfter120Cap:number;
    };
  };
  items:ShopCatalogItem[];
};

export type Ch1ShopCatalog={
  schemaVersion:1;
  dataset:'ch1-shop-catalog-s45';
  provenance:'RECONSTRUCTION_POLICY';
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
  source:Record<string,unknown>;
  policy:Record<string,unknown>;
  sourceCountDiscrepancy:Record<string,unknown>;
  sourcePolicyConflict:Record<string,unknown>;
  potionRecovery:Record<string,unknown>;
  chapter1RouteStatus:Record<string,unknown>;
  npcQuestCompatibility:readonly Record<string,unknown>[];
  shops:Ch1ShopDefinition[];
};

export type ShopSourceRow={
  itemResourceId:number;
  numericColumns:readonly number[];
  sourceRecord:{lineNumber:number};
};

export type ShopRowFilterPolicy={
  shopNumber:number;
  allowedEquipPositions?:readonly number[];
  requiredLevelAtMost?:number;
  allowedItemIds?:readonly number[];
  limit?:number;
};

export type ShopRowFilterResult={
  items:ShopSourceRow[];
  filterTrace:{
    afterShopNumber:number;
    afterNonNegativePrice:number;
    afterNpcSpecificFilter:number;
    afterCatalogOrder:number;
    finalAfter120Cap:number;
  };
};

export const SHOP_FILTER_ORDER=Object.freeze([
  'shop number',
  'non-negative price',
  'NPC-specific filter',
  'catalog order',
  '120-item cap',
] as const);

export const CH1_SHOP_CATALOG=catalogData as Ch1ShopCatalog;
export const CH1_SHOP_IDS=Object.freeze(CH1_SHOP_CATALOG.shops.map(shop=>shop.id));

export function filterShopRows(rows:readonly ShopSourceRow[],policy:ShopRowFilterPolicy):ShopRowFilterResult{
  const byShop=rows.filter(row=>row.numericColumns[2]===policy.shopNumber);
  const priced=byShop.filter(row=>Number.isFinite(row.numericColumns[17])&&row.numericColumns[17]>=0);
  const allowedIds=policy.allowedItemIds?new Set(policy.allowedItemIds):null;
  const allowedPositions=policy.allowedEquipPositions?new Set(policy.allowedEquipPositions):null;
  const npcFiltered=priced.filter(row=>{
    if(allowedIds)return allowedIds.has(row.itemResourceId);
    if(allowedPositions&&!allowedPositions.has(row.numericColumns[3]))return false;
    if(policy.requiredLevelAtMost!==undefined&&row.numericColumns[5]>policy.requiredLevelAtMost)return false;
    return true;
  });
  const ordered=[...npcFiltered].sort((a,b)=>a.sourceRecord.lineNumber-b.sourceRecord.lineNumber);
  const limit=Math.min(120,Math.max(0,Math.floor(policy.limit??120)));
  const items=ordered.slice(0,limit);
  return{
    items,
    filterTrace:{
      afterShopNumber:byShop.length,
      afterNonNegativePrice:priced.length,
      afterNpcSpecificFilter:npcFiltered.length,
      afterCatalogOrder:ordered.length,
      finalAfter120Cap:items.length,
    },
  };
}

export function getCh1ShopById(shopId:string):Ch1ShopDefinition|null{
  return CH1_SHOP_CATALOG.shops.find(shop=>shop.id===shopId)??null;
}

export function getCh1ShopItem(shopId:string,itemId:number):ShopCatalogItem|null{
  const shop=getCh1ShopById(shopId);
  return shop?.items.find(item=>item.itemResourceId===itemId)??null;
}

export function getCh1PotionItem(itemId:number):ShopCatalogItem|null{
  for(const shop of CH1_SHOP_CATALOG.shops){
    const item=shop.items.find(row=>row.itemResourceId===itemId&&row.potionEffect!==undefined);
    if(item)return item;
  }
  return null;
}

export function validateCh1ShopCatalog(catalog:Ch1ShopCatalog=CH1_SHOP_CATALOG):void{
  if(catalog.schemaVersion!==1||catalog.dataset!=='ch1-shop-catalog-s45')throw new Error('Unsupported S45 shop catalog schema');
  if(catalog.shops.length!==3)throw new Error('S45 catalog must contain exactly three shop candidates');
  const shopIds=new Set<string>();
  for(const shop of catalog.shops){
    if(shopIds.has(shop.id))throw new Error('Duplicate shop id: '+shop.id);
    shopIds.add(shop.id);
    if(shop.items.length>120)throw new Error('Shop exceeds 120-item catalog cap: '+shop.id);
    if(shop.reachability!=='UNKNOWN'||shop.runtimeEnabled)throw new Error('Unverified shop route must remain disabled: '+shop.id);
    if(SHOP_FILTER_ORDER.some((entry,index)=>shop.catalogPolicy.filterOrder[index]!==entry))throw new Error('Shop filter order mismatch: '+shop.id);
    const itemIds=new Set<number>();
    for(const item of shop.items){
      if(itemIds.has(item.itemResourceId))throw new Error('Duplicate item id in shop '+shop.id+': '+item.itemResourceId);
      itemIds.add(item.itemResourceId);
      if(item.shopNumber!==shop.shopNumber)throw new Error('Shop number mismatch for item '+item.itemResourceId);
      if(!Number.isInteger(item.price)||item.price<0)throw new Error('Invalid shop price for item '+item.itemResourceId);
      if(item.rawNumericColumns[17]!==item.price)throw new Error('Price does not match itemtbl column 18 for item '+item.itemResourceId);
      if(item.rawNumericColumns[2]!==shop.shopNumber)throw new Error('Raw itemtbl shop number mismatch for item '+item.itemResourceId);
      if(item.potionEffect&&item.potionEffect.restoreAmount!==null&&item.potionEffect.amountStatus!=='RECOVERED'){
        throw new Error('Potion amount must be evidence-backed for item '+item.itemResourceId);
      }
    }
  }
  const potionShop=getCh1ShopById('caosia-potion');
  if(!potionShop||potionShop.items.filter(item=>item.potionEffect).length!==9)throw new Error('Program 15 must contain the nine source-backed red/blue potion candidates');
  if(catalog.potionRecovery.restoreAmount!==null||catalog.potionRecovery.amountStatus!=='UNKNOWN'){
    throw new Error('Unrecovered potion amounts must remain UNKNOWN');
  }
}

validateCh1ShopCatalog();
