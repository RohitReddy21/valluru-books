import type { MetadataRoute } from "next";
import { getSiteContent } from "@/lib/content-store";
import {
  bookletPublicSlug,
  isPublished,
  movementSlug,
  seriesBasePath
} from "@/lib/site-content";

/**
 * Built from the published content, not from a list kept by hand.
 *
 * The hand-kept list drifted: from booklet six on its slugs no longer matched the public
 * URLs, and the Inward Mirror was not in it at all. Reading the same content the pages
 * are built from means a booklet published in /admin is in the sitemap within the ISR
 * window, and one that is unpublished leaves it.
 */
export const revalidate = 300;

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.thevalluru.org").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  const lastModified = new Date();
  const entry = (
    path: string,
    changeFrequency: "weekly" | "monthly",
    priority: number
  ): MetadataRoute.Sitemap[number] => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority
  });

  const pages: MetadataRoute.Sitemap = [
    entry("/", "weekly", 1),
    entry("/series", "weekly", 0.9),
    // Landing hub for reel traffic; its top slot changes with the posting schedule.
    entry("/read", "weekly", 0.9),
    entry("/movements", "weekly", 0.9),
    entry("/about", "monthly", 0.7)
  ];

  for (const booklet of content.series.booklets) {
    if (isPublished(booklet.status)) {
      pages.push(entry(`/series/${bookletPublicSlug(booklet)}`, "monthly", 0.8));
    }
  }

  const mirror = content.inwardMirror;

  if (isPublished(mirror.status)) {
    const base = seriesBasePath(mirror);

    pages.push(entry(base, "weekly", 0.9));

    for (const booklet of mirror.booklets) {
      if (isPublished(booklet.status)) {
        pages.push(entry(`${base}/${bookletPublicSlug(booklet)}`, "monthly", 0.8));
      }
    }
  }

  content.home.seriesOverview.movements.forEach((movement, index) => {
    if (isPublished(movement.status)) {
      pages.push(entry(`/movements/${movementSlug(movement, index)}`, "monthly", 0.8));
    }
  });

  return pages;
}
