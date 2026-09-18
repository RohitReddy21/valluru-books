import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CONTENT_CACHE_TAG } from "@/lib/content-store";

function secretMatches(provided: string, expected: string) {
  // Hashing both sides first keeps the comparison constant-time even when the lengths
  // differ, which timingSafeEqual would otherwise reject outright.
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

async function handleRevalidate(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured." },
      { status: 503 }
    );
  }

  let provided = new URL(request.url).searchParams.get("secret") || "";

  if (!provided && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { secret?: unknown } | null;
    provided = typeof body?.secret === "string" ? body.secret : "";
  }

  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Invalid revalidate secret." }, { status: 401 });
  }

  // expire: 0 rather than a stale-while-revalidate profile — an admin who just published
  // should see the change on the next request, not the previous copy.
  revalidateTag(CONTENT_CACHE_TAG, { expire: 0 });

  return NextResponse.json({ revalidated: true, tag: CONTENT_CACHE_TAG });
}

export async function POST(request: Request) {
  return handleRevalidate(request);
}

export async function GET(request: Request) {
  return handleRevalidate(request);
}
