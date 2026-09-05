import React from 'react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';

interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'light',
  size = 'md',
  className = '',
}) => {
  const { config } = useStoreConfigStore();
  const [imgError, setImgError] = React.useState(false);

  // Synchronous immediate logo retrieval to prevent any 0-100ms flash
  const effectiveLogoUrl = React.useMemo(() => {
    // 1. Primary config logoUrl
    if (config.logoUrl && config.logoUrl.trim().length > 0) return config.logoUrl.trim();

    // 2. Dedicated custom logo cache
    try {
      const cached = localStorage.getItem('rare_dreams_custom_logo');
      if (cached && cached.trim().length > 0) return cached.trim();
    } catch {}

    // 3. Stored JSON config cache
    try {
      const stored = localStorage.getItem('rare_dreams_cached_store_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.logoUrl && typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim().length > 0) {
          return parsed.logoUrl.trim();
        }
      }
    } catch {}

    // 4. Session storage fallback
    try {
      const sessionLogo = sessionStorage.getItem('rare_dreams_custom_logo');
      if (sessionLogo && sessionLogo.trim().length > 0) return sessionLogo.trim();
    } catch {}

    return '';
  }, [config.logoUrl]);

  // Reset imgError whenever effectiveLogoUrl changes
  React.useEffect(() => {
    setImgError(false);
  }, [effectiveLogoUrl]);

  const heightClasses = {
    sm: 'h-8 sm:h-9 max-w-[140px]',
    md: 'h-10 sm:h-11 md:h-12 max-w-[170px] sm:max-w-[210px]',
    lg: 'h-12 sm:h-14 md:h-16 max-w-[210px] sm:max-w-[260px]',
    xl: 'h-16 sm:h-20 max-w-[280px] sm:max-w-[340px]',
  }[size];

  // If the user has uploaded or selected a custom logo and it hasn't errored
  if (effectiveLogoUrl && !imgError) {
    return (
      <div className={`inline-flex items-center justify-center select-none bg-transparent ${className}`}>
        <img
          src={effectiveLogoUrl}
          alt="Rare Dreams"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${heightClasses} w-auto object-contain transition-transform duration-200 hover:scale-[1.02]`}
        />
      </div>
    );
  }

  // Pristine Default 3D Vector SVG (Zero backgrounds, zero boxes, 100% transparent and seamlessly blended)
  return (
    <div className={`inline-flex items-center justify-center select-none bg-transparent ${className}`}>
      <svg
        viewBox="0 0 260 70"
        className={`${heightClasses} w-auto transition-transform duration-200 hover:scale-[1.02]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Cobalt 3D Blue Gradient */}
          <linearGradient id="rdBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2575FC" />
            <stop offset="35%" stopColor="#0052D4" />
            <stop offset="70%" stopColor="#003399" />
            <stop offset="100%" stopColor="#001F66" />
          </linearGradient>

          {/* Glossy Top Highlight */}
          <linearGradient id="rdBlueGloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#80B5FF" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#3385FF" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#0052D4" stopOpacity="0" />
            <stop offset="100%" stopColor="#001F66" stopOpacity="0.8" />
          </linearGradient>

          {/* Chrome Silver Gradient for dreams */}
          <linearGradient id="rdChromeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={variant === 'dark' ? '#FFFFFF' : '#8E9EAB'} />
            <stop offset="25%" stopColor={variant === 'dark' ? '#E2E8F0' : '#CFD9DF'} />
            <stop offset="50%" stopColor={variant === 'dark' ? '#CBD5E1' : '#FFFFFF'} />
            <stop offset="75%" stopColor={variant === 'dark' ? '#94A3B8' : '#788896'} />
            <stop offset="100%" stopColor={variant === 'dark' ? '#64748B' : '#4A5568'} />
          </linearGradient>

          {/* Arc Glow Gradient */}
          <linearGradient id="rdArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0052D4" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#0080FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00D2FF" stopOpacity="1" />
          </linearGradient>

          {/* Subtle Drop Shadow */}
          <filter id="rdShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#002266" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 1. Dynamic Arched Glowing Orbit Curve */}
        <path
          d="M 58,40 C 70,6 150,-4 185,15"
          fill="none"
          stroke="url(#rdArcGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* 2. Four-Point Diamond Sparkle Star at end of arc */}
        <g transform="translate(185, 15)">
          <path
            d="M 0,-9 Q 1.2,-1.2 9,0 Q 1.2,1.2 0,9 Q -1.2,1.2 -9,0 Q -1.2,-1.2 0,-9 Z"
            fill="#0099FF"
          />
          <path
            d="M 0,-7 Q 0.8,-0.8 7,0 Q 0.8,0.8 0,7 Q -0.8,0.8 -7,0 Q -0.8,-0.8 0,-7 Z"
            fill="#80DFFF"
          />
          <circle cx="0" cy="0" r="1.8" fill="#FFFFFF" />
        </g>

        {/* 3. Shopping Bag Silhouette behind 'R' */}
        <g transform="translate(20, 8)" filter="url(#rdShadow)">
          <path
            d="M 4,14 L 18,14 L 20,38 L 2,38 Z"
            fill="url(#rdBlueGrad)"
            opacity="0.85"
          />
          {/* Handle */}
          <path
            d="M 7,14 C 7,8 15,8 15,14"
            fill="none"
            stroke="url(#rdBlueGloss)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* 4. Bold 3D 'Rare' Text */}
        <text
          x="26"
          y="42"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="44"
          letterSpacing="-0.8"
          fill="url(#rdBlueGrad)"
          filter="url(#rdShadow)"
        >
          Rare
        </text>
        {/* Highlight Layer for 3D bevel */}
        <text
          x="26"
          y="42"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="44"
          letterSpacing="-0.8"
          fill="url(#rdBlueGloss)"
        >
          Rare
        </text>

        {/* 5. Metallic Chrome 'dreams' Text */}
        <text
          x="28"
          y="64"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="23"
          letterSpacing="0.5"
          fill="url(#rdChromeGrad)"
          stroke={variant === 'dark' ? '#1E293B' : '#4A5568'}
          strokeWidth="0.5"
          filter="url(#rdShadow)"
        >
          dreams
        </text>
      </svg>
    </div>
  );
};

export default Logo;
