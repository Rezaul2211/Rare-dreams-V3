import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Users, Search, Trash2, Mail, Phone, ShoppingBag, ArrowLeft } from 'lucide-react';

interface CustomerData {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  createdAt?: any;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerData));
        setCustomers(usersData.filter(u => u.role !== 'admin'));
      } catch (error) {
        console.error("Error fetching customers", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleDelete = async (id: string, email?: string) => {
    if (window.confirm(`Are you sure you want to delete customer record ${email || id}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setCustomers(prev => prev.filter(c => c.id !== id));
      } catch (error) {
        console.error("Error deleting customer", error);
        alert("Failed to delete customer");
      }
    }
  };

  const filteredCustomers = customers.filter(c => {
    const nameStr = (c.displayName || c.name || '').toLowerCase();
    const emailStr = (c.email || '').toLowerCase();
    const phoneStr = (c.phoneNumber || c.phone || '');
    const q = searchTerm.toLowerCase().trim();
    return !q || nameStr.includes(q) || emailStr.includes(q) || phoneStr.includes(q);
  });

  if (loading) return <div className="p-8 text-neutral-600 font-medium">Loading customer directory...</div>;

  return (
    <div className="space-y-4">
      <Link 
        to="/admin" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft size={14} />
        <span>Back to Admin Dashboard</span>
      </Link>

      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Customer Management</h1>
        <p className="text-neutral-500 text-xs sm:text-sm mt-0.5">View and manage registered customer profiles and account information.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs mb-6">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Search customers by name, email or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-neutral-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500 font-bold">
              <th className="p-4">Customer</th>
              <th className="p-4">Contact Details</th>
              <th className="p-4">User ID</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-neutral-500 text-sm">
                  No registered customers found.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => {
                const customerName = customer.displayName || customer.name || 'Registered Customer';
                const customerPhone = customer.phoneNumber || customer.phone;
                const avatarInitial = (customer.displayName || customer.name || customer.email || 'C')[0];

                return (
                  <tr key={customer.id} className="border-b border-neutral-100 hover:bg-neutral-50/80 transition-colors">
                    <td className="p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                        {avatarInitial}
                      </div>
                      <div>
                        <span className="font-bold text-neutral-900 text-sm block">{customerName}</span>
                        <span className="text-[11px] text-emerald-600 font-medium">Verified Account</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex items-center space-x-1.5 text-neutral-800 font-medium text-xs mb-0.5">
                        <Mail size={13} className="text-neutral-400" />
                        <span>{customer.email || 'No email registered'}</span>
                      </div>
                      {customerPhone && (
                        <div className="flex items-center space-x-1.5 text-neutral-500 text-xs">
                          <Phone size={13} className="text-neutral-400" />
                          <span>{customerPhone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs font-mono text-neutral-400">
                      #{customer.id.slice(0, 10)}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(customer.id, customer.email)}
                        className="inline-flex p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Customer Account"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
