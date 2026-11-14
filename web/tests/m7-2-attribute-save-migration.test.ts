import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInventory} from '../src/progression/inventory.ts';
import {equipItem} from '../src/progression/equipment.ts';
import {M71_EXPERIENCE_POLICY,m71TotalExpForLevel} from '../src/progression/m7-1-experience-policy.ts';
import {CURRENT_SAVE_VERSION,SAVE_KIND,validateSaveV2} from '../src/progression/save-schema.ts';
import type {SaveV2,SaveValidationContext} from '../src/progression/save-schema.ts';
import {M6_CHARACTER_IDS,M6_SAVE_CONTENT} from '../src/m6-runtime-content.ts';
import {migrateSaveToM7,serializeM7SaveV2} from '../src/progression/m7-save-migration.ts';
import {createM7IntegratedSkillState} from '../src/training/m7-skill-progression.ts';
import {
  addAttributePointToDraft,
  confirmAttributeAllocation,
  createAttributeAllocationDraft,
  createAttributeAllocationState,
} from '../src/progression/attribute-points.ts';

const context:SaveValidationContext={
  pack:'pack',
  characters:M6_CHARACTER_IDS,
  mapBounds:{0:{width:100,height:100}},
};

function base(character:string,level=6):SaveV2{
  let inventory=createInventory([
    {itemId:1,source:{kind:'starter',ref:'m7-2-migration-test'}},
    {itemId:25,source:{kind:'starter',ref:'m7-2-migration-test'}},
    {itemId:10,source:{kind:'starter',ref:'m7-2-migration-test'}},
    {itemId:31,source:{kind:'starter',ref:'m7-2-migration-test'}},
  ]);
  inventory=equipItem(inventory,character,'weapon',character==='100'?1:10);
  inventory=equipItem(inventory,character,'armor',character==='100'?25:31);
  return validateSaveV2({
    kind:SAVE_KIND,
    version:CURRENT_SAVE_VERSION,
    pack:'pack',
    character,
    mapId:0,
    x:10,
    y:10,
    gold:123,
    inventory,
    quest:{guide:'complete'},
    questFlags:{'m7-2.migration.fixture':true},
    progression:{level,exp:m71TotalExpForLevel(level),policyId:M71_EXPERIENCE_POLICY.id},
    rewardReceipts:['battle:m7-2:existing-receipt'],
    savedAt:'2026-11-13T00:00:00Z',
  },context);
}

test('schema 1 M7 extension migrates to schema 2 with all historical attribute points unspent',()=>{
  for(const character of ['100','109']){
    const source=base(character,6);
    const skills=createM7IntegratedSkillState(character,6);
    const family=character==='100'?'swordsman':'wizard';
    const migrated=migrateSaveToM7({
      ...source,
      m7:{schema:1,family,skills,vitals:{hp:77,mp:33},provenance:'RECONSTRUCTION_POLICY'},
    },context,M6_SAVE_CONTENT);
    assert.equal(migrated.m7.schema,2);
    assert.deepEqual(migrated.m7.skills,skills);
    assert.deepEqual(migrated.m7.vitals,{hp:77,mp:33});
    assert.equal(migrated.m7.attributes.level,6);
    assert.deepEqual(migrated.m7.attributes.automaticGrowth,{con:6,wis:6,str:6,dex:6,int:6,reg:6});
    assert.deepEqual(migrated.m7.attributes.allocated,{con:0,wis:0,str:0,dex:0,int:0,reg:0});
    assert.equal(migrated.m7.attributes.unspentPoints,7);
    assert.deepEqual(migrated.progression,source.progression);
    assert.deepEqual(migrated.inventory.equipped,source.inventory.equipped);
    assert.equal(migrated.m6.equipment.weapon,source.inventory.equipped.weapon);
    assert.equal(migrated.m6.equipment.armor,source.inventory.equipped.armor);
    assert.equal(migrated.gold,source.gold);
    assert.deepEqual(migrated.rewardReceipts,source.rewardReceipts);
  }
});

test('SaveV2 load preserves stored gold instead of applying the new-game starting balance',()=>{
  const source=base('100',6);
  for(const savedGold of [0,2_000,4_321,20_000,22_000]){
    const migrated=migrateSaveToM7({...source,gold:savedGold},context,M6_SAVE_CONTENT);
    assert.equal(migrated.gold,savedGold);
    const json=serializeM7SaveV2(migrated,context,M6_SAVE_CONTENT);
    const restored=migrateSaveToM7(JSON.parse(json),context,M6_SAVE_CONTENT);
    assert.equal(restored.gold,savedGold);
  }
});

test('a SaveV2 without any M7 extension receives current-level historical points as unspent',()=>{
  const source=base('109',6);
  const migrated=migrateSaveToM7(source,context,M6_SAVE_CONTENT);
  assert.equal(migrated.m7.schema,2);
  assert.equal(migrated.m7.attributes.unspentPoints,7);
  assert.deepEqual(migrated.m7.attributes.allocated,{con:0,wis:0,str:0,dex:0,int:0,reg:0});
  assert.equal(migrated.m7.vitals,null);
  assert.deepEqual(migrated.progression,source.progression);
  assert.deepEqual(migrated.inventory.equipped,source.inventory.equipped);
});

test('schema 2 attribute allocations and current HP/MP survive JSON save-load round trip',()=>{
  const source=base('100',6);
  const skills=createM7IntegratedSkillState('100',6);
  let attributes=createAttributeAllocationState(6);
  let draft=createAttributeAllocationDraft(attributes);
  draft=addAttributePointToDraft(attributes,draft,'str');
  draft=addAttributePointToDraft(attributes,draft,'con');
  attributes=confirmAttributeAllocation(attributes,draft);
  const first=migrateSaveToM7({
    ...source,
    m7:{schema:2,family:'swordsman',skills,attributes,vitals:{hp:88,mp:44},provenance:'RECONSTRUCTION_POLICY'},
  },context,M6_SAVE_CONTENT);
  const json=serializeM7SaveV2(first,context,M6_SAVE_CONTENT);
  const loaded=migrateSaveToM7(JSON.parse(json),context,M6_SAVE_CONTENT);
  assert.deepEqual(loaded.m7.attributes,first.m7.attributes);
  assert.deepEqual(loaded.m7.skills,first.m7.skills);
  assert.deepEqual(loaded.m7.vitals,{hp:88,mp:44});
  assert.deepEqual(loaded.progression,first.progression);
  assert.deepEqual(loaded.inventory.equipped,first.inventory.equipped);
});
