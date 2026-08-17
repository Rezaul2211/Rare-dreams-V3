import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { 
  ArrowLeft, 
  Search, 
  Heart, 
  ShoppingBag, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  X,
  Check,
  Star,
  Sparkles
} from 'lucide-react';
import { ProductSkeleton } from '../components/ProductSkeleton';
import { ProductCard } from '../components/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { useWishlistStore } from '../store/useWishlistStore';
import SEO from '../components/SEO';

// Category Definitions matching user blueprint screenshot exactly
interface CollectionMeta {
  title: string;
  subtitle: string;
  subcategories: string[];
  defaultItemsCount: number;
  sampleProducts: Product[];
}

const COLLECTIONS_CONFIG: Record<string, CollectionMeta> = {
  men: {
    title: "Men's Collection",
    subtitle: "Explore our latest collection for men.\nPremium quality, timeless style.",
    subcategories: ['All', 'Clothing', 'Shoes', 'Accessories', 'Watches'],
    defaultItemsCount: 50,
    sampleProducts: [
      {
        id: 'men-suit-1',
        name: 'Classic Suit Jacket',
        category: 'Men',
        subcategory: 'Clothing',
        price: 4900,
        comparePrice: 6790,
        discount: 28,
        rating: 4.8,
        stockQuantity: 45,
        images: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Tailored classic suit jacket crafted from breathable wool-blend fabric.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-shoes-1',
        name: 'Oxford Shoes',
        category: 'Men',
        subcategory: 'Shoes',
        price: 1360,
        comparePrice: 1580,
        discount: 14,
        rating: 4.7,
        stockQuantity: 30,
        images: ['https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Handcrafted genuine leather Oxford shoes for formal elegance.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-denim-1',
        name: 'Premium Denim Jacket',
        category: 'Men',
        subcategory: 'Clothing',
        price: 2240,
        comparePrice: 2800,
        discount: 20,
        rating: 4.6,
        stockQuantity: 50,
        images: ['https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Heavyweight washed denim jacket with vintage contrast stitching.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-watch-1',
        name: 'Luxury Watch',
        category: 'Men',
        subcategory: 'Watches',
        price: 3650,
        comparePrice: 4450,
        discount: 18,
        rating: 4.9,
        stockQuantity: 25,
        images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Chronograph luxury wristwatch with sapphire crystal and genuine leather strap.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-shirt-1',
        name: 'Casual Shirt',
        category: 'Men',
        subcategory: 'Clothing',
        price: 1250,
        comparePrice: 1670,
        discount: 10,
        rating: 4.7,
        stockQuantity: 65,
        images: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Slim-fit breathable cotton casual shirt for effortless style.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-pants-1',
        name: 'Cargo Pants',
        category: 'Men',
        subcategory: 'Clothing',
        price: 1490,
        comparePrice: 1890,
        discount: 21,
        rating: 4.6,
        stockQuantity: 40,
        images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Multi-pocket utility cargo pants in relaxed durable cotton twill.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-boots-1',
        name: 'Leather Chelsea Boots',
        category: 'Men',
        subcategory: 'Shoes',
        price: 2950,
        comparePrice: 3800,
        discount: 22,
        rating: 4.8,
        stockQuantity: 28,
        images: ['https://images.unsplash.com/photo-1638247025967-b4e38f787b76?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Sleek leather chelsea boots with elastic side gussets.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'men-belt-1',
        name: 'Classic Minimalist Belt',
        category: 'Men',
        subcategory: 'Accessories',
        price: 790,
        comparePrice: 990,
        discount: 20,
        rating: 4.7,
        stockQuantity: 80,
        images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Full-grain leather belt with a brushed nickel buckle.',
        status: 'published',
        createdAt: new Date()
      }
    ]
  },
  women: {
    title: "Women's Collection",
    subtitle: "Trendy, elegant & comfortable styles\nfor every occasion.",
    subcategories: ['All', 'Dresses', 'Tops', 'Bags', 'Shoes', 'Jewelry'],
    defaultItemsCount: 36,
    sampleProducts: [
      {
        id: 'women-bag-1',
        name: 'Elegant Shoulder Bag',
        category: 'Women',
        subcategory: 'Bags',
        price: 1490,
        comparePrice: 2190,
        discount: 32,
        rating: 4.8,
        stockQuantity: 40,
        images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Spacious structured shoulder bag with dual gold-toned metallic hardware.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-dress-1',
        name: 'Premium Maxi Dress',
        category: 'Women',
        subcategory: 'Dresses',
        price: 1890,
        comparePrice: 2250,
        discount: 16,
        rating: 4.7,
        stockQuantity: 35,
        images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Floor-length flowy maxi dress in soft blush pink crepe.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-dress-2',
        name: 'Floral Summer Dress',
        category: 'Women',
        subcategory: 'Dresses',
        price: 1650,
        comparePrice: 2200,
        discount: 25,
        rating: 4.6,
        stockQuantity: 50,
        images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Breezy wrap floral dress with flutter sleeves and waist tie.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-bag-2',
        name: 'Chic Pink Handbag',
        category: 'Women',
        subcategory: 'Bags',
        price: 1280,
        comparePrice: 1600,
        discount: 20,
        rating: 4.9,
        stockQuantity: 42,
        images: ['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Iconic rose handbag with detachable shoulder strap and tassel charm.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-sandals-1',
        name: 'Heels Sandals',
        category: 'Women',
        subcategory: 'Shoes',
        price: 1690,
        comparePrice: 2190,
        discount: 21,
        rating: 4.7,
        stockQuantity: 30,
        images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Comfortable block-heel strappy sandals in warm tan finish.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-earrings-1',
        name: 'Earrings',
        category: 'Women',
        subcategory: 'Jewelry',
        price: 690,
        comparePrice: 890,
        discount: 18,
        rating: 4.9,
        stockQuantity: 75,
        images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=400&q=60&auto=format&fit=crop'],
        description: '24K gold plated crystal textured drop earrings.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-top-1',
        name: 'Silk Satin Blouse',
        category: 'Women',
        subcategory: 'Tops',
        price: 1450,
        comparePrice: 1950,
        discount: 25,
        rating: 4.8,
        stockQuantity: 40,
        images: ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Lustrous satin button-down blouse for everyday luxury.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'women-necklace-1',
        name: 'Golden Pendant Necklace',
        category: 'Women',
        subcategory: 'Jewelry',
        price: 850,
        comparePrice: 1150,
        discount: 26,
        rating: 4.8,
        stockQuantity: 60,
        images: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Minimalist golden coin pendant chain necklace.',
        status: 'published',
        createdAt: new Date()
      }
    ]
  },
  kids: {
    title: "Kids Collection",
    subtitle: "Stylish, comfortable & playful\nlooks for your little ones.",
    subcategories: ['All', 'Boys', 'Girls', 'Footwear', 'Accessories'],
    defaultItemsCount: 32,
    sampleProducts: [
      {
        id: 'kids-boys-1',
        name: 'Boys Casual Shirt',
        category: 'Kids',
        subcategory: 'Boys',
        price: 890,
        comparePrice: 1120,
        discount: 20,
        rating: 4.7,
        stockQuantity: 60,
        images: ['https://images.unsplash.com/photo-1503945438517-f65904a52ce6?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Soft 100% cotton casual button-up shirt for boys.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-girls-1',
        name: 'Girls Party Dress',
        category: 'Kids',
        subcategory: 'Girls',
        price: 1250,
        comparePrice: 1470,
        discount: 15,
        rating: 4.8,
        stockQuantity: 45,
        images: ['https://images.unsplash.com/photo-1621452773781-0f992fd1f5cb?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Sparkling tulle party frock with soft satin waistband for girls.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-sneakers-1',
        name: 'Kids Sneakers',
        category: 'Kids',
        subcategory: 'Footwear',
        price: 990,
        comparePrice: 1200,
        discount: 18,
        rating: 4.6,
        stockQuantity: 50,
        images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Lightweight cushioned athletic sneakers with easy velcro strap.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-backpack-1',
        name: 'Kids Backpack',
        category: 'Kids',
        subcategory: 'Accessories',
        price: 890,
        comparePrice: 990,
        discount: 10,
        rating: 4.7,
        stockQuantity: 38,
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Water-resistant playful school backpack with padded shoulder straps.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-denim-1',
        name: 'Boys Denim Jeans',
        category: 'Kids',
        subcategory: 'Boys',
        price: 950,
        comparePrice: 1250,
        discount: 24,
        rating: 4.7,
        stockQuantity: 48,
        images: ['https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Stretch cotton denim pants with adjustable elastic waistband.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-frock-1',
        name: 'Girls Floral Summer Frock',
        category: 'Kids',
        subcategory: 'Girls',
        price: 1100,
        comparePrice: 1400,
        discount: 21,
        rating: 4.8,
        stockQuantity: 36,
        images: ['https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Breathable organic cotton summer dress with sweet ruffle trim.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-shoes-1',
        name: 'Toddler Soft Cushion Shoes',
        category: 'Kids',
        subcategory: 'Footwear',
        price: 790,
        comparePrice: 990,
        discount: 20,
        rating: 4.6,
        stockQuantity: 29,
        images: ['https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Anti-slip flexible first-walker shoes for toddlers.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'kids-hat-1',
        name: 'Kids Sun Hat',
        category: 'Kids',
        subcategory: 'Accessories',
        price: 450,
        comparePrice: 600,
        discount: 25,
        rating: 4.9,
        stockQuantity: 55,
        images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Wide-brim UV-protection cotton bucket hat with chin strap.',
        status: 'published',
        createdAt: new Date()
      }
    ]
  },
  accessories: {
    title: "Accessories",
    subtitle: "Complete your look with our\npremium accessories.",
    subcategories: ['All', 'Bags', 'Watches', 'Belts', 'Sunglasses', 'Jewelry'],
    defaultItemsCount: 36,
    sampleProducts: [
      {
        id: 'acc-bag-1',
        name: 'Premium Handbag',
        category: 'Accessories',
        subcategory: 'Bags',
        price: 1890,
        comparePrice: 2390,
        discount: 21,
        rating: 4.9,
        stockQuantity: 40,
        images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Handcrafted luxury leather handbag with polished brass accents.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-watch-1',
        name: 'Classic Watch',
        category: 'Accessories',
        subcategory: 'Watches',
        price: 3650,
        comparePrice: 4450,
        discount: 18,
        rating: 4.8,
        stockQuantity: 28,
        images: ['https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Rose-gold trimmed quartz timepiece with dark brown stitched leather strap.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-sunglasses-1',
        name: 'Sunglasses',
        category: 'Accessories',
        subcategory: 'Sunglasses',
        price: 890,
        comparePrice: 1190,
        discount: 25,
        rating: 4.7,
        stockQuantity: 56,
        images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Polarized UV400 classic aviator frame sunglasses with metal temples.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-belt-1',
        name: 'Leather Belt',
        category: 'Accessories',
        subcategory: 'Belts',
        price: 650,
        comparePrice: 850,
        discount: 21,
        rating: 4.6,
        stockQuantity: 45,
        images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Genuine full-grain cowhide leather belt with antique buckle.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-bracelet-1',
        name: 'Chain Bracelet',
        category: 'Accessories',
        subcategory: 'Jewelry',
        price: 750,
        comparePrice: 980,
        discount: 22,
        rating: 4.6,
        stockQuantity: 38,
        images: ['https://images.unsplash.com/photo-1611591475102-1ef994689622?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Italian cuban link gold plated chain bracelet with lobster clasp.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-wallet-1',
        name: 'Wallet',
        category: 'Accessories',
        subcategory: 'Bags',
        price: 690,
        comparePrice: 860,
        discount: 20,
        rating: 4.7,
        stockQuantity: 42,
        images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'RFID-blocking slim bi-fold leather wallet with multiple card slots.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-earrings-1',
        name: 'Earrings',
        category: 'Accessories',
        subcategory: 'Jewelry',
        price: 690,
        comparePrice: 890,
        discount: 18,
        rating: 4.9,
        stockQuantity: 95,
        images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Sparkling diamond-cut hoop earrings in 18K yellow gold tone.',
        status: 'published',
        createdAt: new Date()
      },
      {
        id: 'acc-aviator-1',
        name: 'Vintage Aviator Shades',
        category: 'Accessories',
        subcategory: 'Sunglasses',
        price: 990,
        comparePrice: 1350,
        discount: 26,
        rating: 4.8,
        stockQuantity: 34,
        images: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=400&q=60&auto=format&fit=crop'],
        description: 'Retro gold frame aviator sunglasses with tinted gradient lenses.',
        status: 'published',
        createdAt: new Date()
      }
    ]
  }
};

export default function Shop() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const searchQuery = searchParams.get('search') || searchParams.get('q') || '';
  const wishlistIds = useWishlistStore((state) => state.wishlistIds);
  const cartItems = useCartStore((state) => state.items);

  const wishlistCount = wishlistIds.length;
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Active subcategory filter (e.g., 'All', 'Clothing', 'Shoes')
  const [activeSubcat, setActiveSubcat] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating' | 'newest'>('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // DB Products and loading state
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve collection key
  const collectionKey = useMemo(() => {
    if (!category) return 'all';
    const c = category.toLowerCase().trim();
    if (c.includes('men') && !c.includes('women')) return 'men';
    if (c.includes('women')) return 'women';
    if (c.includes('kid') || c.includes('boy') || c.includes('girl') || c.includes('baby')) return 'kids';
    if (c.includes('access')) return 'accessories';
    return 'all';
  }, [category]);

  const currentMeta = useMemo(() => {
    if (COLLECTIONS_CONFIG[collectionKey]) {
      return COLLECTIONS_CONFIG[collectionKey];
    }
    return {
      title: category ? `${category} Collection` : "All Collections",
      subtitle: "Discover our full range of premium apparel, accessories, and footwear.",
      subcategories: ['All', 'Men', 'Women', 'Kids', 'Accessories'],
      defaultItemsCount: 50,
      sampleProducts: [
        ...COLLECTIONS_CONFIG.men.sampleProducts.slice(0, 2),
        ...COLLECTIONS_CONFIG.women.sampleProducts.slice(0, 2),
        ...COLLECTIONS_CONFIG.kids.sampleProducts.slice(0, 2),
        ...COLLECTIONS_CONFIG.accessories.sampleProducts.slice(0, 2),
      ]
    };
  }, [collectionKey, category]);

  // Reset pagination & subcat when category param changes
  useEffect(() => {
    setActiveSubcat('All');
    setCurrentPage(1);
  }, [category]);

  // Fetch Firestore products
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'products'),
          where('status', '==', 'published')
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Product));
        if (isMounted) {
          setDbProducts(fetched);
        }
      } catch (error) {
        console.error("Error fetching products", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchProducts();
    return () => { isMounted = false; };
  }, []);

  // Merge Firestore products with authentic fallback sample products if DB is empty for this category
  const allCategoryProducts = useMemo(() => {
    let list: Product[] = [];

    // Filter DB products for current category
    if (dbProducts.length > 0) {
      if (collectionKey === 'all') {
        list = [...dbProducts];
      } else {
        const target = collectionKey;
        list = dbProducts.filter(p => {
          if (!p.category) return false;
          const c = p.category.toLowerCase().trim();
          if (target === 'men') return (c.includes('men') && !c.includes('women')) || c.includes('boy');
          if (target === 'women') return c.includes('women') || c.includes('girl');
          if (target === 'kids') return c.includes('kid') || c.includes('baby') || c.includes('boy') || c.includes('girl');
          if (target === 'accessories') return c.includes('access') || c.includes('watch') || c.includes('bag') || c.includes('belt');
          return c.includes(target);
        });
      }
    }

    // If DB has fewer than 6 items for this specific collection, supplement with exact sample products from screenshot
    if (list.length < 6 && currentMeta.sampleProducts) {
      const existingIds = new Set(list.map(p => p.id));
      const neededSamples = currentMeta.sampleProducts.filter(p => !existingIds.has(p.id));
      list = [...list, ...neededSamples];
    }

    return list;
  }, [dbProducts, collectionKey, currentMeta]);

  // Apply Subcategory, Search, Price, Stock & Sort filters
  const filteredProducts = useMemo(() => {
    let result = [...allCategoryProducts];

    // 1. Subcategory filter
    if (activeSubcat !== 'All') {
      const subLower = activeSubcat.toLowerCase().trim();
      result = result.filter(p => {
        const pSub = (p.subcategory || '').toLowerCase().trim();
        const pName = (p.name || '').toLowerCase().trim();
        const pCat = (p.category || '').toLowerCase().trim();
        return pSub.includes(subLower) || pName.includes(subLower) || pCat.includes(subLower);
      });
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(term);
        const catMatch = p.category?.toLowerCase().includes(term);
        const subcatMatch = p.subcategory?.toLowerCase().includes(term);
        const descMatch = p.description?.toLowerCase().includes(term);
        return nameMatch || catMatch || subcatMatch || descMatch;
      });
    }

    // 3. Price Filters
    if (typeof minPrice === 'number' && minPrice > 0) {
      result = result.filter(p => p.price >= minPrice);
    }
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      result = result.filter(p => p.price <= maxPrice);
    }

    // 4. In stock only
    if (onlyInStock) {
      result = result.filter(p => (p.stockQuantity === undefined || p.stockQuantity > 0));
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'rating') return (b.rating || 4.5) - (a.rating || 4.5);
      if (sortBy === 'newest') return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      return 0; // Popular / Default
    });

    return result;
  }, [allCategoryProducts, activeSubcat, searchQuery, minPrice, maxPrice, onlyInStock, sortBy]);

  // Total items display count (e.g. "Showing 1-8 of 50 items" or actual items count)
  const totalCount = Math.max(filteredProducts.length, currentMeta.defaultItemsCount);
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  // Current page sliced products
  const displayedProducts = useMemo(() => {
    // If total filtered products is small, repeat or show all available
    if (filteredProducts.length <= itemsPerPage) {
      return filteredProducts;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-neutral-900 pb-16">
      <SEO 
        title={`${currentMeta.title} | Rare Dreams Luxury Fashion`}
        description={currentMeta.subtitle.replace('\n', ' ')}
        keywords={`${currentMeta.title}, luxury fashion, apparel, collection, Rare Dreams`}
      />

      {/* Main Category Content Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 md:px-8 pt-4 sm:pt-6 space-y-3.5 sm:space-y-4">
        
        {/* Navigation Breadcrumb / Back Button */}
        <div className="flex items-center space-x-2 text-xs font-medium text-neutral-500">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go Back"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 -ml-1 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            <span className="font-semibold">Back</span>
          </button>
          <span className="text-neutral-300">/</span>
          <Link to="/" className="hover:text-black transition-colors">Home</Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-900 font-semibold">{currentMeta.title}</span>
        </div>

        {/* 2. CATEGORY TITLE & SUBTITLE */}
        <section className="space-y-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif text-neutral-900 tracking-tight">
            {currentMeta.title}
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-neutral-500 font-normal leading-relaxed whitespace-pre-line">
            {currentMeta.subtitle}
          </p>
        </section>

        {/* 3. SUB-CATEGORY FILTER PILLS ROW (e.g. All, Clothing, Shoes, Accessories, Watches) */}
        <section className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {currentMeta.subcategories.map((subcat) => {
            const isActive = activeSubcat === subcat;
            return (
              <button
                key={subcat}
                onClick={() => {
                  setActiveSubcat(subcat);
                  setCurrentPage(1);
                }}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-black text-white shadow-2xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
                }`}
              >
                {subcat}
              </button>
            );
          })}
        </section>

        {/* 4. FILTER & SORT TOOLBAR (Filter button + Sort by: Popular dropdown) */}
        <section className="flex items-center justify-between pt-1 pb-1 border-b border-neutral-100">
          {/* Filter Toggle Button */}
          <button
            onClick={() => setIsFilterOpen(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-neutral-300 text-neutral-800 text-xs font-semibold cursor-pointer active:scale-95 transition-all bg-white shadow-2xs"
          >
            <SlidersHorizontal size={13} className="text-neutral-600" />
            <span>Filter</span>
            {(minPrice || maxPrice || onlyInStock) && (
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
            )}
          </button>

          {/* Sort By Dropdown */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-neutral-500 font-medium hidden xs:inline">Sort by:</span>
            <div className="relative inline-block">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none bg-transparent pr-5 pl-1.5 py-1 text-xs font-bold text-neutral-900 focus:outline-none cursor-pointer"
              >
                <option value="popular">Popular</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
              <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
            </div>
          </div>
        </section>

        {/* Filter Drawer / Panel (Expandable) */}
        {isFilterOpen && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 space-y-3 transition-all animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Refine Products</span>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Price Range */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Price Range (৳)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 outline-none focus:border-black"
                  />
                  <span className="text-neutral-400 text-xs">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* In Stock Toggle */}
              <div className="flex items-center space-x-2 pt-4">
                <input
                  type="checkbox"
                  id="inStockCheck"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded text-black focus:ring-black cursor-pointer"
                />
                <label htmlFor="inStockCheck" className="text-xs font-semibold text-neutral-800 cursor-pointer">
                  In Stock Only
                </label>
              </div>

              {/* Reset Action */}
              <div className="flex items-end justify-end">
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setOnlyInStock(false);
                    setActiveSubcat('All');
                  }}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer py-1.5"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. 2-COLUMN PRODUCT GRID (Mobile / Responsive) matching screenshot */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {[...Array(6)].map((_, i) => (
              <ProductSkeleton key={i} index={i} />
            ))}
          </div>
        ) : displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
            {displayedProducts.map((product, index) => (
              <div key={product.id || index}>
                <ProductCard product={product} index={index} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-2xl p-10 text-center border border-neutral-200/80 my-6">
            <h3 className="text-base font-bold uppercase tracking-tight text-neutral-900 mb-1">
              No products found
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Try adjusting your subcategory or filter settings.
            </p>
            <button 
              onClick={() => {
                setActiveSubcat('All');
                setMinPrice('');
                setMaxPrice('');
              }}
              className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full hover:bg-neutral-800"
            >
              Show All Products
            </button>
          </div>
        )}

        {/* 6. BOTTOM PAGINATION (Showing 1-8 of X items | < 1 2 3 ... 7 >) */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 pb-8 border-t border-neutral-100 text-xs text-neutral-600">
          {/* Left: Showing count */}
          <div>
            <span>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}-{Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} items
            </span>
          </div>

          {/* Right: Page Buttons */}
          <div className="flex items-center space-x-1">
            {/* Prev Page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous Page"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                currentPage === 1 
                  ? 'border-neutral-200 text-neutral-300 pointer-events-none' 
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Dynamic Page Numbers */}
            {(() => {
              const maxVisible = 5;
              const pages: (number | string)[] = [];

              if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push('...');
                
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                
                for (let i = start; i <= end; i++) {
                  if (!pages.includes(i)) pages.push(i);
                }

                if (currentPage < totalPages - 2) pages.push('...');
                if (!pages.includes(totalPages)) pages.push(totalPages);
              }

              return pages.map((page, i) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${i}`} className="px-1 text-neutral-400">
                      ...
                    </span>
                  );
                }

                const isCurrent = page === currentPage;
                return (
                  <button
                    key={`page-${page}`}
                    onClick={() => handlePageChange(page as number)}
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-black text-white shadow-2xs'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              });
            })()}

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next Page"
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                currentPage === totalPages 
                  ? 'border-neutral-200 text-neutral-300 pointer-events-none' 
                  : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
