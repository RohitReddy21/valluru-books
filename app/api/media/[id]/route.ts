import { NextResponse } from "next/server";
import { getMediaFromDb } from "@/lib/media-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const media = await getMediaFromDb(id);

    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    return new Response(media.file, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }
}
