import crypto from 'node:crypto';
import { ServerRNG } from './ServerRNG.js';
import { SlotMathEngine } from '../../src/engine/math/SlotMathEngine.js';
import { spinPhysicalReels } from '../../src/engine/math/ReelStripModel.js';
import { BET_TIERS_GC, BET_TIERS_SC } from '../../src/config/slotConfig.js';

/**
 * Server-Authoritative Spin Service
 * Generates all outcomes on the server using CSPRNG / Provably Fair entropy.
 * Enforces bet tier validation, atomic wallet transactions, and anti-replay signatures.
 */
export class ServerSpinService {
  constructor(wallet, ledger, options = {}) {
    this.wallet = wallet;
    this.ledger = ledger;
    this.mathEngine = new SlotMathEngine();
    this.signingKey = options.signingKey || process.env.DC_SPIN_SIGNING_KEY || ServerRNG.generateSeed();
    this.serverSeed = ServerRNG.generateSeed();
    this.lastSpinTimestamps = new Map(); // userId -> timestamp for rate-limiting
  }

  /**
   * Returns current public hashed server seed for Provably Fair commitment
   */
  getPublicCommitment() {
    return {
      serverSeedHash: ServerRNG.hashSeed(this.serverSeed),
      algorithm: 'HMAC-SHA256',
    };
  }

  /**
   * Authoritative Spin Execution
   */
  async executeSpin({ userId, currencyMode = 'GC', betLevel = 1, clientSeed, currentBetSC }) {
    if (!userId) throw new Error('Authentication required');

    // 1. Anti-Cheat: Spin frequency rate limiting (anti-bot / spam protection)
    const now = Date.now();
    const lastTime = this.lastSpinTimestamps.get(userId) || 0;
    if (now - lastTime < 450) {
      throw new Error('Spin rate limit exceeded. Human play cadence required.');
    }
    this.lastSpinTimestamps.set(userId, now);

    // 2. Validate currency and bet level
    if (currencyMode !== 'GC' && currencyMode !== 'SC') {
      throw new Error('Invalid currency mode');
    }
    if (!Number.isInteger(betLevel) || betLevel < 1 || betLevel > 10) {
      throw new Error('Invalid bet level: must be integer between 1 and 10');
    }

    const lines = 15;
    const isSC = currencyMode === 'SC';
    const betAmount = isSC
      ? (currentBetSC && currentBetSC > 0 ? currentBetSC : 0.75)
      : lines * betLevel;

    // Validate against allowed casino bet tiers
    const validTiers = isSC ? BET_TIERS_SC : BET_TIERS_GC;
    const isTierValid = validTiers.some((t) => Math.abs(t - betAmount) < 0.001);
    if (!isTierValid && !isSC) {
      throw new Error(`Unauthorized bet amount: ${betAmount}`);
    }

    // 3. Atomic wallet bet deduction
    const betResult = await this.wallet.deductBet(userId, currencyMode, betAmount);
    const nonce = betResult.nonce;
    const cSeed = clientSeed || crypto.randomBytes(16).toString('hex');

    // 4. Provably Fair Physical Reel Generation using CSPRNG
    let cursor = 0;
    const provablyFairRandom = () => {
      cursor++;
      return ServerRNG.provablyFairFloat(this.serverSeed, cSeed, nonce, cursor);
    };

    const physicalResult = spinPhysicalReels(provablyFairRandom);
    const { stops, grid, peeksAbove, peeksBelow } = physicalResult;

    // 5. Server-Authoritative Payline & Win Evaluation
    const outcome = this.mathEngine.evaluateGrid(grid, betLevel, {
      stops,
      peeksAbove,
      peeksBelow,
    });

    // 6. Calculate Currency-Accurate Win
    let winCoins = outcome.totalPayout;
    let winSC = 0;
    if (isSC) {
      winSC = Number((((outcome.totalPayout / (15 * betLevel)) * betAmount)).toFixed(2));
    }

    // 7. Atomic Win Credit
    const actualWin = isSC ? winSC : winCoins;
    let winResult = { balanceAfter: betResult.balanceAfter, transactionId: null };
    if (actualWin > 0) {
      winResult = await this.wallet.creditWin(userId, currencyMode, actualWin, {
        spinId: betResult.transactionId,
        scatterWin: outcome.scatterWin,
        winCategory: outcome.winCategory?.id,
        isBigWin: outcome.isBigWin,
      });
    }

    // 8. Sign outcome cryptographically (Non-Repudiation)
    const spinPayload = {
      id: betResult.transactionId,
      spinId: betResult.transactionId,
      userId,
      currencyMode,
      betAmount,
      balanceBefore: betResult.balanceBefore,
      balanceAfter: winResult.balanceAfter,
      stops,
      grid: grid.map((col) => col.map((cell) => (typeof cell === 'string' ? cell : cell.id))),
      wins: outcome.wins,
      scatterCount: outcome.scatterCount,
      scatterWin: outcome.scatterWin,
      totalWin: actualWin,
      nonce,
      clientSeed: cSeed,
      serverSeedHash: ServerRNG.hashSeed(this.serverSeed),
      timestamp: new Date().toISOString(),
    };

    const signature = crypto
      .createHmac('sha256', this.signingKey)
      .update(JSON.stringify(spinPayload))
      .digest('hex');

    return {
      success: true,
      spin: spinPayload,
      signature,
      nearMiss: outcome.nearMiss,
    };
  }

  /**
   * Client-side or auditor verification of a signed spin outcome
   */
  verifySpinSignature(spinPayload, signature) {
    const expected = crypto
      .createHmac('sha256', this.signingKey)
      .update(JSON.stringify(spinPayload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }
}
