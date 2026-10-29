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
} from 'lucide-react';
import { authService } from '../services/authService';
import { soundEngine } from '../audio/soundEngine';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  reason = 'sc_toggle', // 'sc_toggle' | 'sc_spin' | 'header_click'
}) {
  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'email' | 'phone'
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [phoneStep, setPhoneStep] = useState('enter_phone'); // 'enter_phone' | 'enter_otp'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successUser, setSuccessUser] = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    soundEngine.playButtonClick(480);
    setErrorMsg('');
    setPhoneStep('enter_phone');
    onClose();
  };

  const handleGoogleLogin = async () => {
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

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      soundEngine.playButtonClick(700);
      setLoading(true);
      setErrorMsg('');
      const user = await authService.loginWithEmail(emailInput, passwordInput);
      handleAuthComplete(user);
    } catch (err) {
      setErrorMsg(err.message || 'Email sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOtp = async (e) => {
    e.preventDefault();
    try {
      soundEngine.playButtonClick(700);
      setLoading(true);
      setErrorMsg('');
      const res = await authService.sendPhoneOtp(phoneInput);
      setPhoneStep('enter_otp');
      setOtpInput(res.demoHint || '');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send SMS code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
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
      onLoginSuccess(user);
      onClose();
      setSuccessUser(null);
    }, 1100);
  };

  return (
    <div className="dc-auth-modal-backdrop" onClick={handleClose}>
      <div
        className="dc-auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Glowing Top Frame Accent */}
        <div className="auth-modal-glow-bar" />

        {/* Modal Header */}
        <div className="auth-modal-header">
          <div className="auth-header-left">
            <div className="auth-shield-badge">
              <ShieldCheck size={22} className="shield-icon" />
              <Crown size={12} className="shield-crown" />
            </div>
            <div>
              <h3 className="auth-modal-title">VIP PLAYER VERIFICATION</h3>
              <p className="auth-modal-subtitle">
                {reason === 'sc_spin'
                  ? 'Sign in to spin for real cash prizes ($1.00 USD / 1 SC)'
                  : 'Login required to unlock Sweeps Coins (SC) mode & real cash redemptions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="auth-modal-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* VIP Perks Bar */}
        <div className="auth-perks-ribbon">
          <div className="perk-chip">
            <Sparkles size={13} className="perk-icon gold" />
            <span>Real Cash Prize Redemptions</span>
          </div>
          <div className="perk-chip">
            <Lock size={13} className="perk-icon cyan" />
            <span>256-Bit Bank Encryption</span>
          </div>
          <div className="perk-chip">
            <Zap size={13} className="perk-icon magenta" />
            <span>Instant SC Activation</span>
          </div>
        </div>

        {/* Success Splash Screen */}
        {successUser ? (
          <div className="auth-success-screen">
            <div className="success-icon-burst">
              <CheckCircle2 size={54} className="success-check-icon" />
            </div>
            <h4 className="success-title">VIP VERIFIED SUCCESSFULLY!</h4>
            <p className="success-sub">
              Welcome, <strong>{successUser.name}</strong>. Sweeps Coins (SC) mode is now unlocked!
            </p>
            <div className="success-loading-bar">
              <div className="success-loading-fill" />
            </div>
          </div>
        ) : (
          <>
            {/* Auth Method Navigation Tabs */}
            <div className="auth-nav-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'google' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(540);
                  setActiveTab('google');
                  setErrorMsg('');
                }}
              >
                <svg className="google-icon-svg" viewBox="0 0 24 24" width="16" height="16">
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
                <span>Google</span>
              </button>

              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'email' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(540);
                  setActiveTab('email');
                  setErrorMsg('');
                }}
              >
                <Mail size={16} />
                <span>Email</span>
              </button>

              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'phone' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(540);
                  setActiveTab('phone');
                  setErrorMsg('');
                }}
              >
                <Smartphone size={16} />
                <span>Phone / SMS</span>
              </button>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="auth-error-banner">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab 1: Google One-Click Auth */}
            {activeTab === 'google' && (
              <div className="auth-tab-content google-tab">
                <div className="auth-info-card">
                  <div className="info-card-spark">⚡</div>
                  <div>
                    <h5 className="info-title">Fastest 1-Click Verification</h5>
                    <p className="info-desc">
                      Instantly connect with your Google account. Zero passwords required.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="auth-google-cta-btn"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg className="google-icon-large" viewBox="0 0 24 24" width="22" height="22">
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
                  <span>{loading ? 'Connecting Google Account...' : 'Continue with Google'}</span>
                  <ArrowRight size={18} className="btn-arrow" />
                </button>
              </div>
            )}

            {/* Tab 2: Email Sign-In */}
            {activeTab === 'email' && (
              <form className="auth-tab-content email-form" onSubmit={handleEmailLogin}>
                <div className="auth-input-group">
                  <label htmlFor="auth-email-input">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="auth-email-input"
                      type="email"
                      placeholder="player@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label htmlFor="auth-password-input">Password (Optional for Magic Link)</label>
                  <div className="input-with-icon">
                    <KeyRound size={16} className="input-icon" />
                    <input
                      id="auth-password-input"
                      type="password"
                      placeholder="••••••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading || !emailInput}
                >
                  <Mail size={18} />
                  <span>{loading ? 'Verifying...' : 'Sign In with Email'}</span>
                  <ArrowRight size={18} className="btn-arrow" />
                </button>
              </form>
            )}

            {/* Tab 3: Phone / SMS Sign-In */}
            {activeTab === 'phone' && (
              <div className="auth-tab-content phone-tab">
                {phoneStep === 'enter_phone' ? (
                  <form onSubmit={handleSendPhoneOtp}>
                    <div className="auth-input-group">
                      <label htmlFor="auth-phone-input">Mobile Phone Number</label>
                      <div className="input-with-icon">
                        <Smartphone size={16} className="input-icon" />
                        <input
                          id="auth-phone-input"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <small className="input-helper">We will send a 6-digit SMS verification code.</small>
                    </div>

                    <button
                      type="submit"
                      className="auth-submit-btn"
                      disabled={loading || phoneInput.length < 8}
                    >
                      <Smartphone size={18} />
                      <span>{loading ? 'Sending Code...' : 'Send SMS Verification Code'}</span>
                      <ArrowRight size={18} className="btn-arrow" />
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyPhoneOtp}>
                    <div className="auth-input-group">
                      <label htmlFor="auth-otp-input">Enter 6-Digit SMS Code</label>
                      <div className="input-with-icon">
                        <KeyRound size={16} className="input-icon" />
                        <input
                          id="auth-otp-input"
                          type="text"
                          maxLength={6}
                          placeholder="777777"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          required
                          autoFocus
                          className="otp-digit-input"
                        />
                      </div>
                      <small className="input-helper">
                        Sent to {phoneInput} • Test code: <strong style={{ color: '#00ffff' }}>777777</strong>
                      </small>
                    </div>

                    <div className="phone-step-actions">
                      <button
                        type="button"
                        className="btn-back-link"
                        onClick={() => setPhoneStep('enter_phone')}
                      >
                        Change Number
                      </button>

                      <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={loading || otpInput.length < 6}
                      >
                        <CheckCircle2 size={18} />
                        <span>{loading ? 'Verifying Code...' : 'Confirm & Unlock SC'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Quick VIP Instant Demo Pass Divider */}
            <div className="auth-or-divider">
              <span>OR 1-CLICK INSTANT PASS</span>
            </div>

            <button
              type="button"
              className="auth-vip-guest-cta"
              onClick={handleQuickVipLogin}
              disabled={loading}
              title="Instant 1-Click High Roller VIP Pass"
            >
              <Crown size={17} className="vip-crown-icon" />
              <span>Instant High Roller VIP Pass (1-Click)</span>
              <span className="vip-instant-tag">INSTANT ACCESS</span>
            </button>

            {/* Regulatory Compliance Footer */}
            <p className="auth-legal-footer">
              By signing in, you confirm you are 18+ years of age (19+ in AL/NE, 21+ in MS) and agree to our
              Sweepstakes Rules and Terms of Service. No purchase necessary to play or win.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
