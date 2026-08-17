import React from 'react';

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 w-full">
      {/* Breadcrumbs */}
      <div className="h-4 rounded-md w-48 mb-8 shimmer-bg animate-shimmer" />

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
        {/* Images */}
        <div className="w-full lg:w-1/2 flex flex-col">
          <div className="w-full relative aspect-[4/5] rounded-3xl mb-4 shimmer-bg animate-shimmer" />
          <div className="flex space-x-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-20 h-24 rounded-xl shrink-0 shimmer-bg animate-shimmer" />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="w-full lg:w-1/2 flex flex-col pt-2">
          <div className="bg-white rounded-3xl shadow-2xs border border-neutral-100 p-6 mb-8 space-y-4">
            <div className="h-8 rounded-xl w-3/4 shimmer-bg animate-shimmer" />
            <div className="h-4 rounded-md w-1/2 shimmer-bg animate-shimmer" />
            <div className="h-8 rounded-xl w-1/3 shimmer-bg animate-shimmer" />
            
            <div className="h-24 rounded-2xl shimmer-bg animate-shimmer" />
            
            <div className="space-y-2">
              <div className="h-4 rounded w-1/4 shimmer-bg animate-shimmer" />
              <div className="flex space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-16 h-10 rounded-xl shimmer-bg animate-shimmer" />
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="h-4 rounded w-1/4 shimmer-bg animate-shimmer" />
              <div className="flex space-x-2">
                 {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-12 h-10 rounded-xl shimmer-bg animate-shimmer" />
                ))}
              </div>
            </div>

            <div className="h-14 rounded-2xl pt-2 shimmer-bg animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
