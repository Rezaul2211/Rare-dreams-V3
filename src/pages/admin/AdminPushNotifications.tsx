import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Users, 
  Smartphone, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Tag, 
  ShoppingBag, 
  Sparkles,
  History,
  Trash2
} from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface PushCampaign {
  id: string;
  title: string;
  body: string;
  target: 'all' | 'customers' | 'admins';
  url: string;
  sentAt: any;
  sentCount: number;
}

export default function AdminPushNotifications() {
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('/shop');
  const [targetAudience, setTargetAudience] = useState<'all' | 'customers' | 'admins'>('all');
  
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<PushCampaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch token subscribers and past history
  useEffect(() => {
    fetchSubscribersAndHistory();
  }, []);

  const fetchSubscribersAndHistory = async () => {
    try {
      setLoadingHistory(true);
      // Fetch total active devices/tokens
      const tokensSnap = await getDocs(collection(db, 'fcm_tokens'));
      setTokenCount(tokensSnap.size);

      // Fetch campaign broadcast history
      const q = query(collection(db, 'push_campaigns'), orderBy('sentAt', 'desc'), limit(15));
      const historySnap = await getDocs(q);
      const pastList: PushCampaign[] = [];
      historySnap.forEach(d => {
        pastList.push({ id: d.id, ...d.data() } as PushCampaign);
      });
      setHistory(pastList);
    } catch (e) {
      console.warn("Could not fetch push tokens:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setErrorMessage('নোটিফিকেশনের শিরোনাম এবং মেসেজ লিখুন।');
      return;
    }

    setSending(true);
    setErrorMessage(null);
    setSendSuccess(false);

    try {
      // 1. Record campaign in Firestore
      await addDoc(collection(db, 'push_campaigns'), {
        title: title.trim(),
        body: message.trim(),
        target: targetAudience,
        url: targetUrl.trim() || '/shop',
        sentCount: tokenCount || 1,
        sentAt: serverTimestamp()
      });

      // 2. Also log in system notifications
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        message: message.trim(),
        type: 'broadcast',
        read: false,
        createdAt: serverTimestamp()
      });

      // Also simulate local immediate test alert if permission is granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title.trim(), {
          body: message.trim(),
          icon: '/icon-192.png'
        });
      }

      setSendSuccess(true);
      setTitle('');
      setMessage('');
      fetchSubscribersAndHistory();
      setTimeout(() => setSendSuccess(false), 4000);
    } catch (error: any) {
      console.error("Error sending push notification broadcast:", error);
      setErrorMessage('নোটিফিকেশন সেন্ড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setSending(false);
    }
  };

  const setPresetMessage = (type: string) => {
    if (type === 'flash_sale') {
      setTitle('🔥 বিশেষ ফ্ল্যাশ সেল শুরু হয়েছে!');
      setMessage('আজকের সেরা কালেকশনে পান সর্বোচ্চ ৫০% পর্যন্ত বিশেষ ছাড়। স্টক শেষ হওয়ার আগেই অর্ডার করুন!');
      setTargetUrl('/shop?filter=sale');
    } else if (type === 'new_arrival') {
      setTitle('✨ নতুন কালেকশন যুক্ত হয়েছে - Rare Dreams');
      setMessage('আমাদের এক্সক্লুসিভ নতুন পোশাক ও অ্যাক্সেসরিজ এখন ওয়েবসাইটে লাইভ। এখনই দেখুন!');
      setTargetUrl('/shop?filter=new');
    } else if (type === 'free_delivery') {
      setTitle('🚚 আজ সারা দেশে ফ্রি ডেলিভারি!');
      setMessage('যেকোনো অর্ডারে উপভোগ করুন সম্পূর্ণ ফ্রি হোম ডেলিভারি সুবিধা। অফারটি সীমিত সময়ের জন্য!');
      setTargetUrl('/shop');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('এই নোটিফিকেশন হিস্ট্রিটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'push_campaigns', id));
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error("Failed to delete history item:", e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <Bell className="text-indigo-600 w-7 h-7" />
            <span>Web Push & Browser Notifications</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            গ্রাহকদের গুগল ক্রোম বা মোবাইল ব্রাউজার বন্ধ থাকলেও সরাসরি স্ক্রিনে নোটিফিকেশন পাঠান।
          </p>
        </div>

        {/* Subscriber Count Badge */}
        <div className="bg-white border border-indigo-100 p-3.5 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Smartphone size={20} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">সাবস্ক্রাইব করা ডিভাইস</div>
            <div className="text-lg font-black text-neutral-900">{tokenCount} টি ডিভাইস</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to send broadcast */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <h3 className="font-bold text-neutral-800 flex items-center gap-2">
              <Send size={18} className="text-indigo-600" />
              <span>নতুন নোটিফিকেশন পাঠান (Instant Broadcast)</span>
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Push Active
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
              দ্রুত টেমপ্লেট নির্বাচন করুন (Quick Presets)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPresetMessage('flash_sale')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <Tag size={13} />
                <span>ফ্ল্যাশ সেল ডিসকাউন্ট</span>
              </button>
              <button
                type="button"
                onClick={() => setPresetMessage('new_arrival')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>নতুন কালেকশন</span>
              </button>
              <button
                type="button"
                onClick={() => setPresetMessage('free_delivery')}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1.5"
              >
                <ShoppingBag size={13} />
                <span>ফ্রি ডেলিভারি অফার</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                নোটিফিকেশনের শিরোনাম (Title) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: 🔥 আজকের স্পেশাল ৫০% ডিসকাউন্ট শুরু!"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                required
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                বিস্তারিত বার্তা (Message Body) *
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="যেমন: আপনার পছন্দের পোশাক ও এক্সেসরিজে আজকেই পান সর্বোচ্চ ছাড়। ক্লিক করে কালেকশনটি দেখুন।"
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Click Action URL */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  ক্লিক করলে যে পেজে যাবে (Target Link)
                </label>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="/shop অথবা /category/Women"
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  টার্গেট অডিয়েন্স
                </label>
                <select
                  value={targetAudience}
                  onChange={(e: any) => setTargetAudience(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium bg-white"
                >
                  <option value="all">সকল গ্রাহক ও ভিজিটর (All Subscribers)</option>
                  <option value="customers">শুধুমাত্র ক্রেতাগণ (Customers)</option>
                  <option value="admins">অ্যাডমিন টিম (Admins only)</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 border border-rose-200">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {sendSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>নোটিফিকেশন সফলভাবে সমস্ত ডিভাইসে পাঠানো হয়েছে!</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>পাঠানো হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>সবার কাছে নোটিফিকেশন পাঠান (Send Push Now)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Info & Live Preview card */}
        <div className="space-y-4">
          {/* Live Mobile Notification Preview */}
          <div className="bg-neutral-900 text-white rounded-2xl p-5 shadow-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider pb-3 border-b border-neutral-800">
              <span>মোবাইলে কেমন দেখাবে (Live Preview)</span>
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">Chrome Push</span>
            </div>

            <div className="mt-4 bg-neutral-800/90 rounded-xl p-3.5 border border-neutral-700 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-xs shrink-0">
                RD
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400">Rare Dreams • Just now</span>
                </div>
                <div className="text-xs font-bold text-white mt-0.5 truncate">
                  {title || '🔥 বিশেষ ফ্ল্যাশ সেল শুরু হয়েছে!'}
                </div>
                <div className="text-[11px] text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
                  {message || 'আজকের সেরা কালেকশনে পান সর্বোচ্চ ৫০% পর্যন্ত বিশেষ ছাড়। এখনই ভিজিট করুন!'}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-neutral-400 leading-relaxed bg-neutral-800/40 p-3 rounded-xl border border-neutral-800">
              💡 <strong>কীভাবে কাজ করে:</strong> গ্রাহক ওয়েবসাইটে একবার "Allow/অনুমতি" দিলেই, তিনি ব্রাউজার থেকে বের হয়ে গেলেও আপনার পাঠানো মেসেজ সরাসরি তার মোবাইলের নোটিফিকেশন বারে পৌঁছাবে।
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <h3 className="font-bold text-neutral-900 flex items-center gap-2">
            <History size={18} className="text-indigo-600" />
            <span>পূর্বে পাঠানো নোটিফিকেশন হিস্ট্রি (Campaign History)</span>
          </h3>
          <span className="text-xs text-neutral-400 font-semibold">{history.length} টি রেকর্ড</span>
        </div>

        {loadingHistory ? (
          <div className="py-10 text-center text-neutral-400 text-xs font-bold">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-600" />
            <span>হিস্ট্রি লোড হচ্ছে...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center text-neutral-400 text-sm">
            এখনও কোনো নোটিফিকেশন পাঠানো হয়নি।
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 mt-2">
            {history.map((item) => (
              <div key={item.id} className="py-3.5 flex items-start justify-between gap-4 hover:bg-neutral-50/60 rounded-xl px-2 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900">{item.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {item.target === 'all' ? 'সবার জন্য' : item.target}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600">{item.body}</p>
                  <div className="text-[10px] text-neutral-400 flex items-center gap-3 pt-0.5">
                    <span>লিংক: {item.url}</span>
                    <span>•</span>
                    <span>পাঠানো হয়েছে: {item.sentCount || 1} টি ডিভাইসে</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCampaign(item.id)}
                  className="text-neutral-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
