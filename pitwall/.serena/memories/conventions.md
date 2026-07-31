# PITWALL conventions
- SVG nodes are created with `document.createElementNS`; dynamic positions use CSS `style.transform`, not SVG `transform` attributes.
- Track text labels are forbidden. Detailed identity is shown in camera/feed cards, not on the track.
- Class encoding must remain redundant: H triangle + red, P circle + blue, GT square + yellow. Never replace shape with color alone.
- Centralize visual tokens in `src/config/theme.ts`; avoid renderer hardcoded colors.
- Pools are reused and render methods avoid unnecessary DOM writes. Tests assert node budgets and no text in track SVG.
- Readability is ambient: improve contrast without glare, keep secondary surfaces quieter, preserve privacy and zero-dependency single-file operation.