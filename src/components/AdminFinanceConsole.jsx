import React, { useCallback, useEffect, useState } from 'react';
import { X, ShieldAlert, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../services/cashierApi';

/**
 * Staff finance console (role-gated server-side: SUPPORT read-only, FINANCE redemptions/KYC/crypto,
 * ADMIN adjustments/account status). The UI is a convenience only - every action is re-authorised by the API,
 * sensitive actions require a fresh password step-up, and everything lands in the immutable audit trail.
 */
const CSS = `
.ad-overlay{position:fixed;inset:0;z-index:9500;background:rgba(3,3,8,.92);display:flex;align-items:stretch;justify-content:center;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}
.ad-panel{width:min(1200px,100%);background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}
.ad-head{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #30363d}
.ad-tabs{display:flex;gap:4px;padding:8px 12px;flex-wrap:wrap;border-bottom:1px solid #30363d}
.ad-tab{min-height:48px;padding:0 14px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;cursor:pointer}
.ad-tab.on{background:#1f6feb;border-color:#1f6feb;color:#fff}
.ad-body{padding:14px 16px;overflow:auto;flex:1}
.ad-table{width:100%;border-collapse:collapse;font-size:.8rem}
.ad-table th,.ad-table td{padding:6px;border-bottom:1px solid #21262d;text-align:left;vertical-align:top}
.ad-btn{min-height:44px;padding:0 12px;border-radius:8px;border:1px solid #30363d;background:#238636;color:#fff;cursor:pointer}
.ad-btn.red{background:#b62324}.ad-btn.gray{background:#21262d}
.ad-in{min-height:44px;padding:0 10px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;min-width:0}
.ad-err{background:#3b1219;border:1px solid #f85149;color:#ffaba8;padding:8px 10px;border-radius:8px;margin:8px 0}
.ad-ok{background:#12261e;border:1px solid #2ea043;color:#7ee2a8;padding:8px 10px;border-radius:8px;margin:8px 0}
.ad-flag{display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:999px;background:#5a3e00;color:#ffd33d;font-size:.7rem}
.ad-mono{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;word-break:break-all}
`;
const usd = (c) => `$${(c / 100).toFixed(2)}`;
const errText = (e) => (e instanceof ApiError ? `${e.message}${e.code ? ` (${e.code})` : ''}` : 'Request failed.');

export default function AdminFinanceConsole({ isOpen, onClose }) {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('redemptions');
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState({ t: '', s: '' });
  const [login, setLogin] = useState({ email: '', password: '' });
  const [playerId, setPlayerId] = useState('');
  const flash = (t, s) => setMsg({ t, s });

  const load = useCallback(async (which = tab) => {
    const paths = { redemptions: 'redemptions', purchases: 'purchases', failed: 'failed-payments', crypto: 'crypto-transfers', reconciliation: 'reconciliation', audit: 'audit' };
    if (which === 'player') return;
    try { setData(await api.admin.get(paths[which])); } catch (e) { flash('err', errText(e)); }
  }, [tab]);

  useEffect(() => {
    if (!isOpen || !api.hasSession()) return;
    api.me().then((d) => (['SUPPORT', 'FINANCE', 'ADMIN'].includes(d.user.role) ? setMe(d.user) : setMe(null))).catch(() => setMe(null));
  }, [isOpen]);
  useEffect(() => { if (me) { setData(null); load(tab); } }, [me, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs a sensitive action; if the API asks for step-up, prompts for the password once and retries. */
  const act = async (fn, okText) => {
    try {
      try { await fn(); } catch (e) {
        if (e instanceof ApiError && e.code === 'STEP_UP_REQUIRED') {
          const pw = window.prompt('Re-enter your password to authorise this action:');
          if (!pw) return;
          await api.stepUp(pw);
          await fn();
        } else throw e;
      }
      flash('ok', okText || 'Done.');
      load();
    } catch (e) { flash('err', errText(e)); }
  };

  if (!isOpen) return null;
  if (!me) {
    return (
      <div className="ad-overlay"><style>{CSS}</style>
        <div className="ad-panel" style={{ maxWidth: 420, margin: 'auto', height: 'auto' }}>
          <div className="ad-head"><b><ShieldAlert size={16} /> Staff sign-in</b><button className="ad-btn gray" onClick={onClose}><X size={16} /></button></div>
          <form className="ad-body" onSubmit={async (e) => { e.preventDefault(); try { const d = await api.login(login); if (!['SUPPORT', 'FINANCE', 'ADMIN'].includes(d.user.role)) { await api.logout(); throw new ApiError(403, 'FORBIDDEN', 'Not a staff account.'); } setMe(d.user); flash('', ''); } catch (er) { flash('err', errText(er)); } }}>
            {msg.s && <div className="ad-err">{msg.s}</div>}
            <p><input className="ad-in" style={{ width: '100%' }} type="email" placeholder="Staff email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></p>
            <p><input className="ad-in" style={{ width: '100%' }} type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></p>
            <button className="ad-btn">Sign in</button>
          </form>
        </div>
      </div>
    );
  }

  const canFinance = ['FINANCE', 'ADMIN'].includes(me.role);
  const tabs = [['redemptions', 'Redemptions'], ['purchases', 'Purchases'], ['failed', 'Failed / disputed'], ['crypto', 'Crypto transfers'], ['player', 'Player'], ['reconciliation', 'Reconciliation'], ['audit', 'Audit trail']];

  return (
    <div className="ad-overlay"><style>{CSS}</style>
      <div className="ad-panel">
        <div className="ad-head"><b>Finance console · {me.email} · {me.role}</b>
          <span><button className="ad-btn gray" onClick={() => load()}><RefreshCw size={14} /></button> <button className="ad-btn gray" onClick={async () => { await api.logout(); setMe(null); }}>Sign out</button> <button className="ad-btn gray" onClick={onClose}><X size={16} /></button></span>
        </div>
        <div className="ad-tabs">{tabs.map(([k, l]) => <button key={k} className={`ad-tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); flash('', ''); }}>{l}</button>)}</div>
        <div className="ad-body">
          {msg.s && <div className={msg.t === 'ok' ? 'ad-ok' : 'ad-err'}>{msg.s}</div>}
          {tab === 'redemptions' && data && <Redemptions rows={data.redemptions} act={act} canFinance={canFinance} />}
          {tab === 'purchases' && data && <Simple rows={data.purchases} cols={['id', 'user_id', 'provider', 'method', 'amount_usd_cents', 'gc', 'sc_bonus_cents', 'status', 'created_at']} money={['amount_usd_cents']} />}
          {tab === 'failed' && data && <Simple rows={data.payments} cols={['id', 'user_id', 'provider', 'amount_usd_cents', 'status', 'failure_reason', 'updated_at']} money={['amount_usd_cents']} />}
          {tab === 'crypto' && data && <CryptoTransfers rows={data.transfers} act={act} canFinance={canFinance} />}
          {tab === 'reconciliation' && data && <Recon r={data.report} />}
          {tab === 'audit' && data && <Simple rows={data.audit} cols={['seq', 'created_at', 'actor_id', 'actor_role', 'action', 'target_type', 'target_id', 'details']} />}
          {tab === 'player' && <Player me={me} act={act} flash={flash} playerId={playerId} setPlayerId={setPlayerId} />}
        </div>
      </div>
    </div>
  );
}

function Simple({ rows, cols, money = [] }) {
  if (!rows.length) return <p>No records.</p>;
  return (
    <table className="ad-table"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>
      {rows.map((r, i) => <tr key={r.id || r.seq || i}>{cols.map((c) => <td key={c} className={String(r[c] ?? '').length > 24 ? 'ad-mono' : ''}>{money.includes(c) ? usd(r[c]) : String(r[c] ?? '')}</td>)}</tr>)}
    </tbody></table>
  );
}

function Redemptions({ rows, act, canFinance }) {
  const [tx, setTx] = useState({});
  if (!rows.length) return <p>No redemption requests.</p>;
  const post = (id, a, body) => act(() => api.admin.post(`redemptions/${id}/${a}`, body), `Redemption ${a} recorded.`);
  const reason = (label) => window.prompt(`${label} — enter reason (5+ chars):`);
  return (
    <table className="ad-table"><thead><tr><th>Created</th><th>Player</th><th>Amount</th><th>Destination</th><th>Risk</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {rows.map((r) => {
        const flags = Array.isArray(r.risk_flags) ? r.risk_flags : JSON.parse(r.risk_flags || '[]');
        return (
          <tr key={r.id}>
            <td>{new Date(r.created_at).toLocaleString()}</td>
            <td>{r.email || r.user_id}<div className="ad-mono">{r.user_id}</div></td>
            <td>{usd(r.amount_sc_cents)}<div>{r.token} / {r.network}</div></td>
            <td className="ad-mono">{r.destination_address}{r.tx_hash && <div>tx {r.tx_hash}</div>}</td>
            <td>{flags.map((f) => <span key={f} className="ad-flag">{f}</span>)}{r.first_approver && <span className="ad-flag">1st approval done</span>}</td>
            <td>{r.status}</td>
            <td>{canFinance && (
              <>
                {['pending', 'under_review'].includes(r.status) && <button className="ad-btn" onClick={() => post(r.id, 'approve')}>Approve</button>}{' '}
                {['pending', 'under_review', 'approved'].includes(r.status) && <button className="ad-btn red" onClick={() => { const x = reason('Reject'); if (x) post(r.id, 'reject', { reason: x }); }}>Reject</button>}
                {r.status === 'approved' && (<div><input className="ad-in" placeholder="payout tx hash (0x…)" value={tx[r.id] || ''} onChange={(e) => setTx({ ...tx, [r.id]: e.target.value })} /> <button className="ad-btn" onClick={() => post(r.id, 'processing', { txHash: tx[r.id] })}>Mark processing</button></div>)}
                {r.status === 'processing' && <button className="ad-btn" onClick={() => post(r.id, 'verify')}>Verify on-chain</button>}{' '}
                {['approved', 'processing'].includes(r.status) && <button className="ad-btn red" onClick={() => { const x = reason('Fail payout'); if (x) post(r.id, 'fail', { reason: x }); }}>Fail &amp; release</button>}
              </>
            )}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

function CryptoTransfers({ rows, act, canFinance }) {
  if (!rows.length) return <p>No on-chain transfers recorded.</p>;
  return (
    <table className="ad-table"><thead><tr><th>Seen</th><th>Tx hash</th><th>Amount (atomic)</th><th>From</th><th>Status</th><th>Note</th><th /></tr></thead><tbody>
      {rows.map((t) => (
        <tr key={t.id}><td>{t.created_at}</td><td className="ad-mono">{t.tx_hash}#{t.log_index}</td><td>{t.amount_atomic}</td><td className="ad-mono">{t.from_address}</td><td>{t.status}</td><td>{t.note}</td>
          <td>{canFinance && t.status === 'unmatched' && (<>
            <button className="ad-btn" onClick={() => { const id = window.prompt('Credit to which payment intent id?'); if (id) act(() => api.admin.post(`crypto-transfers/${t.id}/resolve`, { intentId: id, note: window.prompt('Note') || 'manual' }), 'Transfer resolved.'); }}>Link &amp; credit</button>{' '}
            <button className="ad-btn red" onClick={() => act(() => api.admin.post(`crypto-transfers/${t.id}/resolve`, { reject: true, note: window.prompt('Reason') || 'rejected' }), 'Transfer rejected.')}>Reject</button></>)}</td></tr>
      ))}
    </tbody></table>
  );
}

function Recon({ r }) {
  return (
    <div>
      <h3>{r.ok ? '✅ All checks pass' : '❌ Discrepancies found'}</h3>
      <ul>
        <li>Ledger hash chain: {r.ledgerChain.valid ? 'valid' : `BROKEN at ${r.ledgerChain.brokenAt}`}</li>
        <li>Wallet ↔ ledger reconciliation: {r.wallets.ok ? 'balanced' : `${r.wallets.problems.length} problem(s)`}</li>
        <li>Audit chain: {r.auditChain.valid ? 'valid' : 'BROKEN'}</li>
        <li>Purchases ↔ ledger: {r.payments.consistent ? 'consistent' : 'MISMATCH'} ({r.payments.creditedIntents} credited intents)</li>
        <li>Unmatched crypto transfers: {r.unmatchedCryptoTransfers}</li>
        <li>SC liability: {r.scLiabilityUsd.toFixed(2)} USD · GC outstanding: {r.gcOutstanding.toLocaleString()}</li>
        <li>Stale/pending payments: {r.payments.stale.length} · in review: {r.payments.review.length}</li>
      </ul>
      {!r.wallets.ok && <pre className="ad-mono">{JSON.stringify(r.wallets.problems, null, 2)}</pre>}
    </div>
  );
}

function Player({ me, act, flash, playerId, setPlayerId }) {
  const [d, setD] = useState(null);
  const [led, setLed] = useState([]);
  const lookup = async () => {
    try { setD(await api.admin.get(`players/${encodeURIComponent(playerId)}`)); setLed((await api.admin.get(`players/${encodeURIComponent(playerId)}/ledger`)).ledger); flash('', ''); } catch (e) { flash('err', errText(e)); }
  };
  return (
    <div>
      <p><input className="ad-in" placeholder="Player id (usr_…)" value={playerId} onChange={(e) => setPlayerId(e.target.value.trim())} /> <button className="ad-btn" onClick={lookup}>Look up</button></p>
      {d && (
        <>
          <p><b>{d.user.email}</b> · {d.user.state} · KYC {d.user.kycStatus} · {d.user.status} · GC {d.balance.gc.toLocaleString()} · SC {d.balance.sc.toFixed(2)} (hold {d.balance.scOnHold.toFixed(2)})</p>
          {['FINANCE', 'ADMIN'].includes(me.role) && (
            <p>
              <button className="ad-btn" onClick={() => act(() => api.admin.post(`players/${playerId}/kyc`, { status: 'verified', note: window.prompt('Verification reference/note') || '' }), 'KYC set.')}>Mark KYC verified</button>{' '}
              <button className="ad-btn gray" onClick={() => act(() => api.admin.post(`players/${playerId}/kyc`, { status: 'rejected', note: window.prompt('Reason') || '' }), 'KYC rejected.')}>Reject KYC</button>
            </p>
          )}
          {me.role === 'ADMIN' && (
            <p>
              <button className="ad-btn red" onClick={() => { const r = window.prompt('Freeze reason'); if (r) act(() => api.admin.post(`players/${playerId}/status`, { status: 'frozen', reason: r }), 'Account frozen.'); }}>Freeze</button>{' '}
              <button className="ad-btn gray" onClick={() => { const r = window.prompt('Unfreeze reason'); if (r) act(() => api.admin.post(`players/${playerId}/status`, { status: 'active', reason: r }), 'Account reactivated.'); }}>Unfreeze</button>{' '}
              <button className="ad-btn gray" onClick={() => { const c = window.prompt('Currency (GC or SC)'); const a = window.prompt('Signed amount, e.g. 5.00 or -5.00'); const r = window.prompt('Detailed reason (10+ chars)'); if (c && a && r) act(() => api.admin.post(`players/${playerId}/adjust`, { currency: c.toUpperCase(), amount: a, reason: r }), 'Adjustment posted as a new ledger entry.'); }}>Ledger adjustment…</button>
            </p>
          )}
          <h4>Ledger (append-only)</h4>
          <Simple rows={led} cols={['created_at', 'type', 'currency', 'bucket', 'amount', 'balance_before', 'balance_after', 'ref_id']} />
        </>
      )}
    </div>
  );
}
