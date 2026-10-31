import React from 'react';
import NeonKeyedImage from './NeonKeyedImage';

/**
 * 3D Ultra-High-Definition Vegas Casino Top Arch Logo:
 * Features the royal 3D chrome-violet & 24k gold 'DC' monogram,
 * jeweled gold 'ENTERPRISES' banner, glowing diamond-crested imperial crown,
 * cyan neon arch with playing card suits, and casino dice.
 */
export default function DcLogoPlaque({ className = '', textOverride = null }) {
  return (
    <div className={`dc-cabinet-logo-container ${className}`}>
      <NeonKeyedImage
        src="/assets/neon/dc_enterprises_wide_logo.webp"
        alt={textOverride || 'DC ENTERPRISES'}
        className="dc-cabinet-logo-emblem dc-cabinet-logo-wide-emblem"
        threshold={26}
        feather={42}
        draggable={false}
      />
    </div>
  );
}
