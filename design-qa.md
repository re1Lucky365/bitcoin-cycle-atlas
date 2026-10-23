# 기간선 하단 고정 · 상단 D-day/범례 · 크로스헤어 복귀 수정 검증

final result: passed

검토일: **2026-10-23 UTC** · package **1.12.1** · 자산 **1.12.1-cursor-hud.1**

이번 검증은 기간선의 줌 배치, 우측 상단 정보 묶음, 관측일로 반복 복귀하는 크로스헤어를 대상으로 한다. 상세 원인·구현·브라우저 좌표 기록은 [수정 보고서](docs/CYCLE_BOTTOM_HUD_FIX_2026-10-23.md)에 있다. 이전 TradingView 비교와 지표 전체 접기·가격축·PNG 검증은 [기준 커밋의 QA](https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/design-qa.md)와 [TradingView 차이 18개 감사](docs/TRADINGVIEW_PARITY_AUDIT_2026-10-23.md)에 보존한다.

## 1. 요구와 구현

| 요구 | 반영 결과 | 확인 방법 |
| --- | --- | --- |
| 사이클 기간 비교가 확대 때 위로 이동 | 기존 가격 그래프 하단 40%, 최대 200px 안에 아홉 관계별 행 고정. 시간축의 가로 길이와 잘림만 변경 | 실제 6개월·확대·드래그·선형 전환, 44개 기간 통합 회귀 |
| 높이를 늘리지 않고 그래프 안에 정리 | 별도 패널이나 가격축 여백 추가 없음. 좁은 폭은 짧은 라벨과 선택 상세로 보완 | 표시 전후 가격 path·domain·viewBox 비교, 실제 plot 높이 실측 |
| 첨부 범례를 D-day와 우측 상단에 배치 | 한 줄 D-day와 실제 가격·가정·범위·고저점·여섯 색 원 범례를 같은 오른쪽 경계로 정렬 | desktop 430px, mobile 297/227px. 개별 숨김·복원 확인 |
| 크로스헤어가 관측 세로선으로 반복 복귀 | HUD 변경은 기간선 그룹만 갱신. 필요한 전체 redraw에서는 유효한 포인터를 보존하고 새 좌표계로 투영 | 공개 기준 버전에서 재현, 수정 버전에서 같은 실제 포인터 입력 비교 |
| 지표 접기와 작은 화면 유지 | 지표 목록은 상단 정보 아래에서 펼쳐지고 스크롤. D-day/범례 위치와 plot 높이 유지 | 320px 열린 지표 목록 폭 227px, D-day 위치 불변 |

실선/점선, 여섯 색 원, 원래 UTC 날짜와 전체 기간, 관측/잠정/미래 가정의 구분을 보존한다. 가격 계산이나 미래 가정의 정확도가 개선되었다는 주장은 하지 않는다.

## 2. 실제 브라우저에서 확인한 원인

관측 캔들에서 미래 구간으로 포인터를 옮기면 OHLC 읽기 영역의 크기가 달라졌다. 기존 경로는 `readout → ResizeObserver → HUD 변경 → 전체 SVG redraw → 선택 날짜/asOf 초기화`였다. 다음 포인터 이벤트가 커서를 다시 마우스 위치로 옮기면서 복귀를 반복했다.

같은 6개월 범위·캔들 표시에서 화면 x를 **180 → 520 → 190 → 550 → 210 → 600**, y를 **300**으로 유지해 비교했다. 문서화된 브라우저 입력 API의 이동량 0 scroll로 실제 포인터를 움직였고, 표시 기간이 바뀌지 않았음을 확인했다. DOM 이벤트를 합성하지 않았다.

- **기존:** 첫 이동은 정상. 뒤의 다섯 이동은 SVG x **242.079**, y **441.86**의 관측일 위치로 복귀.
- **수정:** SVG x **137.50 → 477.39 → 147.96 → 503.53 → 163.64 → 555.82**, y는 전부 **260** 유지. plot의 화면 top이 40px이므로 y260이 입력 위치와 일치한다.
- **최종 자산 재확인:** 관측→미래→관측 이동에서 같은 날짜·가격 표시와 포인터 y 유지.
- **1h:** 세 좌표에서 x307.11/y260, x707.15/y410, x457.94/y260으로 정상 이동. 관측 완료 봉 읽기 유지.

원본 수치는 [qa-observations.json](docs/screenshots/cycle-bottom-hud-20261023/qa-observations.json)에 있다. 일·주·분봉 렌더러의 반복 redraw, 클릭·키보드·leave, 이전 RAF 취소, 다른 상세 패널의 선택 소유권은 자동 회귀로 추가 확인했다.

## 3. 배치 실측

| 실제 상태 | 관측 결과 |
| --- | --- |
| 1363×936 desktop | plot 높이 **833px** 유지. D-day **430×32px**, 범례 **430×66px**, 상단 y48/y80 |
| 6개월·확대·pan·선형 | 교차하는 네 기간선 y **608 / 586 / 564 / 520** 유지. 가격 하단 band **415–615px** |
| D-day만 숨김 | 범례 y80→48, plot 833px 유지. 빈 헤더 공간 제거 |
| 범례만 숨김 | D-day y48/h32 유지. 카드 외곽 모서리 복원 |
| 390×844 | body/scrollWidth **390/390**, plot **693px**, 정보 묶음 **297px** 폭 |
| 320×740 | body/scrollWidth **320/320**, plot **589px**, 정보 묶음 **227px** 폭 |
| 320px 지표 8행 펼침 | 목록 폭 **227px**, 내부 높이 **180px**, manager 210px. D-day y108, 범례 y140, plot 높이 유지 |

작은 화면 검사에서 넓은 화면용 CSS 최대 폭의 우선순위가 모바일 목록 너비를 0으로 만드는 문제를 발견했다. 해당 규칙을 **plot 컨테이너가 850px보다 넓을 때만 적용**하도록 수정한 뒤 열린 목록을 다시 실측했다. 반응형 wrapper는 실제 앱의 browser viewport 검사이며 물리 기기 성능 측정이 아니다.

## 4. 최종 자동 검사

| 검사 | 결과 |
| --- | --- |
| 전체 suite | **56/56 파일 exit 0** |
| 실제 case 집계 | node:test **485/485** + 기존 custom **44/44** = **529개 통과**, 실패·취소·skip·todo 0 |
| 정적 자산·Pages 경로 | **86 files / 163 refs**, 통과 |
| 사이클 자료 | **5,941개 관측**, asOf **2026-10-22**, 생성 결과 일치 |
| 성능 경계 | **104 SVG elements / budget 120**, source window 접근 경계 통과 |
| Standalone | **13,839,697 bytes / 61 modules**, 생성 산출물 정적 검사 통과 |
| Formal request ownership | TLC **1.7.4**, 정상 **5,955 generated / 2,081 distinct states**. 음성 대조의 예상 invariant failure와 구현 변이의 예상 assertion failure 확인 |

56개 파일 결과를 529개 항목에 다시 더하지 않았다. custom 44개는 이름이 있는 논리 검증·시나리오 수이며 내부 assert 호출 수가 아니다. 전체 실행 전후 136개 소스·테스트·package SHA-256은 동일했다. 부분집합 재실행도 합계에 중복으로 더하지 않았다.

주요 회귀: [하단 통합](tests/cycle-period-bottom-layout.test.mjs), [하단 배치](tests/cycle-interval-overlay.test.mjs), [커서](tests/chart-cursor.test.mjs), [HUD 관측](tests/indicator-workbench.test.mjs), [hover RAF](tests/chart-hover.test.mjs).

## 5. 확인 범위

이 문서는 최종 로컬 구현·브라우저·자동 검증의 기록이다. 원격 CI와 Pages 게시는 해당 PR 및 GitHub Actions의 실행 결과를 기준으로 한다.

가격 영역이 매우 짧으면 아홉 관계를 모두 읽을 만큼의 높이가 없으므로 이름 일부를 생략한다. 선·실제 기간·접근성 이름과 선택 상세는 유지하며 단일 관계 필터로 확인할 수 있다. 하단 고정과 차트 높이 유지라는 요구를 우선했다.

Node 성능 경계 검사는 브라우저 FPS나 물리 기기 입력 지연 측정이 아니다. Formal 검증도 제한된 요청 소유권 모델이며 전체 프로그램·가격·시간·liveness의 증명이 아니다. 이전 문서에 나열한 미구현 TradingView 기능을 이번 수정으로 구현했다고 주장하지 않는다.

## 6. 실제 캡처

| 비교 | 확인한 이미지 |
| --- | --- |
| 수정 전 6개월 | [01-before-zoom.jpg](docs/screenshots/cycle-bottom-hud-20261023/01-before-zoom.jpg) |
| 수정 후 같은 범위 | [02-after-zoom.jpg](docs/screenshots/cycle-bottom-hud-20261023/02-after-zoom.jpg) |
| 수정 후 390px | [03-after-mobile.jpg](docs/screenshots/cycle-bottom-hud-20261023/03-after-mobile.jpg) |

세 파일을 직접 열어 실제 표시와 본문 설명을 대조했다.
