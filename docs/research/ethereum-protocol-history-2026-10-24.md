# Ethereum protocol history — research cut-off 2026-10-24

## Scope and editorial decisions

This record supports the ETHUSD historical-event indicator. It contains 17 completed mainnet protocol milestones: 15 named launches/upgrades requested for review and two later completed BPO changes. It contains no price prediction, fitted model, inferred price effect, return estimate, or event sentiment score. `major` and `standard` express editorial display priority, not market impact.

All cited pages were opened and inspected on 2026-10-24. Public execution-block JSON was retrieved on the same date and compact receipts were saved in `research-data/ethereum-protocol-block-receipts.json`. The temporary integration catalog is `research-data/ethereum-protocol-events.json`. No ETH view or shared rendering code is modified by this research.

## Evidence and date rules

- An activation announcement proves a selected condition and planned feature set; it is not, by itself, proof of completion. Retrospective official history, completed-event announcements, and observed ledger records supply the other parts of the evidence.
- The 14 records with `block-timestamp` use an observed execution-block header timestamp and hash. For time-triggered post-Merge upgrades, the first execution block on/after the epoch condition is identified by checking its predecessor. `facts.epochActivationUtc` is a separate protocol setting and can differ from `facts.utcTimestamp`.
- Frontier, Beacon genesis, and Altair retain `source-calendar-day`. A calendar date is not an assertion that the event occurred at midnight. Genesis and epoch settings are preserved as clearly named auxiliary facts, not promoted to independently verified block timestamps.
- Ethereum Foundation, ethereum.org, and Ethereum EIP documents share institutional/development relationships. Two such documents are not described as two independent institutions. Their roles differ: announcement, specification, and retrospective confirmation.
- Blockscout is a separate explorer operator publishing primary ledger records. It provides a separate observation route for timestamp and hash, but is not an independent validator replay by this project. A block header alone does not prove every protocol feature executed or establish a financial consequence.
- Announcement publication dates, estimated PoW activation dates, actual UTC dates, consensus epoch boundaries, first execution blocks, and finalization are kept distinct.

## Verified event index

| UTC day | Event | Execution evidence / precision | Display priority |
| --- | --- | --- | --- |
| 2015-07-30 | 프런티어 메인넷 출시 | Official calendar day; no independently verified block timestamp | major |
| 2016-03-14 | 홈스테드 업그레이드 | Block 1,150,000; 2016-03-14T18:49:53Z | standard |
| 2016-07-20 | DAO 대응 하드포크 | Block 1,920,000; 2016-07-20T13:20:40Z | major |
| 2017-10-16 | 비잔티움 업그레이드 | Block 4,370,000; 2017-10-16T05:22:11Z | standard |
| 2019-02-28 | 콘스탄티노플·상트페테르부르크 | Block 7,280,000; 2019-02-28T19:52:04Z | standard |
| 2019-12-08 | 이스탄불 업그레이드 | Block 9,069,000; 2019-12-08T00:25:09Z | standard |
| 2020-12-01 | 비콘체인 가동 | Official calendar day; no independently verified block timestamp | major |
| 2021-04-15 | 베를린 업그레이드 | Block 12,244,000; 2021-04-15T10:07:03Z | standard |
| 2021-08-05 | 런던과 EIP-1559 적용 | Block 12,965,000; 2021-08-05T12:33:42Z | major |
| 2021-10-27 | 알테어 비콘체인 업그레이드 | Official calendar day; no independently verified block timestamp | standard |
| 2022-09-15 | Merge: 지분증명 전환 | Block 15,537,394; 2022-09-15T06:42:59Z | major |
| 2023-04-12 | 샤펠라: 스테이킹 인출 | Block 17,034,870; 2023-04-12T22:27:59Z | major |
| 2024-03-13 | 덴쿤: 블롭 데이터 도입 | Block 19,426,587; 2024-03-13T13:55:35Z | major |
| 2025-05-07 | 펙트라 업그레이드 | Block 22,431,084; 2025-05-07T10:05:11Z | major |
| 2025-12-03 | 푸사카: PeerDAS 도입 | Block 23,935,694; 2025-12-03T21:49:23Z | major |
| 2025-12-09 | BPO1: 블롭 용량 조정 | Block 23,975,778; 2025-12-09T14:21:11Z | standard |
| 2026-01-07 | BPO2: 블롭 용량 조정 | Block 24,179,383; 2026-01-07T01:01:11Z | standard |

## Resolved disagreements and precision traps

| Issue | Evidence and decision |
| --- | --- |
| Frontier genesis | The [same-day release notice](https://blog.ethereum.org/2015/07/30/ethereum-launches) confirms the launch. [Block 0](https://eth.blockscout.com/api/v2/blocks/0) has timestamp zero, while [block 1](https://eth.blockscout.com/api/v2/blocks/1) is 2015-07-30T15:26:28Z. The official timeline lists 15:26:13. Use the agreed launch day; do not invent a header timestamp for the launch. |
| Homestead day | [Block 1,150,000](https://eth.blockscout.com/api/v2/blocks/1150000) is March 14 at 18:49:53 UTC. A March 15 local date is not the UTC chart date. |
| Byzantium estimate | The [October 12 announcement](https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement) estimated October 16 at 12:00–13:00 UTC. [The activation block](https://eth.blockscout.com/api/v2/blocks/4370000) is 05:22:11 UTC. Both agree on the day; exact time comes from the ledger. |
| Istanbul day | The [announcement](https://blog.ethereum.org/2019/11/20/ethereum-istanbul-upgrade-announcement) estimated December 7; [block 9,069,000](https://eth.blockscout.com/api/v2/blocks/9069000) is December 8 at 00:25:09 UTC. Use December 8. |
| Merge trigger vs first PoS block | [Block 15,537,393](https://eth.blockscout.com/api/v2/blocks/15537393) is the terminal PoW block at 06:42:42; [block 15,537,394](https://eth.blockscout.com/api/v2/blocks/15537394) is the first PoS execution block at 06:42:59. The timeline pairs the former time with the latter number. Preserve 06:42:59 for the first PoS block, and do not call it the finalization moment. The [official transition description](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement) separately defines those steps. |
| Shapella epoch vs block | [Announcement](https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement): epoch start 22:27:35. [Predecessor](https://eth.blockscout.com/api/v2/blocks/17034869): 22:27:23. [First subsequent execution block](https://eth.blockscout.com/api/v2/blocks/17034870): 22:27:59. Keep the two times separate. |
| Pectra epoch vs block | [Announcement](https://blog.ethereum.org/2025/04/23/pectra-mainnet) and [block 22,431,084](https://eth.blockscout.com/api/v2/blocks/22431084) both give 10:05:11 UTC; [predecessor](https://eth.blockscout.com/api/v2/blocks/22431083) is 10:04:59. [Official retrospective](https://ethereum.org/roadmap/pectra/) explicitly confirms successful mainnet activation. |
| Fusaka epoch vs block | [Announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement): 21:49:11. [Predecessor](https://eth.blockscout.com/api/v2/blocks/23935693): 21:48:59. [First subsequent execution block](https://eth.blockscout.com/api/v2/blocks/23935694): 21:49:23. [Official retrospective](https://ethereum.org/roadmap/fusaka/) confirms December 3 completion. |
| BPO schedules vs actual completion | The [Fusaka announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) gives December 9 and January 7 settings; [Checkpoint #8](https://blog.ethereum.org/2026/01/20/checkpoint-8) confirms both really shipped. [BPO1 boundary block](https://eth.blockscout.com/api/v2/blocks/23975778) and [BPO2 boundary block](https://eth.blockscout.com/api/v2/blocks/24179383) match the configured timestamps; each predecessor is 12 seconds earlier. The completion report alone says early January, so the exact day depends on the setting plus ledger and completion evidence together. |
| EIP-7892 sample configuration | [EIP-7892](https://eips.ethereum.org/EIPS/eip-7892) explicitly says its example schedules are illustrative. Its example timestamps must not be copied as real mainnet dates. Mainnet dates above come from the official activation table and observed blocks. |

## Event-by-event source ledger

### 2015-07-30 — 프런티어 메인넷 출시

**Claim:** 이더리움의 첫 공개 메인넷 버전인 프런티어가 출시됐다. 당일 재단 발표는 제네시스 블록을 생성·불러오며 첫 운영 버전이 시작됐다고 확인한다. 출시일과 제네시스 헤더의 숫자 타임스탬프는 구분한다.

**Date basis:** 당일 완료 발표와 공식 이력이 공통으로 확인한 출시일을 사용한다. 블록 1도 같은 UTC 날짜에 채굴됐지만 이를 출시 순간과 동일시하지 않는다.

**Cross-check:** 당일 재단의 출시 완료 발표와 공식 회고 이력을 대조하고, 별도 탐색기의 블록 0·1로 제네시스 타임스탬프의 예외와 첫 채굴 날짜를 확인했다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Ethereum Launches](https://blog.ethereum.org/2015/07/30/ethereum-launches) — Ethereum Foundation | contemporaneous-completion | 당일 게시물은 프런티어 첫 운영 버전이 막 시작됐다고 보고한다. |
| [Timeline of all Ethereum forks — Frontier](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Frontier의 메인넷 적용일을 2015-07-30로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 0 — JSON record](https://eth.blockscout.com/api/v2/blocks/0) — Blockscout / Ethereum mainnet ledger | genesis-header-caveat | 실행 블록 0의 헤더 시각 1970-01-01T00:00:00Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 1 — JSON record](https://eth.blockscout.com/api/v2/blocks/1) — Blockscout / Ethereum mainnet ledger | first-mined-block-corroboration | 실행 블록 1의 헤더 시각 2015-07-30T15:26:28Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 제네시스 실행 블록 0의 헤더 timestamp는 0(1970-01-01T00:00:00Z)이다. 이를 출시 날짜로 변환하지 않는다. 블록 1의 관측 시각은 2015-07-30T15:26:28Z이다. 공식 이력에 표시된 출시 시각 15:26:13과 별개이므로 사건의 초 단위 시각을 확정하지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다.

### 2016-03-14 — 홈스테드 업그레이드

**Claim:** 홈스테드가 적용돼 이더리움의 초기 프로토콜과 계약 실행 규칙이 개선됐다. EIP-2·EIP-7·EIP-8을 포함한 두 번째 주요 릴리스다. 계약의 DELEGATECALL과 프로토콜·네트워크 호환성 변경이 포함됐다.

**Date basis:** 공식 메인넷 적용 블록 1,150,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Homestead Release](https://blog.ethereum.org/2016/02/29/homestead-release) — Ethereum Foundation | activation-announcement | 메인넷 블록 1,150,000과 EIP-2·7·8의 포함을 공지했다. 게시일은 적용일이 아니다. |
| [Timeline of all Ethereum forks — Homestead](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Homestead의 메인넷 적용일을 2016-03-14로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 1,150,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/1150000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 1,150,000의 헤더 시각 2016-03-14T18:49:53Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 일부 지역 달력의 3월 15일과 혼동하지 않도록 실제 블록 헤더의 UTC 날짜 3월 14일을 사용한다.

### 2016-07-20 — DAO 대응 하드포크

**Claim:** DAO 사건에 대응한 상태 변경 하드포크가 메인넷에 적용됐다. 재단은 블록 1,920,000에서 포크가 완료돼 DAO 관련 자금이 복구 계약으로 이전됐다고 보고했다. 포크를 채택하지 않은 체인은 Ethereum Classic으로 이어졌다.

**Date basis:** 공식 메인넷 적용 블록 1,920,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Hard Fork Completed](https://blog.ethereum.org/2016/07/20/hard-fork-completed) — Ethereum Foundation | contemporaneous-completion | 블록 1,920,000에서 DAO 복구 하드포크 완료와 자금 이전을 명시한다. |
| [Timeline of all Ethereum forks — DAO fork](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | DAO fork의 메인넷 적용일을 2016-07-20로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 1,920,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/1920000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 1,920,000의 헤더 시각 2016-07-20T13:20:40Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. DAO 공격 자체가 발생한 날과 복구 하드포크 적용일을 다른 사건으로 구분한다.

### 2017-10-16 — 비잔티움 업그레이드

**Claim:** 비잔티움이 적용돼 계약 오류 처리와 암호 연산 기능이 확장됐다. REVERT·STATICCALL과 거래 영수증의 성공·실패 상태가 추가됐다. 영지식 증명에 활용할 수 있는 타원곡선 연산도 도입됐다.

**Date basis:** 공식 메인넷 적용 블록 4,370,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Byzantium HF Announcement](https://blog.ethereum.org/2017/10/12/byzantium-hf-announcement) — Ethereum Foundation | activation-announcement | 블록 4,370,000과 REVERT·STATICCALL·상태 영수증·암호 연산을 공지했다. |
| [Timeline of all Ethereum forks — Byzantium](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Byzantium의 메인넷 적용일을 2017-10-16로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 4,370,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/4370000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 4,370,000의 헤더 시각 2017-10-16T05:22:11Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 공지의 예상 적용 시각 12:00–13:00 UTC 대신 실제 헤더 시각 05:22:11 UTC를 사용한다.

### 2019-02-28 — 콘스탄티노플·상트페테르부르크

**Claim:** 콘스탄티노플과 상트페테르부르크가 같은 블록에서 적용됐다. EVM 비트 이동 명령과 CREATE2·EXTCODEHASH가 도입됐다. 상트페테르부르크는 테스트넷에 먼저 적용된 EIP-1283을 되돌리는 변경을 함께 처리했다.

**Date basis:** 공식 메인넷 적용 블록 7,280,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Ethereum Constantinople/St. Petersburg Upgrade Announcement](https://blog.ethereum.org/2019/02/22/ethereum-constantinople-st-petersburg-upgrade-announcement) — Ethereum Foundation | activation-announcement | 두 업그레이드를 블록 7,280,000에서 함께 적용하며 EIP-145·1014·1052 및 EIP-1283 제외를 설명한다. |
| [Timeline of all Ethereum forks — Constantinople](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Constantinople의 메인넷 적용일을 2019-02-28로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 7,280,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/7280000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 7,280,000의 헤더 시각 2019-02-28T19:52:04Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 취소된 이전 적용 예정일이나 사전 테스트넷 적용일을 메인넷 완료일로 사용하지 않는다. 같은 블록의 두 이름은 하나의 사건으로 묶는다.

### 2019-12-08 — 이스탄불 업그레이드

**Claim:** 이스탄불이 적용돼 EVM 가스 비용과 계약 실행 기능이 조정됐다. CHAINID 명령과 Blake2 연산이 추가되고 calldata·타원곡선 연산·상태 접근 관련 가스 규칙이 변경됐다.

**Date basis:** 공식 메인넷 적용 블록 9,069,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Ethereum Istanbul Upgrade Announcement](https://blog.ethereum.org/2019/11/20/ethereum-istanbul-upgrade-announcement) — Ethereum Foundation | activation-announcement | 메인넷 적용 블록은 9,069,000이다. 12월 7일은 당시의 예상 날짜라고 명시한다. |
| [EIP-1679: Hardfork Meta: Istanbul](https://eips.ethereum.org/EIPS/eip-1679) — Ethereum Improvement Proposals | protocol-specification | 메인넷 적용 블록과 EIP-152·1108·1344·1884·2028·2200을 명세한다. |
| [Timeline of all Ethereum forks — Istanbul](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Istanbul의 메인넷 적용일을 2019-12-08로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 9,069,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/9069000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 9,069,000의 헤더 시각 2019-12-08T00:25:09Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 사전 공지는 12월 7일을 예상했지만 실제 블록은 12월 8일 00:25:09 UTC에 생성됐다. 예상 날짜를 사용하지 않는다.

### 2020-12-01 — 비콘체인 가동

**Claim:** 지분증명 합의 체계인 비콘체인이 가동을 시작했다. 비콘체인은 이후 Merge를 위한 합의 계층을 구성했다. 이 시점에 기존 실행 메인넷의 작업증명이 곧바로 종료된 것은 아니다.

**Date basis:** 공식 genesis 공지와 12월 9일의 완료 회고가 함께 확인한 12월 1일을 사용한다. 실제 합의 블록 헤더를 직접 읽지 못했으므로 날짜 정밀도로 제한한다.

**Cross-check:** 사전 genesis 공지와 당시 개발 책임자가 기고한 사후 완료 보고를 대조했다. 같은 재단 자료이고 직접 합의 노드 검증은 없으므로 독립 검증의 한계를 남긴다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [eth2 quick update no. 21](https://blog.ethereum.org/2020/11/27/eth2-quick-update-no-21) — Ethereum Foundation | genesis-announcement | 비콘체인 genesis 시각 1606824023(2020-12-01 12:00:23 UTC)을 공지했다. |
| [EF-Supported Teams: Research & Development Update](https://blog.ethereum.org/2020/12/09/ef-supported-teams-research-and-development-update-2020-pt-2) — Ethereum Foundation | retrospective-completion | Eth2 Research 절은 12월 1일 비콘체인 출시를 완료된 사건으로 확인한다. |
| [Timeline of all Ethereum forks — Beacon Chain genesis](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Beacon Chain genesis의 메인넷 적용일을 2020-12-01로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 비콘체인 genesis는 실행체인 블록 0과 다르다. 실행 블록 번호를 임의로 배정하지 않는다. 공식 genesis 시각은 보조 사실이며 독립적으로 확인한 합의 블록 시각으로 표시하지 않는다.

### 2021-04-15 — 베를린 업그레이드

**Claim:** 베를린이 적용돼 거래 형식과 상태 접근 가스 규칙이 개선됐다. 형식이 구분된 거래 봉투와 선택적 접근 목록이 도입됐다. ModExp 및 처음 접근하는 주소·저장소에 대한 가스 계산도 조정됐다.

**Date basis:** 공식 메인넷 적용 블록 12,244,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Ethereum Berlin Upgrade Announcement](https://blog.ethereum.org/2021/03/08/ethereum-berlin-upgrade-announcement) — Ethereum Foundation | activation-announcement | 블록 12,244,000 및 EIP-2565·2718·2929·2930의 역할을 공지했다. |
| [Timeline of all Ethereum forks — Berlin](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Berlin의 메인넷 적용일을 2021-04-15로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 12,244,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/12244000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 12,244,000의 헤더 시각 2021-04-15T10:07:03Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다.

### 2021-08-05 — 런던과 EIP-1559 적용

**Claim:** 런던이 적용돼 기본 수수료 소각을 포함한 새 거래 수수료 구조가 도입됐다. EIP-1559는 기본 수수료와 우선 수수료를 구분하고 기본 수수료를 소각한다. 새 거래 형식은 사용자가 최대 수수료와 최대 우선 수수료를 지정할 수 있게 했다.

**Date basis:** 공식 메인넷 적용 블록 12,965,000의 실제 헤더 시각을 UTC 날짜로 변환했다. 공지 게시일이나 당시의 예상 날짜를 사용하지 않는다.

**Cross-check:** 공식 공지의 적용 블록·기능, ethereum.org의 완료 이력, 별도 운영자인 Blockscout의 해당 블록 시각·해시를 대조했다. 공식 문서 간 독립성은 제한적이지만 원장 관측은 별도 경로다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [London Mainnet Announcement](https://blog.ethereum.org/2021/07/15/london-mainnet-announcement) — Ethereum Foundation | activation-announcement | 메인넷 블록 12,965,000에서 EIP-1559를 포함한 London 적용을 공지했다. |
| [EIP-1559: Fee market change for ETH 1.0 chain](https://eips.ethereum.org/EIPS/eip-1559) — Ethereum Improvement Proposals | protocol-specification | 기본 수수료의 소각과 우선 수수료를 구분하는 거래 수수료 규칙을 정의한다. |
| [Timeline of all Ethereum forks — London](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | London의 메인넷 적용일을 2021-08-05로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 12,965,000 — JSON record](https://eth.blockscout.com/api/v2/blocks/12965000) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 12,965,000의 헤더 시각 2021-08-05T12:33:42Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다.

### 2021-10-27 — 알테어 비콘체인 업그레이드

**Claim:** 비콘체인의 첫 주요 업그레이드인 알테어가 적용됐다. 동기화 위원회를 통한 경량 클라이언트 지원과 검증자 벌칙 조정이 포함됐다. 당시 작업증명 실행체인의 계정·계약 상태를 바꾸는 업그레이드는 아니었다.

**Date basis:** 공식 공지의 epoch 74,240과 공식 완료 이력이 확인한 UTC 날짜를 사용한다. 합의 블록 헤더를 직접 조회하지 못했으므로 블록 시각 정밀도로 승격하지 않는다.

**Cross-check:** 사전 공지의 epoch·날짜·영향 범위와 ethereum.org의 완료 이력·기능 설명이 일치한다. 두 문서는 같은 생태계의 공식 자료이며 합의 탐색기 API는 인증 필요로 별도 검증하지 못했다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Altair Mainnet Announcement](https://blog.ethereum.org/2021/10/05/altair-announcement) — Ethereum Foundation | activation-announcement | epoch 74,240, 2021-10-27 10:56:23 UTC의 합의 계층 적용을 공지하며 기존 작업증명 실행 상태에는 영향을 주지 않는다고 구분한다. |
| [Timeline of all Ethereum forks — Altair](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Altair의 메인넷 적용일을 2021-10-27로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 실행 블록 번호가 아닌 비콘체인 epoch를 기준으로 한 업그레이드다. epoch 시작 시각은 공식 설정값이며 이 조사에서 독립 조회한 최초 합의 블록 시각은 아니다.

### 2022-09-15 — Merge: 지분증명 전환

**Claim:** 이더리움 실행 메인넷이 작업증명에서 지분증명 합의로 전환됐다. 9월 6일 Bellatrix 준비 단계 뒤, 마지막 작업증명 블록의 누적 난이도가 기준을 넘었다. 그 다음 실행 블록 15,537,394부터 비콘체인 검증자가 블록을 생성했다.

**Date basis:** 첫 지분증명 실행 블록 15,537,394의 관측 헤더 시각 06:42:59 UTC를 사용한다. 직전 작업증명 블록의 06:42:42 또는 이후 최종화 시각과 구분한다.

**Cross-check:** 공식 전환 규칙과 두 연속 실행 블록을 대조했다. 직전 블록의 누적 난이도가 TTD 이상이고 다음 블록의 difficulty가 0이며 부모 해시가 연결된다. 자체 합의 재실행이나 최종화 시각 측정은 하지 않았다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Mainnet Merge Announcement](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement) — Ethereum Foundation | transition-specification | Bellatrix·Paris의 두 단계, TTD 기준 58750000000000000000000, 기준 도달 다음 블록의 PoS 생성 및 이후 최종화 구분을 설명한다. |
| [Timeline of all Ethereum forks — Paris (The Merge)](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Paris (The Merge)의 메인넷 적용일을 2022-09-15로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 15,537,393 — JSON record](https://eth.blockscout.com/api/v2/blocks/15537393) — Blockscout / Ethereum mainnet ledger | terminal-proof-of-work-block | 실행 블록 15,537,393의 헤더 시각 2022-09-15T06:42:42Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 15,537,394 — JSON record](https://eth.blockscout.com/api/v2/blocks/15537394) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 15,537,394의 헤더 시각 2022-09-15T06:42:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 공식 이력 표제의 06:42:42는 직전 작업증명 블록 15,537,393과 일치한다. 표제의 시각과 옆에 표시된 블록 15,537,394를 그대로 결합하지 않는다. 첫 PoS 블록 생성과 합의 최종화는 다른 순간이다. 이 기록은 첫 PoS 실행 블록을 기준으로 한다.

### 2023-04-12 — 샤펠라: 스테이킹 인출

**Claim:** 상하이·카펠라가 적용돼 비콘체인 스테이킹 인출이 가능해졌다. 실행 계층 Shanghai와 합의 계층 Capella가 함께 적용돼 검증자의 전액·일부 인출을 지원했다.

**Date basis:** epoch 적용 조건 이후 처음 관측된 실행 블록 17,034,870의 22:27:59 UTC를 날짜 기준으로 사용한다. 공식 epoch 시작 22:27:35와 구분한다.

**Cross-check:** 공식 epoch 시각과 완료 이력을 확인하고, 부모 블록 17,034,869(22:27:23)·후속 블록 17,034,870(22:27:59)의 시각 및 해시 연결로 적용 경계를 대조했다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Mainnet Shapella Announcement](https://blog.ethereum.org/2023/03/28/shapella-mainnet-announcement) — Ethereum Foundation | activation-announcement | epoch 194,048, 2023-04-12 22:27:35 UTC의 적용 조건과 전액·일부 스테이킹 인출을 설명한다. |
| [Timeline of all Ethereum forks — Shanghai-Capella (Shapella)](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Shanghai-Capella (Shapella)의 메인넷 적용일을 2023-04-12로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 17,034,869 — JSON record](https://eth.blockscout.com/api/v2/blocks/17034869) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 17,034,869의 헤더 시각 2023-04-12T22:27:23Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 17,034,870 — JSON record](https://eth.blockscout.com/api/v2/blocks/17034870) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 17,034,870의 헤더 시각 2023-04-12T22:27:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 공식 epoch 시작은 22:27:35이나 실제 첫 후속 실행 블록은 22:27:59이다. 두 시각의 차이는 다른 UTC 날짜를 뜻하지 않는다.

### 2024-03-13 — 덴쿤: 블롭 데이터 도입

**Claim:** 덴쿤이 적용돼 롤업 데이터를 위한 블롭 거래가 도입됐다. Cancun·Deneb의 결합 업그레이드는 EIP-4844를 포함한다. 블롭은 롤업 데이터를 임시로 게시하기 위한 별도 데이터 형식이다.

**Date basis:** 공식 완료 이력의 epoch 조건 및 첫 적용 실행 블록 19,426,587의 실제 헤더 13:55:35 UTC를 대조해 날짜를 정했다.

**Cross-check:** 공식 적용 epoch·포함 기능과 완료 이력을 대조했다. 부모 실행 블록은 13:55:23, 첫 적용 블록은 13:55:35이며 부모 해시가 연결된다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Dencun Mainnet Announcement](https://blog.ethereum.org/2024/02/27/dencun-mainnet-announcement) — Ethereum Foundation | activation-announcement | 메인넷 epoch 269,568의 2024-03-13 적용과 EIP-4844 블롭 도입을 공지했다. |
| [Timeline of all Ethereum forks — Cancun-Deneb (Dencun)](https://ethereum.org/ethereum-forks/) — ethereum.org | retrospective-history | Cancun-Deneb (Dencun)의 메인넷 적용일을 2024-03-13로 기록한다. 초 단위 시각은 별도 원장 관측값을 우선한다. |
| [Ethereum execution block 19,426,586 — JSON record](https://eth.blockscout.com/api/v2/blocks/19426586) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 19,426,586의 헤더 시각 2024-03-13T13:55:23Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 19,426,587 — JSON record](https://eth.blockscout.com/api/v2/blocks/19426587) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 19,426,587의 헤더 시각 2024-03-13T13:55:35Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다.

### 2025-05-07 — 펙트라 업그레이드

**Claim:** 펙트라가 적용돼 계정 기능·검증자 운영·블롭 용량이 확장됐다. EIP-7702는 일반 계정의 코드 위임을 지원하고, EIP-7251은 선택적으로 검증자의 최대 유효 잔액을 2,048 ETH로 늘렸다. 블롭 목표·최대치도 6·9개로 조정됐다.

**Date basis:** 공식 완료 문서와 epoch 시작 10:05:11 UTC, 실행 블록 22,431,084의 실제 헤더 시각이 일치한다.

**Cross-check:** 사전 공지와 별도 완료 문서, 부모 블록 10:04:59 및 적용 블록 10:05:11의 원장 관측을 대조했다. 공지·완료 문서는 같은 공식 생태계 자료다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Pectra Mainnet Announcement](https://blog.ethereum.org/2025/04/23/pectra-mainnet) — Ethereum Foundation | activation-announcement | epoch 364,032, 2025-05-07 10:05:11 UTC와 계정 코드 위임·검증자 유효 잔액·블롭 변경을 공지했다. |
| [Prague-Electra (Pectra)](https://ethereum.org/roadmap/pectra/) — ethereum.org | retrospective-completion | 2025-05-07 epoch 364,032에서 메인넷 적용이 성공했다고 확인한다. |
| [Ethereum execution block 22,431,083 — JSON record](https://eth.blockscout.com/api/v2/blocks/22431083) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 22,431,083의 헤더 시각 2025-05-07T10:04:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 22,431,084 — JSON record](https://eth.blockscout.com/api/v2/blocks/22431084) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 22,431,084의 헤더 시각 2025-05-07T10:05:11Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 계정 기능은 프로토콜 지원을 뜻하며 모든 지갑이 자동으로 해당 기능을 사용하게 됐다는 뜻은 아니다.

### 2025-12-03 — 푸사카: PeerDAS 도입

**Claim:** 푸사카가 적용돼 데이터 가용성 표본 추출 방식인 PeerDAS가 도입됐다. Fulu·Osaka 업그레이드는 블롭 데이터의 가용성을 표본으로 확인하는 PeerDAS와 블롭 매개변수만 조정하는 BPO 업그레이드 체계를 포함했다.

**Date basis:** epoch 시작 21:49:11 UTC 이후 첫 관측 실행 블록 23,935,694의 21:49:23 UTC를 날짜 기준으로 사용한다.

**Cross-check:** 사전 공지·사후 완료 문서를 대조하고, 부모 블록 21:48:59와 첫 후속 블록 21:49:23의 해시 연결을 확인했다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Fusaka Mainnet Announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — Ethereum Foundation | activation-announcement | 메인넷 slot 13,164,544, 2025-12-03 21:49:11 UTC, PeerDAS·BPO 체계를 공지했다. |
| [Fulu-Osaka (Fusaka)](https://ethereum.org/roadmap/fusaka/) — ethereum.org | retrospective-completion | 2025-12-03 메인넷 적용 완료를 확인한다. |
| [Ethereum execution block 23,935,693 — JSON record](https://eth.blockscout.com/api/v2/blocks/23935693) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 23,935,693의 헤더 시각 2025-12-03T21:48:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 23,935,694 — JSON record](https://eth.blockscout.com/api/v2/blocks/23935694) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 23,935,694의 헤더 시각 2025-12-03T21:49:23Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. epoch 조건 시각 21:49:11과 실제 첫 후속 실행 블록 21:49:23은 구분한다. 블롭 목표·최대치의 후속 BPO 변경은 별도 날짜의 사건이며 푸사카 당일에 미리 적용된 것으로 합치지 않는다.

### 2025-12-09 — BPO1: 블롭 용량 조정

**Claim:** BPO1가 적용돼 블록당 블롭 목표가 10개, 최대치가 15개로 조정됐다. 푸사카에 포함된 블롭 매개변수 전용 업그레이드다. 공식 후속 보고가 두 BPO의 실제 완료를 확인했으며, 목표·최대치는 블록마다 실제 사용된 블롭 수와 다르다.

**Date basis:** 공식 BPO1 설정 시각 2025-12-09T14:21:11Z와 같은 시각의 실행 블록 23,975,778을 확인하고, 사후 공식 완료 보고로 계획만 존재하는 사건이 아님을 확인했다.

**Cross-check:** 예정 설정표만으로 완료를 추정하지 않고, 2026-01-20 공식 완료 보고와 설정 경계 양쪽의 연속 실행 블록 시각·부모 해시를 대조했다. 두 공식 문서의 조직적 독립성은 제한적이다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Fusaka Mainnet Announcement — BPO schedule](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — Ethereum Foundation | activation-announcement | BPO1의 epoch 412,672, UTC 시각 2025-12-09T14:21:11Z, 블롭 목표 10·최대 15을 공지했다. |
| [Checkpoint #8: Jan 2026](https://blog.ethereum.org/2026/01/20/checkpoint-8) — Ethereum Foundation | retrospective-completion | 첫 두 BPO가 실제 적용됐고, 두 번째는 1월 초에 완료됐으며 목표 14·최대 21개가 됐다고 회고 확인한다. |
| [Ethereum execution block 23,975,777 — JSON record](https://eth.blockscout.com/api/v2/blocks/23975777) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 23,975,777의 헤더 시각 2025-12-09T14:20:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 23,975,778 — JSON record](https://eth.blockscout.com/api/v2/blocks/23975778) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 23,975,778의 헤더 시각 2025-12-09T14:21:11Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 사후 완료 보고는 BPO1의 시기를 푸사카 며칠 뒤라고 표현한다. 정확한 일시는 사전 고정된 적용 설정 및 해당 시각의 연속 원장 블록과 함께 판단했다. 블록 헤더 시각만으로 모든 노드의 설정 적용을 증명하지 않는다. 적용 완료·목표·최대치는 공식 사후 보고와 설정표를 근거로 한다.

### 2026-01-07 — BPO2: 블롭 용량 조정

**Claim:** BPO2가 적용돼 블록당 블롭 목표가 14개, 최대치가 21개로 조정됐다. 푸사카에 포함된 블롭 매개변수 전용 업그레이드다. 공식 후속 보고가 두 BPO의 실제 완료를 확인했으며, 목표·최대치는 블록마다 실제 사용된 블롭 수와 다르다.

**Date basis:** 공식 BPO2 설정 시각 2026-01-07T01:01:11Z와 같은 시각의 실행 블록 24,179,383을 확인하고, 사후 공식 완료 보고로 계획만 존재하는 사건이 아님을 확인했다.

**Cross-check:** 예정 설정표만으로 완료를 추정하지 않고, 2026-01-20 공식 완료 보고와 설정 경계 양쪽의 연속 실행 블록 시각·부모 해시를 대조했다. 두 공식 문서의 조직적 독립성은 제한적이다.

| Source and publisher | Role | Supports |
| --- | --- | --- |
| [Fusaka Mainnet Announcement — BPO schedule](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement) — Ethereum Foundation | activation-announcement | BPO2의 epoch 419,072, UTC 시각 2026-01-07T01:01:11Z, 블롭 목표 14·최대 21을 공지했다. |
| [Checkpoint #8: Jan 2026](https://blog.ethereum.org/2026/01/20/checkpoint-8) — Ethereum Foundation | retrospective-completion | 첫 두 BPO가 실제 적용됐고, 두 번째는 1월 초에 완료됐으며 목표 14·최대 21개가 됐다고 회고 확인한다. |
| [Ethereum execution block 24,179,382 — JSON record](https://eth.blockscout.com/api/v2/blocks/24179382) — Blockscout / Ethereum mainnet ledger | preceding-execution-block | 실행 블록 24,179,382의 헤더 시각 2026-01-07T01:00:59Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |
| [Ethereum execution block 24,179,383 — JSON record](https://eth.blockscout.com/api/v2/blocks/24179383) — Blockscout / Ethereum mainnet ledger | observed-execution-block | 실행 블록 24,179,383의 헤더 시각 2026-01-07T01:01:11Z, 블록 해시와 부모 해시를 확인했다. 업그레이드 내용은 별도 공식 명세·공지로 검증한다. |

**Limits:** 서로 다른 공식 문서도 Ethereum Foundation·ethereum.org 생태계 자료이므로 완전히 독립된 두 기관의 검증으로 세지 않는다. 블록 관측은 별도 운영자의 Blockscout 인덱스를 조회한 결과이며, 자체 노드로 합의·실행 규칙을 재검증한 결과는 아니다. 사후 완료 보고는 BPO2의 시기를 1월 초라고 표현한다. 정확한 일시는 사전 고정된 적용 설정 및 해당 시각의 연속 원장 블록과 함께 판단했다. 블록 헤더 시각만으로 모든 노드의 설정 적용을 증명하지 않는다. 적용 완료·목표·최대치는 공식 사후 보고와 설정표를 근거로 한다.

## Completion boundary at 2026-10-24

Pectra and Fusaka are completed, based on their official retrospective pages and observed execution records. Both BPO1 and BPO2 are completed according to the January 20, 2026 protocol-team retrospective. This catalog makes no claim that every protocol maintenance operation has been collected.

**Glamsterdam is excluded as a completed mainnet event.** The [October 22, 2026 EF update](https://blog.ethereum.org/2026/10/22/glamsterdam-hoodi-delay) says the Hoodi testnet activation previously scheduled for October 26 was postponed and a new date was not set. The [October 16 announcement, updated October 22](https://blog.ethereum.org/2026/10/16/glamsterdam-hoodi-announcement), explicitly lists mainnet as TBD. A successful Sepolia testnet upgrade does not establish mainnet completion. No inspected source established completed-mainnet activation of Hegotá, so it is likewise excluded. No inferred future mainnet date is manufactured.

The [January 20 Checkpoint](https://blog.ethereum.org/2026/01/20/checkpoint-8) discusses a possible third BPO as a future consideration. The reviewed source set did not establish a completed additional BPO with an exact date; none is fabricated.

Difficulty-bomb-only forks (Muir Glacier, Arrow Glacier, Gray Glacier) are omitted from this focused milestone set. Bellatrix is described as the preparatory stage inside the Merge record instead of receiving a second marker for the same transition narrative. The DAO exploit and the later DAO hard fork must remain separate security/protocol events if both categories are integrated. Earlier network attacks and other non-targeted maintenance forks can be added after the same source/date review; this is not a claim to be a complete Ethereum fork registry.

## Retrieval limits and reproducibility

Etherscan HTML was unavailable to the research client (403). Blockscout block HTML was a JavaScript shell, so the public `/api/v2/blocks/{height}` JSON endpoint supplied the inspected ledger fields. Beaconcha.in public API requests for consensus history required authorization (401); no attempt was made to bypass that requirement. This is why Altair and Beacon genesis retain calendar-day precision. Public Blockscout timestamp-to-block lookups helped locate the BPO boundaries; the final citations point directly to the resolved block records and their predecessors.

Receipts contain observed timestamps, height, hash, parent hash, and a few returned numeric fields. Pre-fork fields populated with zero by an explorer are not used to infer that a later protocol feature existed historically. No full node was run, no blocks were replayed, and no consensus finalization time was independently measured.

The catalog is date-sorted, has unique IDs, uses only `protocol` category, gives every event at least two separately inspectable source documents, and explicitly records precision and evidence limitations. Integration should convert `facts.block`, `facts.utcTimestamp`, and `facts.blockHash` into display fields only for `block-timestamp` records; it must not convert an auxiliary scheduled epoch time into an observed timestamp.
