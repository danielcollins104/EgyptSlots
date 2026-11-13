import React, { memo, useEffect, useState } from 'react';
import {
  getCachedKeyedUrl,
  processNeonKeyedUrl,
} from '../plugins/smoothPerformancePlugin';

/**
 * Automatically removes the outer solid #000000 background from generated neon JPGs
 * off the main UI thread (via Web Worker OffscreenCanvas + Blob URL cache),
 * guaranteeing zero main-thread stalls during initial render and Guardian stage swaps.
 */
const NeonKeyedImage = memo(function NeonKeyedImage({
  src,
  alt = '',
  className = '',
  style,
  threshold = 28,
  feather = 42,
  draggable = false,
}) {
  const [resolvedUrl, setResolvedUrl] = useState(() => getCachedKeyedUrl(src) || src);

  useEffect(() => {
    if (!src) return undefined;
    const cached = getCachedKeyedUrl(src);
    if (cached) {
      setResolvedUrl(cached);
      return undefined;
    }

    let cancelled = false;
    setResolvedUrl(src);
    processNeonKeyedUrl(src, threshold, feather).then((outUrl) => {
      if (!cancelled && outUrl) {
        setResolvedUrl(outUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src, threshold, feather]);

  return (
    <img
      src={resolvedUrl || src}
      alt={alt}
      className={className}
      style={style}
      draggable={draggable}
      decoding="async"
    />
  );
});

export default NeonKeyedImage;
