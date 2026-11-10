# Admin Payout Center — Server-Side Authentication

The Operator Payout Center (Ctrl+Shift+A or `#admin` hash) is gated by real
server-side authentication. The operator key **never ships in the client bundle** —
it exists only on the server.

## How it works

1. Client submits the operator key to `POST /api/admin/login`.
2. Server compares it against `DC_ADMIN_SECRET` using a constant-time
   comparison, then issues a high-entropy (256-bit) session token valid for
   **4 hours**.
3. The token is kept in `sessionStorage` only (tab-scoped, never persisted to
   disk) and re-validated with `GET /api/admin/verify` every time the panel opens.
4. Payout endpoints require the token:
   - `GET /api/redemptions` — payout queue (contains player PII)
   - `POST /api/redemptions/update` — approve / reject (moves real money)
5. **Brute-force protection**: 5 failed admin logins locks the console for
   15 minutes. **Fail closed**: if the admin API is unreachable, the Payout
   Center stays locked — there is no offline override.

## Setup

Choose a long random key (32+ characters), e.g.:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Local Node server (`npm run server`, port 3001)

```bash
# Windows (cmd)
set DC_ADMIN_SECRET=your-long-random-key && npm run server

# Windows (PowerShell)
$env:DC_ADMIN_SECRET="your-long-random-key"; npm run server

# macOS / Linux
DC_ADMIN_SECRET=your-long-random-key npm run server
```

### Vite dev server (`npm run dev`)

The dev server mounts the same API router in-process, so set the variable
before starting:

```bash
set DC_ADMIN_SECRET=your-long-random-key && npm run dev
```

### Production (Cloudflare Worker — oopsiwon.com)

```bash
npx wrangler secret put DC_ADMIN_SECRET
```

Then deploy with `npm run deploy`.

## If DC_ADMIN_SECRET is not set

Admin login is **disabled entirely** (fail closed) and the server responds with
"Admin access is disabled: DC_ADMIN_SECRET is not configured on the server."
The player-facing game is unaffected.

## Rotating the key

Set a new `DC_ADMIN_SECRET` and restart / redeploy. All existing admin sessions
remain valid until their 4-hour expiry; to force immediate invalidation, restart
the server (sessions are held in memory).
