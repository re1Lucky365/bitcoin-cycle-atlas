# BMNR: ETH 수량보다 주당 잔여가치가 중요하다

> Atlas가 작성한 연구 요약·검토 보관본. 원문 전체 복제본이 아닙니다.

- 원제: ETH treasury, staking and dilution sensitivity: BMNR
- 글쓴이: Bitcoin Cycle Atlas Research
- 발행자: Atlas · 자체 연구
- 발행일: 2026-10-24
- 검토·수집 기록: 2026-10-24
- 종목: BMNR
- 분류: method
- 접근 상태: original-research
- 원문: https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_ASSET_PATHS.md#bmnr
- 원문 위치: 페이지 본문 또는 아래 제한 참조

## 본문 · 연구 요약

기본 자산 연동 모드는 Merge 이후 ETH 수익률의 28일 블록으로 일별 경로를 만들고 세 경제 조건에 같은 잔차를 적용한다. BTC의 4년 주기를 강제하지 않는다. ETH 가격·주당 보유량·스테이킹·비용·우선주 부담은 각각 계산한다. 같은 5월 말 재무 수치에 공시된 최초 BMNP 발행만 가정 조정해 최근 주가에 정규화하며 현재 NAV를 주장하지 않는다. 기존 목표 연결 모드는 비교용으로 남고, 톰 리의 날짜 없는 BMNR 목표에 임의의 달성일을 붙이지 않는다.

## 주장과 교차 확인

### 스테이킹 수익률과 보통주 수익률은 다르다.

판정: fact

적용 대상 ETH 비율, 수수료, 손실, 운영비, 우선배당과 희석을 거쳐야 한다.

대조 자료: [bmnr-staking-protocol](./bmnr-staking-protocol.md), [bmnr-staking-fee-reset-2026](./bmnr-staking-fee-reset-2026.md), [bmnr-preferred-2026](./bmnr-preferred-2026.md)

### ETH $22,000이면 BMNR $300–500이라는 설명

판정: conditional

회사 공개 메시지에 있는 조건부 주장이다. 미래 주식 수·청구권·시장 배수의 완전한 산식이 공개되지 않아 검증된 등식으로 채택하지 않는다.

대조 자료: [bmnr-october-message-2026](./bmnr-october-message-2026.md)

### 2030년 ETH $360·가격 유지·$22,000은 앱이 선택한 세 기준선 조건이다.

판정: conditional

$360은 VanEck 2024의 약세 조건, $22,000은 원문의 기준 조건을 앱의 확대 조건으로 사용한 것이다. 현재 가격 유지와 2030년 이후 기준선 고정은 앱 가정이다. 대표 경로의 실제 도착 가격은 강제하지 않는다.

대조 자료: [model-eth-valuation](./model-eth-valuation.md), [eth-merge-eip-3675](./eth-merge-eip-3675.md)

## 한계와 반대 조건

- 80% 스테이킹·추가 비용 10%·연 운영비 $50m 등은 사용자가 살펴볼 수 있는 분석자 가정이다.
- 보고된 7일 연환산 수익률이 앞으로 유지된다는 보장은 없다. 비용 범위가 불명확해 추가 비용 차감이 중복될 수 있다.
- 최근 90일 변동성 유지와 잔차의 730일 반감 평균회귀는 추정하거나 예측 성과로 검증한 계수가 아닌 앱 가정이다.
- 2030 이후 기준선만 고정하고 자산 연동 모드의 잔차는 계속 변한다. 세 조건은 공유 잔차를 쓴 각각의 경로이며 확률 표본·신뢰구간이 아니다.
- 같은 날짜의 UTC 코인 종가와 뉴욕 주식 종가는 동시 시각이 아니다. 재무 빈티지에 포함된 영업권·제한 담보·비유동 투자는 청산가치와 다를 수 있다.

## 이미지·동영상 기록

별도 미디어 URL을 확보하지 않았습니다. 미디어가 없다는 의미는 아닙니다.

## 관련 링크

- [기초자산 경로 · ETH 관측 범위·seed·잔차 가정](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_ASSET_PATHS.md>)
- [자산 연동 재무 모형 · 조건별 일별 계산](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_PATH_MODEL.md>)
- [공시 기반 재무 항등식과 기존 목표 연결 방법](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_MODEL.md#bmnr>)

## 푸터 · 보존 범위

원문·이미지·영상의 권리는 각 권리자에게 있습니다. 직접 작성한 요약·분석과 출처 메타데이터를 보존합니다.

외부 링크가 사라져도 이 연구 요약과 인용 정보는 열람할 수 있습니다. 원문 전체와 외부 미디어 파일의 보존을 뜻하지 않습니다.

원문 전체: 미보관. 이미지·영상 파일: 미보관. 보존 대상: 제목·글쓴이·날짜·출처·직접 작성한 본문·판정·미디어 링크·이 보존 고지.
