import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types';
import { useCategoryStore } from '../../store/useCategoryStore';
import { Plus, Edit, Trash2, Search, Filter, ArrowLeft, RefreshCw, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

// Memoized Mobile Product Card
const ProductMobileCard = memo(({ 
  product, 
  onDelete 
}: { 
  product: Product; 
  onDelete: (id: string, name: string) => void;
}) => {
  return (
    <div className="bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-2xs flex items-center justify-between gap-2.5 w-full min-w-0">
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        <div className="w-12 h-14 bg-neutral-100 border border-neutral-200 overflow-hidden rounded-xl shrink-0">
          {product.images && product.images.length > 0 ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[10px]">No Img</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-bold text-neutral-900 text-xs sm:text-sm block truncate">{product.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs font-bold text-neutral-900">৳ {product.price?.toFixed(2)}</span>
            <span className="text-[10px] text-neutral-500 font-medium bg-neutral-100 px-1.5 py-0.5 rounded truncate max-w-[90px]">
              {product.category}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1 shrink-0">
        <Link 
          to={`/admin/products/edit/${product.id}`}
          className="p-1.5 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          title="Edit Product"
        >
          <Edit size={14} />
        </Link>
        <button 
          onClick={() => onDelete(product.id, product.name)}
          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
          title="Delete Product"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

ProductMobileCard.displayName = 'ProductMobileCard';

// Memoized Desktop Table Row
const ProductTableRow = memo(({ 
  product, 
  onDelete 
}: { 
  product: Product; 
  onDelete: (id: string, name: string) => void;
}) => {
  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50/80 transition-colors">
      <td className="p-3.5 flex items-center space-x-3">
        <div className="w-10 h-12 bg-neutral-100 border border-neutral-200 overflow-hidden rounded-lg shrink-0">
          {product.images && product.images.length > 0 ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[10px]">No Img</div>
          )}
        </div>
        <div className="min-w-0">
          <span className="font-bold text-neutral-900 text-xs sm:text-sm block truncate max-w-[240px]">{product.name}</span>
          <span className="text-[10px] text-neutral-400 font-mono">#{product.id.slice(0, 6)}</span>
        </div>
      </td>
      <td className="p-3.5 text-xs font-semibold text-neutral-700">{product.category}</td>
      <td className="p-3.5 text-xs text-neutral-900 font-bold">৳ {product.price?.toFixed(2)}</td>
      <td className="p-3.5 text-xs text-neutral-600 font-medium">{product.stockQuantity ?? 0} pcs</td>
      <td className="p-3.5">
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
          product.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
        }`}>
          {product.status || 'active'}
        </span>
      </td>
      <td className="p-3.5 text-right space-x-1.5">
        <Link 
          to={`/admin/products/edit/${product.id}`}
          className="inline-flex p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors"
          title="Edit Product"
        >
          <Edit size={16} />
        </Link>
        <button 
          onClick={() => onDelete(product.id, product.name)}
          className="inline-flex p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          title="Delete Product"
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
});

ProductTableRow.displayName = 'ProductTableRow';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { categories } = useCategoryStore();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      setProducts(prev => prev.filter(p => p.id !== id));
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Error deleting product from Firestore:", error);
      }
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !q || 
        (p.name?.toLowerCase() || '').includes(q) ||
        (p.category?.toLowerCase() || '').includes(q);
      
      let matchesCategory = selectedCategory === 'All';
      if (!matchesCategory && p.category) {
        const pCat = p.category.toLowerCase().trim();
        const sCat = selectedCategory.toLowerCase().trim();
        if (pCat === sCat) matchesCategory = true;
        else if (sCat.includes('boy') && (pCat.includes('boy') || pCat.includes('kids'))) matchesCategory = true;
        else if (sCat.includes('girl') && (pCat.includes('girl') || pCat.includes('kids'))) matchesCategory = true;
        else if (sCat.includes('baby') && (pCat.includes('baby') || pCat.includes('kids'))) matchesCategory = true;
        else if ((sCat.includes('footwear') || sCat.includes('shoe')) && (pCat.includes('footwear') || pCat.includes('shoe'))) matchesCategory = true;
        else matchesCategory = pCat.includes(sCat) || sCat.includes(pCat);
      }
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 pb-12 animate-in fade-in duration-150">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
        <div>
          <h1 className="text-base sm:text-xl font-black uppercase tracking-tight text-neutral-900">
            Products Management
          </h1>
          <p className="text-neutral-500 text-[11px] sm:text-xs mt-0.5">
            Manage stock, add items, and customize product catalog ({products.length} items)
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Link 
            to="/admin/products/new"
            className="bg-neutral-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 hover:bg-black transition-colors shadow-xs shrink-0"
          >
            <Plus size={15} />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row gap-2.5 items-center justify-between w-full min-w-0">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search by name or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm outline-none focus:border-black transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={14} className="text-neutral-400 shrink-0" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-medium outline-none focus:border-black"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.title} value={c.title}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Card List (Visible on phones) */}
      <div className="md:hidden space-y-2.5 w-full min-w-0">
        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-neutral-400">
            <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-neutral-900" />
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 text-center text-neutral-500 text-xs">
            No products found matching query.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <ProductMobileCard
              key={product.id}
              product={product}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Desktop Data Table (Hidden on phones, visible on md and larger) */}
      <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-neutral-200 overflow-hidden w-full min-w-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
              <th className="p-3.5">Product</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Price</th>
              <th className="p-3.5">Stock</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-400 text-xs font-bold">
                  <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-neutral-900" />
                  Loading inventory...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs">
                  No products found.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  onDelete={handleDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
