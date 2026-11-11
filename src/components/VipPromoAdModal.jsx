import React, { useState, useEffect } from 'react';
import {
  X,
  Crown,
  Flame,
  Coins,
  Gem,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';
import { soundEngine } from '../audio/soundEngine';

/**
 * Ultra-Clean, Zero-Scroll VIP Flash Offer Modal
 * Appears on hot streaks, post-bonus/big-win, or VIP Deal button tap.
 * Fits 100% on a single screen with 3 clean horizontal/compact cards and 1-tap checkout.
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const tick = setInterval(() => {
      setLiveJackpot((prev) => Number((prev + 0.37 + Math.random() * 1.45).toFixed(2)));
    }, 150);
    return () => clearInterval(tick);
  }, [isOpen]);

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
        tierTitle: 'Starter Pack',
        priceUsd: 4.99,
        originalPriceUsd: 9.99,
        goldCoins: 10000,
        freeSweepsCoins: 5.0,
        relicArt: '/assets/symbols/high/high_ankh_no_frame.png',
      }),
      shortTag: '50% OFF',
    },
    {
      ...(storePkgs.find((p) => p.id === 'pkg_silver') || {
        id: 'pkg_silver',
        tierTitle: 'Pharaoh Chest',
        priceUsd: 19.99,
        originalPriceUsd: 34.99,
        goldCoins: 60000,
        freeSweepsCoins: 22.0,
        relicArt: '/assets/symbols/high/high_necklace_no_frame.png',
      }),
      shortTag: '🔥 BEST VALUE',
      recommended: true,
    },
    {
      ...(storePkgs.find((p) => p.id === 'pkg_gold') || {
        id: 'pkg_gold',
        tierTitle: 'Royal Vault',
        priceUsd: 49.99,
        originalPriceUsd: 79.99,
        goldCoins: 175000,
        freeSweepsCoins: 55.0,
        relicArt: '/assets/symbols/high/high_eye_no_frame.png',
      }),
      shortTag: '👑 VIP BONUS',
    },
  ];

  const activePkg = featuredPackages[selectedIdx] || featuredPackages[1];
  const mins = Math.floor(countdownSec / 60);
  const secs = String(countdownSec % 60).padStart(2, '0');

  const cashoutGoal = SWEEPSTAKES_CONFIG.minRedemptionSC || 50;
  const currentScNum = Number(sweepsCoins) || 0;
  const projectedSc = Number((currentScNum + (activePkg.freeSweepsCoins || 0)).toFixed(2));

  const reasonHeadlineMap = {
    post_big_win: {
      tag: '🔥 HOT STREAK OFFER',
      title: 'PHARAOH’S CHEST UNLOCKED!',
    },
    post_bonus: {
      tag: '👑 BONUS CHAMPION OFFER',
      title: 'PHARAOH’S CHEST UNLOCKED!',
    },
    hot_streak: {
      tag: '⚡ SPECIAL FLASH DROP',
      title: 'PHARAOH’S CHEST UNLOCKED!',
    },
    cashout_bridge: {
      tag: '💰 CASHOUT BOOST',
      title: `BOOST TO $${projectedSc.toFixed(0)} SC!`,
    },
    vip_flash: {
      tag: '★ VIP FLASH DEAL ★',
      title: 'PHARAOH’S CHEST • UP TO 50% OFF',
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
      aria-label="Pharaoh's Chest Special Offer"
      onClick={() => {
        soundEngine.playButtonClick(420);
        onClose?.();
      }}
    >
      <div
        className="vip-ad-modal-billboard vip-ad-compact"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="vip-ad-close-btn"
          onClick={() => {
            soundEngine.playButtonClick(420);
            onClose?.();
          }}
          aria-label="Close offer"
        >
          <X size={18} />
        </button>

        {/* Compact Header */}
        <div className="vip-compact-header">
          <div className="vip-compact-pill-row">
            <span className="vip-ad-authority-pill">
              <Crown size={12} />
              <span>{headerCopy.tag}</span>
            </span>
            <span className="vip-ad-urgency-clock">
              <Clock size={11} />
              <span>{mins}:{secs}</span>
            </span>
          </div>

          <h2 className="vip-ad-headline">{headerCopy.title}</h2>
          <p className="vip-ad-subheadline">
            Tap any chest below — includes <strong>FREE Sweeps Coins</strong> ($1 SC = $1 Cash Prize)
          </p>
        </div>

        {/* 3 Clean, No-Scroll Offer Cards */}
        <div className="vip-compact-cards">
          {featuredPackages.map((pkg, idx) => {
            const isSelected = selectedIdx === idx;
            const isRec = pkg.recommended;
            return (
              <div
                key={pkg.id}
                className={`vip-compact-card ${isSelected ? 'selected' : ''} ${isRec ? 'popular' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(640);
                  setSelectedIdx(idx);
                  handleCheckoutPackage(pkg);
                }}
                role="button"
                tabIndex={0}
              >
                <span className={`vip-compact-badge ${isRec ? 'rec' : ''}`}>
                  {pkg.shortTag}
                </span>

                <img
                  src={pkg.relicArt}
                  alt=""
                  className="vip-compact-img"
                  draggable={false}
                />

                <div className="vip-compact-info">
                  <div className="vip-compact-gc">
                    <Coins size={14} color="#fde047" />
                    <span>{pkg.goldCoins.toLocaleString()} GC</span>
                  </div>
                  <div className="vip-compact-sc">
                    <Gem size={12} />
                    <span>+${pkg.freeSweepsCoins.toFixed(0)} SC FREE</span>
                  </div>
                </div>

                <div className="vip-compact-price-btn">
                  {pkg.originalPriceUsd && (
                    <span className="vip-strike-price">${pkg.originalPriceUsd.toFixed(0)}</span>
                  )}
                  <span>${pkg.priceUsd.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Single Primary CTA + View Store Link */}
        <div className="vip-ad-bottom-cta-deck">
          <button
            type="button"
            className="vip-ad-master-cta-btn"
            onClick={() => handleCheckoutPackage(activePkg)}
          >
            <Flame size={18} />
            <span>
              GET {activePkg.goldCoins.toLocaleString()} GC + ${activePkg.freeSweepsCoins.toFixed(0)} SC FREE — ${activePkg.priceUsd.toFixed(2)}
            </span>
            <ArrowRight size={17} />
          </button>

          <div className="vip-compact-footer-row">
            <span className="vip-ad-cashout-bridge-card">
              Jackpot Pool: ${liveJackpot.toLocaleString('en-US', { maximumFractionDigits: 0 })} • Goal: ${cashoutGoal} SC
            </span>
            <button
              type="button"
              className="vip-ad-view-all-link"
              onClick={() => {
                soundEngine.playButtonClick(580);
                onOpenFullStore?.();
              }}
            >
              More Coin Packs →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
