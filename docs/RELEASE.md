# Release checklist

Mechanical: follow it top to bottom. What each gate proves is in `README.md`.

## Pre-merge (all must be true on the PR head)

- [ ] `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test -- --run`, `npm run build` (includes the 500 kB per-chunk budget) and `npx prettier --check .` are all green.
- [ ] If the PR touches `src/lib/parse.ts`, `analyze.ts`, `classify.ts` or `time.ts`: `npm run verify` printed `ALL SECTIONS PASS` on a machine that has `backups/sms.sms` and `reference/expected/`. If no such machine is available, the PR is **not mergeable**; do not approximate it.
- [ ] Preview checked at 400 px wide: no horizontal page scroll (tables and the tab bar may scroll inside their own box), no clipped tiles.
- [ ] No personal data anywhere: the diff, fixtures, commit messages and PR body contain no real name, phone number, amount, till, paybill or transaction code. No `.sms` file, `backups/` or `reference/` path in `git status`.

## DEPLOY: YES or NO in `.claude/handoff/review.md`

- **`DEPLOY: YES`** when a user can see a difference in the app: any change under `src/` that affects rendering or behaviour, parser or analysis output, `vercel.json` headers, `index.html`, build config that changes the emitted bundle, or dependencies that ship in the bundle.
- **`DEPLOY: NO`** for changes that do not alter what is served: tests, docs, CI config, lint/format config, dev-only tooling. `NO` is a normal outcome, not an error or a skipped step; the gates still apply.

When unsure, ask whether the built `dist/` would differ. If it would, deploy.

## Deployment-exposure rule (applies to every deploy)

While `src/profile.ts` compiles personal data into the bundle, **no deployment may be publicly readable**.

- Vercel's default `ssoProtection` is `all_except_custom_domains`. It protects only the per-deployment URLs and leaves the production alias and any custom-domain alias **open to the internet**.
- The project must be set to `ssoProtection: {"deploymentType":"all"}`.
- After every deploy, check **each class of URL unauthenticated**, expecting a `302` redirect to `vercel.com/sso-api`:
  - the per-deployment URL;
  - the production alias;
  - the team-scoped alias;
  - the custom-domain alias.
    `curl -sI <url>` and read the status and `Location`. A `200` on any one of them is an incident: fix the setting, re-check all of them.
- Do not write hostnames or project/team IDs into committed docs; keep those in your Vercel dashboard.

The rule can be relaxed only once the profile data no longer ships in the bundle (TASK-5, currently blocked on a local `npm run verify`), and then only deliberately.
