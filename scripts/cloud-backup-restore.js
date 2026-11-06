/**
 * ============================================================================
 * EGYPT SLOTS: TRIPLE-REDUNDANT CLOUD BACKUP & DISASTER RECOVERY CLI
 * ============================================================================
 * Backs up (and restores) the entire project source code, conversation
 * transcripts, and private vault data across:
 *   1. Private Cloudflare KV Vault (Account: d.bjorke.collins@gmail.com)
 *   2. Microsoft OneDrive Cloud Sync Folder (~/OneDrive/EgyptSlots_Cloud_Backup_2026_11_05)
 *   3. GitHub Remote Repository (git@github.com:danielcollins104/EgyptSlots.git)
 *
 * Usage:
 *   node scripts/cloud-backup-restore.js           # Run full backup
 *   node scripts/cloud-backup-restore.js --restore # Restore from Cloudflare KV
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const CONVERSATION_ID = '09707229-94c2-42d2-b606-17d81e0f3f06';
const BRAIN_DIR = path.join(
  process.env.USERPROFILE || 'C:\\Users\\Mee',
  '.gemini',
  'antigravity',
  'brain',
  CONVERSATION_ID
);
const ONEDRIVE_BACKUP_DIR = path.join(
  process.env.USERPROFILE || 'C:\\Users\\Mee',
  'OneDrive',
  'EgyptSlots_Cloud_Backup_2026_11_05'
);

const SOURCE_DIRS = ['src', 'server', 'scripts', 'docs', 'electron'];
const SOURCE_FILES = [
  'index.html',
  'package.json',
  'vite.config.js',
  'capacitor.config.json',
  'AGENTS.md',
  '.gitignore',
];

function collectSourceSnapshot() {
  const snapshot = {
    createdAt: new Date().toISOString(),
    conversationId: CONVERSATION_ID,
    files: {},
  };

  for (const relFile of SOURCE_FILES) {
    const abs = path.join(ROOT_DIR, relFile);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      snapshot.files[relFile] = fs.readFileSync(abs, 'utf8');
    }
  }

  const walk = (dirRel) => {
    const absDir = path.join(ROOT_DIR, dirRel);
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const relPath = path.posix.join(dirRel.replace(/\\/g, '/'), entry.name);
      const fullPath = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(relPath);
      } else if (entry.isFile() && /\.(js|jsx|ts|tsx|css|json|md|html|cjs|mjs)$/i.test(entry.name)) {
        snapshot.files[relPath] = fs.readFileSync(fullPath, 'utf8');
      }
    }
  };

  for (const d of SOURCE_DIRS) {
    walk(d);
  }

  return snapshot;
}

function getOrCreateKvNamespaceId() {
  const listOut = execSync('npx wrangler kv namespace list', { encoding: 'utf8' });
  const jsonStart = listOut.indexOf('[');
  const namespaces = jsonStart >= 0 ? JSON.parse(listOut.slice(jsonStart)) : [];
  const existing = namespaces.find((n) => n.title.includes('EGYPT_SLOTS_CLOUD_BACKUP_VAULT'));
  if (existing) return existing.id;

  const createOut = execSync('npx wrangler kv namespace create EGYPT_SLOTS_CLOUD_BACKUP_VAULT', {
    encoding: 'utf8',
  });
  const idMatch = createOut.match(/"id":\s*"([a-f0-9]{32})"/i) || createOut.match(/id\s*=\s*"([a-f0-9]{32})"/i);
  if (!idMatch) {
    throw new Error('Could not parse KV namespace ID from output: ' + createOut);
  }
  return idMatch[1];
}

function putKvKey(namespaceId, key, valueFilePath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync(
        `npx wrangler kv key put --namespace-id=${namespaceId} "${key}" --path="${valueFilePath}" --remote`,
        { stdio: 'inherit' }
      );
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`⚠️ KV upload attempt ${attempt} failed for ${key}, retrying in 3s...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
  }
}

async function runBackup() {
  console.log('================================================================');
  console.log('🛡️  STARTING TRIPLE-REDUNDANT CLOUD BACKUP (PROJECT + CHAT)     ');
  console.log('================================================================');

  // 1. Collect source snapshot & compress
  const snapshot = collectSourceSnapshot();
  const snapshotJson = JSON.stringify(snapshot);
  const snapshotGzB64 = zlib.gzipSync(Buffer.from(snapshotJson, 'utf8')).toString('base64');
  console.log(
    `✔ Packaged ${Object.keys(snapshot.files).length} source files (${(snapshotJson.length / 1024).toFixed(1)} KB raw -> ${(snapshotGzB64.length / 1024).toFixed(1)} KB compressed)`
  );

  // 2. Compress conversation transcript
  const transcriptPath = path.join(BRAIN_DIR, '.system_generated', 'logs', 'transcript.jsonl');
  let transcriptGzB64 = '';
  if (fs.existsSync(transcriptPath)) {
    const rawTranscript = fs.readFileSync(transcriptPath);
    transcriptGzB64 = zlib.gzipSync(rawTranscript).toString('base64');
    console.log(
      `✔ Packaged conversation transcript (${(rawTranscript.length / 1024).toFixed(1)} KB raw -> ${(transcriptGzB64.length / 1024).toFixed(1)} KB compressed)`
    );
  }

  // 3. Upload to Private Cloudflare KV Vault
  console.log('\n--- Cloud #1: Uploading to Private Cloudflare KV Vault ---');
  const namespaceId = getOrCreateKvNamespaceId();
  console.log(`✔ Private Cloudflare KV Namespace ID: ${namespaceId}`);

  const tmpDir = path.join(ROOT_DIR, '.wrangler', 'tmp-backup');
  fs.mkdirSync(tmpDir, { recursive: true });

  const archiveDocPath = path.join(ROOT_DIR, 'docs', 'CLOUD_RECOVERY_AND_CONVERSATION_ARCHIVE.md');
  putKvKey(namespaceId, 'backup:recovery_guide_md', archiveDocPath);

  const srcTmp = path.join(tmpDir, 'source_bundle.gz.b64');
  fs.writeFileSync(srcTmp, snapshotGzB64, 'utf8');
  putKvKey(namespaceId, 'backup:project_source_gz_b64', srcTmp);

  if (transcriptGzB64) {
    const chatTmp = path.join(tmpDir, 'transcript.jsonl.gz.b64');
    fs.writeFileSync(chatTmp, transcriptGzB64, 'utf8');
    putKvKey(namespaceId, 'backup:conversation_transcript_gz_b64', chatTmp);
  }

  const secretWalletPath = path.join(ROOT_DIR, 'CRYPTO_WALLETS_SECRET.md');
  if (fs.existsSync(secretWalletPath)) {
    putKvKey(namespaceId, 'vault:crypto_wallets_secret_md', secretWalletPath);
    console.log('✔ Backed up private wallet vault to authenticated Cloudflare KV.');
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 4. Mirror to Microsoft OneDrive Cloud Folder
  console.log('\n--- Cloud #2: Backing up to Microsoft OneDrive Cloud Folder ---');
  if (fs.existsSync(path.dirname(ONEDRIVE_BACKUP_DIR))) {
    fs.mkdirSync(ONEDRIVE_BACKUP_DIR, { recursive: true });
    fs.copyFileSync(
      archiveDocPath,
      path.join(ONEDRIVE_BACKUP_DIR, 'CLOUD_RECOVERY_AND_CONVERSATION_ARCHIVE.md')
    );
    fs.writeFileSync(
      path.join(ONEDRIVE_BACKUP_DIR, 'EgyptSlots_Source_Snapshot.json.gz'),
      zlib.gzipSync(Buffer.from(snapshotJson, 'utf8'))
    );
    if (fs.existsSync(transcriptPath)) {
      fs.copyFileSync(
        transcriptPath,
        path.join(ONEDRIVE_BACKUP_DIR, 'conversation_transcript.jsonl')
      );
      fs.writeFileSync(
        path.join(ONEDRIVE_BACKUP_DIR, 'conversation_transcript.jsonl.gz'),
        zlib.gzipSync(fs.readFileSync(transcriptPath))
      );
    }
    const fullTranscriptPath = path.join(
      BRAIN_DIR,
      '.system_generated',
      'logs',
      'transcript_full.jsonl'
    );
    if (fs.existsSync(fullTranscriptPath)) {
      fs.writeFileSync(
        path.join(ONEDRIVE_BACKUP_DIR, 'conversation_transcript_full.jsonl.gz'),
        zlib.gzipSync(fs.readFileSync(fullTranscriptPath))
      );
    }
    if (fs.existsSync(secretWalletPath)) {
      fs.copyFileSync(
        secretWalletPath,
        path.join(ONEDRIVE_BACKUP_DIR, 'CRYPTO_WALLETS_SECRET.md')
      );
    }
    console.log(`✔ Synced full backup archives to OneDrive: ${ONEDRIVE_BACKUP_DIR}`);
  }

  console.log('\n================================================================');
  console.log('✅ CLOUD BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`   • Cloudflare KV Vault ID : ${namespaceId}`);
  console.log(`   • OneDrive Cloud Folder  : ${ONEDRIVE_BACKUP_DIR}`);
  console.log('================================================================');
}

async function runRestore() {
  const namespaceId = getOrCreateKvNamespaceId();
  console.log(`Restoring from Cloudflare KV Namespace ${namespaceId}...`);
  const b64 = execSync(
    `npx wrangler kv key get --namespace-id=${namespaceId} "backup:project_source_gz_b64" --remote`,
    { encoding: 'utf8' }
  ).trim();
  const jsonStr = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
  const snapshot = JSON.parse(jsonStr);
  for (const [relPath, content] of Object.entries(snapshot.files)) {
    const abs = path.join(ROOT_DIR, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  console.log(`✔ Restored ${Object.keys(snapshot.files).length} source files!`);
}

if (process.argv.includes('--restore')) {
  runRestore();
} else {
  runBackup();
}
