import React from 'react';

/**
 * 2026 Cabinet Glass & Edge Light Overlay:
 * - Curved OLED display specular glass glare & chandelier reflection
 * - Addressable LED perimeter chase lighting around the reel cabinet
 * - 4x Precision 24K Gold Egyptian Filigree Corner Brackets (Scarab & Lotus)
 */
export default function CabinetGlassOverlay({ isSpinning = false, hasWin = false }) {
  return (
    <div className={`cabinet-glass-overlay ${isSpinning ? 'spinning' : ''} ${hasWin ? 'winning' : ''}`} pointer-events="none">
      {/* 1. Curved OLED Glass Glare & Chandelier Reflex */}
      <div className="cabinet-glass-glare" />

      {/* 2. Dynamic Addressable LED Perimeter Light Pipe */}
      <div className="cabinet-led-perimeter">
        <div className="led-segment led-top" />
        <div className="led-segment led-right" />
        <div className="led-segment led-bottom" />
        <div className="led-segment led-left" />
      </div>

      {/* 3. 24K Gold Micro-Filigree Corner Brackets */}
      <div className="cabinet-corner-bracket top-left">
        <svg viewBox="0 0 40 40" className="bracket-svg">
          <path d="M 4 36 L 4 12 Q 4 4 12 4 L 36 4" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <path d="M 9 32 L 9 15 Q 9 9 15 9 L 32 9" fill="none" stroke="#fef08a" strokeWidth="1" />
          <circle cx="12" cy="12" r="3" fill="#38bdf8" stroke="#fbbf24" strokeWidth="1" />
          <path d="M 4 20 L 12 12 L 20 4" fill="none" stroke="#d97706" strokeWidth="1" />
        </svg>
      </div>

      <div className="cabinet-corner-bracket top-right">
        <svg viewBox="0 0 40 40" className="bracket-svg">
          <path d="M 36 36 L 36 12 Q 36 4 28 4 L 4 4" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <path d="M 31 32 L 31 15 Q 31 9 25 9 L 8 9" fill="none" stroke="#fef08a" strokeWidth="1" />
          <circle cx="28" cy="12" r="3" fill="#38bdf8" stroke="#fbbf24" strokeWidth="1" />
          <path d="M 36 20 L 28 12 L 20 4" fill="none" stroke="#d97706" strokeWidth="1" />
        </svg>
      </div>

      <div className="cabinet-corner-bracket bottom-left">
        <svg viewBox="0 0 40 40" className="bracket-svg">
          <path d="M 4 4 L 4 28 Q 4 36 12 36 L 36 36" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <path d="M 9 8 L 9 25 Q 9 31 15 31 L 32 31" fill="none" stroke="#fef08a" strokeWidth="1" />
          <circle cx="12" cy="28" r="3" fill="#38bdf8" stroke="#fbbf24" strokeWidth="1" />
          <path d="M 4 20 L 12 28 L 20 36" fill="none" stroke="#d97706" strokeWidth="1" />
        </svg>
      </div>

      <div className="cabinet-corner-bracket bottom-right">
        <svg viewBox="0 0 40 40" className="bracket-svg">
          <path d="M 36 4 L 36 28 Q 36 36 28 36 L 4 36" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <path d="M 31 8 L 31 25 Q 31 31 25 31 L 8 31" fill="none" stroke="#fef08a" strokeWidth="1" />
          <circle cx="28" cy="28" r="3" fill="#38bdf8" stroke="#fbbf24" strokeWidth="1" />
          <path d="M 36 20 L 28 28 L 20 36" fill="none" stroke="#d97706" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
