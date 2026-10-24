# 허용 원문 읽기 화면과 복구 기록

검토일은 **2026-10-24**다. 이번 작업은 `main`의 `e9c0ecf88aa0016fb6a36d626fb6dfd0702d4260`에서 읽을 수 있던 연구 요약 리더를 확장한다. 이전 대화의 “CC0 원문 두 개 구현” 보고와 파일은 확보하지 못했다. 아래 두 자료는 **이번 복구에서 직접 선정하고 확인한 자료**다. 이전 실패 작업의 파일을 되찾았다는 뜻은 아니다.

## 1. 독자가 할 수 있는 일

리서치 목록에서 EIP-1559 또는 EIP-3675를 열면 **연구 요약 / 보관 원문**을 선택할 수 있다. 연구 요약은 Atlas가 작성한 내용·주장 판정·대조 자료·한계를 보여 준다. 보관 원문은 원 발행처의 지정 판본에서 가져온 영어 Markdown 파일 전체를 텍스트로 보여 준다.

저장 버튼은 현재 읽는 내용에 맞게 **요약 MD 저장** 또는 **원문 MD 저장**으로 바뀐다. 요약의 SHA-256과 원문의 SHA-256을 따로 표시한다. 원문 탭은 허용 원문을 실제 보존한 두 자료에만 나타난다. 공시나 다른 외부 기사에 원문 탭을 자동으로 만들지 않는다.

원문을 선택하면 `article-view=source`가 주소에 남는다. 다음 주소로 직접 열 수 있다.

- [EIP-1559 원문 읽기](https://twoimo.github.io/bitcoin-cycle-atlas/?page=evidence&article=eth-source-2be2a692f09f&article-view=source)
- [EIP-3675 원문 읽기](https://twoimo.github.io/bitcoin-cycle-atlas/?page=evidence&article=eth-merge-eip-3675&article-view=source)

종목·분류·검색 필터는 이 전환에서 유지된다. 함께 대조할 글로 이동하면 그 글의 요약부터 읽으며, 리더의 뒤로 버튼은 직전 글과 그때 읽던 요약·원문 선택을 복원한다. 원문이 없는 글에 `article-view=source`를 지정해도 자체 요약을 원문으로 표시하지 않는다.

## 2. 보존한 자료와 허용 근거

두 문서의 `Copyright` 절은 CC0 적용을 명시한다. 각 문서와 **동일한 Git 커밋의 `LICENSE.md`**도 읽었다. 두 라이선스 파일의 바이트와 Git blob SHA가 동일함을 확인했다. 원문을 가져온 경로는 GitHub의 정식 `ethereum/EIPs` 저장소다.

| 항목 | EIP-1559 | EIP-3675 |
|---|---|---|
| 원제 | Fee market change for ETH 1.0 chain | Upgrade consensus to Proof-of-Stake |
| 공식 웹 문서 | [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) | [EIP-3675](https://eips.ethereum.org/EIPS/eip-3675) |
| 고정 판본 | [ba6c342c23164072adb500c3136e3ae6eabff306](https://github.com/ethereum/EIPs/blob/ba6c342c23164072adb500c3136e3ae6eabff306/EIPS/eip-1559.md) | [49cc275d76512ccf8554148a02d9077f413d80b2](https://github.com/ethereum/EIPs/blob/49cc275d76512ccf8554148a02d9077f413d80b2/EIPS/eip-3675.md) |
| 해당 파일의 마지막 변경 | 2023-10-04 14:19:21 UTC | 2022-09-20 15:09:25 UTC |
| 제안 `created` 날짜 | 2019-04-13 | 2021-07-22 |
| 원문 파일 크기 | 21,053 bytes | 22,848 bytes |
| 같은 판본의 허용 근거 | [LICENSE.md](https://github.com/ethereum/EIPs/blob/ba6c342c23164072adb500c3136e3ae6eabff306/LICENSE.md) | [LICENSE.md](https://github.com/ethereum/EIPs/blob/49cc275d76512ccf8554148a02d9077f413d80b2/LICENSE.md) |
| 저장 파일 | [eip-1559.md](../dist/research-sources/eip-1559.md) | [eip-3675.md](../dist/research-sources/eip-3675.md) |

수집·검토 기록 시각은 **2026-10-24 10:47:56 UTC / 19:47:56 KST**다. 이는 원문 발행일·네트워크 적용일·최종 수정일과 다르다. 제안 작성 날짜를 실제 네트워크 활성화 날짜로 사용하지 않는다.

원문 SHA-256은 다음과 같다.

```text
eip-1559.md  4460ad966a22d8501e12d75165c2c784c61748d8128229f115ebac1bfccac59f
eip-3675.md  7345c394b8726383a667b3e5114fa0916410c95de3c1a031663a8e07cbe40e03
```

[원문 명세](../dist/research-sources/manifest.json)는 원문 URL, 고정 판본, 원문 수정 시각, 수집 시각, 라이선스 URL, Git blob SHA, SHA-256, 바이트 수를 제공한다. [CC0 라이선스 원본](../dist/research-sources/LICENSE-CC0.md)도 보존한다.

### 보존 범위

**원문 전체**라는 표시는 해당 커밋의 `EIPS/eip-1559.md`와 `EIPS/eip-3675.md`라는 **단일 파일 전체**를 뜻한다. YAML 머리말, 본문, 표·코드 텍스트와 저작권 고지를 포함한다. 웹사이트의 HTML·화면 배치·댓글·토론·다른 링크 문서·이미지·영상까지 가져왔다는 뜻은 아니다. 원문의 상대 링크와 코드 주석은 원문 바이트를 유지하기 위해 수정하지 않았다.

외부 자료에 접근할 수 있다는 이유만으로 전문을 복제하지 않는다. 다른 외부 기사·영상은 종전처럼 직접 작성한 요약·검토·출처 링크와 허용된 짧은 인용 범위를 유지한다.

## 3. 재무 시나리오에 연결되는 의미

[EIP-1559](https://eips.ethereum.org/EIPS/eip-1559)는 기본 수수료 소각과 우선 수수료를 구분하며, 순공급 변화가 발행·소각·블록 공간 수요의 상대 크기에 따라 달라짐을 설명한다. 따라서 소각 규칙은 ETH 가격이나 BMNR 주가의 확정 상승 근거가 아니다. 연구 기록은 이 규칙을 ETH 가치평가·BMNR 주당 잔여가치 모델의 별도 가정과 연결한다.

[EIP-3675](https://eips.ethereum.org/EIPS/eip-3675)는 합의 전환, PoW 블록·ommer 보상 제거, PoS 합의 계층의 역할과 거래 수수료 처리의 연속성을 구분한다. 특정 기업의 스테이킹 배치율·수익률·비용을 정하는 문서가 아니다. BMNR 모델의 수치와 이 프로토콜 명세를 동일한 종류의 근거로 취급하지 않는다.

두 EIP는 같은 Ethereum 개발 생태계의 자료다. 두 문서를 독립 기관 두 곳의 검증으로 세지 않는다. 문서 읽기와 원문 무결성 검사는 합의 구현의 실행 검증이나 예측 적중 검증이 아니다.

## 4. 구현과 재현

자료 구조는 자체 요약 카탈로그와 허용 원문 카탈로그로 나눈다. URL이 정확히 일치하는 연구 글에만 원문을 연결한다. 내용이 바뀔 수 있는 외부 페이지를 열 때마다 다운로드하는 방식과 원문을 함께 묶는 방식을 비교했으며, 두 개의 짧은 고정 문서에는 후자를 사용했다. 네트워크·쿠키·접근 실패가 읽기 결과를 바꾸지 않고 단일 HTML에도 같은 파일 내용을 포함하기 때문이다.

| 경로 | 역할 |
|---|---|
| `research-data/permitted-source-texts.json` | 검토한 고정 판본·라이선스·기대 바이트·해시 입력 |
| `dist/research-sources/*.md` | 원본 UTF-8 바이트와 CC0 라이선스 |
| `scripts/build-research-sources.mjs` | 원본 검증과 결정적인 브라우저 모듈·명세 생성 |
| `dist/research-source-data.js` | 네트워크 없이 읽는 원문 텍스트와 메타데이터 |
| `dist/research-source-records.js` | 직접 작성한 두 자료의 요약·판정·모델 연결 |
| `dist/research-reader.js` | 요약·원문 선택, 텍스트 열람, 구분된 다운로드 |
| `tests/research-source-reader.test.mjs` | 원문 정체성·다운로드·렌더링·잘못된 연결 경계 검사 |

생성기는 현재 기록된 Git blob SHA와 UTF-8 파일 바이트를 비교한다. SHA-256·크기·CC0 고지와 라이선스 바이트도 검사한다. 원문을 임의로 수정한 뒤 생성 명령만 실행해 새 해시로 덮어쓸 수 없고, 검토 입력이 일치하지 않으면 실패한다. 외부 페이지를 실행하거나 외부 Markdown을 HTML로 변환하지 않는다. 리더는 원문을 이스케이프한 `pre` 텍스트로 표시한다.

```sh
node scripts/build-research-sources.mjs
node scripts/build-research-sources.mjs --check
node --test tests/research-reader.test.mjs tests/research-source-reader.test.mjs
```

이번 복구에서 직접 실행한 생성·검사 결과는 원문 **2개·43,901 bytes**, 라이선스 **7,048 bytes**다. 기존 연구 리더 검사와 새 원문 리더 검사가 통과했다. 검사는 두 원문 모두의 보존 파일·브라우저 다운로드 문자열·명세·Git blob·SHA-256을 대조하고, 자체 요약과 원문이 다른 파일임을 확인한다. HTML·실행 가능한 Markdown·유사 호스트의 URL이 원문 실행이나 허용 연결로 바뀌지 않음을 검사한다.

실제 브라우저의 화면·키보드·다운로드와 단일 HTML의 오프라인 동작 확인은 최종 통합 검증 기록에 따로 남긴다. 위 Node 검사를 실제 브라우저 검증으로 표현하지 않는다. 이 문서 자체는 커밋·PR·공개 배포·릴리스 완료를 선언하지 않는다.
