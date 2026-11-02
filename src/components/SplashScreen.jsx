import React, { useState, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Gift,
  ShieldCheck,
  Loader2,
  Crown,
  Zap,
  Flame,
  Star,
  Coins,
} from 'lucide-react';
import { THEME_ASSETS, SPLASH_CONFIG } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import { assetPreloader } from '../services/assetPreloader';

export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);
  const [preloadState, setPreloadState] = useState(() => assetPreloader.getState());
  const [jackpot, setJackpot] = useState(SPLASH_CONFIG.liveJackpotBase || 1254890.0);

  useEffect(() => {
    const unsubscribe = assetPreloader.subscribe((state) => {
      setPreloadState(state);
    });
    return unsubscribe;
  }, []);

  // Blueprint Pillar 2: Live Progressive Jackpot Real-Time Ticker
  useEffect(() => {
    const tickerInterval = setInterval(() => {
      setJackpot((prev) => prev + (Math.random() * 0.85 + 0.15));
    }, 70);
    return () => clearInterval(tickerInterval);
  }, []);

  const isReady = preloadState.isComplete;

  const handleEnter = () => {
    // Prevent entry until 100% of critical assets are loaded
    if (!isReady) return;

    // 1. Request true browser fullscreen on the direct user gesture (hiding Chrome/Android address bar and tabs)
    try {
      const docEl = document.documentElement;
      const requestFs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;
      if (requestFs && !document.fullscreenElement) {
        requestFs.call(docEl).catch(() => {});
      }
    } catch {}

    // 2. Trigger scroll to collapse mobile browser address bar (Safari iOS / mobile Chrome)
    try {
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 0), 50);
    } catch {}

    soundEngine.init();
    soundEngine.playWin(true);
    setExiting(true);
    setTimeout(() => {
      onEnterCasino();
    }, 650);
  };

  const heroImageUrl =
    THEME_ASSETS.splashHeroImage ||
    '/assets/neon/dc_enterprises_splash_hd.webp';
  const heroFallbackUrl =
    THEME_ASSETS.splashHeroFallback ||
    '/assets/neon/dc_enterprises_splash_hd.jpg';

  const formattedJackpot = jackpot.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}
      onClick={isReady ? handleEnter : undefined}
      role="button"
      tabIndex={0}
      aria-label={isReady ? 'Click anywhere or press Space to claim bonus and enter casino' : 'Loading assets, please wait'}
      onKeyDown={(e) => {
        if (isReady && (e.key === 'Enter' || e.key === ' ')) handleEnter();
      }}
    >
      {/* Ambient Blurred Backdrop */}
      <div
        className="ad-splash-ambient-bg"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="ad-splash-laser-grid" />
      <img
        src={THEME_ASSETS.ambientSparksImage}
        alt=""
        className="splash-fx-sparks neon-fx-shift"
        draggable={false}
        loading="lazy"
        decoding="async"
      />

      {/* Hero Stage Container */}
      <div className="ad-hero-artwork-stage" onClick={(e) => e.stopPropagation()}>
        {/* ==============================================================
            PILLAR 1: VEGAS MARQUEE HOOK (Top 1.5 Seconds Authority) &
            PILLAR 2: LIVE PROGRESSIVE JACKPOT TICKER
            ============================================================== */}
        <header className="ad-marquee-hook-header">
          <div className="ad-marquee-top-bar">
            {/* Trust Seal & Star Rating */}
            <div className="ad-trust-seal">
              <div className="ad-stars-cluster" aria-label="5 Star Rating">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={11} fill="#ffd700" color="#ffd700" />
                ))}
              </div>
              <span className="ad-trust-text">4.9/5 RATED • 100% VERIFIED FAIR RNG</span>
            </div>

            {/* Illuminated Vegas Marquee Badge */}
            <div className="ad-marquee-center-badge">
              <Sparkles size={11} className="ad-badge-sparkle" />
              <span>{SPLASH_CONFIG.marqueeBadge}</span>
            </div>

            {/* Founder Credibility Badge */}
            <div className="ad-founder-credibility-tag">
              <Crown size={12} color="#ffd700" />
              <span>{SPLASH_CONFIG.topLeftTitle}</span>
            </div>
          </div>

          <div className="ad-brand-marquee-row">
            {/* Brand Authority Hook */}
            <div className="ad-brand-title-wrap">
              <h1 className="ad-brand-title">{SPLASH_CONFIG.brandTitle}</h1>
              <div className="ad-brand-sub-deck">
                <span className="ad-deck-accent">CROWNS OF KEMET</span>
                <span className="ad-deck-dot">•</span>
                <span className="ad-deck-text">WORLD PREMIERE SLOT EVENT</span>
              </div>
            </div>

            {/* Live Progressive Jackpot Counter Ticker */}
            <div className="ad-jackpot-ticker-pod" role="status" aria-live="polite">
              <div className="ad-jackpot-pod-header">
                <span className="ad-live-beacon">
                  <span className="ad-live-dot" /> LIVE
                </span>
                <span className="ad-jackpot-title">{SPLASH_CONFIG.liveJackpotLabel}</span>
              </div>
              <div className="ad-jackpot-digits-display">
                <span className="ad-jackpot-currency-symbol">$</span>
                <span className="ad-jackpot-amount">{formattedJackpot}</span>
              </div>
              <span className="ad-jackpot-subnote">TICKING PROGRESSIVE POOL • MUST DROP TODAY</span>
            </div>
          </div>
        </header>

        {/* Hero Artwork Stage — Clean & High-Impact */}
        <div className="ad-hero-image-wrapper">
          <picture className="ad-hero-picture">
            <source srcSet={heroImageUrl} type="image/webp" />
            <img
              src={heroFallbackUrl}
              alt="DC Enterprises Casino"
              className="ad-hero-artwork-img"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
            />
          </picture>
        </div>

        {/* ==============================================================
            PILLAR 3: STRUCTURED PROMOTIONAL OFFER STACK &
            PILLAR 4: HIGH-CONTRAST ACTION CTA
            ============================================================== */}
        <div className="ad-splash-bottom-deck">
          {/* PILLAR 3: Tangible VIP Founder's Reward Card */}
          <aside
            className="ad-vip-reward-card"
            onClick={isReady ? handleEnter : undefined}
            role="button"
            tabIndex={0}
            aria-label="VIP Founder's Welcome Reward Card"
          >
            <div className="ad-reward-card-top">
              <div className="ad-reward-pill-header">
                <Gift size={13} className="reward-gift-icon" />
                <span>VIP FOUNDER'S REWARD PASS</span>
              </div>
              <span className="ad-instant-unlock-badge">INSTANT CLAIM</span>
            </div>

            <div className="ad-reward-metric-row">
              <span className="ad-reward-bonus-callout">GET</span>
              <span className="ad-reward-big-amount">250,000</span>
              <span className="ad-reward-units">FREE COINS</span>
            </div>

            <div className="ad-perk-pills-cluster">
              <span className="ad-perk-chip">
                <Zap size={11} className="chip-icon-zap" /> 15 LASER PAYLINES
              </span>
              <span className="ad-perk-chip">
                <Flame size={11} className="chip-icon-flame" /> 100× EXPANDING WILDS
              </span>
              <span className="ad-perk-chip">
                <Sparkles size={11} className="chip-icon-sparkle" /> DAILY WHEEL SPINS
              </span>
              <span className="ad-perk-chip">
                <ShieldCheck size={11} className="chip-icon-shield" /> 90.0% CERTIFIED RTP
              </span>
            </div>
          </aside>

          {/* PILLAR 4: High-Contrast Action CTA with Asset Preloader */}
          <div className="ad-hero-cta-bar">
            {/* Visual Gold & Sapphire Preloader Track */}
            <div className={`splash-preloader-panel ${isReady ? 'preloader-ready' : 'preloader-loading'}`}>
              <div className="splash-preloader-header">
                <span className="splash-preloader-stage">
                  {!isReady ? (
                    <>
                      <Loader2 size={13} className="preloader-spinner-icon" />
                      {preloadState.stage}
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="preloader-sparkle-gold" />
                      ALL 3D GRAPHICS LOADED
                    </>
                  )}
                </span>
                <span className="splash-preloader-pct">{preloadState.percent}%</span>
              </div>
              <div
                className="splash-preloader-track"
                role="progressbar"
                aria-valuenow={preloadState.percent}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className="splash-preloader-fill"
                  style={{ width: `${preloadState.percent}%` }}
                >
                  <div className="splash-preloader-shimmer" />
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              className={`ad-enter-casino-btn ${isReady ? 'ready-pulse' : 'loading-locked'}`}
              onClick={isReady ? handleEnter : undefined}
              disabled={!isReady}
              autoFocus={isReady}
              aria-label={isReady ? 'Claim 250,000 Free Coins & Play Now' : `Loading Game Assets (${preloadState.percent}%)`}
            >
              <span className="cta-shimmer-layer" />
              {isReady ? (
                <>
                  <Coins size={22} className="cta-coins-icon" />
                  <span className="cta-enter-text">CLAIM 250,000 FREE COINS & PLAY NOW</span>
                  <div className="cta-play-badge">
                    <Play size={18} fill="#090114" color="#090114" />
                  </div>
                </>
              ) : (
                <>
                  <Loader2 size={20} className="cta-loading-spinner" />
                  <span className="cta-enter-text">PRE-CACHING 3D ASSETS... {preloadState.percent}%</span>
                </>
              )}
            </button>

            {/* Sub-caption & Tap Hint */}
            <div className="cta-captions-group">
              <span className="cta-subcaption-text">
                INSTANT ACCESS • NO DEPOSIT REQUIRED • AUDIO ON
              </span>
              <span className="cta-tap-hint">
                {isReady ? 'TAP ANYWHERE OR PRESS SPACEBAR TO ENTER' : 'PRE-CACHING 3D RELIC REELS FOR ZERO JANK'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
