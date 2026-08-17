import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Award, 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  FileCheck, 
  Sparkles,
  PhoneCall,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import SEO from '../components/SEO';

export default function License() {
  const navigate = useNavigate();
  const { config } = useStoreConfigStore();

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');

  return (
    <div className="w-full min-h-screen bg-neutral-50/60 text-neutral-900 pb-20">
      <SEO 
        title="Business Verification & Trade License | Rare Dreams" 
        description="Official Government verified E-Commerce Trade License, E-TIN, and merchant credentials for Rare Dreams Bangladesh."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-5">
        
        {/* Navigation Breadcrumb / Back Button */}
        <div className="flex items-center space-x-2 text-xs font-medium text-neutral-500">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go Back"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 text-neutral-700 hover:text-black hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="font-semibold">Back</span>
          </button>
          <span className="text-neutral-300">/</span>
          <Link to="/" className="hover:text-black transition-colors">Home</Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-semibold">Trade License</span>
        </div>

        {/* Top Hero Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                <Sparkles size={14} className="text-amber-600" />
                <span>Government Authorized E-Commerce Brand</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight font-serif">
                Business Verification & Trade License
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">
                Rare Dreams গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের ডিজিটাল কমার্স নীতিমালা ও আইনি সনদ অনুযায়ী সম্পূর্ণ নিবন্ধিত একটি ফ্যাশন ও লাইফস্টাইল ব্র্যান্ড।
              </p>
            </div>
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 shadow-inner">
              <Award size={36} />
            </div>
          </div>
        </div>

        {/* Official Credentials Table Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
              <FileCheck size={22} className="text-amber-600" />
              <span>আইনি তথ্যাবলী ও রেজিস্ট্রেশন সনদ (Corporate Identity)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-1">আমাদের অফিসিয়াল লাইসেন্স ও সনদসমূহের বিবরণ নিচে দেওয়া হলো:</p>
          </div>

          <div className="divide-y divide-neutral-100 text-xs sm:text-sm">
            
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-xs">প্রতিষ্ঠানের নাম (Brand Name)</span>
              <span className="font-bold text-neutral-900 text-sm">Rare Dreams Bangladesh</span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-xs">ট্রেড লাইসেন্স নং (Trade License No)</span>
              <span className="font-bold font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-sm">
                {config.tradeLicenseNo || 'TRAD/DNCC/012984/2026'}
              </span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-xs">ই-টিন রেজিস্ট্রেশন (E-TIN Certificate)</span>
              <span className="font-bold font-mono text-neutral-800 bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 text-sm">
                {config.tinNo || '849201948123 / Tax Zone-12'}
              </span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-xs">ডিজিটাল বিজনেস আইডি (DBID)</span>
              <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-sm">
                {config.dbidNo || 'DBID-2026-884129'}
              </span>
            </div>

            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-bold uppercase tracking-wider text-xs">রেজিস্টার্ড হেড অফিস (Showroom Address)</span>
              <span className="font-semibold text-neutral-800 text-right">
                {config.address || 'Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh'}
              </span>
            </div>

          </div>
        </div>

        {/* Verification Guarantee Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50/80 rounded-3xl p-6 border border-emerald-200/80 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <ShieldCheck size={20} className="text-emerald-600" />
              <span>মার্চেন্ট অ্যাকাউন্ট ভেরিফায়েড</span>
            </div>
            <p className="text-xs text-emerald-950 leading-relaxed">
              Rare Dreams এর সকল বিকাশ, নগদ এবং রকেট মার্চেন্ট অ্যাকাউন্ট সরকারিভাবে ভেরিফায়েড ও সরাসরি ব্যাংক সংযুক্ত।
            </p>
          </div>

          <div className="bg-blue-50/80 rounded-3xl p-6 border border-blue-200/80 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
              <CheckCircle2 size={20} className="text-blue-600" />
              <span>ভোক্তা অধিকার সংরক্ষণ আইন অনুসারী</span>
            </div>
            <p className="text-xs text-blue-950 leading-relaxed">
              আমরা বাংলাদেশ জাতীয় ভোক্তা-অধিকার সংরক্ষণ অধিদপ্তর (DNCRP) এর সকল নীতি এবং ক্রেতা সুরক্ষার আইন শতভাগ মেনে চলি।
            </p>
          </div>
        </div>

        {/* Customer Support CTA Card */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg sm:text-xl font-bold font-serif">সরাসরি কথা বলতে চান?</h4>
            <p className="text-xs sm:text-sm text-neutral-400">
              যেকোনো লাইসেন্স বা প্রাতিষ্ঠানিক তথ্যের জন্য আমাদের সাথে যোগাযোগ করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <a 
              href={`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('Hello Rare Dreams! I want to inquire about official business credentials.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>WhatsApp Support</span>
            </a>

            <a 
              href={`tel:${config.helplineNumber || '01954710343'}`}
              className="inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-2xl transition-all cursor-pointer border border-neutral-700"
            >
              <PhoneCall size={16} />
              <span>Call Helpline</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
