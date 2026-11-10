import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  CH1_GIO_TEACHER_CANDIDATE,
  CH1_GIO_TEACHER_ENTITY,
  CH1_GIO_TEACHER_VISUAL_BINDING,
  CH1_GIO_TEACHER_VISUAL_PLACEMENT,
  CH1_QUEST1_SELECT_RECORD,
  CH1_QUEST1_SELECT_TEXT_LINES,
  Ch1WorldAuthority,
} from '../src/world/ch1-world-authority.ts';
import {NPC_PLACEMENT_POLICY} from '../../data/ch1-world-catalog/npc-placement-policy.ts';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');

function interaction(
  entityId=CH1_GIO_TEACHER_ENTITY.id,
  world={mapId:1000,x:32,y:72},
  inputSource:'pointer'|'keyboard'='pointer',
  provenance='RECONSTRUCTION_POLICY',
){
  return{
    entityId,
    mapId:world.mapId,
    actorX:world.x,
    actorY:world.y,
    inputSource,
    provenance,
  };
}

test('B3 NPC 21003 placement candidate is kept separate from its reconstruction world entity',()=>{
  const candidates=JSON.parse(readFileSync(resolve(root,'data/ch1-world-catalog/npc-placement-candidates.json'),'utf8'));
  const source=candidates.records.find((row:{entity_id:number})=>row.entity_id===21003);
  assert.ok(source);
  assert.equal(source.map_id,'map:old:1000');
  assert.equal(source.map_wire,1000);
  assert.equal(source.name,'吉奥老师');
  assert.equal(source.model_id,5056);
  assert.deepEqual([source.first,source.second],[32,72]);
  assert.equal(source.role,'quest1-companion-giver');
  assert.equal(source.source_reference,'ybcs_offline_npc_placements.py:L208-L217');
  assert.equal(source.evidenceLevel,'RECOVERED_SECONDARY');
  assert.equal(source.runtimeVerified,false);
  assert.equal(CH1_GIO_TEACHER_CANDIDATE.candidateEntityId,source.entity_id);
  assert.equal(CH1_GIO_TEACHER_CANDIDATE.sourceSha256,NPC_PLACEMENT_POLICY.sourceSha256);
  assert.deepEqual([CH1_GIO_TEACHER_ENTITY.mapId,CH1_GIO_TEACHER_ENTITY.x,CH1_GIO_TEACHER_ENTITY.y],[1000,32,72]);
  assert.equal(CH1_GIO_TEACHER_ENTITY.interactionRadius,2);
  assert.equal(CH1_GIO_TEACHER_ENTITY.provenance,'RECONSTRUCTION_POLICY');
  assert.notEqual(CH1_GIO_TEACHER_ENTITY.id,String(CH1_GIO_TEACHER_CANDIDATE.candidateEntityId));
});

test('B3 visual proxy 4524 is explicitly bound as reconstruction, not original identity',()=>{
  assert.equal(CH1_GIO_TEACHER_VISUAL_BINDING.worldEntityKey,CH1_GIO_TEACHER_ENTITY.id);
  assert.equal(CH1_GIO_TEACHER_VISUAL_BINDING.sourceModelResourceId,5056);
  assert.equal(CH1_GIO_TEACHER_VISUAL_BINDING.proxyResourceId,4524);
  assert.equal(CH1_GIO_TEACHER_VISUAL_BINDING.provenance.evidence,'RECONSTRUCTION_POLICY');
  assert.match(CH1_GIO_TEACHER_VISUAL_BINDING.provenance.note,/does not establish a retail NPC identity/);
  assert.deepEqual(
    {id:CH1_GIO_TEACHER_VISUAL_PLACEMENT.id,mapId:CH1_GIO_TEACHER_VISUAL_PLACEMENT.mapId,cell:CH1_GIO_TEACHER_VISUAL_PLACEMENT.cell,resourceId:CH1_GIO_TEACHER_VISUAL_PLACEMENT.resourceId,kind:CH1_GIO_TEACHER_VISUAL_PLACEMENT.kind},
    {id:'ch1-npc-21003',mapId:1000,cell:[32,72],resourceId:4524,kind:'npc'},
  );
});

test('B3 Quest1 SELECT record exactly matches the B6 policy row and preserves Actor token 100',()=>{
  const policy=JSON.parse(readFileSync(resolve(root,'data/ch1-world-catalog/quest-policy.json'),'utf8'));
  const row=policy.chainRecords.find((entry:{recordId:string})=>entry.recordId==='quest1-early:accept');
  assert.ok(row);
  assert.deepEqual(row,CH1_QUEST1_SELECT_RECORD);
  assert.equal(row.marker,'SELECT');
  assert.equal(row.step,1);
  assert.equal(row.actorOrMarker,'100');
  assert.equal(row.lineStart,20);
  assert.equal(row.lineEnd,22);
  assert.equal(row.evidenceLevel,'RECOVERED_SECONDARY');
  assert.equal(row.runtimeVerified,false);

  const source=JSON.parse(readFileSync(resolve(root,'docs/integration-notes/s4-quest-recruit-data.json'),'utf8'));
  const quest1=source.questScripts.find((entry:{scriptNumber:number})=>entry.scriptNumber===1);
  assert.ok(quest1);
  const actor=quest1.commands.find((entry:{kind:string;line:number})=>entry.kind==='ACTOR'&&entry.line===19);
  const select=quest1.commands.find((entry:{kind:string;line:number})=>entry.kind==='SELECT'&&entry.line===20);
  const text=quest1.commands.find((entry:{kind:string;line:number})=>entry.kind==='TEXT'&&entry.line===21);
  assert.equal(actor.actor,'100');
  assert.equal(select.kind,'SELECT');
  assert.equal(text.text,CH1_QUEST1_SELECT_TEXT_LINES[0]);
  assert.equal(quest1.commands.some((entry:{line:number})=>entry.line===22),false);
  assert.notEqual(CH1_GIO_TEACHER_ENTITY.id,row.actorOrMarker);
});

test('B3 pointer and keyboard open the same one-step SELECT dialogue without advancing state',()=>{
  const authority=new Ch1WorldAuthority();
  const initial=authority.initialQuest1State();
  const world={mapId:1000,x:32,y:72};
  for(const source of ['pointer','keyboard'] as const){
    const result=authority.beginNpcInteraction(initial,world,interaction(CH1_GIO_TEACHER_ENTITY.id,world,source));
    assert.equal(result.accepted,true,source);
    if(!result.accepted)assert.fail(result.reason);
    assert.deepEqual(result.state,initial);
    assert.equal(result.session.entityId,CH1_GIO_TEACHER_ENTITY.id);
    assert.equal(result.session.inputSource,source);
    assert.equal(result.session.view.speaker,'吉奥老师');
    assert.equal(result.session.view.marker,'SELECT');
    assert.equal(result.session.view.step,1);
    assert.equal(result.session.view.actorToken,'100');
    assert.deepEqual(result.session.view.lines,CH1_QUEST1_SELECT_TEXT_LINES);
    assert.deepEqual(result.session.view.choices.map(choice=>choice.id),['record-selection']);
    assert.equal(result.session.evidenceLevel,'RECOVERED_SECONDARY');
    assert.equal(result.session.runtimeVerified,false);
  }
});

test('B3 NPC interaction rejects wrong entity, map, stale actor, unsupported provenance, and out-of-range input',()=>{
  const authority=new Ch1WorldAuthority();
  const initial=authority.initialQuest1State();
  const world={mapId:1000,x:32,y:72};

  assert.equal(authority.beginNpcInteraction(initial,world,interaction('21003',world)).accepted,false);
  assert.equal(authority.beginNpcInteraction(initial,{mapId:1020,x:32,y:72},interaction(CH1_GIO_TEACHER_ENTITY.id,{mapId:1020,x:32,y:72})).accepted,false);

  const stale=authority.beginNpcInteraction(initial,world,{
    ...interaction(CH1_GIO_TEACHER_ENTITY.id,world),
    actorX:31,
  });
  assert.equal(stale.accepted,false);
  if(!stale.accepted)assert.equal(stale.reason,'actor-state-mismatch');

  const unsupported=authority.beginNpcInteraction(initial,world,interaction(
    CH1_GIO_TEACHER_ENTITY.id,world,'pointer','VERIFIED',
  ));
  assert.equal(unsupported.accepted,false);
  if(!unsupported.accepted)assert.equal(unsupported.reason,'unsupported-provenance');

  const farWorld={mapId:1000,x:29,y:72};
  const far=authority.beginNpcInteraction(initial,farWorld,interaction(CH1_GIO_TEACHER_ENTITY.id,farWorld));
  assert.equal(far.accepted,false);
  if(!far.accepted)assert.equal(far.reason,'out-of-range');
});

test('B3 selection records only transient SELECT state; it does not claim acceptance, recruitment, reward, or save',()=>{
  const authority=new Ch1WorldAuthority();
  const initial=authority.initialQuest1State();
  const world={mapId:1000,x:32,y:72};
  const begun=authority.beginNpcInteraction(initial,world,interaction(CH1_GIO_TEACHER_ENTITY.id,world));
  assert.equal(begun.accepted,true);
  if(!begun.accepted)assert.fail(begun.reason);

  const selected=authority.recordQuest1Selection(initial,world,begun.session);
  assert.equal(selected.accepted,true);
  if(!selected.accepted)assert.fail(selected.reason);
  assert.equal(selected.changed,true);
  assert.equal(selected.action,'selection-recorded');
  assert.equal(selected.state.selectionStatus,'recorded');
  assert.equal(selected.state.actorToken,'100');
  assert.equal(selected.state.serverAcceptance,'not-asserted');
  assert.equal(selected.state.recruitment,'not-implemented');
  assert.equal(selected.state.reward,'not-recovered');
  assert.equal(selected.state.persistence,'transient-only');
  assert.equal(selected.state.evidenceLevel,'RECOVERED_SECONDARY');
  assert.equal(selected.state.runtimeVerified,false);

  const repeated=authority.recordQuest1Selection(selected.state,world,begun.session);
  assert.equal(repeated.accepted,false);
  if(!repeated.accepted)assert.equal(repeated.reason,'already-recorded');

  const stale=authority.recordQuest1Selection(initial,{mapId:1000,x:31,y:72},begun.session);
  assert.equal(stale.accepted,false);
  if(!stale.accepted)assert.equal(stale.reason,'stale-dialogue');
});
