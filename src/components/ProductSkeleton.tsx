import React from 'react';

interface ProductSkeletonProps {
  index?: number;
  key?: React.Key;
}

export function ProductSkeleton({ index = 0 }: ProductSkeletonProps) {
  return (
    <div className="flex flex-col w-full">
      <div className="relative w-full rounded-[22px] sm:rounded-[26px] overflow-hidden bg-[#F2F2F6] shadow-[0_4px_16px_rgba(0,0,0,0.03)] border border-black/[0.02] flex flex-col animate-pulse">
        {/* Image Skeleton */}
        <div className="relative aspect-[4/5] w-full bg-neutral-200/60" />
        
        {/* Bottom Meta Skeleton */}
        <div className="px-2.5 sm:px-3 pt-1.5 pb-2 sm:pb-2.5 flex flex-col justify-end space-y-1.5 bg-[#F2F2F6]">
          <div className="h-[13px] w-3/4 rounded bg-neutral-200/60" />
          <div className="h-[15px] w-1/2 rounded bg-neutral-200/60 mt-0.5" />
        </div>
      </div>
    </div>
  );
}
