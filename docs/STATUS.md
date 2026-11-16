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

## Not done yet (suggested first tasks for Apex to order)
1. Tooling: ESLint + Prettier, Vitest, `npm run lint` / `npm test` scripts.
2. Unit tests for the parser: one **synthetic** SMS per rule (see docs/SPEC.md table), plus dedupe and timezone tests.
3. CI (GitHub Actions) and `vercel.json` with the strict CSP headers (Harbor's setup).
4. Code-split pages (`React.lazy`) so the bundle drops below 500 kB (it's ~630 kB now, mostly Recharts).
5. Move `src/profile.ts` personal defaults into Settings (venue merges and extra bar/food patterns editable in the UI), then empty profile.ts so nothing personal ships.
6. End-to-end check of the Settings flows in the browser (Playwright, optional).
