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
  Bitcoin,
  QrCode,
  Copy,
  Wallet,
  Calendar,
  AlertTriangle,
  Scale,
  Zap,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG, calculateCustomPackage } from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { soundEngine } from '../audio/soundEngine';
import PrivacyTermsModal from './PrivacyTermsModal';

const CRYPTO_OPTIONS = [
  {
    symbol: 'USDT',
    name: 'Tether (USDT)',
    network: 'Solana / Polygon (0% Gas)',
    address: 'So11111111111111111111111111111111111111112dc',
    rateMultiplier: 1.0,
    unit: 'USDT',
    badge: 'INSTANT &bull; 0% FEE',
    color: '#26a17b',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'Lightning & Native SegWit',
    address: 'bc1q9dcenterpriseskemetrelics78x2yza4901mn',
    rateMultiplier: 0.0000108,
    unit: 'BTC',
    badge: 'MOST SECURE',
    color: '#f7931a',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'Arbitrum & ERC-20',
    address: '0xDC049E71F32B59Ca9178E6B20261024T0819119',
    rateMultiplier: 0.000325,
    unit: 'ETH',
    badge: 'POPULAR',
    color: '#627eea',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    network: 'Solana Mainnet (Sub-second)',
    address: 'DC8kemetVaultPhaserSlot49182371948291048291',
    rateMultiplier: 0.0054,
    unit: 'SOL',
    badge: 'FASTEST (0.4s)',
    color: '#14f195',
  },
];

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
  const [selectedPkg, setSelectedPkg] = useState(
    initialPackage || SWEEPSTAKES_CONFIG.storePackages[2]
  );
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'crypto' | 'klarna' | 'paylater' | 'wallets'
  const [cryptoCoin, setCryptoCoin] = useState('USDT');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showHighRoller, setShowHighRoller] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState('250');
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Redemption form state
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('ach'); // 'ach' | 'crypto' | 'chime'
  const [redeemDestination, setRedeemDestination] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (initialPackage) {
        setSelectedPkg(initialPackage);
      }
      setCheckoutMessage(null);
      setRedeemSuccessMsg('');
      setRedeemError('');
      setCopiedAddress(false);
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

  const handleCopyAddress = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedAddress(true);
    soundEngine.playButtonClick(700);
    setTimeout(() => setCopiedAddress(false), 2200);
  };

  const activeCrypto = CRYPTO_OPTIONS.find((c) => c.symbol === cryptoCoin) || CRYPTO_OPTIONS[0];
  const cryptoAmount = (selectedPkg.priceUsd * activeCrypto.rateMultiplier).toFixed(
    activeCrypto.symbol === 'BTC' ? 6 : activeCrypto.symbol === 'ETH' ? 4 : 2
  );

  const handleCheckout = () => {
    soundEngine.playButtonClick(700);

    let provider = 'stripe';
    let providerLabel = 'Card / Stripe';
    if (paymentMethod === 'crypto') {
      const cryptoSym = String(activeCrypto?.symbol || 'crypto').toLowerCase();
      provider = `crypto_${cryptoSym}`;
      providerLabel = `Crypto (${String(activeCrypto?.symbol || 'Crypto')})`;
    } else if (paymentMethod === 'klarna') {
      provider = 'klarna';
      providerLabel = 'Klarna (Pay in 4)';
    } else if (paymentMethod === 'paylater') {
      provider = 'afterpay';
      providerLabel = 'PayLater (Afterpay)';
    } else if (paymentMethod === 'wallets') {
      provider = 'apple_google_pay';
      providerLabel = 'Digital Wallet (Apple/Google Pay)';
    }

    // If external Stripe Payment Link exists and card is selected, open link
    if (paymentMethod === 'card' && selectedPkg?.stripePaymentLink && selectedPkg.stripePaymentLink.startsWith('https://')) {
      window.open(selectedPkg.stripePaymentLink, '_blank', 'noopener,noreferrer');
    }

    // Record the completed transaction in the local ledger
    paymentService.logTransaction({
      type: 'purchase',
      provider,
      description: `${selectedPkg.goldCoins.toLocaleString()} GC + ${selectedPkg.freeSweepsCoins.toFixed(2)} Free SC (${providerLabel})`,
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
      `✓ Successfully processed via ${providerLabel}! Credited +${selectedPkg.goldCoins.toLocaleString()} GC & +${selectedPkg.freeSweepsCoins.toFixed(2)} Free SC to your wallet.`
    );
  };

  const handleRequestRedemption = (e) => {
    e.preventDefault();
    const amountNum = parseFloat(redeemAmountInput);
    if (isNaN(amountNum) || amountNum < SWEEPSTAKES_CONFIG.minRedemptionSC) {
      setRedeemError(`Minimum prize redemption is ${SWEEPSTAKES_CONFIG.minRedemptionSC}.00 SC ($${SWEEPSTAKES_CONFIG.minRedemptionSC}.00 USD).`);
      soundEngine.playButtonClick(400);
      return;
    }
    if (amountNum > sweepsCoins) {
      setRedeemError('Requested amount exceeds your available redeemable Sweeps Coins balance.');
      soundEngine.playButtonClick(400);
      return;
    }
    const dest = String(redeemDestination || '').trim();
    if (!dest) {
      setRedeemError('Please provide your payout account details, routing number, or crypto wallet address.');
      soundEngine.playButtonClick(400);
      return;
    }

    soundEngine.playWinCelebration?.('mini');

    // Deduct SC from balance
    if (onRedeemSuccess) {
      onRedeemSuccess(amountNum);
    }

    const safeMethod = String(redeemMethod || 'payout');
    // Log transaction
    paymentService.logTransaction({
      type: 'redemption',
      provider: safeMethod,
      description: `Prize Redemption: ${amountNum.toFixed(2)} SC ($${amountNum.toFixed(2)} USD via ${safeMethod.toUpperCase()} to ${dest})`,
      amountUsd: amountNum,
      status: 'Pending Liquidity Clearance (3-7 Business Days)',
    });

    setRedeemSuccessMsg(
      `✓ Redemption of $${amountNum.toFixed(2)} USD queued! Disbursing to ${dest} per Emerging Operator Liquidity Schedule.`
    );
    setRedeemError('');
  };

  return (
    <div className="payment-modal-backdrop" onClick={onClose}>
      <div className="payment-modal-dialog compact-single-page" onClick={(e) => e.stopPropagation()}>
        {/* Top Hero Banner with Generated Vault Artwork */}
        <div className="payment-vault-hero-banner">
          <img
            src="/assets/vault_store_banner.webp"
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
              <div className="v-bal-pill gc">
                <Coins size={14} className="gc-coin-icon" />
                <span>{goldCoins.toLocaleString()} GC</span>
              </div>
              <div className="v-bal-pill sc">
                <Gem size={14} className="sc-gem-icon" />
                <span>{sweepsCoins.toFixed(2)} SC</span>
              </div>
            </div>
          </div>

          <button className="payment-modal-close-btn" onClick={onClose} aria-label="Close store">
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="payment-modal-tabs">
          <button
            className={`pay-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <Coins size={16} />
            <span>Coin Packages Store</span>
          </button>
          <button
            className={`pay-tab-btn ${activeTab === 'redeem' ? 'active' : ''}`}
            onClick={() => setActiveTab('redeem')}
          >
            <Gem size={16} />
            <span>Redeem Real Cash Prizes</span>
          </button>
          <button
            className={`pay-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>Transaction Ledger</span>
          </button>
        </div>

        {/* TAB 1: COIN PACKAGES STORE */}
        {activeTab === 'store' && (
          <div className="payment-tab-content store-tab">
            {/* Standard Packages Shelf */}
            <div className="store-packages-shelf">
              {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                const isSelected = selectedPkg?.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`store-shelf-card shelf-package-card ${isSelected ? 'selected' : ''} ${pkg.popular ? 'popular' : ''}`}
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    {pkg.popular && (
                      <div className="shelf-badge-popular">MOST POPULAR</div>
                    )}
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

            {/* High Roller VIP Shelf */}
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

            {/* PAYMENT METHODS SELECTOR CONSOLE */}
            <div className="payment-methods-selector-section">
              <div className="payment-methods-header">
                <strong>SELECT PAYMENT METHOD:</strong>
                <span className="secure-badge">
                  <ShieldCheck size={13} /> 256-bit Encrypted
                </span>
              </div>

              <div className="payment-method-tabs-row">
                <button
                  type="button"
                  className={`pm-tab-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('card');
                    soundEngine.playButtonClick(540);
                  }}
                >
                  <CreditCard size={15} />
                  <span>Card / Stripe</span>
                </button>

                <button
                  type="button"
                  className={`pm-tab-btn crypto-tab ${paymentMethod === 'crypto' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('crypto');
                    soundEngine.playButtonClick(600);
                  }}
                >
                  <Bitcoin size={15} />
                  <span>Crypto (BTC / USDT)</span>
                  <span className="pm-chip-instant">0% GAS</span>
                </button>

                <button
                  type="button"
                  className={`pm-tab-btn klarna-tab ${paymentMethod === 'klarna' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('klarna');
                    soundEngine.playButtonClick(580);
                  }}
                >
                  <span className="klarna-pill-icon">K.</span>
                  <span>Klarna (Pay in 4)</span>
                </button>

                <button
                  type="button"
                  className={`pm-tab-btn paylater-tab ${paymentMethod === 'paylater' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('paylater');
                    soundEngine.playButtonClick(560);
                  }}
                >
                  <Calendar size={15} />
                  <span>Afterpay / Affirm</span>
                </button>

                <button
                  type="button"
                  className={`pm-tab-btn wallets-tab ${paymentMethod === 'wallets' ? 'active' : ''}`}
                  onClick={() => {
                    setPaymentMethod('wallets');
                    soundEngine.playButtonClick(540);
                  }}
                >
                  <Wallet size={15} />
                  <span>Apple / Google Pay</span>
                </button>
              </div>

              {/* METHOD 1: CRYPTO DETAILS DRAWER */}
              {paymentMethod === 'crypto' && (
                <div className="pm-crypto-details-card">
                  <div className="crypto-coin-chips">
                    {CRYPTO_OPTIONS.map((c) => (
                      <button
                        key={c.symbol}
                        type="button"
                        className={`crypto-chip-btn ${cryptoCoin === c.symbol ? 'active' : ''}`}
                        onClick={() => {
                          setCryptoCoin(c.symbol);
                          soundEngine.playButtonClick(640);
                        }}
                      >
                        <span className="coin-dot" style={{ backgroundColor: c.color }} />
                        <strong>{c.symbol}</strong>
                        <span className="coin-sub">{c.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="crypto-qr-address-grid">
                    <div className="crypto-qr-box">
                      {/* Stylized geometric QR SVG */}
                      <svg viewBox="0 0 100 100" className="crypto-qr-svg" width="90" height="90">
                        <rect width="100" height="100" fill="#0f172a" rx="8" />
                        <rect x="10" y="10" width="28" height="28" fill="#38bdf8" rx="4" />
                        <rect x="16" y="16" width="16" height="16" fill="#0f172a" rx="2" />
                        <rect x="20" y="20" width="8" height="8" fill="#38bdf8" />
                        <rect x="62" y="10" width="28" height="28" fill="#38bdf8" rx="4" />
                        <rect x="68" y="16" width="16" height="16" fill="#0f172a" rx="2" />
                        <rect x="72" y="20" width="8" height="8" fill="#38bdf8" />
                        <rect x="10" y="62" width="28" height="28" fill="#38bdf8" rx="4" />
                        <rect x="16" y="68" width="16" height="16" fill="#0f172a" rx="2" />
                        <rect x="20" y="72" width="8" height="8" fill="#38bdf8" />
                        <rect x="46" y="15" width="8" height="8" fill="#38bdf8" />
                        <rect x="46" y="32" width="8" height="16" fill="#38bdf8" />
                        <rect x="46" y="60" width="8" height="8" fill="#38bdf8" />
                        <rect x="62" y="52" width="14" height="8" fill="#38bdf8" />
                        <rect x="80" y="52" width="10" height="10" fill="#38bdf8" />
                        <rect x="62" y="70" width="8" height="20" fill="#38bdf8" />
                        <rect x="76" y="76" width="14" height="14" fill="#38bdf8" />
                      </svg>
                      <span className="qr-hint">Scan with Wallet</span>
                    </div>

                    <div className="crypto-details-right">
                      <div className="crypto-rate-row">
                        <span className="label">AMOUNT TO SEND:</span>
                        <strong className="crypto-amount-large">
                          {cryptoAmount} {activeCrypto.unit}
                        </strong>
                        <span className="usd-match">(${selectedPkg.priceUsd.toFixed(2)} USD)</span>
                      </div>

                      <div className="crypto-network-row">
                        <span className="net-tag">{activeCrypto.network}</span>
                        <span className="instant-tag">Instant 1-Confirmation Credit</span>
                      </div>

                      <div className="crypto-address-copy-box">
                        <code className="crypto-addr-txt">{activeCrypto.address}</code>
                        <button
                          type="button"
                          className="copy-addr-btn"
                          onClick={() => handleCopyAddress(activeCrypto.address)}
                          title="Copy deposit address"
                        >
                          {copiedAddress ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedAddress ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD 2: KLARNA DETAILS DRAWER */}
              {paymentMethod === 'klarna' && (
                <div className="pm-bnpl-details-card klarna-theme">
                  <div className="bnpl-header">
                    <span className="klarna-logo-badge">Klarna.</span>
                    <strong>Pay in 4 interest-free installments</strong>
                    <span className="zero-apr">0% APR</span>
                  </div>

                  <div className="bnpl-installments-grid">
                    <div className="installment-box active">
                      <span className="due-label">DUE TODAY</span>
                      <strong className="inst-val">${(selectedPkg.priceUsd / 4).toFixed(2)}</strong>
                      <span className="inst-date">1st payment</span>
                    </div>
                    <div className="installment-box">
                      <span className="due-label">IN 2 WEEKS</span>
                      <strong className="inst-val">${(selectedPkg.priceUsd / 4).toFixed(2)}</strong>
                      <span className="inst-date">2nd payment</span>
                    </div>
                    <div className="installment-box">
                      <span className="due-label">IN 4 WEEKS</span>
                      <strong className="inst-val">${(selectedPkg.priceUsd / 4).toFixed(2)}</strong>
                      <span className="inst-date">3rd payment</span>
                    </div>
                    <div className="installment-box">
                      <span className="due-label">IN 6 WEEKS</span>
                      <strong className="inst-val">${(selectedPkg.priceUsd / 4).toFixed(2)}</strong>
                      <span className="inst-date">4th payment</span>
                    </div>
                  </div>

                  <p className="bnpl-disclaimer">
                    No hard credit check. Automatically deducted every 2 weeks. Instant delivery of your {selectedPkg.goldCoins.toLocaleString()} GC &amp; {selectedPkg.freeSweepsCoins.toFixed(2)} Free SC right now!
                  </p>
                </div>
              )}

              {/* METHOD 3: PAYLATER / AFTERPAY / AFFIRM */}
              {paymentMethod === 'paylater' && (
                <div className="pm-bnpl-details-card afterpay-theme">
                  <div className="bnpl-header">
                    <span className="afterpay-logo-badge">afterpay &#9671; affirm</span>
                    <strong>Flexible PayLater Financing</strong>
                    <span className="zero-apr">Split in 4</span>
                  </div>

                  <div className="bnpl-installments-grid">
                    <div className="installment-box active">
                      <span className="due-label">TODAY</span>
                      <strong className="inst-val">${(selectedPkg.priceUsd / 4).toFixed(2)}</strong>
                      <span className="inst-date">Instant Unlock</span>
                    </div>
                    <div className="installment-box">
                      <span className="due-label">BI-WEEKLY</span>
                      <strong className="inst-val">3 Payments</strong>
                      <span className="inst-date">${(selectedPkg.priceUsd / 4).toFixed(2)} each</span>
                    </div>
                  </div>

                  <p className="bnpl-disclaimer">
                    Affirm monthly terms available for packages over $250. Select at checkout. No hidden fees or prepayment penalties.
                  </p>
                </div>
              )}
            </div>

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
                  {paymentMethod === 'crypto' ? (
                    <>
                      <Bitcoin size={16} />
                      <span>CONFIRM CRYPTO DEPOSIT ({cryptoAmount} {activeCrypto.symbol})</span>
                    </>
                  ) : paymentMethod === 'klarna' ? (
                    <>
                      <span className="k-bold">K.</span>
                      <span>PAY WITH KLARNA (${(selectedPkg.priceUsd / 4).toFixed(2)} TODAY)</span>
                    </>
                  ) : paymentMethod === 'paylater' ? (
                    <>
                      <Calendar size={16} />
                      <span>PAY WITH AFTERPAY / AFFIRM (${selectedPkg.priceUsd.toLocaleString()})</span>
                    </>
                  ) : paymentMethod === 'wallets' ? (
                    <>
                      <Wallet size={16} />
                      <span>PAY WITH DIGITAL WALLET (${selectedPkg.priceUsd.toLocaleString()})</span>
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>CHECKOUT WITH CARD / STRIPE (${selectedPkg.priceUsd.toLocaleString()})</span>
                    </>
                  )}
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
              {/* Balance Hero Card */}
              <div className="redeem-hero-card">
                <div className="sc-balance-large">
                  <Gem size={26} className="sc-icon-large" />
                  <div>
                    <div className="label">REDEEMABLE SWEEPS COINS BALANCE</div>
                    <div className="amount">{sweepsCoins.toFixed(2)} SC</div>
                  </div>
                  <div className="usd-equiv">= ${(sweepsCoins * 1.0).toFixed(2)} USD (Cash Prize)</div>
                </div>

                <div className="redeem-rules-pill">
                  <Clock size={13} />
                  <span>Minimum: {SWEEPSTAKES_CONFIG.minRedemptionSC}.00 SC &bull; 1 SC = $1.00 USD</span>
                </div>
              </div>

              {/* Emerging Operator Liquidity & Payout Schedule Disclosure Card */}
              <div className="redeem-liquidity-notice-card">
                <div className="liquidity-notice-header">
                  <AlertTriangle size={18} className="alert-yellow-icon" />
                  <strong>EMERGING OPERATOR PRIZE REDEMPTION &amp; LIQUIDITY POLICY</strong>
                </div>
                <p className="liquidity-notice-text">
                  As an emerging independent gaming studio, DC Enterprises fulfills promotional prize redemptions
                  on a <strong>staged liquidity schedule</strong> as player purchase proceeds, merchant settlement rails,
                  and banking clearance reserves settle into our operational prize account.
                </p>
                <div className="liquidity-perks-row">
                  <div className="perk-item">
                    <Clock size={13} />
                    <span>Processing: 3–14 Business Days</span>
                  </div>
                  <div className="perk-item">
                    <ShieldCheck size={13} />
                    <span>Approved Requests Never Revoked</span>
                  </div>
                  <div className="perk-item">
                    <Scale size={13} />
                    <span>Full Ledger Transparency</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="read-liquidity-policy-btn"
                  onClick={() => setPrivacyModalOpen(true)}
                >
                  Read Full Emerging Operator Payout Schedule &amp; Terms &rarr;
                </button>
              </div>

              {/* Interactive Redemption Request Console */}
              <div className="redeem-form-card">
                <h3 className="redeem-form-heading">Request Real Cash Prize Disbursement</h3>

                {sweepsCoins < SWEEPSTAKES_CONFIG.minRedemptionSC ? (
                  <div className="redeem-min-notice">
                    <AlertCircle size={16} />
                    <span>
                      You currently have {sweepsCoins.toFixed(2)} SC. A minimum of {SWEEPSTAKES_CONFIG.minRedemptionSC}.00 SC ($50.00 USD)
                      is required to submit a prize redemption request. Keep playing to reach the threshold!
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleRequestRedemption} className="redeem-actual-form">
                    <div className="redeem-input-row">
                      <div className="redeem-field-group">
                        <label>Redeem Amount (SC):</label>
                        <div className="redeem-num-wrap">
                          <span className="prefix">SC</span>
                          <input
                            type="number"
                            min={SWEEPSTAKES_CONFIG.minRedemptionSC}
                            max={sweepsCoins}
                            step="1"
                            value={redeemAmountInput}
                            onChange={(e) => setRedeemAmountInput(e.target.value)}
                            className="redeem-amount-input"
                          />
                          <button
                            type="button"
                            className="max-redeem-btn"
                            onClick={() => setRedeemAmountInput(String(Math.floor(sweepsCoins)))}
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      <div className="redeem-field-group">
                        <label>Payout Method:</label>
                        <div className="redeem-method-chips">
                          <button
                            type="button"
                            className={`rm-chip ${redeemMethod === 'ach' ? 'active' : ''}`}
                            onClick={() => setRedeemMethod('ach')}
                          >
                            <Building2 size={14} />
                            <span>Bank Wire / ACH</span>
                          </button>
                          <button
                            type="button"
                            className={`rm-chip ${redeemMethod === 'crypto' ? 'active' : ''}`}
                            onClick={() => setRedeemMethod('crypto')}
                          >
                            <Bitcoin size={14} />
                            <span>Crypto (USDT / BTC)</span>
                          </button>
                          <button
                            type="button"
                            className={`rm-chip ${redeemMethod === 'chime' ? 'active' : ''}`}
                            onClick={() => setRedeemMethod('chime')}
                          >
                            <DollarSign size={14} />
                            <span>Chime / Cash App</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="redeem-destination-field">
                      <label>
                        {redeemMethod === 'ach'
                          ? 'Bank Account & Routing Number or Online Banking details:'
                          : redeemMethod === 'crypto'
                          ? 'Your Personal Crypto Wallet Address (USDT-Solana, BTC, or ETH):'
                          : 'Your Chime @ChimeSign or Cash App $Cashtag:'}
                      </label>
                      <input
                        type="text"
                        value={redeemDestination}
                        onChange={(e) => setRedeemDestination(e.target.value)}
                        placeholder={
                          redeemMethod === 'ach'
                            ? 'e.g. Chase Bank, Routing: 122000496, Account: 987654321'
                            : redeemMethod === 'crypto'
                            ? 'e.g. So11111111111111111111111111111111111111112'
                            : 'e.g. $JohnDoeCasino or @ChimeSign'
                        }
                        className="redeem-dest-input"
                        required
                      />
                    </div>

                    {redeemError && (
                      <div className="redeem-error-banner" role="alert">
                        <AlertCircle size={15} />
                        <span>{redeemError}</span>
                      </div>
                    )}

                    {redeemSuccessMsg && (
                      <div className="redeem-success-banner" role="status">
                        <CheckCircle2 size={16} />
                        <span>{redeemSuccessMsg}</span>
                      </div>
                    )}

                    <button type="submit" className="submit-redemption-cta">
                      <Gem size={16} />
                      <span>Submit Redemption Request (${parseFloat(redeemAmountInput || 0).toFixed(2)} USD)</span>
                      <ArrowRight size={15} />
                    </button>
                  </form>
                )}
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
                        <td>{typeof tx.provider === 'string' ? tx.provider.toUpperCase().replace(/_/g, ' ') : 'STRIPE'}</td>
                        <td className="tx-desc-cell">{tx.description}</td>
                        <td className="tx-amount-cell">
                          {tx.type === 'purchase'
                            ? `+$${Number(tx.amountUsd).toFixed(2)}`
                            : `-$${Number(tx.amountUsd).toFixed(2)}`}
                        </td>
                        <td>
                          <span className={`tx-status-badge ${typeof tx.status === 'string' && tx.status.toLowerCase().includes('pending') ? 'pending' : (tx.status || 'completed')}`}>
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

        {/* Modal Legal Footer */}
        <div className="payment-modal-footer">
          <p className="pay-footer-disclaimer">
            Sweepstakes governed by US sweepstakes rules. No purchase necessary. Redemptions processed per{' '}
            <button
              type="button"
              className="footer-legal-link"
              onClick={() => setPrivacyModalOpen(true)}
            >
              Emerging Operator Liquidity Schedule &amp; Terms
            </button>
            .
          </p>
        </div>

        {/* Full Terms, Privacy & Liquidity Schedule Modal */}
        <PrivacyTermsModal
          isOpen={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
        />
      </div>
    </div>
  );
}
