import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
}

export function LazyImage({ 
  src, 
  alt, 
  className, 
  containerClassName, 
  priority = false,
  ...props 
}: LazyImageProps) {
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
      { rootMargin: '250px 0px' }
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
      className={clsx("relative overflow-hidden bg-neutral-100/90 flex-shrink-0", containerClassName)}
    >
      {/* Soft Backdrop for Loading State */}
      <div 
        className={clsx(
          "absolute inset-0 bg-neutral-200 pointer-events-none transition-opacity duration-300 ease-out z-0",
          isLoaded || hasError ? "opacity-0 pointer-events-none" : "opacity-100"
        )} 
      />

      {isInView ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={clsx(
            "w-full h-full object-cover relative z-10 transition-opacity duration-300 ease-in-out",
            !isLoaded ? "opacity-0" : "opacity-100",
            className
          )}
          {...props}
        />
      ) : null}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400 text-xs pointer-events-none z-20 font-medium">
          Image unavailable
        </div>
      )}
    </div>
  );
}

