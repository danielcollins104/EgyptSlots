import React, { useState } from 'react';
import { X, ShieldCheck, Scale, FileText, AlertTriangle, CheckCircle, Lock, Coins, Gem, ChevronRight } from 'lucide-react';
import { CASINO_BRAND } from '../config/slotConfig';
import { SWEEPSTAKES_CONFIG } from '../config/sweepstakesConfig';

export default function PrivacyTermsModal({ isOpen, onClose, onAccept }) {
  const [activeSection, setActiveSection] = useState('liquidity'); // 'liquidity' | 'privacy' | 'terms' | 'sweeps'

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="privacy-terms-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-terms-title"
      >
        {/* Modal Header */}
        <div className="privacy-terms-header">
          <div className="header-left">
            <div className="brand-badge">
              <Scale size={14} className="scale-icon" />
              <span>{CASINO_BRAND?.casinoFullTitle || 'DC ENTERPRISES CASINO'} &bull; LEGAL &amp; COMPLIANCE</span>
            </div>
            <h2 id="privacy-terms-title" className="modal-title">
              Privacy Policy, Terms of Service &amp; Sweeps Rules
            </h2>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close legal modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="privacy-terms-nav">
          <button
            type="button"
            className={`nav-tab ${activeSection === 'liquidity' ? 'active' : ''}`}
            onClick={() => setActiveSection('liquidity')}
          >
            <AlertTriangle size={15} />
            <span>Payout &amp; Liquidity Policy</span>
            <span className="tab-pill-highlight">IMPORTANT</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeSection === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveSection('privacy')}
          >
            <Lock size={15} />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeSection === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveSection('terms')}
          >
            <FileText size={15} />
            <span>Terms of Service</span>
          </button>

          <button
            type="button"
            className={`nav-tab ${activeSection === 'sweeps' ? 'active' : ''}`}
            onClick={() => setActiveSection('sweeps')}
          >
            <ShieldCheck size={15} />
            <span>Sweepstakes Rules</span>
          </button>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="privacy-terms-body">
          {/* SECTION 1: PAYOUT, LIQUIDITY & EMERGING OPERATOR DISCLOSURE */}
          {activeSection === 'liquidity' && (
            <div className="legal-section-content">
              <div className="compliance-hero-callout">
                <AlertTriangle size={24} className="callout-alert-icon" />
                <div>
                  <h3 className="callout-title">Emerging Operator Prize Redemption &amp; Liquidity Schedule Disclosure</h3>
                  <p className="callout-sub">
                    Please read carefully: Full transparency regarding promotional prize redemption processing,
                    banking settlement windows, and operational liquidity reserves.
                  </p>
                </div>
              </div>

              <div className="legal-text-block highlight-block">
                <h4>1. Operational Reserves &amp; Settlement-Based Payouts</h4>
                <p>
                  <strong>DC Enterprises (&ldquo;Pharaoh&rsquo;s Chakra Dynasty&rdquo;)</strong> operates as an independent,
                  emerging sweepstakes gaming platform. Because we are a growing startup and emerging gaming studio,
                  all promotional Sweeps Coin prize redemptions are fulfilled and disbursed on a
                  <strong> rolling liquidity and cash-flow availability schedule</strong> as merchant processing,
                  banking settlement rails, and player purchase proceeds clear into our prize distribution reserves.
                </p>
                <p>
                  Unlike legacy multi-billion-dollar corporate gaming conglomerates, our redemptions are queued
                  and paid out in sequential batches <em>&ldquo;as funds become cleared and available&rdquo;</em> in our
                  operational merchant accounts. By participating in promotional Sweeps Coins gameplay, purchasing
                  Gold Coin packages, or requesting redemptions, you explicitly understand, acknowledge, and agree
                  to this liquidity schedule.
                </p>
              </div>

              <div className="legal-text-block">
                <h4>2. Standard Processing Windows &amp; Staged Tranches</h4>
                <ul>
                  <li>
                    <strong>Standard Verification Window:</strong> Redemptions undergo automated and manual anti-fraud,
                    identity verification, and gameplay auditing. Standard processing typically requires <strong>3 to 14 business days</strong>.
                  </li>
                  <li>
                    <strong>Staged High-Value Redemptions:</strong> To protect platform solvency and ensure equitable disbursement
                    across all community members, prize redemptions exceeding $2,500.00 USD may, at our discretion,
                    be fulfilled in scheduled weekly or bi-weekly tranches as merchant banking clearance completes.
                  </li>
                  <li>
                    <strong>No Unreasonable Forfeiture:</strong> Approved, verified redemptions remain queued in good standing
                    and are never arbitrarily canceled or revoked due to queue timing. Players maintain complete
                    transparency through their real-time transaction ledger.
                  </li>
                </ul>
              </div>

              <div className="legal-text-block">
                <h4>3. Minimum Thresholds &amp; 1× Rollover Requirement</h4>
                <p>
                  In accordance with U.S. promotional sweepstakes laws, promotional Sweeps Coins received for free
                  with Gold Coin bundles, via daily rewards, or through mail-in requests carry a <strong>1× playthrough
                  (rollover) requirement</strong> before becoming eligible for redemption. The minimum redemption
                  threshold is <strong>50.00 SC ($50.00 USD)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 2: PRIVACY POLICY */}
          {activeSection === 'privacy' && (
            <div className="legal-section-content">
              <h3>DC Enterprises Player Privacy Policy</h3>
              <p className="effective-date">Last Updated: November 2026 &bull; CCPA &amp; GDPR Compliant</p>

              <div className="legal-text-block">
                <h4>1. Information We Collect</h4>
                <p>
                  We collect information necessary to provide a secure social gaming and sweepstakes experience:
                </p>
                <ul>
                  <li><strong>Account &amp; Identity Data:</strong> Name, email address, phone number (for SMS 2FA), and OAuth profile details.</li>
                  <li><strong>Verification &amp; KYC Records:</strong> Government-issued photo identification and proof of address submitted solely for prize redemption compliance.</li>
                  <li><strong>Transaction &amp; Gameplay History:</strong> Spin logs, coin balances, purchases, and redemption records stored in encrypted ledgers.</li>
                  <li><strong>Device &amp; Telemetry Data:</strong> IP address, device model, operating system, and session tokens to combat fraud and multi-account botting.</li>
                </ul>
              </div>

              <div className="legal-text-block">
                <h4>2. How We Use and Protect Your Data</h4>
                <p>
                  Your personal information is protected under industry-standard 256-bit AES encryption and TLS in transit.
                  We never sell, rent, or trade player information to third-party data brokers. Data is shared exclusively
                  with certified compliance vendors (identity verification, fraud detection) and regulated payment processors
                  (Stripe, banking partners) solely to execute requested transactions.
                </p>
              </div>

              <div className="legal-text-block">
                <h4>3. Your Privacy Rights</h4>
                <p>
                  You retain the right to review, update, export, or request deletion of your account data at any time
                  by contacting privacy@dcenterprises.casino. Data required for financial reporting and anti-money laundering
                  compliance is retained for the minimum period mandated by law.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 3: TERMS OF SERVICE */}
          {activeSection === 'terms' && (
            <div className="legal-section-content">
              <h3>Terms of Service &amp; Social Gaming Agreement</h3>
              <p className="effective-date">Effective Date: November 2026</p>

              <div className="legal-text-block">
                <h4>1. Eligibility &amp; Age Restriction</h4>
                <p>
                  Pharaoh&rsquo;s Chakra Dynasty is open exclusively to legal residents of eligible jurisdictions who are at least
                  <strong> 18 years of age</strong> (19+ in Alabama and Nebraska; 21+ in Mississippi). Residents of
                  Washington state, Idaho, Nevada, and Michigan are excluded from promotional Sweeps Coins play in compliance
                  with local regulations.
                </p>
              </div>

              <div className="legal-text-block">
                <h4>2. Nature of Social Virtual Currencies</h4>
                <p>
                  <strong>Gold Coins (GC):</strong> Virtual tokens designed exclusively for social, recreational play.
                  Gold Coins carry zero real-world monetary value and cannot be transferred, sold, or redeemed for prizes under any circumstances.
                </p>
                <p>
                  <strong>Sweeps Coins (SC):</strong> Promotional tokens granted free of charge as promotional entries.
                  Eligible, won Sweeps Coins may be redeemed for cash prizes at the rate of 1.00 SC = $1.00 USD, subject
                  to the Payout &amp; Liquidity Schedule set forth in Section 1.
                </p>
              </div>

              <div className="legal-text-block">
                <h4>3. Account Integrity &amp; Single-User Policy</h4>
                <p>
                  Each individual is permitted exactly one registered account. Any use of automated scripts, botting,
                  emulator spoofing, or syndicate multi-accounting will result in immediate disqualification, account termination,
                  and forfeiture of unredeemed virtual balances.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 4: SWEEPSTAKES RULES */}
          {activeSection === 'sweeps' && (
            <div className="legal-section-content">
              <h3>Official Promotional Sweepstakes Rules</h3>
              <p className="effective-date">No Purchase Necessary to Enter or Win &bull; A Purchase Does Not Increase Odds of Winning</p>

              <div className="legal-text-block">
                <h4>1. Free Alternative Method of Entry (AMOE)</h4>
                <p>
                  In accordance with federal and state sweepstakes statutes, players may obtain free promotional Sweeps Coins
                  without making any purchase through the following sanctioned methods:
                </p>
                <ul>
                  <li><strong>Daily Login Rewards:</strong> Claim free Gold Coins and promotional SC every 24 hours in-game.</li>
                  <li><strong>Promotional Social Giveaways:</strong> Official contests on verified DC Enterprises social channels.</li>
                  <li><strong>Standard Mail-In Request (AMOE):</strong> Hand-written mail-in index card requests sent to DC Enterprises Sweepstakes Department, receiving 5.00 free SC per verified qualifying envelope.</li>
                </ul>
              </div>

              <div className="legal-text-block">
                <h4>2. Random Number Generator (RNG) Integrity</h4>
                <p>
                  Game outcomes are driven by an authentic certified physical reel-strip mathematical random number generator
                  calibrated for true fair play. Spin outcomes are deterministic from seed generation and independent of player
                  balance, purchase volume, or device category.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Acceptance Console */}
        <div className="privacy-terms-footer">
          <div className="footer-compliance-text">
            <CheckCircle size={15} className="check-icon-gold" />
            <span>By accepting, you confirm you have reviewed the Liquidity Schedule, Privacy Policy &amp; Terms.</span>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="legal-secondary-btn"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="button"
              className="legal-accept-btn"
              onClick={() => {
                if (onAccept) onAccept();
                onClose();
              }}
            >
              <span>I Understand &amp; Agree to Terms</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
