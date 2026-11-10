// ============================================================================
// PSYCHOACOUSTIC FLOW & DOPAMINE REWARD PREDICTION ERROR (RPE) SOUND ENGINE
// ============================================================================
// Grounded in empirical neuroscience and behavioral gaming studies:
// 1. University of Waterloo Slot Acoustic Studies (Dixon, Harrigan et al., 2010-2019):
//    Consonant major-scale intervals (5:4 Major 3rds, 3:2 Perfect 5ths, 2:1 Octaves)
//    increase psychological arousal and enjoyment while dissonant/sawtooth waveforms
//    cause rapid listener fatigue and session termination.
// 2. "The Machine Zone" & Extended Flow State (Natasha Dow Schüll, MIT Press):
//    Repetitive core actions (Spin Start, Reel Landings, Instant Slam-Stop) must be
//    warm, dampened, low-frequency (< 450 Hz) tactile velvet/marimba pulses with zero
//    harsh high-frequency transients or pitch-bent screeches so players enter effortless
//    cognitive flow across hundreds of desktop or mobile spins.
// 3. Dopamine & Reward Prediction Error (Schultz, 2016; Salimpoor et al., McGill):
//    Dopamine release in the nucleus accumbens peaks when auditory cues cleanly
//    distinguish neutral spins (quiet velvet landings) from true anticipation (warm
//    harmonic chord swells) and proportional C-Major Pentatonic / Solfeggio (528 Hz)
//    harp-celesta reward resolutions.
// 4. Master Acoustic Protection & Zero-Leak Architecture:
//    Every synthesized voice passes through a Master Warmth Low-Pass Filter (3.2 kHz)
//    and Soft-Knee Dynamics Limiter, with per-cue cooldowns to prevent overlapping
//    audio collisions, and automatic node disconnection on completion.
// ============================================================================

// Pure C-Major / Solfeggio Harmonic Pentatonic Frequencies (Hz)
const HARMONIC_SCALE = {
  C2: 65.41,
  G2: 98.00,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G3: 196.00,
  A3: 220.00,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25,
  SOLFEGGIO_528: 528.00,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.00,
  B5: 987.77,
  C6: 1046.50,
  D6: 1174.66,
  E6: 1318.51,
  G6: 1567.98,
};

// Ascending velvet marimba reel-landing pitches (C3 Pentatonic)
const REEL_STOP_BASS = [
  HARMONIC_SCALE.C3,
  HARMONIC_SCALE.D3,
  HARMONIC_SCALE.E3,
  HARMONIC_SCALE.G3,
  HARMONIC_SCALE.A3,
];

// Pure stationary harmonic bell notes when a special symbol lands on a reel
const REEL_SPECIAL_BELL = [
  HARMONIC_SCALE.C5,
  HARMONIC_SCALE.D5,
  HARMONIC_SCALE.E5,
  HARMONIC_SCALE.G5,
  HARMONIC_SCALE.C6,
];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.masterFilter = null;
    this.masterCompressor = null;
    this.muted = false;
    this.ambientGain = null;
    this.ambientOscs = [];
    this.ambientStarted = true; // Prevent synthetic continuous drone
    this.lastTickMs = 0;

    // Anti-clash cooldown registry (prevents overlapping sound walls on desktop/mobile)
    this.cooldowns = {};

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
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this._setupMasterBus();
      }
    }
    if (this.ctx && !this.masterGain) {
      this._setupMasterBus();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _setupMasterBus() {
    if (!this.ctx || this.masterGain) return;
    try {
      const now = this.ctx.currentTime;

      // 1. Master Warmth Filter: Rolls off harsh frequencies above 3.2 kHz
      //    so zero ear-piercing transients ever reach desktop speakers or headphones
      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(3200, now);
      this.masterFilter.Q.setValueAtTime(0.65, now);

      // 2. Soft-Knee Psychoacoustic Dynamics Limiter:
      //    Guarantees consistent, velvety loudness even during multi-line wins
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-16, now);
      this.masterCompressor.knee.setValueAtTime(18, now);
      this.masterCompressor.ratio.setValueAtTime(6, now);
      this.masterCompressor.attack.setValueAtTime(0.005, now);
      this.masterCompressor.release.setValueAtTime(0.18, now);

      // 3. Master Output Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.82, now);

      this.masterFilter.connect(this.masterCompressor);
      this.masterCompressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (_) {
      // Fallback if mock AudioContext in tests lacks compressor/filter
      this.masterGain = null;
    }
  }

  _canPlay(cueId, minIntervalMs = 80) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.cooldowns[cueId] || 0;
    if (now - last < minIntervalMs) {
      return false;
    }
    this.cooldowns[cueId] = now;
    return true;
  }

  // Auto-disconnects audio nodes from the audio graph upon playback finish
  // to eliminate memory leaks and DSP overload during extended flow sessions
  playVoice(nodes, durationSeconds = 0.5) {
    if (!this.ctx) return;
    const terminalNode = nodes[nodes.length - 1];
    const targetBus = this.masterFilter || this.ctx.destination;
    if (terminalNode && typeof terminalNode.connect === 'function' && targetBus) {
      try {
        terminalNode.connect(targetBus);
      } catch (_) {}
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

  // Helper to synthesize a warm, consonant marimba / harp / celesta note with soft attack
  _playWarmNote({
    freq = 440,
    startTime = 0,
    duration = 0.28,
    peakGain = 0.08,
    type = 'sine',
    endFreq = null,
    filterCutoff = 2200,
    attackSec = 0.01,
  }) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, startTime);

    osc.type = type === 'sawtooth' || type === 'square' ? 'triangle' : type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq && endFreq > 20) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration * 0.85);
    }

    // Soft linear attack eliminates digital speaker click transients
    gain.gain.setValueAtTime(0.0005, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(attackSec, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    this.playVoice([osc, filter, gain], (startTime - this.ctx.currentTime) + duration + 0.03);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
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
      if (
        typeof window !== 'undefined' &&
        'navigator' in window &&
        'vibrate' in navigator &&
        (!navigator.userActivation || navigator.userActivation.hasBeenActive)
      ) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics unavailable on non-touch desktop browsers
    }
  }

  playButtonClick(pitch = 520) {
    if (this.muted || !this._canPlay('buttonClick', 40)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([10]);
    const now = this.ctx.currentTime;

    // Ultra-soft felt/wood UI tap (non-fatiguing across long sessions)
    const baseFreq = Math.min(440, Math.max(220, pitch * 0.6));
    this._playWarmNote({
      freq: baseFreq,
      endFreq: baseFreq * 0.68,
      startTime: now,
      duration: 0.042,
      peakGain: 0.045,
      type: 'sine',
      filterCutoff: 580,
      attackSec: 0.004,
    });
  }

  playButtonHover() {
    // Intentionally silent to preserve acoustic serenity when moving mouse on desktop
    return;
  }

  /**
   * SPIN INITIATION ("The Machine Zone" Entry Cue)
   * Designed specifically to eliminate desktop spin annoyance:
   * Uses a whisper-soft, cushioned low-end velvet pulse (72 Hz -> 40 Hz) paired
   * with a barely-audible C-Major harmonic breath (C4 261.63 Hz -> G4 392 Hz).
   * Zero clicks, zero buzz, zero high-frequency sharpness.
   */
  playSpinStart() {
    if (this.muted || !this._canPlay('spinStart', 90)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([16]);
    const now = this.ctx.currentTime;

    // 1. Cushioned velvet sub-bass pulse (tactile, warm, non-intrusive)
    this._playWarmNote({
      freq: 74,
      endFreq: 41,
      startTime: now,
      duration: 0.085,
      peakGain: 0.09,
      type: 'sine',
      filterCutoff: 150,
      attackSec: 0.008,
    });

    // 2. Subtle C-Major harmonic silk breath (C4 -> G4 Perfect 5th whisper)
    this._playWarmNote({
      freq: HARMONIC_SCALE.C4,
      endFreq: HARMONIC_SCALE.G4,
      startTime: now + 0.005,
      duration: 0.09,
      peakGain: 0.022,
      type: 'sine',
      filterCutoff: 650,
      attackSec: 0.015,
    });
  }

  /**
   * FLOW STREAK HARMONIC REINFORCEMENT
   * Gentle Solfeggio / C-Major Maj9 chord whisper that subtly rewards rhythm
   * without interrupting concentration.
   */
  playFlowStreak(streak = 1) {
    if (this.muted || !this._canPlay('flowStreak', 600)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([14, 24]);
    const now = this.ctx.currentTime;

    // Pure C-Major9 / Solfeggio intervals that step gently through octaves
    const chord = [
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      streak >= 5 ? HARMONIC_SCALE.D5 : HARMONIC_SCALE.C5,
    ];

    chord.forEach((freq, idx) => {
      this._playWarmNote({
        freq,
        startTime: now + idx * 0.038,
        duration: 0.28,
        peakGain: 0.038,
        type: 'sine',
        filterCutoff: 1200,
        attackSec: 0.014,
      });
    });
  }

  /**
   * INSTANT SLAM STOP (Spacebar / Quick-Stop on Desktop)
   * Replaced harsh 880 Hz sawtooth buzz with a warm, dampened low-frequency
   * velvet lock and a soft C5 harmonic bell.
   */
  playSlamStop() {
    if (this.muted || !this._canPlay('slamStop', 100)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([24, 35]);
    const now = this.ctx.currentTime;

    // 1. Warm cushioned low-end mechanical settle (no sawtooth buzz!)
    this._playWarmNote({
      freq: 98,
      endFreq: 42,
      startTime: now,
      duration: 0.14,
      peakGain: 0.12,
      type: 'sine',
      filterCutoff: 210,
      attackSec: 0.006,
    });

    // 2. Soft C-Major Pentatonic woodblock resonance (G3)
    this._playWarmNote({
      freq: HARMONIC_SCALE.G3,
      endFreq: HARMONIC_SCALE.C3,
      startTime: now + 0.005,
      duration: 0.08,
      peakGain: 0.055,
      type: 'triangle',
      filterCutoff: 420,
      attackSec: 0.006,
    });

    // 3. Gentle C5 crystal overtone
    this._playWarmNote({
      freq: HARMONIC_SCALE.C5,
      startTime: now + 0.012,
      duration: 0.20,
      peakGain: 0.035,
      type: 'sine',
      filterCutoff: 1400,
      attackSec: 0.01,
    });
  }

  /**
   * DOPAMINE ANTICIPATION & FINAL-TILE SUSPENSE RISER
   * Plays an accelerating tempo pulse roll + rising volume & harmonic pitch crescendo
   * as the final reel spins longer in suspense waiting for the 3rd special tile.
   */
  playAnticipationRiser(durationSec = 1.65) {
    if (this.muted || !this._canPlay('anticipationRiser', 900)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([22, 30, 40, 25, 50]);
    const now = this.ctx.currentTime;
    const totalSec = Math.max(0.6, Math.min(2.6, Number(durationSec) || 1.65));

    // 1. Sustained rising harmonic tension pad that swells in volume over totalSec
    const padNotes = [HARMONIC_SCALE.C4, HARMONIC_SCALE.G4, HARMONIC_SCALE.D5, HARMONIC_SCALE.E5];
    padNotes.forEach((freq, idx) => {
      this._playWarmNote({
        freq,
        endFreq: freq * 1.12,
        startTime: now + idx * 0.04,
        duration: totalSec,
        peakGain: 0.055 + idx * 0.012,
        type: 'sine',
        filterCutoff: 1650,
        attackSec: totalSec * 0.65,
      });
    });

    // 2. Accelerating Tempo Heartbeat / Drum Roll + Rising Volume & Pitch Crescendo!
    // Pulse intervals shrink from ~135ms down to ~42ms while gain ramps from 0.038 up to 0.145
    const scaleLadder = [
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.D4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      HARMONIC_SCALE.A4,
      HARMONIC_SCALE.C5,
      HARMONIC_SCALE.D5,
      HARMONIC_SCALE.E5,
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.A5,
      HARMONIC_SCALE.C6,
    ];
    let cursor = 0.04;
    let stepIdx = 0;
    while (cursor < totalSec - 0.04 && stepIdx < 24) {
      const progress = Math.min(1, cursor / totalSec);
      // Accelerating tempo: interval shrinks from 0.135s -> 0.042s
      const stepInterval = 0.135 - progress * 0.093;
      // Increasing volume: gain ramps 3.6x louder as the final tile approaches!
      const pulseGain = 0.038 + Math.pow(progress, 1.35) * 0.11;
      const noteFreq =
        scaleLadder[Math.min(scaleLadder.length - 1, Math.floor(progress * scaleLadder.length))];

      // Low heartbeat thud that accelerates in tempo
      this._playWarmNote({
        freq: 72 + progress * 48,
        endFreq: 38,
        startTime: now + cursor,
        duration: Math.max(0.038, stepInterval * 0.82),
        peakGain: pulseGain * 1.15,
        type: 'triangle',
        filterCutoff: 320 + progress * 480,
        attackSec: 0.005,
      });

      // Shimmering harmonic pulse climbing in pitch & volume
      this._playWarmNote({
        freq: noteFreq,
        startTime: now + cursor,
        duration: Math.max(0.045, stepInterval * 0.9),
        peakGain: pulseGain * 0.78,
        type: 'sine',
        filterCutoff: 1200 + progress * 1400,
        attackSec: 0.006,
      });

      cursor += stepInterval;
      stepIdx++;
    }
  }

  /**
   * HEAVY SPECIAL TILE SLAM IMPACT
   * Triggered when a Scatter, Guardian Awakener Relic, or Expanding Wild slams into place.
   * Delivers a seismic sub-bass stone thud + crisp mechanical lock + ascending harmonic bell.
   */
  playSpecialTileSlam(colIndex = 0, hitOrder = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const safeOrder = Math.max(1, Math.min(4, hitOrder));
    this.triggerHaptics(safeOrder >= 3 ? [45, 30, 65] : [32, 24, 42]);
    const now = this.ctx.currentTime;

    // 1. Seismic Sub-Bass Stone Tablet Slam (128 Hz -> 32 Hz punch)
    this._playWarmNote({
      freq: 128 + safeOrder * 10,
      endFreq: 32,
      startTime: now,
      duration: 0.22,
      peakGain: Math.min(0.22, 0.145 + safeOrder * 0.022),
      type: 'sine',
      filterCutoff: 280,
      attackSec: 0.004,
    });

    // 2. Crisp Stone Pillar Anvil Impact Body
    this._playWarmNote({
      freq: HARMONIC_SCALE.G3 * (1 + (safeOrder - 1) * 0.12),
      endFreq: HARMONIC_SCALE.C3,
      startTime: now + 0.004,
      duration: 0.13,
      peakGain: 0.095 + safeOrder * 0.015,
      type: 'triangle',
      filterCutoff: 680,
      attackSec: 0.004,
    });

    // 3. Ascending High-Voltage Harmonic Chime (climbs with hitOrder 1 -> 2 -> 3!)
    const slamBellByOrder = [
      HARMONIC_SCALE.C5,
      HARMONIC_SCALE.E5,
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.C6,
    ];
    const bellFreq = slamBellByOrder[safeOrder - 1] || HARMONIC_SCALE.C5;
    this._playWarmNote({
      freq: bellFreq,
      startTime: now + 0.01,
      duration: 0.34,
      peakGain: 0.075 + safeOrder * 0.015,
      type: 'sine',
      filterCutoff: 2200,
      attackSec: 0.008,
    });
  }

  playReelTick(colIndex = 0) {
    // Continuous reel clicking stays silent to maintain hypnotic flow state
    return;
  }

  initTickBuffers() {
    if (!this.ctx || this.tickBuffers) return;
    try {
      this.tickBuffers = [];
      const sampleRate = this.ctx.sampleRate || 44100;
      const numSamples = Math.round(sampleRate * 0.016);
      const buffer = this.ctx.createBuffer(1, numSamples, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const progress = i / numSamples;
        data[i] = Math.sin(2 * Math.PI * 90 * t) * (0.008 * (1 - progress));
      }
      this.tickBuffers.push(buffer);
    } catch (_) {}
  }

  /**
   * REEL LANDING CADENCE ("The Machine Zone" Musical Heartbeat)
   * Instead of 5 loud triangle thuds + pitch-sliding screeches, each reel column (0..4)
   * produces a soft, dampened wooden marimba tap ascending gently along the C-Major
   * pentatonic bass scale (C3, D3, E3, G3, A3).
   * When a Wild or Bonus Scatter lands (hasSpecial), a pure, stationary C-Major bell
   * note (C5..C6) shimmers softly—with zero pitch-bend screech!
   */
  playReelStop(colIndex = 0, hasSpecial = false) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const safeCol = Math.max(0, Math.min(4, colIndex));
    this.triggerHaptics(hasSpecial ? [18, 28] : [10 + safeCol * 3]);

    const now = this.ctx.currentTime;
    const bassFreq = REEL_STOP_BASS[safeCol] || HARMONIC_SCALE.C3;

    // 1. Soft dampened marimba / velvet wood tap (gentle low-pass at 360 Hz)
    this._playWarmNote({
      freq: bassFreq,
      endFreq: bassFreq * 0.58,
      startTime: now,
      duration: 0.095,
      peakGain: 0.085,
      type: 'sine',
      filterCutoff: 360,
      attackSec: 0.006,
    });

    // 2. Subtle warm body overtone
    this._playWarmNote({
      freq: bassFreq * 2,
      endFreq: bassFreq * 1.4,
      startTime: now,
      duration: 0.055,
      peakGain: 0.025,
      type: 'triangle',
      filterCutoff: 480,
      attackSec: 0.005,
    });

    // 3. Pure stationary C-Major celesta bell when a special symbol lands (NO slide whistle!)
    if (hasSpecial) {
      const bellFreq = REEL_SPECIAL_BELL[safeCol] || HARMONIC_SCALE.C5;
      this._playWarmNote({
        freq: bellFreq,
        startTime: now + 0.012,
        duration: 0.26,
        peakGain: 0.052,
        type: 'sine',
        filterCutoff: 1650,
        attackSec: 0.012,
      });
    }
  }

  /**
   * EXPANDING GUARDIAN WILD HARMONIC BLOOM
   * Replaced harsh sawtooth brass with a warm, sacred C-Major9 / 528 Hz harp chord swell.
   */
  playAnubisExpand() {
    if (this.muted || !this._canPlay('anubisExpand', 450)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chord = [
      HARMONIC_SCALE.C3,
      HARMONIC_SCALE.G3,
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      HARMONIC_SCALE.C5,
    ];
    chord.forEach((freq, idx) => {
      this._playWarmNote({
        freq,
        startTime: now + idx * 0.032,
        duration: 0.55,
        peakGain: idx < 2 ? 0.055 : 0.042,
        type: idx < 2 ? 'triangle' : 'sine',
        filterCutoff: 1400,
        attackSec: 0.04,
      });
    });
  }

  /**
   * GUARDIAN CELESTIAL THUNDER
   * Replaced the 1400 Hz sawtooth snap with a deep, warm sub-bass temple gong
   * and consonant harmonic fifth resonance.
   */
  playThunderStrike() {
    if (this.muted || !this._canPlay('thunderStrike', 350)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Deep resonant temple sub-bass boom (C2 -> 36 Hz)
    this._playWarmNote({
      freq: 92,
      endFreq: 36,
      startTime: now,
      duration: 0.48,
      peakGain: 0.16,
      type: 'sine',
      filterCutoff: 220,
      attackSec: 0.01,
    });

    // 2. Warm harmonic chime shimmer (G4 + C5)
    this._playWarmNote({
      freq: HARMONIC_SCALE.G4,
      startTime: now + 0.015,
      duration: 0.34,
      peakGain: 0.055,
      type: 'triangle',
      filterCutoff: 1300,
      attackSec: 0.012,
    });
    this._playWarmNote({
      freq: HARMONIC_SCALE.C5,
      startTime: now + 0.045,
      duration: 0.38,
      peakGain: 0.05,
      type: 'sine',
      filterCutoff: 1500,
      attackSec: 0.015,
    });

    this.triggerHaptics([30, 25, 60]);
  }

  /**
   * BASTET SOLAR BLOOM
   * Smooth, warm harmonic sunrise arpeggio (no piercing frequency sweeps).
   */
  playSolarFireball() {
    if (this.muted || !this._canPlay('solarFireball', 350)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Warm low-end cushion
    this._playWarmNote({
      freq: HARMONIC_SCALE.C3,
      endFreq: HARMONIC_SCALE.G2,
      startTime: now,
      duration: 0.38,
      peakGain: 0.11,
      type: 'sine',
      filterCutoff: 300,
      attackSec: 0.02,
    });

    // Golden C-Major triad shimmer
    [HARMONIC_SCALE.E4, HARMONIC_SCALE.G4, HARMONIC_SCALE.C5, HARMONIC_SCALE.E5].forEach((freq, i) => {
      this._playWarmNote({
        freq,
        startTime: now + i * 0.04,
        duration: 0.32,
        peakGain: 0.048,
        type: 'sine',
        filterCutoff: 1600,
        attackSec: 0.015,
      });
    });

    this.triggerHaptics([25, 20, 45]);
  }

  playMartialSwoosh(intensity = 1.0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([14, 20]);
    const now = this.ctx.currentTime;
    const clamped = Math.min(1.3, Math.max(0.7, intensity));

    this._playWarmNote({
      freq: 220 * clamped,
      endFreq: 110 * clamped,
      startTime: now,
      duration: 0.18,
      peakGain: 0.07,
      type: 'sine',
      filterCutoff: 520,
      attackSec: 0.02,
    });
  }

  playMartialImpact() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([25, 35]);
    const now = this.ctx.currentTime;
    this._playWarmNote({
      freq: 110,
      endFreq: 42,
      startTime: now,
      duration: 0.14,
      peakGain: 0.12,
      type: 'sine',
      filterCutoff: 240,
      attackSec: 0.008,
    });
  }

  playStaffFlourish() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    [0, 0.07, 0.14].forEach((offset, idx) => {
      setTimeout(() => {
        this.playMartialSwoosh(1.0 + idx * 0.1);
      }, offset * 1000);
    });
    setTimeout(() => {
      this.playMartialImpact();
    }, 220);
  }

  playQiGather() {
    if (this.muted || !this._canPlay('qiGather', 350)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([18, 25, 35]);
    const now = this.ctx.currentTime;
    const freqs = [
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      HARMONIC_SCALE.SOLFEGGIO_528,
    ];
    freqs.forEach((freq, idx) => {
      this._playWarmNote({
        freq,
        startTime: now + idx * 0.04,
        duration: 0.30,
        peakGain: 0.045,
        type: 'sine',
        filterCutoff: 1200,
        attackSec: 0.02,
      });
    });
  }

  playBigWinCelebration(tier = 'big') {
    this.playWinCelebration(tier);
  }

  /**
   * REWARD PREDICTION ERROR (RPE) DOPAMINE WIN CELEBRATION
   * Scales proportionally with win size using pure C-Major Pentatonic & Solfeggio
   * harp/celesta arpeggios and warm sub-bass harmonic foundation:
   * - Micro / Mini wins: Gentle 2-3 note C-Major celesta motif (preserves spin rhythm).
   * - Nice / Big / Mega / Ultra wins: Lush ascending C-Major9 harp cascade resolving
   *   to the tonic octave with warm golden bell sparkles (< 2.2 kHz).
   */
  playWinCelebration(tier = 'standard') {
    if (this.muted || !this._canPlay('winCelebration', 140)) return;
    this.init();
    if (!this.ctx) return;

    if (tier === 'ultra' || tier === 'colossal') {
      this.triggerHaptics([80, 50, 100, 50, 140, 60, 200]);
    } else if (tier === 'mega') {
      this.triggerHaptics([60, 40, 90, 40, 130, 50, 180]);
    } else if (tier === 'big') {
      this.triggerHaptics([50, 35, 70, 35, 110]);
    } else if (tier === 'nice' || tier === 'super') {
      this.triggerHaptics([40, 30, 65]);
    } else if (tier === 'mini') {
      this.triggerHaptics([25, 30, 45]);
    } else if (tier === 'micro') {
      this.triggerHaptics([18, 25]);
    } else {
      this.triggerHaptics([30, 40]);
    }

    const now = this.ctx.currentTime;
    let frequencies;
    if (tier === 'ultra' || tier === 'colossal') {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.B4,
        HARMONIC_SCALE.C5,
        HARMONIC_SCALE.D5,
        HARMONIC_SCALE.E5,
        HARMONIC_SCALE.G5,
        HARMONIC_SCALE.A5,
        HARMONIC_SCALE.C6,
      ];
    } else if (tier === 'mega') {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
        HARMONIC_SCALE.D5,
        HARMONIC_SCALE.E5,
        HARMONIC_SCALE.G5,
        HARMONIC_SCALE.C6,
      ];
    } else if (tier === 'big') {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
        HARMONIC_SCALE.E5,
        HARMONIC_SCALE.G5,
        HARMONIC_SCALE.C6,
      ];
    } else if (tier === 'nice' || tier === 'super') {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
        HARMONIC_SCALE.E5,
      ];
    } else if (tier === 'mini') {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
      ];
    } else if (tier === 'micro') {
      frequencies = [
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
      ];
    } else {
      frequencies = [
        HARMONIC_SCALE.C4,
        HARMONIC_SCALE.E4,
        HARMONIC_SCALE.G4,
        HARMONIC_SCALE.C5,
      ];
    }

    // Warm root bass foundation on significant wins (grounds the chord in the chest/speakers)
    if (tier !== 'micro') {
      this._playWarmNote({
        freq: HARMONIC_SCALE.C3,
        startTime: now,
        duration: 0.45,
        peakGain: 0.08,
        type: 'sine',
        filterCutoff: 320,
        attackSec: 0.015,
      });
    }

    const stepInterval = tier === 'micro' ? 0.05 : tier === 'mini' ? 0.06 : 0.068;
    const isRichTier = tier === 'ultra' || tier === 'colossal' || tier === 'mega' || tier === 'big';

    frequencies.forEach((freq, i) => {
      const isFinalNote = i === frequencies.length - 1;
      this._playWarmNote({
        freq,
        startTime: now + i * stepInterval,
        duration: isFinalNote ? 0.52 : (tier === 'micro' ? 0.24 : 0.36),
        peakGain: tier === 'micro' ? 0.065 : (isFinalNote ? 0.105 : 0.085),
        type: isRichTier && i < 4 ? 'triangle' : 'sine',
        filterCutoff: 1900,
        attackSec: 0.012,
      });
    });

    // Warm harmonic celesta shimmers (kept strictly in C-Major pentatonic, < 1600 Hz)
    const shimmerNotes = [
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.A5,
      HARMONIC_SCALE.C6,
      HARMONIC_SCALE.D6,
      HARMONIC_SCALE.E6,
    ];
    let shimmerCount = 0;
    if (tier === 'ultra' || tier === 'colossal') shimmerCount = 6;
    else if (tier === 'mega') shimmerCount = 4;
    else if (tier === 'big') shimmerCount = 3;
    else if (tier === 'nice' || tier === 'super') shimmerCount = 2;

    for (let c = 0; c < shimmerCount; c++) {
      const sFreq = shimmerNotes[c % shimmerNotes.length];
      this._playWarmNote({
        freq: sFreq,
        startTime: now + 0.14 + c * 0.075,
        duration: 0.18,
        peakGain: 0.035,
        type: 'sine',
        filterCutoff: 2000,
        attackSec: 0.01,
      });
    }
  }

  playWin(isBigWin = false) {
    this.playWinCelebration(isBigWin ? 'big' : 'standard');
  }

  /**
   * DOPAMINE ROLLUP COUNTER TICK
   * Steps smoothly along the C-Major Pentatonic scale as the win counter climbs,
   * creating a musical harp glissando rather than harsh high-pitched coin clicks.
   */
  playCoinTick(progress = 0) {
    if (this.muted || !this._canPlay('coinTick', 48)) return;
    this.init();
    if (!this.ctx) return;

    if (Math.random() < 0.18) {
      this.triggerHaptics([6]);
    }

    const now = this.ctx.currentTime;
    const scale = [
      HARMONIC_SCALE.C5,
      HARMONIC_SCALE.D5,
      HARMONIC_SCALE.E5,
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.A5,
      HARMONIC_SCALE.C6,
      HARMONIC_SCALE.D6,
      HARMONIC_SCALE.E6,
    ];
    const clampedProgress = Math.min(1, Math.max(0, progress));
    const idx = Math.min(scale.length - 1, Math.floor(clampedProgress * scale.length));
    const freq = scale[idx];

    this._playWarmNote({
      freq,
      startTime: now,
      duration: 0.075,
      peakGain: 0.042,
      type: 'sine',
      filterCutoff: 1750,
      attackSec: 0.006,
    });
  }

  /**
   * BONUS FEATURE UNLOCK FANFARE
   * Rich C-Major9 royal harp & temple bell resolution.
   */
  playBonusTrigger() {
    if (this.muted || !this._canPlay('bonusTrigger', 500)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      HARMONIC_SCALE.B4,
      HARMONIC_SCALE.C5,
      HARMONIC_SCALE.E5,
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.C6,
    ];

    // Warm C3 bass foundation
    this._playWarmNote({
      freq: HARMONIC_SCALE.C3,
      startTime: now,
      duration: 0.75,
      peakGain: 0.11,
      type: 'triangle',
      filterCutoff: 350,
      attackSec: 0.02,
    });

    notes.forEach((freq, i) => {
      this._playWarmNote({
        freq,
        startTime: now + i * 0.07,
        duration: i === notes.length - 1 ? 0.65 : 0.42,
        peakGain: 0.09,
        type: i < 3 ? 'triangle' : 'sine',
        filterCutoff: 1850,
        attackSec: 0.014,
      });
    });
  }

  playBonusPick(isSpecial = false) {
    if (this.muted || !this._canPlay('bonusPick', 70)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = isSpecial
      ? [HARMONIC_SCALE.C5, HARMONIC_SCALE.E5, HARMONIC_SCALE.G5, HARMONIC_SCALE.C6]
      : [HARMONIC_SCALE.G4, HARMONIC_SCALE.C5, HARMONIC_SCALE.E5];

    freqs.forEach((freq, i) => {
      this._playWarmNote({
        freq,
        startTime: now + i * 0.052,
        duration: 0.28,
        peakGain: 0.075,
        type: 'sine',
        filterCutoff: 1700,
        attackSec: 0.01,
      });
    });
  }

  playWheelTick(pitchBoost = 0) {
    if (this.muted || !this._canPlay('wheelTick', 35)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const f = Math.min(520, 240 + pitchBoost * 10);
    this._playWarmNote({
      freq: f,
      endFreq: 110,
      startTime: now,
      duration: 0.04,
      peakGain: 0.065,
      type: 'sine',
      filterCutoff: 600,
      attackSec: 0.004,
    });
  }

  playCollectorFullFanfare() {
    if (this.muted || !this._canPlay('collectorFanfare', 600)) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const melody = [
      { freq: HARMONIC_SCALE.C4, time: 0.00, dur: 0.28 },
      { freq: HARMONIC_SCALE.E4, time: 0.09, dur: 0.28 },
      { freq: HARMONIC_SCALE.G4, time: 0.18, dur: 0.28 },
      { freq: HARMONIC_SCALE.C5, time: 0.27, dur: 0.36 },
      { freq: HARMONIC_SCALE.E5, time: 0.38, dur: 0.36 },
      { freq: HARMONIC_SCALE.G5, time: 0.49, dur: 0.45 },
      { freq: HARMONIC_SCALE.C6, time: 0.62, dur: 0.80 },
    ];

    melody.forEach((note) => {
      this._playWarmNote({
        freq: note.freq,
        startTime: now + note.time,
        duration: note.dur,
        peakGain: 0.095,
        type: 'sine',
        filterCutoff: 1900,
        attackSec: 0.014,
      });
    });
  }

  // Audio sample playback with gentle volume ceiling for Golden Hustle bonus cues
  playSfxSample(name, volume = 0.45) {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(`/assets/audio/sfx/${name}.ogg`);
      audio.volume = Math.min(0.55, Math.max(0, volume * 0.65));
      audio.play().catch(() => {});
    } catch (_) {}
  }

  playHoldAndWinLock() {
    this.playSfxSample('stack', 0.45);
    this.playCoinTick(0.75);
  }

  playRespinReset() {
    this.playSfxSample('coins2', 0.45);
    this.playBonusPick(true);
  }

  playAscensionStep(step = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const scale = [
      HARMONIC_SCALE.C4,
      HARMONIC_SCALE.D4,
      HARMONIC_SCALE.E4,
      HARMONIC_SCALE.G4,
      HARMONIC_SCALE.A4,
      HARMONIC_SCALE.C5,
      HARMONIC_SCALE.D5,
      HARMONIC_SCALE.E5,
      HARMONIC_SCALE.G5,
      HARMONIC_SCALE.C6,
    ];
    const baseFreq = scale[Math.min(scale.length - 1, Math.max(0, step))];
    this._playWarmNote({
      freq: baseFreq,
      endFreq: baseFreq * 1.12,
      startTime: now,
      duration: 0.24,
      peakGain: 0.085,
      type: 'sine',
      filterCutoff: 1600,
      attackSec: 0.012,
    });
  }

  playAscensionCrash() {
    this.playSfxSample('clunk', 0.45);
    this.playThunderStrike();
  }

  playAscensionCashOut() {
    this.playSfxSample('coins', 0.5);
    this.playWinCelebration('big');
  }

  playSolarFireball() {
    if (this.muted || !this._canPlay('solarFireball', 120)) return;
    this.init();
    if (!this.ctx) return;

    this.triggerHaptics([25, 35, 50]);
    const now = this.ctx.currentTime;
    this._playWarmNote({
      freq: HARMONIC_SCALE.G3 || 196,
      endFreq: HARMONIC_SCALE.C5,
      startTime: now,
      duration: 0.28,
      peakGain: 0.08,
      type: 'triangle',
      filterCutoff: 1500,
      attackSec: 0.015,
    });
    this._playWarmNote({
      freq: HARMONIC_SCALE.E4,
      endFreq: HARMONIC_SCALE.G5,
      startTime: now + 0.05,
      duration: 0.24,
      peakGain: 0.06,
      type: 'sine',
      filterCutoff: 1800,
      attackSec: 0.012,
    });
  }
}

export const soundEngine = new SoundEngine();
