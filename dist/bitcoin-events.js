/**
 * Curated historical context, not a popularity ranking or a causal price model.
 * date is a source calendar-day label; only timestampUtc records an exact UTC
 * block timestamp. See docs/BITCOIN_EVENTS_RESEARCH.md for the selection rules.
 */
export const BITCOIN_EVENTS_REVIEW_DATE = '2026-10-22';

export const BITCOIN_EVENT_CATEGORIES = Object.freeze({
  protocol: '프로토콜',
  regulation: '규제·제도',
  adoption: '결제·국가 채택',
  institution: '기업·금융상품',
  security: '보안·법집행',
  market: '시장·거래소',
  macro: '거시경제',
});

const source = (publisher, title, url, publishedAt = null, type = 'primary') => ({
  publisher, title, url, publishedAt, type, accessedAt: BITCOIN_EVENTS_REVIEW_DATE,
});

const consensusSource = source('Bitcoin Core', 'v29.0: mainnet consensus parameters',
  'https://github.com/bitcoin/bitcoin/blob/v29.0/src/kernel/chainparams.cpp', '2025-04-14');
const subsidySource = source('Bitcoin Core', 'v29.0: GetBlockSubsidy',
  'https://github.com/bitcoin/bitcoin/blob/v29.0/src/validation.cpp', '2025-04-14');

function blockEvent({ id, date, label, title, description, importance = 3, height, hash, timestampUtc, sources = [] }) {
  return {
    id, date, label, title, description, category: 'protocol', importance,
    datePrecision: 'block-timestamp', timestampUtc, blockHeight: height, blockHash: hash,
    dateBasis: `블록 ${height.toLocaleString('en-US')}의 헤더 시각을 UTC 날짜로 표시한다.`,
    limitations: ['블록 헤더 시각은 채굴자가 기록한 값이다. 전 세계 노드의 최초 수신 시각을 측정한 값은 아니다.', '프로토콜 변경 사실은 이후 가격의 방향이나 변동폭을 결정하지 않는다.'],
    sources: [
      source('Bitcoin blockchain / Blockstream', `Block ${height}`, `https://blockstream.info/block/${hash}`),
      consensusSource,
      ...sources,
    ],
  };
}

const events = [
  blockEvent({
    id: 'genesis-2009', date: '2009-01-03', label: '제네시스 블록', title: '비트코인 제네시스 블록',
    description: '비트코인 원장의 첫 블록인 높이 0의 제네시스 블록이 기록됐다. 시장에서 거래되는 BTC 가격의 시작일과는 다르다.',
    height: 0, hash: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', timestampUtc: '2009-01-03T18:15:05Z',
  }),
  {
    id: 'pizza-2010', date: '2010-05-22', label: '피자 거래', title: '1만 BTC 피자 거래 성사', category: 'adoption', importance: 3,
    description: 'laszlo가 비트코인 포럼에 1만 BTC로 피자를 받았다고 후속 글을 남겼다. 초기 실물 상품 거래를 보여 주는 대표적인 기록이다.',
    dateBasis: '5월 18일의 제안 글이 아니라 거래 성사를 알린 5월 22일 답글 #11의 날짜다.',
    limitations: ['당사자의 공개 게시글을 근거로 한다. 모든 초기 거래를 조사해 최초성을 입증한 자료는 아니다.'],
    sources: [source('Bitcoin Forum / laszlo', 'Pizza for bitcoins? — reply #11', 'https://bitcointalk.org/index.php?topic=137.0', '2010-05-22')],
  },
  blockEvent({
    id: 'halving-2012', date: '2012-11-28', label: '1차 반감기', title: '첫 번째 블록 보조금 반감기',
    description: '높이 210,000에서 블록당 신규 발행 보조금이 50 BTC에서 25 BTC로 줄었다. 거래 수수료는 이 보조금과 별도다.',
    height: 210000, hash: '000000000000048b95347e83192f69cf0366076336c639f9b7228e9ba171342e', timestampUtc: '2012-11-28T15:24:38Z', sources: [subsidySource],
  }),
  {
    id: 'fincen-guidance-2013', date: '2013-03-18', label: 'FinCEN 지침', title: '미국 가상통화 사업자 규제 지침', category: 'regulation', importance: 2,
    description: '미국 FinCEN이 전환 가능한 가상통화의 이용자·관리자·교환업자에 대한 자금세탁방지 규정 적용 지침을 발표했다. 일부 사업자는 송금업자 요건의 적용 대상이 됐다.',
    dateBasis: 'FinCEN 보도자료와 FIN-2013-G001의 발표일이다.',
    limitations: ['일반 이용자 전부를 송금업자로 규정한 것이 아니다. 당시 미국 규정의 적용 범위를 설명하는 역사 기록이다.'],
    sources: [
      source('FinCEN', 'Guidance on Virtual Currencies and Regulatory Responsibilities', 'https://www.fincen.gov/news/news-releases/fincen-issues-guidance-virtual-currencies-and-regulatory-responsibilities', '2013-03-18'),
      source('FinCEN', 'FIN-2013-G001', 'https://www.fincen.gov/system/files/shared/FIN-2013-G001.pdf', '2013-03-18'),
    ],
  },
  {
    id: 'silk-road-2013', date: '2013-10-02', label: '실크로드 폐쇄', title: '미국 당국의 실크로드 사이트 폐쇄', category: 'security', importance: 3,
    description: '미국 당국이 비트코인을 결제에 사용하던 불법 온라인 시장 실크로드를 폐쇄했다. 비트코인 네트워크 자체가 폐쇄된 사건은 아니다.',
    dateBasis: '사이트 폐쇄가 공개된 10월 2일을 사용한다. 운영자 체포일인 10월 1일과 구분한다.',
    limitations: ['2015년 수사기관의 회고 자료와 사건 당일 보도를 교차 확인했다. 이 사건 하나로 비트코인 이용 전체의 성격을 일반화하지 않는다.'],
    sources: [
      source('DEA / U.S. Attorney', 'Charges against a senior adviser to the Silk Road operator', 'https://www.dea.gov/press-releases/2015/12/04/manhattan-us-attorney-announces-arrest-and-unsealing-charges-against', '2015-12-04'),
      source('Reuters / Yahoo Finance', 'FBI raids alleged online drug market Silk Road', 'https://finance.yahoo.com/news/fbi-raids-alleged-online-drug-market-silk-road-153834149.html', '2013-10-02', 'secondary'),
    ],
  },
  {
    id: 'china-finance-2013', date: '2013-12-05', label: '중국 금융기관 규제', title: '중국의 금융기관 비트코인 취급 제한', category: 'regulation', importance: 3,
    description: '중국 인민은행 등 5개 부처가 비트코인의 위험에 관한 통지를 발표하고 금융기관·결제기관의 관련 업무를 제한했다.',
    dateBasis: '공동 통지의 대외 발표일이다.',
    limitations: ['금융기관과 결제기관 대상 조치를 개인의 단순 보유 전면 금지로 바꾸어 표현하지 않는다.'],
    sources: [
      source('중국 인민은행 등 / 12371 공식 전재', '关于防范比特币风险的通知', 'https://news.12371.cn/2013/12/05/ARTI1386241285532745.shtml', '2013-12-05'),
      source('Caixin', '五部委发布防范比特币风险通知', 'https://finance.caixin.com/2013-12-05/100620029.html', '2013-12-05', 'secondary'),
    ],
  },
  {
    id: 'mtgox-filing-2014', date: '2014-02-28', label: '마운트곡스 회생 신청', title: '마운트곡스의 일본 민사재생 신청', category: 'market', importance: 3,
    description: '마운트곡스가 도쿄지방법원에 민사재생 절차 개시를 신청했다고 발표했다. 고객 자산 손실과 거래소 운영 중단이 드러난 시기의 주요 절차다.',
    dateBasis: '당일 회사 공지에 기재된 신청일이다. 해킹 발생일이나 이후 파산절차 개시일로 사용하지 않는다.',
    limitations: ['당시 회사가 제시한 손실 원인과 손실 규모는 초기 주장이다. 이를 확정된 기술적 원인으로 재사용하지 않는다.'],
    sources: [
      source('MtGox', 'Application for commencement of civil rehabilitation', 'https://www.mtgox.com/img/pdf/20140228-announcement_eng.pdf', '2014-02-28'),
      source('Reuters / Yahoo Finance', 'Mt. Gox files for bankruptcy protection', 'https://finance.yahoo.com/news/mt-gox-files-bankruptcy-protection-094811743.html', '2014-02-28', 'secondary'),
    ],
  },
  {
    id: 'irs-property-2014', date: '2014-03-25', label: '미국 세금 지침', title: 'IRS의 가상통화 재산 취급 지침', category: 'regulation', importance: 1,
    description: '미국 IRS가 Notice 2014-21을 통해 연방 세금 목적상 비트코인 등 전환 가능한 가상통화를 재산으로 취급하는 원칙을 제시했다.',
    dateBasis: '지침이 공개된 날짜다. 4월 14일 Internal Revenue Bulletin 수록일과 구분한다.',
    limitations: ['미국 연방 세금 목적의 분류다. 모든 국가의 법적 지위나 현재 세법 전체를 설명하지 않는다.'],
    sources: [
      source('IRS', 'Notice 2014-21', 'https://www.irs.gov/pub/irs-drop/n-14-21.pdf', '2014-03-25'),
      source('TIME', 'IRS says bitcoin is property, not currency', 'https://time.com/37428/bitcoin-irs-property-virtual-currency/', '2014-03-25', 'secondary'),
    ],
  },
  blockEvent({
    id: 'halving-2016', date: '2016-07-09', label: '2차 반감기', title: '두 번째 블록 보조금 반감기',
    description: '높이 420,000에서 블록당 신규 발행 보조금이 25 BTC에서 12.5 BTC로 줄었다.',
    height: 420000, hash: '000000000000000002cce816c0ab2c5c269cb081896b7dcb34b8422d6b74ffa1', timestampUtc: '2016-07-09T16:46:13Z', sources: [subsidySource],
  }),
  {
    id: 'bitfinex-hack-2016', date: '2016-08-02', label: '비트파이넥스 해킹', title: '비트파이넥스 고객 BTC 도난', category: 'security', importance: 2,
    description: '비트파이넥스 거래소가 보안 침해로 거래를 중단했고 고객 BTC 도난이 공개됐다. 이후 수사와 회수 절차로 이어졌다.',
    dateBasis: '거래소의 회고 FAQ가 명시한 침해 발생일과 당일 보도를 확인했다.',
    limitations: ['거래소 보관 자산의 침해 사건이다. 비트코인 합의 규칙이 해킹된 사건으로 표현하지 않는다.'],
    sources: [
      source('Bitfinex', '2016 Security Breach Bitcoin Recovery FAQ', 'https://support.bitfinex.com/hc/en-us/articles/4417401349657-2016-Security-Breach-Bitcoin-Recovery-Frequently-Asked-Questions-FAQ', '2022-02-08'),
      source('CoinDesk', 'Bitfinex offline as customer bitcoin reported stolen', 'https://www.coindesk.com/markets/2016/08/02/bitfinex-offline-as-customer-bitcoin-reported-stolen', '2016-08-02', 'secondary'),
    ],
  },
  {
    id: 'winklevoss-etp-denial-2017', date: '2017-03-10', label: '현물 ETP 불승인', title: 'SEC의 윙클보스 비트코인 신탁 상장안 불승인', category: 'regulation', importance: 2,
    description: '미국 SEC가 Winklevoss Bitcoin Trust를 상장하기 위한 거래소 규칙 변경안을 승인하지 않았다. 당시 시장 감시와 조작 방지 요건이 주요 쟁점이었다.',
    dateBasis: 'SEC 명령 34-80206의 날짜다.',
    limitations: ['특정 상장안에 관한 결정이다. 모든 비트코인 투자나 이후의 모든 ETP를 금지한 결정이 아니다.'],
    sources: [source('SEC', 'Order 34-80206: Winklevoss Bitcoin Trust', 'https://www.sec.gov/files/rules/sro/batsbzx/2017/34-80206.pdf', '2017-03-10')],
  },
  {
    id: 'bitcoin-cash-fork-2017', date: '2017-08-01', label: '비트코인 캐시 분기', title: '비트코인 캐시의 체인 분기', category: 'protocol', importance: 2,
    description: '비트코인과 다른 규칙을 채택한 비트코인 캐시(BCH) 체인이 분기했다. BTC와 BCH는 이후 서로 다른 네트워크와 자산으로 존재한다.',
    dateBasis: 'Coinbase의 지원 공지가 회고한 분기 날짜와 당시 보도를 확인했다.',
    limitations: ['지원 공지의 발표일인 12월 19일과 분기일을 구분한다. BTC가 BCH로 이름을 바꾼 사건이 아니다.'],
    sources: [
      source('Coinbase', 'Buy, sell, send and receive Bitcoin Cash on Coinbase', 'https://www.coinbase.com/blog/buy-sell-send-and-receive-bitcoin-cash-on-coinbase', '2017-12-19'),
      source('WIRED', 'Bitcoin is splitting in two. Now what?', 'https://www.wired.com/story/bitcoin-is-splitting-in-two-now-what', '2017-08-01', 'secondary'),
    ],
  },
  blockEvent({
    id: 'segwit-2017', date: '2017-08-24', label: 'SegWit 활성화', title: '세그윗 합의 규칙 활성화', importance: 2,
    description: '높이 481,824에서 세그윗(Segregated Witness) 규칙이 활성화됐다. 거래의 서명 데이터를 분리하는 프로토콜 변경이다.',
    height: 481824, hash: '0000000000000000001c8018d9cb3b742ef25114f27563e3fc4a1902167f9893', timestampUtc: '2017-08-24T01:57:37Z',
    sources: [source('Bitcoin Core', 'Segregated Witness upgrade guide', 'https://bitcoincore.org/en/2016/10/27/segwit-upgrade-guide/', '2016-10-27')],
  }),
  {
    id: 'cme-futures-2017', date: '2017-12-18', label: 'CME 선물 첫 거래일', title: 'CME 비트코인 선물의 첫 거래일', category: 'institution', importance: 3,
    description: 'CME의 현금 결제형 비트코인 선물이 첫 거래일을 맞았다. 비트코인을 직접 보관하는 현물 상품과 구조가 다르다.',
    dateBasis: 'CME가 정한 거래일 12월 18일이다. 실제 야간 세션은 미국 시간 12월 17일에 시작됐다.',
    limitations: ['출시 예고 보도자료와 실제 개장 이후 Reuters 보도를 함께 사용했다. 미국 최초의 모든 비트코인 선물이라는 주장은 하지 않는다.'],
    sources: [
      source('CME Group', 'Bitcoin futures to launch Dec. 18', 'https://www.cmegroup.com/media-room/press-releases/2017/12/01/cme_group_self-certifiesbitcoinfuturestolaunchdec18.html', '2017-12-01'),
      source('Reuters', 'CME bitcoin futures get tepid take-up in debut', 'https://www.reuters.com/article/world/exchange-giant-cmes-bitcoin-futures-get-tepid-take-up-in-debut-idUSKBN1EB04K/', '2017-12-18', 'secondary'),
    ],
  },
  {
    id: 'lightning-beta-2018', date: '2018-03-15', label: '라이트닝 베타', title: 'lnd의 메인넷 베타 공개', category: 'protocol', importance: 1,
    description: 'Lightning Labs가 비트코인 메인넷용 lnd 0.4-beta를 공개했다. 결제 채널을 이용하는 라이트닝 구현체 개발의 주요 이정표다.',
    dateBasis: '개발사의 메인넷 베타 출시 공지 날짜다.',
    limitations: ['개발자 대상 베타 공개다. 라이트닝의 최초 실험·최초 결제·모든 구현체의 완성일로 해석하지 않는다.'],
    sources: [
      source('Lightning Labs', 'Lightning Labs announces lnd beta', 'https://lightning.engineering/posts/2018-03-15-lnd-beta/', '2018-03-15'),
      source('Forbes', 'Lightning Network goes live as startup raises $2.5 million', 'https://www.forbes.com/sites/ktorpey/2018/03/15/bitcoins-highly-anticipated-lightning-network-goes-live-as-startup-raises-2-5-million/', '2018-03-15', 'secondary'),
    ],
  },
  {
    id: 'who-pandemic-2020', date: '2020-03-11', label: '코로나19 팬데믹', title: 'WHO의 코로나19 팬데믹 판단', category: 'macro', importance: 3,
    description: 'WHO가 코로나19를 팬데믹으로 특징지을 수 있다고 발표했다. 전 세계 자산시장의 급격한 변동을 이해하기 위한 거시경제 맥락이다.',
    dateBasis: 'WHO 사무총장 언론 브리핑의 날짜다.',
    limitations: ['비트코인에 특화된 사건이 아니다. 이후 BTC 가격 변동의 단독 원인으로 추정하지 않는다.'],
    sources: [
      source('WHO', 'Director-General media briefing, 11 March 2020', 'https://www.who.int/news-room/speeches/item/who-director-general-s-opening-remarks-at-the-media-briefing-on-covid-19---11-march-2020', '2020-03-11'),
      source('TIME', 'WHO declares coronavirus a pandemic', 'https://time.com/5791661/who-coronavirus-pandemic-declaration/', '2020-03-11', 'secondary'),
    ],
  },
  blockEvent({
    id: 'halving-2020', date: '2020-05-11', label: '3차 반감기', title: '세 번째 블록 보조금 반감기',
    description: '높이 630,000에서 블록당 신규 발행 보조금이 12.5 BTC에서 6.25 BTC로 줄었다.',
    height: 630000, hash: '000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d', timestampUtc: '2020-05-11T19:23:43Z', sources: [subsidySource],
  }),
  {
    id: 'microstrategy-treasury-2020', date: '2020-08-11', label: '기업 재무자산 채택', title: '마이크로스트래티지의 BTC 재무자산 매입 발표', category: 'institution', importance: 3,
    description: '마이크로스트래티지가 수수료를 포함해 2억 5,000만 달러로 21,454 BTC를 매입하고 주요 재무준비자산으로 채택했다고 발표했다.',
    dateBasis: 'SEC에 제출된 회사 보도자료의 발표일이다. 개별 매수 체결 시각은 아니다.',
    limitations: ['당시 회사명과 당시 매입분을 기록한다. 이후 회사 보유량이나 현재 기업가치로 대체하지 않는다.'],
    sources: [source('MicroStrategy / SEC EDGAR', 'MicroStrategy adopts bitcoin as primary treasury reserve asset', 'https://www.sec.gov/Archives/edgar/data/1050446/000119312520215604/d921849dex991.htm', '2020-08-11')],
  },
  {
    id: 'paypal-2020', date: '2020-10-21', label: '페이팔 서비스 발표', title: '페이팔의 암호자산 매매·보유 서비스 발표', category: 'adoption', importance: 2,
    description: '페이팔이 미국 이용자에게 비트코인 등 암호자산의 매수·보유·매도 기능을 제공하는 계획을 발표했다.',
    dateBasis: '최초 서비스 발표일이다. 전체 적격 미국 고객으로 확대됐다는 후속 공지 날짜 11월 12일과 구분한다.',
    limitations: ['발표 당일 모든 가맹점이 BTC를 직접 수취하거나 모든 이용자에게 기능이 즉시 제공됐다는 뜻은 아니다.'],
    sources: [
      source('PayPal', 'New service enabling users to buy, hold and sell cryptocurrency', 'https://newsroom.paypal-corp.com/2020-10-21-PayPal-Launches-New-Service-Enabling-Users-to-Buy-Hold-and-Sell-Cryptocurrency', '2020-10-21'),
      source('Reuters', 'PayPal to open up network to cryptocurrencies', 'https://www.reuters.com/business/finance/paypal-open-up-network-cryptocurrencies-2020-10-21/', '2020-10-21', 'secondary'),
    ],
  },
  {
    id: 'tesla-disclosure-2021', date: '2021-02-08', label: '테슬라 BTC 공시', title: '테슬라의 15억 달러 BTC 보유 공시', category: 'institution', importance: 3,
    description: '테슬라가 연차보고서에서 2021년 1월에 비트코인 15억 달러를 매입했다고 밝혔다. 대형 상장사의 재무자산 선택이 공시된 사건이다.',
    dateBasis: '10-K가 제출된 2월 8일이다. 실제 매입 기간은 보고서가 설명한 1월이다.',
    limitations: ['공시일을 매입 체결일로 사용하지 않는다. 당시 보유액이 현재 보유액을 의미하지 않는다.'],
    sources: [
      source('Tesla / SEC EDGAR', '2020 Form 10-K', 'https://www.sec.gov/Archives/edgar/data/1318605/000156459021004599/tsla-10k_20201231.htm', '2021-02-08'),
      source('Axios', 'Tesla buys $1.5 billion in bitcoin', 'https://www.axios.com/2021/02/08/tesla-bitcoin', '2021-02-08', 'secondary'),
    ],
  },
  {
    id: 'coinbase-listing-2021', date: '2021-04-14', label: '코인베이스 직상장', title: '코인베이스의 나스닥 직접 상장', category: 'institution', importance: 2,
    description: '코인베이스의 클래스 A 주식이 나스닥에서 직접 상장 방식으로 거래를 시작했다. 암호자산 거래소 운영기업의 주식 상장이다.',
    dateBasis: '거래 개시 당일 보도와 회사 후속 10-Q의 완료일을 교차 확인했다.',
    limitations: ['BTC 자체가 나스닥에 상장된 사건이나 전통적인 공모 자금조달 방식의 IPO로 표현하지 않는다.'],
    sources: [
      source('Coinbase / SEC EDGAR', 'Q1 2022 Form 10-Q: direct listing completed April 14, 2021', 'https://www.sec.gov/Archives/edgar/data/1679788/000167978822000048/coin-20220331.htm', '2022-05-10'),
      source('Reuters', 'Coinbase Nasdaq debut', 'https://www.reuters.com/technology/coinbase-heads-89-bln-valuation-nasdaq-debut-2021-04-14/', '2021-04-14', 'secondary'),
    ],
  },
  {
    id: 'el-salvador-adoption-2021', date: '2021-09-07', label: '엘살바도르 법 시행', title: '엘살바도르 비트코인법 시행', category: 'adoption', importance: 3,
    description: '엘살바도르에서 비트코인을 법정통화로 채택한 법이 시행됐다. 미국 달러를 폐지하거나 대체한 제도는 아니었다.',
    dateBasis: '6월의 입법 발표일과 구분한 9월 7일 시행일이다.',
    limitations: ['2021년 당시 법의 시행을 기록한다. 민간 수취 의무를 완화한 2025년 개정과 함께 읽어야 한다.'],
    sources: [
      source('엘살바도르 입법의회', 'Ley Bitcoin 입법 발표', 'https://www.asamblea.gob.sv/node/11282', '2021-06-09'),
      source('Banco de España / Sergio Gorjón', 'The role of cryptoassets as legal tender: the example of El Salvador', 'https://www.bde.es/f/webbde/SES/Secciones/Publicaciones/InformesBoletinesRevistas/ArticulosAnaliticos/21/T4/Files/be2104-art35e.pdf', '2021-10-07', 'secondary'),
    ],
  },
  {
    id: 'china-crypto-notices-2021', date: '2021-09-24', label: '중국 거래·채굴 규제', title: '중국의 암호자산 거래·채굴 규제 통지 공개', category: 'regulation', importance: 3,
    description: '중국 당국이 암호자산 관련 거래 업무의 제한과 채굴 활동 정비에 관한 통지를 공개했다. 해외 거래소의 중국 내 서비스와 신규 채굴 프로젝트도 포함됐다.',
    dateBasis: '두 통지의 웹 공개일 9월 24일이다. 문서 서명일은 거래 통지 9월 15일, 채굴 통지 9월 3일이다.',
    limitations: ['서명·공개·지역별 집행 날짜는 같지 않다. 개인의 단순 보유를 일괄 범죄로 규정했다는 표현은 사용하지 않는다.'],
    sources: [
      source('중국 인민은행 등 / SAFE', '关于进一步防范和处置虚拟货币交易炒作风险的通知', 'https://www.safe.gov.cn/safe/2021/0924/19911.html', '2021-09-24'),
      source('중국 국가발전개혁위원회', '关于整治虚拟货币“挖矿”活动的通知', 'https://www.ndrc.gov.cn/xxgk/zcfb/tz/202109/t20210924_1297474.html', '2021-09-24'),
      source('The Guardian', 'China declares cryptocurrency transactions illegal', 'https://www.theguardian.com/world/2021/sep/24/china-declares-transactions-cryptocurrencies-illegal', '2021-09-24', 'secondary'),
    ],
  },
  {
    id: 'bito-2021', date: '2021-10-19', label: '미국 BTC 선물 ETF', title: 'ProShares BITO의 거래 개시', category: 'institution', importance: 2,
    description: '미국에서 비트코인 선물에 투자하는 ProShares Bitcoin Strategy ETF(BITO)가 거래를 시작했다. 2024년 승인된 현물 보유 상품과 구조가 다르다.',
    dateBasis: '시장 거래 개시일이다. 펀드 설정일 10월 18일과 구분한다.',
    limitations: ['선물 기반 ETF를 현물 비트코인 ETF로 표시하지 않는다.'],
    sources: [
      source('ProShares', 'Bitcoin-linked ETF to launch on October 19', 'https://www.proshares.com/press-releases/proshares-to-launch-the-first-u.s.-bitcoin-linked-etf-on-october-19', '2021-10-18'),
      source('Reuters', 'Bitcoin futures ETF listing', 'https://www.reuters.com/technology/bitcoin-nears-record-high-ahead-futures-etf-listing-2021-10-19/', '2021-10-19', 'secondary'),
    ],
  },
  blockEvent({
    id: 'taproot-2021', date: '2021-11-14', label: '탭루트 활성화', title: '탭루트 합의 규칙 활성화', importance: 2,
    description: '높이 709,632에서 탭루트 규칙이 활성화됐다. 슈노르 서명과 새로운 스크립트 지출 구조를 포함하는 소프트포크다.',
    height: 709632, hash: '0000000000000000000687bca986194dc2c1f949318629b44bb54ec0a94d8244', timestampUtc: '2021-11-14T05:15:27Z',
    sources: [source('Bitcoin Core', 'Bitcoin Core 0.21.1 release notes: Taproot', 'https://bitcoincore.org/en/releases/0.21.1/', '2021-05-01')],
  }),
  {
    id: 'bitfinex-seizure-2022', date: '2022-02-08', label: '도난 BTC 압수 발표', title: '미 법무부의 비트파이넥스 도난 자산 압수 발표', category: 'security', importance: 1,
    description: '미 법무부가 2016년 비트파이넥스 해킹과 연결된 BTC 압수와 자금세탁 혐의 체포를 발표했다.',
    dateBasis: '법무부 발표일이다. 2016년 해킹 발생일이나 이후 유죄 판단 날짜와 구분한다.',
    limitations: ['해당 시점의 체포·혐의와 자산 압수 사실을 기록한다. 체포 발표 자체를 유죄 확정으로 표현하지 않는다.'],
    sources: [
      source('U.S. Department of Justice', 'Two arrested for alleged conspiracy to launder stolen cryptocurrency', 'https://www.justice.gov/archives/opa/pr/two-arrested-alleged-conspiracy-launder-45-billion-stolen-cryptocurrency', '2022-02-08'),
      source('TIME', 'Cryptocurrency laundering arrests and the Bitfinex hack', 'https://time.com/6146749/cryptocurrency-laundering-bitfinex-hack/', '2022-02-10', 'secondary'),
    ],
  },
  {
    id: 'terra-ust-2022', date: '2022-05-09', label: '테라·UST 붕괴', title: '테라 UST의 달러 연동 붕괴', category: 'market', importance: 3,
    description: '테라의 알고리즘 스테이블코인 UST가 달러 연동을 잃는 과정이 본격화됐다. 테라·루나 생태계 붕괴는 여러 날에 걸쳐 진행됐다.',
    dateBasis: 'SEC의 후속 배상계획이 UST 가치 하락일로 명시한 5월 9일을 대표 날짜로 사용한다.',
    limitations: ['5월 초부터 이어진 연속 사건을 한 날짜로 압축했다. 비트코인 프로토콜이나 BTC 자체의 달러 페그가 붕괴한 사건은 아니다.'],
    sources: [
      source('SEC', 'Tai Mo Shan proposed distribution plan: relevant period and May 9 decline', 'https://www.sec.gov/files/litigation/admin/2026/34-106168-pdp.pdf', '2026-08-20'),
      source('SEC', 'Terraform and Do Kwon charged with orchestrating crypto securities fraud', 'https://www.sec.gov/newsroom/press-releases/2023-32', '2023-02-16'),
    ],
  },
  {
    id: 'celsius-filing-2022', date: '2022-07-13', label: '셀시어스 회생 신청', title: '셀시어스의 챕터 11 신청', category: 'market', importance: 2,
    description: '암호자산 대출업체 셀시어스와 일부 계열사가 미국 연방파산법 챕터 11에 따른 회생 절차를 신청했다.',
    dateBasis: '버몬트 금융규제국과 채권자위원회 자료가 명시한 법원 신청일이다.',
    limitations: ['6월의 인출 중단일과 구분한다. 거래소·대출업체의 채무 문제를 비트코인 네트워크의 지급불능으로 일반화하지 않는다.'],
    sources: [
      source('Vermont Department of Financial Regulation', 'Celsius Network files Chapter 11 bankruptcy', 'https://dfr.vermont.gov/consumer-alert/celsius-network-files-chapter-11-bankruptcy', '2022-07-14'),
      source('Celsius creditors committee / Kroll', 'Case information: petition date July 13, 2022', 'https://devcases.ra.kroll.com/CelsiusCommittee/Home-Index'),
      source('The Block', 'Celsius declares Chapter 11 bankruptcy in New York', 'https://www.theblock.co/news/regulation/2022-07-13-crypto-lender-celsius-declares-chapter-11-bankruptcy-in-new-york-157491', '2022-07-13', 'secondary'),
    ],
  },
  {
    id: 'ftx-filing-2022', date: '2022-11-11', label: 'FTX 회생 신청', title: 'FTX의 챕터 11 신청', category: 'market', importance: 3,
    description: 'FTX Trading과 다수 관계사가 미국에서 챕터 11 절차를 신청했다. 고객 자산과 거래소 운영에 대한 대규모 후속 조사가 이어졌다.',
    dateBasis: 'FTX Trading 등 주요 채무자의 최초 신청일이다. 일부 관계사의 11월 14일 신청과 구분한다.',
    limitations: ['신청일 당시의 절차를 표시한다. 이후 형사사건의 유죄 판결을 이 날짜에 소급하지 않는다.'],
    sources: [
      source('FTX bankruptcy estate / Kroll', 'FTX restructuring case information', 'https://restructuring.ra.kroll.com/ftx/'),
      source('Axios', 'What comes next after FTX bankruptcy filing', 'https://www.axios.com/2022/11/14/ftx-bankruptcy-filing-whats-next', '2022-11-14', 'secondary'),
    ],
  },
  {
    id: 'blackrock-filing-2023', date: '2023-06-15', label: '블랙록 현물 ETF 신청', title: 'iShares Bitcoin Trust 등록신고서 제출', category: 'institution', importance: 2,
    description: '블랙록 계열 스폰서가 iShares Bitcoin Trust의 S-1 등록신고서를 SEC에 제출했다. 현물 BTC를 보유하는 상장상품을 추진한 신청 단계다.',
    dateBasis: 'S-1 표지의 제출일 6월 15일이다. 파일명에 포함된 6월 8일은 신탁 설립일이다.',
    limitations: ['신청은 승인이나 거래 개시가 아니다. 세 단계를 별도 사건으로 구분한다.'],
    sources: [
      source('iShares / SEC EDGAR', 'iShares Bitcoin Trust Form S-1', 'https://www.sec.gov/Archives/edgar/data/1980994/000143774923017574/bit20230608_s1.htm', '2023-06-15'),
      source('Axios', 'BlackRock files for a spot bitcoin ETF', 'https://www.axios.com/2023/06/15/blackrock-bitcoin-spot-etf-application', '2023-06-15', 'secondary'),
    ],
  },
  {
    id: 'grayscale-court-2023', date: '2023-08-29', label: '그레이스케일 판결', title: '그레이스케일의 SEC 상대 항소심 판결', category: 'regulation', importance: 2,
    description: '미국 연방항소법원이 그레이스케일의 현물 상품 전환 신청에 대한 SEC의 불승인 결정을 취소하고 재검토하도록 했다.',
    dateBasis: '연방항소법원 판결일이다.',
    limitations: ['법원이 ETF 거래를 직접 승인한 것으로 해석하지 않는다. 이후 SEC 승인 절차와 구분한다.'],
    sources: [
      source('U.S. Court of Appeals / Justia 원문 전재', 'Grayscale Investments v. SEC, No. 22-1142', 'https://law.justia.com/cases/federal/appellate-courts/cadc/22-1142/22-1142-2023-08-29.html', '2023-08-29'),
      source('Grayscale / SEC EDGAR', 'Grayscale prevails in lawsuit against the SEC', 'https://www.sec.gov/Archives/edgar/data/1588489/000095017023045100/gbtc-ex99_1.htm', '2023-08-29'),
      source('Associated Press', 'Court rules against SEC in Grayscale bitcoin fund case', 'https://apnews.com/article/d8a9bb4fb476527e803aed3dd19dc303', '2023-08-29', 'secondary'),
    ],
  },
  {
    id: 'us-spot-etp-approval-2024', date: '2024-01-10', label: '미국 현물 ETF 승인', title: 'SEC의 현물 비트코인 ETP 상장 승인', category: 'regulation', importance: 3,
    description: '미국 SEC가 여러 현물 비트코인 상장지수상품(ETP)의 상장·거래를 허용하는 거래소 규칙 변경안을 승인했다. 시장에서는 보통 현물 ETF로 부른다.',
    dateBasis: 'SEC의 실제 승인일 1월 10일이다. 전날 침해된 SNS 계정의 허위 게시물과 구분한다.',
    limitations: ['상장 승인은 비트코인의 투자 가치나 안전성에 대한 SEC의 보증이 아니다.'],
    sources: [
      source('SEC', 'Statement on approval of spot bitcoin exchange-traded products', 'https://www.sec.gov/newsroom/speeches-statements/gensler-statement-spot-bitcoin-011023', '2024-01-10'),
      source('SEC / Federal Register', 'Approval order dated January 10, 2024', 'https://www.govinfo.gov/content/pkg/FR-2024-01-17/html/2024-00743.htm', '2024-01-17'),
    ],
  },
  {
    id: 'us-spot-etp-trading-2024', date: '2024-01-11', label: '현물 ETF 거래 시작', title: 'IBIT 등 미국 현물 비트코인 ETF 거래 개시', category: 'institution', importance: 2,
    description: 'IBIT 등 미국 현물 비트코인 상장상품의 주식 거래가 시작됐다. 전날의 규제 승인과 실제 시장 거래 개시를 구분하는 사건이다.',
    dateBasis: 'BlackRock의 당일 개장 발표와 AP 보도를 확인했다.',
    limitations: ['승인 대상 11개 상품 전부가 이날 동일한 상태로 거래를 시작했다고 일반화하지 않는다.'],
    sources: [
      source('BlackRock / Business Wire', 'BlackRock’s IBIT debuts on Nasdaq', 'https://www.businesswire.com/news/home/20240111007753/en/BlackRocks-IBIT-Debuts-on-Nasdaq', '2024-01-11'),
      source('Associated Press', 'New bitcoin ETFs begin trading', 'https://apnews.com/article/61b78e50f27fac0e188999f547c22b1e', '2024-01-11', 'secondary'),
    ],
  },
  blockEvent({
    id: 'halving-2024', date: '2024-04-20', label: '4차 반감기', title: '네 번째 블록 보조금 반감기',
    description: '높이 840,000에서 블록당 신규 발행 보조금이 6.25 BTC에서 3.125 BTC로 줄었다.',
    height: 840000, hash: '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5', timestampUtc: '2024-04-20T00:09:27Z', sources: [subsidySource],
  }),
  {
    id: 'mtgox-repayments-2024', date: '2024-07-05', label: '마운트곡스 상환 시작', title: '마운트곡스의 BTC·BCH 상환 개시', category: 'market', importance: 2,
    description: '마운트곡스 재생관재인이 지정 거래소를 통해 일부 재생채권자에게 BTC와 BCH를 상환했다고 공지했다.',
    dateBasis: '관재인의 상환 공지 날짜이며 공지는 같은 날 실시한 상환을 명시한다.',
    limitations: ['일부 채권자의 상환 시작이다. 모든 채권자에게 상환이 완료됐거나 수령자가 즉시 매도했다는 뜻은 아니다.'],
    sources: [source('MtGox rehabilitation trustee', 'Repayments in Bitcoin and Bitcoin Cash', 'https://www.mtgox.com/img/pdf/20240705_01_announcement_en.pdf', '2024-07-05')],
  },
  {
    id: 'saxony-sale-2024', date: '2024-07-12', label: '독일 압수 BTC 매각', title: '독일 작센 당국의 압수 BTC 매각 완료', category: 'market', importance: 2,
    description: '독일 작센 당국이 형사사건에서 확보한 49,858 BTC의 긴급 매각을 마쳤다. 공식 발표에 따르면 매각 기간은 6월 19일부터 7월 12일까지였다.',
    dateBasis: '7월 16일 검찰 보도자료가 명시한 매각 완료일 7월 12일이다.',
    limitations: ['독일 연방정부의 모든 BTC 보유분을 뜻하지 않는다. 매각이 특정 가격 하락을 단독으로 일으켰다고 추정하지 않는다.'],
    sources: [
      source('Generalstaatsanwaltschaft Dresden', 'Notveräußerung von Bitcoins abgeschlossen', 'https://www.justiz.sachsen.de/gensta/download/Medieninformation_16072024.pdf', '2024-07-16'),
      source('MDR', 'Sachsen verkauft sichergestellte Bitcoins', 'https://www.mdr.de/nachrichten/sachsen/bitcoins-verkauf-geld-kryptowaehrung-strafverfahren-104.html', '2024-07-16', 'secondary'),
    ],
  },
  {
    id: 'sab-122-2025', date: '2025-01-23', label: 'SEC 수탁 회계지침', title: 'SEC 직원 회계지침 SAB 122 발표', category: 'regulation', importance: 1,
    description: 'SEC가 SAB 122를 발표해 암호자산 수탁 의무의 회계 처리에 관한 기존 SAB 121 지침을 철회했다.',
    dateBasis: '발표일 1월 23일이다. 문서에 적힌 효력 발생일 1월 30일과 구분한다.',
    limitations: ['직원 회계지침의 변경이다. 모든 금융기관에 모든 암호자산 업무를 일괄 허가한 법률로 표현하지 않는다.'],
    sources: [
      source('SEC', 'Staff Accounting Bulletin No. 122', 'https://www.sec.gov/rules-regulations/staff-guidance/staff-accounting-bulletins/staff-accounting-bulletin-122', '2025-01-23'),
      source('Reuters', 'Wall Street regulator revokes accounting guidance on crypto assets', 'https://www.reuters.com/technology/wall-street-regulator-revokes-accounting-guidance-crypto-assets-2025-01-24/', '2025-01-24', 'secondary'),
    ],
  },
  {
    id: 'el-salvador-reform-2025', date: '2025-01-29', label: '엘살바도르 법 개정', title: '엘살바도르의 민간 BTC 수취 의무 완화 의결', category: 'regulation', importance: 2,
    description: '엘살바도르 의회가 민간의 비트코인 수취를 자발적 선택으로 바꾸는 법 개정안을 의결했다. IMF도 후속 프로그램 발표에서 해당 개혁을 확인했다.',
    dateBasis: 'Reuters가 보도한 현지 의회 의결일 1월 29일이다. UTC 기사 게시일은 1월 30일이며 법의 시행일과도 구분한다.',
    limitations: ['보도마다 법정통화라는 표현의 해석이 달라, 실제로 바뀐 수취 의무에 한정해 기술한다.', '의회 원문 PDF는 검색으로 확인했으나 직접 재조회가 실패했다. 의결일은 Reuters, 변경 내용은 IMF 발표로 교차 확인한다.'],
    sources: [
      source('IMF', 'New 40-month Extended Fund Facility arrangement for El Salvador', 'https://www.imf.org/en/news/articles/2025/02/26/pr25043-el-salvador-imf-approves-new-40-month-us1-bn-eff-arr', '2025-02-26'),
      source('Reuters', 'Lawmakers in El Salvador rush new bitcoin reform after IMF deal', 'https://www.reuters.com/world/americas/lawmakers-el-salvador-rush-new-bitcoin-reform-after-imf-deal-2025-01-30/', '2025-01-30', 'secondary'),
    ],
  },
  {
    id: 'us-bitcoin-reserve-2025', date: '2025-03-06', label: '미국 BTC 준비자산', title: '미국 전략적 비트코인 준비자산 행정명령', category: 'regulation', importance: 3,
    description: '미국 대통령이 전략적 비트코인 준비자산을 수립하는 행정명령에 서명했다. 초기 구성은 적법하게 몰수된 정부 보유 BTC를 바탕으로 하도록 했다.',
    dateBasis: '백악관이 명시한 행정명령 서명일 3월 6일이다. 다음 날 UTC 보도 날짜와 구분한다.',
    limitations: ['행정명령 수립을 신규 시장 매수가 이미 집행됐다는 사실로 바꾸지 않는다.', '비트코인 준비자산과 다른 디지털 자산 비축 제도는 구별한다.'],
    sources: [
      source('The White House', 'Establishment of the Strategic Bitcoin Reserve and United States Digital Asset Stockpile', 'https://www.whitehouse.gov/presidential-actions/2025/03/establishment-of-the-strategic-bitcoin-reserve-and-united-states-digital-asset-stockpile/', '2025-03-06'),
      source('Reuters', 'Trump signs order to establish strategic bitcoin reserve', 'https://www.reuters.com/technology/trump-signs-order-establish-strategic-bitcoin-reserve-white-house-crypto-czar-2025-03-07/', '2025-03-07', 'secondary'),
    ],
  },
];

function deepFreeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object' && !Object.isFrozen(child)) deepFreeze(child);
  return Object.freeze(value);
}

function chronology(a, b) { return a.date.localeCompare(b.date) || a.id.localeCompare(b.id); }

export const BITCOIN_EVENTS = deepFreeze(events.map(event => ({ datePrecision: 'source-calendar-day', ...event })).sort(chronology));

function calendarDay(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${name} must be YYYY-MM-DD`);
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new RangeError(`${name} is not a valid calendar day`);
  return value;
}

/**
 * Inclusive calendar-day filtering. Optional limit prioritizes editorial
 * importance, then earlier date/id; the returned list is always chronological.
 * It never synthesizes future events or changes the frozen source catalog.
 */
export function getVisibleBitcoinEvents({ startDate, endDate, minImportance = 1, categories, limit } = {}) {
  const start = calendarDay(startDate, 'startDate', '0001-01-01');
  const end = calendarDay(endDate, 'endDate', BITCOIN_EVENTS_REVIEW_DATE);
  if (start > end) throw new RangeError('startDate must not be later than endDate');
  if (!Number.isInteger(minImportance) || minImportance < 1 || minImportance > 3) throw new RangeError('minImportance must be 1, 2 or 3');
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) throw new RangeError('limit must be a nonnegative safe integer');
  let allowed;
  if (categories !== undefined) {
    if (!Array.isArray(categories) && !(categories instanceof Set)) throw new TypeError('categories must be an array or Set');
    allowed = new Set(categories);
    for (const category of allowed) if (!Object.hasOwn(BITCOIN_EVENT_CATEGORIES, category)) throw new RangeError(`Unknown event category: ${String(category)}`);
  }
  let visible = BITCOIN_EVENTS.filter(event => event.date >= start && event.date <= end && event.importance >= minImportance && (!allowed || allowed.has(event.category)));
  if (limit !== undefined && visible.length > limit) visible = visible.sort((a, b) => b.importance - a.importance || chronology(a, b)).slice(0, limit);
  return visible.sort(chronology);
}
