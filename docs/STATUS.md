# Status: where the code is today

Working app, built and type-checked (`npm run build` passes). Parser verified on the real backup: `npm run verify` → ALL SECTIONS PASS (19 sections, 15,883 transactions).

## What exists
- `src/lib/types.ts`: data contract (ParseResult, Settings, Analysis).
- `src/lib/parse.ts`, `analyze.ts`, `classify.ts`, `time.ts`: pure TS parser/analysis (runs in Node, the browser, or a worker).
- `src/lib/worker.ts`, `loadBackup.ts`, `validate.ts`: file → Web Worker parse, with a main-thread fallback and friendly errors.
- `src/profile.ts`: personal defaults (excluded people, venue patterns, till merges). **Ships in the public bundle.**
- `src/state.tsx`: parsed data in memory only; settings in localStorage (`mpesa.settings.v1`).
- `src/pages/*`: Upload, Overview, Flags, People, Payees, Bars, Loans, Settings. `src/components/*`: DataTable (sort/search/CSV), charts, UI bits.
- `scripts/verify.ts`: golden test against `reference/expected/*.json` (git-ignored, local only).

## Done since the first import
- Tooling: ESLint (including hooks, a11y and a no-browser-globals rule for `src/lib`), Prettier, Vitest, and the `lint` / `typecheck` / `test` scripts.
- Unit tests for the parser (one synthetic SMS per rule, dedupe, Nairobi time) and for analysis, classification and settings.
- CI (GitHub Actions) and `vercel.json` with the strict CSP and security headers.
- Route-level code splitting: entry chunk 631 kB down to 205 kB, with a hard 500 kB per-chunk budget enforced in `npm run build`.
- Accessibility and 400 px audit fixes.
- Release checklist and README refresh (`docs/RELEASE.md`).

## Not done yet
1. **Move `src/profile.ts` defaults into Settings** (TASK-5). **Blocked:** its PR changes `classify.ts` and `analyze.ts`, which need `npm run verify` to pass, and that cannot run without the local golden data. Until it lands, personal defaults still compile into the bundle, so deployments must stay behind Vercel authentication (see `docs/RELEASE.md`).
2. **M-PESA sender filter** (TASK-8). **Blocked** for the same reason: it can move verified numbers and needs a before/after `npm run verify`.
3. Optional Playwright end-to-end check of the Settings flows (TASK-10).
4. A human browser pass: CSP on a real deployment, lazy routes, and the 400 px / keyboard / screen-reader checks (TASK-16). No agent has a browser.

Other open follow-ups are listed in `docs/TASKS.md`.
