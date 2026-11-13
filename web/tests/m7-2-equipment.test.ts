import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CH1_EQUIPMENT_CATALOG,CH1_EQUIPMENT_RULES,equipmentCatalogRow} from '../src/progression/equipment-stat-policy.ts';
import {createInventory,knownItemIds,quantityOf} from '../src/progression/inventory.ts';
import {emptyM6EquipmentLoadout,equipM6Item,evaluateM6EquipmentEligibility,m6EquipmentStatContribution,validateM6EquipmentLoadoutShape} from '../src/progression/m6-equipment.ts';
import {createM6SaveExtension,validateM6SaveExtension} from '../src/progression/m6-save-extension.ts';
import {createM6StageState,m6QuestChainForLegacyStage} from '../src/m6-runtime-content.ts';

const context=(family:'swordsman'|'wizard'='swordsman',level=1,stageId=family==='swordsman'?100:109,attributes={con:30,wis:30,str:30,dex:30,int:30,reg:30})=>({characterId:String(stageId),family,stageId,level,attributes});
const rule=(id:number)=>CH1_EQUIPMENT_RULES.find(row=>row.itemId===id)!;
const inv=(ids:number[])=>createInventory(ids.map(itemId=>({itemId,source:{kind:'quest' as const,ref:'s44-test'}})));

test('S44 catalog is unique, source traceable and limited to the approved three-slot mapping',()=>{
 assert.equal(CH1_EQUIPMENT_CATALOG.length,612);
 assert.equal(new Set(CH1_EQUIPMENT_CATALOG.map(row=>row.itemResourceId)).size,612);
 assert.deepEqual(new Set(CH1_EQUIPMENT_CATALOG.map(row=>row.slot)),new Set(['weapon','armor','accessory']));
 for(const row of CH1_EQUIPMENT_CATALOG){assert.equal(row.source.evidenceLevel,'RECOVERED_SECONDARY');assert.equal(row.source.runtimeVerified,false);assert.equal(row.source.rawLineSha256.length,64);assert.ok(row.source.sourceRow>1);assert.ok([0,1,2,3,4,5,6,8].includes(row.equipPosition));}
});

test('M6 three slots equip owned items, reject duplicate IDs and preserve accessory as third slot',()=>{
 const inventory=inv([1,16,4401]);let loadout=emptyM6EquipmentLoadout();
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(16),rule(4401)],context(),'weapon',1);
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(16),rule(4401)],context(),'armor',16);
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(16),rule(4401)],context(),'accessory',4401);
 assert.deepEqual(loadout,{weapon:1,armor:16,accessory:4401});
 assert.throws(()=>validateM6EquipmentLoadoutShape({weapon:1,armor:1,accessory:null}),/Duplicate/);
 assert.throws(()=>equipM6Item(loadout,inventory,[rule(1),rule(16),rule(4401)],context(),'weapon',99999),/not owned|Unknown/);
});

test('profession, level, stage and six-dimension requirements are explicit eligibility gates',()=>{
 assert.equal(evaluateM6EquipmentEligibility(rule(1),context('swordsman')).allowed,true);
 assert.ok(evaluateM6EquipmentEligibility(rule(1),context('wizard')).reasons.includes('class-restricted'));
 const highLevel={...rule(1),minimumLevel:6};
 assert.ok(evaluateM6EquipmentEligibility(highLevel,context('swordsman',1)).reasons.includes('level-restricted'));
 const stageBound={...rule(1),allowedStageIds:[110]};
 assert.ok(evaluateM6EquipmentEligibility(stageBound,context('swordsman',1,100)).reasons.includes('stage-restricted'));
 const attributeBound={...rule(1),requiredAttributes:{con:31}};
 assert.ok(evaluateM6EquipmentEligibility(attributeBound,context()).reasons.includes('attribute-restricted'));
 assert.equal(rule(1).provenance.stageRestriction,'UNKNOWN');
});

test('invalid slot and duplicate catalog rules are rejected',()=>{
 assert.throws(()=>equipM6Item(emptyM6EquipmentLoadout(),inv([1]),[rule(1)],context(),'head' as never,1));
 assert.throws(()=>validateM6EquipmentLoadoutShape({weapon:1,armor:null,accessory:null,head:null}));
});

test('switching or unequipping keeps old gear in the owned inventory',()=>{
 const inventory=inv([1,2]);let loadout=emptyM6EquipmentLoadout();
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(2)],context(),'weapon',1);
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(2)],context(),'weapon',2);
 assert.equal(loadout.weapon,2);
 assert.equal(quantityOf(inventory,1),1);
 assert.equal(quantityOf(inventory,2),1);
 loadout=equipM6Item(loadout,inventory,[rule(1),rule(2)],context(),'weapon',null);
 assert.equal(loadout.weapon,null);
 assert.equal(quantityOf(inventory,2),1);
});

test('equipment stats sum across three slots and keep item range data available',()=>{
 const ids=[1,16,4401];const total=m6EquipmentStatContribution({weapon:1,armor:16,accessory:4401},ids.map(rule));
 assert.equal(total.attack,90);
 assert.equal(total.defense,3);
 assert.equal(total.magicDefense,3);
 const weapon=equipmentCatalogRow(1)!;
 assert.deepEqual(weapon.damageRange.physical,{min:85,max:95,range:1});
 assert.equal(weapon.source.rawLineSha256,'8bb19a657cc13da689d6fcc1e98efeb90b74128ce7a3dd34d2bab5680662e961');
});

test('legacy M6 schema 1 three-slot save extension remains readable',()=>{
 const extension=createM6SaveExtension('100',{stage:createM6StageState('100'),questChain:m6QuestChainForLegacyStage('not_started',{}),equipment:{weapon:1,armor:16,accessory:null}});
 assert.equal(extension.schema,1);
 const restored=validateM6SaveExtension(JSON.parse(JSON.stringify(extension)),'100');
 assert.deepEqual(restored.equipment,{weapon:1,armor:16,accessory:null});
});

test('newbie spear item 4 is catalog-only and not added to starter inventory',()=>{
 const starter=createInventory(knownItemIds().map(itemId=>({itemId,source:{kind:'starter' as const,ref:'legacy-starter-catalog'}})));
 assert.ok(equipmentCatalogRow(4));
 assert.deepEqual(knownItemIds(),[1,3,10,12,25,31]);
 assert.equal(quantityOf(starter,4),0);
});
