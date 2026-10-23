# 모바일 커버리지·수신 파일·검증

## 환경과 범위

- 조사일: 2026-10-23 KST. 원본 manifest의 시각은 호스트 UTC이며 화면의 기기 시간대는 Asia/Seoul이다.
- Android 14 ARM64 AVD sdk_gphone64_arm64, emulator-5554. **실물 Samsung One UI가 아니다.**
- 화면 1440×3120px·505dpi, Android app bounds 세로 456×917dp. 가로 3120×1440px·app bounds 941×404dp. dp는 Android가 보고한 값이며 JS CSS viewport 계측값과 같다고 단정하지 않는다.
- Chrome **113.0.5672.136**. 업데이트를 요구하는 메뉴가 있었지만 조사 때문에 브라우저/앱을 업그레이드하지 않았다. 최신 모바일 브라우저 결과로 일반화하지 않는다.
- 입력: Android 단일 탭, 800ms stationary swipe로 길게 누르기, 한 손가락 가로/세로 swipe, Android Back, 지원되는 emulator rotate. raw UI 탐색→필요시 OCR/이미지로 수락 상태를 확인했다.
- 비교: Atlas a71cdc3765fc7913dc0d9c57c94365619a4bcb0b(v1.12.1). 공개 자산 버전 1.12.1-cursor-hud.1. [4개 공개/소스 SHA-256 일치](atlas-baseline.json).

## 표면별 상태

| 표면 | 확인한 것 | 확인하지 않은 것 |
|---|---|---|
| TradingView Android 모바일 웹 | 익명 새 차트, 검색·거래소, 1D OHLC 추적/이동/종료, 일반 과거 이동, 축 메뉴/로그/수동/Reset | 가입 시트 이후 차트 유형·지표·그림·Object Tree·export, 저장 계정 레이아웃 |
| TradingView 1h | 간격 선택 수락, 상단 1h·접근성 설명과 배경 차트 | 가입 시트가 없는 1h 조작·정확한 OHLC 검증 |
| TradingView Android 앱 | 공식 문서 S04/S06/S08, 패키지 미설치 확인 | 앱 설치·로그인·실제 앱 조작 전부 |
| Atlas Android 모바일 웹 | 선/캔들·선택·문맥 메뉴·확대·범위 변경·Y축·Auto·지표/연구 pane·1h 조회·측정·PNG/CSV 수신·공유 UI | 자석 실제 적용·모바일 SVG 수신·작업 화면 저장/복원·템플릿/즐겨찾기 저장·클립보드 복사 |
| Atlas 가로 방향 | 실제 Android 회전, 배치·선택·측정 보존, 원래 세로 복원 | 가로의 모든 메뉴/제스처·화면 크기 전수 |
| 실물·iOS·다중 터치 | 문서·소스의 지원 계약 일부 | 실물 터치, iOS Safari/앱, 동시 두 손가락 pinch, TalkBack/VoiceOver, FPS·지연·배터리 |

## 실제 수신 파일

### PNG

- 경로: [exports/Atlas_Android_1h.png](exports/Atlas_Android_1h.png)
- Android 파일명: Bitcoin_Price_and_Future.png
- **PNG signature, 914×1684px, 190,802 bytes**
- SHA-256: 02eefd5581a0f231af26dec23283bae23b35882519859da55cbab9b619e17f29
- 정보 트레이의 **SVG 저장**이라고 표시된 버튼이 이 PNG를 만들었다. MA28의 라벨, MA30의 수신 안내와 파일 바이트를 연결했다.
- 직접 열어 OHLC·가격/시간축·Coinbase 거래량·완료된 자유 가격 측정·출처를 읽었다. 일부 가격축 끝 잘림도 그대로 남는다. 내보내기 전체가 시각적으로 완전하다는 의미는 아니다.

### CSV

- 경로: [exports/Atlas_Android_1h.csv](exports/Atlas_Android_1h.csv)
- Android 파일명: Bitcoin_Observed_1h.csv
- **180 데이터 행 + header, 11열, 23,967 bytes**
- 원본 UTF-8 BOM·CRLF를 정규화하지 않고 보존했다. Git 공백 검사는 이 수신 표본의 CR-at-EOL만 유효한 줄 끝으로 허용하고 다른 공백 검사는 유지한다.
- 범위: 2026-10-15T22:00:00.000Z–2026-10-23T09:00:00.000Z.
- source=Coinbase Exchange, currency=USD, interval=1h, kind=observed. 모두 엄격한 시각 증가, OHLC 범위 일관성·음수 아닌 거래량을 만족한다.
- 마지막 봉의 1시간 종료는 다운로드 관찰 2026-10-23T10:30:26.474Z보다 앞선다. 숫자/완료 여부의 구조 검사이며 모든 행을 독립 거래소 API와 재대조한 것은 아니다.
- SHA-256: e55bab773ae8fc54ab11d9485bebb76af132ce76f991a1fd2ea02cdba7eed2bc
- 열: chart_date_utc, candle_open_utc, interval, source, currency, open, high, low, close, volume_btc, kind.
- 미래 가정·전체 역사·미수신 과거 봉은 포함하지 않는다. 공유 링크·작업 화면은 파일 export와 다르다.
- [기계 판독 검증](export-validation.json).

## 시각·수락 증거

- **56장**: TradingView 19장 + Atlas 37장. 원본 PNG마다 SHA-256·bytes·실제 픽셀·시각·입력·관찰·표면을 [manifest](capture-manifest.json)에 기록했다.
- 8장씩 묶은 **7개 검수 시트**로 56장을 모두 시각 검토했다. 가입 시트가 MT16부터 이미 나타났다는 점, MT05는 안내뿐이라는 점, MA29/MA33에는 추정했던 export 버튼이 없다는 점을 캡션에 정산했다.
- 핵심 화면·결함과 실제 export PNG는 원본 크기로 추가 검토했다. 검수 시트는 임시 자료이고 원본 PNG가 제출 증거다.
- [선별 Android UI 기록](touch-observations.json)은 선택 가격/범위·버튼 이름·물리 bounds를 남긴다. native accessibility에는 배경·잘린 자식이 포함될 수 있으므로 존재만으로 보임·터치 수락을 판정하지 않았다.
- MA06→MA07의 swipe 뒤 범위 이동은 23일이다. 전체 이벤트 스트림을 계측하지 않아 이동 비례성·완전한 추종은 미검증이다.
- Download 토스트/종료 코드만 성공으로 쓰지 않고, 이번에 새로 생긴 두 파일을 정확한 기기 Download에서 가져와 검사했다. 원래 파일은 삭제하지 않았다.

## 보존과 정리

1. 저장된 TradingView MAIN을 모바일에서 열거나 저장하지 않았다. 익명 새 차트에만 임시 구성 변경을 했다. 계정 생성/로그인/구독/주문/알림/브로커/게시를 실행하지 않았다.
2. Atlas는 이번에 추가한 4년 비교만 제거해 12→11개 추가 상태(연구 목록 9→8)를 복원했다. 거래량 숨김을 다시 표시했고, Auto도 복원했다. 즐겨찾기·템플릿·작업 화면·계정 상태를 저장하지 않았다.
3. 조사용 Chrome 탭 **2개만** 각 Close→Closed 상태로 확인해 닫았다. 기존 탭은 닫지 않았다. 브라우저 전체 종료/데이터 삭제는 하지 않았다.
4. 회전을 ROTATION_0으로 복원하고 accelerometer_rotation=1·user_rotation=0 불변을 확인했다. 원래 Instagram Activity의 현재 focus도 확인했다. 콘텐츠 feed가 네트워크 재정렬되지 않았다는 보장은 아니다.
5. 앱/권한/개발자 설정·계정·모델·시장 데이터 소스를 수정하지 않았다. 새로 받은 PNG/CSV는 Android Download에 남겨 두었다.
6. 코드 작업 트리는 원격 a71cdc3에서 격리해 만들었고 이 연구 커밋에는 문서·캡처·export 표본만 넣는다.

## 로컬 검사

- 비교 기준 v1.12.1의 **npm test: 490 통과 / 실패 0 / 취소·건너뜀 0**, node:test 실제 집계다. 이전 데스크톱 기준 469개와 합산하지 않는다.
- **npm run verify:static: status ok, 86개 파일·163개 참조.** 앱/정적 참조 검사이지 모바일 전수 검증이 아니다.
- 연구 자료 검사는 Markdown 상대 파일/fragment, 56개 capture manifest, PNG magic/크기/hash, 공식 8개 고유 URL, 25개 시나리오·8개 후보, export 바이트/hash를 확인한다. 실제 수치는 [verification.json](verification.json)에 기록한다.
- 이 검사 통과는 원격 push·현재 main·공개 배포의 증거가 아니다. 원격 커밋 수락은 Git으로 별도 확인하며, 새 기능 배포를 주장하지 않는다.
