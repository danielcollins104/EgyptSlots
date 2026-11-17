// ============================================================================
// PAYMENTS SERVICE — deposits (crypto / Cash App / card) & prize payouts
// ============================================================================
// Golden rules enforced here:
//   1. Package contents (GC / SC) are ALWAYS computed server-side from the
//      package id or USD amount. Client-sent coin amounts are ignored.
//   2. A player is credited only after the server itself verified the money:
//        crypto  -> on-chain verification by tx hash, exact tagged amount,
//                   required confirmations, one credit per tx (DB-unique)
//        cashapp -> operator confirms the payment in the Cash App feed
//        card    -> NMI returns an approved sale
//   3. Payouts reserve SC atomically at request time; the operator sends funds
//      manually; crypto payout tx hashes are verified on-chain before "paid";
//      rejection refunds SC atomically.
// ============================================================================
import crypto from 'node:crypto';
import { SWEEPSTAKES_CONFIG, CASHTAG_HANDLE, calculateCustomPackage } from '../../src/config/sweepstakesConfig.js';
import { ServerWallet } from '../engine/ServerWallet.js';
import {
  CRYPTO_ASSETS,
  getAsset,
  getReceivingAddress,
  usdToDisplayUnits,
  displayUnitsToString,
  chainToDisplayUnits,
  displayToChainUnits,
  PriceOracle,
} from './cryptoAssets.js';
import { CryptoVerifier } from './cryptoVerifier.js';
import { NmiGateway } from './nmiGateway.js';
import { assertGeo, ageOn, minAgeFor } from '../compliance/compliance.js';

const DEPOSIT_TTL_MS = 60 * 60 * 1000; // crypto quote lock
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomRef(prefix, len = 6) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return `${prefix}-${s}`;
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.toUpperCase().replace(/^([A-Z]+)_/, (m, p) => `${p.toLowerCase()}_`);
}

function httpError(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function normalizeCashtag(tag) {
  const t = String(tag || '').trim();
  const clean = t.startsWith('$') ? t.slice(1) : t;
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,20}$/.test(clean)) return null;
  return `$${clean}`;
}

function maskDestination(dest) {
  const s = String(dest || '');
  if (s.length <= 10) return s.replace(/.(?=.{3})/g, '•');
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export class PaymentsService {
  /**
   * @param {object} deps - { store, wallet, ledger, auth, compliance, env, fetchImpl, priceOracle, verifier, nmi }
   */
  constructor(deps) {
    this.store = deps.store;
    this.wallet = deps.wallet;
    this.ledger = deps.ledger;
    this.auth = deps.auth;
    this.compliance = deps.compliance;
    this.env = deps.env || {};
    this.prices = deps.priceOracle || new PriceOracle({ fetchImpl: deps.fetchImpl });
    this.verifier = deps.verifier || new CryptoVerifier({ env: this.env, fetchImpl: deps.fetchImpl });
    this.nmi = deps.nmi || new NmiGateway({ env: this.env, fetchImpl: deps.fetchImpl });
    this.cashtag = normalizeCashtag(this.env.CASHTAG || CASHTAG_HANDLE) || CASHTAG_HANDLE;
  }

  // ---------------------------------------------------------------------------
  // Packages (server-authoritative pricing)
  // ---------------------------------------------------------------------------
  resolvePackage(packageId, customAmountUsd = null) {
    const all = [
      ...(SWEEPSTAKES_CONFIG.storePackages || []),
      ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
      ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
      ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
    ];
    const found = all.find((p) => p.id === packageId);
    if (found) {
      return { id: found.id, priceUsd: found.priceUsd, goldCoins: found.goldCoins, freeSweepsCoins: found.freeSweepsCoins };
    }
    const amt = Number(customAmountUsd);
    if (String(packageId || '').startsWith('pkg_custom') || amt > 0) {
      if (!(amt >= 1)) throw httpError('Custom amount must be at least $1.00');
      const c = calculateCustomPackage(amt);
      return { id: `pkg_custom_${c.priceUsd}`, priceUsd: c.priceUsd, goldCoins: c.goldCoins, freeSweepsCoins: c.freeSweepsCoins, isCustom: true };
    }
    throw httpError('Unknown package.');
  }

  _todayTotalUsd(collection, userId, statuses, amountField = 'amountUsd') {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return this.store
      .find(collection, { k2: userId, limit: 500 })
      .filter((d) => statuses.includes(d.status) && Date.parse(d.createdAt) >= since)
      .reduce((s, d) => s + (Number(d[amountField]) || 0), 0);
  }

  _assertDepositLimits(userId, amountUsd) {
    const c = this.compliance;
    if (amountUsd > c.maxSingleDepositUsd) throw httpError(`Maximum single purchase is $${c.maxSingleDepositUsd.toLocaleString()}.`);
    const today =
      this._todayTotalUsd('deposits', userId, ['credited']) +
      this._todayTotalUsd('orders', userId, ['confirmed']) +
      this._todayTotalUsd('card_charges', userId, ['approved']);
    if (today + amountUsd > c.maxDailyDepositUsd) {
      throw httpError(`Daily purchase limit of $${c.maxDailyDepositUsd.toLocaleString()} reached. Try again tomorrow.`);
    }
  }

  _requirePlayer(session) {
    if (!session || session.role === 'GUEST') throw httpError('Please sign in to a registered account first.', 401);
    return session;
  }

  // ---------------------------------------------------------------------------
  // Public payment configuration for the cashier UI
  // ---------------------------------------------------------------------------
  publicConfig(geoCheck) {
    return {
      geo: geoCheck,
      cashApp: { enabled: true, cashtag: this.cashtag },
      card: this.nmi.publicConfig(),
      crypto: {
        enabled: true,
        assets: Object.values(CRYPTO_ASSETS).map((a) => ({
          id: a.id,
          label: a.label,
          unit: a.unit,
          network: a.network,
          minConfirmations: a.minConfirmations,
          address: getReceivingAddress(a, this.env),
        })),
      },
      redemption: {
        methods: ['crypto', 'cashapp'],
        minSC: SWEEPSTAKES_CONFIG.minRedemptionSC || 50,
        requireKyc: this.compliance.requireKycForRedemption,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CRYPTO DEPOSITS
  // ---------------------------------------------------------------------------
  async createCryptoDeposit(session, { packageId, customAmountUsd, asset: assetId }, geo) {
    this._requirePlayer(session);
    assertGeo(this.compliance, geo);
    const asset = getAsset(assetId || 'USDT_SOL');
    const address = getReceivingAddress(asset, this.env);
    if (!address) throw httpError(`${asset.label} deposits are not configured.`);
    const pkg = this.resolvePackage(packageId, customAmountUsd);
    this._assertDepositLimits(session.userId, pkg.priceUsd);

    const { price } = await this.prices.getUsdPrice(asset.priceKey);
    const base = usdToDisplayUnits(pkg.priceUsd, price, asset);
    const step = 10n ** BigInt(String(asset.maxTag).length);
    const rounded = ((base + step - 1n) / step) * step;

    // Unique tag among open deposits for this asset (synchronous section)
    return this.store.transaction(() => {
      const open = new Set(
        this.store
          .find('deposits', { k1: 'awaiting_payment', limit: 1000 })
          .filter((d) => d.asset === asset.id && Date.parse(d.expiresAt) > Date.now() - DEPOSIT_TTL_MS)
          .map((d) => d.expectedUnits)
      );
      let units = null;
      for (let i = 0; i < 50; i++) {
        const tag = BigInt(1 + crypto.randomInt(asset.maxTag));
        const candidate = (rounded + tag).toString();
        if (!open.has(candidate)) {
          units = candidate;
          break;
        }
      }
      if (!units) throw httpError('Deposit system busy — please try again in a minute.', 503);

      const now = Date.now();
      const deposit = {
        id: newId('dep'),
        userId: session.userId,
        asset: asset.id,
        network: asset.network,
        address,
        expectedUnits: units,
        amountDisplay: displayUnitsToString(BigInt(units), asset.displayDecimals),
        unit: asset.unit,
        priceUsd: price,
        amountUsd: pkg.priceUsd,
        packageId: pkg.id,
        goldCoins: pkg.goldCoins,
        freeSweepsCoins: pkg.freeSweepsCoins,
        status: 'awaiting_payment',
        txHash: null,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + DEPOSIT_TTL_MS).toISOString(),
      };
      this.store.insert('deposits', deposit.id, deposit);
      return this._publicDeposit(deposit);
    });
  }

  _publicDeposit(d) {
    const asset = getAsset(d.asset);
    return {
      id: d.id,
      asset: d.asset,
      network: d.network,
      address: d.address,
      amount: d.amountDisplay,
      unit: d.unit,
      amountUsd: d.amountUsd,
      priceUsd: d.priceUsd,
      packageId: d.packageId,
      goldCoins: d.goldCoins,
      freeSweepsCoins: d.freeSweepsCoins,
      status: d.status,
      txHash: d.txHash,
      confirmations: d.confirmations || 0,
      requiredConfirmations: asset.minConfirmations,
      walletUri: PaymentsService.walletUri(asset, d.address, d.amountDisplay),
      explorerUrl: d.txHash ? `${asset.explorerTx}${d.txHash}` : null,
      createdAt: d.createdAt,
      expiresAt: d.expiresAt,
      message: d.message || null,
    };
  }

  static walletUri(asset, address, amount) {
    if (asset.chain === 'bitcoin') return `bitcoin:${address}?amount=${amount}`;
    if (asset.id === 'ETH') return `ethereum:${address}?value=${amount}e18`;
    if (asset.id === 'USDT_ERC20') return `ethereum:${asset.tokenContract}/transfer?address=${address}&uint256=${amount}e6`;
    if (asset.id === 'USDT_SOL') return `solana:${address}?amount=${amount}&spl-token=${asset.tokenMint}`;
    return `solana:${address}?amount=${amount}`;
  }

  getDepositForUser(session, depositId) {
    const d = this.store.get('deposits', depositId);
    if (!d || (d.userId !== session.userId && session.role !== 'ADMIN')) throw httpError('Deposit not found', 404);
    return d;
  }

  /** Player submits (or re-checks) the tx hash for a deposit */
  async submitCryptoTx(session, { depositId, txHash }) {
    this._requirePlayer(session);
    const d = this.getDepositForUser(session, depositId);
    if (d.status === 'credited') return { deposit: this._publicDeposit(d), credited: false, alreadyCredited: true };
    if (['rejected', 'needs_review'].includes(d.status)) return { deposit: this._publicDeposit(d), credited: false };
    const hash = String(txHash || d.txHash || '').trim();
    if (!hash) throw httpError('Paste the transaction hash / ID from your wallet.');
    if (d.txHash && d.txHash !== hash) throw httpError('A different transaction was already submitted for this deposit. Contact support.');

    // Throttle on-chain re-checks
    if (d.lastCheckAt && Date.now() - Date.parse(d.lastCheckAt) < 10000) {
      return { deposit: this._publicDeposit(d), credited: false, throttled: true };
    }
    const asset = getAsset(d.asset);
    const claimKey = `tx:${asset.chain}:${hash.toLowerCase()}`;
    const existingClaim = this.store.get('claimed_tx', claimKey);
    if (existingClaim && existingClaim.refId !== d.id) {
      throw httpError('This transaction has already been used for another deposit.');
    }

    const result = await this.verifier.verifyTransfer({ asset, txHash: hash, recipient: d.address });

    // Re-read after the network await (other requests may have run)
    return this.store.transaction(() => {
      const cur = this.store.get('deposits', d.id);
      if (cur.status === 'credited') return { deposit: this._publicDeposit(cur), credited: false, alreadyCredited: true };
      cur.txHash = hash;
      cur.lastCheckAt = new Date().toISOString();

      if (!result.found) {
        cur.message = result.error || 'Transaction not found yet — it can take a few minutes to appear.';
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      if (result.success === false) {
        cur.status = 'rejected';
        cur.message = result.error || 'Transaction failed on-chain.';
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      const createdMs = Date.parse(cur.createdAt);
      if (result.blockTime && result.blockTime * 1000 < createdMs - 10 * 60 * 1000) {
        cur.status = 'needs_review';
        cur.message = 'This transaction was sent before the deposit was created. Our team will review it.';
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      const receivedDisplay = chainToDisplayUnits(result.amountRaw, asset);
      cur.receivedUnits = receivedDisplay.toString();
      cur.confirmations = result.confirmations;
      if (receivedDisplay === 0n && result.pending) {
        cur.status = 'awaiting_payment';
        cur.message = 'Transaction seen — waiting for it to confirm on-chain.';
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      if (receivedDisplay !== BigInt(cur.expectedUnits)) {
        cur.status = 'needs_review';
        cur.message = `Amount received (${displayUnitsToString(receivedDisplay, asset.displayDecimals)} ${asset.unit}) does not exactly match the quoted ${cur.amountDisplay} ${asset.unit}. Our team will review and credit manually.`;
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      const lateMs = result.blockTime ? result.blockTime * 1000 - Date.parse(cur.expiresAt) : 0;
      if (lateMs > 30 * 60 * 1000) {
        cur.status = 'needs_review';
        cur.message = 'Payment arrived after the price quote expired. Our team will review it.';
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      if (result.confirmations < asset.minConfirmations) {
        cur.status = 'confirming';
        cur.message = `Payment detected — ${result.confirmations}/${asset.minConfirmations} confirmations.`;
        this.store.put('deposits', cur.id, cur);
        return { deposit: this._publicDeposit(cur), credited: false };
      }
      // Verified: claim the tx (DB-unique) and credit in the same transaction
      this._creditDeposit(cur, claimKey, 'crypto');
      return { deposit: this._publicDeposit(cur), credited: true, balance: this.wallet.getAccount(cur.userId) };
    });
  }

  _creditDeposit(dep, claimKey, kind, operator = null) {
    try {
      this.store.insert('claimed_tx', claimKey, { kind: 'crypto_deposit', refId: dep.id, userId: dep.userId, at: new Date().toISOString() });
    } catch (err) {
      if (err.code === 'DUPLICATE') throw httpError('This transaction has already been credited.');
      throw err;
    }
    this.wallet.processPurchaseCreditSync(dep.userId, {
      goldCoinsToAdd: dep.goldCoins,
      freeSweepsCoinsToAdd: dep.freeSweepsCoins,
      packageId: dep.packageId,
      paymentRef: `${kind}:${dep.id}`,
    });
    dep.status = 'credited';
    dep.creditedAt = new Date().toISOString();
    dep.message = null;
    if (operator) dep.reviewedBy = operator;
    this.store.put('deposits', dep.id, dep);
  }

  /** Admin: resolve a needs_review crypto deposit */
  adminResolveCryptoDeposit(adminSession, { depositId, action, note = '' }) {
    return this.store.transaction(() => {
      const d = this.store.get('deposits', depositId);
      if (!d) throw httpError('Deposit not found', 404);
      if (d.status === 'credited') return { deposit: d, alreadyCredited: true };
      if (action === 'credit') {
        if (!d.txHash) throw httpError('No transaction hash on this deposit.');
        const asset = getAsset(d.asset);
        d.operatorNote = note;
        this._creditDeposit(d, `tx:${asset.chain}:${d.txHash.toLowerCase()}`, 'crypto', adminSession.userId);
        return { deposit: d };
      }
      if (action === 'reject') {
        d.status = 'rejected';
        d.operatorNote = note;
        d.reviewedBy = adminSession.userId;
        this.store.put('deposits', d.id, d);
        return { deposit: d };
      }
      throw httpError('action must be credit or reject');
    });
  }

  // ---------------------------------------------------------------------------
  // CASH APP DEPOSITS (operator-confirmed)
  // ---------------------------------------------------------------------------
  createCashAppOrder(session, { packageId, customAmountUsd, senderTag }, geo) {
    this._requirePlayer(session);
    assertGeo(this.compliance, geo);
    const pkg = this.resolvePackage(packageId, customAmountUsd);
    this._assertDepositLimits(session.userId, pkg.priceUsd);
    const sender = senderTag ? normalizeCashtag(senderTag) : null;
    if (senderTag && !sender) throw httpError('Enter your $Cashtag (letters, numbers, - or _).');
    const orderRef = randomRef('EGY');
    const amount = Number(pkg.priceUsd);
    const formatted = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
    const order = {
      id: newId('ord'),
      processorId: 'cashapp',
      userId: session.userId,
      userEmail: session.email || null,
      orderRef,
      packageId: pkg.id,
      amountUsd: amount,
      goldCoins: pkg.goldCoins,
      freeSweepsCoins: pkg.freeSweepsCoins,
      senderTag: sender,
      payTo: this.cashtag,
      paymentLink: `https://cash.app/${this.cashtag}/${formatted}`,
      status: 'awaiting_payment',
      createdAt: new Date().toISOString(),
    };
    this.store.insert('orders', order.id, order);
    return order;
  }

  /** Player: "I've sent it" */
  markCashAppOrderSent(session, { orderId, senderTag }) {
    this._requirePlayer(session);
    const o = this.store.get('orders', orderId);
    if (!o || o.userId !== session.userId) throw httpError('Order not found', 404);
    if (o.status !== 'awaiting_payment') return o;
    const sender = normalizeCashtag(senderTag || o.senderTag);
    if (!sender) throw httpError('Enter the $Cashtag you paid from so we can match your payment.');
    o.senderTag = sender;
    o.status = 'awaiting_confirmation';
    o.sentAt = new Date().toISOString();
    this.store.put('orders', o.id, o);
    return o;
  }

  listOrdersForUser(session, limit = 50) {
    return this.store.find('orders', { k2: session.userId, limit });
  }

  /**
   * Admin confirms a Cash App payment appeared in the Cash App activity feed.
   * cashAppPaymentId (from the Cash App web receipt) is required and DB-unique,
   * so one real payment can never credit two orders.
   */
  adminConfirmCashAppOrder(adminSession, { orderId, cashAppPaymentId, note = '' }) {
    const receipt = String(cashAppPaymentId || '').trim();
    if (receipt.length < 4) throw httpError('Enter the Cash App payment/receipt ID for this payment.');
    return this.store.transaction(() => {
      const o = this.store.get('orders', orderId);
      if (!o) throw httpError(`Order not found: ${orderId}`, 404);
      if (o.status === 'confirmed') return { order: o, alreadyConfirmed: true };
      if (o.status === 'rejected') throw httpError('Order was already rejected.');
      try {
        this.store.insert('claimed_tx', `cashapp_in:${receipt.toLowerCase()}`, { kind: 'cashapp_deposit', refId: o.id, userId: o.userId, at: new Date().toISOString() });
      } catch (err) {
        if (err.code === 'DUPLICATE') throw httpError('That Cash App payment ID was already used to confirm another order.');
        throw err;
      }
      const credit = this.wallet.processPurchaseCreditSync(o.userId, {
        goldCoinsToAdd: o.goldCoins,
        freeSweepsCoinsToAdd: o.freeSweepsCoins,
        packageId: o.packageId,
        paymentRef: `cashapp:${o.id}`,
      });
      Object.assign(o, {
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
        confirmedBy: adminSession.userId,
        cashAppPaymentId: receipt,
        operatorNote: note,
        credit: { goldCoins: credit.goldCoins, sweepsCoins: credit.sweepsCoins },
      });
      this.store.put('orders', o.id, o);
      return { order: o, alreadyConfirmed: false };
    });
  }

  adminRejectOrder(adminSession, { orderId, note = '' }) {
    const o = this.store.get('orders', orderId);
    if (!o) throw httpError('Order not found', 404);
    if (o.status === 'confirmed') throw httpError('Order already confirmed and credited.');
    Object.assign(o, { status: 'rejected', operatorNote: note, rejectedBy: adminSession.userId, rejectedAt: new Date().toISOString() });
    this.store.put('orders', o.id, o);
    return o;
  }

  // ---------------------------------------------------------------------------
  // CARD (NMI)
  // ---------------------------------------------------------------------------
  async chargeCard(session, { packageId, customAmountUsd, paymentToken, idempotencyKey, billing = {} }, geo, ip) {
    this._requirePlayer(session);
    assertGeo(this.compliance, geo);
    if (!this.nmi.enabled) throw httpError('Card payments are coming soon. Please use crypto or Cash App.', 503);
    const key = String(idempotencyKey || '').trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw httpError('Missing idempotency key.');
    const pkg = this.resolvePackage(packageId, customAmountUsd);
    this._assertDepositLimits(session.userId, pkg.priceUsd);

    const chargeId = `chg_${crypto.createHash('sha256').update(`${session.userId}:${key}`).digest('hex').slice(0, 24)}`;
    const existing = this.store.get('card_charges', chargeId);
    if (existing) return { charge: PaymentsService._publicCharge(existing), duplicate: true };

    const charge = {
      id: chargeId,
      userId: session.userId,
      packageId: pkg.id,
      amountUsd: pkg.priceUsd,
      goldCoins: pkg.goldCoins,
      freeSweepsCoins: pkg.freeSweepsCoins,
      status: 'processing',
      createdAt: new Date().toISOString(),
    };
    this.store.insert('card_charges', chargeId, charge); // reserves the idempotency key

    const res = await this.nmi.sale({
      amountUsd: pkg.priceUsd,
      paymentToken,
      orderId: chargeId,
      billing,
      ipAddress: ip,
      email: session.email,
    });
    return this._applyCardResult(chargeId, res);
  }

  _applyCardResult(chargeId, res) {
    return this.store.transaction(() => {
      const c = this.store.get('card_charges', chargeId);
      if (c.status === 'approved') return { charge: PaymentsService._publicCharge(c) };
      c.gatewayTransactionId = res.transactionId || c.gatewayTransactionId || null;
      c.responseText = res.responseText || null;
      c.avs = res.avs || null;
      c.cvv = res.cvv || null;
      if (res.status === 'approved') {
        this.wallet.processPurchaseCreditSync(c.userId, {
          goldCoinsToAdd: c.goldCoins,
          freeSweepsCoinsToAdd: c.freeSweepsCoins,
          packageId: c.packageId,
          paymentRef: `card:${c.id}`,
        });
        c.status = 'approved';
        c.approvedAt = new Date().toISOString();
      } else if (res.status === 'declined' || res.status === 'error' || res.status === 'not_found') {
        c.status = 'declined';
      } else {
        c.status = 'unknown'; // must be reconciled — never auto-retried
      }
      this.store.put('card_charges', c.id, c);
      return { charge: PaymentsService._publicCharge(c), balance: c.status === 'approved' ? this.wallet.getAccount(c.userId) : undefined };
    });
  }

  static _publicCharge(c) {
    return {
      id: c.id,
      status: c.status,
      amountUsd: c.amountUsd,
      packageId: c.packageId,
      goldCoins: c.goldCoins,
      freeSweepsCoins: c.freeSweepsCoins,
      message:
        c.status === 'approved'
          ? 'Payment approved.'
          : c.status === 'declined'
          ? `Card declined${c.responseText ? `: ${c.responseText}` : ''}.`
          : c.status === 'unknown'
          ? 'We could not confirm this payment yet. Do NOT retry — it will be checked automatically and credited if approved.'
          : 'Processing…',
    };
  }

  /** Admin: reconcile 'unknown' card charges with the gateway */
  async adminReconcileCard(adminSession, { chargeId }) {
    const c = this.store.get('card_charges', chargeId);
    if (!c) throw httpError('Charge not found', 404);
    if (c.status !== 'unknown' && c.status !== 'processing') return { charge: c };
    const q = await this.nmi.queryByOrderId(chargeId);
    return this._applyCardResult(chargeId, q);
  }

  // ---------------------------------------------------------------------------
  // KYC (manual operator review; vendor integration can replace submit/decide)
  // ---------------------------------------------------------------------------
  submitKyc(session, { legalName, dob, address = {}, phone }, geo) {
    this._requirePlayer(session);
    assertGeo(this.compliance, geo);
    const user = this.auth.getUserById(session.userId);
    if (!user) throw httpError('User not found', 404);
    if (user.kycStatus === 'verified') return { status: 'verified' };
    const name = String(legalName || '').trim();
    if (name.length < 3 || !name.includes(' ')) throw httpError('Enter your full legal first and last name.');
    const state = String(address.state || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw httpError('Enter your 2-letter state code.');
    if (this.compliance.restrictedStates.includes(state)) throw httpError(`Prize redemptions are not available to residents of ${state}.`, 451);
    if (!String(address.line1 || '').trim() || !String(address.city || '').trim() || !/^\d{5}(-\d{4})?$/.test(String(address.zip || '').trim())) {
      throw httpError('Enter your full residential address (street, city, ZIP).');
    }
    const age = ageOn(dob);
    if (!Number.isFinite(age)) throw httpError('Enter your date of birth as YYYY-MM-DD.');
    const minAge = minAgeFor(this.compliance, state);
    if (age < minAge) throw httpError(`You must be at least ${minAge} to redeem prizes.`, 403);

    const identityKey = crypto.createHash('sha256').update(`${name.toLowerCase().replace(/\s+/g, ' ')}|${dob}`).digest('hex');
    const dupes = this.store.find('kyc', { k2: identityKey, limit: 10 }).filter((k) => k.userId !== session.userId);
    const rec = {
      userId: session.userId,
      email: user.email,
      legalName: name,
      dob,
      address: {
        line1: String(address.line1).trim(),
        line2: String(address.line2 || '').trim(),
        city: String(address.city).trim(),
        state,
        zip: String(address.zip).trim(),
      },
      phone: phone ? String(phone).trim() : null,
      identityKey,
      duplicateOf: dupes.map((d) => d.userId),
      status: 'pending',
      submittedAt: new Date().toISOString(),
      geoAtSubmit: geo || null,
    };
    this.store.transaction(() => {
      this.store.put('kyc', session.userId, rec);
      this.auth.updateUser(session.userId, { kycStatus: 'pending' });
    });
    return { status: 'pending', duplicateFlag: rec.duplicateOf.length > 0 };
  }

  getKycStatus(session) {
    const user = this.auth.getUserById(session.userId);
    const rec = this.store.get('kyc', session.userId);
    return { status: user?.kycStatus || 'none', note: rec?.decisionNote || null };
  }

  adminDecideKyc(adminSession, { userId, decision, note = '' }) {
    if (!['verified', 'rejected'].includes(decision)) throw httpError('decision must be verified or rejected');
    const rec = this.store.get('kyc', userId);
    if (!rec) throw httpError('No KYC submission for this user', 404);
    rec.status = decision;
    rec.decisionNote = note;
    rec.decidedBy = adminSession.userId;
    rec.decidedAt = new Date().toISOString();
    this.store.transaction(() => {
      this.store.put('kyc', userId, rec);
      this.auth.updateUser(userId, { kycStatus: decision });
      this.ledger.append({ userId, type: 'KYC_DECISION', currency: 'SYSTEM', amount: 0, balanceBefore: 0, balanceAfter: 0, metadata: { decision, by: adminSession.userId } });
    });
    return rec;
  }

  // ---------------------------------------------------------------------------
  // PRIZE REDEMPTIONS / PAYOUTS (manual operator send, verified receipts)
  // ---------------------------------------------------------------------------
  requestRedemption(session, { amountSC, method, destination, cryptoAsset, payoutMethod, destinationMasked }, geo) {
    this._requirePlayer(session);
    assertGeo(this.compliance, geo);
    const m = String(method || payoutMethod || '').toLowerCase();
    const normalizedMethod = m === 'chime' || m === 'cashapp' ? 'cashapp' : m === 'crypto' ? 'crypto' : null;
    if (!normalizedMethod) throw httpError('Choose a payout method: crypto or Cash App. (Gift cards, debit push and ACH are not available yet.)');

    const user = this.auth.getUserById(session.userId);
    if (this.compliance.requireKycForRedemption && user?.kycStatus !== 'verified') {
      const e = httpError(
        user?.kycStatus === 'pending'
          ? 'Your identity verification is under review. You can redeem once it is approved.'
          : 'Please verify your identity before your first prize redemption.',
        403
      );
      e.code = 'KYC_REQUIRED';
      throw e;
    }

    let dest;
    let asset = null;
    const rawDest = destination ?? destinationMasked;
    if (normalizedMethod === 'crypto') {
      asset = getAsset(cryptoAsset || 'USDT_SOL');
      dest = String(rawDest || '').trim();
      if (!CryptoVerifier.isValidAddress(asset, dest)) throw httpError(`Enter a valid ${asset.network} wallet address.`);
    } else {
      dest = normalizeCashtag(rawDest);
      if (!dest) throw httpError('Enter a valid $Cashtag.');
    }
    const amountUsd = ServerWallet.fromCents(ServerWallet.toCents(amountSC)) * (SWEEPSTAKES_CONFIG.scUsdRate || 1);
    const today = this._todayTotalUsd('redemptions', session.userId, ['pending_review', 'approved', 'paid']);
    if (today + amountUsd > this.compliance.maxDailyRedemptionUsd) {
      throw httpError(`Daily redemption limit of $${this.compliance.maxDailyRedemptionUsd.toLocaleString()} reached.`);
    }

    return this.store.transaction(() => {
      const id = newId('rdm');
      const reserve = this.wallet.reserveRedemptionSync(session.userId, amountSC, {
        method: normalizedMethod,
        destinationMasked: maskDestination(dest),
        redemptionId: id,
      });
      const rdm = {
        id,
        userId: session.userId,
        userEmail: user?.email || null,
        method: normalizedMethod,
        cryptoAsset: asset?.id || null,
        network: asset?.network || null,
        destination: dest,
        destinationMasked: maskDestination(dest),
        amountSC: reserve.amountRedeemedSC,
        amountCents: reserve.amountCents,
        amountUsd: Number(amountUsd.toFixed(2)),
        status: 'pending_review',
        createdAt: new Date().toISOString(),
        geoAtRequest: geo || null,
      };
      this.store.insert('redemptions', id, rdm);
      return { redemption: PaymentsService._publicRedemption(rdm), balance: reserve.account };
    });
  }

  static _publicRedemption(r) {
    return {
      id: r.id,
      method: r.method,
      cryptoAsset: r.cryptoAsset,
      destinationMasked: r.destinationMasked,
      amountSC: r.amountSC,
      amountUsd: r.amountUsd,
      status: r.status,
      createdAt: r.createdAt,
      paidAt: r.paidAt || null,
      receipt: r.status === 'paid' ? r.txHashOrReceipt : null,
      explorerUrl: r.explorerUrl || null,
      rejectionReason: r.status === 'rejected' ? r.rejectionReason || null : null,
    };
  }

  listRedemptionsForUser(session, limit = 50) {
    return this.store.find('redemptions', { k2: session.userId, limit }).map(PaymentsService._publicRedemption);
  }

  /** Admin: get payout instructions (crypto: live-priced exact amount) */
  async adminQuoteRedemption(adminSession, { redemptionId }) {
    const r = this.store.get('redemptions', redemptionId);
    if (!r) throw httpError('Redemption not found', 404);
    if (!['pending_review', 'approved'].includes(r.status)) throw httpError(`Redemption is ${r.status}.`);
    const instructions = { method: r.method, destination: r.destination, amountUsd: r.amountUsd };
    if (r.method === 'crypto') {
      const asset = getAsset(r.cryptoAsset);
      const { price } = await this.prices.getUsdPrice(asset.priceKey);
      const units = usdToDisplayUnits(r.amountUsd, price, asset);
      const amount = displayUnitsToString(units, asset.displayDecimals);
      r.quote = { units: units.toString(), amount, unit: asset.unit, priceUsd: price, quotedAt: new Date().toISOString() };
      Object.assign(instructions, {
        asset: asset.id,
        network: asset.network,
        amount,
        unit: asset.unit,
        priceUsd: price,
        walletUri: PaymentsService.walletUri(asset, r.destination, amount),
      });
    } else {
      const amt = r.amountUsd % 1 === 0 ? String(r.amountUsd) : r.amountUsd.toFixed(2);
      Object.assign(instructions, {
        cashtag: r.destination,
        cashAppLink: `https://cash.app/${r.destination}/${amt}`,
        note: `Prize redemption ${r.id}`,
      });
    }
    r.status = 'approved';
    r.approvedBy = adminSession.userId;
    r.approvedAt = r.approvedAt || new Date().toISOString();
    this.store.put('redemptions', r.id, r);
    return { redemption: r, instructions };
  }

  /**
   * Admin marks a payout as sent.
   *   crypto  -> txHash REQUIRED; verified on-chain to the player's address for >= quoted amount
   *   cashapp -> Cash App payment/receipt id REQUIRED (unique)
   */
  async adminMarkRedemptionPaid(adminSession, { redemptionId, txHash, receipt, note = '' }) {
    const r = this.store.get('redemptions', redemptionId);
    if (!r) throw httpError('Redemption not found', 404);
    if (r.status === 'paid') return { redemption: r, alreadyPaid: true };
    if (r.status !== 'approved') throw httpError('Open the payout instructions (approve) before marking it paid.');

    let claimKey;
    let proof = {};
    if (r.method === 'crypto') {
      const asset = getAsset(r.cryptoAsset);
      const hash = String(txHash || '').trim();
      if (!hash) throw httpError('Paste the payout transaction hash.');
      if (!r.quote) throw httpError('No payout quote — re-open instructions.');
      const v = await this.verifier.verifyTransfer({ asset, txHash: hash, recipient: r.destination });
      if (!v.found || v.success === false) throw httpError(v.error || 'Payout transaction not found on-chain yet. Try again in a minute.');
      const sentDisplay = chainToDisplayUnits(v.amountRaw, asset);
      const quoted = BigInt(r.quote.units);
      // allow up to 2% under quote for price movement between quote and send
      if (sentDisplay * 100n < quoted * 98n) {
        throw httpError(`That transaction sent ${displayUnitsToString(sentDisplay, asset.displayDecimals)} ${asset.unit} to the player, but ${r.quote.amount} ${asset.unit} was quoted.`);
      }
      claimKey = `payout:${asset.chain}:${hash.toLowerCase()}`;
      proof = {
        txHashOrReceipt: hash,
        explorerUrl: `${asset.explorerTx}${hash}`,
        sentUnits: sentDisplay.toString(),
        sentAmount: displayUnitsToString(sentDisplay, asset.displayDecimals),
        confirmations: v.confirmations,
      };
    } else {
      const rc = String(receipt || '').trim();
      if (rc.length < 4) throw httpError('Enter the Cash App payment/receipt ID for this payout.');
      claimKey = `cashapp_out:${rc.toLowerCase()}`;
      proof = { txHashOrReceipt: rc };
    }

    return this.store.transaction(() => {
      const cur = this.store.get('redemptions', r.id);
      if (cur.status === 'paid') return { redemption: cur, alreadyPaid: true };
      if (cur.status !== 'approved') throw httpError(`Redemption is ${cur.status}.`);
      try {
        this.store.insert('claimed_tx', claimKey, { kind: 'payout', refId: cur.id, userId: cur.userId, at: new Date().toISOString() });
      } catch (err) {
        if (err.code === 'DUPLICATE') throw httpError('That transaction/receipt was already used for another payout.');
        throw err;
      }
      this.wallet.settleRedemptionSync(cur.userId, cur.amountCents, { redemptionId: cur.id, ...proof });
      Object.assign(cur, proof, { status: 'paid', paidAt: new Date().toISOString(), paidBy: adminSession.userId, operatorNote: note });
      this.store.put('redemptions', cur.id, cur);
      return { redemption: cur };
    });
  }

  adminRejectRedemption(adminSession, { redemptionId, reason = '' }) {
    if (String(reason).trim().length < 3) throw httpError('A rejection reason is required.');
    return this.store.transaction(() => {
      const r = this.store.get('redemptions', redemptionId);
      if (!r) throw httpError('Redemption not found', 404);
      if (r.status === 'paid') throw httpError('Already paid — cannot reject.');
      if (r.status === 'rejected') return { redemption: r, alreadyRejected: true };
      const balance = this.wallet.refundRedemptionSync(r.userId, r.amountCents, { redemptionId: r.id, reason });
      Object.assign(r, { status: 'rejected', rejectionReason: reason, rejectedBy: adminSession.userId, rejectedAt: new Date().toISOString() });
      this.store.put('redemptions', r.id, r);
      return { redemption: r, balance };
    });
  }
}
