const fsp = require("node:fs/promises");
const { ObjectId } = require("mongodb");

const EXPORT_DEFINITIONS = {
  subscribers: {
    collection: "subscribers",
    title: "Subscribers",
    sort: { updatedAt: -1, createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["lastSource", "Source"],
      ["lastBookletTitle", "Last Booklet"],
      ["subscribedBooklets", "Subscribed Booklets"],
      ["lastEmailDelivery.subscriber.status", "Subscriber Email Status"],
      ["lastEmailDelivery.owner.status", "Owner Email Status"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"],
      ["lastEmailAttemptAt", "Last Email Attempt"]
    ]
  },
  subscribers_without_unlock: {
    collection: "subscribers",
    title: "Subscribers Without Unlock",
    sort: { updatedAt: -1, createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["lastSource", "Source"],
      ["lastBookletTitle", "Last Booklet"],
      ["subscribedBooklets", "Subscribed Booklets"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"]
    ]
  },
  booklet_readers: {
    collection: "booklet_readers",
    title: "Booklet Readers",
    sort: { updatedAt: -1, createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["bookletSlug", "Booklet Slug"],
      ["bookletTitle", "Booklet Title"],
      ["source", "Source"],
      ["readCount", "Read Count"],
      ["lastReadAt", "Last Read At"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"]
    ]
  },
  booklet_unlocks: {
    collection: "booklet_unlocks",
    title: "Booklet Unlocks",
    sort: { unlockedAt: -1, createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["email", "Email"],
      ["bookletSlug", "Booklet Slug"],
      ["bookletTitle", "Booklet Title"],
      ["source", "Source"],
      ["unlockedAt", "Unlocked At"],
      ["ip", "IP Address"],
      ["userAgent", "User Agent"]
    ]
  },
  orders: {
    collection: "orders",
    title: "Orders",
    sort: { createdAt: -1 },
    query: {},
    fields: [
      ["orderNumber", "Order Number"],
      ["status", "Status"],
      ["customer.name", "Customer Name"],
      ["customer.phone", "Phone"],
      ["customer.email", "Email"],
      ["customer.address", "Address"],
      ["items", "Items"],
      ["total", "Total"],
      ["currency", "Currency"],
      ["notes", "Notes"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"]
    ]
  },
  comments: {
    collection: "comments",
    title: "Comments",
    sort: { createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["bookletSlug", "Booklet Slug"],
      ["rating", "Rating"],
      ["comment", "Comment"],
      ["createdAt", "Created At"]
    ]
  },
  media: {
    collection: "media_assets",
    title: "Media",
    sort: { createdAt: -1 },
    query: {},
    fields: [
      ["name", "Name"],
      ["kind", "Kind"],
      ["folder", "Folder"],
      ["source", "Source"],
      ["provider", "Provider"],
      ["fileType", "File Type"],
      ["fileSize", "File Size"],
      ["url", "URL"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"]
    ]
  },
  pdfs: {
    collection: "media_assets",
    title: "PDFs",
    sort: { createdAt: -1 },
    query: { kind: "pdf" },
    fields: [
      ["name", "Name"],
      ["folder", "Folder"],
      ["source", "Source"],
      ["assignedTo.type", "Assigned Type"],
      ["assignedTo.title", "Assigned Title"],
      ["assignedTo.field", "Assigned Field"],
      ["fileSize", "File Size"],
      ["url", "URL"],
      ["createdAt", "Created At"],
      ["updatedAt", "Updated At"]
    ]
  }
};

const EXPORT_TYPE_NAMES = Object.keys(EXPORT_DEFINITIONS);

function toAdminRecord(document) {
  if (!document) {
    return null;
  }

  const { _id, ...rest } = document;
  return {
    ...rest,
    id: _id ? String(_id) : undefined
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getNestedValue(record, path) {
  return String(path)
    .split(".")
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);
}

async function enrichWithSubscriberData(db, records) {
  // Get all unique emails from records
  const emails = records
    .map(record => record.email)
    .filter(email => email)
    .map(email => normalizeEmail(email));
  
  // Fetch subscribers for those emails
  const subscribers = emails.length > 0 
    ? await db.collection("subscribers").find({ email: { $in: emails } }).toArray()
    : [];
  
  // Create a map by normalized email
  const subscriberMap = new Map();
  subscribers.forEach(sub => {
    subscriberMap.set(normalizeEmail(sub.email), sub);
  });
  
  // Enrich each record
  return records.map(record => {
    const normalizedEmail = normalizeEmail(record.email);
    const subscriber = subscriberMap.get(normalizedEmail);
    
    if (subscriber) {
      return {
        ...record,
        name: record.name || subscriber.name,
        email: record.email || subscriber.email
      };
    }
    
    return record;
  });
}

function formatExportValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          if ("title" in item || "quantity" in item) {
            return `${item.title || "Item"} x ${item.quantity || 1}`;
          }
          return JSON.stringify(item);
        }
        return String(item);
      })
      .join("; ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function csvCell(value) {
  const text = formatExportValue(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(definition, records) {
  const header = definition.fields.map(([, label]) => csvCell(label)).join(",");
  const body = records.map((record) =>
    definition.fields.map(([key]) => csvCell(getNestedValue(record, key))).join(",")
  );

  return [header, ...body].join("\r\n");
}

function buildExcelHtml(sheets) {
  const sheetNames = sheets
    .map((sheet) => sheet.title.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Sheet")
    .map((name, index, all) => {
      if (all.indexOf(name) === index) {
        return name;
      }
      return `${name.slice(0, 27)} ${index + 1}`.trim();
    });

  const worksheetMeta = sheetNames
    .map(
      (name) => `
        <x:ExcelWorksheet>
          <x:Name>${escapeHtml(name)}</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>`
    )
    .join("");

  const sections = sheets
    .map((sheet, index) => {
      const header = sheet.definition.fields
        .map(([, label]) => `<th>${escapeHtml(label)}</th>`)
        .join("");
      const rows = sheet.records
        .map(
          (record) => `<tr>${sheet.definition.fields
            .map(([key]) => `<td>${escapeHtml(formatExportValue(getNestedValue(record, key)))}</td>`)
            .join("")}</tr>`
        )
        .join("");

      return `
        <section ${index > 0 ? 'style="page-break-before:always;"' : ""}>
          <h2>${escapeHtml(sheet.title)}</h2>
          <table>
            <thead><tr>${header}</tr></thead>
            <tbody>${rows || `<tr><td colspan="${sheet.definition.fields.length}">No records found.</td></tr>`}</tbody>
          </table>
        </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>${worksheetMeta}</x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; color: #222; }
    h2 { color: #8a6a2e; margin: 0 0 12px; }
    table { border-collapse: collapse; margin-bottom: 28px; width: 100%; }
    th { background: #1f2933; color: #fff; font-weight: 700; }
    th, td { border: 1px solid #cfc7b2; padding: 7px 9px; vertical-align: top; mso-number-format:"\\@"; }
    td { background: #fffdf7; }
  </style>
</head>
<body>${sections}</body>
</html>`;
}

function safeExportType(value) {
  const type = String(value || "all").trim().toLowerCase();
  if (type === "all") {
    return type;
  }
  return EXPORT_DEFINITIONS[type] ? type : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => String(cell).trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => String(cell).trim())) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseSubscriberImport(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const record = {};
    row.forEach((value, index) => {
      record[headers[index] || `column${index + 1}`] = value.trim();
    });
    return record;
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function subscriberPayload(body = {}, { partial = false } = {}) {
  const email = normalizeEmail(body.email || body.Email);
  const name = String(body.name || body.Name || "").trim();
  const lastSource = String(body.lastSource || body.source || body.Source || "admin").trim();
  const lastBookletTitle = String(
    body.lastBookletTitle || body.bookletTitle || body["lastbooklet"] || body["book"] || ""
  ).trim();
  const subscribedBooklets = asStringArray(
    body.subscribedBooklets || body.booklets || body.subscribedbooklets || body["subscribedbooklets"]
  );

  if (!partial && !email) {
    throw new Error("Email is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required.");
  }

  const patch = {};

  if (email) {
    patch.email = email;
  }
  if (name || !partial) {
    patch.name = name;
  }
  if (lastSource || !partial) {
    patch.lastSource = lastSource || "admin";
  }
  if (lastBookletTitle || !partial) {
    patch.lastBookletTitle = lastBookletTitle || null;
  }
  if (subscribedBooklets.length || !partial) {
    patch.subscribedBooklets = subscribedBooklets;
  }

  return patch;
}

function objectIdFromParam(id) {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  return new ObjectId(id);
}

async function engagedSubscriberEmails(db) {
  const [readerEmails, unlockEmails] = await Promise.all([
    db.collection("booklet_readers").distinct("email"),
    db.collection("booklet_unlocks").distinct("email")
  ]);

  return Array.from(
    new Set([...readerEmails, ...unlockEmails].map(normalizeEmail).filter(Boolean))
  );
}

function subscribersWithoutUnlockQuery(engagedEmails) {
  return engagedEmails.length ? { email: { $nin: engagedEmails } } : {};
}

function recordTime(record) {
  const value = record?.lastReadAt || record?.updatedAt || record?.unlockedAt || record?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readerRecordKey(record) {
  const email = normalizeEmail(record?.email);
  const bookletSlug = String(record?.bookletSlug || "").trim();
  const ip = String(record?.ip || "").trim();
  const name = String(record?.name || "").trim().toLowerCase();

  if (email && bookletSlug) {
    return `email:${email}:${bookletSlug}`;
  }

  if (ip && bookletSlug) {
    return `ip:${ip}:${bookletSlug}`;
  }

  if (name && bookletSlug) {
    return `name:${name}:${bookletSlug}`;
  }

  return `record:${String(record?._id || record?.id || record?.unlockedAt || record?.createdAt || "")}`;
}

function readerFromUnlock(unlock) {
  const unlockedAt = unlock.unlockedAt || unlock.createdAt;
  return {
    _id: unlock._id,
    name: unlock.name || undefined,
    email: unlock.email || undefined,
    bookletSlug: unlock.bookletSlug,
    bookletTitle: unlock.bookletTitle,
    source: unlock.source || "track-unlock",
    readCount: 1,
    lastReadAt: unlockedAt,
    updatedAt: unlockedAt,
    createdAt: unlock.createdAt || unlockedAt,
    ip: unlock.ip,
    userAgent: unlock.userAgent
  };
}

function normalizedUnlockRecord(unlock) {
  const unlockedAt = unlock.unlockedAt || unlock.lastReadAt || unlock.updatedAt || unlock.createdAt;
  return {
    ...unlock,
    unlockedAt,
    createdAt: unlock.createdAt || unlockedAt
  };
}

function unlockFromReader(reader) {
  const unlockedAt = reader.lastReadAt || reader.updatedAt || reader.createdAt;
  return {
    _id: reader._id,
    name: reader.name || undefined,
    email: reader.email || undefined,
    bookletSlug: reader.bookletSlug,
    bookletTitle: reader.bookletTitle,
    source: reader.source || "booklet-reader",
    unlockedAt,
    createdAt: reader.createdAt || unlockedAt,
    ip: reader.ip,
    userAgent: reader.userAgent
  };
}

function mergeBookletReaderRecords(readers = [], unlocks = [], limit = 150) {
  const recordsByKey = new Map();

  readers.forEach((reader) => {
    recordsByKey.set(readerRecordKey(reader), reader);
  });

  unlocks.forEach((unlock) => {
    const key = readerRecordKey(unlock);
    const existing = recordsByKey.get(key);
    const unlockReader = readerFromUnlock(unlock);

    if (!existing) {
      recordsByKey.set(key, unlockReader);
      return;
    }

    const unlockIsNewer = recordTime(unlockReader) > recordTime(existing);
    recordsByKey.set(key, {
      ...existing,
      name: existing.name || unlockReader.name,
      email: existing.email || unlockReader.email,
      bookletTitle: existing.bookletTitle || unlockReader.bookletTitle,
      source: existing.source || unlockReader.source,
      readCount: existing.readCount || unlockReader.readCount || 1,
      lastReadAt: unlockIsNewer ? unlockReader.lastReadAt : existing.lastReadAt,
      updatedAt: unlockIsNewer ? unlockReader.updatedAt : existing.updatedAt
    });
  });

  return Array.from(recordsByKey.values())
    .sort((left, right) => recordTime(right) - recordTime(left))
    .slice(0, limit);
}

function mergeBookletUnlockRecords(unlocks = [], readers = [], limit = 150) {
  // For debugging, just return all unlocks mapped through normalizedUnlockRecord first
  console.log("[mergeBookletUnlockRecords] Unlocks incoming:", unlocks.length, unlocks);
  const normalizedUnlocks = unlocks.map(normalizedUnlockRecord);
  console.log("[mergeBookletUnlockRecords] normalizedUnlocks:", normalizedUnlocks.length, normalizedUnlocks);
  
  // Now try the normal logic
  const recordsByKey = new Map();

  unlocks.forEach((unlock) => {
    const key = readerRecordKey(unlock);
    console.log("[mergeBookletUnlockRecords] Processing unlock, key:", key, unlock);
    recordsByKey.set(key, normalizedUnlockRecord(unlock));
  });

  readers.forEach((reader) => {
    const key = readerRecordKey(reader);
    const existing = recordsByKey.get(key);
    const readerUnlock = unlockFromReader(reader);

    if (!existing) {
      recordsByKey.set(key, readerUnlock);
      return;
    }

    const readerIsNewer = recordTime(readerUnlock) > recordTime(existing);
    recordsByKey.set(key, {
      ...existing,
      name: existing.name || readerUnlock.name,
      email: existing.email || readerUnlock.email,
      bookletTitle: existing.bookletTitle || readerUnlock.bookletTitle,
      source: existing.source || readerUnlock.source,
      unlockedAt: readerIsNewer ? readerUnlock.unlockedAt : existing.unlockedAt,
      createdAt: existing.createdAt || readerUnlock.createdAt
    });
  });

  const result = Array.from(recordsByKey.values())
    .sort((left, right) => recordTime(right) - recordTime(left))
    .slice(0, limit);
  console.log("[mergeBookletUnlockRecords] Final result:", result.length, result);

  return result;
}

async function getBookletActivityData(db, limit = 150) {
  console.log("[getBookletActivityData] Starting to fetch data...");
  const [bookletReaders, rawBookletReaders] = await Promise.all([
    db.collection("booklet_readers").find({}).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).toArray(),
    db.collection("booklet_readers").countDocuments({})
  ]);

  console.log("[getBookletActivityData] Raw data:", {
    rawBookletReaders,
    bookletReadersLength: bookletReaders.length,
    bookletReaders
  });

  // Enrich with subscriber data to fill in missing name/email
  const enrichedReaders = await enrichWithSubscriberData(db, bookletReaders);

  return {
    rawBookletReaders,
    rawBookletUnlocks: 0, // Not used anymore
    mergedBookletReaders: enrichedReaders,
    mergedBookletUnlocks: enrichedReaders.map(reader => ({
      ...reader,
      unlockedAt: reader.lastReadAt || reader.updatedAt || reader.createdAt
    })),
    rawBookletUnlocksArray: enrichedReaders // Keep for compatibility
  };
}

async function subscribersWithoutUnlockData(db, limit = 100) {
  const engagedEmails = await engagedSubscriberEmails(db);
  const query = subscribersWithoutUnlockQuery(engagedEmails);
  const [records, count] = await Promise.all([
    db
      .collection("subscribers")
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray(),
    db.collection("subscribers").countDocuments(query)
  ]);

  return { records, count };
}

async function exportSheet(db, type, limit = 10000) {
  const definition = EXPORT_DEFINITIONS[type];
  if (type === "booklet_readers" || type === "booklet_unlocks") {
    const [readers, unlocks] = await Promise.all([
      db
        .collection("booklet_readers")
        .find(type === "booklet_readers" ? definition.query || {} : {})
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray(),
      db
        .collection("booklet_unlocks")
        .find(type === "booklet_unlocks" ? definition.query || {} : {})
        .sort({ unlockedAt: -1, createdAt: -1 })
        .limit(limit)
        .toArray()
    ]);

    // Enrich both readers and unlocks with subscriber data first
    const enrichedReaders = await enrichWithSubscriberData(db, readers);
    const enrichedUnlocks = await enrichWithSubscriberData(db, unlocks);

    return {
      type,
      title: definition.title,
      definition,
      records:
        type === "booklet_readers"
          ? mergeBookletReaderRecords(enrichedReaders, enrichedUnlocks, limit)
          : mergeBookletUnlockRecords(enrichedUnlocks, enrichedReaders, limit)
    };
  }

  const query =
    type === "subscribers_without_unlock"
      ? subscribersWithoutUnlockQuery(await engagedSubscriberEmails(db))
      : definition.query || {};
  const records = await db
    .collection(definition.collection)
    .find(query)
    .sort(definition.sort || { createdAt: -1 })
    .limit(limit)
    .toArray();

  return {
    type,
    title: definition.title,
    definition,
    records
  };
}

function sendDownload(response, { body, filename, contentType }) {
  response.setHeader("Content-Type", `${contentType}; charset=utf-8`);
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  response.send(body);
}

function registerAdminDataRoutes(
  app,
  { verifyAdmin, requireMongo, getDb, getSiteContent, syncContentPdfAssets, upload, cleanupUploadedFile }
) {
  app.get("/api/admin/data", verifyAdmin, async (_request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const db = await getDb();
      const content = await getSiteContent();
      try {
        await syncContentPdfAssets(db, content);
      } catch (error) {
        console.error("[admin-data] PDF/media sync failed while loading dashboard data:", error);
      }
      const booklets = content?.series?.booklets || [];
      const [subscribers, comments, orders, recentMedia, bookletActivity, counts] = await Promise.all([
        db.collection("subscribers").find({}).sort({ updatedAt: -1 }).limit(100).toArray(),
        db.collection("comments").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection("orders").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection("media_assets").find({}).sort({ createdAt: -1 }).limit(12).toArray(),
        getBookletActivityData(db),
        Promise.all([
          db.collection("content").countDocuments({}),
          db.collection("subscribers").countDocuments({}),
          db.collection("comments").countDocuments({}),
          db.collection("orders").countDocuments({}),
          db.collection("media_assets").countDocuments({}),
          db.collection("media_assets").countDocuments({ kind: "pdf" })
        ])
      ]);
      const subscribersWithoutUnlock = await subscribersWithoutUnlockData(db);
      const statusCount = (items, status) =>
        items.filter((item) => (item.status || "published") === status).length;

      response.json({
        counts: {
          content: counts[0],
          subscribers: counts[1],
          comments: counts[2],
          pdfs: counts[5],
          media: counts[4],
          bookReaders: Math.max(bookletActivity.rawBookletReaders, bookletActivity.mergedBookletReaders.length),
          orders: counts[3],
          bookletUnlocks: Math.max(bookletActivity.rawBookletUnlocks, bookletActivity.mergedBookletUnlocks.length),
          subscribersWithoutUnlock: subscribersWithoutUnlock.count,
          draftBooks: statusCount(booklets, "draft"),
          publishedBooks: statusCount(booklets, "published"),
          archivedBooks: statusCount(booklets, "archived"),
          draftPosts: 0,
          publishedPosts: 0
        },
        subscribers: subscribers.map(toAdminRecord),
        subscribersWithoutUnlock: subscribersWithoutUnlock.records.map(toAdminRecord),
        bookletReaders: bookletActivity.mergedBookletReaders.map(toAdminRecord),
        bookletUnlocks: bookletActivity.rawBookletUnlocksArray.map(toAdminRecord), // use raw array for testing!
        orders: orders.map(toAdminRecord),
        comments: comments.map(toAdminRecord),
        recentMedia: recentMedia.map(toAdminRecord),
        adminDebug: {
          database: db.databaseName,
          rawBookletReaders: bookletActivity.rawBookletReaders,
          rawBookletUnlocks: bookletActivity.rawBookletUnlocks,
          returnedBookletReaders: bookletActivity.mergedBookletReaders.length,
          returnedBookletUnlocks: bookletActivity.mergedBookletUnlocks.length
        },
        recentActivity: [
          ...orders.slice(0, 5).map((order) => ({
            type: "order",
            label: `${order.orderNumber} - ${order.customer?.name || "Customer"}`,
            createdAt: order.createdAt
          })),
          ...comments.slice(0, 5).map((comment) => ({
            type: "comment",
            label: `${comment.name || "Reader"} commented on ${comment.bookletSlug}`,
            createdAt: comment.createdAt
          })),
          ...subscribersWithoutUnlock.records.slice(0, 5).map((subscriber) => ({
            type: "subscriber",
            label: `${subscriber.name || subscriber.email || "Subscriber"} subscribed via ${
              subscriber.lastSource || "newsletter"
            }`,
            createdAt: subscriber.updatedAt || subscriber.createdAt
          })),
          ...bookletActivity.mergedBookletReaders.slice(0, 5).map((reader) => ({
            type: "reader",
            label: `${reader.name || "Reader"} opened ${reader.bookletTitle || reader.bookletSlug}`,
            createdAt: reader.lastReadAt || reader.updatedAt || reader.createdAt
          })),
          ...bookletActivity.mergedBookletUnlocks.slice(0, 5).map((unlock) => ({
            type: "unlock",
            label: `${unlock.name || "Reader"} unlocked ${unlock.bookletTitle || unlock.bookletSlug}`,
            createdAt: unlock.unlockedAt || unlock.createdAt
          }))
        ]
          .filter((item) => item.createdAt)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/booklet-activity", verifyAdmin, async (_request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const db = await getDb();
      const bookletActivity = await getBookletActivityData(db);

      response.json({
        counts: {
          bookReaders: Math.max(bookletActivity.rawBookletReaders, bookletActivity.mergedBookletReaders.length),
          bookletUnlocks: Math.max(bookletActivity.rawBookletUnlocks, bookletActivity.mergedBookletUnlocks.length)
        },
        bookletReaders: bookletActivity.mergedBookletReaders.map(toAdminRecord),
        bookletUnlocks: bookletActivity.rawBookletUnlocksArray.map(toAdminRecord), // use raw array for testing!
        adminDebug: {
          database: db.databaseName,
          rawBookletReaders: bookletActivity.rawBookletReaders,
          rawBookletUnlocks: bookletActivity.rawBookletUnlocks,
          returnedBookletReaders: bookletActivity.mergedBookletReaders.length,
          returnedBookletUnlocks: bookletActivity.mergedBookletUnlocks.length
        }
      });
    } catch (error) {
      console.error("[admin-booklet-activity] Failed to load booklet activity:", error);
      next(error);
    }
  });

  app.get(["/api/admin/export", "/api/admin/export/:type"], verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const type = safeExportType(request.params.type || request.query.type || "all");
      const format = String(request.query.format || "xls").trim().toLowerCase();

      if (!type) {
        response.status(400).json({
          error: `Invalid export type. Use one of: all, ${EXPORT_TYPE_NAMES.join(", ")}.`
        });
        return;
      }

      if (!["xls", "csv"].includes(format)) {
        response.status(400).json({ error: "Invalid export format. Use xls or csv." });
        return;
      }

      const db = await getDb();
      const exportTypes = type === "all" ? EXPORT_TYPE_NAMES : [type];
      const sheets = await Promise.all(exportTypes.map((exportType) => exportSheet(db, exportType)));
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === "csv") {
        if (sheets.length !== 1) {
          response.status(400).json({ error: "CSV export supports one data type at a time." });
          return;
        }

        sendDownload(response, {
          body: buildCsv(sheets[0].definition, sheets[0].records),
          filename: `valluru-${sheets[0].type}-${stamp}.csv`,
          contentType: "text/csv"
        });
        return;
      }

      sendDownload(response, {
        body: buildExcelHtml(sheets),
        filename: `valluru-${type}-export-${stamp}.xls`,
        contentType: "application/vnd.ms-excel"
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/subscribers", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const search = String(request.query.search || "").trim();
      const query = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { lastBookletTitle: { $regex: search, $options: "i" } }
            ]
          }
        : {};

      const db = await getDb();
      const subscribers = await db
        .collection("subscribers")
        .find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(250)
        .toArray();

      response.json({ subscribers: subscribers.map(toAdminRecord) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/subscribers", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const patch = subscriberPayload(request.body || {});
      const now = new Date();
      const db = await getDb();
      await db.collection("subscribers").updateOne(
        { email: patch.email },
        {
          $set: {
            name: patch.name,
            email: patch.email,
            lastSource: patch.lastSource,
            lastBookletTitle: patch.lastBookletTitle,
            updatedAt: now
          },
          ...(patch.subscribedBooklets?.length
            ? { $addToSet: { subscribedBooklets: { $each: patch.subscribedBooklets } } }
            : {}),
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );

      const subscriber = await db.collection("subscribers").findOne({ email: patch.email });
      response.status(201).json({ ok: true, subscriber: toAdminRecord(subscriber) });
    } catch (error) {
      response.status(400).json({ error: error.message || "Subscriber save failed." });
    }
  });

  app.patch("/api/admin/subscribers/:id", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const id = objectIdFromParam(request.params.id);
      if (!id) {
        response.status(400).json({ error: "Invalid subscriber id." });
        return;
      }

      const patch = subscriberPayload(request.body || {}, { partial: true });
      const db = await getDb();

      if (patch.email) {
        const duplicate = await db.collection("subscribers").findOne({
          _id: { $ne: id },
          email: patch.email
        });

        if (duplicate) {
          response.status(409).json({ error: "Another subscriber already uses this email." });
          return;
        }
      }

      const update = {
        $set: {
          ...Object.fromEntries(
            Object.entries(patch).filter(([key]) => key !== "subscribedBooklets")
          ),
          updatedAt: new Date()
        }
      };

      if ("subscribedBooklets" in patch) {
        update.$set.subscribedBooklets = patch.subscribedBooklets;
      }

      const result = await db.collection("subscribers").updateOne({ _id: id }, update);
      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Subscriber not found." });
        return;
      }

      const subscriber = await db.collection("subscribers").findOne({ _id: id });
      response.json({ ok: true, subscriber: toAdminRecord(subscriber) });
    } catch (error) {
      response.status(400).json({ error: error.message || "Subscriber update failed." });
    }
  });

  app.delete("/api/admin/subscribers/:id", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const id = objectIdFromParam(request.params.id);
      if (!id) {
        response.status(400).json({ error: "Invalid subscriber id." });
        return;
      }

      const db = await getDb();
      const result = await db.collection("subscribers").deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        response.status(404).json({ error: "Subscriber not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Booklet Readers CRUD Routes
  app.get("/api/admin/booklet-readers", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const search = String(request.query.search || "").trim();
      const query = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { bookletSlug: { $regex: search, $options: "i" } },
              { bookletTitle: { $regex: search, $options: "i" } }
            ]
          }
        : {};

      const db = await getDb();
      let readers = await db
        .collection("booklet_readers")
        .find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(250)
        .toArray();

      // Enrich with subscriber data
      readers = await enrichWithSubscriberData(db, readers);

      response.json({ bookletReaders: readers.map(toAdminRecord) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/booklet-readers", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const { name, email, bookletSlug, bookletTitle, source, readCount } = request.body;

      if (!bookletSlug) {
        response.status(400).json({ error: "bookletSlug is required." });
        return;
      }

      const db = await getDb();
      const now = new Date();
      const newReader = {
        name: name || null,
        email: email || null,
        bookletSlug,
        bookletTitle: bookletTitle || null,
        source: source || "admin",
        readCount: readCount || 1,
        updatedAt: now,
        lastReadAt: now,
        createdAt: now
      };

      const result = await db.collection("booklet_readers").insertOne(newReader);
      const reader = await db.collection("booklet_readers").findOne({ _id: result.insertedId });

      response.status(201).json({ ok: true, bookletReader: toAdminRecord(reader) });
    } catch (error) {
      response.status(400).json({ error: error.message || "Booklet reader save failed." });
    }
  });

  app.patch("/api/admin/booklet-readers/:id", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const id = objectIdFromParam(request.params.id);
      if (!id) {
        response.status(400).json({ error: "Invalid booklet reader id." });
        return;
      }

      const { name, email, bookletSlug, bookletTitle, source, readCount } = request.body;
      const db = await getDb();

      const update = {
        updatedAt: new Date()
      };

      if (name !== undefined) update.name = name;
      if (email !== undefined) update.email = email;
      if (bookletSlug !== undefined) update.bookletSlug = bookletSlug;
      if (bookletTitle !== undefined) update.bookletTitle = bookletTitle;
      if (source !== undefined) update.source = source;
      if (readCount !== undefined) update.readCount = readCount;

      const result = await db.collection("booklet_readers").updateOne(
        { _id: id },
        { $set: update }
      );

      if (result.matchedCount === 0) {
        response.status(404).json({ error: "Booklet reader not found." });
        return;
      }

      const reader = await db.collection("booklet_readers").findOne({ _id: id });
      response.json({ ok: true, bookletReader: toAdminRecord(reader) });
    } catch (error) {
      response.status(400).json({ error: error.message || "Booklet reader update failed." });
    }
  });

  app.delete("/api/admin/booklet-readers/:id", verifyAdmin, async (request, response, next) => {
    try {
      if (!requireMongo(response)) {
        return;
      }

      const id = objectIdFromParam(request.params.id);
      if (!id) {
        response.status(400).json({ error: "Invalid booklet reader id." });
        return;
      }

      const db = await getDb();
      const result = await db.collection("booklet_readers").deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        response.status(404).json({ error: "Booklet reader not found." });
        return;
      }

      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/admin/subscribers/import",
    verifyAdmin,
    upload.single("file"),
    async (request, response, next) => {
      try {
        if (!requireMongo(response)) {
          return;
        }

        if (!request.file) {
          response.status(400).json({ error: "Choose a CSV file exported from Excel." });
          return;
        }

        const text = await fsp.readFile(request.file.path, "utf8");
        const rows = parseSubscriberImport(text);
        const db = await getDb();
        const now = new Date();
        const results = {
          imported: 0,
          skipped: 0,
          errors: []
        };

        for (const [index, row] of rows.entries()) {
          try {
            const patch = subscriberPayload(row);
            await db.collection("subscribers").updateOne(
              { email: patch.email },
              {
                $set: {
                  name: patch.name,
                  email: patch.email,
                  lastSource: patch.lastSource,
                  lastBookletTitle: patch.lastBookletTitle,
                  updatedAt: now
                },
                ...(patch.subscribedBooklets?.length
                  ? { $addToSet: { subscribedBooklets: { $each: patch.subscribedBooklets } } }
                  : {}),
                $setOnInsert: { createdAt: now }
              },
              { upsert: true }
            );
            results.imported += 1;
          } catch (error) {
            results.skipped += 1;
            results.errors.push(`Row ${index + 2}: ${error.message}`);
          }
        }

        response.json({ ok: true, ...results });
      } catch (error) {
        next(error);
      } finally {
        await cleanupUploadedFile(request.file);
      }
    }
  );
}

module.exports = {
  registerAdminDataRoutes
};
