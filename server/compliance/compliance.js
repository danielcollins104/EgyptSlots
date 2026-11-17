// ============================================================================
// COMPLIANCE: geo-blocking, age/KYC rules, limits
// ============================================================================
// All values are overridable via env so counsel-driven changes need no code edit.
//
//   GEO_ENFORCE            'true' (default in Worker) | 'false' (local dev)
//   ALLOWED_COUNTRIES      comma list, default 'US'
//   RESTRICTED_STATES      comma list of US state codes where SC play, purchases
//                          and redemptions are blocked. DEFAULT IS A CONSERVATIVE
//                          STARTING POINT ONLY — have your attorney confirm it.
//   MIN_AGE                default 18;  STATES_MIN_AGE_21 comma list (default none)
//   REQUIRE_KYC_FOR_REDEMPTION  default 'true'
//   MAX_SINGLE_DEPOSIT_USD / MAX_DAILY_DEPOSIT_USD / MAX_DAILY_REDEMPTION_USD
// ============================================================================

export const DEFAULT_RESTRICTED_STATES = [
  'WA', 'ID', 'NV', 'MI', 'MT', 'NJ', 'NY', 'CA', 'CT', 'LA', 'DE', 'KY',
];

const list = (v, dflt) =>
  v === undefined || v === null || v === ''
    ? dflt
    : String(v).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

const bool = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : String(v).toLowerCase() === 'true');
const num = (v, dflt) => (Number(v) > 0 ? Number(v) : dflt);

export function loadComplianceConfig(env = {}, defaults = {}) {
  return {
    geoEnforce: bool(env.GEO_ENFORCE, defaults.geoEnforce ?? false),
    allowedCountries: list(env.ALLOWED_COUNTRIES, ['US']),
    restrictedStates: list(env.RESTRICTED_STATES, DEFAULT_RESTRICTED_STATES),
    minAge: num(env.MIN_AGE, 18),
    statesMinAge21: list(env.STATES_MIN_AGE_21, []),
    requireKycForRedemption: bool(env.REQUIRE_KYC_FOR_REDEMPTION, true),
    maxSingleDepositUsd: num(env.MAX_SINGLE_DEPOSIT_USD, 50000),
    maxDailyDepositUsd: num(env.MAX_DAILY_DEPOSIT_USD, 50000),
    maxDailyRedemptionUsd: num(env.MAX_DAILY_REDEMPTION_USD, 25000),
  };
}

/** geo = { country, region } from Cloudflare request.cf (injected by the Worker) */
export function checkGeo(cfg, geo = {}) {
  if (!cfg.geoEnforce) return { allowed: true, reason: null };
  const country = String(geo.country || '').toUpperCase();
  const region = String(geo.region || '').toUpperCase();
  if (!country) return { allowed: false, reason: 'Your location could not be determined. Disable VPN/proxy and try again.' };
  if (!cfg.allowedCountries.includes(country)) {
    return { allowed: false, reason: 'Sweeps Coins play, purchases and prize redemptions are not available in your country.' };
  }
  if (country === 'US') {
    if (!region) return { allowed: false, reason: 'Your state could not be determined. Disable VPN/proxy and try again.' };
    if (cfg.restrictedStates.includes(region)) {
      return { allowed: false, reason: `Sweeps Coins play, purchases and prize redemptions are not available in ${region}.` };
    }
  }
  return { allowed: true, reason: null };
}

export function assertGeo(cfg, geo) {
  const r = checkGeo(cfg, geo);
  if (!r.allowed) {
    const e = new Error(r.reason);
    e.status = 451;
    throw e;
  }
}

export function ageOn(dobIso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dobIso || ''));
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age--;
  return age;
}

export function minAgeFor(cfg, state) {
  return cfg.statesMinAge21.includes(String(state || '').toUpperCase()) ? Math.max(21, cfg.minAge) : cfg.minAge;
}
