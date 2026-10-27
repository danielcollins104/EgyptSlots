import React, { useEffect, useState } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { CASINO_BRAND, THEME_COPY } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

export default function BigWinPopup({
  winCoins,
  coinValue = 1.0,
  currencyMode = 'GC',
  onClose,
}) {
  const [displayCoins, setDisplayCoins] = useState(0);

  useEffect(() => {
    if (!winCoins || winCoins <= 0) return;
    let frameId;
    const duration = 2100;
    const start = performance.now();
    let lastRenderedVal = -1;
    let lastTickTime = 0;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Silky smooth quintic ease-out curve for authentic casino roll-up
      const eased = 1 - Math.pow(1 - progress, 4);

      const current =
        currencyMode === 'SC'
          ? Number((winCoins * eased).toFixed(2))
          : Math.round(winCoins * eased);

      // Only update DOM state when the display value actually advances
      if (current !== lastRenderedVal) {
        lastRenderedVal = current;
        setDisplayCoins(current);
      }

      // Play audio ticks decoupled from render cycle to prevent micro-stutter
      if (now - lastTickTime > 80 && progress < 0.98) {
        lastTickTime = now;
        try {
          soundEngine.playCoinTick();
        } catch (_) {}
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayCoins(currencyMode === 'SC' ? Number(winCoins.toFixed(2)) : winCoins);
        try {
          soundEngine.playWin(true);
        } catch (_) {}
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [winCoins, currencyMode]);

  if (!winCoins || winCoins <= 0) return null;

  const isSC = currencyMode === 'SC';
  const cashValue = isSC ? Number(displayCoins).toFixed(2) : (displayCoins * coinValue).toFixed(2);

  return (
    <div className="bigwin-overlay" onClick={onClose}>
      <img
        src="/assets/psd/fx_rays.png"
        alt=""
        className="bigwin-fx-rays"
        draggable={false}
      />
      <img
        src="/assets/psd/fx_pattern.png"
        alt=""
        className="bigwin-fx-pattern"
        draggable={false}
      />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="bigwin-fx-sparks"
        draggable={false}
      />

      <div className="bigwin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bigwin-casino-ribbon">
          <span className="ribbon-star">★</span>
          <span>{THEME_COPY.bigWinRibbon}</span>
          <span className="ribbon-star">★</span>
        </div>

        <div className="bigwin-neon-banner-wrap">
          <img
            src={CASINO_BRAND.megaWinNeonImage}
            alt="MEGA WIN"
            className="bigwin-neon-mega-img"
            draggable={false}
          />
        </div>

        <div className="bigwin-numbers-stage">
          <div className="neon-psd-digits">
            <PsdGoldNumber value={displayCoins} height={92} gap={-5} />
          </div>
          <div className="bigwin-cash-sub">
            {isSC ? 'SWEEPS COINS WON • REAL CASH PRIZE: ' : 'GOLD COINS WON • SOCIAL VALUE: '}
            <span className="bigwin-cash-highlight">${cashValue}{isSC ? ' USD' : ''}</span>
          </div>
        </div>

        <button
          className="bigwin-collect-btn"
          onClick={() => {
            soundEngine.playButtonClick(640);
            onClose();
          }}
        >
          {THEME_COPY.bigWinCollectButton}
        </button>
      </div>
    </div>
  );
}
