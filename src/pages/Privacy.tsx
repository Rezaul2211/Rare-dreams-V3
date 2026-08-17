import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  Server, 
  UserCheck, 
  CheckCircle2, 
  Sparkles,
  PhoneCall,
  MessageCircle
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import SEO from '../components/SEO';

export default function Privacy() {
  const navigate = useNavigate();
  const { config } = useStoreConfigStore();

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');

  return (
    <div className="w-full min-h-screen bg-neutral-50/60 text-neutral-900 pb-20">
      <SEO 
        title="Privacy Policy | Rare Dreams" 
        description="Learn how Rare Dreams protects customer personal data, ordering details, and payment privacy."
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
          <span className="text-neutral-900 font-semibold">Privacy Policy</span>
        </div>

        {/* Top Hero Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                <Sparkles size={14} className="text-blue-600" />
                <span>100% Data Protection & Confidentiality</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight font-serif">
                Privacy & Data Security Policy
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">
                আপনার ব্যক্তিগত তথ্যের পূর্ণ নিরাপত্তা ও গোপনীয়তা রক্ষা করা আমাদের সর্বোচ্চ অগ্রাধিকার। আমরা কোনো তৃতীয় পক্ষের সাথে ডেটা শেয়ার করি না।
              </p>
            </div>
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-inner">
              <Lock size={36} />
            </div>
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-neutral-900">শুধুমাত্র অর্ডার প্রক্রিয়াকরণ</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              আপনার নাম, ফোন ও ঠিকানা কেবল পার্সেল ডেলিভারি ও কাস্টমার সাপোর্টের জন্য ব্যবহৃত হয়।
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center">
              <EyeOff size={20} />
            </div>
            <h4 className="text-sm font-bold text-neutral-900">নো থার্ড-পার্টি শেয়ারিং</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              আমরা কখনো কোনো কাস্টমার ডেটা বিজ্ঞাপন সংস্থা বা অন্য কোনো পক্ষের কাছে বিক্রি বা শেয়ার করি না।
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Server size={20} />
            </div>
            <h4 className="text-sm font-bold text-neutral-900">এনক্রিপ্টেড ক্লাউড স্টোরেজ</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Google Cloud ও SSL 256-বিট এনক্রিপশন প্রযুক্তির মাধ্যমে সুরক্ষিত ডাটাবেজে তথ্য সংরক্ষিত থাকে।
            </p>
          </div>
        </div>

        {/* Detailed Sections Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="space-y-6 text-xs sm:text-sm text-neutral-700 leading-relaxed">
            
            <div className="space-y-2 border-b border-neutral-100 pb-5">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <UserCheck size={18} className="text-blue-600" />
                <span>১. আমরা কী কী তথ্য সংগ্রহ করি (Information We Collect)</span>
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-neutral-600">
                <li>অর্ডারকারীর নাম, মোবাইল নাম্বার এবং ডেলিভারি ঠিকানা।</li>
                <li>অর্ডার নিশ্চিতকরণ ও ট্র্যাক করার জন্য অর্ডার ট্রানজ্যাকশন হিস্ট্রি।</li>
                <li>কাস্টমার সার্ভিস মেসেজ এবং রিভিউ/ফিডব্যাক।</li>
              </ul>
            </div>

            <div className="space-y-2 border-b border-neutral-100 pb-5">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>২. পেমেন্ট ও আর্থিক তথ্যের নিরাপত্তা (Payment Privacy)</span>
              </h3>
              <p className="text-neutral-600">
                Rare Dreams কখনো গ্রাহকের ক্রেডিট/ডেবিট কার্ড পিন, bKash/Nagad ওটিপি বা পাসওয়ার্ড সংরক্ষণ করে না। সমস্ত ডিজিটাল পেমেন্ট সম্পূর্ণ অফিসিয়াল বাংলাদেশ ব্যাংক অনুমোদিত গেটওয়ে ও ভেরিফায়েড মার্চেন্ট চ্যানেলে সম্পন্ন হয়।
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-purple-600" />
                <span>৩. আপনার অধিকার ও ডেটা মুছে ফেলার অনুরোধ (Data Rights)</span>
              </h3>
              <p className="text-neutral-600">
                আপনি চাইলে যেকোনো সময় আপনার সংরক্ষিত অ্যাকাউন্ট বা অর্ডারের বিবরণ আপডেট বা ডাটাবেজ থেকে মুছে ফেলার জন্য আমাদের সাপোর্ট সেন্টারে অনুরোধ করতে পারেন।
              </p>
            </div>

          </div>
        </div>

        {/* Customer Support CTA Card */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg sm:text-xl font-bold font-serif">গোপনীয়তা নিয়ে কোনো প্রশ্ন আছে?</h4>
            <p className="text-xs sm:text-sm text-neutral-400">
              আমাদের ডেটা প্রোটেকশন হেল্পলাইনে সরাসরি যোগাযোগ করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <a 
              href={`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('Hello Rare Dreams! I have a question regarding Privacy and Data Security.')}`}
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
