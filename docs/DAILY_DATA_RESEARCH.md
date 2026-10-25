# 일별 원자료, 수익률 비교와 최대낙폭 연구

확인일은 2026-10-25 KST이다. 계산 기준은 저장소 `aa73c8c96be7679ef2b5d8e8adde1887a2544475`의 관측 파일이다. 이 문서는 첨부 이미지의 숫자를 복사하는 대신, 가격 정의와 계산식을 확인하고 저장된 관측을 독립적으로 재계산한 기록이다. 구현 테스트나 매매 수익성 검증을 통과했다는 뜻은 아니다.

## 참고 이미지에서 채택할 구성

첫 이미지는 자산을 행, 연도를 열로 놓고 각 기간 수익률을 초록·빨강으로 나타낸다. 최신 연도는 연초 이후 수익률이며, 마지막 열은 누적 수익률과 연평균 수익률이다. BTC 행을 강조한다. 이 표의 초록은 양의 과거 수익률이지 앞으로 사야 한다는 뜻으로 정의되어 있지 않다. 두 번째 이미지는 종목별 표본 기간과 상승·하락폭 비교를 위한 보조 참고다.

두 이미지에는 계산에 사용한 원시 관측, 가격 공급자, 배당 처리와 정확한 기준 시각이 없다. 따라서 기존 사이트에서 검증 가능한 BTC·ETH·MSTR·BMNR 관측을 같은 규칙으로 집계하고, 표의 구조와 시각적 비교 방식을 적용한다. 이미지에 등장하는 ETF 수치를 새 원자료인 것처럼 입력하지 않는다.

## 1차 출처와 확인 범위

| 출처 | 실제 확인 내용 | 적용 범위 |
| --- | --- | --- |
| [Coin Metrics Price 문서](https://docs.coinmetrics.io/network-data/network-data-overview/market/price) | `PriceUSD`의 일별 값은 표시된 UTC 날짜가 끝날 때의 달러 기준 가격이다. Reference Rate와 타임스탬프 관례가 다르다. | BTC 일별 날짜와 종가 정의. |
| [Coinbase Exchange 캔들 문서](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) | `time`은 버킷 시작, `close`는 버킷의 마지막 체결 가격이다. 틱이 없으면 캔들을 발행하지 않으며 역사 자료가 불완전할 수 있다. | ETH의 거래소 관측, BTC 교차검증, 결측 처리. |
| [MSCI IndexMetrics, 2020-06, pp. 29·51](https://www.msci.com/documents/10199/402635a5-fd5d-498e-985a-1bec8ff8d8b1) | 최대낙폭은 분석 기간 내 선행 고점에서 후행 저점까지의 최대 손실이다. 문서의 위험표는 낙폭을 음수로 표시한다. | 순서가 보존된 DD/MDD 계산과 표시 부호. |
| [GIPS Standards Handbook for Firms, 2.A.12·4.B.3](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/) | 연율화는 기하평균의 복리 수익률이다. 1년 미만 수익률의 연율화는 해당 실적을 가상의 1년 실적으로 외삽한다. | CAGR와 YTD 분리, 부분 기간 표시. 본 사이트의 GIPS 준수를 주장하는 것은 아니다. |
| [Fidelity RSI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI) | RSI는 0~100 모멘텀 지표이며 70/30이 일반적인 과열·침체 기준이다. 강한 추세에서는 극단 상태가 오래 지속될 수 있다. | RSI만으로 확정적인 매수·매도를 표시하지 않는 근거. |
| [Fidelity SMA](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/sma) | SMA는 지정 관측 기간 가격의 평균이다. 50·200봉은 중기·장기 추세의 흔한 기준이며 긴 기간에는 후행성이 커진다. | 관측 수 기반 이동평균, 추세 확인. |
| [Yahoo Adjusted Close 설명](https://in.help.yahoo.com/kb/adjusted-close-sln28256.html) | 공식 검색 색인에서 분할과 배당을 반영한 adjusted close 설명 확인. 본문 직접 조회는 429 응답으로 제한됐다. 저장소도 `close`와 `adjustedClose`를 별도로 보존한다. | Yahoo 조정종가와 OHLC 종가를 혼합하지 않는 자료 계보 확인. |

외부 출처는 지표 정의를 뒷받침한다. 본 사이트의 특정 매수·중립·매도 조합이나 임계값이 높은 수익을 낸다고 증명하지 않는다. 선택한 규칙은 제품의 명시적 가정이며 별도 검증 대상이다.

## 실제 읽은 저장소 자료

- `dist/app.js`의 기존 `export-raw` 처리와 `dist/index.html`의 `data-view`: BTC 일자·가격·전일 대비·지표 네 열과 BTC CSV를 확인했다.
- `dist/data-source.js`: 완료된 UTC 가격을 수집하는 경계와 Coin Metrics 공급자를 확인했다.
- `dist/equity-market-data.js`의 `parseYahooEquity`·`parseEquityArchive`: OHLC는 제공자 분할조정 기준이고 `adjustedClose`는 별도로 저장한다. 주식의 날짜는 뉴욕 거래 세션 날짜다. 주말 관측을 만들지 않는다.
- `dist/eth-market-data.js`의 `parseEthArchive`: Coinbase ETH-USD 완료 일봉만 사용하며 보간하지 않는다. 일별 결측이 존재할 수 있다.

## 계산 규약

모든 `P`는 유효한 양수의 실제 관측 종가다. 가격수익률은 세금·거래비용·배당·대여수익·스테이킹 수익을 포함하지 않는다. 주식은 제공자 분할조정 종가를 사용한다. 배당 재투자 총수익률을 표시하려면 별도의 일관된 총수익 자료가 필요하다.

| 지표 | 규칙 | 표시 시 필요한 정보 |
| --- | --- | --- |
| 직전 관측 대비 | `100 × (P_t / P_prev - 1)` | 직전 관측일. 주식은 직전 거래일, 암호자산 결측 구간은 여러 날의 변화다. |
| 연간 수익률 | `100 × (P_year_end / P_previous_year_end - 1)` | 전년 마지막 유효 종가와 해당년 마지막 유효 종가의 날짜. |
| YTD | 같은 식의 분자를 최신 완료 관측으로 사용 | 기준 연도와 마지막 관측일. 연간 실적과 구별한다. |
| 첫 부분 연도 | 전년 말 관측이 없으면 최초 관측부터 계산하거나 미제공 | `부분기간` 표시와 최초 관측일. 온전한 연간 수익률처럼 표시하지 않는다. |
| 누적 수익률 | `100 × (P_end / P_start - 1)` | 두 실제 기준일. 연간 수익률의 합이 아니다. |
| CAGR | `100 × ((P_end / P_start)^(1 / years) - 1)` | `years = 실제 경과일 / 365.2425`로 규약을 명시. 1년 미만은 제공하지 않는 것을 권장한다. |
| 당시 고점 대비 DD | `100 × (P_t / max(P_s, s≤t) - 1)` | 실제 관측 이력 시작 이후의 고점이며 미래 고점을 사용하지 않는다. |
| 기간 MDD | 해당 창에서 위 DD의 최솟값 | 창 시작·끝, 선행 고점 날짜, 후행 저점 날짜, 종가 기준 여부. |

연도별 MDD를 전년 말 투자 시점부터 측정할 때는 전년 마지막 종가를 첫 기준점으로 포함한다. 해당 연도 일봉만을 기점으로 삼으면 연초 갭 하락이 누락된다. 전체 이력 MDD와 연도 MDD는 계산 창이 다르므로 같은 값처럼 표시하지 않는다.

고가·저가가 있는 일봉에서 같은 날의 고가가 저가보다 먼저 발생했는지는 알 수 없다. 이번 표는 확정된 일별 종가 시퀀스로 MDD를 정의한다. 따라서 장중 최대 손실과 다르며, `종가 기준`을 표시한다. 단순히 전체 최저가를 전체 최고가로 나누면 선후 관계가 뒤집히는 오류가 생긴다.

일별 DD·이동평균·RSI·판정은 전체 과거 시퀀스에서 계산한 뒤 화면의 연도·페이지 필터를 적용해야 한다. 1월부터 데이터를 잘라 먼저 계산하면 이전 고점이 사라지고 지표의 준비 기간도 다시 시작된다. 미래 데이터를 덧붙여도 이미 지나간 날짜의 판정은 변하지 않아야 한다.

## 독립 계산 결과와 이미지 대조

Python으로 저장소의 JSON을 직접 읽었다. 수익률은 연말 종가 비율, MDD는 시간 순서의 누적 최고가와 현재 종가를 순회하며 계산했다. 이 계산은 구현 중인 자바스크립트 함수를 호출하지 않았다.

| 자산 | 관측 범위 | 관측 수 | 전체 이력 MDD | 고점 → 저점 | 최신 DD |
| --- | --- | ---: | ---: | --- | ---: |
| BTC | 2010-07-18~2026-10-23 | 5,942 | -92.748633% | 2011-06-08 → 2011-11-18 | -35.169607% |
| ETH | 2016-05-18~2026-10-23 | 3,809 | -94.011630% | 2018-01-13 → 2018-12-14 | -50.646625% |
| MSTR | 1998-06-11~2026-10-23 | 7,137 | -99.856230% | 2000-03-10 → 2002-07-26 | -69.185151% |
| BMNR | 2025-06-05~2026-10-23 | 349 | -90.140740% | 2025-07-03 → 2026-06-30 | -83.407408% |

ETH 최초 자료에는 이틀의 결측이 있다. MSTR의 전체 이력 MDD는 BTC 보유 전략 도입 훨씬 전 닷컴 시기를 포함한다. BMNR은 이 자료에 없는 과거 OTC 시기까지 전 역사를 대표하지 않는다. 화면의 연도 열을 2011년 이후로 제한해도 별도로 표시한 ‘전체 누적·전체 CAGR·전체 MDD’는 각 자산의 전체 관측 이력을 유지한다. 실제 시작일과 종료일을 표시하므로, 이 세 요약 열을 같은 기간에 대한 자산 간 순위로 해석하면 안 된다. 연도별 셀의 수익률과 MDD는 해당 연도 및 직전 연말 기준 종가로 계산한다.

| BTC 연도 | 원자료로 재계산 | 이미지 판독값 |
| --- | ---: | ---: |
| 2011 | +1,471.435444% | 약 +1,473% |
| 2012 | +187.328644% | 약 +186% |
| 2013 | +5,285.956652% | 약 +5,507% |
| 2014 | -56.047022% | 약 -58% |
| 2015 | +33.996784% | 약 +35% |
| 2016 | +125.511315% | 약 +125% |
| 2017 | +1,336.728904% | 약 +1,331% |
| 2018 | -73.514312% | 약 -73% |
| 2019 | +94.385853% | 약 +95% |
| 2020 | +304.926353% | 약 +301% |
| 2021 | +59.720367% | 약 +66% |
| 2022 | -64.352980% | 약 -65% |
| 2023 | +155.486579% | 약 +156% |
| 2024 | +121.212737% | 약 +121% |
| 2025 | -6.288437% | 약 -6.3% |
| 2026 YTD, 10-23까지 | -7.533160% | 약 -7.6%, 기준일 미상 |

2010-12-31의 $0.30부터 2026-10-23의 $80,924.1837657744까지 누적 가격수익률은 +26,974,627.921925%다. 두 날짜 사이 5,775일과 위 day-count 규약을 적용한 CAGR는 +120.537958%다. 이미지에는 누적 약 +26,952,245%, 연평균 약 +121.7%가 보인다. 기준일과 계산 관례가 확인되지 않아 이미지를 오류로 단정하지 않으며, 원자료를 그 값에 맞춰 조정하지 않는다.

## Coinbase 독립 관측 교차검증

2026-10-25 KST에 Coinbase 공개 API를 실제 조회했다. 대상은 BTC-USD, `granularity=86400`이며 각 날짜 00:00 UTC부터 다음 날 00:00 UTC까지 조회한 후, 반환 배열에서 정확히 해당 시작 타임스탬프인 캔들을 선택했다. Coinbase의 단일 거래소 마지막 체결가와 Coin Metrics 기준 가격은 정의가 다르므로 완전 일치가 요구되는 자료는 아니다.

| 날짜 | Coin Metrics 번들 USD | Coinbase 종가 USD | Coinbase / Coin Metrics - 1 |
| --- | ---: | ---: | ---: |
| 2020-12-31 | 29,022.6714126242 | 28,990.08 | -0.112296% |
| 2021-12-31 | 46,355.1173302747 | 46,211.24 | -0.310381% |
| 2023-12-31 | 42,217.1587913501 | 42,288.06 | +0.167944% |
| 2024-12-31 | 93,389.7326016949 | 93,354.22 | -0.038026% |
| 2025-12-31 | 87,516.9780376972 | 87,497.94 | -0.021754% |
| 2026-10-23 | 80,924.1837657744 | 81,078.04 | +0.190124% |

Coinbase 종가만으로 계산한 2021년 수익률은 +59.403630%다. 이미지의 +66%를 이 두 가격 기준에서 재현하지 못했다. 이 결과는 여섯 날짜의 제한된 비교이며, 전체 역사나 모든 자산의 외부 재검증을 의미하지 않는다. [JSON 검증 기록](data/daily-data-crosscheck-2026-10-25.json)에 입력 리비전·파일 SHA-256·관측 범위, 실제 요청 URL·조회 시각·HTTP 상태·응답 SHA-256과 선택한 캔들을 보존했다.

재현 URL 형식은 다음과 같다. `DATE`와 `NEXT_DATE`는 위 표의 날짜와 그 다음 UTC 날짜다.

```text
https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=DATET00:00:00Z&end=NEXT_DATET00:00:00Z
```

실제 조회 예시는 [2021-12-31](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2021-12-31T00:00:00Z&end=2022-01-01T00:00:00Z)과 [2026-10-23](https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=2026-10-23T00:00:00Z&end=2026-10-24T00:00:00Z)이다.

## 매수·중립·매도 표시의 해석

수익률 셀은 실제 상승·하락의 크기를 표현하고, 판단 셀은 명시한 규칙의 충족 여부를 표현한다. 색상만 사용하지 말고 `매수 검토`, `중립`, `매도 검토`, `자료 부족` 등의 텍스트를 함께 제공한다. `자료 부족`은 `중립`의 수치 값 0으로 대체하지 않는다.

추세 확인에는 50·200 관측 SMA를 사용할 수 있다. 가격, 중기 평균, 장기 평균이 같은 방향을 가리킬 때 조건 충족으로 분류하고, 조건이 섞이면 중립으로 남기는 방식은 재현 가능하다. RSI의 과열·침체를 추가하더라도 그것만으로 반전을 확정하지 않는다. 큰 MDD는 이미 발생한 하락을 나타내므로 단독으로 매수 조건이 될 수 없다. 정확한 조합과 임계값은 구현의 규칙표에서 공개한다.

이 신호는 해당 날짜 종가가 확정된 뒤에야 알 수 있다. 같은 종가로 체결할 수 있다고 가정하는 백테스트는 미래 정보 이용을 일으킬 수 있다. 수익성 검증을 추가하려면 다음 거래 가능한 시점, 수수료·슬리피지, 외부 검증 기간, 매수 후 보유 대조군을 정해야 한다. 이번 정의 확인과 여섯 날짜 교차검증으로 신호의 적중률이나 기대 수익률을 주장하지 않는다.

## 판별 테스트

| 입력 또는 조작 | 반드시 확인할 결과 |
| --- | --- |
| 순차 가격 `[100, 50, 200, 190]` | MDD -50%. 미래의 200을 과거 50과 엮어 -75%로 만들지 않는다. |
| 전년말 100, 연초 첫날 120, 연말 180 | 연간 수익률 +80%. +50%는 연초 첫 관측 이후의 다른 기간이다. |
| 가격 `[100, 120, 90, 150, 105]` | MDD -30%, 최신 DD -30%. 중간 -25%보다 깊은 마지막 손실을 기록한다. |
| 가격 `[100, 50, 100]` | 누적 수익률 0%, MDD -50%, 회복 상승률 +100%. 산술 평균 +25%를 CAGR로 표시하지 않는다. |
| 연도·페이지 필터 전후 같은 날짜 | 해당 날짜의 DD·SMA·RSI·판정이 동일하다. |
| 미래에 거대한 가격 관측을 추가 | 과거 일별 값과 과거 판정이 변하지 않는다. |
| 첫 199개 관측, SMA 200 규칙 | 매매 판단은 자료 부족. 200번째 이후 필요한 모든 지표 준비 여부를 확인한다. |
| 중복 날짜·역순·NaN·Infinity·0·음수 가격 | 유효 관측처럼 계산하지 않는다. 입력 경계에서 거절하거나 분명한 오류로 표시한다. |
| 주말·거래소 휴장·암호자산 결측 | 가격을 보간해 관측 수를 늘리지 않는다. 직전 관측의 실제 날짜가 유지된다. |
| 미래 예측선·가정 범위 데이터 혼입 | 원자료 표와 과거 수익률·MDD에서 배제한다. |
| 서로 다른 이력 길이 | 누적·CAGR·MDD의 실제 시작일을 표시한다. 동일 기간 순위라고 암시하지 않는다. |

## 독립 산식 재현

저장소 루트에서 아래 Python을 실행하면 해당 JSON 검증 기록의 입력 파일 SHA-256과 전체 이력 MDD, 최신 DD, BTC 연간 수익률을 다시 검증한다. 미래에 데이터 파일이 갱신된 경우에는 기록된 `inputRevision`에서 실행해야 한다. 파일 해시가 다르면 과거 검증 기록을 새 데이터의 검증으로 재사용하지 않는다.

```python
import hashlib
import json
import math
from pathlib import Path

receipt = json.loads(Path("docs/data/daily-data-crosscheck-2026-10-25.json").read_text())
for asset in receipt["assets"]:
    raw = Path(asset["input"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == asset["inputSha256"]
    payload = json.loads(raw)
    if asset["symbol"] == "BTC":
        rows = payload["prices"]
    else:
        candles = payload["dailyHistory"]["candles"] if asset["symbol"] == "ETH" else payload["candles"]
        rows = [(c["date"][:10], c["close"]) for c in candles]
    peak, mdd, peak_date, mdd_dates = 0, 0, None, None
    previous_date = ""
    year_ends = {}
    for date, price in rows:
        assert date > previous_date and math.isfinite(price) and price > 0
        previous_date = date
        year_ends[date[:4]] = (date, price)
        if price > peak:
            peak, peak_date = price, date
        drawdown = price / peak - 1
        if drawdown < mdd:
            mdd, mdd_dates = drawdown, (peak_date, date)
    assert math.isclose(100 * mdd, asset["allHistoryMaxDrawdownPct"], abs_tol=1e-10)
    assert mdd_dates == (asset["maxDrawdownPeakDate"], asset["maxDrawdownTroughDate"])
    assert math.isclose(100 * (rows[-1][1] / peak - 1), asset["latestDrawdownPct"], abs_tol=1e-10)
    for annual in asset["annualPriceReturns"] or []:
        before = year_ends[str(annual["year"] - 1)]
        after = year_ends[str(annual["year"])]
        assert math.isclose(100 * (after[1] / before[1] - 1), annual["returnPct"], abs_tol=1e-10)
    print(asset["symbol"], len(rows), "independent price statistics verified")
```

이 문서는 연구 역할의 독립 수치 계산과 자료 조회 결과다. 최종 구현 및 브라우저 동작 검증 결과는 별도 배포 기록에서 확인한다.
