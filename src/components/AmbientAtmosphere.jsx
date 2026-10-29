import React, { useEffect, useRef } from 'react';

/**
 * 2026 Next-Gen Ambient Atmosphere Engine:
 * - Volumetric God Rays (oscillating golden temple sunlight shafts)
 * - 3D Floating Gold Dust & Embers (variable depth, Brownian motion, twinkle)
 * - Dynamic kinetic acceleration during reel spins
 * - Celebratory sparkle bursts during wins
 */
export default function AmbientAtmosphere({ isSpinning = false, hasWin = false, intensity = 1.0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;
    let isMounted = true;

    // Resize handling with device pixel ratio scaling
    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Particle pool (60 3D gold motes)
    const PARTICLE_COUNT = 55;
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * (canvas.clientWidth || 800),
      y: Math.random() * (canvas.clientHeight || 600),
      z: 0.3 + Math.random() * 0.7, // Depth scale
      radius: 0.8 + Math.random() * 2.2,
      baseSpeedX: (Math.random() - 0.5) * 0.35,
      baseSpeedY: -0.2 - Math.random() * 0.45,
      twinkleSpeed: 0.02 + Math.random() * 0.04,
      twinkleOffset: Math.random() * Math.PI * 2,
      hue: Math.random() > 0.25 ? 45 : 185, // 75% 24k Gold, 25% Nile Cyan
      alpha: 0.2 + Math.random() * 0.6,
    }));

    // God Ray shafts (4 soft volumetric beams)
    const godRays = [
      { originX: 0.22, baseAngle: 0.18, width: 90, speed: 0.0006, phase: 0 },
      { originX: 0.45, baseAngle: 0.02, width: 140, speed: 0.0008, phase: 2.1 },
      { originX: 0.72, baseAngle: -0.16, width: 110, speed: 0.0007, phase: 4.2 },
      { originX: 0.88, baseAngle: -0.28, width: 80, speed: 0.0009, phase: 1.4 },
    ];

    let lastTime = performance.now();

    const render = (now) => {
      if (!isMounted) return;
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Volumetric Temple God Rays (Additive screen blend)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < godRays.length; i++) {
        const ray = godRays[i];
        const sway = Math.sin(now * ray.speed + ray.phase) * 0.06;
        const currentAngle = ray.baseAngle + sway;
        const startX = w * ray.originX;
        const startY = -40;

        const rayLen = h * 1.3;
        const endX = startX + Math.sin(currentAngle) * rayLen;
        const endY = startY + Math.cos(currentAngle) * rayLen;

        const rayGrad = ctx.createLinearGradient(startX, startY, endX, endY);
        const rayAlpha = (0.07 + 0.04 * Math.sin(now * 0.0012 + ray.phase)) * intensity;
        rayGrad.addColorStop(0, `rgba(255, 235, 160, ${rayAlpha * 1.4})`);
        rayGrad.addColorStop(0.35, `rgba(245, 190, 70, ${rayAlpha})`);
        rayGrad.addColorStop(0.8, `rgba(217, 119, 6, ${rayAlpha * 0.3})`);
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        const halfW = ray.width * 0.5;
        const endHalfW = ray.width * 2.2;
        ctx.moveTo(startX - halfW, startY);
        ctx.lineTo(startX + halfW, startY);
        ctx.lineTo(endX + endHalfW, endY);
        ctx.lineTo(endX - endHalfW, endY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 2. Draw 3D Floating Gold Dust & Embers
      const spinSpeedBoost = isSpinning ? 2.4 : 1.0;
      const winBurstGlow = hasWin ? 1.6 : 1.0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Kinetic motion with Brownian drift
        const brownian = Math.sin(now * 0.002 + p.twinkleOffset) * 0.3;
        p.x += (p.baseSpeedX + brownian) * p.z * (dt * 60);
        p.y += p.baseSpeedY * spinSpeedBoost * p.z * (dt * 60);

        // Screen boundary wrapping
        if (p.y < -20) {
          p.y = h + 15;
          p.x = Math.random() * w;
        } else if (p.y > h + 20) {
          p.y = -15;
          p.x = Math.random() * w;
        }
        if (p.x < -20) p.x = w + 15;
        else if (p.x > w + 20) p.x = -15;

        // Dynamic twinkle
        const twinkle = 0.5 + 0.5 * Math.sin(now * p.twinkleSpeed + p.twinkleOffset);
        const currentAlpha = Math.min(1, p.alpha * twinkle * winBurstGlow);
        const currentRadius = p.radius * p.z * (hasWin ? 1.3 : 1.0);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Outer soft glow
        const glowGrad = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, currentRadius * 3.5
        );
        if (p.hue === 45) {
          glowGrad.addColorStop(0, `rgba(255, 245, 180, ${currentAlpha})`);
          glowGrad.addColorStop(0.4, `rgba(245, 175, 40, ${currentAlpha * 0.6})`);
          glowGrad.addColorStop(1, 'rgba(217, 119, 6, 0)');
        } else {
          glowGrad.addColorStop(0, `rgba(180, 245, 255, ${currentAlpha})`);
          glowGrad.addColorStop(0.4, `rgba(6, 182, 212, ${currentAlpha * 0.6})`);
          glowGrad.addColorStop(1, 'rgba(14, 116, 144, 0)');
        }

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright inner core
        ctx.fillStyle = p.hue === 45
          ? `rgba(255, 255, 230, ${Math.min(1, currentAlpha * 1.5)})`
          : `rgba(230, 255, 255, ${Math.min(1, currentAlpha * 1.5)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, currentRadius * 0.6), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [isSpinning, hasWin, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="ambient-atmosphere-canvas"
      aria-hidden="true"
    />
  );
}
