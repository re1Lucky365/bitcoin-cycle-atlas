# 자료 읽기 우선순위와 출처 계보

**조사 기준: 2026-10-21 UTC · 가격의 마지막 완료 관측: 2026-10-20**

이 문서는 [자료 카탈로그](../dist/evidence-catalog.js)의 **50개 대표 독서 항목과 18개 보조 링크, 총 68개의 서로 다른 기존 조사 URL**을 설명한다. 새로운 시장 주장이나 검증되지 않은 출처를 추가하지 않았다. 원문·해석·전달 경로를 모두 보존하되 API의 분할 요청, 같은 스레드의 하위 댓글, 첨부 차트, 일반 안내 링크는 대표 항목 아래 묶었다.

## 1. 순위를 정한 기준

**rank는 읽는 순서다. 사실일 확률, 적중률, 통계적 신뢰도, 투자 권고 순위가 아니다.** 1~50의 연속 정수이며 서열의 간격도 측정된 크기가 아니다. 어느 기관이 유명한지, 사용자 견해에 찬성하는지, 추천 수나 팔로어가 많은지는 순위의 근거로 사용하지 않았다.

다음 원칙을 함께 적용했다.

1. **재현성:** 가격 원자료와 정의를 먼저 읽어 누구나 같은 날짜·가격 계산에 도달할 수 있게 한다. 온체인 해석이나 차트 패턴보다 사건 정의가 앞선다.
2. **원문성:** 발행자 연구를 재전재보다 앞에 둔다. 다만 원문이 읽히지 않으면 직접 읽을 수 있는 당시 검증 보도를 먼저 배치하고 원문 주소를 바로 연결한다.
3. **사전성:** 관측 시점, 전망 공개 시점, 예측 대상 시점을 구분한다. 사후 연구가 과거 날짜에 부여한 점수를 당시 공개 예측으로 해석하지 않는다.
4. **직접 관련성:** 7월의 고점권 형성, 최종 최고가 날짜, 다음 저점 시점 중 무엇을 설명하는 자료인지 명시한다. 주기 붕괴나 시장 성숙이라는 넓은 표현을 일괄 단축의 증거로 대체하지 않는다.
5. **반증 가능성:** 이전 오류와 반대 전망을 함께 읽는다. 같은 기관의 성공한 주장만 골라내거나 원래의 최종고점 예측을 고점권 예측으로 바꾸지 않는다.

출처를 단일 가중 점수로 환산하지 않았다. 사전 예측이어도 사건 정의가 모호하거나 원문 접근이 제한되면 강한 근거가 되지 않는다. 반대로 사후 연구여도 과거 현상을 설명하는 데는 유용하지만 미래 예측력을 자동으로 얻지는 않는다.

## 2. 권장 읽기 단계

| 단계 | 순위 | 목적 |
|---|---:|---|
| 원자료·정의 | 1–7 | 가격·날짜·산출 방식·검증법을 고정한다. 같은 사건을 다른 정의로 비교하는 오류를 먼저 제거한다. |
| 동시대 관측 | 8–11 | 2025년 7~9월 당시에 작성된 과열·분산·횡보 관찰을 읽는다. 결과를 알고 난 뒤 만든 서사와 구별한다. |
| 사전 시나리오 | 12–18 | 대상 고점 또는 저점이 관측되기 전에 제시된 시나리오를 읽는다. 지지와 반대 방향을 함께 배치한다. |
| 반론·수정 이력 | 19–28 | 시간 유지·진폭 축소의 반론, 당시 잘못된 방향 전망, 동일 작성자의 오류 인정을 확인한다. |
| 사후 모형 | 29–34 | 관측 이후의 온체인 진단·저점 점수·회복 분석을 읽는다. 사전 예측으로 소급하지 않는다. |
| 소셜·재전파 | 35–46 | 원주장의 요약·번역·토론을 비교한다. 직접 댓글, 부분 접근, 삭제 자료의 범위를 표시한다. |
| 원사이트 맥락 | 47–50 | 비교 도구의 원래 목적과 복원 범위를 확인한다. 시장 예측의 근거로 격상하지 않는다. |

시나리오 단계에는 4분기 고점을 예상한 반대 견해도 들어 있다. 반론 단계의 자료가 모두 사후 발표인 것도 아니다. **role은 읽는 목적이고 timing은 관련 사건에 대한 시간 관계**이므로 두 필드는 서로 다르다.

## 3. 등급·시점·찬반의 의미

### tier: 증거 활용 수준

| 등급 | 이 목록에서의 의미 | 의미하지 않는 것 |
|---|---|---|
| A | 재현 가능한 원자료·정의·방법론, 또는 본문을 확인한 직접 수치 연구 | 모든 수치·인과·가격 전망이 검증됐다는 보증 |
| B | 출처와 시점이 확인된 해석·시나리오·검증 보도·백서 | 정량적 확률이나 저자 전체의 예측 실력 |
| C | 공개 소셜 의견·재전파·부분 원문 접근·복원 기록 | 허위라는 판정 또는 무가치하다는 뜻 |
| D | 삭제·차단·오류 셸 등으로 핵심 내용을 활용할 수 없는 경계 기록 | 링크 자체가 허구라는 뜻 |

A/B/C/D는 등간 점수가 아니며 퍼센트로 변환하지 않는다. A의 기관 연구도 모델·기초 자료의 전체 재현이나 인과 식별을 완료했다는 뜻은 아니다. 구체적인 열람 수준은 **access**, 해석의 경계는 **limitation**을 함께 읽어야 한다. 이전 조사 메모에서 사용한 ‘A=직접 열람, B=매체를 통한 확인’은 접근 정도만의 표기였고, 이 카탈로그의 tier는 활용 수준이므로 기계적으로 동일시하지 않는다.

### timing: 자료마다 대상 사건을 기준으로 표시

- **data:** 가격 데이터·정의·일반 방법·원사이트 복원 맥락. 발표 당시 미래를 맞힌다는 주장으로 분류하지 않는다.
- **before:** 해당 자료가 전망한 고점이나 저점 이전에 공개된 시나리오. 예를 들어 2026년3월 Bitwise는 2026년 저점에 대해 사전이고, 2025년11월 MerkleChainsaw는 2026년 저점에 대해 사전이다.
- **during:** 2025년 여름~가을의 상태 관찰 또는 진행 중인 견해 수정. 최종 고점 판정과 동일하지 않다.
- **after:** 주요 사건을 관측한 뒤의 분석·모형·자기 평가. 미래 전망 문장이 함께 있어도 여기서 활용하는 핵심 주장이 사후이면 after로 둔다.

날짜는 확인 수준에 맞는 **표시 문자열**이다. 일자를 모르는 월간 PDF는 연·월만 쓰고, 영상은 기사 보도일로 표시한다. 상시 문서에 가상의 발행일을 넣지 않았다. 전체 날짜 필드를 무조건 Date.parse로 변환하면 이러한 한계가 사라질 수 있다.

### stance: 주장의 방향

support·counter·mixed는 사용자 가설의 **어느 부분과 내용이 겹치는지**를 표시할 뿐, 자료의 정확도 판정이 아니다. data는 계산의 기반, context는 논쟁·복원 범위의 맥락이다. 넓은 고점권 형성에는 지지하면서 최종 최고가 단축에는 반대할 수 있으므로 mixed를 적극 사용했다. 기관별 찬성 표결을 세는 용도로 사용할 수 없다.

## 4. 전체 우선순위

각 행의 짧은 한국어 제목은 편집 제목이고 originalTitle에는 원제 또는 확인한 X 첫 구절을 넣었다. 원영상 제목을 확인하지 못한 경우 명시적으로 ‘제목 미확인’이라고 적었다.

| 순위 | 자료 | 발행자 | 날짜 | 등급 | 읽는 목적 |
|---:|---|---|---|:---:|---|
| 1 | [BTC 일별 가격 원자료](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000) | Coin Metrics | 2026-10-21 조회 | A | 원자료·정의 |
| 2 | [UTC 일말 가격의 정의](https://github.com/coinmetrics/docs-website/blob/master/asset-metrics/market/priceusd.md) | Coin Metrics | 상시 문서 | A | 원자료·정의 |
| 3 | [거래소 가격 독립 검산](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2025-07-01T00%3A00%3A00Z&end=2026-01-01T00%3A00%3A00Z&granularity=86400) | Coinbase Exchange | 2026-10-21 조회 | A | 원자료·정의 |
| 4 | [캔들 시각·종가의 정의](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) | Coinbase | 상시 문서 | A | 원자료·정의 |
| 5 | [반감기의 실제 날짜](https://bitcoin.org/en/halving) | Bitcoin.org | 상시 문서 | A | 원자료·정의 |
| 6 | [시간순 검증과 예측구간](https://otexts.com/fpp3/toolbox.html) | Hyndman·Athanasopoulos / OTexts | 상시 문서 | A | 원자료·정의 |
| 7 | [데이터 범위와 이용 조건](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data) | Coin Metrics | 상시 문서 | A | 원자료·정의 |
| 8 | [7월 과열과 여러 차례의 고점](https://research.glassnode.com/the-week-onchain-week-28-2025/) | Glassnode | 2025-07-16 | A | 동시대 관측 |
| 9 | [7월 매도와 신규 수요](https://coinmetrics.substack.com/p/state-of-the-network-issue-322) | Coin Metrics | 2025-07-29 | A | 동시대 관측 |
| 10 | [당시 관찰한 석 달 횡보](https://www.reuters.com/business/global-markets-trading-day-graphic-2025-09-25/) | Reuters · Jamie McGeever | 2025-09-25 | B | 동시대 관측 |
| 11 | [분산 관찰과 남은 상승 기대](https://coinmetrics.substack.com/p/state-of-the-network-issue-331) | Coin Metrics · Tanay Ved | 2025-09-30 | A | 동시대 관측 |
| 12 | [가을보다 빠른 저점 시나리오](https://bitwiseinvestments.eu/blog/regular-updates/from_peak_liquidity_to_recovery_setup-03-2026/) | Bitwise · André Dragosch·Luke Deans | 2026-03-02 | B | 사전 시나리오 |
| 13 | [여름 고점 전망의 원래 범위](https://cointelegraph.com/markets/bitcoin-technical-indicator-predicts-btc-top-summer-2025) | Cointelegraph · Nancy Lubale | 2025-01-13 | B | 사전 시나리오 |
| 14 | [연중 고점 가능성의 X 원문](https://x.com/davthewave/status/1878605027692130499) | Dave the Wave · X | 2025-01-13 UTC | C | 사전 시나리오 |
| 15 | [7월 또는 가을이라는 두 대안](https://dailyhodl.com/2025/02/01/heres-how-long-the-bitcoin-bull-market-could-last-if-history-repeats-itself-according-to-crypto-analyst/) | The Daily Hodl | 2025-02-01 | B | 사전 시나리오 |
| 16 | [가속 시나리오의 원영상](https://www.youtube.com/watch?v=yJ2ylDKlJ5A) | Rekt Capital · YouTube | 2025-02-01 보도 | C | 사전 시나리오 |
| 17 | [가을 최종고점 전망의 기록](https://forklog.com/en/analyst-identifies-bitcoin-price-pattern-resembling-2021/) | ForkLog | 2025-08-15 | B | 사전 시나리오 |
| 18 | [4분기 최종고점의 X 원문](https://x.com/benjamincowen/status/1954742029696524339) | Benjamin Cowen · X | 2025-08-11 UTC | C | 사전 시나리오 |
| 19 | [시간 유지와 진폭 축소](https://www.galaxy.com/insights/research/bitcoin-four-year-cycle-where-is-the-bottom) | Galaxy · Alex Thorn | 2026-06-12 | A | 반론·수정 이력 |
| 20 | [완만한 하락 전망과 가격 오차](https://experts.bitwiseinvestments.com/cio-memos/trumps-executive-order-can-it-break-cryptos-four-year-cycle) | Bitwise · Matt Hougan | 2025-01-28 | B | 반론·수정 이력 |
| 21 | [조기 종료 판단의 오류 인정](https://crypto.news/cryptoquant-ceo-admits-he-was-wrong-about-bitcoin-bull-cycle/) | crypto.news · Trisha Husada | 2025-05-09 | B | 반론·수정 이력 |
| 22 | [사이클 이론 수정의 맥락](https://beincrypto.com/why-ki-young-ju-say-bitcoin-cycle-theory-is-dead/) | BeInCrypto · Nhat Hoang | 2025-07-25 | B | 반론·수정 이력 |
| 23 | [사이클 이론 수정의 X 원문](https://x.com/ki_young_ju/status/1948512682157519266) | Ki Young Ju · X | 2025-07-24 | C | 반론·수정 이력 |
| 24 | [고점 이후 회복 전망의 반례](https://www.coinbase.com/institutional/research-insights/research/monthly-outlook/monthly-outlook-oct-2025) | Coinbase Institutional | 2025-10-28 | B | 반론·수정 이력 |
| 25 | [기간 일관성과 낙관 전망](https://k33.com/research/articles/2025-year-in-review) | K33 Research | 2025-12-22 | B | 반론·수정 이력 |
| 26 | [2026년 저점 날짜의 사전 예측](https://www.reddit.com/r/CryptoCurrency/comments/1ozhku2/four_year_cycle_update_predicting_the_bottom/) | u/MerkleChainsaw · r/CryptoCurrency | 2025-11-17 | C | 반론·수정 이력 |
| 27 | [같은 예측자의 실패 인정](https://www.reddit.com/r/CryptoCurrency/comments/1x0p9kc/four_year_cycle_update_uncharted_territory/) | u/MerkleChainsaw · r/CryptoCurrency | 2026-10-08 | C | 반론·수정 이력 |
| 28 | [최종고점 시간은 일관적이라는 반론](https://www.reddit.com/r/Bitcoin/comments/1p18dcc/freakishly_consistent_cycle/) | u/jermcnama · r/Bitcoin | 2025-11-19 | C | 반론·수정 이력 |
| 29 | [7월 이후 분산의 사후 진단](https://research.glassnode.com/the-week-onchain-week-41-2025/) | Glassnode | 2025-10-15 | A | 사후 모형 |
| 30 | [7월 고점과 장기보유자 지출](https://research.glassnode.com/the-week-onchain-week-42-2025/) | Glassnode | 2025-10-22 | A | 사후 모형 |
| 31 | [6월 저점의 사후 모형 평가](https://bitwiseinvestments.eu/blog/crypto-research/the-bitcoin-bottom-explained/) | Bitwise · CF Benchmarks | 2026-09-23 | B | 사후 모형 |
| 32 | [짧고 얕은 하락장 해석](https://bitwiseinvestments.eu/blog/regular-updates/Bitwise_Crypto_Market_Compass_2026_40/) | Bitwise | 2026-09-28 | B | 사후 모형 |
| 33 | [6월 저점 이후 회복과 저항](https://research.glassnode.com/the-week-onchain-week-41-2026/) | Glassnode | 2026-10-14 | A | 사후 모형 |
| 34 | [하락 폭의 다른 자료 대조](https://www.blackrock.com/us/individual/literature/whitepaper/re-underwriting-bitcoin.pdf) | BlackRock | 2026-08 | B | 사후 모형 |
| 35 | [조기 저점 보고서의 뉴스 요약](https://www.dlnews.com/articles/markets/bitcoin-price-bottom-coming-sooner-than-expected/) | DL News | 2026-03-03 | B | 소셜·재전파 |
| 36 | [여름 전망의 번역·재전파](https://pintu.co.id/news/123892-para-analis-crypto-prediksi-bitcoin-capai-puncak-juli-2025) | Pintu News | 2025-01-14 | C | 소셜·재전파 |
| 37 | [여름 전망의 레딧 확산](https://www.reddit.com/r/CryptoCurrency/comments/1i0dm2o/bitcoin_technical_indicator_predicts_btc_price/) | u/CreepToeCurrentSea · r/CryptoCurrency | 2025-01-13 | C | 소셜·재전파 |
| 38 | [반감기 달력 이동의 댓글](https://www.reddit.com/r/CryptoCurrency/comments/1luqv5x/comment/n247wnf/) | u/MichaelAischmann · r/CryptoCurrency | 2025-07-08 스레드 | C | 소셜·재전파 |
| 39 | [먼저 팔아 고점이 당겨진다는 설명](https://www.reddit.com/r/CryptoCurrency/comments/1oo38yo/my_takeaway_from_being_in_crypto_for_8_years/) | u/RandomJoe7 · r/CryptoCurrency | 2025-11-04 | C | 소셜·재전파 |
| 40 | [시장 성숙·주기 약화 논쟁](https://www.reddit.com/r/CryptoCurrency/comments/1m95kae/bitcoins_fouryear_cycle_loses_grip_as_maturing/) | u/Every_Hunt_160 · r/CryptoCurrency | 2025-07-25 | C | 소셜·재전파 |
| 41 | [7월의 횡보·연장 논쟁](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/daily_discussion_sunday_july_27_2025/) | r/BitcoinMarkets · 여러 작성자 | 2025-07-27 스레드 | C | 소셜·재전파 |
| 42 | [가을 고점 우려와 광고 문맥](https://www.reddit.com/r/btc/comments/1mwmidj/are_we_looking_at_a_bitcoin_cycle_top_in_the_next/) | u/dumble_hold_the_door · r/btc | 2025-08-21 | C | 소셜·재전파 |
| 43 | [9월의 고점 질문과 반론](https://www.reddit.com/r/CryptoCurrency/comments/1nn6k91/is_it_overalmost_over/) | 게시자 삭제 · r/CryptoCurrency | 2025-09-21 | C | 소셜·재전파 |
| 44 | [개인의 석 달 횡보 관찰](https://www.reddit.com/r/Bitcoin/comments/1n9t5z5/where_is_the_real_volatility/) | r/Bitcoin | 2025-09-06 | C | 소셜·재전파 |
| 45 | [장기보유자 감소의 X 발췌](https://x.com/glassnode/status/1980645562694389891) | Glassnode · X | 2025-10-21 UTC 추정 | C | 소셜·재전파 |
| 46 | [삭제된 연장 논쟁의 기록](https://www.reddit.com/r/CryptoMarkets/comments/1o65wdz/which_side_are_you_on_bull_run_ends_in_q4_2025_or/) | r/CryptoMarkets | 2025-10-14 | D | 소셜·재전파 |
| 47 | [원사이트 실제 이용 기록](https://bitcointalk.org/index.php?topic=5512441.msg64612416) | BitcoinTalk · tbct_mt2 | 2024-10-08 | C | 원사이트 맥락 |
| 48 | [보존된 원사이트 UI 셸](https://web.archive.org/web/20240321184519/https://www.bitcoincyclescomparison.com/) | Internet Archive | 2024-03-21 | C | 원사이트 맥락 |
| 49 | [원사이트와 남은 검색 색인](https://www.bitcoincyclescomparison.com/) | bitcoincyclescomparison.com | 2026-10-21 확인 | D | 원사이트 맥락 |
| 50 | [후속 보존본의 오류 셸](https://web.archive.org/web/20251014000000/https://www.bitcoincyclescomparison.com/) | Internet Archive | 2025-10-14 조회 주소 | D | 원사이트 맥락 |

전체 항목의 선정 이유와 한계는 카탈로그의 reason·limitation에 각각 기록했다. 상위 자료라도 내용 전체를 검증한 것으로 일반화하지 않는다.

### 6번의 두 가지 읽기 목적

같은 교재 제5장의 **예측구간**과 **§5.10 Time series cross-validation**을 한 행에 통합했다. 목차의 해당 항목과 본문을 재확인했고, 공식 저자 소개에서 Rob J Hyndman·George Athanasopoulos를 확인했다. 목차 클릭 결과는 검증된 기본 URL을 반환하므로 확인하지 않은 fragment를 만들지 않았다. 같은 자료의 두 독서 목적을 독립된 근거 두 건으로 세지 않는다.

교재의 시간순 검증은 예측 대상보다 앞선 관측만으로 학습하고 예측 기점을 순차 이동하는 방식을 설명한다. 이를 이번 프로젝트에 적용하면, 과거 시점에서 데이터를 자르는 작업은 미래 관측의 누수를 줄이는 데 필요하다. 그러나 **모형과 기준일을 사후에 정했고 평가 기점이 두 개뿐이라는 한계까지 제거하지는 않는다.** 이는 교재가 이 비트코인 모형을 검증했다는 뜻이 아니라, 교재의 원칙으로 우리 검증 범위를 평가한 판단이다. 과거 몇 사례의 최솟값·최댓값을 확률 예측구간으로 표시해서도 안 된다.

## 5. 같은 계보를 중복으로 세지 않기

family는 **26개 출처·논의 계보**를 식별한다. family 수가 독립 예측·독립 데이터·독립 실험의 수는 아니다. 같은 발행자의 연속 연구, 같은 주장의 기사·번역·소셜 전달, 같은 예측자의 원글과 후속 자기 평가는 묶는다. 다른 family도 같은 비트코인 가격이나 Glassnode·Coin Metrics 자료를 공유할 수 있다.

| 계보 | 묶인 항목 | 구분할 점 |
|---|---|---|
| dave-lgc-summer-2025 | 13·14·36·37, 기사 차트 | Dave X → Cointelegraph → Pintu·Reddit·bot. 독립 예측 네 건이 아니다. |
| rekt-accelerated-2025 | 15·16 | 원영상과 당시 인용 보도. 7월 또는 가을이라는 대안을 두 단계 적중으로 바꾸지 않는다. |
| cowen-q4-2025 | 17·18 | 당시 보도와 같은 status ID의 원문. 계정명 차이를 별도 저자로 세지 않는다. |
| ki-young-ju-revisions | 21·22·23, 앞선 X 링크 | 3월 판단·5월 수정·7월 구조설 수정의 연속 기록이다. |
| bitwise-cycle-research | 12·20·31·32·35·40 | 같은 기관의 연속 연구와 보도·기사 공유다. 직접 복제가 아닌 다른 시점의 견해도 기관 계보로 연결했다. |
| glassnode-cycle-observations | 8·29·30·33·45 | 직접 온체인 연구와 소셜 발췌. 보고서마다 날짜·관측 대상이 다르다. |
| coinmetrics-state-of-network | 9·11 | 같은 연구 시리즈. 분산 관찰과 당시의 상방 기대를 함께 읽는다. |
| merklechainsaw-bottom-forecast | 26·27 | 원 예측과 실패 인정. 예측 한 건의 추적 기록이다. |
| reddit-july27-sideways | 41, 세 하위 댓글 | 서로 다른 개인 견해이지만 같은 시장 상태에 관한 한 대화다. |
| original-site-reconstruction | 47·48·49·50, 차트 이미지 | 같은 사이트를 복원하는 이용 기록·아카이브·오류 기록이다. 시장 예측력의 독립 증거가 아니다. |

Coin Metrics 원자료 family와 연구 시리즈 family는 **자료 용도**가 달라 나눴지만 기관·시장 데이터가 독립된 것은 아니다. BlackRock 백서의 도표에도 Coin Metrics가 출처로 포함되므로 이를 완전히 새로운 가격 공급자처럼 세지 않는다. Coinbase의 별도 산출 가격은 공급자 편향을 점검하는 데 유용하지만 같은 시장의 두 관측이다.

## 6. 대표행 아래 보존한 18개 보조 URL

다음 링크들은 누락한 문헌이 아니라 대표 항목의 재현·맥락에 속한다. 순위 행 수를 늘려 증거가 많아 보이게 하지 않으면서 개별 원문 위치를 모두 남겼다. 같은 연결 정보를 `dist/evidence-catalog.js`의 **EVIDENCE_SUPPLEMENTS** 배열에도 `parentId`, `url`, `title`로 내보낸다. 자료 상세 화면은 `parentId`가 대표 자료의 `id`와 같은 링크들을 표시할 수 있다. EVIDENCE 본체의 50행과 순위는 유지한다.

| 대표 순위 | 보조 자료 | 처리 이유·접근 범위 |
|---:|---|---|
| 3 | [Coinbase 2025년 상반기 캔들](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2025-01-01T00%3A00%3A00Z&end=2025-07-01T00%3A00%3A00Z&granularity=86400) | 같은 API의 분할 요청. 별도 예측 사례가 아니다. |
| 3 | [Coinbase 2026년 완료 관측](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2026-01-01T00%3A00%3A00Z&end=2026-10-21T00%3A00%3A00Z&granularity=86400) | 2026-10-20까지 필터링한 자료. 미완료 당일 제외. |
| 3 | [Coinbase 2022년 11월 캔들](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2022-11-01T00%3A00%3A00Z&end=2022-12-01T00%3A00%3A00Z&granularity=86400) | 저점 날짜가 가격 기준에 따라 달라지는 민감도 검산. |
| 1 | [Coin Metrics 최근 구간 재대조](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2025-07-01&end_time=2026-10-21&page_size=10000) | 동일 공급자 재조회이며 독립 공급자의 검증으로 세지 않는다. |
| 1 | [Coin Metrics API 기본 경로](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics) | 동일 API의 기본 주소. 실제 재현에는 1번의 쿼리 조건을 사용한다. |
| 2 | [Coin Metrics 가격 문서](https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/market/price) | 공식 가격 정의의 다른 문서 위치. 지표 정의와 함께 읽는다. |
| 7 | [Coin Metrics API 문서](https://docs.coinmetrics.io/api/v4/) | API 사용 규칙. 키 없는 요청의 실제 성공 여부는 호스트별로 달랐다. |
| 7 | [Coin Metrics 공식 공개 저장소](https://github.com/coinmetrics/data) | 공개 CSV·라이선스 근거. 초기 CSV의 최신 가격은 2026-05-23이라 최종 API 자료로 대체했다. |
| 7 | [Coin Metrics 출처 표기](https://coinmetrics.io/) | 공급자 공식 홈페이지. 독립 연구나 추가 가격 자료로 세지 않는다. |
| 7 | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 데이터 이용 조건. 시장 가설의 경험적 증거가 아니다. |
| 13 | [기사에 재현된 Dave의 차트](https://s3-images.ctmedia.io/media/content/01945f86-9edd-7fab-8066-c1da6adaf861.jpg) | 기사의 이미지다. X 원본 이미지 파일을 직접 확보한 것과 구별한다. |
| 21 | [주기영의 앞선 X 판단](https://x.com/ki_young_ju/status/1901776137715671191) | 7월 인용 기사에서 과거 판단으로 연결한 원문. 직접 403이며 3월 판단·5월 수정 맥락으로만 사용한다. |
| 38 | [7월8일 전체 토론](https://www.reddit.com/r/CryptoCurrency/comments/1luqv5x/daily_crypto_discussion_july_8_2025_gmt0/) | 대표행의 특정 댓글을 둘러싼 전체 스레드. |
| 41 | [Riker-Was-Here의 횡보 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5foyyb/) | 현재 횡보가 과거에 비해 짧다는 개인 해석. 구체 수치의 독립 검증은 아니다. |
| 41 | [Order_Book_Facts의 반론 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5fu0ks/) | 이번 주기에도 긴 횡보가 있었다는 반론. 같은 대화의 다른 작성자다. |
| 41 | [Knerd5의 연장 가능성 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5g6vir/) | 기관 헤지·반복 횡보를 통한 연장 가능성. 7월 최종고점 주장과 다르다. |
| 47 | [원사이트의 실제 차트 이미지](https://i.ibb.co/XzgRhBv/Bitcoincyclecomparison.png) | 이용 기록에 연결된 고정 화면. 전체 상호작용·가격 산출 방식을 증명하지 않는다. |
| 47 | [BitcoinTalk 전체 주제](https://bitcointalk.org/index.php?topic=5512441.0) | 대표행의 특정 게시물과 같은 주제의 주소다. |

## 7. 접근 제한과 날짜의 정직한 표시

X는 본문 직접 요청에서 403 또는 내용 없는 응답이 나왔다. Dave·Cowen·주기영은 검색 문구와 당시 임베드/인용 보도로 대조했지만 원문 전체·수정 이력을 직접 인증하지 못했다. Glassnode X는 색인 발췌만 있어 연결 보고서 전체의 내용을 해당 X 하나에 귀속하지 않는다. 보고서 본문을 읽었다는 사실과 X 전체를 읽었다는 사실을 분리했다.

Dave의 일부 지역 표시는 1월12일이지만 기사·임베드와 ID 시간은 1월13일 UTC에 맞는다. Cowen도 지역 8월10일과 UTC 8월11일을 구분한다. ID의 시간 변환은 보조 계산이며 글의 내용·작성자·미수정을 독립 인증하는 방법은 아니다. Glassnode X의 날짜는 그 보조 추정임을 표시했다.

Reddit은 공개 본문·댓글 사본을 확인했으나 원게시 당시 판본과 모든 편집 이력은 확보하지 않았다. 스레드 날짜와 개별 댓글의 정확한 UTC 시각을 구분한다. 작성자가 삭제됐지만 본문이 남은 43번과 본문이 삭제된 46번도 구분한다. 후자의 제목으로 삭제된 주장을 복원하지 않는다.

원사이트의 HTTP 503, Wayback 오류 셸과 핵심 스크립트 404는 접근 실패 기록이다. **URL이 확인됐다는 것과 현재 본문이 읽힌다는 것은 다르다.** 링크 형식·기존 출처와의 일치를 검증했지만 모든 링크의 지속적인 HTTP 200을 보장하지 않는다. 47번은 재확인 시 2024-10-09 수정 표시가 관측되어 이를 access에 남겼다.

## 8. 조사 자료와 범위 확인

이 카탈로그는 다음 기존 기록의 출처를 모았다.

- Bitcoin_Cycle_Claims_Cross_Validation.md: 최종 외부 주장 교차 검증.
- research-data/x_cycle_claims.md: X 원문 위치·당시 보도·접근 등급.
- research-data/institutional_cycle_crosscheck.md: 기관 원문·가격 교차검증.
- research-data/DATA_RESEARCH.md 및 SOURCE_MODEL_AUDIT.md: 원자료·정의·방법론.
- sites/bitcoin-cycle-atlas/research-data/reddit_cycle_claims.md: 공개 원문·댓글·제외 경계.
- docs/RESEARCH.md 및 CYCLE_TIMING.md: 원사이트 복원과 계산·검증 기준.

이 8개 문서에서 추출한 고유 HTTPS URL **68개가 모두 대표행 50개 또는 보조 링크 18개에 대응**한다. 동일 링크의 재등장과 기본 경로·쿼리 변형은 새로운 주장으로 세지 않았다. 원사이트 이용 기록의 원제와 Reuters의 접근 상태, 기존 교재의 §5.10과 저자 표기를 재확인했으며 새 가격 전망이나 새 시장 분석가를 추가하지 않았다.

신뢰할 수 있는 결론을 내려면 최종 고점, 고점권 최초 진입, 지속 체류, 분산 시작, 고점→저점 기간을 먼저 분리해야 한다. 이 카탈로그는 그 비교를 할 수 있게 자료의 순서를 정한 것이며, 어떤 임계값을 선택해도 같은 단축 결론이 나온다거나 다음 변곡점 날짜가 증명됐다는 뜻은 아니다.

