import React, { useState, useEffect } from 'react';
import { X, Trophy, Grid, Layers, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SYMBOLS, PAYLINES, CASINO_BRAND, THEME_COPY, getSymbols } from '../config/slotConfig';
import { paymentService } from '../services/paymentService';
import { getReelHeights } from '../engine/math/ReelStripModel';
import PsdGoldNumber from './PsdGoldNumber';
import NeonKeyedImage from './NeonKeyedImage';
import DcLogoPlaque from './DcLogoPlaque';

export default function PaytableModal({ isOpen, onClose, level = 1, currencyMode = 'GC', initialTab = 'symbols' }) {
  const [tab, setTab] = useState(initialTab);
  const [pfState, setPfState] = useState(() => paymentService.getProvablyFairState());
  const [clientSeedInput, setClientSeedInput] = useState(() => paymentService.getProvablyFairState().clientSeed);
  const [spinReceipts, setSpinReceipts] = useState(() => paymentService.getSpinReceipts());
  const [verifiedMap, setVerifiedMap] = useState({});
  const [seedFeedback, setSeedFeedback] = useState('');
  const activeSymbols = getSymbols(currencyMode);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab || 'symbols');
      const freshPf = paymentService.getProvablyFairState();
      setPfState(freshPf);
      setClientSeedInput(freshPf.clientSeed);
      setSpinReceipts(paymentService.getSpinReceipts());
      setSeedFeedback('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSaveClientSeed = () => {
    const updated = paymentService.setClientSeed(clientSeedInput);
    setPfState(updated);
    setClientSeedInput(updated.clientSeed);
    setSeedFeedback('Client seed updated! All subsequent spins will use your custom entropy seed.');
  };

  const handleRotateServerSeed = async () => {
    const rotated = await paymentService.rotateProvablyFairSeed(clientSeedInput);
    setPfState(rotated);
    setSpinReceipts(paymentService.getSpinReceipts());
    setSeedFeedback(
      `Server seed rotated! Previous Server Seed revealed (${String(rotated?.revealedServerSeed || '').slice(0, 16)}…) matching SHA-256 commitment ${String(rotated?.revealedServerSeedHash || '').slice(0, 16)}…`
    );
  };

  const handleVerifyReceipt = (receipt) => {
    const heights = getReelHeights();
    const res = paymentService.verifySpinReceipt(receipt, heights);
    setVerifiedMap((prev) => ({ ...prev, [receipt.id]: res }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <div>
            <div className="paytable-casino-tag">
              {CASINO_BRAND.casinoFullTitle} • BY {String(CASINO_BRAND?.creatorName || 'DC Enterprises').toUpperCase()}
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
          <button
            className={`paytable-tab ${tab === 'fairness' ? 'active' : ''}`}
            onClick={() => setTab('fairness')}
          >
            <ShieldCheck size={16} /> RTP, Math &amp; Provably Fair
          </button>
        </div>

        <div className="paytable-body">
          {tab === 'symbols' && (
            <div className="paytable-symbols-grid">
              {activeSymbols.map((sym) => (
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

          {tab === 'fairness' && (
            <div className="pf-fairness-section">
              {/* 1. Certified Mathematical & RTP Disclosure */}
              <div className="pf-math-disclosure-card">
                <div className="pf-section-head">
                  <h3>📊 Certified Slot Mathematics &amp; RTP Disclosure</h3>
                  <span className="pf-audit-badge">10M-Spin Monte Carlo Verified</span>
                </div>
                <p className="pf-section-desc">
                  All outcomes on <strong>{CASINO_BRAND.gameTitle}</strong> are governed by physical 60-stop weighted virtual reel strips (5×3 grid, up to 15 paylines) using cryptographic <strong>HMAC-SHA256</strong> entropy. Gold Coins (GC) and Sweeps Coins (SC) use the exact same mathematical reel weights.
                </p>
                <div className="pf-math-metrics-grid">
                  <div className="pf-math-metric-box">
                    <span>Realized Theoretical RTP</span>
                    <strong>90.00%</strong>
                    <small>Base Game + 3× Free Spins</small>
                  </div>
                  <div className="pf-math-metric-box">
                    <span>Overall Hit Frequency</span>
                    <strong>26.04%</strong>
                    <small>~1 in 3.84 Spins Wins</small>
                  </div>
                  <div className="pf-math-metric-box">
                    <span>Volatility Index</span>
                    <strong>Medium-High</strong>
                    <small>Max Line Exposure: 2,500×</small>
                  </div>
                  <div className="pf-math-metric-box">
                    <span>Scatter Bonus Trigger</span>
                    <strong>1 in 195</strong>
                    <small>3+ Lotus Scatters (10–25 FS @ 3×)</small>
                  </div>
                  <div className="pf-math-metric-box">
                    <span>SC Rollover Requirement</span>
                    <strong>1× Playthrough</strong>
                    <small>1 SC = $1.00 USD (+5% Gift Card)</small>
                  </div>
                  <div className="pf-math-metric-box">
                    <span>Ethical Win Classification</span>
                    <strong>Non-Deceptive LDW</strong>
                    <small>Sub-bet returns muted &amp; labeled</small>
                  </div>
                </div>
              </div>

              {/* 2. Provably Fair Seed Commitment & Client Seed Customization */}
              <div className="pf-seed-manager-card">
                <div className="pf-section-head">
                  <h3>🔐 Provably Fair Cryptographic Commitment (HMAC-SHA256)</h3>
                  <span className="pf-audit-badge">Nonce #{pfState.nonce}</span>
                </div>
                <p className="pf-section-desc">
                  Before every spin, the server commits to a SHA-256 hash of the active <strong>Server Seed</strong>. Combined with your customizable <strong>Client Seed</strong> and incrementing <strong>Nonce</strong>, each reel stop is deterministically derived via <code>HMAC_SHA256(serverSeed, &quot;clientSeed:nonce:reelIndex&quot;)</code>.
                </p>

                {seedFeedback && (
                  <div className="pf-feedback-banner">
                    <CheckCircle2 size={16} />
                    <span>{seedFeedback}</span>
                  </div>
                )}

                <div className="pf-seed-fields-grid">
                  <div className="pf-seed-field">
                    <label>Active Server Seed SHA-256 Commitment Hash</label>
                    <input type="text" readOnly value={pfState.serverSeedHash} className="pf-seed-input readonly" />
                  </div>
                  <div className="pf-seed-field">
                    <label>Your Custom Client Seed (Editable Anytime)</label>
                    <div className="pf-seed-input-row">
                      <input
                        type="text"
                        value={clientSeedInput}
                        onChange={(e) => setClientSeedInput(e.target.value)}
                        className="pf-seed-input"
                        placeholder="Enter custom client seed..."
                      />
                      <button type="button" className="pf-action-btn" onClick={handleSaveClientSeed}>
                        Save Seed
                      </button>
                      <button type="button" className="pf-action-btn secondary" onClick={handleRotateServerSeed}>
                        <RefreshCw size={14} /> Rotate &amp; Reveal Seed
                      </button>
                    </div>
                  </div>
                </div>

                {pfState.previousServerSeed && (
                  <div className="pf-revealed-seed-box">
                    <div>
                      <strong>Previously Revealed Server Seed (Unblinded):</strong>{' '}
                      <code>{pfState.previousServerSeed}</code>
                    </div>
                    <div>
                      <strong>Matching SHA-256 Commitment Hash:</strong>{' '}
                      <code>{pfState.previousServerSeedHash}</code>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Interactive Spin Outcome Verifier */}
              <div className="pf-verifier-card">
                <div className="pf-section-head">
                  <h3>✅ Interactive Spin Outcome Verifier</h3>
                  <span className="pf-audit-badge">{spinReceipts.length} Recorded Spins</span>
                </div>
                {spinReceipts.length === 0 ? (
                  <p className="pf-section-desc">
                    Spin the reels once to generate your first signed cryptographic receipt, then click <strong>Verify HMAC-SHA256</strong> here to independently recompute the 5 physical reel stops.
                  </p>
                ) : (
                  <div className="pf-receipts-list">
                    {spinReceipts.slice(0, 10).map((r) => {
                      const vResult = verifiedMap[r.id];
                      return (
                        <div key={r.id} className="pf-receipt-item">
                          <div className="pf-receipt-main">
                            <div>
                              <strong>
                                Spin #{r.nonce} ({r.currencyMode === 'SC' ? `$${Number(r.betAmount).toFixed(2)} SC` : `${Number(r.betAmount).toLocaleString()} GC`})
                              </strong>
                              <div className="pf-receipt-meta">
                                Stops: <code>[{(r.stops || []).join(', ')}]</code> • Client Seed: <code>{r.clientSeed}</code> • Commit:{' '}
                                <code>{String(r.serverSeedHash || '').slice(0, 14)}…</code>
                              </div>
                            </div>
                            <div className="pf-receipt-actions">
                              <span className="pf-receipt-win">
                                {r.winAmount > 0
                                  ? r.currencyMode === 'SC'
                                    ? `+$${Number(r.winAmount).toFixed(2)} SC`
                                    : `+${Number(r.winAmount).toLocaleString()} GC`
                                  : '0 Win'}
                              </span>
                              <button
                                type="button"
                                className="pf-verify-btn"
                                onClick={() => handleVerifyReceipt(r)}
                              >
                                Verify HMAC-SHA256
                              </button>
                            </div>
                          </div>
                          {vResult && (
                            <div className={`pf-verify-result ${vResult.verified ? 'valid' : 'invalid'}`}>
                              <div>
                                <strong>
                                  {vResult.verified
                                    ? '✅ 100% CRYPTOGRAPHIC MATCH VERIFIED'
                                    : '⚠️ Verification Mismatch'}
                                </strong>
                              </div>
                              <div>
                                Recomputed Reel Stops: <code>[{vResult.recomputedStops?.join(', ')}]</code> === Recorded Stops:{' '}
                                <code>[{vResult.recordedStops?.join(', ')}]</code>
                              </div>
                              <div>
                                SHA-256(ServerSeed): <code>{vResult.computedHash}</code>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
