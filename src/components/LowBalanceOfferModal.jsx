import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Coins,
  Gem,
  Crown,
  Flame,
  ArrowRight,
  Gift,
  Gamepad2,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

export const REFILL_PACKAGES = [
  {
    id: 'pkg_starter',
    tierTitle: 'Initiate Scepter Pack',
    priceUsd: 4.99,
    originalPriceUsd: 9.99,
    goldCoins: 10000,
    freeSweepsCoins: 5.0,
    badge: '50% OFF',
    tagline: 'Instant refill + $5.00 Free SC Value',
    relicArt: '/assets/symbols/high/high_ankh_no_frame.png',
    savings: 'Save $5.00',
    stripePriceId: 'price_1UXigsArFku8z2ykbjO6sZnb',
    stripePaymentLink: 'https://buy.stripe.com/aFa14mfrz6cbbCk3Lc8ww05',
    cashAppStripePaymentLink: 'https://buy.stripe.com/eVq3cudjrawveOwbhE8ww07',
    cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/4.99',
  },
  {
    id: 'pkg_rescue_bronze',
    tierTitle: 'Sacred Scarab Rescue',
    priceUsd: 9.99,
    originalPriceUsd: 16.99,
    goldCoins: 30000,
    freeSweepsCoins: 12.0,
    badge: '+20% BONUS',
    tagline: '30,000 GC + $12.00 Free Redeemable SC',
    relicArt: '/assets/symbols/high/high_scarab_no_frame.png',
    savings: '20% Extra Free SC',
    stripePriceId: 'price_1UXigtArFku8z2ykhp3A7n1H',
    stripePaymentLink: 'https://buy.stripe.com/5kQ14m3IRasrdKsfuU8ww02',
    cashAppStripePaymentLink: 'https://buy.stripe.com/3cI6oGcfn5878q8chI8ww08',
    cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/9.99',
  },
  {
    id: 'pkg_rescue_silver',
    tierTitle: 'Royal Necklace Booster',
    priceUsd: 19.99,
    originalPriceUsd: 34.99,
    goldCoins: 75000,
    freeSweepsCoins: 25.0,
    badge: '🔥 BEST VALUE',
    tagline: '75,000 GC + $25.00 Real Cash Prize Value!',
    relicArt: '/assets/symbols/high/high_necklace_no_frame.png',
    savings: '25% Extra Free SC',
    recommended: true,
    stripePriceId: 'price_1UXiguArFku8z2ykmC3iSckl',
    stripePaymentLink: 'https://buy.stripe.com/28EdR893bcAz0XGezQ8ww04',
    cashAppStripePaymentLink: 'https://buy.stripe.com/14A3cufrz2ZZfSAgxY8ww09',
    cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/19.99',
  },
  {
    id: 'pkg_rescue_gold',
    tierTitle: 'All-Seeing Eye Whale Pack',
    priceUsd: 49.99,
    originalPriceUsd: 79.99,
    goldCoins: 210000,
    freeSweepsCoins: 65.0,
    badge: '👑 +30% VIP',
    tagline: 'Exceeds $50 Minimum Cashout Threshold!',
    relicArt: '/assets/symbols/high/high_eye_no_frame.png',
    savings: '30% Extra Free SC',
    stripePriceId: 'price_1UXigvArFku8z2yknkA6V7wE',
    stripePaymentLink: 'https://buy.stripe.com/bJe28q5QZ7gf35O3Lc8ww03',
    cashAppStripePaymentLink: 'https://buy.stripe.com/3cI00ia7f9onbCk95w8ww0a',
    cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/49.99',
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
    }, 150);
    return () => clearInterval(tick);
  }, [isOpen]);

  if (!isOpen) return null;

  const isSC = currencyMode === 'SC';
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
        className="low-balance-modal-dialog rescue-compact-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="low-balance-title"
      >
        <button
          className="low-balance-close-btn"
          onClick={handleDismiss}
          aria-label="Close offer"
        >
          <X size={18} />
        </button>

        {/* Compact Header */}
        <div className="low-balance-modal-header">
          <div className="rescue-urgent-pill">
            <Flame size={12} className="flame-icon" />
            <span>QUICK COIN REFILL</span>
          </div>

          <h2 id="low-balance-title" className="rescue-modal-title">
            GET COINS &amp; FREE SC
          </h2>

          <div className="rescue-live-jackpot-strip">
            <span>Balance: {isSC ? `$${Number(balance).toFixed(2)} SC` : `${Number(balance).toLocaleString()} GC`}</span>
            <span>•</span>
            <span>Jackpot: ${liveRescueJackpot.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Daily Reward Banner (if eligible) */}
        {canClaimDaily && (
          <div className="rescue-daily-claim-bar">
            <div className="daily-claim-left">
              <Gift size={16} className="gift-bounce-icon" />
              <span className="daily-claim-title">FREE DAILY BONUS: 5,000 GC + $0.50 SC</span>
            </div>
            <button
              type="button"
              className="daily-claim-btn"
              onClick={handleDailyClaim}
            >
              <span>CLAIM</span>
              <Sparkles size={12} />
            </button>
          </div>
        )}

        {/* 2x2 Compact Package Grid */}
        <div className="rescue-packages-grid rescue-compact-grid">
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

                <img
                  src={pkg.relicArt}
                  alt=""
                  className="rescue-relic-emblem"
                  draggable={false}
                />

                <div className="rescue-gc-row">
                  <Coins size={14} className="gc-icon-gold" />
                  <span className="rescue-gc-val">{pkg.goldCoins.toLocaleString()}</span>
                  <span className="rescue-gc-unit">GC</span>
                </div>

                <div className="rescue-sc-pill">
                  <Gem size={11} className="sc-icon-gem" />
                  <span>+${pkg.freeSweepsCoins.toFixed(0)} SC FREE</span>
                </div>

                <button
                  type="button"
                  className={`rescue-cta-btn ${isRec ? 'primary-glow' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaim(pkg);
                  }}
                >
                  {pkg.originalPriceUsd && (
                    <span className="rescue-old-price">${pkg.originalPriceUsd.toFixed(0)}</span>
                  )}
                  <span>${pkg.priceUsd.toFixed(2)}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Minimal Footer Actions */}
        <div className="rescue-modal-footer">
          {isSC && goldCoins >= 15 && (
            <button
              type="button"
              className="rescue-switch-gc-btn"
              onClick={handleSwitchToGC}
            >
              <Gamepad2 size={14} />
              <span>Play Free with Gold Coins ({goldCoins.toLocaleString()} GC)</span>
            </button>
          )}

          <div className="rescue-footer-links-row">
            <button
              type="button"
              className="rescue-all-packages-link"
              onClick={() => {
                soundEngine.playButtonClick(520);
                onOpenStore?.();
              }}
            >
              <Crown size={13} />
              <span>All Packages</span>
            </button>
            <button
              type="button"
              className="rescue-dismiss-text-btn"
              onClick={handleDismiss}
            >
              No Thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
