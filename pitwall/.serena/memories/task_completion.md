# Completion checks
- For source changes: run `npm test`, `npm run build`, and `lsp_diagnostics` on changed files.
- For spec-only changes: verify the requested Markdown file exists, scan required headings/terms and contradictions, and run lsp diagnostics if available for the Markdown file. Do not modify source files.