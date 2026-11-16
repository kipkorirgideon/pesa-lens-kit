# PesaLens

[![CI](https://github.com/kipkorirgideon/pesa-lens-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/kipkorirgideon/pesa-lens-kit/actions/workflows/ci.yml)

Private M-PESA money-flow dashboard. Drop your SMS backup in and see who you pay, who pays you, your paybills and tills, bars and restaurants, Fuliza and loans, and your red flags. Everything runs in your browser; nothing is uploaded.

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally (does NOT apply vercel.json headers)
```

The team workflow is in `CLAUDE.md`, the product spec in `docs/SPEC.md`, the current state in `docs/STATUS.md`, and the merge/deploy checklist in `docs/RELEASE.md`. Setup steps are in `KICKOFF.md`.

## Privacy posture

- **Everything happens in the browser.** A chosen file is validated, then parsed in a Web Worker (with a main-thread fallback if the worker cannot start). The parser and analysis are pure functions in `src/lib/`, so nothing needs a server.
- **No network calls of any kind:** no analytics, no telemetry, no external fonts or CDNs at runtime. This is enforced, not promised: `vercel.json` serves a Content-Security-Policy with `connect-src 'none'`, so a deployed build cannot send data anywhere even if a bug tried to.
- **Parsed data lives in memory only** and is gone when the tab closes. The only thing persisted is your settings (in `localStorage`), never transactions.

## Scripts and what each gate proves

A change is mergeable only when all of these pass on the PR head. They prove different things; a green run of one says nothing about the others.

| Command                              | What a pass proves                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint -- --max-warnings=0`   | No lint errors and no warnings. Warnings are failures. Includes the React hooks rules, the accessibility (`jsx-a11y`) rules, and a rule that keeps `parse.ts`, `analyze.ts`, `classify.ts` and `time.ts` free of browser globals (`window`, `document`, `localStorage`, `fetch`), so they stay runnable in Node tests and a worker.                                  |
| `npm run typecheck`                  | The code satisfies strict TypeScript, including the data contract in `src/lib/types.ts` between parser, analysis and UI.                                                                                                                                                                                                                                            |
| `npm test -- --run`                  | Vitest, single run (without `--run` it sits in watch mode). Parser rules (one invented SMS per rule, dedupe, Nairobi time), analysis and classification, settings, and accessibility roles in jsdom. All fixtures are synthetic. It proves behaviour is pinned, not that it matches your real data (that is `verify`).                                           |
| `npm run build`                      | `tsc -b && vite build` succeeds, and **no emitted JS chunk exceeds 500 kB**. The budget is a `chunk-budget` plugin in `vite.config.ts` that calls `this.error` in `generateBundle`, so an oversized chunk fails the build with a non-zero exit that reaches CI. This is what stops the bundle regressing; Vite's own size warning would not. |
| `npx prettier --check .`             | Formatting is canonical. CI runs it as `npm run format:check`; run `npm run format` to fix.                                                                                                                                                                                                                                              |
| `npm run verify`                     | The golden test: parser and analysis reproduce a reference analysis of a real backup, section by section, within KSh 1. This is the only gate that catches a parser or classification change silently moving real numbers. **Local only**, see below.                                                                                                              |

Other scripts: `npm run dev`, `npm run preview`, `npm run format`.

CI (`.github/workflows/ci.yml`, Node 20, every PR and push to `main`) runs lint with `--max-warnings=0`, the Prettier check (`npm run format:check`), typecheck, tests and build. `npm run verify` is local-only: it needs a real backup, so CI deliberately never touches `backups/`, `reference/` or `verify`. A red CI run only blocks merging if the check is marked required in the repository's branch protection settings (a GitHub UI setting, not something in the repo).

`vercel.json` also sets `nosniff`, `Referrer-Policy: no-referrer` and a Permissions-Policy disabling camera, microphone and geolocation. `npm run preview` does not apply these headers; only a real Vercel deployment does.

## The optional local golden test (`npm run verify`)

`npm run verify` runs `scripts/verify.ts`: it parses `backups/sms.sms`, analyses it with the app's default settings, and compares 19 sections against `reference/expected/*.json`. Both inputs are personal financial data, so both directories are listed in `.gitignore` (along with `*.sms`) and are **never committed**.

**It cannot run in a fresh clone, and that is intentional.** In a clone without those files it fails on the missing path. That is not a broken script; shipping the data to make it pass would defeat the point of the project. CI skips it for the same reason, which makes it a local pre-merge gate run by whoever has the data.

To set it up on your own machine:

1. Export your own M-PESA SMS backup (the JSON `.sms` file your backup app produces) and copy it to `backups/sms.sms`.
2. Put the expected results in `reference/expected/*.json`. These are derived from **your own** backup by the original analysis (`docs/PARSER_NOTES.md` explains how the parser was verified against it); they are not shipped with the repo and a reference built from someone else's backup will not match yours.
3. Run `npm run verify`. A good run ends with `ALL SECTIONS PASS`. Any other output names the section and rows that differ.
4. Before committing anything, run `git status` and confirm no `.sms` file and nothing under `backups/` or `reference/` is listed. Never paste figures, names, numbers or transaction codes from the output into code, tests, fixtures, commit messages or PR descriptions.

Run it whenever you touch `src/lib/parse.ts`, `analyze.ts`, `classify.ts` or `time.ts`. Everything else is covered by the other gates.
