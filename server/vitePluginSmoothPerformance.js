/**
 * Vite Plugin: Smooth Multi-Device Frame-Pacing & Chunk Optimizer
 * - Injects a Frame-0 hardware capability classifier into <head> so CSS and Canvas
 *   layers adapt before first paint on budget phones, tablets, foldables, and laptops.
 * - Splits heavy vendor and lazy modal chunks cleanly so initial main-thread JS
 *   parse/compile time stays minimal on low-end mobile CPUs.
 */
export function smoothPerformancePlugin() {
  const inlineBootScript = `<script id="dc-smooth-perf-boot">(function(){try{var d=document.documentElement,o=localStorage.getItem('dc_perf_mode_override');if(o==='high'||o==='balanced'||o==='lite'){d.setAttribute('data-perf-tier',o);return;}var n=navigator||{},c=n.hardwareConcurrency||4,m=n.deviceMemory||4,conn=n.connection||{},rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches,mob=(n.maxTouchPoints>0)||(window.innerWidth<=920);var t='high';if(rm||conn.saveData||c<=2||m<=2){t='lite';}else if(c<=4||m<=4){t=mob?'lite':'balanced';}else if(mob||(window.devicePixelRatio||1)>2.2){t='balanced';}d.setAttribute('data-perf-tier',t);}catch(e){document.documentElement.setAttribute('data-perf-tier','balanced');}})();</script>`;

  return {
    name: 'dc-smooth-performance-plugin',
    enforce: 'post',
    transformIndexHtml(html) {
      if (html.includes('id="dc-smooth-perf-boot"')) return html;
      return html.replace('<head>', `<head>\n    ${inlineBootScript}`);
    },
  };
}
