// ============================================================================
// PAYMENT PROCESSOR PLUGIN REGISTRY
// ============================================================================
// Processor-agnostic money rails. Each processor implements the same contract
// so adding/removing rails is a config change, never a rewrite.
//
// Contract (all methods optional except meta):
//   meta: { id, label, shortLabel, badge, bonusScPct, subtitle, enabled, comingSoon }
//   getDepositInstructions(pkg, context) -> { amountUsd, address?, cashtag?, deepLink, qrContent,
//                                              orderRef, steps[], note? }
//   verifyDeposit(instructions, context)   -> Promise<{ verified, statusText, ... }>
//   getPayoutInstructions(redemption)      -> instructions for the operator console
//
// LIVE RAILS   : crypto (BTC/ETH/SOL/USDT on-chain), cashapp (P2P w/ order reference)
// READY STUBS  : skrill (e-wallet), walletpay (Google Pay / Apple Pay via PSP)
// To enable a stub: set `enabled: true`, fill in its config, done.
// ============================================================================

import { cryptoProcessor } from './processors/cryptoProcessor.js';
import { cashAppProcessor } from './processors/cashAppProcessor.js';
import { skrillProcessor } from './processors/skrillProcessor.js';
import { walletPayProcessor } from './processors/walletPayProcessor.js';

const PROCESSORS = [cryptoProcessor, cashAppProcessor, skrillProcessor, walletPayProcessor];

export const paymentProcessorRegistry = {
  getAll() {
    return PROCESSORS.slice();
  },

  /** Enabled processors, in display order */
  getEnabled() {
    return PROCESSORS.filter((p) => p?.meta?.enabled !== false);
  },

  getById(id) {
    return PROCESSORS.find((p) => p?.meta?.id === id) || null;
  },

  isEnabled(id) {
    const p = this.getById(id);
    return Boolean(p && p.meta.enabled !== false);
  },

  /** Map processors to checkout-rail descriptors for the UI */
  getRails() {
    return this.getEnabled().map((p) => ({
      id: p.meta.id,
      label: p.meta.label,
      shortLabel: p.meta.shortLabel,
      badge: p.meta.badge,
      bonusScPct: p.meta.bonusScPct || 0,
      subtitle: p.meta.subtitle,
    }));
  },

  /**
   * Route a deposit: resolves pkg -> processor deposit instructions.
   * Throws if the processor is disabled/unknown.
   */
  async initiateDeposit(processorId, pkg, context = {}) {
    const processor = this.getById(processorId);
    if (!processor) throw new Error(`Unknown payment processor: ${processorId}`);
    if (processor.meta.enabled === false) {
      throw new Error(`${processor.meta.label} is coming soon — please choose another method.`);
    }
    if (typeof processor.getDepositInstructions !== 'function') {
      throw new Error(`${processor.meta.label} does not support deposits yet.`);
    }
    return processor.getDepositInstructions(pkg, context);
  },

  /** Verify a deposit against a processor's own rails */
  async verifyDeposit(processorId, instructions, context = {}) {
    const processor = this.getById(processorId);
    if (!processor || typeof processor.verifyDeposit !== 'function') {
      return { verified: false, statusText: 'Processor does not support automated verification.' };
    }
    return processor.verifyDeposit(instructions, context);
  },

  /** Operator-console payout instructions (used by AdminPayoutCenter) */
  getPayoutInstructions(processorId, redemption) {
    const processor = this.getById(processorId);
    if (!processor || typeof processor.getPayoutInstructions !== 'function') return null;
    return processor.getPayoutInstructions(redemption);
  },
};
