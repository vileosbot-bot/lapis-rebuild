import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInventory,quantityOf} from '../src/progression/inventory.ts';
import {applyBattleReward} from '../src/progression/rewards.ts';
import {initialM71Progression} from '../src/progression/progression.ts';
import {CH1_WILD_ENCOUNTERS} from '../src/world/ch1-wild-encounter-catalog.ts';
import {
  clearCh1WildSuppressionAfterLeavingRange,
  createCh1WildEncounterState,
  markCh1WildEncounterDefeated,
  markCh1WildMapEntered,
  markCh1WildMapLeft,
  resolveCh1WildEncounter,
  suppressCh1WildEncounterUntilLeave,
  validateCh1WildEncounterState,
} from '../src/world/ch1-wild-encounter-authority.ts';

test('wild trigger uses strict Manhattan less-than-four distance',()=>{
  const state=createCh1WildEncounterState();
  const atThree=resolveCh1WildEncounter({mapId:1020,playerCell:[4,147],playerLevel:1,state});
  const atFour=resolveCh1WildEncounter({mapId:1020,playerCell:[4,148],playerLevel:1,state});
  assert.equal(atThree.status,'eligible');
  assert.equal(atThree.distance,3);
  assert.equal(atFour.status,'no-candidate');
});

test('wrong map and zero candidates never trigger',()=>{
  const state=createCh1WildEncounterState();
  assert.equal(resolveCh1WildEncounter({mapId:1030,playerCell:[4,144],playerLevel:1,state}).status,'wrong-map');
  assert.equal(resolveCh1WildEncounter({mapId:1020,playerCell:[100,100],playerLevel:1,state}).status,'no-candidate');
});

test('multiple candidates are ambiguous and never trigger',()=>{
  const state=createCh1WildEncounterState();
  const rows=[CH1_WILD_ENCOUNTERS[0],Object.freeze({...CH1_WILD_ENCOUNTERS[1],entityId:33001,cell:Object.freeze([5,144]) as readonly [number,number]})];
  const result=resolveCh1WildEncounter({mapId:1020,playerCell:[4,144],playerLevel:1,state,records:rows});
  assert.equal(result.status,'ambiguous');
  assert.equal(result.candidates.length,2);
  assert.equal(result.candidate,null);
});

test('level gate applies only after unique-candidate resolution',()=>{
  const state=createCh1WildEncounterState();
  const row=Object.freeze({...CH1_WILD_ENCOUNTERS[0],minimumLevel:2});
  const result=resolveCh1WildEncounter({mapId:1020,playerCell:[4,144],playerLevel:1,state,records:[row]});
  assert.equal(result.status,'level-too-low');
  assert.equal(result.candidate?.entityId,22020);
});

test('defeated entities leave the candidate set',()=>{
  const state=markCh1WildEncounterDefeated(createCh1WildEncounterState(),22020);
  const result=resolveCh1WildEncounter({mapId:1020,playerCell:[4,144],playerLevel:1,state});
  assert.equal(result.status,'no-candidate');
});

test('failed or retreated entity remains suppressed until player leaves its trigger radius',()=>{
  const initial=createCh1WildEncounterState();
  const suppressed=suppressCh1WildEncounterUntilLeave(initial,22020);
  assert.equal(resolveCh1WildEncounter({mapId:1020,playerCell:[4,144],playerLevel:1,state:suppressed}).status,'suppressed-until-leave');
  const stillNear=clearCh1WildSuppressionAfterLeavingRange(suppressed,[4,147]);
  assert.equal(stillNear.suppressedEntityId,22020);
  const outside=clearCh1WildSuppressionAfterLeavingRange(suppressed,[4,148]);
  assert.equal(outside.suppressedEntityId,null);
  assert.equal(resolveCh1WildEncounter({mapId:1020,playerCell:[4,144],playerLevel:1,state:outside}).status,'eligible');
});

test('leaving map 1020 arms refresh; next entry increments generation and resets defeated IDs',()=>{
  const initial=createCh1WildEncounterState();
  const defeated=markCh1WildEncounterDefeated(initial,22020);
  const left=markCh1WildMapLeft(defeated);
  assert.equal(left.refreshOnNextEntry,true);
  assert.deepEqual(left.defeatedEntityIds,[22020]);
  const entered=markCh1WildMapEntered(left);
  assert.equal(entered.spawnGeneration,2);
  assert.deepEqual(entered.defeatedEntityIds,[]);
  assert.equal(entered.suppressedEntityId,null);
  assert.equal(entered.refreshOnNextEntry,false);
  assert.equal(markCh1WildMapEntered(entered),entered);
});

test('save state validator rejects unknown IDs and promoted evidence',()=>{
  const raw={...createCh1WildEncounterState(),defeatedEntityIds:[99999]};
  assert.throws(()=>validateCh1WildEncounterState(raw),/Unknown or duplicate/);
  const promoted={...createCh1WildEncounterState(),provenance:'VERIFIED'};
  assert.throws(()=>validateCh1WildEncounterState(promoted),/policy/);
});

test('wild victory reward grants gold, EXP and exactly one herb with a generation receipt',()=>{
  const initial={
    gold:0,
    inventory:createInventory(),
    progression:initialM71Progression(),
    questFlags:{},
    rewardReceipts:[],
  };
  const first=applyBattleReward(initial,'ch1-wild:22020','ch1-wild-1-22020-win',{
    gold:40,
    exp:150,
    items:[{itemId:4002,quantity:1}],
  });
  assert.equal(first.applied,true);
  assert.equal(first.state.gold,40);
  assert.equal(first.state.progression.exp,150);
  assert.equal(quantityOf(first.state.inventory,4002),1);
  assert.deepEqual(first.state.rewardReceipts,['ch1-wild-1-22020-win']);

  const duplicate=applyBattleReward(first.state,'ch1-wild:22020','ch1-wild-1-22020-win',{
    gold:40,
    exp:150,
    items:[{itemId:4002,quantity:1}],
  });
  assert.equal(duplicate.applied,false);
  assert.equal(duplicate.state.gold,40);
  assert.equal(quantityOf(duplicate.state.inventory,4002),1);
  assert.equal(duplicate.state.progression.exp,150);

  const refreshed=applyBattleReward(duplicate.state,'ch1-wild:22020','ch1-wild-2-22020-win',{
    gold:40,
    exp:150,
    items:[{itemId:4002,quantity:1}],
  });
  assert.equal(refreshed.applied,true);
  assert.equal(refreshed.state.gold,80);
  assert.equal(quantityOf(refreshed.state.inventory,4002),2);
  assert.equal(refreshed.state.progression.exp,300);
});
