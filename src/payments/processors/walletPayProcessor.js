// ============================================================================
// GOOGLE PAY / APPLE PAY PROCESSOR — WALLET RAIL (READY TO ENABLE)
// ============================================================================
// Stub for card-wallet express checkout. Apple Pay / Google Pay tokens must
// be processed by a PSP — the natural pairing here is Skrill (or another
// gaming-approved acquirer) in wallet-pay mode.
//
// To go live:
//   1. Enable the Skrill rail first (it is the PSP behind this rail)
//   2. Set enabled: true below
//   3. In the checkout UI, request the wallet payment token via the
//      Payment Request API (Google Pay) / Apple Pay JS, then pass the token
//      to the PSP's wallet endpoint exactly like a card transaction
//   4. Keep PAN entry out of this app entirely — the PSP-hosted flow
//      handles card data so this codebase stays out of PCI scope
// ============================================================================

export const walletPayProcessor = {
  meta: {
    id: 'walletpay',
    label: 'Apple Pay / Google Pay',
    shortLabel: '\uF8FFPay / GPay',
    badge: '1-TAP',
    bonusScPct: 0,
    subtitle: 'Express wallet checkout — powered by our Skrill gateway (coming soon)',
    enabled: false,
  },

  getDepositInstructions(pkg) {
    // When enabled: initiate the Payment Request / Apple Pay session, then
    // hand the wallet token to the PSP (Skrill) wallet endpoint.
    return {
      processorId: 'walletpay',
      amountUsd: Number(pkg?.priceUsd) || 0,
    };
  },

  async verifyDeposit() {
    return { verified: false, statusText: 'Awaiting wallet payment authorization.' };
  },

  getPayoutInstructions() {
    // Wallet rails are deposit-only; payouts go out via crypto / Cash App.
    return null;
  },
};
