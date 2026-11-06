import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Coins,
  Gem,
  Crown,
  Flame,
  ArrowRight,
  ShieldCheck,
  Zap,
  Gift,
  Gamepad2,
  CheckCircle2,
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';
import { soundEngine } from '../audio/soundEngine';

export const REFILL_PACKAGES = [
  {
    id: 'pkg_starter',
    tierTitle: 'Initiate Scepter Pack',
    priceUsd: 4.99,
    originalPriceUsd: 9.99,
    goldCoins: 10000,
    freeSweepsCoins: 5.0,
    badge: 'STARTER FLASH • 50% OFF',
    tagline: 'Instant refill + $5.00 Free SC Value',
    relicArt: '/assets/symbols/high/high_ankh_no_frame.png',
    savings: 'Save $5.00',
  },
  {
    id: 'pkg_rescue_bronze',
    tierTitle: 'Sacred Scarab Rescue',
    priceUsd: 9.99,
    originalPriceUsd: 16.99,
    goldCoins: 30000,
    freeSweepsCoins: 12.0,
    badge: 'RESCUE DEAL • +20% BONUS',
    tagline: '30,000 GC + $12.00 Free Redeemable SC',
    relicArt: '/assets/symbols/high/high_scarab_no_frame.png',
    savings: '20% Extra Free SC',
  },
  {
    id: 'pkg_rescue_silver',
    tierTitle: 'Royal Necklace Booster',
    priceUsd: 19.99,
    originalPriceUsd: 34.99,
    goldCoins: 75000,
    freeSweepsCoins: 25.0,
    badge: '🔥 #1 BEST VALUE • +25% BONUS',
    tagline: '75,000 GC + $25.00 Real Cash Prize Value!',
    relicArt: '/assets/symbols/high/high_necklace_no_frame.png',
    savings: '25% Extra Free SC',
    recommended: true,
  },
  {
    id: 'pkg_rescue_gold',
    tierTitle: 'All-Seeing Eye Whale Pack',
    priceUsd: 49.99,
    originalPriceUsd: 79.99,
    goldCoins: 210000,
    freeSweepsCoins: 65.0,
    badge: '👑 WHALE RESCUE • +30% BONUS',
    tagline: 'Exceeds $50 Minimum Cashout Threshold!',
    relicArt: '/assets/symbols/high/high_eye_no_frame.png',
    savings: '30% Extra Free SC',
  },
];

export default function LowBalanceOfferModal({
  isOpen,
  onClose,
  currencyMode = 'SC',
  balance = 0,
  goldCoins = 0,
  onSelectPackage,
  onOpenStore,
  onSwitchToGC,
  onClaimDailyBonus,
  canClaimDaily = false,
}) {
  const [liveRescueJackpot, setLiveRescueJackpot] = useState(1254892.45);

  useEffect(() => {
    if (!isOpen) return undefined;
    const tick = setInterval(() => {
      setLiveRescueJackpot((prev) => Number((prev + 0.42 + Math.random() * 1.35).toFixed(2)));
    }, 120);
    return () => clearInterval(tick);
  }, [isOpen]);

  if (!isOpen) return null;

  const isSC = currencyMode === 'SC';
  const isZeroSC = isSC && Number(balance) < 0.15;
  const packages = REFILL_PACKAGES;

  const handleClaim = (pkg) => {
    soundEngine.playButtonClick(620);
    if (onSelectPackage) {
      onSelectPackage(pkg);
    } else if (onOpenStore) {
      onOpenStore();
    }
  };

  const handleDismiss = () => {
    soundEngine.playButtonClick(400);
    onClose();
  };

  const handleSwitchToGC = () => {
    soundEngine.playButtonClick(660);
    if (onSwitchToGC) {
      onSwitchToGC();
    }
    onClose();
  };

  const handleDailyClaim = () => {
    soundEngine.playWin(false);
    if (onClaimDailyBonus) {
      onClaimDailyBonus();
    }
  };

  return (
    <div className="low-balance-modal-backdrop" onClick={handleDismiss}>
      <div
        className="low-balance-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="low-balance-title"
      >
        {/* Glow ambient background aura */}
        <div className="low-balance-modal-aura" />

        {/* Top Close Button */}
        <button
          className="low-balance-close-btn"
          onClick={handleDismiss}
          aria-label="Close offer"
        >
          <X size={20} />
        </button>

        {/* Header Badge & Title */}
        <div className="low-balance-modal-header">
          <div className="rescue-urgent-pill">
            <Flame size={14} className="flame-icon" />
            <span>
              {isZeroSC
                ? 'OUT OF SWEEPS COINS'
                : isSC
                ? 'LOW SWEEPS COINS REMINDER'
                : 'LOW GOLD COINS REFILL'}
            </span>
            <Sparkles size={14} className="sparkle-icon" />
          </div>

          <h2 id="low-balance-title" className="rescue-modal-title">
            {isZeroSC
              ? 'NEED MORE SWEEPS COINS TO SPIN?'
              : 'KEEP YOUR WINNING RHYTHM ALIVE!'}
          </h2>

          <p className="rescue-modal-subtitle">
            {isSC ? (
              <>
                Your current balance is{' '}
                <strong style={{ color: '#00e5ff' }}>
                  ${Number(balance).toFixed(2)} SC
                </strong>
                . To receive <strong>FREE promotional Sweeps Coins</strong> redeemable for real cash prizes, choose any Gold Coin bundle below!
              </>
            ) : (
              <>
                Your Gold Coin bankroll is running low (
                <strong style={{ color: '#ffd700' }}>
                  {Number(balance).toLocaleString()} GC
                </strong>
                ). Lock in up to <strong>+30% EXTRA BONUS COINS</strong> on this limited refill!
              </>
            )}
          </p>

          {/* Live Ticking Progressive Jackpot & VIP Trust Strip */}
          <div className="rescue-live-jackpot-strip">
            <span className="rescue-jp-label">⚡ LIVE GRAND JACKPOT POOL:</span>
            <strong className="rescue-jp-counter">
              ${liveRescueJackpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="rescue-jp-badge">INSTANT CREDIT</span>
          </div>
        </div>

        {/* Daily Reward Banner (if eligible) */}
        {canClaimDaily && (
          <div className="rescue-daily-claim-bar">
            <div className="daily-claim-left">
              <Gift size={18} className="gift-bounce-icon" />
              <div>
                <span className="daily-claim-title">FREE DAILY BONUS READY!</span>
                <span className="daily-claim-sub">Claim 5,000 GC + 0.50 FREE SC immediately</span>
              </div>
            </div>
            <button
              type="button"
              className="daily-claim-btn"
              onClick={handleDailyClaim}
            >
              <span>CLAIM NOW</span>
              <Sparkles size={14} />
            </button>
          </div>
        )}

        {/* 4 High-Converting Package Cards */}
        <div className="rescue-packages-grid">
          {packages.map((pkg) => {
            const isRec = pkg.recommended;
            return (
              <div
                key={pkg.id}
                className={`rescue-package-card ${isRec ? 'recommended' : ''}`}
                onClick={() => handleClaim(pkg)}
              >
                {pkg.badge && (
                  <div className={`rescue-badge-tag ${isRec ? 'rec-badge' : ''}`}>
                    {pkg.badge}
                  </div>
                )}

                <div className="rescue-card-top">
                  {pkg.relicArt && (
                    <img
                      src={pkg.relicArt}
                      alt={pkg.tierTitle || 'Relic'}
                      className="rescue-relic-emblem"
                      draggable={false}
                    />
                  )}
                  <div className="rescue-gc-row">
                    <Coins size={16} className="gc-icon-gold" />
                    <span className="rescue-gc-val">{pkg.goldCoins.toLocaleString()}</span>
                    <span className="rescue-gc-unit">GC</span>
                  </div>

                  <div className="rescue-sc-pill">
                    <Gem size={13} className="sc-icon-gem" />
                    <span>+FREE ${pkg.freeSweepsCoins.toFixed(2)} SC</span>
                  </div>
                </div>

                <div className="rescue-tagline">{pkg.tagline}</div>

                <button
                  type="button"
                  className={`rescue-cta-btn ${isRec ? 'primary-glow' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaim(pkg);
                  }}
                >
                  {pkg.originalPriceUsd && (
                    <span className="rescue-old-price">${pkg.originalPriceUsd.toFixed(2)}</span>
                  )}
                  <span>CLAIM ${pkg.priceUsd.toFixed(2)}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Dual Actions Deck */}
        <div className="rescue-modal-footer">
          {/* Option A: Switch to Free Gold Coins */}
          {isSC && goldCoins >= 15 && (
            <button
              type="button"
              className="rescue-switch-gc-btn"
              onClick={handleSwitchToGC}
            >
              <Gamepad2 size={16} />
              <span>
                Play For Free &bull; Switch to Gold Coins ({goldCoins.toLocaleString()} GC Available)
              </span>
            </button>
          )}

          {/* Option B: Open Full Store */}
          <button
            type="button"
            className="rescue-all-packages-link"
            onClick={() => {
              soundEngine.playButtonClick(520);
              onOpenStore?.();
            }}
          >
            <Crown size={14} className="crown-icon-sm" />
            <span>Open Full Coin Store &amp; High Roller Packages ($5,000+)</span>
          </button>

          {/* Option C: Maybe Later */}
          <button
            type="button"
            className="rescue-dismiss-text-btn"
            onClick={handleDismiss}
          >
            Maybe Later &bull; Return to Game
          </button>
        </div>

        {/* Legal Trust Guarantee */}
        <div className="rescue-guarantee-strip">
          <ShieldCheck size={13} />
          <span>
            100% Legal US Sweepstakes &bull; Free SC with GC Bundles &bull; 1 SC = $1 USD Real Prize Redemption
          </span>
        </div>
      </div>
    </div>
  );
}
