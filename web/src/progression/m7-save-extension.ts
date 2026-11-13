import {
  createM7IntegratedSkillState,
  validateM7IntegratedSkillState,
} from '../training/m7-skill-progression.ts';
import type {M7IntegratedSkillState} from '../training/m7-skill-progression.ts';
import {playableClassById} from '../content/classes/class-catalog.ts';
import {
  createAttributeAllocationState,
  validateAttributeAllocationState,
} from './attribute-points.ts';
import type {AttributeAllocationState} from './attribute-points.ts';

export type M7SavedVitals=Readonly<{hp:number;mp:number}>;
export type M7SaveExtension=Readonly<{
  schema:2;
  family:'swordsman'|'wizard';
  skills:M7IntegratedSkillState;
  attributes:AttributeAllocationState;
  vitals:M7SavedVitals|null;
  provenance:'RECONSTRUCTION_POLICY';
}>;

const SCHEMA1_REQUIRED=new Set(['schema','family','skills','provenance']);
const SCHEMA1_ALLOWED=new Set([...SCHEMA1_REQUIRED,'vitals']);
const SCHEMA2_REQUIRED=new Set(['schema','family','skills','attributes','provenance']);
const SCHEMA2_ALLOWED=new Set([...SCHEMA2_REQUIRED,'vitals']);

function validateVitals(raw:unknown):M7SavedVitals|null{
  if(raw===undefined||raw===null)return null;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid M7 saved vitals');
  const value=raw as Record<string,unknown>;
  if(Object.keys(value).length!==2||!('hp' in value)||!('mp' in value))throw new Error('Invalid M7 saved vitals');
  if(typeof value.hp!=='number'||!Number.isFinite(value.hp)||value.hp<0)throw new Error('Invalid M7 saved HP');
  if(typeof value.mp!=='number'||!Number.isFinite(value.mp)||value.mp<0)throw new Error('Invalid M7 saved MP');
  return Object.freeze({hp:value.hp,mp:value.mp});
}

function familyFor(characterId:string|number):'swordsman'|'wizard'{
  const family=playableClassById(characterId).family;
  if(family!=='swordsman'&&family!=='wizard')throw new Error('Unsupported M7 save family');
  return family;
}

export function m7PersistenceLevel(playerLevel:number):number{
  if(!Number.isInteger(playerLevel)||playerLevel<1)throw new Error('Invalid player level');
  return Math.min(65,playerLevel);
}

export function validateM7SaveExtension(raw:unknown,characterId:string,playerLevel:number):M7SaveExtension{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid M7 save extension');
  const value=raw as Record<string,unknown>;
  const family=familyFor(characterId);
  const level=m7PersistenceLevel(playerLevel);
  const schema=value.schema;
  const required=schema===1?SCHEMA1_REQUIRED:schema===2?SCHEMA2_REQUIRED:null;
  const allowed=schema===1?SCHEMA1_ALLOWED:schema===2?SCHEMA2_ALLOWED:null;
  if(!required||!allowed||Object.keys(value).some(key=>!allowed.has(key))||
    [...required].some(key=>!Object.prototype.hasOwnProperty.call(value,key)))throw new Error('Unknown M7 save extension field');
  if(value.family!==family||value.provenance!=='RECONSTRUCTION_POLICY')throw new Error('Unsupported M7 save extension');
  const skills=validateM7IntegratedSkillState(value.skills as M7IntegratedSkillState,characterId,level,false);
  const vitals=validateVitals(value.vitals);
  // Schema 1 saves predate attribute allocation. Preserve all earned points as
  // unspent; never infer historical allocations from the character's level.
  const attributes=schema===1
    ?createAttributeAllocationState(level)
    :validateAttributeAllocationState(value.attributes,level);
  return Object.freeze({schema:2,family,skills,attributes,vitals,provenance:'RECONSTRUCTION_POLICY'});
}

export function createM7SaveExtension(
  characterId:string,
  playerLevel:number,
  skills?:M7IntegratedSkillState,
  vitals:M7SavedVitals|null=null,
  attributes?:AttributeAllocationState,
):M7SaveExtension{
  const family=familyFor(characterId);
  const level=m7PersistenceLevel(playerLevel);
  return validateM7SaveExtension({
    schema:2,
    family,
    skills:skills??createM7IntegratedSkillState(characterId,level),
    attributes:attributes??createAttributeAllocationState(level),
    vitals,
    provenance:'RECONSTRUCTION_POLICY',
  },characterId,level);
}
