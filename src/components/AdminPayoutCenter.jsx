import React, { useState, useEffect } from 'react';
import {
  X,
  Crown,
  Check,
  CheckCircle2,
  ExternalLink,
  Zap,
  Lock,
  LogOut,
  ServerOff,
} from 'lucide-react';
import { paymentService } from '../services/paymentService';
import { adminAuthService } from '../services/adminAuthService';
import { soundEngine } from '../audio/soundEngine';

/**
 * AdminPayoutCenter — operator-only 1-Click Payout & Redemption Queue.
 * Hidden from the player cashier; opened via Ctrl+Shift+A or the #admin URL hash.
 *
 * Access is gated by SERVER-SIDE authentication (POST /api/admin/login):
 * the operator key never ships in the client bundle, sessions are 4-hour
 * server-issued tokens, and the panel FAILS CLOSED when the admin API is
 * unreachable. Every payout action re-validates the session server-side.
 */
const AdminPayoutCenter = ({ isOpen, onClose, onRefundSC }) => {
  const [unlocked, setUnlocked] = useState(() => adminAuthService.isAuthenticated());
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);

  // Admin 1-Click Payout Center state
  const [redemptionQueue, setRedemptionQueue] = useState(() =>
    paymentService.getRedemptionQueue()
  );
  const [adminTxInputs, setAdminTxInputs] = useState({});
  const [adminGiftCodeInputs, setAdminGiftCodeInputs] = useState({});
  const [adminStatusToast, setAdminStatusToast] = useState('');
  const [expandedAdminQrId, setExpandedAdminQrId] = useState(null);

  // Refresh queue, reset transient UI, and re-validate the server session on open
  useEffect(() => {
    if (!isOpen) return;
    setRedemptionQueue(paymentService.getRedemptionQueue());
    setAdminStatusToast('');
    setExpandedAdminQrId(null);
    setKeyInput('');
    setAuthError('');
    setServerUnreachable(false);

    let cancelled = false;
    if (adminAuthService.isAuthenticated()) {
      adminAuthService.verify().then((result) => {
        if (cancelled) return;
        if (result === 'valid') {
          setUnlocked(true);
        } else if (result === 'unreachable') {
          setUnlocked(false);
          setServerUnreachable(true);
        } else {
          setUnlocked(false);
          setAuthError('Session expired. Please sign in again.');
        }
      });
    } else {
      setUnlocked(false);
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (authBusy || !keyInput.trim()) return;
    setAuthBusy(true);
    setAuthError('');
    setServerUnreachable(false);
    try {
      await adminAuthService.login(keyInput.trim());
      setUnlocked(true);
      setKeyInput('');
      soundEngine.playWinCelebration(false);
    } catch (err) {
      const msg = err.message || 'Login failed.';
      if (msg.includes('unreachable')) setServerUnreachable(true);
      setAuthError(msg);
      setKeyInput('');
      soundEngine.playButtonClick(220);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await adminAuthService.logout();
    setUnlocked(false);
    setKeyInput('');
    setAuthError('');
    soundEngine.playButtonClick(420);
  };

  const handleAdminApprove = (rdm) => {
    const txVal =
      adminTxInputs[rdm.id] ||
      (rdm.method === 'giftcard'
        ? `GC-${rdm.giftCardBrand?.toUpperCase() || 'VISA'}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`
        : `PAID_${Date.now().toString(36).toUpperCase()}`);
    const giftCode =
      adminGiftCodeInputs[rdm.id] ||
      (rdm.method === 'giftcard'
        ? `${(rdm.giftCardBrand || 'VISA').slice(0, 4).toUpperCase()}-${Math.random()
            .toString(36)
            .substring(2, 6)
            .toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : '');

    const res = paymentService.approveRedemption(rdm.id, {
      txHashOrReceipt: txVal,
      giftCardCode: giftCode,
      operatorNote: `Fulfilled via Admin 1-Click Payout Center (${rdm.method.toUpperCase()})`,
      authToken: adminAuthService.getToken(),
    });
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      setAdminStatusToast(
        `✅ Approved & Marked Paid: ${rdm.id} ($${Number(rdm.amountUsd || 0).toFixed(2)} USD)`
      );
      soundEngine.playWinCelebration(false);
    }
  };

  const handleAdminReject = (rdm) => {
    const res = paymentService.rejectRedemption(rdm.id, {
      reason: 'Canceled / Refunded via Admin Payout Center — SC Restored to Player Balance',
      authToken: adminAuthService.getToken(),
    });
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      if (res.refundSC > 0 && onRefundSC) {
        onRefundSC(res.refundSC);
      }
      setAdminStatusToast(
        `↩️ Rejected & Refunded +${Number(res.refundSC || 0).toFixed(2)} SC for ${rdm.id}`
      );
      soundEngine.playButtonClick(420);
    }
  };

  const handleCreateSampleAdminRedemption = (sampleType = 'chime') => {
    const samplePayload =
      sampleType === 'giftcard'
        ? {
            sweepsCoins: 25,
            method: 'giftcard',
            giftCardBrand: 'visa_virtual',
            destination: 'vip.winner@oopsiwon.com',
            playerName: 'Elena R. (VIP Demo)',
          }
        : sampleType === 'crypto'
        ? {
            sweepsCoins: 100,
            method: 'crypto',
            cryptoAsset: 'USDT_SOL',
            destination: 'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
            playerName: 'Devon K. (VIP Demo)',
          }
        : {
            sweepsCoins: 50,
            method: 'chime',
            destination: '$MarcusVIP777',
            playerName: 'Marcus T. (VIP Demo)',
          };
    const res = paymentService.requestRedemption(samplePayload);
    if (res.success) {
      setRedemptionQueue(paymentService.getRedemptionQueue());
      setAdminStatusToast(`🧪 Added Sample ${sampleType.toUpperCase()} Redemption (${res.redemptionId}) to Queue!`);
      soundEngine.playButtonClick(620);
    }
  };

  return (
    <div className="sc-cashier-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sc-cashier-modal cashier-v2" onClick={(e) => e.stopPropagation()}>
        {/* Clean Header Bar */}
        <header className="sc-cashier-header sc-clean-header">
          <div className="sc-cashier-title-wrap">
            <div className="sc-cashier-logo-badge sc-admin-logo-badge">
              <Crown size={20} />
            </div>
            <div>
              <h2 className="sc-cashier-title">PAYOUT CENTER</h2>
            </div>
          </div>

          <div className="sc-cashier-header-right">
            {unlocked && (
              <>
                <div className="sc-cashier-balance-pill">
                  <span className="sc-bal-sc">
                    <Crown size={14} />
                    {redemptionQueue.filter((r) => r.status === 'processing').length} PENDING
                  </span>
                </div>
                <button
                  type="button"
                  className="sc-cashier-close-btn"
                  onClick={handleLogout}
                  title="End operator session"
                  aria-label="Log out of Payout Center"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
            <button
              type="button"
              className="sc-cashier-close-btn"
              onClick={onClose}
              aria-label="Close Payout Center"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <div className="sc-cashier-body">
          {!unlocked ? (
            /* Server-Authenticated Operator Gate */
            <div className="sc-admin-pin-gate">
              <div className="sc-admin-pin-card">
                <div className="sc-admin-pin-icon">
                  {serverUnreachable ? <ServerOff size={28} /> : <Lock size={28} />}
                </div>
                <h3>{serverUnreachable ? 'Admin Server Unreachable' : 'Operator Sign-In'}</h3>
                <p>
                  {serverUnreachable
                    ? 'The Payout Center could not reach the authentication server, so it is locked. Start the server (npm run server) or check your connection — there is no offline override.'
                    : 'This area moves real prize money. Sign in with your operator key — it is verified by the server and never stored in this app.'}
                </p>
                <form onSubmit={handleLoginSubmit}>
                  <input
                    type="password"
                    className="sc-input sc-admin-pin-input sc-admin-key-input"
                    placeholder="Operator Key"
                    autoComplete="off"
                    autoFocus
                    disabled={serverUnreachable}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                  />
                  {authError && <div className="sc-admin-pin-error">{authError}</div>}
                  <button
                    type="submit"
                    className="sc-admin-pin-submit"
                    disabled={authBusy || !keyInput.trim() || serverUnreachable}
                  >
                    {authBusy ? 'Verifying with Server…' : 'Unlock Payout Center'}
                  </button>
                </form>
                <span className="sc-admin-pin-hint">
                  Server-verified session (4-hour expiry) • 5 failed attempts = 15-min lockout •
                  Key is set via DC_ADMIN_SECRET on the server
                </span>
              </div>
            </div>
          ) : (
            <div className="sc-admin-payout-center">
              <div className="sc-admin-payout-banner">
                <div>
                  <h3 className="sc-admin-payout-title">
                    👑 Operator 1-Click Payout &amp; Redemption Center
                  </h3>
                  <p className="sc-admin-payout-desc">
                    Review player prize redemptions and fulfill them in 1 click via Cash App Deep-Link,
                    On-Chain Crypto URI/QR, or +5% Digital Gift Card Code.
                  </p>
                </div>
                <div className="sc-admin-sample-btns">
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('chime')}
                  >
                    + Test $Cashtag Payout
                  </button>
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('crypto')}
                  >
                    + Test Crypto Payout
                  </button>
                  <button
                    type="button"
                    className="sc-payout-pill"
                    onClick={() => handleCreateSampleAdminRedemption('giftcard')}
                  >
                    + Test +5% Gift Card
                  </button>
                </div>
              </div>

              {adminStatusToast && (
                <div className="sc-success-banner" style={{ marginBottom: '12px' }}>
                  <CheckCircle2 size={16} />
                  <span>{adminStatusToast}</span>
                </div>
              )}

              {redemptionQueue.length === 0 ? (
                <div className="sc-history-empty">
                  <Crown size={32} />
                  <p>No pending or historical redemptions in queue yet.</p>
                  <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                    Player redemptions submitted from the Cash Out tab appear here — or click one of
                    the &ldquo;+ Test&rdquo; buttons above to preview 1-Click Operator Fulfillment.
                  </span>
                </div>
              ) : (
                <div className="sc-admin-queue-list">
                  {redemptionQueue.map((rdm) => {
                    const isPending = rdm.status === 'processing';
                    return (
                      <div
                        key={rdm.id}
                        className={`sc-admin-queue-card status-${rdm.status || 'processing'}`}
                      >
                        <div className="sc-admin-queue-top">
                          <div>
                            <span className="sc-admin-rdm-id">{rdm.id}</span>
                            <strong className="sc-admin-rdm-type">{rdm.type}</strong>
                            <div className="sc-history-date">
                              Player: {rdm.playerName || 'VIP Player'} •{' '}
                              {new Date(rdm.timestamp).toLocaleString()} • Destination:{' '}
                              <code>{rdm.destination || rdm.destinationMasked}</code>
                            </div>
                          </div>
                          <div className="sc-admin-rdm-amounts">
                            <span className="sc-admin-usd-amt">
                              ${Number(rdm.amountUsd || 0).toFixed(2)} USD
                            </span>
                            <span className="sc-admin-sc-amt">
                              ({Math.abs(Number(rdm.amountSC || rdm.sweepsCoins || 0)).toFixed(2)} SC
                              {rdm.bonusUsd > 0 ? ` + $${Number(rdm.bonusUsd).toFixed(2)} Bonus` : ''})
                            </span>
                            <span className={`sc-admin-status-pill ${rdm.status}`}>
                              {rdm.status === 'completed'
                                ? '✅ PAID'
                                : rdm.status === 'rejected'
                                ? '↩️ REFUNDED'
                                : '⏳ PENDING 1-CLICK PAYOUT'}
                            </span>
                          </div>
                        </div>

                        {/* 1-Click Action Bar for Pending Redemptions */}
                        {isPending && (
                          <div className="sc-admin-actions-bar">
                            {rdm.cashAppPayoutLink && (
                              <a
                                href={rdm.cashAppPayoutLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="sc-admin-action-btn cashapp"
                              >
                                <ExternalLink size={14} />
                                <span>
                                  💸 1-Click Send ${Number(rdm.amountUsd).toFixed(2)} on Cash App
                                </span>
                              </a>
                            )}

                            {rdm.cryptoPayoutUri && (
                              <>
                                <a
                                  href={rdm.cryptoPayoutUri}
                                  className="sc-admin-action-btn crypto"
                                >
                                  <Zap size={14} />
                                  <span>
                                    ⚡ 1-Tap Sign {rdm.cryptoAmount} {rdm.cryptoAsset} Wallet Payout
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  className="sc-payout-pill"
                                  onClick={() =>
                                    setExpandedAdminQrId(
                                      expandedAdminQrId === rdm.id ? null : rdm.id
                                    )
                                  }
                                >
                                  {expandedAdminQrId === rdm.id ? 'Hide Wallet QR' : '📱 Scan Wallet QR'}
                                </button>
                              </>
                            )}

                            {rdm.method === 'giftcard' && (
                              <input
                                type="text"
                                className="sc-input sc-admin-inline-input"
                                placeholder="Paste Gift Card Claim Code (or leave blank to auto-issue)..."
                                value={adminGiftCodeInputs[rdm.id] || ''}
                                onChange={(e) =>
                                  setAdminGiftCodeInputs((prev) => ({
                                    ...prev,
                                    [rdm.id]: e.target.value,
                                  }))
                                }
                              />
                            )}

                            <input
                              type="text"
                              className="sc-input sc-admin-inline-input"
                              placeholder="Optional TX Hash / Cash App Receipt ID..."
                              value={adminTxInputs[rdm.id] || ''}
                              onChange={(e) =>
                                setAdminTxInputs((prev) => ({
                                  ...prev,
                                  [rdm.id]: e.target.value,
                                }))
                              }
                            />

                            <button
                              type="button"
                              className="sc-admin-action-btn approve"
                              onClick={() => handleAdminApprove(rdm)}
                            >
                              <Check size={14} />
                              <span>Mark Paid &amp; Complete</span>
                            </button>

                            <button
                              type="button"
                              className="sc-admin-action-btn reject"
                              onClick={() => handleAdminReject(rdm)}
                            >
                              <X size={14} />
                              <span>Reject &amp; Refund SC</span>
                            </button>
                          </div>
                        )}

                        {expandedAdminQrId === rdm.id && rdm.cryptoQrUrl && (
                          <div className="sc-admin-qr-drawer">
                            <img
                              src={rdm.cryptoQrUrl}
                              alt="Crypto Payout QR"
                              width={140}
                              height={140}
                            />
                            <div>
                              <strong>Scan with Phantom, MetaMask, or Bitcoin Wallet</strong>
                              <p style={{ fontSize: '0.78rem', opacity: 0.85, margin: '4px 0' }}>
                                URI: <code>{rdm.cryptoPayoutUri}</code>
                              </p>
                            </div>
                          </div>
                        )}

                        {!isPending && (
                          <div className="sc-admin-completed-meta">
                            {rdm.txHashOrReceipt && (
                              <span>
                                Receipt / TXID: <code>{rdm.txHashOrReceipt}</code>
                              </span>
                            )}
                            {rdm.giftCardCode && (
                              <span>
                                • Gift Card Code: <code>{rdm.giftCardCode}</code>
                              </span>
                            )}
                            {rdm.operatorNote && <span> • {rdm.operatorNote}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPayoutCenter;
