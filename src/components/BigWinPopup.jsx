import React, { useEffect, useState } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import NeonKeyedImage from './NeonKeyedImage';
import { CASINO_BRAND, THEME_COPY } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

export default function BigWinPopup({ winCoins, coinValue, onClose }) {
  const [displayCoins, setDisplayCoins] = useState(0);

  useEffect(() => {
    if (!winCoins || winCoins <= 0) return;
    let frameId;
    const duration = 2200;
    const start = performance.now();
    let lastTick = 0;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(winCoins * eased);
      setDisplayCoins(current);

      if (now - lastTick > 75 && progress < 1) {
        soundEngine.playCoinTick();
        lastTick = now;
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [winCoins]);

  if (!winCoins || winCoins <= 0) return null;

  const cashValue = (displayCoins * coinValue).toFixed(2);

  return (
    <div className="bigwin-overlay" onClick={onClose}>
      <img
        src="/assets/psd/fx_rays.png"
        alt=""
        className="bigwin-fx-rays neon-fx-shift"
        draggable={false}
      />
      <img
        src="/assets/psd/fx_pattern.png"
        alt=""
        className="bigwin-fx-pattern neon-fx-shift"
        draggable={false}
      />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="bigwin-fx-sparks neon-fx-shift"
        draggable={false}
      />

      <div className="bigwin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bigwin-casino-ribbon">{THEME_COPY.bigWinRibbon}</div>

        <div className="bigwin-neon-banner-wrap">
          <NeonKeyedImage
            src={CASINO_BRAND.megaWinNeonImage}
            alt="MEGA WIN"
            className="bigwin-neon-mega-img"
            threshold={25}
            feather={45}
          />
        </div>

        <div className="bigwin-numbers-stage">
          <div className="neon-psd-digits">
            <PsdGoldNumber value={displayCoins} height={90} gap={-5} />
          </div>
          <div className="bigwin-cash-sub">
            COINS WON • CASH VALUE: <span>${cashValue}</span>
          </div>
        </div>

        <button className="bigwin-collect-btn" onClick={onClose}>
          {THEME_COPY.bigWinCollectButton}
        </button>
      </div>
    </div>
  );
}
