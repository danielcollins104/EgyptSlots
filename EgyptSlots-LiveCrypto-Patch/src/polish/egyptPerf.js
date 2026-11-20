// ============================================================================
// EGYPTSLOTS PERF BOOST — zero-dependency runtime smoothness layer
// Additive only. Everything degrades gracefully on old browsers.
// ============================================================================

export function installEgyptPerf() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Async-decode every image (present + future) so big sprites never block
  //    the main thread during a spin.
  const optimizeImg = (img) => {
    try { img.decoding = 'async'; } catch { /* no-op */ }
  };
  document.querySelectorAll('img').forEach(optimizeImg);
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IMG') optimizeImg(n);
          else if (n.querySelectorAll) n.querySelectorAll('img').forEach(optimizeImg);
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // 2. Cap devicePixelRatio for the reel canvas at 2 — beyond 2x (retina 3x
  //    phones, 4K laptops at 200% zoom) the pixel cost dwarfs the visual gain.
  try {
    const dpr = window.devicePixelRatio || 1;
    if (dpr > 2) {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    }
  } catch { /* never break rendering over a DPR tweak */ }

  // 3. Honor reduced-motion at runtime too (belt + suspenders with the CSS).
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => document.documentElement.classList.toggle('dc-reduced-motion', mq.matches);
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
  } catch { /* no-op */ }

  // 4. Keep long cashier lists from forcing layout: hint browsers that these
  //    subtrees are independent.
  try {
    const style = document.createElement('style');
    style.textContent =
      '.dc-reduced-motion *{animation-duration:0.001ms!important;transition-duration:0.001ms!important}';
    document.head.appendChild(style);
  } catch { /* no-op */ }
}
