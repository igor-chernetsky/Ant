# CI/CD — Deploy API to EC2

Automatic deployment via **GitHub Actions** when you push to `main` (or `master`) and change API/infra files.

Vercel deploys the web app separately (connect repo in Vercel dashboard).

---

## 1. What runs on push

Workflow: [.github/workflows/deploy-ec2.yml](../.github/workflows/deploy-ec2.yml)

| Trigger | Action |
|---------|--------|
| Push to `main` / `master` | SSH to EC2 → `git pull` → build API → migrate → restart |
| Paths | `apps/api/**`, `infra/**`, workflow file |
| Manual | Actions → **Deploy to EC2** → **Run workflow** |

Script on server: [infra/scripts/deploy.sh](../infra/scripts/deploy.sh)

---

## 2. One-time EC2 setup

### 2.1 Clone repo (if not already)

```bash
cd ~
git clone git@github.com:YOUR_ORG/YOUR_REPO.git construction-platform
cd construction-platform
git checkout main
```

### 2.2 Deploy key for `git pull` on EC2

On EC2:

```bash
ssh-keygen -t ed25519 -C "ec2-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

GitHub → repo → **Settings** → **Deploy keys** → Add deploy key (read-only) → paste public key.

```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config ~/.ssh/github_deploy
cd ~/construction-platform
git remote -v   # should be git@github.com:...
git pull
```

### 2.3 `.env` on EC2

```bash
cp ~/construction-platform/infra/.env.example ~/construction-platform/infra/.env
nano ~/construction-platform/infra/.env   # production values — never commit
```

Stack must already run once manually (`docker compose up -d`).

### 2.4 Make deploy script executable

```bash
chmod +x ~/construction-platform/infra/scripts/deploy.sh
```

---

## 3. GitHub repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Example | Required |
|--------|---------|----------|
| `EC2_HOST` | `54.85.77.112` or `iabuilding.duckdns.org` | Yes |
| `EC2_USER` | `ubuntu` | Yes |
| `EC2_SSH_PRIVATE_KEY` | Full private key used to SSH **into** EC2 (PEM contents) | Yes |
| `EC2_REPO_DIR` | `/home/ubuntu/construction-platform` | Optional (default in workflow) |
| `EC2_HEALTH_URL` | `https://iabuilding.duckdns.org/api/health` | Optional (post-deploy check) |

**Important:** `EC2_SSH_PRIVATE_KEY` is the key pair for EC2 login (`.pem` from AWS), **not** the GitHub deploy key.

### Allow GitHub Actions to SSH

EC2 Security Group: inbound **22** from your IP, or restrict to [GitHub Actions IP ranges](https://api.github.com/meta) if you use them (advanced).

For MVP, SSH from `0.0.0.0/0` is common on trial — tighten later.

---

## 4. Test manual deploy on EC2

```bash
bash ~/construction-platform/infra/scripts/deploy.sh
curl -s https://iabuilding.duckdns.org/api/health
```

---

## 5. Test GitHub Actions

1. Push a small change to `apps/api` on `main`.
2. GitHub → **Actions** → **Deploy to EC2** → watch logs.
3. Verify: `curl https://iabuilding.duckdns.org/api/health`

---

## 6. What is NOT deployed by this workflow

| Component | Deploy |
|-----------|--------|
| NestJS API | ✅ EC2 workflow |
| Keycloak / Postgres / Caddy | Restarted if compose changed; images pulled on `up -d` |
| Next.js web | Vercel (auto on push if project linked) |

To deploy web only: push to `apps/web` → Vercel rebuild (no EC2 workflow unless you add paths).

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| `git pull` fails on EC2 | Deploy key not added or wrong remote URL |
| `Permission denied (publickey)` in Actions | Wrong `EC2_SSH_PRIVATE_KEY` or SG blocks port 22 |
| Build OOM | Ensure disk ≥ 20 GB; `docker builder prune -af` |
| Migrate fails | Check `DATABASE_URL` / Postgres password in `infra/.env` |
| Health check fails in workflow | Set `EC2_HEALTH_URL` or increase sleep in workflow |

---

## 8. Optional improvements later

- Deploy only `api` service (already) vs full stack
- Slack/Telegram notification on failure
- Staging branch + second EC2
- ECR + pull images instead of building on EC2
