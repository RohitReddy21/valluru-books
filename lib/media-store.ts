import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { getMediaBucket } from "@/lib/mongodb";

export async function saveMediaToDb({
  file,
  originalName,
  contentType
}: {
  file: Buffer;
  originalName: string;
  contentType: string;
}) {
  const bucket = await getMediaBucket();

  return new Promise<string>((resolve, reject) => {
    const upload = bucket.openUploadStream(originalName, {
      contentType,
      metadata: {
        originalName,
        uploadedAt: new Date()
      }
    });

    Readable.from(file)
      .pipe(upload)
      .on("error", reject)
      .on("finish", () => resolve(String(upload.id)));
  });
}

export async function getMediaFromDb(id: string) {
  const bucket = await getMediaBucket();
  const objectId = new ObjectId(id);
  const file = await bucket.find({ _id: objectId }).next();

  if (!file) {
    return null;
  }

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    bucket
      .openDownloadStream(objectId)
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve());
  });

  return {
    contentType: file.contentType || "application/octet-stream",
    file: Buffer.concat(chunks)
  };
}
