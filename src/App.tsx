/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import Account from './pages/Account';
import OrderSuccess from './pages/OrderSuccess';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { useStoreConfigStore } from './store/useStoreConfigStore';
import { seedProductsIfEmpty } from './lib/seed';
import { lazyWithRetry } from './utils/lazyWithRetry';
import AdminNotificationListener from './components/AdminNotificationListener';
import CustomerNotificationListener from './components/CustomerNotificationListener';

// Lazy loaded routes with automatic retry to prevent dynamic import fetch errors
const Shop = lazyWithRetry(() => import('./pages/Shop'));
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetail'));
const Cart = lazyWithRetry(() => import('./pages/Cart'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const PaymentGateway = lazyWithRetry(() => import('./pages/PaymentGateway'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Returns = lazyWithRetry(() => import("./pages/Returns"));
const License = lazyWithRetry(() => import("./pages/License"));
const Privacy = lazyWithRetry(() => import("./pages/Privacy"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const TrackOrder = lazyWithRetry(() => import("./pages/TrackOrder"));

// Admin routes lazy loaded to prevent loading heavy backend code on client visits
const AdminLayout = lazyWithRetry(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazyWithRetry(() => import('./pages/admin/AdminProducts'));
const ProductForm = lazyWithRetry(() => import('./pages/admin/ProductForm'));
const AdminOrders = lazyWithRetry(() => import('./pages/admin/AdminOrders'));
const AdminCustomers = lazyWithRetry(() => import('./pages/admin/AdminCustomers'));
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings'));
const AdminReports = lazyWithRetry(() => import('./pages/admin/AdminReports'));
const AdminPushNotifications = lazyWithRetry(() => import('./pages/admin/AdminPushNotifications'));
const AdminSystem = lazyWithRetry(() => import('./pages/admin/AdminSystem'));

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
  const config = useStoreConfigStore((state) => state.config);
  const fetchConfig = useStoreConfigStore((state) => state.fetchConfig);

  useEffect(() => {
    initializeAuth();
    fetchConfig();
  }, [initializeAuth, fetchConfig]);

  // Dynamically initialize Facebook Pixel when configured
  useEffect(() => {
    if (config?.facebookPixelId && typeof window !== 'undefined') {
      const fbId = config.facebookPixelId.trim();
      if (fbId && !(window as any)._fbq_initialized) {
        (window as any)._fbq_initialized = true;
        try {
          const win = window as any;
          if (!win.fbq) {
            const n: any = function (...args: any[]) {
              if (n.callMethod) {
                n.callMethod(...args);
              } else {
                n.queue.push(args);
              }
            };
            n.queue = [];
            n.loaded = true;
            n.version = '2.0';
            win.fbq = n;
            win._fbq = n;

            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://connect.facebook.net/en_US/fbevents.js';
            script.onerror = () => {
              console.warn("Could not load FB Pixel script.");
            };
            document.head.appendChild(script);
          }

          win.fbq?.('init', fbId);
          win.fbq?.('track', 'PageView');
        } catch (e) {
          console.warn("FB Pixel load error:", e);
        }
      }
    }
  }, [config?.facebookPixelId]);

  useEffect(() => {
    if (user?.role === 'admin') {
      seedProductsIfEmpty();
    }
  }, [user]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <AdminNotificationListener />
        <CustomerNotificationListener />
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
              <Route path="payment" element={<PaymentGateway />} />
              <Route path="order-success/:id" element={<OrderSuccess />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Login initialTab="register" />} />
              <Route path="signup" element={<Login initialTab="register" />} />
              <Route path="account" element={<Account />} />
              <Route path="contact" element={<Contact />} />
              <Route path="returns" element={<Returns />} />
              <Route path="license" element={<License />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="track-order" element={<TrackOrder />} />
              <Route path="track" element={<TrackOrder />} />

              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/edit/:id" element={<ProductForm />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="notifications" element={<AdminPushNotifications />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="system" element={<AdminSystem />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
