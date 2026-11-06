import React, { useEffect, useState, useRef, useCallback } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { CASINO_BRAND, THEME_COPY } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

/**
 * Brand-New 2026 60FPS Celestial Pharaoh Mega Win Canvas Engine:
 * 1. Dual pressurized parabolic Gold Coin Cannons (left & right temple vaults) + overhead coin rain
 * 2. Tumbling 3D cut gemstones (Lapis Sapphire, Emerald Scarab, Ruby Cabochon, 24k Bullion)
 * 3. Multi-detonation aerial firework bursts with gravity trails
 * 4. Concentric golden hieroglyphic shockwaves & volumetric god-ray beams
 * 5. Real-time tier surge bursts when escalating from BIG -> MEGA -> ULTRA
 */
function MegaWinParticleCanvas({ activeTier = 'mega', surgeTrigger = 0 }) {
  const canvasRef = useRef(null);
  const tierRef = useRef(activeTier);
  tierRef.current = activeTier;

  const surgeCallbackRef = useRef(null);

  useEffect(() => {
    if (surgeTrigger > 0 && surgeCallbackRef.current) {
      surgeCallbackRef.current();
    }
  }, [surgeTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const isUltra = activeTier === 'ultra';
    const coinTotal = Math.min(78, Math.max(42, Math.floor(width / 20)));

    // 1. Parabolic Cannon Coins + Overhead Cascade Coins
    const stamps = ['★', '☥', '◈', '👑'];
    const spawnCoin = (fromCannon = false, side = 'left') => {
      if (fromCannon) {
        const isLeft = side === 'left';
        return {
          x: isLeft ? width * 0.08 : width * 0.92,
          y: height + 10,
          vx: (isLeft ? 1 : -1) * (3.5 + Math.random() * 6.5),
          vy: -(13.5 + Math.random() * 8.5),
          gravity: 0.24 + Math.random() * 0.08,
          radius: 13 + Math.random() * 13,
          angle: Math.random() * Math.PI * 2,
          spinSpeed: 0.08 + Math.random() * 0.09,
          tilt: (Math.random() - 0.5) * 0.7,
          tiltSpeed: (Math.random() - 0.5) * 0.04,
          stamp: stamps[Math.floor(Math.random() * stamps.length)],
          isCannon: true,
        };
      }
      return {
        x: Math.random() * width,
        y: -30 - Math.random() * height * 0.8,
        vx: (Math.random() - 0.5) * 2.2,
        vy: 3.2 + Math.random() * 4.5,
        gravity: 0.06,
        radius: 12 + Math.random() * 12,
        angle: Math.random() * Math.PI * 2,
        spinSpeed: 0.06 + Math.random() * 0.08,
        tilt: (Math.random() - 0.5) * 0.5,
        tiltSpeed: (Math.random() - 0.5) * 0.03,
        stamp: stamps[Math.floor(Math.random() * stamps.length)],
        isCannon: false,
      };
    };

    const coins = Array.from({ length: coinTotal }, (_, i) =>
      spawnCoin(i % 2 === 0, i % 4 === 0 ? 'left' : 'right')
    );

    // 2. 3D Faceted Royal Jewels (Ruby, Emerald, Lapis Cyan, Amethyst)
    const jewelPalettes = [
      { main: '#10b981', hi: '#a7f3d0', rim: '#065f46' }, // Emerald
      { main: '#00e5ff', hi: '#cffafe', rim: '#0369a1' }, // Lapis Cyan
      { main: '#ef4444', hi: '#fecaca', rim: '#7f1d1d' }, // Ruby
      { main: '#a855f7', hi: '#f3e8ff', rim: '#581c87' }, // Amethyst
    ];
    const jewelCount = Math.min(28, Math.max(14, Math.floor(width / 55)));
    const jewels = Array.from({ length: jewelCount }, () => {
      const pal = jewelPalettes[Math.floor(Math.random() * jewelPalettes.length)];
      return {
        x: Math.random() * width,
        y: -40 - Math.random() * height,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 2.6 + Math.random() * 3.8,
        size: 8 + Math.random() * 9,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.09,
        pal,
      };
    });

    // 3. Firework Burst Particles
    const sparks = [];
    const spawnFireworkBurst = (cx, cy, count = 42, speedMult = 1) => {
      const currentTier = tierRef.current;
      const colors =
        currentTier === 'ultra'
          ? ['#ffd700', '#00e5ff', '#e879f9', '#34d399', '#ffffff', '#f43f5e']
          : currentTier === 'mega'
          ? ['#ffd700', '#fef08a', '#fbbf24', '#00e5ff', '#f43f5e', '#ffffff']
          : ['#ffd700', '#fef08a', '#f59e0b', '#34d399', '#ffffff'];

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.15;
        const speed = (2.2 + Math.random() * 6.8) * speedMult;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          size: 2.2 + Math.random() * 3.8,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.012 + Math.random() * 0.014,
        });
      }
    };

    // 4. Expanding Shockwaves
    const shockwaves = [
      { r: 24, alpha: 0.9, speed: 6.5, color: '#ffd700', width: 4 },
      { r: 80, alpha: 0.65, speed: 4.8, color: '#00e5ff', width: 2.5 },
    ];

    // Hook up tier-escalation surge burst
    surgeCallbackRef.current = () => {
      shockwaves.push({
        r: 18,
        alpha: 1.0,
        speed: 9.5,
        color: tierRef.current === 'ultra' ? '#e879f9' : '#ffd700',
        width: 6,
      });
      spawnFireworkBurst(width * 0.5, height * 0.42, 64, 1.35);
      spawnFireworkBurst(width * 0.22, height * 0.32, 36, 1.1);
      spawnFireworkBurst(width * 0.78, height * 0.32, 36, 1.1);
    };

    // Initial celebratory firework salvo
    spawnFireworkBurst(width * 0.5, height * 0.38, 52, 1.15);

    let lastTime = performance.now();
    let burstTimer = 0;
    let rayAngle = 0;

    const render = (now) => {
      const dt = Math.min(33, now - lastTime) / 16.67;
      lastTime = now;
      burstTimer += dt;
      rayAngle += 0.0045 * dt;

      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.43;
      const currentTier = tierRef.current;

      // A. Volumetric Rotating God-Rays in Canvas Background
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rayAngle);
      const rayCount = currentTier === 'ultra' ? 18 : 14;
      const maxRayLen = Math.max(width, height) * 0.85;
      for (let i = 0; i < rayCount; i++) {
        ctx.rotate((Math.PI * 2) / rayCount);
        const grad = ctx.createLinearGradient(0, 0, maxRayLen, 0);
        if (currentTier === 'ultra') {
          grad.addColorStop(0, 'rgba(232, 121, 249, 0.20)');
          grad.addColorStop(0.4, 'rgba(0, 229, 255, 0.09)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          grad.addColorStop(0, 'rgba(255, 215, 0, 0.22)');
          grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.08)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxRayLen, -38);
        ctx.lineTo(maxRayLen, 38);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // B. Periodic Autonomous Firework Detonations
      const fireworkInterval = currentTier === 'ultra' ? 26 : currentTier === 'mega' ? 34 : 46;
      if (burstTimer >= fireworkInterval) {
        burstTimer = 0;
        const fx = width * (0.18 + Math.random() * 0.64);
        const fy = height * (0.16 + Math.random() * 0.45);
        spawnFireworkBurst(fx, fy, currentTier === 'ultra' ? 44 : 32, 1.0);
      }

      // C. Expanding Golden & Cyan Shockwave Rings
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += sw.speed * dt;
        sw.alpha -= 0.0085 * dt;
        if (sw.alpha <= 0.01) {
          if (i < 2) {
            sw.r = 22;
            sw.alpha = 0.78;
          } else {
            shockwaves.splice(i, 1);
            continue;
          }
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, sw.r), 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.lineWidth = sw.width || 3;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      }

      // D. Render Firework Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.08 * dt;
        s.vx *= 0.985;
        s.alpha -= s.decay * dt;
        if (s.alpha <= 0.01) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // E. Render Faceted 3D Royal Jewels
      jewels.forEach((j) => {
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.rot += j.rotSpeed * dt;
        if (j.y > height + 30) {
          j.y = -25 - Math.random() * 80;
          j.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(j.x, j.y);
        ctx.rotate(j.rot);
        const s = j.size;
        ctx.fillStyle = j.pal.main;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.4;
        ctx.shadowColor = j.pal.main;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.78, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.78, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner specular facet
        ctx.fillStyle = j.pal.hi;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(s * 0.35, 0);
        ctx.lineTo(0, s * 0.5);
        ctx.lineTo(-s * 0.35, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // F. Render 3D Tumbling Egyptian Gold Coins
      coins.forEach((c, idx) => {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vy += c.gravity * dt;
        c.angle += c.spinSpeed * dt;
        c.tilt += c.tiltSpeed * dt;

        if (c.y > height + 45 && c.vy > 0) {
          const respawn = spawnCoin(idx % 2 === 0, idx % 4 === 0 ? 'left' : 'right');
          Object.assign(c, respawn);
        }

        const scaleX = Math.cos(c.angle);
        const absScale = Math.max(0.14, Math.abs(scaleX));
        const r = c.radius;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(Math.sin(c.tilt) * 0.35);

        // 3D Coin Edge Thickness
        const edgeDepth = Math.max(2, (1 - absScale) * 5.5);
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.ellipse(edgeDepth * (scaleX >= 0 ? 1 : -1), 0, r * absScale, r, 0, 0, Math.PI * 2);
        ctx.fill();

        // Coin Face Metallic Gradient
        ctx.scale(scaleX, 1);
        const grad = ctx.createLinearGradient(-r, -r, r, r);
        if (scaleX > 0) {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.22, '#fef08a');
          grad.addColorStop(0.55, '#fbbf24');
          grad.addColorStop(0.85, '#d97706');
          grad.addColorStop(1, '#78350f');
        } else {
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(0.35, '#eab308');
          grad.addColorStop(0.75, '#b45309');
          grad.addColorStop(1, '#451a03');
        }

        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(251, 191, 36, 0.65)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Embossed Inner Ring
        ctx.lineWidth = Math.max(1.2, r * 0.13);
        ctx.strokeStyle = '#92400e';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.stroke();

        // Royal Stamp
        if (absScale > 0.38) {
          ctx.fillStyle = '#78350f';
          ctx.font = `900 ${Math.round(r * 0.85)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.stamp, 0, 1);
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="bigwin-particles-canvas" />;
}

export default function BigWinPopup({
  winCoins,
  coinValue = 1.0,
  currencyMode = 'GC',
  betAmount = 1,
  onClose,
  onClaimVipOffer,
}) {
  const [displayCoins, setDisplayCoins] = useState(0);
  const [isRollComplete, setIsRollComplete] = useState(false);
  const [activeStage, setActiveStage] = useState('big');
  const [surgeCount, setSurgeCount] = useState(0);
  const [screenFlash, setScreenFlash] = useState(false);
  const animFrameRef = useRef(null);

  const safeBet = betAmount > 0 ? betAmount : 1;
  const finalRatio = winCoins / safeBet;
  const finalMultiplier = Math.max(1, Math.round(finalRatio));

  const targetTier = finalRatio >= 35 ? 'ultra' : finalRatio >= 18 ? 'mega' : 'big';

  const triggerStageFlash = useCallback(() => {
    setScreenFlash(true);
    setSurgeCount((c) => c + 1);
    setTimeout(() => setScreenFlash(false), 380);
  }, []);

  // Complete roll-up immediately on user tap if still counting
  const handleFastForwardOrClose = useCallback(() => {
    if (!isRollComplete) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const finalVal = currencyMode === 'SC' ? Number(winCoins.toFixed(2)) : winCoins;
      setDisplayCoins(finalVal);
      setActiveStage(targetTier);
      setIsRollComplete(true);
      triggerStageFlash();
      soundEngine.playButtonClick(760);
    } else {
      soundEngine.playButtonClick(640);
      onClose?.();
    }
  }, [isRollComplete, currencyMode, winCoins, targetTier, triggerStageFlash, onClose]);

  useEffect(() => {
    if (!winCoins || winCoins <= 0) return;

    setIsRollComplete(false);
    setActiveStage('big');
    triggerStageFlash();

    try {
      soundEngine.playWinCelebration(targetTier);
      soundEngine.playWin(true);
    } catch (_) {}

    const duration = targetTier === 'ultra' ? 3800 : targetTier === 'mega' ? 3000 : 2100;
    const start = performance.now();
    let lastRenderedVal = -1;
    let lastTickTime = 0;
    let currentStageTracker = 'big';

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Smooth dramatic casino S-curve with brisk climax finish
      const eased = 1 - Math.pow(1 - progress, 3.4);

      const current =
        currencyMode === 'SC'
          ? Number((winCoins * eased).toFixed(2))
          : Math.round(winCoins * eased);

      const liveRatio = current / safeBet;

      // Real-time Tier Escalation (BIG -> MEGA -> COLOSSAL ULTRA)
      if (liveRatio >= 35 && currentStageTracker !== 'ultra') {
        currentStageTracker = 'ultra';
        setActiveStage('ultra');
        triggerStageFlash();
        try {
          soundEngine.playThunderStrike?.();
        } catch (_) {}
      } else if (liveRatio >= 18 && currentStageTracker === 'big') {
        currentStageTracker = 'mega';
        setActiveStage('mega');
        triggerStageFlash();
        try {
          soundEngine.playSolarFireball?.();
        } catch (_) {}
      }

      if (current !== lastRenderedVal) {
        lastRenderedVal = current;
        setDisplayCoins(current);
        if (now - lastTickTime > 42) {
          lastTickTime = now;
          soundEngine.playCoinTick(progress);
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayCoins(currencyMode === 'SC' ? Number(winCoins.toFixed(2)) : winCoins);
        setActiveStage(targetTier);
        setIsRollComplete(true);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [winCoins, currencyMode, targetTier, safeBet, triggerStageFlash]);

  if (!winCoins || winCoins <= 0) return null;

  const isSC = currencyMode === 'SC';
  const cashValue = isSC ? Number(displayCoins).toFixed(2) : (displayCoins * coinValue).toFixed(2);
  const liveMultiplier = Math.max(1, Math.round((displayCoins || winCoins) / safeBet));
  const crestImage = CASINO_BRAND.megaWinNeonImage || '/assets/neon/mega_win_royal_gold.webp';

  const stageMeta = {
    big: {
      ribbon: '★ PHARAOH BIG WIN UNLOCKED ★',
      headline: 'BIG WIN',
      subtitle: 'SACRED TEMPLE TREASURY BREACHED!',
      badge: 'STAGE I • GOLDEN VAULT',
    },
    mega: {
      ribbon: '⚡ CELESTIAL MEGA WIN JACKPOT ⚡',
      headline: 'MEGA WIN',
      subtitle: 'WRATH OF ANUBIS & BASTET BESTOWS ROYAL RICHES!',
      badge: 'STAGE II • SOLAR OVERCHARGE',
    },
    ultra: {
      ribbon: '👑 COLOSSAL PHARAOH ULTRA WIN 👑',
      headline: 'COLOSSAL WIN',
      subtitle: 'SOVEREIGN PHARAOH & CROWN CHAKRA • SUPREME FORTUNE!',
      badge: 'STAGE III • DIVINE ASCENSION',
    },
  }[activeStage] || {
    ribbon: '⚡ CELESTIAL MEGA WIN JACKPOT ⚡',
    headline: 'MEGA WIN',
    subtitle: 'COLOSSAL EGYPTIAN TREASURE!',
    badge: 'ROYAL TREASURE',
  };

  return (
    <div
      className={`bigwin-overlay bigwin-tier-${activeStage} ${screenFlash ? 'bigwin-surge-flash' : ''}`}
      onClick={handleFastForwardOrClose}
    >
      {/* 60fps Dual Gold Coin Cannons, Gem Shards, Fireworks & Volumetric Beams */}
      <MegaWinParticleCanvas activeTier={activeStage} surgeTrigger={surgeCount} />

      {/* Rotating Celestial Sunburst & Sacred Geometry Textures */}
      <img
        src="/assets/psd/fx_rays.webp"
        alt=""
        className={`bigwin-fx-rays rays-${activeStage}`}
        draggable={false}
      />
      <img
        src="/assets/psd/fx_pattern.webp"
        alt=""
        className={`bigwin-fx-pattern pattern-${activeStage}`}
        draggable={false}
      />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className={`bigwin-fx-sparks sparks-${activeStage}`}
        draggable={false}
      />

      {/* Main 3D Egyptian Altar Stage */}
      <div
        className={`bigwin-modal tier-${activeStage} ${isRollComplete ? 'roll-complete' : 'rolling-active'}`}
        onClick={(e) => {
          e.stopPropagation();
          handleFastForwardOrClose();
        }}
      >
        {/* Flanking Apex Overcharged Guardians (Lord Anubis Left, Queen Bastet Right) */}
        <div className="bigwin-guardians-flank" aria-hidden="true">
          <div className="bigwin-guardian-wing guardian-left">
            <img
              src="/assets/characters/anubis_apex_overcharged.webp"
              alt=""
              className="bigwin-guardian-statue"
              draggable={false}
            />
          </div>
          <div className="bigwin-guardian-wing guardian-right">
            <img
              src="/assets/characters/bastet_apex_overcharged.webp"
              alt=""
              className="bigwin-guardian-statue"
              draggable={false}
            />
          </div>
        </div>

        {/* 3-Stage Escalation Progression Bar */}
        <div className="bigwin-escalation-stepper" aria-hidden="true">
          <span className={`esc-pill ${activeStage === 'big' || activeStage === 'mega' || activeStage === 'ultra' ? 'lit' : ''}`}>
            I • BIG WIN
          </span>
          <span className="esc-arrow">▸</span>
          <span className={`esc-pill ${activeStage === 'mega' || activeStage === 'ultra' ? 'lit mega-lit' : ''}`}>
            II • MEGA WIN
          </span>
          <span className="esc-arrow">▸</span>
          <span className={`esc-pill ${activeStage === 'ultra' ? 'lit ultra-lit' : ''}`}>
            III • COLOSSAL ULTRA
          </span>
        </div>

        {/* Top Crown Ribbon */}
        <div className={`bigwin-casino-ribbon ribbon-${activeStage}`}>
          <span className="ribbon-star">★</span>
          <span>{stageMeta.ribbon}</span>
          <span className="ribbon-star">★</span>
        </div>

        {/* 3D Sacred Solar Disc, Orbiting Relics & Winged Royal Crest */}
        <div className={`bigwin-neon-banner-wrap banner-${activeStage}`}>
          {/* Rotating Sacred Hieroglyph Astrolabe Ring */}
          <div className={`bigwin-solar-astrolabe astrolabe-${activeStage}`} />

          {/* Floating Sacred Relics Flanking the Crest */}
          <img
            src="/assets/symbols/high/high_ankh_no_frame.png"
            alt=""
            className="bigwin-orbit-relic relic-left"
            draggable={false}
          />
          <img
            src="/assets/symbols/high/high_scarab_no_frame.png"
            alt=""
            className="bigwin-orbit-relic relic-top"
            draggable={false}
          />
          <img
            src="/assets/symbols/high/high_eye_no_frame.png"
            alt=""
            className="bigwin-orbit-relic relic-right"
            draggable={false}
          />

          {/* Primary 3D Winged Royal Gold Crest */}
          <img
            src={crestImage}
            alt={stageMeta.headline}
            className={`bigwin-neon-mega-img crest-${activeStage}`}
            draggable={false}
          />

          {/* Live Bet Multiplier Medallion */}
          <div className={`bigwin-multiplier-orb orb-${activeStage}`}>
            <span className="mult-orb-value">{liveMultiplier > 1 ? `${liveMultiplier}×` : `${finalMultiplier}×`}</span>
            <span className="mult-orb-label">BET WIN</span>
          </div>
        </div>

        {/* Sculpted 3D Metallic Tier Headline */}
        <div className={`bigwin-3d-title-plaque title-${activeStage}`} data-text={stageMeta.headline}>
          {stageMeta.headline}
        </div>

        <div className="bigwin-tier-subtitle">{stageMeta.subtitle}</div>

        {/* Illuminated Vault Counter Pedestal */}
        <div className={`bigwin-numbers-stage pedestal-${activeStage}`}>
          <div className="neon-psd-digits">
            <PsdGoldNumber value={isSC ? displayCoins.toFixed(2) : displayCoins} height={84} gap={-4} />
          </div>
          <div className="bigwin-cash-sub">
            {isSC ? 'VERIFIED SWEEPS PRIZE WON: ' : 'ROYAL GOLD COINS AWARDED: '}
            <span className="bigwin-cash-highlight">
              {isSC ? `$${cashValue} USD` : `${displayCoins.toLocaleString()} GC`}
            </span>
          </div>
        </div>

        {/* High-Conversion "Winner's High" VIP Multiplier Match Ad Banner */}
        {isRollComplete && onClaimVipOffer && (
          <button
            type="button"
            className="bigwin-vip-upsell-banner"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.playButtonClick(780);
              onClaimVipOffer(winCoins);
            }}
          >
            <span className="upsell-tag">🔥 HOT STREAK VIP MATCH</span>
            <span className="upsell-copy">
              {isSC
                ? 'Double Down on Your Hot Reels! Claim +$22.00 FREE SC + 60,000 GC →'
                : 'Turn Your Next Big Hit Into REAL CASH! Unlock $22.00 FREE SC + 60,000 GC →'}
            </span>
          </button>
        )}

        {/* Action Button (Fast-Forward during roll-up, Collect when finished) */}
        <button
          type="button"
          className={`bigwin-collect-btn collect-${activeStage}`}
          onClick={(e) => {
            e.stopPropagation();
            handleFastForwardOrClose();
          }}
        >
          {isRollComplete ? THEME_COPY.bigWinCollectButton : '⚡ TAP TO INSTANT COLLECT'}
        </button>
      </div>
    </div>
  );
}
