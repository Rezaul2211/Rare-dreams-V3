/**
 * Utility to parse User Agent strings and network data for FCM Device tracking
 */

export interface ParsedDeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceModel: string;
  screen?: string;
  rawUserAgent: string;
}

export interface NetworkInfo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
}

export interface FcmDeviceDoc {
  id: string;
  token: string;
  userId?: string;
  userPhone?: string;
  role?: string;
  deviceInfo?: string;
  ip?: string;
  city?: string;
  country?: string;
  isp?: string;
  browser?: string;
  os?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Parses user agent string to extract clean readable details
 */
export function parseUserAgent(uaString?: string): ParsedDeviceInfo {
  const ua = uaString || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  let browser = 'Unknown Browser';
  let browserVersion = '';
  let os = 'Unknown OS';
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  let deviceModel = '';

  // 1. Detect OS
  if (/Android/i.test(ua)) {
    os = 'Android';
    const match = ua.match(/Android\s([0-9\.]+)/i);
    if (match) os = `Android ${match[1]}`;
    
    // Attempt to extract mobile model e.g. SM-S908B, Redmi Note 10, etc.
    const modelMatch = ua.match(/;\s([^;)]+)\sBuild/i);
    if (modelMatch) {
      deviceModel = modelMatch[1].trim();
    }
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS (iPhone)';
    const match = ua.match(/OS\s([0-9_]+)/i);
    if (match) os = `iOS ${match[1].replace(/_/g, '.')}`;
    deviceModel = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS';
    deviceModel = 'Apple iPad';
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10/11';
    deviceModel = 'PC';
  } else if (/Windows NT 6.3/i.test(ua)) {
    os = 'Windows 8.1';
    deviceModel = 'PC';
  } else if (/Windows NT 6.1/i.test(ua)) {
    os = 'Windows 7';
    deviceModel = 'PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    deviceModel = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceModel = 'Linux Device';
  }

  // 2. Detect Device Type
  if (/Tablet|iPad/i.test(ua) || (os.includes('Android') && !/Mobile/i.test(ua))) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  // 3. Detect Browser
  if (/SamsungBrowser\/([0-9\.]+)/i.test(ua)) {
    browser = 'Samsung Internet';
    browserVersion = ua.match(/SamsungBrowser\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Edg\/([0-9\.]+)/i.test(ua) || /Edge\/([0-9\.]+)/i.test(ua)) {
    browser = 'Microsoft Edge';
    browserVersion = ua.match(/Edg(?:e)?\/([0-9\.]+)/i)?.[1] || '';
  } else if (/OPR\/([0-9\.]+)/i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera';
    browserVersion = ua.match(/OPR\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Chrome Beta/i.test(ua) || /CriOS\/([0-9\.]+)/i.test(ua)) {
    browser = 'Chrome (Mobile)';
  } else if (/Chrome\/([0-9\.]+)/i.test(ua)) {
    browser = 'Google Chrome';
    browserVersion = ua.match(/Chrome\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/([0-9\.]+)/i)?.[1] || '';
  } else if (/Firefox\/([0-9\.]+)/i.test(ua)) {
    browser = 'Mozilla Firefox';
    browserVersion = ua.match(/Firefox\/([0-9\.]+)/i)?.[1] || '';
  }

  return {
    browser,
    browserVersion: browserVersion.split('.')[0] ? `v${browserVersion.split('.')[0]}` : '',
    os,
    deviceType,
    deviceModel: deviceModel || (deviceType === 'mobile' ? 'Mobile Device' : deviceType === 'tablet' ? 'Tablet' : 'Desktop Computer'),
    rawUserAgent: ua
  };
}

/**
 * Fetch public IP and network info with graceful fallback and strict timeout
 */
export async function fetchClientNetworkInfo(): Promise<NetworkInfo | null> {
  if (typeof window === 'undefined') return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    // Try fast ipify first
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.ip) {
        return {
          ip: data.ip
        };
      }
    }
  } catch {
    // Fallback: try secondary provider
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 2500);
      const res2 = await fetch('https://ipapi.co/json/', {
        signal: controller2.signal
      });
      clearTimeout(timeoutId2);
      if (res2.ok) {
        const d2 = await res2.json();
        if (d2 && d2.ip) {
          return {
            ip: d2.ip,
            city: d2.city,
            region: d2.region,
            country: d2.country_name,
            isp: d2.org
          };
        }
      }
    } catch {
      // Ignored
    }
  }

  return null;
}
