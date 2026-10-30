/**
 * Server-Authoritative Atomic Wallet Engine
 * Enforces dual-currency segregation (Gold Coins vs Sweeps Coins)
 * Guarantees zero negative balances, anti-double-spending, and atomic commit locks
 */
export class ServerWallet {
  constructor(ledger, initialAccounts = {}) {
    this.ledger = ledger;
    this.accounts = new Map(); // userId -> { goldCoins, sweepsCoins, unplayedSC, redeemedSC, nonce }
    this.locks = new Set(); // Concurrency lock per userId to prevent race-condition double-spend

    // Populate initial accounts
    Object.entries(initialAccounts).forEach(([id, acc]) => {
      this.accounts.set(id, {
        goldCoins: acc.goldCoins ?? 100000,
        sweepsCoins: acc.sweepsCoins ?? 10.0,
        unplayedSC: acc.unplayedSC ?? acc.sweepsCoins ?? 10.0,
        redeemedSC: acc.redeemedSC ?? 0,
        nonce: acc.nonce ?? 0,
      });
    });
  }

  getAccount(userId) {
    if (!this.accounts.has(userId)) {
      // Default initial welcome bonus for new verified account
      this.accounts.set(userId, {
        goldCoins: 100000,
        sweepsCoins: 10.0,
        unplayedSC: 10.0,
        redeemedSC: 0,
        nonce: 0,
      });
    }
    return this.accounts.get(userId);
  }

  /**
   * Acquires atomic execution lock on user account (prevents concurrent race conditions)
   */
  async acquireLock(userId) {
    let retries = 20;
    while (this.locks.has(userId) && retries > 0) {
      await new Promise((r) => setTimeout(r, 20));
      retries--;
    }
    if (this.locks.has(userId)) {
      throw new Error('Concurrent transaction in progress. Please wait.');
    }
    this.locks.add(userId);
  }

  releaseLock(userId) {
    this.locks.delete(userId);
  }

  /**
   * Atomic spin bet deduction
   */
  async deductBet(userId, currency, betAmount) {
    if (betAmount <= 0) throw new Error('Bet amount must be positive');
    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);
      const isSC = currency === 'SC';
      const currentBal = isSC ? acc.sweepsCoins : acc.goldCoins;

      if (currentBal < betAmount) {
        throw new Error(`Insufficient funds: required ${betAmount} ${currency}, available ${currentBal} ${currency}`);
      }

      const balanceBefore = currentBal;
      const balanceAfter = isSC ? Number((currentBal - betAmount).toFixed(2)) : currentBal - betAmount;

      if (isSC) {
        acc.sweepsCoins = balanceAfter;
        // Count towards rollover requirement
        acc.unplayedSC = Math.max(0, Number((acc.unplayedSC - betAmount).toFixed(2)));
      } else {
        acc.goldCoins = balanceAfter;
      }
      acc.nonce += 1;

      // Log to cryptographic audit ledger
      const tx = this.ledger.append({
        userId,
        type: 'BET',
        currency,
        amount: -betAmount,
        balanceBefore,
        balanceAfter,
        metadata: { nonce: acc.nonce },
      });

      return {
        success: true,
        currency,
        balanceBefore,
        balanceAfter,
        nonce: acc.nonce,
        transactionId: tx.id,
      };
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Atomic win credit
   */
  async creditWin(userId, currency, winAmount, metadata = {}) {
    if (winAmount < 0) throw new Error('Win amount cannot be negative');
    if (winAmount === 0) return { success: true, winAmount: 0 };

    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);
      const isSC = currency === 'SC';
      const currentBal = isSC ? acc.sweepsCoins : acc.goldCoins;
      const balanceBefore = currentBal;
      const balanceAfter = isSC ? Number((currentBal + winAmount).toFixed(2)) : currentBal + winAmount;

      if (isSC) {
        acc.sweepsCoins = balanceAfter;
      } else {
        acc.goldCoins = balanceAfter;
      }

      const tx = this.ledger.append({
        userId,
        type: 'WIN',
        currency,
        amount: winAmount,
        balanceBefore,
        balanceAfter,
        metadata,
      });

      return {
        success: true,
        currency,
        winAmount,
        balanceBefore,
        balanceAfter,
        transactionId: tx.id,
      };
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Process verified purchase credit (Stripe / Chime)
   */
  async processPurchaseCredit(userId, { goldCoinsToAdd, freeSweepsCoinsToAdd, packageId, paymentRef }) {
    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);

      const gcBefore = acc.goldCoins;
      const scBefore = acc.sweepsCoins;

      acc.goldCoins += goldCoinsToAdd;
      acc.sweepsCoins = Number((acc.sweepsCoins + freeSweepsCoinsToAdd).toFixed(2));
      acc.unplayedSC = Number((acc.unplayedSC + freeSweepsCoinsToAdd).toFixed(2));

      const txGC = this.ledger.append({
        userId,
        type: 'PURCHASE_GC',
        currency: 'GC',
        amount: goldCoinsToAdd,
        balanceBefore: gcBefore,
        balanceAfter: acc.goldCoins,
        metadata: { packageId, paymentRef },
      });

      const txSC = this.ledger.append({
        userId,
        type: 'PROMOTIONAL_SC_GRANT',
        currency: 'SC',
        amount: freeSweepsCoinsToAdd,
        balanceBefore: scBefore,
        balanceAfter: acc.sweepsCoins,
        metadata: { packageId, paymentRef, note: 'Free sweepstakes bonus entry with GC purchase' },
      });

      return {
        success: true,
        goldCoins: acc.goldCoins,
        sweepsCoins: acc.sweepsCoins,
        transactions: [txGC.id, txSC.id],
      };
    } finally {
      this.releaseLock(userId);
    }
  }

  /**
   * Validate and request Cash Prize Redemption for Sweeps Coins
   */
  async requestRedemption(userId, amountSC, payoutDetails) {
    if (amountSC < 50.0) {
      throw new Error('Minimum prize redemption threshold is 50.00 SC ($50.00 USD)');
    }

    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);
      if (acc.sweepsCoins < amountSC) {
        throw new Error(`Insufficient Sweeps Coins: requested ${amountSC} SC, balance is ${acc.sweepsCoins} SC`);
      }

      // Check rollover (1x playthrough requirement)
      const eligibleToRedeem = acc.sweepsCoins - acc.unplayedSC;
      if (eligibleToRedeem < amountSC) {
        throw new Error(
          `Playthrough requirement not met. Eligible redeemable balance is ${eligibleToRedeem.toFixed(2)} SC. You have ${acc.unplayedSC.toFixed(2)} SC unplayed bonus entries.`
        );
      }

      const balanceBefore = acc.sweepsCoins;
      acc.sweepsCoins = Number((acc.sweepsCoins - amountSC).toFixed(2));
      acc.redeemedSC = Number((acc.redeemedSC + amountSC).toFixed(2));

      const tx = this.ledger.append({
        userId,
        type: 'REDEMPTION_REQUEST',
        currency: 'SC',
        amount: -amountSC,
        balanceBefore,
        balanceAfter: acc.sweepsCoins,
        metadata: { payoutMethod: payoutDetails.method, destinationMasked: payoutDetails.destinationMasked },
      });

      return {
        success: true,
        amountRedeemedSC: amountSC,
        remainingSC: acc.sweepsCoins,
        redemptionId: tx.id,
      };
    } finally {
      this.releaseLock(userId);
    }
  }
}
