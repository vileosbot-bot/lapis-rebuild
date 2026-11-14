import {
  CH1_SHOP_CATALOG,
  type Ch1ShopDefinition,
  type ShopCatalogItem,
} from '../shops/shop-catalog.ts';
import {
  shopItemIsAvailable,
  type ShopRuntimeState,
} from '../shops/shop-runtime.ts';
import {quantityOf,type InventoryState} from '../progression/inventory.ts';

function escapeHtml(value:string):string{
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
}

function potionEffectLabel(item:ShopCatalogItem):string{
  if(!item.potionEffect)return '';
  const resource=item.potionEffect.resource==='hp'?'HP':'MP';
  return resource+' 恢复量：'+(item.potionEffect.restoreAmount===null?'UNKNOWN':String(item.potionEffect.restoreAmount));
}

export function renderShopPanel(input:{
  shop:Ch1ShopDefinition;
  inventory:InventoryState;
  gold:number;
  shopState:ShopRuntimeState;
}):string{
  const rows=input.shop.items.map(item=>{
    const available=shopItemIsAvailable(input.shopState,input.shop.id,item.itemResourceId);
    const owned=quantityOf(input.inventory,item.itemResourceId);
    const transactionId='shop:'+input.shop.id+':'+item.itemResourceId+':1:'+input.gold+':'+owned;
    const effect=item.potionEffect?potionEffectLabel(item):'';
    return '<article class="shop-panel__item" data-item-id="'+item.itemResourceId+'">'+
      '<div class="shop-panel__item-main"><strong>'+escapeHtml(item.name)+'</strong>'+
      '<small>'+escapeHtml(item.description)+'</small>'+
      (effect?'<small class="shop-panel__effect">'+escapeHtml(effect)+'</small>':'')+
      '</div><div class="shop-panel__item-buy"><span>'+item.price.toLocaleString('zh-CN')+' G</span>'+
      '<label>数量 <input type="number" min="1" max="1" value="1" data-shop-quantity="'+item.itemResourceId+'" aria-label="'+escapeHtml(item.name)+'购买数量"></label>'+
      '<button type="button" data-action="shop-buy" data-shop-id="'+input.shop.id+'" data-item-id="'+item.itemResourceId+'" data-transaction-id="'+escapeHtml(transactionId)+'" '+(available?'':'disabled')+'>'+
      (available?'购买':'已售罄')+'</button></div></article>';
  }).join('');
  return '<section class="shop-panel" data-shop-id="'+input.shop.id+'">'+
    '<header class="shop-panel__header"><div><h2>'+escapeHtml(input.shop.name)+'</h2><p>金币：'+input.gold.toLocaleString('zh-CN')+' G · 商品：'+input.shop.items.length+'</p></div>'+
    '<button type="button" data-action="shop-close">关闭</button></header>'+
    '<p class="shop-panel__policy">有限库存 · 单条目录库存消耗后不补货 · RECONSTRUCTION_POLICY</p>'+
    '<div class="shop-panel__items">'+rows+'</div></section>';
}

export function renderPotionInventory(inventory:InventoryState):string{
  const rows=CH1_SHOP_CATALOG.shops.flatMap(shop=>shop.items)
    .filter(item=>item.potionEffect!==undefined&&quantityOf(inventory,item.itemResourceId)>0)
    .map(item=>{
      const count=quantityOf(inventory,item.itemResourceId);
      const effect=potionEffectLabel(item);
      const known=item.potionEffect!.restoreAmount!==null;
      return '<article class="shop-panel__potion" data-item-id="'+item.itemResourceId+'">'+
        '<div><strong>'+escapeHtml(item.name)+'</strong><small>持有：'+count+' · '+escapeHtml(effect)+'</small></div>'+
        '<button type="button" data-action="inventory-use" data-item-id="'+item.itemResourceId+'" '+(known?'':'disabled')+'>'+
        (known?'非战斗使用':'恢复量 UNKNOWN')+'</button></article>';
    }).join('');
  if(!rows)return '<section class="equipment-panel__potions"><h3>药品</h3><p>背包中没有红药或蓝药。</p></section>';
  return '<section class="equipment-panel__potions"><h3>药品</h3><p>仅可在非战斗状态使用。</p>'+rows+'</section>';
}
