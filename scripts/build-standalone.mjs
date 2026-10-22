import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(process.argv[2] || resolve(root, 'build/Bitcoin_Cycles_Comparison.html'));
const urls = new Map();
async function inlineModule(file) {
  if (urls.has(file)) return urls.get(file);
  let source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/\bfrom\s+(['"])(\.\.?\/[^'"]+)\1/g)];
  for (const match of imports) {
    const imported = resolve(dirname(file), match[2]);
    if (!imported.startsWith(dist + '/')) throw new Error('Module outside dist');
    const url = await inlineModule(imported);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  urls.set(file, url);
  return url;
}
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
for (const file of ['styles.css', 'compact.css', 'outlook.css', 'lab.css', 'atlas.css', 'viewport.css', 'chart-details-panel.css']) {
  // Font URLs contain semicolons in their weight lists. Consume the complete
  // url(...) before its terminating semicolon so :root stays valid CSS.
  const css = (await readFile(resolve(dist, file), 'utf8')).replace(/@import\s+url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)\s*;/g, '');
  html = html.replace(`<link rel="stylesheet" href="./${file}">`, `<style>\n${css}\n</style>`);
}
const favicon = Buffer.from(await readFile(resolve(dist, 'favicon.svg'))).toString('base64');
html = html.replace('href="./favicon.svg"', `href="data:image/svg+xml;base64,${favicon}"`);
const data = (await readFile(resolve(dist, 'data/btc-daily.json'), 'utf8')).replaceAll('<', '\\u003c');
const ohlc = (await readFile(resolve(dist, 'data/btc-ohlc.json'), 'utf8')).replaceAll('<', '\\u003c');
const app = await inlineModule(resolve(dist, 'app.js'));
html = html.replace('<script type="module" src="./app.js"></script>',
  `<script id="embedded-btc-data" type="application/json">${data}</script>\n  <script id="embedded-ohlc-data" type="application/json">${ohlc}</script>\n  <script type="module" src="${app}"></script>`);
if (/\b(?:src|href)=["']\.\//.test(html)) throw new Error('Unresolved local resource');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ file: basename(output), bytes: Buffer.byteLength(html), modules: urls.size, embeddedObservations: JSON.parse(data).prices.length }));
