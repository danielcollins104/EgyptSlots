import React, { useEffect, useState, useRef } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { CASINO_BRAND, THEME_ASSETS, THEME_COPY } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import { Volume2, VolumeX } from 'lucide-react';

export default function BigWinPopup({
  winCoins,
  coinValue = 1.0,
  currencyMode = 'GC',
  onClose,
}) {
  const [displayCoins, setDisplayCoins] = useState(0);
  const [videoMuted, setVideoMuted] = useState(soundEngine.muted);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!winCoins || winCoins <= 0) return;
    try {
      soundEngine.playWin(true);
    } catch (_) {}

    // Video playback handling with autoplay resilience
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = soundEngine.muted;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser restricts unmuted autoplay, mute and resume
          if (videoRef.current) {
            videoRef.current.muted = true;
            setVideoMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }

    let frameId;
    const duration = 2400;
    const start = performance.now();
    let lastRenderedVal = -1;
    let lastTickTime = 0;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Quintic ease-out curve for authentic casino roll-up
      const eased = 1 - Math.pow(1 - progress, 4);

      const current =
        currencyMode === 'SC'
          ? Number((winCoins * eased).toFixed(2))
          : Math.round(winCoins * eased);

      if (current !== lastRenderedVal) {
        lastRenderedVal = current;
        setDisplayCoins(current);
        if (now - lastTickTime > 45) {
          lastTickTime = now;
          soundEngine.playCoinTick(progress);
        }
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setDisplayCoins(currencyMode === 'SC' ? Number(winCoins.toFixed(2)) : winCoins);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [winCoins, currencyMode]);

  const toggleVideoAudio = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setVideoMuted(nextMuted);
    }
  };

  if (!winCoins || winCoins <= 0) return null;

  const isSC = currencyMode === 'SC';
  const cashValue = isSC ? Number(displayCoins).toFixed(2) : (displayCoins * coinValue).toFixed(2);
  const megaWinVideoSrc =
    THEME_ASSETS.megaWinVideo ||
    CASINO_BRAND.megaWinVideo ||
    '/assets/neon/mega_win_animation.mp4';

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

        {/* Centerpiece Mega Win Video Animation Showcase */}
        <div className="bigwin-video-banner-frame">
          <video
            ref={videoRef}
            src={megaWinVideoSrc}
            autoPlay
            loop
            playsInline
            className="bigwin-animated-video"
          />
          <button
            className="bigwin-video-sound-toggle"
            onClick={toggleVideoAudio}
            aria-label={videoMuted ? 'Unmute Mega Win sound' : 'Mute Mega Win sound'}
            title={videoMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {videoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        <div className="bigwin-numbers-stage">
          <div className="neon-psd-digits">
            <PsdGoldNumber value={displayCoins} height={82} gap={-4} />
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
