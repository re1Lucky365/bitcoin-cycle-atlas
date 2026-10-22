# 자료 읽기 우선순위 · 통합 연구

연구 기준일: 2026-10-22 KST. 가격 관측 종료: 2026-10-20 UTC.

87개 대표 자료와 25개 보조 링크를 URL 중복 없이 제공합니다. 순위는 원자료 → 검증 방법 → 사용자 지정 차트 감사 → 지지·반론 교차검증 → 소셜·전파·복원 기록 순서입니다. A–D는 자료의 활용 등급이며 예측 적중률이나 투자 점수가 아닙니다. 같은 family의 반복 인용을 독립 증거로 세지 않으며 다른 family도 통계적 독립을 보장하지 않습니다.

사용자가 지정한 CryptoCon 감사와 ilay_vp 차트는 방법론 다음에 두었습니다. 직접 관측·검증 기준을 먼저 확보한 뒤 이 차트의 성공과 실패를 함께 읽습니다. 관련 [교차검증 보고서](STRUCTURE_CROSS_VALIDATION.md), [시장 구조 계산](MARKET_STRUCTURE_METHOD.md), [예측 검증 실패](DETAILED_FORECAST_METHOD.md)를 함께 제공합니다.

| 순서 | 자료 제목 | 출처 | 날짜 | 등급 | 읽는 목적 |
|---:|---|---|---|:---:|---|
| 1 | [BTC 일별 가격 원자료](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000) | Coin Metrics | 2026-10-21 조회 | A | 원자료·정의 |
| 2 | [UTC 일말 가격의 정의](https://github.com/coinmetrics/docs-website/blob/master/asset-metrics/market/priceusd.md) | Coin Metrics | 상시 문서 | A | 원자료·정의 |
| 3 | [거래소 가격 독립 검산](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2025-07-01T00%3A00%3A00Z&end=2026-01-01T00%3A00%3A00Z&granularity=86400) | Coinbase Exchange | 2026-10-21 조회 | A | 원자료·정의 |
| 4 | [캔들 시각·종가의 정의](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) | Coinbase | 상시 문서 | A | 원자료·정의 |
| 5 | [반감기는 블록 수 규칙](https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp) | Bitcoin Core contributors | 2026-10-21 조회 | A | 원자료·정의 |
| 6 | [반감기의 실제 날짜](https://bitcoin.org/en/halving) | Bitcoin.org | 상시 문서 | A | 원자료·정의 |
| 7 | [데이터 범위와 이용 조건](https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data) | Coin Metrics | 상시 문서 | A | 원자료·정의 |
| 8 | [시간순 검증과 예측구간](https://otexts.com/fpp3/toolbox.html) | Hyndman·Athanasopoulos / OTexts | 상시 문서 | A | 원자료·정의 |
| 9 | [가격 변화로 정하는 국면](https://arxiv.org/pdf/0809.1040) | Glattfelder · Dupuis · Olsen | 2008-09-05 / v2 2010-06-22 | A | 분할 방법 |
| 10 | [변동성과 시간 척도](https://finance.martinsewell.com/stylized-facts/dependence/Cont2001.pdf) | Rama Cont · Quantitative Finance | 2001 | A | 수익률·변동성 정의 |
| 11 | [CryptoCon 주장·수정 이력과 가격 검산](https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/CRYPTOCON_AUDIT.md) | Bitcoin Cycle Atlas | 2026-10-22 | A | 계산·수정 이력 |
| 12 | [피보나치 우연 일치 검정](https://openaccess.city.ac.uk/id/eprint/16276/) | Roy A. Batchelor · Richard Ramyar / City Research Online | 2006-09 | A | 비교 설계·반론 |
| 13 | [여러 모델을 고른 뒤의 검증](https://users.ssc.wisc.edu/~behansen/718/White2000.pdf) | Halbert White · Econometrica | 2000-09 | A | 모형 선택 한계 |
| 14 | [차트 분석의 반대쪽 증거](https://web.mit.edu/wangj/www/pap/LoMamayskyWang00.pdf) | Lo · Mamaysky · Wang · Journal of Finance | 2000-08 | A | 균형 있는 해석 |
| 15 | [첨부한 152주 사이클 차트](https://x.com/ilay_vp/status/1820906371669168600) | ilay_ / @ilay_vp | 2024-08-06 | C | 우선 검증 대상 |
| 16 | [차트의 2024년 유통 흔적](https://gathering.tweakers.net/forum/list_messages/2275282/11) | Tweakers / JPS | 2024-11-30 | D | 출처·사전성 확인 |
| 17 | [지표 고점과 가격 고점의 시차·6개월 가속 가설](https://www.bitcoindatanewsletter.com/p/theories-collide) | CryptoCon | 2023-11-14 | B | 가설의 기원 |
| 18 | [일부 고점 단계가 오히려 느려졌다는 관찰](https://www.bitcoindatanewsletter.com/p/the-slowest-cycle-yet) | CryptoCon | 2025-06-13 | B | 가속의 반례 |
| 19 | [2026년 9월 판단 변경을 인정한 원문](https://www.bitcoindatanewsletter.com/p/cryptocon-gets-it-wrong) | CryptoCon | 2026-09-21 | B | 최신 수정 |
| 20 | [58,000달러 저점 가능성과 재시험 검토](https://www.bitcoindatanewsletter.com/p/unfinished-business) | CryptoCon | 2026-10-20 | B | 최신 불확실성 |
| 21 | [2025년 8월 전량 매도 발표 원문](https://www.bitcoindatanewsletter.com/p/cycle-top-urgent-alert-cryptocon) | CryptoCon | 2025-08-28 | B | 실제 판단 기록 |
| 22 | [시간·지표의 비중을 바꾼 모형 수정](https://www.bitcoindatanewsletter.com/p/pseudo-double-bottom) | CryptoCon | 2026-06-09 | B | 모형 변경 |
| 23 | [더 높은 저점과 기존 저점 시간 창의 병존](https://www.bitcoindatanewsletter.com/p/trapped-in-limbo) | CryptoCon | 2026-10-06 | B | 현재의 분기 |
| 24 | [시간 유지와 진폭 축소](https://www.galaxy.com/insights/research/bitcoin-four-year-cycle-where-is-the-bottom) | Galaxy · Alex Thorn | 2026-06-12 | A | 반론·수정 이력 |
| 25 | [가을보다 빠른 저점 시나리오](https://bitwiseinvestments.eu/blog/regular-updates/from_peak_liquidity_to_recovery_setup-03-2026/) | Bitwise · André Dragosch·Luke Deans | 2026-03-02 | B | 사전 시나리오 |
| 26 | [여름 반등 반납 예상의 결과](https://newsletter.rektcapital.co.uk/bitcoin-preparing-for-q3/) | Rekt Capital Newsletter | 2026-06-29 | B | 사전 시나리오·실패 기록 |
| 27 | [7월 과열과 여러 차례의 고점](https://research.glassnode.com/the-week-onchain-week-28-2025/) | Glassnode | 2025-07-16 | A | 동시대 관측 |
| 28 | [7월 매도와 신규 수요](https://coinmetrics.substack.com/p/state-of-the-network-issue-322) | Coin Metrics | 2025-07-29 | A | 동시대 관측 |
| 29 | [당시 관찰한 석 달 횡보](https://www.reuters.com/business/global-markets-trading-day-graphic-2025-09-25/) | Reuters · Jamie McGeever | 2025-09-25 | B | 동시대 관측 |
| 30 | [분산 관찰과 남은 상승 기대](https://coinmetrics.substack.com/p/state-of-the-network-issue-331) | Coin Metrics · Tanay Ved | 2025-09-30 | A | 동시대 관측 |
| 31 | [통화정책·위험선호 경로](https://www.imf.org/en/publications/wp/issues/2023/08/04/the-crypto-cycle-and-us-monetary-policy-534834) | Che · Copestake · Furceri · Terracciano / IMF Working Paper 23/163 | 2023-08-04 | A | 가능한 작동 경로 |
| 32 | [거시 뉴스와의 단기 비연결](https://www.newyorkfed.org/research/staff_reports/sr1052) | Gianluca Benigno · Carlo Rosa / Federal Reserve Bank of New York | 2023-02 | A | 가능한 작동 경로·반론 |
| 33 | [2013년 규제 사건 원문](https://www.pbc.gov.cn/chubanwu/114566/114579/114616/2808348/index.html) | People’s Bank of China and co-issuing authorities | 2013-12-12 공보 | A | 사건 맥락 |
| 34 | [2017년 선물 개시 일정](https://www.cmegroup.com/media-room/press-releases/2017/12/01/cme_group_self-certifiesbitcoinfuturestolaunchdec18.html) | CME Group | 2017-12-01 | A | 사건 맥락 |
| 35 | [선물과 고점의 해석](https://www.frbsf.org/research-and-insights/publications/economic-letter/2018/05/how-futures-trading-changed-bitcoin-prices/) | Hale · Krishnamurthy · Kudlyak · Shultz / FRBSF Economic Letter | 2018-05-07 | A | 작동 경로 해석 |
| 36 | [2020년 위기 대응 정책](https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm) | Federal Reserve | 2020-03-15 | A | 사건 맥락 |
| 37 | [2022년 금리 인상 시작](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm) | Federal Reserve | 2022-03-16 | A | 사건 맥락 |
| 38 | [FTX 유동성 충격 기록](https://www.sec.gov/files/litigation/complaints/2022/comp-pr2022-219.pdf) | U.S. Securities and Exchange Commission | 2022-12-13 | A | 사건 맥락 |
| 39 | [2024년 현물 ETP 승인](https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023) | Gary Gensler / U.S. Securities and Exchange Commission | 2024-01-10 | A | 사건 맥락 |
| 40 | [여름 고점 전망의 원래 범위](https://cointelegraph.com/markets/bitcoin-technical-indicator-predicts-btc-top-summer-2025) | Cointelegraph · Nancy Lubale | 2025-01-13 | B | 사전 시나리오 |
| 41 | [연중 고점 가능성의 X 원문](https://x.com/davthewave/status/1878605027692130499) | Dave the Wave · X | 2025-01-13 UTC | C | 사전 시나리오 |
| 42 | [7월 또는 가을이라는 두 대안](https://dailyhodl.com/2025/02/01/heres-how-long-the-bitcoin-bull-market-could-last-if-history-repeats-itself-according-to-crypto-analyst/) | The Daily Hodl | 2025-02-01 | B | 사전 시나리오 |
| 43 | [가속 시나리오의 원영상](https://www.youtube.com/watch?v=yJ2ylDKlJ5A) | Rekt Capital · YouTube | 2025-02-01 보도 | C | 사전 시나리오 |
| 44 | [2025년 가을 고점 사전 창](https://x.com/rektcapital/status/1942703540671070318) | Rekt Capital / @rektcapital | 2025-07-08 UTC · ID 시각 | C | 외부 의견 대조 |
| 45 | [1,060일 고점 카운트다운](https://x.com/crypto_birb/status/1956022795403411875) | CryptoBirb / @crypto_birb | 2025-08-14 UTC · ID 시각 | C | 외부 의견 대조 |
| 46 | [가을 최종고점 전망의 기록](https://forklog.com/en/analyst-identifies-bitcoin-price-pattern-resembling-2021/) | ForkLog | 2025-08-15 | B | 사전 시나리오 |
| 47 | [4분기 최종고점의 X 원문](https://x.com/benjamincowen/status/1954742029696524339) | Benjamin Cowen · X | 2025-08-11 UTC | C | 사전 시나리오 |
| 48 | [조기 종료 판단의 오류 인정](https://crypto.news/cryptoquant-ceo-admits-he-was-wrong-about-bitcoin-bull-cycle/) | crypto.news · Trisha Husada | 2025-05-09 | B | 반론·수정 이력 |
| 49 | [사이클 이론 수정의 맥락](https://beincrypto.com/why-ki-young-ju-say-bitcoin-cycle-theory-is-dead/) | BeInCrypto · Nhat Hoang | 2025-07-25 | B | 반론·수정 이력 |
| 50 | [사이클 이론 수정의 X 원문](https://x.com/ki_young_ju/status/1948512682157519266) | Ki Young Ju · X | 2025-07-24 | C | 반론·수정 이력 |
| 51 | [완만한 하락 전망과 가격 오차](https://experts.bitwiseinvestments.com/cio-memos/trumps-executive-order-can-it-break-cryptos-four-year-cycle) | Bitwise · Matt Hougan | 2025-01-28 | B | 반론·수정 이력 |
| 52 | [고점 이후 회복 전망의 반례](https://www.coinbase.com/institutional/research-insights/research/monthly-outlook/monthly-outlook-oct-2025) | Coinbase Institutional | 2025-10-28 | B | 반론·수정 이력 |
| 53 | [기간 일관성과 낙관 전망](https://k33.com/research/articles/2025-year-in-review) | K33 Research | 2025-12-22 | B | 반론·수정 이력 |
| 54 | [7월 이후 분산의 사후 진단](https://research.glassnode.com/the-week-onchain-week-41-2025/) | Glassnode | 2025-10-15 | A | 사후 모형 |
| 55 | [7월 고점과 장기보유자 지출](https://research.glassnode.com/the-week-onchain-week-42-2025/) | Glassnode | 2025-10-22 | A | 사후 모형 |
| 56 | [6월 저점의 사후 모형 평가](https://bitwiseinvestments.eu/blog/crypto-research/the-bitcoin-bottom-explained/) | Bitwise · CF Benchmarks | 2026-09-23 | B | 사후 모형 |
| 57 | [짧고 얕은 하락장 해석](https://bitwiseinvestments.eu/blog/regular-updates/Bitwise_Crypto_Market_Compass_2026_40/) | Bitwise | 2026-09-28 | B | 사후 모형 |
| 58 | [6월 저점 이후 회복과 저항](https://research.glassnode.com/the-week-onchain-week-41-2026/) | Glassnode | 2026-10-14 | A | 사후 모형 |
| 59 | [하락 폭의 다른 자료 대조](https://www.blackrock.com/us/individual/literature/whitepaper/re-underwriting-bitcoin.pdf) | BlackRock | 2026-08 | B | 사후 모형 |
| 60 | [기한이 있는 피보나치 예상](https://www.reddit.com/r/BitcoinMarkets/comments/1qy4tvy/comment/o42j5n5/) | r/BitcoinMarkets · u/AllCapNoBrake and prediction bot | 2026-02-07 | C | 실패 기록·검증 가능성 |
| 61 | [2026년 저점 날짜의 사전 예측](https://www.reddit.com/r/CryptoCurrency/comments/1ozhku2/four_year_cycle_update_predicting_the_bottom/) | u/MerkleChainsaw · r/CryptoCurrency | 2025-11-17 | C | 반론·수정 이력 |
| 62 | [같은 예측자의 실패 인정](https://www.reddit.com/r/CryptoCurrency/comments/1x0p9kc/four_year_cycle_update_uncharted_territory/) | u/MerkleChainsaw · r/CryptoCurrency | 2026-10-08 | C | 반론·수정 이력 |
| 63 | [최종고점 시간은 일관적이라는 반론](https://www.reddit.com/r/Bitcoin/comments/1p18dcc/freakishly_consistent_cycle/) | u/jermcnama · r/Bitcoin | 2025-11-19 | C | 반론·수정 이력 |
| 64 | [조기 저점 보고서의 뉴스 요약](https://www.dlnews.com/articles/markets/bitcoin-price-bottom-coming-sooner-than-expected/) | DL News | 2026-03-03 | B | 소셜·재전파 |
| 65 | [여름 전망의 번역·재전파](https://pintu.co.id/news/123892-para-analis-crypto-prediksi-bitcoin-capai-puncak-juli-2025) | Pintu News | 2025-01-14 | C | 소셜·재전파 |
| 66 | [여름 전망의 레딧 확산](https://www.reddit.com/r/CryptoCurrency/comments/1i0dm2o/bitcoin_technical_indicator_predicts_btc_price/) | u/CreepToeCurrentSea · r/CryptoCurrency | 2025-01-13 | C | 소셜·재전파 |
| 67 | [반감기 달력 이동의 댓글](https://www.reddit.com/r/CryptoCurrency/comments/1luqv5x/comment/n247wnf/) | u/MichaelAischmann · r/CryptoCurrency | 2025-07-08 스레드 | C | 소셜·재전파 |
| 68 | [먼저 팔아 고점이 당겨진다는 설명](https://www.reddit.com/r/CryptoCurrency/comments/1oo38yo/my_takeaway_from_being_in_crypto_for_8_years/) | u/RandomJoe7 · r/CryptoCurrency | 2025-11-04 | C | 소셜·재전파 |
| 69 | [시장 성숙·주기 약화 논쟁](https://www.reddit.com/r/CryptoCurrency/comments/1m95kae/bitcoins_fouryear_cycle_loses_grip_as_maturing/) | u/Every_Hunt_160 · r/CryptoCurrency | 2025-07-25 | C | 소셜·재전파 |
| 70 | [7월의 횡보·연장 논쟁](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/daily_discussion_sunday_july_27_2025/) | r/BitcoinMarkets · 여러 작성자 | 2025-07-27 스레드 | C | 소셜·재전파 |
| 71 | [가을 고점 우려와 광고 문맥](https://www.reddit.com/r/btc/comments/1mwmidj/are_we_looking_at_a_bitcoin_cycle_top_in_the_next/) | u/dumble_hold_the_door · r/btc | 2025-08-21 | C | 소셜·재전파 |
| 72 | [9월의 고점 질문과 반론](https://www.reddit.com/r/CryptoCurrency/comments/1nn6k91/is_it_overalmost_over/) | 게시자 삭제 · r/CryptoCurrency | 2025-09-21 | C | 소셜·재전파 |
| 73 | [개인의 석 달 횡보 관찰](https://www.reddit.com/r/Bitcoin/comments/1n9t5z5/where_is_the_real_volatility/) | r/Bitcoin | 2025-09-06 | C | 소셜·재전파 |
| 74 | [장기보유자 감소의 X 발췌](https://x.com/glassnode/status/1980645562694389891) | Glassnode · X | 2025-10-21 UTC 추정 | C | 소셜·재전파 |
| 75 | [삭제된 연장 논쟁의 기록](https://www.reddit.com/r/CryptoMarkets/comments/1o65wdz/which_side_are_you_on_bull_run_ends_in_q4_2025_or/) | r/CryptoMarkets | 2025-10-14 | D | 소셜·재전파 |
| 76 | [원사이트 실제 이용 기록](https://bitcointalk.org/index.php?topic=5512441.msg64612416) | BitcoinTalk · tbct_mt2 | 2024-10-08 | C | 원사이트 맥락 |
| 77 | [보존된 원사이트 UI 셸](https://web.archive.org/web/20240321184519/https://www.bitcoincyclescomparison.com/) | Internet Archive | 2024-03-21 | C | 원사이트 맥락 |
| 78 | [원사이트와 남은 검색 색인](https://www.bitcoincyclescomparison.com/) | bitcoincyclescomparison.com | 2026-10-21 확인 | D | 원사이트 맥락 |
| 79 | [후속 보존본의 오류 셸](https://web.archive.org/web/20251014000000/https://www.bitcoincyclescomparison.com/) | Internet Archive | 2025-10-14 조회 주소 | D | 원사이트 맥락 |
| 80 | [2024년 안의 조기 최종 고점 대안](https://www.bitcoindatanewsletter.com/p/the-all-new-cycle-timing) | CryptoCon | 2024-03-06 | B | 전망 버전 |
| 81 | [2025년 여러 고점 가능성으로 달력 복귀](https://www.bitcoindatanewsletter.com/p/return-of-the-halving-cycles) | CryptoCon | 2024-07-27 | B | 전망 버전 |
| 82 | [2021년 고점 경고와 연말 재상승의 조건](https://www.bitcoindatanewsletter.com/p/bitcoin-data-newsletter) | CryptoCon | 2021-04-24 | B | 과거 판단 대조 |
| 83 | [2021년 예상 오류와 2022년 저점권 판단](https://www.bitcoindatanewsletter.com/p/what-happened-to-bitcoin) | CryptoCon | 2022-11-15 | B | 불리한 기록 |
| 84 | [원래 고점 창·2025년 11월 28일 ±21일](https://x.com/CryptoCon_/status/1862142528939532706) | CryptoCon / X | 2024-11-28 | D | 원래 기한 보존 |
| 85 | [152주 비교에서 제시한 2025년 10월 고점](https://x.com/CryptoCon_/status/1933580045546651799) | CryptoCon / X | 2025-06-13 | D | 사전 월 전망 |
| 86 | [166,754달러·9월 목표의 기한 내 결과](https://www.newsbtc.com/es/news/bitcoin/bitcoin-52-increase-to-166000/) | NewsBTC / CryptoCon 보도 | 2025-07-04 | C | 목표 미달 검증 |
| 87 | [2026–2029 단계별 달력·AI 영상 요약](https://www.bitcoindatanewsletter.com/p/the-hive) | CryptoCon 사이트의 AI 요약 | 2026-01-16 | D | 외부 미래 가설 |

## 각 자료의 근거·한계

### 1. BTC 일별 가격 원자료

- 원제: BTC PriceUSD · 1d · Community API
- 원문: https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&end_time=2026-10-21&page_size=10000
- 계보: coinmetrics-price-data; 시점: data; 입장: data.
- 접근 상태: 공식 공개 API 응답 수신·5,939행 검증
- 이 순서로 읽는 이유: 모든 고점권·경과일 계산을 재현하는 출발점이다. 가격 자료를 먼저 확인한 뒤 해석을 읽는다.
- 한계: 2010-07-18~2026-10-20의 UTC 일별 값이다. 일별 행 수는 독립적인 사이클 표본 수가 아니며 현재 저점은 미확정이다.

보조 원문:

- [Coin Metrics 최근 구간 재대조](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2025-07-01&end_time=2026-10-21&page_size=10000)
- [Coin Metrics API 기본 경로](https://community-api.coinmetrics.io/v4/timeseries/asset-metrics)

### 2. UTC 일말 가격의 정의

- 원제: Price, USD (PriceUSD)
- 원문: https://github.com/coinmetrics/docs-website/blob/master/asset-metrics/market/priceusd.md
- 계보: coinmetrics-price-data; 시점: data; 입장: data.
- 접근 상태: 공식 지표 문서 본문 확인
- 이 순서로 읽는 이유: 종가·장중 가격·다중시장 기준값을 섞지 않도록 날짜와 가격의 의미를 먼저 고정한다.
- 한계: 표시된 날짜의 일말값을 사용한다. 개별 거래소 종가와 저점 날짜가 다를 수 있다.

보조 원문:

- [Coin Metrics 가격 문서](https://gitbook-docs.coinmetrics.io/network-data/network-data-overview/market/price)

### 3. 거래소 가격 독립 검산

- 원제: BTC-USD daily candles · Coinbase Exchange
- 원문: https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2025-07-01T00%3A00%3A00Z&end=2026-01-01T00%3A00%3A00Z&granularity=86400
- 계보: coinbase-price-data; 시점: data; 입장: data.
- 접근 상태: 공식 API 직접 수신·전체 기간 검산
- 이 순서로 읽는 이유: 다른 산출 방식으로 7월의 최고가 근접성과 10월 고점을 확인한다. 가격 기준의 민감도도 드러난다.
- 한계: 대표 링크는 2025년 하반기다. 다른 세 요청은 방법 문서에 보존했다. 같은 시장을 관찰하므로 별도 경제 실험은 아니다.

보조 원문:

- [Coinbase 2025년 상반기 캔들](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2025-01-01T00%3A00%3A00Z&end=2025-07-01T00%3A00%3A00Z&granularity=86400)
- [Coinbase 2026년 완료 관측](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2026-01-01T00%3A00%3A00Z&end=2026-10-21T00%3A00%3A00Z&granularity=86400)
- [Coinbase 2022년 11월 캔들](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2022-11-01T00%3A00%3A00Z&end=2022-12-01T00%3A00%3A00Z&granularity=86400)

### 4. 캔들 시각·종가의 정의

- 원제: Get product candles
- 원문: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
- 계보: coinbase-price-data; 시점: data; 입장: data.
- 접근 상태: 공식 문서 본문 확인
- 이 순서로 읽는 이유: 배열의 시각·저가·고가·시가·종가·거래량 순서와 구간 의미를 확인하는 재현 규칙이다.
- 한계: 일별 마지막 거래값과 Coin Metrics 기준값이 같을 필요는 없다. 미완료 당일 캔들은 제외한다.

### 5. 반감기는 블록 수 규칙

- 원제: Bitcoin Core · mainnet consensus.nSubsidyHalvingInterval
- 원문: https://github.com/bitcoin/bitcoin/blob/master/src/kernel/chainparams.cpp
- 계보: bitcoin-protocol; 시점: data; 입장: data.
- 접근 상태: 공식 저장소 mainnet 설정의 210000 블록 간격 확인
- 이 순서로 읽는 이유: 프로토콜이 정하는 발행 감소와 가격의 3년 상승·1년 하락 가설을 구분한다.
- 한계: master는 변할 수 있다. 발행 간격은 가격 전환일·수요·시장 저점을 정하지 않는다.

### 6. 반감기의 실제 날짜

- 원제: Bitcoin Halving
- 원문: https://bitcoin.org/en/halving
- 계보: bitcoin-halving-history; 시점: data; 입장: data.
- 접근 상태: 날짜·블록 높이 대조
- 이 순서로 읽는 이유: 달력 4년과 반감기 후 경과일이라는 두 시계를 분리하는 기준이다.
- 한계: 반감기는 정확히 48개월마다 발생하는 달력 행사가 아니다. 미래 날짜를 확정값으로 사용하지 않는다.

### 7. 데이터 범위와 이용 조건

- 원제: Coin Metrics Community Data
- 원문: https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data
- 계보: coinmetrics-price-data; 시점: data; 입장: data.
- 접근 상태: 공식 문서·공개 저장소 조건 확인
- 이 순서로 읽는 이유: 데이터 출처·범위·사용 조건을 확인하고 재사용 경로를 보존한다.
- 한계: 초기 CSV는 최신 시점까지 이어지지 않아 API 전체 응답을 사용했다. 저장소·라이선스 링크는 방법 문서에 수록했다.

보조 원문:

- [Coin Metrics API 문서](https://docs.coinmetrics.io/api/v4/)
- [Coin Metrics 공식 공개 저장소](https://github.com/coinmetrics/data)
- [Coin Metrics 출처 표기](https://coinmetrics.io/)
- [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)

### 8. 시간순 검증과 예측구간

- 원제: Forecasting: Principles and Practice (3rd ed) · The forecaster’s toolbox
- 원문: https://otexts.com/fpp3/toolbox.html
- 계보: forecast-validation-methods; 시점: data; 입장: data.
- 접근 상태: 공개 교재 본문·§5.10·공식 저자 소개 확인
- 이 순서로 읽는 이유: 예측 시점 이전의 관측만 학습하는 §5.10과 예측구간 정의를 함께 읽는다. 사후 적합도와 실제 예측 평가를 구분하는 기준이다.
- 한계: 이 프로젝트에 적용한 판단: 과거 절단은 미래 관측 누수를 줄이지만, 사후 설계·두 기준일만의 재생은 강한 예측력 검증이 아니다.

### 9. 가격 변화로 정하는 국면

- 원제: Patterns in high-frequency FX data: Discovery of 12 empirical scaling laws
- 원문: https://arxiv.org/pdf/0809.1040
- 계보: directional-change-research; 시점: data; 입장: data.
- 접근 상태: 26쪽 연구 원문 확인
- 이 순서로 읽는 이유: 고정 비율 반전으로 사건을 정의하고 여러 임계값에서 비교하는 방향전환 방식의 근거다.
- 한계: 대상은 외환 고빈도 자료다. BTC의 4년 법칙이나 미래 날짜를 증명한 논문이 아니다. 피벗 발생일과 뒤늦은 확인일을 구분해야 한다.

### 10. 변동성과 시간 척도

- 원제: Empirical properties of asset returns: stylized facts and statistical issues
- 원문: https://finance.martinsewell.com/stylized-facts/dependence/Cont2001.pdf
- 계보: financial-stylized-facts; 시점: data; 입장: data.
- 접근 상태: 논문 전문 사본 확인. 저자 서버 PDF는 요청 시간 초과.
- 이 순서로 읽는 이유: 수익률의 시간 척도, 두꺼운 꼬리, 변동성 군집을 고려해 일별 관측을 독립 표본으로 세지 않는 근거다.
- 한계: BTC 특화 결과가 아니다. 본 프로젝트의 상태 임계값을 최적으로 추정해 주지 않는다.

### 11. CryptoCon 주장·수정 이력과 가격 검산

- 원제: CryptoCon의 주기·고점·저점 주장 검증
- 원문: https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/CRYPTOCON_AUDIT.md
- 계보: atlas-cryptocon-audit; 시점: after; 입장: mixed.
- 접근 상태: 65개 원장 기록·고정 가격 표본 독립 재계산
- 이 순서로 읽는 이유: 원래 전망과 수정 전망, 시간 오차와 가격 오차를 먼저 구별한다. 7월 고점권 진입의 선행일·체류·낙폭을 같은 자료로 검산했다.
- 한계: 전체 X 계정 분석이나 전체 적중률이 아니다. 492개는 공식 목록의 제목·링크 항목 합계다. 2026-10-20 고정 표본의 사후 분석이며 미래 예측 성능을 보증하지 않는다.

### 12. 피보나치 우연 일치 검정

- 원제: Magic numbers in the Dow
- 원문: https://openaccess.city.ac.uk/id/eprint/16276/
- 계보: fibonacci-statistical-testing; 시점: data; 입장: counter.
- 접근 상태: 저자 기관 저장소와 41쪽 PDF 전문 확인
- 이 순서로 읽는 이유: 전환점 선택을 다시 수행하는 블록 재표집과 여러 비율의 동시 검정을 다룬다. 피보나치 특수성 주장에 직접 관련된다.
- 한계: DJIA 대상 토론 논문이다. BTC 전체를 반증하지 않는다. 이 사이트는 고정 대조 비율과의 기술적 비교만 수행하며 이 논문의 부트스트랩 귀무검정을 구현하지 않았다.

보조 원문:

- [피보나치 검정 논문 PDF](https://openaccess.city.ac.uk/id/eprint/16276/1/magic%20numbers%20in%20the%20dow.pdf)

### 13. 여러 모델을 고른 뒤의 검증

- 원제: A Reality Check for Data Snooping
- 원문: https://users.ssc.wisc.edu/~behansen/718/White2000.pdf
- 계보: forecast-evaluation-methods; 시점: data; 입장: data.
- 접근 상태: 대학 서버의 논문 전문 확인. 출판사 DOI 페이지는 403.
- 이 순서로 읽는 이유: 같은 자료에서 많은 규칙을 고른 뒤 가장 좋은 결과만 내보내면 생기는 편향을 설명한다.
- 한계: 이 사이트가 White Reality Check를 수행했다는 뜻이 아니다. 사후 설계와 작은 사이클 표본은 별도로 남는다.

보조 원문:

- [출판사 DOI · 직접 열람 제한](https://doi.org/10.1111/1468-0262.00152)

### 14. 차트 분석의 반대쪽 증거

- 원제: Foundations of Technical Analysis: Computational Algorithms, Statistical Inference, and Empirical Implementation
- 원문: https://web.mit.edu/wangj/www/pap/LoMamayskyWang00.pdf
- 계보: technical-pattern-research; 시점: data; 입장: mixed.
- 접근 상태: 공저자 MIT 페이지의 논문 전문 확인
- 이 순서로 읽는 이유: 일부 정량화한 차트 패턴에 조건부 정보가 있을 수 있다는 결과를 함께 읽어, 피보나치 결과를 모든 기술적 분석에 일반화하지 않는다.
- 한계: 미국 주식과 특정 패턴 대상이다. BTC 피보나치, 거래비용 차감 수익, 본 사이트 3년 전망을 검증하지 않는다.

### 15. 첨부한 152주 사이클 차트

- 원제: Insights from Bitcoin Halvings (v.3)
- 원문: https://x.com/ilay_vp/status/1820906371669168600
- 계보: ilay-halving-v3; 시점: before; 입장: mixed.
- 접근 상태: 사용자 첨부와 공개 재게시 이미지를 직접 확인. X 전체 본문·TradingView 원문은 열람 불가.
- 이 순서로 읽는 이유: 2025-10-06 주차 고점 표시는 실제와 일치한다. 같은 그림의 2024 ATH, 2025년 3월 첫 고점, 10월 가격 목표도 함께 평가한다.
- 한계: 주봉 그림의 날짜를 하루 단위 정밀 예측으로 확대하지 않는다. 3월 방향과 10월 $140–160k 목표는 맞지 않았다. 2011 앵커 선택·2020 8주 조정의 사전 규칙과 수정 이력은 미확인이다.

보조 원문:

- [2024년 포럼에 연결된 차트 이미지](https://i.imgur.com/wPL3ufz.jpeg)

### 16. 차트의 2024년 유통 흔적

- 원제: [SC] Cryptocurrency Slowchat topic #28 / $100k behaald! · JPS post
- 원문: https://gathering.tweakers.net/forum/list_messages/2275282/11
- 계보: ilay-halving-v3; 시점: before; 입장: context.
- 접근 상태: 본문에서 해당 X URL과 Imgur 이미지 링크를 확인하고 이미지를 직접 대조했다.
- 이 순서로 읽는 이유: 2025년 이후에 처음 만들어진 설명인지 점검하는 보조 자료다. 이미지 머리글과 X ID 시각도 2024-08-06을 가리킨다.
- 한계: 원 차트와 같은 계보다. 별도의 예측 성공 증거가 아니며 포럼·이미지 URL의 모든 수정 이력을 검증한 것은 아니다.

### 17. 지표 고점과 가격 고점의 시차·6개월 가속 가설

- 원제: Theories Collide
- 원문: https://www.bitcoindatanewsletter.com/p/theories-collide
- 계보: cryptocon-cycle-timing; 시점: before; 입장: support.
- 접근 상태: 본인 공개 뉴스레터 본문 확인
- 이 순서로 읽는 이유: 기술 지표의 극값과 최종 가격 극값을 구별하는 대안 달력의 직접 출처다.
- 한계: 저자도 당시 미입증 가설로 설명했다. 미래 고점의 날짜나 일정한 가속률을 증명한 자료가 아니다.

### 18. 일부 고점 단계가 오히려 느려졌다는 관찰

- 원제: The Slowest Cycle Yet
- 원문: https://www.bitcoindatanewsletter.com/p/the-slowest-cycle-yet
- 계보: cryptocon-cycle-timing; 시점: during; 입장: counter.
- 접근 상태: 공개 도입부 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 모든 단계가 계속 빨라진다는 해석과 반대되는 당시 관점을 함께 읽는다.
- 한계: 공개 부분만으로 단계의 전체 정의와 조건을 복원하지 못했다. 정확한 날짜를 갖는 일별 예측으로 임의 채점하지 않는다.

### 19. 2026년 9월 판단 변경을 인정한 원문

- 원제: CryptoCon Gets It Wrong!
- 원문: https://www.bitcoindatanewsletter.com/p/cryptocon-gets-it-wrong
- 계보: cryptocon-cycle-timing; 시점: during; 입장: counter.
- 접근 상태: 날짜와 공개 도입부 직접 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 가격 상승을 보고 기존 판단을 바꿔야 한다고 밝힌 기록을 이전 저점 전망과 함께 읽는다.
- 한계: 공개 부분은 판단 변경만 확인한다. 유료 본문의 포지션·매수 규모를 추정하지 않는다.

### 20. 58,000달러 저점 가능성과 재시험 검토

- 원제: Unfinished Business
- 원문: https://www.bitcoindatanewsletter.com/p/unfinished-business
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 조사에서 공개 도입부 확인·재접속 오류 가능·유료 본문 미열람
- 이 순서로 읽는 이유: 조사 시점의 최신 공개 관점이 저점 확정과 추가 폭락 확정 중 어느 하나가 아님을 확인한다.
- 한계: 유료 본문의 전체 결론은 확인하지 못했다. 2026년 6월 관측 최저는 아직 최종 사이클 저점으로 확정하지 않는다.

### 21. 2025년 8월 전량 매도 발표 원문

- 원제: Cycle Top Urgent Alert, CryptoCon
- 원문: https://www.bitcoindatanewsletter.com/p/cycle-top-urgent-alert-cryptocon
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 본인의 공개 매도 발표 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 사후 고점 설명과 당시의 매도 의사결정을 구별할 기준이다.
- 한계: 실제 체결을 감사하지 않았다. 최고가보다 먼저 매도한 위험 관리와 최종 고점 날짜를 맞힌 성과는 다른 평가다.

### 22. 시간·지표의 비중을 바꾼 모형 수정

- 원제: Pseudo Double Bottom
- 원문: https://www.bitcoindatanewsletter.com/p/pseudo-double-bottom
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 공개 도입부 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 시간과 지표의 가중치가 바뀌었다는 직접 기록이다. 변경 전후를 따로 평가한다.
- 한계: 구체적인 수치 구현과 전체 가중치는 확보하지 못했다. 11월–1월 저점 창은 조사일에 아직 시작되지 않았다.

### 23. 더 높은 저점과 기존 저점 시간 창의 병존

- 원제: Trapped in Limbo
- 원문: https://www.bitcoindatanewsletter.com/p/trapped-in-limbo
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 공개 도입부 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 항상 더 낮은 저점만 기다린다는 해석을 피하고 최신 조건부 분기를 확인한다.
- 한계: 어떤 분기가 실현될지의 확률은 주어지지 않았다. 원문의 불확실성을 하나의 확정 경로로 바꾸지 않는다.

### 24. 시간 유지와 진폭 축소

- 원제: Bitcoin May Not Have Bottomed Yet. Here’s Where the Data Says it Could.
- 원문: https://www.galaxy.com/insights/research/bitcoin-four-year-cycle-where-is-the-bottom
- 계보: galaxy-cycle-research; 시점: before; 입장: counter.
- 접근 상태: 공식 원문 본문 확인
- 이 순서로 읽는 이유: 저점→고점 기간은 유사하고 진폭은 줄었다는 직접 반론이다. 시간 압축과 가격 압축을 분리한다.
- 한계: 고객 전달일은 6월11일, 주요 데이터는 6월9일이다. 4분기 가격 시나리오는 미완료이며 2024년의 조기 열기를 2025년7월과 혼동하지 않는다.

### 25. 가을보다 빠른 저점 시나리오

- 원제: From Peak Liquidity to Recovery Setup: Is Bitcoin’s Bottom In?
- 원문: https://bitwiseinvestments.eu/blog/regular-updates/from_peak_liquidity_to_recovery_setup-03-2026/
- 계보: bitwise-cycle-research; 시점: before; 입장: support.
- 접근 상태: 공식 원문 본문 확인
- 이 순서로 읽는 이유: 관측 저점 전에 전통적 8개월 대신 2~6개월의 저점 가능성과 선행 거래를 논한 가장 직접적인 자료다.
- 한계: 5~9월의 넓은 범위이지 6월30일 예언이 아니다. 2025년 최종 고점은 기존 주기에 부합한다고도 설명했다.

### 26. 여름 반등 반납 예상의 결과

- 원제: Bitcoin – Preparing For Q3
- 원문: https://newsletter.rektcapital.co.uk/bitcoin-preparing-for-q3/
- 계보: rekt-cycle-forecasts; 시점: before; 입장: counter.
- 접근 상태: 작성자 공식 뉴스레터의 공개 본문 확인. 회원 전용 범위는 미열람.
- 이 순서로 읽는 이유: 6월 종가 $66k 아래라는 조건 이후 7월 반등·8월 반납을 예상했다. 실제 7월 +7.43%, 8월 +24.90%로 8월 방향은 맞지 않았다.
- 한계: 이 글의 compressed는 문맥상 낙폭 크기 설명을 포함한다. 이를 3–5개월 시간 단축 주장으로 바꾸지 않으며 한 번의 실패로 저자 전체를 평가하지 않는다.

### 27. 7월 과열과 여러 차례의 고점

- 원제: Price Discovery
- 원문: https://research.glassnode.com/the-week-onchain-week-28-2025/
- 계보: glassnode-cycle-observations; 시점: during; 입장: mixed.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 최종 10월 고점 전에 과열·이익 실현과 여러 파동의 고점 형성을 관찰한 직접 자료다.
- 한계: 당시 최종 고점을 확정하지 않았고 추가 상승도 허용했다. 공급 수익 비중 95%는 최고가 대비 95% 가격선과 다르다.

### 28. 7월 매도와 신규 수요

- 원제: The Flows Behind the Crypto Market’s Rise to $4T
- 원문: https://coinmetrics.substack.com/p/state-of-the-network-issue-322
- 계보: coinmetrics-state-of-network; 시점: during; 입장: mixed.
- 접근 상태: 발행자 원문 본문 확인
- 이 순서로 읽는 이유: 기존 보유자의 물량 이동과 ETF·기업 수요를 같은 시점에 비교한다. 분산과 수요 흡수를 함께 읽을 수 있다.
- 한계: 일부 ETF 도표는 FBTC를 제외한다. 물량 이동만으로 최종 고점 날짜나 단축 개월 수를 추정할 수 없다.

### 29. 당시 관찰한 석 달 횡보

- 원제: Trading Day: Whisper it ... but is this the top?
- 원문: https://www.reuters.com/business/global-markets-trading-day-graphic-2025-09-25/
- 계보: reuters-market-commentary; 시점: during; 입장: support.
- 접근 상태: 당시 기사 본문 확인
- 이 순서로 읽는 이유: 10월 최고가 이전에 약 석 달간 가격이 제자리라는 관찰이 있었음을 확인한다.
- 한계: 논평의 넓은 횡보 표현이다. 95% 체류율이나 최종 고점 확정, 주기 단축 검정은 아니다.

### 30. 분산 관찰과 남은 상승 기대

- 원제: State of the Network’s Q3 2025 Wrap Up
- 원문: https://coinmetrics.substack.com/p/state-of-the-network-issue-331
- 계보: coinmetrics-state-of-network; 시점: during; 입장: mixed.
- 접근 상태: 발행자 원문 본문 확인
- 이 순서로 읽는 이유: 낮은 변동성의 분산과 장기 보유 물량 감소를 기록했다. 추가 상승 해석도 남겨 실시간 판단의 한계를 보여준다.
- 한계: 상태 진단과 최종 고점 예측은 다르다. 6일 뒤의 마지막 최고점을 정확히 예고했다고 평가하지 않는다.

### 31. 통화정책·위험선호 경로

- 원제: The Crypto Cycle and US Monetary Policy
- 원문: https://www.imf.org/en/publications/wp/issues/2023/08/04/the-crypto-cycle-and-us-monetary-policy-534834
- 계보: macro-crypto-research; 시점: after; 입장: mixed.
- 접근 상태: IMF 공식 연구 페이지의 초록·저자·발행일 확인
- 이 순서로 읽는 이유: 통화 긴축, 위험선호, 암호자산 공통 요인의 관계를 다뤄 공급 일정 외의 설명을 제공한다.
- 한계: 연구자의 모형 결과이며 IMF 정책 견해가 아니다. 자산·기간·식별 가정이 달라 특정 가격 전환일의 원인을 단정할 수 없다.

### 32. 거시 뉴스와의 단기 비연결

- 원제: The Bitcoin–Macro Disconnect
- 원문: https://www.newyorkfed.org/research/staff_reports/sr1052
- 계보: macro-crypto-research; 시점: after; 입장: counter.
- 접근 상태: 공식 Staff Report 1052 초록·발행 정보 확인
- 이 순서로 읽는 이유: 장중 뉴스 반응에서는 BTC와 거시·통화 뉴스의 관계가 약하다는 결과를 함께 읽는다.
- 한계: IMF 연구와 관찰 시간·자산 묶음·추정 방식이 다르다. 어느 한쪽을 모든 시계열의 단일 정답으로 취급하지 않는다.

### 33. 2013년 규제 사건 원문

- 원제: 2013年第19号 中国人民银行文告（总第374号） · 关于防范比特币风险的通知
- 원문: https://www.pbc.gov.cn/chubanwu/114566/114579/114616/2808348/index.html
- 계보: china-2013-bitcoin-policy; 시점: during; 입장: context.
- 접근 상태: 공식 공보 본문의 비트코인 위험 통지 확인
- 이 순서로 읽는 이유: 2013년 시장의 금융·결제기관 접근 제한이라는 구체적인 외생 변화를 확인한다.
- 한계: 당시 정책의 역사 기록이다. 사적 보유까지 전면 금지했다거나 2013년 고점 전체를 이 한 사건이 설명한다고 주장하지 않는다.

### 34. 2017년 선물 개시 일정

- 원제: CME Group Self-Certifies Bitcoin Futures to Launch Dec. 18
- 원문: https://www.cmegroup.com/media-room/press-releases/2017/12/01/cme_group_self-certifiesbitcoinfuturestolaunchdec18.html
- 계보: cme-2017-futures; 시점: before; 입장: context.
- 접근 상태: 공식 보도자료 본문 확인
- 이 순서로 읽는 이유: 거래 개시는 12월 17일 저녁, 거래일은 12월 18일이라는 날짜 정의와 현금 결제 구조를 확인한다.
- 한계: 발표와 고점의 근접성만으로 인과관계가 성립하지 않는다. 이 이전에 모든 비트코인 파생상품이 없었다는 뜻도 아니다.

### 35. 선물과 고점의 해석

- 원제: How Futures Trading Changed Bitcoin Prices
- 원문: https://www.frbsf.org/research-and-insights/publications/economic-letter/2018/05/how-futures-trading-changed-bitcoin-prices/
- 계보: cme-2017-futures; 시점: after; 입장: mixed.
- 접근 상태: 공식 경제 레터 본문 확인
- 이 순서로 읽는 이유: 비관적 견해가 선물 매도를 통해 반영될 수 있다는 해석을 검토한다.
- 한계: 사후 관찰이며 무작위 인과 실험이 아니다. CME 발표와 같은 사건 계보이고 향후 가격 예측도 아니다.

### 36. 2020년 위기 대응 정책

- 원제: Federal Reserve issues FOMC statement
- 원문: https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm
- 계보: fed-2020-policy; 시점: during; 입장: context.
- 접근 상태: 공식 발표 본문·시각 확인
- 이 순서로 읽는 이유: 팬데믹 충격과 금리·자산 매입 대응을 서로 구분해 읽는다.
- 한계: 3월 12일 BTC 급락은 이 발표보다 앞선다. 이후 상승 전체를 이 정책 하나의 효과로 귀속하지 않는다.

### 37. 2022년 금리 인상 시작

- 원제: Federal Reserve issues FOMC statement
- 원문: https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm
- 계보: fed-2022-policy; 시점: during; 입장: context.
- 접근 상태: 공식 발표 본문 확인
- 이 순서로 읽는 이유: 2022년 금융 여건 변화를 실제 발표일과 연결하는 기준이다.
- 한계: 2021년 가격 고점은 첫 금리 인상보다 먼저다. 기대의 선반영은 가능한 설명이나 이 자료만으로 지연 기간을 추정할 수 없다.

### 38. FTX 유동성 충격 기록

- 원제: SEC v. Samuel Bankman-Fried · Complaint 22-cv-10501
- 원문: https://www.sec.gov/files/litigation/complaints/2022/comp-pr2022-219.pdf
- 계보: ftx-2022-collapse; 시점: after; 입장: context.
- 접근 상태: 28쪽 제출 소장 원문 확인
- 이 순서로 읽는 이유: 11월 인출 요구와 11월 11일 파산을 기록한 문서로, 가격 주기 외의 신용·상대방 충격을 구분한다.
- 한계: 소장은 제출 당시 주장이다. 모든 기재를 법원의 최종 판단으로 표현하지 않는다. 가격 저점 날짜는 거래소·기준값에 따라서도 달라진다.

### 39. 2024년 현물 ETP 승인

- 원제: Statement on the Approval of Spot Bitcoin Exchange-Traded Products
- 원문: https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023
- 계보: spot-etp-2024; 시점: during; 입장: context.
- 접근 상태: 제목·본문의 2024-01-10 발행일 확인
- 이 순서로 읽는 이유: 현물 ETP 접근 경로의 변화와 반감기 이전 고가 형성을 함께 검토하는 출발점이다.
- 한계: URL 숫자와 실제 발행 연도가 다르다. 승인은 BTC 투자 추천이나 이후 유입량·가격 효과의 인과적 증명이 아니다.

### 40. 여름 고점 전망의 원래 범위

- 원제: Bitcoin technical indicator predicts BTC price cycle top in summer 2025
- 원문: https://cointelegraph.com/markets/bitcoin-technical-indicator-predicts-btc-top-summer-2025
- 계보: dave-lgc-summer-2025; 시점: before; 입장: mixed.
- 접근 상태: 기사 전문·저자 차트·X 연결 확인
- 이 순서로 읽는 이유: 원문 접근이 제한된 X보다 먼저 읽어 신호 전후 수개월 오차와 2021년 예외를 확인한다.
- 한계: 52주 SMA의 예상 교차와 실제 최고가 시점은 다르다. 7월 고점권 후 10월 최고가라는 복합 예측이 아니다.

보조 원문:

- [기사에 재현된 Dave의 차트](https://s3-images.ctmedia.io/media/content/01945f86-9edd-7fab-8066-c1da6adaf861.jpg)

### 41. 연중 고점 가능성의 X 원문

- 원제: The suggestion of a mid year #btc peak here…
- 원문: https://x.com/davthewave/status/1878605027692130499
- 계보: dave-lgc-summer-2025; 시점: before; 입장: mixed.
- 접근 상태: X 직접 403·색인 및 당시 임베드 대조
- 이 순서로 읽는 이유: 사전 견해의 작성자와 원문 위치를 보존한다. 기사·레딧·번역 재전파의 출발점이다.
- 한계: X 전체·수정 이력은 미확인이다. 일부 화면의 1월12일은 지역 시각이며 기사와 ID 시간은 1월13일 UTC에 부합한다.

### 42. 7월 또는 가을이라는 두 대안

- 원제: Here’s How Long the Bitcoin Bull Market Could Last if History Repeats Itself, According to Crypto Analyst
- 원문: https://dailyhodl.com/2025/02/01/heres-how-long-the-bitcoin-bull-market-could-last-if-history-repeats-itself-according-to-crypto-analyst/
- 계보: rekt-accelerated-2025; 시점: before; 입장: mixed.
- 접근 상태: 기사 본문·원영상 링크 확인
- 이 순서로 읽는 이유: 250일과 329일에 따른 가속·전통 시나리오를 구분한 당시 기록이다.
- 한계: 7월과 가을은 대안 관계다. 사후에 고점권 진입과 최종고점의 두 단계로 바꾸어 적중 처리하지 않는다.

### 43. 가속 시나리오의 원영상

- 원제: Rekt Capital video · yJ2ylDKlJ5A (제목 미확인)
- 원문: https://www.youtube.com/watch?v=yJ2ylDKlJ5A
- 계보: rekt-accelerated-2025; 시점: before; 입장: mixed.
- 접근 상태: 당시 기사 연결 확인·영상 로딩 실패
- 이 순서로 읽는 이유: 검증 보도가 실제로 지목한 1차 영상 주소를 보존한다.
- 한계: 전체 재생·전사·정확한 업로드 시각은 확인하지 못했다. 기사 발행일을 영상 게시일로 단정하지 않는다.

### 44. 2025년 가을 고점 사전 창

- 원제: BTC bull-market peak 518–546 days after the halving
- 원문: https://x.com/rektcapital/status/1942703540671070318
- 계보: rekt-cycle-forecasts; 시점: before; 입장: mixed.
- 접근 상태: 검색 색인의 원 게시물 문구 확인. X 직접 본문은 403.
- 이 순서로 읽는 이유: 518–546일이라는 고점 창에 실제 2025-10-06의 534일이 들어간다. 같은 저자의 후속 실패와 함께 비교한다.
- 한계: 7월 고점권 진입이나 2026년 저점 날짜를 예언한 것은 아니다. 게시 시각은 ID에서 환산했으며 수정 이력·전체 스레드는 미확인이다.

### 45. 1,060일 고점 카운트다운

- 원제: Bitcoin Cycle Peak Countdown
- 원문: https://x.com/crypto_birb/status/1956022795403411875
- 계보: cryptobirb-cycle-countdown; 시점: before; 입장: mixed.
- 접근 상태: 검색 색인과 2025-08-18 보도의 원문 임베드 교차 확인. X 직접 열람은 403.
- 이 순서로 읽는 이유: 2022-11-21을 출발점으로 1,060–1,100일, 2025-10-15~11-15 고점 창을 제시한 기록을 검토한다.
- 한계: 그 출발점을 그대로 쓰면 실제 10월 6일은 1,050일로 창보다 이르다. Coin Metrics의 11월 9일로 사후 교체하여 적중으로 만들지 않는다. 재게시 보도는 별도 예측자가 아니다.

보조 원문:

- [2025-08-18 당시 원문 임베드 보도](https://pintu.co.id/en/news/194881-analysis-from-cryptobirb-bitcoin-cycle-peak-predicted-to-happen-within-the-next-70-days)

### 46. 가을 최종고점 전망의 기록

- 원제: Analyst Identifies Bitcoin Price Pattern Resembling 2021
- 원문: https://forklog.com/en/analyst-identifies-bitcoin-price-pattern-resembling-2021/
- 계보: cowen-q4-2025; 시점: before; 입장: counter.
- 접근 상태: 기사 본문·8월11일 임베드 확인
- 이 순서로 읽는 이유: 동시기에 최종고점을 4분기로 보는 반대 전망이 존재했음을 확인한다.
- 한계: 영문판은 AI 번역 표시가 있다. 분기 적중과 중간 경로 전체 적중은 다르며 7월 고점권과 양립 가능하다.

### 47. 4분기 최종고점의 X 원문

- 원제: Admittedly, there is a lot going on with this chart…
- 원문: https://x.com/benjamincowen/status/1954742029696524339
- 계보: cowen-q4-2025; 시점: before; 입장: counter.
- 접근 상태: X 직접 403·색인과 당시 임베드 대조
- 이 순서로 읽는 이유: 작성 시점이 남은 가을 최종고점 시나리오다. 같은 status ID의 과거 계정명과 연결한다.
- 한계: 지역 표시 8월10일과 UTC 8월11일을 구분한다. 원문 전체와 수정 이력은 직접 확인하지 못했다.

### 48. 조기 종료 판단의 오류 인정

- 원제: CryptoQuant CEO admits he was wrong about Bitcoin bull cycle
- 원문: https://crypto.news/cryptoquant-ceo-admits-he-was-wrong-about-bitcoin-bull-cycle/
- 계보: ki-young-ju-revisions; 시점: during; 입장: counter.
- 접근 상태: 당시 보도 본문·과거 X 연결 확인
- 이 순서로 읽는 이유: 3월 강세장 종료 판단을 5월에 사과한 기록을 먼저 읽어 이후 구조 변화 발언의 맥락을 확보한다.
- 한계: 기사로 확인한 수정 이력이다. 원 X 전체·삭제·편집 이력은 인증하지 못했으며 3월 원문 링크는 방법 문서에 보존했다.

보조 원문:

- [주기영의 앞선 X 판단](https://x.com/ki_young_ju/status/1901776137715671191)

### 49. 사이클 이론 수정의 맥락

- 원제: Why Ki Young Ju Say “Bitcoin Cycle Theory Is Dead”
- 원문: https://beincrypto.com/why-ki-young-ju-say-bitcoin-cycle-theory-is-dead/
- 계보: ki-young-ju-revisions; 시점: during; 입장: mixed.
- 접근 상태: 본문·7월24일 X 임베드 확인
- 이 순서로 읽는 이유: 고래→소매에서 고래→신규 장기 고래로 바뀐다는 설명을 원래 맥락에서 읽는다.
- 한계: 구조 변화 주장이지 3~4개월 단축이나 7월 최종고점 예측이 아니다. 앞선 오류 인정과 같은 계보다.

### 50. 사이클 이론 수정의 X 원문

- 원제: Bitcoin cycle theory is dead.
- 원문: https://x.com/ki_young_ju/status/1948512682157519266
- 계보: ki-young-ju-revisions; 시점: during; 입장: mixed.
- 접근 상태: X 직접 403·당시 임베드 대조
- 이 순서로 읽는 이유: 검증 보도가 인용한 저자의 원문 주소를 보존한다.
- 한계: 원문 전체·수정 이력은 직접 확인하지 못했다. 단축 법칙의 지지자로 분류하지 않는다.

### 51. 완만한 하락 전망과 가격 오차

- 원제: Trump’s Executive Order: Can It Break Crypto’s Four-Year Cycle?
- 원문: https://experts.bitwiseinvestments.com/cio-memos/trumps-executive-order-can-it-break-cryptos-four-year-cycle
- 계보: bitwise-cycle-research; 시점: before; 입장: mixed.
- 접근 상태: 공식 메모 본문 확인
- 이 순서로 읽는 이유: 같은 기관의 짧고 완만한 하락장 논리와 2025년 가격 전망을 함께 평가해 성공 사례 선별을 피한다.
- 한계: 2025년 20만 달러 이상 전망은 관측값과 맞지 않았다. 이 실패가 모든 후속 분석을 자동 무효로 만들지도 않는다.

### 52. 고점 이후 회복 전망의 반례

- 원제: Monthly Outlook: Market Recalibration
- 원문: https://www.coinbase.com/institutional/research-insights/research/monthly-outlook/monthly-outlook-oct-2025
- 계보: coinbase-institutional-outlook; 시점: after; 입장: counter.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 급락 후 근기 바닥과 회복을 예상한 당시 견해를 포함해 현재 결과에 맞는 주장만 고르지 않는다.
- 한계: 당일~연말 BTC 방향은 기대와 어긋났다. 암호자산 전반·다른 기간을 다룬 모든 전망의 실패로 확대하지 않는다.

### 53. 기간 일관성과 낙관 전망

- 원제: 2025 – Year in Review
- 원문: https://k33.com/research/articles/2025-year-in-review
- 계보: k33-cycle-research; 시점: after; 입장: mixed.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 약 1,060일의 고점 간격을 인정하면서 기계적인 차기 약세장 추론에는 반대하는 자료다.
- 한계: 기간 단축의 주장이 아니다. 2026년 전망 기간은 아직 끝나지 않아 연간 성패를 확정하지 않는다.

### 54. 7월 이후 분산의 사후 진단

- 원제: An Early Black Friday
- 원문: https://research.glassnode.com/the-week-onchain-week-41-2025/
- 계보: glassnode-cycle-observations; 시점: after; 입장: support.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 7월 이후 장기보유자 공급 감소와 상승 동력 약화를 수치로 설명한다.
- 한계: 10월에 발행된 분석이다. 7월 사전 예측이 아니며 온체인 지출·분류 변화 전부를 거래소 확정 매도로 간주하지 않는다.

### 55. 7월 고점과 장기보유자 지출

- 원제: A Market Hedged in Fear
- 원문: https://research.glassnode.com/the-week-onchain-week-42-2025/
- 계보: glassnode-cycle-observations; 시점: after; 입장: support.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 7월 고점 이후 30일 평균 지출 증가를 직접 설명해 넓은 고점 형성 해석을 보강한다.
- 한계: 7월은 국지적 고점 문맥이다. 10월의 사상 최고가와 구분해야 하며 3~4개월 단축의 통계 검정은 아니다.

### 56. 6월 저점의 사후 모형 평가

- 원제: The Bitcoin Bottom Explained
- 원문: https://bitwiseinvestments.eu/blog/crypto-research/the-bitcoin-bottom-explained/
- 계보: bitwise-cycle-research; 시점: after; 입장: support.
- 접근 상태: 공식 연구 본문·검증 방식 확인
- 이 순서로 읽는 이유: 여러 지표와 검증 설계를 평가할 수 있는 공개 모형이다. 사전 시나리오와 분리해 읽는다.
- 한계: 9월 공개된 6월 점수는 당시 공표된 예측이 아니다. 점수는 확정 확률이 아니며 주기 제외 검증은 시간순 검증과 다르다.

### 57. 짧고 얕은 하락장 해석

- 원제: The Shallowest Bear Ever: Why Sticky Institutional Hands Are Rewriting Bitcoin’s Cycle
- 원문: https://bitwiseinvestments.eu/blog/regular-updates/Bitwise_Crypto_Market_Compass_2026_40/
- 계보: bitwise-cycle-research; 시점: after; 입장: support.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 6월 저점을 짧고 얕은 하락장으로 보는 해석을 3월 시나리오와 연결해 추적한다.
- 한계: 현재 후보가 유지된다는 조건이 있다. 같은 기관의 3월·9월 연구를 독립 기관 셋의 적중으로 세지 않는다.

### 58. 6월 저점 이후 회복과 저항

- 원제: Boxed In
- 원문: https://research.glassnode.com/the-week-onchain-week-41-2026/
- 계보: glassnode-cycle-observations; 시점: after; 입장: mixed.
- 접근 상태: 공식 연구 본문 확인
- 이 순서로 읽는 이유: 6월30일 종가 저점과 이후 회복·상단 저항을 함께 다뤄 현재 구조를 점검한다.
- 한계: 최저 종가를 확인하는 사후 자료다. 앞으로 더 낮은 저점이 나오지 않음을 보장하지 않는다.

### 59. 하락 폭의 다른 자료 대조

- 원제: Re-Underwriting Bitcoin: Still a Portfolio Diversifier After the Pullback?
- 원문: https://www.blackrock.com/us/individual/literature/whitepaper/re-underwriting-bitcoin.pdf
- 계보: blackrock-bloomberg-coinmetrics; 시점: after; 입장: data.
- 접근 상태: 공식 PDF 본문·가격 도표 확인
- 이 순서로 읽는 이유: 최고·최저 가격과 약 53% 하락을 다른 보고서의 도표와 대조한다.
- 한계: 자료 기준은 7월17일이다. Bloomberg·Coin Metrics가 출처여서 주 자료와 완전히 독립된 가격 검증으로 세지 않는다.

### 60. 기한이 있는 피보나치 예상

- 원제: Daily Discussion – Saturday, February 07, 2026 · $58k prediction
- 원문: https://www.reddit.com/r/BitcoinMarkets/comments/1qy4tvy/comment/o42j5n5/
- 계보: reddit-fib-58k-2026; 시점: before; 입장: counter.
- 접근 상태: 원 댓글, 피보나치 설명 댓글, 봇의 2월 14일 기한 기록 확인. 수정 이력 전체는 미확인.
- 이 순서로 읽는 이유: 일주일 안 $58k라는 조건을 Coinbase 장중 저가로 대조했다. 2월 7~14일 최저는 $65,065.47로 기한 안 도달하지 않았다.
- 한계: 피보나치 앵커·축척·계산식이 제시되지 않은 한 사례다. 이 실패 하나가 모든 피보나치 기법의 통계적 반증은 아니다.

보조 원문:

- [예측 봇의 목표·마감 시각 기록](https://www.reddit.com/r/BitcoinMarkets/comments/1qy4tvy/comment/o43dv8v/)
- [작성자의 피보나치 근거 설명](https://www.reddit.com/r/BitcoinMarkets/comments/1qy4tvy/comment/o42svcv/)
- [기한 전체를 포함한 공식 거래소 일중 저가](https://api.exchange.coinbase.com/products/BTC-USD/candles?start=2026-02-07T00%3A00%3A00Z&end=2026-02-15T00%3A00%3A00Z&granularity=86400)

### 61. 2026년 저점 날짜의 사전 예측

- 원제: Four year cycle update - predicting the bottom
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1ozhku2/four_year_cycle_update_predicting_the_bottom/
- 계보: merklechainsaw-bottom-forecast; 시점: before; 입장: counter.
- 접근 상태: 공개 본문·표·댓글 확인
- 이 순서로 읽는 이유: 후속 오류 인정과 연결되는 원 예측을 보존한다. 결과 전에 남긴 날짜·가격을 평가할 수 있다.
- 한계: 2026-10-08·약 $37,400은 작성자의 규칙이다. 원게시 판본·전체 수정 이력은 없고 공식 UTC 가격 기준과 같다고 가정하지 않는다.

### 62. 같은 예측자의 실패 인정

- 원제: Four year cycle update - Uncharted territory
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1x0p9kc/four_year_cycle_update_uncharted_territory/
- 계보: merklechainsaw-bottom-forecast; 시점: after; 입장: mixed.
- 접근 상태: 공개 본문·연결 원글·댓글 확인
- 이 순서로 읽는 이유: 가격이 예상보다 크게 높았음을 인정한 기록이다. 선행 예측과 한 쌍으로 읽는다.
- 한계: 한 모델의 실패가 모든 주기의 소멸을 증명하지 않는다. 두 글은 독립 예측 두 건이 아니다.

### 63. 최종고점 시간은 일관적이라는 반론

- 원제: Freakishly consistent cycle
- 원문: https://www.reddit.com/r/Bitcoin/comments/1p18dcc/freakishly_consistent_cycle/
- 계보: reddit-consistent-cycle; 시점: after; 입장: counter.
- 접근 상태: 공개 본문·댓글 확인
- 이 순서로 읽는 이유: 절대 최고가의 시간 간격을 비교한 반대 해석과 선행 거래 댓글을 함께 보존한다.
- 한계: 원문의 연도 오기·미래 반감기 고정 가정에 주의한다. 표의 날짜·가격은 별도 공식 데이터로 재계산해야 한다.

### 64. 조기 저점 보고서의 뉴스 요약

- 원제: Bitcoin price bottom coming sooner than expected
- 원문: https://www.dlnews.com/articles/markets/bitcoin-price-bottom-coming-sooner-than-expected/
- 계보: bitwise-cycle-research; 시점: before; 입장: support.
- 접근 상태: 보도 본문·원보고서 대조
- 이 순서로 읽는 이유: 원문 2~6개월 범위가 뉴스에서 어떻게 좁혀 전달됐는지 확인한다.
- 한계: 6~7월 강조를 정확한 6월30일 예측으로 바꾸지 않는다. Bitwise와 독립된 예측이 아니다.

### 65. 여름 전망의 번역·재전파

- 원제: BTC Naik 137% dalam Setahun, Analis Crypto Prediksi Puncak Baru di Pertengahan Juli 2025!
- 원문: https://pintu.co.id/news/123892-para-analis-crypto-prediksi-bitcoin-capai-puncak-juli-2025
- 계보: dave-lgc-summer-2025; 시점: before; 입장: mixed.
- 접근 상태: 본문·X 임베드 날짜·원기사 표기 확인
- 이 순서로 읽는 이유: Dave의 원문 날짜를 보조 대조하고 제목과 본문의 불확실성 차이를 살핀다.
- 한계: Cointelegraph를 명시적으로 재인용했다. 독립 모델이나 추가 적중 사례로 세지 않는다.

### 66. 여름 전망의 레딧 확산

- 원제: Bitcoin technical indicator predicts BTC price cycle top in summer 2025
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1i0dm2o/bitcoin_technical_indicator_predicts_btc_price/
- 계보: dave-lgc-summer-2025; 시점: before; 입장: mixed.
- 접근 상태: 제목·기사 링크·댓글·bot 요약 확인
- 이 순서로 읽는 이유: 사전 여름 전망이 유통된 경로와 자동 요약에서 오차 범위가 약해지는 과정을 보여준다.
- 한계: 공유자·기사·bot를 독립 예측으로 세지 않는다. 원게시 당시 판본과 수정 이력은 미확보다.

### 67. 반감기 달력 이동의 댓글

- 원제: Daily Crypto Discussion - July 8, 2025 (GMT+0) · MichaelAischmann comment
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1luqv5x/comment/n247wnf/
- 계보: reddit-halving-calendar; 시점: before; 입장: support.
- 접근 상태: 특정 댓글·주변 대화 확인
- 이 순서로 읽는 이유: 반감기의 달력상 앞당김에서 사이클 이동 가능성을 논한 사전 개인 견해다.
- 한계: 개별 댓글의 정확한 UTC 시각은 미확보다. 달력 이동과 반감기 후 기간 단축을 구분해야 하며 3~4개월 추정치는 없다.

보조 원문:

- [7월8일 전체 토론](https://www.reddit.com/r/CryptoCurrency/comments/1luqv5x/daily_crypto_discussion_july_8_2025_gmt0/)

### 68. 먼저 팔아 고점이 당겨진다는 설명

- 원제: My takeaway from being in crypto for 8+ years.
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1oo38yo/my_takeaway_from_being_in_crypto_for_8_years/
- 계보: reddit-randomjoe-front-running; 시점: after; 입장: support.
- 접근 상태: 공개 본문·상반된 댓글 확인
- 이 순서로 읽는 이유: 사용자와 가까운 선행 매도 메커니즘이 실제로 논의됐음을 보여준다.
- 한계: 10월 고점 뒤의 설명이다. 7월 사전 예측이나 3~4개월의 계량 추정으로 재분류하지 않는다.

### 69. 시장 성숙·주기 약화 논쟁

- 원제: Bitcoin’s four-year cycle loses grip as maturing market reshapes dynamics
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1m95kae/bitcoins_fouryear_cycle_loses_grip_as_maturing/
- 계보: bitwise-cycle-research; 시점: during; 입장: mixed.
- 접근 상태: 공유 미리보기·댓글 확인
- 이 순서로 읽는 이유: 기관 투자와 주기 약화 논의가 여름에 존재했음을 기록한다. 연장·선행 등 다른 해석도 함께 있다.
- 한계: 연결된 CryptoSlate 기사 전문은 별도 검증하지 않았다. 공유자가 기사 주장에 동의했다고 단정하지 않는다.

### 70. 7월의 횡보·연장 논쟁

- 원제: [Daily Discussion] - Sunday, July 27, 2025
- 원문: https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/daily_discussion_sunday_july_27_2025/
- 계보: reddit-july27-sideways; 시점: during; 입장: mixed.
- 접근 상태: 세 관련 댓글·주변 문맥 확인
- 이 순서로 읽는 이유: 당시에도 횡보를 관찰했지만 이후 완만한 상승·사이클 연장 해석이 공존했음을 확인한다.
- 한계: Riker-Was-Here·Order_Book_Facts·Knerd5의 개별 링크는 방법 문서에 보존했다. 기간 수치·편집 전 판본은 독립 검증하지 않았다.

보조 원문:

- [Riker-Was-Here의 횡보 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5foyyb/)
- [Order_Book_Facts의 반론 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5fu0ks/)
- [Knerd5의 연장 가능성 댓글](https://www.reddit.com/r/BitcoinMarkets/comments/1mact5u/comment/n5g6vir/)

### 71. 가을 고점 우려와 광고 문맥

- 원제: are we looking at a bitcoin cycle top in the next 2-3 months?
- 원문: https://www.reddit.com/r/btc/comments/1mwmidj/are_we_looking_at_a_bitcoin_cycle_top_in_the_next/
- 계보: reddit-august-top-question; 시점: before; 입장: mixed.
- 접근 상태: 본문·댓글·홍보 링크 존재 확인
- 이 순서로 읽는 이유: 10월 전의 고점 근접 경고와 반대 해석을 보존한다.
- 한계: 세금 서비스 홍보가 섞여 있다. 인용 수치의 독립 검증이나 7월 고점권 단축 예측은 아니다.

### 72. 9월의 고점 질문과 반론

- 원제: Is it over/almost over?
- 원문: https://www.reddit.com/r/CryptoCurrency/comments/1nn6k91/is_it_overalmost_over/
- 계보: reddit-september-top-question; 시점: before; 입장: mixed.
- 접근 상태: 게시자 삭제·본문과 댓글은 확인
- 이 순서로 읽는 이유: 10월 전에도 열광 없는 고점 가능성과 기존 반감기 일정이 논쟁 대상이었음을 확인한다.
- 한계: 작성자의 예측 이력과 편집 이력은 미확보다. 질문을 검증된 예측이나 일관된 지지 견해로 세지 않는다.

### 73. 개인의 석 달 횡보 관찰

- 원제: Where is the real volatility?
- 원문: https://www.reddit.com/r/Bitcoin/comments/1n9t5z5/where_is_the_real_volatility/
- 계보: reddit-volatility-observation; 시점: during; 입장: support.
- 접근 상태: 공개 본문 확인
- 이 순서로 읽는 이유: 최고가 전에 석 달 전과 비슷한 가격이라는 개인 관찰이 있었음을 보조 기록한다.
- 한계: 95% 체류율·분산·3~4개월 압축을 정량 검증하지 않아 핵심 가격 근거로 쓰지 않는다.

### 74. 장기보유자 감소의 X 발췌

- 원제: Long-term holder supply has declined by another 28K BTC…
- 원문: https://x.com/glassnode/status/1980645562694389891
- 계보: glassnode-cycle-observations; 시점: after; 입장: support.
- 접근 상태: X 직접 403·검색 색인만 확인
- 이 순서로 읽는 이유: 공식 연구의 소셜 전달 경로를 보존하되 보고서와 독립된 증거로 세지 않는다.
- 한계: 날짜는 ID 기반 보조 추정이다. 10월15일 이후 28K와 보고서의 7월 이후 0.3M 감소는 다른 기간이며 전체 문맥은 미확인이다.

### 75. 삭제된 연장 논쟁의 기록

- 원제: Which side are you on: Bull run ends in Q4 2025 or Extended Cycle 2026?
- 원문: https://www.reddit.com/r/CryptoMarkets/comments/1o65wdz/which_side_are_you_on_bull_run_ends_in_q4_2025_or/
- 계보: reddit-deleted-extension; 시점: after; 입장: context.
- 접근 상태: 제목·스레드 날짜·일부 댓글만 확인
- 이 순서로 읽는 이유: 조사에서 접했지만 핵심 주장 증거로 채택하지 않은 자료의 경계를 공개한다.
- 한계: 본문 삭제로 원주장을 복원할 수 없다. 제목이나 남은 댓글로 작성자의 확정 견해를 만들어내지 않는다.

### 76. 원사이트 실제 이용 기록

- 원제: Bitcoin cycles comparison: halving, top, bottom, crossing top of previous cycle.
- 원문: https://bitcointalk.org/index.php?topic=5512441.msg64612416
- 계보: original-site-reconstruction; 시점: data; 입장: context.
- 접근 상태: 게시물·설명·이미지 확인·2024-10-09 수정 표시
- 이 순서로 읽는 이유: 실제 범례와 네 비교 기준을 확인한 복원 근거다. 출발가격 정규화의 원래 목적을 이해할 수 있다.
- 한계: 공식 제작자 문서가 아니다. 게시자를 제작자로 추정하지 않으며 데이터 공급자·내부 계산은 확인하지 못했다.

보조 원문:

- [원사이트의 실제 차트 이미지](https://i.ibb.co/XzgRhBv/Bitcoincyclecomparison.png)
- [BitcoinTalk 전체 주제](https://bitcointalk.org/index.php?topic=5512441.0)

### 77. 보존된 원사이트 UI 셸

- 원제: Bitcoin Cycles Comparison · Wayback capture
- 원문: https://web.archive.org/web/20240321184519/https://www.bitcoincyclescomparison.com/
- 계보: original-site-reconstruction; 시점: data; 입장: context.
- 접근 상태: 정상 HTML UI 셸 확인·차트는 로딩 상태
- 이 순서로 읽는 이유: 당시 레이아웃과 기술 흔적을 보존한 기록이다. 이용자 화면과 함께 복원 범위를 정한다.
- 한계: 가격 시계열과 핵심 계산 소스를 확보하지 못했다. 보존된 셸이 전체 실행 복구를 뜻하지 않는다.

### 78. 원사이트와 남은 검색 색인

- 원제: Bitcoin Cycles Comparison
- 원문: https://www.bitcoincyclescomparison.com/
- 계보: original-site-reconstruction; 시점: data; 입장: context.
- 접근 상태: 직접 요청 HTTP 503·검색 색인 확인
- 이 순서로 읽는 이유: 복원 대상의 실제 주소와 자가 설명이 남은 위치를 보존한다.
- 한계: 실행 가능한 원사이트 본문을 확보하지 못했다. 색인만으로 전체 UI·계산·제작자를 확인할 수 없다.

### 79. 후속 보존본의 오류 셸

- 원제: Bitcoin Cycles Comparison · Wayback requested snapshot
- 원문: https://web.archive.org/web/20251014000000/https://www.bitcoincyclescomparison.com/
- 계보: original-site-reconstruction; 시점: data; 입장: context.
- 접근 상태: 후속 요청에서 Next.js 오류 셸 확인
- 이 순서로 읽는 이유: 정상 복구가 되지 않은 부분을 보존해 확인 범위를 과장하지 않도록 한다.
- 한계: 요청 주소가 실제 캡처일·기능 보존을 보증하지 않는다. 핵심 app/page JavaScript는 404였으며 차트 실행을 복구하지 못했다.

### 80. 2024년 안의 조기 최종 고점 대안

- 원제: The All New Cycle Timing
- 원문: https://www.bitcoindatanewsletter.com/p/the-all-new-cycle-timing
- 계보: cryptocon-cycle-timing; 시점: before; 입장: mixed.
- 접근 상태: 공개 도입부 확인·유료 본문 미열람
- 이 순서로 읽는 이유: 빠른 신고가 이후 최종 고점까지 빨라질 수 있다는 대안을 검토한 기록이다.
- 한계: 유료 본문의 확률·실패 조건은 확인하지 못했다. 후속 전망으로 이 공개 당시의 대안을 덮어쓰지 않는다.

### 81. 2025년 여러 고점 가능성으로 달력 복귀

- 원제: Return of the Halving Cycles
- 원문: https://www.bitcoindatanewsletter.com/p/return-of-the-halving-cycles
- 계보: cryptocon-cycle-timing; 시점: before; 입장: mixed.
- 접근 상태: 본인의 공개 영상 소개 확인·영상 전체 미열람
- 이 순서로 읽는 이유: 조기 최종 고점 대안과 이후 2025년 달력을 나란히 비교하는 자료다.
- 한계: 소개에 나타난 방향만 확인했다. 상세 계산과 영상 전체를 검증한 기록이 아니다.

### 82. 2021년 고점 경고와 연말 재상승의 조건

- 원제: Bitcoin Data Newsletter — Big Update
- 원문: https://www.bitcoindatanewsletter.com/p/bitcoin-data-newsletter
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 본인의 공개 뉴스레터 본문 확인
- 이 순서로 읽는 이유: 당시 고점 경고의 조건과 재상승 가능성을 함께 읽어 후대의 단순한 적중·실패 평가를 점검한다.
- 한계: 실제 체결 기록을 검증한 자료가 아니다. 64,000달러는 이미 나타난 고점 판단이며 새 미래 목표가가 아니다.

### 83. 2021년 예상 오류와 2022년 저점권 판단

- 원제: What Happened to Bitcoin?
- 원문: https://www.bitcoindatanewsletter.com/p/what-happened-to-bitcoin
- 계보: cryptocon-cycle-timing; 시점: during; 입장: mixed.
- 접근 상태: 본인의 공개 뉴스레터 본문 확인
- 이 순서로 읽는 이유: 두 번째 고점을 예상하지 못한 회고와 당시의 저점권 의견을 별도로 보존한다.
- 한계: 당시 저점권 의견은 정확한 최저점 날짜 예측이 아니다. 자기보고 매매 성과의 독립 감사도 아니다.

### 84. 원래 고점 창·2025년 11월 28일 ±21일

- 원제: Original narrow cycle-top timing window
- 원문: https://x.com/CryptoCon_/status/1862142528939532706
- 계보: cryptocon-cycle-timing; 시점: before; 입장: counter.
- 접근 상태: 본인 X 검색 색인 확인·직접 페이지 접근 제한
- 이 순서로 읽는 이유: 사후의 10–12월 창을 원래의 더 좁은 창과 구별한다. 관측 고점은 원래 창 시작보다 32일 빨랐다.
- 한계: 게시 당시 이미지와 편집 이력은 확보하지 못했다. 넓어진 창의 일치를 원래 좁은 창의 성공으로 세지 않는다.

### 85. 152주 비교에서 제시한 2025년 10월 고점

- 원제: 152-week bottom-to-top timing
- 원문: https://x.com/CryptoCon_/status/1933580045546651799
- 계보: cryptocon-cycle-timing; 시점: before; 입장: support.
- 접근 상태: 원본 검색 색인·날짜 있는 보도 재현 대조·직접 X 접근 제한
- 이 순서로 읽는 이유: 최종 관측 고점이 나온 10월과 월 단위로 일치하는 별도 사전 전망이다.
- 한계: 152는 주 수이며 152,000달러 목표가가 아니다. 월 단위 일치는 일별 반전·가격 적중을 의미하지 않는다.

### 86. 166,754달러·9월 목표의 기한 내 결과

- 원제: Bitcoin price to see 52% increase to $166,000
- 원문: https://www.newsbtc.com/es/news/bitcoin/bitcoin-52-increase-to-166000/
- 계보: cryptocon-fibonacci-price; 시점: before; 입장: counter.
- 접근 상태: 보도 날짜·본문 대조·원래 X 전체 맥락 미확보
- 이 순서로 읽는 이유: 7월 4일–9월 30일 최대 일말값 $123,442.68은 명시 목표보다 25.97% 낮았다. 비율선 계산과 실제 도달을 구별한다.
- 한계: 기한은 2차 보도로 확인했다. 장중 고가까지 채점한 자료가 아니며, 기사의 축약 목표 숫자에도 불일치가 있다.

### 87. 2026–2029 단계별 달력·AI 영상 요약

- 원제: The Hive
- 원문: https://www.bitcoindatanewsletter.com/p/the-hive
- 계보: cryptocon-cycle-timing; 시점: before; 입장: context.
- 접근 상태: 저자 사이트 공개 AI 요약·원본 영상 및 전사 대조 미실시
- 이 순서로 읽는 이유: 다중 고점·저점 단계를 나눈 외부 달력의 참고 출처다. 발표일과 후속 수정 이력을 함께 읽는다.
- 한계: 직접 저자 문장과 같은 등급이 아니다. 가격 목표가 없으므로 정확한 미래 가격 곡선으로 변환하지 않는다. 미도래 창을 성공·실패로 판정하지 않는다.

