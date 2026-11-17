import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSingleFile } from '../../tools/build-single-file.mjs';

const read = (relative: string) => readFile(new URL(relative, import.meta.url), 'utf8');

test('embedded asset map takes precedence and legacy asset URL fallback remains unchanged', async () => {
  const source = await read('../src/assets.ts');
  assert.match(source, /window\.__LAPIS_PACK__\[path\]/);
  assert.match(source, /return \`\.\/game-data\/\$\{path\}\`/);
  assert.match(source, /fetch\(assetUrl\(path\)\)/);
  assert.match(source, /if\(window\.__LAPIS_PACK__\)/);
});

test('single-file build embeds prototype manifest and every game-data file, then passes output inspection', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lapis-single-file-'));
  try {
    const dist = path.join(root, 'dist');
    const gameData = path.join(root, 'game-data');
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await mkdir(path.join(gameData, 'maps'), { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css"></head><body><div id="app"></div><script type="module" src="./assets/app.js"></script></body></html>');
    await writeFile(path.join(dist, 'assets/app.js'), 'console.log("single");');
    await writeFile(path.join(dist, 'assets/app.css'), 'body{background:#111}');
    await writeFile(path.join(gameData, 'prototype.json'), '{"schema":1}');
    await writeFile(path.join(gameData, 'maps/map.png'), Buffer.from([0, 1, 2, 3]));
    await writeFile(path.join(gameData, 'asset-index.json'), '{"schema":1}');
    const output = path.join(root, 'game.html');
    const result = await buildSingleFile({ dist, gameData, output });
    const html = await readFile(output, 'utf8');
    assert.equal(result.embeddedFiles, 3);
    assert.match(html, /window\.__LAPIS_SINGLE_FILE__=true/);
    assert.match(html, /data:application\/json;base64,/);
    assert.match(html, /data:image\/png;base64,/);
    assert.match(html, /window\.__LAPIS_PACK__/);
    assert.doesNotMatch(html, /src=["']\.\/assets\//);
    assert.doesNotMatch(html, /href=["']\.\/assets\//);
    assert.equal((await stat(output)).size, result.bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('single-file build rejects remaining dynamic JS chunks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lapis-single-file-chunks-'));
  try {
    const dist = path.join(root, 'dist');
    const gameData = path.join(root, 'game-data');
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await mkdir(gameData, { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<html><head></head><body><script type="module" src="./assets/app.js"></script></body></html>');
    await writeFile(path.join(dist, 'assets/app.js'), 'import("./extra.js");');
    await writeFile(path.join(gameData, 'prototype.json'), '{}');
    await assert.rejects(buildSingleFile({ dist, gameData, output: path.join(root, 'out.html') }), /remaining dynamic import/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
