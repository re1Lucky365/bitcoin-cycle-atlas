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
  'Usage: node scripts/package-release.mjs --tag v1.0.0');
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
const png = 'Bitcoin_Three_Year_Outlook.png';
await copyFile(path.join(root, 'docs/figures', png), path.join(assets, png));
names.push(png);
const results = 'THREE_YEAR_RESULTS.json';
await copyFile(path.join(root, 'docs', results), path.join(assets, results));
names.push(results);
// Keep the release report sourced from the versioned repository documents.
// Relative code/doc links point to this exact commit and remain usable after download.
const sections = [];
for (const source of ['docs/THREE_YEAR_MODEL.md', 'docs/EVIDENCE_PRIORITY.md']) {
  let text = await readFile(path.join(root, source), 'utf8');
  text = text.replace(/\]\((\.\.?\/[^)]+)\)/g, (_, target) => {
    const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source), target));
    return `](https://github.com/${repository}/blob/${commit}/${relative})`;
  });
  sections.push(text.trim());
}
await asset('Bitcoin_Three_Year_Research.md', `# Bitcoin Cycle Atlas ${tag}\n\n소스 커밋: ${commit}\n\n미래 경로는 조건부 가정이며 확률 예측구간이 아닙니다. 아래 문서는 저장소의 모형 설명과 자료 우선순위를 함께 제공합니다.\n\n---\n\n${sections.join('\n\n---\n\n')}\n`);
const zip = `bitcoin-cycle-atlas-${tag}-source.zip`;
await run('git', ['archive', '--format=zip', `--prefix=bitcoin-cycle-atlas-${tag}/`, `--output=${path.join(assets, zip)}`, commit], { cwd: root });
names.push(zip);
await asset('RELEASE_METADATA.json', `${JSON.stringify({ tag, commit, repository, supportedNodeMajor: 24, modelSource: 'docs/THREE_YEAR_MODEL.md', evidenceSource: 'docs/EVIDENCE_PRIORITY.md', chartSource: `docs/figures/${png}`, uncertainty: 'conditional assumptions; not confidence or prediction intervals' }, null, 2)}\n`);
const checksums = [];
for (const name of [...names].sort()) {
  checksums.push(`${createHash('sha256').update(await readFile(path.join(assets, name))).digest('hex')}  ${name}`);
}
await asset('SHA256SUMS.txt', `${checksums.join('\n')}\n`);
await writeFile(path.join(output, 'ASSETS.txt'), `${names.map(name => `release/assets/${name}`).join('\n')}\n`);
await writeFile(path.join(output, 'RELEASE_NOTES.md'), `# Bitcoin Cycle Atlas ${tag}\n\n한국어 비트코인 주기 비교와 3년 조건부 전망 사이트입니다.\n\n- 단일 HTML: 데이터·스타일·모듈을 포함한 로컬 실행본\n- PNG: 저장소에서 검증한 3년 전망 차트\n- 연구 문서: 모형 수식·검증 실패·자료 읽기 우선순위\n- JSON: 시나리오의 일별 계산값\n- 소스 ZIP: 커밋 ${commit}\n- SHA256SUMS.txt: 다운로드 파일의 무결성 확인\n\n관측 자료의 마지막 날짜는 2026-10-20 UTC입니다. 미래 경로·가격 범위는 편집 가능한 가정이며 확률이나 투자 수익을 보장하지 않습니다.\n\n각 파일의 자세한 출처·이용 조건은 저장소 문서를 확인하세요.\n`);
console.log(JSON.stringify({ tag, commit, output, assets: names }));
