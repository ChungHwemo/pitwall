# PITWALL — 유료판매 품질 PRD

**PRD v2.0** · 2026-08-31 · 상태: **출하 정본. v1.4는 역사 문서. 출하 카피·IA·프라이버시는 이 파일이 이긴다.**

이 문서는 [v1.4](./2026-07-29-pitwall-prd.md)를 **출하 계약에서 대체한다.** v1.4의 LiteLLM 조직 벽·HMAC·레이아웃 A·타워 금지는 설계 이력이다. 결제·공증·LiteLLM 서버는 여전히 없다.

근거 날짜의 실측: 2026-08-31 · `npm test` **992 passed / 62 files** · `tsc --noEmit` 0 · 런타임 의존성 0 · Pages `https://chunghwemo.github.io/pitwall/` HTTP 200.

---

## 0. 한 줄

**유료 품질 = 화면·문서·게이트가 같은 사실을 말하고, 낯선 사람이 자기 로그로 3분 안에 LIVE를 이해하며, 없는 예산을 가득 찬 연료로 그리지 않는다.**

결제를 붙이는 버전이 아니다. D9(Pages 데모 + 이 기기 ad-hoc)는 유지한다. 결제·Developer ID를 이 PRD에 몰래 넣으면, 열리지 않는 앱에 돈을 받는 허위 표시가 된다.

---

## 0.1 가장 강한 반론

「유료판매 수준」을 Stripe·공증·App Store로 읽으면 이 저장소의 다음 작업은 코드가 아니다. Apple $99, 개인정보처리방침, 지원 메일, Gatekeeper를 넘는 서명이 먼저다. 그 전에 TDD로 기능을 쌓는 것은 데모에 페인트 칠하는 일이다.

그래서 이 PRD의 고객은 **지금 출하물**이다. 팔 수 있느냐가 아니라, **팔린다고 가정해도 환불을 요구하지 않을 정직함**이 합격선이다.

Clawdmeter는 하드웨어 SKU가 있고, TokenMonitor는 Notarized Developer ID이며, tokscale은 `bunx` 한 줄로 40+ 에이전트를 읽는다. PITWALL이 이기는 자리는 대시보드가 아니라 **세컨드 모니터 앰비언트**다. 그 자리가 거짓을 말하는 순간 제품은 죽는다 — 원래 PRD의 P0과 같다.

---

## 1. 교차검증 판결 [High]

문서 유죄 추정. 2026-08-31 재측정.

### 1.1 출하물이 문서와 다른 제품이다

| 문서 주장 | 출처 | 코드 실체 | 심각도 |
|---|---|---|---|
| LiteLLM 프록시 로그를 내구 레이스로 번역 | README:3, v1.4 §0 | 네이티브가 `~/.claude/projects` · `~/.codex` · `~/.grok`를 2초 폴링. LiteLLM 어댑터 0 | P0 허위 카피 |
| 차량 = 사람 1인 | v1.4 §18, D7 미결 | Claude = `accountUuid` 해시. Codex = `codexAccountId` 없으면 벤더 키 `'codex'`. **Grok/Copilot은 계정 키 없이 벤더 1대** (`LiveSource.ts:139,145`) | P0. 「내 차 한 대」가 아님. 한 사람이 벤더 수만큼 굴러감 |
| `car_id = HMAC(user_id, deployment_salt)` | v1.4 PRIV-3 | 고정 솔트 `'pitwall-local'` + FNV-1a 32비트. HMAC 0, 배포별 솔트 0 | P0 프라이버시 허위 |
| k-익명성 하한 10, 완화 불가 | v1.4 §12.1, `settings.ts` | `minTeamSizeForIndividual`는 clamp만. 렌더·리듀서 0 참조 | P0 죽은 가드레일 |
| 타이밍 타워를 만들지 않는다 / 레이아웃 A 트랙 65%+카메라 3–5 | v1.4 PRIV-5·§6.1, README:113 | 타워가 척추 (`grid-template-areas` tower/detail). 카메라 카드 렌더러 없음. `.cams`는 선택 피드 | P0 산 화면과 다른 화면. 코드 의도는 타워=카넘버 표, 순위 아님 |
| 설정 UI는 v1 제외, localStorage 직접 편집 | CHECKLIST:251 | `settingsPanel.ts` 실재 | P2 검수표 부패 |
| 테스트 858 / 53파일, CHECKLIST 256 / 20파일 | README:8, PITWALL:3, CHECKLIST:15 | **976 / 60** | P2. 출시 검수가 거짓말 |
| 카탈로그 21개 모델 | README:39 | `MODEL_CATALOG.length === 25` | P2 |
| `LAP_TOKENS` 20만 복귀 | v1.4 Q10, CHECKLIST:112 | `trackModel.ts:34` **50_000**. 범례도 「작업 토큰 5만」 | P1 문서 모순. 코드가 정본 |
| 연료 기본 $60 | D8, CHECKLIST:93 | 실 임포터는 `fuel_pct: 100` 하드코딩. 예산 소스 0 | P0 화면이 가득 찬 탱크를 지어냄 |
| 8시간 힙 ≤ 50MB | v1.4 §11.3, CHECKLIST:215 | `heap-8h.json` 경과 **3.70h**, 저장된 `heapPass: true`. 현재 `summarizeRuntime`으로 재계산하면 **`null`** | P0 게이트 거짓 양성 산출물 |
| v1 구현 완료 | README:7 | `package.json` / Info.plist **0.1.0**. 3초 인지 0명. 라디오 가독성 미측정 | P1 「완료」남용 |
| OAuth 토큰은 키체인에서 헤더로만 | PITWALL:227 | Swift 키체인 코드 0. `~/.claude.json`의 `accountUuid`만 읽음 | P2 문서 환각 |
| 방송 렌더러가 잠긴 UI | DESIGN.md §5, 방송 PRD | `main.ts:247-249` `supported: () => false`. 레거시 `TrackRenderer` | P1. 의도적 롤백. 출하 UI가 아님 |

### 1.2 이미 맞는 것

- 런타임 의존성 0, 단일 HTML, Pages 데모에 실기록 혼입 CI 차단.
- LIVE는 네이티브 브리지에서만. 브라우저는 LIVE를 가장하지 않음.
- `CarEvent`에 프롬프트·응답 필드 없음. 이메일 키를 읽지 않음.
- 클래스 색+형태 이중 인코딩. 타워는 사용량으로 줄을 바꾸지 않음.
- 헤드풀 90s `demo-large`: **58.94 fps**, `fpsPass=true`, 힙 Δ **+0.031 MB**.
- `summarizeRuntime`의 8시간 규칙 자체는 테스트가 강제함. 깨진 것은 **옛 러너가 남긴 JSON**.

### 1.3 코드가 아닌 차단

| 항목 | 이유 |
|---|---|
| Developer ID / 공증 | D9. Apple 계정 |
| 3초 인지 ≥ 80% (G1) | 사람 피험자. 에이전트 스크린샷 대체 금지 |
| 8시간 힙을 **끝까지** 돌리기 | 머신 타임. 게이트 함수는 이미 있음 |
| 개인정보처리방침·약관·지원 메일 | 인간. 유료 SKU 전까지 비목표 |
| LiteLLM 실로그 / Q1·Q6 | v1.5 |
| F1 / PITWALL 상표 | 변호사 |

---

## 2. 제품 정체 — 이번에 못 박는다

### 2.1 한 줄 카피 (README §0 교체문)

**로컬 코딩 에이전트 로그를 8시간 내구 레이스 중계 화면으로 번역하는, 세컨드 모니터에 상시 띄워두는 앰비언트 디스플레이.**

LiteLLM은 v1.5 문장에만 남긴다. 지금 출하물에 「프록시」를 쓰면 거짓이다.

### 2.2 닫는 결정

| ID | 결정 | 근거 |
|---|---|---|
| **D7** | 차량 = **로그가 준 계정 키**. 없으면 **벤더 1대**. 사람·프로젝트 아님 | Claude: `accountUuid`. Codex: `codexAccountId` 또는 `'codex'`. Grok/Copilot: `'grok'` / `'copilot'` 싱글톤 (`LiveSource.ts:124-145`). 이번 슬라이스에서 Grok을 계정 단위로 쪼개지 않는다 — 로그에 계정 키가 없다 |
| **D11** | 이 PRD의 고객은 **개인 로컬 LIVE**. 조직 벽은 v1.5 | 출하 경로가 그것뿐 |
| **D12** | 유료 품질 ≠ 결제. Stripe·라이선스 키·트라이얼 없음 | D9 + 서명 없는 바이너리 |
| **D8** | 개인 LIVE에서 **연료 게이지는 없다**. 시뮬레이터만 연료를 태운다 | 예산 소스 없음. `fuel_pct: 100`은 거짓 |
| **Q4** | 클래스 = **출력 단가 밴드**. 능력 티어 아님 | `models.ts:11-17`이 이미 채택. 표의 「미정」은 삭제 |
| **PRIV-5′** | 타이밍 타워는 허용한다. **금지하는 것은 순위 칸과 사용량 정렬** | 코드가 이미 이렇게 동작. v1.4 문구가 구식 |
| **PRIV-3′** | 로컬 `car_id`는 HMAC이 아니다. **설치별 솔트 + FNV-1a**. 솔트 `'pitwall-local'` 공유 금지 | 서버가 없는 제품에 어댑터 HMAC을 주장하는 것이 허위 |
| **k-익명성** | 개인 LIVE(계정 1–3)에 적용하지 않는다. 조직 설정 파일의 하한 10은 v1.5까지 **화면 비활성**. 적용된다고 쓰지 말 것 | 죽은 설정을 가드레일로 광고하지 않는다 |
| **방송 렌더러** | `supported: () => false` 유지. 피트 레인이 두 번째 코스로 보이는 한 출하 UI가 아님 | HANDOFF 2026-08-09 |
| **랩** | `LAP_TOKENS = 50_000`. 20만은 폐기된 문서 | 코드·범례가 일치 |
| **레이아웃** | 출하 UI = **타워 우선 스플릿**. v1.4 레이아웃 A(트랙 65%+카메라 카드)는 폐기 | `style.css` grid, `cameraRenderer.ts` 부재. 방송 렌더러도 출하 UI 아님 |

### 2.3 페르소나

**P1′ 본인.** 자기 Mac에서 Claude/Codex/Grok을 쓴다. 세컨드 모니터. 관리자가 아니다.

**P2 관전자.** 데모 HTML. 실기록 없음.

관리자 페르소나는 계속 제외. 개인 이름을 붙이는 설정(`pitwall.carNames`)은 **이 기기 라벨**이며 기본은 꺼져 있다. 켠 것은 PRIV-1 위반이 아니라 사용자가 자기 화면에 쓴 메모다. 카피에서 「이름 없음」을 절대 문장으로 쓰지 말 것 — 설정이 있으면 거짓이다. 기본 꺼짐만 말한다.

---

## 3. 목표 / 비목표

### 3.1 이번 품질 목표

| # | 목표 | 검증 |
|---|---|---|
| QG1 | 실 임포터가 연료를 지어내지 않는다 | `toCarEvent` / `accountCar` 경로 `fuel_pct === undefined`. 디렉터는 부재 연료로 한도 점수를 주지 않음 |
| QG2 | 문서 숫자 = 오늘 명령 출력 | README·PITWALL 테스트 수·모델 수·랩 토큰이 `npm test` / `MODEL_CATALOG` / `LAP_TOKENS`와 같음 |
| QG3 | 8시간 힙 산출물이 거짓 합격을 저장하지 못한다 | `summarizeRuntime`과 다른 `heapPass`를 쓰면 테스트 실패. 경과 < 8h면 `null`만 허용 |
| QG4 | LIVE 설치마다 `car_id` 솔트가 다르다 | `LiveSource`가 `loadCarSalt()`를 넘김. `toCarEvent` 기본값 `'pitwall-local'`은 남음 — 전체 경로 금지는 미완 |
| QG5 | 스냅샷 JSON에 세션 키가 있으면 저장 거부 | `CarState`에는 지금 `session_id`가 없다. `liveSnapshotLeaks`가 `"session_id"` / `sessionId` 키를 추가로 거절해, 이후 직렬화가 세션을 심으면 저장이 실패한다. 기존 uuid·본문·이메일 가드 유지 |
| QG6 | LIVE 첫 화면이 「고장」으로 안 읽힌다 | 범례에 `WAITING`. 차량 0대일 때 코스 + 「관측 차량 없음」+ 「최근 호출이 없어 트랙이 비어 있음」 |
| QG7 | 네이티브가 로그 폴링을 고지한다 | 동의 플래그 없이 테일을 「시작했다」고 화면에 쓰지 않음. JS 오버레이가 기본 |

### 3.2 비목표 (이번 작업)

| 비목표 | 이유 |
|---|---|
| Stripe / Paddle / 라이선스 키 | 서명 없는 바이너리에 결제 = 허위 |
| Developer ID · 공증 · Sparkle | D9 |
| LiteLLM 어댑터 · 서버 · 텔레메트리 | v1.5, outbound-0 |
| 방송 렌더러 재활성화 | 피트 레인 기하가 미증명 |
| G1 사람 테스트 | 사람. 이 PRD는 빈 화면 카피만 닫는다 |
| tokscale급 40 파서 | 범위. 지금 파서는 claude / codex / grok (+ copilot 파서, 테일 없음) |
| `WKWebView.isInspectable=false`를 단위 테스트 | Swift. 릴리스 체크리스트 항목으로만 |
| HMAC으로 PRIV-3를 「고치기」 | 서버 없는 제품에 WebCrypto HMAC은 연극. 설치 솔트로 충분 |

---

## 4. 데이터 · 화면 계약

### 4.1 연료는 시뮬레이터 전용

```
시뮬레이터: fuel_pct 0–100, 호출마다 감소, 0이면 RETIRED
실 임포터·LIVE: fuel_pct 부재. 링·무전·디렉터 한도점수를 그리지 않음
한도(타이어): 소스가 준 tyre_pct만. 없으면 게이지 숨김 (기존)
비용: cost_usd · $/시간은 관측값. 연료가 아님
```

`CarEvent.fuel_pct`와 `CarState.fuel_pct`는 `tyre_pct`와 같이 **optional**. 리듀서는 부재를 100으로 채우지 않는다.

디렉터: `fuel_pct !== undefined && fuel_pct < 20`일 때만 한도 점수. 타이어는 기존.

라디오 `limit_warn`: `fuel_pct`가 없으면 그 문구를 만들지 않는다. 「RETIRED — 한도 소진」은 `kind === 'retire'` 유지.

### 4.2 솔트

```
localStorage['pitwall.carSalt']  // 설치 때 한 번 생성한 16바이트 hex
car_id = fnv1a(`${salt}:${vendor}:${accountId}`) → `car-` + 8 hex
```

LIVE(`LiveSource`)만 `loadCarSalt()`를 넘긴다. `toCarEvent`의 기본 인자는 아직 `'pitwall-local'`(`CAR_SALT`)이다 — 파서 테스트·CLI 픽스처 안정용. **「기본값 제거」는 미완.** 기본값이 공유 상수인 한 QG4는 LIVE 경로에만 해당한다. (`2026-09-01-paid-quality-crosscheck.md` L1)

### 4.3 스냅샷 유출

`liveSnapshotLeaks`가 참이면 저장하지 않는다 (기존). `RaceState` 스냅샷에는 지금 세션 필드가 없다. 그래도 키가 생기면 막는다.

추가 패턴: `"session_id"` · `sessionId` (키 이름). 기존: `accountUuid`, `oauthAccount`, `emailAddress`, `"messages"`, `"response"`, 이메일 정규식.

`CarEvent.session_id`는 메모리·피드에 남을 수 있다. localStorage로 나가는 JSON에만 이 가드가 적용된다.

### 4.4 LIVE 빈 화면

관측 차량 0:

- 코스는 그대로 (N3: 빈 공간을 채우지 않음).
- 텍스트: `관측 차량 없음`.
- 보조: `최근 호출이 없어 트랙이 비어 있음 — 고장이 아님`.
- HUD LIVE 상태: 기존 `WAITING` / `CONNECTED` / `SYNCING` / 경과 stale.
- 범례 ROWS에 `WAITING` — `실시간 소스가 연결됐으나 아직 처리한 이벤트가 없음`.

### 4.5 동의 (JS 심)

키 `pitwall.consent.v1`. 값 `'1'`만 동의.

네이티브 부트에서 키가 없으면 화면 중앙에 고정 오버레이:

> 이 앱은 `~/.claude` · `~/.codex` · `~/.grok` 로그에서 사용량 숫자만 읽습니다. 프롬프트·응답 본문은 버립니다. 네트워크로 보내지 않습니다.

버튼: `읽기 허용` / (브라우저 데모에는 오버레이 없음 — 테일이 없음).

Swift는 지금 기동 즉시 테일한다. 이번 슬라이스는 **JS 고지**를 닫는다. 테일 지연은 Swift 변경이라 단위 테스트가 없다. 체크리스트에 「동의 전 테일」을 열린 항목으로 남긴다 — 닫았다고 쓰지 말 것.

---

## 5. 문서 정본

| 숫자 | 정본 | 폐기 |
|---|---|---|
| 테스트 | 명령 출력. 오늘 992 / 62 | 옛 README 858, CHECKLIST 256 |
| 모델 | `MODEL_CATALOG.length` (25) | 「21개」 |
| 랩 | `LAP_TOKENS` 50_000 | Q10의 20만, CHECKLIST 20만/500만 |
| 힙 | `summarizeRuntime`의 `heapPass`. 경과 < 8h면 null | `heap-8h.json`의 `true` |
| 렌더러 | `data-renderer="legacy"` | 방송 PRD를 「구현됨」으로 읽는 해석 |
| 버전 | 0.1.0 | 「v1 구현 완료」를 출시로 읽는 해석. 문장은 「시뮬레이터 + 로컬 LIVE 동작 중. 유료 품질 게이트 미통과」 |

CHECKLIST 상단 자동 게이트 표는 **오늘 명령으로 다시 쓴다.** 256 tests를 남겨 두면 이 PRD를 위반한다.

---

## 6. 성공 / 반증

### 6.1 이번 슬라이스 성공

- QG1–QG6 테스트가 RED를 본 뒤 GREEN.
- QG2 문서가 같은 커밋에서 일치.
- `npm test` · `tsc --noEmit` 유지.
- 시뮬레이터 연료 소진·리타이어 회귀는 살아 있음.

### 6.2 반증 (하나면 설계 재검토)

- 실기록 화면에서 연료 링이 100%로 돌아온다.
- README 테스트 수가 CI 출력과 다시 어긋난다.
- LIVE가 `loadCarSalt()` 대신 `CAR_SALT` 기본값으로 돌아간다.
- k-익명성 10이 「강제된다」고 다시 쓰인다.

### 6.3 유료 SKU를 나중에 열 조건

아래를 **전부** 닫기 전에는 가격을 붙이지 않는다.

1. Developer ID + 공증 + Gatekeeper 기본 통과
2. 이 PRD QG1–QG7 GREEN
3. 8시간 힙 표본 경과 ≥ 8h 이고 `heapPass === true` (재계산)
4. 개인정보 고지문 (한국어) + 지원 연락처
5. G1을 사람 3명 이상 측정했거나, 「미측정」을 판매 페이지에 명시

---

## 7. 테스트 심 (TDD가 밟는 경계)

구현 전에 확정. 테스트는 여기만 본다.

| 심 | 공개 함수 | 관측 |
|---|---|---|
| S1 연료 부재 | `toCarEvent`, `build`/`codexEvent`/`grokEvent`, `scoreCar`, `eventRadio`, `applyEvent` | 실 경로 `fuel_pct` 부재. 디렉터 한도점수 없음. 리듀서가 100을 안 채움 |
| S2 설치 솔트 | `loadCarSalt`, `accountCar`, `toCarEvent` | 같은 계정 다른 솔트 → 다른 id. 저장 키 `pitwall.carSalt` |
| S3 스냅샷 | `liveSnapshotLeaks`, `saveLiveSnapshot` | `"session_id"` / `sessionId` 키가 있는 JSON은 저장하지 않음. 정상 스냅샷은 계속 저장 |
| S4 범례·공란 | `Legend`, 트랙 공란 카피 함수 | `WAITING` 문구. 0대 카피가 고장 부정이 아님 |
| S5 동의 | `loadConsent` / `saveConsent` | 키 없으면 미동의. `'1'`만 동의 |
| S6 힙 정직 | `summarizeRuntime` | 기존 테스트 유지. 저장된 리포트 `heapPass`가 재계산과 다르면 실패하는 검사 추가 |

모의 객체로 내부 협업자를 검증하지 않는다. 기대값은 리터럴.

---

## 8. 구현 순서

1. S1 연료 부재 (화면 거짓말)
2. S6 힙 산출물 정직 (게이트 거짓말)
3. S2 솔트 (프라이버시 허위)
4. S3 스냅샷
5. S4 빈 화면
6. S5 동의
7. 문서 숫자 동기화 (QG2)

한 심 = 실패 테스트 → 최소 구현 → 통과. 다음 심으로.

계획 파일: `docs/superpowers/plans/2026-08-31-paid-quality-tdd.md`

---

## 9. Key Decisions

1. **품질이지 결제가 아니다** — 서명 없는 앱에 SKU를 붙이지 않는다.
2. **카피는 로컬 에이전트 로그** — LiteLLM은 v1.5.
3. **연료는 시뮬레이터 전용** — 실데이터 100% 탱크는 P0.
4. **HMAC 주장을 삭제** — 설치 솔트 + FNV.
5. **타워는 순위가 아니다** — PRIV-5를 코드에 맞게 고친다.
6. **k-익명성은 개인 제품에서 침묵** — 죽은 설정을 광고하지 않는다.
7. **8시간 힙은 경과로만 판정** — 요청 `--ms`와 저장된 거짓 `true`는 폐기.

---

## 10. Open Questions

없음. D9·outbound-0·개인 고객은 이미 잠겼다. 결제를 원하면 이 문서 6.3을 새 PRD로 연다 — 이번 슬라이스에 섞지 않는다.

---

## 11. 출하 정보 구조 (정본)

v1.4 §6.1 레이아웃 A(트랙 ~65% + 카메라 카드 3–5)는 **폐기**. 출하 화면은 타워가 척추다.

```
┌ HUD ─ 시계 · 페이스 · 페이즈 · 출처 배지 · LIVE 상태 · 범례 · 설정 ─┐
├ 타워 (왼쪽, 계정 한 줄) ──────────────┬ 트랙 SVG + 선택/방송 피드 ─┤
│ 카넘버 · 모델 · 스파크 · 상태 · 한도 · $ │  코스 전체. 포커스가 코스를  │
│ 접힘 N대는 숨긴 줄을 명시              │  리사이즈하지 않음           │
├ 모델 합계 ────────────────────────────┴───────────────────────────┤
└ 라디오 ───────────────────────────────────────────────────────────┘
```

1280 이상: `grid-template-areas: "hud hud" "tower detail" "radio radio"`. 375/768: HUD → 타워 → 트랙/피드 → 모델 → 라디오. 문서가 유일한 세로 스크롤.

### 11.1 타워

- 한 줄 = 차 한 대 = D7 식별자.
- 정렬 키 = `car_number` 오름차순. 사용량·비용으로 줄을 바꾸지 않는다.
- 칸: 클래스 막대(색+형태는 트랙 글리프와 동일 축) · 카넘버 또는 로컬 라벨 · 모델/프로바이더 칩 · 스파크 · RUN/IDLE/PIT·LIM/PIT·ERR · 한도 게이지(소스 있을 때만) · 비용 · 속도.
- 줄이 칸을 넘으면 숨기고 `접힘 N대`. 조용한 truncation 금지.
- 클릭/Enter/Space로 선택. 선택은 디렉터 자동 포커스를 이긴다.

### 11.2 트랙

- 레거시 `TrackRenderer`. `data-renderer="legacy"`. 방송 렌더러는 출하 아님.
- 위치 = 누적 작업 토큰 (`LAP_TOKENS = 50_000`). 밝기 = 최근 `work_per_min`.
- 클래스 = 색 + 형태. 트랙 위 텍스트 라벨 없음.
- 연료 링: `fuel_pct`가 숫자일 때만. LIVE에서는 그리지 않음 (QG1).
- 정지: ERROR와 LIMIT은 다른 모양+문구. 피트에서 이동하지 않음.
- 0대: 코스 유지 + §4.4 카피.

### 11.3 HUD · LIVE 상태

우선순위: `pending > 0` → `SYNCING n`. 마지막 이벤트 경과 > 5분 → `STALE DATA`. 이벤트 0 → `WAITING`. 그 외 `CONNECTED`. 하트비트가 없으므로 stale을 연결 끊김이라고 쓰지 않는다.

출처 배지: 지어낸 재생 = `DEMO` + `지어낸 데이터`. 실기록 재생 = DEMO 없음. LIVE = 네이티브 브리지가 실제로 흐를 때만.

### 11.4 라디오

이벤트 무전은 상태 변화만. 루틴 캐시 규칙: 표본 ≥ 10이고 히트율 < 80%. 비교 문장 금지. 연료 문구는 `fuel_pct`가 숫자일 때만.

---

## 12. 네이티브 LIVE 파이프라인

```
LogTail (2초 폴링)
  ~/.claude/projects
  ~/.codex
  ~/.grok
        │  새 줄만. 첫 파일은 끝 표시
        ▼
PitwallApp.slimLogLine  → content/text/thinking/rawOutput 삭제
        ▼
window.pitwallIngest(vendor, lines[])
        ▼
LiveSource.parse  → CarEvent (화이트리스트)
        ▼
reducer → RaceState → 타워/트랙/라디오
```

규칙:

- 파서는 Swift에 두지 않는다. 두 화면이 다른 사실을 말하면 제품이 죽는다.
- `window.pitwallLive(accounts)`가 오기 전에 ingest하면 안 된다. Swift는 함수가 생길 때까지 100ms × 20 재시도. 2초를 넘기면 LIVE로 못 바뀐다 — 이 한계를 「고쳤다」고 쓰지 말 것.
- 스냅샷은 `pitwall.live`. TTL 12시간. 유출 가드는 §4.3.
- 브라우저에서 실시간 항목을 골라도 브리지가 없으면 LIVE라고 가장하지 않는다.

Copilot 파서는 있고 테일은 없다. 화면에 Copilot 차가 없다고 고장이 아니다.

---

## 13. 프라이버시 정본 (출하)

v1.4 §12를 로컬 제품에 다시 쓴다. 협상 불가.

| # | 규칙 | 출하 실체 |
|---|---|---|
| PRIV-1′ | **기본 익명.** 카넘버 + 클래스. 이름은 설정에서 사용자가 켠 이 기기 라벨만 | `pitwall.carNames`. 카피에 「이름 없음」절대 문장 금지 |
| PRIV-2 | 필수 로그인·회원가입 없음 | 유지 |
| PRIV-3′ | `car_id` = 설치 솔트 + FNV-1a. HMAC이 아님. 원문 uuid는 화면·스냅샷에 안 나감 | §4.2 |
| PRIV-4 | 프롬프트·응답 필드 없음 | `CarEvent` 스키마 |
| PRIV-5′ | 순위 칸·사용량 정렬 금지. 타워는 허용 | §11.1 |
| PRIV-6 | 연봉 HUD는 localStorage만 | 유지 |
| PRIV-7 | 관리자 실명 모드 없음 | 유지 |
| PRIV-8 | 파서는 화이트리스트만 | `claudeCodeImport.ALLOWED`, Swift `stripBulky` |
| PRIV-9 | **고지.** 네이티브가 로그 디렉터리를 읽는다는 사실을 화면이 말한다 | §4.5. Swift 테일 지연은 열린 항목 |
| PRIV-10 | outbound 런타임 요청 0. 조직 설정 파일 GET만 | 유지 |

k-익명성 하한 10은 **개인 LIVE에 적용하지 않는다.** 조직 설정 키는 남겨도 화면이 읽지 않는다. 「강제된다」고 쓰면 거짓이다.

---

## 14. 은유 사전 (출하)

v1.4 §5에서 출하와 다른 행만 고친다.

| 레이싱 | 실제 | 출하 |
|---|---|---|
| 차량 | 로그가 준 계정 키, 없으면 벤더 1대 | D7 |
| 달린 거리 | 작업 토큰 = (prompt − cache_read) + completion (+ reasoning) | `LAP_TOKENS = 50_000` |
| 연료 | 시뮬레이터 일 예산만 | LIVE는 부재. 게이지 없음 |
| 타이어 | 벤더 한도 창 | 소스 없으면 게이지 없음 |
| 페이스 | 최근 창 `$/시간` · `tok/분` | 레이스 전체 평균 아님 |
| 타워 | 카넘버 고정순 표 | 순위 아님 |
| 클래스 | 출력 단가 밴드 H/P/GT | Q4 닫힘 |

금지 은유 유지: 종합 순위, 포디움, 챔피언십, 오버테이크 카운트.

---

## 15. 시나리오 (개인 LIVE)

**S1′ 아침.** 앱을 연다. 동의 전이면 고지. 최근 호출이 없으면 `LIVE · WAITING`과 빈 코스. 「고장이 아님」.

**S2 곁눈질.** 3초. 타워에서 붐빔/한산, 트랙에서 분포, 빨간/한도 표식이 사고. 연료 링으로 예산을 읽지 않는다.

**S3 선택.** 타워나 차를 누르면 그 계정의 호출 피드. 다시 누르면 해제. 디렉터가 훔치지 않는다.

**S4 체커기.** 근무 종료 후 요약 카드. 조직 순위 없음.

시뮬레이터 시나리오(포메이션 랩·스타트 라이트)는 데모 데이터셋에서만. LIVE의 근무 창은 오늘 활동에서 파생한다. 09:00–18:00을 고집하면 실측상 하루 작업의 상당 부분이 창 밖으로 나간다.

---

## 16. 출하 스키마 (코드 정본)

`CarEvent.ts`는 epoch ms다. v1.4의 ISO8601 `ts`는 폐기.

```ts
interface CarEvent {
  ts: number;                 // epoch ms
  car_id: string;             // car- + 8 hex
  car_number: number;         // 1–999
  car_class: 'H' | 'P' | 'GT';
  model: string;
  kind: EventKind;
  session_id?: string;        // 메모리·피드. 스냅샷 JSON 키로는 저장 거부
  skill?: string;
  tokens: {
    prompt: number;
    completion: number;
    cache_read?: number;
    reasoning?: number;
  };
  cache_hit: boolean;
  cost_usd: number;
  latency_ms: number;
  ttft_ms?: number;
  status: 'ok' | 'error';
  error_code?: string;
  fuel_pct?: number;          // 시뮬레이터만. LIVE는 부재
  tyre_pct?: number;
  limit_window_minutes?: number;
  limit_resets_at?: number;
  limit_observed_at?: number;
  wall_ts?: number;
}
```

`CarDailyRollup`은 출하에 없다. v1.5.

---

## 17. 수용 게이트 (유료 품질)

빈칸이면 「유료 품질 통과」라고 쓰지 않는다.

| 게이트 | 합격 |
|---|---|
| `npm test` · `tsc --noEmit` | 전부 통과. 문서 숫자가 같은 출력 |
| QG1 | 실 이벤트 `fuel_pct === undefined`. 시뮬레이터 연료 회귀 유지 |
| QG3 | `assertHeapPassMatchesElapsed`. 경과 < 8h면 `heapPass === null` |
| QG4 | LIVE만 설치 솔트. 파서 기본값 `'pitwall-local'`은 잔여 |
| QG5 | 세션 키 스냅샷 저장 거부 |
| QG6 | 범례 WAITING. 0대 카피에 고장 부정 |
| QG7 | 네이티브 미동의 시 고지 오버레이 |
| `release:check` | 공개 HTML에 실기록 0 |
| 8시간 힙 | 표본 경과 ≥ 8h 이고 재계산 `heapPass === true`. 그 전 합격 금지 |
| G1 3초 | 사람 측정 또는 판매 카피에 「미측정」 |

---

## 18. PR Plan

1. **fuel-honest** — Task 1. 실 이벤트 연료 제거.
2. **heap-honest** — Task 2. 위조 `heapPass` 거부.
3. **install-salt** — Task 3. 공유 솔트 폐기.
4. **snapshot-session** — Task 4.
5. **empty-live** — Task 5.
6. **consent-overlay** — Task 6. Swift 테일 지연은 후속.
7. **doc-sync** — Task 7. README/CHECKLIST/v1.4 포인터.

각 PR은 단독으로 테스트 그린이어야 한다. 계획: `docs/superpowers/plans/2026-08-31-paid-quality-tdd.md`.

