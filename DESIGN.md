# PITWALL Design System

This is an extraction of the shipped interface plus the locked real-time UI contract. It is not a rebrand. Source anchors are `pitwall/src/style.css`, `pitwall/src/config/theme.ts`, the renderers, `README.md`, `PITWALL.md`, `pitwall/CHECKLIST.md`, and the product/UI PRDs.

## 1. Atmosphere & Identity

PITWALL is a quiet, dark race-control wall for a second monitor: operational, glanceable, and truthful. It is not a dashboard to study. The user should identify “busy or quiet?” and “is anything wrong?” in three seconds, then return to their primary work. The signature is the full circuit held beside a dense timing tower, with semantic vehicle shapes and restrained broadcast focus rather than cards or charts competing for attention.

The identity stays Korean/CJK-first, monospace, anonymous, and tower-first. Race language may explain system facts, but may never fabricate movement, certainty, connectivity, rank, or individual performance. Empty space is allowed when activity is sparse.

Source: `README.md:3-10`, `PITWALL.md:124-185`, PRD §§1, 2, 6, and `pitwall/src/style.css:41-75`.

## 2. Color

### Core palette

| Role | Token | Value | Contract |
|---|---|---:|---|
| Base surface | `--pw-bg` | `#0e1116` | Body, camera panel, track glyph cutouts |
| Raised surface | `--pw-surface` | `#161b22` | Controls, popovers, summary |
| Overlay surface | `--pw-overlay` / `--pw-overlay-strong` | `#161b22ee` / `#161b22f2` | Summary and fixed control overlays |
| Subtle separator | `--pw-line` | `#1c222b` | Row rules, meter tracks, contribution step 0 |
| Strong separator | `--pw-border` | `#2a323d` | Control and overlay borders |
| Neutral meter fill | `--pw-meter` | `#3d6d8c` | Model usage bar only |
| Primary text | `--pw-text` | `#e6edf3` | Required facts and selected track stroke |
| Secondary text | `--pw-text-muted` | `#9fb3c8` | Captions and non-primary facts; 8.79:1 on base |
| Subtle text | `--pw-text-subtle` | `#6b7c91` | Nonessential or large text only; 4.43:1 is below the 4.5:1 body-text floor |
| Quiet graphic | `--pw-quiet-graphic` | `#55636f` | Non-text quiet/stale shape; 3.06:1 on base |
| Primary accent | `--pw-accent` | `#4dc3ff` | Prototype class, focus, selection, syncing/fresh signal |
| Positive | `--pw-positive` | `#4ade80` | Connected/positive state with text or shape |
| Caution | `--pw-caution` | `#ff5c5c` | Error, limit, and urgent event polarity |
| Delta | `--pw-delta` | `#F2C744` | Numeric deltas and gaps only |
| GT class | `--pw-class-gt` | `#c084fc` | GT square; never a text-only class cue |

### Track and data ramps

| Role | Values | Contract |
|---|---|---|
| Track center / pit / sector | `#3f5963` / `#334b55` / `#6f8792` | Centerline outranks pit lane; sector remains neutral |
| Track marker dark / light | `#11161d` / `#e8edf3` | Chequered start, finish, and pit geometry |
| Contribution ramp | `#1c222b`, `#334b55`, `#3f5963`, `#6f8792`, `#9fb3c8` | Organization intensity only |
| Provider chips | `#e0955e`, `#2fbf9f`, `#5fa8f0`, `#c9d1d9`, `#8b90f5`, `#e06abf` | Always paired with provider abbreviations |

### Semantic rules

- H/P/GT are red triangle, cyan circle, and purple square. Color never carries class alone.
- `connected` uses positive plus literal text; `syncing` uses accent plus the real pending count; global `stale` uses quiet graphic plus stale-data text.
- Vehicle `fresh` uses accent, `quiet` uses muted/quiet treatment, and `stale` uses the quiet graphic token. The reused `.car-hit` ring and legend text provide shape plus words; no vehicle decoration node is added.
- Error and limit share caution color but keep different stopped shapes and labels. A stopped vehicle never receives a visual cue that reads as actively running.
- Heat may adjust brightness only. It never changes class, status, freshness, or position.
- No value outside this palette enters UI code until this section is updated from an observed semantic need.

Source: `pitwall/src/config/theme.ts:4-108`, `pitwall/src/style.css:155-202,475-563`, and `pitwall/src/render/trackRenderer.ts:51-73`.

## 3. Typography

### Font stack and scale

- Primary and only family: `ui-monospace, "SF Mono", Menlo, monospace`.
- Root scale: `calc(var(--pw-zoom) * clamp(13px, min(100vw / 90, 100vh / 56.25), 34px))`, anchored at 16px for 1440×900. `--pw-zoom` remains the viewing-distance control.
- At 375/768 and 100% zoom, required body facts have a 14 CSS-pixel minimum. Small captions may be smaller only when nonessential and still legible/contrasting.

| Role | Size | Weight / tracking | Existing use |
|---|---:|---|---|
| Provider micro-label | `0.6rem` | 700 / `0.02em` | Provider chip abbreviation |
| State caption | `0.7rem` | regular / up to `0.14em` for Latin state codes | RUN, IDLE, PIT states, metadata |
| Dense detail | `0.75rem` | regular | Feed rows and totals |
| Supporting body | `0.85–0.95rem` | regular | Models, radio, feed empty copy |
| Default operational fact | `1.05rem` | regular | HUD and money |
| Primary pace | `1.35rem` | 700 | Cost/rate/token pace group |
| Focus subject | `1.6rem` | 700 | Feed subject |
| Vehicle identifier | `1.875rem` | 700 | Tower car number |

### CJK and content rules

- Korean labels do not receive decorative wide tracking; syllable-block cohesion wins over Latin display styling.
- Tabular numbers stay monospace. Units remain attached to their numbers, and state abbreviations remain intact.
- Long Korean labels wrap at semantic boundaries. A long unbroken model identifier may ellipsize after provenance, number, state, limit, cost, and rate remain visible.
- No tofu, split syllable, one-character clipping, or text substituted by an icon.
- SVG uses user units, never `rem`; the viewBox already scales its contents.

Source: `pitwall/src/style.css:1-47,124-177,396-409`, `PITWALL.md:187-202`, and the Task 5 CJK/zoom contract.

## 4. Spacing & Layout

### Existing spacing tokens

These steps are extracted from repeated CSS values. Component-specific geometry such as SVG user units, intrinsic sizing, `minmax()`, and `clamp()` remains local mechanics.

| Token | Value | Use |
|---|---:|---|
| `--pw-space-micro` | `0.12rem` | Tight inline separation |
| `--pw-space-1` | `0.25rem` | Compact metadata and control padding |
| `--pw-space-2` | `0.4rem` | Row interior |
| `--pw-space-3` | `0.5rem` | Shell gap and radio padding |
| `--pw-space-4` | `0.6rem` | Tower columns and compact totals |
| `--pw-space-5` | `0.75rem` | HUD/radio horizontal padding |
| `--pw-space-6` | `1.1rem` | HUD cluster and section separation |
| `--pw-space-7` | `1.4rem` | Summary interior |
| `--pw-space-8` | `1.75rem` | Summary wide-axis interior |

`--hair` is `max(1px, 0.0625rem)`. `--tower-min` is 36rem in the full split because the fixed tower columns require 35.05rem before safety margin.

### Spatial primitives

- `stack`: a single-axis vertical sequence used by tower, model panel, feed, settings, and radio. Child order is semantic priority, not visual symmetry.
- `cluster`: an inline group that keeps related facts together, used by HUD, dataset provenance, state labels, and native controls. It may wrap only in stacked modes.
- `scroll-body-shell`: at 375 and 768 the document is the only primary vertical scroll owner. The shell and its tower/detail children expand in normal flow; they do not create nested primary scrolling.
- `overlay-stack`: legend, settings, camera/feed detail, and summary layer over stable context. Opening an overlay must not move the track. The contribution grid is the only existing local scroll region, bounded inside the summary.

### Responsive shell modes

| QA anchor | Mode | Layout and information order | Scroll owner |
|---:|---|---|---|
| 375px | Stacked | HUD/provenance → tower → complete track/detail → models → radio. One readable column. Secondary model, spark, and feed detail collapse before number, state, limit, money/rate, and provenance. | Document only |
| 768px | Compressed stacked | Same semantic order with denser rows and wider track/detail. No primary horizontal scroll at 100% or 200% zoom. | Document only |
| 1280px | Full split | HUD and radio span; tower/models left; complete track plus overlay detail right. The shell is bounded by `100dvh`; selection/focus cannot resize the track context. | No body scroll; only the bounded contribution grid may scroll |

The stacked/full-split switch is below/above 900px. The three listed widths are mandatory visual-QA anchors, not new device categories. At every width `document.documentElement.scrollWidth === window.innerWidth` for primary content.

Source: `pitwall/src/style.css:61-85,97-153,327-473`, `pitwall/src/main.ts:139-210`, and `.omo/plans/review-realtime-ui.md` Task 5.

## 5. Components

### Pitwall Shell

- **Structure:** `.pitwall` contains `.hud`, `.tower-slot` plus model stack, `.detail` containing `.cams` and `svg.track`, then `.radio`.
- **States:** 375 stacked, 768 compressed stacked, 1280 full split; empty, sparse, dense, long-content, and 200% zoom.
- **Accessibility:** one primary scroll owner; no horizontal primary scroll; source provenance precedes optional controls.

### HUD Cluster

- **Structure:** wall/replay clock, pace, phase, optional salary/hourly curve, dataset provenance, LIVE status, legend, settings.
- **States:** replay, demo, LIVE connected, LIVE syncing with exact pending count, LIVE stale-data age, absent optional values.
- **Rules:** `syncing` wins while pending is positive; otherwise stale after the last emitted event exceeds 300,000ms; otherwise connected. The native bridge has no heartbeat, so stale copy never claims disconnection.
- **Accessibility:** LIVE status is textual and exposed through a polite status region; native buttons/selects remain native.

### Timing Tower Row

- **Structure:** class bar, car number, model/provider, spark, state, limit, money/rate.
- **States:** run, idle, limit, error, selected, focused, dense, hidden pool slot.
- **Interaction:** click, Enter, and Space toggle manual focus; `aria-pressed` mirrors selection; focus is drawn inside the clipped row.
- **Priority:** provenance, number, state, limit, money/rate survive before model and spark detail.

### Track and Vehicle Glyph

- **Structure:** one complete SVG track; pooled `g.car`/`g.cold` groups reuse `.car-hit`, class badge, and F1 silhouette. Hot groups may also contain the existing fuel ring and stopped mark.
- **States:** fresh, quiet, stale, heat, idle, stopped error, stopped limit, manual focus, automatic broadcast focus, pooled hidden.
- **Freshness:** internal receipt/event clock only: fresh `0..30,000ms`, quiet `30,001..300,000ms`, stale `>300,000ms`. `wall_ts` is reporting metadata only.
- **Precedence:** manual focus > stopped reason > automatic broadcast focus > freshness > heat. Manual focus owns the detail subject and selected outline. Stopped reason still owns movement and stopped glyph/ring, so selection cannot make a stopped vehicle look active. Freshness and heat never alter token-derived progress.
- **Focus modes:** with a manual track/tower selection, Director output cannot replace the subject. Toggling that same selection off resumes automatic focus from the first eligible Director result on the next render. Automatic focus never mutates selection or pin state.
- **Budget:** preserve one live SVG tree and at most 800 SVG nodes. Reuse `.car-hit` as the freshness ring; add no per-vehicle decorative node.
- **Broadcast contract:** the full-field SVG/DOM radar stays visible at all times; one dominant subject card is the only broadcast focus. Radar geometry and scale never change when focus changes.
- **Director:** score only observed data: within the last 10s, `error` 400, `limit` 300, `critical` 200, `warn` 100, `info` 25, comparable `work_per_min` change of at least 25% 50, otherwise fresh 1. Ties sort by newest `last_event_ts`, then ascending code-point `car_id`. Dwell is 5s; during dwell, a replacement must be at least 100 points higher. No candidate means literal “방송 포커스 없음 — 새 이벤트 대기”.
- **Stable identity:** pooled SVG slots are an allocation detail, not car identity. A car’s visual identity remains keyed by `car_id` across hot/cold reorder and membership changes; reassignment must not teleport a visible car.
- **Truthful sparse/stale states:** sparse and empty data keep the full course and literal “관측 차량 없음”; dense overflow is explicit with `+N`; stale shows elapsed age without inventing progress, speed, position, or connectivity; stopped `ERROR` and `LIMIT` keep distinct shapes and text.

### Detail / Feed Overlay

- **Structure:** selected/focused car header and pooled recent-event rows over a stable full-track context.
- **States:** empty instruction, manual subject, automatic broadcast subject, malformed/empty recent feed, long identifier.
- **Rule:** changing focus may transition the overlay but cannot hide or resize away the complete circuit.

### Legend, Settings, and Summary Overlays

- **Structure:** native toggle + fixed overlay; summary includes a bounded contribution grid.
- **States:** open/closed, keyboard focus, empty/large dataset.
- **Rules:** overlays remain within the viewport and never leave a half-clipped control. Legend explains freshness and LIVE states with text plus shapes.

### Provider Chip and Radio Event

- **Structure:** short text abbreviation plus semantic color; radio line with severity/polarity.
- **States:** known/unknown provider, info/warn/critical, positive/caution/neutral.
- **Rule:** these are supporting facts and never become ranking or identity axes.

Source: `pitwall/src/main.ts:139-224`, renderers under `pitwall/src/render/`, `pitwall/src/track/trackModel.ts`, and Tasks 3-5 of the locked plan.

## 6. Motion & Interaction

| Motion | Value | Meaning |
|---|---:|---|
| Idle sway | `4s ease-in-out infinite` | Local engine-idle presence only; never progress |
| Projection | `requestAnimationFrame`, elapsed-time anchors | Smooths between observed anchors without overtaking them; H1’s call-count-clock diagnosis is refuted |
| Broadcast cut | `160–240ms` | One interruptible opacity/transform cross-fade for a real Director subject change |

The beui animated-badge reference contributes one mechanism only: stable semantic status with keyed text/shape, optional state-only pulse, and an equivalent reduced-motion result. PITWALL implements that mechanism through existing attributes, pooled nodes, and CSS; it does not import the reference’s component or animation stack.

Rules:

- Animate only `transform`, `opacity`, and `filter`. Never animate layout properties or write SVG `transform` attributes.
- Motion serves actual state: syncing/freshness transition, automatic broadcast cut, projection, or idle presence. No decorative hover motion.
- `prefers-reduced-motion: reduce` disables idle sway, freshness pulse, and broadcast transition while leaving state text, shapes, focus, selection, and live attributes unchanged.
- Manual selection persists until the user toggles it off. Automatic focus may not steal it or change pin state.
- No user-controlled camera movement. The product keeps the complete circuit visible and uses a fixed-depth broadcast detail cut; a three-dimensional scene engine is outside the product contract.
- H3 identity rule: pooled node index is never a visual identity key; preserve per-car continuity through reordering and hot/cold membership changes.

Source: `pitwall/src/style.css:475-519`, `pitwall/src/render/projection.ts`, `pitwall/src/director/director.ts`, the beui animated-badge mechanism, and plan Task 4.

## 7. Depth & Surface

Strategy: mixed tonal shift and borders, with restrained translucent overlays.

- Base and camera surfaces use `--pw-bg`; raised controls/cards use `--pw-surface`; `--pw-line` and `--pw-border` establish hierarchy.
- Fixed overlays use the existing near-opaque raised surface (`#161b22ee`/`#161b22f2`) and 6px backdrop blur. No shadow vocabulary is introduced.
- The 2.5D track uses the existing track/pit tonal hierarchy plus CSS transform/filter depth. The full track remains the stable context; detail focus is layered over it.
- Selected/manual focus, stopped marks, broadcast focus, freshness ring, and heat are separate semantic layers governed by Section 5 precedence.
- Exactly one new `BroadcastTrackRenderer` is permitted as the SVG/DOM broadcast renderer; it is selected at boot and falls back to the legacy `TrackRenderer` for the session under the documented seam. No additional renderer, runtime dependency, canvas, WebGL, or scene engine is permitted. No user camera controls. Depth remains static, CSS/SVG-native, and compatible with the offline single-HTML build.
- Broadcast assets map only to the broadcast radar/focus/timeline surface: `pitwall/assets/broadcast/Kenney Future Narrow.ttf` (CC0) and the five pinned Tabler MIT SVGs listed in `pitwall/assets/broadcast/SOURCE.txt`; licenses are `LICENSE-CC0.txt` and `LICENSE-MIT.txt`. No external runtime fetch is permitted.

Source: `pitwall/src/style.css:268-364,422-473`, `pitwall/src/config/theme.ts:4-23`, and plan guardrails.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and meaningful graphics, visible focus, keyboard reachability, and non-color state cues.
- Every vehicle class and operational state uses shape/text plus color. Track status never depends on a text label placed on the track.
- Tower selection works with Enter and Space; native controls remain native; all focus indicators survive clipping.
- Reduced motion preserves every semantic update with no animation.
- At 375, 768, and 1280 CSS pixels, and at 200% zoom on 768, primary content has no horizontal scroll and no clipped required fact.
- Korean/CJK labels preserve syllable blocks and readable baselines; long Korean and unbroken model content follow the information priority in Sections 3-5.
- Dense and sparse/empty datasets remain truthful. Silent truncation is forbidden; hidden/overflow counts must be explicit.
- The SVG remains at most 800 nodes, uses pooled groups, and adds no freshness decoration node.
- Privacy is part of accessibility and trust: no ranking, public sharing, prompt/response body, raw account identifier, outbound runtime telemetry, or fabricated connection/activity claim.
- Preserve the exact rollback seam comment: `/* LEGACY/ROLLBACK 2026-08-08: this.trackRenderer = new TrackRenderer(svg, track); */`. Broadcast support checks SVG/DOM/CSS `transform`; unsupported, construction/first-render failure, and one post-success fatal render failure fall back for the session. Reduced motion is not a fallback condition; WebGL is never requested.

### Blocking obligations before UI sign-off

- Current narrow-root sizing can reach 13px, and `--pw-text-subtle` is 4.43:1 on the base. Task 5 must raise required mobile body facts to at least 14px and keep essential small text on an AA-safe token. This is a blocking obligation, not accepted debt.
- Current CSS has no 375/768 responsive shell. Task 5 must implement and visually verify the locked modes before sign-off. This is a blocking obligation, not accepted debt.

### Accepted debt

None. Critical or Major accessibility debt cannot be deferred. Any future Minor/Note debt must name location, affected users, rationale, suggested fix, owner/exit condition, status, and explicit acknowledgement where accessibility is involved.

Source: `pitwall/CHECKLIST.md:188-219`, PRD §§6.3, 11.2, 12, and plan Tasks 2 and 5.
