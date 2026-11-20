// ============================================================================
// LIVE CRYPTO GATEWAY — NOWPayments-compatible processor API client
// ============================================================================
// Server-side only. NEVER import this file from client code — it reads secret
// keys from environment variables:
//
//   CRYPTO_GATEWAY_API_KEY       — processor API key (invoices + payouts)
//   CRYPTO_GATEWAY_IPN_SECRET    — IPN callback HMAC secret
//   CRYPTO_GATEWAY_BASE_URL      — default https://api.nowpayments.io/v1
//   CRYPTO_GATEWAY_PAYOUTS_ENABLED — 'true' to arm automated crypto payouts
//
// All mutating calls are idempotent from the caller's perspective: the API
// router keys every credit by payment_id / withdrawal_id / txHash so retries
// and IPN redeliveries can never double-credit a player.
// ============================================================================

const BASE_URL = (typeof process !== 'undefined' && process.env?.CRYPTO_GATEWAY_BASE_URL) ||
  'https://api.nowpayments.io/v1';
const API_KEY = (typeof process !== 'undefined' && process.env?.CRYPTO_GATEWAY_API_KEY) || '';
const IPN_SECRET = (typeof process !== 'undefined' && process.env?.CRYPTO_GATEWAY_IPN_SECRET) || '';
const PAYOUTS_ENABLED =
  (typeof process !== 'undefined' && String(process.env?.CRYPTO_GATEWAY_PAYOUTS_ENABLED || '').toLowerCase() === 'true');

function env() {
  return { configured: Boolean(API_KEY), payoutsEnabled: PAYOUTS_ENABLED && Boolean(API_KEY) };
}

// ----------------------------------------------------------------------------
// Address validation per currency (used by /api/crypto/payout-request)
// ----------------------------------------------------------------------------
const ADDRESS_RULES = {
  BTC: /^(bc1[a-z0-9]{25,60}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  ETH: /^(0x[a-fA-F0-9]{40})$/,
  USDT_ERC20: /^(0x[a-fA-F0-9]{40})$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  USDT_SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};

export function isValidCryptoAddress(currency, address) {
  const rule = ADDRESS_RULES[String(currency || '').toUpperCase()];
  if (!rule) return false;
  return rule.test(String(address || '').trim());
}

// ----------------------------------------------------------------------------
// NOWPayments-style sorted-JSON IPN signature (HMAC-SHA512, timing-safe)
// ----------------------------------------------------------------------------
function sortedStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedStringify(value[k])}`).join(',')}}`;
}

function timingSafeEqualHex(a, b) {
  const crypto = require('node:crypto');
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verifies an IPN webhook. Returns the parsed event on success, throws on
 * bad signature / missing secret. `rawBody` must be the exact request body
 * string (worker passes it through untouched).
 */
export function verifyGatewayIpn(rawBody, signatureHeader) {
  if (!IPN_SECRET) {
    throw new Error('CRYPTO_GATEWAY_IPN_SECRET is not configured — refusing unsigned IPN');
  }
  const sig = String(signatureHeader || '').trim().toLowerCase();
  if (!sig) throw new Error('Missing gateway signature header');
  const crypto = require('node:crypto');
  const expected = crypto.createHmac('sha512', IPN_SECRET).update(String(rawBody), 'utf8').digest('hex');
  if (!timingSafeEqualHex(expected, sig)) {
    throw new Error('Gateway IPN signature verification failed');
  }
  return JSON.parse(String(rawBody));
}

// ----------------------------------------------------------------------------
// Low-level API helper
// ----------------------------------------------------------------------------
async function gatewayRequest(path, { method = 'GET', body = null, headers = {} } = {}) {
  if (!API_KEY) throw new Error('CRYPTO_GATEWAY_API_KEY is not configured');
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gateway ${method} ${path} failed: HTTP ${res.status} — ${data?.message || 'unknown error'}`);
  }
  return data;
}

/**
 * Creates a live deposit invoice for a package. Returns everything the
 * cashier needs to render a QR / deep link. `orderRef` is our internal
 * order id — it round-trips through the IPN as `order_id`.
 */
export async function createDepositInvoice({ priceUsd, packageId, orderRef, payCurrency = 'usdt', userId, ipnUrl = '' }) {
  const data = await gatewayRequest('/payment', {
    method: 'POST',
    body: {
      price_amount: Number(priceUsd),
      price_currency: 'usd',
      pay_currency: String(payCurrency).toLowerCase(),
      order_id: String(orderRef),
      order_description: `EgyptSlots GC pack ${packageId} — player ${userId}`,
      ipn_callback_url: ipnUrl,
    },
  });
  return {
    paymentId: data.payment_id,
    orderRef: String(orderRef),
    payAddress: data.pay_address,
    payAmount: data.pay_amount,
    payCurrency: data.pay_currency,
    status: data.payment_status,
    expiresAt: data.expiration_estimate_date || null,
    raw: data,
  };
}

/** Live status of one invoice (for cashier polling) */
export async function getInvoiceStatus(paymentId) {
  const data = await gatewayRequest(`/payment/${encodeURIComponent(paymentId)}`);
  return { paymentId: data.payment_id, status: data.payment_status, actuallyPaid: data.actually_paid };
}

/**
 * Sends an automated crypto payout. `idempotencyKey` MUST be our redemption
 * id — retries reuse it so a redemption can never be paid twice.
 */
export async function createPayout({ address, currency, amountUsd, idempotencyKey, ipnUrl = '' }) {
  const data = await gatewayRequest('/payout', {
    method: 'POST',
    headers: { 'x-idempotency-key': String(idempotencyKey) },
    body: {
      withdrawals: [
        {
          address: String(address),
          currency: String(currency).toLowerCase(),
          amount: Number(amountUsd),
          ipn_callback_url: ipnUrl,
        },
      ],
    },
  });
  const w = Array.isArray(data) ? data[0] : data;
  return {
    withdrawalId: w.id || w.withdrawal_id,
    status: w.status || 'processing',
    raw: w,
  };
}

export const cryptoGateway = { env, createDepositInvoice, getInvoiceStatus, createPayout, verifyGatewayIpn };
