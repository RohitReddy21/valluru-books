import fetch from "node-fetch";

/**
 * API route: /api/pdf-proxy?url=https://...
 * Proxies PDF requests with proper CORS headers
 */
export default async function handler(req, res) {
  // Only GET supported
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing required 'url' query parameter" });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Valluru-Books/1.0"
      }
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      const txt = await upstream.text();
      console.error(`PDF proxy failed: ${upstream.status} ${upstream.statusText} for URL: ${url}`);
      return res.status(upstream.status).json({ error: "Failed to fetch PDF", details: txt });
    }

    const stream = upstream.body;
    if (!stream) {
      return res.status(502).json({ error: "No response body from upstream" });
    }

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // Forward content type
    const contentType = upstream.headers.get("content-type") || "application/pdf";
    res.setHeader("Content-Type", contentType);
    
    // Stream directly to client
    const { Readable } = require("node:stream");
    const nodeStream = Readable.fromWeb(stream);
    nodeStream.pipe(res);
  } catch (error) {
    console.error(`PDF proxy error for URL ${url}:`, error.message);
    return res.status(502).json({ error: "Proxy error", details: error.message });
  }
}
