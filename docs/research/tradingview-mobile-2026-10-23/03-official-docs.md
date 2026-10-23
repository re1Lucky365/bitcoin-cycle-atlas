# 공식 모바일 문서 8개와 적용 경계

관찰일: **2026-10-23 KST**. 공개 공식 본문을 읽었으며 짧은 원문만 인용한다. 문서 지원, 실제 모바일 웹 실행, 네이티브 앱 지원을 혼합하지 않는다.

## S01 · 모바일 OHLC·지표 값과 십자선

- 원문: <https://www.tradingview.com/support/solutions/43000502564-i-can-t-see-ohlc-indicator-values-and-the-crosshair-cursor/>
- 범위: **TradingView 제품 도움말**

> On mobile devices only Last and Daily Change values are displayed on the chart by default.

기본 최근 가격/일간 변화, 봉 길게 누르기로 OHLC·지표 값, 차트 단일 탭으로 추적 종료. MT04→MT06→MT08에서 실제 확인했다.

**한계:** 화면에 보이는 수익률을 항상 선택 봉 종가 대비 수익률로 해석하지 않는다.

## S02 · Tap and Hold to Track Values on Mobile Devices!

- 원문: <https://www.tradingview.com/blog/en/new-track-value-mode-in-mobile-version-12113/>
- 범위: **2019-04-25 제품 변경 이력**

> If you want to exit the value tracking mode make a single tap on the chart.

탐색과 값 추적의 모드를 분리한다. 그림 객체는 먼저 선택한 뒤 길게 눌러 문맥 메뉴를 여는 설명도 있다.

**한계:** 오래된 변경 이력이므로 현재 도움말·직접 동작과 함께 읽었다. 그림 객체의 모바일 선택·편집은 이번에 실행하지 않았다.

## S03 · Mobile app development

- 원문: <https://www.tradingview.com/charting-library-docs/latest/mobile_specifics.md>
- 범위: **Advanced Charts / Trading Platform 개발자 라이브러리, 소비자 앱 설명 아님**

> The library supports mouse and touch-based inputs and recognizes single and multi-touch gestures.

반응형 UI, 제한될 수 있는 우측 위젯·marks·Account Manager, 추적 모드, 축 드래그·길게 누르기, pinch_scale, WebView 통합을 설명한다. 퍼센트 변화가 intraday quotes 기준이라는 주의도 있다.

**한계:** 라이브러리 featureset·지원 버전·WebView 안내를 tradingview.com 또는 Android 앱 전체의 실제 지원 보장으로 옮기지 않는다. Chrome 모바일 에뮬레이션 축 잘림 FAQ는 Atlas 결함의 원인 증거가 아니다.

## S04 · TradingView mobile apps

- 원문: <https://www.tradingview.com/mobile/>
- 범위: **공식 소비자 모바일 앱 안내**

> TradingView mobile apps

공식 앱 배포 표면을 확인했다. 이번 Android 에뮬레이터에는 TradingView 패키지가 없었다.

**한계:** 앱 설치·로그인·네이티브 앱 UI 테스트는 하지 않았다. 웹 결과를 앱 결과로 부르지 않는다.

## S05 · Alignment of drawings at 45 degrees on mobile devices

- 원문: <https://www.tradingview.com/blog/en/drawings-alignment-45-degrees-on-mobile-46019/>
- 범위: **2024-08-08 모바일 웹·앱 제품 변경**

> This mode is an alternative to drawing with the Shift key held down in the computer version.

도형 floating properties panel의 각도 버튼을 켜고 점을 움직이면 45도 단위로 정렬한다. 종료도 같은 버튼으로 명시한다.

**한계:** 문서 확인만 했다. Atlas는 자유 그리기 전체를 제공하는 앱이 아니므로 이 도구 자체를 필수 미구현으로 넣지 않았다.

## S06 · Android 앱에서 지표 숨김·표시

- 원문: <https://www.tradingview.com/support/solutions/43000506679-how-do-i-hide-display-an-indicator-in-the-android-app/>
- 범위: **TradingView Android 소비자 앱 도움말**

> Click on the eye icon in the indicator legend:

눈 아이콘, 또는 하단 Analysis Hub→Object Tree→개별 visibility 경로를 설명한다. Atlas에서는 눈 아이콘으로 숨김·복원을 직접 확인했다.

**한계:** TradingView Android 앱의 해당 경로는 미실행. 모바일 웹 좌측 Object Tree와 앱 하단 Analysis Hub를 같은 UI라고 쓰지 않는다.

## S07 · Favorites: Indicators, Financials, Drawing Tools, Timeframes

- 원문: <https://www.tradingview.com/support/solutions/43000662392-how-to-favorite-indicators-financials-drawing-tools-and-timeframes/>
- 범위: **공통 제품 도움말**

> click on the star symbol located next to the name or icon of this tool.

도구·간격·차트 유형 즐겨찾기를 설명한다. MT15 간격 메뉴의 별, MA13 Atlas의 즐겨찾기 탭은 열람했다.

**한계:** 즐겨찾기를 추가·삭제하지 않았다. 기기별 동기화·템플릿 적용 성공도 확인하지 않았다.

## S08 · One-tap trading mode in iOS and Android mobile apps

- 원문: <https://www.tradingview.com/support/solutions/43000776264-one-tap-trading-mode-in-ios-and-android-mobile-apps/>
- 범위: **소비자 모바일 앱의 거래 안전 경계**

> Taps on Buy/Sell buttons will send an order immediately.

활성화 시 주문·변경·취소·포지션 종료가 확인 창 없이 즉시 실행될 수 있다. 읽기 조사와 거래 실행을 분리해야 한다.

**한계:** Trade·Buy·Sell·주문·브로커·Paper Trading·설정 활성화를 실행하지 않았다. Atlas 개선 대상으로 거래 기능을 추가하라는 권고가 아니다.

## 중요한 구분

1. 소비자 앱은 공식적으로 존재한다(S04). S03의 “Native wrappers ... are not provided”는 개발자 라이브러리의 wrapper 제공 여부이며 소비자 TradingView 앱이 없다는 말이 아니다.
2. Android 앱 하단 Analysis Hub(S06), 모바일 웹 좌측 도구 막대(MT04), 라이브러리 widget bar(S03)는 서로 다른 표면이다.
3. S03의 모바일 에뮬레이션 축 잘림 FAQ만으로 Atlas의 오른쪽 값 잘림을 Chrome 책임으로 돌릴 수 없다. 원인 규명과 현대 Chrome·실물 재검증이 필요하다.
4. 거래 도움말 S08은 실행 권한이 아니라 안전 경계다. 이번 조사에서는 어떤 주문 버튼도 누르지 않았다.
