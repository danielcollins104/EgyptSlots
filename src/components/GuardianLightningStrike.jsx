import React, { useEffect, useRef } from 'react';

/**
 * 2026 Guardian Lightning & Fire Strike Engine:
 * Renders high-voltage electric plasma arcs & sacred solar fire bolts
 * thrown from Anubis (left) or Queen Bastet (right) directly into the reel symbols!
 */
export default function GuardianLightningStrike({ strikeEvent = null, onComplete }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!strikeEvent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // Strike origin: Left guardian (Anubis staff) or Right guardian (Bastet scepter)
    const isLeft = strikeEvent.from === 'left';
    const startX = isLeft ? w * 0.08 : w * 0.92;
    const startY = h * (0.28 + Math.random() * 0.1);

    // Target coords on screen (reel cell position or center)
    const endX = strikeEvent.targetX || w * (0.35 + Math.random() * 0.3);
    const endY = strikeEvent.targetY || h * (0.35 + Math.random() * 0.3);

    const isFire = strikeEvent.type === 'fire' || !isLeft; // Bastet throws solar fire, Anubis throws blue lightning
    const mainColor = isFire ? '#fbbf24' : '#38bdf8';
    const coreColor = '#ffffff';
    const secondaryColor = isFire ? '#ef4444' : '#818cf8';

    let startTime = performance.now();
    const duration = 650; // ms
    let animId = null;

    // Generate jagged bolt segments
    const generateBolt = (x1, y1, x2, y2, displacement, iterations) => {
      let segments = [{ x1, y1, x2, y2 }];
      for (let i = 0; i < iterations; i++) {
        const nextSegs = [];
        for (let j = 0; j < segments.length; j++) {
          const seg = segments[j];
          const midX = (seg.x1 + seg.x2) / 2;
          const midY = (seg.y1 + seg.y2) / 2;
          const normalX = -(seg.y2 - seg.y1);
          const normalY = seg.x2 - seg.x1;
          const len = Math.hypot(normalX, normalY);
          const offset = (Math.random() - 0.5) * displacement;
          const midPointX = midX + (len > 0 ? (normalX / len) * offset : 0);
          const midPointY = midY + (len > 0 ? (normalY / len) * offset : 0);
          nextSegs.push({ x1: seg.x1, y1: seg.y1, x2: midPointX, y2: midPointY });
          nextSegs.push({ x1: midPointX, y1: midPointY, x2: seg.x2, y2: seg.y2 });
        }
        segments = nextSegs;
        displacement *= 0.5;
      }
      return segments;
    };

    const render = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, w, h);

      if (progress < 0.85) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Draw multiple crackling energetic branches
        const branchCount = isFire ? 3 : 4;
        for (let b = 0; b < branchCount; b++) {
          const segments = generateBolt(startX, startY, endX, endY, 65, 4);

          // Outer aura glow
          ctx.strokeStyle = secondaryColor;
          ctx.lineWidth = 10 + Math.random() * 4;
          ctx.shadowColor = mainColor;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          segments.forEach((seg, idx) => {
            if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          });
          ctx.stroke();

          // Main color beam
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 4.5 + Math.random() * 2;
          ctx.beginPath();
          segments.forEach((seg, idx) => {
            if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          });
          ctx.stroke();

          // Intense core filament
          ctx.strokeStyle = coreColor;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          segments.forEach((seg, idx) => {
            if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          });
          ctx.stroke();
        }

        // Impact explosion at target
        const impactR = 15 + progress * 40;
        const impactGrad = ctx.createRadialGradient(endX, endY, 2, endX, endY, impactR);
        impactGrad.addColorStop(0, '#ffffff');
        impactGrad.addColorStop(0.3, mainColor);
        impactGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = impactGrad;
        ctx.beginPath();
        ctx.arc(endX, endY, impactR, 0, Math.PI * 2);
        ctx.fill();

        // Expanding shockwave ring at target
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(endX, endY, impactR * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        onComplete?.();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [strikeEvent, onComplete]);

  if (!strikeEvent) return null;

  return (
    <canvas
      ref={canvasRef}
      className="guardian-lightning-canvas"
      aria-hidden="true"
    />
  );
}
