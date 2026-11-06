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
  Sparkles,
  Flame,
  Trophy,
  Gift,
  Zap,
  Star,
} from 'lucide-react';
import {
  SWEEPSTAKES_CONFIG,
  CRYPTO_WALLET_ADDRESSES,
  calculateCustomPackage,
  getCashAppPayCheckoutLink,
  getStripePaymentLink,
  getPaymentReturnUrl,
} from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';
import { soundEngine } from '../audio/soundEngine';

const RECENT_VIP_WINNERS_FEED = [
  {
    user: 'Marcus T.',
    location: 'Austin, TX',
    action: 'redeemed $485.00 SC via Cash App Pay',
    time: '1m ago',
    icon: '💸',
  },
  {
    user: 'Elena R.',
    location: 'Miami, FL',
    action: 'claimed Pharaoh Crown Dynasty (+115.00 FREE SC)',
    time: 'Just now',
    icon: '👑',
  },
  {
    user: 'Devon K.',
    location: 'Las Vegas, NV',
    action: 'hit $1,240.00 SC Mega Win on Hold & Win Respins',
    time: '2m ago',
    icon: '🏆',
  },
  {
    user: 'Sophia L.',
    location: 'phoenix, AZ',
    action: 'unlocked Royal Necklace Treasury (+22.00 FREE SC)',
    time: 'Just now',
    icon: '💎',
  },
  {
    user: 'Brandon W.',
    location: 'Chicago, IL',
    action: 'redeemed $920.00 SC Instant Debit Payout',
    time: '3m ago',
    icon: '⚡',
  },
];

const CRYPTO_PAYMENT_OPTIONS = [
  {
    symbol: 'USDT',
    name: 'Tether (USDT - Solana)',
    network: 'Solana SPL (0% Fee)',
    address: CRYPTO_WALLET_ADDRESSES.USDT_SOL,
    uriScheme: 'solana',
    rateMultiplier: 1.0,
    unit: 'USDT',
    color: '#26a17b',
  },
  {
    symbol: 'USDT-ERC20',
    name: 'Tether (USDT - ERC20 / Polygon)',
    network: 'Ethereum / Polygon / Base',
    address: CRYPTO_WALLET_ADDRESSES.USDT_ERC20,
    uriScheme: 'ethereum',
    rateMultiplier: 1.0,
    unit: 'USDT',
    color: '#26a17b',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin (BTC)',
    network: 'Bitcoin Mainnet (Native SegWit)',
    address: CRYPTO_WALLET_ADDRESSES.BTC,
    uriScheme: 'bitcoin',
    rateMultiplier: 0.0000108,
    unit: 'BTC',
    color: '#f7931a',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum (ETH)',
    network: 'Ethereum / Arbitrum / Base',
    address: CRYPTO_WALLET_ADDRESSES.ETH,
    uriScheme: 'ethereum',
    rateMultiplier: 0.000325,
    unit: 'ETH',
    color: '#627eea',
  },
  {
    symbol: 'SOL',
    name: 'Solana (SOL)',
    network: 'Solana Mainnet',
    address: CRYPTO_WALLET_ADDRESSES.SOL,
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
  const [customAmountInput, setCustomAmountInput] = useState('25');
  const [vaultShowcaseMode, setVaultShowcaseMode] = useState('standard'); // 'standard' | 'highroller'
  const [liveJackpotPool, setLiveJackpotPool] = useState(1284592.45);
  const [promoSecondsLeft, setPromoSecondsLeft] = useState(14 * 60 + 47);
  const [winnerFeedIdx, setWinnerFeedIdx] = useState(0);
  const [showCryptoBox, setShowCryptoBox] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('USDT');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [cryptoTxHashInput, setCryptoTxHashInput] = useState('');
  const [cryptoSessionStartSec, setCryptoSessionStartSec] = useState(() =>
    Math.floor(Date.now() / 1000)
  );
  const [cryptoVerifyState, setCryptoVerifyState] = useState(null); // { status: 'scanning'|'verified'|'unconfirmed', message, explorerUrl, txHash }
  const [walletsLiveStatus, setWalletsLiveStatus] = useState(null);
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
      setCryptoTxHashInput('');
      setCryptoVerifyState(null);
      setCryptoSessionStartSec(Math.floor(Date.now() / 1000));
      setRedirectingMethod(null);
      setIsProcessingCrypto(false);
      setCheckoutError('');
      setPurchaseCompletedPkg(null);
      setRedeemSuccessMsg('');
      setRedeemError('');
    }
  }, [isOpen, initialTab, initialPackage]);

  // Fetch live on-chain RPC status for the 3 self-custody wallets & run auto-polling when Crypto drawer is open
  useEffect(() => {
    if (!isOpen || !showCryptoBox || !selectedPkg || purchaseCompletedPkg) return;

    let cancelled = false;
    paymentService
      .fetchLiveWalletsStatus()
      .then((res) => {
        if (!cancelled && res?.wallets) {
          setWalletsLiveStatus(res.wallets);
        }
      })
      .catch(() => {});

    // Auto-poll blockchain every 9 seconds for incoming transfer to the active wallet
    const pollInterval = setInterval(async () => {
      if (cancelled || isProcessingCrypto || purchaseCompletedPkg) return;
      try {
        const activeCrypto =
          CRYPTO_PAYMENT_OPTIONS.find((c) => c.symbol === selectedCrypto) ||
          CRYPTO_PAYMENT_OPTIONS[0];
        const expectedAmt = Number(
          (selectedPkg.priceUsd * activeCrypto.rateMultiplier).toFixed(
            activeCrypto.unit === 'USDT' ? 2 : 6
          )
        );
        const res = await paymentService.verifyOnChainCryptoDeposit({
          symbol: selectedCrypto,
          expectedAmount: expectedAmt,
          txHash: cryptoTxHashInput.trim(),
          minTimestampSec: cryptoSessionStartSec,
        });
        if (!cancelled && res && res.verified) {
          setCryptoVerifyState({
            status: 'verified',
            message: `${res.statusText || 'On-Chain Transfer Verified'} (${res.amountReceived} ${activeCrypto.unit})`,
            explorerUrl: res.explorerUrl,
            txHash: res.txHash,
          });
          soundEngine.playWinCelebration('big');
          await ensureLoggedInForPurchase();
          paymentService.recordPurchase({
            packageId: selectedPkg.id,
            amountUsd: selectedPkg.priceUsd,
            goldCoins: selectedPkg.goldCoins,
            freeSweepsCoins: selectedPkg.freeSweepsCoins,
            sweepsCoins: selectedPkg.freeSweepsCoins,
            method: `crypto_${selectedCrypto.toLowerCase()}_verified`,
            sessionId: res.txHash,
            status: 'completed',
          });
          setPurchaseCompletedPkg(selectedPkg);
          setTimeout(() => {
            if (onPurchaseSuccess) onPurchaseSuccess(selectedPkg);
            onClose();
          }, 1400);
        }
      } catch {}
    }, 9000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [
    isOpen,
    showCryptoBox,
    selectedCrypto,
    selectedPkg,
    cryptoTxHashInput,
    cryptoSessionStartSec,
    isProcessingCrypto,
    purchaseCompletedPkg,
  ]);

  // Live Progressive Jackpot Ticker, Flash Boost Countdown & Social Proof Feed
  useEffect(() => {
    if (!isOpen) return;
    const jackpotTimer = setInterval(() => {
      setLiveJackpotPool((prev) => Number((prev + (Math.random() * 1.85 + 0.35)).toFixed(2)));
    }, 1100);
    const countdownTimer = setInterval(() => {
      setPromoSecondsLeft((prev) => (prev > 60 ? prev - 1 : 14 * 60 + 59));
    }, 1000);
    const feedTimer = setInterval(() => {
      setWinnerFeedIdx((prev) => (prev + 1) % RECENT_VIP_WINNERS_FEED.length);
    }, 3800);
    return () => {
      clearInterval(jackpotTimer);
      clearInterval(countdownTimer);
      clearInterval(feedTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const ensureLoggedInForPurchase = async () => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    return await authService.loginAsVipGuest();
  };

  // Step 1 -> Step 2: Select a package and go to Payment Method selection
  const handleSelectPackage = (pkg) => {
    setSelectedPkg(pkg);
    if (pkg?.isCustom && pkg?.priceUsd) {
      setCustomAmountInput(String(pkg.priceUsd));
    }
    setStep(2);
    setShowCryptoBox(false);
    setCheckoutError('');
    soundEngine.playButtonClick(560);
  };

  const parsedCustomUsd = Math.max(1, Math.min(1000000, parseFloat(customAmountInput) || 1));
  const customPkgPreview = calculateCustomPackage(parsedCustomUsd);

  const handleSelectCustomAmount = (e) => {
    if (e) e.preventDefault();
    const rawVal = parseFloat(customAmountInput);
    if (isNaN(rawVal) || rawVal < 1) {
      setCheckoutError('Minimum custom purchase amount is $1.00 USD.');
      return;
    }
    const pkg = calculateCustomPackage(rawVal);
    handleSelectPackage(pkg);
  };

  const handleStep2CustomAmountChange = (valStr) => {
    setCustomAmountInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num) && num >= 1) {
      setSelectedPkg(calculateCustomPackage(num));
    }
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
    setCheckoutError('');
    setCryptoVerifyState({
      status: 'scanning',
      message: `Scanning ${currentCryptoObj.network} RPC for incoming ${calculatedCryptoAmount} ${currentCryptoObj.unit}...`,
    });
    soundEngine.playButtonClick(620);

    try {
      const verification = await paymentService.verifyOnChainCryptoDeposit({
        symbol: selectedCrypto,
        expectedAmount: Number(calculatedCryptoAmount) || 0,
        txHash: cryptoTxHashInput.trim(),
        minTimestampSec: cryptoSessionStartSec,
      });

      if (verification && verification.verified) {
        setCryptoVerifyState({
          status: 'verified',
          message: `✅ ${verification.statusText || 'On-Chain Transfer Verified'}! (${verification.amountReceived} ${currentCryptoObj.unit})`,
          explorerUrl: verification.explorerUrl,
          txHash: verification.txHash,
        });
        soundEngine.playWinCelebration('big');
        await ensureLoggedInForPurchase();
        paymentService.recordPurchase({
          packageId: selectedPkg.id,
          amountUsd: selectedPkg.priceUsd,
          goldCoins: selectedPkg.goldCoins,
          freeSweepsCoins: selectedPkg.freeSweepsCoins,
          sweepsCoins: selectedPkg.freeSweepsCoins,
          method: `crypto_${selectedCrypto.toLowerCase()}_verified`,
          sessionId: verification.txHash,
          status: 'completed',
        });

        setPurchaseCompletedPkg(selectedPkg);
        setTimeout(() => {
          setIsProcessingCrypto(false);
          if (onPurchaseSuccess) {
            onPurchaseSuccess(selectedPkg);
          }
          onClose();
        }, 1200);
        return;
      }

      setCryptoVerifyState({
        status: 'unconfirmed',
        message:
          verification?.message ||
          `No confirmed on-chain transfer of ${calculatedCryptoAmount} ${currentCryptoObj.unit} found yet at ${currentCryptoObj.address.slice(0, 10)}...`,
      });
    } catch (err) {
      setCryptoVerifyState({
        status: 'unconfirmed',
        message: `Unable to verify on-chain transfer yet: ${err.message || 'Please check your TXID or wait 15 seconds for block propagation.'}`,
      });
    } finally {
      setIsProcessingCrypto(false);
    }
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
              TAB 1: GET COINS (ROYAL TREASURY HIGH-CONVERTING SALES SHOWCASE)
             ================================================================ */}
          {!purchaseCompletedPkg && activeTab === 'store' && (
            <>
              {/* STEP 1: CHOOSE A PACKAGE */}
              {step === 1 && (
                <div className="sc-packages-step">
                  {/* Vegas Marquee & Pharaoh's Golden Hour VIP Hero Banner */}
                  <div className="sc-promo-hero-banner">
                    <div className="sc-promo-hero-bg-art" />
                    <div className="sc-promo-hero-shimmer" />

                    <div className="sc-promo-hero-top-row">
                      <span className="sc-promo-flash-pill">
                        <Flame size={13} className="sc-flame-pulse" />
                        <span>
                          PHARAOH&apos;S GOLDEN HOUR • EXTRA FREE SC ENDS IN{' '}
                          <strong>
                            {String(Math.floor(promoSecondsLeft / 60)).padStart(2, '0')}:
                            {String(promoSecondsLeft % 60).padStart(2, '0')}
                          </strong>
                        </span>
                      </span>

                      <span className="sc-promo-rating-seal">
                        <Star size={12} fill="#fde047" color="#fde047" />
                        <Star size={12} fill="#fde047" color="#fde047" />
                        <Star size={12} fill="#fde047" color="#fde047" />
                        <Star size={12} fill="#fde047" color="#fde047" />
                        <Star size={12} fill="#fde047" color="#fde047" />
                        <span>4.9★ VERIFIED INSTANT PAYOUTS</span>
                      </span>
                    </div>

                    <div className="sc-promo-hero-main">
                      <div className="sc-promo-hero-copy">
                        <h3 className="sc-promo-hero-headline">
                          UNLOCK THE ROYAL TREASURY &amp; CLAIM{' '}
                          <span className="sc-emerald-highlight">100% FREE SWEEPS COINS!</span>
                        </h3>
                        <p className="sc-promo-hero-sub">
                          Every Gold Coin bundle includes <strong>FREE promotional Sweeps Coins</strong>{' '}
                          redeemable 1-to-1 for real USD cash prizes (<strong>1.00 SC = $1.00 USD</strong>).
                        </p>
                      </div>

                      <div className="sc-promo-jackpot-ticker-box">
                        <span className="sc-jackpot-ticker-label">
                          <Trophy size={12} /> LIVE VIP PRIZE POOL
                        </span>
                        <strong className="sc-jackpot-ticker-digits">
                          $
                          {liveJackpotPool.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                        <span className="sc-jackpot-ticker-sub">⚡ INSTANT CASH REDEMPTIONS ACTIVE</span>
                      </div>
                    </div>

                    {/* Live Social Proof Winner & Cashout Ticker */}
                    <div className="sc-live-winners-strip" key={winnerFeedIdx}>
                      <span className="sc-live-dot" />
                      <span className="sc-winner-emoji">
                        {RECENT_VIP_WINNERS_FEED[winnerFeedIdx].icon}
                      </span>
                      <span className="sc-winner-text">
                        <strong>{RECENT_VIP_WINNERS_FEED[winnerFeedIdx].user}</strong> (
                        {RECENT_VIP_WINNERS_FEED[winnerFeedIdx].location}){' '}
                        {RECENT_VIP_WINNERS_FEED[winnerFeedIdx].action}
                      </span>
                      <span className="sc-winner-time">
                        {RECENT_VIP_WINNERS_FEED[winnerFeedIdx].time}
                      </span>
                    </div>
                  </div>

                  {/* Store Tier Switcher: Standard Treasure Chests vs. High-Roller Dynasty Vaults */}
                  <div className="sc-showcase-toggle-bar">
                    <button
                      type="button"
                      className={`sc-showcase-toggle-btn ${
                        vaultShowcaseMode === 'standard' ? 'active' : ''
                      }`}
                      onClick={() => {
                        setVaultShowcaseMode('standard');
                        soundEngine.playButtonClick(500);
                      }}
                    >
                      <Sparkles size={15} />
                      <span>ROYAL TREASURE CHESTS ($4.99 – $249.99)</span>
                    </button>

                    <button
                      type="button"
                      className={`sc-showcase-toggle-btn highroller-btn ${
                        vaultShowcaseMode === 'highroller' ? 'active-hr' : ''
                      }`}
                      onClick={() => {
                        setVaultShowcaseMode('highroller');
                        soundEngine.playButtonClick(580);
                      }}
                    >
                      <Crown size={15} />
                      <span>VIP DYNASTY VAULTS ($5,000 – $50,000 • UP TO +25% FREE SC)</span>
                    </button>
                  </div>

                  {/* 3D Relic Package Grid */}
                  <div
                    className={`sc-packages-grid ${
                      vaultShowcaseMode === 'highroller' ? 'hr-packages-grid' : ''
                    }`}
                  >
                    {(vaultShowcaseMode === 'highroller'
                      ? SWEEPSTAKES_CONFIG.highRollerPackages
                      : [
                          ...SWEEPSTAKES_CONFIG.storePackages,
                          ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage
                            ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage]
                            : []),
                        ]
                    ).map((pkg) => {
                      const extraFreeScBonus = Math.max(0, pkg.freeSweepsCoins - pkg.priceUsd);
                      return (
                        <div
                          key={pkg.id}
                          className={`sc-pkg-card ${pkg.popular ? 'popular' : ''} ${
                            pkg.featuredSpotlight ? 'featured-spotlight' : ''
                          } ${pkg.auraClass || ''}`}
                          onClick={() => handleSelectPackage(pkg)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="sc-pkg-ambient-glow" />

                          {pkg.badge && (
                            <div className={`sc-pkg-ribbon ${pkg.popular ? 'popular-ribbon' : ''}`}>
                              <Crown size={11} />
                              <span>{pkg.badge}</span>
                            </div>
                          )}

                          {/* 3D Floating Treasure Relic Emblem */}
                          <div className="sc-pkg-relic-showcase">
                            <div className="sc-pkg-relic-halo" />
                            <img
                              src={pkg.relicArt || '/assets/symbols/high/high_scarab_no_frame.png'}
                              alt={pkg.tierTitle || 'Treasure Chest'}
                              className="sc-pkg-relic-img"
                              draggable={false}
                            />
                            {extraFreeScBonus > 0 && (
                              <span className="sc-pkg-extra-burst-tag">
                                +${extraFreeScBonus.toFixed(2)} EXTRA FREE!
                              </span>
                            )}
                          </div>

                          <div className="sc-pkg-tier-name">
                            {pkg.tierTitle || pkg.tierName || 'Royal Coin Bundle'}
                          </div>

                          <div className="sc-pkg-gc-section">
                            <div className="sc-pkg-gc-amount">
                              <Coins size={18} className="sc-gold-icon" />
                              <span>{pkg.goldCoins.toLocaleString()}</span>
                            </div>
                            <span className="sc-pkg-gc-label">GOLD COINS INCLUDED</span>
                          </div>

                          {/* High-Impact FREE Sweeps Coins Gift Box */}
                          <div className="sc-pkg-sc-bonus">
                            <div className="sc-pkg-sc-top">
                              <Gift size={14} className="sc-emerald-icon" />
                              <span>
                                +FREE $
                                {pkg.freeSweepsCoins.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                SC
                              </span>
                            </div>
                            <span className="sc-pkg-sc-sub">
                              (${pkg.freeSweepsCoins.toLocaleString()} USD Real Prize Value)
                            </span>
                          </div>

                          {pkg.vipPerk && (
                            <div className="sc-pkg-vip-perk-pill">
                              <span>{pkg.vipPerk}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            className="sc-pkg-buy-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPackage(pkg);
                            }}
                          >
                            <div className="sc-pkg-btn-price-group">
                              {pkg.originalPriceUsd && (
                                <span className="sc-pkg-old-price">
                                  ${pkg.originalPriceUsd.toLocaleString()}
                                </span>
                              )}
                              <span className="sc-pkg-now-price">
                                CLAIM ${pkg.priceUsd.toLocaleString('en-US', { minimumFractionDigits: pkg.priceUsd % 1 === 0 ? 0 : 2 })}
                              </span>
                            </div>
                            <ArrowRight size={15} className="sc-pkg-btn-arrow" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom Amount Builder Card with Interactive Bonus Tier Unlock Bar */}
                  <div className="sc-custom-amount-card">
                    <div className="sc-custom-amount-header">
                      <div>
                        <span className="sc-custom-eyebrow">
                          ⚡ BESPOKE PHARAOH VIP BUILDER ($1 – $1,000,000)
                        </span>
                        <h4 className="sc-custom-title">
                          Name Your Own Price &amp; Unlock Instant Extra Free SC
                        </h4>
                      </div>
                      {customPkgPreview.badge && (
                        <span className="sc-custom-bonus-pill">
                          <Sparkles size={12} /> {customPkgPreview.badge}
                        </span>
                      )}
                    </div>

                    {/* Interactive Bonus Multiplier Tier Milestones */}
                    <div className="sc-custom-tier-track">
                      {[
                        { min: 10, label: '$10+ • +5% FREE SC' },
                        { min: 20, label: '$20+ • +10% FREE SC' },
                        { min: 100, label: '$100+ • +15% FREE SC' },
                        { min: 10000, label: '$10K+ • UP TO +25% SC' },
                      ].map((tier) => {
                        const unlocked = parsedCustomUsd >= tier.min;
                        return (
                          <div
                            key={tier.min}
                            className={`sc-custom-tier-step ${unlocked ? 'unlocked' : ''}`}
                            onClick={() => {
                              setCustomAmountInput(String(tier.min));
                              soundEngine.playButtonClick(540);
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <CheckCircle2 size={12} />
                            <span>{tier.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="sc-custom-quick-chips">
                      {[15, 25, 50, 100, 250, 500, 1000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`sc-custom-chip ${
                            Number(customAmountInput) === preset ? 'active' : ''
                          }`}
                          onClick={() => {
                            setCustomAmountInput(String(preset));
                            soundEngine.playButtonClick(520);
                          }}
                        >
                          ${preset.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    <div className="sc-custom-controls-row">
                      <div className="sc-custom-input-wrap">
                        <span className="sc-custom-dollar-prefix">$</span>
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          step="any"
                          value={customAmountInput}
                          onChange={(e) => setCustomAmountInput(e.target.value)}
                          className="sc-custom-input"
                          placeholder="25.00"
                          aria-label="Custom USD Amount"
                        />
                        <span className="sc-custom-usd-suffix">USD</span>
                      </div>

                      <div className="sc-custom-live-preview">
                        <span className="sc-custom-preview-gc">
                          <Coins size={15} className="sc-gold-icon" />
                          <strong>{customPkgPreview.goldCoins.toLocaleString()} GC</strong>
                        </span>
                        <span className="sc-custom-preview-plus">+</span>
                        <span className="sc-custom-preview-sc">
                          <Gem size={15} className="sc-emerald-icon" />
                          <strong>FREE ${customPkgPreview.freeSweepsCoins.toFixed(2)} SC</strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        className="sc-custom-continue-btn"
                        onClick={handleSelectCustomAmount}
                      >
                        <span>Claim ${customPkgPreview.priceUsd.toFixed(2)} Bundle</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Luxury Guarantees & Trust Strip */}
                  <div className="sc-cashier-trust-footer">
                    <span>
                      <ShieldCheck size={14} color="#34d399" /> 256-Bit Bank-Grade SSL
                    </span>
                    <span>•</span>
                    <span>
                      <Zap size={14} color="#fde047" /> Instant Auto-Credited Coins
                    </span>
                    <span>•</span>
                    <span>
                      <CheckCircle2 size={14} color="#38bdf8" /> 1 SC = $1.00 USD Cash Redemption
                    </span>
                    <span>•</span>
                    <span>Powered by Stripe &amp; Cash App Pay</span>
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE PAYMENT METHOD (Pay with Card, Cash App Pay, or Crypto) */}
              {step === 2 && selectedPkg && (
                <div className="sc-payment-step">
                  <div className="sc-step2-top-bar">
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
                      <span>Back to Royal Store</span>
                    </button>

                    <span className="sc-step2-reserved-pill">
                      <Gift size={13} />
                      <span>VIP BONUS LOCKED IN FOR {String(Math.floor(promoSecondsLeft / 60)).padStart(2, '0')}:{String(promoSecondsLeft % 60).padStart(2, '0')}</span>
                    </span>
                  </div>

                  {/* Selected Package Summary Box (with 3D Relic Emblem & inline Custom Amount editor) */}
                  <div className="sc-selected-summary-card">
                    <div className="sc-summary-relic-badge">
                      <img
                        src={
                          selectedPkg.relicArt || '/assets/symbols/high/high_necklace_no_frame.png'
                        }
                        alt=""
                        className="sc-summary-relic-img"
                        draggable={false}
                      />
                    </div>

                    <div className="sc-summary-left">
                      <span className="sc-summary-eyebrow">
                        {selectedPkg.isCustom
                          ? '⚡ CUSTOM VIP TREASURY PACKAGE'
                          : `👑 ${selectedPkg.tierTitle || 'SELECTED VIP TREASURY PACKAGE'}`}
                      </span>
                      <div className="sc-summary-coins">
                        <strong>{selectedPkg.goldCoins.toLocaleString()} Gold Coins</strong>
                        <span className="sc-summary-plus">+</span>
                        <strong className="sc-summary-sc">
                          FREE ${selectedPkg.freeSweepsCoins.toFixed(2)} SC ($
                          {selectedPkg.freeSweepsCoins.toFixed(2)} USD Prize Value)
                        </strong>
                      </div>
                      <span className="sc-summary-perk-note">
                        ✨ Includes Instant Balance Credit + Full Access to All 4 Bonus Chambers
                      </span>
                    </div>
                    <div className="sc-summary-price">
                      <span className="sc-summary-price-label">Total Due (USD)</span>
                      <div className="sc-step2-custom-price-box">
                        <span className="sc-step2-dollar">$</span>
                        <input
                          type="number"
                          min="1"
                          max="1000000"
                          step="any"
                          value={selectedPkg.isCustom ? customAmountInput : selectedPkg.priceUsd}
                          onChange={(e) => handleStep2CustomAmountChange(e.target.value)}
                          className="sc-step2-price-input"
                          title="Enter any custom USD amount"
                          aria-label="Total USD Amount"
                        />
                      </div>
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

                        {/* Live On-Chain RPC Node Monitor & Optional TXID Input */}
                        <div className="sc-crypto-verifier-box">
                          <div className="sc-crypto-verifier-header">
                            <span className="sc-verifier-live-badge">
                              <span className="sc-live-dot" />
                              LIVE ON-CHAIN RPC VERIFIER ACTIVE (AUTO-SCANNING EVERY 9S)
                            </span>
                            {walletsLiveStatus && (
                              <span className="sc-verifier-nodes-pill">
                                {walletsLiveStatus.BTC?.online ? '🟢 BTC' : '⚪ BTC'} •{' '}
                                {walletsLiveStatus.ETH?.online ? '🟢 ETH/EVM' : '⚪ ETH'} •{' '}
                                {walletsLiveStatus.SOL?.online ? '🟢 SOL' : '⚪ SOL'}
                              </span>
                            )}
                          </div>

                          <div className="sc-crypto-txhash-row">
                            <input
                              type="text"
                              value={cryptoTxHashInput}
                              onChange={(e) => setCryptoTxHashInput(e.target.value)}
                              className="sc-crypto-txhash-input"
                              placeholder={
                                selectedCrypto === 'BTC'
                                  ? 'Optional: Paste Bitcoin TXID for instant verification...'
                                  : selectedCrypto === 'ETH' || selectedCrypto === 'USDT-ERC20'
                                  ? 'Paste 0x... Transaction Hash from MetaMask / Wallet for instant check'
                                  : 'Optional: Paste Solana Transaction Signature for instant check...'
                              }
                              aria-label="Blockchain Transaction Hash or Signature"
                            />
                          </div>

                          {cryptoVerifyState && (
                            <div
                              className={`sc-crypto-verify-status status-${cryptoVerifyState.status}`}
                            >
                              {cryptoVerifyState.status === 'scanning' && (
                                <Loader2 size={15} className="sc-spin" />
                              )}
                              {cryptoVerifyState.status === 'verified' && (
                                <CheckCircle2 size={15} color="#34d399" />
                              )}
                              {cryptoVerifyState.status === 'unconfirmed' && (
                                <AlertCircle size={15} color="#fbbf24" />
                              )}
                              <span>{cryptoVerifyState.message}</span>
                              {cryptoVerifyState.explorerUrl && (
                                <a
                                  href={cryptoVerifyState.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="sc-explorer-link"
                                >
                                  View on Block Explorer ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="sc-confirm-crypto-btn"
                          onClick={handleConfirmCryptoPayment}
                          disabled={isProcessingCrypto}
                        >
                          {isProcessingCrypto ? (
                            <>
                              <Loader2 size={16} className="sc-spin" />
                              <span>Querying {currentCryptoObj.network} Blockchain...</span>
                            </>
                          ) : (
                            <span>Verify On-Chain Transfer &amp; Credit My Coins</span>
                          )}
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
