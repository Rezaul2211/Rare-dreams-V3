import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  MessageCircle, 
  Sparkles, 
  Clock, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';
import SEO from '../components/SEO';

export default function Contact() {
  const navigate = useNavigate();
  const { config } = useStoreConfigStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate support ticket submission
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setIsSuccess(false), 6000);
    }, 1200);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const cleanWhatsappNumber = (config.whatsappNumber || '+8801712345678').replace(/[^0-9]/g, '');

  return (
    <div className="w-full min-h-screen bg-neutral-50/60 text-neutral-900 pb-20">
      <SEO 
        title="Contact Us | Rare Dreams Customer Helpline" 
        description="Get in touch with Rare Dreams. Customer care helpline, WhatsApp support, and showroom address."
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
          <span className="text-neutral-900 font-semibold">Contact Us</span>
        </div>

        {/* Top Hero Banner Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <Sparkles size={14} className="text-emerald-600" />
                <span>24/7 Dedicated Customer Care</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight font-serif">
                Get in Touch with Rare Dreams
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed">
                যেকোনো অর্ডার সংক্রান্ত তথ্য, সাইজ সহায়তা বা প্রশ্নের জন্য আমাদের কাস্টমার সার্ভিস প্রতিনিধি আপনার সেবায় সর্বদা প্রস্তুত।
              </p>
            </div>
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-inner">
              <Phone size={36} />
            </div>
          </div>
        </div>

        {/* 3 Contact Method Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* WhatsApp / Phone */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle size={22} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">WhatsApp & Helpline</h4>
              <p className="font-bold font-mono text-neutral-900 text-base mt-0.5">{config.helplineNumber || '01954710343'}</p>
              <p className="text-[11px] text-neutral-500 mt-1">Available 10:00 AM - 10:00 PM</p>
            </div>
            <a 
              href={`https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent('Hello Rare Dreams! I need help with an order.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              <span>Chat on WhatsApp</span> &rarr;
            </a>
          </div>

          {/* Email */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mail size={22} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Email Support</h4>
              <p className="font-bold text-neutral-900 text-sm mt-0.5 break-all">{config.supportEmail || 'xmrezaul.karim998@gmail.com'}</p>
              <p className="text-[11px] text-neutral-500 mt-1">Response within 12-24 hours</p>
            </div>
            <a 
              href={`mailto:${config.supportEmail || 'xmrezaul.karim998@gmail.com'}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>Send Email</span> &rarr;
            </a>
          </div>

          {/* Showroom / Address */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center">
              <MapPin size={22} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Showroom & Studio</h4>
              <p className="font-semibold text-neutral-800 text-xs mt-0.5 line-clamp-2">
                {config.address || 'Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh'}
              </p>
              <p className="text-[11px] text-neutral-500 mt-1">Open 11:00 AM - 9:00 PM</p>
            </div>
          </div>

        </div>

        {/* Contact Form Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-4">
            <h3 className="text-lg sm:text-xl font-bold text-neutral-900">
              মেসেজ পাঠান (Send us a Direct Inquiry)
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              নিচের ফর্মটি পূরণ করে আপনার বার্তা পাঠালে আমাদের টিম দ্রুত উত্তর দেবে।
            </p>
          </div>

          {isSuccess ? (
            <div className="bg-emerald-50 text-emerald-900 p-8 rounded-3xl border border-emerald-200 flex flex-col items-center justify-center text-center space-y-3 py-10 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-lg font-bold">বার্তা সফলভাবে পাঠানো হয়েছে!</h4>
              <p className="text-xs sm:text-sm text-emerald-800 max-w-sm">
                ধন্যবাদ। আমাদের কাস্টমার সার্ভিস প্রতিনিধি খুব শীঘ্রই আপনার প্রদত্ত মোবাইল নাম্বারে বা ইমেইলে যোগাযোগ করবে।
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-bold text-neutral-700">আপনার নাম (Full Name) *</label>
                  <input 
                    type="text" 
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:border-black focus:bg-white focus:ring-1 focus:ring-black transition-all"
                    placeholder="আপনার নাম লিখুন"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-bold text-neutral-700">মোবাইল নাম্বার (Phone) *</label>
                  <input 
                    type="tel" 
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:border-black focus:bg-white focus:ring-1 focus:ring-black transition-all"
                    placeholder="01XXXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold text-neutral-700">ইমেইল (Email)</label>
                  <input 
                    type="email" 
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:border-black focus:bg-white focus:ring-1 focus:ring-black transition-all"
                    placeholder="example@mail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="subject" className="text-xs font-bold text-neutral-700">বিষয় (Subject) *</label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:border-black focus:bg-white focus:ring-1 focus:ring-black transition-all cursor-pointer"
                  >
                    <option value="" disabled>বিষয় নির্বাচন করুন</option>
                    <option value="Order Status">অর্ডার ট্র্যাকিং ও ডেলিভারি তথ্য</option>
                    <option value="Returns & Exchanges">রিটার্ন ও সাইজ এক্সচেঞ্জ সহায়তা</option>
                    <option value="Product Inquiry">প্রোডাক্ট ও ফ্যাশন সাইজ পরামর্শ</option>
                    <option value="Wholesale">হোলসেল ও করপোরেট অর্ডার</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="text-xs font-bold text-neutral-700">বার্তা (Message) *</label>
                <textarea 
                  id="message"
                  name="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-xs sm:text-sm outline-none focus:border-black focus:bg-white focus:ring-1 focus:ring-black transition-all resize-none"
                  placeholder="আপনার বার্তা বা প্রশ্নের বিস্তারিত লিখুন..."
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-neutral-900 hover:bg-black text-white rounded-2xl px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>SENDING...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send Message (মেসেজ পাঠান)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
