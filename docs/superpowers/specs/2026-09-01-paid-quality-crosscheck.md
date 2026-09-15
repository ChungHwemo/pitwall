# PITWALL 유료 품질 — 잔여 교차검증

**2026-09-01** · 방식: 문서·PRD v2.0 유죄 추정. 워킹트리 실측만 무죄.
**게이트:** `npx tsc --noEmit` 0 · `npm test` **992 / 62 files**. HEAD `7ad0724` + 미커밋 품질 슬라이스.

한 줄: **파서 연료 거짓은 닫혔다. 재생 실기록·동의·솔트 기본값·검수표는 아직 거짓을 말한다.** 결제·공증·G1·8시간 힙은 코드 문제가 아니라 그대로 열림.

---

## 0. 판결

| 주장 (어제) | 오늘 판정 |
|---|---|
| QG1 실 임포터 연료 부재 | **부분.** LIVE 파서는 맞음. **커밋된 `events.real.jsonl` / `events.real-busy.jsonl`은 전 행 `fuel_pct` 있음** — 실기록 재생은 탱크를 그대로 그림 |
| QG2 문서 숫자 = 명령 | **부분.** README/PITWALL 테스트 수는 992/62. CHECKLIST 카탈로그는 여전히 **19개**. PITWALL 실기록 건수는 **1,302**인데 픽스처는 **441** |
| QG3 힙 위조 거부 | **테스트만.** `assertHeapPassMatchesElapsed`는 단위 테스트. `measureRuntime`은 `summarizeRuntime`만 씀 — 새 실행은 정직. 디스크 `heap-8h.json`은 여전히 `heapPass:true` + 3.70h |
| QG4 설치 솔트, `'pitwall-local'` 기본값 없음 | **실패.** LIVE는 `loadCarSalt()`. `toCarEvent(..., salt = CAR_SALT)` 기본값은 **`'pitwall-local'` 그대로**. v2.0 §4.2가 코드를 속임 |
| QG5 세션 키 스냅샷 거부 | **통과.** 테스트 + `liveSnapshotLeaks` |
| QG6 WAITING + 고장 부정 | **통과.** 범례·빈 포커스 카피. 사람 G1은 대체 아님 |
| QG7 네이티브 고지 | **연극.** 오버레이는 붙는다. Swift는 기동 즉시 테일. `onAllow`는 no-op. ingest는 동의와 무관 |
| 유료 SKU 가능 | **불가.** D9·서명·약관 그대로 |

---

## 1. 이번 슬라이스가 새로 만든 거짓

### L1 — PRD v2.0 §4.2가 구현을 과장 [P0 스펙]

> `toCarEvent`의 기본 솔트 `'pitwall-local'`을 제거한다.

코드 (`claudeCodeImport.ts:27,45`):

```ts
export const CAR_SALT = 'pitwall-local';
export function toCarEvent(raw: unknown, salt: string = CAR_SALT)
```

LIVE만 `this.salt = loadCarSalt()`. CLI `import:real`의 `toCarEvent(...)` 한 곳은 기본값을 탄다. 테스트 다수는 기본값에 기대. **설치별 솔트는 LIVE 경로뿐.**

반증 지표 그대로: `'pitwall-local'`이 기본 솔트로 남아 있다.

### L2 — 동의 오버레이가 읽기를 막지 않음 [P0 품질, 범위는 명시됨]

`PitwallApp.swift:54` `startTailing()`은 고지 전에 돈다. `browser.ts:141` `pitwallIngest`는 동의 검사 없음. `mountConsent(..., () => undefined)`.

v2.0 §4.5가 「Swift 테일 지연은 열린 항목」이라고 썼으므로 **스펙 위반은 아니다.** 「고지했다」를 「동의 후에만 읽는다」로 읽으면 위반. 판매 문장에 후자로 쓰면 허위.

### L3 — 실기록 재생은 연료를 여전히 심음 [P0 화면]

2026-09-01 픽스처 전수:

| 파일 | n | fuel_pct 있는 행 |
|---|---:|---:|
| events.real.jsonl | 441 | 441 |
| events.real-busy.jsonl | 7,375 | 7,375 |
| 데모 전부 | 전 행 | 전 행 |

LIVE 파서는 안 짓는다. **화면에서 「실기록」을 고르면 옛 import가 심은 탱크가 재생된다.** QG1을 「실 경로 전체」로 읽으면 실패. 「파서」로 읽으면 통과. 출하 화면은 재생을 판다.

### L4 — 연료 링 DOM은 그대로 [P2]

`trackRenderer.ts` hot 풀이 `fuelRing` 원을 항상 붙인다. `fuel_pct`를 dash로 쓰지 않는다 — 클래스 색 스트로크. LIVE에서 「게이지를 그리지 않음」은 **숫자 게이지**에만 해당. 장식 원은 남음. 「연료 링이 없다」고 쓰면 과장.

---

## 2. 닫히지 않은 잔여 (어제 목록)

| 항목 | 실측 | 닫는 방법 | 코드인가 |
|---|---|---|---|
| Swift 동의 전 테일 | `startTailing()` 직후. 고지와 직렬 아님 | 동의 메시지 전 테일 금지. Swift 테스트 없음 | Swift |
| 8시간 힙 | 경과 3.70h, 저장된 true는 옛 러너. 현재 함수면 null | `--ms 28800000`을 **끝까지** 돌리고 재계산 | 머신 타임 |
| G1 3초 ≥80% | 사람 0명 | 피험자 또는 판매 카피 「미측정」 | 사람 |
| `isInspectable=true` | `PitwallApp.swift:35`. CHECKLIST 프라이버시 행에 합격처럼 적힘 | 프로덕션 false. 단위 테스트 없음 | Swift |
| Developer ID / 결제 | D9 | 계정·공증. 이번 저장소 밖 | 인간 |

`measureRuntime` flush는 `summarizeRuntime`만 호출한다. 새 8시간 실행은 `heapPass: null`을 쓰다가 8시간을 넘겨야 true가 된다. **디스크 파일은 갱신되지 않으면 거짓 양성을 남긴다.**

---

## 3. 문서가 아직 유죄인 곳 (출하 카피)

역사 문서(HANDOFF, REVIEW 처리 기록, 2026-08 악마의 변호인)의 옛 테스트 수는 스냅샷으로 허용.

**현재 상태라고 적힌 파일**은 안 된다.

| 위치 | 주장 | 실측 | 심각도 |
|---|---|---|---|
| `PITWALL.md` §7 | OAuth를 키체인에서 헤더로만 | Swift 키체인 0 | P2 환각. 어제와 같음 |
| `PITWALL.md` §7 | 화면에 이름 없음 · k-익명성 10 | `carNames` UI. clamp만 | P0 카피 |
| `PITWALL.md` | 커밋 픽스처 1,302건 | `events.real.jsonl` **441** | P1 |
| `CHECKLIST.md` 카탈로그 | 19 / 19 | `MODEL_CATALOG` **25** | P2. 게이트 표 상단은 992로 고쳤음 |
| `CHECKLIST.md:251` | 설정 UI 제외, localStorage 직접 편집 | `settingsPanel.ts` 실재 | P2 |
| `CHECKLIST.md:219` | Inspector true를 프라이버시 합격 칸에 | 관찰이지 합격이 아님 | P1 표 오염 |
| `tests/integration.test.ts:156` | 「타이밍 타워를 그리지 않는다」 | `.timing-tower`/`ol`만 검사. `.tower`는 있음 | 테스트가 클래스명만 봄. PRIV-5′를 증명하지 않음 |

README 오프닝·하드 룰·테스트 수는 이번 슬라이스에서 맞춤. 빌드 5,449.1 kB는 **재빌드하지 않음** — 숫자 유지가 측정이 아님 [중간].

---

## 4. 실제로 닫힌 것 (재측정)

- LIVE/파서 `toCarEvent`·`build()`가 `fuel_pct: 100`을 안 넣음. 시뮬레이터는 넣음.
- `scoreCar`는 숫자 연료만 한도 점수.
- `limit_warn` + 연료 부재 → 무전 null (`연료 NaN%` 회귀 테스트).
- `loadCarSalt` 32 hex, 같은 키 재사용. `accountCar` 3번째 인자.
- `liveSnapshotLeaks`가 `"session_id"` / `"sessionId"`.
- 범례 WAITING. 0대 카피에 「고장이 아님」.
- 네이티브에서만 동의 DOM. 브라우저 데모는 null.
- `summarizeRuntime`: 경과 < 8h → `heapPass === null`. 위조 객체 테스트 있음.

이 목록을 「유료 품질 통과」로 올리면 L1–L3에 걸린다.

---

## 5. 보수적 다음 순서 (고칠 때)

코드로 닫히는 것만. 사람·Apple은 뒤에.

1. **PRD §4.2를 코드에 맞추거나**, `toCarEvent` 기본값을 제거한다. 둘 중 하나. 지금처럼 스펙이 코드를 이기면 v2.0이 v1.4와 같은 죄를 짓는다.
2. **실기록 픽스처에서 `fuel_pct`를 빼거나** 재생 시 무시. 안 빼면 「실기록」화면이 QG1을 배신한다.
3. Swift: 동의 전 `startTailing` 금지. Inspector 프로덕션 off. 테스트 하니스가 없으면 CHECKLIST에 **미완료**로만 남긴다.
4. CHECKLIST 카탈로그 19 → 25. 설정 UI 제외 행 삭제. Inspector를 합격 칸에서 빼기.
5. PITWALL §7 키체인·이름 없음·k-익명성 문장 삭제 또는 v2.0에 맞게.
6. 8시간 힙은 돌리기 전에는 합격 금지 — 함수는 이미 맞음.
7. G1은 사람.

결제·공증은 이 목록과 섞지 않는다.
