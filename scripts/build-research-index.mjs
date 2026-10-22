import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RESEARCH_EVIDENCE, RESEARCH_SUPPLEMENTS } from '../dist/evidence-index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const md=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n',' ');
let text='# 자료 읽기 우선순위 · 통합 연구\n\n연구 기준일: 2026-10-22 KST. 가격 관측 종료: 2026-10-20 UTC.\n\n';
text+=`${RESEARCH_EVIDENCE.length}개 대표 자료와 ${RESEARCH_SUPPLEMENTS.length}개 보조 링크를 URL 중복 없이 제공합니다. 순위는 원자료 → 검증 방법 → 사용자 지정 차트 감사 → 지지·반론 교차검증 → 소셜·전파·복원 기록 순서입니다. A–D는 자료의 활용 등급이며 예측 적중률이나 투자 점수가 아닙니다. 같은 family의 반복 인용을 독립 증거로 세지 않으며 다른 family도 통계적 독립을 보장하지 않습니다.\n\n`;
text+='사용자가 지정한 CryptoCon 감사와 ilay_vp 차트는 방법론 다음에 두었습니다. 직접 관측·검증 기준을 먼저 확보한 뒤 이 차트의 성공과 실패를 함께 읽습니다. 관련 [교차검증 보고서](STRUCTURE_CROSS_VALIDATION.md), [시장 구조 계산](MARKET_STRUCTURE_METHOD.md), [예측 검증 실패](DETAILED_FORECAST_METHOD.md)를 함께 제공합니다.\n\n';
text+='| 순서 | 자료 제목 | 출처 | 날짜 | 등급 | 읽는 목적 |\n|---:|---|---|---|:---:|---|\n';
for(const r of RESEARCH_EVIDENCE)text+=`| ${r.rank} | [${md(r.title)}](${r.url}) | ${md(r.publisher)} | ${md(r.date)} | ${r.tier} | ${md(r.role)} |\n`;
text+='\n## 각 자료의 근거·한계\n\n';
for(const r of RESEARCH_EVIDENCE){text+=`### ${r.rank}. ${r.title}\n\n- 원제: ${md(r.originalTitle)}\n- 원문: ${r.url}\n- 계보: ${r.family}; 시점: ${r.timing}; 입장: ${r.stance}.\n- 접근 상태: ${r.access}\n- 이 순서로 읽는 이유: ${r.reason}\n- 한계: ${r.limitation}\n`;
 const supplemental=RESEARCH_SUPPLEMENTS.filter(s=>s.parentId===r.id);if(supplemental.length)text+=`\n보조 원문:\n\n${supplemental.map(s=>`- [${md(s.title)}](${s.url})`).join('\n')}\n`;text+='\n';}
await mkdir(path.join(root,'docs'),{recursive:true});await writeFile(path.join(root,'docs/RESEARCH_PRIORITY.md'),text);console.log(JSON.stringify({sources:RESEARCH_EVIDENCE.length,supplements:RESEARCH_SUPPLEMENTS.length,bytes:Buffer.byteLength(text)}));
