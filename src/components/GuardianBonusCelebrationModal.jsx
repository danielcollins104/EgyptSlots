import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, Flame, Crown, Play, Trophy } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

/**
 * 2026 Guardian Bonus Celebration Modal:
 * Displays a monumental "BONUS!" celebration animation when Lord Anubis
 * and Queen Bastet converge their divine lightning & fire upon the winning
 * combination, leading into a new view with Free Automatic Spins or 3D Bonus Game.
 */
export default function GuardianBonusCelebrationModal({
  isOpen = false,
  onStartFreeSpins,
  onEnterBonusVault,
  onClose,
  initialSpins = 10,
}) {
  const [countdown, setCountdown] = useState(4);

  // Play fanfare and initiate auto-start countdown
  useEffect(() => {
    if (!isOpen) {
      setCountdown(4);
      return;
    }

    try {
      soundEngine.playBonusTrigger?.();
      setTimeout(() => {
        soundEngine.playCollectorFullFanfare?.();
      }, 350);
    } catch {}

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onStartFreeSpins?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onStartFreeSpins]);

  if (!isOpen) return null;

  return (
    <div
      className="guardian-bonus-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Guardian Apex Overcharge Bonus Celebration"
      onClick={onStartFreeSpins}
    >
      {/* Background Rotating Sunburst Rays */}
      <div className="guardian-bonus-sunburst-rays" />

      {/* Floating Spark Energy Field */}
      <div className="guardian-bonus-sparks-orbit">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="guardian-bonus-spark-dot"
            style={{
              '--orbit-idx': i,
              '--orbit-angle': `${(i * 360) / 20}deg`,
              '--orbit-dist': `${120 + (i % 5) * 35}px`,
              '--orbit-dur': `${3 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div
        className="guardian-bonus-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Arch Crest with Golden Ankh & Solar Flare */}
        <div className="guardian-bonus-crest-wrapper">
          <div className="guardian-bonus-energy-halo" />
          <div className="guardian-bonus-crest-icon-box">
            <Zap className="guardian-bonus-zap-left" size={28} />
            <Crown className="guardian-bonus-crown-center" size={44} />
            <Flame className="guardian-bonus-flame-right" size={28} />
          </div>
          <div className="guardian-bonus-laser-ring" />
        </div>

        {/* Monumental Gleaming "BONUS!" Typography */}
        <div className="guardian-bonus-title-stack">
          <span className="guardian-bonus-kicker">
            ⚡ GUARDIANS APEX OVERCHARGE ⚡
          </span>
          <h1 className="guardian-bonus-giant-title">
            <span className="title-letter letter-b">B</span>
            <span className="title-letter letter-o">O</span>
            <span className="title-letter letter-n">N</span>
            <span className="title-letter letter-u">U</span>
            <span className="title-letter letter-s">S</span>
            <span className="title-letter letter-ex">!</span>
          </h1>
          <p className="guardian-bonus-subtitle">
            LORD ANUBIS & QUEEN BASTET CONVERGE DIVINE WRATH ON THE REELS!
          </p>
        </div>

        {/* Feature Badges Grid */}
        <div className="guardian-bonus-feature-ribbon">
          <div className="guardian-bonus-feature-chip chip-spins">
            <Sparkles size={16} className="chip-icon" />
            <div className="chip-text">
              <strong>{initialSpins} FREE SPINS</strong>
              <small>Automatic Spins Mode</small>
            </div>
          </div>

          <div className="guardian-bonus-feature-chip chip-mult">
            <Zap size={16} className="chip-icon" />
            <div className="chip-text">
              <strong>3× MULTIPLIER</strong>
              <small>Solar Win Surge</small>
            </div>
          </div>

          <div className="guardian-bonus-feature-chip chip-wilds">
            <Flame size={16} className="chip-icon" />
            <div className="chip-text">
              <strong>PHOENIX WILDS</strong>
              <small>Expanding High Payouts</small>
            </div>
          </div>
        </div>

        {/* Interactive Dual CTA Buttons */}
        <div className="guardian-bonus-actions">
          <button
            type="button"
            className="guardian-bonus-primary-btn"
            onClick={() => {
              soundEngine.playButtonClick?.(720);
              onStartFreeSpins?.();
            }}
          >
            <Play size={18} className="btn-icon" />
            <span className="btn-main-txt">
              START FREE AUTOMATIC SPINS • {initialSpins} SPINS
            </span>
            <span className="btn-countdown-badge">
              Auto-starts in {countdown}s
            </span>
          </button>

          {onEnterBonusVault && (
            <button
              type="button"
              className="guardian-bonus-secondary-btn"
              onClick={() => {
                soundEngine.playButtonClick?.(580);
                onEnterBonusVault?.();
              }}
            >
              <Trophy size={16} className="btn-sec-icon" />
              <span>OR PLAY 3D TREASURE VAULT</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
