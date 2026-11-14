import type {LoadedPack} from './model.ts';
import {effectTextureKey,mapTextureKey,textureKey} from './model.ts';

type BootPack=Pick<LoadedPack,'manifest'|'animations'|'effects'|'images'>;

/**
 * First paint: current map PNG, player's idle+walk sequences, the first frame
 * needed by each NPC actually visible on the start map, and the first
 * diagnostic-effect frame. Remaining animation frames stay deferred.
 */
export function buildInitialImageKeys(pack:BootPack,startMapId:number,mode:'m5'|'chapter1'):string[]{
  const keys=new Set<string>();
  const add=(key:string)=>{
    if(!pack.images[key])throw new Error('Missing image URL for initial texture '+key);
    keys.add(key);
  };
  add(mapTextureKey(startMapId));
  const playerId=Object.keys(pack.manifest.characters)[0];
  if(!playerId)throw new Error('No starting player character');
  for(const slot of ['00','01']){
    const animation=pack.animations[playerId]?.[slot];
    if(!animation)throw new Error('Starting player animation missing B'+playerId+'_'+slot);
    for(const index of new Set(animation.directions.flat()))add(textureKey(playerId,slot,index));
  }
  // Runtime WorldVisualSpec bindings: M5 field map has B1001 + B4023;
  // Chapter 1 map 1000 has only the B4524 teacher. Do not infer from npcScript.
  const startNpcResources=mode==='chapter1'?[4524]:[1001,4023];
  for(const resourceId of startNpcResources){
    const animation=pack.animations[String(resourceId)]?.['00'];
    if(!animation)continue;
    const firstFrame=animation.directions[0]?.[0];
    if(firstFrame!==undefined)add(textureKey(String(resourceId),'00',firstFrame));
  }
  const firstEffect=Object.values(pack.effects)[0];
  if(firstEffect)add(effectTextureKey(firstEffect.resource_id,firstEffect.sequence[0]));
  return [...keys];
}
