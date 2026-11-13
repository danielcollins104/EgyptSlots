import React, { memo, useState, useEffect, useRef } from 'react';
import { BONUS_JACKPOT_TIERS } from '../config/slotConfig';
import { smoothPerformance } from '../plugins/smoothPerformancePlugin';

const DEFAULT_TIERS = [
  { id: 'mini', label: 'MINI', baseMultiplier: 20, color: '#10b981', gemHighlight: '#6ee7b7' },
  { id: 'minor', label: 'MINOR', baseMultiplier: 50, color: '#38bdf8', gemHighlight: '#bae6fd' },
  { id: 'major', label: 'MAJOR', baseMultiplier: 150, color: '#c084fc', gemHighlight: '#f3e8ff' },
  { id: 'grand', label: 'GRAND', baseMultiplier: 500, color: '#f43f5e', gemHighlight: '#fecdd3' },
];

const SC_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const GC_FORMATTER = new Intl.NumberFormat('en-US');

/**
 * 2026 Progressive Jackpot Display Marquee:
 * Pauses DOM micro-tick updates during active reel spins (`isSpinning`) and uses
 * tabular numeric alignment + pre-built Intl.NumberFormat instances so ticking digits
 * NEVER cause layout reflows or locale-option GC churn!
 */
const JackpotMarqueeBar = memo(function JackpotMarqueeBar({
  currencyMode = 'GC',
  currentBet = 15,
  isSpinning = false,
  hasWin = false,
}) {
  const [ticks, setTicks] = useState({
    mini: 0,
    minor: 0,
    major: 0,
    grand: 0,
  });
  const isSpinningRef = useRef(isSpinning);
  isSpinningRef.current = isSpinning;

  useEffect(() => {
    const tier = smoothPerformance.getTier();
    if (tier === 'lite') return undefined;
    const intervalMs = tier === 'balanced' ? 1100 : 650;

    const timer = setInterval(() => {
      if (
        isSpinningRef.current ||
        smoothPerformance.getTier() === 'lite' ||
        (typeof document !== 'undefined' && document.hidden)
      ) {
        return;
      }
      setTicks((prev) => ({
        mini: prev.mini + 0.02,
        minor: prev.minor + 0.045,
        major: prev.major + 0.1,
        grand: prev.grand + 0.28,
      }));
    }, intervalMs);
    return () => clearInterval(timer);
  }, []);

  const tiers = BONUS_JACKPOT_TIERS || DEFAULT_TIERS;

  const formatJackpotValue = (baseMult, tickAdd) => {
    if (currencyMode === 'SC') {
      const val = currentBet * baseMult + tickAdd;
      return `$${SC_FORMATTER.format(val)}`;
    }
    const val = Math.round(currentBet * baseMult + tickAdd * 100);
    return `${GC_FORMATTER.format(val)} GC`;
  };

  return (
    <div className={`jackpot-marquee-bar ${isSpinning ? 'spinning' : ''} ${hasWin ? 'winning' : ''}`}>
      <div className="jackpot-marquee-glass-back" />
      <div className="jackpot-marquee-items">
        {tiers.map((tier) => {
          const tickVal = ticks[tier.id] || 0;
          const cleanName = tier.label
            .replace(' RUBY CROWN', '')
            .replace(' AMETHYST', '')
            .replace(' SAPPHIRE', '')
            .replace(' EMERALD', '');
          return (
            <div
              key={tier.id}
              className={`jackpot-tier-card tier-${tier.id}`}
              style={{ '--tier-color': tier.color, '--tier-highlight': tier.gemHighlight }}
            >
              <div className="jackpot-gem-crest">
                <span className="gem-dot" />
              </div>
              <div className="jackpot-content">
                <span className="jackpot-tier-name">{cleanName}</span>
                <span className="jackpot-tier-amount" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatJackpotValue(tier.baseMultiplier, tickVal)}
                </span>
              </div>
              <div className="jackpot-shimmer-sweep" />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default JackpotMarqueeBar;
