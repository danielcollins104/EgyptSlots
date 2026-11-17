import crypto from 'node:crypto';
import { CRYPTO_NETWORKS } from './config.js';
import { AppError, bad, newId, nowIso } from './ledger.js';
import { isValidEvmAddress } from './keccak.js';

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad32 = (addr) => `0x${'0'.repeat(24)}${addr.slice(2).toLowerCase()}`;
const topicToAddr = (t) => `0x${String(t).slice(26).toLowerCase()}`;
const hex = (n) => `0x${n.toString(16)}`;

/** Plain JSON-RPC client. `fetchImpl` is injectable so the gateway is fully testable offline. */
export function makeRpc(url, fetchImpl = globalThis.fetch) {
  let id = 0;
  return async (method, params = []) => {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
    });
    const body = await res.json();
    if (body.error) throw new Error(`RPC ${method}: ${body.error.message}`);
    return body.result;
  };
}

export function formatUnits(atomic, decimals) {
  const s = BigInt(atomic).toString().padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

/**
 * Self-hosted, RECEIVE-ONLY stablecoin gateway (USDC/USDT on EVM chains).
 *  - Each purchase gets a unique exact amount (price + sub-cent tag); we never accept a user-supplied tx hash as proof.
 *  - We scan ERC-20 Transfer logs to our treasury at confirmation depth, then re-verify the receipt.
 *  - Chain id, token contract, recipient, exact amount, confirmations and expiry are all checked.
 *  - Replays are impossible: UNIQUE(chain_id, tx_hash, log_index).
 *  - Under/over/late/unknown transfers are parked as 'unmatched' for admin review - never auto-credited.
 * No private keys exist in this module or anywhere in the app.
 */
export class CryptoGateway {
  constructor({ db, payments, audit, config, rpcFactory }) {
    Object.assign(this, { db, payments, audit, config });
    this.rpcInjected = Boolean(rpcFactory);
    this.rpcFactory = rpcFactory || ((network) => makeRpc(config.crypto.rpcUrls[network]));
    const c = config.crypto;
    this.treasury = c.treasuryAddress;
    this.networks = {};
    if (this.treasury && isValidEvmAddress(this.treasury)) {
      for (const n of c.enabledNetworks) {
        if (CRYPTO_NETWORKS[n] && (c.rpcUrls[n] || this.rpcInjected)) this.networks[n] = CRYPTO_NETWORKS[n];
      }
    }
    this.enabled = Object.keys(this.networks).length > 0;
    if (this.enabled) {
      payments.crypto = this;
      payments.registerProvider({
        id: 'crypto', label: 'Crypto (USDC / USDT)', methods: ['usdc', 'usdt'],
        createSession: () => { throw new Error('crypto sessions are allocated by the gateway'); },
        parseWebhook: () => { throw new AppError(400, 'NO_WEBHOOK', 'Crypto is verified on-chain, not by webhook.'); },
      });
    }
  }

  options() {
    return Object.entries(this.networks).map(([id, n]) => ({
      network: id, label: n.label, chainId: n.chainId, confirmations: n.confirmations, tokens: Object.keys(n.tokens),
    }));
  }

  allocate(row, { network, token }) {
    const net = this.networks[network];
    const tok = net?.tokens[String(token || '').toUpperCase()];
    if (!net || !tok) throw bad('UNSUPPORTED_ASSET', 'Unsupported crypto network or token.');
    const T = String(token).toUpperCase();
    const base = BigInt(row.amount_usd_cents) * 10n ** BigInt(tok.decimals - 2);
    for (let attempt = 0; attempt < 25; attempt++) {
      const tag = BigInt(crypto.randomInt(1, 10 ** (tok.decimals - 2)));
      const expected = (base + tag).toString();
      const clash = this.db.get(
        `SELECT 1 x FROM crypto_intents ci JOIN payment_intents pi ON pi.id = ci.intent_id
         WHERE ci.network = ? AND ci.token = ? AND ci.expected_atomic = ? AND pi.status IN ('pending','created','review')`,
        network, T, expected
      );
      if (clash) continue;
      return {
        providerRef: null,
        cryptoRow: { network, chainId: net.chainId, token: T, contract: tok.contract.toLowerCase(), decimals: tok.decimals, expected },
        clientAction: {
          type: 'crypto', network, networkLabel: net.label, chainId: net.chainId, token: T, tokenContract: tok.contract,
          payTo: this.treasury, amountAtomic: expected, amount: formatUnits(expected, tok.decimals), expiresAt: row.expires_at,
          confirmationsRequired: net.confirmations,
          warning: 'Send EXACTLY this amount of this token on this network. Other amounts or networks cannot be credited automatically.',
        },
      };
    }
    throw new AppError(503, 'BUSY', 'Please retry.');
  }

  persist(intentId, session) {
    const r = session.cryptoRow;
    this.db.run(
      'INSERT INTO crypto_intents (intent_id,network,chain_id,token,token_contract,decimals,treasury_address,expected_atomic) VALUES (?,?,?,?,?,?,?,?)',
      intentId, r.network, r.chainId, r.token, r.contract, r.decimals, this.treasury.toLowerCase(), r.expected
    );
  }

  /** Scan one network for new confirmed deposits. Safe to run repeatedly / concurrently. */
  async scanNetwork(network, { lookbackBlocks = 500, chunk = 2000 } = {}) {
    const net = this.networks[network];
    if (!net) throw bad('UNSUPPORTED_ASSET', 'Network not enabled.');
    const rpc = this.rpcFactory(network);
    const chainId = parseInt(await rpc('eth_chainId'), 16);
    if (chainId !== net.chainId) throw new Error(`RPC chain id ${chainId} != expected ${net.chainId}`);
    const latest = parseInt(await rpc('eth_blockNumber'), 16);
    const safeTo = latest - (net.confirmations - 1);
    const cur = this.db.get('SELECT last_block FROM chain_cursors WHERE network = ?', network);
    let from = cur ? cur.last_block + 1 : Math.max(0, safeTo - lookbackBlocks);
    const stats = { scanned: 0, credited: 0, unmatched: 0 };
    const contracts = Object.values(net.tokens).map((t) => t.contract);
    while (from <= safeTo) {
      const to = Math.min(safeTo, from + chunk - 1);
      const logs = await rpc('eth_getLogs', [{ address: contracts, fromBlock: hex(from), toBlock: hex(to), topics: [TRANSFER_TOPIC, null, pad32(this.treasury)] }]);
      for (const log of logs) {
        if (log.removed) continue;
        stats.scanned++;
        const r = await this._verifyAndRecord(network, net, rpc, log);
        if (r === 'credited') stats.credited++;
        if (r === 'unmatched') stats.unmatched++;
      }
      this.db.run('INSERT INTO chain_cursors (network,last_block) VALUES (?,?) ON CONFLICT(network) DO UPDATE SET last_block = excluded.last_block', network, to);
      from = to + 1;
    }
    this.payments.expireStale();
    return stats;
  }

  async _verifyAndRecord(network, net, rpc, log) {
    const chainId = net.chainId;
    const txHash = String(log.transactionHash).toLowerCase();
    const logIndex = parseInt(log.logIndex, 16);
    if (this.db.get('SELECT 1 x FROM crypto_transfers WHERE chain_id = ? AND tx_hash = ? AND log_index = ?', chainId, txHash, logIndex)) return 'duplicate';

    const tok = Object.values(net.tokens).find((t) => t.contract.toLowerCase() === String(log.address).toLowerCase());
    if (!tok || log.topics?.length !== 3 || log.topics[0] !== TRANSFER_TOPIC) return 'ignored';
    const to = topicToAddr(log.topics[2]);
    if (to !== this.treasury.toLowerCase()) return 'ignored';
    const amount = BigInt(log.data);
    if (amount < 10n ** BigInt(tok.decimals - 2)) return 'ignored'; // sub-cent dust / address-poisoning spam

    // Independent receipt re-verification (status + the log must really be in that tx).
    const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    const ok = receipt && receipt.status === '0x1' && receipt.logs?.some((l) =>
      l.address.toLowerCase() === String(log.address).toLowerCase() && parseInt(l.logIndex, 16) === logIndex &&
      l.topics?.[2]?.toLowerCase() === log.topics[2].toLowerCase() && BigInt(l.data) === amount);
    if (!ok) return 'ignored';
    const blockNumber = parseInt(log.blockNumber, 16);
    const block = await rpc('eth_getBlockByNumber', [log.blockNumber, false]);
    const blockTs = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();

    return this.db.tx(() => {
      const base = { id: newId('xfer'), chain_id: chainId, tx_hash: txHash, log_index: logIndex, block_number: blockNumber,
        token_contract: tok.contract.toLowerCase(), from_address: topicToAddr(log.topics[1]), to_address: to, amount_atomic: amount.toString(), created_at: nowIso() };
      const m = this.db.get(
        `SELECT pi.id, pi.status, pi.expires_at FROM crypto_intents ci JOIN payment_intents pi ON pi.id = ci.intent_id
         WHERE ci.network = ? AND lower(ci.token_contract) = ? AND ci.expected_atomic = ? AND pi.status IN ('pending','created','expired')`,
        network, base.token_contract, base.amount_atomic
      );
      const insert = (intentId, status, note) => this.db.run(
        'INSERT INTO crypto_transfers (id,chain_id,tx_hash,log_index,block_number,token_contract,from_address,to_address,amount_atomic,intent_id,status,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        base.id, chainId, txHash, logIndex, blockNumber, base.token_contract, base.from_address, to, base.amount_atomic, intentId, status, note, base.created_at);
      if (m && blockTs <= m.expires_at) {
        insert(m.id, 'credited', null);
        this.payments.creditIntent(m.id, `crypto:${chainId}:${txHash}:${logIndex}`);
        return 'credited';
      }
      let note = m ? `late_payment:${m.id}` : 'no_matching_intent';
      if (!m) {
        const unit = 10n ** BigInt(tok.decimals - 2);
        const near = this.db.all("SELECT ci.intent_id, ci.expected_atomic FROM crypto_intents ci JOIN payment_intents pi ON pi.id = ci.intent_id WHERE ci.network = ? AND ci.token = ? AND pi.status = 'pending'", network, tok === net.tokens.USDT ? 'USDT' : 'USDC')
          .find((c) => BigInt(c.expected_atomic) / unit === amount / unit);
        if (near) note = `possible_tag_mismatch:${near.intent_id}`;
      }
      insert(m?.id ?? null, 'unmatched', note);
      this.audit.record({ action: 'CRYPTO_UNMATCHED_TRANSFER', targetType: 'crypto_transfer', targetId: base.id, details: { txHash, amount: base.amount_atomic, note } });
      return 'unmatched';
    });
  }

  /** Admin resolution of an unmatched transfer (credits via the same idempotent path). */
  resolveTransfer(transferId, { intentId, reject, note }) {
    return this.db.tx(() => {
      const t = this.db.get('SELECT * FROM crypto_transfers WHERE id = ?', transferId);
      if (!t || t.status !== 'unmatched') throw bad('BAD_STATE', 'Transfer is not awaiting resolution.');
      if (reject) {
        this.db.run("UPDATE crypto_transfers SET status = 'rejected', note = ? WHERE id = ?", note || 'rejected', transferId);
        return { status: 'rejected' };
      }
      const i = this.db.get('SELECT * FROM payment_intents WHERE id = ?', intentId);
      if (!i || i.provider !== 'crypto') throw bad('BAD_INTENT', 'Unknown crypto intent.');
      const ci = this.db.get('SELECT * FROM crypto_intents WHERE intent_id = ?', intentId);
      if (ci.token_contract.toLowerCase() !== t.token_contract) throw bad('TOKEN_MISMATCH', 'Token differs from the intent.');
      const unit = 10n ** BigInt(ci.decimals - 2);
      if (BigInt(t.amount_atomic) / unit < BigInt(i.amount_usd_cents)) throw bad('UNDERPAID', 'Transfer is less than the purchase price; refund or request top-up instead.');
      this.db.run("UPDATE crypto_transfers SET status = 'resolved', intent_id = ?, note = ? WHERE id = ?", intentId, note || 'manual', transferId);
      this.payments.creditIntent(intentId, `crypto-manual:${transferId}`);
      return { status: 'resolved' };
    });
  }

  /** Verifies a payout transaction on-chain: treasury -> destination, exact token + amount, confirmed. */
  async verifyPayout(redemption, txHash) {
    const net = this.networks[redemption.network] || CRYPTO_NETWORKS[redemption.network];
    if (!net) throw bad('UNSUPPORTED_ASSET', 'Network not enabled.');
    const rpc = this.rpcFactory(redemption.network);
    const chainId = parseInt(await rpc('eth_chainId'), 16);
    if (chainId !== net.chainId) throw new Error('RPC chain id mismatch');
    const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    if (!receipt) return { state: 'pending', reason: 'not_found_yet' };
    if (receipt.status !== '0x1') return { state: 'failed', reason: 'tx_reverted' };
    const match = receipt.logs?.some((l) =>
      l.address.toLowerCase() === redemption.token_contract.toLowerCase() && l.topics?.[0] === TRANSFER_TOPIC &&
      topicToAddr(l.topics[1]) === this.treasury.toLowerCase() &&
      topicToAddr(l.topics[2]) === redemption.destination_address.toLowerCase() &&
      BigInt(l.data) === BigInt(redemption.amount_atomic));
    if (!match) return { state: 'mismatch', reason: 'no_matching_transfer_in_tx' };
    const latest = parseInt(await rpc('eth_blockNumber'), 16);
    const needed = this.config.redemptions.payoutConfirmations || net.confirmations;
    const confs = latest - parseInt(receipt.blockNumber, 16) + 1;
    return confs >= needed ? { state: 'confirmed', confirmations: confs } : { state: 'pending', reason: 'confirming', confirmations: confs };
  }
}
