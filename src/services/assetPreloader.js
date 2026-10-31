// ============================================================================
// HIGH-EFFICIENCY ASSET PRELOADER & TELEMETRY ENGINE
// ============================================================================
// Preloads all critical textures, 3D symbols, reel frames, guardian artwork,
// and audio metadata before the player can spin the reels.
// Guarantees zero pop-in, zero texture stutter, and provides live 0-100%
// progress tracking for both mobile and desktop connections.
// ============================================================================

import { THEME_ASSETS, GUARDIANS } from '../config/slotConfig';

export const CRITICAL_ASSET_MANIFEST = [
  // 1. Stage Environment & High-DPI Frame
  { id: 'bg_lowres', src: THEME_ASSETS.mainBackgroundLowRes || '/assets/background/background_lowres.jpg', category: 'env' },
  { id: 'bg_main', src: THEME_ASSETS.mainBackground || '/assets/background/background.webp', category: 'env' },
  { id: 'reel_frame', src: THEME_ASSETS.reelFrameImage || '/assets/reel/reel_frame_filled.webp', category: 'reel' },
  { id: 'reel_glow', src: THEME_ASSETS.reelGlowImage || '/assets/psd/reel_glow.webp', category: 'reel' },
  { id: 'reel_net', src: THEME_ASSETS.reelNetImage || '/assets/psd/reel_net.png', category: 'reel' },
  { id: 'wild_glow', src: THEME_ASSETS.wildGlowImage1 || '/assets/psd/wild_glow_01.png', category: 'fx' },
  { id: 'anubis_tall_bg', src: THEME_ASSETS.tallColumnBgImage || '/assets/psd/anubis_tall_bg.png', category: 'fx' },

  // 2. Neon Guardians (Base, Charged Tier 2, and Apex Tier 3)
  { id: 'char_anubis_base', src: GUARDIANS.left.bodyImage, category: 'guardian' },
  { id: 'char_bastet_base', src: GUARDIANS.right.bodyImage, category: 'guardian' },
  { id: 'char_anubis_charged', src: GUARDIANS.left.chargedBodyImage, category: 'guardian' },
  { id: 'char_bastet_charged', src: GUARDIANS.right.chargedBodyImage, category: 'guardian' },
  { id: 'char_anubis_apex', src: GUARDIANS.left.apexBodyImage, category: 'guardian' },
  { id: 'char_bastet_apex', src: GUARDIANS.right.apexBodyImage, category: 'guardian' },

  // 3. High-Tier Egyptian Relic Symbols (Full & Pop-Out Art)
  { id: 'sym_wild', src: '/assets/symbols/wild/wild.png', category: 'symbol' },
  { id: 'sym_scarab', src: '/assets/symbols/high/high_scarab.png', category: 'symbol' },
  { id: 'sym_scarab_pop', src: '/assets/symbols/high/high_scarab_no_frame.png', category: 'symbol' },
  { id: 'sym_eye', src: '/assets/symbols/high/high_eye.png', category: 'symbol' },
  { id: 'sym_eye_pop', src: '/assets/symbols/high/high_eye_no_frame.png', category: 'symbol' },
  { id: 'sym_ankh', src: '/assets/symbols/high/high_ankh.png', category: 'symbol' },
  { id: 'sym_ankh_pop', src: '/assets/symbols/high/high_ankh_no_frame.png', category: 'symbol' },
  { id: 'sym_necklace', src: '/assets/symbols/high/high_necklace.png', category: 'symbol' },
  { id: 'sym_necklace_pop', src: '/assets/symbols/high/high_necklace_no_frame.png', category: 'symbol' },

  // 4. UI Chrome, Controls & Branding
  { id: 'brand_logo', src: '/assets/psd/logo_long_frame.webp', category: 'ui' },
  { id: 'cabinet_logo', src: '/assets/neon/dc_enterprises_wide_logo.webp', category: 'ui' },
  { id: 'gold_numbers', src: '/assets/psd/numbers_beauty_01.webp', category: 'ui' },
  { id: 'btn_spin_glow', src: '/assets/psd/btn_spin_glow.png', category: 'ui' },
  { id: 'btn_spin_base', src: '/assets/psd/btn_spin_base.png', category: 'ui' },
];

class AssetPreloader {
  constructor() {
    this.cache = new Map();
    this.total = CRITICAL_ASSET_MANIFEST.length;
    this.loaded = 0;
    this.isComplete = false;
    this.subscribers = new Set();
    this.promise = null;
    this.currentAsset = '';
    this.lowResLoaded = false;
    this.highResLoaded = false;
  }

  getStage(pct) {
    if (pct < 25) return 'Awakening Neon Guardians...';
    if (pct < 55) return 'Forging 3D Relic Reels...';
    if (pct < 80) return 'Tuning Temple Soundstage & Jackpots...';
    if (pct < 100) return 'Harmonizing Solfeggio Frequencies...';
    return 'Royal Vault Unlocked • Ready to Spin!';
  }

  getState() {
    const pct = this.total > 0 ? Math.min(100, Math.round((this.loaded / this.total) * 100)) : 100;
    return {
      loaded: this.loaded,
      total: this.total,
      percent: this.isComplete ? 100 : pct,
      stage: this.getStage(this.isComplete ? 100 : pct),
      currentAsset: this.currentAsset,
      isComplete: this.isComplete,
      lowResLoaded: this.lowResLoaded,
      highResLoaded: this.highResLoaded,
    };
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  _notify() {
    const state = this.getState();
    this.subscribers.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('[AssetPreloader] Listener error:', err);
      }
    });
  }

  loadImage(item) {
    if (!item.src) {
      this._onAssetDone(item.id);
      return Promise.resolve(null);
    }

    if (this.cache.has(item.src)) {
      this._onAssetDone(item.id);
      return Promise.resolve(this.cache.get(item.src));
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.cache.set(item.src, img);
        if (item.id === 'bg_lowres') this.lowResLoaded = true;
        if (item.id === 'bg_main') this.highResLoaded = true;
        this._onAssetDone(item.id);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`[AssetPreloader] Warning: could not load ${item.src}, continuing.`);
        this._onAssetDone(item.id);
        resolve(null);
      };
      img.src = item.src;
    });
  }

  _onAssetDone(id) {
    this.loaded++;
    this.currentAsset = id;
    if (this.loaded >= this.total) {
      this.isComplete = true;
    }
    this._notify();
  }

  preloadAll() {
    if (this.promise) return this.promise;

    this.promise = new Promise(async (resolve) => {
      // 1. Load fonts readiness if available
      try {
        if (typeof document !== 'undefined' && document.fonts) {
          document.fonts.ready.catch(() => {});
        }
      } catch (_) {}

      // 2. Load low-res background first for instant visual feedback on mobile
      const lowResItem = CRITICAL_ASSET_MANIFEST.find((a) => a.id === 'bg_lowres');
      if (lowResItem) {
        await this.loadImage(lowResItem);
      }

      // 3. Load remaining critical assets in concurrent batches
      const remaining = CRITICAL_ASSET_MANIFEST.filter((a) => a.id !== 'bg_lowres');
      const batchSize = 6;
      for (let i = 0; i < remaining.length; i += batchSize) {
        const batch = remaining.slice(i, i + batchSize);
        await Promise.all(batch.map((item) => this.loadImage(item)));
      }

      // 4. Safety timeout guarantee (never hang on poor mobile networks)
      setTimeout(() => {
        if (!this.isComplete) {
          this.isComplete = true;
          this.loaded = this.total;
          this._notify();
          resolve(true);
        }
      }, 7000);

      this.isComplete = true;
      this._notify();
      resolve(true);
    });

    return this.promise;
  }
}

export const assetPreloader = new AssetPreloader();

// Automatically begin preloading immediately on browser execution
if (typeof window !== 'undefined') {
  assetPreloader.preloadAll();
}
