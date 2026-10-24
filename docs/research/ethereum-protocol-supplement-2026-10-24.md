# Ethereum 프로토콜·네트워크 사건 보완

검토일: 2026-10-24. 원본 기록: `research-data/ethereum-protocol-supplement-events.json`.

정책·시장 사건의 범위를 넓히면서 초기 형성 과정, 프로토콜과 네트워크 운영의 주요 전환점도 다시 점검했다. 기존 25개 사건과 중복되지 않는 15개 기록을 추가했다. 날짜를 임의로 정한 ‘열풍’, 가격 고점·저점, 아직 실행되지 않은 업그레이드는 생성하지 않았다.

## 추가 기록

| 날짜 | 사건 | 날짜를 확정한 근거 |
|---|---|---|
| 2014-07-22 | 이더 사전판매 개시 | 공식 개시 글, 판매 진행 집계와 Homestead 가이드 회고 |
| 2015-09-07 | Frontier 초기 난이도 폭탄 기준 블록 | EF 당시 규칙 설명과 실제 블록 200,000 |
| 2016-09-22 | DoS 공격 공지와 초기 대응 | 서로 다른 EF 개발자의 당일 경보·기술 분석; 공격의 최초 순간과 구분 |
| 2016-10-18 | Tangerine Whistle | EIP-608·당시 공지와 실제 블록 2,463,000 |
| 2016-11-22 | Spurious Dragon | EIP-607·당시 공지와 실제 블록 2,675,000 |
| 2019-01-15 | 보안상 Constantinople 연기 | ChainSecurity 원 분석, EF 결정, Geth 긴급 릴리스 |
| 2020-01-02 | Muir Glacier | EIP-2384·공지와 실제 블록 9,200,000 |
| 2020-11-04 | 스테이킹 예치 계약 주소·v1.0 명세 공개 | EF 당일 공개와 독립 Status/Nimbus 코드 검증·지원 발표 |
| 2021-08-27 | 취약한 Geth 버전의 소수 체인 분리 | Geth 보안 권고와 개발팀 사후 보고서의 실제 악용일 |
| 2021-12-09 | Arrow Glacier | EIP-4345·공지와 실제 블록 13,773,000 |
| 2022-06-30 | Gray Glacier | EIP-5133·공지와 실제 블록 15,050,000 |
| 2022-09-06 | Bellatrix | EF 설계·공식 회고와 Coinbase의 완료 후 네트워크 관측 |
| 2023-05-11 | 최종 확정 지연 | Prysm 사후 보고서와 다지역 노드 데이터 연구 |
| 2023-05-12 | 최종 확정 지연 재발 | 같은 두 연구의 별도 두 번째 사건 기록 |
| 2025-12-04 | 푸사카 이후 Prysm 처리 장애 | Prysm 사후 보고서와 구현 참여자의 기술 설명 |

## 원문 대조에서 발견한 차이

- **이더 사전판매:** [당일 개시 글](https://blog.ethereum.org/2014/07/22/launching-the-ether-sale), [진행 집계](https://blog.ethereum.org/2014/08/08/ether-sale-a-statistical-overview), [공식 역사 문서](https://github.com/ethereum/homestead-guide/blob/master/source/introduction/history-of-ethereum.rst)를 대조했다. 판매 비율을 달러 현물 가격으로 생성하지 않고, 메인넷 개시·현물 거래 이력과 분리한다. 같은 프로젝트 자료의 한계도 표시한다.
- **Frontier thawing:** [당시 프로토콜 공지](https://blog.ethereum.org/2015/08/04/ethereum-protocol-update-1)는 난이도 규칙의 시작 높이를 200,000으로 정한다. [가스 제한 완화 공지](https://blog.ethereum.org/2015/08/04/the-thawing-frontier)는 8월의 별도 클라이언트 변경을 설명한다. [공식 연대표](https://ethereum.org/ethereum-forks/)가 두 설명을 함께 묶어도 9월 7일에 처음 거래가 가능해졌다고 복사하지 않았다.
- **예상일과 실행일:** Muir의 사전 예상은 1월 1일, Arrow는 12월 8일, Gray는 6월 29일이다. 실제 블록 시각은 각각 1월 2일, 12월 9일, 6월 30일이다. 공지의 목표 날짜를 실제 적용일로 사용하지 않았다.
- **Tangerine의 포함 EIP:** 공식 연대표의 넓은 설명보다 [EIP-608 명세](https://eips.ethereum.org/EIPS/eip-608)를 우선해 EIP-150을 기록했다. Spurious Dragon의 EIP-155·160·161·170은 [별도 명세](https://eips.ethereum.org/EIPS/eip-607)로 확인했다.
- **DoS:** [당일 경보](https://blog.ethereum.org/2016/09/22/ethereum-network-currently-undergoing-dos-attack)와 [개발자 분석](https://blog.ethereum.org/en/2016/09/22/transaction-spam-attack-next-steps)은 처리 지연과 합의 실패·전체 중단을 구분한다. 9월 22일은 공개 대응일이며 전체 공격 기간의 시작을 단정하지 않는다.
- **Constantinople:** [EF 연기 공지](https://blog.ethereum.org/2019/01/15/security-alert-ethereum-constantinople-postponement), [ChainSecurity 원 분석](https://www.chainsecurity.com/blog/constantinople-enables-new-reentrancy-attack/index.html), [Geth v1.8.21](https://github.com/ethereum/go-ethereum/releases/tag/v1.8.21)을 대조했다. 예방적 연기를 이미 실행된 자금 탈취 사건으로 기술하지 않았다.
- **예치 계약:** [EF의 11월 4일 공개](https://blog.ethereum.org/en/2020/11/04/eth2-quick-update-no-19)와 [Status/Nimbus의 독립 코드 대조](https://status.app/blog/status-supports-the-eth-2-0-deposit-contract)를 확인했다. 계약 생성일 10월 14일, 주소 공개일 11월 4일, 비콘 체인 시작일 12월 1일을 합치지 않았다.
- **Geth 분리:** [사후 보고서](https://github.com/ethereum/go-ethereum/blob/master/docs/postmortems/2021-08-22-split-postmortem.md)의 파일명은 8월 22일이지만 본문 사건은 8월 27일이다. [보안 권고](https://github.com/ethereum/go-ethereum/security/advisories/GHSA-9856-9gg9-qcmq)의 8월 24일은 공개·패치 날짜다. 두 문서는 같은 개발팀 자료이며 이를 독립 두 기관의 조사로 세지 않는다.
- **Bellatrix:** [EF 설계](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement)와 [완료 후 Coinbase 관측](https://www.coinbase.com/institutional/research-insights/research/weekly-market-commentary/weekly-market-commentary-september-9-2022)을 대조했다. 9월 6일 합의층 준비와 9월 15일 실행층 PoS 전환을 분리한다. 예정 epoch 시각을 실행 블록 시각으로 생성하지 않았다.
- **2023년 확정 지연:** [Prysm 사후 보고서](https://medium.com/offchainlabs/post-mortem-report-ethereum-mainnet-finality-05-11-2023-95e271dfd8b2)와 [다지역·다클라이언트 노드 연구](https://ethresear.ch/t/cascading-network-effects-on-ethereums-finality/15871)는 서로 다른 시작·종료 정의를 사용한다. 각 날짜의 사건을 유지하되 단 하나의 정확한 지속 시간으로 강제하지 않았다. 전체 블록 생성 중단으로 표현하지 않았다.
- **2025년 Prysm 장애:** [공식 사후 보고서](https://prysm.offchainlabs.com/docs/misc/mainnet-postmortems/)의 UTC 사건일은 12월 4일이다. [구현 참여자 Potuz의 기술 분석](https://www.potuz.net/posts/fulu-bug/)과 대조하되 같은 팀의 자료라는 한계를 표시한다. 이를 푸사카 활성화일이나 네트워크 전체 확정 중단으로 바꾸지 않았다.

## 관측 자료와 독립성

블록 200,000·2,463,000·2,675,000·9,200,000·13,773,000·15,050,000의 공개 Blockscout API 응답을 조회하고 높이, 해시, 부모 해시, 헤더 시각 등 선택 필드를 `ethereum-protocol-block-receipts.json`에 추가했다. 여섯 건의 정확한 블록 시각은 이 응답에서만 가져온다. 이는 별도 탐색기의 관측 대조이며 Ethereum 전체 노드를 새로 실행한 검증은 아니다.

EF 공지와 ethereum.org는 같은 생태계의 공식 문서이므로 독립 조직 수를 부풀리지 않는다. 독립성이 제한된 DoS·Geth 사례는 상세 화면에도 그 한계를 남긴다. 2023년 연구는 Prysm의 원인 분석을 인용하면서 별도 노드 관측을 제공하므로, 공유한 설명과 새 관측을 구분했다.

추가 기록은 형성·네트워크·개발 이력이며 가격 하락 원인을 자동으로 지정하지 않는다. 가격 자료가 시작되기 전인 2014~2015년 사건은 목록에서 읽을 수 있고 차트의 가상 가격에 붙이지 않는다.
