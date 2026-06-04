import { NextRequest, NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content-store";
import { hasMongoConfig } from "@/lib/mongodb";
import { saveBookletPdfToDb } from "@/lib/pdf-store";

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

  const formData = await request.formData();
  const bookletSlug = String(formData.get("bookletSlug") || "");
  const file = formData.get("pdf");

  if (!bookletSlug) {
    return NextResponse.json({ error: "Choose a booklet." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF file." }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
  }

  if (!hasMongoConfig()) {
    return NextResponse.json(
      { error: "MONGODB_URI is required to store uploaded PDFs in the database." },
      { status: 500 }
    );
  }

  const content = await getSiteContent();
  const booklet = content.series.booklets.find((item) => item.slug === bookletSlug);

  if (!booklet) {
    return NextResponse.json({ error: "Booklet not found." }, { status: 404 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await saveBookletPdfToDb({
    slug: bookletSlug,
    file: fileBuffer,
    originalName: file.name
  });

  const publicUrl = `/api/booklets/${bookletSlug}/pdf`;
  booklet.pdf = publicUrl;
  await saveSiteContent(content);

  return NextResponse.json({
    ok: true,
    pdf: publicUrl,
    bookletSlug
  });
}
