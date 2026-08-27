import React from 'react';
import { X, RefreshCw, Lock, Award, CheckCircle, FileText } from 'lucide-react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';

interface PolicyModalProps {
  type: 'returns' | 'privacy' | 'terms' | 'license' | null;
  onClose: () => void;
}

export default function PolicyModal({ type, onClose }: PolicyModalProps) {
  const { config } = useStoreConfigStore();

  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 max-w-xl w-full shadow-[0_20px_50px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.6)] space-y-5 border border-white/20 relative max-h-[85vh] overflow-y-auto font-sans will-change-[backdrop-filter,transform]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100/80 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {type === 'returns' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <RefreshCw size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Return & Replacement Policy</h3>
                <p className="text-xs text-neutral-400 font-medium">7 Days Easy Return & Replacement Guarantee</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 leading-relaxed">
              <p className="font-medium">
                If you encounter any sizing issues, defects, or simply change your mind after receiving your Rare Dreams order, you can easily exchange or return the product.
              </p>

              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100 space-y-2">
                <h4 className="font-bold text-emerald-900 text-xs">Terms & Conditions for Returns:</h4>
                <ul className="space-y-1.5 list-disc pl-4 text-emerald-950">
                  <li>Notify our customer helpline within <strong>7 days</strong> of package delivery.</li>
                  <li>Original brand tags, barcode, and packaging must remain intact and unworn.</li>
                  <li>Washed, altered, or used items are not eligible for replacement.</li>
                  <li>For size mismatch issues, free doorstep exchange is provided promptly.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-neutral-900">Return Process:</h4>
                <p>
                  Send your Order ID and photo of the item to our WhatsApp Helpline (<span className="font-bold font-mono">{config.whatsappNumber}</span>). Our support team will arrange a doorstep pickup.
                </p>
              </div>
            </div>
          </div>
        )}

        {type === 'license' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Award size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Business Verification & License</h3>
                <p className="text-xs text-neutral-400 font-medium">Official Government Trade License & E-Commerce Registration</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-neutral-700 leading-relaxed">
              <p className="font-medium">
                Rare Dreams is an officially registered, licensed brand complying with national digital commerce regulations.
              </p>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-2.5 font-mono">
                <div className="flex justify-between items-center border-b border-neutral-200/60 pb-1.5">
                  <span className="text-neutral-500 text-[11px] font-sans font-bold">Brand Name:</span>
                  <span className="font-bold text-neutral-900 font-sans">Rare Dreams Bangladesh</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-200/60 pb-1.5">
                  <span className="text-neutral-500 text-[11px] font-sans font-bold">Trade License No:</span>
                  <span className="font-bold text-amber-700">{config.tradeLicenseNo || 'TRAD/DNCC/012984/2026'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-200/60 pb-1.5">
                  <span className="text-neutral-500 text-[11px] font-sans font-bold">E-TIN Registration:</span>
                  <span className="font-bold text-neutral-800">{config.tinNo || '849201948123'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500 text-[11px] font-sans font-bold">DBID ID:</span>
                  <span className="font-bold text-emerald-700">{config.dbidNo || 'DBID-2026-884129'}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <CheckCircle size={18} className="shrink-0" />
                <span className="font-medium text-xs">All digital payments and bKash/Nagad merchant accounts are fully verified.</span>
              </div>
            </div>
          </div>
        )}

        {type === 'privacy' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Privacy Policy</h3>
                <p className="text-xs text-neutral-400 font-medium">Customer Data Protection & Privacy</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-700 leading-relaxed">
              <p>
                Rare Dreams ensures the highest standards of data security and customer privacy. Your name, contact number, and shipping address are strictly used for order processing and delivery fulfillment.
              </p>
              <p>
                We never sell, rent, or share personal user data with third-party advertising networks or external vendors.
              </p>
            </div>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 border-b border-neutral-100 pb-3 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#5B4EFF] flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Terms of Service</h3>
                <p className="text-xs text-neutral-400 font-medium">Store Guidelines & Ordering Terms</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-neutral-700 leading-relaxed">
              <p>
                1. Please ensure that you provide an accurate shipping address and active 11-digit mobile number during checkout.
              </p>
              <p>
                2. For Cash on Delivery orders, customers are welcome to inspect outer packaging in presence of the courier rider upon delivery.
              </p>
              <p>
                3. Products are dispatched subject to real-time inventory availability.
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="bg-neutral-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
