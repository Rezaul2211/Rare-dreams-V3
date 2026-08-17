// Meta (Facebook) Pixel Helper Module for Rare Dreams
export const PIXEL_ID = '1502286171625978';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

// Track standard PageView
export const trackPageView = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', 'PageView');
    } catch (e) {
      console.warn('Pixel PageView tracking error:', e);
    }
  }
};

// Track ViewContent for Products & Categories
export const trackViewContent = (data: {
  content_name: string;
  content_category?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', 'ViewContent', {
        content_name: data.content_name,
        content_category: data.content_category || 'Apparel',
        content_ids: data.content_ids || [],
        content_type: 'product',
        value: data.value || 0,
        currency: data.currency || 'BDT',
      });
    } catch (e) {
      console.warn('Pixel ViewContent tracking error:', e);
    }
  }
};

// Track AddToCart
export const trackAddToCart = (data: {
  content_name: string;
  content_ids: string[];
  value: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', 'AddToCart', {
        content_name: data.content_name,
        content_ids: data.content_ids,
        content_type: 'product',
        value: data.value,
        currency: data.currency || 'BDT',
      });
    } catch (e) {
      console.warn('Pixel AddToCart tracking error:', e);
    }
  }
};

// Track InitiateCheckout
export const trackInitiateCheckout = (data: {
  num_items: number;
  value: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', 'InitiateCheckout', {
        num_items: data.num_items,
        value: data.value,
        currency: data.currency || 'BDT',
      });
    } catch (e) {
      console.warn('Pixel InitiateCheckout tracking error:', e);
    }
  }
};

// Track Purchase
export const trackPurchase = (data: {
  order_id: string;
  value: number;
  currency?: string;
  num_items?: number;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    try {
      window.fbq('track', 'Purchase', {
        order_id: data.order_id,
        value: data.value,
        currency: data.currency || 'BDT',
        num_items: data.num_items || 1,
      });
    } catch (e) {
      console.warn('Pixel Purchase tracking error:', e);
    }
  }
};
