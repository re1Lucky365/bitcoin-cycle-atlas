# TradingView 실제 동작 재비교와 개선 결과

조사·검증일: **2026-10-23**. Atlas 비교 기준은 [`0827b66c3be5028cc6945416d49cfe3764eaea16`][base]이다. 이 문서의 **기존 Atlas**는 해당 커밋을 뜻한다. 3절은 당시 차이 18개를 보존하며, 이번 반영 결과는 5절에 따로 기록한다. 검증 대상은 자산 `1.12.0-tv-parity.1` / package `1.12.0`의 작업 트리다. PR 게시·공개 배포 완료를 뜻하지 않는다.

이 문서는 [이전 TradingView UX 감사](TRADINGVIEW_UX_AUDIT.md)에 이은 재검토다. 이전 감사의 구현·검증 기록은 당시 버전의 이력으로 보존한다. 이번 사용자가 특히 지적한 **보조 지표 접기**와 가격축·커서·값 읽기 차이를 다시 확인한다.

## 1. 사용자 요구와 조사 범위

1. 실제 TradingView와 현재 Bitcoin Cycle Atlas의 차이를 깊이 조사한다.
2. 모양이 비슷한지를 넘어, 지표 접기·축 조절·값 읽기·탐색·저장의 동작 차이를 한국어 목록으로 설명한다.
3. 확인된 차이 중 현재 프로젝트에 맞는 항목을 실제로 개선한다.
4. 특히 “보조 지표 접는 것도 실제 트레이딩뷰랑 좀 다른데?”라는 추가 지적을 최우선으로 검토한다.

이번 비교 대상은 Supercharts의 차트 조작이다. 과거 사이클 참고 이미지를 새로 재첨부받아 재현하는 작업으로 취급하지 않으며, 원본 이미지나 TradingView 전체와 완전히 같아졌다는 주장을 하지 않는다. 시장 예측·가격 가정의 성능 개선도 이번 비교의 목표가 아니다.

## 2. 근거의 종류와 실제 확인 범위

| 근거 | 이번 문서에서 뜻하는 것 | 확인의 한계 |
|---|---|---|
| 공식 Help Center | TradingView가 공개한 Supercharts·모바일 사용법을 2026-10-23에 새로 조회한 내용 | 문서만 읽은 기능을 실제 조작한 것으로 기록하지 않는다. 문서의 오래된 아이콘 설명은 현재 화면과 다를 수 있다. |
| 공식 SDK 문서 | Advanced Charts·Trading Platform의 공개 문서 | SDK의 설정과 제품 구분을 유지한다. 모든 웹 Supercharts 계정에서 같은 기본값·동작이라는 증거로 확대하지 않는다. |
| 실제 데스크톱 관찰 | 이번 작업에서 TradingView 공개 화면을 열어 조작하고 캡처를 확인한 결과 | 아래에 구체적으로 적은 관찰만 뜻한다. 계정별 설정·모든 차트 유형·모바일 동작까지 검증한 것이 아니다. |
| 기준 커밋 소스 | `0827b66`의 상태·렌더링·이벤트·내보내기 구현을 읽은 결과 | 브라우저의 실제 픽셀 배치나 물리 기기 터치 지연을 대신하지 않는다. |

### 실제 TradingView에서 확인한 지표 접기

검토한 화면은 **Bitstamp BTCUSD · 4h**, 가격 차트에 거래량 지표 하나가 추가된 데스크톱 화면이다.

| 상태·조작 | 실제 관찰 | 캡처 |
|---|---|---|
| 펼친 상태 | Vol 제목·값 행과 위쪽 화살표를 표시한다. 제목줄에 접근하면 눈·설정·삭제 등의 조작을 사용할 수 있다. | [03 — 지표 legend 펼침](screenshots/tradingview-20261023/03-tradingview-legend-expanded.png) |
| 접기 | 지표가 **한 개여도 접을 수 있다**. Vol 제목·값 행 전체가 사라지고 작은 아래쪽 화살표만 남는다. 거래량 막대는 그대로 표시된다. | [04 — 지표 legend 접힘](screenshots/tradingview-20261023/04-tradingview-legend-collapsed.png) |
| 복구 버튼 | 관찰한 버튼 크기는 약 **29 × 21 CSS px**다. 접힌 뒤에도 다시 펼치는 진입점이 남는다. | 위 두 캡처와 해당 화면 측정 |

접힌 버튼의 DOM 텍스트에서 `1`이 관찰되었지만, 캡처에서는 화살표만 보인다. 따라서 이 문서는 **“접힌 버튼에 지표 개수 1이 화면에 표시된다”라고 주장하지 않는다.** 이 크기도 관찰한 화면의 값이며 모든 기기에 그대로 적용해야 하는 디자인 규격은 아니다.

공식 도움말은 종목 아래 화살표로 legend를 여는 동작을 설명한다. 다른 도움말은 같은 계열의 표시 제어를 `+/-`로 부르므로, 현재 아이콘의 외형은 실제 캡처를 우선한다. 두 문서 모두 접었을 때 대표 지표 한 행을 계속 남기는 규칙을 설명하지 않는다. [화살표 도움말][legend-arrow] · [제목 표시 도움말][legend-titles]

**실제 모바일 TradingView를 이번 조사에서 조작한 기록은 없다.** 모바일 long-press tracking과 기본 값 표시 방식은 공식 문서 근거이며, 이번 Atlas 반응형 화면 검증과 구분한다. [모바일 Help][mobile-tracking]

## 3. 기준 커밋의 기능 차이 18개

**차이**에는 미구현뿐 아니라 일부 지원, 동작 의미의 차이, 의도적인 제품 범위 차이도 포함된다. 모든 항목을 누락 버그로 간주하지 않는다. 우선순위는 P0가 값의 의미·기본 조작, P1이 반복 사용에서 체감되는 차이, P2가 선택적 확장이다.

| 번호 | 비교 항목 | TradingView 기준과 근거 | 기존 Atlas — `0827b66` | 판단 |
|---|---|---|---|---|
| 1 | 지표 legend 접기·펼치기 | 실제 관찰에서 Vol 한 개도 접으며, 제목·값 행을 모두 없애고 복구 화살표를 남긴다. 막대는 유지한다. [Help][legend-arrow] · 위 캡처 | [indicator-workbench.js][base-indicators]는 접으면 대표 한 행을 남긴다. 지표가 하나면 접기 버튼을 숨긴다. 별도 `collapsed`는 manager 전체를 숨긴다. | **P0 · 의미 차이.** 전체 행 접기와 복구 버튼을 하나의 일관된 상태로 만든다. |
| 2 | 지표 제목줄의 눈·설정·삭제 | 제목줄에 포인터를 올리면 관련 조작이 나타난다. [Help][legend-actions] | 눈·삭제는 있다. 분석 지표 이름은 해당 창으로 이동한다. 모든 지표에 공통 설정 버튼이 있는 구조는 아니다. [소스][base-indicators] | **P1 · 일부 지원.** 이미 있는 조작을 보존하고, 설정 가능한 항목에 실제 설정을 연결한다. |
| 3 | 지표 값·축 라벨 독립 표시 | 개별 Style에서 status line 값과 가격축 라벨을 따로 끄며, 전역 꺼짐 설정이 우선한다. [Help][indicator-values] | 추가됨·숨김·대표 지표·목록 전체 숨김 상태가 있다. 개별 지표의 값만 숨김·축 라벨만 숨김 상태는 없다. [소스][base-indicator-state] | **P2 · 미지원.** 지표 자체 숨김과 값만 숨김을 구분할 확장 후보다. |
| 4 | 보조 pane 축소·복원·최대화 | 우측 pane 버튼이나 Ctrl/⌘+더블클릭으로 축소·복원한다. SDK는 pane 더블클릭 최대화도 설명한다. [Help][pane-collapse] · [SDK][shortcuts-sdk] | 연구 창의 `−`는 지표 visibility를 꺼서 창을 숨긴다. 제목만 남기는 독립적인 축소 상태는 없다. 가격 아래 보조 영역도 별도 SVG 구획이다. [소스][base-analysis] | **P1 · 의미 차이.** legend 접기·pane 축소·지표 숨김·삭제를 구분한다. |
| 5 | 가격축·시간축 직접 드래그 | 공식 SDK 모바일 문서는 두 축을 직접 드래그해 조정하는 동작을 설명한다. [SDK][mobile-sdk] | 탐색 시작 영역이 plot 내부로 제한되어 축의 직접 drag 경로가 없다. [소스][base-navigation] | **P0 · 미지원.** 이번 가격축 조작 목표와 시간축의 남은 차이를 구분한다. 웹의 세부 감도는 SDK만으로 확정하지 않는다. |
| 6 | Auto 가격축과 축 reset | Auto 버튼으로 자료를 화면에 맞추며, 가격축 reset은 Auto를 켠다. [Auto Help][auto] · [설정][settings] | min/max로 매번 자동 범위를 만든다. 하단 `자동`은 span이며 수동 Y 범위 상태가 없다. [눈금 계산][base-math] · [도구 UI][base-chrome] | **P0 · 일부 지원.** 수동 범위·Auto 복귀·시간 범위 reset을 분리한다. |
| 7 | 로그·선형·퍼센트·100 기준 축 | 네 축 모드를 구분한다. Indexed to 100은 표시 시작값을 기준으로 삼는다. [설정][settings] | 로그·선형과 Alt+L은 있다. Atlas의 100 단위는 **최근 관측값=100**이며 TV의 표시 시작값 기준과 다르다. Percent 축은 없다. [가격 차트][base-price] · [분봉 차트][base-intraday] | **P2 · 일부 지원·정의 차이.** 기존 100 단위의 의미를 조용히 바꾸지 않는다. |
| 8 | 가격축 반전 | 반전하면 가격 상승 방향이 위에서 아래가 된다. Alt+I도 제공한다. [동작][invert] · [단축키][invert-key] | UI의 반전 상태가 없다. `createPriceScale().invert(pixel)`은 픽셀을 가격으로 돌리는 역함수이며 축 반전 기능이 아니다. [소스][base-math] | **P2 · 미지원.** 반전 상태를 추가할 때 기존 역함수와 구분해야 한다. |
| 9 | 가격만 기준으로 자동 맞춤 | 먼 지표 수준 때문에 압축될 때 `Scale price chart only`를 사용할 수 있다. [Help][price-only] | 가격·가정 범위·캔들 고저·표시 기준점 등을 자동 범위에 포함하며 사용자 선택은 없다. [소스][base-price] | **P1 · 미지원.** 가정 범위를 비교하는 앱 목적을 고려해 포함 대상을 명시해야 한다. |
| 10 | OHLC 옆 선택 봉 변화율 | Bar Change와 quote 기반 Last day change는 다른 값이다. 정확한 수식과 문서의 내부 모순은 4절에 기록한다. [Legend SDK][legend-sdk] · [공식 발표][bar-change] | 캔들은 시가 대비, 선은 직전 가격 대비로 계산해 같은 header 자리의 의미가 바뀐다. tooltip에서만 기준을 구분한다. [가격 차트][base-price] · [읽기 UI][base-lab] | **P0 · 의미 차이.** 직전 동일 간격 봉 종가 대비를 일관되게 사용하고 시가 대비는 별도 값으로 구분한다. |
| 11 | 모바일 길게 누르기 추적 | 기본 Last·Daily Change에서 long tap으로 OHLC·지표 추적에 진입하고 single tap으로 해제한다. [Help][mobile-tracking] | 한 손가락 이동·두 손가락 zoom·tap 선택은 있다. touch pointer preview를 제외하며 long-press tracking 상태가 없다. [탐색][base-navigation] · [가격 차트][base-price] | **P1 · 일부 지원.** 공식 동작은 확인했으나 이번 실제 모바일 TV 검증은 하지 않았다. |
| 12 | 누르고 유지하는 floating tooltip | status line이 접히거나 숨겨져 있어도 symbol·indicator 값을 읽을 수 있다. [Help][floating-tooltip] | 상단 값·선택 상세·사건 preview는 있다. 누르고 유지하는 독립 지표 값 tooltip은 없다. [읽기 UI][base-lab] | **P2 · 미지원.** 전체 legend를 접은 상태의 값 읽기 확장 후보다. |
| 13 | 탐색 버튼·휠·키보드·reset | Supercharts는 확대·축소·좌우·reset 버튼을 제공한다. SDK에는 Shift+휠, Ctrl/⌘+방향키, Alt+R 등이 있다. [설정][settings] · [SDK][shortcuts-sdk] | 휠·이동·핀치·탐색 버튼·키보드·우클릭 메뉴가 이미 있다. plot 더블클릭은 reset이다. [소스][base-navigation] | **P1 · 대부분 지원·일부 동작 차이.** 기존 기능을 미구현으로 다시 나열하지 않는다. 주석 위 키·휠 처리와 축/pane 우선순위를 검토한다. |
| 14 | 날짜 이동·사용자 날짜 범위 | 하단에서 특정 날짜 또는 사용자 지정 기간으로 이동한다. [Help][go-date] | 일·주 날짜 이동과 Alt+G가 있다. intraday에서는 숨긴다. 두 날짜를 입력하는 전용 기간 UI는 없다. [소스][base-chrome] | **P1 · 일부 지원.** intraday datetime 이동과 직접 기간 지정이 남은 차이다. |
| 15 | 간격 즐겨찾기·직접 입력 | 상단 즐겨찾기와 숫자·단위 입력으로 간격을 바꾼다. [Help][interval] | 8개 지원 간격 버튼·모바일 select·키보드 이동이 있다. 개인별 간격 즐겨찾기나 숫자 직접 입력은 없다. [소스][base-chrome] | **P2 · 일부 지원.** 실제 자료가 지원하는 간격 안에서 빠른 입력을 제공할 수 있다. |
| 16 | 차트 이미지 snapshot | 이미지 저장·이미지 clipboard 복사·이미지 링크 복사를 제공한다. [Help][snapshot] | 통합 차트 SVG 다운로드가 있다. 해당 경로의 raster 이미지 저장·이미지 clipboard·호스팅 이미지 링크는 없다. [내보내기][base-export] · [연결][base-lab] | **P1 · 일부 지원.** 이번 목표는 PNG 저장이다. clipboard·이미지 호스팅까지 완료 범위로 확대하지 않는다. |
| 17 | CSV 내보내기 | 로드된 symbol·indicator 자료를 CSV로 내보낸다. [Help][csv] | 현재 창의 원본 관측/OHLCV만 CSV로 저장하며 미래 가정은 제외한다. [소스][base-export] | **P2 · 지원 범위 차이.** 관측 전용 정책은 의도적이다. 지표·가정 열의 추가 여부는 별도 결정한다. |
| 18 | Status line 구성 | title·chart values 등 종목 주변 정보의 표시를 설정한다. [설정][settings] | 가격/OHLC·출처·범례의 표시 설정, 실제 커서 가격과 OHLC 구분이 있다. 세부 필드별 구성은 제한적이다. [지표 UI][base-indicators] · [읽기 UI][base-lab] | **P2 · 일부 지원.** 메인 가격 정보와 보조 지표 legend의 접기를 구분한다. |

## 4. OHLC 변화율의 기준과 공식 문서의 모순

### 선택 봉 변화와 시가 대비 변화

공식 SDK 문서는 `showBarChange`라는 표시 옵션을 설명하지만, 설정 문서만으로 수식 전체를 확정하기는 어렵다. 수식 확인을 위해 **2018-10-23 TradingView 공식 제품 발표**를 보충 근거로 사용했다. 커뮤니티 아이디어나 사용자 스크립트를 TradingView 제품 정의로 인용하지 않았다. [Bar Change Values 공식 발표][bar-change]

그 글의 수식은 다음과 같다. `C_t`는 선택 봉 종가, `C_(t-1)`은 직전 봉 종가다.

```text
봉 변화량 = C_t − C_(t−1)
봉 변화율 = (C_t − C_(t−1)) / C_(t−1) × 100
```

그러나 같은 글의 첫 설명 문장은 현재 봉의 open/close 차이라고 적혀 있어 뒤의 수식과 충돌한다. 이 내부 모순을 숨기거나 문서 전체가 일관되다고 인용하지 않는다. 공식 Help의 screener 설명은 `Change`를 직전 선택 간격 봉 종가 대비, `Change from Open`을 현재 봉 시가 대비로 구분한다. 이는 용어·수식의 교차 근거이며, screener와 chart header가 같은 UI라는 뜻은 아니다. [공식 Help의 Change 정의][change-formula]

실제 관찰한 4h header에서는 `O 81,461`, `C 81,748`, 변화량 `+288`이 표시되었다. 같은 봉의 시가 대비 차이는 287이므로 시가 대비 계산과 일치하지 않는다. 조사 중 이후 갱신된 화면에서도 `C 81,709`, `+249`가 관찰돼 같은 구분을 뒷받침했다. 공개 캡처는 차트 부분만 남겨 재촬영했으므로 이 초기 관찰 숫자와 촬영 시점이 다를 수 있다. 이 숫자들은 **관찰 당시 UI의 예시**이며 현재 시세가 아니다. 관찰값만으로 실제 직전 봉 종가를 독립 검증한 것으로 간주하지 않고, 공식 수식과 함께 판단한다.

기준 커밋의 Atlas는 `atlas-price-chart.js`에서 캔들일 때 `(close/open−1)×100`, 가격선일 때 직전 가격 대비를 같은 header 위치에 전달했다. 이번 변경은 동일 출처·동일 간격의 직전 봉 종가 기준으로 통일하고 `전봉`이라고 표시한다. 직전 봉을 확인할 수 없거나 관측과 가정의 출처 경계를 넘으면 0이나 시가를 대입하지 않는다. 주봉 선도 직전 주봉 종가를 사용한다. 봉 자체의 상승/하락 색과 시가 대비 변화율은 별도로 유지한다. [기준 가격 차트][base-price] · [현재 계산](../dist/chart-math.js) · [봉·출처 경계 회귀 검사](../tests/chart-tradingview-parity.test.mjs)

### 일간 quote 변화는 별도 값

공식 Legend SDK 문서의 `Last day change`는 Trading Platform의 quote data `ch`·`chp`로 전달되며, `showLastDayChange`는 `showBarChange`와 다른 옵션이다. `DatafeedQuoteValues.ch`는 보통 현재 가격과 직전일 정규 세션 종가의 차이로 설명한다. 따라서 4h 선택 봉 변화율에 일간 quote 값을 대신 넣지 않는다. [Legend SDK][legend-sdk] · [Quote API][quote-values]

모바일 기본 Last·Daily Change와 long-press 이후 선택 봉 OHLC 추적도 구분한다. 완료 봉 중심의 Atlas가 실시간 quote를 제공하는 것처럼 보이게 만드는 변경은 이번 목표가 아니다. [모바일 Help][mobile-tracking]

## 5. 이번 반영 결과

아래 동작을 구현하고 자동 검사와 실제 Atlas 브라우저 조작을 구분해 확인했다. **검증 결과는 passed**이며, 측정 조건·전체 검사 집계·캡처는 [이번 QA 보고서](../design-qa.md)에 기록했다. TradingView와 Atlas의 실제 데스크톱 캡처를 함께 비교했으며, 전체 제품이나 모바일 TradingView와의 완전한 동일성을 뜻하지 않는다.

| 반영 항목 | 현재 동작 | 확인 근거 |
|---|---|---|
| 하나의 상태로 전체 지표 legend 접기 | 모든 지표 제목·값 행을 접고 복구 화살표를 남긴다. 한 개의 지표도 접으며, 가격·거래량 도형은 유지한다. URL·템플릿·작업 화면에서 같은 접힘 상태를 사용한다. | 실제 데스크톱에서 8행→0행, 버튼 29×21px, 원 30개·기간 44개 유지. Vol만 있는 상태도 0행과 45개 막대 유지. 새로고침과 저장·공유 링크의 `indicator-list=closed` 확인. [상태 검사](../tests/indicator-state.test.mjs) · [UI 검사](../tests/indicator-workbench.test.mjs) |
| 모바일 첫 표시와 명시적 선택 보존 | 명시적 상태가 없는 620px 이하 화면은 접힌 상태로 시작한다. 사용자가 펼치거나 URL·템플릿이 지정한 상태는 보존한다. | 390×844·320×740에서 기본 복구 버튼 32×28px, 가로 넘침 없음. Enter로 전환 가능. 펼친 8행과 기간 라벨의 실제 DOM 겹침도 0건. 이는 Atlas 설계·검증이며 모바일 TV 관찰 결과는 아니다. |
| 독립적인 보조 pane 축소 | 보조 분석 본문을 줄이고 제목·복구 버튼을 남긴다. 눈으로 숨김·삭제·legend 접기와 다른 상태이며, 숨긴 뒤 다시 표시해도 축소 상태를 보존한다. | 실제 UI에서 4년 비교 추가→34px 제목줄→330px 복원. 축소 후 눈으로 숨기면 0px, 다시 표시하면 34px. [pane 회귀 검사](../tests/analysis-focus.test.mjs) · [템플릿 검사](../tests/indicator-preferences.test.mjs) |
| 모두 숨김에서 메인 가격 정보 보존 | 일괄 숨김은 가격·분석 지표에 적용하며, 가격/OHLC·출처·범례 같은 화면 표시 항목은 독립 설정을 유지한다. | [지표 상태 검사](../tests/indicator-state.test.mjs)와 [실제 모듈 UI 검사](../tests/indicator-workbench.test.mjs)에서 membership·visibility·HUD 보존 확인. |
| 수동 가격축과 Auto | 오른쪽 가격축의 위아래 드래그로 범위를 조절한다. 축 더블클릭 또는 Auto로 자동 맞춤에 복귀하며, 수동 범위는 원본 USD 좌표로 URL·작업 화면에 저장한다. | 실제 드래그 후 manual, 축 더블클릭 후 같은 시간 범위에서 Auto 복귀. 저장·공유 UI에 `price-min/max` 보존. 로그·선형·Indexed의 좌표, 잘림, 잘못된 URL과 초기화는 [가격축](../tests/price-axis.test.mjs) · [탐색](../tests/chart-navigation.test.mjs) · [저장 검사](../tests/workspace-price-axis.test.mjs)로 확인. |
| 좁은 가격 구간의 로그 여백 | 로그 범위에 비례한 여백과 읽을 수 있는 tick을 사용한다. 수동 범위 밖 가격을 화면 끝에 옮겨 표시하지 않고 자른다. | 좁은 99,000–101,000 구간, 단일 가격, 로그·선형, 숫자 underflow·구분 불가능한 범위를 [가격축 검사](../tests/price-axis.test.mjs)로 확인. 원본 가격은 바꾸지 않는다. |
| 주봉 가격선과 커서의 일치 | 커서·키보드가 실제로 그린 주봉 선의 꼭짓점을 선택한다. 정확한 일별 사이클 기준점은 경로에 유지하고 원래 날짜·가격을 사용한다. | 주봉 표시점·커서 원·방향키 선택·일별 기준점 및 원자료 불변을 [렌더러 회귀 검사](../tests/chart-tradingview-parity.test.mjs)로 확인. |
| 주석의 키보드·휠 상호작용 | 사건·기준점·기간선 위에서 휠 탐색과 Enter/Space 선택을 구분한다. 지표 목록의 내부 스크롤은 차트 탐색과 분리한다. | 주석 키가 일반 가격 선택을 중복 실행하지 않는지 [렌더러 검사](../tests/chart-tradingview-parity.test.mjs), 주석 위 휠과 가격축 제스처 경계를 [탐색 검사](../tests/chart-navigation.test.mjs)로 확인. |
| 직전 봉 종가 기준 OHLC 변화율 | 선·캔들 모두 동일 출처·동일 간격의 직전 봉 종가 기준 `전봉` 변화를 표시한다. 시가 대비 값과 봉 색은 별도로 유지한다. | 첫 봉, 화면 밖 직전 봉, 1D·1W·intraday, 관측→가정 경계와 선/캔들 전환을 [회귀 검사](../tests/chart-tradingview-parity.test.mjs)로 확인. |
| PNG 내보내기 | 주 가격 차트에 현재 단위·가격축·시나리오·UTC·출처 설명을 붙여 PNG로 저장한다. SVG 저장도 명령 메뉴에 유지한다. | 실제 저장 버튼으로 2562×1970px, 851,073 bytes PNG 생성·직접 열어 글자·기간선·범례 확인. 비동기 캡처 일관성과 오류·자원 정리는 [내보내기 검사](../tests/chart-data-export.test.mjs) 및 코드 리뷰로 확인. Intraday Indexed 내보내기 기준 날짜 수정은 코드 리뷰로 확인했다. 실제 1h Indexed 화면에서는 100.0과 Coinbase 완료 봉·OHLC·전봉 표시를 확인했으며, 해당 조합의 SVG 파일 다운로드까지 통과한 것으로 기록하지 않는다. |

기존 지표 즐겨찾기·템플릿, 이름 있는 작업 화면, URL 범위 복원, SVG·관측 CSV는 보존했다. 새 상태를 저장 구조에 연결했으며, 관련 부분집합 재검사를 전체 검사 수에 중복 합산하지 않았다.

## 6. 이번 반영 이후에도 남는 차이

다음 항목은 이번 완료 범위에 포함하지 않는다.

- **시간축 직접 드래그와 세부 축 메뉴:** 이번 수동 가격축과 별개다. 가격축 반전·Percent·표시 시작값=100·가격만 자동 맞춤도 각각 독립 기능이다.
- **지표별 값·축 라벨·파라미터 표시:** 전체 legend 접기와 개별 표시 옵션은 다르다. 설정 버튼의 공통 외형만 추가해서 실제 설정 기능이 있는 것처럼 보이면 안 된다.
- **pane 최대화·재정렬·경계 크기 조절:** 본문 축소를 구현해도 TradingView의 pane 관리 전체가 완성되는 것은 아니다.
- **모바일 long-press tracking과 hold tooltip:** 공식 사용법을 조사했으며 아직 구현하지 않았다. 실제 모바일 TradingView 비교와 물리 기기의 pan·pinch·long-press 충돌 검증도 별도 작업이다.
- **intraday 날짜·시각 이동과 직접 기간 입력:** 일·주 날짜 이동의 존재만으로 모든 간격의 Go to date가 같다고 할 수 없다.
- **임의 간격 입력과 간격 즐겨찾기:** Atlas는 지원하는 8개 간격을 유지한다. 자료가 없는 간격을 UI만으로 제공하지 않는다.
- **이미지 clipboard·이미지 링크 호스팅:** PNG 다운로드와 별개다. 계정 동기화·영구 이미지 URL도 이번 목표가 아니다.
- **지표·가정까지 포함한 CSV:** 관측 전용 CSV의 설계 범위를 유지한다. 추가한다면 종류·출처·단위를 명시하는 별도 스키마가 필요하다.
- **실시간 quote·미완성 봉·브로커·서버 알림·Pine·리플레이:** Atlas의 완료 관측과 조건부 연구 경로 제품 범위 밖이다. 예측 성능을 강화하거나 TradingView의 계정·유료 기능을 무리하게 복제하는 작업으로 확장하지 않는다.

## 7. 제품·플랜·데이터 조건

Advanced Charts와 Trading Platform은 Supercharts 웹 제품의 모든 계정·기본 설정과 동일하지 않다. 특히 SDK의 quote 기반 Last day change는 Trading Platform 기능으로 명시되어 있다. SDK 자료로 확인한 제스처는 그 출처를 표에 표시했다. [Legend SDK][legend-sdk] · [단축키 SDK][shortcuts-sdk]

TradingView의 과거 intraday 봉 수는 플랜에 따라 다르며, daily 기반 간격은 더 긴 가용 이력을 제공한다. 따라서 양쪽 차트가 다른 날짜 범위를 보여 준다는 사실만으로 Atlas의 탐색 버그라고 판단하지 않는다. 비교 시 거래소·심볼·간격·조회 범위가 같아야 한다. 플랜별 한도 숫자를 Atlas의 구현 목표로 복사하지 않는다. [과거 자료 Help][history-limits]

공식 Help는 많은 주식·선물 거래소의 실시간 자료에 별도 요금이 있고, 일반 유료 플랜이 이를 모두 포함하지는 않는다고 설명한다. 같은 문서는 제공 중인 암호화폐 거래소 자료가 실시간이라고 밝힌다. 이는 완료 봉을 조회하는 Atlas가 같은 갱신 속도나 체결 자료를 제공한다는 뜻이 아니다. [실시간 자료 Help][market-data]

이번 조사에서는 snapshot·CSV 등 모든 기능의 모든 플랜별 제공 여부를 확정하지 않았다. 실제 계정의 제한을 확인하지 않은 항목은 “모든 무료 계정에서 사용 가능”이라고 표시하지 않는다. 브로커 연결·주문·결제 기능은 시험하지 않았다.

## 8. 통합 검증과 공개 상태

이번 변경은 **55개 테스트 파일 모두 exit 0**, node:test **464/464**와 기존 custom 검사 **44/44**, 합계 **508개 통과**를 확인했다. 정적 참조 검사, standalone 빌드·정적 검사, 사이클 자료 검사, Node 성능 경계 검사도 통과했다. 공식 릴리스에 고정한 TLC 1.7.4로 요청 소유권 모델을 새로 실행해 정상 모델·음성 대조군·실제 코드 변이 검사까지 확인했다. 수치와 검증 한계는 [QA 보고서](../design-qa.md)에 모았다.

독립 코드 리뷰에서 발견한 극단적인 수동 가격 범위 URL의 tick 정지·NaN 문제와 Intraday Indexed 내보내기 기준 날짜 문제를 수정했다. 수정 후 수동 범위가 안전하게 Auto로 복귀함을 재현 검사했고, PNG는 비동기 대기 전에 화면과 메타데이터를 함께 캡처한다. 실제 PNG 다운로드를 이번에 새로 확인했으며 이전 작업의 검사·배포 결과로 대체하지 않았다.

**이 문서 작성 시 PR 게시와 배포는 대기 중이다.** 검증 통과는 현재 변경의 결과이며 공개 사이트 반영 완료 선언이 아니다. 이전 가격 그래프 내부 기간선 작업의 QA는 [고정 기준 커밋의 기록][previous-qa]으로 보존한다.

관련 이력: [이전 UX 감사](TRADINGVIEW_UX_AUDIT.md) · [모바일 작업 화면 이력](MOBILE_WORKSPACE_IMPROVEMENTS.md) · [차트 사용 안내](GRAPH_WORKSPACE_GUIDE.md) · [사이클 기준점·기간선 정의](CYCLE_MILESTONES.md) · [디자인 QA 기록](../design-qa.md)

## 출처

본문의 공식 링크는 2026-10-23에 새로 조회했다. SDK와 공식 제품 발표는 Help Center와 별도로 구분해 사용했다. 기존 기능 비교용 소스는 기준 커밋에 고정하고, 이번 구현·검증 근거는 현재 저장소의 상대 링크로 구분했다.

[base]: https://github.com/twoimo/bitcoin-cycle-atlas/tree/0827b66c3be5028cc6945416d49cfe3764eaea16
[previous-qa]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/design-qa.md
[base-indicators]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/indicator-workbench.js
[base-indicator-state]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/indicator-state.js
[base-analysis]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/analysis-dock.js
[base-navigation]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/chart-navigation.js
[base-math]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/chart-math.js
[base-chrome]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/workbench-chrome.js
[base-price]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/atlas-price-chart.js
[base-intraday]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/intraday-chart.js
[base-lab]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/lab-view.js
[base-export]: https://github.com/twoimo/bitcoin-cycle-atlas/blob/0827b66c3be5028cc6945416d49cfe3764eaea16/dist/chart-export.js
[legend-arrow]: https://www.tradingview.com/support/solutions/43000506677-how-do-i-remove-or-customize-an-indicator/
[legend-titles]: https://www.tradingview.com/support/solutions/43000473925-indicator-titles-parameters-values-disappeared-from-the-legend-top-left-corner-of-the-chart/
[legend-actions]: https://www.tradingview.com/support/solutions/43000539711-how-to-show-hide-settings-and-remove-options-of-an-indicator-or-ticker-symbol/
[indicator-values]: https://www.tradingview.com/support/solutions/43000659666-i-want-to-hide-the-values-of-individual-indicators/
[pane-collapse]: https://www.tradingview.com/support/solutions/43000665813-how-to-collapse-separate-panes/
[mobile-sdk]: https://www.tradingview.com/charting-library-docs/latest/mobile_specifics/
[auto]: https://www.tradingview.com/support/solutions/43000762826-how-to-enable-autoscale/
[settings]: https://www.tradingview.com/support/solutions/43000748166-how-to-configure-your-supercharts/
[invert]: https://www.tradingview.com/support/solutions/43000475599-how-to-invert-reverse-the-chart-price-scale/
[invert-key]: https://www.tradingview.com/support/solutions/43000542381-how-to-invert-the-price-scale/
[price-only]: https://www.tradingview.com/support/solutions/43000762934-my-chart-looks-compressed/
[legend-sdk]: https://www.tradingview.com/charting-library-docs/latest/ui_elements/Legend/
[bar-change]: https://www.tradingview.com/blog/en/bar-change-values-added-9502/
[change-formula]: https://kr.tradingview.com/support/solutions/43000635852/
[quote-values]: https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Charting_Library.DatafeedQuoteValues/
[mobile-tracking]: https://www.tradingview.com/support/solutions/43000502564-i-can-t-see-ohlc-indicator-values-and-the-crosshair-cursor/
[floating-tooltip]: https://www.tradingview.com/support/solutions/43000759580-how-to-enable-disable-floating-data-tooltip/
[shortcuts-sdk]: https://tradingview.com/charting-library-docs/latest/configuration/Shortcuts/
[go-date]: https://www.tradingview.com/support/solutions/43000482911-how-to-go-to-the-specific-date-on-the-chart/
[interval]: https://www.tradingview.com/support/solutions/43000762824-how-to-change-the-time-frame-quickly/
[snapshot]: https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot/
[csv]: https://www.tradingview.com/support/solutions/43000537255-how-to-export-chart-data/
[history-limits]: https://www.tradingview.com/support/solutions/43000480679-historical-intraday-data-bars-and-limits-explained/
[market-data]: https://www.tradingview.com/support/solutions/43000471705-how-to-purchase-additional-market-data/
