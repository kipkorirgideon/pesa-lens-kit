# PesaLens — team workflow

PesaLens is a private, client-side dashboard that turns an M-PESA SMS backup into money-flow analytics: who you send to and receive from, paybills/tills, bars & restaurants, Fuliza & loans, and red flags. Product requirements: `docs/SPEC.md`.

## The team (subagents in `.claude/agents/`)
| Agent | Role | Owns |
|---|---|---|
| **apex** | CTO | architecture, stack, `docs/ARCHITECTURE.md`, `docs/TASKS.md`, PR reviews, **merging approved PRs**, deploy sign-off |
| **forge** | Core frontend engineer | all app code and tests, one PR per task |
| **harbor** | DevOps | CI, Vercel project, deploys, deployment verification, rollback |

Subagents cannot call each other, so **the main session is the dispatcher**. Route by the last line each agent ends with:

```
new feature/project  ─▶ apex (plan)      ─▶ "Forge: start TASK-n"
"Forge: start TASK-n" ─▶ forge (build+PR) ─▶ "Apex: review PR #n"
"Apex: review PR #n"  ─▶ apex (review + merge on green) ─▶ "Harbor: deploy PR #n"
                                              or "Forge: address review on PR #n"
"Forge: address review on PR #n" ─▶ forge ─▶ "Apex: re-review PR #n"
"Harbor: deploy PR #n" ─▶ harbor           ─▶ "Deployed PR #n → <url>"  then next task
```
Handoff state lives in `.claude/handoff/review.md` (written by Apex, read by Harbor). The `.claude/handoff/` directory is local-only and git-ignored; Apex regenerates it at each review, so a fresh clone will not contain it.

**One task runs end to end, unattended.** Once a task starts, Forge builds it, Apex reviews **and merges** it in the same run, and Harbor deploys and verifies — with no pause for the user at any point inside the task. Never ask the user to approve a merge or a deploy mid-task.

**Apex calls the next task, not the user.** When a task is merged and deployed, Apex names the next unticked task in `docs/TASKS.md` and the dispatcher starts it immediately. Do not stop between tasks, do not ask the user to green-light anything, and do not report progress task by task. Keep looping until every task is ticked or genuinely blocked, then report the final state once.

**Blocked means blocked — never fake completion.** A task that cannot be finished by an agent (needs a GitHub/Vercel UI setting, a real browser, a login, or golden data absent from the checkout) is reported as blocked with the reason and what the user must do. Do not tick its checkbox, do not approximate it, and do not relax its acceptance criteria to make it pass. Skip it, record why, and carry on with the rest of the backlog.

**The gates replace the human checkpoint, so they are absolute.** Apex merges only when its own verdict is `APPROVED` and every gate is green on the PR head: `lint --max-warnings=0`, `typecheck`, `test -- --run`, `build`, `prettier --check`, plus `npm run verify` → ALL SECTIONS PASS for any PR touching `parse.ts`/`analyze.ts`/`classify.ts`/`time.ts` when `reference/` is available. A red gate, a failed privacy check, or an unverifiable parser change is an automatic refusal — never merge past one, never relax a gate to make a PR land, and never skip the review step to save a round trip.

**Deployment safety invariant** (not a checkpoint — enforce it automatically): no deployment may be publicly readable while `src/profile.ts` compiles personal data into the bundle. Harbor sets `ssoProtection: {"deploymentType":"all"}` and verifies unauthenticated access returns 302, every time. TASK-5 removes the underlying problem; until it lands, an unprotected URL is an incident to fix immediately and report, not a thing to leave up.

Interrupt a task in progress only for: something no agent can do (`gh auth login`, `npx vercel login`, a Vercel dashboard-only setting), a product decision not answered by SPEC.md, a destructive or irreversible action outside the normal task loop, or a privacy incident. Everything else waits for the end-of-task report.

The repo starts with a working app (see `docs/STATUS.md`); the parser is verified against the original analysis (`docs/PARSER_NOTES.md`). Improve it — don't rewrite it. Ask the user only for things agents cannot do themselves: logging in (`gh auth login`, `npx vercel login`), confirming the Vercel project name, or a product decision that isn't in SPEC.md.

## Ground rules for everyone
- **Privacy:** never read, copy, commit or upload a real SMS backup unless the user explicitly points to one for local testing; never paste its contents into code, tests, issues or PRs. `*.sms` and `backups/` are git-ignored.
- No network calls from the app. No secrets in files.
- `main` is protected by convention: changes land only through PRs approved by Apex.
