# NEXUS-1 · Sovereign Account Consolidation Agent

Your private AI agent for systematically consolidating internet accounts.
Runs entirely in the cloud — nothing stored on your device.

---

## Deploy to Railway (5 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "nexus-1 init"
gh repo create nexus-agent --private --push
```

### 2. Deploy on Railway
1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select your `nexus-agent` repo
3. Railway auto-detects the Dockerfile and deploys

### 3. Add environment variables
In Railway dashboard → your service → Variables, add:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
VAULT_PATH=/data/vault
```

### 4. Add persistent storage
Railway dashboard → your service → Add Volume
- Mount path: `/data/vault`
- This is where all your exported data and queue state live

### 5. Get your URL
Railway gives you a `*.up.railway.app` URL — that's your dashboard.
Bookmark it. Access from any device.

---

## How to use

### Step 1 — Export your browser history files
**Chrome / Brave:**
```
~/Library/Application Support/Google/Chrome/Default/History
~/Library/Application Support/BraveSoftware/Brave-Browser/Default/History
```
These are SQLite files. Just copy them — don't rename.

**Firefox:**
```
~/Library/Application Support/Firefox/Profiles/[profile-id]/places.sqlite
```

**Password exports:**
- Chrome: chrome://password-manager/passwords → Export passwords
- Bitwarden: Settings → Export Vault → CSV
- 1Password: File → Export → All Items → CSV

### Step 2 — Import via the dashboard
Click `+ IMPORT` in the top bar, choose your file type, upload.
The agent parses it and builds your queue automatically.

### Step 3 — Work through the queue
Each account card shows:
- Platform, username, email
- Where it was found (browser/source)
- Suggested action

Your options per account:
- **APPROVE + RUN** → export data, then delete account
- **EXPORT ONLY** → download data, keep account live
- **SKIP** → move to end of queue for later
- **DELETE** → delete without export (agent will warn if risky)

### Step 4 — Everything goes to the vault
All exported data, logs, and transcripts are saved to `/data/vault`
on your Railway persistent volume. Download at any time via:
```
GET /api/vault          — list all vault items
GET /api/vault/:file    — read a specific item
```

---

## Architecture

```
Browser History Files (local, one-time upload)
         ↓
   NEXUS-1 Parser
         ↓
   Account Queue (persisted to /data/vault/queue.json)
         ↓
   Claude Agent (reasoning + action planning)
         ↓
   Action Executor (export / delete workflows)
         ↓
   Encrypted Vault (/data/vault/)
         ↓
   You (approve / skip / command via chat)
```

---

## Security notes
- Your Railway volume is private to your account
- Passwords from CSV imports are held in memory only — never written to disk as plaintext
- Queue state saves account metadata only (username, email, platform) — not passwords
- Add `DASHBOARD_PASSWORD` env var to protect the URL with basic auth (coming soon)
- For extra security: set Railway's private networking and use their VPN feature

---

## Local testing (optional)
```bash
cp .env.example .env
# edit .env with your ANTHROPIC_API_KEY
npm install
npm start
# open http://localhost:3000
```
