# Paid-Quality Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipped PITWALL stop lying about fuel, identity hashing, endurance gates, and empty LIVE — the paid-quality contract in `docs/superpowers/specs/2026-08-31-paid-quality-prd.md`.

**Architecture:** No new runtime dependency. Close six public seams (S1–S6) with vertical TDD slices. Simulator fuel burn stays. Real importers omit fuel. Local `car_id` uses a per-install salt. Documents are updated in the last task so numbers match `npm test` from that same commit.

**Tech Stack:** TypeScript · Vitest · existing Vite app. Swift consent-delay is out of this plan (PRD §4.5 open checklist item).

**Spec:** `docs/superpowers/specs/2026-08-31-paid-quality-prd.md`

## Global Constraints

- 런타임 의존성 0개. `package.json` `dependencies` 비어 있음.
- SVG `transform` 속성 금지. CSS `transform`만.
- 프롬프트·응답 본문 필드 추가 금지.
- 개인 간 사용량 정렬·순위 칸 금지. 타워 카넘버 정렬 유지.
- `as any` / `@ts-ignore` / `@ts-expect-error` 신규 금지.
- 실패 테스트를 삭제·스킵·매직넘버로 통과시키지 말 것.
- 커밋은 사용자가 그 턴에 커밋을 명시한 뒤에만. 계획의 Commit 스텝은 스테이징 목록까지.

---

## File map

| File | Responsibility |
|---|---|
| `pitwall/src/types.ts` | `fuel_pct` optional on `CarEvent` and `CarState` |
| `pitwall/src/source/claudeCodeImport.ts` | real Claude events omit fuel |
| `pitwall/src/source/agentLogs.ts` | real vendor events omit fuel; `accountCar` takes salt |
| `pitwall/src/state/reducer.ts` | missing fuel stays missing; do not fill 100 |
| `pitwall/src/director/director.ts` | limit score only when `fuel_pct` is a number |
| `pitwall/src/radio/eventRadio.ts` | no `연료 NaN%` |
| `pitwall/src/config/carSalt.ts` | **create** per-install salt |
| `pitwall/src/config/consent.ts` | **create** consent flag |
| `pitwall/src/session/liveStore.ts` | leak keys include session fields |
| `pitwall/src/render/legend.ts` | WAITING row |
| `pitwall/src/main.ts` | empty-field copy; consent overlay host |
| `pitwall/scripts/runtimeReport.ts` | already honest; tests pin lying stored reports |
| README.md / PITWALL.md / CHECKLIST.md | QG2 numbers |

Simulator `SimulatorSource` keeps writing `fuel_pct`. Do not change burn behaviour.

---

### Task 1: Real events do not invent a full fuel tank

**Files:**
- Modify: `pitwall/src/types.ts` (`CarEvent.fuel_pct`, `CarState.fuel_pct` → optional)
- Modify: `pitwall/src/source/claudeCodeImport.ts`
- Modify: `pitwall/src/source/agentLogs.ts` (`build()`)
- Modify: `pitwall/src/state/reducer.ts` (`initialCar`, `applyEvent`)
- Modify: `pitwall/src/director/director.ts` (`scoreCar`)
- Modify: `pitwall/src/radio/eventRadio.ts`
- Test: `pitwall/tests/claudeCodeImport.test.ts`
- Test: `pitwall/tests/agentLogs.test.ts`
- Test: `pitwall/tests/reducer.test.ts`
- Test: `pitwall/tests/director.test.ts`
- Test: `pitwall/tests/radio.test.ts`

**Interfaces:**
- Consumes: existing `toCarEvent`, `grokEvent`, `codexEvent`, `applyEvent`, `scoreCar`, `eventRadio`
- Produces: `fuel_pct?: number` on `CarEvent` / `CarState`. Real importers omit the field. `scoreCar` adds limit weight iff `typeof car.fuel_pct === 'number' && car.fuel_pct < 20`.

- [ ] **Step 1: Write the failing tests**

Append to `pitwall/tests/claudeCodeImport.test.ts`:

```ts
  it('실 로그는 연료를 지어내지 않는다 — 예산 소스가 없다', () => {
    const e = toCarEvent(line())!;
    expect(e.fuel_pct).toBeUndefined();
  });
```

Append to `pitwall/tests/agentLogs.test.ts` inside the grok describe (after the existing turn-complete test):

```ts
  it('실 벤더 이벤트는 연료를 지어내지 않는다', () => {
    expect(grokEvent(row, { car: CAR })!.fuel_pct).toBeUndefined();
  });
```

Append to `pitwall/tests/reducer.test.ts` (same `makeEvent` helper already used):

```ts
  it('연료가 없는 이벤트는 탱크를 100으로 채우지 않는다', () => {
    const s = applyEvent(emptyRaceState(T0), makeEvent({ fuel_pct: undefined }));
    expect(s.cars.get('car-1')?.fuel_pct).toBeUndefined();
  });
```

Append to `pitwall/tests/director.test.ts` in `describe('scoreCar')`:

```ts
  it('연료 부재는 한도 점수를 주지 않는다 — 100%로 읽히지 않는다', () => {
    const missing = scoreCar(car('a', { fuel_pct: undefined }), ctx);
    const knownOk = scoreCar(car('a', { fuel_pct: 80 }), ctx);
    const low = scoreCar(car('a', { fuel_pct: 10 }), ctx);
    expect(missing).toBe(knownOk);
    expect(low).toBeGreaterThan(missing);
  });
```

Append to `pitwall/tests/radio.test.ts`:

```ts
  it('연료 없는 한도 경고는 연료 문구를 만들지 않는다', () => {
    const msg = eventRadio(event({ kind: 'limit_warn', fuel_pct: undefined }));
    expect(msg).toBeNull();
  });
```

`makeEvent` / `event()` helpers already spread `fuel_pct: 100` defaults in some files. Pass `fuel_pct: undefined` explicitly so the object key exists as undefined, or omit via destructure. If the helper forces `fuel_pct: 100` in the default object, override with `undefined` after spread — later keys win.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pitwall && npx vitest run tests/claudeCodeImport.test.ts tests/agentLogs.test.ts tests/reducer.test.ts tests/director.test.ts tests/radio.test.ts`

Expected: FAIL. Claude/Grok events currently set `fuel_pct: 100`. Radio currently interpolates `undefined` into `연료 NaN%` (or still returns a warn). Director: `undefined < 20` is already false so the director test may PASS immediately — if it does, keep it as a regression pin, do not delete it.

- [ ] **Step 3: Minimal implementation**

`types.ts`: `fuel_pct?: number` on both `CarEvent` and `CarState`.

`claudeCodeImport.ts`: delete `fuel_pct: 100` from the returned object.

`agentLogs.ts` `build()`: delete `fuel_pct: 100`. If a caller must set fuel, they pass it in `extra`.

`reducer.ts` `initialCar`: `fuel_pct: event.fuel_pct` (do not default 100). `applyEvent`: `fuel_pct: event.fuel_pct !== undefined ? event.fuel_pct : prev.fuel_pct`.

`director.ts` `scoreCar`:

```ts
  if ((typeof car.fuel_pct === 'number' && car.fuel_pct < 20) || tyreLow) {
    score += DIRECTOR_WEIGHTS.limitThreshold;
  }
```

`eventRadio.ts` `limit_warn` branch:

```ts
    case 'limit_warn':
      if (typeof event.fuel_pct !== 'number') return null;
      return { ...base, severity: 'warn', text: `연료 ${Math.round(event.fuel_pct)}% — 관리 필요` };
```

Simulator keeps passing numeric `fuel_pct`. Existing reducer test that expects 62 still passes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pitwall && npx vitest run tests/claudeCodeImport.test.ts tests/agentLogs.test.ts tests/reducer.test.ts tests/director.test.ts tests/radio.test.ts tests/trackModel.test.ts`

Expected: PASS. Then `npx vitest run` full suite. Fix only compile errors from `fuel_pct` now optional (no `as any`).

- [ ] **Step 5: Commit** (only if the user ordered a commit this turn)

```bash
git add pitwall/src/types.ts pitwall/src/source/claudeCodeImport.ts pitwall/src/source/agentLogs.ts pitwall/src/state/reducer.ts pitwall/src/director/director.ts pitwall/src/radio/eventRadio.ts pitwall/tests/claudeCodeImport.test.ts pitwall/tests/agentLogs.test.ts pitwall/tests/reducer.test.ts pitwall/tests/director.test.ts pitwall/tests/radio.test.ts
git commit -m "fix: stop inventing a full fuel tank on real events"
```

---

### Task 2: Stored runtime reports cannot claim an 8h pass they did not earn

**Files:**
- Modify: `pitwall/scripts/runtimeReport.ts`
- Test: `pitwall/tests/runtimeReport.test.ts`

**Interfaces:**
- Consumes: `summarizeRuntime`, `RuntimeReport`
- Produces: `assertHeapPassMatchesElapsed(report: RuntimeReport): boolean` — true iff `report.heapPass === summarizeRuntime(report).heapPass`

- [ ] **Step 1: Write the failing test**

Append to `pitwall/tests/runtimeReport.test.ts`:

```ts
  it('저장된 heapPass가 경과와 다르면 정직하지 않다', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const lying = summarizeRuntime({
      durationMs: EIGHT_HOURS_MS,
      headed: false,
      dataset: 'demo-large',
      samples: [
        sample({ tMs: 0, heapBytes: 10_000_000 }),
        sample({ tMs: twoHours, heapBytes: 11_000_000, frames: 1 }),
      ],
    });
    expect(lying.heapPass).toBeNull();
    const forged: typeof lying = { ...lying, heapPass: true };
    expect(assertHeapPassMatchesElapsed(forged)).toBe(false);
    expect(assertHeapPassMatchesElapsed(lying)).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pitwall && npx vitest run tests/runtimeReport.test.ts`

Expected: FAIL with `assertHeapPassMatchesElapsed is not defined`.

- [ ] **Step 3: Minimal implementation**

In `pitwall/scripts/runtimeReport.ts`:

```ts
export function assertHeapPassMatchesElapsed(report: RuntimeReport): boolean {
  const fresh = summarizeRuntime({
    durationMs: report.durationMs,
    headed: report.headed,
    dataset: report.dataset,
    samples: report.samples,
  });
  return report.heapPass === fresh.heapPass;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pitwall && npx vitest run tests/runtimeReport.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit** (only if ordered)

```bash
git add pitwall/scripts/runtimeReport.ts pitwall/tests/runtimeReport.test.ts
git commit -m "test: reject forged 8h heapPass on short samples"
```

---

### Task 3: Per-install car salt

**Files:**
- Create: `pitwall/src/config/carSalt.ts`
- Modify: `pitwall/src/source/claudeCodeImport.ts` (`toCarEvent` salt param stays; export `CAR_SALT` removed as default)
- Modify: `pitwall/src/source/agentLogs.ts` (`accountCar` third argument)
- Modify: `pitwall/src/source/LiveSource.ts` (pass salt into `accountCar`)
- Modify: `pitwall/src/browser.ts` / `pitwall/src/main.ts` only if they call `accountCar` or `toCarEvent` without salt
- Test: `pitwall/tests/carSalt.test.ts` (create)
- Test: `pitwall/tests/claudeCodeImport.test.ts` (existing tests pass explicit salt)

**Interfaces:**
- Consumes: `localStorage`
- Produces:

```ts
export const CAR_SALT_KEY = 'pitwall.carSalt';
export function loadCarSalt(): string; // 32 hex chars, created once
export function accountCar(vendor: string, accountId: string, salt: string): CarIdentity;
export function toCarEvent(raw: unknown, salt: string): CarEvent | null;
```

No default `'pitwall-local'`. Tests pass `'test-salt'`.

- [ ] **Step 1: Write the failing tests**

Create `pitwall/tests/carSalt.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadCarSalt, CAR_SALT_KEY } from '../src/config/carSalt';
import { accountCar } from '../src/source/agentLogs';
import { toCarEvent } from '../src/source/claudeCodeImport';

beforeEach(() => localStorage.clear());

describe('loadCarSalt', () => {
  it('없으면 만들고 같은 키로 다시 읽는다', () => {
    const a = loadCarSalt();
    const b = loadCarSalt();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(b).toBe(a);
    expect(localStorage.getItem(CAR_SALT_KEY)).toBe(a);
  });
});

describe('accountCar salt', () => {
  it('같은 계정 다른 솔트는 다른 차다', () => {
    const a = accountCar('claude', 'uuid-1', 'salt-aaaa');
    const b = accountCar('claude', 'uuid-1', 'salt-bbbb');
    expect(a.car_id).not.toBe(b.car_id);
  });

  it('같은 솔트면 같은 차다', () => {
    expect(accountCar('claude', 'uuid-1', 'salt-aaaa')).toEqual(
      accountCar('claude', 'uuid-1', 'salt-aaaa'),
    );
  });
});
```

In `claudeCodeImport.test.ts`, change `toCarEvent(line())` call sites to `toCarEvent(line(), 'test-salt')` in the new test:

```ts
  it('솔트가 바뀌면 car_id가 바뀐다', () => {
    const a = toCarEvent(line(), 'salt-a')!;
    const b = toCarEvent(line(), 'salt-b')!;
    expect(a.car_id).not.toBe(b.car_id);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pitwall && npx vitest run tests/carSalt.test.ts tests/claudeCodeImport.test.ts`

Expected: FAIL — module missing and/or `accountCar` arity 2.

- [ ] **Step 3: Minimal implementation**

`pitwall/src/config/carSalt.ts`:

```ts
export const CAR_SALT_KEY = 'pitwall.carSalt';

export function loadCarSalt(): string {
  const existing = localStorage.getItem(CAR_SALT_KEY);
  if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const salt = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(CAR_SALT_KEY, salt);
  return salt;
}
```

`accountCar(vendor, accountId, salt: string)` — hash `${salt}:${vendor}:${accountId}`. Remove module-level `SALT = 'pitwall-local'`.

`toCarEvent(raw, salt: string)` — drop default `CAR_SALT`. Keep exporting a test helper only if tests need it; do not default production to `'pitwall-local'`.

`LiveSource`: store `salt` from `configure` or constructor. Every `accountCar(...)` call passes that salt. `browser.ts` calls `loadCarSalt()` once at boot and passes it into LiveSource / importers.

Update every `accountCar` / `toCarEvent` call site. Tests use `'test-salt'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pitwall && npx tsc --noEmit && npx vitest run`

Expected: PASS, 0 tsc errors.

- [ ] **Step 5: Commit** (only if ordered)

```bash
git add pitwall/src/config/carSalt.ts pitwall/src/source/claudeCodeImport.ts pitwall/src/source/agentLogs.ts pitwall/src/source/LiveSource.ts pitwall/src/browser.ts pitwall/tests/carSalt.test.ts pitwall/tests/claudeCodeImport.test.ts pitwall/tests/agentLogs.test.ts
git commit -m "fix: per-install salt for car_id, drop shared pitwall-local"
```

---

### Task 4: Snapshot leak guard rejects session keys

**Files:**
- Modify: `pitwall/src/session/liveStore.ts` (`liveSnapshotLeaks`)
- Test: `pitwall/tests/liveStore.test.ts`

**Interfaces:**
- Consumes: `liveSnapshotLeaks(raw: string): boolean`, `saveLiveSnapshot`
- Produces: same signatures. Additional true cases: `"session_id"` or `sessionId` present as JSON keys.

- [ ] **Step 1: Write the failing test**

Find the existing leak describe in `liveStore.test.ts` and add:

```ts
  it('session_id 키가 있으면 저장하지 않는다', () => {
    expect(liveSnapshotLeaks('{"session_id":"abc"}')).toBe(true);
    expect(liveSnapshotLeaks('{"sessionId":"abc"}')).toBe(true);
    const snap = serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], Date.now());
    const poisoned = JSON.parse(JSON.stringify(snap)) as LiveSnapshot & { state: { session_id?: string } };
    (poisoned.state as { session_id?: string }).session_id = 'sess-abc';
    saveLiveSnapshot(poisoned as LiveSnapshot);
    expect(localStorage.getItem(LIVE_STORAGE_KEY)).toBeNull();
  });

  it('정상 스냅샷은 세션 키가 없어 저장된다', () => {
    const snap = serializeLiveState(stateWith([['car-1', car()]], [], 2_000), [], Date.now());
    expect(liveSnapshotLeaks(JSON.stringify(snap))).toBe(false);
  });
```

If `saveLiveSnapshot` already ran in `beforeEach` clearing storage, the first assertion on `getItem` is valid.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pitwall && npx vitest run tests/liveStore.test.ts`

Expected: FAIL — `liveSnapshotLeaks('{"session_id":"abc"}')` is false.

- [ ] **Step 3: Minimal implementation**

```ts
export function liveSnapshotLeaks(raw: string): boolean {
  if (/accountUuid|oauthAccount|emailAddress/.test(raw)) return true;
  if (/"messages"\s*:/.test(raw) || /"response"\s*:/.test(raw)) return true;
  if (/"session_id"\s*:/.test(raw) || /"sessionId"\s*:/.test(raw)) return true;
  return /[^\s"{}:,]+@[^\s"{}:,]+\.[A-Za-z]{2,}/.test(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pitwall && npx vitest run tests/liveStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit** (only if ordered)

```bash
git add pitwall/src/session/liveStore.ts pitwall/tests/liveStore.test.ts
git commit -m "fix: refuse live snapshots that contain session keys"
```

---

### Task 5: WAITING in the legend and honest empty LIVE copy

**Files:**
- Modify: `pitwall/src/render/legend.ts`
- Modify: `pitwall/src/main.ts` (empty focus copy)
- Test: `pitwall/tests/legend.test.ts`
- Test: `pitwall/tests/integration.test.ts`

**Interfaces:**
- Consumes: `Legend` constructor, `PitwallApp` empty selection copy
- Produces: legend text includes `WAITING`. Zero-car copy includes `고장이 아님`.

- [ ] **Step 1: Write the failing tests**

In `legend.test.ts` freshness test, add `'WAITING'` to the key list:

```ts
    for (const key of ['FRESH', 'QUIET', 'STALE', 'CONNECTED', 'SYNCING', 'WAITING']) {
      expect(text).toContain(key);
    }
```

In `integration.test.ts` empty-focus test, extend:

```ts
    expect(focus.textContent).toContain('관측 차량 없음');
    expect(focus.textContent).toContain('고장이 아님');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pitwall && npx vitest run tests/legend.test.ts tests/integration.test.ts`

Expected: FAIL — WAITING missing; copy is `방송 포커스 없음 — 새 이벤트 대기 · 관측 차량 없음` without `고장이 아님`.

- [ ] **Step 3: Minimal implementation**

`legend.ts` ROWS, after SYNCING:

```ts
  ['WAITING', '실시간 소스가 연결됐으나 아직 처리한 이벤트가 없음', 'waiting'],
```

`main.ts` empty selection:

```ts
      setText(this.broadcastFocus, this.raceState.cars.size === 0
        ? '방송 포커스 없음 — 새 이벤트 대기 · 관측 차량 없음 — 최근 호출이 없어 트랙이 비어 있음. 고장이 아님'
        : '방송 포커스 없음 — 새 이벤트 대기');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pitwall && npx vitest run tests/legend.test.ts tests/integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit** (only if ordered)

```bash
git add pitwall/src/render/legend.ts pitwall/src/main.ts pitwall/tests/legend.test.ts pitwall/tests/integration.test.ts
git commit -m "fix: legend WAITING and empty LIVE is not a crash"
```

---

### Task 6: Consent flag seam

**Files:**
- Create: `pitwall/src/config/consent.ts`
- Modify: `pitwall/src/main.ts` or `pitwall/src/browser.ts` to show overlay when native and not consented
- Test: `pitwall/tests/consent.test.ts` (create)

**Interfaces:**
- Consumes: `localStorage`
- Produces:

```ts
export const CONSENT_KEY = 'pitwall.consent.v1';
export function loadConsent(): boolean; // true iff storage === '1'
export function saveConsent(): void;    // writes '1'
export function mountConsent(host: HTMLElement, onAllow: () => void): HTMLElement | null;
// native + !loadConsent → overlay; otherwise null
```

Swift still tails immediately. Do not claim that is fixed.

- [ ] **Step 1: Write the failing test**

Create `pitwall/tests/consent.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadConsent, saveConsent, mountConsent, CONSENT_KEY } from '../src/config/consent';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="host"></div>';
});

describe('consent', () => {
  it('기본은 미동의다', () => {
    expect(loadConsent()).toBe(false);
  });

  it('saveConsent 후에만 동의다', () => {
    saveConsent();
    expect(localStorage.getItem(CONSENT_KEY)).toBe('1');
    expect(loadConsent()).toBe(true);
  });

  it('네이티브이고 미동의하면 고지 오버레이를 붙인다', () => {
    const host = document.getElementById('host')!;
    const el = mountConsent(host, { native: true }, () => undefined);
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('~/.claude');
    expect(el!.textContent).toContain('본문');
  });

  it('동의하면 오버레이를 붙이지 않는다', () => {
    saveConsent();
    const host = document.getElementById('host')!;
    expect(mountConsent(host, { native: true }, () => undefined)).toBeNull();
  });

  it('브라우저 데모는 오버레이가 없다', () => {
    const host = document.getElementById('host')!;
    expect(mountConsent(host, { native: false }, () => undefined)).toBeNull();
  });

  it('허용을 누르면 동의하고 콜백이 불린다', () => {
    const host = document.getElementById('host')!;
    let called = 0;
    const el = mountConsent(host, { native: true }, () => { called += 1; });
    el!.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(loadConsent()).toBe(true);
    expect(called).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pitwall && npx vitest run tests/consent.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Minimal implementation**

`pitwall/src/config/consent.ts`:

```ts
export const CONSENT_KEY = 'pitwall.consent.v1';

export function loadConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveConsent(): void {
  localStorage.setItem(CONSENT_KEY, '1');
}

export function mountConsent(
  host: HTMLElement,
  opts: { native: boolean },
  onAllow: () => void,
): HTMLElement | null {
  if (!opts.native || loadConsent()) return null;
  const root = document.createElement('div');
  root.className = 'consent';
  root.setAttribute('role', 'dialog');
  const p = document.createElement('p');
  p.textContent = '이 앱은 ~/.claude · ~/.codex · ~/.grok 로그에서 사용량 숫자만 읽습니다. 프롬프트·응답 본문은 버립니다. 네트워크로 보내지 않습니다.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '읽기 허용';
  btn.addEventListener('click', () => {
    saveConsent();
    root.remove();
    onAllow();
  });
  root.append(p, btn);
  host.append(root);
  return root;
}
```

Wire `mountConsent` from `browser.ts` when `window.__pitwallNative === true`. `onAllow` is a no-op besides removing the overlay this slice.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pitwall && npx vitest run tests/consent.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit** (only if ordered)

```bash
git add pitwall/src/config/consent.ts pitwall/src/browser.ts pitwall/tests/consent.test.ts
git commit -m "feat: native live log-read consent overlay"
```

---

### Task 7: Document numbers match today's commands (QG2)

**Files:**
- Modify: `README.md` (one-liner, test count, model count, PRD link)
- Modify: `PITWALL.md` (test count, one-liner if still LiteLLM)
- Modify: `pitwall/CHECKLIST.md` (256 → current `npm test`; 8h heapPass row says 3.70h / null, not pass)
- Modify: `docs/superpowers/specs/2026-07-29-pitwall-prd.md` header pointer to v2.0 for shipped identity; Q4 closed; PRIV-5′ note; LAP 50_000

**Interfaces:** none. This task has no production code.

- [ ] **Step 1: Re-run the numbers**

```bash
cd pitwall && npx vitest run --reporter=dot 2>&1 | tail -8
node -e "import('./src/config/models.ts').then(m => console.log('catalog', m.MODEL_CATALOG.length))"
```

Write the printed test count and catalog length into the docs. Do not copy 976 from this plan if the suite moved.

- [ ] **Step 2: README one-liner**

Replace LiteLLM opening sentence with the PRD §2.1 copy. Link `[유료 품질 PRD v2.0](docs/superpowers/specs/2026-08-31-paid-quality-prd.md)`. Change 「v1 구현 완료」 to 「시뮬레이터 + 로컬 LIVE 동작 중. 유료 품질 게이트는 v2.0 PRD」. 서드파티 목록에 `bacinger/f1-circuits` OpenStreetMap **ODbL**을 추가한다 (지금 Skoll/Kenney/Tabler만 있음).

- [ ] **Step 3: CHECKLIST auto-gate row**

Replace `256 passed / 20 files` with the Step 1 count. Heap row: 표본 경과 3.70h, 현재 함수로 `heapPass=null`. 「합격」금지 유지.

- [ ] **Step 4: v1.4 PRD patches (facts only)**

- Q4 row → 해소: 출력 단가 밴드 (`models.ts`).
- PRIV-5 한 줄 주석: 타워는 카넘버 고정순. 순위 칸 금지.
- Q10 LAP 20만 → 코드 정본 50_000.
- §0 한 줄 아래에: 출하 카피는 v2.0. LiteLLM은 v1.5.

- [ ] **Step 5: Verify no leftover false counts**

```bash
rg -n "858 tests|256 passed|21개 모델|HMAC\\(user_id" README.md PITWALL.md pitwall/CHECKLIST.md docs/superpowers/specs/2026-07-29-pitwall-prd.md
```

Expected: no 858/256/HMAC-as-current-code. HMAC may remain as historical PRIV-3 text with a v2.0 pointer.

- [ ] **Step 6: Commit** (only if ordered)

```bash
git add README.md PITWALL.md pitwall/CHECKLIST.md docs/superpowers/specs/2026-07-29-pitwall-prd.md docs/superpowers/specs/2026-08-31-paid-quality-prd.md docs/superpowers/plans/2026-08-31-paid-quality-tdd.md
git commit -m "docs: paid-quality PRD and honest counts"
```

---

## Spec coverage

| Spec item | Task |
|---|---|
| QG1 fuel | 1 |
| QG3 heap honesty | 2 |
| QG4 salt | 3 |
| QG5 session leak | 4 |
| QG6 empty/WAITING | 5 |
| QG7 consent JS | 6 |
| QG2 docs | 7 |
| Swift tail-before-consent | **not in this plan** (PRD open) |
| Inspector off | **not in this plan** (Swift checklist) |
| 8h machine run | **not in this plan** |

## Placeholder scan

No TBD. No 「add validation」. Tests are written in-line.

## Type consistency

- `fuel_pct?: number` from Task 1 is what Tasks 5–7 consume.
- `accountCar(..., salt: string)` from Task 3 — LiveSource must be updated in that same task, not later.
- `CONSENT_KEY = 'pitwall.consent.v1'` matches the spec.
- `CAR_SALT_KEY = 'pitwall.carSalt'` matches the spec.
