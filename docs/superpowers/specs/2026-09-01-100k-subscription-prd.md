# PITWALL — ₩10만/월 조직 벽 구독 PRD

**PRD v3.0** · 2026-09-01 · 상태: **스펙. 구현은 슬라이스 0 TDD부터. Stripe는 이 문서에 없다.**

출하 정본의 품질 계약은 [v2.0](./2026-08-31-paid-quality-prd.md). 이 문서는 **누가 얼마를 왜 내나**를 덮는다. 벤치: [2026-09-01-100k-subscription-benchmark.md](../../reference/2026-09-01-100k-subscription-benchmark.md). 잔여 거짓: [2026-09-01-paid-quality-crosscheck.md](./2026-09-01-paid-quality-crosscheck.md).

---

## 0. 한 줄

**₩100,000/월은 조직의 세컨드 모니터 한 면이다. 개인 Claude 로그 뷰어가 아니다.**

환율 가정 1,400 KRW/USD → ≈ $71. 시장에서 그 칸은 Helicone Pro $79다. tokscale은 같은 개인 일을 $0에 한다.

---

## 0.1 가장 강한 반론

지금 출하물에 ₩10만을 붙이면 사기다. 서버 없음, 서명 ad-hoc, 차량 1–3대, LiteLLM 없음, 약관 없음, 8시간 힙 미완료, 동의 전 테일. 그 상태의 공정가는 $0이다.

그래서 이 PRD는 「버튼을 그려 월 10만」이 아니다. **조직 벽 SKU의 합격선**이다. 개인 LIVE는 무료 면으로 남긴다 (v2.0 D11).

---

## 1. 접근 3개

| | A 개인 월구독 | **B 조직 벽 정액 (채택)** | C 좌석제 |
|---|---|---|---|
| 가격 | ₩10만/인 | **₩10만/월 · 벽 1면** | ₩1만×N석 |
| 사는 사람 | 개인 개발자 | 팀 리드 / AI 플랫폼 | HR·관리자 |
| 경쟁 | tokscale $0 | 없음 (앰비언트 공백) | LangSmith $39/석 |
| G4 | 유지 가능 | 유지 | **감시 도구화** |
| 판정 | 기각 | **채택** | 기각 |

B만 벤치와 PRIV-5′를 동시에 만족한다. 벽 1면 = 디스플레이 1개 + 조직 차량 N대(하한 10). 좌석을 안 판다.

---

## 2. SKU

| | Free (지금 출하) | **Wall ₩100,000/월** |
|---|---|---|
| 고객 | 본인 Mac | 조직 세컨드 모니터 |
| 데이터 | 로컬 Claude/Codex/Grok | 조직 이벤트 스트림 (LiteLLM 또는 합의된 JSONL). v1.5 어댑터 |
| 차량 | 벤더×계정, 1–3대 허용 | **k≥10 또는 집계만.** 개인 줄 금지 |
| 연료 | 시뮬레이터만 | 조직 예산 소스. 없으면 게이지 숨김 |
| 배포 | ad-hoc / Pages 데모 | 공증 Mac **또는** kiosk HTML+로컬 라이선스 |
| 결제 | 없음 | 월 청구. 이 슬라이스는 **라이선스 시계만** |
| 지원 | 없음 | 메일. 2영업일 응답을 카피에 못 박기 전엔 「지원 창구 준비」 |
| 약관 | MIT 무보증 | 한국어 이용약관·개인정보 처리방침 URL |

연 ₩1,000,000(2개월 할인)은 나중에. 지금 정본은 월 ₩100,000.

---

## 3. ₩10만을 받기 전에 닫을 게이트

빈칸이면 구독 판매를 **시작했다고 쓰지 않는다.**

### 3.1 정직 (v2.0 잔여, 슬라이스 0)

| # | 게이트 | 합격 |
|---|---|---|
| W0 | 관측 재생(`synthetic: false`)은 `fuel_pct`를 버린다 | 픽스처에 숫자가 있어도 리듀서에 안 들어감 |
| W1 | LIVE 솔트는 설치별. 파서 기본 `CAR_SALT`는 CLI/테스트만 | v2.0 QG4 수정문과 같음 |
| W2 | 동의 없이 「읽기 시작」을 화면에 쓰지 않음 | Swift 테일 지연은 별도. JS ingest는 미동의면 drop |

### 3.2 구독 도메인 (슬라이스 1, 서버 없이)

| # | 게이트 | 합격 |
|---|---|---|
| W3 | `WallLicense` 만료 시계 | `now >= validUntil` → `expired`. 만료면 조직 차량을 그리지 않고 문구 |
| W4 | `maxCars` 초과는 `+N`으로 명시 | 조용한 truncation 금지 |
| W5 | 조직 모드에서 차량 < 10이면 개인 타워 줄 없음 | 집계 한 줄. k-익명성이 **화면을 바꿈** |

### 3.3 이 저장소 밖 (슬라이스 2+)

결제 사업자, Developer ID, 개인정보 처리방침 본문, G1 사람 테스트, 8시간 힙 실측, LiteLLM 어댑터. 여기 없으면 ₩10만 청구 금지.

---

## 4. 라이선스 계약 (TDD 심)

서버 없는 첫 심. 결제 웹훅은 없다. 시계와 상한만.

```ts
export interface WallLicense {
  orgId: string;
  wallId: string;
  validUntil: number; // epoch ms
  maxCars: number;    // >= 10
  minTeamSize: number; // 하한 10. 완화 불가
}

export type LicenseState = 'active' | 'expired' | 'invalid';

export function licenseState(lic: WallLicense | null, now: number): LicenseState;
export function displayMode(carCount: number, lic: WallLicense): 'individual' | 'aggregate';
export function stripObservedFuel<T extends { fuel_pct?: number }>(
  events: T[],
  synthetic: boolean,
): T[];
```

규칙:

- `null` / `orgId === ''` / `maxCars < 10` / `minTeamSize < 10` → `invalid`
- `now >= validUntil` → `expired`
- `active`이고 `carCount >= minTeamSize` → `individual`
- `active`이고 `carCount < minTeamSize` → `aggregate` (개인 줄 0)
- `stripObservedFuel`: `synthetic === false`면 각 이벤트에서 `fuel_pct` 삭제. 시뮬레이터·데모는 유지

만료 카피: `구독 만료 — 조직 차량을 표시하지 않음`. 데모 데이터로 몰래 채우지 않음.

---

## 5. 정보 구조 (Wall SKU)

v2.0 §11 타워 우선을 유지. 추가:

- HUD에 구독 상태 텍스트: `WALL · ACTIVE` / `WALL · EXPIRED` / 없음(Free).
- aggregate 모드: 타워 한 줄 `조직 · N계정 · 합계 $`. 카넘버 목록 없음.
- Free 모드: k-익명성 적용 안 함 (v2.0). Wall 모드만 W5.

---

## 6. 비목표 (이번 사이클)

| 비목표 | 이유 |
|---|---|
| Stripe/Paddle 연동 | 라이선스 시계가 먼저. 웹훅은 서버 |
| LiteLLM 어댑터 | v1.5. Wall SKU의 데이터 전제이나 이 TDD 슬라이스 밖 |
| 좌석제·관리자 실명 | G4 |
| 프롬프트 트레이스 | PRIV-4. Langfuse $29가 그 일 |
| 개인 월 ₩10만 카피 | tokscale |

---

## 7. 성공 / 반증

성공: 조직이 벽을 켜 두고, 개인 줄을 요구하지 않으며, 월 ₩10만이 월 LLM 지출의 소각보다 작다고 느껴지는 것. 측정은 자기보고 (서버 전).

반증:

- 「내 차」를 조직 벽에 띄워 달라는 요청이 온다 → SKU를 Free와 섞은 것
- 만료 뒤에도 차량이 달린다
- 차량 9대 조직 벽에 개인 줄이 보인다
- 실기록 재생에 연료 100%가 돌아온다

---

## 8. 구현 순서

0. `stripObservedFuel` — 교차검증 L3
1. `licenseState` / `displayMode`
2. 타워가 aggregate에서 개인 줄을 안 그림
3. HUD 구독 배지
4. JS ingest가 미동의하면 drop (L2의 JS 절반)

Swift 테일·공증·Stripe·LiteLLM은 이 계획 밖.

계획: `docs/superpowers/plans/2026-09-01-100k-subscription-tdd.md`

---

## 9. Key Decisions

1. **₩10만 = 조직 벽 1면.** 개인 구독 기각.
2. **좌석제 기각.** 순위 압력.
3. **결제 사업자보다 라이선스 시계가 먼저.**
4. **k=10은 Wall 모드에서만 화면을 바꾼다.** Free는 그대로.
5. **관측 데이터에서 연료를 버린다.** 시뮬레이터만 탱크.

---

## 10. Open Questions

없음. 가격·SKU·모드 분리는 가격 숫자로 잠갔다. LiteLLM 연결 시점은 v1.5와 같다 — 이 슬라이스는 라이선스와 정직만.
