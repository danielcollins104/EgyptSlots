// ============================================================================
// CRYPTO PAYOUT CONSOLE — operator panel for live crypto payouts
// ============================================================================
// Reads the server-side crypto payout queue (/api/crypto/payouts) and gives the
// operator two idempotent completion paths per payout:
//   ⚡ Auto-send  — pushes through the gateway payouts API (CRYPTO_GATEWAY_PAYOUTS_ENABLED)
//   ✔ Mark Paid   — records the operator's manual on-chain tx hash as the receipt
// Duplicate clicks / retries can never double-pay: the server keys everything by payout id.
// ============================================================================
import { useCallback, useEffect, useState } from 'react';
import { cryptoGatewayService } from '../services/cryptoGatewayService.js';
import { authService } from '../services/authService.js';

const STATUS_COLORS = {
  processing: '#f6d87a',
  sending: '#7cc4ff',
  completed: '#7CFFB2',
  failed: '#ff9b9b',
};

export default function CryptoPayoutConsole({ compact = false }) {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txInputs, setTxInputs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const getToken = () => (authService.getCurrentUser() || {}).token || authService.getToken?.() || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await cryptoGatewayService.getPayoutQueue(getToken());
    if (!res.ok) {
      setError('Could not load payout queue — admin session required.');
      setPayouts([]);
    } else {
      setPayouts(res.payouts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (payout, mode) => {
    setBusyId(payout.id);
    setNotice('');
    const res = await cryptoGatewayService.processPayout(payout.id, {
      mode,
      txHash: txInputs[payout.id] || '',
      authToken: getToken(),
    });
    setBusyId(null);
    if (!res.ok) {
      setNotice(`✗ ${payout.id}: ${res.error || 'failed'}`);
      return;
    }
    if (res.alreadyCompleted) {
      setNotice(`↻ ${payout.id} was already completed — no double pay.`);
    } else {
      setNotice(`✔ ${payout.id}: ${mode === 'auto' ? 'sent via gateway' : 'marked paid'} ${res.payout?.withdrawalId ? `(withdrawal ${res.payout.withdrawalId})` : ''}`);
    }
    refresh();
  };

  const pending = payouts.filter((p) => p.status === 'processing' || p.status === 'sending');
  const done = payouts.filter((p) => p.status === 'completed');

  return (
    <div style={{
      border: '1px solid rgba(212,175,55,0.4)',
      borderRadius: 14,
      padding: 16,
      background: 'linear-gradient(160deg, rgba(26,16,60,0.85), rgba(8,6,26,0.92))',
      color: '#e9e4d8',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🪙</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f6d87a', fontWeight: 800, fontSize: 15 }}>Live Crypto Payouts</div>
          <div style={{ color: 'rgba(235,229,216,0.6)', fontSize: 11 }}>
            {pending.length} pending · {done.length} completed — auto-refresh every 20s
          </div>
        </div>
        <button type="button" onClick={refresh} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.4)', background: 'transparent', color: '#f6d87a', fontSize: 12, cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'rgba(235,229,216,0.6)' }}>Loading queue…</div>}
      {error && <div style={{ fontSize: 12, color: '#ff9b9b', marginBottom: 10 }}>{error}</div>}
      {notice && <div style={{ fontSize: 12, color: '#7CFFB2', marginBottom: 10 }}>{notice}</div>}

      {!loading && payouts.length === 0 && !error && (
        <div style={{ fontSize: 12, color: 'rgba(235,229,216,0.6)' }}>
          No crypto payout requests yet. They appear here when players request a crypto redemption.
        </div>
      )}

      {pending.map((p) => (
        <div key={p.id} style={{ border: '1px solid rgba(212,175,55,0.25)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 8 }}>
            <strong style={{ color: '#f6d87a' }}>{p.amountSC?.toFixed(2)} SC</strong>
            <span style={{ color: 'rgba(235,229,216,0.6)' }}>→</span>
            <span style={{ fontFamily: 'monospace' }}>{p.cryptoAsset}</span>
            <span style={{ fontFamily: 'monospace', color: 'rgba(235,229,216,0.75)' }}>{p.destinationMasked}</span>
            <span style={{ marginLeft: 'auto', color: STATUS_COLORS[p.status] || '#fff', fontWeight: 700 }}>{p.status}</span>
          </div>
          <div style={{ color: 'rgba(235,229,216,0.5)', fontSize: 11, marginBottom: 8 }}>
            {p.id} · {p.userId} · {new Date(p.createdAt).toLocaleString()}
          </div>
          {p.status === 'processing' && (
            <>
              <input
                type="text"
                placeholder="TX hash (manual path)"
                value={txInputs[p.id] || ''}
                onChange={(e) => setTxInputs((s) => ({ ...s, [p.id]: e.target.value }))}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(212,175,55,0.3)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#e9e4d8',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => run(p, 'auto')}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#d4af37,#f6d87a)', color: '#1a0b2e', fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: busyId === p.id ? 0.6 : 1 }}
                >
                  ⚡ Auto-send via gateway
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id || !(txInputs[p.id] || '').trim()}
                  onClick={() => run(p, 'manual')}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #7CFFB2', background: 'transparent', color: '#7CFFB2', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: busyId === p.id || !(txInputs[p.id] || '').trim() ? 0.5 : 1 }}
                >
                  ✔ Mark Paid (manual tx)
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {done.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(235,229,216,0.6)' }}>
            Completed ({done.length})
          </summary>
          {done.slice(0, 20).map((p) => (
            <div key={p.id} style={{ fontSize: 11, color: 'rgba(235,229,216,0.55)', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              ✔ {p.amountSC?.toFixed(2)} SC → {p.cryptoAsset} {p.destinationMasked}
              {p.txHashOrReceipt ? ` · ${p.txHashOrReceipt.slice(0, 18)}…` : ''}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
