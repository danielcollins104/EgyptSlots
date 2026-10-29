// ============================================================================
// AMBIENT BACKGROUND MUSIC & FLOW CONSCIOUSNESS ENGINE
// ============================================================================
// Plays user-owned soundtrack quietly in the background without disturbing
// mechanical reel ticks, win fanfares, or payout chimes.
// Features auto-ducking during big wins/bonuses and seamless looping for flow state.
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

    // Default quiet background volume (18% by default for flow state mixing)
    this.userVolume = 0.18;
    this.duckVolume = 0.04;
    this.hasUserInteracted = false;

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
    }
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
        this.isPlaying = true;
        this._notify();
      });

      this.audio.addEventListener('pause', () => {
        this.isPlaying = false;
        this._notify();
      });

      this.audio.addEventListener('error', (e) => {
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

    const targetVol = this.isMuted ? 0 : this.isDucked ? this.duckVolume : this.userVolume;
    audio.volume = Math.max(0, Math.min(1, targetVol));

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
          this._notify();
        })
        .catch((err) => {
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
      this.audio.volume = clamped;
    }
    this._notify();
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.audio) {
      const target = muted ? 0 : this.isDucked ? this.duckVolume : this.userVolume;
      this.audio.volume = target;
    }
    this._notify();
  }

  /**
   * Auto-ducking: Gently drops ambient music during Big Wins, Free Spins,
   * or Bonus Game celebrations so game mechanics remain front-and-center.
   */
  duck(isDucked) {
    this.isDucked = isDucked;
    if (!this.audio || this.isMuted) return;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startVol = this.audio.volume;
    const targetVol = isDucked ? this.duckVolume : this.userVolume;
    const steps = 12;
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
    }, isDucked ? 25 : 80);
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
