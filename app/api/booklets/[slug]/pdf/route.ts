import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSiteContent } from "@/lib/content-store";
import { getBookletPdfFromDb } from "@/lib/pdf-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const content = await getSiteContent();
  const booklet = content.series.booklets.find((item) => item.slug === slug);

  if (!booklet) {
    return NextResponse.json({ error: "Booklet not found." }, { status: 404 });
  }

  const isFree = slug === "booklet-one";
  const cookieStore = await cookies();
  const hasSubscriberAccess =
    cookieStore.get("valluru_subscribed")?.value === "true" ||
    cookieStore.get(`valluru_booklet_${slug}`)?.value === "true";

  if (!isFree && !hasSubscriberAccess) {
    return NextResponse.json(
      { error: "Subscribe before reading this booklet." },
      { status: 403 }
    );
  }

  const dbFile = await getBookletPdfFromDb(slug);

  if (dbFile) {
    return new Response(dbFile, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${slug}.pdf"`,
        "Cache-Control": "private, max-age=0, no-store"
      }
    });
  }

  const diskPath = path.join(process.cwd(), "data", "uploads", `${slug}.pdf`);
  try {
    const file = await readFile(diskPath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${slug}.pdf"`,
        "Cache-Control": "private, max-age=0, no-store"
      }
    });
  } catch {
    if (booklet.pdf && /^https?:\/\//.test(booklet.pdf)) {
      const response = await fetch(booklet.pdf);

      if (!response.ok) {
        return NextResponse.json(
          { error: "The remote PDF could not be loaded." },
          { status: response.status }
        );
      }

      const file = await response.arrayBuffer();
      return new Response(file, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${slug}.pdf"`,
          "Cache-Control": "private, max-age=0, no-store"
        }
      });
    }

    return NextResponse.json(
      { error: "No uploaded PDF is available for this booklet yet." },
      { status: 404 }
    );
  }
}
