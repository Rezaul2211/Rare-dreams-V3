/**
 * AI Service for Rare Dreams Customer Support Chat
 * Supports Grok AI (xAI Grok & Groq Llama) with Serverless & Client Direct Fallback
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
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
}

let cachedGrokKey: string | null = null;

async function getStoredGrokKey(): Promise<string | null> {
  if (cachedGrokKey) return cachedGrokKey;
  try {
    const docRef = doc(db, 'system_settings', 'integrations');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const key = (data.grokApiKey || data.xaiApiKey || data.groqApiKey || '').trim();
      if (key) {
        cachedGrokKey = key;
        return key;
      }
    }
  } catch (e) {
    console.warn("Could not retrieve Grok key from Firestore:", e);
  }
  return null;
}

async function callDirectGrok(key: string, query: string): Promise<string> {
  const isGroq = key.startsWith('gsk_');
  const endpoint = isGroq 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://api.x.ai/v1/chat/completions';
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'grok-beta';

  const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh. Powered by Grok AI. Speak warmly and naturally in polite Bengali or English.`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    throw new Error(`Direct Grok error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Send user prompt to the backend AI endpoint (/api/ai-chat) with direct client fallback
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

  const delayPromise = new Promise(resolve => setTimeout(resolve, minThinkingMs));

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
        if (data && typeof data.reply === 'string') {
          return {
            reply: data.reply,
            provider: data.source === 'grok' ? 'grok' : 'fallback'
          };
        }
      }
    } catch (err: any) {
      console.warn("Backend /api/ai-chat request failed, trying client fallback:", err);
    }

    // 2. Direct client Grok AI call if saved key exists
    try {
      const grokKey = await getStoredGrokKey();
      if (grokKey) {
        const replyText = await callDirectGrok(grokKey, trimmed);
        if (replyText) {
          return {
            reply: replyText,
            provider: 'grok'
          };
        }
      }
    } catch (directErr: any) {
      console.warn("Direct Grok call failed:", directErr);
    }

    // 3. Fallback to smart knowledge base
    return {
      reply: getClientSmartFallback(trimmed),
      provider: 'fallback'
    };
  })();

  const [result] = await Promise.all([apiPromise, delayPromise]);
  return result;
}

/**
 * Smart English & Bengali client-side fallback knowledge base
 */
function getClientSmartFallback(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('তুমি কে') || q.includes('who are you') || q.includes('identity')) {
    return "আমি রেয়ার ড্রিমস (Rare Dreams) এর অফিশিয়াল গ্রোক এআই (Grok AI) অ্যাসিস্ট্যান্ট! 🌟\n\nআমি আপনাকে বাচ্চার পোশাকের সাইজ সিলেক্ট, লেটেস্ট কালেকশন দেখায় সাহায্য, ডেলিভারি বা সাধারণ যেকোনো প্রশ্নের উত্তর দিতে পারি। বলুন, কীভাবে সাহায্য করবো?";
  } else if (q.includes('হাই') || q.includes('হ্যালো') || q.includes('hello') || q.includes('hi') || q.includes('সালাম')) {
    return "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআজকে আপনাকে কীভাবে সাহায্য করতে পারি? যেকোনো প্রোডাক্ট, সাইজ, ডেলিভারি বা পছন্দের পোশাক সম্পর্কে জানতে আমাকে লিখুন!";
  } else if (q.includes('size') || q.includes('সাইজ') || q.includes('মাপ')) {
    return "আমাদের প্রতিটি ড্রেসের সাথেই একুরেট সাইজ চার্ট দেয়া আছে। বাচ্চার বর্তমান বয়স ও উচ্চতা জানালে আমরা একদম পারফেক্ট সাইজ সিলেক্ট করে দিতে পারবো!";
  } else if (q.includes('return') || q.includes('রিটার্ন') || q.includes('চেঞ্জ') || q.includes('ফেরত')) {
    return "পণ্য হাতে পাওয়ার পর পছন্দ না হলে বা সাইজ না মিললে ৭ দিনের সহজ ও ফ্রি রিপ্লেসমেন্ট গ্যারান্টি পাবেন!";
  } else if (q.includes('delivery') || q.includes('ডেলিভারি') || q.includes('চার্জ')) {
    return "ঢাকা সিটিতে ১-২ দিন (চার্জ ৳৬০) এবং ঢাকার বাইরে ২-৪ দিনে (চার্জ ৳১২০) ক্যাশ অন ডেলিভারিতে প্রিমিয়াম ড্রেস পাঠানো হয়। ২০০০ টাকার উপরে অর্ডারে সম্পূর্ণ ডেলিভারি ফ্রী! 🚚";
  } else if (q.includes('location') || q.includes('শো-রুম') || q.includes('ঠিকানা')) {
    return "আমাদের শো-রুম ও অফিস ঠিকানা: লেভেল ৪, ব্লক বি, যমুনা ফিউচার পার্ক, ঢাকা। ট্রেড লাইসেন্স নং: TRAD/DNCC/012984/2026।";
  }

  return "রেয়ার ড্রিমসে (Rare Dreams) আপনার প্রশ্নটির জন্য ধন্যবাদ! 🌸\n\nআমাদের কাছে ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা রয়েছে। ঢাকা সিটিতে ১-২ দিন ও ঢাকার বাইরে ২-৪ দিনে ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে ডেলিভারি ফ্রী)। আপনার নির্দিষ্ট কোনো সাহায্য লাগলে বিস্তারিত লিখুন!";
}
