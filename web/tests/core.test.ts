import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAnimation,frameIndex,advanceClock,safePath,validateCollision,validateManifest} from '../src/model.ts';
import {rawCell,findRoute,referenceCellToScreen,referenceScreenToCell,closestWalkable,directionFor} from '../src/coordinates.ts';
import {beginBattle,useAttack,updateBattle,initialState} from '../src/battle.ts';
import {validateSave} from '../src/save.ts';
import type {BattleState} from '../src/battle.ts';
const anim=()=>({action_slot:'00',frames_per_direction:2,raw_timing:5,directions:Array.from({length:8},(_,d)=>[d*2,d*2+1]),spr_frame_count:16,frame_bounds:Array.from({length:16},(_,index)=>({index,left:-12,top:-42,right:12,bottom:2}))});
const grid=()=>({width:3,height:3,grid_order:'first-major',grid:[1,0,0,1,1,0,0,1,1]});
const advanceBattle=(s:BattleState,ms:number,x=0,y=0,defense=0)=>{for(let left=ms;left>0;left-=100)updateBattle(s,Math.min(100,left),x,y,defense);};
const reconstructionCombatBattle=()=>beginBattle(0,0,undefined,{
 playerClassId:109,
 level:1,
 enemies:[{
  id:'combat-test-enemy',level:1,rank:'normal' as const,role:'melee' as const,
  maxHp:100,maxMp:0,attack:20,defense:0,magicAttack:10,magicDefense:0,
  movementRangeCells:1,attackRangeCells:1,
 }],
});
const combatTestSkill=(skill_id:number,magic_pattern_id:number)=>({
 skill_id,name:'test skill',mp_cost:20,explanation:'',magic_pattern_id,
});
test('active direction rows only and wrapping',()=>{const a=validateAnimation(anim());assert.equal(frameIndex(a,7,3),15);assert.equal(frameIndex(a,0,-1),1);});
test('rejects out-of-bounds frame',()=>{const a=anim();a.directions[3][1]=16;assert.throws(()=>validateAnimation(a));});
test('rejects stale slots accidentally appended',()=>{const a=anim();a.directions[0].push(999999);assert.throws(()=>validateAnimation(a));});
test('rejects empty action and non-finite timing',()=>{assert.throws(()=>validateAnimation({...anim(),frames_per_direction:0}));assert.throws(()=>validateAnimation({...anim(),raw_timing:NaN}));});
test('bounds stay signed, right and bottom exclusive',()=>{const a=validateAnimation(anim());assert.equal(a.frame_bounds[0].right-a.frame_bounds[0].left,24);const b=anim();b.frame_bounds[0].bottom=-42;assert.throws(()=>validateAnimation(b));});
test('clock deterministic across steps',()=>{let s={cursor:0,elapsed:0};for(let i=0;i<100;i++)s=advanceClock(s.cursor,s.elapsed,10,160,4);assert.deepEqual(s,advanceClock(0,0,1000,160,4));});
test('invalid duration fails closed',()=>assert.throws(()=>advanceClock(0,0,10,0,4)));
test('path traversal and remote assets blocked',()=>{for(const p of ['../x','/root','https://x','x/%2e%2e','x\\y','x//y'])assert.throws(()=>safePath(p));assert.equal(safePath('characters/B100/00/animation.json'),'characters/B100/00/animation.json');});
test('collision dimensions strict',()=>{validateCollision(grid());assert.throws(()=>validateCollision({...grid(),grid:[1]}));});
test('first-major collision indexing',()=>{assert.equal(rawCell(grid(),[1,0]),1);assert.equal(rawCell(grid(),[0,1]),0);assert.equal(rawCell(grid(),[-1,0]),null);});
test('reference coordinate functions are deliberately not treated as inverses',()=>{const xy=referenceCellToScreen([0,1]);assert.deepEqual(xy,[32,32]);assert.notDeepEqual(referenceScreenToCell(...xy),[0,1]);});
test('negative pixel conversion preserves floor semantics',()=>{assert.deepEqual(referenceScreenToCell(-1,-1),[-1,-1]);});
test('route stays on walkable nodes',()=>{const c=grid(),r=findRoute(c,[0,0],[2,2]);assert.ok(r);assert.deepEqual(r[0],[0,0]);assert.deepEqual(r.at(-1),[2,2]);assert.ok(r.every(n=>rawCell(c,n)===1));});
test('blocked and unreachable paths rejected',()=>{assert.equal(findRoute(grid(),[0,0],[0,1]),null);const c=grid();c.grid=[1,0,0,0,0,0,0,0,1];assert.equal(findRoute(c,[0,0],[2,2]),null);});
test('nearest walkable is deterministic',()=>assert.deepEqual(closestWalkable(grid(),[2,0]),[1,0]));
test('direction ordering matches observed character rows',()=>{assert.equal(directionFor(0,1),0);assert.equal(directionFor(1,0),6);assert.equal(directionFor(0,-1),4);assert.equal(directionFor(-1,0),2);});
test('attack rejected outside battle',()=>assert.equal(useAttack(initialState(),'x',0,0,null).ok,false));
test('basic attack subtracts four readiness and blocks button-spam until full',()=>{const s=beginBattle(0,0);assert.equal(s.action,20);assert.ok(useAttack(s,'dummy-melee',0,0,null).ok);assert.equal(s.action,16);const hp=s.enemies[0].hp;assert.equal(useAttack(s,'dummy-melee',0,0,null).ok,false);assert.equal(s.enemies[0].hp,hp);advanceBattle(s,2000);assert.equal(s.action,20);});
test('mana failure is atomic',()=>{const s=beginBattle(0,0);s.mp=1;const before=JSON.stringify(s);assert.equal(useAttack(s,'dummy-melee',0,0,{skill_id:1101,name:'hit',mp_cost:25,explanation:'',magic_pattern_id:1}).ok,false);assert.equal(JSON.stringify(s),before);});
test('invalid action parameters are atomic',()=>{const s=beginBattle(0,0);const before=JSON.stringify(s);assert.equal(useAttack(s,'dummy-melee',0,0,null,Number.NaN).ok,false);assert.equal(JSON.stringify(s),before);assert.equal(useAttack(s,'dummy-melee',0,0,null,-1).ok,false);assert.equal(JSON.stringify(s),before);});
test('out-of-range attack cannot damage target',()=>{const s=beginBattle(0,0);assert.equal(useAttack(s,'dummy-ranged',0,0,null).ok,false);assert.equal(s.enemies[1].hp,90);});
test('each of the six skill branches can execute and spends recovered magic readiness',()=>{for(const skill_id of [1101,1201,1301,19101,19201,19301]){const s=beginBattle(0,0);assert.ok(useAttack(s,'dummy-melee',0,0,{skill_id,name:'skill',mp_cost:20,explanation:'',magic_pattern_id:1}).ok);assert.equal(s.mp,80);assert.equal(s.action,10);}});
test('shield reduces one enemy interval deterministically',()=>{const s=beginBattle(0,0);assert.ok(useAttack(s,'dummy-melee',0,0,{skill_id:1301,name:'shield',mp_cost:20,explanation:'',magic_pattern_id:3}).ok);advanceBattle(s,1600);assert.equal(s.hp,118);assert.ok(s.shield>0);});
test('blind reduces only the selected enemy damage',()=>{const s=beginBattle(0,0);assert.ok(useAttack(s,'dummy-melee',0,0,{skill_id:19101,name:'blind',mp_cost:20,explanation:'',magic_pattern_id:181}).ok);advanceBattle(s,1600);assert.equal(s.hp,114.5);assert.ok(s.enemies[0].blind>0);});
test('19101 suppresses direct damage while retaining the battle blind debuff',()=>{
 const blinded=reconstructionCombatBattle();
 const blindTarget=blinded.enemies[0]!;
 const targetHp=blindTarget.hp;
 assert.ok(useAttack(blinded,blindTarget.id,0,0,combatTestSkill(19101,181)).ok);
 assert.equal(blindTarget.hp,targetHp,'19101 must not subtract direct damage');
 assert.ok(blindTarget.blind>0,'19101 must still apply blind');

 const unblinded=reconstructionCombatBattle();
 const controlTarget=unblinded.enemies[0]!;
 controlTarget.action=unblinded.actionMax;
 unblinded.rngState=3226847457;
 const controlHp=unblinded.hp;
 updateBattle(unblinded,1,0,0);
 assert.ok(unblinded.hp<controlHp,'the same ~0.8 roll hits without blind');

 blindTarget.action=blinded.actionMax;
 blinded.rngState=3226847457;
 const blindedPlayerHp=blinded.hp;
 updateBattle(blinded,1,0,0);
 assert.equal(blinded.hp,blindedPlayerHp,'the same roll misses after the -0.15 blind modifier');
 assert.ok(blindTarget.blind>0,'blind remains active while the enemy attack is resolved');
});
test('19201 retains direct damage and periodic poison ticks in the combat-stat battle path',()=>{
 const s=reconstructionCombatBattle();
 const target=s.enemies[0]!;
 const initialHp=target.hp;
 assert.ok(useAttack(s,target.id,0,0,combatTestSkill(19201,182)).ok);
 const afterCastHp=target.hp;
 assert.ok(afterCastHp<initialHp,'poison mist must keep its direct hit');
 assert.equal(target.poisonTicks,3);
 assert.ok(target.poisonTickDamage>0);
 advanceBattle(s,1000);
 assert.equal(target.poisonTicks,2);
 assert.ok(target.hp<afterCastHp,'poison tick must continue to deal damage');
});
test('mana buff returns mana on a later damaging attack after ten readiness ticks',()=>{const s=beginBattle(0,0);assert.ok(useAttack(s,'dummy-melee',0,0,{skill_id:19301,name:'mana',mp_cost:20,explanation:'',magic_pattern_id:183}).ok);assert.equal(s.mp,80);advanceBattle(s,5000);assert.ok(useAttack(s,'dummy-melee',0,0,null).ok);assert.equal(s.mp,86);});
test('victory awarded once',()=>{const s=beginBattle(0,0);s.enemies[0].hp=1;s.enemies[1].hp=0;useAttack(s,'dummy-melee',0,0,null);assert.equal(s.phase,'won');assert.equal(s.reward,10);for(let i=0;i<20;i++)updateBattle(s,100,0,0);assert.equal(s.reward,10);assert.equal(useAttack(s,'dummy-melee',0,0,null).ok,false);});
test('poison, defeat and terminal state are bounded',()=>{const s=beginBattle(0,0);s.hp=1;advanceBattle(s,2000);assert.equal(s.phase,'lost');assert.ok(s.hp>=0);const before=JSON.stringify(s);assert.equal(useAttack(s,'dummy-melee',0,0,null).ok,false);assert.equal(JSON.stringify(s),before);});
const save=()=>({version:1,pack:'pack',character:'100',x:32,y:32,gold:0,savedAt:'2026-09-15T00:00:00Z'});
test('save round trip validates',()=>assert.equal(validateSave(JSON.parse(JSON.stringify(save())),'pack',['100'],100,100).x,32));
test('save rejects foreign pack, unknown version and NaN',()=>{for(const patch of [{pack:'other'},{version:2},{x:NaN},{gold:-1},{character:'199'},{savedAt:'bad'}])assert.throws(()=>validateSave({...save(),...patch},'pack',['100'],100,100));});
test('roundtrip holds on even-parity cell lattice',()=>{for(let x=0;x<47;x++)for(let y=0;y<47;y++)if((x+y)%2===0)assert.deepEqual(referenceScreenToCell(...referenceCellToScreen([x,y])),[x,y]);});

const manifestWithMapCount=(count:number)=>{
 const map=(id:number)=>({id,name:'map-'+id,png:'maps/map-'+id+'.png',collision:'maps/map-'+id+'-collision.json',render:{width:1,height:1}});
 const actions=Object.fromEntries(['00','01','02'].map(slot=>[slot,{animation:'characters/B100/'+slot+'/animation.json',frames_dir:'characters/B100/'+slot+'/frames'}]));
 const maps=Object.fromEntries(Array.from({length:count},(_,id)=>[String(id),map(id)]));
 return {schema:1,map:map(0),maps,characters:{'100':{class_id:100,actions}}};
};
test('manifest accepts 21 maps after Chapter 1 expansion',()=>assert.equal(Object.keys(validateManifest(manifestWithMapCount(21)).maps??{}).length,21));
test('manifest rejects 25 maps after Chapter 1 expansion',()=>assert.throws(()=>validateManifest(manifestWithMapCount(25)),/Invalid map count/));
