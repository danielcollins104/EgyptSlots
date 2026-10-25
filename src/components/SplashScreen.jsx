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
import { CASINO_BRAND } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import NeonKeyedImage from './NeonKeyedImage';

/**
 * Recreated From-Scratch Casino Ad Campaign & Creative Studio Splash Screen
 * Built with:
 *  - `creative-studio` (`creative-splash-director` skill): Multi-plane depth architecture,
 *    subject-aware safe zones keeping Daniel's portrait & treasure chest 100% unobstructed,
 *    and toggleable Original Photo vs. Vegas-Kemet Widescreen Creative Key Art.
 *  - `ad-campaign-studio` (`casino-ad-architect` skill): Vegas Marquee top billboard hook,
 *    live ticking Progressive Grand Jackpot counter, VIP Founder's Welcome Bonus Claim Card,
 *    5-star Verified Casino Authority seal, and high-converting shimmer CTA button.
 */
export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);
  // Allow toggling between the newly generated Widescreen Creative Key Art (from Daniel's photo)
  // and Daniel's exact Original Uncropped Treasure Chest Photo!
  const [artMode, setArtMode] = useState('creative'); // 'creative' | 'original'
  const [liveJackpot, setLiveJackpot] = useState(12584920);

  // Live ticking progressive jackpot counter (Ad Campaign Studio)
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
      ? '/assets/neon/daniel_creative_ad_splash.jpg'
      : '/assets/neon/daniel_welcome_treasure.jpg';

  return (
    <div className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}>
      {/* PLANE 0: Ambient Blurred Backdrop & PSD Sparks */}
      <div
        className="ad-splash-ambient-bg"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="ad-splash-laser-grid" />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="splash-fx-sparks neon-fx-shift"
        draggable={false}
      />

      {/* PLANE 1: Main Widescreen Casino Ad Billboard Showcase */}
      <div className="ad-billboard-stage">
        {/* TOP MARQUEE BAR (Vegas Ad Hook — Above Daniel's Head in the Sky Safe Zone) */}
        <header className="ad-marquee-header">
          <div className="ad-trust-badge">
            <div className="ad-stars-row">
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
              <Star size={13} fill="#ffea00" color="#ffea00" />
            </div>
            <span>#1 VIP LAS VEGAS • KEMET NEON RESORT</span>
          </div>

          {/* Center Winged "DC ENTERPRISES" Neon Logo */}
          <div className="ad-header-logo-center">
            <NeonKeyedImage
              src={CASINO_BRAND.logoImage}
              alt="DC ENTERPRISES"
              className="ad-header-dc-logo"
              threshold={26}
              feather={48}
            />
          </div>

          {/* Live Progressive Grand Jackpot Ticker */}
          <div className="ad-live-jackpot-pill">
            <span className="jackpot-pill-label">
              <Flame size={13} /> LIVE GRAND JACKPOT
            </span>
            <span className="jackpot-pill-value">
              ${liveJackpot.toLocaleString()}
            </span>
          </div>
        </header>

        {/* PLANE 2: Center Hero Portrait Frame (Daniel on the Glowing Treasure Chest) */}
        <div className="ad-hero-visual-viewport">
          <img
            src={heroImageUrl}
            alt="Daniel — Founder & Host of DC Enterprises Casino"
            className={`ad-hero-main-img ${artMode === 'original' ? 'mode-original-contain' : 'mode-creative-cover'}`}
            draggable={false}
          />

          {/* Top-Left Floating Ad Campaign Tag */}
          <div className="ad-floating-corner-tag top-left">
            <Crown size={15} className="tag-icon-gold" />
            <div>
              <div className="tag-tiny-kicker">OFFICIAL FOUNDER EDITION</div>
              <div className="tag-main-title">HOSTED BY DANIEL</div>
            </div>
          </div>

          {/* Top-Right Photo Mode Switcher (Creative Widescreen vs. Original Treasure Photo) */}
          <button
            type="button"
            className="ad-art-mode-toggle"
            onClick={() => setArtMode((m) => (m === 'creative' ? 'original' : 'creative'))}
            title="Switch between Widescreen Vegas Key Art and Original Photo"
          >
            <Eye size={14} />
            <span>
              {artMode === 'creative' ? 'VIEW ORIGINAL PHOTO' : 'VIEW VEGAS AD KEY ART'}
            </span>
          </button>

          {/* Left & Right Flanking Ad Callout Cards (Positioned safely to the sides of Daniel) */}
          <aside className="ad-side-callout left-callout">
            <div className="callout-badge-header">
              <Award size={15} /> VIP FOUNDER PERK
            </div>
            <div className="callout-big-metric">250,000</div>
            <div className="callout-sub-label">FREE VIP COINS</div>
            <div className="callout-fine-print">INSTANT SIGN-ON BONUS</div>
          </aside>

          <aside className="ad-side-callout right-callout">
            <div className="callout-badge-header">
              <Zap size={15} /> MEGA MULTIPLIERS
            </div>
            <div className="callout-big-metric">100X WILD</div>
            <div className="callout-sub-label">ANUBIS & BASTET</div>
            <div className="callout-fine-print">1×3 EXPANDING REELS</div>
          </aside>
        </div>

        {/* PLANE 3: Bottom High-Converting Promotional Offer & CTA Deck */}
        <footer className="ad-conversion-footer">
          <div className="ad-offer-copy-col">
            <div className="ad-Headline-eyebrow">
              <Sparkles size={14} /> DC ENTERPRISES CASINO • WORLD PREMIERE SLOT EVENT
            </div>
            <h1 className="ad-main-campaign-title">
              CROWNS OF KEMET: <span>DANIEL&apos;S NEON TREASURE</span>
            </h1>
            <div className="ad-feature-pills-row">
              <span className="ad-perk-pill">
                <Gem size={13} /> 250,000 FREE COINS INCLUDED
              </span>
              <span className="ad-perk-pill">
                <Zap size={13} /> 15 LASER PAYLINES
              </span>
              <span className="ad-perk-pill">
                <ShieldCheck size={13} /> GSAP PRO REEL PHYSICS
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
                <span className="cta-primary-line">CLAIM TREASURE &amp; PLAY NOW</span>
                <span className="cta-secondary-line">
                  ENTER DANIEL&apos;S VIP LOUNGE • 250,000 COINS READY
                </span>
              </div>
              <Volume2 size={20} style={{ opacity: 0.92 }} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
