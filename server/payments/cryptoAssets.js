// ============================================================================
// CRYPTO ASSETS, ADDRESSES & LIVE PRICING (server-side)
// ============================================================================
import { CRYPTO_WALLET_ADDRESSES } from '../../src/config/sweepstakesConfig.js';

/**
 * chainDecimals  : on-chain base-unit decimals
 * displayDecimals: precision quoted to players ("send exactly X"); deposit matching is
 *                  exact at this precision. Each open deposit gets a unique tag in the
 *                  last displayed digits so a transfer maps to exactly one deposit —
 *                  this stops a player from claiming someone else's public on-chain
 *                  transfer as their own.
 * maxTag         : unique tag range in display units
 * Deposits are verified by the transaction hash the player submits (no address scanning).
 */
export const CRYPTO_ASSETS = {
  BTC: {
    id: 'BTC', label: 'Bitcoin', unit: 'BTC', chain: 'bitcoin', network: 'Bitcoin Mainnet',
    chainDecimals: 8, displayDecimals: 8, maxTag: 999, minConfirmations: 1, priceKey: 'BTC',
    addressKey: 'BTC',
    explorerTx: 'https://mempool.space/tx/',
  },
  ETH: {
    id: 'ETH', label: 'Ethereum', unit: 'ETH', chain: 'ethereum', network: 'Ethereum Mainnet',
    chainDecimals: 18, displayDecimals: 8, maxTag: 9999, minConfirmations: 12, priceKey: 'ETH',
    addressKey: 'ETH',
    explorerTx: 'https://etherscan.io/tx/',
  },
  USDT_ERC20: {
    id: 'USDT_ERC20', label: 'USDT (ERC-20)', unit: 'USDT', chain: 'ethereum', network: 'Ethereum Mainnet (ERC-20)',
    chainDecimals: 6, displayDecimals: 6, maxTag: 9999, minConfirmations: 12, priceKey: 'USD',
    addressKey: 'USDT_ERC20',
    tokenContract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    explorerTx: 'https://etherscan.io/tx/',
  },
  SOL: {
    id: 'SOL', label: 'Solana', unit: 'SOL', chain: 'solana', network: 'Solana Mainnet',
    chainDecimals: 9, displayDecimals: 6, maxTag: 999, minConfirmations: 1, priceKey: 'SOL',
    addressKey: 'SOL',
    explorerTx: 'https://solscan.io/tx/',
  },
  USDT_SOL: {
    id: 'USDT_SOL', label: 'USDT (Solana SPL)', unit: 'USDT', chain: 'solana', network: 'Solana Mainnet (SPL)',
    chainDecimals: 6, displayDecimals: 6, maxTag: 9999, minConfirmations: 1, priceKey: 'USD',
    addressKey: 'USDT_SOL',
    tokenMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    explorerTx: 'https://solscan.io/tx/',
  },
};

/** Legacy symbol aliases used by the existing client */
const ALIASES = { USDT: 'USDT_SOL', 'USDT-ERC20': 'USDT_ERC20', USDT_ETH: 'USDT_ERC20' };

export function getAsset(symbol) {
  const key = ALIASES[String(symbol || '').toUpperCase()] || String(symbol || '').toUpperCase();
  const asset = CRYPTO_ASSETS[key];
  if (!asset) throw new Error(`Unsupported crypto asset: ${symbol}`);
  return asset;
}

/** Operator receiving addresses: env override -> config default */
export function getReceivingAddress(asset, env = {}) {
  const envKey = `CRYPTO_WALLET_${asset.addressKey}`;
  return (env && env[envKey]) || CRYPTO_WALLET_ADDRESSES[asset.addressKey] || '';
}

// ---- Amount helpers (BigInt base units) -----------------------------------
export function displayUnitsToString(units, decimals) {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const s = abs.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = decimals > 0 ? s.slice(-decimals) : '';
  return `${neg ? '-' : ''}${whole}${decimals > 0 ? '.' + frac : ''}`;
}

/** Convert raw chain base units (BigInt) to display units (BigInt), truncating */
export function chainToDisplayUnits(rawUnits, asset) {
  const shift = asset.chainDecimals - asset.displayDecimals;
  return shift > 0 ? rawUnits / 10n ** BigInt(shift) : rawUnits;
}

export function displayToChainUnits(displayUnits, asset) {
  const shift = asset.chainDecimals - asset.displayDecimals;
  return shift > 0 ? displayUnits * 10n ** BigInt(shift) : displayUnits;
}

/** USD -> display units at a given USD price */
export function usdToDisplayUnits(usd, priceUsd, asset) {
  if (!(priceUsd > 0)) throw new Error(`No live price for ${asset.id}`);
  const amount = Number(usd) / priceUsd;
  return BigInt(Math.ceil(amount * 10 ** asset.displayDecimals));
}

// ---- Live pricing ----------------------------------------------------------
const PRICE_TTL_MS = 60 * 1000;

export class PriceOracle {
  constructor({ fetchImpl } = {}) {
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.cache = new Map(); // key -> { price, at, sources }
  }

  async _json(url) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await this.fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /** Median of independent public spot sources (Coinbase, Kraken, CoinGecko) */
  async getUsdPrice(priceKey) {
    if (priceKey === 'USD') return { price: 1, sources: ['peg'] };
    const cached = this.cache.get(priceKey);
    if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached;

    const krakenPair = { BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD' }[priceKey];
    const geckoId = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana' }[priceKey];
    const sources = await Promise.allSettled([
      this._json(`https://api.coinbase.com/v2/prices/${priceKey}-USD/spot`).then((d) => ['coinbase', Number(d?.data?.amount)]),
      this._json(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`).then((d) => {
        const r = d?.result && Object.values(d.result)[0];
        return ['kraken', Number(r?.c?.[0])];
      }),
      this._json(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`).then((d) => ['coingecko', Number(d?.[geckoId]?.usd)]),
    ]);
    const ok = sources
      .filter((s) => s.status === 'fulfilled' && s.value[1] > 0)
      .map((s) => s.value);
    if (ok.length === 0) {
      if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached; // brief stale grace
      throw new Error(`Live ${priceKey} price unavailable — try USDT or again shortly.`);
    }
    const prices = ok.map((s) => s[1]).sort((a, b) => a - b);
    const mid = prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
    // Reject if sources disagree by >3% (bad feed / manipulation)
    if (prices.length > 1 && (prices[prices.length - 1] - prices[0]) / mid > 0.03) {
      throw new Error(`${priceKey} price sources disagree — try again shortly.`);
    }
    const out = { price: mid, at: Date.now(), sources: ok.map((s) => s[0]) };
    this.cache.set(priceKey, out);
    return out;
  }
}
