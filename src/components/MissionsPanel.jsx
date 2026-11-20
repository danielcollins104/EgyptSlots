import React from 'react';
import { MISSIONS_CONFIG } from '../retention/missions.js';

const GOLD = '#ffd24a';
const EMERALD = '#10b981';
const PANEL_BG = 'rgba(14,10,28,0.96)';

/**
 * MissionsPanel — drop-in daily missions widget (inline styles, zero CSS edits).
 *   <MissionsPanel api={missionsApi} onClose={handleClose} />
 */
export default function MissionsPanel({ api, onClose = null }) {
  if (!api) return null;
  const { view, claim, claimTrio, comebackDue, dismissComeback } = api;

  const missionRow = (m) => {
    const pct = Math.round((m.progress / m.target) * 100);
    return (
      <div key={m.id} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        border: `1px solid ${m.claimed ? EMERALD : 'rgba(255,210,74,0.35)'}`,
        borderRadius: 10, marginBottom: 8, background: m.claimed ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
            {m.title} {m.claimed && <span style={{ color: EMERALD }}>✓ CLAIMED</span>}
          </div>
          <div style={{ color: '#c9bfa8', fontSize: 11, margin: '2px 0 5px' }}>{m.desc}</div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 3,
              background: m.complete ? EMERALD : GOLD,
              transition: 'width 0.35s ease',
            }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#e8ddc4', fontSize: 11, marginBottom: 4 }}>
            {m.progress}/{m.target} • +{m.reward.gc.toLocaleString()} GC{m.reward.sc ? ` +$${m.reward.sc.toFixed(2)} SC` : ''}
          </div>
          {m.complete && !m.claimed && (
            <button
              type="button"
              onClick={() => claim(m.id)}
              style={{
                background: `linear-gradient(180deg, #ffe08a, #d4a017)`, color: '#231a05',
                border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 800,
                fontSize: 12, cursor: 'pointer', letterSpacing: 0.5,
              }}
            >CLAIM</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: PANEL_BG, border: `1px solid rgba(255,210,74,0.45)`, borderRadius: 14,
      padding: '14px 14px 12px', maxWidth: 420, width: '100%', backdropFilter: 'blur(8px)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.75), 0 0 28px rgba(255,210,74,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>📜 DAILY ROYAL DECREES</div>
          <div style={{ color: '#9a8fb8', fontSize: 11, marginTop: 2 }}>
            SC left today: ${view.scRemainingToday.toFixed(2)}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Daily Missions"
            style={{
              background: 'rgba(255,255,255,0.08)', color: '#e8ddc4',
              border: '1px solid rgba(255,210,74,0.35)', borderRadius: 8,
              width: 34, height: 34, fontWeight: 800, fontSize: 15, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        )}
      </div>

      {comebackDue && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '8px 10px', marginBottom: 10, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(255,210,74,0.18), rgba(16,185,129,0.14))',
          border: '1px solid rgba(255,210,74,0.55)',
        }}>
          <div style={{ color: '#fff3c4', fontSize: 11, lineHeight: 1.35 }}>
            <strong style={{ color: GOLD }}>👑 WELCOME BACK, PHARAOH!</strong> Fresh decrees await — complete all 4 today for the Triumvirate Bonus!
          </div>
          {dismissComeback && (
            <button
              type="button"
              onClick={dismissComeback}
              style={{
                background: 'rgba(0,0,0,0.35)', color: GOLD, border: '1px solid rgba(255,210,74,0.4)',
                borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}
            >OK</button>
          )}
        </div>
      )}

      {view.list.map(missionRow)}

      {view.trioReady && (
        <button
          type="button"
          onClick={claimTrio}
          style={{
            width: '100%', marginTop: 4, padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(180deg, #34d399, #059669)', color: '#022c22',
            fontWeight: 900, fontSize: 13, letterSpacing: 0.5, cursor: 'pointer',
          }}
        >👑 CLAIM TRIUMVIRATE BONUS: +{MISSIONS_CONFIG.trioReward.gc.toLocaleString()} GC + ${MISSIONS_CONFIG.trioReward.sc.toFixed(2)} SC</button>
      )}
      {view.trioClaimed && (
        <div style={{ color: EMERALD, textAlign: 'center', fontSize: 12, fontWeight: 700, marginTop: 4 }}>
          👑 TRIUMVIRATE COMPLETE — RETURN TOMORROW FOR NEW DECREES
        </div>
      )}
    </div>
  );
}
