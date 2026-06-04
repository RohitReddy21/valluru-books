import { GridFSBucket, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "valluru_books";

let clientPromise: Promise<MongoClient> | null = null;

export function hasMongoConfig() {
  return Boolean(uri);
}

export async function getMongoDb() {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(dbName);
}

export async function getPdfBucket() {
  const db = await getMongoDb();
  return new GridFSBucket(db, { bucketName: "booklet_pdfs" });
}

export async function getMediaBucket() {
  const db = await getMongoDb();
  return new GridFSBucket(db, { bucketName: "media_uploads" });
}
