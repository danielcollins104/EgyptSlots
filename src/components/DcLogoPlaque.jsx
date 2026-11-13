import React, { memo } from 'react';
import NeonKeyedImage from './NeonKeyedImage';

/**
 * 3D Ultra-High-Definition Vegas Casino Top Arch Logo
 */
const DcLogoPlaque = memo(function DcLogoPlaque({ className = '', textOverride = null }) {
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
});

export default DcLogoPlaque;
