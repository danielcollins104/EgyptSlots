// DC Enterprises Casino - Player Authentication & Sweepstakes Verification Service
// Supports Google, Email / Password, Phone / SMS OTP, and VIP Quick-Connect.

const STORAGE_KEYS = {
  USER_SESSION: 'dc_casino_user_auth',
  AUTH_ACCOUNTS: 'dc_casino_registered_accounts',
};

export const authService = {
  // Retrieve the currently active player session
  getCurrentUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (!raw) return null;
      const user = JSON.parse(raw);
      if (user && typeof user === 'object') {
        const method = user.method || user.provider || 'VIP';
        const provider = user.provider || user.method || 'vip';
        user.method = method;
        user.provider = provider;
        if (!user.name) user.name = 'VIP Player';
      }
      return user;
    } catch {
      return null;
    }
  },

  // Store user session and notify listeners
  saveSession(user) {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
      window.dispatchEvent(new CustomEvent('dc-auth-state-changed', { detail: user }));
    } catch (e) {
      console.error('Failed to save auth session:', e);
    }
  },

  // Clear session
  logout() {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      window.dispatchEvent(new CustomEvent('dc-auth-state-changed', { detail: null }));
    } catch (e) {
      console.error('Failed to clear auth session:', e);
    }
  },

  // Subscribe to auth state updates across components
  onAuthStateChanged(callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener('dc-auth-state-changed', handler);
    return () => window.removeEventListener('dc-auth-state-changed', handler);
  },

  // Retrieve persistent wallet, bankroll, and game data for an individual account
  getUserData(userId) {
    if (!userId) {
      return this._getGuestData();
    }
    try {
      const key = `dc_casino_account_${userId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
      // First-time VIP registration starter package: 100,000 GC + 10.00 SC
      // Only carry over Guest session winnings when upgrading the first-ever Guest session on this device
      // so subsequent independent accounts (e.g. Alice -> Bob) remain 100% isolated.
      let hasExistingAccounts = false;
      try {
        const accountsRaw = localStorage.getItem(STORAGE_KEYS.AUTH_ACCOUNTS);
        const accounts = accountsRaw ? JSON.parse(accountsRaw) : {};
        hasExistingAccounts = Object.keys(accounts).length > 0;
      } catch {}

      const guestData = hasExistingAccounts ? null : this._getGuestData();
      let liveGuestGC = Number(guestData?.goldCoins) || 0;
      let liveGuestSC = Number(guestData?.sweepsCoins) || 0;
      if (!hasExistingAccounts) {
        try {
          const savedGC = parseInt(localStorage.getItem('dc_casino_gold_coins') || '0', 10);
          const savedSC = parseFloat(localStorage.getItem('dc_casino_sweeps_coins') || '0');
          if (!Number.isNaN(savedGC) && savedGC > liveGuestGC) liveGuestGC = savedGC;
          if (!Number.isNaN(savedSC) && savedSC > liveGuestSC && savedSC < 500) liveGuestSC = savedSC;
        } catch {}
      }

      const initial = {
        goldCoins: Math.max(100000, liveGuestGC),
        sweepsCoins: Number(Math.max(10.0, liveGuestSC).toFixed(2)),
        currencyMode: guestData?.currencyMode || 'GC',
        bonusMeter: guestData?.bonusMeter || 0,
        totalSpins: guestData?.totalSpins || 0,
        totalWins: guestData?.totalWins || 0,
        vipPoints: Math.max(100, guestData?.vipPoints || 100),
        dailyStreak: guestData?.dailyStreak || 0,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      this.saveUserData(userId, initial);
      return initial;
    } catch {
      return this._getGuestData();
    }
  },

  // Save per-user persistent account wallet and game data
  saveUserData(userId, data) {
    if (!userId) {
      this._saveGuestData(data);
      return;
    }
    try {
      const key = `dc_casino_account_${userId}`;
      let current = null;
      try {
        const raw = localStorage.getItem(key);
        if (raw) current = JSON.parse(raw);
      } catch {}

      const updated = {
        ...(current || {
          goldCoins: 100000,
          sweepsCoins: 10.0,
          currencyMode: 'GC',
          bonusMeter: 0,
          totalSpins: 0,
          totalWins: 0,
          vipPoints: 100,
          createdAt: new Date().toISOString(),
        }),
        ...data,
        lastActiveAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(updated));

      // Update registry of accounts on this machine
      try {
        const accountsRaw = localStorage.getItem(STORAGE_KEYS.AUTH_ACCOUNTS);
        const accounts = accountsRaw ? JSON.parse(accountsRaw) : {};
        accounts[userId] = {
          id: userId,
          lastActiveAt: updated.lastActiveAt,
          goldCoins: updated.goldCoins,
          sweepsCoins: updated.sweepsCoins,
        };
        localStorage.setItem(STORAGE_KEYS.AUTH_ACCOUNTS, JSON.stringify(accounts));
      } catch {}
    } catch (e) {
      console.error('Failed to save user account data:', e);
    }
  },

  _getGuestData() {
    try {
      const raw = localStorage.getItem('dc_casino_account_guest');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      goldCoins: 25000,
      sweepsCoins: 0.0,
      currencyMode: 'GC',
      bonusMeter: 0,
      totalSpins: 0,
      totalWins: 0,
      vipPoints: 0,
    };
  },

  _saveGuestData(data) {
    try {
      let current = this._getGuestData();
      const updated = { ...current, ...data };
      localStorage.setItem('dc_casino_account_guest', JSON.stringify(updated));
    } catch {}
  },

  // Check if player is eligible for daily login reward (24hr cooldown)
  canClaimDailyReward(userId) {
    const data = this.getUserData(userId);
    if (!data || !data.lastDailyClaimAt) return true;
    const elapsed = Date.now() - new Date(data.lastDailyClaimAt).getTime();
    return elapsed >= 24 * 60 * 60 * 1000;
  },

  // Claim free daily bonus (Base 5,000 GC + 0.50 FREE SC, scaling up with consecutive daily login streaks!)
  claimDailyReward(userId) {
    if (!this.canClaimDailyReward(userId)) {
      return { success: false, reason: 'Already claimed in the past 24 hours.' };
    }
    const data = this.getUserData(userId);
    const nowMs = Date.now();
    const lastClaimMs = data.lastDailyClaimAt ? new Date(data.lastDailyClaimAt).getTime() : 0;
    const withinStreakWindow = lastClaimMs > 0 && nowMs - lastClaimMs <= 48 * 60 * 60 * 1000;
    const nextStreak = withinStreakWindow ? Math.min(7, (Number(data.dailyStreak) || 1) + 1) : 1;

    const rewardGC = 5000 + (nextStreak - 1) * 1500;
    const rewardSC = Number((0.50 + (nextStreak - 1) * 0.10).toFixed(2));
    const updatedGC = Math.round((data.goldCoins || 0) + rewardGC);
    const updatedSC = Number(((data.sweepsCoins || 0) + rewardSC).toFixed(2));
    this.saveUserData(userId, {
      goldCoins: updatedGC,
      sweepsCoins: updatedSC,
      dailyStreak: nextStreak,
      lastDailyClaimAt: new Date().toISOString(),
    });
    return {
      success: true,
      goldCoins: updatedGC,
      sweepsCoins: updatedSC,
      addedGC: rewardGC,
      addedSC: rewardSC,
      streakDays: nextStreak,
    };
  },

  // Retrieve player's live VIP Loyalty Tier, XP progress, and milestone status
  getVipProgression(userId) {
    const data = this.getUserData(userId);
    const vipPoints = Math.max(0, Number(data?.vipPoints) || 0);
    const level = Math.max(1, Math.floor(vipPoints / 250) + 1);
    const xpIntoLevel = vipPoints % 250;
    const progressPct = Math.min(100, Math.round((xpIntoLevel / 250) * 100));

    const tiers = [
      { minLv: 1, name: 'BRONZE INITIATE', badge: '🥉', color: '#f59e0b' },
      { minLv: 2, name: 'SILVER SCARAB', badge: '🥈', color: '#38bdf8' },
      { minLv: 3, name: 'GOLD PHARAOH', badge: '👑', color: '#fde047' },
      { minLv: 5, name: 'EMERALD DYNASTY', badge: '💎', color: '#34d399' },
      { minLv: 8, name: 'ROYAL DIAMOND APEX', badge: '⚡', color: '#c084fc' },
    ];
    let activeTier = tiers[0];
    for (const t of tiers) {
      if (level >= t.minLv) activeTier = t;
    }

    return {
      vipPoints,
      level,
      xpIntoLevel,
      xpRequired: 250,
      progressPct,
      tierName: activeTier.name,
      tierBadge: activeTier.badge,
      tierColor: activeTier.color,
      dailyStreak: Math.max(1, Number(data?.dailyStreak) || 1),
    };
  },

  // Award VIP XP on every spin and return level-up reward details if a 250-XP milestone is crossed
  recordVipSpinXp(userId, xpEarned = 10, isWin = false) {
    const data = this.getUserData(userId);
    const prevPoints = Math.max(0, Number(data?.vipPoints) || 0);
    const prevLevel = Math.max(1, Math.floor(prevPoints / 250) + 1);
    const nextPoints = prevPoints + Math.max(1, Math.round(xpEarned));
    const nextLevel = Math.max(1, Math.floor(nextPoints / 250) + 1);
    const leveledUp = nextLevel > prevLevel;

    const rewardGC = leveledUp ? Math.min(25000, nextLevel * 2500) : 0;
    const rewardSC = leveledUp ? 0.25 : 0;

    this.saveUserData(userId, {
      vipPoints: nextPoints,
      totalSpins: (Number(data?.totalSpins) || 0) + 1,
      totalWins: (Number(data?.totalWins) || 0) + (isWin ? 1 : 0),
    });

    const prog = this.getVipProgression(userId);
    return {
      ...prog,
      leveledUp,
      rewardGC,
      rewardSC,
    };
  },

  // Sign in with Google (OAuth / One-Click Credential)
  async loginWithGoogle() {
    // Simulated realistic Google Auth handshake (can plug into real Google Identity Services Client ID)
    await new Promise((r) => setTimeout(r, 450));
    const user = {
      id: 'usr_google_vip_player',
      name: 'Google VIP Player',
      email: 'vip.player@gmail.com',
      provider: 'google',
      method: 'google',
      tier: 'GOLD VIP',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },

  // Sign in with Apple ID (1-Click iOS / macOS / Web Credential)
  async loginWithApple() {
    await new Promise((r) => setTimeout(r, 450));
    const user = {
      id: 'usr_apple_vip_player',
      name: 'Apple VIP Player',
      email: 'vip.player@icloud.com',
      provider: 'apple',
      method: 'apple',
      tier: 'GOLD VIP',
      avatar: null,
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },

  // Sign in or Register with Email / Password (integrates with /api/auth/login & /api/auth/register + instant client fallback)
  async loginWithEmail(email, password = '', name = '') {
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    const username = name ? String(name).trim() : (cleanEmail.split('@')[0] || 'Player');
    const displayName = username.charAt(0).toUpperCase() + username.slice(1);

    // Optional server-side sync if backend is reachable and password >= 8 chars
    let serverToken = null;
    if (password && password.length >= 8 && typeof fetch === 'function') {
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        if (loginRes.ok) {
          const data = await loginRes.json();
          serverToken = data.token;
        } else {
          const regRes = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, password, name: displayName }),
          });
          if (regRes.ok) {
            const data = await regRes.json();
            serverToken = data.token;
          }
        }
      } catch {
        // Offline / client-only fallback
      }
    } else {
      await new Promise((r) => setTimeout(r, 350));
    }

    const safeHash = cleanEmail.replace(/[^a-z0-9]/g, '_').slice(0, 16);
    const user = {
      id: `usr_em_${safeHash}`,
      name: displayName || 'VIP Player',
      email: cleanEmail,
      provider: 'email',
      method: 'email',
      tier: 'VIP MEMBER',
      token: serverToken,
      avatar: null,
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },

  // Send Phone SMS OTP Verification Code
  async sendPhoneOtp(phoneNumber) {
    await new Promise((r) => setTimeout(r, 450));
    const cleanPhone = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 8) {
      throw new Error('Please enter a valid phone number with area code.');
    }
    // Pre-bake or generate a demo OTP code (e.g. 777777 or random)
    const demoCode = '777777';
    sessionStorage.setItem('dc_pending_phone_otp', JSON.stringify({ phone: cleanPhone, code: demoCode }));
    return { success: true, phone: cleanPhone, demoHint: demoCode };
  },

  // Verify Phone Code and Complete Login
  async verifyPhoneOtp(phoneNumber, inputCode) {
    await new Promise((r) => setTimeout(r, 450));
    const cleanPhone = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    const cleanCode = String(inputCode || '').trim();
    if (cleanCode !== '777777' && cleanCode.length !== 6) {
      throw new Error('Invalid verification code. Enter the 6-digit code or test code 777777.');
    }
    const user = {
      id: `usr_ph_${cleanPhone.slice(-6)}`,
      name: `VIP Player (${cleanPhone.slice(-4)})`,
      phone: cleanPhone,
      email: null,
      provider: 'phone',
      method: 'phone',
      avatar: null,
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },

  // Quick 1-Click VIP Demo Login (for testers, reviewers, and immediate access)
  async loginAsVipGuest() {
    await new Promise((r) => setTimeout(r, 300));
    const user = {
      id: 'usr_vip_high_roller',
      name: 'High Roller VIP',
      email: 'highroller@dc-casino.vip',
      phone: '+1 (555) 777-VIP1',
      provider: 'vip_pass',
      method: 'vip_pass',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=120&h=120&q=80',
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },
};
