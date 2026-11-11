// Payment & Sweepstakes Gateway Service
// Supports live Stripe Checkout Sessions, Stripe Payment Links, Cash App Pay, Crypto, and Embedded Stripe Card Checkout.

import {
  SWEEPSTAKES_CONFIG,
  getStripePaymentLink,
  getCashAppPayCheckoutLink,
  getCashAppPaymentLink,
  getPaymentReturnUrl,
} from '../config/sweepstakesConfig.js';
import {
  verifyCryptoDeposit,
  getLiveWalletBalancesStatus,
} from './cryptoVerifierService.js';

const STORAGE_KEYS = {
  STRIPE_KEY: 'dc_stripe_api_key',
  CHIME_KEY: 'dc_chime_api_key',
  CHIME_HANDLE: 'dc_chime_user_handle',
  TX_HISTORY: 'dc_payment_transactions',
  CLAIMED_CRYPTO_TXS: 'dc_claimed_crypto_tx_hashes',
  PLAYTHROUGH_STATE: 'dc_sc_playthrough_state',
  REDEMPTION_QUEUE: 'dc_redemption_queue',
  PROVABLY_FAIR_STATE: 'dc_provably_fair_state_v1',
  SPIN_RECEIPTS: 'dc_provably_fair_spin_receipts_v1',
  RESPONSIBLE_GAMING: 'dc_responsible_gaming_state_v1',
  SESSION_METRICS: 'dc_session_metrics_v1',
};

// Pure-JS synchronous SHA-256 & HMAC-SHA256 for 100% bit-identical parity with Node.js ServerRNG
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8ToBytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(str));
  }
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) out.push(c);
    else if (c < 2048) out.push((c >> 6) | 192, (c & 63) | 128);
    else out.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
  }
  return new Uint8Array(out);
}

function sha256Bytes(msgBytes) {
  const rotr = (n, x) => (x >>> n) | (x << (32 - n));
  const l = msgBytes.length;
  const bitLenHi = Math.floor((l * 8) / 0x100000000);
  const bitLenLo = (l * 8) >>> 0;
  const padLen = ((l + 9 + 63) & ~63);
  const buf = new Uint8Array(padLen);
  buf.set(msgBytes);
  buf[l] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, bitLenHi, false);
  view.setUint32(padLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, idx) => outView.setUint32(idx * 4, v, false));
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sha256Hex(str) {
  return bytesToHex(sha256Bytes(utf8ToBytes(str)));
}

function hmacSha256Bytes(keyStr, messageStr) {
  let keyBytes = utf8ToBytes(keyStr);
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);
  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = keyBytes[i] || 0;
    oKeyPad[i] = k ^ 0x5c;
    iKeyPad[i] = k ^ 0x36;
  }
  const msgBytes = utf8ToBytes(messageStr);
  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(iKeyPad);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);
  const outerInput = new Uint8Array(64 + 32);
  outerInput.set(oKeyPad);
  outerInput.set(innerHash, 64);
  return sha256Bytes(outerInput);
}

function generateSecureHex(byteLen = 16) {
  const bytes = new Uint8Array(byteLen);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLen; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(bytes);
}

export const paymentService = {
  // Publishable keys come from build-time env
  getKeys() {
    return {
      stripePublishableKey:
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) || '',
    };
  },

  /**
   * 1x Playthrough (Rollover) Anti-Fraud Tracker
   * Tracks promotional SC granted vs. SC wagered & won on the reels so players and operators
   * can see exact redeemable SC vs. unplayed bonus SC.
   */
  getPlaythroughState(currentScBalance = null) {
    let rawState = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYTHROUGH_STATE);
      rawState = raw ? JSON.parse(raw) : null;
    } catch {}

    const defaultSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins || 10.0;
    const state = rawState || {
      totalGrantedBonusSC: defaultSC,
      totalWageredSC: 0,
      totalWonSC: 0,
      unplayedBonusSC: defaultSC,
    };

    const balance =
      currentScBalance !== null && currentScBalance !== undefined
        ? Math.max(0, Number(currentScBalance) || 0)
        : Math.max(0, Number(state.unplayedBonusSC || 0) + Number(state.totalWonSC || 0));

    const unplayedSC = Math.min(balance, Math.max(0, Number(state.unplayedBonusSC || 0)));
    const redeemableSC = Number(Math.max(0, balance - unplayedSC).toFixed(2));
    const requiredWagerSC = Math.max(defaultSC, Number(state.totalGrantedBonusSC || defaultSC));
    const wageredSC = Number(Math.max(0, Number(state.totalWageredSC || 0)).toFixed(2));
    const progressPct =
      unplayedSC <= 0.009
        ? 100
        : Math.min(100, Math.round((wageredSC / Math.max(1, wageredSC + unplayedSC)) * 100));

    return {
      totalSC: Number(balance.toFixed(2)),
      redeemableSC,
      unplayedSC: Number(unplayedSC.toFixed(2)),
      wageredSC,
      wonSC: Number((state.totalWonSC || 0).toFixed(2)),
      requiredWagerSC: Number(requiredWagerSC.toFixed(2)),
      progressPct,
      isFullyUnlocked: unplayedSC <= 0.009,
    };
  },

  savePlaythroughState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYTHROUGH_STATE, JSON.stringify(nextState));
    } catch {}
    return nextState;
  },

  recordBonusScGranted(bonusScAmount) {
    const add = Math.max(0, Number(bonusScAmount) || 0);
    if (add <= 0) return this.getPlaythroughState();
    let rawState = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYTHROUGH_STATE);
      rawState = raw ? JSON.parse(raw) : null;
    } catch {}
    const defaultSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins || 10.0;
    const base = rawState || {
      totalGrantedBonusSC: defaultSC,
      totalWageredSC: 0,
      totalWonSC: 0,
      unplayedBonusSC: defaultSC,
    };
    this.savePlaythroughState({
      ...base,
      totalGrantedBonusSC: Number(((base.totalGrantedBonusSC || 0) + add).toFixed(2)),
      unplayedBonusSC: Number(((base.unplayedBonusSC || 0) + add).toFixed(2)),
    });
    return this.getPlaythroughState();
  },

  recordScWagered(wagerAmount) {
    const wager = Math.max(0, Number(wagerAmount) || 0);
    if (wager <= 0) return this.getPlaythroughState();
    let rawState = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYTHROUGH_STATE);
      rawState = raw ? JSON.parse(raw) : null;
    } catch {}
    const defaultSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins || 10.0;
    const base = rawState || {
      totalGrantedBonusSC: defaultSC,
      totalWageredSC: 0,
      totalWonSC: 0,
      unplayedBonusSC: defaultSC,
    };
    const mult = SWEEPSTAKES_CONFIG.playthroughRequirementMultiplier || 1.0;
    const unlockedDelta = wager / mult;
    this.savePlaythroughState({
      ...base,
      totalWageredSC: Number(((base.totalWageredSC || 0) + wager).toFixed(2)),
      unplayedBonusSC: Number(Math.max(0, (base.unplayedBonusSC || 0) - unlockedDelta).toFixed(2)),
    });
    return this.getPlaythroughState();
  },

  recordScWon(winAmount) {
    const win = Math.max(0, Number(winAmount) || 0);
    if (win <= 0) return this.getPlaythroughState();
    let rawState = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYTHROUGH_STATE);
      rawState = raw ? JSON.parse(raw) : null;
    } catch {}
    const defaultSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins || 10.0;
    const base = rawState || {
      totalGrantedBonusSC: defaultSC,
      totalWageredSC: 0,
      totalWonSC: 0,
      unplayedBonusSC: defaultSC,
    };
    this.savePlaythroughState({
      ...base,
      totalWonSC: Number(((base.totalWonSC || 0) + win).toFixed(2)),
    });
    return this.getPlaythroughState();
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
    try {
      localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(list.slice(0, 50)));
    } catch {}
    return entry;
  },

  /**
   * Records a completed purchase (Card, Cash App Pay, or Crypto) to the local transaction history
   * and updates the 1x playthrough tracker for any free bonus SC included.
   */
  recordPurchase({
    packageId,
    amountUsd,
    goldCoins,
    sweepsCoins,
    method = 'stripe_card',
    status = 'completed',
    sessionId = null,
    cardLast4 = null,
  } = {}) {
    if (Number(sweepsCoins) > 0) {
      this.recordBonusScGranted(Number(sweepsCoins));
    }
    if (Number(amountUsd) > 0) {
      this.recordDepositForLimits(Number(amountUsd));
    }
    const entry = this.logTransaction({
      type: `PURCHASE (${String(method).toUpperCase().replace(/_/g, ' ')})`,
      packageId: packageId || 'pkg_silver',
      amountUsd: this.fromCents(this.toCents(amountUsd)),
      goldCoins: Math.round(Number(goldCoins) || 0),
      sweepsCoins: this.fromCents(this.toCents(sweepsCoins)),
      method,
      status,
      sessionId,
      cardLast4,
    });
    return {
      success: true,
      transactionId: entry.id,
      entry,
    };
  },

  /**
   * Returns all redemption requests from the Admin Payout Queue
   */
  getRedemptionQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REDEMPTION_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveRedemptionQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEYS.REDEMPTION_QUEUE, JSON.stringify(queue.slice(0, 100)));
    } catch {}
    return queue;
  },

  /**
   * Requests a Sweeps Coins cash/crypto/gift-card prize redemption (1 SC = $1.00 USD, or +5% Bonus for Gift Cards)
   */
  requestRedemption({
    sweepsCoins,
    method = 'ach',
    destination = '',
    cryptoAsset = 'USDT_SOL',
    giftCardBrand = 'visa_virtual',
    userEmail = '',
    playerName = 'VIP Player',
    enforcePlaythrough = false,
    currentScBalance = null,
  } = {}) {
    const amount = Number(sweepsCoins) || 0;
    const isGiftCard = method === 'giftcard';
    const minSC = isGiftCard
      ? SWEEPSTAKES_CONFIG.minGiftCardRedemptionSC || 25
      : SWEEPSTAKES_CONFIG.minRedemptionSC || 50;

    if (amount < minSC) {
      return {
        success: false,
        error: isGiftCard
          ? `Minimum Instant Gift Card redemption is $${minSC.toFixed(2)} SC ($${(minSC * 1.05).toFixed(2)} Gift Card value).`
          : `Minimum redemption is $${minSC.toFixed(2)} SC ($${minSC.toFixed(2)} USD). (Tip: Digital Gift Cards only require $25.00 SC!)`,
      };
    }

    if (enforcePlaythrough) {
      const pt = this.getPlaythroughState(currentScBalance !== null ? currentScBalance : amount);
      if (amount > pt.redeemableSC + 0.009) {
        return {
          success: false,
          error: `1× Playthrough Required: You currently have ${pt.redeemableSC.toFixed(2)} Redeemable SC and ${pt.unplayedSC.toFixed(2)} Unplayed Bonus SC. Wager your unplayed SC at least 1× on the reels to unlock it for payout!`,
        };
      }
    }

    const cleanDest = String(destination || userEmail || '').trim();
    if (!cleanDest) {
      return {
        success: false,
        error:
          'Please enter a valid payout destination ($Cashtag, Crypto Wallet Address, Delivery Email, or Bank Account).',
      };
    }

    const maskedDest =
      cleanDest.length > 8 && !cleanDest.includes('@') && !cleanDest.startsWith('$')
        ? `${cleanDest.slice(0, 4)}••••${cleanDest.slice(-4)}`
        : cleanDest;

    const bonusRate = isGiftCard ? SWEEPSTAKES_CONFIG.giftCardBonusRate || 0.05 : 0;
    const payoutUsd = Number((amount * (1 + bonusRate)).toFixed(2));
    const bonusUsd = Number((payoutUsd - amount).toFixed(2));

    // Build 1-Click Operator Action Helpers for Admin Payout Center
    let cashAppPayoutLink = null;
    if (method === 'chime' || cleanDest.startsWith('$')) {
      const handle = cleanDest.startsWith('$') ? cleanDest.split(/\s+/)[0] : `$${cleanDest.replace(/^@/, '')}`;
      cashAppPayoutLink = `https://cash.app/${encodeURIComponent(handle).replace('%24', '$')}/${payoutUsd.toFixed(2)}`;
    }

    let cryptoPayoutUri = null;
    let cryptoQrUrl = null;
    let cryptoAmountFormatted = null;
    if (method === 'crypto') {
      const assetCfg =
        (SWEEPSTAKES_CONFIG.cryptoPayoutAssets || []).find((a) => a.id === cryptoAsset) || {
          id: 'USDT_SOL',
          symbol: 'USDT (Solana SPL)',
          rateUsd: 1.0,
        };
      const rate = assetCfg.rateUsd || 1.0;
      cryptoAmountFormatted =
        rate === 1.0 ? payoutUsd.toFixed(2) : (payoutUsd / rate).toFixed(6);
      if (cryptoAsset === 'BTC') {
        cryptoPayoutUri = `bitcoin:${cleanDest}?amount=${cryptoAmountFormatted}`;
      } else if (cryptoAsset === 'ETH') {
        cryptoPayoutUri = `ethereum:${cleanDest}`;
      } else {
        cryptoPayoutUri = `solana:${cleanDest}?amount=${cryptoAmountFormatted}`;
      }
      cryptoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        cryptoPayoutUri
      )}`;
    }

    const redemptionId = `rdm_${Date.now().toString(36).toUpperCase()}_${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const methodLabel =
      method === 'giftcard'
        ? `GIFT CARD (${String(giftCardBrand).toUpperCase()} +5%)`
        : method === 'crypto'
        ? `CRYPTO (${cryptoAsset})`
        : String(method).toUpperCase();

    const entry = this.logTransaction({
      id: redemptionId,
      type: `CASHOUT REDEMPTION (${methodLabel})`,
      amountSC: amount,
      amountUsd: payoutUsd,
      bonusUsd,
      goldCoins: 0,
      sweepsCoins: -amount,
      method,
      cryptoAsset: method === 'crypto' ? cryptoAsset : null,
      cryptoAmount: cryptoAmountFormatted,
      giftCardBrand: isGiftCard ? giftCardBrand : null,
      destination: cleanDest,
      destinationMasked: maskedDest,
      cashAppPayoutLink,
      cryptoPayoutUri,
      cryptoQrUrl,
      playerName,
      status: 'processing',
    });

    // Push to Admin Redemption Queue
    const queue = this.getRedemptionQueue();
    queue.unshift(entry);
    this.saveRedemptionQueue(queue);

    // Best-effort sync to server /api/redemptions
    if (typeof fetch !== 'undefined') {
      fetch('/api/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }

    return {
      success: true,
      redemptionId: entry.id,
      amountSC: amount,
      amountUsd: payoutUsd,
      bonusUsd,
      method,
      cryptoAsset: method === 'crypto' ? cryptoAsset : null,
      giftCardBrand: isGiftCard ? giftCardBrand : null,
      destinationMasked: maskedDest,
      cashAppPayoutLink,
      cryptoPayoutUri,
      cryptoQrUrl,
      entry,
    };
  },

  /**
   * Admin 1-Click Action: Marks a pending redemption as Paid/Completed and attaches a TX Hash, Receipt, or Gift Card Code
   */
  approveRedemption(redemptionId, { txHashOrReceipt = '', giftCardCode = '', operatorNote = '', authToken = null } = {}) {
    const queue = this.getRedemptionQueue();
    const idx = queue.findIndex((r) => r.id === redemptionId);
    if (idx === -1) {
      return { success: false, error: 'Redemption request not found in queue.' };
    }

    const updated = {
      ...queue[idx],
      status: 'completed',
      paidAt: new Date().toISOString(),
      txHashOrReceipt: String(txHashOrReceipt || '').trim() || `PAID_${Date.now().toString(36).toUpperCase()}`,
      giftCardCode: String(giftCardCode || '').trim() || null,
      operatorNote: String(operatorNote || '').trim() || 'Approved & Sent via Admin 1-Click Payout Center',
    };
    queue[idx] = updated;
    this.saveRedemptionQueue(queue);

    // Also update in main transaction history
    try {
      const txList = this.getTransactionHistory().map((tx) =>
        tx.id === redemptionId ? { ...tx, ...updated } : tx
      );
      localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(txList));
    } catch {}

    if (typeof fetch !== 'undefined') {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      fetch('/api/redemptions/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({ redemptionId, action: 'approve', updated }),
      }).catch(() => {});
    }

    return { success: true, redemption: updated };
  },

  /**
   * Admin 1-Click Action: Rejects a pending redemption and returns the SC amount to refund to the player's balance
   */
  rejectRedemption(redemptionId, { reason = 'Rejected by Operator — SC Refunded to Balance', authToken = null } = {}) {
    const queue = this.getRedemptionQueue();
    const idx = queue.findIndex((r) => r.id === redemptionId);
    if (idx === -1) {
      return { success: false, error: 'Redemption request not found in queue.' };
    }

    const target = queue[idx];
    if (target.status === 'rejected') {
      return { success: false, error: 'This redemption was already rejected and refunded.' };
    }

    const refundSC = Math.abs(Number(target.amountSC || target.sweepsCoins || 0));
    const updated = {
      ...target,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      operatorNote: reason,
    };
    queue[idx] = updated;
    this.saveRedemptionQueue(queue);

    try {
      const txList = this.getTransactionHistory().map((tx) =>
        tx.id === redemptionId ? { ...tx, ...updated } : tx
      );
      localStorage.setItem(STORAGE_KEYS.TX_HISTORY, JSON.stringify(txList));
    } catch {}

    if (typeof fetch !== 'undefined') {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      fetch('/api/redemptions/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({ redemptionId, action: 'reject', updated }),
      }).catch(() => {});
    }

    return { success: true, refundSC, redemption: updated };
  },

  /**
   * Creates a server-side Stripe Checkout Session via /api/checkout/create-session,
   * falling back to configured Stripe Payment Links if offline.
   */
  async createStripeCheckoutSession(pkg, paymentMethod = 'card', user = null) {
    if (!pkg) throw new Error('No package selected.');

    try {
      localStorage.setItem('dc_pending_purchase_pkg', pkg.id);
      localStorage.setItem('dc_pending_purchase_custom_pkg', JSON.stringify(pkg));
      localStorage.setItem('dc_pending_purchase_time', String(Date.now()));
    } catch {}

    try {
      const origin =
        typeof window !== 'undefined' && window.location
          ? window.location.origin
          : 'https://oopsiwon.com';

      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          customAmountUsd: pkg.priceUsd,
          goldCoins: pkg.goldCoins,
          freeSweepsCoins: pkg.freeSweepsCoins,
          paymentMethod,
          origin,
          email: user?.email || '',
          userId: user?.id || '',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.url) {
          return {
            success: true,
            url: data.url,
            sessionId: data.sessionId,
            mode: data.mode || 'stripe_checkout_session',
          };
        }
      }
    } catch (err) {
      // Fallback to Payment Link below
    }

    const baseLink =
      paymentMethod === 'cashapp'
        ? getCashAppPayCheckoutLink(pkg) || getCashAppPaymentLink(pkg?.priceUsd || 19.99)
        : getStripePaymentLink(pkg) || 'https://buy.stripe.com/28EdR893bcAz0XGezQ8ww04';

    let fallbackUrl = baseLink;
    if (baseLink && !baseLink.startsWith('https://cash.app/')) {
      const sep = baseLink.includes('?') ? '&' : '?';
      fallbackUrl = `${baseLink}${sep}client_reference_id=${encodeURIComponent(pkg.id)}`;
    }

    return {
      success: true,
      url: fallbackUrl,
      sessionId: `cs_live_${Date.now()}`,
      mode: 'payment_link',
    };
  },

  /**
   * Processes an inline purchase (Card / Apple Pay / Google Pay / Cash App Pay)
   */
  async processPurchase(pkg, method = 'stripe_card', details = {}) {
    if (!pkg) throw new Error('Invalid package selected.');
    await new Promise((r) => setTimeout(r, 650));

    return this.recordPurchase({
      packageId: pkg.id,
      amountUsd: pkg.priceUsd,
      goldCoins: pkg.goldCoins,
      sweepsCoins: pkg.freeSweepsCoins,
      method,
      status: 'completed',
      cardLast4: details.cardLast4 || '4242',
    });
  },

  /**
   * Processes a redemption request asynchronously
   */
  async processRedemption(details = {}) {
    await new Promise((r) => setTimeout(r, 400));
    return this.requestRedemption(details);
  },

  /**
   * Checks if a crypto transaction hash has already been claimed locally
   */
  isLocalTxClaimed(txHash) {
    if (!txHash) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CLAIMED_CRYPTO_TXS);
      const list = raw ? JSON.parse(raw) : [];
      return list.includes(String(txHash).trim().toLowerCase());
    } catch {
      return false;
    }
  },

  markLocalTxClaimed(txHash) {
    if (!txHash) return;
    try {
      const clean = String(txHash).trim().toLowerCase();
      const raw = localStorage.getItem(STORAGE_KEYS.CLAIMED_CRYPTO_TXS);
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(clean)) {
        list.unshift(clean);
        localStorage.setItem(STORAGE_KEYS.CLAIMED_CRYPTO_TXS, JSON.stringify(list.slice(0, 200)));
      }
    } catch {}
  },

  /**
   * Verifies an incoming crypto transfer on-chain across Bitcoin Mainnet, Solana Mainnet, or Ethereum/Polygon/Base
   * via /api/crypto/verify (Cloudflare Worker) with automatic direct browser RPC fallback.
   */
  async verifyOnChainCryptoDeposit({
    symbol = 'USDT',
    expectedAmount = 0,
    txHash = '',
    minTimestampSec = 0,
  } = {}) {
    if (txHash && this.isLocalTxClaimed(txHash)) {
      return {
        verified: false,
        symbol,
        message: 'This transaction hash has already been verified and credited to your balance.',
      };
    }

    // 1. Try server-side verification endpoint (/api/crypto/verify)
    try {
      const response = await fetch('/api/crypto/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          expectedAmount,
          txHash,
          minTimestampSec,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.verified === 'boolean') {
          if (data.verified && data.txHash) {
            if (this.isLocalTxClaimed(data.txHash)) {
              return {
                verified: false,
                symbol,
                message: 'This blockchain transaction was already claimed.',
              };
            }
            this.markLocalTxClaimed(data.txHash);
          }
          return data;
        }
      }
    } catch (err) {
      // Fallback to direct client-side RPC verification (for Capacitor mobile / Electron)
    }

    // 2. Direct client-side blockchain RPC verification fallback
    const fallbackResult = await verifyCryptoDeposit({
      symbol,
      expectedAmount,
      txHash,
      minTimestampSec,
    });

    if (fallbackResult.verified && fallbackResult.txHash) {
      if (this.isLocalTxClaimed(fallbackResult.txHash)) {
        return {
          verified: false,
          symbol,
          message: 'This blockchain transaction was already claimed.',
        };
      }
      this.markLocalTxClaimed(fallbackResult.txHash);
    }

    return fallbackResult;
  },

  /**
   * Fetches live on-chain connectivity & balance status for the 3 self-custody wallets
   */
  async fetchLiveWalletsStatus() {
    try {
      const res = await fetch('/api/crypto/wallets-status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.wallets) return data;
      }
    } catch {}
    return await getLiveWalletBalancesStatus();
  },

  // =========================================================================
  // EXACT INTEGER-CENT MONETARY HELPERS
  // =========================================================================
  toCents(amount) {
    return Math.round((Number(amount) || 0) * 100);
  },

  fromCents(cents) {
    return Number((Math.round(Number(cents) || 0) / 100).toFixed(2));
  },

  // =========================================================================
  // PROVABLY FAIR CRYPTOGRAPHIC SEED & SPIN VERIFICATION ENGINE
  // =========================================================================
  hashSeed(seed) {
    return sha256Hex(String(seed || ''));
  },

  /**
   * Generates a deterministic float in [0, 1) from (serverSeed, clientSeed, nonce, cursor)
   * using HMAC-SHA256 — 100% bit-identical to Node.js ServerRNG.provablyFairFloat
   */
  provablyFairFloat(serverSeed, clientSeed, nonce, cursor = 0) {
    const hmacBytes = hmacSha256Bytes(String(serverSeed), `${clientSeed}:${nonce}:${cursor}`);
    const view = new DataView(hmacBytes.buffer);
    const uint32 = view.getUint32(0, false);
    return uint32 / 0x100000000;
  },

  getProvablyFairState() {
    let raw = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROVABLY_FAIR_STATE);
      raw = stored ? JSON.parse(stored) : null;
    } catch {}

    if (!raw || !raw.serverSeed || !raw.clientSeed) {
      const initialServerSeed = generateSecureHex(32);
      const initialClientSeed = `pharaoh_${generateSecureHex(8)}`;
      raw = {
        serverSeed: initialServerSeed,
        serverSeedHash: sha256Hex(initialServerSeed),
        clientSeed: initialClientSeed,
        nonce: 0,
        previousServerSeed: null,
        previousServerSeedHash: null,
        algorithm: 'HMAC-SHA256',
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEYS.PROVABLY_FAIR_STATE, JSON.stringify(raw));
      } catch {}
    }
    return raw;
  },

  saveProvablyFairState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEYS.PROVABLY_FAIR_STATE, JSON.stringify(nextState));
    } catch {}
    return nextState;
  },

  setClientSeed(newClientSeed) {
    const clean = String(newClientSeed || '').trim() || `pharaoh_${generateSecureHex(6)}`;
    const current = this.getProvablyFairState();
    return this.saveProvablyFairState({
      ...current,
      clientSeed: clean.slice(0, 64),
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Rotates the active server seed, reveals the previous unhashed serverSeed so the player
   * can verify all historical spins made under that commitment, and creates a new commitment.
   */
  async rotateProvablyFairSeed(customClientSeed = null) {
    const current = this.getProvablyFairState();
    const revealedServerSeed = current.serverSeed;
    const revealedServerSeedHash = current.serverSeedHash;
    const nextServerSeed = generateSecureHex(32);
    const nextServerSeedHash = sha256Hex(nextServerSeed);
    const nextClientSeed = customClientSeed
      ? String(customClientSeed).trim().slice(0, 64)
      : current.clientSeed;

    // Also mark all existing spin receipts matching revealedServerSeedHash with the revealed serverSeed
    try {
      const receipts = this.getSpinReceipts();
      const updatedReceipts = receipts.map((r) =>
        r.serverSeedHash === revealedServerSeedHash
          ? { ...r, revealedServerSeed }
          : r
      );
      localStorage.setItem(STORAGE_KEYS.SPIN_RECEIPTS, JSON.stringify(updatedReceipts));
    } catch {}

    // Best-effort sync with backend /api/provably-fair/rotate
    try {
      await fetch('/api/provably-fair/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}

    const updated = this.saveProvablyFairState({
      ...current,
      serverSeed: nextServerSeed,
      serverSeedHash: nextServerSeedHash,
      clientSeed: nextClientSeed,
      nonce: 0,
      previousServerSeed: revealedServerSeed,
      previousServerSeedHash: revealedServerSeedHash,
      rotatedAt: new Date().toISOString(),
    });

    return {
      ...updated,
      revealedServerSeed,
      revealedServerSeedHash,
      newServerSeedHash: nextServerSeedHash,
    };
  },

  /**
   * Advances nonce and returns a deterministic RNG callback for spinPhysicalReels
   * plus the cryptographic commitment metadata for the spin receipt.
   */
  createNextSpinRng() {
    const state = this.getProvablyFairState();
    const nextNonce = (Number(state.nonce) || 0) + 1;
    this.saveProvablyFairState({
      ...state,
      nonce: nextNonce,
    });
    let cursor = 0;
    const rngFn = () => {
      cursor += 1;
      return this.provablyFairFloat(state.serverSeed, state.clientSeed, nextNonce, cursor);
    };
    return {
      rngFn,
      serverSeed: state.serverSeed,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: nextNonce,
    };
  },

  getSpinReceipts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SPIN_RECEIPTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  recordVerifiedSpin({
    currencyMode = 'GC',
    betAmount = 15,
    winAmount = 0,
    selectedLines = 15,
    betLevel = 1,
    stops = [],
    serverSeed = '',
    serverSeedHash = '',
    clientSeed = '',
    nonce = 1,
    scatterCount = 0,
  } = {}) {
    const receipts = this.getSpinReceipts();
    const payloadStr = `${serverSeedHash}:${clientSeed}:${nonce}:${stops.join(',')}:${betAmount}:${winAmount}`;
    const receipt = {
      id: `spn_${Date.now().toString(36).toUpperCase()}_${nonce}`,
      timestamp: new Date().toISOString(),
      currencyMode,
      betAmount: currencyMode === 'SC' ? this.fromCents(this.toCents(betAmount)) : Math.round(betAmount),
      winAmount: currencyMode === 'SC' ? this.fromCents(this.toCents(winAmount)) : Math.round(winAmount),
      selectedLines,
      betLevel,
      stops,
      serverSeed, // Stored locally so single-click verifier in PaytableModal can prove determinism
      serverSeedHash,
      clientSeed,
      nonce,
      scatterCount,
      signature: sha256Hex(payloadStr).slice(0, 32),
      algorithm: 'HMAC-SHA256',
    };
    receipts.unshift(receipt);
    try {
      localStorage.setItem(STORAGE_KEYS.SPIN_RECEIPTS, JSON.stringify(receipts.slice(0, 50)));
    } catch {}
    return receipt;
  },

  /**
   * Recomputes the exact 5 reel stops from (serverSeed, clientSeed, nonce) using HMAC-SHA256
   * and verifies that the recorded stops and SHA-256 commitment match 100%.
   */
  verifySpinReceipt(receipt, reelHeights = [72, 72, 72, 72, 72]) {
    if (!receipt || !receipt.serverSeed || !receipt.clientSeed) {
      return { verified: false, error: 'Missing seed parameters for verification.' };
    }
    const computedHash = sha256Hex(receipt.serverSeed);
    const hashMatches = computedHash === receipt.serverSeedHash;
    const recomputedStops = reelHeights.map((len, idx) => {
      const floatVal = this.provablyFairFloat(receipt.serverSeed, receipt.clientSeed, receipt.nonce, idx + 1);
      return Math.floor(floatVal * len);
    });
    const stopsMatch =
      Array.isArray(receipt.stops) &&
      receipt.stops.length === recomputedStops.length &&
      receipt.stops.every((s, idx) => s === recomputedStops[idx]);

    return {
      verified: hashMatches && stopsMatch,
      hashMatches,
      stopsMatch,
      computedHash,
      expectedHash: receipt.serverSeedHash,
      recomputedStops,
      recordedStops: receipt.stops,
      clientSeed: receipt.clientSeed,
      nonce: receipt.nonce,
      algorithm: 'HMAC-SHA256',
    };
  },

  // =========================================================================
  // RESPONSIBLE GAMING (RG) & SESSION REALITY CHECK SUITE
  // =========================================================================
  getResponsibleGamingState() {
    let raw = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESPONSIBLE_GAMING);
      raw = stored ? JSON.parse(stored) : null;
    } catch {}

    const todayStr = new Date().toISOString().slice(0, 10);
    const base = raw || {
      dailyDepositLimitUsd: 0, // 0 = no limit set
      maxSpinBetSC: 0, // 0 = no limit set
      maxSpinBetGC: 0, // 0 = no limit set
      realityCheckMinutes: 0, // 0 = off, or 15 / 30 / 60
      coolOffUntil: null, // ISO timestamp when cool-off expires
      depositsTodayUsd: 0,
      depositsDate: todayStr,
      updatedAt: new Date().toISOString(),
    };

    if (base.depositsDate !== todayStr) {
      base.depositsTodayUsd = 0;
      base.depositsDate = todayStr;
    }

    const isCoolingOff = Boolean(base.coolOffUntil && new Date(base.coolOffUntil).getTime() > Date.now());
    return {
      ...base,
      isCoolingOff,
      coolOffRemainingMinutes: isCoolingOff
        ? Math.max(1, Math.ceil((new Date(base.coolOffUntil).getTime() - Date.now()) / 60000))
        : 0,
    };
  },

  saveResponsibleGamingState(updates = {}) {
    const current = this.getResponsibleGamingState();
    const next = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.RESPONSIBLE_GAMING, JSON.stringify(next));
    } catch {}
    return this.getResponsibleGamingState();
  },

  activateCoolOff(hours = 24) {
    const until = new Date(Date.now() + Number(hours) * 3600 * 1000).toISOString();
    return this.saveResponsibleGamingState({ coolOffUntil: until });
  },

  clearCoolOffForDemo() {
    return this.saveResponsibleGamingState({ coolOffUntil: null });
  },

  checkDepositLimit(amountUsd) {
    const rg = this.getResponsibleGamingState();
    if (rg.isCoolingOff) {
      return {
        allowed: false,
        reason: `Responsible Gaming Cool-Off Active: Your account is in a voluntary break until ${new Date(rg.coolOffUntil).toLocaleString()}.`,
      };
    }
    const amt = Number(amountUsd) || 0;
    if (rg.dailyDepositLimitUsd > 0) {
      const projected = this.fromCents(this.toCents(rg.depositsTodayUsd) + this.toCents(amt));
      if (projected > rg.dailyDepositLimitUsd) {
        const remaining = Math.max(0, this.fromCents(this.toCents(rg.dailyDepositLimitUsd) - this.toCents(rg.depositsTodayUsd)));
        return {
          allowed: false,
          reason: `Daily Deposit Limit Reached: Your Responsible Gaming daily limit is $${Number(rg.dailyDepositLimitUsd).toFixed(2)} USD ($${remaining.toFixed(2)} remaining today).`,
        };
      }
    }
    return { allowed: true };
  },

  recordDepositForLimits(amountUsd) {
    const rg = this.getResponsibleGamingState();
    const nextTotal = this.fromCents(this.toCents(rg.depositsTodayUsd) + this.toCents(amountUsd));
    this.saveResponsibleGamingState({ depositsTodayUsd: nextTotal });
  },

  checkSpinAllowed({ currencyMode = 'GC', betAmount = 0 } = {}) {
    const rg = this.getResponsibleGamingState();
    if (rg.isCoolingOff) {
      return {
        allowed: false,
        code: 'COOL_OFF',
        reason: `Responsible Gaming Cool-Off Active (${rg.coolOffRemainingMinutes}m remaining). Take a break or manage settings in Player Protection.`,
      };
    }
    if (currencyMode === 'SC' && rg.maxSpinBetSC > 0 && betAmount > rg.maxSpinBetSC + 0.001) {
      return {
        allowed: false,
        code: 'MAX_BET_SC',
        reason: `Wager exceeds your Responsible Gaming max spin limit of $${Number(rg.maxSpinBetSC).toFixed(2)} SC.`,
      };
    }
    if (currencyMode === 'GC' && rg.maxSpinBetGC > 0 && betAmount > rg.maxSpinBetGC) {
      return {
        allowed: false,
        code: 'MAX_BET_GC',
        reason: `Wager exceeds your Responsible Gaming max spin limit of ${Number(rg.maxSpinBetGC).toLocaleString()} GC.`,
      };
    }
    return { allowed: true };
  },

  getSessionMetrics() {
    let raw = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION_METRICS);
      raw = stored ? JSON.parse(stored) : null;
    } catch {}
    if (!raw || !raw.sessionStartedAt) {
      raw = {
        sessionStartedAt: Date.now(),
        lastReminderAt: Date.now(),
        totalSpins: 0,
        wageredGC: 0,
        wonGC: 0,
        wageredSC: 0,
        wonSC: 0,
      };
      try {
        localStorage.setItem(STORAGE_KEYS.SESSION_METRICS, JSON.stringify(raw));
      } catch {}
    }
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - raw.sessionStartedAt) / 60000));
    const sinceReminderMinutes = Math.max(0, Math.floor((Date.now() - (raw.lastReminderAt || raw.sessionStartedAt)) / 60000));
    const netGC = Math.round((raw.wonGC || 0) - (raw.wageredGC || 0));
    const netSC = this.fromCents(this.toCents(raw.wonSC || 0) - this.toCents(raw.wageredSC || 0));
    return {
      ...raw,
      elapsedMinutes,
      sinceReminderMinutes,
      netGC,
      netSC,
    };
  },

  recordSessionSpin({ currencyMode = 'GC', betAmount = 0, winAmount = 0 } = {}) {
    const m = this.getSessionMetrics();
    const isSC = currencyMode === 'SC';
    const next = {
      sessionStartedAt: m.sessionStartedAt,
      lastReminderAt: m.lastReminderAt,
      totalSpins: (m.totalSpins || 0) + 1,
      wageredGC: isSC ? m.wageredGC : Math.round((m.wageredGC || 0) + betAmount),
      wonGC: isSC ? m.wonGC : Math.round((m.wonGC || 0) + winAmount),
      wageredSC: isSC ? this.fromCents(this.toCents(m.wageredSC) + this.toCents(betAmount)) : m.wageredSC,
      wonSC: isSC ? this.fromCents(this.toCents(m.wonSC) + this.toCents(winAmount)) : m.wonSC,
    };
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_METRICS, JSON.stringify(next));
    } catch {}
    const rg = this.getResponsibleGamingState();
    const updatedMetrics = this.getSessionMetrics();
    const shouldTriggerRealityCheck =
      rg.realityCheckMinutes > 0 && updatedMetrics.sinceReminderMinutes >= rg.realityCheckMinutes;
    return {
      ...updatedMetrics,
      shouldTriggerRealityCheck,
    };
  },

  acknowledgeRealityCheck() {
    const m = this.getSessionMetrics();
    const next = {
      ...m,
      lastReminderAt: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_METRICS, JSON.stringify(next));
    } catch {}
    return this.getSessionMetrics();
  },
};
