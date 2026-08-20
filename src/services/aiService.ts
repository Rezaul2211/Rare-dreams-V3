/**
 * AI Service for Rare Dreams - Grok AI & Groq Engine
 * Powers Customer Support Chatbot, Product Description Generator, and Auto-Fill
 * Includes Serverless API Proxy & Direct Client Fallback with Dynamic Model Discovery
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AiChatResponse {
  reply: string;
  provider?: 'grok' | 'gemini' | 'fallback';
  error?: string;
}

export interface SendMessageOptions {
  message: string;
  minThinkingMs?: number;
  history?: Array<{ role: 'user' | 'model' | 'assistant'; parts?: Array<{ text: string }>; content?: string }>;
}

export interface ProductAiParams {
  name?: string;
  category?: string;
  subcategory?: string;
  price?: number | string;
  material?: string;
  hints?: string;
  categories?: string[];
  image?: string;
}

export interface AutoFillResult {
  name: string;
  category: string;
  subcategory: string;
  description: string;
  material: string;
  price: number;
  comparePrice: number;
  discount: number;
  stockQuantity: number;
  sizeOptions: string[];
  colorOptions: string[];
  tags: string[];
  isFlashSale: boolean;
  fallback?: boolean;
}

let cachedGrokKey: string | null = null;

export async function getStoredGrokKey(): Promise<string | null> {
  if (cachedGrokKey) return cachedGrokKey;

  // 1. Try localStorage
  if (typeof window !== 'undefined') {
    try {
      const lsKey = localStorage.getItem('grok_api_key');
      if (lsKey && lsKey.trim().length > 10) {
        cachedGrokKey = lsKey.trim();
        return cachedGrokKey;
      }
      const rawIntegrations = localStorage.getItem('system_integrations');
      if (rawIntegrations) {
        const parsed = JSON.parse(rawIntegrations);
        const k = (parsed.grokApiKey || parsed.xaiApiKey || parsed.groqApiKey || '').trim();
        if (k) {
          cachedGrokKey = k;
          return k;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Try Firestore system_settings/integrations
  try {
    const docRef = doc(db, 'system_settings', 'integrations');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const key = (data.grokApiKey || data.xaiApiKey || data.groqApiKey || '').trim();
      if (key) {
        cachedGrokKey = key;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('grok_api_key', key);
          } catch {}
        }
        return key;
      }
    }
  } catch (e) {
    console.warn("Could not retrieve Grok key from Firestore:", e);
  }

  return null;
}

export function setCachedGrokKey(key: string) {
  cachedGrokKey = key.trim();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('grok_api_key', key.trim());
    } catch {}
  }
}

/**
 * Direct call to Grok (xAI or Groq) with dynamic active model discovery and automatic fallback
 */
export async function callDirectGrok(
  key: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }>,
  options: { temperature?: number; max_tokens?: number; isVision?: boolean } = {}
): Promise<{ content: string; model: string; latencyMs: number }> {
  const trimmedKey = key.trim();
  const isGroq = trimmedKey.startsWith('gsk_');
  const endpoint = isGroq 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://api.x.ai/v1/chat/completions';
  const modelsEndpoint = isGroq
    ? 'https://api.groq.com/openai/v1/models'
    : 'https://api.x.ai/v1/models';

  // 1. Dynamic active models discovery
  let candidateModels: string[] = [];
  try {
    const modelsRes = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${trimmedKey}` }
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      if (Array.isArray(modelsData?.data)) {
        const fetchedIds: string[] = modelsData.data
          .map((m: any) => m.id)
          .filter((id: string) => typeof id === 'string' && !id.includes('whisper') && !id.includes('tts') && !id.includes('guard') && !id.includes('audio'));
        
        if (fetchedIds.length > 0) {
          const prioritized = isGroq
            ? [
                'llama-3.2-11b-vision-preview',
                'llama-3.2-90b-vision-preview',
                'openai/gpt-oss-120b',
                'openai/gpt-oss-20b',
                'qwen/qwen3.6-27b',
                'groq/compound',
                'groq/compound-mini',
                'moonshotai/kimi-k2-instruct-0905',
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant'
              ]
            : [
                'grok-2-vision-1212',
                'grok-2-vision-latest',
                'grok-vision-beta',
                'grok-2-latest',
                'grok-2',
                'grok-beta'
              ];
          
          candidateModels = [
            ...prioritized.filter(p => fetchedIds.includes(p)),
            ...fetchedIds.filter(f => !prioritized.includes(f))
          ];
        }
      }
    }
  } catch {
    // Dynamic fetch failed, proceed to fallback list
  }

  if (candidateModels.length === 0) {
    candidateModels = isGroq
      ? [
          'llama-3.2-11b-vision-preview',
          'llama-3.2-90b-vision-preview',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'qwen/qwen3.6-27b',
          'groq/compound',
          'groq/compound-mini',
          'moonshotai/kimi-k2-instruct-0905',
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant'
        ]
      : [
          'grok-2-vision-1212',
          'grok-2-vision-latest',
          'grok-vision-beta',
          'grok-2-latest',
          'grok-2',
          'grok-beta'
        ];
  }

  if (options.isVision) {
    const visionModels = candidateModels.filter(m => m.includes('vision') || m.includes('scout') || m.includes('120b') || m.includes('grok-2'));
    if (visionModels.length > 0) {
      candidateModels = [...visionModels, ...candidateModels.filter(m => !visionModels.includes(m))];
    }
  }

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${trimmedKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 1024
        })
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        return {
          content,
          model: data.model || model,
          latencyMs
        };
      }

      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }

      const isModelIssue = response.status === 404 ||
        errorDetail.includes('model_decommissioned') ||
        errorDetail.includes('model_not_found') ||
        errorDetail.includes('decommissioned') ||
        errorDetail.includes('does not exist') ||
        errorDetail.includes('not supported') ||
        errorDetail.includes('deprecat');

      if (isModelIssue) {
        continue;
      }

      lastError = new Error(`Grok API error (${response.status}): ${errorDetail}`);
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error("All candidate Grok models failed.");
}

/**
 * 1. Customer Support Chatbot Message Sender
 */
export async function sendAiMessage({
  message,
  minThinkingMs = 100,
  history = []
}: SendMessageOptions): Promise<AiChatResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      reply: "Please enter your message or question.",
      provider: 'fallback'
    };
  }

  const apiPromise = (async (): Promise<AiChatResponse> => {
    // 1. Try Backend /api/ai-chat route
    try {
      const grokKey = await getStoredGrokKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (grokKey) {
        headers['Authorization'] = `Bearer ${grokKey}`;
        headers['x-grok-api-key'] = grokKey;
      }

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: trimmed, history })
      });

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data && typeof data.reply === 'string' && !data.fallback) {
          return {
            reply: data.reply,
            provider: 'grok'
          };
        }
      }
    } catch (err: any) {
      console.warn("Backend /api/ai-chat request failed, trying client fallback:", err);
    }

    // 2. Direct Grok API Call via Client if backend didn't handle it
    try {
      const grokKey = await getStoredGrokKey();
      if (grokKey) {
        const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh.
Key Brand Rules & Details:
- Brand Name: Rare Dreams (রেয়ার ড্রিমস)
- Delivery in Dhaka: ৳80 (1-2 business days)
- Delivery Outside Dhaka / Nationwide: ৳120 (2-4 business days)
- Free Shipping on orders above ৳2000 nationwide!
- Payment Methods: Cash on Delivery (COD) with open-box parcel checking, bKash, Nagad, Visa, Mastercard
- Exchange Policy: 7-day hassle-free size & design exchange
- Customer Support: Daily 10 AM - 10 PM
- Personality: Warm, polite, professional, and knowledgeable. Answer in friendly Bangla (or English if the user asks in English). Keep responses concise, clear, and stylish.`;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt }
        ];

        if (Array.isArray(history)) {
          for (const h of history) {
            const role = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
            const content = typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '');
            if (content) {
              messages.push({ role, content });
            }
          }
        }

        messages.push({ role: 'user', content: trimmed });

        const directRes = await callDirectGrok(grokKey, messages, { temperature: 0.7, max_tokens: 800 });
        if (directRes.content) {
          return {
            reply: directRes.content,
            provider: 'grok'
          };
        }
      }
    } catch (directErr: any) {
      console.warn("Direct Grok call failed:", directErr);
    }

    // 3. Smart Local Fallback Response (if no API key or offline)
    const lower = trimmed.toLowerCase();
    let smartReply = "আসসালামু আলাইকুম! রেয়ার ড্রিমস (Rare Dreams)-এ আপনাকে স্বাগতম। আমাদের প্রিমিয়াম কালেকশন, সাইজ গাইড, ক্যাশ অন ডেলিভারি বা এক্সচেঞ্জ পলিসি সম্পর্কে কীভাবে সাহায্য করতে পারি?";
    if (lower.includes('delivery') || lower.includes('ডেলিভারি') || lower.includes('charge') || lower.includes('চার্জ') || lower.includes('ভাড়া') || lower.includes('শিপিং')) {
      smartReply = "আমাদের ডেলিভারি পলিসি ও চার্জ:\n\n🚚 ঢাকা সিটির ভিতরে: মাত্র ৳৮০ (১-২ দিনের মধ্যে ফাস্ট হোম ডেলিভারি)\n🚛 ঢাকার বাইরে / সারাদেশে: মাত্র ৳১২০ (২-৪ দিনের মধ্যে ডেলিভারি)\n🎁 ২০০০ টাকার বেশি অর্ডারে সারা বাংলাদেশে সম্পূর্ণ ডেলিভারি ফ্রী!\n💵 সারাদেশে ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে—পার্সেল দেখে নেওয়ার সুযোগ আছে!";
    } else if (lower.includes('cash') || lower.includes('cod') || lower.includes('ক্যাশ') || lower.includes('পেমেন্ট') || lower.includes('payment') || lower.includes('bkash') || lower.includes('বিকাশ')) {
      smartReply = "হ্যাঁ, আমরা সারা বাংলাদেশে ১০০% ক্যাশ অন ডেলিভারি (Cash on Delivery) প্রদান করি। এছাড়া বিকাশ, নগদ ও ডেবিট/ক্রেডিট কার্ডের মাধ্যমে নিরাপদে অগ্রিম পেমেন্ট করার সুবিধাও রয়েছে।";
    } else if (lower.includes('size') || lower.includes('সাইজ') || lower.includes('মাপ')) {
      smartReply = "আমাদের প্রতিটি প্রডাক্ট পেজে সঠিক সাইজ চার্ট দেওয়া রয়েছে। আপনার বাচ্চার বয়স ও উচ্চতা জানালে আমাদের টিম সঠিক সাইজ নির্বাচনে সাহায্য করতে পারবে। সাইজে কোনো সমস্যা হলে ৭ দিনের মধ্যে সহজে এক্সচেঞ্জ করতে পারবেন!";
    } else if (lower.includes('return') || lower.includes('exchange') || lower.includes('ফেরত') || lower.includes('বদল')) {
      smartReply = "আমাদের রয়েছে ৭ দিনের সহজ এক্সচেঞ্জ পলিসি (7-Day Easy Exchange Policy)। সাইজ বা কালার পছন্দ না হলে অরিজিনাল ট্যাগ সহ সহজে পরিবর্তন করে নিতে পারবেন।";
    }

    return {
      reply: smartReply,
      provider: 'fallback'
    };
  })();

  const delayPromise = new Promise(resolve => setTimeout(resolve, minThinkingMs));
  const [result] = await Promise.all([apiPromise, delayPromise]);
  return result;
}

/**
 * 2. Product Description Generator for Admin Product Upload
 */
export async function generateAiProductDescription(params: ProductAiParams): Promise<string> {
  const { name, category, subcategory, price, material } = params;

  // 1. Try backend endpoint
  try {
    const res = await fetch("/api/ai-generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, subcategory, price, material })
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data?.description && !data.fallback) {
        return data.description;
      }
    }
  } catch (e) {
    console.warn("Backend generate-description error, trying direct Grok:", e);
  }

  // 2. Direct Grok Call via stored key
  try {
    const grokKey = await getStoredGrokKey();
    if (grokKey) {
      const prompt = `Write a compelling, luxury, SEO-optimized English product description for an e-commerce fashion item:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, modern, engaging English.
- Highlights premium quality, tailored fit, comfort, and versatile styling.
- Includes 3-4 bullet points for key features (e.g., ✨ Key Highlights: 100% Premium Quality Fabric, Precision Tailored Stitching, Elegant Silhouette, Ideal for Parties & Special Occasions).
- Includes a brief Care Instructions note (🧺 Care Instructions: Gentle hand wash or dry clean recommended).
- Keep it under 250 words. Do NOT include markdown code blocks around text.`;

      const directRes = await callDirectGrok(grokKey, [
        { role: 'system', content: 'You are a luxury fashion catalog copywriter for Rare Dreams.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.7, max_tokens: 600 });

      if (directRes.content) {
        return directRes.content.trim();
      }
    }
  } catch (directErr: any) {
    console.warn("Direct Grok description generation failed:", directErr);
  }

  // 3. Fallback description
  return `Elevate your wardrobe with the exquisite ${name || 'Designer Collection'} by Rare Dreams. Expertly crafted from ${material || 'ultra-fine premium fabric'}, this outfit blends timeless elegance with all-day comfort.\n\n✨ Key Highlights:\n- Premium grade breathable & durable fabric\n- Tailored precision finish with regal aesthetic\n- Perfect for weddings, festive occasions, and exclusive gatherings\n- Easy care & long-lasting vibrant color retention\n\n🧺 Care Instructions: Gentle machine wash or dry clean recommended.`;
}

/**
 * Compress / downscale image if necessary to prevent large payload errors on Vercel
 */
async function ensureOptimalImageBase64(imageStr: string): Promise<string> {
  if (!imageStr || !imageStr.startsWith('data:image')) return imageStr;
  if (imageStr.length < 500000) return imageStr; // under ~350KB is already good

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(imageStr);
        }
      };
      img.onerror = () => resolve(imageStr);
      img.src = imageStr;
    } catch {
      resolve(imageStr);
    }
  });
}

/**
 * 3. AI Product Auto-Fill Metadata for Admin Product Upload
 */
export async function generateAiProductAutoFill(params: ProductAiParams): Promise<AutoFillResult> {
  const { image, categories: clientCategories, hints } = params;
  const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
    ? clientCategories
    : ["Men", "Women", "Kids", "Accessories", "Panjabi", "Sharee", "Abaya", "Kurtis", "T-Shirts", "Shirts", "Pants", "Foot wear", "Watches"];

  const grokKey = await getStoredGrokKey();
  const optimizedImage = image ? await ensureOptimalImageBase64(image) : undefined;

  // 1. Try backend endpoint (/api/ai-product-auto-fill)
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (grokKey) {
      headers["Authorization"] = `Bearer ${grokKey}`;
      headers["x-grok-api-key"] = grokKey;
    }

    const res = await fetch("/api/ai-product-auto-fill", {
      method: "POST",
      headers,
      body: JSON.stringify({ image: optimizedImage, categories: availableCategories, hints })
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.name) {
        return data as AutoFillResult;
      }
    }
  } catch (e) {
    console.warn("Backend auto-fill error, trying direct Grok:", e);
  }

  // 2. Direct Grok Call via stored key (with vision support)
  try {
    if (grokKey) {
      const promptText = `You are an expert e-commerce catalog auditor and product manager for "Rare Dreams" store.
Carefully analyze the provided product image and any extra hints.

CRITICAL PRODUCT IDENTIFICATION RULES:
1. Examine the visual details with 100% precision:
   - If the product is an ELECTRONIC / GADGET / ACCESSORY (such as a Samsung / Apple / Anker Charger, 25W/45W Adapter, USB-C Cable, Powerbank, Earbuds, Watch, Sunglasses, Belt, Bag):
     * Accurately identify the exact brand (e.g., Samsung, Apple, Anker), model name, wattage, ports (Type-C / USB), and color.
     * DO NOT label or describe it as clothing or fabric!
     * Set category to the closest matching store category: e.g. "Accessories" or "Watches".
     * Set material to the actual build material (e.g., "Fire-Retardant Polycarbonate & Pure Copper Cable").
     * Set sizeOptions to appropriate sizing (e.g., ["Standard"] or ["1 Meter", "2 Meter"] or ["One Size"]).
   - If the product is APPAREL / CLOTHING (Panjabi, Sharee, Dress, Kids Romper, T-Shirt, Shirt, Pants, Abaya):
     * Accurately identify the garment type, fabric texture, embroidery, patterns, styling, and occasion.
     * Set category to matching category from available list (${availableCategories.join(', ')}).
     * Set realistic clothing sizes (e.g. ["2-3Y", "4-5Y", "6-7Y"] for kids or ["M", "L", "XL", "XXL"] for adults).
   - If the product is FOOTWEAR:
     * Identify footwear type (Loafers, Sneakers, Sandals), genuine upper/sole materials, and shoe sizes (["39", "40", "41", "42", "43"]).

2. Generate an attractive, professional, high-converting English product title.
3. Generate a rich, formatted English description with bullet points and care/warranty notes.
4. Provide realistic BDT (৳) pricing, compare price, discount %, stock quantity, and search tags.

Available Store Categories: ${availableCategories.join(', ')}
${hints ? `Context / Hint: "${hints}"` : ''}

Output STRICT JSON only without markdown formatting:
{
  "name": "Accurate product title in English",
  "category": "Must be EXACTLY ONE from available categories: ${availableCategories.join(', ')}",
  "subcategory": "Specific subcategory in English",
  "description": "Rich formatted product description in English",
  "material": "Estimated build material or fabric in English",
  "price": 1250,
  "comparePrice": 1650,
  "discount": 24,
  "stockQuantity": 25,
  "sizeOptions": ["Standard"],
  "colorOptions": ["Black", "White"],
  "tags": ["Brand", "Type", "Rare Dreams", "New Arrival"],
  "isFlashSale": false
}`;

      const userContent: any = optimizedImage
        ? [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: optimizedImage } }
          ]
        : promptText;

      const directRes = await callDirectGrok(grokKey, [
        { role: 'system', content: 'You are a product catalog parser. Output strict JSON only without explanation or markdown quotes.' },
        { role: 'user', content: userContent }
      ], { temperature: 0.2, max_tokens: 800, isVision: Boolean(optimizedImage) });

      if (directRes.content) {
        const cleanText = directRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        if (parsed && parsed.name) {
          return {
            name: parsed.name,
            category: parsed.category || availableCategories[0] || 'Kids',
            subcategory: parsed.subcategory || '',
            description: parsed.description || '',
            material: parsed.material || 'Premium Grade Material',
            price: Number(parsed.price) || 1250,
            comparePrice: Number(parsed.comparePrice) || 1650,
            discount: Number(parsed.discount) || 24,
            stockQuantity: Number(parsed.stockQuantity) || 25,
            sizeOptions: Array.isArray(parsed.sizeOptions) ? parsed.sizeOptions : ["Standard"],
            colorOptions: Array.isArray(parsed.colorOptions) ? parsed.colorOptions : ["Black", "White"],
            tags: Array.isArray(parsed.tags) ? parsed.tags : ["Exclusive", "Rare Dreams", "New Arrival"],
            isFlashSale: !!parsed.isFlashSale
          };
        }
      }
    }
  } catch (directErr: any) {
    console.warn("Direct Grok auto-fill failed:", directErr);
  }

  // 3. High quality context-aware fallback data
  const hintLower = (hints || '').toLowerCase();
  const isChargerOrElectronic = hintLower.includes('charger') || hintLower.includes('adapter') || hintLower.includes('samsung') || hintLower.includes('cable') || hintLower.includes('fast') || hintLower.includes('type-c');
  const isFootwear = hintLower.includes('shoe') || hintLower.includes('loafer') || hintLower.includes('sandal') || hintLower.includes('sneaker');

  if (isChargerOrElectronic) {
    const cat = availableCategories.find(c => c.toLowerCase().includes('access')) || availableCategories[0] || "Accessories";
    return {
      name: hints ? `${hints} Super Fast Charger` : "Samsung 25W Super Fast Type-C Wall Charger & Cable",
      category: cat,
      subcategory: "Fast Chargers & Cables",
      description: "Experience ultra-rapid power delivery with the 25W Super Fast Power Adapter and Type-C to Type-C cable. Engineered with intelligent power management to safely charge all smartphones, tablets, and compatible USB-C gadgets at peak efficiency.\n\n✨ Key Highlights:\n- 25W Super Fast Charging with USB-PD 3.0 support\n- Includes heavy-duty Type-C to Type-C charging cable\n- Multi-protect safety system against over-voltage and overheating\n- Compact travel-ready design with durable construction\n\n🛡️ Warranty: 6 Months Official Brand Replacement Warranty.",
      material: "Fire-Retardant Polycarbonate (PC) & Pure Copper Core",
      price: 1250,
      comparePrice: 1650,
      discount: 24,
      stockQuantity: 35,
      sizeOptions: ["Standard"],
      colorOptions: ["Black", "White"],
      tags: ["Fast Charger", "Type-C", "Samsung", "25W", "Accessories", "Rare Dreams"],
      isFlashSale: false,
      fallback: true
    };
  }

  if (isFootwear) {
    const cat = availableCategories.find(c => c.toLowerCase().includes('foot')) || availableCategories.find(c => c.toLowerCase().includes('men')) || "Men";
    return {
      name: hints ? `Premium ${hints}` : "Handcrafted Genuine Leather Loafers",
      category: cat,
      subcategory: "Leather Footwear",
      description: "Elevate your style with these meticulously handcrafted leather loafers. Featuring cushioned orthopedic insoles and flexible non-slip soles for effortless luxury.\n\n✨ Key Highlights:\n- Full-grain genuine leather upper\n- Soft padded memory foam insole\n- Anti-skid rubber outsole with reinforced stitching\n- Versatile styling for formal and festive occasions\n\n🧺 Care: Polish with neutral leather cream.",
      material: "100% Genuine Full-Grain Leather",
      price: 2450,
      comparePrice: 3200,
      discount: 23,
      stockQuantity: 20,
      sizeOptions: ["39", "40", "41", "42", "43", "44"],
      colorOptions: ["Classic Brown", "Midnight Black"],
      tags: ["Footwear", "Leather", "Loafers", "Rare Dreams"],
      isFlashSale: false,
      fallback: true
    };
  }

  const defaultCat = availableCategories.find(c => c.toLowerCase().includes('kid')) || availableCategories[0] || "Kids";
  return {
    name: hints ? `Luxury ${hints}` : "Exclusive Royal Designer Collection",
    category: defaultCat,
    subcategory: hints || "Festive Exclusive",
    description: "Designed for effortless elegance, this premium piece by Rare Dreams features meticulous tailoring and luxurious breathable fabric. Designed to provide unmatched comfort and sophisticated styling for all special occasions.\n\n✨ Key Highlights:\n- Premium quality long-lasting fabric\n- Elegant silhouette with flawless craftsmanship\n- Versatile styling for celebrations and everyday luxury\n- Soft on skin with breathable comfort\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.",
    material: "100% Premium Cotton Blend",
    price: 1450,
    comparePrice: 1850,
    discount: 20,
    stockQuantity: 25,
    sizeOptions: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
    colorOptions: ["Navy Blue", "Black", "Gold"],
    tags: ["Exclusive", "New Arrival", "Rare Dreams", "Premium Quality"],
    isFlashSale: false,
    fallback: true
  };
}

/**
 * 4. AI Tag & Subcategory generator
 */
export async function generateAiProductTags(params: { name?: string; category?: string }): Promise<{ subcategory: string; tags: string[] }> {
  const { name, category } = params;

  // 1. Try backend endpoint
  try {
    const res = await fetch("/api/ai-tag-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category })
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.subcategory) {
        return {
          subcategory: data.subcategory,
          tags: Array.isArray(data.tags) ? data.tags : []
        };
      }
    }
  } catch (e) {
    console.warn("Backend tag generation error, trying direct Grok:", e);
  }

  // 2. Direct Grok call
  try {
    const grokKey = await getStoredGrokKey();
    if (grokKey) {
      const prompt = `Analyze this apparel product for e-commerce tagging in English:
Title: ${name || 'Luxury Outfit'}
Category: ${category || 'Clothing'}

Suggest:
1. Best subcategory name in English (e.g., Party Gown, Panjabi Set, Leather Loafers, Casual Shirt, Baby Romper)
2. 3-5 tags/keywords as comma-separated values (e.g. Party Wear, Cotton, Festival, Premium, Summer Collection)

Return JSON strictly: {"subcategory": "SUBCATEGORY_NAME", "tags": ["TAG1", "TAG2", "TAG3"]}`;

      const directRes = await callDirectGrok(grokKey, [
        { role: 'system', content: 'Output strict JSON only.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.2, max_tokens: 300 });

      if (directRes.content) {
        const cleanText = directRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        if (parsed && parsed.subcategory) {
          return {
            subcategory: parsed.subcategory,
            tags: Array.isArray(parsed.tags) ? parsed.tags : []
          };
        }
      }
    }
  } catch (directErr) {
    console.warn("Direct Grok tag generation failed:", directErr);
  }

  return {
    subcategory: category ? `${category} Collection` : "Designer Collection",
    tags: ["Exclusive", "Rare Dreams", "Premium Quality"]
  };
}
