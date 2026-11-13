import {test} from 'node:test';
import assert from 'node:assert/strict';
import growthData from '../../data/progression/ch1-attribute-growth.json' with {type:'json'};
import {createInventory} from '../src/progression/inventory.ts';
import {initialM71Progression} from '../src/progression/progression.ts';
import {m71TotalExpForLevel} from '../src/progression/m7-1-experience-policy.ts';
import {applyBattleReward} from '../src/progression/rewards.ts';
import type {RewardState} from '../src/progression/rewards.ts';
import {
  ATTRIBUTE_KEYS,
  addAttributePointToDraft,
  attributePointsEarnedThroughLevel,
  attributePointsGrantedAtLevel,
  cancelAttributeAllocationDraft,
  confirmAttributeAllocation,
  createAttributeAllocationDraft,
  createAttributeAllocationState,
  grantAttributeLevels,
  pendingAttributePoints,
  retainAttributeAllocationAcrossStageChange,
  totalAttributeValue,
  validateAttributeAllocationState,
} from '../src/progression/attribute-points.ts';
import {ATTRIBUTE_STAT_POLICY,projectAttributeCombatBonuses} from '../src/progression/attribute-stat-policy.ts';

const rewardState=():RewardState=>({
  gold:0,
  inventory:createInventory(),
  progression:initialM71Progression(),
  questFlags:{},
  rewardReceipts:[],
});

test('S43 imports all 100 source rows while enabling only Lv1..65 at runtime',()=>{
  assert.equal(growthData.rows.length,100);
  assert.equal(growthData.rows[0]!.sourceRow,2);
  assert.equal(growthData.rows[99]!.sourceRow,101);
  assert.equal(growthData.rows[85]!.distributablePoints,3);
  assert.equal(growthData.rows[99]!.runtimeEnabled,false);
  assert.equal(attributePointsGrantedAtLevel(1),1);
  assert.equal(attributePointsGrantedAtLevel(5),1);
  assert.equal(attributePointsGrantedAtLevel(6),2);
  assert.equal(attributePointsEarnedThroughLevel(5),5);
  assert.equal(attributePointsEarnedThroughLevel(6),7);
  assert.equal(attributePointsEarnedThroughLevel(65),125);
  assert.throws(()=>attributePointsGrantedAtLevel(66));
});

test('Lv1 creation includes the first automatic six-stat row and one unspent point',()=>{
  const state=createAttributeAllocationState(1);
  assert.equal(state.level,1);
  assert.deepEqual(state.automaticGrowth,{con:1,wis:1,str:1,dex:1,int:1,reg:1});
  assert.deepEqual(state.allocated,{con:0,wis:0,str:0,dex:0,int:0,reg:0});
  assert.equal(state.unspentPoints,1);
});

test('level-up grants 1 point at Lv2..5 and 2 points from Lv6, with automatic +1 to all six dimensions',()=>{
  let state=createAttributeAllocationState(1);
  for(let level=2;level<=5;level+=1)state=grantAttributeLevels(state,level,'level-receipt-'+level);
  assert.equal(state.unspentPoints,5);
  assert.deepEqual(state.automaticGrowth,{con:5,wis:5,str:5,dex:5,int:5,reg:5});
  state=grantAttributeLevels(state,6,'level-receipt-6');
  assert.equal(state.unspentPoints,7);
  assert.deepEqual(state.automaticGrowth,{con:6,wis:6,str:6,dex:6,int:6,reg:6});
});

test('one multi-level M7.1 reward emits ordered attribute grants and duplicate receipts are idempotent',()=>{
  const before=rewardState();
  const receipt='battle:m7-2:multi-level';
  const first=applyBattleReward(before,'m7-2-test',receipt,{gold:0,exp:m71TotalExpForLevel(6)});
  assert.equal(first.state.progression.level,6);
  assert.deepEqual(first.events.filter(event=>event.type==='level_up').map(event=>event.toLevel),[2,3,4,5,6]);
  assert.deepEqual(first.events.filter(event=>event.type==='attribute_point').map(event=>event.amount),[1,1,1,1,2]);
  let attributes=createAttributeAllocationState(1);
  attributes=grantAttributeLevels(attributes,first.state.progression.level,receipt);
  assert.equal(attributes.unspentPoints,7);
  const duplicate=applyBattleReward(first.state,'m7-2-test',receipt,{gold:0,exp:999999});
  assert.equal(duplicate.applied,false);
  assert.deepEqual(duplicate.events,[]);
  const afterDuplicate=grantAttributeLevels(attributes,6,receipt);
  assert.deepEqual(afterDuplicate,attributes);
});

test('allocation draft supports add, cancel and confirm without mutating the committed state early',()=>{
  const state=createAttributeAllocationState(6);
  const initialDraft=createAttributeAllocationDraft(state);
  const cancelled=cancelAttributeAllocationDraft(state);
  assert.equal(pendingAttributePoints(cancelled),0);
  assert.deepEqual(state.allocated,{con:0,wis:0,str:0,dex:0,int:0,reg:0});
  let draft=addAttributePointToDraft(state,initialDraft,'str');
  draft=addAttributePointToDraft(state,draft,'dex');
  assert.equal(pendingAttributePoints(draft),2);
  assert.equal(state.unspentPoints,7);
  const committed=confirmAttributeAllocation(state,draft);
  assert.equal(committed.unspentPoints,5);
  assert.equal(committed.allocated.str,1);
  assert.equal(committed.allocated.dex,1);
  assert.equal(state.allocated.str,0);
});

test('allocation rejects insufficient balance, negative, decimal, unknown and over-allocation inputs',()=>{
  const state=createAttributeAllocationState(1);
  const draft=createAttributeAllocationDraft(state);
  assert.throws(()=>addAttributePointToDraft(state,draft,'con',-1));
  assert.throws(()=>addAttributePointToDraft(state,draft,'con',0.5));
  assert.throws(()=>addAttributePointToDraft(state,draft,'luck'));
  const one=addAttributePointToDraft(state,draft,'con');
  assert.throws(()=>addAttributePointToDraft(state,one,'wis'));
  assert.throws(()=>confirmAttributeAllocation(state,{...one,pending:{...one.pending,con:2}}));
  assert.throws(()=>validateAttributeAllocationState({...state,allocated:{...state.allocated,con:-1}}));
  assert.throws(()=>validateAttributeAllocationState({...state,allocated:{...state.allocated,con:2}}));
});

test('approved CON/WIS/STR/INT mappings project combat values while DEX/REG remain unmapped',()=>{
  const levelOne=createAttributeAllocationState(1);
  assert.deepEqual(projectAttributeCombatBonuses(levelOne),{maxHp:50,maxMp:50,attack:1,defense:1,magicAttack:1,magicDefense:1});
  assert.deepEqual(ATTRIBUTE_STAT_POLICY.unmapped.dex,{status:'unmapped',evidenceLevel:'UNKNOWN',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-dex-unmapped-pending-s46-v1'});
  assert.deepEqual(ATTRIBUTE_STAT_POLICY.unmapped.reg,{status:'unmapped',evidenceLevel:'UNKNOWN',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-reg-unmapped-pending-s46-v1'});
  assert.equal(Object.hasOwn(ATTRIBUTE_STAT_POLICY.mappings,'dex'),false);
  assert.equal(Object.hasOwn(ATTRIBUTE_STAT_POLICY.mappings,'reg'),false);

  const state=createAttributeAllocationState(6);
  let draft=createAttributeAllocationDraft(state);
  for(const key of ['con','wis','str','int'] as const)draft=addAttributePointToDraft(state,draft,key);
  const committed=confirmAttributeAllocation(state,draft);
  assert.equal(totalAttributeValue(committed,'con'),7);
  assert.equal(totalAttributeValue(committed,'dex'),6);
  assert.equal(totalAttributeValue(committed,'reg'),6);
  assert.deepEqual(projectAttributeCombatBonuses(committed),{maxHp:350,maxMp:350,attack:7,defense:7,magicAttack:7,magicDefense:7});

  // DEX/REG may continue growing and being allocated without contributing
  // combat values until the S46 evidence gate is completed.
  let unmappedDraft=createAttributeAllocationDraft(committed);
  unmappedDraft=addAttributePointToDraft(committed,unmappedDraft,'dex');
  unmappedDraft=addAttributePointToDraft(committed,unmappedDraft,'reg');
  const unmappedAllocated=confirmAttributeAllocation(committed,unmappedDraft);
  assert.equal(totalAttributeValue(unmappedAllocated,'dex'),7);
  assert.equal(totalAttributeValue(unmappedAllocated,'reg'),7);
  assert.deepEqual(projectAttributeCombatBonuses(unmappedAllocated),projectAttributeCombatBonuses(committed));
});

test('attribute allocation survives same-family stage changes and rejects cross-family carry-over',()=>{
  const state=createAttributeAllocationState(6);
  assert.deepEqual(retainAttributeAllocationAcrossStageChange(state,'swordsman','swordsman'),state);
  assert.deepEqual(retainAttributeAllocationAcrossStageChange(state,'wizard','wizard'),state);
  assert.throws(()=>retainAttributeAllocationAcrossStageChange(state,'swordsman','wizard'));
});
