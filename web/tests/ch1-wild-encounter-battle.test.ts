import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CH1_WILD_ENCOUNTERS} from '../src/world/ch1-wild-encounter-catalog.ts';
import {DEFAULT_RECONSTRUCTION_COMBAT_BALANCE} from '../src/combat/reconstruction-combat-balance.ts';
import {createCh1WildBattlePlan} from '../src/world/ch1-wild-encounter-battle.ts';

test('wild battle uses one enemy, map 1020 fallback and explicit text visual fallback',()=>{
  const record=CH1_WILD_ENCOUNTERS[0];
  const plan=createCh1WildBattlePlan(record,'100',1,{attack:0,defense:0});
  assert.equal(plan.entry.battleZoneId,1020);
  assert.equal(plan.entry.provenance,'RECONSTRUCTION_POLICY');
  assert.equal(plan.entry.authority,'offline-reconstruction');
  assert.equal(plan.setup.enemies?.length,1);
  assert.equal(plan.visualFallback,'TEXT_LABEL');
  assert.equal(plan.provenance,'RECONSTRUCTION_POLICY');
});

test('wild battle preserves recovered HP/MP and uses default reconstruction combat stats for all other attributes',()=>{
  const record=CH1_WILD_ENCOUNTERS[1];
  const plan=createCh1WildBattlePlan(record,'100',5,{attack:0,defense:0});
  const enemy=plan.setup.enemies?.[0];
  const defaults=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.enemyStats({id:record.name,level:record.minimumLevel,rank:'normal',role:'melee'});
  assert.ok(enemy);
  assert.equal(enemy.maxHp,record.maxHp);
  assert.equal(enemy.maxMp,record.maxMp);
  assert.equal(enemy.level,record.minimumLevel);
  assert.equal(enemy.rank,'normal');
  assert.equal(enemy.role,'melee');
  assert.equal(enemy.attack,defaults.attack);
  assert.equal(enemy.defense,defaults.defense);
  assert.equal(enemy.magicAttack,defaults.magicAttack);
  assert.equal(enemy.magicDefense,defaults.magicDefense);
  assert.equal(enemy.visualResourceId,undefined);
});

test('wild enemies have no abilities or skills and use a single melee movement profile',()=>{
  const plan=createCh1WildBattlePlan(CH1_WILD_ENCOUNTERS[0],'100',1,{});
  const enemy=plan.setup.enemies?.[0];
  assert.ok(enemy);
  assert.deepEqual(enemy.abilities,[]);
  assert.deepEqual(enemy.traits,[]);
  assert.equal(enemy.movementRangeCells,1);
  assert.equal(enemy.attackRangeCells,1);
});
