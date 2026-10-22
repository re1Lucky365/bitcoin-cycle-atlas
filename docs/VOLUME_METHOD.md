# BTC 거래량과 OHLC의 출처·집계·검증

검토일: **2026-10-22 UTC**. 구현 출발 커밋: `f48c0d79a7922c7f460057629ae58e8a8b12c004`.

1.8부터 미래 거래량의 별도 조건부 시나리오를 추가했다. **이 문서는 실제 관측 막대의 검증 계약**을 설명한다. 미래 점선의 수식·검증은 [VOLUME_FORECAST_MODEL.md](VOLUME_FORECAST_MODEL.md), 문헌과 시장구조 대조는 [VOLUME_FORECAST_RESEARCH.md](VOLUME_FORECAST_RESEARCH.md)에 있으며, 관측 저장본에 미래 봉을 추가하지 않는다.

## 표시하는 값과 실제 범위

일봉·주봉의 거래량은 **Bitstamp BTC/USD 현물 시장에서 해당 기간에 거래된 BTC 수량**이다. 달러 거래대금, 전 세계 거래소 합계, 비트코인 온체인 전송량, 파생상품 거래량을 뜻하지 않는다. 일봉·주봉 캔들의 OHLC도 같은 Bitstamp 응답에서 가져오므로 그 가격과 거래량의 거래소가 일치한다. 기존 CoinMetrics 종가 선 및 예측 기준 가격, Coinbase 분·시간 봉은 서로 다른 데이터 계열이며 출처를 구별해야 한다.

| 항목 | 이번 저장본의 실제 값 |
|---|---|
| 공급자 / 상품 | Bitstamp / BTC-USD (`btcusd`, 원문 `BTC/USD`) |
| 상품 유형 / 거래량 단위 | SPOT / BTC, base currency |
| 수집 요청 범위 | 2010-01-01 이상, 2026-10-22 미만, UTC |
| 실제 첫 번째 응답 일봉 | **2011-08-18** |
| 실제 마지막 완료 일봉 | **2026-10-21** |
| 일봉 수 | **5,544개** |
| 수집 페이지 수 | **7개**, 페이지당 최대 1,000개 |
| 일봉 조회 시작 | 2026-10-22T10:09:39.166644Z |
| 일봉 조회 완료 | 2026-10-22T10:09:43.401279Z |
| 날짜 중복 / 범위 내부 날짜 누락 | **0 / 0** |
| 유효하지 않은 수치 / UTC 경계 위반 / OHLC 모순 | **0 / 0 / 0** |
| 공급자가 명시적으로 반환한 0 BTC 일봉 | **33개**; 첫 날짜 2011-08-23, 마지막 날짜 2015-01-08 |
| 앱이 추가·보간·추정한 봉 | **0개** |
| 완성된 UTC 주봉 | **791개**; 차트 날짜 2011-08-28~2026-10-18 |
| 집계에서 제외한 부분 주 | **2개**; 시작 부분과 마지막 미완료 주 |

2010년부터 요청했지만 첫 실제 응답은 2011-08-18이다. 이 날짜 이전의 거래량을 채우지 않는다. 33개의 0 BTC 봉은 공급자 원문에 있는 값이며, 누락 날짜에 앱이 0을 넣은 결과가 아니다. 원문이 제공하는 무거래 봉의 OHLC가 실제 개별 체결을 뜻한다고 추가 해석하지 않는다. 이 외에 향후 응답에 날짜 누락이 생기면 `coverage.gaps`에 기록하고 빈 구간으로 유지한다.

마지막 일봉의 원문 값은 open 82,946.02 USD, high 84,842.65 USD, low 82,552.76 USD, close 84,023.24 USD, volume **2,217.41055708 BTC**다. 첫 일봉의 volume은 **0.48990826 BTC**다. 이는 수집한 해당 거래소 관측값이며 예측 숫자가 아니다.

## 공식 문서에서 확인한 계약

### Bitstamp

원문: [Bitstamp Public API v2](https://www.bitstamp.net/api/), 실제 시장 메타데이터: [BTC/USD를 포함한 markets 응답](https://www.bitstamp.net/api/v2/markets/).

공식 OHLC 문서는 `step`을 초 단위, `start`와 `end`를 Unix timestamp로 정의한다. `limit`은 1~1,000이며 `exclude_current_candle=true`로 진행 중인 마지막 봉을 제외할 수 있다. **`start`와 `end`를 함께 주면 `end`가 우선한다.** 따라서 수집기는 페이지의 마지막 초인 `end=exclusiveEnd−1`과 정확한 개수의 `limit`만 보내고, 응답은 클라이언트에서 다시 `[requestedStart, requestedEnd)`로 자른다. 일봉 `step=86400`을 사용한다.

OHLC에는 timestamp/open/high/low/close/volume 문자열 필드가 있다. 공식 markets 응답의 `btcusd` 항목은 `base_currency=BTC`, `counter_currency=USD`, `market_type=SPOT`이다. 공식 주문 문서는 BTC/USD의 `amount`가 BTC라는 점도 설명한다. OHLC 설명 자체에 없는 단위 문구를 인용한 것처럼 쓰지 않고, 아래 공개 체결 amount 대조로 **OHLC volume이 BTC 수량이라는 해석을 직접 검증**했다.

실제 일봉 5,544개 모두 `timestamp % 86400 = 0`이었다. 실제 시간·분 봉 역시 해당 UTC 초 경계에 맞았으며, UTC 날짜별 합계가 일봉과 일치했다. 앱은 모든 날짜를 UTC로 처리하고 한국 시간의 자정으로 이동시키지 않는다.

### Coinbase: 기존 분·시간 봉과 비교 자료

원문:

- [Get product candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles)
- [Get product stats](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-stats)
- [Get single product](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-single-product)

캔들의 응답 항목은 `[time, low, high, open, close, volume]`이며 time은 구간 시작 시각이다. 공식 캔들 페이지의 도입부에는 volume을 생략한 5필드 예시가 있으나 같은 페이지의 Response Items는 6번째 volume을 설명한다. 구현은 실제 6필드 응답을 검증한다. 한 요청은 최대 300개이고, start/end보다 앞선 봉이 섞일 수 있다. 거래가 없는 구간에는 데이터가 게시되지 않을 수 있고 역사 데이터가 불완전할 수 있다는 경고가 공식 문서에 있다. 일반 product stats는 volume의 단위가 base currency임을 명시하며 BTC-USD의 base는 BTC, quote는 USD다.

Coinbase는 진행 중인 봉의 제외를 보장하는 이 옵션을 제공하지 않으므로 앱은 `bucketStart + duration <= cutoff`를 적용한다. 2026-10-22 조사 중 새 역사 요청이 HTTP 403으로 거부되어 해당 소스의 추가 접근을 중단했다. Bitstamp는 별도의 공식 공개 거래소 소스로 선택했다. 기존 `dist/data/btc-ohlc.json`에 저장돼 있던 Coinbase 관측값만 아래 비교에 사용했으며, 이 작업의 갱신 스크립트는 Coinbase에 새 요청을 보내지 않는다.

### Kraken: 독립 거래소 대조

원문: [Get OHLC Data](https://docs.kraken.com/api-reference/market-data/get-ohlc-data), [WebSocket OHLC의 base currency volume 정의](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/ohlc).

Kraken OHLC의 마지막 항목은 진행 중인 봉이며 항상 응답에 포함될 수 있으므로 반드시 제외한다. 문서는 최근 데이터 조회 한도를 720개로 설명하며 `since`로 무제한 과거 이력을 얻을 수 있다고 보장하지 않는다. 이번 실제 응답은 **721개**였고 그중 마지막 **1개가 미완료 2026-10-22**였다. 이 관측된 응답 개수도 metadata에 그대로 기록했으며, 일치시킬 목적으로 문서 숫자에 맞춰 바꾸지 않았다. 비교는 양쪽에 실제로 존재하는 완료 UTC 날짜만 사용했다. `XBT/USD`는 Kraken의 비트코인/달러 시장 명칭이다.

## 검증 1: Bitstamp 일봉과 시간·분 봉

2026-10-15~2026-10-21 **7개 완료 UTC 날짜**를 검증했다. 거래량은 소수 문자열을 정수 satoshi로 변환한 뒤 합산했다. Python `Decimal`의 독립 계산에서도 같은 결과를 얻었다. JavaScript binary float의 작은 반올림을 일치 판정에 사용하지 않는다.

| UTC 날짜 | Bitstamp 일봉 BTC | 24개 1시간 봉의 합계 BTC | 96개 15분 봉의 합계 BTC | 양쪽 차이 |
|---|---:|---:|---:|---:|
| 2026-10-15 | 1,976.15882368 | 1,976.15882368 | 1,976.15882368 | 0.00000000 |
| 2026-10-16 | 1,375.09651575 | 1,375.09651575 | 1,375.09651575 | 0.00000000 |
| 2026-10-17 | 501.70221150 | 501.70221150 | 501.70221150 | 0.00000000 |
| 2026-10-18 | 806.70276955 | 806.70276955 | 806.70276955 | 0.00000000 |
| 2026-10-19 | 1,069.61348087 | 1,069.61348087 | 1,069.61348087 | 0.00000000 |
| 2026-10-20 | 1,386.33955218 | 1,386.33955218 | 1,386.33955218 | 0.00000000 |
| 2026-10-21 | 2,217.41055708 | 2,217.41055708 | 2,217.41055708 | 0.00000000 |

총 168개 1시간 봉, 672개 15분 봉이다. 각 날짜의 첫 open, 마지막 close, 전체 high 최댓값, 전체 low 최솟값도 해당 일봉과 **모두 일치**했다. 일부 최근 날짜에 대한 이 교차 검증이 15년 전체 역사 데이터의 외부 감사를 대체하지는 않는다.

조회 원문 URL:

- [7일의 1시간 봉](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=3600&limit=168&end=1792627199&exclude_current_candle=true)
- [7일의 15분 봉](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=900&limit=672&end=1792627199&exclude_current_candle=true)

조회 시각은 각각 2026-10-22T10:09:43.626936Z, 10:09:43.980778Z다. URL, 원문 HTTP 응답 SHA256, 비교에 사용한 실제 OHLCV 문자열이 `validation.evidence`에 보존되어 있다.

## 검증 2: 공개 체결 amount와 BTC 단위

[Bitstamp 최근 1시간 공개 체결](https://www.bitstamp.net/api/v2/transactions/btcusd/?time=hour)에서 1,709개 체결을 받았다. 부분적으로만 관측된 양 끝 분을 제외하고, **2026-10-22 09:11~10:09 UTC의 완료 59개 분**에 들어 있는 **1,680개 체결**의 amount를 분별로 합산했다. 이 합계는 [같은 59개 1분 봉의 volume](https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=60&limit=59&end=1792663799&exclude_current_candle=true)과 모든 분에서 정확히 일치했다. 최대 절대 차이는 **0.00000000 BTC**다.

이는 `amount × price`의 달러 거래대금과 혼동하지 않았는지 확인하는 독립 검사다. 체결 조회는 10:10:24.150172Z, 비교용 1분 봉 조회는 10:13:04.252745Z였다. rolling `time=hour` URL을 나중에 다시 호출하면 다른 체결이 나오므로, 당시 체결 시각·amount·price와 1분 봉의 실제 문자열을 저장본에 함께 보관했다. 재검증은 이 고정된 witness를 사용한다.

## 검증 3: 거래소 간 동일 날짜 대조

[Kraken 공식 XBTUSD 일봉](https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440)을 2026-10-22T10:05:49.009565Z에 조회했다. 아래 수량은 각각의 거래소에서 실제 거래된 BTC다.

| UTC 날짜 | Bitstamp BTC | Kraken BTC | Bitstamp / Kraken |
|---|---:|---:|---:|
| 2026-10-15 | 1,976.15882368 | 3,383.70771244 | 58.402% |
| 2026-10-16 | 1,375.09651575 | 2,089.31653422 | 65.816% |
| 2026-10-17 | 501.70221150 | 599.41582348 | 83.699% |
| 2026-10-18 | 806.70276955 | 987.19935401 | 81.716% |
| 2026-10-19 | 1,069.61348087 | 1,935.31505932 | 55.268% |
| 2026-10-20 | 1,386.33955218 | 2,159.91581201 | 64.185% |
| 2026-10-21 | 2,217.41055708 | 2,408.72406782 | 92.057% |

이 7일 비율의 중앙값은 **65.816%**다. 또한 기존 Coinbase 일봉 저장본과 겹치는 **2026-04-25~10-21의 180개 날짜**를 비교한 Bitstamp/Coinbase 비율은 **최소 8.906%, 중앙값 19.450%, 최대 44.249%**다. 중앙값은 날짜별 비율 180개의 중앙값이며 총합 비율이 아니다.

**거래소별 물량은 다르며, 거래소 간 수량 일치는 검증 조건이 아니다.** 동일 상품·BTC 단위·UTC 날짜·완료 구간인지를 확인하고 서로 다른 거래소의 실제 시장 범위를 보여주는 비교다. 이 비율로 Bitstamp를 전체 시장으로 확대하지 않았고, 세 거래소 물량을 전 세계 합계라고 더하지도 않았다.

## 기존 Coinbase 저장본에서 발견한 차이

Coinbase 저장본의 일봉 조회 시각은 2026-10-22T09:23:06.318Z다. 같은 저장본의 1시간 봉에는 7개 완료 날짜, 15분 봉에는 1개 완료 날짜가 존재한다. OHLC 가격은 일봉과 모두 일치했지만 다음 수량 차이를 발견했다. 부호는 **작은 봉 합계 − 일봉**이다.

| 비교 | UTC 날짜 | 거래량 차이 BTC | 일봉 대비 차이 |
|---|---|---:|---:|
| 24 × 1시간 vs 일봉 | 2026-10-16 | +1.20975273 | +0.023802943% |
| 24 × 1시간 vs 일봉 | 2026-10-17 | −0.05674176 | −0.003001633% |
| 24 × 1시간 vs 일봉 | 2026-10-19 | +0.00222881 | +0.000046843% |
| 96 × 15분 vs 일봉 | 2026-10-21 | +1.09535171 | +0.014329712% |

나머지 완료 1시간 비교 날짜의 수량 차이는 0 BTC였다. 차이의 원인이 공급자의 재집계, 과거 데이터 정정, 다른 내부 처리인지 현재 확보된 응답만으로 확정할 수 없다. 재조회 차단을 우회하거나 한 해상도를 다른 해상도에 맞춰 보정하지 않았다. 저장본은 `cachedCoinbase.nativeResolution.*.status=DIFFERENCES_OBSERVED`로 명시한다. 새 Bitstamp 일봉/주봉 계열의 검증 PASS와 이 보조 자료의 차이는 구분된다.

## 완료 봉, 주봉, 표시 범위 계약

`dist/volume-data.js`는 외부 상태를 변경하지 않는 정규화·집계·필터 함수와 별도 수집 함수를 제공한다.

- `normalizeDailyVolume(payload, {source, now, asOf, start, end})`: 기본 source는 Bitstamp. `.bars` 배열을 가진 계열 객체를 반환한다. Bitstamp native 문자열 객체, 또는 source를 명시한 Coinbase native 6필드 배열을 처리한다. `now`는 밀리초, start는 포함, end는 제외, asOf는 포함하는 UTC 날짜다.
- `parseVolumeSnapshot(payload, {asOf, now})`: 같은 계열 객체를 반환한다. 저장 당시 `retrievedAt`을 유지하며 공급자·상품·단위·OHLC·봉 경계·중복·coverage를 검증한다. 표시용 asOf가 더 이르면 뒤의 봉을 제거한다.
- `aggregateWeeklyVolume(dailyBars, {source, asOf, now})`: `.bars` 배열을 가진 주봉 객체를 반환한다. UTC 월요일부터 일요일까지 **연속한 완료 일봉 7개가 모두 있을 때만** 합산한다. 일봉이 빠진 주, 시작 부분 주, 진행 중인 주는 생성하지 않는다.
- `filterVolumeForView(bars, {start, end, asOf})`: 실제로 있는 일봉 또는 주봉 중 표시 날짜 범위만 돌려준다. 이 함수의 end는 표시용 포함 경계다. 출처 이전, 가격 관측 cutoff 이후, 미래 예측 구간의 거래량을 만들지 않는다.
- `fetchDailyVolumeHistory(...)`: 기본 Bitstamp 공식 공개 API를 페이지로 읽는다. 인증정보, 재시도, 묵시적 거래소 변경을 사용하지 않는다. 명시적인 다른 provider 처리는 코드 수준에서 지원하지만 이번 수집·갱신은 Bitstamp로 고정된다.

일봉 각 항목은 `{time, date, open, high, low, close, volume}`이다. `time`은 UTC 시작 Unix 초, `date`는 `YYYY-MM-DD`다. 주봉은 `time=월요일 00:00 UTC`, `date=일요일`의 차트 표시 날짜를 사용하며 `startDate`, `endDate`, `daysIncluded:7`, `complete:true`도 포함한다. 거래량은 합, open은 첫날, close는 마지막 날, high/low는 7일의 극값이다. 저장본에서 제공하는 조회 시각·URL은 집계 결과를 표시할 때 원본 계열의 메타데이터와 함께 사용한다.

봉을 포함하려면 `bucketStart + duration <= now`여야 한다. 일봉의 최종 cutoff는 `min(asOf, UTC 어제)`다. 예를 들어 원래 종가 선/예측의 실제 관측 마지막 날짜가 2026-10-20이면 해당 차트에 붙이는 거래량도 **10-20까지**로 자른다. 별도 실제 캔들 화면이 10-21 완료 일봉까지 표시하는 경우는 그 관측 범위를 사용한다. 분·시간 봉에서 오늘의 이미 완료된 실제 봉을 표시하는 것과 미래 거래량을 합성하는 것은 서로 다른 경우다.

## 재현 방법과 갱신

Node 24 이상에서 실행한다. 정상적인 공개 네트워크 연결이 있는 GitHub runner의 기본 갱신 명령은 다음과 같다.

```sh
node scripts/refresh-volume.mjs
node scripts/refresh-volume.mjs --verify
node --test tests/volume-data.test.mjs
```

첫 명령은 Bitstamp 일봉 전체를 다시 읽고, 마지막 7개 완료 날짜의 native 1시간/15분 봉, Kraken 독립 일봉, Bitstamp 시장 정보와 최근 체결/1분 봉을 함께 검증한 다음 저장한다. 오래된 Coinbase 저장본은 로컬 비교 자료로만 읽는다. `--as-of YYYY-MM-DD`로 완료일 상한을 지정할 수 있으며 **최근 Kraken 공개 조회 범위 안에서** 교차 검증할 수 있는 날짜여야 한다. 해당 소스에 실패하거나 주요 Bitstamp 합계가 맞지 않으면 명령을 실패 처리하고 잘못된 성공 저장본으로 바꾸지 않는다. 네트워크 거부를 숨기는 다른 거래소 재시도나 접근 방식 변경은 없다.

`--verify`는 네트워크 요청 없이 저장본에 포함된 실제 witness로 사토시 합계, OHLC 일치, 비교 지표, SHA256을 다시 계산한다. 저장본이 이후 수집으로 바뀌면 지표도 그 실제 수집에 따라 바뀐다. 문서의 위 표는 **2026-10-22에 검증한 고정 시점의 결과**다.

이번 환경의 승인된 공개 HTTPS 수집은 Python 표준 HTTP 클라이언트로 수행했다. 기록한 원문을 정확히 재생해 생성하는 기능도 있다.

```sh
node scripts/refresh-volume.mjs --input /tmp/btc-volume-research/bitstamp-history-raw.json --checks-dir /tmp/btc-volume-research
```

위 임시 수집 디렉터리는 개발 당시의 원문 기록이다. 다른 환경에서 해당 경로가 존재한다고 가정하지 않는다. 배포 저장본에는 전체 일봉, 각 페이지의 정확한 요청 URL·원문 SHA256·조회 시각, 재검증에 필요한 시간·분·체결·독립 거래소 witness가 있으므로 일반 재현은 `--verify`로 수행할 수 있다. 원문 HTTP 바이트 SHA256이 확보되지 않았던 최초 Kraken 응답은 `responseSha256:null`로 표시했다. Coinbase는 HTTP 원문 해시라고 부르지 않고 로컬 파일의 `artifactSha256`을 기록한다.

이번 일봉 정규화 배열의 SHA256(`JSON.stringify(bars)`)은 다음과 같다.

```text
4ffd8c868ccc1d5d4b3eecea948499dc907c051c7454af5a23d4f981425e2af5
```

검증 명령의 실제 결과: **PASS**, 일봉 5,544개, gap 0, 1시간 합계 7일, 15분 합계 7일, 체결 단위 대조 59분, 독립 거래소 대조 7일. 동작 테스트는 13개 케이스로 원문 필드, 단위 구분, 잘못된 값 거부, 0과 누락의 구별, 완료 경계, 저장본 검증, UTC 주봉, 빠진 날, 미래 필터, 페이지 경계, HTTP 실패와 중단을 검증했다.

이 검증은 데이터를 올바르게 읽고 합산하고 출처를 설명한다는 근거다. 거래소가 보고한 모든 과거 거래를 외부에서 완전히 감사했다는 뜻, 전체 비트코인 시장 거래량을 확보했다는 뜻, 또는 거래량만으로 미래 가격을 검증했다는 뜻으로 확대하지 않는다.
