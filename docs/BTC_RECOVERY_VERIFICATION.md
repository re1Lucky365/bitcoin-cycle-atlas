# BTC 모델 복구 검증

검증일은 2026-10-24이다. 새로 받은 기본 브랜치 `e9c0ecf88aa0016fb6a36d626fb6dfd0702d4260`에서 시작했다. 이전 대화의 파일이나 테스트 실행을 이어받았다고 가정하지 않았다. 이 문서는 이번 실행에서 직접 재현하고 수정한 BTC 계산 경계와 검증 범위를 기록한다.

## 수정한 결함

### 평가 기간 추가로 기존 평가가 바뀌는 문제

[`backtestAnalogueForecast`](../dist/forecast-engine.js)는 요청된 가장 긴 평가 기간을 만족하는 과거 경로를 한 번 고른 뒤 모든 기간에 재사용했다. 따라서 긴 기간에 사용할 수 없는 경로가 짧은 기간에서도 사라졌다.

2019-03-31을 기점으로 실제 고정 테스트 자료를 평가하면 다음과 같이 달라졌다.

| 요청 기간 | 수정 전 90일 평가 수 | 수정 후 90일 평가 수 | 수정 후 90일 절대비율오차 |
|---|---:|---:|---:|
| 90일 | 1 | 1 | 57.95775605668538% |
| 90일, 1,461일 | 0 | 1 | 57.95775605668538% |

더 긴 기간을 함께 요청했다는 이유만으로 기존 결과가 사라지면 같은 모델의 평가를 비교할 수 없다. 반례는 [`forecast-engine.test.mjs`](../tests/forecast-engine.test.mjs)의 `an unavailable longer analogue horizon cannot remove an evaluable short horizon`에 보존했다.

같은 원인은 오차를 더 좋아 보이게 만들기도 했다. 2023-03-31 기점의 90일 평가는 2012·2016년 경로를 쓰면 오차가 30.743597711258055%다. 기존 코드에서는 1,461일 평가를 추가하면 2016년 경로가 짧은 평가에서도 사라져 그 값이 5.399170011090593%로 바뀌었다. 이 두 번째 회귀 사례는 긴 기간의 평가 가능 조건만 만들기 위해 **2027-03-31 가격 50,000을 합성 테스트 입력으로 추가했다**. 그 가격은 관측 자료나 전망치가 아니며 공개 가격 데이터에 기록하지 않았다. 90일 실제 결과는 기존 자료에서 읽는다.

수정 후 각 기간은 독립적으로 사용 가능한 과거 경로를 고른다. 각 결과에 `referenceYears`와 `maxReferenceSourceDate`를 기록한다. 기점 수준의 두 필드는 실제 점수를 계산한 기간들의 합집합과 최종 사용일이다. 계산할 수 없는 긴 기간은 `excluded`에 해당 `horizonDays`를 남기고 짧은 결과를 보존한다. 기본 90·180·365일 평가 수치가 기존 기대값과 일치함도 회귀 검사로 확인했다.

### 달력 범위를 벗어난 잘린 날짜

[`dateFromDay`](../dist/cycle-engine.js)는 안전한 정수 여부만 확인하고 JavaScript 확장 연도 문자열의 첫 10자를 잘랐다. `0000-01-01` 하루 전은 `-000001-12`, `9999-12-31` 하루 뒤는 `+010000-01`이 반환됐다. 두 문자열 모두 앱의 `YYYY-MM-DD` 계약에 맞지 않는다.

수정 후 연도가 0000부터 9999 사이인 날짜만 반환하고 그 밖의 값은 `RangeError`로 거부한다. 범위 양 끝과 0099·0100년 변환을 함께 검사했다. [`cycle-engine.test.mjs`](../tests/cycle-engine.test.mjs)에 실제 실패했던 경계를 보존했다.

### 기준일 필터가 잘못된 날짜를 숨기는 문제

[`buildDetailedForecast`](../dist/detailed-forecast.js)와 [`buildLongHorizonForecast`](../dist/long-horizon-forecast.js)는 입력 날짜를 검증하기 전에 문자열로 기준일과 비교했다. 예를 들어 `['not-a-date', 0]`을 추가하고 `asOf: '2026-10-20'`으로 호출하면 두 함수 모두 그 행을 조용히 버리고 결과를 반환했다. 배열의 빈 슬롯도 `filter`가 건너뛰었다.

수정 후 모든 행의 날짜를 먼저 검증한다. 기준일 뒤의 정상 날짜는 제외하며 그 가격을 학습이나 계산에 사용하지 않는다. 잘못된 날짜, 날짜 필드가 없는 객체, 빈 슬롯은 명시적으로 실패한다. 정상 미래 가격을 추가하거나 바꿔도 고정 기준일 결과가 변하지 않는 기존 검사도 함께 통과했다.

## 실제 실행한 검증

세 결함 모두 실패하는 회귀 검사를 먼저 실행한 뒤 수정했다. 실패 결과는 각각 `Missing expected exception (RangeError)`, 90일 `n: 0` 대 `n: 1`, 그리고 두 모델의 `Missing expected exception (TypeError)`였다.

다음 명령을 새 작업 공간에서 실행했다.

```sh
node --test --test-isolation=none \
  tests/cycle-engine.test.mjs \
  tests/forecast-engine.test.mjs \
  tests/detailed-forecast.test.mjs \
  tests/long-horizon-forecast.test.mjs \
  tests/cycle-calibration.test.mjs \
  tests/cycle-timing.test.mjs \
  tests/market-structure.test.mjs
```

Node.js v24.22.1에서 runner 결과는 76개 통과, 실패 0이었다. 이 76개에는 자체 검사 함수를 쓰는 파일 2개의 runner 항목이 포함된다. 해당 파일은 각각 11개와 12개의 명명된 검사를 출력했다. 파일 항목과 내부 검사 수를 합쳐 새로운 통과 수로 표현하지 않는다.

검사는 과거 정보만 사용하는 고정 기점 계산, 미래 관측 추가 불변성, 씨드 재현성, 달력 기간, 실제 가격과의 시작점 연결, 불완전 주봉, 주기 보정, 평가 누락, 국지 고점·저점의 사후 확인, 발행량 산술을 포함한다. 전체 사이트 통합 검증이나 브라우저 관측 결과로 확대 해석하지 않는다.

기본 브랜치에서 읽은 두 모델 함수의 이전 본문과 수정된 함수를 같은 고정 입력으로 직접 대조했다. 입력은 `tests/fixtures/btc-daily-2026-10-20.json`, `sampleCount: 16`이다. 이전 모듈의 상대 import는 현재 작업 공간의 동일 의존성으로 연결했다. 따라서 이는 정상 입력에서 수정한 함수 본문의 동작 비교이며 전체 과거 배포물을 따로 실행한 검증은 아니다.

```text
buildDetailedForecast: exact deep equality to base e9c0ecf on valid fixture; daily path 1099; asOf 2026-10-20
buildLongHorizonForecast: exact deep equality to base e9c0ecf on valid fixture; daily path 8839; asOf 2026-10-20
```

## 모델 해석의 한계

이 결과는 구현의 일관성과 명시된 계산의 회귀 검증이다. 미래 가격 적중률이나 고점·저점 예측력을 입증하지 않는다. 장기 모델의 기관 평가값은 조건부 가격 기준이고 대표선은 별도의 가정 경로다. 기존 [`MODEL_SCOPE.md`](MODEL_SCOPE.md), [`LONG_HORIZON_MODEL.md`](LONG_HORIZON_MODEL.md), [`LONG_HORIZON_RESEARCH.md`](LONG_HORIZON_RESEARCH.md)의 구분을 유지한다.

작은 수의 반감기 시대와 서로 겹치는 평가 기간을 독립 표본처럼 셀 수 없다. 이번 수정은 평가 기간끼리 경로 선택을 오염시키던 결함을 제거하지만, 선택한 역사 기점의 사후성이나 미래 시장 구조의 불확실성을 제거하지 않는다.

## 적용한 pstack 절차와 실제 실행 환경

`poteto-mode`, `session-pickup`, `bug-fix`, `how`, `architect`, `tdd` 및 관련 원칙 문서를 직접 읽었다. **Boundary Discipline**은 검증을 모델 입력과 날짜 변환 경계에 두는 결정에 적용했다. **Test Behavior, Not Implementation**은 기간을 추가해도 기존 결과가 같아야 한다는 외부 관찰 가능한 불변식으로 검사를 작성하는 데 적용했다. **Prove It Works**는 이전 보고 대신 새 실패 재현과 수정 후 실행을 남기는 데 적용했다.

실행은 이 세션에서 제공된 상속 모델의 병렬 담당 에이전트와 Node 도구로 수행했다. Cursor의 전용 `Task`, Grok, Claude Opus, Bugbot을 실행하지 않았다. 수정 내용과 검증 결과는 조정 담당자에게 전달하며 이 담당 에이전트는 원격 쓰기, 커밋, PR, 배포를 수행하지 않았다.
