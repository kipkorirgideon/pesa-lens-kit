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
"Apex: review PR #n"  ─▶ apex (review)    ─▶ "Harbor: deploy PR #n"  or  "Forge: address review on PR #n"
"Forge: address review on PR #n" ─▶ forge ─▶ "Apex: re-review PR #n"
"Harbor: deploy PR #n" ─▶ harbor          ─▶ "Deployed PR #n → <url>"  then next task
```
Handoff state lives in `.claude/handoff/review.md` (written by Apex, read by Harbor). Harbor refuses to deploy without `VERDICT: APPROVED` and `DEPLOY: YES` there.

Keep looping through `docs/TASKS.md` until every task is ticked, then stop and summarise for the user. Ask the user only for things agents cannot do themselves: logging in (`gh auth login`, `npx vercel login`), confirming the Vercel project name, or a product decision that isn't in SPEC.md.

## Ground rules for everyone
- **Privacy:** never read, copy, commit or upload a real SMS backup unless the user explicitly points to one for local testing; never paste its contents into code, tests, issues or PRs. `*.sms` and `backups/` are git-ignored.
- No network calls from the app. No secrets in files.
- `main` is protected by convention: changes land only through PRs approved by Apex.
