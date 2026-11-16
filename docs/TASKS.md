# PesaLens — task backlog

Ordered by dependency and risk. **One task = one PR**, conventional commit title, reviewed by Apex
before Harbor merges. Read `docs/ARCHITECTURE.md` §8 (constraints) before starting any task.

Gates every PR must pass: `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build`
(skipping only the scripts that do not exist yet). Any PR touching `src/lib/parse.ts`,
`analyze.ts`, `classify.ts` or `time.ts` additionally needs a local `npm run verify` →
**ALL SECTIONS PASS** before approval.

Privacy rule for all tasks: **synthetic data only**. No real name, phone number, amount, till name or
transaction code may appear in code, tests, fixtures, commit messages or PR descriptions.

---

- [x] ## TASK-1 — Tooling foundation: ESLint, Prettier, Vitest, npm scripts
      **Why first:** every later task is reviewed against gates that do not exist yet, and TASK-2's tests
      have nowhere to run until Vitest and `npm test` exist.

  **Goal.** Add linting, formatting and a test runner, wired into npm scripts, with the existing code
  passing clean.

  **Files.** `package.json`, `eslint.config.js` (flat config), `.prettierrc`, `.prettierignore`,
  `vitest.config.ts` (or a `test` block in `vite.config.ts`), `.gitignore` (ensure `coverage/`),
  one smoke test e.g. `src/lib/time.test.ts`.

  **Acceptance criteria.**
  - `npm run lint` exits 0 on a clean checkout (no `--fix` needed, no blanket `eslint-disable` files).
  - `npm run lint -- --max-warnings=0` also exits 0.
  - `npm test -- --run` exits 0 and runs at least one real assertion (a Nairobi `isoMinute` case is a
    good smoke test).
  - `npm run typecheck` and `npm run build` still exit 0.
  - `npx prettier --check .` exits 0.
  - ESLint config includes `@typescript-eslint`, `react-hooks` and `react-refresh` rules, and a rule
    or override that keeps `src/lib/{parse,analyze,classify,time}.ts` free of browser globals
    (e.g. `no-restricted-globals` for `window`, `document`, `localStorage`, `fetch`).
  - All additions are `devDependencies`; **zero** new runtime dependencies.

  **Out of scope.** Writing the parser test suite (TASK-2), CI workflow (TASK-4), reformatting
  unrelated files beyond what Prettier does mechanically, changing any app behaviour.

- [x] ## TASK-2 — Parser unit tests from synthetic SMS fixtures
      **Goal.** Lock in `parseBackup()` behaviour with one synthetic message per rule plus dedupe and
      timezone coverage, so future parser edits are safe.

  **Files.** `src/lib/parse.test.ts`, `src/lib/time.test.ts`, `src/lib/fixtures.ts` (or
  `src/lib/__fixtures__/messages.ts`) holding the synthetic bodies.

  **Acceptance criteria.**
  - One test per rule in SPEC §Parsing rules (all 17 rows, including both `recv_person` and
    `recv_business` outcomes, both Fuliza-repay wordings, both reversal wordings, and the
    `Congratulations! ` prefix variant), asserting `cat`, `amount`, and the extracted
    `name`/`phone`/`account`/`cost`/`balance`/`fee`/`orig` where the rule produces them.
  - Order-sensitivity tests: a paybill message is not captured by `send_person` or `send_pochi`; a
    person send with a phone is not captured by `send_pochi`.
  - Dedupe tests: the same message twice yields one `Txn`; a payment and the Fuliza draw that funded
    it share a code but yield two `Txn`s (different rules).
  - Timezone tests: an epoch ms value near a UTC day boundary produces the correct Nairobi `iso`
    (UTC+3, no DST, seconds floored); `parts()` weekday is Mon=0; `monthRange()` spans a year
    boundary correctly.
  - Counter tests: insufficient funds / wrong PIN / PIN locked / KCB loan request (deduped by the
    first 10 characters) each counted from synthetic bodies.
  - `npm test -- --run` passes; every fixture is invented (reviewer will check names/codes/amounts).

  **Out of scope.** Testing `analyze.ts` (TASK-3), changing any parser regex or behaviour — if a test
  reveals a genuine bug, note it in the PR and open a follow-up task rather than fixing it here.

- [x] ## TASK-3 — Analysis, classification and settings unit tests
      **Goal.** Cover the layer between the parser and the UI with a small synthetic backup, so Settings
      and flag logic can be changed in TASK-5 with confidence.

  **Files.** `src/lib/analyze.test.ts`, `src/lib/classify.test.ts`, shared synthetic builder in the
  fixtures module from TASK-2.

  **Acceptance criteria.**
  - `classifyPayee()` tests covering: bar keywords, `MILK BAR` → food not bar, `LOUNGE` vs
    `KINYOZI`, butchery before food, the `NOT_FB` exclusions (SUPERMARKET, SACCO, BANK,
    KITCHENWARE, TYRES), and an `extraBars` override winning over exclusion.
  - `payeeName`/`personKey` normalisation tests (whitespace collapse, trailing dots, upper-casing).
  - `analyze()` tests on a hand-built synthetic `ParseResult` asserting: money-in/money-out category
    membership per SPEC §Definitions (Fuliza draws are **not** money in), `monthly` covering every
    month from first to last transaction, the people merge of `send_person` + `send_pochi` +
    `recv_person` with correct `net`, and the "night of week" rule (a 02:00 payment counts to the
    previous evening).
  - Settings tests: an excluded person is absent from `drains.people` and from the oneway /
    borrow_give / frequent flags, but still present in `analysis.people`.
  - `npm test -- --run` passes; `npm run verify` locally still ALL SECTIONS PASS (no behaviour change
    expected — these are characterisation tests).

  **Out of scope.** Snapshotting whole `Analysis` objects (brittle), testing React components,
  changing flag wording or thresholds.

- [ ] ## TASK-4 — CI workflow and `vercel.json` security headers _(Harbor)_
      **Goal.** Run the gates on every PR and lock the deployed app down with a strict CSP that makes
      "no network calls" enforceable rather than aspirational.

  **Files.** `.github/workflows/ci.yml`, `vercel.json`, `README.md` (badge/notes).

  **Acceptance criteria.**
  - CI runs on `pull_request` and on pushes to `main`: `npm ci`, `npm run lint`, `npm run typecheck`,
    `npm test -- --run`, `npm run build`, on Node 20, with npm cache enabled.
  - CI never references `backups/`, `reference/`, `npm run verify` or any secret.
  - `vercel.json` sets, for all routes: `Content-Security-Policy` with `default-src 'self'`,
    `connect-src 'none'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`,
    `script-src 'self'`, `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`,
    `frame-ancestors 'none'`; plus `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: no-referrer`, `Permissions-Policy` disabling camera/microphone/geolocation.
  - Verified manually: `npm run build && npm run preview`, load a synthetic backup, upload + all
    seven tabs render with **zero** CSP violations and zero network requests beyond the app's own
    assets in the Network tab (screenshot or console output in the PR body).
  - A CI failure visibly blocks the PR.

  **Out of scope.** Branch-protection settings in GitHub's UI, deploy automation beyond Vercel's
  default git integration, Lighthouse/bundle-size CI checks (TASK-6 sets the budget locally).

- [ ] ## TASK-5 — Move `src/profile.ts` defaults into Settings and empty the profile
      **Goal.** Remove the privacy risk that personal defaults ship in the public bundle, and make venue
      merges and extra bar/food patterns editable in the UI. Highest-value user-visible change; depends on
      TASK-3's tests because it touches `classify.ts` and `analyze.ts`.

  **Files.** `src/profile.ts`, `src/lib/types.ts`, `src/lib/classify.ts`, `src/lib/analyze.ts`,
  `src/pages/Settings.tsx`, `src/components/Picker.tsx`, `src/state.tsx`, `scripts/verify.ts`,
  `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - `Settings` gains `extraFood: string[]` (payees forced to Restaurants/food) and
    `venueMerges: { match: string; name: string }[]` (plain strings, matched case-insensitively by
    prefix or exact name — **no user-supplied RegExp**, to avoid catastrophic backtracking).
  - `classifyPayee()` and `venueName()` take the relevant settings as arguments; `classify.ts` no
    longer imports `../profile`. `grep -r "from '../profile'" src/` returns nothing outside
    `types.ts` (or nothing at all).
  - `src/profile.ts` is emptied: no real name, no venue pattern, no merge — either an empty-default
    object with a comment, or deleted with `DEFAULT_SETTINGS` becoming all-empty arrays.
  - `grep -ri` for the previously hard-coded name/venues over `src/` returns nothing.
  - localStorage key bumped to `mpesa.settings.v2` with a migration that preserves a v1
    `excludedPeople`/`extraBars`; a user with v1 data loses nothing (test this).
  - Settings page gains sections for extra food venues and venue merges, each add/remove re-running
    the analysis immediately, usable at 400 px, keyboard-accessible, with visible focus.
  - `npm run verify` still ALL SECTIONS PASS locally when the previous profile values are supplied as
    settings — `scripts/verify.ts` reads them from a git-ignored local file
    (e.g. `reference/settings.json`, falling back to empty defaults) rather than from `src/`. Document
    this in `docs/PARSER_NOTES.md`.
  - Unit tests cover the v1→v2 migration and settings-driven classification.

  **Out of scope.** Import/export of settings as a file, multi-profile support, renaming any field in
  `Analysis`.

- [ ] ## TASK-6 — Route-level code splitting to get the entry chunk under 500 kB
      **Goal.** Stop shipping Recharts to the Upload screen; cut first load for a user who has not yet
      dropped a file.

  **Files.** `src/App.tsx`, `src/pages/*` (default exports stay), `vite.config.ts`
  (`build.chunkSizeWarningLimit` / `manualChunks` only if justified).

  **Acceptance criteria.**
  - Every page except `Upload` is loaded with `React.lazy` + a `<Suspense>` fallback that matches the
    light theme and does not shift the sticky header/tab bar.
  - After `npm run build`, the largest entry chunk is **under 500 kB** uncompressed and Vite emits no
    chunk-size warning; the PR body quotes the before/after `dist/assets` sizes.
  - Tab switching shows no visible flash of empty layout on a throttled "Fast 3G" profile; charts
    still render and tooltips still show exact values.
  - No new runtime dependency; `npm run build`, `typecheck`, `lint`, `test` all pass.

  **Out of scope.** Replacing or tree-shaking Recharts itself, prefetching strategies, service
  workers, any visual redesign.

- [ ] ## TASK-7 — Accessibility and 400 px mobile audit
      **Goal.** Make every page genuinely usable at 400 px and with a keyboard/screen reader; fix what the
      audit finds.

  **Files.** `src/components/{DataTable,Picker,ui,chart}.tsx`, `src/pages/*`, `src/App.tsx`.

  **Acceptance criteria.**
  - At a 400 × 800 viewport: no horizontal page scroll on any tab (tables and the tab bar may scroll
    inside their own container), no clipped KPI tiles, no text under 12 px.
  - Every interactive element is reachable by Tab with a visible focus ring; the Upload drop zone,
    Picker and DataTable sort headers are operable by keyboard alone with correct roles
    (`aria-sort` on sortable headers, `aria-busy` while parsing, labelled search inputs).
  - Charts have text alternatives: each chart section has a heading and the same data is reachable in
    a table or summary sentence.
  - Red-flag severity is conveyed by text as well as colour; red text on white meets WCAG AA contrast
    (≥ 4.5:1) — state the measured ratio for `COLORS.red` in the PR body and adjust the token if it
    fails.
  - The PR body lists the issues found and which were fixed; anything deferred becomes a follow-up.

  **Out of scope.** Dark mode, i18n, redesigning charts, adding an a11y testing dependency beyond a
  dev-only `eslint-plugin-jsx-a11y` (acceptable as a devDependency).

- [ ] ## TASK-8 — Restrict parsing to M-PESA senders and tighten counters
      **Goal.** Bring the parser in line with SPEC §Input file, which says to use only messages whose
      `adress` is `MPESA` or `M-PESA`; today every message in `listSms` is scanned, which can over-count
      the failure counters. Deliberately late: it is the only task that can move verified numbers.

  **Files.** `src/lib/parse.ts`, `src/lib/parse.test.ts`, `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - Messages whose `adress` is not `MPESA`/`M-PESA` (case-insensitive, whitespace-trimmed, hyphen
    optional) are skipped for both transaction rules and counters; `counters.totalSms` is documented
    as either "all messages in the file" or "M-PESA messages only" — pick one and say which in
    `types.ts`.
  - Tests: a synthetic non-M-PESA message containing "wrong PIN" and a transaction-shaped body is
    ignored; an `M-PESA` spelling and a lower-case `mpesa` are both accepted.
  - `npm run verify` run locally **before and after**; the PR body reports any changed section. If a
    number moves, it must be explained and recorded in `docs/PARSER_NOTES.md` (and the golden
    reference is only updated deliberately, with Apex's sign-off).
  - If verify shows no change, say so explicitly in the PR body.

  **Out of scope.** Any other parser rule change, adding new transaction categories, changing dedupe.

- [ ] ## TASK-9 — Release checklist and README refresh
      **Goal.** Make the deploy decision mechanical, and document the local golden-test workflow for a
      future reader.

  **Files.** `README.md`, `docs/STATUS.md`, `docs/RELEASE.md` (new, short).

  **Acceptance criteria.**
  - `README.md` documents: install/dev/build, the full script list with what each gate proves, the
    privacy posture in three bullets, and how to set up the optional local golden test without ever
    committing data.
  - `docs/RELEASE.md` lists the pre-merge checklist (gates green, verify green for parser changes,
    preview checked at 400 px, no personal data in the diff) and which changes require
    `DEPLOY: YES` in `.claude/handoff/review.md`.
  - `docs/STATUS.md` "Not done yet" list is updated to reflect completed tasks.
  - Docs-only PR: no source file changes.

  **Out of scope.** CHANGELOG automation, versioning/tagging scheme, screenshots containing real data
  (never).

- [ ] ## TASK-10 _(optional)_ — Playwright end-to-end check of the Settings flows
      **Goal.** One smoke journey against a synthetic backup: upload → Overview renders → exclude a
      person in Settings → that person disappears from the drains list → reload keeps the setting.

  **Files.** `e2e/settings.spec.ts`, `playwright.config.ts`, `e2e/fixtures/synthetic.sms`,
  `package.json`, `.github/workflows/ci.yml`.

  **Acceptance criteria.**
  - `npm run e2e` runs headless against `npm run preview` and passes locally.
  - The fixture backup is fully synthetic (~50 invented messages) and small enough to read in review.
  - Playwright and its browsers are devDependencies and are either skipped or cached in CI so the PR
    gate does not get materially slower (state the added CI time in the PR body).
  - The test asserts the privacy note is visible on Upload and that no network request leaves the
    origin during the journey.

  **Out of scope.** Visual-regression snapshots, cross-browser matrices, testing chart internals.
