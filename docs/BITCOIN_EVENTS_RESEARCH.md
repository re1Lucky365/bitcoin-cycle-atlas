# 비트코인 역사 사건: 차트 표시용 조사 기록

검토 기준일: **2026-10-22**. 구현: `dist/bitcoin-events.js`. 검증: `tests/bitcoin-events.test.mjs`. 작업 시작 기준 커밋: `f48c0d79a7922c7f460057629ae58e8a8b12c004`.

2009년 제네시스부터 2025년 미국 전략적 비트코인 준비자산 행정명령까지 **39개 사건**을 선정했다. 총 83개 출처 참조, 고유 URL 74개를 연결했다. 같은 문서의 반복 참조를 독립된 검증으로 세지 않는다. 2026년 10월 22일까지 확인한 자료를 사용하며, 검토 기준일 뒤의 사건이나 예정된 반감기·전망·가격 목표는 역사 사건 목록에 넣지 않는다. 이 목록은 완전한 연대기나 최신 뉴스 피드가 아니다.

## 선정과 해석 원칙

세계적인 관심을 받았던 프로토콜 변화, 금융상품 진입, 규제·정책, 국가·기업 채택, 거래소·수탁 위험, 거시경제 맥락을 균형 있게 보여 주기 위한 편집 목록이다. 검색량·언론 보도량·국가별 관심도를 계량한 인기순위가 아니다. 영어권과 미국의 공시·법원 자료 접근성이 높아 미국 제도권 사건 비중이 크다. 특정 연도가 비어 있다고 그해 중요한 사건이 없었다는 뜻은 아니다.

분류는 사건의 성격을 나타내며 호재·악재 점수가 아니다. 중요도 3은 넓은 차트에서 먼저 보여 줄 편집상 우선순위, 2는 확대 시 보완할 맥락, 1은 세부 이정표다. 중요도 3 사건은 19개다. 사건 뒤 가격이 움직였다는 시간적 인접성만으로 인과를 주장하지 않는다. 이 데이터에는 기대수익률, 매매 신호, 가격 충격 점수, 확률이 없다.

기업 발표는 회사가 무엇을 공시했는지 확인하는 1차 자료다. 회사의 전망이나 해명까지 독립적으로 입증하는 것은 아니다. 거래소 장애·수탁자 손실은 비트코인 합의 규칙의 실패와 구분한다. 입법·법원 판단·규제 승인을 현재의 모든 법적 의무를 설명하는 자료로 일반화하지 않는다.

## 날짜의 의미

`date`는 차트에 놓을 **달력 날짜 라벨**이다. `datePrecision`이 `source-calendar-day`인 사건은 원문이 사용한 공시일·현지 법원 신청일·정책 공개일·거래일을 유지한다. 하루 중 정확한 시각이 없는 자료를 임의로 UTC 시각으로 바꾸지 않는다. UTC 축에 해당 날짜를 배치하더라도 실제 사건이 UTC 자정에 일어났다는 뜻은 아니다. 따라서 분봉에서 역사 사건 표시는 하루 단위 맥락이지 분 단위 뉴스 알림이 아니다.

`datePrecision`이 `block-timestamp`인 7개 사건에는 `timestampUtc`, `blockHeight`, `blockHash`가 있다. Blockstream의 공개 API에서 높이로 해시를 구한 뒤 블록 레코드의 epoch timestamp를 UTC로 변환해 확인했다. API 경로는 `https://blockstream.info/api/block-height/{height}`, `https://blockstream.info/api/block/{hash}`다. 블록 시간은 채굴자가 헤더에 기록한 값이며 모든 노드에서의 최초 도착 시각을 독립적으로 측정한 것은 아니다.

| 사건 | 높이 | 확인한 UTC 블록 시각 | 원장 기록 |
|---|---:|---|---|
| 제네시스 블록 | 0 | 2009-01-03T18:15:05Z | [블록 레코드](https://blockstream.info/block/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f) |
| 1차 반감기 | 210,000 | 2012-11-28T15:24:38Z | [블록 레코드](https://blockstream.info/block/000000000000048b95347e83192f69cf0366076336c639f9b7228e9ba171342e) |
| 2차 반감기 | 420,000 | 2016-07-09T16:46:13Z | [블록 레코드](https://blockstream.info/block/000000000000000002cce816c0ab2c5c269cb081896b7dcb34b8422d6b74ffa1) |
| SegWit 활성화 | 481,824 | 2017-08-24T01:57:37Z | [블록 레코드](https://blockstream.info/block/0000000000000000001c8018d9cb3b742ef25114f27563e3fc4a1902167f9893) |
| 3차 반감기 | 630,000 | 2020-05-11T19:23:43Z | [블록 레코드](https://blockstream.info/block/000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d) |
| 탭루트 활성화 | 709,632 | 2021-11-14T05:15:27Z | [블록 레코드](https://blockstream.info/block/0000000000000000000687bca986194dc2c1f949318629b44bb54ec0a94d8244) |
| 4차 반감기 | 840,000 | 2024-04-20T00:09:27Z | [블록 레코드](https://blockstream.info/block/0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5) |

Bitcoin Core v29.0의 메인넷 파라미터에서 세그윗 높이 481,824, 탭루트 최소 활성화 높이 709,632, 반감기 간격 210,000블록을 확인했다. `GetBlockSubsidy`의 정수 시프트 계산과 실제 블록 날짜를 함께 사용했다. 코드 주석의 예상 날짜나 10분 평균 블록 시간으로 실제 발생일을 대체하지 않았다. 코드 출처의 게시일은 v29.0 배포일 2025-04-14를 사용한다. [배포 이력](https://bitcoin.org/en/version-history)과 [고정 버전의 메인넷 파라미터](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp)로 재확인할 수 있다.

다음 혼동을 특히 점검했다.

- 피자 거래는 5월 18일 제안이 아니라 5월 22일 성사 답글이다.
- 실크로드 폐쇄는 2013년 10월 2일이며 운영자 체포일과 다르다.
- 마운트곡스의 2014년 2월 28일은 민사재생 신청일이며 최초 해킹일이 아니다.
- CME 사건은 첫 **거래일**인 2017년 12월 18일이다. 야간 세션은 미국 시간 17일에 시작됐다.
- 테슬라 사건은 2021년 2월 8일 공시다. 공시가 설명한 매입은 1월이다.
- 중국의 2021년 9월 24일은 두 통지의 공개일이다. 서명일은 각각 9월 3일과 15일이다.
- 블랙록 S-1의 파일명에는 설립일 2023년 6월 8일이 있지만 표지의 제출일은 6월 15일이다.
- 2024년 1월 10일 승인, 11일 거래 개시를 분리했다. 9일의 허위 SNS 게시물은 승인이 아니다.
- 2024년 반감기는 미국 현지 4월 19일 보도가 많지만 UTC 블록 날짜는 4월 20일이다.
- 작센의 압수 BTC 매각은 7월 12일 완료, 검찰 발표는 7월 16일이다.
- SAB 122는 2025년 1월 23일 발표, 문서에 적힌 효력 발생일은 1월 30일이다.
- 엘살바도르의 2025년 1월 29일은 법 개정 의결일이며 시행일과 구별한다.

## 출처 접근과 교차 검증의 한계

공식 규제기관·법원 기록, SEC EDGAR 공시, 개발사 릴리스, 당사자의 당시 공지, 원장 기록을 우선했다. 독립 보도가 있는 경우 Reuters·AP·공영방송·당시 전문 매체와 날짜·사건 성격을 대조했다. 모든 사건이 서로 독립적인 두 출처로 확인된 것은 아니다. 예를 들어 피자 거래의 핵심 근거는 당사자 게시글이며, 반감기의 핵심 근거는 동일한 공개 원장과 코드다. 같은 회사의 재배포 보도자료나 SEC에 첨부한 같은 회사 자료는 독립 의견으로 세지 않는다.

검색 도구와 공개 문서 원문을 사용했다. 일부 사이트는 자동 조회를 제한했다. 엘살바도르 2025년 [Decree 199 원문 PDF](https://www.asamblea.gob.sv/sites/default/files/documents/decretos/FC2C7E66-490B-4420-B8B5-221C2F2A4C28.pdf)는 검색에는 노출되었지만 직접 조회가 타임아웃·HTTP 503으로 실패했다. 따라서 데이터의 의결일은 Reuters, 변경 내용은 IMF의 2025년 2월 26일 공식 발표에 근거한다. 법정통화 지위의 포괄적인 해석 대신 실제로 확인된 민간 수취 의무 변경을 기록했다.

그레이스케일 사건의 [법원 원본 PDF 주소](https://www.cadc.uscourts.gov/internet/opinions.nsf/32C91E3A96E9442285258A1A004FD576/$file/22-1142-2014527.pdf)는 검색 도구의 직접 접근이 제한됐다. Justia가 전재한 **판결문 본문**의 결정일·주문, SEC에 공시된 당사자 발표, AP 보도를 확인했다. Justia의 자체 요약만으로 법원의 결정을 해석하지 않았다. 버몬트 금융규제국의 셀시어스 안내는 검색에서 게시일과 본문을 확인했지만 직접 열기는 403이었다. Kroll 채권자위원회 기록과 당시 보도를 추가 확인했다.

CME의 2025년 회고 연대표에는 3차 반감기를 2018년으로 쓰는 등 다른 사건에 오류가 있어, 이를 전체 연대기의 근거로 복사하지 않았다. CME 선물은 당시 출시 공지와 실제 개장 보도를 사용했고, 반감기 날짜는 원장을 직접 조회했다. 주요 사건 중 일부가 나중에 작성된 자료로 확인된 경우도 사건일과 출처 게시일을 분리했다. 테라의 2022년 붕괴 대표일을 뒷받침하는 SEC 배상계획은 2026년 8월 자료이지만, 사건 자체를 2026년 사건으로 넣지 않았다.

`publishedAt: null`은 게시일이 없는 원장 조회 화면 또는 게시일을 확인하지 못한 지속 갱신 사건 관리 페이지다. 검토일을 발표일로 채우지 않는다. 모든 출처의 `accessedAt`은 2026-10-22다. 원문은 수정·이전·차단될 수 있고 링크가 영구히 유지된다는 보장은 없다.

## 차트 연동 계약

`BITCOIN_EVENTS`는 날짜순으로 정렬되고 중첩 출처·한계 배열까지 동결된다. `getVisibleBitcoinEvents({ startDate, endDate, minImportance, categories, limit })`는 외부 통신 없는 순수 함수이며 새 배열을 반환한다. 날짜 입력은 실제 달력에 존재하는 `YYYY-MM-DD` 문자열만 허용한다. 양끝을 포함하고, 기본 끝 날짜는 검토 기준일이다. `categories`는 배열 또는 Set, `minImportance`는 1·2·3, `limit`은 0 이상의 안전한 정수다. 잘못된 날짜·역전된 범위·모르는 분류는 명시적으로 예외를 반환한다.

표시 수를 제한하면 중요도가 높은 사건부터 고르고 같은 중요도에서는 앞선 날짜·ID 순으로 선택한 다음, 결과를 다시 날짜순으로 반환한다. 화면 픽셀 간 충돌 회피는 렌더러의 책임이다. 이 함수는 뉴스의 실제 인기도를 추정하거나 가격에 맞춰 사건의 위치·내용을 바꾸지 않는다. 2009년 제네시스·2010년 피자 거래처럼 가격 시계열 이전의 사건은 전체 사건 목록에서 보존한다. 그 날짜의 가격이나 거래량을 만들어 차트에 붙이지 않는다.

## 사건 요약

| 차트 날짜 | 짧은 라벨 | 분류 | 표시 우선순위 |
|---|---|---|---:|
| 2009-01-03 | 제네시스 블록 | 프로토콜 | 3 |
| 2010-05-22 | 피자 거래 | 결제·국가 채택 | 3 |
| 2012-11-28 | 1차 반감기 | 프로토콜 | 3 |
| 2013-03-18 | FinCEN 지침 | 규제·제도 | 2 |
| 2013-10-02 | 실크로드 폐쇄 | 보안·법집행 | 3 |
| 2013-12-05 | 중국 금융기관 규제 | 규제·제도 | 3 |
| 2014-02-28 | 마운트곡스 회생 신청 | 시장·거래소 | 3 |
| 2014-03-25 | 미국 세금 지침 | 규제·제도 | 1 |
| 2016-07-09 | 2차 반감기 | 프로토콜 | 3 |
| 2016-08-02 | 비트파이넥스 해킹 | 보안·법집행 | 2 |
| 2017-03-10 | 현물 ETP 불승인 | 규제·제도 | 2 |
| 2017-08-01 | 비트코인 캐시 분기 | 프로토콜 | 2 |
| 2017-08-24 | SegWit 활성화 | 프로토콜 | 2 |
| 2017-12-18 | CME 선물 첫 거래일 | 기업·금융상품 | 3 |
| 2018-03-15 | 라이트닝 베타 | 프로토콜 | 1 |
| 2020-03-11 | 코로나19 팬데믹 | 거시경제 | 3 |
| 2020-05-11 | 3차 반감기 | 프로토콜 | 3 |
| 2020-08-11 | 기업 재무자산 채택 | 기업·금융상품 | 3 |
| 2020-10-21 | 페이팔 서비스 발표 | 결제·국가 채택 | 2 |
| 2021-02-08 | 테슬라 BTC 공시 | 기업·금융상품 | 3 |
| 2021-04-14 | 코인베이스 직상장 | 기업·금융상품 | 2 |
| 2021-09-07 | 엘살바도르 법 시행 | 결제·국가 채택 | 3 |
| 2021-09-24 | 중국 거래·채굴 규제 | 규제·제도 | 3 |
| 2021-10-19 | 미국 BTC 선물 ETF | 기업·금융상품 | 2 |
| 2021-11-14 | 탭루트 활성화 | 프로토콜 | 2 |
| 2022-02-08 | 도난 BTC 압수 발표 | 보안·법집행 | 1 |
| 2022-05-09 | 테라·UST 붕괴 | 시장·거래소 | 3 |
| 2022-07-13 | 셀시어스 회생 신청 | 시장·거래소 | 2 |
| 2022-11-11 | FTX 회생 신청 | 시장·거래소 | 3 |
| 2023-06-15 | 블랙록 현물 ETF 신청 | 기업·금융상품 | 2 |
| 2023-08-29 | 그레이스케일 판결 | 규제·제도 | 2 |
| 2024-01-10 | 미국 현물 ETF 승인 | 규제·제도 | 3 |
| 2024-01-11 | 현물 ETF 거래 시작 | 기업·금융상품 | 2 |
| 2024-04-20 | 4차 반감기 | 프로토콜 | 3 |
| 2024-07-05 | 마운트곡스 상환 시작 | 시장·거래소 | 2 |
| 2024-07-12 | 독일 압수 BTC 매각 | 시장·거래소 | 2 |
| 2025-01-23 | SEC 수탁 회계지침 | 규제·제도 | 1 |
| 2025-01-29 | 엘살바도르 법 개정 | 규제·제도 | 2 |
| 2025-03-06 | 미국 BTC 준비자산 | 규제·제도 | 3 |

## 사건별 원문·발표일·근거 한계

### 2009-01-03 · 비트코인 제네시스 블록

ID: `genesis-2009` · 분류: 프로토콜 · 편집 표시 우선순위: 3

비트코인 원장의 첫 블록인 높이 0의 제네시스 블록이 기록됐다. 시장에서 거래되는 BTC 가격의 시작일과는 다르다.

**날짜 기준:** 블록 0의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 0](https://blockstream.info/block/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |

### 2010-05-22 · 1만 BTC 피자 거래 성사

ID: `pizza-2010` · 분류: 결제·국가 채택 · 편집 표시 우선순위: 3

laszlo가 비트코인 포럼에 1만 BTC로 피자를 받았다고 후속 글을 남겼다. 초기 실물 상품 거래를 보여 주는 대표적인 기록이다.

**날짜 기준:** 5월 18일의 제안 글이 아니라 거래 성사를 알린 5월 22일 답글 #11의 날짜다.

**근거 한계:** 당사자의 공개 게시글을 근거로 한다. 모든 초기 거래를 조사해 최초성을 입증한 자료는 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin Forum / laszlo | 2010-05-22 | 1차 기록·공식 자료 | [Pizza for bitcoins? — reply #11](https://bitcointalk.org/index.php?topic=137.0) |

### 2012-11-28 · 첫 번째 블록 보조금 반감기

ID: `halving-2012` · 분류: 프로토콜 · 편집 표시 우선순위: 3

높이 210,000에서 블록당 신규 발행 보조금이 50 BTC에서 25 BTC로 줄었다. 거래 수수료는 이 보조금과 별도다.

**날짜 기준:** 블록 210,000의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 210000](https://blockstream.info/block/000000000000048b95347e83192f69cf0366076336c639f9b7228e9ba171342e) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: GetBlockSubsidy](https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp) |

### 2013-03-18 · 미국 가상통화 사업자 규제 지침

ID: `fincen-guidance-2013` · 분류: 규제·제도 · 편집 표시 우선순위: 2

미국 FinCEN이 전환 가능한 가상통화의 이용자·관리자·교환업자에 대한 자금세탁방지 규정 적용 지침을 발표했다. 일부 사업자는 송금업자 요건의 적용 대상이 됐다.

**날짜 기준:** FinCEN 보도자료와 FIN-2013-G001의 발표일이다.

**근거 한계:** 일반 이용자 전부를 송금업자로 규정한 것이 아니다. 당시 미국 규정의 적용 범위를 설명하는 역사 기록이다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| FinCEN | 2013-03-18 | 1차 기록·공식 자료 | [Guidance on Virtual Currencies and Regulatory Responsibilities](https://www.fincen.gov/news/news-releases/fincen-issues-guidance-virtual-currencies-and-regulatory-responsibilities) |
| FinCEN | 2013-03-18 | 1차 기록·공식 자료 | [FIN-2013-G001](https://www.fincen.gov/system/files/shared/FIN-2013-G001.pdf) |

### 2013-10-02 · 미국 당국의 실크로드 사이트 폐쇄

ID: `silk-road-2013` · 분류: 보안·법집행 · 편집 표시 우선순위: 3

미국 당국이 비트코인을 결제에 사용하던 불법 온라인 시장 실크로드를 폐쇄했다. 비트코인 네트워크 자체가 폐쇄된 사건은 아니다.

**날짜 기준:** 사이트 폐쇄가 공개된 10월 2일을 사용한다. 운영자 체포일인 10월 1일과 구분한다.

**근거 한계:** 2015년 수사기관의 회고 자료와 사건 당일 보도를 교차 확인했다. 이 사건 하나로 비트코인 이용 전체의 성격을 일반화하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| DEA / U.S. Attorney | 2015-12-04 | 1차 기록·공식 자료 | [Charges against a senior adviser to the Silk Road operator](https://www.dea.gov/press-releases/2015/12/04/manhattan-us-attorney-announces-arrest-and-unsealing-charges-against) |
| Reuters / Yahoo Finance | 2013-10-02 | 독립 보도·후속 분석 | [FBI raids alleged online drug market Silk Road](https://finance.yahoo.com/news/fbi-raids-alleged-online-drug-market-silk-road-153834149.html) |

### 2013-12-05 · 중국의 금융기관 비트코인 취급 제한

ID: `china-finance-2013` · 분류: 규제·제도 · 편집 표시 우선순위: 3

중국 인민은행 등 5개 부처가 비트코인의 위험에 관한 통지를 발표하고 금융기관·결제기관의 관련 업무를 제한했다.

**날짜 기준:** 공동 통지의 대외 발표일이다.

**근거 한계:** 금융기관과 결제기관 대상 조치를 개인의 단순 보유 전면 금지로 바꾸어 표현하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| 중국 인민은행 등 / 12371 공식 전재 | 2013-12-05 | 1차 기록·공식 자료 | [关于防范比特币风险的通知](https://news.12371.cn/2013/12/05/ARTI1386241285532745.shtml) |
| Caixin | 2013-12-05 | 독립 보도·후속 분석 | [五部委发布防范比特币风险通知](https://finance.caixin.com/2013-12-05/100620029.html) |

### 2014-02-28 · 마운트곡스의 일본 민사재생 신청

ID: `mtgox-filing-2014` · 분류: 시장·거래소 · 편집 표시 우선순위: 3

마운트곡스가 도쿄지방법원에 민사재생 절차 개시를 신청했다고 발표했다. 고객 자산 손실과 거래소 운영 중단이 드러난 시기의 주요 절차다.

**날짜 기준:** 당일 회사 공지에 기재된 신청일이다. 해킹 발생일이나 이후 파산절차 개시일로 사용하지 않는다.

**근거 한계:** 당시 회사가 제시한 손실 원인과 손실 규모는 초기 주장이다. 이를 확정된 기술적 원인으로 재사용하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| MtGox | 2014-02-28 | 1차 기록·공식 자료 | [Application for commencement of civil rehabilitation](https://www.mtgox.com/img/pdf/20140228-announcement_eng.pdf) |
| Reuters / Yahoo Finance | 2014-02-28 | 독립 보도·후속 분석 | [Mt. Gox files for bankruptcy protection](https://finance.yahoo.com/news/mt-gox-files-bankruptcy-protection-094811743.html) |

### 2014-03-25 · IRS의 가상통화 재산 취급 지침

ID: `irs-property-2014` · 분류: 규제·제도 · 편집 표시 우선순위: 1

미국 IRS가 Notice 2014-21을 통해 연방 세금 목적상 비트코인 등 전환 가능한 가상통화를 재산으로 취급하는 원칙을 제시했다.

**날짜 기준:** 지침이 공개된 날짜다. 4월 14일 Internal Revenue Bulletin 수록일과 구분한다.

**근거 한계:** 미국 연방 세금 목적의 분류다. 모든 국가의 법적 지위나 현재 세법 전체를 설명하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| IRS | 2014-03-25 | 1차 기록·공식 자료 | [Notice 2014-21](https://www.irs.gov/pub/irs-drop/n-14-21.pdf) |
| TIME | 2014-03-25 | 독립 보도·후속 분석 | [IRS says bitcoin is property, not currency](https://time.com/37428/bitcoin-irs-property-virtual-currency/) |

### 2016-07-09 · 두 번째 블록 보조금 반감기

ID: `halving-2016` · 분류: 프로토콜 · 편집 표시 우선순위: 3

높이 420,000에서 블록당 신규 발행 보조금이 25 BTC에서 12.5 BTC로 줄었다.

**날짜 기준:** 블록 420,000의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 420000](https://blockstream.info/block/000000000000000002cce816c0ab2c5c269cb081896b7dcb34b8422d6b74ffa1) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: GetBlockSubsidy](https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp) |

### 2016-08-02 · 비트파이넥스 고객 BTC 도난

ID: `bitfinex-hack-2016` · 분류: 보안·법집행 · 편집 표시 우선순위: 2

비트파이넥스 거래소가 보안 침해로 거래를 중단했고 고객 BTC 도난이 공개됐다. 이후 수사와 회수 절차로 이어졌다.

**날짜 기준:** 거래소의 회고 FAQ가 명시한 침해 발생일과 당일 보도를 확인했다.

**근거 한계:** 거래소 보관 자산의 침해 사건이다. 비트코인 합의 규칙이 해킹된 사건으로 표현하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitfinex | 2022-02-08 | 1차 기록·공식 자료 | [2016 Security Breach Bitcoin Recovery FAQ](https://support.bitfinex.com/hc/en-us/articles/4417401349657-2016-Security-Breach-Bitcoin-Recovery-Frequently-Asked-Questions-FAQ) |
| CoinDesk | 2016-08-02 | 독립 보도·후속 분석 | [Bitfinex offline as customer bitcoin reported stolen](https://www.coindesk.com/markets/2016/08/02/bitfinex-offline-as-customer-bitcoin-reported-stolen) |

### 2017-03-10 · SEC의 윙클보스 비트코인 신탁 상장안 불승인

ID: `winklevoss-etp-denial-2017` · 분류: 규제·제도 · 편집 표시 우선순위: 2

미국 SEC가 Winklevoss Bitcoin Trust를 상장하기 위한 거래소 규칙 변경안을 승인하지 않았다. 당시 시장 감시와 조작 방지 요건이 주요 쟁점이었다.

**날짜 기준:** SEC 명령 34-80206의 날짜다.

**근거 한계:** 특정 상장안에 관한 결정이다. 모든 비트코인 투자나 이후의 모든 ETP를 금지한 결정이 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| SEC | 2017-03-10 | 1차 기록·공식 자료 | [Order 34-80206: Winklevoss Bitcoin Trust](https://www.sec.gov/files/rules/sro/batsbzx/2017/34-80206.pdf) |

### 2017-08-01 · 비트코인 캐시의 체인 분기

ID: `bitcoin-cash-fork-2017` · 분류: 프로토콜 · 편집 표시 우선순위: 2

비트코인과 다른 규칙을 채택한 비트코인 캐시(BCH) 체인이 분기했다. BTC와 BCH는 이후 서로 다른 네트워크와 자산으로 존재한다.

**날짜 기준:** Coinbase의 지원 공지가 회고한 분기 날짜와 당시 보도를 확인했다.

**근거 한계:** 지원 공지의 발표일인 12월 19일과 분기일을 구분한다. BTC가 BCH로 이름을 바꾼 사건이 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Coinbase | 2017-12-19 | 1차 기록·공식 자료 | [Buy, sell, send and receive Bitcoin Cash on Coinbase](https://www.coinbase.com/blog/buy-sell-send-and-receive-bitcoin-cash-on-coinbase) |
| WIRED | 2017-08-01 | 독립 보도·후속 분석 | [Bitcoin is splitting in two. Now what?](https://www.wired.com/story/bitcoin-is-splitting-in-two-now-what) |

### 2017-08-24 · 세그윗 합의 규칙 활성화

ID: `segwit-2017` · 분류: 프로토콜 · 편집 표시 우선순위: 2

높이 481,824에서 세그윗(Segregated Witness) 규칙이 활성화됐다. 거래의 서명 데이터를 분리하는 프로토콜 변경이다.

**날짜 기준:** 블록 481,824의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 481824](https://blockstream.info/block/0000000000000000001c8018d9cb3b742ef25114f27563e3fc4a1902167f9893) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2016-10-27 | 1차 기록·공식 자료 | [Segregated Witness upgrade guide](https://bitcoincore.org/en/2016/10/27/segwit-upgrade-guide/) |

### 2017-12-18 · CME 비트코인 선물의 첫 거래일

ID: `cme-futures-2017` · 분류: 기업·금융상품 · 편집 표시 우선순위: 3

CME의 현금 결제형 비트코인 선물이 첫 거래일을 맞았다. 비트코인을 직접 보관하는 현물 상품과 구조가 다르다.

**날짜 기준:** CME가 정한 거래일 12월 18일이다. 실제 야간 세션은 미국 시간 12월 17일에 시작됐다.

**근거 한계:** 출시 예고 보도자료와 실제 개장 이후 Reuters 보도를 함께 사용했다. 미국 최초의 모든 비트코인 선물이라는 주장은 하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| CME Group | 2017-12-01 | 1차 기록·공식 자료 | [Bitcoin futures to launch Dec. 18](https://www.cmegroup.com/media-room/press-releases/2017/12/01/cme_group_self-certifiesbitcoinfuturestolaunchdec18.html) |
| Reuters | 2017-12-18 | 독립 보도·후속 분석 | [CME bitcoin futures get tepid take-up in debut](https://www.reuters.com/article/world/exchange-giant-cmes-bitcoin-futures-get-tepid-take-up-in-debut-idUSKBN1EB04K/) |

### 2018-03-15 · lnd의 메인넷 베타 공개

ID: `lightning-beta-2018` · 분류: 프로토콜 · 편집 표시 우선순위: 1

Lightning Labs가 비트코인 메인넷용 lnd 0.4-beta를 공개했다. 결제 채널을 이용하는 라이트닝 구현체 개발의 주요 이정표다.

**날짜 기준:** 개발사의 메인넷 베타 출시 공지 날짜다.

**근거 한계:** 개발자 대상 베타 공개다. 라이트닝의 최초 실험·최초 결제·모든 구현체의 완성일로 해석하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Lightning Labs | 2018-03-15 | 1차 기록·공식 자료 | [Lightning Labs announces lnd beta](https://lightning.engineering/posts/2018-03-15-lnd-beta/) |
| Forbes | 2018-03-15 | 독립 보도·후속 분석 | [Lightning Network goes live as startup raises $2.5 million](https://www.forbes.com/sites/ktorpey/2018/03/15/bitcoins-highly-anticipated-lightning-network-goes-live-as-startup-raises-2-5-million/) |

### 2020-03-11 · WHO의 코로나19 팬데믹 판단

ID: `who-pandemic-2020` · 분류: 거시경제 · 편집 표시 우선순위: 3

WHO가 코로나19를 팬데믹으로 특징지을 수 있다고 발표했다. 전 세계 자산시장의 급격한 변동을 이해하기 위한 거시경제 맥락이다.

**날짜 기준:** WHO 사무총장 언론 브리핑의 날짜다.

**근거 한계:** 비트코인에 특화된 사건이 아니다. 이후 BTC 가격 변동의 단독 원인으로 추정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| WHO | 2020-03-11 | 1차 기록·공식 자료 | [Director-General media briefing, 11 March 2020](https://www.who.int/news-room/speeches/item/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020) |
| TIME | 2020-03-11 | 독립 보도·후속 분석 | [WHO declares coronavirus a pandemic](https://time.com/5791661/who-coronavirus-pandemic-declaration/) |

### 2020-05-11 · 세 번째 블록 보조금 반감기

ID: `halving-2020` · 분류: 프로토콜 · 편집 표시 우선순위: 3

높이 630,000에서 블록당 신규 발행 보조금이 12.5 BTC에서 6.25 BTC로 줄었다.

**날짜 기준:** 블록 630,000의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 630000](https://blockstream.info/block/000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: GetBlockSubsidy](https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp) |

### 2020-08-11 · 마이크로스트래티지의 BTC 재무자산 매입 발표

ID: `microstrategy-treasury-2020` · 분류: 기업·금융상품 · 편집 표시 우선순위: 3

마이크로스트래티지가 수수료를 포함해 2억 5,000만 달러로 21,454 BTC를 매입하고 주요 재무준비자산으로 채택했다고 발표했다.

**날짜 기준:** SEC에 제출된 회사 보도자료의 발표일이다. 개별 매수 체결 시각은 아니다.

**근거 한계:** 당시 회사명과 당시 매입분을 기록한다. 이후 회사 보유량이나 현재 기업가치로 대체하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| MicroStrategy / SEC EDGAR | 2020-08-11 | 1차 기록·공식 자료 | [MicroStrategy adopts bitcoin as primary treasury reserve asset](https://www.sec.gov/Archives/edgar/data/1050446/000119312520215604/d921849dex991.htm) |

### 2020-10-21 · 페이팔의 암호자산 매매·보유 서비스 발표

ID: `paypal-2020` · 분류: 결제·국가 채택 · 편집 표시 우선순위: 2

페이팔이 미국 이용자에게 비트코인 등 암호자산의 매수·보유·매도 기능을 제공하는 계획을 발표했다.

**날짜 기준:** 최초 서비스 발표일이다. 전체 적격 미국 고객으로 확대됐다는 후속 공지 날짜 11월 12일과 구분한다.

**근거 한계:** 발표 당일 모든 가맹점이 BTC를 직접 수취하거나 모든 이용자에게 기능이 즉시 제공됐다는 뜻은 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| PayPal | 2020-10-21 | 1차 기록·공식 자료 | [New service enabling users to buy, hold and sell cryptocurrency](https://newsroom.paypal-corp.com/2020-10-21-PayPal-Launches-New-Service-Enabling-Users-to-Buy-Hold-and-Sell-Cryptocurrency) |
| Reuters | 2020-10-21 | 독립 보도·후속 분석 | [PayPal to open up network to cryptocurrencies](https://www.reuters.com/business/finance/paypal-open-up-network-cryptocurrencies-2020-10-21/) |

### 2021-02-08 · 테슬라의 15억 달러 BTC 보유 공시

ID: `tesla-disclosure-2021` · 분류: 기업·금융상품 · 편집 표시 우선순위: 3

테슬라가 연차보고서에서 2021년 1월에 비트코인 15억 달러를 매입했다고 밝혔다. 대형 상장사의 재무자산 선택이 공시된 사건이다.

**날짜 기준:** 10-K가 제출된 2월 8일이다. 실제 매입 기간은 보고서가 설명한 1월이다.

**근거 한계:** 공시일을 매입 체결일로 사용하지 않는다. 당시 보유액이 현재 보유액을 의미하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Tesla / SEC EDGAR | 2021-02-08 | 1차 기록·공식 자료 | [2020 Form 10-K](https://www.sec.gov/Archives/edgar/data/1318605/000156459021004599/tsla-10k_20201231.htm) |
| Axios | 2021-02-08 | 독립 보도·후속 분석 | [Tesla buys $1.5 billion in bitcoin](https://www.axios.com/2021/02/08/tesla-bitcoin) |

### 2021-04-14 · 코인베이스의 나스닥 직접 상장

ID: `coinbase-listing-2021` · 분류: 기업·금융상품 · 편집 표시 우선순위: 2

코인베이스의 클래스 A 주식이 나스닥에서 직접 상장 방식으로 거래를 시작했다. 암호자산 거래소 운영기업의 주식 상장이다.

**날짜 기준:** 거래 개시 당일 보도와 회사 후속 10-Q의 완료일을 교차 확인했다.

**근거 한계:** BTC 자체가 나스닥에 상장된 사건이나 전통적인 공모 자금조달 방식의 IPO로 표현하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Coinbase / SEC EDGAR | 2022-05-10 | 1차 기록·공식 자료 | [Q1 2022 Form 10-Q: direct listing completed April 14, 2021](https://www.sec.gov/Archives/edgar/data/1679788/000167978822000048/coin-20220331.htm) |
| Reuters | 2021-04-14 | 독립 보도·후속 분석 | [Coinbase Nasdaq debut](https://www.reuters.com/technology/coinbase-heads-89-bln-valuation-nasdaq-debut-2021-04-14/) |

### 2021-09-07 · 엘살바도르 비트코인법 시행

ID: `el-salvador-adoption-2021` · 분류: 결제·국가 채택 · 편집 표시 우선순위: 3

엘살바도르에서 비트코인을 법정통화로 채택한 법이 시행됐다. 미국 달러를 폐지하거나 대체한 제도는 아니었다.

**날짜 기준:** 6월의 입법 발표일과 구분한 9월 7일 시행일이다.

**근거 한계:** 2021년 당시 법의 시행을 기록한다. 민간 수취 의무를 완화한 2025년 개정과 함께 읽어야 한다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| 엘살바도르 입법의회 | 2021-06-09 | 1차 기록·공식 자료 | [Ley Bitcoin 입법 발표](https://www.asamblea.gob.sv/node/11282) |
| Banco de España / Sergio Gorjón | 2021-10-07 | 독립 보도·후속 분석 | [The role of cryptoassets as legal tender: the example of El Salvador](https://www.bde.es/f/webbde/SES/Secciones/Publicaciones/InformesBoletinesRevistas/ArticulosAnaliticos/21/T4/Files/be2104-art35e.pdf) |

### 2021-09-24 · 중국의 암호자산 거래·채굴 규제 통지 공개

ID: `china-crypto-notices-2021` · 분류: 규제·제도 · 편집 표시 우선순위: 3

중국 당국이 암호자산 관련 거래 업무의 제한과 채굴 활동 정비에 관한 통지를 공개했다. 해외 거래소의 중국 내 서비스와 신규 채굴 프로젝트도 포함됐다.

**날짜 기준:** 두 통지의 웹 공개일 9월 24일이다. 문서 서명일은 거래 통지 9월 15일, 채굴 통지 9월 3일이다.

**근거 한계:** 서명·공개·지역별 집행 날짜는 같지 않다. 개인의 단순 보유를 일괄 범죄로 규정했다는 표현은 사용하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| 중국 인민은행 등 / SAFE | 2021-09-24 | 1차 기록·공식 자료 | [关于进一步防范和处置虚拟货币交易炒作风险的通知](https://www.safe.gov.cn/safe/2021/0924/19911.html) |
| 중국 국가발전개혁위원회 | 2021-09-24 | 1차 기록·공식 자료 | [关于整治虚拟货币“挖矿”活动的通知](https://www.ndrc.gov.cn/xxgk/zcfb/tz/202109/t20210924_1297474.html) |
| The Guardian | 2021-09-24 | 독립 보도·후속 분석 | [China declares cryptocurrency transactions illegal](https://www.theguardian.com/world/2021/sep/24/china-declares-transactions-cryptocurrencies-illegal) |

### 2021-10-19 · ProShares BITO의 거래 개시

ID: `bito-2021` · 분류: 기업·금융상품 · 편집 표시 우선순위: 2

미국에서 비트코인 선물에 투자하는 ProShares Bitcoin Strategy ETF(BITO)가 거래를 시작했다. 2024년 승인된 현물 보유 상품과 구조가 다르다.

**날짜 기준:** 시장 거래 개시일이다. 펀드 설정일 10월 18일과 구분한다.

**근거 한계:** 선물 기반 ETF를 현물 비트코인 ETF로 표시하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| ProShares | 2021-10-18 | 1차 기록·공식 자료 | [Bitcoin-linked ETF to launch on October 19](https://www.proshares.com/press-releases/proshares-to-launch-the-first-u.s.-bitcoin-linked-etf-on-october-19) |
| Reuters | 2021-10-19 | 독립 보도·후속 분석 | [Bitcoin futures ETF listing](https://www.reuters.com/technology/bitcoin-nears-record-high-ahead-futures-etf-listing-2021-10-19/) |

### 2021-11-14 · 탭루트 합의 규칙 활성화

ID: `taproot-2021` · 분류: 프로토콜 · 편집 표시 우선순위: 2

높이 709,632에서 탭루트 규칙이 활성화됐다. 슈노르 서명과 새로운 스크립트 지출 구조를 포함하는 소프트포크다.

**날짜 기준:** 블록 709,632의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 709632](https://blockstream.info/block/0000000000000000000687bca986194dc2c1f949318629b44bb54ec0a94d8244) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2021-05-01 | 1차 기록·공식 자료 | [Bitcoin Core 0.21.1 release notes: Taproot](https://bitcoincore.org/en/releases/0.21.1/) |

### 2022-02-08 · 미 법무부의 비트파이넥스 도난 자산 압수 발표

ID: `bitfinex-seizure-2022` · 분류: 보안·법집행 · 편집 표시 우선순위: 1

미 법무부가 2016년 비트파이넥스 해킹과 연결된 BTC 압수와 자금세탁 혐의 체포를 발표했다.

**날짜 기준:** 법무부 발표일이다. 2016년 해킹 발생일이나 이후 유죄 판단 날짜와 구분한다.

**근거 한계:** 해당 시점의 체포·혐의와 자산 압수 사실을 기록한다. 체포 발표 자체를 유죄 확정으로 표현하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| U.S. Department of Justice | 2022-02-08 | 1차 기록·공식 자료 | [Two arrested for alleged conspiracy to launder stolen cryptocurrency](https://www.justice.gov/archives/opa/pr/two-arrested-alleged-conspiracy-launder-45-billion-stolen-cryptocurrency) |
| TIME | 2022-02-10 | 독립 보도·후속 분석 | [Cryptocurrency laundering arrests and the Bitfinex hack](https://time.com/6146749/cryptocurrency-laundering-bitfinex-hack/) |

### 2022-05-09 · 테라 UST의 달러 연동 붕괴

ID: `terra-ust-2022` · 분류: 시장·거래소 · 편집 표시 우선순위: 3

테라의 알고리즘 스테이블코인 UST가 달러 연동을 잃는 과정이 본격화됐다. 테라·루나 생태계 붕괴는 여러 날에 걸쳐 진행됐다.

**날짜 기준:** SEC의 후속 배상계획이 UST 가치 하락일로 명시한 5월 9일을 대표 날짜로 사용한다.

**근거 한계:** 5월 초부터 이어진 연속 사건을 한 날짜로 압축했다. 비트코인 프로토콜이나 BTC 자체의 달러 페그가 붕괴한 사건은 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| SEC | 2026-08-20 | 1차 기록·공식 자료 | [Tai Mo Shan proposed distribution plan: relevant period and May 9 decline](https://www.sec.gov/files/litigation/admin/2026/34-106168-pdp.pdf) |
| SEC | 2023-02-16 | 1차 기록·공식 자료 | [Terraform and Do Kwon charged with orchestrating crypto securities fraud](https://www.sec.gov/newsroom/press-releases/2023-32) |

### 2022-07-13 · 셀시어스의 챕터 11 신청

ID: `celsius-filing-2022` · 분류: 시장·거래소 · 편집 표시 우선순위: 2

암호자산 대출업체 셀시어스와 일부 계열사가 미국 연방파산법 챕터 11에 따른 회생 절차를 신청했다.

**날짜 기준:** 버몬트 금융규제국과 채권자위원회 자료가 명시한 법원 신청일이다.

**근거 한계:** 6월의 인출 중단일과 구분한다. 거래소·대출업체의 채무 문제를 비트코인 네트워크의 지급불능으로 일반화하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Vermont Department of Financial Regulation | 2022-07-14 | 1차 기록·공식 자료 | [Celsius Network files Chapter 11 bankruptcy](https://dfr.vermont.gov/consumer-alert/celsius-network-files-chapter-11-bankruptcy) |
| Celsius creditors committee / Kroll | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Case information: petition date July 13, 2022](https://devcases.ra.kroll.com/CelsiusCommittee/Home-Index) |
| The Block | 2022-07-13 | 독립 보도·후속 분석 | [Celsius declares Chapter 11 bankruptcy in New York](https://www.theblock.co/news/regulation/2022-07-13-crypto-lender-celsius-declares-chapter-11-bankruptcy-in-new-york-157491) |

### 2022-11-11 · FTX의 챕터 11 신청

ID: `ftx-filing-2022` · 분류: 시장·거래소 · 편집 표시 우선순위: 3

FTX Trading과 다수 관계사가 미국에서 챕터 11 절차를 신청했다. 고객 자산과 거래소 운영에 대한 대규모 후속 조사가 이어졌다.

**날짜 기준:** FTX Trading 등 주요 채무자의 최초 신청일이다. 일부 관계사의 11월 14일 신청과 구분한다.

**근거 한계:** 신청일 당시의 절차를 표시한다. 이후 형사사건의 유죄 판결을 이 날짜에 소급하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| FTX bankruptcy estate / Kroll | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [FTX restructuring case information](https://restructuring.ra.kroll.com/ftx/) |
| Axios | 2022-11-14 | 독립 보도·후속 분석 | [What comes next after FTX bankruptcy filing](https://www.axios.com/2022/11/14/ftx-bankruptcy-filing-whats-next) |

### 2023-06-15 · iShares Bitcoin Trust 등록신고서 제출

ID: `blackrock-filing-2023` · 분류: 기업·금융상품 · 편집 표시 우선순위: 2

블랙록 계열 스폰서가 iShares Bitcoin Trust의 S-1 등록신고서를 SEC에 제출했다. 현물 BTC를 보유하는 상장상품을 추진한 신청 단계다.

**날짜 기준:** S-1 표지의 제출일 6월 15일이다. 파일명에 포함된 6월 8일은 신탁 설립일이다.

**근거 한계:** 신청은 승인이나 거래 개시가 아니다. 세 단계를 별도 사건으로 구분한다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| iShares / SEC EDGAR | 2023-06-15 | 1차 기록·공식 자료 | [iShares Bitcoin Trust Form S-1](https://www.sec.gov/Archives/edgar/data/1980994/000143774923017574/bit20230608_s1.htm) |
| Axios | 2023-06-15 | 독립 보도·후속 분석 | [BlackRock files for a spot bitcoin ETF](https://www.axios.com/2023/06/15/blackrock-bitcoin-spot-etf-application) |

### 2023-08-29 · 그레이스케일의 SEC 상대 항소심 판결

ID: `grayscale-court-2023` · 분류: 규제·제도 · 편집 표시 우선순위: 2

미국 연방항소법원이 그레이스케일의 현물 상품 전환 신청에 대한 SEC의 불승인 결정을 취소하고 재검토하도록 했다.

**날짜 기준:** 연방항소법원 판결일이다.

**근거 한계:** 법원이 ETF 거래를 직접 승인한 것으로 해석하지 않는다. 이후 SEC 승인 절차와 구분한다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| U.S. Court of Appeals / Justia 원문 전재 | 2023-08-29 | 1차 기록·공식 자료 | [Grayscale Investments v. SEC, No. 22-1142](https://law.justia.com/cases/federal/appellate-courts/cadc/22-1142/22-1142-2023-08-29.html) |
| Grayscale / SEC EDGAR | 2023-08-29 | 1차 기록·공식 자료 | [Grayscale prevails in lawsuit against the SEC](https://www.sec.gov/Archives/edgar/data/1588489/000095017023045100/gbtc-ex99_1.htm) |
| Associated Press | 2023-08-29 | 독립 보도·후속 분석 | [Court rules against SEC in Grayscale bitcoin fund case](https://apnews.com/article/d8a9bb4fb476527e803aed3dd19dc303) |

### 2024-01-10 · SEC의 현물 비트코인 ETP 상장 승인

ID: `us-spot-etp-approval-2024` · 분류: 규제·제도 · 편집 표시 우선순위: 3

미국 SEC가 여러 현물 비트코인 상장지수상품(ETP)의 상장·거래를 허용하는 거래소 규칙 변경안을 승인했다. 시장에서는 보통 현물 ETF로 부른다.

**날짜 기준:** SEC의 실제 승인일 1월 10일이다. 전날 침해된 SNS 계정의 허위 게시물과 구분한다.

**근거 한계:** 상장 승인은 비트코인의 투자 가치나 안전성에 대한 SEC의 보증이 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| SEC | 2024-01-10 | 1차 기록·공식 자료 | [Statement on approval of spot bitcoin exchange-traded products](https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023) |
| SEC / Federal Register | 2024-01-17 | 1차 기록·공식 자료 | [Approval order dated January 10, 2024](https://www.govinfo.gov/content/pkg/FR-2024-01-17/html/2024-00743.htm) |

### 2024-01-11 · IBIT 등 미국 현물 비트코인 ETF 거래 개시

ID: `us-spot-etp-trading-2024` · 분류: 기업·금융상품 · 편집 표시 우선순위: 2

IBIT 등 미국 현물 비트코인 상장상품의 주식 거래가 시작됐다. 전날의 규제 승인과 실제 시장 거래 개시를 구분하는 사건이다.

**날짜 기준:** BlackRock의 당일 개장 발표와 AP 보도를 확인했다.

**근거 한계:** 승인 대상 11개 상품 전부가 이날 동일한 상태로 거래를 시작했다고 일반화하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| BlackRock / Business Wire | 2024-01-11 | 1차 기록·공식 자료 | [BlackRock’s IBIT debuts on Nasdaq](https://www.businesswire.com/news/home/20240111007753/en/BlackRocks-IBIT-Debuts-on-Nasdaq) |
| Associated Press | 2024-01-11 | 독립 보도·후속 분석 | [New bitcoin ETFs begin trading](https://apnews.com/article/61b78e50f27fac0e188999f547c22b1e) |

### 2024-04-20 · 네 번째 블록 보조금 반감기

ID: `halving-2024` · 분류: 프로토콜 · 편집 표시 우선순위: 3

높이 840,000에서 블록당 신규 발행 보조금이 6.25 BTC에서 3.125 BTC로 줄었다.

**날짜 기준:** 블록 840,000의 헤더 시각을 UTC 날짜로 표시한다.

**근거 한계:** 블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다. 프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Bitcoin blockchain / Blockstream | 게시일 없음 / 확인 불가 | 1차 기록·공식 자료 | [Block 840000](https://blockstream.info/block/0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: mainnet consensus parameters](https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp) |
| Bitcoin Core | 2025-04-14 | 1차 기록·공식 자료 | [v29.0: GetBlockSubsidy](https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp) |

### 2024-07-05 · 마운트곡스의 BTC·BCH 상환 개시

ID: `mtgox-repayments-2024` · 분류: 시장·거래소 · 편집 표시 우선순위: 2

마운트곡스 재생관재인이 지정 거래소를 통해 일부 재생채권자에게 BTC와 BCH를 상환했다고 공지했다.

**날짜 기준:** 관재인의 상환 공지 날짜이며 공지는 같은 날 실시한 상환을 명시한다.

**근거 한계:** 일부 채권자의 상환 시작이다. 모든 채권자에게 상환이 완료됐거나 수령자가 즉시 매도했다는 뜻은 아니다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| MtGox rehabilitation trustee | 2024-07-05 | 1차 기록·공식 자료 | [Repayments in Bitcoin and Bitcoin Cash](https://www.mtgox.com/img/pdf/20240705_01_announcement_en.pdf) |

### 2024-07-12 · 독일 작센 당국의 압수 BTC 매각 완료

ID: `saxony-sale-2024` · 분류: 시장·거래소 · 편집 표시 우선순위: 2

독일 작센 당국이 형사사건에서 확보한 49,858 BTC의 긴급 매각을 마쳤다. 공식 발표에 따르면 매각 기간은 6월 19일부터 7월 12일까지였다.

**날짜 기준:** 7월 16일 검찰 보도자료가 명시한 매각 완료일 7월 12일이다.

**근거 한계:** 독일 연방정부의 모든 BTC 보유분을 뜻하지 않는다. 매각이 특정 가격 하락을 단독으로 일으켰다고 추정하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| Generalstaatsanwaltschaft Dresden | 2024-07-16 | 1차 기록·공식 자료 | [Notveräußerung von Bitcoins abgeschlossen](https://www.justiz.sachsen.de/gensta/download/Medieninformation_16072024.pdf) |
| MDR | 2024-07-16 | 독립 보도·후속 분석 | [Sachsen verkauft sichergestellte Bitcoins](https://www.mdr.de/nachrichten/sachsen/bitcoins-verkauf-geld-kryptowaehrung-strafverfahren-104.html) |

### 2025-01-23 · SEC 직원 회계지침 SAB 122 발표

ID: `sab-122-2025` · 분류: 규제·제도 · 편집 표시 우선순위: 1

SEC가 SAB 122를 발표해 암호자산 수탁 의무의 회계 처리에 관한 기존 SAB 121 지침을 철회했다.

**날짜 기준:** 발표일 1월 23일이다. 문서에 적힌 효력 발생일 1월 30일과 구분한다.

**근거 한계:** 직원 회계지침의 변경이다. 모든 금융기관에 모든 암호자산 업무를 일괄 허가한 법률로 표현하지 않는다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| SEC | 2025-01-23 | 1차 기록·공식 자료 | [Staff Accounting Bulletin No. 122](https://www.sec.gov/rules-regulations/staff-guidance/staff-accounting-bulletins/staff-accounting-bulletin-122) |
| Reuters | 2025-01-24 | 독립 보도·후속 분석 | [Wall Street regulator revokes accounting guidance on crypto assets](https://www.reuters.com/technology/wall-street-regulator-revokes-accounting-guidance-crypto-assets-2025-01-24/) |

### 2025-01-29 · 엘살바도르의 민간 BTC 수취 의무 완화 의결

ID: `el-salvador-reform-2025` · 분류: 규제·제도 · 편집 표시 우선순위: 2

엘살바도르 의회가 민간의 비트코인 수취를 자발적 선택으로 바꾸는 법 개정안을 의결했다. IMF도 후속 프로그램 발표에서 해당 개혁을 확인했다.

**날짜 기준:** Reuters가 보도한 현지 의회 의결일 1월 29일이다. UTC 기사 게시일은 1월 30일이며 법의 시행일과도 구분한다.

**근거 한계:** 보도마다 법정통화라는 표현의 해석이 달라, 실제로 바뀐 수취 의무에 한정해 기술한다. 의회 원문 PDF는 검색으로 확인했으나 직접 재조회가 실패했다. 의결일은 Reuters, 변경 내용은 IMF 발표로 교차 확인한다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| IMF | 2025-02-26 | 1차 기록·공식 자료 | [New 40-month Extended Fund Facility arrangement for El Salvador](https://www.imf.org/en/news/articles/2025/02/26/pr25043-el-salvador-imf-approves-new-40-month-us1-bn-eff-arr) |
| Reuters | 2025-01-30 | 독립 보도·후속 분석 | [Lawmakers in El Salvador rush new bitcoin reform after IMF deal](https://www.reuters.com/world/americas/lawmakers-el-salvador-rush-new-bitcoin-reform-after-imf-deal-2025-01-30/) |

### 2025-03-06 · 미국 전략적 비트코인 준비자산 행정명령

ID: `us-bitcoin-reserve-2025` · 분류: 규제·제도 · 편집 표시 우선순위: 3

미국 대통령이 전략적 비트코인 준비자산을 수립하는 행정명령에 서명했다. 초기 구성은 적법하게 몰수된 정부 보유 BTC를 바탕으로 하도록 했다.

**날짜 기준:** 백악관이 명시한 행정명령 서명일 3월 6일이다. 다음 날 UTC 보도 날짜와 구분한다.

**근거 한계:** 행정명령 수립을 신규 시장 매수가 이미 집행됐다는 사실로 바꾸지 않는다. 비트코인 준비자산과 다른 디지털 자산 비축 제도는 구별한다.

| 발행자 | 발표·게시일 | 자료 성격 | 확인 자료 |
|---|---|---|---|
| The White House | 2025-03-06 | 1차 기록·공식 자료 | [Establishment of the Strategic Bitcoin Reserve and United States Digital Asset Stockpile](https://www.whitehouse.gov/presidential-actions/2025/03/establishment-of-the-strategic-bitcoin-reserve-and-united-states-digital-asset-stockpile/) |
| Reuters | 2025-03-07 | 독립 보도·후속 분석 | [Trump signs order to establish strategic bitcoin reserve](https://www.reuters.com/technology/trump-signs-order-establish-strategic-bitcoin-reserve-white-house-crypto-czar-2025-03-07/) |

## 실행 검증

`node --test --test-isolation=none --test-reporter=tap tests/bitcoin-events.test.mjs`로 9개 테스트를 실제 실행했다. 출처·날짜·중복 ID·검토일 상한·7개 블록 타임스탬프, 공시와 거래 개시의 날짜 구분, 양끝 포함 필터, 미래 예측 영역에서 역사 사건이 생성되지 않는 조건, 분류와 중요도 조합, 표시 수 제한 후 순서, 잘못된 입력, 중첩 객체의 불변성을 검증한다.

이 검증은 데이터 계약과 회귀 방지에 대한 것이다. 39개 사건의 정치적·경제적 의미에 대한 완전한 학술 검증이나 모든 링크의 영구 가용성을 보증하지 않는다. 이벤트의 화면 배치·클릭·모바일 겹침은 별도의 렌더러 통합 검증 대상이다.
