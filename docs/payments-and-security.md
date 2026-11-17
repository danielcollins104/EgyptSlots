# Payments, Redemptions & Security — Implementation Report

Status date: 2026-11-16. Companion to the Phase 1 audit (kept in the project conversation artifacts).

## 1. What changed (architecture)

```
browser (React/Pixi)  ──HTTPS/JSON, Bearer session──▶  server/apiRouter.js  (validation, authz, rate limits, CORS)
                                                          │
                                  server/finance/  ───────┤  Accounts · PaymentService · CryptoGateway
                                                          │  RedemptionService · SpinService · AdminService
                                                          ▼
                                       SQLite (node:sqlite, WAL, BEGIN IMMEDIATE)  — append-only ledger + audit log
```

* `server/finance/db.js` – schema + atomic `tx()`; all money code is synchronous inside a transaction (network I/O happens before/after).
* `server/finance/ledger.js` – integer minor units (GC int, SC cents), per-bucket (AVAILABLE/HOLD) before/after balances, unique idempotency key per entry, HMAC hash chain, `reconcile()` (Σledger = wallet), immutable via DB triggers. `AuditLog` is a second hash chain for staff/security events.
* `accounts.js` – scrypt passwords, hashed server-side sessions, RBAC (PLAYER/SUPPORT/FINANCE/ADMIN), password step-up for sensitive actions, age/state/KYC/self-exclusion gates, free daily AMOE claim.
* `payments.js` + `providers.js` – server-priced intents, idempotent creation, provider interface, signature-verified + deduplicated + independently re-verified webhooks, refund/dispute clawback.
* `crypto.js` – self-hosted receive-only USDC/USDT gateway (no keys in the app) + on-chain payout verification.
* `redemptions.js` – the redemption state machine (pending → under_review → approved → processing → completed / rejected / failed / cancelled).
* `spin.js` – server-authoritative base-game spin, per-player commit/reveal seeds.
* `admin.js` – staff operations; every mutation audited.
* `server/apiRouter.js` rewritten; `server/server.js` hardened (body cap, CSP with exact inline-script hashes, HSTS in prod, path-traversal guard); `server/worker.js` now serves **static assets only** and fails closed for `/api/*`.
* Client: `src/components/CashierModal.jsx` (store, payment status, redemption center, history, free daily entry, self-exclusion) and `AdminFinanceConsole.jsx` replace the old `PaymentModal`/`AdminPayoutCenter` in `App.jsx`; both talk only to the API through `src/services/cashierApi.js`.

## 2. Vulnerabilities

### Found (see Phase 1 audit for detail)
Client-authoritative game & balances · demo forced-win buttons live in SC mode · unauthenticated redemption/order/seed-rotate endpoints · session minting for any `userId` + free coins per id · hard-coded ledger/spin secrets · server spin never paid wins (`totalPayout` typo) and trusted client bet · personal-`$Cashtag` P2P + user-pasted tx hashes · single shared admin secret, uncapped balance minting · in-memory state on Workers · open CORS, no rate limits · weak ledger (no idempotency, not DB-enforced).

### Fixed (implemented **and** covered by tests in `scripts/test-finance.js`)
| Issue | Fix |
|---|---|
| Unauthenticated money endpoints, guest/userId session minting | Removed; every route authenticated, role-gated; unknown legacy paths 404 (tested) |
| Hard-coded secrets | `DC_LEDGER_SECRET` required in production (boot fails otherwise); dev-only defaults labelled non-secret |
| Client-side wallet | Server wallet + ledger; no route can set a balance; client fields (`win`, `grid`, `balance`, `forcedMode`…) ignored (tested) |
| Double credit / replay | Unique idempotency keys at ledger, intent, webhook-event, spin and redemption level; `UNIQUE(chain_id,tx_hash,log_index)` for chain transfers |
| Race conditions / overdraft | `BEGIN IMMEDIATE` + optimistic wallet version + `CHECK (>= 0)`; **worker-thread race test**: 4 connections × 8 debits on 10 SC → exactly 10 succeed |
| Webhook forgery | HMAC verification (timing-safe, timestamp tolerance), raw-body signing, dedupe, independent provider re-fetch, amount match |
| Fake crypto proof | No endpoint accepts a tx hash; server scans chain logs at confirmation depth, re-checks receipt, chain id, contract, recipient, exact unique amount, expiry |
| Underpay/overpay/late/unknown | Parked as `unmatched` for admin review; underpay can never be credited |
| Payout fraud | KYC gate, play-through, min/max, daily + count velocity, one active request, cooled-down EIP-55-validated destinations (password step-up to add), risk flags → review, dual control above threshold, no self-approval, payout tx verified on-chain (treasury→destination, exact token & amount, confirmations), tx-hash reuse blocked, failure recovery releases reserve |
| Admin abuse | DB-backed staff accounts (CLI-created only), 2h sessions, step-up, ADMIN-only capped adjustments as new ledger rows, immutable hash-chained audit log, no self-targeted actions |
| Demo forced wins | Disabled in SC mode and in production builds unless `VITE_ENABLE_DEMO_FORCED_OUTCOMES=true` (GC only) |
| Brute force | Per-(email,IP) and per-IP persisted lockouts; generic errors; uniform timing |
| CORS/CSRF/XSS/SQLi | Origin allow-list, Bearer tokens (no cookie ⇒ no CSRF surface), JSON-only + content-type enforcement, parameterised SQL everywhere, strict CSP, `nosniff`, no HTML output |
| Worker data loss | Worker fails closed for money routes |
| Broken test gates | Repaired `test-all-aspects.js` (syntax error from Stripe removal), `test-security-audit.js`, rewrote `test-api-router.js` |

### Remaining / NOT fixed
1. **The shipped game loop (`App.jsx`) is still client-authoritative.** Spins, free spins, cascades, bonus vault/wheel and local GC/SC balances still run in the browser against `localStorage`. The server wallet is independent: coins bought/earned on the server are not yet spendable in the Pixi game, and client-side SC is **not redeemable** (only server-ledger SC is). Porting the bonus features into `SpinService` and driving the UI from server results is the largest remaining task. Until then keep `DC_SC_PLAY_ENABLED=false` and do not advertise redemption.
2. **RTP discrepancy.** The repo's own simulator (`node src/engine/math/simulate.js`) reports **≈19.6 % base-game RTP**, while the UI and docs advertise "90.0 % certified RTP". Either the missing return comes from features not in the base evaluator, or the claim is wrong. I did not alter odds. This must be reconciled and certified (e.g. by an independent lab) before SC play is enabled; advertising an uncertified RTP is a consumer-protection risk. Server spins currently reproduce the base evaluator exactly (expanding-wild override and features are not ported).
3. Single-node SQLite (no HA; use Postgres + managed backups for scale; the `Db` wrapper is the only seam to change). In-memory rate limiter (use an edge/WAF limiter for multi-instance).
4. No TOTP/WebAuthn MFA for staff (password step-up only). No email verification / password reset flow. KYC is a manual staff flag; integrate an IDV vendor (Persona, Veriff, …) for production.
5. No sanctions/OFAC or blockchain-analytics screening of payout addresses; no 1099/W-9 workflow.
6. Seed-reveal fairness is per player and verifiable, but there is no third-party RNG certification (GLI-19-style) — the previous "complies with GLI-19" comment was not a certification.
7. Legacy files (`server/SecurityServer.js`, `server/engine/*`, `server/auth/*`, `server/ledger/*`, old `PaymentModal`, `AdminPayoutCenter`, `src/payments/*`, `cryptoVerifierService`, personal `$Cashtag`/wallet constants in `sweepstakesConfig.js`) are **unused by production routes** but still in the repo/tests. Delete after sign-off. The Cash App `$Cashtag` P2P rail is gone from the UI and has no server path.
8. `npm audit` reports 3 moderate advisories in dev dependencies (not reviewed).
9. No automated browser/UI tests for the new modals (build-verified only).

## 3. Payment & payout integrations — status

| Capability | Status |
|---|---|
| Ledger, wallets, idempotent purchases, webhook engine, refunds/chargebacks | **Fully implemented and tested** (sandbox provider, signed webhooks) |
| Self-hosted USDC/USDT receive gateway (Base, Polygon, Ethereum) | **Implemented and tested against a mock chain** — not tested on a live RPC; needs `DC_RPC_*`, treasury address, and a real-network dry run with tiny amounts |
| Crypto payout (admin-approved, externally signed, on-chain verified) | **Implemented and tested** (mock chain); the signing/sending step is deliberately outside the app (HSM/multisig/Fireblocks-type signer) |
| Square (Cash App Pay + card) | **Implemented, tested only with mocked HTTP; awaiting provider credentials AND written approval.** Square's seller policies restrict gambling-type businesses; do not enable without approval. The client does not yet load the Square Web Payments SDK (the UI shows the pending state only). |
| Bitcoin / Solana deposits & payouts | **Not implemented** (needs xpub address derivation + UTXO/SPL tracking) — use a licensed processor if required |
| Cash App payouts | **Not implemented** — no official business payout API for this category; personal-$Cashtag transfers are prohibited by design |
| Gift-card / debit / ACH payouts (old config entries) | **Not implemented**; only `crypto` is enabled in `DC_REDEMPTION_METHODS` |
| Skrill / Apple-Google Pay stubs (`src/payments`) | Unchanged stubs, not wired |

## 4. Database

Schema is created idempotently by `Db` (`server/finance/db.js`); tables: `users, sessions, auth_throttle, wallets, ledger*, audit_log*, payment_intents, payment_events*, crypto_intents, crypto_transfers, chain_cursors, payout_destinations, redemptions, redemption_events*, seeds, spins*, promo_claims` (`*` = append-only via triggers). Permissions: the DB file is created `0600`; run the server as a dedicated OS user; no DB credentials exist in client bundles. There is no Supabase/RLS in this project — the equivalent controls are: all DB access only through server code, parameterised queries, role checks in the API, triggers for immutability, `CHECK` constraints for non-negative balances. Migrations are additive `CREATE ... IF NOT EXISTS`; introduce a versioned migration runner before the first schema change.

## 5. Environment variables
See `.env.example` (all server-side; never `VITE_`-prefixed). Required in production: `DC_LEDGER_SECRET`, `DC_CORS_ORIGINS` (if API on another origin), `DC_DB_PATH`. Optional: provider keys (`SQUARE_*`), crypto (`DC_CRYPTO_NETWORKS`, `DC_CRYPTO_TREASURY_ADDRESS`, `DC_RPC_*`), policy knobs (`DC_REDEEM_*`, `DC_BLOCKED_STATES`, …), `DC_SC_PLAY_ENABLED`. Client-only: `VITE_API_BASE` (split hosting), `VITE_ENABLE_DEMO_FORCED_OUTCOMES`.

## 6. Deployment
1. `npm ci && npm run build` (also syncs Android/iOS via `cap sync`; Electron consumes `dist/`).
2. Provision a persistent volume; `export NODE_ENV=production DC_LEDGER_SECRET=$(openssl rand -hex 32) DC_DB_PATH=/var/lib/casino/casino.db DC_CORS_ORIGINS=...`.
3. Create staff: `DC_STAFF_PASSWORD='…14+ chars…' npm run admin:create -- you@co.com ADMIN "Name"` (never over HTTP).
4. `npm run server` behind TLS (set `DC_TRUST_PROXY=true` only behind a trusted proxy). Back up the DB + secret separately; `GET /api/admin/reconciliation` must stay `ok:true`.
5. Cloudflare: the Worker serves static files only; host the Node API separately and set `VITE_API_BASE` + CORS origin.
6. Payments go live only after: provider approval in writing, sandbox end-to-end run, counsel sign-off (below), and a small real-money dry run you explicitly authorise. No real payments or payouts were made during development.

## 7. Legal / provider approvals outstanding (flagged, not resolved)
* **Minnesota:** AG cease-and-desist letters to dual-currency sweepstakes operators (2025-11-05); AGE position since June 2025; SF 4474 (explicit ban, reaching processors) passed the Senate and died in the House 2026-05-18. MN is blocked by default. Obtain a written legal opinion before serving MN or any other contested state; the default blocked-state list is provisional.
* **Sweepstakes mechanics:** published Official Rules, genuine AMOE (daily claim implemented; mail-in must be operated), "no purchase necessary" disclosures, and package economics review — current packages grant SC ≥ the USD price (e.g. $4.99 → 5.00 SC), which regulators may treat as purchasing SC.
* **Provider policies:** Square/Cash App, card processors and any crypto custodian must expressly approve this business model; no descriptor changes, personal accounts or re-routing to avoid restrictions.
* **AML/MSB:** receiving and paying out crypto prizes may require FinCEN MSB registration/state licences; KYC/OFAC programme; 1099-MISC/W-9 reporting for prizes ≥ $600; privacy policy/CCPA & data-retention for KYC data; age verification beyond self-declared DOB.

## 8. Tests
`npm run test:finance` (48), `npm run test:all` (256), `npm run test:bonuses` (185), `node scripts/test-security-audit.js`, `npm run test:api` — all passing at time of writing. `test-finance.js` covers: successful/failed purchases, duplicate webhooks, invalid/stale signatures, unauthorised wallet modification & staff routes, duplicate redemptions, insufficient balance, DB-level race (worker threads), simultaneous wagers, spin manipulation (tampered bets/outcomes, replay), invalid payout destinations, dual control, ledger/audit immutability & tamper detection, reconciliation, crypto confirmation/replay/under/over/late/reverted/wrong-chain, SQLi-style inputs, CORS, rate limits, error-leak checks.
