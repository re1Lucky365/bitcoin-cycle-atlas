import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TREASURY_SCENARIOS } from '../dist/treasury-model.js';
import { buildTreasuryProjection } from '../dist/treasury-projection.js';
import { EQUITY_FORECAST_BAR_NOTE } from '../dist/equity-forecast-chart.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === '--tag' && /^v[0-9][A-Za-z0-9._-]*$/.test(args[1]),
  'Usage: node scripts/package-release.mjs --tag v1.5.0');
const tag = args[1];
const packageVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
assert.equal(tag, `v${packageVersion}`, 'Release tag must match package.json');
const releaseNotesFile = `docs/RELEASE_V${packageVersion.split('.').slice(0,2).join('_')}.md`;
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
const treasurySources = ['docs/TREASURY_RESEARCH_INDEX.md','docs/TREASURY_PATH_MODEL.md','docs/TREASURY_ASSET_PATHS.md','docs/TREASURY_MODEL.md','docs/research/mstr-2026-10-24.md','docs/research/bmnr-2026-10-24.md','docs/TREASURY_MODEL_REVIEW.md','docs/RESEARCH_PRESERVATION.md','docs/TREASURY_VERIFICATION.md','docs/TREASURY_RECOVERY_RESEARCH.md','docs/BTC_RECOVERY_VERIFICATION.md','docs/RESEARCH_SOURCE_READER.md','docs/RECOVERY_2026-10-24.md',releaseNotesFile];
const treasuryVerificationSource = 'docs/data/system-financial-verification-2026-10-24.json';
const treasurySections = await collectDocuments(treasurySources);
await asset('Treasury_Research_and_Models.md', `# MSTR · BMNR 연구와 조건부 모델 ${tag}\n\n소스 커밋: ${commit}\n연구 검토일: 2026-10-24. 기본 화면과 릴리스 결과는 BTC·ETH의 일별 모의 경로를 과거 자본구조에 연결합니다. 재무 기준일과 시장 관측일은 각각의 입력에 별도로 기록합니다. 현재 NAV·검증된 미래 예측을 산출한 것이 아니며 세 조건에 확률을 부여하지 않습니다. 기존 목표 연결 표는 비교 모드 기록입니다. [일별 재무 항등식·입력 경계의 독립 검증 기록](https://github.com/${repository}/blob/${commit}/${treasuryVerificationSource})은 Research_Library.zip에도 포함합니다.\n\n---\n\n${treasurySections.join('\n\n---\n\n')}\n`);
const projectionSettings = {endYear:2035,seed:20261022};
const inputHashes = {};
async function readScenarioInput(source) {
  const bytes = await readFile(path.join(root, source));
  inputHashes[source] = createHash('sha256').update(bytes).digest('hex');
  return JSON.parse(bytes.toString('utf8'));
}
const btcHistory = await readScenarioInput('dist/data/btc-daily.json');
const ethHistory = await readScenarioInput('dist/data/eth-ohlc.json');
const scenarioResults = [];
for (const symbol of ['MSTR','BMNR']) {
  const history = await readScenarioInput(`dist/data/${symbol.toLowerCase()}-ohlc.json`);
  await readScenarioInput(`research-data/treasury-${symbol.toLowerCase()}.json`);
  const projection = buildTreasuryProjection({symbol,history,btcHistory,ethHistory,...projectionSettings});
  for (const scenario of TREASURY_SCENARIOS) {
    const result = projection.forecasts[scenario.id];
    assert.equal(result.pathMode, 'asset-linked-daily', 'Release scenarios must use the same linked path mode as the default UI');
    scenarioResults.push(result);
  }
}
const scenarioDefinitions = {
  generator:'buildTreasuryProjection',generatorSource:'dist/treasury-projection.js',pathMode:'asset-linked-daily',...projectionSettings,
  equityPrice:'The first price is the last completed observed equity close; subsequent path.price values are conditional common-share valuations, not observed future trades.',
  assetPrice:'path.components.coinPrice is the exact daily BTC or ETH representative path passed into the financial state; coinBaselinePrice is its economic-condition baseline.',
  financialState:'Each scenario includes its sourced historical snapshot, explicit post-snapshot adjustments, daily balances and assumptions. This is a normalization of historical capital structure, not current NAV.',
  valuationState:'active applies the residual-value formula; absorbed freezes operating and financing transitions and keeps the modeled share price at zero after residual exhaustion. components.insolvent describes only the current arithmetic residual; a later recovery does not reverse the absorption convention or model restructuring.',
  observationCutoff:'Each equity last session sets asOf. Crypto observations after that calendar date are excluded; an exact same-date crypto close is required. UTC crypto end-of-day and the New York equity close are not simultaneous.',
  researchCutoff:'assetPath.training records the observation and research cutoffs. The model was constructed and reviewed later and is not a historical-vintage backtest.',
  scenarios:'stress/base/bull are three coherent economic and financing conditions, one representative path per condition. BTC maps to stress/base/accelerated; ETH shares one historical-block residual across its three baselines.',
  range:'path.low/high are the pointwise minimum/maximum of the three complete financial scenarios. They are not probabilities, quantiles, confidence intervals or a bound on all possible losses.',
  simulatedBars:{source:'dist/equity-forecast-chart.js',note:EQUITY_FORECAST_BAR_NOTE,definition:'For each weekday display bar, open is the preceding display valuation; close is that weekday valuation; high/low span those endpoint and intervening daily values, including weekends. Weekly bars aggregate those display bars.',calendar:'weekdays-not-exchange-calendar',intradayOhlc:false,volumeForecast:false,storedInThisFile:false},
  simulatedTurns:'A 12% reversal rule labels the completed simulated path retrospectively. Milestones retain a separate model confirmationDate; these are not independently predicted turning dates or actual future events.',
  legacyComparison:'The target-interpolation examples and reproduction command remain in docs/TREASURY_MODEL.md. Legacy paths are not included in this default-UI scenario artifact.',
};
await asset('TREASURY_SCENARIO_RESULTS.json', `${JSON.stringify({tag,commit,sourceCommit:commit,reviewedAt:'2026-10-24',scope:'asset-path-linked-capital-structure-sensitivity',probabilities:null,predictiveValidation:'not-established',currentNavClaim:false,inputHashes,definitions:scenarioDefinitions,scenarios:scenarioResults},null,2)}\n`);
const libraryZip = 'Research_Library.zip';
await run('git', ['archive','--format=zip',`--prefix=research-library-${tag}/`,`--output=${path.join(assets,libraryZip)}`,commit,'dist/research','dist/research-sources','research-data/permitted-source-texts.json','research-data/treasury-mstr.json','research-data/treasury-bmnr.json','research-data/equity-price-validation.json',...treasurySources,treasuryVerificationSource], {cwd:root,env:{...process.env,TZ:'UTC'}});
names.push(libraryZip);
const permittedSources = JSON.parse(await readFile(path.join(root,'dist/research-sources/manifest.json'),'utf8'));
const libraryManifest = JSON.parse(await readFile(path.join(root,'dist/research/manifest.json'),'utf8'));
const zip = `bitcoin-cycle-atlas-${tag}-source.zip`;
await run('git', ['archive', '--format=zip', `--prefix=bitcoin-cycle-atlas-${tag}/`, `--output=${path.join(assets, zip)}`, commit], { cwd: root, env: { ...process.env, TZ: 'UTC' } });
names.push(zip);
await asset('RELEASE_METADATA.json', `${JSON.stringify({ tag, commit, repository, supportedNodeMajor: 24, symbols:['BTCUSD','ETHUSD','MSTR','BMNR'], workspaceGuideSource: 'docs/GRAPH_WORKSPACE_GUIDE.md', workspaceModes: ['price-and-outlook','four-year-comparison','duration-and-internal-phases','peak-zone-arrival','monthly-and-quarterly-changes','cryptocon-audit'], modelSource: 'docs/DETAILED_FORECAST_METHOD.md', modelScopeSource: 'docs/MODEL_SCOPE.md', chartDetails: 'BTC workspace with separate ETH/equity observations and daily asset-linked MSTR/BMNR conditional paths; future path bars are simulated valuation ranges', workspaceResearchSource: 'docs/TRADINGVIEW_WORKSPACE_RESEARCH.md', workspaceVerificationSource: 'docs/FIVE_REGION_VERIFICATION.md', chartInteractions: ['daily-weekly-observations', 'crosshair', 'pan', 'two-point-date-price-measurement', 'log-linear-price-scale', 'historical-and-future-evidence-markers'], marketStructureSource: 'docs/MARKET_STRUCTURE_METHOD.md', crossValidationSource: 'docs/STRUCTURE_CROSS_VALIDATION.md', evidenceSource: 'docs/RESEARCH_PRIORITY.md', chartSource: `docs/figures/${png}`, legacyBitcoinResearchSnapshot: { observationsThrough: '2026-10-20', observationTimezone: 'UTC', referenceDate: '2026-10-22', referenceTimezone: 'Asia/Seoul' }, treasuryResearch:{reviewedAt:'2026-10-24',modelSource:'docs/TREASURY_PATH_MODEL.md',assetPathSource:'docs/TREASURY_ASSET_PATHS.md',legacyComparisonSource:'docs/TREASURY_MODEL.md',verificationSource:treasuryVerificationSource,pathMode:'asset-linked-daily',scenarioResults:'TREASURY_SCENARIO_RESULTS.json',...projectionSettings,financialDates:Object.fromEntries(['MSTR','BMNR'].map(symbol=>[symbol,scenarioResults.find(result=>result.symbol===symbol).financialAsOf])),marketAnchors:Object.fromEntries(['MSTR','BMNR'].map(symbol=>[symbol,scenarioResults.find(result=>result.symbol===symbol).asOf])),simulatedBars:scenarioDefinitions.simulatedBars,currentNavClaim:false,probabilities:null,predictiveValidation:'not-established'},researchLibrary:{manifest:'dist/research/manifest.json',articleCount:libraryManifest.articles.length,archive:libraryZip,scope:'original summaries, cross-checks, metadata and external media URLs, plus explicitly licensed CC0 Markdown sources',permittedSources:{manifest:'dist/research-sources/manifest.json',count:permittedSources.sources.length,license:permittedSources.license.id,selectionNote:permittedSources.selectionNote}}, dataRefreshWorkflow: '.github/workflows/refresh-data.yml', dataRefreshScheduleUtc: '20 0,6,12,18 * * *', cryptoconAuditSource: 'docs/CRYPTOCON_AUDIT.md', browserData: 'GitHub Actions refreshes completed daily observations and current anchors; published research tables and PNG retain their own vintage.', uncertainty: 'conditional assumptions; not confidence or prediction intervals' }, null, 2)}\n`);
const checksums = [];
for (const name of [...names].sort()) {
  checksums.push(`${createHash('sha256').update(await readFile(path.join(assets, name))).digest('hex')}  ${name}`);
}
await asset('SHA256SUMS.txt', `${checksums.join('\n')}\n`);
await writeFile(path.join(output, 'ASSETS.txt'), `${names.map(name => `release/assets/${name}`).join('\n')}\n`);
const [releaseNotes] = await collectDocuments([releaseNotesFile]);
await writeFile(path.join(output, 'RELEASE_NOTES.md'), `${releaseNotes.trim()}\n\n소스 커밋: ${commit}\n`);
console.log(JSON.stringify({ tag, commit, output, assets: names }));
