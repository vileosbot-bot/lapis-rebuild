import bindingJson from '../../../manifests/ch1-story-one-battle-binding.json' with {type:'json'};
import type {ReconstructionBattleSetup,ReconstructionEnemySetup} from '../battle.ts';
import type {Cell} from '../coordinates.ts';

type Chapter1MonsterType=Readonly<{
  model_id:number;
  name:string;
  level:number;
  hp:number;
  mp:number;
  attack:number;
  defense:number;
  magic_attack:number;
  magic_defense:number;
  movement_range:number;
  attack_range:number;
  gold:number;
  exp:number;
  visual_resource_id:number;
  visual_assets?:Readonly<Record<string,Readonly<{ani_sha256:string;spr_sha256:string}>>>;
}>;

type Chapter1FormationRow=Readonly<{
  unit_id:string;
  model_id:number;
  position:readonly [number,number];
  position_evidence:'RECOVERED_SECONDARY';
}>;

export type Chapter1StoryOneBattleBinding=Readonly<{
  binding_id:string;
  player_position:readonly [number,number];
  monster_types:Readonly<Record<string,Chapter1MonsterType>>;
  formation:readonly Chapter1FormationRow[];
  summary:Readonly<{unit_count:number;counts_by_model:Readonly<Record<string,number>>}>;
  role_rank_policy:Readonly<{role:'melee'|'ranged';rank:ReconstructionEnemySetup['rank'];provenance:'RECONSTRUCTION_POLICY'}>;
  monster_skill_policy:Readonly<{mode:'NONE';scope:string;provenance:'OWNER_DECISION'}>;
  ai_policy:Readonly<{binding:'trainingAiBinding';program:string;provenance:'RECONSTRUCTION_POLICY';historical_6a69_binding:'NOT_ASSERTED'}>;
}>;

export const CH1_STORY_ONE_BATTLE_BINDING=bindingJson as unknown as Chapter1StoryOneBattleBinding;

const asCell=(cell:readonly [number,number]):Cell=>Object.freeze([cell[0],cell[1]]) as Cell;

export const CH1_STORY_ONE_BATTLE_CELLS:readonly Cell[]=Object.freeze([
  asCell(CH1_STORY_ONE_BATTLE_BINDING.player_position),
  ...CH1_STORY_ONE_BATTLE_BINDING.formation.map(row=>asCell(row.position)),
]);

export function buildChapter1StoryOneBattleSetup(
  playerClassId:string|number,
  level:number,
  equipment?:ReconstructionBattleSetup['equipment'],
):ReconstructionBattleSetup{
  const binding=CH1_STORY_ONE_BATTLE_BINDING;
  if(binding.formation.length!==binding.summary.unit_count)throw new Error('Chapter 1 Story source 1 roster count does not match its binding summary');
  if(binding.monster_skill_policy.mode!=='NONE')throw new Error('Chapter 1 Story source 1 requires the owner-approved no-monster-skills policy');
  if(binding.ai_policy.provenance!=='RECONSTRUCTION_POLICY')throw new Error('Chapter 1 Story source 1 AI must remain explicitly reconstructed');
  const enemies:ReconstructionEnemySetup[]=binding.formation.map(member=>{
    const type=binding.monster_types[String(member.model_id)];
    if(!type)throw new Error(`Chapter 1 Story source 1 has no monster type binding for ${member.model_id}`);
    // Owner decision (2026-11-13): no monster skill/ability fields are supplied.
    // beginBattle applies the existing trainingAiBinding reconstruction default.
    return {
      id:member.unit_id,
      level:type.level,
      rank:binding.role_rank_policy.rank,
      role:binding.role_rank_policy.role,
      encounterGroup:0,
      maxHp:type.hp,
      maxMp:type.mp,
      attack:type.attack,
      defense:type.defense,
      magicAttack:type.magic_attack,
      magicDefense:type.magic_defense,
      movementRangeCells:type.movement_range,
      attackRangeCells:type.attack_range,
      visualResourceId:type.visual_resource_id,
      position:asCell(member.position),
    };
  });
  return {
    playerClassId,
    level,
    equipment,
    playerPosition:asCell(binding.player_position),
    enemies,
  };
}
