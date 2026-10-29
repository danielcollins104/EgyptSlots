import React from 'react';
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
} from 'lucide-react';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';
import { soundEngine } from '../audio/soundEngine';

export default function LowBalanceOfferModal({
  isOpen,
  onClose,
  currencyMode = 'SC',
  balance = 0,
  onSelectPackage,
  onOpenStore,
}) {
  if (!isOpen) return null;

  const isSC = currencyMode === 'SC';
  const packages = SWEEPSTAKES_CONFIG.rescuePackages || [
    {
      id: 'pkg_rescue_bronze',
      priceUsd: 9.99,
      goldCoins: 30000,
      freeSweepsCoins: 12.0,
      badge: 'RESCUE DEAL • +20% BONUS',
      tagline: 'Quick reload to stay in the action',
      savings: '20% Extra Free SC',
    },
    {
      id: 'pkg_rescue_silver',
      priceUsd: 19.99,
      goldCoins: 75000,
      freeSweepsCoins: 25.0,
      badge: 'MOST POPULAR RESCUE • +25% BONUS',
      tagline: 'Best value bankroll booster',
      savings: '25% Extra Free SC',
      recommended: true,
    },
    {
      id: 'pkg_rescue_gold',
      priceUsd: 49.99,
      goldCoins: 210000,
      freeSweepsCoins: 65.0,
      badge: 'WHALE RESCUE • +30% BONUS',
      tagline: 'Massive bankroll refill with VIP host perk',
      savings: '30% Extra Free SC',
    },
  ];

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

  return (
    <div className="low-balance-modal-backdrop" onClick={handleDismiss}>
      <div
        className="low-balance-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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

        {/* Header Header & Badge */}
        <div className="low-balance-modal-header">
          <div className="rescue-urgent-pill">
            <Flame size={14} className="flame-icon" />
            <span>EXCLUSIVE VIP BANKROLL RESCUE</span>
            <Sparkles size={14} className="sparkle-icon" />
          </div>

          <h2 className="rescue-modal-title">
            KEEP YOUR WINNING RHYTHM ALIVE!
          </h2>

          <p className="rescue-modal-subtitle">
            Your {isSC ? 'Sweeps Coin' : 'Gold Coin'} bankroll is running low (
            <strong>
              {isSC ? `${Number(balance).toFixed(2)} SC` : `${Number(balance).toLocaleString()} GC`}
            </strong>
            ). Don&apos;t lose your flow! Lock in up to <strong>+30% EXTRA BONUS COINS</strong> on this limited refill.
          </p>
        </div>

        {/* 3 High-Converting Package Cards */}
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
                  <div className="rescue-gc-row">
                    <Coins size={16} className="gc-icon-gold" />
                    <span className="rescue-gc-val">{pkg.goldCoins.toLocaleString()}</span>
                    <span className="rescue-gc-unit">GC</span>
                  </div>

                  <div className="rescue-sc-pill">
                    <Gem size={13} className="sc-icon-gem" />
                    <span>+{pkg.freeSweepsCoins.toFixed(2)} FREE SC</span>
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
                  <span>CLAIM FOR ${pkg.priceUsd.toFixed(2)}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions & High Roller Entryway */}
        <div className="rescue-modal-footer">
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

          <button
            type="button"
            className="rescue-dismiss-text-btn"
            onClick={handleDismiss}
          >
            Maybe Later &bull; Return to Game
          </button>
        </div>

        {/* Trust Guarantee */}
        <div className="rescue-guarantee-strip">
          <ShieldCheck size={13} />
          <span>Instant Credit &bull; 1 SC = $1 USD Real Prize Redemption &bull; 100% Secure</span>
        </div>
      </div>
    </div>
  );
}
