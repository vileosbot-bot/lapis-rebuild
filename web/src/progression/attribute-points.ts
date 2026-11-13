import growthData from '../../../data/progression/ch1-attribute-growth.json' with {type:'json'};

export const ATTRIBUTE_KEYS = Object.freeze(['con','wis','str','dex','int','reg'] as const);
export type AttributeKey = typeof ATTRIBUTE_KEYS[number];
export type AttributeValues = Readonly<Record<AttributeKey,number>>;
export type AttributeFamily = 'swordsman'|'wizard';

type GrowthRow = Readonly<{
  level:number;
  sourceAbilityId:number;
  sourceRank:number;
  sourceRow:number;
  automaticGrowth:AttributeValues;
  distributablePoints:number;
  runtimeEnabled:boolean;
  evidenceLevel:'RECOVERED_SECONDARY';
}>;
type GrowthCatalog = Readonly<{rows:readonly GrowthRow[]}>;

const GROWTH_ROWS=(growthData as unknown as GrowthCatalog).rows;
const ZERO_VALUES:AttributeValues=Object.freeze({con:0,wis:0,str:0,dex:0,int:0,reg:0});
const VALUE_KEYS=new Set<string>(ATTRIBUTE_KEYS);
const POLICY_ID='m7-2-attribute-allocation-v1' as const;
const MAX_RUNTIME_LEVEL=65;

export type AttributeAllocationState=Readonly<{
  schema:1;
  policyId:typeof POLICY_ID;
  level:number;
  automaticGrowth:AttributeValues;
  allocated:AttributeValues;
  unspentPoints:number;
  rewardReceipts:readonly string[];
  provenance:'RECONSTRUCTION_POLICY';
}>;

export type AttributeAllocationDraft=Readonly<{
  baseLevel:number;
  pending:AttributeValues;
  provenance:'RECONSTRUCTION_POLICY';
}>;

const isIntegerIn=(value:unknown,min:number,max:number):value is number=>
  Number.isInteger(value)&&(value as number)>=min&&(value as number)<=max;

function validReceipt(value:unknown):value is string{
  return typeof value==='string'&&value.length>0&&value.length<=160&&/^[A-Za-z0-9._:/-]+$/.test(value);
}

function validateValues(raw:unknown,label:string):AttributeValues{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid '+label);
  const value=raw as Record<string,unknown>;
  const keys=Object.keys(value);
  if(keys.length!==ATTRIBUTE_KEYS.length||keys.some(key=>!VALUE_KEYS.has(key)))throw new Error('Invalid '+label+' keys');
  const result={} as Record<AttributeKey,number>;
  for(const key of ATTRIBUTE_KEYS){
    const amount=value[key];
    if(!isIntegerIn(amount,0,Number.MAX_SAFE_INTEGER))throw new Error('Invalid '+label+' '+key);
    result[key]=amount;
  }
  return Object.freeze(result);
}

function validLevel(level:number):number{
  if(!isIntegerIn(level,1,MAX_RUNTIME_LEVEL))throw new Error('Attribute progression level must be 1..65');
  return level;
}

function rowForLevel(level:number):GrowthRow{
  validLevel(level);
  const row=GROWTH_ROWS[level-1];
  if(!row||row.level!==level||row.runtimeEnabled!==true)throw new Error('Missing enabled attribute growth row '+level);
  return row;
}

export function attributePointsGrantedAtLevel(level:number):number{
  return rowForLevel(level).distributablePoints;
}

export function attributePointsEarnedThroughLevel(level:number):number{
  validLevel(level);
  let total=0;
  for(let current=1;current<=level;current+=1)total+=attributePointsGrantedAtLevel(current);
  return total;
}

function automaticGrowthThroughLevel(level:number):AttributeValues{
  validLevel(level);
  const result={...ZERO_VALUES} as Record<AttributeKey,number>;
  for(let current=1;current<=level;current+=1){
    const growth=rowForLevel(current).automaticGrowth;
    for(const key of ATTRIBUTE_KEYS)result[key]+=growth[key];
  }
  return Object.freeze(result);
}

export function createAttributeAllocationState(level=1):AttributeAllocationState{
  validLevel(level);
  return Object.freeze({
    schema:1,
    policyId:POLICY_ID,
    level,
    automaticGrowth:automaticGrowthThroughLevel(level),
    allocated:ZERO_VALUES,
    unspentPoints:attributePointsEarnedThroughLevel(level),
    rewardReceipts:Object.freeze([] as string[]),
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function validateAttributeAllocationState(raw:unknown,expectedLevel?:number):AttributeAllocationState{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid attribute allocation state');
  const value=raw as Record<string,unknown>;
  const allowed=new Set(['schema','policyId','level','automaticGrowth','allocated','unspentPoints','rewardReceipts','provenance']);
  const keys=Object.keys(value);
  if(keys.length!==allowed.size||keys.some(key=>!allowed.has(key)))throw new Error('Unknown attribute allocation field');
  if(value.schema!==1||value.policyId!==POLICY_ID||value.provenance!=='RECONSTRUCTION_POLICY')throw new Error('Unsupported attribute allocation state');
  const level=validLevel(value.level as number);
  if(expectedLevel!==undefined&&level!==validLevel(expectedLevel))throw new Error('Attribute allocation level mismatch');
  const automaticGrowth=validateValues(value.automaticGrowth,'automatic growth');
  const allocated=validateValues(value.allocated,'allocated attributes');
  const unspentPoints=value.unspentPoints;
  if(!isIntegerIn(unspentPoints,0,Number.MAX_SAFE_INTEGER))throw new Error('Invalid unspent attribute points');
  const expectedAutomatic=automaticGrowthThroughLevel(level);
  for(const key of ATTRIBUTE_KEYS){
    if(automaticGrowth[key]!==expectedAutomatic[key])throw new Error('Automatic attribute growth mismatch: '+key);
  }
  if(ATTRIBUTE_KEYS.reduce((sum,key)=>sum+allocated[key],unspentPoints as number)!==attributePointsEarnedThroughLevel(level)){
    throw new Error('Allocated plus unspent attribute points do not match earned points');
  }
  if(!Array.isArray(value.rewardReceipts)||value.rewardReceipts.length>512||
    new Set(value.rewardReceipts).size!==value.rewardReceipts.length||
    !value.rewardReceipts.every(validReceipt))throw new Error('Invalid attribute reward receipts');
  return Object.freeze({
    schema:1,
    policyId:POLICY_ID,
    level,
    automaticGrowth,
    allocated,
    unspentPoints:unspentPoints as number,
    rewardReceipts:Object.freeze([...value.rewardReceipts] as string[]),
    provenance:'RECONSTRUCTION_POLICY',
  });
}

export function grantAttributeLevels(
  rawState:AttributeAllocationState,
  targetLevel:number,
  rewardReceiptId:string,
):AttributeAllocationState{
  const state=validateAttributeAllocationState(rawState);
  validLevel(targetLevel);
  if(targetLevel<state.level)throw new Error('Attribute level cannot move backwards');
  if(!validReceipt(rewardReceiptId))throw new Error('Invalid attribute reward receipt');
  if(state.rewardReceipts.includes(rewardReceiptId))return state;
  const automatic={...state.automaticGrowth} as Record<AttributeKey,number>;
  let unspent=state.unspentPoints;
  for(let level=state.level+1;level<=targetLevel;level+=1){
    const row=rowForLevel(level);
    for(const key of ATTRIBUTE_KEYS)automatic[key]+=row.automaticGrowth[key];
    unspent+=row.distributablePoints;
  }
  return validateAttributeAllocationState({
    ...state,
    level:targetLevel,
    automaticGrowth:automatic,
    unspentPoints:unspent,
    rewardReceipts:[...state.rewardReceipts,rewardReceiptId],
  },targetLevel);
}

export function createAttributeAllocationDraft(state:AttributeAllocationState):AttributeAllocationDraft{
  const valid=validateAttributeAllocationState(state);
  return Object.freeze({baseLevel:valid.level,pending:ZERO_VALUES,provenance:'RECONSTRUCTION_POLICY'});
}

export function pendingAttributePoints(draft:AttributeAllocationDraft):number{
  const pending=validateValues(draft.pending,'pending attributes');
  return ATTRIBUTE_KEYS.reduce((sum,key)=>sum+pending[key],0);
}

export function addAttributePointToDraft(
  rawState:AttributeAllocationState,
  rawDraft:AttributeAllocationDraft,
  rawKey:unknown,
  amount=1,
):AttributeAllocationDraft{
  const state=validateAttributeAllocationState(rawState);
  if(!rawDraft||rawDraft.provenance!=='RECONSTRUCTION_POLICY'||rawDraft.baseLevel!==state.level)throw new Error('Attribute draft is stale');
  if(typeof rawKey!=='string'||!VALUE_KEYS.has(rawKey))throw new Error('Unknown attribute');
  if(!isIntegerIn(amount,1,Number.MAX_SAFE_INTEGER))throw new Error('Attribute allocation amount must be a positive integer');
  const pending=validateValues(rawDraft.pending,'pending attributes');
  if(pendingAttributePoints(rawDraft)+amount>state.unspentPoints)throw new Error('Insufficient unspent attribute points');
  const next={...pending,[rawKey]:pending[rawKey as AttributeKey]+amount};
  return Object.freeze({baseLevel:state.level,pending:Object.freeze(next),provenance:'RECONSTRUCTION_POLICY'});
}

export function confirmAttributeAllocation(
  rawState:AttributeAllocationState,
  rawDraft:AttributeAllocationDraft,
):AttributeAllocationState{
  const state=validateAttributeAllocationState(rawState);
  if(!rawDraft||rawDraft.provenance!=='RECONSTRUCTION_POLICY'||rawDraft.baseLevel!==state.level)throw new Error('Attribute draft is stale');
  const pending=validateValues(rawDraft.pending,'pending attributes');
  const spent=pendingAttributePoints(rawDraft);
  if(spent>state.unspentPoints)throw new Error('Insufficient unspent attribute points');
  const allocated={...state.allocated} as Record<AttributeKey,number>;
  for(const key of ATTRIBUTE_KEYS)allocated[key]+=pending[key];
  return validateAttributeAllocationState({
    ...state,
    allocated,
    unspentPoints:state.unspentPoints-spent,
  },state.level);
}

export function cancelAttributeAllocationDraft(state:AttributeAllocationState):AttributeAllocationDraft{
  return createAttributeAllocationDraft(state);
}

export function totalAttributeValue(state:AttributeAllocationState,key:AttributeKey):number{
  const valid=validateAttributeAllocationState(state);
  if(!VALUE_KEYS.has(key))throw new Error('Unknown attribute');
  return valid.automaticGrowth[key]+valid.allocated[key];
}

export function retainAttributeAllocationAcrossStageChange(
  state:AttributeAllocationState,
  fromFamily:AttributeFamily,
  toFamily:AttributeFamily,
):AttributeAllocationState{
  if(fromFamily!==toFamily)throw new Error('Attribute allocation cannot cross profession families');
  return validateAttributeAllocationState(state);
}
