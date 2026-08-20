// Vercel Serverless Function Handler for /api/ai-product-auto-fill
// Supports Gemini Vision, Grok Vision, and Groq Vision
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

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
  modelsUrl: string;
  candidateModels: string[];
  providerName: string;
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

async function getActiveCandidateModels(config: GrokConfig, isVision = false): Promise<string[]> {
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
          const prioritized = isVision
            ? config.candidateModels.filter(m => m.includes('vision'))
            : config.candidateModels;
          const matched = prioritized.filter(p => activeIds.includes(p));
          const rest = activeIds.filter(a => !prioritized.includes(a));
          discoveredModels = [...matched, ...rest];
        }
      }
    }
  } catch {
    // Discovery failed
  }

  return discoveredModels.length > 0 ? discoveredModels : config.candidateModels;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-grok-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }

  const { image, categories: clientCategories, hints } = body || {};
  const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
    ? clientCategories.map((c: any) => typeof c === 'string' ? c : c.title || c.name).filter(Boolean)
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

  // 1. Try Gemini Vision First
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
          return res.status(200).json({
            ...parsed,
            source: 'gemini',
            latencyMs: Date.now() - startTime
          });
        }
      }
    } catch (geminiErr: any) {
      console.warn("Vercel Gemini vision auto-fill error:", geminiErr?.message || geminiErr);
    }
  }

  // 2. Try Grok / Groq Vision
  const grokConfig = getGrokConfig(req);
  if (grokConfig) {
    const isVision = Boolean(image && typeof image === 'string' && (image.startsWith('data:') || image.startsWith('http')));
    const candidateModels = await getActiveCandidateModels(grokConfig, isVision);

    const userContent: any = isVision
      ? [
          { type: "text", text: universalPrompt },
          { type: "image_url", image_url: { url: image } }
        ]
      : universalPrompt;

    for (const model of candidateModels) {
      try {
        const response = await fetch(grokConfig.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${grokConfig.key}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a product catalog parser. Output strict JSON only." },
              { role: "user", content: userContent }
            ],
            temperature: 0.2,
            max_tokens: 1000
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          const cleanText = content.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.name) {
            return res.status(200).json({
              ...parsed,
              source: grokConfig.providerName,
              model: data.model || model,
              latencyMs: Date.now() - startTime
            });
          }
        }
      } catch (err) {
        console.warn(`Model ${model} failed, trying next:`, err);
      }
    }
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
    colorOptions: ["Navy Blue", "Black", "Gold"],
    tags: ["Exclusive", "New Arrival", "Rare Dreams"],
    isFlashSale: false,
    fallback: true
  });
}
