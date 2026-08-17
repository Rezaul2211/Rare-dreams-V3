import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle2, 
  Truck, 
  CreditCard, 
  AlertCircle, 
  Sparkles, 
  HelpCircle,
  PhoneCall,
  MessageCircle,
  PackageCheck
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import SEO from '../components/SEO';

export default function Terms() {
  const navigate = useNavigate();
  const { config } = useStoreConfigStore();

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');

  return (
    <div className="w-full min-h-screen bg-neutral-50/60 text-neutral-900 pb-20">
      <SEO 
        title="Terms & Conditions | Rare Dreams" 
        description="Terms of Service, ordering rules, delivery policies, and cash on delivery guidelines at Rare Dreams."
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
          <span className="text-neutral-900 font-semibold">Terms & Conditions</span>
        </div>

        {/* Top Hero Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
                <Sparkles size={14} className="text-purple-600" />
                <span>Transparent Ordering Rules</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight font-serif">
                Terms & Conditions
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">
                Rare Dreams থেকে অর্ডার করার ক্ষেত্রে সাধারণ নিয়মাবলী ও ক্রেতা-বিক্রেতা সুরক্ষা নীতিমালা।
              </p>
            </div>
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center shrink-0 border border-purple-100 shadow-inner">
              <FileText size={36} />
            </div>
          </div>
        </div>

        {/* Core Terms List Cards */}
        <div className="space-y-4">
          
          {/* Term 1 */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center font-bold text-sm shrink-0">
                ০১
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                অর্ডার নিশ্চিতকরণ ও ফোন ভেরিফিকেশন (Order Confirmation)
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pl-12">
              ওয়েবসাইটে অর্ডার প্লেস করার পর সঠিক ডেলিভারি ঠিকানা এবং সচল ১১-সংখ্যার মোবাইল নাম্বার প্রদান আবশ্যক। আমাদের কাস্টমার প্রতিনিধি আপনার সাথে ফোনে কথা বলে বা SMS এর মাধ্যমে অর্ডারটি কনফার্ম করে দ্রুত পার্সেল পাঠিয়ে দেবে।
            </p>
          </div>

          {/* Term 2 */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                ০২
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                ক্যাশ অন ডেলিভারি (COD) ও পার্সেল চেকিং
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pl-12">
              ক্যাশ অন ডেলিভারিতে অর্ডার গ্রহণ করার সময় আপনি কুরিয়ার ডেলিভারি রাইডারের উপস্থিতিতে পার্সেল চেক করে টাকা পরিশোধ করতে পারবেন। কোনো অসঙ্গতি দেখলে তৎক্ষণাৎ আমাদের হেল্পলাইনে যোগাযোগ করতে পারেন।
            </p>
          </div>

          {/* Term 3 */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                ০৩
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                ডেলিভারি সময়সীমা ও চার্জ (Delivery Timelines)
              </h3>
            </div>
            <div className="text-xs sm:text-sm text-neutral-600 leading-relaxed pl-12 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-800">• ঢাকা সিটির ভেতরে:</span>
                <span>২৪ থেকে ৪৮ ঘণ্টার মধ্যে হোম ডেলিভারি (চার্জ: ৳৭০)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-800">• ঢাকা সিটির বাইরে:</span>
                <span>২ থেকে ৪ কার্যদিবসের মধ্যে হোম ডেলিভারি (চার্জ: ৳১৩০)</span>
              </div>
            </div>
          </div>

          {/* Term 4 */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
                ০৪
              </div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                মূল্য ও ইনভেন্টরি প্রাপ্যতা (Pricing & Stock)
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed pl-12">
              ওয়েবসাইটে প্রদর্শিত সকল পণ্যের মূল্য ভ্যাট অন্তর্ভুক্ত। কোনো কারণে কোনো প্রোডাক্টের স্টক শেষ হয়ে গেলে আমাদের টিম দ্রুত বিকল্প অফার করবে অথবা সম্পূর্ণ রিফান্ড প্রদান করবে।
            </p>
          </div>

        </div>

        {/* Customer Support CTA Card */}
        <div className="bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg sm:text-xl font-bold font-serif">কোনো শর্ত বুঝতে সমস্যা হচ্ছে?</h4>
            <p className="text-xs sm:text-sm text-neutral-400">
              আমাদের সাপোর্ট প্রতিনিধির সাথে সরাসরি কথা বলুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
            <a 
              href={`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('Hello Rare Dreams! I have a question about Terms & Conditions.')}`}
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
