import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
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
  Zap,
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
  const [showCustomDrawer, setShowCustomDrawer] = useState(false);
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

  // Redemption state (4-Pillar Payout Architecture)
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('giftcard');
  const [redeemCryptoAsset, setRedeemCryptoAsset] = useState('USDT_SOL');
  const [redeemGiftCardBrand, setRedeemGiftCardBrand] = useState('visa_virtual');
  const [redeemDestination, setRedeemDestination] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [lastSubmittedRedemption, setLastSubmittedRedemption] = useState(null);

  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'purchases' | 'redemptions' | 'spins'

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
      setLastSubmittedRedemption(null);
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

    // Enforce Responsible Gaming deposit limit & cool-off before purchase redirect
    const rgCheck = paymentService.checkDepositLimit(selectedPkg.priceUsd);
    if (!rgCheck.allowed) {
      setCheckoutError(rgCheck.reason);
      return;
    }

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

    // Enforce Responsible Gaming deposit limit & cool-off before crypto verification
    const rgCheck = paymentService.checkDepositLimit(selectedPkg.priceUsd);
    if (!rgCheck.allowed) {
      setCheckoutError(rgCheck.reason);
      return;
    }

    setIsProcessingCrypto(true);
    setCheckoutError('');
    // Verify via /api/crypto/verify (or legacy /api/verify-crypto-tx endpoint) with RPC fallback
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

  const playthroughState = paymentService.getPlaythroughState(sweepsCoins);
  const isGiftCardMethod = redeemMethod === 'giftcard';
  const activeMinRedeemSC = isGiftCardMethod
    ? SWEEPSTAKES_CONFIG.minGiftCardRedemptionSC || 25
    : SWEEPSTAKES_CONFIG.minRedemptionSC || 50;
  const parsedRedeemSC = Math.max(0, parseFloat(redeemAmountInput) || 0);
  const calculatedPayoutUsd = isGiftCardMethod
    ? Number((parsedRedeemSC * 1.05).toFixed(2))
    : Number(parsedRedeemSC.toFixed(2));
  const calculatedBonusUsd = Number((calculatedPayoutUsd - parsedRedeemSC).toFixed(2));

  const handleRedeemMethodChange = (methodId) => {
    setRedeemMethod(methodId);
    setRedeemError('');
    const currentNum = parseFloat(redeemAmountInput) || 0;
    if (methodId === 'giftcard' && (currentNum === 50 || currentNum < 25)) {
      setRedeemAmountInput('25');
    } else if (methodId !== 'giftcard' && currentNum < 50) {
      setRedeemAmountInput('50');
    }
  };

  const handleRedeemSubmit = (e) => {
    e.preventDefault();
    setRedeemError('');
    setRedeemSuccessMsg('');
    setLastSubmittedRedemption(null);

    const amount = parseFloat(redeemAmountInput);
    if (isNaN(amount) || amount < activeMinRedeemSC) {
      setRedeemError(
        isGiftCardMethod
          ? `Minimum Instant Gift Card redemption is $${activeMinRedeemSC.toFixed(2)} SC ($${(
              activeMinRedeemSC * 1.05
            ).toFixed(2)} Gift Card value).`
          : `Minimum Cash / Crypto redemption is $${activeMinRedeemSC.toFixed(2)} SC. (Tip: Choose Instant Gift Card for a $25.00 SC minimum + 5% bonus!)`
      );
      return;
    }
    if (amount > sweepsCoins) {
      setRedeemError(`Insufficient Sweeps Coins. You have ${sweepsCoins.toFixed(2)} SC.`);
      return;
    }
    if (amount > playthroughState.redeemableSC + 0.009) {
      setRedeemError(
        `1× Playthrough Required: You have ${playthroughState.redeemableSC.toFixed(
          2
        )} Redeemable SC and ${playthroughState.unplayedSC.toFixed(
          2
        )} Unplayed Bonus SC. Spin your unplayed SC 1× on the reels to unlock it for payout!`
      );
      return;
    }
    if (!redeemDestination.trim()) {
      setRedeemError(
        redeemMethod === 'giftcard'
          ? 'Please enter the email address where we should send your +5% Digital Gift Card.'
          : redeemMethod === 'crypto'
          ? `Please paste your receiving ${redeemCryptoAsset} wallet address.`
          : redeemMethod === 'chime'
          ? 'Please enter your $Cashtag or $ChimeSign handle.'
          : 'Please enter your payout account details.'
      );
      return;
    }

    const currentUser = authService.getCurrentUser();
    const res = paymentService.requestRedemption({
      sweepsCoins: amount,
      method: redeemMethod,
      cryptoAsset: redeemCryptoAsset,
      giftCardBrand: redeemGiftCardBrand,
      destination: redeemDestination.trim(),
      playerName: currentUser?.name || 'VIP Player',
      enforcePlaythrough: true,
      currentScBalance: sweepsCoins,
    });

    if (res.success) {
      if (onRedeemSuccess) onRedeemSuccess(amount);
      setLastSubmittedRedemption(res);
      const payoutStr = `$${res.amountUsd.toFixed(2)} USD${
        res.bonusUsd > 0 ? ` (includes +$${res.bonusUsd.toFixed(2)} 5% Gift Card Bonus!)` : ''
      }`;
      setRedeemSuccessMsg(
        `Redemption of ${amount.toFixed(2)} SC → ${payoutStr} queued! Ref: ${res.redemptionId}.`
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
      <div className="sc-cashier-modal cashier-v2" onClick={(e) => e.stopPropagation()}>
        {/* Clean Header Bar */}
        <header className="sc-cashier-header sc-clean-header">
          <div className="sc-cashier-title-wrap">
            <div className="sc-cashier-logo-badge">
              <Coins size={20} />
            </div>
            <div>
              <h2 className="sc-cashier-title">
                {activeTab === 'store'
                  ? step === 2
                    ? 'EXPRESS CHECKOUT'
                    : 'GET COINS'
                  : activeTab === 'redeem'
                  ? 'CASH OUT PRIZES'
                  : 'HISTORY & RECEIPTS'}
              </h2>
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
                ${sweepsCoins.toFixed(2)} SC
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

        {/* Streamlined Top Navigation Tabs */}
        <nav className="sc-cashier-tabs sc-clean-tabs">
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
            <span>Buy Coins</span>
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
            <span>Cash Out</span>
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
            <span>History</span>
          </button>
        </nav>

        {/* Main Body */}
        <div className="sc-cashier-body">
          {/* Purchase Success Screen */}
          {purchaseCompletedPkg && (
            <div className="sc-cashier-success-box">
              <CheckCircle2 size={54} className="sc-success-icon" />
              <h3>Coins Added!</h3>
              <p>
                <strong>+{purchaseCompletedPkg.goldCoins.toLocaleString()} Gold Coins</strong> &amp;{' '}
                <strong className="sc-green-text">
                  +${purchaseCompletedPkg.freeSweepsCoins.toFixed(2)} FREE Sweeps Coins
                </strong>
              </p>
              <span className="sc-returning-note">Returning to game...</span>
            </div>
          )}

          {/* ================================================================
              TAB 1: GET COINS — ULTRA-CLEAN ROYAL MATCH / CHUMBA / PULSZ STORE
             ================================================================ */}
          {!purchaseCompletedPkg && activeTab === 'store' && (
            <>
              {/* STEP 1: TAP ANY BUNDLE TO BUY */}
              {step === 1 && (
                <div className="sc-packages-step sc-clean-store-step">
                  {/* Simple one-line value note */}
                  <p className="cx-store-note">
                    Every pack includes <strong>FREE Sweeps Coins</strong> — 1 SC = $1.00 cash prize
                  </p>

                  {/* Clean 3x2 Visual Coin Grid (Royal Match / Monopoly GO / Chumba Style) */}
                  <div
                    className={`cx-grid ${
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
                      const bonusPct =
                        pkg.priceUsd > 0
                          ? Math.round(((pkg.freeSweepsCoins - pkg.priceUsd) / pkg.priceUsd) * 100)
                          : 0;
                      const shortBadge = pkg.popular
                        ? '🔥 MOST POPULAR'
                        : pkg.featuredSpotlight
                        ? '👑 BEST VALUE'
                        : pkg.priceUsd <= 5
                        ? '⚡ 50% OFF STARTER'
                        : bonusPct > 0
                        ? `+${bonusPct}% EXTRA FREE`
                        : pkg.badge;

                      return (
                        <div
                          key={pkg.id}
                          className={`cx-card ${pkg.popular ? 'popular' : ''} ${
                            pkg.featuredSpotlight ? 'featured-spotlight' : ''
                          }`}
                          onClick={() => handleSelectPackage(pkg)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectPackage(pkg);
                            }
                          }}
                        >
                          {/* 1. Compact Top Badge */}
                          {shortBadge && (
                            <span
                              className={`cx-badge ${
                                pkg.popular
                                  ? 'cx-badge-popular'
                                  : pkg.featuredSpotlight
                                  ? 'cx-badge-best'
                                  : ''
                              }`}
                            >
                              {shortBadge}
                            </span>
                          )}

                          {/* 2. Relic Icon */}
                          <img
                            src={pkg.relicArt || '/assets/symbols/high/high_scarab_no_frame.png'}
                            alt={pkg.tierTitle || 'Coin Pack'}
                            className="cx-relic"
                            draggable={false}
                          />

                          {/* 3. The 2 Numbers Players Care About: Gold Coins + FREE SC */}
                          <div className="cx-gc-line">
                            <Coins size={15} />
                            <span>{pkg.goldCoins.toLocaleString()} GC</span>
                          </div>

                          <div className="cx-sc-line">
                            + $
                              {pkg.freeSweepsCoins.toLocaleString('en-US', {
                                minimumFractionDigits: pkg.freeSweepsCoins % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              SC FREE
                          </div>

                          {/* 4. Flat Price CTA */}
                          <span className="cx-price-btn">
                            {pkg.originalPriceUsd && (
                              <span className="cx-old-price">
                                ${pkg.originalPriceUsd.toLocaleString()}
                              </span>
                            )}
                            $
                            {pkg.priceUsd.toLocaleString('en-US', {
                              minimumFractionDigits: pkg.priceUsd % 1 === 0 ? 0 : 2,
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subtle Collapsible Footer Toggle for Custom Amount & High-Roller Packs */}
                  <div className="sc-clean-more-options-row">
                    <button
                      type="button"
                      className={`sc-clean-option-pill ${showCustomDrawer ? 'active' : ''}`}
                      onClick={() => {
                        setShowCustomDrawer(!showCustomDrawer);
                        soundEngine.playButtonClick(500);
                      }}
                    >
                      <Sparkles size={13} />
                      <span>
                        {showCustomDrawer ? 'Hide Custom Amount' : 'Custom Amount ($1+)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`sc-clean-option-pill ${
                        vaultShowcaseMode === 'highroller' ? 'active' : ''
                      }`}
                      onClick={() => {
                        setVaultShowcaseMode(
                          vaultShowcaseMode === 'highroller' ? 'standard' : 'highroller'
                        );
                        soundEngine.playButtonClick(540);
                      }}
                    >
                      <Crown size={13} />
                      <span>
                        {vaultShowcaseMode === 'highroller'
                          ? '← Back to Standard Packs ($4.99–$249.99)'
                          : 'VIP High-Roller Packs ($5K–$50K)'}
                      </span>
                    </button>
                  </div>

                  {/* Compact Expandable Custom Amount Bar (Hidden by Default to Keep Store Clean) */}
                  {showCustomDrawer && (
                    <div className="sc-clean-custom-drawer">
                      <div className="sc-custom-quick-chips">
                        {[10, 25, 50, 100, 250, 500].map((preset) => (
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
                            ${preset}
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
                            placeholder="25"
                            aria-label="Custom USD Amount"
                          />
                        </div>

                        <div className="sc-custom-live-preview">
                          <span className="sc-custom-preview-gc">
                            <strong>{customPkgPreview.goldCoins.toLocaleString()} GC</strong>
                          </span>
                          <span className="sc-custom-preview-plus">+</span>
                          <span className="sc-custom-preview-sc">
                            <strong>FREE ${customPkgPreview.freeSweepsCoins.toFixed(2)} SC</strong>
                          </span>
                        </div>

                        <button
                          type="button"
                          className="sc-custom-continue-btn"
                          onClick={handleSelectCustomAmount}
                        >
                          <span>Buy ${customPkgPreview.priceUsd.toFixed(2)}</span>
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Minimalist 1-Line Trust Footer */}
                  <div className="sc-cashier-trust-footer cx-trust">
                    <ShieldCheck size={14} />
                    <span>Secure checkout</span>
                    <span>•</span>
                    <Zap size={14} />
                    <span>Coins credited instantly</span>
                  </div>
                </div>
              )}

              {/* STEP 2: ULTRA-SIMPLE 1-TAP EXPRESS CHECKOUT */}
              {step === 2 && selectedPkg && (
                <div className="sc-payment-step sc-clean-checkout-step">
                  {/* Simple Selected Pack Summary */}
                  <div className="cx-summary">
                    <img
                      src={
                        selectedPkg.relicArt || '/assets/symbols/high/high_necklace_no_frame.png'
                      }
                      alt=""
                      className="cx-summary-icon"
                      draggable={false}
                    />
                    <div className="cx-summary-text">
                      <span className="cx-summary-coins">
                        {selectedPkg.goldCoins.toLocaleString()} GC + $
                        {selectedPkg.freeSweepsCoins.toFixed(2)} SC FREE
                      </span>
                      <button
                        type="button"
                        className="cx-change-link"
                        onClick={() => {
                          setStep(1);
                          setShowCryptoBox(false);
                          setCheckoutError('');
                          soundEngine.playButtonClick(420);
                        }}
                      >
                        ← Change package
                      </button>
                    </div>
                    <div className="cx-summary-total">
                      <span>Total</span>
                      <strong>
                        $
                        {Number(selectedPkg.priceUsd).toLocaleString('en-US', {
                          minimumFractionDigits: selectedPkg.priceUsd % 1 === 0 ? 0 : 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="sc-error-banner">
                      <AlertCircle size={16} />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* Big, Unmistakable 1-Tap Checkout Buttons */}
                  <div className="sc-express-pay-stack cx-pay-stack">
                    {/* 1. Primary 1-Tap Card / Apple Pay / Google Pay Button */}
                    <button
                      type="button"
                      className="cx-pay-btn cx-pay-primary"
                      onClick={() => handleStripeRedirect('card')}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <CreditCard size={20} />
                      <span className="cx-pay-label">Card / Apple Pay / Google Pay</span>
                      <span className="cx-pay-cta">
                        {redirectingMethod === 'card' ? (
                          <Loader2 size={18} className="sc-spin" />
                        ) : (
                          `Pay $${Number(selectedPkg.priceUsd).toLocaleString('en-US', {
                            minimumFractionDigits: selectedPkg.priceUsd % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}`
                        )}
                      </span>
                    </button>

                    {/* 2. Signature 1-Tap Cash App Pay Button */}
                    <button
                      type="button"
                      className="cx-pay-btn cx-pay-cashapp"
                      onClick={() => handleStripeRedirect('cashapp')}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <span className="cx-cashapp-mark">$</span>
                      <span className="cx-pay-label">Cash App Pay</span>
                      <span className="cx-pay-cta">
                        {redirectingMethod === 'cashapp' ? (
                          <Loader2 size={18} className="sc-spin" />
                        ) : (
                          `Pay $${Number(selectedPkg.priceUsd).toLocaleString('en-US', {
                            minimumFractionDigits: selectedPkg.priceUsd % 1 === 0 ? 0 : 2,
                            maximumFractionDigits: 2,
                          })}`
                        )}
                      </span>
                    </button>

                    {/* 3. Clean Crypto Option */}
                    <button
                      type="button"
                      className={`cx-pay-btn cx-pay-crypto ${
                        showCryptoBox ? 'active' : ''
                      }`}
                      onClick={() => {
                        setShowCryptoBox(!showCryptoBox);
                        soundEngine.playButtonClick(500);
                      }}
                      disabled={Boolean(redirectingMethod)}
                    >
                      <Bitcoin size={20} />
                      <span className="cx-pay-label">Crypto — USDT, SOL, BTC, ETH (0% fee)</span>
                      <span className="cx-pay-cta">{showCryptoBox ? 'Hide ▲' : 'Select ▼'}</span>
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
                            <span className="sc-crypto-qr-caption">SCAN QR</span>
                          </div>

                          <div className="sc-crypto-info-col">
                            <div className="sc-crypto-amount-line">
                              Send <strong>{calculatedCryptoAmount} {currentCryptoObj.unit}</strong> ({currentCryptoObj.network}):
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
                              <span>Open in Wallet App</span>
                            </a>
                          </div>
                        </div>

                        <div className="sc-crypto-txhash-row">
                          <input
                            type="text"
                            value={cryptoTxHashInput}
                            onChange={(e) => setCryptoTxHashInput(e.target.value)}
                            className="sc-crypto-txhash-input"
                            placeholder="Optional: Paste TXID / Signature for instant check..."
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
                          </div>
                        )}

                        <button
                          type="button"
                          className="sc-confirm-crypto-btn"
                          onClick={handleConfirmCryptoPayment}
                          disabled={isProcessingCrypto}
                        >
                          {isProcessingCrypto ? (
                            <>
                              <Loader2 size={16} className="sc-spin" />
                              <span>Checking Blockchain...</span>
                            </>
                          ) : (
                            <span>I&apos;ve Sent the Crypto — Credit My Coins</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="sc-redirect-note">
                    <Lock size={13} />
                    <span>
                      Instant automatic coin delivery • 256-bit SSL encrypted checkout
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================================================================
              TAB 2: REDEEM SWEEPS COINS FOR REAL MONEY (4-PILLAR PAYOUT SUITE)
             ================================================================ */}
          {activeTab === 'redeem' && (
            <form onSubmit={handleRedeemSubmit} className="sc-redeem-form">
              {/* Top Balance & 1x Playthrough Rollover Verification Card */}
              <div className="sc-redeem-balance-card">
                <div>
                  <span className="sc-redeem-label">REDEEMABLE SWEEPS COINS (1× PLAYTHROUGH VERIFIED)</span>
                  <div className="sc-redeem-val">{playthroughState.redeemableSC.toFixed(2)} SC</div>
                  <span className="sc-redeem-sub">
                    Total Balance: {sweepsCoins.toFixed(2)} SC • Unplayed Bonus: {playthroughState.unplayedSC.toFixed(2)} SC • Min:{' '}
                    ${activeMinRedeemSC.toFixed(2)} SC
                  </span>
                </div>
                <div className="sc-redeem-usd-box">
                  <span>{isGiftCardMethod ? 'Gift Card Value (+5%)' : 'Cash / Crypto Value'}</span>
                  <strong>
                    $
                    {(isGiftCardMethod
                      ? playthroughState.redeemableSC * 1.05
                      : playthroughState.redeemableSC
                    ).toFixed(2)}{' '}
                    USD
                  </strong>
                </div>
              </div>

              {/* Pillar 1: 1x Playthrough (Rollover) Progress Meter */}
              <div className="sc-playthrough-meter-card">
                <div className="sc-playthrough-header">
                  <span className="sc-playthrough-title">
                    <ShieldCheck size={15} />
                    <span>1× Anti-Fraud Playthrough Rollover Status</span>
                  </span>
                  <span
                    className={`sc-playthrough-badge ${
                      playthroughState.isFullyUnlocked ? 'unlocked' : 'in-progress'
                    }`}
                  >
                    {playthroughState.isFullyUnlocked
                      ? '✅ 100% UNLOCKED FOR CASHOUT'
                      : `⚡ ${playthroughState.progressPct}% ROLLOVER COMPLETE`}
                  </span>
                </div>
                <div className="sc-playthrough-bar-track">
                  <div
                    className="sc-playthrough-bar-fill"
                    style={{ width: `${Math.max(6, playthroughState.progressPct)}%` }}
                  />
                </div>
                <div className="sc-playthrough-stats-row">
                  <span>Wagered SC: ${playthroughState.wageredSC.toFixed(2)}</span>
                  <span>Won SC: +${playthroughState.wonSC.toFixed(2)}</span>
                  <span>
                    {playthroughState.isFullyUnlocked
                      ? 'All SC eligible for immediate redemption'
                      : `Spin $${playthroughState.unplayedSC.toFixed(2)} more SC on the reels to unlock 100%`}
                  </span>
                </div>
              </div>

              {redeemError && (
                <div className="sc-error-banner">
                  <AlertCircle size={16} />
                  <span>{redeemError}</span>
                </div>
              )}

              {redeemSuccessMsg && (
                <div className="sc-success-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} />
                    <div>{redeemSuccessMsg}</div>
                  </div>
                  {lastSubmittedRedemption && (
                    <div className="sc-withdrawal-tracker-card">
                      <div className="sc-withdrawal-tracker-header">
                        <span>⚡ Live Withdrawal Progress Tracker ({lastSubmittedRedemption.id})</span>
                        <span className="sc-withdrawal-eta-pill">
                          {lastSubmittedRedemption.method === 'giftcard'
                            ? 'Instant Digital Delivery'
                            : lastSubmittedRedemption.method === 'crypto'
                            ? 'Est. 5–15 Mins On-Chain'
                            : 'Priority Operator Queue'}
                        </span>
                      </div>
                      <div className="sc-withdrawal-steps-grid">
                        <div className="sc-withdrawal-step completed">
                          <span className="sc-step-dot">✓</span>
                          <div>
                            <strong>1. Requested</strong>
                            <span>${Number(lastSubmittedRedemption.amountUsd || 0).toFixed(2)} USD Locked</span>
                          </div>
                        </div>
                        <div className="sc-withdrawal-step completed">
                          <span className="sc-step-dot">✓</span>
                          <div>
                            <strong>2. 1× Rollover Verified</strong>
                            <span>Playthrough &amp; AML Cleared</span>
                          </div>
                        </div>
                        <div className={`sc-withdrawal-step ${lastSubmittedRedemption.status === 'completed' ? 'completed' : 'active'}`}>
                          <span className="sc-step-dot">{lastSubmittedRedemption.status === 'completed' ? '✓' : '3'}</span>
                          <div>
                            <strong>3. Operator Dispatch</strong>
                            <span>{lastSubmittedRedemption.status === 'completed' ? 'Dispatched' : 'In 1-Click Queue'}</span>
                          </div>
                        </div>
                        <div className={`sc-withdrawal-step ${lastSubmittedRedemption.status === 'completed' ? 'completed' : ''}`}>
                          <span className="sc-step-dot">{lastSubmittedRedemption.status === 'completed' ? '✓' : '4'}</span>
                          <div>
                            <strong>4. Settled</strong>
                            <span>{lastSubmittedRedemption.destinationMasked || lastSubmittedRedemption.destination}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="sc-payout-pill"
                          onClick={() => setActiveTab('history')}
                        >
                          📜 View Audit Ledger →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pillar 2 & 3: 5 Payout Channels (Gift Card +5%, Crypto 0% Fee, Cash App/Chime, Instant Debit, Bank ACH) */}
              <div className="sc-field-group">
                <label>Choose Your Payout Channel</label>
                <div className="sc-payout-methods-grid">
                  {(SWEEPSTAKES_CONFIG.redemptionMethods || []).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`sc-payout-method-card ${redeemMethod === m.id ? 'active' : ''}`}
                      onClick={() => handleRedeemMethodChange(m.id)}
                    >
                      <div className="sc-payout-method-top">
                        <span className="sc-payout-method-name">{m.shortLabel || m.label}</span>
                        <span className="sc-payout-method-badge">{m.badge}</span>
                      </div>
                      <div className="sc-payout-method-eta">
                        Min ${m.minSC.toFixed(0)} SC • {m.eta}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pillar 2 Details: Digital Gift Card Brand Picker (+5% Bonus Value, $25 Min) */}
              {redeemMethod === 'giftcard' && (
                <div className="sc-field-group">
                  <label>Select Instant Digital Gift Card Brand (+5% Extra USD Bonus)</label>
                  <div className="sc-giftcard-brand-grid">
                    {(SWEEPSTAKES_CONFIG.giftCardBrands || []).map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        className={`sc-payout-pill ${
                          redeemGiftCardBrand === brand.id ? 'active' : ''
                        }`}
                        onClick={() => setRedeemGiftCardBrand(brand.id)}
                      >
                        <span>
                          {brand.icon} {brand.name} (+{brand.bonusPct}%)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pillar 3 Details: On-Chain Crypto Payout Asset Picker */}
              {redeemMethod === 'crypto' && (
                <div className="sc-field-group">
                  <label>Select Receiving Cryptocurrency &amp; Network (0% Casino Fee)</label>
                  <div className="sc-giftcard-brand-grid">
                    {(SWEEPSTAKES_CONFIG.cryptoPayoutAssets || []).map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className={`sc-payout-pill ${
                          redeemCryptoAsset === asset.id ? 'active' : ''
                        }`}
                        onClick={() => setRedeemCryptoAsset(asset.id)}
                      >
                        <span>⚡ {asset.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="sc-field-group">
                <label>
                  Amount to Redeem (Min ${activeMinRedeemSC.toFixed(2)} SC)
                  {isGiftCardMethod && parsedRedeemSC > 0
                    ? ` → Receives $${calculatedPayoutUsd.toFixed(2)} Gift Card (+$${calculatedBonusUsd.toFixed(
                        2
                      )} Free Bonus!)`
                    : ''}
                </label>
                <input
                  type="number"
                  min={activeMinRedeemSC}
                  step="1"
                  value={redeemAmountInput}
                  onChange={(e) => setRedeemAmountInput(e.target.value)}
                  className="sc-input"
                  placeholder={String(activeMinRedeemSC)}
                />
              </div>

              <div className="sc-field-group">
                <label>
                  {redeemMethod === 'giftcard'
                    ? 'Delivery Email Address for Instant Gift Card Code'
                    : redeemMethod === 'crypto'
                    ? `Your Receiving ${redeemCryptoAsset} Wallet Address`
                    : redeemMethod === 'chime'
                    ? 'Your $Cashtag or $ChimeSign Handle'
                    : redeemMethod === 'ach'
                    ? 'Bank Name, Routing & Account Number'
                    : 'Visa / Mastercard Debit Card Number'}
                </label>
                <input
                  type="text"
                  value={redeemDestination}
                  onChange={(e) => setRedeemDestination(e.target.value)}
                  className="sc-input"
                  placeholder={
                    redeemMethod === 'giftcard'
                      ? 'you@example.com (Instant Digital Code Delivery)'
                      : redeemMethod === 'crypto'
                      ? (SWEEPSTAKES_CONFIG.cryptoPayoutAssets || []).find(
                          (a) => a.id === redeemCryptoAsset
                        )?.placeholder || 'Paste your self-custody wallet address...'
                      : redeemMethod === 'chime'
                      ? '$YourCashtag or $YourChimeSign'
                      : redeemMethod === 'ach'
                      ? 'Chase • Routing 021000021 • Acct 000123456'
                      : '4242 •••• •••• 4242'
                  }
                />
              </div>

              <button type="submit" className="sc-submit-redeem-btn">
                {isGiftCardMethod
                  ? `🎁 Redeem ${parsedRedeemSC.toFixed(2)} SC for $${calculatedPayoutUsd.toFixed(
                      2
                    )} Gift Card (+5% Bonus)`
                  : redeemMethod === 'crypto'
                  ? `⚡ Request $${calculatedPayoutUsd.toFixed(2)} Instant ${redeemCryptoAsset} Payout`
                  : `💸 Redeem $${calculatedPayoutUsd.toFixed(2)} USD Prize`}
              </button>
            </form>
          )}

          {/* ================================================================
              TAB 3: TRANSACTION HISTORY & UNIFIED CRYPTOGRAPHIC AUDIT LEDGER
             ================================================================ */}
          {activeTab === 'history' && (() => {
            const spinReceipts = paymentService.getSpinReceipts();
            const totalPurchasedUsd = txHistory
              .filter((t) => String(t.type || '').toUpperCase().includes('PURCHASE'))
              .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);
            const totalRedeemedUsd = txHistory
              .filter((t) => String(t.type || '').toUpperCase().includes('REDEMPTION'))
              .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0);

            const filteredTxs = txHistory.filter((tx) => {
              const tUpper = String(tx.type || '').toUpperCase();
              if (historyFilter === 'purchases') return tUpper.includes('PURCHASE');
              if (historyFilter === 'redemptions') return tUpper.includes('REDEMPTION');
              if (historyFilter === 'spins') return false;
              return true;
            });

            return (
              <div className="sc-history-list">
                {/* Summary KPI Strip */}
                <div className="sc-ledger-kpi-grid">
                  <div className="sc-ledger-kpi-card">
                    <span>Total Purchased</span>
                    <strong>${totalPurchasedUsd.toFixed(2)} USD</strong>
                  </div>
                  <div className="sc-ledger-kpi-card">
                    <span>Total Redeemed</span>
                    <strong style={{ color: '#4ade80' }}>${totalRedeemedUsd.toFixed(2)} USD</strong>
                  </div>
                  <div className="sc-ledger-kpi-card">
                    <span>Redeemable SC (1× Verified)</span>
                    <strong style={{ color: '#fde047' }}>{playthroughState.redeemableSC.toFixed(2)} SC</strong>
                  </div>
                  <div className="sc-ledger-kpi-card">
                    <span>Verified Spins (HMAC-SHA256)</span>
                    <strong style={{ color: '#38bdf8' }}>{spinReceipts.length}</strong>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="sc-ledger-filter-bar">
                  {[
                    { id: 'all', label: `All Activity (${txHistory.length + spinReceipts.length})` },
                    { id: 'purchases', label: '💳 Purchases' },
                    { id: 'redemptions', label: '💸 Redemptions & Tracker' },
                    { id: 'spins', label: `🛡️ Verified Spins (${spinReceipts.length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`sc-payout-pill ${historyFilter === f.id ? 'active' : ''}`}
                      onClick={() => setHistoryFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {historyFilter !== 'spins' && filteredTxs.length === 0 && (historyFilter !== 'all' || spinReceipts.length === 0) ? (
                  <div className="sc-history-empty">
                    <History size={32} />
                    <p>No matching transactions recorded yet.</p>
                  </div>
                ) : (
                  <>
                    {historyFilter !== 'spins' &&
                      filteredTxs.map((tx) => {
                        const isRedemption = String(tx.type || '').toUpperCase().includes('REDEMPTION');
                        const isCompleted = (tx.status || 'completed') === 'completed';
                        const isRejected = tx.status === 'rejected';
                        return (
                          <div key={tx.id} className="sc-history-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <div>
                                <strong>{tx.type}</strong>
                                <div className="sc-history-date">
                                  {new Date(tx.timestamp).toLocaleString()} • ID: <code>{tx.id}</code> • Status:{' '}
                                  <span style={{ textTransform: 'uppercase', fontWeight: 700, color: isCompleted ? '#4ade80' : isRejected ? '#f87171' : '#facc15' }}>
                                    {tx.status || 'completed'}
                                  </span>
                                  {tx.txHashOrReceipt ? ` • Ref: ${tx.txHashOrReceipt}` : ''}
                                  {tx.giftCardCode ? ` • Gift Code: ${tx.giftCardCode}` : ''}
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

                            {isRedemption && !isRejected && (
                              <div className="sc-withdrawal-steps-grid compact">
                                <div className="sc-withdrawal-step completed">
                                  <span className="sc-step-dot">✓</span>
                                  <div>
                                    <strong>1. Requested</strong>
                                  </div>
                                </div>
                                <div className="sc-withdrawal-step completed">
                                  <span className="sc-step-dot">✓</span>
                                  <div>
                                    <strong>2. Rollover Verified</strong>
                                  </div>
                                </div>
                                <div className={`sc-withdrawal-step ${isCompleted ? 'completed' : 'active'}`}>
                                  <span className="sc-step-dot">{isCompleted ? '✓' : '3'}</span>
                                  <div>
                                    <strong>3. Approved &amp; Sent</strong>
                                  </div>
                                </div>
                                <div className={`sc-withdrawal-step ${isCompleted ? 'completed' : ''}`}>
                                  <span className="sc-step-dot">{isCompleted ? '✓' : '4'}</span>
                                  <div>
                                    <strong>4. {isCompleted ? 'Settled' : 'Pending Settlement'}</strong>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {(historyFilter === 'spins' || historyFilter === 'all') && spinReceipts.length > 0 && (
                      <div className="sc-spin-audit-section">
                        <div className="sc-spin-audit-header">
                          <span>🛡️ Provably Fair Spin Receipts (HMAC-SHA256)</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                            Every spin is cryptographically committed before reel evaluation
                          </span>
                        </div>
                        {spinReceipts.slice(0, historyFilter === 'spins' ? 25 : 8).map((spn) => (
                          <div key={spn.id} className="sc-history-row sc-spin-receipt-row">
                            <div>
                              <strong>
                                Spin #{spn.nonce} • {spn.currencyMode === 'SC' ? `$${Number(spn.betAmount).toFixed(2)} SC` : `${Number(spn.betAmount).toLocaleString()} GC`} Wager
                              </strong>
                              <div className="sc-history-date">
                                {spn.timestamp ? new Date(spn.timestamp).toLocaleTimeString() : 'Recent'} • Stops: <code>[{(spn.stops || []).join(', ')}]</code> • Seed Hash:{' '}
                                <code>{String(spn.serverSeedHash || '').slice(0, 12)}…</code> • Sig: <code>{String(spn.signature || '').slice(0, 10)}…</code>
                              </div>
                            </div>
                            <div className="sc-history-amounts">
                              <span
                                className={spn.winAmount > 0 ? 'sc-hist-sc' : 'sc-hist-usd'}
                                style={{ color: spn.winAmount > 0 ? '#4ade80' : '#94a3b8' }}
                              >
                                {spn.winAmount > 0
                                  ? spn.currencyMode === 'SC'
                                    ? `+$${Number(spn.winAmount).toFixed(2)} SC`
                                    : `+${Number(spn.winAmount).toLocaleString()} GC`
                                  : '0 Win'}
                              </span>
                              <span className="sc-verified-pill">✓ HMAC-SHA256</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
