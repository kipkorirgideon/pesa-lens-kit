# PesaLens — architecture

This document describes the system **as it is today** (a working, verified app), not a target
rewrite. Product requirements are in `docs/SPEC.md`; parser behaviour notes are in
`docs/PARSER_NOTES.md`; the ordered work backlog is in `docs/TASKS.md`.

Current state: `npm run build` passes, `npm run verify` reports **ALL SECTIONS PASS** (19 sections,
15,883 transactions) against a local, git-ignored golden reference. Any change must keep both true.

---

## 1. Stack

| Concern              | Choice                                | Version (package.json) | Why                                                                                                                 |
| -------------------- | ------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| UI                   | React                                 | ^18.3.1                | Small, familiar, no server runtime needed.                                                                          |
| Language             | TypeScript, `strict: true`            | ^5.9.3                 | The parser/analysis layer is the product; types are the contract.                                                   |
| Bundler / dev server | Vite                                  | ^5.4.21                | Static output, instant HMR, first-class Web Worker support via `new Worker(new URL(...))`.                          |
| Styling              | Tailwind CSS + PostCSS + Autoprefixer | ^3.4.19                | Utility CSS compiled at build time — no runtime CSS-in-JS, no external stylesheet or font fetch.                    |
| Charts               | Recharts                              | ^2.15.4                | Declarative SVG charts; the single heavy dependency (~400 kB of the bundle).                                        |
| Routing              | react-router-dom (HashRouter)         | ^6.30.6                | Hash routing means any static host serves deep links without rewrite rules.                                         |
| Node scripts         | tsx                                   | ^4.23.15               | Runs `scripts/verify.ts` (TypeScript, ESM) directly without a build step.                                           |
| Tests                | Vitest                                | **not installed yet**  | TASK-1. Chosen because it reuses the Vite config/transform pipeline, so parser tests run with zero extra toolchain. |
| Lint/format          | ESLint + Prettier                     | **not installed yet**  | TASK-1.                                                                                                             |

No runtime dependency may be added without a written justification in the PR body. The four runtime
dependencies above (react, react-dom, react-router-dom, recharts) are the whole list and should stay
the whole list.

### ADR log

- **ADR-001: Vite over Next.js.** The app is static and client-only; a server framework would add an
  SSR surface that could accidentally receive user data. Vite builds a plain `dist/`.
- **ADR-002: HashRouter over BrowserRouter.** Avoids host rewrite configuration and keeps the app
  deployable from any static path, including `file://`-adjacent previews.
- **ADR-003: Parsing and analysis are pure TypeScript with no DOM access.** This is what lets the same
  code run in a Web Worker, in the browser main thread as a fallback, and under Node in
  `scripts/verify.ts`. Do not import `window`, `document`, `localStorage` or `fetch` from
  `src/lib/parse.ts`, `analyze.ts`, `classify.ts`, `time.ts`, `format.ts` (format is UI-facing but
  still DOM-free).
- **ADR-004: Recharts kept despite its size.** Replacing it is a larger change than the benefit;
  the bundle problem is solved by route-level code splitting instead (TASK-6).
- **ADR-005: Analysis is derived state recomputed with `useMemo`, not stored.** `analyze()` runs in a
  few hundred ms, so settings changes re-derive everything rather than maintaining caches.
- **ADR-006: The Python original is the oracle.** `scripts/verify.ts` compares 19 sections against
  `reference/expected/*.json` within ±1 KSh. Behavioural parser/analysis changes must be re-verified
  locally; deliberate divergences get an entry in `docs/PARSER_NOTES.md`.
- **ADR-007: Vitest over Jest.** Shares the Vite transform; no separate babel/ts-jest config.
- **ADR-008: Web Worker with a main-thread fallback** rather than worker-only, so an environment
  without `Worker` (or where worker construction throws) still parses, just with a frozen frame.

---

## 2. Folder layout

```
index.html                 Vite entry; no external scripts, styles or fonts
vite.config.ts             React plugin only
tailwind.config.js         content globs: index.html, src/**/*.{ts,tsx}
tsconfig.json              strict, noEmit, includes src/ and scripts/
scripts/
  verify.ts                golden test vs reference/expected/*.json (local only, git-ignored inputs)
src/
  main.tsx                 React root: StrictMode > AppProvider > HashRouter > App
  App.tsx                  header (date range + txn count), sticky tab bar, routes, privacy footer
  state.tsx                AppProvider / useApp / useAnalysis — the only state container
  profile.ts               personal defaults; SHIPS IN THE PUBLIC BUNDLE (see §6)
  index.css                Tailwind layers
  lib/
    types.ts               the data contract (ParseResult, Settings, Analysis and row types)
    validate.ts            BackupError + validateBackup(): shape check with friendly messages
    loadBackup.ts          File -> text -> Worker (or main-thread fallback) -> ParseResult
    worker.ts              worker entry: text -> validate -> parse -> postMessage
    parse.ts               the SMS rule table and de-duplication
    classify.ts            payee -> bar/food/butchery, name keys, Python-compatible round/title
    analyze.ts             ParseResult + Settings -> Analysis (all pages' data)
    time.ts                Africa/Nairobi (UTC+3, no DST) date maths, no Intl
    format.ts              KSh / number / date display helpers + the chart colour set
  components/
    ui.tsx                 PageTitle, Section, KPI tiles and other primitives
    DataTable.tsx          sortable, searchable table with CSV export
    chart.tsx              shared Recharts axis/grid props + exact-value MoneyTooltip
    Picker.tsx             searchable multi-select used by Settings
  pages/                   Upload, Overview, Flags, People, Payees, Bars, Loans, Settings
```

Roughly 2,100 lines of source; `analyze.ts` (437 lines) is by far the densest file and the one most
in need of care during review.

---

## 3. Data flow

```
 user drops .sms/.json file
        │
        ▼
 pages/Upload.tsx ──► state.loadFile(File)
        │
        ▼
 lib/loadBackup.ts
   file.text()
   cheap sniff: first 200 chars must start with { or [   ──► BackupError (friendly)
   new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        │                                   │ no Worker / construction throws / onerror
        ▼                                   ▼
 lib/worker.ts                        parseOnMainThread() (setTimeout 30 ms so the spinner paints)
   JSON.parse
   lib/validate.ts  validateBackup()  ──► BackupError ("no listSms list found")
   lib/parse.ts     parseBackup()
   postMessage({ ok, result | error })
        │
        ▼
 ParseResult  ── stored in React state (memory only; never written to disk/storage)
        │
        │   useMemo([parse, settings])
        ▼
 lib/analyze.ts  analyze(ParseResult, Settings)  ── uses lib/classify.ts + lib/time.ts
        │                                            (classify currently also reads src/profile.ts)
        ▼
 Analysis  ── React context (state.tsx)
        │
        ▼
 pages/*  read via useAnalysis(); components/* render tables + Recharts charts
```

Key properties:

- **One pass, in-memory.** The raw file text and the raw `listSms` array are never retained after
  parsing; only the de-duplicated `Txn[]` plus counters survive.
- **Analysis is derived, never stored.** Changing Settings re-runs `analyze()` synchronously inside a
  `useMemo`; a thrown error is captured into `analysisError` and surfaced as a load error rather than
  crashing the tree.
- **Parsing is deterministic and timezone-pinned.** `time.ts` shifts epoch ms by a fixed +3 h and
  reads UTC fields, so output is identical in Node, in a worker and in any browser locale. Do not
  introduce `Intl`/`toLocaleString` into `lib/time.ts` or `lib/analyze.ts`.

### Parse semantics (summary; details in SPEC §Parsing rules and PARSER_NOTES)

- Body is whitespace-collapsed, rules are tried **in table order, first match wins**.
- Dedupe key is `rule|CODE` (rule name, not the public `TxnCat`), so `recv`/`recv_alt` and
  `fuliza_repay`/`fuliza_repay2` dedupe independently while mapping to one category — this is
  deliberate and matches the Python oracle.
- A Fuliza draw legitimately shares its code with the payment it funded; dedupe must not collapse them.
- Counters (`insufficientFunds`, `wrongPin`, `pinLocked`, `kcbLoanRequests`, `totalSms`) are computed
  on the **raw** body of every message in `listSms`. Note: the loop does not currently filter on
  `adress === 'MPESA' | 'M-PESA'` as SPEC §Input file describes — transaction rules are specific
  enough that this does not affect `txns`, but the counters can over-count if the backup contains
  look-alike messages from other senders. See TASK-8.

---

## 4. The data contract (`src/lib/types.ts`)

This file is the boundary: the parser produces `ParseResult`, the UI consumes `Analysis`, and nothing
in `pages/` or `components/` may reach past it into parser internals.

- `RawSms` — `{ adress, body, name?, time, type? }`; `time` is epoch ms. (`adress` misspelling comes
  from the backup app and is intentional.)
- `Txn` — `{ code, cat: TxnCat, ts, iso, amount, cost, balance, name?, phone?, account?, fee?, orig? }`.
  `iso` is `'YYYY-MM-DDTHH:mm'` in Nairobi local time. `cost` defaults to 0; `balance` is nullable.
- `TxnCat` — the 18 public categories (`send_person`, `send_pochi`, `send_paybill`, `till`,
  `recv_person`, `recv_business`, `withdraw`, `deposit`, `airtime`, `fuliza_draw`, `fuliza_repay`,
  `kcb_from`, `kcb_to`, `kcb_repay`, `mshwari_from`, `mshwari_to`, `hustler_repay`, `reversal`).
- `ParseResult` — `{ txns, counters, kcbLoanRequestTs? }`.
- `Settings` — `{ excludedPeople: string[]; extraBars: string[] }`, plus `DEFAULT_SETTINGS` seeded
  from `src/profile.ts`. **This interface will grow in TASK-5**; grow it with a version bump and a
  migration, never by silently reinterpreting existing stored values.
- `Analysis` — `{ summary, flags, monthly, categories, hours, people, payees, biz{dow,hour,grid,parts,dayTop},
fb{summary,cats,venues,yearly,dow,hour,monthly,nights}, drains{bars,people}, loans{monthly,products} }`,
  one field per page section, with a named row interface each.

Contract rules for reviewers:

1. **Renaming or removing a field in `types.ts` invalidates `scripts/verify.ts` and the golden
   reference.** Additive optional fields are cheap; anything else needs a re-verify and a
   PARSER_NOTES entry.
2. `people` and `payees` are **full lists** — the UI does the ranking and the top-N cut, not the
   analysis layer (except where SPEC fixes a cap: `fb.venues` 100, `fb.nights` 15, `drains.bars` 20).
3. Money values are plain numbers in KSh; formatting belongs to `lib/format.ts` and the UI only.
4. Flag `detail` strings are generated in `analyze.ts` and deliberately match the Python wording
   character for character (`pyRound`, `pyTitle` in `classify.ts`). Changing wording changes the
   golden reference.

---

## 5. State and persistence

Single React context in `src/state.tsx` — there is no Redux/Zustand and none is needed.

| Value                                               | Lives                                                 | Lifetime                  |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| `parse: ParseResult \| null`                        | React state (memory)                                  | until reload or `reset()` |
| `analysis: Analysis \| null`                        | `useMemo(parse, settings)`                            | derived, never stored     |
| `fileName`, `loading`, `loadError`, `analysisError` | React state                                           | session                   |
| `settings: Settings`                                | React state **+ `localStorage['mpesa.settings.v1']`** | persists across sessions  |

Rules:

- **`localStorage` holds settings and nothing else.** No transaction, name, phone number, amount or
  file content may be written to `localStorage`, `sessionStorage`, IndexedDB, cookies or the URL
  (including hash/query parameters).
- `loadSettings()` defensively validates the stored JSON per field and falls back to
  `DEFAULT_SETTINGS`; `saveSettings()` swallows quota/privacy-mode errors and keeps going in memory.
  Keep both behaviours.
- When the `Settings` shape changes, bump the key (`mpesa.settings.v2`) and migrate from v1 rather
  than discarding the user's excluded people.
- Routing state is URL hash only; `App.tsx` redirects every route back to `/` while `analysis` is
  null, so pages can use `useAnalysis()` (which throws when empty) without null checks.

---

## 6. Privacy posture

The input is one person's complete financial history. Privacy is not a feature here, it is the
product constraint.

**Holds today:**

- No `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, analytics or telemetry anywhere in `src/`.
- No external fonts, CDNs or stylesheets: `index.html` loads only the bundled module and Tailwind's
  compiled CSS.
- Parsing happens in a Worker on the user's device; the file is read with `File.text()` and never
  copied anywhere else.
- `.gitignore` covers `*.sms`, `backups/`, `reference/`, `.env*`, `.vercel`, `dist`, `coverage`.
  `.claude/settings.json` additionally denies reads of `./backups/**` and `./reference/**`.
- Vercel serves static files only; there is no server component that could receive data.

**Known risk — `src/profile.ts` ships in the public bundle.** It currently contains one real excluded
person's name, four venue-name patterns and a till-merge rule. `npm run build` inlines all of it into
`dist/assets/index-*.js`, so anyone with the deployed URL can read it, and `classify.ts` imports
`PROFILE` directly, which also makes classification non-configurable at runtime. TASK-5 moves these
values into Settings (localStorage) and empties `profile.ts`. Until then:

- Treat any PR that adds a real name, phone number, amount, till name or transaction code to
  `src/**` — `profile.ts` included — as an automatic **changes requested**.
- Tests and fixtures use **synthetic** data only (invented names, numbers and codes, as in SPEC).
- Never paste real backup content into code, tests, commit messages, issues or PR descriptions.

**Deployment hardening (TASK-4):** `vercel.json` should set a strict
`Content-Security-Policy` (`default-src 'self'`; `connect-src 'none'`; no third-party origins),
plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and a restrictive
`Permissions-Policy`. The CSP is the enforcement mechanism behind "no network calls"; a review should
not rely on code reading alone once it exists. Note that Vite's dev server and the worker blob need
the CSP to allow `worker-src 'self' blob:`.

---

## 7. Build, test and deploy shape

| Command             | Status      | What it does                                                                                 |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`       | exists      | Vite dev server                                                                              |
| `npm run build`     | exists      | `tsc -b && vite build` → `dist/`                                                             |
| `npm run preview`   | exists      | serves `dist/`                                                                               |
| `npm run typecheck` | exists      | `tsc --noEmit -p .` over `src/` and `scripts/`                                               |
| `npm run verify`    | exists      | `tsx scripts/verify.ts` — golden test, needs local `backups/sms.sms` + `reference/expected/` |
| `npm run lint`      | **missing** | TASK-1                                                                                       |
| `npm test`          | **missing** | TASK-1                                                                                       |

Current build output: `index-*.js` ≈ **631 kB** (≈ 190 kB gzipped), `index-*.css` ≈ 15.5 kB,
`worker-*.js` ≈ 4.5 kB. Recharts dominates the main chunk; route-level `React.lazy` (TASK-6) is the
agreed fix, with a **500 kB budget for the entry chunk**.

Deploy: GitHub → Vercel static hosting. `main` is protected by convention; changes land only via a PR
approved by Apex and merged by Harbor. Every PR gets a Vercel preview; merges to `main` deploy.
`scripts/verify.ts` can never run in CI (it needs private local data), so CI runs lint, typecheck,
unit tests and build, and the golden test stays a local pre-merge gate run by Apex on parser changes.

---

## 8. Constraints future changes must respect

1. **No network calls.** Nothing in `src/` may fetch, beacon, or load a remote font/script/style.
2. **No persistence of user data.** Only `Settings` may touch `localStorage`.
3. **No real personal data in the repo**, including `src/profile.ts`, tests and fixtures.
4. **`lib/parse.ts`, `analyze.ts`, `classify.ts`, `time.ts` stay pure** — no DOM, no browser globals,
   no `Intl` in time/analysis paths. They must keep running under Node for `scripts/verify.ts`.
5. **The golden test stays green.** Any change touching parse/analyze/classify/time requires a local
   `npm run verify` → ALL SECTIONS PASS before approval; intentional divergences are documented in
   `docs/PARSER_NOTES.md`.
6. **Parser rules are tested with synthetic fixtures** — one per rule, plus dedupe and Nairobi
   timezone cases.
7. **TypeScript stays strict**; no `any`, no `@ts-expect-error` without a comment explaining why.
8. **Light theme, red flags as red text, usable at 400 px wide**, sticky tab bar, CSV export on every
   table, exact-value tooltips on every chart.
9. **No new runtime dependency** without a justification the reviewer accepts; prefer deleting code
   over adding a library.
10. **Small PRs**, conventional commit titles (`feat:`, `fix:`, `chore:`, `docs:`), one task per PR.
