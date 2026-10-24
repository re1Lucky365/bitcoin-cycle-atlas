# MSTR 미래 경로는 어떤 식으로 계산하는가

> Atlas가 작성한 연구 요약·검토 보관본. 원문 전체 복제본이 아닙니다.

- 원제: Treasury residual and financing sensitivity: MSTR
- 글쓴이: Bitcoin Cycle Atlas Research
- 발행자: Atlas · 자체 연구
- 발행일: 2026-10-24
- 검토·수집 기록: 2026-10-24
- 종목: MSTR
- 분류: method
- 접근 상태: original-research
- 원문: https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_ASSET_PATHS.md#mstr
- 원문 위치: 페이지 본문 또는 아래 제한 참조

## 본문 · 연구 요약

기본 자산 연동 모드는 BTC 화면과 같은 관측·seed의 실제 BTC 엔진 경로를 사용한다. 스트레스·기준·확대 조건의 일별 경로를 각각 공시 기반 재무 상태에 통과시켜 발행·희석·금융비용·상환·프리미엄을 계산하고 최근 관측 주가에 정규화한다. 기존 목표 연결 모드는 별도 민감도 비교로 남는다. 세일러의 목표에 기본 경로를 강제로 맞추지 않으며 현재 NAV나 적정 주가를 계산했다는 주장이 아니다.

## 주장과 교차 확인

### 보통주 잔여가치 = 보유 코인 가치 + 현금 + 포함 자산 − 선순위 청구권

판정: fact

전환사채를 차감하는 경우 같은 채권의 전환 주식을 분모에 다시 더하지 않는다.

대조 자료: [mstr-10q-2026q2](./mstr-10q-2026q2.md), [mstr-notes](./mstr-notes.md)

### 순발행 가격이 주당 잔여가치보다 높으면 기존 주주의 자산 비율이 증가할 수 있다.

판정: conditional

발행비용·신규 주식 수·조달 성공·재투자 가격이 결과를 바꾼다. 무조건적인 복리 수익으로 두지 않는다.

대조 자료: [mstr-capital-framework-2026](./mstr-capital-framework-2026.md)

### 기본 경로는 BTC의 세 경제 조건을 일별 재무 계산에 그대로 연결한다.

판정: conditional

MSTR stress/base/bull은 BTC 엔진 stress/base/accelerated와 대응한다. 조건별 대표 경로를 각각 계산하며 조건 범위는 확률 분위수나 전체 손실 경계가 아니다.

대조 자료: [btc-model-method](./btc-model-method.md), [long-wisdomtree-2030](./long-wisdomtree-2030.md), [long-wisdomtree-2050](./long-wisdomtree-2050.md)

## 한계와 반대 조건

- 모델은 추정한 확률분포나 검증된 주가 예측기가 아니다. 같은 날짜의 UTC 코인 종가와 뉴욕 주식 종가는 동시 시각이 아니다.
- 6월 공시 이후 모든 재무 변화를 복원하지 않았다. 최신 NAV는 표시하지 않는다.
- 원금 상환 청구일에는 전액 현금상환하는 조건을 사용한다. 실제 청구·차환·전환은 미정이다.
- 소프트웨어 영업가치, 미래 세금·환율·조건변경을 완전하게 가격화하지 않는다.

## 이미지·동영상 기록

별도 미디어 URL을 확보하지 않았습니다. 미디어가 없다는 의미는 아닙니다.

## 관련 링크

- [기초자산 경로 · BTC 재사용과 ETH 블록 재표본](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_ASSET_PATHS.md>)
- [자산 연동 재무 모형 · 조건별 일별 계산](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_PATH_MODEL.md>)
- [공시 기반 재무 항등식과 기존 목표 연결 방법](<https://github.com/twoimo/bitcoin-cycle-atlas/blob/main/docs/TREASURY_MODEL.md>)

## 푸터 · 보존 범위

원문·이미지·영상의 권리는 각 권리자에게 있습니다. 직접 작성한 요약·분석과 출처 메타데이터를 보존합니다.

외부 링크가 사라져도 이 연구 요약과 인용 정보는 열람할 수 있습니다. 원문 전체와 외부 미디어 파일의 보존을 뜻하지 않습니다.

원문 전체: 미보관. 이미지·영상 파일: 미보관. 보존 대상: 제목·글쓴이·날짜·출처·직접 작성한 본문·판정·미디어 링크·이 보존 고지.
