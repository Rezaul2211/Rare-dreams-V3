// Vercel Serverless Function Handler for /api/ai-chat (Grok AI)

interface GrokConfig {
  key: string;
  baseUrl: string;
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
      candidateModels: ["grok-2-latest", "grok-2", "grok-beta"],
      providerName: "xAI Grok"
    };
  }
}

async function getActiveCandidateModels(config: { key: string; modelsUrl: string; candidateModels: string[] }): Promise<string[]> {
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

  return discoveredModels.length > 0 ? discoveredModels : config.candidateModels;
}

export default async function handler(req: any, res: any) {
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }
  const { message, history } = body || {};
  const query = message || "Hello";
  const lower = query.toLowerCase();

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

  const config = getGrokConfig(req);
  if (config) {
    const modelsToTry = await getActiveCandidateModels(config);
    for (const model of modelsToTry) {
      try {
        const startTime = Date.now();
        const messages: any[] = [{ role: "system", content: systemPrompt }];

        if (Array.isArray(history)) {
          for (const h of history) {
            messages.push({
              role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
              content: typeof h.content === 'string' ? h.content : (h.parts?.[0]?.text || '')
            });
          }
        }
        messages.push({ role: "user", content: query });

        const response = await fetch(config.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.key}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 1024
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "";
          return res.status(200).json({
            reply: content,
            latencyMs: Date.now() - startTime,
            source: 'grok',
            model: data.model || model
          });
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
      } catch (e) {
        console.warn("Grok model error, trying next:", e);
      }
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
