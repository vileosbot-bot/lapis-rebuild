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

test('M5 first paint is capped at 300 images and contains only visible start-map NPC constructors',()=>{
  const keys=buildInitialImageKeys(fixture(),1,'m5');
  assert.equal(keys.length,68,'map + player idle/walk + two visible NPC first frames + first effect');
  assert.ok(keys.length<=300);
  assert.ok(keys.includes(textureKey('1001','00',0)));
  assert.ok(keys.includes(textureKey('4023','00',0)));
  assert.ok(!keys.includes(textureKey('4524','00',0)),'map-7 dummy preview is deferred');
  assert.ok(!keys.includes(textureKey('4544','00',0)),'map-7 dummy preview is deferred');
  assert.ok(!keys.includes(textureKey('100','02',0)),'unused player action slots are deferred');
});

test('Chapter 1 first paint uses the map-1000 teacher visual and remains under the image cap',()=>{
  const keys=buildInitialImageKeys(fixture(),1000,'chapter1');
  assert.equal(keys.length,67,'map + player idle/walk + teacher first frame + first effect');
  assert.ok(keys.length<=300);
  assert.ok(keys.includes(mapTextureKey(1000)));
  assert.ok(keys.includes(textureKey('4524','00',0)));
  assert.ok(!keys.includes(textureKey('1001','00',0)));
  assert.ok(!keys.includes(textureKey('4023','00',0)));
});

test('a missing non-critical image cannot stop LabScene.create initialization',()=>{
  const source=readFileSync(new URL('../src/scene.ts',import.meta.url),'utf8');
  const create=source.slice(source.indexOf('  create(){'),source.indexOf('  animation():Animation'));
  assert.match(create,/const missingInitial=initialKeys\.filter/);
  assert.doesNotMatch(create,/if\s*\(missingInitial\.length\)\s*\{[^}]*return/);
  assert.match(create,/ASSET_PLACEHOLDER_TEXTURE_KEY/);
  assert.doesNotMatch(create,/Object\.keys\(this\.pack\.images\)\.filter\(k=>!this\.textures\.exists\(k\)\)/);
  assert.match(source,/async ensureTextures\(/);
  assert.match(source,/while\(attempt<3\)/,'first attempt plus at most two retries');
  assert.match(source,/15000\)/,'per-image timeout is 15 seconds');
  assert.match(source,/await this\.ensureTextures\(\[mapTextureKey\(entry\.battleZoneId\)/,'battle waits for its map/player/enemy assets');
});
