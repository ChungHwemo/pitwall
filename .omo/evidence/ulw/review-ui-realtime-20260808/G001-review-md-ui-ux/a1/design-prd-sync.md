# Design contract sync

Scope: `DESIGN.md` and `.omo/frontend-design/state.md` only, plus this report.

Updated the design contract to match the approved broadcast PRD and confirmed H1/H2/H3 diagnoses:

- SVG/DOM full-field radar with one dominant subject card; no WebGL; stable `car_id` identity across pooled-slot reorder and hot/cold membership changes.
- Deterministic Director scoring, tie-break, 5s dwell, and 100-point preemption; truthful sparse, dense, stopped, stale, and no-candidate behavior.
- Elapsed-time `requestAnimationFrame` motion, 160–240ms broadcast cut, reduced-motion equivalence, and H1 refutation/H3 identity boundary.
- 375/768/1280/200% zoom, keyboard, CJK, AA, 800-node, no fabricated progress, and no external runtime-fetch constraints remain explicit.
- Exact legacy rollback comment and session-scoped support/construct/first-render/fatal-render fallback are recorded; reduced motion is not a fallback condition.
- Frozen CC0/MIT mapping points to `pitwall/assets/broadcast/SOURCE.txt`, `LICENSE-CC0.txt`, and `LICENSE-MIT.txt`.

No production or test files were changed.

Correction amended into the same commit: the contract now explicitly permits exactly one new SVG/DOM `BroadcastTrackRenderer`, selected at boot, with the documented session-scoped legacy `TrackRenderer` fallback. Canvas, WebGL, scene engines, runtime packages, and any additional renderer remain prohibited.
