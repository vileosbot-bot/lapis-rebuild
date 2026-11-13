import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CH1_EQUIPMENT_CATALOG,EQUIPMENT_STAT_POLICY,equipmentCombatContribution,equipmentRuleForCatalogRow} from '../src/progression/equipment-stat-policy.ts';
import {DEFAULT_RECONSTRUCTION_COMBAT_BALANCE,EQUIPMENT_COMBAT_POLICY} from '../src/combat/reconstruction-combat-balance.ts';

test('itemtbl damage min/max/range survive catalog import without collapsing source fields',()=>{
 const row=CH1_EQUIPMENT_CATALOG.find(item=>item.itemResourceId===1)!;
 assert.deepEqual(row.damageRange,{physical:{min:85,max:95,range:1},magic:{min:0,max:0,range:0}});
 assert.equal(row.source.sourceRow,2);
 assert.equal(row.source.rawLineSha256,'8bb19a657cc13da689d6fcc1e98efeb90b74128ce7a3dd34d2bab5680662e961');
 assert.equal(row.source.evidenceLevel,'RECOVERED_SECONDARY');
 assert.equal(row.source.runtimeVerified,false);
});

test('weapon conversion uses rounded range midpoint and armor/accessory use defense fields',()=>{
 const sword=CH1_EQUIPMENT_CATALOG.find(row=>row.itemResourceId===1)!;
 const staff=CH1_EQUIPMENT_CATALOG.find(row=>row.itemResourceId===10)!;
 const armor=CH1_EQUIPMENT_CATALOG.find(row=>row.itemResourceId===16)!;
 const accessory=CH1_EQUIPMENT_CATALOG.find(row=>row.itemResourceId===4401)!;
 assert.equal(equipmentRuleForCatalogRow(sword).statContribution?.attack,90);
 assert.equal(equipmentRuleForCatalogRow(staff).statContribution?.magicAttack,60);
 assert.equal(equipmentRuleForCatalogRow(armor).statContribution?.defense,3);
 assert.equal(equipmentRuleForCatalogRow(accessory).statContribution?.attack,0);
 assert.equal(equipmentRuleForCatalogRow(accessory).statContribution?.defense,0);
 assert.equal(EQUIPMENT_STAT_POLICY.provenance,'RECONSTRUCTION_POLICY');
});

test('combat bonus aggregates equipped weapon, armor and accessory contributions',()=>{
 const total=equipmentCombatContribution([1,16,4401]);
 assert.deepEqual(total,{attack:90,magicAttack:0,defense:3,magicDefense:3});
});

test('no stage requirement is invented when itemtbl does not encode a stage id',()=>{
 for(const row of CH1_EQUIPMENT_CATALOG.slice(0,50)){
  assert.equal(equipmentRuleForCatalogRow(row).allowedStageIds,undefined);
  assert.equal(equipmentRuleForCatalogRow(row).provenance.stageRestriction,'UNKNOWN');
 }
});

test('equipment bonuses are consumed by CombatantStats for both professions',()=>{
 const swordBase=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.playerStats('100',1);
 const swordEquipped=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.playerStats('100',1,equipmentCombatContribution([1]));
 assert.equal(swordEquipped.attack,swordBase.attack+90);
 const wizardBase=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.playerStats('109',1);
 const wizardEquipped=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.playerStats('109',1,equipmentCombatContribution([10]));
 assert.equal(wizardEquipped.magicAttack,wizardBase.magicAttack+60);
 assert.equal(EQUIPMENT_COMBAT_POLICY.provenance,'RECONSTRUCTION_POLICY');
});
