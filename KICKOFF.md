# Getting started

1. Unzip this kit into `pesa-lens` from the terminal, not Finder, so the hidden `.claude/` folder and `.gitignore` come along:
   ```bash
   cd ~/path/to/pesa-lens
   unzip -o ~/Downloads/pesa-lens-kit.zip
   ls -a   # you should see .claude  .gitignore  CLAUDE.md  docs  src  ...
   ```
2. Install the packages and run the app locally:
   ```bash
   npm install
   npm run dev    # open the URL it prints, then drop your .sms backup on the page
   ```
3. Optional golden test with your real data (both folders are git-ignored and never leave your machine):
   ```bash
   mkdir -p backups reference && cp ~/Downloads/<your-backup>.sms backups/sms.sms
   unzip -o ~/Downloads/pesa-lens-reference.zip -d .   # creates reference/expected/*.json
   npm run verify   # expect: ALL SECTIONS PASS
   ```
4. Set up GitHub, then commit:
   ```bash
   git init -b main && gh auth login
   git add . && git status   # check that no .sms or reference/ files are listed
   git commit -m "chore: PesaLens starter"
   gh repo create pesa-lens --private --source . --push
   ```
5. Connect Vercel once: on vercel.com go to Add New → Project, import `pesa-lens`, and keep the defaults. From then on, every PR gets a preview link and every merge to `main` deploys.
6. Start Claude Code in the VS Code terminal with `claude` and paste:

> Read CLAUDE.md and docs/STATUS.md. Use the apex agent to write docs/ARCHITECTURE.md and docs/TASKS.md based on the existing code and the "Not done yet" list. Then do TASK-1 only: forge builds it and opens a PR, and apex reviews it. Stop and show me the Vercel preview link. I'll say "go" before harbor merges.
