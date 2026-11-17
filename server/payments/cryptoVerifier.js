// ============================================================================
// STRICT ON-CHAIN TRANSFER VERIFIER (server-side only)
// ============================================================================
// Given (asset, txHash, recipient) returns exactly how much of THAT asset the
// transaction delivered to THAT recipient, plus confirmation depth.
//
// Hardening vs. the previous client-side verifier:
//   - ERC-20: only Transfer logs emitted by the official USDT contract count
//     (previously ANY contract's Transfer event counted -> fake-token exploit)
//   - Native ETH only on Ethereum mainnet (previously Polygon POL counted as ETH)
//   - SPL: only the official USDT mint, raw integer amounts (no float uiAmount)
//   - Confirmation depth is enforced by the caller (no 0-conf BTC credit)
//   - No tolerance: the caller compares exact base units
//   - Used for BOTH deposits (recipient = casino wallet) and payout receipts
//     (recipient = player wallet), so a pasted payout tx hash is proven on-chain.
// RPC endpoints are configurable via env (recommended: a dedicated provider key).
// ============================================================================

const ERC20_TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const DEFAULT_ENDPOINTS = {
  ETH_RPC_URLS: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'],
  SOLANA_RPC_URLS: ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'],
  BTC_API_URLS: ['https://mempool.space/api', 'https://blockstream.info/api'],
};

function endpoints(env, key, single) {
  const custom = env?.[single];
  return custom ? [custom, ...DEFAULT_ENDPOINTS[key]] : DEFAULT_ENDPOINTS[key];
}

export class CryptoVerifier {
  constructor({ env = {}, fetchImpl } = {}) {
    this.env = env;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
  }

  async _fetchJson(url, init = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await this.fetch(url, { ...init, signal: controller.signal });
      if (res.status === 404) return { __notFound: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers?.get?.('content-type') || '';
      return ct.includes('json') ? await res.json() : await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  async _rpc(urls, method, params) {
    let lastErr;
    for (const url of urls) {
      try {
        const data = await this._fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        if (data?.error) throw new Error(data.error.message || 'RPC error');
        return data?.result ?? null;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('RPC unreachable');
  }

  /**
   * @returns {Promise<{found:boolean, success?:boolean, amountRaw:bigint, confirmations:number,
   *                    blockTime:number|null, sender?:string, error?:string}>}
   */
  async verifyTransfer({ asset, txHash, recipient }) {
    const hash = String(txHash || '').trim();
    if (!hash) return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction hash required' };
    if (!recipient) return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Recipient address missing' };
    if (asset.chain === 'bitcoin') return this._verifyBitcoin(hash, recipient);
    if (asset.chain === 'ethereum') return this._verifyEthereum(asset, hash, recipient);
    if (asset.chain === 'solana') return this._verifySolana(asset, hash, recipient);
    throw new Error(`Unsupported chain ${asset.chain}`);
  }

  // ---- Bitcoin -------------------------------------------------------------
  async _verifyBitcoin(txid, recipient) {
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
      return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Invalid Bitcoin transaction id' };
    }
    const target = recipient.toLowerCase();
    let lastErr;
    for (const base of endpoints(this.env, 'BTC_API_URLS', 'BTC_API_URL')) {
      try {
        const tx = await this._fetchJson(`${base}/tx/${txid}`);
        if (tx?.__notFound) return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction not found on Bitcoin' };
        let sats = 0n;
        for (const out of tx.vout || []) {
          if (String(out.scriptpubkey_address || '').toLowerCase() === target) sats += BigInt(out.value || 0);
        }
        let confirmations = 0;
        if (tx.status?.confirmed && tx.status.block_height) {
          const tip = Number(await this._fetchJson(`${base}/blocks/tip/height`));
          confirmations = tip >= tx.status.block_height ? tip - tx.status.block_height + 1 : 1;
        }
        return {
          found: true,
          success: true,
          amountRaw: sats,
          confirmations,
          blockTime: tx.status?.block_time || null,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: `Bitcoin API unavailable: ${lastErr?.message}`, retryable: true };
  }

  // ---- Ethereum mainnet (native ETH + official USDT) -----------------------
  async _verifyEthereum(asset, hash, recipient) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Invalid Ethereum transaction hash' };
    }
    const urls = endpoints(this.env, 'ETH_RPC_URLS', 'ETH_RPC_URL');
    const target = recipient.toLowerCase();
    try {
      const [tx, receipt, headHex] = await Promise.all([
        this._rpc(urls, 'eth_getTransactionByHash', [hash]),
        this._rpc(urls, 'eth_getTransactionReceipt', [hash]),
        this._rpc(urls, 'eth_blockNumber', []),
      ]);
      if (!tx) return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction not found on Ethereum mainnet' };
      if (!receipt) return { found: true, success: true, amountRaw: 0n, confirmations: 0, blockTime: null, pending: true };
      if (receipt.status !== '0x1') {
        return { found: true, success: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction reverted' };
      }
      const confirmations = Math.max(0, parseInt(headHex, 16) - parseInt(receipt.blockNumber, 16) + 1);
      let amount = 0n;
      if (asset.tokenContract) {
        const paddedTo = '0x' + target.slice(2).padStart(64, '0');
        for (const log of receipt.logs || []) {
          if (
            String(log.address || '').toLowerCase() === asset.tokenContract &&
            String(log.topics?.[0] || '').toLowerCase() === ERC20_TRANSFER_TOPIC0 &&
            String(log.topics?.[2] || '').toLowerCase() === paddedTo
          ) {
            amount += BigInt(log.data || '0x0');
          }
        }
      } else if (String(tx.to || '').toLowerCase() === target) {
        amount = BigInt(tx.value || '0x0');
      }
      let blockTime = null;
      try {
        const block = await this._rpc(urls, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
        blockTime = block?.timestamp ? parseInt(block.timestamp, 16) : null;
      } catch {}
      return { found: true, success: true, amountRaw: amount, confirmations, blockTime, sender: String(tx.from || '').toLowerCase() };
    } catch (err) {
      return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: `Ethereum RPC unavailable: ${err.message}`, retryable: true };
    }
  }

  // ---- Solana (native SOL + official USDT mint) ----------------------------
  async _verifySolana(asset, sig, recipient) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) {
      return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Invalid Solana signature' };
    }
    const urls = endpoints(this.env, 'SOLANA_RPC_URLS', 'SOLANA_RPC_URL');
    try {
      const tx = await this._rpc(urls, 'getTransaction', [
        sig,
        { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx) {
        // May exist but not finalized yet
        const st = await this._rpc(urls, 'getSignatureStatuses', [[sig], { searchTransactionHistory: true }]);
        const s = st?.value?.[0];
        if (s && !s.err) return { found: true, success: true, amountRaw: 0n, confirmations: 0, blockTime: null, pending: true };
        return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction not found on Solana (or not finalized yet)' };
      }
      if (tx.meta?.err) return { found: true, success: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: 'Transaction failed on-chain' };
      let amount = 0n;
      if (asset.tokenMint) {
        const pre = tx.meta?.preTokenBalances || [];
        for (const post of tx.meta?.postTokenBalances || []) {
          if (post.owner !== recipient || post.mint !== asset.tokenMint) continue;
          const preMatch = pre.find((p) => p.accountIndex === post.accountIndex && p.mint === post.mint);
          const delta = BigInt(post.uiTokenAmount?.amount || '0') - BigInt(preMatch?.uiTokenAmount?.amount || '0');
          if (delta > 0n) amount += delta;
        }
      } else {
        const keys = tx.transaction?.message?.accountKeys || [];
        const idx = keys.findIndex((k) => (typeof k === 'string' ? k : k?.pubkey) === recipient);
        if (idx !== -1) {
          const delta = BigInt(tx.meta?.postBalances?.[idx] ?? 0) - BigInt(tx.meta?.preBalances?.[idx] ?? 0);
          if (delta > 0n) amount = delta;
        }
      }
      return { found: true, success: true, amountRaw: amount, confirmations: 32, blockTime: tx.blockTime || null };
    } catch (err) {
      return { found: false, amountRaw: 0n, confirmations: 0, blockTime: null, error: `Solana RPC unavailable: ${err.message}`, retryable: true };
    }
  }

  /** Basic address format validation for player payout destinations */
  static isValidAddress(asset, address) {
    const a = String(address || '').trim();
    if (asset.chain === 'bitcoin') return /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a);
    if (asset.chain === 'ethereum') return /^0x[0-9a-fA-F]{40}$/.test(a);
    if (asset.chain === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
    return false;
  }
}
