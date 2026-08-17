/**
 * Geolocation & Reverse Geocoding Utility for Rare Dreams E-Commerce
 * 
 * Standards-compliant, user-gesture initiated browser geolocation.
 * Adheres strictly to browser security models, secure context checks,
 * permissions API, and clear user-facing feedback without fake bypasses.
 */

export interface GeolocationResult {
  success: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  errorType?: 'unsupported' | 'insecure_context' | 'permission_denied' | 'position_unavailable' | 'timeout' | 'geocoding_failed' | 'unknown';
  errorMessage?: string;
}

/**
 * Parses OpenStreetMap Nominatim response into a clean, human-readable delivery address
 */
export function parseNominatimAddress(data: any): string {
  if (!data) return '';

  if (data.address && typeof data.address === 'object') {
    const addr = data.address;
    const parts: string[] = [];

    // 1. House / Building / Flat / POI
    const building = addr.building || addr.house_number || addr.house_name || addr.amenity || addr.shop;
    if (building && typeof building === 'string' && !parts.includes(building)) {
      parts.push(building);
    }

    // 2. Road / Street / Lane
    const road = addr.road || addr.street || addr.residential || addr.path || addr.footway;
    if (road && typeof road === 'string' && !parts.includes(road)) {
      parts.push(road);
    }

    // 3. Area / Neighbourhood / Suburb / Quarter / Village
    const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.subdivision || addr.village || addr.hamlet;
    if (area && typeof area === 'string' && !parts.includes(area)) {
      parts.push(area);
    }

    // 4. Thana / Upazila / Sub-district / City District / Borough / Municipality
    const subdistrict = addr.subdistrict || addr.city_district || addr.municipality || addr.borough || addr.county;
    if (subdistrict && typeof subdistrict === 'string' && !parts.includes(subdistrict)) {
      parts.push(subdistrict);
    }

    // 5. City / Town / District / Division
    const city = addr.city || addr.town || addr.district || addr.state_district;
    if (city && typeof city === 'string' && !parts.includes(city)) {
      parts.push(city);
    }

    // 6. Postcode
    if (addr.postcode && typeof addr.postcode === 'string' && !parts.includes(addr.postcode)) {
      parts.push(addr.postcode);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }
  }

  if (data.display_name && typeof data.display_name === 'string') {
    return data.display_name;
  }

  return '';
}

/**
 * Reverse geocodes coordinates (lat, lng) to a formatted address string.
 */
export async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<string> {
  // Primary: OpenStreetMap Nominatim with addressdetails
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'Accept-Language': 'en,bn'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const formatted = parseNominatimAddress(data);
      if (formatted) return formatted;
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error:', err);
  }

  // Fallback: BigDataCloud client reverse geocoding API
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res2 = await fetch(bdcUrl);
    if (res2.ok) {
      const data2 = await res2.json();
      const parts: string[] = [];
      if (data2.locality) parts.push(data2.locality);
      if (data2.city && data2.city !== data2.locality) parts.push(data2.city);
      if (data2.principalSubdivision) parts.push(data2.principalSubdivision);
      if (data2.postcode) parts.push(data2.postcode);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (err2) {
    console.warn('BigDataCloud reverse geocode error:', err2);
  }

  throw new Error('Reverse geocoding could not find an address for coordinates');
}

/**
 * Checks current browser permission state for geolocation if supported.
 * Returns 'granted' | 'prompt' | 'denied' | 'unsupported'.
 */
export async function checkGeolocationPermission(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return 'prompt'; // Fall back to prompt behavior on unsupported browsers
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Requests device GPS coordinates directly from user gesture.
 * Standardized options: { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 */
export function getDeviceCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject({ code: -1, message: 'Geolocation is not supported by this browser.' });
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Full user-gesture workflow to obtain location and return readable address
 */
export async function requestLocationAddress(): Promise<GeolocationResult> {
  // 1. Secure context check
  if (typeof window !== 'undefined' && window.isSecureContext === false && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return {
      success: false,
      errorType: 'insecure_context',
      errorMessage: 'Location requires a secure connection (HTTPS). Please type your delivery address manually.'
    };
  }

  // 2. Browser support check
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      success: false,
      errorType: 'unsupported',
      errorMessage: 'Your browser does not support GPS location. Please type your delivery address manually.'
    };
  }

  // 3. Permission state check
  const permState = await checkGeolocationPermission();
  if (permState === 'denied') {
    return {
      success: false,
      errorType: 'permission_denied',
      errorMessage: 'Location permission is blocked in your browser settings. Please type your address manually or enable location in site settings.'
    };
  }

  // 4. Execute getCurrentPosition directly from user gesture
  try {
    const { latitude, longitude } = await getDeviceCoordinates();
    
    // 5. Convert coordinates to readable delivery address
    try {
      const address = await reverseGeocodeCoordinates(latitude, longitude);
      return {
        success: true,
        address,
        latitude,
        longitude
      };
    } catch (geoErr) {
      console.warn('Geocoding error:', geoErr);
      return {
        success: false,
        latitude,
        longitude,
        errorType: 'geocoding_failed',
        errorMessage: 'GPS coordinates were detected, but address lookup was unavailable. Please type your delivery address manually.'
      };
    }
  } catch (err: any) {
    // Standard GeolocationPositionError codes:
    // 1: PERMISSION_DENIED
    // 2: POSITION_UNAVAILABLE
    // 3: TIMEOUT
    if (err && typeof err.code === 'number') {
      if (err.code === 1) {
        return {
          success: false,
          errorType: 'permission_denied',
          errorMessage: 'Location permission was not granted. Please enter your delivery address manually.'
        };
      }
      if (err.code === 2) {
        return {
          success: false,
          errorType: 'position_unavailable',
          errorMessage: 'Device location is currently unavailable. Please try again or type your address manually.'
        };
      }
      if (err.code === 3) {
        return {
          success: false,
          errorType: 'timeout',
          errorMessage: 'Location request timed out. Please try again or type your address manually.'
        };
      }
    }

    return {
      success: false,
      errorType: 'unknown',
      errorMessage: 'Could not obtain location. Please enter your delivery address manually.'
    };
  }
}
