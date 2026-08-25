# Publishing NetraX to GitHub safely

The local environment does not contain a writable Git repository or a GitHub
remote. From a normal terminal, create a private repository first, then run:

```bash
cd ~/netrax
git init
git add .
git status
git commit -m "Prepare NetraX partner handoff"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/netrax.git
git push -u origin main
```

Before pushing, confirm that `git status --short` does not list
`backend/.env`, `ai-service/.env`, `ai-service/venv`, `node_modules`, local
snapshots, or recovery tokens. The root `.gitignore` excludes those paths.

Use a private repository for partner collaboration. Invite the partner through
GitHub repository Settings → Collaborators and give the minimum required role.
Never place database passwords, Sentinel credentials, admin passwords, or
recovery tokens in GitHub. Each collaborator should create local `.env` files
from the checked-in examples.
