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
    // 1. Dedicated custom logo cache
    try {
      const cached = localStorage.getItem('rare_dreams_custom_logo');
      if (cached && cached.trim().length > 0) return cached.trim();
    } catch {}

    // 2. Primary config logoUrl
    if (config.logoUrl && config.logoUrl.trim().length > 0) return config.logoUrl.trim();

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

    // 5. Default official brand logo file
    return '/brand_logos/rare_dreams_horizontal_transparent.png';
  }, [config.logoUrl]);

  // Reset imgError whenever effectiveLogoUrl changes
  React.useEffect(() => {
    setImgError(false);
  }, [effectiveLogoUrl]);

  const heightClasses = {
    sm: 'h-8 sm:h-9 max-w-[140px]',
    md: 'h-10 sm:h-11 md:h-12 max-w-[170px] sm:max-w-[220px]',
    lg: 'h-12 sm:h-14 md:h-16 max-w-[220px] sm:max-w-[270px]',
    xl: 'h-16 sm:h-20 max-w-[280px] sm:max-w-[340px]',
  }[size];

  // If the logo URL is present and has not errored
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

  // Elegant Luxury Fashion Typography Vector Fallback
  return (
    <div className={`inline-flex items-center justify-center select-none bg-transparent ${className}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1E1B4B] via-[#4338CA] to-[#6366F1] flex items-center justify-center text-white font-black text-sm shadow-xs border border-indigo-200/50">
          RD
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-base sm:text-lg tracking-tight text-neutral-900 flex items-center gap-1 font-serif">
            RARE <span className="text-[#5B46E8] font-sans font-black">DREAMS</span>
          </span>
          <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-semibold mt-0.5">
            Fashion & Lifestyle
          </span>
        </div>
      </div>
    </div>
  );
};

export default Logo;
