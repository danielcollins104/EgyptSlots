import React, { useEffect, useRef } from 'react';
import { CASINO_BRAND } from '../config/slotConfig';

/**
 * Renders the 3D Brushed-24k-Gold, Crimson-Ruby Cabochon, Turquoise-Enamel, and
 * Royal-Lapis-Sapphire Winged Arch Plaque (`logo_long_frame.png` — 5:1 wide aspect ratio)
 * with razor-sharp 3D extruded 24k Gold lettering ("DC ENTERPRISES")
 * sculpted directly inside the recessed velvet nameplate with ZERO blurry white halos.
 */
export default function DcLogoPlaque({ className = '', textOverride = null }) {
  const canvasRef = useRef(null);
  const titleText = textOverride || CASINO_BRAND.casinoName || 'DC ENTERPRISES';
  const frameSrc = CASINO_BRAND.logoFrameImage || '/assets/psd/logo_long_frame.png';

  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const renderPlaque = () => {
      if (isCancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      // High-DPI 2x resolution backing for pin-sharp vector clarity on all displays
      const w = 1920;
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w); // ~382px
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, w, h);

      // 1. Draw the 3D Gold, Ruby Cabochon & Lapis Velvet Winged Frame
      ctx.drawImage(img, 0, 0, w, h);

      // 2. Sculpt 3D Extruded 24k Gold Lettering inside the Lapis Velvet Plaque (centered at y = 69.5%)
      const cx = w / 2;
      const cy = h * 0.695;

      ctx.save();
      ctx.translate(cx, cy);

      const fontSize = titleText.length > 16 ? 84 : 98;
      ctx.font = `900 ${fontSize}px 'Cinzel Decorative', 'Cinzel', 'Amarante', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Crisp dark sapphire-black ambient drop shadow directly onto the velvet
      ctx.save();
      ctx.fillStyle = 'rgba(2, 4, 16, 0.96)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8;
      ctx.fillText(titleText, 0, 6);
      ctx.restore();

      // Deep 3D Bronze Chisel Extrusion Stack (bottom-up for crisp depth)
      for (let d = 12; d >= 1; d--) {
        ctx.fillStyle = d > 6 ? '#220802' : '#5c2206';
        ctx.strokeStyle = '#180401';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeText(titleText, 0, d * 0.9);
        ctx.fillText(titleText, 0, d * 0.9);
      }

      // Outer 24k Solid Gold Bevel Stroke (no blurry white halo)
      const rimGrad = ctx.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.55);
      rimGrad.addColorStop(0, '#fef08a');
      rimGrad.addColorStop(0.3, '#f59e0b');
      rimGrad.addColorStop(0.7, '#b45309');
      rimGrad.addColorStop(1, '#fde047');

      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1a0500';
      ctx.strokeText(titleText, 0, 0);

      ctx.lineWidth = 5.5;
      ctx.strokeStyle = rimGrad;
      ctx.strokeText(titleText, 0, 0);

      // Rich Metallic 24k Gold & Sunburst Face Fill (clean, high-contrast, razor-sharp)
      const faceGrad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
      faceGrad.addColorStop(0, '#fffbeb');
      faceGrad.addColorStop(0.2, '#fde047');
      faceGrad.addColorStop(0.55, '#f59e0b');
      faceGrad.addColorStop(0.85, '#b45309');
      faceGrad.addColorStop(1, '#d97706');

      ctx.fillStyle = faceGrad;
      ctx.fillText(titleText, 0, 0);

      // Delicate crisp golden top edge highlight
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#fffbeb';
      ctx.strokeText(titleText, 0, -1.2);

      ctx.restore();
    };

    img.onload = () => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(renderPlaque);
      } else {
        renderPlaque();
      }
    };

    img.src = frameSrc;
    return () => {
      isCancelled = true;
    };
  }, [titleText, frameSrc]);

  return (
    <canvas
      ref={canvasRef}
      className={`dc-logo-plaque-canvas ${className}`}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
      }}
    />
  );
}
