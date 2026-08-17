import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import { Trash2, ArrowRight, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import { LazyImage } from '../components/LazyImage';

export default function Cart() {
  const { items, updateQuantity, removeItem, getSubtotal, setDirectCheckoutItem } = useCartStore();
  const { language, t } = useLanguageStore();
  const navigate = useNavigate();

  const handleProceedToCheckout = () => {
    setDirectCheckoutItem(null);
    navigate('/checkout');
  };

  const subtotal = getSubtotal();
  const shipping = 0; // Shipping calculated at checkout
  const total = subtotal;

  if (items.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-24 h-24 bg-neutral-100 rounded-3xl flex items-center justify-center mb-6 text-neutral-400 shadow-inner">
          <ShoppingBag size={44} />
        </div>
        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-3">
          {t('cart.empty_title')}
        </h2>
        <p className="text-neutral-500 mb-8 max-w-md text-sm leading-relaxed">
          {t('cart.empty_subtitle')}
        </p>
        <Link 
          to="/shop" 
          className="bg-black text-white px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-md active:scale-95"
        >
          {t('cart.continue_shopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 w-full flex-grow">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-neutral-900">{t('cart.title')}</h1>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-1">{items.length} {items.length === 1 ? 'item in your cart' : 'items in your cart'}</p>
        </div>
        <Link 
          to="/shop"
          className="text-xs font-bold text-neutral-600 hover:text-black uppercase tracking-wider underline underline-offset-4"
        >
          {t('cart.continue_shopping')}
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Cart Items List */}
        <div className="w-full lg:w-2/3 space-y-4">
          {items.map((item) => (
            <div 
              key={item.cartItemId} 
              className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-5 border border-neutral-200/80 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center relative"
            >
              <Link to={`/product/${item.id}`} className="w-24 h-28 sm:w-28 sm:h-32 bg-neutral-100 rounded-2xl overflow-hidden shrink-0 block relative">
                {item.images && item.images.length > 0 && (
                  <LazyImage src={item.images[0]} alt={item.name} className="w-full h-full object-cover" containerClassName="w-full h-full" />
                )}
              </Link>

              <div className="flex-1 w-full flex flex-col justify-between self-stretch">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-0.5">{translateCategory(item.category || 'Collection', language)}</span>
                    <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                      <Link to={`/product/${item.id}`} className="hover:text-neutral-600 transition-colors">{item.name}</Link>
                    </h3>
                    <div className="text-xs text-neutral-500 font-medium space-x-3 mt-1 flex items-center">
                      {item.selectedSize && <span className="bg-neutral-100 px-2 py-0.5 rounded-md text-[11px] font-bold">{'Size:'} {item.selectedSize}</span>}
                      {item.selectedColor && <span className="bg-neutral-100 px-2 py-0.5 rounded-md text-[11px] font-bold">{'Color:'} {item.selectedColor}</span>}
                    </div>
                  </div>

                  <button 
                    onClick={() => removeItem(item.cartItemId)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    aria-label="Remove Item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  {/* Quantity controls */}
                  <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 overflow-hidden w-28 h-9 shadow-2xs">
                    <button 
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      className="flex-1 flex justify-center items-center hover:bg-neutral-200 transition-colors font-bold text-neutral-700"
                    >-</button>
                    <span className="flex-1 text-center font-bold text-xs text-neutral-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="flex-1 flex justify-center items-center hover:bg-neutral-200 transition-colors font-bold text-neutral-700"
                    >+</button>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <span className="text-xs text-neutral-400 block">{t('cart.total')}</span>
                    <span className="font-extrabold text-base sm:text-lg text-neutral-900">৳ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Delivery Policy Card */}
          <div className="bg-neutral-50 rounded-2xl md:rounded-3xl p-5 border border-neutral-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-900 uppercase tracking-wider">{'Fast Nationwide Delivery'}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{'Express delivery across all cities in Bangladesh.'}</p>
            </div>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-2xl md:rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-md sticky top-24">
            <h2 className="text-base font-extrabold uppercase tracking-wider text-neutral-900 mb-6 pb-4 border-b border-neutral-100">{t('checkout.order_summary')}</h2>
            
            <div className="space-y-3.5 mb-6 text-sm">
              <div className="flex justify-between items-center text-neutral-600">
                <span>{t('cart.subtotal')}</span>
                <span className="font-bold text-neutral-900">৳ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>{t('cart.shipping')}</span>
                <span className="font-bold text-neutral-900 text-xs">{'Calculated at checkout'}</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-neutral-200 flex justify-between items-end mb-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">{t('cart.total')}</span>
                <span className="text-2xl font-black text-neutral-900">৳ {total.toFixed(2)}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">{'Cash / BKash on Delivery'}</span>
            </div>

            <button 
              onClick={handleProceedToCheckout}
              className="w-full bg-neutral-900 text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-black active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-lg"
            >
              <span>{t('cart.proceed_to_checkout')}</span>
              <ArrowRight size={16} />
            </button>
            
            <div className="flex items-center justify-center space-x-2 mt-6 text-neutral-400 text-[11px] font-medium">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>{'Safe & Secure 100% Guaranteed'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
