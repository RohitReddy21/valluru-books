import { NextRequest, NextResponse } from "next/server";
import { hasMongoConfig } from "@/lib/mongodb";
import { saveMediaToDb } from "@/lib/media-store";

export async function POST(request: NextRequest) {
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
      { error: "MONGODB_URI is required to store media in the database." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("media");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a media file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported here." }, { status: 400 });
  }

  const id = await saveMediaToDb({
    file: Buffer.from(await file.arrayBuffer()),
    originalName: file.name,
    contentType: file.type || "application/octet-stream"
  });

  return NextResponse.json({
    ok: true,
    id,
    url: `/api/media/${id}`
  });
}
