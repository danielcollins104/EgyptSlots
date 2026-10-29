import React, { useState } from 'react';
import { Play, Sparkles, Gift, ShieldCheck } from 'lucide-react';
import { THEME_ASSETS, SPLASH_CONFIG } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);

  const handleEnter = () => {
    soundEngine.init();
    soundEngine.playWin(true);
    setExiting(true);
    setTimeout(() => {
      onEnterCasino();
    }, 650);
  };

  const heroImageUrl =
    THEME_ASSETS.splashHeroImage ||
    '/assets/neon/dc_enterprises_splash_hd.jpg';

  return (
    <div
      className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}
      onClick={handleEnter}
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to enter casino"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleEnter();
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
      />

      {/* Hero Artwork Stage — Clean & Unobstructed */}
      <div className="ad-hero-artwork-stage" onClick={(e) => e.stopPropagation()}>
        <div className="ad-hero-image-wrapper">
          <img
            src={heroImageUrl}
            alt="DC Enterprises Casino"
            className="ad-hero-artwork-img"
            draggable={false}
          />
        </div>

        {/* Bottom Promotional Deck: 1,000 Free Coins (Left) • ENTER CASINO (Center) • 90.0% RTP (Right) */}
        <div className="ad-splash-bottom-deck">
          <aside
            className="ad-side-callout left-callout"
            onClick={handleEnter}
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

          {/* Sleek Bottom Enter CTA */}
          <div className="ad-hero-cta-bar">
            <button
              type="button"
              className="ad-enter-casino-btn"
              onClick={handleEnter}
              autoFocus
              aria-label="Enter Casino"
            >
              <span className="cta-shimmer-layer" />
              <Sparkles size={20} className="cta-sparkle-icon" />
              <span className="cta-enter-text">ENTER CASINO</span>
              <div className="cta-play-badge">
                <Play size={18} fill="#090114" color="#090114" />
              </div>
            </button>
            <span className="cta-tap-hint">TAP ANYWHERE TO PLAY</span>
          </div>

          <aside
            className="ad-side-callout right-callout"
            onClick={handleEnter}
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
        </div>
      </div>
    </div>
  );
}
