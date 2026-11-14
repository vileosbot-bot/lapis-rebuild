import type {LabScene} from './scene.ts';
import type {Skill} from './battle.ts';
import {actionReady,consumeAction,reconcileBattlePhase,updateBattle} from './battle.ts';
import {battleProfileForClass,magicReadinessCost} from './battle-profile.ts';
import {nearestAnchor,referenceCellToScreen,walkable} from './coordinates.ts';
import type {Cell} from './coordinates.ts';
import {playableClassById,isEquipmentCompatibleWithClass} from './content/classes/class-catalog.ts';
import rawSkills from '../../data/skills/mvp.json' with {type:'json'};
import {BattlePresentation} from './presentation/battle-presentation.ts';
import type {BattlePresentationBatch} from './presentation/battle-presentation.ts';
import {createInventory,validateInventory} from './progression/inventory.ts';
import type {InventoryState} from './progression/inventory.ts';
import {equipItem as equipProgression,reconcileEquipmentForCharacter} from './progression/equipment.ts';
import type {EquipmentCompatibilityResolver} from './progression/equipment.ts';
import {initialM71Progression,RECONSTRUCTION_PROGRESSION_POLICY,totalExpForLevel} from './progression/progression.ts';
import {M71_EXPERIENCE_POLICY} from './progression/m7-1-experience-policy.ts';
import {applyBattleReward,applyQuestReward} from './progression/rewards.ts';
import type {RewardState} from './progression/rewards.ts';
import {CURRENT_SAVE_VERSION,SAVE_KIND} from './progression/save-schema.ts';
import type {JsonValue,SaveV2,SaveValidationContext} from './progression/save-schema.ts';
import {applyM6Promotion} from './progression/m6-stage-promotion.ts';
import type {M6StageProgressionState} from './progression/m6-stage-promotion.ts';
import {createM6SaveExtension} from './progression/m6-save-extension.ts';
import {equipM6Item,evaluateM6EquipmentEligibility,m6EquipmentStatContribution,reconcileM6EquipmentLoadout} from './progression/m6-equipment.ts';
import type {M6EquipmentLoadout,M6EquipmentSlot} from './progression/m6-equipment.ts';
import {migrateSaveToM7,serializeM7SaveV2} from './progression/m7-save-migration.ts';
import type {M7SaveV2} from './progression/m7-save-migration.ts';
import {createM7SaveExtension} from './progression/m7-save-extension.ts';
import {createAttributeAllocationState,createAttributeAllocationDraft,addAttributePointToDraft,confirmAttributeAllocation,cancelAttributeAllocationDraft,grantAttributeLevels,retainAttributeAllocationAcrossStageChange,totalAttributeValue} from './progression/attribute-points.ts';
import type {AttributeAllocationState,AttributeAllocationDraft} from './progression/attribute-points.ts';
import {projectAttributeCombatBonuses} from './progression/attribute-stat-policy.ts';
import {
  M6_CHARACTER_IDS,M6_RUNTIME_EQUIPMENT_RULES,M6_SAVE_CONTENT,createM6StageState,m6QuestChainForLegacyStage,
  m6SkillAvailableForCharacter,m6SkillIdsForCharacter,m6StageTrackForCharacter,
} from './m6-runtime-content.ts';
import {ReconstructionWorldAuthority} from './world/world-authority.ts';
import type {WorldRuntimeState} from './world/world-authority.ts';
import type {EncounterRequest,WorldState} from './world/world-model.ts';
import type {BattleEntry} from './runtime-boundaries.ts';
import {canInteract} from './world/world-model.ts';
import {applyWarp} from './world/warp-policy.ts';
import {START_STATE,TRAINING_BATTLE_ZONE_ID,TRAINING_QUEST_ID,WORLD_ENTITIES} from './world/world-content.ts';
import {initialQuestRuntime} from './world/quest-runtime.ts';
import type {QuestRuntimeState,QuestStage} from './world/quest-runtime.ts';
import type {NpcDialogueChoiceId,NpcDialogueSession,NpcInteractionInputSource} from './world/npc-dialogue-runtime.ts';
import {renderFieldHud} from './ui/field-hud.ts';
import {renderBattleHud} from './ui/battle-hud.ts';
import {renderGameMenu} from './ui/game-menu.ts';
import {renderAttributeAllocationPanel} from './ui/attribute-allocation-panel.ts';
import {renderEquipmentPanel} from './ui/equipment-panel.ts';
import {renderShopPanel} from './ui/shop-panel.ts';
import {createShopRuntimeState,purchaseShopItem,useShopPotion,validateShopRuntimeState} from './shops/shop-runtime.ts';
import type {Ch1ShopId} from './shops/shop-catalog.ts';
import {getCh1ShopById} from './shops/shop-catalog.ts';
import {Ch1ShopAuthority} from './world/ch1-shop-authority.ts';
import {renderDebugPanel} from './ui/debug-panel.ts';
import {escapeHtml} from './ui/ui-utils.ts';
import type {BattleHudState,BattleStatusView,DiagnosticsState,FieldHudState,PlayerHudState} from './ui/types.ts';
import {readM4Save,writeM4Save} from './m4-save-store.ts';
import {equipmentBonus as legacyEquipmentBonus} from './inventory.ts';
import {createM5PlayableWorld} from './world/m5-playable-world.ts';
import type {M5PlayableWorld} from './world/m5-playable-world.ts';
import {SceneTransitionController} from './world/scene-transition.ts';
import type {M4RuntimeMode} from './m4-mode.ts';
import {createCh1WorldPolicy} from './world/ch1-world-policy.ts';
import type {Ch1WorldPolicy} from './world/ch1-world-policy.ts';
import {CH1_WILD_ENCOUNTERS,manhattanDistance} from './world/ch1-wild-encounter-catalog.ts';
import type {Ch1WildEncounterRecord} from './world/ch1-wild-encounter-catalog.ts';
import {clearCh1WildSuppressionAfterLeavingRange,createCh1WildEncounterState,markCh1WildEncounterDefeated,markCh1WildMapEntered,markCh1WildMapLeft,resolveCh1WildEncounter,suppressCh1WildEncounterUntilLeave,validateCh1WildEncounterState} from './world/ch1-wild-encounter-authority.ts';
import type {Ch1WildEncounterState} from './world/ch1-wild-encounter-authority.ts';
import {CH1_GIO_TEACHER_VISUAL_PLACEMENT,Ch1WorldAuthority} from './world/ch1-world-authority.ts';
import type {Ch1NpcDialogueSession,Ch1Quest1SelectionState} from './world/ch1-world-authority.ts';
import {DEFAULT_RECONSTRUCTION_COMBAT_BALANCE} from './combat/reconstruction-combat-balance.ts';
import {applyInfiniteTrainingRecovery,InfiniteTrainingRecoveryPolicy} from './training/m7-recovery.ts';
import {M7_TRAINING_BATTLES,reconstructionSetupForTrainingBattle,trainingBattleById} from './training/m7-training-camp.ts';
import {integratedTrainingBattleById,reconstructionEnemiesForTrainingBattle} from './training/m7-integrated-training-catalog.ts';
import {buildM7DeveloperCharacterPreset} from './training/m7-developer-preset.ts';
import {createM7IntegratedSkillState,m7RuntimeSkillCommands,reconcileM7IntegratedSkillState} from './training/m7-skill-progression.ts';
import type {M7IntegratedSkillState,M7RuntimeSkillCommand} from './training/m7-skill-progression.ts';
import {useM7Skill,useM7SkillTargeted} from './combat/m7-battle-skills.ts';
import {beginM7SkillTargeting,cancelM7SkillTargeting,confirmM7SkillTargeting,createM7SkillTargetingState,enumerateM7DiamondArea,hoverM7SkillTargeting,m7PixelToGridCell,m7PoisonGeometry,tapM7SkillTargeting,validateM7CastCell} from './combat/m7-grid-targeting.ts';
import type {M7GridCell,M7SkillTargetingState} from './combat/m7-grid-targeting.ts';
import {m7WizardOrdinaryAttackTargetable} from './content/skills/wizard-seven-stage-runtime.ts';
import type {M7Profession} from './training/m7-level-axis.ts';
import {resolveM7TrainingManagerInteraction} from './world/m7-training-manager.ts';
import {m7EffectiveDefense,m7EffectivePhysicalAttack} from './combat/m7-status-effects.ts';
import {integratedPromotionRuleForCharacter} from './training/m7-promotion-policy.ts';
import {renderM7DeveloperPreset,renderM7TrainingManagerDialog} from './ui/m7-training-camp.ts';
import {battleSkillHotkeyLabel,resolveBattleHotkey} from './input/battle-hotkeys.ts';
import type {BattleHotkeyCommand} from './input/battle-hotkeys.ts';

type Snapshot=ReturnType<LabScene['snapshot']>;
type BattleInputSceneContract=LabScene&{
  cancelBattleTargeting?:()=>boolean;
};
const QUEST_STAGES:readonly QuestStage[]=['not_started','accepted','objective','ready_to_turn_in','complete'];

const CH1_STORY_ONE_GATE_CELLS:readonly Cell[]=Object.freeze([
  [72,26] as const,[71,27] as const,[73,27] as const,[70,28] as const,[72,28] as const,
  [74,28] as const,[71,29] as const,[73,29] as const,[72,30] as const,
]);
const CH1_STORY_ONE_ARCH_CELL:Cell=Object.freeze([72,26] as const);
const CH1_STORY_ONE_APPROACH_CELLS:readonly Cell[]=Object.freeze([
  [71,27] as const,[73,27] as const,[70,28] as const,[72,28] as const,
  [74,28] as const,[71,29] as const,[73,29] as const,[72,30] as const,
]);
const CH1_STORY_ONE_SOURCE=Object.freeze({
  id:'story-source-1',
  fieldMapId:1030,
  battleZoneId:1,
  sourceArtifact:'src/legacy_gui_runtime/ybcs_offline_field_encounters.py',
  sourceSha256:'94ee9a6ba8cee80d76e44c01e5e41fbb7b894f7ef118c50732d77992d99b691a',
  gateCellsLocator:'ybcs_offline_field_encounters.py:L277-L289',
  battleZoneLocator:'ybcs_offline_field_encounters.py:L240',
  deploymentLocalCell:[34,44] as const,
  deploymentHostileCell:[52,24] as const,
  replayable:true as const,
  bossVictory:true as const,
  evidenceLevel:'RECOVERED_SECONDARY' as const,
  runtimeVerified:false as const,
  retailMapBindingVerified:false as const,
});
type Chapter1StoryBattleContext=Readonly<{
  sourceId:typeof CH1_STORY_ONE_SOURCE.id;
  fieldMapId:typeof CH1_STORY_ONE_SOURCE.fieldMapId;
  gateCell:Cell;
  battleZoneId:typeof CH1_STORY_ONE_SOURCE.battleZoneId;
  entryProvenance:'RECOVERED_SECONDARY';
  authority:'offline-reconstruction';
  runtimeVerified:false;
}>;
type Chapter1StoryBattleOutcome='won'|'lost'|'retreated';
type Chapter1WildBattleContext=Readonly<{entityId:number;generation:number;record:Ch1WildEncounterRecord}>;
type Chapter1WildNearbyView=Readonly<{status:'ambiguous'|'defeated'|'suppressed'|'level-too-low'|'eligible';candidateCount:number;entityId?:number;name?:string;minimumLevel?:number;distance?:number;minimumLevelProvenance:'RECONSTRUCTION_POLICY';provenance:'RECONSTRUCTION_POLICY'}>;
type Chapter1StoryBattleResolution=Readonly<{
  sourceId:typeof CH1_STORY_ONE_SOURCE.id;
  outcome:Chapter1StoryBattleOutcome;
  fieldMapId:typeof CH1_STORY_ONE_SOURCE.fieldMapId;
  gateCell:Cell;
  battleZoneId:typeof CH1_STORY_ONE_SOURCE.battleZoneId;
  returnMapId:number;
  returnCell:Cell;
  rewardSettlement:'not-applied';
  victoryCondition:'m4-battle-phase-won';
  bossVictorySourceFlag:true;
  bossVictoryRuntimeEnforced:false;
  replayPolicy:'after-leave-all-nine-gate-cells';
  triggerSemantics:'movement-complete-gate-cell-offline-policy';
  evidenceLevel:'RECOVERED_SECONDARY';
  runtimeVerified:false;
}>;
const CLASS_RESOLVER:EquipmentCompatibilityResolver=(characterId,item)=>{
  try{return isEquipmentCompatibleWithClass(characterId,item.itemId,item.slot??undefined);}catch{return false;}
};

function starterInventory():InventoryState{
  // The six legacy starter entries remain unchanged. The broader S44 catalog is metadata only; no catalog item is auto-granted.
  return createInventory([1,3,10,12,25,31].map(itemId=>({itemId,source:{kind:'starter' as const,ref:'m4-starter'}})));
}

export function createM4RewardState(gold=0):RewardState{
  return {gold,inventory:starterInventory(),progression:initialM71Progression(),questFlags:{},rewardReceipts:[]};
}

export function parseM4Quest(raw:JsonValue,questId=TRAINING_QUEST_ID):QuestRuntimeState{
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const record=raw as Record<string,JsonValue>;
    if(record.questId===questId&&typeof record.stage==='string'&&QUEST_STAGES.includes(record.stage as QuestStage))return{questId,stage:record.stage as QuestStage};
    // S7/M3 migration: only the completed legacy guide is promoted to a
    // completed reconstruction quest. Partial legacy stages restart safely.
    if(record.guide==='complete')return{questId,stage:'complete'};
  }
  return initialQuestRuntime(questId);
}

export function questHud(stage:QuestStage):Pick<FieldHudState,'questTitle'|'questDetail'>{
  const detail:Record<QuestStage,string>={
    not_started:'与训练引导员交谈，接受训练委托。',
    accepted:'前往外城训练点。',
    objective:'在外城训练点完成一场战斗。',
    ready_to_turn_in:'返回训练引导员交付任务。',
    complete:'训练委托已完成。',
  };
  return{questTitle:'训练委托',questDetail:detail[stage]};
}

function chapter1Quest1Hud(state:Ch1Quest1SelectionState):Pick<FieldHudState,'questTitle'|'questDetail'>{
  return{
    questTitle:'Quest1 · 同伴招募',
    questDetail:state.selectionStatus==='recorded'
      ?'STEP 1 / SELECT 已在当前会话记录；服务端接取状态未确认。'
      :'前往吉奥老师处查看 STEP 1 / SELECT，并记录本地选择。',
  };
}

function visualSkillForCommand(command:M7RuntimeSkillCommand):Skill|null{
  if(command.authoredSkillId===null)return null;
  const row=rawSkills.find(entry=>entry.skill_id===command.authoredSkillId);
  return row?row as Skill:null;
}

function cloneRewardState(state:RewardState):RewardState{
  return{
    gold:state.gold,
    inventory:{items:state.inventory.items.map(item=>({...item,acquisitionSources:item.acquisitionSources.map(source=>({...source}))})),equipped:{...state.inventory.equipped}},
    progression:{...state.progression},
    questFlags:{...state.questFlags},
    rewardReceipts:[...state.rewardReceipts],
  };
}

export type M4RuntimeOptions=Readonly<{mode?:M4RuntimeMode}>;

export class M4RuntimeIntegration{
  readonly scene:LabScene;
  readonly runtimeMode:M4RuntimeMode;
  readonly m5World:M5PlayableWorld|null;
  readonly chapter1World:Ch1WorldPolicy|null;
  readonly chapter1Authority:Ch1WorldAuthority|null;
  readonly worldAuthority:ReconstructionWorldAuthority;
  readonly spatial:SceneTransitionController|null;
  readonly chapter1Spatial:SceneTransitionController|null;
  readonly presentation=new BattlePresentation();
  world:WorldRuntimeState;
  rewards:RewardState;
  m6Stage:M6StageProgressionState;
  m7Skills:M7IntegratedSkillState;
  attributeState:AttributeAllocationState;
  m6Equipment:M6EquipmentLoadout;
  pendingEncounter:EncounterRequest|null=null;
  menuOpen=false;
  developerMode=false;
  inventoryOpen=false;
  equipmentPanelOpen=false;
  private shopAuthority=new Ch1ShopAuthority();
  private shopState=createShopRuntimeState();
  private activeShopId:Ch1ShopId|null=null;
  private activeDialogue:NpcDialogueSession|null=null;
  private activeChapter1Dialogue:Ch1NpcDialogueSession|null=null;
  private chapter1Quest1Selection:Ch1Quest1SelectionState|null=null;
  private activeChapter1StoryBattle:Chapter1StoryBattleContext|null=null;
  private chapter1StoryLastResolution:Chapter1StoryBattleResolution|null=null;
  private chapter1StorySuppressedUntilLeaveGate=false;
  private ch1WildState:Ch1WildEncounterState=createCh1WildEncounterState();
  private activeCh1WildBattle:Chapter1WildBattleContext|null=null;
  private chapter1StoryOneApproachCells:readonly Cell[]=Object.freeze([]);
  private chapter1StoryOneArchRuntimeCollisionWalkable=false;
  private trainingManagerOpen=false;
  private attributePanelOpen=false;
  private attributeDraft:AttributeAllocationDraft|null=null;
  private battleExitConfirm=false;
  private battleTargetingState:M7SkillTargetingState=createM7SkillTargetingState();
  private battleTargetingCommandId:string|null=null;
  private suppressEncounterUntilLeave=false;
  private selectedTrainingBattleId=1;
  private activeTrainingBattleId:number|null=null;
  private trainingLaunchPending=false;
  private developerPresetActive=false;
  private developerUnlockAllSkills=false;
  private developerSkillPoints=0;
  private hudHtml='';
  private menuHtml='';
  private debugHtml='';
  private dialogueHtml='';
  private noticeText='M4 游戏化运行时已接入';
  private lastSnapshot:Snapshot|null=null;
  private lastAudio='';
  private installed=false;
  private pauseBattleOnNextEntry=false;
  private originalSceneAttack:((skill:Skill|null)=>void)|null=null;
  private hudRoot!:HTMLDivElement;
  private menuRoot!:HTMLDivElement;
  private debugRoot!:HTMLDivElement;
  private dialogueRoot!:HTMLDivElement;
  private feedbackRoot!:HTMLDivElement;

  constructor(scene:LabScene,options:M4RuntimeOptions={}){
    this.scene=scene;
    this.runtimeMode=options.mode??'default';
    this.chapter1World=this.runtimeMode==='chapter1'?createCh1WorldPolicy(scene.pack):null;
    this.chapter1Authority=this.chapter1World?new Ch1WorldAuthority():null;
    this.chapter1Quest1Selection=this.chapter1Authority?.initialQuest1State()??null;
    if(this.chapter1World){
      const fieldMap=scene.pack.maps[String(CH1_STORY_ONE_SOURCE.fieldMapId)];
      if(!fieldMap)throw new Error('Chapter 1 Story source 1 requires field map 1030');
      if(!scene.pack.maps[String(CH1_STORY_ONE_SOURCE.battleZoneId)])throw new Error('Chapter 1 Story source 1 requires battleZone 1 resource');
      this.chapter1StoryOneApproachCells=Object.freeze(CH1_STORY_ONE_APPROACH_CELLS.map(cell=>Object.freeze([cell[0],cell[1]]) as Cell));
      const blockedApproaches=this.chapter1StoryOneApproachCells.filter(cell=>!walkable(fieldMap.collision,cell));
      if(blockedApproaches.length)throw new Error('Chapter 1 Story source 1 approach cells are not walkable in the loaded map pack: '+blockedApproaches.map(cell=>cell.join(',')).join(';'));
      // The source classifies (72,26) as a non-walkable arch, even though this
      // reconstructed map pack currently marks that collision cell walkable.
      // Keep it in the nine-cell source set but exclude it from the eight-cell
      // movement-complete trigger whitelist.
      this.chapter1StoryOneArchRuntimeCollisionWalkable=walkable(fieldMap.collision,CH1_STORY_ONE_ARCH_CELL);
    }
    let m5:M5PlayableWorld|null=null;
    try{
      if(this.runtimeMode!=='chapter1'&&scene.pack.maps['7']&&scene.pack.animations['1001']&&scene.pack.animations['4524']&&scene.pack.animations['4544'])m5=createM5PlayableWorld(scene.pack);
    }catch(error){console.warn('M5 playable world unavailable; using M4 compatibility world',error);}
    this.m5World=m5;
    this.worldAuthority=new ReconstructionWorldAuthority(m5?.content);
    this.spatial=m5?new SceneTransitionController(m5.house.graph,m5.house.triggers):null;
    this.chapter1Spatial=this.chapter1World?new SceneTransitionController(this.chapter1World.graph,this.chapter1World.triggers):null;
    const initial=this.chapter1World
      ?{mapId:this.chapter1World.initial.mapId,x:this.chapter1World.initial.effectiveCell[0],y:this.chapter1World.initial.effectiveCell[1]}
      :m5?.content.start??START_STATE;
    this.world=this.worldAuthority.initial(initial);
    this.rewards=createM4RewardState(scene.gold);
    this.m6Equipment={weapon:this.rewards.inventory.equipped.weapon,armor:this.rewards.inventory.equipped.armor,accessory:null};
    this.m6Stage=createM6StageState(scene.character);
    this.m7Skills=createM7IntegratedSkillState(scene.character,1);
    this.attributeState=createAttributeAllocationState(1);
  }

  install():void{
    if(this.installed)return;
    this.installed=true;
    document.body.classList.add('m4-active');
    this.mountRoots();
    this.installSceneAdapters();
    this.installInput();
    this.installBattleTargetingAdapter();
    this.scene.setWorldInteractionHandler(entityId=>this.beginNpcInteraction(entityId,'pointer'));
    this.syncSceneInventory();
    const initial=this.chapter1World
      ?{mapId:this.chapter1World.initial.mapId,x:this.chapter1World.initial.effectiveCell[0],y:this.chapter1World.initial.effectiveCell[1]}
      :this.m5World?.content.start??START_STATE;
    this.applyWorldState(initial);
    if(this.chapter1World){
      if(!this.chapter1Authority)throw new Error('Chapter 1 NPC authority was not initialized');
      if(!this.scene.pack.animations[String(CH1_GIO_TEACHER_VISUAL_PLACEMENT.resourceId)]){
        throw new Error('Chapter 1 private pack is missing NPC visual proxy B4524');
      }
      this.scene.configureWorldVisuals([CH1_GIO_TEACHER_VISUAL_PLACEMENT]);
      this.scene.setPlayerCameraFollow(true);
      this.scene.focusPlayer();
      const mapSelector=document.getElementById('map') as HTMLSelectElement|null;
      if(mapSelector){
        mapSelector.value=String(initial.mapId);
        mapSelector.disabled=true;
        mapSelector.closest('label')?.setAttribute('hidden','');
      }
      document.getElementById('npc')?.setAttribute('hidden','');
      this.setNotice('第一章路线模式已启动：1000 ↔ 1020 ↔ 1030；1060 为胜利返回节点。吉奥老师 NPC 21003 已接入，视觉替身 B4524 / RECONSTRUCTION_POLICY。路线与 NPC 来源证据 RECOVERED_SECONDARY / runtimeVerified=false。');
    }else if(this.m5World){
      this.scene.configureWorldVisuals(this.m5World.visuals);
      this.scene.configureWorldMarkers([
        {id:'training-house-door',mapId:this.m5World.content.trainingMapId,cell:this.m5World.doorCell,label:'训练屋入口'},
        {id:'training-house-exit',mapId:this.m5World.content.objectiveMapId,cell:this.m5World.interiorExit,label:'出口'},
      ]);
      this.scene.setPlayerCameraFollow(true);
      this.scene.focusPlayer();
      this.spatial?.start({mapId:initial.mapId,cell:[initial.x,initial.y]});
      this.setNotice('训练管理员就在出生点附近：按 E / 轻点“与训练管理员交谈”即可打开 15 场训练。');
    }
    this.applyClassProfile(true);
    window.addEventListener('lapis-state',event=>this.onSnapshot((event as CustomEvent<Snapshot>).detail));
    this.render(this.scene.snapshot());
    this.installS14AcceptanceBridge();
  }

  private installS14AcceptanceBridge():void{
    if(!navigator.webdriver)return;
    queueMicrotask(()=>{
      const bridge=(window as unknown as {lapisM4?:Record<string,unknown>}).lapisM4;
      if(!bridge)throw new Error('Missing M4 window bridge while installing S14 acceptance fixtures');
      Object.assign(bridge,{
        acceptanceSetBattlePaused:(paused:boolean)=>this.acceptanceSetBattlePaused(paused),
        acceptanceActionReady:()=>this.acceptanceActionReady(),
        acceptanceCanAct:()=>this.acceptanceCanAct(),
        acceptanceReachable:()=>this.acceptanceReachable(),
        acceptanceIssueMoveTo:(x:number,y:number)=>this.acceptanceIssueMoveTo(x,y),
        acceptanceIssueAttack:()=>this.acceptanceIssueAttack(),
        acceptanceAdvanceLiveBattleStep:()=>this.acceptanceAdvanceLiveBattleStep(),
        acceptanceAdvanceUntilActionOrEnd:(maxSteps:number)=>this.acceptanceAdvanceUntilActionOrEnd(maxSteps),
        acceptanceSetGold:(amount:number)=>this.acceptanceSetGold(amount),
        acceptanceOpenShop:(shopId:string)=>this.acceptanceOpenShop(shopId),
        acceptanceBuyShopItem:(shopId:string,itemId:number,transactionId:string)=>this.buyShopItem(shopId,itemId,transactionId),
        acceptanceUsePotion:(itemId:number)=>this.usePotion(itemId),
      });
    });
  }

  snapshot(){
    const cell=nearestAnchor(this.scene.anchor.x,this.scene.anchor.y);
    return{
      runtimeMode:this.runtimeMode,
      character:this.scene.character,
      chapter1:this.chapter1World?{
        mapIds:[...this.chapter1World.mapIds],
        routes:this.chapter1World.routes.map(route=>({routeId:route.routeId,sourceMapId:route.sourceMapId,targetMapId:route.targetMapId,activationCellCount:route.activationCells.length})),
        initial:{mapId:this.chapter1World.initial.mapId,requestedCell:this.chapter1World.initial.requestedCell,effectiveCell:this.chapter1World.initial.effectiveCell,snapDistanceSquared:this.chapter1World.initial.snapDistanceSquared},
        victoryReturn:{mapId:this.chapter1World.victoryReturn.mapId,cell:this.chapter1World.victoryReturn.effectiveCell},
        provenance:'RECOVERED_SECONDARY',runtimeVerified:false,
      }:null,
      chapter1StorySource1:this.chapter1World?{
        sourceId:CH1_STORY_ONE_SOURCE.id,
        fieldMapId:CH1_STORY_ONE_SOURCE.fieldMapId,
        battleZoneId:CH1_STORY_ONE_SOURCE.battleZoneId,
        gateCells:CH1_STORY_ONE_GATE_CELLS.map(cell=>[cell[0],cell[1]]),
        approachCells:this.chapter1StoryOneApproachCells.map(cell=>[cell[0],cell[1]]),
        sourceBlockedArchCell:[CH1_STORY_ONE_ARCH_CELL[0],CH1_STORY_ONE_ARCH_CELL[1]],
        archCellRuntimeCollisionWalkable:this.chapter1StoryOneArchRuntimeCollisionWalkable,
        deploymentLocalCell:[...CH1_STORY_ONE_SOURCE.deploymentLocalCell],
        deploymentHostileCell:[...CH1_STORY_ONE_SOURCE.deploymentHostileCell],
        deploymentApplied:false,
        replayable:CH1_STORY_ONE_SOURCE.replayable,
        replayPolicy:'after-leave-all-nine-gate-cells',
        bossVictory:CH1_STORY_ONE_SOURCE.bossVictory,
        bossVictoryRuntimeEnforced:false,
        victoryReturnCondition:'m4-battle-phase-won',
        gateCellsLocator:CH1_STORY_ONE_SOURCE.gateCellsLocator,
        battleZoneLocator:CH1_STORY_ONE_SOURCE.battleZoneLocator,
        sourceArtifact:CH1_STORY_ONE_SOURCE.sourceArtifact,
        sourceSha256:CH1_STORY_ONE_SOURCE.sourceSha256,
        mapToBattleZoneRetailVerified:CH1_STORY_ONE_SOURCE.retailMapBindingVerified,
        triggerSemantics:'movement-complete-gate-cell-offline-policy',
        evidenceLevel:CH1_STORY_ONE_SOURCE.evidenceLevel,
        runtimeVerified:CH1_STORY_ONE_SOURCE.runtimeVerified,
      }:null,
      chapter1StoryBattle:this.activeChapter1StoryBattle?{
        sourceId:this.activeChapter1StoryBattle.sourceId,
        fieldMapId:this.activeChapter1StoryBattle.fieldMapId,
        gateCell:[...this.activeChapter1StoryBattle.gateCell],
        battleZoneId:this.activeChapter1StoryBattle.battleZoneId,
        entryProvenance:this.activeChapter1StoryBattle.entryProvenance,
        authority:this.activeChapter1StoryBattle.authority,
        runtimeVerified:this.activeChapter1StoryBattle.runtimeVerified,
      }:null,
      chapter1StorySuppressedUntilLeaveGate:this.chapter1StorySuppressedUntilLeaveGate,
      chapter1StoryLastResolution:this.chapter1StoryLastResolution?{
        sourceId:this.chapter1StoryLastResolution.sourceId,
        outcome:this.chapter1StoryLastResolution.outcome,
        fieldMapId:this.chapter1StoryLastResolution.fieldMapId,
        gateCell:[...this.chapter1StoryLastResolution.gateCell],
        battleZoneId:this.chapter1StoryLastResolution.battleZoneId,
        returnMapId:this.chapter1StoryLastResolution.returnMapId,
        returnCell:[...this.chapter1StoryLastResolution.returnCell],
        rewardSettlement:this.chapter1StoryLastResolution.rewardSettlement,
        victoryCondition:this.chapter1StoryLastResolution.victoryCondition,
        bossVictorySourceFlag:this.chapter1StoryLastResolution.bossVictorySourceFlag,
        bossVictoryRuntimeEnforced:this.chapter1StoryLastResolution.bossVictoryRuntimeEnforced,
        replayPolicy:this.chapter1StoryLastResolution.replayPolicy,
        triggerSemantics:this.chapter1StoryLastResolution.triggerSemantics,
        evidenceLevel:this.chapter1StoryLastResolution.evidenceLevel,
        runtimeVerified:this.chapter1StoryLastResolution.runtimeVerified,
      }:null,
      chapter1Wild:this.chapter1World?{
        state:this.ch1WildState,
        activeBattle:this.activeCh1WildBattle?{entityId:this.activeCh1WildBattle.entityId,generation:this.activeCh1WildBattle.generation,name:this.activeCh1WildBattle.record.name,battleZoneId:1020,provenance:'RECONSTRUCTION_POLICY'}:null,
        nearby:this.chapter1WildNearby(),
        battleZonePolicy:{battleZoneId:1020,provenance:'RECONSTRUCTION_POLICY'},
      }:null,
      quest:{...this.world.quest},
      shop:{provenance:'RECONSTRUCTION_POLICY',routeStatus:'UNKNOWN',runtimeEnabled:false,candidates:this.shopAuthority.snapshot().candidates.map(row=>({shopId:row.shopId,npcId:row.npcId,mapId:row.mapId,program:row.program}))},
      shopState:this.shopState,
      chapter1Quest1:this.chapter1Quest1Selection?{...this.chapter1Quest1Selection}:null,
      world:{mapId:this.scene.mapId,x:cell[0],y:cell[1]},
      progression:{...this.rewards.progression},
      equipment:{...this.m6Equipment,statContribution:m6EquipmentStatContribution(this.m6Equipment,M6_RUNTIME_EQUIPMENT_RULES)},
      combatStats:this.playerCombatStats(),
      attributes:{level:this.attributeState.level,automaticGrowth:{...this.attributeState.automaticGrowth},allocated:{...this.attributeState.allocated},total:{con:totalAttributeValue(this.attributeState,'con'),wis:totalAttributeValue(this.attributeState,'wis'),str:totalAttributeValue(this.attributeState,'str'),dex:totalAttributeValue(this.attributeState,'dex'),int:totalAttributeValue(this.attributeState,'int'),reg:totalAttributeValue(this.attributeState,'reg')},unspentPoints:this.attributeState.unspentPoints,rewardReceipts:[...this.attributeState.rewardReceipts],policyId:'m7-2-six-dimension-combat-projection-v1',provenance:'RECONSTRUCTION_POLICY'},
      inventory:{items:this.rewards.inventory.items.map(item=>({itemId:item.itemId,quantity:item.quantity})),equipped:{...this.rewards.inventory.equipped}},
      gold:this.rewards.gold,
      pendingEncounter:this.pendingEncounter?{...this.pendingEncounter}:null,
      dialogue:this.activeChapter1Dialogue?{
        sessionId:this.activeChapter1Dialogue.sessionId,
        inputSource:this.activeChapter1Dialogue.inputSource,
        phase:'select',
        marker:this.activeChapter1Dialogue.view.marker,
        actorToken:this.activeChapter1Dialogue.actorToken,
        choices:this.activeChapter1Dialogue.view.choices.map(choice=>choice.id),
      }:this.activeDialogue?{
        sessionId:this.activeDialogue.sessionId,
        inputSource:this.activeDialogue.inputSource,
        phase:this.activeDialogue.view.phase,
        choices:this.activeDialogue.view.choices.map(choice=>choice.id),
      }:null,
      developerMode:this.developerMode,
      lastAudio:this.lastAudio,
      playableRecovery:!!this.m5World,
      m6:{stageId:this.m6Stage.stageId,family:this.m6Stage.family,promotionReceipts:[...this.m6Stage.promotionReceipts],nextStageId:integratedPromotionRuleForCharacter(this.scene.character)?.toStageId??null,canPromote:(integratedPromotionRuleForCharacter(this.scene.character)?.minimumLevel??Infinity)<=this.rewards.progression.level},
      m7Training:{battleCount:M7_TRAINING_BATTLES.length,selectedBattleId:this.selectedTrainingBattleId,activeBattleId:this.activeTrainingBattleId,recoveryPolicyId:InfiniteTrainingRecoveryPolicy.id,developerPresetActive:this.developerPresetActive,unlockAllImplementedSkills:this.developerMode&&this.developerUnlockAllSkills,developerSkillPoints:this.developerSkillPoints,skillLevelOverride:this.developerMode&&this.developerUnlockAllSkills?6:null},
      worldPlan:this.m5World?{doorCell:this.m5World.doorCell,interiorEntry:this.m5World.interiorEntry,interiorExit:this.m5World.interiorExit,encounterCell:this.m5World.encounterCell}:null,
    };
  }

  private mountRoots():void{
    const world=document.querySelector<HTMLElement>('.world');
    if(!world)throw new Error('Missing legacy world host');
    this.hudRoot=document.createElement('div');this.hudRoot.id='m4-hud-root';
    this.menuRoot=document.createElement('div');this.menuRoot.id='m4-menu-root';
    this.debugRoot=document.createElement('div');this.debugRoot.id='m4-debug-root';
    this.dialogueRoot=document.createElement('div');this.dialogueRoot.id='m4-dialogue-root';
    this.feedbackRoot=document.createElement('div');this.feedbackRoot.id='m4-feedback-root';
    world.append(this.hudRoot,this.menuRoot,this.debugRoot,this.dialogueRoot,this.feedbackRoot);
  }

  private installSceneAdapters():void{
    const originalCharacter=this.scene.setCharacter.bind(this.scene);
    this.scene.setCharacter=(id:string)=>{
      originalCharacter(id);
      if(!M6_CHARACTER_IDS.includes(this.scene.character))return;
      if(String(this.m6Stage.stageId)!==this.scene.character)this.m6Stage=createM6StageState(this.scene.character);
      const reconciled=reconcileEquipmentForCharacter(this.rewards.inventory,this.scene.character,CLASS_RESOLVER);
      this.rewards={...this.rewards,inventory:reconciled.inventory};
      const definition=playableClassById(this.scene.character);
      const m6Context={characterId:this.scene.character,family:definition.family,stageId:Number(this.scene.character),level:this.rewards.progression.level,attributes:this.currentEquipmentAttributes()};
      const m6Reconciled=reconcileM6EquipmentLoadout(this.m6Equipment,this.rewards.inventory,M6_RUNTIME_EQUIPMENT_RULES,m6Context);
      this.m6Equipment=m6Reconciled.loadout;
      const m6Inventory=validateInventory({...this.rewards.inventory,equipped:{weapon:m6Reconciled.loadout.weapon,armor:m6Reconciled.loadout.armor}});
      this.rewards={...this.rewards,inventory:m6Inventory};
      this.syncSceneInventory();
      this.applyClassProfile(false);
      if(reconciled.unequipped.length)this.setNotice(`职业切换：自动卸下 ${reconciled.unequipped.length} 件不兼容装备。`);
    };

    this.scene.equipItem=(id:number|null,slot:'weapon'|'armor')=>{
      try{
        if(this.scene.inBattleView)throw new Error('战斗中不能更换装备');
        const definition=playableClassById(this.scene.character);
        equipM6Item(
          {weapon:this.rewards.inventory.equipped.weapon,armor:this.rewards.inventory.equipped.armor,accessory:null},
          this.rewards.inventory,
          M6_RUNTIME_EQUIPMENT_RULES,
          {characterId:this.scene.character,family:definition.family,stageId:Number(this.scene.character),level:this.rewards.progression.level,attributes:this.currentEquipmentAttributes()},
          slot,
          id,
        );
        const inventory=equipProgression(this.rewards.inventory,this.scene.character,slot,id,CLASS_RESOLVER);
        this.rewards={...this.rewards,inventory};
        this.m6Equipment={...this.m6Equipment,[slot]:id};
        this.syncSceneInventory();
        this.applyClassProfile(false);
        this.setNotice('装备已更新 / RECONSTRUCTION_POLICY');
      }catch(error){this.setNotice(String(error));}
    };

    const originalEnter=this.scene.enterBattle.bind(this.scene);
    this.scene.enterBattle=(entryOverride)=>{
      this.clearBattleTargeting(false);
      this.activeDialogue=null;
      this.activeChapter1Dialogue=null;
      this.battleExitConfirm=false;
      const trainingBattleId=this.trainingLaunchPending?this.selectedTrainingBattleId:null;
      if(this.activeCh1WildBattle)this.prepareChapter1WildBattle(this.activeCh1WildBattle.record);
      else this.prepareReconstructionBattle(trainingBattleId);
      const requestedTrainingZone=trainingBattleId===null?null:trainingBattleById(trainingBattleId).battleZoneId;
      const trainingEntry=requestedTrainingZone!==null&&this.scene.pack.maps[String(requestedTrainingZone)]?Object.freeze({
        battleZoneId:requestedTrainingZone,
        provenance:'RECONSTRUCTION_POLICY' as const,
        authority:'offline-reconstruction' as const,
      }):undefined;
      originalEnter(entryOverride??trainingEntry);
      if(this.pauseBattleOnNextEntry&&this.scene.inBattleView){
        this.scene.battlePaused=true;
        this.pauseBattleOnNextEntry=false;
      }
      this.trainingLaunchPending=false;
      if(!this.scene.inBattleView){
        if(trainingBattleId!==null)this.activeTrainingBattleId=null;
        return;
      }
      this.activeTrainingBattleId=trainingBattleId;
      this.applyClassProfile(true);
      this.lastSnapshot=null;
      const batch=this.presentation.battleStart({zoneId:this.scene.state.battleZoneId??this.worldAuthority.content.battleZoneId});
      this.present(batch);
    };

    this.originalSceneAttack=this.scene.attack.bind(this.scene);
    this.scene.attack=(skill:Skill|null)=>{this.performAttack(skill,false);};
  }

  private installInput():void{
    document.addEventListener('click',event=>{
      const choice=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-dialogue-choice]');
      if(choice){
        const choiceId=choice.dataset.dialogueChoice;
        if(choiceId==='record-selection'&&this.activeChapter1Dialogue){this.chooseChapter1Quest1Selection();return;}
        if(choiceId)this.chooseNpcInteraction(choiceId as NpcDialogueChoiceId);
        return;
      }
      const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if(!target)return;
      const action=target.dataset.action;
      if(action==='menu'||action==='battle-menu'){this.activeDialogue=null;this.activeChapter1Dialogue=null;this.menuOpen=true;this.render(this.scene.snapshot());}
      else if(action==='menu-close'){this.menuOpen=false;this.render(this.scene.snapshot());}
      else if(action==='save')void this.save();
      else if(action==='load')void this.load();
      else if(action==='inventory'){this.inventoryOpen=!this.inventoryOpen;this.equipmentPanelOpen=this.inventoryOpen;this.menuOpen=false;document.body.classList.toggle('m4-inventory-open',this.inventoryOpen);this.render(this.scene.snapshot());}
      else if(action==='equipment-close'){this.equipmentPanelOpen=false;this.inventoryOpen=false;document.body.classList.remove('m4-inventory-open');this.render(this.scene.snapshot());}
      else if(action==='shop-close'){this.activeShopId=null;this.render(this.scene.snapshot());}
      else if(action==='shop-buy')this.buyShopItem(target.dataset.shopId??'',Number(target.dataset.itemId),target.dataset.transactionId??'');
      else if(action==='inventory-use')this.usePotion(Number(target.dataset.itemId));
      else if(action==='equipment-equip')this.equipEquipmentPanelItem(target.dataset.slot,target.dataset.itemId);
      else if(action==='equipment-unequip')this.equipEquipmentPanelItem(target.dataset.slot,null);
      else if(action==='attribute-panel')this.openAttributePanel();
      else if(action==='attribute-add')this.addAttributePoint(target.dataset.attribute);
      else if(action==='attribute-cancel')this.cancelAttributePanel();
      else if(action==='attribute-confirm')this.confirmAttributePanel();
      else if(action==='fullscreen')void this.scene.toggleFullscreen().then(ok=>this.setNotice(ok?'全屏状态已切换':'当前浏览器未允许全屏切换'));
      else if(action==='zoom-in'){this.scene.zoomIn();this.setNotice('视角已放大');}
      else if(action==='zoom-out'){this.scene.zoomOut();this.setNotice('视角已缩小');}
      else if(action==='zoom-reset'){this.scene.resetZoom();this.scene.focusPlayer();this.setNotice('视角已恢复 1:1 并居中角色');}
      else if(action==='interact')this.beginNpcInteraction(undefined,'pointer');
      else if(action==='attack')this.scene.attack(null);
      else if(action==='skill')this.useSkill(target.dataset.skillId??'');
      else if(action==='recovery-hp')this.trainingRecovery('hp');
      else if(action==='recovery-mp')this.trainingRecovery('mp');
      else if(action==='rest')this.rest();
      else if(action==='training-manager-close'){this.trainingManagerOpen=false;this.render(this.scene.snapshot());}
      else if(action==='battle-exit-request')this.requestBattleExit();
      else if(action==='battle-exit-cancel')this.cancelBattleExit();
      else if(action==='battle-exit-confirm')this.confirmBattleExit();
      else if(action==='return')this.returnFromBattle();
      else if(action==='class-swordsman')this.changeClass('100');
      else if(action==='class-wizard')this.changeClass('109');
      else if(action==='training-start')this.startTrainingBattle(Number(target.dataset.trainingBattleId));
      else if(action==='dev-preset-apply')this.applyDeveloperPreset();
      else if(action==='dev-preset-quick')this.applyDeveloperPreset(Number(target.dataset.devLevel));
      else if(action==='m6-promote')this.promoteM6Stage();
    });
    document.addEventListener('change',event=>{
      const target=(event.target as HTMLElement).closest<HTMLInputElement>('[data-action="dev-toggle"]');
      if(!target)return;
      this.developerMode=target.checked;
      document.body.classList.toggle('m4-dev-enabled',this.developerMode);
      this.render(this.scene.snapshot());
    });
    window.addEventListener('keydown',event=>{
      if((event.target as HTMLElement).closest('input,select,button,textarea'))return;
      const battleCommand=resolveBattleHotkey(event.key,this.scene.inBattleView);
      if(battleCommand){
        event.preventDefault();
        this.executeBattleHotkey(battleCommand);
        return;
      }
      if(event.key==='Escape'){this.handleEscape();return;}
      if(event.key==='f'||event.key==='F'){event.preventDefault();void this.scene.toggleFullscreen();return;}
      if(event.key==='+'||event.key==='='){event.preventDefault();this.scene.zoomIn();return;}
      if(event.key==='-'){event.preventDefault();this.scene.zoomOut();return;}
      if(event.key==='0'){event.preventDefault();this.scene.resetZoom();this.scene.focusPlayer();return;}
      if(!this.scene.inBattleView&&(event.key==='e'||event.key==='E')){event.preventDefault();this.beginNpcInteraction(undefined,'keyboard');return;}
      // Hidden compatibility aliases only. H/M are intentionally absent from the battle HUD.
      if(this.scene.inBattleView&&(event.key==='h'||event.key==='H')){event.preventDefault();this.trainingRecovery('hp');return;}
      if(this.scene.inBattleView&&(event.key==='m'||event.key==='M')){event.preventDefault();this.trainingRecovery('mp');return;}
    });
  }

  private executeBattleHotkey(command:BattleHotkeyCommand):void{
    if(!this.scene.inBattleView)return;
    if(command.kind==='attack'){this.scene.attack(null);return;}
    if(command.kind==='recovery'){this.trainingRecovery(command.resource);return;}
    if(command.kind==='rest'){this.rest();return;}
    if(command.kind==='skill'){
      const skill=this.runtimeSkillCommands()[command.slot];
      if(skill)this.useSkill(skill.id);
      else this.setNotice(`技能槽 ${command.slot+1} 当前未配置`);
      return;
    }
    this.handleEscape();
  }

  private battleInputScene():BattleInputSceneContract{return this.scene as BattleInputSceneContract;}

  private handleEscape():void{
    if(this.scene.inBattleView&&this.battleInputScene().cancelBattleTargeting?.()){
      this.setNotice('已取消当前技能瞄准 / 命令');
      this.render(this.scene.snapshot());
      return;
    }
    if(this.battleExitConfirm){this.cancelBattleExit();return;}
    if(this.attributePanelOpen){this.cancelAttributePanel();return;}
    if(this.equipmentPanelOpen){this.equipmentPanelOpen=false;this.inventoryOpen=false;this.render(this.scene.snapshot());return;}
    if(this.activeDialogue||this.activeChapter1Dialogue){this.activeDialogue=null;this.activeChapter1Dialogue=null;this.render(this.scene.snapshot());return;}
    this.menuOpen=!this.menuOpen;
    this.render(this.scene.snapshot());
  }

  private installBattleTargetingAdapter():void{
    this.scene.setBattleSkillTargetingAdapter({
      isTargetingSkill:()=>this.battleTargetingState.phase==='aiming',
      onWorldHover:(x,y,coarse)=>this.hoverBattleTargeting(x,y,coarse),
      onWorldPointer:(x,y,coarse)=>this.handleBattleTargetPointer(x,y,coarse),
      onEnemyPointer:enemyId=>{this.scene.selectedEnemy=enemyId;},
      onCancel:()=>this.cancelBattleTargeting(),
    });
  }

  private activeBattleTargetingCommand():M7RuntimeSkillCommand|null{
    if(this.battleTargetingState.phase!=='aiming'||!this.battleTargetingCommandId)return null;
    return this.runtimeSkillCommands().find(command=>command.id===this.battleTargetingCommandId)??null;
  }

  private targetCellOnCurrentBattleMap(cell:M7GridCell):boolean{
    const collision=this.scene.currentMap().collision;
    return Number.isInteger(cell[0])&&Number.isInteger(cell[1])&&cell[0]>=0&&cell[1]>=0&&cell[0]<collision.width&&cell[1]<collision.height;
  }

  private poisonCastCells(command:M7RuntimeSkillCommand):readonly M7GridCell[]{
    const geometry=m7PoisonGeometry(command.skillLevel);
    const caster=m7PixelToGridCell(this.scene.anchor.x,this.scene.anchor.y);
    const collision=this.scene.currentMap().collision;
    const cells:M7GridCell[]=[];
    for(let x=0;x<collision.width;x++)for(let y=0;y<collision.height;y++){
      const cell=Object.freeze([x,y]) as M7GridCell;
      if(validateM7CastCell(caster,cell,geometry.castDistance).ok)cells.push(cell);
    }
    return Object.freeze(cells);
  }

  private syncBattleTargetingVisual():void{
    const command=this.activeBattleTargetingCommand();
    if(!command){
      this.scene.setBattleTargetingVisualization(undefined);
      return;
    }
    const geometry=m7PoisonGeometry(command.skillLevel);
    const preview=this.battleTargetingState.previewCell;
    const previewCells=preview
      ?enumerateM7DiamondArea(preview,geometry.areaCode).filter(cell=>this.targetCellOnCurrentBattleMap(cell))
      :Object.freeze([] as M7GridCell[]);
    this.scene.setBattleTargetingVisualization({
      castCells:this.poisonCastCells(command),
      previewCenter:preview,
      previewCells,
    });
  }

  private beginBattleTargeting(command:M7RuntimeSkillCommand):void{
    if(!this.scene.inBattleView||this.scene.state.phase!=='active'){this.setNotice('请先进入战斗画面');return;}
    if(!this.scene.canAct()){this.setNotice('行动未就绪，暂时不能进入技能瞄准');return;}
    if(this.scene.state.mp<command.mpCost){this.setNotice('MP 不足');return;}
    this.battleTargetingCommandId=command.id;
    this.battleTargetingState=beginM7SkillTargeting(command.id);
    this.syncBattleTargetingVisual();
    this.setNotice(`${command.displayName} Lv.${command.skillLevel}：选择施法中心格；Esc/右键取消`);
    this.render(this.scene.snapshot());
  }

  private hoverBattleTargeting(worldX:number,worldY:number,coarse:boolean):void{
    if(coarse||this.battleTargetingState.phase!=='aiming')return;
    const command=this.activeBattleTargetingCommand();if(!command)return;
    const cell=m7PixelToGridCell(worldX,worldY);
    const caster=m7PixelToGridCell(this.scene.anchor.x,this.scene.anchor.y);
    if(!this.targetCellOnCurrentBattleMap(cell)||!validateM7CastCell(caster,cell,m7PoisonGeometry(command.skillLevel).castDistance).ok){
      if(this.battleTargetingState.previewCell){
        this.battleTargetingState=beginM7SkillTargeting(command.id);
        this.syncBattleTargetingVisual();
      }
      return;
    }
    this.battleTargetingState=hoverM7SkillTargeting(this.battleTargetingState,cell);
    this.syncBattleTargetingVisual();
  }

  private handleBattleTargetPointer(worldX:number,worldY:number,coarse:boolean):boolean{
    if(this.battleTargetingState.phase!=='aiming')return false;
    const command=this.activeBattleTargetingCommand();if(!command){this.clearBattleTargeting(false);return true;}
    const cell=m7PixelToGridCell(worldX,worldY);
    const caster=m7PixelToGridCell(this.scene.anchor.x,this.scene.anchor.y);
    const geometry=m7PoisonGeometry(command.skillLevel);
    if(!this.targetCellOnCurrentBattleMap(cell)||!validateM7CastCell(caster,cell,geometry.castDistance).ok){
      this.setNotice(`目标格超出技能射程（${geometry.castDistance}格）`);
      this.render(this.scene.snapshot());
      return true;
    }
    this.battleTargetingState=coarse
      ?tapM7SkillTargeting(this.battleTargetingState,cell)
      :confirmM7SkillTargeting(this.battleTargetingState,cell);
    this.syncBattleTargetingVisual();
    if(this.battleTargetingState.phase==='confirmed'&&this.battleTargetingState.confirmedCell){
      const confirmed=this.battleTargetingState.confirmedCell;
      this.clearBattleTargeting(false);
      try{this.executeSkillCommand(command,confirmed);}catch(error){this.setNotice(String(error));this.render(this.scene.snapshot());}
    }else{
      this.setNotice(`${command.displayName}：再次点击当前格确认施法`);
      this.render(this.scene.snapshot());
    }
    return true;
  }

  private cancelBattleTargeting():boolean{
    if(this.battleTargetingState.phase!=='aiming')return false;
    this.battleTargetingState=cancelM7SkillTargeting(this.battleTargetingState);
    this.battleTargetingCommandId=null;
    this.scene.setBattleTargetingVisualization(undefined);
    this.battleTargetingState=createM7SkillTargetingState();
    return true;
  }

  private clearBattleTargeting(_announce=false):void{
    this.battleTargetingState=createM7SkillTargetingState();
    this.battleTargetingCommandId=null;
    this.scene.setBattleTargetingVisualization(undefined);
  }

  private changeClass(id:'100'|'109'):void{
    if(this.scene.inBattleView){this.setNotice('请先结束战斗再开始新职业档');return;}
    this.activeDialogue=null;
    this.trainingManagerOpen=false;
    this.pendingEncounter=null;
    this.activeTrainingBattleId=null;
    this.trainingLaunchPending=false;
    this.developerPresetActive=false;
    this.developerUnlockAllSkills=false;
    this.developerSkillPoints=0;
    this.rewards=createM4RewardState(0);
    this.m6Equipment={weapon:this.rewards.inventory.equipped.weapon,armor:this.rewards.inventory.equipped.armor,accessory:null};
    this.world=this.worldAuthority.initial(this.m5World?.content.start??START_STATE);
    this.m6Stage=createM6StageState(id);
    this.m7Skills=createM7IntegratedSkillState(id,1);
    this.attributeState=createAttributeAllocationState(1);
    this.attributePanelOpen=false;
    this.attributeDraft=null;
    this.scene.setCharacter(id);
    this.m6Stage=createM6StageState(id);
    this.syncSceneInventory();
    this.applyWorldState(this.m5World?.content.start??START_STATE);
    this.applyClassProfile(true);
    this.menuOpen=false;
    this.setNotice(id==='100'?'已开始新的剑士职业档':'已开始新的巫师职业档');
    this.render(this.scene.snapshot());
  }

  acceptanceStartTrainingBattle(id:number):void{
    if(!navigator.webdriver)throw new Error('M7.1 acceptance training fixture is automation-only');
    this.trainingManagerOpen=false;
    this.startTrainingBattle(id);
  }

  acceptanceSetEnemyHp(targetId:string,hp:number):void{
    if(!navigator.webdriver)throw new Error('M7 acceptance enemy fixture is automation-only');
    if(!this.scene.inBattleView)throw new Error('M7 acceptance enemy fixture requires active battle');
    const enemy=this.scene.state.enemies.find(row=>row.id===targetId&&row.hp>0);
    if(!enemy)throw new Error('Unknown live acceptance enemy '+targetId);
    if(!Number.isFinite(hp)||hp<=0||hp>=enemy.maxHp)throw new Error('Invalid acceptance enemy HP');
    enemy.hp=hp;
    this.render(this.scene.snapshot());
  }

  acceptanceSetPlayerMp(mp:number):void{
    if(!navigator.webdriver)throw new Error('M7 acceptance player MP fixture is automation-only');
    if(!this.scene.inBattleView)throw new Error('M7 acceptance player MP fixture requires active battle');
    if(!Number.isFinite(mp)||mp<0)throw new Error('Invalid acceptance player MP');
    this.scene.state.mp=Math.min(this.scene.state.maxMp,Math.floor(mp));
    this.render(this.scene.snapshot());
  }

  acceptancePrimeEnemyAction(targetId:string):void{
    if(!navigator.webdriver)throw new Error('M7 acceptance enemy action fixture is automation-only');
    if(!this.scene.inBattleView)throw new Error('M7 acceptance enemy action fixture requires active battle');
    const enemy=this.scene.state.enemies.find(row=>row.id===targetId&&row.hp>0);
    if(!enemy)throw new Error('Unknown live acceptance enemy '+targetId);
    enemy.action=this.scene.state.actionMax;
  }

  acceptanceRunEnemyAbility(targetId:string,abilityKind:string):void{
    if(!navigator.webdriver)throw new Error('S34 acceptance enemy ability fixture is automation-only');
    if(!this.scene.inBattleView||this.scene.state.phase!=='active')throw new Error('S34 acceptance enemy ability fixture requires active battle');
    const enemy=this.scene.state.enemies.find(row=>row.id===targetId&&row.hp>0);
    if(!enemy)throw new Error('Unknown live acceptance enemy '+targetId);
    const ability=enemy.abilities.find(row=>row.kind===abilityKind);
    if(!ability)throw new Error('Enemy '+targetId+' lacks acceptance ability '+abilityKind);
    enemy.abilityCooldownMs[ability.abilityId]=0;
    enemy.action=this.scene.state.actionMax;
    const defense=legacyEquipmentBonus(this.scene.inventory,this.scene.character).defense;
    updateBattle(
      this.scene.state,
      1,
      enemy.x,
      enemy.y,
      defense,
      {collision:this.scene.currentMap().collision,playerBusy:false,reserved:[]},
    );
    reconcileBattlePhase(this.scene.state);
    this.render(this.scene.snapshot());
  }

  acceptanceSetBattlePaused(paused:boolean):void{
    if(!navigator.webdriver)throw new Error('S14 acceptance pause fixture is automation-only');
    if(typeof paused!=='boolean')throw new Error('Invalid S14 acceptance pause value');
    if(!this.scene.inBattleView){
      this.pauseBattleOnNextEntry=paused;
      return;
    }
    if(paused&&this.scene.state.phase!=='active')throw new Error('S14 acceptance pause fixture requires active battle');
    this.scene.battlePaused=paused;
    this.render(this.scene.snapshot());
  }

  acceptanceActionReady():boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance readiness fixture is automation-only');
    if(!this.scene.inBattleView||!this.scene.battlePaused)throw new Error('S14 acceptance readiness fixture requires paused battle');
    // This matches the phase/action/cooldown guard used by the M7 runtime's private ready() before spend.
    return actionReady(this.scene.state);
  }

  acceptanceCanAct():boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance action fixture is automation-only');
    return this.scene.acceptanceCanAct();
  }

  acceptanceReachable(){
    if(!navigator.webdriver)throw new Error('S14 acceptance reachability fixture is automation-only');
    return this.scene.acceptanceReachable();
  }

  acceptanceIssueMoveTo(x:number,y:number):void{
    if(!navigator.webdriver)throw new Error('S14 acceptance movement fixture is automation-only');
    if(!this.scene.acceptanceMoveTo(x,y))throw new Error('S14 acceptance movement command was rejected');
    this.render(this.scene.snapshot());
  }

  acceptanceMoveFieldTo(x:number,y:number):void{
    if(!navigator.webdriver)throw new Error('Chapter 1 field-movement fixture is automation-only');
    if(!this.chapter1World||this.scene.inBattleView)throw new Error('Chapter 1 field-movement fixture requires Chapter 1 field mode');
    if(!Number.isInteger(x)||!Number.isInteger(y))throw new Error('Chapter 1 field-movement target must be integer grid coordinates');
    const [worldX,worldY]=referenceCellToScreen([x,y]);
    this.scene.moveTo(worldX,worldY);
    if(!this.scene.route.length)throw new Error('Chapter 1 field-movement route was rejected');
    this.render(this.scene.snapshot());
  }

  acceptanceIssueAttack():void{
    if(!navigator.webdriver)throw new Error('S14 acceptance attack fixture is automation-only');
    if(!this.scene.inBattleView||!this.scene.battlePaused)throw new Error('S14 acceptance attack fixture requires paused battle');
    if(!this.performAttack(null,true))throw new Error('S14 acceptance attack command was rejected');
    this.render(this.scene.snapshot());
  }

  acceptanceAdvanceLiveBattleStep():void{
    if(!navigator.webdriver)throw new Error('S14 acceptance battle-step fixture is automation-only');
    if(!this.scene.inBattleView||!this.scene.battlePaused||this.scene.state.phase!=='active')throw new Error('S14 acceptance battle-step fixture requires paused active battle');
    this.scene.acceptanceAdvanceBattleStep();
    this.render(this.scene.snapshot());
  }

  acceptanceAdvanceUntilActionOrEnd(maxSteps:number):Readonly<{done:boolean;stepsAdvanced:number}>{
    if(!navigator.webdriver)throw new Error('S14 acceptance batch-advance fixture is automation-only');
    if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>40)throw new Error('Invalid S14 acceptance maxSteps (expected integer 1..40)');
    if(!this.scene.inBattleView||!this.scene.battlePaused)throw new Error('S14 acceptance batch-advance fixture requires paused battle');
    if(document.hidden)throw new Error('S14 acceptance batch-advance fixture requires a visible document');
    let stepsAdvanced=0;
    while(stepsAdvanced<maxSteps&&this.scene.state.phase==='active'&&!this.scene.acceptanceCanAct()){
      this.scene.acceptanceAdvanceBattleStep();
      stepsAdvanced++;
    }
    const done=this.scene.state.phase!=='active'||this.scene.acceptanceCanAct();
    this.render(this.scene.snapshot());
    return {done,stepsAdvanced};
  }

  acceptanceSelectEnemy(targetId:string):void{
    if(!navigator.webdriver)throw new Error('S34 acceptance target fixture is automation-only');
    if(!this.scene.inBattleView)throw new Error('S34 acceptance target fixture requires active battle');
    const enemy=this.scene.state.enemies.find(row=>row.id===targetId&&row.hp>0);
    if(!enemy)throw new Error('Unknown live acceptance enemy '+targetId);
    this.scene.selectedEnemy=enemy.id;
    this.render(this.scene.snapshot());
  }

  acceptanceAdvanceBattleTimeMs(deltaMs:number):void{
    if(!navigator.webdriver)throw new Error('S34 acceptance time fixture is automation-only');
    if(!this.scene.inBattleView||this.scene.state.phase!=='active')throw new Error('S34 acceptance time fixture requires active battle');
    if(!Number.isFinite(deltaMs)||deltaMs<0||deltaMs>120000)throw new Error('Invalid S34 acceptance delta');
    let remaining=deltaMs;
    const defense=legacyEquipmentBonus(this.scene.inventory,this.scene.character).defense;
    // Advance the production battle/status authority while deliberately keeping
    // the acceptance-only virtual actor outside every encounter trigger radius.
    // This avoids adding synthetic enemy attacks merely because test time is accelerated.
    const quietX=this.scene.anchor.x+1_000_000,quietY=this.scene.anchor.y+1_000_000;
    while(remaining>0){
      const step=Math.min(250,remaining);
      updateBattle(this.scene.state,step,quietX,quietY,defense,{collision:this.scene.currentMap().collision,playerBusy:false,reserved:[]});
      remaining-=step;
    }
    reconcileBattlePhase(this.scene.state);
    this.render(this.scene.snapshot());
  }

  acceptanceSetPlayerVitals(hp:number,mp:number):void{
    if(!navigator.webdriver)throw new Error('S34 acceptance vitals fixture is automation-only');
    if(!this.scene.inBattleView)throw new Error('S34 acceptance vitals fixture requires active battle');
    if(!Number.isFinite(hp)||!Number.isFinite(mp)||hp<=0||mp<0)throw new Error('Invalid S34 acceptance vitals');
    this.scene.state.hp=Math.min(this.scene.state.maxHp,Math.floor(hp));
    this.scene.state.mp=Math.min(this.scene.state.maxMp,Math.floor(mp));
    this.render(this.scene.snapshot());
  }

  acceptanceGrantLevel(targetLevel:number):void{
    if(!navigator.webdriver)throw new Error('M6 acceptance reward fixture is automation-only');
    if(!Number.isInteger(targetLevel)||targetLevel<1||targetLevel>99)throw new Error('Invalid M6 acceptance target level');
    const oldLevel=this.rewards.progression.level;
    if(targetLevel>65&&this.rewards.progression.policyId===M71_EXPERIENCE_POLICY.id){
      this.rewards={...this.rewards,progression:{
        level:targetLevel,
        exp:totalExpForLevel(targetLevel,RECONSTRUCTION_PROGRESSION_POLICY.id),
        policyId:RECONSTRUCTION_PROGRESSION_POLICY.id,
      }};
      this.reconcileM7Skills(oldLevel);
    }else{
      const targetExp=totalExpForLevel(targetLevel,this.rewards.progression.policyId);
      const amount=Math.max(0,targetExp-this.rewards.progression.exp);
      if(amount===0)return;
      const receipt=`s29-acceptance:stage-${this.scene.character}:level-${targetLevel}`;
      const applied=applyBattleReward(this.rewards,'s29-acceptance-fixture',receipt,{gold:0,exp:amount});
      this.rewards=applied.state;
      if(applied.applied)this.reconcileM7Attributes(receipt);
      this.reconcileM7Skills(oldLevel);
    }
    this.scene.gold=this.rewards.gold;
    this.applyClassProfile(false);
    this.setNotice(`M6 acceptance fixture：通过生产 reward/progression authority 到达 Lv.${this.rewards.progression.level}`);
    this.render(this.scene.snapshot());
  }

  private promoteM6Stage():void{
    if(this.scene.inBattleView){this.setNotice('请先结束战斗再晋阶');return;}
    const rule=integratedPromotionRuleForCharacter(this.scene.character);
    if(!rule){this.setNotice('当前已经是本职业第十阶段');return;}
    const result=applyM6Promotion(
      m6StageTrackForCharacter(this.scene.character),
      this.m6Stage,
      rule,
      {
        level:this.rewards.progression.level,
        questFlags:this.rewards.questFlags,
        questChain:m6QuestChainForLegacyStage(this.world.quest.stage,this.rewards.questFlags),
        inventory:this.rewards.inventory,
      },
    );
    if(!result.applied){
      this.setNotice(result.duplicate?'该晋阶已经完成':`暂不能晋阶：${result.reasons.join('、')}`);
      return;
    }
    const fromFamily=playableClassById(this.scene.character).family;
    const toFamily=playableClassById(String(result.state.stageId)).family;
    if((fromFamily==='swordsman'||fromFamily==='wizard')&&(toFamily==='swordsman'||toFamily==='wizard')){
      this.attributeState=retainAttributeAllocationAcrossStageChange(this.attributeState,fromFamily,toFamily);
    }
    this.scene.setCharacter(String(result.state.stageId));
    this.m6Stage=result.state;
    this.applyClassProfile(true);
    this.menuOpen=false;
    this.setNotice(`晋阶完成：${playableClassById(result.state.stageId).displayName} / RECONSTRUCTION_POLICY`);
    this.render(this.scene.snapshot());
  }

  private applyDeveloperPreset(levelOverride?:number):void{
    if(!this.developerMode){this.setNotice('Developer Preset 仅在 Developer / Diagnostics 模式可用');return;}
    if(this.scene.inBattleView){this.setNotice('请先结束战斗再应用 Developer Preset');return;}
    const currentProfession=playableClassById(this.scene.character).family as M7Profession;
    const selectedProfession=this.menuRoot.querySelector<HTMLSelectElement>('[data-dev-profession]')?.value;
    const profession:M7Profession=selectedProfession==='swordsman'||selectedProfession==='wizard'?selectedProfession:currentProfession;
    const inputLevel=Number(this.menuRoot.querySelector<HTMLInputElement>('[data-dev-level-input]')?.value);
    const level=levelOverride??inputLevel;
    const unlockAll=this.menuRoot.querySelector<HTMLInputElement>('[data-dev-unlock-all]')?.checked??false;
    try{
      const preset=buildM7DeveloperCharacterPreset(profession,level,unlockAll);
      this.rewards={...this.rewards,progression:{...this.rewards.progression,level:preset.level,exp:totalExpForLevel(preset.level,this.rewards.progression.policyId)}};
      this.m7Skills=createM7IntegratedSkillState(String(preset.stageId),Math.min(65,preset.level));
      this.developerPresetActive=true;
      this.developerUnlockAllSkills=preset.unlockAllImplementedSkills;
      this.developerSkillPoints=preset.skillPoints;
      this.scene.setCharacter(String(preset.stageId));
      this.m6Stage=createM6StageState(preset.stageId);
      this.equipDeveloperPreset();
      this.applyClassProfile(true);
      this.menuOpen=false;
      this.setNotice('Developer Preset：'+profession+' Lv.'+preset.level+' / Stage '+preset.stage+' / B'+preset.stageId+(preset.unlockAllImplementedSkills?' / all implemented skills Lv6 override':'')+' / RECONSTRUCTION_POLICY');
      this.render(this.scene.snapshot());
    }catch(error){this.setNotice('Developer Preset 失败：'+String(error));}
  }

  private equipDeveloperPreset():void{
    const definition=playableClassById(this.scene.character);
    const context={characterId:this.scene.character,family:definition.family,stageId:Number(this.scene.character),level:this.rewards.progression.level};
    let inventory=this.rewards.inventory;
    for(const slot of ['weapon','armor'] as const){
      const rule=M6_RUNTIME_EQUIPMENT_RULES.find(candidate=>
        candidate.slot===slot&&
        inventory.items.some(item=>item.itemId===candidate.itemId&&item.quantity>0)&&
        evaluateM6EquipmentEligibility(candidate,context).allowed
      );
      if(rule)inventory=equipProgression(inventory,this.scene.character,slot,rule.itemId,CLASS_RESOLVER);
    }
    this.rewards={...this.rewards,inventory};
    this.m6Equipment={weapon:inventory.equipped.weapon,armor:inventory.equipped.armor,accessory:this.m6Equipment.accessory};
    this.syncSceneInventory();
  }

  private m7Level():number{return Math.min(65,Math.max(1,this.rewards.progression.level));}

  private reconcileM7Skills(oldLevel:number):void{
    const previous=Math.min(65,Math.max(1,oldLevel));
    const next=this.m7Level();
    const family=playableClassById(this.scene.character).family;
    if(this.m7Skills.family!==family||next<previous){
      this.m7Skills=createM7IntegratedSkillState(this.scene.character,next);
      return;
    }
    if(next>previous)this.m7Skills=reconcileM7IntegratedSkillState(this.m7Skills,this.scene.character,previous,next);
  }

  private reconcileM7Attributes(receiptId:string):void{
    const next=this.m7Level();
    if(next>this.attributeState.level)this.attributeState=grantAttributeLevels(this.attributeState,next,receiptId);
  }

  private runtimeSkillCommands():readonly M7RuntimeSkillCommand[]{
    return m7RuntimeSkillCommands(
      this.m7Skills,
      this.scene.character,
      this.m7Level(),
      this.developerMode&&this.developerUnlockAllSkills,
    );
  }

  private skillAllowedForRuntime(_characterId:string|number,skillId:number):boolean{
    return this.runtimeSkillCommands().some(command=>command.authoredSkillId===skillId);
  }

  private executeSkillCommand(command:M7RuntimeSkillCommand,targetCell:M7GridCell|null=null):void{
    const result=targetCell
      ?useM7SkillTargeted(this.scene.state,{targetId:this.scene.selectedEnemy,targetCell},this.scene.anchor.x,this.scene.anchor.y,command)
      :useM7Skill(this.scene.state,this.scene.selectedEnemy,this.scene.anchor.x,this.scene.anchor.y,command);
    reconcileBattlePhase(this.scene.state);
    this.setNotice(result.message);
    if(!result.ok){this.render(this.scene.snapshot());return;}
    for(const event of result.events){
      this.scene.presentBattleFeedback({
        kind:event.effect??'DAMAGE',
        target:event.target,
        amount:event.amount,
        tone:event.source==='poison'?'poison':'damage',
      });
    }
    const feedbackLabels:Record<string,Readonly<{label:string;tone:'buff'|'debuff'|'control'|'poison'}>>={
      DARK_VEIL_APPLIED:{label:'黑暗之帐',tone:'debuff'},
      NATURE_FORCE_APPLIED:{label:'自然力量',tone:'buff'},
      HEALING_BLOCK_APPLIED:{label:'灰烬·禁疗',tone:'debuff'},
      PETRIFY_APPLIED:{label:'诅咒之眼·石化',tone:'control'},
      BLIND_APPLIED:{label:'失明',tone:'debuff'},
      CURSE_WINDOW_APPLIED:{label:'诅咒之剑',tone:'debuff'},
    };
    for(const feedback of result.feedbackEvents??[]){
      if(feedback.kind==='POISON_INITIAL_DAMAGE')continue;
      const view=feedbackLabels[feedback.kind];
      if(view)this.scene.presentBattleFeedback({kind:feedback.kind,target:feedback.targetId,label:view.label,tone:view.tone});
    }
    if(command.family==='swordsman'){
      const swordLabels:Partial<Record<string,Readonly<{label:string;tone:'buff'|'control'}>>>={
        '1301':{label:'强防',tone:'buff'},
        '1401':{label:'爆发',tone:'buff'},
        '1501':{label:'舍身',tone:'buff'},
        'battle-command':{label:'战斗命令',tone:'buff'},
      };
      const view=swordLabels[String(command.skillKey)];
      if(view&&command.target==='self')this.scene.presentBattleFeedback({kind:'BUFF_GAINED',target:'player',label:view.label,tone:view.tone});
      for(const enemyId of result.affectedEnemyIds){
        const enemy=this.scene.state.enemies.find(row=>row.id===enemyId);
        if(enemy?.m7Status.swordsman.some(status=>status.kind==='stun')){
          this.scene.presentBattleFeedback({kind:'STUN_APPLIED',target:enemyId,label:'眩晕',tone:'control'});
        }
      }
    }
    const visual=visualSkillForCommand(command);
    const magicResourceId=visual?.magic_pattern?.magic_resources?.[0]?.magic_resource_id;
    const explicitOrigin=targetCell?(()=>{const [x,y]=referenceCellToScreen(targetCell);return{x,y};})():undefined;
    this.scene.presentM7SkillAction(result.affectedEnemyIds,magicResourceId,command.target==='self',explicitOrigin);
    const animation=this.scene.animation();
    this.present(this.presentation.attack({rawTiming:animation.raw_timing,frameCount:animation.frames_per_direction}));
    if(visual){
      const target=this.scene.state.enemies.find(enemy=>enemy.id===this.scene.selectedEnemy&&enemy.hp>0);
      const effectTarget=explicitOrigin??(target?{x:target.x,y:target.y}:null);
      const resources=(visual.magic_pattern?.magic_resources??[]).flatMap(resource=>{
        const effect=this.scene.pack.effects[String(resource.magic_resource_id)];
        return effect?[{resourceId:resource.magic_resource_id,rawTiming:effect.raw_timing,frameCount:effect.frame_count,role:resource.role,rawStartTick:resource.start_tick}]:[];
      });
      if(resources.length)this.present(this.presentation.magicEffect({resources,context:{caster:{...this.scene.anchor},target:effectTarget}}));
    }
    this.render(this.scene.snapshot());
  }

  private useSkill(commandId:string|number):void{
    try{
      const command=this.runtimeSkillCommands().find(row=>row.id===String(commandId)||row.authoredSkillId===Number(commandId));
      if(!command)throw new Error('当前职业/阶段不能使用该技能');
      if(command.family==='wizard'&&command.skillKey==='poison-mist'){
        this.beginBattleTargeting(command);
        return;
      }
      this.clearBattleTargeting(false);
      this.executeSkillCommand(command);
    }catch(error){this.setNotice(String(error));this.render(this.scene.snapshot());}
  }

  private rest():void{
    if(!this.scene.inBattleView||!actionReady(this.scene.state)){this.setNotice('当前不能休息：请等待行动槽就绪');return;}
    if(!consumeAction(this.scene.state,this.scene.state.restReadinessCost)){this.setNotice('休息指令未执行');return;}
    this.setNotice('休息：已按恢复出的 REST readiness cost 消耗行动槽；额外效果尚无原版证据。');
  }

  private trainingRecovery(kind:'hp'|'mp'):void{
    if(!this.scene.canAct()){this.setNotice('当前不能恢复：请等待行动槽就绪并结束当前动作');return;}
    const result=applyInfiniteTrainingRecovery(this.scene.state,kind);
    if(!result.ok){
      const label=kind==='hp'?'HP':'MP';
      this.setNotice(result.reason==='already-full'?label+' 已满，未消耗 readiness':'当前不能执行 '+label+' Recovery');
      this.render(this.scene.snapshot());
      return;
    }
    this.setNotice((kind==='hp'?'HP':'MP')+' Recovery +'+result.restored+'；readiness -'+result.readinessSpent+' / '+result.provenance);
    this.render(this.scene.snapshot());
  }

  private startTrainingBattle(id:number):void{
    if(this.scene.inBattleView){this.setNotice('当前已在战斗中');return;}
    if(this.scene.route.length){this.setNotice('请等待移动结束后再开始训练战');return;}
    try{
      const preset=trainingBattleById(id);
      this.selectedTrainingBattleId=preset.id;
      this.activeDialogue=null;
      this.trainingManagerOpen=false;
      this.pendingEncounter=null;
      this.menuOpen=false;
      this.trainingLaunchPending=true;
      this.scene.enterBattle();
      if(!this.scene.inBattleView){
        this.trainingLaunchPending=false;
        this.activeTrainingBattleId=null;
        this.setNotice('Training Battle #'+preset.id+' 未能启动');
        this.render(this.scene.snapshot());
        return;
      }
      const integrated=integratedTrainingBattleById(preset.id);
      const actualZone=this.scene.state.battleZoneId;
      const sceneNote=actualZone===preset.battleZoneId?'场景绑定已匹配':(!this.scene.pack.maps[String(preset.battleZoneId)]?'synthetic 缺 Zone '+preset.battleZoneId+'，已显式 fallback 至 '+String(actualZone):'场景绑定失败：expected '+preset.battleZoneId+', got '+String(actualZone));
      const levels=integrated.enemies.map(enemy=>enemy.fixedLevel).join('/');
      this.setNotice('Training Battle #'+preset.id+'：Fixed Enemy Lv.'+levels+' / '+sceneNote);
      this.render(this.scene.snapshot());
    }catch(error){this.trainingLaunchPending=false;this.setNotice(String(error));}
  }

  private requestBattleExit():void{
    if(!this.scene.inBattleView||this.scene.state.phase!=='active'){this.setNotice('当前没有可退出的进行中战斗');return;}
    this.menuOpen=false;
    this.battleExitConfirm=true;
    this.scene.battlePaused=true;
    this.render(this.scene.snapshot());
  }

  private cancelBattleExit():void{
    if(!this.battleExitConfirm)return;
    this.battleExitConfirm=false;
    if(this.scene.inBattleView&&this.scene.state.phase==='active')this.scene.battlePaused=false;
    this.render(this.scene.snapshot());
  }

  private confirmBattleExit():void{
    if(!this.battleExitConfirm)return;
    if(!this.scene.inBattleView||this.scene.state.phase!=='active'){
      this.battleExitConfirm=false;
      this.render(this.scene.snapshot());
      return;
    }
    this.battleExitConfirm=false;
    this.retreatFromBattle();
  }

  private retreatFromBattle():void{
    const storyBattle=this.activeChapter1StoryBattle;
    const wildBattle=this.activeCh1WildBattle;
    this.clearBattleTargeting(false);
    this.scene.leaveBattle();
    this.applyClassProfile(false);
    this.scene.gold=this.rewards.gold;
    this.world={...this.world,world:this.currentWorldState()};
    this.pendingEncounter=null;
    this.activeTrainingBattleId=null;
    this.activeChapter1StoryBattle=null;
    this.trainingLaunchPending=false;
    this.lastSnapshot=null;
    this.suppressEncounterUntilLeave=!storyBattle&&!wildBattle;
    if(wildBattle)this.ch1WildState=suppressCh1WildEncounterUntilLeave(this.ch1WildState,wildBattle.entityId,wildBattle.generation);
    this.activeCh1WildBattle=null;
    if(storyBattle){
      const returnCell=storyBattle.gateCell;
      this.chapter1StorySuppressedUntilLeaveGate=true;
      this.chapter1StoryLastResolution=Object.freeze({
        sourceId:storyBattle.sourceId,
        outcome:'retreated',
        fieldMapId:storyBattle.fieldMapId,
        gateCell:Object.freeze([returnCell[0],returnCell[1]]) as Cell,
        battleZoneId:storyBattle.battleZoneId,
        returnMapId:storyBattle.fieldMapId,
        returnCell:Object.freeze([returnCell[0],returnCell[1]]) as Cell,
        rewardSettlement:'not-applied',
        victoryCondition:'m4-battle-phase-won',
        bossVictorySourceFlag:true,
        bossVictoryRuntimeEnforced:false,
        replayPolicy:'after-leave-all-nine-gate-cells',
        triggerSemantics:'movement-complete-gate-cell-offline-policy',
        evidenceLevel:'RECOVERED_SECONDARY',
        runtimeVerified:false,
      });
    }
    if(this.spatial){
      const actor=this.currentWorldState();
      this.spatial.start({mapId:actor.mapId,cell:[actor.x,actor.y]});
    }
    this.setNotice(storyBattle
      ?'已撤离 Story source 1：未结算奖励，返回 map1030 原 gate 位置；离开九格 gate 区域后可再次触发 / RECOVERED_SECONDARY / runtimeVerified=false。'
      :'已退出战斗：未结算奖励，任务目标保持未完成。离开怪物触发范围后可再次进入战斗。');
    this.render(this.scene.snapshot());
  }

  private beginNpcInteraction(entityId:string|undefined,inputSource:Exclude<NpcInteractionInputSource,'compatibility'>):void{
    if(this.scene.inBattleView)return;
    const actor=this.currentWorldState();
    this.world={...this.world,world:actor};
    const entities=this.chapter1World&&this.chapter1Authority
      ?[this.chapter1Authority.npc]
      :this.m5World
        ?[this.m5World.trainingManager.entity,this.m5World.content.guide.entity]
        :WORLD_ENTITIES.filter(entity=>entity.kind==='npc');
    const entity=entityId?entities.find(candidate=>candidate.id===entityId):entities.find(candidate=>canInteract(candidate,actor));
    if(!entity){
      if(!this.m5World&&!this.chapter1World&&!entityId){
        const objective=WORLD_ENTITIES.find(candidate=>candidate.kind!=='npc'&&canInteract(candidate,actor));
        if(objective){this.interactWorld(objective.id);return;}
      }
      this.activeDialogue=null;
      this.activeChapter1Dialogue=null;
      this.trainingManagerOpen=false;
      this.setNotice(entityId?'当前 NPC 不能交互':'附近没有可交互 NPC');
      this.render(this.scene.snapshot());
      return;
    }
    if(this.chapter1World&&this.chapter1Authority&&entity.id===this.chapter1Authority.npc.id){
      const state=this.chapter1Quest1Selection;
      if(!state)throw new Error('Chapter 1 Quest1 selection state is not initialized');
      const resolved=this.chapter1Authority.beginNpcInteraction(state,actor,{
        entityId:entity.id,
        mapId:actor.mapId,
        actorX:actor.x,
        actorY:actor.y,
        inputSource,
        provenance:'RECONSTRUCTION_POLICY',
      });
      this.activeDialogue=null;
      this.trainingManagerOpen=false;
      if(!resolved.accepted){
        this.activeChapter1Dialogue=null;
        this.setNotice(`吉奥老师交互未开启：${resolved.reason}`);
        this.render(this.scene.snapshot());
        return;
      }
      this.activeChapter1Dialogue=resolved.session;
      this.setNotice('吉奥老师：Quest1 STEP 1 / SELECT / RECOVERED_SECONDARY / runtimeVerified=false');
      this.render(this.scene.snapshot());
      return;
    }
    if(this.m5World&&entity.id===this.m5World.trainingManager.entity.id){
      const manager=resolveM7TrainingManagerInteraction(this.m5World.trainingManager,actor,{
        entityId:entity.id,mapId:actor.mapId,actorX:actor.x,actorY:actor.y,inputSource,provenance:'RECONSTRUCTION_POLICY',
      });
      this.activeDialogue=null;
      if(!manager.accepted){
        this.trainingManagerOpen=false;
        this.setNotice(manager.message);
        this.render(this.scene.snapshot());
        return;
      }
      this.trainingManagerOpen=true;
      this.menuOpen=false;
      this.setNotice('训练管理员：请选择训练关卡。');
      this.render(this.scene.snapshot());
      return;
    }
    this.trainingManagerOpen=false;
    const resolved=this.worldAuthority.beginNpcInteraction(this.world,{
      entityId:entity.id,
      mapId:actor.mapId,
      actorX:actor.x,
      actorY:actor.y,
      inputSource,
      provenance:'RECONSTRUCTION_POLICY',
    });
    if(!resolved.dialogue.accepted){
      this.activeDialogue=null;
      this.setNotice(`NPC 对话未开启：${resolved.dialogue.reason}`);
      this.render(this.scene.snapshot());
      return;
    }
    this.activeDialogue=resolved.dialogue.session;
    this.setNotice(`${this.activeDialogue.view.speaker}：${this.activeDialogue.view.lines.join(' ')}`);
    this.render(this.scene.snapshot());
  }

  private chooseChapter1Quest1Selection():void{
    const session=this.activeChapter1Dialogue;
    const state=this.chapter1Quest1Selection;
    const authority=this.chapter1Authority;
    if(!session||!state||!authority)return;
    const resolved=authority.recordQuest1Selection(state,this.currentWorldState(),session);
    this.activeChapter1Dialogue=null;
    if(!resolved.accepted){
      this.setNotice(`Quest1 SELECT 选择未记录：${resolved.reason} / RECOVERED_SECONDARY / runtimeVerified=false`);
      this.render(this.scene.snapshot());
      return;
    }
    this.chapter1Quest1Selection=resolved.state;
    this.setNotice('Quest1 STEP 1 / SELECT：已记录当前会话的本地选择；服务端接取状态未确认 / RECOVERED_SECONDARY / runtimeVerified=false');
    this.render(this.scene.snapshot());
  }

  private chooseNpcInteraction(choiceId:NpcDialogueChoiceId):void{
    const session=this.activeDialogue;
    if(!session)return;
    const previousStage=this.world.quest.stage;
    const resolved=this.worldAuthority.chooseNpcInteraction(this.world,session,choiceId);
    if(!resolved.outcome.accepted){
      this.setNotice(`NPC 选择未执行：${resolved.outcome.reason}`);
      this.activeDialogue=null;
      this.render(this.scene.snapshot());
      return;
    }
    this.world=resolved.state;
    const action=resolved.outcome.action;
    this.activeDialogue=null;
    if(action==='quest-completed'&&previousStage!=='complete'&&this.world.quest.stage==='complete'){
      this.applyQuestSettlement();
    }else if(action==='quest-accepted'){
      if(!this.m5World&&this.worldAuthority.content.warpOnAccept){
        this.applyWorldState({...this.worldAuthority.content.objectiveEntry});
        this.setNotice('已接受训练委托：已前往外城训练点 / RECONSTRUCTION_POLICY');
      }else this.setNotice('已接受训练委托 / RECONSTRUCTION_POLICY');
    }else if(action==='declined'){
      this.setNotice('暂未接受训练委托');
    }else{
      this.setNotice('对话已关闭');
    }
    this.render(this.scene.snapshot());
  }

  interactWorld(entityId?:string):void{
    if(this.scene.inBattleView)return;
    const actor=this.currentWorldState();
    this.world={...this.world,world:actor};
    const entities=this.m5World?[this.m5World.trainingManager.entity,this.m5World.content.guide.entity,this.m5World.content.objective]:WORLD_ENTITIES;
    const entity=entityId?entities.find(candidate=>candidate.id===entityId):entities.find(candidate=>canInteract(candidate,actor));
    if(!entity){this.setNotice(entityId?'当前 NPC 不能交互':'附近没有可交互对象');return;}
    const previousStage=this.world.quest.stage;
    const resolved=this.worldAuthority.interact(this.world,{entityId:entity.id,mapId:actor.mapId,actorX:actor.x,actorY:actor.y,provenance:'RECONSTRUCTION_POLICY'});
    this.world=resolved.state;
    const result=resolved.result;
    if(result.dialogue)this.setNotice(`${result.dialogue.speaker}：${result.dialogue.lines.join(' ')}`);
    else if(result.reason)this.setNotice(result.reason);
    if(result.warp){
      const next=applyWarp(this.world.world,result.warp);
      this.world={...this.world,world:next};
      this.applyWorldState(next);
    }
    if(result.encounter){
      this.pendingEncounter=result.encounter;
      this.scene.enterBattle();
      if(this.scene.inBattleView&&this.scene.state.battleZoneId!==result.encounter.battleZoneId)this.setNotice(`Encounter zone mismatch: expected ${result.encounter.battleZoneId}, got ${this.scene.state.battleZoneId}`);
    }
    if(previousStage!=='complete'&&this.world.quest.stage==='complete')this.applyQuestSettlement();
    this.render(this.scene.snapshot());
  }

  returnFromBattle():void{
    if(!this.scene.inBattleView)return;
    const phase=this.scene.state.phase;
    if(phase==='active'){this.setNotice('战斗尚未结束');return;}
    if(phase==='safe'){this.setNotice('战斗状态尚未初始化');return;}
    this.battleExitConfirm=false;
    const storyBattle=this.activeChapter1StoryBattle;
    const wildBattle=this.activeCh1WildBattle;
    if(phase==='lost'&&!storyBattle&&!wildBattle)this.suppressEncounterUntilLeave=true;
    let returnState:WorldState|null=null;
    if(storyBattle){
      // boss_victory=true remains source metadata. This offline policy returns
      // on the existing M4 terminal phase 'won'; it does not infer a retail
      // boss identity or claim that the source-specific boss condition ran.
      const victorySpawn=this.chapter1World?.victoryReturn;
      if(phase==='won'&&!victorySpawn)throw new Error('Chapter 1 Story victory requires story-victory-return-01 policy');
      const returnMapId=phase==='won'?victorySpawn!.mapId:storyBattle.fieldMapId;
      const returnCell=phase==='won'?victorySpawn!.effectiveCell:storyBattle.gateCell;
      if(phase==='won')returnState={mapId:returnMapId,x:returnCell[0],y:returnCell[1]};
      this.chapter1StorySuppressedUntilLeaveGate=phase!=='won';
      this.chapter1StoryLastResolution=Object.freeze({
        sourceId:storyBattle.sourceId,
        outcome:phase,
        fieldMapId:storyBattle.fieldMapId,
        gateCell:Object.freeze([storyBattle.gateCell[0],storyBattle.gateCell[1]]) as Cell,
        battleZoneId:storyBattle.battleZoneId,
        returnMapId,
        returnCell:Object.freeze([returnCell[0],returnCell[1]]) as Cell,
        rewardSettlement:'not-applied',
        victoryCondition:'m4-battle-phase-won',
        bossVictorySourceFlag:true,
        bossVictoryRuntimeEnforced:false,
        replayPolicy:'after-leave-all-nine-gate-cells',
        triggerSemantics:'movement-complete-gate-cell-offline-policy',
        evidenceLevel:'RECOVERED_SECONDARY',
        runtimeVerified:false,
      });
    }else if(wildBattle){
      if(phase==='won'){
        const receiptId='ch1-wild-'+wildBattle.generation+'-'+wildBattle.entityId+'-win';
        const oldLevel=this.rewards.progression.level;
        const applied=applyBattleReward(
          this.rewards,
          'ch1-wild:'+wildBattle.entityId,
          receiptId,
          {gold:wildBattle.record.reward.gold,exp:wildBattle.record.reward.exp,items:[{itemId:wildBattle.record.reward.dropItemId,quantity:1}]},
        );
        this.rewards=applied.state;
        if(applied.applied)this.reconcileM7Attributes(receiptId);
        this.reconcileM7Skills(oldLevel);
        this.ch1WildState=markCh1WildEncounterDefeated(this.ch1WildState,wildBattle.entityId,wildBattle.generation);
      }else{
        this.ch1WildState=suppressCh1WildEncounterUntilLeave(this.ch1WildState,wildBattle.entityId,wildBattle.generation);
      }
    }else if(this.pendingEncounter){
      const outcome=phase==='won'?'won':'lost';
      const resolution=this.worldAuthority.resolveBattle(this.world,{battleZoneId:this.scene.state.battleZoneId??-1,outcome});
      this.world=resolution.state;
      returnState=resolution.returnTo??null;
      if(phase==='won')this.applyBattleSettlement();
    }else if(phase==='won'&&this.activeTrainingBattleId!==null){
      this.applyBattleSettlement();
    }
    this.clearBattleTargeting(false);
    this.scene.leaveBattle();
    this.scene.gold=this.rewards.gold;
    if(wildBattle){this.syncSceneInventory();this.applyClassProfile(false);}
    if(returnState)this.applyWorldState(returnState);else this.world={...this.world,world:this.currentWorldState()};
    this.pendingEncounter=null;
    this.activeTrainingBattleId=null;
    this.activeChapter1StoryBattle=null;
    this.activeCh1WildBattle=null;
    this.trainingLaunchPending=false;
    this.lastSnapshot=null;
    this.render(this.scene.snapshot());
  }

  private applyBattleSettlement():void{
    if(this.activeTrainingBattleId!==null){
      const preset=trainingBattleById(this.activeTrainingBattleId);
      const enemies=reconstructionEnemiesForTrainingBattle(preset.id);
      const combatReward=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.rewardForEncounter(
        enemies.map(enemy=>({level:enemy.level,rank:enemy.rank})),
      );
      const oldLevel=this.rewards.progression.level;
      const receiptPrefix='battle:m7-training:'+preset.id+':win:';
      const runNumber=1+this.rewards.rewardReceipts.filter(id=>id.startsWith(receiptPrefix)).length;
      const receiptId=receiptPrefix+runNumber;
      const applied=applyBattleReward(
        this.rewards,
        'm7-training-battle-'+preset.id,
        receiptId,
        {gold:combatReward.gold,exp:preset.expReward},
      );
      this.rewards=applied.state;
      if(applied.applied)this.reconcileM7Attributes(receiptId);
      this.reconcileM7Skills(oldLevel);
      this.scene.gold=this.rewards.gold;
      const levels=applied.events.filter(event=>event.type==='level_up').map(event=>'Lv.'+event.toLevel);
      const skillPoints=applied.events.filter(event=>event.type==='skill_point').length;
      this.setNotice(
        'Training Battle #'+preset.id+' 胜利：Fixed Enemy Lv.'+enemies.map(enemy=>enemy.level).join('/')+
        ' / 金币 +'+combatReward.gold+' / EXP +'+preset.expReward+
        (levels.length?' / LEVEL UP '+levels.join(' → '):'')+
        (skillPoints?' / Skill Point +'+skillPoints:'')+
        ' / RECONSTRUCTION_POLICY'
      );
      return;
    }
    if(this.m5World){
      const level=Math.max(1,this.rewards.progression.level);
      const reward=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.rewardForEncounter([{level,rank:'normal'},{level,rank:'normal'}]);
      const oldLevel=this.rewards.progression.level;
      const receiptId='battle:m5-training-house:win';
      const applied=applyBattleReward(this.rewards,'m5-training-house',receiptId,{gold:reward.gold,exp:reward.exp});
      this.rewards=applied.state;if(applied.applied)this.reconcileM7Attributes(receiptId);this.reconcileM7Skills(oldLevel);this.scene.gold=this.rewards.gold;
      this.setNotice(`战斗胜利：金币 +${reward.gold}，EXP +${reward.exp}，当前 Lv.${this.rewards.progression.level} / RECONSTRUCTION_POLICY`);
      return;
    }
    const oldLevel=this.rewards.progression.level;
    const receiptId='battle:s9-training-run:win';
    const applied=applyBattleReward(this.rewards,'s9-training-battle',receiptId,{gold:10,exp:100});
    this.rewards=applied.state;
    if(applied.applied)this.reconcileM7Attributes(receiptId);
    this.reconcileM7Skills(oldLevel);
    this.scene.gold=this.rewards.gold;
    if(applied.events.some(event=>event.type==='level_up'))this.setNotice(`战斗胜利：金币 +10，EXP +100，当前 Lv.${this.rewards.progression.level}`);
  }

  private applyQuestSettlement():void{
    const questId=this.worldAuthority.content.questId;
    const reward=this.m5World?{gold:7,exp:230,questFlags:['m5.training.complete']}:{gold:5,exp:200,questFlags:['m4.training.complete']};
    const oldLevel=this.rewards.progression.level;
    const receiptId=`quest:${questId}:turn-in`;
    const applied=applyQuestReward(this.rewards,questId,receiptId,reward);
    this.rewards=applied.state;
    if(applied.applied)this.reconcileM7Attributes(receiptId);
    this.reconcileM7Skills(oldLevel);
    this.scene.gold=this.rewards.gold;
    this.applyClassProfile(false);
    this.setNotice(`任务完成：金币 +${reward.gold}，EXP +${reward.exp}，当前 Lv.${this.rewards.progression.level} / RECONSTRUCTION_POLICY`);
  }

  private acceptanceSetGold(amount:number):void{
    if(!navigator.webdriver)throw new Error('S45 acceptance gold fixture is automation-only');
    if(this.scene.inBattleView)throw new Error('S45 acceptance gold fixture requires field mode');
    if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Invalid S45 acceptance gold amount');
    this.rewards={...this.rewards,gold:amount};
    this.scene.gold=amount;
    this.setNotice('S45 acceptance fixture：测试金币已设置为 '+amount+' G');
    this.render(this.scene.snapshot());
  }

  private acceptanceOpenShop(shopId:string):boolean{
    if(!navigator.webdriver)throw new Error('S45 shop acceptance entry is automation-only');
    const shop=getCh1ShopById(shopId);if(!shop)throw new Error('Unknown S45 shop');
    this.activeShopId=shop.id;this.equipmentPanelOpen=false;this.inventoryOpen=false;this.render(this.scene.snapshot());return true;
  }
  private buyShopItem(shopId:string,itemId:number,transactionId:string):void{
    if(this.scene.inBattleView){this.setNotice('战斗中不能购买商品');return;}
    const result=purchaseShopItem({shopId,itemId,quantity:1,transactionId,gold:this.rewards.gold,inventory:this.rewards.inventory,shopState:this.shopState});
    if(!result.ok){this.setNotice('购买失败：'+result.reason+' / RECONSTRUCTION_POLICY');return;}
    this.rewards={...this.rewards,gold:result.gold,inventory:result.inventory};this.shopState=result.shopState;this.syncSceneInventory();
    this.setNotice(result.applied?'购买成功：金币与背包已更新':'交易已处理：未重复扣款');this.render(this.scene.snapshot());
  }
  private usePotion(itemId:number):void{
    const result=useShopPotion({inventory:this.rewards.inventory,itemId,vitals:{hp:this.scene.state.hp,maxHp:this.scene.state.maxHp,mp:this.scene.state.mp,maxMp:this.scene.state.maxMp},inBattle:this.scene.inBattleView});
    if(!result.ok){
      const messages:Record<string,string>={'effect-unknown':'无法使用：药品恢复量缺少原始数值证据（UNKNOWN）；药品与 HP/MP 均未改变。','in-battle':'战斗中不能使用药品。','empty-inventory':'背包中没有该药品。','already-full':'对应状态已满，未消耗药品。','not-a-potion':'该物品不是已登记药品。','invalid-vitals':'角色 HP/MP 状态无效。'};
      this.setNotice(messages[result.reason]??('药品使用失败：'+result.reason));this.render(this.scene.snapshot());return;
    }
    this.rewards={...this.rewards,inventory:result.inventory};this.scene.state.hp=result.vitals.hp;this.scene.state.mp=result.vitals.mp;this.syncSceneInventory();
    this.setNotice('药品使用成功：'+result.resource.toUpperCase()+' 恢复 '+result.restored);this.render(this.scene.snapshot());
  }

  private currentEquipmentAttributes(){
    return {con:10+totalAttributeValue(this.attributeState,'con'),wis:10+totalAttributeValue(this.attributeState,'wis'),str:10+totalAttributeValue(this.attributeState,'str'),dex:10+totalAttributeValue(this.attributeState,'dex'),int:10+totalAttributeValue(this.attributeState,'int'),reg:10+totalAttributeValue(this.attributeState,'reg')};
  }

  private equipEquipmentPanelItem(rawSlot:string|undefined,rawItemId:string|null|undefined):void{
    if(this.scene.inBattleView){this.setNotice('战斗中不能更换装备');return;}
    if(!['weapon','armor','accessory'].includes(String(rawSlot))){this.setNotice('非法装备槽位');return;}
    const slot=rawSlot as M6EquipmentSlot;
    const itemId=rawItemId===null?null:Number(rawItemId);
    if(itemId!==null&&!Number.isSafeInteger(itemId)){this.setNotice('非法物品 ID');return;}
    const definition=playableClassById(this.scene.character);
    try{
      this.m6Equipment=equipM6Item(this.m6Equipment,this.rewards.inventory,M6_RUNTIME_EQUIPMENT_RULES,
        {characterId:this.scene.character,family:definition.family,stageId:Number(this.scene.character),level:this.rewards.progression.level,attributes:this.currentEquipmentAttributes()},slot,itemId);
      if(slot!=='accessory'){
        const inventory=validateInventory({...this.rewards.inventory,equipped:{...this.rewards.inventory.equipped,[slot]:itemId}});
        this.rewards={...this.rewards,inventory};
      }
      this.syncSceneInventory();
      this.applyClassProfile(false);
      this.setNotice(itemId===null?'装备已卸下；旧装备仍保留在背包':'装备已更新；旧装备仍保留在背包 / RECONSTRUCTION_POLICY');
    }catch(error){this.setNotice('装备操作失败：'+String(error));}
    this.render(this.scene.snapshot());
  }

  private combatEquipment(){
    const bonus=m6EquipmentStatContribution(this.m6Equipment,M6_RUNTIME_EQUIPMENT_RULES);
    const attributes=projectAttributeCombatBonuses(this.attributeState);
    const level=Math.max(1,this.rewards.progression.level);
    const statScale=1+DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.tuning.level.playerStatGrowth*(level-1);
    return{
      maxHp:attributes.maxHp,
      maxMp:attributes.maxMp,
      attack:bonus.attack+attributes.attack/statScale,
      defense:bonus.defense+attributes.defense/statScale,
      magicAttack:bonus.magicAttack+attributes.magicAttack/statScale,
      magicDefense:bonus.magicDefense+attributes.magicDefense/statScale,
    };
  }

  private playerCombatStats(){
    return DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.playerStats(this.scene.character,Math.max(1,this.rewards.progression.level),this.combatEquipment());
  }

  private playerExpHud():Readonly<{exp:number;expMax:number}>{
    const progression=this.rewards.progression;
    const maxLevel=progression.policyId===M71_EXPERIENCE_POLICY.id?M71_EXPERIENCE_POLICY.maxLevel:RECONSTRUCTION_PROGRESSION_POLICY.maxLevel;
    if(progression.level>=maxLevel)return Object.freeze({exp:1,expMax:1});
    const start=totalExpForLevel(progression.level,progression.policyId);
    const next=totalExpForLevel(progression.level+1,progression.policyId);
    return Object.freeze({exp:Math.max(0,progression.exp-start),expMax:Math.max(1,next-start)});
  }

  private playerPresentationStats():Readonly<{atk:number;def:number}>{
    const base=this.scene.inBattleView&&this.scene.state.combatPlayerStats
      ?this.scene.state.combatPlayerStats
      :this.playerCombatStats();
    const statuses=this.scene.inBattleView?this.scene.state.playerM7Status.swordsman:Object.freeze([]);
    const family=playableClassById(this.scene.character).family;
    const atk=family==='wizard'?base.magicAttack:m7EffectivePhysicalAttack(base.attack,statuses);
    const def=m7EffectiveDefense(base.defense,statuses);
    return Object.freeze({atk,def});
  }

  private statusDuration(ms:number|null|undefined):string|undefined{
    if(ms===null)return '本场';
    if(ms===undefined||ms<=0)return undefined;
    return Math.ceil(ms/1000)+'s';
  }

  private battleStatusViews():readonly BattleStatusView[]{
    if(!this.scene.inBattleView)return Object.freeze([]);
    const rows:BattleStatusView[]=[];
    const add=(id:string,label:string,tone:BattleStatusView['tone'],ms?:number|null)=>{
      rows.push(Object.freeze({id,label,tone,...(this.statusDuration(ms)?{durationText:this.statusDuration(ms)}:{})}));
    };
    for(const status of this.scene.state.playerM7Status.swordsman){
      const labels:Record<string,string>={
        '1301':'强防','1401':'爆发','1501':'舍身','battle-command':'战斗命令',
        '1101':'眩晕','stun-strike':'眩晕',
      };
      const label=labels[status.sourceSkillKey]??status.sourceSkillKey;
      add('player:'+status.id,label,status.kind==='stun'?'control':'buff',status.remainingMs);
    }
    const playerWizard=this.scene.state.playerM7Status.wizard;
    if(playerWizard.natureForce)add('player:nature-force','自然力量','buff',playerWizard.natureForce.remainingMs);

    const target=this.scene.state.enemies.find(enemy=>enemy.id===this.scene.selectedEnemy&&enemy.hp>0);
    if(target){
      for(const status of target.m7Status.swordsman){
        if(status.kind==='stun')add('target:'+status.id,'眩晕','control',status.remainingMs);
      }
      const wizard=target.m7Status.wizard;
      if(wizard.darkVeil)add('target:dark-veil','黑暗之帐','debuff',wizard.darkVeil.remainingMs);
      if(wizard.poison)add('target:poison','毒雾','poison',wizard.poison.remainingMs);
      if(wizard.healingBlockedMs>0)add('target:ashes','灰烬·禁疗','debuff',wizard.healingBlockedMs);
      if(wizard.petrifiedMs>0)add('target:petrified','诅咒之眼·石化','control',wizard.petrifiedMs);
      if(wizard.blind)add('target:blind','失明','debuff',wizard.blind.remainingMs);
      if(wizard.cursedSword)add('target:cursed-sword','诅咒之剑','debuff',wizard.cursedSword.remainingMs);
    }
    return Object.freeze(rows);
  }

  private prepareReconstructionBattle(trainingBattleId:number|null=null):void{
    const level=Math.max(1,this.rewards.progression.level);
    if(trainingBattleId!==null){
      const preset=trainingBattleById(trainingBattleId);
      this.scene.setReconstructionBattleSetup({
        ...reconstructionSetupForTrainingBattle(preset,this.scene.character,level,this.combatEquipment()),
        enemies:reconstructionEnemiesForTrainingBattle(trainingBattleId),
      });
      return;
    }
    if(!this.m5World){this.scene.setReconstructionBattleSetup(undefined);return;}
    this.scene.setReconstructionBattleSetup({
      playerClassId:this.scene.character,level,equipment:this.combatEquipment(),
      enemyLevel:level,enemyRank:'normal'
    });
  }

  private prepareChapter1WildBattle(record:Ch1WildEncounterRecord):void{
    const playerLevel=Math.max(1,this.rewards.progression.level);
    const enemyLevel=record.minimumLevel;
    const template=DEFAULT_RECONSTRUCTION_COMBAT_BALANCE.enemyStats({id:record.name,level:enemyLevel,rank:'normal',role:'melee'});
    this.scene.setReconstructionBattleSetup({
      playerClassId:this.scene.character,
      level:playerLevel,
      equipment:this.combatEquipment(),
      enemyLevel,
      enemyRank:'normal',
      enemies:[{
        id:record.name,
        level:enemyLevel,
        rank:'normal',
        role:'melee',
        maxHp:record.maxHp,
        maxMp:record.maxMp,
        attack:template.attack,
        defense:template.defense,
        magicAttack:template.magicAttack,
        magicDefense:template.magicDefense,
        movementRangeCells:1,
        attackRangeCells:1,
        traits:[],
        abilities:[],
      }],
    });
  }

  private applyClassProfile(resetVitals:boolean):void{
    if(!M6_CHARACTER_IDS.includes(this.scene.character))return;
    const profile=battleProfileForClass(this.scene.character);
    if(!this.scene.inBattleView){
      const stats=this.playerCombatStats();
      const currentHp=this.scene.state.hp;
      const currentMp=this.scene.state.mp;
      this.scene.state.maxHp=stats.maxHp;
      this.scene.state.maxMp=stats.maxMp;
      this.scene.state.hp=resetVitals?stats.maxHp:Math.min(currentHp,stats.maxHp);
      this.scene.state.mp=resetVitals?stats.maxMp:Math.min(currentMp,stats.maxMp);
    }
    this.scene.state.moveReadinessCost=profile.movementReadinessCost;
    this.scene.state.attackReadinessCost=profile.attackReadinessCost;
    this.scene.state.restReadinessCost=profile.restReadinessCost;
    this.scene.state.magicReadinessCost=magicReadinessCost(profile,this.scene.state.actionMax);
  }

  private syncSceneInventory():void{
    this.scene.inventory={
      owned:this.rewards.inventory.items.map(item=>item.itemId),
      weapon:this.m6Equipment.weapon,
      armor:this.m6Equipment.armor,
    };
    this.scene.gold=this.rewards.gold;
  }

  private currentWorldState():WorldState{
    const cell=nearestAnchor(this.scene.anchor.x,this.scene.anchor.y);
    return{mapId:this.scene.mapId,x:cell[0],y:cell[1]};
  }

  private applyWorldState(state:WorldState):void{
    if(this.scene.inBattleView)return;
    this.activeDialogue=null;
    this.activeChapter1Dialogue=null;
    if(this.chapter1World&&!this.chapter1World.mapIds.includes(state.mapId as 1000|1020|1030|1060)){
      throw new Error('Chapter 1 mode cannot load map '+state.mapId);
    }
    this.scene.setMap(state.mapId);
    const [x,y]=referenceCellToScreen([state.x,state.y]);
    this.scene.anchor={x,y};
    this.scene.route=[];
    if(this.chapter1World){
      this.scene.setPlayerCameraFollow(true);
      this.scene.focusPlayer();
      this.chapter1Spatial?.start({mapId:state.mapId,cell:[state.x,state.y]});
    }else if(this.m5World){
      this.scene.focusPlayer();
      this.spatial?.start({mapId:state.mapId,cell:[state.x,state.y]});
    }else this.scene.fit();
    this.world={...this.world,world:{...state}};
  }

  private saveContext():SaveValidationContext{
    const mapBounds:Record<number,{width:number;height:number}>={};
    for(const map of Object.values(this.scene.pack.maps))mapBounds[map.manifest.id]={width:map.manifest.render.width,height:map.manifest.render.height};
    return{pack:this.scene.pack.digest,characters:M6_CHARACTER_IDS,mapBounds};
  }

  makeSave():M7SaveV2{
    if(this.scene.inBattleView)throw new Error('战斗中不能存档');
    if(this.scene.route.length)throw new Error('请等待移动结束后再存档');
    if(this.developerPresetActive||this.developerUnlockAllSkills)throw new Error('Developer Preset / Debug Skill Override 不写入普通 SaveV2；请新建职业档或重新读取普通存档后再保存');
    const m6=createM6SaveExtension(this.scene.character,{
      stage:this.m6Stage,
      questChain:m6QuestChainForLegacyStage(this.world.quest.stage,this.rewards.questFlags),
      equipment:this.m6Equipment,
    });
    return{
      kind:SAVE_KIND,version:CURRENT_SAVE_VERSION,pack:this.scene.pack.digest,character:this.scene.character,mapId:this.scene.mapId,
      x:this.scene.anchor.x,y:this.scene.anchor.y,gold:this.rewards.gold,inventory:this.rewards.inventory,
      quest:{questId:this.world.quest.questId,stage:this.world.quest.stage,ch1ShopState:this.shopState,ch1WildState:this.ch1WildState as unknown as JsonValue} as JsonValue,
      questFlags:{...this.rewards.questFlags},progression:{...this.rewards.progression},rewardReceipts:[...this.rewards.rewardReceipts],m6,
      m7:createM7SaveExtension(this.scene.character,this.m7Level(),this.m7Skills,{hp:this.scene.state.hp,mp:this.scene.state.mp},this.attributeState),savedAt:new Date().toISOString(),
    };
  }

  async save():Promise<void>{
    try{const save=this.makeSave();await writeM4Save(save);this.setNotice('M4 v2 存档已写入浏览器 IndexedDB');}
    catch(error){this.setNotice(`存档失败：${String(error)}`);}
  }

  async load():Promise<void>{
    try{const raw=await readM4Save();if(raw===undefined)throw new Error('没有可读取的存档');this.restore(raw);}
    catch(error){this.setNotice(`读档失败：${String(error)}`);}
  }

  exportJson():string{return serializeM7SaveV2(this.makeSave(),this.saveContext(),M6_SAVE_CONTENT);}

  restore(raw:unknown):void{
    if(this.scene.inBattleView)throw new Error('请先结束战斗再读档');
    this.activeDialogue=null;
    this.activeChapter1Dialogue=null;
    if(this.chapter1Authority)this.chapter1Quest1Selection=this.chapter1Authority.initialQuest1State();
    this.trainingManagerOpen=false;
    this.attributePanelOpen=false;
    this.attributeDraft=null;
    this.activeTrainingBattleId=null;
    this.trainingLaunchPending=false;
    this.developerPresetActive=false;
    this.developerUnlockAllSkills=false;
    this.developerSkillPoints=0;
    const save=migrateSaveToM7(raw,this.saveContext(),M6_SAVE_CONTENT);
    if(this.chapter1World&&!this.chapter1World.mapIds.includes(save.mapId as 1000|1020|1030|1060))throw new Error('Chapter 1 save map is outside the route graph: '+save.mapId);
    const questRaw=save.quest&&typeof save.quest==='object'&&!Array.isArray(save.quest)?save.quest as Record<string,JsonValue>:null;
    this.shopState=questRaw?.ch1ShopState===undefined?createShopRuntimeState():validateShopRuntimeState(questRaw.ch1ShopState);
    this.ch1WildState=questRaw?.ch1WildState===undefined?createCh1WildEncounterState():validateCh1WildEncounterState(questRaw.ch1WildState);
    this.activeCh1WildBattle=null;
    const quest=parseM4Quest(save.quest,this.worldAuthority.content.questId);
    this.rewards={gold:save.gold,inventory:save.inventory,progression:save.progression,questFlags:save.questFlags,rewardReceipts:save.rewardReceipts};
    this.m6Equipment=save.m6.equipment;
    this.world={world:{mapId:save.mapId,...(()=>{const cell=nearestAnchor(save.x,save.y);return{x:cell[0],y:cell[1]};})()},quest};
    this.scene.setCharacter(save.character);
    this.m6Stage=save.m6.stage;
    this.m7Skills=save.m7.skills;
    this.attributeState=save.m7.attributes;
    this.attributePanelOpen=false;
    this.attributeDraft=null;
    this.scene.setMap(save.mapId);
    this.scene.anchor={x:save.x,y:save.y};
    this.scene.route=[];
    this.applyClassProfile(false);
    if(save.m7.vitals){
      this.scene.state.hp=Math.min(this.scene.state.maxHp,save.m7.vitals.hp);
      this.scene.state.mp=Math.min(this.scene.state.maxMp,save.m7.vitals.mp);
    }
    this.syncSceneInventory();
    if(this.chapter1World){this.scene.setPlayerCameraFollow(true);this.scene.focusPlayer();const cell=nearestAnchor(save.x,save.y);this.chapter1Spatial?.start({mapId:save.mapId,cell});}
    else if(this.m5World){this.scene.setPlayerCameraFollow(true);this.scene.focusPlayer();const cell=nearestAnchor(save.x,save.y);this.spatial?.start({mapId:save.mapId,cell});}
    else this.scene.fit();
    this.setNotice(`存档恢复成功 / schema v${CURRENT_SAVE_VERSION}`);
    this.render(this.scene.snapshot());
  }

  private onSnapshot(snapshot:Snapshot):void{
    if(!snapshot.inBattleView&&this.battleTargetingState.phase==='aiming')this.clearBattleTargeting(false);
    if(this.lastSnapshot&&snapshot.inBattleView){
      for(const enemy of snapshot.enemies){
        const previous=this.lastSnapshot.enemies.find(entry=>entry.id===enemy.id);
        if(previous&&enemy.hp<=0&&previous.hp>0)this.present(this.presentation.deathOf('enemy',enemy.id));
      }
      if(this.lastSnapshot.phase!==snapshot.phase&&(snapshot.phase==='won'||snapshot.phase==='lost')){
        this.present(this.presentation.terminal(snapshot.phase));
        if(snapshot.phase==='lost')this.present(this.presentation.deathOf('player','player'));
      }
    }
    if(!snapshot.inBattleView){
      this.world={...this.world,world:this.currentWorldState()};
      if(this.handleM5Spatial()||this.handleChapter1Spatial()||this.handleChapter1StoryGate(snapshot)||this.handleChapter1WildEncounter(snapshot))return;
    }
    this.lastSnapshot=snapshot;
    this.render(snapshot);
  }

  private handleM5Spatial():boolean{
    if(!this.m5World||!this.spatial||this.scene.inBattleView)return false;
    const actor=this.currentWorldState();
    let update;
    try{update=this.spatial.update({mapId:actor.mapId,cell:[actor.x,actor.y]});}
    catch{return false;}
    if(update.transition){
      if(this.world.quest.stage==='not_started'){
        this.spatial.rejectPending();this.setNotice('先与训练引导员交谈并接取任务，再进入训练屋。');return false;
      }
      const committed=this.spatial.commit(update.transition);
      const next={mapId:committed.mapId,x:committed.cell[0],y:committed.cell[1]};
      this.world={...this.world,world:next};
      if(committed.mapId===this.m5World.content.objectiveMapId)this.world=this.worldAuthority.arriveObjectiveMap(this.world,committed.mapId);
      this.applyWorldState(next);
      this.setNotice(committed.mapId===this.m5World.content.objectiveMapId?'已自动进入训练屋 / RECONSTRUCTION_POLICY':'已离开训练屋，返回外城 / RECONSTRUCTION_POLICY');
      this.lastSnapshot=null;this.render(this.scene.snapshot());return true;
    }
    const nearObjective=actor.mapId===this.m5World.content.objectiveMapId&&canInteract(this.m5World.content.objective,actor);
    if(this.suppressEncounterUntilLeave){
      if(!nearObjective)this.suppressEncounterUntilLeave=false;
      else return false;
    }
    if(this.world.quest.stage==='objective'&&nearObjective&&!this.pendingEncounter&&!this.scene.route.length){
      const resolved=this.worldAuthority.interact(this.world,{entityId:this.m5World.content.objective.id,mapId:actor.mapId,actorX:actor.x,actorY:actor.y,provenance:'RECONSTRUCTION_POLICY'});
      this.world=resolved.state;
      if(resolved.result.encounter){
        this.pendingEncounter=resolved.result.encounter;this.scene.enterBattle();
        this.setNotice('接近训练怪物：进入战斗 / RECONSTRUCTION_POLICY');
        return true;
      }
    }
    return false;
  }

  private handleChapter1Spatial():boolean{
    const policy=this.chapter1World,controller=this.chapter1Spatial;
    if(!policy||!controller||this.scene.inBattleView||!policy.mapIds.includes(this.scene.mapId as 1000|1020|1030|1060))return false;
    const actor=this.currentWorldState();
    const update=controller.update({mapId:actor.mapId,cell:[actor.x,actor.y]});
    if(!update.transition)return false;
    const committed=controller.commit(update.transition);
    const next={mapId:committed.mapId,x:committed.cell[0],y:committed.cell[1]};
    this.activeDialogue=null;
    this.activeChapter1Dialogue=null;
    if(actor.mapId===1020&&committed.mapId!==1020)this.ch1WildState=markCh1WildMapLeft(this.ch1WildState);
    else if(actor.mapId!==1020&&committed.mapId===1020)this.ch1WildState=markCh1WildMapEntered(this.ch1WildState);
    this.scene.setMap(committed.mapId);
    const [x,y]=referenceCellToScreen(committed.cell);
    this.scene.anchor={x,y};
    this.scene.route=[];
    this.scene.setPlayerCameraFollow(true);
    this.scene.focusPlayer();
    this.world={...this.world,world:next};
    const route=policy.routes.find(candidate=>candidate.routeId===committed.edgeId);
    this.setNotice((route?route.routeId:'第一章路线')+'：已切换至 '+committed.mapId+' / RECOVERED_SECONDARY / runtimeVerified=false');
    const mapSelector=document.getElementById('map') as HTMLSelectElement|null;
    if(mapSelector)mapSelector.value=String(committed.mapId);
    this.lastSnapshot=null;
    this.render(this.scene.snapshot());
    return true;
  }

  private chapter1WildNearby():Chapter1WildNearbyView|null{
    if(!this.chapter1World||this.scene.mapId!==1020||this.scene.inBattleView)return null;
    const cell=nearestAnchor(this.scene.anchor.x,this.scene.anchor.y);
    const nearby=CH1_WILD_ENCOUNTERS
      .map(record=>({record,distance:manhattanDistance(cell,record.cell)}))
      .filter(row=>row.distance<4)
      .sort((a,b)=>a.distance-b.distance||a.record.entityId-b.record.entityId);
    if(!nearby.length)return null;
    const defeated=new Set(this.ch1WildState.defeatedEntityIds);
    const available=nearby.filter(row=>!defeated.has(row.record.entityId));
    if(available.length>1)return Object.freeze({status:'ambiguous',candidateCount:available.length,minimumLevelProvenance:'RECONSTRUCTION_POLICY',provenance:'RECONSTRUCTION_POLICY'});
    const chosen=(available[0]??nearby[0]);
    const record=chosen.record;
    const status:Chapter1WildNearbyView['status']=available.length===0
      ?'defeated'
      :this.ch1WildState.suppressedEntityId===record.entityId
        ?'suppressed'
        :this.rewards.progression.level<record.minimumLevel
          ?'level-too-low'
          :'eligible';
    return Object.freeze({
      status,
      candidateCount:available.length,
      entityId:record.entityId,
      name:record.name,
      minimumLevel:record.minimumLevel,
      distance:chosen.distance,
      minimumLevelProvenance:'RECONSTRUCTION_POLICY',
      provenance:'RECONSTRUCTION_POLICY',
    });
  }

  private handleChapter1WildEncounter(snapshot:Snapshot):boolean{
    if(!this.chapter1World||this.scene.inBattleView||snapshot.inBattleView||snapshot.mapId!==1020)return false;
    const actor=this.currentWorldState();
    const playerCell:Cell=[actor.x,actor.y];
    this.ch1WildState=clearCh1WildSuppressionAfterLeavingRange(this.ch1WildState,playerCell);
    const previous=this.lastSnapshot;
    if(!previous||previous.inBattleView||previous.mapId!==1020||previous.routeLength<=0||snapshot.routeLength!==0)return false;
    if(this.scene.route.length>0||this.pendingEncounter||this.activeTrainingBattleId!==null||this.activeChapter1StoryBattle||this.activeCh1WildBattle)return false;
    const resolved=resolveCh1WildEncounter({
      mapId:actor.mapId,
      playerCell,
      playerLevel:this.rewards.progression.level,
      state:this.ch1WildState,
    });
    if(resolved.status!=='eligible'||!resolved.candidate)return false;
    const record=resolved.candidate;
    const generation=this.ch1WildState.spawnGeneration;
    this.activeCh1WildBattle=Object.freeze({entityId:record.entityId,generation,record});
    const entry:BattleEntry=Object.freeze({
      battleZoneId:1020,
      provenance:'RECONSTRUCTION_POLICY',
      authority:'offline-reconstruction',
    });
    this.setNotice('野外遭遇：'+record.name+' / entity '+record.entityId+' / 距离 '+resolved.distance+' / battleZone 1020 / RECONSTRUCTION_POLICY');
    this.scene.enterBattle(entry);
    if(!this.scene.inBattleView||this.scene.state.battleZoneId!==1020||this.scene.state.enemies.length!==1){
      this.activeCh1WildBattle=null;
      this.scene.setReconstructionBattleSetup(undefined);
      this.setNotice('野外遭遇 battleZone 1020 入口未能启动；没有回退到其他战斗区。');
      this.render(this.scene.snapshot());
      return true;
    }
    this.lastSnapshot=null;
    this.render(this.scene.snapshot());
    return true;
  }

  private handleChapter1StoryGate(snapshot:Snapshot):boolean{
    if(!this.chapter1World||this.scene.inBattleView||snapshot.inBattleView)return false;
    if(snapshot.mapId!==CH1_STORY_ONE_SOURCE.fieldMapId)return false;
    const actor=this.currentWorldState();
    if(this.chapter1StorySuppressedUntilLeaveGate){
      const stillInsideGate=CH1_STORY_ONE_GATE_CELLS.some(cell=>cell[0]===actor.x&&cell[1]===actor.y);
      if(stillInsideGate)return false;
      this.chapter1StorySuppressedUntilLeaveGate=false;
    }
    if(this.activeChapter1StoryBattle)return false;
    const previous=this.lastSnapshot;
    if(!previous||previous.inBattleView||previous.mapId!==CH1_STORY_ONE_SOURCE.fieldMapId)return false;
    // A gate is eligible only on the edge where a real field movement route
    // completes. Merely starting, standing, opening Quest1, or changing UI
    // state on a gate coordinate is not a Story battle trigger.
    if(previous.routeLength<=0||snapshot.routeLength!==0)return false;

    if(actor.mapId!==CH1_STORY_ONE_SOURCE.fieldMapId)return false;
    const gateCell=this.chapter1StoryOneApproachCells.find(
      cell=>cell[0]===actor.x&&cell[1]===actor.y,
    );
    if(!gateCell)return false;
    if(this.pendingEncounter||this.activeTrainingBattleId!==null)return false;

    const entry:BattleEntry=Object.freeze({
      battleZoneId:CH1_STORY_ONE_SOURCE.battleZoneId,
      provenance:'RECOVERED_SECONDARY',
      authority:'offline-reconstruction',
    });
    this.chapter1StoryLastResolution=null;
    this.activeChapter1StoryBattle=Object.freeze({
      sourceId:CH1_STORY_ONE_SOURCE.id,
      fieldMapId:CH1_STORY_ONE_SOURCE.fieldMapId,
      gateCell:Object.freeze([gateCell[0],gateCell[1]]) as Cell,
      battleZoneId:CH1_STORY_ONE_SOURCE.battleZoneId,
      entryProvenance:'RECOVERED_SECONDARY',
      authority:'offline-reconstruction',
      runtimeVerified:false,
    });
    this.setNotice('Story source 1 gate：movement-complete 命中 '+actor.x+','+actor.y+'，进入 battleZone 1 / RECOVERED_SECONDARY / runtimeVerified=false');
    this.scene.enterBattle(entry);
    if(!this.scene.inBattleView||this.scene.state.battleZoneId!==CH1_STORY_ONE_SOURCE.battleZoneId){
      this.activeChapter1StoryBattle=null;
      this.setNotice('Story source 1 battleZone 1 入口未能启动；未回退到其他 battleZone。');
      this.render(this.scene.snapshot());
      return true;
    }
    this.render(this.scene.snapshot());
    return true;
  }

  private performAttack(skill:Skill|null,acceptance:boolean):boolean{
    if(skill&&!this.skillAllowedForRuntime(this.scene.character,skill.skill_id)){
      this.setNotice('当前职业不能使用该技能');return false;
    }
    if(!skill){
      const target=this.scene.state.enemies.find(enemy=>enemy.id===this.scene.selectedEnemy&&enemy.hp>0);
      if(target&&!m7WizardOrdinaryAttackTargetable(target.m7Status.wizard)){
        this.setNotice('石化目标不能被普通攻击');
        return false;
      }
    }
    const before=this.scene.snapshot();
    if(acceptance){
      if(!this.scene.acceptanceAttack(skill))return false;
    }else{
      if(!this.originalSceneAttack)throw new Error('Missing production scene attack handler');
      this.originalSceneAttack(skill);
    }
    const after=this.scene.snapshot();
    if(after.action===before.action&&after.mp===before.mp&&after.slot===before.slot)return false;
    const animation=this.scene.animation();
    this.present(this.presentation.attack({rawTiming:animation.raw_timing,frameCount:animation.frames_per_direction}));
    if(skill){
      const target=this.scene.state.enemies.find(enemy=>enemy.id===this.scene.selectedEnemy&&enemy.hp>0);
      const resources=(skill.magic_pattern?.magic_resources??[]).flatMap(resource=>{
        const effect=this.scene.pack.effects[String(resource.magic_resource_id)];
        return effect?[{resourceId:resource.magic_resource_id,rawTiming:effect.raw_timing,frameCount:effect.frame_count,role:resource.role,rawStartTick:resource.start_tick}]:[];
      });
      if(resources.length)this.present(this.presentation.magicEffect({resources,context:{caster:{...this.scene.anchor},target:target?{x:target.x,y:target.y}:null}}));
    }
    return true;
  }

  private present(batch:BattlePresentationBatch):void{
    const audio=batch.audio.filter(route=>route.action==='play').map(route=>route.path).filter((path):path is string=>!!path);
    if(audio.length)this.lastAudio=audio.join(', ');
    for(const cue of batch.visual){
      if(cue.kind==='damage-number'&&cue.amount){
        const node=document.createElement('div');node.className='m4-damage-number';node.textContent=`-${Math.ceil(cue.amount)}`;this.feedbackRoot.append(node);setTimeout(()=>node.remove(),cue.durationMs??520);
      }
      if(cue.kind==='camera-nudge'){
        const host=document.getElementById('canvas-host');host?.classList.add('m4-camera-nudge');setTimeout(()=>host?.classList.remove('m4-camera-nudge'),cue.durationMs??70);
      }
      if(cue.kind==='victory-banner'||cue.kind==='defeat-banner'){
        const node=document.createElement('div');node.className='m4-terminal-banner';node.textContent=cue.kind==='victory-banner'?'战斗胜利':'战斗失败';this.feedbackRoot.append(node);setTimeout(()=>node.remove(),cue.durationMs??1200);
      }
    }
  }

  private nearestInteraction(snapshot:Snapshot):string|undefined{
    if(snapshot.inBattleView)return undefined;
    const actor=this.currentWorldState();
    const entities=this.chapter1World&&this.chapter1Authority
      ?[this.chapter1Authority.npc]
      :this.m5World?[this.m5World.trainingManager.entity,this.m5World.content.guide.entity,this.m5World.content.objective]:WORLD_ENTITIES;
    const entity=entities.find(candidate=>canInteract(candidate,actor));
    if(!entity)return undefined;
    if(entity.kind==='npc')return `与${entity.displayName}交谈`;
    return `调查${entity.displayName}`;
  }

  private render(snapshot:Snapshot):void{
    if(!M6_CHARACTER_IDS.includes(snapshot.character))return;
    const definition=playableClassById(snapshot.character);
    const fieldStats=this.playerCombatStats();
    const expHud=this.playerExpHud();
    const presentationStats=this.playerPresentationStats();
    const player:PlayerHudState={
      name:'佣兵',className:definition.displayName,portraitLabel:definition.family==='swordsman'?'剑':'巫',level:this.rewards.progression.level,
      hp:snapshot.inBattleView?snapshot.hp:fieldStats?.maxHp??definition.baseAuthoredStats.hp,hpMax:snapshot.inBattleView?this.scene.state.maxHp:fieldStats?.maxHp??definition.baseAuthoredStats.hp,
      mp:snapshot.inBattleView?snapshot.mp:fieldStats?.maxMp??definition.baseAuthoredStats.mp,mpMax:snapshot.inBattleView?this.scene.state.maxMp:fieldStats?.maxMp??definition.baseAuthoredStats.mp,
      exp:expHud.exp,expMax:expHud.expMax,atk:presentationStats.atk,def:presentationStats.def,attributePoints:this.attributeState.unspentPoints,gold:this.rewards.gold,
    };
    const quest=this.chapter1Quest1Selection?chapter1Quest1Hud(this.chapter1Quest1Selection):questHud(this.world.quest.stage);
    const wildNearby=this.chapter1WildNearby();
    const wildStatusLabel:Record<Chapter1WildNearbyView['status'],string>={ambiguous:'多个目标同时接近，暂不触发',defeated:'已击败',suppressed:'战斗结束后需离开范围才能再次挑战','level-too-low':'等级不足',eligible:'可挑战'};
    const wildEncounter=wildNearby
      ?wildNearby.status==='ambiguous'
        ?'附近有 '+wildNearby.candidateCount+' 个野怪候选，暂不触发 / RECONSTRUCTION_POLICY'
        :'野外遭遇：'+wildNearby.name+' · 等级要求 Lv.'+wildNearby.minimumLevel+' · 距离 '+wildNearby.distance+' 格 · '+wildStatusLabel[wildNearby.status]+' / RECONSTRUCTION_POLICY'
      :undefined;
    const field:FieldHudState={mapId:snapshot.mapId,mapName:snapshot.mapName,...quest,interactionPrompt:this.nearestInteraction(snapshot),wildEncounter};
    let hudHtml:string;
    if(snapshot.inBattleView){
      const target=snapshot.enemies.find(enemy=>enemy.id===snapshot.target&&enemy.hp>0);
      const battle:BattleHudState={
        phase:snapshot.phase,readiness:snapshot.action,readinessMax:snapshot.actionMax,ready:snapshot.actionReady,busy:snapshot.busy,paused:snapshot.battlePaused,
        targetName:target?.id,targetHp:target?.hp,targetHpMax:target?this.scene.state.enemies.find(enemy=>enemy.id===target.id)?.maxHp:undefined,
        statusText:snapshot.phase==='active'?(snapshot.actionReady?'可以行动':'等待行动槽'):snapshot.phase==='won'?'战斗已胜利':'战斗已结束',
        statuses:this.battleStatusViews(),
        canAttack:snapshot.phase==='active',canRest:snapshot.phase==='active',canReturn:snapshot.phase==='won'||snapshot.phase==='lost',
        skills:this.runtimeSkillCommands().map((command,index)=>({id:command.authoredSkillId??command.id,name:`${command.displayName} Lv.${command.skillLevel}`,mpCost:command.mpCost,hotkey:battleSkillHotkeyLabel(index),disabled:snapshot.mp<command.mpCost})),
      };
      hudHtml=renderBattleHud(player,battle);
    }else hudHtml=renderFieldHud(player,field);
    if(hudHtml!==this.hudHtml){
      const commandScrollLeft=this.hudRoot.querySelector<HTMLElement>('.command-deck')?.scrollLeft??0;
      const skillScrollLeft=this.hudRoot.querySelector<HTMLElement>('.skill-deck')?.scrollLeft??0;
      const utilityScrollLeft=this.hudRoot.querySelector<HTMLElement>('.battle-utility-deck')?.scrollLeft??0;
      this.hudRoot.innerHTML=hudHtml;
      const commandDeck=this.hudRoot.querySelector<HTMLElement>('.command-deck');
      const skillDeck=this.hudRoot.querySelector<HTMLElement>('.skill-deck');
      const utilityDeck=this.hudRoot.querySelector<HTMLElement>('.battle-utility-deck');
      if(commandDeck)commandDeck.scrollLeft=commandScrollLeft;
      if(skillDeck)skillDeck.scrollLeft=skillScrollLeft;
      if(utilityDeck)utilityDeck.scrollLeft=utilityScrollLeft;
      this.hudHtml=hudHtml;
    }

    const menuHtml=renderGameMenu({
      open:this.menuOpen,
      canSave:!snapshot.inBattleView&&!this.developerPresetActive&&!this.developerUnlockAllSkills,
      canLoad:!snapshot.inBattleView,
      devEnabled:this.developerMode,
    });
    const menuSignature=menuHtml+'|m7:'+this.selectedTrainingBattleId+':'+this.rewards.progression.level+':'+this.developerMode+':'+this.developerUnlockAllSkills+':'+snapshot.character;
    if(menuSignature!==this.menuHtml){
      this.menuRoot.innerHTML=menuHtml;
      const grid=this.menuRoot.querySelector('.menu-grid');
      if(grid){
        const promotion=integratedPromotionRuleForCharacter(snapshot.character);
        const promotionLabel=promotion?`晋阶至 ${playableClassById(promotion.toStageId).displayName}（Lv.${promotion.minimumLevel}）`:'已达第十阶段';
        const disabled=promotion&&this.rewards.progression.level>=(promotion.minimumLevel??1)?'':' disabled';
        grid.insertAdjacentHTML('beforeend',`<button type="button" data-action="m6-promote"${promotion?disabled:' disabled'}>${promotionLabel}</button><button type="button" data-action="class-swordsman">新建剑士档</button><button type="button" data-action="class-wizard">新建巫师档</button>`);
      }
      const panel=this.menuRoot.querySelector<HTMLElement>('.menu-panel');
      if(panel&&!snapshot.inBattleView){
        panel.classList.add('m7-menu-panel');
        if(this.developerMode)panel.insertAdjacentHTML('beforeend',renderM7DeveloperPreset(definition.family as M7Profession,this.rewards.progression.level,this.developerUnlockAllSkills));
      }
      this.menuHtml=menuSignature;
    }
    const diagnostics:DiagnosticsState={
      open:this.developerMode,mapSelector:String(snapshot.mapId).padStart(4,'0'),rawTiming:`${snapshot.timing} → ${snapshot.duration.toFixed(2)}ms`,
      actionSlot:snapshot.slot,direction:String(snapshot.direction),bounds:snapshot.debugBounds?'visible':'hidden',magicRes:snapshot.effect?`#${snapshot.effect.id} ${snapshot.effect.cursor+1}/${snapshot.effect.length}`:'idle',
      provenance:`battle=${snapshot.battleEntryProvenance}; damage=${snapshot.damagePolicy.provenance}; quest=${this.worldAuthority.provenance}; progression=RECONSTRUCTION_POLICY${this.lastAudio?`; audio=${this.lastAudio}`:''}`,
    };
    const debugHtml=this.developerMode?renderDebugPanel(diagnostics):'';
    if(debugHtml!==this.debugHtml){
      this.debugRoot.innerHTML=debugHtml;
      this.debugHtml=debugHtml;
    }
    const dialogueHtml=this.renderDialogue();
    if(dialogueHtml!==this.dialogueHtml){
      this.dialogueRoot.innerHTML=dialogueHtml;
      this.dialogueHtml=dialogueHtml;
    }
    document.body.classList.toggle('m4-dev-enabled',this.developerMode);
    document.body.classList.toggle('m4-inventory-open',this.inventoryOpen);
    const status=document.getElementById('m4-runtime-notice');
    if(status)status.textContent=this.noticeText;
  }

  private openAttributePanel():void{
    if(this.scene.inBattleView){this.setNotice('战斗中不能分配属性点');return;}
    this.menuOpen=false;
    this.attributePanelOpen=true;
    this.attributeDraft=createAttributeAllocationDraft(this.attributeState);
    this.render(this.scene.snapshot());
  }

  private addAttributePoint(key:string|undefined):void{
    if(!this.attributePanelOpen||!this.attributeDraft)return;
    try{this.attributeDraft=addAttributePointToDraft(this.attributeState,this.attributeDraft,key);}
    catch(error){this.setNotice('属性加点未执行：'+String(error));}
    this.render(this.scene.snapshot());
  }

  private cancelAttributePanel():void{
    if(!this.attributePanelOpen)return;
    this.attributeDraft=cancelAttributeAllocationDraft(this.attributeState);
    this.attributePanelOpen=false;
    this.attributeDraft=null;
    this.render(this.scene.snapshot());
  }

  private confirmAttributePanel():void{
    if(!this.attributePanelOpen||!this.attributeDraft)return;
    try{
      this.attributeState=confirmAttributeAllocation(this.attributeState,this.attributeDraft);
      this.attributePanelOpen=false;
      this.attributeDraft=null;
      this.applyClassProfile(false);
      this.setNotice('属性分配已确认并写入当前角色状态');
    }catch(error){this.setNotice('属性分配失败：'+String(error));}
    this.render(this.scene.snapshot());
  }

  private renderDialogue():string{
    if(this.battleExitConfirm&&this.scene.inBattleView&&this.scene.state.phase==='active'){
      return `<section class="npc-dialogue battle-exit-dialogue" data-ui="battle-exit-confirm" aria-label="退出战斗确认">
        <div class="npc-dialogue-portrait" aria-hidden="true"><b>撤</b><span>RETREAT</span><small>战斗不会结算奖励</small></div>
        <div class="npc-dialogue-body">
          <div class="npc-dialogue-speaker">确认退出战斗？</div>
          <div class="npc-dialogue-copy"><p>退出后返回进入战斗前的场景，本次战斗不计胜利，也不会获得奖励。</p></div>
          <div class="npc-dialogue-actions"><button type="button" data-action="battle-exit-cancel">取消</button><button type="button" data-action="battle-exit-confirm">确认退出</button></div>
          <small class="npc-dialogue-provenance">RECONSTRUCTION_POLICY</small>
        </div>
      </section>`;
    }
    if(this.attributePanelOpen&&this.attributeDraft&&!this.scene.inBattleView){
      return renderAttributeAllocationPanel(this.attributeState,this.attributeDraft);
    }
    if(this.activeShopId&&!this.scene.inBattleView){const shop=getCh1ShopById(this.activeShopId);if(shop)return renderShopPanel({shop,inventory:this.rewards.inventory,gold:this.rewards.gold,shopState:this.shopState});}
    if(this.equipmentPanelOpen&&!this.scene.inBattleView){
      const definition=playableClassById(this.scene.character);
      const context={characterId:this.scene.character,family:definition.family,stageId:Number(this.scene.character),level:this.rewards.progression.level,attributes:this.currentEquipmentAttributes()};
      return renderEquipmentPanel({loadout:this.m6Equipment,inventory:this.rewards.inventory,rules:M6_RUNTIME_EQUIPMENT_RULES,context,preview:m6EquipmentStatContribution(this.m6Equipment,M6_RUNTIME_EQUIPMENT_RULES)});
    }
    if(this.trainingManagerOpen&&!this.scene.inBattleView){
      return renderM7TrainingManagerDialog(this.rewards.progression.level,this.selectedTrainingBattleId,true);
    }
    const chapter1Session=this.activeChapter1Dialogue;
    if(chapter1Session){
      const view=chapter1Session.view;
      const lines=view.lines.map(line=>`<p>${escapeHtml(line)}</p>`).join('');
      const choices=view.choices.map(choice=>`<button type="button" data-dialogue-choice="${choice.id}">${escapeHtml(choice.label)}</button>`).join('');
      return `<section class="npc-dialogue" data-ui="npc-dialogue" data-quest-file="Quest1" data-marker="${view.marker}" data-step="${view.step}" data-input-source="${chapter1Session.inputSource}" aria-label="Quest1 NPC 对话">
        <div class="npc-dialogue-portrait" aria-label="NPC 头像占位"><b>NPC</b><span>PORTRAIT</span><small>头像绑定未恢复</small></div>
        <div class="npc-dialogue-body">
          <div class="npc-dialogue-speaker">${escapeHtml(view.speaker)}</div>
          <div class="npc-dialogue-copy">${lines}</div>
          <div class="npc-dialogue-actions">${choices}</div>
          <small class="npc-dialogue-provenance">SELECT / RECOVERED_SECONDARY / runtimeVerified=false / RECONSTRUCTION_POLICY</small>
        </div>
      </section>`;
    }
    const session=this.activeDialogue;
    if(!session)return '';
    const view=session.view;
    const lines=view.lines.map(line=>`<p>${escapeHtml(line)}</p>`).join('');
    const choices=view.choices.map(choice=>`<button type="button" data-dialogue-choice="${choice.id}">${escapeHtml(choice.label)}</button>`).join('');
    return `<section class="npc-dialogue" data-ui="npc-dialogue" data-input-source="${session.inputSource}" aria-label="NPC 对话">
      <div class="npc-dialogue-portrait" aria-label="NPC 头像占位"><b>NPC</b><span>PORTRAIT</span><small>头像绑定未恢复</small></div>
      <div class="npc-dialogue-body">
        <div class="npc-dialogue-speaker">${escapeHtml(view.speaker)}</div>
        <div class="npc-dialogue-copy">${lines}</div>
        <div class="npc-dialogue-actions">${choices}</div>
        <small class="npc-dialogue-provenance">RECONSTRUCTION_POLICY</small>
      </div>
    </section>`;
  }

  private setNotice(message:string):void{
    this.noticeText=message;
    let node=document.getElementById('m4-runtime-notice');
    if(!node){node=document.createElement('div');node.id='m4-runtime-notice';node.className='game-notice';document.querySelector('.world')?.append(node);}
    node.textContent=message;
  }
}

export function installM4Runtime(scene:LabScene,options:M4RuntimeOptions={}):M4RuntimeIntegration{
  const runtime=new M4RuntimeIntegration(scene,options);
  runtime.install();
  return runtime;
}
