# Egypt Slots: Pharaoh's Chakra Dynasty — Cloud Disaster Recovery & Conversation Archive

**Last Updated:** November 5, 2026  
**Live Production Domain:** `https://oopsiwon.com` (`https://www.oopsiwon.com`)  
**Cloudflare Worker Service:** `egyptslots2` (`https://egyptslots2.d-bjorke-collins.workers.dev`)  
**Cloudflare Account:** `d.bjorke.collins@gmail.com` (`Account ID: 37987ee6c527ea4273249d6e81f415dd`)  
**GitHub Repository:** `git@github.com:danielcollins104/EgyptSlots.git`

---

## 1. Complete Conversation & Milestone History

This archive preserves the full engineering history and milestones completed across the development sessions for **DC Enterprises Casino — Pharaoh's Chakra Dynasty**:

1. **Core Vegas Slot Engine & 90.0% RTP Mathematics (`src/engine/math/SlotMathEngine.js`, `src/engine/PhaserReelEngine.jsx`)**
   - 5×3 reel matrix with 15 paylines, configurable line counts (`1, 2, 5, 10, 15`), and dual-currency Sweepstakes architecture (`Gold Coins (GC)` for social play + `Sweeps Coins (SC)` redeemable 1:1 USD).
   - Hardware-accelerated PixiJS/Phaser reel engine with guaranteed symbol sprite fallbacks so Lord Anubis and Queen Bastet never disappear on WebGL context loss or texture cache misses.

2. **Living Guardians & Mobile Portrait Companion Bar (`src/App.jsx`, `src/App.css`, `src/components/NeonKeyedImage.jsx`)**
   - **Lord Anubis (Left Pedestal)** and **Queen Bastet (Right Pedestal)** with 5 progressive charge tiers (`Stage 0: Dormant Stone` → `Stage 1: Alive` → `Stage 2: Divine Eyes` → `Stage 3: Plasma/Sunfire Orb` → `Stage 4: Apex Overcharge`).
   - Added the **Mobile Portrait Guardian Companion Bar (`.mobile-portrait-guardians-bar`)** above the reel cabinet so Lord Anubis and Queen Bastet remain visible and interactive on vertical smartphone screens (`≤1024px`).
   - Hardened `NeonKeyedImage.jsx` so any image decode or canvas flood-fill failure automatically falls back to the raw image asset.

3. **Hands-Free "Free Money Celebration" Bonus Suite (`src/components/BonusGameModal.jsx`, `src/components/CelestialOverloadBonusModal.jsx`, `src/components/FreeSpinsScreen.jsx`)**
   - **Royal Chakra Portals & 4-Chamber Automatic Tour:**
     - Defaults to **`⚡ AUTO-PLAY: ON (HANDS-FREE)`** with a glowing **`🎉 100% FREE BONUS MONEY`** plain-English guide bar under the header.
     - Automatically launches from **Royal Chakra Portals** (`3s` countdown) and chains seamlessly through all 4 chambers:
       1. **Chamber 1 — Hold & Win Respins (`holdspin`):** Auto-spins, locks glowing Golden Orbs, resets respins to `3` on every hit, and auto-advances to the Vault.
       2. **Chamber 2 — Sacred Relic Vault (`vault`):** Automatically unseals sacred chests every `1.2s` with multi-wave chamber refills and auto-advances to the Wheel.
       3. **Chamber 3 — 3D Wheel of Pharaohs (`wheel`):** Automatically spins the 3D fortune wheel and claims wedge multipliers/jackpots before advancing to Ascension.
       4. **Chamber 4 — Ascension of Ra (`ascension`):** Automatically launches the Sun Chariot across 8 sky gates, includes **Smart Golden Auto-Bank** (`8×+` after shield deflection or `15×+`), and guarantees a minimum **`2×` to `prevGate×` Storm Blessing** consolation prize so every flight wins free money.
     - **Grand Finale Auto-Collect:** Automatically collects the total bonus haul after a 4-second celebration countdown.
   - **Celestial Overload Pick Bonus (`CelestialOverloadBonusModal.jsx`):**
     - Features **`⚡ AUTO-STRIKE: ON`** by default, striking sacred altars every `1.35s` with dual lightning and solar fire, triggering Elemental Resonance combos and Wave 2 refills automatically, and auto-collecting after 4 seconds.
   - **Pharaoh's Free Spins (`FreeSpinsScreen.jsx`):**
     - Features a **Guaranteed Free Money Floor** on the final spin (blessing row 1 with 4× Solar Phoenix Wilds if total win is `0`) and a 4-second auto-collect countdown on completion.

4. **Live Multi-Chain Crypto Payment Verifier & Automatic Balance Crediting (`src/services/cryptoVerifierService.js`, `src/services/paymentService.js`, `server/apiRouter.js`, `server/worker.js`)**
   - Public receiving addresses configured in `src/config/sweepstakesConfig.js`:
     - **Bitcoin (BTC — Native SegWit):** `bc1qff982339j6ckMGg2m3hsqv0f3f72pj9q7e9y2e`
     - **Ethereum / ERC-20 (ETH / USDT / USDC):** `0xEF9AA0E73B9879A39F2f5967eF2c3D403c4E9633`
     - **Solana (SOL):** `4z9vJjB1iFPNbbT2bB8fFpEBvGDvM6xH4b6rFyrbA42a`
   - Real-time on-chain verification polling across Blockstream/Mempool.space (BTC), Ethereum RPCs (ETH), and Solana Mainnet RPCs (SOL), with replay protection (`processedTxHashes`) and instant automatic Gold Coins (`GC`) + Free Bonus Sweeps Coins (`SC`) balance crediting.

5. **Core Web Vitals & Largest Contentful Paint (LCP) Optimization (`index.html`, `vite.config.js`, `src/components/SplashScreen.jsx`, `src/services/assetPreloader.js`)**
   - Persistent Frame-0 `#preboot-splash` shell with `id="lcp-hero-img"`, `fetchpriority="high"`, and `decoding="sync"`, paired with React `createPortal` into `#preboot-splash-deck` so hydration never unmounts or re-decodes the LCP hero image.
   - Non-blocking stylesheet injection (`nonBlockingCssPlugin` in `vite.config.js`), reducing broadband LCP from `1,020 ms` → **`488 ms`** and Fast 3G throttled LCP from `5,852 ms` → **`2,596 ms`** with `0` DOM LCP audit issues.

---

## 2. How to Restore Everything on a New Computer

If this computer is ever lost, broken, or replaced, follow these steps on any new machine:

### Option A: Restore from GitHub + Cloudflare
1. **Clone the GitHub Repository:**
   ```bash
   git clone git@github.com:danielcollins104/EgyptSlots.git
   cd EgyptSlots
   npm install
   ```
2. **Authenticate with Cloudflare (`d.bjorke.collins@gmail.com`):**
   ```bash
   npx wrangler login
   ```
3. **Restore Conversation & Encrypted Backup Vault from Cloudflare KV:**
   - Log into `https://dash.cloudflare.com` with `d.bjorke.collins@gmail.com` (Account ID: `37987ee6c527ea4273249d6e81f415dd`).
   - Open **Workers & Pages → KV → `EGYPT_SLOTS_CLOUD_BACKUP_VAULT`** (or run `node scripts/cloud-backup-restore.js --restore` after authenticating with `npx wrangler login`).
4. **Verify & Deploy:**
   ```bash
   npm run test:all
   npm run test:bonuses
   npm run build:all
   npx wrangler deploy
   ```

### Option B: Restore from OneDrive Cloud Backup
1. Log into Microsoft OneDrive (`https://onedrive.live.com`) with the Microsoft account linked to this PC.
2. Open the **`EgyptSlots_Cloud_Backup`** folder, which contains:
   - `EgyptSlots_Project_Full_Backup.zip` (complete source code, configs, and scripts)
   - `EgyptSlots_Conversation_Brain_Backup.zip` (complete Antigravity conversation transcript `transcript.jsonl`, `transcript_full.jsonl`, and all generated artifacts)
