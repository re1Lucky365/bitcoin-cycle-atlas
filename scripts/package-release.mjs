import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTreasuryForecast, TREASURY_SCENARIOS } from '../dist/treasury-model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === '--tag' && /^v[0-9][A-Za-z0-9._-]*$/.test(args[1]),
  'Usage: node scripts/package-release.mjs --tag v1.5.0');
const tag = args[1];
const packageVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
assert.equal(tag, `v${packageVersion}`, 'Release tag must match package.json');
const run = promisify(execFile);
const git = async (...argv) => (await run('git', argv, { cwd: root, encoding: 'utf8' })).stdout.trim();
const commit = await git('rev-parse', '--verify', 'HEAD');
// A dirty working tree could produce HTML that differs from its source ZIP.
await git('diff', '--exit-code', '--quiet');
await git('diff', '--cached', '--exit-code', '--quiet');
assert.equal(await git('status', '--porcelain', '--untracked-files=normal'), '', 'Release packaging requires a clean source tree');
const repository = process.env.GITHUB_REPOSITORY || 'twoimo/bitcoin-cycle-atlas';
assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'Invalid repository name');
const output = path.join(root, 'release');
const assets = path.join(output, 'assets');
await mkdir(assets, { recursive: true });
const names = [];
async function asset(name, content) {
  await writeFile(path.join(assets, name), content);
  names.push(name);
}
const html = 'Bitcoin_Cycles_Comparison.html';
await run(process.execPath, [path.join(root, 'scripts/build-standalone.mjs'), path.join(assets, html)], { cwd: root });
await run(process.execPath, [path.join(root, 'scripts/verify-static.mjs'), '--standalone', path.join(assets, html)], { cwd: root });
names.push(html);
const png = 'Bitcoin_Detailed_Outlook.png';
await copyFile(path.join(root, 'docs/figures', png), path.join(assets, png));
names.push(png);
for (const results of ['DETAILED_FORECAST_RESULTS.json','MARKET_STRUCTURE_RESULTS.json']) {
  await copyFile(path.join(root, 'docs', results), path.join(assets, results));
  names.push(results);
}
// Keep the release report sourced from the versioned repository documents.
// Relative code/doc links point to this exact commit and remain usable after download.
async function collectDocuments(sources) {
 const sections = [];
 for (const source of sources) {
  let text = await readFile(path.join(root, source), 'utf8');
  text = text.replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return match;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), target));
    return `](https://github.com/${repository}/blob/${commit}/${relative})`;
  });
  sections.push(text.trim());
 }
 return sections;
}
const sections = await collectDocuments(['docs/GRAPH_WORKSPACE_GUIDE.md','docs/TRADINGVIEW_WORKSPACE_RESEARCH.md','docs/FIVE_REGION_VERIFICATION.md','docs/MODEL_SCOPE.md','docs/RIGHT_PANEL_VERIFICATION.md','docs/CRYPTOCON_AUDIT.md','docs/VIEWPORT_VERIFICATION.md','docs/MARKET_STRUCTURE_METHOD.md','docs/DETAILED_FORECAST_METHOD.md','docs/STRUCTURE_CROSS_VALIDATION.md','docs/RESEARCH_PRIORITY.md','docs/STRUCTURE_VERIFICATION.md']);
await asset('Bitcoin_Cycle_Structure_Research.md', `# Bitcoin Cycle Atlas ${tag}\n\n소스 커밋: ${commit}\n\n처음 사용하는 방법과 통합 그래프 안내를 먼저, 시장 구조·미래 경로·외부 교차검증·자료 우선순위·구현 검증을 그다음 순서로 제공합니다. 연구 결과는 2026-10-20 UTC 자료의 고정 스냅샷이며, 브라우저에서 갱신한 관측 자료와 날짜가 다를 수 있습니다. 미래 경로는 조건부 가정이며 확률 예측구간이 아닙니다. 과거 평가의 MAPE는 가격 고정 기준선보다 컸으며 장기 로그오차는 더 작았습니다. 일관된 예측 우위는 확인하지 못했습니다.\n\n---\n\n${sections.join('\n\n---\n\n')}\n`);
const treasurySources = ['docs/TREASURY_RESEARCH_INDEX.md','docs/TREASURY_MODEL.md','docs/research/mstr-2026-10-24.md','docs/research/bmnr-2026-10-24.md','docs/TREASURY_MODEL_REVIEW.md','docs/RESEARCH_PRESERVATION.md','docs/TREASURY_VERIFICATION.md','docs/TREASURY_RECOVERY_RESEARCH.md','docs/BTC_RECOVERY_VERIFICATION.md','docs/RESEARCH_SOURCE_READER.md','docs/RECOVERY_2026-10-24.md'];
const treasurySections = await collectDocuments(treasurySources);
await asset('Treasury_Research_and_Models.md', `# MSTR · BMNR 연구와 조건부 모델 ${tag}\n\n소스 커밋: ${commit}\n연구 검토일: 2026-10-24. 재무 기준일과 시장 관측일은 각각의 입력에 별도로 기록합니다. 과거 자본구조를 현재 주가에 연결한 민감도이며 현재 NAV·검증된 미래 예측이 아닙니다.\n\n---\n\n${treasurySections.join('\n\n---\n\n')}\n`);
const scenarioResults = [];
for (const symbol of ['MSTR','BMNR']) {
  const history = JSON.parse(await readFile(path.join(root, 'dist/data', `${symbol.toLowerCase()}-ohlc.json`), 'utf8'));
  for (const scenario of TREASURY_SCENARIOS) scenarioResults.push(buildTreasuryForecast({symbol,history,scenario:scenario.id}));
}
await asset('TREASURY_SCENARIO_RESULTS.json', `${JSON.stringify({tag,commit,reviewedAt:'2026-10-24',scope:'historical-capital-structure-sensitivity',probabilities:null,predictiveValidation:'not-established',scenarios:scenarioResults},null,2)}\n`);
const libraryZip = 'Research_Library.zip';
await run('git', ['archive','--format=zip',`--prefix=research-library-${tag}/`,`--output=${path.join(assets,libraryZip)}`,commit,'dist/research','dist/research-sources','research-data/permitted-source-texts.json','research-data/treasury-mstr.json','research-data/treasury-bmnr.json','research-data/equity-price-validation.json',...treasurySources], {cwd:root,env:{...process.env,TZ:'UTC'}});
names.push(libraryZip);
const permittedSources = JSON.parse(await readFile(path.join(root,'dist/research-sources/manifest.json'),'utf8'));
const libraryManifest = JSON.parse(await readFile(path.join(root,'dist/research/manifest.json'),'utf8'));
const zip = `bitcoin-cycle-atlas-${tag}-source.zip`;
await run('git', ['archive', '--format=zip', `--prefix=bitcoin-cycle-atlas-${tag}/`, `--output=${path.join(assets, zip)}`, commit], { cwd: root, env: { ...process.env, TZ: 'UTC' } });
names.push(zip);
await asset('RELEASE_METADATA.json', `${JSON.stringify({ tag, commit, repository, supportedNodeMajor: 24, symbols:['BTCUSD','ETHUSD','MSTR','BMNR'], workspaceGuideSource: 'docs/GRAPH_WORKSPACE_GUIDE.md', workspaceModes: ['price-and-outlook','four-year-comparison','duration-and-internal-phases','peak-zone-arrival','monthly-and-quarterly-changes','cryptocon-audit'], modelSource: 'docs/DETAILED_FORECAST_METHOD.md', modelScopeSource: 'docs/MODEL_SCOPE.md', chartDetails: 'BTC workspace with separate ETH/equity observed-price views and conditional MSTR/BMNR paths', workspaceResearchSource: 'docs/TRADINGVIEW_WORKSPACE_RESEARCH.md', workspaceVerificationSource: 'docs/FIVE_REGION_VERIFICATION.md', chartInteractions: ['daily-weekly-observations', 'crosshair', 'pan', 'two-point-date-price-measurement', 'log-linear-price-scale', 'historical-and-future-evidence-markers'], marketStructureSource: 'docs/MARKET_STRUCTURE_METHOD.md', crossValidationSource: 'docs/STRUCTURE_CROSS_VALIDATION.md', evidenceSource: 'docs/RESEARCH_PRIORITY.md', chartSource: `docs/figures/${png}`, legacyBitcoinResearchSnapshot: { observationsThrough: '2026-10-20', observationTimezone: 'UTC', referenceDate: '2026-10-22', referenceTimezone: 'Asia/Seoul' }, treasuryResearch:{reviewedAt:'2026-10-24',modelSource:'docs/TREASURY_MODEL.md',verificationSource:'docs/TREASURY_VERIFICATION.md',financialDates:{MSTR:'2026-06-30',BMNR:'2026-05-31'},marketAnchors:Object.fromEntries(['MSTR','BMNR'].map(symbol=>[symbol,scenarioResults.find(result=>result.symbol===symbol).asOf])),currentNavClaim:false,predictiveValidation:'not-established'},researchLibrary:{manifest:'dist/research/manifest.json',articleCount:libraryManifest.articles.length,archive:libraryZip,scope:'original summaries, cross-checks, metadata and external media URLs, plus explicitly licensed CC0 Markdown sources',permittedSources:{manifest:'dist/research-sources/manifest.json',count:permittedSources.sources.length,license:permittedSources.license.id,selectionNote:permittedSources.selectionNote}}, dataRefreshWorkflow: '.github/workflows/refresh-data.yml', dataRefreshScheduleUtc: '20 0,6,12,18 * * *', cryptoconAuditSource: 'docs/CRYPTOCON_AUDIT.md', browserData: 'GitHub Actions refreshes completed daily observations and current anchors; published research tables and PNG retain their own vintage.', uncertainty: 'conditional assumptions; not confidence or prediction intervals' }, null, 2)}\n`);
const checksums = [];
for (const name of [...names].sort()) {
  checksums.push(`${createHash('sha256').update(await readFile(path.join(assets, name))).digest('hex')}  ${name}`);
}
await asset('SHA256SUMS.txt', `${checksums.join('\n')}\n`);
await writeFile(path.join(output, 'ASSETS.txt'), `${names.map(name => `release/assets/${name}`).join('\n')}\n`);
const releaseNotesFile = `docs/RELEASE_V${packageVersion.split('.').slice(0,2).join('_')}.md`;
const releaseNotes = await readFile(path.join(root, releaseNotesFile), 'utf8');
await writeFile(path.join(output, 'RELEASE_NOTES.md'), `${releaseNotes.trim()}\n\n소스 커밋: ${commit}\n`);
console.log(JSON.stringify({ tag, commit, output, assets: names }));
