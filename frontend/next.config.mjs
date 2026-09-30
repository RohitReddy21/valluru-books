/** @type {import('next').NextConfig} */
const sandbox = process.env.NEXT_PUBLIC_SANDBOX === "1";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**"
      },
      { protocol: "https", hostname: "www.thevalluru.org" },
      { protocol: "https", hostname: "thevalluru.org" }
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 828, 1080, 1280, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // Next.js already serves /_next/static immutable; /pdfjs is copied into public/,
        // where it gets no caching headers of its own.
        source: "/pdfjs/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // SAMEORIGIN rather than DENY: the booklet reader frames /pdfjs itself.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Also covers what has no <head> to carry a robots tag: PDFs, images, JSON.
          ...(sandbox ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : [])
        ]
      }
    ];
  }
};

export default nextConfig;
