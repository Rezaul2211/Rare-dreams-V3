/**
 * Cloudflare Pages Advanced Worker
 * 1. Proxies /api/* requests to the production backend server-to-server (bypassing ISP blocks in Bangladesh)
 * 2. Serves static assets with Edge caching from Cloudflare's Dhaka data center
 * 3. Handles client-side Single-Page Application (SPA) routing
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy backend API routes through Cloudflare's global network
    if (url.pathname.startsWith('/api/')) {
      const backendUrl = new URL(url.pathname + url.search, 'https://raredreams.vercel.app');
      const newHeaders = new Headers(request.headers);
      newHeaders.set('host', backendUrl.host);

      const proxyRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });

      try {
        const res = await fetch(proxyRequest);
        return res;
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Backend gateway connection failed' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve static files from Cloudflare Pages ASSETS
    let response = await env.ASSETS.fetch(request);

    // SPA routing fallback: For client-side routes (e.g. /shop, /cart, /checkout, /admin), return /index.html
    if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const indexRequest = new Request(new URL('/index.html', request.url), request);
      response = await env.ASSETS.fetch(indexRequest);
    }

    return response;
  }
};
