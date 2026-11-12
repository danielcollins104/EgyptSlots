// ============================================================================
// SWEEPSTAKES CASINO CHECKOUT MVC CONTROLLER & MULTI-RAIL ORCHESTRATOR
// ============================================================================
// Modeled after Chumba Casino, Pulsz, McLuck, and Stake.us checkout flows.
// Provides a resilient, zero-block multi-rail payment orchestrator:
//   1. Embedded Express Card + Apple Pay / Google Pay + Saved Card 1-Click Vault
//   2. Fiat-to-Crypto Card Bridge (Topper / MoonPay / Transak -> Self-Custody Wallet)
//   3. Cash App Instant Pay ($Daniel-Collins-168 Deep Link + Desktop QR + Instant Claim)
//   4. Online Banking / Instant ACH (Trustly / Chime / Major US Banks)
//   5. Stake.us-Style Web3 Crypto Vault (+5% Extra Free SC Bonus)
// ============================================================================

import {
  CASHTAG_HANDLE,
  CRYPTO_WALLET_ADDRESSES,
  getCashAppPaymentLink,
} from '../config/sweepstakesConfig.js';

const SAVED_CARDS_STORAGE_KEY = 'dc_saved_payment_cards_v1';

export const SWEEPSTAKES_PAYMENT_RAILS = [
  {
    id: 'card',
    label: 'Card / Apple Pay',
    shortLabel: 'Card / Pay',
    badge: 'INSTANT',
    bonusScPct: 0,
    subtitle: 'Visa, Mastercard, Amex, Discover, Apple Pay & Google Pay',
  },
  {
    id: 'cashapp',
    label: 'Cash App Pay',
    shortLabel: 'Cash App',
    badge: '+5% FREE SC',
    bonusScPct: 5,
    subtitle: `Instant mobile or QR transfer to ${CASHTAG_HANDLE} (+5% Extra SC)`,
  },
  {
    id: 'banking',
    label: 'Online Banking',
    shortLabel: 'Bank / Chime',
    badge: '0% FEE ACH',
    bonusScPct: 0,
    subtitle: 'Trustly Online Banking, Chime, Chase, BofA & Wells Fargo',
  },
  {
    id: 'crypto',
    label: 'Crypto Vault',
    shortLabel: 'Crypto (+5%)',
    badge: '+5% FREE SC',
    bonusScPct: 5,
    subtitle: 'USDT, Solana, Bitcoin & Ethereum with live on-chain verification',
  },
];

export const POPULAR_US_BANKS = [
  { id: 'chime', name: 'Chime', badge: 'INSTANT', color: '#25c974' },
  { id: 'chase', name: 'Chase Bank', badge: 'ONLINE BANKING', color: '#117aca' },
  { id: 'bofa', name: 'Bank of America', badge: 'ONLINE BANKING', color: '#e31837' },
  { id: 'wellsfargo', name: 'Wells Fargo', badge: 'ONLINE BANKING', color: '#d71e28' },
  { id: 'capitalone', name: 'Capital One', badge: 'ONLINE BANKING', color: '#004977' },
  { id: 'venmo_paypal', name: 'Venmo / Skrill', badge: 'E-WALLET', color: '#008cff' },
];

export const sweepstakesCheckoutController = {
  /**
   * Detects card network brand from partial or full card number
   */
  detectCardBrand(cardNumber = '') {
    const clean = String(cardNumber).replace(/\D/g, '');
    if (/^4/.test(clean)) return { id: 'visa', label: 'VISA', cvcLength: 3 };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { id: 'mastercard', label: 'MASTERCARD', cvcLength: 3 };
    if (/^3[47]/.test(clean)) return { id: 'amex', label: 'AMEX', cvcLength: 4 };
    if (/^(6011|65|64[4-9])/.test(clean)) return { id: 'discover', label: 'DISCOVER', cvcLength: 3 };
    return { id: 'card', label: 'CARD', cvcLength: 3 };
  },

  /**
   * Formats a raw card number string with spaces
   */
  formatCardNumber(val = '') {
    const digits = String(val).replace(/\D/g, '').slice(0, 16);
    if (/^3[47]/.test(digits)) {
      // Amex 4-6-5 format
      const p1 = digits.slice(0, 4);
      const p2 = digits.slice(4, 10);
      const p3 = digits.slice(10, 15);
      return [p1, p2, p3].filter(Boolean).join(' ');
    }
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  },

  /**
   * Formats expiration date as MM/YY
   */
  formatExpiry(val = '') {
    const digits = String(val).replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    }
    return digits;
  },

  /**
   * Validates card inputs (number length, expiry month/year, CVC)
   */
  validateCardInput({ cardNumber = '', cardExpiry = '', cardCvc = '' } = {}) {
    const rawDigits = String(cardNumber).replace(/\D/g, '');
    const brand = this.detectCardBrand(rawDigits);

    if (rawDigits.length < 15 || rawDigits.length > 16) {
      return { valid: false, error: 'Please enter a valid 15 or 16-digit card number.' };
    }

    const expParts = String(cardExpiry).split('/');
    const expMonth = parseInt(expParts[0], 10);
    const expYear = parseInt(expParts[1], 10);
    if (!expMonth || expMonth < 1 || expMonth > 12 || !expYear || expYear < 25) {
      return { valid: false, error: 'Please enter a valid expiration date (MM/YY).' };
    }

    const cleanCvc = String(cardCvc).replace(/\D/g, '');
    if (cleanCvc.length < 3 || cleanCvc.length > 4) {
      return { valid: false, error: 'Please enter your 3 or 4-digit security code (CVC).' };
    }

    return {
      valid: true,
      brand: brand.label,
      last4: rawDigits.slice(-4),
      expMonth,
      expYear,
    };
  },

  /**
   * Returns saved tokenized cards for 1-click Chumba/Pulsz-style re-purchase
   */
  getSavedCards() {
    try {
      const raw = localStorage.getItem(SAVED_CARDS_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  /**
   * Saves a tokenized card descriptor (brand, last4, expiry, holderName) — never stores full PAN or CVC
   */
  saveCardForOneClick({ brand = 'VISA', last4 = '4242', expiry = '12/28', holderName = 'VIP Player', zip = '' } = {}) {
    try {
      const existing = this.getSavedCards().filter((c) => c.last4 !== last4 || c.brand !== brand);
      const entry = {
        id: `pm_${Date.now().toString(36)}`,
        brand,
        last4,
        expiry,
        holderName: holderName || 'VIP Player',
        zip: zip || '',
        savedAt: new Date().toISOString(),
      };
      const updated = [entry, ...existing].slice(0, 4);
      localStorage.setItem(SAVED_CARDS_STORAGE_KEY, JSON.stringify(updated));
      return entry;
    } catch {
      return null;
    }
  },

  removeSavedCard(cardId) {
    try {
      const updated = this.getSavedCards().filter((c) => c.id !== cardId);
      localStorage.setItem(SAVED_CARDS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  /**
   * Computes effective package rewards including any rail-specific bonus SC (+5% for Cash App / Crypto)
   */
  computePackageWithRailBonus(pkg, railId = 'card') {
    if (!pkg) return null;
    const rail = SWEEPSTAKES_PAYMENT_RAILS.find((r) => r.id === railId) || SWEEPSTAKES_PAYMENT_RAILS[0];
    const bonusPct = rail.bonusScPct || 0;
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
   * Generates a Cash App deep link + scannable QR code URL for desktop & mobile players
   */
  getCashAppCheckoutDetails(pkg) {
    const priceUsd = Number(pkg?.priceUsd || 19.99);
    const directUrl = pkg?.cashAppPaymentLink || getCashAppPaymentLink(priceUsd);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
      directUrl
    )}`;
    return {
      cashtag: CASHTAG_HANDLE,
      priceUsd,
      directUrl,
      qrUrl,
    };
  },

  /**
   * Generates Stake.us-style Card-to-Crypto On-Ramp Bridge URLs (MoonPay / Topper / Guardarian)
   * pre-populated with our live self-custody Solana or Ethereum wallet address and exact USD amount.
   * Allows any player to pay with Visa / Mastercard / Apple Pay via licensed crypto on-ramps
   * while funds settle directly into our self-custody wallet.
   */
  getCardToCryptoBridgeLinks(pkg) {
    const amountUsd = Number(pkg?.priceUsd || 19.99).toFixed(2);
    const solAddress = CRYPTO_WALLET_ADDRESSES.SOL;
    const ethAddress = CRYPTO_WALLET_ADDRESSES.ETH;

    return [
      {
        id: 'moonpay',
        name: 'MoonPay Express (Card / Pay → Instant Wallet)',
        url: `https://buy.moonpay.com/?currencyCode=sol&walletAddress=${encodeURIComponent(
          solAddress
        )}&baseCurrencyCode=usd&baseCurrencyAmount=${encodeURIComponent(amountUsd)}`,
      },
      {
        id: 'topper',
        name: 'Topper by Uphold (Visa / Mastercard → Instant Wallet)',
        url: `https://app.topperpay.com/?crypto=SOL&target_address=${encodeURIComponent(
          solAddress
        )}&fiat=USD&amount=${encodeURIComponent(amountUsd)}`,
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
};
