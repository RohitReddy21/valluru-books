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

async function exportSheet(db, type, limit = 10000) {
  const definition = EXPORT_DEFINITIONS[type];
  const records = await db
    .collection(definition.collection)
    .find(definition.query || {})
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
      await syncContentPdfAssets(db, content);
      const booklets = content?.series?.booklets || [];
      const [subscribers, comments, bookletReaders, orders, recentMedia, counts] = await Promise.all([
        db.collection("subscribers").find({}).sort({ updatedAt: -1 }).limit(100).toArray(),
        db.collection("comments").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection("booklet_readers").find({}).sort({ updatedAt: -1 }).limit(150).toArray(),
        db.collection("orders").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
        db.collection("media_assets").find({}).sort({ createdAt: -1 }).limit(12).toArray(),
        Promise.all([
          db.collection("content").countDocuments({}),
          db.collection("subscribers").countDocuments({}),
          db.collection("comments").countDocuments({}),
          db.collection("booklet_readers").countDocuments({}),
          db.collection("orders").countDocuments({}),
          db.collection("media_assets").countDocuments({}),
          db.collection("media_assets").countDocuments({ kind: "pdf" })
        ])
      ]);
      const statusCount = (items, status) =>
        items.filter((item) => (item.status || "published") === status).length;

      response.json({
        counts: {
          content: counts[0],
          subscribers: counts[1],
          comments: counts[2],
          pdfs: counts[6],
          media: counts[5],
          bookReaders: counts[3],
          orders: counts[4],
          draftBooks: statusCount(booklets, "draft"),
          publishedBooks: statusCount(booklets, "published"),
          archivedBooks: statusCount(booklets, "archived"),
          draftPosts: 0,
          publishedPosts: 0
        },
        subscribers: subscribers.map(toAdminRecord),
        bookletReaders: bookletReaders.map(toAdminRecord),
        orders: orders.map(toAdminRecord),
        comments: comments.map(toAdminRecord),
        recentMedia: recentMedia.map(toAdminRecord),
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
          ...bookletReaders.slice(0, 5).map((reader) => ({
            type: "reader",
            label: `${reader.name || "Reader"} opened ${reader.bookletTitle || reader.bookletSlug}`,
            createdAt: reader.updatedAt
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
