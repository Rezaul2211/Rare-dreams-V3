/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import OrderSuccess from './pages/OrderSuccess';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { seedProductsIfEmpty } from './lib/seed';

// Lazy loaded non-critical routes for faster initial load
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Login = lazy(() => import('./pages/Login'));
const Account = lazy(() => import('./pages/Account'));
const Contact = lazy(() => import("./pages/Contact"));
const Returns = lazy(() => import("./pages/Returns"));
const License = lazy(() => import("./pages/License"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));

// Admin routes lazy loaded to prevent loading heavy backend code on client visits
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const ProductForm = lazy(() => import('./pages/admin/ProductForm'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminPushNotifications = lazy(() => import('./pages/admin/AdminPushNotifications'));
const AdminSystem = lazy(() => import('./pages/admin/AdminSystem'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center py-20 text-neutral-400">
      <Loader2 size={32} className="animate-spin text-neutral-800 mb-3" />
      <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Loading...</span>
    </div>
  );
}

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (user?.role === 'admin') {
      seedProductsIfEmpty();
    }
  }, [user]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="category/:category" element={<Shop />} />
            <Route path="collection/:category" element={<Shop />} />
            <Route path="daily-drops" element={<Shop />} />
            <Route path="most-loved" element={<Shop />} />
            <Route path="best-sellers" element={<Shop />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order-success/:id" element={<OrderSuccess />} />
            <Route path="login" element={<Login />} />
            <Route path="account" element={<Account />} />
            <Route path="contact" element={<Contact />} />
            <Route path="returns" element={<Returns />} />
            <Route path="license" element={<License />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="track-order" element={<TrackOrder />} />
            <Route path="track" element={<TrackOrder />} />
          </Route>
          
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<ErrorBoundary><ProductForm /></ErrorBoundary>} />
            <Route path="products/edit/:id" element={<ErrorBoundary><ProductForm /></ErrorBoundary>} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="notifications" element={<AdminPushNotifications />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="system" element={<AdminSystem />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
