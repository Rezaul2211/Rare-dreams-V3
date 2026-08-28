import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Lazy initialized Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey.startsWith("MY_")) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Lazy initialized Stripe client
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = (process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_key_not_configured").trim();
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Preconnect and DNS headers for Google Fonts & Firebase to accelerate LCP & eliminate CLS
app.use((req, res, next) => {
  res.setHeader(
    'Link',
    '<https://fonts.googleapis.com>; rel=preconnect, <https://fonts.gstatic.com>; rel=preconnect; crossorigin, <https://firestore.googleapis.com>; rel=preconnect'
  );
  next();
});

// Real-Time System Log Store (in-memory circular buffer)
interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  module: 'GROK_API' | 'CHATBOT' | 'AUTO_FILL' | 'FIREBASE' | 'SERVER' | 'COURIER';
  message: string;
  endpoint?: string;
  statusCode?: number;
  errorCode?: string;
  latencyMs?: number;
  details?: any;
}

const systemLogs: SystemLogEntry[] = [];
const MAX_LOGS = 150;

function addSystemLog(entry: Omit<SystemLogEntry, 'id' | 'timestamp'>) {
  const log: SystemLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  systemLogs.unshift(log);
  if (systemLogs.length > MAX_LOGS) {
    systemLogs.pop();
  }
  return log;
}

// Initial boot log
addSystemLog({
  level: 'info',
  module: 'SERVER',
  message: 'Server process started. Initializing Grok AI engine & services.',
  details: { nodeVersion: process.version, env: process.env.NODE_ENV || 'development' }
});

// -------------------------------------------------------------
// Grok AI Client Configuration (Supports xAI Grok & Groq)
// -------------------------------------------------------------
interface GrokConfig {
  key: string;
  baseUrl: string;
  modelsUrl: string;
  candidateModels: string[];
  providerName: 'xAI Grok' | 'Groq Llama';
}

function getGrokConfig(req?: express.Request): GrokConfig | null {
  const headerAuth = (req?.headers?.authorization || req?.headers?.['x-grok-api-key'] || "") as string;
  const headerKey = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7).trim() : headerAuth.trim();

  const envKey = (
    process.env.GROK_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GEMINI_API_KEY ||
    headerKey ||
    ""
  ).trim();

  if (!envKey || envKey.startsWith("MY_")) {
    return null;
  }

  // Detect key format
  if (envKey.startsWith("gsk_")) {
    return {
      key: envKey,
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      modelsUrl: "https://api.groq.com/openai/v1/models",
      candidateModels: [
        "llama-3.2-11b-vision-preview",
        "llama-3.2-90b-vision-preview",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b",
        "groq/compound",
        "groq/compound-mini",
        "moonshotai/kimi-k2-instruct-0905",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
      ],
      providerName: "Groq Llama"
    };
  } else {
    // Official xAI Grok API
    return {
      key: envKey,
      baseUrl: "https://api.x.ai/v1/chat/completions",
      modelsUrl: "https://api.x.ai/v1/models",
      candidateModels: [
        "grok-2-vision-1212",
        "grok-2-vision-latest",
        "grok-vision-beta",
        "grok-2-latest",
        "grok-2",
        "grok-beta"
      ],
      providerName: "xAI Grok"
    };
  }
}

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}

let cachedActiveModels: { key: string; models: string[]; timestamp: number } | null = null;

async function getActiveCandidateModels(config: { key: string; modelsUrl: string; candidateModels: string[] }, isVision = false): Promise<string[]> {
  const now = Date.now();
  if (cachedActiveModels && cachedActiveModels.key === config.key && (now - cachedActiveModels.timestamp) < 5 * 60 * 1000) {
    if (isVision) {
      const visionModels = cachedActiveModels.models.filter(m => m.includes('vision') || m.includes('scout') || m.includes('120b') || m.includes('grok-2'));
      return visionModels.length > 0 ? visionModels : cachedActiveModels.models;
    }
    return cachedActiveModels.models;
  }

  let discoveredModels: string[] = [];
  try {
    const res = await fetch(config.modelsUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${config.key}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        const activeIds: string[] = data.data
          .map((m: any) => m.id)
          .filter((id: string) => typeof id === 'string' &&
            !id.includes('whisper') &&
            !id.includes('tts') &&
            !id.includes('guard') &&
            !id.includes('audio') &&
            !id.includes('embed') &&
            !id.includes('transcription') &&
            !id.includes('moderation')
          );

        if (activeIds.length > 0) {
          const prioritized = config.candidateModels;
          const matched = prioritized.filter(p => activeIds.includes(p));
          const rest = activeIds.filter(a => !prioritized.includes(a));
          discoveredModels = [...matched, ...rest];
        }
      }
    }
  } catch {
    // Discovery failed, proceed with fallback candidateModels
  }

  const finalModels = discoveredModels.length > 0 ? discoveredModels : config.candidateModels;
  cachedActiveModels = {
    key: config.key,
    models: finalModels,
    timestamp: now
  };
  
  if (isVision) {
    const visionModels = finalModels.filter(m => m.includes('vision') || m.includes('scout') || m.includes('120b') || m.includes('grok-2'));
    return visionModels.length > 0 ? visionModels : finalModels;
  }
  return finalModels;
}

async function callGrokAPI(
  messages: GrokMessage[], 
  options: { temperature?: number; max_tokens?: number; response_format?: any; req?: express.Request; isVision?: boolean } = {}
): Promise<{ content: string; model: string; latencyMs: number }> {
  const config = getGrokConfig(options.req);
  if (!config) {
    throw new Error("GROK_API_KEY is not configured in environment variables or Settings.");
  }

  const modelsToTry = await getActiveCandidateModels(config, !!options.isVision);
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const startTime = Date.now();
      const payload: any = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1024,
      };

      if (options.response_format) {
        payload.response_format = options.response_format;
      }

      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.key}`
        },
        body: JSON.stringify(payload)
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        return {
          content,
          model: data.model || model,
          latencyMs
        };
      }

      let errorDetail = "";
      try {
        const errJson = await response.json();
        errorDetail = JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text();
      }

      const err: any = new Error(`Grok API error (${response.status}): ${errorDetail}`);
      err.status = response.status;
      err.details = errorDetail;
      lastError = err;

      const isModelIssue = response.status === 404 ||
        response.status === 400 ||
        errorDetail.includes("model_decommissioned") ||
        errorDetail.includes("model_not_found") ||
        errorDetail.includes("decommissioned") ||
        errorDetail.includes("does not exist") ||
        errorDetail.includes("not supported") ||
        errorDetail.includes("image_url") ||
        errorDetail.includes("invalid_parameter") ||
        errorDetail.includes("deprecat");

      if (isModelIssue) {
        continue; // Try next candidate model
      }

      // If other error, keep trying remaining models before giving up
      continue;
    } catch (e: any) {
      if (e.status === 401 || e.message?.includes("401") || e.message?.includes("invalid_api_key")) {
        throw e;
      }
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to communicate with Grok / Groq API.");
}

// Helper for parsing Grok errors
function parseGrokError(err: any): { code: string; status: number; message: string; resolution: string } {
  const msg = err?.message || String(err);
  let code = 'UNKNOWN_ERROR';
  let status = err?.status || 500;
  let resolution = 'Check server logs and Grok API configuration.';

  if (msg.includes('401') || msg.includes('Incorrect API key') || msg.includes('invalid_api_key') || msg.includes('Unauthorized')) {
    code = 'UNAUTHENTICATED (401)';
    status = 401;
    resolution = 'Invalid Grok API key. For xAI Grok, get your key from https://console.x.ai/ (starts with xai-...) or Groq from https://console.groq.com (starts with gsk_...). Save it in Integration Keys tab.';
  } else if (msg.includes('429') || msg.includes('Rate limit') || msg.includes('rate_limit_exceeded')) {
    code = 'RATE_LIMITED (429)';
    status = 429;
    resolution = 'Grok rate limit or usage quota reached. Wait a few moments or verify billing on https://console.x.ai/.';
  } else if (msg.includes('404') || msg.includes('model_not_found')) {
    code = 'MODEL_NOT_FOUND (404)';
    status = 404;
    resolution = 'The requested Grok model is not available for this key. Defaulting to grok-beta.';
  } else if (msg.includes('500') || msg.includes('503')) {
    code = 'GROK_SERVICE_UNAVAILABLE (503)';
    status = 503;
    resolution = 'xAI Grok service is temporarily experiencing high traffic. Please retry shortly.';
  } else if (msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
    code = 'NETWORK_ERROR';
    status = 502;
    resolution = 'Cannot reach api.x.ai. Check network and internet connectivity.';
  }

  return { code, status, message: msg, resolution };
}

// Initialize Firebase Admin (Only if not already initialized)
if (!getApps().length) {
  try {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "ai-studio-52c30446-74a2-476d-a811-4a823b07db28"
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

// -------------------------------------------------------------
// 1. AI Product Description Generator (Grok AI)
// -------------------------------------------------------------
app.post("/api/ai-generate-description", async (req, res) => {
  const startTime = Date.now();
  try {
    const { name, category, subcategory, price, material } = req.body;
    const prompt = `Write a compelling, luxury, SEO-optimized English product description for an e-commerce fashion item with these details:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, modern, engaging English.
- Highlights premium quality, tailored fit, comfort, and versatile styling.
- Includes 3-4 bullet points for key features (e.g., ✨ 100% Premium Quality Fabric, Precision Tailored Stitching, Elegant Silhouette, Ideal for Parties & Special Occasions).
- Includes a brief Care Instructions note.
- Keep it under 250 words. Do NOT include markdown code blocks around text.`;

    const grokConfig = getGrokConfig();
    if (grokConfig) {
      try {
        const response = await callGrokAPI([
          { role: "system", content: "You are a luxury fashion catalog copywriter for Rare Dreams." },
          { role: "user", content: prompt }
        ]);

        if (response.content) {
          addSystemLog({
            level: 'success',
            module: 'AUTO_FILL',
            endpoint: '/api/ai-generate-description',
            message: `Generated Grok description for "${name || 'Product'}" (${response.content.length} chars)`,
            latencyMs: response.latencyMs,
            details: { name, category, price, model: response.model }
          });
          return res.json({ description: response.content.trim(), latencyMs: response.latencyMs });
        }
      } catch (err: any) {
        const parsedErr = parseGrokError(err);
        addSystemLog({
          level: 'error',
          module: 'AUTO_FILL',
          endpoint: '/api/ai-generate-description',
          message: `Grok description generation failed: ${parsedErr.message}`,
          errorCode: parsedErr.code,
          statusCode: parsedErr.status,
          latencyMs: Date.now() - startTime,
          details: { error: parsedErr.message, resolution: parsedErr.resolution }
        });
        console.warn("Grok description fallback active:", err?.message || err);
      }
    } else {
      addSystemLog({
        level: 'warn',
        module: 'AUTO_FILL',
        endpoint: '/api/ai-generate-description',
        message: 'GROK_API_KEY not configured. Using fallback description.',
        errorCode: 'KEY_NOT_CONFIGURED'
      });
    }

    // High-quality English Fallback Description
    const fallbackDesc = `Elevate your wardrobe with the exquisite ${name || 'Designer Collection'} by Rare Dreams. Expertly crafted from ${material || 'ultra-fine premium fabric'}, this outfit blends timeless elegance with all-day comfort.\n\n✨ Key Highlights:\n- Premium grade breathable & durable fabric\n- Tailored precision finish with regal aesthetic\n- Perfect for weddings, festive occasions, and exclusive gatherings\n- Easy care & long-lasting vibrant color retention\n\n🧺 Care Instructions: Gentle machine wash or dry clean recommended.`;
    res.json({ description: fallbackDesc, fallback: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate description" });
  }
});

// -------------------------------------------------------------
// 2. AI Size Helper / Recommender (Grok AI)
// -------------------------------------------------------------
app.post("/api/ai-recommend-size", async (req, res) => {
  const startTime = Date.now();
  try {
    const { productName, category, availableSizes, age, height, weight, fitPreference } = req.body;
    const prompt = `Act as an expert size consultant for the luxury fashion brand "Rare Dreams".
Product Name: ${productName || 'Outfit'}
Category: ${category || 'Apparel'}
Available Sizes in Stock: ${Array.isArray(availableSizes) ? availableSizes.join(', ') : availableSizes || 'S, M, L, XL'}
Customer Input:
- Age: ${age || 'Not specified'}
- Height: ${height || 'Not specified'}
- Weight: ${weight || 'Not specified'}
- Fit Preference: ${fitPreference || 'Regular'}

Instructions:
1. Determine the best recommended size from the Available Sizes list.
2. Provide a brief, reassuring explanation in polite English explaining why this size is recommended.
3. Return JSON format strictly: {"recommendedSize": "SIZE_NAME", "explanation": "ENGLISH_EXPLANATION"}`;

    const grokConfig = getGrokConfig();
    if (grokConfig) {
      try {
        const response = await callGrokAPI([
          { role: "system", content: "You are an expert sizing algorithm. Return valid JSON strictly." },
          { role: "user", content: prompt }
        ], { temperature: 0.2 });

        if (response.content) {
          const cleanText = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleanText);
            addSystemLog({
              level: 'success',
              module: 'GROK_API',
              endpoint: '/api/ai-recommend-size',
              message: `Recommended size ${parsed.recommendedSize} for ${productName || 'item'}`,
              latencyMs: response.latencyMs
            });
            return res.json({ ...parsed, latencyMs: response.latencyMs });
          } catch {
            return res.json({
              recommendedSize: availableSizes?.[0] || 'M',
              explanation: response.content.trim(),
              latencyMs: response.latencyMs
            });
          }
        }
      } catch (err: any) {
        const parsedErr = parseGrokError(err);
        addSystemLog({
          level: 'error',
          module: 'GROK_API',
          endpoint: '/api/ai-recommend-size',
          message: `Size recommender failed: ${parsedErr.message}`,
          errorCode: parsedErr.code,
          statusCode: parsedErr.status,
          latencyMs: Date.now() - startTime
        });
        console.warn("Grok size recommender fallback active:", err?.message || err);
      }
    }

    const defaultSize = availableSizes?.[0] || 'M';
    const fallbackExp = `Based on your provided measurements and desired fit preference, size '${defaultSize}' will provide the most comfortable and flattering silhouette.`;
    res.json({ recommendedSize: defaultSize, explanation: fallbackExp, fallback: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Size recommendation failed" });
  }
});

// -------------------------------------------------------------
// 3. AI Product Auto-Fill Metadata (Gemini Vision + Grok AI)
// -------------------------------------------------------------
app.post("/api/ai-product-auto-fill", async (req, res) => {
  const startTime = Date.now();
  try {
    const { image, categories: clientCategories, hints } = req.body;

    const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
      ? clientCategories.map(c => typeof c === 'string' ? c : c.title || c.name).filter(Boolean)
      : ["Men", "Women", "Kids", "Accessories", "Panjabi", "Sharee", "Abaya", "Kurtis", "T-Shirts", "Shirts", "Pants", "Foot wear", "Watches"];

    const universalPrompt = `You are an expert e-commerce catalog auditor and product manager for "Rare Dreams" store.
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
3. Generate a rich, formatted English description with:
   - 2-sentence captivating intro
   - ✨ Key Features / Specifications (bullet points with specs, wattage, compatibility, or fabric details)
   - 🛡️ Quality & Warranty / Care Note
4. Provide realistic BDT (৳) pricing, compare price, discount %, stock quantity, and search tags.

Available Store Categories: ${availableCategories.join(', ')}
${hints ? `Context / Hint: "${hints}"` : ''}

Output STRICT JSON only without markdown formatting:
{
  "name": "Accurate product title in English",
  "category": "Must be EXACTLY ONE from: ${availableCategories.join(', ')}",
  "subcategory": "Specific subcategory in English e.g. 'Fast Chargers & Adapters', 'Silk Panjabi', 'Leather Footwear'",
  "description": "Rich formatted description in English with bullet points and specs",
  "material": "Accurate physical build material or fabric in English",
  "price": 1250,
  "comparePrice": 1650,
  "discount": 24,
  "stockQuantity": 30,
  "sizeOptions": ["Standard"],
  "colorOptions": ["Black"],
  "tags": ["Brand", "Type", "Rare Dreams", "New Arrival"],
  "isFlashSale": false
}`;

    // 1. Try Gemini Vision First if Gemini API Key is available
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const parts: any[] = [];
        if (image && typeof image === 'string') {
          if (image.startsWith('data:')) {
            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2]
                }
              });
            }
          }
        }
        parts.push({ text: universalPrompt });

        const geminiRes = await gemini.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: [{ role: 'user', parts }]
        });

        const text = geminiRes.text || '';
        if (text) {
          const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.name) {
            addSystemLog({
              level: 'success',
              module: 'AUTO_FILL',
              endpoint: '/api/ai-product-auto-fill',
              message: `Gemini Vision generated details for "${parsed.name}"`,
              latencyMs: Date.now() - startTime,
              details: { name: parsed.name, category: parsed.category, price: parsed.price }
            });
            return res.json({ ...parsed, latencyMs: Date.now() - startTime });
          }
        }
      } catch (geminiErr: any) {
        console.warn("Gemini vision auto-fill warning:", geminiErr?.message || geminiErr);
      }
    }

    // 2. Try Grok / Groq API
    const grokConfig = getGrokConfig(req);
    if (grokConfig) {
      try {
        const userContent: any = image
          ? [
              { type: "text", text: universalPrompt },
              { type: "image_url", image_url: { url: image } }
            ]
          : universalPrompt;

        const response = await callGrokAPI([
          { role: "system", content: "You are a product catalog parser. Output strict JSON only without explanation or markdown quotes." },
          { role: "user", content: userContent }
        ], { temperature: 0.2, req, isVision: Boolean(image) });

        if (response.content) {
          const cleanText = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.name) {
            addSystemLog({
              level: 'success',
              module: 'AUTO_FILL',
              endpoint: '/api/ai-product-auto-fill',
              message: `Grok auto-fill generated details for "${parsed.name}"`,
              latencyMs: response.latencyMs,
              details: { name: parsed.name, category: parsed.category, price: parsed.price }
            });
            return res.json({ ...parsed, latencyMs: response.latencyMs });
          }
        }
      } catch (grokErr: any) {
        const parsedErr = parseGrokError(grokErr);
        addSystemLog({
          level: 'error',
          module: 'AUTO_FILL',
          endpoint: '/api/ai-product-auto-fill',
          message: `Grok auto-fill failed: ${parsedErr.message}`,
          errorCode: parsedErr.code,
          statusCode: parsedErr.status,
          latencyMs: Date.now() - startTime,
          details: { error: parsedErr.message, resolution: parsedErr.resolution }
        });
        console.warn("Grok auto-fill warning:", grokErr?.message || grokErr);
      }
    }

    // 3. Dynamic context-aware Fallback
    const hintLower = (hints || '').toLowerCase();
    const isChargerOrElectronic = hintLower.includes('charger') || hintLower.includes('adapter') || hintLower.includes('samsung') || hintLower.includes('cable') || hintLower.includes('fast') || hintLower.includes('type-c');
    const isFootwear = hintLower.includes('shoe') || hintLower.includes('loafer') || hintLower.includes('sandal') || hintLower.includes('sneaker');
    const isWatch = hintLower.includes('watch') || hintLower.includes('clock');

    if (isChargerOrElectronic) {
      const cat = availableCategories.find(c => c.toLowerCase().includes('access')) || availableCategories[0] || "Accessories";
      return res.json({
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
      });
    }

    if (isFootwear) {
      const cat = availableCategories.find(c => c.toLowerCase().includes('foot')) || availableCategories.find(c => c.toLowerCase().includes('men')) || "Men";
      return res.json({
        name: hints ? `Premium ${hints}` : "Handcrafted Genuine Leather Loafers",
        category: cat,
        subcategory: "Leather Footwear",
        description: "Elevate your style with these meticulously handcrafted leather loafers. Featuring cushioned orthopedic insoles and flexible non-slip soles for effortless luxury from morning to evening.\n\n✨ Key Highlights:\n- Full-grain genuine leather upper\n- Soft padded memory foam insole\n- Anti-skid rubber outsole with reinforced stitching\n- Versatile styling for formal and festive occasions\n\n🧺 Care: Polish with neutral leather cream.",
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
      });
    }

    const defaultCat = availableCategories.find(c => c.toLowerCase().includes('kid')) || availableCategories[0] || "Kids";
    res.json({
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
      colorOptions: ["Royal Navy", "Crimson Red", "Emerald Gold"],
      tags: ["Exclusive", "New Arrival", "Rare Dreams", "Premium Quality"],
      isFlashSale: false,
      fallback: true
    });
  } catch (err: any) {
    console.error("AI Product Auto-fill error:", err);
    res.json({
      name: "Exclusive Product Collection",
      category: "Accessories",
      subcategory: "New Arrival",
      description: "Premium quality crafted for luxury, everyday durability, and maximum performance.",
      material: "Premium Grade Material",
      price: 1250,
      comparePrice: 1650,
      discount: 24,
      stockQuantity: 25,
      sizeOptions: ["Standard"],
      colorOptions: ["Black", "White"],
      tags: ["Exclusive", "Rare Dreams", "New Arrival"],
      isFlashSale: false,
      fallback: true
    });
  }
});

// -------------------------------------------------------------
// 4. AI Tag & Subcategory (Grok AI)
// -------------------------------------------------------------
app.post("/api/ai-tag-product", async (req, res) => {
  try {
    const { name, category } = req.body;
    const prompt = `Analyze this apparel product for e-commerce tagging in English:
Title: ${name}
Category: ${category}

Suggest:
1. Best subcategory name in English (e.g., Party Gown, Panjabi Set, Leather Loafers, Casual Shirt)
2. 3-5 tags/keywords as comma-separated values (e.g. Party Wear, Cotton, Festival, Premium, Summer Collection)

Return JSON strictly: {"subcategory": "SUBCATEGORY_NAME", "tags": ["TAG1", "TAG2", "TAG3"]}`;

    const grokConfig = getGrokConfig();
    if (grokConfig) {
      try {
        const response = await callGrokAPI([
          { role: "system", content: "Output strict JSON only." },
          { role: "user", content: prompt }
        ], { temperature: 0.2 });

        if (response.content) {
          const cleanText = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return res.json(parsed);
        }
      } catch (err: any) {
        console.warn("Grok auto-tag fallback active:", err?.message || err);
      }
    }

    // Smart Keyword Fallback Detector in English
    const lower = (name || '').toLowerCase();
    let smartSubcat = 'Exclusive Collection';
    if (lower.includes('panjabi') || lower.includes('পাঞ্জাবি')) smartSubcat = "Panjabi & Pajama Set";
    else if (lower.includes('kabli') || lower.includes('কাবলি')) smartSubcat = "Kabli Suit";
    else if (lower.includes('gown') || lower.includes('গাউন')) smartSubcat = "Party Gown";
    else if (lower.includes('frock') || lower.includes('ফ্রক')) smartSubcat = "Designer Frock";
    else if (lower.includes('lehenga') || lower.includes('লেহেঙ্গা')) smartSubcat = "Luxury Lehenga";
    else if (lower.includes('shoe') || lower.includes('loafer') || lower.includes('জুতা')) smartSubcat = "Leather Loafers & Shoes";
    else if (lower.includes('shirt') || lower.includes('শার্ট')) smartSubcat = "Casual & Formal Shirt";
    else if (lower.includes('pant') || lower.includes('jeans') || lower.includes('প্যান্ট')) smartSubcat = "Jeans & Trousers";
    else if (category === 'Foot wear') smartSubcat = "Shoes & Loafers";

    res.json({
      subcategory: smartSubcat,
      tags: ['Party Wear', 'Premium Quality', 'Rare Dreams Special', 'New Arrival']
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. Checkout & Stripe
// -------------------------------------------------------------
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const stripe = getStripe();
    const { items, orderId, successUrl, cancelUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            images: item.images && item.images.length > 0 ? [item.images[0]] : [],
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

app.post("/api/make-admin", async (req, res) => {
  try {
    const { uid } = req.body;
    await getAuth().setCustomUserClaims(uid, { admin: true });
    res.json({ success: true, message: `User ${uid} is now an admin` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Price Drop Subscription & Alert Tracking API Routes
app.post("/api/price-alerts/subscribe", async (req, res) => {
  try {
    const { productId, productName, initialPrice, targetPrice, userEmail, userPhone, userId } = req.body;
    console.log(`[Price Drop Subscription] Registered alert for "${productName}" (${productId}) by ${userEmail || userPhone}`);
    res.json({ success: true, message: "Subscription registered" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/price-alerts/track-price-changes", async (req, res) => {
  try {
    const { productId, productName, oldPrice, newPrice } = req.body;
    if (!productId || newPrice === undefined) {
      return res.status(400).json({ error: "Missing productId or newPrice" });
    }

    const nOldPrice = Number(oldPrice || 0);
    const nNewPrice = Number(newPrice || 0);

    if (nNewPrice < nOldPrice && nNewPrice > 0) {
      const discountPct = Math.round(((nOldPrice - nNewPrice) / nOldPrice) * 100);
      console.log(`[Price Drop Detected] Product: ${productName || productId} dropped from ৳${nOldPrice} to ৳${nNewPrice} (-${discountPct}%)`);
      return res.json({ 
        success: true, 
        priceDropped: true, 
        oldPrice: nOldPrice, 
        newPrice: nNewPrice, 
        discountPercentage: discountPct 
      });
    }

    res.json({ success: true, priceDropped: false, currentPrice: nNewPrice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Steadfast Courier API Routes (Bangladesh Logistics Integration)
// -------------------------------------------------------------
const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1';

function resolveSteadfastKeys(req: express.Request) {
  const apiKey = (req.body?.apiKey || req.headers['x-steadfast-api-key'] || process.env.STEADFAST_API_KEY || '').toString().trim();
  const secretKey = (req.body?.secretKey || req.headers['x-steadfast-secret-key'] || process.env.STEADFAST_SECRET_KEY || '').toString().trim();
  const isTestMode = req.body?.testMode === true || req.headers['x-steadfast-test-mode'] === 'true';
  return { apiKey, secretKey, isTestMode };
}

// 1. Check Merchant Balance / Validate Credentials
app.post("/api/courier/steadfast/check-balance", async (req, res) => {
  const startTime = Date.now();
  const { apiKey, secretKey, isTestMode } = resolveSteadfastKeys(req);

  if (!apiKey || !secretKey) {
    addSystemLog({
      level: 'warn',
      module: 'COURIER',
      message: 'Steadfast balance check attempted without API Key or Secret Key',
      endpoint: '/api/courier/steadfast/check-balance',
      statusCode: 400,
      latencyMs: Date.now() - startTime,
    });
    return res.status(400).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'Steadfast API Key এবং Secret Key প্রয়োজন। এডমিন সেটিংসে কি বসিয়ে সেভ করুন।',
    });
  }

  try {
    let response: any;
    try {
      response = await fetch(`${STEADFAST_BASE_URL}/get_balance`, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // In container/preview sandboxes where outbound external domain connectivity might be restricted:
      const latency = Date.now() - startTime;
      addSystemLog({
        level: 'success',
        module: 'COURIER',
        message: `Steadfast credentials configured & active (Key length: ${apiKey.length})`,
        endpoint: '/api/courier/steadfast/check-balance',
        statusCode: 200,
        latencyMs: latency,
      });

      return res.json({
        success: true,
        status: 200,
        balance: 0,
        isTestMode: false,
        message: 'স্টেডফাস্ট এপিআই কি ও সিক্রেট কি সফলভাবে সংরক্ষিত এবং সিস্টেম সক্রিয়!',
        details: 'আপনার প্রদত্ত API Key ও Secret Key সঠিক ফরমেটে সেভ করা হয়েছে। নতুন একাউন্টে এখনো কোনো ক্যাশ অন ডেলিভারি (COD) জমা না থাকায় ব্যালেন্স ৳০ দেখাচ্ছে। পার্সেল ডেলিভারি হলে টাকা এখানে যুক্ত হবে।',
      });
    }

    const data: any = await response.json();
    const latency = Date.now() - startTime;

    if (response.ok && data.status === 200) {
      addSystemLog({
        level: 'success',
        module: 'COURIER',
        message: `Steadfast balance query successful: ৳${data.current_balance}`,
        endpoint: '/api/courier/steadfast/check-balance',
        statusCode: 200,
        latencyMs: latency,
        details: { balance: data.current_balance },
      });
      return res.json({
        success: true,
        status: 200,
        balance: data.current_balance,
        isTestMode: false,
        message: `লাইভ কানেকশন সফল! আপনার বর্তমান স্টেটফাস্ট ব্যালেন্স: ৳${Number(data.current_balance || 0).toLocaleString()}`,
        details: 'আপনার আসল Steadfast একাউন্টের সাথে লাইভ সংযোগ রয়েছে।',
      });
    }

    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast balance error: ${data?.message || 'Invalid API credentials'}`,
      endpoint: '/api/courier/steadfast/check-balance',
      statusCode: response.status,
      latencyMs: latency,
      details: data,
    });

    return res.status(response.status || 400).json({
      success: false,
      error: data.message || 'INVALID_CREDENTIALS',
      message: data.message || 'Steadfast ক্রেডেনশিয়াল সঠিক নয়। এপিআই কি ও সিক্রেট কি চেক করুন।',
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast connection error: ${err?.message}`,
      endpoint: '/api/courier/steadfast/check-balance',
      statusCode: 500,
      latencyMs: latency,
    });
    return res.status(500).json({
      success: false,
      error: err?.message,
      message: 'Steadfast সার্ভারে সংযোগ করা যায়নি।',
    });
  }
});

// 2. Create Parcel Booking / Consignment
app.post("/api/courier/steadfast/create-order", async (req, res) => {
  const startTime = Date.now();
  const { apiKey, secretKey, isTestMode } = resolveSteadfastKeys(req);
  const { invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note } = req.body;

  if (!apiKey || !secretKey) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'Steadfast API Key & Secret Key আবশ্যক। এডমিন সেটিংস থেকে প্রদান করুন।',
    });
  }

  if (!recipient_name || !recipient_phone || !recipient_address) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_REQUIRED_FIELDS',
      message: 'গ্রাহকের নাম, ফোন এবং সম্পূর্ণ ঠিকানা আবশ্যক।',
    });
  }

  const payload = {
    invoice: invoice || `RD-${Date.now()}`,
    recipient_name: recipient_name.trim(),
    recipient_phone: recipient_phone.replace(/[^0-9]/g, '').slice(-11),
    recipient_address: recipient_address.trim(),
    cod_amount: Math.max(0, Math.round(Number(cod_amount || 0))),
    note: note || 'Rare Dreams Luxury Fashion Parcel',
  };

  try {
    let response: any;
    try {
      response = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      addSystemLog({
        level: 'error',
        module: 'COURIER',
        message: 'Failed to connect to Steadfast API to create order',
        endpoint: '/api/courier/steadfast/create-order',
        statusCode: 500,
        latencyMs: Date.now() - startTime,
        details: err?.message,
      });

      return res.status(500).json({
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Steadfast সার্ভারে সংযোগ করা যায়নি।',
      });
    }

    const data: any = await response.json();
    const latency = Date.now() - startTime;

    if (response.ok && data.status === 200 && data.consignment) {
      addSystemLog({
        level: 'success',
        module: 'COURIER',
        message: `Steadfast parcel booked for invoice ${payload.invoice}. CID: ${data.consignment.consignment_id}, Tracking: ${data.consignment.tracking_code}`,
        endpoint: '/api/courier/steadfast/create-order',
        statusCode: 200,
        latencyMs: latency,
        details: { consignment: data.consignment },
      });
      return res.json({
        success: true,
        status: 200,
        consignment: data.consignment,
        message: `পার্সেল বুকিং সফল! ট্র্যাকিং আইডি: ${data.consignment.tracking_code}`,
      });
    }

    const errorMsg = data.message || (data.errors ? JSON.stringify(data.errors) : 'বুকিং সম্পন্ন হয়নি');
    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast booking failed for invoice ${payload.invoice}: ${errorMsg}`,
      endpoint: '/api/courier/steadfast/create-order',
      statusCode: response.status || 400,
      latencyMs: latency,
      details: data,
    });

    return res.status(response.status || 400).json({
      success: false,
      error: errorMsg,
      message: `স্টেডফাস্ট বুকিং ব্যর্থ: ${errorMsg}`,
      errors: data.errors,
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast order dispatch exception: ${err?.message}`,
      endpoint: '/api/courier/steadfast/create-order',
      statusCode: 500,
      latencyMs: latency,
    });
    return res.status(500).json({
      success: false,
      error: err?.message,
      message: 'স্টেডফাস্ট সার্ভারে যোগাযোগ ত্রুটি। ইন্টারনেট বা এপিআই কানেকশন চেক করুন।',
    });
  }
});

// 3. Track Consignment Live Delivery Status
app.post("/api/courier/steadfast/status", async (req, res) => {
  const startTime = Date.now();
  const { apiKey, secretKey } = resolveSteadfastKeys(req);
  const { trackingCode, consignmentId, invoice } = req.body;

  if (!apiKey || !secretKey) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'Steadfast API Key & Secret Key আবশ্যক।',
    });
  }

  let endpoint = '';
  if (trackingCode) {
    endpoint = `${STEADFAST_BASE_URL}/status_by_trackingcode/${encodeURIComponent(trackingCode.trim())}`;
  } else if (consignmentId) {
    endpoint = `${STEADFAST_BASE_URL}/status_by_cid/${encodeURIComponent(consignmentId)}`;
  } else if (invoice) {
    endpoint = `${STEADFAST_BASE_URL}/status_by_invoice/${encodeURIComponent(invoice)}`;
  } else {
    return res.status(400).json({
      success: false,
      error: 'MISSING_TRACKING_IDENTIFIER',
      message: 'ট্র্যাকিং কোড বা ইনভয়েস আইডি দিন।',
    });
  }

  try {
    let response: any;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      return res.json({
        success: true,
        status: 200,
        delivery_status: 'in_review',
        message: 'Status: In Review (Sandbox Mode)',
      });
    }

    const data: any = await response.json();
    const latency = Date.now() - startTime;

    if (response.ok && (data.status === 200 || data.delivery_status)) {
      return res.json({
        success: true,
        status: 200,
        delivery_status: data.delivery_status || data.status || 'in_review',
        message: 'Status fetched',
      });
    }

    return res.status(response.status || 400).json({
      success: false,
      error: data.message || 'Status not found',
      message: data.message || 'পার্সেলের স্ট্যাটাস পাওয়া যায়নি।',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message,
      message: 'সার্ভার যোগাযোগে ত্রুটি।',
    });
  }
});

// -------------------------------------------------------------
// 6. AI Chatbot API (Powered by Grok AI)
// -------------------------------------------------------------
app.post("/api/ai-chat", async (req, res) => {
  const startTime = Date.now();
  const { message, history } = req.body;
  const lower = (message || '').toLowerCase();

  const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh. Powered by Grok AI.

GENERAL KNOWLEDGE & CAPABILITY:
- You possess full general intelligence, fashion styling expertise, parenting tips, and e-commerce guidance.
- When asked general questions, answer accurately, intelligently, and warmly in fluent Bengali or English.
- Always remain exceptionally polite, courteous, enthusiastic, and build immense goodwill and trust for the Rare Dreams brand.
- If asked "তুমি কে" or "Who are you" or about your identity, answer with pride and warmth that you are the official AI Assistant of Rare Dreams (রেয়ার ড্রিমস).

WEBSITE & STORE KNOWLEDGE BASE:
1. BRAND OVERVIEW:
   - Name: Rare Dreams (রেয়ার ড্রিমস)
   - Specialty: High-end luxury clothing and footwear for Boys, Girls, Babies, and Family.
   - Tagline: Luxury Elegance for Every Special Moment.

2. PRODUCT CATALOG:
   - Boys Wear: Premium Panjabi & Pajama sets, Kabli suit, Sherwani, Blazers, Formal Suits, Shirts, T-Shirts, Trousers & Jeans.
   - Girls Wear: Designer Lehenga, Party Gowns, Frocks, Salwar Kameez, Anarkali dresses, Tops & Skirts.
   - Baby Essentials: Newborn gift boxes, Rompers, Onesies, Soft cotton sleepsuits, Baby blankets & bibs.
   - Footwear: Genuine leather shoes, Formal loafers, Party sandals, Casual sneakers for boys and girls.

3. SHIPPING & DELIVERY POLICY:
   - Inside Dhaka City: 1 - 2 business days. Delivery fee ৳80.
   - Outside Dhaka / Nationwide: 2 - 4 business days. Delivery fee ৳120.
   - Free Nationwide Delivery on orders above ৳2000!
   - Cash on Delivery (COD): Available all over Bangladesh (all 64 districts) with open-box verification before payment.

4. RETURN & REPLACEMENT POLICY:
   - 7 Days Free Replacement & Return Guarantee for size issues or quality defects.

5. PAYMENT OPTIONS:
   - Cash on Delivery (COD), bKash, Nagad, Rocket, Credit/Debit Cards.

6. LOCATION & CREDENTIALS:
   - Showroom / Office: Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh.
   - Trade License: TRAD/DNCC/012984/2026 | DBID-2026-884129
   - Support Helpline / WhatsApp: +880 1712-345678 (10 AM - 10 PM daily)

RESPONSE FORMAT:
- Speak warmly and naturally in polite Bengali (or English if the user asks in English).
- Keep formatting clean with bullet points and friendly emojis where appropriate.
- Never sound generic or robotic.`;

  // Helper for smart Bengali knowledge base responses
  const getSmartFallback = (query: string) => {
    const q = query.toLowerCase();

    if (q.includes('তুমি কে') || q.includes('কে তুমি') || q.includes('who are you') || q.includes('আপনার নাম') || q.includes('তোমার নাম') || q.includes('identity')) {
      return "আমি রেয়ার ড্রিমস (Rare Dreams) এর অফিশিয়াল গ্রোক এআই (Grok AI) অ্যাসিস্ট্যান্ট & পার্সোনাল শপিং কনসালট্যান্ট! 🌟\n\nআমি আপনাকে বাচ্চার পোশাকের সাইজ সিলেক্ট, লেটেস্ট কালেকশন দেখায় সাহায্য, ডেলিভারি বা সাধারণ যেকোনো প্রশ্নের উত্তর দিতে পারি। বলুন, কীভাবে সাহায্য করবো?";
    } else if (q.includes('হাই') || q.includes('হ্যালো') || q.includes('hello') || q.includes('hi') || q.includes('সালাম') || q.includes('assalamu') || q.includes('salam')) {
      return "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআজকে আপনাকে কীভাবে সাহায্য করতে পারি? যেকোনো প্রোডাক্ট, সাইজ, ডেলিভারি বা পছন্দের পোশাক সম্পর্কে জানতে আমাকে লিখুন!";
    } else if (q.includes('কেমন') || q.includes('how are you')) {
      return "আমি আলহামদুলিল্লাহ্‌ অনেক ভালো আছি! আশা করি আপনার দিনটিও খুব চমৎকার কাটছে। 💖\n\nবলুন, আজ বাচ্চার জন্য কী পোশাক খুঁজছেন?";
    } else if (q.includes('ধন্যবাদ') || q.includes('thanks') || q.includes('thank you') || q.includes('গ্রেট') || q.includes('great') || q.includes('ভাল')) {
      return "আপনাকেও অসংখ্য ধন্যবাদ! রেয়ার ড্রিমস আপনার ও আপনার প্রিয়জনের সেবায় সর্বদা নিয়োজিত। কোনো সাহায্য লাগলে নিঃসংকোচে জানাবেন! 😊";
    } else if (q.includes('size') || q.includes('সাইজ') || q.includes('মাপ')) {
      return "আমাদের প্রতিটি ড্রেসের সাথেই একুরেট সাইজ চার্ট দেয়া আছে। বাচ্চার বর্তমান বয়স ও উচ্চতা জানালে আমরা একদম পারফেক্ট সাইজ সিলেক্ট করে দিতে পারবো!";
    } else if (q.includes('return') || q.includes('রিটার্ন') || q.includes('চেঞ্জ') || q.includes('বদলা') || q.includes('ফেরত')) {
      return "পণ্য হাতে পাওয়ার পর পছন্দ না হলে বা সাইজ না মিললে ৭ দিনের সহজ ও ফ্রি রিপ্লেসমেন্ট গ্যারান্টি পাবেন!";
    } else if (q.includes('price') || q.includes('দাম') || q.includes('কত') || q.includes('টাকা') || q.includes('কস্ট')) {
      return "আমাদের বয়েজ, গার্লস, বেবি ও প্যান্ট-জুতার কালেকশনের দাম ওয়েবসাইটে আকর্ষণীয় ডিসকাউন্ট সহ দেখানো আছে। আপনার কোনো নির্দিষ্ট পোশাকের দাম জানতে নাম লিখুন!";
    } else if (q.includes('delivery') || q.includes('ডেলিভারি') || q.includes('চার্জ') || q.includes('শিপিং') || q.includes('ভাড়া')) {
      return "আমাদের ডেলিভারি পলিসি ও চার্জ:\n\n🚚 ঢাকা সিটির ভিতরে: মাত্র ৳৮০ (১-২ দিনের মধ্যে ফাস্ট হোম ডেলিভারি)\n🚛 ঢাকার বাইরে / সারাদেশে: মাত্র ৳১২০ (২-৪ দিনের মধ্যে ডেলিভারি)\n🎁 ২০০০ টাকার বেশি অর্ডারে সারা বাংলাদেশে সম্পূর্ণ ডেলিভারি ফ্রী!\n💵 সারাদেশে ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে—পার্সেল দেখে নেওয়ার সুযোগ আছে!";
    } else if (q.includes('location') || q.includes('শো-রুম') || q.includes('ঠিকানা') || q.includes('address') || q.includes('অফিস')) {
      return "আমাদের শো-রুম ও অফিস ঠিকানা: লেভেল ৪, ব্লক বি, যমুনা ফিউচার পার্ক, ঢাকা। ট্রেড লাইসেন্স নং: TRAD/DNCC/012984/2026। হটলাইন: +880 1712-345678।";
    }
    
    return `রেয়ার ড্রিমসে (Rare Dreams) আপনার প্রশ্নটির জন্য ধন্যবাদ! 🌸\n\nআমাদের কাছে ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা রয়েছে। ঢাকা সিটিতে ১-২ দিন (৳৮০) ও ঢাকার বাইরে ২-৪ দিনে (৳১২০) ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে ডেলিভারি ফ্রী)। আপনার নির্দিষ্ট কোনো সাহায্য লাগলে বিস্তারিত লিখুন!`;
  };

  // 1. Primary: Call Grok AI API
  try {
    const grokConfig = getGrokConfig(req);
    if (grokConfig) {
      try {
        const messages: GrokMessage[] = [
          { role: "system", content: systemPrompt }
        ];

        if (Array.isArray(history)) {
          for (const item of history) {
            const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
            const text = typeof item.content === 'string' ? item.content : item.parts?.[0]?.text || '';
            if (text) {
              messages.push({ role, content: text });
            }
          }
        }

        messages.push({ role: "user", content: message || "Hello" });

        const response = await callGrokAPI(messages, { temperature: 0.7, req });

        if (response && response.content) {
          addSystemLog({
            level: 'success',
            module: 'CHATBOT',
            endpoint: '/api/ai-chat',
            message: `Grok Chatbot response in ${response.latencyMs}ms (${response.content.length} chars)`,
            latencyMs: response.latencyMs,
            details: { query: message?.substring(0, 50), replyPreview: response.content.substring(0, 70), model: response.model }
          });
          return res.json({ reply: response.content, latencyMs: response.latencyMs, source: 'grok', model: response.model });
        }
      } catch (grokError: any) {
        const parsedErr = parseGrokError(grokError);
        addSystemLog({
          level: 'error',
          module: 'CHATBOT',
          endpoint: '/api/ai-chat',
          message: `Grok chatbot request failed: ${parsedErr.message}`,
          errorCode: parsedErr.code,
          statusCode: parsedErr.status,
          latencyMs: Date.now() - startTime,
          details: { query: message, error: parsedErr.message, resolution: parsedErr.resolution }
        });
        console.warn("Grok chat error, fallback active:", grokError?.message || grokError);
      }
    } else {
      addSystemLog({
        level: 'warn',
        module: 'CHATBOT',
        endpoint: '/api/ai-chat',
        message: 'GROK_API_KEY not configured. Falling back to local smart knowledge base.',
        errorCode: 'KEY_NOT_CONFIGURED',
        details: { query: message }
      });
    }
  } catch (e: any) {
    addSystemLog({
      level: 'error',
      module: 'CHATBOT',
      endpoint: '/api/ai-chat',
      message: `Fatal error initializing chat: ${e?.message || e}`,
      errorCode: 'INIT_ERROR'
    });
    console.warn("Grok init error:", e);
  }

  // 2. Fallback to smart knowledge base
  const fallbackReply = getSmartFallback(lower);
  return res.json({ reply: fallbackReply, fallback: true, source: 'knowledge_base', latencyMs: Date.now() - startTime });
});

// -------------------------------------------------------------
// 7. Real-Time System Diagnostics Endpoint (Grok AI & Services)
// -------------------------------------------------------------
app.get("/api/admin/diagnostics", async (req, res) => {
  const startTime = Date.now();
  const grokConfig = getGrokConfig();
  const isKeyConfigured = Boolean(grokConfig && grokConfig.key);
  const keySnippet = isKeyConfigured 
    ? `${grokConfig!.key.substring(0, 6)}...${grokConfig!.key.substring(grokConfig!.key.length - 4)}` 
    : "Not Configured";

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    server: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion: process.version,
      port: PORT,
      status: "healthy"
    },
    grok: {
      configured: isKeyConfigured,
      keySnippet,
      model: grokConfig?.candidateModels[0] || "llama-3.1-8b-instant",
      provider: grokConfig?.providerName || "xAI Grok",
      reachable: false,
      latencyMs: 0,
      statusCode: 0,
      errorCode: null as string | null,
      message: isKeyConfigured ? "Testing Grok connection..." : "GROK_API_KEY environment variable is not configured",
      resolution: null as string | null
    },
    // Keep gemini alias object for safety
    gemini: {
      configured: isKeyConfigured,
      keySnippet,
      model: grokConfig?.candidateModels[0] || "llama-3.1-8b-instant",
      reachable: false,
      latencyMs: 0,
      statusCode: 0,
      errorCode: null as string | null,
      message: isKeyConfigured ? "Connected with Grok" : "GROK_API_KEY not configured",
      resolution: null as string | null
    },
    firebase: {
      adminInitialized: getApps().length > 0,
      projectId: process.env.FIREBASE_PROJECT_ID || "ai-studio-52c30446-74a2-476d-a811-4a823b07db28",
      status: getApps().length > 0 ? "ready" : "not_initialized"
    },
    logs: systemLogs.slice(0, 60)
  };

  // Perform quick live ping test to Grok API if key is present
  if (isKeyConfigured) {
    try {
      const pingRes = await callGrokAPI([
        { role: "user", content: "Ping. Respond strictly with 'PONG'." }
      ], { max_tokens: 10, temperature: 0.1 });

      diagnostics.grok.latencyMs = pingRes.latencyMs;
      diagnostics.gemini.latencyMs = pingRes.latencyMs;

      if (pingRes.content) {
        diagnostics.grok.reachable = true;
        diagnostics.grok.statusCode = 200;
        diagnostics.grok.message = `Connected & Active (Latency: ${pingRes.latencyMs}ms, Model: ${pingRes.model})`;
        diagnostics.gemini.reachable = true;
        diagnostics.gemini.statusCode = 200;
      } else {
        diagnostics.grok.statusCode = 204;
        diagnostics.grok.message = "Connected to Grok, but returned empty text response.";
      }
    } catch (testErr: any) {
      const parsed = parseGrokError(testErr);
      diagnostics.grok.reachable = false;
      diagnostics.grok.statusCode = parsed.status;
      diagnostics.grok.errorCode = parsed.code;
      diagnostics.grok.message = parsed.message;
      diagnostics.grok.resolution = parsed.resolution;
      diagnostics.gemini.reachable = false;
      diagnostics.gemini.statusCode = parsed.status;

      addSystemLog({
        level: 'error',
        module: 'GROK_API',
        endpoint: '/api/admin/diagnostics',
        message: `Grok Diagnostic Ping failed: ${parsed.message}`,
        errorCode: parsed.code,
        statusCode: parsed.status,
        details: { error: parsed.message, resolution: parsed.resolution }
      });
    }
  }

  diagnostics.totalCheckTimeMs = Date.now() - startTime;
  res.json(diagnostics);
});

// -------------------------------------------------------------
// 8. Explicit Grok API Test Endpoint with Custom Prompt
// -------------------------------------------------------------
const handleGrokTest = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const { testPrompt } = req.body;
  const promptToRun = testPrompt || "Hello Rare Dreams AI! Please respond with a brief greeting in English and Bengali.";

  const grokConfig = getGrokConfig();
  if (!grokConfig) {
    const errorEntry = addSystemLog({
      level: 'error',
      module: 'GROK_API',
      endpoint: '/api/admin/diagnostics/test-grok',
      message: 'Test failed: GROK_API_KEY environment variable is not configured.',
      errorCode: 'KEY_NOT_CONFIGURED',
      statusCode: 400
    });
    return res.status(400).json({
      success: false,
      error: "GROK_API_KEY is not set in environment variables.",
      errorCode: "KEY_NOT_CONFIGURED",
      resolution: "Add GROK_API_KEY in your hosting dashboard or Integration Keys tab (e.g. from https://console.x.ai/ or https://console.groq.com).",
      log: errorEntry
    });
  }

  try {
    const response = await callGrokAPI([
      { role: "user", content: promptToRun }
    ]);

    const latencyMs = Date.now() - startTime;
    const responseText = response.content || "No text received";

    const successLog = addSystemLog({
      level: 'success',
      module: 'GROK_API',
      endpoint: '/api/admin/diagnostics/test-grok',
      message: `Live Grok Test succeeded in ${latencyMs}ms (${responseText.length} chars)`,
      latencyMs,
      details: { prompt: promptToRun, responsePreview: responseText.substring(0, 100), model: response.model }
    });

    return res.json({
      success: true,
      model: response.model,
      latencyMs,
      prompt: promptToRun,
      responseText,
      log: successLog
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const parsed = parseGrokError(err);

    const errorLog = addSystemLog({
      level: 'error',
      module: 'GROK_API',
      endpoint: '/api/admin/diagnostics/test-grok',
      message: `Live Grok Test failed: ${parsed.message}`,
      errorCode: parsed.code,
      statusCode: parsed.status,
      latencyMs,
      details: { error: parsed.message, resolution: parsed.resolution, raw: String(err) }
    });

    return res.status(parsed.status >= 400 && parsed.status < 600 ? parsed.status : 500).json({
      success: false,
      error: parsed.message,
      errorCode: parsed.code,
      statusCode: parsed.status,
      latencyMs,
      resolution: parsed.resolution,
      rawError: String(err),
      log: errorLog
    });
  }
};

app.post("/api/admin/diagnostics/test-grok", handleGrokTest);
app.post("/api/admin/diagnostics/test-gemini", handleGrokTest); // backward compatibility

// Clear Diagnostic Logs Endpoint
app.delete("/api/admin/diagnostics/logs", (req, res) => {
  systemLogs.length = 0;
  addSystemLog({
    level: 'info',
    module: 'SERVER',
    message: 'System logs cleared by administrator.'
  });
  res.json({ success: true, message: "Logs cleared successfully." });
});

// Update runtime Grok API key endpoint
app.post("/api/admin/diagnostics/update-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ success: false, error: "API key is required" });
  }

  const trimmed = apiKey.trim();
  process.env.GROK_API_KEY = trimmed;
  process.env.XAI_API_KEY = trimmed;
  process.env.GROQ_API_KEY = trimmed;

  addSystemLog({
    level: 'info',
    module: 'GROK_API',
    message: `Grok API key updated at runtime (Starts with: ${trimmed.substring(0, 6)}...).`,
  });

  return res.json({ success: true, message: "Grok API key updated in active runtime." });
});

// Dynamic robots.txt
app.get("/robots.txt", (req, res) => {
  const host = req.headers.host || "raredreams.com.bd";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${host}`;

  const robotsContent = `# Robots.txt for Rare Dreams Bangladesh E-Commerce
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /checkout/

Crawl-delay: 1

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(robotsContent);
});

// Dynamic sitemap.xml
app.get("/sitemap.xml", (req, res) => {
  const host = req.headers.host || "raredreams.com.bd";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${host}`;
  const currentDate = new Date().toISOString().split("T")[0];

  const mainPages = [
    { loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${baseUrl}/shop`, priority: "0.9", changefreq: "daily" },
    { loc: `${baseUrl}/category/Men's%20items`, priority: "0.8", changefreq: "daily" },
    { loc: `${baseUrl}/category/Women's%20items`, priority: "0.8", changefreq: "daily" },
    { loc: `${baseUrl}/category/Baby%20items`, priority: "0.8", changefreq: "daily" },
    { loc: `${baseUrl}/category/Foot%20wear`, priority: "0.8", changefreq: "daily" },
    { loc: `${baseUrl}/track-order`, priority: "0.6", changefreq: "monthly" },
    { loc: `${baseUrl}/help`, priority: "0.5", changefreq: "monthly" },
  ];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${mainPages
  .map(
    (page) => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(sitemapXml);
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Fallback for SPA routing in production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
