// Thin client for the server-authoritative back office. The browser only REQUESTS actions and renders results;
// it never computes balances, prices, outcomes or approvals. Tokens live in sessionStorage (cleared with the tab).

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '';
const TOKEN_KEY = 'dc_api_session_v1';

export const sessionStore = {
  get() {
    try { return sessionStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
  },
  set(token) {
    try { token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY); } catch {}
  },
};

const newKey = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body, { idempotent = false } = {}) {
  const headers = { Accept: 'application/json' };
  const token = sessionStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotent) headers['Idempotency-Key'] = newKey();
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server.');
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data.success === false) {
    if (res.status === 401 && data.error?.code === 'AUTH_REQUIRED') sessionStore.set(null);
    throw new ApiError(res.status, data.error?.code || 'ERROR', data.error?.message || 'Request failed.');
  }
  return data;
}

export const api = {
  hasSession: () => Boolean(sessionStore.get()),
  async register(payload) { const d = await request('POST', '/api/auth/register', payload); sessionStore.set(d.token); return d; },
  async login(payload) { const d = await request('POST', '/api/auth/login', payload); sessionStore.set(d.token); return d; },
  async logout() { try { await request('POST', '/api/auth/logout', {}); } finally { sessionStore.set(null); } },
  stepUp: (password) => request('POST', '/api/auth/step-up', { password }),
  me: () => request('GET', '/api/me'),
  dailyFree: () => request('POST', '/api/promo/daily', {}),
  selfExclude: (days) => request('POST', '/api/account/self-exclude', { days }),
  ledger: () => request('GET', '/api/ledger'),

  packages: () => request('GET', '/api/payments/packages'),
  methods: () => request('GET', '/api/payments/methods'),
  createPayment: (p) => request('POST', '/api/payments/intents', p, { idempotent: true }),
  payment: (id) => request('GET', `/api/payments/intents/${encodeURIComponent(id)}`),
  payments: () => request('GET', '/api/payments/intents'),

  redemptionMethods: () => request('GET', '/api/redemptions/methods'),
  destinations: () => request('GET', '/api/redemptions/destinations'),
  addDestination: (p) => request('POST', '/api/redemptions/destinations', p),
  removeDestination: (id) => request('DELETE', `/api/redemptions/destinations/${encodeURIComponent(id)}`),
  redeem: (p) => request('POST', '/api/redemptions', p, { idempotent: true }),
  redemptions: () => request('GET', '/api/redemptions'),
  cancelRedemption: (id) => request('POST', `/api/redemptions/${encodeURIComponent(id)}/cancel`, {}),

  spin: (p) => request('POST', '/api/game/spin', p, { idempotent: true }),

  admin: {
    get: (path) => request('GET', `/api/admin/${path}`),
    post: (path, body) => request('POST', `/api/admin/${path}`, body || {}),
  },
};
