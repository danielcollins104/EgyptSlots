import React, { useEffect, useState, useRef } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { soundEngine } from '../audio/soundEngine';
import { Sparkles, Trophy, Gem, Crown } from 'lucide-react';

export default function WinCelebrationSplash({
  winAmount = 0,
  currencyMode = 'GC',
  betAmount = 1,
  spinId = 0,
  onClose,
}) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const lastProcessedSpinRef = useRef(-1);

  const isSC = currencyMode === 'SC';
  const ratio = betAmount > 0 ? winAmount / betAmount : 1;

  let tier = 'standard';
  let tierTitle = 'WINNER!';
  let tierSub = 'VERIFIED PAYLINE WIN';
  let tierColor = '#f59e0b';

  if (ratio >= 8) {
    tier = 'mega';
    tierTitle = 'MEGA WIN!';
    tierSub = 'COLOSSAL EGYPTIAN TREASURE!';
    tierColor = '#ffd700';
  } else if (ratio >= 3) {
    tier = 'nice';
    tierTitle = 'SUPER WIN!';
    tierSub = 'SPECTACULAR HIT!';
    tierColor = '#fbbf24';
  }

  useEffect(() => {
    // If no win or already processed this exact spin, never re-trigger
    if (!winAmount || winAmount <= 0) {
      setVisible(false);
      return;
    }

    if (spinId === lastProcessedSpinRef.current) {
      return;
    }
    lastProcessedSpinRef.current = spinId;

    // Show celebration plaque strictly once for this spin
    setVisible(true);

    // Play win celebration sound and haptics EXACTLY ONCE
    try {
      soundEngine.playWinCelebration(tier);
    } catch (_) {}

    // Roll up counter animation
    const startTime = performance.now();
    const duration = Math.min(1600, Math.max(600, ratio * 180));
    let lastRendered = -1;
    let animId;

    const animateRoll = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = isSC
        ? Number((winAmount * eased).toFixed(2))
        : Math.round(winAmount * eased);

      if (current !== lastRendered) {
        lastRendered = current;
        setDisplayAmount(current);
      }

      if (progress < 1) {
        animId = requestAnimationFrame(animateRoll);
      } else {
        setDisplayAmount(isSC ? Number(winAmount.toFixed(2)) : winAmount);
      }
    };

    animId = requestAnimationFrame(animateRoll);

    // Auto dismiss after 2.4s and notify parent - strictly one-shot!
    const timer = setTimeout(() => {
      setVisible(false);
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    }, 2400);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
    };
  }, [winAmount, spinId, isSC, ratio, tier]);

  if (!visible || !winAmount || winAmount <= 0) return null;

  return (
    <div
      className={`win-splash-overlay tier-${tier}`}
      onClick={() => {
        setVisible(false);
        if (onCloseRef.current) onCloseRef.current();
      }}
      title="Click to collect and continue"
    >
      {/* Radiant rotating sunburst rays */}
      <img
        src="/assets/psd/fx_rays.png"
        alt=""
        className="win-splash-rays"
        draggable={false}
      />

      {/* Sparkling fireworks overlay */}
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="win-splash-sparks"
        draggable={false}
      />

      {/* Floating Gold Coin Sparks */}
      <div className="win-splash-coins-particle-wrap">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={`splash-coin splash-coin-${i + 1}`}>
            🪙
          </span>
        ))}
      </div>

      {/* Center 3D Celebration Plaque */}
      <div className="win-splash-plaque" onClick={(e) => e.stopPropagation()}>
        {/* Ornate Gold Frame Image Asset */}
        <img
          src="/assets/psd/logo_short_frame.png"
          alt=""
          className="win-splash-frame-img"
          draggable={false}
        />

        {/* Top Floating Crown / Crest */}
        <div className="win-splash-crest">
          {tier === 'mega' ? (
            <Crown size={28} className="crest-icon gold-glow" />
          ) : tier === 'nice' ? (
            <Trophy size={26} className="crest-icon cyan-glow" />
          ) : (
            <Gem size={24} className="crest-icon amber-glow" />
          )}
        </div>

        {/* Ribbon Header Banner */}
        <div className="win-splash-ribbon" style={{ borderColor: tierColor }}>
          <Sparkles size={14} className="ribbon-sparkle" />
          <span>{tierTitle}</span>
          <Sparkles size={14} className="ribbon-sparkle" />
        </div>

        {/* Animated Digits Display */}
        <div className="win-splash-digits-wrap">
          <div className="win-splash-digits">
            <PsdGoldNumber
              value={isSC ? displayAmount.toFixed(2) : displayAmount}
              height={58}
              gap={-3}
            />
          </div>
          <div className="win-splash-unit-tag">
            {isSC ? (
              <span className="sc-won-tag">+${displayAmount.toFixed(2)} USD (SC)</span>
            ) : (
              <span className="gc-won-tag">+{displayAmount.toLocaleString()} GOLD COINS</span>
            )}
          </div>
        </div>

        {/* Subtitle / Verification Tag */}
        <div className="win-splash-sub">{tierSub}</div>
      </div>
    </div>
  );
}
