// Payment & Sweepstakes Gateway Service
// Supports live Stripe and Chime configurations as well as instant sandbox testing.

const STORAGE_KEYS = {
  STRIPE_KEY: 'dc_stripe_api_key',
  CHIME_KEY: 'dc_chime_api_key',
  CHIME_HANDLE: 'dc_chime_user_handle',
  TX_HISTORY: 'dc_payment_transactions',
};

export const paymentService = {
  // Publishable keys come ONLY from build-time env (never from player-editable localStorage).
  getKeys() {
    return {
      stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
    };
  },

  getTransactionHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TX_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  logTransaction(tx) {
    const list = this.getTransactionHistory();
    const entry = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      status: 'completed',
      ...tx,
    };
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(list.slice(0, 50)));
    return entry;
  },

  // Purchases and redemptions are intentionally NOT handled in the browser.
  // They must go through the server (Stripe Checkout + webhook, redemption queue),
  // otherwise any player could credit themselves coins or fake payout requests.
  async processPurchase() {
    throw new Error('Purchases are temporarily paused while secure checkout is being set up.');
  },

  async processRedemption() {
    throw new Error('Redemptions are temporarily paused while the secure redemption system is being set up.');
  },
};
