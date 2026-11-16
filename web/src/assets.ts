import { assert, validateManifest, validateAnimation, validateCollision, validateContentSummary, validateNpcScript, validateQuestContent, validateTutorialContent, validateHelpScript, validateTutorialHelpSummary, frameFile, textureKey, safePath, mapTextureKey, effectTextureKey } from './model.ts';
import type { LoadedPack, Inspector, LoadedContent } from './model.ts';
import {installSourcePanel} from './source-panel.ts';
import {buildInitialImageKeys} from './boot-assets.ts';
declare global { interface Window { __LAPIS_PACK__?: Record<string,string>; } }
export const assetUrl = (path: string) => {
  safePath(path);
  if(window.__LAPIS_PACK__) { const url=window.__LAPIS_PACK__[path]; if(!url) throw new Error(`Embedded asset missing: ${path}`); return url; }
  return `./game-data/${path}`;
};
async function json(path: string): Promise<unknown> {
  const response=await fetch(assetUrl(path)); if(!response.ok) throw new Error(`Asset ${path}: HTTP ${response.status}`);
  return response.json();
}
async function inspector(path:string|undefined):Promise<Inspector|null>{
  if(!path)return null;const raw=await json(path) as Inspector;assert(raw.width>0&&raw.height>0&&raw.cells.length===raw.width*raw.height,'Invalid map inspector');return raw;
}
async function content(manifest:ReturnType<typeof validateManifest>):Promise<LoadedContent|null>{
  const c=manifest.content;if(!c)return null;
  const summary=validateContentSummary(await json(c.summary));
  const npcScript=validateNpcScript(await json(c.npc_script));
  assert(summary.npc.npc_count===npcScript.npcs.length,'Content summary/NPC mismatch');
  const quests:LoadedContent['quests']={};
  for(const [id,path] of Object.entries(c.quests))quests[id]=validateQuestContent(await json(path));
  assert(summary.quests.length===Object.keys(quests).length,'Content summary/quest mismatch');
  const hasExtended=!!(c.tutorial&&c.help_script&&c.tutorial_help_summary);
  const tutorial=hasExtended?validateTutorialContent(await json(c.tutorial!)):null;
  const helpScript=hasExtended?validateHelpScript(await json(c.help_script!)):null;
  const tutorialHelpSummary=hasExtended?validateTutorialHelpSummary(await json(c.tutorial_help_summary!)):null;
  if(tutorial&&tutorialHelpSummary)assert(tutorial.summary.talk_count===tutorialHelpSummary.tutorial.talk_count,'Tutorial summary mismatch');
  if(helpScript&&tutorialHelpSummary){assert(helpScript.summary.help_count===tutorialHelpSummary.help_script.help_count,'Help summary mismatch');assert(helpScript.summary.step_count===tutorialHelpSummary.help_script.step_count,'Help step summary mismatch');assert(helpScript.summary.record_count===tutorialHelpSummary.help_script.record_count,'Help record summary mismatch');}
  return {manifest:c,summary,npcScript,quests,tutorial,helpScript,tutorialHelpSummary};
}
export async function loadPack(progress: (s: string)=>void): Promise<LoadedPack> {
  progress('读取资源清单');
  const manifest=validateManifest(await json('prototype.json'));
  const mapDefs=manifest.maps??{[String(manifest.map.id)]:manifest.map};
  const maps:LoadedPack['maps']={};const images:Record<string,string>={};
  for(const [id,m] of Object.entries(mapDefs)){
    const collision=validateCollision(await json(m.collision));
    maps[id]={manifest:m,collision,inspector:await inspector(m.inspector)};
    images[mapTextureKey(m.id)]=assetUrl(m.png);
  }
  const primary=maps[String(manifest.map.id)];assert(primary,'Primary map missing after load');
  const animations: LoadedPack['animations']={};
  const loadActors=async(defs:typeof manifest.characters)=>{
    for(const [id,c] of Object.entries(defs)){
      if(animations[id])throw new Error(`Duplicate visual resource B${id}`);
      animations[id]={};
      for(const [slot,paths] of Object.entries(c.actions)){
        const a=validateAnimation(await json(paths.animation));animations[id][slot]=a;
        for(const index of new Set(a.directions.flat()))images[textureKey(id,slot,index)]=assetUrl(frameFile(paths.frames_dir,index));
      }
    }
  };
  await loadActors(manifest.characters);
  if(manifest.visuals)await loadActors(manifest.visuals);
  const effects=manifest.effects??{};
  for(const effect of Object.values(effects))for(const index of effect.sequence)images[effectTextureKey(effect.resource_id,index)]=assetUrl(frameFile(effect.frames_dir,index));
  const loadedContent=await content(manifest);
  const params=new URLSearchParams(window.location.search);
  const chapter1=params.get('m4')==='1'&&(params.get('mode')==='chapter1'||params.get('ch1')==='1'||params.get('chapter1')==='1');
  const requestedMapId=chapter1?1000:1;
  const startMapId=maps[String(requestedMapId)]?requestedMapId:manifest.map.id;
  const initialImageKeys=buildInitialImageKeys({manifest,effects,animations,images},startMapId,chapter1?'chapter1':'m5');
  const pack:LoadedPack={manifest,collision:primary.collision,inspector:primary.inspector,maps,effects,animations,images,content:loadedContent,digest:manifest.provenance?.pack_sha256??manifest.provenance?.installer_sha256??'synthetic-fixture-v1',startMapId,initialImageKeys};
  installSourcePanel(pack);
  const roleImageCount=Object.keys(images).filter(key=>key.startsWith('B')).length;
  console.info(`[Lapis boot] 首屏图片 ${initialImageKeys.length}/${Object.keys(images).length}；角色帧图 ${roleImageCount}；模式 ${chapter1?'chapter1':'m5'}`);
  progress(`首屏图片集 ${initialImageKeys.length} 张；全部图像引用 ${Object.keys(images).length} 张，动画 JSON 已校验`);
  return pack;
}
