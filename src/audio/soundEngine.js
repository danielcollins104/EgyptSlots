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
    this.ambientStarted = false;
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
    if (!this.ambientStarted) {
      this.startAmbientDrone();
    }
  }

  startAmbientDrone() {
    if (this.ambientStarted || !this.ctx) return;
    try {
      this.ambientStarted = true;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.muted ? 0 : 0.035, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);

      // Lowpass filter for smooth, warm Egyptian temple meditative drone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(360, this.ctx.currentTime);
      filter.connect(this.ambientGain);

      // 432Hz Solfeggio meditative harmonic series: 108Hz, 216Hz, 324Hz, 432Hz
      const droneFreqs = [108.0, 216.0, 324.0, 432.0];
      droneFreqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.connect(filter);
        osc.start();
        this.ambientOscs.push(osc);
      });
    } catch (_) {}
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(muted ? 0 : 0.035, this.ctx.currentTime, 0.2);
    }
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

  playButtonClick(pitch = 520) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([14]);

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

  playButtonHover() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.exponentialRampToValueAtTime(1550, now + 0.02);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  playSpinStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([24]);

    const now = this.ctx.currentTime;

    // Single authentic, satisfying, premium casino spin button punch:
    // 1. Crisp tactile physical button snap (micro-transient)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(540, now);
    clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.022);
    clickGain.gain.setValueAtTime(0.15, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.028);

    // 2. Deep solid dampened cabinet thud (tactile body)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(110, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
    thudGain.gain.setValueAtTime(0.20, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    thudOsc.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);

    // 3. Smooth, low mechanical reel release whoosh
    const whooshOsc = this.ctx.createOscillator();
    const whooshGain = this.ctx.createGain();
    whooshOsc.type = 'triangle';
    whooshOsc.frequency.setValueAtTime(75, now);
    whooshOsc.frequency.linearRampToValueAtTime(140, now + 0.16);
    whooshGain.gain.setValueAtTime(0.035, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(this.ctx.destination);
    whooshOsc.start(now);
    whooshOsc.stop(now + 0.22);
  }

  playFlowStreak(streak = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([18, 30]);

    const now = this.ctx.currentTime;
    // Harmonic Solfeggio ascensions scaling with streak: 432Hz, 528Hz, 639Hz
    const root = 432.0 * Math.pow(1.06, Math.min(8, streak));
    const freqs = [root, root * 1.25, root * 1.5];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playSlamStop() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Heavy mechanical slam stop haptic kick
    this.triggerHaptics([35, 45, 60]);

    const now = this.ctx.currentTime;

    // 1. Deep Sub-Bass Mechanical Thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
    subGain.gain.setValueAtTime(0.38, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.25);

    // 2. Metallic Locking Latch Click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'sawtooth';
    clickOsc.frequency.setValueAtTime(880, now);
    clickOsc.frequency.exponentialRampToValueAtTime(220, now + 0.07);
    clickGain.gain.setValueAtTime(0.22, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    clickOsc.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.08);

    // 3. Crisp Golden Chime Specular
    const chimeOsc = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(1174.66, now + 0.01);
    chimeGain.gain.setValueAtTime(0.14, now + 0.01);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    chimeOsc.connect(chimeGain);
    chimeGain.connect(this.ctx.destination);
    chimeOsc.start(now + 0.01);
    chimeOsc.stop(now + 0.29);
  }

  playAnticipationRiser() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([20, 25, 20, 30, 45]);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    // Tension riser: sweeps from 240Hz up to 780Hz
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.45);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playReelTick(colIndex = 0) {
    // Disabled continuous reel clicking to eliminate annoying stereo/clattering noise during spins
    return;
  }

  initTickBuffers() {
    if (!this.ctx || this.tickBuffers) return;
    try {
      this.tickBuffers = [];
      const sampleRate = this.ctx.sampleRate || 44100;
      const numSamples = Math.round(sampleRate * 0.016); // 16ms subtle dampened tick

      const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);
      const startFreq = 120;
      const endFreq = 50;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = i / numSamples;
        const freq = startFreq * Math.pow(endFreq / startFreq, progress);
        const amp = 0.009 * (1 - progress); // Gentle, subtle, non-intrusive whisper
        data[i] = Math.sin(2 * Math.PI * freq * t) * amp;
      }
      this.tickBuffers.push(buffer);
    } catch (_) {}
  }

  playReelStop(colIndex = 0, hasSpecial = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Escalating haptic bump per column
    this.triggerHaptics(hasSpecial ? [25, 35, 60] : [14 + colIndex * 5]);

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

  playThunderStrike() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 1. Sharp electric crackle / snap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(1400, now);
    snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    snapGain.gain.setValueAtTime(0.24, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.1);

    // 2. Deep sub-bass thunder boom & rumble
    const boomOsc = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boomOsc.type = 'triangle';
    boomOsc.frequency.setValueAtTime(110, now);
    boomOsc.frequency.exponentialRampToValueAtTime(32, now + 0.65);
    boomGain.gain.setValueAtTime(0.35, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    boomOsc.connect(boomGain);
    boomGain.connect(this.ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.72);

    // Haptics for tactile physical lightning strike
    this.triggerHaptics([40, 30, 80, 40, 160]);
  }

  playSolarFireball() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 1. Whooshing solar plasma ascent
    const whooshOsc = this.ctx.createOscillator();
    const whooshGain = this.ctx.createGain();
    whooshOsc.type = 'sine';
    whooshOsc.frequency.setValueAtTime(260, now);
    whooshOsc.frequency.exponentialRampToValueAtTime(740, now + 0.18);
    whooshOsc.frequency.exponentialRampToValueAtTime(80, now + 0.55);
    whooshGain.gain.setValueAtTime(0.01, now);
    whooshGain.gain.linearRampToValueAtTime(0.28, now + 0.15);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    whooshOsc.connect(whooshGain);
    whooshGain.connect(this.ctx.destination);
    whooshOsc.start(now);
    whooshOsc.stop(now + 0.62);

    // 2. Warm solar flare resonance
    const flareOsc = this.ctx.createOscillator();
    const flareGain = this.ctx.createGain();
    flareOsc.type = 'triangle';
    flareOsc.frequency.setValueAtTime(140, now + 0.12);
    flareOsc.frequency.exponentialRampToValueAtTime(45, now + 0.65);
    flareGain.gain.setValueAtTime(0.001, now);
    flareGain.gain.setValueAtTime(0.26, now + 0.14);
    flareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    flareOsc.connect(flareGain);
    flareGain.connect(this.ctx.destination);
    flareOsc.start(now + 0.12);
    flareOsc.stop(now + 0.7);

    this.triggerHaptics([30, 25, 60, 35, 120]);
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

  playCoinTick(progress = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (Math.random() < 0.25) {
      this.triggerHaptics([8]);
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Pitch gently climbs from 1100Hz to 1800Hz based on rollup progress
    const baseFreq = 1100 + Math.min(1, Math.max(0, progress)) * 700;
    const freq = baseFreq + (Math.random() * 120 - 60);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.22, now + 0.02);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
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
