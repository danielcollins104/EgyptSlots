import React, { useEffect, useState } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import NeonKeyedImage from './NeonKeyedImage';
import { CASINO_BRAND } from '../config/slotConfig';
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
      {/* Psychedelic Neon PSD FX Rays, Pattern, and Sparks */}
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
        {/* DC Enterprises Casino Badge */}
        <div className="bigwin-casino-ribbon">
          DC ENTERPRISES CASINO • DANIEL PSYCHEDELIC NEON JACKPOT
        </div>

        {/* AI-Generated Psychedelic Neon MEGA WIN Banner */}
        <div className="bigwin-neon-banner-wrap">
          <NeonKeyedImage
            src={CASINO_BRAND.megaWinNeonImage}
            alt="MEGA WIN"
            className="bigwin-neon-mega-img"
            threshold={25}
            feather={45}
          />
        </div>

        {/* PSD Layers 395-418: 3D Engraved Numbers in Psychedelic Neon */}
        <div className="bigwin-numbers-stage">
          <div className="neon-psd-digits">
            <PsdGoldNumber value={displayCoins} height={90} gap={-5} />
          </div>
          <div className="bigwin-cash-sub">
            COINS WON • CASH VALUE: <span>${cashValue}</span>
          </div>
        </div>

        <button className="bigwin-collect-btn" onClick={onClose}>
          COLLECT NEON WINNINGS
        </button>
      </div>
    </div>
  );
}
