# ₩10만 Wall 구독 — Implementation Plan (슬라이스 0–1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox steps.

**Goal:** 관측 재생에서 지어낸 연료를 제거하고, 서버 없이 조직 벽 라이선스 시계·k-익명성 표시 모드를 고정한다.

**Architecture:** 순수 함수 두 모듈. Stripe 없음. Swift 없음. 시뮬레이터 연료는 유지.

**Tech Stack:** TypeScript · Vitest

**Spec:** `docs/superpowers/specs/2026-09-01-100k-subscription-prd.md`

## Global Constraints

- 런타임 의존성 0. `as any` 금지. 실패 테스트 삭제 금지.
- 개인 간 사용량 정렬 금지. Wall aggregate는 합계 한 줄만.
- 커밋은 사용자가 그 턴에 명시한 뒤에만.

---

### Task 1: 관측 이벤트에서 연료 제거 (W0)

**Files:**
- Create: `pitwall/src/config/observedFuel.ts`
- Modify: `pitwall/src/browser.ts` (데이터셋 이벤트에 적용)
- Test: `pitwall/tests/observedFuel.test.ts`

**Interfaces:**
- Produces: `stripObservedFuel<T extends { fuel_pct?: number }>(events: T[], synthetic: boolean): T[]`

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { stripObservedFuel } from '../src/config/observedFuel';

describe('stripObservedFuel', () => {
  it('실기록은 fuel_pct를 버린다', () => {
    const out = stripObservedFuel(
      [{ fuel_pct: 100, cost_usd: 1 }, { fuel_pct: 40, cost_usd: 2 }],
      false,
    );
    expect(out[0]!.fuel_pct).toBeUndefined();
    expect(out[1]!.fuel_pct).toBeUndefined();
    expect(out[0]!.cost_usd).toBe(1);
  });

  it('지어낸 데이터는 연료를 남긴다', () => {
    const src = [{ fuel_pct: 80 }];
    expect(stripObservedFuel(src, true)[0]!.fuel_pct).toBe(80);
  });

  it('원본 배열을 돌연변이하지 않는다', () => {
    const src = [{ fuel_pct: 100 }];
    stripObservedFuel(src, false);
    expect(src[0]!.fuel_pct).toBe(100);
  });
});
```

- [ ] **Step 2: 실패 확인** `npx vitest run tests/observedFuel.test.ts`
- [ ] **Step 3: 최소 구현**

```ts
export function stripObservedFuel<T extends { fuel_pct?: number }>(
  events: T[],
  synthetic: boolean,
): T[] {
  if (synthetic) return events;
  return events.map((e) => {
    if (e.fuel_pct === undefined) return e;
    const { fuel_pct: _drop, ...rest } = e;
    return rest as T;
  });
}
```

`browser.ts`에서 `chosen.events`를 쓰기 전에 `stripObservedFuel(chosen.events, chosen.synthetic)`.

- [ ] **Step 4: 통과 확인** + 전체 `npx vitest run`

---

### Task 2: 라이선스 시계와 표시 모드 (W3–W5)

**Files:**
- Create: `pitwall/src/config/license.ts`
- Test: `pitwall/tests/license.test.ts`

**Interfaces:** spec §4 그대로.

- [ ] **Step 1: 실패 테스트**

```ts
import { describe, it, expect } from 'vitest';
import { licenseState, displayMode, type WallLicense } from '../src/config/license';

const T = 1_000_000;
function lic(over: Partial<WallLicense> = {}): WallLicense {
  return {
    orgId: 'org-1', wallId: 'wall-1', validUntil: T + 1_000,
    maxCars: 40, minTeamSize: 10, ...over,
  };
}

describe('licenseState', () => {
  it('없으면 invalid', () => {
    expect(licenseState(null, T)).toBe('invalid');
  });
  it('orgId 공백이면 invalid', () => {
    expect(licenseState(lic({ orgId: '' }), T)).toBe('invalid');
  });
  it('maxCars < 10이면 invalid', () => {
    expect(licenseState(lic({ maxCars: 9 }), T)).toBe('invalid');
  });
  it('minTeamSize < 10이면 invalid — 완화 불가', () => {
    expect(licenseState(lic({ minTeamSize: 3 }), T)).toBe('invalid');
  });
  it('만료면 expired', () => {
    expect(licenseState(lic({ validUntil: T }), T)).toBe('expired');
  });
  it('유효하면 active', () => {
    expect(licenseState(lic(), T)).toBe('active');
  });
});

describe('displayMode', () => {
  it('active이고 10대 이상이면 individual', () => {
    expect(displayMode(10, lic())).toBe('individual');
  });
  it('active이고 9대면 aggregate — 개인 줄 없음', () => {
    expect(displayMode(9, lic())).toBe('aggregate');
  });
});
```

- [ ] **Step 2–4:** 실패 확인 후 `license.ts` 최소 구현, 통과.

`licenseState`: minTeamSize < 10 또는 maxCars < 10 또는 !orgId → invalid. `now >= validUntil` → expired.

`displayMode`: carCount >= minTeamSize ? individual : aggregate. invalid/expired는 이 함수를 부르지 않는다 — 호출되면 aggregate를 돌려 개인 줄을 안 깐다.

---

Task 3 HUD/타워 연결은 다음 세션. Swift·Stripe 없음.
