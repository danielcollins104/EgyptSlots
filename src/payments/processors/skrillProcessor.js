// ============================================================================
// SKRILL PROCESSOR — E-WALLET RAIL (READY TO ENABLE)
// ============================================================================
// Stub implementing the full processor contract. To go live:
//   1. Set enabled: true below
//   2. Fill SKRILL_CONFIG with your Skrill Merchant account credentials
//      (Merchant ID, email, MD5 secret) from your Skrill business account
//   3. Point the deposit form at Skrill's "Quick Checkout" endpoint
//      (https://pay.skrill.com) or integrate the Skrill Wallet Checkout SDK
//   4. Handle the status-URL callback server-side (add /api/skrill/status
//      next to the orders routes in server/apiRouter.js)
// Skrill explicitly supports gaming/social-casino merchants, which makes it
// the right long-term card + wallet rail for this product.
// ============================================================================

const SKRILL_CONFIG = {
  enabled: false,
  merchantId: '',       // e.g. '123456789'
  merchantEmail: '',    // Skrill account email
  md5Secret: '',        // Skrill MD5 secret word
  statusUrl: '/api/skrill/status',
  currency: 'USD',
};

export const skrillProcessor = {
  meta: {
    id: 'skrill',
    label: 'Skrill E-Wallet',
    shortLabel: 'Skrill',
    badge: 'INSTANT',
    bonusScPct: 0,
    subtitle: 'Visa / Mastercard via Skrill — instant e-wallet deposits',
    enabled: SKRILL_CONFIG.enabled,
  },

  getDepositInstructions(pkg) {
    // When enabled, build Skrill Quick Checkout redirect fields:
    //   pay_to_email, transaction_id (our order ref), amount, currency,
    //   status_url, return_url — signed with the MD5 secret.
    // Until then this never runs (registry blocks disabled processors).
    return {
      processorId: 'skrill',
      amountUsd: Number(pkg?.priceUsd) || 0,
      checkoutEndpoint: 'https://pay.skrill.com',
      config: SKRILL_CONFIG,
    };
  },

  async verifyDeposit() {
    // Verification happens via Skrill's server-to-server status callback,
    // which must be implemented in server/apiRouter.js when enabled.
    return { verified: false, statusText: 'Awaiting Skrill status callback.' };
  },

  getPayoutInstructions(redemption = {}) {
    return {
      title: 'Send Skrill payout',
      lines: [
        `Send $${Number(redemption.amountUsd || 0).toFixed(2)} to Skrill: ${redemption.destination || ''}`,
        'Skrill P2P transfers settle instantly — paste the transaction ID as receipt.',
      ],
    };
  },
};
