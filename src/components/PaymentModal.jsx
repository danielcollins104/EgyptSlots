import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Gem,
  Coins,
  DollarSign,
  History,
  ExternalLink,
  Crown,
  Check,
  Bitcoin,
  Copy,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  SWEEPSTAKES_CONFIG,
  getCashAppPayCheckoutLink,
  getStripePaymentLink,
  getPaymentReturnUrl,
} from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';
import { soundEngine } from '../audio/soundEngine';

const CRYPTO_PAYMENT_OPTIONS = [
  {
    symbol: 'USDT',
    name: 'Tether (USDT)',
    network: 'Solana / Polygon (0% Fee)',
    address: 'So11111111111111111111111111111111111111112dc',
    uriScheme: 'solana',
    rateMultiplier: 1.0,
    unit: 'USDT',
    color: '#26a17b',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin (BTC)',
    network: 'Bitcoin Network',
    address: 'bc1q9dcenterpriseskemetrelics78x2yza4901mn',
    uriScheme: 'bitcoin',
    rateMultiplier: 0.0000108,
    unit: 'BTC',
    color: '#f7931a',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum (ETH)',
    network: 'ERC-20 / Arbitrum',
    address: '0xDC049E71F32B59Ca9178E6B20261024T0819119',
    uriScheme: 'ethereum',
    rateMultiplier: 0.000325,
    unit: 'ETH',
    color: '#627eea',
  },
  {
    symbol: 'SOL',
    name: 'Solana (SOL)',
    network: 'Solana Mainnet',
    address: 'DC8kemetVaultPhaserSlot49182371948291048291',
    uriScheme: 'solana',
    rateMultiplier: 0.0054,
    unit: 'SOL',
    color: '#14f195',
  },
];

function buildCryptoPaymentUri(cryptoObj, amount) {
  if (!cryptoObj) return '';
  if (cryptoObj.uriScheme === 'bitcoin') {
    return `bitcoin:${cryptoObj.address}?amount=${amount}`;
  }
  if (cryptoObj.uriScheme === 'ethereum') {
    return `ethereum:${cryptoObj.address}?value=${amount}`;
  }
  return `solana:${cryptoObj.address}?amount=${amount}`;
}

export default function PaymentModal({
  isOpen,
  onClose,
  initialTab = 'store', // 'store' | 'redeem' | 'history'
  initialPackage = null,
  goldCoins = 0,
  sweepsCoins = 0,
  onPurchaseSuccess,
  onRedeemSuccess,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  // Step 1 = Choose Package, Step 2 = Choose Payment Method (Card -> Stripe, Cash App Pay -> Stripe, or Crypto)
  const [step, setStep] = useState(initialPackage ? 2 : 1);
  const [selectedPkg, setSelectedPkg] = useState(
    initialPackage || SWEEPSTAKES_CONFIG.storePackages[2]
  );
  const [showCryptoBox, setShowCryptoBox] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('USDT');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [redirectingMethod, setRedirectingMethod] = useState(null); // 'card' | 'cashapp' | null
  const [isProcessingCrypto, setIsProcessingCrypto] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [purchaseCompletedPkg, setPurchaseCompletedPkg] = useState(null);

  // Redemption state
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('ach');
  const [redeemDestination, setRedeemDestination] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (initialPackage) {
        setSelectedPkg(initialPackage);
        setStep(2);
      } else {
        setStep(1);
      }
      setShowCryptoBox(false);
      setCopiedAddress(false);
      setRedirectingMethod(null);
      setIsProcessingCrypto(false);
      setCheckoutError('');
      setPurchaseCompletedPkg(null);
      setRedeemSuccessMsg('');
      setRedeemError('');
    }
  }, [isOpen, initialTab, initialPackage]);

  if (!isOpen) return null;

  const ensureLoggedInForPurchase = async () => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    return await authService.loginAsVipGuest();
  };

  // Step 1 -> Step 2: Select a package and go to Payment Method selection
  const handleSelectPackage = (pkg) => {
    setSelectedPkg(pkg);
    setStep(2);
    setShowCryptoBox(false);
    setCheckoutError('');
    soundEngine.playButtonClick(560);
  };

  // Step 2: Pay with Card or Cash App Pay -> Redirect directly to Stripe Checkout
  const handleStripeRedirect = async (methodType = 'card') => {
    if (!selectedPkg || redirectingMethod) return;
    soundEngine.playButtonClick(660);
    setCheckoutError('');
    setRedirectingMethod(methodType);

    try {
      const user = await ensureLoggedInForPurchase();
      const session = await paymentService.createStripeCheckoutSession(
        selectedPkg,
        methodType,
        user
      );
      if (session && session.url) {
        window.location.href = session.url;
        return;
      }
    } catch (err) {
      console.warn('Stripe checkout session fallback:', err);
    }

    const baseStripe =
      methodType === 'cashapp'
        ? getCashAppPayCheckoutLink(selectedPkg)
        : getStripePaymentLink(selectedPkg);
    const returnUrl = getPaymentReturnUrl(selectedPkg.id);
    window.location.href = baseStripe || returnUrl;
  };

  const handleCopyCryptoAddress = (addr) => {
    navigator.clipboard?.writeText(addr);
    setCopiedAddress(true);
    soundEngine.playButtonClick(700);
    setTimeout(() => setCopiedAddress(false), 2200);
  };

  const handleConfirmCryptoPayment = async () => {
    if (!selectedPkg || isProcessingCrypto) return;
    setIsProcessingCrypto(true);
    soundEngine.playWin(true);

    await ensureLoggedInForPurchase();
    paymentService.recordPurchase({
      packageId: selectedPkg.id,
      amountUsd: selectedPkg.priceUsd,
      goldCoins: selectedPkg.goldCoins,
      freeSweepsCoins: selectedPkg.freeSweepsCoins,
      sweepsCoins: selectedPkg.freeSweepsCoins,
      method: `crypto_${selectedCrypto.toLowerCase()}`,
      status: 'completed',
    });

    setPurchaseCompletedPkg(selectedPkg);
    setTimeout(() => {
      setIsProcessingCrypto(false);
      if (onPurchaseSuccess) {
        onPurchaseSuccess(selectedPkg);
      }
      onClose();
    }, 950);
  };

  const handleRedeemSubmit = (e) => {
    e.preventDefault();
    setRedeemError('');
    setRedeemSuccessMsg('');

    const amount = parseFloat(redeemAmountInput);
    if (isNaN(amount) || amount < SWEEPSTAKES_CONFIG.minRedemptionSC) {
      setRedeemError(`Minimum redemption is $${SWEEPSTAKES_CONFIG.minRedemptionSC.toFixed(2)} SC.`);
      return;
    }
    if (amount > sweepsCoins) {
      setRedeemError(`Insufficient Sweeps Coins. You have ${sweepsCoins.toFixed(2)} SC.`);
      return;
    }
    if (!redeemDestination.trim()) {
      setRedeemError('Please enter your payout account details (Bank Routing/Account or $Cashtag).');
      return;
    }

    const res = paymentService.requestRedemption({
      sweepsCoins: amount,
      method: redeemMethod,
      destination: redeemDestination.trim(),
    });

    if (res.success) {
      if (onRedeemSuccess) onRedeemSuccess(amount);
      setRedeemSuccessMsg(
        `Redemption of $${amount.toFixed(2)} USD submitted! Ref: ${res.redemptionId}. Arrives in 1-2 business days.`
      );
      setRedeemDestination('');
      soundEngine.playWinCelebration(false);
    } else {
      setRedeemError(res.error || 'Failed to submit redemption request.');
    }
  };

  const currentCryptoObj =
    CRYPTO_PAYMENT_OPTIONS.find((c) => c.symbol === selectedCrypto) ||
    CRYPTO_PAYMENT_OPTIONS[0];

  const calculatedCryptoAmount = selectedPkg
    ? (selectedPkg.priceUsd * currentCryptoObj.rateMultiplier).toFixed(
        currentCryptoObj.symbol === 'USDT' ? 2 : 6
      )
    : '0';

  const cryptoPaymentUri = buildCryptoPaymentUri(currentCryptoObj, calculatedCryptoAmount);
  const cryptoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
    cryptoPaymentUri
  )}`;

  const txHistory = paymentService.getTransactionHistory();

  return (
    <div className="sc-cashier-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sc-cashier-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <header className="sc-cashier-header">
          <div className="sc-cashier-title-wrap">
            <div className="sc-cashier-logo-badge">
              <Coins size={20} />
            </div>
            <div>
              <h2 className="sc-cashier-title">COIN STORE &amp; CASHIER</h2>
              <p className="sc-cashier-subtitle">
                {activeTab === 'store'
                  ? step === 1
                    ? 'Choose a Gold Coin package — Every package includes FREE Sweeps Coins (SC)!'
                    : 'Choose how you want to pay'
                  : activeTab === 'redeem'
                  ? 'Redeem Sweeps Coins for Real Money (1 SC = $1.00 USD)'
                  : 'Purchase & Redemption History'}
              </p>
            </div>
          </div>

          <div className="sc-cashier-header-right">
            <div className="sc-cashier-balance-pill">
              <span className="sc-bal-gc">
                <Coins size={14} />
                {goldCoins.toLocaleString()} GC
              </span>
              <span className="sc-bal-sep">|</span>
              <span className="sc-bal-sc">
                <Gem size={14} />
                {sweepsCoins.toFixed(2)} SC
              </span>
            </div>

            <button
              type="button"
              className="sc-cashier-close-btn"
              onClick={onClose}
              aria-label="Close Store"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Top Navigation Tabs */}
        <nav className="sc-cashier-tabs">
          <button
            type="button"
            className={`sc-cashier-tab ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('store');
              setStep(1);
              soundEngine.playButtonClick(420);
            }}
          >
            <Coins size={15} />
            <span>Get Coins</span>
          </button>

          <button
            type="button"
            className={`sc-cashier-tab ${activeTab === 'redeem' ? 'active-green' : ''}`}
            onClick={() => {
              setActiveTab('redeem');
              soundEngine.playButtonClick(420);
            }}
          >
            <DollarSign size={15} />
            <span>Redeem SC</span>
          </button>

          <button
            type="button"
            className={`sc-cashier-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              soundEngine.playButtonClick(420);
            }}
          >
            <History size={15} />
            <span>History ({txHistory.length})</span>
          </button>
        </nav>

        {/* Main Body */}
        <div className="sc-cashier-body">
          {/* Purchase Success Screen */}
          {purchaseCompletedPkg && (
            <div className="sc-cashier-success-box">
              <CheckCircle2 size={54} className="sc-success-icon" />
              <h3>Purchase Complete!</h3>
              <p>
                Added <strong>+{purchaseCompletedPkg.goldCoins.toLocaleString()} Gold Coins</strong> &amp;{' '}
                <strong className="sc-green-text">
                  +{purchaseCompletedPkg.freeSweepsCoins.toFixed(2)} FREE Sweeps Coins
                </strong>{' '}
                to your balance!
              </p>
              <span className="sc-returning-note">Returning to game...</span>
            </div>
          )}

          {/* ================================================================
              TAB 1: GET COINS (SIMPLE 2-STEP SC CASINO CHECKOUT)
             ================================================================ */}
          {!purchaseCompletedPkg && activeTab === 'store' && (
            <>
              {/* STEP 1: CHOOSE A PACKAGE */}
              {step === 1 && (
                <div className="sc-packages-step">
                  <div className="sc-packages-grid">
                    {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`sc-pkg-card ${pkg.popular ? 'popular' : ''}`}
                        onClick={() => handleSelectPackage(pkg)}
                        role="button"
                        tabIndex={0}
                      >
                        {pkg.badge && (
                          <div className="sc-pkg-ribbon">
                            <Crown size={11} />
                            <span>{pkg.badge}</span>
                          </div>
                        )}

                        <div className="sc-pkg-gc-section">
                          <div className="sc-pkg-gc-amount">
                            <Coins size={19} className="sc-gold-icon" />
                            <span>{pkg.goldCoins.toLocaleString()}</span>
                          </div>
                          <span className="sc-pkg-gc-label">GOLD COINS</span>
                        </div>

                        <div className="sc-pkg-sc-bonus">
                          <Gem size={15} className="sc-emerald-icon" />
                          <span>FREE {pkg.freeSweepsCoins.toFixed(2)} SC</span>
                        </div>

                        <button
                          type="button"
                          className="sc-pkg-buy-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPackage(pkg);
                          }}
                        >
                          <span>${pkg.priceUsd.toFixed(2)}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="sc-cashier-trust-footer">
                    <span>
                      <ShieldCheck size={14} /> 256-Bit SSL Encrypted Checkout
                    </span>
                    <span>•</span>
                    <span>Instant Coin Delivery</span>
                    <span>•</span>
                    <span>Powered by Stripe</span>
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE PAYMENT METHOD (Pay with Card, Cash App Pay, or Crypto) */}
              {step === 2 && selectedPkg && (
                <div className="sc-payment-step">
                  <button
                    type="button"
                    className="sc-back-btn"
                    onClick={() => {
                      setStep(1);
                      setShowCryptoBox(false);
                      setCheckoutError('');
                      soundEngine.playButtonClick(420);
                    }}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Packages</span>
                  </button>

                  {/* Selected Package Summary Box */}
                  <div className="sc-selected-summary-card">
                    <div className="sc-summary-left">
                      <span className="sc-summary-eyebrow">SELECTED PACKAGE</span>
                      <div className="sc-summary-coins">
                        <strong>{selectedPkg.goldCoins.toLocaleString()} Gold Coins</strong>
                        <span className="sc-summary-plus">+</span>
                        <strong className="sc-summary-sc">
                          FREE {selectedPkg.freeSweepsCoins.toFixed(2)} SC
                        </strong>
                      </div>
                    </div>
                    <div className="sc-summary-price">
                      <span className="sc-summary-price-label">Total</span>
                      <strong>${selectedPkg.priceUsd.toFixed(2)}</strong>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="sc-error-banner">
                      <AlertCircle size={16} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <h3 className="sc-choose-method-heading">Choose Payment Method</h3>

                  {/* 3 Clean Payment Option Buttons */}
                  <div className="sc-method-buttons-stack">
                    {/* 1. Pay with Card -> Redirects straight to Stripe */}
                    <button
                      type="button"
                      className="sc-method-choice-btn card-method"
                      onClick={() => handleStripeRedirect('card')}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <div className="sc-method-icon-box card-icon-box">
                        <CreditCard size={24} />
                      </div>
                      <div className="sc-method-info">
                        <div className="sc-method-title-row">
                          <strong>Pay with Card</strong>
                          <span className="sc-method-tag stripe-tag">STRIPE CHECKOUT</span>
                        </div>
                        <span className="sc-method-sub">
                          Visa, Mastercard, Amex, Apple Pay &amp; Google Pay — Opens Stripe Payment Page
                        </span>
                      </div>
                      <div className="sc-method-action">
                        {redirectingMethod === 'card' ? (
                          <Loader2 size={20} className="sc-spin" />
                        ) : (
                          <ExternalLink size={18} />
                        )}
                      </div>
                    </button>

                    {/* 2. Cash App Pay -> Redirects straight to Stripe Cash App Pay */}
                    <button
                      type="button"
                      className="sc-method-choice-btn cashapp-method"
                      onClick={() => handleStripeRedirect('cashapp')}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <div className="sc-method-icon-box cashapp-icon-box">
                        <span>$</span>
                      </div>
                      <div className="sc-method-info">
                        <div className="sc-method-title-row">
                          <strong>Cash App Pay</strong>
                          <span className="sc-method-tag cashapp-tag">INSTANT</span>
                        </div>
                        <span className="sc-method-sub">
                          1-Tap Mobile &amp; QR Checkout via Cash App Pay
                        </span>
                      </div>
                      <div className="sc-method-action">
                        {redirectingMethod === 'cashapp' ? (
                          <Loader2 size={20} className="sc-spin" />
                        ) : (
                          <ExternalLink size={18} />
                        )}
                      </div>
                    </button>

                    {/* 3. Pay with Crypto */}
                    <button
                      type="button"
                      className={`sc-method-choice-btn crypto-method ${showCryptoBox ? 'active' : ''}`}
                      onClick={() => {
                        setShowCryptoBox(!showCryptoBox);
                        soundEngine.playButtonClick(500);
                      }}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <div className="sc-method-icon-box crypto-icon-box">
                        <Bitcoin size={24} />
                      </div>
                      <div className="sc-method-info">
                        <div className="sc-method-title-row">
                          <strong>Pay with Crypto</strong>
                          <span className="sc-method-tag crypto-tag">0% FEE</span>
                        </div>
                        <span className="sc-method-sub">
                          Instant USDT, Bitcoin (BTC), Ethereum (ETH), or Solana (SOL)
                        </span>
                      </div>
                      <div className="sc-method-action">
                        <ArrowRight size={18} />
                      </div>
                    </button>
                  </div>

                  {/* Clean Expandable Crypto Box when "Pay with Crypto" is clicked */}
                  {showCryptoBox && (
                    <div className="sc-crypto-drawer">
                      <div className="sc-crypto-coins-row">
                        {CRYPTO_PAYMENT_OPTIONS.map((c) => (
                          <button
                            key={c.symbol}
                            type="button"
                            className={`sc-crypto-pill ${selectedCrypto === c.symbol ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedCrypto(c.symbol);
                              setCopiedAddress(false);
                              soundEngine.playButtonClick(480);
                            }}
                          >
                            {c.symbol}
                          </button>
                        ))}
                      </div>

                      <div className="sc-crypto-details">
                        <div className="sc-crypto-qr-layout">
                          <div className="sc-crypto-qr-frame">
                            <img
                              src={cryptoQrUrl}
                              alt={`Scan to pay ${calculatedCryptoAmount} ${currentCryptoObj.unit}`}
                              className="sc-crypto-qr-img"
                            />
                            <span className="sc-crypto-qr-caption">
                              SCAN WITH WALLET APP
                            </span>
                          </div>

                          <div className="sc-crypto-info-col">
                            <div className="sc-crypto-amount-line">
                              Send <strong>{calculatedCryptoAmount} {currentCryptoObj.unit}</strong> on{' '}
                              <span>{currentCryptoObj.network}</span>:
                            </div>

                            <div className="sc-crypto-address-bar">
                              <code>{currentCryptoObj.address}</code>
                              <button
                                type="button"
                                className="sc-copy-btn"
                                onClick={() => handleCopyCryptoAddress(currentCryptoObj.address)}
                              >
                                {copiedAddress ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>

                            <a
                              href={cryptoPaymentUri}
                              className="sc-open-wallet-link"
                              onClick={() => soundEngine.playButtonClick(540)}
                            >
                              <ExternalLink size={14} />
                              <span>Open in Crypto Wallet App</span>
                            </a>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="sc-confirm-crypto-btn"
                          onClick={handleConfirmCryptoPayment}
                          disabled={isProcessingCrypto}
                        >
                          {isProcessingCrypto
                            ? 'Verifying Transfer...'
                            : 'I Have Sent Crypto — Credit My Coins'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="sc-redirect-note">
                    <Lock size={13} />
                    <span>
                      After completing payment on Stripe, you will be automatically redirected back to the game with your coins credited.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================
              TAB 2: REDEEM SWEEPS COINS FOR REAL MONEY (1 SC = $1.00 USD)
             ================================================================ */}
          {activeTab === 'redeem' && (
            <form onSubmit={handleRedeemSubmit} className="sc-redeem-form">
              <div className="sc-redeem-balance-card">
                <div>
                  <span className="sc-redeem-label">REDEEMABLE SWEEPS COINS</span>
                  <div className="sc-redeem-val">{sweepsCoins.toFixed(2)} SC</div>
                  <span className="sc-redeem-sub">
                    1.00 SC = $1.00 USD • Minimum Redemption: ${SWEEPSTAKES_CONFIG.minRedemptionSC.toFixed(2)} SC
                  </span>
                </div>
                <div className="sc-redeem-usd-box">
                  <span>Cash Value</span>
                  <strong>${sweepsCoins.toFixed(2)} USD</strong>
                </div>
              </div>

              {redeemError && (
                <div className="sc-error-banner">
                  <AlertCircle size={16} />
                  <span>{redeemError}</span>
                </div>
              )}

              {redeemSuccessMsg && (
                <div className="sc-success-banner">
                  <CheckCircle2 size={16} />
                  <span>{redeemSuccessMsg}</span>
                </div>
              )}

              <div className="sc-field-group">
                <label>Amount to Redeem (SC / USD)</label>
                <input
                  type="number"
                  min={SWEEPSTAKES_CONFIG.minRedemptionSC}
                  step="1"
                  value={redeemAmountInput}
                  onChange={(e) => setRedeemAmountInput(e.target.value)}
                  className="sc-input"
                  placeholder="50"
                />
              </div>

              <div className="sc-field-group">
                <label>Payout Method</label>
                <div className="sc-payout-methods-row">
                  {[
                    { id: 'ach', label: 'Bank Transfer (ACH)' },
                    { id: 'chime', label: 'Cash App / Chime' },
                    { id: 'debit', label: 'Instant Debit Card' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`sc-payout-pill ${redeemMethod === m.id ? 'active' : ''}`}
                      onClick={() => setRedeemMethod(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sc-field-group">
                <label>
                  {redeemMethod === 'ach'
                    ? 'Bank Name, Routing & Account Number'
                    : redeemMethod === 'chime'
                    ? 'Your $Cashtag or Chime Sign'
                    : 'Visa / Mastercard Debit Number'}
                </label>
                <input
                  type="text"
                  value={redeemDestination}
                  onChange={(e) => setRedeemDestination(e.target.value)}
                  className="sc-input"
                  placeholder={
                    redeemMethod === 'ach'
                      ? 'Chase • Routing 021000021 • Acct 000123456'
                      : redeemMethod === 'chime'
                      ? '$YourCashtag'
                      : '4242 •••• •••• 4242'
                  }
                />
              </div>

              <button type="submit" className="sc-submit-redeem-btn">
                Redeem ${parseFloat(redeemAmountInput || 0).toFixed(2)} USD Prize
              </button>
            </form>
          )}

          {/* ================================================================
              TAB 3: TRANSACTION HISTORY
             ================================================================ */}
          {activeTab === 'history' && (
            <div className="sc-history-list">
              {txHistory.length === 0 ? (
                <div className="sc-history-empty">
                  <History size={32} />
                  <p>No purchases or redemptions yet.</p>
                </div>
              ) : (
                txHistory.map((tx) => (
                  <div key={tx.id} className="sc-history-row">
                    <div>
                      <strong>{tx.type}</strong>
                      <div className="sc-history-date">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="sc-history-amounts">
                      {tx.goldCoins > 0 && (
                        <span className="sc-hist-gc">+{tx.goldCoins.toLocaleString()} GC</span>
                      )}
                      {tx.sweepsCoins !== 0 && (
                        <span className="sc-hist-sc">
                          {tx.sweepsCoins > 0 ? '+' : ''}
                          {Number(tx.sweepsCoins).toFixed(2)} SC
                        </span>
                      )}
                      <span className="sc-hist-usd">${Number(tx.amountUsd || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
