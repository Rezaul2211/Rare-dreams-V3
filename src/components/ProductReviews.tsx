import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { Review } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { 
  Star, 
  CheckCircle2, 
  ThumbsUp, 
  MessageSquare, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  Filter, 
  Sparkles, 
  ShieldCheck,
  Send,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface ProductReviewsProps {
  productId: string;
  productName: string;
  onRatingUpdate?: (avgRating: number, totalCount: number) => void;
}

export const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  productName,
  onRatingUpdate
}) => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states (start blank)
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
          const [comment, setComment] = useState('');
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Filters & Sorting
  const [filterRating, setFilterRating] = useState<number | 'all' | 'photos' | 'verified'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  // Admin Reply modal / form state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Enlarged image viewer state
  const [activeImageModal, setActiveImageModal] = useState<string | null>(null);

  // Voted reviews tracking
  const [votedReviews, setVotedReviews] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('rare_dreams_voted_reviews');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Fetch reviews from Firestore (Only genuine real reviews)
  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'reviews'),
          where('productId', '==', productId)
        );
        const snapshot = await getDocs(q);
        const fetched: Review[] = [];
        snapshot.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...docSnap.data() } as Review);
        });

        if (isMounted) {
          setReviews(fetched);
          
          // Compute authentic average rating and count
          const total = fetched.length;
          const sum = fetched.reduce((acc, r) => acc + (r.rating || 5), 0);
          const avg = total > 0 ? Number((sum / total).toFixed(1)) : 0;
          
          if (onRatingUpdate) {
            onRatingUpdate(avg, total);
          }
        }
      } catch (err) {
        console.warn("Could not load reviews from Firestore:", err);
        if (isMounted) {
          setReviews([]);
          if (onRatingUpdate) {
            onRatingUpdate(0, 0);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReviews();
    return () => {
      isMounted = false;
    };
  }, [productId]);



  // Compress image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 700;
        const MAX_HEIGHT = 700;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.65);
        setReviewImage(compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Check verified purchase against Firestore Orders specifically for this product
  const checkVerifiedCustomer = async (): Promise<boolean> => {
    try {
      if (!user) return false;
      // Store Admin is always allowed
      if (user?.email === 'xmrezaul.karim998@gmail.com' || user?.role === 'admin') return true;

      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('userId', '==', user.uid));
      const snap = await getDocs(q);

      let found = false;
      snap.forEach((docSnap) => {
        const o = docSnap.data();
        const orderProducts = o.products || o.items || [];
        const containsItem = orderProducts.some((item: any) => 
          item.id === productId || 
          item.productId === productId ||
          (item.name && item.name.toLowerCase().includes(productName.toLowerCase()))
        );
        if (containsItem) found = true;
      });
      
      // Fallback: Check if they bought as guest with same email
      if (!found && user.email) {
        const snap2 = await getDocs(query(ordersRef, where('email', '==', user.email.trim().toLowerCase()), limit(10)));
        snap2.forEach((docSnap) => {
           const o = docSnap.data();
           if (o.email && o.email.toLowerCase() === user.email.toLowerCase()) {
              const orderProducts = o.products || o.items || [];
              const containsItem = orderProducts.some((item: any) => 
                item.id === productId || 
                item.productId === productId ||
                (item.name && item.name.toLowerCase().includes(productName.toLowerCase()))
              );
              if (containsItem) found = true;
           }
        });
      }

      return found;
    } catch (err) {
      console.warn("Verified buyer check failed:", err);
      return false;
    }
  };

  // Submit review handler
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    if (!user) {
      alert('Please log in to submit a review.');
      return;
    }

    if (!comment.trim()) {
      alert('Please enter your comment');
      return;
    }

    setSubmitting(true);
    try {
      const isVerified = await checkVerifiedCustomer();

      if (!isVerified) {
        const msg = 'Sorry! Only verified customers who purchased this product can leave a review.';
        setVerificationError(msg);
        setSubmitting(false);
        return;
      }

      const newReviewData = {
        productId,
        userId: user.uid,
        userName: user.displayName || user.email.split('@')[0] || 'Verified Customer',
        userPhone: user.phoneNumber || '',
        userEmail: user.email || '',
        rating,
        comment: comment.trim(),
        images: reviewImage ? [reviewImage] : [],
        isVerifiedPurchase: true,
        helpfulCount: 0,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'reviews'), newReviewData);
      const createdReview: Review = { id: docRef.id, ...newReviewData };

      setReviews((prev) => [createdReview, ...prev]);
      setSubmitSuccess(true);
      setComment('');
      setReviewImage(null);
            setShowForm(false);

      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      console.error("Error adding review:", err);
      setVerificationError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Vote helpful handler
  const handleVoteHelpful = async (reviewId: string) => {
    if (votedReviews[reviewId]) return;

    const newVoted = { ...votedReviews, [reviewId]: true };
    setVotedReviews(newVoted);
    try {
      localStorage.setItem('rare_dreams_voted_reviews', JSON.stringify(newVoted));
    } catch (e) {
      console.warn("Storage error", e);
    }

    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r
      )
    );

    if (!reviewId.startsWith('sample-') && !reviewId.startsWith('local-')) {
      try {
        const ref = doc(db, 'reviews', reviewId);
        await updateDoc(ref, { helpfulCount: increment(1) });
      } catch (err) {
        console.warn("Could not sync vote to Firestore", err);
      }
    }
  };

  // Admin reply submission
  const handleAdminReply = async (reviewId: string) => {
    if (!adminReplyText.trim()) return;
    setReplySubmitting(true);
    try {
      if (!reviewId.startsWith('sample-') && !reviewId.startsWith('local-')) {
        const ref = doc(db, 'reviews', reviewId);
        await updateDoc(ref, {
          adminReply: adminReplyText.trim(),
          adminReplyAt: new Date().toISOString()
        });
      }

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, adminReply: adminReplyText.trim() } : r
        )
      );

      setReplyingToId(null);
      setAdminReplyText('');
    } catch (err) {
      console.error("Error adding admin reply:", err);
    } finally {
      setReplySubmitting(false);
    }
  };

  // Stats computation
  const totalCount = reviews.length;
  const ratingSum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
  const avgRating = totalCount > 0 ? (ratingSum / totalCount).toFixed(1) : '0.0';

  const countsByStars = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const starKey = Math.min(Math.max(Math.round(r.rating), 1), 5) as 1 | 2 | 3 | 4 | 5;
    countsByStars[starKey] = (countsByStars[starKey] || 0) + 1;
  });

  // Filtered & Sorted reviews
  const filteredReviews = reviews.filter((r) => {
    if (filterRating === 'photos') return r.images && r.images.length > 0;
    if (filterRating === 'verified') return r.isVerifiedPurchase;
    if (typeof filterRating === 'number') return r.rating === filterRating;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'highest') return b.rating - a.rating;
    if (sortBy === 'lowest') return a.rating - b.rating;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const ratingLabels: Record<number, string> = {
    5: 'Excellent (5/5)',
    4: 'Very Good (4/5)',
    3: 'Good (3/5)',
    2: 'Fair (2/5)',
    1: 'Poor (1/5)',
  };

  return (
    <section id="customer-reviews" className="mt-10 pt-8 border-t border-neutral-200/80 w-full">
      {/* Compact Clean Header Bar */}
      <div className="flex items-center justify-between bg-neutral-50 px-4 py-3 rounded-2xl border border-neutral-200/80 mb-5">
        <div className="flex items-center space-x-2.5">
          <span className="text-xs sm:text-sm font-black text-neutral-900">
            {'Reviews'} ({totalCount})
          </span>
          <span className="text-neutral-300">•</span>
          <div className="flex items-center space-x-1 text-xs font-bold text-neutral-800 bg-white px-2 py-0.5 rounded-lg border border-neutral-200/60 shadow-2xs">
            <Star size={13} className="text-amber-400 fill-amber-400" />
            <span>{avgRating}</span>
          </div>
          <span className="hidden sm:inline-flex items-center space-x-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            <ShieldCheck size={12} className="text-emerald-600" />
            <span>{'Verified Buyer Only'}</span>
          </span>
        </div>

        <button
          onClick={() => {
            if (!user) {
              alert('Please log in first to write a review.');
              return;
            }
            setShowForm(!showForm);
            setVerificationError(null);
          }}
          className="inline-flex items-center space-x-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <MessageSquare size={13} />
          <span>{showForm ? ('Close') : ('Write Review')}</span>
        </button>
      </div>

      {/* Success Banner Notification */}
      {submitSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex items-center space-x-3 text-emerald-900 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wide">{'Thank You! Your review has been published'}</h4>
            <p className="text-xs text-emerald-700 font-medium">{'Your feedback will help other shoppers make informed choices.'}</p>
          </div>
        </div>
      )}

      {/* WRITE A REVIEW FORM MODAL / COLLAPSIBLE */}
      {showForm && (
        <div className="bg-amber-50/60 border-2 border-amber-200/90 rounded-3xl p-5 sm:p-7 mb-8 shadow-md animate-in fade-in slide-in-from-top-4 relative">
          <button
            onClick={() => setShowForm(false)}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-200/50 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="flex items-center space-x-2 text-amber-800 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles size={16} className="text-amber-600" />
            <span>{'Write a Review'}</span>
          </div>

          <h3 className="text-lg font-black text-neutral-900 tracking-tight mb-4">
            {`Review ${productName}`}
          </h3>

          {/* Verification Warning Error if not a verified buyer */}
          {verificationError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold mb-5 flex items-center space-x-2.5 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 text-red-600" />
              <span>{verificationError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReview} className="space-y-5">
            {/* Interactive Rating Stars */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                {'Your Rating *'}
              </label>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-white px-3.5 py-2 rounded-2xl border border-neutral-300 shadow-2xs">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      <Star
                        size={26}
                        className={
                          s <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                            : 'text-neutral-200 fill-neutral-200'
                        }
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-extrabold text-neutral-800 bg-white px-3 py-2 rounded-xl border border-neutral-200">
                  {ratingLabels[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* Comment Textarea */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                {'Your Review / Comment *'}
              </label>
              <textarea
                required
                autoComplete="off"
                rows={3}
                placeholder={
                  'Write about fabric quality, fitting, delivery experience...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-2xl px-4 py-3 text-xs font-medium text-neutral-900 outline-none focus:ring-2 focus:ring-black leading-relaxed"
              />
            </div>

            {/* Photo Upload Attachment */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                {'Attach Product Photo (Optional)'}
              </label>

              {reviewImage ? (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-amber-400 group shadow-sm">
                  <img src={reviewImage} alt="Upload Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setReviewImage(null)}
                    className="absolute top-1 right-1 bg-black/80 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center space-x-2 bg-white border border-dashed border-neutral-400 hover:border-black px-4 py-2.5 rounded-2xl text-xs font-bold text-neutral-700 cursor-pointer transition-colors shadow-2xs">
                  <Upload size={16} className="text-amber-600" />
                  <span>{'Upload Review Photo'}</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-black hover:bg-neutral-800 text-white px-7 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center space-x-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>{'Submit Review'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SORT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-100/80 p-3 rounded-2xl mb-6 border border-neutral-200/60">
        {/* Rating Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1 hidden sm:inline-block">
            <Filter size={12} className="inline mr-1" />
            {'Filter:'}
          </span>

          <button
            onClick={() => setFilterRating('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterRating === 'all'
                ? 'bg-black text-white shadow-2xs'
                : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
            }`}
          >
            {`All (${totalCount})`}
          </button>

          <button
            onClick={() => setFilterRating('verified')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              filterRating === 'verified'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>{'Verified Only'}</span>
          </button>

          <button
            onClick={() => setFilterRating('photos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              filterRating === 'photos'
                ? 'bg-purple-800 text-white shadow-2xs'
                : 'bg-white text-purple-900 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <ImageIcon size={13} />
            <span>{'With Photos'}</span>
          </button>

          {[5, 4, 3].map((s) => (
            <button
              key={s}
              onClick={() => setFilterRating(filterRating === s ? 'all' : s)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filterRating === s
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-white text-neutral-700 hover:bg-neutral-200 border border-neutral-200'
              }`}
            >
              <span>{s}★</span>
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline-block">
            {'Sort:'}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-black cursor-pointer shadow-2xs"
          >
            <option value="recent">{'Most Recent'}</option>
            <option value="highest">{'Highest Rating'}</option>
            <option value="lowest">{'Lowest Rating'}</option>
          </select>
        </div>
      </div>

      {/* REVIEWS LIST */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-neutral-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-neutral-200/80 shadow-2xs">
          <MessageSquare size={36} className="text-neutral-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
            {'No Reviews Found'}
          </h4>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            {'Be the first to share your experience with this product!'}
          </p>
          <button
            onClick={() => {
              if (!user) {
                alert('Please log in first to write a review.');
                return;
              }
              setShowForm(true);
            }}
            className="mt-4 inline-flex items-center space-x-2 bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <span>{'Write First Review'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-2xs hover:shadow-xs transition-shadow"
            >
              {/* Review Card Top Row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center space-x-3">
                  {/* User Avatar Circle */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-950 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs uppercase">
                    {rev.userName ? rev.userName.charAt(0) : 'C'}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-neutral-900">{rev.userName}</h4>
                      {rev.isVerifiedPurchase && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                          <span>{'Verified Buyer'}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium">
                      {new Date(rev.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Rating Stars */}
                <div className="flex items-center space-x-0.5 bg-neutral-50 px-2.5 py-1 rounded-xl border border-neutral-100">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      className={
                        star <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-neutral-200 fill-neutral-200'
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Comment Content */}
              <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-normal mb-4">
                {rev.comment}
              </p>

              {/* Photo attachments */}
              {rev.images && rev.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {rev.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageModal(img)}
                      className="w-20 h-20 rounded-2xl overflow-hidden border border-neutral-200 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                    >
                      <img src={img} alt="Customer attachment" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Admin Official Reply Box */}
              {rev.adminReply && (
                <div className="mt-4 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                    <ShieldCheck size={14} className="text-amber-600" />
                    <span>Rare Dreams Official Response</span>
                  </div>
                  <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                    {rev.adminReply}
                  </p>
                </div>
              )}

              {/* Footer Actions: Helpful Vote & Admin Reply Trigger */}
              <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                <button
                  onClick={() => handleVoteHelpful(rev.id)}
                  disabled={votedReviews[rev.id]}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    votedReviews[rev.id]
                      ? 'bg-neutral-100 text-neutral-900 border border-neutral-300'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200/80'
                  }`}
                >
                  <ThumbsUp size={13} className={votedReviews[rev.id] ? 'text-amber-600 fill-amber-600' : ''} />
                  <span>
                    {votedReviews[rev.id] 
                      ? ('Helpful!') 
                      : ('Helpful')}
                  </span>
                  {(rev.helpfulCount || 0) > 0 && (
                    <span className="bg-white px-1.5 py-0.5 rounded-md text-[10px] font-black border border-neutral-200">
                      {rev.helpfulCount}
                    </span>
                  )}
                </button>

                {/* Admin Reply Button if user is Admin */}
                {(user?.role === 'admin' || user?.email === 'xmrezaul.karim998@gmail.com') && !rev.adminReply && (
                  <button
                    onClick={() => {
                      setReplyingToId(replyingToId === rev.id ? null : rev.id);
                      setAdminReplyText('');
                    }}
                    className="text-xs font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    + Reply as Admin
                  </button>
                )}
              </div>

              {/* Admin Reply Form */}
              {replyingToId === rev.id && (
                <div className="mt-3 pt-3 border-t border-amber-200 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type official store reply..."
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    className="flex-1 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 outline-none"
                  />
                  <button
                    onClick={() => handleAdminReply(rev.id)}
                    disabled={replySubmitting}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ENLARGED PHOTO MODAL */}
      {activeImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative max-w-2xl w-full max-h-[85vh] bg-black rounded-3xl overflow-hidden p-2">
            <button
              onClick={() => setActiveImageModal(null)}
              className="absolute top-4 right-4 bg-white/20 hover:bg-white text-white hover:text-black p-2 rounded-full transition-colors z-10 cursor-pointer"
            >
              <X size={20} />
            </button>
            <img src={activeImageModal} alt="Customer Enlarge" className="w-full h-full object-contain max-h-[80vh] mx-auto rounded-2xl" />
          </div>
        </div>
      )}
    </section>
  );
};
