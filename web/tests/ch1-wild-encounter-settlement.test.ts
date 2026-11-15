import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,quantityOf} from '../src/progression/inventory.ts';
import {initialM71Progression} from '../src/progression/progression.ts';
import {CH1_WILD_ENCOUNTERS} from '../src/world/ch1-wild-encounter-catalog.ts';
import {createCh1WildEncounterState} from '../src/world/ch1-wild-encounter-authority.ts';
import {settleCh1WildBattle} from '../src/world/ch1-wild-encounter-settlement.ts';

function rewards(){
  return {gold:0,inventory:createInventory(),progression:initialM71Progression(),questFlags:{},rewardReceipts:[]};
}

test('wild victory settles one item4002 and a generation/entity-specific receipt exactly once',()=>{
  const record=CH1_WILD_ENCOUNTERS[0];
  const state=createCh1WildEncounterState();
  const first=settleCh1WildBattle({rewards:rewards(),wildState:state,record,generation:1,outcome:'won'});
  assert.equal(first.applied,true);
  assert.equal(first.receiptId,'ch1-wild-1-22020-win');
  assert.equal(first.rewards.gold,40);
  assert.equal(first.rewards.progression.exp,150);
  assert.equal(quantityOf(first.rewards.inventory,4002),1);
  assert.deepEqual(first.wildState.defeatedEntityIds,[22020]);

  const duplicate=settleCh1WildBattle({rewards:first.rewards,wildState:state,record,generation:1,outcome:'won'});
  assert.equal(duplicate.applied,false);
  assert.equal(duplicate.rewards.gold,40);
  assert.equal(duplicate.rewards.progression.exp,150);
  assert.equal(quantityOf(duplicate.rewards.inventory,4002),1);
  assert.deepEqual(duplicate.wildState.defeatedEntityIds,[22020]);
});

test('a refreshed spawn generation receives a new victory receipt',()=>{
  const record=CH1_WILD_ENCOUNTERS[0];
  const state=createCh1WildEncounterState();
  const first=settleCh1WildBattle({rewards:rewards(),wildState:state,record,generation:1,outcome:'won'});
  const nextState=Object.freeze({...state,spawnGeneration:2,defeatedEntityIds:Object.freeze([])});
  const second=settleCh1WildBattle({rewards:first.rewards,wildState:nextState,record,generation:2,outcome:'won'});
  assert.equal(second.applied,true);
  assert.equal(second.receiptId,'ch1-wild-2-22020-win');
  assert.equal(second.rewards.gold,80);
  assert.equal(quantityOf(second.rewards.inventory,4002),2);
});

test('loss and retreat suppress re-entry but never grant gold, EXP, item or receipts',()=>{
  const record=CH1_WILD_ENCOUNTERS[0];
  const initialRewards=rewards();
  const state=createCh1WildEncounterState();
  for(const outcome of ['lost','retreated'] as const){
    const result=settleCh1WildBattle({rewards:initialRewards,wildState:state,record,generation:1,outcome});
    assert.equal(result.applied,false);
    assert.equal(result.receiptId,null);
    assert.equal(result.rewards,initialRewards);
    assert.equal(result.rewards.gold,0);
    assert.equal(result.rewards.progression.exp,0);
    assert.equal(quantityOf(result.rewards.inventory,4002),0);
    assert.deepEqual(result.rewards.rewardReceipts,[]);
    assert.equal(result.wildState.suppressedEntityId,record.entityId);
  }
});

test('settlement rejects a stale generation',()=>{
  assert.throws(()=>settleCh1WildBattle({
    rewards:rewards(),
    wildState:createCh1WildEncounterState(),
    record:CH1_WILD_ENCOUNTERS[0],
    generation:2,
    outcome:'won',
  }),/Stale/);
});
