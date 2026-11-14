import type {Cell} from '../coordinates.ts';
import {
  CH1_WILD_ENCOUNTERS,
  ch1WildEncounterById,
  manhattanDistance,
} from './ch1-wild-encounter-catalog.ts';
import type {Ch1WildEncounterRecord} from './ch1-wild-encounter-catalog.ts';

export type Ch1WildEncounterState=Readonly<{
  schema:1;
  spawnGeneration:number;
  defeatedEntityIds:readonly number[];
  suppressedEntityId:number|null;
  refreshOnNextEntry:boolean;
  provenance:'RECONSTRUCTION_POLICY';
}>;

export type Ch1WildEncounterStatus=
  |'wrong-map'
  |'no-candidate'
  |'ambiguous'
  |'level-too-low'
  |'suppressed-until-leave'
  |'eligible';

export type Ch1WildEncounterCandidate=Readonly<{
  record:Ch1WildEncounterRecord;
  distance:number;
}>;

export type Ch1WildEncounterResolution=Readonly<{
  status:Ch1WildEncounterStatus;
  candidates:readonly Ch1WildEncounterCandidate[];
  candidate:Ch1WildEncounterRecord|null;
  distance:number|null;
  provenance:'RECONSTRUCTION_POLICY';
}>;

const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max:number):value is number=>Number.isInteger(value)&&(value as number)>=min&&(value as number)<=max;
const knownIds=new Set(CH1_WILD_ENCOUNTERS.map(row=>row.entityId));
const stateKeys=['schema','spawnGeneration','defeatedEntityIds','suppressedEntityId','refreshOnNextEntry','provenance'] as const;

export function createCh1WildEncounterState():Ch1WildEncounterState{
  return Object.freeze({
    schema:1,
    spawnGeneration:1,
    defeatedEntityIds:Object.freeze([] as number[]),
    suppressedEntityId:null,
    refreshOnNextEntry:false,
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function validateCh1WildEncounterState(raw:unknown):Ch1WildEncounterState{
  if(!isObject(raw)||Object.keys(raw).sort().join('|')!==[...stateKeys].sort().join('|'))throw new Error('Invalid Chapter 1 wild encounter save state shape');
  if(raw.schema!==1||!integer(raw.spawnGeneration,1,Number.MAX_SAFE_INTEGER))throw new Error('Invalid Chapter 1 wild spawn generation');
  if(!Array.isArray(raw.defeatedEntityIds)||raw.defeatedEntityIds.length>CH1_WILD_ENCOUNTERS.length)throw new Error('Invalid defeated wild entity IDs');
  const defeated=raw.defeatedEntityIds;
  if(!defeated.every(id=>integer(id,1,0xffff)&&knownIds.has(id))||new Set(defeated).size!==defeated.length)throw new Error('Unknown or duplicate defeated wild entity ID');
  if(raw.suppressedEntityId!==null&&(!integer(raw.suppressedEntityId,1,0xffff)||!knownIds.has(raw.suppressedEntityId)))throw new Error('Unknown suppressed wild entity ID');
  if(typeof raw.refreshOnNextEntry!=='boolean'||raw.provenance!=='RECONSTRUCTION_POLICY')throw new Error('Invalid Chapter 1 wild encounter state policy');
  return Object.freeze({
    schema:1,
    spawnGeneration:raw.spawnGeneration,
    defeatedEntityIds:Object.freeze([...defeated] as number[]),
    suppressedEntityId:raw.suppressedEntityId as number|null,
    refreshOnNextEntry:raw.refreshOnNextEntry,
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function markCh1WildMapLeft(state:Ch1WildEncounterState):Ch1WildEncounterState{
  return Object.freeze({...state,refreshOnNextEntry:true,provenance:'RECONSTRUCTION_POLICY'});
}

export function markCh1WildMapEntered(state:Ch1WildEncounterState):Ch1WildEncounterState{
  if(!state.refreshOnNextEntry)return state;
  if(state.spawnGeneration>=Number.MAX_SAFE_INTEGER)throw new Error('Chapter 1 wild spawn generation exhausted');
  return Object.freeze({
    schema:1,
    spawnGeneration:state.spawnGeneration+1,
    defeatedEntityIds:Object.freeze([] as number[]),
    suppressedEntityId:null,
    refreshOnNextEntry:false,
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function markCh1WildEncounterDefeated(
  state:Ch1WildEncounterState,
  entityId:number,
  expectedGeneration=state.spawnGeneration,
):Ch1WildEncounterState{
  if(expectedGeneration!==state.spawnGeneration)throw new Error('Stale Chapter 1 wild battle generation');
  if(!knownIds.has(entityId))throw new Error('Unknown Chapter 1 wild entity ID');
  if(state.defeatedEntityIds.includes(entityId))return state;
  return Object.freeze({
    ...state,
    defeatedEntityIds:Object.freeze([...state.defeatedEntityIds,entityId].sort((a,b)=>a-b)),
    suppressedEntityId:state.suppressedEntityId===entityId?null:state.suppressedEntityId,
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function suppressCh1WildEncounterUntilLeave(
  state:Ch1WildEncounterState,
  entityId:number,
  expectedGeneration=state.spawnGeneration,
):Ch1WildEncounterState{
  if(expectedGeneration!==state.spawnGeneration)throw new Error('Stale Chapter 1 wild battle generation');
  if(!knownIds.has(entityId))throw new Error('Unknown Chapter 1 wild entity ID');
  return Object.freeze({...state,suppressedEntityId:entityId,provenance:'RECONSTRUCTION_POLICY'});
}

export function clearCh1WildSuppressionAfterLeavingRange(
  state:Ch1WildEncounterState,
  playerCell:Cell,
):Ch1WildEncounterState{
  if(state.suppressedEntityId===null)return state;
  const record=ch1WildEncounterById(state.suppressedEntityId);
  if(!record)throw new Error('Suppressed Chapter 1 wild entity is missing');
  if(manhattanDistance(playerCell,record.cell)<4)return state;
  return Object.freeze({...state,suppressedEntityId:null,provenance:'RECONSTRUCTION_POLICY'});
}

export function resolveCh1WildEncounter(input:Readonly<{
  mapId:number;
  playerCell:Cell;
  playerLevel:number;
  state:Ch1WildEncounterState;
  records?:readonly Ch1WildEncounterRecord[];
}>):Ch1WildEncounterResolution{
  const empty=Object.freeze([] as Ch1WildEncounterCandidate[]);
  const result=(status:Ch1WildEncounterStatus,candidates:readonly Ch1WildEncounterCandidate[],candidate:Ch1WildEncounterRecord|null,distance:number|null):Ch1WildEncounterResolution=>
    Object.freeze({status,candidates,candidate,distance,provenance:'RECONSTRUCTION_POLICY'});
  if(input.mapId!==1020)return result('wrong-map',empty,null,null);
  if(!integer(input.playerLevel,1,100))throw new Error('Invalid player level for Chapter 1 wild encounter');
  const defeated=new Set(input.state.defeatedEntityIds);
  const candidates=(input.records??CH1_WILD_ENCOUNTERS)
    .filter(record=>!defeated.has(record.entityId))
    .map(record=>Object.freeze({record,distance:manhattanDistance(input.playerCell,record.cell)}))
    .filter(row=>row.distance<4)
    .sort((a,b)=>a.distance-b.distance||a.record.entityId-b.record.entityId);
  if(candidates.length===0)return result('no-candidate',empty,null,null);
  if(candidates.length>1)return result('ambiguous',Object.freeze(candidates),null,null);
  const only=candidates[0];
  if(input.state.suppressedEntityId===only.record.entityId)return result('suppressed-until-leave',Object.freeze(candidates),only.record,only.distance);
  if(input.playerLevel<only.record.minimumLevel)return result('level-too-low',Object.freeze(candidates),only.record,only.distance);
  return result('eligible',Object.freeze(candidates),only.record,only.distance);
}
