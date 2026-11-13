import React, { memo, useEffect, useRef } from 'react';
import { smoothPerformance } from '../plugins/smoothPerformancePlugin';

// Pre-rendered offscreen plasma/fireball textures so strike animations never allocate per-frame radial gradients!
let cachedSprites = null;
function getStrikeSprites() {
  if (cachedSprites || typeof document === 'undefined') return cachedSprites;

  const makeRadial = (size, stops) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 1, half, half, half);
    stops.forEach(([pos, col]) => grad.addColorStop(pos, col));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
    return c;
  };

  cachedSprites = {
    fireTrail: makeRadial(64, [
      [0, '#fffbeb'],
      [0.35, '#fbbf24'],
      [0.75, '#ef4444'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    fireHead: makeRadial(80, [
      [0, '#ffffff'],
      [0.3, '#fde047'],
      [0.75, '#ea580c'],
      [1, 'rgba(239, 68, 68, 0)'],
    ]),
    lightningImpact: makeRadial(96, [
      [0, '#ffffff'],
      [0.32, '#00f0ff'],
      [0.7, 'rgba(29, 78, 216, 0.45)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
  };
  return cachedSprites;
}

/**
 * 2026 Guardian Dynamic Lightning & Fire Projectile Strike Engine:
 * Caches DOM geometry on resize (zero synchronous reflows on reel slam!) and uses
 * pre-baked radial plasma sprites for silky 60fps projectile arcs on every phone.
 */
const GuardianLightningStrike = memo(function GuardianLightningStrike({
  strikeEvent = null,
  onComplete,
}) {
  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const activeStrikesRef = useRef([]);
  const rafIdRef = useRef(null);
  const layoutCacheRef = useRef({ vp: null, leftCol: null, rightCol: null, w: 0, h: 0 });

  useEffect(() => {
    const refreshBounds = () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const vp =
        document.querySelector('.reel-window-viewport')?.getBoundingClientRect() ||
        document.querySelector('.reel-cabinet-box')?.getBoundingClientRect() ||
        null;
      const leftCol =
        document
          .querySelector(
            '.anubis-guardian-column.left-col .guardian-power-orb, .anubis-guardian-column.left-col, .mpg-anubis'
          )
          ?.getBoundingClientRect() || null;
      const rightCol =
        document
          .querySelector(
            '.anubis-guardian-column.right-col .guardian-power-orb, .anubis-guardian-column.right-col, .mpg-bastet'
          )
          ?.getBoundingClientRect() || null;
      layoutCacheRef.current = {
        vp,
        leftCol,
        rightCol,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    };

    const initTimer = setTimeout(refreshBounds, 350);
    window.addEventListener('resize', refreshBounds, { passive: true });
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', refreshBounds);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!strikeEvent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sprites = getStrikeSprites();
    const isLite = smoothPerformance.getTier() === 'lite';
    const dpr = Math.min(window.devicePixelRatio || 1, isLite ? 1.0 : 1.25);

    let { vp, leftCol, rightCol, w, h } = layoutCacheRef.current;
    if (!vp || vp.width === 0 || !w) {
      w = window.innerWidth;
      h = window.innerHeight;
      vp =
        document.querySelector('.reel-window-viewport')?.getBoundingClientRect() ||
        document.querySelector('.reel-cabinet-box')?.getBoundingClientRect() ||
        null;
      layoutCacheRef.current.vp = vp;
      layoutCacheRef.current.w = w;
      layoutCacheRef.current.h = h;
    }

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rawStrikes = Array.isArray(strikeEvent.strikes)
      ? strikeEvent.strikes
      : [strikeEvent];

    const nowInit = performance.now();

    rawStrikes.forEach((raw) => {
      const from = raw.from || 'left';
      const isLeft = from === 'left';
      const isFire = raw.type === 'fire' || (!raw.type && !isLeft);

      let startX;
      let startY;
      if (isLeft) {
        if (leftCol && leftCol.width > 0) {
          startX = leftCol.right - 10;
          startY = leftCol.top + leftCol.height * 0.35;
        } else {
          startX = 30;
          startY = vp ? vp.top + vp.height * 0.5 : h * 0.45;
        }
      } else if (rightCol && rightCol.width > 0) {
        startX = rightCol.left + 10;
        startY = rightCol.top + rightCol.height * 0.35;
      } else {
        startX = w - 30;
        startY = vp ? vp.top + vp.height * 0.5 : h * 0.45;
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
        const tx = raw.targetX || (vp ? vp.left + vp.width * (isLeft ? 0.38 : 0.62) : w * 0.5);
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

    const generateBolt = (x1, y1, x2, y2, displacement) => {
      let segments = [{ x1, y1, x2, y2 }];
      let disp = displacement;
      const iterations = isLite ? 2 : 3;
      for (let i = 0; i < iterations; i++) {
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

    if (rafIdRef.current) return;

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
          const stepCount = isLite ? 3 : 5;
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
            const sz = ((1 - trailRatio) * 16 + 4) * 2;
            if (sprites?.fireTrail) {
              ctx.drawImage(sprites.fireTrail, trailX - sz / 2, trailY - sz / 2, sz, sz);
            }
          }

          if (sprites?.fireHead) {
            ctx.drawImage(sprites.fireHead, currentX - 28, currentY - 28, 56, 56);
          }

          if (progress > 0.52 && sprites?.fireHead) {
            const impactProgress = (progress - 0.52) / 0.48;
            const impactR = 22 + impactProgress * 62;
            ctx.globalAlpha = Math.max(0, 1 - impactProgress * 0.65);
            ctx.drawImage(
              sprites.fireHead,
              st.endX - impactR,
              st.endY - impactR,
              impactR * 2,
              impactR * 2
            );
            ctx.globalAlpha = 1;
          }
        } else {
          const branches = !isLite && progress < 0.72 ? 2 : 1;
          for (let b = 0; b < branches; b++) {
            const segments = generateBolt(st.startX, st.startY, currentX, currentY, 46);

            ctx.strokeStyle = 'rgba(59, 130, 246, 0.38)';
            ctx.lineWidth = 18;
            ctx.beginPath();
            for (let idx = 0; idx < segments.length; idx++) {
              const seg = segments[idx];
              if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
            }
            ctx.stroke();

            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 6;
            ctx.beginPath();
            for (let idx = 0; idx < segments.length; idx++) {
              const seg = segments[idx];
              if (idx === 0) ctx.moveTo(seg.x1, seg.y1);
              ctx.lineTo(seg.x2, seg.y2);
            }
            ctx.stroke();

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

          if (progress > 0.45 && sprites?.lightningImpact) {
            const impactProgress = (progress - 0.45) / 0.55;
            const impactR = 18 + impactProgress * 58;
            ctx.globalAlpha = Math.max(0, 1 - impactProgress * 0.6);
            ctx.drawImage(
              sprites.lightningImpact,
              st.endX - impactR,
              st.endY - impactR,
              impactR * 2,
              impactR * 2
            );
            ctx.globalAlpha = 1;
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
});

export default GuardianLightningStrike;
