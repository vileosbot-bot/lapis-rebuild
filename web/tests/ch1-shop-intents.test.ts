import {test} from 'node:test';
import {createInventory} from '../src/progression/inventory.ts';
import assert from 'node:assert/strict';
import {beginNpcDialogue,applyNpcDialogueChoice,type NpcDialogueIntent} from '../src/world/npc-dialogue-runtime.ts';
import type {NpcDefinition} from '../src/world/npc-model.ts';
import type {QuestRuntimeState} from '../src/world/quest-runtime.ts';

function npc(id:number,questId:string):NpcDefinition{return{
 entity:{id:String(id),kind:'npc',mapId:id===21200?2000:2300,x:10,y:10,displayName:'商店 NPC '+id,interactionRadius:3,provenance:'RECONSTRUCTION_POLICY'},
 questId,shortDialogue:{none:['欢迎。'],available:['有任务可接。']},provenance:'RECONSTRUCTION_POLICY',
};}
function intent(n:NpcDefinition,shopId:string):NpcDialogueIntent{return{
 entityId:n.entity.id,mapId:n.entity.mapId,actorX:n.entity.x,actorY:n.entity.y,inputSource:'pointer',
 provenance:'RECONSTRUCTION_POLICY',shopService:{shopId,label:'进入商店'},
};}
for(const spec of [
 {npcId:21200,questId:'quest2-davis-actor101-companion-recruitment',shopId:'caosia-weapon',name:'Quest2'},
 {npcId:21230,questId:'quest9-merchant5018-single-holy-medicine-offer',shopId:'caosia-potion',name:'Quest9'},
]){
 test('S45 '+spec.name+' and shop intent are separate choices for NPC '+spec.npcId,()=>{
  const definition=npc(spec.npcId,spec.questId);
  const quest:QuestRuntimeState={questId:spec.questId,stage:'not_started'};
  const world={mapId:definition.entity.mapId,x:10,y:10};
  const begun=beginNpcDialogue(definition,quest,world,intent(definition,spec.shopId));
  assert.equal(begun.accepted,true);if(!begun.accepted)return;
  assert.deepEqual(begun.session.view.choices.map(x=>x.id),['accept-quest','decline-quest','open-shop']);
  assert.equal(begun.session.shopId,spec.shopId);
  const shop=applyNpcDialogueChoice(begun.session,quest,'open-shop',1);
  assert.equal(shop.accepted,true);
  if(shop.accepted){assert.equal(shop.quest.questId,spec.questId);assert.equal(shop.quest.stage,'not_started');assert.equal(shop.questAdvanced,false);}
  const accept=applyNpcDialogueChoice(begun.session,quest,'accept-quest',1);
  assert.equal(accept.accepted,true);
  if(accept.accepted){assert.equal(accept.quest.questId,spec.questId);assert.equal(accept.quest.stage,'accepted');}
 });
}
test('S45 Quest9 remains a one-time merchant offer semantic, never a shop stock or repeat receipt',()=>{
 const definition=npc(21230,'quest9-merchant5018-single-holy-medicine-offer');
 assert.match(definition.questId!,/single-holy-medicine-offer/);
 // Shop selection does not advance or rewrite the Quest9 state; one-time reward
 // issuance remains owned by the Quest9 quest/reward receipt authority.
 const quest:QuestRuntimeState={questId:definition.questId!,stage:'not_started'};
 const begun=beginNpcDialogue(definition,quest,{mapId:definition.entity.mapId,x:10,y:10},intent(definition,'caosia-potion'));
 assert.equal(begun.accepted,true);
 if(begun.accepted){const result=applyNpcDialogueChoice(begun.session,quest,'open-shop',1);assert.equal(result.accepted,true);if(result.accepted)assert.deepEqual(result.quest,quest);}
});

for(const spec of [
 {npcId:21200,questId:'quest2-davis-actor101-companion-recruitment',shopId:'caosia-weapon'},
 {npcId:21230,questId:'quest9-merchant5018-single-holy-medicine-offer',shopId:'caosia-potion'},
]){
 for(const stage of ['accepted','objective','ready_to_turn_in','complete'] as const){
  test('S45 '+spec.questId+' keeps shop separate at quest stage '+stage+' for NPC '+spec.npcId,()=>{
   const definition=npc(spec.npcId,spec.questId);
   const quest:QuestRuntimeState={questId:spec.questId,stage};
   const begun=beginNpcDialogue(definition,quest,{mapId:definition.entity.mapId,x:10,y:10},intent(definition,spec.shopId));
   assert.equal(begun.accepted,true);if(!begun.accepted)return;
   assert.ok(begun.session.view.choices.some(choice=>choice.id==='open-shop'));
   const result=applyNpcDialogueChoice(begun.session,quest,'open-shop',1);
   assert.equal(result.accepted,true);
   if(result.accepted){assert.equal(result.quest.stage,stage);assert.equal(result.questAdvanced,false);assert.deepEqual(result.quest,quest);}
  });
 }
}
test('S45 Quest9 trigger/one-time boundary: shop selection cannot satisfy or repeat the merchant reward',()=>{
 const questId='quest9-merchant5018-single-holy-medicine-offer';
 const definition=npc(21230,questId);
 const quest:QuestRuntimeState={questId,stage:'not_started'};
 const begun=beginNpcDialogue(definition,quest,{mapId:2300,x:10,y:10},intent(definition,'caosia-potion'));
 assert.equal(begun.accepted,true);if(!begun.accepted)return;
 const result=applyNpcDialogueChoice(begun.session,quest,'open-shop',1);
 assert.equal(result.accepted,true);if(!result.accepted)return;
 assert.equal(result.quest.questId,questId);
 assert.equal(result.quest.stage,'not_started');
 assert.deepEqual(result.quest,quest);
 // Quest9's actual merchant eligibility predicate and one-time reward receipt belong to its quest/reward runtime, not this dialogue service.
});

import {renderPotionInventory} from '../src/ui/shop-panel.ts';
import {grantItem} from '../src/progression/inventory.ts';
test('S45 potion inventory UI exposes the UNKNOWN refusal reason instead of silently disabling use',()=>{
 const inventory=createInventory([{itemId:4001,source:{kind:'starter',ref:'s45-ui-test'}}]);
 const html=renderPotionInventory(inventory);
 assert.match(html,/恢复量 UNKNOWN/);
 assert.match(html,/不扣药、不改 HP\/MP/);
});
