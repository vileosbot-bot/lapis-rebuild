import {totalAttributeValue,validateAttributeAllocationState} from './attribute-points.ts';
import type {AttributeAllocationState,AttributeKey} from './attribute-points.ts';

export const ATTRIBUTE_STAT_POLICY=Object.freeze({
  id:'m7-2-six-dimension-combat-projection-v1',
  provenance:'RECONSTRUCTION_POLICY' as const,
  appliesTo:'automatic growth plus confirmed allocated points',
  mappings:Object.freeze({
    con:Object.freeze({target:'maxHp',perPoint:50,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-con-max-hp-50-v1'}),
    wis:Object.freeze({target:'maxMp',perPoint:50,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-wis-max-mp-50-v1'}),
    str:Object.freeze({targets:Object.freeze(['attack','defense']),perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-str-physical-offense-defense-1-v1'}),
    int:Object.freeze({targets:Object.freeze(['magicAttack','magicDefense']),perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-int-magic-offense-defense-1-v1'}),
  }),
  unmapped:Object.freeze({
    dex:Object.freeze({status:'unmapped',evidenceLevel:'UNKNOWN',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-dex-unmapped-pending-s46-v1'}),
    reg:Object.freeze({status:'unmapped',evidenceLevel:'UNKNOWN',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-reg-unmapped-pending-s46-v1'}),
  }),
  note:'Only approved CON/WIS/STR/INT projections affect combat values. DEX and REG remain stored as six-dimension attributes but are intentionally unmapped until S46 measurement. RECOVERED_SECONDARY describes the YBCS evidence source, not retail-server verification.',
});

export type AttributeCombatProjection=Readonly<{
  maxHp:number;
  maxMp:number;
  attack:number;
  defense:number;
  magicAttack:number;
  magicDefense:number;
}>;

export function projectAttributeCombatBonuses(rawState:AttributeAllocationState):AttributeCombatProjection{
  const state=validateAttributeAllocationState(rawState);
  const value=(key:AttributeKey)=>totalAttributeValue(state,key);
  return Object.freeze({
    maxHp:value('con')*ATTRIBUTE_STAT_POLICY.mappings.con.perPoint,
    maxMp:value('wis')*ATTRIBUTE_STAT_POLICY.mappings.wis.perPoint,
    attack:value('str')*ATTRIBUTE_STAT_POLICY.mappings.str.perPoint,
    defense:value('str')*ATTRIBUTE_STAT_POLICY.mappings.str.perPoint,
    magicAttack:value('int')*ATTRIBUTE_STAT_POLICY.mappings.int.perPoint,
    magicDefense:value('int')*ATTRIBUTE_STAT_POLICY.mappings.int.perPoint,
  });
}
