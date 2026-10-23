# TradingView Supercharts 공식 문서 리서치

- 관찰일: 2026-10-23, Asia/Seoul. 세부 observedAt은 JSON의 ISO 8601 시각.
- 범위: 공식 문서 24개. Help Center 23개와 공식 블로그 1개. 지정 시작 문서에서 실제 링크를 따라가고, 누락된 세부 기능만 공식 websearch로 보완했다.
- 수행: webfetch/websearch 읽기 전용. TradingView 계정·브라우저 탭·차트 UI·다운로드·알림 생성·코드·설정 변경 없음.
- source_id는 이번 웹 도구가 반환한 증거 식별자이며 문서 자체의 영구 ID는 아니다. 영구 추적에는 URL의 solution ID를 함께 사용한다.
- 각 항목의 인용은 짧은 원문 발췌이며, 나머지 한국어는 요약/해석이다. 일부 제목은 링크 라벨로 정규화했다.
- 가격·플랜별 개수·한도는 추정하지 않는다. 문서에서 구독 의존을 언급하더라도 현재 계정의 사용 가능 권한으로 단정하지 않는다.

## 1. 기능별 사용 흐름과 차이

### 1.1 종목은 이름이 아니라 데이터 정체성이다
1. 종목 검색을 열어 Crypto 등 범주를 고른다.
2. 정식 이름, 현물 등 상품 유형, quote currency, 거래소/소스를 확인한다.
3. 정확한 exchange:ticker를 선택한다.
4. 다른 차트나 비교 자료와 거래소·상품 유형이 같은지 확인한다.
근거: TV02, TV04. 같은 Bitcoin도 Kraken/Coinbase 주문 흐름이 달라 차트가 다르다고 공식 설명한다.
**Atlas 참고 권고:** asset label과 별도로 provider/exchange/ticker/instrument type/quote currency를 표시·저장한다. 이는 권고이지 현재 Atlas의 누락을 확인한 결과가 아니다.

### 1.2 봉 간격, 화면 기간, 데이터 가용 범위는 세 상태다
- 상단 interval: 한 봉에 들어가는 OHLC의 시간 또는 거래 기준.
- 하단 preset/Go to: 화면에 볼 기간. 단, TV01의 1D/All 예시는 봉 간격도 바꾸므로 두 상태가 결합된 명령일 수 있다.
- 로드된 데이터/저장소 이력: 화면 이동·내보내기·Replay가 실제 접근할 수 있는 범위.
사용 순서: 간격 선택 → 필요한 기간 이동 → 상태 표시에서 interval/기간/first available를 구분해 확인.
주의: 마지막 봉은 미확정일 수 있다. 일봉 이력이 있다고 같은 날짜의 분봉도 있다고 볼 수 없다.
근거: TV01, TV08, TV10, TV19.
**Atlas 참고 권고:** barInterval, visibleRange, loadedRange/availableRange를 분리하고 범위 프리셋이 간격을 바꾸는지 명시한다.

### 1.3 차트 유형은 표현만이 아니라 생성 규칙이다
- line/bar/candlestick은 기본 분석의 출발점이다.
- 시간 기반은 동일 시간 슬롯, 가격 기반은 가격 변화가 새 요소를 만든다.
- Renko는 합성 가격이며 원시 실제 체결 가격과 같지 않다. source interval과 projection/repaint 특성도 영향을 준다.
사용 순서: 목적 선택 → 유형 선택 → 유형별 설정 → 실제 가격/합성 여부 확인.
주의: Replay 지원 여부가 유형마다 다르다. 가격 기반 차트의 봉 수를 달력 주기로 해석하지 않는다.
근거: TV04, TV24, TV10.

### 1.4 가격축 네 모드
- **Normal/Regular:** 절대 가격차가 같으면 같은 거리. 공식 문서 명칭은 Regular.
- **Logarithmic:** 같은 비율 변화가 같은 축 간격을 갖도록 읽는 모드. 가격의 큰 자릿수 차이를 다룰 때 Regular와 시각적 해석이 달라진다.
- **Percent:** 시작점 대비 변동률을 선형으로 보여준다. Log와 다르다.
- **Indexed to 100:** 첫 값을 100으로 정규화해 다른 크기의 시리즈를 비교한다. 개념상 100 × price/base, Percent는 100 × (price/base - 1)에 해당한다. 이는 원문의 설명을 수식으로 재표현한 것이며 내부 구현 검증은 아니다.
사용 순서: 가격축 메뉴 → 모드 선택 → 기준값과 단위 확인 → Auto/price-only/좌우 축을 필요에 따라 조절.
주의: 로그를 끄면 Regular로 돌아간다. 첫 값의 기준이 pan/zoom 시 언제 바뀌는지는 이 자료만으로 확정하지 않는다. 로그의 0/음수 처리도 미확인.
근거: TV03, TV09.
**Atlas 참고 권고:** 축 모드, 정규화 기준 날짜/값, 실제 가격 tooltip을 분리하고 모드 전환 규칙을 명확히 한다.

### 1.5 지표: Inputs, Style, Visibility, pane, template
1. 상단 Indicators에서 지표를 추가한다.
2. 제목 옆 Settings를 연다. 제목 숨김 상태에서는 버튼이 보이지 않을 수 있다.
3. Inputs는 계산 입력이다. MA 예시: Length/Source/Offset.
4. Style은 색·두께·선 모양·가격선 등 표현이다.
5. Visibility는 표시할 chart interval 범위다. 계산 주기·데이터 소스·알림 snapshot과 같은 개념이 아니다.
6. 패널 이동은 드래그 또는 ... → Move to. 설정의 pane 버튼으로 패널 이동/접기/확대/제거를 관리한다.
7. 반복 구성을 Indicator Template → Save indicator template으로 저장한다. symbol/interval 기억 옵션은 TV01에 설명된다.
**중요:** 템플릿 적용은 기존 지표를 교체하며 지표 패널 그림이 제거될 수 있다. 템플릿에 그림이 저장되지 않는다. 지표가 모든 차트에 자동 동기화되는 것도 아니다. 전체 적용은 별도 명령이다.
근거: TV05, TV15–TV18, TV21–TV22, TV03.
**Atlas 참고 권고:** 계산 설정·표현 설정·표시 조건·패널 배치·재사용 preset을 다른 상태로 취급한다. 파괴적인 preset 교체 전 안내와 되돌리기를 제공한다.

### 1.6 그림: 기준점, magnet, lock, object tree
1. 도구를 고르고 두 점 이상 기준점을 찍는다.
2. Strong/Weak magnet과 OHLC/overlay indicator 부착 대상을 확인한다.
3. 세밀한 값은 Coordinates에서 지정한다.
4. Lock은 오이동 방지, Hide는 임시 표시 제어, Remove는 삭제다.
5. Object Tree에서 숨은 객체·지표·종목을 관리한다.
6. 그림의 local/layout/global sync 범위를 고른다. 같은 심볼 범위라는 조건이 있다.
주의: 동기화 해제는 다른 차트에서 객체 제거를 일으킬 수 있다. Object Tree의 그룹/폴더/잠금 UI는 짧은 추출 본문만으로 검증하지 않았다.
근거: TV06–TV07, TV09, TV18, TV23.

### 1.7 주기 길이 측정은 봉 수와 달력 시간을 병기한다
1. Date and price range를 선택한다.
2. 시작·끝 두 점을 정확히 정한다.
3. Stats에 price range, percent change, bars range, date/time range를 선택한다.
4. Coordinates로 가격/bar number를 보정하고 Text에 주기 의미를 적는다.
근거: TV23.
**Atlas 참고 권고:** bottom→top, bottom→bottom, halving→top 같은 anchor semantics를 명시하고 elapsed calendar time/bar count/price change를 별도 열로 계산한다. TradingView가 이 주기 분류를 자동 판별한다는 주장은 아니다.

### 1.8 레이아웃·동기화·Autosave
1. Manage layouts에서 이름 있는 작업공간을 생성·저장한다.
2. 다중 차트 배치를 선택한다. 새 차트가 첫 차트 지표를 받더라도 모든 스타일을 복제하는 것은 아니다.
3. symbol/interval/crosshair 등 동기화 대상과 그림 동기화를 각각 정한다.
4. 차트 설정은 Apply to all, 지표는 전체 레이아웃 적용 명령으로 명시적으로 전파한다.
5. Autosave를 설정하고 Save/unsaved 상태를 확인한다.
주의: 관심목록·알림은 레이아웃에 포함되지 않는다. 동일 레이아웃의 다중 탭 동시 편집은 마지막 설정 덮어쓰기 위험이 있다. 글로벌 그림의 실시간 전파는 Autosave 조건을 확인한다.
근거: TV09, TV18.
**Atlas 참고 권고:** 저장 범위와 sync 범위를 구분하고 작업공간 변경이 전역 알림·관심목록을 바꾼다고 암시하지 않는다.

### 1.9 Replay는 실시간 거래 세계와 분리해서 읽어야 한다
1. Bar Replay → 날짜/봉/첫 가용일/random bar 선택.
2. 단일 또는 전체 차트, 속도 선택.
3. Play/Forward 또는 Shift+↓/Shift+→ 사용.
4. Jump to real-time chart로 종료한다.
중요 제한: 기존 서버 알림·주문·호가창은 실시간, 새 서버 알림은 Replay에서 생성 불가. 봉 내부 세분 재생 불가. 일부 유형·도구 미지원. 낮은 간격의 과거 이력이 부족할 수 있다.
세션은 symbol/interval/time/state를 기억하나 유형·스타일 저장은 별개다.
근거: TV10.
**Atlas 참고 권고:** replay cursor와 live data timestamp를 분리하고 미래 데이터 누출 방지·실시간 기능 경고를 검증 항목으로 삼는다. 이는 설계 권고이며 Atlas나 TradingView의 구현을 감사한 결과가 아니다.

### 1.10 알림은 차트에 그려진 선과 다른 서버 객체다
1. 정확한 종목·간격·지표 입력을 설정한다.
2. Create alert에서 조건·만료·메시지·수신 방식을 구성한다.
3. Alert manager에서 상태를 확인한다.
주의: 지표를 바꿔도 기존 알림은 원래 설정을 사용한다. 순수 시리즈 가격 알림과 기술 지표 알림의 interval 의존성도 다르다. 외형 설정은 실행 조건 수정이 아니다.
근거: TV11, TV03, TV18.

### 1.11 CSV, snapshot, layout link의 목적
- CSV: 로드된 차트 데이터·지표 값의 외부 분석. 더 긴 이력이 필요하면 로드 범위 확보 후 다운로드한다.
- Snapshot: 현재 차트의 정적 이미지 저장·복사·공유.
- Layout link: 작업공간의 공유 보기. 수정 권한은 소유자에 남는다고 TV09가 설명한다.
주의: 셋은 서로를 대체하는 백업이 아니다. CSV 열/시간대/모든 drawing 포함 여부 등은 해당 문서가 보장하지 않는다.
근거: TV09, TV13, TV19.

### 1.12 검색·단축키·시간대·데이터 신선도
- Quick search는 도구/명령/설정의 command palette와 Recent search를 제공한다.
- 문서 확인 단축키: Save Ctrl/Cmd+S(TV09), Undo Ctrl/Cmd+Z(TV06), Create alert Alt/Option+A(TV11), Replay Shift+↓/Shift+→(TV10), 차트 숫자 입력으로 분 간격(TV08).
- Cmd/Ctrl+K는 TV02에서 Symbol search, TV12에서 Quick search라고 적혀 있다. 계정/컨텍스트/UI를 시험하지 않았으므로 하나로 단정하지 않는다. 전체 단축키는 avatar → Keyboard shortcuts로 보라고 TV11이 안내한다.
- 시간대는 하단 시계 또는 Settings → Symbol에서 변경한다. Exchange는 거래소 시간 사용. 표시 시간대 변경과 봉 집계 재계산은 같은 동작으로 입증되지 않았다.
- 차트 시세와 브로커 주문 패널은 다른 데이터 소스를 쓸 수 있다. 실시간/지연 여부는 소스별로 확인해야 한다.
근거: TV02, TV06, TV08–TV12, TV14, TV20.

## 2. 문서 한계와 미확인 항목

- 브라우저 체험 0회. 계정 로그인·플랜·현재 UI 배치·실제 데이터 이력·다운로드 결과·동기화 성공을 확인하지 않았다.
- 현재 Bitcoin Cycle Atlas 코드를 읽거나 실행하지 않았다. 위 Atlas 항목은 개선 후보 원칙이며 실제 기능 차이/결함 목록이 아니다.
- 가격·플랜별 차트/지표/알림 개수·이력 한도·구독 비용은 수집·추정하지 않았다. 실제 권한은 별도 라이브 확인이 필요하다.
- Help Center의 짧은 문서에는 이미지/영상에만 있는 조작 정보가 빠져 있을 수 있다. 동영상·이미지·iframe은 시청/조작하지 않았다. 텍스트로 확인한 내용만 사용했다.
- TV21은 2021년 발표 블로그이므로 현재 UI와 정확히 일치한다고 단정하지 않는다. Advanced Charts SDK 문서는 검색에 나왔지만 Supercharts 사용자 기능과 혼동하지 않기 위해 근거 집합에서 제외했다.
- Percent/Indexed 기준의 pan/zoom 재설정, log의 0/음수, CSV schema/timezone/visible vs loaded 세부 경계, Object Tree 그룹/잠금 상세, 알림별 봉 마감 평가·repainting, 모든 단축키 목록은 미확인.
- TV22의 WMA 예시 표 숫자에 내부 불일치가 있다(표의 TOTAL과 최종 계산 숫자). 이번 보고서는 그 계산 예제를 채택하지 않았다.
- 문서 간 Cmd/Ctrl+K 설명 중복과 sync 변경 경고 문구의 구체 UI 의미는 실제 기능 검증 때 해결할 항목이다.

## 3. 출처별 상세 기록

아래 각 문서에는 실제 webfetch source_id, 짧은 정확 인용, 사용 단계, 주의사항을 함께 기록했다. 인용은 원문 중 연속 구절이며 문장 전체일 필요는 없다.

### TV01. Getting started with Supercharts

- URL: https://www.tradingview.com/support/solutions/43000746464-getting-started-with-supercharts/
- source_id: `cNg0MFjYwWy5fKupf4KnA`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 사용자 지정 시작 URL
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Each chart interval represents a "step" in time for the price

**확인 사실**
- 상단은 종목·봉 간격·차트 유형·지표·알림·Replay·레이아웃·빠른 검색·스냅샷으로 구성된다.
- 하단 1D 프리셋은 하루를 1분 간격으로 표시하고 All은 사용 가능한 전체 이력을 월간 간격으로 표시한다고 안내한다.
- 가격축 모드와 시간대는 하단에서 설정할 수 있다.
- 지표 템플릿 저장 시 symbol과 interval을 기억하도록 선택할 수 있다.

**사용 단계**
1. 상단 종목 검색에서 데이터 대상을 고른다.
2. 상단에서 봉 간격과 차트 유형을 고른다.
3. 하단 프리셋 또는 Go to로 표시 기간을 정한다.
4. 원하는 지표·그림을 추가하고 레이아웃을 저장한다.

**주의 / 미확인**
- 하단 프리셋은 표시 범위뿐 아니라 봉 간격도 바꿀 수 있다.
- 이 문서만으로 실제 계정별 기능 권한은 확인되지 않는다.


### TV02. Symbol search: tips for finding assets

- URL: https://www.tradingview.com/support/solutions/43000746682/
- source_id: `WcWZgKKoJsQBxZfMEA7JH`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Symbol search 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> To point to one exact symbol, TradingView adds the exchange in front: NASDAQ:AAPL.

**확인 사실**
- 동일 자산이나 유사 티커가 여러 거래소·상품 유형에 존재한다.
- 검색 결과에는 티커·정식 이름·상품 유형·거래소 또는 데이터 소스가 표시된다.
- 정확한 식별에는 exchange:ticker 형태를 사용한다.
- 복수 소스 행의 화살표로 데이터 소스를 선택할 수 있다.
- +, -, *, /로 스프레드 차트를 만들 수 있다.

**사용 단계**
1. 상단 종목명 클릭 또는 타이핑으로 검색한다.
2. Crypto 등 자산 유형과 source 필터로 범위를 좁힌다.
3. 상품 유형·이름·데이터 소스를 확인한 뒤 선택한다.

**주의 / 미확인**
- BTC라는 이름만으로 spot/perpetual, USD/USDT, 거래소를 구분했다고 볼 수 없다. 이는 문서의 식별 원칙을 Bitcoin에 적용한 해석이다.
- Cmd/Ctrl+K는 이 문서에서 종목 검색으로 안내되지만 TV12에서는 Quick search로 안내되어 문서 간 모호함이 있다.


### TV03. How to configure your Supercharts

- URL: https://www.tradingview.com/support/solutions/43000748166/
- source_id: `8sUQun8joqj6rqMIy5hjm`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Settings 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Beware: turning off logarithmic scale returns the chart to the regular price scale

**확인 사실**
- 설정은 Symbol, Status line, Scales and lines, Canvas, Trading, Alerts, Events 등으로 나뉜다.
- Regular는 절대 가격차 기준 선형축, Percent는 시작점 기준 변동률 선형축이다.
- Indexed to 100은 차트 첫 값을 100으로 놓고 첫 값 대비 변동률을 더한다.
- Logarithmic는 비율 변화가 축상 간격을 결정한다.
- 로그를 끄면 이전 Percent/Indexed 선택과 관계없이 Regular로 돌아간다.
- Auto, Reset price scale, Scale price chart only, 축 반전과 좌우 배치를 설정할 수 있다.
- 설정의 Alerts 탭은 알림 외형 설정이며 알림 생성·실행 자체와 구분된다.

**사용 단계**
1. 우측 상단 또는 하단 톱니바퀴, 또는 가격선·봉 더블클릭으로 연다.
2. Scales and lines에서 축·라벨을, Canvas에서 배경·교차선·패널 버튼을 조절한다.
3. 가격축 하단 메뉴에서 Regular/Percent/Indexed to 100/Logarithmic를 선택한다.
4. Template에 차트 설정을 저장한다.

**주의 / 미확인**
- Percent와 Log는 같은 기능이 아니다.
- Indexed와 Percent의 기준은 문서상 첫 값/시작점이다. 화면 이동 시 기준 재설정 시점까지 이 문서는 명확히 규정하지 않는다.
- 문서의 로그 가격 예시는 반올림된 설명이므로 구현 공식의 정밀 검증 자료로 쓰지 않는다.
- 차트 설정 템플릿과 지표 템플릿, 전체 레이아웃은 별개다.


### TV04. Chart types available on TradingView

- URL: https://www.tradingview.com/support/solutions/43000703407/
- source_id: `APQjdJ_9Osku9ezVNrxvg`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Chart type 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Price-based charts don't factor in time

**확인 사실**
- 시간 기반은 동일 시간 단위마다 요소를 만들고 가격 기반은 정해진 가격 변화에 따라 요소를 만든다.
- Renko, Line Break, Kagi, Point and Figure, Range는 가격 기반 목록에 포함된다.
- 클래식 line/bar/candlestick, Heikin Ashi, footprint, SVP, TPO, column 등 목적이 다른 유형이 있다.
- 같은 Bitcoin도 Kraken과 Coinbase 주문 데이터 차이로 서로 다른 차트가 된다.

**사용 단계**
1. 상단 Chart type을 연다.
2. 가격·시간·거래량 중 필요한 정보를 기준으로 유형을 고른다.
3. 유형별 설정과 실제 데이터 소스를 함께 확인한다.

**주의 / 미확인**
- 유형 변경은 단순 색상 변경과 다르다. 생성 규칙·시간 표현·합성 여부가 달라질 수 있다.
- 이 문서의 차트 유형 총수는 제공 기능의 개요이며 계정별 이용 가능 수를 뜻하지 않는다.


### TV05. Indicators: simple steps to get started

- URL: https://www.tradingview.com/support/solutions/43000543626/
- source_id: `H2RMyP9qu_hk7ZbffLp8o`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Indicators 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> There are no universal indicators that work perfectly for all cases and all traders.

**확인 사실**
- 기술 지표는 거래소의 가격·거래량을 수식으로 처리한다.
- 기본적 지표와 Pine 커뮤니티 지표는 별도 범주다.
- Supercharts 상단 Indicators에서 Technicals/Fundamentals/Community Scripts로 접근한다.
- 지표 옆 ?로 해당 설명에 접근할 수 있다.

**사용 단계**
1. Indicators를 열고 범주를 선택한다.
2. 지표 설명과 계산 원리를 확인하고 추가한다.
3. 설정을 조정하고 다른 도구와 조합한다.

**주의 / 미확인**
- 지표 해석은 미래 결과 보장이 아니다.
- 특정 지표 입력값·표현 옵션은 지표별 문서로 확인해야 한다.


### TV06. Drawing tools available on TradingView

- URL: https://www.tradingview.com/support/solutions/43000703396/
- source_id: `y_EWS9DvIYW802FtDcxgg`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Drawing tools 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Strong magnet: Forces drawings to glue to the open, high, low, or close prices.

**확인 사실**
- 추세·Fibonacci/Gann·패턴·측정/예측·도형·주석 도구가 있다.
- 가격 패널뿐 아니라 지표 패널에도 그림을 놓을 수 있다.
- Strong magnet은 OHLC에 붙이고 Weak magnet은 가격과 떨어진 배치를 허용한다.
- Snap to indicators는 overlay 지표 값을 부착점으로 포함한다.
- Keep drawing, Lock all drawings, Hide, Sync, Remove는 서로 다른 관리 동작이다.

**사용 단계**
1. 왼쪽 도구 분류에서 도구를 선택해 기준점을 찍는다.
2. 정밀한 극값 지정에는 magnet 상태와 부착 대상을 확인한다.
3. 작업 완료 후 Lock all drawings로 오이동을 막는다.
4. 임시로 가릴 때 Hide, 삭제할 때 Remove를 구분한다.

**주의 / 미확인**
- 고정은 삭제나 동기화 정책을 대체하지 않는다.
- 달력 주기를 재는 목적이라면 가격 기반 차트의 봉 수와 경과시간을 혼동하지 않는다. 후자는 문서들로부터 도출한 권고다.


### TV07. Object Tree and Data Window: manage chart objects (descriptive title)

- URL: https://www.tradingview.com/support/solutions/43000484389/
- source_id: `Hy6AhhryvhLh0z2MBFnKn`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Object tree and data window 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Use the available options to hide, show, or remove the drawings, indicators and/or symbols.

**확인 사실**
- 오른쪽 Object Tree and Data Window 버튼에서 그림·지표·종목의 표시·숨김·제거를 관리한다.

**사용 단계**
1. 우측 툴바 Object Tree and Data Window를 연다.
2. 원하는 객체를 찾아 표시·숨김·제거 옵션을 사용한다.

**주의 / 미확인**
- 추출된 본문은 매우 짧다. 폴더·그룹·정렬·잠금·데이터창 수치 필드의 구체 기능은 이 본문에서 확인되지 않았다.
- 제목은 본문 기능을 설명하는 정규화 제목이며 원문 H1을 확보하지 못했다.


### TV08. Time intervals: a quick introduction and tips

- URL: https://www.tradingview.com/support/solutions/43000747934-time-intervals-a-quick-introduction-and-tips/
- source_id: `ZQoGNu9F-DYj0RTIAWUu1`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV03 Also read 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> The right-most candle may not be complete yet.

**확인 사실**
- 봉 간격은 한 봉에 포함되는 시간 또는 거래량적 단위를 정한다.
- 각 봉은 OHLC를 포함한다.
- 상단에서 시간 간격을 고르고 즐겨찾기·숨김·custom interval을 설정한다.
- 차트에 숫자를 입력하면 분 단위 간격을 빠르게 지정할 수 있다.
- 진행 중 마지막 봉은 계속 변한다.
- Tick은 거래 건수 기준이고 Range는 가격 변화 기준이다.

**사용 단계**
1. 상단 interval 메뉴에서 간격을 고른다.
2. 자주 쓰는 간격에 별을 표시한다.
3. 필요하면 Add custom interval을 쓴다.
4. 커서를 봉 위에 놓아 시작시각을 확인한다.

**주의 / 미확인**
- 거래 세션 종료로 마지막 봉의 실제 길이가 설정 간격보다 짧을 수 있다.
- 봉 수를 항상 동일한 달력 경과시간으로 환산할 수는 없다.
- 크립토의 실시간 마지막 봉은 확정 종가와 구분해야 한다.


### TV09. TradingView layouts: a quick guide

- URL: https://www.tradingview.com/support/solutions/43000746975-what-are-tradingview-layouts-a-quick-guide/
- source_id: `Jsb-GZ2Tjr3da9AGB4qYX`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV03 Also read 및 TV06 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Drawings belong to a symbol.

**확인 사실**
- 레이아웃은 종목·간격·차트 유형·지표·그림·스타일·설정을 저장하는 작업공간이다.
- Manage layouts에서 생성·저장·Autosave·복사·공유·CSV 내보내기를 관리한다.
- 새 다중 차트는 첫 차트 지표를 받지만 차트 설정까지 복제하지 않는다.
- 심볼·간격·교차선 등을 선택적으로 동기화한다.
- 그림의 layout/global sync는 같은 심볼을 대상으로 한다.

**사용 단계**
1. Manage layouts → Create new layout → 이름 지정 후 구성·저장한다.
2. Layout setup에서 다중 차트 배치를 고르고 동기화 대상을 정한다.
3. 왼쪽 툴바에서 그림 동기화 범위를 별도로 선택한다.

**주의 / 미확인**
- 글로벌 그림 동기화를 끄면 다른 레이아웃에서 해당 심볼의 그림이 제거된다고 안내한다.
- 차트 수의 실제 계정 한도는 조사하지 않았다.
- 복사·공유·내보내기는 서로 다른 기능이다.


### TV10. Bar Replay: how and why to test a strategy in the past

- URL: https://www.tradingview.com/support/solutions/43000712747-bar-replay-how-and-why-to-test-a-strategy-in-the-past/
- source_id: `j4QC8cI6-qUNdndbPeMk2`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Bar replay 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Server-side alerts persist based on real-time data

**확인 사실**
- 시작 봉·날짜·첫 가용일·random bar를 선택해 재생·정지·단계 진행한다.
- 현재 차트 또는 모든 차트를 같은 시점에 맞춰 Replay할 수 있다.
- 서로 다른 간격은 시간으로 동기화되며 큰 간격의 새 봉은 필요한 작은 봉이 쌓일 때 갱신된다.
- Replay 세션은 심볼·간격·마지막 봉 시점·재생 상태를 기억하지만 차트 유형과 스타일은 저장하지 않는다.
- 이력 깊이는 심볼·간격·데이터 저장 및 계정 제약에 따라 다르다.
- 새 서버 알림 생성은 Replay에서 불가하며 기존 알림·주문·호가창은 실시간 데이터 기반이다.
- Renko/Kagi/PnF/Range/Line Break/footprint/TPO, spread, tick charts는 미지원으로 열거된다.
- 봉 내부를 더 작은 조각으로 재생할 수 없다.

**사용 단계**
1. 상단 Bar Replay를 열고 시작 지점을 고른다.
2. 단일/전체 차트 모드를 선택한다.
3. Play 또는 Forward로 진행하고 속도를 조절한다.
4. Shift+↓로 시작/정지, Shift+→로 한 단계 진행한다.
5. Jump to real-time chart로 실제 현재 데이터에 복귀한다.

**주의 / 미확인**
- Replay를 Paper Trading이나 실제 브로커의 과거체결 환경으로 오해하면 안 된다.
- 낮은 간격 이력이 없으면 첫 가용 봉으로 이동하거나 Data point unavailable을 표시한다.
- Regression trend와 fixed range volume profile은 Replay 중 비활성이다.
- BITSTAMP:BTCUSD 이력 예시는 해당 소스 예시일 뿐 모든 Bitcoin 데이터 시작일이 아니다.
- 플랜별 이력 수치는 재현·추정하지 않았다.


### TV11. Introduction to TradingView alerts

- URL: https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/
- source_id: `e-caD8HAGJzkjghBxBxqS`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Alerts 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> If you change an indicator’s parameters after creating an alert, the alert will still trigger using the original settings.

**확인 사실**
- 가격·기술·관심목록 알림이 별도 범주다.
- 데이터 시리즈 가격 알림은 interval에 독립적이나 지표 등 다른 유형은 interval이 계산에 영향을 준다.
- 상단·우측 Alert manager·우클릭·가격축 +·Alt/Option+A에서 생성한다.
- 알림은 서버에서 실행되며 앱·toast·이메일·webhook·소리 등 전달 방식을 지원한다.
- 지표 입력값을 바꿔도 기존 알림은 생성 당시 설정을 사용한다.

**사용 단계**
1. 정확한 심볼을 연다.
2. Create alert에서 조건·주기/간격 관련 설정·만료·메시지를 확인한다.
3. 수신 방법을 고르고 Alert manager에서 관리한다.

**주의 / 미확인**
- 시각적 차트 변경이 기존 알림 조건 변경을 의미하지 않는다.
- 브라우저 toast에는 알림 권한이 필요하다.
- 조건별 봉 마감/봉 중간 평가와 재도색의 세부 차이는 이번 개요 문서만으로 완전히 설명되지 않는다.
- 플랜별 개수·기간·가격을 추정하지 않았다.


### TV12. Quick search on TradingView: find anything super fast

- URL: https://www.tradingview.com/support/solutions/43000659671-quick-search-on-tradingview-find-anything-super-fast/
- source_id: `rj0Ecx_AfG-lGDBJAYvux`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Quick search 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Every command or tool you've used via quick search is saved in the "Recent search" list.

**확인 사실**
- 그림 도구·차트 명령·설정을 한 검색창에서 찾고 실행한다.
- 상단 Quick search 또는 Cmd/Ctrl+K로 연다고 안내한다.
- add/insert/change/open 같은 명령어로 찾을 수 있다.
- Recent search에서 이전 명령을 다시 선택할 수 있다.

**사용 단계**
1. 상단 Quick search를 연다.
2. 도구 이름 또는 명령 동사를 입력한다.
3. 결과를 선택하거나 즐겨찾기·최근 기록으로 재사용한다.

**주의 / 미확인**
- TV02와 동일 단축키 설명이 겹쳐 실제 컨텍스트는 UI 검증이 필요하다.


### TV13. How to share a snapshot

- URL: https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot
- source_id: `g55m2PcMrzMKnXxHvNwKC`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Take a snapshot 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Feel free to share your snapshot at any time as it doesn't expire.

**확인 사실**
- 상단 카메라 버튼에서 차트 스냅샷을 만든다.
- 파일 저장·이미지 복사·이미지 링크 복사·X 전송을 지원한다.
- 문서는 스냅샷이 만료되지 않는다고 설명한다.

**사용 단계**
1. 카메라 아이콘을 누른다.
2. 다운로드·복사·링크 중 목적에 맞는 출력을 선택한다.

**주의 / 미확인**
- 스냅샷은 CSV 원시 데이터나 편집 가능한 전체 레이아웃과 다르다.
- 문서에서 단축키를 언급하지만 구체 조합은 본문에 없으므로 추정하지 않았다.
- 공유 전 거래·포지션 표시와 개인정보 포함 여부를 확인하는 것이 좋다.


### TV14. Is there a way to change chart timezone or clock time at the bottom of the chart?

- URL: https://www.tradingview.com/support/solutions/43000476526-is-there-a-way-to-change-chart-timezone-or-clock-time-at-the-bottom-of-the-chart/
- source_id: `oxygLVZz8LFnBMZarmsuk`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01 Time zone settings 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> You can change the chart timezone and/or time at the bottom bar by clicking on the clock

**확인 사실**
- 하단 시계 또는 Chart settings의 Symbol 탭에서 시간대를 바꾼다.
- TV01과 TV03은 Exchange 선택 시 해당 거래소 시간을 사용한다고 설명한다.

**사용 단계**
1. 하단 시계 또는 Settings → Symbol을 연다.
2. 원하는 시간대 또는 Exchange를 선택한다.

**주의 / 미확인**
- 표시 시간대 변경이 공급자 OHLC 봉의 실제 집계 경계를 다시 계산한다는 근거는 이 문서에 없다.
- CSV의 타임스탬프 형식·시간대는 이 짧은 문서에서 확인되지 않는다.


### TV15. What are indicator templates

- URL: https://www.tradingview.com/support/solutions/43000543048-what-are-indicator-templates/
- source_id: `BYb8mGzIKPtqTtYus1O5C`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 websearch 발견; TV19 Also read에서도 연결 확인
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Indicator templates are a way of grouping several indicators together into a single package

**확인 사실**
- 복수 지표를 묶어 다른 차트에 적용한다.
- 기본 제공 템플릿과 사용자 템플릿을 지원한다.
- 현재 원하는 지표를 구성한 뒤 Save indicator template으로 저장한다.

**사용 단계**
1. 상단 Indicator Template에서 사전 템플릿을 선택한다.
2. 사용자 템플릿은 원하는 지표 구성 후 Indicator Template → Save indicator template을 누른다.

**주의 / 미확인**
- 지표 템플릿이 전체 차트·그림·알림을 저장하는 것은 아니다.
- 적용 시 기존 지표와 보조 패널 그림에 대한 파괴적 영향은 TV18을 반드시 함께 읽어야 한다.


### TV16. How to adjust the indicator settings

- URL: https://www.tradingview.com/support/solutions/43000480333-how-to-adjust-the-indicator-settings/
- source_id: `6m435VPAwNhmRVFgwlBg2`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 문서 websearch로 발견
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Make sure that the title is On

**확인 사실**
- 지표 이름 옆 Settings로 해당 지표 설정을 연다.
- 지표 제목이 숨겨져 있으면 Settings 버튼도 보이지 않는다.

**사용 단계**
1. 지표 제목 표시를 켠다.
2. 제목 옆 Settings를 누른다.

**주의 / 미확인**
- 본문은 설정 진입만 설명한다. 모든 지표가 동일 Inputs/Style 항목을 갖는다고 일반화하지 않는다.


### TV17. How to move an indicator to the main pane

- URL: https://www.tradingview.com/support/solutions/43000762829-how-to-move-an-indicator-to-the-main-pane/
- source_id: `GhsgKWiTEhmK2zcoCh3ZP`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 문서 websearch로 발견
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> select the preferred Move to option.

**확인 사실**
- 지표를 수동으로 드래그하거나 ... 컨텍스트 메뉴의 Move to로 main pane으로 옮긴다.

**사용 단계**
1. 지표를 대상 패널로 드래그하거나 ... → Move to를 선택한다.

**주의 / 미확인**
- 서로 다른 단위의 지표를 겹칠 때 축 배치와 스케일을 별도로 검토해야 한다. 이는 사용성 권고이며 이 짧은 문서가 자동 축 정책을 규정하지는 않는다.
- 본문은 main pane 이동에 초점을 맞추며 모든 pane 재배치 옵션을 열거하지 않는다.


### TV18. Layouts, charts, drawings, indicators, and their interaction

- URL: https://www.tradingview.com/support/solutions/43000692404-layouts-charts-drawings-indicators-and-their-interaction/
- source_id: `7HGii2jmKs7BkfFG5eLzi`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 문서 websearch로 발견
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> watchlists and alerts are not stored in layouts.

**확인 사실**
- 레이아웃은 고유 URL로 식별되지만 관심목록과 알림은 포함하지 않는다.
- 지표와 차트 설정은 차트·레이아웃 사이 자동 동기화되지 않는다.
- Apply to all, Add this indicator to the entire layout, Apply these indicators to the entire layout은 명시 적용 동작이다.
- 지표 템플릿 적용은 현재 시리즈 및 보조 패널의 지표를 교체한다.
- 그림은 지표 템플릿에 저장되지 않아 보조 패널 그림이 제거될 수 있다.
- 글로벌 그림의 창/탭/기기 간 실시간 동기화에는 Autosave가 필요하며 꺼져 있으면 수동 저장 시 한 번 동기화된다.
- 같은 레이아웃을 여러 탭에서 편집하면 차트 설정은 마지막 변경만 저장될 수 있다.

**사용 단계**
1. 차트별 설정·지표와 심볼별 그림의 소유 범위를 구분한다.
2. 전체 적용이 필요하면 명시적인 Apply 메뉴를 사용한다.
3. Autosave와 Save 표시를 확인하고 닫기 전에 저장한다.
4. 템플릿 교체 전 보조 패널 그림이 있는지 확인한다.

**주의 / 미확인**
- 지표 템플릿으로 그림을 잃으면 즉시 문서의 cancel 동작으로 되돌리라고 안내한다. 구체 버튼 의미는 UI 미검증이다.
- 레이아웃 삭제는 복구 불가라고 명시한다.
- 현재 열지 않은 심볼의 그림 삭제는 Undo로 복원되지 않는다고 경고한다.
- 동기화 범위 변경은 단순 숨김 토글이 아니라 다른 차트 객체 제거를 수반할 수 있다.


### TV19. How to export chart data

- URL: https://www.tradingview.com/support/solutions/43000537255-how-to-export-chart-data/
- source_id: `I32BNYbhJrQyfPdjpSBBc`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 websearch로 발견; TV09의 CSV export 설명을 세부 보완
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> The data you export is what your chart shows you.

**확인 사실**
- 티커와 지표를 포함한 차트 데이터를 CSV로 저장한다.
- 상단 메뉴 Download chart data… → 차트 선택 → Download 순서다.
- 데이터가 로드되어야 다운로드할 수 있으며 더 긴 이력은 왼쪽 이동 또는 x축 드래그로 추가 로드한다.

**사용 단계**
1. 필요한 과거 범위를 로드한다.
2. Download chart data…를 연다.
3. 대상 차트를 선택하고 Download한다.

**주의 / 미확인**
- CSV를 공급자가 보유한 전체 이력이라고 가정하지 않는다.
- 문서 표현은 chart shows/loaded data이며 정확한 viewport 외부 포함 경계·CSV 열/시간대·NaN 규칙은 확인되지 않는다.
- 실제 다운로드나 계정 권한 검증은 하지 않았다.


### TV20. How does the source of real-time data affect the trading experience?

- URL: https://www.tradingview.com/support/solutions/43000739323-how-does-the-source-of-real-time-data-affect-the-trading-experience/
- source_id: `zLV_4Re4FsVy7AZYVAhVf`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 데이터 관련 websearch로 발견
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> the order panel uses data directly from your broker and not from TradingView.

**확인 사실**
- 차트 데이터 구독과 브로커 주문 패널 데이터는 별도 공급 경로일 수 있다.
- TradingView에서 데이터를 구매해도 브로커 주문 패널의 지연이 자동 해결되는 것은 아니다.
- 거래 가능 종목은 검색에서 브로커 필터로 확인할 수 있다.

**사용 단계**
1. 차트 종목·데이터 소스와 브로커의 지원 종목을 구분한다.
2. 지연이 있으면 차트와 주문 패널 중 어느 공급 경로인지 확인한다.

**주의 / 미확인**
- 이 문서는 브로커 거래 맥락이다. 모든 crypto 현물 차트가 지연된다는 뜻이 아니다.
- 유료 데이터 패키지·구독 가격·정확한 지연시간은 조사하지 않았다.


### TV21. Customizable indicator visibility

- URL: https://www.tradingview.com/blog/en/customizable-indicator-visibility-25782/
- source_id: `WtuWr8Bh5G2Jkl-WL04Ia`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: 공식 블로그 websearch로 발견 (검색 결과 발행일 2021-07-26)
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> At other intervals, the tool will be hidden

**확인 사실**
- 지표 설정 Visibility 탭에서 표시할 봉 간격 또는 간격 범위를 고른다.
- 그 외 간격에서는 지표가 숨겨진다.

**사용 단계**
1. 지표 Settings → Visibility를 연다.
2. 표시할 timeframe 또는 interval 범위를 지정한다.

**주의 / 미확인**
- 2021년 기능 발표 문서다. 현재 UI의 정확한 항목·가용 범위는 직접 확인하지 않았다.
- 표시 여부와 계산 소스·계산 간격·알림 조건은 동일 개념이 아니다.


### TV22. Moving Averages

- URL: https://www.tradingview.com/support/solutions/43000502589-moving-averages/
- source_id: `VS-k6c8x9e0tSDA54O1Z2`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV15 Moving Averages 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Determines what data from each bar will be used in calculations.

**확인 사실**
- MA는 과거 데이터에 반응하는 후행 지표라고 설명한다.
- Inputs: Length는 계산 기간, Source는 각 봉에서 쓸 데이터, Offset은 표시 전후 이동을 정한다.
- Style: MA 표시·현재값 가격선·색상·두께·선 스타일을 조절한다.

**사용 단계**
1. MA를 추가하고 지표 Settings를 연다.
2. Inputs에서 Length/Source/Offset을 고른다.
3. Style에서 선과 현재값 표시를 조정한다.

**주의 / 미확인**
- MA Inputs는 모든 지표의 공통 필드가 아니라 구체 예시다.
- 문서의 Length 설명에는 days라는 표현이 있으나 모든 chart interval을 일 단위로 해석하면 안 된다. UI와 계산 주기는 별도로 확인해야 한다.
- Offset을 미래 예측값으로 해석하지 않는다.
- 문서의 WMA 예시 산식에는 오타가 보이므로 계산 구현 검증에는 원문 예제의 숫자를 그대로 신뢰하지 않는다.


### TV23. Date and Price Range

- URL: https://www.tradingview.com/support/solutions/43000516996/
- source_id: `rLWIeNXXiiXSEplffnnGR`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV06 Date and price range 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Displays the actual calendar time elapsed

**확인 사실**
- Price range는 절대 가격차·변동률·pips/ticks를 표시한다.
- Date range는 봉 수·경과시간·선택적 거래량을 표시한다.
- Date and price range는 두 점 사이 시간과 가격 변화를 함께 표시한다.
- Stats에서 price range, percent change, bars range, date/time range, volume 등을 개별 선택한다.
- Coordinates에서 가격과 bar number로 기준점을 정밀 지정하고 Visibility로 간격별 표시를 정한다.

**사용 단계**
1. 측정 도구를 고르고 시작·끝 두 점을 지정한다.
2. Style → Stats에서 가격차·변동률·봉 수·달력 경과시간을 선택한다.
3. 필요하면 Coordinates로 기준점을 보정하고 Text로 주기를 명명한다.

**주의 / 미확인**
- Bars range와 Date/time range는 별도 통계다.
- Atlas의 bottom-to-top, bottom-to-bottom 등은 기준점 유형까지 명시해야 한다는 권고로 연결할 수 있으나 TradingView가 해당 주기 분류를 자동 제공한다고 확인한 것은 아니다.


### TV24. Understanding Renko charts

- URL: https://www.tradingview.com/support/solutions/43000502284-understanding-renko-charts/
- source_id: `qbE3WBWYg4vsXWYlmzyhE`
- observedAt: 2026-10-23T09:34:24.549Z
- 발견 경로: TV01/TV04 Renko 링크
- 증거: 공식 문서 텍스트 읽기. 브라우저 체험 없음.

> Renko brick prices are inherently synthetic

**확인 사실**
- Renko는 정해진 가격 변화에 따라 brick을 생성한다.
- ATR·Traditional·Percentage 방식과 Close/OHLC 소스를 설정할 수 있다.
- TradingView는 chart resolution의 Close/OHLC로 brick을 만들며 정확한 tick 기반 결과와 다를 수 있다.
- 현재 interval의 projection brick은 확정 전이며 새로고침 시 해당 projection 데이터가 사라진다.
- 합성 brick 가격은 특정 시점 실제 시장가격이 아니므로 그 가격으로 체결시키는 백테스트를 권장하지 않는다.

**사용 단계**
1. Chart type에서 Renko를 고른다.
2. Source와 box size 계산 방식을 정한다.
3. 확정 brick과 projection brick을 구분한다.

**주의 / 미확인**
- 가격 기반이라도 underlying chart interval은 계산 정밀도에 영향을 준다.
- Percentage 방식은 repainting 가능성이 명시되어 있다.
- 실제 체결 가격이나 시간 기반 cycle 길이 측정의 대체 자료로 무비판적으로 쓰지 않는다.
