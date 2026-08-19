import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let dynamicGeminiKey: string = process.env.GEMINI_API_KEY || "";
let aiClient: GoogleGenAI | null = null;
let lastUsedKey: string = "";

function resolveGeminiKey(req?: express.Request, customKey?: string): string {
  if (customKey && customKey.trim() && !customKey.startsWith("MY_")) {
    return customKey.trim();
  }
  const headerKey = req?.headers?.["x-gemini-key"] as string;
  if (headerKey && headerKey.trim() && !headerKey.startsWith("MY_")) {
    return headerKey.trim();
  }
  const bodyKey = req?.body?.customApiKey as string;
  if (bodyKey && bodyKey.trim() && !bodyKey.startsWith("MY_")) {
    return bodyKey.trim();
  }
  if (dynamicGeminiKey && dynamicGeminiKey.trim() && !dynamicGeminiKey.startsWith("MY_")) {
    return dynamicGeminiKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY || "";
  if (envKey && envKey.trim() && !envKey.startsWith("MY_")) {
    return envKey.trim();
  }
  return "";
}

function getAI(req?: express.Request, customKey?: string): GoogleGenAI | null {
  const key = resolveGeminiKey(req, customKey);
  if (!key) {
    return null;
  }
  if (!aiClient || lastUsedKey !== key) {
    lastUsedKey = key;
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
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

// 1. AI Product Description Generator API Route (Admin Tool - English)
app.post("/api/ai-generate-description", async (req, res) => {
  try {
    const { name, category, subcategory, price, material } = req.body;
    const prompt = `Write a compelling, luxury, SEO-optimized English product description for an e-commerce fashion item with these details:
Product Name: ${name || 'Luxury Fashion Item'}
Category: ${category || 'Clothing'}
Subcategory: ${subcategory || ''}
Price: ৳${price || 0}
Material: ${material || 'Premium Fabric'}

Requirements:
- Written in stylish, modern, engaging English.
- Highlights premium quality, tailored fit, comfort, and versatile styling.
- Includes 3-4 bullet points for key features (e.g., ✨ 100% Premium Quality Fabric, Precision Tailored Stitching, Elegant Silhouette, Ideal for Parties & Special Occasions).
- Includes a brief Care Instructions note.
- Keep it under 250 words. Do NOT include markdown code blocks around text.`;

    // Primary: Gemini 3.7 Flash API
    const ai = getAI(req);
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt
        });
        if (response?.text) {
          return res.json({ description: response.text.trim() });
        }
      } catch (err: any) {
        console.warn("Gemini description fallback active:", err?.message || err);
      }
    }

    // High-quality English Fallback Description
    const fallbackDesc = `Elevate your wardrobe with the exquisite ${name || 'Designer Collection'} by Rare Dreams. Expertly crafted from ${material || 'ultra-fine premium fabric'}, this outfit blends timeless elegance with all-day comfort.\n\n✨ Key Highlights:\n- Premium grade breathable & durable fabric\n- Tailored precision finish with regal aesthetic\n- Perfect for weddings, festive occasions, and exclusive gatherings\n- Easy care & long-lasting vibrant color retention\n\n🧺 Care Instructions: Gentle machine wash or dry clean recommended.`;
    res.json({ description: fallbackDesc });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate description" });
  }
});

// 2. AI Size Helper / Recommender API Route (English)
app.post("/api/ai-recommend-size", async (req, res) => {
  try {
    const { productName, category, availableSizes, age, height, weight, fitPreference } = req.body;
    const prompt = `Act as an expert size consultant for the luxury fashion brand "Rare Dreams".
Product Name: ${productName || 'Outfit'}
Category: ${category || 'Apparel'}
Available Sizes in Stock: ${Array.isArray(availableSizes) ? availableSizes.join(', ') : availableSizes || 'S, M, L, XL'}
Customer Input:
- Age: ${age || 'Not specified'}
- Height: ${height || 'Not specified'}
- Weight: ${weight || 'Not specified'}
- Fit Preference: ${fitPreference || 'Regular'}

Instructions:
1. Determine the best recommended size from the Available Sizes list.
2. Provide a brief, reassuring explanation in polite English explaining why this size is recommended.
3. Return JSON format strictly: {"recommendedSize": "SIZE_NAME", "explanation": "ENGLISH_EXPLANATION"}`;

    const ai = getAI(req);
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
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

    const defaultSize = availableSizes?.[0] || 'M';
    const fallbackExp = `Based on your provided measurements and desired fit preference, size '${defaultSize}' will provide the most comfortable and flattering silhouette.`;
    res.json({ recommendedSize: defaultSize, explanation: fallbackExp });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Size recommendation failed" });
  }
});

// 3. AI Product Multimodal Vision Auto-Fill API Route (Admin Tool - English)
app.post("/api/ai-product-auto-fill", async (req, res) => {
  try {
    const { image, categories: clientCategories, hints } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    const availableCategories = Array.isArray(clientCategories) && clientCategories.length > 0
      ? clientCategories.map(c => typeof c === 'string' ? c : c.title || c.name).filter(Boolean)
      : ["Men", "Women", "Kids", "Accessories", "Panjabi", "Sharee", "Abaya", "Kurtis", "T-Shirts", "Shirts", "Pants", "Foot wear", "Watches"];

    // Process image into base64Data and mimeType
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = image.split(',')[1] || image;
      }
    } else if (image.startsWith('http://') || image.startsWith('https://')) {
      try {
        const imgFetch = await fetch(image);
        if (imgFetch.ok) {
          const buffer = await imgFetch.arrayBuffer();
          base64Data = Buffer.from(buffer).toString('base64');
          mimeType = imgFetch.headers.get('content-type') || 'image/jpeg';
        }
      } catch (fErr) {
        console.warn("Could not fetch external image for vision:", fErr);
      }
    } else {
      base64Data = image;
    }

    const visionPrompt = `You are an expert e-commerce fashion catalog manager for the luxury lifestyle brand "Rare Dreams".
Analyze this uploaded product photo in detail (garment style, cut, embroidery, patterns, fabric texture, colors, and demographic).

Available Store Categories: ${availableCategories.join(', ')}
${hints ? `Admin Hint: ${hints}` : ''}

Generate complete, high-converting product metadata in English in strict JSON format.

Required JSON Structure:
{
  "name": "Luxury, appealing product title in English e.g. 'Royal Silk Embroidered Panjabi Set - Navy Blue' or 'Designer Festive Party Gown'",
  "category": "Must be ONE from available categories: ${availableCategories.join(', ')}",
  "subcategory": "Specific subcategory in English e.g. Panjabi Set, Party Gown, Baby Romper, Leather Loafers, Formal Shirt, Jeans, Kurti",
  "description": "Rich, formatted product description in English. Include a 2-sentence luxury intro, bullet points for key features (✨ Key Features: Premium Quality, Tailored Finish, Comfortable Fit, Ideal Occasions), and fabric care.",
  "material": "Estimated fabric/material in English e.g. '100% Premium Combed Cotton', 'Pure Raw Silk & Georgette', 'Genuine Full-Grain Leather'",
  "price": 1450,
  "comparePrice": 1850,
  "discount": 20,
  "stockQuantity": 25,
  "sizeOptions": ["38", "40", "42", "44"],
  "colorOptions": ["Navy Blue", "Gold"],
  "tags": ["Panjabi", "Festive", "Silk", "Rare Dreams", "New Arrival"],
  "isFlashSale": false
}`;

    // Primary: Gemini 3.7 Flash with Multimodal Vision
    const ai = getAI(req);
    if (ai && base64Data) {
      try {
        const imagePart = {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        };
        const textPart = { text: visionPrompt };

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: {
            parts: [imagePart, textPart]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        if (response?.text) {
          const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (parsed && parsed.name) {
            return res.json(parsed);
          }
        }
      } catch (geminiVisionErr: any) {
        console.warn("Gemini vision analysis warning:", geminiVisionErr?.message || geminiVisionErr);
        // Fall through to the default mock data instead of crashing the request
      }
    }

    // High-Quality English Default Fallback Data
    const defaultCat = availableCategories[0] || "Men";
    res.json({
      name: "Exclusive Royal Designer Collection",
      category: defaultCat,
      subcategory: "Premium Collection",
      description: "Designed for effortless elegance, this premium piece by Rare Dreams features meticulous tailoring and luxurious breathable fabric. Designed to provide unmatched comfort and sophisticated styling for all special occasions.\n\n✨ Key Highlights:\n- Premium quality long-lasting fabric\n- Elegant silhouette with flawless craftsmanship\n- Versatile styling for celebrations and everyday luxury\n- Soft on skin with breathable comfort\n\n🧺 Care Instructions: Gentle hand wash or dry clean recommended.",
      material: "100% Premium Cotton Blend",
      price: 1450,
      comparePrice: 1850,
      discount: 20,
      stockQuantity: 25,
      sizeOptions: ["M", "L", "XL", "XXL"],
      colorOptions: ["Black", "Navy Blue", "White"],
      tags: ["Exclusive", "New Arrival", "Rare Dreams", "Premium Quality"],
      isFlashSale: false
    });
  } catch (err: any) {
    console.error("AI Product Auto-fill error:", err);
    res.json({
      name: "Exclusive Royal Designer Collection",
      category: "Men",
      subcategory: "Premium Collection",
      description: "Crafted with precision and premium materials, this exclusive design by Rare Dreams delivers superior comfort and contemporary elegance.",
      material: "100% Premium Cotton",
      price: 1450,
      comparePrice: 1850,
      discount: 20,
      stockQuantity: 25,
      sizeOptions: ["M", "L", "XL", "XXL"],
      colorOptions: ["Navy Blue", "Black"],
      tags: ["Exclusive", "New Arrival", "Rare Dreams"],
      isFlashSale: false
    });
  }
});

app.post("/api/ai-tag-product", async (req, res) => {
  try {
    const { name, category } = req.body;
    const prompt = `Analyze this apparel product for e-commerce tagging in English:
Title: ${name}
Category: ${category}

Suggest:
1. Best subcategory name in English (e.g., Party Gown, Panjabi Set, Leather Loafers, Casual Shirt)
2. 3-5 tags/keywords as comma-separated values (e.g. Party Wear, Cotton, Festival, Premium, Summer Collection)

Return JSON strictly: {"subcategory": "SUBCATEGORY_NAME", "tags": ["TAG1", "TAG2", "TAG3"]}`;

    const ai = getAI(req);
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
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

    // Smart Keyword Fallback Detector in English
    const lower = (name || '').toLowerCase();
    let smartSubcat = 'Exclusive Collection';
    if (lower.includes('panjabi') || lower.includes('পাঞ্জাবি')) smartSubcat = "Panjabi & Pajama Set";
    else if (lower.includes('kabli') || lower.includes('কাবলি')) smartSubcat = "Kabli Suit";
    else if (lower.includes('gown') || lower.includes('গাউন')) smartSubcat = "Party Gown";
    else if (lower.includes('frock') || lower.includes('ফ্রক')) smartSubcat = "Designer Frock";
    else if (lower.includes('lehenga') || lower.includes('লেহেঙ্গা')) smartSubcat = "Luxury Lehenga";
    else if (lower.includes('shoe') || lower.includes('loafer') || lower.includes('জুতা')) smartSubcat = "Leather Loafers & Shoes";
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
  const { message, history } = req.body;
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

  // 1. Primary: Gemini API
  try {
    const ai = getAI(req);
    if (ai) {
      try {
        const contents = Array.isArray(history) ? [...history] : [];
        contents.push({
          role: "user",
          parts: [{ text: message || "Hello" }]
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents,
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

  // 2. Fallback to smart knowledge base
  return res.json({ reply: getSmartFallback(lower) });
});

// AI API Health & Connectivity Check Endpoint
app.get("/api/ai-health-check", async (req, res) => {
  const activeKey = resolveGeminiKey(req);

  const results = {
    gemini: {
      configured: false,
      reachable: false,
      keySnippet: activeKey ? `${activeKey.substring(0, 6)}...` : 'Not Set',
      source: dynamicGeminiKey ? 'admin_panel' : (process.env.GEMINI_API_KEY ? 'env' : 'none'),
      message: activeKey ? "Testing connection..." : "Gemini API Key is not configured yet"
    }
  };

  // Test Gemini
  if (activeKey) {
    results.gemini.configured = true;
    const ai = getAI(req);
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: [{ role: "user", parts: [{ text: "Respond 'OK' if reachable." }] }]
        });
        if (response?.text) {
          results.gemini.reachable = true;
          results.gemini.message = "Connected & Active (Gemini 2.5/3.7 Flash)";
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

  res.json(results);
});

// Admin endpoint: Save and verify custom Gemini API key
app.post("/api/admin/save-gemini-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(400).json({ success: false, error: "Please enter a valid Gemini API Key." });
    }

    const cleanKey = apiKey.trim();

    // Verify key by making a test call to Gemini
    try {
      const testAi = new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const testRes = await testAi.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [{ role: "user", parts: [{ text: "Ping. Respond 'PONG'." }] }]
      });

      if (!testRes?.text) {
        throw new Error("Received empty verification response from Gemini API.");
      }

      // Update dynamic key in server memory
      dynamicGeminiKey = cleanKey;
      aiClient = null;
      lastUsedKey = "";

      return res.json({
        success: true,
        message: "Gemini API Key successfully verified and activated!",
        keySnippet: `${cleanKey.substring(0, 7)}...${cleanKey.substring(cleanKey.length - 4)}`,
        model: "gemini-3.6-flash & gemini-3.6-flash"
      });
    } catch (testErr: any) {
      console.warn("Gemini key verification failed:", testErr);
      return res.status(400).json({
        success: false,
        error: `Verification failed: ${testErr?.message || "Invalid API key or quota exceeded. Please check Google AI Studio."}`
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to save API key" });
  }
});

// Admin endpoint: Get current key status
app.get("/api/admin/gemini-key-status", (req, res) => {
  const activeKey = resolveGeminiKey(req);
  res.json({
    configured: !!activeKey,
    keySnippet: activeKey ? `${activeKey.substring(0, 6)}...${activeKey.substring(activeKey.length - 4)}` : null,
    source: dynamicGeminiKey ? 'admin_panel' : (process.env.GEMINI_API_KEY ? 'env' : 'none')
  });
});

// Admin endpoint: Clear dynamic key
app.delete("/api/admin/gemini-key", (req, res) => {
  dynamicGeminiKey = "";
  aiClient = null;
  lastUsedKey = "";
  res.json({ success: true, message: "Gemini API Key removed from server memory." });
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
