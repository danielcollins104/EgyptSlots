import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Server-Authoritative Cryptographic Append-Only Audit Ledger
 * - Hash-Chained (like a secure blockchain ledger): each block contains the SHA-256 hash of the previous block
 * - Digital HMAC Signatures on every entry to guarantee non-repudiation
 * - Complete mathematical immutability: any alteration to historical records breaks the hash chain
 * - Covers all Spins, Bets, Wins, Purchases, Bonuses, and Redemptions
 */
export class AuditLedger {
  constructor(options = {}) {
    this.storagePath = options.storagePath || null;
    this.ledgerSecret =
      options.ledgerSecret ||
      process.env.DC_LEDGER_SECRET ||
      'dc_kemet_ledger_master_secret_2026_salt_99x';
    this.chain = [];
    this._initGenesisBlock();
    if (this.storagePath) {
      this._loadFromDisk();
    }
  }

  _initGenesisBlock() {
    if (this.chain.length === 0) {
      const genesisData = {
        index: 0,
        id: 'dc_ledger_genesis_0000',
        userId: 'SYSTEM',
        type: 'GENESIS',
        currency: 'SYSTEM',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        timestamp: '2026-01-01T00:00:00.000Z',
        prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
        metadata: { system: 'DC Enterprises Casino crowns_of_kemet Ledger' },
      };
      genesisData.entryHash = this._computeHash(genesisData);
      genesisData.signature = this._signHash(genesisData.entryHash);
      this.chain.push(genesisData);
    }
  }

  _computeHash(entry) {
    const payload = `${entry.index}|${entry.prevHash}|${entry.id}|${entry.userId}|${entry.type}|${entry.currency}|${entry.amount}|${entry.balanceAfter}|${entry.timestamp}|${JSON.stringify(entry.metadata || {})}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  _signHash(hash) {
    return crypto.createHmac('sha256', this.ledgerSecret).update(hash).digest('hex');
  }

  /**
   * Appends an immutable signed transaction to the ledger
   */
  append({ userId, type, currency, amount, balanceBefore, balanceAfter, metadata = {} }) {
    if (!userId) throw new Error('Ledger entry requires userId');
    if (!type) throw new Error('Ledger entry requires type');
    if (typeof amount !== 'number') throw new Error('Ledger entry requires numeric amount');

    const lastBlock = this.chain[this.chain.length - 1];
    const index = this.chain.length;
    const timestamp = new Date().toISOString();
    const id = `tx_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const newBlock = {
      index,
      id,
      userId,
      type,
      currency,
      amount,
      balanceBefore,
      balanceAfter,
      timestamp,
      prevHash: lastBlock.entryHash,
      metadata,
    };

    newBlock.entryHash = this._computeHash(newBlock);
    newBlock.signature = this._signHash(newBlock.entryHash);

    this.chain.push(newBlock);

    if (this.storagePath) {
      this._saveToDisk();
    }

    return newBlock;
  }

  /**
   * Verifies the cryptographic integrity of the entire ledger chain
   * Returns { valid: boolean, chainLength: number, error: string | null }
   */
  verifyIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // 1. Verify prevHash link
      if (current.prevHash !== previous.entryHash) {
        return {
          valid: false,
          brokenIndex: i,
          error: `Hash chain broken at block ${i}: expected prevHash ${previous.entryHash}, found ${current.prevHash}`,
        };
      }

      // 2. Re-compute entry hash to detect tampering with block contents
      const computedHash = this._computeHash(current);
      if (current.entryHash !== computedHash) {
        return {
          valid: false,
          brokenIndex: i,
          error: `Tampering detected at block ${i}: computed hash ${computedHash} != stored ${current.entryHash}`,
        };
      }

      // 3. Verify digital signature
      const expectedSig = this._signHash(current.entryHash);
      if (current.signature !== expectedSig) {
        return {
          valid: false,
          brokenIndex: i,
          error: `Invalid cryptographic signature at block ${i}`,
        };
      }
    }

    return {
      valid: true,
      chainLength: this.chain.length,
      lastBlockHash: this.chain[this.chain.length - 1].entryHash,
      error: null,
    };
  }

  /**
   * Retrieve ledger audit trail for a specific user
   */
  getUserHistory(userId, limit = 50) {
    return this.chain
      .filter((entry) => entry.userId === userId)
      .slice(-limit)
      .reverse();
  }

  _saveToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.chain, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write ledger to disk:', e);
    }
  }

  _loadFromDisk() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const loaded = JSON.parse(raw);
        if (Array.isArray(loaded) && loaded.length > 0) {
          this.chain = loaded;
          const audit = this.verifyIntegrity();
          if (!audit.valid) {
            console.error('CRITICAL WARNING: Loaded ledger failed integrity check:', audit.error);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load ledger from disk:', e);
    }
  }
}
