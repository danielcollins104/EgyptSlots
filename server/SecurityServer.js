import crypto from 'node:crypto';
import { ServerRNG } from './engine/ServerRNG.js';
import { AuditLedger } from './ledger/AuditLedger.js';
import { ServerWallet } from './engine/ServerWallet.js';
import { ServerSpinService } from './engine/ServerSpinService.js';
import { SecurityAuthService } from './auth/SecurityAuthService.js';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';

/**
 * DC Enterprises Casino — Master Security Server Controller
 * Centralizes all 5 Critical Security Safeguards:
 * 1. Server-Authoritative CSPRNG Spin Engine
 * 2. Atomic Multi-Currency Wallet & Anti-Tamper Balance Guard
 * 3. Immutable Hash-Chained Cryptographic Transaction Ledger
 * 4. Administrator RBAC & Constant-Time Protected Secrets
 * 5. Player Account Protection & Anti-Fraud Suite
 */
export class SecurityServer {
  constructor(options = {}) {
    this.ledger = new AuditLedger({
      storagePath: options.ledgerPath || null,
      ledgerSecret: options.ledgerSecret,
    });
    this.wallet = new ServerWallet(this.ledger, options.initialAccounts || {});
    this.spinService = new ServerSpinService(this.wallet, this.ledger, {
      signingKey: options.signingKey,
    });
    this.authService = new SecurityAuthService(this.ledger, {
      adminSecret: options.adminSecret,
    });

    // Idempotency cache for payment confirmations (processor callbacks / operator actions)
    this.processedPaymentEvents = new Set();
  }

  /**
   * Helper to verify authentication token from request
   */
  _authenticate(token, requiredRole = null) {
    return this.authService.validateSession(token, requiredRole);
  }

  // =========================================================================
  // 1. GAME OUTCOME & SPIN SECURITY ENDPOINTS
  // =========================================================================

  /**
   * Get Provably Fair public commitment (pre-spin hash)
   */
  getProvablyFairCommitment() {
    return this.spinService.getPublicCommitment();
  }

  /**
   * Rotate Provably Fair Server Seed and reveal previous unhashed seed
   */
  rotateProvablyFairSeed() {
    return this.spinService.rotateServerSeed();
  }

  /**
   * Verify a historical spin outcome deterministically
   */
  verifyProvablyFairSpin(params) {
    return this.spinService.verifySpinOutcome(params);
  }

  /**
   * Handle Authoritative Spin Request
   */
  async handleSpinRequest(authToken, { currencyMode = 'GC', betLevel = 1, selectedLines = 15, clientSeed, currentBetSC }) {
    const session = this._authenticate(authToken);
    return await this.spinService.executeSpin({
      userId: session.userId,
      currencyMode,
      betLevel,
      selectedLines,
      clientSeed,
      currentBetSC,
    });
  }

  // =========================================================================
  // 2. CURRENCY & WALLET SECURITY ENDPOINTS
  // =========================================================================

  /**
   * Get authoritative user balance
   */
  async getBalance(authToken) {
    const session = this._authenticate(authToken);
    const acc = this.wallet.getAccount(session.userId);
    return {
      userId: session.userId,
      goldCoins: acc.goldCoins,
      sweepsCoins: acc.sweepsCoins,
      unplayedSC: acc.unplayedSC,
      redeemedSC: acc.redeemedSC,
    };
  }

  /**
   * Handle cash prize redemption request (requires verified SC balance + 1x rollover)
   */
  async handleRedemptionRequest(authToken, { amountSC, payoutMethod, destinationMasked }) {
    const session = this._authenticate(authToken);
    return await this.wallet.requestRedemption(session.userId, amountSC, {
      method: payoutMethod,
      destinationMasked,
    });
  }

  // =========================================================================
  // 3. PAYMENT WEBHOOK & ANTI-REPLAY SECURITY
  // =========================================================================

  /**
   * Processor-agnostic payment confirmation with idempotency & optional HMAC
   * signature verification. Used for manual/operator confirmations now and
   * ready for Skrill-style server-to-server status callbacks later.
   *
   * @param {object} payload - { eventId, paymentRef, userId, goldCoins, freeSweepsCoins,
   *                              packageId, signatureHeader, webhookSecret, rawBody, signatureScheme }
   */
  async handlePaymentConfirmation(payload = {}) {
    const eventId = payload.eventId || `evt_${Date.now()}`;
    const { paymentRef = '', signatureHeader, webhookSecret, rawBody, signatureScheme = 'generic' } = payload;

    // 1. Prevent replay attacks: idempotency
    if (this.processedPaymentEvents.has(eventId)) {
      return { status: 'ignored', message: `Event ${eventId} has already been processed.` };
    }

    // 2. Optional HMAC-SHA256 verification ("t=...,v1=..." scheme, timing-safe)
    if (webhookSecret && signatureHeader) {
      const parts = signatureHeader.split(',').map((p) => p.trim());
      const tPart = parts.find((p) => p.startsWith('t='));
      const v1Parts = parts.filter((p) => p.startsWith('v1='));
      const timestamp = tPart?.slice(2);
      const expectedSigs = v1Parts.map((p) => p.slice(3)).filter(Boolean);
      if (!timestamp || expectedSigs.length === 0) {
        throw new Error(`Invalid ${signatureScheme} signature header structure`);
      }
      if (typeof rawBody === 'string' && rawBody.length > 0) {
        const signedPayload = `${timestamp}.${rawBody}`;
        const computedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(signedPayload, 'utf8')
          .digest('hex');
        const computedBuf = Buffer.from(computedSig, 'hex');
        const matched = expectedSigs.some((sig) => {
          try {
            const sigBuf = Buffer.from(sig, 'hex');
            return sigBuf.length === computedBuf.length && crypto.timingSafeEqual(sigBuf, computedBuf);
          } catch {
            return false;
          }
        });
        if (!matched) {
          throw new Error('Payment callback signature verification failed');
        }
      }
    }

    // 3. Credit the purchase (idempotent per event)
    const userId = payload.userId;
    const goldCoins = parseInt(payload.goldCoins, 10);
    const freeSweepsCoins = parseFloat(payload.freeSweepsCoins);
    if (!userId || !(goldCoins > 0)) {
      throw new Error('Malformed payment confirmation: missing userId or positive goldCoins');
    }

    const creditResult = await this.wallet.processPurchaseCredit(userId, {
      goldCoinsToAdd: goldCoins,
      freeSweepsCoinsToAdd: freeSweepsCoins || 0,
      packageId: payload.packageId || 'custom',
      paymentRef: paymentRef || eventId,
    });

    this.processedPaymentEvents.add(eventId);
    return { status: 'credited', eventId, userId, creditResult };
  }


  // =========================================================================
  // 4. TRANSACTION LEDGER & CRYPTOGRAPHIC AUDIT ENDPOINTS
  // =========================================================================

  /**
   * Returns user's personal audit trail
   */
  getUserAuditHistory(authToken, limit = 50) {
    const session = this._authenticate(authToken);
    return this.ledger.getUserHistory(session.userId, limit);
  }

  /**
   * Verify integrity of the entire casino ledger (open to auditors & admins)
   */
  verifyLedgerIntegrity(authToken) {
    this._authenticate(authToken, 'AUDITOR');
    return this.ledger.verifyIntegrity();
  }

  // =========================================================================
  // 5. ADMINISTRATOR OPERATIONS & ACCESS CONTROL
  // =========================================================================

  /**
   * Admin Authentication
   */
  adminLogin(adminSecretKey) {
    return this.authService.authenticateAdmin(adminSecretKey);
  }

  /**
   * Protected Admin Balance Adjustment (Logged immutably to ledger)
   */
  async adminAdjustBalance(adminToken, { targetUserId, currency, amount, reason }) {
    const adminSession = this._authenticate(adminToken, 'ADMIN');

    if (amount === 0) throw new Error('Adjustment amount cannot be zero');
    if (!reason || reason.length < 5) throw new Error('A detailed reason is mandatory for admin adjustments');

    const acc = this.wallet.getAccount(targetUserId);
    const isSC = currency === 'SC';
    const balBefore = isSC ? acc.sweepsCoins : acc.goldCoins;
    const balAfter = isSC ? Number((balBefore + amount).toFixed(2)) : balBefore + amount;

    if (balAfter < 0) {
      throw new Error(`Admin adjustment would result in illegal negative balance (${balAfter})`);
    }

    if (isSC) {
      acc.sweepsCoins = balAfter;
    } else {
      acc.goldCoins = balAfter;
    }

    const tx = this.ledger.append({
      userId: targetUserId,
      type: 'ADMIN_ADJUSTMENT',
      currency,
      amount,
      balanceBefore: balBefore,
      balanceAfter: balAfter,
      metadata: {
        adminId: adminSession.userId,
        adminName: adminSession.name,
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      targetUserId,
      currency,
      balanceBefore: balBefore,
      balanceAfter: balAfter,
      transactionId: tx.id,
    };
  }

  /**
   * Protected Admin Full Ledger Inspection
   */
  adminGetFullLedger(adminToken, limit = 100) {
    this._authenticate(adminToken, 'ADMIN');
    return this.ledger.chain.slice(-limit).reverse();
  }
}
