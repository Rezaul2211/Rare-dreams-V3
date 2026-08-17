import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Send,
  ShoppingBag,
  Headphones,
  Info,
  Layers
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import { useCategoryStore } from '../store/useCategoryStore';
import { useLanguageStore, translateCategory } from '../store/useLanguageStore';
import Logo from './Logo';

export default function Footer() {
  const { config } = useStoreConfigStore();
  const { categories } = useCategoryStore();
  const { language, t } = useLanguageStore();
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setSubscribed(true);
      setEmailInput('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="bg-neutral-900 text-white pt-12 pb-20 md:pb-10 mt-auto border-t border-neutral-800 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* TOP SECTION: BRAND & LINKS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Brand Info & Social (Takes 1.5 columns on desktop) */}
            <div className="md:col-span-2 space-y-5">
              <Link to="/" onClick={scrollToTop} className="inline-block hover:opacity-90 transition-opacity">
                <Logo variant="dark" size="lg" showText={true} />
              </Link>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
                Your trusted brand for exclusive fashion for men, women & kids. Style that defines you.
              </p>
              
              {/* Contact Information Inline */}
              <div className="pt-2 space-y-2.5 text-sm text-neutral-300">
                 <p className="flex items-center gap-2">
                   <Phone size={14} className="text-emerald-500/70 shrink-0"/> 
                   <span>{config.helplineNumber || '01954710343'}</span>
                 </p>
                 <p className="flex items-center gap-2">
                   <Mail size={14} className="text-emerald-500/70 shrink-0"/> 
                   <span>{config.supportEmail || 'xmrezaul.karim998@gmail.com'}</span>
                 </p>
                 <p className="flex items-start gap-2 max-w-xs">
                   <MapPin size={14} className="mt-0.5 text-emerald-500/70 shrink-0"/> 
                   <span>{config.address || 'Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh'}</span>
                 </p>
              </div>

              {/* Social Icons */}
              <div className="flex items-center space-x-3 pt-4">
                {/* Facebook */}
                <a 
                  href={config.facebookUrl || "https://facebook.com"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 hover:border-neutral-500 hover:text-white text-neutral-400 flex items-center justify-center transition-all"
                  title="Facebook"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                {/* Instagram */}
                <a 
                  href={config.instagramUrl || "https://instagram.com"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 hover:border-neutral-500 hover:text-white text-neutral-400 flex items-center justify-center transition-all"
                  title="Instagram"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                {/* TikTok */}
                <a 
                  href={config.tiktokUrl || "https://tiktok.com"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 hover:border-neutral-500 hover:text-white text-neutral-400 flex items-center justify-center transition-all"
                  title="TikTok"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* SHOP LINKS */}
            <div className="space-y-4 md:col-span-1">
               <h4 className="text-pink-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                 <ShoppingBag size={14} className="text-pink-500/70" /> SHOP
               </h4>
               <ul className="space-y-3 text-sm text-neutral-400">
                 {categories.slice(0, 4).map((cat, idx) => (
                    <li key={cat.id || idx}>
                      <Link to={cat.link || `/category/${encodeURIComponent(cat.title)}`} onClick={scrollToTop} className="hover:text-white transition-colors">
                        {translateCategory(cat.title, language)}
                      </Link>
                    </li>
                  ))}
               </ul>
            </div>

            {/* SUPPORT & POLICIES */}
            <div className="space-y-4 md:col-span-1">
               <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                 <Headphones size={14} className="text-emerald-500/70" /> SUPPORT
               </h4>
               <ul className="space-y-3 text-sm text-neutral-400">
                  <li>
                    <Link to="/track-order" onClick={scrollToTop} className="hover:text-white transition-colors flex items-center gap-1.5 font-medium text-emerald-400">
                      <span>Track Order (অর্ডার ট্র্যাক)</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/contact" onClick={scrollToTop} className="hover:text-white transition-colors">Contact Us</Link>
                  </li>
                  <li>
                    <Link to="/returns" onClick={scrollToTop} className="hover:text-white transition-colors">Returns & Refunds</Link>
                  </li>
                  <li>
                    <Link to="/privacy" onClick={scrollToTop} className="hover:text-white transition-colors">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link to="/terms" onClick={scrollToTop} className="hover:text-white transition-colors">Terms & Conditions</Link>
                  </li>
                  <li>
                    <Link to="/license" onClick={scrollToTop} className="hover:text-white transition-colors flex items-center gap-1">
                      Trade License
                    </Link>
                  </li>
               </ul>
            </div>

          </div>

          {/* BOTTOM COPYRIGHT & PAYMENTS */}
          <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
             
             {/* Copyright & License */}
             <div className="text-center md:text-left space-y-1.5 order-3 md:order-1">
                <p className="text-neutral-400 text-[11px]">
                  © {new Date().getFullYear()} Rare Dreams. All rights reserved.
                </p>
                <p className="text-[10px] text-neutral-500">
                  Trade License No: {config.tradeLicenseNo || 'TRAD/DNCC/012984/2026'}
                </p>
             </div>

             {/* SSL Badge */}
             <div className="flex items-center gap-2 border border-emerald-900/50 bg-emerald-900/10 text-emerald-400 px-3 py-2 rounded-lg order-2 md:order-2">
                <ShieldCheck size={18} className="shrink-0" />
                <div className="text-left">
                   <p className="text-[10px] font-bold tracking-wide leading-none mb-0.5">SSL SECURED</p>
                   <p className="text-[9px] opacity-80 leading-none">100% protected</p>
                </div>
             </div>

             {/* Payment Icons */}
             <div className="flex flex-wrap items-center justify-center gap-2 order-1 md:order-3">
               {/* bKash Text Placeholder */}
               <div className="bg-white rounded border border-neutral-200 flex items-center justify-center h-[26px] w-[50px] overflow-hidden">
                 <span className="text-[#E2136E] font-bold text-[10px] tracking-tight">bKash</span>
               </div>
               {/* Nagad Text Placeholder */}
               <div className="bg-white rounded border border-neutral-200 flex items-center justify-center h-[26px] w-[50px] overflow-hidden">
                 <span className="text-[#ED1C24] font-bold text-[10px] tracking-tight">Nagad</span>
               </div>
               {/* Rocket */}
               <div className="bg-[#8A2461] rounded flex items-center justify-center h-[26px] w-[50px] text-white font-bold text-[10px] tracking-wide">
                 Rocket
               </div>
               {/* Visa Placeholder */}
               <div className="bg-white rounded border border-neutral-200 flex items-center justify-center h-[26px] w-[50px]">
                 <span className="text-[#1A1F71] font-bold text-[10px] italic">VISA</span>
               </div>
               {/* Mastercard Placeholder */}
               <div className="bg-white rounded border border-neutral-200 flex items-center justify-center h-[26px] w-[50px]">
                  <div className="flex">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#EB001B] opacity-80 mix-blend-multiply"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F79E1B] opacity-80 mix-blend-multiply -ml-1.5"></div>
                  </div>
               </div>
             </div>

          </div>

        </div>
      </footer>

    </>
  );
}


