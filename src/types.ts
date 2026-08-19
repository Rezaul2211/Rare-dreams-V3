export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  comparePrice?: number;
  discount?: number;
  discountPercentage?: number;
  isFlashSale?: boolean;
  isNew?: boolean;
  daily_drop?: boolean;
  isBestSeller?: boolean;
  isMostLoved?: boolean;
  mega_sale?: boolean;
  popularityScore?: number;
  rating?: number;
  stockQuantity: number;
  sizeOptions?: string[];
  colorOptions?: string[];
  brand?: string;
  material?: string;
  description: string;
  images: string[];
  videoUrl?: string;
  status: 'published' | 'draft';
  sku?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface CartItem extends Product {
  cartItemId: string;
  selectedSize?: string;
  selectedColor?: string;
  quantity: number;
}

export interface AddressItem {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string; // Used for upazila/area
  district?: string;
  upazila?: string;
  postalCode: string;
  isDefault?: boolean;
}

export interface PaymentMethodItem {
  id: string;
  type: 'bKash' | 'Nagad' | 'Card' | 'Bank';
  accountNumber: string;
  accountName: string;
  isDefault?: boolean;
}

export interface User {
  uid: string;
  id?: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  phone?: string;
  photoURL?: string;
  role: 'customer' | 'admin' | 'seller';
  addresses?: AddressItem[];
  paymentMethods?: PaymentMethodItem[];
  createdAt: any;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  address: string;
  email?: string;
  orderNotes?: string;
  deliveryArea?: string;
  city?: string;
  district?: string;
  upazila?: string;
  postalCode?: string;
  products: CartItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: 'bKash' | 'nagad' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed';
  senderNumber?: string;
  transactionId?: string;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: any;
}

export interface StoreConfig {
  logoUrl?: string;
  faviconUrl?: string;
  facebookUrl: string;
  instagramUrl: string;
  whatsappNumber: string;
  youtubeUrl: string;
  tiktokUrl: string;
  helplineNumber: string;
  supportEmail: string;
  tradeLicenseNo: string;
  tinNo: string;
  dbidNo: string;
  address: string;
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  // SEO & Google Indexing Configuration
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  googleSiteVerification?: string;
  canonicalDomain?: string;
  ogImage?: string;
  // Tracking & Pixels
  facebookPixelId?: string;
  facebookPageId?: string;
  googleAnalyticsId?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  rating: number;
  comment: string;
  images?: string[];
  isVerifiedPurchase?: boolean;
  helpfulCount?: number;
  createdAt: any;
  adminReply?: string;
  adminReplyAt?: any;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  initialPrice: number;
  targetPrice?: number;
  currentPrice: number;
  userEmail?: string;
  userPhone?: string;
  userId?: string;
  status: 'active' | 'triggered' | 'cancelled';
  createdAt: any;
  notifiedAt?: any;
  notifiedPrice?: number;
  notificationChannels?: ('email' | 'sms' | 'in_app')[];
}

export interface UserNotification {
  id: string;
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  type: 'price_drop' | 'order_update' | 'promotion' | 'system';
  title: string;
  message: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  oldPrice?: number;
  newPrice?: number;
  discountPercentage?: number;
  url?: string;
  read: boolean;
  createdAt: any;
}

