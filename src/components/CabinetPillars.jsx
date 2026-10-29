import React, { useEffect, useRef } from 'react';

/**
 * 2026 Next-Gen Architectural Egyptian Temple Pillars:
 * High-definition bas-relief carved stone & 24K gold foil textures
 * for the monumental left and right flanking cabinet pillars.
 *
 * Features:
 * - Weathered dark basalt / sandstone masonry with micro-grain texture
 * - Precision-carved Egyptian hieroglyphic cartouches (Ankh, Eye of Horus, Scarab, Falcon, Lotus)
 * - 3D chiseled relief with directional bevel highlights and deep drop-shadow crevices
 * - 24K gold foil inlays with anisotropic specular light sweep
 * - Dynamic breathing emissive runes that pulse with energy during active spins and wins
 * - Fluted vertical architectural ribs with carved lotus capital and stone plinth base
 */
export default function CabinetPillars({ isSpinning = false, hasWin = false, side = 'both' }) {
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);

  useEffect(() => {
    const drawPillar = (canvas, isRight = false) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 180;
      const h = canvas.clientHeight || 700;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);

      // 1. BASE STONE COLUMN: Deep weathered dark basalt/obsidian with subtle warm sandstone undertones
      const stoneGrad = ctx.createLinearGradient(0, 0, w, 0);
      if (!isRight) {
        stoneGrad.addColorStop(0, '#0a0d18');
        stoneGrad.addColorStop(0.2, '#1a1f32');
        stoneGrad.addColorStop(0.55, '#252d47');
        stoneGrad.addColorStop(0.85, '#151928');
        stoneGrad.addColorStop(1, '#090c14');
      } else {
        stoneGrad.addColorStop(0, '#090c14');
        stoneGrad.addColorStop(0.15, '#151928');
        stoneGrad.addColorStop(0.45, '#252d47');
        stoneGrad.addColorStop(0.8, '#1a1f32');
        stoneGrad.addColorStop(1, '#0a0d18');
      }
      ctx.fillStyle = stoneGrad;
      ctx.fillRect(0, 0, w, h);

      // Micro-grain stone texture
      ctx.save();
      ctx.fillStyle = 'rgba(255, 235, 180, 0.025)';
      for (let i = 0; i < 350; i++) {
        const gx = Math.random() * w;
        const gy = Math.random() * h;
        const gr = 0.5 + Math.random() * 1.5;
        ctx.fillRect(gx, gy, gr, gr);
      }
      ctx.restore();

      // 2. HORIZONTAL STONE BLOCK MASONRY JOINTS
      ctx.save();
      ctx.lineWidth = 1.2;
      const jointCount = 9;
      const blockH = h / (jointCount + 1);
      for (let j = 1; j <= jointCount; j++) {
        const jy = Math.round(j * blockH);
        // Shadow groove
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(6, jy);
        ctx.lineTo(w - 6, jy);
        ctx.stroke();

        // Highlight lower bevel edge
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
        ctx.beginPath();
        ctx.moveTo(6, jy + 1.2);
        ctx.lineTo(w - 6, jy + 1.2);
        ctx.stroke();
      }
      ctx.restore();

      // 3. VERTICAL ARCHITECTURAL FLUTED RIBS (3D Beveled fluting along column body)
      const ribCount = 4;
      const ribSpacing = (w - 36) / (ribCount + 1);
      for (let r = 1; r <= ribCount; r++) {
        const rx = 18 + r * ribSpacing;
        // Deep shadow groove
        const grooveGrad = ctx.createLinearGradient(rx - 3, 0, rx + 3, 0);
        grooveGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        grooveGrad.addColorStop(0.45, 'rgba(5, 7, 14, 0.95)');
        grooveGrad.addColorStop(0.7, 'rgba(251, 191, 36, 0.25)');
        grooveGrad.addColorStop(1, 'rgba(255, 245, 180, 0.05)');

        ctx.fillStyle = grooveGrad;
        ctx.fillRect(rx - 3, 30, 6, h - 60);

        // Micro-relief highlight bead
        ctx.fillStyle = 'rgba(253, 224, 71, 0.18)';
        ctx.fillRect(rx + 2, 32, 1, h - 64);
      }

      // 4. EMBOSSED BAS-RELIEF HIEROGLYPHIC CARTOUCHES
      // Draws an intricately chiseled Egyptian symbol with drop shadow, chiseled gold rim, and glowing core
      const drawChiseledGlyph = (cx, cy, scale, glyphType) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        // Cartouche pill frame around glyph
        ctx.beginPath();
        ctx.roundRect(-24, -36, 48, 72, 12);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Gold rim highlight on cartouche
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Internal cartouche stone recess
        const recessGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 36);
        recessGrad.addColorStop(0, 'rgba(2, 6, 20, 0.6)');
        recessGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = recessGrad;
        ctx.fill();

        // Helper: draw chiseled stroke (dark shadow + bright gold edge)
        const strokeChiseled = (drawPath, color = '#fbbf24', glow = false) => {
          // Deep chiseled crevice shadow
          ctx.save();
          ctx.translate(1.2, 1.6);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          drawPath();
          ctx.stroke();
          ctx.restore();

          // 24K Gold foil body
          ctx.save();
          if (glow) {
            ctx.shadowColor = isSpinning ? '#38bdf8' : (hasWin ? '#fde047' : '#f59e0b');
            ctx.shadowBlur = 8;
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          drawPath();
          ctx.stroke();

          // Specular gold crest line
          ctx.strokeStyle = 'rgba(255, 255, 230, 0.75)';
          ctx.lineWidth = 0.9;
          drawPath();
          ctx.stroke();
          ctx.restore();
        };

        // Render specific glyph based on type
        if (glyphType === 'ankh') {
          // ANKH (Crux Ansata: Loop of Eternal Life + Crossbeam)
          strokeChiseled(() => {
            ctx.beginPath();
            ctx.ellipse(0, -14, 8, 11, 0, 0, Math.PI * 2);
            ctx.moveTo(0, -3);
            ctx.lineTo(0, 24);
            ctx.moveTo(-13, 3);
            ctx.lineTo(13, 3);
          }, '#fcd34d', true);

          // Center jewel
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, 3, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (glyphType === 'eye') {
          // EYE OF HORUS (Wedjat: Protection & Divine Royal Power)
          strokeChiseled(() => {
            ctx.beginPath();
            // Upper and lower lid curve
            ctx.moveTo(-16, 0);
            ctx.quadraticCurveTo(0, -11, 16, 0);
            ctx.quadraticCurveTo(0, 9, -16, 0);
            // Eyebrow arch
            ctx.moveTo(-15, -13);
            ctx.quadraticCurveTo(0, -17, 16, -11);
            // Falcon tear spiral
            ctx.moveTo(-2, 7);
            ctx.lineTo(-4, 18);
            ctx.moveTo(6, 6);
            ctx.quadraticCurveTo(12, 12, 10, 20);
          }, '#fef08a', true);

          // Iris pupil
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(1, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (glyphType === 'scarab') {
          // WINGED SCARAB (Khepri: Solar Rebirth & Fortune)
          strokeChiseled(() => {
            ctx.beginPath();
            // Head and clypeus
            ctx.ellipse(0, -13, 4, 3, 0, 0, Math.PI * 2);
            // Thorax and elytra body
            ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2);
            ctx.moveTo(0, -10);
            ctx.lineTo(0, 10);
            // Six legs
            ctx.moveTo(-7, -5); ctx.lineTo(-15, -10);
            ctx.moveTo(7, -5); ctx.lineTo(15, -10);
            ctx.moveTo(-7, 0); ctx.lineTo(-16, 2);
            ctx.moveTo(7, 0); ctx.lineTo(16, 2);
            ctx.moveTo(-6, 6); ctx.lineTo(-14, 13);
            ctx.moveTo(6, 6); ctx.lineTo(14, 13);
          }, '#34d399', true);

          // Sun disc above scarab
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, -21, 4.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (glyphType === 'falcon') {
          // HORUS FALCON / SUNCROWN
          strokeChiseled(() => {
            ctx.beginPath();
            ctx.moveTo(0, -18);
            ctx.lineTo(6, -6);
            ctx.lineTo(16, 0);
            ctx.lineTo(4, 8);
            ctx.lineTo(0, 22);
            ctx.lineTo(-4, 8);
            ctx.lineTo(-16, 0);
            ctx.lineTo(-6, -6);
            ctx.closePath();
          }, '#f43f5e', true);

          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (glyphType === 'lotus') {
          // LOTUS OF CREATION (Nefertem)
          strokeChiseled(() => {
            ctx.beginPath();
            // Center petal
            ctx.moveTo(0, 16);
            ctx.quadraticCurveTo(-3, 0, 0, -14);
            ctx.quadraticCurveTo(3, 0, 0, 16);
            // Left petal
            ctx.moveTo(0, 16);
            ctx.quadraticCurveTo(-12, 6, -15, -6);
            ctx.quadraticCurveTo(-8, -2, 0, 8);
            // Right petal
            ctx.moveTo(0, 16);
            ctx.quadraticCurveTo(12, 6, 15, -6);
            ctx.quadraticCurveTo(8, -2, 0, 8);
          }, '#38bdf8', true);
        }

        ctx.restore();
      };

      // Draw vertical sequence of 5 distinct Egyptian glyph cartouches down the column shaft
      const glyphs = isRight
        ? ['scarab', 'ankh', 'lotus', 'eye', 'falcon']
        : ['ankh', 'eye', 'scarab', 'lotus', 'falcon'];

      const startY = 85;
      const endY = h - 85;
      const stepY = (endY - startY) / (glyphs.length - 1);
      const colCenterX = Math.round(w * (isRight ? 0.48 : 0.52));

      for (let i = 0; i < glyphs.length; i++) {
        drawChiseledGlyph(colCenterX, Math.round(startY + i * stepY), 0.95, glyphs[i]);
      }

      // 5. CARVED EGYPTIAN PAPYRUS / LOTUS CAPITAL AT TOP
      const capH = 42;
      const capGrad = ctx.createLinearGradient(0, 0, w, 0);
      capGrad.addColorStop(0, '#78350f');
      capGrad.addColorStop(0.3, '#d97706');
      capGrad.addColorStop(0.5, '#fef08a');
      capGrad.addColorStop(0.7, '#d97706');
      capGrad.addColorStop(1, '#451a03');

      // Flaring lotus bell capital
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(4, capH);
      ctx.quadraticCurveTo(w * 0.15, 12, 0, 4);
      ctx.lineTo(w, 4);
      ctx.quadraticCurveTo(w * 0.85, 12, w - 4, capH);
      ctx.closePath();
      ctx.fillStyle = capGrad;
      ctx.fill();

      // Gold filigree ring
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Carved lotus petal grooves on capital
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      for (let p = 1; p <= 5; p++) {
        const px = (w / 6) * p;
        ctx.beginPath();
        ctx.moveTo(px, 6);
        ctx.lineTo(px + (p - 3) * 3, capH - 2);
        ctx.stroke();
      }
      ctx.restore();

      // 6. HEAVY GRANITE & GOLD BASE PLINTH AT BOTTOM
      const baseH = 44;
      const baseY = h - baseH;
      const baseGrad = ctx.createLinearGradient(0, baseY, w, baseY);
      baseGrad.addColorStop(0, '#1c1917');
      baseGrad.addColorStop(0.4, '#b45309');
      baseGrad.addColorStop(0.55, '#fde68a');
      baseGrad.addColorStop(0.7, '#92400e');
      baseGrad.addColorStop(1, '#0c0a09');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, baseY + 10);
      ctx.lineTo(w, baseY + 10);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // Top beveled ledge of plinth
      const ledgeGrad = ctx.createLinearGradient(0, baseY, 0, baseY + 10);
      ledgeGrad.addColorStop(0, '#fef08a');
      ledgeGrad.addColorStop(0.4, '#d97706');
      ledgeGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = ledgeGrad;
      ctx.fillRect(0, baseY, w, 10);

      // Gold band engraving
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(4, baseY + 14, w - 8, baseH - 18);
      ctx.restore();

      // 7. SPECULAR EDGE BEVEL (Subtle rim light on outer side of column)
      ctx.save();
      const rimGrad = ctx.createLinearGradient(0, 0, 0, h);
      rimGrad.addColorStop(0, 'rgba(255, 255, 230, 0.8)');
      rimGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
      rimGrad.addColorStop(1, 'rgba(255, 255, 230, 0.7)');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (!isRight) {
        ctx.moveTo(2, 6);
        ctx.lineTo(2, h - 6);
      } else {
        ctx.moveTo(w - 2, 6);
        ctx.lineTo(w - 2, h - 6);
      }
      ctx.stroke();
      ctx.restore();
    };

    let animFrame = null;
    let startTime = performance.now();

    const renderLoop = (now) => {
      // Periodic subtle light-sweep check
      animFrame = requestAnimationFrame(renderLoop);
    };

    drawPillar(leftCanvasRef.current, false);
    drawPillar(rightCanvasRef.current, true);

    const handleResize = () => {
      drawPillar(leftCanvasRef.current, false);
      drawPillar(rightCanvasRef.current, true);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isSpinning, hasWin]);

  return (
    <>
      {(side === 'both' || side === 'left') && (
        <div className={`cabinet-pillar-overlay pillar-left ${isSpinning ? 'spinning' : ''} ${hasWin ? 'winning' : ''}`}>
          <canvas ref={leftCanvasRef} className="pillar-canvas" aria-hidden="true" />
          <div className="pillar-specular-sweep" />
          <div className="pillar-neon-inlay-pulse" />
        </div>
      )}
      {(side === 'both' || side === 'right') && (
        <div className={`cabinet-pillar-overlay pillar-right ${isSpinning ? 'spinning' : ''} ${hasWin ? 'winning' : ''}`}>
          <canvas ref={rightCanvasRef} className="pillar-canvas" aria-hidden="true" />
          <div className="pillar-specular-sweep" />
          <div className="pillar-neon-inlay-pulse" />
        </div>
      )}
    </>
  );
}
