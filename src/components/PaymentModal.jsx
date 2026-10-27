import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Gem,
  Coins,
  DollarSign,
  Gift,
  Clock,
  History,
  ExternalLink,
  Crown,
  Check,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { soundEngine } from '../audio/soundEngine';

export default function PaymentModal({
  isOpen,
  onClose,
  initialTab = 'store', // 'store' | 'redeem' | 'keys' | 'history'
  goldCoins,
  sweepsCoins,
  onPurchaseSuccess,
  onRedeemSuccess,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Selected store package (defaults to Silver / $19.99 popular)
  const [selectedPkg, setSelectedPkg] = useState(SWEEPSTAKES_CONFIG.storePackages[2]);
  const [provider, setProvider] = useState('stripe'); // 'stripe' | 'chime'

  // Checkout form fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [chimeHandle, setChimeHandle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutFeedback, setCheckoutFeedback] = useState(null);

  // Redemption state
  const [redeemSC, setRedeemSC] = useState(50);
  const [redeemDestination, setRedeemDestination] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState(null);

  // API Key management state
  const currentKeys = paymentService.getKeys();
  const [stripeKeyInput, setStripeKeyInput] = useState(currentKeys.stripePublishableKey);
  const [chimeKeyInput, setChimeKeyInput] = useState(currentKeys.chimeApiKey);
  const [chimeHandleInput, setChimeHandleInput] = useState(currentKeys.chimeHandle);
  const [keysSavedMsg, setKeysSavedMsg] = useState(false);

  // Transactions list
  const txHistory = paymentService.getTransactionHistory();

  if (!isOpen) return null;

  const handleSaveKeys = (e) => {
    e.preventDefault();
    paymentService.saveKeys({
      stripePublishableKey: stripeKeyInput,
      chimeApiKey: chimeKeyInput,
      chimeHandle: chimeHandleInput,
    });
    setKeysSavedMsg(true);
    soundEngine.playWin(false);
    setTimeout(() => setKeysSavedMsg(false), 2600);
  };

  const handleBuyPackage = async () => {
    if (!selectedPkg || isProcessing) return;
    setIsProcessing(true);
    setCheckoutFeedback(null);
    soundEngine.playButtonClick(600);

    try {
      const result = await paymentService.processPurchase({
        pkg: selectedPkg,
        provider,
        customerDetails: {
          cardNumber: cardNumber || '4242',
          chimeHandle: chimeHandle || currentKeys.chimeHandle,
        },
      });

      soundEngine.playWin(true);
      setCheckoutFeedback({
        type: 'success',
        text: result.message,
      });

      if (onPurchaseSuccess) {
        onPurchaseSuccess({
          goldCoinsAdded: result.goldCoins,
          sweepsCoinsAdded: result.sweepsCoins,
        });
      }
    } catch (err) {
      setCheckoutFeedback({
        type: 'error',
        text: err.message || 'Payment processing failed. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRedeem = async () => {
    const amount = parseFloat(redeemSC);
    if (isNaN(amount) || amount < SWEEPSTAKES_CONFIG.minRedemptionSC) {
      setRedeemFeedback({
        type: 'error',
        text: `Minimum redemption threshold is ${SWEEPSTAKES_CONFIG.minRedemptionSC} SC.`,
      });
      return;
    }

    if (amount > sweepsCoins) {
      setRedeemFeedback({
        type: 'error',
        text: `Insufficient Sweeps Coins balance. You have ${sweepsCoins.toFixed(2)} SC.`,
      });
      return;
    }

    if (!redeemDestination.trim()) {
      setRedeemFeedback({
        type: 'error',
        text: `Please enter your ${provider === 'chime' ? 'Chime $Sign / email' : 'bank account / routing details'}.`,
      });
      return;
    }

    setIsRedeeming(true);
    setRedeemFeedback(null);
    soundEngine.playButtonClick(640);

    try {
      const result = await paymentService.processRedemption({
        scAmount: amount,
        provider,
        payoutDestination: redeemDestination,
      });

      soundEngine.playWin(true);
      setRedeemFeedback({
        type: 'success',
        text: result.message,
      });

      if (onRedeemSuccess) {
        onRedeemSuccess(amount);
      }
    } catch (err) {
      setRedeemFeedback({
        type: 'error',
        text: err.message || 'Redemption request failed.',
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="payment-modal-backdrop" onClick={onClose}>
      <div className="payment-modal-dialog compact-single-page" onClick={(e) => e.stopPropagation()}>
        {/* Top Hero Banner with Generated Vault Artwork */}
        <div className="payment-vault-hero-banner">
          <img
            src="/assets/vault_store_banner.jpg"
            alt="DC Enterprises Royal Vault"
            className="vault-hero-bg-img"
          />
          <div className="vault-hero-gradient-overlay" />

          <div className="vault-hero-content">
            <div className="vault-brand-header">
              <div className="vault-pill-badge">
                <Crown size={14} className="crown-icon" />
                <span>DC ENTERPRISES • ROYAL TREASURE VAULT</span>
              </div>
              <h2 className="vault-store-heading">GOLD COIN STORE &amp; SWEEPSTAKES PRIZES</h2>
            </div>

            {/* Live Balance Pills inside the header */}
            <div className="vault-header-balances">
              <div className="vault-bal-card gc">
                <Coins size={16} className="bal-icon gc-icon" />
                <div className="bal-meta">
                  <span className="bal-label">GOLD COINS</span>
                  <strong className="bal-val">{goldCoins.toLocaleString()}</strong>
                </div>
              </div>

              <div className="vault-bal-card sc">
                <Gem size={16} className="bal-icon sc-icon" />
                <div className="bal-meta">
                  <span className="bal-label">SWEEPS COINS</span>
                  <strong className="bal-val">{sweepsCoins.toFixed(2)} SC</strong>
                </div>
              </div>
            </div>

            <button
              className="payment-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Compact Navigation Tabs */}
        <div className="payment-nav-tabs compact-tabs">
          <button
            className={`pay-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <Coins size={14} />
            <span>Buy Gold Coins (+ Free SC)</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'redeem' ? 'active' : ''}`}
            onClick={() => setActiveTab('redeem')}
          >
            <Gift size={14} />
            <span>Redeem Real Cash Prizes</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <KeyRound size={14} />
            <span>Stripe / Chime API Keys</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Transactions</span>
          </button>
        </div>

        {/* TAB 1: STORE PACKAGES (100% SINGLE SCREEN, NO SCROLL) */}
        {activeTab === 'store' && (
          <div className="payment-tab-content store-tab single-screen-store">
            {/* 5-Column Horizontal Package Shelf */}
            <div className="store-packages-shelf">
              {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                const isSelected = selectedPkg?.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`shelf-package-card ${isSelected ? 'selected' : ''} ${
                      pkg.popular ? 'popular' : ''
                    }`}
                    onClick={() => {
                      setSelectedPkg(pkg);
                      soundEngine.playButtonClick(540);
                    }}
                  >
                    {pkg.badge && (
                      <div className="shelf-badge-tag">{pkg.badge}</div>
                    )}

                    <div className="shelf-card-body">
                      {/* Gold Coins Amount */}
                      <div className="shelf-gc-row">
                        <Coins size={17} className="shelf-gc-icon" />
                        <span className="shelf-gc-val">{pkg.goldCoins.toLocaleString()}</span>
                        <span className="shelf-gc-unit">GC</span>
                      </div>

                      {/* Free Bonus Sweeps Coins */}
                      <div className="shelf-sc-pill">
                        <Sparkles size={12} className="sc-sparkle" />
                        <span>+{pkg.freeSweepsCoins.toFixed(2)} FREE SC</span>
                      </div>

                      <div className="shelf-tagline">{pkg.tagline}</div>

                      {/* Price Button Box */}
                      <div className={`shelf-price-btn ${isSelected ? 'active' : ''}`}>
                        <span>${pkg.priceUsd.toFixed(2)}</span>
                        <span className="shelf-usd-label">USD</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Checkout Console (Everything on One Screen) */}
            <div className="store-checkout-bar">
              {/* Left Side: Order Summary & Provider Selector */}
              <div className="checkout-bar-left">
                <div className="checkout-selection-pill">
                  <Coins size={15} className="shelf-gc-icon" />
                  <div className="summary-pill-text">
                    <strong>{selectedPkg.goldCoins.toLocaleString()} GC</strong>
                    <span className="sc-highlight">+ {selectedPkg.freeSweepsCoins.toFixed(2)} Free SC</span>
                    <span className="price-tag">(${selectedPkg.priceUsd.toFixed(2)} USD)</span>
                  </div>
                </div>

                <div className="provider-quick-toggle">
                  <button
                    type="button"
                    className={`quick-prov-btn ${provider === 'stripe' ? 'active' : ''}`}
                    onClick={() => setProvider('stripe')}
                  >
                    <CreditCard size={15} />
                    <span>Card / Stripe</span>
                  </button>

                  <button
                    type="button"
                    className={`quick-prov-btn ${provider === 'chime' ? 'active' : ''}`}
                    onClick={() => setProvider('chime')}
                  >
                    <Building2 size={15} />
                    <span>Chime Pay</span>
                  </button>
                </div>
              </div>

              {/* Right Side: Primary Purchase CTA & Feedback */}
              <div className="checkout-bar-right">
                {checkoutFeedback && (
                  <div className={`compact-feedback ${checkoutFeedback.type}`}>
                    {checkoutFeedback.type === 'success' ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <AlertCircle size={15} />
                    )}
                    <span>{checkoutFeedback.text}</span>
                  </div>
                )}

                {provider === 'stripe' ? (
                  <div className="stripe-cta-cluster">
                    {selectedPkg.stripePaymentLink && (
                      <a
                        href={selectedPkg.stripePaymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="stripe-master-pay-btn"
                        onClick={() => {
                          soundEngine.playButtonClick(640);
                          setCheckoutFeedback({
                            type: 'success',
                            text: `Opened Stripe Checkout for ${selectedPkg.goldCoins.toLocaleString()} GC + FREE ${selectedPkg.freeSweepsCoins} SC!`,
                          });
                        }}
                      >
                        <div className="stripe-btn-main">
                          <CreditCard size={18} />
                          <span>PAY ${selectedPkg.priceUsd.toFixed(2)} VIA STRIPE CHECKOUT</span>
                          <ExternalLink size={16} />
                        </div>
                        <div className="stripe-mini-badges">
                          <span>Apple Pay</span>
                          <span>•</span>
                          <span>Google Pay</span>
                          <span>•</span>
                          <span>Visa / Mastercard</span>
                          <span>•</span>
                          <span>256-Bit SSL</span>
                        </div>
                      </a>
                    )}

                    <button
                      type="button"
                      className="instant-sandbox-btn"
                      onClick={handleBuyPackage}
                      disabled={isProcessing}
                      title="Instant test mode credit without opening Stripe tab"
                    >
                      {isProcessing ? 'Crediting...' : '⚡ Instant Sandbox Credit'}
                    </button>
                  </div>
                ) : (
                  <div className="chime-cta-cluster">
                    <input
                      type="text"
                      placeholder="Your $ChimeSign or email"
                      value={chimeHandle}
                      onChange={(e) => setChimeHandle(e.target.value)}
                      className="compact-chime-input"
                    />
                    <button
                      type="button"
                      className="chime-confirm-pay-btn"
                      onClick={handleBuyPackage}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : `Confirm $${selectedPkg.priceUsd.toFixed(2)} via Chime`}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Guarantee Strip */}
            <div className="compact-security-strip">
              <ShieldCheck size={14} className="shield-icon" />
              <span>US Sweepstakes Rule Compliant (1 SC = $1 USD Prize Value) • No Purchase Necessary • Instant Coin Credit</span>
            </div>
          </div>
        )}

        {/* TAB 2: REDEEM REAL PRIZES */}
        {activeTab === 'redeem' && (
          <div className="payment-tab-content redeem-tab">
            <div className="redeem-container">
              <div className="redeem-hero-card">
                <div className="sc-balance-large">
                  <Gem size={26} className="sc-icon-large" />
                  <div>
                    <div className="label">REDEEMABLE SWEEPS COINS</div>
                    <div className="amount">{sweepsCoins.toFixed(2)} SC</div>
                  </div>
                  <div className="usd-equiv">= ${(sweepsCoins * 1.0).toFixed(2)} USD</div>
                </div>

                <div className="redeem-rules-pill">
                  <Clock size={13} />
                  <span>Minimum: 50.00 SC ($50 USD) • 1 SC = $1.00 USD • Payout in 24-48 hrs</span>
                </div>
              </div>

              <div className="redeem-form-card">
                <div className="section-label">PAYOUT DESTINATION:</div>
                <div className="provider-selector-row">
                  <button
                    type="button"
                    className={`provider-btn ${provider === 'chime' ? 'active' : ''}`}
                    onClick={() => setProvider('chime')}
                  >
                    <Building2 size={16} />
                    <div className="provider-texts">
                      <strong>Chime Account</strong>
                      <span>Direct to $ChimeSign</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`provider-btn ${provider === 'stripe' ? 'active' : ''}`}
                    onClick={() => setProvider('stripe')}
                  >
                    <CreditCard size={16} />
                    <div className="provider-texts">
                      <strong>Bank / Debit Card</strong>
                      <span>Direct via Stripe Payouts</span>
                    </div>
                  </button>
                </div>

                <div className="field-group">
                  <label>AMOUNT OF SWEEPS COINS TO REDEEM (MIN 50 SC)</label>
                  <div className="amount-input-wrap">
                    <input
                      type="number"
                      min={SWEEPSTAKES_CONFIG.minRedemptionSC}
                      max={sweepsCoins}
                      step="1"
                      value={redeemSC}
                      onChange={(e) => setRedeemSC(e.target.value)}
                      className="payment-input"
                    />
                    <span className="sc-suffix">SC</span>
                  </div>
                </div>

                <div className="field-group">
                  <label>
                    {provider === 'chime'
                      ? 'YOUR CHIME $CHIMESIGN OR LINKED CHIME EMAIL'
                      : 'BANK ROUTING & ACCOUNT OR DEBIT CARD NUMBER'}
                  </label>
                  <input
                    type="text"
                    placeholder={provider === 'chime' ? '$JohnDoe or john@gmail.com' : 'Bank Acct # or Debit Card'}
                    value={redeemDestination}
                    onChange={(e) => setRedeemDestination(e.target.value)}
                    className="payment-input"
                  />
                </div>

                {redeemFeedback && (
                  <div className={`checkout-feedback-banner ${redeemFeedback.type}`}>
                    {redeemFeedback.type === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{redeemFeedback.text}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="pay-now-cta-btn redeem-cta"
                  onClick={handleRedeem}
                  disabled={isRedeeming || sweepsCoins < SWEEPSTAKES_CONFIG.minRedemptionSC}
                >
                  {isRedeeming ? (
                    <span>PROCESSING REDEMPTION...</span>
                  ) : (
                    <>
                      <span>SUBMIT REDEMPTION FOR ${(parseFloat(redeemSC) || 0).toFixed(2)} USD</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STRIPE & CHIME API KEYS CONFIGURATION */}
        {activeTab === 'keys' && (
          <div className="payment-tab-content keys-tab">
            <form onSubmit={handleSaveKeys} className="keys-config-form">
              <div className="keys-intro-box">
                <KeyRound size={20} className="key-icon" />
                <div>
                  <h4>STRIPE &amp; CHIME API CONFIGURATION</h4>
                  <p>
                    Keys are stored securely in your browser environment and used for payment verification.
                  </p>
                </div>
              </div>

              <div className="field-group">
                <label>STRIPE PUBLISHABLE KEY</label>
                <input
                  type="text"
                  placeholder="pk_test_... or pk_live_..."
                  value={stripeKeyInput}
                  onChange={(e) => setStripeKeyInput(e.target.value)}
                  className="payment-input code-font"
                />
              </div>

              <div className="field-group">
                <label>CHIME USER HANDLE / $CHIMESIGN</label>
                <input
                  type="text"
                  placeholder="$Daniel-Collins-168"
                  value={chimeHandleInput}
                  onChange={(e) => setChimeHandleInput(e.target.value)}
                  className="payment-input code-font"
                />
              </div>

              {keysSavedMsg && (
                <div className="checkout-feedback-banner success">
                  <CheckCircle2 size={16} />
                  <span>Configuration saved successfully!</span>
                </div>
              )}

              <button type="submit" className="keys-save-btn">
                <span>SAVE CONFIGURATION</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: TRANSACTION HISTORY */}
        {activeTab === 'history' && (
          <div className="payment-tab-content history-tab">
            <div className="history-header-row">
              <h3>TRANSACTION &amp; REDEMPTION LOG</h3>
              <span className="history-count-tag">{txHistory.length} Records</span>
            </div>

            {txHistory.length === 0 ? (
              <div className="history-empty-state">
                <History size={36} className="empty-icon" />
                <p>No transactions yet. Purchases and prize redemptions will appear here.</p>
              </div>
            ) : (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Method</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txHistory.map((tx) => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`tx-type-badge ${tx.type}`}>
                            {tx.type === 'purchase' ? 'Purchase' : 'Redemption'}
                          </span>
                        </td>
                        <td>{tx.provider === 'chime' ? 'Chime' : 'Stripe'}</td>
                        <td className="tx-desc-cell">{tx.description}</td>
                        <td className="tx-amount-cell">
                          {tx.type === 'purchase'
                            ? `+$${tx.amountUsd.toFixed(2)}`
                            : `-$${tx.amountUsd.toFixed(2)}`}
                        </td>
                        <td>
                          <span className={`tx-status-badge ${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
