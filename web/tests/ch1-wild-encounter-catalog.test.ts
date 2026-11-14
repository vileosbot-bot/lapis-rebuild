import {test} from 'node:test';
import assert from 'node:assert/strict';
import rawCatalog from '../../data/ch1-world-catalog/wild-encounters-map-1020.json' with {type:'json'};
import {itemMetadata} from '../src/progression/inventory.ts';
import {
  CH1_WILD_ENCOUNTER_CATALOG,
  CH1_WILD_ENCOUNTERS,
  ch1WildEncounterById,
  manhattanDistance,
  validateCh1WildEncounterCatalog,
} from '../src/world/ch1-wild-encounter-catalog.ts';

test('M7.3 map 1020 catalog contains the six approved placement rows',()=>{
  assert.equal(CH1_WILD_ENCOUNTER_CATALOG.mapId,1020);
  assert.deepEqual(CH1_WILD_ENCOUNTERS.map(row=>row.entityId),[22020,22720,22721,22022,22023,22024]);
  assert.deepEqual(CH1_WILD_ENCOUNTERS.map(row=>[row.name,row.modelId,row.cell,row.approachCell,row.maxHp,row.maxMp,row.reward.gold,row.reward.exp,row.reward.dropItemId]),[
    ['普罗首领B',4006,[4,144],[3,143],150,100,40,150,4002],
    ['雷德普罗',4001,[12,142],[11,141],100,100,40,100,4002],
    ['普罗首领B',4006,[37,153],[36,152],150,100,40,150,4002],
    ['雷德普罗',4001,[37,139],[36,138],100,100,40,100,4002],
    ['普罗首领B',4006,[54,130],[53,129],150,100,40,150,4002],
    ['雷德普罗',4001,[49,121],[48,120],100,100,40,100,4002],
  ]);
});

test('all placement and catalog evidence stays RECOVERED_SECONDARY and never runtime verified',()=>{
  assert.equal(CH1_WILD_ENCOUNTER_CATALOG.provenance,'RECOVERED_SECONDARY');
  assert.equal(CH1_WILD_ENCOUNTER_CATALOG.runtimeVerified,false);
  for(const row of CH1_WILD_ENCOUNTERS){
    assert.equal(row.provenance,'RECOVERED_SECONDARY');
    assert.equal(row.runtimeVerified,false);
    assert.equal(row.entityType,1);
  }
  assert.ok(!JSON.stringify(rawCatalog).includes('"VERIFIED"'));
});

test('approach cells are exactly xy minus one and entity IDs are unique',()=>{
  assert.equal(new Set(CH1_WILD_ENCOUNTERS.map(row=>row.entityId)).size,6);
  for(const row of CH1_WILD_ENCOUNTERS){
    assert.deepEqual(row.approachCell,[row.cell[0]-1,row.cell[1]-1]);
  }
});

test('item 4002 exists in the shared inventory metadata as 便宜药草',()=>{
  const item=itemMetadata(4002);
  assert.equal(item.name,'便宜药草');
  assert.equal(item.metadataRef,'itemtbl:4002');
});

test('catalog rejects duplicate IDs, promoted evidence and altered placement data',()=>{
  const duplicate=structuredClone(rawCatalog) as {records:Array<Record<string,unknown>>};
  duplicate.records[1].entityId=duplicate.records[0].entityId;
  assert.throws(()=>validateCh1WildEncounterCatalog(duplicate),/Duplicate/);

  const promoted=structuredClone(rawCatalog) as {records:Array<Record<string,unknown>>};
  promoted.records[0].provenance='VERIFIED';
  assert.throws(()=>validateCh1WildEncounterCatalog(promoted),/RECOVERED_SECONDARY/);

  const moved=structuredClone(rawCatalog) as {records:Array<{approachCell:number[]}>};
  moved.records[0].approachCell=[4,143];
  assert.throws(()=>validateCh1WildEncounterCatalog(moved),/approach cell/);
});

test('Manhattan distance uses orthogonal grid distance',()=>{
  assert.equal(manhattanDistance([4,144],[3,143]),2);
  assert.equal(manhattanDistance([4,144],[4,147]),3);
  assert.equal(manhattanDistance([4,144],[4,148]),4);
});

test('entity lookup returns only exact map 1020 IDs',()=>{
  assert.equal(ch1WildEncounterById(22022)?.name,'雷德普罗');
  assert.equal(ch1WildEncounterById(99999),undefined);
});
