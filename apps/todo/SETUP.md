# Setup

## 1. Create Turso database
Sign up free at https://turso.tech and create a database. Copy the libsql URL and auth token.

## 2. Configure environment
```bash
cp .env.local.example .env.local
```
Edit `.env.local`:
- `TODO_PASSWORD` — any password you want
- `AUTH_SECRET` — run `openssl rand -base64 32`
- `TURSO_DATABASE_URL` — from Turso dashboard
- `TURSO_AUTH_TOKEN` — from Turso dashboard
- `OPENCLAW_BASE_URL` — leave as `http://localhost:3456/v1`

## 3. Start the OpenClaw proxy
```bash
npm install -g claude-max-api-proxy
claude-max-api
```
Expected: `Proxy running on http://localhost:3456`

## 4. Start the app
```bash
yarn dev
```
Opens at http://localhost:3002

## 5. Smoke test
1. Visit http://localhost:3002 → redirects to /login
2. Enter password → redirects to /
3. Add a todo (press Enter)
4. Check it done → moves to completed
5. Click ✦ sparkle → panel opens, Claude responds with subtasks + question
6. Save subtasks → panel closes
7. Visit /profile → add a fact (e.g. key: `role`, value: `frontend engineer`)
8. Expand another todo → AI should reference your profile
