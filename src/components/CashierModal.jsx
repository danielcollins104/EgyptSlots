import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ShieldCheck, Wallet, Clock, CheckCircle2, AlertTriangle, Copy, LogOut } from 'lucide-react';
import { api, ApiError } from '../services/cashierApi';
import SquareCheckout from './SquareCheckout';
import Readable from './Readable';

/**
 * Cashier & Redemption Center.
 * Everything shown here is server-authoritative: prices and coin amounts come from the server's package list,
 * coins are credited ONLY after the backend verifies the payment (webhook / on-chain), and redemptions are
 * validated, reserved and approved server-side. The browser can only request actions.
 */

const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

const CSS = `
.cx-overlay{position:fixed;inset:0;z-index:9000;background:rgba(4,2,10,.86);display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));backdrop-filter:blur(6px)}
.cx-panel{width:min(980px,100%);max-height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,#1a1030,#0c0718);border:1px solid #d4a94a;border-radius:18px;box-shadow:0 0 60px rgba(212,169,74,.25);color:#f4ead2;font-family:'Cinzel',serif;overflow:hidden}
.cx-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(212,169,74,.35)}
.cx-title{font-size:1.15rem;font-weight:800;letter-spacing:.08em;color:#ffd978;display:flex;gap:8px;align-items:center}
.cx-x{min-width:52px;min-height:52px;background:none;border:0;color:#f4ead2;cursor:pointer}
.cx-wallet{display:flex;flex-wrap:wrap;gap:10px;padding:10px 18px;background:rgba(0,0,0,.28);font-size:.82rem}
.cx-chip{padding:6px 12px;border-radius:999px;border:1px solid rgba(212,169,74,.45);background:rgba(212,169,74,.08)}
.cx-chip b{color:#ffd978}
.cx-tabs{display:flex;gap:6px;padding:10px 18px 0;flex-wrap:wrap}
.cx-tab{min-height:52px;padding:0 18px;border-radius:12px 12px 0 0;border:1px solid rgba(212,169,74,.35);border-bottom:0;background:rgba(255,255,255,.04);color:#cdbf9f;cursor:pointer;font-family:inherit;font-weight:700}
.cx-tab.on{background:linear-gradient(180deg,#d4a94a,#9a7424);color:#1a1030}
.cx-body{padding:16px 18px 20px;overflow:auto;flex:1;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.cx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.cx-card{padding:14px;border-radius:14px;border:1px solid rgba(212,169,74,.4);background:rgba(255,255,255,.04);cursor:pointer;text-align:left;color:inherit;font:inherit;min-height:52px}
.cx-card.on{border-color:#ffd978;box-shadow:0 0 0 2px rgba(255,217,120,.5) inset;background:rgba(212,169,74,.14)}
.cx-card h4{margin:0 0 6px;font-size:.9rem;color:#ffd978}
.cx-price{font-size:1.4rem;font-weight:800}
.cx-btn{min-height:52px;padding:0 22px;border-radius:12px;border:0;cursor:pointer;font-weight:800;letter-spacing:.04em;background:linear-gradient(180deg,#ffd978,#c8932c);color:#1a1030}
.cx-btn.sec{background:rgba(255,255,255,.08);color:#f4ead2;border:1px solid rgba(212,169,74,.4)}
.cx-btn:disabled{opacity:.5;cursor:not-allowed}
.cx-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:10px 0}
.cx-in,.cx-sel{min-height:52px;padding:0 12px;border-radius:10px;border:1px solid rgba(212,169,74,.45);background:#120a22;color:#f4ead2;font:inherit;min-width:0;flex:1 1 180px}
.cx-note{font-size:.88rem;color:#d3c8aa;line-height:1.65}
.cx-err{padding:10px 12px;border-radius:10px;background:rgba(255,70,70,.12);border:1px solid rgba(255,90,90,.5);color:#ffb3b3;margin:10px 0}
.cx-ok{padding:10px 12px;border-radius:10px;background:rgba(60,200,120,.12);border:1px solid rgba(80,220,140,.5);color:#b5f2cf;margin:10px 0}
.cx-table{width:100%;border-collapse:collapse;font-size:.82rem}
.cx-table th,.cx-table td{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top}
.cx-status{padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;background:rgba(255,255,255,.1)}
.cx-status.succeeded,.cx-status.completed{background:rgba(60,200,120,.25);color:#9af0c0}
.cx-status.failed,.cx-status.rejected,.cx-status.cancelled,.cx-status.expired{background:rgba(255,80,80,.22);color:#ffb0b0}
.cx-status.pending,.cx-status.under_review,.cx-status.processing,.cx-status.approved{background:rgba(255,200,60,.22);color:#ffe08a}
.cx-mono{font-family:ui-monospace,Menlo,monospace;word-break:break-all;background:rgba(0,0,0,.35);padding:6px 8px;border-radius:8px}
.cx-legal{font-size:.85rem;color:#d3c8aa;margin-top:14px;line-height:1.7}
@media (max-width:640px){.cx-tab{padding:0 12px;flex:1}.cx-btn{width:100%}}
`;

const fmtSc = (n) => Number(n || 0).toFixed(2);
const errText = (e) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
const Status = ({ s }) => <span className={`cx-status ${s}`}>{String(s).replace('_', ' ')}</span>;

export default function CashierModal({ isOpen, onClose, initialTab = 'store' }) {
  const [tab, setTab] = useState(initialTab === 'history' ? 'history' : initialTab === 'redeem' ? 'redeem' : 'store');
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [booting, setBooting] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const flash = (type, text) => setMsg({ type, text });

  const refresh = useCallback(async () => {
    if (!api.hasSession()) { setUser(null); setBalance(null); return; }
    try {
      const d = await api.me();
      setUser(d.user);
      setBalance(d.balance);
    } catch { setUser(null); setBalance(null); }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    refresh().finally(() => live && setBooting(false));
    return () => { live = false; };
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  return (
    <div className="cx-overlay" role="dialog" aria-modal="true" aria-label="Cashier" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <style>{CSS}</style>
      <div className="cx-panel">
        <div className="cx-head">
          <div className="cx-title"><Wallet size={20} /> CASHIER &amp; REDEMPTION CENTER</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user && (
              <button className="cx-btn sec" style={{ minHeight: 52 }} onClick={async () => { await api.logout(); setUser(null); setBalance(null); }} title="Sign out"><LogOut size={16} /></button>
            )}
            <button className="cx-x" onClick={onClose} aria-label="Close"><X size={22} /></button>
          </div>
        </div>

        {user && balance && (
          <div className="cx-wallet">
            <span className="cx-chip">Account: <b>{user.email}</b></span>
            <span className="cx-chip">GC: <b>{balance.gc.toLocaleString()}</b></span>
            <span className="cx-chip">SC: <b>{fmtSc(balance.sc)}</b></span>
            <span className="cx-chip">Redeemable SC: <b>{fmtSc(balance.scRedeemable)}</b></span>
            {balance.scOnHold > 0 && <span className="cx-chip">On hold: <b>{fmtSc(balance.scOnHold)}</b></span>}
            <span className="cx-chip">Identity: <b>{user.kycStatus}</b></span>
          </div>
        )}

        <div className="cx-tabs">
          {[['store', 'Buy Gold Coins'], ['redeem', 'Redeem SC'], ['history', 'History'], ['account', 'Account']].map(([k, label]) => (
            <button key={k} className={`cx-tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setMsg({ type: '', text: '' }); }}>{label}</button>
          ))}
        </div>

        <div className="cx-body">
          {msg.text && <div className={msg.type === 'ok' ? 'cx-ok' : 'cx-err'}>{msg.text}</div>}
          {booting ? <p>Loading…</p> : !user ? (
            <AuthPanel onAuthed={async () => { await refresh(); }} flash={flash} />
          ) : tab === 'store' ? (
            <StorePanel flash={flash} refresh={refresh} />
          ) : tab === 'redeem' ? (
            <RedeemPanel user={user} balance={balance} flash={flash} refresh={refresh} />
          ) : tab === 'history' ? (
            <HistoryPanel />
          ) : (
            <AccountPanel flash={flash} refresh={refresh} />
          )}
          <Readable as="p" className="cx-legal" label="the legal notice">
            NO PURCHASE NECESSARY. Gold Coins have no cash value. Sweeps Coins are promotional entries, are awarded free with Gold Coin
            purchases and via the free daily entry, and can only be redeemed after 1x play-through, identity verification and approval.
            Void where prohibited. 18+. Please play responsibly.
          </Readable>
        </div>
      </div>
    </div>
  );
}

function AuthPanel({ onAuthed, flash }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ email: '', password: '', dob: '', state: '', agree: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!f.agree) throw new ApiError(400, 'TERMS', 'Please confirm you are of legal age and accept the Terms and Sweepstakes Rules.');
        await api.register({ email: f.email, password: f.password, dob: f.dob, state: f.state });
      } else {
        await api.login({ email: f.email, password: f.password });
      }
      flash('', '');
      await onAuthed();
    } catch (err) { flash('err', errText(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 460 }}>
      <h3 style={{ color: '#ffd978' }}>{mode === 'login' ? 'Sign in to your secure wallet' : 'Create your account'}</h3>
      <div className="cx-row"><input className="cx-in" type="email" placeholder="Email" autoComplete="email" value={f.email} onChange={set('email')} required /></div>
      <div className="cx-row"><input className="cx-in" type="password" placeholder="Password (10+ characters)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} required /></div>
      {mode === 'register' && (
        <>
          <div className="cx-row">
            <input className="cx-in" type="date" aria-label="Date of birth" value={f.dob} onChange={set('dob')} required />
            <select className="cx-sel" value={f.state} onChange={set('state')} required>
              <option value="">State of residence</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <label className="cx-note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={f.agree} onChange={set('agree')} style={{ width: 24, height: 24 }} />
            I am at least 18, I live in the state selected, and I accept the Terms, Privacy Policy and Sweepstakes Official Rules.
          </label>
        </>
      )}
      <div className="cx-row">
        <button className="cx-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="cx-btn sec" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Register' : 'Have an account? Sign in'}</button>
      </div>
    </form>
  );
}

function StorePanel({ flash, refresh }) {
  const [packages, setPackages] = useState([]);
  const [methods, setMethods] = useState({ providers: [], crypto: [] });
  const [sel, setSel] = useState(null);
  const [method, setMethod] = useState(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null); // { intent, clientAction }
  const [status, setStatus] = useState(null);
  const poll = useRef(null);

  useEffect(() => {
    api.packages().then((d) => setPackages(d.packages)).catch((e) => flash('err', errText(e)));
    api.methods().then(setMethods).catch(() => {});
    return () => clearInterval(poll.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => {
    const out = [];
    for (const p of methods.providers || []) {
      if (p.provider === 'crypto') continue;
      const SQUARE_LABELS = { card: 'Credit / Debit Card', applepay: 'Apple Pay', googlepay: 'Google Pay', cashapp: 'Cash App Pay' };
      for (const m of p.methods) out.push({ key: `${p.provider}:${m}`, provider: p.provider, method: m, label: p.provider === 'square' ? (SQUARE_LABELS[m] || 'Card') : p.label });
    }
    for (const c of methods.crypto || []) for (const t of c.tokens) out.push({ key: `crypto:${c.network}:${t}`, provider: 'crypto', method: t.toLowerCase(), network: c.network, token: t, label: `${t} on ${c.label}` });
    return out;
  }, [methods]);

  const startPolling = (id) => {
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const d = await api.payment(id);
        setStatus(d.payment);
        if (['succeeded', 'failed', 'expired', 'refunded', 'disputed', 'review'].includes(d.payment.status)) {
          clearInterval(poll.current);
          if (d.payment.status === 'succeeded') { flash('ok', 'Payment verified — your coins have been credited.'); refresh(); }
        }
      } catch { /* transient */ }
    }, 6000);
  };

  const confirm = async () => {
    const o = options.find((x) => x.key === method);
    if (!sel || !o) return;
    setBusy(true);
    try {
      const d = await api.createPayment({ packageId: sel.id, provider: o.provider, method: o.method, network: o.network, token: o.token });
      setActive(d);
      setStatus(d.intent);
      startPolling(d.intent.id);
      flash('', '');
    } catch (e) { flash('err', errText(e)); } finally { setBusy(false); }
  };

  if (active) {
    const a = active.clientAction || {};
    return (
      <div>
        <h3 style={{ color: '#ffd978' }}>Payment <Status s={status?.status || 'pending'} /></h3>
        <p className="cx-note">Order {active.intent.id} · ${active.intent.amountUsd.toFixed(2)} · {active.intent.gc.toLocaleString()} GC + {fmtSc(active.intent.sc)} free promotional SC</p>
        {a.type === 'crypto' && (
          <Readable label="the payment instructions">
            <p className="cx-note"><AlertTriangle size={14} /> {a.warning}</p>
            <div className="cx-row"><span>Network:</span> <b>{a.networkLabel}</b> <span>Token:</span> <b>{a.token}</b></div>
            <div>Send exactly:</div>
            <div className="cx-mono">{a.amount} {a.token} <button className="cx-btn sec" style={{ minHeight: 40, marginLeft: 8 }} onClick={() => navigator.clipboard?.writeText(a.amount)}><Copy size={14} /></button></div>
            <div style={{ marginTop: 8 }}>To address:</div>
            <div className="cx-mono">{a.payTo} <button className="cx-btn sec" style={{ minHeight: 40, marginLeft: 8 }} onClick={() => navigator.clipboard?.writeText(a.payTo)}><Copy size={14} /></button></div>
            <p className="cx-note">Token contract: <span className="cx-mono">{a.tokenContract}</span><br />Expires {new Date(a.expiresAt).toLocaleTimeString()} · needs {a.confirmationsRequired} confirmations. Your coins are credited automatically once the payment is verified on-chain — pasting a transaction hash is not required and cannot speed this up.</p>
          </Readable>
        )}
        {a.type === 'sandbox' && <p className="cx-note">Sandbox payment — waiting for a signed provider event. (Development only.)</p>}
        {a.type === 'square_web_payments' && status?.status === 'pending' && (
          <SquareCheckout intent={active.intent} clientAction={a} method={active.intent.method} />
        )}
        {status?.status === 'failed' && <div className="cx-err">This payment failed. No coins were credited and you were not charged by us. You can try again.</div>}
        {status?.status === 'expired' && <div className="cx-err">This payment request expired. If you already paid, contact support with your order number.</div>}
        {status?.status === 'review' && <div className="cx-err">Your payment needs a manual check by our team. Your order number: {active.intent.id}.</div>}
        <div className="cx-row"><button className="cx-btn sec" onClick={() => { clearInterval(poll.current); setActive(null); setStatus(null); }}>Back to store</button></div>
      </div>
    );
  }

  return (
    <div>
      <div className="cx-grid">
        {packages.map((p) => (
          <button key={p.id} className={`cx-card ${sel?.id === p.id ? 'on' : ''}`} onClick={() => setSel(p)}>
            <h4>{p.title || p.id}</h4>
            <div className="cx-price">${p.priceUsd.toFixed(2)}</div>
            <div>{p.gc.toLocaleString()} GC</div>
            <div className="cx-note">+ {fmtSc(p.sc)} SC free promotional entries</div>
            {p.badge && <div className="cx-note">{p.badge}</div>}
          </button>
        ))}
      </div>
      {sel && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#ffd978' }}>Payment method</h4>
          {options.length === 0 && <p className="cx-note">No payment methods are currently enabled. Please check back soon.</p>}
          <div className="cx-grid">
            {options.map((o) => (
              <button key={o.key} className={`cx-card ${method === o.key ? 'on' : ''}`} onClick={() => setMethod(o.key)}><h4>{o.label}</h4></button>
            ))}
          </div>
          <div className="cx-row"><button className="cx-btn" disabled={!method || busy} onClick={confirm}>{busy ? 'Creating order…' : `Confirm $${sel.priceUsd.toFixed(2)} purchase`}</button></div>
          <p className="cx-note"><ShieldCheck size={14} /> Prices and coin amounts are set by our server. Coins are credited only after the payment provider / blockchain confirms your payment.</p>
        </div>
      )}
    </div>
  );
}

function RedeemPanel({ user, balance, flash, refresh }) {
  const [methods, setMethods] = useState(null);
  const [dests, setDests] = useState([]);
  const [reds, setReds] = useState([]);
  const [amount, setAmount] = useState('');
  const [destId, setDestId] = useState('');
  const [nd, setNd] = useState({ network: 'base', token: 'USDC', address: '', password: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [m, d, r] = await Promise.all([api.redemptionMethods(), api.destinations(), api.redemptions()]);
    setMethods(m.methods); setDests(d.destinations); setReds(r.redemptions);
  }, []);
  useEffect(() => { load().catch((e) => flash('err', errText(e))); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, okText) => {
    setBusy(true);
    try { await fn(); if (okText) flash('ok', okText); await Promise.all([load(), refresh()]); } catch (e) { flash('err', errText(e)); } finally { setBusy(false); }
  };

  if (!methods) return <p>Loading…</p>;
  const verified = user.kycStatus === 'verified';
  const nets = [...new Set((methods.crypto || []).map((c) => c.network))];
  const tokens = (methods.crypto || []).filter((c) => c.network === nd.network).map((c) => c.token);
  return (
    <div>
      <h3 style={{ color: '#ffd978' }}>Redeem Sweeps Coins</h3>
      <Readable as="p" className="cx-note" label="the redemption rules">Eligible to redeem now: <b>{fmtSc(balance.scRedeemable)} SC</b> (1 SC = $1.00). Promotional SC must be played through once. Minimum {methods.minSc} SC · maximum {methods.maxSc} SC per request · {methods.dailyLimitSc} SC per day. Gold Coins cannot be redeemed.</Readable>
      {!verified && <div className="cx-err">Identity verification is required before you can redeem. Status: {user.kycStatus}. Contact support to complete verification.</div>}

      <h4>1. Payout address (USDC / USDT)</h4>
      {dests.length === 0 && <p className="cx-note">No saved addresses yet.</p>}
      {dests.map((d) => (
        <div key={d.id} className="cx-row" style={{ margin: '4px 0' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            <input type="radio" name="dest" checked={destId === d.id} onChange={() => setDestId(d.id)} style={{ width: 22, height: 22 }} />
            <span className="cx-mono">{d.token} · {d.network} · {d.address}</span>
          </label>
          {new Date(d.usable_after) > new Date() && <span className="cx-note">usable after {new Date(d.usable_after).toLocaleString()}</span>}
          <button className="cx-btn sec" style={{ minHeight: 44 }} disabled={busy} onClick={() => run(() => api.removeDestination(d.id))}>Remove</button>
        </div>
      ))}
      {verified && (
        <details style={{ margin: '10px 0' }}>
          <summary style={{ cursor: 'pointer', minHeight: 44 }}>Add a payout address</summary>
          <div className="cx-row">
            <select className="cx-sel" value={nd.network} onChange={(e) => setNd({ ...nd, network: e.target.value, token: 'USDC' })}>{nets.map((n) => <option key={n} value={n}>{n}</option>)}</select>
            <select className="cx-sel" value={nd.token} onChange={(e) => setNd({ ...nd, token: e.target.value })}>{tokens.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="cx-row"><input className="cx-in" placeholder="0x… wallet address on the selected network" value={nd.address} onChange={(e) => setNd({ ...nd, address: e.target.value.trim() })} /></div>
          <div className="cx-row"><input className="cx-in" type="password" placeholder="Re-enter your password to confirm" autoComplete="current-password" value={nd.password} onChange={(e) => setNd({ ...nd, password: e.target.value })} />
            <button className="cx-btn" disabled={busy || !nd.address || !nd.password} onClick={() => run(async () => { await api.stepUp(nd.password); await api.addDestination({ network: nd.network, token: nd.token, address: nd.address }); setNd({ ...nd, address: '', password: '' }); }, `Address saved. For your security it can be used after a ${methods.coolingHours ?? 24}-hour cooling period.`)}>Save address</button></div>
          <p className="cx-note">Double-check the network: sending to a wallet on the wrong network can permanently lose funds. New addresses have a security cooling-off period.</p>
        </details>
      )}

      <h4>2. Amount</h4>
      <div className="cx-row">
        <input className="cx-in" inputMode="decimal" placeholder={`SC amount (min ${methods.minSc})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="cx-btn" disabled={busy || !verified || !destId || !amount} onClick={() => run(async () => { await api.redeem({ amountSc: amount, destinationId: destId }); setAmount(''); }, 'Redemption request submitted. SC has been reserved while we review it.')}>Request redemption</button>
      </div>

      <h4>Your redemptions</h4>
      {reds.length === 0 ? <p className="cx-note">No redemptions yet.</p> : (
        <table className="cx-table"><thead><tr><th>Date</th><th>Amount</th><th>To</th><th>Status</th><th /></tr></thead><tbody>
          {reds.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString()}</td><td>{fmtSc(r.amountSc)} SC</td><td>{r.token} {r.destination}</td>
              <td><Status s={r.status} />{r.reason && <div className="cx-note">{r.reason}</div>}{r.txHash && <div className="cx-note cx-mono">{r.txHash}</div>}</td>
              <td>{['pending', 'under_review'].includes(r.status) && <button className="cx-btn sec" style={{ minHeight: 44 }} disabled={busy} onClick={() => run(() => api.cancelRedemption(r.id), 'Request cancelled and SC returned.')}>Cancel</button>}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}

function HistoryPanel() {
  const [payments, setPayments] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api.payments(), api.ledger()]).then(([p, l]) => { setPayments(p.payments); setLedger(l.history); }).catch((e) => setErr(errText(e)));
  }, []);
  if (err) return <div className="cx-err">{err}</div>;
  if (!payments) return <p>Loading…</p>;
  return (
    <div>
      <h3 style={{ color: '#ffd978' }}>Purchase history</h3>
      {payments.length === 0 ? <p className="cx-note">No purchases yet.</p> : (
        <table className="cx-table"><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Coins</th><th>Status</th></tr></thead><tbody>
          {payments.map((p) => (
            <tr key={p.id}><td>{new Date(p.createdAt).toLocaleString()}</td><td>{p.provider}/{p.method}</td><td>${p.amountUsd.toFixed(2)}</td><td>{p.gc.toLocaleString()} GC + {fmtSc(p.sc)} SC</td><td><Status s={p.status} /></td></tr>
          ))}
        </tbody></table>
      )}
      <h3 style={{ color: '#ffd978', marginTop: 20 }}>Wallet ledger</h3>
      <table className="cx-table"><thead><tr><th>Time</th><th>Type</th><th>Change</th><th>Balance</th></tr></thead><tbody>
        {ledger.map((l) => {
          const sc = l.currency === 'SC';
          const f = (n) => (sc ? (n / 100).toFixed(2) : n.toLocaleString());
          return <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.type.replace(/_/g, ' ')}{l.bucket === 'HOLD' ? ' (hold)' : ''}</td><td>{l.amount > 0 ? '+' : ''}{f(l.amount)} {l.currency}</td><td>{f(l.balance_after)}</td></tr>;
        })}
      </tbody></table>
    </div>
  );
}

function AccountPanel({ flash, refresh }) {
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  return (
    <div>
      <h3 style={{ color: '#ffd978' }}>Free daily entry (no purchase necessary)</h3>
      <p className="cx-note">Claim your free Gold Coins and Sweeps Coins once per day — no purchase required.</p>
      <div className="cx-row"><button className="cx-btn" disabled={busy} onClick={async () => { setBusy(true); try { const d = await api.dailyFree(); flash('ok', `Claimed ${d.granted.gc.toLocaleString()} GC + ${d.granted.sc.toFixed(2)} SC.`); refresh(); } catch (e) { flash('err', errText(e)); } finally { setBusy(false); } }}><CheckCircle2 size={16} /> Claim free daily entry</button></div>
      <p className="cx-note">Alternate mail-in entry: see the Official Sweepstakes Rules.</p>
      <h3 style={{ color: '#ffd978', marginTop: 24 }}>Responsible play</h3>
      <div className="cx-row">
        <select className="cx-sel" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}</select>
        <button className="cx-btn sec" disabled={busy} onClick={async () => { if (!window.confirm(`Block play and purchases for ${days} day(s)? This cannot be undone.`)) return; try { await api.selfExclude(days); flash('ok', 'Self-exclusion is active.'); } catch (e) { flash('err', errText(e)); } }}><Clock size={16} /> Take a break</button>
      </div>
    </div>
  );
}
