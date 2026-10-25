# ETH 형식 검증 스킬 독립 검토 · 2026-10-25

## 판정

**PASS — 최초 검토에서 발견한 모델 대응 및 검증기 누락을 수정한 뒤 독립 재실행을 완료했다.** 수정 모델의 여섯 invariant, 실제 초기화 회귀 17개, 실제 코드 변이 9개, 복원 후 재실행, 공식 pstack 상태전이도 생성·육안 검사를 직접 확인했다. 미해결 검토 지적이나 실행 차단 항목은 없다.

이는 아래 해시의 코드와 유한 모델에 대한 판정이다. 모든 JavaScript, 무제한 요청, 실제 브라우저 스케줄러 또는 가격 계산의 정확성을 증명한다는 뜻은 아니다. 통합·전체 빌드·성능 측정은 이 검토의 작업 범위에 포함하지 않았다.

## 검토 기준과 독립성

- 시작 HEAD 및 불변 baseline: `64c8207cb044d8990289c5a7d39972e21b74c240`.
- 커밋된 runtime 동기화 revision: [`1ad3be543e870e74f10708c266f19572b217d25f`](https://github.com/twoimo/bitcoin-cycle-atlas/commit/1ad3be543e870e74f10708c266f19572b217d25f). 아래 추가 확인에서 실제 GitHub 내용과 검토 파일의 일치를 확인했다.
- 검토 브랜치: `audit/system-integrity-2026-10-25`. 검토 명령은 위 baseline 이후 수정이 있는 작업 트리에서 실행했다. 검토자는 commit/push를 수행하지 않았다.
- 프로젝트 지침을 먼저 검색했고, 적용할 별도 `AGENTS.md`는 발견되지 않았다. 프로젝트 README, 기존 market/equity 검증 스킬, 새 `verify-eth-state` 스킬과 그 참조 문서를 읽었다.
- 구현자의 완료 보고를 근거로 통과 처리하지 않았다. 새 스킬을 읽은 뒤 명령을 실행하고, 실제 코드·fixture·TLA+를 대조하여 문제를 전달했다. 수정 이후에도 검증 명령, baseline 및 변이 재생, 상태전이도를 별도로 다시 실행했다.
- 검토자는 제품·모델·스킬·회귀 파일을 수정하지 않았다. 문제 수정은 구현 담당자가 수행했다. 이 문서와 임시 검토 증거만 작성했다.
- Java/Node 하위 프로세스가 필요한 검증은 실행 허용 환경에서 실제로 완료했다. `EPERM`, 파일명만 나오는 요약 또는 생략된 테스트를 통과로 세지 않았다.

### 최종 검토 파일 해시

| 파일 | SHA-256 |
| --- | --- |
| `dist/eth-view.js` | `bd57616e5ed9515fb876e93bf12d8ff4cf185825465e4e82c0b86b5dde47ab5d` |
| `dist/index.html` | `4a04aa5d656bd0959a268574619b91c0d174dcab5334f3e2dc9edb19291b483f` |
| `verification/eth-state/EthLoad.tla` | `5eefd16b990ed9b9bc9e2061df51af3a460a80be2005d110b68b61aa50116979` |
| `scripts/verify-eth-state.mjs` | `76b4aa1531e4069218b913106f39bc885bb0f72fbaba10114141d02d361fdb8c` |
| `tests/eth-load-ownership.test.mjs` | `b248796055e6333dfe8f5e6ecaa189081e1daf887db5ba62a0f78056e87b8ca9` |
| `tests/helpers/eth-view-fixture.mjs` | `2812e578796657d01c7a88930d684a80e33f02cf6fdab874c69e9f4380ab4030` |

`docs/formal-eth/statechart/inputs-sha256.json`의 15개 입력을 모두 다시 계산하여 일치함을 확인했다. 기존 `verify-market-state`가 기록한 `dist/market-data-controller.js` 해시 `5de1c4b3396551ae71400516f26d35fb6737b0bdad74fcdec403342b2c9991db`도 현재 파일과 일치했다. 커밋 동기화 메타데이터는 이 내용 해시와 대조할 수 있으며, 커밋 이름을 기록하는 것만으로 검증 범위가 확대되지는 않는다.

### 커밋된 runtime 동기화 추가 확인

GitHub의 정확한 commit ref를 지정해 commit·Git tree·파일 내용을 직접 읽었다. Commit `1ad3be543e870e74f10708c266f19572b217d25f`의 parent는 위 baseline이고, root tree는 `dc6aaee7f10301c5a443d785d72a4d40cc82785d`, `dist` tree는 `9621c18472bb6ee8c5201dfbeddd0393ad654241`였다. 해당 커밋에서 변경된 제품 파일 27개 모두에 대해 로컬 원문의 Git blob SHA-1과 byte 크기를 계산하여 GitHub tree의 값과 일치함을 확인했다.

`dist/eth-view.js`와 `dist/index.html`은 해당 ref에서 base64로 받은 전체 내용을 디코딩하여 로컬 검토 파일과 바이트 단위로도 대조했다. 각각 24,319바이트와 46,206바이트였으며, Git blob SHA는 `cedd387c7cddca10f75b7bb945cb5f635ccf4f45`와 `cae35d13c9206cf7ebf7105daea71dbe4dc40ab0`였다. SHA-256도 위 표의 `bd57616e…` 및 `4a04aa5d…`와 정확히 일치했다. 따라서 동기화 revision은 검토한 ETH 수정과 boot 내용을 포함한다.

이 추가 확인은 커밋 식별과 내용 동일성에 관한 메타데이터 확인이다. 모델·회귀를 새로 실행한 것으로 세지 않았으며, 아래의 기존 테스트 수치와 판정은 그대로 유지했다.

### 사용한 도구

| 항목 | 직접 확인한 값 |
| --- | --- |
| Node | `v24.22.1` |
| Java | OpenJDK `17.0.20` |
| 공식 pstack checkout | `9580c23696ac8d7abed0c166f2f9918800afb819` |
| TLC 배포 | `1.7.4`; 내장 checker 표시는 TLC2 `2.19`, revision `5a47802` |
| TLC jar SHA-256 | `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88` |

## 최초 검토에서 발견하고 해소한 문제

| 최초 지적 | 직접 확인한 근거 | 최종 처리와 재확인 |
| --- | --- | --- |
| 실제 코드에 없는 즉시 loading guard를 모델이 사용 | 처음 모델의 `Refresh`는 `~s.loading`을 요구했다. 실제 `load()`와 refresh callback에는 이 guard가 없고 버튼의 `disabled`는 다음 `render()`에서 바뀐다 | 모델 guard를 제거하여 준비된 연결 페이지에서 연속 refresh를 허용했다. 새 회귀와 최종 TLC를 재실행했다 |
| navigation 대응 줄번호가 실제 writer를 가리키지 않음 | 기존 문서의 94–95, 102, 112는 현재 navigation callback·reset writer의 위치가 아니었다 | callback 90–91, reset 98, history focus 106 및 관련 writer로 TLA+ 주석·대응표를 교정했다 |
| history focus의 await 후 쓰기 경로가 충분히 설명되지 않음 | `focusHistoricalEvent()`의 102–103행 await 뒤 106행이 range·price domain·navigation revision을 쓴다 | 실제 jump 활성 조건, 캐시된 daily 전환, microtask 경계, `ChangeInterval` 다음 `Pan`이라는 과대근사, 제외 범위를 문서화했다. 재현 가능한 제품 결함으로 단정하지 않았다 |
| 전체 테스트 개수만으로는 skip을 배제할 수 없음 | 최초 검증기는 정상 종료와 `tests 16`만 확인했다. 이는 skipped case가 있는 성공 종료를 자동으로 거부하지 않는다 | TAP plan과 tests/pass/fail/skipped/cancelled/todo를 모두 검사한다. 실제 테스트 하나를 건너뛴 임시 복사본을 독립 실행하여 거부됨을 확인했다 |

연속 refresh 반례는 검증 모델의 누락이었다. 제품 코드의 최신 응답 소유권은 이미 올바르게 동작했다. 로드된 fixture에서 frame을 실행하기 전에 `refresh(); refresh();`를 호출하면 두 live request가 생성되고 첫 요청의 signal이 abort된다. 두 번째 응답의 종가 `104`를 반영한 뒤 첫 응답이 늦게 도착해도 `104`가 유지됐다. 이 경로가 최종 17개 회귀에 포함됐다.

최초 모델은 9,712개 생성 상태·2,021개 고유 상태를 탐색했다. 이 수치만으로 검토를 마치지 않았다. 누락된 refresh 순서를 추가한 최종 모델은 11,109개 생성 상태·2,243개 고유 상태를 탐색하여 같은 속성을 유지했다.

## 실행 명령과 실제 기계 결과

프로젝트 스킬의 명령을 저장소 루트에서 그대로 실행했다. 최종 독립 실행은 다음과 같다.

```sh
node scripts/verify-eth-state.mjs /tmp/eth-cold-review/final-verification.json
```

종료 상태는 `0`이었다. 독립 receipt의 모델·실행 결과가 `docs/formal-eth/verification.json`과 일치했다. 아래 수치는 구현자의 예상치가 아니라 이 실행의 출력에서 읽었다.

### TLC 결과

| 실행 | 실제 결과 | 생성 상태 | 고유 상태 | 남은 queue |
| --- | --- | ---: | ---: | ---: |
| current, 여섯 invariant | PASS | 11,109 | 2,243 | 0 |
| baseline / TypeOK | PASS | 14,969 | 3,503 | 0 |
| baseline / ReadyHasUsableView | 의도한 invariant 위반 | 36 | 23 | 13 |
| baseline / NoHiddenPublication | 의도한 invariant 위반 | 31 | 21 | 12 |
| baseline / NoStalePublication | PASS | 14,969 | 3,503 | 0 |
| baseline / NavigationSurvivesRefresh | 의도한 invariant 위반 | 268 | 145 | 87 |
| baseline / ReadinessOnce | PASS | 14,969 | 3,503 | 0 |
| unguarded-response / NoStalePublication | 의도한 invariant 위반 | 14 | 8 | 3 |
| unguarded-error / NoStalePublication | 의도한 invariant 위반 | 15 | 9 | 4 |
| hidden-render / NoHiddenPublication | 의도한 invariant 위반 | 31 | 21 | 12 |
| lost-navigation / NavigationSurvivesRefresh | 의도한 invariant 위반 | 289 | 160 | 103 |

실패 variant는 대응하는 `Invariant … is violated` 메시지를 확인한다. 위반을 발견하고 멈춘 실행의 남은 queue는 전체 탐색 완료를 뜻하지 않으며, current의 queue 0과 구분했다. Java 오류나 timeout을 기대 위반으로 인정하지 않았다.

### 실제 production initializer 재생

fixture는 전체 `initEthView()` 및 실제 `dist/index.html`의 `atlas-boot-script`를 실행한다. private `load()`나 `render()`를 복사해 다시 구현하지 않는다. archive parser, range helper 및 intraday controller는 실제 모듈을 사용한다. import·DOM·렌더러·HTTP·timer·animation-frame 경계는 주입한다.

| 실행 | 종료 | tests | pass | fail | skipped | cancelled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 최종 현재 모듈 | 0 | 17 | 17 | 0 | 0 | 0 |
| 불변 baseline 모듈 | 1 | 17 | 10 | 7 | 0 | 0 |
| 임시 복사본 복원 후 | 0 | 17 | 17 | 0 | 0 | 0 |

현재·복원 실행의 `todo`도 0이었다. baseline은 `git show 64c8207cb044d8990289c5a7d39972e21b74c240:dist/eth-view.js`로 가져왔으며, SHA-256은 `7b8ac7aeab902c4c81b7adeccab99b1f699038625d921bdf57b6bc99dc90dba0`였다. 작업 중인 제품 파일을 되돌리지 않고 `ETH_VIEW_SOURCE`로 주입했다. 이는 baseline ETH initializer의 비교이며, 사이트 전체를 과거 버전으로 되돌린 브라우저 검증은 아니다.

baseline의 일곱 실패는 취소된 초기화 이후 복원 화면, 숨김 초기화/resize, 최단 숨김 layout 경로, 최단 취소 초기화 경로, daily refresh 중 새 range 보존, 정보 버튼의 escaper, intraday refresh 중 새 navigation 보존이었다. 정확한 최단 story 세 개와 실제 회귀의 대응은 아래 상태전이도 표에도 기록했다.

### 아홉 실제 코드 변이의 실패 원인

검증기와 별도로 임시 production source에 각 변이를 적용하고 TAP 전문을 수집했다. 모든 실행에서 17개 case가 실행됐고 skipped/cancelled는 0이었다. 아래 pass/fail 수치는 실제 관찰값이다.

| 변이 | pass / fail | 직접 확인한 의도 assertion |
| --- | ---: | --- |
| premature-ready | 10 / 7 | 취소된 초기화가 복원 데이터보다 먼저 boot를 `ready`로 바꿈; 기대 `loading`, 실제 `ready` |
| hidden-render | 16 / 1 | 숨김 초기화 callback이 boot shell을 해제하면 안 된다는 assertion |
| unguarded-archive | 15 / 2 | 취소된 archive가 복원된 가격을 덮음; 기대 종가 `103`, 실제 `102` |
| unguarded-error | 16 / 1 | 취소된 live failure가 현재 status에 실패 상태를 남김 |
| lost-daily-navigation | 16 / 1 | live refresh 뒤 더 최근에 선택한 date range의 start를 보존하지 못함 |
| lost-intraday-navigation | 16 / 1 | 실제 intraday controller refresh 뒤 새 date navigation을 보존하지 못함 |
| untracked-navigation | 16 / 1 | range callback의 revision 증가가 없어 daily refresh가 새 range를 초기화함 |
| repeated-ready | 13 / 4 | 첫 회귀의 event 배열이 `atlas:ready` 한 개 대신 세 개가 됨 |
| missing-escaper | 16 / 1 | 실제 information click에서 undefined HTML escaper를 호출하면 안 된다는 assertion |

`unguarded-archive`의 두 실패 중 하나는 변이로 복원 재조회 자체가 사라져 fixture의 다음 request 접근에서 발생하는 부수적 `TypeError`였다. 이를 소유권 결함의 증거로 세지 않았다. 별도 stale-price 회귀에서 위의 `103` 대 `102` assertion이 실패했기 때문에 의도한 변이 검출은 성립한다.

`repeated-ready`의 검증기 matcher는 일반적인 deep-equal 메시지지만, 독립 TAP에서 실패 위치와 실제 event 배열을 확인했다. 따라서 이번 결과는 무관한 deep-equal 실패를 잘못 인정한 것이 아니다. 추후 테스트 구조가 바뀌면 matcher의 구체성도 다시 확인해야 한다.

### skip을 성공으로 오인하지 않는지 확인

검증기와 회귀 파일을 `/tmp/eth-cold-review/skipped-gate`로 복사하고, 변이 대상이 아닌 `ETH refresh failure retains valid observed prices and is recoverable` 한 case만 `test.skip`으로 바꿨다. 원본 저장소 파일은 변경하지 않았다.

실제 Node 출력은 `1..17`, tests 17, pass 16, fail 0, skipped 1, cancelled 0, todo 0이었다. 강화된 검증기는 `assertTestRun()`의 `counts.skipped === 0` 검사에서 종료 `1`로 거부했다. 파일명이나 전체 case 수만으로 성공 처리하지 않는다는 점을 실제 실행으로 확인했다.

## 모델과 실제 코드의 대응

| 모델 단계·대상 | 확인한 실제 경계 | 판단 |
| --- | --- | --- |
| Open / BeginLoad | `eth-view.js:172–180,245`; `site-entry.js:8–10`의 단일 initializer 호출 | 초기 setup부터 첫 load 시작까지 동기 실행. pending HTTP 이후 continuation과 분리된다. RequestLimit은 production guard가 아닌 탐색 한계다 |
| ArchiveArrives / ArchiveFails | `eth-view.js:164–181,195–199` | `getArchive()` 내부 fetch와 JSON 응답은 미완료 입력이다. token 확인 이후 daily/weekly parsing과 payload publication 사이에는 await가 없다. 두 parser가 성공한 뒤 함께 공개한다 |
| LiveArrives / LiveFails | `eth-view.js:186–199` | network await 뒤 token을 검사한다. merge, payload/range 갱신, catch/finally는 선택한 추상화에서 동기 continuation이다 |
| Refresh | `eth-view.js:143,172–177,211` | 실제 loading lock은 없다. 최종 모델은 연속 요청을 허용한다. 이미 그려진 disabled 버튼 이후의 추가 입력까지 허용하는 부분은 보수적 과대근사다 |
| ChangeInterval | `eth-view.js:201–203` | frequency·range·navigation revision을 바꾸고 새 load generation으로 이전 요청을 취소한다. 캐시된 daily/weekly 전환에는 HTTP await가 없다 |
| Pan 및 navigation revision | `eth-view.js:90–91,98,106,174,185,192–193,203,205,215–219` | date/price callback, reset, 사건 focus, interval/preset/type/scale/auto writer를 검색했다. 선택 token의 불일치는 이후 load 완료가 선택을 초기화하지 못하도록 한다. 숫자 range·price domain 전체는 모델 변수에 포함하지 않는다 |
| Render / InitialFrame | `eth-view.js:129–163,245–246`; `index.html:121–165` | 일반 예약 frame과 최초 load 뒤 frame을 구분한다. `render()` 진입에서 suspension을 검사하며 가격 또는 재시도 오류를 렌더한 뒤 one-shot readiness를 보낸다. 실제 boot script가 inert를 해제하는 것도 재생한다 |
| Hide / Show / Resize | `eth-view.js:230–243` | hide가 generation을 무효화하고 추적 frame을 취소한다. persisted show가 suspension을 해제하고 재조회 또는 재렌더한다. 늦은 font/resize도 schedule guard를 통과해야 한다 |
| Intraday 통합 | `eth-view.js:81,183–185` 및 실제 market controller | TLA+의 daily/weekly 범위 밖이다. 실제 controller를 통한 refresh·navigation·interval 전환 회귀로 통합을 확인한다 |

### history focus의 await를 제품 버그로 단정하지 않은 이유

`focusHistoricalEvent()`는 await 뒤 range와 price domain을 쓰므로 처음에는 오래된 continuation 가능성을 의심했다. 실제 `ethereum-history.js`는 daily coverage로 jump 버튼을 활성화하고, 160–162행에서 disabled 여부를 검사한다. 허용된 UI 경로에서는 daily archive가 이미 캐시되어 있다. 다른 간격에서 daily로 바꿀 때도 load는 pending HTTP를 만들지 않고, 후속 await는 promise microtask를 거친다. 일반 사용자 event task가 그 microtask 처리 사이에 들어간다는 재현 근거가 없었다.

따라서 이 검토는 helper의 callback을 같은 JavaScript stack에서 임의 순서로 호출한 결과를 실제 사용자 race로 보고하지 않았다. 최종 문서는 daily focus를 `Pan`, weekly focus를 `ChangeInterval` 다음 `Pan`으로 과대근사하는 관계를 설명한다. 버튼 조건을 우회한 programmatic 재진입, catalog/dialog 내용 및 미래의 비캐시 focus workflow는 이 추상화의 증명 범위 밖이다.

## 공식 pstack 상태전이도 재생성과 육안 검사

`create-formal-verification-skill`과 `statechart`의 현재 `SKILL.md` 및 `statechart.mjs --help`를 읽었다. 저장소 모델을 임시 폴더에 복사하고 아래 명령을 실행했다. 기존 invariant와 세 baseline 실패 속성을 유지했다.

```sh
cd /tmp/eth-cold-review/statechart-final-input
XDG_CACHE_HOME=/tmp/eth-statechart-cache \
TLA2TOOLS=/workspace/scratch/f6561dd83ec0/bitcoin-cycle-atlas/build/formal-tools/tla2tools-1.7.4.jar \
node /tmp/cursor-plugins-system-audit/pstack/skills/statechart/scripts/statechart.mjs \
  from-spec EthLoadBaseline.tla --config baseline.cfg --map EthLoad.map.mjs \
  --fixed EthLoad.tla --fixed-config EthLoad.cfg --label 'ETH lifecycle fix' \
  --expect-broken ReadyHasUsableView,NoHiddenPublication,NavigationSurvivesRefresh \
  --cover --png --title 'ETH lifecycle and refresh ownership' \
  --out /tmp/eth-cold-review/statechart-final-result
```

종료 상태 `0`. baseline TLC 10회와 fixed TLC 7회가 실제로 완료됐다. 다음 값은 최종 독립 `summary.json`에서 읽었다.

| 항목 | 값 |
| --- | ---: |
| baseline graph modelStates | 3,503 |
| baseline graph modelTransitions | 12,879 |
| cover chartStates / chartTransitions | 10 / 12 |
| chartStatus works / wrong / fixed | 11 / 0 / 3 |
| chartStatus mixed / after / worse | 0 / 0 / 0 |
| cover에서 생략한 reader states | 4 / 14 |
| cover에서 생략한 reader transitions | 34 / 46 |
| baseline/fixed의 uncited 조건 | 각각 0 |

생략 상태는 Loading after retry, Observed chart with refresh error, Retry available, Retry waiting for first display이다. 도표의 축약은 탐색 생략을 의미하지 않는다. 자동 guard citation 검사가 비어 있다는 사실만으로 코드 대응을 인정하지 않고, 위 대응표와 실제 재생을 별도로 확인했다.

| 도표 | 최단 경로와 실제 회귀 | 최종 확인 |
| --- | --- | --- |
| `bug-1.png` | open → hide → layout notification → render; `ETH shortest hidden-layout counterexample does not update an empty suspended page` | 번호 1–4와 차단 loop를 확인. baseline 위반 class endpoint 355개, fixed에서는 숨김 status write 없음 |
| `bug-2.png` | open → hide → revoked saved prices arrive → initial frame; `ETH shortest revoked-initializer counterexample cannot release a suspended empty page` | 번호 1–4와 빈 화면 readiness 차이를 확인. endpoint 13개, fixed에서는 loading shell 유지 |
| `bug-3.png` | open → saved prices → initial frame → refresh → pan → live prices; `ETH refresh preserves a date range chosen while its request was pending` | 번호 1–6, reset branch와 보존 branch를 확인. endpoint 18개, fixed에서는 새 range 유지 |
| `chart.png` | 전체 cover view | 10개 상태의 분기, 제목·범례·레이블을 확인. 잘린 node 문구나 읽기 어려운 번호가 없었음 |

최종 PNG 네 장을 모두 직접 열어 확인했다. 각 Mermaid 네 개, PNG 네 개, `stories.md`, `summary.json`이 저장소 `docs/formal-eth/statechart/`의 대응 파일과 byte-for-byte 일치했다. 처음 검토한 출력과의 차이는 갱신된 모델의 경로 수와 교정된 코드 citation에 반영되어 있으며, 최종 비교는 동일 cwd 기준의 파일명으로 수행했다.

## 검증 범위와 유지 조건

- 요청 세대 3개, daily/weekly, auto/custom range class의 유한 안전성 검사다. 무제한 요청이나 navigation revision의 안전 정수 범위를 넘어서는 실행을 증명하지 않는다.
- abort 이후에도 HTTP 결과가 도착할 수 있게 했다. 숨김 중 오래된 callback이 실행되는 순서는 방어 guard를 시험하기 위한 과대근사이며, 실제 BFCache 문서가 평소처럼 paint된다는 주장이 아니다.
- 초기화 전체를 실행하지만 실제 DOM·렌더러·timer·frame 스케줄링을 주입한다. 브라우저 pixel, 접근성 트리 전체, 성능, 실제 지연·deadline·fairness·eventual completion은 이 검토가 증명하지 않는다.
- valid parsed prices를 추상화한다. 실제 parser를 재생에 사용했더라도 모든 가격 수치·가격 경로·경제적 정확성·역사 사건의 인과성을 형식적으로 검증한 것은 아니다.
- intraday controller 내부의 소유권은 기존 market 검증 범위이고, 이번 TLA+는 daily/weekly다. 이번 회귀의 intraday 성공을 intraday 전체의 새 형식 증명으로 표현하지 않는다.
- `NoHiddenPublication`은 선택한 chart/readiness 경계에 대한 속성이다. 다른 모듈의 모든 DOM write나 임의 programmatic callback의 전역 금지를 뜻하지 않는다.
- covered runtime, boot script, await 또는 range/error/readiness writer를 변경하면 기록된 revision과 diff하고 모델·mapping·회귀·mutation selector·receipt를 함께 재검토해야 한다. `/maintain-formal-verification-skill` 안내도 새 스킬에 존재한다.

검토 중 임시 증거는 `/tmp/eth-cold-review/`에 저장했다. 재현 가능한 영구 근거는 프로젝트의 model/config/source, `docs/formal-eth/verification.json`, baseline replay, statechart receipt 및 이 문서의 개별 실행 수치다. 최종 `git diff --check`도 통과했다.
