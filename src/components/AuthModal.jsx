import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Mail,
  Smartphone,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Crown,
  KeyRound,
  Zap,
  Gift,
  Coins,
  Gem,
  User,
} from 'lucide-react';
import { authService } from '../services/authService';
import { soundEngine } from '../audio/soundEngine';
import PrivacyTermsModal from './PrivacyTermsModal';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  reason = 'sc_toggle', // 'sc_toggle' | 'sc_spin' | 'header_click'
}) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'phone'
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [phoneStep, setPhoneStep] = useState('enter_phone'); // 'enter_phone' | 'enter_otp'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successUser, setSuccessUser] = useState(null);
  // Default termsAgreed to true so 1-click social/VIP login never blocks or fails
  const [termsAgreed, setTermsAgreed] = useState(() => {
    try {
      const saved = localStorage.getItem('dc_terms_agreed');
      return saved === 'false' ? false : true;
    } catch {
      return true;
    }
  });
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    soundEngine.playButtonClick(480);
    setErrorMsg('');
    setPhoneStep('enter_phone');
    onClose();
  };

  const ensureTermsAccepted = () => {
    if (!termsAgreed) {
      setTermsAgreed(true);
    }
    try {
      localStorage.setItem('dc_terms_agreed', 'true');
    } catch (_) {}
    return true;
  };

  const handleGoogleLogin = async () => {
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(720);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.loginWithGoogle();
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(740);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.loginWithApple();
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Apple sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(700);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.loginWithEmail(emailInput, passwordInput, nameInput);
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Email sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e) => {
    e.preventDefault();
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(700);
      setLoading(true);
      setErrorMsg('');
      const res = await authService.sendPhoneOtp(phoneInput);
      setPhoneStep('enter_otp');
      setOtpInput(res.demoHint || '777777');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send SMS code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(760);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.verifyPhoneOtp(phoneInput, otpInput);
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Invalid SMS code.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVipLogin = async () => {
    ensureTermsAccepted();
    try {
      soundEngine.playButtonClick(880);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.loginAsVipGuest();
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthComplete = (user) => {
    setSuccessUser(user);
    soundEngine.playBigWinCelebration?.('mini');
    setTimeout(() => {
      if (onLoginSuccess) onLoginSuccess(user);
      onClose();
      setSuccessUser(null);
    }, 850);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      style={{ zIndex: 99999 }}
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-[#18122B] via-[#0F0B1D] to-[#080610] border-2 border-[#ffd700]/45 rounded-2xl shadow-[0_0_55px_rgba(255,215,0,0.28)] text-white overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Top Shimmer Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#ffd700] via-[#00e5ff] to-[#ffd700]" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd700] to-[#d97706] flex items-center justify-center shadow-[0_0_15px_rgba(255,215,0,0.4)]">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#ffe875] via-[#ffd700] to-[#ffae00]">
                VIP CASINO CLUB LOGIN
              </h3>
              <p className="text-[11px] text-white/70">
                {reason === 'sc_spin'
                  ? 'Sign in to spin for Real Cash Prizes ($1.00 USD / 1 SC)'
                  : 'Sign in or create a free account to unlock Sweeps Coins (SC)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
            aria-label="Close Login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Welcome Bonus Banner (Pulsz / Chumba / Stake.us style) */}
        <div className="mx-5 mt-3.5 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-[#ffd700]/15 to-emerald-500/20 border border-emerald-400/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                INSTANT VIP WELCOME BONUS
              </div>
              <div className="text-xs font-black text-white flex items-center gap-1.5">
                <span className="text-[#ffd700]">100,000 GC</span>
                <span>+</span>
                <span className="text-emerald-400">10.00 FREE SC ($10 Value)</span>
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-black shrink-0">
            FREE
          </span>
        </div>

        <div className="p-5 space-y-4">
          {successUser ? (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </div>
              <h4 className="text-lg font-black text-emerald-300">
                WELCOME, {String(successUser.name || 'VIP PLAYER').toUpperCase()}!
              </h4>
              <p className="text-xs text-white/80">
                Your VIP Vault &amp; Sweeps Coins (SC) Mode are now unlocked!
              </p>
            </div>
          ) : (
            <>
              {/* 1-CLICK SOCIAL & INSTANT LOGIN BUTTONS (Top Priority like Stake.us / Pulsz) */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 transition-transform active:scale-98"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google (1-Click)</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAppleLogin}
                    disabled={loading}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-98"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    <span>Apple ID</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickVipLogin}
                    disabled={loading}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#ffd700] to-[#f59e0b] hover:from-[#ffe066] hover:to-[#fbbf24] text-black font-black text-xs shadow-[0_0_15px_rgba(255,215,0,0.3)] flex items-center justify-center gap-1.5 transition-transform active:scale-98"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Instant VIP Pass</span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/15"></div>
                <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  OR SIGN IN WITH EMAIL / SMS
                </span>
                <div className="flex-grow border-t border-white/15"></div>
              </div>

              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMsg('');
                    soundEngine.playButtonClick(520);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'login'
                      ? 'bg-[#ffd700] text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Email Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMsg('');
                    soundEngine.playButtonClick(520);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'register'
                      ? 'bg-[#ffd700] text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('phone');
                    setErrorMsg('');
                    soundEngine.playButtonClick(520);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMode === 'phone'
                      ? 'bg-[#ffd700] text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Phone SMS
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Email Login or Register Form */}
              {(authMode === 'login' || authMode === 'register') && (
                <form onSubmit={handleEmailSubmit} className="space-y-2.5">
                  {authMode === 'register' && (
                    <div>
                      <label className="block text-[11px] font-bold text-white/75 mb-1">
                        Player Display Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Pharaoh VIP"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/20 focus:border-[#ffd700] text-white text-xs sm:text-sm outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-white/75 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        placeholder="player@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/20 focus:border-[#ffd700] text-white text-xs sm:text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/75 mb-1">
                      Password {authMode === 'login' ? '(Optional for Instant Magic Login)' : ''}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/20 focus:border-[#ffd700] text-white text-xs sm:text-sm outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !emailInput}
                    className="w-full py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-98"
                  >
                    <span>
                      {loading
                        ? 'Signing In...'
                        : authMode === 'register'
                        ? 'Create Free VIP Account & Claim SC'
                        : 'Sign In & Unlock Sweeps Coins'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Phone SMS Form */}
              {authMode === 'phone' && (
                <div>
                  {phoneStep === 'enter_phone' ? (
                    <form onSubmit={handleSendPhoneOtp} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-white/75 mb-1">
                          Mobile Phone Number
                        </label>
                        <div className="relative">
                          <Smartphone className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            required
                            placeholder="+1 (555) 234-5678"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/20 focus:border-[#ffd700] text-white text-xs sm:text-sm outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || phoneInput.length < 8}
                        className="w-full py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 text-white shadow-lg flex items-center justify-center gap-2"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>{loading ? 'Sending SMS...' : 'Send 6-Digit SMS Code'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhoneOtp} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-white/75 mb-1">
                          Enter 6-Digit Code (Demo Code: 777777)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-400 text-center font-mono text-base font-black tracking-widest text-white outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPhoneStep('enter_phone')}
                          className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold text-white/80"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify &amp; Unlock SC</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Pre-checked Compliance Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-[11px] text-white/65 leading-snug">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => {
                      setTermsAgreed(e.target.checked);
                      try {
                        localStorage.setItem('dc_terms_agreed', String(e.target.checked));
                      } catch (_) {}
                    }}
                    className="mt-0.5 accent-[#ffd700] rounded"
                  />
                  <span>
                    I confirm I am 18+ and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPrivacyModalOpen(true);
                      }}
                      className="text-[#ffd700] underline hover:text-amber-300"
                    >
                      Sweepstakes Official Rules &amp; Terms
                    </button>
                    . No purchase necessary to play or win.
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        <PrivacyTermsModal
          isOpen={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
          onAccept={() => {
            setTermsAgreed(true);
            try {
              localStorage.setItem('dc_terms_agreed', 'true');
            } catch (_) {}
          }}
        />
      </div>
    </div>
  );
}
