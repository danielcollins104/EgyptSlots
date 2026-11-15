// ============================================================================
// CASH APP PROCESSOR — SECONDARY DEPOSIT RAIL (P2P $Cashtag + Order Reference)
// ============================================================================
// Cash App has no public merchant API, so deposits use a unique per-order
// reference code. The player sends the exact USD amount to the operator
// $Cashtag with the reference in the note; the claim creates a reconcilable
// order in the admin queue. Keep volume low — Cash App ToS restricts
// gambling-adjacent flows. Crypto is the core rail.
// ============================================================================

import { CASHTAG_HANDLE, getCashAppPaymentLink } from '../../config/sweepstakesConfig.js';

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L

export function generateCashAppOrderRef() {
  let ref = 'EGY-';
  const rand = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 6; i++) rand[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 6; i++) ref += REF_ALPHABET[rand[i] % REF_ALPHABET.length];
  return ref;
}

export const cashAppProcessor = {
  meta: {
    id: 'cashapp',
    label: 'Cash App Pay',
    shortLabel: 'Cash App',
    badge: '+5% FREE SC',
    bonusScPct: 5,
    subtitle: `Instant P2P transfer to ${CASHTAG_HANDLE} — include your order code (+5% Extra SC)`,
    enabled: true,
  },

  getDepositInstructions(pkg, context = {}) {
    const priceUsd = Number(pkg?.priceUsd) || 0;
    const orderRef = context.orderRef || generateCashAppOrderRef();
    const directUrl = getCashAppPaymentLink(priceUsd, orderRef);
    return {
      processorId: 'cashapp',
      cashtag: CASHTAG_HANDLE,
      priceUsd,
      orderRef,
      directUrl,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(directUrl)}`,
      steps: [
        `Send exactly $${priceUsd.toFixed(2)} to ${CASHTAG_HANDLE}`,
        `CRITICAL: put "${orderRef}" in the Cash App note/memo field`,
        'Tap "I\u2019ve Sent It" below so we can match & credit your order',
      ],
    };
  },

  /**
   * No automated verification is possible without Cash App's merchant API.
   * Returns a "manual reconciliation" result — the UI credits instantly and
   * queues the order for operator reconciliation (same trust model as before,
   * now with a real order reference attached).
   */
  async verifyDeposit(instructions) {
    return {
      verified: false,
      requiresManualReconciliation: true,
      orderRef: instructions?.orderRef || '',
      statusText: 'Cash App transfers are confirmed by our cashier team using your order code — usually under 5 minutes.',
    };
  },

  getPayoutInstructions(redemption = {}) {
    const dest = redemption.destination || '';
    return {
      title: 'Send Cash App P2P payout',
      lines: [
        `Send $${Number(redemption.amountUsd || 0).toFixed(2)} to: ${dest}`,
        'Use "For:" note format: PRIZE <redemption id>',
        'Screenshot the completed payment as the receipt.',
      ],
    };
  },
};
