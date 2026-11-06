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
  initialTab = 'store', // 'store' | 'redeem' | 'history' | 'payout_admin'
  initialPackage = null,
  goldCoins = 0,
  sweepsCoins = 0,
  onPurchaseSuccess,
  onRedeemSuccess,
  onRefundSC,
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

  // Redemption state (4-Pillar Payout Architecture)
  const [redeemAmountInput, setRedeemAmountInput] = useState('50');
  const [redeemMethod, setRedeemMethod] = useState('giftcard');
  const [redeemCryptoAsset, setRedeemCryptoAsset] = useState('USDT_SOL');
  const [redeemGiftCardBrand, setRedeemGiftCardBrand] = useState('visa_virtual');
  const [redeemDestination, setRedeemDestination] = useState('');
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [lastSubmittedRedemption, setLastSubmittedRedemption] = useState(null);

  // Admin 1-Click Payout Center state
  const [redemptionQueue, setRedemptionQueue] = useState(() =>
    paymentService.getRedemptionQueue()
  );
  const [adminTxInputs, setAdminTxInputs] = useState({});
  const [adminGiftCodeInputs, setAdminGiftCodeInputs] = useState({});
  const [adminStatusToast, setAdminStatusToast] = useState('');
  const [expandedAdminQrId, setExpandedAdminQrId] = useState(null);

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
      setRedemptionQueue(paymentService.getRedemptionQueue());
      setAdminStatusToast('');
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
      setRedemptionQueue(paymentService.getRedemptionQueue());
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

  const handleAdminApprove = (rdm) => {
    const txVal =
      adminTxInputs[rdm.id] ||
      (rdm.method === 'giftcard'
        ? `GC-${rdm.giftCardBrand?.toUpperCase() || 'VISA'}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`
        : `PAID_${Date.now().toString(36).toUpperCase()}`);
    const giftCode =
      adminGiftCodeInputs[rdm.id] ||
      (rdm.method === 'giftcard'
        ? `${(rdm.giftCardBrand || 'VISA').slice(0, 4).toUpperCase()}-${Math.random()
            .toString(36)
            .substring(2, 6)
            .toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : '');

    const res = paymentService.approveRedemption(rdm.id, {
      txHashOrReceipt: txVal,
      giftCardCode: giftCode,
      operatorNote: `Fulfilled via Admin 1-Click Payout Center (${rdm.method.toUpperCase()})`,
    });
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      setAdminStatusToast(
        `✅ Approved & Marked Paid: ${rdm.id} ($${Number(rdm.amountUsd || 0).toFixed(2)} USD)`
      );
      soundEngine.playWinCelebration(false);
    }
  };

  const handleAdminReject = (rdm) => {
    const res = paymentService.rejectRedemption(rdm.id, {
      reason: 'Canceled / Refunded via Admin Payout Center — SC Restored to Player Balance',
    });
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      if (res.refundSC > 0 && onRefundSC) {
        onRefundSC(res.refundSC);
      }
      setAdminStatusToast(
        `↩️ Rejected & Refunded +${Number(res.refundSC || 0).toFixed(2)} SC for ${rdm.id}`
      );
      soundEngine.playButtonClick(420);
    }
  };

  const handleCreateSampleAdminRedemption = (sampleType = 'chime') => {
    const samplePayload =
      sampleType === 'giftcard'
        ? {
            sweepsCoins: 25,
            method: 'giftcard',
            giftCardBrand: 'visa_virtual',
            destination: 'vip.winner@oopsiwon.com',
            playerName: 'Elena R. (VIP Demo)',
          }
        : sampleType === 'crypto'
        ? {
            sweepsCoins: 100,
            method: 'crypto',
            cryptoAsset: 'USDT_SOL',
            destination: 'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
            playerName: 'Devon K. (VIP Demo)',
          }
        : {
            sweepsCoins: 50,
            method: 'chime',
            destination: '$MarcusVIP777',
            playerName: 'Marcus T. (VIP Demo)',
          };
    const res = paymentService.requestRedemption(samplePayload);
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      setAdminStatusToast(`🧪 Added Sample ${sampleType.toUpperCase()} Redemption (${res.redemptionId}) to Queue!`);
      soundEngine.playButtonClick(620);
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

          <button
            type="button"
            className={`sc-cashier-tab ${activeTab === 'payout_admin' ? 'active' : ''}`}
            onClick={() => {
              setRedemptionQueue(paymentService.getRedemptionQueue());
              setActiveTab('payout_admin');
              soundEngine.playButtonClick(520);
            }}
            title="Admin 1-Click Payout & Redemption Queue Center"
          >
            <Crown size={15} />
            <span>
              Payout Center ({redemptionQueue.filter((r) => r.status === 'processing').length})
            </span>
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
                <div className="sc-success-banner">
                  <CheckCircle2 size={16} />
                  <div>
                    <div>{redeemSuccessMsg}</div>
                    {lastSubmittedRedemption && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="sc-payout-pill active"
                          onClick={() => setActiveTab('payout_admin')}
                        >
                          👑 View in Admin 1-Click Payout Center →
                        </button>
                      </div>
                    )}
                  </div>
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
                        {new Date(tx.timestamp).toLocaleString()} • Status:{' '}
                        <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
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
                ))
              )}
            </div>
          )}

          {/* ================================================================
              TAB 4: ADMIN 1-CLICK PAYOUT & REDEMPTION QUEUE CENTER
             ================================================================ */}
          {activeTab === 'payout_admin' && (
            <div className="sc-admin-payout-center">
              <div className="sc-admin-payout-banner">
                <div>
                  <h3 className="sc-admin-payout-title">
                    👑 Operator 1-Click Payout &amp; Redemption Center
                  </h3>
                  <p className="sc-admin-payout-desc">
                    Review player prize redemptions and fulfill them in 1 click via Cash App Deep-Link,
                    On-Chain Crypto URI/QR, or +5% Digital Gift Card Code.
                  </p>
                </div>
                <div className="sc-admin-sample-btns">
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('chime')}
                  >
                    + Test $Cashtag Payout
                  </button>
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('crypto')}
                  >
                    + Test Crypto Payout
                  </button>
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('giftcard')}
                  >
                    + Test +5% Gift Card
                  </button>
                </div>
              </div>

              {adminStatusToast && (
                <div className="sc-success-banner" style={{ marginBottom: '12px' }}>
                  <CheckCircle2 size={16} />
                  <span>{adminStatusToast}</span>
                </div>
              )}

              {redemptionQueue.length === 0 ? (
                <div className="sc-history-empty">
                  <Crown size={32} />
                  <p>No pending or historical redemptions in queue yet.</p>
                  <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                    Submit a redemption in the &ldquo;Redeem SC&rdquo; tab or click one of the &ldquo;+ Test&rdquo;
                    buttons above to preview 1-Click Operator Fulfillment.
                  </span>
                </div>
              ) : (
                <div className="sc-admin-queue-list">
                  {redemptionQueue.map((rdm) => {
                    const isPending = rdm.status === 'processing';
                    return (
                      <div
                        key={rdm.id}
                        className={`sc-admin-queue-card status-${rdm.status || 'processing'}`}
                      >
                        <div className="sc-admin-queue-top">
                          <div>
                            <span className="sc-admin-rdm-id">{rdm.id}</span>
                            <strong className="sc-admin-rdm-type">{rdm.type}</strong>
                            <div className="sc-history-date">
                              Player: {rdm.playerName || 'VIP Player'} •{' '}
                              {new Date(rdm.timestamp).toLocaleString()} • Destination:{' '}
                              <code>{rdm.destination || rdm.destinationMasked}</code>
                            </div>
                          </div>
                          <div className="sc-admin-rdm-amounts">
                            <span className="sc-admin-usd-amt">
                              ${Number(rdm.amountUsd || 0).toFixed(2)} USD
                            </span>
                            <span className="sc-admin-sc-amt">
                              ({Math.abs(Number(rdm.amountSC || rdm.sweepsCoins || 0)).toFixed(2)} SC
                              {rdm.bonusUsd > 0 ? ` + $${Number(rdm.bonusUsd).toFixed(2)} Bonus` : ''})
                            </span>
                            <span className={`sc-admin-status-pill ${rdm.status}`}>
                              {rdm.status === 'completed'
                                ? '✅ PAID'
                                : rdm.status === 'rejected'
                                ? '↩️ REFUNDED'
                                : '⏳ PENDING 1-CLICK PAYOUT'}
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Action Bar for Pending Redemptions */}
                        {isPending && (
                          <div className="sc-admin-actions-bar">
                            {rdm.cashAppPayoutLink && (
                              <a
                                href={rdm.cashAppPayoutLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sc-admin-action-btn cashapp"
                              >
                                <ExternalLink size={14} />
                                <span>
                                  💸 1-Click Send ${Number(rdm.amountUsd).toFixed(2)} on Cash App
                                </span>
                              </a>
                            )}

                            {rdm.cryptoPayoutUri && (
                              <>
                                <a
                                  href={rdm.cryptoPayoutUri}
                                  className="sc-admin-action-btn crypto"
                                >
                                  <Zap size={14} />
                                  <span>
                                    ⚡ 1-Tap Sign {rdm.cryptoAmount} {rdm.cryptoAsset} Wallet Payout
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  className="sc-payout-pill"
                                  onClick={() =>
                                    setExpandedAdminQrId(
                                      expandedAdminQrId === rdm.id ? null : rdm.id
                                    )
                                  }
                                >
                                  {expandedAdminQrId === rdm.id ? 'Hide Wallet QR' : '📱 Scan Wallet QR'}
                                </button>
                              </>
                            )}

                            {rdm.method === 'giftcard' && (
                              <input
                                type="text"
                                className="sc-input sc-admin-inline-input"
                                placeholder="Paste Gift Card Claim Code (or leave blank to auto-issue)..."
                                value={adminGiftCodeInputs[rdm.id] || ''}
                                onChange={(e) =>
                                  setAdminGiftCodeInputs((prev) => ({
                                    ...prev,
                                    [rdm.id]: e.target.value,
                                  }))
                                }
                              />
                            )}

                            <input
                              type="text"
                              className="sc-input sc-admin-inline-input"
                              placeholder="Optional TX Hash / Cash App Receipt ID..."
                              value={adminTxInputs[rdm.id] || ''}
                              onChange={(e) =>
                                setAdminTxInputs((prev) => ({
                                  ...prev,
                                  [rdm.id]: e.target.value,
                                }))
                              }
                            />

                            <button
                              type="button"
                              className="sc-admin-action-btn approve"
                              onClick={() => handleAdminApprove(rdm)}
                            >
                              <Check size={14} />
                              <span>Mark Paid &amp; Complete</span>
                            </button>

                            <button
                              type="button"
                              className="sc-admin-action-btn reject"
                              onClick={() => handleAdminReject(rdm)}
                            >
                              <X size={14} />
                              <span>Reject &amp; Refund SC</span>
                            </button>
                          </div>
                        )}

                        {expandedAdminQrId === rdm.id && rdm.cryptoQrUrl && (
                          <div className="sc-admin-qr-drawer">
                            <img
                              src={rdm.cryptoQrUrl}
                              alt="Crypto Payout QR"
                              width={140}
                              height={140}
                            />
                            <div>
                              <strong>Scan with Phantom, MetaMask, or Bitcoin Wallet</strong>
                              <p style={{ fontSize: '0.78rem', opacity: 0.85, margin: '4px 0' }}>
                                URI: <code>{rdm.cryptoPayoutUri}</code>
                              </p>
                            </div>
                          </div>
                        )}

                        {!isPending && (
                          <div className="sc-admin-completed-meta">
                            {rdm.txHashOrReceipt && (
                              <span>
                                Receipt / TXID: <code>{rdm.txHashOrReceipt}</code>
                              </span>
                            )}
                            {rdm.giftCardCode && (
                              <span>
                                • Gift Card Code: <code>{rdm.giftCardCode}</code>
                              </span>
                            )}
                            {rdm.operatorNote && <span> • {rdm.operatorNote}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
