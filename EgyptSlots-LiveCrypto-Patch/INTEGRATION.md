# EgyptSlots — Live Crypto Gateway Patch (v3.1.0)

Adds **live crypto deposits AND payouts** on top of the existing zero-Stripe
cashier. Built NOWPayments-compatible, so any processor with the same API shape
(BTCPay adapter, custom gateway) works by changing `CRYPTO_GATEWAY_BASE_URL`.

## What ships in this patch

| File | Action |
|---|---|
| `server/cryptoGateway.js` | **NEW** — gateway client: invoices, HMAC-IPN verify, payouts, address validators |
| `server/apiRouter.js` | **REPLACE** — v3.1.0: adds 6 live-crypto endpoints, keeps every existing route byte-identical |
| `src/services/cryptoGatewayService.js` | **NEW** — client fetch wrapper (graceful 503 fallback to self-custody rail) |
| `src/components/CryptoGatewayDeposit.jsx` | **NEW** — "⚡ Instant Crypto Checkout" deposit panel |
| `src/components/CryptoPayoutConsole.jsx` | **NEW** — operator payout console (auto-send + manual tx) |
| `src/polish/egyptPolish.css` | **NEW** — visual polish layer (additive) |
| `src/polish/egyptPerf.js` | **NEW** — runtime smoothness layer (additive) |

## 1. Apply the code

```powershell
# from the patch folder, pointed at your local clone:
.\apply-and-push.ps1 -RepoPath "C:\Users\danie\.gemini\antigravity\scratch\EgyptSlots" -Push
```

## 2. Server environment variables (set where the API runs — NOT in the client bundle)

```bash
CRYPTO_GATEWAY_API_KEY=your_nowpayments_api_key
CRYPTO_GATEWAY_IPN_SECRET=your_ipn_secret          # required to accept IPNs
CRYPTO_GATEWAY_BASE_URL=https://api.nowpayments.io/v1   # optional override
CRYPTO_GATEWAY_PAYOUTS_ENABLED=true                 # arms ⚡ Auto-send payouts
```

## 3. Mount the components (3 one-time hooks)

**A. Deposit panel** — `src/components/PaymentModal.jsx`, inside the crypto rail
(the `{showCryptoBox && (` block, right after the static deposit-address box):

```jsx
import CryptoGatewayDeposit from './CryptoGatewayDeposit.jsx';

<CryptoGatewayDeposit
  pkg={effectivePkg}
  userId={(authService.getCurrentUser() || {}).id || 'guest'}
  onPurchaseSuccess={(pkg) => {
    paymentService.recordPurchase({
      packageId: pkg.id, amountUsd: pkg.priceUsd,
      goldCoins: pkg.goldCoins, freeSweepsCoins: pkg.freeSweepsCoins,
      sweepsCoins: pkg.freeSweepsCoins,
      method: 'crypto_gateway', sessionId: `gateway_${Date.now()}`,
      status: 'completed',
    });
    onPurchaseSuccess && onPurchaseSuccess(pkg);
  }}
/>
```

**B. Player payout request** — in `handleRedeemSubmit` (PaymentModal.jsx), inside
`if (res.success)` for `redeemMethod === 'crypto'`, before the success message:

```js
cryptoGatewayService.requestPayout({
  redemptionId: res.redemptionId,
  userId: (authService.getCurrentUser() || {}).id || 'guest',
  amountSC: amount,
  currency: redeemCryptoAsset,
  address: res.entry?.destination || redeemDestination,
}).catch(() => {});
```

**C. Operator console** — `src/components/AdminPayoutCenter.jsx`, next to the
existing payout queue:

```jsx
import CryptoPayoutConsole from './CryptoPayoutConsole.jsx';
// render:
<CryptoPayoutConsole />
```

## 4. Wire the IPN webhook (in your gateway dashboard)

Point the payment IPN to: `https://<your-api-host>/api/crypto/gateway-ipn`
and the payout IPN to the same URL. The server verifies the HMAC-SHA512
signature on `x-nowpayments-sig` against `CRYPTO_GATEWAY_IPN_SECRET` and
rejects anything unsigned.

## 5. How the money actually moves now

- **Deposit (gateway)**: player pays the invoice address → gateway IPN fires →
  server finds the order by `order_id` → `confirmDepositOrder` credits the
  server wallet → **idempotent** (repeated IPNs return `alreadyConfirmed`).
- **Deposit (self-custody, existing)**: unchanged — on-chain verify rail keeps working.
- **Payout**: player redemption → server validates address + min 50 SC →
  queued `processing` → operator clicks **⚡ Auto-send** (gateway, idempotency
  key = payout id) or pastes a manual TX → `completed`. IPN for the withdrawal
  also flips it to `completed` automatically.

## 6. Verification checklist (after apply)

```bash
node --check server/apiRouter.js && node --check server/cryptoGateway.js
npm run test:all            # existing 219-test suite must stay green
curl localhost:8787/api/health   # expect version 3.1.0-live-crypto-gateway
```

Then in the cashier: crypto rail should show the ⚡ panel (it self-hides when
no API key is set — the old rail still works).

## Follow-ups (not in this patch)

- Live exchange-rate feed for the self-custody rail's static BTC/ETH/SOL
  multipliers (they drift; gateway rail prices in USD so it's unaffected).
- Skrill MD5 callback mode (endpoint reserved at `/api/payments/status`).
