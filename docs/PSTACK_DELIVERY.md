# pstack 절차 적용 기록

작성 기준일 2026-10-22. 이 문서는 구현과 검증의 담당 범위를 기록한다. 수행하지 않은 공개 실행을 완료로 표시하지 않는다.

## 적용 범위

사용자가 지정한 [cursor/plugins의 pstack](https://github.com/cursor/plugins/tree/main/pstack)을 GitHub에서 읽었다. 현재 환경에는 Cursor의 전용 실행기, 해당 모델 별칭, pstack 전용 도구가 없다. 공개 절차를 현재 사용 가능한 에이전트·브라우저·GitHub 도구에 맞춰 적용했다. 플러그인을 설치하거나 Cursor의 전용 에이전트를 실행했다고 주장하지 않는다.

읽은 절차는 [poteto-mode](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/SKILL.md), [swarm](https://github.com/cursor/plugins/blob/main/pstack/skills/swarm/SKILL.md), [architect](https://github.com/cursor/plugins/blob/main/pstack/skills/architect/SKILL.md), Feature·Shipping playbook이다. 사용자의 기존 배포·커밋 승인은 그대로 유지한다.

## 결정에 적용한 원칙

| 원칙 | 이 작업에서 바꾼 결정 |
| --- | --- |
| [Separate Before Serializing Shared State](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-separate-before-serializing-shared-state/SKILL.md) | 화면·렌더러·자료 원장·갱신 파이프라인의 쓰기 파일을 분리했다. 최종 통합과 공개 저장소 변경은 주 작업자가 담당한다. |
| [Prove It Works](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-prove-it-works/SKILL.md) | 구문 검사만으로 완료를 선언하지 않는다. 실제 가격 재계산, 작은 뷰포트의 렌더링, 공개 배포와 자동 갱신 실행을 직접 확인한다. |
| [Subtract Before You Add](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-subtract-before-you-add/SKILL.md) | 별도 설명 카드와 큰 여백을 줄이고 차트 안의 선택 값·근거 읽기로 통합한다. |
| [Model the Domain](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-model-the-domain/SKILL.md) | 관측값, 조건부 경로, 날짜 가정, 외부 전망 원장을 구별한다. 공개 당시 전망을 새 전망으로 덮어쓰지 않는다. |

## 병렬 분업과 합류 지점

| 작업 흐름 | 담당 산출물 | 검증·합류 조건 |
| --- | --- | --- |
| 화면 통합 | `viewport-workspace.js`, `viewport.css`, 페이지 통합 | 실제 뷰포트 크기, 문서 스크롤, 키보드 접근과 모든 설명의 열람 확인 |
| 차트·목록 렌더링 | `atlas-price-chart.js`, `atlas-analysis.js`, `evidence-view.js` | 실제 자료의 좌표·영역 검사, 선택 동작, 화면 높이에 맞는 목록 페이지 |
| 2024년까지 원문 조사 | `CRYPTOCON_EARLY_LEDGER.json`, 대응 노트 | 원래 주소·날짜·접근 수준·변경 이력 보존 |
| 2025–2026년 원문 조사 | `CRYPTOCON_RECENT_LEDGER.json`, 대응 노트 | 기한 내 목표와 미도래 전망을 구별, 정량 대조 |
| CryptoCon 비교 그래프 | `cryptocon-audit.js`, `cryptocon-audit-data.js` | 원래 시간 창·수정 창·관측 고점 분리, 임계값과 가격 오차 재계산 |
| 종합 보고서·자료 목록 | `CRYPTOCON_AUDIT.md`, `cryptocon-evidence.js` | 원장 합계·정규화 URL 중복·숫자 독립 검산, 원문 접근 한계 |
| 정기 갱신 | `refresh-data.mjs`, `data-update.js`, Actions workflow | 완료 일봉, 연속성, 이전 기록 보존, 오류 시 기존 자료 유지, 실제 배포 실행 |

공유 UI 파일의 변경은 최종 통합 단계에서 순서대로 적용한다. GitHub ref 갱신은 예상 이전 SHA를 확인하고 강제 푸시 없이 수행한다. 코드와 연구 문서가 같은 공개 저장소에 있으므로 별도 복제 저장소를 만들지 않는다.

## 처리량 점검

1. **선행 조건.** 기존 화면과 데이터 흐름, 원장 형식, 배포 상태를 확인한다.
2. **독립 작업.** 자료의 시기별 조사, 렌더러, 자동 갱신, 보고서의 출력 파일을 나눠 동시에 진행한다.
3. **공유 변경.** 앱 진입점·HTML·배포 ref는 통합 담당자 한 명이 변경한다. 다른 담당자가 맡은 파일은 읽기만 한다.
4. **최소 검증 단위.** 숫자 검증, 화면 검증, 갱신 실패 처리, 배포 검증을 각각 완료한 뒤 합친다. 이전 코드에 대한 통과 결과를 새 코드의 통과로 대신하지 않는다.

## 이 문서 작성 시점에 확인한 결과

- 두 원장에 31 + 34 =65개 기록이 있으며, 호스트·슬래시 정규화 뒤에도 65개 고유 주소다. 독립 주장 수라고 표현하지 않았다.
- 고정 표본에서 2025년 최대값, 90/95/97/98/99% 최초 진입, 체류일, 구간 MDD, 166,754달러 기한 내 부족분, 원래 좁은 날짜 창 오차를 독립 재계산했다.
- 레코드의 접근 수준은 공개 본문 5, 공개 도입부·소개 30, AI 영상 요약 4, X 색인·재현 25, 별도 보도 1로 합산된다.
- 원문 2개를 다시 직접 열어 주요 가속 가설과 2026년 9월 판단 수정을 대조했다. 일부 최신 페이지는 재접속 시 오류가 있어 이전 원장의 접근 기록을 보존했다.

## 최종 통합 검증 기록

아래 결과는 수행한 실행만 포함한다. 발행 뒤 실행할 검사는 별도로 구분한다.

| 확인 항목 | 실제 결과·증거 |
| --- | --- |
| 최종 커밋·변경 범위 | 기능 `78615ece4ad5efff41fa24529049d16348a2a79c`, 검증된 자료 갱신 `6e7a3252af336843cab00e8728c6137888c5db40`. 기능 커밋 44파일. 원격 tree와 로컬 검증 tree의 SHA 일치 확인. |
| 작성자와 다른 담당자의 검토 | PASS. 별도 검토자가 자료 갱신·CryptoCon 수치를 검산하고 실제 UI를 확인했다. 날짜 이동의 하루 드리프트를 발견해 수정 후 재확인했다. |
| 로컬 검증·테스트 | PASS. 12개 테스트 파일, 정적 참조와 25개 모듈 단일 HTML 빌드. 탐색 범위 7개 회귀 검사를 포함한다. |
| 데스크톱·좁은 화면의 브라우저 확인 | PASS. 360×640, 390×844, 1024×640, 1366×768에서 문서 넘침 없음. 최종 탐색·십자선·왕복 날짜 확인. |
| 설명·자료 목록·원자료 접근 확인 | PASS. 선택 정보·수식·설명 페이지, 87개 자료·16개 CryptoCon 필터, 원자료 표 확인. |
| 공개 사이트 배포 | PASS. 기능 CI [39729387874](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39729387874), Pages [39729387922](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39729387922). 공개 URL에서 새 아이콘·우측 축·탐색 도구 확인. |
| 정기 갱신 첫 수동 실행·실제 반영 | PASS. [39729446829](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39729446829)의 자료 검증·테스트·커밋·동일 실행 Pages 배포 성공. 2026-10-21까지 5,940행. |
| 릴리스·다운로드 산출물 검증 | PASS. 정확한 소스 `bba55a8f0a2d15b4191558b8e9bf9b7374b7bf4c`의 [v1.3.0](https://github.com/twoimo/bitcoin-cycle-atlas/releases/tag/v1.3.0). [Release 실행](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39730092114) 성공, 첨부 8개 크기·SHA-256과 로컬 패키지 일치. |

검토 결과는 `PASS`, `ISSUES`, `BLOCKED`로 남긴다. 발견한 결함을 수정한 뒤에는 영향을 받는 실제 동작을 다시 확인한다. 남은 접근 제한과 아직 도래하지 않은 예측의 평가를 완료 결과로 합치지 않는다.


## v1.4 후속 분업

우측 패널의 구현, 현재 모델 입력 감사, 반응형 브라우저 검수를 별도 담당자로 나눴다. 통합 담당자는 차트 안 표시·클릭·키보드 연결과 릴리스 패키지를 맡았다. 모바일 grid 폭과 십자선 클릭 문제를 실제 브라우저에서 찾아 수정한 뒤 재확인했다. 세부 증거는 [v1.4 검증](RIGHT_PANEL_VERIFICATION.md)에 남긴다. 기간·가격 가정을 데이터에서 학습한 결과로 표현하지 않도록 코드와 문서를 직접 대조했다.


v1.4의 정확한 소스는 `e61ded95562aa3f84a8819d004ca492bf380fd4d`이며 로컬·원격 tree를 대조했다. [CI](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39733215967), [Pages](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39733215724), [Release](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/39733543572)가 성공했다. 실제 공개 화면을 확인하고 첨부 8개 모두 동일 소스 패키지의 크기·SHA-256과 일치함을 확인했다.
