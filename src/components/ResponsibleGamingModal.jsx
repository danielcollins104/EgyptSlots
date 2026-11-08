import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Clock, DollarSign, CheckCircle2, AlertTriangle, HeartHandshake } from 'lucide-react';
import { paymentService } from '../services/paymentService';
import { CASINO_BRAND } from '../config/slotConfig';

export default function ResponsibleGamingModal({
  isOpen,
  onClose,
  coins = 0,
  sweepsCoins = 0,
}) {
  const [rgState, setRgState] = useState(() => paymentService.getResponsibleGamingState());
  const [sessionMetrics, setSessionMetrics] = useState(() => paymentService.getSessionMetrics());
  const [dailyDepositInput, setDailyDepositInput] = useState('');
  const [maxBetScInput, setMaxBetScInput] = useState('');
  const [maxBetGcInput, setMaxBetGcInput] = useState('');
  const [realityCheckMinutes, setRealityCheckMinutes] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const freshRg = paymentService.getResponsibleGamingState();
      const freshMetrics = paymentService.getSessionMetrics();
      setRgState(freshRg);
      setSessionMetrics(freshMetrics);
      setDailyDepositInput(freshRg.dailyDepositLimitUsd > 0 ? String(freshRg.dailyDepositLimitUsd) : '');
      setMaxBetScInput(freshRg.maxSpinBetSC > 0 ? String(freshRg.maxSpinBetSC) : '');
      setMaxBetGcInput(freshRg.maxSpinBetGC > 0 ? String(freshRg.maxSpinBetGC) : '');
      setRealityCheckMinutes(Number(freshRg.realityCheckMinutes) || 0);
      setFeedbackMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveLimits = (e) => {
    e.preventDefault();
    const updated = paymentService.saveResponsibleGamingState({
      dailyDepositLimitUsd: Math.max(0, Number(dailyDepositInput) || 0),
      maxSpinBetSC: Math.max(0, Number(maxBetScInput) || 0),
      maxSpinBetGC: Math.max(0, Math.round(Number(maxBetGcInput) || 0)),
      realityCheckMinutes: Number(realityCheckMinutes) || 0,
    });
    paymentService.acknowledgeRealityCheck();
    setRgState(updated);
    setSessionMetrics(paymentService.getSessionMetrics());
    setFeedbackMsg(
      'Player protection limits saved! Limit reductions take effect immediately across all spins and cashier checkouts.'
    );
  };

  const handleActivateCoolOff = (hours) => {
    const updated = paymentService.activateCoolOff(hours);
    setRgState(updated);
    setFeedbackMsg(
      `Voluntary Cool-Off activated for ${hours} hours (until ${new Date(updated.coolOffUntil).toLocaleString()}). Spins and deposits are paused.`
    );
  };

  const handleClearCoolOff = () => {
    const updated = paymentService.clearCoolOffForDemo();
    setRgState(updated);
    setFeedbackMsg('Cool-Off status cleared.');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="paytable-modal rg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="paytable-header">
          <div>
            <div className="paytable-casino-tag">
              {CASINO_BRAND.casinoFullTitle} • RESPONSIBLE GAMING &amp; PLAYER PROTECTION
            </div>
            <h2 className="paytable-title">🛡️ Player Protection, Reality Check &amp; Limits</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="paytable-body rg-modal-body">
          {/* 1. Live Session Reality Check Dashboard */}
          <div className="pf-math-disclosure-card">
            <div className="pf-section-head">
              <h3>
                <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Live Session Reality Check Summary
              </h3>
              <span className="pf-audit-badge">Session Time: {sessionMetrics.elapsedMinutes}m</span>
            </div>
            <div className="pf-math-metrics-grid">
              <div className="pf-math-metric-box">
                <span>Session Spins</span>
                <strong>{sessionMetrics.totalSpins.toLocaleString()}</strong>
                <small>Duration: {sessionMetrics.elapsedMinutes} mins</small>
              </div>
              <div className="pf-math-metric-box">
                <span>Session Net SC</span>
                <strong style={{ color: sessionMetrics.netSC >= 0 ? '#4ade80' : '#f87171' }}>
                  {sessionMetrics.netSC >= 0 ? '+' : ''}
                  ${sessionMetrics.netSC.toFixed(2)} SC
                </strong>
                <small>Wagered: ${sessionMetrics.wageredSC.toFixed(2)} SC</small>
              </div>
              <div className="pf-math-metric-box">
                <span>Session Net GC</span>
                <strong style={{ color: sessionMetrics.netGC >= 0 ? '#fde047' : '#f87171' }}>
                  {sessionMetrics.netGC >= 0 ? '+' : ''}
                  {sessionMetrics.netGC.toLocaleString()} GC
                </strong>
                <small>Wagered: {sessionMetrics.wageredGC.toLocaleString()} GC</small>
              </div>
              <div className="pf-math-metric-box">
                <span>Deposits Today</span>
                <strong>${Number(rgState.depositsTodayUsd || 0).toFixed(2)} USD</strong>
                <small>
                  {rgState.dailyDepositLimitUsd > 0
                    ? `Limit: $${Number(rgState.dailyDepositLimitUsd).toFixed(2)}/day`
                    : 'No daily cap set'}
                </small>
              </div>
              <div className="pf-math-metric-box">
                <span>Current SC Balance</span>
                <strong>${Number(sweepsCoins || 0).toFixed(2)} SC</strong>
                <small>1 SC = $1.00 USD</small>
              </div>
              <div className="pf-math-metric-box">
                <span>Current GC Balance</span>
                <strong>{Number(coins || 0).toLocaleString()} GC</strong>
                <small>Social Play Balance</small>
              </div>
            </div>
          </div>

          {feedbackMsg && (
            <div className="pf-feedback-banner">
              <CheckCircle2 size={16} />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* 2. Configurable Deposit, Wager & Reality Check Controls */}
          <form onSubmit={handleSaveLimits} className="pf-seed-manager-card">
            <div className="pf-section-head">
              <h3>
                <DollarSign size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Personal Deposit, Wager &amp; Session Reminder Limits
              </h3>
              <span className="pf-audit-badge">Enforced Automatically</span>
            </div>
            <p className="pf-section-desc">
              Configure your daily purchase ceiling, maximum single-spin wager, and Reality Check timer. Setting a field to <code>0</code> or blank disables that limit.
            </p>

            <div className="rg-limits-grid">
              <div className="pf-seed-field">
                <label>Daily Purchase / Deposit Limit ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={dailyDepositInput}
                  onChange={(e) => setDailyDepositInput(e.target.value)}
                  className="pf-seed-input"
                  placeholder="No limit (e.g. 100)"
                />
              </div>

              <div className="pf-seed-field">
                <label>Max Single-Spin Wager ($ SC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={maxBetScInput}
                  onChange={(e) => setMaxBetScInput(e.target.value)}
                  className="pf-seed-input"
                  placeholder="No limit (e.g. 5.00)"
                />
              </div>

              <div className="pf-seed-field">
                <label>Max Single-Spin Wager (Gold Coins GC)</label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={maxBetGcInput}
                  onChange={(e) => setMaxBetGcInput(e.target.value)}
                  className="pf-seed-input"
                  placeholder="No limit (e.g. 150)"
                />
              </div>

              <div className="pf-seed-field">
                <label>Session Reality Check Reminder</label>
                <div className="rg-pill-row">
                  {[
                    { val: 0, label: 'Off' },
                    { val: 15, label: 'Every 15m' },
                    { val: 30, label: 'Every 30m' },
                    { val: 60, label: 'Every 60m' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      className={`sc-payout-pill ${realityCheckMinutes === opt.val ? 'active' : ''}`}
                      onClick={() => setRealityCheckMinutes(opt.val)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="pf-action-btn">
                Save Responsible Gaming Limits
              </button>
            </div>
          </form>

          {/* 3. Take a Break / Voluntary Cool-Off & Support Resources */}
          <div className="pf-verifier-card">
            <div className="pf-section-head">
              <h3>
                <ShieldAlert size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Take a Break (Voluntary Cool-Off) &amp; 24/7 Support
              </h3>
              <span className="pf-audit-badge">
                {rgState.isCoolingOff ? `Active (${rgState.coolOffRemainingMinutes}m left)` : 'Account Active'}
              </span>
            </div>
            <p className="pf-section-desc">
              Need a timeout? Activating a voluntary Cool-Off immediately pauses all spins and package purchases while keeping your prize redemption access open.
            </p>
            <div className="rg-pill-row" style={{ marginBottom: 14 }}>
              <button type="button" className="pf-action-btn secondary" onClick={() => handleActivateCoolOff(24)}>
                ⏸️ 24-Hour Cool-Off
              </button>
              <button type="button" className="pf-action-btn secondary" onClick={() => handleActivateCoolOff(72)}>
                ⏸️ 3-Day Cool-Off
              </button>
              <button type="button" className="pf-action-btn secondary" onClick={() => handleActivateCoolOff(168)}>
                ⏸️ 7-Day Cool-Off
              </button>
              {rgState.isCoolingOff && (
                <button type="button" className="pf-verify-btn" onClick={handleClearCoolOff}>
                  Resume Play
                </button>
              )}
            </div>

            <div className="rg-support-footer">
              <HeartHandshake size={18} />
              <div>
                <strong>21+ Only • Play Responsibly • No Purchase Necessary</strong>
                <div>
                  If you or someone you know needs support with gaming habits, free confidential help is available 24/7 at{' '}
                  <strong>1-800-GAMBLER</strong> or <strong>ncpgambling.org</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
