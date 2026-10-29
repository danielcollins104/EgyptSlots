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
  ChevronDown,
  ChevronUp,
  Flame,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG, calculateCustomPackage } from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { soundEngine } from '../audio/soundEngine';

export default function PaymentModal({
  isOpen,
  onClose,
  initialTab = 'store', // 'store' | 'redeem' | 'history'
  initialPackage = null,
  goldCoins,
  sweepsCoins,
  onPurchaseSuccess,
  onRedeemSuccess,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedPkg, setSelectedPkg] = useState(
    initialPackage || SWEEPSTAKES_CONFIG.storePackages[2]
  );
  const [showHighRoller, setShowHighRoller] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState('250');
  const [checkoutMessage, setCheckoutMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (initialPackage) {
        setSelectedPkg(initialPackage);
      }
      setCheckoutMessage(null);
    }
  }, [isOpen, initialTab, initialPackage]);

  // Compute live custom package from input
  const computedCustomPkg = calculateCustomPackage(customAmountInput);

  // Transactions list
  const txHistory = paymentService.getTransactionHistory();

  if (!isOpen) return null;

  const handleSelectPackage = (pkg) => {
    setSelectedPkg(pkg);
    setCheckoutMessage(null);
    soundEngine.playButtonClick(540);
  };

  const handleApplyCustomPackage = () => {
    setSelectedPkg(computedCustomPkg);
    setCheckoutMessage(null);
    soundEngine.playButtonClick(600);
  };

  const handleCheckout = () => {
    soundEngine.playButtonClick(700);

    // If there is an external Stripe Payment Link, open it in a new tab
    if (selectedPkg?.stripePaymentLink && selectedPkg.stripePaymentLink.startsWith('https://')) {
      window.open(selectedPkg.stripePaymentLink, '_blank', 'noopener,noreferrer');
    }

    // Record the pending / completed transaction in the local ledger
    const tx = paymentService.logTransaction({
      type: 'purchase',
      provider: 'stripe',
      description: `${selectedPkg.goldCoins.toLocaleString()} GC + ${selectedPkg.freeSweepsCoins.toFixed(2)} Free SC (${selectedPkg.badge || 'Store Package'})`,
      amountUsd: selectedPkg.priceUsd,
      status: 'completed',
    });

    // Credit coins immediately to bankroll
    if (onPurchaseSuccess) {
      onPurchaseSuccess({
        goldCoins: selectedPkg.goldCoins,
        freeSweepsCoins: selectedPkg.freeSweepsCoins,
        packageId: selectedPkg.id,
      });
    }

    setCheckoutMessage(
      `✓ Successfully credited +${selectedPkg.goldCoins.toLocaleString()} GC & +${selectedPkg.freeSweepsCoins.toFixed(2)} Free SC!`
    );
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
            className={`pay-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Transactions</span>
          </button>
        </div>

        {/* TAB 1: STORE PACKAGES */}
        {activeTab === 'store' && (
          <div className="payment-tab-content store-tab single-screen-store">
            {/* Standard 5-Column Package Shelf */}
            <div className="store-packages-shelf">
              {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                const isSelected = selectedPkg?.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`shelf-package-card ${isSelected ? 'selected' : ''} ${
                      pkg.popular ? 'popular' : ''
                    }`}
                    onClick={() => handleSelectPackage(pkg)}
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

            {/* Custom Amount Field Builder */}
            <div className="store-custom-amount-card">
              <div className="custom-input-left">
                <div className="custom-label-wrap">
                  <Flame size={14} className="flame-icon-custom" />
                  <strong>CUSTOM COIN BUNDLE:</strong>
                  <span className="custom-hint">Enter any amount ($10 — $100,000+)</span>
                </div>
                <div className="custom-field-controls">
                  <div className="custom-currency-input-wrap">
                    <span className="currency-prefix">$</span>
                    <input
                      type="number"
                      min="10"
                      max="100000"
                      step="10"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      className="custom-amount-number-input"
                      placeholder="Amount"
                    />
                    <span className="currency-suffix">USD</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="custom-preset-chips">
                    {[250, 500, 1000, 2500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-chip-btn ${customAmountInput === String(preset) ? 'active' : ''}`}
                        onClick={() => {
                          setCustomAmountInput(String(preset));
                          soundEngine.playButtonClick(480);
                        }}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live dynamic preview of custom coins */}
              <div className="custom-preview-right">
                <div className="custom-preview-stats">
                  <div className="stat-gc">
                    <Coins size={14} className="gc-icon-gold" />
                    <strong>{computedCustomPkg.goldCoins.toLocaleString()} GC</strong>
                  </div>
                  <div className="stat-sc">
                    <Gem size={13} className="sc-icon-gem" />
                    <strong>+{computedCustomPkg.freeSweepsCoins.toFixed(2)} Free SC</strong>
                    <span className="custom-bonus-tag">{computedCustomPkg.savings}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`custom-select-btn ${selectedPkg?.id === computedCustomPkg.id ? 'selected' : ''}`}
                  onClick={handleApplyCustomPackage}
                >
                  {selectedPkg?.id === computedCustomPkg.id ? '✓ Selected' : 'Select Custom'}
                </button>
              </div>
            </div>

            {/* High Roller Packages Reveal Toggle Link */}
            <div className="high-roller-toggle-row">
              <button
                type="button"
                className={`high-roller-toggle-link ${showHighRoller ? 'open' : ''}`}
                onClick={() => {
                  setShowHighRoller(!showHighRoller);
                  soundEngine.playButtonClick(480);
                }}
              >
                <Crown size={15} className="crown-icon-hr" />
                <span>high roller packages ($5,000, $10,000 &amp; $50,000 VIP Vault)</span>
                {showHighRoller ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* High Roller VIP Shelf (Shown when toggle is clicked) */}
            {showHighRoller && (
              <div className="high-roller-shelf">
                {SWEEPSTAKES_CONFIG.highRollerPackages.map((pkg) => {
                  const isSelected = selectedPkg?.id === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      className={`high-roller-card ${isSelected ? 'selected' : ''} ${pkg.popular ? 'popular' : ''}`}
                      onClick={() => handleSelectPackage(pkg)}
                    >
                      <div className="hr-badge">{pkg.badge}</div>

                      <div className="hr-tier-header">
                        <Crown size={18} className="hr-crown-gold" />
                        <h4 className="hr-tier-title">{pkg.tierName}</h4>
                      </div>

                      <div className="hr-metrics">
                        <div className="hr-gc-display">
                          <Coins size={16} className="gc-icon-gold" />
                          <span>{pkg.goldCoins.toLocaleString()} GC</span>
                        </div>
                        <div className="hr-sc-display">
                          <Gem size={16} className="sc-icon-gem" />
                          <span>+{pkg.freeSweepsCoins.toLocaleString()} FREE SC</span>
                        </div>
                      </div>

                      <p className="hr-tagline">{pkg.tagline}</p>

                      <div className="hr-price-btn-wrap">
                        <div className={`hr-price-box ${isSelected ? 'active' : ''}`}>
                          <span>${pkg.priceUsd.toLocaleString()}</span>
                          <span className="hr-usd">USD</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Checkout Console */}
            <div className="store-checkout-bar">
              {/* Order Summary */}
              <div className="checkout-bar-left">
                <div className="checkout-selection-pill">
                  <Coins size={16} className="shelf-gc-icon" />
                  <div className="summary-pill-text">
                    <strong>{selectedPkg.goldCoins.toLocaleString()} GC</strong>
                    <span className="sc-highlight">+ {selectedPkg.freeSweepsCoins.toFixed(2)} Free SC</span>
                    <span className="price-tag">(${selectedPkg.priceUsd.toLocaleString()} USD)</span>
                  </div>
                </div>
              </div>

              {/* Checkout Action Button */}
              <div className="checkout-bar-right">
                <button
                  type="button"
                  className="instant-checkout-btn"
                  onClick={handleCheckout}
                >
                  <CreditCard size={16} />
                  <span>CHECKOUT WITH STRIPE (${selectedPkg.priceUsd.toLocaleString()})</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Live feedback message if transaction completed */}
            {checkoutMessage && (
              <div className="checkout-success-feedback" role="status">
                <CheckCircle2 size={16} />
                <span>{checkoutMessage}</span>
              </div>
            )}

            {/* Guarantee Strip */}
            <div className="compact-security-strip">
              <ShieldCheck size={14} className="shield-icon" />
              <span>1 SC = $1 USD Prize Value &bull; Instant Delivery &bull; Safe &amp; Secure 256-bit Encryption</span>
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
                  <span>Minimum: {SWEEPSTAKES_CONFIG.minRedemptionSC}.00 SC • 1 SC = $1.00 USD</span>
                </div>
              </div>

              <div className="redeem-form-card">
                <div className="payments-paused-notice" role="status">
                  <AlertCircle size={16} />
                  <div>
                    <strong>Prize Redemptions</strong>
                    <span>
                      Cash prize redemptions are processed directly via Stripe Connect or ACH Bank Wire.
                      Your redeemable Sweeps Coins balance is maintained safely. Redemptions require a minimum of 50.00 SC.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSACTION HISTORY */}
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
                            ? `+$${Number(tx.amountUsd).toFixed(2)}`
                            : `-$${Number(tx.amountUsd).toFixed(2)}`}
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
