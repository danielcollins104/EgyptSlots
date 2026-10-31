import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 4173;
const DIST_DIR = path.resolve('dist');
const OUT_DIR = path.resolve('public', 'commercial_assets');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json'
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    let filePath = path.join(DIST_DIR, safePath);
    if (!fs.existsSync(filePath)) {
      // Fallback for SPA routing
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`✅ Static server serving dist/ on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

function runChromeScreenshot(args) {
  return new Promise((resolve, reject) => {
    execFile(CHROME_PATH, args, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  const server = await startStaticServer();

  try {
    const targets = [
      {
        name: 'commercial_desktop_1920x1080.png',
        width: 1920,
        height: 1080,
        budget: 5000
      },
      {
        name: 'commercial_mobile_vertical_390x844.png',
        width: 390,
        height: 844,
        budget: 5000
      },
      {
        name: 'commercial_mobile_horizontal_844x390.png',
        width: 844,
        height: 390,
        budget: 5000
      },
      {
        name: 'commercial_tablet_1024x768.png',
        width: 1024,
        height: 768,
        budget: 5000
      }
    ];

    for (const target of targets) {
      const outPath = path.join(OUT_DIR, target.name);
      console.log(`📸 Capturing ${target.name} (${target.width}x${target.height})...`);
      const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        `--window-size=${target.width},${target.height}`,
        `--virtual-time-budget=${target.budget}`,
        `--screenshot=${outPath}`,
        `http://127.0.0.1:${PORT}/`
      ];
      await runChromeScreenshot(args);
      console.log(`   Saved: ${outPath} (${fs.statSync(outPath).size} bytes)`);
    }

    console.log('🎉 All commercial screenshot assets successfully generated!');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('❌ Error during screenshot capture:', err);
  process.exit(1);
});
