import React from 'react';

interface ProductSkeletonProps {
  index?: number;
  key?: React.Key;
}

export function ProductSkeleton({ index = 0 }: ProductSkeletonProps) {
  return (
    <div className="flex flex-col bg-white rounded-2xl md:rounded-3xl shadow-2xs border border-neutral-100 overflow-hidden">
      {/* Image Skeleton */}
      <div className="relative aspect-[4/5] w-full shimmer-bg animate-shimmer" />
      
      {/* Content Skeleton */}
      <div className="p-4 flex flex-col flex-grow space-y-3">
        {/* Category Tag */}
        <div className="h-2.5 rounded-md w-1/3 shimmer-bg animate-shimmer" />
        
        {/* Title */}
        <div className="space-y-1.5">
          <div className="h-3.5 rounded-md w-11/12 shimmer-bg animate-shimmer" />
          <div className="h-3.5 rounded-md w-2/3 shimmer-bg animate-shimmer" />
        </div>
        
        {/* Price & Action */}
        <div className="mt-auto pt-3 border-t border-neutral-100 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 rounded-md w-16 shimmer-bg animate-shimmer" />
            <div className="h-3 rounded-md w-12 shimmer-bg animate-shimmer" />
          </div>
          <div className="w-9 h-9 rounded-2xl shrink-0 shimmer-bg animate-shimmer" />
        </div>
      </div>
    </div>
  );
}
