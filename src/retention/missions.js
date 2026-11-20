// ============================================================================
// DAILY MISSIONS ENGINE — EgyptSlots retention (Phase 3)
// Pure logic, zero DOM/framework dependencies. Fully unit-testable.
// Awards hook into the SAME wallet credit path as handleClaimDailyBonus
// (App.jsx) via the onAward callback — no crediting logic lives here.
// ============================================================================

export const MISSIONS_CONFIG = {
  storagePrefix: 'egyptslots_missions_v1',
  /** Max free SC earnable from missions per local day (daily reward is separate). */
  scDailyCap: 1.0,
  /** Win-back threshold: player gone this many days gets comeback flag. */
  comebackAfterDays: 2,
  /** "Complete all missions today" bonus. */
  trioReward: { gc: 5000, sc: 0.25 },
  missions: [
    { id: 'spin_50',    title: 'SPIN MASTER',    desc: 'Spin 50 times today',                  metric: 'spins',    target: 50, reward: { gc: 2000, sc: 0.10 } },
    { id: 'bonus_2',    title: 'BONUS HUNTER',   desc: 'Trigger 2 bonus games today',          metric: 'bonuses',  target: 2,  reward: { gc: 5000, sc: 0.25 } },
    { id: 'bigwin_1',   title: 'HIGH ROLLER',    desc: 'Land a win of 10x your bet or more',   metric: 'bigWins',  target: 1,  reward: { gc: 3000, sc: 0.15 } },
    { id: 'both_modes', title: 'DUAL CURRENCY',  desc: 'Spin in both GC and SC modes today',   metric: 'modes',    target: 2,  reward: { gc: 1500, sc: 0.10 } },
  ],
};

/* ----------------------------- date helpers ----------------------------- */

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aKey, bKey) {
  const [ay, am, ad] = aKey.split('-').map(Number);
  const [by, bm, bd] = bKey.split('-').map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.floor((b - a) / 86400000);
}

/* ------------------------------ state core ------------------------------ */

function freshState(dateKey) {
  return {
    date: dateKey,
    lastVisit: dateKey,
    spins: 0,
    bonuses: 0,
    bigWins: 0,
    modes: {},          // { GC: true, SC: true }
    claimed: {},        // { missionId: true }
    scAwardedToday: 0,
    trioClaimed: false,
  };
}

function storageOrMemory(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_) {}
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
}

export function loadMissionsState(userId, storage) {
  const store = storageOrMemory(storage);
  const key = `${MISSIONS_CONFIG.storagePrefix}:${userId || 'guest'}`;
  const today = localDateKey();
  let comebackDue = false;

  let state = null;
  try {
    const raw = store.getItem(key);
    if (raw) state = JSON.parse(raw);
  } catch (_) { /* corrupted entry -> start fresh */ }

  if (!state || typeof state !== 'object') {
    state = freshState(today);
  } else {
    if (state.lastVisit && daysBetween(state.lastVisit, today) >= MISSIONS_CONFIG.comebackAfterDays) {
      comebackDue = true; // win-back hook for a comeback gift banner
    }
    if (state.date !== today) {
      // Daily reset: progress + claims refresh, SC cap resets
      state = { ...freshState(today), lastVisit: today };
    }
  }
  state.lastVisit = today;
  saveMissionsState(userId, state, storage);
  return { state, comebackDue };
}

export function saveMissionsState(userId, state, storage) {
  const store = storageOrMemory(storage);
  const key = `${MISSIONS_CONFIG.storagePrefix}:${userId || 'guest'}`;
  try {
    store.setItem(key, JSON.stringify(state));
  } catch (_) {}
}

/* ------------------------------ progression ------------------------------ */

/**
 * Record one evaluated spin. Returns { state, events } where events may
 * contain { type: 'mission_completed', mission } entries (sound/celebration cue).
 */
export function recordSpin(state, { mode = 'GC', winAmount = 0, betAmount = 0, bonusTriggered = false } = {}) {
  const next = { ...state, modes: { ...state.modes } };
  const events = [];
  const prevProgress = missionProgress(next);

  next.spins += 1;
  if (bonusTriggered) next.bonuses += 1;
  if (betAmount > 0 && winAmount >= betAmount * 10) next.bigWins += 1;
  if (mode === 'GC' || mode === 'SC') next.modes[mode] = true;

  MISSIONS_CONFIG.missions.forEach((m, i) => {
    if (!next.claimed[m.id] && prevProgress[i] < m.target && missionProgress(next)[i] >= m.target) {
      events.push({ type: 'mission_completed', mission: m });
    }
  });

  return { state: next, events };
}

function missionProgress(state) {
  return MISSIONS_CONFIG.missions.map((m) => {
    if (m.metric === 'modes') return Object.keys(state.modes).length;
    return state[m.metric] || 0;
  });
}

/** UI-ready view model. */
export function getMissionsView(state) {
  const progress = missionProgress(state);
  const list = MISSIONS_CONFIG.missions.map((m, i) => ({
    ...m,
    progress: Math.min(progress[i], m.target),
    complete: progress[i] >= m.target,
    claimed: !!state.claimed[m.id],
  }));
  const allClaimed = list.every((m) => m.claimed);
  return {
    list,
    trioReady: allClaimed && !state.trioClaimed,
    trioClaimed: state.trioClaimed,
    scRemainingToday: Math.max(0, MISSIONS_CONFIG.scDailyCap - state.scAwardedToday),
  };
}

/* -------------------------------- claiming ------------------------------- */

function tryClaim(state, reward, alreadyClaimedFlag) {
  if (state.scAwardedToday + (reward.sc || 0) > MISSIONS_CONFIG.scDailyCap + 1e-9) {
    return { error: 'sc_cap_reached' };
  }
  return null;
}

export function claimMission(state, missionId) {
  const m = MISSIONS_CONFIG.missions.find((x) => x.id === missionId);
  if (!m) return { state, error: 'unknown_mission' };
  if (state.claimed[missionId]) return { state, error: 'already_claimed' };
  const progress = missionProgress(state)[MISSIONS_CONFIG.missions.indexOf(m)];
  if (progress < m.target) return { state, error: 'not_complete' };

  const blocked = tryClaim(state, m.reward);
  if (blocked) return { state, ...blocked };

  const next = {
    ...state,
    claimed: { ...state.claimed, [missionId]: true },
    scAwardedToday: state.scAwardedToday + (m.reward.sc || 0),
  };
  return { state: next, reward: m.reward, mission: m };
}

export function claimTrio(state) {
  const view = getMissionsView(state);
  if (view.trioClaimed) return { state, error: 'already_claimed' };
  if (!view.trioReady) return { state, error: 'not_complete' };

  const blocked = tryClaim(state, MISSIONS_CONFIG.trioReward);
  if (blocked) return { state, ...blocked };

  const next = {
    ...state,
    trioClaimed: true,
    scAwardedToday: state.scAwardedToday + (MISSIONS_CONFIG.trioReward.sc || 0),
  };
  return { state: next, reward: MISSIONS_CONFIG.trioReward };
}
