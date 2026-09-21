import type { MetadataRoute } from "next";
import { isSandbox } from "@/lib/site-env";

export default function robots(): MetadataRoute.Robots {
  if (isSandbox) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /r/ are campaign short links that redirect to booklet pages with UTM parameters
      // attached; indexing them would compete with the canonical booklet URL.
      disallow: ["/checkout", "/admin", "/r/"],
      crawlDelay: 1
    },
    sitemap: "https://www.thevalluru.org/sitemap.xml"
  };
}
