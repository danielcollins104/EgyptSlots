import React, { memo } from 'react';

/**
 * GuardianElementalFx
 * Ultra-low-memory, pure GPU-compositor (`transform` + `opacity` ONLY) elemental aura overlay.
 * - Zero `<canvas>` framebuffers (0 MB extra VRAM)
 * - Zero JS `requestAnimationFrame` / `setInterval` timers (0% main-thread JS CPU & 0 GC churn)
 * - Vector SVG arcs & flame ribbons + lightweight spark nodes isolated via CSS `contain: layout style paint`
 *
 * @param {'electricity' | 'fire'} props.variant - 'electricity' for Lord Anubis, 'fire' for Queen Bastet
 * @param {number} props.stage - Guardian charge tier (0..4) controlling intensity scale
 * @param {boolean} [props.compact=false] - Compact avatar ring mode for mobile portrait companion pills
 */
const GuardianElementalFx = memo(function GuardianElementalFx({
  variant = 'electricity',
  stage = 1,
  compact = false,
}) {
  const clampedStage = Math.max(0, Math.min(4, Number(stage) || 0));
  const isElectric = variant === 'electricity';

  if (compact) {
    return (
      <div
        className={`guardian-elemental-fx gefx-compact gefx-${isElectric ? 'electric' : 'fire'} gefx-stage-${clampedStage}`}
        aria-hidden="true"
      >
        {isElectric ? (
          <svg
            className="gefx-svg"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="gefx-bolt gefx-bolt-a"
              d="M14 62 L20 48 L13 44 L24 27 L19 24 L30 10"
              stroke="#00f0ff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="gefx-bolt gefx-bolt-b"
              d="M66 60 L59 46 L65 41 L55 25 L61 20 L50 9"
              stroke="#e0faff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            className="gefx-svg"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="gefx-flame gefx-flame-a"
              d="M16 68 C8 54, 14 38, 22 26 C19 38, 25 44, 24 58 Z"
              fill="rgba(251, 191, 36, 0.85)"
            />
            <path
              className="gefx-flame gefx-flame-b"
              d="M64 68 C72 53, 66 36, 57 24 C60 37, 54 44, 56 58 Z"
              fill="rgba(249, 115, 22, 0.85)"
            />
          </svg>
        )}
        <span className="gefx-particle gefx-p1" />
        <span className="gefx-particle gefx-p2" />
      </div>
    );
  }

  return (
    <div
      className={`guardian-elemental-fx gefx-${isElectric ? 'electric' : 'fire'} gefx-stage-${clampedStage}`}
      aria-hidden="true"
    >
      {/* Ambient Moving Energy Shimmer Ribbons (Pure Transform + Opacity) */}
      <div className="gefx-wisp gefx-wisp-left" />
      <div className="gefx-wisp gefx-wisp-right" />

      {isElectric ? (
        <svg
          className="gefx-svg"
          viewBox="0 0 240 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Left Flank Ascending Lightning Arc + Fork */}
          <g className="gefx-bolt gefx-bolt-a">
            <path
              d="M46 286 L34 248 L50 232 L32 190 L52 172 L38 128 L60 98 L48 64"
              stroke="#00e5ff"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            <path
              d="M46 286 L34 248 L50 232 L32 190 L52 172 L38 128 L60 98 L48 64"
              stroke="#e0ffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M32 190 L16 168 L22 148"
              stroke="#7dd3fc"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Right Scepter / Hand Crackling Plasma Arc */}
          <g className="gefx-bolt gefx-bolt-b">
            <path
              d="M194 274 L208 236 L188 216 L210 176 L190 152 L206 112 L182 78"
              stroke="#00f0ff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            <path
              d="M194 274 L208 236 L188 216 L210 176 L190 152 L206 112 L182 78"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M210 176 L226 154 L218 134"
              stroke="#38bdf8"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Upper Crown / Shoulder Cross-Arc */}
          <g className="gefx-bolt gefx-bolt-c">
            <path
              d="M66 132 L88 112 L82 96 L114 78 L128 90 L156 74 L174 98"
              stroke="#00f0ff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />
            <path
              d="M66 132 L88 112 L82 96 L114 78 L128 90 L156 74 L174 98"
              stroke="#f0fdff"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Mid-Torso / Hand-to-Pedestal Surge Arc */}
          <g className="gefx-bolt gefx-bolt-d">
            <path
              d="M58 228 L86 206 L78 190 L116 176 L132 192 L168 172 L186 196"
              stroke="#38bdf8"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.48"
            />
            <path
              d="M58 228 L86 206 L78 190 L116 176 L132 192 L168 172 L186 196"
              stroke="#e0faff"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      ) : (
        <svg
          className="gefx-svg"
          viewBox="0 0 240 340"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bastetFlameGradOuter" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor="#dc2626" stopOpacity="0.15" />
              <stop offset="38%" stopColor="#f97316" stopOpacity="0.82" />
              <stop offset="78%" stopColor="#fbbf24" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bastetFlameGradCore" x1="0.5" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#fde047" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Left Flank Rising Solar Flame Tongue */}
          <g className="gefx-flame gefx-flame-a">
            <path
              d="M48 292 C20 250, 22 194, 46 146 C36 184, 54 198, 44 124 C62 162, 68 220, 56 284 Z"
              fill="url(#bastetFlameGradOuter)"
            />
            <path
              d="M48 278 C32 246, 34 206, 48 172 C44 202, 56 222, 52 272 Z"
              fill="url(#bastetFlameGradCore)"
            />
          </g>

          {/* Right Flank Rising Solar Flame Tongue */}
          <g className="gefx-flame gefx-flame-b">
            <path
              d="M192 292 C220 248, 218 192, 192 142 C202 182, 184 198, 196 120 C176 160, 172 220, 184 284 Z"
              fill="url(#bastetFlameGradOuter)"
            />
            <path
              d="M190 278 C206 244, 204 204, 190 170 C194 200, 182 222, 186 272 Z"
              fill="url(#bastetFlameGradCore)"
            />
          </g>

          {/* Left Hand / Shoulder Curling Sunfire Ribbon */}
          <g className="gefx-flame gefx-flame-c">
            <path
              d="M62 214 C38 182, 42 134, 68 92 C58 126, 74 142, 70 198 Z"
              fill="url(#bastetFlameGradOuter)"
            />
            <path
              d="M63 200 C48 176, 52 142, 67 112 C62 138, 70 156, 67 192 Z"
              fill="url(#bastetFlameGradCore)"
            />
          </g>

          {/* Right Hand / Shoulder Curling Sunfire Ribbon */}
          <g className="gefx-flame gefx-flame-d">
            <path
              d="M178 214 C202 182, 198 134, 172 92 C182 126, 166 142, 170 198 Z"
              fill="url(#bastetFlameGradOuter)"
            />
            <path
              d="M177 200 C192 176, 188 142, 173 112 C178 138, 170 156, 173 192 Z"
              fill="url(#bastetFlameGradCore)"
            />
          </g>
        </svg>
      )}

      {/* Lightweight GPU-Composited Rising Sparks / Solar Embers */}
      <span className="gefx-particle gefx-p1" />
      <span className="gefx-particle gefx-p2" />
      <span className="gefx-particle gefx-p3" />
      <span className="gefx-particle gefx-p4" />
      <span className="gefx-particle gefx-p5" />
    </div>
  );
});

export default GuardianElementalFx;
