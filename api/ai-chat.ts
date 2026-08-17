/**
 * System prompt & Store Knowledge Base for Rare Dreams AI Assistant
 */
const SYSTEM_PROMPT = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh.

GENERAL KNOWLEDGE & CAPABILITY:
- You possess full general intelligence, general knowledge, world information, fashion knowledge, parenting advice, and lifestyle advice.
- When asked general questions (e.g., general knowledge, math, science, kids health/care, fashion styling, or chat), answer accurately, intelligently, and warmly in fluent Bengali or English.
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
   - Inside Dhaka: 1 - 2 business days. Delivery fee ৳60. FREE SHIPPING on orders over ৳2,000!
   - Outside Dhaka: 2 - 4 business days. Delivery fee ৳120. FREE SHIPPING on orders over ৳2,000!
   - Cash on Delivery (COD): Available all over Bangladesh.

4. RETURN & REPLACEMENT POLICY:
   - 7 Days Free Replacement & Return Guarantee for size issues or quality defects.

5. PAYMENT OPTIONS:
   - Cash on Delivery (COD), bKash, Nagad, Rocket, Credit/Debit Cards.

6. LOCATION & CREDENTIALS:
   - Showroom / Office: Level 4, Block B, Jamuna Future Park, Dhaka, Bangladesh.
   - Trade License: TRAD/DNCC/012984/2026 | DBID-2026-884129

RESPONSE FORMAT:
- Speak warmly and naturally in polite Bengali (or English if the user asks in English).
- Keep formatting clean with bullet points and friendly emojis where appropriate.
- Never sound generic or mechanical.`;

/**
 * Smart Bengali Fallback Function
 */
function getSmartFallback(query: string): string {
  const q = (query || '').toLowerCase();

  if (q.includes('তুমি কে') || q.includes('কে তুমি') || q.includes('who are you') || q.includes('आपका नाम') || q.includes('identity')) {
    return "আমি রেয়ার ড্রিমস (Rare Dreams) এর অফিশিয়াল এআই অ্যাসিস্ট্যান্ট & পার্সোনাল শপিং কনসালট্যান্ট! 🌟\n\nআমি আপনাকে বাচ্চার পোশাকের সাইজ সিলেক্ট, লেটেস্ট কালেকশন দেখায় সাহায্য, ডেলিভারি বা সাধারণ যেকোনো প্রশ্নের উত্তর দিতে পারি। বলুন, কীভাবে সাহায্য করবো?";
  } else if (q.includes('হাই') || q.includes('হ্যালো') || q.includes('hello') || q.includes('hi') || q.includes('সালাম')) {
    return "আসসালামু আলাইকুম! রেয়ার ড্রিমসে (Rare Dreams) আপনাকে স্বাগতম। 🌸\n\nআজকে আপনাকে কীভাবে সাহায্য করতে পারি? যেকোনো প্রোডাক্ট, সাইজ, ডেলিভারি বা পছন্দের পোশাক সম্পর্কে জানতে আমাকে লিখুন!";
  } else if (q.includes('size') || q.includes('সাইজ') || q.includes('মাপ')) {
    return "আমাদের প্রতিটি ড্রেসের সাথেই একুরেট সাইজ চার্ট দেয়া আছে। বাচ্চার বর্তমান বয়স ও উচ্চতা জানালে আমরা একদম পারফেক্ট সাইজ সিলেক্ট করে দিতে পারবো!";
  } else if (q.includes('return') || q.includes('রিটার্ন') || q.includes('চেঞ্জ') || q.includes('বদলা') || q.includes('ফেরত')) {
    return "পণ্য হাতে পাওয়ার পর পছন্দ না হলে বা সাইজ না মিললে ৭ দিনের সহজ ও ফ্রি রিপ্লেসমেন্ট গ্যারান্টি পাবেন!";
  } else if (q.includes('price') || q.includes('দাম') || q.includes('কত') || q.includes('টাকা')) {
    return "আমাদের বয়েজ, গার্লস, বেবি ও প্যান্ট-জুতার কালেকশনের দাম ওয়েবসাইটে আকর্ষণীয় ডিসকাউন্ট সহ দেখানো আছে। আপনার কোনো নির্দিষ্ট পোশাকের দাম জানতে নাম লিখুন!";
  } else if (q.includes('delivery') || q.includes('ডেলিভারি') || q.includes('চার্জ') || q.includes('শিপিং')) {
    return "ঢাকা সিটিতে ১-২ দিন (চার্জ ৳৬০) এবং ঢাকার বাইরে ২-৪ দিনে (চার্জ ৳১২০) ক্যাশ অন ডেলিভারিতে প্রিমিয়াম ড্রেস পাঠানো হয়। ২০০০ টাকার উপরে অর্ডারে সম্পূর্ণ ডেলিভারি ফ্রী! 🚚";
  } else if (q.includes('location') || q.includes('শো-রুম') || q.includes('ঠিকানা')) {
    return "আমাদের শো-রুম ও অফিস ঠিকানা: লেভেল ৪, ব্লক বি, যমুনা ফিউচার পার্ক, ঢাকা। ট্রেড লাইসেন্স নং: TRAD/DNCC/012984/2026।";
  }

  return "রেয়ার ড্রিমসে (Rare Dreams) আপনার প্রশ্নটির জন্য ধন্যবাদ! 🌸\n\nআমাদের কাছে ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা রয়েছে। ঢাকা সিটিতে ১-২ দিন ও ঢাকার বাইরে ২-৪ দিনে ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে ডেলিভারি ফ্রী)। আপনার নির্দিষ্ট কোনো সাহায্য লাগলে বিস্তারিত লিখুন!";
}

/**
 * Vercel Serverless Handler
 */
export default async function handler(req: any, res: any) {
  // CORS Headers
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
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }
  const { message } = body || {};
  const query = message || "Hello";

  // 1. Try Groq API (High Speed Llama 3.3 70B)
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey && groqApiKey.trim() !== '') {
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const replyText = groqData.choices?.[0]?.message?.content;
        if (replyText) {
          return res.status(200).json({ reply: replyText, provider: 'groq' });
        }
      }
    } catch (err) {
      console.warn("Groq API error in Vercel function:", err);
    }
  }

  // 2. Try Gemini API
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey && geminiApiKey.trim() !== '') {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: query }]
              }
            ],
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            }
          })
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return res.status(200).json({ reply: text, provider: 'gemini' });
        }
      }
    } catch (err) {
      console.warn("Gemini REST API error in Vercel function:", err);
    }
  }

  // 3. Fallback Knowledge Base Response
  return res.status(200).json({
    reply: getSmartFallback(query),
    provider: 'fallback'
  });
}
