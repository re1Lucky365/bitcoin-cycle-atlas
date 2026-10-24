# 독립 실행 HTML 패키징 점검

## 결과

같은 입력 파일로 만든 비압축 HTML 크기가 **46,329,219 → 8,201,994바이트**, **82.30% 감소**했다. 변경 전·후를 번갈아 각각 다섯 번 빌드했고, 각 방식의 다섯 결과는 SHA-256까지 동일했다. 실패는 0건이다. 이는 파일 크기 비교이며 브라우저의 로딩 시간·메모리·페인트 속도를 측정한 결과가 아니다.

입력 기준 커밋은 `7e90d01bda8552cd68db688542c9ebb8e9bb7085`다. 이 커밋은 v1.20.0에 이번 점검의 데이터 검증 및 재무 계산 성능 수정을 더한 상태다. v1.20.0 릴리스 파일과 새 파일을 직접 비교한 수치가 아니다. 후속 재무·상태·버전 수정으로 최종 배포 파일 크기는 달라질 수 있다.

측정 원본과 모든 입력 파일·생성기 해시는 [`data/standalone-size-2026-10-24.json`](data/standalone-size-2026-10-24.json)에 보존했다.

## 원인과 선택

이전 `inlineModule`은 모듈의 전체 소스를 base64 URL로 만들고, 그 URL 문자열을 모든 상위 모듈의 import 문 안에 복사했다. 파일별 URL을 캐시해도 여러 의존 경로에 포함되는 문자열 복사는 사라지지 않았다. 상위 모듈을 다시 base64로 감싸면서 중복도 다시 커졌다.

새 생성기는 각 물리적 모듈을 한 번만 인코딩하고, 하나의 import map에 저장한다. 모듈의 import 대상은 짧은 `@atlas/...` 이름으로 바뀐다. import map은 첫 module script보다 먼저 등록한다. 이 구조는 공유 의존성을 반복 삽입하지 않으며 순환 그래프도 생성할 수 있다. 표준 근거는 [HTML Standard의 import maps](https://html.spec.whatwg.org/multipage/webappapis.html#import-maps)와 [모듈 해석 알고리즘](https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier)이다.

기존의 `javascriptModuleSpecifiers` 호출 규약은 유지했다. 추가한 `javascriptModuleReferences`는 같은 토큰 스캐너에서 문자열의 시작·끝 위치를 돌려준다. 문자열 위치만 뒤에서부터 치환하여 일반 문자열·주석·정규식·템플릿의 설명문을 보존하고, static import, side-effect import, re-export, 문자열 리터럴 dynamic import를 처리한다. 외부·bare 의존성은 독립 실행 패키지에서 명시적으로 거부한다.

`?version`과 `#fragment`는 패키징할 때 같은 물리적 파일로 합친다. 이는 이전 생성기의 동작이며 이번에 확대한 규칙이 아니다. 배포 사이트의 일반 모듈 로딩 방식에는 영향을 주지 않는다. 계산된 dynamic import 경로를 추측하거나 일반 JavaScript 번들러를 구현하지 않았다. 현재 앱의 dynamic import 세 개는 모두 문자열 리터럴이다.

다른 선택도 검토했다. 재귀 data URL 구조에서 문자열 캐시만 더해도 최종 HTML의 중복은 없어지지 않는다. 별도 번들러 의존성을 도입하거나 연구 자료·관측치를 덜 넣는 방식은 이번 문제를 해결하는 데 필요하지 않았다. 기존 브라우저 모듈 구조를 유지하는 import map을 선택했다.

## 보존 검증

새 `verifyStandaloneArtifact`는 생성기 함수를 재실행해서 같은 결과인지 묻는 대신, 실제 HTML을 해체하여 원본 `dist` 파일과 비교한다.

| 검사 | 측정 입력에서 확인한 결과 |
|---|---:|
| 포함된 모듈 | 93개 |
| literal import·re-export 연결 | 228개 |
| 원본 모듈 소스 | 2,885,449바이트 |
| 짧은 import 이름으로 치환한 모듈 소스 | 2,883,804바이트 |
| 내장 JSON 스냅샷 | 6개, 전체 내용 동일 |
| 내장 CSS | 22개, 기존 외부 폰트 import 제거 규칙 외 내용 동일 |
| favicon | 원본 바이트 동일 |
| BTC 관측값 | 5,942개 |

각 모듈에서 import 문자열 사이의 모든 소스를 원본과 정확히 비교한다. 각 import의 실제 대상 파일이 같은지, 모든 대상이 import map에 존재하는지, entry에서 도달할 수 없는 모듈이 추가되지 않았는지도 검사한다. 연구 요약·허용된 원문·모형 공식은 이 소스 비교에 포함된다. 여섯 데이터 스냅샷은 일부 행이나 수량만 비교하지 않고 전체 JSON을 비교한다.

이 검사는 기존 `verify-static.mjs --standalone` 경로에 연결했다. 현재 CI, Pages 검사, 데이터 새로고침 검사, 릴리스 패키징은 이미 이 명령을 실행하므로 별도 workflow 변경 없이 새 검사도 수행한다.

## 실행한 검사

- 새 패키징 회귀 검사 **6건 통과**.
- 기존 모듈 스캐너·Pages 참조 검사 **8건 통과**.
- 실제 생성한 HTML을 Node v24.22.1의 `SourceTextModule`로 해체하여 **93개 모듈 모두 구문 분석 및 링크 성공**. 이 파서는 자체 토큰 스캐너와 독립적이다.
- 별도 작은 모듈 그래프를 실제로 평가하여 순환 참조, side effect, re-export, 한 번만 평가되는 공유 모듈, lazy dynamic import, 같은 파일의 version/hash 별칭을 확인했다.
- 모듈 연결 하나 삭제, 모듈 본문 변경, BTC 가격 하나 변경, import map 삭제를 각각 적용하면 보존 검사가 실패했다.
- 현재 생성물의 정적 경로·데이터·CSS 검사 통과: 파일 635개, 참조 268개.

재현 명령:

```sh
node tests/standalone-packaging.test.mjs
node tests/static-module-references.test.mjs
node scripts/build-standalone.mjs build/Bitcoin_Cycles_Comparison.html
node scripts/verify-static.mjs --standalone build/Bitcoin_Cycles_Comparison.html
node --experimental-vm-modules tests/helpers/standalone-runtime.mjs artifact build/Bitcoin_Cycles_Comparison.html
node scripts/measure-standalone-size.mjs
```

마지막 명령은 정확한 기준 커밋의 이전 생성기와 현재 생성기에 같은 `dist` 입력을 주고, 변경 전·후를 각각 다섯 번 빌드한다. 소스가 후속 변경된 체크아웃에서는 해당 체크아웃의 입력과 새 결과를 기록한다. 역사적 수치를 재현하려면 위 기준의 `dist`를 사용하고 측정 JSON의 생성기 해시를 맞춰야 한다.

## 검증의 경계

Node VM 검사는 실제 JavaScript 모듈의 문법·연결·평가를 확인하지만 브라우저의 import-map HTML 처리, CORS 또는 `file://` 정책을 재현하지 않는다. 이 작업에서는 브라우저에서 파일을 직접 여는 검사를 완료했다고 주장하지 않는다. 최종 배포의 브라우저 검사는 별도의 릴리스 검증 기록으로 남긴다.

새 HTML은 native import map을 지원하는 브라우저가 필요하다. 브라우저 전체 로딩 지연, 압축 후 전송량, 특정 모바일 기기의 메모리 한계는 측정하지 않았다. 새 포장 방식으로 자료를 줄이거나 시장 예측 정확도를 높였다는 주장은 하지 않는다.

pstack의 `benchmark-checklist`, `principle-fix-root-causes`, `principle-prove-it-works`를 적용했다. 실제 사용한 모델은 GPT-6 Astra이며, 사용할 수 없는 다른 모델이나 검증 도구를 실행한 것으로 기록하지 않았다.
