// Web Audio API Synthesized Casino & Egyptian Temple Sound Engine
// Since the RSG Free Pack includes no audio files, this engine synthesizes
// rich mechanical reel ticks, Egyptian harp/chime win fanfares, Anubis fire whooshes,
// and Big Win coin cascades using native Web Audio oscillators & noise buffers.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientGain = null;
    this.ambientOscs = [];
    this.lastTickMs = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.04, this.ctx.currentTime, 0.2);
    }
  }

  playButtonClick(pitch = 520) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + 0.065);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playSpinStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // EgyptianHijaz scale ascending sweep: D4, Eb4, F#4, G4, A4, Bb4, C#5, D5
    const notes = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 554.37, 587.33];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.032;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  playReelTick(colIndex = 0) {
    if (this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastTickMs < 36) return;
    this.lastTickMs = nowMs;

    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 + colIndex * 18, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.025);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  playReelStop(colIndex = 0, hasSpecial = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Deep stone thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 115 + colIndex * 14;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // If Wild or Anubis landed on this reel, play a mystical chime
    if (hasSpecial) {
      const chime = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      chime.type = 'sine';
      const cFreq = 587.33 * Math.pow(1.12, colIndex);
      chime.frequency.setValueAtTime(cFreq, now + 0.02);
      chime.frequency.exponentialRampToValueAtTime(cFreq * 1.5, now + 0.32);

      cGain.gain.setValueAtTime(0.18, now + 0.02);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      chime.connect(cGain);
      cGain.connect(this.ctx.destination);
      chime.start(now + 0.02);
      chime.stop(now + 0.36);
    }
  }

  playAnubisExpand() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Mystical low brass/chord + fire whoosh
    const chord = [146.83, 220.0, 293.66, 369.99, 440.0, 587.33];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * 0.98, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.25);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.88);
    });
  }

  triggerHaptics(pattern = [40, 50, 60]) {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics unavailable on non-touch desktop browsers
    }
  }

  playWinCelebration(tier = 'standard') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Trigger haptics synchronized with win tiers
    if (tier === 'mega') {
      this.triggerHaptics([80, 50, 100, 50, 150, 60, 220, 60, 300]);
    } else if (tier === 'big') {
      this.triggerHaptics([60, 40, 80, 40, 120, 50, 160]);
    } else if (tier === 'nice') {
      this.triggerHaptics([50, 40, 80, 40, 100]);
    } else {
      this.triggerHaptics([40, 50, 60]);
    }

    const now = this.ctx.currentTime;
    const frequencies =
      tier === 'mega'
        ? [369.99, 440.0, 554.37, 587.33, 739.99, 880.0, 1108.73, 1174.66, 1479.98]
        : tier === 'big'
        ? [369.99, 440.0, 554.37, 587.33, 739.99, 880.0, 1174.66]
        : tier === 'nice'
        ? [392.0, 493.88, 587.33, 739.99, 880.0]
        : [440.0, 554.37, 659.25, 880.0];

    frequencies.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = tier === 'mega' || tier === 'big' ? 'triangle' : 'sine';
      const t = now + i * 0.065;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });

    // Rapid coin clink sparkles
    const clinkCount = tier === 'mega' ? 8 : tier === 'big' ? 5 : 3;
    for (let c = 0; c < clinkCount; c++) {
      const cOsc = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      cOsc.type = 'sine';
      const ct = now + 0.1 + c * 0.065;
      cOsc.frequency.setValueAtTime(1800 + Math.random() * 800, ct);
      cGain.gain.setValueAtTime(0.08, ct);
      cGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);

      cOsc.connect(cGain);
      cGain.connect(this.ctx.destination);
      cOsc.start(ct);
      cOsc.stop(ct + 0.08);
    }
  }

  playWin(isBigWin = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = isBigWin
      ? [293.66, 369.99, 440.0, 587.33, 440.0, 587.33, 739.99, 880.0, 1174.66]
      : [293.66, 369.99, 440.0, 587.33, 739.99];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBigWin ? 'triangle' : 'sine';
      const t = now + i * (isBigWin ? 0.09 : 0.075);
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isBigWin ? 0.45 : 0.3));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + (isBigWin ? 0.48 : 0.32));
    });
  }

  playCoinTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const freq = 1200 + Math.random() * 400;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.25, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playBonusTrigger() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Royal Egyptian Fanfare for Bonus Vault Unlock
    const notes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0, 1174.66];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.075;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  playBonusPick(isSpecial = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = isSpecial ? [587.33, 739.99, 880.0, 1174.66] : [440.0, 587.33, 739.99];
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isSpecial ? 'triangle' : 'sine';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  playWheelTick(pitchBoost = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const f = 340 + pitchBoost * 15;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.035);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}

export const soundEngine = new SoundEngine();
