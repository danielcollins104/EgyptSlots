import React, { useEffect, useRef } from 'react';
import { CASINO_BRAND } from '../config/slotConfig';

/**
 * Renders the 3D Brushed-24k-Gold, Crimson-Ruby Cabochon, Turquoise-Enamel, and
 * Royal-Lapis-Sapphire Winged Arch Plaque (`logo_long_frame.png` — 5:1 wide aspect ratio)
 * with 3D extruded 24k Gold lettering (`CASINO_BRAND.casinoName`, e.g. "DC ENTERPRISES")
 * sculpted directly inside the recessed velvet nameplate.
 */
export default function DcLogoPlaque({ className = '', textOverride = null }) {
  const canvasRef = useRef(null);
  const titleText = textOverride || CASINO_BRAND.casinoName || 'DC ENTERPRISES';
  const frameSrc = CASINO_BRAND.logoFrameImage || '/assets/psd/logo_long_frame.png';

  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isCancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const w = 960;
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w); // ~191px (5:1 wide banner)
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      // 1. Draw the 3D Gold, Ruby Cabochon & Lapis Velvet Winged Frame
      ctx.drawImage(img, 0, 0, w, h);

      // 2. Sculpt 3D Extruded 24k Gold Lettering inside the Lapis Velvet Plaque (centered at y = 69.5%)
      const cx = w / 2;
      const cy = h * 0.695;

      ctx.save();
      ctx.translate(cx, cy);

      const fontSize = titleText.length > 16 ? 44 : 52;
      ctx.font = `900 ${fontSize}px 'Cinzel Decorative', 'Cinzel', 'Amarante', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Deep ambient drop shadow onto the Lapis Sapphire velvet plaque
      ctx.save();
      ctx.fillStyle = 'rgba(2, 4, 18, 0.88)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;
      ctx.fillText(titleText, 2, 5);
      ctx.restore();

      // 3D Bronze-to-Gold Extrusion Stack
      for (let d = 7; d >= 1; d--) {
        ctx.fillStyle = d > 4 ? '#451a03' : '#78350f';
        ctx.strokeStyle = '#3b1103';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(titleText, d * 0.45, d * 0.85);
        ctx.fillText(titleText, d * 0.45, d * 0.85);
      }

      // Outer 24k Gold Bevel Rim
      const rimGrad = ctx.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.55);
      rimGrad.addColorStop(0, '#fffbeb');
      rimGrad.addColorStop(0.25, '#fde047');
      rimGrad.addColorStop(0.55, '#d97706');
      rimGrad.addColorStop(0.85, '#78350f');
      rimGrad.addColorStop(1, '#fef08a');

      ctx.lineJoin = 'round';
      ctx.lineWidth = 6.5;
      ctx.strokeStyle = rimGrad;
      ctx.strokeText(titleText, 0, 0);

      // Rich Metallic 24k Gold & Warm Amber Face Fill (matching `logo_long.png`)
      const faceGrad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
      faceGrad.addColorStop(0, '#ffffff');
      faceGrad.addColorStop(0.18, '#fef08a');
      faceGrad.addColorStop(0.48, '#f59e0b');
      faceGrad.addColorStop(0.78, '#b45309');
      faceGrad.addColorStop(1, '#fde047');

      ctx.fillStyle = faceGrad;
      ctx.fillText(titleText, 0, 0);

      // Top Specular Highlight Pin-Stripe
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.strokeText(titleText, -0.6, -1);

      ctx.restore();
    };

    img.src = frameSrc;
    return () => {
      isCancelled = true;
    };
  }, [titleText, frameSrc]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={titleText}
    />
  );
}
