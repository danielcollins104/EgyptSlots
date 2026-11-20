// ============================================================================
// CRYPTO GATEWAY DEPOSIT PANEL — "Pay Instantly" rail
// ============================================================================
// Self-contained live-crypto deposit flow:
//   1. create invoice via /api/crypto/invoice
//   2. show gateway pay address + exact amount + coin deep link
//   3. poll /api/crypto/invoice-status until finished/confirmed
//   4. onPurchaseSuccess(package) — the SAME callback the other rails use,
//      so balances, sound, and analytics behave identically.
//
// Mount inside the crypto rail of PaymentModal (see INTEGRATION.md) or any
// cashier screen. Fully optional — if the gateway isn't configured the panel
// hides itself and the self-custody on-chain rail keeps working untouched.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { cryptoGatewayService } from '../services/cryptoGatewayService.js';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig.js';
import { soundEngine } from '../audio/soundEngine.js';

const GATEWAY_COINS = [
  { id: 'usdt', label: 'USDT', uriScheme: null },
  { id: 'btc', label: 'BTC', uriScheme: 'bitcoin' },
  { id: 'eth', label: 'ETH', uriScheme: 'ethereum' },
  { id: 'sol', label: 'SOL', uriScheme: 'solana' },
];

const TERMINAL_OK = new Set(['finished', 'confirmed']);

export default function CryptoGatewayDeposit({
  pkg,
  userId = 'guest',
  onPurchaseSuccess,
  onError,
  compact = false,
}) {
  const [available, setAvailable] = useState(null); // null = checking
  const [coin, setCoin] = useState('usdt');
  const [invoice, setInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState('');
  const [payStatus, setPayStatus] = useState(null); // null | waiting | detected | expired
  const [copied, setCopied] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    cryptoGatewayService.isConfigured().then((ok) => alive && setAvailable(ok));
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startInvoice = async (selectedCoin) => {
    setInvoiceError('');
    setPayStatus(null);
    setInvoice(null);
    const res = await cryptoGatewayService.createInvoice({
      packageId: pkg?.id,
      customAmountUsd: pkg?.isCustom ? pkg.priceUsd : null,
      userId,
      payCurrency: selectedCoin,
    });
    if (!res.ok) {
      if (res.gatewayUnavailable) {
        setAvailable(false);
        return;
      }
      setInvoiceError(res.error || 'Could not create invoice');
      onError?.(res.error);
      return;
    }
    setInvoice(res.invoice);
    setPayStatus('waiting');
    stopPolling();
    pollRef.current = setInterval(async () => {
      const st = await cryptoGatewayService.getInvoiceStatus(res.invoice.paymentId);
      if (TERMINAL_OK.has(st.status)) {
        stopPolling();
        setPayStatus('detected');
        soundEngine.playWinCelebration(false);
        onPurchaseSuccess?.(pkg, res.invoice);
      } else if (st.status === 'failed' || st.status === 'expired') {
        stopPolling();
        setPayStatus('expired');
      }
    }, 8000);
  };

  const pickCoin = (c) => {
    setCoin(c);
    if (invoice) startInvoice(c); // regenerate for the new coin
  };

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(''), 1600);
  };

  if (available === false) return null; // gateway off — rail stays hidden, zero breakage

  const coinMeta = GATEWAY_COINS.find((c) => c.id === coin) || GATEWAY_COINS[0];
  const deepLink = coinMeta.uriScheme && invoice?.payAddress
    ? `${coinMeta.uriScheme}:${invoice.payAddress}?amount=${invoice.payAmount}`
    : null;

  return (
    <div className={`sc-gateway-panel ${compact ? 'sc-gateway-panel--compact' : ''}`} style={{
      marginTop: 12,
      border: '1px solid rgba(212,175,55,0.45)',
      borderRadius: 14,
      padding: 14,
      background: 'linear-gradient(160deg, rgba(26,16,60,0.85), rgba(8,6,26,0.9))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f6d87a', fontWeight: 700, fontSize: 14 }}>Instant Crypto Checkout</div>
          <div style={{ color: 'rgba(235,229,216,0.65)', fontSize: 11 }}>
            Auto-credits the moment the network confirms — no waiting, no manual review.
          </div>
        </div>
        {available === null && <span style={{ color: 'rgba(235,229,216,0.5)', fontSize: 11 }}>checking…</span>}
      </div>

      {available === true && !invoice && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {GATEWAY_COINS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCoin(c.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: coin === c.id ? '1px solid #d4af37' : '1px solid rgba(212,175,55,0.3)',
                  background: coin === c.id ? 'rgba(212,175,55,0.18)' : 'transparent',
                  color: coin === c.id ? '#f6d87a' : 'rgba(235,229,216,0.75)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => startInvoice(coin)}
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #d4af37, #f6d87a)',
              color: '#1a0b2e',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Get {coinMeta.label} Deposit Address — {SWEEPSTAKES_CONFIG.currencySymbol || '$'}
            {(pkg?.priceUsd ?? 0).toFixed(2)}
          </button>
          {invoiceError && (
            <div style={{ color: '#ff9b9b', fontSize: 12, marginTop: 8 }}>{invoiceError}</div>
          )}
        </>
      )}

      {invoice && (
        <div style={{ marginTop: 4 }}>
          <div style={{ color: 'rgba(235,229,216,0.75)', fontSize: 12, marginBottom: 8 }}>
            Send exactly{' '}
            <strong style={{ color: '#f6d87a' }}>
              {invoice.payAmount} {invoice.payCurrency?.toUpperCase()}
            </strong>{' '}
            to:
          </div>
          <div
            onClick={() => copy(invoice.payAddress, 'addr')}
            title="Click to copy"
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              wordBreak: 'break-all',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              color: copied === 'addr' ? '#7CFFB2' : '#e9e4d8',
            }}
          >
            {copied === 'addr' ? '✓ Copied!' : invoice.payAddress}
          </div>
          {deepLink && (
            <a
              href={deepLink}
              style={{ display: 'block', marginTop: 8, color: '#7cc4ff', fontSize: 12, textDecoration: 'none' }}
            >
              Open in {coinMeta.label} wallet ↗
            </a>
          )}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: payStatus === 'detected' ? '#7CFFB2' : '#f6d87a', display: 'inline-block' }} />
            <span style={{ color: 'rgba(235,229,216,0.75)' }}>
              {payStatus === 'detected'
                ? 'Payment detected — coins credited! 🎉'
                : payStatus === 'expired'
                ? 'Invoice expired — tap the coin buttons to get a fresh address.'
                : 'Watching the network — this page credits automatically…'}
            </span>
          </div>
          {payStatus === 'expired' && (
            <button
              type="button"
              onClick={() => startInvoice(coin)}
              style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid #d4af37', background: 'transparent', color: '#f6d87a', fontSize: 12, cursor: 'pointer' }}
            >
              Get a fresh address
            </button>
          )}
        </div>
      )}
    </div>
  );
}
