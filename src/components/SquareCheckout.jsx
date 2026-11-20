import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { loadSquareSdk } from '../services/squareSdk';
import { api, ApiError } from '../services/cashierApi';

/**
 * Square Web Payments SDK checkout for ONE payment intent and ONE method.
 * Tokenises in Square's iframes and posts only the single-use source token to our
 * charge endpoint. Coins are credited later by the verified webhook; this component
 * only starts the charge and surfaces errors — the parent keeps polling the intent.
 */
export default function SquareCheckout({ intent, clientAction, method, onError }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  const inst = useRef(null); // { payments, card|null, wallet|null }

  const fail = (e) => {
    const msg = e instanceof ApiError ? e.message : (e?.message || 'Payment could not be completed.');
    setErr(msg);
    onError?.(e);
  };

  const charge = async (sourceId) => {
    setBusy(true);
    setErr('');
    try {
      await api.chargePayment(intent.id, sourceId);
      // Parent's poller watches the intent and shows success once the webhook credits coins.
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const Square = await loadSquareSdk(clientAction.environment);
        const payments = Square.payments(clientAction.applicationId, clientAction.locationId);
        const total = { amount: Number(intent.amountUsd).toFixed(2), label: 'Gold Coin package' };
        const mkRequest = () => payments.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total });
        const next = { payments, card: null, wallet: null };

        if (method === 'card') {
          next.card = await payments.card();
          await next.card.attach('#sq-card-container');
        } else if (method === 'applepay') {
          try {
            next.wallet = await payments.applePay(mkRequest());
            await next.wallet.attach('#sq-apple-pay', { buttonColor: 'white', buttonType: 'plain' });
            next.wallet.addEventListener('ontokenization', (e) => {
              if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
              else setErr('Apple Pay could not verify this card.');
            });
          } catch {
            if (!dead) setErr('Apple Pay is not available on this device/browser. Please choose another method.');
          }
        } else if (method === 'googlepay') {
          try {
            next.wallet = await payments.googlePay(mkRequest());
            await next.wallet.attach('#sq-google-pay', { buttonColor: 'white', buttonType: 'long', buttonSizeMode: 'fill' });
            next.wallet.addEventListener('ontokenization', (e) => {
              if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
              else setErr('Google Pay could not verify this card.');
            });
          } catch {
            if (!dead) setErr('Google Pay is not available in this browser. Please choose another method.');
          }
        } else if (method === 'cashapp') {
          next.wallet = await payments.cashAppPay(mkRequest(), {
            redirectURL: window.location.href,
            referenceId: intent.id,
          });
          await next.wallet.attach('#sq-cash-app-pay', { shape: 'semiround', width: 'full' });
          next.wallet.addEventListener('ontokenization', (e) => {
            if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
            else setErr('Cash App Pay authorization did not complete.');
          });
        }

        if (!dead) { inst.current = next; setWalletReady(true); }
      } catch (e) {
        if (!dead) fail(e);
      }
    })();
    return () => {
      dead = true;
      const cur = inst.current;
      inst.current = null;
      (async () => {
        try { await cur?.card?.destroy?.(); } catch { /* detach best-effort */ }
        try { await cur?.wallet?.destroy?.(); } catch { /* detach best-effort */ }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payWithCard = async () => {
    const { payments, card } = inst.current || {};
    if (!card) return;
    setBusy(true);
    setErr('');
    try {
      const tok = await card.tokenize();
      if (tok.status !== 'OK') throw new Error('Please check your card details.');
      let sourceId = tok.token;
      // Strong Customer Authentication (3-D Secure) when Square requires it.
      if (payments.verifyBuyer) {
        const verified = await payments.verifyBuyer(sourceId, {
          amount: Number(intent.amountUsd).toFixed(2),
          currencyCode: 'USD',
          intent: 'CHARGE',
        });
        if (verified?.token) sourceId = verified.token;
      }
      await charge(sourceId);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  return (
    <div style={{ margin: '12px 0' }}>
      {method === 'card' && (
        <>
          <div id="sq-card-container" style={{ minHeight: 90, background: '#120a22', borderRadius: 10, padding: 8 }} />
          <button
            type="button"
            className="cx-btn"
            style={{ width: '100%', marginTop: 10 }}
            disabled={!walletReady || busy}
            onClick={payWithCard}
          >
            {busy ? (<><Loader2 size={16} className="sc-spin" /> Processing…</>) : (<><Lock size={14} /> Pay ${Number(intent.amountUsd).toFixed(2)} securely</>)}
          </button>
        </>
      )}
      {method === 'applepay' && <div id="sq-apple-pay" style={{ minHeight: 48 }} />}
      {method === 'googlepay' && <div id="sq-google-pay" style={{ minHeight: 48 }} />}
      {method === 'cashapp' && <div id="sq-cash-app-pay" style={{ minHeight: 48 }} />}
      {err && <div className="cx-err">{err}</div>}
      <p className="cx-note"><Lock size={12} /> Card details are entered into Square's encrypted fields — they never touch our servers. Coins are credited after Square confirms the payment.</p>
    </div>
  );
}
