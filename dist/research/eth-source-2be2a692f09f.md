# EIP-1559: 수수료 소각은 ETH 가격 보장이 아니다

> Atlas가 작성한 연구 요약·검토 보관본. 원문 전체 복제본이 아닙니다.

- 원제: EIP-1559: Fee market change for ETH 1.0 chain
- 글쓴이: Vitalik Buterin · Eric Conner · Rick Dudley · Matthew Slipper · Ian Norden · Abdelhamid Bakhta
- 발행자: Ethereum Improvement Proposals
- 발행일: 2019-04-13
- 검토·수집 기록: 2026-10-24
- 종목: ETHUSD, BMNR
- 분류: method
- 접근 상태: verified-primary
- 원문: https://eips.ethereum.org/EIPS/eip-1559
- 원문 위치: Abstract; Specification; Security Considerations / ETH Burn Precludes Fixed Supply; Copyright

## 본문 · 연구 요약

기본 수수료는 블록 사용량에 따라 조정되고 소각되며, 우선 수수료는 블록 생산자에게 돌아간다. 따라서 소각량은 블록 공간 수요에 민감하다. 이 제안은 ETH의 순공급이 항상 감소한다거나 가격·스테이킹 수익률·BMNR 주가가 상승한다고 보장하지 않는다. 원문의 보안 고려 절도 발행과 소각의 상대 크기에 따라 인플레이션과 디플레이션이 달라질 수 있음을 명시한다.

발행일 표시는 제안의 created 날짜다. 이번 복구에서 2023-10-04 수정 커밋의 Markdown 전체와 CC0 고지를 확인·보존했다. 웹사이트 화면·연결 문서·미디어를 복제한 것은 아니다.

## 주장과 교차 확인

### 기본 수수료 소각과 검증자의 수입은 같은 항목이 아니다.

판정: fact

원문은 기본 수수료와 우선 수수료를 구분한다. 합의 전환 뒤의 보상 체계는 EIP-3675 및 별도 합의 명세와 함께 읽어야 한다. 원문에 남은 miner 표현은 이 제안의 역사적 작성 맥락이다.

대조 자료: [eth-merge-eip-3675](./eth-merge-eip-3675.md)

### 수수료 소각만으로 ETH의 고정 공급·디플레이션·목표 주가를 확정할 수 없다.

판정: fact

원문이 공급 경로의 수요 의존성을 명시한다. ETH 가격, BMNR 보유량, 비용·희석·평가 배수는 별도 모델 입력이다.

대조 자료: [bmnr-model-method](./bmnr-model-method.md), [model-eth-valuation](./model-eth-valuation.md)

## 한계와 반대 조건

- 프로토콜 규칙의 확인이며 실제 소각량이나 가격 효과의 추정·실증 검증이 아니다.
- 이 EIP와 다른 Ethereum EIP를 독립 기관의 교차검증 두 건으로 세지 않는다.
- 보관 원문은 지정 커밋의 단일 Markdown 파일 전체다. 참조 코드 실행이나 네트워크 합의 검증을 수행한 결과는 아니다.

## 이미지·동영상 기록

별도 미디어 URL을 확보하지 않았습니다. 미디어가 없다는 의미는 아닙니다.

## 푸터 · 보존 범위

원문·이미지·영상의 권리는 각 권리자에게 있습니다. 직접 작성한 요약·분석과 출처 메타데이터를 보존합니다.

허용 원문은 별도 [eip-1559](../research-sources/eip-1559.md) 파일로 보관합니다. 라이선스 CC0-1.0 · SHA-256 4460ad966a22d8501e12d75165c2c784c61748d8128229f115ebac1bfccac59f. 이 파일은 자체 요약입니다.

이 요약 파일에는 원문 전체와 이미지·영상 파일을 포함하지 않습니다. 보존 대상: 제목·글쓴이·날짜·출처·직접 작성한 본문·판정·미디어 링크·이 보존 고지.
