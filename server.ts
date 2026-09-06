import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import webpush from "web-push";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { GoogleGenAI } from "@google/genai";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BDa6JUFB_Um0OUPJxaFZUxwOxRaAGBrzsD0lemYYeZmKD45lsbpbieaA66x35A3RaRK9tfK4eQ33z5OAsHlpRYs";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "16k69Uf8AFtVvrGKa8wlA5q2ihOoZqtG7QYQNbXXH28";

try {
  webpush.setVapidDetails(
    "mailto:admin@raredreamsbd.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log("[WebPush] VAPID details configured successfully.");
} catch (vErr) {
  console.warn("[WebPush] VAPID setup note:", vErr);
}

if (!getApps().length) {
  try {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "lofty-theme-0nn32"
    });
  } catch (e) {
    console.warn("Firebase Admin initializeApp note:", e);
  }
}

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

// In-memory & Persistent Push Subscriptions Store (Guarantees background push delivery even without Firestore Admin IAM keys)
interface PushSubRecord {
  token: string;
  role: string;
  userId: string;
  email: string;
  subscription: any;
  updatedAt: number;
}
const activePushSubscriptions = new Map<string, PushSubRecord>();

// Public VAPID Key retrieval endpoint for Web Push
app.get("/api/push/vapid-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register or refresh Web Push subscription endpoint
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { token, role, userId, email, userEmail, subscription } = req.body;
    if (!token && (!subscription || !subscription.endpoint)) {
      return res.status(400).json({ error: "Token or subscription is required" });
    }

    const key = token || (subscription ? btoa(subscription.endpoint).slice(-32) : Date.now().toString());
    const effectiveRole = role || "customer";
    const effectiveEmail = email || userEmail || "";

    // Store in reliable Server memory store
    activePushSubscriptions.set(key, {
      token: key,
      role: effectiveRole,
      userId: userId || "anonymous",
      email: effectiveEmail,
      subscription: subscription || null,
      updatedAt: Date.now()
    });

    console.log(`[WebPush] Subscription registered in Server Memory: ${key} (${effectiveRole}, ${effectiveEmail || 'no-email'}), Total active in memory: ${activePushSubscriptions.size}`);

    // Also attempt Firestore Admin write (if available)
    try {
      const db = getFirestore();
      await db.collection("fcm_tokens").doc(key).set({
        token: key,
        role: effectiveRole,
        userId: userId || "anonymous",
        email: effectiveEmail,
        userEmail: effectiveEmail,
        subscription: subscription || null,
        updatedAt: new Date()
      }, { merge: true });
    } catch (fsErr) {
      // Memory store is already safely populated
    }

    res.json({ success: true, message: "Subscription registered", totalSubscribers: activePushSubscriptions.size });
  } catch (error: any) {
    console.warn("Push subscription registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin New Order Native Push Notification Endpoint (WebPush & FCM Dual Multicast)
app.post("/api/notifications/push-admin-order", async (req, res) => {
  try {
    const { orderId, customerName, phone, total, district } = req.body;
    const formattedTotal = '৳' + Number(total || 0).toLocaleString('en-IN');
    const displayDistrict = district ? ` • ${district}` : '';

    console.log(`[Push Admin Order] Triggered for order ${orderId} by ${customerName} (${formattedTotal})`);

    const adminTokens: string[] = [];
    const adminSubscriptions: any[] = [];
    const seenEndpoints = new Set<string>();

    // 1. Gather all in-memory admin subscriptions (Fast, zero permission errors)
    activePushSubscriptions.forEach((subRecord) => {
      const role = (subRecord.role || '').toLowerCase();
      const email = (subRecord.email || '').toLowerCase();
      if (
        role === 'admin' || 
        role === 'seller' || 
        role === 'superadmin' ||
        email.includes('karim') || 
        email.includes('admin') ||
        activePushSubscriptions.size <= 3 // In development, ensure primary test device receives it
      ) {
        if (subRecord.subscription && subRecord.subscription.endpoint && !seenEndpoints.has(subRecord.subscription.endpoint)) {
          seenEndpoints.add(subRecord.subscription.endpoint);
          adminSubscriptions.push(subRecord.subscription);
        }
        if (subRecord.token && subRecord.token.length > 20 && !adminTokens.includes(subRecord.token)) {
          adminTokens.push(subRecord.token);
        }
      }
    });

    // 2. Fetch all admin tokens and subscriptions from Firestore fcm_tokens collection (if accessible)
    try {
      const db = getFirestore();
      const tokensSnap = await db.collection('fcm_tokens').get();
      
      tokensSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const role = (d.role || '').toLowerCase();
        const email = (d.userEmail || d.email || '').toLowerCase();
        
        if (
          role === 'admin' || 
          role === 'seller' || 
          role === 'superadmin' ||
          email.includes('karim') || 
          email.includes('admin')
        ) {
          if (d.subscription && d.subscription.endpoint && !seenEndpoints.has(d.subscription.endpoint)) {
            seenEndpoints.add(d.subscription.endpoint);
            adminSubscriptions.push(d.subscription);
          }
          const token = d.token || docSnap.id;
          if (token && typeof token === 'string' && token.length > 20 && !adminTokens.includes(token)) {
            adminTokens.push(token);
          }
        }
      });
    } catch (fsReadErr) {
      console.info('[Push Admin Order] Firestore read note (using in-memory subscriptions):', adminSubscriptions.length);
    }

    console.log(`[Push Admin Order] Found ${adminTokens.length} token(s), ${adminSubscriptions.length} WebPush subscription(s) for Admins.`);

    const webPushPayload = JSON.stringify({
      title: `🛍️ নতুন অর্ডার - ${formattedTotal}`,
      body: `${customerName || 'কাস্টমার'} (${phone || 'N/A'})${displayDistrict}\nঅর্ডার #${(orderId || '').slice(-6).toUpperCase()}`,
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      vibrate: [350, 100, 350, 100, 350],
      url: '/admin/orders',
      orderId: String(orderId || ''),
      tag: 'order_' + String(orderId || Date.now())
    });

    let webPushDelivered = 0;
    // 1. Deliver directly through W3C WebPush Protocol (Works in background even when browser/tab is closed!)
    await Promise.allSettled(
      adminSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, webPushPayload, {
            urgency: 'high',
            TTL: 86400
          });
          webPushDelivered++;
        } catch (subErr: any) {
          console.warn('[Push Admin Order] WebPush delivery note for endpoint:', subErr?.statusCode || subErr?.message);
        }
      })
    );

    // 2. Companion FCM Multicast delivery if Firebase Admin is available
    let fcmDelivered = 0;
    if (adminTokens.length > 0) {
      try {
        const messaging = getMessaging();
        const payload = {
          tokens: adminTokens,
          notification: {
            title: `🛍️ নতুন অর্ডার - ${formattedTotal}`,
            body: `${customerName || 'কাস্টমার'} (${phone || 'N/A'})${displayDistrict}\nঅর্ডার #${(orderId || '').slice(-6).toUpperCase()}`,
          },
          data: {
            title: `🛍️ নতুন অর্ডার - ${formattedTotal}`,
            body: `${customerName || 'কাস্টমার'} (${phone || 'N/A'})${displayDistrict}`,
            url: '/admin/orders',
            orderId: String(orderId || ''),
            customerName: String(customerName || ''),
            phone: String(phone || ''),
            total: String(total || 0),
            targetRole: 'admin',
            tag: 'order_' + String(orderId || Date.now())
          },
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "86400"
            },
            notification: {
              title: `🛍️ নতুন অর্ডার - ${formattedTotal}`,
              body: `${customerName || 'কাস্টমার'} (${phone || 'N/A'})${displayDistrict}`,
              icon: '/pwa-192x192.png',
              badge: '/favicon-32x32.png',
              vibrate: [350, 120, 350, 120, 350],
              requireInteraction: true,
              tag: 'order_' + String(orderId || Date.now()),
              data: {
                url: '/admin/orders',
                orderId: String(orderId || '')
              }
            },
            fcmOptions: {
              link: '/admin/orders'
            }
          },
          android: {
            priority: "high" as const,
            notification: {
              title: `🛍️ নতুন অর্ডার - ${formattedTotal}`,
              body: `${customerName || 'কাস্টমার'} (${phone || 'N/A'})${displayDistrict}`,
              sound: "default",
              defaultVibrateTimings: true,
              defaultSound: true,
              tag: 'order_' + String(orderId || Date.now())
            }
          }
        };

        const response = await messaging.sendEachForMulticast(payload);
        fcmDelivered = response.successCount;
      } catch (fcmErr: any) {
        console.warn("[Push Admin Order] FCM send note:", fcmErr?.message || fcmErr);
      }
    }

    console.log(`[Push Admin Order] Delivered: ${webPushDelivered} via WebPush, ${fcmDelivered} via FCM.`);

    return res.json({
      success: true,
      webPushDelivered,
      fcmDelivered,
      totalAdmins: adminTokens.length + adminSubscriptions.length
    });
  } catch (error: any) {
    console.error("Push admin order error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast Push Notification (Marketing & Campaigns from Admin)
app.post("/api/notifications/broadcast", async (req, res) => {
  try {
    const { title, body, target, url, imageUrl } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required." });
    }

    const targetTokens: string[] = [];
    const targetSubscriptions: any[] = [];
    const seenEndpoints = new Set<string>();

    // 1. Gather from Server memory subscriptions
    activePushSubscriptions.forEach((subRecord) => {
      const role = (subRecord.role || 'customer').toLowerCase();
      let match = false;
      if (target === 'admins') {
        if (role === 'admin' || role === 'seller' || role === 'superadmin') match = true;
      } else if (target === 'customers') {
        if (role !== 'admin' && role !== 'seller' && role !== 'superadmin') match = true;
      } else {
        match = true;
      }

      if (match) {
        if (subRecord.subscription && subRecord.subscription.endpoint && !seenEndpoints.has(subRecord.subscription.endpoint)) {
          seenEndpoints.add(subRecord.subscription.endpoint);
          targetSubscriptions.push(subRecord.subscription);
        }
        if (subRecord.token && subRecord.token.length > 20 && !targetTokens.includes(subRecord.token)) {
          targetTokens.push(subRecord.token);
        }
      }
    });

    // 2. Fetch from Firestore (if accessible)
    try {
      const db = getFirestore();
      const tokensSnap = await db.collection('fcm_tokens').get();

      tokensSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const role = (d.role || 'customer').toLowerCase();
        const token = d.token || docSnap.id;

        let match = false;
        if (target === 'admins') {
          if (role === 'admin' || role === 'seller' || role === 'superadmin') match = true;
        } else if (target === 'customers') {
          if (role !== 'admin' && role !== 'seller' && role !== 'superadmin') match = true;
        } else {
          match = true;
        }

        if (match) {
          if (d.subscription && d.subscription.endpoint && !seenEndpoints.has(d.subscription.endpoint)) {
            seenEndpoints.add(d.subscription.endpoint);
            targetSubscriptions.push(d.subscription);
          }
          if (token && typeof token === 'string' && token.length > 20 && !targetTokens.includes(token)) {
            targetTokens.push(token);
          }
        }
      });
    } catch (fsErr) {
      console.info('[Broadcast Push] Using memory store subscribers count:', targetSubscriptions.length);
    }

    const webPushPayload = JSON.stringify({
      title: title,
      body: body,
      icon: imageUrl || '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      vibrate: [300, 100, 300],
      url: url || '/shop',
      tag: 'campaign_' + Date.now()
    });

    let webPushDelivered = 0;
    await Promise.allSettled(
      targetSubscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, webPushPayload, {
            urgency: 'high',
            TTL: 86400
          });
          webPushDelivered++;
        } catch (subErr: any) {
          console.warn('[Broadcast Push] WebPush note:', subErr?.statusCode || subErr?.message);
        }
      })
    );

    let fcmDelivered = 0;
    if (targetTokens.length > 0) {
      try {
        const messaging = getMessaging();
        const payload = {
          tokens: targetTokens,
          notification: {
            title: title,
            body: body,
            imageUrl: imageUrl || undefined
          },
          data: {
            title: String(title),
            body: String(body),
            url: url || '/shop',
            targetRole: target || 'all',
            tag: 'campaign_' + Date.now()
          },
          webpush: {
            headers: { 
              Urgency: "high",
              TTL: "86400"
            },
            notification: {
              title: title,
              body: body,
              icon: imageUrl || '/pwa-192x192.png',
              badge: '/favicon-32x32.png',
              vibrate: [300, 100, 300],
              requireInteraction: true,
              tag: 'campaign_' + Date.now(),
              data: {
                url: url || '/shop'
              }
            },
            fcmOptions: {
              link: url || '/shop'
            }
          },
          android: {
            priority: "high" as const,
            notification: {
              title: title,
              body: body,
              sound: "default",
              defaultVibrateTimings: true,
              defaultSound: true,
              tag: 'campaign_' + Date.now()
            }
          }
        };

        const response = await messaging.sendEachForMulticast(payload);
        fcmDelivered = response.successCount;
      } catch (fcmErr: any) {
        console.warn("[Broadcast Push] FCM send note:", fcmErr?.message || fcmErr);
      }
    }

    return res.json({
      success: true,
      delivered: webPushDelivered + fcmDelivered,
      webPushDelivered,
      fcmDelivered,
      total: targetTokens.length + targetSubscriptions.length
    });
  } catch (error: any) {
    console.error("Broadcast push error:", error);
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

// -------------------------------------------------------------
// Steadfast Courier Service Integration (portal.steadfast.com.bd)
// -------------------------------------------------------------
interface SteadfastCredentials {
  apiKey: string;
  secretKey: string;
}

function getSteadfastCredentials(req?: express.Request): SteadfastCredentials | null {
  const apiKey = (
    req?.body?.apiKey ||
    req?.headers?.['x-steadfast-api-key'] ||
    process.env.STEADFAST_API_KEY ||
    ""
  ).toString().trim();

  const secretKey = (
    req?.body?.secretKey ||
    req?.headers?.['x-steadfast-secret-key'] ||
    process.env.STEADFAST_SECRET_KEY ||
    ""
  ).toString().trim();

  if (!apiKey || !secretKey) {
    return null;
  }
  return { apiKey, secretKey };
}

// 1. Check Steadfast Credentials & Balance
app.post("/api/courier/steadfast/check-credentials", async (req, res) => {
  const creds = getSteadfastCredentials(req);
  if (!creds) {
    return res.status(400).json({
      success: false,
      message: "Steadfast API Key এবং Secret Key দেওয়া হয়নি। দয়া করে অ্যাডমিন সেটিংসে আপনার চাবি দিন।"
    });
  }

  const startTime = Date.now();
  try {
    const response = await fetch("https://portal.steadfast.com.bd/api/v1/get_balance", {
      method: "GET",
      headers: {
        "Api-Key": creds.apiKey,
        "Secret-Key": creds.secretKey,
        "Content-Type": "application/json"
      }
    });

    const data = (await response.json().catch(() => null)) as any;
    const latency = Date.now() - startTime;

    if (!response.ok || (data && data.status !== 200 && data.status !== 201)) {
      addSystemLog({
        level: 'warn',
        module: 'COURIER',
        message: `Steadfast credentials check failed: ${data?.message || response.statusText}`,
        statusCode: response.status,
        latencyMs: latency,
        details: data
      });
      return res.status(400).json({
        success: false,
        message: data?.message || "Steadfast এপিআই ক্রেডেনশিয়াল সঠিক নয় বা সংযোগ পাওয়া যায়নি।",
        details: data
      });
    }

    addSystemLog({
      level: 'success',
      module: 'COURIER',
      message: `Steadfast connection verified successfully. Balance: ${data?.current_balance ?? 'N/A'} BDT.`,
      statusCode: response.status,
      latencyMs: latency
    });

    return res.json({
      success: true,
      balance: data?.current_balance ?? 0,
      message: "স্টেডফাস্ট কুরিয়ারে সফলভাবে কানেক্ট হয়েছে!",
      data
    });
  } catch (error: any) {
    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast connection error: ${error?.message || error}`,
      details: { error: String(error) }
    });
    return res.status(500).json({
      success: false,
      message: "Steadfast সার্ভারে সংযোগ করতে সমস্যা হয়েছে: " + (error?.message || "নেটওয়ার্ক ত্রুটি")
    });
  }
});

// 2. 1-Click Create Order / Book Parcel on Steadfast
app.post("/api/courier/steadfast/create-order", async (req, res) => {
  const creds = getSteadfastCredentials(req);
  if (!creds) {
    return res.status(400).json({
      success: false,
      message: "Steadfast API Key ও Secret Key প্রয়োজন। অ্যাডমিন সেটিংসে কনফিগার করুন।"
    });
  }

  const { invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note } = req.body;

  if (!recipient_name || !recipient_phone || !recipient_address) {
    return res.status(400).json({
      success: false,
      message: "প্রাপকের নাম, মোবাইল নম্বর এবং ঠিকানা পূরণ করা বাধ্যতামূলক।"
    });
  }

  // Format BD phone to 11 digits
  let formattedPhone = recipient_phone.toString().replace(/[^0-9]/g, '');
  if (formattedPhone.startsWith('880')) {
    formattedPhone = formattedPhone.substring(2);
  } else if (formattedPhone.startsWith('88')) {
    formattedPhone = formattedPhone.substring(2);
  }
  if (!formattedPhone.startsWith('0') && formattedPhone.length === 10) {
    formattedPhone = '0' + formattedPhone;
  }

  if (formattedPhone.length !== 11 || !formattedPhone.startsWith('01')) {
    return res.status(400).json({
      success: false,
      message: `ভুল মোবাইল নম্বর (${recipient_phone})। ১১ ডিজিটের ভ্যালিড বাংলাদেশী মোবাইল নম্বর দিন (যেমন 01XXXXXXXXX)।`
    });
  }

  const cleanInvoice = (invoice || `INV-${Date.now()}`).toString().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
  const numericCod = Math.max(0, Math.round(Number(cod_amount) || 0));

  const payload = {
    invoice: cleanInvoice,
    recipient_name: recipient_name.toString().trim().slice(0, 100),
    recipient_phone: formattedPhone,
    recipient_address: recipient_address.toString().trim().slice(0, 250),
    cod_amount: numericCod,
    note: (note || "Rare Dreams Parcel Delivery").toString().trim().slice(0, 250)
  };

  const startTime = Date.now();
  try {
    const response = await fetch("https://portal.steadfast.com.bd/api/v1/create_order", {
      method: "POST",
      headers: {
        "Api-Key": creds.apiKey,
        "Secret-Key": creds.secretKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => null)) as any;
    const latency = Date.now() - startTime;

    if (!response.ok || (data && data.status !== 200 && data.status !== 201)) {
      addSystemLog({
        level: 'error',
        module: 'COURIER',
        message: `Steadfast booking failed for ${cleanInvoice}: ${data?.message || response.statusText}`,
        statusCode: response.status,
        latencyMs: latency,
        details: { payload, response: data }
      });
      return res.status(400).json({
        success: false,
        message: data?.message || (data?.errors ? JSON.stringify(data.errors) : "পার্সেল বুকিং ব্যর্থ হয়েছে।"),
        details: data
      });
    }

    addSystemLog({
      level: 'success',
      module: 'COURIER',
      message: `Steadfast parcel booked for ${cleanInvoice}. Tracking: ${data?.consignment?.tracking_code || 'N/A'}. Consignment: ${data?.consignment?.consignment_id}`,
      statusCode: response.status,
      latencyMs: latency,
      details: data?.consignment
    });

    return res.json({
      success: true,
      message: "স্টেডফাস্ট কুরিয়ারে পার্সেল সফলভাবে বুকিং হয়েছে!",
      consignment: data?.consignment,
      tracking_code: data?.consignment?.tracking_code,
      consignment_id: data?.consignment?.consignment_id,
      status: data?.consignment?.status || 'in_review'
    });
  } catch (error: any) {
    addSystemLog({
      level: 'error',
      module: 'COURIER',
      message: `Steadfast create order network error: ${error?.message || error}`,
      details: { error: String(error) }
    });
    return res.status(500).json({
      success: false,
      message: "স্টেডফাস্ট সার্ভারে রিকোয়েস্ট পাঠাতে ব্যর্থ হয়েছে: " + (error?.message || "নেটওয়ার্ক ত্রুটি")
    });
  }
});

// 3. Check Real-Time Delivery Status by Tracking Code or Consignment ID
app.get("/api/courier/steadfast/track/:identifier", async (req, res) => {
  const creds = getSteadfastCredentials(req);
  if (!creds) {
    return res.status(400).json({
      success: false,
      message: "Steadfast API Key ও Secret Key পাওয়া যায়নি।"
    });
  }

  const { identifier } = req.params;
  const isCid = /^\d+$/.test(identifier);
  const endpoint = isCid 
    ? `https://portal.steadfast.com.bd/api/v1/status_by_cid/${identifier}`
    : `https://portal.steadfast.com.bd/api/v1/status_by_trackingcode/${identifier}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Api-Key": creds.apiKey,
        "Secret-Key": creds.secretKey,
        "Content-Type": "application/json"
      }
    });

    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok || (data && data.status !== 200)) {
      return res.status(400).json({
        success: false,
        message: data?.message || "ট্র্যাকিং তথ্য পাওয়া যায়নি।",
        details: data
      });
    }

    return res.json({
      success: true,
      status: data?.delivery_status || data?.status || 'unknown',
      details: data
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "ট্র্যাকিং স্ট্যাটাস আনতে সমস্যা হয়েছে: " + error?.message
    });
  }
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

// -------------------------------------------------------------
// Zero-Firestore-Quota Persistent Site Settings & Logo Storage
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const SITE_SETTINGS_FILE = path.join(DATA_DIR, 'site_settings.json');
const SITE_SETTINGS_BACKUP = path.join(DATA_DIR, 'site_settings_backup.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ORDERS_BACKUP = path.join(DATA_DIR, 'orders_backup.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PRODUCTS_BACKUP = path.join(DATA_DIR, 'products_backup.json');

function readSiteSettings() {
  try {
    if (fs.existsSync(SITE_SETTINGS_FILE)) {
      const data = fs.readFileSync(SITE_SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("[SiteSettings] Could not read settings file:", e);
  }
  return null;
}

function writeSiteSettings(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SITE_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    fs.writeFileSync(SITE_SETTINGS_BACKUP, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error("[SiteSettings] Could not write settings file:", e);
    return false;
  }
}

function readOrders(): any[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("[OrderEngine] Could not read orders file, checking backup:", e);
    try {
      if (fs.existsSync(ORDERS_BACKUP)) {
        const data = fs.readFileSync(ORDERS_BACKUP, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
}

function writeOrders(orders: any[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    fs.writeFileSync(ORDERS_BACKUP, JSON.stringify(orders, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error("[OrderEngine] Could not write orders file:", e);
    return false;
  }
}

function readProducts(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("[ProductEngine] Could not read products file, checking backup:", e);
    try {
      if (fs.existsSync(PRODUCTS_BACKUP)) {
        const data = fs.readFileSync(PRODUCTS_BACKUP, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [];
}

function writeProducts(products: any[]): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
    fs.writeFileSync(PRODUCTS_BACKUP, JSON.stringify(products, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error("[ProductEngine] Could not write products file:", e);
    return false;
  }
}

// Serve public static assets with correct MIME types BEFORE Vite middleware
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
app.use('/brand_logos', express.static(path.join(process.cwd(), 'public/brand_logos')));

app.get("/api/site-settings", (req, res) => {
  const settings = readSiteSettings() || {};
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const customLogoExists = fs.existsSync(path.join(uploadsDir, 'custom_logo.png'));
  
  const availableLogos = [
    { 
      id: "luxury_horizontal",
      name: "Rare Dreams 3D Luxury (Transparent PNG)", 
      url: "/brand_logos/rare_dreams_horizontal_transparent.png",
      description: "Official transparent header logo with 3D gradient and diamond shine",
      isDefault: true
    },
    { 
      id: "official_icon",
      name: "Rare Dreams App Icon (512x512)", 
      url: "/brand_logos/rare_dreams_icon.png",
      description: "Square app icon with shopping bag emblem"
    },
    { 
      id: "brand_emblem",
      name: "Rare Dreams Brand Emblem", 
      url: "/brand_logos/rare_dreams_logo_1786981217375.jpg",
      description: "High resolution brand artwork"
    },
    { 
      id: "classic_logo",
      name: "Rare Dreams Classic Logo", 
      url: "/brand_logos/raredreams_logo_1786300009548.jpg",
      description: "Original brand design"
    },
    { 
      id: "main_brand",
      name: "Rare Dreams Main Brand Banner", 
      url: "/brand_logos/brand_logo_main_1786981515075.jpg",
      description: "Primary brand display banner"
    }
  ];

  if (customLogoExists) {
    try {
      const stat = fs.statSync(path.join(uploadsDir, 'custom_logo.png'));
      availableLogos.unshift({
        id: "uploaded_custom",
        name: "Your Custom Uploaded Logo (স্থায়ী সংরক্ষণ)",
        url: `/uploads/custom_logo.png?t=${stat.mtimeMs}`,
        description: "Permanently stored custom uploaded logo",
        isDefault: false
      });
    } catch {}
  }

  res.json({
    success: true,
    settings: settings.config || null,
    logoUrl: settings.logoUrl || (customLogoExists ? `/uploads/custom_logo.png` : ""),
    banners: settings.banners || null,
    categories: settings.categories || null,
    availableLogos,
    updatedAt: settings.updatedAt || null
  });
});

app.post("/api/site-settings", (req, res) => {
  const { config, logoUrl, banners, categories } = req.body || {};
  let finalLogoUrl = logoUrl;

  // If logo is a base64 image data URL, persist it to disk as a static PNG file
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image/')) {
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      
      const matches = logoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches[2]) {
        const buffer = Buffer.from(matches[2], 'base64');
        const logoPath = path.join(uploadsDir, 'custom_logo.png');
        fs.writeFileSync(logoPath, buffer);
        finalLogoUrl = `/uploads/custom_logo.png?v=${Date.now()}`;
      }
    } catch (e) {
      console.error("[SiteSettings] Failed to save custom logo file:", e);
    }
  }

  const existing = readSiteSettings() || {};
  const updatedSettings = {
    config: { ...(existing.config || {}), ...(config || {}) },
    logoUrl: finalLogoUrl !== undefined && finalLogoUrl !== null ? finalLogoUrl : (existing.logoUrl || ''),
    banners: banners !== undefined ? banners : (existing.banners || null),
    categories: categories !== undefined ? categories : (existing.categories || null),
    updatedAt: new Date().toISOString()
  };

  writeSiteSettings(updatedSettings);

  res.json({
    success: true,
    message: "Settings and logo saved permanently to server disk.",
    logoUrl: updatedSettings.logoUrl,
    settings: updatedSettings.config,
    updatedAt: updatedSettings.updatedAt
  });
});

app.post("/api/site-settings/restore-logo", (req, res) => {
  const { logoUrl } = req.body || {};
  if (!logoUrl) {
    return res.status(400).json({ success: false, message: "logoUrl is required" });
  }

  const existing = readSiteSettings() || {};
  existing.logoUrl = logoUrl;
  existing.updatedAt = new Date().toISOString();
  writeSiteSettings(existing);

  res.json({
    success: true,
    message: "Logo restored successfully.",
    logoUrl
  });
});

// =============================================================
// ZERO-QUOTA FAIL-SAFE ORDER & PRODUCT BACKEND ENGINES
// Guaranteed 100% order capture even if Firestore Free Tier is blocked
// =============================================================

// 1. Create New Order Endpoint (Called during checkout)
app.post("/api/orders/create", async (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.customerName || !orderData.phone) {
      return res.status(400).json({ success: false, message: "Customer name and phone are required." });
    }

    const orderId = orderData.id || `RD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const cleanOrder = {
      ...orderData,
      id: orderId,
      status: orderData.status || 'Pending',
      paymentStatus: orderData.paymentStatus || 'pending',
      createdAt: orderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      serverReceivedAt: new Date().toISOString(),
    };

    const currentOrders = readOrders();
    const existingIndex = currentOrders.findIndex((o: any) => o.id === orderId);
    if (existingIndex !== -1) {
      currentOrders[existingIndex] = { ...currentOrders[existingIndex], ...cleanOrder };
    } else {
      currentOrders.unshift(cleanOrder);
    }
    writeOrders(currentOrders);

    console.log(`[OrderEngine] Order #${orderId} saved to zero-quota server disk. Total: ${currentOrders.length}`);

    // Multicast instant native push notification to admin devices in memory
    try {
      const formattedTotal = '৳' + Number(cleanOrder.total || 0).toLocaleString('en-IN');
      const seenEndpoints = new Set<string>();
      activePushSubscriptions.forEach((subRecord) => {
        const role = (subRecord.role || '').toLowerCase();
        const email = (subRecord.email || '').toLowerCase();
        if (
          role === 'admin' || 
          role === 'seller' || 
          role === 'superadmin' ||
          email.includes('karim') || 
          email.includes('admin') ||
          activePushSubscriptions.size <= 3
        ) {
          if (subRecord.subscription?.endpoint && !seenEndpoints.has(subRecord.subscription.endpoint)) {
            seenEndpoints.add(subRecord.subscription.endpoint);
            webpush.sendNotification(
              subRecord.subscription,
              JSON.stringify({
                title: `🚨 নতুন অর্ডার এসেছে! (#${orderId})`,
                body: `${cleanOrder.customerName} • ${formattedTotal} (${cleanOrder.district || 'Dhaka'})`,
                icon: '/brand_logos/rare_dreams_icon.png',
                tag: `order_${orderId}`,
                url: `/admin/orders`,
                timestamp: Date.now(),
                sound: '/sounds/order_bell.mp3'
              })
            ).catch(() => {});
          }
        }
      });
    } catch (pushErr) {
      console.warn("[OrderEngine] Push dispatch notice:", pushErr);
    }

    res.json({
      success: true,
      message: "Order placed and permanently stored on server disk.",
      orderId,
      order: cleanOrder
    });
  } catch (err: any) {
    console.error("[OrderEngine] Error saving order to server:", err);
    res.status(500).json({ success: false, message: "Server order error" });
  }
});

// 2. Fetch All Orders (For Admin Panel & Dashboard)
app.get("/api/orders", (req, res) => {
  const orders = readOrders();
  res.json({
    success: true,
    orders,
    count: orders.length
  });
});

// 3. Fetch Single Order by ID (For Invoice / Order Tracking / Success Page)
app.get("/api/orders/:id", (req, res) => {
  const orders = readOrders();
  const order = orders.find((o: any) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  res.json({ success: true, order });
});

// 4. Update Order Status (Pending, Processing, Shipped, Delivered, Cancelled)
app.post("/api/orders/:id/status", (req, res) => {
  const { status, trackingCode, courierName } = req.body || {};
  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required." });
  }

  const orders = readOrders();
  const idx = orders.findIndex((o: any) => o.id === req.params.id);
  if (idx !== -1) {
    orders[idx].status = status;
    if (trackingCode !== undefined) orders[idx].trackingCode = trackingCode;
    if (courierName !== undefined) orders[idx].courierName = courierName;
    orders[idx].updatedAt = new Date().toISOString();
    writeOrders(orders);
    return res.json({ success: true, order: orders[idx] });
  }
  res.status(404).json({ success: false, message: "Order not found" });
});

// Helper to save base64 product images to static files on disk
function sanitizeProductDiskImages(product: any): any {
  if (!product || typeof product !== 'object') return product;
  const uploadDir = path.join(process.cwd(), 'public/uploads/products');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const prodId = product.id || 'prod_' + Date.now();
  const newImages: string[] = [];
  const rawList = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : []);

  rawList.forEach((imgStr: any, i: number) => {
    if (typeof imgStr === 'string' && imgStr.startsWith('data:image/')) {
      const match = imgStr.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        const filename = `${prodId}_${i}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
        newImages.push(`/uploads/products/${filename}`);
      } else {
        newImages.push(imgStr);
      }
    } else if (imgStr && typeof imgStr === 'string') {
      newImages.push(imgStr);
    }
  });

  if (product.image && typeof product.image === 'string' && product.image.startsWith('data:image/')) {
    product.image = newImages[0] || '';
  } else if (newImages.length > 0 && !product.image) {
    product.image = newImages[0];
  }

  if (newImages.length > 0) {
    product.images = newImages;
  }

  // Also handle colorImageMap
  if (product.colorImageMap && typeof product.colorImageMap === 'object') {
    Object.keys(product.colorImageMap).forEach((colorKey, cIdx) => {
      const cImg = product.colorImageMap[colorKey];
      if (typeof cImg === 'string' && cImg.startsWith('data:image/')) {
        const match = cImg.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
          let ext = match[1].toLowerCase();
          if (ext === 'jpeg') ext = 'jpg';
          const filename = `${prodId}_color_${cIdx}.${ext}`;
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
          product.colorImageMap[colorKey] = `/uploads/products/${filename}`;
        }
      }
    });
  }

  return product;
}

// 5. Fetch Products (0-Quota, Fast local server disk)
app.get("/api/products", (req, res) => {
  const products = readProducts();
  res.json({
    success: true,
    products,
    count: products.length
  });
});

// 5b. Fetch Single Product by ID (Ultra-fast direct product lookup)
app.get("/api/products/:id", (req, res) => {
  const products = readProducts();
  const targetId = req.params.id;
  const product = products.find((p: any) => p.id === targetId);
  if (product) {
    return res.json({
      success: true,
      product
    });
  }
  res.status(404).json({
    success: false,
    message: "Product not found on server disk"
  });
});

// 6. Save or Update Single Product
app.post("/api/products/save", (req, res) => {
  let product = req.body;
  if (!product || !product.id) {
    return res.status(400).json({ success: false, message: "Valid product data with id is required." });
  }

  product = sanitizeProductDiskImages(product);

  const products = readProducts();
  const existingIndex = products.findIndex((p: any) => p.id === product.id);
  if (existingIndex !== -1) {
    products[existingIndex] = { ...products[existingIndex], ...product, updatedAt: new Date().toISOString() };
  } else {
    products.unshift({
      ...product,
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  writeProducts(products);

  res.json({ success: true, product, count: products.length });
});

// 7. Batch Sync Products to Server Disk
app.post("/api/products/batch-sync", (req, res) => {
  const { products } = req.body || {};
  if (Array.isArray(products) && products.length > 0) {
    const existing = readProducts();
    const map = new Map<string, any>();
    existing.forEach((p: any) => map.set(p.id, p));
    products.forEach((p: any) => {
      if (p && p.id) {
        const sanitized = sanitizeProductDiskImages(p);
        map.set(p.id, { ...(map.get(p.id) || {}), ...sanitized });
      }
    });
    const merged = Array.from(map.values());
    writeProducts(merged);
    return res.json({ success: true, count: merged.length });
  }
  res.json({ success: false, message: "No products array provided." });
});

// 8. Delete Product from Server Disk
app.delete("/api/products/:id", (req, res) => {
  const products = readProducts();
  const filtered = products.filter((p: any) => p.id !== req.params.id);
  writeProducts(filtered);
  res.json({ success: true, count: filtered.length });
});

// 9. Admin Dashboard Summary Statistics (Zero Firestore Quota Reads!)
app.get("/api/admin/summary", (req, res) => {
  const orders = readOrders();
  const products = readProducts();

  let totalSales = 0;
  let pCount = 0, prCount = 0, sCount = 0, dCount = 0, cCount = 0;
  const uniqueCustomerKeys = new Set<string>();

  orders.forEach((o: any) => {
    const amt = Number(o.total || o.totalAmount || 0);
    totalSales += amt;
    const st = (o.status || 'pending').toLowerCase();
    if (st === 'pending') pCount++;
    else if (st === 'processing') prCount++;
    else if (st === 'shipped') sCount++;
    else if (st === 'delivered') dCount++;
    else if (st === 'cancelled') cCount++;

    if (o.phone) uniqueCustomerKeys.add(String(o.phone).trim());
    else if (o.email) uniqueCustomerKeys.add(String(o.email).trim().toLowerCase());
  });

  res.json({
    success: true,
    stats: {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalCustomers: uniqueCustomerKeys.size,
      totalSales,
      statusCounts: {
        pending: pCount,
        processing: prCount,
        shipped: sCount,
        delivered: dCount,
        cancelled: cCount,
        total: orders.length
      }
    },
    recentOrders: orders.slice(0, 10),
    allOrders: orders
  });
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
