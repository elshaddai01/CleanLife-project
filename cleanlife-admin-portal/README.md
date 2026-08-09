# CleanLife Company Portal (interim)

Static HTML/JS, no build step. Auth is the same `X-Admin-Key` header used
elsewhere in the backend — this is a temporary measure until a real admin
identity model exists (see Task 10 blocker notes).

## Run

Open `index.html` directly in a browser, or serve statically:

    npx serve .

On the login screen, enter:
- API base URL — e.g. `http://192.168.1.10:4000` (your backend's LAN IP + port)
- Admin key — value of `ADMIN_API_KEY` from `cleanlife-backend/.env`
- Company ID — the numeric `id` of the company to manage (check `/admin/companies`)

## Known limitation

Any browser with the admin key can act as any company by changing the
Company ID field — no per-company admin accounts exist yet. Do not expose
this key outside trusted staff.