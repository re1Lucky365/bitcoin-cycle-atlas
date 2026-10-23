# 최신 Atlas 차이와 개선 후보

**현재 코드 기준:** `d54d09ff653486a53435428b78f36d9ba68e5cae`, package v1.12.0. 조사 시작 기준 `0827b66c3be5028cc6945416d49cfe3764eaea16`은 과거 비교로만 사용한다. 조사 중 원격 main의 별도 개선을 발견했고, 깨끗한 로컬 작업 트리에서 fast-forward한 뒤 변경분을 재검토했다.

이 문서는 **문제·요구·수락 조건의 후보**다. 확정 아키텍처, 구현 승인, 예측 성능 검증 또는 출시 결정이 아니다. 이번 커밋은 문서·스크린샷만 추가하며 아래 기능을 새로 구현하지 않는다.

## 1. 핵심 판단

TradingView는 여러 시장의 실시간 분석·그림·지표·거래를 연결하는 범용 작업공간이다. Atlas는 **BTC 관측과 조건부 장기 가정·사이클 근거를 읽는 연구 작업공간**이다. 모든 기능의 개수를 맞추는 것보다, 가격·시간·출처·선택·복구의 의미를 일관되게 만드는 개선이 우선이다.

특히 다음을 결함으로 혼동하지 않는다.

- USD와 USDT, 단일 거래소와 Coin Metrics 가격 차이.
- 진행 중인 실시간 봉과 완료 봉만 제공하는 차이.
- 2010년까지의 일말 가격 이력과 같은 시기의 분봉 이력 차이.
- 사후 선정된 고저점과 그 당시 알 수 있었던 매매 신호 차이.
- 조건부 미래 경로와 실제 관측, 경제 가정 간 범위와 통계적 예측구간 차이.
- 독립 경과일 연구 창과 동일 달력 축의 가격 pane 차이.

## 2. 이미 해결되어 재구현하면 안 되는 항목

| 항목 | v1.12.0 현재 범위 | 현재 코드·검사 근거 |
|---|---|---|
| 수동 가격축 | 오른쪽 축 수직 드래그, 로그/선형 변환, 원본 USD domain 보존 | [price-axis.js][C-axis], [navigation][C-nav], `tests/price-axis.test.mjs`, `tests/chart-navigation.test.mjs` |
| Auto와 축 reset | 실제 토글 버튼. Auto에서 현재 Y 고정, 수동에서 Auto 복귀. 축 더블클릭은 Y만 복원 | [chrome][C-chrome] L148–149/L173, [navigation][C-nav] L322–327, [lab-view][C-lab] L626–628 |
| 수동 축 저장 | `price-min/max` URL·작업 화면, 비정상 범위 방어 | [workspace-state][C-workspace] L33–52, `tests/workspace-price-axis.test.mjs` |
| 주 차트 PNG | 상단 PNG 저장, SVG는 명령 메뉴에 보존. 출처·단위·기준일 메타데이터 | [export][C-export] L77–98, [lab-view][C-lab] L290–306, `tests/chart-data-export.test.mjs` |
| legend 전체 접기 | 대표 행 없이 전체 제목/값 접기, 하나의 지표도 접기, 복구 화살표, 도형 유지 | [indicator UI][C-indicator-ui] L200–220, [state][C-state] L47–58, `tests/indicator-workbench.test.mjs` |
| 접힘의 URL/모바일 계약 | 명시적 open/closed 보존. 명시값 없는 모바일은 기본 접힘 | [state][C-state] L39–58, `tests/indicator-state.test.mjs`, `tests/indicator-preferences.test.mjs` |
| pane 최소화 | 제목·복구 버튼 유지, 숨김/삭제와 별도 상태, URL·템플릿 보존 | [analysis dock][C-dock] L61–69/L102–111, `tests/analysis-focus.test.mjs` |
| 전봉 변화율 | 직전 동일 간격 종가 기준. 시가 대비 값과 봉 색은 별도 | [math][C-math] L44–55, [price chart][C-price] L193–200, `tests/chart-tradingview-parity.test.mjs` |
| 주봉 커서/주석 키 | 그린 주봉 꼭짓점 선택, 일별 사이클 앵커 보존, 주석 키 중복 방지 | [price chart][C-price] L71–77/L269–280, `tests/chart-tradingview-parity.test.mjs` |
| 지표 UI 모듈 장착 검사 | 실제 mountIndicatorWorkbench + reducer + URL 경계 검사가 새로 존재 | `tests/indicator-workbench.test.mjs` L3–7/L75–196 |

이 항목의 과거 미지원 설명은 역사로만 보존한다. ‘수동 Y축 없음’, ‘현행 PNG 없음’, ‘지표 UI 장착 테스트 없음’을 현재 미구현 목록으로 재사용하면 오류다.

관련 별도 작업의 구현·QA 기록: [TradingView parity 감사](https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/docs/TRADINGVIEW_PARITY_AUDIT_2026-10-23.md), [design QA](https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/design-qa.md). 그 문서에 적힌 과거 실행 수·다운로드·기기 검수는 **이번 세션이 재실행한 결과와 구분**한다.

## 3. 현재 지원 수준 비교표

| 사용자 작업 | TradingView에서 확인한 기준 | Atlas 현재 코드 | 남는 판단 |
|---|---|---|---|
| 종목/거래소 선택 | exchange:ticker, spot/파생 유형, 호가 통화 | 고정 BTCUSD. Coin Metrics/Bitstamp/Coinbase 용도가 나뉨 | 선택기 부재는 제품 범위. 출처 노출은 개선 후보 |
| 분·시간·일·주 간격 | 폭넓은 간격·즐겨찾기·직접 입력 | 실제 자료 기반 8간격, 30m/4h 구성봉 집계 | 미지원 간격을 빈 버튼으로 추가하지 않음 |
| 기간 이동 | 날짜/Custom range, 하단 프리셋 | 일·주 단일 날짜, URL 범위 복원, preset | intraday datetime/두 날짜 UI 차이 |
| 간격 전환 | 선택 간격으로 변경, 컨텍스트에 따라 range 동작 | X범위·분봉 선택 시각·일부 사건·측정 초기화. 일별 selectedDate·수동 Y는 유지 | 비대칭 정책을 먼저 검토 |
| 축 | Regular/Log/Percent/100, 반전, 가격만 Auto | log/linear + USD/최근=100 + 수동 Y/Auto | Percent/반전/시작=100은 독립 차이 |
| 커서/측정 | OHLC·포인터 축 가격, 임시 측정, 저장 도형 | 포인터 가격과 관측 분리, 단일 측정·자석 | 다중 보존/편집은 별도 후보 |
| 일반 그리기 | 추세선·도형·주석·객체 트리 | 자동 연구 표식·단일 측정. 일반 편집기 미발견 | 선택적 제품 확장 |
| 지표 | Built-In/Community/Pine, Inputs/Style/Visibility | 19항목: 표시3 + 가격11 + 분석5, 즐겨찾기/템플릿 | 범용 기술지표 19개가 아님 |
| pane | 확대/축소/이동/별도 축 등 | 연구 창5종, 독립 축/선택, 최소화·숨김·삭제 | 최대화·재정렬·경계 크기 조절 차이 |
| 저장 | 계정 레이아웃·명시 저장·Autosave | 로컬 이름 저장 최대8, URL 공유·재탐색 | 계정 sync/실제 undo는 아님 |
| 내보내기 | 이미지/CSV 진입. 이번 CSV는 플랜 제한 | 주 차트 PNG/SVG, 관측전용 CSV | 그림 전체·모든 pane·지표 CSV의 의미 확인 |
| replay/alerts/trade | UI 진입과 공식 사용법 | 미발견/명시적 제품 범위 밖 | 유사 버튼만 추가하지 않음 |

현재 소스의 존재는 런타임 전체 성공과 다르다. 이번 공개 Atlas 브라우저 캡처 A01은 **조사 시작 화면**이며 v1.12.0 배포를 재검증한 캡처로 쓰지 않는다.

## 4. 다음에 검토할 개선 후보 12개

우선도는 이 조사자의 **잠정 제안**이다. 사용 빈도·실제 불편·구현 위험을 측정한 점수나 외부 아키텍처 합의가 아니다. P0는 의미/안내 정합성, P1은 핵심 연구 흐름, P2는 선택적 확장이다.

### B01 · P0 · 현재 도움말과 버전 설명 정합성

- **현재 근거:** [viewport-workspace.js][C-viewport] L226에 `M은 일·주봉 측정`이 남아 있다. 분·시간봉 측정은 이미 지원한다. 루트 README는 v1.11.0 소개와 대표 한 행/모바일 기본 펼침 설명을 유지하지만 package는 v1.12.0이다.
- **사용자 문제:** 이미 가능한 기능을 못 한다고 믿거나, 접기·PNG·Auto를 옛 계약으로 이해하게 된다.
- **후보 범위:** 오래된 문서를 지우기보다 당시 버전으로 표시하고 현재 안내의 링크/요약만 갱신한다. 이번 연구 커밋에서는 기존 안내를 광범위하게 수정하지 않았다.
- **수락 조건:** 실제 지원 8간격·측정·PNG/SVG 진입·Auto·접기 저장·모바일 기본값이 코드와 일치한다. 역사 문서의 당시 기준은 보존한다.
- **회귀:** 도움말 문구 검사만으로 기능을 증명하지 않고 최소 한 일봉·한 분봉 작업을 UI에서 확인한다.

### B02 · P0 · 가격 자료 정체성과 내보내기 계약의 즉시 이해

- **현재 근거:** [lab-view.js][C-lab] L596–601의 CSV는 일·주 화면에서 Coin Metrics daily 가격이다. 실제 일·주 캔들은 Bitstamp이며 분·시간은 Coinbase다. [export][C-export] L4–18의 CSV 열에는 `interval/source/currency/kind`가 있다.
- **문제:** ‘현재 캔들 저장’으로 오해하면 보이는 OHLC와 다른 자료를 분석하게 된다.
- **후보:** 다운로드 직전에 자료 종류·source·interval·timezone·관측 전용 여부·로드된 범위를 보인다. 기존 정직한 관측전용 정책은 유지 가능하다.
- **수락 조건:** 일/주/분/시간 × 선/캔들 × USD/Indexed에서 파일이 무엇인지 미리 설명한다. 시각화 단위를 바꿔도 CSV USD라는 점을 명시한다. 누락·미래·미조회 봉은 관측으로 생성하지 않는다.
- **회귀:** 원관측 수와 export 행의 교집합, source·interval·종류, CSV 수식 주입 방어, 빈 범위/실패 안내를 검사한다.
- **TV 근거:** T04/T05/T53–T55, TV02/TV19. 이번 TradingView CSV 내용은 권한 제한 때문에 검증하지 못했다.

### B03 · P1 · 간격 전환 때 X·Y·선택을 보존하는 정책

- **현재 근거:** [lab-view.js][C-lab] L535–538은 X범위·분봉 선택 시각·일부 사건 선택·측정을 초기화하고 도구를 십자선으로 돌린다. 일별 selectedDate와 수동 priceDomain은 이 함수에서 초기화하지 않는다.
- **문제 후보:** 역사 구간을 읽다가 간격을 바꾸면 다른 날짜로 이동하면서 Y만 남아 자료가 사라진 것처럼 보일 수 있다. 실제 결함 확정 전 통제 재현이 필요하다.
- **후보 두 방식:** 날짜 중심/기간 유지 후 가용 봉에 clamp하거나, 기본 보기로 전환하되 수동 Y도 함께 복귀하고 이유를 알린다.
- **수락 조건:** 유지/초기화 표를 명시하고 daily↔intraday, 1D↔1W, 로딩/오류/빈 데이터에서 동일 정책을 따른다. 자료 없는 과거 분봉을 만들지 않는다.
- **회귀:** 간격 연속 전환과 늦은 응답의 소유권, 선택 시점·X·Y의 조합을 앱 경로에서 검증한다. 시장 자료 제어기를 수정한다면 프로젝트 verify-market-state 절차가 별도로 필요하다.

### B04 · P1 · 분봉 날짜·시각 이동과 두 날짜 직접 입력

- **현재 근거:** [chrome][C-chrome] L143–144/L161/L200에서 intraday 날짜 진입을 숨긴다. [lab-view][C-lab] L650–655는 일·주 단일 날짜다. URL range 복원은 이미 있다.
- **후보:** 지원 간격에서 정확한 시작/끝 또는 날짜·시각으로 이동한다. 표시 기간과 한 봉 간격을 별도 표기한다.
- **수락 조건:** UTC datetime, 간격 격자, 역전/불가능 날짜, 미래 완료 전 시각, 가용 이력 밖 입력을 구분한다. 로딩→성공/빈 결과/오류/캐시 fallback을 구분한다.
- **회귀:** 표시 범위 상한과 순서·취소·stale result 방어, 키보드 입력·Esc·포커스 복귀. TV T19/T20과 비교하되 정확한 최외곽 픽셀 일치를 요구하지 않는다.

### B05 · P2 · 가격축의 남은 모드와 기준점

- **이미 완료:** 수동 Y/Auto/reset/저장. 다시 구현하지 않는다.
- **남는 후보:** Percent, 가격축 반전, 표시 시작값=100, 가격만 Auto, 시간축 직접 드래그를 각각 독립 검토한다.
- **정의:** Percent와 최근=100은 다른 표현이다. 기존 Indexed의 분모를 조용히 변경하면 기존 공유 링크 의미가 달라진다.
- **수락 조건:** 가격·단위·기준값/날짜·auto/manual을 즉시 읽을 수 있다. 원본 USD domain, export 기준, 커서 역변환을 보존한다. log의 0·범위 수치 안정성을 검사한다.
- **TV 근거:** T44–T46, TV03. TradingView의 pan/zoom 기준 재설정 세부는 아직 미확인이다.

### B06 · P1 · 모바일 값 추적과 제스처 충돌

- **현재 근거:** 터치 탭·팬·핀치는 있지만 long-press tracking 상태기는 미발견이다. 전체 legend의 모바일 기본 접힘은 이미 구현됐다.
- **후보:** 길게 누르기 후 커서 추적·탭 해제, hold tooltip의 필요성을 실제 연구 작업으로 검증한다.
- **수락 조건:** 스크롤·팬·pinch·long-press 사이 오동작 없음, 좌우 가장자리의 값 읽기, 가로/세로 모드, 취소/손가락 수 변경, 복구 가능성. 물리 기기에서 확인한다.
- **증거 한계:** 이번 조사에서 TradingView 모바일 앱/viewport 시험은 하지 않았다. 공식 절차는 실제 실기기 증거가 아니다.

### B07 · P2 · 지표 세부 표시와 계산 입력

- **이미 완료:** 추가/숨김/삭제/즐겨찾기/템플릿/전체 legend 접기/기본 값 갱신.
- **후보:** 계산 입력, 선/채움 스타일, 값만 숨김, 축 라벨만 숨김, 표시 간격 조건을 구분한다.
- **수락 조건:** 실제 조절 가능한 항목에만 Settings를 제공한다. 불가능한 항목은 거짓 버튼으로 만들지 않는다. 값의 날짜·source·관측/가정·지원 간격이 유지된다.
- **회귀:** membership/visibility/readout/collapse/favorite/minimized의 독립성, 숨김 후 값 최신성, 템플릿 적용과 복구.
- **TV 근거:** T28–T30, TV16/TV21.

### B08 · P2 · 여러 연구 pane의 공간 관리

- **이미 완료:** 제목줄 최소화·복원, 숨김/삭제 분리, URL/템플릿 보존.
- **후보:** 최대화, 순서 변경, 경계 크기 조절. 가격 차트와 연구 창의 공간을 조절한다.
- **수락 조건:** 독립 경과일/달력축을 함부로 연결하지 않는다. 축소/숨김/최대화가 계산 결과나 선택 source를 바꾸지 않는다. 한 번의 복구 경로를 남긴다.
- **회귀:** 0/1/5창, 좁은 높이·긴 legend·기간선, 포커스·스크롤 영역, resize 중 export와 상태 보존.
- **TV 근거:** T26/T27, TV17/TV18. TV pane 전체 재배열을 직접 실행한 증거는 아니다.

### B09 · P1 · 변경을 되돌리는 최소 복구

- **현재 근거:** [state][C-state] L67–82는 직접 reducer이며 undo stack이 없다. 저장 불러오기는 URL 재탐색이다. URL replaceState와 reset은 undo가 아니다.
- **후보:** 지표 삭제·템플릿 적용·범위/축 변경 등 명시적 작업의 제한된 Undo/Redo부터 비교 검토한다.
- **수락 조건:** 한 사용자 동작을 한 이력 단위로 처리하고, 단순 hover·네트워크 수신을 이력으로 쌓지 않는다. undo 중 늦은 응답이 이전 화면을 되살리지 않는다. 공유/저장/재탐색 경계를 명시한다.
- **회귀:** 연속 변경·다시 실행·새 변경 뒤 redo 해제·잘못된 저장자료·가용 이력 변동. 확정 구조는 별도 설계·검토 대상이다.
- **TV 근거:** 실제 추세선 생성/Undo T41/T42, TV01/TV06.

### B10 · P2 · 측정·연구 주석의 편집과 보존

- **현재:** 분·시간봉 포함 단일 임시 측정과 OHLC 자석은 이미 있다. 자동 사이클 표식/피보나치는 일반 드로잉 편집기가 아니다.
- **후보:** 복수 측정, 정확 좌표, 메모, 선택/편집/잠금·저장 수요부터 검토한다. 전체 범용 drawing engine은 별도 선택지다.
- **수락 조건:** 시작·끝 날짜와 raw price, 봉 수와 달력 경과, 관측/가정 포함, source를 보존한다. 화면 리사이즈로 의미가 바뀌지 않는다.
- **회귀:** 간격·축·단위 변경, 누락 봉, 미래 영역, 오래된 데이터 갱신, keyboard 선택, 충돌 객체의 hit target.
- **TV 근거:** T32–T43, TV06/TV23. T40은 성공 영수증이 아니다.

### B11 · P2 · 내보내기 확장과 읽는 화면의 경계

- **이미 완료:** 주 차트 PNG/SVG·관측 CSV.
- **후보:** 분석 창 포함 이미지, 이미지 clipboard, 지표/가정 별도 CSV. 이미지 호스팅 링크와 계정 동기화는 별도 권한·서버 범위다.
- **수락 조건:** ‘현재 화면’이 메인 SVG만인지 모든 pane/설명까지인지 명시한다. 이미지 비동기 대기 중 상태 변화와 캡처 시점이 섞이지 않는다. 가정은 observed CSV로 내보내지 않는다.
- **회귀:** raster 실패·용량·폰트·긴 한글·출처 footer·숨김/최소화 pane·분봉 Indexed 기준일·자원 해제.
- **TV 근거:** T51–T55, TV13/TV19. 이번 TV 이미지 내보내기는 메뉴만 확인했고 CSV는 플랜 제한이다.

### B12 · P1 · 전체 사용자 경로·접근성의 재현 가능한 검증

- **이미 완료:** 실제 지표 component 장착 검사가 새로 있다. 이전의 ‘해당 검사 없음’ 평가는 철회한다.
- **남는 후보:** 명령 검색→설정→저장→URL 재탐색→복원, 실제 전체 앱과 브라우저의 연결; 키보드·스크린리더·물리 터치.
- **수락 조건:** 컴포넌트 DOM 대역과 실제 CSS·SVG 픽셀·native Tab 순서를 구분한다. 320/390폭, 가로 화면, 확대, 긴 이름, 로딩·오류·빈 결과·저장 거부가 같은 핵심 작업을 완료할 수 있다.
- **회귀:** source/revision/hash와 실행 조건·기대 상태를 기록한다. 스크린샷 생성 성공이나 테스트 수만으로 실제 작업 완료를 선언하지 않는다.
- **이번 증거:** 최신 SHA에서 npm test의 node:test 469/469 통과. 실제 Atlas v1.12 전체 브라우저 경로를 이번 세션이 새로 실행한 것은 아니다.

## 5. 별도 제품 범위로 남기는 것

다자산·거래소 선택, 실시간 틱/미완성 봉, 서버 알림, Replay, Paper Trading/실주문, Pine 실행, 커뮤니티/스크리너/포트폴리오는 TV의 주요 기능이지만 곧바로 Atlas 결함이나 다음 필수 구현 항목으로 승격하지 않는다.

특히 Replay는 사후 고저점 선정·가정 모형의 미래 정보 누출 검증이 먼저 필요하다. 알림/거래는 신뢰성·데이터 라이선스·계정·권한·서버 실행이 필요한 별도 결과물이다. UI 버튼만 만들면 기능이 있다고 오해하게 된다.

## 6. 구현 전의 세 가지 실무 질문

1. 사용자가 지금 끝내지 못하는 연구 작업은 무엇인가? 버튼 차이가 아니라 시작·입력·결과로 정의할 수 있는가?
2. 가격·시간·출처·관측/가정 중 어떤 의미를 바꾸는가? 기존 링크와 export를 보존할 수 있는가?
3. 정상/누락/오류와 실제 브라우저에서 무엇을 보면 성공이라고 판정할 것인가?

큰 구조 변경을 선택할 때는 기존 프로젝트의 설계·교차검토·시장 상태 검증 절차를 별도로 따른다. 이 문서와 커밋은 그 검토를 완료했다는 의미가 아니다.

[C-axis]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/price-axis.js
[C-nav]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/chart-navigation.js
[C-chrome]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/workbench-chrome.js
[C-lab]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/lab-view.js
[C-workspace]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/workspace-state.js
[C-export]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/chart-export.js
[C-indicator-ui]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/indicator-workbench.js
[C-state]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/indicator-state.js
[C-dock]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/analysis-dock.js
[C-math]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/chart-math.js
[C-price]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/atlas-price-chart.js
[C-viewport]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/d54d09ff653486a53435428b78f36d9ba68e5cae/dist/viewport-workspace.js
