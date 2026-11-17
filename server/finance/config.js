/**
 * Finance backend configuration.
 *
 * Every secret comes from the server environment (never from the Vite bundle,
 * never from the repository). Anything not explicitly enabled stays disabled:
 * the payment/payout rails are opt-in so unsupported methods cannot affect the
 * rest of the application.
 */

// Jurisdictions where the dual-currency (GC/SC) model is restricted or contested.
// PROVISIONAL starting list - must be confirmed by gaming counsel before launch.
// Override with DC_BLOCKED_STATES="MN,WA,..." (comma separated USPS codes).
export const DEFAULT_BLOCKED_STATES = [
  'MN', // AG cease-and-desist orders to sweepstakes casinos (Nov 2025); legislation pending
  'WA', 'ID', 'MI', 'NV', 'MT', 'CT', 'NY', 'NJ', 'DE', 'LA', 'CA', 'MD', 'WV',
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD',
  'TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// Public token contract addresses. VERIFY against the issuer's documentation
// before enabling any network in production.
export const CRYPTO_NETWORKS = {
  base: {
    chainId: 8453,
    label: 'Base',
    confirmations: 20,
    tokens: {
      USDC: { contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    },
  },
  polygon: {
    chainId: 137,
    label: 'Polygon PoS',
    confirmations: 64,
    tokens: {
      USDC: { contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    },
  },
  ethereum: {
    chainId: 1,
    label: 'Ethereum',
    confirmations: 12,
    tokens: {
      USDC: { contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
      USDT: { contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    },
  },
};

const list = (v, fallback = []) =>
  v === undefined || v === '' ? fallback : String(v).split(',').map((s) => s.trim()).filter(Boolean);
const num = (v, fallback) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

export function loadConfig(env = process.env, overrides = {}) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const cfg = {
    nodeEnv,
    isProd,
    dbPath: env.DC_DB_PATH || './data/casino.db',
    ledgerSecret: env.DC_LEDGER_SECRET || (isProd ? null : 'dev-only-ledger-secret-not-for-production'),
    corsOrigins: list(env.DC_CORS_ORIGINS, isProd ? [] : ['http://localhost:5173', 'http://localhost:3001']),
    trustProxy: env.DC_TRUST_PROXY === 'true',

    compliance: {
      minAge: num(env.DC_MIN_AGE, 18),
      blockedStates: list(env.DC_BLOCKED_STATES, DEFAULT_BLOCKED_STATES).map((s) => s.toUpperCase()),
      welcomeGc: num(env.DC_WELCOME_GC, 10000),
      // Free Alternative Method of Entry (no purchase necessary) - one claim per UTC day.
      amoeDailyGc: num(env.DC_AMOE_DAILY_GC, 2000),
      amoeDailySc: num(env.DC_AMOE_DAILY_SC_CENTS, 20), // cents (0.20 SC)
    },

    game: {
      minSpinIntervalMs: num(env.DC_MIN_SPIN_INTERVAL_MS, 250),
      // Real-prize (SC) spins stay OFF in production until the certified RTP is verified and disclosed.
      scPlayEnabled: env.DC_SC_PLAY_ENABLED ? env.DC_SC_PLAY_ENABLED === 'true' : !isProd,
    },

    purchases: {
      minUsdCents: 100,
      maxUsdCents: num(env.DC_MAX_PURCHASE_USD_CENTS, 100000),
      dailyLimitUsdCents: num(env.DC_DAILY_PURCHASE_LIMIT_USD_CENTS, 100000),
      intentTtlMinutes: num(env.DC_INTENT_TTL_MINUTES, 60),
    },

    redemptions: {
      enabledMethods: list(env.DC_REDEMPTION_METHODS, ['crypto']),
      minScCents: num(env.DC_REDEEM_MIN_SC_CENTS, 5000),
      maxScCentsPerRequest: num(env.DC_REDEEM_MAX_SC_CENTS, 250000),
      dailyLimitScCents: num(env.DC_REDEEM_DAILY_SC_CENTS, 250000),
      maxRequestsPerDay: num(env.DC_REDEEM_MAX_PER_DAY, 3),
      destinationCoolingHours: num(env.DC_DESTINATION_COOLING_HOURS, 24),
      minAccountAgeHours: num(env.DC_REDEEM_MIN_ACCOUNT_AGE_HOURS, 24),
      // Requests at/above this amount need a SECOND, different admin to approve (dual control).
      dualControlScCents: num(env.DC_DUAL_CONTROL_SC_CENTS, 50000),
      reviewScCents: num(env.DC_REVIEW_SC_CENTS, 25000),
      payoutConfirmations: num(env.DC_PAYOUT_CONFIRMATIONS, 0), // 0 => use network default
    },

    admin: {
      stepUpWindowMinutes: 5,
      adjustMaxScCents: num(env.DC_ADMIN_ADJUST_MAX_SC_CENTS, 10000),
      adjustMaxGc: num(env.DC_ADMIN_ADJUST_MAX_GC, 1000000),
    },

    providers: {
      // 'sandbox' is hard-disabled in production by the registry regardless of this flag.
      enabled: list(env.DC_PAYMENT_PROVIDERS, isProd ? [] : ['sandbox']),
      sandboxWebhookSecret: env.DC_SANDBOX_WEBHOOK_SECRET || (isProd ? null : 'dev-only-sandbox-webhook-secret'),
      square: {
        environment: env.SQUARE_ENVIRONMENT || 'sandbox',
        accessToken: env.SQUARE_ACCESS_TOKEN || null,
        applicationId: env.SQUARE_APPLICATION_ID || null,
        locationId: env.SQUARE_LOCATION_ID || null,
        webhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY || null,
        webhookUrl: env.SQUARE_WEBHOOK_URL || null,
      },
    },

    crypto: {
      enabledNetworks: list(env.DC_CRYPTO_NETWORKS, []),
      // Receive-only address. Private keys NEVER live in this application.
      treasuryAddress: env.DC_CRYPTO_TREASURY_ADDRESS || null,
      rpcUrls: {
        base: env.DC_RPC_BASE || null,
        polygon: env.DC_RPC_POLYGON || null,
        ethereum: env.DC_RPC_ETHEREUM || null,
      },
    },
  };

  const merged = deepMerge(cfg, overrides);
  if (isProd && !merged.ledgerSecret) {
    throw new Error('DC_LEDGER_SECRET must be set in production');
  }
  return merged;
}

function deepMerge(a, b) {
  if (!b || typeof b !== 'object') return a;
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof a?.[k] === 'object' ? deepMerge(a[k], v) : v;
  }
  return out;
}
