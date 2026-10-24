# Ethereum 정책·규제·통화정책 사건 조사

검증 기준일: **2026-10-24 UTC**. 입력 데이터: `research-data/ethereum-policy-events.json`.

## 조사 결과와 범위

이 묶음은 **43개 사건: 거시·정치 17개, 규제 26개**를 제공한다. 첫 표식은 2015-12-16, 마지막 표식은 2026-09-16이다. 87개의 서로 다른 URL을 열어 필요한 본문을 확인했다. 자료를 찾기만 한 검색 결과, 접근 오류가 난 페이지, 본문을 읽지 못한 페이지를 채택 사건의 근거로 넣지 않았다. 원문 전체를 복제하지 않고 사건별 정책 사실, 날짜, 근거 역할, 한계를 요약했다.

선정 기준은 명확한 관측 날짜, Ethereum의 거래·발행·스테이킹·DeFi·유동성 환경과의 관련성, 주요 제도 전환 또는 위기 대응이라는 중요성, 최소 두 개의 확인 가능한 문서다. 매 FOMC 회의, 모든 국가의 작은 규정 변경, 의견·루머를 기계적으로 수집하지 않았다. 금융 여건의 사건은 ETH만을 대상으로 하는 조치가 아니라는 점을 유지했다.

기존 프로토콜 및 시장 사건, ETH 현물 ETP 승인·거래, 관세, 해킹·거래소 파산·전쟁은 별도 묶음과 중복하지 않았다. 특히 2017년 SEC DAO **조사보고서**는 2016년 DAO **공격·하드포크**와 다른 사건이다. 2019-08-05 미국의 중국 환율조작국 지정은 관세 조사 묶음에서 담당한다. WHO의 팬데믹 선언, Maker Black Thursday, SVB·USDC 및 2023년 은행위기 대응은 시장 조사 담당과 조정했다.

## 날짜와 근거를 다루는 방식

- `datePrecision`은 모두 `source-calendar-day`다. 분·초 단위 블록 검증이나 전 세계의 동시 공개를 주장하지 않는다. 문서에 명시된 사건 날짜를 쓰며, 특정 발표 시각의 시간대 변환이 확인되는 경우에만 날짜 차이를 설명한다.
- `dateBasis`는 회의 결정, 서명, 공표, 시행, 판결, 보도기관의 개표 판정 중 무엇을 표식으로 삼았는지 명시한다. 관보 게재일이나 재게시일을 원래 사건일로 바꾸지 않는다.
- `publishedAt`은 열린 문서에 표시된 게시·발행 날짜다. 게시 페이지의 시각·갱신 때문에 원래 사건일과 다를 수 있다. 국가기록원의 2024년 선거 결과 페이지 및 ESMA의 2024년 12월호는 정확한 발행 날짜를 확인하지 못해 `null`이다. 파일 디렉터리 이름으로 날짜를 만들지 않았다.
- 모든 출처에는 `publisher`, `type`, `role`, `claim`, `accessedAt`을 둔다. `primary`는 해당 기관의 결정·법령·자기 활동 기록을 뜻한다. 정책 효과에 관한 독립적인 실증 분석이라는 뜻이 아니다.
- 동일 기관의 여러 문서, 같은 통신사의 두 기사, 공동 발표기관들의 자료는 서로 독립된 두 증거라고 과장하지 않는다. 예를 들어 SEC·CFTC 공동 해석은 원문과 공동 발행기관의 확인이고, 한국 법 시행 및 MiCA 적용은 같은 감독기관의 사전·후속 기록 대조다.
- `policyAction`은 확인된 정책 사실이다. `marketContext`는 출처가 있는 당시 보도의 맥락으로 제한한다. 실제 Coinbase ETH-USD OHLC 관측은 통합 단계의 별도 계산이다. 원인 추정, 예측, 수학적 가격 모델, 특정 수익률 주장은 이 묶음에 없다.

## 오해가 생기기 쉬운 핵심 판단

### 법적 단계와 후속 변경

Hinman의 2018년 연설은 개인 견해라는 각주가 있는 연설이다. 2025년 5월·8월 스테이킹 문서는 직원 견해이며 위원회 규칙이 아니다. 2026년 3월 문서는 위원회 해석으로 단계가 다르고, ETH 자산과 이를 이용한 투자계약 거래도 구분한다. 2026년 8월 Regulation Crypto Assets는 **제안**으로 표시했다. 10월 20일 제출된 업계 의견서가 최종 채택을 요청하는 기록이지 제안이 이미 법률로 확정됐다는 증거가 아니다.

2022년 Tornado Cash 지정은 2024년 항소심과 2025-03-21 행정 해제까지 연결했다. 경제제재 해제, 특정 불변 계약에 대한 IEEPA 권한 판단, 개발자 개인의 별도 형사책임은 서로 다른 문제다. 2023년 Coinbase 제소와 2025-02-27 철회 발표도 함께 연결했다. SEC가 철회 이유를 본안 판단으로 설명하지 않았으므로 이를 ETH 증권성에 대한 법원 승소로 쓰지 않는다.

2021년 중국의 거래 통지는 **서명 9월 15일 / 공개 9월 24일**을 구분했다. 공개일을 표식으로 삼았으며, 2026-02-06 새 통지의 명시적인 대체·폐지를 후속 사실로 넣었다. 2021-05-21 국무원 회의는 BTC 채굴·거래 단속 방침이다. 원문이 ETH를 직접 명시한 것처럼 바꾸지 않고, ETH 시장의 당시 관심은 별도 보도 역할로 표시했다.

Biden의 2022년 디지털자산 행정명령은 2025년 1월 폐지됐다. GENIUS Act의 법률 성립은 2025-07-18이며 제20조의 일반 효력 조건은 별도다. 성립 18개월 뒤와 주요 연방 감독기관 최종 규정 후 120일 중 이른 날이라는 조건을 남겼으며 2026년 임의의 날짜를 시행일로 계산해 넣지 않았다. 2025년 3월 비BTC 디지털자산 비축 명령은 ETH의 신규 시장 매입 발표로 해석하지 않는다.

### 한국 정치·거래 환경과 UTC

한국 계엄은 2024-12-03 밤 선포와 12-04 새벽 해제로 보도됐지만 UTC 날짜는 모두 **12월 3일**이다. 연합뉴스가 기록한 국무회의 해제 의결 04:30 KST는 전날 19:30 UTC다. 선포의 정확한 분 단위 표현은 담화 시작·선포 구간에 따라 달라질 수 있어 하나의 초 단위 시각으로 단정하지 않았다.

시장 맥락은 국내 원화 거래소의 ETH 등 급변·접속 지연에 관한 연합뉴스 보도다. 이는 Coinbase 달러 가격 관측과 같지 않다. 헌법재판소의 2025-04-04 결정은 후속 탄핵 판단의 근거이고 당시 가격 반응의 근거가 아니다. 판결의 정치적 평가나 별도 형사재판의 결과를 추론하지 않았다.

한국 2018년 실명계정은 발표 1월 23일 / 도입 1월 30일, 이용자보호법은 제정 2023년 7월 18일 / 사전 안내 2024년 7월 17일 / 시행 7월 19일을 분리했다. 법률의 현지 달력 시행일을 정밀 UTC 초 단위 활성화로 주장하지 않는다.

### 통화정책·EU 규제

테이퍼링은 순매입 속도의 감속이고 양적긴축은 보유 증권의 축소다. 2021년 11월, 2022년 5월의 발표, 2025년 10월의 축소 종료 발표를 이 구분에 맞게 기술했다. 2020년 3월 15일 정책금리 100bp 인하와 별도 재할인창구 금리 인하를 혼동하지 않았다. 2026년 9월의 25bp 인상은 공식 성명과 10월 7일 후속 보도로 확인된 역사적 결정이며, 기사에 실린 10월·12월 금리 예상은 제외했다.

일본은행은 2024년 3월 19일 결정과 3월 21일 적용, 7월 31일 결정과 8월 1일 적용을 분리했다. 당시 결정이 후속 ETH 급락의 단일 원인이라는 주장은 하지 않았다.

MiCA는 2023-05-16 EU 이사회 채택과 2024-12-30 주요 규정 적용을 분리했다. ESMA 뉴스레터의 느슨한 “entered into force” 표현을 그대로 법률 발효일로 옮기지 않고 본문의 “entry into application” 및 기존 사업자 전환 설명에 맞춰 표기했다. 국가별 전환 기간과 모든 사업자의 인가 완료는 같은 사실이 아니다.

## 별도 표식으로 채택하지 않은 후보·경계

| 후보 또는 주장 | 처리 이유 |
|---|---|
| 2018년 한국 거래소 전면 폐쇄 | 당시의 논의·발언을 확정된 전면 폐쇄로 기록할 수 없다. 날짜와 집행 내용이 확정된 실명계정 발표를 채택했다. |
| 2025년 중국 역외 위안화 스테이블코인 허용 검토 보도 | 익명 취재원의 검토·예정과 확정 정책을 구분했다. 2026-02-06 공개·시행 통지를 채택했다. |
| 2026-07-01 MiCA 최대 전환 기간 종료 | 공식적으로 사전 안내된 기한은 확인했다. 이번 검증에서 2026년 후속 ESMA 원문 일부가 403으로 열리지 않아 실제 종료를 확인하는 별도 완료 표식을 추가하지 않았다. 2024년 적용 사건에는 국가별 전환이라는 한계를 남겼다. 이 제외는 기한이 연장됐다는 주장이 아니다. |
| 미국 CLARITY 등 시장구조 법안의 최종 법률 성립 주장 | 이번 묶음에서 서명된 최종 법률과 정확한 효력 단계까지 확인하지 못한 주장은 넣지 않았다. 확정된 GENIUS 법률, 2026년 해석, 실제 공개된 규칙안은 각각의 단계로 기록했다. |
| 모든 FOMC 인상·인하, 정치인의 모든 발언 | 주요 방향 전환·긴급 대응·정책 체계 변화에 집중했다. 동일 정책의 반복 회의를 모두 독립된 중요 사건으로 늘리지 않았다. |
| 2026년 10월 24일 뒤의 회의·선거·규칙 채택 | 미래 또는 검증 기준일 뒤의 사건이다. 기사에 실린 전망을 완료 사건으로 바꾸지 않았다. |
| 한국 원화 거래소의 당시 급락률을 ETH-USD 일봉에 대입 | 통화·거래소·관측 창이 다르다. 통합 코드가 직접 계산하는 Coinbase 수익률만 별도 관측으로 쓴다. |

## 사건별 증거 기록

아래 링크는 모두 본문을 열어 사용한 주장 범위를 확인했다. 원문·후속 기록·보도 역할은 JSON의 `sources[].role` 및 `claim`에 더 구체적으로 남겼다. 날짜와 짧은 제목이 같은 행에서 결합되지만 인과관계를 뜻하지 않는다.

### 2015-12-16 · 美 금리 정상화

ID: `eth-policy-fed-2015-liftoff` · 분류: `macro` · 중요도: 2

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2015-12-16](https://www.federalreserve.gov/newsevents/pressreleases/monetary20151216a.htm) — Federal Reserve, 2015-12-16, primary. 연방기금금리 목표 범위를 0.25–0.50%로 올리기로 결정했다.
- [Economists see next Fed rate increase in first quarter of 2016: Reuters poll](https://www.reuters.com/article/business/economists-see-next-fed-rate-increase-in-first-quarter-of-2016-reuters-poll-idUSKBN0TZ31O/) — Reuters, 2015-12-16, secondary. 당일 25bp 인상과 2006년 이후 첫 인상이라는 사실을 확인한다. 설문에 실린 미래 금리 전망은 사용하지 않는다.

### 2017-07-25 · SEC DAO 보고서

ID: `eth-policy-dao-sec-report` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 조사보고서 표지의 2017-07-25를 사용한다. Reuters 페이지의 다음 날 게시일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Report of Investigation Pursuant to Section 21(a): The DAO, Release 81207](https://www.sec.gov/files/litigation/investreport/34-81207.pdf) — SEC, 2017-07-25, primary. 7월 25일 조사보고서는 DAO 토큰의 증권법 적용을 분석했다. 보고서의 대상은 DAO 토큰이며 ETH 전체에 대한 판결이 아니다.
- [Wall Street regulator sets sights on digital coin offerings](https://www.reuters.com/article/business/wall-street-regulator-sets-sights-on-digital-coin-offerings-idUSKBN1AA2OK/) — Reuters, 2017-07-26, secondary. 7월 25일 화요일 공개된 DAO 조사보고서와 제재 없이 보고서로 종결한 조치를 확인한다.

### 2017-09-04 · 중국 ICO 금지

ID: `eth-policy-china-ico-ban` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공동 공고 게시일 2017-09-04. 다음 날 Reuters 보도는 월요일의 공표를 확인한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [关于防范代币发行融资风险的公告](https://www.cac.gov.cn/2017-09/04/c_1121603512.htm) — People’s Bank of China and six co-issuing authorities / Cyberspace Administration of China, 2017-09-04, primary. ICO를 중단하도록 하고 이미 진행한 발행의 환급 정리를 요구했다. 모집 자산의 예로 비트코인과 이더를 명시했다.
- [China’s virtual coin fundraising ban just the start of tighter regulations — Yicai](https://www.reuters.com/jp/article/chinas-virtual-coin-fundraising-ban-just-the-start-of-tighter-regulations-yic-idUSL4N1LM186/) — Reuters, 2017-09-05, secondary. 월요일인 9월 4일 당국의 ICO 금지 공표를 확인한다. 향후 규제 전망은 사용하지 않는다.

### 2018-01-23 · 한국 실명계정

ID: `eth-policy-korea-real-name-accounts` · 분류: `regulation` · 중요도: 2

**날짜 판단:** 금융위 발표와 Reuters 브리핑 보도가 일치하는 2018-01-23. 시행 예정일 1월 30일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FSC Announces Measures to Curb Speculation in Cryptocurrency Trading](https://www.fsc.go.kr/eng/pr010101/22173) — Financial Services Commission, Korea, 2018-01-23, primary. 1월 23일 발표문은 1월 30일부터 가상통화 거래에 실명확인 입출금 계정 서비스를 도입하는 일정을 명시한다.
- [South Korea to ban cryptocurrency traders from using anonymous bank accounts](https://www.reuters.com/article/technology/south-korea-to-ban-cryptocurrency-traders-from-using-anonymous-bank-accounts-idUSKBN1FC069/) — Reuters, 2018-01-23, secondary. 1월 23일 브리핑과 1월 30일 실명 일치 요건 시행 계획을 확인한다.

### 2018-06-14 · Hinman ETH 발언

ID: `eth-policy-hinman-ether-speech` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Digital Asset Transactions: When Howey Met Gary (Plastic)](https://www.sec.gov/newsroom/speeches-statements/speech-hinman-061418) — SEC — William Hinman, 2018-06-14, primary. 당시 네트워크의 분산 상태를 전제로 현재의 ETH 제공·판매는 증권 거래가 아니라는 개인 견해를 밝혔다. 각주 1은 위원회 견해와 다를 수 있음을 명시한다.
- [U.S. SEC official says ether not a security, price surges](https://www.reuters.com/article/technology/us-sec-official-says-ether-not-a-security-price-surges-idUSKBN1JA30P/) — Reuters, 2018-06-14, secondary. Hinman의 ETH 관련 발언이 6월 14일 공개됐음을 당일 보도한다.

### 2019-07-31 · 美 금리 인하

ID: `eth-policy-fed-2019-easing` · 분류: `macro` · 중요도: 2

**날짜 판단:** 2019-07-31 FOMC 발표일. Reuters의 8월 1일 갱신 보도 본문이 전날 수요일 결정을 확인한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2019-07-31](https://www.federalreserve.gov/newsevents/pressreleases/monetary20190731a.htm) — Federal Reserve, 2019-07-31, primary. 목표 범위를 2.00–2.25%로 낮추고 증권 보유액 축소를 8월에 끝내겠다고 발표했다.
- [Fed cuts interest rates, signals it may not need to do more](https://www.reuters.com/article/business/fed-cuts-interest-rates-signals-it-may-not-need-to-do-more-idUSKCN1UQ0DS/) — Reuters, 2019-08-01, secondary. 수요일인 2019-07-31의 25bp 인하 결정과 2008년 이후 첫 인하를 보도한다.

### 2020-03-03 · 연준 긴급 인하

ID: `eth-policy-fed-emergency-cut-march3` · 분류: `macro` · 중요도: 2

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2020-03-03](https://www.federalreserve.gov/newsevents/pressreleases/monetary20200303a.htm) — Federal Reserve, 2020-03-03, primary. 코로나19 위험에 대응해 목표 범위를 1.00–1.25%로 50bp 낮췄다.
- [Fed cuts rates to blunt coronavirus impact, markets drop](https://www.reuters.com/article/business/fed-cuts-rates-to-blunt-coronavirus-impact-markets-drop-idUSKBN20Q22A/) — Reuters, 2020-03-03, secondary. 정례 회의 사이에 실시한 50bp 긴급 인하를 당일 보도한다.

### 2020-03-15 · 제로금리·QE

ID: `eth-policy-fed-zero-rates-qe` · 분류: `macro` · 중요도: 3

**날짜 판단:** 일요일인 2020-03-15에 발표한 결정이다. 공식 시행 지침의 효력 발생일 3월 16일 및 해외 보도의 다음 날 게시일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Implementation Note issued March 15, 2020](https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a1.htm) — Federal Reserve, 2020-03-15, primary. 3월 16일부터 0–0.25% 목표 범위를 시행하고 국채 최소 5,000억 달러·기관 MBS 최소 2,000억 달러 매입을 지시했다.
- [Fed slashes rates, global central banks coordinate to cushion coronavirus blow](https://www.reuters.com/article/economy/fed-slashes-rates-global-central-banks-coordinate-to-cushion-coronavirus-blow-idUSKBN21219J/) — Reuters, 2020-03-16, secondary. 3월 15일 일요일의 100bp 금리 인하와 자산매입 대응을 보도한다.

### 2020-03-23 · 연준 매입 확대

ID: `eth-policy-fed-open-ended-purchases` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 3월 23일 연준의 원문과 Reuters의 4월 14일 사후 정책 연표를 대조했다. 사후 보도의 요약보다 원문의 매입 자산과 조건을 우선했다.

- [Federal Reserve announces extensive new measures to support the economy](https://www.federalreserve.gov/newsevents/pressreleases/monetary20200323b.htm) — Federal Reserve, 2020-03-23, primary. 국채·기관 MBS를 시장 기능과 통화정책 전달에 필요한 규모로 매입한다고 발표했다.
- [Factbox: Global economic policy response to coronavirus crisis](https://www.reuters.com/article/business/factbox-global-economic-policy-response-to-coronavirus-crisis-idUSKCN21W2A9/) — Reuters, 2020-04-14, secondary. 후속 연표에서 3월 23일의 매입 규모 제한 없는 QE 전환을 확인한다.

### 2021-05-21 · 중국 단속 방침

ID: `eth-policy-china-state-council-crackdown` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 재게시 문서가 명시한 회의일과 Reuters의 당일 보도가 일치하는 2021-05-21. 상하이 당국의 재게시일 5월 24일과 구분한다.

**교차검증:** 인민은행 회의 결과를 전재한 공식 지방정부 페이지와 별도 Reuters 취재를 대조했다. Reuters의 두 기사는 같은 언론사이며 두 개의 독립 기관으로 세지 않는다.

- [刘鹤主持召开国务院金融稳定发展委员会第五十一次会议](https://jrj.sh.gov.cn/ZXYW178/20210524/d99780f9cc2144be9b54f90abb764a99.html) — People’s Bank of China / Shanghai financial authorities official republication, 2021-05-24, primary. 5월 21일 제51차 국무원 금융안정발전위원회 회의 결과를 재게시하며 비트코인 채굴·거래 단속 방침을 기록한다.
- [China vows to crack down on bitcoin mining, trading activities](https://www.reuters.com/technology/china-says-it-will-crack-down-bitcoin-mining-trading-activities-2021-05-21/) — Reuters, 2021-05-21, secondary. 5월 21일 금요일 회의 결과 공개와 채굴·거래 단속 방침을 당일 확인한다.
- [Bitcoin ends day on the ropes after China clamps down on mining, trading](https://www.reuters.com/technology/bitcoin-under-pressure-comeback-fades-2021-05-21/) — Reuters, 2021-05-21, secondary. 당시 기사에서 중국 정책 발표와 같은 시기의 ETH 시장 약세를 함께 보도한다. 보도 수익률을 Coinbase 일봉 수익률로 사용하지 않는다.

### 2021-09-24 · 중국 거래 규제

ID: `eth-policy-china-trading-ban-notice` · 분류: `regulation` · 중요도: 3

**날짜 판단:** SAFE가 표시한 공개일 2021-09-24. 본문 서명일 2021-09-15와 구분하며 공개일을 당시 관측 가능한 사건 날짜로 채택한다.

**교차검증:** 2021년 당국 원문과 당시 별도 언론 보도로 공개일을 확인하고, 2026년 후속 공동 통지에서 명시적 폐지를 점검했다. 두 공식 문서는 같은 정책 체계의 전후 기록이다.

- [关于进一步防范和处置虚拟货币交易炒作风险的通知](https://www.safe.gov.cn/safe/2021/0924/19911.html) — People’s Bank of China and nine co-issuing authorities / SAFE, 2021-09-24, primary. 2021-09-24 공개된 통지는 이더를 포함한 가상통화 관련 거래·중개·파생상품 서비스와 해외 플랫폼의 본토 대상 서비스를 불법 금융활동으로 규정했다.
- [China declares transactions involving cryptocurrencies illegal](https://www.theguardian.com/world/2021/sep/24/china-declares-transactions-cryptocurrencies-illegal) — The Guardian, 2021-09-24, secondary. 9월 24일 규제 공표를 보도했다.
- [关于进一步防范和处置虚拟货币等相关风险的通知](https://www.csrc.gov.cn/csrc/c100028/c7614318/content.shtml) — People’s Bank of China and seven co-issuing authorities / CSRC, 2026-02-06, primary. 2월 6일 공동 통지는 가상통화·스테이블코인·RWA 관련 위험 통제를 정하고 같은 날 시행하며 2021년 통지를 폐지했다.

### 2021-11-03 · 테이퍼링 발표

ID: `eth-policy-fed-taper-announcement` · 분류: `macro` · 중요도: 2

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2021-11-03](https://www.federalreserve.gov/newsevents/pressreleases/monetary20211103a.htm) — Federal Reserve, 2021-11-03, primary. 11월부터 국채와 기관 MBS의 월 순매입 속도를 각각 100억·50억 달러 줄이기로 했다.
- [Explainer: Federal Reserve’s taper: How does it work?](https://www.reuters.com/business/federal-reserves-taper-how-does-it-work-2021-11-03/) — Reuters, 2021-11-03, secondary. 11월의 매입 축소 개시와 국채·MBS 매입 속도 조정을 설명한다.

### 2022-03-09 · 美 디지털자산 명령

ID: `eth-policy-biden-digital-assets-order` · 분류: `regulation` · 중요도: 2

**날짜 판단:** 행정명령 서명일 2022-03-09. 관보 게재일 3월 14일과 Reuters 페이지의 3월 10일 갱신일을 사건일로 쓰지 않는다.

**교차검증:** 서명된 행정명령과 Reuters 보도로 2022년 조치를 확인하고 2025년 후속 명령의 명시적 폐지 조항까지 점검했다.

- [Executive Order 14067 — Ensuring Responsible Development of Digital Assets](https://www.govinfo.gov/content/pkg/FR-2022-03-14/html/2022-05471.htm) — U.S. President / Federal Register, 2022-03-14, primary. 3월 9일 서명된 행정명령은 디지털자산 위험·기회와 CBDC 관련 정부 연구·보고를 지시한다.
- [Biden orders government to study digital dollar, other cryptocurrency risks](https://www.reuters.com/business/finance/biden-orders-government-study-digital-dollar-other-cryptocurrency-risks-2022-03-09/) — Reuters, 2022-03-10, secondary. 3월 9일 수요일 대통령 서명과 부처별 검토 지시를 확인한다.
- [Strengthening American Leadership in Digital Financial Technology](https://www.whitehouse.gov/presidential-actions/2025/01/strengthening-american-leadership-in-digital-financial-technology/) — The White House, 2025-01-23, primary. 디지털자산 작업반, 공개 블록체인·자기보관 정책과 CBDC 관련 행정 방침을 정하고 EO 14067을 폐지했다.

### 2022-03-16 · 美 긴축 전환

ID: `eth-policy-fed-2022-liftoff` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2022-03-16](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm) — Federal Reserve, 2022-03-16, primary. 목표 범위를 0.25–0.50%로 인상했다.
- [Wall Street closes higher after Fed hikes rates, signals more to come](https://www.reuters.com/business/futures-climb-ukraine-peace-talks-fed-decision-ahead-2022-03-16/) — Reuters, 2022-03-16, secondary. 당일 25bp 금리 인상 결정을 보도한다. 주식 수익률과 금리 전망은 사용하지 않는다.

### 2022-05-04 · 양적긴축 결정

ID: `eth-policy-fed-qt-plan` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 결정 발표일 2022-05-04. 문서가 별도로 지정한 양적긴축 개시일 2022-06-01을 발표일에 소급하지 않는다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2022-05-04](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220504a.htm) — Federal Reserve, 2022-05-04, primary. 목표 범위 0.75–1.00% 인상과 6월 1일부터 보유 증권 축소를 시작하는 결정을 발표했다.
- [Stocks rally after Fed hikes rates, crude jumps](https://www.reuters.com/business/global-markets-wrapup-1-2022-05-04/) — Reuters, 2022-05-04, secondary. 50bp 인상 및 6월 자산 축소 시작 계획을 당일 확인한다.

### 2022-06-15 · 연준 75bp 인상

ID: `eth-policy-fed-75bp-june` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2022-06-15](https://www.federalreserve.gov/newsevents/pressreleases/monetary20220615a.htm) — Federal Reserve, 2022-06-15, primary. 목표 범위를 1.50–1.75%로 높이고 보유 자산 축소를 계속한다고 밝혔다.
- [Dollar dips as Fed hikes rates, flags slowing economy](https://www.reuters.com/markets/europe/dollar-towers-over-peers-markets-bet-large-fed-rate-hike-2022-06-15/) — Reuters, 2022-06-15, secondary. 75bp 인상과 1994년 이후 가장 큰 단일 인상폭임을 당일 확인한다.

### 2022-08-08 · Tornado 제재

ID: `eth-policy-tornado-cash-sanctions` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 제재 당국의 당시 발표, 별도 사법부의 판결, 당국의 후속 해제 기록을 대조했다. 초기·후속 재무부 문서는 같은 기관이며 법원 문서가 제도적으로 별도 확인 경로다.

- [U.S. Treasury Sanctions Notorious Virtual Currency Mixer Tornado Cash](https://home.treasury.gov/news/press-releases/jy0916) — U.S. Department of the Treasury, 2022-08-08, primary. OFAC가 Ethereum 기반 Tornado Cash에 대한 제재를 발표했다. 자금세탁 관련 내용은 당국의 제재 사유 주장이다.
- [Van Loon v. Department of the Treasury, No. 23-50669](https://www.ca5.uscourts.gov/opinions/pub/23/23-50669-CV0.pdf) — U.S. Court of Appeals for the Fifth Circuit, 2024-11-26, primary. 불변 스마트 계약이 해당 IEEPA 제재 권한의 재산에 해당하지 않는다고 판단하고 일부 약식판결을 원고에게 하도록 파기환송했다.
- [Tornado Cash Delisting](https://home.treasury.gov/news/press-releases/sb0057) — U.S. Department of the Treasury, 2025-03-21, primary. 법적·정책적 검토 후 Tornado Cash에 대한 경제제재를 제거한다고 발표했다.

### 2023-02-09 · Kraken 스테이킹

ID: `eth-policy-kraken-staking-settlement` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Kraken to Discontinue Unregistered Offer and Sale of Crypto Asset Staking-As-A-Service Program and Pay $30 Million to Settle SEC Charges](https://www.sec.gov/newsroom/press-releases/2023-25) — SEC, 2023-02-09, primary. Kraken의 특정 스테이킹 서비스에 관한 미등록 증권 판매 혐의, 서비스 중단 및 3,000만 달러 지급 합의를 발표했다.
- [Kraken shuts down staking service, pays $30 million fine in SEC settlement](https://www.axios.com/2023/02/09/kraken-staking-sec-settlement) — Axios, 2023-02-09, secondary. 2월 9일 미국 고객 대상 서비스 중단 합의를 보도했다.

### 2023-05-16 · MiCA 이사회 채택

ID: `eth-policy-mica-council-adoption` · 분류: `regulation` · 중요도: 3

**날짜 판단:** EU 이사회 발표와 당일 Reuters 보도가 확인하는 2023-05-16 채택일. 이후 법률 서명·적용일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Digital finance: Council adopts new rules on markets in crypto-assets (MiCA)](https://www.consilium.europa.eu/en/press/press-releases/2023/05/16/digital-finance-council-adopts-new-rules-on-markets-in-crypto-assets-mica/) — Council of the European Union, 2023-05-16, primary. 5월 16일 EU 이사회가 MiCA를 채택했다고 발표했다.
- [EU states approve world’s first comprehensive crypto rules](https://www.reuters.com/technology/eu-council-adopts-first-legal-framework-regulate-crypto-sector-2023-05-16/) — Reuters, 2023-05-16, secondary. 당일 EU 회원국 장관들의 MiCA 채택을 확인한다.

### 2023-06-06 · SEC Coinbase 소송

ID: `eth-policy-coinbase-sec-complaint` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 당시 SEC 제소 발표와 후속 SEC 철회 발표, 이를 확인한 별도 Reuters 보도를 대조했다. 두 SEC 문서는 같은 기관의 사건 전후 기록이다.

- [SEC Charges Coinbase for Operating as an Unregistered Securities Exchange, Broker, and Clearing Agency](https://www.sec.gov/newsroom/press-releases/2023-102) — SEC, 2023-06-06, primary. Coinbase 거래소·브로커·청산 및 스테이킹 서비스 관련 민사 혐의 제기를 발표했다.
- [SEC Announces Dismissal of Civil Enforcement Action Against Coinbase](https://www.sec.gov/newsroom/press-releases/2025-47) — SEC, 2025-02-27, primary. 소송 철회 합의 제출을 발표하며 정책적 판단이고 사건의 본안에 관한 판단이 아니라고 명시했다.
- [US SEC announces dismissal of civil enforcement action against Coinbase](https://www.reuters.com/technology/us-sec-announces-dismissal-civil-enforcement-action-against-coinbase-2025-02-27/) — Reuters, 2025-02-27, secondary. 2023년 제기된 소송과 2025년 2월 27일 철회 발표를 확인한다.

### 2024-03-19 · 日 마이너스금리 종료

ID: `eth-policy-boj-negative-rates-end` · 분류: `macro` · 중요도: 3

**날짜 판단:** 일본은행의 결정 발표일 2024-03-19. 적용일 3월 21일 및 Reuters URL에 남은 3월 18일 문자열과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Changes in the Monetary Policy Framework](https://www.boj.or.jp/en/mopo/mpmdeci/state_2024/k240319a.htm) — Bank of Japan, 2024-03-19, primary. 단기금리 목표를 0–0.1% 정도로 변경하고 마이너스 금리·수익률곡선통제를 종료하는 정책 틀을 발표했다. 새 단기금리 지침은 3월 21일부터 적용된다.
- [BOJ ends negative rates, closing era of radical monetary policy](https://www.reuters.com/markets/asia/japan-poised-end-negative-rates-closing-era-radical-policy-2024-03-18/) — Reuters, 2024-03-19, secondary. 3월 19일의 마이너스 금리 종료와 17년 만의 금리 인상을 확인한다.

### 2024-07-19 · 한국 이용자보호법

ID: `eth-policy-korea-user-protection-act` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 7월 17일 사전 안내가 지정한 2024-07-19 시행일을 2025년 2월 13일 후속 공식 기록으로 재확인했다.

**교차검증:** 시행 직전 안내와 실제 시행 후 정책 기록을 대조했다. 둘 다 금융위 자료이므로 서로 독립된 기관의 검증이라고 표현하지 않는다.

- [Virtual Asset User Protection Act to Take Effect on July 19](https://www.fsc.go.kr/eng/pr010101/82683) — Financial Services Commission, Korea, 2024-07-17, primary. 7월 19일 가상자산이용자보호법 시행과 예치금·자산 보호, 불공정거래·감독 체계를 설명한다.
- [FSC Unveils Roadmap for Corporate Participation in Virtual Asset Market](https://www.fsc.go.kr/eng/pr010101/84004) — Financial Services Commission, Korea, 2025-02-13, primary. 후속 정책 문서가 가상자산이용자보호법의 2024년 7월 19일 시행을 확인한다.

### 2024-07-31 · 日 금리 인상

ID: `eth-policy-boj-july-rate-hike` · 분류: `macro` · 중요도: 3

**날짜 판단:** 2024-07-31 정책 결정 발표일. 8월 1일 금리 지침 적용 및 Reuters URL의 7월 30일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Changes in the Guideline for Money Market Operations and Plan for the Reduction of the Purchase Amount of Japanese Government Bonds](https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2024/k240731a.pdf) — Bank of Japan, 2024-07-31, primary. 단기금리 목표를 0.25% 정도로 올리고 국채 매입 감축 계획을 발표했다. 금리 지침은 8월 1일부터 적용된다.
- [BOJ hikes interest rates, unveils bond tapering plan](https://www.reuters.com/markets/rates-bonds/bank-japan-outline-bond-taper-plan-debate-rate-hike-timing-2024-07-30/) — Reuters, 2024-07-31, secondary. 7월 31일의 금리 인상 및 국채 매입 감축 계획 발표를 당일 확인한다.

### 2024-09-18 · 美 인하 전환

ID: `eth-policy-fed-2024-easing` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2024-09-18](https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm) — Federal Reserve, 2024-09-18, primary. 정책금리 목표 범위를 4.75–5.00%로 50bp 낮췄으며 보유 증권 축소는 계속했다.
- [Fed slashes rates 50 bp in first easing since pandemic](https://www.reuters.com/markets/us/view-fed-slashes-rates-50-bp-first-easing-since-pandemic-hit-2024-09-18/) — Reuters, 2024-09-18, secondary. 팬데믹 이후 첫 인하와 50bp 인하 폭을 확인한다. 기사 내 향후 전망은 사건에 포함하지 않는다.

### 2024-11-06 · 美 대선 결과

ID: `eth-policy-us-election-result-2024` · 분류: `macro` · 중요도: 3

**날짜 판단:** AP의 승리 판정은 2024-11-06 05:34 미국 동부표준시, 같은 UTC 날짜다. 11월 5일 투표일·선거인단 투표·의회 인증·2025년 취임일과 구분한다.

**교차검증:** AP는 자사의 판정 시점을 직접 기록하고 국가기록원은 최종 선거인단 결과를 제공한다. 서로 독립된 역할의 기록이며 국가기록원이 11월 6일 판정 시각을 확인했다고 주장하지 않는다.

- [Why AP called Wisconsin and the White House for Donald Trump](https://apnews.com/article/trump-harris-wisconsin-president-race-call-winner-explain-d07049f884d25ceae0d1376157d07c35) — Associated Press, 2024-11-06, primary. 11월 6일 오전 5시 34분 미국 동부시간에 AP가 Wisconsin 및 대통령 선거 승리를 판정한 과정을 설명한다.
- [2024 Electoral College Results](https://www.archives.gov/electoral-college/2024) — U.S. National Archives, 정확한 게시일 미상, primary. 최종 선거인단 결과에서 Trump 312, Harris 226을 확인한다. 보도기관의 승리 판정 시각을 입증하는 문서는 아니다.

### 2024-11-26 · Tornado 항소심

ID: `eth-policy-tornado-cash-appeal` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 판결문 첫 페이지의 filed 날짜 2024-11-26. 보도일 또는 2025년 행정 해제일과 구분한다.

**교차검증:** 법원의 원판결과 재무부의 후속 조치, Reuters의 후속 보도를 대조했다. 판결 범위와 실제 제재 해제를 별도 사건으로 확인한다.

- [Van Loon v. Department of the Treasury, No. 23-50669](https://www.ca5.uscourts.gov/opinions/pub/23/23-50669-CV0.pdf) — U.S. Court of Appeals for the Fifth Circuit, 2024-11-26, primary. 불변 스마트 계약이 해당 IEEPA 제재 권한의 재산에 해당하지 않는다고 판단하고 일부 약식판결을 원고에게 하도록 파기환송했다.
- [Tornado Cash Delisting](https://home.treasury.gov/news/press-releases/sb0057) — U.S. Department of the Treasury, 2025-03-21, primary. 법적·정책적 검토 후 Tornado Cash에 대한 경제제재를 제거한다고 발표했다.
- [US scraps sanctions on Tornado Cash, crypto mixer accused of laundering North Korea money](https://www.reuters.com/business/finance/us-scraps-sanctions-tornado-cash-crypto-mixer-accused-laundering-north-korea-2025-03-21/) — Reuters, 2025-03-21, secondary. 당일 경제제재 해제와 앞선 항소심 판단을 확인한다.

### 2024-12-03 · 한국 비상계엄

ID: `eth-policy-korea-martial-law` · 분류: `macro` · 중요도: 3

**날짜 판단:** 선포는 2024-12-03 밤 KST, 해제 국무회의는 2024-12-04 04:30 KST(12-03 19:30 UTC)로 보도됐다. UTC 차트에서 둘 다 2024-12-03으로 배치한다. 정확한 선포 분·초는 자료 간 차이가 있어 단정하지 않는다.

**교차검증:** Reuters와 연합뉴스의 당시 경과를 대조하고 헌법재판소의 후속 공식 판단을 별도 확인했다. 연합뉴스의 두 기사는 같은 기관이며 법원 기록은 당시 가격 움직임의 증거가 아니다.

- [Constitutional Court decision in the impeachment trial of President Yoon Suk Yeol](https://english.ccourt.go.kr/site/eng/ex/bbs/List.do?cbIdx=1143&searchBcIdx=4258448) — Constitutional Court of Korea, 2025-04-04, primary. 후속 탄핵심판 결정은 비상계엄의 위헌·위법 문제와 대통령 파면 결론을 기록한다. 선포 시각의 직접 근거로 사용하지 않는다.
- [South Korea president backs down from martial law, lawmakers demand resignation](https://www.reuters.com/world/asia-pacific/south-korea-president-yoon-declares-martial-law-2024-12-03/) — Reuters, 2024-12-03, secondary. 12월 3일 밤 계엄 선포, 국회 해제 요구, 12월 4일 새벽 해제에 이르는 당시 경과를 보도한다.
- [尹, 비상계엄 선포 6시간 만에 해제…국무회의 의결](https://www.yna.co.kr/view/AKR20241204019252001) — Yonhap News Agency, 2024-12-04, secondary. 한국시간 12월 4일 04:30 국무회의 해제 의결을 기록한다. UTC로는 12월 3일 19:30이다.
- [비상계엄에 가상자산 시장 급락·거래소 접속 지연](https://www.yna.co.kr/view/AKR20241204097600002) — Yonhap News Agency, 2024-12-04, secondary. 국내 원화 거래소에서 ETH 등 가상자산 가격 급변과 접속 지연이 관측됐다고 보도한다.

### 2024-12-30 · MiCA 주요 규정 적용

ID: `eth-policy-mica-main-application` · 분류: `regulation` · 중요도: 3

**날짜 판단:** ESMA의 2024년 12월호가 특정한 2024-12-30 적용일. 발행일이 불명확한 월간 간행물에는 publishedAt을 임의로 부여하지 않는다.

**교차검증:** ESMA의 당시 시행 정리와 2025년 전환 기간 관리 문서를 대조했다. 두 문서는 같은 감독기관이므로 독립된 두 기관의 법 해석이라고 주장하지 않는다.

- [Spotlight on Markets — December 2024, edition 60](https://www.esma.europa.eu/sites/default/files/2025-01/Newsletter_December_2024.pdf) — European Securities and Markets Authority, 정확한 게시일 미상, primary. 2024년 12월호는 MiCA의 12월 30일 적용 및 기존 서비스 제공자의 전환 체계를 설명한다. 정확한 발행 날짜는 확인되지 않았다.
- [ESMA Statement on MiCA Transitional Measures](https://www.esma.europa.eu/sites/default/files/2025-12/ESMA75-113276571-1631_Statement_on_end_of_MiCA_transitional_periods.pdf) — European Securities and Markets Authority, 2025-12-04, primary. 2024년 12월 30일 이전 서비스 제공자에 대한 국가별 전환 기간 및 미인가 사업자의 정리 필요성을 후속 기록한다.

### 2025-01-23 · SAB 121 철회

ID: `eth-policy-sec-sab122` · 분류: `regulation` · 중요도: 2

**날짜 판단:** SAB 122의 발표일 2025-01-23. 원문이 명시한 효력 발생일 1월 30일과 구분한다.

**교차검증:** SEC 직원 회계 공보 원문과 독립 회계법인 Deloitte의 1월 27일 해설을 대조했다.

- [Staff Accounting Bulletin No. 122](https://www.sec.gov/rules-regulations/staff-guidance/staff-accounting-bulletins/staff-accounting-bulletin-122) — SEC staff, 2025-01-23, primary. SAB 121이 추가했던 암호자산 보관 관련 회계 지침을 철회한다. 명시된 효력일은 1월 30일이다.
- [SEC Rescinds SAB 121 and Issues SAB 122](https://dart.deloitte.com/USDART/home/publications/deloitte/heads-up/2025/sec-rescinds-sab-121-issues-sab-122-crypto-cryptocurrency) — Deloitte, 2025-01-27, secondary. 1월 23일 SAB 122 발표와 SAB 121 철회, 기존 회계 기준에 따른 의무의 존속을 해설한다.

### 2025-01-23 · 美 디지털자산 전환

ID: `eth-policy-trump-digital-assets-order` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Strengthening American Leadership in Digital Financial Technology](https://www.whitehouse.gov/presidential-actions/2025/01/strengthening-american-leadership-in-digital-financial-technology/) — The White House, 2025-01-23, primary. 디지털자산 작업반, 공개 블록체인·자기보관 정책과 CBDC 관련 행정 방침을 정하고 EO 14067을 폐지했다.
- [Trump orders crypto working group to draft new regulations, explore national stockpile](https://www.reuters.com/business/finance/trump-signs-order-create-cryptocurrency-working-group-2025-01-23/) — Reuters, 2025-01-24, secondary. 1월 23일 디지털자산 작업반 설치, 규제 검토 및 비축 평가를 지시한 명령을 보도한다.

### 2025-02-27 · Coinbase 소송 철회

ID: `eth-policy-coinbase-sec-dismissal-announcement` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** SEC의 당일 철회 발표와 Reuters의 별도 보도를 대조하고 원래 제소 발표로 사건의 범위를 확인했다.

- [SEC Announces Dismissal of Civil Enforcement Action Against Coinbase](https://www.sec.gov/newsroom/press-releases/2025-47) — SEC, 2025-02-27, primary. 소송 철회 합의 제출을 발표하며 정책적 판단이고 사건의 본안에 관한 판단이 아니라고 명시했다.
- [US SEC announces dismissal of civil enforcement action against Coinbase](https://www.reuters.com/technology/us-sec-announces-dismissal-civil-enforcement-action-against-coinbase-2025-02-27/) — Reuters, 2025-02-27, secondary. 2023년 제기된 소송과 2025년 2월 27일 철회 발표를 확인한다.
- [SEC Charges Coinbase for Operating as an Unregistered Securities Exchange, Broker, and Clearing Agency](https://www.sec.gov/newsroom/press-releases/2023-102) — SEC, 2023-06-06, primary. Coinbase 거래소·브로커·청산 및 스테이킹 서비스 관련 민사 혐의 제기를 발표했다.

### 2025-03-06 · 美 디지털자산 비축

ID: `eth-policy-us-digital-asset-stockpile` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 백악관 명령의 서명·발표 날짜 2025-03-06. Reuters의 3월 7일 게시일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Establishment of the Strategic Bitcoin Reserve and United States Digital Asset Stockpile](https://www.whitehouse.gov/presidential-actions/2025/03/establishment-of-the-strategic-bitcoin-reserve-and-united-states-digital-asset-stockpile/) — The White House, 2025-03-06, primary. BTC 준비금과 구분되는 비BTC 디지털자산 비축 계정 설치를 지시하며 추가 자산 취득을 별도 행정·입법 조치 없이 확대하지 못하도록 한다.
- [Trump signs order to establish strategic bitcoin reserve](https://www.reuters.com/technology/trump-signs-order-establish-strategic-bitcoin-reserve-white-house-crypto-czar-2025-03-07/) — Reuters, 2025-03-07, secondary. 3월 6일 목요일 발표와 비BTC 자산 비축의 구분을 확인한다.

### 2025-03-21 · Tornado 제재 해제

ID: `eth-policy-tornado-cash-delisting` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 재무부 당일 발표와 독립된 Reuters 보도를 대조하고 앞선 항소심 원판결로 법적 쟁점의 범위를 확인했다.

- [Tornado Cash Delisting](https://home.treasury.gov/news/press-releases/sb0057) — U.S. Department of the Treasury, 2025-03-21, primary. 법적·정책적 검토 후 Tornado Cash에 대한 경제제재를 제거한다고 발표했다.
- [US scraps sanctions on Tornado Cash, crypto mixer accused of laundering North Korea money](https://www.reuters.com/business/finance/us-scraps-sanctions-tornado-cash-crypto-mixer-accused-laundering-north-korea-2025-03-21/) — Reuters, 2025-03-21, secondary. 당일 경제제재 해제와 앞선 항소심 판단을 확인한다.
- [Van Loon v. Department of the Treasury, No. 23-50669](https://www.ca5.uscourts.gov/opinions/pub/23/23-50669-CV0.pdf) — U.S. Court of Appeals for the Fifth Circuit, 2024-11-26, primary. 불변 스마트 계약이 해당 IEEPA 제재 권한의 재산에 해당하지 않는다고 판단하고 일부 약식판결을 원고에게 하도록 파기환송했다.

### 2025-04-10 · DeFi 보고규칙 폐기

ID: `eth-policy-defi-broker-cra-repeal` · 분류: `regulation` · 중요도: 3

**날짜 판단:** Public Law 119-5의 2025-04-10 승인일. 의회 개별 표결일 및 7월 11일 후속 규정집 정리일과 구분한다.

**교차검증:** 의회가 성립시킨 법률과 이를 이행한 재무부·IRS의 후속 관보 문서를 대조했다. 두 문서는 같은 법적 절차의 서로 다른 단계이며 독립된 시장 효과 분석은 아니다.

- [Public Law 119-5 — H.J. Res. 25](https://www.govinfo.gov/content/pkg/PLAW-119publ5/html/PLAW-119publ5.htm) — U.S. Congress / U.S. Government Publishing Office, 2025-04-10, primary. 4월 10일 성립한 법률은 특정 DeFi 브로커 보고 최종 규칙에 대한 의회의 불승인을 확정했다.
- [Gross Proceeds Reporting by Brokers That Regularly Provide Services Effectuating Digital Asset Sales; Congressional Review Act Revocation](https://www.govinfo.gov/content/pkg/FR-2025-07-11/html/2025-12967.htm) — U.S. Department of the Treasury / Internal Revenue Service, 2025-07-11, primary. 4월 10일 CRA 법률 성립에 따라 해당 DeFi 규칙을 규정집에서 제거하는 후속 조치를 기록한다.

### 2025-05-29 · SEC 스테이킹 견해

ID: `eth-policy-sec-protocol-staking-staff` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 직원 성명 원문과 Dechert의 별도 법률 해설을 대조했다. 법률 해설은 독립된 해석이며 법적 효력을 추가하는 문서는 아니다.

- [Statement on Certain Protocol Staking Activities](https://www.sec.gov/newsroom/speeches-statements/statement-certain-protocol-staking-activities-052925) — SEC Division of Corporation Finance, 2025-05-29, primary. 직원은 명시된 조건에 맞는 특정 프로토콜 스테이킹 활동에 증권 등록이 필요하지 않다는 견해를 제시했다. 위원회가 승인한 규칙이 아니며 법적 효력이 없다는 한계를 명시한다.
- [SEC Staff Issues Statement on Protocol Staking Activities](https://www.dechert.com/knowledge/onpoint/2025/6/sec-staff-issues-statement-on-protocol-staking-activities.html) — Dechert, 2025-06-09, secondary. 5월 29일 직원 성명의 범위와 비구속적 성격, 조건을 해설한다.

### 2025-07-18 · GENIUS 법률 성립

ID: `eth-policy-genius-act-enactment` · 분류: `regulation` · 중요도: 3

**날짜 판단:** Public Law 119-27의 승인일 2025-07-18과 당일 서명 보도가 일치한다. 하원 통과일 7월 17일 및 일반 시행 조건과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [Public Law 119-27 — GENIUS Act](https://www.govinfo.gov/content/pkg/PLAW-119publ27/html/PLAW-119publ27.htm) — U.S. Congress / U.S. Government Publishing Office, 2025-07-18, primary. 7월 18일 법률 성립과 지급용 스테이블코인 제도, 제20조의 별도 효력 발생 조건을 명시한다.
- [Trump signs stablecoin law as crypto industry aims for mainstream adoption](https://www.reuters.com/legal/government/trump-signs-stablecoin-law-crypto-industry-aims-mainstream-adoption-2025-07-18/) — Reuters, 2025-07-18, secondary. 7월 18일 대통령 서명과 지급용 스테이블코인 규제 체계의 입법을 당일 확인한다.

### 2025-08-05 · SEC 유동성 스테이킹

ID: `eth-policy-sec-liquid-staking-staff` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 8월 5일 SEC 직원 원문과 9월 16일 발행된 Gibson Dunn의 월간 정리를 대조했다. 제목의 August를 정확한 게시일로 오인하지 않는다.

- [Statement on Certain Liquid Staking Activities](https://www.sec.gov/newsroom/speeches-statements/corpfin-certain-liquid-staking-activities-080525) — SEC Division of Corporation Finance, 2025-08-05, primary. 일정 사실관계의 유동성 스테이킹과 수령 토큰에 관한 직원 견해를 제시했다. 위원회 승인 규칙이나 모든 스테이킹 상품의 면제는 아니다.
- [Digital Assets Recent Updates — August 2025](https://www.gibsondunn.com/digital-assets-recent-updates-august-2025/) — Gibson Dunn, 2025-09-16, secondary. 8월 5일 SEC 직원의 유동성 스테이킹 성명과 조건부 분석을 후속 정리한다.

### 2025-09-17 · 美 금리 인하 재개

ID: `eth-policy-fed-2025-easing-resumes` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2025-09-17](https://www.federalreserve.gov/newsevents/pressreleases/monetary20250917a.htm) — Federal Reserve, 2025-09-17, primary. 목표 범위를 4.00–4.25%로 25bp 낮췄고 보유 증권 축소는 계속한다고 밝혔다.
- [Fed lowers interest rates, signals more cuts ahead; Miran dissents](https://www.reuters.com/business/fed-lowers-interest-rates-signals-more-cuts-ahead-miran-dissents-2025-09-17/) — Reuters, 2025-09-17, secondary. 2024년 12월 이후 첫 금리 인하와 4.00–4.25% 목표 범위를 확인한다. 향후 전망은 사용하지 않는다.

### 2025-10-29 · 연준 QT 종료 결정

ID: `eth-policy-fed-qt-end-announcement` · 분류: `macro` · 중요도: 3

**날짜 판단:** 2025-10-29 결정 발표일. 성명에 별도로 지정된 양적긴축 종료일 12월 1일과 구분한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [FOMC statement — 2025-10-29](https://www.federalreserve.gov/newsevents/pressreleases/monetary20251029a.htm) — Federal Reserve, 2025-10-29, primary. 목표 범위를 3.75–4.00%로 낮추고 12월 1일 보유 증권 축소를 끝내기로 했다.
- [Fed winding down balance sheet contraction amid tightening money markets](https://www.reuters.com/business/finance/fed-end-balance-sheet-reduction-december-1-2025-10-29/) — Reuters, 2025-10-29, secondary. 10월 29일 연준의 12월 1일 보유 자산 축소 종료 결정을 확인한다.

### 2026-02-06 · 중국 새 가상자산 통지

ID: `eth-policy-china-crypto-rwa-notice` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 공동 통지의 작성·공개 날짜 2026-02-06과 Reuters 당일 보도가 일치한다. 원문은 공개일부터 시행한다고 명시한다.

**교차검증:** 정책을 발표한 기관의 원문과 별도 언론사의 당시 보도를 대조해 결정 내용과 날짜를 확인했다. 언론의 전망이나 가격 해석은 확정된 정책 사실로 사용하지 않는다.

- [关于进一步防范和处置虚拟货币等相关风险的通知](https://www.csrc.gov.cn/csrc/c100028/c7614318/content.shtml) — People’s Bank of China and seven co-issuing authorities / CSRC, 2026-02-06, primary. 2월 6일 공동 통지는 가상통화·스테이블코인·RWA 관련 위험 통제를 정하고 같은 날 시행하며 2021년 통지를 폐지했다.
- [China steps up crypto crackdown, will vet real-world asset tokens](https://www.reuters.com/world/asia-pacific/china-vows-tighten-virtual-currency-restrictions-2026-02-06/) — Reuters, 2026-02-06, secondary. 당일 새 통지, 승인 없는 역외 위안화 스테이블코인 제한 및 RWA 관련 감독을 확인한다.

### 2026-03-17 · SEC·CFTC 자산 해석

ID: `eth-policy-sec-cftc-crypto-interpretation` · 분류: `regulation` · 중요도: 3

**날짜 판단:** 3월 17일 발표된 해석과 같은 날 CFTC 발표를 사용한다. 3월 23일 효력 발생·관보 단계와 구분한다.

**교차검증:** 공식 해석 전문과 공동 정책에 참여한 CFTC의 발표를 대조했다. 공동 발표 기관 두 곳이며 독립된 두 법원 판결이나 시장 관측 자료가 아니다.

- [Application of the Federal Securities Laws to Certain Types of Crypto Assets and Certain Transactions Involving Crypto Assets](https://www.sec.gov/files/rules/interp/2026/33-11412.pdf) — SEC / CFTC, 2026-03-17, primary. 위원회 해석은 자산 자체와 투자계약 거래를 구분하며 ETH를 디지털 상품의 예로 든다. 문서의 효력일은 3월 23일이다.
- [CFTC Joins SEC to Clarify the Application of Federal Securities Laws to Crypto Assets](https://www.cftc.gov/PressRoom/PressReleases/9198-26) — Commodity Futures Trading Commission, 2026-03-17, primary. 3월 17일 SEC 해석에 CFTC가 참여하는 공동 정책과 적용 범위를 확인한다.

### 2026-08-18 · SEC 규칙안 제안

ID: `eth-policy-sec-reg-crypto-proposal` · 분류: `regulation` · 중요도: 2

**날짜 판단:** SEC 최초 제안 발표일 2026-08-18. 관보 게재일 8월 21일 및 의견 제출 마감일 10월 20일과 구분한다.

**교차검증:** SEC 발표와 같은 기관의 정식 관보 제안문을 대조하고 별도 이해관계자 Ripple의 의견 제출 기록으로 절차를 확인했다. Ripple은 이해관계자이며 그 찬성 법리는 독립된 확정 판단으로 취급하지 않는다.

- [SEC Proposes New Regulation Crypto Assets](https://www.sec.gov/newsroom/press-releases/2026-76-sec-proposes-new-regulation-crypto-assets) — SEC, 2026-08-18, primary. 8월 18일 암호자산 관련 투자계약의 등록 예외와 조건부 안전항을 포함한 규칙안을 제안했다.
- [Regulation Crypto Assets — Proposed Rule, 91 FR 54510](https://www.govinfo.gov/content/pkg/FR-2026-08-21/html/2026-17183.htm) — SEC / Federal Register, 2026-08-21, primary. 관보의 Proposed Rules 항목은 규칙안의 성격과 10월 20일 의견 제출 기한을 명시한다.
- [Ripple comment on Regulation Crypto Assets, File S7-2026-27](https://www.sec.gov/comments/S7-2026-27/s7202627-1102200-3881828.pdf) — Ripple Labs, 2026-10-20, primary. 10월 20일 제출된 의견서는 8월 18일 규칙안을 인용하고 최종 채택을 요청한다. 제출자의 법적 찬성 논리는 확정 사실로 채택하지 않는다.

### 2026-09-16 · 美 금리 인상 재개

ID: `eth-policy-fed-2026-rate-hike` · 분류: `macro` · 중요도: 3

**날짜 판단:** 공식 발표문에 명시된 발표 날짜를 사건일로 사용한다. 시행·결제 시점이나 문서의 후속 갱신일과 구분한다.

**교차검증:** 연준의 당일 결정문과 10월 7일 Reuters의 후속 회의록 보도를 대조했다. 날짜·인상폭·목표 범위만 사용하고 향후 정책 전망은 제외했다.

- [FOMC statement — 2026-09-16](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm) — Federal Reserve, 2026-09-16, primary. 연방기금금리 목표 범위를 3.75–4.00%로 25bp 올리는 결정을 발표했다.
- [Fed policymakers divided over rate-hike logic in September, minutes show](https://www.reuters.com/business/fed-policymakers-divided-over-rate-hike-logic-september-minutes-show-2026-10-07/) — Reuters, 2026-10-07, secondary. 후속 회의록 보도가 9월 15–16일 회의에서 25bp 인상과 3.75–4.00% 범위가 결정됐음을 재확인한다. 향후 금리 전망은 사용하지 않는다.

## 데이터 검증과 통합 경계

JSON 파싱, 43개 ID의 고유성, 달력 날짜 유효성, 기준일 이후 사건 부재, 필수 필드, 허용 분류·중요도, 사건별 최소 두 출처와 1차 출처 존재, 사건 내 URL 중복 부재, 접근일 일치를 검사했다. 이 검사는 자료의 역사적 진실을 대신하지 않으므로 위의 본문 검증과 함께 수행했다.

이 조사 단계는 UI, 기존 BTC 기록, 데이터 생성기, 가격 계산 코드를 수정하지 않는다. 별도 테스트를 새로 만들어 JSON 모양만 반복 검증하지 않았고, 통합 단계에서 기존 카탈로그 검증을 적용할 수 있도록 데이터만 제공한다. 예측값·가격 목표·향후 사건의 확정 표시는 없다.
