import { Product } from '../types';

/**
 * Calculates discount percentage reliably from product properties.
 */
export function calculateDiscount(product: Partial<Product> | null | undefined): number {
  if (!product) return 0;
  
  if (typeof product.discountPercentage === 'number' && product.discountPercentage > 0) {
    return Math.round(product.discountPercentage);
  }
  if (typeof product.discount === 'number' && product.discount > 0) {
    return Math.round(product.discount);
  }
  if (product.comparePrice && product.price && product.comparePrice > product.price) {
    return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
  }
  return 0;
}

/**
 * Formats currency in Bangladeshi Taka (৳) with proper locale formatting.
 */
export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined || isNaN(price)) return '৳ 0';
  return `৳ ${Math.round(price).toLocaleString('en-BD')}`;
}

/**
 * Helper to get a stable display rating and review count for UI consistency.
 */
export function getProductRatingInfo(product: Partial<Product> | null | undefined): { rating: number; count: number } {
  if (!product) return { rating: 4.8, count: 85 };
  
  const nameLen = product.name?.length || 10;
  const price = product.price || 1000;
  const rating = product.rating || Number((4.6 + ((nameLen % 4) * 0.1)).toFixed(1));
  const count = (nameLen * 7 + (price % 50)) || 85;

  return { rating, count };
}

/**
 * Reusable category matching logic across all views.
 */
export function matchesCategoryGroup(category: string | undefined | null, group: 'men' | 'women' | 'kids' | 'footwear' | 'accessories' | 'all'): boolean {
  if (!category) return group === 'all';
  const c = category.toLowerCase().trim();

  switch (group) {
    case 'men':
      return c.includes('men') && !c.includes('women');
    case 'women':
      return c.includes('women');
    case 'kids':
      return c.includes('kid') || c.includes('boy') || c.includes('girl') || c.includes('baby') || c.includes('child');
    case 'footwear':
    case 'accessories':
      return c.includes('foot') || c.includes('shoe') || c.includes('sandal') || c.includes('boot') || c.includes('loafer') || c.includes('access') || c.includes('watch') || c.includes('bag') || c.includes('belt') || c.includes('sunglass') || c.includes('wallet') || c.includes('jewelry');
    case 'all':
    default:
      return true;
  }
}

/**
 * Extracts YouTube Video ID from various link formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function getYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // youtube.com/shorts/ID
  const shortsMatch = trimmed.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // youtu.be/ID
  const youtuBeMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch && youtuBeMatch[1]) return youtuBeMatch[1];

  // youtube.com/watch?v=ID or /embed/ID or /v/ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }

  return null;
}

/**
 * Parses video URL to embeddable player or direct stream info.
 */
export function parseVideoEmbedUrl(url: string | null | undefined): {
  type: 'youtube' | 'direct' | 'vimeo' | 'invalid';
  embedUrl: string;
  videoId?: string;
  originalUrl: string;
} {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { type: 'invalid', embedUrl: '', originalUrl: '' };
  }
  const clean = url.trim();

  const ytId = getYouTubeVideoId(clean);
  if (ytId) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
      videoId: ytId,
      originalUrl: clean
    };
  }

  // Vimeo support
  const vimeoMatch = clean.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      videoId: vimeoMatch[1],
      originalUrl: clean
    };
  }

  // Direct MP4 / WebM video link or data URL
  if (clean.startsWith('data:video/') || clean.startsWith('blob:') || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(clean)) {
    return {
      type: 'direct',
      embedUrl: clean,
      originalUrl: clean
    };
  }

  return {
    type: 'invalid',
    embedUrl: clean,
    originalUrl: clean
  };
}
