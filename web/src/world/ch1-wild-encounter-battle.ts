import type {BattleEntry} from '../runtime-boundaries.ts';
import type {ReconstructionBattleSetup} from '../battle.ts';
import type {EquipmentCombatBonuses} from '../combat/reconstruction-combat-balance.ts';
import {DEFAULT_RECONSTRUCTION_COMBAT_BALANCE} from '../combat/reconstruction-combat-balance.ts';
import type {Ch1WildEncounterRecord} from './ch1-wild-encounter-catalog.ts';

export type Ch1WildBattlePlan=Readonly<{
  entry:BattleEntry;
  setup:ReconstructionBattleSetup;
  visualFallback:'TEXT_LABEL';
  provenance:'RECONSTRUCTION_POLICY';
}>;

export function createCh1WildBattlePlan(
  record:Ch1WildEncounterRecord,
  playerClassId:string|number,
  playerLevel:number,
  equipment:EquipmentCombatBonuses,
):Ch1WildBattlePlan{
  if(!Number.isInteger(playerLevel)||playerLevel<1)throw new Error('Invalid player level for Chapter 1 wild battle');
  const enemyLevel=record.minimumLevel;
  const template=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.enemyStats({
    id:record.name,
    level:enemyLevel,
    rank:'normal',
    role:'melee',
  });
  const enemy=Object.freeze({
    id:record.name,
    level:enemyLevel,
    rank:'normal' as const,
    role:'melee' as const,
    maxHp:record.maxHp,
    maxMp:record.maxMp,
    attack:template.attack,
    defense:template.defense,
    magicAttack:template.magicAttack,
    magicDefense:template.magicDefense,
    movementRangeCells:1,
    attackRangeCells:1,
    traits:Object.freeze([] as string[]),
    abilities:Object.freeze([] as []),
  });
  const setup=Object.freeze({
    playerClassId,
    level:playerLevel,
    equipment,
    enemyLevel,
    enemyRank:'normal' as const,
    enemies:Object.freeze([enemy]),
  }) as ReconstructionBattleSetup;
  const entry:BattleEntry=Object.freeze({
    battleZoneId:1020,
    provenance:'RECONSTRUCTION_POLICY',
    authority:'offline-reconstruction',
  });
  return Object.freeze({entry,setup,visualFallback:'TEXT_LABEL',provenance:'RECONSTRUCTION_POLICY'});
}
