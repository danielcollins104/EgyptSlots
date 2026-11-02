import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  Zap,
  Gem,
  Crown,
  Flame,
  ArrowRight,
  ShieldCheck,
  Star,
  Coins,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { BONUS_CONFIG } from '../config/slotConfig';

export default function CollectorCelebrationModal({
  isOpen,
  onClose,
  onEnterBonus,
  currencyMode = 'GC',
  currentBet = 15,
}) {
  const [countdown, setCountdown] = useState(5);
  const [activePipCount, setActivePipCount] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setActivePipCount(0);
      setCountdown(5);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Play majestic fanfare
    soundEngine.playCollectorFullFanfare();

    // Staggered cascade illumination of all 36 jewel pips
    let pip = 0;
    const pipInterval = setInterval(() => {
      pip += 2;
      if (pip >= 36) {
        setActivePipCount(36);
        clearInterval(pipInterval);
        soundEngine.playBonusPick(true);
      } else {
        setActivePipCount(pip);
        soundEngine.playCoinTick(pip / 36);
      }
    }, 45);

    // 5-second countdown timer for auto-transition
    setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleProceed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pipInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProceed = () => {
    soundEngine.playButtonClick(720);
    soundEngine.playBonusTrigger();
    if (timerRef.current) clearInterval(timerRef.current);
    if (onEnterBonus) {
      onEnterBonus();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="collector-celebration-backdrop" onClick={handleProceed}>
      <div
        className="collector-celebration-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="3D Royal Bonus Collector Full Celebration"
      >
        {/* Animated Solar Sunburst Background Rays */}
        <div className="collector-sunburst-rays" />
        <div className="collector-radial-glow" />

        {/* Floating Jewel Particles */}
        <div className="collector-particles-container" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={`c-floating-particle p-${i % 6}`}
              style={{
                top: `${(i * 19) % 90}%`,
                left: `${(i * 23) % 92}%`,
                animationDelay: `${(i * 0.18).toFixed(2)}s`,
              }}
            />
          ))}
        </div>

        {/* Top Pharaoh Brand Crest */}
        <div className="collector-top-pill">
          <Crown size={15} className="crown-icon-gold" />
          <span>DC ENTERPRISES &bull; ROYAL TREASURE OVERCHARGE</span>
        </div>

        {/* Central 3D Sacred Scarab Overcharge Beacon */}
        <div className="collector-beacon-stage">
          <div className="collector-solar-halo" />
          <div className="collector-laser-ring" />
          <img
            src="/assets/symbols/high/high_scarab_no_frame.png"
            alt="3D Royal Scarab Overload"
            className="collector-scarab-hero-img"
            draggable={false}
          />
          <div className="collector-badge-surge">
            <Zap size={14} className="zap-badge-icon" />
            <span>36 / 36 JEWELS CHARGED</span>
          </div>
        </div>

        {/* Celebration Title & Multiplier Headline */}
        <div className="collector-headline-block">
          <h2 className="collector-celebration-title">
            3D ROYAL BONUS COLLECTOR FULL!
          </h2>
          <div className="collector-multiplier-ribbon">
            <Sparkles size={16} className="sparkle-solar" />
            <strong className="mult-text">2&times; SOLAR MULTIPLIER ACTIVATED!</strong>
            <Sparkles size={16} className="sparkle-solar" />
          </div>
          <p className="collector-subtitle">
            All 36 sacred jewels have converged. The Royal Tomb opens with double prize payouts on every vault pick and wheel spin!
          </p>
        </div>

        {/* Visual 36 Pips Matrix Animation */}
        <div className="collector-pips-board">
          <div className="pips-board-label">
            <Gem size={13} className="gem-icon-label" />
            <span>ROYAL JEWEL COLLECTOR MATRIX (36/36)</span>
          </div>
          <div className="collector-pips-grid">
            {Array.from({ length: 36 }).map((_, idx) => (
              <span
                key={idx}
                className={`celebration-pip ${idx < activePipCount ? 'ignited' : ''}`}
                style={{ animationDelay: `${(idx * 0.025).toFixed(3)}s` }}
              />
            ))}
          </div>
        </div>

        {/* Feature Unlocked Highlights */}
        <div className="collector-perks-row">
          <div className="collector-perk-badge">
            <Flame size={14} className="perk-flame" />
            <span>4 Treasure Vault Picks</span>
          </div>
          <div className="collector-perk-badge highlight">
            <Zap size={14} className="perk-zap" />
            <span>2&times; Multiplier Active</span>
          </div>
          <div className="collector-perk-badge">
            <Star size={14} className="perk-star" />
            <span>Fortune Wheel Access</span>
          </div>
        </div>

        {/* Interactive Claim / Enter Button */}
        <div className="collector-action-wrap">
          <button
            type="button"
            className="enter-bonus-vault-btn pulse-glow"
            onClick={handleProceed}
            autoFocus
          >
            <Zap size={18} className="btn-zap" />
            <span>ENTER 3D BONUS VAULT NOW &bull; 2&times; MULTIPLIER</span>
            <ArrowRight size={18} className="btn-arrow" />
          </button>
          <span className="collector-auto-countdown">
            Entering automatically in {countdown}s...
          </span>
        </div>
      </div>
    </div>
  );
}
