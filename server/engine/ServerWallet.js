/**
 * Server-Authoritative Atomic Wallet Engine
 * Enforces dual-currency segregation (Gold Coins vs Sweeps Coins)
 * Guarantees zero negative balances, anti-double-spending, and atomic commit locks
 */
export class ServerWallet {
  /**
   * Exact integer-cent conversion helpers to eliminate IEEE-754 floating-point drift
   */
  static toCents(amount) {
    return Math.round((Number(amount) || 0) * 100);
  }

  static fromCents(cents) {
    return Number((Math.round(cents) / 100).toFixed(2));
  }

  constructor(ledger, initialAccounts = {}) {
    this.ledger = ledger;
    this.accounts = new Map(); // userId -> { goldCoins, sweepsCoins, unplayedSC, redeemedSC, nonce }
    this.locks = new Set(); // Concurrency lock per userId to prevent race-condition double-spend

    // Populate initial accounts
    Object.entries(initialAccounts).forEach(([id, acc]) => {
      const initSC = ServerWallet.fromCents(ServerWallet.toCents(acc.sweepsCoins ?? 10.0));
      const initUnplayed = ServerWallet.fromCents(ServerWallet.toCents(acc.unplayedSC ?? acc.sweepsCoins ?? 10.0));
      this.accounts.set(id, {
        goldCoins: Math.round(acc.goldCoins ?? 100000),
        sweepsCoins: initSC,
        unplayedSC: initUnplayed,
        redeemedSC: ServerWallet.fromCents(ServerWallet.toCents(acc.redeemedSC ?? 0)),
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
   * Atomic spin bet deduction (using exact integer-cent math for SC)
   */
  async deductBet(userId, currency, betAmount) {
    if (betAmount <= 0) throw new Error('Bet amount must be positive');
    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);
      const isSC = currency === 'SC';
      const currentBal = isSC ? acc.sweepsCoins : acc.goldCoins;

      if (isSC) {
        const currentCents = ServerWallet.toCents(currentBal);
        const betCents = ServerWallet.toCents(betAmount);
        if (currentCents < betCents) {
          throw new Error(`Insufficient funds: required ${betAmount} ${currency}, available ${currentBal} ${currency}`);
        }
        const balanceBefore = currentBal;
        const balanceAfter = ServerWallet.fromCents(currentCents - betCents);
        acc.sweepsCoins = balanceAfter;
        const unplayedCents = Math.max(0, ServerWallet.toCents(acc.unplayedSC) - betCents);
        acc.unplayedSC = ServerWallet.fromCents(unplayedCents);
        acc.nonce += 1;

        const tx = this.ledger.append({
          userId,
          type: 'BET',
          currency,
          amount: -ServerWallet.fromCents(betCents),
          balanceBefore,
          balanceAfter,
          metadata: { nonce: acc.nonce, amountCents: -betCents },
        });

        return {
          success: true,
          currency,
          balanceBefore,
          balanceAfter,
          nonce: acc.nonce,
          transactionId: tx.id,
        };
      }

      if (currentBal < betAmount) {
        throw new Error(`Insufficient funds: required ${betAmount} ${currency}, available ${currentBal} ${currency}`);
      }

      const balanceBefore = currentBal;
      const balanceAfter = Math.round(currentBal - betAmount);
      acc.goldCoins = balanceAfter;
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
   * Atomic win credit (using exact integer-cent math for SC)
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
      const normalizedWin = isSC
        ? ServerWallet.fromCents(ServerWallet.toCents(winAmount))
        : Math.round(winAmount);
      const balanceAfter = isSC
        ? ServerWallet.fromCents(ServerWallet.toCents(currentBal) + ServerWallet.toCents(winAmount))
        : Math.round(currentBal + winAmount);

      if (isSC) {
        acc.sweepsCoins = balanceAfter;
      } else {
        acc.goldCoins = balanceAfter;
      }

      const tx = this.ledger.append({
        userId,
        type: 'WIN',
        currency,
        amount: normalizedWin,
        balanceBefore,
        balanceAfter,
        metadata: isSC ? { ...metadata, winCents: ServerWallet.toCents(winAmount) } : metadata,
      });

      return {
        success: true,
        currency,
        winAmount: normalizedWin,
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

      acc.goldCoins = Math.round(acc.goldCoins + (Number(goldCoinsToAdd) || 0));
      const addScCents = ServerWallet.toCents(freeSweepsCoinsToAdd);
      acc.sweepsCoins = ServerWallet.fromCents(ServerWallet.toCents(acc.sweepsCoins) + addScCents);
      acc.unplayedSC = ServerWallet.fromCents(ServerWallet.toCents(acc.unplayedSC) + addScCents);

      const txGC = this.ledger.append({
        userId,
        type: 'PURCHASE_GC',
        currency: 'GC',
        amount: Math.round(Number(goldCoinsToAdd) || 0),
        balanceBefore: gcBefore,
        balanceAfter: acc.goldCoins,
        metadata: { packageId, paymentRef },
      });

      const txSC = this.ledger.append({
        userId,
        type: 'PROMOTIONAL_SC_GRANT',
        currency: 'SC',
        amount: ServerWallet.fromCents(addScCents),
        balanceBefore: scBefore,
        balanceAfter: acc.sweepsCoins,
        metadata: { packageId, paymentRef, amountCents: addScCents, note: 'Free sweepstakes bonus entry with GC purchase' },
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
  async requestRedemption(userId, amountSC, payoutDetails = {}) {
    const isGiftCard = payoutDetails?.method === 'giftcard';
    const minSC = isGiftCard ? 25.0 : 50.0;
    const reqCents = ServerWallet.toCents(amountSC);
    const minCents = ServerWallet.toCents(minSC);

    if (reqCents < minCents) {
      if (isGiftCard) {
        throw new Error('Minimum gift card prize redemption threshold is 25.00 SC ($25.00 USD)');
      }
      throw new Error('Minimum prize redemption threshold is 50.00 SC ($50.00 USD)');
    }

    await this.acquireLock(userId);
    try {
      const acc = this.getAccount(userId);
      const balCents = ServerWallet.toCents(acc.sweepsCoins);
      if (balCents < reqCents) {
        throw new Error(`Insufficient Sweeps Coins: requested ${amountSC} SC, balance is ${acc.sweepsCoins} SC`);
      }

      // Check rollover (1x playthrough requirement) in exact integer cents
      const unplayedCents = ServerWallet.toCents(acc.unplayedSC);
      const eligibleCents = Math.max(0, balCents - unplayedCents);
      const eligibleToRedeem = ServerWallet.fromCents(eligibleCents);
      if (eligibleCents < reqCents) {
        throw new Error(
          `Playthrough requirement not met. Eligible redeemable balance is ${eligibleToRedeem.toFixed(2)} SC. You have ${acc.unplayedSC.toFixed(2)} SC unplayed bonus entries.`
        );
      }

      const balanceBefore = acc.sweepsCoins;
      const exactAmountSC = ServerWallet.fromCents(reqCents);
      acc.sweepsCoins = ServerWallet.fromCents(balCents - reqCents);
      acc.redeemedSC = ServerWallet.fromCents(ServerWallet.toCents(acc.redeemedSC) + reqCents);

      const tx = this.ledger.append({
        userId,
        type: 'REDEMPTION_REQUEST',
        currency: 'SC',
        amount: -exactAmountSC,
        balanceBefore,
        balanceAfter: acc.sweepsCoins,
        metadata: {
          payoutMethod: payoutDetails?.method,
          destinationMasked: payoutDetails?.destinationMasked,
          amountCents: -reqCents,
        },
      });

      return {
        success: true,
        amountRedeemedSC: exactAmountSC,
        remainingSC: acc.sweepsCoins,
        redemptionId: tx.id,
      };
    } finally {
      this.releaseLock(userId);
    }
  }
}
