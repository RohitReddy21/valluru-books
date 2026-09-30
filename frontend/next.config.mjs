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
  async redirects() {
    // thevalluru.org answered 200 on every page, so each page lived at two addresses. One
    // host is enough for search engines and for analytics; canonical tags already name www.
    // Skipped on a sandbox, which has its own host and must not bounce to production.
    return sandbox
      ? []
      : [
          {
            source: "/:path*",
            has: [{ type: "host", value: "thevalluru.org" }],
            destination: "https://www.thevalluru.org/:path*",
            permanent: true
          }
        ];
  },
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Also covers what has no <head> to carry a robots tag: PDFs, images, JSON.
          ...(sandbox ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : [])
        ]
      }
    ];
  }
};

export default nextConfig;
