#!/usr/bin/env node
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function args(argv) {
  const out = { dist: path.join(ROOT, 'web/dist'), gameData: path.join(ROOT, 'web/public/game-data'), output: path.join(ROOT, 'web/dist/lapis-single-file.html') };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--dist', '--game-data', '--out'].includes(key)) throw new Error('Unknown argument: ' + key);
    const value = argv[++i];
    if (!value) throw new Error('Missing value for ' + key);
    out[key === '--dist' ? 'dist' : key === '--game-data' ? 'gameData' : 'output'] = path.resolve(value);
  }
  return out;
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(full));
    else if (entry.isFile()) files.push(full);
    else throw new Error('Unsupported game-data entry: ' + full);
  }
  return files;
}

function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml', '.json':'application/json', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.webm':'video/webm', '.bin':'application/octet-stream' })[ext] ?? 'application/octet-stream';
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function stripScriptAndStyleContents(html) {
  return html.replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi, (_match, tag, attributes) => '<' + tag + attributes + '></' + tag + '>');
}

function hasExternalCssUrl(html) {
  const css = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) css.push(match[1]);
  const markupWithoutEmbeddedCode = stripScriptAndStyleContents(html);
  for (const match of markupWithoutEmbeddedCode.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) css.push(match[2]);
  return css.some(source => /url\(\s*(?!["']?(?:data:|#))[^)]*\)/i.test(source));
}

export function inspectSingleFileHtml(html) {
  const failures = [];
  const markupWithoutEmbeddedCode = stripScriptAndStyleContents(html);
  if (/<(?:script|link|img|source|iframe)\b[^>]*(?:src|href)\s*=\s*["'](?!data:|#|mailto:|tel:)[^"']+["']/i.test(markupWithoutEmbeddedCode)) failures.push('HTML contains an external or relative resource src/href');
  if (/fetch\s*\(\s*[^)]*game-data\//i.test(html)) failures.push('HTML contains a fetch(game-data/...) reference');
  if (hasExternalCssUrl(html)) failures.push('HTML contains a non-data CSS url() reference');
  if (/import\s*\(\s*["'][^"']+["']\s*\)/.test(html)) failures.push('HTML contains a remaining dynamic import');
  if (!html.includes('window.__LAPIS_SINGLE_FILE__=true')) failures.push('single-file runtime flag missing');
  if (!html.includes('window.__LAPIS_PACK__=')) failures.push('embedded asset map missing');
  if (failures.length) throw new Error('Single-file output check failed: ' + failures.join('; '));
  return { ok: true, bytes: Buffer.byteLength(html, 'utf8'), failures: [] };
}

async function build({ dist, gameData, output }) {
  const htmlSource = await readFile(path.join(dist, 'index.html'), 'utf8');
  const assetDir = path.join(dist, 'assets');
  const assetNames = (await readdir(assetDir)).sort();
  const jsFiles = assetNames.filter(name => name.endsWith('.js'));
  const cssFiles = assetNames.filter(name => name.endsWith('.css'));
  if (jsFiles.length !== 1) throw new Error('Expected exactly one bundled JS chunk; found ' + jsFiles.length + '. Keep inlineDynamicImports enabled.');
  if (cssFiles.length < 1) throw new Error('No bundled CSS found in dist/assets.');
  let html = htmlSource;
  const js = await readFile(path.join(assetDir, jsFiles[0]), 'utf8');
  const jsTag = /<script\b[^>]*src=["'][^"']+\.js["'][^>]*><\/script>/i;
  if (!jsTag.test(html)) throw new Error('Could not find the Vite JavaScript entry tag.');
  html = html.replace(jsTag, () => '<script type="module">\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>');

  const cssByName = new Map(await Promise.all(cssFiles.map(async name => [name, await readFile(path.join(assetDir, name), 'utf8')])));
  html = html.replace(/<link\b[^>]*href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi, (tag, href) => {
    const name = path.basename(href.split('?')[0]);
    const css = cssByName.get(name);
    if (css === undefined) throw new Error('Stylesheet is not in dist/assets: ' + href);
    return '<style>\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>';
  });
  html = html.replace(/<link\b[^>]*(?:rel=["'](?:manifest|icon)["']|href=["'][^"']+\.(?:webmanifest|svg)["'])[^>]*>/gi, '');
  if (/<link\b[^>]*href=["'][^"']+["'][^>]*>/i.test(html)) throw new Error('Unprocessed HTML link reference remains.');

  const dataFiles = await filesUnder(gameData);
  if (!dataFiles.some(file => path.basename(file) === 'prototype.json')) throw new Error('game-data/prototype.json is required.');
  const embedded = {};
  for (const file of dataFiles) {
    const relative = path.relative(gameData, file).split(path.sep).join('/');
    const bytes = await readFile(file);
    embedded[relative] = 'data:' + mimeType(file) + ';base64,' + bytes.toString('base64');
  }
  const bootstrap = '<script>window.__LAPIS_SINGLE_FILE__=true;window.__LAPIS_PACK__=' + escapeScriptJson(embedded) + ';</script>';
  if (!html.includes('</head>')) throw new Error('HTML head closing tag missing.');
  html = html.replace('</head>', () => bootstrap + '\n</head>');
  const result = inspectSingleFileHtml(html);
  await writeFile(output, html, 'utf8');
  const actual = await stat(output);
  if (actual.size !== result.bytes) throw new Error('Output byte count changed after write.');
  return { output, bytes: actual.size, embeddedFiles: dataFiles.length, jsChunks: jsFiles.length, cssFiles: cssFiles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await build(args(process.argv.slice(2)));
    process.stdout.write(JSON.stringify({ ...result, check: 'PASS' }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 1;
  }
}

export { build as buildSingleFile };
