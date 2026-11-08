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
  const activeStrikesRef = useRef([]);
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (!strikeEvent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cap DPR at 1.25 for ultra-fast, zero-lag full-viewport additive plasma rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
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
      '.anubis-guardian-column.left-col .guardian-power-orb, .anubis-guardian-column.left-col .guardian-hand-flame, .anubis-guardian-column.left-col, .mpg-anubis'
    )?.getBoundingClientRect();

    const rightCol = document.querySelector(
      '.anubis-guardian-column.right-col .guardian-power-orb, .anubis-guardian-column.right-col, .mpg-bastet'
    )?.getBoundingClientRect();

    const nowInit = performance.now();

    rawStrikes.forEach((raw) => {
      const from = raw.from || 'left';
      const isLeft = from === 'left';
      const isFire = raw.type === 'fire' || (!raw.type && !isLeft);

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

      if (Array.isArray(raw.targetCells) && raw.targetCells.length > 0 && vp) {
        const colW = vp.width / 5;
        const rowH = vp.height / 3;
        raw.targetCells.forEach((cell, idx) => {
          const c = cell[0];
          const r = cell[1];
          const tx = vp.left + (c + 0.5) * colW;
          const ty = vp.top + (r + 0.5) * rowH;
          activeStrikesRef.current.push({
            isFire,
            startX,
            startY,
            endX: tx,
            endY: ty,
            bornAt: nowInit,
            delay: (raw.delay || 0) + idx * 65,
            duration: raw.duration || 480,
          });
        });
      } else {
        const tx =
          raw.targetX || (vp ? vp.left + vp.width * (isLeft ? 0.38 : 0.62) : w * 0.5);
        const ty = raw.targetY || (vp ? vp.top + vp.height * 0.5 : h * 0.45);
        activeStrikesRef.current.push({
          isFire,
          startX,
          startY,
          endX: tx,
          endY: ty,
          bornAt: nowInit,
          delay: raw.delay || 0,
          duration: raw.duration || 520,
        });
      }
    });

    if (activeStrikesRef.current.length === 0) {
      onCompleteRef.current?.();
      return;
    }

    // Fast non-allocating midpoint displacement bolt generator (3 iterations = 8 segments)
    const generateBolt = (x1, y1, x2, y2, displacement) => {
      let segments = [{ x1, y1, x2, y2 }];
      let disp = displacement;
      for (let i = 0; i < 3; i++) {
        const nextSegs = [];
        for (let j = 0; j < segments.length; j++) {
          const seg = segments[j];
          const midX = (seg.x1 + seg.x2) * 0.5;
          const midY = (seg.y1 + seg.y2) * 0.5;
          const normalX = -(seg.y2 - seg.y1);
          const normalY = seg.x2 - seg.x1;
          const len = Math.hypot(normalX, normalY);
          const offset = (Math.random() - 0.5) * disp;
          const midPointX = midX + (len > 0 ? (normalX / len) * offset : 0);
          const midPointY = midY + (len > 0 ? (normalY / len) * offset : 0);
          nextSegs.push({ x1: seg.x1, y1: seg.y1, x2: midPointX, y2: midPointY });
          nextSegs.push({ x1: midPointX, y1: midPointY, x2: seg.x2, y2: seg.y2 });
        }
        segments = nextSegs;
        disp *= 0.5;
      }
      return segments;
    };

    if (rafIdRef.current) return; // Already running RAF loop for queued strikes

    const render = (now) => {
      ctx.clearRect(0, 0, w, h);

      const list = activeStrikesRef.current;
      let writeIdx = 0;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < list.length; i++) {
        const st = list[i];
        const elapsed = now - st.bornAt - st.delay;
        if (elapsed < 0) {
          list[writeIdx++] = st;
          continue;
        }

        const progress = elapsed / st.duration;
        if (progress >= 1) {
          continue;
        }
        list[writeIdx++] = st;

        const travelRatio = Math.min(1, progress * 1.65);
        const currentX = st.startX + (st.endX - st.startX) * travelRatio;
        const currentY = st.startY + (st.endY - st.startY) * travelRatio;

        if (st.isFire) {
          // ================= Queen Bastet Solar Fireball & Plasma Beam (Zero shadowBlur) =================
          const stepCount = 5;
          for (let s = 0; s < stepCount; s++) {
            const trailRatio = s / stepCount;
            const trailX =
              st.startX +
              (currentX - st.startX) * (1 - trailRatio * 0.42) +
              (Math.random() - 0.5) * (trailRatio * 14);
            const trailY =
              st.startY +
              (currentY - st.startY) * (1 - trailRatio * 0.42) +
              (Math.random() - 0.5) * (trailRatio * 14);
            const radius = (1 - trailRatio) * 16 + 4;

            const grad = ctx.createRadialGradient(trailX, trailY, 1, trailX, trailY, radius);
            grad.addColorStop(0, '#fffbeb');
            grad.addColorStop(0.35, '#fbbf24');
            grad.addColorStop(0.75, '#ef4444');
            grad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(trailX, trailY, radius, 0, Math.PI * 2);
            ctx.fill();
          }

          // Head of the solar projectile
          const headGrad = ctx.createRadialGradient(currentX, currentY, 2, currentX, currentY, 28);
          headGrad.addColorStop(0, '#ffffff');
          headGrad.addColorStop(0.3, '#fde047');
          headGrad.addColorStop(0.75, '#ea580c');
          headGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = headGrad;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 28, 0, Math.PI * 2);
          ctx.fill();

          if (progress > 0.52) {
            const impactProgress = (progress - 0.52) / 0.48;
            const impactR = 22 + impactProgress * 62;
            const expGrad = ctx.createRadialGradient(st.endX, st.endY, 2, st.endX, st.endY, impactR);
            expGrad.addColorStop(0, '#ffffff');
            expGrad.addColorStop(0.28, '#fde047');
            expGrad.addColorStop(0.65, '#ea580c');
            expGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = expGrad;
            ctx.beginPath();
            ctx.arc(st.endX, st.endY, impactR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - impactProgress).toFixed(2)})`;
            ctx.lineWidth = 3.5 * (1 - impactProgress);
            ctx.beginPath();
            ctx.arc(st.endX, st.endY, impactR * 0.88, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          // ================= Anubis High-Voltage Lightning Bolt (Zero shadowBlur) =================
          const branches = progress < 0.72 ? 2 : 1;
          for (let b = 0; b < branches; b++) {
            const segments = generateBolt(st.startX, st.startY, currentX, currentY, 46);

            // Wide translucent electric aura (replaces slow ctx.shadowBlur!)
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.38)';
            ctx.lineWidth = 18;
            ctx.beginPath();
            for (let idx = 0; idx < segments.length; idx++) {
              const seg = segments[idx];
              if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
            }
            ctx.stroke();

            // Intense cyan laser filament
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 6;
            ctx.beginPath();
            for (let idx = 0; idx < segments.length; idx++) {
              const seg = segments[idx];
              if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
            }
            ctx.stroke();

            // Pure white hot core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let idx = 0; idx < segments.length; idx++) {
              const seg = segments[idx];
              if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
            }
            ctx.stroke();
          }

          if (progress > 0.45) {
            const impactProgress = (progress - 0.45) / 0.55;
            const impactR = 18 + impactProgress * 58;
            const impGrad = ctx.createRadialGradient(st.endX, st.endY, 2, st.endX, st.endY, impactR);
            impGrad.addColorStop(0, '#ffffff');
            impGrad.addColorStop(0.32, '#00f0ff');
            impGrad.addColorStop(0.7, 'rgba(29, 78, 216, 0.45)');
            impGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = impGrad;
            ctx.beginPath();
            ctx.arc(st.endX, st.endY, impactR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      list.length = writeIdx;
      ctx.restore();

      if (list.length > 0) {
        rafIdRef.current = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafIdRef.current = null;
        onCompleteRef.current?.();
      }
    };

    rafIdRef.current = requestAnimationFrame(render);
  }, [strikeEvent]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

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
