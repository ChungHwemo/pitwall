# PITWALL UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task by task. Keep each task in a separate commit, and preserve unrelated working-tree changes.

**Goal:** Make PITWALL truthful and glanceable across live status, track motion, broadcast focus, dense cards, and controls without introducing a second circuit or claiming native LIVE behavior that has not been manually verified.

**Architecture:** Keep the current SVG/DOM application and the legacy `TrackRenderer` as the default rendering path. Improve the existing seams in `PitwallApp`, `TrackRenderer`, `BroadcastDirector`, `SettingsPanel`, `Legend`, and their tests. The broadcast focus panel is a DOM overlay driven by the existing director; a broadcast track renderer may remain behind its explicit capability seam, but it must not be enabled by default until its geometry is proven to be one main circuit plus the existing thin pit lane.

**Tech Stack:** Vite, TypeScript, Vitest, jsdom, SVG, DOM, `requestAnimationFrame`, and the already installed Google Chrome executable. No new dependencies.

## Global Constraints

- Preserve the offline single HTML build, runtime dependency count of zero, and `npm run build:single` deployment path.
- Do not add Three.js, WebGL, canvas replacement rendering, external assets, CDN resources, tracking, or a new runtime service.
- Keep raw prompts, responses, account identifiers, names, ranking, and performance evaluation out of the UI and emitted data.
- Keep the full circuit visible, keep the existing thin pit lane as a short spur, and never enable a second full broadcast loop by default.
- Stale or no-data cars receive slow deterministic idle motion on the normal main track. `error` and `limit` cars enter the pit lane and remain stationary.
- Stale is not synonymous with disconnected. LIVE status must state the observed state and complete age without clipping.
- Preserve reduced-motion behavior, keyboard access, visible focus, text plus shape semantics, and CJK readability.
- Do not change or promise native LIVE approval. Native LIVE continuity, reload, and WebView bridge behavior remain a separate explicitly human-operated gate.
- Use the current branch as-is. Do not reset, stash, clean, commit, or alter unrelated uncommitted files.
- Follow red, green, refactor for every behavioral change. Tests must observe public seams or DOM output, not private implementation details.
- Do not add a second full-size track until a renderer test and Chromium geometry check prove that it is not a duplicate circuit. Until then, boot the legacy renderer explicitly.

## Current Contract and File Map

The implementation worker should start from the current working tree, not from an assumed clean commit. The relevant current seams are:

| Area | Current file and symbols | Contract to preserve or extend |
|---|---|---|
| App composition | `pitwall/src/main.ts`, `PitwallApp.constructor`, `PitwallApp.render`, `PitwallApp.renderLiveStatus`, `PitwallApp.renderBroadcastFocus`, `PitwallApp.buildBroadcastCandidates` | One app shell, one `svg.track`, status in `.live-status`, focus in `.broadcast-focus`, director selection independent of track geometry |
| Track | `pitwall/src/render/trackRenderer.ts`, `TrackRenderer.render`, `TrackRenderer.renderCold`, `TrackRenderer.renderHot`, `TrackRenderer.visualProgressOf`, `idleCreepOffset` | Legacy full circuit, existing short pit spur, pooled SVG nodes, CSS transforms, deterministic motion |
| Track model | `pitwall/src/track/trackModel.ts`, `buildTrackModel` | `cold` contains running and idle non-retired cars, `hot` preserves stopped cars, `hotOverflow` and `laneOverflow` remain explicit |
| Pit geometry | `pitwall/src/track/layout.ts`, `pitBoxes`, `pitLanePoints`, `positionAt` | Pit spacing is based on actual lane distance and enough lane points are drawn for the supported stopped count |
| Broadcast selection | `pitwall/src/director/broadcastDirector.ts`, `BroadcastCandidate`, `BroadcastSelection`, `scoreBroadcastCandidate`, `BroadcastDirector.select` | Manual focus wins, automatic focus follows the 400/300/200/100/50/25/1 score rules, five second dwell, plus 100 preemption |
| Broadcast renderer WIP | `pitwall/src/render/broadcastTrackRenderer.ts`, `pitwall/src/render/broadcastRendererSession.ts`, `pitwall/src/render/broadcastOverflow.ts` | Existing WIP remains opt-in only. Its default boot path is not approved until its geometry matches the legacy contract |
| Settings and legend | `pitwall/src/render/settingsPanel.ts`, `SettingsPanel.constructor`, `pitwall/src/render/legend.ts`, `Legend.constructor` | Both controls are separate collapsible overlays, both closed by default, neither cuts a widget in half |
| Dense cards | `pitwall/src/style.css`, dense `.tower-row` rules; `pitwall/src/render/towerRenderer.ts`, `TowerRenderer.render`; `pitwall/src/render/feedRenderer.ts`, `FeedRenderer.render` | Three digit car numbers remain readable, status and danger survive compaction, long CJK/model text does not push required values out |
| Existing tests | `pitwall/tests/integration.test.ts`, `trackRenderer.test.ts`, `trackRenderer-pit-motion.test.ts`, `broadcastTrackRenderer.test.ts`, `broadcastDirector.test.ts`, `settings.test.ts`, `panels.test.ts`, `feed.test.ts`, `legend.test.ts`, `screenFit.test.ts` | Extend these seams before adding new files. New test files are justified only when a behavior has a separate fixture or lifecycle |
| Browser evidence | `pitwall/scripts/shot.ts` and Chrome CLI | Existing screenshot path is Chrome-only. Extend or supplement it without adding Playwright, Puppeteer, or another browser dependency |

## Task 1: Make LIVE and STALE status complete and non-clipped

**Files:**

- Modify: `pitwall/src/main.ts`, `PitwallApp.renderLiveStatus`
- Modify: `pitwall/src/style.css`, `.hud`, `.hud-item`, `.live-status`, and the responsive media rules
- Test: `pitwall/tests/integration.test.ts`, the `실시간 표시` and `배지` suites
- Test: `pitwall/tests/screenFit.test.ts`, the existing overflow and required-fact rules
- Evidence only during implementation: `.omo/evidence/G001-review-md-ui-ux-gate-review.md`

**Interfaces:**

- Consumes: `LiveSource.pending`, `PitwallApp.lastLiveEventAt`, `formatElapsed`, and the existing `data-live-state` values `syncing`, `stale`, and `connected`.
- Produces: the same `.live-status` element with complete literal text, a stable `data-live-state`, and CSS that prevents required LIVE age text from being visually ellipsized.
- Does not change: native bridge startup, snapshot restore, or the meaning of `LIVE`, `DEMO`, and replay badges.

### RED

- Add a DOM contract test in `pitwall/tests/integration.test.ts` for a stale LIVE source whose last event is old enough to render a multi-unit age. Assert that `.live-status` has `data-live-state="stale"`, contains the complete formatted age, and never contains an ellipsis.
- Add a layout seam test in `pitwall/tests/screenFit.test.ts` or the existing browser-facing test helper that mounts a long stale status value and checks the status element is not configured to shrink or ellipsize required text. Do not treat jsdom as proof of pixel layout.
- Run:

  ```bash
  cd pitwall && npx vitest run tests/integration.test.ts tests/screenFit.test.ts --no-file-parallelism
  ```

- Expected RED: the stale integration assertion exposes the current clipped or incomplete contract, and the layout test identifies the current `.live-status { flex-shrink: 1 }` or equivalent truncation rule as incompatible with a required fact.

### GREEN

- Keep the existing state machine and literal state names. Adjust only the sizing and flex ownership needed to give `.live-status` a non-shrinking minimum width or an explicit overflow-safe layout at desktop widths.
- At narrow widths, move from a single clipped HUD row to the already supported responsive stacked layout. The required status must wrap or occupy its own row, never be hidden behind `text-overflow: ellipsis`.
- Preserve the current distinction: pending backlog renders `LIVE · SYNCING +n`, no received event renders `LIVE · WAITING`, connected recent data renders `LIVE · CONNECTED`, and old data renders `LIVE · STALE DATA <full age>`.
- Do not add a “DISCONNECT” claim, a native LIVE fallback, or a new status source.

### Verification

- Run:

  ```bash
  cd pitwall && npx vitest run tests/integration.test.ts tests/screenFit.test.ts --no-file-parallelism
  cd pitwall && npx tsc --noEmit
  ```

- Expected: all targeted tests pass, typecheck is clean, and the DOM still reports `syncing`, `connected`, `stale`, and `WAITING` according to the existing source facts.
- Chromium check required later in Task 6: measure `.live-status.scrollWidth`, `.live-status.clientWidth`, and `getBoundingClientRect()` in every final LIVE state. A passing DOM text assertion alone is insufficient for G001.

**Commit suggestion, do not run while preparing this plan:**

```text
fix: keep live stale status readable
```

## Task 2: Preserve one main track and correct motion semantics

**Files:**

- Modify: `pitwall/src/render/trackRenderer.ts`, `TrackRenderer.renderCold`, `TrackRenderer.renderHot`, `TrackRenderer.render`, `idleCreepOffset`
- Modify: `pitwall/src/track/trackModel.ts`, only if the current model classification cannot express stale idle versus stopped reasons
- Modify: `pitwall/src/track/layout.ts`, only if the current pit geometry contract needs a narrow correction for the existing thin spur
- Modify: `pitwall/src/main.ts`, the renderer boot call and `PitwallApp.render` only if required to keep legacy boot explicit
- Test: `pitwall/tests/trackRenderer.test.ts`
- Test: `pitwall/tests/trackRenderer-pit-motion.test.ts`
- Test: `pitwall/tests/broadcastTrackRenderer.test.ts`, for the default boot and duplicate-loop guard

**Interfaces:**

- Consumes: `TrackModel.cold`, `TrackModel.hot`, `CarState.idle`, stopped reasons `error` and `limit`, `Projector.step`, `Projector.hold`, `positionAt`, `pitBoxes`, and `pitLanePoints`.
- Produces: a legacy render contract in which stale/no-data cars move slowly and deterministically on the normal main track, while only `error` and `limit` cars are placed in stationary pit boxes.
- Produces: one main circuit path plus the existing short pit spur. No default renderer may draw a full second loop.
- Preserves: pooled nodes, CSS `transform`, no random motion, no fake token distance, selected/pinned cars continuing on the main track, and the SVG node budget.

### RED

- In `pitwall/tests/trackRenderer.test.ts`, add a public renderer test with one `idle: true` car and two timestamps. Assert that its rendered main-track transform changes, the sequence is deterministic for the same car id and timestamps, and the car remains in the normal track geometry rather than a pit box.
- Add separate tests for one `error` and one `limit` car. Assert that each renders in a pit box, its transform is unchanged between timestamps, and its `data-reason` remains the correct literal reason.
- Keep or update the existing test that pins a car and expects it not to stop merely because it is selected. A manual selection is not an error or limit reason.
- In `pitwall/tests/broadcastTrackRenderer.test.ts`, add a boot-level regression test that instantiates `PitwallApp` or the boot seam and asserts `data-renderer="legacy"`, exactly one main track path, and a short pit lane path. The test must fail if the default is changed back to an unproven full broadcast renderer.
- Run:

  ```bash
  cd pitwall && npx vitest run tests/trackRenderer.test.ts tests/trackRenderer-pit-motion.test.ts tests/broadcastTrackRenderer.test.ts --no-file-parallelism
  ```

- Expected RED: the stale/no-data transform remains static under the old stopped contract, or the default renderer test detects the current unsafe broadcast selection if it is accidentally enabled.

### GREEN

- Keep `TrackRenderer` as the default. Make the boot choice explicit with the existing `bootBroadcastTrackRenderer` seam and a capability predicate that returns false until the broadcast geometry is proven safe. Do not delete the WIP broadcast files or tests.
- In the legacy renderer, apply `idleCreepOffset(carId, now)` only to normal main-track rendering for stale/no-data cars. The offset must be deterministic from `carId` and time, bounded, slow, and applied to the visual draw position without mutating `Projector`’s accumulated progress or inventing token work.
- Define the branch by facts, not by a broad `idle` shortcut: `STOPPED` reasons are exactly `error` and `limit`; stale/no-data cars without either reason stay on the main track and receive the idle offset.
- Keep `this.projector.hold(car.carId, now)` and the cached pit-box translation for stopped cars. Do not apply idle motion, `pitCreep`, or another fabricated animation to error/limit cars.
- Preserve the existing pit spacing and multi-row geometry already validated by the current branch. If a geometry edit is needed, measure distance along the actual thin pit lane polyline, keep the lane as a short spur, and retain the explicit supported cap and `+N` overflow semantics.
- Do not alter the broadcast renderer to draw a full circuit by default. A future opt-in renderer must satisfy the same `TrackRendererContract` and prove its path geometry before selection is enabled.

### Verification

- Run:

  ```bash
  cd pitwall && npx vitest run tests/trackRenderer.test.ts tests/trackRenderer-pit-motion.test.ts tests/broadcastTrackRenderer.test.ts --no-file-parallelism
  cd pitwall && npx tsc --noEmit
  cd pitwall && npm run build:single
  ```

- Expected: stale/no-data cars have a deterministic main-track motion sequence, error/limit cars have stationary pit transforms, selected cars remain selectable, the default DOM has one main track and the thin pit spur, and the single-file build succeeds.
- Do not mark native LIVE verified here. This task uses deterministic fixtures only and has no human-operated WebView gate.

**Commit suggestion, do not run while preparing this plan:**

```text
fix: separate stale motion from stopped pit cars
```

## Task 3: Stabilize the broadcast focus panel without coupling it to track geometry

**Files:**

- Modify: `pitwall/src/main.ts`, `PitwallApp.buildBroadcastCandidates`, `PitwallApp.renderBroadcastFocus`, `PitwallApp.render`
- Modify: `pitwall/src/director/broadcastDirector.ts`, only if the existing typed score and dwell contract needs correction
- Modify: `pitwall/src/style.css`, `.broadcast-focus` and responsive focus rules
- Test: `pitwall/tests/broadcastDirector.test.ts`
- Test: `pitwall/tests/broadcastTrackRenderer.test.ts`, privacy and renderer-selection cases only
- Test: `pitwall/tests/integration.test.ts`, focus DOM behavior

**Interfaces:**

- Consumes: `BroadcastCandidate`, `BroadcastSelection`, `BroadcastDirector.select(candidates, now, manualCarId)`, `CarState`, `freshnessOf`, and the selected car id.
- Produces: one visible `.broadcast-focus` panel whose machine-facing contract is `data-source="manual" | "automatic"` when selected, typed empty state when no candidate exists, and no raw `car_id` in DOM attributes or text.
- Preserves: manual selection precedence, five second dwell, plus 100 preemption, deterministic recency and code-point tie breaks, no invented event, no ranking table, and the stable track geometry.

### RED

- Extend `pitwall/tests/broadcastDirector.test.ts` to cover these independent cases using candidates with distinct scores: error before limit, limit before critical event, critical before warn/info, comparable work-rate change only, fresh fallback, stale exclusion unless it has a real error/limit, five second dwell, and exactly 100 point preemption.
- Extend the existing privacy test in `pitwall/tests/broadcastTrackRenderer.test.ts` or `pitwall/tests/integration.test.ts` so the focus panel never includes the source `car_id` in text, `id`, `data-*`, or accessible attributes.
- Add an integration test that selects a car through the existing app selection seam and verifies manual focus remains selected while automatic candidates change.
- Add an empty-state integration test that verifies `방송 포커스 없음` remains visible and no speculative car is chosen.
- Run:

  ```bash
  cd pitwall && npx vitest run tests/broadcastDirector.test.ts tests/broadcastTrackRenderer.test.ts tests/integration.test.ts --no-file-parallelism
  ```

- Expected RED: any missing score precedence, manual override, privacy boundary, or empty-state assertion fails against the incomplete or unsafe behavior.

### GREEN

- Keep `BroadcastCandidate` and `BroadcastSelection` as the only director boundary. Do not pass raw event arrays or raw source identifiers into the focus renderer.
- Keep the exact score rules already documented in the broadcast PRD and represented by the current director: error 400, limit 300, critical 200, warn 100, work-rate delta 50, info 25, fresh 1, with real recent timestamps and comparable samples only.
- Render only anonymous car number, literal status or reason, observed work rate, elapsed time since the last event, and freshness. Use the existing formatting helpers and no account name, model prompt, raw id, or comparison language.
- Keep the panel as a DOM overlay in `.detail`. It must not resize the track, change the track aspect ratio, or switch the default renderer.
- Keep the 160 to 240 ms opacity/transform transition for a focus change and disable it under `prefers-reduced-motion: reduce`. Animate only `opacity` and `transform`.
- If the WIP `BroadcastTrackRenderer` is exercised by a test, keep it behind explicit opt-in. The focus panel is useful with the legacy renderer and must not be used as a reason to enable the unsafe second-loop renderer.

### Verification

- Run:

  ```bash
  cd pitwall && npx vitest run tests/broadcastDirector.test.ts tests/broadcastTrackRenderer.test.ts tests/integration.test.ts --no-file-parallelism
  cd pitwall && npx tsc --noEmit
  ```

- Expected: director tests prove deterministic focus selection, integration tests prove the panel is singular, anonymous, manual-focus safe, and empty-state honest, and the default renderer remains legacy.

**Commit suggestion, do not run while preparing this plan:**

```text
feat: keep broadcast focus on the safe track
```

## Task 4: Make dense tower and feed cards readable

**Files:**

- Modify: `pitwall/src/style.css`, dense tower grid, feed grid, required min-width and text-overflow rules, and responsive card rules
- Modify: `pitwall/src/render/towerRenderer.ts`, `TowerRenderer.render`, only where state/label structure must remain explicit
- Modify: `pitwall/src/render/feedRenderer.ts`, `FeedRenderer.render`, only where row content needs a stable accessible label or structural grouping
- Test: `pitwall/tests/trackRenderer.test.ts` for anonymous track labels and dense renderer invariants already present
- Test: `pitwall/tests/feed.test.ts`
- Test: `pitwall/tests/panelRenderers.test.ts` or the existing tower test seam
- Test: `pitwall/tests/screenFit.test.ts`

**Interfaces:**

- Consumes: `TowerRenderer.render(state, now, wallNow, selected, eventsFor, directorIds, speed, names)` and `FeedRenderer.render(target, events, names)`.
- Produces: dense cards that preserve car number, status, danger reason, limit state, and required numeric evidence. Non-required model or explanatory text may ellipsize only when its full value remains available in an accessible title or adjacent detail surface.
- Preserves: anonymous car number identity, no track text labels, provider chips only in card surfaces, no silent truncation of required facts, stable node reuse, and no new card type.

### RED

- Add a dense tower test with three digit car numbers, `error`, `limit`, `idle`, long model text, and CJK labels. Assert that the DOM keeps the full car number, the literal state, and the danger/limit marker after repeated renders.
- Add a feed test with long CJK model and skill strings. Assert that the row keeps time, model identity surface, status/error code, and token/cache values in their intended columns without exposing `car_id`.
- Add a structural screen-fit test for the dense grid that parses the CSS rule or shared width constants and rejects a number column narrower than the measured three digit requirement. Keep the rem-based calculation aligned with the existing `.tower-row` comment and never hard-code a viewport-specific pixel claim.
- Run:

  ```bash
  cd pitwall && npx vitest run tests/feed.test.ts tests/panelRenderers.test.ts tests/screenFit.test.ts tests/trackRenderer.test.ts --no-file-parallelism
  ```

- Expected RED: the test suite exposes any missing required text or a dense number column that can clip three digit numbers.

### GREEN

- Keep the current dense number column at a measured rem width that fits the actual three digit glyph at the project font and weight. Preserve the CSS arithmetic comment in rem units, not absolute pixels, because the Chrome headless viewport height changes the root rem size.
- Keep `min-width: 0` and `overflow: hidden` on flexible non-required cells so long model and skill text cannot push state, limit, money, or token columns out of the row.
- Do not shrink required car numbers, state text, error/limit distinction, or the data values used to answer the 3 second glance question. If a secondary string needs clipping, expose it through the existing detail surface or an accessible title instead of silently changing its meaning.
- Preserve the existing `+N` overflow badge semantics. Never replace hidden cars with an unlabelled crop.
- Check 200 percent zoom and CJK text in the browser task, not only jsdom. jsdom cannot prove glyph width or visual clipping.

### Verification

- Run:

  ```bash
  cd pitwall && npx vitest run tests/feed.test.ts tests/panelRenderers.test.ts tests/screenFit.test.ts tests/trackRenderer.test.ts --no-file-parallelism
  cd pitwall && npx tsc --noEmit
  ```

- Expected: dense and sparse tests pass, node counts remain stable, anonymous identifiers remain absent, and the typecheck is clean.

**Commit suggestion, do not run while preparing this plan:**

```text
fix: preserve dense pitwall card facts
```

## Task 5: Separate settings and legend controls

**Files:**

- Modify: `pitwall/src/render/settingsPanel.ts`, `SettingsPanel.constructor` and its toggle lifecycle
- Modify: `pitwall/src/render/legend.ts`, `Legend.constructor` and toggle lifecycle
- Modify: `pitwall/src/style.css`, `.legend`, `.settings`, `.legend-body`, `.settings-body`, and responsive overlay positions
- Modify: `pitwall/src/main.ts`, only if the app needs explicit references to coordinate mutually exclusive overlay state
- Test: `pitwall/tests/settings.test.ts`
- Test: `pitwall/tests/legend.test.ts`
- Test: `pitwall/tests/screenFit.test.ts`
- Test: `pitwall/tests/integration.test.ts`, if app-level control placement is needed

**Interfaces:**

- Consumes: `SettingsPanel`’s existing `PitwallSettings` callback and `Legend`’s static rows.
- Produces: two separate buttons and two separate fixed panels, each closed by default, with no control rendered inside the other panel and no partially clipped checkbox or legend row.
- Preserves: settings persistence, simulator-only controls, account-name privacy behavior, separate dataset/source facts, and legend meanings for FRESH, QUIET, STALE, CONNECTED, SYNCING, RUN, IDLE, PIT LIM, PIT ERR, lap, limit, color, and brightness.

### RED

- Extend `pitwall/tests/settings.test.ts` to assert that the settings button opens only `.settings-body`, keeps all controls in that panel, and does not change `.legend[data-open]`.
- Extend `pitwall/tests/legend.test.ts` to assert that the legend button opens only `.legend-body`, keeps all legend rows in that panel, and does not expose settings inputs.
- Add a responsive test that mounts both panels, opens each independently, and verifies both have fixed positioning with a viewport-safe right edge contract. Keep actual pixel measurement for Chromium Task 6.
- Add or retain a settings test for simulator versus replay behavior: simulator-only preset and demo-clock controls remain absent in replay, while account names remain available in both modes.
- Run:

  ```bash
  cd pitwall && npx vitest run tests/settings.test.ts tests/legend.test.ts tests/screenFit.test.ts tests/integration.test.ts --no-file-parallelism
  ```

- Expected RED: the tests fail if a panel shares body content, opens through the wrong toggle, or allows a fixed panel to be positioned outside the intended viewport-safe area.

### GREEN

- Keep the existing simple `data-open="false" | "true"` pattern and separate DOM roots. Do not introduce a panel manager or a new state store for two controls.
- Give each panel a distinct fixed position or a small deterministic offset so opening one cannot cover the other. If mutual exclusion is implemented, it must be a two-button DOM interaction rule with tests, not a new abstraction.
- At mobile widths, allow the panels to fit within the viewport by wrapping their contents or constraining width. Do not hide required legend meanings or clip checkbox labels.
- Keep controls keyboard accessible with native buttons, visible focus, and text labels. Do not use emoji as an icon substitute.

### Verification

- Run:

  ```bash
  cd pitwall && npx vitest run tests/settings.test.ts tests/legend.test.ts tests/screenFit.test.ts tests/integration.test.ts --no-file-parallelism
  cd pitwall && npx tsc --noEmit
  ```

- Expected: each control opens only its own panel, settings behavior and privacy tests remain green, and no required control is represented by a clipped fragment.

**Commit suggestion, do not run while preparing this plan:**

```text
fix: separate pitwall settings and legend
```

## Task 6: Browser QA and release evidence

**Files:**

- Modify: `pitwall/scripts/shot.ts` only if deterministic fixture selection or viewport capture needs a minimal extension
- Create during QA outside the source tree only if needed: temporary Chrome HTML fixtures under the OS temp directory
- Do not commit generated screenshots, browser logs, or temporary fixtures unless a separate user request explicitly asks for evidence artifacts

**Interfaces:**

- Consumes: production `dist/pitwall.html` from `npm run build:single`, the existing dataset picker, deterministic demo fixtures, and Chrome’s `--headless=new --screenshot` path.
- Produces: a QA matrix with screenshots, DOM measurements, console output, and pass/fail notes. It must be evidence, not a claim that native LIVE is approved.

### RED or preflight

- Build the production artifact:

  ```bash
  cd pitwall && npm run build:single
  ```

- Start the existing Vite dev server only if DOM inspection needs a local origin. For the shipped artifact, use the existing file-based Chrome path.
- Prepare deterministic cases for:
  1. sparse and empty, with the full track and “관측 차량 없음” or equivalent honest empty state;
  2. dense, with three digit car numbers, overflow, CJK strings, and the `+N` marker;
  3. stale/no-data, with a slow moving main-track idle car and complete `LIVE · STALE DATA <age>` text;
  4. stopped error, with a stationary `PIT · ERR` car;
  5. stopped limit, with a stationary `PIT · LIM` car;
  6. broadcast focus automatic, manual, and empty states;
  7. settings open and legend open as separate states;
  8. syncing/backlog with the literal queue count;
  9. reduced motion;
  10. long CJK labels at 200 percent zoom.

- Capture every case at viewport widths **375, 768, 1280, and 1800 CSS pixels**. Capture the desktop final states at the supplied **1800×960** viewport. Repeat the required mobile and desktop states at **200 percent zoom**.
- For every LIVE state, run a DOM measurement script that records:

  ```javascript
  const status = document.querySelector('.live-status');
  const rect = status?.getBoundingClientRect();
  ({
    text: status?.textContent,
    scrollWidth: status?.scrollWidth,
    clientWidth: status?.clientWidth,
    rectWidth: rect?.width,
    right: rect?.right,
    viewportWidth: window.innerWidth,
  });
  ```

- Treat `scrollWidth > clientWidth`, a right edge beyond `innerWidth`, an ellipsis in a required status string, or a visibly clipped screenshot as a failure. This explicitly closes the G001 evidence gap.
- Inspect the track SVG for exactly one main circuit path and a short pit spur. Record `data-renderer`, path counts, pit path length or point count, and visible car transforms. A full second loop is an immediate failure even if the focus panel looks correct.
- Record console errors and warnings, SVG node count, `scrollWidth === innerWidth`, visible focus, contrast spot checks, and whether CJK syllables or required values are clipped.
- If a metric fails, return to the relevant task’s RED test. Do not waive it with a screenshot explanation.

### Verification matrix

| Width or mode | Required checks |
|---|---|
| 375 | Vertical reading order is LIVE facts, focus, full track, tower or event evidence; no horizontal scroll; settings and legend fit when opened |
| 768 | Focus and track remain readable together or in the documented two-stage stack; no horizontal scroll at 200 percent |
| 1280 | Stable broadcast frame; full track remains visible; focus does not resize or crop the circuit; dense tower remains readable |
| 1800×960 | Fresh, syncing, settled or connected, quiet, stale, stopped error, and stopped limit captures; no required HUD clipping; legend and settings remain in viewport |
| 200 percent zoom | Required facts, CJK, focus, dense cards, settings, and legend remain readable without horizontal scrolling |
| Reduced motion | No idle animation, focus transition, or CSS pulse; state text and geometry remain present |

### Final commands and expected outcomes

```bash
cd pitwall && npx vitest run --no-file-parallelism
cd pitwall && npx tsc --noEmit
cd pitwall && npm run build:single
cd pitwall && git diff --check
```

Expected outcomes:

- Full test suite passes with no regression in the current 898-test baseline unless new tests intentionally increase the count.
- TypeScript reports zero errors.
- Single-file production build succeeds.
- `git diff --check` reports no whitespace errors.
- Browser QA passes every row in the matrix, with G001 stale age measured in pixels and DOM width, not only text content.
- Native LIVE remains marked **not approved by this plan**. Any native LIVE test must be a separately scheduled human-operated gate with its own evidence and must not be claimed as part of this implementation.

**Commit suggestion, do not run while preparing this plan:**

```text
test: capture pitwall responsive ui evidence
```

## Execution Order and Commit Boundaries

Execute tasks in this order because later visual checks depend on earlier geometry and status contracts:

1. Task 1, status truth and non-clipping.
2. Task 2, one-track geometry and motion semantics.
3. Task 3, focus panel behavior on the safe renderer.
4. Task 4, dense card readability.
5. Task 5, separated settings and legend controls.
6. Task 6, production build and Chromium QA.

Each task ends with its own targeted test and typecheck. Do not combine unrelated edits into one commit. The final QA task may update `pitwall/scripts/shot.ts` only when the existing capture path cannot express the required viewport or fixture; otherwise keep it documentation and evidence only.

## Self-Review and Coverage Ledger

This plan was checked against the requested PRDs, HANDOFF, REVIEW, and G001 gate evidence:

| Requirement or correction | Covered by |
|---|---|
| Non-clipped LIVE and complete STALE age | Task 1, Task 6 pixel and DOM measurement |
| G001 `.live-status` ellipsized stale age blocker | Task 1 RED test, Task 6 `scrollWidth` and `clientWidth` measurement |
| One normal main track and existing thin pit lane | Task 2 default legacy boot, path-count browser check |
| Never enable a second full broadcast circuit by default | Global Constraints, Task 2 boot regression, Task 3 opt-in boundary |
| Stale/no-data slow deterministic main-track motion | Task 2 RED and GREEN contract |
| Error/limit stationary in pit | Task 2 separate error and limit tests and browser states |
| Broadcast focus panel | Task 3 DOM focus contract and director tests |
| Manual focus precedence and automatic dwell/preemption | Task 3 director and integration tests |
| Dense card readability and three digit numbers | Task 4 tests and rem-based CSS measurement |
| CJK and 200 percent zoom | Task 4 browser requirement, Task 6 matrix |
| Settings and legend separated | Task 5 independent toggle and positioning tests |
| Sparse, dense, stale, stopped, focus, settings, legend browser states | Task 6 fixture list and matrix |
| Offline single HTML, no dependencies, no WebGL or Three.js | Global Constraints, Task 6 build |
| Privacy and no raw identifiers or prompts | Global Constraints, Task 3 privacy tests, Task 4 card tests |
| Reduced motion and accessibility | Global Constraints, Tasks 3 and 5, Task 6 reduced-motion checks |
| Native LIVE not promised | Global Constraints, Task 2 and Task 6 explicit gate language |

Self-review result:

- The unresolved-marker scan is clean. Every implementation step names its file, seam, test, command, and expected result.
- Task interfaces use the current symbol names and types, including `BroadcastCandidate`, `BroadcastSelection`, `TrackModel`, `TrackRenderer.render`, and `SettingsPanel` callbacks.
- No task asks the worker to add product code before its RED test.
- No task changes the existing product behavior by silently enabling the broadcast WIP renderer.
- No task claims a browser screenshot can prove native LIVE.
- The only requested artifact from this planning task is this plan file. Product source, existing docs, evidence, and git history must remain otherwise untouched.
