/**
 * Steadfast Courier API Service for Bangladesh E-Commerce
 * Official API Base: https://api.steadfast.com.bd/api/v1
 */

export interface SteadfastCreateOrderPayload {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
}

export interface SteadfastConsignment {
  consignment_id: number;
  invoice: string;
  tracking_code: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  status: string;
  note?: string;
  created_at: string;
  updated_at?: string;
}

export interface SteadfastCreateOrderResponse {
  status: number;
  message?: string;
  consignment?: SteadfastConsignment;
  errors?: Record<string, string[]>;
  error?: string;
}

export interface SteadfastBalanceResponse {
  status: number;
  current_balance?: number;
  message?: string;
  error?: string;
}

export interface SteadfastStatusResponse {
  status: number;
  delivery_status?: string;
  message?: string;
  error?: string;
}

export interface SteadfastServiceResult<T = any> {
  success: boolean;
  data?: T;
  message: string;
  details?: string;
  error?: string;
}

/**
 * Generates official Steadfast parcel live tracking link
 */
export function getSteadfastTrackingUrl(trackingCode: string): string {
  if (!trackingCode) return 'https://steadfast.com.bd/tracking';
  // The /t/ endpoint is for hashed/time-limited links and throws an "expired" error for raw tracking codes.
  // Currently, Steadfast does not support a direct public URL for raw tracking codes without a form submission,
  // so we redirect to the tracking portal where the user can paste the code.
  return `https://steadfast.com.bd/tracking`;
}

/**
 * Maps Steadfast delivery status strings to human-readable Bengali & English descriptions
 */
export function formatSteadfastStatus(status?: string): { labelBn: string; labelEn: string; color: string } {
  if (!status) return { labelBn: 'অপেক্ষমাণ', labelEn: 'Pending', color: 'bg-neutral-100 text-neutral-800' };

  const s = status.toLowerCase();
  if (s.includes('in_review') || s === 'in review') {
    return { labelBn: 'স্টেডফাস্ট রিভিউতে আছে (In Review)', labelEn: 'In Review', color: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  if (s.includes('pending')) {
    return { labelBn: 'পিকআপ অপেক্ষমাণ (Pending Pickup)', labelEn: 'Pending Pickup', color: 'bg-blue-100 text-blue-900 border-blue-300' };
  }
  if (s.includes('delivered') && !s.includes('partial')) {
    return { labelBn: 'সফল ডেলিভারি (Delivered)', labelEn: 'Delivered', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  if (s.includes('partial')) {
    return { labelBn: 'আংশিক ডেলিভারি (Partial Delivered)', labelEn: 'Partial Delivered', color: 'bg-teal-100 text-teal-900 border-teal-300' };
  }
  if (s.includes('cancelled') || s.includes('cancel')) {
    return { labelBn: 'বাতিল (Cancelled)', labelEn: 'Cancelled', color: 'bg-rose-100 text-rose-900 border-rose-300' };
  }
  if (s.includes('hold')) {
    return { labelBn: 'হোল্ডে আছে (On Hold)', labelEn: 'On Hold', color: 'bg-purple-100 text-purple-900 border-purple-300' };
  }
  if (s.includes('return')) {
    return { labelBn: 'রিটার্ন প্রসেসিং (Returning)', labelEn: 'Returning', color: 'bg-orange-100 text-orange-900 border-orange-300' };
  }

  return { labelBn: status, labelEn: status, color: 'bg-neutral-100 text-neutral-800 border-neutral-300' };
}

/**
 * Checks Steadfast Merchant Account balance and tests connection
 */
export async function checkSteadfastBalance(credentials?: {
  apiKey?: string;
  secretKey?: string;
  testMode?: boolean;
}): Promise<SteadfastServiceResult<{ current_balance: number; isTestMode?: boolean }>> {
  try {
    const response = await fetch('/api/courier/steadfast/check-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: credentials?.apiKey,
        secretKey: credentials?.secretKey,
        testMode: credentials?.testMode,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      return {
        success: true,
        data: { 
          current_balance: Number(result.balance ?? result.current_balance ?? 0),
          isTestMode: result.isTestMode,
        },
        message: result.message || `কানেকশন সফল! একাউন্ট ব্যালেন্স: ৳${Number(result.balance ?? 0).toLocaleString()}`,
        details: result.details,
      };
    }

    return {
      success: false,
      message: result.message || result.error || 'Steadfast এপিআই কানেক্ট করা যায়নি। কি ও সিক্রেট কি চেক করুন।',
      details: result.details,
      error: result.error || result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'নেটওয়ার্ক এরর। দয়া করে আবার চেষ্টা করুন।',
      error: String(err),
    };
  }
}

/**
 * Creates a parcel consignment / booking in Steadfast Courier (or safe sandbox if testMode is ON)
 */
export async function createSteadfastOrder(
  payload: SteadfastCreateOrderPayload,
  credentials?: { apiKey?: string; secretKey?: string; testMode?: boolean }
): Promise<SteadfastServiceResult<SteadfastConsignment>> {
  try {
    // Sanitize phone number (remove spaces, symbols; ensure standard 11 digits format)
    const rawPhone = payload.recipient_phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '').slice(-11);

    if (!cleanPhone || cleanPhone.length < 11) {
      return {
        success: false,
        message: 'গ্রাহকের সঠিক ১১ ডিজিটের ফোন নাম্বার প্রয়োজন (যেমন: 01712345678)।',
        error: 'INVALID_PHONE',
      };
    }

    if (!payload.recipient_name || payload.recipient_name.trim().length === 0) {
      return {
        success: false,
        message: 'গ্রাহকের নাম আবশ্যক।',
        error: 'MISSING_RECIPIENT_NAME',
      };
    }

    if (!payload.recipient_address || payload.recipient_address.trim().length < 5) {
      return {
        success: false,
        message: 'গ্রাহকের ডেলিভারি ঠিকানা বিস্তারিত উল্লেখ করুন।',
        error: 'MISSING_RECIPIENT_ADDRESS',
      };
    }

    const response = await fetch('/api/courier/steadfast/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: credentials?.apiKey,
        secretKey: credentials?.secretKey,
        testMode: credentials?.testMode,
        invoice: payload.invoice,
        recipient_name: payload.recipient_name.trim(),
        recipient_phone: cleanPhone,
        recipient_address: payload.recipient_address.trim(),
        cod_amount: Math.max(0, Math.round(Number(payload.cod_amount || 0))),
        note: payload.note || 'Rare Dreams Luxury Fashion Parcel',
      }),
    });

    const result = await response.json();

    if (response.ok && result.success && result.consignment) {
      return {
        success: true,
        data: result.consignment,
        message: result.message || `স্টেডফাস্টে পার্সেল বুকিং সফল! ট্র্যাকিং কোড: ${result.consignment.tracking_code}`,
      };
    }

    return {
      success: false,
      message: result.message || result.error || 'স্টেডফাস্টে পার্সেল বুকিং ব্যর্থ হয়েছে।',
      error: result.error || result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'সার্ভার যোগাযোগে ত্রুটি হয়েছে।',
      error: String(err),
    };
  }
}

/**
 * Checks live delivery status of a consignment by Tracking Code
 */
export async function getSteadfastStatus(
  trackingCode: string,
  credentials?: { apiKey?: string; secretKey?: string; testMode?: boolean }
): Promise<SteadfastServiceResult<{ delivery_status: string }>> {
  try {
    if (!trackingCode) {
      return { success: false, message: 'ট্র্যাকিং কোড পাওয়া যায়নি', error: 'MISSING_TRACKING_CODE' };
    }

    const response = await fetch('/api/courier/steadfast/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: credentials?.apiKey,
        secretKey: credentials?.secretKey,
        testMode: credentials?.testMode,
        trackingCode: trackingCode.trim(),
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      return {
        success: true,
        data: { delivery_status: result.delivery_status || result.status || 'in_review' },
        message: `স্ট্যাটাস: ${result.delivery_status || 'আপডেটেড'}`,
      };
    }

    return {
      success: false,
      message: result.message || result.error || 'স্ট্যাটাস আনা সম্ভব হয়নি।',
      error: result.error || result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'সার্ভার যোগাযোগে ত্রুটি।',
      error: String(err),
    };
  }
}
