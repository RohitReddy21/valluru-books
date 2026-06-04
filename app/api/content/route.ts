import { NextRequest, NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content-store";
import { hasMongoConfig } from "@/lib/mongodb";
import type { SiteContent } from "@/lib/site-content";

export async function GET() {
  const content = await getSiteContent();
  return NextResponse.json({ content });
}

export async function PUT(request: NextRequest) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const providedPassword = request.headers.get("X-Admin-Password");

  if (!configuredPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured." },
      { status: 500 }
    );
  }

  if (providedPassword !== configuredPassword) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: "MONGODB_URI is required to store site content in the database." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as { content?: unknown };

  if (!payload.content || typeof payload.content !== "object") {
    return NextResponse.json({ error: "Missing content object." }, { status: 400 });
  }

  await saveSiteContent(payload.content as SiteContent);
  return NextResponse.json({ ok: true });
}
