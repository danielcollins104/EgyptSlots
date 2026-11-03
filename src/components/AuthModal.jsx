import React, { useState } from 'react';
import {
  X,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Crown,
  Zap,
  Gift,
} from 'lucide-react';
import { authService } from '../services/authService';
import { soundEngine } from '../audio/soundEngine';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  reason = 'sc_toggle',
}) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'phone'
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [phoneStep, setPhoneStep] = useState('enter_phone');
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

  const ensureTermsAccepted = () => {
    try {
      localStorage.setItem('dc_terms_agreed', 'true');
    } catch (_) {}
  };

  const handleAuthComplete = (user) => {
    setSuccessUser(user);
    soundEngine.playBigWinCelebration?.('mini');
    setTimeout(() => {
      if (onLoginSuccess) onLoginSuccess(user);
      onClose();
      setSuccessUser(null);
    }, 750);
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
      setErrorMsg(err.message || 'Google sign-in failed.');
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
      setErrorMsg(err.message || 'Apple sign-in failed.');
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

  return (
    <div className="sc-cashier-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="sc-auth-modal" onClick={(e) => e.stopPropagation()}>
        <header className="sc-cashier-header">
          <div className="sc-cashier-title-wrap">
            <div className="sc-cashier-logo-badge">
              <Crown size={20} />
            </div>
            <div>
              <h2 className="sc-cashier-title">VIP PLAYER SIGN IN</h2>
              <p className="sc-cashier-subtitle">
                {reason === 'sc_spin'
                  ? 'Sign in to spin with Sweeps Coins (1 SC = $1.00 USD)'
                  : 'Sign in or create a free account to unlock Sweeps Coins (SC)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sc-cashier-close-btn"
            onClick={handleClose}
            aria-label="Close Login"
          >
            <X size={20} />
          </button>
        </header>

        <div className="sc-auth-body">
          {successUser ? (
            <div className="sc-cashier-success-box">
              <CheckCircle2 size={48} className="sc-success-icon" />
              <h3>Welcome, {String(successUser.name || 'VIP Player')}!</h3>
              <p>Sweeps Coins (SC) Mode is now unlocked.</p>
            </div>
          ) : (
            <>
              <div className="sc-auth-bonus-banner">
                <Gift size={18} className="sc-emerald-icon" />
                <div>
                  <strong>FREE WELCOME BONUS INCLUDED</strong>
                  <span>1,000 Gold Coins + 10.00 FREE Sweeps Coins ($10 Value)</span>
                </div>
              </div>

              {errorMsg && (
                <div className="sc-error-banner">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1-Click Quick Sign-In Options */}
              <div className="sc-auth-social-stack">
                <button
                  type="button"
                  className="sc-auth-google-btn"
                  onClick={handleGoogleLogin}
                  disabled={loading}
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
                  <span>Continue with Google</span>
                </button>

                <div className="sc-auth-social-row">
                  <button
                    type="button"
                    className="sc-auth-apple-btn"
                    onClick={handleAppleLogin}
                    disabled={loading}
                  >
                    <span>Continue with Apple</span>
                  </button>

                  <button
                    type="button"
                    className="sc-auth-vip-btn"
                    onClick={handleQuickVipLogin}
                    disabled={loading}
                  >
                    <Zap size={15} />
                    <span>Instant Play (1-Click)</span>
                  </button>
                </div>
              </div>

              <div className="sc-auth-divider">
                <span>OR SIGN IN WITH EMAIL / PHONE</span>
              </div>

              <div className="sc-auth-mode-tabs">
                <button
                  type="button"
                  className={`sc-auth-mode-tab ${authMode !== 'phone' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMsg('');
                  }}
                >
                  <Mail size={14} />
                  <span>Email</span>
                </button>
                <button
                  type="button"
                  className={`sc-auth-mode-tab ${authMode === 'phone' ? 'active' : ''}`}
                  onClick={() => {
                    setAuthMode('phone');
                    setErrorMsg('');
                  }}
                >
                  <Smartphone size={14} />
                  <span>Mobile SMS</span>
                </button>
              </div>

              {authMode !== 'phone' ? (
                <form onSubmit={handleEmailSubmit} className="sc-auth-form">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Email address (e.g. player@email.com)"
                    className="sc-input"
                  />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Password"
                    className="sc-input"
                  />
                  <button type="submit" className="sc-submit-redeem-btn" disabled={loading}>
                    {loading ? 'Signing In...' : 'Sign In & Unlock Sweeps Coins'}
                  </button>
                </form>
              ) : phoneStep === 'enter_phone' ? (
                <form onSubmit={handleSendPhoneOtp} className="sc-auth-form">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Mobile number (e.g. 555-234-5678)"
                    className="sc-input"
                  />
                  <button type="submit" className="sc-submit-redeem-btn" disabled={loading}>
                    Send Verification Code
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtp} className="sc-auth-form">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="6-digit SMS code"
                    className="sc-input"
                  />
                  <button type="submit" className="sc-submit-redeem-btn" disabled={loading}>
                    Verify &amp; Play Now
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
