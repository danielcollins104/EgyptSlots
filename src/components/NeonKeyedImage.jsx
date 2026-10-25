import React, { useEffect, useState } from 'react';

const processedCache = new Map();

/**
 * Automatically removes the outer solid #000000 background from generated neon JPGs
 * using a fast edge flood-fill + soft neon glow alpha feathering, while preserving
 * dark interior colors inside letters, frames, and character armor.
 */
export default function NeonKeyedImage({
  src,
  alt = '',
  className = '',
  style = {},
  threshold = 28,
  feather = 42,
  draggable = false,
}) {
  const [dataUrl, setDataUrl] = useState(() => processedCache.get(src) || null);

  useEffect(() => {
    if (!src) return;
    if (processedCache.has(src)) {
      setDataUrl(processedCache.get(src));
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const pushIfBg = (x, y) => {
          const idx = y * w + x;
          if (visited[idx]) return;
          const p = idx * 4;
          const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
          if (maxC <= threshold + feather) {
            visited[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Seed from all 4 borders
        for (let x = 0; x < w; x++) {
          pushIfBg(x, 0);
          pushIfBg(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          pushIfBg(0, y);
          pushIfBg(w - 1, y);
        }

        // BFS flood-fill through dark outer background & outer neon halo
        while (head < tail) {
          const curr = queue[head++];
          const p = curr * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);

          if (maxC <= threshold) {
            data[p + 3] = 0;
          } else {
            // Smoothly feather the neon outer glow
            const alpha = Math.min(255, Math.round(((maxC - threshold) / feather) * 255));
            data[p + 3] = alpha;
            // Boost color saturation on feathered neon glow pixels
            if (alpha > 0 && alpha < 255) {
              const boost = 255 / Math.max(alpha, 48);
              data[p] = Math.min(255, Math.round(r * boost));
              data[p + 1] = Math.min(255, Math.round(g * boost));
              data[p + 2] = Math.min(255, Math.round(b * boost));
            }
          }

          const cx = curr % w;
          const cy = (curr / w) | 0;
          if (cx > 0) pushIfBg(cx - 1, cy);
          if (cx + 1 < w) pushIfBg(cx + 1, cy);
          if (cy > 0) pushIfBg(cx, cy - 1);
          if (cy + 1 < h) pushIfBg(cx, cy + 1);
        }

        ctx.putImageData(imgData, 0, 0);
        const outUrl = canvas.toDataURL('image/png');
        processedCache.set(src, outUrl);
        if (!cancelled) setDataUrl(outUrl);
      } catch {
        if (!cancelled) setDataUrl(src);
      }
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, threshold, feather]);

  return (
    <img
      src={dataUrl || src}
      alt={alt}
      className={className}
      style={style}
      draggable={draggable}
    />
  );
}
