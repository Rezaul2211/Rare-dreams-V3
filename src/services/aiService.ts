/**
 * AI Service for Rare Dreams Customer Support Chat
 * Supports Groq API (Llama 3.3 70B), Gemini API, and Smart Local Fallback.
 * Ensures smooth thinking animation state and robust error handling.
 */

export interface AiChatResponse {
  reply: string;
  provider?: 'gemini' | 'fallback';
  error?: string;
}

export interface SendMessageOptions {
  message: string;
  minThinkingMs?: number; // Minimum duration for thinking animation (default: 1200ms)
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
}

/**
 * Send user prompt to the backend AI endpoint (/api/ai-chat).
 * Handles API fetch, thinking state timing, and error resilience.
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

  // Promise for artificial minimum delay to showcase thinking state smoothly
  const delayPromise = new Promise(resolve => setTimeout(resolve, minThinkingMs));

  // Request to API endpoint (/api/ai-chat)
  const apiPromise = (async (): Promise<AiChatResponse> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: trimmed, history })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      if (!data || typeof data.reply !== 'string') {
        throw new Error('Invalid JSON structure received from AI API');
      }

      return {
        reply: data.reply,
        provider: data.provider || 'gemini'
      };
    } catch (err: any) {
      console.warn("AI Service API Fetch warning:", err?.message || err);
      // Client-side fallback if server is unreachable
      return {
        reply: getClientSmartFallback(trimmed),
        provider: 'fallback',
        error: err?.message
      };
    }
  })();

  // Wait for both API response and minimum thinking timer
  const [result] = await Promise.all([apiPromise, delayPromise]);
  return result;
}

/**
 * Smart English client-side fallback knowledge base
 * Used when network or server is offline
 */
function getClientSmartFallback(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('who are you') || q.includes('identity')) {
    return "I am Rare Dreams Official AI Shopping Consultant! 🌟\n\nI can assist you with sizing recommendations, latest premium collections, shipping details, or product questions.";
  } else if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return "Hello! Welcome to Rare Dreams. 🌸\n\nHow can I help you today? Ask me about sizes, new arrivals, or delivery terms!";
  } else if (q.includes('size') || q.includes('fit') || q.includes('chart')) {
    return "Each product features an accurate size guide chart. Please share your child's age or height and we will help you find the ideal fit!";
  } else if (q.includes('return') || q.includes('exchange') || q.includes('refund')) {
    return "We offer a 7-day hassle-free replacement policy if you are not completely satisfied with your order or need another size!";
  } else if (q.includes('delivery') || q.includes('shipping') || q.includes('charge')) {
    return "Delivery is 1-2 days inside Dhaka (৳60) and 2-4 days outside Dhaka (৳120). Free shipping is automatically applied on orders over ৳2000! 🚚";
  } else if (q.includes('location') || q.includes('showroom') || q.includes('address')) {
    return "Our showroom address: Level 4, Block B, Jamuna Future Park, Dhaka. Trade License: TRAD/DNCC/012984/2026.";
  }

  return "Thank you for reaching out to Rare Dreams! You can also contact our team directly via WhatsApp for instant live support.";
}
