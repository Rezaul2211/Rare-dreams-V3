import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, getDoc, updateDoc, collection, serverTimestamp, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product, ProductSpecification } from '../../types';
import { useCategoryStore } from '../../store/useCategoryStore';
import { 
  ArrowLeft, 
  Save, 
  X, 
  UploadCloud, 
  Image as ImageIcon, 
  Video, 
  RotateCw, 
  FlipHorizontal,
  Plus,
  Trash2,
  ListPlus,
  Star,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Strips undefined fields to prevent Firestore serialization errors
function cleanFirestoreObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanFirestoreObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { categories } = useCategoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [initialProductPrice, setInitialProductPrice] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: 'Men',
    subcategory: '',
    price: 0,
    comparePrice: 0,
    discount: 0,
    stockQuantity: 25,
    sizeOptions: [],
    colorOptions: [],
    material: '',
    fit: '',
    sleeve: '',
    collar: '',
    pocket: '',
    usage: '',
    specifications: [],
    description: '',
    images: [],
    videoUrl: '',
    status: 'published',
    sku: ''
  });

  const [imageUrl, setImageUrl] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');

  // Custom specification inputs
  const [customSpecLabel, setCustomSpecLabel] = useState('');
  const [customSpecValue, setCustomSpecValue] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const pData = docSnap.data() as Product;
          setFormData({
            ...pData,
            images: pData.images || (pData.image ? [pData.image] : []),
            sizeOptions: pData.sizeOptions || [],
            colorOptions: pData.colorOptions || [],
            specifications: pData.specifications || []
          });
          setInitialProductPrice(Number(pData.price || 0));
        }
      } catch (error) {
        console.error("Error fetching product", error);
      } finally {
        setFetching(false);
      }
    };
    if (isEditing) fetchProduct();
  }, [id, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const parsed = parseFloat(value);
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? 0 : (isNaN(parsed) ? 0 : parsed)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // High-performance image compressor: max 800px & 0.72 quality (~35KB-50KB per image)
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      const QUALITY = 0.72;

      if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
        createImageBitmap(file, { imageOrientation: 'from-image' })
          .then((bitmap) => {
            let width = bitmap.width;
            let height = bitmap.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(bitmap, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', QUALITY));
            } else {
              fallbackReader(file, resolve, MAX_WIDTH, MAX_HEIGHT, QUALITY);
            }
          })
          .catch(() => {
            fallbackReader(file, resolve, MAX_WIDTH, MAX_HEIGHT, QUALITY);
          });
      } else {
        fallbackReader(file, resolve, MAX_WIDTH, MAX_HEIGHT, QUALITY);
      }
    });
  };

  const fallbackReader = (
    file: File, 
    resolve: (val: string) => void,
    MAX_WIDTH = 800,
    MAX_HEIGHT = 800,
    QUALITY = 0.72
  ) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', QUALITY));
          } else {
            resolve(dataUrl);
          }
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = (Array.from(files) as File[]).filter(f => f.type && f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('সঠিক ছবি ফাইল (JPG, PNG, WEBP) নির্বাচন করুন');
      return;
    }

    const processedList: string[] = [];
    for (const file of validFiles) {
      if (file.size > 25 * 1024 * 1024) {
        alert(`${file.name} ফাইলটি অনেক বড় (২৫ মেগাবাইটের বেশি)`);
        continue;
      }
      try {
        const base64 = await processImageFile(file);
        if (base64) {
          processedList.push(base64);
        }
      } catch (err) {
        console.error("Error processing image file:", err);
      }
    }

    if (processedList.length > 0) {
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), ...processedList]
      }));
    }

    e.target.value = '';
  };

  const rotateImage = (index: number) => {
    const images = formData.images || [];
    const src = images[index];
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const newSrc = canvas.toDataURL('image/jpeg', 0.75);
        setFormData(prev => {
          const next = [...(prev.images || [])];
          next[index] = newSrc;
          return { ...prev, images: next };
        });
      }
    };
    img.src = src;
  };

  const flipImage = (index: number) => {
    const images = formData.images || [];
    const src = images[index];
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const newSrc = canvas.toDataURL('image/jpeg', 0.75);
        setFormData(prev => {
          const next = [...(prev.images || [])];
          next[index] = newSrc;
          return { ...prev, images: next };
        });
      }
    };
    img.src = src;
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('সঠিক ভিডিও ফাইল (MP4, WEBM, MOV) নির্বাচন করুন');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setFormData(prev => ({ ...prev, videoUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const addImage = () => {
    if (imageUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), imageUrl.trim()]
      }));
      setImageUrl('');
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  // Makes selected image index #0 (The Main Cover Photo)
  const makeMainImage = (index: number) => {
    setFormData(prev => {
      const images = [...(prev.images || [])];
      if (index <= 0 || index >= images.length) return prev;
      const [selected] = images.splice(index, 1);
      images.unshift(selected);
      return { ...prev, images };
    });
  };

  // Reorder left / right
  const moveImage = (index: number, direction: 'left' | 'right') => {
    setFormData(prev => {
      const images = [...(prev.images || [])];
      const targetIdx = direction === 'left' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= images.length) return prev;
      const temp = images[index];
      images[index] = images[targetIdx];
      images[targetIdx] = temp;
      return { ...prev, images };
    });
  };

  const addArrayItem = (field: 'sizeOptions' | 'colorOptions', input: string, setInput: (v: string) => void) => {
    if (input.trim()) {
      setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), input.trim()] }));
      setInput('');
    }
  };

  const removeArrayItem = (field: 'sizeOptions' | 'colorOptions', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  // Custom Specs Handler
  const addCustomSpecification = () => {
    if (customSpecLabel.trim() && customSpecValue.trim()) {
      const newSpec: ProductSpecification = {
        label: customSpecLabel.trim(),
        value: customSpecValue.trim()
      };
      setFormData(prev => ({
        ...prev,
        specifications: [...(prev.specifications || []), newSpec]
      }));
      setCustomSpecLabel('');
      setCustomSpecValue('');
    }
  };

  const removeCustomSpecification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specifications: (prev.specifications || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveError(null);
    
    let calcDiscountPct = 0;
    if (formData.discount && Number(formData.discount) > 0) {
      calcDiscountPct = Number(formData.discount);
    } else if (formData.comparePrice && formData.price && Number(formData.comparePrice) > Number(formData.price)) {
      calcDiscountPct = Math.round(((Number(formData.comparePrice) - Number(formData.price)) / Number(formData.comparePrice)) * 100);
    }

    const rawPayload = {
      ...formData,
      name: formData.name?.trim() || 'Untitled Product',
      category: formData.category || 'Men',
      subcategory: formData.subcategory || '',
      price: Number(formData.price || 0),
      comparePrice: formData.comparePrice ? Number(formData.comparePrice) : 0,
      discount: formData.discount ? Number(formData.discount) : (calcDiscountPct > 0 ? calcDiscountPct : 0),
      discountPercentage: calcDiscountPct > 0 ? calcDiscountPct : 0,
      stockQuantity: Number(formData.stockQuantity !== undefined ? formData.stockQuantity : 25),
      sizeOptions: formData.sizeOptions || [],
      colorOptions: formData.colorOptions || [],
      material: formData.material || '',
      fit: formData.fit || '',
      sleeve: formData.sleeve || '',
      collar: formData.collar || '',
      pocket: formData.pocket || '',
      usage: formData.usage || '',
      specifications: formData.specifications || [],
      description: formData.description || '',
      images: formData.images || [],
      image: formData.images?.[0] || '',
      videoUrl: formData.videoUrl || '',
      status: formData.status || 'published',
      sku: formData.sku || ''
    };

    // Clean any undefined keys before sending to Firestore
    const payload = cleanFirestoreObject(rawPayload);

    try {
      if (isEditing && id) {
        await updateDoc(doc(db, 'products', id), {
          ...payload,
          updatedAt: serverTimestamp()
        });

        const newPriceNum = Number(payload.price || 0);
        if (initialProductPrice !== null && newPriceNum < initialProductPrice && newPriceNum > 0) {
          const discountAmt = initialProductPrice - newPriceNum;
          const dropPercentage = Math.round((discountAmt / initialProductPrice) * 100);

          try {
            const alertsQ = query(
              collection(db, 'price_alerts'),
              where('productId', '==', id),
              where('status', '==', 'active')
            );
            const alertsSnap = await getDocs(alertsQ);

            alertsSnap.docs.forEach(async (alertDoc) => {
              const aData = alertDoc.data();
              const target = Number(aData.targetPrice || initialProductPrice);

              if (newPriceNum <= target) {
                await updateDoc(doc(db, 'price_alerts', alertDoc.id), {
                  status: 'triggered',
                  notifiedPrice: newPriceNum,
                  notifiedAt: serverTimestamp()
                });

                await addDoc(collection(db, 'notifications'), {
                  userId: aData.userId || null,
                  userEmail: aData.userEmail || null,
                  userPhone: aData.userPhone || null,
                  type: 'price_drop',
                  title: `Price Drop! ${payload.name}`,
                  message: `The price of "${payload.name}" has dropped to ৳${newPriceNum} (-${dropPercentage}% off)! Order before stock runs out.`,
                  productId: id,
                  productName: payload.name,
                  productImage: payload.images?.[0] || '',
                  oldPrice: initialProductPrice,
                  newPrice: newPriceNum,
                  discountPercentage: dropPercentage,
                  url: `/product/${id}`,
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            });
          } catch (notifErr) {
            console.warn("Could not dispatch price alert notifications:", notifErr);
          }
        }
      } else {
        const newDocRef = doc(collection(db, 'products'));
        await setDoc(newDocRef, {
          ...payload,
          id: newDocRef.id,
          createdAt: serverTimestamp()
        });
      }
      navigate('/admin/products');
    } catch (error: any) {
      console.error("Error saving product", error);
      const errMsg = error?.message || "প্রোডাক্ট সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।";
      setSaveError(errMsg);
      alert(`Failed to save product: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-sm font-semibold text-neutral-500">প্রোডাক্ট তথ্য লোড হচ্ছে...</div>;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 w-full font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={() => navigate('/admin/products')} 
            className="p-2.5 bg-white rounded-full border border-neutral-200 hover:bg-neutral-50 transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 truncate">
              {isEditing ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট যুক্ত করুন'}
            </h1>
            <p className="text-xs text-neutral-500">
              সঠিক ছবি, দাম এবং প্রোডাক্ট ডিটেইলস পূরণ করে সেভ করুন।
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-xl bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-neutral-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save size={15} />
            <span>{loading ? 'সংরক্ষণ হচ্ছে...' : 'প্রোডাক্ট সেভ করুন'}</span>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 text-red-500 mt-0.5" />
          <div>
            <div className="font-bold">সংরক্ষণ করতে সমস্যা হয়েছে:</div>
            <div>{saveError}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Left Column (2 Cols): Media, Basic Info, Specifications, Variants */}
        <div className="lg:col-span-2 space-y-6 w-full min-w-0">
          
          {/* 1. PRODUCT IMAGES */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-neutral-900">
                  <ImageIcon size={20} className="text-[#5B46E8]" />
                  <span>প্রোডাক্টের ছবি (Product Images)</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  প্রথম ছবিটি ওয়েবসাইটে প্রধান কভার (Main Cover) ফটো হিসেবে প্রদর্শিত হবে।
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 text-[#5B46E8] rounded-lg border border-purple-100 shrink-0">
                {formData.images?.length || 0} টি ছবি
              </span>
            </div>

            {/* Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 hover:border-[#5B46E8] rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#FAF9FF] hover:bg-purple-50/50 group"
            >
              <UploadCloud size={38} className="mx-auto text-neutral-400 group-hover:text-[#5B46E8] mb-2 transition-colors" />
              <p className="text-sm font-bold text-neutral-800">ছবি আপলোড করতে এখানে ক্লিক করুন</p>
              <p className="text-xs text-neutral-500 mt-1">
                এক সাথে একাধিক ছবি (JPG, PNG, WEBP) সিলেক্ট করতে পারেন। অটো-কমপ্রেস হয়ে সুপার ফাস্ট সেভ হবে।
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Direct Image URL input */}
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="বা ছবির অনলাইন লিংক পেস্ট করুন (Image URL)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#5B46E8]"
              />
              <button
                type="button"
                onClick={addImage}
                className="bg-[#5B46E8] hover:bg-[#4F39F6] text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
              >
                যুক্ত করুন
              </button>
            </div>

            {/* Image Preview Grid with Clear Mobile-Friendly Controls */}
            {formData.images && formData.images.length > 0 && (
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                  <span className="flex items-center gap-1.5">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span>যেকোনো ছবিকে <strong>মেইন কভার</strong> করতে সেটির "★ কভার বানান" বাটনে চাপুন।</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {formData.images.map((img, idx) => {
                    const isMain = idx === 0;
                    return (
                      <div 
                        key={idx} 
                        className={`relative rounded-2xl overflow-hidden border-2 bg-neutral-100 shadow-xs transition-all flex flex-col ${
                          isMain 
                            ? 'border-[#5B46E8] ring-2 ring-purple-200 bg-purple-50/20' 
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {/* Top Header Row for each image */}
                        <div className="p-2 bg-white border-b border-neutral-100 flex items-center justify-between">
                          <span className="text-[11px] font-black text-neutral-600">
                            ছবি #{idx + 1}
                          </span>

                          {/* Top Tools: Rotate, Flip, Delete */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => rotateImage(idx)}
                              className="p-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
                              title="Rotate 90°"
                            >
                              <RotateCw size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => flipImage(idx)}
                              className="p-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
                              title="Flip"
                            >
                              <FlipHorizontal size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                              title="Remove photo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Image Preview Container */}
                        <div 
                          onClick={() => {
                            if (!isMain) makeMainImage(idx);
                          }}
                          className="relative aspect-square w-full bg-neutral-50 overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          <img 
                            src={img} 
                            alt={`Product ${idx}`} 
                            className="w-full h-full object-cover" 
                            loading="lazy"
                          />
                        </div>

                        {/* Bottom Actions Bar (Mobile-Friendly & Always Visible) */}
                        <div className="p-2 bg-white border-t border-neutral-100 flex items-center justify-between gap-1.5">
                          {/* Reorder Arrows */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveImage(idx, 'left')}
                              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 cursor-pointer"
                              title="Move Left"
                            >
                              <ChevronLeft size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === (formData.images?.length || 0) - 1}
                              onClick={() => moveImage(idx, 'right')}
                              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 cursor-pointer"
                              title="Move Right"
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>

                          {/* Main Cover Status / Button */}
                          {isMain ? (
                            <span className="flex-1 py-1.5 px-2 bg-purple-100 text-[#5B46E8] text-[11px] font-black rounded-lg text-center flex items-center justify-center gap-1">
                              <Star size={12} className="fill-[#5B46E8]" />
                              <span>মেইন কভার ছবি</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => makeMainImage(idx)}
                              className="flex-1 py-1.5 px-2 bg-neutral-100 hover:bg-[#5B46E8] text-neutral-700 hover:text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer border border-neutral-200 hover:border-[#5B46E8]"
                            >
                              <Star size={12} />
                              <span>কভার বানান</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. BASIC PRODUCT INFO */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">
              প্রাথমিক তথ্য (Basic Information)
            </h2>
            
            {/* Product Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                প্রোডাক্টের নাম * (Product Name)
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-black outline-none"
                placeholder="যেমন: প্রিমিয়াম কটন ফরমাল শার্ট - রয়্যাল ব্লু"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                প্রোডাক্ট বিবরণ (Description)
              </label>
              <textarea
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none leading-relaxed"
                placeholder="প্রোডাক্ট সম্পর্কে প্রয়োজনীয় তথ্য লিখুন..."
              />
            </div>
          </div>

          {/* 3. PRODUCT SPECIFICATIONS & DETAILS */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <ListPlus size={20} className="text-[#5B46E8]" />
                <span>প্রোডাক্ট ডিটেইলস ও স্পেসিফিকেশন</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                কাস্টমার প্রোডাক্ট ওপেন করলে প্রোডাক্ট ডিটেইলস টেবিল আকারে এই তথ্যগুলো দেখতে পাবে।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Fabric / Material */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ফ্যাব্রিক / মেটেরিয়াল (Fabric)
                </label>
                <input
                  type="text"
                  name="material"
                  value={formData.material || ''}
                  onChange={handleChange}
                  placeholder="যেমন: ১০০% প্রিমিয়াম কটন"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['১০০% প্রিমিয়াম কটন', 'কটন সিল্ক', 'লিনেন কটন', 'পিওর সিল্ক', 'ডেনিম', 'জর্জেট'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, material: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Fit */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ফিট (Fit)
                </label>
                <input
                  type="text"
                  name="fit"
                  value={formData.fit || ''}
                  onChange={handleChange}
                  placeholder="যেমন: রেগুলার ফিট / স্লিম ফিট"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['রেগুলার ফিট', 'স্লিম ফিট', 'কমফোর্ট ফিট', 'ওভারসাইজড ফিট'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, fit: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Sleeve */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  স্লিভ / হাতা (Sleeve)
                </label>
                <input
                  type="text"
                  name="sleeve"
                  value={formData.sleeve || ''}
                  onChange={handleChange}
                  placeholder="যেমন: ফুল স্লিভ / হাফ স্লিভ"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['ফুল স্লিভ', 'হাফ স্লিভ', 'কোয়ার্টার স্লিভ', 'স্লিভলেস'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, sleeve: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Collar */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  কলার / গলা (Collar / Neck)
                </label>
                <input
                  type="text"
                  name="collar"
                  value={formData.collar || ''}
                  onChange={handleChange}
                  placeholder="যেমন: ক্লাসিক কলার / চাইনিজ কলার"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['ক্লাসিক কলার', 'ব্যান্ড / চাইনিজ কলার', 'রাউন্ড নেক', 'পোলো কলার', 'ভি-নেক', 'হুডি'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, collar: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Pocket */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  পকেট (Pocket)
                </label>
                <input
                  type="text"
                  name="pocket"
                  value={formData.pocket || ''}
                  onChange={handleChange}
                  placeholder="যেমন: ১টি চেস্ট পকেট / ২টি পকেট / পকেট নেই"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['১টি চেস্ট পকেট', '২টি পকেট', 'পকেট নেই', 'কার্গো পকেট'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, pocket: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Usage / Occasion */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  ব্যবহার / উপলক্ষ্য (Usage)
                </label>
                <input
                  type="text"
                  name="usage"
                  value={formData.usage || ''}
                  onChange={handleChange}
                  placeholder="যেমন: ক্যাজুয়াল, অফিস, ফরমাল ওয়্যার"
                  className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {['ক্যাজুয়াল, অফিস, ফরমাল ওয়্যার', 'দৈনন্দিন ব্যবহার', 'ঈদ ও উৎসব', 'পার্টি ও অনুষ্ঠান'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, usage: item }))}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-medium cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Extra Specifications */}
            <div className="pt-3 border-t border-neutral-100">
              <label className="block text-xs font-bold text-neutral-700 mb-2">
                অন্যান্য স্পেসিফিকেশন যুক্ত করুন (Custom Attribute / Specifications)
              </label>
              
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  placeholder="লেবেল (যেমন: ধোয়ার নিয়ম / অরিজিন)"
                  value={customSpecLabel}
                  onChange={(e) => setCustomSpecLabel(e.target.value)}
                  className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black"
                />
                <input
                  type="text"
                  placeholder="মান (যেমন: হ্যান্ড ওয়াশ / মেইড ইন বাংলাদেশ)"
                  value={customSpecValue}
                  onChange={(e) => setCustomSpecValue(e.target.value)}
                  className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  type="button"
                  onClick={addCustomSpecification}
                  className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>যুক্ত করুন</span>
                </button>
              </div>

              {/* List of custom specifications */}
              {formData.specifications && formData.specifications.length > 0 && (
                <div className="space-y-1.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  {formData.specifications.map((spec, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-neutral-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-700">{spec.label}:</span>
                        <span className="text-neutral-900">{spec.value}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomSpecification(sIdx)}
                        className="text-neutral-400 hover:text-red-500 p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. SIZES & COLORS */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900">সাইজ এবং কালার (Sizes & Colors)</h2>
              <span className="text-xs text-neutral-500">প্রোডাক্ট ভ্যারিয়েন্ট</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
              {/* Sizes */}
              <div className="w-full min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">উপলব্ধ সাইজসমূহ (Sizes)</label>
                <div className="flex items-center space-x-2 mb-2 w-full">
                  <input
                    type="text"
                    placeholder="যেমন: M, L, XL বা 38, 40"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    className="flex-1 min-w-0 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-black"
                  />
                  <button 
                    type="button" 
                    onClick={() => addArrayItem('sizeOptions', sizeInput, setSizeInput)} 
                    className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-black cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                
                {/* Preset quick buttons */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {['S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44', 'Free Size'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (!formData.sizeOptions?.includes(preset)) {
                          setFormData(p => ({ ...p, sizeOptions: [...(p.sizeOptions || []), preset] }));
                        }
                      }}
                      className="text-[10px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded border border-neutral-200 cursor-pointer"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(formData.sizeOptions || []).map((size, idx) => (
                    <span key={idx} className="inline-flex items-center bg-neutral-100 text-neutral-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-neutral-200">
                      {size}
                      <button type="button" onClick={() => removeArrayItem('sizeOptions', idx)} className="ml-1.5 text-neutral-400 hover:text-red-500 cursor-pointer">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="w-full min-w-0">
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">উপলব্ধ কালারসমূহ (Colors)</label>
                <div className="flex items-center space-x-2 mb-2 w-full">
                  <input
                    type="text"
                    placeholder="যেমন: Navy Blue, Black, White"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    className="flex-1 min-w-0 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-black"
                  />
                  <button 
                    type="button" 
                    onClick={() => addArrayItem('colorOptions', colorInput, setColorInput)} 
                    className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-black cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {/* Preset quick color buttons */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {['Navy Blue', 'Maroon', 'Black', 'White', 'Olive', 'Royal Blue'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        if (!formData.colorOptions?.includes(color)) {
                          setFormData(p => ({ ...p, colorOptions: [...(p.colorOptions || []), color] }));
                        }
                      }}
                      className="text-[10px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded border border-neutral-200 cursor-pointer"
                    >
                      +{color}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(formData.colorOptions || []).map((color, idx) => (
                    <span key={idx} className="inline-flex items-center bg-neutral-100 text-neutral-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-200">
                      {color}
                      <button type="button" onClick={() => removeArrayItem('colorOptions', idx)} className="ml-1.5 text-neutral-400 hover:text-red-500 cursor-pointer">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5. PRODUCT VIDEO */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-3 w-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-neutral-900">
              <Video size={20} className="text-red-500" />
              <span>প্রোডাক্ট ভিডিও (ঐচ্ছিক)</span>
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">YouTube / Video URL:</label>
                <input
                  type="url"
                  name="videoUrl"
                  value={formData.videoUrl || ''}
                  onChange={handleChange}
                  placeholder="https://www.youtube.com/watch?v=... বা ভিডিও লিংক"
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-black outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-neutral-400 uppercase">অথবা</span>
                <label htmlFor="video-upload" className="cursor-pointer inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold px-3.5 py-2 rounded-xl border border-neutral-200 transition-colors">
                  <Video size={14} />
                  <span>ভিডিও ফাইল আপলোড (MP4)</span>
                  <input
                    type="file"
                    id="video-upload"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
                {formData.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, videoUrl: '' }))}
                    className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    ভিডিও মুছুন
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column: Organization, Pricing, Stock, Status */}
        <div className="space-y-6 w-full min-w-0">
          
          {/* Organization */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">ক্যাটাগরি ও স্ট্যাটাস</h2>
            
            {/* Category */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">ক্যাটাগরি *</label>
              <select
                name="category"
                value={formData.category || (categories[0]?.title || '')}
                onChange={handleChange}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none font-bold bg-white"
              >
                {(categories || []).map((c) => (
                  <option key={c.id || c.title} value={c.title}>
                    {c.title}
                  </option>
                ))}
                {formData.category && !(categories || []).some(c => c.title === formData.category) && (
                  <option value={formData.category}>{formData.category}</option>
                )}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">সাব-ক্যাটাগরি / ট্যাগ</label>
              <input
                type="text"
                name="subcategory"
                value={formData.subcategory || ''}
                onChange={handleChange}
                placeholder="যেমন: Casual Shirt, Formal, Panjabi"
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Publication Status */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">প্রকাশের স্ট্যাটাস</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none bg-white font-medium"
              >
                <option value="published">Published (ওয়েবসাইটে দৃশ্যমান)</option>
                <option value="draft">Draft (লুকানো)</option>
              </select>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-neutral-900">মূল্য এবং স্টক</h2>

            {/* Selling Price */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                বিক্রয় মূল্য (Selling Price ৳) *
              </label>
              <input
                type="number"
                name="price"
                min="0"
                step="1"
                required
                placeholder="0"
                value={formData.price === 0 || formData.price === undefined ? '' : formData.price}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-base outline-none font-black text-neutral-900 focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Compare Price */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                পূর্বের মূল্য (Regular / Compare Price ৳)
              </label>
              <input
                type="number"
                name="comparePrice"
                min="0"
                step="1"
                placeholder="অরিজিনাল প্রাইস (যেমন: 2299)"
                value={formData.comparePrice === 0 || formData.comparePrice === undefined ? '' : formData.comparePrice}
                onChange={handleChange}
                onFocus={(e) => e.target.select()}
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none text-neutral-600 focus:ring-2 focus:ring-black"
              />
            </div>

            {/* Discount Percentage */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                ডিসকাউন্ট শতকরা (%)
              </label>
              <input
                type="number"
                name="discount"
                min="0"
                max="100"
                value={formData.discount === 0 || formData.discount === undefined ? '' : formData.discount}
                onChange={handleChange}
                placeholder="যেমন: 20"
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-sm outline-none font-bold text-red-600 focus:border-red-500"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                স্টক পরিমাণ (Stock Quantity)
              </label>
              <input
                type="number"
                name="stockQuantity"
                min="0"
                value={formData.stockQuantity === undefined ? '' : formData.stockQuantity}
                onChange={handleChange}
                placeholder="25"
                className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-black font-semibold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-900 hover:bg-black text-white py-3.5 rounded-2xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={18} />
            <span>{loading ? 'সংরক্ষণ হচ্ছে...' : 'প্রোডাক্ট সেভ করুন'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
