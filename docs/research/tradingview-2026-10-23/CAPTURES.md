# 캡처 전체 색인과 갤러리

2026-10-23 KST. PNG **70장**. 실제 UI이며 목업이 아니다. 화면 값은 촬영 당시 예시다. 단계별 해설은 [사용법](01-step-by-step.md), 파일 해시는 [manifest](capture-manifest.json)에 있다.

T40은 생성 성공 증거가 아닌 시도 기록이다. T05/T62/T63은 검수 후 재촬영했다. T62는 단축키 목록 첫 화면, T63은 자석 검색 결과이며 전체 단축키의 모든 행을 시각 촬영한 것은 아니다.

## 빠른 색인

| ID | 화면 | 결과/범위 |
|---|---|---|
| [A01](#a01-atlas-baseline) | Atlas 조사 시작 화면 | 조사 시작 당시 화면. 최신 d54d09f 공개 배포의 재검증 증거가 아님. |
| [T01](#t01-existing-layout-entry) | TradingView 기존 레이아웃 첫 진입 | 기존 차트의 개인 그림/지표를 연구용 신규 작업공간으로 오인하지 않음. |
| [T02](#t02-layout-plan-limit) | 새 레이아웃 플랜 제한 | 현재 계정 1 saved layout 제한 안내. 업그레이드/결제 없음. |
| [T03](#t03-main-baseline) | 비저장 조사 기준 화면 | MAIN을 수동 저장하지 않음. 새 레이아웃과 복사는 현재 플랜 제한. |
| [T04](#t04-symbol-search) | 심볼 검색: 거래소·상품 구분 | BINANCE:BTCUSDT는 USDT 호가. Atlas BTCUSD 합성/거래소 자료와 동일 원자료가 아님. |
| [T05](#t05-symbol-exact-exchange) | 거래소 지정 검색 | 검색 지연 중이던 최초 캡처를 폐기하고 실제 Bitstamp 결과가 나온 상태로 재촬영. 심볼 선택 안 함. |
| [T06](#t06-interval-menu) | 봉 간격 메뉴 | 상단 D/W는 봉 간격, 하단 1D/1Y는 보이는 기간. 서로 다른 제어. |
| [T07](#t07-daily-selected) | 일봉 전환 결과 | 자동 저장 false. 기존 MAIN 수동 저장 안 함. |
| [T08](#t08-chart-types) | 차트 유형 목록 | Heikin Ashi/Renko를 실제 거래 OHLC로 취급하면 안 됨. |
| [T09](#t09-line-result) | 선 차트 전환 결과 | 지표·그림은 유지, 가격 시각화만 전환 |
| [T10](#t10-settings-symbol) | 설정: Symbol | 선의 가격 source, 선 모양, 정밀도, 시간대. |
| [T11](#t11-settings-status) | 상태줄 설정 | 종목명·OHLC·지표 값·매수매도 표시의 분리 |
| [T12](#t12-settings-scales) | 축과 가격선 설정 | 축 위치·레이블·가격선과 눈금 제어. |
| [T13](#t13-settings-canvas) | 캔버스 설정 | 배경·그리드·십자선·탐색 버튼·여백을 분리 |
| [T14](#t14-settings-trading) | 거래 표시 설정 | 주문·포지션 표시 설정 열람. 거래 연결/주문 없음. |
| [T15](#t15-settings-alerts) | 알림 표시 설정 | 알림 표시만 조사, 알림 생성 안 함. |
| [T16](#t16-settings-events) | 이벤트 표시 설정 | Atlas 사건과 달리 실적/배당/경제 이벤트 체계. |
| [T17](#t17-quick-search-log) | 명령 검색: 로그 축 | 명령과 단축키가 같은 검색 결과에 표시됨. |
| [T18](#t18-log-axis-result) | 로그 축 전환 | 픽셀 변화는 로그 표시. 원자료 가격을 바꾸는 변환이 아님. |
| [T19](#t19-go-to-range) | Go to: 정확한 기간 입력 | 하단 기간 제어와 상단 봉 간격이 별개 |
| [T20](#t20-custom-range-result) | 2024년 구간 이동 결과 | 표시 기간 적용 후 차트 축 시각 검토 필요. |
| [T21](#t21-timezone-menu) | 시간대 선택 | 현재 UTC+9 Seoul. 시간대는 날짜 경계·봉 원자료 정의와 구분. |
| [T22](#t22-indicators-browser) | 지표 탐색: 분류와 즐겨찾기 | 개인 즐겨찾기는 수정 안 함. |
| [T23](#t23-indicator-rsi-search) | RSI 검색 결과 | 이름이 같은 커뮤니티 지표와 내장 지표를 구분 |
| [T24](#t24-rsi-added) | RSI 별도 패널 적용 결과 | 실제로 Indicator added to chart 및 Undo insert 확인. |
| [T25](#t25-object-tree) | 오브젝트 트리 | 그림·지표 객체의 선택과 관리, 단순 값 목록과 다름. |
| [T26](#t26-pane-maximized) | 패널 더블클릭 확대 동작 | Undo toggle maximized pane state 확인. RSI 설정 창 열기와는 다른 동작. |
| [T27](#t27-data-window) | 데이터 창 | 선택 시점의 OHLC/지표 값을 표 형식으로 읽음. |
| [T28](#t28-rsi-inputs) | 지표 설정: Inputs | 입력값은 계산 정의, Style/Visibility와 별도. |
| [T29](#t29-rsi-style) | 지표 설정: Style | 표시 선·기준선·채움·정밀도·상태줄 값을 개별 제어. |
| [T30](#t30-rsi-visibility) | 지표 설정: Visibility | 삭제와 달리 지원 시간 간격에서만 표시하는 상태. |
| [T31](#t31-indicator-templates) | 지표 템플릿 메뉴 | 기존 템플릿 적용·덮어쓰기·새 저장은 실행하지 않음. |
| [T32](#t32-trend-tools) | 추세·수평선·채널 도구 | 좌측 아이콘은 마지막 도구, 화살표는 전체 그룹. |
| [T33](#t33-fibonacci-tools) | Gann·피보나치 도구 | 목록 조사. 모든 계산 도구의 정확도 검증은 아님. |
| [T34](#t34-pattern-tools) | 패턴·엘리엇·사이클 도구 | 패턴 표시를 예측 정확도 보장과 혼동하지 않음. |
| [T35](#t35-forecast-measure-tools) | 예측·포지션·가격/날짜 범위 측정 | Long/Short position은 리스크 시각 도구. 실제 주문과 구분. |
| [T36](#t36-geometric-tools) | 도형·브러시 도구 | 그리기와 분석 데이터 레이어를 구분할 필요. |
| [T37](#t37-annotation-tools) | 텍스트·가격 라벨·노트 도구 | 분석 주석과 실제 가격 표식을 구분 |
| [T38](#t38-cursor-modes) | 커서 모드 | 십자선·점·화살표·지우개 등의 역할 구분 |
| [T39](#t39-magnet-control) | OHLC 자석 제어 | 자석 제어 존재 확인. 강도별 세부 메뉴는 이번 UI 경로에서 미확인. |
| [T40](#t40-trendline-created) | 추세선 메뉴 선택 전 시도 | 이 캡처에서는 도형 생성 미확인. 후속 T41에서 실제 수락 확인. |
| [T41](#t41-trendline-accepted) | 실제 2점 추세선 생성 | Undo create trendline 및 두 핸들 시각 확인. |
| [T42](#t42-undo-drawing) | 추세선 실행 취소 | Redo create trendline이 생김. 기존 그림 삭제 없음. |
| [T43](#t43-measure-range) | 두 점 임시 측정 | 일시 측정과 저장 도형은 별개. 시각 결과로 확인. |
| [T44](#t44-price-scale-menu) | 가격축 우클릭 메뉴 | 축 자동/고정·모드·반전·라벨과 메인 차트 메뉴는 별개. |
| [T45](#t45-percent-axis) | 백분율 축 적용 | 원가격 대신 기준점 대비 수익률 축. 로그 축과 다름. |
| [T46](#t46-indexed-axis) | Indexed to 100 적용 | Atlas 최근 관측값=100과 기준점 의미가 다름. |
| [T47](#t47-layout-sync) | 다중 차트 배치와 동기화 | 여러 차트·동기화 체크 항목은 메뉴 확인. 유료 기능을 실행/구독하지 않음. |
| [T48](#t48-alert-dialog) | 알림 생성 대화상자 | 실제 알림 생성 버튼 누르지 않음. 조건·유효기간·메시지·전달 방식은 별도 서버 객체. |
| [T49](#t49-alert-conditions) | 알림 조건 연산자 | 실제 목록은 Crossing / Crossing Up / Crossing Down 및 Show more. 추가 연산자 전체는 열람하지 않음. 알림 생성 없음. |
| [T50](#t50-replay-entry) | Bar Replay 진입 | 기존 Replay 진행을 Continue/Start new로 이어갈지 묻는 안내. 진행 보존을 위해 재생·전진·새 시작 안 함. |
| [T51](#t51-snapshot-export-menu) | 차트 스냅샷 메뉴 | 이미지 다운로드·복사·링크와 공개 게시를 분리. 공개 공유/게시 안 함. |
| [T52](#t52-layout-save-menu) | 저장·복사·공유·자료 내보내기 | Autosave=false 유지, Save 클릭 안 함. |
| [T53](#t53-csv-export-dialog) | CSV 자료 내보내기 진입 | 실제 파일 내용·시간대·범위 검증과 메뉴 도달을 구분. |
| [T54](#t54-csv-time-format) | CSV 시간 형식 | 화면에 UTC+9라고 표시. Atlas UTC CSV와 직접 섞지 않음. |
| [T55](#t55-csv-download-state) | CSV 다운로드 클릭 뒤 상태 | 실제 Download 클릭 후 Basic→Plus 업그레이드 안내. CSV 수신/스키마 검증은 미완료. 같은 경로 재시도 없음. |
| [T56](#t56-compare-symbols) | 여러 심볼 비교 진입 | 비교 심볼 검색. 실제 추가/변경은 뒤 절차에 명시. |
| [T57](#t57-compare-exchange-result) | 거래소 지정 비교 결과 | 같은 BTC라도 USDT/Binance와 USD/Bitstamp는 별도 시리즈. |
| [T58](#t58-compare-scale-options) | 비교 시리즈 배치 옵션 | 다중 시리즈의 단위·축 소유권을 명시적으로 선택. |
| [T59](#t59-compare-applied) | 비교 시리즈 적용 결과 | Undo insert Overlay 및 Bitstamp 비교 범례·백분율 축으로 수락 확인. |
| [T60](#t60-command-shortcut) | Cmd+K 실제 동작 | 이번 데스크톱 계정/문맥에서는 Search tool or function 명령 검색이 열림. |
| [T61](#t61-keyboard-shortcuts) | 공식 단축키 목록 | 플랫폼 실제 표기 기준. 도움말 목록 전체 확인과 각 단축키 실행은 다름. |
| [T62](#t62-shortcuts-chart) | 차트 단축키 목록 펼침 | 잘못 잘린 최초 캡처를 검수에서 폐기하고 실제 펼친 도움말 패널 첫 화면으로 교체. 전체 목록은 텍스트 근거에 별도 보존. |
| [T63](#t63-shortcuts-drawings) | 자석 임시 전환 단축키 검색 | magnet 검색 결과 Command+Move a point. 원래 잘못 잘린 이미지 교체. 다른 그림 단축키 전체는 텍스트 근거. |
| [T64](#t64-products-menu) | 우측 제품 탐색 메뉴 | Screener·뉴스·경제달력·포트폴리오 등 범위 확인. 개별 제품 전체 기능 시험 아님. |
| [T65](#t65-trading-panel) | 거래 연결 선택 화면 | 연결·약관 동의·모의주문·실주문 모두 실행하지 않음. |
| [T66](#t66-magnet-modes) | Weak/Strong Magnet 메뉴 | 두 강도의 선택지 확인. 강도별 모든 OHLC 스냅 반례 검증은 아님. |
| [T67](#t67-candle-style) | 캔들 표현 설정 | body·border·wick·전일 종가 기준 색상 및 정밀도. Line 설정과 다름. |
| [T68](#t68-before-restore) | 조사 종료 직전 비저장 상태 | 이후 reload로 저장된 기존 MAIN 재로딩. 새 RSI/비교 시리즈·축 변경 수동 저장 안 함. |
| [T69](#t69-restored-main) | 저장된 MAIN 복원 확인 | 새 RSI·Bitstamp overlay 없음. All changes saved disabled. 기존 차트 재로드 결과와 시각 확인. |

## 전체 이미지

### A01-atlas-baseline

**Atlas 조사 시작 화면**

1. 사용자가 지정한 기존 Atlas 탭을 읽고 캡처

관찰·한계: 조사 시작 당시 화면. 최신 d54d09f 공개 배포의 재검증 증거가 아님.

![A01-atlas-baseline Atlas 조사 시작 화면](captures/A01-atlas-baseline.png)

### T01-existing-layout-entry

**TradingView 기존 레이아웃 첫 진입**

1. Supercharts 열기
2. 기존 MAIN과 1W Candles 확인

관찰·한계: 기존 차트의 개인 그림/지표를 연구용 신규 작업공간으로 오인하지 않음.

![T01-existing-layout-entry TradingView 기존 레이아웃 첫 진입](captures/T01-existing-layout-entry.png)

### T02-layout-plan-limit

**새 레이아웃 플랜 제한**

1. Manage layouts → Create new layout

관찰·한계: 현재 계정 1 saved layout 제한 안내. 업그레이드/결제 없음.

![T02-layout-plan-limit 새 레이아웃 플랜 제한](captures/T02-layout-plan-limit.png)

### T03-main-baseline

**비저장 조사 기준 화면**

1. Supercharts 열기
2. Manage layouts에서 Autosave aria-checked=false 확인

관찰·한계: MAIN을 수동 저장하지 않음. 새 레이아웃과 복사는 현재 플랜 제한.

![T03-main-baseline 비저장 조사 기준 화면](captures/T03-main-baseline.png)

### T04-symbol-search

**심볼 검색: 거래소·상품 구분**

1. 상단 BTCUSDT 클릭
2. 동일 티커의 거래소별 결과 비교

관찰·한계: BINANCE:BTCUSDT는 USDT 호가. Atlas BTCUSD 합성/거래소 자료와 동일 원자료가 아님.

![T04-symbol-search 심볼 검색: 거래소·상품 구분](captures/T04-symbol-search.png)

### T05-symbol-exact-exchange

**거래소 지정 검색**

1. 검색창에 BITSTAMP:BTCUSD 입력

관찰·한계: 검색 지연 중이던 최초 캡처를 폐기하고 실제 Bitstamp 결과가 나온 상태로 재촬영. 심볼 선택 안 함.

![T05-symbol-exact-exchange 거래소 지정 검색](captures/T05-symbol-exact-exchange.png)

### T06-interval-menu

**봉 간격 메뉴**

1. Chart interval 열기
2. Minutes / Hours / Days 및 즐겨찾기 확인

관찰·한계: 상단 D/W는 봉 간격, 하단 1D/1Y는 보이는 기간. 서로 다른 제어.

![T06-interval-menu 봉 간격 메뉴](captures/T06-interval-menu.png)

### T07-daily-selected

**일봉 전환 결과**

1. 간격 메뉴에서 1 day 선택
2. 상태줄 1D 및 일봉 canvas 확인

관찰·한계: 자동 저장 false. 기존 MAIN 수동 저장 안 함.

![T07-daily-selected 일봉 전환 결과](captures/T07-daily-selected.png)

### T08-chart-types

**차트 유형 목록**

1. Candles 메뉴 열기
2. 표준 가격 차트와 변환 차트 구분

관찰·한계: Heikin Ashi/Renko를 실제 거래 OHLC로 취급하면 안 됨.

![T08-chart-types 차트 유형 목록](captures/T08-chart-types.png)

### T09-line-result

**선 차트 전환 결과**

1. 유형 메뉴에서 Line 선택
2. 상단 버튼 Line으로 바뀜 확인

관찰·한계: 지표·그림은 유지, 가격 시각화만 전환

![T09-line-result 선 차트 전환 결과](captures/T09-line-result.png)

### T10-settings-symbol

**설정: Symbol**

1. Settings 열기
2. Symbol 탭 확인

관찰·한계: 선의 가격 source, 선 모양, 정밀도, 시간대.

![T10-settings-symbol 설정: Symbol](captures/T10-settings-symbol.png)

### T11-settings-status

**상태줄 설정**

1. Settings → Status line

관찰·한계: 종목명·OHLC·지표 값·매수매도 표시의 분리

![T11-settings-status 상태줄 설정](captures/T11-settings-status.png)

### T12-settings-scales

**축과 가격선 설정**

1. Settings → Scales and lines

관찰·한계: 축 위치·레이블·가격선과 눈금 제어.

![T12-settings-scales 축과 가격선 설정](captures/T12-settings-scales.png)

### T13-settings-canvas

**캔버스 설정**

1. Settings → Canvas

관찰·한계: 배경·그리드·십자선·탐색 버튼·여백을 분리

![T13-settings-canvas 캔버스 설정](captures/T13-settings-canvas.png)

### T14-settings-trading

**거래 표시 설정**

1. Settings → Trading

관찰·한계: 주문·포지션 표시 설정 열람. 거래 연결/주문 없음.

![T14-settings-trading 거래 표시 설정](captures/T14-settings-trading.png)

### T15-settings-alerts

**알림 표시 설정**

1. Settings → Alerts

관찰·한계: 알림 표시만 조사, 알림 생성 안 함.

![T15-settings-alerts 알림 표시 설정](captures/T15-settings-alerts.png)

### T16-settings-events

**이벤트 표시 설정**

1. Settings → Events

관찰·한계: Atlas 사건과 달리 실적/배당/경제 이벤트 체계.

![T16-settings-events 이벤트 표시 설정](captures/T16-settings-events.png)

### T17-quick-search-log

**명령 검색: 로그 축**

1. Quick search 열기
2. log 입력

관찰·한계: 명령과 단축키가 같은 검색 결과에 표시됨.

![T17-quick-search-log 명령 검색: 로그 축](captures/T17-quick-search-log.png)

### T18-log-axis-result

**로그 축 전환**

1. Quick search에서 Logarithmic 단축키 확인
2. Escape/닫기 후 Alt+L 실행

관찰·한계: 픽셀 변화는 로그 표시. 원자료 가격을 바꾸는 변환이 아님.

![T18-log-axis-result 로그 축 전환](captures/T18-log-axis-result.png)

### T19-go-to-range

**Go to: 정확한 기간 입력**

1. 하단 Go to 열기
2. Custom range 선택

관찰·한계: 하단 기간 제어와 상단 봉 간격이 별개

![T19-go-to-range Go to: 정확한 기간 입력](captures/T19-go-to-range.png)

### T20-custom-range-result

**2024년 구간 이동 결과**

1. 시작 2024-01-01 / 종료 2024-12-31
2. Go to 실행

관찰·한계: 표시 기간 적용 후 차트 축 시각 검토 필요.

![T20-custom-range-result 2024년 구간 이동 결과](captures/T20-custom-range-result.png)

### T21-timezone-menu

**시간대 선택**

1. 하단 Timezone 클릭

관찰·한계: 현재 UTC+9 Seoul. 시간대는 날짜 경계·봉 원자료 정의와 구분.

![T21-timezone-menu 시간대 선택](captures/T21-timezone-menu.png)

### T22-indicators-browser

**지표 탐색: 분류와 즐겨찾기**

1. Indicators 열기
2. Personal / Built-In / Community 분류 확인

관찰·한계: 개인 즐겨찾기는 수정 안 함.

![T22-indicators-browser 지표 탐색: 분류와 즐겨찾기](captures/T22-indicators-browser.png)

### T23-indicator-rsi-search

**RSI 검색 결과**

1. Relative Strength Index 검색
2. Technicals와 Community 저자 구분

관찰·한계: 이름이 같은 커뮤니티 지표와 내장 지표를 구분

![T23-indicator-rsi-search RSI 검색 결과](captures/T23-indicator-rsi-search.png)

### T24-rsi-added

**RSI 별도 패널 적용 결과**

1. 내장 Relative strength index 클릭
2. 검색 창 닫기
3. 하단 RSI 패널 확인

관찰·한계: 실제로 Indicator added to chart 및 Undo insert 확인.

![T24-rsi-added RSI 별도 패널 적용 결과](captures/T24-rsi-added.png)

### T25-object-tree

**오브젝트 트리**

1. 우측 Object tree and data window 클릭

관찰·한계: 그림·지표 객체의 선택과 관리, 단순 값 목록과 다름.

![T25-object-tree 오브젝트 트리](captures/T25-object-tree.png)

### T26-pane-maximized

**패널 더블클릭 확대 동작**

1. 보조 패널 배경 더블클릭

관찰·한계: Undo toggle maximized pane state 확인. RSI 설정 창 열기와는 다른 동작.

![T26-pane-maximized 패널 더블클릭 확대 동작](captures/T26-pane-maximized.png)

### T27-data-window

**데이터 창**

1. 우측 Object tree → Data window

관찰·한계: 선택 시점의 OHLC/지표 값을 표 형식으로 읽음.

![T27-data-window 데이터 창](captures/T27-data-window.png)

### T28-rsi-inputs

**지표 설정: Inputs**

1. 범례 펼침 → RSI에 hover → Settings

관찰·한계: 입력값은 계산 정의, Style/Visibility와 별도.

![T28-rsi-inputs 지표 설정: Inputs](captures/T28-rsi-inputs.png)

### T29-rsi-style

**지표 설정: Style**

1. RSI Settings → Style

관찰·한계: 표시 선·기준선·채움·정밀도·상태줄 값을 개별 제어.

![T29-rsi-style 지표 설정: Style](captures/T29-rsi-style.png)

### T30-rsi-visibility

**지표 설정: Visibility**

1. RSI Settings → Visibility

관찰·한계: 삭제와 달리 지원 시간 간격에서만 표시하는 상태.

![T30-rsi-visibility 지표 설정: Visibility](captures/T30-rsi-visibility.png)

### T31-indicator-templates

**지표 템플릿 메뉴**

1. 상단 Indicator templates 클릭

관찰·한계: 기존 템플릿 적용·덮어쓰기·새 저장은 실행하지 않음.

![T31-indicator-templates 지표 템플릿 메뉴](captures/T31-indicator-templates.png)

### T32-trend-tools

**추세·수평선·채널 도구**

1. Trendline 행 우측 화살표 → Trend tools

관찰·한계: 좌측 아이콘은 마지막 도구, 화살표는 전체 그룹.

![T32-trend-tools 추세·수평선·채널 도구](captures/T32-trend-tools.png)

### T33-fibonacci-tools

**Gann·피보나치 도구**

1. Fib retracement hover → Gann and Fibonacci tools

관찰·한계: 목록 조사. 모든 계산 도구의 정확도 검증은 아님.

![T33-fibonacci-tools Gann·피보나치 도구](captures/T33-fibonacci-tools.png)

### T34-pattern-tools

**패턴·엘리엇·사이클 도구**

1. XABCD pattern hover → Patterns

관찰·한계: 패턴 표시를 예측 정확도 보장과 혼동하지 않음.

![T34-pattern-tools 패턴·엘리엇·사이클 도구](captures/T34-pattern-tools.png)

### T35-forecast-measure-tools

**예측·포지션·가격/날짜 범위 측정**

1. Forecasting and measurement tools 열기

관찰·한계: Long/Short position은 리스크 시각 도구. 실제 주문과 구분.

![T35-forecast-measure-tools 예측·포지션·가격/날짜 범위 측정](captures/T35-forecast-measure-tools.png)

### T36-geometric-tools

**도형·브러시 도구**

1. Geometric shapes 열기

관찰·한계: 그리기와 분석 데이터 레이어를 구분할 필요.

![T36-geometric-tools 도형·브러시 도구](captures/T36-geometric-tools.png)

### T37-annotation-tools

**텍스트·가격 라벨·노트 도구**

1. Annotation tools 열기

관찰·한계: 분석 주석과 실제 가격 표식을 구분

![T37-annotation-tools 텍스트·가격 라벨·노트 도구](captures/T37-annotation-tools.png)

### T38-cursor-modes

**커서 모드**

1. Cross hover → Cursors 열기

관찰·한계: 십자선·점·화살표·지우개 등의 역할 구분

![T38-cursor-modes 커서 모드](captures/T38-cursor-modes.png)

### T39-magnet-control

**OHLC 자석 제어**

1. 좌측 Magnet mode 버튼 확인·전환

관찰·한계: 자석 제어 존재 확인. 강도별 세부 메뉴는 이번 UI 경로에서 미확인.

![T39-magnet-control OHLC 자석 제어](captures/T39-magnet-control.png)

### T40-trendline-created

**추세선 메뉴 선택 전 시도**

1. 도구 메뉴 선택 전 캔버스 클릭 시도
2. 실제 생성은 확인되지 않음

관찰·한계: 이 캡처에서는 도형 생성 미확인. 후속 T41에서 실제 수락 확인.

![T40-trendline-created 추세선 메뉴 선택 전 시도](captures/T40-trendline-created.png)

### T41-trendline-accepted

**실제 2점 추세선 생성**

1. Trendline 메뉴 항목 명시 선택
2. (400,350)과 (700,220) 클릭

관찰·한계: Undo create trendline 및 두 핸들 시각 확인.

![T41-trendline-accepted 실제 2점 추세선 생성](captures/T41-trendline-accepted.png)

### T42-undo-drawing

**추세선 실행 취소**

1. Undo create trendline 클릭

관찰·한계: Redo create trendline이 생김. 기존 그림 삭제 없음.

![T42-undo-drawing 추세선 실행 취소](captures/T42-undo-drawing.png)

### T43-measure-range

**두 점 임시 측정**

1. Measure 선택
2. 차트 안에서 드래그

관찰·한계: 일시 측정과 저장 도형은 별개. 시각 결과로 확인.

![T43-measure-range 두 점 임시 측정](captures/T43-measure-range.png)

### T44-price-scale-menu

**가격축 우클릭 메뉴**

1. 가격축 위에서 우클릭

관찰·한계: 축 자동/고정·모드·반전·라벨과 메인 차트 메뉴는 별개.

![T44-price-scale-menu 가격축 우클릭 메뉴](captures/T44-price-scale-menu.png)

### T45-percent-axis

**백분율 축 적용**

1. 가격축 우클릭 → Percent

관찰·한계: 원가격 대신 기준점 대비 수익률 축. 로그 축과 다름.

![T45-percent-axis 백분율 축 적용](captures/T45-percent-axis.png)

### T46-indexed-axis

**Indexed to 100 적용**

1. 가격축 우클릭 → Indexed to 100

관찰·한계: Atlas 최근 관측값=100과 기준점 의미가 다름.

![T46-indexed-axis Indexed to 100 적용](captures/T46-indexed-axis.png)

### T47-layout-sync

**다중 차트 배치와 동기화**

1. Layout setup 열기

관찰·한계: 여러 차트·동기화 체크 항목은 메뉴 확인. 유료 기능을 실행/구독하지 않음.

![T47-layout-sync 다중 차트 배치와 동기화](captures/T47-layout-sync.png)

### T48-alert-dialog

**알림 생성 대화상자**

1. 상단 Create alert 클릭

관찰·한계: 실제 알림 생성 버튼 누르지 않음. 조건·유효기간·메시지·전달 방식은 별도 서버 객체.

![T48-alert-dialog 알림 생성 대화상자](captures/T48-alert-dialog.png)

### T49-alert-conditions

**알림 조건 연산자**

1. 알림 창 → Crossing 선택기 열기

관찰·한계: 실제 목록은 Crossing / Crossing Up / Crossing Down 및 Show more. 추가 연산자 전체는 열람하지 않음. 알림 생성 없음.

![T49-alert-conditions 알림 조건 연산자](captures/T49-alert-conditions.png)

### T50-replay-entry

**Bar Replay 진입**

1. 상단 Bar replay 클릭

관찰·한계: 기존 Replay 진행을 Continue/Start new로 이어갈지 묻는 안내. 진행 보존을 위해 재생·전진·새 시작 안 함.

![T50-replay-entry Bar Replay 진입](captures/T50-replay-entry.png)

### T51-snapshot-export-menu

**차트 스냅샷 메뉴**

1. Take a snapshot 클릭

관찰·한계: 이미지 다운로드·복사·링크와 공개 게시를 분리. 공개 공유/게시 안 함.

![T51-snapshot-export-menu 차트 스냅샷 메뉴](captures/T51-snapshot-export-menu.png)

### T52-layout-save-menu

**저장·복사·공유·자료 내보내기**

1. Manage layouts 열기

관찰·한계: Autosave=false 유지, Save 클릭 안 함.

![T52-layout-save-menu 저장·복사·공유·자료 내보내기](captures/T52-layout-save-menu.png)

### T53-csv-export-dialog

**CSV 자료 내보내기 진입**

1. Manage layouts → Download chart data

관찰·한계: 실제 파일 내용·시간대·범위 검증과 메뉴 도달을 구분.

![T53-csv-export-dialog CSV 자료 내보내기 진입](captures/T53-csv-export-dialog.png)

### T54-csv-time-format

**CSV 시간 형식**

1. 내보내기 창 → ISO time 선택기

관찰·한계: 화면에 UTC+9라고 표시. Atlas UTC CSV와 직접 섞지 않음.

![T54-csv-time-format CSV 시간 형식](captures/T54-csv-time-format.png)

### T55-csv-download-state

**CSV 다운로드 클릭 뒤 상태**

1. Download 버튼 클릭
2. download 이벤트 20초 대기

관찰·한계: 실제 Download 클릭 후 Basic→Plus 업그레이드 안내. CSV 수신/스키마 검증은 미완료. 같은 경로 재시도 없음.

![T55-csv-download-state CSV 다운로드 클릭 뒤 상태](captures/T55-csv-download-state.png)

### T56-compare-symbols

**여러 심볼 비교 진입**

1. 상단 Compare symbols 클릭

관찰·한계: 비교 심볼 검색. 실제 추가/변경은 뒤 절차에 명시.

![T56-compare-symbols 여러 심볼 비교 진입](captures/T56-compare-symbols.png)

### T57-compare-exchange-result

**거래소 지정 비교 결과**

1. Compare symbols → BITSTAMP:BTCUSD 검색

관찰·한계: 같은 BTC라도 USDT/Binance와 USD/Bitstamp는 별도 시리즈.

![T57-compare-exchange-result 거래소 지정 비교 결과](captures/T57-compare-exchange-result.png)

### T58-compare-scale-options

**비교 시리즈 배치 옵션**

1. 검색 결과에 hover
2. Same % scale / New price scale / New pane 확인

관찰·한계: 다중 시리즈의 단위·축 소유권을 명시적으로 선택.

![T58-compare-scale-options 비교 시리즈 배치 옵션](captures/T58-compare-scale-options.png)

### T59-compare-applied

**비교 시리즈 적용 결과**

1. BITSTAMP:BTCUSD → Same % scale
2. 창 닫기

관찰·한계: Undo insert Overlay 및 Bitstamp 비교 범례·백분율 축으로 수락 확인.

![T59-compare-applied 비교 시리즈 적용 결과](captures/T59-compare-applied.png)

### T60-command-shortcut

**Cmd+K 실제 동작**

1. 차트 화면에서 Cmd+K

관찰·한계: 이번 데스크톱 계정/문맥에서는 Search tool or function 명령 검색이 열림.

![T60-command-shortcut Cmd+K 실제 동작](captures/T60-command-shortcut.png)

### T61-keyboard-shortcuts

**공식 단축키 목록**

1. 프로필 메뉴 → Keyboard shortcuts

관찰·한계: 플랫폼 실제 표기 기준. 도움말 목록 전체 확인과 각 단축키 실행은 다름.

![T61-keyboard-shortcuts 공식 단축키 목록](captures/T61-keyboard-shortcuts.png)

### T62-shortcuts-chart

**차트 단축키 목록 펼침**

1. Keyboard shortcuts → Chart 영역 캡처

관찰·한계: 잘못 잘린 최초 캡처를 검수에서 폐기하고 실제 펼친 도움말 패널 첫 화면으로 교체. 전체 목록은 텍스트 근거에 별도 보존.

![T62-shortcuts-chart 차트 단축키 목록 펼침](captures/T62-shortcuts-chart.png)

### T63-shortcuts-drawings

**자석 임시 전환 단축키 검색**

1. Keyboard shortcuts → Indicators and drawings

관찰·한계: magnet 검색 결과 Command+Move a point. 원래 잘못 잘린 이미지 교체. 다른 그림 단축키 전체는 텍스트 근거.

![T63-shortcuts-drawings 자석 임시 전환 단축키 검색](captures/T63-shortcuts-drawings.png)

### T64-products-menu

**우측 제품 탐색 메뉴**

1. 우측 Products 열기

관찰·한계: Screener·뉴스·경제달력·포트폴리오 등 범위 확인. 개별 제품 전체 기능 시험 아님.

![T64-products-menu 우측 제품 탐색 메뉴](captures/T64-products-menu.png)

### T65-trading-panel

**거래 연결 선택 화면**

1. Trade 클릭

관찰·한계: 연결·약관 동의·모의주문·실주문 모두 실행하지 않음.

![T65-trading-panel 거래 연결 선택 화면](captures/T65-trading-panel.png)

### T66-magnet-modes

**Weak/Strong Magnet 메뉴**

1. Magnet 버튼 hover → Magnets 화살표 클릭

관찰·한계: 두 강도의 선택지 확인. 강도별 모든 OHLC 스냅 반례 검증은 아님.

![T66-magnet-modes Weak/Strong Magnet 메뉴](captures/T66-magnet-modes.png)

### T67-candle-style

**캔들 표현 설정**

1. Settings → Symbol (Candles 상태)

관찰·한계: body·border·wick·전일 종가 기준 색상 및 정밀도. Line 설정과 다름.

![T67-candle-style 캔들 표현 설정](captures/T67-candle-style.png)

### T68-before-restore

**조사 종료 직전 비저장 상태**

1. MAIN Save 표시 확인

관찰·한계: 이후 reload로 저장된 기존 MAIN 재로딩. 새 RSI/비교 시리즈·축 변경 수동 저장 안 함.

![T68-before-restore 조사 종료 직전 비저장 상태](captures/T68-before-restore.png)

### T69-restored-main

**저장된 MAIN 복원 확인**

1. 조사 변경 저장 없이 reload
2. 원래 1W Candles 및 지표 접힘 10/7 확인
3. Watchlist 다시 열기

관찰·한계: 새 RSI·Bitstamp overlay 없음. All changes saved disabled. 기존 차트 재로드 결과와 시각 확인.

![T69-restored-main 저장된 MAIN 복원 확인](captures/T69-restored-main.png)
