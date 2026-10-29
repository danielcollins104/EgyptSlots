import React, { useState, useEffect } from 'react';
import { BONUS_JACKPOT_TIERS } from '../config/slotConfig';

/**
 * 2026 Progressive Jackpot Display Marquee:
 * Displays the 4-tier live progressive jackpot tickers (Grand, Major, Minor, Mini)
 * with animated ticking numbers, jeweled cabochon badges, and 24K gold beveled frames.
 */
export default function JackpotMarqueeBar({
  currencyMode = 'GC',
  currentBet = 15,
  isSpinning = false,
  hasWin = false,
}) {
  // Live micro-increment progressive offsets (adds authentic Vegas ticking heartbeat)
  const [ticks, setTicks] = useState({
    mini: 0,
    minor: 0,
    major: 0,
    grand: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTicks((prev) => ({
        mini: prev.mini + 0.015,
        minor: prev.minor + 0.035,
        major: prev.major + 0.08,
        grand: prev.grand + 0.22,
      }));
    }, 450);
    return () => clearInterval(timer);
  }, []);

  const tiers = BONUS_JACKPOT_TIERS || [
    { id: 'mini', label: 'MINI', baseMultiplier: 20, color: '#10b981', gemHighlight: '#6ee7b7' },
    { id: 'minor', label: 'MINOR', baseMultiplier: 50, color: '#38bdf8', gemHighlight: '#bae6fd' },
    { id: 'major', label: 'MAJOR', baseMultiplier: 150, color: '#c084fc', gemHighlight: '#f3e8ff' },
    { id: 'grand', label: 'GRAND', baseMultiplier: 500, color: '#f43f5e', gemHighlight: '#fecdd3' },
  ];

  const formatJackpotValue = (baseMult, tickAdd) => {
    if (currencyMode === 'SC') {
      const val = (currentBet * baseMult) + tickAdd;
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const val = Math.round((currentBet * baseMult) + tickAdd * 100);
      return `${val.toLocaleString()} GC`;
    }
  };

  return (
    <div className={`jackpot-marquee-bar ${isSpinning ? 'spinning' : ''} ${hasWin ? 'winning' : ''}`}>
      <div className="jackpot-marquee-glass-back" />
      <div className="jackpot-marquee-items">
        {tiers.map((tier) => {
          const tickVal = ticks[tier.id] || 0;
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
                <span className="jackpot-tier-name">{tier.label.replace(' RUBY CROWN', '').replace(' AMETHYST', '').replace(' SAPPHIRE', '').replace(' EMERALD', '')}</span>
                <span className="jackpot-tier-amount">{formatJackpotValue(tier.baseMultiplier, tickVal)}</span>
              </div>
              <div className="jackpot-shimmer-sweep" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
