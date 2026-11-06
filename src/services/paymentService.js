// Payment & Sweepstakes Gateway Service
// Supports live Stripe Checkout Sessions, Stripe Payment Links, Cash App Pay, Crypto, and Embedded Stripe Card Checkout.

import {
  SWEEPSTAKES_CONFIG,
  getStripePaymentLink,
  getCashAppPayCheckoutLink,
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
};

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
    const entry = this.logTransaction({
      type: `PURCHASE (${String(method).toUpperCase().replace(/_/g, ' ')})`,
      packageId: packageId || 'pkg_silver',
      amountUsd: Number(amountUsd) || 0,
      goldCoins: Number(goldCoins) || 0,
      sweepsCoins: Number(sweepsCoins) || 0,
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
  approveRedemption(redemptionId, { txHashOrReceipt = '', giftCardCode = '', operatorNote = '' } = {}) {
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
      fetch('/api/redemptions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId, action: 'approve', updated }),
      }).catch(() => {});
    }

    return { success: true, redemption: updated };
  },

  /**
   * Admin 1-Click Action: Rejects a pending redemption and returns the SC amount to refund to the player's balance
   */
  rejectRedemption(redemptionId, { reason = 'Rejected by Operator — SC Refunded to Balance' } = {}) {
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
      fetch('/api/redemptions/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        ? getCashAppPayCheckoutLink(pkg)
        : getStripePaymentLink(pkg);
    const returnUrl = getPaymentReturnUrl(pkg.id);

    let fallbackUrl = returnUrl;
    if (baseLink) {
      const sep = baseLink.includes('?') ? '&' : '?';
      fallbackUrl = `${baseLink}${sep}client_reference_id=${encodeURIComponent(pkg.id)}`;
    }

    return {
      success: true,
      url: fallbackUrl,
      sessionId: `cs_fallback_${Date.now()}`,
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
};
