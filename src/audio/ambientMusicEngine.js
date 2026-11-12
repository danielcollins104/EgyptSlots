// ============================================================================
// AMBIENT BACKGROUND MUSIC & FLOW CONSCIOUSNESS ENGINE
// ============================================================================
// Grounded in empirical flow-state & psychoacoustic research:
// - Maintains a soothing, low-arousal background bed (15% default) that masks
//   environmental silence without competing with C-Major reward chimes.
// - Smoothly ducks during Big Wins, Free Spins, or Bonus Celebrations so
//   dopamine reward cues remain crystal-clear and never clash with the music.
// - Dynamically adapts subtle flow momentum during consecutive spin chains.
// ============================================================================

export const AMBIENT_PLAYLIST = [
  {
    id: 'track1',
    title: 'Enchanted Pulse',
    subtitle: 'Hypnotic Flow • Ambient Solfeggio',
    src: '/assets/audio/track1_enchanted_pulse.mp3',
  },
  {
    id: 'track2',
    title: 'Enchanted Pulse (Deep)',
    subtitle: 'Transcendental Focus • Extended Suite',
    src: '/assets/audio/track2_enchanted_pulse_extended.mp3',
  },
  {
    id: 'track3',
    title: 'Jagged High Pressure',
    subtitle: 'Kinetic Drive • VIP Atmosphere',
    src: '/assets/audio/track3_jagged_high_pressure.mp3',
  },
];

class AmbientMusicEngine {
  constructor() {
    this.playlist = AMBIENT_PLAYLIST;
    this.currentTrackIdx = 0;
    this.audio = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.isDucked = false;
    this.fadeTimer = null;
    this.flowBoost = 0;

    // Default calm background volume (15% for optimal flow state mixing)
    this.userVolume = 0.15;
    this.duckVolume = 0.035;
    this.hasUserInteracted = false;
    this.wasPlayingBeforeHidden = false;

    if (typeof window !== 'undefined') {
      try {
        const savedVol = localStorage.getItem('dc_casino_music_volume');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.userVolume = parsed;
          }
        }
      } catch (_) {}

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            if (this.audio && !this.audio.paused) {
              this.wasPlayingBeforeHidden = true;
              this.audio.pause();
            }
          } else {
            if (this.wasPlayingBeforeHidden && !this.isMuted) {
              this.wasPlayingBeforeHidden = false;
              this.audio.play().catch(() => {});
            }
          }
        });
      }
    }
  }

  _getEffectiveVolume() {
    if (this.isMuted) return 0;
    if (this.isDucked) return Math.min(this.userVolume * 0.25, this.duckVolume);
    return Math.max(0, Math.min(1, this.userVolume + this.flowBoost));
  }

  _getAudio() {
    if (!this.audio && typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.loop = false;

      // When track finishes, smoothly advance to the next track in the playlist
      this.audio.addEventListener('ended', () => {
        this.nextTrack(true);
      });

      this.audio.addEventListener('play', () => {
        this.consecutiveErrors = 0;
        this.isPlaying = true;
        this._notify();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this._notify();
      });

      this.audio.addEventListener('error', (e) => {
        this.consecutiveErrors = (this.consecutiveErrors || 0) + 1;
        if (this.consecutiveErrors >= this.playlist.length) {
          this.isPlaying = false;
          this._notify();
          return;
        }
        console.warn('Ambient music load error, skipping to next track:', e);
        this.nextTrack(true);
      });
    }
    return this.audio;
  }

  initAutoStart() {
    if (this.hasUserInteracted) return;
    this.hasUserInteracted = true;
    const startAudio = () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
      this.play();
    };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
  }

  getCurrentTrack() {
    return this.playlist[this.currentTrackIdx] || this.playlist[0];
  }

  play() {
    const audio = this._getAudio();
    if (!audio) return;

    const track = this.getCurrentTrack();
    if (!audio.src || !audio.src.includes(track.src)) {
      audio.src = track.src;
    }

    audio.volume = this._getEffectiveVolume();

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
          this._notify();
        })
        .catch(() => {
          // Autoplay blocked by browser policy until user interacts
          this.isPlaying = false;
          this._notify();
        });
    }
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
      this._notify();
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  nextTrack(autoPlay = true) {
    this.currentTrackIdx = (this.currentTrackIdx + 1) % this.playlist.length;
    if (this.audio) {
      this.audio.src = this.getCurrentTrack().src;
      if (autoPlay || this.isPlaying) {
        this.play();
      } else {
        this._notify();
      }
    }
  }

  prevTrack(autoPlay = true) {
    this.currentTrackIdx =
      (this.currentTrackIdx - 1 + this.playlist.length) % this.playlist.length;
    if (this.audio) {
      this.audio.src = this.getCurrentTrack().src;
      if (autoPlay || this.isPlaying) {
        this.play();
      } else {
        this._notify();
      }
    }
  }

  setVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.userVolume = clamped;
    try {
      localStorage.setItem('dc_casino_music_volume', String(clamped));
    } catch (_) {}

    if (this.audio && !this.isMuted && !this.isDucked) {
      this.audio.volume = this._getEffectiveVolume();
    }
    this._notify();
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.audio) {
      this.audio.volume = this._getEffectiveVolume();
    }
    this._notify();
  }

  /**
   * Subtle Flow-State Momentum Modulation:
   * Gently warms the ambient bed (+1.5% to +3%) when the player enters a continuous
   * spin rhythm ("The Machine Zone") and eases back when idle.
   */
  setFlowMomentum(streak = 1) {
    const clampedStreak = Math.max(0, Math.min(10, streak));
    this.flowBoost = clampedStreak >= 3 ? Math.min(0.03, (clampedStreak - 2) * 0.005) : 0;
    if (this.audio && !this.isMuted && !this.isDucked && !this.fadeTimer) {
      this.audio.volume = this._getEffectiveVolume();
    }
  }

  /**
   * Auto-ducking: Gently drops ambient music during Big Wins, Free Spins,
   * or Bonus Game celebrations so C-Major reward chimes remain front-and-center.
   */
  duck(isDucked) {
    this.isDucked = isDucked;
    if (!this.audio || this.isMuted) return;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startVol = this.audio.volume;
    const targetVol = this._getEffectiveVolume();
    const steps = 14;
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      const current = startVol + (targetVol - startVol) * (step / steps);
      if (this.audio) {
        this.audio.volume = Math.max(0, Math.min(1, current));
      }
      if (step >= steps) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (this.audio) {
          this.audio.volume = Math.max(0, Math.min(1, targetVol));
        }
      }
    }, isDucked ? 20 : 65);
  }

  _notify() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dc-ambient-music-state', {
          detail: {
            isPlaying: this.isPlaying,
            isMuted: this.isMuted,
            currentTrack: this.getCurrentTrack(),
            volume: this.userVolume,
            trackIndex: this.currentTrackIdx,
          },
        })
      );
    }
  }

  onStateChange(cb) {
    const handler = (e) => cb(e.detail);
    if (typeof window !== 'undefined') {
      window.addEventListener('dc-ambient-music-state', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('dc-ambient-music-state', handler);
      }
    };
  }
}

export const ambientMusicEngine = new AmbientMusicEngine();
