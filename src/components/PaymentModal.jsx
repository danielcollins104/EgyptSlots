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
  initialTab = 'store', // 'store' | 'redeem' | 'history'
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

  // Transactions list
  const txHistory = paymentService.getTransactionHistory();

  if (!isOpen) return null;

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
              </div>

              {/* Right Side: Purchases paused until server-verified Stripe Checkout is live */}
              <div className="checkout-bar-right">
                <div className="payments-paused-notice" role="status">
                  <AlertCircle size={16} />
                  <div>
                    <strong>Coin purchases are temporarily paused</strong>
                    <span>
                      We're upgrading to secure, server-verified checkout. Your balances are safe and
                      purchasing will return shortly.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guarantee Strip */}
            <div className="compact-security-strip">
              <ShieldCheck size={14} className="shield-icon" />
              <span>1 SC = $1 USD Prize Value • No Purchase Necessary</span>
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
                    <strong>Prize redemptions are temporarily paused</strong>
                    <span>
                      We're moving redemptions to a secure, verified system. No redemption requests are
                      being accepted right now, and nothing has been deducted from your Sweeps Coins.
                      Your balance is kept and you'll be able to redeem once the upgrade is complete.
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
