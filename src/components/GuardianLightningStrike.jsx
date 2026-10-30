import React, { useEffect, useRef } from 'react';

/**
 * 2026 Guardian Dynamic Lightning & Fire Projectile Strike Engine:
 * Renders high-voltage electric plasma arcs from Anubis (left) and
 * sacred blazing solar firebolts from Queen Bastet (right) directly
 * targeting winning symbol cells, scatter relics, and expanding wilds!
 */
export default function GuardianLightningStrike({ strikeEvent = null, onComplete }) {
  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    if (!strikeEvent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Resolve strike items: single strike or multi-strike array
    const rawStrikes = Array.isArray(strikeEvent.strikes)
      ? strikeEvent.strikes
      : [strikeEvent];

    // Compute screen coordinates
    const vp =
      document.querySelector('.reel-window-viewport')?.getBoundingClientRect() ||
      document.querySelector('.reel-cabinet-box')?.getBoundingClientRect();

    const leftCol = document.querySelector(
      '.anubis-guardian-column.left-col .guardian-power-orb, .anubis-guardian-column.left-col .guardian-hand-flame, .anubis-guardian-column.left-col'
    )?.getBoundingClientRect();

    const rightCol = document.querySelector(
      '.anubis-guardian-column.right-col .guardian-power-orb, .anubis-guardian-column.right-col'
    )?.getBoundingClientRect();

    const strikes = [];

    rawStrikes.forEach((raw) => {
      const from = raw.from || 'left';
      const isLeft = from === 'left';
      const isFire = raw.type === 'fire' || !isLeft;

      let startX, startY;
      if (isLeft) {
        if (leftCol && leftCol.width > 0) {
          startX = leftCol.right - 10;
          startY = leftCol.top + leftCol.height * 0.35;
        } else {
          startX = 30;
          startY = vp ? vp.top + vp.height * 0.5 : h * 0.45;
        }
      } else {
        if (rightCol && rightCol.width > 0) {
          startX = rightCol.left + 10;
          startY = rightCol.top + rightCol.height * 0.35;
        } else {
          startX = w - 30;
          startY = vp ? vp.top + vp.height * 0.5 : h * 0.45;
        }
      }

      // If specific grid cells are targeted: [[col, row], ...]
      if (Array.isArray(raw.targetCells) && raw.targetCells.length > 0 && vp) {
        const colW = vp.width / 5;
        const rowH = vp.height / 3;
        raw.targetCells.forEach((cell, idx) => {
          const c = cell[0];
          const r = cell[1];
          const tx = vp.left + (c + 0.5) * colW;
          const ty = vp.top + (r + 0.5) * rowH;
          strikes.push({
            isFire,
            startX,
            startY,
            endX: tx,
            endY: ty,
            delay: (raw.delay || 0) + idx * 75,
            duration: 520,
          });
        });
      } else {
        // Fallback to targetX/Y or reel center
        const tx =
          raw.targetX || (vp ? vp.left + vp.width * (isLeft ? 0.38 : 0.62) : w * 0.5);
        const ty = raw.targetY || (vp ? vp.top + vp.height * 0.5 : h * 0.45);
        strikes.push({
          isFire,
          startX,
          startY,
          endX: tx,
          endY: ty,
          delay: raw.delay || 0,
          duration: 580,
        });
      }
    });

    if (strikes.length === 0) {
      onCompleteRef.current?.();
      return;
    }

    // Bolt generator for electric lightning
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

    let startTime = performance.now();
    let animId = null;
    isAnimatingRef.current = true;

    const render = (now) => {
      const elapsedTotal = now - startTime;
      ctx.clearRect(0, 0, w, h);

      let anyAlive = false;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      strikes.forEach((st) => {
        const elapsed = elapsedTotal - st.delay;
        if (elapsed < 0) {
          anyAlive = true;
          return;
        }

        const progress = Math.min(1, elapsed / st.duration);
        if (progress < 1) {
          anyAlive = true;

          const currentX = st.startX + (st.endX - st.startX) * Math.min(1, progress * 1.5);
          const currentY = st.startY + (st.endY - st.startY) * Math.min(1, progress * 1.5);

          if (st.isFire) {
            // ================= Queen Bastet Solar Fireball & Plasma Jet =================
            // Projectile head & trailing embers
            const mainColor = '#fbbf24';
            const flameColor = '#ef4444';
            const coreColor = '#fffbeb';

            // Fireball trailing smoke & spark stream
            const stepCount = 8;
            for (let s = 0; s < stepCount; s++) {
              const trailRatio = s / stepCount;
              const trailX =
                st.startX +
                (currentX - st.startX) * (1 - trailRatio * 0.45) +
                (Math.random() - 0.5) * (trailRatio * 18);
              const trailY =
                st.startY +
                (currentY - st.startY) * (1 - trailRatio * 0.45) +
                (Math.random() - 0.5) * (trailRatio * 18);
              const radius = (1 - trailRatio) * (14 + Math.random() * 8);

              const grad = ctx.createRadialGradient(
                trailX,
                trailY,
                1,
                trailX,
                trailY,
                radius
              );
              grad.addColorStop(0, coreColor);
              grad.addColorStop(0.35, mainColor);
              grad.addColorStop(0.75, flameColor);
              grad.addColorStop(1, 'rgba(0,0,0,0)');

              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(trailX, trailY, radius, 0, Math.PI * 2);
              ctx.fill();
            }

            // Head of the solar projectile
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 24;
            const headGrad = ctx.createRadialGradient(
              currentX,
              currentY,
              2,
              currentX,
              currentY,
              26
            );
            headGrad.addColorStop(0, '#ffffff');
            headGrad.addColorStop(0.3, '#fbbf24');
            headGrad.addColorStop(0.8, '#ea580c');
            headGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = headGrad;
            ctx.beginPath();
            ctx.arc(currentX, currentY, 26, 0, Math.PI * 2);
            ctx.fill();

            // Impact detonation when head reaches target (progress > 0.65)
            if (progress > 0.6) {
              const impactProgress = (progress - 0.6) / 0.4;
              const impactR = 20 + impactProgress * 65;

              // Solar nova explosion
              const expGrad = ctx.createRadialGradient(
                st.endX,
                st.endY,
                2,
                st.endX,
                st.endY,
                impactR
              );
              expGrad.addColorStop(0, '#ffffff');
              expGrad.addColorStop(0.25, '#fbbf24');
              expGrad.addColorStop(0.65, '#ea580c');
              expGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = expGrad;
              ctx.beginPath();
              ctx.arc(st.endX, st.endY, impactR, 0, Math.PI * 2);
              ctx.fill();

              // Shockwave ring
              ctx.strokeStyle = `rgba(251, 191, 36, ${1 - impactProgress})`;
              ctx.lineWidth = 4 * (1 - impactProgress);
              ctx.beginPath();
              ctx.arc(st.endX, st.endY, impactR * 0.9, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else {
            // ================= Anubis High-Voltage Lightning Bolt =================
            const mainColor = '#00f0ff';
            const secondaryColor = '#3b82f6';
            const coreColor = '#ffffff';

            const branches = progress < 0.7 ? 4 : 2;
            for (let b = 0; b < branches; b++) {
              const segments = generateBolt(
                st.startX,
                st.startY,
                currentX,
                currentY,
                55,
                4
              );

              // Outer aura glow
              ctx.strokeStyle = secondaryColor;
              ctx.lineWidth = 14 + Math.random() * 4;
              ctx.shadowColor = mainColor;
              ctx.shadowBlur = 24;
              ctx.beginPath();
              segments.forEach((seg, idx) => {
                if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
              });
              ctx.stroke();

              // Intense cyan laser filament
              ctx.strokeStyle = mainColor;
              ctx.lineWidth = 5 + Math.random() * 2;
              ctx.beginPath();
              segments.forEach((seg, idx) => {
                if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
              });
              ctx.stroke();

              // Pure white core
              ctx.strokeStyle = coreColor;
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              segments.forEach((seg, idx) => {
                if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
              });
              ctx.stroke();
            }

            // Impact plasma explosion at target symbol
            if (progress > 0.5) {
              const impactProgress = (progress - 0.5) / 0.5;
              const impactR = 15 + impactProgress * 60;

              const impGrad = ctx.createRadialGradient(
                st.endX,
                st.endY,
                2,
                st.endX,
                st.endY,
                impactR
              );
              impGrad.addColorStop(0, '#ffffff');
              impGrad.addColorStop(0.3, '#00f0ff');
              impGrad.addColorStop(0.7, '#1d4ed8');
              impGrad.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = impGrad;
              ctx.beginPath();
              ctx.arc(st.endX, st.endY, impactR, 0, Math.PI * 2);
              ctx.fill();

              // Crackling mini arcs leaping around target
              for (let mini = 0; mini < 3; mini++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = impactR * (0.6 + Math.random() * 0.4);
                const mx = st.endX + Math.cos(angle) * dist;
                const my = st.endY + Math.sin(angle) * dist;
                const miniSegs = generateBolt(st.endX, st.endY, mx, my, 18, 2);
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                miniSegs.forEach((s, idx) => {
                  if (idx === 0) ctx.moveTo(s.x1, s.y1);
                  ctx.lineTo(s.x2, s.y2);
                });
                ctx.stroke();
              }
            }
          }
        }
      });

      ctx.restore();

      if (anyAlive) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        isAnimatingRef.current = false;
        onCompleteRef.current?.();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      isAnimatingRef.current = false;
    };
  }, [strikeEvent]);

  return (
    <canvas
      ref={canvasRef}
      className="guardian-lightning-canvas"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
