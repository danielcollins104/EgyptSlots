import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Building2,
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
  Clock,
  History,
  ExternalLink,
  Crown,
  Check,
  Flame,
  Zap,
} from 'lucide-react';
import {
  SWEEPSTAKES_CONFIG,
  getCashAppPayCheckoutLink,
  getStripePaymentLink,
  getPaymentReturnUrl,
} from '../config/sweepstakesConfig';
import { paymentService } from '../services/paymentService';
import { soundEngine } from '../audio/soundEngine';
import PrivacyTermsModal from './PrivacyTermsModal';

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
  // 2-Step checkout state: 1 = Choose Package, 2 = Choose Payment Method
  const [step, setStep] = useState(initialPackage ? 2 : 1);
  const [selectedPkg, setSelectedPkg] = useState(
    initialPackage || SWEEPSTAKES_CONFIG.storePackages[2] // Default Silver ($19.99)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [waitingForReturn, setWaitingForReturn] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Redemption state
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('ach'); // 'ach' | 'chime' | 'debit'
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
      setWaitingForReturn(false);
      setIsProcessing(false);
      setRedeemSuccessMsg('');
      setRedeemError('');
    }
  }, [isOpen, initialTab, initialPackage]);

  if (!isOpen) return null;

  const handleSelectPackageAndContinue = (pkg) => {
    setSelectedPkg(pkg);
    setStep(2);
    soundEngine.playButtonClick(540);
  };

  const handleInitiatePayment = (method) => {
    if (!selectedPkg) return;
    soundEngine.playButtonClick(620);
    setIsProcessing(true);

    // Save pending purchase into localStorage so return redirect or reloads know which package was chosen
    try {
      localStorage.setItem('dc_pending_purchase_pkg', selectedPkg.id);
      localStorage.setItem('dc_pending_purchase_time', String(Date.now()));
    } catch {}

    const returnUrl = getPaymentReturnUrl(selectedPkg.id);
    let checkoutUrl = '';

    if (method === 'cashapp') {
      checkoutUrl = getCashAppPayCheckoutLink(selectedPkg);
    } else {
      const baseStripe = getStripePaymentLink(selectedPkg);
      if (baseStripe) {
        const sep = baseStripe.includes('?') ? '&' : '?';
        checkoutUrl = `${baseStripe}${sep}return_url=${encodeURIComponent(returnUrl)}&client_reference_id=${encodeURIComponent(selectedPkg.id)}`;
      } else {
        checkoutUrl = returnUrl;
      }
    }

    setWaitingForReturn(true);
    setIsProcessing(false);

    // Open checkout flow
    if (checkoutUrl) {
      // If mobile or standalone app, navigate directly; on desktop, open checkout
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = checkoutUrl;
      } else {
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleSimulateReturn = () => {
    soundEngine.playWin(true);
    if (onPurchaseSuccess && selectedPkg) {
      onPurchaseSuccess(selectedPkg);
    }
    setWaitingForReturn(false);
    onClose();
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
      setRedeemError('Please provide your payout account destination (Routing/Account or Cashtag).');
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

  const txHistory = paymentService.getTransactionHistory();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      style={{ zIndex: 99999 }}
    >
      <div
        className="relative w-full max-w-2xl bg-gradient-to-b from-[#161224] via-[#0d0a17] to-[#08060d] border-2 border-[#ffd700]/40 rounded-2xl shadow-[0_0_50px_rgba(255,215,0,0.25)] text-white overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ffd700]/20 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#b8860b] flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              <Coins className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#ffe875] via-[#ffd700] to-[#ff9900]">
                CROWNS OF KEMET COIN STORE
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                {activeTab === 'store'
                  ? step === 1
                    ? 'Screen 1 of 2: Choose a Package'
                    : 'Screen 2 of 2: Choose Payment Method'
                  : activeTab === 'redeem'
                  ? 'Redeem Sweeps Coins for Real Cash (1 SC = $1 USD)'
                  : 'Recent Purchases & Cashouts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Balances */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 border border-[#ffd700]/30 text-xs">
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                {goldCoins.toLocaleString()} GC
              </span>
              <span className="text-white/30">|</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Gem className="w-3.5 h-3.5" />
                {sweepsCoins.toFixed(2)} SC
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label="Close Store"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-4 pt-2">
          <button
            onClick={() => {
              setActiveTab('store');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'store'
                ? 'border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            BUY COIN PACKAGES
          </button>
          <button
            onClick={() => {
              setActiveTab('redeem');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'redeem'
                ? 'border-[#00e5ff] text-[#00e5ff] bg-[#00e5ff]/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            REDEEM CASH PRIZES
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              soundEngine.playButtonClick(400);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-[#c084fc] text-[#c084fc] bg-[#c084fc]/10 rounded-t-lg'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            HISTORY
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: STORE PACKAGES (2-STEP FLOW) */}
          {activeTab === 'store' && (
            <div>
              {/* STEP 1: CHOOSE A PACKAGE */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#ffd700]" />
                        Select Your Coin Bundle
                      </h3>
                      <p className="text-xs text-white/70">
                        Choose any bundle below. Every package includes FREE Bonus Sweeps Coins!
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/40">
                      STEP 1 OF 2
                    </span>
                  </div>

                  {/* Package Cards List */}
                  <div className="grid grid-cols-1 gap-3">
                    {SWEEPSTAKES_CONFIG.storePackages.map((pkg) => {
                      const isSelected = selectedPkg?.id === pkg.id;
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => handleSelectPackageAndContinue(pkg)}
                          className={`relative group cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                            pkg.popular
                              ? 'border-[#ffd700] bg-gradient-to-r from-[#ffd700]/15 via-black/40 to-black/60 shadow-[0_0_20px_rgba(255,215,0,0.2)]'
                              : 'border-white/10 hover:border-[#ffd700]/60 bg-black/40 hover:bg-black/60'
                          }`}
                        >
                          {pkg.badge && (
                            <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-[#ffd700] to-[#ff9900] text-black shadow-md flex items-center gap-1">
                              <Crown className="w-3 h-3" />
                              {pkg.badge}
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd700]/20 to-[#ff9900]/10 border border-[#ffd700]/30 flex items-center justify-center shrink-0">
                              <Coins className="w-6 h-6 text-[#ffd700]" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">
                                  {pkg.goldCoins.toLocaleString()} Gold Coins
                                </span>
                              </div>
                              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                                <Gem className="w-4 h-4" />
                                +{pkg.freeSweepsCoins.toFixed(2)} FREE Sweeps Coins
                                <span className="text-xs text-white/50 font-normal">
                                  (${pkg.freeSweepsCoins.toFixed(2)} USD Value)
                                </span>
                              </div>
                              <div className="text-[11px] text-white/60 mt-0.5">{pkg.tagline}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                            <div className="text-right">
                              <div className="text-xl sm:text-2xl font-black text-[#ffe875]">
                                ${pkg.priceUsd.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-white/50 uppercase tracking-wider">USD One-Time</div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPackageAndContinue(pkg);
                              }}
                              className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#ffd700] to-[#ffaa00] hover:from-[#ffe066] hover:to-[#ffb700] text-black shadow-[0_0_15px_rgba(255,215,0,0.3)] flex items-center gap-1.5 transition-transform active:scale-95"
                            >
                              Select Package
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-[11px] text-white/50 flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      100% US Sweepstakes Compliant &bull; Instant Delivery &bull; Safe & Secure
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE PAYMENT METHOD */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Top Bar with Back Button */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setStep(1);
                        setWaitingForReturn(false);
                        soundEngine.playButtonClick(400);
                      }}
                      className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#ffd700] hover:text-amber-200 transition-colors py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Change Package
                    </button>
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      STEP 2 OF 2: CHOOSE PAYMENT METHOD
                    </span>
                  </div>

                  {/* Selected Package Summary Box */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#ffd700]/10 via-black/40 to-black/60 border border-[#ffd700]/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#ffd700]/20 border border-[#ffd700]/40 flex items-center justify-center">
                        <Coins className="w-5 h-5 text-[#ffd700]" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                          Selected Package:
                        </div>
                        <div className="text-sm sm:text-base font-black text-white">
                          {selectedPkg?.goldCoins?.toLocaleString()} Gold Coins +{' '}
                          <span className="text-emerald-400">
                            {selectedPkg?.freeSweepsCoins?.toFixed(2)} FREE SC
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg sm:text-2xl font-black text-[#ffe875]">
                        ${selectedPkg?.priceUsd?.toFixed(2)} USD
                      </div>
                    </div>
                  </div>

                  {/* If waiting for return / payment link opened */}
                  {waitingForReturn ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-black/80 to-black/95 border-2 border-emerald-500/50 text-center space-y-4 animate-fade-in shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                        <Zap className="w-7 h-7 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white">Checkout Opened!</h4>
                        <p className="text-xs sm:text-sm text-white/80 max-w-md mx-auto mt-1">
                          Complete your payment in Cash App Pay or Stripe. Upon completion, you will be automatically redirected back to Crowns of Kemet to receive your coins!
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          onClick={handleSimulateReturn}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Simulate Payment Return (Demo)
                        </button>
                        <button
                          onClick={() => setWaitingForReturn(false)}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          Choose Different Payment Method
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* The 2 Payment Methods */
                    <div className="space-y-3">
                      {/* METHOD 1: CASH APP PAY (Primary / Highlighted) */}
                      <div
                        onClick={() => handleInitiatePayment('cashapp')}
                        className="group cursor-pointer relative p-5 rounded-2xl border-2 border-[#00D632] bg-gradient-to-r from-[#00D632]/15 via-black/50 to-black/70 hover:from-[#00D632]/25 hover:border-[#00ff3c] transition-all duration-200 shadow-[0_0_25px_rgba(0,214,50,0.25)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#00D632] text-black shadow-md flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-black" />
                          RECOMMENDED &bull; INSTANT REDIRECT
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Cash App Logo / Icon */}
                          <div className="w-14 h-14 rounded-2xl bg-[#00D632] flex items-center justify-center text-black font-black text-2xl shadow-[0_0_20px_rgba(0,214,50,0.5)] shrink-0">
                            $
                          </div>
                          <div>
                            <div className="text-lg font-black text-white flex items-center gap-2">
                              Cash App Pay
                              <span className="text-xs font-bold text-[#00D632] px-2 py-0.5 rounded bg-[#00D632]/10 border border-[#00D632]/30">
                                1-Tap Mobile
                              </span>
                            </div>
                            <p className="text-xs text-white/80 mt-0.5">
                              Pay instantly with Cash App Pay. Automatically returns to game when finished!
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInitiatePayment('cashapp');
                          }}
                          className="w-full sm:w-auto px-5 py-3 rounded-xl font-black text-sm bg-[#00D632] hover:bg-[#00ff3c] text-black shadow-[0_0_20px_rgba(0,214,50,0.4)] flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
                        >
                          Pay ${selectedPkg?.priceUsd?.toFixed(2)} with Cash App Pay
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* METHOD 2: DEBIT / CREDIT CARD & DIGITAL WALLETS (Stripe) */}
                      <div
                        onClick={() => handleInitiatePayment('stripe')}
                        className="group cursor-pointer relative p-5 rounded-2xl border-2 border-white/15 hover:border-[#ffd700]/70 bg-gradient-to-r from-white/5 via-black/40 to-black/60 hover:from-black/60 transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
                            <CreditCard className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="text-lg font-black text-white flex items-center gap-2">
                              Debit / Credit Card
                              <span className="text-[10px] font-bold text-white/70 px-2 py-0.5 rounded bg-white/10">
                                Apple Pay &bull; Google Pay
                              </span>
                            </div>
                            <p className="text-xs text-white/70 mt-0.5">
                              Visa, Mastercard, Amex, Apple Pay, Google Pay via Stripe secure checkout.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInitiatePayment('stripe');
                          }}
                          className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 border border-white/20 hover:border-[#ffd700] text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
                        >
                          Pay with Card / Apple Pay
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Footer Notice */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] text-white/60 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white/80">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Automatic Game Return & Instant Coin Credit
                    </div>
                    <div>
                      When your payment completes, the payment provider will automatically redirect your browser back to Crowns of Kemet, where your Gold Coins and FREE Sweeps Coins will be credited to your top balance instantly!
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REDEEM CASH PRIZES */}
          {activeTab === 'redeem' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-black/40 to-black/60 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                    Eligible Sweeps Coins Balance:
                  </div>
                  <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                    <Gem className="w-6 h-6" />
                    {sweepsCoins.toFixed(2)} SC
                    <span className="text-xs font-normal text-white/70">
                      (${sweepsCoins.toFixed(2)} USD Cashout Value)
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
                      Chime / Cashtag
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
                        ? 'Chime Sign / $Cashtag'
                        : 'Debit Card Number & Exp'
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
                          {new Date(tx.timestamp).toLocaleString()} &bull; Ref: {tx.id.slice(0, 8)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#ffd700]">
                          {tx.goldCoins ? `+${tx.goldCoins.toLocaleString()} GC` : ''}
                        </div>
                        <div className="font-bold text-emerald-400">
                          {tx.sweepsCoins ? `+${tx.sweepsCoins.toFixed(2)} SC` : ''}
                        </div>
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
            NO PURCHASE NECESSARY TO PLAY &bull; VOID WHERE PROHIBITED BY LAW
          </div>
          <button
            onClick={() => setPrivacyModalOpen(true)}
            className="text-[#ffd700] hover:underline"
          >
            Sweepstakes Rules & Terms
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
