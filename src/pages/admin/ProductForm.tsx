import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, getDoc, updateDoc, collection, serverTimestamp, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types';
import { useCategoryStore } from '../../store/useCategoryStore';
import { 
  ArrowLeft, Save, X, UploadCloud, Image as ImageIcon, Video, CheckCircle2, 
  Sparkles, Wand2, Loader2, Check
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

  // AI Generation States
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiStatusStep, setAiStatusStep] = useState<string>('');
  const [aiPromptHint, setAiPromptHint] = useState<string>('');
  const [showAiHintInput, setShowAiHintInput] = useState(false);
  const [aiGeneratedSuccess, setAiGeneratedSuccess] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: 'Men',
    subcategory: '',
    price: 0,
    comparePrice: 0,
    stockQuantity: 25,
    sizeOptions: [],
    colorOptions: [],
    material: '',
    description: '',
    images: [],
    videoUrl: '',
    status: 'published',
    sku: ''
  });

  const [imageUrl, setImageUrl] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const pData = docSnap.data() as Product;
          setFormData(pData);
          setInitialProductPrice(Number(pData.price || 0));
        }
      } catch (error) {
        console.error("Error fetching product", error);
      } finally {
        setFetching(false);
      }
    };
    if (isEditing) fetchProduct();
  }, [id]);

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

  const getAiHeaders = () => {
    return { "Content-Type": "application/json" };
  };

  // Main AI Image Auto-Fill Function
  const runAiAutoFill = async (imageToAnalyze?: string, customHint?: string) => {
    const targetImage = imageToAnalyze || formData.images?.[0];
    if (!targetImage) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        alert("Please upload at least one product image first.");
      }
      return;
    }

    setIsAiGenerating(true);
    setAiStatusStep("Analyzing image with Gemini Vision AI...");
    setAiGeneratedSuccess(false);

    try {
      setTimeout(() => {
        setAiStatusStep("Generating titles, tags & English description...");
      }, 1000);

      const categoryList = (categories || []).map(c => c.title);

      const res = await fetch("/api/ai-product-auto-fill", {
        method: "POST",
        headers: getAiHeaders(),
        body: JSON.stringify({
          image: targetImage,
          categories: categoryList,
          hints: customHint || aiPromptHint || ""
        })
      });

      if (!res.ok) {
        let errMsg = "AI Server responded with an error.";
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const data = await res.json();

      if (data) {
        setFormData(prev => {
          let matchedCat = data.category || prev.category || categoryList[0] || 'Men';
          if (categories && categories.length > 0) {
            const found = categories.find(c => c.title.toLowerCase() === (data.category || '').toLowerCase());
            if (found) matchedCat = found.title;
          }

          return {
            ...prev,
            name: data.name || prev.name,
            category: matchedCat,
            subcategory: data.subcategory || prev.subcategory || '',
            description: data.description || prev.description || '',
            material: data.material || prev.material || '',
            price: data.price !== undefined ? Number(data.price) : prev.price,
            comparePrice: data.comparePrice !== undefined ? Number(data.comparePrice) : prev.comparePrice,
            discount: data.discount !== undefined ? Number(data.discount) : prev.discount,
            stockQuantity: data.stockQuantity !== undefined ? Number(data.stockQuantity) : (prev.stockQuantity || 25),
            sizeOptions: Array.isArray(data.sizeOptions) && data.sizeOptions.length > 0 ? data.sizeOptions : prev.sizeOptions,
            colorOptions: Array.isArray(data.colorOptions) && data.colorOptions.length > 0 ? data.colorOptions : prev.colorOptions,
            isFlashSale: data.isFlashSale !== undefined ? data.isFlashSale : prev.isFlashSale
          };
        });

        setAiGeneratedSuccess(true);
      }
    } catch (err: any) {
      console.error("AI Auto-fill failed:", err);
      alert(`AI Generation Failed: ${err.message || "Please try again later."}`);
    } finally {
      setIsAiGenerating(false);
      setAiStatusStep("");
    }
  };

  // Single field AI generator: Description (English)
  const generateAiDescriptionOnly = async () => {
    setGeneratingField('description');
    try {
      const res = await fetch("/api/ai-generate-description", {
        method: "POST",
        headers: getAiHeaders(),
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          subcategory: formData.subcategory,
          price: formData.price,
          material: formData.material
        })
      });
      const data = await res.json();
      if (data?.description) {
        setFormData(prev => ({ ...prev, description: data.description }));
      }
    } catch (e) {
      console.warn("Description generation error", e);
    } finally {
      setGeneratingField(null);
    }
  };

  // Single field AI generator: Tag & Subcategory
  const generateAiTagsOnly = async () => {
    setGeneratingField('tags');
    try {
      const res = await fetch("/api/ai-tag-product", {
        method: "POST",
        headers: getAiHeaders(),
        body: JSON.stringify({
          name: formData.name,
          category: formData.category
        })
      });
      const data = await res.json();
      if (data?.subcategory) {
        setFormData(prev => ({ ...prev, subcategory: data.subcategory }));
      }
    } catch (e) {
      console.warn("Tag generation error", e);
    } finally {
      setGeneratingField(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, fileIndex: number) => {
      if (file.type && !file.type.startsWith('image/')) {
        alert('Please select valid image files');
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        alert("A file exceeds 15MB limit. Please select smaller images.");
        return;
      }

      const reader = new FileReader();
      
      reader.onerror = () => {
        alert("Error: Browser could not read the file. Please try again.");
      };

      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          const img = new Image();
          
          img.onerror = () => {
             if (file.size < 500 * 1024) {
                setFormData(prev => ({
                  ...prev,
                  images: [...(prev.images || []), result]
                }));
             } else {
                alert("Image format not supported. Please use JPEG, PNG, or WEBP.");
             }
          };

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
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
              
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
                
                setFormData(prev => ({
                  ...prev,
                  images: [...(prev.images || []), compressedBase64]
                }));
              }
            } catch (err: any) {
              console.error("Canvas error:", err);
              alert("Could not process image: " + (err.message || "Unknown error"));
            }
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Clear input so the same file can be selected again
    e.target.value = '';
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
    if (imageUrl) {
      setFormData(prev => {
        const newImages = [...(prev.images || []), imageUrl];
        return { ...prev, images: newImages };
      });
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
    if (input) {
      setFormData(prev => ({ ...prev, [field]: [...(prev[field] || []), input] }));
      setInput('');
    }
  };

  const removeArrayItem = (field: 'sizeOptions' | 'colorOptions', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
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
    <div className="max-w-5xl mx-auto px-2 sm:px-6 py-4 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={() => navigate('/admin/products')} 
            className="p-2 bg-white rounded-full border border-neutral-200 hover:bg-neutral-50 transition-colors shrink-0 shadow-xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 truncate">
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h1>
            <p className="text-xs text-neutral-500">
              {isEditing ? 'Update product specifications and inventory' : 'Upload photo and click Auto-Generate with AI'}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runAiAutoFill()}
            disabled={isAiGenerating}
            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {isAiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Auto-Generate with AI</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-xl bg-white hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            disabled={loading || isAiGenerating}
            className="bg-neutral-950 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{loading ? 'Saving...' : 'Save Product'}</span>
          </button>
        </div>
      </div>

      {/* AI Automation Bar */}
      <div className="mb-6 bg-neutral-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-400 text-black rounded-lg font-bold">
                <Sparkles size={16} />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                AI Product Auto-Fill
              </h2>
              <span className="text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                Gemini 3.7 Vision
              </span>
            </div>
            <p className="text-xs text-neutral-300 max-w-2xl">
              Upload product photo and click Auto-Generate to instantly fill name, English description, category, size recommendations, and price.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => runAiAutoFill()}
              disabled={isAiGenerating}
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {isAiGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-black" />
                  <span>Generating Details...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} className="text-black" />
                  <span>Auto-Generate All</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAiHintInput(!showAiHintInput)}
              className="text-xs text-neutral-300 hover:text-white font-semibold px-2.5 py-2 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 transition-colors"
            >
              {showAiHintInput ? 'Close Hint' : '+ Add Prompt Hint'}
            </button>
          </div>
        </div>

        {/* Optional AI Custom Prompt Hint */}
        {showAiHintInput && (
          <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Optional hint (e.g., Premium Royal Silk Panjabi Set for Festive Eid Collection)"
              value={aiPromptHint}
              onChange={(e) => setAiPromptHint(e.target.value)}
              className="flex-1 text-xs border border-neutral-700 bg-neutral-800 text-white rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={() => runAiAutoFill(undefined, aiPromptHint)}
              disabled={isAiGenerating}
              className="bg-amber-400 hover:bg-amber-300 text-black px-3 py-2 rounded-xl text-xs font-bold shrink-0 disabled:opacity-50"
            >
              Apply Hint
            </button>
          </div>
        )}

        {/* Live AI Status Loading Banner */}
        {isAiGenerating && (
          <div className="mt-3 p-3 bg-neutral-800 border border-amber-400/40 rounded-xl flex items-center gap-3 animate-pulse">
            <Loader2 size={18} className="animate-spin text-amber-400 shrink-0" />
            <div className="text-xs font-bold text-amber-300">
              {aiStatusStep || "AI is analyzing image and generating metadata..."}
            </div>
          </div>
        )}

        {/* Success Alert Banner */}
        {aiGeneratedSuccess && !isAiGenerating && (
          <div className="mt-3 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center justify-between gap-2 text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-bold">
                All fields have been auto-filled by AI. Review and make any adjustments before saving.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAiGeneratedSuccess(false)}
              className="text-emerald-400 hover:text-emerald-200 p-1 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6 w-full min-w-0">
            
            {/* 1. Product Images Upload */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <ImageIcon size={20} className="text-neutral-800" />
                    <span>Product Images</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Upload product photos. Click the AI Auto-Fill button above to generate details.
                  </p>
                </div>
              </div>
              
              {/* Local File Upload Box */}
              <div className="border-2 border-dashed border-neutral-300 bg-neutral-50 rounded-2xl p-5 text-center hover:bg-neutral-100/80 transition-colors w-full">
                <input
                  type="file"
                  id="file-upload"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-neutral-700 shrink-0 shadow-sm border border-neutral-200">
                    <UploadCloud size={24} />
                  </div>
                  <div className="text-center px-2">
                    <span className="text-sm font-extrabold text-neutral-900 underline decoration-2 block">
                      Choose product photos from your device
                    </span>
                    <p className="text-xs text-neutral-500 mt-0.5">Supports JPG, PNG, and WEBP formats</p>
                  </div>
                </label>
              </div>

              {/* URL Option as alternative */}
              <div className="pt-1 w-full">
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Or enter Image URL:</label>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <input
                    type="url"
                    placeholder="https://example.com/product-image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-black min-w-0"
                  />
                  <button 
                    type="button" 
                    onClick={addImage} 
                    className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black shrink-0"
                  >
                    Add URL
                  </button>
                </div>
              </div>

              {/* Image Previews */}
              {formData.images && formData.images.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                    <span>Uploaded Photos ({formData.images.length}):</span>
                    <button
                      type="button"
                      onClick={() => runAiAutoFill(formData.images?.[0])}
                      disabled={isAiGenerating}
                      className="text-amber-700 hover:text-amber-900 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Sparkles size={12} />
                      <span>Re-Generate All from Main Photo</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
                    {formData.images.map((img, idx) => (
                      <div 
                        key={idx} 
                        className={`relative aspect-[3/4] bg-neutral-100 rounded-2xl overflow-hidden group border-2 ${
                          idx === 0 ? 'border-amber-500 ring-2 ring-amber-400/50 shadow-sm' : 'border-neutral-200'
                        }`}
                      >
                        <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                        
                        {/* Main Image Badge */}
                        {idx === 0 ? (
                          <div className="absolute top-2 left-2 bg-amber-500 text-neutral-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            <span>MAIN COVER</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => makeMainImage(idx)}
                            className="absolute top-2 left-2 bg-black/70 hover:bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-md opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Make Main
                          </button>
                        )}

                        {/* AI Scan button per image */}
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => runAiAutoFill(img)}
                            disabled={isAiGenerating}
                            className="absolute bottom-2 left-2 bg-amber-500/90 hover:bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow"
                          >
                            <Sparkles size={10} />
                            <span>Scan with AI</span>
                          </button>
                        )}

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-md"
                          title="Remove image"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Basic Information (Title, Material & Description) */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold">Basic Information</h2>
                {aiGeneratedSuccess && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check size={12} /> Auto-filled by AI
                  </span>
                )}
              </div>
              
              {/* Product Name */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                  placeholder="e.g. Royal Silk Embroidered Panjabi Set - Navy Blue"
                />
              </div>

              {/* Material / Fabric */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Material / Fabric
                </label>
                <input
                  type="text"
                  name="material"
                  value={formData.material || ''}
                  onChange={handleChange}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g. 100% Premium Combed Cotton / Pure Raw Silk"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs sm:text-sm font-medium text-neutral-700">
                    Product Description
                  </label>
                  <button
                    type="button"
                    onClick={generateAiDescriptionOnly}
                    disabled={generatingField === 'description'}
                    className="text-[11px] text-neutral-700 hover:text-black font-bold flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200 cursor-pointer"
                  >
                    {generatingField === 'description' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    <span>AI Description</span>
                  </button>
                </div>
                <textarea
                  name="description"
                  required
                  rows={6}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-transparent outline-none leading-relaxed"
                  placeholder="Detailed product highlights, specifications, and care instructions in English..."
                />
              </div>
            </div>

            {/* 3. Product Video */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Video size={20} className="text-red-500" />
                  <span>Product Video</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Attach a YouTube video link or upload an MP4 video file.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">YouTube / Video URL:</label>
                  <input
                    type="url"
                    name="videoUrl"
                    value={formData.videoUrl || ''}
                    onChange={handleChange}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-black outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-neutral-400 uppercase">or</span>
                  <label htmlFor="video-upload" className="cursor-pointer inline-flex items-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold px-3.5 py-2 rounded-xl border border-neutral-200 transition-colors">
                    <Video size={14} />
                    <span>Upload Video File (MP4/WEBM)</span>
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
                      Remove Video
                    </button>
                  )}
                </div>

                {formData.videoUrl && (
                  <div className="mt-2 bg-neutral-900 rounded-2xl overflow-hidden p-2 border border-neutral-800">
                    <p className="text-[11px] font-bold text-neutral-400 mb-1.5 px-2">Video Preview:</p>
                    {formData.videoUrl.includes('youtube.com') || formData.videoUrl.includes('youtu.be') ? (
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                        <iframe
                          src={
                            formData.videoUrl.includes('youtu.be/')
                              ? `https://www.youtube.com/embed/${formData.videoUrl.split('youtu.be/')[1]?.split('?')[0]}`
                              : formData.videoUrl.includes('v=')
                              ? `https://www.youtube.com/embed/${formData.videoUrl.split('v=')[1]?.split('&')[0]}`
                              : formData.videoUrl
                          }
                          className="w-full h-full border-0"
                          title="Product Video Preview"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <video src={formData.videoUrl} controls className="w-full max-h-60 rounded-xl bg-black object-contain" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Sizes & Colors */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold">Sizes & Colors</h2>
                <span className="text-xs text-neutral-500">Options for shoppers</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
                {/* Sizes */}
                <div className="w-full min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Available Sizes</label>
                  <div className="flex items-center space-x-2 mb-2 w-full">
                    <input
                      type="text"
                      placeholder="e.g. 38, 40, 42 or S, M, L"
                      value={sizeInput}
                      onChange={(e) => setSizeInput(e.target.value)}
                      className="flex-1 min-w-0 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-black"
                    />
                    <button 
                      type="button" 
                      onClick={() => addArrayItem('sizeOptions', sizeInput, setSizeInput)} 
                      className="bg-neutral-900 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-black cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  
                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['38', '40', '42', '44', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (!formData.sizeOptions?.includes(preset)) {
                            setFormData(p => ({ ...p, sizeOptions: [...(p.sizeOptions || []), preset] }));
                          }
                        }}
                        className="text-[10px] font-semibold bg-neutral-50 hover:bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-neutral-200 cursor-pointer"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(formData.sizeOptions || []).map((size, idx) => (
                      <span key={idx} className="inline-flex items-center bg-neutral-100 text-neutral-900 px-2.5 py-1 rounded-lg text-xs font-bold border border-neutral-200">
                        {size}
                        <button type="button" onClick={() => removeArrayItem('sizeOptions', idx)} className="ml-1.5 text-neutral-400 hover:text-red-500"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="w-full min-w-0">
                  <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Available Colors</label>
                  <div className="flex items-center space-x-2 mb-2 w-full">
                    <input
                      type="text"
                      placeholder="e.g. Navy Blue, Maroon, Black"
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      className="flex-1 min-w-0 border border-neutral-300 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-black"
                    />
                    <button 
                      type="button" 
                      onClick={() => addArrayItem('colorOptions', colorInput, setColorInput)} 
                      className="bg-neutral-900 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-black cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {/* Preset quick color buttons */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['Navy Blue', 'Maroon', 'Black', 'White', 'Olive', 'Gold', 'Royal Blue'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          if (!formData.colorOptions?.includes(color)) {
                            setFormData(p => ({ ...p, colorOptions: [...(p.colorOptions || []), color] }));
                          }
                        }}
                        className="text-[10px] font-semibold bg-neutral-50 hover:bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded border border-neutral-200 cursor-pointer"
                      >
                        +{color}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(formData.colorOptions || []).map((color, idx) => (
                      <span key={idx} className="inline-flex items-center bg-neutral-100 text-neutral-900 px-2.5 py-1 rounded-lg text-xs font-semibold border border-neutral-200">
                        {color}
                        <button type="button" onClick={() => removeArrayItem('colorOptions', idx)} className="ml-1.5 text-neutral-400 hover:text-red-500"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column: Category, Pricing & Status */}
          <div className="space-y-6 w-full min-w-0">
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <h2 className="text-base sm:text-lg font-bold">Organization</h2>
              
              {/* Category */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Category</label>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs sm:text-sm font-medium text-neutral-700">Subcategory / Tag</label>
                  <button
                    type="button"
                    onClick={generateAiTagsOnly}
                    disabled={generatingField === 'tags'}
                    className="text-[11px] text-neutral-700 hover:text-black font-bold cursor-pointer"
                  >
                    AI Suggest
                  </button>
                </div>
                <input
                  type="text"
                  name="subcategory"
                  value={formData.subcategory || ''}
                  onChange={handleChange}
                  placeholder="e.g. Panjabi Set, Party Gown, Loafers"
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Publication Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black outline-none bg-white"
                >
                  <option value="published">Published (Visible in store)</option>
                  <option value="draft">Draft (Hidden in store)</option>
                </select>
              </div>
            </div>

            {/* Pricing Box */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 w-full min-w-0">
              <h2 className="text-base sm:text-lg font-bold">Pricing & Stock</h2>

              {/* Selling Price */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Selling Price (৳)
                </label>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="1"
                  required
                  placeholder="0.00"
                  value={formData.price === 0 || formData.price === undefined ? '' : formData.price}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-base outline-none font-bold text-neutral-900 focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Compare / Regular Price */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Original / Compare Price (৳)
                </label>
                <input
                  type="number"
                  name="comparePrice"
                  min="0"
                  step="1"
                  placeholder="Regular price before discount"
                  value={formData.comparePrice === 0 || formData.comparePrice === undefined ? '' : formData.comparePrice}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none text-neutral-600"
                />
              </div>

              {/* Discount Offer */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Discount Offer (%)
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    name="discount"
                    min="0"
                    max="100"
                    value={formData.discount === 0 || formData.discount === undefined ? '' : formData.discount}
                    onChange={handleChange}
                    onFocus={(e) => e.target.select()}
                    placeholder="e.g. 20 for 20% OFF"
                    className="w-full border border-neutral-300 rounded-xl px-3.5 py-2 text-sm outline-none font-bold text-red-600 focus:border-red-500"
                  />
                  
                  {/* Preset Offer Percentage Buttons */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const basePrice = formData.comparePrice || formData.price || 0;
                          const discountedPrice = basePrice > 0 ? Math.round(basePrice * (1 - pct / 100)) : formData.price;
                          setFormData(prev => ({
                            ...prev,
                            discount: pct,
                            comparePrice: basePrice > 0 ? basePrice : (prev.price ? Math.round(prev.price / (1 - pct / 100)) : 0),
                            price: basePrice > 0 ? discountedPrice : prev.price
                          }));
                        }}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          formData.discount === pct
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {pct}% OFF
                      </button>
                    ))}
                    {formData.discount ? (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, discount: undefined }))}
                        className="px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:text-red-600 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Flash Sale Toggle */}
              <div>
                <label className="flex items-center space-x-3 cursor-pointer p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      name="isFlashSale"
                      checked={formData.isFlashSale || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, isFlashSale: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.isFlashSale ? 'bg-red-600' : 'bg-neutral-300'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isFlashSale ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-1">
                      <span>Flash Sale Badge</span>
                    </span>
                    <span className="text-[10px] text-neutral-500">Display flash sale tag on product card</span>
                  </div>
                </label>
              </div>

              {/* Stock Quantity */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  name="stockQuantity"
                  min="0"
                  required
                  placeholder="25"
                  value={formData.stockQuantity === 0 || formData.stockQuantity === undefined ? '' : formData.stockQuantity}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className="w-full border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm outline-none font-bold"
                />
              </div>
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isAiGenerating}
              className="w-full bg-neutral-950 text-white px-6 py-4 rounded-2xl text-base font-bold hover:bg-black transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 shadow-md active:scale-98 cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{loading ? 'Saving...' : 'Save Product'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
