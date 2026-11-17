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
  - While in the fixtures module, close the four small `parse.ts` coverage gaps left by TASK-2
    (PR #2 review): a `recv_business` sender with **no** trailing digits (e.g. `Hustler Fund`,
    SPEC rule 5); a bare `254…` phone in `send_person` (SPEC rule 2 allows `+?254`); a one-decimal
    amount (`Ksh50.5`) and a Fuliza amount with a trailing dot, proving `num()`; a negative
    `New M-PESA balance is Ksh-20.00` → `balance === -20`.

  **Out of scope.** Snapshotting whole `Analysis` objects (brittle), testing React components,
  changing flag wording or thresholds.

- [x] ## TASK-4 — CI workflow and `vercel.json` security headers _(Harbor)_
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

- [x] ## TASK-5 — Move `src/profile.ts` defaults into Settings and empty the profile
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

- [x] ## TASK-6 — Route-level code splitting to get the entry chunk under 500 kB
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

- [x] ## TASK-7 — Accessibility and 400 px mobile audit
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

- [x] ## TASK-8 — Restrict parsing to M-PESA senders and tighten counters
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
  - The default `adress` in `src/lib/__fixtures__/messages.ts` becomes `'MPESA'` (it is currently
    `'TESTSENDER'`, which this filter would reject and which would break every TASK-2 test), with a
    separate fixture helper for a non-M-PESA sender.

  **Out of scope.** Any other parser rule change, adding new transaction categories, changing dedupe.

- [x] ## TASK-9 — Release checklist and README refresh
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

- [x] ## TASK-10 _(optional)_ — Playwright end-to-end check of the Settings flows
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

  **Done (Forge).** `npm run e2e` = `npm run build && playwright test`; the preview server is started
  and stopped by Playwright's `webServer`. Locally on macOS 13 (which Playwright 1.65 no longer ships
  Chromium for) run `PW_CHANNEL=chrome npm run e2e` to use installed Google Chrome; CI uses Playwright's
  Chromium. CI runs it as a separate, non-required job `e2e (playwright)`; the required job name is
  untouched. The privacy test is proven non-vacuous: a temporary `fetch('https://example.com/...')` in
  `main.tsx` turned the journey and route tests red, and removing it turned them green.
  **Known failure the E2E found:** see TASK-26 (`test.fail()` in the 400 px test).

- [x] ## TASK-11 — Repay the TASK-1 lint debt and untrack `tsconfig.tsbuildinfo`
      **Why:** TASK-1 shipped three scoped escape hatches and left a build artifact in git. Each is
      small and safe on its own; grouped here so they do not quietly become permanent.

  **Files.** `.gitignore`, `src/state.tsx`, `src/pages/Bars.tsx`, `eslint.config.js`,
  `src/components/{DataTable,chart,ui}.tsx`.

  **Acceptance criteria.**
  - `tsconfig.tsbuildinfo` is added to `.gitignore` and removed from the index with
    `git rm --cached tsconfig.tsbuildinfo`. A clean `npm run build` then leaves `git status` clean.
  - `src/state.tsx` no longer needs the `react-hooks/set-state-in-effect` disable: the
    `analysisError → loadError` mirror is derived during render (or merged into one error selector)
    instead of being written back from a `useEffect`. The user-visible error text is unchanged.
  - `src/pages/Bars.tsx` drops the `@typescript-eslint/no-explicit-any` disable by typing the
    Recharts `tickFormatter` parameter as `string | number` (Recharts' own tick type) rather than `any`.
  - At least two of `src/components/{DataTable,chart,ui}.tsx` are removed from the
    `react-refresh/only-export-components` override by moving their non-component exports into a
    sibling module; the override list shrinks accordingly. `state.tsx` may keep the override
    (context + provider genuinely belong together) — say so in the config comment.
  - `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test -- --run` and `npm run build`
    all exit 0. `grep -rn "eslint-disable" src/` returns only disables that remain justified in a comment.
  - No behaviour change: no parser/analysis file is touched, so `npm run verify` is not required.

  **Out of scope.** Broadening the lint rule set, adding new plugins, refactoring component APIs,
  touching `src/lib/*`.

- [x] ## TASK-12 — Dedupe by category (not rule name) and settle the unreachable `recv_alt` rule
      **Why:** found while reviewing PR #2. SPEC §Parsing rules says "de-duplicate by (category, code)",
      but `parse.ts` keys `seen` on the **rule** name: `fuliza_repay2` keys separately from
      `fuliza_repay`, and `recv` separately from `recv_alt`. Verified locally: the old and new
      Fuliza-repayment wordings of the *same* code produce two `Txn`s where SPEC wants one, which
      double-counts money out. Separately, `recv_alt`'s regex is a strict subset of `recv`'s
      (`recv` allows `Confirmed\.? ?` and an optional `at`), so `recv_alt` never fires and cannot be
      tested — it is dead code kept only for Python parity.

  **Files.** `src/lib/parse.ts`, `src/lib/parse.test.ts`, `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - The dedupe key uses the final `cat` (`fuliza_repay2` → `fuliza_repay`, `recv`/`recv_alt` →
    `recv_person`/`recv_business`), not the rule name. Resolve the ordering problem this creates
    (the category is only known after the field extraction) explicitly in a comment.
  - Test: the old and the new Fuliza-repayment wording with the same code yield **one** `Txn`.
  - Test: a payment and its Fuliza draw sharing a code still yield two `Txn`s (no regression).
  - `recv_alt` is either deleted with a note in `docs/PARSER_NOTES.md`, or kept with a comment
    stating which real wording reaches it and a test proving it does.
  - `npm run verify` run locally **before and after**; report any moved number in the PR body. If a
    number changes, it is explained in `docs/PARSER_NOTES.md` and the golden reference is only
    updated with Apex's sign-off.

  **Out of scope.** Any other rule change, new categories, the sender filter (TASK-8).

  **Correction (2026-11-17, TASK-13).** The title's "unreachable" and the Why paragraph's strict-subset claim are wrong. Neither regex is a subset of the other: `recv_alt` is stricter at the head and looser at the tail. It is reachable in principle. Measured occurrences in the owner's backup are zero. The original text above is unchanged.

- [x] ## TASK-13 — Parser robustness: case-insensitive transaction cost, counters only from unmatched messages
      **Why:** found while reviewing PR #2. (a) `COST` is the only regex in `parse.ts` built without
      the `i` flag, so a body spelling it `Transaction Cost,` silently yields `cost: 0` — verified
      locally. (b) SPEC says counters come "from unmatched messages", but they run on the raw body
      **before** rule matching, so one message can both parse as a transaction and increment
      `insufficientFunds`/`wrongPin` — also verified locally.

  **Files.** `src/lib/parse.ts`, `src/lib/parse.test.ts`, `docs/SPEC.md` or `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - `COST` is case-insensitive, with a test asserting `Transaction Cost, Ksh29.00` parses to `29`.
  - Counters are either moved after rule matching (incremented only when no rule matched) **or**
    SPEC is amended to describe the current behaviour — pick one, say why in the PR body, and make
    the code and SPEC agree.
  - Tests cover the chosen behaviour for a body that both parses as a transaction and contains a
    counter keyword.
  - `npm run verify` run locally **before and after**; both changes can move verified numbers, so the
    PR body must report every section that changes and `docs/PARSER_NOTES.md` must explain it.

  **Out of scope.** Rewriting the rule table, the sender filter (TASK-8), dedupe (TASK-12).

- [x] ## TASK-14 — `MILK BAR` must classify as food, not a bar
      **Why:** found while reviewing PR #3 (TASK-3). `docs/SPEC.md` §Definitions says bars match
      `\bBAR\b` **(not "MILK BAR")** and lists `MILK BAR` under restaurants & food, but the
      implementation in `src/lib/classify.ts` is
      `const BAR = /\bBAR\b(?!.*MILK)|LOUNGE(?!.*KINYOZI)|…/` — the negative lookahead only scans for
      MILK *after* "BAR", so "SAMPLE MILK BAR" matches the bar branch and never reaches `FOOD`.
      Forge could not assert the TASK-3 criterion "`MILK BAR` → food not bar" without changing source,
      correctly left it out with a comment in `src/lib/classify.test.ts`, and raised it here instead.

  **Files.** `src/lib/classify.ts`, `src/lib/classify.test.ts`, possibly `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - **Done.** The BAR keyword is tested on the name with `MILK BAR` reduced to `MILK` (lookbehind-free,
    ES5-safe), alongside the existing lookahead, so MILK on either side of BAR rejects that keyword only;
    other bar words (`WINES`, ...) still match. `npm run verify` moves by design and the approved delta is
    allow-listed: see `docs/PARSER_NOTES.md` "MILK BAR classification".
  - `classifyPayee('SAMPLE MILK BAR')` returns `'Restaurants, hotels & food'`; `classifyPayee('SAMPLE BAR')`
    still returns `'Bars & lounges'`; the `NOT_FB`, `LOUNGE`/`KINYOZI`, butchery-before-food and
    `extraBars` behaviours are unchanged (existing classify tests stay green untouched).
  - The deliberate omission comment in `src/lib/classify.test.ts` is removed and replaced by the
    asserted case, so the TASK-3 criterion is finally met.
  - **Python reference: not available.** `reference/python/bars.py` does not exist in this checkout
    (`reference/` holds only the generated baseline and `settings.json`), so the criterion below could not be
    performed. Original text:
  - **Check the Python reference first.** `reference/python/bars.py` is the source this file was
    ported from and probably carries the same mis-anchored lookahead, which means the golden data in
    `reference/expected/` may encode the buggy classification. Diff the Python regex before touching
    the TypeScript, and say in the PR body whether Python agrees with SPEC or with the current code.
  - `npm run verify` run locally **before and after** → ALL SECTIONS PASS, or every moved number
    reported in the PR body and explained in `docs/PARSER_NOTES.md`, with the golden reference only
    updated on Apex's sign-off. `npm run verify` is the only thing that catches this drift and it
    cannot run in a checkout without `backups/` and `reference/`, so this task must be done in one
    that has them.
  - Gates green: `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test -- --run`,
    `npm run build`, `npx prettier --check .`.

  **Out of scope.** Any other keyword change, reordering the bar/meat/food precedence, the
  `PROFILE.extraBarPattern` removal (TASK-5).

- [x] ## TASK-15 — Pin the 05:00 night-of-week cut-off with a boundary test
      **Why:** found while reviewing PR #3. SPEC §Definitions says "payments before 05:00 count toward
      the previous evening", implemented as `night: parts(t - 5 * 3600e3)` in `src/lib/analyze.ts`.
      The TASK-3 tests assert 02:00 → previous evening and 05:00 → same day, which only brackets the
      offset to 3–5 hours: mutating the constant to `4 * 3600e3` leaves all 19 analyze tests passing.
      TASK-5 is allowed to touch this area, so the constant should be pinned exactly first.

  **Files.** `src/lib/analyze.test.ts`.

  **Acceptance criteria.**
  - A test asserts a 04:00 (or 04:59) Nairobi bar payment lands on the **previous** calendar date in
    `fb.nights`, alongside the existing 05:00 → same-day case, so 4 h and 6 h offsets both fail.
  - Verified by mutation: changing `5 * 3600e3` to `4 * 3600e3` or `6 * 3600e3` in `analyze.ts` makes
    `npm test -- --run` red; report both runs in the PR body. No source file is modified by the PR.
  - Gates green: `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test -- --run`,
    `npm run build`, `npx prettier --check .`. `npm run verify` not required (tests only).

  **Out of scope.** Changing the cut-off, the `fb.dow` / `fb.hour` tables, or any analyze behaviour.

- [ ] ## TASK-16 — Browser + production verification of the CSP (**human, after first deploy**)
      **Why:** the one TASK-4 acceptance criterion that was not met when PR #4 merged. No agent on this
      team has a browser, and the headers cannot be checked for real before a deployment exists
      (`vite preview` does not apply `vercel.json`), so Apex approved PR #4 with this recorded as a
      required follow-up. Until it is done, the shipped CSP is unproven in a real browser.

  **Files.** None expected. If a violation is found, the fix is a one-line change to the CSP value in
  `vercel.json` plus a note here.

  **Acceptance criteria.**
  - On the first preview deployment, `curl -sI <url>` (authenticated, since the project is behind
    Vercel Authentication) shows all four headers with the exact values in `vercel.json`:
    `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
    `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  - In a real browser on the deployed app: load a **synthetic** backup, confirm the Web Worker
    constructs (parsing does not silently fall back to the main thread — `loadBackup.ts` catches a
    blocked worker, so a CSP problem there would be invisible except as slowness), and render all
    seven tabs.
  - DevTools Console shows **zero** CSP violation reports, and the Network tab shows **zero** requests
    beyond the app's own same-origin `/assets/*`. Include the CSV export from a data table in the
    pass, since it uses a `blob:` object URL via `a[download]`.
  - Check at ~400 px width while you are there; it costs nothing and covers the mobile
    non-negotiable.
  - **Lazy routes under the CSP (added after PR #6, TASK-6).** Since TASK-6 the seven non-Upload
    pages are `React.lazy` chunks fetched on demand. Confirm in the deployed app that every tab
    actually renders (a chunk blocked by `script-src 'self'` would show as a stuck page, not an
    error), that the Network tab shows the `/assets/<Page>-*.js` request succeeding same-origin with
    no CSP violation, and that charts and their tooltips draw once the shared `DataTable` chunk
    (~390 kB, Recharts) has loaded. With the network throttled to Fast 3G, switch tabs and check the
    Suspense fallback: nothing for ~200 ms, then a "Loading…" line, no header/tab-bar movement and no
    footer jump. Repeat one tab switch on a fast connection to confirm the fallback does not flash.
  - **Covered by the TASK-10 E2E (added by Forge; the human pass still owns the rest, this box stays
    unticked).** Headless Chrome against `vite preview` now asserts: all seven routes render and their
    lazy chunks load with no `console.error` / `pageerror`; zero requests leave the origin during the
    journey; the "Rank people by" Segmented control moves checked state and focus with ArrowRight /
    ArrowLeft; and horizontal page overflow at 400 x 800 (this found a real defect, TASK-26). **Not
    covered, and not provable this way:** screen-reader announcements, how colours or patterns look,
    focus-ring visibility, and the production CSP. `vite preview` does not serve `vercel.json`'s
    headers, so "a chunk loaded" says nothing about whether the shipped CSP allows it; items (f)(g)(h)
    and the deployed-header checks remain open.
  - **Accessibility pass at 400 px (added by TASK-7, which had no browser).** The TASK-7 PR reasons
    about layout from the CSS and tests roles in jsdom, but nobody has looked at it. In a real
    browser at 400 x 800 on every tab, with a synthetic backup: confirm no horizontal page scroll
    (tables, the tab bar and the Day x hour heat map may scroll inside their own box), no clipped
    KPI tiles, and no truncated chart category labels on the Y axes (now 12 px, widths 128-140 px).
    Tab through the Upload screen, a data table and Settings: the focus ring is visible everywhere,
    "Choose a file" opens the picker with Enter/Space, sort headers and the Picker work from the
    keyboard, and the "Skip to content" link appears on first Tab. With VoiceOver or NVDA, check that
    a chart is announced with its summary and that "View the data behind this chart" opens a table.
  - **TASK-19 additions to that same pass (code-reasoned, not observed).** (a) In Chrome with
    "Emulate vision deficiency: Achromatopsia" (or a greyscale OS filter), the red "Last 12 m", "Sent
    last 12 m" and negative "Net" cells still read as flagged: each carries a small up or down
    triangle after the value. With a screen reader, those cells announce ", up on prior 12 months" or
    ", net outflow: sent more than received" after the amount (the text is Tailwind `sr-only`, which
    clips rather than hides). (b) The stacked bar charts on Paybills & tills, Loans and Bars
    show a striped second series and a dotted third series, and the Legend swatches carry the same
    patterns; check the patterns render (SVG `url(#id)` fills) and stay legible at 400 px. (c) Tab to
    the "Rank people by" and "Payee type" controls: one tab stop, Left/Right/Up/Down move and select
    with wraparound, and focus stays on the newly selected option; screen readers should announce
    "radio button, 2 of 3". (d) Heading outline (VoiceOver rotor or the browser accessibility tree) on
    each tab has no skipped level. (e) Confirm each chart is a single stop for the accessibility tree
    and that "View the data behind this chart (same numbers; works with a keyboard)" is the discoverable
    keyboard path, since charts are deliberately not focusable.
  - **TASK-23 additions to that same pass (code-reasoned, not observed; recorded by Apex at the PR #16
    review so they are not lost).** (f) Under "Emulate vision deficiency: Achromatopsia" or a
    greyscale filter, the Loans "Fuliza drawn" cells that are red still read as flagged: each carries
    a small filled circle after the amount. The circle is deliberately directionless (the cell states
    that an overdraft was drawn in that month, not that anything rose), so check it reads as a flag
    and not as a bullet or a stray glyph, and that it stays legible at 400 px and at the table's
    0.7em size. (g) With a screen reader, such a cell announces ", overdraft used this month" after
    the amount; confirm the pause and the ordering sound right next to the neighbouring ", up on
    prior 12 months" cells, which use the same `Cue` component. (h) On Paybills & tills, the "By day"
    and "By hour" charts now carry different pattern ids (`pat-<id>-dow-*`, `pat-<id>-hour-*`) after a
    duplicate-id bug; confirm in a real browser that both charts' second series actually show the
    stripe fill, since a broken `url(#id)` reference renders as transparent, not as an error.
  - If any violation appears, record the offending directive here and open a follow-up PR; do not
    loosen the CSP beyond the single directive that is actually required.

  **Also for the repo owner (GitHub UI, no agent can do it).** TASK-4's "a CI failure visibly blocks
  the PR" criterion needs branch protection on `main` with the `lint, typecheck, test, build` check
  marked as a required status check. Until that is set, a red CI run is advisory only.

  **Out of scope.** Adding a reporting endpoint or `report-uri` (that would be a network call),
  automated browser testing (TASK-10 covers that separately), changing any CSP directive
  pre-emptively.

---

## Apex rulings on PR #5 (TASK-5) — recorded 2026-11-16

PR #5 was reviewed and **approved on the code**, but **not merged**: it changes `classify.ts` and
`analyze.ts`, and `npm run verify` cannot run in any agent checkout (`reference/` and `backups/` are
git-ignored and absent). The merge is blocked until the repo owner runs verify with reference data
present. The four semantic questions Forge raised are ruled on below; each one is a difference the
golden data will expose, so settle them *before* interpreting a verify failure as a bug.

- **(a) `extraBars` exact-name vs prefix — prefix matching is the right follow-up, but not yet.**
  Ruled: keep exact-name matching in PR #5. Forge was right not to change it in the same PR. The
  immediate unblock is to list every payee variant by exact name in `reference/settings.json`; that
  reproduces the old regex result for the fb_* and drain_bars sections without a behaviour change.
  Prefix matching then lands as TASK-17 *after* verify has passed once on the exact-name settings,
  so there is a known-good baseline to diff against. Doing it before that would mix two unverified
  changes.
- **(b) `extraFood` substring vs prefix — accepted as a deliberate narrowing.** Prefix (and exact)
  matching is what TASK-5 specified and what the UI promises ("anything starting with it"). Any
  former substring-matched payee must be entered with its full leading text. This is a user-data
  migration, not a code defect; a "contains" mode is explicitly out of scope and should only be
  considered if real payee data proves prefix insufficient.
- **(c) New users start with no excluded person — correct, not a regression.** This is the point of
  TASK-5: no personal value ships in the public bundle. Users with saved v1 data keep their list via
  the v1→v2 migration; everyone else starts empty and can add people in Settings. No action.
- **(d) Removed strings remain in git history and in already-built bundles — repo owner's call.**
  The literals are present in `src/profile.ts` from the initial commit `60b8299` through `7f54529`,
  i.e. in every commit on `main` before PR #5 and in the PR #1–#4 branch history, and (because
  `classify.ts` and `types.ts` imported `PROFILE`) in every bundle built from those commits. That
  includes the deployment recorded in `docs/DEPLOYS.md`: production `<production host>` and
  preview `<preview host>`, both at `7f54529`, plus any Vercel preview built
  from PRs #1–#3. Mitigation already in place: the project has `ssoProtection: all`, so every one of
  those URLs 302s to Vercel SSO unauthenticated and the bundle is not publicly readable today.
  Options, in increasing order of effort: (1) do nothing and keep SSO protection on; (2) delete the
  old Vercel deployments after the PR #5 deployment is READY, so no served artefact carries the
  strings; (3) also rewrite git history (`git filter-repo`) and force-push, which invalidates every
  existing clone and PR reference. Only the repo owner can decide and perform (2) and (3).

  **Resolution (2026-11-17, TASK-35).** PR #5 was merged as commit `b8ef4d5`. The ruling text above is unchanged.

- [x] ## TASK-17 — Make `extraBars` prefix-matching, consistent with `extraFood` and `venueMerges`
      **Goal.** Remove the last asymmetry in settings matching: `extraFood` and `venueMerges` match by
      case-insensitive prefix, `extraBars` still requires an exact upper-cased name, so one venue with
      several till spellings must be listed once per spelling.
      **Baseline:** `npm run verify` passes on TASK-5's code only when `reference/settings.json` lists
      every payee variant by exact name (the PR #5 rulings); partial names there do not match. Do not
      start before that exact-name baseline is confirmed.
      **Measured cost of the current exact matching (TASK-28):** see `docs/PARSER_NOTES.md`
      "Removing the hard-coded extraBarPattern". Until this task lands, one venue with several till
      spellings must be added to `extraBars` once per spelling.

  **Files.** `src/lib/classify.ts`, `src/lib/analyze.ts` (the `extraBars` Set is built there and
  strips a `Paybill|`/`Till / Buy Goods|` key prefix — that normalisation must survive),
  `src/lib/classify.test.ts`, `docs/PARSER_NOTES.md`.

  **Acceptance criteria.**
  - `extraBars` entries match by case-insensitive, whitespace-collapsed prefix, reusing the same
    `startsWithText` helper as `extraFood`/`venueMerges`. Plain strings only — no RegExp.
  - Evaluation order is unchanged: extraBars → `NOT_FB` → bar → meat → food (+`extraFood`).
  - The `type|name` key form is still accepted and still stripped before matching.
  - Tests: an exact name still matches (a name is a prefix of itself); a shorter entry captures its
    longer variants; an unrelated name with the entry in the middle does **not** match; empty and
    whitespace-only entries are inert.
  - `npm run verify` on the **exact-name** `reference/settings.json`: ALL SECTIONS PASS, identical to
    the exact-name baseline (only the TASK-14 approved deltas applying). This is the behaviour-preservation
    proof and it is the one that gates the merge.
  - Shortening an entry in `reference/settings.json` keeps verify passing **only where that entry is a
    genuine leading prefix of the payee name**. See the correction below before writing any other
    shortening experiment.

  **Out of scope.** Substring/"contains" matching, regex support, changing `excludedPeople` matching
  (it keys on `personKey`, deliberately exact).

  **Correction to the original fifth criterion (Apex, PR #22 review).** As first written, this task
  asked for "`verify` re-run after shortening `reference/settings.json` to prefixes: ALL SECTIONS PASS".
  That criterion was **unsatisfiable** for the fragments it had in mind and has been replaced above.
  The owner ran it: with the exact names, verify is ALL SECTIONS PASS on the TASK-17 branch; with the
  entries shortened to the fragments the deleted `PROFILE.extraBarPattern` regex used, 12 sections fail.
  **Mechanism:** the old regex matched a fragment *anywhere* in a payee name; prefix matching only matches
  at the **start**. At least one of those fragments occurs mid-name — a venue whose name begins with an
  unrelated word and carries the keyword later. Under prefix matching that venue is no longer a bar, so it
  leaves the bar drains and the F&B tables, another venue takes its rank slot, and the TASK-14 allow-list
  then correctly reports its cells as *stale* (fail-closed, as designed). None of this is a defect in the
  TASK-17 code, which is behaviour-preserving against exact names. The lesson for future tasks: prefix
  matching fixes the till-spelling-variant case (entries sharing a leading prefix), **not** the
  keyword-in-the-middle case, and a task must not state a proof that assumes otherwise.

  **Ruling: substring/"contains" matching is not coming back.** Prefix is the deliberate end state for
  every plain-text settings match (`extraBars`, `extraFood`, `venueMerges`; `excludedPeople` stays exact).
  Substring is more forgiving but over-captures silently: a short fragment would sweep unrelated payees
  into Bars with no signal in the UI, and silently misclassifying money is worse than typing a venue's full
  leading name. A venue whose distinguishing keyword sits mid-name is listed by its full leading name —
  which is what the reference settings already do, and why verify passes. This supersedes the "only if real
  payee data proves prefix insufficient" wording in ruling (b) above: the data has now been looked at, one
  venue is affected, it remains fully expressible by its full name, and the answer is still no.

- [x] ## TASK-18 — Settings hardening nits from the PR #5 review (low priority)
      **Goal.** Three small, non-blocking issues Apex noted while reviewing PR #5. One PR, no
      behaviour change to the classifier.

  **Files.** `src/lib/types.ts`, `src/lib/settings.ts`, `src/pages/Settings.tsx`.

  **Acceptance criteria.**
  - `DEFAULT_SETTINGS` is deep-frozen (or `loadSettingsFrom` returns a fresh copy) so the shared
    module-level object can never be mutated by a future caller; a test asserts a mutation attempt
    does not alter it.
  - A corrupt **v2** value currently throws, falls back to empty defaults and never consults v1, and
    the junk is left in storage so every load re-parses it. Fall back to the v1 migration when v2 is
    unparseable, and overwrite the corrupt key with the result. Test both.
  - The "Reset to defaults" button now clears everything (defaults are empty); relabel it to
    "Clear all settings" so it no longer implies built-in values exist. Duplicate `venueMerges`
    rows are also accepted silently — ignore an add that duplicates an existing `match`+`name`.

  **Out of scope.** Import/export of settings, multi-profile support, any change to matching
  semantics (TASK-17 owns that).

  **Status: unblocked (TASK-5 landed).** `src/lib/settings.ts`, `loadSettingsFrom`, the v2 storage key
  and empty `DEFAULT_SETTINGS` now exist on `main`, so this task can be built against them.

---

## Apex ruling on PR #6 (TASK-6) — recorded 2026-11-16

The 500 kB budget is **enforced**, not advisory: the inline `chunk-budget` plugin in `vite.config.ts`
runs in `generateBundle` (after minification, so it measures the emitted bytes) and calls
`this.error`, which exits the build non-zero. Re-verified by temporarily setting the budget to 300 —
the build failed on the `DataTable` chunk with exit code 1 — then restored to 500. CI runs
`npm run build`, so a regression past 500 kB now breaks the PR.

The shared `DataTable` chunk (390.58 kB / 108.27 kB gzip, Recharts) is **accepted as-is**: it is
under budget, downloaded once on the first data tab and cached for the rest of the session, and the
Upload screen — the only screen a first-time visitor sees — no longer pays for it. No follow-up task
is opened. Revisit only if the chunk approaches the budget or if a measured first-tab delay on a slow
connection comes out of TASK-16; the obvious lever then is to pull Recharts into its own chunk so
`People`/`Payees` (table-only pages that currently pull it transitively through `DataTable`) stop
downloading charting code they do not render.

---

- [x] ## TASK-19 — Accessibility follow-ups deferred from TASK-7
      **Goal.** Close the gaps the TASK-7 audit found but did not fix.

  **Acceptance criteria.**
  - Colour-only cues in tables get a non-colour signal: "Last 12 m" cells that are red because the
    value rose, and negative "Net" cells, gain a text or glyph marker (for example an up arrow with a
    visually hidden "up on prior 12 months").
  - Chart series that are told apart only by fill colour (stacked bars) get a second cue: direct
    labels or patterns. The data tables already carry the numbers.
  - Heading order: `ChartCard` titles are `h3` but sit directly under the page `h1` on Overview and
    Loans; give `ChartCard` a `headingLevel` prop or restructure so no level is skipped.
  - Charts are not keyboard-reachable (tooltips are hover/touch only). Either enable Recharts
    `accessibilityLayer` after checking it against the CSP and bundle budget, or document the
    data table as the intended keyboard path.
  - `eslint-plugin-jsx-a11y` 6.10 declares peers up to ESLint 9; `package.json` carries an `overrides`
    entry so it installs next to ESLint 10. Drop the override when the plugin publishes ESLint 10
    support.
  - `Segmented` (added by Apex in the PR #7 review). TASK-7 replaced an unimplemented
    `role="radiogroup"` with a `role="group"` of `aria-pressed` toggle buttons — honest, but
    `aria-pressed` on a single-select group conveys neither mutual exclusivity nor "2 of 3", and
    re-activating the pressed button is a silent no-op. Make it a real radiogroup with roving
    `tabindex` and Left/Right/Up/Down handling, and assert the arrow-key behaviour in
    `a11y.test.tsx`.

  **Outcome (PR for TASK-19).**
  - Keyboard path: `accessibilityLayer` was measured, not guessed. It adds no code (the `DataTable`
    chunk stayed at 391.18 kB / 108.58 kB gzip with it enabled on every chart, so the 500 kB budget does
    not settle it), uses no eval or inline script (CSP-safe), but renders a focusable
    `svg[role=application][tabindex=0]` nested inside the chart's `role="img"` wrapper, i.e. a focusable
    descendant of an element whose children are presentational, and moves the tooltip, which in this
    app is not an ARIA live region, so assistive tech gets nothing from it while keyboard users gain a
    tab stop per chart. Decision: do not enable it; the data table is the keyboard path and the
    "View the data behind this chart" summary now says so in the UI.
    _Apex correction (PR #13 review):_ the nesting and the tab stop reproduce exactly as described, but
    the live-region claim is true only because every chart passes `content={<MoneyTooltip/>}`. Recharts'
    **default** tooltip (`recharts-default-tooltip`) does carry `role="status" aria-live="assertive"`,
    so "the tooltip is not a live region" is a fact about our custom tooltip, not about the library.
    The outcome stands — the table already satisfies WCAG 1.1.1 and the alternative needs a real
    screen-reader pass no agent can run — but the restructure-and-enable path is recorded as TASK-23.
  - `eslint-plugin-jsx-a11y` latest is 6.10.2 with peers `^3 || ... || ^9`; ESLint 10 is still
    unsupported, so the `overrides` entry stays.
  - Patterns were applied to series that share a stack (Loans, Paybills & tills, Bars). Left alone on
    purpose: People (sent and received sit on opposite sides of zero and the legend says left/right),
    Overview (Fuliza is below the zero line and the legend says so; money in/out are separate bars) and
    Flags (grouped bars, not stacked).

  **Out of scope.** Dark mode, i18n, redesigning charts.

- [x] ## TASK-20 — Add `prettier --check` to CI _(Harbor)_
      **Goal.** Close the gap between the five gates the project promises and the four CI enforces.
      `README.md` and `docs/RELEASE.md` list `npx prettier --check .` as a merge gate, but
      `.github/workflows/ci.yml` runs only lint, typecheck, test and build, so a formatting regression
      can reach `main` on a PR nobody ran Prettier on locally.

  **Files.** `.github/workflows/ci.yml`, `README.md` (the "CI ... runs" sentence), `docs/RELEASE.md`
  (if it gains a CI-vs-local note).

  **Acceptance criteria.**
  - `ci.yml` gains a `npm run format:check` step (the script already exists in `package.json`) after
    `npm run lint`, so all five gates run on every PR and every push to `main`.
  - ~~The job name is updated from `lint, typecheck, test, build` to include the format check.~~
    **Dropped by Apex ruling (PR #15, 2026-11-16) — do not reinstate.** `main`'s branch protection
    requires a status check whose context is the exact string `lint, typecheck, test, build`.
    The job name in `.github/workflows/ci.yml` is therefore load-bearing: renaming it means the
    required check can never report again and **every future PR blocks forever** on a check that
    does not exist. The format check lives as a step inside that job instead, which is also what
    the required check needs in order to cover it. If the name must ever change, the
    branch-protection contexts have to be updated to the new name **first**, by the repository
    owner in the GitHub UI, and the workflow renamed only after that.
  - A deliberately misformatted file makes the new step fail with a non-zero exit, confirmed on a
    scratch branch before the PR is opened (do not merge the misformatted commit).
  - `README.md` no longer says CI skips the format check; it states which gates CI runs and that
    `npm run verify` is still local-only, for the reason documented there.
  - No other CI change: Node version, caching, concurrency, permissions and `timeout-minutes` are
    untouched, and CI still never touches `backups/`, `reference/` or `verify`.

  **Out of scope.** Adding `npm run verify` to CI (it needs personal data and must never run there),
  branch-protection settings (a GitHub UI action for the owner), auto-formatting commits or any
  formatter config change.

- [x] ## TASK-21 — Document the git-ignored handoff directory _(Forge)_
      **Why.** `.claude/handoff/` is git-ignored, but `CLAUDE.md` names `.claude/handoff/review.md` as the
      Apex-to-Harbor mechanism, so a fresh clone has a documented flow with no file behind it.

  **Files.** `CLAUDE.md` (one sentence where the handoff is described).

  **Acceptance criteria.**
  - `CLAUDE.md` states that `.claude/handoff/` is local-only, git-ignored and regenerated by Apex at each review.
  - No other `CLAUDE.md` wording changes beyond the user's decision to drop the "Do one task per run" rule.

  **Out of scope.** Committing handoff files, changing `.gitignore`, any source change.

- [x] ## TASK-22 — Propagate the post-auto-deploy `DEPLOY: YES/NO` convention _(Forge)_
      **Why.** Vercel's Git integration auto-deploys `main` on every merge, so `DEPLOY: NO` no longer
      means "no deployment happened" — a docs-only merge still publishes a production build carrying
      `src/profile.ts`. Apex ruled (PR #12) that `DEPLOY` keeps meaning "is this user-visible / worth a
      smoke test", and that the unauthenticated 302 exposure check is a standing rule after **every**
      merge. `.claude/agents/harbor.md` already says this; the other three places still do not.

  **Files.** `.claude/agents/apex.md` (the handoff-format section), `docs/RELEASE.md`
  (the `DEPLOY: YES or NO` section), `docs/TASKS.md` (tick this entry).

  **Acceptance criteria.**
  - `apex.md` and `docs/RELEASE.md` state that `DEPLOY` signals user-visibility / smoke-test need only,
    and that merging always produces a production deployment.
  - Both state the standing rule: Harbor runs the unauthenticated 302 exposure check on the
    auto-created production deployment after every merge, including `DEPLOY: NO` ones.
  - Wording matches `.claude/agents/harbor.md`; no contradictions left between the four files.

  **Out of scope.** Changing the handoff file format or field names, any `src/` change, anything to do
  with TASK-5 or SSO settings themselves.

- [x] ## TASK-23 — Residual colour-only cue on Loans, duplicate pattern ids on Payees _(Forge)_
      **Why.** Recorded by Apex during the PR #13 (TASK-19) review; both were found, neither was in
      TASK-19's acceptance criteria, so TASK-19 merged without them.

  **Files.** `src/pages/Loans.tsx`, `src/pages/Payees.tsx`, `src/components/a11y.test.tsx`.

  **Acceptance criteria.**
  - The "Fuliza drawn" column in the Loans month-by-month table is `text-red-600` whenever
    `r.fuliza > 0` and carries no second cue. Give it a `Cue` in the same style as Flags and People, so
    the flagged cells survive greyscale and are announced. Pick wording that fits the meaning —
    the cell flags "overdraft used this month", not "up on the prior period", so do not reuse
    "up on prior 12 months". The glyph should not imply a direction it does not have.
  - A test asserts the cue appears for `fuliza > 0` and is absent for `fuliza === 0`.
  - `Payees` calls `useId()` once at page level and passes the same `pid` to `patternDefs` in both the
    "By day" and "By hour" charts, so two `<pattern>` elements share one `id` in the document. Both
    defs are identical today, so `url(#id)` still resolves correctly and nothing renders wrong — but
    the duplicate ids are invalid HTML and break the moment the two charts' colours diverge. Give each
    chart its own prefix (e.g. `` `${pid}-dow` `` / `` `${pid}-hour` ``; `patternId` already strips the
    colons `useId` emits).
  - A test asserts that rendering `Payees` produces no duplicate `id` among its `<pattern>` elements.

  **Out of scope.** Re-opening the `accessibilityLayer` decision (that is TASK-24 below), any change
  to the cues TASK-19 already shipped, any new dependency.

  **Follow-up test hardening (done alongside TASK-22; recorded by Apex on PR #16 as non-blocking).**
  - The Loans cue test now asserts the glyph itself (`[aria-hidden="true"]` text is `●` on flagged cells,
    absent otherwise). Proven: with `glyph=""` the suite went 1 failed / 35 passed (was all green);
    restored, 36 passed.
  - The all-pages duplicate-id sweep now has a non-vacuity guard: a total across pages (>= 10; 17 with
    the working `ResizeObserver` stub, 5 with a no-layout one) plus Payees >= 2. A per-page minimum would
    be wrong because Overview, People and Flags render no patterns. Proven: with the no-layout stub the
    sweep fails (5 < 10, Payees 1 < 2); restored, 36 passed.

- [ ] ## TASK-24 _(optional)_ — Re-examine Recharts `accessibilityLayer` with a restructured wrapper
      **Why.** TASK-19 rejected `accessibilityLayer` on measured evidence (Apex reproduced it in PR #13:
      `svg[role=application][tabindex=0]` nests inside the `role="img"` ChartCard wrapper, and our
      custom `MoneyTooltip` has no live region, so a keyboard user gains a tab stop and hears nothing).
      That is a verdict on the current structure, not on the feature. A working version is possible.

  **Acceptance criteria (only if attempted).**
  - The `role="img"` wrapper no longer contains a focusable descendant: either move the chart's
    `aria-label` onto the `<svg>` itself, or drop `role="img"` on charts that opt into the layer.
  - `MoneyTooltip` announces the focused point (`role="status"`, polite), matching the behaviour the
    Recharts default tooltip already has.
  - **Blocked on observation.** Ship only after the TASK-16 browser pass confirms the announcements
    with a real screen reader. jsdom cannot settle this; do not tick it on code reasoning alone.

  **Out of scope.** Enabling the layer without the wrapper change — that is the state TASK-19 rejected.

---

- [x] ## TASK-25 — Remove the stale merge checkpoint from `apex.md` step 6 _(Forge)_
      **Why.** `.claude/agents/apex.md` step 6 still offers
      `"User: check the preview, then say go -> Apex: merge PR #<n>"`. That contradicts the unattended
      loop in section 3 of the same file and CLAUDE.md's "never ask the user to approve a merge or a
      deploy mid-task". The user has ruled "keep looping", so the line is stale.

  **Files.** `.claude/agents/apex.md` only.

  **Acceptance criteria.**
  - The `User: check the preview ... Apex: merge PR #<n>` option is removed from step 6, and nothing
    else in the file offers a mid-task user checkpoint.
  - A grep for `check the preview` across `.claude/` and `docs/` finds no remaining offer of it.
  - Reviewed by Apex on its own, not bundled with other work.

  **Out of scope.** Any other change to the Apex workflow.

---

- [x] ## TASK-26 — Visually hidden cues widen the page at 400 px _(Forge; found by the TASK-10 E2E)_
      **Why.** At 400 x 800 two tabs overflow the page horizontally: `/flags` by +495 px and `/people`
      by +357 px (`/overview`, `/payees`, `/bars`, `/loans`, `/settings` measure 0). The pixel numbers
      are fixture-dependent; the rule is "any tab rendering a `Cue` inside a wide table cell". Cause:
      the `sr-only` cue spans (`Cue`, TASK-19) are `position: absolute` inside `<td>`s whose scroll
      wrapper is `overflow-x: auto` but `position: static`, so they are positioned against an ancestor
      outside it, escape the clip and widen the document. jsdom cannot see this.

  **Fix (done).** Two layers so the trap is closed, not just the two tabs: `Cue` wraps its `sr-only`
  span in its own `relative` span (self-contained, correct in any container), and every scroll
  wrapper (`DataTable`, the chart data table in `ui.tsx`, `Picker`, `Payees`) gets `relative`.
  Measured after: all seven routes 0.

  **Acceptance criteria.**
  - No tab has page-level horizontal overflow at 400 x 800.
  - The `test.fail()` line is deleted from `no horizontal page scroll on any tab at 400x800` in
    `e2e/settings.spec.ts`, the test reports every offending route, and it passes.

  **Out of scope.** Redesigning `Cue`.

- [ ] ## TASK-27 — Make `e2e (playwright)` a required status check _(blocked on the user)_
      **Why.** The cross-origin assertion in the E2E is the only automated test of the README's
      privacy claim ("nothing leaves your browser"). While the job is not required, a PR can merge
      with it red.

  **Blocked on the user.** GitHub repo settings (branch protection required contexts); only the repo
  owner can change them. Agents must not attempt it. Do not rename the existing CI job.

  **Acceptance criteria.** `e2e (playwright)` is listed among required status checks for `main`.

- [x] ## TASK-28 — Record the measured effect of removing `PROFILE.extraBarPattern` _(Forge; docs only)_
      **Why.** Mandated by Apex in the PR #5 review so the mechanism is on record and not re-framed as
      "`extraBars` became stricter" (it did not). Recorded in `docs/PARSER_NOTES.md` and TASK-17.

- [x] ## TASK-29 — Declare an explicit browser target _(Forge)_
      **Why.** Found in the PR #21 review: a regex lookbehind reached `main`-candidate code with nothing
      in the repo saying which engines must run it. No `browserslist`, no `build.target`, no statement in
      ARCHITECTURE.md, so the target is Vite's default `'modules'` (safari14), which this app's own code
      cannot parse. Browser support must be a decision, not an accident.

  **Acceptance criteria.**
  - A `browserslist` in `package.json` and a matching `build.target` in `vite.config.ts`, with the chosen
    floor written down (propose: last 2 years of Chrome/Edge/Firefox and **iOS Safari >= 15.6**).
  - `docs/ARCHITECTURE.md` gains an ADR recording the target and why, plus the rule that syntax newer
    than the floor (lookbehind, `Array.prototype.at`, `??=` in workers, ...) is banned in `src/`.
  - An automated guard, not just prose: ESLint `plugin:compat` (or equivalent) wired into
    `npm run lint -- --max-warnings=0` so a future lookbehind fails the gate instead of shipping green.
  - A test or build-time check that `dist/assets/*.js` contains no `(?<` lookbehind.

  **Done (TASK-29 PR).** See ADR-009. Floor kept at Vite's default (Chrome 87, Edge 88, Firefox 78,
  Safari 14); `scripts/check-dist.ts` runs as `postbuild`.

  **Floor deviation (recorded in review).** The task proposed iOS Safari >= 15.6. The PR deliberately kept
  Vite 5's default floor (Chrome 87 / Edge 88 / Firefox 78 / Safari and iOS 14, ES2020) because raising it
  drops iPhone 6s/7-class devices for no gain, the JS output is byte-identical either way, and lookbehind
  needs Safari 16.4 so 15.6 would not have changed the ban that motivated the task. Apex endorsed the
  lower floor.

- [x] ## TASK-30 — Teach `verify` the approved MILK BAR delta _(Forge)_
      **Why.** TASK-14 intentionally moves 5 of 19 sections and the golden baseline is deliberately not
      regenerated, so without this `npm run verify` could never print ALL SECTIONS PASS again.

  **Done in PR #21.** `scripts/verify.ts` carries a dated allow-list of the approved cells,
  applied only to those exact cells; an allowed cell prints `PASS (approved delta: TASK-14, n cells)`, any
  other mismatch still fails, and an allow-listed cell that no longer differs fails as stale. `npm run
  verify` prints ALL SECTIONS PASS. Provenance in `docs/PARSER_NOTES.md` "Baseline provenance".

- [x] ## TASK-31 — Make `extraBars` prefix matching reachable from Settings _(Forge)_
      **Why.** Found in the PR #22 (TASK-17) review. `extraBars` now matches by case-insensitive,
      whitespace-collapsed prefix, but the "Extra bars" `Picker` in `src/pages/Settings.tsx` has no
      `allowCustom` (unlike "Extra food venues") and its subtitle does not say how matching works. A user
      can therefore only select whole payee names from the list and cannot type the short leading text
      that would capture one venue's several till spellings — so TASK-17's benefit exists in the engine
      but not in the UI. Out of scope for TASK-17, which named only the lib files, its tests and
      `docs/PARSER_NOTES.md`.

  **Files.** `src/pages/Settings.tsx` (plus its tests / the Settings e2e if the copy is asserted there).

  **Acceptance criteria.**
  - The "Extra bars" `Picker` accepts custom text (`allowCustom`), like "Extra food venues".
  - Its subtitle states the matching rule in the same words as the food one: pick one, or type text —
    anything **starting with** it (any capitalisation) counts as a bar; plain text only, no patterns.
  - The copy does not promise substring matching: text that appears only in the middle of a payee name
    does not match, and that venue must be entered by its full leading name (see the TASK-17 ruling).
  - A test covers adding a custom `extraBars` entry and seeing it applied; mobile layout at 400 px is
    unchanged; no new dependency.

  **Out of scope.** Any change to matching semantics, and substring/"contains" matching (ruled out).

- [x] ## TASK-32 — Align the Extra bars / Extra food subtitles with the Venue-merges wording _(Forge)_
      **Why.** Found in the PR #24 review. The Venue-merges subtitle says plainly that a payee matches when
      its **name starts with** the text; the Extra bars and Extra food venues subtitles are less clear, so a
      fragment from the middle of a payee name silently never matches and nothing explains why.

  **Files.** `src/pages/Settings.tsx` (plus any test or e2e that asserts the copy).

  **Acceptance criteria.**
  - Both subtitles use the Venue-merges phrasing: "Any payee whose **name starts with** the text" (any
    capitalisation, plain text, no patterns), and say that a fragment from the middle of a name will not match.
  - No change to matching behaviour, layout at 400 px, or dependencies.

  **Out of scope.** Substring matching (ruled out), any engine change.

- [x] ## TASK-33 — Surface unreachable or redundant Settings rules _(Forge)_
      **Why.** Found in the PR #24 review. Under first-match-wins, a `venueMerges` entry whose `match` prefix
      is preceded by an earlier, shorter prefix of it can never fire, and `extraBars` / `extraFood` can hold
      case-variant duplicates. Both are silent today.

  **Files.** `src/pages/Settings.tsx`, a small pure helper in `src/lib/` and its tests.

  **Acceptance criteria.**
  - Settings flags a `venueMerges` rule that is shadowed by an earlier rule's shorter `match` prefix, naming the rule that shadows it.
  - Settings flags case-variant (and whitespace-variant) duplicates within `extraBars` and within `extraFood`.
  - Informational only: nothing is deleted or reordered automatically and parsing results do not change.
  - The detection helper is pure and unit-tested with synthetic names; no new dependency.

  **Out of scope.** Auto-fixing the rules, changing matching semantics.

---

- [x] ## TASK-34 — Remove stale BLOCKED note from TASK-8; surface the skipped-sender count _(Forge; docs and tooling)_
      **Why.** Filed in the PR #25 review. TASK-8 is ticked but still ended with a "Status: BLOCKED"
      paragraph, and the PARSER_NOTES sender-filter section ended with a sentence that read as if the
      skipped count were unknown.

  **Acceptance criteria.**
  - The stale paragraph is deleted from TASK-8, and every other ticked task was checked for the same.
  - The last sentence of "Sender filter (TASK-8)" in `docs/PARSER_NOTES.md` describes the mechanism
    only, with no figures.
  - `npm run verify` prints the skipped non-M-PESA count on its own line after the headline, and the
    headline format is unchanged.

- [x] ## TASK-36 — Renumber `.claude/agents/apex.md` section 3 and keep one authoritative gate list _(Forge; agent definition)_
  **Why.** Section 3 is numbered 1, 2, 3, 2, 3, 4, 5, 6. The second item "2." restates the pre-merge gate
  re-check with a **weaker list than item 1's**: it omits `prettier --check` and `npm run verify`. A future
  Apex could follow the weaker list and merge a parser change without the verify gate.
  **Acceptance.** Renumber sequentially; collapse to a single gate list (lint `--max-warnings=0`, typecheck,
  test, build, `prettier --check`, and `npm run verify` for parser/analysis changes) that both the review and
  the pre-merge re-check refer to. No other behaviour change.

- [x] ## TASK-37 — Bar backup-derived figures from the diff, commits and PR body _(Forge; docs)_
      **Why.** Found in the PR #28 review: the pre-merge privacy line caught literal personal data but not
      derived aggregates, so a row-count delta against the golden reference passed it and should not have.

  **Done (TASK-29 PR).** `docs/RELEASE.md` privacy line now bars aggregates, counts, tallies and totals
  of any kind from the diff, fixtures, commit messages and PR body; measured figures live only in
  git-ignored `reference/`.

- [x] ## TASK-38 — Close the browser-floor drift test blind spot _(Forge)_
  **Why.** `src/lib/browserTarget.test.ts` only compares `chrome|edge|firefox|safari`, so a lone change to
  `ios_saf >= 14` in `browserslist` would not fail it. esbuild has no iOS target to compare against, and
  `es2020` has no second source either.
  **Acceptance.** Either extend the test to cover `ios_saf` (e.g. assert it equals the Safari floor) and
  the ES level, or document in the test and ADR-009 exactly what the test does not cover.

- [x] ## TASK-39 — Reconcile the declared Safari floor with flex `gap` support _(Forge; product decision for Apex)_
  **Why.** Safari 14.0 does not support `gap` on flex containers (14.1 does), so Tailwind `gap-*`
  utilities degrade to no spacing on 14.0. Pre-existing on `main`, not introduced by TASK-29, but it is a
  gap between what the project now claims to support and what it renders.
  **Acceptance.** Either raise the floor's Safari/iOS minimum to 14.1 (browserslist, `BUILD_TARGET`,
  ADR-009, drift test) or accept and document the 14.0 degradation in ADR-009.

- [x] ## TASK-40 — One shared text normaliser for the engine and the Settings rule checker _(Forge)_
  **Why.** Found in the PR #30 review: `ruleCheck.ts` carried a character-for-character copy of the
  normalisation in `classify.ts`'s `startsWithText`; nothing caught drift, so Settings could flag working
  rules or miss dead ones.
  **Done.** `classify.ts` exports `normText`; `startsWithText` and `ruleCheck.ts` both use it. The Settings
  test now asserts the `role="status"` region exists, empty, before any note is added.
