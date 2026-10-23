# 모바일 후속 QA와 실제 export 수신 기록 · 2026-10-24

## 기준과 판정 경계

- 시작 기준은 `f9ef126f6dd6eca467ea90cb24217f5bcfca57ae`, 앱 v1.14.1이다. 검사 시작 시 `main`과 `origin/main`이 같았다. 실제 입력에서 드러난 IME 배치와 compact 연구 창 헤더 겹침은 `9f15506e21ff89ec426bec83637b8db749b06747`에서, Android의 완전 투명 PNG는 `65bedcbfc2f20bca842031aa261f4b837ef5731d`에서 수정했다. 시장 자료·경제 가정·사이클 선정 모형은 이 수정으로 바꾸지 않았다.
- IME/헤더 수정의 [CI](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/40015555449)·[Pages](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/40015555423), PNG 수정의 [CI](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/40022544372)·[Pages](https://github.com/twoimo/bitcoin-cycle-atlas/actions/runs/40022544385)는 모두 성공했다. 공개 변경 자산을 각각 8개·5개 SHA-256으로 대조해 일치했다. 이는 모든 모바일 기기·조합의 통과가 아니다.
- 검수 중 독립적으로 들어온 자료 갱신 `3e9fdb7ded81d6e3e24c198b8a76ca0a7ae84e53`을 덮어쓰지 않고 문서 작업 기준에 반영했다. 개별 수신·입력 검증의 소스는 아래 명시한 `9f15506`/`65bedcb`이며 이후 자료 갱신을 소급 검증했다고 표현하지 않는다.
- 620px 이하에서는 지표 이름·값이 항상 접힌다. `indicator-list=open`, 템플릿, 초기화도 펼치지 않는다. 지표 자체의 추가·삭제·visibility 및 라이브러리 관리와는 별개다.
- 이전 Android 터치 결과는 [기존 기록](MOBILE_TOUCH_THUMBNAIL_2026-10-24.md)에 남긴다. Chrome을 업데이트한 뒤의 실제 입력 검증을 대신하지 않는다.

## 완료한 검사

- 시작 기준 650개 → IME/헤더 수정 652개 → PNG 수정 **656/656 통과**, 실패·건너뜀 0. 가시 높이 600/601 경계, 라이브러리의 키보드 대응·접힘 유지·리스너 정리, 빈 alpha/readback 실패 시 인코딩 금지, 뒤쪽 띠의 유효 픽셀·약한 alpha 허용을 검사한다. PNG 단위 fixture는 모의 API 경계이며 실제 디코딩 증거는 아래 수신 파일이다.
- `verify:static`, `verify:cycle`, `verify:performance`: 통과. 성능 검사는 결정론적 Node SVG/검색/선택 경계이며 브라우저 페인트·입력 지연 측정이 아니다.
- `verify:formal`: 고정 TLC 1.7.4와 Android Studio JBR 사용. 정상 모델 2,081개 고유 상태, `NoStaleDisplay` 위반 없음. 의도적으로 깨뜨린 모델은 예상한 불변식 위반을 냈다. 실제 구현 회귀 30개 통과와 ownership-guard mutation의 예상 실패를 확인했다. 유한 추상 모델이며 전체 프로그램·liveness 증명은 아니다.
- `build:standalone`: 두 수정 모두 76개 모듈·5,941개 관측값. IME/헤더 수정 17,259,109바이트, 최종 PNG 수정 **17,263,013바이트**이며 standalone 정적 검사도 통과했다. 빌드나 formal 검사가 PNG 픽셀·OS 터치·모든 브라우저 동작을 증명하는 것은 아니다.

## 데스크톱 실제 수신 파일

파일 수신 소스는 시작 기준 `f9ef126`이며 환경은 Aside Chromium 154, macOS, 1440×900 CSS px다. 소유한 로컬 QA 탭에서 실제 UI 저장을 실행하고 브라우저 download 이벤트와 `saveAs`로 파일을 받았다. 총 **선택한 11개 파일**이며 모든 조합의 전수 검사는 아니다. 별도 부모 readback에서 파일 바이트·SHA-256·PNG signature/치수·MIME·CSV 레코드를 재확인했다. SVG 두 파일은 `xmllint --noout`도 통과했다.

| 실제 조합 | 결과 |
| --- | --- |
| 주 가격 화면 PNG / SVG | `image/png` 2716×1936 / 유효 SVG XML |
| Workspace PNG / SVG | `image/png` 2716×3634 / 유효 SVG XML. `4년 비교`, `월·분기` 두 펼친 창 포함 |
| Workspace 제외 상태 | 열지 않았거나 숨긴 `구간 길이`, `고점권 도달`, `CryptoCon 검증` 3개는 제외 안내. SVG 설명에도 숨김·최소화 창 제외 및 각 창 고유 축 유지가 명시됨 |
| Coin Metrics 실제 일별 CSV | 731개 데이터 레코드, 11열, `USD`, `observed` |
| Bitstamp 실제 1D CSV | 731개 데이터 레코드, 11열, `USD`, `observed` |
| Bitstamp 실제 1W CSV | 104개 데이터 레코드, 11열, `USD`, `observed` |
| 조건부 경로 별도 CSV | 731개 데이터 레코드, 12열, `conditional`, `probability_interval=false` |
| `4년 비교` 연구 CSV | 7,292개 데이터 레코드, 14열, `analysis`. 경과일 고유 축, 실제 USD 가격, 시작=100 열을 유지 |
| 화면 `%` → Coin Metrics CSV | 새로 수신한 파일이 USD 기본 파일과 SHA-256까지 동일 |
| 화면 `최근 관측 = 100` → Coin Metrics CSV | 새로 수신한 파일이 USD 기본 파일과 SHA-256까지 동일 |

PNG는 실제 이미지를 열어 확인했다. Workspace의 두 연구 창이 보이며 검토한 이미지에서 패널 유실·잘림은 관찰하지 못했다. 추가 창 조합·다른 연구 CSV 및 모바일 수신은 이 데스크톱 기록의 범위가 아니다.

PNG 수정 `65bedcb`의 공개 배포본에서도 주 가격 PNG **1개를 추가 수신**했다. 2716×1936, 647,732바이트, SHA-256 `693d66f9dd706c811c6d273e53fddfe9b3c7395b11d8699c88bddf91b66f2563`이며 5,258,176픽셀 모두 alpha=255였다. 실제 이미지에서 가격선·기간선·축·출처를 확인했다. 첫 새 로드에는 연결 오류 UI가 한 번 나왔으나 내장 재시도 1회로 정상화됐다. 최초 원인은 미확정이며 새 제품 결함으로 단정하지 않았다.

### 수신 바이트 식별

| 파일 | SHA-256 |
| --- | --- |
| `Bitcoin_Price_Chart.png` | `a875c2f9e66531a20a056974fe292ee42298866253a03a6e233796d6554367e8` |
| `Bitcoin_Price_Chart.svg` | `059414bff1d17e7d2ac4b0c9756c85abdafa3e59aa901347c30b11fb43da61d2` |
| `Bitcoin_Research_Workspace.png` | `d542923c81b7b7917b7341dda1782444edc3f0ba723791a553f62d884e474570` |
| `Bitcoin_Research_Workspace.svg` | `e2e4f656d639a200ce26e6e3e42c01ac576d950a8f846aa6a0970043d7ab8fff` |
| `Bitcoin_coin-metrics-daily_daily.csv` | `9dcac53f9320a209e91fc7e4b75495be5859b103ec333abdac9411ab03a8a26c` |
| `Bitcoin_bitstamp-ohlc_daily.csv` | `ac11c750ce05452c7d7e0d4aae1a62b9df5d193cdff679bf53294978e5d43643` |
| `Bitcoin_bitstamp-ohlc_weekly.csv` | `f26c9ccaa29d0dee8ccf36a1f474495479f09553e47bfd6cd5faa96da166d8b1` |
| `Bitcoin_conditional-path_daily.csv` | `abfc1ab8aa1b6c26c105adfa9929a47710108670a3b1e6e5b8e8819405be970b` |
| `Bitcoin_research-cycles_daily.csv` | `87f238767ba3e86f03de3d482bc7c82680b27c750c4c67ef6fce79b0c4a059e4` |
| `%`와 `최근 관측 = 100`에서 받은 두 CSV | 각각 USD 기본 CSV와 동일한 `9dcac53f…a8a26c` |

검수 중 제기된 CSV 1행 차이는 헤더/빈 행 집계 오류였다. 원본 네 CSV를 quoted-aware parser로 독립 재파싱하여 UI의 731/104행과 일치를 확인했다. 데이터 누락 결함으로 기록하거나 원본을 수정하지 않았다.

## Android AVD 실제 입력과 수신

### 환경과 복구 이력

- 실물 S24가 아닌 `emulator-5554`, AVD 이름 `Galaxy_S24_Ultra`, adb 모델 `sdk_gphone64_arm64`다. 화면 1440×3120, density 505, CSS 폭 456px다. Samsung 하드웨어·One UI 검증으로 표현하지 않는다.
- 공식 Google Play에서 Chrome 113.0.5672.136 → **156.0.8078.47**로 갱신했다. 도중 Play services ANR와 설치 직후 UI/CDP 시간 초과·8바이트 캡처를 관찰했으나 그 캡처를 화면 증거로 쓰지 않았다. 최초 원인은 확정하지 않았다.
- 사용자가 허가한 **기존 AVD 재시작** 뒤 입력·화면·파일 수신이 정상 응답했다. 앱 데이터 삭제·비공식 APK 설치·다른 탭 종료는 하지 않았다. 초기 `[blocked-runtime]`은 아래 실제 readback으로 해소됐으며 실물·iOS 등의 별도 보류는 해소하지 않는다.

### 실제 입력에서 확인한 범위

| 검사 | 관측·수정과 수락 |
| --- | --- |
| 검색 IME | 실제 Gboard 검색에서 결과·하단 안내 가림 재현. 가시 viewport 높이에 맞추도록 수정하고 결과 추가·안내 접근·키보드 종료 후 높이 복원을 확인 |
| 항상 접힘 | 검색 결과를 추가한 뒤에도 모바일 지표 이름·값은 접힘. 지표 추가 자체와 목록 펼침을 구분 |
| 두 연구 창 | `월·분기`와 `4년 비교` compact 헤더가 본문 약 27px를 덮는 문제 수정. 실제 터치로 순서 변경·최소화/복원·최대화/해제·창 이동·높이 330→368px 조절 확인 |
| 강한 자석 · 1D | 실제 ADB 탭 두 번과 trusted touch 이벤트 확인. 시작 **2025-12-11 H=93,562**, 끝 **2026-06-24 H=63,137**이 원 Bitstamp 일봉 CSV의 해당 `high`와 정확히 일치. 약한 자석·다른 간격 전수 수락을 뜻하지 않음 |

### 빈 PNG의 재현·수정

처음 받은 PNG 두 개는 형식·치수·해시가 존재했지만 실제 RGBA가 모두 0이었다. 이미지 성공으로 세지 않았다. 같은 SVG·같은 Android 렌더러의 대조에서 기본 Canvas, `decode()` 추가, Canvas 해제 지연은 모두 같은 빈 PNG였다. `willReadFrequently:true`인 출력용 Canvas만 정상 픽셀을 만들었다. 이는 **이 AVD/Chrome 조합의 기본 SVG→Canvas readback 경로 관측**이며 모든 Android/GPU의 원인으로 일반화하지 않는다.

[PNG 변환](../dist/chart-export.js)은 출력 전용 readback 경로를 사용하고, 완전 투명하거나 읽지 못하는 결과는 인코딩 전에 SVG 안내 오류로 종료한다. 전역 GPU 설정은 바꾸지 않았다. 검사는 16행 띠 단위여서 4096px 폭에서도 한 readback 요청이 최대 256KiB다. 기존 12MP 상한은 유지하며 전체 렌더링·인코딩 메모리의 실측 상한을 주장하지 않는다. alpha 검사는 배경만 남은 이미지까지 의미 검증하지 않으므로 실제 파일도 열어 확인했다. [API 문서](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext) · [픽셀 경계 회귀](../tests/chart-data-export.test.mjs)

후보의 로컬 PNG 두 개에 이어 **공개 HTTPS 배포본의 PNG 두 개를 다시 수신**했다. 아래 최종 PNG는 각각 1,811,232 / 2,646,624픽셀 모두 alpha=255, 서로 다른 RGB 색상 1,024개 이상이며 실제 가격 그래프·두 연구 창·출처가 보인다. 912×1986 / 912×2902다. 초기 실패 PNG와 후보 수신본은 최종 성공 8개에 섞지 않았다. 로컬 HTTP SVG의 보안 경고는 취소하고 HTTPS에서 검증했으며 경고의 유지/우회는 하지 않았다.

### Android 최종 선택 8개

PNG 두 개는 `65bedcb`, SVG·CSV 여섯 개는 `9f15506`의 공개 HTTPS 수신본이다. 후자의 SVG/CSV 생성 로직은 PNG 수정에서 바뀌지 않았다. 전체 조합 전수 검사가 아니다.

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `Bitcoin_Price_Chart.png` | 375,225 | `1a4a6c119439ca228d1a5fefa1a7e7f31a27c3c9fa0351fdf295cf10bd8926e2` |
| `Bitcoin_Research_Workspace.png` | 521,541 | `ad267d73840bd1c76155205bbe30ba3f707250d0ab92a5a933a1e750d005887d` |
| `Bitcoin_Price_Chart.svg` | 81,530 | `804b37212d9b3b93147d608ef7ba6f3cc9cc229ac847ef9332bf1bf679540563` |
| `Bitcoin_Research_Workspace.svg` | 144,221 | `40efbd1526ffe948a5c35238482de3008c3626ce0051d1b4281ef10531e73592` |
| `Bitcoin_coin-metrics-daily_daily.csv` | 48,261 | `9dcac53f9320a209e91fc7e4b75495be5859b103ec333abdac9411ab03a8a26c` |
| `Bitcoin_bitstamp-ohlc_daily.csv` | 77,608 | `ac11c750ce05452c7d7e0d4aae1a62b9df5d193cdff679bf53294978e5d43643` |
| `Bitcoin_conditional-path_daily.csv` | 113,042 | `abfc1ab8aa1b6c26c105adfa9929a47710108670a3b1e6e5b8e8819405be970b` |
| `Bitcoin_research-cycles_daily.csv` | 1,670,948 | `87f238767ba3e86f03de3d482bc7c82680b27c750c4c67ef6fce79b0c4a059e4` |

각 파일의 기기 내 바이트/해시와 호스트 수신본을 대조했다. SVG 두 개는 XML 검사를 통과했다. CSV를 독립 파싱해 관측 731행·11열 두 개, 조건부 731행·12열, 연구 7,292행·14열 및 `observed`/`conditional`/`analysis` 분리를 확인했다. 연구 CSV의 실제 선택 라벨은 `사후 저점부터 같은 4년 비교 · 별도 분석 CSV`였다.

### 다중 접점: 브라우저 주입 범위와 측정 도구 계약

- **M은 이동·pinch 대상에서 명시적으로 제외**된다. [입력 계약](../dist/chart-navigation.js)의 `getTool()==='measure'` 분기를 확인했다. M에서 주입한 두 접점과 cancel은 기존 시작점을 그대로 보존했고 새 끝점을 만들지 않았다. 처음의 “draft가 사라져야 한다”는 검사 기대는 잘못된 oracle로 철회했으며 제품 결함으로 세지 않았다.
- 실제 네이티브 제어로 현재 QA 측정을 지우고 H를 선택했다. Chrome DevTools의 두 접점 주입에서 trusted `touches=2`와 앱 날짜 창 확대를 확인했다. **2025-06-26 → 2028-02-25**로 창이 바뀌었고 브라우저 viewport scale은 1을 유지했다. 별도 `touchCancel` 뒤에도 새 측정은 없었다.
- 모든 접점 해제·취소 뒤 **실제 ADB 한 손가락 swipe**로 날짜 창이 **2025-02-17 → 2027-10-19**로 이동했다. 잔여 접촉이 새 입력을 막지 않았고 지표 이름·값은 계속 접혔다. 이후 기본 4년·십자선·빈 측정 상태로 복원하고 관측 리스너를 제거했다.
- 이 검사는 **AVD의 Chrome 브라우저 입력 주입**이다. Android 커널/실물의 동시 두 손가락·남은 한 접촉의 이동·세 번째 손가락·회전·OS 중단 전수 수락이 아니다. 현재 CLI는 단일 접촉이며 가상 터치 장치는 쓰기 권한이 없었다. root·새 instrumentation 설치로 우회하지 않았다. OS 네이티브 2접점은 `[blocked]`로 남기며 지원되는 입력 컨트롤러 또는 접근 가능한 실물이 필요하다.

### 나머지 기기·접근성

| 항목 | 현재 관측과 최소 다음 단계 |
| --- | --- |
| 실물 Galaxy | `[blocked]` 06:39 KST 재확인 ADB 목록에는 에뮬레이터 1대뿐이며 활성 실물 transport 없음. Tab은 Tailscale offline이었다. S24의 이전 offline 보고를 새 현재 상태로 단정하지 않으며, 접근 가능한 기존 원격 ADB 연결이 필요. 과거 포트로 재시도하지 않음 |
| iOS Safari | `[blocked]` 06:39 KST 재확인에서도 사용 가능한 simctl device와 runtime이 모두 0. 접근 가능한 iOS 기기 또는 승인된 런타임 설치 필요. macOS Safari를 iOS 검증으로 대신하지 않음 |
| TalkBack | `[blocked]` 06:39 KST 패키지 미설치, `enabled_accessibility_services=null`. 전역 `accessibility_enabled=1`만으로 TalkBack 실행을 의미하지 않는다. 공식 앱 설치와 승인된 스크린리더 QA가 필요. DOM/단위 검사를 TalkBack 사용 검증으로 표현하지 않음 |
| 외부 Pro/Gemini 교차검토 | 이전 공유 용량 보류를 해제하거나 완료로 간주하지 않음. 이번 파일 수신·회귀 기록은 그 교차검토의 대체 증거가 아님 |
