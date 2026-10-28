import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Crown,
  Zap,
  Gem,
  Star,
  ShieldCheck,
  Award,
  Flame,
  Eye,
  Film,
  Upload,
} from 'lucide-react';
import { CASINO_BRAND, THEME_ASSETS, SPLASH_CONFIG } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import DcLogoPlaque from './DcLogoPlaque';

export default function SplashScreen({ onEnterCasino }) {
  const [exiting, setExiting] = useState(false);
  const [artMode, setArtMode] = useState('creative'); // 'video' | 'creative' | 'original'
  const [liveJackpot, setLiveJackpot] = useState(12584920);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJackpot((prev) => prev + Math.floor(Math.random() * 485) + 120);
    }, 350);
    return () => clearInterval(interval);
  }, []);

  // Check if a bundled splash video is available in public assets
  useEffect(() => {
    if (THEME_ASSETS.splashVideo) {
      fetch(THEME_ASSETS.splashVideo, { method: 'HEAD' })
        .then((res) => {
          if (res.ok && res.status !== 404) {
            setVideoAvailable(true);
            setArtMode('video');
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleEnter = () => {
    soundEngine.init();
    soundEngine.playWin(true);
    setExiting(true);
    setTimeout(() => {
      onEnterCasino();
    }, 650);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogg|mov)$/i.test(file.name)) {
        setUploadFeedback('Please select a valid video file (.mp4, .webm, or .mov)');
        setTimeout(() => setUploadFeedback(''), 4500);
        return;
      }
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setArtMode('video');
      setUploadFeedback(`Playing Video: ${file.name}`);
      setTimeout(() => setUploadFeedback(''), 4000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogg|mov)$/i.test(file.name)) {
        setUploadFeedback('Please drop a valid video file (.mp4, .webm, or .mov)');
        setTimeout(() => setUploadFeedback(''), 4500);
        return;
      }
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setArtMode('video');
      setUploadFeedback(`Playing Video: ${file.name}`);
      setTimeout(() => setUploadFeedback(''), 4000);
    }
  };

  const activeVideoUrl = customVideoUrl || (videoAvailable ? THEME_ASSETS.splashVideo : null);

  const handleToggleMode = () => {
    if (artMode === 'video') {
      setArtMode('creative');
    } else if (artMode === 'creative') {
      setArtMode('original');
    } else {
      if (activeVideoUrl) {
        setArtMode('video');
      } else {
        setArtMode('creative');
      }
    }
  };

  const heroImageUrl =
    artMode === 'creative'
      ? THEME_ASSETS.splashCreativeImage
      : THEME_ASSETS.splashOriginalImage;

  return (
    <div className={`ad-creative-splash-root ${exiting ? 'splash-exit' : ''}`}>
      {/* PLANE 0: Ambient Blurred Backdrop & PSD Sparks */}
      {artMode === 'video' && activeVideoUrl ? (
        <video
          src={activeVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="ad-splash-ambient-video"
        />
      ) : (
        <div
          className="ad-splash-ambient-bg"
          style={{ backgroundImage: `url('${heroImageUrl}')` }}
        />
      )}
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
            <DcLogoPlaque className="ad-header-dc-logo" />
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

        {/* PLANE 2: Center Hero Portrait / Video Frame */}
        <div
          className={`ad-hero-visual-viewport ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {artMode === 'video' && activeVideoUrl ? (
            <video
              ref={videoRef}
              src={activeVideoUrl}
              autoPlay
              loop
              muted={isVideoMuted}
              playsInline
              className="ad-hero-main-video"
            />
          ) : (
            <img
              src={heroImageUrl}
              alt={`${CASINO_BRAND.creatorName} — ${CASINO_BRAND.casinoFullTitle}`}
              className={`ad-hero-main-img ${
                artMode === 'original' ? 'mode-original-contain' : 'mode-creative-cover'
              }`}
              draggable={false}
            />
          )}

          {/* Hidden File Input for Video Picker */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Top-Left Floating Ad Campaign Tag */}
          <div className="ad-floating-corner-tag top-left">
            <Crown size={15} className="tag-icon-gold" />
            <div>
              <div className="tag-tiny-kicker">{SPLASH_CONFIG.topLeftKicker}</div>
              <div className="tag-main-title">{SPLASH_CONFIG.topLeftTitle}</div>
            </div>
          </div>

          {/* Top-Right Media Controls Group */}
          <div className="ad-art-controls-group">
            {/* If in video mode, toggle Mute/Unmute */}
            {artMode === 'video' && activeVideoUrl && (
              <button
                type="button"
                className="ad-art-mode-toggle ad-video-mute-toggle"
                onClick={() => setIsVideoMuted((m) => !m)}
                title={isVideoMuted ? 'Unmute Video Audio' : 'Mute Video Audio'}
              >
                {isVideoMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isVideoMuted ? 'Unmute' : 'Muted'}</span>
              </button>
            )}

            {/* Video File Selector / Add Video Button */}
            <button
              type="button"
              className="ad-art-mode-toggle ad-upload-video-toggle"
              onClick={() => fileInputRef.current?.click()}
              title="Select an MP4/WebM video file from your computer"
            >
              <Upload size={14} />
              <span>{customVideoUrl ? 'Change Video' : 'Add Video'}</span>
            </button>

            {/* Media Mode Toggle Button */}
            <button
              type="button"
              className="ad-art-mode-toggle"
              onClick={handleToggleMode}
              title="Switch between Video, Widescreen Key Art, and Original Photo"
            >
              {artMode === 'video' ? <Film size={14} /> : <Eye size={14} />}
              <span>
                {artMode === 'video'
                  ? 'Key Art'
                  : artMode === 'creative'
                  ? SPLASH_CONFIG.viewOriginalLabel
                  : activeVideoUrl
                  ? 'Play Video'
                  : 'Creative Art'}
              </span>
            </button>
          </div>

          {/* Upload / Drag Feedback Toast */}
          {uploadFeedback && (
            <div className="ad-upload-feedback-toast">
              <Film size={13} /> {uploadFeedback}
            </div>
          )}

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
