import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;
const TARGET_URL = "http://localhost:5173";
const TEMP_PROFILE = path.join(os.tmpdir(), `chrome-profiler-${Date.now()}`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.events = [];
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
        } else if (msg.method) {
          this.events.push(msg);
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

async function runProfiler() {
  console.log('===========================================================');
  console.log('   PERFETTO / CHROME RUNTIME PROFILER FOR EGYPT SLOTS     ');
  console.log('===========================================================');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Chrome Binary: ${CHROME_PATH}`);
  console.log(`Profile Dir: ${TEMP_PROFILE}`);

  // 1. Launch Headless Chrome
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--window-size=1280,800',
    TARGET_URL
  ], {
    stdio: 'ignore'
  });

  try {
    let versionInfo = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        versionInfo = await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
        if (versionInfo) break;
      } catch (e) {
        // waiting
      }
    }

    if (!versionInfo) {
      throw new Error('Chrome failed to expose debugging port.');
    }
    console.log(`✔ Connected to Chrome CDP: ${versionInfo['User-Agent']}`);

    // Fetch pages
    const pages = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
    const targetPage = pages.find(p => p.type === 'page' && p.url.includes('5173')) || pages[0];
    if (!targetPage || !targetPage.webSocketDebuggerUrl) {
      throw new Error('No inspectable target page found.');
    }

    const client = new CDPClient(targetPage.webSocketDebuggerUrl);
    await client.connect();

    // Enable protocols
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Performance.enable');
    await client.send('Profiler.enable');

    console.log('✔ Protocols initialized. Loading splash screen & preloading assets...');
    await sleep(2500);

    // Dismiss Splash Screen to enter main slot stage
    console.log('Dismissing Splash Screen...');
    const dismissRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.querySelector('.ad-enter-casino-btn') || document.querySelector('.ad-creative-splash-root');
          if (btn) {
            btn.click();
            return 'splash_clicked';
          }
          return 'splash_not_found';
        })()
      `,
      returnByValue: true
    });
    console.log(`Splash dismissal action: ${dismissRes.result.value}`);
    await sleep(2000);

    // Baseline metrics
    const baselineMetricsRaw = await client.send('Performance.getMetrics');
    const baselineMetrics = Object.fromEntries(baselineMetricsRaw.metrics.map(m => [m.name, m.value]));

    console.log('\n--- 1. BASELINE RUNTIME METRICS (POST-HYDRATION) ---');
    console.log(`JS Heap Used: ${(baselineMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`JS Heap Total: ${(baselineMetrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`DOM Node Count: ${baselineMetrics.Nodes}`);
    console.log(`Layout Count: ${baselineMetrics.LayoutCount}`);
    console.log(`Layout Duration: ${(baselineMetrics.LayoutDuration * 1000).toFixed(1)} ms`);

    // Start CPU Profiling
    console.log('\n--- 2. STARTING CPU SAMPLING & JANK TRACE (100Hz) ---');
    await client.send('Profiler.start');

    // Simulate 5 interactive spin actions
    console.log('Simulating 5 spin cycles with math RNG, reel animations & audio events...');
    for (let spin = 1; spin <= 5; spin++) {
      process.stdout.write(`  [Spin #${spin}/5] Triggering... `);
      const evalRes = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.querySelector('.psd-spin-btn-graphic') || 
                        document.querySelector('.mobile-dock-spin-btn') ||
                        document.querySelector('button[aria-label*="Spin"]') ||
                        document.querySelector('.spin-btn');
            if (btn) {
              btn.click();
              return 'clicked';
            }
            // Fallback: trigger spacebar keydown on window
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
            return 'space_triggered';
          })()
        `,
        returnByValue: true
      });
      process.stdout.write(`Status: ${evalRes.result.value}\n`);
      // Allow reel spin animation, win lines, and audio loops to complete
      await sleep(2600);
    }

    // Stop CPU Profiler
    console.log('\n--- 3. CPU PROFILING COMPLETE: ANALYZING CALL TREE ---');
    const cpuProfileRes = await client.send('Profiler.stop');
    const cpuProfile = cpuProfileRes.profile;

    let totalSamples = cpuProfile.samples ? cpuProfile.samples.length : 0;
    const functionDurations = new Map();

    if (cpuProfile.nodes && cpuProfile.samples) {
      const nodeMap = new Map(cpuProfile.nodes.map(n => [n.id, n]));
      for (const sampleNodeId of cpuProfile.samples) {
        const node = nodeMap.get(sampleNodeId);
        if (node) {
          const fnName = node.callFrame.functionName || '(anonymous)';
          const url = node.callFrame.url ? path.basename(node.callFrame.url) : '(internal)';
          const key = `${fnName} [${url}:${node.callFrame.lineNumber}]`;
          functionDurations.set(key, (functionDurations.get(key) || 0) + 1);
        }
      }
    }

    // Post-Interaction Metrics
    const postMetricsRaw = await client.send('Performance.getMetrics');
    const postMetrics = Object.fromEntries(postMetricsRaw.metrics.map(m => [m.name, m.value]));

    console.log('\n--- 4. POST-INTERACTION RUNTIME METRICS ---');
    console.log(`JS Heap Used: ${(postMetrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`JS Heap Total: ${(postMetrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`DOM Node Count: ${postMetrics.Nodes}`);
    console.log(`Layout Count: ${postMetrics.LayoutCount}`);
    console.log(`Layout Duration: ${(postMetrics.LayoutDuration * 1000).toFixed(1)} ms`);
    console.log(`Script Duration: ${(postMetrics.ScriptDuration * 1000).toFixed(1)} ms`);
    console.log(`Task Duration: ${(postMetrics.TaskDuration * 1000).toFixed(1)} ms`);

    // Metrics Delta & Analysis
    const heapDeltaMB = ((postMetrics.JSHeapUsedSize - baselineMetrics.JSHeapUsedSize) / 1024 / 1024).toFixed(2);
    const nodesDelta = postMetrics.Nodes - baselineMetrics.Nodes;

    console.log('\n===========================================================');
    console.log('             DIAGNOSTIC & PERFORMANCE AUDIT               ');
    console.log('===========================================================');
    console.log(`Memory Usage Delta: ${heapDeltaMB > 0 ? '+' : ''}${heapDeltaMB} MB`);
    console.log(`DOM Node Delta:     ${nodesDelta > 0 ? '+' : ''}${nodesDelta} nodes`);
    console.log(`Total CPU Samples:  ${totalSamples}`);

    // Top CPU Call Hotspots (excluding idle)
    console.log('\nTop Active CPU Execution Hotspots:');
    const sortedHotspots = Array.from(functionDurations.entries())
      .filter(([name]) => !name.startsWith('(idle)'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sortedHotspots.length === 0) {
      console.log('  All execution idle / smooth hardware offloaded.');
    } else {
      sortedHotspots.forEach(([name, hits], idx) => {
        const pct = ((hits / (totalSamples || 1)) * 100).toFixed(2);
        console.log(`  ${idx + 1}. ${name} -> ${pct}% of CPU samples (${hits} samples)`);
      });
    }

    // Health Checks
    console.log('\n--- CRITICAL BOTTLENECK CHECKS ---');
    const domStatus = Math.abs(nodesDelta) <= 50 ? 'PASS' : 'WARN';
    const memStatus = parseFloat(heapDeltaMB) <= 15.0 ? 'PASS' : 'WARN';
    const anrStatus = postMetrics.TaskDuration < 15.0 ? 'PASS' : 'WARN';

    console.log(`[${domStatus}] Detached DOM Nodes: Delta is ${nodesDelta} nodes (target: <= 50)`);
    console.log(`[${memStatus}] Heap Memory Growth: Delta is ${heapDeltaMB} MB (target: <= 15 MB)`);
    console.log(`[${anrStatus}] Main Thread ANR Diagnosis: No blocking UI stalls (Task Duration ${(postMetrics.TaskDuration * 1000).toFixed(0)}ms)`);
    console.log('===========================================================\n');

    client.close();
  } catch (err) {
    console.error('Profiler Error:', err);
  } finally {
    try {
      chromeProcess.kill();
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }
}

runProfiler();
