import { NextRequest, NextResponse } from "next/server";
import { getMongoDb, hasMongoConfig } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    bookletSlug?: string;
    rating?: number;
    comment?: string;
  };

  if (!payload.bookletSlug || !payload.rating || payload.rating < 1 || payload.rating > 5) {
    return NextResponse.json(
      { error: "Booklet slug and rating from 1 to 5 are required." },
      { status: 400 }
    );
  }

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: "MONGODB_URI is required to store comments." },
      { status: 500 }
    );
  }

  const db = await getMongoDb();
  const comment = {
    bookletSlug: payload.bookletSlug,
    rating: payload.rating,
    comment: payload.comment?.trim() || "",
    createdAt: new Date()
  };

  await db.collection("comments").insertOne(comment);
  await db.collection("reflections").insertOne(comment);

  return NextResponse.json({ ok: true });
}
