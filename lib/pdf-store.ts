import { Readable } from "node:stream";
import { getMongoDb, getPdfBucket, hasMongoConfig } from "@/lib/mongodb";

export function getBookletPdfFilename(slug: string) {
  return `${slug}.pdf`;
}

export async function saveBookletPdfToDb({
  slug,
  file,
  originalName
}: {
  slug: string;
  file: Buffer;
  originalName: string;
}) {
  const bucket = await getPdfBucket();
  const db = await getMongoDb();
  const filename = getBookletPdfFilename(slug);
  const existingFiles = await db
    .collection<{ _id: unknown; filename: string }>("booklet_pdfs.files")
    .find({ filename })
    .toArray();
  const existingIds = existingFiles.map((fileDoc) => fileDoc._id);

  if (existingIds.length > 0) {
    await db.collection("booklet_pdfs.chunks").deleteMany({
      files_id: { $in: existingIds }
    });
    await db.collection("booklet_pdfs.files").deleteMany({
      _id: { $in: existingIds }
    });
  }

  await new Promise<void>((resolve, reject) => {
    const upload = bucket.openUploadStream(filename, {
      contentType: "application/pdf",
      metadata: {
        bookletSlug: slug,
        originalName,
        uploadedAt: new Date()
      }
    });

    Readable.from(file)
      .pipe(upload)
      .on("error", reject)
      .on("finish", () => resolve());
  });
}

export async function getBookletPdfFromDb(slug: string) {
  if (!hasMongoConfig()) {
    return null;
  }

  const bucket = await getPdfBucket();
  const filename = getBookletPdfFilename(slug);
  const existing = await bucket.find({ filename }).sort({ uploadDate: -1 }).limit(1).next();

  if (!existing) {
    return null;
  }

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStreamByName(filename, { revision: -1 })
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve());
  });

  return Buffer.concat(chunks);
}
