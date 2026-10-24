# EIP-3675: 지분증명 전환과 스테이킹 가정의 경계

> Atlas가 작성한 연구 요약·검토 보관본. 원문 전체 복제본이 아닙니다.

- 원제: EIP-3675: Upgrade consensus to Proof-of-Stake
- 글쓴이: Mikhail Kalinin · Danny Ryan · Vitalik Buterin
- 발행자: Ethereum Improvement Proposals
- 발행일: 2021-07-22
- 검토·수집 기록: 2026-10-24
- 종목: ETHUSD, BMNR
- 분류: method
- 접근 상태: verified-primary
- 원문: https://eips.ethereum.org/EIPS/eip-3675
- 원문 위치: Abstract; Specification / Block and ommer rewards; Rationale / Removing block rewards; Security Considerations; Copyright

## 본문 · 연구 요약

Ethereum 실행 계층의 작업증명 검증·포크 선택·블록 보상 규칙을 지분증명 체계에 연결하는 변경을 정한다. 전환 블록 이후 기존 PoW 블록·ommer 보상은 제거되지만 거래 수수료 처리 규칙은 유지된다. 새 PoS 보상은 합의 계층의 별도 명세에 속한다. 이 문서는 BMNR의 스테이킹 배치율·수익률·수수료나 주주 수익률을 확정하지 않는다.

발행일 표시는 제안의 created 날짜다. 이번 복구에서 Final 상태로 변경된 2022-09-20 커밋의 Markdown 전체와 CC0 고지를 확인·보존했다. 이전 실패 대화에서 선택했던 원문과 같은 자료라고 주장하지 않는다.

## 주장과 교차 확인

### 기존 PoW 블록 보상의 제거는 모든 ETH 보상의 제거를 뜻하지 않는다.

판정: fact

전환 명세는 PoW 보상 제거와 새 PoS 체계의 보상 책임을 구별하며 거래 수수료 처리는 유지한다고 규정한다.

대조 자료: [eth-source-2be2a692f09f](./eth-source-2be2a692f09f.md), [bmnr-staking-protocol](./bmnr-staking-protocol.md)

### 프로토콜의 지분증명 전환에서 특정 기업의 연 스테이킹 수익률을 도출할 수 없다.

판정: fact

보유 ETH 중 배치 비율, 운영 비용·수수료·손실·희석과 기간별 실제 보상이 추가로 필요하다. BMNR 시나리오의 각 수치는 공시값 또는 분석자 가정으로 따로 읽는다.

대조 자료: [bmnr-model-method](./bmnr-model-method.md), [bmnr-staking-fee-reset-2026](./bmnr-staking-fee-reset-2026.md)

## 한계와 반대 조건

- 이 문서에 전체 beacon-chain 합의 명세나 현재 검증자 보상률이 들어 있는 것은 아니다.
- 지정 커밋의 명세 보존이며 현재 네트워크·클라이언트의 전체 적합성을 검증한 결과는 아니다.
- 경영진의 ETH·BMNR 목표가격이나 미래 스테이킹 수익률을 뒷받침하는 확정 수익 근거로 쓰지 않는다.

## 이미지·동영상 기록

별도 미디어 URL을 확보하지 않았습니다. 미디어가 없다는 의미는 아닙니다.

## 푸터 · 보존 범위

원문·이미지·영상의 권리는 각 권리자에게 있습니다. 직접 작성한 요약·분석과 출처 메타데이터를 보존합니다.

허용 원문은 별도 [eip-3675](../research-sources/eip-3675.md) 파일로 보관합니다. 라이선스 CC0-1.0 · SHA-256 7345c394b8726383a667b3e5114fa0916410c95de3c1a031663a8e07cbe40e03. 이 파일은 자체 요약입니다.

이 요약 파일에는 원문 전체와 이미지·영상 파일을 포함하지 않습니다. 보존 대상: 제목·글쓴이·날짜·출처·직접 작성한 본문·판정·미디어 링크·이 보존 고지.
