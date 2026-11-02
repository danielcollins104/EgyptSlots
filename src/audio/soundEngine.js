// Web Audio API Synthesized Casino & Egyptian Temple Sound Engine
// Since the RSG Free Pack includes no audio files, this engine synthesizes
// rich mechanical reel ticks, Egyptian harp/chime win fanfares, Anubis fire whooshes,
// and Big Win coin cascades using native Web Audio oscillators & noise buffers.
//
// Zero-Leak Architecture: Every synthesized voice auto-disconnects from destination
// on playback completion, preventing DSP audio node accumulation, high CPU heat,
// and audio thread starvation during long play sessions.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientGain = null;
    this.ambientOscs = [];
    this.ambientStarted = true; // Disabled: prevent continuous synthetic drone
    this.lastTickMs = 0;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        } else if (!document.hidden && this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    }
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

  // Auto-disconnects audio nodes from the audio graph upon playback finish to eliminate memory leaks and DSP overload
  playVoice(nodes, durationSeconds = 0.5) {
    if (!this.ctx) return;
    const terminalNode = nodes[nodes.length - 1];
    if (terminalNode && typeof terminalNode.connect === 'function') {
      terminalNode.connect(this.ctx.destination);
    }
    const osc = nodes.find((n) => n && typeof n.stop === 'function');
    if (osc) {
      osc.onended = () => {
        nodes.forEach((n) => {
          try {
            if (n && typeof n.disconnect === 'function') n.disconnect();
          } catch (_) {}
        });
      };
    }
    const fallbackMs = Math.max(60, Math.ceil(durationSeconds * 1000) + 100);
    setTimeout(() => {
      nodes.forEach((n) => {
        try {
          if (n && typeof n.disconnect === 'function') n.disconnect();
        } catch (_) {}
      });
    }, fallbackMs);
  }

  stopAmbientDrone() {
    try {
      if (this.ambientOscs && this.ambientOscs.length > 0) {
        this.ambientOscs.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch (_) {}
        });
        this.ambientOscs = [];
      }
      if (this.ambientGain) {
        try {
          this.ambientGain.disconnect();
        } catch (_) {}
        this.ambientGain = null;
      }
    } catch (_) {}
  }

  startAmbientDrone() {
    // Disabled: Continuous synthetic sine drone caused acoustic feedback/hum.
    // Rich, atmospheric casino music is properly provided by ambientMusicEngine.js
    this.stopAmbientDrone();
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) {
      this.stopAmbientDrone();
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
    
    // Warm, organic tactile wood/felt UI tap (zero harshness, zero ear fatigue)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    osc.type = 'sine';
    const baseFreq = Math.min(600, Math.max(220, pitch * 0.7));
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.04);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    this.playVoice([osc, filter, gain], 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  playButtonHover() {
    // Silenced to prevent repetitive chirping when cursor traverses UI buttons
    return;
  }

  playSpinStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([22]);

    const now = this.ctx.currentTime;

    // Authentic, dampened mechanical Vegas spin button punch:
    // Designed for hypnotic player flow, tactile satisfaction, and zero ear fatigue.

    // 1. Solid dampened cabinet punch (soft low-end solenoid thump)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    const thudFilter = this.ctx.createBiquadFilter();

    thudFilter.type = 'lowpass';
    thudFilter.frequency.setValueAtTime(160, now);

    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(82, now);
    thudOsc.frequency.exponentialRampToValueAtTime(36, now + 0.08);

    thudGain.gain.setValueAtTime(0.16, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    thudOsc.connect(thudFilter);
    thudFilter.connect(thudGain);
    this.playVoice([thudOsc, thudFilter, thudGain], 0.095);

    thudOsc.start(now);
    thudOsc.stop(now + 0.095);

    // 2. Muffled felt mechanical switch engagement (soft tactile micro-click)
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    const clickFilter = this.ctx.createBiquadFilter();

    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(320, now);
    clickFilter.Q.setValueAtTime(1.2, now);

    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(260, now);
    clickOsc.frequency.exponentialRampToValueAtTime(110, now + 0.016);

    clickGain.gain.setValueAtTime(0.045, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    this.playVoice([clickOsc, clickFilter, clickGain], 0.022);

    clickOsc.start(now);
    clickOsc.stop(now + 0.022);

    // 3. Subtle sub-bass air cushion release (gentle mechanical breath)
    const airOsc = this.ctx.createOscillator();
    const airGain = this.ctx.createGain();
    airOsc.type = 'sine';
    airOsc.frequency.setValueAtTime(54, now);
    airOsc.frequency.exponentialRampToValueAtTime(28, now + 0.06);

    airGain.gain.setValueAtTime(0.05, now);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    airOsc.connect(airGain);
    this.playVoice([airOsc, airGain], 0.075);

    airOsc.start(now);
    airOsc.stop(now + 0.075);
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
      this.playVoice([osc, gain], 0.35 + idx * 0.04);
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
    this.playVoice([subOsc, subGain], 0.25);
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
    this.playVoice([clickOsc, clickGain], 0.08);
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
    this.playVoice([chimeOsc, chimeGain], 0.29);
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
    this.playVoice([osc, gain], 0.5);
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
    this.playVoice([osc, gain], 0.16);
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
      this.playVoice([chime, cGain], 0.36);
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
      this.playVoice([osc, gain], 0.88);
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
    this.playVoice([snapOsc, snapGain], 0.1);
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
    this.playVoice([boomOsc, boomGain], 0.72);
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
    this.playVoice([whooshOsc, whooshGain], 0.62);
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
    this.playVoice([flareOsc, flareGain], 0.7);
    flareOsc.start(now + 0.12);
    flareOsc.stop(now + 0.7);

    this.triggerHaptics([30, 25, 60, 35, 120]);
  }

  playMartialSwoosh(intensity = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([18, 25]);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420 * intensity, now);
    filter.Q.setValueAtTime(1.8, now);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260 * intensity, now);
    osc.frequency.exponentialRampToValueAtTime(780 * intensity, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(110 * intensity, now + 0.22);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    this.playVoice([osc, filter, gain], 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playMartialImpact() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([35, 45, 60]);

    const now = this.ctx.currentTime;
    // Solid martial arts strike / palm thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    this.playVoice([osc, gain], 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playStaffFlourish() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Triple rotational whooshes
    [0, 0.07, 0.14].forEach((offset, idx) => {
      setTimeout(() => {
        this.playMartialSwoosh(1.1 + idx * 0.15);
      }, offset * 1000);
    });
    setTimeout(() => {
      this.playMartialImpact();
    }, 240);
  }

  playQiGather() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([20, 30, 45]);

    const now = this.ctx.currentTime;
    const freqs = [264, 330, 396, 528];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.035;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, t + 0.28);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.connect(gain);
      this.playVoice([osc, gain], 0.34 + idx * 0.035);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playBigWinCelebration(tier = 'big') {
    this.playWinCelebration(tier);
  }

  playWinCelebration(tier = 'standard') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Trigger haptics synchronized with win tiers (micro, mini, super, big, mega, ultra)
    if (tier === 'ultra' || tier === 'colossal') {
      this.triggerHaptics([100, 60, 120, 60, 180, 80, 240, 80, 320, 100, 400]);
    } else if (tier === 'mega') {
      this.triggerHaptics([80, 50, 100, 50, 150, 60, 220, 60, 300]);
    } else if (tier === 'big') {
      this.triggerHaptics([60, 40, 80, 40, 120, 50, 160]);
    } else if (tier === 'nice' || tier === 'super') {
      this.triggerHaptics([50, 40, 80, 40, 100]);
    } else if (tier === 'mini') {
      this.triggerHaptics([30, 40, 50, 40, 70]);
    } else if (tier === 'micro') {
      this.triggerHaptics([25, 35, 45]);
    } else {
      this.triggerHaptics([40, 50, 60]);
    }

    const now = this.ctx.currentTime;
    let frequencies;
    if (tier === 'ultra' || tier === 'colossal') {
      frequencies = [261.63, 329.63, 392.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
    } else if (tier === 'mega') {
      frequencies = [369.99, 440.0, 554.37, 587.33, 739.99, 880.0, 1108.73, 1174.66, 1479.98];
    } else if (tier === 'big') {
      frequencies = [369.99, 440.0, 554.37, 587.33, 739.99, 880.0, 1174.66];
    } else if (tier === 'nice' || tier === 'super') {
      frequencies = [392.0, 493.88, 587.33, 739.99, 880.0];
    } else if (tier === 'mini') {
      frequencies = [523.25, 659.25, 783.99, 1046.5];
    } else if (tier === 'micro') {
      frequencies = [880.0, 1174.66];
    } else {
      frequencies = [440.0, 554.37, 659.25, 880.0];
    }

    const stepInterval = tier === 'micro' ? 0.045 : tier === 'mini' ? 0.055 : 0.065;
    frequencies.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = tier === 'ultra' || tier === 'colossal' || tier === 'mega' || tier === 'big' ? 'triangle' : 'sine';
      const t = now + i * stepInterval;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(tier === 'micro' ? 0.16 : 0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (tier === 'micro' ? 0.22 : 0.38));

      osc.connect(gain);
      this.playVoice([osc, gain], (tier === 'micro' ? 0.24 : 0.4) + i * stepInterval);
      osc.start(t);
      osc.stop(t + (tier === 'micro' ? 0.24 : 0.4));
    });

    // Rapid coin clink sparkles
    let clinkCount = 3;
    if (tier === 'ultra' || tier === 'colossal') clinkCount = 14;
    else if (tier === 'mega') clinkCount = 8;
    else if (tier === 'big') clinkCount = 5;
    else if (tier === 'nice' || tier === 'super') clinkCount = 4;
    else if (tier === 'mini') clinkCount = 3;
    else if (tier === 'micro') clinkCount = 1;

    for (let c = 0; c < clinkCount; c++) {
      const cOsc = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      cOsc.type = 'sine';
      const ct = now + 0.08 + c * 0.06;
      cOsc.frequency.setValueAtTime(1800 + Math.random() * 800, ct);
      cGain.gain.setValueAtTime(0.08, ct);
      cGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);

      cOsc.connect(cGain);
      this.playVoice([cOsc, cGain], 0.08 + c * 0.06);
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
      this.playVoice([osc, gain], (isBigWin ? 0.48 : 0.32) + i * (isBigWin ? 0.09 : 0.075));
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
    this.playVoice([osc, gain], 0.06);
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
      this.playVoice([osc, gain], 0.58 + i * 0.075);
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
      this.playVoice([osc, gain], 0.35 + i * 0.055);
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
    this.playVoice([osc, gain], 0.045);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playCollectorFullFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Ascending royal Egyptian fanfare with crystalline harmonics & triumphant chord
    const melody = [
      { freq: 261.63, time: 0.00, dur: 0.25 }, // C4
      { freq: 329.63, time: 0.10, dur: 0.25 }, // E4
      { freq: 392.00, time: 0.20, dur: 0.25 }, // G4
      { freq: 523.25, time: 0.30, dur: 0.35 }, // C5
      { freq: 659.25, time: 0.42, dur: 0.35 }, // E5
      { freq: 783.99, time: 0.54, dur: 0.50 }, // G5
      { freq: 1046.50, time: 0.68, dur: 0.95 }, // C6 (High Peak)
    ];

    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + note.time;
      osc.frequency.setValueAtTime(note.freq, t);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);
      osc.connect(gain);
      this.playVoice([osc, gain], note.time + note.dur);
      osc.start(t);
      osc.stop(t + note.dur);
    });

    // Crystalline chime cascade
    const chimes = [1318.51, 1567.98, 2093.00, 2637.02];
    chimes.forEach((freq, idx) => {
      const cOsc = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      cOsc.type = 'sine';
      const t = now + 0.75 + idx * 0.08;
      cOsc.frequency.setValueAtTime(freq, t);
      cGain.gain.setValueAtTime(0.18, t);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      cOsc.connect(cGain);
      this.playVoice([cOsc, cGain], 0.75 + idx * 0.08 + 0.6);
      cOsc.start(t);
      cOsc.stop(t + 0.6);
    });
  }

  // Audio sample playback for Golden Hustle tactile casino effects
  playSfxSample(name, volume = 0.65) {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(`/assets/audio/sfx/${name}.ogg`);
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.play().catch(() => {});
    } catch (_) {}
  }

  playHoldAndWinLock() {
    this.playSfxSample('stack', 0.8);
    this.playCoinTick(1);
  }

  playRespinReset() {
    this.playSfxSample('coins2', 0.85);
    this.playBonusPick(true);
  }

  playAscensionStep(step = 0) {
    this.playSfxSample('click', 0.6);
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const baseFreq = 330 * Math.pow(1.12, step);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.22);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    this.playVoice([osc, gain], 0.28);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playAscensionCrash() {
    this.playSfxSample('clunk', 0.85);
    this.playThunderStrike();
  }

  playAscensionCashOut() {
    this.playSfxSample('coins', 0.9);
    this.playWinCelebration('big');
  }
}

export const soundEngine = new SoundEngine();
