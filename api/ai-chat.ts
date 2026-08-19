// Vercel Serverless Function Handler for /api/ai-chat (Grok AI)

interface GrokConfig {
  key: string;
  baseUrl: string;
  candidateModels: string[];
  providerName: string;
}

function getGrokConfig(): GrokConfig | null {
  const envKey = (
    process.env.GROK_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();

  if (!envKey || envKey.startsWith("MY_")) {
    return null;
  }

  if (envKey.startsWith("gsk_")) {
    return {
      key: envKey,
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      candidateModels: ["llama-3.1-8b-instant", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"],
      providerName: "Groq Llama"
    };
  } else {
    return {
      key: envKey,
      baseUrl: "https://api.x.ai/v1/chat/completions",
      candidateModels: ["grok-beta", "grok-2-latest", "grok-2-1212"],
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

  const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh. Powered by Grok AI. Speak warmly and naturally in polite Bengali or English.`;

  const config = getGrokConfig();
  if (config) {
    for (const model of config.candidateModels) {
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

        if (response.status === 404) {
          continue;
        }
      } catch (e) {
        console.warn("Grok model error, trying next:", e);
      }
    }
  }

  return res.status(200).json({
    reply: "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআমরা ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা সরবরাহ করি। ঢাকা সিটিতে ১-২ দিন ও ঢাকার বাইরে ২-৪ দিনে ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে ডেলিভারি ফ্রী)। আপনার যেকোনো প্রশ্নে সাহায্য করতে আমরা প্রস্তুত!",
    fallback: true,
    source: 'knowledge_base'
  });
}
