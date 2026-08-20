// Vercel Serverless Function Handler for /api/ai-generate-description
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
      candidateModels: ["grok-2-latest", "grok-2", "grok-beta"],
      providerName: "xAI Grok"
    };
  }
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }

  const { name, category, subcategory, price, material } = body || {};
  const prompt = `Write a compelling, luxury, SEO-optimized English product description for an e-commerce fashion item with these details:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, modern, engaging English.
- Highlights premium quality, tailored fit, comfort, and versatile styling.
- Includes 3-4 bullet points for key features (✨ Key Highlights).
- Includes Care Instructions (🧺 Care Instructions).
- Keep under 200 words.`;

  // 1. Try Gemini
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const resp = await gemini.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      const text = resp.text || '';
      if (text) {
        return res.status(200).json({ description: text.trim(), source: 'gemini' });
      }
    } catch (e) {
      console.warn("Gemini description error:", e);
    }
  }

  // 2. Try Grok
  const config = getGrokConfig(req);
  if (config) {
    for (const model of config.candidateModels) {
      try {
        const response = await fetch(config.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.key}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "You are a luxury fashion copywriter." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          if (content) {
            return res.status(200).json({ description: content.trim(), source: 'grok', model });
          }
        }
      } catch (err) {
        // try next
      }
    }
  }

  // Fallback
  return res.status(200).json({
    description: `Elevate your style with the ${name || 'Designer Collection'} by Rare Dreams. Crafted from ${material || 'premium fabric'}, this exclusive piece features impeccable craftsmanship and royal comfort.\n\n✨ Key Highlights:\n- Breathable luxury fabric\n- Precision tailored finish\n- Perfect for festive gatherings and celebrations\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.`,
    fallback: true
  });
}
