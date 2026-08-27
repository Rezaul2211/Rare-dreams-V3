import React, { useState, useRef, useEffect, memo } from 'react';
import { clsx } from 'clsx';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  blurDataURL?: string;
}

// Ultra-lightweight base64 SVG shimmer blur placeholder (< 200 bytes)
const DEFAULT_BLUR_SVG = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='18'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23F1F3F5'/%3E%3Crect width='100%25' height='100%25' fill='%23E9ECEF' filter='url(%23b)' opacity='0.7'/%3E%3C/svg%3E";

export const LazyImage = memo(({ 
  src, 
  alt = '', 
  className, 
  containerClassName, 
  priority = false,
  blurDataURL = DEFAULT_BLUR_SVG,
  ...props 
}: LazyImageProps) => {
  const [isInView, setIsInView] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Use IntersectionObserver to start loading when within 250px of viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px', threshold: 0.01 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    if (imgRef.current?.complete && imgRef.current.naturalHeight !== 0) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div 
      ref={containerRef}
      className={clsx(
        "relative overflow-hidden bg-neutral-100 flex-shrink-0", 
        containerClassName
      )}
    >
      {/* 1. Base64 Blur-Up Preview Placeholder with soft shimmer effect */}
      <img
        src={blurDataURL}
        alt=""
        aria-hidden="true"
        className={clsx(
          "absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500 ease-out z-0 filter blur-md scale-105",
          isLoaded && !hasError ? "opacity-0" : "opacity-100"
        )}
      />

      {/* 2. Main High-Res Image with Blur-Up Transition */}
      {isInView && src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={clsx(
            "w-full h-full object-cover relative z-10 transition-all duration-500 ease-out will-change-[filter,opacity,transform]",
            !isLoaded 
              ? "opacity-0 filter blur-lg scale-105" 
              : "opacity-100 filter blur-0 scale-100",
            className
          )}
          {...props}
        />
      ) : null}

      {/* 3. Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400 text-[10px] sm:text-xs pointer-events-none z-20 font-medium">
          Image unavailable
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';


