# TradingView 모바일 조사와 Bitcoin Cycle Atlas 비교

**2026-10-23 KST · 공식 문서 8개 · 단계별 시나리오 25개 · Android UI 캡처 56장 · 실제 수신 PNG/CSV 각 1개**

[데스크톱 조사](https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/research/tradingview-2026-10-23/README.md)와 별개의 모바일 후속 조사다. **실물 갤럭시·네이티브 앱 검증이 아니다.** Android 14 ARM64 에뮬레이터의 Chrome에서 실제 Android 입력으로 모바일 웹을 조작했다. 데스크톱 브라우저 창을 좁힌 결과와도 구분한다.

## 읽는 순서

1. [25개 단계별 시나리오](01-step-by-step.md): TradingView 값 추적·축·간격, Atlas 선택·지표·연구 창·측정·공유·export·회전.
2. [결함·개선 후보 8개](02-gap-backlog.md): 환경 내 확인 결함 3개, 사용성 관찰 2개, 제안·QA 후보 3개.
3. [공식 문서 8개](03-official-docs.md): 제품/Android 앱/개발자 라이브러리를 분리한 인용과 적용 경계.
4. [커버리지·수신 파일·검증](04-coverage.md).
5. [56장 캡처 갤러리](CAPTURES.md), [캡처 manifest](capture-manifest.json), [공식 출처 JSON](official-sources.json), [환경](environment.json).

## 먼저 볼 결과

- TradingView는 **길게 눌러 값 추적 → 드래그로 봉 이동 → 단일 탭으로 종료**한다. 첫 시도에는 안내가 먼저 나타났고 안내 종료 후 OHLC를 확인했다. Atlas는 **단일 탭 고정 선택**, **길게 누르기 빠른 메뉴**다. 둘의 의미가 다르며 같은 제스처를 무조건 복제할 필요는 없다.
- Atlas의 수동 Y축·Auto, 지표 접기·숨김·복원, 연구 pane 최소화·복원, 두 점 측정, PNG·CSV는 이미 존재한다. 실제 모바일로 확인한 기능을 새 미구현 목록에 넣지 않았다.
- **확인한 결함:** 모바일 정보 트레이의 과대 아이콘([MA28](captures/MA28.png)), **SVG 저장** 라벨에서 실제 **PNG** 수신([MA30](captures/MA30.png)), 좁은 시간봉 화면/PNG의 일부 가격축 끝 잘림([MA21](captures/MA21.png)). 원인·모든 기기 재현 여부는 별도다.
- 수신 CSV는 **180행·11열**, Coinbase Exchange·USD·1h·observed이며 **2026-10-15 22:00–2026-10-23 09:00 UTC**다. PNG는 **914×1684**로 실제 수신 파일을 검사했다. [PNG](exports/Atlas_Android_1h.png) · [CSV](exports/Atlas_Android_1h.csv).

## 비교 기준과 동시 변경 정산

조사 시작 저장소는 e8267abd(v1.12.0)이었지만 조사 중 원격에 v1.12.1이 추가됐다. **최종 소스 기준은 `a71cdc3765fc7913dc0d9c57c94365619a4bcb0b`, package v1.12.1**이다. 공개 index의 자산 버전은 **1.12.1-cursor-hud.1**, app.js·mobile-workspace.css·chart-navigation.js·indicator-state.js의 공개 바이트와 해당 커밋 바이트가 모두 일치했다. [해시 기록](atlas-baseline.json)

v1.12.1은 모바일에서 목록 전체를 기본 접으며 버튼은 **8개**를 표시했다. 라이브러리의 추가됨 **11개**에는 가격/OHLC·자료 출처·차트 범례라는 표시 항목 3개가 포함된다. 8과 11의 차이는 누락이 아니다. 펼치면 추가한 연구 지표를 읽고, 숨김과 삭제·최소화는 구분한다. 예전 v1.11 문서의 기본 펼침·과거 대표 1개 규칙을 현재 규칙으로 재사용하지 않는다. [현재 기본값](https://github.com/twoimo/bitcoin-cycle-atlas/blob/a71cdc3765fc7913dc0d9c57c94365619a4bcb0b/dist/indicator-state.js#L39)

## 제한과 보존

- TradingView 앱은 미설치, 실물 폰은 온라인 transport 없음. Android 앱/iOS 결과는 문서 근거뿐이다.
- TradingView 익명 모바일 웹은 **1h 선택 직후 가입 시트가 노출**됐다. 차트 유형·지표·그림·내보내기 후속 모바일 작업은 미검증이며, 가입·구독·우회는 하지 않았다. 이는 데스크톱 계정의 CSV 업그레이드 제한과 다른 제한이다.
- 동시 두 손가락 pinch, TalkBack, FPS·지연·배터리는 미측정이다. 소스/문서의 pinch 지원을 실기 입력 성공으로 부르지 않는다.
- MAIN 저장 레이아웃을 이 모바일 대상에서 열지 않았다. 새 탭 2개만 사용 후 닫고 원래 앱·세로 회전으로 복원했다. 기존 탭, 계정, 즐겨찾기, 저장 작업 화면·템플릿, 앱/권한 설정을 바꾸지 않았다. 수신한 두 파일은 기기 Download에 남겨 두었다.
- 변경물은 **문서·캡처·export 표본**뿐이며 앱 수정·새 기능 구현·배포를 주장하지 않는다.

TradingView UI·상표는 각 권리자에게 있으며 캡처는 사용법 비교·비평의 근거다. 원시 Pine 소스·자격증명·계좌·주문·개인 메시지는 수집·커밋하지 않았다.
