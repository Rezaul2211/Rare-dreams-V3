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
  Layers,
  Sparkles
} from 'lucide-react';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { categories } = useCategoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [initialProductPrice, setInitialProductPrice] = useState<number | null>(null);

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

  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
        createImageBitmap(file, { imageOrientation: 'from-image' })
          .then((bitmap) => {
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
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
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
              fallbackReader(file, resolve);
            }
          })
          .catch(() => {
            fallbackReader(file, resolve);
          });
      } else {
        fallbackReader(file, resolve);
      }
    });
  };

  const fallbackReader = (file: File, resolve: (val: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
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
            resolve(canvas.toDataURL('image/jpeg', 0.85));
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
      alert('Please select valid image files (JPG, PNG, WEBP)');
      return;
    }

    const processedList: string[] = [];
    for (const file of validFiles) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`${file.name} exceeds 20MB limit.`);
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
        const newSrc = canvas.toDataURL('image/jpeg', 0.85);
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
        const newSrc = canvas.toDataURL('image/jpeg', 0.85);
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
      alert('Please select a valid video file (MP4, WEBM, MOV)');
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

  const makeMainImage = (index: number) => {
    setFormData(prev => {
      const images = [...(prev.images || [])];
      if (index <= 0 || index >= images.length) return prev;
      const [selected] = images.splice(index, 1);
      images.unshift(selected);
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
    
    let calcDiscountPct = 0;
    if (formData.discount && Number(formData.discount) > 0) {
      calcDiscountPct = Number(formData.discount);
    } else if (formData.comparePrice && formData.price && Number(formData.comparePrice) > Number(formData.price)) {
      calcDiscountPct = Math.round(((Number(formData.comparePrice) - Number(formData.price)) / Number(formData.comparePrice)) * 100);
    }

    const payload = {
      ...formData,
      image: formData.images?.[0] || '',
      discount: formData.discount ? Number(formData.discount) : (calcDiscountPct > 0 ? calcDiscountPct : undefined),
      discountPercentage: calcDiscountPct > 0 ? calcDiscountPct : undefined,
    };

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
    } catch (error) {
      console.error("Error saving product", error);
      alert("Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-sm font-semibold text-neutral-500">Loading product details...</div>;

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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Left Column (2 Cols): Media, Basic Info, Specifications, Variants */}
        <div className="lg:col-span-2 space-y-6 w-full min-w-0">
          
          {/* 1. PRODUCT IMAGES */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-neutral-900">
                <ImageIcon size={20} className="text-blue-600" />
                <span>প্রোডাক্ট ছবি (Product Images)</span>
              </h2>
              <span className="text-xs text-neutral-500">
                {formData.images?.length || 0} টি ছবি আপলোড করা হয়েছে
              </span>
            </div>

            {/* Upload Box */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 hover:border-black rounded-2xl p-6 text-center cursor-pointer transition-colors bg-neutral-50 hover:bg-neutral-100/70"
            >
              <UploadCloud size={36} className="mx-auto text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-neutral-800">ছবি আপলোড করতে ক্লিক করুন</p>
              <p className="text-xs text-neutral-500 mt-1">
                JPG, PNG, WEBP ফরম্যাট সাপোর্ট করে (যত ইচ্ছা ছবি দিতে পারেন)
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
                placeholder="বা ছবির লিংক পেস্ট করুন (Image URL)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 border border-neutral-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-black"
              />
              <button
                type="button"
                onClick={addImage}
                className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
              >
                যুক্ত করুন
              </button>
            </div>

            {/* Image Preview Grid */}
            {formData.images && formData.images.length > 0 && (
              <div className="pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-2xs">
                      <img src={img} alt={`Product ${idx}`} className="w-full h-full object-cover" />
                      
                      {/* Main / Cover Badge */}
                      {idx === 0 ? (
                        <span className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                          কভার ছবি
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => makeMainImage(idx)}
                          className="absolute top-2 left-2 bg-white/90 hover:bg-white text-neutral-800 text-[10px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer"
                        >
                          কভার বানান
                        </button>
                      )}

                      {/* Tool buttons */}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => rotateImage(idx)}
                          className="bg-black/75 text-white p-1.5 rounded-full hover:bg-black transition-colors shadow-xs cursor-pointer"
                          title="Rotate 90°"
                        >
                          <RotateCw size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => flipImage(idx)}
                          className="bg-black/75 text-white p-1.5 rounded-full hover:bg-black transition-colors shadow-xs cursor-pointer"
                          title="Flip"
                        >
                          <FlipHorizontal size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="bg-black/75 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-xs cursor-pointer"
                          title="Remove photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
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

          {/* 3. PRODUCT SPECIFICATIONS & DETAILS (CUSTOMIZABLE AS SHOWN IN SCREENSHOT) */}
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
