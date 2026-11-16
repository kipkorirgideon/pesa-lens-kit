# Getting started

1. Create an empty folder named `pesa-lens`, open it in VS Code, and copy this kit's contents into it, keeping the hidden `.claude/` folder and `.gitignore`.
2. In the VS Code terminal: `git init -b main`, then log in once with `gh auth login` and `npx vercel login`.
3. Optional: create the GitHub repo now with `gh repo create pesa-lens --private --source . --push`. Keep it **private**.
4. Start Claude Code in the folder and paste:

> Read CLAUDE.md. Use the apex agent to plan PesaLens from docs/SPEC.md: choose the stack (React preferred), write docs/ARCHITECTURE.md and docs/TASKS.md. Then run the team loop: forge builds each task and opens a PR, apex reviews it, and on approval harbor merges and deploys to Vercel. Make TASK-1 the project scaffold plus CI and the Vercel setup. Stop after each deploy and give me the URL.

5. To test with your real data, put your backup in `backups/` (it's git-ignored) and tell the agents the path. Don't paste its contents anywhere.
