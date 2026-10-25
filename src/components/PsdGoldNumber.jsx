import React from 'react';
import { PSD_DIGIT_SPRITES } from '../config/slotConfig';

/**
 * Renders numbers using the 3D engraved gold number sprites (layers 395-418)
 * extracted directly from crowns_of_kemet_merged.psd.
 */
export default function PsdGoldNumber({ value, height = 64, gap = -4, className = '' }) {
  const formatted = typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
  const chars = formatted.split('');

  return (
    <div
      className={`psd-gold-number ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        userSelect: 'none',
        filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.7))',
      }}
    >
      {chars.map((ch, idx) => {
        const sprite = PSD_DIGIT_SPRITES[ch];
        if (!sprite) {
          return (
            <span
              key={idx}
              style={{
                fontFamily: "'Amarante', 'Cinzel Decorative', serif",
                fontSize: `${height * 0.85}px`,
                fontWeight: 900,
                background: 'linear-gradient(180deg, #fff6b7 0%, #f59e0b 55%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: '0 2px',
              }}
            >
              {ch}
            </span>
          );
        }
        const isPunctuation = ch === '.' || ch === ',';
        return (
          <img
            key={idx}
            src={sprite}
            alt={ch}
            draggable={false}
            style={{
              height: isPunctuation ? `${height * 0.44}px` : `${height}px`,
              width: 'auto',
              marginLeft: idx === 0 ? 0 : `${gap}px`,
              alignSelf: isPunctuation ? 'flex-end' : 'center',
              marginBottom: isPunctuation && ch === ',' ? `${-height * 0.08}px` : 0,
            }}
          />
        );
      })}
    </div>
  );
}
