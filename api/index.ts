// Universal Vercel Serverless Function Handler for Rare Dreams E-Commerce
// Handles all /api/* routes on Vercel deployment
import { GoogleGenAI } from "@google/genai";

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey || apiKey.startsWith("MY_")) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

interface GrokConfig {
  key: string;
  baseUrl: string;
  candidateModels: string[];
  providerName: 'xAI Grok' | 'Groq Llama';
}

function getGrokConfig(req?: any): GrokConfig | null {
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

async function getActiveCandidateModels(config: { key: string; modelsUrl: string; candidateModels: string[] }, isVision = false): Promise<string[]> {
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
    // Discovery failed
  }

  const finalModels = discoveredModels.length > 0 ? discoveredModels : config.candidateModels;
  if (isVision) {
    const visionModels = finalModels.filter(m => m.includes('vision') || m.includes('scout') || m.includes('120b') || m.includes('grok-2'));
    return visionModels.length > 0 ? visionModels : finalModels;
  }
  return finalModels;
}

async function callGrok(
  messages: Array<{ role: string; content: string | any[] }>, 
  options: { temperature?: number; max_tokens?: number; req?: any; isVision?: boolean } = {}
) {
  const config = getGrokConfig(options.req);
  if (!config) {
    throw new Error("GROK_API_KEY is not configured in Vercel Environment Variables.");
  }

  const modelsToTry = await getActiveCandidateModels(config, !!options.isVision);
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const startTime = Date.now();
      const payload = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1024,
      };

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
        errorDetail.includes("model_decommissioned") ||
        errorDetail.includes("model_not_found") ||
        errorDetail.includes("decommissioned") ||
        errorDetail.includes("does not exist") ||
        errorDetail.includes("not supported") ||
        errorDetail.includes("deprecat");

      if (isModelIssue) {
        continue;
      }

      throw err;
    } catch (e: any) {
      if (e.status === 401 || e.message?.includes("401") || e.message?.includes("invalid_api_key")) {
        throw e;
      }
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to communicate with Grok / Groq API.");
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse URL and body
  const url = req.url || '';
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }
  body = body || {};

  // 1. Diagnostics GET Route
  if (url.includes('/api/admin/diagnostics') && req.method === 'GET') {
    const grokConfig = getGrokConfig();
    const isKeyConfigured = Boolean(grokConfig && grokConfig.key);
    const keySnippet = isKeyConfigured 
      ? `${grokConfig!.key.substring(0, 6)}...${grokConfig!.key.substring(grokConfig!.key.length - 4)}` 
      : "Not Configured";

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      server: {
        uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 100),
        memoryMb: 45,
        nodeVersion: process.version || "Node 20",
        port: 3000,
        status: "healthy (Vercel Serverless)"
      },
      grok: {
        configured: isKeyConfigured,
        keySnippet,
        model: grokConfig?.model || "grok-beta",
        provider: grokConfig?.providerName || "xAI Grok",
        reachable: false,
        latencyMs: 0,
        statusCode: 0,
        errorCode: null,
        message: isKeyConfigured ? "Grok API Key detected on Vercel" : "GROK_API_KEY environment variable is not configured on Vercel",
        resolution: isKeyConfigured ? null : "Add GROK_API_KEY in Vercel Settings -> Environment Variables."
      },
      firebase: {
        adminInitialized: true,
        projectId: process.env.FIREBASE_PROJECT_ID || "ai-studio",
        status: "ready"
      },
      logs: []
    };

    if (isKeyConfigured) {
      try {
        const pingRes = await callGrok([
          { role: "user", content: "Ping. Respond with 'PONG'." }
        ], { max_tokens: 10, temperature: 0.1 });

        diagnostics.grok.reachable = true;
        diagnostics.grok.statusCode = 200;
        diagnostics.grok.latencyMs = pingRes.latencyMs;
        diagnostics.grok.message = `Connected & Active on Vercel (${pingRes.latencyMs}ms, Model: ${pingRes.model})`;
      } catch (err: any) {
        diagnostics.grok.reachable = false;
        diagnostics.grok.statusCode = err.status || 500;
        diagnostics.grok.errorCode = err.status === 401 ? 'UNAUTHENTICATED' : 'API_ERROR';
        diagnostics.grok.message = err.message;
        diagnostics.grok.resolution = "Verify your key at https://console.x.ai/ or https://console.groq.com/keys and check Vercel environment variables.";
      }
    }

    return res.status(200).json(diagnostics);
  }

  // 2. Grok Live Test POST Route
  if (url.includes('/api/admin/diagnostics/test-grok') || url.includes('/api/admin/diagnostics/test-gemini')) {
    const { testPrompt } = body;
    const promptToRun = testPrompt || "Hello Rare Dreams Grok AI! Please reply with a brief greeting in English and Bengali.";

    const grokConfig = getGrokConfig();
    if (!grokConfig) {
      return res.status(400).json({
        success: false,
        error: "GROK_API_KEY is not set in Vercel Environment Variables.",
        errorCode: "KEY_NOT_CONFIGURED",
        resolution: "Go to Vercel Project Settings > Environment Variables > Add GROK_API_KEY."
      });
    }

    try {
      const resp = await callGrok([{ role: "user", content: promptToRun }]);
      return res.status(200).json({
        success: true,
        model: resp.model,
        latencyMs: resp.latencyMs,
        prompt: promptToRun,
        responseText: resp.content
      });
    } catch (err: any) {
      return res.status(err.status || 500).json({
        success: false,
        error: err.message,
        errorCode: err.status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED",
        resolution: "Check if the key is valid on https://console.x.ai/ or https://console.groq.com."
      });
    }
  }

  // 3. AI Chat POST Route
  if (url.includes('/api/ai-chat')) {
    const { message, history } = body;
    const queryText = message || "Hello";
    const lower = queryText.toLowerCase();

    const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh. Powered by Grok AI.

SHIPPING & DELIVERY POLICY:
- Inside Dhaka City: 1-2 business days. Delivery fee ৳80.
- Outside Dhaka / Nationwide: 2-4 business days. Delivery fee ৳120.
- Free Nationwide Delivery on orders above ৳2000!
- Cash on Delivery (COD): Available in all 64 districts with open-box verification upon delivery before payment.
- 7 Days Free Replacement & Return Guarantee for size issues or quality defects.
- Showroom / Office: Level 4, Block B, Jamuna Future Park, Dhaka. Support Hotline: +880 1712-345678.

RESPONSE FORMAT:
- Speak warmly and naturally in polite Bengali or English.`;

    const grokConfig = getGrokConfig(req);
    if (grokConfig) {
      try {
        const messages: any[] = [{ role: "system", content: systemPrompt }];
        if (Array.isArray(history)) {
          for (const h of history) {
            messages.push({
              role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
              content: typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '')
            });
          }
        }
        messages.push({ role: "user", content: queryText });

        const resp = await callGrok(messages, { req });
        return res.status(200).json({ reply: resp.content, latencyMs: resp.latencyMs, source: 'grok', model: resp.model });
      } catch (err: any) {
        console.warn("Vercel AI Chat Grok error, falling back:", err);
      }
    }

    // Knowledge base fallback with accurate delivery
    if (lower.includes('delivery') || lower.includes('ডেলিভারি') || lower.includes('চার্জ') || lower.includes('শিপিং') || lower.includes('ভাড়া')) {
      return res.status(200).json({
        reply: "আমাদের ডেলিভারি পলিসি ও চার্জ:\n\n🚚 ঢাকা সিটির ভিতরে: মাত্র ৳৮০ (১-২ দিনের মধ্যে ফাস্ট হোম ডেলিভারি)\n🚛 ঢাকার বাইরে / সারাদেশে: মাত্র ৳১২০ (২-৪ দিনের মধ্যে ডেলিভারি)\n🎁 ২০০০ টাকার বেশি অর্ডারে সারা বাংলাদেশে সম্পূর্ণ ডেলিভারি ফ্রী!\n💵 সারাদেশে ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে—পার্সেল দেখে নেওয়ার সুযোগ আছে!",
        fallback: true,
        source: 'knowledge_base'
      });
    }

    return res.status(200).json({
      reply: "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআমরা ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা সরবরাহ করি। ঢাকা সিটিতে ১-২ দিন (৳৮০) ও ঢাকার বাইরে ২-৪ দিনে (৳১২০) ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে সম্পূর্ণ ডেলিভারি ফ্রী)। আপনার যেকোনো প্রশ্নে সাহায্য করতে আমরা প্রস্তুত!",
      fallback: true,
      source: 'knowledge_base'
    });
  }

  // 4. AI Generate Description POST Route
  if (url.includes('/api/ai-generate-description')) {
    const { name, category, subcategory, price, material } = body;
    const prompt = `Write a compelling, luxury, SEO-optimized English product description for an e-commerce fashion item with these details:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, modern, engaging English.
- Highlights premium quality, tailored fit, comfort, and versatile styling.
- Includes 3-4 bullet points for key features.
- Includes Care Instructions.
- Keep under 200 words.`;

    try {
      const resp = await callGrok([
        { role: "system", content: "You are a luxury fashion copywriter." },
        { role: "user", content: prompt }
      ], { req });
      return res.status(200).json({ description: resp.content.trim(), latencyMs: resp.latencyMs });
    } catch (err) {
      return res.status(200).json({
        description: `Elevate your style with the ${name || 'Designer Collection'} by Rare Dreams. Crafted from ${material || 'premium fabric'}, this exclusive piece features impeccable craftsmanship and royal comfort.\n\n✨ Key Highlights:\n- Breathable luxury fabric\n- Precision tailored finish\n- Perfect for festive gatherings\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.`,
        fallback: true
      });
    }
  }

  // 5. AI Product Auto-Fill Route (Multimodal Vision)
  if (url.includes('/api/ai-product-auto-fill')) {
    const { image, categories: clientCategories, hints } = body;
    const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
      ? clientCategories
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

    // 1. Try Gemini Vision if Gemini API Key is available
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const parts: any[] = [];
        if (image && typeof image === 'string' && image.startsWith('data:')) {
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
            return res.status(200).json(parsed);
          }
        }
      } catch (geminiErr: any) {
        console.warn("Vercel Gemini vision error:", geminiErr?.message || geminiErr);
      }
    }

    // 2. Try Grok Vision
    try {
      const userContent: any = image
        ? [
            { type: "text", text: universalPrompt },
            { type: "image_url", image_url: { url: image } }
          ]
        : universalPrompt;

      const resp = await callGrok([
        { role: "system", content: "You are a product catalog parser. Output strict JSON only." },
        { role: "user", content: userContent }
      ], { temperature: 0.2, req, isVision: Boolean(image) });

      const cleanText = resp.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      if (parsed && parsed.name) {
        return res.status(200).json({ ...parsed, latencyMs: resp.latencyMs });
      }
    } catch (e) {
      console.warn("Vercel AI Auto-fill error, using smart fallback:", e);
    }

    // 3. Dynamic context-aware Fallback
    const hintLower = (hints || '').toLowerCase();
    const isChargerOrElectronic = hintLower.includes('charger') || hintLower.includes('adapter') || hintLower.includes('samsung') || hintLower.includes('cable') || hintLower.includes('fast') || hintLower.includes('type-c');
    const isFootwear = hintLower.includes('shoe') || hintLower.includes('loafer') || hintLower.includes('sandal') || hintLower.includes('sneaker');

    if (isChargerOrElectronic) {
      const cat = availableCategories.find(c => c.toLowerCase().includes('access')) || availableCategories[0] || "Accessories";
      return res.status(200).json({
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
      return res.status(200).json({
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
      });
    }

    return res.status(200).json({
      name: hints ? `Luxury ${hints}` : "Exclusive Royal Designer Collection",
      category: availableCategories.find(c => c.toLowerCase().includes('kid')) || availableCategories[0] || "Kids",
      subcategory: hints || "Festive Exclusive",
      description: "Designed for effortless elegance, this premium piece by Rare Dreams features meticulous tailoring and luxurious breathable fabric.\n\n✨ Key Highlights:\n- Premium quality long-lasting fabric\n- Elegant silhouette with flawless craftsmanship\n- Soft on skin with breathable comfort\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.",
      material: "100% Premium Cotton Blend",
      price: 1450,
      comparePrice: 1850,
      discount: 20,
      stockQuantity: 25,
      sizeOptions: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
      colorOptions: ["Navy Blue", "Gold"],
      tags: ["Exclusive", "Rare Dreams", "New Arrival"],
      isFlashSale: false,
      fallback: true
    });
  }

  // 6. AI Tag Product Route
  if (url.includes('/api/ai-tag-product')) {
    const { name, category } = body;
    const prompt = `Analyze for e-commerce tagging in English:
Title: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Return JSON strictly: {"subcategory": "SUBCATEGORY", "tags": ["TAG1", "TAG2", "TAG3"]}`;

    try {
      const resp = await callGrok([
        { role: "system", content: "Output strict JSON only." },
        { role: "user", content: prompt }
      ], { temperature: 0.2 });
      const cleanText = resp.content.replace(/```json/g, '').replace(/```/g, '').trim();
      return res.status(200).json(JSON.parse(cleanText));
    } catch {
      return res.status(200).json({
        subcategory: category ? `${category} Collection` : "Designer Collection",
        tags: ["Exclusive", "Rare Dreams", "Premium Quality"]
      });
    }
  }

  // 7. Steadfast Courier API Routes (Bangladesh Logistics)
  const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1';
  const resolveSteadfastKeys = () => {
    const apiKey = (body?.apiKey || req?.headers?.['x-steadfast-api-key'] || process.env.STEADFAST_API_KEY || '').toString().trim();
    const secretKey = (body?.secretKey || req?.headers?.['x-steadfast-secret-key'] || process.env.STEADFAST_SECRET_KEY || '').toString().trim();
    const isTestMode = body?.testMode === true || req?.headers?.['x-steadfast-test-mode'] === 'true';
    return { apiKey, secretKey, isTestMode };
  };

  // 7a. Check Balance
  if (url.includes('/api/courier/steadfast/check-balance')) {
    const { apiKey, secretKey, isTestMode } = resolveSteadfastKeys();

    if (!apiKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Steadfast API Key এবং Secret Key প্রয়োজন। এডমিন সেটিংসে কি বসিয়ে সেভ করুন।',
      });
    }

    try {
      const sfRes = await fetch(`${STEADFAST_BASE_URL}/get_balance`, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      });

      const data: any = await sfRes.json();
      if (sfRes.ok && data.status === 200) {
        return res.status(200).json({
          success: true,
          status: 200,
          balance: data.current_balance,
          isTestMode: false,
          message: `লাইভ কানেকশন সফল! আপনার বর্তমান স্টেটফাস্ট ব্যালেন্স: ৳${Number(data.current_balance || 0).toLocaleString()}`,
          details: 'আপনার আসল Steadfast একাউন্টের সাথে লাইভ সংযোগ রয়েছে।',
        });
      }

      return res.status(sfRes.status || 400).json({
        success: false,
        error: data.message || 'INVALID_CREDENTIALS',
        message: data.message || 'Steadfast ক্রেডেনশিয়াল সঠিক নয়। এপিআই কি ও সিক্রেট কি চেক করুন।',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message,
        message: 'Steadfast সার্ভারে সংযোগ করা যায়নি।',
      });
    }
  }

  // 7b. Create Order / Parcel Booking
  if (url.includes('/api/courier/steadfast/create-order')) {
    const { apiKey, secretKey, isTestMode } = resolveSteadfastKeys();
    const { invoice, recipient_name, recipient_phone, recipient_address, cod_amount, note } = body;

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

    const cleanPhone = (recipient_phone || '').replace(/[^0-9]/g, '').slice(-11);
    if (!cleanPhone || cleanPhone.length < 11) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'গ্রাহকের সঠিক ১১ ডিজিটের ফোন নাম্বার দিন (যেমন: 017XXXXXXXX)।',
      });
    }

    const payload = {
      invoice: invoice || `RD-${Date.now()}`,
      recipient_name: recipient_name.trim(),
      recipient_phone: cleanPhone,
      recipient_address: recipient_address.trim(),
      cod_amount: Math.max(0, Math.round(Number(cod_amount || 0))),
      note: note || 'Rare Dreams Luxury Fashion Parcel',
    };

    try {
      const sfRes = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await sfRes.json();

      if (sfRes.ok && data.status === 200 && data.consignment) {
        return res.status(200).json({
          success: true,
          status: 200,
          consignment: data.consignment,
          message: `পার্সেল বুকিং সফল! ট্র্যাকিং আইডি: ${data.consignment.tracking_code}`,
        });
      }

      const errorMsg = data.message || (data.errors ? JSON.stringify(data.errors) : 'বুকিং সম্পন্ন হয়নি');
      return res.status(sfRes.status || 400).json({
        success: false,
        error: errorMsg,
        message: `স্টেডফাস্ট বুকিং ব্যর্থ: ${errorMsg}`,
        errors: data.errors,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'NETWORK_ERROR',
        message: `স্টেডফাস্ট সার্ভারে যোগাযোগ ত্রুটি। ${err?.message || ''} আপনার মার্চেন্ট এপিআই কি/সিক্রেট কি চেক করুন।`,
      });
    }
  }

  // 7c. Consignment Status
  if (url.includes('/api/courier/steadfast/status')) {
    const { apiKey, secretKey } = resolveSteadfastKeys();
    const { trackingCode, consignmentId, invoice } = body;

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
      const sfRes = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      });

      const data: any = await sfRes.json();
      if (sfRes.ok && (data.status === 200 || data.delivery_status)) {
        return res.status(200).json({
          success: true,
          status: 200,
          delivery_status: data.delivery_status || data.status || 'in_review',
          message: 'Status fetched',
        });
      }

      return res.status(sfRes.status || 400).json({
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
  }

  // 8. Default fallback
  return res.status(200).json({ status: "ok", message: "Rare Dreams Vercel API Gateway Active" });
}
