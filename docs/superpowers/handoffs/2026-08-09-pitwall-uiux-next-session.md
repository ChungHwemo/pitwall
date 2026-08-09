# PITWALL UI/UX next session handoff

Date: 2026-08-09
Repository: PITWALL
Branch: `main`, based on `origin/main`

## Start here

This handoff supersedes the stale root `HANDOFF.md` for the next session. Read this file first, then inspect the current worktree before touching product code.

The worktree contains a large uncommitted PITWALL change set. Preserve it. Do not reset, stash, clean, discard, commit, or push until the parent session has reviewed the intended file set. The parent session must include this Markdown file in the repository commit.

## What was implemented

The five UI/UX improvements are complete in the current worktree:

1. LIVE and STALE status keeps the complete literal state and stale age visible. The root cause was `.live-status { flex-shrink: 1 }` combined with inherited hidden overflow, ellipsis, and no wrapping. Other HUD items did not shrink, so the browser compressed the required status fact alone.
2. The default track uses the existing legacy renderer with one main centerline and the existing thin inner pit lane. Stale or no data cars move slowly and deterministically on the main track. `error` and `limit` cars stop in pit boxes.
3. Broadcast focus is a separate DOM overlay using the existing director boundary. Manual focus wins, automatic selection retains its severity, freshness, dwell, and preemption rules, and raw identifiers remain outside the UI.
4. Dense tower and feed cards preserve three digit car numbers, state, danger reason, limit state, and required numeric values. Secondary long CJK or model text yields before those facts.
5. Settings and legend are independent, closed by default, keyboard accessible overlays. Neither control is rendered inside the other, and both fit the viewport at responsive widths.

## Corrections that are now binding

The following are exact product corrections. Do not reinterpret them:

* The thin inner line is the existing pit lane, never a second full track.
* Stale or no data moves slowly on the main track.
* Error and limit stop in the pit.
* `로컬카탄` was an invalid persisted label and must never display.

An earlier implementation moved limit and error cars slowly inside the pit. That interpretation was explicitly reversed. The final contract keeps those cars stationary in the pit and assigns slow idle motion only to stale or no data cars on the main track.

## Browser blockers already fixed

### Required tower facts clipped on mobile

The responsive dense tower layout allowed required facts to clip at mobile width. The fix gives priority to car number, state, danger reason, and required values, while secondary model and explanatory text yields. The 375 CSS pixel check passed without horizontal overflow.

### `pitwall.settings.json` returned 404

The browser requested the settings file from the served public path, but it was missing. The public settings file is now present and returned HTTP 200. The application still has safe built in defaults for missing or invalid configuration.

## Fresh verification

The final verification evidence for this work is:

* 933 Vitest tests passed.
* TypeScript type checking passed with zero errors.
* `cd pitwall && npm run build:single` passed.
* Browser checks passed at 375, 1280, and 1800 CSS pixels.
* The SVG showed one centerline and one pit lane, not a duplicate full circuit.
* No horizontal overflow was observed.
* `pitwall.settings.json` returned HTTP 200.
* No post fix browser console errors were observed.

The checks cover status truth, stale motion, stopped pit behavior, focus, dense cards, settings, legend, CJK readability, and the responsive layout. A complete DOM string alone was not accepted as proof of visual correctness. Browser geometry and overflow were checked as well.

## Native LIVE is separate

Do not claim native LIVE WebView approval. Native bridge startup, continuous LIVE delivery, WebView reload continuity, duplicate replay behavior, and snapshot recovery remain a separate human operated gate. Browser DEMO, replay, and production single file checks do not approve that gate.

## Do not repeat these mistakes

* Do not enable the broadcast WIP renderer by default before proving its geometry. A long pit point list can look like a second full track.
* Do not draw or describe the thin pit lane as another circuit.
* Do not send stale or no data cars to stationary pit boxes.
* Do not add idle creep to error or limit cars. They must stop in the pit.
* Do not let required LIVE age text shrink into an ellipsis.
* Do not use jsdom as proof of visual clipping, glyph width, SVG geometry, or viewport overflow.
* Do not bypass the shared custom name sanitizer in a renderer or persistence path.
* Never display the invalid persisted label `로컬카탄`.
* Check public JSON requests in the browser. A missing file is a 404 blocker even when built in defaults hide the product failure.
* Do not overwrite `HANDOFF.md`; it is retained as historical context.
* Do not include secrets, tokens, raw account identifiers, prompt text, or response text in the next record or commit.

## Next session start checklist

1. Run `git status --short` and inspect the current diff. Preserve unrelated changes.
2. Confirm this handoff and the local wiki record are present and intended for the documentation commit.
3. Read the plan, `REVIEW.md`, the G001 evidence review, and the stale root `HANDOFF.md` only for historical context.
4. Reconfirm the default renderer is legacy and that the SVG has one centerline plus the short pit lane.
5. Reconfirm the stale, error, and limit motion contracts with public renderer tests before changing motion code.
6. Recheck the 375 CSS pixel tower and settings states for required fact clipping and horizontal overflow.
7. Recheck that `pitwall.settings.json` returns HTTP 200 from the served app.
8. Keep native LIVE marked separate and not approved unless a separate human operated gate produces evidence.
9. Stage only the intended repository files. Include this handoff Markdown in the commit. Do not push from this handoff task.

## Source files

* Plan: `docs/superpowers/plans/2026-08-09-pitwall-uiux-improvements.md`
* Review ledger: `REVIEW.md`
* Gate evidence: `.omo/evidence/G001-review-md-ui-ux-gate-review.md`
* Historical handoff: `HANDOFF.md`
* Local record: `~/.claude/wiki/projects/pitwall/2026-08-09-pitwall-uiux-work-record.md`
