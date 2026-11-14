import rawCatalog from '../../../data/ch1-world-catalog/wild-encounters-map-1020.json' with {type:'json'};
import type {Cell} from '../coordinates.ts';

export type Ch1WildRewardRecord=Readonly<{
  gold:number;
  exp:number;
  dropItemId:number;
}>;

export type Ch1WildEncounterRecord=Readonly<{
  entityId:number;
  name:string;
  modelId:number;
  entityType:1;
  cell:Cell;
  approachCell:Cell;
  minimumLevel:number;
  minimumLevelProvenance:'RECONSTRUCTION_POLICY';
  maxHp:number;
  maxMp:number;
  reward:Ch1WildRewardRecord;
  provenance:'RECOVERED_SECONDARY';
  runtimeVerified:false;
}>;

export type Ch1WildEncounterCatalog=Readonly<{
  schema:1;
  mapId:1020;
  provenance:'RECOVERED_SECONDARY';
  runtimeVerified:false;
  records:readonly Ch1WildEncounterRecord[];
}>;

const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>{
  const actual=Object.keys(value).sort();
  const expected=[...keys].sort();
  return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);
};
const integer=(value:unknown,min:number,max:number):value is number=>Number.isInteger(value)&&(value as number)>=min&&(value as number)<=max;

function parseCell(value:unknown,label:string):Cell{
  if(!Array.isArray(value)||value.length!==2||!integer(value[0],0,10000)||!integer(value[1],0,10000))throw new Error('Invalid '+label);
  return Object.freeze([value[0],value[1]]) as Cell;
}

function parseRecord(raw:unknown):Ch1WildEncounterRecord{
  if(!isObject(raw)||!exactKeys(raw,[
    'entityId','name','modelId','entityType','cell','approachCell','minimumLevel','minimumLevelProvenance',
    'maxHp','maxMp','reward','provenance','runtimeVerified',
  ]))throw new Error('Invalid Chapter 1 wild encounter record shape');
  if(!integer(raw.entityId,1,0xffff)||typeof raw.name!=='string'||!raw.name.trim())throw new Error('Invalid Chapter 1 wild encounter identity');
  if(!integer(raw.modelId,1,0xffff)||raw.entityType!==1)throw new Error('Invalid Chapter 1 wild encounter model/entity type');
  if(raw.provenance!=='RECOVERED_SECONDARY'||raw.runtimeVerified!==false)throw new Error('Wild placement evidence must remain RECOVERED_SECONDARY');
  if(!integer(raw.minimumLevel,1,100)||raw.minimumLevelProvenance!=='RECONSTRUCTION_POLICY'||!integer(raw.maxHp,1,100000)||!integer(raw.maxMp,0,100000))throw new Error('Invalid Chapter 1 wild encounter stats/evidence');
  const cell=parseCell(raw.cell,'wild encounter cell');
  const approachCell=parseCell(raw.approachCell,'wild encounter approach cell');
  if(approachCell[0]!==cell[0]-1||approachCell[1]!==cell[1]-1)throw new Error('Wild encounter approach cell must be xy minus one');
  if(!isObject(raw.reward)||!exactKeys(raw.reward,['gold','exp','dropItemId']))throw new Error('Invalid Chapter 1 wild reward');
  if(!integer(raw.reward.gold,0,1000000)||!integer(raw.reward.exp,0,1000000)||!integer(raw.reward.dropItemId,0,0xffff))throw new Error('Invalid Chapter 1 wild reward values');
  if(raw.minimumLevel!==1||raw.maxMp!==100||raw.reward.gold!==40||raw.reward.dropItemId!==4002)throw new Error('Unexpected map 1020 placement fields');
  if(raw.modelId===4006&&(raw.name!=='普罗首领B'||raw.maxHp!==150||raw.reward.exp!==150))throw new Error('普罗首领B placement fields drifted');
  if(raw.modelId===4001&&(raw.name!=='雷德普罗'||raw.maxHp!==100||raw.reward.exp!==100))throw new Error('雷德普罗 placement fields drifted');
  if(raw.modelId!==4001&&raw.modelId!==4006)throw new Error('Unexpected map 1020 model ID');
  return Object.freeze({
    entityId:raw.entityId,
    name:raw.name,
    modelId:raw.modelId,
    entityType:1,
    cell,
    approachCell,
    minimumLevel:raw.minimumLevel,
    minimumLevelProvenance:'RECONSTRUCTION_POLICY',
    maxHp:raw.maxHp,
    maxMp:raw.maxMp,
    reward:Object.freeze({gold:raw.reward.gold,exp:raw.reward.exp,dropItemId:raw.reward.dropItemId}),
    provenance:'RECOVERED_SECONDARY',
    runtimeVerified:false,
  });
}

export function validateCh1WildEncounterCatalog(raw:unknown):Ch1WildEncounterCatalog{
  if(!isObject(raw)||!exactKeys(raw,['schema','mapId','provenance','runtimeVerified','records']))throw new Error('Invalid Chapter 1 wild encounter catalog shape');
  if(raw.schema!==1||raw.mapId!==1020||raw.provenance!=='RECOVERED_SECONDARY'||raw.runtimeVerified!==false)throw new Error('Unsupported Chapter 1 wild encounter catalog authority');
  if(!Array.isArray(raw.records)||raw.records.length!==6)throw new Error('Map 1020 wild catalog must contain exactly six records');
  const records=raw.records.map(parseRecord);
  const ids=records.map(row=>row.entityId);
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate Chapter 1 wild entity ID');
  return Object.freeze({schema:1,mapId:1020,provenance:'RECOVERED_SECONDARY',runtimeVerified:false,records:Object.freeze(records)});
}

export const CH1_WILD_ENCOUNTER_CATALOG=validateCh1WildEncounterCatalog(rawCatalog);
export const CH1_WILD_ENCOUNTERS=CH1_WILD_ENCOUNTER_CATALOG.records;

export function ch1WildEncounterById(entityId:number):Ch1WildEncounterRecord|undefined{
  return CH1_WILD_ENCOUNTERS.find(row=>row.entityId===entityId);
}

export function manhattanDistance(a:Cell,b:Cell):number{
  return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
}
