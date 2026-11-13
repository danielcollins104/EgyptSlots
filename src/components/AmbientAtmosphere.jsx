import React, { memo, useEffect, useRef } from 'react';
import { smoothPerformance } from '../plugins/smoothPerformancePlugin';

/**
 * AmbientAtmosphere: High-performance 3D atmospheric lighting and particle system.
 *
 * Zero-Jank Architecture:
 * - Caches viewport dimensions via ResizeObserver (NEVER reads clientWidth/getBoundingClientRect inside rAF!)
 * - Suspends completely during active reel spins (`isSpinning`) so 100% of GPU belongs to the reels
 * - Automatically suspends on 'lite' hardware tier to preserve battery & thermal headroom
 * - Pre-rendered offscreen sprite textures eliminate per-frame gradient allocations
 */
const AmbientAtmosphere = memo(function AmbientAtmosphere({
  isSpinning = false,
  hasWin = false,
  intensity = 1.0,
}) {
  const canvasRef = useRef(null);
  const isSpinningRef = useRef(isSpinning);
  const hasWinRef = useRef(hasWin);
  const intensityRef = useRef(intensity);
  const schedulerRef = useRef(null);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
    schedulerRef.current?.syncLoopState?.();
  }, [isSpinning]);

  useEffect(() => {
    hasWinRef.current = hasWin;
  }, [hasWin]);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let isMounted = true;
    let animId = null;
    let cachedW = 800;
    let cachedH = 600;
    let currentProfile = smoothPerformance.getProfile();

    const applyResize = (width, height) => {
      if (!canvas || !isMounted) return;
      cachedW = Math.max(1, Math.round(width || canvas.offsetWidth || 800));
      cachedH = Math.max(1, Math.round(height || canvas.offsetHeight || 600));
      const dpr = Math.min(window.devicePixelRatio || 1, currentProfile.maxCanvasDpr, 1.25);
      const targetW = Math.round(cachedW * dpr);
      const targetH = Math.round(cachedH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rectInit = canvas.getBoundingClientRect();
    applyResize(rectInit.width, rectInit.height);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        const cr = entries[0]?.contentRect;
        if (cr) applyResize(cr.width, cr.height);
      });
      ro.observe(canvas);
    } else {
      const onWinResize = () => {
        const r = canvas.getBoundingClientRect();
        applyResize(r.width, r.height);
      };
      window.addEventListener('resize', onWinResize, { passive: true });
    }

    const createParticleSprite = (inner, mid, outer) => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const cCtx = c.getContext('2d');
      const grad = cCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, inner);
      grad.addColorStop(0.35, mid);
      grad.addColorStop(1, outer);
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(16, 16, 16, 0, Math.PI * 2);
      cCtx.fill();
      return c;
    };

    const goldSprite = createParticleSprite(
      'rgba(255, 255, 230, 0.95)',
      'rgba(245, 175, 40, 0.55)',
      'rgba(217, 119, 6, 0)'
    );
    const cyanSprite = createParticleSprite(
      'rgba(230, 255, 255, 0.95)',
      'rgba(6, 182, 212, 0.55)',
      'rgba(14, 116, 144, 0)'
    );

    const createGodRaySprite = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 256;
      const cCtx = c.getContext('2d');
      const grad = cCtx.createLinearGradient(32, 0, 32, 256);
      grad.addColorStop(0, 'rgba(255, 235, 160, 0.14)');
      grad.addColorStop(0.45, 'rgba(245, 190, 70, 0.07)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.moveTo(20, 0);
      cCtx.lineTo(44, 0);
      cCtx.lineTo(64, 256);
      cCtx.lineTo(0, 256);
      cCtx.closePath();
      cCtx.fill();
      return c;
    };
    const godRaySprite = createGodRaySprite();

    const PARTICLE_COUNT = 16;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * cachedW,
      y: Math.random() * cachedH,
      z: 0.3 + Math.random() * 0.7,
      radius: 0.8 + Math.random() * 1.9,
      baseSpeedX: (Math.random() - 0.5) * 0.28,
      baseSpeedY: -0.14 - Math.random() * 0.32,
      twinkleSpeed: 0.002 + Math.random() * 0.002,
      twinkleOffset: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.25 ? 45 : 185,
      alpha: 0.2 + Math.random() * 0.48,
    }));

    const godRays = [
      { originX: 0.22, baseAngle: 0.16, width: 110, speed: 0.0005, phase: 0 },
      { originX: 0.5, baseAngle: 0.02, width: 140, speed: 0.0007, phase: 2.1 },
      { originX: 0.76, baseAngle: -0.15, width: 115, speed: 0.0006, phase: 4.2 },
    ];

    let lastTime = performance.now();
    let frameSkip = 0;

    const shouldRun = () =>
      isMounted &&
      !document.hidden &&
      !isSpinningRef.current &&
      Boolean(currentProfile.enableAmbientCanvas);

    const stopLoop = (clearCanvas = false) => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      if (clearCanvas) {
        ctx.clearRect(0, 0, cachedW, cachedH);
      }
    };

    const render = (now) => {
      animId = null;
      if (!shouldRun()) return;

      // Run idle ambient atmosphere at an efficient 30 FPS (every 2nd vblank)
      frameSkip = (frameSkip + 1) & 1;
      if (frameSkip !== 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(0.06, (now - lastTime) / 1000);
      lastTime = now;

      const w = cachedW;
      const h = cachedH;
      ctx.clearRect(0, 0, w, h);

      const curIntensity = intensityRef.current || 1.0;
      const curHasWin = hasWinRef.current;

      // 1. Pre-baked Volumetric Temple God Rays (high tier only, zero per-frame gradient creation)
      if (currentProfile.enableGodRays) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < godRays.length; i++) {
          const ray = godRays[i];
          const sway = Math.sin(now * ray.speed + ray.phase) * 0.04;
          ctx.save();
          ctx.translate(w * ray.originX, -20);
          ctx.rotate(-(ray.baseAngle + sway));
          ctx.globalAlpha = Math.min(1, (0.65 + 0.25 * Math.sin(now * 0.001 + ray.phase)) * curIntensity);
          ctx.drawImage(godRaySprite, -ray.width * 0.5, 0, ray.width, h * 1.15);
          ctx.restore();
        }
        ctx.restore();
      }

      // 2. Floating Gold & Sapphire Dust Motes
      const activeCount = currentProfile.tier === 'balanced' ? 10 : PARTICLE_COUNT;
      const winBurstGlow = curHasWin ? 1.35 : 1.0;

      ctx.save();
      for (let i = 0; i < activeCount; i++) {
        const p = particles[i];
        p.x += p.baseSpeedX * p.z * (dt * 60);
        p.y += p.baseSpeedY * p.z * (dt * 60);

        if (p.y < -15) {
          p.y = h + 15;
          p.x = Math.random() * w;
        } else if (p.y > h + 15) {
          p.y = -15;
          p.x = Math.random() * w;
        }
        if (p.x < -15) p.x = w + 15;
        else if (p.x > w + 15) p.x = -15;

        const twinkle = 0.5 + 0.5 * Math.sin(now * p.twinkleSpeed + p.twinkleOffset);
        const currentAlpha = Math.min(1, p.alpha * twinkle * winBurstGlow);
        const drawSize = p.radius * p.z * 3;

        ctx.globalAlpha = currentAlpha;
        const sprite = p.hue === 45 ? goldSprite : cyanSprite;
        ctx.drawImage(sprite, p.x - drawSize, p.y - drawSize, drawSize * 2, drawSize * 2);
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const syncLoopState = () => {
      if (shouldRun()) {
        if (animId === null) {
          lastTime = performance.now();
          animId = requestAnimationFrame(render);
        }
      } else {
        stopLoop(!currentProfile.enableAmbientCanvas);
      }
    };

    schedulerRef.current = { syncLoopState };

    const unsubPerf = smoothPerformance.subscribe((snap) => {
      currentProfile = snap.profile;
      syncLoopState();
    });

    const handleVisibility = () => syncLoopState();
    document.addEventListener('visibilitychange', handleVisibility);

    syncLoopState();

    return () => {
      isMounted = false;
      schedulerRef.current = null;
      stopLoop(false);
      ro?.disconnect?.();
      unsubPerf();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ambient-atmosphere-canvas"
      aria-hidden="true"
    />
  );
});

export default AmbientAtmosphere;
