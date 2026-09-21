import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/content-store";
import { bookletPublicSlug, isPublished } from "@/lib/site-content";

/**
 * Short links for the content operation: /r/b5?s=story lands on booklet five with UTM
 * parameters attached server-side.
 *
 * Attaching them here rather than in the pasted link is the point — a bio link can be
 * changed without editing every surface it was posted to, and the reel's destination
 * stays a short, typeable string.
 */

/** utm_medium per surface the link gets posted to. */
const SURFACES = new Set(["bio", "story", "highlight", "dm", "comment", "shorts_desc"]);
const DEFAULT_SURFACE = "bio";

/** shorts_desc is the YouTube surface; every other one is Instagram. */
function sourceForSurface(surface: string) {
  return surface === "shorts_desc" ? "youtube" : "instagram";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  // A campaign link must land somewhere while the API wakes up, not answer with an error.
  const content = await getSiteContent().catch(() => null);

  if (!content) {
    return NextResponse.redirect(new URL("/series", request.url), 307);
  }

  // The Inward Fire series is code-owned at /series; only Inward Mirror carries a
  // configurable routeSegment.
  const seriesPath = "/series";

  const match = /^b(\d{1,2})$/i.exec(code);
  const booklets = content.series.booklets.filter((booklet) => isPublished(booklet.status));
  const booklet = match ? booklets[Number(match[1]) - 1] : undefined;

  // An unknown or retired code still lands somewhere useful rather than on a 404.
  if (!booklet) {
    return NextResponse.redirect(new URL(seriesPath, request.url), 307);
  }

  const requested = new URL(request.url).searchParams;
  const surface = String(requested.get("s") || DEFAULT_SURFACE).toLowerCase();
  const medium = SURFACES.has(surface) ? surface : DEFAULT_SURFACE;
  const creative = requested.get("c");

  const target = new URL(`${seriesPath}/${bookletPublicSlug(booklet)}`, request.url);
  target.searchParams.set("utm_source", requested.get("src") || sourceForSurface(medium));
  target.searchParams.set("utm_medium", medium);
  target.searchParams.set("utm_campaign", booklet.slug);

  if (creative) {
    target.searchParams.set("utm_content", creative);
  }

  // 307, not 308: these are campaign links whose destination is expected to change, and a
  // permanent redirect would be cached by browsers long after the schedule moves on.
  return NextResponse.redirect(target, 307);
}
