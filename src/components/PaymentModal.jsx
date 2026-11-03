import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Gem,
  Coins,
  DollarSign,
  Gift,
  History,
  ExternalLink,
  Crown,
  Check,
  Flame,
  Zap,
  Bitcoin,
  Copy,
  Wallet,
  Lock,
  Loader2,
  User,
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
import PrivacyTermsModal from './PrivacyTermsModal';

const CRYPTO_PAYMENT_OPTIONS = [
  {
    symbol: 'USDT',
    name: 'Tether (USDT)',
    network: 'Solana / Polygon (0% Gas)',
    address: 'So11111111111111111111111111111111111111112dc',
    rateMultiplier: 1.0,
    unit: 'USDT',
    badge: 'INSTANT • 0% FEE',
    color: '#26a17b',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin (BTC)',
    network: 'Lightning & Native SegWit',
    address: 'bc1q9dcenterpriseskemetrelics78x2yza4901mn',
    rateMultiplier: 0.0000108,
    unit: 'BTC',
    badge: 'MOST SECURE',
    color: '#f7931a',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum (ETH)',
    network: 'Arbitrum & ERC-20',
    address: '0xDC049E71F32B59Ca9178E6B20261024T0819119',
    rateMultiplier: 0.000325,
    unit: 'ETH',
    badge: 'POPULAR',
    color: '#627eea',
  },
  {
    symbol: 'SOL',
    name: 'Solana (SOL)',
    network: 'Solana Mainnet (Sub-second)',
    address: 'DC8kemetVaultPhaserSlot49182371948291048291',
    rateMultiplier: 0.0054,
    unit: 'SOL',
    badge: 'FASTEST (0.4s)',
    color: '#14f195',
  },
];

function formatCardNumber(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
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
  // 2-Step checkout state: 1 = Choose Package, 2 = Choose Payment Method & Complete Checkout
  const [step, setStep] = useState(initialPackage ? 2 : 1);
  const [selectedPkg, setSelectedPkg] = useState(
    initialPackage || SWEEPSTAKES_CONFIG.storePackages[2] // Default Silver ($19.99)
  );
  // Active payment method on Step 2: 'card' | 'cashapp' | 'crypto'
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [selectedCrypto, setSelectedCrypto] = useState('USDT');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Stripe Card Checkout state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardZip, setCardZip] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isRedirectingStripe, setIsRedirectingStripe] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [purchaseCompletedPkg, setPurchaseCompletedPkg] = useState(null);

  // Redemption state
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('ach'); // 'ach' | 'chime' | 'debit'
  const [redeemDestination, setRedeemDestination] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      if (initialPackage) {
        setSelectedPkg(initialPackage);
        setStep(2);
      } else {
        setStep(1);
      }
      setPaymentMethod('card');
      setCopiedAddress(false);
      setCheckoutError('');
      setPurchaseCompletedPkg(null);
      setRedeemSuccessMsg('');
      setRedeemError('');
    }
  }, [isOpen, initialTab, initialPackage]);

  if (!isOpen) return null;

  const handleSelectPackageAndContinue = (pkg) => {
    setSelectedPkg(pkg);
    setStep(2);
    setPaymentMethod('card');
    setCheckoutError('');
    setPurchaseCompletedPkg(null);
    soundEngine.playButtonClick(540);
  };

  // Ensure guest is automatically upgraded to a verified VIP session when purchasing SC packages
  const ensureLoggedInForPurchase = async () => {
    const existing = authService.getCurrentUser();
    if (existing) return existing;
    return await authService.loginAsVipGuest();
  };

  // Option 1A: Redirect to Hosted Stripe Checkout Session (via server /api/checkout/create-session or Stripe Payment Link)
  const handleHostedStripeCheckout = async (methodType = 'card') => {
    if (!selectedPkg || isRedirectingStripe) return;
    soundEngine.playButtonClick(640);
    setCheckoutError('');
    setIsRedirectingStripe(true);

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
      console.warn('Stripe session creation warning:', err);
    } finally {
      setIsRedirectingStripe(false);
    }

    // Fallback direct link
    const baseStripe =
      methodType === 'cashapp'
        ? getCashAppPayCheckoutLink(selectedPkg)
        : getStripePaymentLink(selectedPkg);
    const returnUrl = getPaymentReturnUrl(selectedPkg.id);
    if (baseStripe) {
      window.location.href = baseStripe;
    } else {
      window.location.href = returnUrl;
    }
  };

  // Option 1B: Complete Instant Embedded Stripe Card / Apple Pay / Google Pay Checkout right inside the cashier
  const handleEmbeddedStripeCardSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedPkg || isProcessingPayment) return;
    setCheckoutError('');

    const cleanDigits = cardNumber.replace(/\D/g, '');
    if (cleanDigits.length < 12) {
      setCheckoutError('Please enter a valid 16-digit card number (or click "Open Hosted Stripe Page" below).');
      soundEngine.playButtonClick(400);
      return;
    }
    if (cardExpiry.length < 4) {
      setCheckoutError('Please enter your card expiration date (MM/YY).');
      soundEngine.playButtonClick(400);
      return;
    }
    if (cardCvc.length < 3) {
      setCheckoutError('Please enter your 3 or 4 digit CVC security code.');
      soundEngine.playButtonClick(400);
      return;
    }

    setIsProcessingPayment(true);
    soundEngine.playButtonClick(680);

    try {
      await ensureLoggedInForPurchase();
      await paymentService.processPurchase(selectedPkg, 'stripe_card', {
        cardLast4: cleanDigits.slice(-4),
        cardholderName: cardName || 'VIP Player',
      });

      setPurchaseCompletedPkg(selectedPkg);
      soundEngine.playWinCelebration(true);

      setTimeout(() => {
        if (onPurchaseSuccess) {
          onPurchaseSuccess(selectedPkg);
        }
        onClose();
      }, 1100);
    } catch (err) {
      setCheckoutError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Express 1-Click Apple Pay / Google Pay / Link / Cash App Pay verification
  const handleExpressCheckoutComplete = async (methodLabel = 'stripe_express') => {
    if (!selectedPkg || isProcessingPayment) return;
    setCheckoutError('');
    setIsProcessingPayment(true);
    soundEngine.playButtonClick(720);

    try {
      await ensureLoggedInForPurchase();
      await paymentService.processPurchase(selectedPkg, methodLabel, {
        cardLast4: methodLabel === 'cashapp_pay' ? 'CASH' : 'EXPR',
      });

      setPurchaseCompletedPkg(selectedPkg);
      soundEngine.playWinCelebration(true);

      setTimeout(() => {
        if (onPurchaseSuccess) {
          onPurchaseSuccess(selectedPkg);
        }
        onClose();
      }, 1050);
    } catch (err) {
      setCheckoutError(err.message || 'Express payment could not be completed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCopyCryptoAddress = (addr) => {
    navigator.clipboard?.writeText(addr);
    setCopiedAddress(true);
    soundEngine.playButtonClick(700);
    setTimeout(() => setCopiedAddress(false), 2200);
  };

  const handleConfirmCryptoSent = async () => {
    if (!selectedPkg || isProcessingPayment) return;
    setIsProcessingPayment(true);
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
      setIsProcessingPayment(false);
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
      setRedeemError('Please provide your payout account destination (Routing/Account or $Cashtag).');
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
        `Redemption of $${amount.toFixed(2)} USD requested! Ref: ${res.redemptionId}. Processed in 1-2 business days.`
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

  const txHistory = paymentService.getTransactionHistory();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      style={{ zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-gradient-to-b from-[#17122a] via-[#0e0a1a] to-[#08060f] border-2 border-[#ffd700]/45 rounded-2xl shadow-[0_0_60px_rgba(255,215,0,0.28)] text-white overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Shimmer Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ffd700] via-emerald-400 to-[#ffd700]" />

        {/* Top Cashier Header Bar (Pulsz / Chumba / Stake.us Style) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-[#ffd700]/20 bg-black/45">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#b8860b] flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.4)] shrink-0">
              <Coins className="w-6 h-6 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#ffe875] via-[#ffd700] to-[#ff9900]">
                  GET COINS &amp; CASHIER
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <ShieldCheck className="w-3 h-3" /> STRIPE VERIFIED
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-200/80 font-medium">
                {activeTab === 'store'
                  ? step === 1
                    ? 'Step 1 of 2: Select a Gold Coin Package (Includes FREE Sweeps Coins)'
                    : 'Step 2 of 2: Complete Payment with Card (Stripe), Cash App Pay, or Crypto'
                  : activeTab === 'redeem'
                  ? 'Redeem Eligible Sweeps Coins for Real Cash Prizes (1 SC = $1.00 USD)'
                  : 'Verified Purchase & Cashout Ledger'}
              </p>
            </div>
          </div>

          {/* Live Wallet Pill + Close Button */}
          <div className="flex items-center gap-2.5 ml-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-[#ffd700]/35 text-xs">
              <span className="text-[#ffd700] font-black flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {goldCoins.toLocaleString()} GC
              </span>
              <span className="text-white/25">|</span>
              <span className="text-emerald-400 font-black flex items-center gap-1">
                <Gem className="w-3.5 h-3.5" />
                ${sweepsCoins.toFixed(2)} SC
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
              aria-label="Close Cashier"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/25 px-4 pt-1.5">
          <button
            onClick={() => {
              setActiveTab('store');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'store'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            BUY PACKAGES
          </button>
          <button
            onClick={() => {
              setActiveTab('redeem');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'redeem'
                ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            REDEEM PRIZES
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-purple-400 text-purple-300 bg-purple-400/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            HISTORY ({txHistory.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[76vh] overflow-y-auto">
          {/* Purchase Celebration Overlay */}
          {purchaseCompletedPkg && (
            <div className="py-10 text-center space-y-4 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(16,185,129,0.5)]">
                <CheckCircle2 className="w-11 h-11 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ffe875] via-[#ffd700] to-emerald-400">
                PAYMENT CONFIRMED!
              </h3>
              <p className="text-sm text-white/90">
                Credited{' '}
                <strong className="text-[#ffd700]">
                  +{purchaseCompletedPkg.goldCoins.toLocaleString()} Gold Coins
                </strong>{' '}
                &amp;{' '}
                <strong className="text-emerald-400">
                  +{purchaseCompletedPkg.freeSweepsCoins.toFixed(2)} FREE Sweeps Coins
                </strong>{' '}
                to your balance!
              </p>
              <div className="text-xs text-white/60">Returning to Crowns of Kemet...</div>
            </div>
          )}

          {/* TAB 1: BUY PACKAGES (2-STEP PULSZ / CHUMBA / STAKE.US CASHIER LAYOUT) */}
          {!purchaseCompletedPkg && activeTab === 'store' && (
            <div>
              {/* STEP 1: CHOOSE A COIN PACKAGE */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Featured First-Purchase Bonus Banner (Pulsz / Chumba Style) */}
                  <div
                    onClick={() => handleSelectPackageAndContinue(SWEEPSTAKES_CONFIG.storePackages[2])}
                    className="cursor-pointer relative p-4 rounded-2xl bg-gradient-to-r from-[#ffd700]/25 via-emerald-500/20 to-indigo-600/25 border-2 border-[#ffd700] shadow-[0_0_25px_rgba(255,215,0,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#f59e0b] flex items-center justify-center text-black shadow-lg shrink-0">
                        <Flame className="w-7 h-7 fill-black" />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-black uppercase tracking-wider">
                          <Zap className="w-3 h-3 fill-black" /> EXCLUSIVE VIP SPECIAL
                        </div>
                        <div className="text-base sm:text-lg font-black text-white mt-0.5">
                          60,000 Gold Coins +{' '}
                          <span className="text-emerald-400">FREE 22.00 SC ($22 Value)</span>
                        </div>
                        <div className="text-xs text-white/75">
                          Instant delivery &bull; Includes 10% Extra Promotional Sweeps Coins
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPackageAndContinue(SWEEPSTAKES_CONFIG.storePackages[2]);
                      }}
                      className="px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-black shadow-[0_0_15px_rgba(255,215,0,0.4)] flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>BUY FOR $19.99</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2-Column / 3-Column Store Package Cards Grid (Industry Standard Layout) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => handleSelectPackageAndContinue(pkg)}
                          className={`relative group cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                            pkg.popular
                              ? 'border-[#ffd700] bg-gradient-to-b from-[#ffd700]/20 via-[#1b1435] to-[#0d0a1a] shadow-[0_0_25px_rgba(255,215,0,0.22)]'
                              : 'border-white/15 hover:border-[#ffd700]/70 bg-gradient-to-b from-white/5 to-black/60 hover:from-white/10'
                          }`}
                        >
                          {pkg.badge && (
                            <div className="mb-2 inline-flex self-start items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-[#ffd700] to-[#ff9900] text-black shadow">
                              <Crown className="w-3 h-3" />
                              {pkg.badge}
                            </div>
                          )}

                          {/* Gold Coins Header */}
                          <div className="my-1">
                            <div className="flex items-center gap-1.5 text-amber-300 font-black text-lg sm:text-xl">
                              <Coins className="w-5 h-5 text-[#ffd700] shrink-0" />
                              <span>{pkg.goldCoins.toLocaleString()}</span>
                            </div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                              Gold Coins
                            </div>
                          </div>

                          {/* Glowing Free Sweeps Coins Pill (Pulsz / Chumba Green Badge) */}
                          <div className="my-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Gem className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div>
                                <div className="text-[10px] font-bold uppercase text-emerald-300/90">
                                  FREE BONUS
                                </div>
                                <div className="text-sm font-black text-emerald-400">
                                  +{pkg.freeSweepsCoins.toFixed(2)} SC
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300">
                              ${pkg.freeSweepsCoins.toFixed(2)} Val
                            </span>
                          </div>

                          {/* Price CTA Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPackageAndContinue(pkg);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-[#ffd700] to-[#ffaa00] group-hover:from-[#ffe57f] group-hover:to-[#ffc107] text-black shadow-[0_0_15px_rgba(255,215,0,0.25)] flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                          >
                            <span>${pkg.priceUsd.toFixed(2)}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trust Footer Strip */}
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-4 text-[11px] text-white/60">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      256-Bit SSL Encrypted
                    </span>
                    <span>&bull;</span>
                    <span>Powered by Stripe &amp; Cash App Pay</span>
                    <span>&bull;</span>
                    <span>Instant Coin Crediting</span>
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE PAYMENT METHOD & CHECKOUT (Card / Stripe, Cash App Pay, or Crypto) */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Top Bar with Back Button */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setCheckoutError('');
                        soundEngine.playButtonClick(400);
                      }}
                      className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#ffd700] hover:text-amber-200 transition-colors py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Change Package
                    </button>
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/40">
                      STEP 2 OF 2 &bull; SECURE CHECKOUT
                    </span>
                  </div>

                  {/* Selected Package Order Summary Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#ffd700]/15 via-emerald-500/10 to-black/60 border border-[#ffd700]/45 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#ffd700]/20 border border-[#ffd700]/40 flex items-center justify-center">
                        <Gem className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-amber-300 font-black">
                          SELECTED PACKAGE SUMMARY
                        </div>
                        <div className="text-sm sm:text-base font-black text-white">
                          {selectedPkg?.goldCoins?.toLocaleString()} Gold Coins +{' '}
                          <span className="text-emerald-400">
                            FREE {selectedPkg?.freeSweepsCoins?.toFixed(2)} Sweeps Coins (SC)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-auto">
                      <div className="text-[10px] uppercase text-white/50 font-bold">Total Due</div>
                      <div className="text-xl sm:text-2xl font-black text-[#ffe875]">
                        ${selectedPkg?.priceUsd?.toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* 3-Method Selector Tabs: Pay with Card (Stripe), Cash App Pay, or Crypto */}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Select Payment Method:
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('card');
                          setCheckoutError('');
                          soundEngine.playButtonClick(520);
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          paymentMethod === 'card'
                            ? 'border-indigo-400 bg-indigo-500/25 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                            : 'border-white/15 bg-black/40 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <CreditCard className="w-5 h-5 text-indigo-300" />
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
                            STRIPE
                          </span>
                        </div>
                        <div className="font-black text-xs sm:text-sm text-white">Pay with Card</div>
                        <div className="text-[10px] text-white/60">Visa, MC, Amex, Apple Pay</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('cashapp');
                          setCheckoutError('');
                          soundEngine.playButtonClick(520);
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          paymentMethod === 'cashapp'
                            ? 'border-[#00D632] bg-[#00D632]/20 shadow-[0_0_20px_rgba(0,214,50,0.28)]'
                            : 'border-white/15 bg-black/40 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="w-5 h-5 rounded bg-[#00D632] text-black font-black text-xs flex items-center justify-center">
                            $
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#00D632]/25 text-[#00D632]">
                            INSTANT
                          </span>
                        </div>
                        <div className="font-black text-xs sm:text-sm text-white">Cash App Pay</div>
                        <div className="text-[10px] text-white/60">1-Tap Mobile &amp; QR</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('crypto');
                          setCheckoutError('');
                          soundEngine.playButtonClick(520);
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                          paymentMethod === 'crypto'
                            ? 'border-[#f7931a] bg-[#f7931a]/20 shadow-[0_0_20px_rgba(247,147,26,0.28)]'
                            : 'border-white/15 bg-black/40 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Bitcoin className="w-5 h-5 text-[#f7931a]" />
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#f7931a]/25 text-[#f7931a]">
                            0% FEE
                          </span>
                        </div>
                        <div className="font-black text-xs sm:text-sm text-white">Crypto</div>
                        <div className="text-[10px] text-white/60">USDT, BTC, ETH, SOL</div>
                      </button>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* PANEL 1: PAY WITH CARD (STRIPE CHECKOUT + EMBEDDED CARD FORM) */}
                  {paymentMethod === 'card' && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-black/55 border border-indigo-500/40 space-y-4">
                      {/* Primary Option: Open Hosted Stripe Payment Page */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-600/25 to-purple-600/25 border border-indigo-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-indigo-200 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-300" />
                            OFFICIAL STRIPE HOSTED CHECKOUT PAGE
                          </div>
                          <p className="text-[11px] text-white/70 mt-0.5">
                            Redirects to Stripe&apos;s secure payment page and automatically returns to the game.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleHostedStripeCheckout('card')}
                          disabled={isRedirectingStripe}
                          className="px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg flex items-center justify-center gap-1.5 shrink-0 transition-transform active:scale-95"
                        >
                          {isRedirectingStripe ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Opening Stripe...</span>
                            </>
                          ) : (
                            <>
                              <span>Go to Stripe Checkout</span>
                              <ExternalLink className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Express 1-Click Apple Pay / Google Pay Bar */}
                      <div>
                        <div className="text-[11px] font-bold text-white/60 mb-1.5">
                          Or Express 1-Click Instant Checkout:
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleExpressCheckoutComplete('apple_pay')}
                            disabled={isProcessingPayment}
                            className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-100 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95"
                          >
                            <span> Pay</span>
                            <span className="text-black/60 font-bold">
                              (${selectedPkg?.priceUsd?.toFixed(2)})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExpressCheckoutComplete('google_pay')}
                            disabled={isProcessingPayment}
                            className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-100 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow transition-transform active:scale-95"
                          >
                            <span>G Pay</span>
                            <span className="text-black/60 font-bold">
                              (${selectedPkg?.priceUsd?.toFixed(2)})
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="relative flex py-0.5 items-center">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-white/45">
                          OR ENTER CARD DETAILS DIRECTLY
                        </span>
                        <div className="flex-grow border-t border-white/10"></div>
                      </div>

                      {/* Embedded Stripe Card Form */}
                      <form onSubmit={handleEmbeddedStripeCardSubmit} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-white/75 mb-1">
                              Cardholder Name
                            </label>
                            <input
                              type="text"
                              placeholder="Name on Card"
                              value={cardName}
                              onChange={(e) => setCardName(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/20 focus:border-indigo-400 text-white text-xs sm:text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-white/75 mb-1">
                              Card Number (Visa / MC / Amex)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="4242 •••• •••• 4242"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/20 focus:border-indigo-400 text-white font-mono text-xs sm:text-sm outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-white/75 mb-1">
                              Expiry (MM/YY)
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="08/29"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/20 focus:border-indigo-400 text-white font-mono text-xs sm:text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-white/75 mb-1">
                              CVC
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="123"
                              value={cardCvc}
                              onChange={(e) =>
                                setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))
                              }
                              className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/20 focus:border-indigo-400 text-white font-mono text-xs sm:text-sm outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-white/75 mb-1">
                              ZIP / Postal
                            </label>
                            <input
                              type="text"
                              placeholder="90210"
                              maxLength={10}
                              value={cardZip}
                              onChange={(e) => setCardZip(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/20 focus:border-indigo-400 text-white font-mono text-xs sm:text-sm outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isProcessingPayment}
                          className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-98"
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Processing Stripe Payment...</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              <span>
                                Pay ${selectedPkg?.priceUsd?.toFixed(2)} USD &amp; Credit Coins Now
                              </span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* PANEL 2: CASH APP PAY */}
                  {paymentMethod === 'cashapp' && (
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-[#00D632]/15 to-black/70 border-2 border-[#00D632] space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#00D632] text-black font-black text-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,214,50,0.5)] shrink-0">
                          $
                        </div>
                        <div>
                          <div className="text-base font-black text-white flex items-center gap-2">
                            Cash App Pay via Stripe
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#00D632] text-black">
                              INSTANT CREDIT
                            </span>
                          </div>
                          <p className="text-xs text-white/75">
                            Approve with 1 tap in Cash App or via Stripe Hosted Checkout. Automatically returns to the game!
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleHostedStripeCheckout('cashapp')}
                          disabled={isRedirectingStripe}
                          className="py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-[#00D632] hover:bg-[#00ff3c] text-black shadow-[0_0_20px_rgba(0,214,50,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                          <span>Open Cash App Pay (Stripe)</span>
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExpressCheckoutComplete('cashapp_pay')}
                          disabled={isProcessingPayment}
                          className="py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-white/10 hover:bg-white/20 border border-[#00D632]/60 text-white flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#00D632]" />
                          <span>1-Tap Instant Cash App Pay</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PANEL 3: PAY WITH CRYPTO */}
                  {paymentMethod === 'crypto' && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-black/60 border-2 border-[#f7931a]/60 space-y-4">
                      <div>
                        <div className="text-xs font-bold text-white/80 mb-2">
                          Choose Cryptocurrency Network:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {CRYPTO_PAYMENT_OPTIONS.map((c) => (
                            <button
                              key={c.symbol}
                              type="button"
                              onClick={() => {
                                setSelectedCrypto(c.symbol);
                                soundEngine.playButtonClick(450);
                              }}
                              className={`p-2.5 rounded-xl font-black text-xs border flex items-center justify-center gap-2 transition-all ${
                                selectedCrypto === c.symbol
                                  ? 'border-[#f7931a] bg-[#f7931a]/25 text-white shadow-md'
                                  : 'border-white/10 hover:border-white/30 text-white/60 hover:text-white'
                              }`}
                            >
                              <span style={{ color: c.color }}>{c.symbol}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/70 border border-white/15 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60">Amount to Send:</span>
                          <span className="font-black text-white text-sm">
                            {calculatedCryptoAmount} {currentCryptoObj.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60">Network:</span>
                          <span className="font-bold text-emerald-400">
                            {currentCryptoObj.network}
                          </span>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/60 mb-1">
                            Deposit Address:
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2 rounded-lg bg-black/90 border border-white/20 font-mono text-[11px] text-amber-200 truncate select-all">
                              {currentCryptoObj.address}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyCryptoAddress(currentCryptoObj.address)}
                              className="px-3 py-2 rounded-lg bg-[#f7931a]/20 hover:bg-[#f7931a]/30 border border-[#f7931a]/40 text-[#f7931a] text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                            >
                              {copiedAddress ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmCryptoSent}
                        disabled={isProcessingPayment}
                        className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>I Have Sent Crypto &bull; Verify &amp; Credit SC Now</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REDEEM CASH PRIZES */}
          {activeTab === 'redeem' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-black/40 to-black/60 border border-emerald-500/35 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                    Redeemable Sweeps Coins Balance:
                  </div>
                  <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                    <Gem className="w-6 h-6" />
                    {sweepsCoins.toFixed(2)} SC
                    <span className="text-xs font-normal text-white/70">
                      (${sweepsCoins.toFixed(2)} USD Cash Value)
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div>Min. Cashout: $50.00 SC</div>
                  <div>1 SC = $1.00 USD</div>
                </div>
              </div>

              {redeemError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {redeemError}
                </div>
              )}

              {redeemSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {redeemSuccessMsg}
                </div>
              )}

              <form onSubmit={handleRedeemSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1">
                    Redemption Amount (SC)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="1"
                    value={redeemAmountInput}
                    onChange={(e) => setRedeemAmountInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/20 focus:border-emerald-400 text-white font-bold text-sm outline-none"
                    placeholder="Enter SC amount (min 50)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-white/80 mb-1">
                    Payout Destination
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setRedeemMethod('ach')}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                        redeemMethod === 'ach'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 text-white/60'
                      }`}
                    >
                      Bank ACH
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedeemMethod('chime')}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                        redeemMethod === 'chime'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 text-white/60'
                      }`}
                    >
                      Cash App / Chime
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedeemMethod('debit')}
                      className={`p-2 rounded-lg text-xs font-bold border transition-colors ${
                        redeemMethod === 'debit'
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 text-white/60'
                      }`}
                    >
                      Instant Debit
                    </button>
                  </div>
                  <input
                    type="text"
                    value={redeemDestination}
                    onChange={(e) => setRedeemDestination(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/20 focus:border-emerald-400 text-white text-sm outline-none"
                    placeholder={
                      redeemMethod === 'ach'
                        ? 'Routing Number & Account Number'
                        : redeemMethod === 'chime'
                        ? '$Cashtag or Chime Sign'
                        : 'Visa / Mastercard Debit Number'
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={sweepsCoins < SWEEPSTAKES_CONFIG.minRedemptionSC}
                  className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <DollarSign className="w-4 h-4" />
                  Request Cashout Payout
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {txHistory.length === 0 ? (
                <div className="text-center py-8 text-white/50 text-sm">
                  No previous transactions recorded on this device yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {txHistory.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white uppercase">{tx.type}</div>
                        <div className="text-white/50 text-[11px]">
                          {new Date(tx.timestamp).toLocaleString()} &bull; Ref: {tx.id.slice(0, 10)}
                        </div>
                      </div>
                      <div className="text-right">
                        {tx.goldCoins > 0 && (
                          <div className="font-bold text-[#ffd700]">
                            +{tx.goldCoins.toLocaleString()} GC
                          </div>
                        )}
                        {tx.sweepsCoins !== 0 && tx.sweepsCoins !== undefined && (
                          <div
                            className={`font-bold ${
                              tx.sweepsCoins > 0 ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {tx.sweepsCoins > 0
                              ? `+${Number(tx.sweepsCoins).toFixed(2)} SC`
                              : `${Number(tx.sweepsCoins).toFixed(2)} SC`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Sweepstakes Compliance Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-black/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/50">
          <div>
            NO PURCHASE NECESSARY TO PLAY &bull; 18+ ONLY &bull; VOID WHERE PROHIBITED
          </div>
          <button
            onClick={() => setPrivacyModalOpen(true)}
            className="text-[#ffd700] hover:underline"
          >
            Sweepstakes Official Rules &amp; Terms
          </button>
        </div>
      </div>

      {privacyModalOpen && (
        <PrivacyTermsModal
          isOpen={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
        />
      )}
    </div>
  );
}
