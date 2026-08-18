import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'bn';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
}

export const translations: Partial<Record<Language, Record<string, string>>> = {
  en: {
    // Header & Nav
    'nav.home': 'Home',
    'nav.shop_all': 'Shop',
    'nav.cart': 'Cart',
    'nav.account': 'Account',
    'nav.admin': 'Admin Panel',
    'nav.login': 'Sign In',
    'nav.logout': 'Sign Out',
    'nav.search_placeholder': 'Search dresses, sizes or categories...',
    'nav.search_results': 'Search Results',
    'nav.no_results': 'No dresses found',
    'nav.view_all_results': 'View all results',
    'nav.wishlist': 'Wishlist',

    // Home Page
    'home.hero_tagline': 'Premium Royal Kids & Family Collection',
    'home.hero_title': 'Dress Your Little Angels in Royal Elegance',
    'home.hero_subtitle': 'Exclusive party wear, Panjabi, shoes and accessories for kids aged 1-14',
    'home.shop_now': 'Shop Now',
    'home.explore_categories': 'Explore Categories',
    'home.view_all': 'View All',
    'home.featured_products': 'Featured Collection',
    'home.new_arrivals': 'New Arrivals',
    'home.best_sellers': 'Best Sellers',
    'home.flash_sale': 'Flash Sale Deals',
    'home.why_choose_us': 'Why Shop With Rare Dreams?',
    'home.free_shipping_title': 'Free Shipping Offer',
    'home.free_shipping_desc': 'Free delivery all over Bangladesh on orders over ৳2000',
    'home.easy_return_title': '7 Days Easy Exchange',
    'home.easy_return_desc': 'Hassle-free replacement if size does not match or you change your mind',
    'home.cash_on_delivery_title': 'Cash on Delivery',
    'home.cash_on_delivery_desc': 'Check your package upon delivery before paying',
    'home.premium_quality_title': '100% Premium Quality',
    'home.premium_quality_desc': 'Skin-friendly, comfortable luxury fabrics designed for children',

    // Categories translation map
    'cat.foot_wear': 'Footwear',
    'cat.mens_items': "Men's Items",
    'cat.baby_items': 'Baby Items',
    'cat.womens_items': "Women's Items",
    'cat.kids': 'Kids Collection',

    // Product Card & Actions
    'product.add_to_cart': 'Add to Cart',
    'product.buy_now': 'Buy Now',
    'product.order_now': 'Order Now',
    'product.out_of_stock': 'Out of Stock',
    'product.quick_view': 'Quick View',
    'product.discount': 'OFF',
    'product.bdt': '৳',
    'product.price': 'Price',
    'product.size': 'Size',
    'product.color': 'Color',
    'product.select_size': 'Select Size',
    'product.select_color': 'Select Color',
    'product.description': 'Product Description',
    'product.size_guide': 'Size Guide',
    'product.ai_size_recommender': 'AI Size Recommender',
    'product.ai_size_btn': 'Find perfect size by child age & weight',
    'product.guarantee_title': 'Our Quality Guarantee:',
    'product.delivery_info': 'Inside Dhaka 1-2 days (৳60) | Outside Dhaka 2-4 days (৳120)',

    // Shop / Filter
    'shop.title': 'All Dresses & Collections',
    'shop.filter_by_category': 'Filter by Category',
    'shop.all_categories': 'All Categories',
    'shop.price_range': 'Price Range',
    'shop.sort_by': 'Sort By',
    'shop.sort_newest': 'Newest First',
    'shop.sort_price_low': 'Price: Low to High',
    'shop.sort_price_high': 'Price: High to Low',
    'shop.clear_filters': 'Clear Filters',
    'shop.showing_products': 'products shown',

    // Cart Page
    'cart.title': 'Your Shopping Cart',
    'cart.empty_title': 'Your cart is empty!',
    'cart.empty_subtitle': 'Explore our store to pick your favorite dresses',
    'cart.continue_shopping': 'Continue Shopping',
    'cart.item_total': 'Items Total',
    'cart.shipping_charge': 'Shipping Fee',
    'cart.grand_total': 'Grand Total',
    'cart.proceed_to_checkout': 'Proceed to Checkout',
    'cart.free_shipping_unlocked': 'Congratulations! You unlocked Free Shipping! 🎉',
    'cart.free_shipping_needed': 'Add ৳{amount} more to get Free Shipping',
    'cart.remove_item': 'Remove',

    // Checkout Page
    'checkout.title': 'Checkout Delivery Details',
    'checkout.customer_info': '1. Customer Name & Phone',
    'checkout.full_name': 'Full Name',
    'checkout.phone_number': '11-Digit Mobile Number',
    'checkout.shipping_address': '2. Delivery Address',
    'checkout.full_address': 'House No, Road, Village/Area Name',
    'checkout.district': 'Select District',
    'checkout.upazila': 'Upazila / Area',
    'checkout.payment_method': '3. Select Payment Method',
    'checkout.cod': 'Cash on Delivery (Pay after receiving)',
    'checkout.bkash': 'bKash',
    'checkout.nagad': 'Nagad',
    'checkout.trx_id': 'Transaction ID (TrxID)',
    'checkout.sender_number': 'Sender bKash/Nagad Number',
    'checkout.order_summary': 'Order Summary',
    'checkout.back_to_cart': 'Back to Cart',
    'checkout.place_order': 'Confirm Order',
    'checkout.submitting': 'Processing Order...',
    'checkout.delivery_inside_dhaka': 'Inside Dhaka City (৳60)',
    'checkout.delivery_outside_dhaka': 'Outside Dhaka (৳120)',
    'checkout.free_delivery_label': 'Free Shipping (৳0)',

    // Order Success
    'order_success.title': 'Your Order Has Been Placed! 🎉',
    'order_success.subtitle': 'Our representative will call you shortly to confirm your order.',
    'order_success.order_id': 'Order ID:',
    'order_success.total_paid': 'Total Payable:',
    'order_success.estimated_delivery': 'Estimated Delivery: 1-3 Business Days',
    'order_success.support_message': 'If you need any assistance, reach out to us:',
    'order_success.back_to_home': 'Return to Home',

    // Footer & Policies
    'footer.company_desc': 'Rare Dreams - Your trusted brand for exclusive royal children & family clothing in Bangladesh.',
    'footer.quick_links': 'Quick Links',
    'footer.customer_service': 'Customer Service',
    'footer.contact_us': 'Contact & Showroom',
    'footer.policies': 'Store Policies',
    'footer.privacy_policy': 'Privacy Policy',
    'footer.terms_conditions': 'Terms & Conditions',
    'footer.return_policy': 'Return & Replacement Policy',
    'footer.showroom_address': 'Level 4, Block B, Jamuna Future Park, Dhaka',
    'footer.trade_license': 'Trade License No:',
    'footer.tin': 'TIN:',
    'footer.all_rights_reserved': 'All Rights Reserved © 2026 Rare Dreams',

    // Support Chat Widget
    'chat.title': 'Rare Dreams AI Assistant',
    'chat.online_status': 'Online | Instant Support',
    'chat.welcome_msg': 'Hello! Welcome to Rare Dreams! 🌸 Ask any question about size, price, or ordering.',
    'chat.input_placeholder': 'Type your question...',
    'chat.send': 'Send',
    'chat.quick_q1': 'What is the delivery charge?',
    'chat.quick_q2': '7 Days Return Policy',
    'chat.quick_q3': 'Showroom Location',

    // Common / UI
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.lang_toggle': 'English',
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: () => set({ language: 'en' }),
      toggleLanguage: () => set({ language: 'en' }),
      t: (key: string, defaultText?: string) => {
        const dict = translations.en;
        return dict[key] || defaultText || key;
      }
    }),
    {
      name: 'raredreams-language-storage'
    }
  )
);

// Helper to convert category titles cleanly in English
export function translateCategory(title: string, _language?: Language): string {
  const lower = (title || '').toLowerCase().trim();
  if (lower.includes('women')) return "Women's Items";
  if (lower.includes('men')) return "Men's Items";
  if (lower.includes('baby') || lower.includes('kid')) return 'Baby Items';
  if (lower.includes('foot') || lower.includes('shoe')) return 'Footwear';
  return title || '';
}
