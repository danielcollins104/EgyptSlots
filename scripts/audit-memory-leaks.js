import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const SERVER_PORT = 5174;
const TEMP_PROFILE = path.join(os.tmpdir(), `chrome-memleak-${Date.now()}`);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple static server for dist
function startStaticServer(distDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    let filePath = path.join(distDir, reqPath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runMemoryLeakAudit() {
  console.log('===========================================================');
  console.log('  CHROME DEVTOOLS PROTOCOL (CDP) MEMORY LEAK AUDIT        ');
  console.log('===========================================================');
  const distDir = path.resolve('dist');
  console.log(`Serving Bundle: ${distDir}`);
  console.log(`Temp Profile:   ${TEMP_PROFILE}`);

  const server = await startStaticServer(distDir, SERVER_PORT);
  console.log(`✔ Static test server listening on http://127.0.0.1:${SERVER_PORT}`);

  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${TEMP_PROFILE}`,
      '--window-size=1280,800',
      `http://127.0.0.1:${SERVER_PORT}`,
    ],
    { stdio: 'ignore' }
  );

  try {
    let versionInfo = null;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        versionInfo = await res.json();
        if (versionInfo) break;
      } catch {}
    }

    if (!versionInfo) throw new Error('Chrome remote debugging did not respond.');
    console.log(`✔ Connected to Headless Chrome: ${versionInfo['User-Agent']}`);

    const pagesRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const pages = await pagesRes.json();
    const target = pages.find((p) => p.type === 'page');
    if (!target) throw new Error('No inspectable page found.');

    const cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');
    await cdp.send('DOM.enable');

    console.log('✔ Protocols enabled. Waiting for splash screen and asset preloading...');
    await sleep(2500);

    // Dismiss splash screen
    const enterRes = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.ad-enter-casino-btn') || document.querySelector('.ad-creative-splash-root');
          if (btn) {
            btn.click();
            return 'entered';
          }
          return 'btn_not_found';
        })()
      `,
      returnByValue: true,
    });
    console.log(`Splash dismissal action: ${enterRes.result.value}`);
    await sleep(4500);

    // Warm-up cycle: Trigger initial spin and paytable modal toggle to ensure one-time
    // module imports, AudioContext graphs, and React portals settle before establishing baseline.
    console.log('Executing warm-up cycle for steady-state baseline...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
          const btn = document.querySelector('.psd-spin-button') ||
                      document.querySelector('.psd-spin-btn-graphic') ||
                      document.querySelector('.mobile-dock-spin-btn') ||
                      document.querySelector('button[aria-label*="Spin"]');
          if (btn) btn.click();
          const pBtn = document.querySelector('button[aria-label*="paytable" i]') ||
                       document.querySelector('.paytable-btn');
          if (pBtn) pBtn.click();
          setTimeout(() => {
            const closeBtn = document.querySelector('.modal-close-btn') ||
                             document.querySelector('button[aria-label*="Close"]');
            if (closeBtn) closeBtn.click();
          }, 500);
        })()
      `,
    });
    await sleep(2600);
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const splash = document.querySelector('.win-splash-overlay');
          if (splash) splash.click();
          const bigWin = document.querySelector('.bigwin-collect-btn') || document.querySelector('.bigwin-modal-root');
          if (bigWin) bigWin.click();
          document.querySelectorAll('.modal-close-btn, .bonus-close-btn, button[aria-label*="Close"]').forEach((b) => b.click());
        })()
      `,
    });
    await sleep(600);

    // Force GC to establish clean baseline
    console.log('\n--- 1. ESTABLISHING CLEAN GC BASELINE ---');
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(500);

    // Instrument addEventListener right after baseline using WeakRefs so the probe itself
    // never pins short-lived unmounted React <img> elements across V8 garbage collection.
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const origAdd = EventTarget.prototype.addEventListener;
          const origRem = EventTarget.prototype.removeEventListener;
          const tracked = [];

          EventTarget.prototype.addEventListener = function(type, fn, opts) {
            if (fn && (typeof fn === 'function' || typeof fn === 'object')) {
              const stack = new Error().stack || '';
              const targetName = this === window ? 'window' : (this === document ? 'document' : (this.tagName || this.constructor?.name || 'unknown'));
              tracked.push({
                targetRef: new WeakRef(this),
                fnRef: new WeakRef(fn),
                type,
                targetName,
                stack,
                removed: false,
              });
            }
            return origAdd.call(this, type, fn, opts);
          };

          EventTarget.prototype.removeEventListener = function(type, fn, opts) {
            for (let i = tracked.length - 1; i >= 0; i--) {
              const entry = tracked[i];
              if (!entry.removed && entry.type === type && entry.targetRef.deref() === this && entry.fnRef.deref() === fn) {
                entry.removed = true;
                break;
              }
            }
            return origRem.call(this, type, fn, opts);
          };

          window.__getLeakedListeners = () => {
            const list = [];
            for (const entry of tracked) {
              if (entry.removed) continue;
              const liveTarget = entry.targetRef.deref();
              const liveFn = entry.fnRef.deref();
              if (liveTarget && liveFn) {
                list.push({
                  target: entry.targetName,
                  type: entry.type,
                  stackTop: entry.stack.split('\\n').slice(1, 4).join(' -> ')
                });
              }
            }
            return list;
          };
        })()
      `,
    });

    const baseMetricsRaw = await cdp.send('Performance.getMetrics');
    const baseMetrics = Object.fromEntries(baseMetricsRaw.metrics.map((m) => [m.name, m.value]));
    const baseDomCounters = await cdp.send('Memory.getDOMCounters');

    console.log(`Baseline JS Heap:        ${(baseMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(3)} MB`);
    console.log(`Baseline DOM Nodes:      ${baseDomCounters.nodes}`);
    console.log(`Baseline Documents:      ${baseDomCounters.documents}`);
    console.log(`Baseline EventListeners: ${baseDomCounters.jsEventListeners}`);

    // Workflow Step: Repeat user interaction 10 times to amplify any memory leak
    console.log('\n--- 2. EXECUTING 10 REPETITIVE INTERACTION CYCLES (AMPLIFICATION) ---');
    for (let cycle = 1; cycle <= 10; cycle++) {
      process.stdout.write(`  [Cycle #${cycle}/10] Spinning & toggling modals... `);

      // Trigger spin
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.querySelector('.psd-spin-btn-graphic') ||
                        document.querySelector('.mobile-dock-spin-btn') ||
                        document.querySelector('button[aria-label*="Spin"]');
            if (btn) btn.click();
            else window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          })()
        `,
      });

      // Allow 600ms for reel movement
      await sleep(600);

      // Open and close Paytable modal
      await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const pBtn = document.querySelector('button[aria-label*="paytable" i]') ||
                         document.querySelector('.paytable-btn');
            if (pBtn) pBtn.click();
            setTimeout(() => {
              const closeBtn = document.querySelector('.modal-close-btn') ||
                               document.querySelector('button[aria-label*="Close"]');
              if (closeBtn) closeBtn.click();
            }, 180);
          })()
        `,
      });

      await sleep(800);
      process.stdout.write(`Done.\n`);
    }

    // Allow Cycle #10 spin + post-spin win-line highlight delay to finish before dismissing overlays
    console.log('\n--- 3. SETTLING & FORCING V8 GARBAGE COLLECTION ---');
    await sleep(2800);
    // Dismiss any active celebration or lazy modal overlays so steady-state retention is measured cleanly
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const splash = document.querySelector('.win-splash-overlay');
          if (splash) splash.click();
          const bigWin = document.querySelector('.bigwin-collect-btn') || document.querySelector('.bigwin-modal-root');
          if (bigWin) bigWin.click();
          const closeBtns = document.querySelectorAll('.modal-close-btn, .bonus-close-btn, button[aria-label*="Close"]');
          closeBtns.forEach((b) => b.click());
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
        })()
      `,
    });
    await sleep(1600);
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(600);
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(400);

    // Final Snapshot
    const finalMetricsRaw = await cdp.send('Performance.getMetrics');
    const finalMetrics = Object.fromEntries(finalMetricsRaw.metrics.map((m) => [m.name, m.value]));
    const finalDomCounters = await cdp.send('Memory.getDOMCounters');

    console.log('\n--- 4. POST-INTERACTION RUNTIME SNAPSHOT ---');
    console.log(`Final JS Heap:           ${(finalMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(3)} MB`);
    console.log(`Final DOM Nodes:         ${finalDomCounters.nodes}`);
    console.log(`Final Documents:         ${finalDomCounters.documents}`);
    console.log(`Final EventListeners:    ${finalDomCounters.jsEventListeners}`);

    const leakedListenersRes = await cdp.send('Runtime.evaluate', {
      expression: `window.__getLeakedListeners ? window.__getLeakedListeners() : []`,
      returnByValue: true,
    });
    const leakedList = leakedListenersRes.result.value || [];
    if (leakedList.length > 0) {
      console.log(`\nDetected ${leakedList.length} unremoved event listeners registered during audit:`);
      leakedList.slice(0, 8).forEach((item, idx) => {
        console.log(`  [#${idx + 1}] Target: ${item.target}, Event: ${item.type}`);
        console.log(`      Origin: ${item.stackTop}`);
      });
    }

    // Diffs & Leaks Diagnosis
    const heapDiffMB = (finalMetrics.JSHeapUsedSize - baseMetrics.JSHeapUsedSize) / (1024 * 1024);
    const nodesDiff = finalDomCounters.nodes - baseDomCounters.nodes;
    const docsDiff = finalDomCounters.documents - baseDomCounters.documents;
    const listenersDiff = finalDomCounters.jsEventListeners - baseDomCounters.jsEventListeners;

    console.log('\n===========================================================');
    console.log('             MEMORY LEAK DIAGNOSTIC RESULTS               ');
    console.log('===========================================================');
    console.log(`Retained Heap Delta:       ${heapDiffMB >= 0 ? '+' : ''}${heapDiffMB.toFixed(3)} MB (Threshold: < 2.5 MB)`);
    console.log(`Detached DOM Nodes Delta:  ${nodesDiff >= 0 ? '+' : ''}${nodesDiff} nodes (Threshold: <= 15 nodes)`);
    console.log(`Detached Documents Delta:  ${docsDiff >= 0 ? '+' : ''}${docsDiff} (Expected: 0)`);
    console.log(`Retained Listeners Delta:  ${listenersDiff >= 0 ? '+' : ''}${listenersDiff} listeners (Threshold: <= 5)`);

    const isHeapClean = heapDiffMB < 2.5;
    const isNodesClean = nodesDiff <= 15;
    const isDocsClean = docsDiff === 0;
    const isListenersClean = listenersDiff <= 5;

    console.log('\n--- LEAK CATEGORY CHECKS (references/common-leaks.md) ---');
    console.log(`1. Uncleared Event Listeners:      ${isListenersClean ? '✔ PASS (No listener accumulation)' : '❌ FAIL'}`);
    console.log(`2. Detached DOM Nodes:            ${isNodesClean ? '✔ PASS (DOM properly collected)' : '❌ FAIL'}`);
    console.log(`3. Detached Documents / iframes:   ${isDocsClean ? '✔ PASS (0 detached documents)' : '❌ FAIL'}`);
    console.log(`4. Unbounded Caches / Closures:    ${isHeapClean ? '✔ PASS (Retained heap stable)' : '❌ FAIL'}`);
    console.log('===========================================================\n');

    cdp.close();

    if (isHeapClean && isNodesClean && isDocsClean && isListenersClean) {
      console.log('🎉 AUDIT VERIFIED: APPLICATION HAS ZERO SYSTEMIC MEMORY LEAKS!');
      process.exit(0);
    } else {
      console.error('⚠️ AUDIT WARNING: Memory threshold exceeded.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit Error:', err);
    process.exit(1);
  } finally {
    try {
      chromeProcess.kill();
      server.close();
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
}

runMemoryLeakAudit();
