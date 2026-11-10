/**
 * DC Enterprises Casino — Operator (Admin) Authentication Service
 *
 * Server-authoritative admin sessions for the Payout Center.
 *
 * Security model:
 * - The operator key (DC_ADMIN_SECRET) lives ONLY on the server
 *   (Cloudflare Worker secret / process.env). It is never shipped in the bundle.
 * - Login exchanges the key for a high-entropy, 4-hour server session token
 *   (POST /api/admin/login). The token is stored in sessionStorage only
 *   (cleared when the browser tab closes) — never localStorage.
 * - Every payout action re-validates the token server-side; the redemption
 *   queue endpoints reject anything without a valid ADMIN session.
 * - FAIL CLOSED: if the admin API is unreachable, the Payout Center stays
 *   locked. There is no client-side bypass.
 */

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_API_BASE) ||
  (typeof window !== 'undefined' && window.location.origin) ||
  '';

const SESSION_KEY = 'dc_admin_console_session';

// Treat tokens as expired 60s early so a request never dies mid-flight
const EXPIRY_SKEW_MS = 60 * 1000;

const readSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.token || !session.expiresAt) return null;
    if (Date.now() > session.expiresAt - EXPIRY_SKEW_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
};

export const adminAuthService = {
  /**
   * Current locally-valid session (not yet re-verified with the server), or null
   */
  getSession() {
    return readSession();
  },

  getToken() {
    return readSession()?.token || null;
  },

  isAuthenticated() {
    return readSession() !== null;
  },

  authHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  /**
   * Exchange the operator key for a server-issued admin session token.
   * Throws with a human-readable message on failure.
   */
  async login(adminKey) {
    const key = String(adminKey || '').trim();
    if (!key) throw new Error('Enter your operator key.');

    let response;
    try {
      response = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: key }),
      });
    } catch {
      throw new Error(
        'Admin server unreachable. The Payout Center stays locked when it cannot verify credentials with the server.'
      );
    }

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok || !data.success || !data.token) {
      throw new Error(data.error || 'Invalid operator credentials.');
    }

    const session = {
      token: data.token,
      user: data.user || { name: 'Operator', role: 'ADMIN' },
      expiresAt: Number(data.expiresAt) || Date.now() + 4 * 60 * 60 * 1000,
      issuedAt: Date.now(),
    };
    saveSession(session);
    return session;
  },

  /**
   * Re-validate the stored session against the server.
   * Returns 'valid' | 'invalid' | 'unreachable'.
   * 'invalid' also clears the local session.
   */
  async verify() {
    const session = readSession();
    if (!session) return 'invalid';

    let response;
    try {
      response = await fetch(`${API_BASE}/api/admin/verify`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } catch {
      return 'unreachable';
    }

    if (response.ok) {
      try {
        const data = await response.json();
        if (data?.expiresAt) {
          saveSession({ ...session, expiresAt: Number(data.expiresAt) });
        }
      } catch {}
      return 'valid';
    }

    if (response.status === 401 || response.status === 403) {
      clearSession();
      return 'invalid';
    }
    return 'unreachable';
  },

  /**
   * Revoke the session server-side and clear it locally
   */
  async logout() {
    const session = readSession();
    clearSession();
    if (session?.token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
      } catch {}
    }
  },
};
