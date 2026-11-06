import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Sparkles, Gift, ShieldCheck, Loader2 } from 'lucide-react';
import { THEME_ASSETS, SPLASH_CONFIG } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import { assetPreloader } from '../services/assetPreloader';

export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);
  const [preloadState, setPreloadState] = useState(() => assetPreloader.getState());

  useEffect(() => {
    const unsubscribe = assetPreloader.subscribe((state) => {
      setPreloadState(state);
    });
    return unsubscribe;
  }, []);

  const isReady = preloadState.isComplete;

  const handleEnter = useCallback(() => {
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
  }, [isReady, onEnterCasino]);

  // Synchronize with persistent Frame-0 #preboot-splash shell so the LCP <img> node
  // painted by the HTML parser is never destroyed or re-decoded during React hydration.
  const prebootSplash = typeof document !== 'undefined' ? document.getElementById('preboot-splash') : null;
  const prebootDeck = typeof document !== 'undefined' ? document.getElementById('preboot-splash-deck') : null;

  useEffect(() => {
    if (!prebootSplash) return undefined;
    prebootSplash.style.display = '';
    prebootSplash.setAttribute('role', 'button');
    prebootSplash.setAttribute('tabindex', '0');

    return () => {
      prebootSplash.classList.remove('splash-exit');
      prebootSplash.style.display = 'none';
    };
  }, [prebootSplash]);

  useEffect(() => {
    if (!prebootSplash) return undefined;
    if (exiting) {
      prebootSplash.classList.add('splash-exit');
    } else {
      prebootSplash.classList.remove('splash-exit');
    }
    prebootSplash.setAttribute(
      'aria-label',
      isReady ? 'Click anywhere to enter casino' : 'Loading assets, please wait'
    );

    const onSplashClick = (e) => {
      if (!isReady) return;
      const stage = prebootSplash.querySelector('.ad-hero-artwork-stage');
      if (stage && e.target === stage) return;
      handleEnter();
    };
    const onSplashKeyDown = (e) => {
      if (isReady && (e.key === 'Enter' || e.key === ' ')) {
        handleEnter();
      }
    };

    prebootSplash.addEventListener('click', onSplashClick);
    prebootSplash.addEventListener('keydown', onSplashKeyDown);
    return () => {
      prebootSplash.removeEventListener('click', onSplashClick);
      prebootSplash.removeEventListener('keydown', onSplashKeyDown);
    };
  }, [prebootSplash, exiting, isReady, handleEnter]);

  // Clear static preboot deck placeholders before React portals interactive controls into it
  useEffect(() => {
    if (!prebootDeck) return;
    Array.from(prebootDeck.children).forEach((child) => {
      if (!child.hasAttribute('data-react-splash-deck')) {
        child.style.display = 'none';
      }
    });
  }, [prebootDeck]);

  const heroImageUrl =
    THEME_ASSETS.splashHeroImage ||
    '/assets/neon/dc_enterprises_splash_hd.webp';
  const heroFallbackUrl =
    THEME_ASSETS.splashHeroFallback ||
    '/assets/neon/dc_enterprises_splash_hd.jpg';

  const deckContent = (
    <>
      <aside
        data-react-splash-deck="true"
        className="ad-side-callout left-callout"
        onClick={isReady ? handleEnter : undefined}
        role="button"
        tabIndex={0}
        aria-label="Welcome Bonus Perk"
      >
        <div className="callout-badge-header">
          <Gift size={13} /> {SPLASH_CONFIG.leftCalloutHeader}
        </div>
        <div className="callout-big-metric">{SPLASH_CONFIG.leftCalloutMetric}</div>
        <div className="callout-sub-label">{SPLASH_CONFIG.leftCalloutSub}</div>
        <div className="callout-fine-print">{SPLASH_CONFIG.leftCalloutFine}</div>
      </aside>

      {/* Sleek Bottom Enter CTA with Integrated Asset Loading Progress */}
      <div data-react-splash-deck="true" className="ad-hero-cta-bar">
        {/* Visual Gold & Sapphire Progress Bar */}
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
                  ALL 3D ASSETS LOADED
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

        <button
          type="button"
          className={`ad-enter-casino-btn ${isReady ? 'ready-pulse' : 'loading-locked'}`}
          onClick={isReady ? handleEnter : undefined}
          disabled={!isReady}
          autoFocus={isReady}
          aria-label={isReady ? 'Enter Casino' : `Loading Game Assets (${preloadState.percent}%)`}
        >
          <span className="cta-shimmer-layer" />
          {isReady ? (
            <>
              <Sparkles size={20} className="cta-sparkle-icon" />
              <span className="cta-enter-text">ENTER CASINO</span>
              <div className="cta-play-badge">
                <Play size={18} fill="#090114" color="#090114" />
              </div>
            </>
          ) : (
            <>
              <Loader2 size={20} className="cta-loading-spinner" />
              <span className="cta-enter-text">LOADING... {preloadState.percent}%</span>
            </>
          )}
        </button>
        <span className="cta-tap-hint">
          {isReady ? 'TAP ANYWHERE TO PLAY' : 'PRE-CACHING 3D RELIC REELS FOR INSTANT SPINS'}
        </span>
      </div>

      <aside
        data-react-splash-deck="true"
        className="ad-side-callout right-callout"
        onClick={isReady ? handleEnter : undefined}
        role="button"
        tabIndex={0}
        aria-label="Certified RTP Perk"
      >
        <div className="callout-badge-header">
          <ShieldCheck size={13} /> {SPLASH_CONFIG.rightCalloutHeader}
        </div>
        <div className="callout-big-metric">{SPLASH_CONFIG.rightCalloutMetric}</div>
        <div className="callout-sub-label">{SPLASH_CONFIG.rightCalloutSub}</div>
        <div className="callout-fine-print">{SPLASH_CONFIG.rightCalloutFine}</div>
      </aside>
    </>
  );

  if (prebootSplash && prebootDeck) {
    return createPortal(deckContent, prebootDeck);
  }

  return (
    <div
      className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}
      onClick={isReady ? handleEnter : undefined}
      role="button"
      tabIndex={0}
      aria-label={isReady ? 'Click anywhere to enter casino' : 'Loading assets, please wait'}
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
        ref={(el) => {
          if (el) el.setAttribute('fetchpriority', 'low');
        }}
        src={THEME_ASSETS.ambientSparksImage}
        alt=""
        className="splash-fx-sparks neon-fx-shift"
        draggable={false}
        loading="eager"
        fetchPriority="low"
        decoding="async"
      />

      {/* Hero Artwork Stage — Clean & Unobstructed */}
      <div className="ad-hero-artwork-stage" onClick={(e) => e.stopPropagation()}>
        <div className="ad-hero-image-wrapper">
          <picture className="ad-hero-picture">
            <source srcSet={heroImageUrl} type="image/webp" />
            <img
              ref={(el) => {
                if (el) el.setAttribute('fetchpriority', 'high');
              }}
              src={heroFallbackUrl}
              alt="DC Enterprises Casino"
              className="ad-hero-artwork-img"
              width="1024"
              height="576"
              loading="eager"
              fetchPriority="high"
              decoding="sync"
              draggable={false}
            />
          </picture>
        </div>

        {/* Bottom Promotional Deck: Welcome Bonus (Left) • ENTER CASINO (Center) • 90.0% RTP (Right) */}
        <div className="ad-splash-bottom-deck">
          {deckContent}
        </div>
      </div>
    </div>
  );
}
