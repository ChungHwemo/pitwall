# PITWALL Frontend Design State

Updated: 2026-08-08
Phase: Task 2 — extracted design/operating contract, before real-time UI source changes

## Current Objective

Lock PITWALL’s existing visual language and the operating rules for truthful LIVE freshness, automatic broadcast focus, and responsive access before changing UI source. The implementation must remain a zero-runtime-dependency, offline single-HTML SVG/CSS surface with manual focus priority and a complete visible track.

## Locked Decisions

1. Preserve the dark monospace, Korean/CJK-first, timing-tower operational identity. No rebrand or borrowed Layer-B identity.
2. Preserve the tower as the information spine and the complete SVG circuit as spatial context.
3. Interpret the requested depth as fixed 2.5D CSS/SVG depth plus a Director-controlled detail cut. Do not add a spatial scene engine, canvas renderer, runtime package, or user camera controls.
4. Vehicle freshness uses the existing internal receipt/event clock: fresh `0..30,000ms`, quiet `30,001..300,000ms`, stale `>300,000ms`. `wall_ts` remains reporting metadata only.
5. LIVE state is syncing when real pending work is positive; otherwise stale after last emitted event age exceeds 300,000ms; otherwise connected. Stale means stale data, never a claimed bridge disconnection.
6. State precedence is manual focus > stopped reason > automatic broadcast focus > freshness > heat. Stopped movement/glyph truth is never weakened by a higher visual emphasis.
7. Manual track/tower focus persists until explicitly toggled off. Automatic focus then resumes from the first eligible Director result without mutating manual selection or pin state.
8. Reuse pooled SVG nodes. `.car-hit` becomes the freshness ring; no per-car decoration node is added. Total SVG nodes stay at or below 800.
9. Responsive anchors are 375 stacked, 768 compressed stacked, and 1280 full split. The document owns primary vertical scroll at 375/768; the 1280 shell is bounded by `100dvh`.
10. At narrow widths, provenance, car number, state, limit, money/rate remain before model, spark, and feed detail.
11. Motion is semantic and limited to transform, opacity, and filter. Reduced motion removes idle/freshness/broadcast animation without removing state.
12. No Critical or Major accessibility issue is accepted as debt.

## Source Inputs and Explicit Exclusions

### Inputs

- `DESIGN.md` — extracted project contract and implementation source of truth.
- `pitwall/src/style.css` — actual palette, type, shell, rows, overlays, heat, idle, focus, reduced-motion, and pooled hit-area treatments.
- `pitwall/src/config/theme.ts` — semantic track, polarity, class/shape, provider, contribution, and contrast tokens.
- `pitwall/src/main.ts` and `pitwall/src/render/*` — DOM anatomy, selection, pooling, state attributes, native controls, overlays, and information order.
- `pitwall/src/director/director.ts`, `pitwall/src/state/reducer.ts`, and `pitwall/src/track/trackModel.ts` — Director timing, receipt-clock state, token progress, heat, and idle rules.
- `README.md`, `PITWALL.md`, `pitwall/CHECKLIST.md`, product PRD, and UI/UX PRD — ambient intent, privacy, performance, no-ranking, accessibility, and evidence boundaries.
- `.omo/plans/review-realtime-ui.md` — accepted 2.5D, freshness, focus, responsive, and QA contract.
- beui animated-badge raw source — mechanism only: stable semantic state, keyed text/shape, optional meaningful pulse, and reduced-motion equivalence.

### Exclusions

- No new brand language, Layer-B clone, visual framework, runtime/tooling package, second renderer, scene engine, canvas path, or user camera interaction.
- No ranking, personal-performance comparison, body capture, raw account identity, outbound runtime telemetry, public sharing, or fabricated heartbeat.
- No event-driven vehicle movement without tokens, hidden full-track context, added per-vehicle decoration node, or layout animation.
- No acceptance of unresolved Critical/Major accessibility debt.

## Design Brief

PITWALL is an ambient second-screen race-control wall. Its job is to answer “busy or quiet?” and “is anything wrong?” within three seconds without demanding attention. It expresses anonymous aggregate activity through a dense tower, a full circuit, stateful shapes, restrained broadcast emphasis, and truthful provenance. Sparse data may look sparse; the interface never fills silence with invented facts.

### Success criteria

- At 375, 768, and 1280, the primary surface has no horizontal scroll and preserves its information hierarchy.
- Fresh/quiet/stale vehicles and connected/syncing/stale LIVE status are legible through text plus shape, not color alone.
- Manual focus always wins subject selection until the user toggles it off; automatic focus then resumes without side effects.
- Reduced motion, keyboard operation, 200% zoom, long Korean labels, long unbroken model identifiers, empty/malformed input, and sparse/dense data remain usable.
- The full track remains visible, token-derived position remains authoritative, and the SVG stays within 800 nodes.

## Inclusive Personas

| Persona | Context and need | Binary task criterion |
|---|---|---|
| Ambient second-screen user | Coding on the primary display; glances at PITWALL for at most three seconds | PASS iff they can identify busy/quiet and whether an error/limit/stale condition exists from the HUD, tower, and track without opening an overlay |
| Keyboard and large-text user | Navigates without a pointer and uses 200% zoom | PASS iff every dataset/settings/legend/tower action is keyboard reachable, Enter/Space toggles the intended car, focus is visible, and the 768 viewport has no primary horizontal scroll at 200% zoom |
| Reduced-motion and CJK user | Uses `prefers-reduced-motion: reduce` and reads Korean labels/model data | PASS iff idle/freshness/broadcast animation computes to none while textual/shape states still change, and long Korean plus a 60-character unbroken identifier show no tofu, clipped syllable, or loss of higher-priority facts |

## Adaptive Preferences

| Preference / constraint | Required adaptation | Must remain unchanged |
|---|---|---|
| Reduced motion | Disable idle sway, freshness pulse, and broadcast transition | State attributes, text, shape, focus, selection, and token position |
| 200% zoom / large text | Reflow the 768 shell into one readable column with document scrolling | Provenance, number, state, limit, cost/rate, keyboard order |
| Keyboard-only | Native controls plus Enter/Space tower selection and visible inset focus | Selection toggle semantics and manual priority |
| Color-vision variation | Pair class/status colors with shape and text | Semantic distinctions and contrast |
| Korean/CJK content | No decorative tracking on Korean; wrap at semantic boundaries; preserve baselines | Whole syllable blocks and information priority |
| Long unbroken model ID | Ellipsize/wrap secondary detail before primary facts | Provenance, number, state, limit, money/rate |
| Empty/sparse data | Keep honest empty copy and full context | No fabricated cards, movement, or state |
| Dense data | Use pooling, explicit overflow counts, and compressed rows | ≤800 nodes and no silent truncation |

## Design Principles and Taste Signals

- Truth over spectacle: stale, unknown, empty, and stopped are first-class visible facts.
- Glance over study: pace/state/limit/provenance outrank detailed identifiers.
- Stable context: selecting or focusing a subject never moves or hides the circuit.
- Dense but calm: tonal surfaces, hairlines, mono numbers, and motion only for real state.
- Anonymous by construction: car number and class, no performance rank or raw identity.
- Existing primitives first: pooled SVG groups, native controls, `stack`, `cluster`, `scroll-body-shell`, and `overlay-stack`.

## Verification Matrix

| ID | Surface and exact scenario | Binary PASS observable | Planned evidence |
|---|---|---|---|
| V-01 | Browser at 375×812, 768×1024, 1280×800 | `document.documentElement.scrollWidth === window.innerWidth`; 375/768 are one column; 1280 is full split; primary facts and full track are visible | Task 5 responsive captures |
| V-02 | Browser at 768×1024 and 200% zoom with long Korean and 60-character model ID | No primary horizontal scroll, tofu, single-syllable clipping, or loss of provenance/number/state/limit/money | Task 5 content-stress capture |
| V-03 | Browser with `prefers-reduced-motion: reduce` | Computed idle/freshness/broadcast animations are none while state text/attributes still update | Task 5 reduced-motion capture |
| V-04 | Keyboard tab sequence through dataset, settings, legend, and tower; press Enter then Space | Each control receives visible focus; the intended selection toggles exactly once per key | Task 5 keyboard log/capture |
| V-05 | LIVE burst of 65 events followed by drain | Pending 1 produces syncing +1; drain produces connected; emitted car has fresh text/shape | Task 3 browser evidence |
| V-06 | Receipt ages 30,000 / 30,001 / 300,000 / 300,001ms | States are fresh / quiet / quiet / stale exactly | Task 3 boundary evidence |
| V-07 | Fresh car with limit/error and manual selection | Stopped mark/movement truth remains; manual detail remains selected; no active-running cue appears | Task 3/4 state-precedence evidence |
| V-08 | Manual selection, Director update, then explicit deselection | Director cannot steal manual focus; exactly one automatic focus resumes after deselection; pin state is unchanged by auto focus | Task 4 browser evidence |
| V-09 | Dense rendered SVG and 1,000-frame DOM check | SVG node count ≤800 and exact DOM node count is stable | Integration/performance evidence |
| V-10 | Static/runtime scope checks | Runtime dependency count remains zero; one SVG tree; no new renderer, ranking/body/outbound path, SVG transform attribute, or layout animation | Tasks 3-7 and final review |

## Decisions Log

| Date | Decision | Rationale | Sources |
|---|---|---|---|
| 2026-08-08 | Extract the existing system instead of selecting new style references | The product already has a coherent dark mono component system; a new brand would erase observed behavior | `style.css`, theme, renderers, frontend extracted-project branch |
| 2026-08-08 | Use 2.5D fixed depth and broadcast detail rather than a spatial scene | Meets REVIEW intent while preserving full-track truth, offline delivery, SVG pooling, and zero runtime packages | Locked plan Tasks 2/4; PRD §11 |
| 2026-08-08 | Adapt only the animated-badge state mechanism | Semantic status, meaningful pulse, and reduced-motion equivalence fit; its implementation stack does not | beui raw source; `DESIGN.md` §6 |
| 2026-08-08 | Reuse `.car-hit` as freshness ring | The pooled node already covers every car; reuse preserves the node budget | `trackRenderer.ts:132-163`; `style.css:521-530` |
| 2026-08-08 | Treat current narrow typography/contrast as blocking work | 13px root and 4.43:1 subtle text cannot be accepted for essential mobile facts | `style.css:20-25`; measured palette contrast; plan Task 5 |

## Open Questions

None for Task 2. Implementation evidence may discover Minor/Note debt; any Critical/Major issue blocks rather than entering the debt register.

## Artifact Index

| Artifact | Purpose | Status |
|---|---|---|
| `DESIGN.md` | Sections 1-8 design-system contract | Created in Task 2 |
| `.omo/frontend-design/state.md` | Lane D operating state and handoff | Current file |
| `.omo/plans/review-realtime-ui.md` | Accepted delivery and QA plan | Input; never staged by Task 2 |
| `.omo/evidence/ulw/review-ui-realtime-20260808/G001-review-md-ui-ux/a1/task-2-design-contract-report.md` | Task 2 QA-by-read and commit report | Produced at Task 2 close |
| `.omo/evidence/ulw/review-ui-realtime-20260808/G001-review-md-ui-ux/a1/task-2-design-contract-error.txt` | Scope/prohibited-debt inspection | Produced at Task 2 close |

## Design Debt Register

| ID | Date | Source | Severity | Issue | Affected users | Suggested fix | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | No accepted design or accessibility debt | — | — | Clear | Current narrow typography/contrast and responsive gaps are blocking Task 5 obligations, not debt |

Accepted accessibility debt: none. No user acknowledgement is required because none is accepted.

## Handoff Notes

- Task 3 must implement the exact freshness and LIVE boundaries from Locked Decisions using existing clocks and pooled nodes. It must update `DESIGN.md` only if implementation proves a genuinely new semantic token is necessary.
- Task 4 must call `Director.update()` once per render, separate manual and automatic focus, preserve pin semantics, and keep the complete circuit visible.
- Task 5 must implement the responsive modes and resolve the blocking 13px/4.43:1 essential-text gaps before browser sign-off.
- All implementation lanes must use `DESIGN.md` tokens and primitives, preserve privacy/no-ranking/offline contracts, and attach real Browser/visual-QA evidence before Lane C judgment.
- Task 7 owns the final evidence index, debt update, handoff, and retrospective after the frozen implementation tree exists.

## Retrospective Notes

- Extraction exposed two pre-existing accessibility obligations early: narrow root type can reach 13px, and subtle text is 4.43:1 on the base. Locking them as blockers prevents accidental acceptance during responsive work.
- Reusing `.car-hit` and data attributes keeps the state model legible without adding architecture or DOM cost.
- Final implementation retrospective is pending Tasks 3-7 and final verification; this phase makes no rendered-UI pass claim.

## Evidence Index

| Evidence | Claim supported | Current state |
|---|---|---|
| `task-1-baseline-report.md` in the current attempt directory | Trusted 858-test baseline and stable DOM workload before design work | Existing |
| `task-2-design-contract-notepad.md` in the current attempt directory | Source extraction, skill/tier decisions, and QA scenarios | Current |
| `task-2-design-contract-report.md` in the current attempt directory | Full QA-by-read, exact source scope, commit SHA, and final status | Pending Task 2 close |
| `task-2-design-contract-error.txt` in the current attempt directory | Diff, prohibited scope/debt, and `pitwall/src` guard | Pending Task 2 close |

Design memory is descriptive evidence only. It does not silently constrain another project or create hooks, schedulers, or an independent runtime.
