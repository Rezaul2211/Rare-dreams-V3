import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  RotateCcw, 
  ShieldCheck, 
  Truck, 
  CheckCircle2, 
  Clock, 
  PhoneCall, 
  MessageCircle, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import SEO from '../components/SEO';

export default function Returns() {
  const navigate = useNavigate();
  const { config } = useStoreConfigStore();

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');

  return (
    <div className="w-full min-h-screen bg-neutral-50/60 text-neutral-900 pb-20">
      <SEO 
        title="Return & Replacement Policy | Rare Dreams" 
        description="7 Days Easy Doorstep Return and Replacement Guarantee across Bangladesh with Rare Dreams."
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
          <span className="text-neutral-900 font-semibold">Returns & Refunds</span>
        </div>

        {/* Top Hero Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Customer Satisfaction Guarantee</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight font-serif">
                Return & Replacement Policy
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">
                ৭ দিনের সহজ রিটার্ন এবং এক্সচেঞ্জ সুবিধা। যেকোনো সাইজ সমস্যা বা ত্রুটি দেখা দিলে সম্পূর্ণ বিনামূল্যে হোম ডেলিভারি এক্সচেঞ্জ পাবেন।
              </p>
            </div>
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-inner">
              <RotateCcw size={36} />
            </div>
          </div>
        </div>

        {/* 4 Quick Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Clock size={20} />
            </div>
            <h4 className="text-xs font-bold text-neutral-900">৭ দিনের সময়সীমা</h4>
            <p className="text-[11px] text-neutral-500">পার্সেল রিসিভের ৭ দিনের মধ্যে জানান</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Truck size={20} />
            </div>
            <h4 className="text-xs font-bold text-neutral-900">ডোরস্টেপ পিকআপ</h4>
            <p className="text-[11px] text-neutral-500">বাসা থেকেই কুরিয়ারে এক্সচেঞ্জ সুবিধা</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center mx-auto">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-xs font-bold text-neutral-900">১০০% ক্যাশ রিফান্ড</h4>
            <p className="text-[11px] text-neutral-500">পণ্য ফেরত দিলে সাথে সাথে টাকা ফেরত</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={20} />
            </div>
            <h4 className="text-xs font-bold text-neutral-900">সাইজ পরিবর্তন</h4>
            <p className="text-[11px] text-neutral-500">সাইজে না মিললে সহজে সাইজ বদল</p>
          </div>
        </div>

        {/* Policy Details Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
              <ShieldCheck size={22} className="text-emerald-600" />
              <span>রিটার্ন ও এক্সচেঞ্জের শর্তাবলী (Terms & Eligibility)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              অনুগ্রহ করে পণ্য রিটার্ন বা এক্সচেঞ্জ করার পূর্বে নিচের বিষয়গুলো খেয়াল রাখুন:
            </p>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-neutral-700 leading-relaxed">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                ১
              </div>
              <div>
                <strong className="text-neutral-900 block font-semibold">৭ দিনের মধ্যে যোগাযোগ:</strong>
                পার্সেল ডেলিভারি পাওয়ার তারিখ থেকে ৭ (সাত) দিনের মধ্যে আমাদের হেল্পলাইন বা হোয়াটসঅ্যাপে জানাতে হবে।
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                ২
              </div>
              <div>
                <strong className="text-neutral-900 block font-semibold">ট্যাগ ও প্যাকেজিং অক্ষত রাখা:</strong>
                প্রোডাক্টের সাথে থাকা অরিজিনাল ট্যাগ, বারকোড এবং বক্স অক্ষত ও পরিহিতহীন (Unworn) অবস্থায় থাকতে হবে।
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/60">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                ৩
              </div>
              <div>
                <strong className="text-neutral-900 block font-semibold">সাইজ সমস্যা বা ভুল পণ্য:</strong>
                যদি সাইজে না মিলে বা কোনো ত্রুটিযুক্ত পণ্য পৌঁছায়, তবে কোনো অতিরিক্ত সার্ভিস চার্জ ছাড়াই রিপ্লেসমেন্ট করে দেওয়া হবে।
              </div>
            </div>
          </div>
        </div>

        {/* 3 Step Return Process Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
              <RotateCcw size={22} className="text-neutral-800" />
              <span>সহজ ৩ ধাপে এক্সচেঞ্জ প্রক্রিয়া (How to Return)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-1">খুব সহজেই ঘরে বসেই আপনার পণ্য বদল করে নিন</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Step 01
              </span>
              <h4 className="font-bold text-neutral-900 text-sm">হোয়াটসঅ্যাপে মেসেজ দিন</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                আপনার Order ID এবং প্রোডাক্টের স্পষ্ট ছবি বা ভিডিও আমাদের হোয়াটসঅ্যাপ নাম্বারে পাঠান।
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Step 02
              </span>
              <h4 className="font-bold text-neutral-900 text-sm">পিকআপ অনুমোদন</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                আমাদের কাস্টমার কেয়ার টিম তাৎক্ষণিক আপনার এক্সচেঞ্জ বা রিটার্ন বুকিং কনফার্ম করবে।
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                Step 03
              </span>
              <h4 className="font-bold text-neutral-900 text-sm">ডোরস্টেপ হ্যান্ডওভার</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                কুরিয়ার রাইডার আপনার ঠিকানায় এসে পুরাতন পণ্য রিসিভ করে নতুন প্রোডাক্ট বুঝিয়ে দেবে।
              </p>
            </div>
          </div>
        </div>

        {/* Customer Support CTA Card */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg sm:text-xl font-bold font-serif">সরাসরি কথা বলতে চান?</h4>
            <p className="text-xs sm:text-sm text-neutral-400">
              আমাদের সাপোর্ট টিম সকাল ১০:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত সক্রিয় রয়েছে।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <a 
              href={`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('Hello Rare Dreams! I want to request an exchange/return for my order.')}`}
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
