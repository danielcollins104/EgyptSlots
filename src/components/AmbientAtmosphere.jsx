import React, { useEffect, useRef } from 'react';

/**
 * AmbientAtmosphere: High-performance 3D atmospheric lighting and particle system.
 *
 * Performance-Hardened Architecture:
 * - Pre-rendered offscreen sprite textures eliminate dynamic gradient allocations/sec
 * - Single persistent RAF loop via refs; zero component re-mounting on spin state changes
 * - Automatic background throttling during active spins so 100% of GPU belongs to the reels
 * - Lifecycle visibility listener pauses RAF loop when document is hidden to eliminate thermal load
 */
export default function AmbientAtmosphere({
  isSpinning = false,
  hasWin = false,
  intensity = 1.0,
}) {
  const canvasRef = useRef(null);
  const isSpinningRef = useRef(isSpinning);
  const hasWinRef = useRef(hasWin);
  const intensityRef = useRef(intensity);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  useEffect(() => {
    hasWinRef.current = hasWin;
  }, [hasWin]);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;
    let animId = null;

    // Resize handling with device pixel ratio scaling capped at 1.5 for performance
    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Pre-rendered offscreen particle textures (eliminates dynamic gradient allocations/sec)
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

    // Optimized particle pool (20 motes provide atmospheric depth with zero thermal overhead)
    const PARTICLE_COUNT = 20;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * (canvas.clientWidth || 800),
      y: Math.random() * (canvas.clientHeight || 600),
      z: 0.3 + Math.random() * 0.7,
      radius: 0.8 + Math.random() * 2.0,
      baseSpeedX: (Math.random() - 0.5) * 0.3,
      baseSpeedY: -0.15 - Math.random() * 0.35,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      twinkleOffset: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.25 ? 45 : 185,
      alpha: 0.2 + Math.random() * 0.5,
    }));

    // Pre-calculated god ray templates
    const godRays = [
      { originX: 0.22, baseAngle: 0.18, width: 80, speed: 0.0006, phase: 0 },
      { originX: 0.45, baseAngle: 0.02, width: 120, speed: 0.0008, phase: 2.1 },
      { originX: 0.72, baseAngle: -0.16, width: 95, speed: 0.0007, phase: 4.2 },
    ];

    let lastTime = performance.now();
    let frameSkip = 0;

    const render = (now) => {
      if (!isMounted) return;
      const dt = Math.min(0.06, (now - lastTime) / 1000);
      lastTime = now;

      // When reels are actively spinning, throttle atmosphere to 30fps to guarantee 100% GPU budget for reels
      if (isSpinningRef.current) {
        frameSkip = (frameSkip + 1) % 2;
        if (frameSkip !== 0) {
          animId = requestAnimationFrame(render);
          return;
        }
      }

      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;

      ctx.clearRect(0, 0, w, h);

      const curIntensity = intensityRef.current || 1.0;
      const curSpinning = isSpinningRef.current;
      const curHasWin = hasWinRef.current;

      // 1. Draw Volumetric Temple God Rays (skip while spinning to preserve fill rate)
      if (!curSpinning) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < godRays.length; i++) {
          const ray = godRays[i];
          const sway = Math.sin(now * ray.speed + ray.phase) * 0.05;
          const currentAngle = ray.baseAngle + sway;
          const startX = w * ray.originX;
          const startY = -30;

          const rayLen = h * 1.2;
          const endX = startX + Math.sin(currentAngle) * rayLen;
          const endY = startY + Math.cos(currentAngle) * rayLen;

          const rayGrad = ctx.createLinearGradient(startX, startY, endX, endY);
          const rayAlpha = (0.05 + 0.03 * Math.sin(now * 0.001 + ray.phase)) * curIntensity;
          rayGrad.addColorStop(0, `rgba(255, 235, 160, ${rayAlpha * 1.3})`);
          rayGrad.addColorStop(0.4, `rgba(245, 190, 70, ${rayAlpha * 0.8})`);
          rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = rayGrad;
          ctx.beginPath();
          const halfW = ray.width * 0.5;
          const endHalfW = ray.width * 1.8;
          ctx.moveTo(startX - halfW, startY);
          ctx.lineTo(startX + halfW, startY);
          ctx.lineTo(endX + endHalfW, endY);
          ctx.lineTo(endX - endHalfW, endY);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Draw Floating Gold Dust Particles
      const winBurstGlow = curHasWin ? 1.4 : 1.0;

      ctx.save();
      for (let i = 0; i < particles.length; i++) {
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
        const currentRadius = p.radius * p.z;
        const drawSize = currentRadius * 3;

        ctx.globalAlpha = currentAlpha;
        const sprite = p.hue === 45 ? goldSprite : cyanSprite;
        ctx.drawImage(sprite, p.x - drawSize, p.y - drawSize, drawSize * 2, drawSize * 2);
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (animId) cancelAnimationFrame(animId);
      } else {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
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
}
