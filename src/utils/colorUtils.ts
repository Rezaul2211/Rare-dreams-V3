// Utility for converting Color names (in English, Bengali, or Hex) to CSS color values & swatches

export interface ColorSwatchInfo {
  hex: string;
  name: string;
  isLight: boolean;
  borderNeeded: boolean;
}

const COLOR_MAP: Record<string, { hex: string; isLight?: boolean }> = {
  // Common Colors
  maroon: { hex: '#800000' },
  'navy blue': { hex: '#001F3F' },
  navy: { hex: '#001F3F' },
  'royal blue': { hex: '#4169E1' },
  'sky blue': { hex: '#38BDF8', isLight: true },
  blue: { hex: '#2563EB' },
  black: { hex: '#18181B' },
  'jet black': { hex: '#09090B' },
  white: { hex: '#FFFFFF', isLight: true },
  'off white': { hex: '#FAFAFA', isLight: true },
  red: { hex: '#DC2626' },
  green: { hex: '#16A34A' },
  'olive green': { hex: '#556B2F' },
  olive: { hex: '#808000' },
  yellow: { hex: '#EAB308', isLight: true },
  mustard: { hex: '#CA8A04' },
  orange: { hex: '#EA580C' },
  purple: { hex: '#9333EA' },
  violet: { hex: '#7C3AED' },
  pink: { hex: '#EC4899', isLight: true },
  'baby pink': { hex: '#FBCFE8', isLight: true },
  rose: { hex: '#E11D48' },
  magenta: { hex: '#D946EF' },
  grey: { hex: '#6B7280' },
  gray: { hex: '#6B7280' },
  ash: { hex: '#9CA3AF', isLight: true },
  charcoal: { hex: '#374151' },
  brown: { hex: '#78350F' },
  chocolate: { hex: '#451A03' },
  beige: { hex: '#E7D7C1', isLight: true },
  cream: { hex: '#FFFDD0', isLight: true },
  gold: { hex: '#D97706' },
  golden: { hex: '#EAB308', isLight: true },
  silver: { hex: '#CBD5E1', isLight: true },
  teal: { hex: '#0D9488' },
  mint: { hex: '#6EE7B7', isLight: true },
  lavender: { hex: '#C084FC', isLight: true },
  peach: { hex: '#FDBA74', isLight: true },
  burgundy: { hex: '#800020' },
  cyan: { hex: '#06B6D4', isLight: true },

  // Bengali Color Names
  'মেরুন': { hex: '#800000' },
  'নেভি ব্লু': { hex: '#001F3F' },
  'নেভি': { hex: '#001F3F' },
  'রয়্যাল ব্লু': { hex: '#4169E1' },
  'রয়েল ব্লু': { hex: '#4169E1' },
  'আকাশি': { hex: '#38BDF8', isLight: true },
  'নীল': { hex: '#2563EB' },
  'কালো': { hex: '#18181B' },
  'সাদা': { hex: '#FFFFFF', isLight: true },
  'অফ হোয়াইট': { hex: '#FAFAFA', isLight: true },
  'লাল': { hex: '#DC2626' },
  'সবুজ': { hex: '#16A34A' },
  'জলপাই': { hex: '#808000' },
  'হলুদ': { hex: '#EAB308', isLight: true },
  'সরিষা': { hex: '#CA8A04' },
  'কমলা': { hex: '#EA580C' },
  'বেগুনী': { hex: '#9333EA' },
  'বেগুনি': { hex: '#9333EA' },
  'গোলাপি': { hex: '#EC4899', isLight: true },
  'গোলাপী': { hex: '#EC4899', isLight: true },
  'ম্যাজেন্টা': { hex: '#D946EF' },
  'ধূসর': { hex: '#6B7280' },
  'ছাই': { hex: '#9CA3AF', isLight: true },
  'বাদামী': { hex: '#78350F' },
  'বাদামি': { hex: '#78350F' },
  'চকলেট': { hex: '#451A03' },
  'বেজ': { hex: '#E7D7C1', isLight: true },
  'ক্রিম': { hex: '#FFFDD0', isLight: true },
  'সোনালী': { hex: '#D97706' },
  'রূপালী': { hex: '#CBD5E1', isLight: true },
  'টিল': { hex: '#0D9488' },
  'মিন্ট': { hex: '#6EE7B7', isLight: true },
  'ল্যাভেন্ডার': { hex: '#C084FC', isLight: true },
  'পিচ': { hex: '#FDBA74', isLight: true },
};

/**
 * Resolves a given color name or hex string to visual swatch metadata.
 */
export function getColorSwatch(colorName: string): ColorSwatchInfo {
  if (!colorName) {
    return { hex: '#5B46E8', name: colorName, isLight: false, borderNeeded: false };
  }

  const clean = colorName.trim();
  
  // If it's already a valid hex code like #FF0000 or #FFF
  if (/^#([0-9A-F]{3}){1,2}$/i.test(clean)) {
    const isLightHex = isHexLight(clean);
    return {
      hex: clean,
      name: colorName,
      isLight: isLightHex,
      borderNeeded: isLightHex,
    };
  }

  const lower = clean.toLowerCase();
  const matched = COLOR_MAP[lower];
  if (matched) {
    return {
      hex: matched.hex,
      name: colorName,
      isLight: !!matched.isLight,
      borderNeeded: !!matched.isLight,
    };
  }

  // Check partial matches
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return {
        hex: val.hex,
        name: colorName,
        isLight: !!val.isLight,
        borderNeeded: !!val.isLight,
      };
    }
  }

  // Fallback hash color generator for unique custom names
  const generatedHex = generateColorFromString(clean);
  return {
    hex: generatedHex,
    name: colorName,
    isLight: false,
    borderNeeded: false,
  };
}

function isHexLight(hexColor: string): boolean {
  let c = hexColor.substring(1);
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
}

function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}
