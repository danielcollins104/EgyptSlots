// ============================================================================
// CRYPTO PROCESSOR — PRIMARY DEPOSIT RAIL (BTC / ETH / SOL / USDT)
// ============================================================================
// Self-custody wallet deposits verified live on-chain via public RPC.
// Wraps cryptoVerifierService so verification is RPC-first with the
// server /api/crypto/verify endpoint as fallback.
// ============================================================================

import { CRYPTO_WALLET_ADDRESSES } from '../../config/sweepstakesConfig.js';
import {
  verifyCryptoDeposit,
  getLiveWalletBalancesStatus,
} from '../../services/cryptoVerifierService.js';

/** Supported deposit assets & their network parameters */
export const CRYPTO_DEPOSIT_ASSETS = [
  { symbol: 'USDT', unit: 'USDT', network: 'Solana Mainnet (SPL)', addressKey: 'USDT_SOL', rateMultiplier: 1.0, decimals: 2, explorerTxBase: 'https://solscan.io/tx/', explorerAddrBase: 'https://solscan.io/account/', minConfirmations: 1 },
  { symbol: 'SOL', unit: 'SOL', network: 'Solana Mainnet', addressKey: 'SOL', rateMultiplier: 1.0, decimals: 6, explorerTxBase: 'https://solscan.io/tx/', explorerAddrBase: 'https://solscan.io/account/', minConfirmations: 1 },
  { symbol: 'ETH', unit: 'ETH', network: 'Ethereum Mainnet (ERC-20)', addressKey: 'ETH', rateMultiplier: 1.0, decimals: 6, explorerTxBase: 'https://etherscan.io/tx/', explorerAddrBase: 'https://etherscan.io/address/', minConfirmations: 6 },
  { symbol: 'BTC', unit: 'BTC', network: 'Bitcoin Mainnet', addressKey: 'BTC', rateMultiplier: 1.0, decimals: 8, explorerTxBase: 'https://www.blockchain.com/explorer/transactions/btc/', explorerAddrBase: 'https://www.blockchain.com/explorer/addresses/btc/', minConfirmations: 2 },
];

export const cryptoProcessor = {
  meta: {
    id: 'crypto',
    label: 'Crypto Vault',
    shortLabel: 'Crypto (+5%)',
    badge: '+5% FREE SC',
    bonusScPct: 5,
    subtitle: 'USDT, Solana, Bitcoin & Ethereum with live on-chain verification',
    enabled: true,
  },

  getAsset(symbol = 'USDT') {
    return CRYPTO_DEPOSIT_ASSETS.find((a) => a.symbol === symbol) || CRYPTO_DEPOSIT_ASSETS[0];
  },

  getAddress(symbol = 'USDT') {
    const asset = this.getAsset(symbol);
    return CRYPTO_WALLET_ADDRESSES[asset.addressKey] || '';
  },

  amountForUsd(usd, symbol = 'USDT') {
    const asset = this.getAsset(symbol);
    return Number((Number(usd || 0) * asset.rateMultiplier).toFixed(asset.decimals));
  },

  /** Wallet deep link / URI for mobile wallets (MetaMask, Phantom, etc.) */
  getWalletUri(symbol, address, amount) {
    if (symbol === 'BTC') return `bitcoin:${address}?amount=${amount}`;
    if (symbol === 'ETH') return `ethereum:${address}?value=${amount}`;
    return `solana:${address}?amount=${amount}`;
  },

  getDepositInstructions(pkg, context = {}) {
    const symbol = context.symbol || 'USDT';
    const asset = this.getAsset(symbol);
    const address = this.getAddress(symbol);
    const amount = this.amountForUsd(pkg?.priceUsd, symbol);
    return {
      processorId: 'crypto',
      symbol,
      unit: asset.unit,
      network: asset.network,
      address,
      amountUsd: Number(pkg?.priceUsd) || 0,
      amount,
      decimals: asset.decimals,
      walletUri: this.getWalletUri(symbol, address, amount),
      explorerAddrBase: asset.explorerAddrBase,
      explorerTxBase: asset.explorerTxBase,
      minConfirmations: asset.minConfirmations,
      steps: [
        `Send exactly ${amount} ${asset.unit} on ${asset.network}`,
        'Transfers are detected automatically — no TXID needed',
        'Coins credit within ~60 seconds of on-chain confirmation',
      ],
    };
  },

  async verifyDeposit(instructions, context = {}) {
    return verifyCryptoDeposit({
      symbol: instructions.symbol || context.symbol || 'USDT',
      expectedAmount: Number(instructions.amount ?? context.expectedAmount) || 0,
      txHash: context.txHash || '',
      minTimestampSec: context.minTimestampSec || 0,
    });
  },

  async getLiveWalletsStatus() {
    return getLiveWalletBalancesStatus();
  },

  /** Operator payout instructions: send exact asset amount to player wallet */
  getPayoutInstructions(redemption = {}) {
    const dest = redemption.destination || redemption.payoutAddress || '';
    const asset = redemption.cryptoAsset || 'USDT_SOL';
    const symbolMap = { USDT_SOL: 'USDT (Solana SPL)', SOL: 'SOL', ETH: 'ETH', USDT_ERC20: 'USDT (ERC-20)', BTC: 'BTC' };
    return {
      title: `Send crypto to player wallet`,
      lines: [
        `Asset: ${symbolMap[asset] || asset}`,
        `Destination: ${dest}`,
        `USD Value: $${Number(redemption.amountUsd || 0).toFixed(2)} (1 SC = $1.00)`,
        'Send the equivalent asset amount, then paste the TX hash as receipt.',
      ],
    };
  },
};
