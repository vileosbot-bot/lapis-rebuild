import test from 'node:test';
import assert from 'node:assert/strict';
import {beginBattle} from '../src/battle.ts';
import {pixelCell} from '../src/tactics.ts';
import {trainingAiBinding} from '../src/ai-runtime.ts';
import {CH1_STORY_ONE_BATTLE_BINDING,buildChapter1StoryOneBattleSetup} from '../src/world/ch1-story-one-battle-roster.ts';
import type {BattleEntry} from '../src/runtime-boundaries.ts';

const EXPECTED_FORMATION:readonly (readonly [number,number,number])[]=[
  [1010,55,21],
  [1001,53,21],[1001,57,21],[1001,55,19],[1001,55,23],
  [1003,53,29],
  [1001,51,27],[1001,55,31],[1001,51,31],[1001,55,27],
  [1003,47,23],
  [1001,49,21],[1001,45,25],[1001,45,21],[1001,49,25],
  [1003,45,31],
  [1001,47,29],[1001,42,32],[1001,44,34],[1001,44,36],
];

test('Chapter 1 Story source 1 uses the 20-unit verified-stat and explicit-portrait binding',()=>{
  const binding=CH1_STORY_ONE_BATTLE_BINDING;
  assert.equal(binding.binding_id,'ch1-story-one-battle-20261113');
  assert.deepEqual(binding.formation.map(row=>[row.model_id,row.position[0],row.position[1]]),EXPECTED_FORMATION);
  assert.deepEqual(binding.summary,{unit_count:20,counts_by_model:{'1001':16,'1003':3,'1010':1}});
  assert.equal(binding.monster_skill_policy.mode,'NONE');
  assert.equal(binding.monster_skill_policy.scope,'all monsters in the Lapis single-player build');
  assert.equal(binding.monster_skill_policy.provenance,'OWNER_DECISION');
  assert.equal(binding.monster_skill_policy.decision_date,'2026-11-13');
  assert.equal(binding.ai_policy.binding,'trainingAiBinding');
  assert.equal(binding.ai_policy.program,'ODNORMAL REST(20),ATTACK(80)');
  assert.equal(binding.ai_policy.provenance,'RECONSTRUCTION_POLICY');
  assert.equal(binding.ai_policy.historical_6a69_binding,'NOT_ASSERTED');

  assert.deepEqual(binding.monster_types['1001'],{
    model_id:1001,name:'步兵',level:1,hp:100,mp:100,attack:50,defense:25,
    magic_attack:0,magic_defense:20,movement_range:5,attack_range:1,gold:20,exp:50,
    visual_resource_id:1001,portrait_source:'ability.atr field 1 (portrait_id)',
    visual_assets:binding.monster_types['1001'].visual_assets,
  });
  assert.deepEqual(binding.monster_types['1003'],{
    model_id:1003,name:'枪兵',level:1,hp:100,mp:100,attack:50,defense:25,
    magic_attack:0,magic_defense:20,movement_range:5,attack_range:2,gold:20,exp:50,
    visual_resource_id:1003,portrait_source:'ability.atr field 1 (portrait_id)',
    visual_assets:binding.monster_types['1003'].visual_assets,
  });
  assert.deepEqual(binding.monster_types['1010'],{
    model_id:1010,name:'十步长',level:5,hp:150,mp:100,attack:86,defense:33,
    magic_attack:0,magic_defense:20,movement_range:5,attack_range:1,gold:60,exp:150,
    visual_resource_id:1010,portrait_source:'ability.atr field 1 (portrait_id)',
    visual_assets:binding.monster_types['1010'].visual_assets,
  });

  for(const row of Object.values(binding.monster_types)){
    assert.equal('skills' in row,false);
    assert.equal('abilities' in row,false);
  }
  for(const row of binding.formation){
    assert.equal('skills' in row,false);
    assert.equal('abilities' in row,false);
  }
});

test('Chapter 1 setup instantiates all 20 positioned monsters with the reconstructed default AI',()=>{
  const setup=buildChapter1StoryOneBattleSetup('100',1);
  assert.equal(setup.enemies?.length,20);
  const entry:BattleEntry={battleZoneId:1,provenance:'RECOVERED_SECONDARY',authority:'offline-reconstruction'};
  const state=beginBattle(0,0,entry,setup);
  assert.equal(state.enemies.length,20);
  const counts=new Map<number,number>();
  for(let i=0;i<state.enemies.length;i++){
    const enemy=state.enemies[i];
    const source=setup.enemies?.[i];
    assert.ok(source);
    assert.equal('skills' in source,false);
    assert.equal('abilities' in source,false);
    assert.equal(enemy.visualResourceId,source.visualResourceId);
    assert.deepEqual(pixelCell(enemy.x,enemy.y),source.position);
    assert.equal(enemy.maxHp,source.maxHp);
    assert.equal(enemy.maxMp,source.maxMp);
    assert.equal(enemy.combatStats.level,source.level);
    assert.equal(enemy.combatStats.attack,source.attack);
    assert.equal(enemy.combatStats.defense,source.defense);
    assert.equal(enemy.combatStats.magicAttack,source.magicAttack);
    assert.equal(enemy.combatStats.magicDefense,source.magicDefense);
    assert.deepEqual(enemy.aiBinding,trainingAiBinding());
    counts.set(enemy.visualResourceId??0,(counts.get(enemy.visualResourceId??0)??0)+1);
  }
  assert.deepEqual(Object.fromEntries(counts),{'1001':16,'1003':3,'1010':1});
});
