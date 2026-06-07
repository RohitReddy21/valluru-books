import fetch from "node-fetch";
import { getB2PublicUrl, hasB2Config, b2ConfigError } from "../../../backend/server"; // adjust path if needed

/**
 * API route: /api/pdf-proxy?file=path/to/file.pdf
 * Returns the PDF with CORS headers for https://valluru-books.vercel.app
 */
export default async function handler(req, res) {
  // Only GET supported
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { file } = req.query;
  if (!file || typeof file !== "string") {
    return res.status(400).json({ error: "Missing required 'file' query parameter" });
  }

  // Basic sanitisation – prevent path traversal
  if (file.includes("..")) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  if (!hasB2Config()) {
    return res.status(500).json({ error: b2ConfigError() });
  }

  // Build the signed B2 public URL (the same helper used elsewhere)
  const publicUrl = getB2PublicUrl(file);

  // Fetch the PDF from Backblaze B2
  const upstream = await fetch(publicUrl);
  if (!upstream.ok) {
    const txt = await upstream.text();
    return res.status(upstream.status).json({ error: "Failed to fetch PDF", details: txt });
  }

  // Set CORS header for the frontend origin
  res.setHeader("Access-Control-Allow-Origin", "https://valluru-books.vercel.app");
  // Forward appropriate content type
  const contentType = upstream.headers.get("content-type") || "application/pdf";
  res.setHeader("Content-Type", contentType);
  // Stream directly to client
  const stream = upstream.body;
  if (!stream) {
    return res.status(502).json({ error: "No response body from B2" });
  }
  // Node fetch returns a web ReadableStream; convert to Node stream
  const { Readable } = require("node:stream");
  const nodeStream = Readable.fromWeb(stream);
  nodeStream.pipe(res);
}
