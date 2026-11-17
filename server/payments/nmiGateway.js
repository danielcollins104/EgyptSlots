// ============================================================================
// NMI CARD GATEWAY (server-side) — credit/debit card purchases, no Stripe
// ============================================================================
// Flow (PCI SAQ-A): the browser loads NMI Collect.js with the PUBLIC
// tokenization key; card number/CVV are typed into NMI-hosted iframes and
// exchanged for a one-time `payment_token`. Only that token reaches our server,
// which charges it via the Payment API using the SECRET security key.
//
// Required secrets (set with `wrangler secret put`):
//   NMI_SECURITY_KEY      — private API key (never sent to the browser)
//   NMI_TOKENIZATION_KEY  — public Collect.js key (safe to expose)
// Optional: NMI_API_BASE (defaults to https://secure.nmi.com). Many high-risk
// ISOs white-label NMI on their own domain — set it to their gateway URL.
// The rail is automatically DISABLED until both keys are present.
// ============================================================================

export class NmiGateway {
  constructor({ env = {}, fetchImpl } = {}) {
    this.securityKey = env.NMI_SECURITY_KEY || null;
    this.tokenizationKey = env.NMI_TOKENIZATION_KEY || null;
    this.apiBase = String(env.NMI_API_BASE || 'https://secure.nmi.com').replace(/\/+$/, '');
    this.fetch = fetchImpl || ((...a) => fetch(...a));
  }

  get enabled() {
    return Boolean(this.securityKey && this.tokenizationKey);
  }

  publicConfig() {
    return {
      enabled: this.enabled,
      tokenizationKey: this.enabled ? this.tokenizationKey : null,
      collectJsUrl: `${this.apiBase}/token/Collect.js`,
    };
  }

  static _form(obj) {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  /**
   * Charge a Collect.js payment token.
   * @returns {Promise<{status:'approved'|'declined'|'error'|'unknown', transactionId?, authCode?, responseText, avs?, cvv?, raw?}>}
   *  'unknown' = network failure/timeout: the charge MAY have gone through. Never credit,
   *  never auto-retry — reconcile with queryByOrderId().
   */
  async sale({ amountUsd, paymentToken, orderId, billing = {}, ipAddress, email }) {
    if (!this.enabled) throw new Error('Card payments are not enabled yet.');
    if (!paymentToken) throw new Error('Missing card payment token.');
    const body = NmiGateway._form({
      security_key: this.securityKey,
      type: 'sale',
      amount: Number(amountUsd).toFixed(2),
      currency: 'USD',
      payment_token: paymentToken,
      orderid: orderId,
      order_description: 'Gold Coin package',
      first_name: billing.firstName,
      last_name: billing.lastName,
      address1: billing.address1,
      city: billing.city,
      state: billing.state,
      zip: billing.zip,
      country: billing.country || 'US',
      email,
      ipaddress: ipAddress,
    });
    let text;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await this.fetch(`${this.apiBase}/api/transact.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });
        text = await res.text();
        if (!res.ok) return { status: 'unknown', responseText: `Gateway HTTP ${res.status}` };
      } finally {
        clearTimeout(t);
      }
    } catch (err) {
      return { status: 'unknown', responseText: `Gateway unreachable: ${err.message}` };
    }
    const p = new URLSearchParams(text);
    const code = p.get('response');
    const out = {
      transactionId: p.get('transactionid') || null,
      authCode: p.get('authcode') || null,
      responseText: p.get('responsetext') || '',
      responseCode: p.get('response_code') || null,
      avs: p.get('avsresponse') || null,
      cvv: p.get('cvvresponse') || null,
    };
    if (code === '1') return { status: 'approved', ...out };
    if (code === '2') return { status: 'declined', ...out };
    if (code === '3') return { status: 'error', ...out };
    return { status: 'unknown', ...out };
  }

  /** Reconcile an 'unknown' charge by our order id via the Query API */
  async queryByOrderId(orderId) {
    if (!this.enabled) throw new Error('Card payments are not enabled.');
    const res = await this.fetch(`${this.apiBase}/api/query.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: NmiGateway._form({ security_key: this.securityKey, order_id: orderId }),
    });
    const xml = await res.text();
    const txBlocks = xml.match(/<transaction>[\s\S]*?<\/transaction>/g) || [];
    for (const block of txBlocks) {
      const get = (tag) => (block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`)) || [])[1] || null;
      const condition = get('condition');
      const transactionId = get('transaction_id');
      // Look for a successful sale action inside this transaction
      const saleOk = /<action>[\s\S]*?<action_type>sale<\/action_type>[\s\S]*?<success>1<\/success>[\s\S]*?<\/action>/.test(block);
      if (saleOk && condition !== 'failed' && condition !== 'canceled') {
        return { status: 'approved', transactionId, condition };
      }
    }
    return { status: txBlocks.length ? 'declined' : 'not_found' };
  }

  async refund(transactionId, amountUsd) {
    if (!this.enabled) throw new Error('Card payments are not enabled.');
    const res = await this.fetch(`${this.apiBase}/api/transact.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: NmiGateway._form({
        security_key: this.securityKey,
        type: 'refund',
        transactionid: transactionId,
        amount: amountUsd ? Number(amountUsd).toFixed(2) : undefined,
      }),
    });
    const p = new URLSearchParams(await res.text());
    return { ok: p.get('response') === '1', responseText: p.get('responsetext') || '' };
  }
}
