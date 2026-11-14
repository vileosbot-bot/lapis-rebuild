import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {buildInitialImageKeys} from '../src/boot-assets.ts';
import {effectTextureKey,mapTextureKey,textureKey} from '../src/model.ts';

function animation(){
  return {directions:Array.from({length:8},(_,direction)=>[0,1,2,3].map(frame=>direction*4+frame))};
}

function fixture(){
  const animations:Record<string,Record<string,ReturnType<typeof animation>>>={
    '100':{'00':animation(),'01':animation()},
    '1001':{'00':animation()},
    '4023':{'00':animation()},
    '4524':{'00':animation()},
    '4544':{'00':animation()},
  };
  const images:Record<string,string>={[mapTextureKey(1)]:'map-1',[mapTextureKey(1000)]:'map-1000',[effectTextureKey(500,0)]:'effect-0'};
  for(const [resourceId,slots] of Object.entries(animations)){
    for(const [slot,value] of Object.entries(slots)){
      for(const index of new Set(value.directions.flat()))images[textureKey(resourceId,slot,index)]=resourceId+'/'+slot+'/'+index;
    }
  }
  return {manifest:{characters:{'100':{}}},animations,effects:{'500':{resource_id:500,sequence:[0]}},images} as any;
}

test('M5 first paint is 36 core images plus 32 walk frames, below the 300-image cap',()=>{
  const keys=buildInitialImageKeys(fixture(),1,'m5');
  const core=keys.filter(key=>!key.startsWith('B100_01_'));
  assert.equal(core.length,36,'map + player idle + two visible NPC first frames + first effect');
  assert.equal(keys.length,68,'add all 32 player walk frames');
  assert.ok(keys.length<=300);
  assert.ok(keys.includes(textureKey('1001','00',0)));
  assert.ok(keys.includes(textureKey('4023','00',0)));
  assert.ok(!keys.includes(textureKey('4524','00',0)),'map-7 dummy preview is deferred');
  assert.ok(!keys.includes(textureKey('4544','00',0)),'map-7 dummy preview is deferred');
  assert.ok(!keys.includes(textureKey('100','02',0)),'unused player action slots are deferred');
});

test('Chapter 1 first paint is 35 core images plus 32 walk frames',()=>{
  const keys=buildInitialImageKeys(fixture(),1000,'chapter1');
  const core=keys.filter(key=>!key.startsWith('B100_01_'));
  assert.equal(core.length,35,'map + player idle + teacher first frame + first effect');
  assert.equal(keys.length,67,'add all 32 player walk frames');
  assert.ok(keys.length<=300);
  assert.ok(keys.includes(mapTextureKey(1000)));
  assert.ok(keys.includes(textureKey('4524','00',0)));
  assert.ok(!keys.includes(textureKey('1001','00',0)));
  assert.ok(!keys.includes(textureKey('4023','00',0)));
});

test('missing non-critical textures do not abort create and all use sites wait for resources',()=>{
  const source=readFileSync(new URL('../src/scene.ts',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  const m4=readFileSync(new URL('../src/m4-runtime-integration.ts',import.meta.url),'utf8');
  const create=source.slice(source.indexOf('  create(){'),source.indexOf('  animation():Animation'));
  assert.match(create,/const missingInitial=initialKeys\.filter/);
  assert.doesNotMatch(create,/if\s*\(missingInitial\.length\)\s*\{[^}]*return/);
  assert.match(create,/ASSET_PLACEHOLDER_TEXTURE_KEY/);
  assert.doesNotMatch(create,/Object\.keys\(this\.pack\.images\)\.filter\(k=>!this\.textures\.exists\(k\)\)/);

  assert.match(source,/private reportLoadingProgress\(message:string\):void\{[\s\S]*?this\.notice\(message\);[\s\S]*?loading\.textContent=message;[\s\S]*?this\.loadingNoticeHandler\?\.\(message\);/,'loading progress reaches the visible loading overlay and optional M4 HUD sink');
  assert.match(m4,/this\.scene\.setLoadingNoticeHandler\(message=>this\.setNotice\(message\)\)/,'M4 mode routes progress into the visible runtime notice');
  assert.match(source,/async ensureTextures\(/);
  assert.match(source,/while\(attempt<3\)/,'first attempt plus at most 2 retries');
  assert.match(source,/15000\)/,'per-image timeout is 15 seconds');
  assert.match(source,/await this\.ensureTextures\(\[mapTextureKey\(entry\.battleZoneId\)/,'battle waits for map/player/enemy assets');
  assert.match(source,/async prepareMapTextures\(id:number\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(\[mapTextureKey\(id\),\.\.\.this\.characterTextureKeys\(this\.character,\['00'\]\),\.\.\.worldKeys\]/,'map transition waits for map, player idle and visible NPC assets');
  assert.match(source,/async setCharacter\(id:string\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(this\.characterTextureKeys\(id,\['00','01'\]\)/,'character switch waits for idle and walk frames');
  assert.match(source,/async setAction\(slot:string\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(keys/,'action switch waits for every frame in the selected slot');
  assert.match(source,/async setMap\(id:number\):Promise<void>\{[\s\S]*?await this\.prepareMapTextures\(id\)/,'map switch waits before changing map state');
  assert.match(source,/async setEffect\(id:number\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(keys/,'effect selection waits for all effect frames');

  assert.match(source,/private syncWorldVisualActors\(\)\{[\s\S]*?if\(!this\.textures\.exists\(key\)\)\{this\.recordMissingTexture\(key\);continue;\}/,'NPC visuals skip absent first frames');
  assert.match(source,/private ensureEnemyVisualActors\(\)\{[\s\S]*?if\(resource&&idle&&!this\.textures\.exists\(idleKey\)\)this\.recordMissingTexture\(idleKey\);/,'enemy visuals skip absent first frames');
  assert.match(source,/private async loadRemainingTextures\(\)[\s\S]*?this\.syncWorldVisualActors\(\);[\s\S]*?this\.ensureEnemyVisualActors\(\);/,'background completion retries actor construction');
  assert.match(source,/finally\(\(\)=>\{[\s\S]*?this\.refreshBootstrapTextures\(\);[\s\S]*?this\.syncWorldVisualActors\(\);[\s\S]*?this\.ensureEnemyVisualActors\(\);/,'successful first-screen retries refresh map/player/NPC even if another key failed');
  assert.match(create,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>\{/,'background requests begin after one paint opportunity');

  assert.match(source,/async playEffect\(\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(/,'diagnostic playback waits for all frames');
  assert.match(source,/async stepEffect\(\):Promise<void>\{[\s\S]*?await this\.ensureTextures\(/,'diagnostic frame stepping waits for its frame');
  assert.match(main,/scene\.playEffect\(\)\.catch/);
  assert.match(main,/scene\.stepEffect\(\)\.catch/);
});
