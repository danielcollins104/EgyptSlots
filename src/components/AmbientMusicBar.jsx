import React, { useState, useEffect } from 'react';
import { Music, Play, Pause, SkipForward, Volume2, VolumeX, Disc } from 'lucide-react';
import { ambientMusicEngine, AMBIENT_PLAYLIST } from '../audio/ambientMusicEngine';

export default function AmbientMusicBar({ className = '' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(() => ambientMusicEngine.getCurrentTrack());
  const [volume, setVolume] = useState(() => ambientMusicEngine.userVolume);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    const unsub = ambientMusicEngine.onStateChange((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.currentTrack);
      setVolume(state.volume);
    });
    return unsub;
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    ambientMusicEngine.togglePlay();
  };

  const handleNext = (e) => {
    e.stopPropagation();
    ambientMusicEngine.nextTrack(true);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    ambientMusicEngine.setVolume(newVol);
  };

  return (
    <div className={`ambient-music-widget ${className}`}>
      <button
        className={`ambient-music-pill ${isPlaying ? 'playing' : 'paused'}`}
        onClick={handleToggle}
        title={isPlaying ? 'Pause Ambient Flow Music' : 'Play Ambient Flow Music'}
        aria-label="Ambient Flow Music"
      >
        <Disc size={13} className={`music-disc-icon ${isPlaying ? 'spinning' : ''}`} />
        <span className="music-pill-label">
          {isPlaying ? currentTrack.title : 'FLOW MUSIC: OFF'}
        </span>
      </button>

      <button
        className="ambient-skip-btn"
        onClick={handleNext}
        title="Next Ambient Soundtrack"
        aria-label="Next Soundtrack"
      >
        <SkipForward size={12} />
      </button>

      <div
        className="ambient-vol-trigger"
        onMouseEnter={() => setShowSlider(true)}
        onMouseLeave={() => setShowSlider(false)}
      >
        <button
          className="ambient-vol-btn"
          onClick={() => setShowSlider(!showSlider)}
          title={`Music Volume: ${Math.round(volume * 100)}%`}
        >
          {volume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>

        {showSlider && (
          <div className="ambient-vol-popover">
            <span className="vol-popover-title">FLOW MUSIC VOLUME</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.02"
              value={volume}
              onChange={handleVolumeChange}
              className="ambient-vol-slider"
            />
            <span className="vol-popover-val">{Math.round(volume * 100)}% (Quiet Mix)</span>
          </div>
        )}
      </div>
    </div>
  );
}
