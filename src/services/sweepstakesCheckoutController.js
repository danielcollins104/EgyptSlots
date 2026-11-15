// ============================================================================
// SWEEPSTAKES CASINO CHECKOUT CONTROLLER & MULTI-RAIL ORCHESTRATOR
// ============================================================================
// Thin orchestration layer over the payment processor registry
// (src/payments/processorRegistry.js). The rails themselves live in
// src/payments/processors/* — adding Skrill or Apple/Google Pay is a
// config change there, not a rewrite here.
//
// LIVE RAILS:
//   1. Crypto Vault        — USDT / SOL / ETH / BTC, live on-chain verification (+5% SC)
//   2. Cash App Pay        — P2P $Cashtag with unique per-order reference (+5% SC)
//   3. Card → Crypto Bridge — Topper / MoonPay / Guardarian on-ramps (card in, crypto out)
// ============================================================================

import { paymentProcessorRegistry } from '../payments/processorRegistry.js';
import { cashAppProcessor } from '../payments/processors/cashAppProcessor.js';
import { CASHTAG_HANDLE, CRYPTO_WALLET_ADDRESSES, getCashAppPaymentLink } from '../config/sweepstakesConfig.js';

/** Back-compat alias — rails are now generated from the processor registry */
export const SWEEPSTAKES_PAYMENT_RAILS = paymentProcessorRegistry.getRails();

/** Deposit rails exposed by the checkout UI (crypto, cashapp, card on-ramp) */
export const CHECKOUT_DEPOSIT_RAILS = SWEEPSTAKES_PAYMENT_RAILS.filter((r) =>
  ['crypto', 'cashapp'].includes(r.id)
);

export const POPULAR_US_BANKS = [
  { id: 'chime', name: 'Chime', badge: 'INSTANT', color: '#25c974' },
  { id: 'chase', name: 'Chase Bank', badge: 'ONLINE BANKING', color: '#117aca' },
  { id: 'bofa', name: 'Bank of America', badge: 'ONLINE BANKING', color: '#e31837' },
  { id: 'wellsfargo', name: 'Wells Fargo', badge: 'ONLINE BANKING', color: '#d71e28' },
  { id: 'capitalone', name: 'Capital One', badge: 'ONLINE BANKING', color: '#004977' },
  { id: 'venmo_skrill', name: 'Venmo / Skrill', badge: 'E-WALLET', color: '#008cff' },
];

export const sweepstakesCheckoutController = {
  /** Rails descriptor list for the UI selector (from the processor registry) */
  getRails() {
    return paymentProcessorRegistry.getRails();
  },

  /**
   * Computes effective package rewards including any rail-specific bonus SC
   * (+5% for Cash App / Crypto). Falls back to 0% for unknown rails.
   */
  computePackageWithRailBonus(pkg, railId = 'crypto') {
    if (!pkg) return null;
    const rail = paymentProcessorRegistry.getRails().find((r) => r.id === railId);
    const bonusPct = rail?.bonusScPct || 0;
    const baseSC = Number(pkg.freeSweepsCoins) || 0;
    const extraSC = bonusPct > 0 ? Number(((baseSC * bonusPct) / 100).toFixed(2)) : 0;
    const totalSC = Number((baseSC + extraSC).toFixed(2));

    return {
      ...pkg,
      baseFreeSweepsCoins: baseSC,
      extraRailBonusSC: extraSC,
      freeSweepsCoins: totalSC,
      railBonusPct: bonusPct,
      activeRailId: railId,
    };
  },

  /**
   * Cash App checkout: deep link + QR + unique order reference code.
   * The order code is what ties a player's P2P transfer to this purchase.
   */
  getCashAppCheckoutDetails(pkg, orderRef = '') {
    const priceUsd = Number(pkg?.priceUsd || 19.99);
    const directUrl = getCashAppPaymentLink(priceUsd, orderRef);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
      directUrl
    )}`;
    return {
      cashtag: CASHTAG_HANDLE,
      priceUsd,
      orderRef: orderRef || cashAppProcessor.getDepositInstructions(pkg).orderRef,
      directUrl,
      qrUrl,
    };
  },

  /** Mint a fresh order reference for a new Cash App deposit attempt */
  generateOrderRef() {
    return cashAppProcessor.getDepositInstructions({ priceUsd: 0 }).orderRef;
  },

  /**
   * Card-to-crypto on-ramp bridges (Topper / MoonPay / Guardarian).
   * Lets any player pay with Visa / Mastercard / Apple Pay via licensed
   * on-ramps while funds settle directly into our self-custody wallet.
   * This is the interim card path until the Skrill gateway goes live.
   */
  getCardToCryptoBridgeLinks(pkg) {
    const amountUsd = Number(pkg?.priceUsd || 19.99).toFixed(2);
    const solAddress = CRYPTO_WALLET_ADDRESSES.SOL;
    const ethAddress = CRYPTO_WALLET_ADDRESSES.ETH;

    return [
      {
        id: 'topper',
        name: 'Topper by Uphold (Visa / Mastercard / Apple Pay → Instant Wallet)',
        url: `https://app.topperpay.com/?crypto=SOL&target_address=${encodeURIComponent(
          solAddress
        )}&fiat=USD&amount=${encodeURIComponent(amountUsd)}`,
      },
      {
        id: 'moonpay',
        name: 'MoonPay Express (Card / Apple Pay → Instant Wallet)',
        url: `https://buy.moonpay.com/?currencyCode=sol&walletAddress=${encodeURIComponent(
          solAddress
        )}&baseCurrencyCode=usd&baseCurrencyAmount=${encodeURIComponent(amountUsd)}`,
      },
      {
        id: 'guardarian',
        name: 'Guardarian No-KYC Card Bridge (ETH / USDT)',
        url: `https://guardarian.com/calculator?from_currency=USD&from_amount=${encodeURIComponent(
          amountUsd
        )}&to_currency=ETH&payout_address=${encodeURIComponent(ethAddress)}`,
      },
    ];
  },

  /** Convenience passthroughs to the registry */
  initiateDeposit(processorId, pkg, context) {
    return paymentProcessorRegistry.initiateDeposit(processorId, pkg, context);
  },
  verifyDeposit(processorId, instructions, context) {
    return paymentProcessorRegistry.verifyDeposit(processorId, instructions, context);
  },
};
