import crypto from 'node:crypto';

/**
 * Payment provider adapters.
 *
 * Contract:
 *   id, label, methods[]
 *   createSession({intent}) -> { providerRef|null, clientAction }
 *   parseWebhook({rawBody, headers}) -> normalized event (throws on bad signature)
 *   verifyPayment?(event) -> async independent confirmation straight from the provider API
 *
 * Normalized event: { eventId, type: 'payment.succeeded'|'payment.failed'|'payment.refunded'|'payment.disputed',
 *                     providerRef, intentId?, amountUsdCents?, currency }
 *
 * Nothing here ever credits a wallet: only PaymentService does, and only for verified events.
 */

export class WebhookSignatureError extends Error {}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Development/CI provider. Signed webhooks only; hard-disabled in production. */
export function sandboxProvider(config) {
  const secret = config.providers.sandboxWebhookSecret;
  return {
    id: 'sandbox',
    label: 'Sandbox (development only)',
    methods: ['sandbox'],
    createSession({ intent }) {
      return { providerRef: `sbx_${crypto.randomBytes(10).toString('hex')}`, clientAction: { type: 'sandbox', note: `Awaiting signed webhook for intent ${intent.id}` } };
    },
    parseWebhook({ rawBody, headers }) {
      const sig = String(headers['x-sandbox-signature'] || '');
      const t = /(?:^|,)t=(\d+)/.exec(sig)?.[1];
      const v1 = /(?:^|,)v1=([0-9a-f]+)/.exec(sig)?.[1];
      if (!secret || !t || !v1) throw new WebhookSignatureError('Missing or malformed signature');
      if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new WebhookSignatureError('Signature timestamp outside tolerance');
      const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
      if (!safeEq(expected, v1)) throw new WebhookSignatureError('Signature mismatch');
      const b = JSON.parse(rawBody);
      return { eventId: String(b.id), type: b.type, providerRef: b.providerRef, amountUsdCents: b.amountUsdCents, currency: 'USD' };
    },
  };
}

/** Helper for tests / local tooling to produce a valid sandbox signature. */
export function signSandboxWebhook(secret, rawBody, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

/**
 * Square (Cash App Pay + cards) adapter.
 * STATUS: implemented against Square's documented API but NOT validated against a live/sandbox
 * Square account (no credentials in this environment). Square's seller policies restrict gambling-type
 * businesses - do not enable without written approval for the sweepstakes model.
 */
export function squareProvider(config, fetchImpl = globalThis.fetch) {
  const c = config.providers.square;
  const base = c.environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const headers = () => ({
    Authorization: `Bearer ${c.accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': c.apiVersion || '2024-10-17',
  });
  return {
    id: 'square',
    label: 'Cash App Pay / Card (Square)',
    methods: ['card', 'applepay', 'googlepay', 'cashapp'],
    configured: Boolean(c.accessToken && c.applicationId && c.locationId && c.webhookSignatureKey && c.webhookUrl),
    createSession({ intent }) {
      return {
        providerRef: null,
        clientAction: { type: 'square_web_payments', applicationId: c.applicationId, locationId: c.locationId, referenceId: intent.id, environment: c.environment },
      };
    },
    /** Server-side charge using a single-use source token from the Square Web Payments SDK. */
    async charge({ intent, sourceId }) {
      const res = await fetchImpl(`${base}/v2/payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key: intent.id,
          amount_money: { amount: intent.amount_usd_cents, currency: 'USD' }, // amount comes from OUR db, never the client
          location_id: c.locationId,
          reference_id: intent.id,
          autocomplete: true,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.payment?.id) throw new Error('Provider declined or errored');
      return { providerRef: body.payment.id };
    },
    parseWebhook({ rawBody, headers: h }) {
      const sig = String(h['x-square-signature'] || '');
      if (!c.webhookSignatureKey || !c.webhookUrl || !sig) throw new WebhookSignatureError('Missing signature configuration');
      const expected = crypto.createHmac('sha256', c.webhookSignatureKey).update(c.webhookUrl + rawBody).digest('base64');
      if (!safeEq(expected, sig)) throw new WebhookSignatureError('Signature mismatch');
      const b = JSON.parse(rawBody);
      const obj = b.data?.object || {};
      const eventId = String(b.event_id);
      if (b.type === 'payment.updated' || b.type === 'payment.created') {
        const p = obj.payment || {};
        const type = p.status === 'COMPLETED' ? 'payment.succeeded' : ['FAILED', 'CANCELED'].includes(p.status) ? 'payment.failed' : null;
        if (!type) return { eventId, type: 'ignored', providerRef: p.id, currency: 'USD' };
        return { eventId, type, providerRef: p.id, intentId: p.reference_id, amountUsdCents: p.amount_money?.amount, currency: p.amount_money?.currency };
      }
      if (b.type === 'refund.updated' && obj.refund?.status === 'COMPLETED') {
        return { eventId, type: 'payment.refunded', providerRef: obj.refund.payment_id, currency: 'USD' };
      }
      if (b.type === 'dispute.created' || b.type === 'dispute.state.updated') {
        return { eventId, type: 'payment.disputed', providerRef: obj.dispute?.disputed_payment?.payment_id, currency: 'USD' };
      }
      return { eventId, type: 'ignored', providerRef: null, currency: 'USD' };
    },
    /** Independent confirmation: re-fetch the payment from Square before crediting. */
    async verifyPayment(event) {
      if (event.type !== 'payment.succeeded') return { ok: true };
      const res = await fetchImpl(`${base}/v2/payments/${encodeURIComponent(event.providerRef)}`, { headers: headers() });
      const body = await res.json();
      const p = body.payment;
      return {
        ok: res.ok && p?.status === 'COMPLETED' && p.amount_money?.currency === 'USD',
        amountUsdCents: p?.amount_money?.amount,
        intentId: p?.reference_id,
      };
    },
  };
}
