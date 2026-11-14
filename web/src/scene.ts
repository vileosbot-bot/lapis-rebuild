import {installInventoryPanel} from './inventory-panel.ts';
import {initialInventory,equip,equipmentBonus,changeRole} from './inventory.ts';
import Phaser from 'phaser';
import { frameIndex, textureKey, advanceClock, mapTextureKey, effectTextureKey } from './model.ts';
import type { LoadedPack, Animation, LoadedMap, EffectAsset } from './model.ts';
import {ASSET_PLACEHOLDER_TEXTURE_KEY} from './model.ts';
import { referenceCellToScreen, referenceScreenToCell, closestWalkable, rawCell, nearestAnchor, findRoute, directionFor } from './coordinates.ts';
import type { Cell } from './coordinates.ts';
import { PROVISIONAL as P } from './config.ts';
import { initialState, beginBattle, updateBattle, useAttack, actionReady, consumeAction, activeEnemyEncounterGroup } from './battle.ts';
import type { Skill,ReconstructionBattleSetup } from './battle.ts';
import { validateSave, writeSave, readSave } from './save.ts';
import type { Save } from './save.ts';
import {initialQuestState,advanceGuide} from './quest.ts';
import {chooseBattleLayout,reachableCells,tacticalRoute,pixelCell,tileDistance,cellKey} from './tactics.ts';
import {frameIntervalMs,sequenceDurationMs} from './animation-policy.ts';
import {createTrainingInteraction,OFFLINE_TRAINING_ENCOUNTER_AUTHORITY} from './runtime-boundaries.ts';
import type {BattleEntry,InteractionIntent} from './runtime-boundaries.ts';
import {ViewportController,BrowserFullscreenPort} from './view/viewport-controller.ts';
import {BattleCameraPolicy,battleEntryZoom,manualCameraWithinSettleWindow} from './view/battle-camera.ts';
import {buildBattleMinimapModel,minimapContains,minimapToWorld} from './view/battle-minimap.ts';
import type {BattleMinimapModel} from './view/battle-minimap.ts';
import {buildWorldMinimapModel} from './view/world-minimap.ts';
import type {WorldMinimapModel} from './view/world-minimap.ts';
import {advanceEnemyMotion,createEnemyMotion} from './view/enemy-motion.ts';
import type {EnemyMotion} from './view/enemy-motion.ts';
import {resolveBattleFeedbackAnchor} from './view/battle-feedback.ts';
import {VisualActor} from './visual-actor.ts';
import {inflatePointerBounds,pickWorldPointerTarget,unionPointerBounds} from './input/world-pointer-arbitration.ts';
import type {WorldPointerBounds,WorldPointerTarget} from './input/world-pointer-arbitration.ts';
import {enemyVisibleInBattle,resolveBattlePointerAction} from './combat/m7-encounter-groups.ts';

type FieldReturn = {mapId:number;anchor:{x:number;y:number};direction:number;camera:{x:number;y:number;zoom:number}};
export type WorldVisualSpec={id:string;mapId:number;cell:Cell;resourceId:number;label:string;kind:'npc'|'encounter'};
export type WorldMarkerSpec={id:string;mapId:number;cell:Cell;label:string};
export type BattleSkillTargetingAdapter=Readonly<{
  isTargetingSkill:()=>boolean;
  onWorldHover?:(worldX:number,worldY:number,coarse:boolean)=>void;
  onWorldPointer?:(worldX:number,worldY:number,coarse:boolean)=>boolean;
  onEnemyPointer?:(enemyId:string)=>void;
  onCancel?:()=>boolean;
}>;
export type BattleCameraMode='FOLLOW_PLAYER'|'MANUAL_VIEW';
export type BattlePresentationTone='damage'|'poison'|'buff'|'debuff'|'control'|'system';
export type BattlePresentationEvent=Readonly<{
  kind:string;
  target:'player'|string;
  amount?:number;
  label?:string;
  tone?:BattlePresentationTone;
  durationMs?:number;
}>;
type FloatingBattleFeedback={
  target:'player'|string;
  kind:string;
  tone:BattlePresentationTone;
  label:string;
  ageMs:number;
  durationMs:number;
  text:Phaser.GameObjects.Text;
};

export class LabScene extends Phaser.Scene {
  pack: LoadedPack;
  character='100';
  slot='00';
  direction=0;
  cursor=0;
  elapsed=0;
  duration:number=P.frameDurationMs;
  playing=true;
  showGrid=false;
  showCollision=false;
  showBounds=false;
  inBattleView=false;
  battlePaused=false;
  private battleFocus:{x:number;y:number;width:number;height:number}|null=null;
  private effectOrigin:{x:number;y:number}|null=null;
  anchor={x:768,y:384};
  hover={x:0,y:0};
  route: Cell[]=[];
  mapId=0;
  effectId:number|null=null;
  effectCursor=0;
  effectElapsed=0;
  effectPlaying=false;
  effectDuration=P.frameDurationMs;
  inventory=initialInventory();
  quest=initialQuestState();
  state=initialState();
  selectedEnemy='dummy-melee';
  gold=0;
  private fieldReturn:FieldReturn|null=null;
  private lastInteraction:InteractionIntent|null=null;
  private battleEntry:BattleEntry|null=null;
  private mapImage!:Phaser.GameObjects.Image;
  private sprite!: Phaser.GameObjects.Image;
  private effectSprite?:Phaser.GameObjects.Image;
  private viewport?:ViewportController;
  private cameraFollowEnabled=false;
  private battleCamera=new BattleCameraPolicy();
  private battleCameraPointer={x:0,y:0,inside:false,coarse:false};
  private battleCameraTarget:{x:number;y:number}|null=null;
  private battleCameraMode:BattleCameraMode='FOLLOW_PLAYER';
  private battleTargetingVisual:{castCells:readonly Cell[];previewCenter:Cell|null;previewCells:readonly Cell[]}|null=null;
  private minimapGraphics?:Phaser.GameObjects.Graphics;
  private minimapModel:BattleMinimapModel|null=null;
  private worldMinimapVisible=true;
  private worldMinimapModel:WorldMinimapModel|null=null;
  private enemyMotions=new Map<string,EnemyMotion>();
  private battleFeedback:FloatingBattleFeedback[]=[];
  private reconstructionBattleSetup?:ReconstructionBattleSetup;
  private worldVisualActors=new Map<string,{spec:WorldVisualSpec;actor:VisualActor;label:Phaser.GameObjects.Text}>();
  private worldInteractionHandler?: (entityId:string)=>void;
  private battleSkillTargetingAdapter?:BattleSkillTargetingAdapter;
  private worldMarkers=new Map<string,{spec:WorldMarkerSpec;label:Phaser.GameObjects.Text}>();
  private enemyVisualActors=new Map<string,VisualActor>();
  private overlay!: Phaser.GameObjects.Graphics;
  private guideLabel!:Phaser.GameObjects.Text;
  private enemyFallbackLabels=new Map<string,Phaser.GameObjects.Text>();
  private lastPublish=0;
  private timedAction=0;
  private effectUntil=0;
  private notice: (message:string)=>void;
  private loadingNoticeHandler:((message:string)=>void)|undefined;
  private worldVisualSpecs:WorldVisualSpec[]=[];
  private texturePromises=new Map<string,Promise<void>>();
  private textureAttempts=new Map<string,number>();
  private missingTextures=new Set<string>();
  private backgroundTextureLoadStarted=false;

  constructor(pack:LoadedPack, notice:(message:string)=>void){
    super('lab');
    this.pack=pack;
    this.notice=notice;
    this.character=Object.keys(pack.manifest.characters)[0];
    this.mapId=pack.startMapId??(pack.maps[String(P.defaultFieldMapId)]?P.defaultFieldMapId:pack.manifest.map.id);
    this.duration=frameIntervalMs(this.animation().raw_timing);
    const effect=Object.keys(pack.effects)[0];
    this.effectId=effect===undefined?null:Number(effect);
    if(this.effectId!==null)this.effectDuration=frameIntervalMs(this.effect().raw_timing);
  }

  private createAssetPlaceholder(){
    if(this.textures.exists(ASSET_PLACEHOLDER_TEXTURE_KEY))return;
    const graphics=this.make.graphics({x:0,y:0});
    graphics.fillStyle(0x261b2b,1).fillRect(0,0,64,64);
    graphics.fillStyle(0xe45b91,1).fillRect(0,0,32,32).fillRect(32,32,32,32);
    graphics.generateTexture(ASSET_PLACEHOLDER_TEXTURE_KEY,64,64);
    graphics.destroy();
  }

  setLoadingNoticeHandler(handler:((message:string)=>void)|undefined):void{this.loadingNoticeHandler=handler;}
  private reportLoadingProgress(message:string):void{
    this.notice(message);
    const loading=document.getElementById('loading');
    if(loading&&!loading.hidden)loading.textContent=message;
    this.loadingNoticeHandler?.(message);
  }

  private recordMissingTexture(key:string){
    if(this.missingTextures.has(key))return;
    this.missingTextures.add(key);
    this.reportLoadingProgress(`资源缺失 ${key}；已显示占位图，正在重试`);
    this.events.emit('asset-missing-recorded',key);
  }

  private animationTextureKeys(resourceId:string,slot:string):string[]{
    const animation=this.pack.animations[resourceId]?.[slot];
    if(!animation)return [];
    return [...new Set(animation.directions.flat())].map(index=>textureKey(resourceId,slot,index));
  }

  characterTextureKeys(id:string,slots:readonly string[]=['00','01']):string[]{
    return slots.flatMap(slot=>this.animationTextureKeys(id,slot));
  }

  async prepareMapTextures(id:number):Promise<void>{
    if(!this.pack.maps[String(id)])throw new Error(`未知地图 ${id}`);
    // A destination map must have every slot-00 frame for its visible NPC/preview actors before the map switch commits.
    const worldKeys=this.worldVisualSpecs.filter(spec=>spec.mapId===id).flatMap(spec=>
      this.animationTextureKeys(String(spec.resourceId),'00')
    );
    await this.ensureTextures([mapTextureKey(id),...this.characterTextureKeys(this.character,['00']),...worldKeys],`地图 ${String(id).padStart(4,'0')}资源`);
  }

  private async loadTextureOnce(key:string):Promise<void>{
    const url=this.pack.images[key];
    if(!url)throw new Error('资源清单中没有图片 URL：'+key);
    await new Promise<void>((resolve,reject)=>{
      const image=new Image();
      let settled=false;
      const finish=(error?:Error)=>{
        if(settled)return;
        settled=true;
        window.clearTimeout(timeout);
        image.onload=null;
        image.onerror=null;
        if(error)reject(error);else{
          if(!this.textures.exists(key))this.textures.addImage(key,image);
          resolve();
        }
      };
      const timeout=window.setTimeout(()=>{image.src='';finish(new Error('图片加载超时（15 秒）：'+key));},15000);
      image.crossOrigin='anonymous';
      image.onload=()=>finish();
      image.onerror=()=>finish(new Error('图片加载失败：'+key));
      image.src=url;
    });
  }

  private async loadTextureWithRetry(key:string):Promise<void>{
    let attempt=this.textureAttempts.get(key)??0;
    let lastError:unknown;
    while(attempt<3){
      attempt+=1;
      this.textureAttempts.set(key,attempt);
      try{
        await this.loadTextureOnce(key);
        this.missingTextures.delete(key);
        return;
      }catch(error){
        lastError=error;
        this.recordMissingTexture(key);
        if(attempt<3)await new Promise(resolve=>window.setTimeout(resolve,attempt*180));
      }
    }
    throw lastError instanceof Error?lastError:new Error('图片加载失败：'+key);
  }

  private ensureTexture(key:string):Promise<void>{
    if(this.textures.exists(key))return Promise.resolve();
    const pending=this.texturePromises.get(key);
    if(pending)return pending;
    const promise=this.loadTextureWithRetry(key).finally(()=>this.texturePromises.delete(key));
    this.texturePromises.set(key,promise);
    return promise;
  }

  async ensureTextures(keys:readonly string[],stage='资源'):Promise<void>{
    const requested=[...new Set(keys)];
    const unique=requested.filter(key=>!this.textures.exists(key));
    if(!unique.length)return;
    let cursor=0,completed=requested.length-unique.length;
    const failures:string[]=[];
    this.reportLoadingProgress(`正在加载${stage} ${completed}/${requested.length}`);
    const worker=async()=>{
      while(cursor<unique.length){
        const key=unique[cursor++]!;
        try{await this.ensureTexture(key);}
        catch(error){failures.push(key);this.recordMissingTexture(key);}
        completed+=1;
        this.reportLoadingProgress(`正在加载${stage} ${completed}/${requested.length}${failures.length?`，失败 ${failures.length}`:''}`);
      }
    };
    await Promise.all(Array.from({length:Math.min(8,unique.length)},()=>worker()));
    if(failures.length)throw new Error(`${stage}有 ${failures.length} 张图片未能加载：${failures.slice(0,8).join(', ')}`);
    this.reportLoadingProgress(`${stage}已就绪：${requested.length}/${requested.length}`);
  }

  private refreshBootstrapTextures(){
    const mapKey=mapTextureKey(this.mapId);
    if(this.mapImage&&this.textures.exists(mapKey))this.mapImage.setTexture(mapKey);
    if(this.sprite){
      const animation=this.animation();
      const index=frameIndex(animation,this.direction,this.cursor);
      const key=textureKey(this.character,this.slot,index);
      if(this.textures.exists(key))this.sprite.setTexture(key);
    }
    if(this.effectSprite&&this.effectId!==null){
      const effect=this.effect(),index=effect.sequence[this.effectCursor],key=effectTextureKey(effect.resource_id,index);
      if(this.textures.exists(key))this.effectSprite.setTexture(key);
    }
  }

  private async loadRemainingTextures(){
    if(this.backgroundTextureLoadStarted)return;
    this.backgroundTextureLoadStarted=true;
    const initial=new Set(this.pack.initialImageKeys??[]);
    const remaining=Object.keys(this.pack.images).filter(key=>!initial.has(key));
    for(let offset=0;offset<remaining.length;offset+=24){
      const batch=remaining.slice(offset,offset+24);
      try{await this.ensureTextures(batch,`后台资源 ${Math.min(offset+batch.length,remaining.length)}/${remaining.length}`);}
      catch(error){this.reportLoadingProgress(`后台资源部分失败：${String(error)}；缺失贴图已记录`);}
      this.syncWorldVisualActors();
      this.ensureEnemyVisualActors();
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    this.reportLoadingProgress(`后台资源处理完成：已加载 ${Object.keys(this.pack.images).length-this.missingTextures.size}/${Object.keys(this.pack.images).length}，缺失 ${this.missingTextures.size}`);
  }

  preload(){
    const initialKeys=this.pack.initialImageKeys??Object.keys(this.pack.images);
    let completed=0;
    this.load.maxRetries=0;
    const onFileComplete=()=>{
      completed+=1;
      this.reportLoadingProgress(`首屏图片加载 ${completed}/${initialKeys.length}`);
    };
    this.load.on('filecomplete',onFileComplete);
    this.load.once('complete',()=>this.load.off('filecomplete',onFileComplete));
    this.load.on('loaderror',(file:Phaser.Loader.File)=>{
      this.recordMissingTexture(file.key);
      this.events.emit('asset-failure',file.key);
    });
    for(const key of initialKeys){
      const url=this.pack.images[key];
      if(!url||this.textures.exists(key))continue;
      // Phaser preload is attempt 1; ensureTextures below performs at most 2 retries.
      this.textureAttempts.set(key,1);
      this.load.image({key,url,xhrSettings:{responseType:'blob',timeout:15000}});
    }
  }

  create(){
    this.createAssetPlaceholder();
    this.events.on('asset-missing',(key:string)=>this.recordMissingTexture(key));
    const initialKeys=this.pack.initialImageKeys??Object.keys(this.pack.images);
    const missingInitial=initialKeys.filter(key=>!this.textures.exists(key));
    for(const key of missingInitial)this.recordMissingTexture(key);
    if(missingInitial.length)this.reportLoadingProgress(`首屏有 ${missingInitial.length} 张图片暂缺，先用占位图初始化并后台重试`);
    const mapKey=mapTextureKey(this.mapId),map=this.currentMap();
    this.mapImage=this.add.image(0,0,this.textures.exists(mapKey)?mapKey:ASSET_PLACEHOLDER_TEXTURE_KEY).setOrigin(0).setDepth(0);
    if(!this.textures.exists(mapKey))this.mapImage.setDisplaySize(map.manifest.render.width,map.manifest.render.height);
    this.resetPosition();
    const playerIndex=frameIndex(this.animation(),0,0),playerKey=textureKey(this.character,'00',playerIndex);
    this.sprite=this.add.image(0,0,this.textures.exists(playerKey)?playerKey:ASSET_PLACEHOLDER_TEXTURE_KEY).setOrigin(0).setDepth(20);
    if(this.effectId!==null){
      const e=this.effect(),effectIndex=e.sequence[0],effectKey=effectTextureKey(e.resource_id,effectIndex);
      const eb=e.frame_bounds[effectIndex];
      this.effectSprite=this.add.image(this.anchor.x+eb.left,this.anchor.y+eb.top,this.textures.exists(effectKey)?effectKey:ASSET_PLACEHOLDER_TEXTURE_KEY).setOrigin(0).setDepth(30).setVisible(false);
    }
    this.overlay=this.add.graphics().setDepth(40);
    this.minimapGraphics=this.add.graphics().setDepth(2000).setVisible(false);
    this.input.keyboard?.on('keydown-F8',()=>{if(!this.inBattleView)this.toggleWorldMinimap();});
    this.guideLabel=this.add.text(0,0,'M3 引导员\nRECONSTRUCTION',{
      fontFamily:'sans-serif',fontSize:'11px',color:'#f1d39a',backgroundColor:'#172322cc',align:'center',padding:{x:5,y:3}
    }).setOrigin(.5,1).setDepth(50);
    this.updateGuideLabel();
    this.setupViewport();
    this.ensureEnemyVisualActors();
    this.fit();
    this.scale.on('resize',()=>this.viewport?.reclamp());
    this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{
      const coarse=this.pointerIsCoarse(p);
      this.battleCameraPointer={x:p.x,y:p.y,inside:true,coarse};
      const world=this.cameras.main.getWorldPoint(p.x,p.y);
      this.hover={x:Math.round(world.x),y:Math.round(world.y)};
      const minimapHit=this.inBattleView&&this.minimapModel?minimapContains(this.minimapModel.layout,{x:p.x,y:p.y}):false;
      if(this.inBattleView&&this.isTargetingSkill()&&!minimapHit)this.battleSkillTargetingAdapter?.onWorldHover?.(world.x,world.y,coarse);
      this.game.canvas.style.cursor=minimapHit?'pointer':this.inBattleView&&this.isTargetingSkill()?'crosshair':(!this.inBattleView&&this.worldPointerTargetAt(world.x,world.y))?'pointer':'default';
    });
    this.input.on('gameout',()=>{this.battleCameraPointer={...this.battleCameraPointer,inside:false};});
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(this.inBattleView&&this.isTargetingSkill()&&p.rightButtonDown()){
        (p.event as Event|undefined)?.preventDefault?.();
        this.cancelBattleTargeting();
        return;
      }
      if(this.inBattleView&&this.handleBattleMinimapPointer(p.x,p.y))return;
      const world=this.cameras.main.getWorldPoint(p.x,p.y);
      if(this.inBattleView&&this.isTargetingSkill()){
        const consumed=this.battleSkillTargetingAdapter?.onWorldPointer?.(world.x,world.y,this.pointerIsCoarse(p))??false;
        if(consumed)return;
      }
      if(!this.inBattleView){
        const target=this.worldPointerTargetAt(world.x,world.y);
        if(target){
          if(this.worldInteractionHandler)this.worldInteractionHandler(target.id);
          else this.notice('NPC 交互运行时尚未接入');
          return;
        }
      }
      if(this.inBattleView){
        const action=resolveBattlePointerAction(this.state,world.x,world.y,this.isTargetingSkill());
        if(action){
          this.selectedEnemy=action.enemy.id;
          if(action.kind==='skill-target'){
            this.battleSkillTargetingAdapter?.onEnemyPointer?.(action.enemy.id);
            return;
          }
          this.attack(null);
          return;
        }
      }
      this.moveTo(world.x,world.y);
    });
    this.input.on('wheel',(_p:unknown,_o:unknown,_x:number,dy:number)=>{if(this.viewport)this.viewport.handleWheel(dy);else this.zoom(dy>0?.9:1.1);});
    this.events.once('shutdown',()=>this.scale.removeAllListeners('resize'));
    this.notice(this.pack.manifest.provenance?.kind==='synthetic'
      ?'合成测试样本已加载。不是原版美术。'
      :'真实地图、角色和诊断特效已加载。当前为非战斗地图；战斗入口通过显式 authority/battle-entry 边界。');
    installInventoryPanel(this);
    window.dispatchEvent(new CustomEvent('lapis-ready'));
    // Two animation frames leave one paint opportunity for the map/player before background requests begin.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      void this.ensureTextures(initialKeys,'首屏资源补载')
        .catch(error=>this.reportLoadingProgress('首屏资源仍有缺失：'+String(error)))
        .finally(()=>{
          // Refresh every recovered first-screen asset even if a different non-critical image failed.
          this.refreshBootstrapTextures();
          this.syncWorldVisualActors();
          this.ensureEnemyVisualActors();
          void this.loadRemainingTextures();
        });
    }));
  }

  animation():Animation{return this.pack.animations[this.character][this.slot];}
  currentMap():LoadedMap{
    const m=this.pack.maps[String(this.mapId)];
    if(!m)throw new Error(`Unknown map ${this.mapId}`);
    return m;
  }
  effect():EffectAsset{
    if(this.effectId===null||!this.pack.effects[String(this.effectId)])throw new Error('No diagnostic effect selected');
    return this.pack.effects[String(this.effectId)];
  }
  // State 3 is a recovered hit presentation. It does not, by itself, prove a
  // retail command lock, so only route execution and non-hit transient actions
  // gate input in the reconstruction runtime.
  private busy():boolean{return this.route.length>0||(this.slot!=='03'&&this.timedAction>0);}
  private hasActionReadyResources():boolean{return !document.hidden&&!this.busy()&&actionReady(this.state);}
  canAct():boolean{return this.inBattleView&&!this.battlePaused&&this.hasActionReadyResources();}
  acceptanceActionReady():boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance readiness fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused)throw new Error('S14 acceptance readiness fixture requires paused battle');
    return actionReady(this.state);
  }
  acceptanceCanAct():boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance action fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused)throw new Error('S14 acceptance action fixture requires paused battle');
    return this.hasActionReadyResources();
  }
  private occupiedCells():Cell[]{const group=activeEnemyEncounterGroup(this.state,this.anchor.x,this.anchor.y);return this.state.enemies.filter(e=>e.hp>0&&e.encounterGroup===group).map(e=>pixelCell(e.x,e.y));}
  private reachablePaths():Cell[][]{return [...reachableCells(this.currentMap().collision,pixelCell(this.anchor.x,this.anchor.y),this.battleMoveLimit(),this.occupiedCells()).values()].filter(p=>p.length>1);}
  private reachable():Cell[][]{return this.canAct()?this.reachablePaths():[];}
  acceptanceReachable():Cell[]{
    if(!navigator.webdriver)throw new Error('S14 acceptance reachability fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused)throw new Error('S14 acceptance reachability fixture requires paused battle');
    return this.hasActionReadyResources()?this.reachablePaths().map(path=>path.at(-1)!):[];
  }
  toggleBattlePause(){if(this.inBattleView&&this.state.phase==='active')this.battlePaused=!this.battlePaused;}
  private battleMoveLimit():number{return Number(this.character)%10===9?P.wizardMoveCells:P.swordsmanMoveCells;}

  resetPosition(){
    const p=referenceCellToScreen(closestWalkable(this.currentMap().collision,[22,23]));
    this.anchor={x:p[0],y:p[1]};
    this.route=[];
  }

  private updateGuideLabel(){
    if(!this.guideLabel)return;
    if(this.worldVisualActors.size){this.guideLabel.setVisible(false);return;}
    const preferred:Cell=this.mapId===0?[26,23]:[34,39];
    const cell=closestWalkable(this.currentMap().collision,preferred);
    const p=referenceCellToScreen(cell);
    this.guideLabel.setPosition(p[0],p[1]-18).setVisible(!this.inBattleView&&this.state.phase==='safe');
  }

  private setupViewport(){
    const target=document.querySelector<HTMLElement>('.world')??document.getElementById('canvas-host');
    const host=document.getElementById('canvas-host');
    let lastViewportSize={width:this.scale.width,height:this.scale.height};
    if(lastViewportSize.width<=0||lastViewportSize.height<=0){
      lastViewportSize={width:host?.clientWidth??0,height:host?.clientHeight??0};
    }
    const port={
      viewportSize:()=>{
        const width=this.scale.width,height=this.scale.height;
        if(width>0&&height>0)lastViewportSize={width,height};
        return{...lastViewportSize};
      },
      worldBounds:()=>({x:0,y:0,width:this.currentMap().manifest.render.width,height:this.currentMap().manifest.render.height}),
      cameraState:()=>{
        const camera=this.cameras.main,origin=camera.getWorldPoint(0,0);
        return{scrollX:origin.x,scrollY:origin.y,zoom:camera.zoom};
      },
      resize:(width:number,height:number)=>{if(this.scale.width!==width||this.scale.height!==height)this.scale.resize(width,height);},
      setZoom:(zoom:number)=>void this.cameras.main.setZoom(zoom),
      setScroll:(scrollX:number,scrollY:number)=>{
        const zoom=this.cameras.main.zoom;
        this.cameras.main.centerOn(scrollX+this.scale.width/(2*zoom),scrollY+this.scale.height/(2*zoom));
      },
    };
    this.viewport=new ViewportController(port,target?new BrowserFullscreenPort(document,target):undefined);
  }
  fit(){
    if(!this.cameras?.main)return;
    if(this.inBattleView){
      // Never zoom out to fit the encounter. Large battlefields stay at 1:1;
      // undersized maps may zoom in just enough to cover the viewport so no
      // out-of-map blank area is exposed.
      if(this.viewport){
        const snapshot=this.viewport.snapshot();
        this.viewport.setZoom(battleEntryZoom(snapshot.viewport,snapshot.world));
        this.viewport.centerOn(this.anchor);
      }else{
        const {width,height}=this.currentMap().manifest.render;
        this.cameras.main.setZoom(Math.max(1,this.scale.width/width,this.scale.height/height)).centerOn(this.anchor.x,this.anchor.y);
      }
      return;
    }
    if(this.viewport){this.viewport.fitWorld();return;}
    const {width,height}=this.currentMap().manifest.render;
    this.cameras.main.setZoom(Math.min(this.scale.width/width,this.scale.height/height)*.98).centerOn(width/2,height/2);
  }
  focusPlayer(){
    if(this.viewport){this.viewport.resetZoom();this.viewport.centerOn(this.anchor);}
    else this.cameras.main.setZoom(1).centerOn(this.anchor.x,this.anchor.y);
  }
  setPlayerCameraFollow(enabled:boolean){this.cameraFollowEnabled=enabled;if(enabled)this.viewport?.centerOn(this.anchor);}
  zoom(mult:number){if(this.viewport)this.viewport.setZoom(this.cameras.main.zoom*mult);else this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom*mult,.25,3));}
  zoomIn(){return this.viewport?.zoomIn()??this.zoom(1.25)}
  zoomOut(){return this.viewport?.zoomOut()??this.zoom(.8)}
  resetZoom(){if(this.viewport)return this.viewport.resetZoom();this.cameras.main.setZoom(1);return 1;}
  async toggleFullscreen(){return this.viewport?.toggleFullscreen()??false}
  viewportSnapshot(){return this.viewport?.snapshot()??null}

  private coarsePointer(){
    return typeof window.matchMedia==='function'&&window.matchMedia('(pointer: coarse)').matches;
  }

  private pointerIsCoarse(pointer:Phaser.Input.Pointer){
    const event=pointer.event as PointerEvent|undefined;
    return this.coarsePointer()||event?.pointerType==='touch';
  }

  private battleMinimapBottomInset(){
    return this.scale.width<=560?230:this.scale.width<=700?220:this.scale.width<=900?176:136;
  }

  private currentBattleMinimapModel(){
    if(!this.inBattleView||!this.viewport)return null;
    const snapshot=this.viewport.snapshot();
    return buildBattleMinimapModel(
      snapshot.viewport,
      snapshot.world,
      snapshot.camera,
      this.anchor,
      this.state.enemies,
      activeEnemyEncounterGroup(this.state,this.anchor.x,this.anchor.y),
      {bottomInset:this.battleMinimapBottomInset()},
    );
  }

  private handleBattleMinimapPointer(x:number,y:number){
    const model=this.currentBattleMinimapModel();
    if(!model||!minimapContains(model.layout,{x,y}))return false;
    const world=this.viewport?.snapshot().world;
    if(!world)return true;
    this.battleCameraMode='MANUAL_VIEW';
    this.battleCameraTarget=minimapToWorld(model.layout,world,{x,y});
    return true;
  }

  private updateBattleCamera(deltaMs:number){
    if(!this.inBattleView||!this.viewport)return;
    const snapshot=this.viewport.snapshot();
    if(this.battleCameraTarget){
      const target=this.battleCameraTarget;
      const desired=this.battleCamera.targetScroll(snapshot.camera,target,snapshot.viewport,snapshot.world);
      if(manualCameraWithinSettleWindow(
        {x:snapshot.camera.scrollX,y:snapshot.camera.scrollY},
        desired,
        this.battleCamera.options.manualSettleSnapPx,
      )){
        // Finish the final sub-grid approach deterministically. Phaser
        // centerOn() quantizes tiny lerp deltas to half pixels, otherwise a
        // manual target can remain active indefinitely near its destination.
        this.viewport.setScroll(desired.x,desired.y);
        this.battleCameraTarget=null;
        return;
      }
      const next=this.battleCamera.centerStep(snapshot.camera,target,snapshot.viewport,snapshot.world,deltaMs);
      this.viewport.setScroll(next.x,next.y);
      const after=this.viewport.snapshot();
      const afterDesired=this.battleCamera.targetScroll(after.camera,target,after.viewport,after.world);
      if(Math.hypot(after.camera.scrollX-afterDesired.x,after.camera.scrollY-afterDesired.y)<2)this.battleCameraTarget=null;
      return;
    }
    const model=this.currentBattleMinimapModel();
    const overMinimap=model?minimapContains(model.layout,{x:this.battleCameraPointer.x,y:this.battleCameraPointer.y}):false;
    const pointer=overMinimap?{...this.battleCameraPointer,inside:false}:this.battleCameraPointer;
    const followPlayer=this.battleCameraMode==='FOLLOW_PLAYER';
    const step=this.battleCamera.step(snapshot.camera,this.anchor,snapshot.viewport,snapshot.world,deltaMs,pointer,followPlayer,followPlayer&&this.route.length===0);
    this.viewport.setScroll(step.scroll.x,step.scroll.y);
    if(step.source==='edge')this.battleCameraMode='MANUAL_VIEW';
  }

  private drawBattleMinimap(){
    const g=this.minimapGraphics;
    if(!g)return;
    this.worldMinimapModel=null;
    const model=this.currentBattleMinimapModel();
    this.minimapModel=model;
    g.clear();
    if(!model){g.setVisible(false);return;}
    const camera=this.cameras.main,origin=camera.getWorldPoint(0,0);
    g.setVisible(true).setPosition(origin.x,origin.y).setScale(1/camera.zoom);
    const {layout}=model;
    g.fillStyle(0x0d1718,.72);g.fillRoundedRect(layout.x,layout.y,layout.width,layout.height,4);
    g.lineStyle(1,0xb5a47c,.72);g.strokeRoundedRect(layout.x,layout.y,layout.width,layout.height,4);
    g.fillStyle(0x182322,.72);g.fillRect(layout.inner.x,layout.inner.y,layout.inner.width,layout.inner.height);
    g.lineStyle(1,0xd8c99d,.78);g.strokeRect(model.viewport.x,model.viewport.y,model.viewport.width,model.viewport.height);
    for(const enemy of model.enemies){g.fillStyle(0x9b62b6,enemy.active?.95:.58);g.fillCircle(enemy.x,enemy.y,enemy.active?3:2);}
    g.fillStyle(0x5ba8e8,1);g.fillCircle(model.player.x,model.player.y,3);
  }

  private toggleWorldMinimap(){
    this.worldMinimapVisible=!this.worldMinimapVisible;
    if(!this.worldMinimapVisible){this.worldMinimapModel=null;this.minimapGraphics?.clear().setVisible(false);}
    return this.worldMinimapVisible;
  }

  private currentWorldMinimapModel(){
    if(this.inBattleView||!this.worldMinimapVisible||!this.viewport)return null;
    const snapshot=this.viewport.snapshot();
    return buildWorldMinimapModel(snapshot.viewport,snapshot.world,snapshot.camera,this.anchor);
  }

  private drawWorldMinimap(){
    const g=this.minimapGraphics;
    if(!g)return;
    this.minimapModel=null;
    const model=this.currentWorldMinimapModel();
    this.worldMinimapModel=model;
    g.clear();
    if(!model){g.setVisible(false);return;}
    const camera=this.cameras.main,origin=camera.getWorldPoint(0,0);
    g.setVisible(true).setPosition(origin.x,origin.y).setScale(1/camera.zoom);
    const {layout}=model;
    g.fillStyle(0x0d1718,.38);g.fillRoundedRect(layout.x,layout.y,layout.width,layout.height,3);
    g.lineStyle(1,0xb5a47c,.58);g.strokeRoundedRect(layout.x,layout.y,layout.width,layout.height,3);
    g.fillStyle(0x17201d,.42);g.fillRect(layout.inner.x,layout.inner.y,layout.inner.width,layout.inner.height);
    g.lineStyle(1,0xd8c99d,.68);g.strokeRect(model.viewport.x,model.viewport.y,model.viewport.width,model.viewport.height);
    g.fillStyle(0x5ba8e8,1);g.fillCircle(model.player.x,model.player.y,3);
  }

  setWorldInteractionHandler(handler:((entityId:string)=>void)|undefined){this.worldInteractionHandler=handler;}
  setBattleSkillTargetingAdapter(adapter:BattleSkillTargetingAdapter|undefined){this.battleSkillTargetingAdapter=adapter;}
  isTargetingSkill():boolean{return this.battleSkillTargetingAdapter?.isTargetingSkill()??false;}
  setBattleTargetingVisualization(visual:{castCells:readonly Cell[];previewCenter:Cell|null;previewCells:readonly Cell[]}|undefined){
    this.battleTargetingVisual=visual?{
      castCells:Object.freeze(visual.castCells.map(cell=>Object.freeze([cell[0],cell[1]]) as Cell)),
      previewCenter:visual.previewCenter?Object.freeze([visual.previewCenter[0],visual.previewCenter[1]]) as Cell:null,
      previewCells:Object.freeze(visual.previewCells.map(cell=>Object.freeze([cell[0],cell[1]]) as Cell)),
    }:null;
  }
  // Compatibility only. M7.1 range visibility is derived from battle state.
  setBattleRangeOverlayVisible(_visible:boolean){return this.automaticBattleRangeVisible();}
  private automaticBattleRangeVisible(){return this.inBattleView&&this.canAct()&&!this.isTargetingSkill();}
  cancelBattleTargeting():boolean{
    if(!this.isTargetingSkill())return false;
    const cancelled=this.battleSkillTargetingAdapter?.onCancel?.()??false;
    if(cancelled)this.battleTargetingVisual=null;
    return cancelled;
  }
  private battleTargetingSnapshot(){
    const toPoint=(cell:Cell)=>{const [x,y]=referenceCellToScreen(cell);return{x,y};};
    return{
      active:this.isTargetingSkill(),
      previewCenter:this.battleTargetingVisual?.previewCenter?toPoint(this.battleTargetingVisual.previewCenter):null,
      previewCells:(this.battleTargetingVisual?.previewCells??[]).map(toPoint),
      castCells:(this.battleTargetingVisual?.castCells??[]).map(toPoint),
      rangeOverlayVisible:this.automaticBattleRangeVisible(),
      rangeOverlayMode:this.isTargetingSkill()?'skill':this.automaticBattleRangeVisible()?'movement':'none',
    };
  }

  private worldPointerTargets():WorldPointerTarget[]{
    const targets:WorldPointerTarget[]=[];
    for(const row of this.worldVisualActors.values()){
      if(!row.actor.image.visible||row.spec.mapId!==this.mapId)continue;
      const image=row.actor.image.getBounds();
      let bounds:WorldPointerBounds={left:image.x,top:image.y,right:image.x+image.width,bottom:image.y+image.height};
      if(row.label.visible){
        const label=row.label.getBounds();
        bounds=unionPointerBounds(bounds,{left:label.x,top:label.y,right:label.x+label.width,bottom:label.y+label.height});
      }
      targets.push({id:row.spec.id,kind:row.spec.kind,visible:true,bounds:inflatePointerBounds(bounds),depth:row.actor.image.depth});
    }
    return targets;
  }

  private worldPointerTargetAt(x:number,y:number):WorldPointerTarget|null{
    return pickWorldPointerTarget({x,y},this.worldPointerTargets(),'npc');
  }

  setReconstructionBattleSetup(setup:ReconstructionBattleSetup|undefined){this.reconstructionBattleSetup=setup;}

  configureWorldVisuals(specs:readonly WorldVisualSpec[]){
    for(const row of this.worldVisualActors.values()){row.actor.destroy();row.label.destroy();}
    this.worldVisualActors.clear();
    this.worldVisualSpecs=specs.map(spec=>({...spec}));
    this.syncWorldVisualActors();
  }

  private syncWorldVisualActors(){
    for(const spec of this.worldVisualSpecs){
      if(spec.mapId!==this.mapId||this.worldVisualActors.has(spec.id))continue;
      const resourceId=String(spec.resourceId),animation=this.pack.animations[resourceId]?.['00'];
      if(!animation)continue;
      const firstFrame=animation.directions[0]?.[0];if(firstFrame===undefined)continue;
      const key=textureKey(resourceId,'00',firstFrame);
      if(!this.textures.exists(key)){this.recordMissingTexture(key);continue;}
      const [x,y]=referenceCellToScreen(spec.cell);
      const actor=new VisualActor(this,this.pack,resourceId,x,y,0);actor.image.setDepth(10);
      const label=this.add.text(x,y-58,spec.label,{fontFamily:'sans-serif',fontSize:'12px',color:'#f4e6bd',backgroundColor:'#14201dcc',padding:{x:4,y:2}}).setOrigin(.5,1).setDepth(50);
      this.worldVisualActors.set(spec.id,{spec:{...spec},actor,label});
    }
    if(this.guideLabel&&this.worldVisualActors.size)this.guideLabel.setVisible(false);
    this.refreshRecoveredVisualVisibility();
  }

  configureWorldMarkers(specs:readonly WorldMarkerSpec[]){
    for(const row of this.worldMarkers.values())row.label.destroy();
    this.worldMarkers.clear();
    for(const spec of specs){
      const [x,y]=referenceCellToScreen(spec.cell);
      const label=this.add.text(x,y-12,spec.label,{fontFamily:'sans-serif',fontSize:'13px',color:'#fff0b8',backgroundColor:'#4b3828dd',padding:{x:6,y:3}}).setOrigin(.5,1).setDepth(50);
      this.worldMarkers.set(spec.id,{spec:{...spec},label});
    }
    this.refreshRecoveredVisualVisibility();
  }

  private ensureEnemyVisualActors(){
    const bindings=new Map<string,number>([['dummy-melee',4524],['dummy-ranged',4544]]);
    for(const enemy of this.state.enemies){
      if(enemy.visualResourceId!==undefined)bindings.set(enemy.id,enemy.visualResourceId);
    }
    for(const enemy of this.state.enemies){
      const resourceId=bindings.get(enemy.id);
      const resource=resourceId===undefined?null:String(resourceId);
      const idle=this.pack.animations[resource??'']?.['00'];
      const idleIndex=idle?.directions[0]?.[0];
      const idleKey=idleIndex===undefined||!resource?'':textureKey(resource,'00',idleIndex);
      if(resource&&idle&&this.textures.exists(idleKey)&&!this.enemyVisualActors.has(enemy.id)){
        const actor=new VisualActor(this,this.pack,resource,0,0,0);actor.image.setDepth(12);actor.setVisible(false);
        this.enemyVisualActors.set(enemy.id,actor);
      }
      if(resource&&idle&&!this.textures.exists(idleKey))this.recordMissingTexture(idleKey);
      if(this.enemyVisualActors.has(enemy.id)){
        this.enemyFallbackLabels.get(enemy.id)?.destroy();
        this.enemyFallbackLabels.delete(enemy.id);
        continue;
      }
      if(!this.enemyFallbackLabels.has(enemy.id)){
        const label=this.add.text(0,0,enemy.id,{
          fontFamily:'sans-serif',fontSize:'11px',color:'#ffe0a0',backgroundColor:'#182120dd',padding:{x:4,y:2}
        }).setOrigin(.5,1).setDepth(50).setVisible(false);
        this.enemyFallbackLabels.set(enemy.id,label);
      }
    }
    for(const [id,label] of this.enemyFallbackLabels){
      if(this.state.enemies.some(enemy=>enemy.id===id))continue;
      label.destroy();this.enemyFallbackLabels.delete(id);
    }
  }

  private enemyMovementDurationMs(enemyId:string){
    const actor=this.enemyVisualActors.get(enemyId);if(!actor?.has('01'))return 420;
    const animation=actor.animation('01');return Phaser.Math.Clamp(sequenceDurationMs(animation.raw_timing,animation.frames_per_direction),280,640);
  }
  private advanceEnemyMotions(deltaMs:number){
    for(const [id,motion] of [...this.enemyMotions]){
      const enemy=this.state.enemies.find(row=>row.id===id&&row.hp>0);if(!enemy){this.enemyMotions.delete(id);continue;}
      const step=advanceEnemyMotion(motion,deltaMs);enemy.x=step.position.x;enemy.y=step.position.y;
      if(step.done){this.enemyMotions.delete(id);const actor=this.enemyVisualActors.get(id);if(actor?.slot==='01')actor.setAction('00');}
      else this.enemyMotions.set(id,step.motion);
    }
  }
  private captureEnemyMotions(before:ReadonlyMap<string,Readonly<{x:number;y:number}>>){
    for(const enemy of this.state.enemies){
      const from=before.get(enemy.id);if(!from||enemy.hp<=0||this.enemyMotions.has(enemy.id))continue;
      const to={x:enemy.x,y:enemy.y};if(Math.hypot(to.x-from.x,to.y-from.y)<.5)continue;
      enemy.x=from.x;enemy.y=from.y;
      this.enemyMotions.set(enemy.id,createEnemyMotion(enemy.id,from,to,this.enemyMovementDurationMs(enemy.id)));
      const actor=this.enemyVisualActors.get(enemy.id);if(actor?.has('01')){actor.setDirection(directionFor(to.x-from.x,to.y-from.y));actor.setAction('01');}
    }
  }

  private refreshRecoveredVisualVisibility(){
    for(const row of this.worldVisualActors.values()){
      const visible=!this.inBattleView&&row.spec.mapId===this.mapId;
      row.actor.setVisible(visible);row.label.setVisible(visible);
    }
    for(const row of this.worldMarkers.values())row.label.setVisible(!this.inBattleView&&row.spec.mapId===this.mapId);
    for(const actor of this.enemyVisualActors.values())actor.setVisible(false);
    for(const label of this.enemyFallbackLabels.values())label.setVisible(false);
    if(this.inBattleView){
      for(const enemy of this.state.enemies){
        const visible=enemyVisibleInBattle(enemy);
        const actor=this.enemyVisualActors.get(enemy.id);
        if(actor)actor.setVisible(visible);
        else this.enemyFallbackLabels.get(enemy.id)?.setPosition(enemy.x,enemy.y-18).setVisible(visible);
      }
    }
  }

  async setMap(id:number):Promise<void>{
    const next=this.pack.maps[String(id)];
    if(!next)throw new Error(`未知地图 ${id}`);
    if(this.inBattleView)throw new Error('战斗画面中不能切换非战斗地图');
    await this.prepareMapTextures(id);
    this.mapId=id;
    this.mapImage?.setTexture(mapTextureKey(id));
    this.state=initialState();
    this.resetPosition();
    void this.setAction('00');
    this.effectSprite?.setVisible(false);
    this.effectPlaying=false;
    this.updateGuideLabel();
    this.syncWorldVisualActors();
    this.refreshRecoveredVisualVisibility();
    this.fit();
    this.notice(`已切换非战斗地图 ${String(id).padStart(4,'0')} / ${next.manifest.name}`);
  }

  async setCharacter(id:string):Promise<void>{
    if(!this.pack.animations[id])return;
    if(this.inBattleView){this.notice('请先退出战斗画面再切换主角');return;}
    await this.ensureTextures(this.characterTextureKeys(id,['00','01']),`主角 B${id}资源`);
    this.character=id;
    this.inventory=changeRole(this.inventory,id);
    void this.setAction('00');
    this.route=[];
    this.state=initialState();
    this.updateGuideLabel();
  }
  async setAction(slot:string):Promise<void>{
    const animation=this.pack.animations[this.character]?.[slot];
    if(!animation)return;
    const keys=this.animationTextureKeys(this.character,slot);
    if(keys.some(key=>!this.textures.exists(key)))await this.ensureTextures(keys,`主角动作 _${slot}`);
    this.timedAction=0;
    this.slot=slot;
    this.cursor=0;
    this.elapsed=0;
    this.duration=frameIntervalMs(animation.raw_timing);
  }
  private setTransientAction(slot:'02'|'03'){
    if(!this.pack.animations[this.character][slot])return;
    this.setAction(slot);
    this.playing=true;
    this.timedAction=sequenceDurationMs(this.animation().raw_timing,this.animation().frames_per_direction);
  }
  setDirection(direction:number){
    if(!Number.isInteger(direction)||direction<0||direction>7)return;
    this.direction=direction;
    this.cursor=0;
    this.elapsed=0;
  }
  setFrame(index:number){
    this.playing=false;
    this.cursor=Math.max(0,Math.min(this.animation().frames_per_direction-1,Math.floor(index)));
    this.elapsed=0;
  }
  step(){
    this.playing=false;
    this.cursor=(this.cursor+1)%this.animation().frames_per_direction;
    this.elapsed=0;
  }

  async setEffect(id:number):Promise<void>{
    const effect=this.pack.effects[String(id)];if(!effect)return;
    const keys=effect.sequence.map(index=>effectTextureKey(id,index));
    await this.ensureTextures(keys,`MagicRes ${id}特效`);
    this.effectId=id;
    this.effectOrigin=null;
    this.effectCursor=0;
    this.effectElapsed=0;
    this.effectPlaying=false;
    this.effectDuration=frameIntervalMs(effect.raw_timing);
    if(this.effectSprite)this.effectSprite.setTexture(effectTextureKey(id,effect.sequence[0])).setVisible(true);
    this.notice(`MagicRes ${id}：ANI timing 使用已恢复 common consumer；FOCUS 放置/混合/阶段仍未验证。`);
  }
  async playEffect():Promise<void>{
    if(this.effectId===null)return;
    const effect=this.effect();
    await this.ensureTextures(effect.sequence.map(index=>effectTextureKey(effect.resource_id,index)),`MagicRes ${effect.resource_id}诊断播放`);
    this.effectCursor=0;
    this.effectElapsed=0;
    this.effectPlaying=true;
    this.effectSprite?.setVisible(true);
  }
  async stepEffect():Promise<void>{
    if(this.effectId===null)return;
    const effect=this.effect();
    const nextCursor=(this.effectCursor+1)%effect.frame_count;
    const nextFrame=effect.sequence[nextCursor];
    await this.ensureTextures([effectTextureKey(effect.resource_id,nextFrame)],`MagicRes ${effect.resource_id}诊断单帧`);
    this.effectPlaying=false;
    this.effectCursor=nextCursor;
    this.effectElapsed=0;
    this.effectSprite?.setVisible(true);
  }

  moveTo(x:number,y:number){this.moveToCore(x,y,false);}
  acceptanceMoveTo(x:number,y:number):boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance movement fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused)throw new Error('S14 acceptance movement fixture requires paused battle');
    return this.moveToCore(x,y,true);
  }
  private moveToCore(x:number,y:number,acceptance:boolean):boolean{
    if(this.inBattleView&&!(acceptance?this.acceptanceCanAct():this.canAct())){this.notice('行动未就绪、正在执行或战斗已暂停');return false;}
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    const c=this.currentMap().collision;
    const start=closestWalkable(c,nearestAnchor(this.anchor.x,this.anchor.y));
    const end=referenceScreenToCell(x,y);
    const found=this.inBattleView?tacticalRoute(c,start,end,this.battleMoveLimit(),this.occupiedCells()):findRoute(c,start,end);
    if(!found){this.notice('无可通行路径');return false;}
    const nextRoute=found.slice(1);
    if(!nextRoute.length)return false;
    if(this.inBattleView){
      if(this.state.phase!=='active'){this.notice('当前战斗已结束，请返回非战斗地图');return false;}
      if(!actionReady(this.state)){this.notice('行动槽尚未蓄满');return false;}
      const limit=this.battleMoveLimit();
      if(nextRoute.length>limit){this.notice(`超出本次战斗移动范围：${nextRoute.length} > ${limit}`);return false;}
      if(!consumeAction(this.state)){this.notice('行动槽尚未蓄满');return false;}
    }
    this.route=nextRoute;
    if(this.inBattleView){this.battleCameraMode='FOLLOW_PLAYER';this.battleCameraTarget=null;}
    void this.setAction('01').catch(error=>this.reportLoadingProgress('移动动画资源未就绪：'+String(error)));
    this.playing=true;
    return true;
  }

  moveKey(dx:number,dy:number){this.moveTo(this.anchor.x+dx*64,this.anchor.y+dy*32);}

  talkGuide(){
    if(this.inBattleView){this.notice('战斗画面中不能推进非战斗任务');return;}
    const result=advanceGuide(this.quest,this.mapId);
    this.quest=result.state;
    if(result.transitionMapId!==null)void this.setMap(result.transitionMapId).catch(error=>this.notice(String(error)));
    this.updateGuideLabel();
    this.notice(`${result.message} / RECONSTRUCTION_POLICY`);
  }

  async enterBattle(entryOverride?:BattleEntry):Promise<void>{
    if(this.inBattleView)return;
    if(this.route.length){this.notice('请等角色停稳后进入战斗');return;}
    const intent=createTrainingInteraction(this.mapId);
    const entry=entryOverride??OFFLINE_TRAINING_ENCOUNTER_AUTHORITY.resolve(intent,{trainingBattleZoneId:P.battleMapId});
    if(!entry){this.notice('当前交互没有产生战斗入口');return;}
    this.lastInteraction=intent;
    try{await this.applyBattleEntry(entry);}
    catch(error){this.reportLoadingProgress(`战斗资源未就绪，未进入战斗：${String(error)}`);}
  }

  private async applyBattleEntry(entry:BattleEntry):Promise<void>{
    const map=this.pack.maps[String(entry.battleZoneId)];
    if(!map)throw new Error(`缺少 battleZone ${entry.battleZoneId} 资源`);
    const layout=chooseBattleLayout(map.collision);
    const pos=referenceCellToScreen(layout.player);
    const nextState=beginBattle(pos[0],pos[1],entry,this.reconstructionBattleSetup);
    layout.enemies.forEach((cell,i)=>{const enemy=nextState.enemies[i];if(!enemy)return;const xy=referenceCellToScreen(cell);enemy.x=xy[0];enemy.y=xy[1];});
    const fallbackBindings=new Map<string,number>([['dummy-melee',4524],['dummy-ranged',4544]]);
    const enemyResourceIds=new Set<number>();
    for(const enemy of nextState.enemies){
      const resourceId=enemy.visualResourceId??fallbackBindings.get(enemy.id);
      if(resourceId!==undefined&&this.pack.animations[String(resourceId)]?.['00'])enemyResourceIds.add(resourceId);
    }
    const enemyKeys=[...enemyResourceIds].flatMap(id=>{
      const animations=this.pack.animations[String(id)]??{};
      return Object.keys(animations).flatMap(slot=>this.animationTextureKeys(String(id),slot));
    });
    const playerKeys=this.characterTextureKeys(this.character,Object.keys(this.pack.animations[this.character]??{}));
    await this.ensureTextures([mapTextureKey(entry.battleZoneId),...playerKeys,...enemyKeys],`battleZone ${entry.battleZoneId}战斗资源`);
    const camera=this.cameras.main,center=camera.getWorldPoint(this.scale.width/2,this.scale.height/2);
    this.fieldReturn={mapId:this.mapId,anchor:{...this.anchor},direction:this.direction,camera:{x:center.x,y:center.y,zoom:camera.zoom}};
    this.battleEntry=entry;
    this.inBattleView=true;
    this.battlePaused=false;
    this.mapId=entry.battleZoneId;
    this.mapImage.setTexture(mapTextureKey(this.mapId));
    this.battleFocus=layout.focus;
    this.anchor={x:pos[0],y:pos[1]};
    this.route=[];
    this.state=nextState;
    this.ensureEnemyVisualActors();
    this.enemyMotions.clear();this.clearBattleFeedback();
    this.battleCameraTarget=null;this.battleCameraMode='FOLLOW_PLAYER';
    this.battleTargetingVisual=null;
    this.fit();
    this.selectedEnemy=this.state.enemies.find(enemy=>enemy.hp>0)?.id??'dummy-melee';
    void this.setAction('00');
    this.effectSprite?.setVisible(false);
    this.effectPlaying=false;
    this.updateGuideLabel();
    this.refreshRecoveredVisualVisibility();
    this.notice(`已进入 battleZone ${entry.battleZoneId} / ${entry.provenance}。训练 encounter authority 仍为离线重构策略。`);
  }

  leaveBattle(){
    if(!this.inBattleView)return;
    if(this.state.phase==='won')this.gold+=this.state.reward;
    const back=this.fieldReturn;
    this.inBattleView=false;
    this.fieldReturn=null;
    this.battleEntry=null;
    this.battleFocus=null;
    this.battlePaused=false;
    this.battleCameraTarget=null;this.battleCameraMode='FOLLOW_PLAYER';
    this.battleTargetingVisual=null;
    this.enemyMotions.clear();this.clearBattleFeedback();
    this.minimapModel=null;this.worldMinimapModel=null;
    this.minimapGraphics?.clear().setVisible(false);
    this.effectOrigin=null;
    this.state=initialState();
    this.route=[];
    this.setAction('00');
    if(back){
      this.mapId=back.mapId;
      this.mapImage?.setTexture(mapTextureKey(back.mapId));
      this.anchor={...back.anchor};
      this.direction=back.direction;
    }
    this.effectSprite?.setVisible(false);
    this.effectPlaying=false;
    this.updateGuideLabel();
    this.refreshRecoveredVisualVisibility();
    if(back)this.cameras.main.setZoom(back.camera.zoom).centerOn(back.camera.x,back.camera.y);else this.fit();
    this.notice('已退出战斗画面，返回非战斗地图');
  }

  attack(skill:Skill|null){this.attackCore(skill,false);}
  acceptanceAttack(skill:Skill|null):boolean{
    if(!navigator.webdriver)throw new Error('S14 acceptance attack fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused)throw new Error('S14 acceptance attack fixture requires paused battle');
    return this.attackCore(skill,true);
  }
  private attackCore(skill:Skill|null,acceptance:boolean):boolean{
    if(!this.inBattleView){this.notice('非战斗状态不能使用战斗指令');return false;}
    if(!(acceptance?this.acceptanceCanAct():this.canAct())){this.notice('请等待行动就绪');return false;}
    const target=this.state.enemies.find(e=>e.id===this.selectedEnemy&&e.hp>0);
    const buff=skill?.skill_id===1301||skill?.skill_id===19301;
    const range=skill&&skill.skill_id>=19000?P.battleSpellRangeCells:1;
    if(!buff&&target&&tileDistance(pixelCell(this.anchor.x,this.anchor.y),pixelCell(target.x,target.y))>range){this.notice(`目标超出格子射程（${range}格）`);return false;}
    const staffOrdinaryHit=!skill&&Number(this.character)%10===9&&this.inventory.weapon!==null;
    const beforeCasterMp=this.state.mp;
    const beforeTargetMp=target?.mp??0;
    const result=useAttack(this.state,this.selectedEnemy,this.anchor.x,this.anchor.y,skill,equipmentBonus(this.inventory,this.character).attack,{staffOrdinaryHit});
    this.notice(result.message);
    if(!result.ok)return false;
    if(staffOrdinaryHit&&target){
      const drained=Math.max(0,beforeTargetMp-target.mp);
      const gained=Math.max(0,this.state.mp-beforeCasterMp);
      if(drained>0||gained>0)this.presentBattleFeedback({kind:'MP_DRAIN',target:'player',label:`吸收 MP +${gained}`,tone:'buff'});
    }
    if(!buff&&target)this.direction=directionFor(target.x-this.anchor.x,target.y-this.anchor.y);
    this.setTransientAction('02');
    this.route=[];
    this.effectUntil=P.effectDurationMs;
    if(result.event){
      if(result.event.target!=='player')this.enemyVisualActors.get(result.event.target)?.playTransient('03');
      this.presentBattleFeedback({kind:result.event.source==='poison'?'POISON_TICK':'DAMAGE',target:result.event.target,amount:result.event.amount,tone:result.event.source==='poison'?'poison':'damage'});
    }
    const rid=skill?.magic_pattern?.magic_resources?.[0]?.magic_resource_id;
    if(rid&&this.pack.effects[String(rid)]){
      void this.setEffect(rid).then(()=>{
        this.effectOrigin=!buff&&target?{x:target.x,y:target.y}:{...this.anchor};
        void this.playEffect().catch(error=>this.reportLoadingProgress('特效资源未就绪：'+String(error)));
      }).catch(error=>this.reportLoadingProgress('特效资源未就绪：'+String(error)));
    }
    return true;
  }

  presentM7SkillAction(targetIds:readonly string[],magicResourceId?:number,selfTarget=false,explicitOrigin?:Readonly<{x:number;y:number}>){
    if(!this.inBattleView)return;
    const targets=targetIds
      .map(id=>this.state.enemies.find(enemy=>enemy.id===id&&enemy.hp>0))
      .filter((enemy):enemy is NonNullable<typeof enemy>=>!!enemy);
    const primary=targets[0];
    if(primary&&!selfTarget)this.direction=directionFor(primary.x-this.anchor.x,primary.y-this.anchor.y);
    this.setTransientAction('02');
    this.route=[];
    this.effectUntil=P.effectDurationMs;
    for(const target of targets)this.enemyVisualActors.get(target.id)?.playTransient('03');
    if(magicResourceId!==undefined&&this.pack.effects[String(magicResourceId)]){
      void this.setEffect(magicResourceId).then(()=>{
        this.effectOrigin=explicitOrigin?{...explicitOrigin}:selfTarget||!primary?{...this.anchor}:{x:primary.x,y:primary.y};
        void this.playEffect().catch(error=>this.reportLoadingProgress('特效资源未就绪：'+String(error)));
      }).catch(error=>this.reportLoadingProgress('特效资源未就绪：'+String(error)));
    }
  }

  private battleFeedbackAnchor(target:'player'|string){return resolveBattleFeedbackAnchor(target,this.anchor,this.state.enemies);}

  presentBattleFeedback(event:BattlePresentationEvent):boolean{
    if(!this.inBattleView)return false;
    const anchor=this.battleFeedbackAnchor(event.target);if(!anchor)return false;
    const tone=event.tone??'system';
    const label=event.label??(event.amount!==undefined?'-'+Math.max(0,Math.round(event.amount)):event.kind.replaceAll('_',' '));
    const color:Record<BattlePresentationTone,string>={damage:'#f2d39a',poison:'#b7d77c',buff:'#a9d8b9',debuff:'#d8ad8e',control:'#c6b6e8',system:'#e4ddc6'};
    const text=this.add.text(anchor.x,anchor.y,label,{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:color[tone],backgroundColor:'#101714bb',padding:{x:4,y:2}}).setOrigin(.5,1).setDepth(2100);
    this.battleFeedback.push({target:event.target,kind:event.kind,tone,label,ageMs:0,durationMs:Math.max(350,event.durationMs??900),text});
    return true;
  }
  private updateBattleFeedback(deltaMs:number){
    const next:FloatingBattleFeedback[]=[];
    for(const row of this.battleFeedback){
      row.ageMs+=Math.max(0,deltaMs);const anchor=this.battleFeedbackAnchor(row.target);
      if(!anchor||row.ageMs>=row.durationMs){row.text.destroy();continue;}
      const progress=row.ageMs/row.durationMs;row.text.setPosition(anchor.x,anchor.y-progress*24).setAlpha(Math.max(0,1-progress));next.push(row);
    }
    this.battleFeedback=next;
  }
  private clearBattleFeedback(){for(const row of this.battleFeedback)row.text.destroy();this.battleFeedback=[];}

  equipItem(id:number|null,slot:'weapon'|'armor'){
    try{
      if(this.inBattleView)throw new Error('Cannot change equipment in combat');
      this.inventory=equip(this.inventory,id,slot,this.character);
      this.notice('装备已更新 / UNVERIFIED');
    }catch(e){this.notice(String(e));}
  }

  makeSave():Save {
    if(this.route.length)throw new Error('Wait for movement to finish');
    if(this.inBattleView)throw new Error('战斗画面中不能存档，请先返回非战斗地图');
    return {
      version:1,pack:this.pack.digest,character:this.character,mapId:this.mapId,x:this.anchor.x,y:this.anchor.y,
      gold:this.gold,inventory:{...this.inventory,owned:[...this.inventory.owned]},quest:{...this.quest},savedAt:new Date().toISOString()
    };
  }
  async save(){
    try{await writeSave(this.makeSave());this.notice('存档已写入浏览器 IndexedDB');}
    catch(e){this.notice(`存档失败，可使用导出 JSON：${String(e)}`);}
  }
  async restore(raw:unknown):Promise<void>{
    if(this.inBattleView)throw new Error('请先退出战斗再读档');
    const all=Object.values(this.pack.maps).map(m=>m.manifest.render);
    const maxWidth=Math.max(...all.map(m=>m.width)),maxHeight=Math.max(...all.map(m=>m.height));
    const s=validateSave(raw,this.pack.digest,Object.keys(this.pack.manifest.characters),maxWidth,maxHeight);
    const mapId=s.mapId??this.pack.manifest.map.id;
    const destination=this.pack.maps[String(mapId)];
    if(!destination)throw new Error('Unknown save map');
    if(s.x>destination.manifest.render.width||s.y>destination.manifest.render.height||rawCell(destination.collision,nearestAnchor(s.x,s.y))!==1)throw new Error('存档位置不可通行');
    this.inBattleView=false;
    this.fieldReturn=null;
    this.battleEntry=null;
    await this.ensureTextures(this.characterTextureKeys(s.character,['00','01']),'读档角色资源');
    await this.prepareMapTextures(mapId);
    await this.setCharacter(s.character);
    await this.setMap(mapId);
    this.anchor={x:s.x,y:s.y};
    this.gold=s.gold;
    this.inventory=s.inventory!;
    this.quest=s.quest!;
    this.updateGuideLabel();
    this.notice('存档恢复成功');
  }
  async loadSaved(){
    try{await this.restore(await readSave());}
    catch(e){this.notice(`读档失败：${String(e)}`);}
  }

  snapshot(){
    const a=this.animation(),i=frameIndex(a,this.direction,this.cursor);
    const ref=referenceScreenToCell(this.hover.x,this.hover.y),projected=nearestAnchor(this.hover.x,this.hover.y);
    const tileX=Math.floor(this.hover.x/64),tileY=Math.floor(this.hover.y/32);
    const ins=this.currentMap().inspector;
    const tile=ins&&tileX>=0&&tileY>=0&&tileX<ins.width&&tileY<ins.height?ins.cells[tileX*ins.height+tileY]:null;
    const e=this.effectId===null?null:this.effect();
    const cam=this.cameras.main,origin=cam.getWorldPoint(0,0);
    return {
      camera:{x:origin.x,y:origin.y,zoom:cam.zoom},viewport:this.viewportSnapshot(),cameraFollow:this.cameraFollowEnabled,
      battleCamera:{target:this.battleCameraTarget?{...this.battleCameraTarget}:null,mode:this.battleCameraMode},
      cameraMode:this.inBattleView?this.battleCameraMode:null,
      targeting:this.battleTargetingSnapshot(),
      worldMinimap:this.worldMinimapModel?{visible:this.worldMinimapVisible,layout:{...this.worldMinimapModel.layout,inner:{...this.worldMinimapModel.layout.inner}},player:{...this.worldMinimapModel.player},viewport:{...this.worldMinimapModel.viewport},policy:'VERIFIED_HISTORICAL_ANCHOR_RECONSTRUCTION_GEOMETRY' as const}:{visible:this.worldMinimapVisible,layout:null,player:null,viewport:null,policy:'VERIFIED_HISTORICAL_ANCHOR_RECONSTRUCTION_GEOMETRY' as const},
      minimap:this.minimapModel?{
        visible:this.inBattleView,
        layout:{...this.minimapModel.layout,inner:{...this.minimapModel.layout.inner}},
        player:{...this.minimapModel.player},
        enemies:this.minimapModel.enemies.map(enemy=>({...enemy})),
        viewport:{...this.minimapModel.viewport},
        policy:'RECONSTRUCTION_POLICY' as const,
        placement:'bottom-right' as const,
        pointerConsumesInput:true,
      }:null,
      monsterMotion:{activeCount:this.enemyMotions.size,teleportDetected:false,policy:'S40_INTERPOLATED_PRESENTATION' as const},
      debugBounds:this.showBounds,routeLineVisible:false,busy:this.busy(),battlePaused:this.battlePaused,
      battleCell:pixelCell(this.anchor.x,this.anchor.y),
      reachable:this.reachable().map(p=>p.at(-1)!),
      fieldReturn:this.fieldReturn?{mapId:this.fieldReturn.mapId,anchor:{...this.fieldReturn.anchor}}:null,
      lastInteraction:this.lastInteraction?{...this.lastInteraction}:null,
      battleEntry:this.battleEntry?{...this.battleEntry}:null,
      inventory:{...this.inventory,owned:[...this.inventory.owned]},equipment:equipmentBonus(this.inventory,this.character),quest:{...this.quest},
      ready:!!this.sprite,inBattleView:this.inBattleView,mapId:this.mapId,mapName:this.currentMap().manifest.name,character:this.character,
      slot:this.slot,direction:this.direction,cursor:this.cursor,frame:i,length:a.frames_per_direction,bounds:a.frame_bounds[i],timing:a.raw_timing,
      duration:this.duration,timingPolicy:'RETAIL_COMMON' as const,playing:this.playing,anchor:{...this.anchor},hover:{...this.hover},referenceCell:ref,projectedCell:projected,
      rawReference:rawCell(this.currentMap().collision,ref),rawAnchor:rawCell(this.currentMap().collision,projected),
      tile:tile?{x:tileX,y:tileY,resource_id:tile.resource_id,path:tile.directory_path}:null,routeLength:this.route.length,
      cooldown:this.state.cooldown,action:this.state.action,actionMax:this.state.actionMax,actionReady:this.canAct(),moveLimit:this.battleMoveLimit(),
      phase:this.state.phase,hp:Math.ceil(this.state.hp),maxHp:this.state.maxHp,mp:this.state.mp,maxMp:this.state.maxMp,gold:this.gold,
      presentationStats:this.state.combatPlayerStats?{atk:this.state.combatPlayerStats.attack,def:this.state.combatPlayerStats.defense,provenance:this.state.damagePolicyProvenance}:null,
      battleFeedback:this.battleFeedback.map(row=>({target:row.target,kind:row.kind,tone:row.tone,label:row.label,ageMs:row.ageMs,durationMs:row.durationMs,anchor:this.battleFeedbackAnchor(row.target)})),
      m7Status:{
        player:{swordsman:this.state.playerM7Status.swordsman.map(status=>({...status})),wizard:{...this.state.playerM7Status.wizard}},
        poison:{damage:this.state.playerPoisonDamage,ticks:this.state.playerPoisonTicks,intervalMs:this.state.playerPoisonIntervalMs},
        stunActions:this.state.playerStunActions,slowMs:this.state.playerSlowMs,
      },
      battleZoneId:this.state.battleZoneId,battleEntryProvenance:this.state.battleEntryProvenance,damagePolicy:{id:this.state.damagePolicyId,provenance:this.state.damagePolicyProvenance},
      enemies:this.state.enemies.map(enemy=>({id:enemy.id,hp:Math.ceil(enemy.hp),maxHp:enemy.maxHp,mp:enemy.mp,maxMp:enemy.maxMp,x:enemy.x,y:enemy.y,action:enemy.action,cell:pixelCell(enemy.x,enemy.y),encounterGroup:enemy.encounterGroup,visible:this.enemyVisualActors.get(enemy.id)?.image.visible??this.enemyFallbackLabels.get(enemy.id)?.visible??false,visualResourceId:enemy.visualResourceId??(enemy.id==='dummy-melee'?4524:enemy.id==='dummy-ranged'?4544:null),visualSlot:this.enemyVisualActors.get(enemy.id)?.slot??null,motion:this.enemyMotions.get(enemy.id)?{...this.enemyMotions.get(enemy.id)!}:null,traits:[...enemy.traits],m7Status:{swordsman:enemy.m7Status.swordsman.map(status=>({...status})),wizard:{...enemy.m7Status.wizard}},aiBinding:{...enemy.aiBinding}})),target:this.selectedEnemy,
      worldVisuals:[...this.worldVisualActors.values()].map(row=>({id:row.spec.id,mapId:row.spec.mapId,resourceId:row.spec.resourceId,visible:row.actor.image.visible,cell:row.spec.cell})),
      worldPointerTargets:this.worldPointerTargets().map(target=>({id:target.id,kind:target.kind,visible:target.visible,bounds:{...target.bounds},depth:target.depth})),
      effect:e?{id:e.resource_id,cursor:this.effectCursor,frame:e.sequence[this.effectCursor],length:e.frame_count,rawTiming:e.raw_timing,duration:this.effectDuration,timingPolicy:'RETAIL_COMMON' as const,playing:this.effectPlaying}:null,
      fps:Math.round(this.game.loop.actualFps),
      assetLoading:{loaded:Object.keys(this.pack.images).filter(key=>this.textures.exists(key)).length,total:Object.keys(this.pack.images).length,initial:this.pack.initialImageKeys?.length??Object.keys(this.pack.images).length,missing:[...this.missingTextures]}
    };
  }

  private advanceRouteMovement(dt:number):void{
    if(!this.route.length)return;
    const target=referenceCellToScreen(this.route[0]),dx=target[0]-this.anchor.x,dy=target[1]-this.anchor.y,d=Math.hypot(dx,dy),step=P.movementPixelsPerSecond*dt/1000;
    if(d<=step){
      if(d>0)this.direction=directionFor(dx,dy);
      this.anchor={x:target[0],y:target[1]};
      this.route.shift();
      if(!this.route.length)this.setAction('00');
    }else{
      this.direction=directionFor(dx,dy);
      this.anchor.x+=dx/d*step;
      this.anchor.y+=dy/d*step;
    }
  }

  private advanceTimedAction(dt:number):void{
    if(this.timedAction>0){
      this.timedAction=Math.max(0,this.timedAction-dt);
      if(this.timedAction<=0)this.setAction('00');
    }
  }

  private advanceBattleState(dt:number):ReturnType<typeof initialState>['phase']{
    const enemyPositionsBefore=new Map(this.state.enemies.map(enemy=>[enemy.id,{x:enemy.x,y:enemy.y}] as const));
    const before=this.state.phase;
    const events=updateBattle(this.state,dt,this.anchor.x,this.anchor.y,equipmentBonus(this.inventory,this.character).defense,
      this.inBattleView?{collision:this.currentMap().collision,playerBusy:this.busy(),reserved:this.route}:undefined);
    if(this.inBattleView)this.captureEnemyMotions(enemyPositionsBefore);
    if(events.some(event=>event.kind==='hp-loss'&&event.target==='player')&&this.state.phase==='active')this.setTransientAction('03');
    for(const event of events){
      if(event.target==='player'&&event.source)this.enemyVisualActors.get(event.source)?.playTransient('02');
      else if(event.target!=='player')this.enemyVisualActors.get(event.target)?.playTransient('03');
      this.presentBattleFeedback({kind:event.source==='poison'?'POISON_TICK':'DAMAGE',target:event.target,amount:event.amount,tone:event.source==='poison'?'poison':'damage'});
    }
    return before;
  }

  private reselectBattleTargetIfNeeded():void{
    const activeGroup=activeEnemyEncounterGroup(this.state,this.anchor.x,this.anchor.y);
    const selected=this.state.enemies.find(enemy=>enemy.id===this.selectedEnemy);
    if(this.inBattleView&&this.state.phase==='active'&&activeGroup!==null&&(!selected||selected.hp<=0||selected.encounterGroup!==activeGroup)){
      const replacement=this.state.enemies.find(enemy=>enemy.hp>0&&enemy.encounterGroup===activeGroup);
      if(replacement)this.selectedEnemy=replacement.id;
    }
  }

  private handleBattlePhaseTransition(before:ReturnType<typeof initialState>['phase']):void{
    if(before!==this.state.phase){
      this.route=[];
      this.updateGuideLabel();
      this.notice(this.state.phase==='won'?'训练胜利。点击“退出战斗”返回非战斗地图。':'训练失败。点击“退出战斗”返回非战斗地图。');
    }
  }

  acceptanceAdvanceBattleStep():void{
    if(!navigator.webdriver)throw new Error('S14 acceptance battle-step fixture is automation-only');
    if(!this.inBattleView||!this.battlePaused||this.state.phase!=='active')throw new Error('S14 acceptance battle-step fixture requires paused active battle');
    if(document.hidden)throw new Error('S14 acceptance battle-step fixture requires a visible document');
    for(const step of [100,100,50]){
      this.advanceRouteMovement(step);
      this.advanceTimedAction(step);
      this.advanceEnemyMotions(step);
    }
    const before=this.advanceBattleState(250);
    this.reselectBattleTargetIfNeeded();
    this.handleBattlePhaseTransition(before);
    this.updateBattleFeedback(250);
  }

  update(time:number,delta:number){
    if(!this.sprite)return;
    const cameraDt=Math.min(delta,100);
    const dt=this.inBattleView&&(this.battlePaused||document.hidden)?0:cameraDt;
    this.advanceRouteMovement(dt);
    if(this.inBattleView)this.updateBattleCamera(cameraDt);
    else if(this.cameraFollowEnabled)this.viewport?.follow(this.anchor,dt);
    this.advanceTimedAction(dt);
    this.effectUntil=Math.max(0,this.effectUntil-dt);
    const a=this.animation();
    if(this.playing){
      const next=advanceClock(this.cursor,this.elapsed,dt,this.duration,a.frames_per_direction);
      this.cursor=next.cursor;
      this.elapsed=next.elapsed;
    }
    const i=frameIndex(a,this.direction,this.cursor),b=a.frame_bounds[i];
    const playerKey=textureKey(this.character,this.slot,i);
    if(!this.textures.exists(playerKey))this.recordMissingTexture(playerKey);
    this.sprite.setTexture(this.textures.exists(playerKey)?playerKey:ASSET_PLACEHOLDER_TEXTURE_KEY).setPosition(this.anchor.x+b.left,this.anchor.y+b.top).setAlpha(this.state.phase==='lost'?.3:1);
    if(this.effectId!==null&&this.effectSprite){
      const e=this.effect();
      if(this.effectPlaying){
        const next=advanceClock(this.effectCursor,this.effectElapsed,dt,this.effectDuration,e.frame_count);
        const wrapped=this.effectCursor+Math.floor((this.effectElapsed+dt)/this.effectDuration)>=e.frame_count;
        this.effectCursor=next.cursor;
        this.effectElapsed=next.elapsed;
        if(wrapped){this.effectPlaying=false;this.effectSprite.setVisible(false);}
      }
      if(this.effectSprite.visible){
        const ei=e.sequence[this.effectCursor],eb=e.frame_bounds[ei];
        const origin=this.effectOrigin??this.anchor;
        const effectKey=effectTextureKey(e.resource_id,ei);
        if(!this.textures.exists(effectKey))this.recordMissingTexture(effectKey);
        this.effectSprite.setTexture(this.textures.exists(effectKey)?effectKey:ASSET_PLACEHOLDER_TEXTURE_KEY).setPosition(origin.x+eb.left,origin.y+eb.top);
      }
    }
    this.advanceEnemyMotions(dt);
    const before=this.advanceBattleState(dt);
    for(const row of this.worldVisualActors.values())row.actor.update(dt);
    this.reselectBattleTargetIfNeeded();
    for(const enemy of this.state.enemies){
      const visible=this.inBattleView&&enemyVisibleInBattle(enemy);
      const actor=this.enemyVisualActors.get(enemy.id);
      if(actor){
        actor.setVisible(visible).setAnchor(enemy.x,enemy.y).setAlpha(visible?1:.25);
        if(!this.enemyMotions.has(enemy.id))actor.setDirection(directionFor(this.anchor.x-enemy.x,this.anchor.y-enemy.y));
        actor.update(dt);
      }else{
        this.enemyFallbackLabels.get(enemy.id)?.setPosition(enemy.x,enemy.y-18).setVisible(visible).setAlpha(visible?1:.25);
      }
    }
    this.handleBattlePhaseTransition(before);
    this.updateBattleFeedback(dt);
    this.drawOverlay();
    if(this.inBattleView)this.drawBattleMinimap();else this.drawWorldMinimap();
    if(time-this.lastPublish>90){
      window.dispatchEvent(new CustomEvent('lapis-state',{detail:this.snapshot()}));
      this.lastPublish=time;
    }
  }

  private drawOverlay(){
    const g=this.overlay;
    g.clear();
    const m=this.currentMap().manifest.render;
    // M7.1 range is battle-state presentation, not a user toggle.
    if(this.automaticBattleRangeVisible()){
      for(const path of this.reachable()){const cell=path.at(-1)!,[x,y]=referenceCellToScreen(cell);
        g.fillStyle(0x7db5a5,.22);g.lineStyle(1,0xb8d4a1,.55);
        const points=[{x,y:y-16},{x:x+32,y},{x,y:y+16},{x:x-32,y}];
        g.fillPoints(points,true);g.strokePoints(points,true);
      }
    }
    if(this.inBattleView&&this.battleTargetingVisual){
      for(const cell of this.battleTargetingVisual.castCells){
        const [x,y]=referenceCellToScreen(cell);
        g.fillStyle(0x86a8c7,.15);g.lineStyle(1,0xa9c6dc,.38);
        const points=[{x,y:y-16},{x:x+32,y},{x,y:y+16},{x:x-32,y}];
        g.fillPoints(points,true);g.strokePoints(points,true);
      }
      for(const cell of this.battleTargetingVisual.previewCells){
        const [x,y]=referenceCellToScreen(cell);
        g.fillStyle(0x9fbd73,.34);g.lineStyle(2,0xd2dda2,.82);
        const points=[{x,y:y-16},{x:x+32,y},{x,y:y+16},{x:x-32,y}];
        g.fillPoints(points,true);g.strokePoints(points,true);
      }
    }
    if(this.showGrid){
      g.lineStyle(1,0xf0d09b,.18);
      for(let x=0;x<=m.width;x+=64)g.lineBetween(x,0,x,m.height);
      for(let y=0;y<=m.height;y+=32)g.lineBetween(0,y,m.width,y);
    }
    if(this.showCollision){
      const c=this.currentMap().collision;
      for(let x=0;x<c.width;x++)for(let y=0;y<c.height;y++){
        if((x+y)%2)continue;
        const [sx,sy]=referenceCellToScreen([x,y]);
        g.lineStyle(1,rawCell(c,[x,y])===1?0x8edca4:0xf08472,.4);
        g.strokePoints([{x:sx,y:sy-16},{x:sx+32,y:sy},{x:sx,y:sy+16},{x:sx-32,y:sy}],true);
      }
    }
    // Intentionally no route polyline: manual validation showed it is a debug
    // artifact that should not appear during normal movement.
    if(this.showBounds){
      const b=this.animation().frame_bounds[frameIndex(this.animation(),this.direction,this.cursor)];
      g.lineStyle(1,0xe3c288,.9);
      g.strokeRect(this.anchor.x+b.left,this.anchor.y+b.top,b.right-b.left,b.bottom-b.top);
      g.lineStyle(2,0x9ce8c4);
      g.lineBetween(this.anchor.x-7,this.anchor.y,this.anchor.x+7,this.anchor.y);
      g.lineBetween(this.anchor.x,this.anchor.y-7,this.anchor.x,this.anchor.y+7);
    }
    for(const label of this.enemyFallbackLabels.values())label.setVisible(false);
    if(this.inBattleView){
      this.state.enemies.forEach((e,j)=>{
        if(e.hp<=0)return;
        if(!this.enemyVisualActors.has(e.id)){
          g.fillStyle(e.id===this.selectedEnemy?0xa06b45:0x685440,1);
          g.fillRect(e.x-13,e.y-38,26,36);
          g.fillCircle(e.x,e.y-45,12);
          g.lineStyle(3,0xd3b387,1);
          g.lineBetween(e.x-23,e.y-24,e.x+23,e.y-24);
          g.lineBetween(e.x,e.y-35,e.x,e.y+4);
        }
        g.fillStyle(0x2b3332);
        g.fillRect(e.x-24,e.y-66,48,5);
        g.fillStyle(0xe39168);
        g.fillRect(e.x-24,e.y-66,48*e.hp/e.maxHp,5);
        if(!this.enemyVisualActors.has(e.id))this.enemyFallbackLabels.get(e.id)?.setText(`${e.role==='melee'?'近战':'远程'} ${Math.ceil(e.hp)}`).setPosition(e.x,e.y-70).setVisible(true);
      });
    }
    if(this.inBattleView&&this.effectUntil>0){
      g.lineStyle(3,0xe5cb8c,this.effectUntil/P.effectDurationMs);
      g.strokeCircle(this.anchor.x,this.anchor.y-20,20+(P.effectDurationMs-this.effectUntil)/20);
    }
  }
}