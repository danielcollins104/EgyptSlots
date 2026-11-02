import React, { useEffect, useState } from 'react';
import { Zap, Flame, Sparkles } from 'lucide-react';

/**
 * 2026 Major Illumination Effect:
 * Triggers when fully powered-up Guardians shoot divine lightning & fire
 * at the combination that triggered the powerup, causing a blinding, radiant
 * celestial flash, shockwave rings, and incandescent illumination.
 */
export default function MajorIlluminationEffect({
  active = false,
  targetCells = [],
  onIlluminationPeak,
}) {
  const [phase, setPhase] = useState('idle'); // idle | flash | radiant | fade

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      return;
    }

    setPhase('flash');

    // Peak illumination at 450ms
    const peakTimer = setTimeout(() => {
      setPhase('radiant');
      onIlluminationPeak?.();
    }, 450);

    // Fade out phase
    const fadeTimer = setTimeout(() => {
      setPhase('fade');
    }, 1400);

    return () => {
      clearTimeout(peakTimer);
      clearTimeout(fadeTimer);
    };
  }, [active, onIlluminationPeak]);

  if (!active && phase === 'idle') return null;

  return (
    <div
      className={`major-illumination-overlay phase-${phase}`}
      aria-hidden="true"
    >
      {/* Blinding Screen-Wide White & Golden Flash */}
      <div className="illumination-core-flash" />

      {/* Rotating 360-Degree Radial Sunburst & Plasma Rays */}
      <div className="illumination-rays-wrap">
        <div className="illumination-solar-rays" />
        <div className="illumination-plasma-arcs" />
      </div>

      {/* Concentric Expanding Shockwave Rings */}
      <div className="illumination-shockwave-ring ring-primary" />
      <div className="illumination-shockwave-ring ring-secondary" />
      <div className="illumination-shockwave-ring ring-tertiary" />

      {/* Radiant Floating Celestial Energy Particles */}
      <div className="illumination-energy-sparks">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="illumination-spark"
            style={{
              '--spark-idx': i,
              '--spark-angle': `${(i * 360) / 16}deg`,
              '--spark-dist': `${60 + (i % 4) * 45}px`,
              '--spark-delay': `${(i % 5) * 60}ms`,
            }}
          />
        ))}
      </div>

      {/* Target Combination Incandescent Aura Overlay */}
      {targetCells.length > 0 && (
        <div className="illumination-targeted-cells-glow">
          <div className="illumination-combo-badge">
            <Zap size={14} className="badge-zap" />
            <Flame size={14} className="badge-flame" />
            <span>DIVINE COMBINATION ILLUMINATED</span>
            <Sparkles size={14} className="badge-sparkles" />
          </div>
        </div>
      )}
    </div>
  );
}
