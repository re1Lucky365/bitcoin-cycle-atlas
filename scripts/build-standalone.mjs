import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { standaloneModuleMap } from './standalone-modules.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(process.argv[2] || resolve(root, 'build/Bitcoin_Cycles_Comparison.html'));
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
for (const file of ['styles.css', 'compact.css', 'outlook.css', 'lab.css', 'atlas.css', 'viewport.css', 'chart-details-panel.css', 'analysis-dock.css', 'chart-magnet.css', 'mobile-workspace.css', 'workspace-tools.css', 'chart-workspace-controls.css', 'research-annotations.css', 'chart-export-workbench.css', 'cycle-milestones.css', 'compact-chart-layout.css', 'chart-bottom-bar.css', 'symbol-selector.css', 'eth-view.css', 'ethereum-history.css', 'equity-view.css', 'research-reader.css']) {
  // Font URLs contain semicolons in their weight lists. Consume the complete
  // url(...) before its terminating semicolon so :root stays valid CSS.
  const css = (await readFile(resolve(dist, file), 'utf8')).replace(/@import\s+url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)\s*;/g, '');
  const stylesheet = new RegExp(`<link rel="stylesheet" href="\\./${file.replaceAll('.', '\\.')}(?:\\?[^"\\s]*)?">`);
  html = html.replace(stylesheet, `<style>\n${css}\n</style>`);
}
const favicon = Buffer.from(await readFile(resolve(dist, 'favicon.svg'))).toString('base64');
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`);
const data = (await readFile(resolve(dist, 'data/btc-daily.json'), 'utf8')).replaceAll('<', '\\u003c');
const ohlc = (await readFile(resolve(dist, 'data/btc-ohlc.json'), 'utf8')).replaceAll('<', '\\u003c');
const volume = (await readFile(resolve(dist, 'data/btc-volume.json'), 'utf8')).replaceAll('<', '\\u003c');
const eth = (await readFile(resolve(dist, 'data/eth-ohlc.json'), 'utf8')).replaceAll('<', '\\u003c');
const equities=await Promise.all(['mstr','bmnr'].map(async symbol=>`<script id="embedded-${symbol}-data" type="application/json">${(await readFile(resolve(dist, `data/${symbol}-ohlc.json`),'utf8')).replaceAll('<','\\u003c')}</script>`));
const modules = await standaloneModuleMap(dist);
const importMap = JSON.stringify({imports:modules.imports}).replaceAll('<', '\\u003c');
html = html.replace(/<script type="module" src="\.\/site-entry\.js(?:\?[^"\s]*)?"><\/script>/,
  `<script id="embedded-btc-data" type="application/json">${data}</script>\n  <script id="embedded-ohlc-data" type="application/json">${ohlc}</script>\n  <script id="embedded-volume-data" type="application/json">${volume}</script>\n  <script id="embedded-eth-data" type="application/json">${eth}</script>\n  ${equities.join('\n')}\n  <script type="importmap">${importMap}</script>\n  <script type="module">import ${JSON.stringify(modules.entry)};</script>`);
if (/\b(?:src|href)=["']\.\//.test(html)) throw new Error('Unresolved local resource');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ file: basename(output), bytes: Buffer.byteLength(html), modules: Object.keys(modules.imports).length, embeddedObservations: JSON.parse(data).prices.length }));
