import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Play,
  Crown,
  Zap,
  Gem,
  Star,
  ShieldCheck,
  Award,
  Flame,
  Eye,
} from 'lucide-react';
import { CASINO_BRAND, THEME_ASSETS, SPLASH_CONFIG } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import NeonKeyedImage from './NeonKeyedImage';

export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);
  const [artMode, setArtMode] = useState('creative'); // 'creative' | 'original'
  const [liveJackpot, setLiveJackpot] = useState(12584920);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJackpot((prev) => prev + Math.floor(Math.random() * 485) + 120);
    }, 350);
    return () => clearInterval(interval);
  }, []);

  const handleEnter = () => {
    soundEngine.init();
    soundEngine.playWin(true);
    setExiting(true);
    setTimeout(() => {
      onEnterCasino();
    }, 650);
  };

  const heroImageUrl =
    artMode === 'creative'
      ? THEME_ASSETS.splashCreativeImage
      : THEME_ASSETS.splashOriginalImage;

  return (
    <div className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}>
      {/* PLANE 0: Ambient Blurred Backdrop & PSD Sparks */}
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

      {/* PLANE 1: Main Widescreen Casino Ad Billboard Showcase */}
      <div className="ad-billboard-stage">
        {/* TOP MARQUEE BAR */}
        <header className="ad-marquee-header">
          <div className="ad-trust-badge">
            <div className="ad-stars-row">
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
            </div>
            <span>{SPLASH_CONFIG.marqueeBadge}</span>
          </div>

          {/* Center Brand Logo */}
          <div className="ad-header-logo-center">
            <NeonKeyedImage
              src={CASINO_BRAND.logoImage}
              alt={CASINO_BRAND.casinoName}
              className="ad-header-dc-logo"
              threshold={26}
              feather={48}
            />
          </div>

          {/* Live Progressive Grand Jackpot Ticker */}
          <div className="ad-live-jackpot-pill">
            <span className="jackpot-pill-label">
              <Flame size={13} /> {SPLASH_CONFIG.liveJackpotLabel}
            </span>
            <span className="jackpot-pill-value">
              ${liveJackpot.toLocaleString()}
            </span>
          </div>
        </header>

        {/* PLANE 2: Center Hero Portrait Frame */}
        <div className="ad-hero-visual-viewport">
          <img
            src={heroImageUrl}
            alt={`${CASINO_BRAND.creatorName} — ${CASINO_BRAND.casinoFullTitle}`}
            className={`ad-hero-main-img ${
              artMode === 'original' ? 'mode-original-contain' : 'mode-creative-cover'
            }`}
            draggable={false}
          />

          {/* Top-Left Floating Ad Campaign Tag */}
          <div className="ad-floating-corner-tag top-left">
            <Crown size={15} className="tag-icon-gold" />
            <div>
              <div className="tag-tiny-kicker">{SPLASH_CONFIG.topLeftKicker}</div>
              <div className="tag-main-title">{SPLASH_CONFIG.topLeftTitle}</div>
            </div>
          </div>

          {/* Top-Right Photo Mode Switcher */}
          <button
            type="button"
            className="ad-art-mode-toggle"
            onClick={() => setArtMode((m) => (m === 'creative' ? 'original' : 'creative'))}
            title="Switch between Widescreen Key Art and Original Photo"
          >
            <Eye size={14} />
            <span>
              {artMode === 'creative'
                ? SPLASH_CONFIG.viewOriginalLabel
                : SPLASH_CONFIG.viewCreativeLabel}
            </span>
          </button>

          {/* Left & Right Flanking Ad Callout Cards */}
          <aside className="ad-side-callout left-callout">
            <div className="callout-badge-header">
              <Award size={15} /> {SPLASH_CONFIG.leftCalloutHeader}
            </div>
            <div className="callout-big-metric">{SPLASH_CONFIG.leftCalloutMetric}</div>
            <div className="callout-sub-label">{SPLASH_CONFIG.leftCalloutSub}</div>
            <div className="callout-fine-print">{SPLASH_CONFIG.leftCalloutFine}</div>
          </aside>

          <aside className="ad-side-callout right-callout">
            <div className="callout-badge-header">
              <Zap size={15} /> {SPLASH_CONFIG.rightCalloutHeader}
            </div>
            <div className="callout-big-metric">{SPLASH_CONFIG.rightCalloutMetric}</div>
            <div className="callout-sub-label">{SPLASH_CONFIG.rightCalloutSub}</div>
            <div className="callout-fine-print">{SPLASH_CONFIG.rightCalloutFine}</div>
          </aside>
        </div>

        {/* PLANE 3: Bottom High-Converting Promotional Offer & CTA Deck */}
        <footer className="ad-conversion-footer">
          <div className="ad-offer-copy-col">
            <div className="ad-Headline-eyebrow">
              <Sparkles size={14} /> {SPLASH_CONFIG.headlineEyebrow}
            </div>
            <h1 className="ad-main-campaign-title">
              {SPLASH_CONFIG.headlineMain} <span>{SPLASH_CONFIG.headlineAccent}</span>
            </h1>
            <div className="ad-feature-pills-row">
              <span className="ad-perk-pill">
                <Gem size={13} /> {SPLASH_CONFIG.perkPills?.[0]}
              </span>
              <span className="ad-perk-pill">
                <Zap size={13} /> {SPLASH_CONFIG.perkPills?.[1]}
              </span>
              <span className="ad-perk-pill">
                <ShieldCheck size={13} /> {SPLASH_CONFIG.perkPills?.[2]}
              </span>
            </div>
          </div>

          <div className="ad-cta-action-col">
            <button
              type="button"
              className="ad-mega-claim-cta"
              onClick={handleEnter}
            >
              <span className="cta-shimmer-layer" />
              <Play size={22} fill="currentColor" />
              <div className="cta-btn-text-stack">
                <span className="cta-primary-line">{SPLASH_CONFIG.ctaPrimary}</span>
                <span className="cta-secondary-line">{SPLASH_CONFIG.ctaSecondary}</span>
              </div>
              <Volume2 size={20} style={{ opacity: 0.92 }} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
