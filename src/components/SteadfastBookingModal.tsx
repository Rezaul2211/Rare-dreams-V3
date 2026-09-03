import React, { useState, useEffect } from 'react';
import { Order, StoreConfig } from '../types';
import { 
  X, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Phone, 
  MapPin, 
  CreditCard, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SteadfastBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  storeConfig: StoreConfig;
  onBookingSuccess: (orderId: string, result: { consignmentId: string | number; trackingCode: string; status: string }) => void;
}

export function SteadfastBookingModal({
  isOpen,
  onClose,
  order,
  storeConfig,
  onBookingSuccess
}: SteadfastBookingModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [codAmount, setCodAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    consignmentId: string | number;
    trackingCode: string;
    status: string;
  } | null>(null);

  // Initialize form whenever order changes
  useEffect(() => {
    if (order) {
      setRecipientName(order.customerName || '');
      
      // Clean phone number to 11 digits
      let cleanPhone = (order.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('880')) {
        cleanPhone = cleanPhone.substring(2);
      } else if (cleanPhone.startsWith('88')) {
        cleanPhone = cleanPhone.substring(2);
      }
      if (!cleanPhone.startsWith('0') && cleanPhone.length === 10) {
        cleanPhone = '0' + cleanPhone;
      }
      setRecipientPhone(cleanPhone);

      // Build full clean delivery address
      const parts: string[] = [];
      if (order.address) parts.push(order.address);
      if (order.thana) parts.push(`থানা: ${order.thana}`);
      if (order.district) parts.push(`জেলা: ${order.district}`);
      setRecipientAddress(parts.join(', ') || order.address || '');

      // COD calculation: if already paid (bKash/Nagad), COD is 0, else total
      const isCod = order.paymentMethod === 'cod' || order.paymentStatus !== 'paid';
      setCodAmount(isCod ? Math.round(order.total || 0) : 0);

      // Notes
      const productSummary = (order.products || [])
        .map(p => `${p.name} (x${p.quantity})`)
        .join(', ');
      setNote(order.orderNotes || `Rare Dreams: ${productSummary}`.slice(0, 150));

      setErrorMsg(null);
      setSuccessData(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleConfirmBooking = async () => {
    if (!recipientName.trim()) {
      setErrorMsg("গ্রাহকের নাম আবশ্যক।");
      return;
    }
    if (!recipientPhone.trim() || recipientPhone.trim().length !== 11 || !recipientPhone.startsWith('01')) {
      setErrorMsg("সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।");
      return;
    }
    if (!recipientAddress.trim() || recipientAddress.trim().length < 5) {
      setErrorMsg("গ্রাহকের পূর্ণাঙ্গ ডেলিভারি ঠিকানা আবশ্যক।");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        invoice: `RD-${order.id.slice(0, 10).toUpperCase()}`,
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        recipient_address: recipientAddress.trim(),
        cod_amount: codAmount,
        note: note.trim() || 'Delivery via Rare Dreams',
        apiKey: storeConfig.steadfastApiKey || undefined,
        secretKey: storeConfig.steadfastSecretKey || undefined,
      };

      const response = await fetch('/api/courier/steadfast/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "পার্সেল বুকিং ব্যর্থ হয়েছে।");
      }

      const consignmentId = data.consignment_id || data.consignment?.consignment_id || 'STDF-' + Date.now();
      const trackingCode = data.tracking_code || data.consignment?.tracking_code || String(consignmentId);
      const courierStatus = data.status || 'in_review';

      // 1. Update Firestore Order
      await updateDoc(doc(db, 'orders', order.id), {
        courierName: 'steadfast',
        courierConsignmentId: consignmentId,
        courierTrackingCode: trackingCode,
        courierStatus: courierStatus,
        courierBookedAt: new Date().toISOString(),
        courierNote: note.trim(),
        status: order.status === 'Pending' || order.status === 'Confirmed' ? 'Processing' : order.status
      });

      // 2. Add in-app notification
      try {
        await addDoc(collection(db, 'notifications'), {
          orderId: order.id,
          userId: order.userId || 'guest',
          title: `🚚 পার্সেল বুক করা হয়েছে (Steadfast)`,
          body: `আপনার অর্ডারটি Steadfast কুরিয়ারে বুকিং সম্পন্ন হয়েছে। ট্র্যাকিং কোড: ${trackingCode}`,
          type: 'order_courier',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }

      setSuccessData({
        consignmentId,
        trackingCode,
        status: courierStatus
      });

      onBookingSuccess(order.id, {
        consignmentId,
        trackingCode,
        status: courierStatus
      });

    } catch (err: any) {
      console.error("Booking error:", err);
      setErrorMsg(err.message || "স্টেডফাস্ট সার্ভারের সাথে সংযোগে ত্রুটি দেখা দিয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#FF6A00] to-[#EE0979] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Truck size={22} />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight flex items-center gap-1.5">
                <span>Steadfast কুরিয়ারে পার্সেল বুকিং</span>
              </h3>
              <p className="text-white/80 text-[11px] font-medium mt-0.5">
                অর্ডার #{order.id.slice(0, 8)} • ১-ক্লিক পিকআপ ও কাস্টমার ডেলিভারি
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs font-sans max-h-[75vh] overflow-y-auto">
          
          {/* Success State */}
          {successData ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h4 className="font-black text-emerald-950 text-base">পার্সেল সফলভাবে বুকিং হয়েছে!</h4>
                <p className="text-emerald-700 text-xs mt-1">
                  Steadfast রাইডার আপনার পিকআপ লোকেশন থেকে পার্সেল সংগ্রহ করে গ্রাহকের কাছে পৌঁছে দেবে।
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 text-left space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">Consignment ID:</span>
                  <span className="font-mono font-black text-neutral-900">{successData.consignmentId}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">Tracking Code:</span>
                  <span className="font-mono font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                    {successData.trackingCode}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-bold">স্ট্যাটাস:</span>
                  <span className="font-bold text-blue-700 uppercase">{successData.status}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href={`https://steadfast.com.bd/t/${successData.trackingCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span>লাইভ ট্র্যাকিং দেখুন</span>
                  <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* API Key Status Notice */}
              {(!storeConfig.steadfastApiKey || !storeConfig.steadfastSecretKey) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-bold">লক্ষ্য করুন:</p>
                    <p className="mt-0.5">
                      অ্যাডমিন সেটিংসে Steadfast API Key ও Secret Key সেট করা থাকলে বুকিং সরাসরি সম্পন্ন হবে। আপনি অ্যাডমিন সেটিংস থেকে চাবি সংরক্ষণ করতে পারেন।
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-start gap-2 animate-shake">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs font-bold leading-relaxed">{errorMsg}</div>
                </div>
              )}

              {/* Booking Form */}
              <div className="space-y-3.5">
                {/* 1. Recipient Name */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                    গ্রাহকের নাম (Recipient Name) *
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Customer Full Name"
                    className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  />
                </div>

                {/* 2. Recipient Phone */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-neutral-600 mb-1 flex items-center justify-between">
                    <span>গ্রাহকের ফোন নম্বর (11 Digits Phone) *</span>
                    <span className="text-[10px] text-neutral-400 font-mono">01XXXXXXXXX</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Phone size={14} />
                    </div>
                    <input
                      type="text"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                      placeholder="01712345678"
                      className="w-full bg-neutral-50 border border-neutral-300 pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
                    />
                  </div>
                </div>

                {/* 3. Full Delivery Address */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                    পূর্ণাঙ্গ ডেলিভারি ঠিকানা (Full Address with Thana & District) *
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none text-neutral-400">
                      <MapPin size={14} />
                    </div>
                    <textarea
                      rows={2}
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="House, Road, Area, Thana, District"
                      className="w-full bg-neutral-50 border border-neutral-300 pl-9 pr-3 py-2.5 rounded-xl text-xs font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00] resize-none"
                    />
                  </div>
                </div>

                {/* 4. COD Amount & Payment Status */}
                <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-orange-950 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-[#FF6A00]" />
                      <span>ক্যাশ অন ডেলিভারি (COD) কালেকশন পরিমাণ</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200 text-orange-900 uppercase">
                      {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-black text-neutral-500 text-xs">
                        ৳
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={codAmount}
                        onChange={(e) => setCodAmount(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-white border border-orange-300 pl-7 pr-3 py-2 rounded-xl text-sm font-mono font-black text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCodAmount(Math.round(order.total || 0))}
                      className="px-2.5 py-2 bg-white hover:bg-orange-100 border border-orange-300 text-orange-900 rounded-xl text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      মোট টাকা সেট
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodAmount(0)}
                      className="px-2.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 rounded-xl text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      ৳০ (পেইড)
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    কাস্টমার ডেলিভারির সময় এই টাকা Steadfast রাইডারকে প্রদান করবে।
                  </p>
                </div>

                {/* 5. Special Note */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-neutral-600 mb-1">
                    কুরিয়ার ডেলিভারি নোট (Optional Note)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="হ্যান্ডেল উইথ কেয়ার / কল করে ডেলিভারি দিন"
                    className="w-full bg-neutral-50 border border-neutral-300 px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-bold hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#FF6A00] to-[#EE0979] hover:brightness-105 active:scale-95 text-white font-black rounded-xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>বুকিং হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Truck size={16} />
                      <span>১-ক্লিকে পার্সেল বুক করুন</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
