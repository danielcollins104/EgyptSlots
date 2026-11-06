import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Crown,
  Flame,
  ShieldCheck,
  Coins,
  Gem,
  ArrowRight,
  Zap,
  Clock,
  Star,
  TrendingUp,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';
import { soundEngine } from '../audio/soundEngine';

/**
 * Built with the /casino-ad-architect 4-Pillar Conversion Blueprint:
 * 1. The "Vegas Marquee" Hook (Brand Authority + Founder Credibility + 5-Star Trust Seal)
 * 2. Live Progressive Jackpot Ticker (Real-time ticking Grand Jackpot & Bonus Pool)
 * 3. Structured Promotional Offer Stack (VIP Founder's Reward Cards with Relic Art & Pill Tags)
 * 4. High-Contrast Shimmer Action CTA (1-Click Direct Checkout Flow)
 */
export default function VipPromoAdModal({
  isOpen,
  onClose,
  triggerReason = 'vip_flash', // 'vip_flash' | 'hot_streak' | 'post_big_win' | 'post_bonus' | 'cashout_bridge'
  lastWinAmount = 0,
  currencyMode = 'GC',
  sweepsCoins = 0,
  goldCoins = 0,
  onSelectPackage,
  onOpenFullStore,
}) {
  const [liveJackpot, setLiveJackpot] = useState(1254892.45);
  const [countdownSec, setCountdownSec] = useState(14 * 60 + 59);
  const [selectedIdx, setSelectedIdx] = useState(1); // Default to #1 Most Popular ($19.99)

  // Pillar 2: Live Progressive Jackpot Ticker (increments every frame/interval for urgency)
  useEffect(() => {
    if (!isOpen) return undefined;
    const tick = setInterval(() => {
      setLiveJackpot((prev) => Number((prev + 0.37 + Math.random() * 1.45).toFixed(2)));
    }, 110);
    return () => clearInterval(tick);
  }, [isOpen]);

  // Countdown urgency timer
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(() => {
      setCountdownSec((prev) => (prev > 60 ? prev - 1 : 899));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const storePkgs = SWEEPSTAKES_CONFIG.storePackages || [];
  const featuredPackages = [
    {
      ...(storePkgs.find((p) => p.id === 'pkg_starter') || {
        id: 'pkg_starter',
        tierTitle: 'Initiate Scepter Pack',
        priceUsd: 4.99,
        originalPriceUsd: 9.99,
        goldCoins: 10000,
        freeSweepsCoins: 5.0,
        relicArt: '/assets/symbols/high/high_ankh_no_frame.png',
      }),
      adRibbon: '⚡ FAST START • 50% OFF',
      adHook: '10,000 GC + $5.00 FREE SC',
      adPerks: ['Instant VIP Access', '15 Laser Paylines', '$5.00 Real Prize Entries'],
      highlightColor: '#38bdf8',
    },
    {
      ...(storePkgs.find((p) => p.id === 'pkg_silver') || {
        id: 'pkg_silver',
        tierTitle: 'Royal Necklace Chest',
        priceUsd: 19.99,
        originalPriceUsd: 34.99,
        goldCoins: 60000,
        freeSweepsCoins: 22.0,
        relicArt: '/assets/symbols/high/high_necklace_no_frame.png',
      }),
      adRibbon: '🔥 #1 VIP FOUNDER CHOICE • SAVE 43%',
      adHook: '60,000 GC + $22.00 FREE SC',
      adPerks: [
        '+10% Extra Free SC Bonus',
        '100× Expanding Wilds Boost',
        'Priority Instant Crypto & Card Checkout',
      ],
      recommended: true,
      highlightColor: '#fde047',
    },
    {
      ...(storePkgs.find((p) => p.id === 'pkg_gold') || {
        id: 'pkg_gold',
        tierTitle: 'All-Seeing Eye Vault',
        priceUsd: 49.99,
        originalPriceUsd: 79.99,
        goldCoins: 175000,
        freeSweepsCoins: 57.5,
        relicArt: '/assets/symbols/high/high_eye_no_frame.png',
      }),
      adRibbon: '👑 INSTANT $50+ CASHOUT UNLOCK',
      adHook: '175,000 GC + $57.50 FREE SC',
      adPerks: [
        'Exceeds $50 Minimum Redemption!',
        '+15% Extra Free SC Whale Bonus',
        'VIP High-Roller Crown Status',
      ],
      highlightColor: '#e879f9',
    },
  ];

  const activePkg = featuredPackages[selectedIdx] || featuredPackages[1];
  const mins = Math.floor(countdownSec / 60);
  const secs = String(countdownSec % 60).padStart(2, '0');

  const cashoutGoal = SWEEPSTAKES_CONFIG.minRedemptionSC || 50;
  const currentScNum = Number(sweepsCoins) || 0;
  const projectedSc = Number((currentScNum + (activePkg.freeSweepsCoins || 0)).toFixed(2));
  const currentPct = Math.min(100, Math.round((currentScNum / cashoutGoal) * 100));
  const projectedPct = Math.min(100, Math.round((projectedSc / cashoutGoal) * 100));

  const reasonHeadlineMap = {
    post_big_win: {
      tag: '🔥 WINNER’S HIGH VIP MULTIPLIER MATCH',
      title: 'TURN YOUR HOT STREAK INTO REAL CASH PRIZES!',
      sub:
        currencyMode === 'GC' && lastWinAmount > 0
          ? `You just crushed a ${Number(lastWinAmount).toLocaleString()} GC win! Upgrade to VIP Sweeps Coins now so your next big hit pays redeemable USD!`
          : 'Your reels are running hot! Lock in your Founder’s Bonus SC bundle before this flash window closes.',
    },
    post_bonus: {
      tag: '👑 TEMPLE BONUS CHAMPION OFFER',
      title: 'CHAMPION’S VAULT UNLOCKED • +25% EXTRA FREE SC!',
      sub: 'Celebrate your bonus victory with Daniel’s VIP High-Roller Founder Pack and supercharge your bankroll.',
    },
    hot_streak: {
      tag: '⚡ GUARDIAN OVERCHARGE FLASH DROP',
      title: 'LORD ANUBIS & QUEEN BASTET BLESS YOUR BANKROLL!',
      sub: 'Exclusive mid-session VIP Founder’s drop: claim up to $57.50 in FREE redeemable Sweeps Coins!',
    },
    cashout_bridge: {
      tag: '💰 REAL PRIZE CASHOUT ACCELERATOR',
      title: `BRIDGE DIRECTLY TO THE $${cashoutGoal}.00 USD CASHOUT GOAL!`,
      sub: `You currently have $${currentScNum.toFixed(2)} SC. Adding this VIP bundle boosts your vault to $${projectedSc.toFixed(2)} SC!`,
    },
    vip_flash: {
      tag: '★ DC ENTERPRISES CASINO • DANIEL’S VIP HIGH-ROLLER EDITION ★',
      title: 'VIP FOUNDER’S REWARD VAULT • UP TO 50% OFF',
      sub: 'Buy Social Gold Coins & receive FREE Promotional Sweeps Coins redeemable 1:1 for Real USD Prizes!',
    },
  };

  const headerCopy = reasonHeadlineMap[triggerReason] || reasonHeadlineMap.vip_flash;

  const handleCheckoutPackage = (pkg) => {
    soundEngine.playButtonClick(760);
    onSelectPackage?.(pkg);
  };

  return (
    <div
      className="vip-ad-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="DC Enterprises VIP Founder Promotional Offer"
      onClick={() => {
        soundEngine.playButtonClick(420);
        onClose?.();
      }}
    >
      <div
        className="vip-ad-modal-billboard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vip-ad-laser-aura" />

        <button
          type="button"
          className="vip-ad-close-btn"
          onClick={() => {
            soundEngine.playButtonClick(420);
            onClose?.();
          }}
          aria-label="Close promotional offer"
          title="Close offer (Esc)"
        >
          <X size={19} />
        </button>

        {/* PILLAR 1: The "Vegas Marquee" Hook (Brand Authority + Founder Credibility + Trust Seal) */}
        <div className="vip-ad-marquee-top">
          <div className="vip-ad-authority-pill">
            <Crown size={13} className="authority-crown" />
            <span>{headerCopy.tag}</span>
          </div>

          <div className="vip-ad-trust-timer-row">
            <span className="vip-ad-stars-seal">
              <Star size={12} fill="#fde047" color="#fde047" />
              <Star size={12} fill="#fde047" color="#fde047" />
              <Star size={12} fill="#fde047" color="#fde047" />
              <Star size={12} fill="#fde047" color="#fde047" />
              <Star size={12} fill="#fde047" color="#fde047" />
              <strong>4.9/5 VIP RATED • 90.0% RTP</strong>
            </span>
            <span className="vip-ad-urgency-clock">
              <Clock size={12} />
              <span>FLASH OFFER EXPIRES IN {mins}:{secs}</span>
            </span>
          </div>

          <h2 className="vip-ad-headline">{headerCopy.title}</h2>
          <p className="vip-ad-subheadline">{headerCopy.sub}</p>
        </div>

        {/* PILLAR 2: Live Progressive Jackpot Ticker + Cashout Bridge Progress */}
        <div className="vip-ad-live-ticker-bar">
          <div className="vip-ticker-jackpot-col">
            <span className="ticker-eyebrow">⚡ LIVE GRAND JACKPOT &amp; VIP PRIZE POOL</span>
            <div className="ticker-live-counter">
              ${liveJackpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ticker-live-badge">LIVE</span>
            </div>
          </div>

          <div className="vip-ticker-cashout-col">
            <div className="cashout-progress-labels">
              <span>
                <TrendingUp size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                YOUR REAL PRIZE CASHOUT METER:
              </span>
              <strong>
                ${currentScNum.toFixed(2)} → <span style={{ color: '#34d399' }}>${projectedSc.toFixed(2)} SC</span> / ${cashoutGoal} Goal
              </strong>
            </div>
            <div className="cashout-progress-track">
              <div
                className="cashout-progress-fill-projected"
                style={{ width: `${projectedPct}%` }}
              />
              <div
                className="cashout-progress-fill-current"
                style={{ width: `${currentPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* PILLAR 3: Structured Promotional Offer Stack (3 VIP Founder's Reward Cards) */}
        <div className="vip-ad-cards-grid">
          {featuredPackages.map((pkg, idx) => {
            const isSelected = selectedIdx === idx;
            const isRec = pkg.recommended;
            return (
              <div
                key={pkg.id}
                className={`vip-founder-card ${isSelected ? 'card-selected' : ''} ${isRec ? 'card-most-popular' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(640);
                  setSelectedIdx(idx);
                }}
                onDoubleClick={() => handleCheckoutPackage(pkg)}
                role="button"
                tabIndex={0}
              >
                <div className="vip-card-ribbon">{pkg.adRibbon}</div>

                <div className="vip-card-body">
                  <img
                    src={pkg.relicArt}
                    alt={pkg.tierTitle}
                    className="vip-card-relic-img"
                    draggable={false}
                    decoding="async"
                  />

                  <div className="vip-card-tier-name">{pkg.tierTitle}</div>

                  <div className="vip-card-gc-amount">
                    <Coins size={16} color="#fde047" />
                    <span>{pkg.goldCoins.toLocaleString()} GC</span>
                  </div>

                  <div className="vip-card-sc-bonus-pill">
                    <Gem size={13} />
                    <span>+FREE ${pkg.freeSweepsCoins.toFixed(2)} SC ($1/SC)</span>
                  </div>

                  <ul className="vip-card-perks-list">
                    {pkg.adPerks.map((perk, pIdx) => (
                      <li key={pIdx}>
                        <Sparkles size={11} color="#fde047" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className="vip-card-select-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCheckoutPackage(pkg);
                  }}
                >
                  {pkg.originalPriceUsd && (
                    <span className="vip-strike-price">${pkg.originalPriceUsd.toFixed(2)}</span>
                  )}
                  <span>UNLOCK FOR ${pkg.priceUsd.toFixed(2)}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* PILLAR 4: High-Contrast Shimmer Action CTA */}
        <div className="vip-ad-bottom-cta-deck">
          <button
            type="button"
            className="vip-ad-master-cta-btn"
            onClick={() => handleCheckoutPackage(activePkg)}
          >
            <span className="vip-cta-shimmer" />
            <Flame size={20} className="vip-cta-icon" />
            <span className="vip-cta-main-text">
              CLAIM {activePkg.goldCoins.toLocaleString()} GC + ${activePkg.freeSweepsCoins.toFixed(2)} FREE SC NOW (${activePkg.priceUsd.toFixed(2)})
            </span>
            <ArrowRight size={19} />
          </button>

          <div className="vip-ad-sub-caption">
            <span>⚡ INSTANT AUTOMATIC BALANCE CREDIT</span>
            <span>•</span>
            <span>💳 CARD / APPLE PAY / CASH APP / BTC • ETH • SOL</span>
            <span>•</span>
            <button
              type="button"
              className="vip-ad-view-all-link"
              onClick={() => {
                soundEngine.playButtonClick(580);
                onOpenFullStore?.();
              }}
            >
              View All 7 Packages &amp; Custom Slider →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
