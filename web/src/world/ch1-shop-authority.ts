import {CH1_SHOP_CATALOG} from '../shops/shop-catalog.ts';
import type {Ch1ShopId} from '../shops/shop-catalog.ts';
import type {NpcDialogueShopServiceIntent} from './npc-dialogue-runtime.ts';

export type Ch1ShopRouteStatus='UNKNOWN'|'CONFIRMED';

export type Ch1ShopCandidate={
  shopId:Ch1ShopId;
  name:string;
  program:number;
  mapId:string;
  mapWire:number;
  npcId:number;
  routeId:string|null;
  routeStatus:Ch1ShopRouteStatus;
  runtimeEnabled:false;
  questSemantic:string|null;
  evidenceLevel:'RECOVERED_SECONDARY';
  routeEvidence:Record<string,unknown>|null;
};

const candidates:readonly Ch1ShopCandidate[]=Object.freeze(CH1_SHOP_CATALOG.shops.map(shop=>{
  const route=shop.routeEvidence;
  const placement=shop.npcPlacement;
  const mapWire=Number(shop.mapId.split(':').at(-1));
  return Object.freeze({
    shopId:shop.id,
    name:shop.name,
    program:shop.program,
    mapId:shop.mapId,
    mapWire,
    npcId:shop.npcId,
    routeId:typeof route?.routeId==='string'?route.routeId:null,
    routeStatus:'UNKNOWN' as const,
    runtimeEnabled:false as const,
    questSemantic:typeof placement?.questSemantic==='string'?placement.questSemantic:null,
    evidenceLevel:'RECOVERED_SECONDARY' as const,
    routeEvidence:route,
  });
}));

export class Ch1ShopAuthority{
  readonly id='ch1-shop-authority-s45';
  readonly provenance='RECONSTRUCTION_POLICY' as const;

  candidates():readonly Ch1ShopCandidate[]{return candidates;}

  candidateForNpc(npcId:number|string):Ch1ShopCandidate|null{
    const id=String(npcId);
    return candidates.find(candidate=>String(candidate.npcId)===id)??null;
  }

  canOpenShop(npcId:number|string,mapId:number):{allowed:boolean;reason:'route-unknown'|'npc-map-mismatch'|'not-a-shop-npc'|'allowed';candidate:Ch1ShopCandidate|null}{
    const candidate=this.candidateForNpc(npcId);
    if(!candidate)return{allowed:false,reason:'not-a-shop-npc',candidate:null};
    if(candidate.mapWire!==mapId)return{allowed:false,reason:'npc-map-mismatch',candidate};
    if(candidate.routeStatus!=='CONFIRMED'||!candidate.runtimeEnabled)return{allowed:false,reason:'route-unknown',candidate};
    return{allowed:true,reason:'allowed',candidate};
  }

  serviceIntentForNpc(npcId:number|string,mapId:number):NpcDialogueShopServiceIntent|null{
    const access=this.canOpenShop(npcId,mapId);
    if(!access.allowed||!access.candidate)return null;
    return{shopId:access.candidate.shopId,label:'进入'+access.candidate.name};
  }

  snapshot():{
    authorityId:string;
    provenance:'RECONSTRUCTION_POLICY';
    routeStatus:'UNKNOWN';
    runtimeEnabled:false;
    candidates:readonly Ch1ShopCandidate[];
    unknownReasons:readonly string[];
  }{
    return{
      authorityId:this.id,
      provenance:this.provenance,
      routeStatus:'UNKNOWN',
      runtimeEnabled:false,
      candidates,
      unknownReasons:Object.freeze([
        '三条村庄到商店的静态路线声明均为 RECOVERED_SECONDARY，runtimeVerified=false。',
        'approach cells 未提供；门标记展开与对齐未运行。',
        '目标出生点尚未通过客户端及地图资源验证。',
        '当前第一章运行时地图集合仅包含 1000、1020、1030、1060。',
        'NPC 21200 的 Quest2 与 NPC 21230 的 Quest9 语义必须保持独立。',
      ]),
    };
  }
}
