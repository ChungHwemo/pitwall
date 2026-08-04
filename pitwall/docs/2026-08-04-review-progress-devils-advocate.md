# REVIEW.md 진행사항 — 악마의 변호인 교차검증 · 권고 가이드라인

**감사일:** 2026-08-04  
**대상:** 루트 `REVIEW.md` 항목 #1–#14 + 워킹트리 미커밋 변경  
**방식:** 문서 주장은 유죄 추정. 코드·테스트·git 상태·실측 기록으로만 무죄 입증.  
**감사 시점 HEAD:** `9c9f1a6` (origin/main 대비 local ahead 4)  
**워킹트리:** `projection.ts` · `trackModel.ts` · `LiveSource.ts` · `models.ts` + 대응 테스트 미커밋  

**검증 도구 실측 (이 문서 작성 시)**

| 명령 | 결과 |
|---|---|
| `cd pitwall && npm test` | **Test Files 1 failed / 47 passed · Tests 1 failed / 854 passed (855)** |
| 실패 | `tests/appMotion.test.ts` — `expected 13 to be less than 12.5` |
| 동일 테스트를 **HEAD projection**으로 교체 후 재실행 | **통과** |
| 동일 테스트를 **미커밋 projection**으로 복구 후 재실행 | **실패** |
| `npx tsc --noEmit` | exit 0 |
| `MODEL_CATALOG` id 개수 (미커밋 포함) | **22** (`grok-4.5-build` 추가) |

---

## 0. 한 줄 평결

| 판정 | 내용 |
|---|---|
| **지금 “반영 완료”로 닫으면 안 되는 것** | #13 — 단위 회귀는 통과하나 **앱 경로 움직임 게이트를 깨뜨림**. REVIEW 본문의 “전체 854 테스트 통과”는 **현재 워킹트리에서 거짓**. |
| **부분 진실** | #14 — hot 보존 로직은 맞고 단위 테스트도 있으나, **렌더러 피트 경로·무제한 hot 폭주**는 미검증. |
| **문서 부채** | #5–#9 상태가 여전히 “미커밋” — 실제 구현은 이미 히스토리에 있음. 테스트 개수 표기(CHECKLIST 256 / README·PITWALL 847 / 실측 855) 삼중 불일치. |
| **진짜 남은 P1 성격** | (1) 스위트 그린 복구 없이 #13 머지 금지 (2) native LIVE 리로드 연속성 미측정 (3) 한도 다수 계정 시 hot/피트 스케일 |

**$10M 기준으로 오늘 고칠 것 한 줄:**  
> 미커밋 #13을 “테스트 통과한 수정”으로 포장하지 말고, `appMotion` 실패 원인을 제품 의도로 확정한 뒤 스위트를 다시 녹색으로 만든 다음에만 REVIEW 상태를 `반영`으로 올린다.

---

## 1. 항목별 교차검증 표

범례: ✅ 문서·코드 일치 / ⚠️ 부분·과장·잔여 리스크 / ❌ 문서 오류 또는 미완료를 완료로 표기 / 🔍 이 환경에서 미측정

| # | REVIEW 상태 | 우선순위 | 판정 | 한 줄 근거 |
|---|---|---|---|---|
| 1 | (빈칸) | — | — | 비어 있음 |
| 2 | 반영 (`c77e025`) | P1 | ⚠️ | 전방투영 고정점 수정은 코드에 존재. 대스텝·밀집·hot↔cold 잔여는 여전히 열림 |
| 3 | 보류 | P3 | ✅ | 3D는 예산·철학 충돌. 보류 정당 |
| 4 | 확인 | P3 | ✅ | #3 정정(자동 카메라)은 director 구조와 정합 |
| 5 | 반영 (미커밋) | P2 | ❌ 상태문구 | 구현·커밋 존재. “미커밋”은 거짓 |
| 6 | 반영 (미커밋) | P2 | ❌ 상태문구 | 동일 |
| 7 | 반영 (미커밋) | P3 | ❌ 상태문구 | 동일 |
| 8 | 반영 (미커밋) | P3 | ❌ 상태문구 | 동일 |
| 9 | 반영 (미커밋) | P3 | ❌ 상태문구 | 동일 |
| 10 | 반영 (`c572b32`) | P2 | ⚠️ | CSS idle sway = 토큰 1:1 보존. **오독 여부 실측 없음** (REVIEW 스스로 인정) |
| 11 | 반영 (`c572b32`) | P3 | ✅ | provider 칩, 미지 모델 null — 하드 룰과 정합 |
| 12 | 반영 (`c572b32`) | P1 | ⚠️ | `liveStore` 구현·단위/통합 테스트 있음. **native LIVE E2E는 INCONCLUSIVE** (PITWALL/CHECKLIST 명시) |
| 13 | 반영 (미커밋) | P1 | ❌ | 역주행 단위 테스트 통과, **그러나 `appMotion` 회귀**. “전체 테스트 통과” 주장 기각 |
| 14 | 반영 (미커밋) | P1 | ⚠️ | limit 우선 + hot 보존 로직·단위 테스트 OK. 피트 DOM 경로·HOT_CAP 우회 스케일 미검증 |

---

## 2. 악마의 변호인 — 확정 결함 (심각도 순)

### D1 — #13이 앱 경로 움직임 게이트를 깨뜨린다 ❌ CRITICAL

**문서 주장 (REVIEW #13):**  
> 전체 854 테스트·빌드 및 adversarial 시퀀스 검증 완료.

**실측:**

1. 현재 스위트는 **855** tests (신규 회귀 테스트 추가 후).
2. `tests/appMotion.test.ts` **1건 실패** — “이벤트 사이 프레임에도 차가 움직인다”.
3. A/B: **HEAD `projection.ts` → 통과 / 미커밋 `projection.ts` → 실패**. 원인은 #13 패치에 귀속된다.

**메커니즘 (보수적 해석):**

- 패치는 (a) 후퇴 앵커를 `effectiveTarget`에서 버리고 (b) `activeForward` 구간에서 `shortest(visual, candidate) < 0`이면 **visual을 동결**한다.
- lead 클램프가 앞서 나간 visual을 앵커 쪽으로 **살짝 당기려 할 때** 옛 코드는 미세 후진(=프레임 간 transform 변화)을 만들었고, `appMotion`은 그 변화를 “움직임”으로 셌다.
- 새 코드는 후진을 죽이므로 lead 천장 근처에서 **still 프레임 비율이 올라간다**. 실패 수치는 `still=13`, 임계 `seen.length/2=12.5` — **경계 한 칸**.

**악마의 질문:**

| 질문 | 답 |
|---|---|
| 단위 테스트가 초록이면 끝인가? | 아니다. `appMotion`은 렌더러·리플레이·rAF 경로를 묶는 **제품 게이트**다. |
| 역주행 금지가 맞으면 `appMotion`을 느슨하게 하면 되나? | **제품 결정을 먼저** 해야 한다. “lead 천장에서 정지 = 데이터 대기”가 의도라면 테스트를 고치고 문서화. “이벤트 사이 미끄러짐 유지”가 의도라면 패치를 고쳐 후진 없이 전방 코스트만 살려야 한다. |
| REVIEW에 “반영”을 써도 되나? | **스위트 녹색 전까지 금지.** 지금은 `확인` 또는 `보류(회귀 치유 중)`가 정직하다. |

**권고 수정 방향 (둘 중 하나를 고르고 측정으로 닫을 것):**

1. **의도 = 단조 진행 + 이벤트 사이 코스트 유지**  
   - 후퇴 앵커는 상태 오염만 막고, **visual 동결 가드(step 5)를 lead-clamp 당김과 분리**한다.  
   - 예: “데이터 앵커가 뒤로 간 경우”에만 동결, “projected lead clamp가 만든 미세 후진”은 `max(visual, clamp)` 또는 `velocity` 방향 투영으로 흡수.  
   - 합격 조건: `projection` 역주행 0 + `appMotion` 통과 + 기존 “고정점 탈출” 테스트 유지.
2. **의도 = lead 천장 정지가 정상 신호**  
   - `appMotion` 임계/시나리오를 “lead에 닿기 전 창”으로 재작성.  
   - PITWALL §움직임에 “앞서기 한계에 닿으면 다음 샘플까지 선다”를 명시.  
   - 합격 조건: 문서·테스트·실화면 녹화 3자가 같은 말을 한다.

**지금 하지 말 것:** 실패 테스트를 삭제·스킵·매직넘버만 올리기.

---

### D2 — #13 서술과 코드 불일치 (세부) ⚠️ HIGH

| REVIEW 문장 | 코드 실제 | 판정 |
|---|---|---|
| “후퇴 샘플은 상태를 오염시키지 않고 마지막 전진 앵커를 유지” | `forwardTarget === false`일 때 `effectiveTarget = car.anchor` — 대체로 맞음 | ✅ |
| 단, `car.velocity === 0`이면 후퇴도 `forwardTarget` | stale 이후·첫 샘플 등에서 **후퇴 앵커를 채택** | ⚠️ 서술 누락 |
| “동일 앵커 프레임이 0.204→0.204로 멈췄다” (수정 전) | debug journal red-phase와 일치하는 서술 | ✅ (당시 관측) |
| anti-back이 visual을 영원히 앞에 고정 | `v=0`+후퇴 타깃 실험: visual **0.5에 고정**, 데이터 0.10 — 다음 전진이 visual을 앞지를 때까지 불일치 | ⚠️ 토큰 distance는 단조라 드묾. hot↔cold·spread 경계에선 가능 |
| 랩 경계 보존 | `0.95→0.05` 프로브: reversals 0, 전진 랩 통과 | ✅ |
| 기존 테스트 “새 샘플이 오면 그쪽으로 당겨진다” | **의미가 반전됨** (“뒤에 와도 화면은 뒤로 돌지 않는다”) | ⚠️ 의도 변경을 REVIEW에 명시하지 않음 |

**권고:** REVIEW #13 근거란에 “바뀐 불변식”을 한 줄로 못 박을 것.

```
불변식(신규): active 구간에서 visual은 shortest 기준 비감소(랩 wrap 제외).
불변식(유지): lead ≤ max(MAX_LEAD, lastStep); 데이터 없는 관성 ≤ STALE_MS.
폐기: “새 샘플이 뒤면 visual도 뒤로 당긴다”.
```

---

### D3 — #14는 “피트로 보낸다”를 절반만 증명 ⚠️ HIGH

**코드 (맞음):**

```ts
// highlightOf: limit > pin > error
// hot = [...limits, ...others.slice(0, HOT_CAP - limits.length)]
```

- 한도 차는 `reason === 'limit'`로 hot에 들어가고, `trackRenderer`의 `STOPPED`에 `limit`이 있어 **피트 박스 경로**로 간다. [High]

**테스트 (부족):**

| 있음 | 없음 |
|---|---|
| `trackModel.test.ts`: HOT_CAP+2 한도차 → 전부 hot, cold 0 | 렌더러가 실제 pit translate를 쓰는지 |
| | pin+limit 동시일 때 reason이 limit인지 (의도 문서화) |
| | 한도 차가 HOT_CAP을 **크게** 넘을 때 노드 수·pitBoxes 부족 폴백 |

**스케일 함정:**

- `HOT_CAP = 12`는 “비싼 처리 상한” 주석인데, **한도 차는 상한을 뚫는다**.
- 조직 전체 rate-limit 동시 발생 시 hot = N, `pitBoxes(track, N)`은 코스 길이에 막혀 **마지막 칸 겹침**.
- `pitLanePoints(this.track, HOT_CAP)`로 레인 선은 12칸 기준으로 그려질 수 있어, **박스 수와 레인 폴리라인이 어긋날** 여지. [Medium]

**권고:**

1. `trackRenderer` 테스트: limit 차량 `data-reason="limit"` + 피트 좌표(또는 hold 호출) 단언.
2. soft-cap 정책 명시: 예) 한도 우선 보존하되 `HOT_CAP` 초과분은 클러스터 배지 + 카운트 (사건을 “트랙 위 주행”으로 위장하지 않으면서 DOM 폭주 방지).
3. pin vs limit 우선순위를 PITWALL §트랙에 한 줄.

---

### D4 — #12 “데이터 손실 필수 차단”은 아직 증명 못 함 ⚠️ HIGH (제품 신뢰)

**구현은 있다:** `liveStore.ts` 직렬화·TTL·rAF 시계 rebase·`main.ts` 주기 저장. 단위/통합 테스트도 커밋됨 (`c572b32` 계열).

**그러나 제품 문서가 스스로 말한다 (PITWALL §리로드 신뢰성, CHECKLIST 미측정):**

| 항목 | 상태 |
|---|---|
| nominal 5초 스냅샷 | best-effort — 손실 상한·zero-loss **아님** |
| native LIVE 연속성·중복 재생 | **미측정 / INCONCLUSIVE** |
| 지연·즉시 리로드 | **미측정 / INCONCLUSIVE** |
| `pitwall.live` 프라이버시 | **BLOCKED** (Web Inspector 없음) |
| malformed/expired 폴백 | **BLOCKED** |

**악마의 결론:** REVIEW #12를 P1 “반영”으로 닫은 것은 **코드 경로 존재** 기준이다. “우발 리로드 시 데이터 손실을 반드시 막았다”는 **운영 증명** 기준으로는 아직 미달.  
상태 문구 권고: `반영 (코드·단위) / 운영 검증 보류` 이중 표기.

---

### D5 — REVIEW·README·PITWALL·CHECKLIST 수치 거짓말 ⚠️ MED (문서 P0에 가깝다)

이 프로젝트의 P0 정의는 “화면이 거짓을 말함”이지만, **문서가 거짓을 말하면 같은 질병**이다.

| 위치 | 주장 | 실측 (2026-08-04) |
|---|---|---|
| REVIEW #13 | 854 전부 통과 | **855 중 1 실패** |
| REVIEW #5–#9 | 미커밋 | 구현 커밋 존재 (`2d38fe1`이 applied 마킹까지 함). 상태 문자열만  lagged |
| README / PITWALL | 847 tests | 현재 855 정의, 통과 854 (실패 1) |
| CHECKLIST 자동 게이트 | **256 passed / 20 files** | 수개월 전 스냅샷. 게이트 표가 죽은 문서 |
| README 모델 | 21개 | 미커밋 후 **22** (`grok-4.5-build`) |

**권고:** 숫자 주장은 “마지막 `npm test` 로그 + 날짜”만 허용. CHECKLIST 자동 게이트는 재측정하거나 “역사 스냅샷” 라벨을 붙인다.

---

### D6 — 워킹트리에 REVIEW 밖 수정이 섞여 있다 ⚠️ MED

미커밋 diff에 #13/#14 외:

| 파일 | 내용 | 리스크 |
|---|---|---|
| `LiveSource.ts` | Grok `model_id` 최상위 필드 인식 | 정당. 실측 형태 수정. REVIEW 행 없음 |
| `models.ts` | `grok-4.5-build` 카탈로그 | 단가 복제 — priceSource verified 주장 유지. 카탈로그 개수 문서 갱신 필요 |
| `.debug-journal.md` | 진단 일지 untracked | 커밋 금지 대상·정리 대상 (저널 스스로 “remove after”) |

**권고:** 커밋 분리 — (A) projection 역주행 (B) limit hot (C) grok model_id. 한 커밋에 섞으면 회귀 시 bisect가 죽는다.

---

### D7 — #2/#10 잔여: “부드러운 레이스”는 닫히지 않았다 ⚠️ MED

| 잔여 | 상태 |
|---|---|
| 이벤트당 토큰 ≫ LAP_TOKENS → 큰 lastStep → 따라잡기 도드라짐 | #2에서 원인으로 인정. 구조적. LAP/lead 재튜닝 없으면 재발 |
| `spreadProgress`가 이웃 사건으로 cold 목표를 밈 | 2–3대 실측으로 기각됐으나 **대규모 데모(40계정)에서는 재오픈 가능** |
| hot progress = raw / cold = spread → 전환 불연속 | #2 후보 ③. #13 anti-back이 후진은 막지만 **전환 순간 정지·대기**로 남을 수 있음 |
| idle sway 오독 | #10 — “고장 vs 유휴” 실사용 관찰 **미실시** |

**권고:** 대규모 픽스처 + headless shot으로 “역주행 프레임 수 / still 비율 / hot↔cold 점프 px”를 수치 게이트로 승격. 주관적 “부드럽다”는 닫힘 조건이 아니다.

---

### D8 — #3 3D / #4 카메라 — 지금 손대지 말 것 ✅ (보류 유지)

- three.js 등은 outbound-0·번들 철학·곁눈질 하드 룰과 예산 충돌.
- director 슬롯은 3D 컷의 **데이터 쪽 씨앗**일 뿐, 지금 구현 예산에 넣으면 #13/#12 같은 실사용 결함을 밀어낸다.
- **보류 유지. 재오픈 조건:** 2D 움직임·리로드·한도 피트가 측정으로 닫힌 뒤.

---

## 3. “나라면 뭘 고칠지” — 우선순위 백로그

### Tier 0 — 머지 전 필수 (오늘)

| ID | 작업 | 완료 정의 | 예상 범위 |
|---|---|---|---|
| T0.1 | #13 + `appMotion` 동시 녹색 | `npm test` 0 fail, projection 역주행 스위트 유지 | `projection.ts` + 필요 시 `appMotion.test.ts` **의도 문서화** |
| T0.2 | REVIEW #13 상태 정정 | 녹색 전: `보류`/`확인`. 녹색 후: `반영` + 커밋 해시 | `REVIEW.md` |
| T0.3 | 커밋 원자 분리 | projection / trackModel limit / grok model_id 최소 2–3 커밋 | git only |
| T0.4 | 테스트 개수·모델 수 동기화 | README / PITWALL / REVIEW 한 날짜 기준 | docs |

### Tier 1 — 신뢰성 (이번 주)

| ID | 작업 | 완료 정의 |
|---|---|---|
| T1.1 | #14 렌더러 회귀 테스트 | limit → pit hold/translate 단언 |
| T1.2 | #14 hot soft-cap 정책 | 한도 우선 + 상한 초과 시 클러스터/카운트. 문서 1문단 |
| T1.3 | #12 native LIVE 최소 시나리오 | 앱에서 LIVE 기동 → 스냅샷 저장 확인 → 리로드 → 집계 연속 **또는** “기동 불가” 재현 절차를 CHECKLIST에 고정 |
| T1.4 | #5–#9 상태 문자열에서 “미커밋” 제거 | 실제 커밋 해시로 교체 |

### Tier 2 — 움직임 품질 (관측 후)

| ID | 작업 | 완료 정의 |
|---|---|---|
| T2.1 | demo-large 100× 역주행 재실측 | Chrome 트레이스: reversals ≈ 0 (수정 전 171/318 대비) |
| T2.2 | still-ratio / lead-ceiling 정책 문서화 | PITWALL §움직임 갱신 |
| T2.3 | 대규모 cold `spreadProgress` 재평가 | 계정 ≥14에서 이웃 유발 이동이 곁눈질에 읽히는지 |
| T2.4 | idle sway 오독 A/B | 30초 녹화 × 비개발자 1명: “멈춤=고장?” 응답 |

### Tier 3 — 하지 말 것 (지금)

| 금지 | 이유 |
|---|---|
| 시간 기반 베이스 주행 (#10 원안) | P0 “없는 사실 주장”과 충돌. sway가 정답 쪽 |
| three.js / 3D 트랙 | 의존성·번들·조작 철학. #4도 자동 카메라로 정정됨 |
| 트랙 글리프에 provider 제2축 | 클래스=단가 밴드 하드 룰 |
| 실패 테스트 삭제/스킵으로 그린 만들기 | 엔지니어링 하드 블록 |
| “전체 통과” 문구를 재측정 없이 복사 | D5 재발 |

---

## 4. 권고 가이드라인 (앞으로 REVIEW 항목을 닫는 법)

### 4.1 상태 전이 규칙

```
(빈칸) → 확인 → (구현) → 반영
                ↘ 반박
                ↘ 보류
                ↘ 불가
```

**`반영` 진입 조건 (전부 충족):**

1. **실패 재현 테스트**가 red→green으로 남는다 (삭제 금지).
2. **관련 통합/앱 경로 테스트**가 녹색이다 (`projection`만 초록 ≠ 완료).
3. **전체 `npm test` + `tsc --noEmit`** 로그를 근거란에 날짜와 함께 남긴다.
4. 운영/네이티브가 필요하면 **측정 또는 INCONCLUSIVE를 상태 문구에 병기**한다.
5. 커밋 해시가 있다. “미커밋”은 최대 24h 임시 표기. 넘으면 상태 거짓말.

**`반영`을 쓰면 안 되는 경우:**

- 단위만 통과, 상위 게이트 실패 (이번 #13).
- “코드는 있는데 E2E 미측정”을 숨김 (이번 #12 위험).
- 기존 테스트 의미를 조용히 반전 (이번 projection “당겨진다” 테스트).

### 4.2 증거 등급

| 등급 | 허용되는 주장 |
|---|---|
| L0 코드 읽기 | “후보 원인”, “설계상” |
| L1 단위 테스트 | “이 입력에서 함수는 이렇게 동작” |
| L2 통합/앱 테스트 | “파이프라인에서 움직임/DOM 계약” |
| L3 브라우저/앱 실측 | “화면이 역주행하지 않는다”, “리로드 후 숫자 연속” |
| L4 실사용 관찰 | “곁눈질로 고장으로 안 읽힌다” |

REVIEW P0/P1 닫힘은 **최소 L2**. “화면이 …” 문장은 **L3**. 취향(P3)만 L0 허용.

### 4.3 패치 설계 원칙 (PITWALL 특화)

1. **진행률 1:1 (토큰↔distance)** 을 깨는 애니메이션 금지. 시각 효과는 CSS/opacity/sway.
2. **없는 데이터 금지** — lead·STALE·hold는 안전장치지 장식이 아니다.
3. **단조 visual**을 넣을 거면 lead 천장 정지 정책을 제품 문장으로 먼저 쓴다.
4. **HOT_CAP·LANE_RENDER_CAP**은 성능 예산. 사건 우선 보존 시 **대체 표현(클러스터)** 을 같이 설계.
5. **하드 룰 충돌 시 축소 이식** (#5–#11 tokscale 패턴) — 이미 잘 된 패턴. 유지.

### 4.4 커밋·문서 동기화

1. 기능 커밋과 REVIEW 상태 커밋을 붙이되, **상태 커밋 전에 테스트 로그를 재실행**.
2. README/PITWALL 상단 테스트 수는 상태 커밋과 같은 diff에서 갱신.
3. CHECKLIST “자동 게이트” 표는 재측정하거나 “MVP 당시 스냅샷”으로 강등.

### 4.5 머지 전 체크리스트 (복사해서 쓸 것)

```
[ ] npm test          → 0 failed (로그 붙임)
[ ] npx tsc --noEmit  → 0
[ ] 변경 축 통합 테스트 식별·통과 (appMotion / liveStore / trackRenderer …)
[ ] REVIEW 행: 상태·해시·증거 등급(L?) · 의도 변경 시 불변식 한 줄
[ ] README/PITWALL 숫자 동기화 또는 “이 커밋에서 숫자 불변” 명시
[ ] 네이티브/실측 필요 시 INCONCLUSIVE 병기
[ ] 디버그 산출물(.debug-journal, 임시 shot) untracked 정리
[ ] 커밋 단위가 bisect 가능한가 (한 커밋 한 축)
```

---

## 5. 항목별 권고 처분 (에이전트/작성자용)

| # | 지금 할 처분 | 다음에 할 일 |
|---|---|---|
| 2 | 유지 | T2.1–T2.3 대규모 재실측 |
| 3 | 보류 유지 | 재오픈 금지 (Tier 3) |
| 4 | 확인 유지 | 3D 예산 시 director 확장만 |
| 5–9 | 상태 문자열 수정 (`반영` + 실제 해시) | 추가 기능 없음 |
| 10 | 반영 유지, 근거에 “오독 L4 미실시” | T2.4 |
| 11 | 반영 유지 | — |
| 12 | 상태 이중화: 코드 반영 / 운영 INCONCLUSIVE | T1.3 |
| 13 | **상태 강등** → 스위트 녹색 후 재반영 | T0.1–T0.2 |
| 14 | 반영 유지 가능하나 T1.1–T1.2 없이 “완료” 과장 금지 | T1.1–T1.2 |
| (신규) Grok model_id | REVIEW 행 추가 권장 | 별도 커밋 |

---

## 6. 내가 $10M을 위해 고를 수정 순서 (실행 시퀀스)

1. **T0.1** — `Projector` 불변식을 문서에 먼저 쓰고, 후진 0 + `appMotion` 동시 통과하도록 패치 재작업.  
   - 회귀 스위트는 유지.  
   - 필요하면 “lead 천장 still”을 허용하는 쪽으로 **테스트를 의도적으로** 바꾸되, 그 의도를 PITWALL에 먼저 기록.
2. **전체 스위트 재실행** — 실패 0을 로그로 박제.
3. **T1.1** — limit→pit 렌더러 테스트 (한 파일, 작음, #14 증명 완성).
4. **Grok model_id + catalog** 분리 커밋 (실데이터 파싱 — 가치가 높고 회귀 면적 작음).
5. **REVIEW/README/PITWALL** 상태·숫자 정리 커밋.
6. **#12** — native LIVE를 기동하는 최소 수동 절차를 CHECKLIST에 고정. 못 하면 “반영” 문구에서 “반드시”를 삭제.
7. **demo-large 역주행 L3 재실측** — debug journal 수준의 숫자를 수정 후에 다시 찍어 닫기.
8. **그 전에는 3D·시간주행·새 카드 UI 금지.**

---

## 7. 신뢰 태그 요약

| 주장 | 신뢰 |
|---|---|
| 미커밋 projection이 `appMotion`을 깨뜨린다 | [High] A/B 재실행 |
| #13 단위 역주행 테스트는 통과한다 | [High] vitest 18/18 projection |
| #14 limit hot 보존 단위 테스트 통과 | [High] |
| #14가 모든 한도차를 피트 DOM으로 보낸다 | [Medium] 코드 경로상 true, 렌더러 테스트 없음 |
| #12가 우발 리로드 데이터 손실을 운영에서 막는다 | [Low] 코드만 있음, native INCONCLUSIVE |
| #5–#9 미커밋 | [High] 거짓 (히스토리·파일 존재) |
| 대규모 밀집에서 spread 유발 이동이 문제 | [Low] 소규모 기각, 대규모 미재측정 |
| idle sway 오독 없음 | [Unknown] 관찰 없음 |

---

## 8. 부록 — 감사 시 본 명령

```bash
cd pitwall
npm test                          # 1 failed / 854 passed (855)
npx tsc --noEmit
npx vitest run tests/appMotion.test.ts tests/projection.test.ts
# A/B: HEAD projection 복원 시 appMotion PASS, 미커밋 복구 시 FAIL
git diff --stat
git log --oneline origin/main..HEAD
```

**관련 산출물**

- `REVIEW.md` — 원 리뷰 표
- `.debug-journal.md` — #13 진단 일지 (정리 후보)
- `pitwall/docs/2026-08-01-devils-advocate-docs-audit.md` — 문서 수치 감사 선례
- `PITWALL.md` §리로드 신뢰성 · CHECKLIST 미측정 표

---

*이 문서는 구현을 대신하지 않는다. Tier 0을 닫기 전에는 #13을 “완료”로 부르지 말 것.*
