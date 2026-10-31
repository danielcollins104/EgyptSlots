import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Flame, Sparkles, Trophy, Gem, ShieldAlert, Award, RotateCw } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import PsdGoldNumber from './PsdGoldNumber';

/**
 * WRATH OF THE GODS: CELESTIAL OVERLOAD BONUS ROUND
 * An electrifying, high-impact bonus round unlocked when Anubis & Bastet
 * reach Apex Overcharge and strike the winning combination with lightning and cosmic fire!
 */
export default function CelestialOverloadBonusModal({
  isOpen,
  currentBet = 15,
  currencyMode = 'GC',
  onComplete,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // 6 Celestial Altars
  const [altars, setAltars] = useState([]);
  const [picksRemaining, setPicksRemaining] = useState(4);
  const [totalWinCoins, setTotalWinCoins] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [activeStrikeEffect, setActiveStrikeEffect] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(
    '⚡ HARNESS THE DIVINE TEMPEST! CHOOSE A SACRED CELESTIAL ALTAR TO UNLEASH LIGHTNING & SOLAR FIRE!'
  );

  // Initialize or reset bonus round
  useEffect(() => {
    if (!isOpen) return;

    const baseBet = Math.max(1, currentBet);
    const altarTemplates = [
      { id: 0, name: 'Eye of Ra', element: 'solar', mult: 10, bonusMult: 2, icon: '🔥', title: 'Solar Flare Altar' },
      { id: 1, name: 'Anubis Scepter', element: 'lightning', mult: 15, bonusMult: 3, icon: '⚡', title: 'Thunderbolt Altar' },
      { id: 2, name: 'Scarab of Eternity', element: 'solar', mult: 25, bonusMult: 4, icon: '🌟', title: 'Sunfire Scarab Altar' },
      { id: 3, name: 'Bastet Claws', element: 'lightning', mult: 20, bonusMult: 3, icon: '⚡', title: 'Plasma Claw Altar' },
      { id: 4, name: 'Ankh of Horus', element: 'solar', mult: 35, bonusMult: 5, icon: '✨', title: 'Celestial Ankh Altar' },
      { id: 5, name: 'Apex Zenith Orb', element: 'cosmic', mult: 50, bonusMult: 10, icon: '👑', title: 'Zenith Grand Altar' },
    ];

    // Shuffle templates
    const shuffled = [...altarTemplates].sort(() => Math.random() - 0.5).map((item, idx) => ({
      ...item,
      id: idx,
      isRevealed: false,
      winAmount: item.mult * baseBet,
      isStriking: false,
    }));

    setAltars(shuffled);
    setPicksRemaining(4);
    setTotalWinCoins(0);
    setActiveMultiplier(1);
    setIsCompleted(false);
    setActiveStrikeEffect(null);
    setBannerMessage(
      '⚡ HARNESS THE DIVINE TEMPEST! CHOOSE A SACRED CELESTIAL ALTAR TO UNLEASH LIGHTNING & SOLAR FIRE!'
    );

    soundEngine.playBonusTrigger();
  }, [isOpen, currentBet]);

  // Live Canvas Lightning & Fire Storm Particle System
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle pool for embers & electric sparks
    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -Math.random() * 2.5 - 0.8,
        radius: Math.random() * 3.5 + 1.2,
        color: Math.random() > 0.45 ? '#f59e0b' : '#00e5ff',
        alpha: Math.random() * 0.8 + 0.2,
        decay: Math.random() * 0.012 + 0.005,
      });
    }

    // Branching Lightning Arc Generator
    const createLightningBolt = (x1, y1, x2, y2) => {
      const segments = [{ x1, y1, x2, y2 }];
      let currentDisplacement = 60;
      for (let iter = 0; iter < 4; iter++) {
        const nextSegs = [];
        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s];
          const midX = (seg.x1 + seg.x2) / 2;
          const midY = (seg.y1 + seg.y2) / 2;
          const normalX = -(seg.y2 - seg.y1);
          const normalY = seg.x2 - seg.x1;
          const len = Math.hypot(normalX, normalY);
          const offset = (Math.random() - 0.5) * currentDisplacement;
          const px = midX + (len > 0 ? (normalX / len) * offset : 0);
          const py = midY + (len > 0 ? (normalY / len) * offset : 0);
          nextSegs.push({ x1: seg.x1, y1: seg.y1, x2: px, y2: py });
          nextSegs.push({ x1: px, y1: py, x2: seg.x2, y2: seg.y2 });
        }
        segments.splice(0, segments.length, ...nextSegs);
        currentDisplacement *= 0.52;
      }
      return segments;
    };

    let activeLightningBolts = [];
    let lightningCooldown = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Billowing Cosmic Clouds & Nebulae
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        width * 0.08,
        width * 0.5,
        height * 0.5,
        width * 0.85
      );
      grad.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
      grad.addColorStop(0.35, 'rgba(217, 119, 6, 0.14)');
      grad.addColorStop(0.7, 'rgba(124, 58, 237, 0.12)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Random Cascading Lightning Bolts
      lightningCooldown--;
      if (lightningCooldown <= 0) {
        if (Math.random() < 0.28) {
          const startX = Math.random() * width;
          const endX = startX + (Math.random() - 0.5) * 350;
          activeLightningBolts.push({
            segments: createLightningBolt(startX, 0, endX, height * (0.6 + Math.random() * 0.35)),
            life: 8,
            color: Math.random() > 0.3 ? '#00e5ff' : '#ffffff',
          });
        }
        lightningCooldown = Math.floor(Math.random() * 22 + 12);
      }

      // Draw active lightning bolts
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let b = activeLightningBolts.length - 1; b >= 0; b--) {
        const bolt = activeLightningBolts[b];
        ctx.strokeStyle = bolt.color;
        ctx.lineWidth = bolt.life > 4 ? 3 : 1.5;
        ctx.shadowColor = bolt.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        bolt.segments.forEach((seg, i) => {
          if (i === 0) ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        });
        ctx.stroke();
        bolt.life--;
        if (bolt.life <= 0) {
          activeLightningBolts.splice(b, 1);
        }
      }
      ctx.restore();

      // 3. Embers & Electric Sparks
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < 0) {
          p.x = Math.random() * width;
          p.y = height + 10;
          p.alpha = Math.random() * 0.8 + 0.3;
          p.vx = (Math.random() - 0.5) * 2.2;
          p.vy = -Math.random() * 2.5 - 0.8;
        }

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen]);

  // Altar Pick Handler
  const handleAltarPick = useCallback(
    (altarId) => {
      if (isCompleted || picksRemaining <= 0) return;
      const target = altars.find((a) => a.id === altarId);
      if (!target || target.isRevealed) return;

      // Trigger Divine Lightning & Solar Fire Strike Animation
      soundEngine.playThunderStrike();
      setTimeout(() => soundEngine.playSolarFireball(), 140);

      // Trigger visual strike
      setActiveStrikeEffect(altarId);
      setTimeout(() => setActiveStrikeEffect(null), 850);

      const nextPicks = picksRemaining - 1;
      setPicksRemaining(nextPicks);

      // Update altar state
      const winWithMultiplier = target.winAmount * activeMultiplier;
      const nextMultiplier = activeMultiplier + (target.bonusMult || 1);

      setAltars((prev) =>
        prev.map((a) =>
          a.id === altarId
            ? { ...a, isRevealed: true, winAmount: winWithMultiplier }
            : a
        )
      );

      setTotalWinCoins((prev) => prev + winWithMultiplier);
      setActiveMultiplier(nextMultiplier);

      setBannerMessage(
        `⚡ ${target.title.toUpperCase()} STRUCK! +${winWithMultiplier.toLocaleString()} COINS AWARDED • MULTIPLIER BOOSTED TO ${nextMultiplier}×!`
      );

      // Play coin tick
      soundEngine.playCoinTick(1);

      if (nextPicks <= 0) {
        setTimeout(() => {
          setIsCompleted(true);
          soundEngine.playWinCelebration('epic');
          setBannerMessage(
            '👑 CELESTIAL OVERLOAD COMPLETED! THE GODS BESTOW THEIR ULTIMATE BLESSINGS!'
          );
        }, 1100);
      }
    },
    [altars, isCompleted, picksRemaining, activeMultiplier]
  );

  const handleCollectPrize = () => {
    soundEngine.playButtonClick(660);
    onComplete?.(totalWinCoins);
  };

  if (!isOpen) return null;

  return (
    <div className="celestial-overload-overlay" role="dialog" aria-modal="true">
      {/* Background Animated Canvas (Cascading Lightning & Solar Embers) */}
      <canvas ref={canvasRef} className="celestial-storm-canvas" />

      {/* Main Modal Chamber Container */}
      <div className="celestial-overload-chamber">
        {/* Top Header & Divine Title */}
        <header className="celestial-header">
          <div className="celestial-brand-badge">
            <Sparkles size={16} className="celestial-spark-icon" />
            <span>APEX RESONANCE BONUS UNLOCKED</span>
            <Sparkles size={16} className="celestial-spark-icon" />
          </div>

          <h2 className="celestial-title">
            <span className="celestial-lightning-text">WRATH OF THE GODS</span>
            <span className="celestial-fire-text">CELESTIAL OVERLOAD</span>
          </h2>

          <div className="celestial-hud-bar">
            <div className="celestial-hud-item">
              <span className="hud-label">PICKS REMAINING</span>
              <span className="hud-val picks-count">{picksRemaining}</span>
            </div>

            <div className="celestial-hud-item multiplier-item">
              <span className="hud-label">GOD MULTIPLIER</span>
              <span className="hud-val multiplier-val">{activeMultiplier}×</span>
            </div>

            <div className="celestial-hud-item win-total-item">
              <span className="hud-label">TOTAL CELESTIAL WIN</span>
              <span className="hud-val win-val">
                {currencyMode === 'SC'
                  ? `$${(totalWinCoins / 100).toFixed(2)} SC`
                  : `${totalWinCoins.toLocaleString()} GC`}
              </span>
            </div>
          </div>

          {/* Dynamic Status / Lore Banner */}
          <div className="celestial-status-banner">
            <Zap size={16} className="banner-zap-icon" />
            <span>{bannerMessage}</span>
            <Flame size={16} className="banner-flame-icon" />
          </div>
        </header>

        {/* 6 Mystical 3D Interactive Celestial Altars */}
        <div className="celestial-altars-grid">
          {altars.map((altar) => {
            const isStrikingThis = activeStrikeEffect === altar.id;
            return (
              <div
                key={altar.id}
                className={`celestial-altar-card ${altar.isRevealed ? 'revealed' : ''} ${
                  isStrikingThis ? 'under-strike' : ''
                } altar-${altar.element}`}
                onClick={() => handleAltarPick(altar.id)}
                role="button"
                tabIndex={altar.isRevealed || isCompleted ? -1 : 0}
                aria-label={altar.isRevealed ? `${altar.title} revealed` : `Altar ${altar.id + 1}`}
              >
                {/* Electric Strike Flash FX */}
                {isStrikingThis && (
                  <div className="altar-strike-flash">
                    <div className="altar-lightning-blast" />
                    <div className="altar-solar-supernova" />
                  </div>
                )}

                {/* Floating Mystic Energy Shield / Cover */}
                {!altar.isRevealed ? (
                  <div className="altar-sealed-content">
                    <div className="altar-pedestal-ring" />
                    <div className="altar-sigil-orb">
                      <span className="altar-sigil-icon">{altar.icon}</span>
                    </div>
                    <span className="altar-callout">TAP TO STRIKE</span>
                  </div>
                ) : (
                  /* Revealed Cosmic Prize */
                  <div className="altar-revealed-content">
                    <div className="revealed-element-tag">{altar.element.toUpperCase()}</div>
                    <div className="revealed-icon">{altar.icon}</div>
                    <div className="revealed-title">{altar.name}</div>
                    <div className="revealed-win-amount">
                      {currencyMode === 'SC'
                        ? `$${(altar.winAmount / 100).toFixed(2)} SC`
                        : `${altar.winAmount.toLocaleString()} GC`}
                    </div>
                    <div className="revealed-multiplier-boost">
                      +{altar.bonusMult}× MULTIPLIER BOOST
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion Celebration Overlay & Collect Prize Button */}
        {isCompleted && (
          <div className="celestial-completion-card">
            <div className="completion-ribbon">
              <Trophy size={20} className="trophy-icon" />
              <span>DIVINE VICTORY ACHIVED!</span>
              <Trophy size={20} className="trophy-icon" />
            </div>

            <h3 className="completion-headline">THE TEMPLE BLESSINGS HAVE BEEN BESTOWED</h3>

            <div className="completion-gold-total">
              <span className="gold-label">TOTAL ACCUMULATED REWARD</span>
              <span className="gold-number">
                {currencyMode === 'SC'
                  ? `$${(totalWinCoins / 100).toFixed(2)} SC`
                  : `${totalWinCoins.toLocaleString()} GC`}
              </span>
            </div>

            <button
              type="button"
              className="celestial-collect-btn"
              onClick={handleCollectPrize}
            >
              <Sparkles size={18} />
              <span>COLLECT CELESTIAL WIN &amp; RETURN</span>
              <Sparkles size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
