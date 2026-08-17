import React, { useEffect } from 'react';
import { useStoreConfigStore } from '../store/useStoreConfigStore';

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  keywords?: string;
  // Product specific rich snippet fields
  price?: number;
  comparePrice?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  sku?: string;
  brand?: string;
  category?: string;
  inStock?: boolean;
  breadcrumbs?: BreadcrumbItem[];
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  image,
  url,
  type = 'website',
  keywords,
  price,
  comparePrice,
  currency = 'BDT',
  rating = 4.9,
  reviewCount = 12,
  sku,
  brand = 'Rare Dreams',
  category,
  inStock = true,
  breadcrumbs,
}) => {
  const { config } = useStoreConfigStore();

  const finalTitle = title 
    ? (title.includes('Rare Dreams') ? title : `${title} | Rare Dreams`)
    : (config.metaTitle || 'Rare Dreams | Premium Kids & Fashion Apparel Bangladesh');

  const finalDescription = description || config.metaDescription || 'Shop exclusive, premium kids apparel, footwear, and fashion collections at Rare Dreams. 100% genuine fabrics, fast cash on delivery nationwide.';
  
  const finalImage = image || config.ogImage || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop';
  
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const defaultKeywords = config.metaKeywords || 'Rare Dreams, kids apparel, boys wear, girls wear, baby essentials, footwear, Bangladesh fashion, premium clothing, online shopping BD';
  const finalKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;

  useEffect(() => {
    // 1. Update Document Title
    document.title = finalTitle;

    // Helper function to create or update meta tags
    const updateMetaTag = (selector: string, attributeName: string, attributeValue: string, content: string) => {
      if (!content) return;
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Standard Search Meta
    updateMetaTag('meta[name="description"]', 'name', 'description', finalDescription);
    updateMetaTag('meta[name="keywords"]', 'name', 'keywords', finalKeywords);
    updateMetaTag('meta[name="author"]', 'name', 'author', 'Rare Dreams Bangladesh');
    updateMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('meta[name="googlebot"]', 'name', 'googlebot', 'index, follow, max-snippet:-1, max-image-preview:large');

    // Geo Meta Tags for local Google search ranking in Bangladesh
    updateMetaTag('meta[name="geo.region"]', 'name', 'geo.region', 'BD-13');
    updateMetaTag('meta[name="geo.placename"]', 'name', 'geo.placename', 'Dhaka, Bangladesh');
    updateMetaTag('meta[name="geo.position"]', 'name', 'geo.position', '23.8103;90.4125');

    // Google Search Console Site Verification
    if (config.googleSiteVerification) {
      updateMetaTag('meta[name="google-site-verification"]', 'name', 'google-site-verification', config.googleSiteVerification);
    }

    // Open Graph / Social Meta Tags
    updateMetaTag('meta[property="og:title"]', 'property', 'og:title', finalTitle);
    updateMetaTag('meta[property="og:description"]', 'property', 'og:description', finalDescription);
    updateMetaTag('meta[property="og:image"]', 'property', 'og:image', finalImage);
    updateMetaTag('meta[property="og:image:alt"]', 'property', 'og:image:alt', finalTitle);
    updateMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);
    updateMetaTag('meta[property="og:type"]', 'property', 'og:type', type === 'product' ? 'product' : 'website');
    updateMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'Rare Dreams');
    updateMetaTag('meta[property="og:locale"]', 'property', 'og:locale', 'bn_BD');

    if (type === 'product' && price) {
      updateMetaTag('meta[property="product:price:amount"]', 'property', 'product:price:amount', price.toString());
      updateMetaTag('meta[property="product:price:currency"]', 'property', 'product:price:currency', currency);
      updateMetaTag('meta[property="product:availability"]', 'property', 'product:availability', inStock ? 'in stock' : 'out of stock');
    }

    // Twitter Card Tags
    updateMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    updateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', finalTitle);
    updateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', finalDescription);
    updateMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', finalImage);

    // Canonical URL Link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', currentUrl);

    // JSON-LD Structured Data Injection for Google Rich Snippets
    let jsonLdScript = document.querySelector('#seo-json-ld') as HTMLScriptElement;
    if (!jsonLdScript) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.id = 'seo-json-ld';
      jsonLdScript.type = 'application/ld+json';
      document.head.appendChild(jsonLdScript);
    }

    const jsonLdGraph: any[] = [
      // 1. WebSite Schema with Sitelinks SearchBox
      {
        "@type": "WebSite",
        "@id": `${currentUrl.split('/')[0]}//${currentUrl.split('/')[2]}/#website`,
        "url": `${currentUrl.split('/')[0]}//${currentUrl.split('/')[2]}/`,
        "name": "Rare Dreams",
        "description": "Premium Fashion & Lifestyle E-Commerce in Bangladesh",
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${currentUrl.split('/')[0]}//${currentUrl.split('/')[2]}/shop?search={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      // 2. Organization Schema
      {
        "@type": "Organization",
        "@id": `${currentUrl.split('/')[0]}//${currentUrl.split('/')[2]}/#organization`,
        "name": "Rare Dreams",
        "url": `${currentUrl.split('/')[0]}//${currentUrl.split('/')[2]}/`,
        "logo": {
          "@type": "ImageObject",
          "url": config.ogImage || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": config.helplineNumber || "+8801712345678",
          "contactType": "customer service",
          "areaServed": "BD",
          "availableLanguage": ["Bengali", "English"]
        },
        "sameAs": [
          config.facebookUrl,
          config.instagramUrl,
          config.youtubeUrl,
          config.tiktokUrl
        ].filter(Boolean)
      }
    ];

    // 3. BreadcrumbList Schema (if breadcrumbs provided)
    if (breadcrumbs && breadcrumbs.length > 0) {
      jsonLdGraph.push({
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbs.map((b, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": b.name,
          "item": b.url
        }))
      });
    }

    // 4. Product Schema with Google Search Rich Results support
    if (type === 'product') {
      const productSchema: any = {
        "@type": "Product",
        "name": finalTitle,
        "description": finalDescription,
        "image": [finalImage],
        "sku": sku || `RD-${Math.abs(currentUrl.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0))}`,
        "brand": {
          "@type": "Brand",
          "name": brand
        },
        "offers": {
          "@type": "Offer",
          "url": currentUrl,
          "priceCurrency": currency,
          "price": price || 0,
          "priceValidUntil": "2028-12-31",
          "itemCondition": "https://schema.org/NewCondition",
          "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "seller": {
            "@type": "Organization",
            "name": "Rare Dreams"
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": rating || 4.9,
          "reviewCount": reviewCount || 10,
          "bestRating": 5,
          "worstRating": 1
        }
      };

      if (category) {
        productSchema["category"] = category;
      }

      jsonLdGraph.push(productSchema);
    }

    jsonLdScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": jsonLdGraph
    });

  }, [finalTitle, finalDescription, finalImage, currentUrl, type, finalKeywords, price, currency, rating, reviewCount, sku, brand, category, inStock, config]);

  return null;
};

export default SEO;

