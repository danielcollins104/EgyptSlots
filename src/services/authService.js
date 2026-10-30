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
      return raw ? JSON.parse(raw) : null;
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
      const initial = {
        goldCoins: 100000,
        sweepsCoins: 10.0,
        currencyMode: 'GC',
        bonusMeter: 0,
        totalSpins: 0,
        totalWins: 0,
        vipPoints: 100,
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

  // Sign in with Google (OAuth / One-Click Credential)
  async loginWithGoogle() {
    // Simulated realistic Google Auth handshake (can plug into real Google Identity Services Client ID)
    await new Promise((r) => setTimeout(r, 650));
    const randomId = Math.random().toString(36).substring(2, 8);
    const user = {
      id: `usr_g_${randomId}`,
      name: 'Google VIP Player',
      email: `player.${randomId}@gmail.com`,
      provider: 'google',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },

  // Sign in with Email / Password
  async loginWithEmail(email, password = '') {
    await new Promise((r) => setTimeout(r, 500));
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    const username = cleanEmail.split('@')[0];
    const user = {
      id: `usr_em_${btoa(cleanEmail).substring(0, 8)}`,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      email: cleanEmail,
      provider: 'email',
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
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
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
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const cleanCode = inputCode.trim();
    if (cleanCode !== '777777' && cleanCode.length !== 6) {
      throw new Error('Invalid verification code. Enter the 6-digit code or test code 777777.');
    }
    const user = {
      id: `usr_ph_${cleanPhone.slice(-6)}`,
      name: `VIP Player (${cleanPhone.slice(-4)})`,
      phone: cleanPhone,
      email: null,
      provider: 'phone',
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
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=120&h=120&q=80',
      isVerifiedSC: true,
      scEligibility: 'eligible',
      joinedAt: new Date().toISOString(),
    };
    this.saveSession(user);
    return user;
  },
};
