import {applyBattleReward} from '../progression/rewards.ts';
import type {RewardState} from '../progression/rewards.ts';
import type {Ch1WildEncounterRecord} from './ch1-wild-encounter-catalog.ts';
import {
  markCh1WildEncounterDefeated,
  suppressCh1WildEncounterUntilLeave,
} from './ch1-wild-encounter-authority.ts';
import type {Ch1WildEncounterState} from './ch1-wild-encounter-authority.ts';

export type Ch1WildBattleOutcome='won'|'lost'|'retreated';
export type Ch1WildBattleSettlement=Readonly<{
  rewards:RewardState;
  wildState:Ch1WildEncounterState;
  receiptId:string|null;
  applied:boolean;
  outcome:Ch1WildBattleOutcome;
  provenance:'RECONSTRUCTION_POLICY';
}>;

export function settleCh1WildBattle(input:Readonly<{
  rewards:RewardState;
  wildState:Ch1WildEncounterState;
  record:Ch1WildEncounterRecord;
  generation:number;
  outcome:Ch1WildBattleOutcome;
}>):Ch1WildBattleSettlement{
  if(input.generation!==input.wildState.spawnGeneration)throw new Error('Stale Chapter 1 wild battle generation');
  if(input.outcome!=='won'){
    return Object.freeze({
      rewards:input.rewards,
      wildState:suppressCh1WildEncounterUntilLeave(input.wildState,input.record.entityId,input.generation),
      receiptId:null,
      applied:false,
      outcome:input.outcome,
      provenance:'RECONSTRUCTION_POLICY',
    });
  }
  const receiptId='ch1-wild-'+input.generation+'-'+input.record.entityId+'-win';
  const application=applyBattleReward(
    input.rewards,
    'ch1-wild:'+input.record.entityId,
    receiptId,
    {gold:input.record.reward.gold,exp:input.record.reward.exp,items:[{itemId:input.record.reward.dropItemId,quantity:1}]},
  );
  return Object.freeze({
    rewards:application.state,
    wildState:markCh1WildEncounterDefeated(input.wildState,input.record.entityId,input.generation),
    receiptId,
    applied:application.applied,
    outcome:'won',
    provenance:'RECONSTRUCTION_POLICY',
  });
}
