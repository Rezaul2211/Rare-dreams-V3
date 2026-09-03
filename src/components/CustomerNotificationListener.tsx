import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playOfferNotificationSound } from '../utils/audioAlert';
import { showSystemNotification } from '../lib/pushNotifications';
import { Sparkles, ArrowRight, X, Tag } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface CampaignBroadcast {
  id: string;
  title: string;
  body: string;
  url?: string;
  sentAt?: any;
}

export const CustomerNotificationListener: React.FC = () => {
  const [activeBroadcast, setActiveBroadcast] = useState<CampaignBroadcast | null>(null);
  const isInitialMount = useRef(true);
  const appStartTime = useRef(new Date());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Listen to push_campaigns collection
    const campaignsQuery = query(
      collection(db, 'push_campaigns'),
      orderBy('sentAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      campaignsQuery,
      (snapshot) => {
        if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const sentAtDate = data.sentAt?.toDate ? data.sentAt.toDate() : new Date();

            if (sentAtDate.getTime() >= appStartTime.current.getTime() - 10000) {
              const title = data.title || '🔥 বিশেষ অফার - Rare Dreams';
              const body = data.body || 'আমাদের এক্সক্লুসিভ অফার এখনই দেখে নিন!';
              const url = data.url || '/shop';

              playOfferNotificationSound();

              showSystemNotification(title, {
                body,
                icon: '/pwa-192x192.png',
                tag: 'campaign_' + change.doc.id,
                url
              });

              setActiveBroadcast({
                id: change.doc.id,
                title,
                body,
                url,
                sentAt: data.sentAt
              });
            }
          }
        });
      },
      (error) => {
        console.warn('Campaign listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Hide banner if already on the admin panel or user dismissed
  if (!activeBroadcast || location.pathname.startsWith('/admin')) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:right-6 md:max-w-md z-[1050] bg-neutral-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-amber-500/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-neutral-950 flex items-center justify-center shrink-0 shadow-md">
            <Sparkles size={20} className="animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                <Tag size={10} /> নতুন অফার
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mt-1 leading-snug">
              {activeBroadcast.title}
            </h4>
            <p className="text-xs text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
              {activeBroadcast.body}
            </p>
          </div>
          <button
            onClick={() => setActiveBroadcast(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close offer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            onClick={() => setActiveBroadcast(null)}
            className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors font-medium cursor-pointer"
          >
            পরে
          </button>
          <button
            onClick={() => {
              const destination = activeBroadcast.url || '/shop';
              setActiveBroadcast(null);
              navigate(destination);
            }}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>অফার দেখুন</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CustomerNotificationListener;
