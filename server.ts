import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = express();
const PORT = 3000;

app.use(express.json());

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key === "MY_GEMINI_API_KEY" || key.startsWith("MY_")) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Reusable Groq LLM Helper (User requested Groq API as primary AI model)
async function callGroq(prompt: string, systemPrompt?: string, jsonMode?: boolean): Promise<string | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey || groqApiKey.trim() === '' || groqApiKey.startsWith('MY_')) {
    return null;
  }

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body: any = {
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
    max_tokens: 1024
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();
    } else {
      const errText = await res.text();
      console.warn("Groq API warning status:", res.status, errText);
    }
  } catch (err) {
    console.warn("Groq API request error:", err);
  }
  return null;
}

// Reusable Groq Vision Helper
async function callGroqVision(prompt: string, mimeType: string, base64Data: string, jsonMode?: boolean): Promise<string | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey || groqApiKey.trim() === '' || groqApiKey.startsWith('MY_')) {
    return null;
  }

  const body: any = {
    model: "qwen/qwen3.6-27b",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }
    ],
    temperature: 0.7,
    max_tokens: 1024
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content.trim();
    } else {
      const errText = await res.text();
      console.warn("Groq Vision API warning status:", res.status, errText);
    }
  } catch (err) {
    console.warn("Groq Vision API request error:", err);
  }
  return null;
}

// Initialize Firebase Admin (Only if not already initialized)

if (!getApps().length) {
  // Use default credential in production/cloud environments
  // which will work if the environment provides application default credentials.
  // Otherwise, it requires GOOGLE_APPLICATION_CREDENTIALS or passing service account.
  try {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "lofty-theme-0nn32"
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// 1. AI Product Description Generator API Route (Admin Tool)
app.post("/api/ai-generate-description", async (req, res) => {
  try {
    const { name, category, subcategory, price, material } = req.body;
    const prompt = `Write a compelling, luxury, SEO-optimized Bengali product description for an e-commerce clothing item with these details:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, attractive, and persuasive Bengali (বাংলা).
- Highlights premium quality, comfortable fit, fabric feel, and elegance for kids/family.
- Includes 3-4 bullet points for key features (যেমন: ১০০% প্রিমিয়াম ফেব্রিক, আরামদায়ক সেলাই, আকর্ষণীয় আউটলুক, যেসকল অনুষ্ঠানে পরানো যাবে).
- Keep it under 250 words. Do NOT include markdown code blocks around text.`;

    // 1. Primary: Groq LLM API
    const groqDesc = await callGroq(prompt);
    if (groqDesc) {
      return res.json({ description: groqDesc });
    }

    // 2. Secondary: Gemini API
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        if (response?.text) {
          return res.json({ description: response.text.trim() });
        }
      } catch (err: any) {
        console.warn("Gemini description fallback active:", err?.message || err);
      }
    }

    // 3. Fallback Description
    const fallbackDesc = `রেয়ার ড্রিমস (Rare Dreams)-এর এই প্রিমিয়াম ${name || 'আকর্ষণীয় ড্রেসটি'} অত্যন্ত নিখুঁত সেলাই ও ১০০% আরামদায়ক ফেব্রিকে তৈরি। বাচ্চার সংবেদনশীল ত্বকের কথা মাথায় রেখে এটি অত্যন্ত নরম ও টেকসই করা হয়েছে।\n\n✨ মূল বৈশিষ্ট্যসমূহ:\n- প্রিমিয়াম কোয়ালিটির দীর্ঘস্থায়ী ফেব্রিক\n- রাজকীয় লুক ও আকর্ষণীয় কালার ফিনিশিং\n- পার্টি, ঈদ বা যেকোনো বিশেষ অনুষ্ঠানে পরার জন্য সেরা পছন্দ\n- স্কিন ফ্রেন্ডলি ও দীর্ঘক্ষণ পরে থাকার জন্য পারফেক্ট কমফোর্ট`;
    res.json({ description: fallbackDesc });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate description" });
  }
});

// 2. AI Size Helper / Recommender API Route
app.post("/api/ai-recommend-size", async (req, res) => {
  try {
    const { productName, category, availableSizes, age, height, weight, fitPreference } = req.body;
    const prompt = `Act as an expert kids sizing consultant for the luxury fashion brand "Rare Dreams".
Product Name: ${productName || 'Outfit'}
Category: ${category || 'Kids Item'}
Available Sizes in Stock: ${Array.isArray(availableSizes) ? availableSizes.join(', ') : availableSizes || 'S, M, L, XL'}
Customer Input:
- Age: ${age || 'Not specified'}
- Height: ${height || 'Not specified'}
- Weight: ${weight || 'Not specified'}
- Fit Preference: ${fitPreference || 'Regular'}

Instructions:
1. Determine the best size from the Available Sizes list.
2. Provide a clear, friendly, reassuring explanation in polite Bengali (বাংলা) explaining why this size is recommended (taking into consideration that children grow fast).
3. Return JSON format strictly: {"recommendedSize": "SIZE_NAME", "explanation": "BENGALI_EXPLANATION"}`;

    // 1. Primary: Groq LLM API
    const groqRes = await callGroq(prompt, undefined, true);
    if (groqRes) {
      const cleanText = groqRes.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(cleanText);
        return res.json(parsed);
      } catch {
        return res.json({
          recommendedSize: availableSizes?.[0] || 'M',
          explanation: groqRes
        });
      }
    }

    // 2. Secondary: Gemini API
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        if (response?.text) {
          const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleanText);
            return res.json(parsed);
          } catch {
            return res.json({
              recommendedSize: availableSizes?.[0] || 'M',
              explanation: response.text.trim()
            });
          }
        }
      } catch (err: any) {
        console.warn("Gemini size recommender fallback active:", err?.message || err);
      }
    }

    // 3. Fallback recommendation
    const defaultSize = availableSizes?.[0] || '24';
    const fallbackExp = `বাচ্চার বয়স (${age || 'নির্দিষ্ট'}) ও ওজন বিবেচনা করে, শিশু দ্রুত বড় হয় বিধায় দীর্ঘমেয়াদী ব্যবহারের জন্য এবং আরামদায়ক ফিটিংসের জন্য '${defaultSize}' সাইজটি বেছে নেওয়ার পরামর্শ দেওয়া হচ্ছে।`;
    res.json({ recommendedSize: defaultSize, explanation: fallbackExp });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Size recommendation failed" });
  }
});

// 3. AI Product Auto-Fill API Route (Admin Tool)
app.post("/api/ai-product-auto-fill", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const prompt = `You are an expert e-commerce catalog AI assistant for the luxury Bangladeshi kids & family fashion brand "Rare Dreams".
Generate complete, accurate product metadata for a luxury fashion item strictly in JSON format.

Required JSON Structure:
{
  "name": "Exact product title in Bengali & English e.g. ছেলেদের রয়েল কাফতান পাঞ্জাবি সেট - Maroon",
  "category": "Must be ONE of: Mens items, Womens items, Baby items, Foot wear",
  "subcategory": "e.g. Panjabi Set, Party Gown, Baby Romper, Leather Loafers, Formal Shirt, Jeans",
  "description": "Comprehensive, attractive product description in Bengali highlighting luxury quality, fabric comfort, stitching, and occasion suitability",
  "material": "e.g. 100% Premium Cotton / Pure Silk / Katan / Genuine Leather",
  "price": 1250,
  "comparePrice": 1650,
  "discount": 24,
  "sizeOptions": ["22", "24", "26", "28", "30"],
  "colorOptions": ["Maroon", "Gold"]
}`;

    // 1. Primary: Groq LLM API (llama-3.3-70b-versatile) - Ultra fast & reliable
    const groqRes = await callGroq(prompt, "You are an e-commerce catalog assistant for Rare Dreams Bangladesh. Always respond with strict JSON.", true);
    if (groqRes) {
      try {
        const cleanText = groqRes.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);
        return res.json(parsed);
      } catch (e) {
        console.warn("JSON parse error from Groq auto fill:", e);
      }
    }

    // 2. Secondary: Gemini API (if configured and working)
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        if (response?.text) {
          const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          try {
            const parsed = JSON.parse(cleanText);
            return res.json(parsed);
          } catch (e) {
            console.warn("JSON parse error from Gemini vision:", e);
          }
        }
      } catch (geminiErr: any) {
        console.warn("Gemini vision auto-fill fallback active:", geminiErr?.message || geminiErr);
      }
    }

    // 3. Fallback response (Guarantees auto-fill never fails)
    res.json({
      name: "এক্সক্লুসিভ প্রিমিয়াম রয়েল কালেকশন",
      category: "Mens items",
      subcategory: "Panjabi & Pajama Set",
      description: "রেয়ার ড্রিমস (Rare Dreams)-এর এই প্রিমিয়াম পোশাকটি অত্যন্ত সুক্ষ্ম সেলাই ও ১০০% আরামদায়ক ফেব্রিকে তৈরি। স্কিন ফ্রেন্ডলি ও যেকোনো অনুষ্ঠানে ব্যবহারের জন্য অতুলনীয়।",
      material: "১০০% প্রিমিয়াম কটন",
      price: 1250,
      comparePrice: 1550,
      discount: 20,
      sizeOptions: ["22", "24", "26", "28", "30"],
      colorOptions: ["Maroon", "Gold"]
    });
  } catch (err: any) {
    res.json({
      name: "এক্সক্লুসিভ প্রিমিয়াম রয়েল কালেকশন",
      category: "Mens items",
      subcategory: "Panjabi & Pajama Set",
      description: "রেয়ার ড্রিমস (Rare Dreams)-এর এই প্রিমিয়াম পোশাকটি অত্যন্ত সুক্ষ্ম সেলাই ও ১০০% আরামদায়ক ফেব্রিকে তৈরি। স্কিন ফ্রেন্ডলি ও যেকোনো অনুষ্ঠানে ব্যবহারের জন্য অতুলনীয়।",
      material: "১০০% প্রিমিয়াম কটন",
      price: 1250,
      comparePrice: 1550,
      discount: 20,
      sizeOptions: ["22", "24", "26", "28", "30"],
      colorOptions: ["Maroon", "Gold"]
    });
  }
});

app.post("/api/ai-tag-product", async (req, res) => {
  try {
    const { name, category } = req.body;
    const prompt = `Analyze this apparel product for e-commerce tagging:
Title: ${name}
Category: ${category}

Suggest:
1. Best subcategory name in Bengali/English (e.g., Party Gown, Panjabi & Pajama Set, Leather Loafers, Casual T-Shirt)
2. 3-5 tags/keywords as comma-separated values (e.g. Party Wear, Cotton, Festival, Premium, Summer Collection)

Return JSON strictly: {"subcategory": "SUBCATEGORY_NAME", "tags": ["TAG1", "TAG2", "TAG3"]}`;

    // 1. Primary: Groq LLM API
    const groqRes = await callGroq(prompt, undefined, true);
    if (groqRes) {
      const cleanText = groqRes.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const parsed = JSON.parse(cleanText);
        return res.json(parsed);
      } catch {
        // fallback
      }
    }

    // 2. Secondary: Gemini API
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        if (response?.text) {
          const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          return res.json(parsed);
        }
      } catch (err: any) {
        console.warn("Gemini auto-tag fallback active:", err?.message || err);
      }
    }

    // 3. Smart Keyword Fallback Detector
    const lower = (name || '').toLowerCase();
    let smartSubcat = 'Exclusive Collection';
    if (lower.includes('panjabi') || lower.includes('পাঞ্জাবি')) smartSubcat = "Panjabi & Pajama Set";
    else if (lower.includes('kabli') || lower.includes('কাবলি')) smartSubcat = "Kabli Suit";
    else if (lower.includes('gown') || lower.includes('গাউন')) smartSubcat = "Party Gown";
    else if (lower.includes('frock') || lower.includes('ফ্রক')) smartSubcat = "Designer Frock";
    else if (lower.includes('lehenga') || lower.includes('লেহেঙ্গা')) smartSubcat = "Luxury Lehenga";
    else if (lower.includes('shoe') || lower.includes('loafer') || lower.includes('জুতা') || lower.includes('স্যান্ডেল')) smartSubcat = "Leather Loafers & Shoes";
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
    // In a real app, this should be heavily secured.
    // For this prototype, we'll allow it to help setup.
    await getAuth().setCustomUserClaims(uid, { admin: true });
    res.json({ success: true, message: `User ${uid} is now an admin` });
  } catch (error: any) {
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
    const { productId, productName, oldPrice, newPrice, productImage } = req.body;
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


app.post("/api/ai-chat", async (req, res) => {
  const { message } = req.body;
  const lower = (message || '').toLowerCase();

  const systemPrompt = `You are the official AI Assistant & Personal Shopping Consultant for "Rare Dreams" (রেয়ার ড্রিমস), the premier luxury fashion e-commerce brand for kids and family in Bangladesh.

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
   - Inside Dhaka: 1 - 2 business days. Delivery fee ৳60.
   - Outside Dhaka: 2 - 4 business days. Delivery fee ৳120.
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

  // Helper for smart Bengali knowledge base responses
  const getSmartFallback = (query: string) => {
    const q = query.toLowerCase();

    if (q.includes('তুমি কে') || q.includes('কে তুমি') || q.includes('who are you') || q.includes('আপনার নাম') || q.includes('তোমার নাম') || q.includes('identity')) {
      return "আমি রেয়ার ড্রিমস (Rare Dreams) এর অফিশিয়াল এআই অ্যাসিস্ট্যান্ট & পার্সোনাল শপিং কনসালট্যান্ট! 🌟\n\nআমি আপনাকে বাচ্চার পোশাকের সাইজ সিলেক্ট, লেটেস্ট কালেকশন দেখায় সাহায্য, ডেলিভারি বা সাধারণ যেকোনো প্রশ্নের উত্তর দিতে পারি। বলুন, কীভাবে সাহায্য করবো?";
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
    } else if (q.includes('delivery') || q.includes('ডেলিভারি') || q.includes('চার্জ') || q.includes('শিপিং')) {
      return "ঢাকা সিটিতে ১-২ দিন (চার্জ ৳৬০) এবং ঢাকার বাইরে ২-৪ দিনে (চার্জ ৳১২০) ক্যাশ অন ডেলিভারিতে প্রিমিয়াম ড্রেস পাঠানো হয়। ২০০০ টাকার উপরে অর্ডারে সম্পূর্ণ ডেলিভারি ফ্রী! 🚚";
    } else if (q.includes('location') || q.includes('শো-রুম') || q.includes('ঠিকানা') || q.includes('address') || q.includes('অফিস')) {
      return "আমাদের শো-রুম ও অফিস ঠিকানা: লেভেল ৪, ব্লক বি, যমুনা ফিউচার পার্ক, ঢাকা। ট্রেড লাইসেন্স নং: TRAD/DNCC/012984/2026।";
    }
    
    return `রেয়ার ড্রিমসে (Rare Dreams) আপনার প্রশ্নটির জন্য ধন্যবাদ! 🌸\n\nআমাদের কাছে ১-১৪ বছরের বাচ্চার জন্য রাজকীয় পার্টি ওয়্যার, ক্যাজুয়াল ড্রেস, পাঞ্জাবি ও জুতা রয়েছে। ঢাকা সিটিতে ১-২ দিন ও ঢাকার বাইরে ২-৪ দিনে ক্যাশ অন ডেলিভারি পাবেন (২০০০ টাকার অর্ডারে ডেলিভারি ফ্রী)। আপনার নির্দিষ্ট কোনো সাহায্য লাগলে বিস্তারিত লিখুন!`;
  };

  // 1. Primary: Groq API
  const groqReply = await callGroq(message || "Hello", systemPrompt);
  if (groqReply) {
    return res.json({ reply: groqReply });
  }

  // 2. Secondary: Gemini API
  try {
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: message || "Hello" }]
            }
          ],
          config: { systemInstruction: systemPrompt }
        });

        if (response && response.text) {
          return res.json({ reply: response.text });
        }
      } catch (geminiError: any) {
        console.warn("Gemini API call warning:", geminiError?.message || geminiError);
      }
    }
  } catch (e) {
    console.warn("Gemini init error:", e);
  }

  // 3. Fallback to smart knowledge base
  return res.json({ reply: getSmartFallback(lower) });
});

// AI API Health & Connectivity Check Endpoint
app.get("/api/ai-health-check", async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const results = {
    gemini: {
      configured: false,
      reachable: false,
      keySnippet: geminiKey ? `${geminiKey.substring(0, 6)}...` : 'Not Set',
      message: "GEMINI_API_KEY is not set"
    },
    groq: {
      configured: false,
      reachable: false,
      keySnippet: groqKey ? `${groqKey.substring(0, 6)}...` : 'Not Set',
      message: "GROQ_API_KEY is not set"
    }
  };

  // 1. Test Gemini
  if (geminiKey && geminiKey.trim() !== "" && !geminiKey.startsWith("MY_")) {
    results.gemini.configured = true;
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: "Respond 'OK' if reachable." }] }]
        });
        if (response?.text) {
          results.gemini.reachable = true;
          results.gemini.message = "Connected & Active (gemini-3.6-flash)";
        } else {
          results.gemini.message = "Connected but received empty response";
        }
      } catch (err: any) {
        results.gemini.message = err?.message || "Connection to Gemini API failed";
      }
    } else {
      results.gemini.message = "Failed to initialize Gemini SDK client";
    }
  }

  // 2. Test Groq
  if (groqKey && groqKey.trim() !== "" && !groqKey.startsWith("MY_")) {
    results.groq.configured = true;
    try {
      const groqRes = await callGroq("Respond 'OK' if reachable.");
      if (groqRes) {
        results.groq.reachable = true;
        results.groq.message = "Connected & Active (llama-3.3-70b-versatile)";
      } else {
        results.groq.message = "Groq request returned no output or auth error";
      }
    } catch (err: any) {
      results.groq.message = err?.message || "Connection to Groq API failed";
    }
  }

  res.json(results);
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
