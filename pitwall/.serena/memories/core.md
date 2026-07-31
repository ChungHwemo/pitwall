# PITWALL source map
- TypeScript/Vite/Vitest SVG-only ambient display in `pitwall/`.
- Render layer: `src/render/trackRenderer.ts`; theme constants: `src/config/theme.ts`; CSS: `src/style.css`.
- Track model: `src/track/generateTrack.ts` (`Track.sectors` is `[0, 1/3, 2/3]`); layout geometry in `src/track/layout.ts`.
- Hard invariants: zero runtime dependencies, SVG inline/no external fetch, Korean UI, color + shape dual encoding for classes, no track text labels, no ranking UI, privacy-first.
- Asset inventory and attribution rules live in `assets/f1/README.md` and `assets/f1/game-icons/SOURCE.txt`.
- Relevant focused memories: `mem:conventions` for rendering and accessibility rules; `mem:task_completion` for verification commands.