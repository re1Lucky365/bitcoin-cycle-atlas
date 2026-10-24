# Ethereum 관세·무역정책 역사 사건 검증 기록

검토일: 2026-10-24. 데이터: `research-data/ethereum-tariff-events.json`.

## 목적과 범위

이 자료는 ETHUSD 가격 차트에 겹쳐 볼 수 있는 관세·무역갈등의 주요 정책 전환점을 수록한다. 정책 원문과 독립 보도를 대조한 사건을 선별했고, 발표·위협·시행·유예·예외·합의·법원 판단을 구분했다. 수학 모델, 예측, 매수·매도 신호, 관세별 가격 기여도 추정은 포함하지 않는다. 일봉 가격은 차트의 단일 거래소 OHLC 자료를 따로 사용하며 뉴스에 실린 변화율을 붙여 넣지 않는다.

2018-03-01부터 2026-07-23까지 주요 전환점 34개를 포함한다. 2018–2020 미중 무역갈등의 주요 발표·시행·유예·합의 14개와 2025–2026 전환점 20개를 수록했다. 검토 기준일보다 앞선 사건을 조사했으며, 이 목록을 모든 무역정책·모든 발언의 완전한 연대표라고 주장하지 않는다. ETH 동반 반응이 직접 보도된 사건과, 광범위한 위험환경 또는 법적 정책 연속성을 설명하는 사건은 각 레코드의 `marketContext`와 `limitations`에서 구분한다. 주가 반응을 ETH 반응으로 바꾸지 않는다.

## 데이터와 날짜 원칙

- `policyAction`: 실제 발표·법적 결정의 확인된 내용.
- `marketContext`: 출처에 귀속한 당시 시장 해석 또는 ETH 반응 확인의 한계.
- `followUp`: 후속 유예·시행·예외·합의의 구분.
- `datePrecision`은 모두 `source-calendar-day`다. 이 달력 날짜가 UTC 00:00의 정확한 발표 시각이라는 뜻은 아니다.
- 시각을 직접 확인한 대통령 게시물 3개에만 `facts.announcementUtc`를 넣었다. UCSB가 명시한 Pacific 시간에 해당 날짜의 PST/PDT를 적용했다. 이 필드는 날짜 마커와 별개다.
- `publishedAt`은 실제 읽은 페이지의 날짜다. 원문 발행·수정 날짜가 다른 경우 아래 주의사항과 레코드에 기록했다. `accessedAt`은 2026-10-24로 고정했다.
- `importance` 3은 주요 전환점, 2는 후속 조정·법적 절차를 나타낸다. 가격 반응의 크기나 인과 확신 점수가 아니다.
- 기존 카탈로그 호환용 `summary`는 `description`과 동일하다. 과거 BTC 설명이나 BTC 수익률은 ETH 데이터로 복사하지 않았다.

## 수록 목록

| 사건일 | 구분 | 사건 | 출처 문서 수 |
|---|---|---|---:|
| 2018-03-01 | 관세 예고 | 트럼프, 철강·알루미늄 수입 관세 예고 | 3 |
| 2018-03-22 | 정책 절차 지시 | 미국, 중국 대상 Section 301 관세 절차 지시 | 3 |
| 2018-07-06 | 시행 | 미중 첫 대규모 상호 관세 시행 | 3 |
| 2018-09-17 | 대상 확대 발표 | 미국, 2천억 달러 중국산 상품 관세 확대 발표 | 4 |
| 2018-12-01 | 인상 유예 | 미중 G20 회담, 관세 인상 유예와 90일 협상 합의 | 3 |
| 2019-05-05 | 인상 예고 | 트럼프, 중국산 상품 관세 25% 재인상 예고 | 4 |
| 2019-06-29 | 협상 재개·보류 | 미중 오사카 회담, 추가 관세 보류·협상 재개 | 3 |
| 2019-08-01 | 대상 확대 예고 | 트럼프, 중국산 추가 3천억 달러 품목 관세 예고 | 4 |
| 2019-08-05 | 환율정책 지정 | 미국 재무부, 중국 환율조작국 지정 | 4 |
| 2019-08-13 | 일부 유예·예외 | 미국, 중국산 일부 소비재 관세를 12월로 유예 | 4 |
| 2019-08-23 | 보복·인상 예고 | 미중 보복관세 발표와 미국 추가 요율 인상 예고 | 4 |
| 2019-10-11 | 합의 윤곽·인상 보류 | 미중 1단계 합의 윤곽 발표·10월 관세 인상 보류 | 4 |
| 2019-12-13 | 합의·정지 발표 | 미중 1단계 합의 도달·12월 추가 관세 중단 발표 | 4 |
| 2020-01-15 | 협정 서명 | 미중 1단계 무역합의 서명 | 5 |
| 2025-02-01 | 발표 | 미국, 캐나다·멕시코·중국 추가 관세 발표 | 4 |
| 2025-02-03 | 유예 | 캐나다·멕시코 추가 관세 시행 유예 | 4 |
| 2025-03-04 | 시행 | 북미 관세 시행과 대중 관세 확대 | 4 |
| 2025-03-06 | 예외 발표 | USMCA 적격 캐나다·멕시코 상품 관세 예외 | 3 |
| 2025-04-02 | 발표 | 미국 기본·국가별 상호관세 발표 | 4 |
| 2025-04-04 | 대응 발표 | 중국, 미국산 상품 추가 관세 발표 | 3 |
| 2025-04-09 | 유예 | 중국 제외 국가별 상호관세 90일 유예 | 3 |
| 2025-04-11 | 예외 발표 | 스마트폰·컴퓨터 등 상호관세 예외 구체화 | 3 |
| 2025-05-12 | 합의 발표 | 미중 제네바 90일 관세 조정 합의 | 3 |
| 2025-05-28 | 법원 판결 | 미 국제무역법원, IEEPA 관세 권한에 제동 | 3 |
| 2025-05-29 | 집행정지 | 미 항소법원, 관세 금지 판결 일시 정지 | 3 |
| 2025-07-31 | 재설정 발표 | 미국, 국가별 상호관세 요율 재설정 | 3 |
| 2025-08-11 | 유예 연장 | 미중 관세 조정 90일 추가 연장 | 3 |
| 2025-10-10 | 추가 관세 예고 | 트럼프, 중국에 추가 100% 관세 예고 | 4 |
| 2025-10-30 | 합의 발표 | 미중 정상회담 후 관세·희토류 완화 합의 | 3 |
| 2026-01-17 | 관세 예고 | 그린란드 갈등 속 유럽 8개국 추가 관세 예고 | 3 |
| 2026-01-21 | 예고 철회 | 그린란드 관련 2월 관세 부과 계획 철회 | 2 |
| 2026-02-20 | 최종 판결 | 미 대법원, IEEPA의 관세 부과 권한 부정 | 4 |
| 2026-02-24 | 시행 | IEEPA 징수 종료와 Section 122 임시 관세 시행 | 4 |
| 2026-07-23 | 발표 | 미국, 60개 교역 상대 Section 301 관세 발표 | 3 |

## 교차검증의 의미와 한계

공식 문서는 해당 정부·법원이 무엇을 발표하거나 결정했는지 확인하는 1차 자료다. 정부가 제시한 정책의 정당성, 경제적 성과, 상대국에 대한 비난을 객관적 사실로 채택하지 않는다. 대통령 게시물은 실제 발언의 1차 기록이며 시행 명령과 다르다. UCSB American Presidency Project는 원문을 보존한 아카이브이며 정책 결정기관이 아니다.

Reuters, AP, The Block의 자료는 독립 보도다. Reuters를 Investing.com·Kitco·Business Standard·Business Recorder·Moneyweb·StreetInsider·gCaptain이 다시 실은 문서를 새로운 독립 취재로 세지 않았다. AP의 ClickOrlando 재배포도 AP와 별개 취재기관으로 중복 계산하지 않았다. 백악관 설명, 백악관 행정명령, CBP 집행 지침은 같은 행정부의 정책·집행 자료이므로 개수만으로 독립성 3배를 주장하지 않는다. 2026-02-24 레코드는 공식 시행 사실을 여러 문서로 대조한 기록이며 독립적인 ETH 시장 반응 검증을 확보하지 않았음을 명시했다.

정책과 가격이 같은 구간에 나타났다는 사실은 인과효과의 추정과 다르다. 미국 경제지표, 금리, 주식시장, 파생상품 레버리지, 거래소 유동성, 다른 암호자산 뉴스가 겹칠 수 있다. 뉴스 저점, 최근 24시간 변화, 금요일 이후 변화, UTC 일봉 종가 수익률은 서로 다른 관측이다. 향후 차트에서 가격 관측치를 계산하더라도 이를 관세 단독 효과라고 이름 붙이지 않는다.

### 중요한 날짜·출처 불일치

| 항목 | 처리 |
|---|---|
| 2018-03-01 / 03-08 / 03-23 | 간담회 관세 예고, 정식 포고문, 최초 적용을 구분했다. 간담회 원문의 시각 표기가 의심스러워 정확한 UTC 시각을 생성하지 않았다. |
| 2018-03-22 / 06-15 / 07-06 | 각서의 관세안 작성·의견수렴 지시와 최종 목록 발표, 실제 징수를 구분했다. 03-22 즉시 관세 시행으로 쓰지 않았다. |
| 2018-07-06 / 09-18 시장 | Reuters는 관세 시행·확대에도 주식시장이 오르는 구간을 보도했다. 관세 사건에 기계적으로 하락 방향을 부여하지 않았다. |
| 2018-12-01 / 12-03 | 주말 정상회담과 월요일 주식시장 보도를 분리했다. 기존 관세 철폐가 아닌 인상 유예다. |
| 2019-05-05 / 05-09 / 05-10 | 대통령 게시물, 관보 공표, 실제 인상 적용을 구분했다. 선적 시점별 경과 규정이 있었다. |
| 2019-06-29 / 07-01 | 오사카 회담의 추가 관세 보류와 다음 거래일 시장 관측을 분리했다. 기존 관세는 유지됐다. |
| 2019-08-01 / 08-13 / 08-23 | 대상 확대 예고 후 일부 유예·예외 및 요율 인상 계획이 이어졌다. 최초 10% 계획을 전체 품목의 실제 시행 이력으로 쓰지 않았다. |
| 2019-08-05 환율조작국 지정 | 위안화 약세·정규장 움직임과 늦은 지정 발표·야간 선물 관측을 구분했다. 미국의 정책적 판단 사실과 그 판단의 경제학적 정당성을 구분했다. |
| 2019-08-23 정규장 / 장후 | 중국 대응과 대통령 발언, 미국의 구체적 요율 인상 발표 순서를 보존했다. 장후 발표가 앞선 정규장 하락을 일으켰다고 설명하지 않는다. |
| 2019-10-11 / 12-13 / 2020-01-15 / 02-14 | 합의 윤곽 공개, 합의 도달 발표, 서명, 발효를 분리했다. 10월에는 문서화가 남아 있었다. |
| 2019-12-13 / 12-15 / 12-18 | 정지 문서의 공개열람일, 예정 관세 중단 효력일, 관보 게시일을 구분했다. 원문 끝의 공개열람 일시를 직접 확인했다. |
| 2020년 관세 인하 지침 | 7.5% 적용일은 2월 14일이다. CBP의 관보 쪽수·시간대 표기 오류 가능성이 있어 정확한 법적 날짜·시간은 USTR 보존 관보 원문 85 FR 3741을 우선했다. |
| 2025-02-01 발표 / 02-03 하락·유예 | 발표일, 다음 거래일의 시장 관측, 두 북미 유예 명령을 각각 보존했다. |
| Reuters 02-02 URL / 02-03 본문 | URL 문자열 대신 본문 게시·사건 날짜를 사용했다. |
| 2025-02-03 주식 보도 | 현재 헤더는 02-04 UTC이며 본문은 02-03 미국 거래일이다. |
| 2025-03-04 The Block | 최초 게시일 외 2026-10-19 수정 표시가 있어 당시 고정 원본으로 간주하지 않았다. |
| 2025-03-06 Reuters | 본문 사건일은 03-06, 현재 갱신 헤더는 03-07이다. |
| 2025-04-02 발표 / 04-05·04-09 적용 예정 | 발표 시점과 관세 적용 일정을 분리했다. |
| 2025-04-09 유예 | 중국 제외, 기본 10% 유지, 실제 유예 적용 04-10을 보존했다. 중국 125%를 모든 관세를 합한 총요율로 쓰지 않았다. |
| 2025-04-11 전자제품 예외 | 각서일과 CBP 미국 현지 게시일을 사용했다. 04-05 소급 적용일 및 04-12 보도일과 분리했다. |
| 초기 AP 전자제품 설명 | 전체 중국 관세가 없어졌다는 오독을 피하고 법적 범위는 각서·CBP의 상호관세 문구를 따랐다. |
| 2025-05-28·05-29 법원 절차 | 원심 제동과 항소심 정지를 별도 사건으로 수록했다. 원심 추가 본문 요청 시간 초과는 항소심 원문 12쪽의 공식 절차 회고로 보완했다. 최초 정지 명령 자체를 읽었다고 주장하지 않는다. |
| 2025-05-12 / 08-11 | 합의 발표와 각각 05-14 조정 기한·08-12 연장 시작을 분리했다. |
| 2025-07-31 재설정 | 명령 서명일과 08-07 시행을 구분했다. 08-01 고용지표가 시장 반응에 겹쳤다. |
| 2025-10-10 추가 100% | 기존 관세에 추가하는 향후 위협이다. 당일 실제 100% 부과나 11월 1일 확정 시행으로 쓰지 않았다. |
| Reuters 10-13 청산 보도 | URL·본문 날짜 10-13과 현재 헤더 10-14를 모두 확인했다. 전체 시장 청산액을 ETH 전용 수치로 쓰지 않았다. |
| 2025-10-30 / 11-01 / 11-04 / 11-10 | 정상회담·발표, 상세 설명, 시행 명령, 인하 적용 날짜를 구분했다. |
| 2026-01-17·01-21 | 그린란드 연계 관세 위협과 부과 계획 철회다. 영토 이전·합병 완료 사건이 아니다. |
| 2026-02-20 / 02-24 | 대법원 판단·대통령 발표와 실제 세관 적용을 분리했다. 15% 인상 발언 대신 확인된 최초 10% 시행 지침을 기록했다. |
| 2026-07-23 / 07-24 / 07-28 | USTR 발표, 실제 적용, 관보 게시를 구분했다. USTR 조사 결론을 모든 상대국 상품의 강제노동 사실로 확대하지 않았다. |

## BTC 공통 정책 ID

| ETH ID | commonEventId |
|---|---|
| eth-policy-three-country-tariffs-2025 | trump-three-country-tariffs-2025 |
| eth-policy-reciprocal-tariffs-2025 | trump-reciprocal-tariffs-2025 |
| eth-policy-reciprocal-pause-2025 | trump-tariff-pause-2025 |
| eth-policy-china-additional-tariff-threat-2025 | trump-china-tariff-threat-2025 |

위 매핑은 저장소 기존 BTC 4개 사건의 ID를 읽어 확인했다. 공통 ID는 같은 정책 사건을 가리키며 자산별 가격 반응이 같다는 뜻이 아니다. 기존 BTC 파일은 변경하지 않았다.

## 검토했으나 개별 마커로 추가하지 않은 항목

| 후보 | 처리·제외 이유 |
|---|---|
| 2018–2020 세부 품목 공고·반복 발언·기계적 적용일 | 주요 정책 전환 14개는 이번 보완 검토에서 수록했다. 2018-06-15 목록 발표와 08-23 두 번째 목록 시행, 2019-05-10 실제 인상, 09-01 일부 목록 시행, 2020-01-13 환율 지정 변경·02-14 협정 발효 등은 해당 전환점의 후속 설명으로 연결했다. 모든 날짜를 별도 ETH 충격 마커로 만들지 않았다. |
| 2025-02-04 중국 관세 최초 적용 | 최초 발표·북미 유예 설명에 중국 제외 사실을 보존했다. 같은 정책의 기계적 적용일을 독립 ETH 충격 사건으로 추가할 근거를 확보하지 않았다. |
| 2025-04-05 기본관세 적용, 04-08~11 미중 요율의 잇단 인상 | 04-02·04-04·04-09 및 제네바 합의의 전후 맥락에 포함했다. 각 시간대의 모든 요율 재변경을 별도 가격 충격처럼 나열하지 않는다. |
| 2025-04-07 ETH 급락이라는 별도 사건 | 정책의 새 발표가 아닌 시장 반응 구간일 수 있다. 거래소·시간창이 다른 뉴스 수익률을 독립 정책 사건으로 만들지 않았다. |
| 2025년 개별 국가·품목 협상과 자동차·철강·알루미늄 세부 조치 | 매크로 흐름과 직결되는 큰 전환점을 우선 검증했다. 전체 품목별 현행 관세 데이터베이스를 만들지 않았으며 개별 ETH 반응 근거가 부족한 조치는 보류했다. |
| 2025-06 런던 협의, 07-07 유예 연장 | 스톡홀름 공동성명과 7월 재설정의 정책 연속성으로 검토했다. 별도의 ETH 시장 충격으로 특정할 출처를 확보하지 않았다. |
| 2025-08-29 항소심 본안 판단 | 5월 원심·정지의 공식 절차 검증 자료로 사용했다. 그날 ETH 시장 맥락에 대한 별도 독립 확인이 충분하지 않아 추가 마커는 보류했다. |
| 2025-10-12 완화 발언 | 10월 급락 후 후속 시장 기사에서 맥락을 확인했다. 새로운 시행·유예 명령이 아닌 발언이며 정상회담 합의와 중복되는 개별 마커는 만들지 않았다. |
| 2026-02-21 15% 인상 발언 | 당시 확인된 2월 24일 세관 시행 지침은 10%였다. 발언을 실제 시행으로 잘못 표기하지 않도록 별도 시행 사건으로 넣지 않았다. |
| 2026년 이후 개별 환급 결정·Section 122 소송·개별 양자 조정·캐나다 품목 조치 | 검색에서 후속 사건이 확인되더라도 원문·효력·시장 맥락을 모두 대조하지 못한 항목을 추가하지 않았다. 현행 효력 전체를 추정하지 않는다. |

보류는 사건이 중요하지 않다는 판정이 아니다. 추가 원문·독립 보도 검증을 마치면 별도 레코드로 확장할 수 있다. 수록 개수를 임의 상한으로 제한하지 않았으며, 검증되지 않은 기록으로 '모두'를 채우지 않았다.

## 원문 목록

각 레코드의 `sources`에는 이 원문에 대한 역할과 검증한 주장이 별도로 들어 있다. 사건별 출처 연결은 118개이며, 아래에는 고유 URL 83개를 한 번씩만 나열한다. 링크 수는 독립 취재기관 수가 아니다.

- [Remarks by President Trump in Listening Session with Representatives from the Steel and Aluminum Industry](https://trumpwhitehouse.archives.gov/briefings-statements/remarks-president-trump-listening-session-representatives-steel-aluminum-industry/) — The White House — archived; primary; 문서 날짜 2018-03-01; 확인 2026-10-24.
- [GLOBAL MARKETS-Stocks tumble, dollar gains on Trump tariff comments](https://in.investing.com/news/stock-market-news/global-marketsstocks-tumble-dollar-gains-on-trump-tariff-comments-1046160) — Reuters, republished by Investing.com; secondary; 문서 날짜 2018-03-02; 확인 2026-10-24.
- [CSMS# 18-000317 — UPDATE: Additional Duty on Imports of Steel and Aluminum Articles under Section 232](https://content.govdelivery.com/accounts/USDHSCBP/bulletins/1ed564e) — U.S. Customs and Border Protection; primary; 문서 날짜 2018-05-01; 확인 2026-10-24.
- [Presidential Memorandum on the Actions by the United States Related to the Section 301 Investigation](https://trumpwhitehouse.archives.gov/presidential-actions/presidential-memorandum-actions-united-states-related-section-301-investigation/) — The White House — archived; primary; 문서 날짜 2018-03-22; 확인 2026-10-24.
- [Stocks tumble to worst day in six weeks after Trump tariff action](https://www.investing.com/news/stock-market-news/futures-back-off-on-trade-war-fears-tech-woes-persist-1354165?ampMode=1) — Reuters, republished by Investing.com; secondary; 문서 날짜 2018-03-22; 확인 2026-10-24.
- [USTR Issues Tariffs on Chinese Products in Response to Unfair Trade Practices](https://ustr.gov/about-us/policy-offices/press-office/press-releases/2018/june/ustr-issues-tariffs-chinese-products) — Office of the United States Trade Representative; primary; 문서 날짜 2018-06-15; 확인 2026-10-24.
- [USTR Finalizes Second Tranche of Tariffs on Chinese Products in Response to China’s Unfair Trade Practices](https://ustr.gov/about-us/policy-offices/press-office/press-releases/2018/august/ustr-finalizes-second-tranche) — Office of the United States Trade Representative; primary; 문서 날짜 2018-08-07; 확인 2026-10-24.
- [GLOBAL MARKETS-Stocks, euro survive first battle of U.S.-China trade war](https://ca.investing.com/news/stock-market-news/global-marketsstocks-euro-survive-first-battle-of-uschina-trade-war-1197532) — Reuters, republished by Investing.com; secondary; 문서 날짜 2018-07-06; 확인 2026-10-24.
- [Statement from the President — tariffs on approximately $200 billion of imports from China](https://trumpwhitehouse.archives.gov/briefings-statements/statement-from-the-president-4/) — The White House — archived; primary; 문서 날짜 2018-09-17; 확인 2026-10-24.
- [Wall Street rallies as blow from fresh tariffs less than feared](https://www.business-standard.com/article/reuters/wall-street-rallies-as-blow-from-fresh-tariffs-less-than-feared-118091801480_1.html) — Reuters, republished by Business Standard; secondary; 문서 날짜 2018-09-18; 확인 2026-10-24.
- [Statement from the Press Secretary Regarding the President’s Working Dinner with China](https://trumpwhitehouse.archives.gov/briefings-statements/statement-press-secretary-regarding-presidents-working-dinner-china/) — The White House — archived; primary; 문서 날짜 2018-12-01; 확인 2026-10-24.
- [CSMS# 19-000238 — UPDATE: Section 301 (Tranche 3) Duties as of May 10, 2019](https://content.govdelivery.com/accounts/USDHSCBP/bulletins/24419b4) — U.S. Customs and Border Protection; primary; 문서 날짜 2019-05-10; 확인 2026-10-24.
- [U.S.-China trade truce boosts Wall Street](https://www.investing.com/news/stock-market-news/uschina-trade-truce-boosts-wall-street-1708279) — Reuters, republished by Investing.com; secondary; 문서 날짜 2018-12-03; 확인 2026-10-24.
- [Notice of Modification of Section 301 Action — 84 FR 20459](https://www.govinfo.gov/content/pkg/FR-2019-05-09/pdf/2019-09681.pdf) — Office of the United States Trade Representative / Federal Register; primary; 문서 날짜 2019-05-09; 확인 2026-10-24.
- [Tweets of May 5, 2019](https://www.presidency.ucsb.edu/documents/tweets-may-5-2019) — The American Presidency Project — Donald J. Trump post archive; primary; 문서 날짜 2019-05-05; 확인 2026-10-24.
- [China stocks fall most in over 3 years on tariff threats, yuan tumbles](https://www.reuters.com/article/world/china-stocks-fall-most-in-over-3-years-on-tariff-threats-yuan-tumbles-idUSKCN1SC0MK/) — Reuters; secondary; 문서 날짜 2019-05-06; 확인 2026-10-24.
- [Remarks by President Trump in Press Conference | Osaka, Japan](https://trumpwhitehouse.archives.gov/briefings-statements/remarks-president-trump-press-conference-osaka-japan/) — The White House — archived; primary; 문서 날짜 2019-06-29; 확인 2026-10-24.
- [Wall Street rallies as trade optimism lifts tech stocks](https://www.brecorder.com/news/506696/wall-street-rallies-as-trade-optimism-lifts-tech-stocks) — Reuters, republished by Business Recorder; secondary; 문서 날짜 2019-07-01; 확인 2026-10-24.
- [Tweets of August 1, 2019](https://www.presidency.ucsb.edu/documents/tweets-august-1-2019) — The American Presidency Project — Donald J. Trump post archive; primary; 문서 날짜 2019-08-01; 확인 2026-10-24.
- [Wall St dragged down by Trump trade tweet](https://www.moneyweb.co.za/news-fast-news/wall-st-dragged-down-by-trump-trade-tweet/) — Reuters, republished by Moneyweb; secondary; 문서 날짜 2019-08-02; 확인 2026-10-24.
- [USTR Announces Next Steps on Proposed 10 Percent Tariff on Imports from China](https://www.ustr.gov/about-us/policy-offices/press-office/press-releases/2019/august/ustr-announces-next-steps-proposed) — Office of the United States Trade Representative; primary; 문서 날짜 2019-08-13; 확인 2026-10-24.
- [USTR Statement on Section 301 Tariff Action Regarding China](https://www.ustr.gov/about-us/policy-offices/press-office/press-releases/2019/august/ustr-statement-section-301-tariff) — Office of the United States Trade Representative; primary; 문서 날짜 2019-08-23; 확인 2026-10-24.
- [Treasury Designates China as a Currency Manipulator](https://home.treasury.gov/news/press-releases/sm751) — U.S. Department of the Treasury; primary; 문서 날짜 2019-08-05; 확인 2026-10-24.
- [S&P 500 futures fall after U.S. Treasury calls China currency manipulator](https://www.reuters.com/article/business/sp-500-futures-fall-after-us-treasury-calls-china-currency-manipulator-idUSKCN1UV2D7/) — Reuters; secondary; 문서 날짜 2019-08-05; 확인 2026-10-24.
- [U.S. designates China a currency manipulator, escalating trade war](https://www.reuters.com/article/us-china-markets/u-s-designates-china-a-currency-manipulator-escalating-trade-war-idUSKCN1UV061/) — Reuters; secondary; 문서 날짜 2019-08-06; 확인 2026-10-24.
- [Treasury Releases Report on Macroeconomic and Foreign Exchange Policies of Major Trading Partners of the United States](https://home.treasury.gov/news/press-releases/sm873) — U.S. Department of the Treasury; primary; 문서 날짜 2020-01-13; 확인 2026-10-24.
- [Wall Street rebounds as tariff delay prompts rally](https://www.investing.com/news/stock-market-news/futures-slide-amid-geopolitical-tensions-trade-worries-1953540) — Reuters, republished by Investing.com; secondary; 문서 날짜 2019-08-13; 확인 2026-10-24.
- [Notice of Modification of Section 301 Action — FR Doc. 2019-27306, public inspection copy](https://s3.amazonaws.com/public-inspection.federalregister.gov/2019-27306.pdf) — Office of the United States Trade Representative / Federal Register; primary; 문서 날짜 2019-12-13; 확인 2026-10-24.
- [Trump heaps another 5% tariff on Chinese goods in latest tit-for-tat escalation](https://www.reuters.com/article/world/trump-heaps-another-5-tariff-on-chinese-goods-in-latest-tit-for-tat-escalation-idUSKCN1VD21E/) — Reuters; secondary; 문서 날짜 2019-08-24; 확인 2026-10-24.
- [Remarks by President Trump and Vice Premier Liu He of the People’s Republic of China in a Meeting](https://trumpwhitehouse.archives.gov/briefings-statements/remarks-president-trump-vice-premier-liu-peoples-republic-china-meeting/) — The White House — archived; primary; 문서 날짜 2019-10-11; 확인 2026-10-24.
- [U.S. outlines 'Phase 1' trade deal with China, suspends October tariff hike](https://www.streetinsider.com/ETFs/U.S.%2Boutlines%2BPhase%2B1%2Btrade%2Bdeal%2Bwith%2BChina,%2Bsuspends%2BOctober%2Btariff%2Bhike/16002465.html) — Reuters, republished by StreetInsider; secondary; 문서 날짜 2019-10-11; 확인 2026-10-24.
- [United States and China Reach Phase One Trade Agreement](https://ustr.gov/about-us/policy-offices/press-office/press-releases/2019/december/united-states-and-china-reach) — Office of the United States Trade Representative; primary; 문서 날짜 2019-12-13; 확인 2026-10-24.
- [USTR Announces Formation of Bilateral Evaluation and Dispute Resolution Office Pursuant to U.S.-China Phase One Agreement](https://www.ustr.gov/about-us/policy-offices/press-office/press-releases/2020/february/ustr-announces-formation-bilateral-evaluation-and-dispute-resolution-office-pursuant-us-china-phase) — Office of the United States Trade Representative; primary; 문서 날짜 2020-02-14; 확인 2026-10-24.
- [Markets have muted reaction to long-awaited China trade deal](https://www.clickorlando.com/business/2019/12/13/us-stocks-open-lower-as-traders-await-clarity-on-trade-deal/) — Associated Press, republished by ClickOrlando; secondary; 문서 날짜 2019-12-13; 확인 2026-10-24.
- [Notice of Modification of Section 301 Action — 85 FR 3741](https://ustr.gov/sites/default/files/enforcement/301Investigations/Notice_of_Modification-January_2020.pdf) — Office of the United States Trade Representative / Federal Register; primary; 문서 날짜 2020-01-22; 확인 2026-10-24.
- [President Donald J. Trump is Signing a Landmark Phase One Trade Agreement with China](https://trumpwhitehouse.archives.gov/briefings-statements/president-donald-j-trump-signing-landmark-phase-one-trade-agreement-china/) — The White House — archived; primary; 문서 날짜 2020-01-15; 확인 2026-10-24.
- [China Signs 'Phase 1' Trade Deal with United States](https://gcaptain.com/china-signs-phase-1-trade-deal-with-united-states/) — Reuters, republished by gCaptain; secondary; 문서 날짜 2020-01-15; 확인 2026-10-24.
- [Fact Sheet: President Donald J. Trump Imposes Tariffs on Imports from Canada, Mexico and China](https://www.whitehouse.gov/fact-sheets/2025/02/fact-sheet-president-donald-j-trump-imposes-tariffs-on-imports-from-canada-mexico-and-china/) — The White House; primary; 문서 날짜 2025-02-01; 확인 2026-10-24.
- [Bitcoin drops to 3-week low as Trump tariffs rattle markets](https://www.reuters.com/markets/currencies/bitcoin-slides-below-100000-tariffs-rattle-markets-2025-02-02/) — Reuters; secondary; 문서 날짜 2025-02-03; 확인 2026-10-24.
- [Progress on the Situation at Our Northern Border](https://www.whitehouse.gov/presidential-actions/2025/02/progress-on-the-situation-at-our-northern-border/) — The White House; primary; 문서 날짜 2025-02-03; 확인 2026-10-24.
- [Progress on the Situation at Our Southern Border](https://www.whitehouse.gov/presidential-actions/2025/02/progress-on-the-situation-at-our-southern-border/) — The White House; primary; 문서 날짜 2025-02-03; 확인 2026-10-24.
- [Wall Street closes down, pares losses after Trump delays Mexico tariffs](https://www.reuters.com/markets/us/futures-tumble-trumps-tariffs-stoke-trade-war-risks-2025-02-03/) — Reuters; secondary; 문서 날짜 2025-02-04; 확인 2026-10-24.
- [Fact Sheet: President Donald J. Trump Adjusts Tariffs on Canada and Mexico to Minimize Disruption to the Automotive Industry](https://www.whitehouse.gov/fact-sheets/2025/03/fact-sheet-president-donald-j-trump-adjusts-tariffs-on-canada-and-mexico-to-minimize-disruption-to-the-automotive-industry/) — The White House; primary; 문서 날짜 2025-03-06; 확인 2026-10-24.
- [Bitcoin, ether lose over 10% as Trump's tariffs take effect](https://www.theblock.co/news/markets/2025-03-04-bitcoin-ether-lose-over-10-as-trumps-tariffs-take-effect-344377) — The Block; secondary; 문서 날짜 2025-03-04; 확인 2026-10-24.
- [Trump delays tariffs for goods under Mexico, Canada trade deal](https://www.reuters.com/business/tariff-reprieve-likely-be-extended-all-usmca-compliant-goods-lutnick-says-2025-03-06/) — Reuters; secondary; 문서 날짜 2025-03-07; 확인 2026-10-24.
- [Fact Sheet: President Donald J. Trump Declares National Emergency to Increase our Competitive Edge, Protect our Sovereignty, and Strengthen our National and Economic Security](https://www.whitehouse.gov/fact-sheets/2025/04/fact-sheet-president-donald-j-trump-declares-national-emergency-to-increase-our-competitive-edge-protect-our-sovereignty-and-strengthen-our-national-and-economic-security/) — The White House; primary; 문서 날짜 2025-04-02; 확인 2026-10-24.
- [U.S. crypto stocks slide as Trump's sweeping tariffs jolt markets](https://www.reuters.com/markets/us-crypto-stocks-slide-trumps-sweeping-tariffs-jolt-markets-2025-04-03/) — Reuters; secondary; 문서 날짜 2025-04-03; 확인 2026-10-24.
- [国务院关税税则委员会关于对原产于美国的进口商品加征关税的公告 — 税委会公告2025年第4号](https://gss.mof.gov.cn/gzdt/zhengcefabu/202504/t20250404_3961451.htm) — Customs Tariff Commission of the State Council / Ministry of Finance of China; primary; 문서 날짜 2025-04-04; 확인 2026-10-24.
- [Modifying Reciprocal Tariff Rates to Reflect Trading Partner Retaliation and Alignment](https://www.whitehouse.gov/presidential-actions/2025/04/modifying-reciprocal-tariff-rates-to-reflect-trading-partner-retaliation-and-alignment/) — The White House; primary; 문서 날짜 2025-04-09; 확인 2026-10-24.
- [China slaps a 34% tax on all US imports in retaliation for Trump's tariffs](https://apnews.com/article/02cd23e913649f32985f075058e787c4) — Associated Press; secondary; 문서 날짜 2025-04-04; 확인 2026-10-24.
- [Joint Statement on U.S.-China Economic and Trade Meeting in Geneva](https://www.whitehouse.gov/briefings-statements/2025/05/joint-statement-on-u-s-china-economic-and-trade-meeting-in-geneva/) — The White House — U.S.-China joint statement; primary; 문서 날짜 2025-05-12; 확인 2026-10-24.
- [Trading Day: Boom! Trump tariff pause sparks monster rally](https://www.reuters.com/markets/global-markets-trading-day-graphics-2025-04-09/) — Reuters — Jamie McGeever, markets column; secondary; 문서 날짜 2025-04-09; 확인 2026-10-24.
- [Clarification of Exceptions Under Executive Order 14257 of April 2, 2025, as Amended](https://www.whitehouse.gov/presidential-actions/2025/04/clarification-of-exceptions-under-executive-order-14257-of-april-2-2025-as-amended/) — The White House; primary; 문서 날짜 2025-04-11; 확인 2026-10-24.
- [CSMS # 64724565 — UPDATED GUIDANCE: Reciprocal Tariff Exclusion for Specified Products; April 5, 2025 Effective Date](https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3db9e55) — U.S. Customs and Border Protection; primary; 문서 날짜 2025-04-11; 확인 2026-10-24.
- [Trump administration says it will exclude some electronics from 'reciprocal' tariffs](https://www.wbur.org/news/2025/04/12/trump-administration-says-it-will-exclude-some-electronics-from-reciprocal-tariffs) — Associated Press, republished by WBUR; secondary; 문서 날짜 2025-04-12; 확인 2026-10-24.
- [Stocks, dollar surge as US and China agree 90-day tariff relief](https://www.kitco.com/news/off-the-wire/2025-05-12/stocks-dollar-surge-us-and-china-agree-90-day-tariff-relief) — Reuters, republished by Kitco; secondary; 문서 날짜 2025-05-12; 확인 2026-10-24.
- [Joint Statement on U.S.-China Economic and Trade Meeting in Stockholm](https://www.whitehouse.gov/briefings-statements/2025/08/joint-statement-on-u-s-china-economic-and-trade-meeting-in-stockholm/) — The White House — U.S.-China joint statement; primary; 문서 날짜 2025-08-11; 확인 2026-10-24.
- [V.O.S. Selections, Inc. v. United States — Slip Opinion 25-66](https://www.cit.uscourts.gov/sites/cit/files/25-66.pdf) — U.S. Court of International Trade; primary; 문서 날짜 2025-05-28; 확인 2026-10-24.
- [V.O.S. Selections, Inc. v. Trump — Federal Circuit opinion, cases 2025-1812 and 2025-1813](https://www.cafc.uscourts.gov/opinions-orders/25-1812.OPINION.8-29-2025_2566151.pdf) — U.S. Court of Appeals for the Federal Circuit; primary; 문서 날짜 2025-08-29; 확인 2026-10-24.
- [Trump’s tariffs to remain in effect after appeals court grants stay](https://www.investing.com/news/stock-market-news/us-ruling-that-trump-tariffs-are-unlawful-stirs-relief-and-uncertainty-4069816) — Reuters, republished by Investing.com; secondary; 문서 날짜 2025-05-29; 확인 2026-10-24.
- [Learning Resources, Inc. v. Trump / Trump v. V.O.S. Selections, Inc. — Supreme Court opinion](https://www.supremecourt.gov/opinions/25pdf/24-1287_4gcj.pdf) — Supreme Court of the United States; primary; 문서 날짜 2026-02-20; 확인 2026-10-24.
- [Further Modifying the Reciprocal Tariff Rates — Executive Order 14326](https://www.whitehouse.gov/presidential-actions/2025/07/further-modifying-the-reciprocal-tariff-rates/) — The White House; primary; 문서 날짜 2025-07-31; 확인 2026-10-24.
- [Markets dive after Trump hits more countries with steep tariffs](https://www.investing.com/news/economic-indicators/trump-hits-more-countries-with-steep-tariffs-markets-tumble-4165747) — Reuters, republished by Investing.com; secondary; 문서 날짜 2025-08-01; 확인 2026-10-24.
- [Further Modifying Reciprocal Tariff Rates to Reflect Ongoing Discussions with The People's Republic of China](https://www.whitehouse.gov/presidential-actions/2025/08/further-modifying-reciprocal-tariff-rates-to-reflect-ongoing-discussions-with-the-peoples-republic-of-china/) — The White House; primary; 문서 날짜 2025-08-11; 확인 2026-10-24.
- [US, China extend tariff truce by 90 days, staving off surge in duties](https://www.investing.com/news/world-news/trump-says-well-see-what-happens-on-august-12-deadline-for-china-tariffs-4183460) — Reuters, republished by Investing.com; secondary; 문서 날짜 2025-08-11; 확인 2026-10-24.
- [Truth Social Posts of October 10, 2025](https://www.presidency.ucsb.edu/documents/truth-social-posts-october-10-2025) — The American Presidency Project — Donald J. Trump post archive; primary; 문서 날짜 2025-10-10; 확인 2026-10-24.
- [US will impose additional 100% tariff on Chinese imports from November, Trump says](https://www.reuters.com/world/china/us-will-impose-additional-100-tariff-chinese-imports-november-trump-says-2025-10-10/) — Reuters; secondary; 문서 날짜 2025-10-10; 확인 2026-10-24.
- [After record crypto crash, a rush to hedge against another freefall](https://www.reuters.com/world/asia-pacific/after-record-crypto-crash-rush-hedge-against-another-freefall-2025-10-13/) — Reuters; secondary; 문서 날짜 2025-10-14; 확인 2026-10-24.
- [Fact Sheet: President Donald J. Trump Strikes Deal on Economic and Trade Relations with China](https://www.whitehouse.gov/fact-sheets/2025/11/fact-sheet-president-donald-j-trump-strikes-deal-on-economic-and-trade-relations-with-china/) — The White House; primary; 문서 날짜 2025-11-01; 확인 2026-10-24.
- [Trump shaves China tariffs in deal with Xi on fentanyl, rare earths](https://www.reuters.com/world/china/looming-trump-xi-meeting-revives-hope-us-china-trade-truce-2025-10-29/) — Reuters; secondary; 문서 날짜 2025-10-30; 확인 2026-10-24.
- [Modifying Reciprocal Tariff Rates Consistent with the Economic and Trade Arrangement Between the United States and the People’s Republic of China](https://www.whitehouse.gov/presidential-actions/2025/11/modifying-reciprocal-tariff-rates-consistent-with-the-economic-and-trade-arrangement-between-the-united-states-and-the-peoples-republic-of-china/) — The White House; primary; 문서 날짜 2025-11-04; 확인 2026-10-24.
- [Truth Social Posts of January 17, 2026](https://www.presidency.ucsb.edu/documents/truth-social-posts-january-17-2026) — The American Presidency Project — Donald J. Trump post archive; primary; 문서 날짜 2026-01-17; 확인 2026-10-24.
- [Trump vows tariffs on eight European nations over Greenland](https://www.reuters.com/world/europe/trump-vows-tariffs-eight-european-nations-over-greenland-2026-01-17/) — Reuters; secondary; 문서 날짜 2026-01-17; 확인 2026-10-24.
- [Truth Social Posts of January 21, 2026](https://www.presidency.ucsb.edu/documents/truth-social-posts-january-21-2026) — The American Presidency Project — Donald J. Trump post archive; primary; 문서 날짜 2026-01-21; 확인 2026-10-24.
- [Stocks stage dramatic rebound after Trump announces Greenland framework](https://www.reuters.com/world/china/global-markets-wrapup-1-pix-2026-01-21/) — Reuters; secondary; 문서 날짜 2026-01-21; 확인 2026-10-24.
- [Ending Certain Tariff Actions — Executive Order 14389](https://www.whitehouse.gov/presidential-actions/2026/02/ending-certain-tariff-actions/) — The White House; primary; 문서 날짜 2026-02-20; 확인 2026-10-24.
- [CSMS # 67834313 — Ending Collection of International Emergency Economic Powers Act Duties](https://content.govdelivery.com/accounts/USDHSCBP/bulletins/40b11c9) — U.S. Customs and Border Protection; primary; 문서 날짜 2026-02-22; 확인 2026-10-24.
- [US stocks end higher, Treasury yields gain after Supreme Court strikes down Trump tariffs](https://www.reuters.com/world/china/global-markets-global-markets-2026-02-20/) — Reuters; secondary; 문서 날짜 2026-02-20; 확인 2026-10-24.
- [Imposing a Temporary Import Surcharge to Address Fundamental International Payments Problems](https://www.whitehouse.gov/presidential-actions/2026/02/imposing-a-temporary-import-surcharge-to-address-fundamental-international-payments-problems/) — The White House; primary; 문서 날짜 2026-02-20; 확인 2026-10-24.
- [CSMS # 67844987 — Imposing Temporary Section 122 Duties](https://content.govdelivery.com/accounts/USDHSCBP/bulletins/40b3b7b) — U.S. Customs and Border Protection; primary; 문서 날짜 2026-02-23; 확인 2026-10-24.
- [USTR Takes Action in Forced Labor Section 301 Investigations](https://ustr.gov/about/policy-offices/press-office/press-releases/2026/july/ustr-takes-action-forced-labor-section-301-investigations) — Office of the United States Trade Representative; primary; 문서 날짜 2026-07-23; 확인 2026-10-24.
- [Notice of Actions in Section 301 Investigations of Acts, Policies, and Practices of Various Economies Related to the Failure of Each Economy To Impose and Effectively Enforce a Prohibition on the Importation of Goods Produced With Forced Labor](https://www.federalregister.gov/documents/2026/07/28/2026-15181/notice-of-actions-in-section-301-investigations-of-acts-policies-and-practices-of-various-economies) — Office of the United States Trade Representative / Federal Register; primary; 문서 날짜 2026-07-28; 확인 2026-10-24.
- [Trump to impose forced labor duties on Friday as temporary 10% US tariffs expire](https://www.investing.com/news/economic-indicators/trump-to-impose-forced-labor-duties-on-friday-as-temporary-10-us-tariffs-expire-4810104) — Reuters, republished by Investing.com; secondary; 문서 날짜 2026-07-23; 확인 2026-10-24.

## 로컬 데이터 점검

34개 레코드의 JSON 파싱, 고유 ID, 날짜 순서·기준일 상한, 필수 문자열, 24자 이내 라벨, 사건별 2개 이상 고유 출처 URL과 최소 1개 1차 자료, 허용된 출처 유형, 게시·확인 날짜 형식, 정확한 announcementUtc ISO 형식 3개, 공통 BTC ID 4개를 점검했다. 이 문서와 JSON 외의 UI·생성기·BTC 데이터는 이 작업에서 변경하지 않았다. 출처의 정책 사실과 가격 관측을 분리해 검토했으며, 가격 반응 계산·모델링·예측 검증은 이 자료의 범위가 아니다.
