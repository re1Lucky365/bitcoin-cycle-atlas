# 시스템 변경 독립 검토 기록

## 최종 판정

**PASS. 독립 검토에서 확정한 P2 수치 경계 결함 두 건을 수정한 뒤 다시 검증했다.** 캐시 재사용 및 숨긴 월별 표의 지연 생성 변경에서는 확정 결함을 찾지 못했다. 이 판정은 아래 파일과 실행 범위에 한정한다.

기준 commit은 `64c8207cb044d8990289c5a7d39972e21b74c240`이다. 기준 트리는 `/tmp/bitcoin-cycle-atlas-audit-base-64c8207`이며 검토 대상은 그 commit 위의 작업 트리다. 독립 검토자는 런타임 코드를 수정하지 않았고, 반례를 통합 담당에게 전달했다. 런타임 수정과 회귀 추가는 통합 담당이 수행했다. 이 기록과 독립 검증기 및 receipt만 검토자가 작성했다. Commit과 push는 수행하지 않았다.

최종 실행 결과는 [독립 수치 검토 receipt](data/system-independent-review-2026-10-25.json)에 있다. 재실행 도구는 [verify-system-independent-review.mjs](../scripts/verify-system-independent-review.mjs)다. 작성자의 기존 PASS나 수치 비교 횟수를 독립 검토의 결과로 복사하지 않았다.

## 발견하고 닫은 결함

### IR-01. 양의 subnormal 가격 비율에서 로그 정보 손실

**P2. 허용된 유한 양수 입력의 계산 오류이며 실제 BTC 자료에서 관측된 오류라는 주장은 하지 않는다.** 기존 `logReturn`은 나눗셈 결과가 양수이고 유한하면 그 결과에 바로 `Math.log`를 적용했다. 양의 subnormal 값은 이미 큰 상대 반올림 오차를 포함할 수 있다. `Number.MIN_VALUE / 1.5`는 `Number.MIN_VALUE`로 반올림되므로 분모 1.5의 정보가 로그에 전달되지 않았다.

다음 공개 함수 호출로 재현했다.

```js
aggregateCloseBars([
  ['2024-01-31', 1.5],
  ['2024-02-01', Number.MIN_VALUE],
  ['2024-02-02', 2 * Number.MIN_VALUE],
], { frequency: 'monthly' })[1].realizedVolPct;
```

| 값 | 수정 전 | 독립 오라클 | 수정 후 |
|---|---:|---:|---:|
| 실현 변동성, % | 1006619.5475112874 | 1007167.3007092287 | 1007167.300709229 |
| `fibonacciLevels(MIN_VALUE, 1.5, {ratios:[.5], scale:'log'})` 가격 | 3.334138124227676e-162 | 2.722312378772685e-162 | 2.722312378772685e-162 |
| 1.5 고점에서 MIN_VALUE 저점으로 확정된 swing의 현재 가격 1에 대한 로그 되돌림 | 1 | 0.9994556386687565 | 0.9994556386687565 |

변동성 오라클은 원래 두 가격 로그의 차와 두 수익률의 표본 표준편차를 사용했다. 로그 중점 오라클은 `exp((log(MIN_VALUE) + log(1.5)) / 2)`다. 수정 전 로그 중점의 상대 가격 오차는 약 22.4745%였다. 이 helper는 새 `logReturn`뿐 아니라 기존 `logPriceRatio`에도 같은 경계를 갖고 있어 두 공개 결과에서 확인했다.

최종 수정은 나눗셈 결과가 정상수인 `ratio >= 2 ** -1022`일 때 기존 경로를 유지하고, subnormal·0·Infinity이면 원래 피연산자의 로그 차를 사용한다. `logPriceRatio`는 가까운 가격의 `log1p` 경로를 유지하고 나머지 경우에 같은 helper를 사용한다. 최종 공개 함수 실행값이 독립 오라클과 일치하거나 지정한 상대 허용 오차 `2e-12` 안에 들어갔다.

### IR-02. 표현 가능한 최대 경계 Theil–Sen 기울기의 잘못된 거절

**P2. 새 안정식의 분자 overflow 처리에 남아 있던 중간 반올림 결함이다.** 다음 입력은 수학적 결과가 `Number.MAX_VALUE` 이하인데도 `RangeError`를 발생시켰다.

```js
theilSenTrend([
  { x: 0, value: -1.771930152577346e308 },
  { x: 1.9560493706715358, value: 1.744446372530627e308 },
]);
```

두 binary64 입력을 Python `Fraction`으로 정확한 유리수로 변환한 결과는 다음과 같다.

```text
exactSlope = 1.797693134862315703660804726557566614785199394899803372559000622390330e308
exactSlope <= Number.MAX_VALUE = true
correctlyRounded = 1.7976931348623157e308
before = RangeError: Theil–Sen slope exceeds the finite numeric range
after = 1.7976931348623157e308
```

기존 fallback인 `y2 / denominator - y1 / denominator`는 각각 나눈 값의 반올림을 합치면서 Infinity가 됐다. 최종 수정은 `(y2 / 2 - y1 / 2) / (denominator / 2)`로 먼저 크기를 줄이고 나눗셈을 한 번 수행한다.

같은 원인의 독립 반례 세 개를 최종 코드에서 확인했다. 검증기는 `DataView`로 binary64의 부호·가수·지수를 읽어 BigInt 유리수를 구성한다. 각 정확한 기울기가 MAX 이하이고, MAX와 바로 전 표현값 사이 중점보다 크다는 사실을 정수 연산으로 확인한다. 따라서 예상 MAX는 테스트 대상 함수에서 얻은 상수가 아니다. 세 사례 모두 MAX로 복구됐고 `(-MAX, MAX)`를 거리 1로 나눈 실제 표현 불가 사례는 계속 거절됐다.

탐색 단계에서 100,000개의 혼합 극단값 조합을 Python 정확한 유리수 계산과 비교했다. 무작위 탐색에서는 이 결함을 찾지 못했다. MAX 근처에 목적을 둔 탐색이 반례를 찾았다. 수정 방식의 추가 경계 탐색 200,000회에서는 정확한 값이 MAX 이하인데 Infinity로 거절되는 사례를 찾지 못했다. 유한한 탐색 결과이며 모든 IEEE-754 입력의 증명으로 취급하지 않는다.

## 새로 실행한 수학·논리 검증

최종 독립 검증기는 다음 내용을 실제 공개 함수에 적용한다. 아래 숫자는 함수 호출·비교 횟수이며 독립적인 시장 표본 수가 아니다.

| 검증 | 새 근거 | 결과 |
|---|---|---|
| 달력 이동 | 0000–0400년과 세기·최대 연도 경계의 각 월말, -25/-13/-1/0/1/13/25개월. 프로덕션의 정수 월 계산과 다른 native UTC Date 조작으로 오라클 구성 | 34,356개 경우 PASS |
| 결측 집계 | 80개 생성 시계열의 전체 달력일을 직접 열거해 빠진 날짜 집합 계산. 명시 목록 유무의 출력 전체 비교 | 80개 시계열 PASS |
| 이전 기간 말일 누락 | 연도·월 기간의 실제 baseline부터 마지막 관측 또는 지나간 기간 말일까지 누락 날짜를 직접 열거 | 1,451개 기간 PASS |
| 일별 인과성 | 관측 prefix로 다시 계산한 행 전체를 긴 입력의 같은 prefix와 비교. 200일 평균과 유효 신호가 실제 존재하는 연속 구간 및 중간 결측 포함 | 325회 비교 PASS |
| rolling state 인과성 | 일봉·주봉 각각 다섯 cutoff. 장기 평균과 warmup 이외 국면이 실제 생성되는 500일 입력에 중간 누락을 삽입 | 10회 비교 PASS |
| 정상 범위 출력 | 서로 다른 파형의 180일 시계열 12개. 일별 분석, 두 주기의 rolling 결과, 주·월·분기·4년 bar 전체를 기준 코드와 `deepEqual` 비교 | 12개 입력 모두 동일 |
| 극단값 공개 결과 | IR-01의 변동성·로그 중점·현재 로그 되돌림과 IR-02의 정확한 유리수 경계 | 모두 PASS |

다음 scoped 회귀도 직접 실행해 exit 0을 확인했다.

```sh
node --test tests/system-numerical-regressions.test.mjs \
  tests/daily-data-performance.test.mjs \
  tests/structure-view-performance.test.mjs
```

이 환경의 출력은 테스트 파일 3개에 대해 `pass 3`, `fail 0`을 보고했다. 내부 사례 수로 확대해서 기재하지 않는다. `git diff --check`도 통과했다. 전체 npm 테스트, build, TLC 및 성능 벤치는 이 reviewer가 중복 실행하지 않았다.

## 캐시 및 표시 동등성 검토

새 하위 reviewer가 두 뷰의 최적화를 분리해서 검토했다. 기존 회귀 실행 외에 현재와 기준 `initDailyDataView`를 같은 조작 순서로 구동하여 표시 snapshot 17개를 직접 비교했다. ETH 로딩 중 월별 보기와 BTC 전환, 선택된 BMNR이 미완료인 상태의 다른 asset 늦은 완료, BMNR 오류 뒤 재시도, 비동기 완료 전 지표 변경, 동일 날짜 가격을 가진 새 BTC 객체로 두 차례 교체, `destroy()` 뒤 늦은 완료가 모두 포함됐다. 두 구현의 표시 결과가 같았다.

비교뷰는 RAF 실행 전에 데이터 객체를 두 차례 교체하고 threshold를 변경한 뒤, 마지막 데이터와 threshold로 분석이 한 번만 실행되는지 확인했다. 실제 재사용되는 상태 배열과 행을 `Object.freeze`한 채 일봉·주봉 각각 네 scope에서 여덟 번 재그림을 수행했다. 숨긴 비교뷰에서 데이터와 threshold를 변경하고 다시 열었을 때도 새 결과가 나왔다. 총 chart 호출 12회에서 오류는 0이었다.

코드 흐름도 일치한다. 일별 상세의 변경은 현재 `detail`이 monthly인 경우에만 markup을 만드는 조건이며 별도의 행렬 캐시가 추가되지 않았다. 비교뷰의 `setDataset()`은 새 객체에서 분석과 준비 데이터를 지우고, `structure()`는 threshold에 따라 분석을 갱신한다. SVG 소비 경로는 상태 배열을 읽고 파생 배열을 만든다. 동일 객체 내부를 직접 변경한 뒤 다시 전달하는 경우의 no-op은 기존 identity 계약이며 이번 변경에서 생긴 제한이 아니다.

## 성능 주장 검토

[성능 보고서](SYSTEM_PERFORMANCE_AUDIT_2026_10_25.md), [측정 receipt](data/system-performance-audit-2026-10-25.json), [프로파일 receipt](data/system-performance-profiles-2026-10-25.json)와 측정 스크립트를 읽었다. 하위 reviewer는 원시 표본으로 양쪽 7회씩의 중앙값·최솟값·최댓값을 다시 계산했고 저장 summary와 일치했다. 모든 표본의 오류가 0이고 양쪽 표시 결과 hash가 같았다. 현재 네 원자료, 벤치마크, 두 fixture 및 두 뷰 파일의 hash도 receipt와 일치했다.

보고서는 기준 JavaScript 의존성에 두 수정 뷰만 덮어쓴 격리 측정임을 명시한다. 따라서 일별 페이지 이동의 70.83% 감소와 비교 재그림의 85.11% 감소는 두 변경의 Node JavaScript 경로에 대한 기존 측정이다. 이 reviewer가 새로 측정한 수치가 아니다. 실제 controller·분석·SVG 생성·출력 소비는 수행하지만 inert DOM 경계로 인해 HTML parsing, layout, paint, 네트워크 및 모바일 프레임 시간은 포함하지 않는다. 비교 첫 분석은 범위가 겹쳐 개선을 입증한 항목에서 제외했다. 이런 범위 한정은 측정 방식과 맞는다.

## 검토 소스 식별

| 최종 실행 파일 | SHA-256 |
|---|---|
| `dist/daily-analytics.js` | `ddd9f4bc3d26f58158093543677aae01bd71b297d2e8d02a427ccdf4d399d512` |
| `dist/cycle-timing.js` | `c4b8ac425d33c65a0c9d059f09e084279fc73c31b1911ea401861dcbf8bf98da` |
| `dist/market-structure.js` | `57c17ba994c673213f0238f07d0a446151b26846bae712becffa489e31f20b69` |
| `dist/daily-data-view.js` | `98c061d833e53180dbcffd42d324a3df3502bac114da7c0d75f8ec5e6c3b2fc4` |
| `dist/lab-view.js` | `229c4e9e7a8b3693c1b6d8b50a0eefa09bf484cf67fde6d0570c1ef2386a23e2` |

추가로 `cycle-engine.js`의 입력 경계, `daily-data-source.js`, `atlas-price-chart.js`와 `price-view-data.js`의 캐시 소비, 신규 수치 회귀 및 독립 계산기, daily/structure 성능 테스트와 fixture, 벤치마크 및 보고서·receipt를 읽었다.

상위 경로와 저장소에서 AGENTS.md를 확인했으나 발견하지 못했다. pstack 공식 clone의 기준은 `9580c23696ac8d7abed0c166f2f9918800afb819`이다. 읽은 `bug-fix`와 `perf-issue` playbook, `benchmark-checklist`를 적용했다. **Prove It Works**는 공개 함수의 반례 재현과 수정 후 실행을 요구하는 결정에 적용했다. **Test Behavior, Not Implementation**은 반환값·표시 snapshot·prefix 결과를 검증 대상으로 택하는 데 적용했다. **Explain the Number**는 기존 성능 수치를 Node 측정 범위로 한정하고 원시 표본·출력·오류·hash를 다시 검토하는 데 적용했다.

## 재현과 미검증 범위

```sh
SYSTEM_REVIEW_BASELINE=/tmp/bitcoin-cycle-atlas-audit-base-64c8207 \
  node scripts/verify-system-independent-review.mjs
```

기준 경로 변수를 생략해도 현재 코드의 달력·결측·인과성·극단값 검증은 실행된다. 이때 기준 코드와의 정상 출력 대조는 생략되며 JSON의 `normalDifferentials`가 빈 배열이다. 제공된 receipt는 기준 경로를 지정하고 실행했다.

실제 브라우저 UI와 접근성, ETH 수명주기 및 TLA+ 모델, 전체 릴리스 build와 패키징은 다른 담당자의 검증 범위다. 이 검토는 그 결과를 대신하지 않는다. 같은 객체를 외부에서 변경하는 행위, 모든 binary64 조합, 모든 가능한 결측·비동기 순서의 완전성도 증명하지 않았다. 미래 가격 정확성, 투자 전략 수익성, 확률 보정 및 경제적 인과성은 검증 대상이 아니다. 최종 PASS는 검토한 코드와 명시한 유한 검증에서 미해결 P0/P1/P2 결함이 없다는 뜻이다.
