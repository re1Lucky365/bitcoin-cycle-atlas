# 모바일 결함·개선 후보 8개

비교 기준: **a71cdc3 · v1.12.1**. 3개 환경 내 확인 결함, 2개 사용성 관찰, 3개 설계·검증 후보다. 이번에는 앱을 수정하지 않았다. P1/P2는 제안 우선순위이며 버그 이슈 발행·출시 승인·전 기기 재현을 뜻하지 않는다.

## 이미 있어 새 미구현으로 세지 않은 것

- 모바일 레일 접기/도구·정보 트레이, 네이티브 8개 간격 선택.
- 단일 탭 선택, 길게 누르기 빠른 메뉴, 시간창 확대·이동.
- 수동 가격축·Auto 복구·로그, 전체 지표 목록 접기/펼치기.
- 눈으로 숨김·복원, 추가와 삭제, 연구 pane 최소화·복원.
- 검색·즐겨찾기/템플릿 UI, 두 점 측정·자석 선택 경로.
- 주 차트 PNG, 현재 범위 완료 OHLC CSV, 작업 화면·공유 UI.

## G01 · 정보 트레이 추가 기능 아이콘 과대 표시

**P1 · 확인 결함(이 AVD/Chrome 환경)**

- 재현: 1h 또는 현재 차트→상단 정보와 설정→추가 차트 기능.
- 실제: 설정·SVG 저장·빠른 조작·작업 화면 아이콘만 크게 표시되어 아래의 정상 크기 상세/페이지 아이콘과 심하게 다르다. 설정 버튼 native bounds **[50,530]–[492,1057]**, 즉 442×527px. 이는 이미지로도 확인했다.
- 근거: [MA28](captures/MA28.png). TradingView 모바일 웹 상단/좌측 도구는 이 화면에서 작은 고정 아이콘을 유지했다([MT04](captures/MT04.png)); Android 앱과 크기를 비교한 것은 아니다.
- 소스: [raw SVG 생성·mobile-extra-actions](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/mobile-workspace.js#L7), [모바일 트레이 스타일](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/mobile-workspace.css). SVG 상속/선택자 범위는 원인 후보이며 실제 computed-style 계측 없이 단일 원인으로 확정하지 않는다.
- 제안: 추가 기능 아이콘의 렌더링 상한·행 높이를 통일하고 글자 크기·접근 가능한 이름은 유지한다.
- 수락: 320–620px와 실제 Android 최신 Chrome에서 추가 기능/상세 아이콘의 의도한 크기가 일치, 긴 한국어 라벨 가로 넘침 없음, 어느 버튼도 타 항목을 가리지 않음, 트레이 내부 스크롤과 닫기 유지. 단순히 모든 버튼을 아주 작게 줄이지 않는다.

## G02 · SVG 저장 라벨과 실제 PNG 파일 불일치

**P1 · 확인 결함(라벨→수신 파일까지)**

- 재현: 모바일 정보와 설정→**SVG 저장**.
- 실제: PNG 완료 피드백, Android Download의 Bitcoin_Price_and_Future.png. 수신 파일은 PNG magic, **914×1684 / 190,802 bytes**였다.
- 근거: [MA28](captures/MA28.png)→[MA30](captures/MA30.png), [실제 PNG](exports/Atlas_Android_1h.png), [export 검증](export-validation.json).
- 소스: [mobile-workspace.js L18](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/mobile-workspace.js#L18)의 고정 라벨과 [lab-view.js savePng](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/lab-view.js#L306) 연결이 다르다.
- 제안: 모바일 라벨을 실제 주 차트 저장 형식에 맞추거나, 명시적인 PNG/SVG 형식 선택으로 연결한다. 공유·화면 저장과 export를 혼동하지 않는다.
- 수락: 화면 라벨·aria-label·피드백·파일 확장자·MIME·magic이 일치. PNG와 SVG를 모두 노출한다면 각각 기기에서 수신한 바이트로 검증. 기존 데스크톱 PNG와 분석 pane SVG 동작을 깨지 않음.

## G03 · 좁은 시간봉 가격축의 끝자리 잘림

**P1 · 확인 결함(이 표시 폭·이미지)**

- 재현: 모바일 1h·USD·로그 자동축, 저장 자료 또는 갱신 완료 화면.
- 실제: 일부 오른쪽 가격 눈금의 마지막 숫자가 화면 오른쪽에서 잘린다. 폭이 넓어진 가로 화면은 같은 정도로 잘리지 않는다. 내보낸 914px PNG에서도 일부 축 끝이 경계에 닿거나 잘려 있어 화면 확대 여부만으로 설명할 수 없다.
- 근거: [MA21](captures/MA21.png), [MA26](captures/MA26.png), [MA36](captures/MA36.png), [수신 PNG](exports/Atlas_Android_1h.png).
- 소스: [시간봉 가격축](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/intraday-chart.js), [축 마크업](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/price-axis.js), [export 복제·raster](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/chart-export.js). 원인/정확한 잘린 픽셀 수는 미계측.
- 제안: 눈금의 실제 최대 텍스트 폭·통화/소수 자릿수에 맞춘 오른쪽 여백과 SVG export 경계를 검사한다. 불필요한 소수 표시는 줄이되 선택 OHLC 정확도는 유지한다.
- 수락: 작은 Android 폭·큰 글꼴·선형/로그·큰/작은 가격, 화면과 PNG/SVG에서 축 전체가 읽힘. 선택/최근 봉 가격 표식과도 충돌하지 않음. 최신 Chrome 및 실물에서 원인 구분.
- 주의: TradingView 라이브러리의 Chrome 에뮬레이션 FAQ(S03)는 Atlas에 대한 원인 판정이 아니다. Chrome 113이 오래됐다는 환경 한계를 남긴다.

## G04 · 펼친 값 목록과 기본 HUD의 밀도

**P2 · 사용성 관찰, 기능 부재 아님**

- 재현: 일봉 캔들→8개 값 목록 펼침.
- 실제: OHLC·출처·D-day·색상 범례 아래에 값 행과 눈/×가 가격·사건·기간선 위로 겹쳐 나온다. 기본 접힘은 이미 구현되어 있지만 사용자가 펼친 상태에서 읽기/탐색이 복잡하다.
- 근거: [MA03](captures/MA03.png), [MA10](captures/MA10.png), [MA12](captures/MA12.png). 현재 목록은 제한 높이 스크롤이며 숨기기는 지표 제거가 아니다.
- 소스: [mobile-workspace.css 목록/HUD](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/mobile-workspace.css#L22), [indicator workbench](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/indicator-workbench.js).
- 제안: 사용자 선택을 존중하는 간결한 값 보기·명시적 집중 모드·조절 가능한 목록 영역을 검토. 펼침을 임의로 취소하거나 대표 1개로 강제 축소하는 과거 정책을 재도입하지 않는다.
- 수락: 펼친 모든 추가 지표가 계속 접근 가능, 눈/× 명확, 관측/가정·출처 유지, 확대/선택이 가려지지 않거나 가림을 사용자가 명시적으로 조절 가능. 차트 전체 표시 숨김/개별 숨김/접힘 상태의 의미를 보존.

## G05 · 연구 pane과 펼친 목록의 공간 경합

**P2 · 사용성 관찰, 최소화 미구현 아님**

- 재현: 값 목록을 펼친 채 cycles 검색→4년 비교 추가→창 닫기→pane 최소화.
- 실제: pane은 주 차트 하단을 덮으며, 최소화 후 제목 띠도 일부 값 행/접기 영역과 같은 세로 높이에 놓인다. 겹침 면적을 DOM으로 수치화하지 않았으므로 정확한 차단 면적은 미확정이다.
- 근거: [MA16](captures/MA16.png)→[MA17](captures/MA17.png)→[MA18](captures/MA18.png). 최소화/복원/삭제는 각각 성공했다.
- 소스: [모바일 분석 창 위치](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/mobile-workspace.css#L109), [analysis-dock.js](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/analysis-dock.js).
- 제안: 작은 화면에서 분할 영역/독립 전체화면/확실한 접힌 pane 거치 위치를 검토하고, 값 목록 길이와 동시에 계산한다. 독립 분석 축은 유지한다.
- 수락: 320px·456dp·짧은 가로 화면, 여러 pane/긴 값 목록에서 제목·복원·목록 접기 모두 터치 가능. pane의 눈·최소화·삭제를 서로 다른 상태로 유지. 입력/초점이 가려진 배경 버튼으로 돌아가지 않음.

## G06 · 내보내기와 작업 화면의 정보 구조

**P2 · 설계 제안, CSV/PNG 지원 부재 아님**

- 실제: PNG는 정보 트레이의 SVG 라벨 버튼, CSV는 작업 화면→빠른 검색→CSV, 링크는 같은 대화상자의 별도 저장·공유 탭에 있었다. 설정 패널에는 해당 버튼이 없었다.
- 근거: [MA28](captures/MA28.png)→[MA29](captures/MA29.png), [MA31](captures/MA31.png)–[MA35](captures/MA35.png). CSV 수신도 성공했다.
- 제안: 내보내기를 PNG/SVG/현재 범위 관측 CSV로 묶고, 로컬 작업 화면 저장·클립보드 링크와 구분. 데이터 출처/단위/가시 범위·완료 봉 설명을 옆에 둔다.
- 수락: 검색어를 모르는 모바일 사용자도 찾을 수 있는 명명된 진입점, 키보드가 열린 상태에서도 닫기/결과/형식 설명에 접근 가능. 저장·공유에서 실수로 외부 전송하지 않음. 내보낸 CSV의 모형/미수신 구간 제외 규칙 유지.

## G07 · 앱 간 제스처 의미를 알려 주는 짧은 안내

**P2 · 설계 제안, 기능 고장 판정 아님**

- 실제: TradingView 첫 길게 누르기는 추적 안내(MT05), Atlas는 길게 누르기 빠른 메뉴(MA05). Atlas 기본 탭은 선택 고정이고 TradingView 추적 모드 단일 탭은 종료다.
- 근거: [MT05](captures/MT05.png)–[MT08](captures/MT08.png), [MA04](captures/MA04.png)–[MA05](captures/MA05.png), S01/S02.
- 제안: 한 번 닫을 수 있는 “탭: 값 고정 / 끌기: 기간 이동 / 길게: 빠른 조작 / 축 끌기: 가격 범위 / Auto: 복구” 안내를 검토. TradingView 모드를 복제하는 것이 목표가 아니다.
- 수락: 이전 사용자의 선택을 보존하는 dismiss 상태, 재열기 가능한 도움말, 안내가 스크롤/측정·축 동작을 막지 않음. 측정 모드·자석의 현재 상태를 손가락 사용자도 읽을 수 있음. 문서상 pinch를 실제 검증 없이 성공 안내로 단정하지 않음.

## G08 · 실물·현대 브라우저·다중 터치 QA 공백

**P1 · 검증 백로그, 제품 기능 결함 수에 합산하지 않음**

- 관측 범위는 Android 14 AVD·Chrome 113 한 환경이다. 가로는 배치/복원만 시험했다. 실제 simultaneous two-finger pinch·TalkBack·iOS·native app·FPS·지연·배터리는 미검증이다.
- 또한 MA06→MA07의 480px swipe 명령 뒤 날짜 범위 이동은 23일이었다. 실제 pointer stream/취소·단계별 displacement를 기록하지 않아 전체 추종 성공이나 제품 원인을 단정할 수 없다. 과소 이동/DOM redraw 중 gesture 유지 재현 후보로 남긴다.
- 소스는 이미 [pinch·pointer cancel·drag](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/chart-navigation.js#L238)을 구현한다. 소스/단위 테스트 통과와 실제 다중 터치 수락은 다른 증거다.
- 수락: 사용자가 지정한 연결된 실물 Galaxy의 현대 Chrome, iOS Safari 별도 확인; 두 손가락 확대→한 손가락 잔여 접촉→취소→다시 탭/간격 변경, 드래그 거리 비례성, 방향 전환, 늦은 네트워크 응답·저장 자료 상태를 확인. 기기/브라우저 버전·입력·전후 시간창·캡처를 남김. FPS/지연은 계측 없이는 숫자를 만들지 않음.

## 하지 않을 확장

범용 종목 터미널·Pine 실행·브로커·One-tap trading·서버 알림·사회적 게시·TradingView 저장 레이아웃 복제는 이번 개선 범위가 아니다. 현재 UI 연구는 배포·결제·계정 생성·매매·정확한 미래 예측의 승인 근거가 아니다.
