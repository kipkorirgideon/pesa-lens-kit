# PesaLens

[![CI](https://github.com/kipkorirgideon/pesa-lens-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/kipkorirgideon/pesa-lens-kit/actions/workflows/ci.yml)

Private M-PESA money-flow dashboard. Drop your SMS backup in and see who you pay, who pays you, your paybills and tills, bars and restaurants, Fuliza and loans, and your red flags. Everything runs in your browser; nothing is uploaded.

```bash
npm install
npm run dev
```

The team workflow is in `CLAUDE.md`, the product spec in `docs/SPEC.md`, and the current state in `docs/STATUS.md`. Setup steps are in `KICKOFF.md`.

## CI and security headers

`.github/workflows/ci.yml` runs lint, typecheck, tests and build on Node 20 for every pull request and every push to `main`. `vercel.json` serves a strict Content-Security-Policy (`connect-src 'none'`, so the app cannot send data anywhere), plus `nosniff`, `no-referrer` and a Permissions-Policy that disables camera, microphone and geolocation. To make a red CI run block merging, enable the CI check as a required status check in the repository's branch protection settings.
