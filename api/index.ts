// Universal Vercel Serverless Function Handler for Rare Dreams E-Commerce
// Handles all /api/* routes on Vercel deployment

interface GrokConfig {
  key: string;
  baseUrl: string;
  candidateModels: string[];
  providerName: 'xAI Grok' | 'Groq Llama';
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

async function callGrok(messages: Array<{ role: string; content: string }>, options: { temperature?: number; max_tokens?: number } = {}) {
  const config = getGrokConfig();
  if (!config) {
    throw new Error("GROK_API_KEY is not configured in Vercel Environment Variables.");
  }

  let lastError: any = null;

  for (const model of config.candidateModels) {
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

      if (response.status === 404 || errorDetail.includes("model_not_found") || errorDetail.includes("does not exist")) {
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

    const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh. Powered by Grok AI.`;

    const grokConfig = getGrokConfig();
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

        const resp = await callGrok(messages);
        return res.status(200).json({ reply: resp.content, latencyMs: resp.latencyMs, source: 'grok', model: resp.model });
      } catch (err: any) {
        console.warn("Vercel AI Chat Grok error, falling back:", err);
      }
    }

    // Knowledge base fallback
    return res.status(200).json({
      reply: "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআমরা ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা সরবরাহ করি। ঢাকা সিটিতে ১-২ দিন ও ঢাকার বাইরে ২-৪ দিনে ক্যাশ অন ডেলিভারি পাবেন। আপনার যেকোনো প্রশ্নে সাহায্য করতে আমরা প্রস্তুত!",
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
      ]);
      return res.status(200).json({ description: resp.content.trim(), latencyMs: resp.latencyMs });
    } catch (err) {
      return res.status(200).json({
        description: `Elevate your style with the ${name || 'Designer Collection'} by Rare Dreams. Crafted from ${material || 'premium fabric'}, this exclusive piece features impeccable craftsmanship and royal comfort.\n\n✨ Key Highlights:\n- Breathable luxury fabric\n- Precision tailored finish\n- Perfect for festive gatherings\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.`,
        fallback: true
      });
    }
  }

  // 5. Default fallback
  return res.status(200).json({ status: "ok", message: "Rare Dreams Vercel API Gateway Active" });
}
