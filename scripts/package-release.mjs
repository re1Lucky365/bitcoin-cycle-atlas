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
  'Usage: node scripts/package-release.mjs --tag v1.2.0');
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
for (const source of ['docs/GRAPH_WORKSPACE_GUIDE.md','docs/MARKET_STRUCTURE_METHOD.md','docs/DETAILED_FORECAST_METHOD.md','docs/STRUCTURE_CROSS_VALIDATION.md','docs/RESEARCH_PRIORITY.md','docs/STRUCTURE_VERIFICATION.md']) {
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
await asset('RELEASE_METADATA.json', `${JSON.stringify({ tag, commit, repository, supportedNodeMajor: 24, workspaceGuideSource: 'docs/GRAPH_WORKSPACE_GUIDE.md', workspaceModes: ['price-and-outlook','four-year-comparison','duration-and-internal-phases','peak-zone-arrival','monthly-and-quarterly-changes'], modelSource: 'docs/DETAILED_FORECAST_METHOD.md', marketStructureSource: 'docs/MARKET_STRUCTURE_METHOD.md', crossValidationSource: 'docs/STRUCTURE_CROSS_VALIDATION.md', evidenceSource: 'docs/RESEARCH_PRIORITY.md', chartSource: `docs/figures/${png}`, researchSnapshot: { observationsThrough: '2026-10-20', observationTimezone: 'UTC', referenceDate: '2026-10-22', referenceTimezone: 'Asia/Seoul' }, browserData: 'May refresh completed observations; stored research tables and PNG remain the published snapshot.', uncertainty: 'conditional assumptions; not confidence or prediction intervals' }, null, 2)}\n`);
const checksums = [];
for (const name of [...names].sort()) {
  checksums.push(`${createHash('sha256').update(await readFile(path.join(assets, name))).digest('hex')}  ${name}`);
}
await asset('SHA256SUMS.txt', `${checksums.join('\n')}\n`);
await writeFile(path.join(output, 'ASSETS.txt'), `${names.map(name => `release/assets/${name}`).join('\n')}\n`);
await writeFile(path.join(output, 'RELEASE_NOTES.md'), `# Bitcoin Cycle Atlas ${tag}\n\n초보자가 하나의 큰 그래프 영역에서 현재 위치와 앞으로 3년, 과거 사이클을 비교하도록 화면을 통합했습니다. 실제 관측과 미래 가정, 대표 경로의 고저점과 여러 경로의 전환 날짜 요약을 구분합니다.\n\n## 통합 그래프\n\n- 가격과 미래: 최근 관측·조건부 3년 경로·고저점·D-day·후보 범위\n- 4년 겹쳐 보기: 저점·반감기·달력 기준으로 출발값을 맞춘 과거 가격\n- 상승·하락 길이: 전체 기간과 상승장·하락장 내부의 반복 흐름\n- 고점권 도달: 95% 첫 진입과 최종 관측 최고값의 차이\n- 월·분기 변화: 수익률·최대 하락폭·가격 흔들림·새 최고가 일수\n\n그래프를 눌러 값을 고정하고, 방향키·날짜 입력·이전/다음 고저점으로 이동합니다. D-day를 누르면 후보 구간이 확대됩니다. 표시 설정과 계산표는 접힌 영역에 모았고, 71개 리서치 자료의 별도 무한 스크롤 표와 기존 세부 도구를 유지했습니다. 단일 HTML에도 새 그래프 스타일과 기본 테마가 포함되도록 패키징을 수정하고 기본 스타일 검사를 추가했습니다. 기존 연구 모형과 발행 계산값은 유지합니다.\n\n## 다운로드 파일\n\n- 단일 HTML: 데이터·스타일·모듈을 포함한 통합 차트 로컬 실행본\n- PNG: 2026-10-20 UTC 자료로 발행한 3년 연구 그래프 스냅샷\n- 연구 문서: 초보자 사용 안내 → 시장 구조·모형 수식·과거 평가·교차검증·읽기 우선순위\n- JSON: 고정 연구 스냅샷의 일별 시나리오·과거 평가·시장 구조·피보나치 대조 계산값\n- RELEASE_METADATA.json: 사용 안내·계산 자료 출처와 관측 스냅샷 날짜\n- 소스 ZIP: 커밋 ${commit}\n- SHA256SUMS.txt: 다운로드 파일의 무결성 확인\n\n## 자료 날짜와 해석\n\n저장된 연구 자료는 2026-10-20 UTC까지이며, 연구 기준일은 2026-10-22 KST입니다. 브라우저가 더 최근 완료 관측을 갱신하면 화면의 가격과 후보 날짜는 달라질 수 있습니다. 정적 PNG·결과 JSON·과거 검증표는 발행 스냅샷으로 유지합니다.\n\n미래 경로·D-day·가격 범위는 조건부 모의 결과이며 확률 보정 전입니다. 미래 날짜의 수학적 증명이나 확정된 시장 일정이 아닙니다. 기존 평가의 MAPE는 모든 기간에서 가격 고정 기준선보다 컸으며 장기 로그오차는 더 작았습니다. 일관된 예측 우위는 확인되지 않았습니다.\n\n사용 안내: https://github.com/${repository}/blob/${commit}/docs/GRAPH_WORKSPACE_GUIDE.md\n\n각 파일의 자세한 출처·이용 조건은 저장소 문서를 확인하세요.\n`);
console.log(JSON.stringify({ tag, commit, output, assets: names }));
