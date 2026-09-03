import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Image as ImageIcon, Save, Loader2, Sparkles, Upload, Check, RefreshCw, 
  AlertCircle, Phone, MessageCircle, Share2, CreditCard, ShieldCheck, 
  FileText, Plus, Trash2, Search, Globe, ExternalLink, Copy, ArrowLeft,
  Truck, Key, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import { useStoreConfigStore, DEFAULT_STORE_CONFIG } from '../../store/useStoreConfigStore';
import { useCategoryStore, CategoryItem } from '../../store/useCategoryStore';
import { StoreConfig } from '../../types';
import { safeRandomUUID } from '../../lib/uuid';

export interface BannerSlide {
  id: number;
  image: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  link: string;
  tag?: string;
  theme?: 'dark' | 'pink' | 'olive' | 'light';
  tagColor?: string;
  titleColor?: string;
  accentColor?: string;
  subtitleColor?: string;
  buttonBg?: string;
  buttonText?: string;
}

export interface CategoryImageSetting {
  title: string;
  link: string;
  image: string;
}

export const DEFAULT_HERO_SLIDES: BannerSlide[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=1200&q=70&auto=format&fit=crop',
    tag: 'NEW COLLECTION 2026',
    title: 'Elevate Your',
    titleAccent: 'Everyday Style',
    subtitle: 'Timeless looks. Premium quality.\nMade for you.',
    link: '/category/Men',
    theme: 'dark',
    tagColor: '#C69A4C',
    titleColor: '#FFFFFF',
    accentColor: '#C69A4C',
    subtitleColor: '#F4F4F5',
    buttonBg: '#FFFFFF',
    buttonText: '#0A0A0A'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&q=70&auto=format&fit=crop',
    tag: 'NEW COLLECTION 2026',
    title: 'Redefine Your',
    titleAccent: 'Every Occasion',
    subtitle: 'Versatile styles for every moment.\nCrafted for comfort. Designed for you.',
    link: '/category/Women',
    theme: 'olive',
    tagColor: '#556B4E',
    titleColor: '#1C1917',
    accentColor: '#556B4E',
    subtitleColor: '#2D3748',
    buttonBg: '#4E6247',
    buttonText: '#FFFFFF'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1200&q=70&auto=format&fit=crop',
    tag: 'LUXURY ACCESSORIES',
    title: 'The Finest Details',
    titleAccent: 'Make The Difference',
    subtitle: 'Premium accessories to\ncomplete your style.',
    link: '/category/Accessories',
    theme: 'pink',
    tagColor: '#B76E79',
    titleColor: '#1C1917',
    accentColor: '#B76E79',
    subtitleColor: '#374151',
    buttonBg: '#B36270',
    buttonText: '#FFFFFF'
  }
];

export const DEFAULT_CATEGORIES: CategoryImageSetting[] = [
  {
    title: 'Men',
    link: '/category/Men',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop'
  },
  {
    title: 'Women',
    link: '/category/Women',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&q=60&auto=format&fit=crop'
  },
  {
    title: 'Kids',
    link: '/category/Kids',
    image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?q=80&w=400&q=60&auto=format&fit=crop'
  },
  {
    title: 'Accessories',
    link: '/category/Accessories',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=400&q=60&auto=format&fit=crop'
  }
];

export default function AdminSettings() {
  const [banners, setBanners] = useState<BannerSlide[]>(DEFAULT_HERO_SLIDES);
  const { categories: storeCategories, saveCategories, fetchCategories } = useCategoryStore();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [storeForm, setStoreForm] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<{ type: string; index: number } | null>(null);
  const [showSteadfastKeys, setShowSteadfastKeys] = useState(false);
  const [testingSteadfast, setTestingSteadfast] = useState(false);
  const [steadfastTestResult, setSteadfastTestResult] = useState<{ success: boolean; message: string; balance?: number } | null>(null);

  const { config, updateConfig } = useStoreConfigStore();

  useEffect(() => {
    fetchCategories();
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'homepage');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.banners && Array.isArray(data.banners) && data.banners.length > 0) {
            const merged = data.banners.map((b: any, idx: number) => {
              const def = DEFAULT_HERO_SLIDES[idx] || DEFAULT_HERO_SLIDES[0];
              const isBadText = b.title === 'New Season Collection' || b.title === 'Winter Essentials' || b.tag === 'NEW COLLECTION 2025' || (b.title === 'Redefine Your' && b.tag === 'NEW COLLECTION 2025');
              return {
                ...b,
                title: isBadText ? def.title : b.title,
                titleAccent: isBadText ? def.titleAccent : b.titleAccent,
                subtitle: isBadText ? def.subtitle : b.subtitle,
                tag: isBadText ? def.tag : b.tag,
              };
            });
            setBanners(merged);
          }
        }
      } catch {
        // Fallback to defaults
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (storeCategories && storeCategories.length > 0) {
      setCategories(storeCategories);
    }
  }, [storeCategories]);

  useEffect(() => {
    if (config) {
      setStoreForm(config);
    }
  }, [config]);

  const handleBannerChange = (index: number, field: keyof BannerSlide, value: string) => {
    const updated = [...banners];
    updated[index] = { ...updated[index], [field]: value };
    setBanners(updated);
  };

  const handleCategoryChange = (index: number, field: keyof CategoryItem, value: string) => {
    const updated = [...categories];
    const updatedCat = { ...updated[index], [field]: value };
    if (field === 'title') {
      updatedCat.link = `/category/${encodeURIComponent(value)}`;
    }
    updated[index] = updatedCat;
    setCategories(updated);
  };

  const handleAddCategory = () => {
    const nextNum = categories.length + 1;
    const title = `New Category ${nextNum}`;
    const newCat: CategoryItem = {
      id: safeRandomUUID(),
      title,
      link: `/category/${encodeURIComponent(title)}`,
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=400&q=60&auto=format&fit=crop'
    };
    setCategories(prev => [...prev, newCat]);
  };

  const handleDeleteCategory = (index: number) => {
    if (categories.length <= 1) {
      alert("At least one category must remain.");
      return;
    }
    if (confirm(`Are you sure you want to delete category "${categories[index].title}"?`)) {
      setCategories(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleStoreFormChange = (field: keyof StoreConfig, value: string) => {
    setStoreForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'category', index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit. Please select a smaller image.");
      return;
    }

    setUploadingIndex({ type, index });

    const reader = new FileReader();
    reader.onerror = () => {
      alert("Error: Browser could not read the file. Please ensure it is a valid image (JPEG/PNG) and fully downloaded to your device.");
      setUploadingIndex(null);
    };

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setUploadingIndex(null);
        return;
      }

      const img = new window.Image();
      img.onerror = () => {
        // If image format (like HEIC/WEBP) isn't supported by the canvas parser, fallback to direct upload if size is small enough
        if (file.size < 500 * 1024) { // Under 500kb, skip compression
          if (type === 'banner') {
            handleBannerChange(index, 'image', dataUrl);
          } else {
            handleCategoryChange(index, 'image', dataUrl);
          }
        } else {
          alert("Image format not supported or file too large to process. Please use a standard JPEG/PNG image.");
        }
        setUploadingIndex(null);
      };

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = type === 'category' ? 400 : 1200;
          const MAX_HEIGHT = type === 'category' ? 400 : 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
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

            const quality = type === 'category' ? 0.70 : 0.80;
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

            if (type === 'banner') {
              handleBannerChange(index, 'image', compressedBase64);
            } else {
              handleCategoryChange(index, 'image', compressedBase64);
            }
          }
        } catch (err) {
          console.error("Canvas processing error:", err);
          // Fallback to raw data url if canvas fails
          if (type === 'banner') {
            handleBannerChange(index, 'image', dataUrl);
          } else {
            handleCategoryChange(index, 'image', dataUrl);
          }
        } finally {
          setUploadingIndex(null);
        }
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit. Please select a smaller logo image.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      alert("Error: Failed to read image file.");
    };

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      // If it's a PNG or SVG, preserve full transparency with canvas/direct dataUrl
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, width, height);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Export as PNG to preserve transparent background
            const transparentPng = canvas.toDataURL('image/png');
            handleStoreFormChange('logoUrl', transparentPng);
          }
        } catch (err) {
          console.error("Logo processing error:", err);
          handleStoreFormChange('logoUrl', dataUrl);
        }
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleResetCategories = () => {
    if (confirm("Reset categories to standard 4 clean categories (Men, Women, Kids, Accessories)? Old custom categories will be cleared.")) {
      const standard: CategoryItem[] = [
        {
          id: 'men',
          title: 'Men',
          link: '/category/Men',
          image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop'
        },
        {
          id: 'women',
          title: 'Women',
          link: '/category/Women',
          image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&q=60&auto=format&fit=crop'
        },
        {
          id: 'kids',
          title: 'Kids',
          link: '/category/Kids',
          image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?q=80&w=400&q=60&auto=format&fit=crop'
        },
        {
          id: 'accessories',
          title: 'Accessories',
          link: '/category/Accessories',
          image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=400&q=60&auto=format&fit=crop'
        }
      ];
      setCategories(standard);
    }
  };

  const handleTestSteadfastConnection = async () => {
    if (!storeForm.steadfastApiKey || !storeForm.steadfastSecretKey) {
      setSteadfastTestResult({
        success: false,
        message: 'দয়া করে Steadfast API Key এবং Secret Key দুটোই লিখুন।'
      });
      return;
    }

    setTestingSteadfast(true);
    setSteadfastTestResult(null);

    try {
      const res = await fetch('/api/courier/steadfast/check-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: storeForm.steadfastApiKey,
          secretKey: storeForm.steadfastSecretKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSteadfastTestResult({
          success: true,
          message: data.message || 'Steadfast সার্ভারে সফলভাবে কানেক্ট হয়েছে!',
          balance: data.balance
        });
      } else {
        setSteadfastTestResult({
          success: false,
          message: data.message || 'ক্রেডেনশিয়াল সঠিক নয় বা সংযোগ পাওয়া যায়নি।'
        });
      }
    } catch (err: any) {
      setSteadfastTestResult({
        success: false,
        message: 'কানেকশন এরর: ' + (err.message || 'সার্ভারে সংযোগ ব্যর্থ')
      });
    } finally {
      setTestingSteadfast(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      // 1. Immediately cache banners locally for instant 0ms load
      try {
        localStorage.setItem('rare_dreams_hero_slides', JSON.stringify(banners));
      } catch {}

      // 2. Save Homepage Banners & Categories to Firestore
      const docRef = doc(db, 'settings', 'homepage');
      await setDoc(docRef, {
        banners,
        categories,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 3. Save Category Store
      await saveCategories(categories);

      // 4. Save Store Config (Social links, WhatsApp, Payment numbers, Licenses)
      await updateConfig(storeForm);

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-neutral-500">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutral-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>Homepage Customization</span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-900">
            Banner & Category Images
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Upload images from your phone or enter image URLs to update hero slides & category tiles.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-black text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check size={16} className="text-emerald-400" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {/* SECTION 0: STORE BRAND LOGO */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="border-b border-neutral-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Sparkles size={14} />
              <span>Brand Identity & Logo</span>
            </div>
            <h2 className="text-lg font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
              <ImageIcon size={20} className="text-neutral-700" />
              <span>Website Header & Brand Logo</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Upload your custom transparent background PNG, SVG or JPEG logo. It will seamlessly display in the header bar and footer.
            </p>
          </div>

          {storeForm.logoUrl && (
            <button
              type="button"
              onClick={() => handleStoreFormChange('logoUrl', '')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-neutral-100 text-red-600 hover:text-red-700 text-xs font-bold uppercase rounded-xl hover:bg-red-50 transition-colors cursor-pointer shrink-0 border border-neutral-200"
            >
              <Trash2 size={14} />
              <span>Remove Custom Logo</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Logo Live Previews */}
          <div className="space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
              Live Preview
            </span>
            <div className="grid grid-cols-2 gap-3">
              {/* White Background Preview (Header Bar) */}
              <div className="p-4 rounded-2xl bg-white border border-neutral-200 flex flex-col items-center justify-center min-h-[110px] text-center shadow-2xs">
                <span className="text-[9px] font-bold uppercase text-neutral-400 mb-2">Header Bar Preview</span>
                {storeForm.logoUrl ? (
                  <img
                    src={storeForm.logoUrl}
                    alt="Logo Preview"
                    className="max-h-12 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs font-bold text-neutral-500 italic">Using Default Logo</span>
                )}
              </div>

              {/* Dark Background Preview (Footer) */}
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center min-h-[110px] text-center shadow-2xs">
                <span className="text-[9px] font-bold uppercase text-neutral-500 mb-2">Dark Footer Preview</span>
                {storeForm.logoUrl ? (
                  <img
                    src={storeForm.logoUrl}
                    alt="Logo Dark Preview"
                    className="max-h-12 w-auto object-contain"
                  />
                ) : (
                  <span className="text-xs font-bold text-neutral-400 italic">Using Default Logo</span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-neutral-400">
              💡 Tip: Upload a transparent background PNG file (PNG format with transparent background) for the best result.
            </p>
          </div>

          {/* Upload Controls */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80 space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Upload size={14} className="text-blue-600" />
                <span>Upload Logo from Device (Phone/Computer)</span>
              </label>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                onChange={handleLogoUpload}
                className="block w-full text-xs text-neutral-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Globe size={14} className="text-neutral-500" />
                <span>Or Direct Logo Image URL</span>
              </label>
              <input
                type="url"
                value={storeForm.logoUrl || ''}
                onChange={(e) => handleStoreFormChange('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono text-neutral-900 outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: HERO BANNERS (3 SLIDES) */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
            <ImageIcon size={20} className="text-neutral-700" />
            <span>Home Hero Banner Slides (3 Slides)</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            These slides auto-rotate and support touch swipe gestures on mobile devices.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {banners.map((banner, index) => (
            <div key={banner.id} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                  Slide #{index + 1}
                </span>
                <span className="text-[10px] font-bold bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded uppercase">
                  Hero Image
                </span>
              </div>

              {/* Image Preview Box */}
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-neutral-200 border border-neutral-300">
                <img 
                  src={banner.image || 'https://via.placeholder.com/600x300'} 
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* File Upload Button */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Upload New Image from Device
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'banner', index)}
                  className="block w-full text-xs text-neutral-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer"
                />
              </div>

              {/* Image URL Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Or Image Web URL
                </label>
                <input
                  type="url"
                  value={banner.image}
                  onChange={(e) => handleBannerChange(index, 'image', e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Tag Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Tag / Eyebrow (e.g. NEW COLLECTION 2025)
                </label>
                <input
                  type="text"
                  value={banner.tag || ''}
                  onChange={(e) => handleBannerChange(index, 'tag', e.target.value)}
                  placeholder="NEW COLLECTION 2025"
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Title Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Main Title (Line 1)
                  </label>
                  <input
                    type="text"
                    value={banner.title}
                    onChange={(e) => handleBannerChange(index, 'title', e.target.value)}
                    placeholder="Elevate Your"
                    className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Accent Title (Line 2)
                  </label>
                  <input
                    type="text"
                    value={banner.titleAccent || ''}
                    onChange={(e) => handleBannerChange(index, 'titleAccent', e.target.value)}
                    placeholder="Everyday Style"
                    className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {/* Subtitle Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Subtitle
                </label>
                <textarea
                  rows={2}
                  value={banner.subtitle}
                  onChange={(e) => handleBannerChange(index, 'subtitle', e.target.value)}
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs text-neutral-700 outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              {/* Link Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Button Link
                </label>
                <input
                  type="text"
                  value={banner.link || '/shop'}
                  onChange={(e) => handleBannerChange(index, 'link', e.target.value)}
                  placeholder="/shop or /category/Men"
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-mono text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: CATEGORY TILES & MANAGER */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-4 gap-4">
          <div>
            <h2 className="text-lg font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
              <Sparkles size={20} className="text-neutral-700" />
              <span>Manage Categories ({categories.length} Total)</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Add new categories, edit category names, change images, or delete unwanted categories. Changes update live across the website!
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCategories}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-neutral-100 text-neutral-700 hover:text-neutral-900 text-xs font-bold uppercase rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer shrink-0 border border-neutral-300"
              title="Reset to 4 Standard Clean Categories"
            >
              <RefreshCw size={14} />
              <span>Reset to Standard 4</span>
            </button>
            <button
              type="button"
              onClick={handleAddCategory}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-black text-white text-xs font-bold uppercase rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Plus size={16} />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, index) => (
            <div key={cat.id || index} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-4 relative group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-900 truncate max-w-[150px]">
                  {cat.title}
                </span>
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(index)}
                    className="p-1 text-neutral-400 hover:text-red-600 transition-colors rounded hover:bg-red-50 cursor-pointer ml-1"
                    title="Delete Category"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Category Name Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={cat.title}
                  onChange={(e) => handleCategoryChange(index, 'title', e.target.value)}
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Image Preview Box */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-200 border border-neutral-300">
                <img 
                  src={cat.image || 'https://via.placeholder.com/400x300'} 
                  alt={cat.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* File Upload Button */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Upload Image from Device
                </label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'category', index)}
                  className="block w-full text-xs text-neutral-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer"
                />
              </div>

              {/* Image URL Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                  Or Image Web URL
                </label>
                <input
                  type="url"
                  value={cat.image || ''}
                  onChange={(e) => handleCategoryChange(index, 'image', e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white border border-neutral-300 px-3 py-2 rounded-xl text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: STORE CONTACT, WHATSAPP & SOCIAL MEDIA LINKS */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="border-b border-neutral-100 pb-4">
          <h2 className="text-lg font-black uppercase text-neutral-900 tracking-tight flex items-center gap-2">
            <Share2 size={20} className="text-emerald-600" />
            <span>Social Links, WhatsApp & Merchant Payment Info</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Update your business numbers, social media links & license details. Changes update on the website immediately!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Group A: Support & Helpline */}
          <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase text-emerald-900 tracking-wider flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-600" />
              <span>WhatsApp & Support Phone</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                WhatsApp Business Number
              </label>
              <input
                type="text"
                value={storeForm.whatsappNumber}
                onChange={(e) => handleStoreFormChange('whatsappNumber', e.target.value)}
                placeholder="+8801712345678"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Helpline Phone Number
              </label>
              <input
                type="text"
                value={storeForm.helplineNumber}
                onChange={(e) => handleStoreFormChange('helplineNumber', e.target.value)}
                placeholder="+880 1712-345678"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Support Email Address
              </label>
              <input
                type="email"
                value={storeForm.supportEmail}
                onChange={(e) => handleStoreFormChange('supportEmail', e.target.value)}
                placeholder="support@raredreams.com.bd"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Group B: Payment Numbers */}
          <div className="bg-pink-50/40 p-5 rounded-2xl border border-pink-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase text-pink-950 tracking-wider flex items-center gap-2">
              <CreditCard size={16} className="text-pink-600" />
              <span>Mobile Banking Merchant Numbers</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                bKash Merchant / Personal Number
              </label>
              <input
                type="text"
                value={storeForm.bkashNumber}
                onChange={(e) => handleStoreFormChange('bkashNumber', e.target.value)}
                placeholder="01712345678"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Nagad Merchant Number
              </label>
              <input
                type="text"
                value={storeForm.nagadNumber}
                onChange={(e) => handleStoreFormChange('nagadNumber', e.target.value)}
                placeholder="01812345678"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Rocket Number
              </label>
              <input
                type="text"
                value={storeForm.rocketNumber}
                onChange={(e) => handleStoreFormChange('rocketNumber', e.target.value)}
                placeholder="01912345678"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          {/* Group C: Social Media URLs */}
          <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider flex items-center gap-2">
              <Share2 size={16} className="text-blue-600" />
              <span>Social Media Page Links</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Facebook Page URL
              </label>
              <input
                type="url"
                value={storeForm.facebookUrl}
                onChange={(e) => handleStoreFormChange('facebookUrl', e.target.value)}
                placeholder="https://facebook.com/raredreamsbd"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono text-neutral-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Instagram Profile URL
              </label>
              <input
                type="url"
                value={storeForm.instagramUrl}
                onChange={(e) => handleStoreFormChange('instagramUrl', e.target.value)}
                placeholder="https://instagram.com/raredreamsbd"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono text-neutral-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                YouTube Channel URL
              </label>
              <input
                type="url"
                value={storeForm.youtubeUrl}
                onChange={(e) => handleStoreFormChange('youtubeUrl', e.target.value)}
                placeholder="https://youtube.com/@raredreamsbd"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono text-neutral-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Group D: Business License & Address */}
          <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase text-amber-950 tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-600" />
              <span>Trade License & Office Info</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Trade License Number
              </label>
              <input
                type="text"
                value={storeForm.tradeLicenseNo}
                onChange={(e) => handleStoreFormChange('tradeLicenseNo', e.target.value)}
                placeholder="TRAD/DNCC/012984/2026"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                E-TIN Registration No
              </label>
              <input
                type="text"
                value={storeForm.tinNo}
                onChange={(e) => handleStoreFormChange('tinNo', e.target.value)}
                placeholder="849201948123"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Store Office / Showroom Address
              </label>
              <input
                type="text"
                value={storeForm.address}
                onChange={(e) => handleStoreFormChange('address', e.target.value)}
                placeholder="Jamuna Future Park, Level 4, Dhaka"
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Group E: Facebook Pixel (FB ID) & Analytics */}
          <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/80 space-y-4 md:col-span-2">
            <h3 className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-2">
              <Globe size={16} className="text-indigo-600" />
              <span>Facebook Pixel (FB ID) & Marketing Tracking</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                  Facebook Pixel ID (FB ID)
                </label>
                <input
                  type="text"
                  value={storeForm.facebookPixelId || ''}
                  onChange={(e) => handleStoreFormChange('facebookPixelId', e.target.value)}
                  placeholder="e.g. 182940294819203"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Enter your Meta / Facebook Pixel Dataset ID from Facebook Events Manager to track conversions and ads.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                  Google Analytics Measurement ID (GA4)
                </label>
                <input
                  type="text"
                  value={storeForm.googleAnalyticsId || ''}
                  onChange={(e) => handleStoreFormChange('googleAnalyticsId', e.target.value)}
                  placeholder="e.g. G-XXXXXXXXXX"
                  className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Optional: GA4 measurement ID for Google Analytics visitor tracking.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 4: STEADFAST COURIER INTEGRATION */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs space-y-6">
        <div className="border-b border-neutral-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6A00] to-[#EE0979] text-white flex items-center justify-center shadow-xs">
                <Truck size={18} />
              </span>
              <h2 className="text-lg font-black uppercase text-neutral-900 tracking-tight">
                স্টেডফাস্ট কুরিয়ার সার্ভিস ইন্টিগ্রেশন (Steadfast Courier API)
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              অর্ডার পেজ থেকে সরাসরি ১-ক্লিকে পার্সেল বুকিং, পিকআপ রিকোয়েস্ট এবং গ্রাহকদের অটোমেটিক লাইভ ট্র্যাকিং।
            </p>
          </div>

          <div className="flex items-center gap-2">
            {storeForm.steadfastApiKey && storeForm.steadfastSecretKey ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={13} />
                <span>কনফিগারেশন সক্রিয়</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={13} />
                <span>চাবি প্রয়োজন</span>
              </span>
            )}
          </div>
        </div>

        {/* API Credentials Inputs */}
        <div className="bg-gradient-to-br from-orange-50/40 via-white to-pink-50/20 p-5 rounded-2xl border border-orange-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-neutral-900 tracking-wider flex items-center gap-2">
              <Key size={16} className="text-[#FF6A00]" />
              <span>মার্চেন্ট এপিআই কি ও সিক্রেট কি (API & Secret Key)</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowSteadfastKeys(!showSteadfastKeys)}
              className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
            >
              {showSteadfastKeys ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showSteadfastKeys ? 'চাবি লুকান' : 'চাবি দেখুন'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Steadfast API Key *
              </label>
              <input
                type={showSteadfastKeys ? "text" : "password"}
                value={storeForm.steadfastApiKey || ''}
                onChange={(e) => handleStoreFormChange('steadfastApiKey', e.target.value.trim())}
                placeholder="যেমন: abcdef1234567890..."
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Steadfast Secret Key *
              </label>
              <input
                type={showSteadfastKeys ? "text" : "password"}
                value={storeForm.steadfastSecretKey || ''}
                onChange={(e) => handleStoreFormChange('steadfastSecretKey', e.target.value.trim())}
                placeholder="যেমন: sec_9876543210..."
                className="w-full bg-white border border-neutral-300 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-orange-100">
            <button
              type="button"
              onClick={handleTestSteadfastConnection}
              disabled={testingSteadfast}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {testingSteadfast ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>সংযোগ পরীক্ষা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>কানেকশন টেস্ট ও ব্যালেন্স চেক করুন</span>
                </>
              )}
            </button>

            {steadfastTestResult && (
              <div className={`text-xs font-bold px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                steadfastTestResult.success 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {steadfastTestResult.success ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
                <div>
                  <span>{steadfastTestResult.message}</span>
                  {steadfastTestResult.balance !== undefined && (
                    <span className="ml-2 font-mono font-black text-emerald-950 bg-emerald-100/70 px-2 py-0.5 rounded">
                      ব্যালেন্স: ৳{steadfastTestResult.balance}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bengali Step-by-Step Instructions */}
        <div className="bg-neutral-50 p-4 sm:p-5 rounded-2xl border border-neutral-200/70 space-y-2.5">
          <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>কীভাবে আপনার Steadfast API Key এবং Secret Key পাবেন?</span>
          </div>
          <ol className="text-xs text-neutral-600 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>
              প্রথমে স্টেডফাস্ট মার্চেন্ট পোর্টালে লগইন করুন:{' '}
              <a 
                href="https://portal.steadfast.com.bd" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#FF6A00] font-bold hover:underline inline-flex items-center gap-0.5"
              >
                <span>portal.steadfast.com.bd</span>
                <ExternalLink size={11} />
              </a>
            </li>
            <li>বাম পাশের মেনু থেকে <b>Settings</b> অথবা <b>API Credentials</b> অপশনে যান।</li>
            <li>সেখান থেকে <b>API Key</b> এবং <b>Secret Key</b> কপি করে উপরের বক্সে পেস্ট করুন।</li>
            <li>নিচের <b>"Save All Settings"</b> বাটনে ক্লিক করুন। এরপর অ্যাডমিন অর্ডার লিস্ট থেকে ১-ক্লিকেই পার্সেল বুকিং দেওয়া যাবে!</li>
          </ol>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-black hover:bg-neutral-800 text-white rounded-2xl px-6 py-3.5 text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 min-w-[160px] cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check size={16} className="text-emerald-400" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save All Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
