import test from 'node:test';
import assert from 'node:assert/strict';
import {worldGuideLabelVisibleInView,worldVisualVisibleInView} from '../src/world/battle-view-visibility.ts';
import {CH1_GIO_TEACHER_CANDIDATE,CH1_GIO_TEACHER_ENTITY} from '../src/world/ch1-world-authority.ts';

test('Chapter 1 NPC 21003 and the fallback guide label stay hidden during battle-view transition',()=>{
  const teacherMapId=CH1_GIO_TEACHER_ENTITY.mapId;
  assert.equal(CH1_GIO_TEACHER_CANDIDATE.candidateEntityId,21003);
  assert.equal(CH1_GIO_TEACHER_ENTITY.id,'ch1-npc-21003');
  assert.equal(worldVisualVisibleInView(true,1,teacherMapId),false);
  assert.equal(worldGuideLabelVisibleInView(true,0),false);
  assert.equal(worldVisualVisibleInView(false,teacherMapId,teacherMapId),true);
  assert.equal(worldVisualVisibleInView(false,1060,teacherMapId),false);
  assert.equal(worldGuideLabelVisibleInView(false,0),true);
  assert.equal(worldGuideLabelVisibleInView(false,1),false);
});
