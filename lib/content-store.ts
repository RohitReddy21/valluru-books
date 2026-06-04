import { defaultSiteContent, type SiteContent } from "@/lib/site-content";
import { getMongoDb, hasMongoConfig } from "@/lib/mongodb";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_KEY = "site-content";
const localContentPath = path.join(process.cwd(), "data", "site-content.json");

async function getLocalSiteContent() {
  try {
    const file = await readFile(localContentPath, "utf8");
    return JSON.parse(file) as SiteContent;
  } catch {
    return defaultSiteContent;
  }
}

async function saveLocalSiteContent(content: SiteContent) {
  await mkdir(path.dirname(localContentPath), { recursive: true });
  await writeFile(localContentPath, JSON.stringify(content, null, 2), "utf8");
}

export async function getSiteContent(): Promise<SiteContent> {
  if (!hasMongoConfig()) {
    return getLocalSiteContent();
  }

  try {
    const db = await getMongoDb();
    const doc = await db
      .collection<{ key: string; content: SiteContent }>("content")
      .findOne({ key: CONTENT_KEY });

    return doc?.content || defaultSiteContent;
  } catch {
    return getLocalSiteContent();
  }
}

export async function saveSiteContent(content: SiteContent) {
  if (!hasMongoConfig()) {
    await saveLocalSiteContent(content);
    return;
  }

  const db = await getMongoDb();
  await db.collection("content").updateOne(
    { key: CONTENT_KEY },
    {
      $set: {
        content,
        updatedAt: new Date()
      },
      $setOnInsert: {
        key: CONTENT_KEY,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
}

export function getContentSource() {
  return hasMongoConfig() ? "mongodb" : "local file";
}
