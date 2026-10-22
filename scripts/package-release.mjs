import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === '--tag' && /^v[0-9][A-Za-z0-9._-]*$/.test(args[1]),
  'Usage: node scripts/package-release.mjs --tag v1.4.0');
const tag = args[1];
const run = promisify(execFile);
const git = async (...argv) => (await run('git', argv, { cwd: root, encoding: 'utf8' })).stdout.trim();
const commit = await git('rev-parse', '--verify', 'HEAD');
// A dirty working tree could produce HTML that differs from its source ZIP.
await git('diff', '--exit-code', '--quiet');
await git('diff', '--cached', '--exit-code', '--quiet');
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
const sections = [];
for (const source of ['docs/GRAPH_WORKSPACE_GUIDE.md','docs/MODEL_SCOPE.md','docs/RIGHT_PANEL_VERIFICATION.md','docs/CRYPTOCON_AUDIT.md','docs/VIEWPORT_VERIFICATION.md','docs/MARKET_STRUCTURE_METHOD.md','docs/DETAILED_FORECAST_METHOD.md','docs/STRUCTURE_CROSS_VALIDATION.md','docs/RESEARCH_PRIORITY.md','docs/STRUCTURE_VERIFICATION.md']) {
  let text = await readFile(path.join(root, source), 'utf8');
  text = text.replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return match;
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), target));
    return `](https://github.com/${repository}/blob/${commit}/${relative})`;
  });
  sections.push(text.trim());
}
await asset('Bitcoin_Cycle_Structure_Research.md', `# Bitcoin Cycle Atlas ${tag}\n\n소스 커밋: ${commit}\n\n처음 사용하는 방법과 통합 그래프 안내를 먼저, 시장 구조·미래 경로·외부 교차검증·자료 우선순위·구현 검증을 그다음 순서로 제공합니다. 연구 결과는 2026-10-20 UTC 자료의 고정 스냅샷이며, 브라우저에서 갱신한 관측 자료와 날짜가 다를 수 있습니다. 미래 경로는 조건부 가정이며 확률 예측구간이 아닙니다. 과거 평가의 MAPE는 가격 고정 기준선보다 컸으며 장기 로그오차는 더 작았습니다. 일관된 예측 우위는 확인하지 못했습니다.\n\n---\n\n${sections.join('\n\n---\n\n')}\n`);
const zip = `bitcoin-cycle-atlas-${tag}-source.zip`;
await run('git', ['archive', '--format=zip', `--prefix=bitcoin-cycle-atlas-${tag}/`, `--output=${path.join(assets, zip)}`, commit], { cwd: root, env: { ...process.env, TZ: 'UTC' } });
names.push(zip);
await asset('RELEASE_METADATA.json', `${JSON.stringify({ tag, commit, repository, supportedNodeMajor: 24, workspaceGuideSource: 'docs/GRAPH_WORKSPACE_GUIDE.md', workspaceModes: ['price-and-outlook','four-year-comparison','duration-and-internal-phases','peak-zone-arrival','monthly-and-quarterly-changes','cryptocon-audit'], modelSource: 'docs/DETAILED_FORECAST_METHOD.md', modelScopeSource: 'docs/MODEL_SCOPE.md', chartDetails: 'shared right panel; docked desktop and overlay at <=600px', marketStructureSource: 'docs/MARKET_STRUCTURE_METHOD.md', crossValidationSource: 'docs/STRUCTURE_CROSS_VALIDATION.md', evidenceSource: 'docs/RESEARCH_PRIORITY.md', chartSource: `docs/figures/${png}`, researchSnapshot: { observationsThrough: '2026-10-20', observationTimezone: 'UTC', referenceDate: '2026-10-22', referenceTimezone: 'Asia/Seoul' }, dataRefreshWorkflow: '.github/workflows/refresh-data.yml', dataRefreshScheduleUtc: '20 0,6,12,18 * * *', cryptoconAuditSource: 'docs/CRYPTOCON_AUDIT.md', browserData: 'GitHub Actions refreshes completed daily observations; published research tables and PNG remain fixed.', uncertainty: 'conditional assumptions; not confidence or prediction intervals' }, null, 2)}\n`);
const checksums = [];
for (const name of [...names].sort()) {
  checksums.push(`${createHash('sha256').update(await readFile(path.join(assets, name))).digest('hex')}  ${name}`);
}
await asset('SHA256SUMS.txt', `${checksums.join('\n')}\n`);
await writeFile(path.join(output, 'ASSETS.txt'), `${names.map(name => `release/assets/${name}`).join('\n')}\n`);
const packageVersion = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
assert.equal(tag, `v${packageVersion}`, 'Release tag must match package.json');
const releaseNotesFile = `docs/RELEASE_V${packageVersion.split('.').slice(0,2).join('_')}.md`;
const releaseNotes = await readFile(path.join(root, releaseNotesFile), 'utf8');
await writeFile(path.join(output, 'RELEASE_NOTES.md'), `${releaseNotes.trim()}\n\n소스 커밋: ${commit}\n`);
console.log(JSON.stringify({ tag, commit, output, assets: names }));
