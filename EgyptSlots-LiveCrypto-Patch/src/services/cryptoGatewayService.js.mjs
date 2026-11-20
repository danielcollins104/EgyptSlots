// ============================================================================
// LIVE CRYPTO GATEWAY — CLIENT SERVICE
// ============================================================================
// Thin fetch wrapper over the server endpoints added in apiRouter v3.1:
//   POST /api/crypto/invoice          -> live deposit invoice
//   GET  /api/crypto/invoice-status   -> cashier polling
//   POST /api/crypto/payout-request   -> validated crypto payout order
//   GET  /api/crypto/payouts          -> operator queue (ADMIN)
//   POST /api/crypto/payouts/process  -> auto-send / manual txHash (ADMIN)
// Falls back gracefully to the self-custody on-chain rail when the gateway
// is not configured (server returns 503) — the player experience never breaks.
// ============================================================================

async function postJson(path, payload, authToken = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload || {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const cryptoGatewayService = {
  /** True when the server has a gateway API key configured */
  async isConfigured() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data?.cryptoGateway?.configured);
    } catch {
      return false;
    }
  },

  /**
   * Creates a live deposit invoice for a package.
   * Returns { ok, invoice, order, error, gatewayUnavailable }.
   */
  async createInvoice({ packageId, customAmountUsd = null, userId = 'guest', payCurrency = 'usdt' } = {}) {
    try {
      const { ok, status, data } = await postJson('/api/crypto/invoice', {
        packageId,
        customAmountUsd,
        userId,
        payCurrency,
      });
      if (status === 503) {
        return { ok: false, gatewayUnavailable: true, error: data?.error || 'Gateway not configured' };
      }
      if (!ok || !data?.success) {
        return { ok: false, error: data?.error || 'Unable to create invoice' };
      }
      return { ok: true, invoice: data.invoice, order: data.order };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  },

  /** Polls one invoice. Terminal success statuses from the gateway: finished / confirmed. */
  async getInvoiceStatus(paymentId) {
    try {
      const res = await fetch(`/api/crypto/invoice-status?paymentId=${encodeURIComponent(paymentId)}`);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: data?.status || 'unknown', raw: data };
    } catch {
      return { ok: false, status: 'error' };
    }
  },

  /**
   * Submits a validated crypto payout order to the server queue.
   * redemptionId lets the server dedupe retries (idempotent per id).
   */
  async requestPayout({ redemptionId = '', userId = 'guest', amountSC, currency, address } = {}) {
    try {
      const { ok, data } = await postJson('/api/crypto/payout-request', {
        redemptionId,
        userId,
        amountSC,
        currency,
        address,
      });
      if (!ok || !data?.success) {
        return { ok: false, error: data?.error || 'Payout request rejected' };
      }
      return { ok: true, payout: data.payout, alreadyQueued: data.alreadyQueued };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  },

  /** Operator queue (ADMIN token required) */
  async getPayoutQueue(authToken) {
    try {
      const res = await fetch('/api/crypto/payouts', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, payouts: data?.payouts || [] };
    } catch {
      return { ok: false, payouts: [] };
    }
  },

  /**
   * ADMIN: mode 'auto' sends via the gateway (idempotent per payout id),
   * mode 'manual' records the operator's on-chain tx hash as the receipt.
   */
  async processPayout(payoutId, { mode = 'manual', txHash = '', authToken } = {}) {
    const { ok, data } = await postJson(
      '/api/crypto/payouts/process',
      { payoutId, mode, txHash },
      authToken
    );
    return { ok, ...data };
  },
};
