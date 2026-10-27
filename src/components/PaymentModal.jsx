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
  const [selectedPkg, setSelectedPkg] = useState(SWEEPSTAKES_CONFIG.storePackages[2]); // default to popular
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
          cardNumber,
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
      <div className="payment-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="payment-modal-header">
          <div className="payment-brand-title-wrap">
            <div className="payment-crown-badge">
              <Sparkles size={16} />
              <span>SWEEPSTAKES COIN VAULT</span>
            </div>
            <h2 className="payment-heading">COIN STORE &amp; PRIZE REDEMPTION</h2>
            <div className="payment-subheading">
              Gold Coins (Play for Fun) • Free Promotional Sweeps Coins (Play for Real Cash Prizes)
            </div>
          </div>

          <button className="payment-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={22} />
          </button>
        </div>

        {/* Live Balance Strip */}
        <div className="payment-live-balance-strip">
          <div className="currency-pill gc-pill">
            <Coins size={16} className="gc-icon" />
            <div className="curr-info">
              <span className="curr-label">GOLD COINS (GC)</span>
              <strong className="curr-val">{goldCoins.toLocaleString()}</strong>
            </div>
            <span className="curr-mode-tag">SOCIAL PLAY</span>
          </div>

          <div className="currency-pill sc-pill">
            <Gem size={16} className="sc-icon" />
            <div className="curr-info">
              <span className="curr-label">SWEEPS COINS (SC)</span>
              <strong className="curr-val">{sweepsCoins.toFixed(2)} SC</strong>
            </div>
            <span className="curr-mode-tag prize-tag">1 SC = $1.00 USD PRIZE</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="payment-nav-tabs">
          <button
            className={`pay-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <Coins size={15} />
            <span>Buy Gold Coins (+ Free SC)</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'redeem' ? 'active' : ''}`}
            onClick={() => setActiveTab('redeem')}
          >
            <Gift size={15} />
            <span>Redeem Real Cash Prizes</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('keys')}
          >
            <KeyRound size={15} />
            <span>Stripe / Chime API Keys</span>
          </button>

          <button
            className={`pay-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={15} />
            <span>Transactions</span>
          </button>
        </div>

        {/* TAB 1: STORE PACKAGES */}
        {activeTab === 'store' && (
          <div className="payment-tab-content store-tab">
            <div className="store-layout-grid">
              {/* Left Column: Package Selector */}
              <div className="packages-column">
                <div className="section-label">SELECT COIN PACKAGE:</div>
                <div className="packages-list">
                  {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                    const isSelected = selectedPkg?.id === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        className={`store-package-card ${isSelected ? 'selected' : ''} ${
                          pkg.popular ? 'popular' : ''
                        }`}
                        onClick={() => {
                          setSelectedPkg(pkg);
                          soundEngine.playButtonClick(540);
                        }}
                      >
                        {pkg.badge && <div className="package-badge">{pkg.badge}</div>}

                        <div className="package-main-info">
                          <div className="gc-amount-row">
                            <Coins size={18} className="gold-icon" />
                            <strong>{pkg.goldCoins.toLocaleString()} GC</strong>
                          </div>

                          <div className="sc-bonus-row">
                            <Sparkles size={14} className="sparkle-icon" />
                            <span>FREE BONUS:</span>
                            <strong className="sc-val">+{pkg.freeSweepsCoins.toFixed(2)} SC</strong>
                          </div>

                          <div className="package-tagline">{pkg.tagline}</div>
                        </div>

                        <div className="package-price-box">
                          <div className="package-price">${pkg.priceUsd.toFixed(2)}</div>
                          <span className="price-usd-label">USD</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Checkout & Payment Provider */}
              <div className="checkout-column">
                <div className="section-label">PAYMENT METHOD:</div>
                <div className="provider-selector-row">
                  <button
                    type="button"
                    className={`provider-btn ${provider === 'stripe' ? 'active' : ''}`}
                    onClick={() => setProvider('stripe')}
                  >
                    <CreditCard size={18} />
                    <div className="provider-texts">
                      <strong>Card / Stripe</strong>
                      <span>Visa, MC, Apple Pay</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`provider-btn ${provider === 'chime' ? 'active' : ''}`}
                    onClick={() => setProvider('chime')}
                  >
                    <Building2 size={18} />
                    <div className="provider-texts">
                      <strong>Chime Pay</strong>
                      <span>Fee-free direct</span>
                    </div>
                  </button>
                </div>

                {/* Selected Package Summary Box */}
                <div className="selected-summary-card">
                  <div className="summary-title">ORDER SUMMARY</div>
                  <div className="summary-row">
                    <span>Gold Coins (Play for Fun):</span>
                    <strong>{selectedPkg.goldCoins.toLocaleString()} GC</strong>
                  </div>
                  <div className="summary-row highlight">
                    <span>FREE Sweeps Coins Entry:</span>
                    <strong>+{selectedPkg.freeSweepsCoins.toFixed(2)} SC ($1.00/SC)</strong>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-row total">
                    <span>Total Due:</span>
                    <strong className="total-usd">${selectedPkg.priceUsd.toFixed(2)} USD</strong>
                  </div>
                </div>

                {/* Card or Chime Input Fields */}
                {provider === 'stripe' ? (
                  <div className="card-fields-box">
                    {selectedPkg.stripePaymentLink && (
                      <div className="stripe-official-box">
                        <a
                          href={selectedPkg.stripePaymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="stripe-hosted-checkout-btn"
                          onClick={() => {
                            soundEngine.playButtonClick(640);
                            setCheckoutFeedback({
                              type: 'success',
                              text: `Opening official Stripe checkout in new tab for ${selectedPkg.goldCoins.toLocaleString()} GC + FREE ${selectedPkg.freeSweepsCoins} SC!`,
                            });
                          }}
                        >
                          <div className="stripe-btn-top">
                            <CreditCard size={18} />
                            <span>PAY ${selectedPkg.priceUsd.toFixed(2)} VIA STRIPE CHECKOUT</span>
                            <ExternalLink size={16} />
                          </div>
                          <div className="stripe-supported-badges">
                            <span>Apple Pay</span>
                            <span>•</span>
                            <span>Google Pay</span>
                            <span>•</span>
                            <span>Cards</span>
                            <span>•</span>
                            <span>256-Bit SSL</span>
                          </div>
                        </a>
                        <div className="checkout-alt-divider">
                          <span>OR IN-GAME TEST CHECKOUT</span>
                        </div>
                      </div>
                    )}

                    <div className="field-group">
                      <label>CARD NUMBER (OR TEST CARD)</label>
                      <input
                        type="text"
                        placeholder="4242 •••• •••• 4242"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="payment-input"
                      />
                    </div>
                    <div className="fields-row">
                      <div className="field-group">
                        <label>EXPIRY</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="payment-input"
                        />
                      </div>
                      <div className="field-group">
                        <label>CVC</label>
                        <input
                          type="text"
                          placeholder="123"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          className="payment-input"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card-fields-box">
                    <div className="field-group">
                      <label>CHIME $CHIMESIGN / PHONE OR EMAIL</label>
                      <input
                        type="text"
                        placeholder="$YourChimeHandle or user@email.com"
                        value={chimeHandle}
                        onChange={(e) => setChimeHandle(e.target.value)}
                        className="payment-input"
                      />
                    </div>
                    <div className="chime-instructions">
                      Transfer directed to DC Enterprises: <strong>{currentKeys.chimeHandle}</strong>. Coins credit instantly.
                    </div>
                  </div>
                )}

                {/* Feedback Banner */}
                {checkoutFeedback && (
                  <div className={`checkout-feedback-banner ${checkoutFeedback.type}`}>
                    {checkoutFeedback.type === 'success' ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{checkoutFeedback.text}</span>
                  </div>
                )}

                {/* Purchase Button */}
                <button
                  type="button"
                  className="pay-now-cta-btn"
                  onClick={handleBuyPackage}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span>PROCESSING PAYMENT...</span>
                  ) : (
                    <>
                      <span>PAY ${selectedPkg.priceUsd.toFixed(2)} USD &amp; GET COINS</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div className="security-guarantee">
                  <ShieldCheck size={14} />
                  <span>256-bit encrypted checkout • US Sweepstakes Rule Compliant • No Purchase Necessary</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REDEEM REAL PRIZES */}
        {activeTab === 'redeem' && (
          <div className="payment-tab-content redeem-tab">
            <div className="redeem-container">
              <div className="redeem-hero-card">
                <div className="sc-balance-large">
                  <Gem size={28} className="sc-icon-large" />
                  <div>
                    <div className="label">REDEEMABLE SWEEPS COINS</div>
                    <div className="amount">{sweepsCoins.toFixed(2)} SC</div>
                  </div>
                  <div className="usd-equiv">= ${(sweepsCoins * 1.0).toFixed(2)} USD</div>
                </div>

                <div className="redeem-rules-pill">
                  <Clock size={14} />
                  <span>Minimum redemption: 50.00 SC ($50 USD) • 1 SC = $1.00 USD • Payout in 24-48 hrs</span>
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
                    <Building2 size={18} />
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
                    <CreditCard size={18} />
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
                  <div className="amount-hint">
                    You will receive <strong>${(parseFloat(redeemSC) || 0).toFixed(2)} USD</strong> directly.
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
                <KeyRound size={22} className="key-icon" />
                <div>
                  <h4>STRIPE &amp; CHIME API CONFIGURATION</h4>
                  <p>
                    Paste your live or test Stripe publishable key (`pk_live_...` or `pk_test_...`) or Chime API key below.
                    These keys are stored securely in your browser environment and used for live payment verification.
                  </p>
                </div>
              </div>

              <div className="field-group">
                <label>STRIPE PUBLISHABLE KEY (`pk_test_...` or `pk_live_...`)</label>
                <input
                  type="text"
                  placeholder="pk_test_51... or pk_live_51..."
                  value={stripeKeyInput}
                  onChange={(e) => setStripeKeyInput(e.target.value)}
                  className="payment-input mono"
                />
                <span className="field-tip">
                  Found in your Stripe Dashboard &gt; Developers &gt; API Keys &gt; Publishable Key.
                </span>
              </div>

              <div className="field-group">
                <label>CHIME API KEY / MERCHANT TOKEN</label>
                <input
                  type="text"
                  placeholder="chime_live_... or chime_partner_..."
                  value={chimeKeyInput}
                  onChange={(e) => setChimeKeyInput(e.target.value)}
                  className="payment-input mono"
                />
                <span className="field-tip">
                  Provided by Chime Developer Portal or merchant agreement.
                </span>
              </div>

              <div className="field-group">
                <label>CASINO OFFICIAL CHIME RECEIVING HANDLE ($Sign)</label>
                <input
                  type="text"
                  placeholder="$DCEgyptSlots"
                  value={chimeHandleInput}
                  onChange={(e) => setChimeHandleInput(e.target.value)}
                  className="payment-input"
                />
                <span className="field-tip">
                  The recipient $ChimeSign shown to users for direct Chime Pay deposits.
                </span>
              </div>

              {keysSavedMsg && (
                <div className="checkout-feedback-banner success">
                  <CheckCircle2 size={16} />
                  <span>Stripe &amp; Chime API configuration saved successfully!</span>
                </div>
              )}

              <button type="submit" className="save-keys-btn">
                <span>SAVE PAYMENT CONFIGURATION</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: TRANSACTION HISTORY */}
        {activeTab === 'history' && (
          <div className="payment-tab-content history-tab">
            <div className="section-label">PAYMENT &amp; REDEMPTION LEDGER:</div>
            {txHistory.length === 0 ? (
              <div className="empty-history-box">
                <History size={32} />
                <p>No transactions yet. Purchases and redemptions will appear here.</p>
              </div>
            ) : (
              <div className="tx-list">
                {txHistory.map((tx) => (
                  <div key={tx.id} className="tx-item-card">
                    <div className="tx-left">
                      <div className={`tx-type-badge ${tx.type}`}>
                        {tx.type === 'purchase' ? 'BUNDLE PURCHASE' : 'PRIZE REDEEM'}
                      </div>
                      <div className="tx-desc">{tx.description}</div>
                      <div className="tx-date">{new Date(tx.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="tx-right">
                      <div className="tx-amount">
                        {tx.type === 'purchase' ? `-$${tx.amountUsd.toFixed(2)}` : `+$${tx.amountUsd.toFixed(2)}`}
                      </div>
                      <div className={`tx-status ${tx.status}`}>{tx.status.toUpperCase()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
