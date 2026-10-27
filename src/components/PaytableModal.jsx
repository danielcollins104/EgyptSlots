import React, { useState } from 'react';
import { X, Trophy, Grid, Layers } from 'lucide-react';
import { SYMBOLS, PAYLINES, CASINO_BRAND, THEME_COPY } from '../config/slotConfig';
import PsdGoldNumber from './PsdGoldNumber';
import NeonKeyedImage from './NeonKeyedImage';
import DcLogoPlaque from './DcLogoPlaque';

export default function PaytableModal({ isOpen, onClose, level = 1 }) {
  const [tab, setTab] = useState('symbols');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <div>
            <div className="paytable-casino-tag">
              {CASINO_BRAND.casinoFullTitle} • BY {CASINO_BRAND.creatorName.toUpperCase()}
            </div>
            <h2 className="paytable-title">{THEME_COPY.paytableHeading}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="paytable-tabs">
          <button
            className={`paytable-tab ${tab === 'symbols' ? 'active' : ''}`}
            onClick={() => setTab('symbols')}
          >
            <Trophy size={16} /> Symbol Payouts (Level {level})
          </button>
          <button
            className={`paytable-tab ${tab === 'paylines' ? 'active' : ''}`}
            onClick={() => setTab('paylines')}
          >
            <Grid size={16} /> {CASINO_BRAND.baseLines} Laser Paylines
          </button>
          <button
            className={`paytable-tab ${tab === 'psd' ? 'active' : ''}`}
            onClick={() => setTab('psd')}
          >
            <Layers size={16} /> Theme &amp; Engine Assets
          </button>
        </div>

        <div className="paytable-body">
          {tab === 'symbols' && (
            <div className="paytable-symbols-grid">
              {SYMBOLS.map((sym) => (
                <div key={sym.id} className={`paytable-card tier-${sym.tier}`}>
                  <div className="paytable-symbol-preview">
                    {sym.is3DRoyal ? (
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 14,
                          border: '3px solid #f59e0b',
                          background: `radial-gradient(circle at 40% 35%, ${sym.tileBgStart}, ${sym.tileBgEnd})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow:
                            'inset 0 0 10px rgba(0,0,0,0.8), 0 6px 14px rgba(0,0,0,0.7)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'Cinzel Decorative', 'Amarante', serif",
                            fontSize: '3.1rem',
                            fontWeight: 900,
                            color: sym.gemPrimary,
                            WebkitTextStroke: '2.5px #fde047',
                            transform: `rotate(${sym.tiltDeg}deg) scale(1.18)`,
                            textShadow: '3px 6px 8px rgba(0,0,0,0.9)',
                          }}
                        >
                          {sym.letter}
                        </span>
                      </div>
                    ) : sym.isGeneratedNeon ? (
                      <NeonKeyedImage
                        src={sym.image}
                        alt={sym.name}
                        className="paytable-sym-img"
                        threshold={28}
                        feather={40}
                      />
                    ) : (
                      <img
                        src={sym.image}
                        alt={sym.name}
                        className="paytable-sym-img"
                        style={sym.neonFilter ? { filter: sym.neonFilter } : undefined}
                      />
                    )}
                  </div>
                  <div className="paytable-symbol-info">
                    <div className="paytable-sym-name" style={{ color: sym.accentColor }}>
                      {sym.name}
                    </div>
                    <p className="paytable-sym-desc">{sym.description}</p>
                    <div className="paytable-Multipliers">
                      <div>
                        <span>5×</span>
                        <strong>{sym.payouts[5] * level} Coins</strong>
                      </div>
                      <div>
                        <span>4×</span>
                        <strong>{sym.payouts[4] * level} Coins</strong>
                      </div>
                      <div>
                        <span>3×</span>
                        <strong>{sym.payouts[3] * level} Coins</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'paylines' && (
            <div className="paylines-grid">
              {PAYLINES.map((line) => (
                <div key={line.id} className="payline-card">
                  <div className="payline-card-head">
                    <span
                      className="payline-badge"
                      style={{ backgroundColor: line.color }}
                    >
                      Line #{line.id}
                    </span>
                    <span className="payline-name">{line.name}</span>
                  </div>
                  <div className="payline-mini-grid">
                    {[0, 1, 2].map((r) =>
                      [0, 1, 2, 3, 4].map((c) => {
                        const active = line.rows[c] === r;
                        return (
                          <div
                            key={`${r}-${c}`}
                            className={`payline-cell ${active ? 'active' : ''}`}
                            style={
                              active
                                ? {
                                    backgroundColor: line.color,
                                    boxShadow: `0 0 10px ${line.color}`,
                                  }
                                : undefined
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'psd' && (
            <div className="psd-showcase-section">
              <p className="psd-showcase-intro">{THEME_COPY.paytableAssetIntro}</p>
              <div className="psd-sample-row">
                <div className="psd-sample-box">
                  <h4>{CASINO_BRAND.casinoName} Crest Logo</h4>
                  <DcLogoPlaque className="paytable-dc-logo-preview" />
                </div>
                <div className="psd-sample-box">
                  <h4>3D Engraved Gold Numbers</h4>
                  <div className="neon-psd-digits">
                    <PsdGoldNumber value="0123456789.," height={48} gap={0} />
                  </div>
                </div>
                <div className="psd-sample-box">
                  <h4>Bottom Cabinet Controls</h4>
                  <div className="psd-controls-mini neon-ui-filter">
                    <img src="/assets/psd/btn_autoplay.png" alt="Autoplay" height={44} />
                    <img src="/assets/psd/btn_spin_base.png" alt="Spin" height={58} />
                    <img src="/assets/psd/btn_max_bet.png" alt="Max Bet" height={44} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
