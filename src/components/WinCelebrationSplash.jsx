import React, { useEffect, useState, useRef } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { soundEngine } from '../audio/soundEngine';
import { Sparkles, Trophy, Gem, Crown, Flame, Zap, Award } from 'lucide-react';

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

  let tier = 'micro';
  let tierTitle = 'WIN!';
  let tierSub = 'QUICK HIT!';
  let tierColor = '#f59e0b';

  if (ratio >= 10) {
    tier = 'big';
    tierTitle = 'SUPER WIN!';
    tierSub = 'TEMPLE VAULT UNLOCKED!';
    tierColor = '#fbbf24';
  } else if (ratio >= 5) {
    tier = 'super';
    tierTitle = 'GREAT WIN!';
    tierSub = 'SACRED GOLD HARVEST!';
    tierColor = '#00e5ff';
  } else if (ratio >= 1.5) {
    tier = 'mini';
    tierTitle = 'NICE WIN!';
    tierSub = 'EGYPTIAN BOUNTY!';
    tierColor = '#10b981';
  } else {
    tier = 'micro';
    tierTitle = 'WIN!';
    tierSub = 'QUICK HIT!';
    tierColor = '#d97706';
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

    // Roll up counter animation (tuned for flow state: snappier on micro/mini hits, grand on mega/ultra hits)
    const startTime = performance.now();
    const duration =
      tier === 'ultra' ? 1600 :
      tier === 'mega' ? 1200 :
      tier === 'big' ? 900 :
      tier === 'super' ? 650 :
      tier === 'mini' ? 450 : 280;

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
        soundEngine.playCoinTick(progress);
      }

      if (progress < 1) {
        animId = requestAnimationFrame(animateRoll);
      } else {
        setDisplayAmount(isSC ? Number(winAmount.toFixed(2)) : winAmount);
      }
    };

    animId = requestAnimationFrame(animateRoll);

    // Auto dismiss after duration + hold: brief on micro/mini wins to maintain flow rhythm
    const autoDismissMs =
      tier === 'ultra' ? 3200 :
      tier === 'mega' ? 2600 :
      tier === 'big' ? 2100 :
      tier === 'super' ? 1600 :
      tier === 'mini' ? 1200 : 900;

    const timer = setTimeout(() => {
      setVisible(false);
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    }, autoDismissMs);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
    };
  }, [winAmount, spinId, isSC, ratio, tier]);

  if (!visible || !winAmount || winAmount <= 0) return null;

  const coinCount =
    tier === 'ultra' ? 16 :
    tier === 'mega' ? 12 :
    tier === 'big' ? 10 :
    tier === 'super' ? 8 :
    tier === 'mini' ? 6 : 4;

  return (
    <div
      className={`win-splash-overlay tier-${tier}`}
      onClick={() => {
        setVisible(false);
        if (onCloseRef.current) onCloseRef.current();
      }}
      title="Click to collect and continue"
    >
      {/* Radiant rotating sunburst rays (scaled according to tier) */}
      {tier !== 'micro' && (
        <img
          src="/assets/psd/fx_rays.png"
          alt=""
          className={`win-splash-rays rays-${tier}`}
          draggable={false}
        />
      )}

      {/* Sparkling fireworks overlay */}
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className={`win-splash-sparks sparks-${tier}`}
        draggable={false}
      />

      {/* Floating Gold Coin Sparks */}
      <div className="win-splash-coins-particle-wrap">
        {Array.from({ length: coinCount }, (_, i) => (
          <span key={i} className={`splash-coin splash-coin-${(i % 8) + 1} tier-coin-${tier}`}>
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

        {/* Top Floating Crown / Crest / Emblem */}
        <div className="win-splash-crest">
          {tier === 'ultra' ? (
            <Flame size={28} className="crest-icon purple-glow" />
          ) : tier === 'mega' ? (
            <Crown size={28} className="crest-icon gold-glow" />
          ) : tier === 'big' ? (
            <Trophy size={26} className="crest-icon amber-glow" />
          ) : tier === 'super' ? (
            <Gem size={24} className="crest-icon cyan-glow" />
          ) : tier === 'mini' ? (
            <Award size={22} className="crest-icon emerald-glow" />
          ) : (
            <Sparkles size={20} className="crest-icon copper-glow" />
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
              height={tier === 'micro' ? 44 : tier === 'mini' ? 50 : 58}
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
