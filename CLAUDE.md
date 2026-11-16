# PesaLens — team workflow

PesaLens is a private, client-side dashboard that turns an M-PESA SMS backup into money-flow analytics: who you send to and receive from, paybills/tills, bars & restaurants, Fuliza & loans, and red flags. Product requirements: `docs/SPEC.md`.

## The team (subagents in `.claude/agents/`)
| Agent | Role | Owns |
|---|---|---|
| **apex** | CTO | architecture, stack, `docs/ARCHITECTURE.md`, `docs/TASKS.md`, PR reviews, deploy sign-off |
| **forge** | Core frontend engineer | all app code and tests, one PR per task |
| **harbor** | DevOps | CI, Vercel project, merging approved PRs, deploys, rollback |

Subagents cannot call each other, so **the main session is the dispatcher**. Route by the last line each agent ends with:

```
new feature/project  ─▶ apex (plan)      ─▶ "Forge: start TASK-n"
"Forge: start TASK-n" ─▶ forge (build+PR) ─▶ "Apex: review PR #n"
"Apex: review PR #n"  ─▶ apex (review)    ─▶ "User: check the preview, then say go → Harbor: ship PR #n"
                                              or "Forge: address review on PR #n"
"Forge: address review on PR #n" ─▶ forge ─▶ "Apex: re-review PR #n"
user says "go"        ─▶ harbor (merge)    ─▶ Vercel auto-deploys main ─▶ "Deployed PR #n → <url>"
```
Handoff state lives in `.claude/handoff/review.md` (written by Apex, read by Harbor). Harbor refuses to merge without `VERDICT: APPROVED` + `DEPLOY: YES` there **and** the user's "go" relayed by you. Vercel's Git integration does the actual deploys (preview per PR, production on merge to main).

**Do one task per run**: take it from Forge to the preview link, stop, and wait for the user. Never say "go" on the user's behalf.

The repo starts with a working app (see `docs/STATUS.md`); the parser is verified against the original analysis (`docs/PARSER_NOTES.md`). Improve it — don't rewrite it. Ask the user only for things agents cannot do themselves: logging in (`gh auth login`, `npx vercel login`), confirming the Vercel project name, or a product decision that isn't in SPEC.md.

## Ground rules for everyone
- **Privacy:** never read, copy, commit or upload a real SMS backup unless the user explicitly points to one for local testing; never paste its contents into code, tests, issues or PRs. `*.sms` and `backups/` are git-ignored.
- No network calls from the app. No secrets in files.
- `main` is protected by convention: changes land only through PRs approved by Apex.
