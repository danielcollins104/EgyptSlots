import React, { useEffect, useState, useRef } from 'react';
import PsdGoldNumber from './PsdGoldNumber';
import { CASINO_BRAND, THEME_COPY } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';

/**
 * High-performance 60fps interactive HTML5 canvas particle celebration
 * Renders cascading 3D tumbling gold coins, golden fireworks, and radiant lapis sparkles
 */
function MegaWinParticleCanvas({ tier = 'mega' }) {
  const canvasRef = useRef(null);

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

    // Initialize 3D tumbling coins tuned for win tier
    const isUltra = tier === 'ultra' || tier === 'colossal';
    const isBig = tier === 'big';
    const COIN_COUNT = isUltra
      ? Math.min(64, Math.floor(width / 18))
      : isBig
      ? Math.min(32, Math.floor(width / 28))
      : Math.min(48, Math.floor(width / 24));

    const coins = Array.from({ length: COIN_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height - 20,
      radius: (isUltra ? 14 : 12) + Math.random() * (isUltra ? 12 : 10),
      vy: (isUltra ? 3.4 : 2.8) + Math.random() * (isUltra ? 4.2 : 3.6),
      vx: (Math.random() - 0.5) * (isUltra ? 2.2 : 1.6),
      angle: Math.random() * Math.PI * 2,
      spinSpeed: 0.05 + Math.random() * 0.07,
      wobble: Math.random() * Math.PI,
      wobbleSpeed: 0.03 + Math.random() * 0.03,
      alpha: 0.85 + Math.random() * 0.15,
    }));

    // Initialize radiant celebration sparklers with tier-specific palettes
    const SPARK_COUNT = isUltra ? Math.min(90, Math.floor(width / 14)) : Math.min(60, Math.floor(width / 18));
    const palette = isUltra
      ? ['#c084fc', '#a855f7', '#00e5ff', '#ffd700', '#ff6b00', '#ffffff', '#38bdf8']
      : isBig
      ? ['#fde047', '#ffd700', '#f59e0b', '#fbbf24', '#ffffff']
      : ['#fde047', '#ffd700', '#f59e0b', '#38bdf8', '#fb7185', '#ffffff'];

    const sparks = Array.from({ length: SPARK_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * (isUltra ? 7.5 : 5.5);
      return {
        x: width / 2,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 2 + Math.random() * (isUltra ? 4.5 : 3.5),
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 1,
        life: 0.4 + Math.random() * 0.6,
        decay: 0.008 + Math.random() * 0.012,
      };
    });

    // Expanding shockwaves
    const shockwaves = [
      { r: 20, maxR: Math.min(width, height) * 0.55, alpha: 0.8, speed: isUltra ? 6 : 4 },
      { r: 10, maxR: Math.min(width, height) * 0.45, alpha: 0.7, speed: isUltra ? 4.8 : 3.2 },
    ];

    let lastTime = performance.now();

    const render = (now) => {
      const dt = Math.min(33, now - lastTime) / 16.67;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw Shockwave Rings
      shockwaves.forEach((sw) => {
        if (sw.alpha <= 0.01) {
          sw.r = 15;
          sw.alpha = 0.75;
        }
        sw.r += sw.speed * dt;
        sw.alpha -= 0.007 * dt;

        ctx.save();
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.42, Math.max(0, sw.r), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${Math.max(0, sw.alpha)})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      });

      // 2. Draw Radiant Sparks
      sparks.forEach((s) => {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.07 * dt; // gravity
        s.alpha -= s.decay * dt;

        if (s.alpha <= 0) {
          s.x = width / 2 + (Math.random() - 0.5) * 80;
          s.y = height * 0.42 + (Math.random() - 0.5) * 40;
          const a = Math.random() * Math.PI * 2;
          const spd = 1.8 + Math.random() * 5.2;
          s.vx = Math.cos(a) * spd;
          s.vy = Math.sin(a) * spd - 1.5;
          s.alpha = 1;
        }

        ctx.save();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, s.alpha);
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 3. Draw 3D Tumbling Golden Coins
      coins.forEach((c) => {
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.angle += c.spinSpeed * dt;
        c.wobble += c.wobbleSpeed * dt;

        if (c.y > height + 40) {
          c.y = -30 - Math.random() * 80;
          c.x = Math.random() * width;
        }

        const scaleX = Math.cos(c.angle);
        const radius = c.radius;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(scaleX, 1);
        ctx.rotate(Math.sin(c.wobble) * 0.2);

        // Coin Rim Outer Gradient
        const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
        if (scaleX > 0) {
          grad.addColorStop(0, '#fffbeb');
          grad.addColorStop(0.3, '#fde047');
          grad.addColorStop(0.7, '#f59e0b');
          grad.addColorStop(1, '#78350f');
        } else {
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(0.4, '#eab308');
          grad.addColorStop(0.8, '#d97706');
          grad.addColorStop(1, '#451a03');
        }

        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner Embossed Edge
        ctx.lineWidth = Math.max(1, radius * 0.14);
        ctx.strokeStyle = '#b45309';
        ctx.stroke();

        // Center Star / Symbol Stamp
        if (Math.abs(scaleX) > 0.45) {
          ctx.fillStyle = '#78350f';
          ctx.font = `bold ${Math.round(radius * 0.9)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', 0, 1);
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
}) {
  const [displayCoins, setDisplayCoins] = useState(0);

  const ratio = betAmount > 0 ? winCoins / betAmount : 15;
  let tier = 'big';
  let ribbonTitle = '★ BIG WIN UNLOCKED ★';
  let bannerSub = 'SACRED TEMPLE VAULT OPENED!';

  if (ratio >= 35) {
    tier = 'ultra';
    ribbonTitle = '★ COLOSSAL ULTRA WIN ★';
    bannerSub = 'THE GODS BESTOW INFINITE GLORY!';
  } else if (ratio >= 18) {
    tier = 'mega';
    ribbonTitle = '★ MEGA WIN JACKPOT ★';
    bannerSub = 'COLOSSAL EGYPTIAN TREASURE!';
  } else {
    tier = 'big';
    ribbonTitle = '★ BIG WIN UNLOCKED ★';
    bannerSub = 'SACRED TEMPLE VAULT OPENED!';
  }

  useEffect(() => {
    if (!winCoins || winCoins <= 0) return;
    try {
      soundEngine.playWinCelebration(tier);
      soundEngine.playWin(true);
    } catch (_) {}

    let frameId;
    const duration = tier === 'ultra' ? 3000 : tier === 'mega' ? 2400 : 1800;
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
  }, [winCoins, currencyMode, tier]);

  if (!winCoins || winCoins <= 0) return null;

  const isSC = currencyMode === 'SC';
  const cashValue = isSC ? Number(displayCoins).toFixed(2) : (displayCoins * coinValue).toFixed(2);
  const crestImage =
    CASINO_BRAND.megaWinNeonImage || '/assets/neon/mega_win_royal_gold.png';

  return (
    <div className={`bigwin-overlay bigwin-tier-${tier}`} onClick={onClose}>
      {/* 60fps dynamic coin shower and golden fireworks canvas */}
      <MegaWinParticleCanvas tier={tier} />

      {/* Atmospheric ambient lighting textures */}
      <img
        src="/assets/psd/fx_rays.png"
        alt=""
        className={`bigwin-fx-rays rays-${tier}`}
        draggable={false}
      />
      <img
        src="/assets/psd/fx_pattern.png"
        alt=""
        className={`bigwin-fx-pattern pattern-${tier}`}
        draggable={false}
      />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className={`bigwin-fx-sparks sparks-${tier}`}
        draggable={false}
      />

      <div className={`bigwin-modal tier-${tier}`} onClick={(e) => e.stopPropagation()}>
        <div className={`bigwin-casino-ribbon ribbon-${tier}`}>
          <span className="ribbon-star">★</span>
          <span>{ribbonTitle}</span>
          <span className="ribbon-star">★</span>
        </div>

        {/* Egyptian 3D Royal Gold & Lapis Winged Crest */}
        <div className={`bigwin-neon-banner-wrap banner-${tier}`}>
          <img
            src={crestImage}
            alt={tier === 'ultra' ? 'ULTRA WIN' : tier === 'mega' ? 'MEGA WIN' : 'BIG WIN'}
            className={`bigwin-neon-mega-img crest-${tier}`}
            draggable={false}
          />
        </div>

        <div className="bigwin-tier-subtitle">{bannerSub}</div>

        <div className="bigwin-numbers-stage">
          <div className="neon-psd-digits">
            <PsdGoldNumber value={isSC ? displayCoins.toFixed(2) : displayCoins} height={82} gap={-4} />
          </div>
          <div className="bigwin-cash-sub">
            {isSC ? 'SWEEPS COINS WON • REAL CASH PRIZE: ' : 'TOTAL GOLD COINS WON: '}
            <span className="bigwin-cash-highlight">{isSC ? `$${cashValue} USD` : `${displayCoins.toLocaleString()} GC`}</span>
          </div>
        </div>

        <button
          className={`bigwin-collect-btn collect-${tier}`}
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
