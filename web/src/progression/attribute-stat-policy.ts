import type {EquipmentCombatBonuses} from '../combat/reconstruction-combat-balance.ts';
import {totalAttributeValue,validateAttributeAllocationState} from './attribute-points.ts';
import type {AttributeAllocationState,AttributeKey} from './attribute-points.ts';

export const ATTRIBUTE_STAT_POLICY=Object.freeze({
  id:'m7-2-six-dimension-combat-projection-v1',
  provenance:'RECONSTRUCTION_POLICY' as const,
  appliesTo:'automatic growth plus confirmed allocated points',
  mappings:Object.freeze({
    con:Object.freeze({target:'maxHp',perPoint:50,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-con-max-hp-50-v1'}),
    wis:Object.freeze({target:'maxMp',perPoint:50,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-wis-max-mp-50-v1'}),
    str:Object.freeze({target:'attack',perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-str-physical-attack-1-v1'}),
    dex:Object.freeze({target:'defense',perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-dex-physical-defense-1-v1'}),
    int:Object.freeze({target:'magicAttack',perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-int-magic-attack-1-v1'}),
    reg:Object.freeze({target:'magicDefense',perPoint:1,evidenceLevel:'RECOVERED_SECONDARY',provenance:'RECONSTRUCTION_POLICY',policyId:'m7-2-reg-magic-defense-1-v1'}),
  }),
  note:'This is an explicit offline reconstruction policy. RECOVERED_SECONDARY describes the YBCS evidence source, not retail-server verification. S46 may recalibrate these projections without changing the stored six-dimension state.',
});

export type AttributeCombatProjection=Readonly<Required<Pick<EquipmentCombatBonuses,'maxHp'|'maxMp'|'attack'|'defense'|'magicAttack'|'magicDefense'>>>;

export function projectAttributeCombatBonuses(rawState:AttributeAllocationState):AttributeCombatProjection{
  const state=validateAttributeAllocationState(rawState);
  const value=(key:AttributeKey)=>totalAttributeValue(state,key);
  return Object.freeze({
    maxHp:value('con')*ATTRIBUTE_STAT_POLICY.mappings.con.perPoint,
    maxMp:value('wis')*ATTRIBUTE_STAT_POLICY.mappings.wis.perPoint,
    attack:value('str')*ATTRIBUTE_STAT_POLICY.mappings.str.perPoint,
    defense:value('dex')*ATTRIBUTE_STAT_POLICY.mappings.dex.perPoint,
    magicAttack:value('int')*ATTRIBUTE_STAT_POLICY.mappings.int.perPoint,
    magicDefense:value('reg')*ATTRIBUTE_STAT_POLICY.mappings.reg.perPoint,
  });
}
