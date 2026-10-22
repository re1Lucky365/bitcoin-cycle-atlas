# 차트 조작 개선: TradingView 공식 안내와 구현 계약

검토일: 2026-10-22. 기준 코드: `f48c0d79a7922c7f460057629ae58e8a8b12c004` 이후 작업. 이 문서는 공식 원문에서 확인한 동작, Bitcoin Cycle Atlas에 적용한 선택, 자동 검증 범위를 구분한다. 공개 TradingView 화면의 실제 브라우저 감사와 현재 앱의 브라우저 검수는 별도 작업이며, 아래 자동 검사를 브라우저 검수로 바꾸어 부르지 않는다.

## 1. 공식 자료에서 확인한 동작

| 공식 자료 | 확인한 내용 | 적용 판단 |
|---|---|---|
| [Advanced Charts — Featuresets](https://www.tradingview.com/charting-library-docs/latest/customization/Featuresets/) | 휠 확대, 가로 휠 이동, 좌클릭을 누른 이동, 차트·축의 우클릭 메뉴를 각각 설정한다. | 실제 가격 영역의 휠·좌클릭 드래그를 기본 조작으로 제공한다. 축과 버튼의 이벤트는 가로 날짜 탐색이 가로채지 않는다. |
| [Stay in focus](https://www.tradingview.com/blog/en/stay-in-focus-15704/), 2019-12-06 | Ctrl/Command를 누른 확대에서 포인터 위치를 유지하는 방식을 소개한다. | Atlas는 기본 휠에 포인터 중심 확대를 적용한다. Ctrl/Command+휠과 브라우저 핀치는 기존 브라우저 확대에 남긴다. |
| [Advanced Charts — Keyboard shortcuts](https://www.tradingview.com/charting-library-docs/latest/configuration/Shortcuts/) | Shift+휠 이동, Ctrl/Command+방향키 탐색, Alt+R 복원, Alt+L 로그축, Alt+G 날짜 이동, Alt+Z 키보드 탐색을 제공한다. | 지원하는 실제 기능에 해당 단축키를 연결한다. 기본 좌우 방향키는 Atlas의 기존 값 선택 동작을 유지한다. |
| [Advanced Charts — Context menu](https://www.tradingview.com/charting-library-docs/latest/ui_elements/context-menu/) | 우클릭 또는 더보기 메뉴에서 현재 대상에 맞는 조작을 연다. | 범위 확대·축소·복원·전체 맞춤과 실제 선택 정보 복사를 제공한다. 조회 없는 가격이나 주문 기능을 메뉴에 넣지 않는다. |
| [Supercharts 설정 안내](https://www.tradingview.com/support/solutions/43000748166-how-to-configure-your-supercharts/) | 상단 설정, 시리즈 더블클릭 설정, 십자선, 시간·가격축, 하단 탐색 버튼과 자동 가격축을 설명한다. | 시간 범위 조작과 자동 가격축을 구분하고 버튼의 목적을 툴팁·접근 가능한 이름에 표시한다. |
| [Advanced Charts — Accessibility](https://www.tradingview.com/charting-library-docs/latest/configuration/accessibility/) | 도구 모음의 Tab·방향키 탐색, 차트 접근 단축키, 선택 정보의 보조기술 설명을 다룬다. | 간격 버튼의 방향키 이동, 문맥 메뉴의 초점 이동·Escape 닫기, 작업 결과 알림을 제공한다. 전체 접근성 적합성을 검증했다는 주장은 하지 않는다. |

**더블클릭 동작의 차이:** 공식 Advanced Charts 단축키 문서는 패널 더블클릭을 최대화로, Supercharts 안내는 시리즈 더블클릭을 설정 열기로 설명한다. Atlas의 가격 영역 더블클릭은 **현재 간격의 기본 표시 범위 복원**으로 정했다. 이 제품의 선택이며 TradingView 전체 동작의 복제를 주장하지 않는다. 측정 모드와 버튼·이벤트 표식에는 이 복원 동작을 적용하지 않는다.

## 2. 현재 제공하는 조작

| 조작 | 결과 |
|---|---|
| 가격 영역의 세로 휠 | 포인터의 시간 위치를 기준으로 확대·축소 |
| 가로 휠 또는 Shift+휠 | 보이는 시간 범위를 좌우 이동 |
| 좌클릭 드래그 | 십자선·이동 모드에서 시간 범위 이동; 수평 이동이 5px 이상일 때 시작 |
| 이동하지 않은 클릭 | 렌더러의 값 선택·고정 동작으로 전달 |
| + / − | 차트 중앙을 기준으로 확대·축소 |
| Shift+← / Shift+→ | 현재 폭의 25%만큼 이동 |
| Ctrl/Command+↑ / ↓ | 확대·축소 |
| Ctrl/Command+← / → | 현재 폭의 25%만큼 이동 |
| 0 / Alt+R / 가격 영역 더블클릭 | 현재 간격의 기본 범위로 복원 |
| 우클릭 / Shift+F10 / Context Menu 키 / 상단 더보기 | 차트 빠른 조작 메뉴 |
| 메뉴의 ↑ / ↓ / Home / End | 사용 가능한 메뉴 항목 사이 초점 이동 |
| 메뉴의 Escape | 메뉴를 닫고 차트로 초점 복귀 |
| C / H / M | 십자선 / 이동 / 두 지점 측정; M은 일·주 화면만 |
| Alt+L / Alt+G / Alt+Z | 로그·선형 전환 / 일·주 날짜 입력 / 차트로 초점 이동 |
| ? | 사용법 열기 |

분·시간 화면도 실제 조회한 UTC 시각 범위 안에서 확대·이동한다. 이 화면의 측정 기능은 아직 제공하지 않으므로 해당 도구를 숨긴다. 조회 범위 끝에서 무한한 과거 봉을 받아오거나 없는 봉을 생성하지 않는다. 장기 화면은 원래 관측 시작일과 출처 기반 장기 종료일을 경계로 유지한다. N년을 고르는 입력은 추가하지 않는다.

일별 범위의 기본 최소 폭은 기존의 30일, 분·시간 범위의 기본 최소 폭은 12개 시간 간격이다. 누락된 봉이 있는 구간에서는 시간 간격 수와 실제 표시 봉 수가 다를 수 있다. 실제 캔들의 유무와 OHLC는 원자료에 따르며 탐색 코드가 봉을 만들지 않는다.

## 3. 문맥 메뉴와 복사

빠른 조작 메뉴에는 포인터 위치 중심 확대·축소, 기본 범위 복원, 조회 가능한 전체 범위 맞춤을 둔다. 전체 맞춤은 일·주 화면에서는 실제 첫 관측부터 장기 전망 끝까지, 분·시간 화면에서는 현재 조회한 첫 완료 봉부터 마지막 완료 봉까지다. 기본 범위 복원은 앱이 정한 기본 창을 요청하는 별도 동작이다.

복사 항목은 렌더러가 실제로 제공한 `copyText`가 있을 때만 나타난다. 메뉴를 열거나 호버할 때는 클립보드에 쓰지 않는다. 사용자가 복사 항목을 실행하면 해당 날짜·출처·값을 복사하고 성공 또는 실패를 알린다. 브라우저에서 클립보드 API를 제공하지 않으면 항목을 비활성화한다. 미래 값의 복사 문자열에는 미래 가정임을 렌더러가 명시해야 한다.

메뉴는 버튼 이름, `role="menu"`와 `role="menuitem"`, 초점 이동을 제공한다. 바깥 클릭·초점 이탈·간격 변경·데이터 교체·창 이탈로 닫힌다. 모바일에서는 상단 더보기 버튼으로 같은 메뉴를 열 수 있다.

## 4. 모듈 연결 계약

구현 파일은 [chart-navigation.js](../dist/chart-navigation.js), [workbench-chrome.js](../dist/workbench-chrome.js)다. `dist/viewport.js`는 이 저장소에 없으며 우측 패널 연결은 [viewport-workspace.js](../dist/viewport-workspace.js)가 담당한다.

### 날짜 범위와 분·시간 범위

기존 날짜 문자열 계약을 그대로 지원한다.

```js
{
  start: '2025-10-22', end: '2050-12-31',
  min: '2010-07-18', max: '2050-12-31'
}
```

분·시간봉에는 실제 Unix 초와 기초 시간 간격을 전달한다.

```js
{
  unit: 'seconds',
  start: visibleFirstTime, end: visibleLastTime,
  min: firstCompletedCandle.time, max: lastCompletedCandle.time,
  step: interval.seconds,
  minSpan: 12,
  contextKey: `market:${interval.id}:${series.retrievedAt}`
}
```

끝점은 포함 범위다. 숫자는 유한한 정수이며 하나의 시간 격자에 맞아야 한다. `zoomRange`·`panRange`·`fitRange`는 입력의 단위·경계·정체성을 보존한다. `contextKey`가 바뀌거나 단위·자료 경계가 바뀌면 이전 렌더 프레임의 대기 중인 이동은 폐기한다. `onRangeChange`는 새 범위를 동기적으로 상태에 저장하고 렌더링을 예약해야 한다.

### 바인딩과 렌더러

`bindChartNavigation`은 다음 값을 받는다.

- `element`, `getRange`, `getTool`, `onRangeChange`, `onReset`: 기존 연결.
- `getContext({range, anchor, clientX, clientY})`: 포인터에서 실제로 선택할 날짜와 값의 `{label, copyText}`. `anchor`는 표시 영역 안의 0~1 위치다.
- `onAnnounce(text)`: 기존 접근성 알림 영역에 결과를 전달하는 선택적 콜백.
- `signal`: 선택적 AbortSignal. 취소하면 리스너와 대기 작업을 제거한다.

반환값은 `{toolbar, menu, update, openMenu, destroy}`다. `openMenu()`는 최근 포인터 위치 또는 차트 가운데를 사용하며 `{clientX, clientY}`를 명시할 수도 있다. 상단 더보기의 `atlas:chart-command` 액션 `context-menu`를 이 메서드에 연결한다.

렌더러는 SVG의 `data-plot-left/right/top/bottom`을 viewBox 좌표로 제공한다. 공통 시간축을 쓰는 거래량 패널도 영역에 포함할 수 있다. 탐색 코드는 이 실제 영역 안에서만 휠·드래그·문맥 메뉴를 처리한다. 호버와 단순 클릭은 렌더러가 처리하고, 실제 드래그 중 움직임과 종료 직후의 클릭만 탐색 코드가 차단한다.

Chrome 상태 이벤트는 기존 필드를 보존한다. `start/end`가 분·시간용 정수 초이면 하단에 유효한 UTC 날짜·시각으로 표시한다. 선택적 `navigationAvailable:false`는 자료가 없는 동안 더보기 버튼을 비활성화한다. 간격 버튼의 방향키는 같은 8개 간격 안에서 이동하며 새 간격을 요청한다.

### 취소와 정리

드래그는 창 수준의 포인터 종료도 처리하므로 차트 밖에서 마우스를 놓아도 남지 않는다. `pointercancel`, 포인터 캡처 상실, 측정 모드로 전환, 창 초점 상실, 숨김 상태, 데이터 정체성 변경은 캡처와 대기 중인 이동을 정리한다. `destroy`는 모든 등록 리스너·프레임·메뉴를 제거하고 기존 `touch-action`을 복원하며 반복 호출해도 안전하다.

## 5. 실행한 검증과 남는 범위

`node tests/chart-navigation.test.mjs` 실행 결과 **18개 테스트 통과**. `node --test tests/chart-navigation.test.mjs`, JavaScript 구문 검사와 수정 파일의 `git diff --check`도 통과했다.

검사에는 기존 UTC 날짜 탐색·윤일·반복 이동, 분·시간의 포인터 중심·시간 격자·자료 경계, 누락 구간의 원자료 보존, 잘못된 숫자 거부, 축·버튼·브라우저 확대 보존, 클릭과 드래그의 구분, 바깥 포인터 종료, 취소·간격 변경 시 이전 작업 폐기, 메뉴 초점·키보드, 명시적 복사와 실패 처리, AbortSignal 정리가 포함된다.

이 이벤트 검사는 의존성 없는 작은 DOM 경계 도구로 핸들러·콜백·초점·정리를 실행한다. 실제 브라우저의 터치 감각, 레이아웃, 메뉴 가림, 전체 키보드·보조기술 품질은 이 도구가 검증하지 않는다. 공개 TradingView의 실제 조작 관찰과 통합 앱의 브라우저 검수 결과는 해당 작업의 기록으로 별도 확인해야 한다.
