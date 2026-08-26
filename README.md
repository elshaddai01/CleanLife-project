# CleanLife

On-demand waste collection marketplace for Cameroon — connects clients with
independent and corporate collectors. React Native (Expo) mobile app,
Node.js/Express backend, PostgreSQL + PostGIS, Redis/BullMQ dispatch engine.

This README is the single entry point for running every part of the
project. Each major piece also has its own README with deeper detail —
this file tells you which one to open and in what order to start things.

## Project layout

```
cleanlife-backend/            Node.js/Express API + PostgreSQL migrations
cleanlife-mobile/              Expo/React Native app (client + collector)
cleanlife-admin-portal/        Web portal — company admins manage their fleet
cleanlife-super-admin-portal/  Web portal — platform owner manages companies
```

## First-time setup order

Do these once, in order, on a fresh machine.

### 1. Backend — database, env, migrations

```
cd cleanlife-backend
npm install
```

Create the database (in psql or any Postgres client):
```sql
CREATE DATABASE cleanlife_db;
```

Copy `.env.example` to `.env`, then edit it:
- `DATABASE_URL` — your real Postgres username/password/database name.
  If your password contains `@`, URL-encode it as `%40`.
- `JWT_SECRET`, `ADMIN_API_KEY`, `MOMO_WEBHOOK_SECRET` — replace every
  `change_this...` placeholder with a real random string.
- `PORT` — see "Port conflicts on Windows" below before picking a number.

Apply the database schema:
```
npm run migrate
```

### 2. Backend — bootstrap the first super admin (one-time)

```
node scripts/createSuperAdmin.js <username> <password>
```
Password must be 8+ characters. This account can log into the Super Admin
Portal to create companies and issue company admin credentials. Write the
username/password down — there is no recovery flow yet.

### 3. Start the backend

```
npm run check
npm start
```
Leave this terminal running. `npm run check` syntax-checks every backend
file first — catches typos before the server even tries to boot.

### 4. Find your machine's LAN IP (needed by mobile app + both portals)

In a new terminal:
```
ipconfig
```
Look for the adapter that's actually connected (has a "Default Gateway"
line filled in — usually "Ethernet adapter Ethernet" or your Wi-Fi
adapter). Note its `IPv4 Address`, e.g. `192.168.1.178`.

Your API base URL for the rest of this guide is:
```
http://<that IP>:<PORT from .env>
```
Example: `http://192.168.1.178:5000`

### 5. Mobile app

```
cd cleanlife-mobile
npm install
npm start
```
This regenerates `.env.local` with your current LAN IP automatically on
every `npm start` — you don't need to hardcode it. Scan the printed QR
code with Expo Go on your phone (same Wi-Fi network as this computer).

If the app doesn't reload after a code change: press `r` in this
terminal, or fully close and reopen Expo Go on the phone (rescanning the
QR code alone does not reload the JS bundle).

### 6. Company Admin Portal (given to each company by the super admin)

No install step — plain HTML/JS. Open `cleanlife-admin-portal/index.html`
directly in a browser, or serve it:
```
cd cleanlife-admin-portal
npx serve .
```
Log in with the username/password a super admin created for that company
(see step 7).

### 7. Super Admin Portal (platform owner only)

Open `cleanlife-super-admin-portal/index.html` directly in a browser, or:
```
cd cleanlife-super-admin-portal
npx serve .
```
Log in with the credentials from step 2. From here:
- **Companies tab** → add a company (name, referral code, subscription tier).
- Click **"Create admin account"** next to a company → set a username and
  password for that company's admin. The credentials are shown once in an
  alert box — copy them immediately and send to that company. This is how
  they get access to the Company Admin Portal (step 6).

## Day-to-day: after pulling new changes

```
cd cleanlife-backend
npm install
npm run migrate
npm run check
npm start
```
`npm install` only needed if `package.json` changed. `npm run migrate`
only applies migrations not yet run — safe to run every time, does
nothing if nothing's new.

For mobile:
```
cd cleanlife-mobile
npm install
npm start
```

## Common problems

**Backend won't start: `EACCES: permission denied` on a port.**
Windows/Hyper-V reserves certain port ranges. Check:
```
netsh interface ipv4 show excludedportrange protocol=tcp
```
Pick a `PORT` value in `.env` that falls outside every listed range (e.g.
`4000` is usually free). Match it in `cleanlife-mobile/.env` as
`EXPO_PUBLIC_API_PORT` if you set one there, otherwise the mobile
`prestart` script picks up `.env` automatically.

**Backend crashes with a JS syntax error mentioning `<` or JSX.**
A React Native file's content got pasted into a backend `.js` file by
mistake (has happened during merges). Run `npm run check` — it points to
the exact file. Restore that file's real backend content.

**Login/register error `[404] route not found`.**
Mobile app is calling a route that doesn't exist on the backend anymore
(e.g. after a merge dropped or renamed it). Check `cleanlife-backend/app.js`
for the actual mounted routes, and check `cleanlife-mobile/src/apiClient.ts`
calls match them exactly.

**Git says "unmerged paths" / can't commit.**
Open the conflicted file(s), search for `<<<<<<<`, `=======`, `>>>>>>>` —
resolve manually, delete all marker lines, save. Then:
```
git add <file>
git status
```
Repeat until "All conflicts fixed" shows, then `git commit`.

**Proof-of-work always fails with "not within 100m of an authorized dumpster".**
No dumpster coordinates exist in the database yet — migrations don't seed
any. For local testing, set in `.env`:
```
AUTO_VERIFY_GPS_PROOF=true
```
(default is already `true` unless explicitly set to `false`) — this
bypasses the real geofence check entirely. **Must be set to `false` before
any real deployment or demo that needs genuine location verification.**
To test the real check, add a dumpster near your test coordinates via the
Super/Company Admin Portal's dumpster tools, or:
```
curl -X POST http://<ip>:<port>/admin/dumpsters -H "X-Admin-Key: <ADMIN_API_KEY from .env>" -H "Content-Type: application/json" -d "{\"latitude\": <lat>, \"longitude\": <lng>, \"bin_code\": \"BIN-TEST-001\"}"
```

**Corporate collector gets `[409] request already claimed, not available
to you, or does not exist` when accepting a job.**
Confirm the pickup request is still `searching_corporate` and not already
escalated to `broadcast_public`:
```sql
SELECT id, routing_status, admin_hold_expires_at, now() FROM pickup_requests ORDER BY id DESC LIMIT 1;
```
If `admin_hold_expires_at` looks wrong (already in the past right after
creation), confirm migration `029_fix_timestamp_timezone.sql` has been
applied (`npm run migrate`) — this was a real timezone bug, fixed there.

## Component-level docs

- `cleanlife-backend/README.md` — backend-specific setup/commands detail.
- `cleanlife-admin-portal/README.md`, if present — company portal notes.
- SRS document (in project files) — full functional/non-functional
  requirements this system implements.

## Task ownership (current sprint)

| # | Task | Owner |
|---|------|-------|
| 1 | Company referral code registration | EL SHADDAÏ |
| 2 | Independent client registration, multi-tenant isolation | EL SHADDAÏ |
| 3 | Collector self-registration | PRIDE |
| 4 | Corporate collector registration | PRIDE |
| 5 | Role-based authentication | Megane |
| 6 | JWT authentication | Megane |
| 7 | Email/Phone verification | Nuella |
| 8 | Password reset | Nuella |
| 9 | Profile management | Christmavie |
| 10 | Company portal | Christmavie |
```
