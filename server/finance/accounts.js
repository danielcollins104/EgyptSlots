import crypto from 'node:crypto';
import { AppError, bad, forbidden, newId, nowIso } from './ledger.js';
import { US_STATES } from './config.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const exp = Buffer.from(keyHex, 'hex');
  return exp.length === key.length && crypto.timingSafeEqual(exp, key);
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const ROLE_RANK = { PLAYER: 0, SUPPORT: 1, FINANCE: 2, ADMIN: 3 };

/** Accounts, sessions, RBAC and jurisdiction/age/KYC gating. */
export class Accounts {
  constructor({ db, ledger, audit, config }) {
    Object.assign(this, { db, ledger, audit, config });
  }

  // ---- registration / login ------------------------------------------------
  register({ email, password, name, dob, state }, ip = null) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) throw bad('INVALID_EMAIL', 'A valid email is required.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
      throw bad('WEAK_PASSWORD', 'Password must be 10-200 characters.');
    }
    const st = String(state || '').toUpperCase();
    if (!US_STATES.includes(st)) throw bad('INVALID_STATE', 'A valid US state of residence is required.');
    if (this.config.compliance.blockedStates.includes(st)) {
      throw forbidden('RESTRICTED_JURISDICTION', 'Sorry, this service is not available in your state.');
    }
    const age = ageFromDob(dob);
    if (age === null) throw bad('INVALID_DOB', 'Date of birth must be YYYY-MM-DD.');
    if (age < this.config.compliance.minAge) throw forbidden('UNDERAGE', `You must be at least ${this.config.compliance.minAge}.`);

    const id = newId('usr');
    const hash = hashPassword(password);
    try {
      this.db.tx(() => {
        this.db.run(
          'INSERT INTO users (id,email,password_hash,name,role,dob,state,created_at) VALUES (?,?,?,?,?,?,?,?)',
          id, cleanEmail, hash, String(name || cleanEmail.split('@')[0]).slice(0, 60), 'PLAYER', dob, st, nowIso()
        );
        this.ledger.createWallet(id);
        if (this.config.compliance.welcomeGc > 0) {
          this.ledger.post({ userId: id, type: 'WELCOME_GC', currency: 'GC', amount: this.config.compliance.welcomeGc, idempotencyKey: `welcome:${id}`, refType: 'user', refId: id });
        }
      });
    } catch (e) {
      if (/UNIQUE/.test(String(e.message))) throw new AppError(409, 'EMAIL_TAKEN', 'Registration could not be completed.');
      throw e;
    }
    this.audit.record({ actorId: id, actorRole: 'PLAYER', action: 'USER_REGISTERED', targetType: 'user', targetId: id, ip });
    return { user: this.publicUser(this.getUser(id)), ...this.createSession(id, ip) };
  }

  /** Creates a staff/admin account. Called ONLY from the CLI script, never from an HTTP route. */
  createStaff({ email, password, name, role }) {
    if (!['SUPPORT', 'FINANCE', 'ADMIN'].includes(role)) throw new Error('Invalid staff role');
    if (!password || password.length < 14) throw new Error('Staff passwords need 14+ characters');
    const id = newId('usr');
    this.db.tx(() => {
      this.db.run(
        "INSERT INTO users (id,email,password_hash,name,role,kyc_status,created_at) VALUES (?,?,?,?,?,'verified',?)",
        id, email.trim().toLowerCase(), hashPassword(password), name || email, role, nowIso()
      );
      this.ledger.createWallet(id);
    });
    this.audit.record({ actorId: 'CLI', action: 'STAFF_CREATED', targetType: 'user', targetId: id, details: { role } });
    return id;
  }

  _throttleKey(k) { return sha256(`login:${k}`); }
  _checkThrottle(key) {
    const t = this.db.get('SELECT * FROM auth_throttle WHERE key = ?', key);
    if (t?.locked_until && t.locked_until > nowIso()) throw new AppError(429, 'LOCKED', 'Too many failed attempts. Try again later.');
  }
  _fail(key) {
    this.db.run(
      `INSERT INTO auth_throttle (key,fails,locked_until) VALUES (?,1,NULL)
       ON CONFLICT(key) DO UPDATE SET fails = fails + 1,
         locked_until = CASE WHEN fails + 1 >= 5 THEN ? ELSE NULL END`,
      key, new Date(Date.now() + 15 * 60 * 1000).toISOString()
    );
  }

  login({ email, password }, ip = null) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    // Throttle per account AND per IP so one attacker cannot lock out a victim from everywhere.
    const keys = [this._throttleKey(`${cleanEmail}|${ip || ''}`), this._throttleKey(`ip:${ip || ''}`)];
    keys.forEach((k) => this._checkThrottle(k));
    const user = this.db.get('SELECT * FROM users WHERE email = ?', cleanEmail);
    // Always burn a hash to keep timing uniform for unknown emails.
    const ok = verifyPassword(String(password || ''), user?.password_hash || hashPassword('x'.repeat(12))) && user;
    if (!ok) {
      keys.forEach((k) => this._fail(k));
      throw new AppError(401, 'BAD_CREDENTIALS', 'Invalid email or password.');
    }
    if (user.status === 'closed') throw forbidden('ACCOUNT_CLOSED', 'Account closed.');
    this.db.run('DELETE FROM auth_throttle WHERE key = ?', keys[0]);
    this.audit.record({ actorId: user.id, actorRole: user.role, action: 'LOGIN', targetType: 'user', targetId: user.id, ip });
    return { user: this.publicUser(user), ...this.createSession(user.id, ip, user.role !== 'PLAYER') };
  }

  createSession(userId, ip = null, staff = false) {
    const token = `dcs_${crypto.randomBytes(32).toString('hex')}`;
    const ttl = staff ? 2 * 3600e3 : 12 * 3600e3;
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    this.db.run('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,ip) VALUES (?,?,?,?,?)', sha256(token), userId, nowIso(), expiresAt, ip);
    return { token, expiresAt };
  }

  logout(token) {
    if (token) this.db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  }

  /** Resolves a bearer token to {user, session}; throws 401 otherwise. Optional role gate. */
  authenticate(token, minRole = null) {
    if (!token || typeof token !== 'string') throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');
    const s = this.db.get('SELECT * FROM sessions WHERE token_hash = ?', sha256(token));
    if (!s || s.expires_at < nowIso()) throw new AppError(401, 'AUTH_REQUIRED', 'Session invalid or expired.');
    const user = this.getUser(s.user_id);
    if (!user || user.status === 'closed') throw new AppError(401, 'AUTH_REQUIRED', 'Session invalid.');
    if (minRole && ROLE_RANK[user.role] < ROLE_RANK[minRole]) throw forbidden('FORBIDDEN', 'Insufficient privileges.');
    return { user, session: s };
  }

  /** Password re-entry for sensitive actions. */
  stepUp(token, password) {
    const { user, session } = this.authenticate(token);
    const keys = [this._throttleKey(`stepup:${user.id}`)];
    this._checkThrottle(keys[0]);
    if (!verifyPassword(String(password || ''), user.password_hash)) {
      this._fail(keys[0]);
      throw new AppError(401, 'BAD_CREDENTIALS', 'Password incorrect.');
    }
    this.db.run('UPDATE sessions SET last_step_up_at = ? WHERE token_hash = ?', nowIso(), session.token_hash);
    return { stepUpUntil: new Date(Date.now() + this.config.admin.stepUpWindowMinutes * 60e3).toISOString() };
  }

  requireStepUp(session) {
    const fresh = session.last_step_up_at &&
      Date.now() - Date.parse(session.last_step_up_at) < this.config.admin.stepUpWindowMinutes * 60e3;
    if (!fresh) throw new AppError(401, 'STEP_UP_REQUIRED', 'Re-enter your password to continue.');
  }

  getUser(id) { return this.db.get('SELECT * FROM users WHERE id = ?', id); }

  publicUser(u) {
    return { id: u.id, email: u.email, name: u.name, role: u.role, state: u.state, kycStatus: u.kyc_status, status: u.status };
  }

  // ---- compliance gates ----------------------------------------------------
  assertCanPlay(user) {
    if (user.status !== 'active') throw forbidden('ACCOUNT_RESTRICTED', 'Account is restricted.');
    if (user.self_excluded_until && user.self_excluded_until > nowIso()) throw forbidden('SELF_EXCLUDED', 'Self-exclusion is active.');
    if (user.role === 'PLAYER' && this.config.compliance.blockedStates.includes(user.state)) {
      throw forbidden('RESTRICTED_JURISDICTION', 'Not available in your state.');
    }
  }
  assertCanPurchase(user) { this.assertCanPlay(user); }
  assertCanRedeem(user) {
    this.assertCanPlay(user);
    if (user.kyc_status !== 'verified') throw forbidden('KYC_REQUIRED', 'Identity verification is required before redeeming.');
    const ageH = (Date.now() - Date.parse(user.created_at)) / 3600e3;
    if (ageH < this.config.redemptions.minAccountAgeHours) throw forbidden('ACCOUNT_TOO_NEW', 'Account is too new to redeem.');
  }

  selfExclude(userId, days) {
    const d = Math.min(Math.max(1, days | 0), 3650);
    const until = new Date(Date.now() + d * 86400e3).toISOString();
    this.db.run('UPDATE users SET self_excluded_until = ? WHERE id = ?', until, userId);
    this.audit.record({ actorId: userId, actorRole: 'PLAYER', action: 'SELF_EXCLUDE', targetType: 'user', targetId: userId, details: { until } });
    return { until };
  }

  /** Free Alternative Method of Entry - daily, no purchase necessary. */
  claimDaily(user) {
    this.assertCanPlay(user);
    const c = this.config.compliance;
    const period = nowIso().slice(0, 10);
    return this.db.tx(() => {
      const r = this.db.run('INSERT OR IGNORE INTO promo_claims (user_id,promo_id,period_key,created_at) VALUES (?,?,?,?)', user.id, 'amoe_daily', period, nowIso());
      if (r.changes !== 1) throw new AppError(409, 'ALREADY_CLAIMED', 'Daily free entry already claimed.');
      const key = `amoe:${user.id}:${period}`;
      if (c.amoeDailyGc > 0) this.ledger.post({ userId: user.id, type: 'AMOE_GC', currency: 'GC', amount: c.amoeDailyGc, idempotencyKey: `${key}:GC`, refType: 'promo', refId: 'amoe_daily' });
      if (c.amoeDailySc > 0) this.ledger.post({ userId: user.id, type: 'AMOE_SC', currency: 'SC', amount: c.amoeDailySc, unplayedDelta: c.amoeDailySc, idempotencyKey: `${key}:SC`, refType: 'promo', refId: 'amoe_daily' });
      return { gc: c.amoeDailyGc, sc: c.amoeDailySc / 100 };
    });
  }

  balance(userId) {
    const w = this.ledger.getWallet(userId);
    return {
      gc: w.gc,
      sc: w.sc / 100,
      scOnHold: w.sc_hold / 100,
      scUnplayed: w.sc_unplayed / 100,
      scRedeemable: Math.max(0, w.sc - w.sc_unplayed) / 100,
    };
  }
}

export function ageFromDob(dob) {
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dob) return null;
  const n = new Date();
  let age = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}
