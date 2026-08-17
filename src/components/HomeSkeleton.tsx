import React from 'react';
import { ProductSkeleton } from './ProductSkeleton';

export default function HomeSkeleton() {
  return (
    <div className="w-full bg-[#FAFAFA] pb-16 md:pb-0 overflow-hidden">
      {/* Hero Slider Skeleton */}
      <section className="relative w-full pt-2 md:pt-4 pb-2">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
          <div className="relative rounded-2xl md:rounded-3xl overflow-hidden aspect-[16/9] md:aspect-[21/9] shimmer-bg animate-shimmer shadow-sm" />
        </div>
      </section>

      {/* Categories Grid Skeleton */}
      <section className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={`cat-${i}`} className="relative aspect-square rounded-2xl md:rounded-3xl overflow-hidden shimmer-bg animate-shimmer" />
          ))}
        </div>
      </section>

      {/* Section Skeleton (Simulating Shop by Category or New Arrivals) */}
      {[...Array(2)].map((_, sectionIdx) => (
        <section key={`section-${sectionIdx}`} className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 w-full pt-4 mb-10">
          <div className="flex justify-between items-end mb-4 border-b border-neutral-200/80 pb-3">
            <div className="space-y-2">
              <div className="h-6 w-32 md:w-48 rounded-md shimmer-bg animate-shimmer" />
              <div className="h-3 w-24 md:w-32 rounded-md shimmer-bg animate-shimmer" />
            </div>
            <div className="h-4 w-16 rounded-md shimmer-bg animate-shimmer" />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[...Array(4)].map((_, i) => (
              <ProductSkeleton key={`prod-${sectionIdx}-${i}`} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
