import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Product } from '../../types';
import { useCategoryStore } from '../../store/useCategoryStore';
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { categories } = useCategoryStore();

  const fetchProducts = async () => {
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
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      // Optimistically remove from UI
      setProducts(prev => prev.filter(p => p.id !== id));
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Error deleting product from Firestore:", error);
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  if (loading) return <div className="p-8 text-neutral-600 font-medium">Loading product inventory...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Products Management</h1>
          <p className="text-neutral-500 text-xs sm:text-sm mt-0.5">Manage stock, add items, upload photos and customize products.</p>
        </div>
        <Link 
          to="/admin/products/new"
          className="bg-black text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center space-x-2 hover:bg-neutral-800 transition-colors shadow-sm shrink-0"
        >
          <Plus size={18} />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search products by name or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:border-black transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={16} className="text-neutral-400 shrink-0" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-black"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.title} value={c.title}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Card List (Visible on phones) */}
      <div className="md:hidden space-y-3 mb-6">
        {filteredProducts.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 text-center text-neutral-500 text-sm">
            No products found. Add a new product or change search filter!
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-14 h-16 bg-neutral-100 border border-neutral-200 overflow-hidden rounded-xl shrink-0">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[10px]">No Img</div>
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-neutral-900 text-sm block truncate">{product.name}</span>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs font-bold text-neutral-900">৳ {product.price.toFixed(2)}</span>
                    <span className="text-[11px] text-neutral-500 font-medium bg-neutral-100 px-2 py-0.5 rounded">{product.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <Link 
                  to={`/admin/products/edit/${product.id}`}
                  className="p-2 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
                  title="Edit Product"
                >
                  <Edit size={16} />
                </Link>
                <button 
                  onClick={() => handleDelete(product.id, product.name)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  title="Delete Product"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Data Table (Hidden on phones, visible on md and larger) */}
      <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500 font-bold">
              <th className="p-4">Product</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-neutral-500 text-sm">
                  No products found. Add a new product or change search filter!
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                  <td className="p-4 flex items-center space-x-3">
                    <div className="w-12 h-14 bg-neutral-100 border border-neutral-200 overflow-hidden rounded-lg shrink-0">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300 text-[10px]">No Img</div>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-neutral-900 text-sm block">{product.name}</span>
                      <span className="text-[11px] text-neutral-400">ID: #{product.id.slice(0, 6)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-semibold text-neutral-700">{product.category}</td>
                  <td className="p-4 text-sm text-neutral-900 font-bold">৳ {product.price.toFixed(2)}</td>
                  <td className="p-4 text-sm text-neutral-600 font-medium">{product.stockQuantity} pcs</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${
                      product.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <Link 
                      to={`/admin/products/edit/${product.id}`}
                      className="inline-flex p-2 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Edit / Customize Product"
                    >
                      <Edit size={18} />
                    </Link>
                    <button 
                      onClick={() => handleDelete(product.id, product.name)}
                      className="inline-flex p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
