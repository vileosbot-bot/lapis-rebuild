import {NPC_PLACEMENT_POLICY} from '../../../data/ch1-world-catalog/npc-placement-policy.ts';
import type {QuestPolicyChainRecord} from '../../../data/ch1-world-catalog/quest-policy.ts';
import type {NpcVisualBinding} from '../npc/npc-visual-catalog.ts';
import {canInteract} from './world-model.ts';
import type {WorldEntity,WorldState} from './world-model.ts';

export const CH1_GIO_TEACHER_CANDIDATE = Object.freeze({
  candidateEntityId:21003,
  sourceMapId:'map:old:1000',
  mapWire:1000,
  displayName:'吉奥老师',
  sourceModelResourceId:5056,
  cell:[32,72] as const,
  role:'quest1-companion-giver',
  questSemantic:'quest1-actor100-companion-recruitment',
  sourceArtifact:NPC_PLACEMENT_POLICY.sourceArtifact,
  sourceLocator:'ybcs_offline_npc_placements.py:L208-L217',
  sourceSha256:NPC_PLACEMENT_POLICY.sourceSha256,
  evidenceLevel:'RECOVERED_SECONDARY' as const,
  runtimeVerified:false as const,
});

// Interaction radius 2 is a reconstruction UX choice; the recovered placement candidate does not declare a radius.
export const CH1_GIO_TEACHER_ENTITY:WorldEntity=Object.freeze({
  id:'ch1-npc-21003',
  kind:'npc',
  mapId:1000,
  x:32,
  y:72,
  displayName:'吉奥老师',
  interactionRadius:2,
  provenance:'RECONSTRUCTION_POLICY',
});

export type Ch1NpcVisualBinding=NpcVisualBinding&Readonly<{
  sourceModelResourceId:number;
  proxyResourceId:number;
}>;

export const CH1_GIO_TEACHER_VISUAL_BINDING:Ch1NpcVisualBinding=Object.freeze({
  worldEntityKey:CH1_GIO_TEACHER_ENTITY.id,
  visualId:'ch1-gio-teacher-proxy',
  sourceModelResourceId:5056,
  proxyResourceId:4524,
  provenance:{
    source:'Owner-approved B3 R2 visual substitution: source model 5056 uses B4524 as its presentation proxy',
    evidence:'RECONSTRUCTION_POLICY' as const,
    note:'The proxy is a presentation-only choice and does not establish a retail NPC identity or Actor-to-Entity mapping.',
  },
});

export const CH1_GIO_TEACHER_VISUAL_PLACEMENT=Object.freeze({
  id:CH1_GIO_TEACHER_ENTITY.id,
  kind:'npc' as const,
  mapId:CH1_GIO_TEACHER_ENTITY.mapId,
  cell:[CH1_GIO_TEACHER_ENTITY.x,CH1_GIO_TEACHER_ENTITY.y] as const,
  resourceId:CH1_GIO_TEACHER_VISUAL_BINDING.proxyResourceId,
  label:CH1_GIO_TEACHER_ENTITY.displayName,
  provenance:'RECONSTRUCTION_POLICY' as const,
  visualBinding:CH1_GIO_TEACHER_VISUAL_BINDING,
});

export const CH1_QUEST1_SELECT_RECORD:QuestPolicyChainRecord=Object.freeze({
  recordId:'quest1-early:accept',
  chainId:'quest1-early',
  questId:1,
  questIdSemantics:'QuestN filename number only; not a recovered server-internal quest ID',
  stage:'accept',
  stageOrder:1,
  marker:'SELECT',
  step:1,
  actorOrMarker:'100',
  actorTokenSemantics:'原始Quest脚本NAME后的ACTOR token；未映射为NPC模板ID或NPC实体ID',
  lineStart:20,
  lineEnd:22,
  evidence:'E2/old-parser+E3/old-resource',
  serverBoundary:'client-dialogue',
  notes:'STEP 1 SELECT marker is present. Preserve the marker-local raw Actor token dynamically; this does not establish server acceptance or an NPC identity.',
  sourceReference:Object.freeze({
    sourceArtifact:'Quest.lib',
    sourceMember:'Quest1.TXT',
    archiveMemberOffset:8956,
    sourceHash:'23fa524844be0c553c55e66e071e3c9190337d92b19745f242580008a63e7397',
    s4ExportPath:'docs/integration-notes/s4-quest-recruit-data.json',
    s4ExportBlobSha:'5621cdee4a020c8648add1d82f26247a0c064374',
    s4JsonPointer:'questScripts[0].recruitmentEvidence.selectionBranch',
    sourceLineRange:[20,22] as const,
  }),
  evidenceLevel:'RECOVERED_SECONDARY',
  runtimeVerified:false,
});

export const CH1_QUEST1_SELECT_TEXT_LINES=Object.freeze([
  '您好. 早就久仰大名. 我一直盼着与您这样的勇士合作共同打退泊罗斯. 请接受我',
] as const);

export const CH1_QUEST1_SELECT=Object.freeze({
  record:CH1_QUEST1_SELECT_RECORD,
  textLines:CH1_QUEST1_SELECT_TEXT_LINES,
});

export type Ch1Quest1SelectionStatus='not-recorded'|'recorded';
export type Ch1Quest1SelectionState=Readonly<{
  recordId:typeof CH1_QUEST1_SELECT_RECORD.recordId;
  questFileNumber:1;
  marker:'SELECT';
  step:1;
  actorToken:string;
  selectionStatus:Ch1Quest1SelectionStatus;
  serverAcceptance:'not-asserted';
  recruitment:'not-implemented';
  reward:'not-recovered';
  persistence:'transient-only';
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
  provenance:'RECONSTRUCTION_POLICY';
}>;

export function initialCh1Quest1SelectionState():Ch1Quest1SelectionState{
  return Object.freeze({
    recordId:CH1_QUEST1_SELECT_RECORD.recordId,
    questFileNumber:1,
    marker:'SELECT',
    step:1,
    actorToken:CH1_QUEST1_SELECT_RECORD.actorOrMarker,
    selectionStatus:'not-recorded',
    serverAcceptance:'not-asserted',
    recruitment:'not-implemented',
    reward:'not-recovered',
    persistence:'transient-only',
    evidenceLevel:'RECOVERED_SECONDARY',
    runtimeVerified:false,
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export type Ch1NpcInputSource='pointer'|'keyboard';
export type Ch1NpcInteractionIntent=Readonly<{
  entityId:string;
  mapId:number;
  actorX:number;
  actorY:number;
  inputSource:Ch1NpcInputSource;
  provenance:string;
}>;

export type Ch1NpcDialogueChoice=Readonly<{
  id:'record-selection';
  label:'记录选择';
  enabled:true;
  provenance:'RECONSTRUCTION_POLICY';
}>;

export type Ch1NpcDialogueSession=Readonly<{
  kind:'ch1-quest1-select';
  sessionId:string;
  entityId:string;
  mapId:number;
  actorCell:readonly [number,number];
  inputSource:Ch1NpcInputSource;
  recordId:typeof CH1_QUEST1_SELECT_RECORD.recordId;
  actorToken:string;
  view:Readonly<{
    speaker:string;
    lines:readonly string[];
    marker:'SELECT';
    step:1;
    actorToken:string;
    choices:readonly Ch1NpcDialogueChoice[];
    provenance:'RECONSTRUCTION_POLICY';
  }>;
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
  provenance:'RECONSTRUCTION_POLICY';
}>;

export type Ch1NpcInteractionRejectReason=
  |'unsupported-provenance'
  |'entity-mismatch'
  |'map-mismatch'
  |'actor-state-mismatch'
  |'out-of-range'
  |'stale-dialogue'
  |'already-recorded';

export type Ch1BeginNpcInteractionResult=
  |{accepted:true;state:Ch1Quest1SelectionState;session:Ch1NpcDialogueSession;provenance:'RECONSTRUCTION_POLICY'}
  |{accepted:false;state:Ch1Quest1SelectionState;reason:Ch1NpcInteractionRejectReason;provenance:'RECONSTRUCTION_POLICY'};

export type Ch1RecordSelectionResult=
  |{accepted:true;state:Ch1Quest1SelectionState;changed:true;action:'selection-recorded';provenance:'RECONSTRUCTION_POLICY'}
  |{accepted:false;state:Ch1Quest1SelectionState;changed:false;reason:Ch1NpcInteractionRejectReason;provenance:'RECONSTRUCTION_POLICY'};

const SELECT_CHOICE:Ch1NpcDialogueChoice=Object.freeze({
  id:'record-selection',
  label:'记录选择',
  enabled:true,
  provenance:'RECONSTRUCTION_POLICY',
});

function rejectBegin(
  state:Ch1Quest1SelectionState,
  reason:Ch1NpcInteractionRejectReason,
):Ch1BeginNpcInteractionResult{
  return{accepted:false,state,reason,provenance:'RECONSTRUCTION_POLICY'};
}

function rejectSelection(
  state:Ch1Quest1SelectionState,
  reason:Ch1NpcInteractionRejectReason,
):Ch1RecordSelectionResult{
  return{accepted:false,state,changed:false,reason,provenance:'RECONSTRUCTION_POLICY'};
}

/**
 * Chapter 1's narrow NPC/Quest1 boundary.
 *
 * This authority records only the local SELECT choice. It deliberately does
 * not execute SCRIPT/CANCEL, infer server acceptance, recruit a companion,
 * award a reward, or write the selection into SaveV2.
 */
export class Ch1WorldAuthority{
  readonly npc=CH1_GIO_TEACHER_ENTITY;
  readonly visualBinding=CH1_GIO_TEACHER_VISUAL_BINDING;

  initialQuest1State():Ch1Quest1SelectionState{
    return initialCh1Quest1SelectionState();
  }

  beginNpcInteraction(
    state:Ch1Quest1SelectionState,
    world:WorldState,
    intent:Ch1NpcInteractionIntent,
  ):Ch1BeginNpcInteractionResult{
    if(intent.provenance!=='RECONSTRUCTION_POLICY')return rejectBegin(state,'unsupported-provenance');
    if(intent.entityId!==this.npc.id)return rejectBegin(state,'entity-mismatch');
    if(intent.mapId!==world.mapId||world.mapId!==this.npc.mapId)return rejectBegin(state,'map-mismatch');
    if(intent.actorX!==world.x||intent.actorY!==world.y)return rejectBegin(state,'actor-state-mismatch');
    if(!canInteract(this.npc,world))return rejectBegin(state,'out-of-range');

    const actorCell=[world.x,world.y] as const;
    const session:Ch1NpcDialogueSession=Object.freeze({
      kind:'ch1-quest1-select',
      sessionId:this.npc.id+':'+CH1_QUEST1_SELECT_RECORD.recordId+':'+world.mapId+':'+world.x+':'+world.y,
      entityId:this.npc.id,
      mapId:world.mapId,
      actorCell,
      inputSource:intent.inputSource,
      recordId:CH1_QUEST1_SELECT_RECORD.recordId,
      actorToken:CH1_QUEST1_SELECT_RECORD.actorOrMarker,
      view:Object.freeze({
        speaker:this.npc.displayName,
        lines:CH1_QUEST1_SELECT_TEXT_LINES,
        marker:'SELECT',
        step:1,
        actorToken:CH1_QUEST1_SELECT_RECORD.actorOrMarker,
        choices:Object.freeze([SELECT_CHOICE]),
        provenance:'RECONSTRUCTION_POLICY',
      }),
      evidenceLevel:'RECOVERED_SECONDARY',
      runtimeVerified:false,
      provenance:'RECONSTRUCTION_POLICY',
    });
    return{accepted:true,state,session,provenance:'RECONSTRUCTION_POLICY'};
  }

  recordQuest1Selection(
    state:Ch1Quest1SelectionState,
    world:WorldState,
    session:Ch1NpcDialogueSession,
  ):Ch1RecordSelectionResult{
    if(session.provenance!=='RECONSTRUCTION_POLICY')return rejectSelection(state,'unsupported-provenance');
    if(session.entityId!==this.npc.id||session.recordId!==CH1_QUEST1_SELECT_RECORD.recordId)return rejectSelection(state,'entity-mismatch');
    if(session.actorToken!==CH1_QUEST1_SELECT_RECORD.actorOrMarker)return rejectSelection(state,'entity-mismatch');
    if(session.mapId!==world.mapId||world.x!==session.actorCell[0]||world.y!==session.actorCell[1])return rejectSelection(state,'stale-dialogue');
    if(!canInteract(this.npc,world))return rejectSelection(state,'out-of-range');
    if(state.selectionStatus==='recorded')return rejectSelection(state,'already-recorded');

    const next:Ch1Quest1SelectionState=Object.freeze({
      ...state,
      selectionStatus:'recorded',
    });
    return{accepted:true,state:next,changed:true,action:'selection-recorded',provenance:'RECONSTRUCTION_POLICY'};
  }
}
