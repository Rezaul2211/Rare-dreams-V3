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
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { temperature?: number; max_tokens?: number } = {}
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
          .filter((id: string) => typeof id === 'string' && !id.includes('whisper') && !id.includes('tts') && !id.includes('guard'));
        
        if (fetchedIds.length > 0) {
          const prioritized = isGroq
            ? [
                'openai/gpt-oss-120b',
                'openai/gpt-oss-20b',
                'qwen/qwen3.6-27b',
                'groq/compound',
                'groq/compound-mini',
                'moonshotai/kimi-k2-instruct-0905',
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant'
              ]
            : ['grok-2-latest', 'grok-2', 'grok-beta'];
          
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
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'qwen/qwen3.6-27b',
          'groq/compound',
          'groq/compound-mini',
          'moonshotai/kimi-k2-instruct-0905',
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant'
        ]
      : ['grok-2-latest', 'grok-2', 'grok-beta'];
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

      let errText = '';
      try {
        const errJson = await response.json();
        errText = JSON.stringify(errJson);
      } catch {
        errText = await response.text();
      }

      const isModelIssue = response.status === 404 ||
        errText.includes('model_decommissioned') ||
        errText.includes('model_not_found') ||
        errText.includes('decommissioned') ||
        errText.includes('does not exist') ||
        errText.includes('not supported') ||
        errText.includes('deprecat');

      if (isModelIssue) {
        continue;
      }

      throw new Error(`Direct Grok error (${response.status}): ${errText}`);
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('invalid_api_key')) {
        throw e;
      }
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to communicate with Grok / Groq API.");
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
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
- Delivery in Dhaka: ৳70 (24-48 Hours)
- Delivery Outside Dhaka: ৳130 (2-4 Days)
- Payment Methods: Cash on Delivery (COD), bKash, Nagad, Visa, Mastercard
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
    if (lower.includes('delivery') || lower.includes('ডেলিভারি') || lower.includes('charge') || lower.includes('ভাড়া')) {
      smartReply = "আমাদের ডেলিভারি চার্জ: ঢাকা সিটির ভিতরে মাত্র ৭০ টাকা (২৪-৪৮ ঘণ্টার মধ্যে হোম ডেলিভারি), এবং ঢাকার বাইরে ১৩০ টাকা (২-৪ দিনের মধ্যে)। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে!";
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
 * 3. AI Product Auto-Fill Metadata for Admin Product Upload
 */
export async function generateAiProductAutoFill(params: ProductAiParams): Promise<AutoFillResult> {
  const { image, categories: clientCategories, hints } = params;
  const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
    ? clientCategories
    : ["Men", "Women", "Kids", "Accessories", "Panjabi", "Sharee", "Abaya", "Kurtis", "T-Shirts", "Shirts", "Pants", "Foot wear", "Watches"];

  // 1. Try backend endpoint
  try {
    const res = await fetch("/api/ai-product-auto-fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, categories: availableCategories, hints })
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.name && !data.fallback) {
        return data as AutoFillResult;
      }
    }
  } catch (e) {
    console.warn("Backend auto-fill error, trying direct Grok:", e);
  }

  // 2. Direct Grok Call via stored key
  try {
    const grokKey = await getStoredGrokKey();
    if (grokKey) {
      const prompt = `You are an expert e-commerce fashion catalog manager for the luxury lifestyle brand "Rare Dreams".
Product Hint/Name: ${hints || 'Premium Royal Designer Collection'}
Available Store Categories: ${availableCategories.join(', ')}

Generate complete, high-converting product metadata in English in strict JSON format.

Required JSON Structure:
{
  "name": "Luxury, appealing product title in English e.g. 'Royal Silk Embroidered Panjabi Set - Navy Blue' or 'Designer Festive Party Gown'",
  "category": "Must be ONE from available categories: ${availableCategories.join(', ')}",
  "subcategory": "Specific subcategory in English e.g. Panjabi Set, Party Gown, Baby Romper, Leather Loafers, Formal Shirt, Jeans, Kurti",
  "description": "Rich, formatted product description in English. Include a 2-sentence luxury intro, bullet points for key features (✨ Key Highlights: Premium Quality, Tailored Finish, Comfortable Fit, Ideal Occasions), and fabric care.",
  "material": "Estimated fabric/material in English e.g. '100% Premium Combed Cotton', 'Pure Raw Silk & Georgette', 'Genuine Full-Grain Leather'",
  "price": 1450,
  "comparePrice": 1850,
  "discount": 20,
  "stockQuantity": 25,
  "sizeOptions": ["38", "40", "42", "44"],
  "colorOptions": ["Navy Blue", "Gold"],
  "tags": ["Panjabi", "Festive", "Silk", "Rare Dreams", "New Arrival"],
  "isFlashSale": false
}`;

      const directRes = await callDirectGrok(grokKey, [
        { role: 'system', content: 'You are a product catalog parser. Output strict JSON only without explanation or markdown quotes.' },
        { role: 'user', content: prompt }
      ], { temperature: 0.3, max_tokens: 800 });

      if (directRes.content) {
        const cleanText = directRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        if (parsed && parsed.name) {
          return {
            name: parsed.name,
            category: parsed.category || availableCategories[0] || 'Men',
            subcategory: parsed.subcategory || '',
            description: parsed.description || '',
            material: parsed.material || '100% Premium Cotton Blend',
            price: Number(parsed.price) || 1450,
            comparePrice: Number(parsed.comparePrice) || 1850,
            discount: Number(parsed.discount) || 20,
            stockQuantity: Number(parsed.stockQuantity) || 25,
            sizeOptions: Array.isArray(parsed.sizeOptions) ? parsed.sizeOptions : ["M", "L", "XL"],
            colorOptions: Array.isArray(parsed.colorOptions) ? parsed.colorOptions : ["Navy Blue", "Black"],
            tags: Array.isArray(parsed.tags) ? parsed.tags : ["Exclusive", "Rare Dreams"],
            isFlashSale: !!parsed.isFlashSale
          };
        }
      }
    }
  } catch (directErr: any) {
    console.warn("Direct Grok auto-fill failed:", directErr);
  }

  // 3. High quality fallback data
  const defaultCat = availableCategories[0] || "Men";
  return {
    name: hints ? `Luxury ${hints}` : "Exclusive Royal Designer Collection",
    category: defaultCat,
    subcategory: hints || "Premium Collection",
    description: "Designed for effortless elegance, this premium piece by Rare Dreams features meticulous tailoring and luxurious breathable fabric. Designed to provide unmatched comfort and sophisticated styling for all special occasions.\n\n✨ Key Highlights:\n- Premium quality long-lasting fabric\n- Elegant silhouette with flawless craftsmanship\n- Versatile styling for celebrations and everyday luxury\n- Soft on skin with breathable comfort\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.",
    material: "100% Premium Cotton Blend",
    price: 1450,
    comparePrice: 1850,
    discount: 20,
    stockQuantity: 25,
    sizeOptions: ["M", "L", "XL", "XXL"],
    colorOptions: ["Navy Blue", "Black", "White"],
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
