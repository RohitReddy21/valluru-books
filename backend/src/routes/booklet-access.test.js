const assert = require("node:assert/strict");
const { test } = require("node:test");

process.env.ACCESS_TOKEN_SECRET = "test-secret-for-booklet-access-routes";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.SUPABASE_KEY;

const { createAccessToken } = require("../access-tokens");
const { registerBookletAccessRoutes } = require("./booklet-access");

const chapters = ["1. One", "2. Two", "3. Three", "4. Four", "5. Five"].map((title, index) => ({
  id: `c${index + 1}`,
  number: index + 1,
  title,
  paragraphs: [`Body of ${title}.`],
  images: []
}));

const content = {
  series: {
    status: "published",
    booklets: [
      { slug: "booklet-a", title: "Booklet A", status: "published", pdf: "https://cdn.example.org/a.pdf", chapters },
      { slug: "booklet-b", title: "Booklet B", status: "published", pdf: "", chapters },
      { slug: "draft-booklet", title: "Draft", status: "draft", pdf: "https://cdn.example.org/d.pdf", chapters }
    ]
  }
};

function findContentBookletEntry(source, slug) {
  const booklet = source.series.booklets.find((item) => item.slug === slug);
  return booklet ? { booklet, series: source.series } : null;
}

/** Just enough of a collection for these routes: equality and $gte filters, and a write log. */
function fakeDb(subscribers = []) {
  const data = { subscribers: [...subscribers], booklet_unlocks: [], booklet_readers: [] };
  const writes = [];
  const matches = (row, filter) =>
    Object.entries(filter).every(([key, wanted]) => {
      if (wanted && typeof wanted === "object" && "$gte" in wanted) {
        return row[key] >= wanted.$gte;
      }

      return (row[key] ?? null) === wanted;
    });

  return {
    data,
    writes,
    collection: (name) => ({
      findOne: async (filter) => data[name].find((row) => matches(row, filter)) || null,
      insertOne: async (row) => {
        data[name].push(row);
        writes.push([name, "insert", row]);
      },
      updateOne: async (filter, update) => {
        writes.push([name, "update", filter, update]);
      }
    })
  };
}

function setup(db = fakeDb()) {
  const routes = {};
  const app = {
    get: (path, handler) => (routes[`GET ${path}`] = handler),
    post: (path, handler) => (routes[`POST ${path}`] = handler)
  };

  registerBookletAccessRoutes(app, {
    getDb: async () => db,
    getSiteContent: async () => content,
    findContentBookletEntry,
    isPublishedStatus: (status) => !status || status === "published"
  });

  return { routes, db };
}

async function call(handler, { params = {}, query = {}, body = {}, headers = {} } = {}) {
  const sent = { status: 200, body: undefined, headers: {} };
  const response = {
    status(code) {
      sent.status = code;
      return this;
    },
    json(payload) {
      sent.body = payload;
      return this;
    },
    set(key, value) {
      sent.headers[key] = value;
      return this;
    },
    redirect(target) {
      sent.status = 302;
      sent.redirect = target;
    },
    cookie() {},
    append() {},
    setHeader() {}
  };
  const request = {
    params,
    query,
    body,
    headers,
    ip: "10.0.0.1",
    socket: {},
    get: (name) => headers[String(name).toLowerCase()]
  };

  await handler(request, response, (error) => assert.fail(error));

  return sent;
}

test("the four booklet-access routes are registered", () => {
  const { routes } = setup();

  assert.deepEqual(Object.keys(routes).sort(), [
    "GET /api/booklets/:slug/chapters",
    "GET /api/booklets/:slug/pdf",
    "GET /api/booklets/:slug/pdf-link",
    "POST /api/track-unlock"
  ]);
});

test("chapters: a stranger gets the three free chapters and a subscriber gets the rest", async () => {
  const { routes } = setup();
  const handler = routes["GET /api/booklets/:slug/chapters"];
  const stranger = await call(handler, { params: { slug: "booklet-a" } });

  assert.equal(stranger.body.hasAccess, false);
  assert.deepEqual(stranger.body.chapters.map((chapter) => chapter.number), [1, 2, 3]);
  assert.equal(stranger.headers["Cache-Control"], "private, no-cache");

  const token = createAccessToken("booklet-a");
  const subscriber = await call(handler, { params: { slug: "booklet-a" }, query: { token } });

  assert.equal(subscriber.body.hasAccess, true);
  assert.equal(subscriber.body.chapters.length, 5);
  assert.equal(subscriber.headers["Cache-Control"], "private, no-store");
});

test("chapters: a token for another booklet opens nothing here", async () => {
  const { routes } = setup();
  const result = await call(routes["GET /api/booklets/:slug/chapters"], {
    params: { slug: "booklet-a" },
    query: { token: createAccessToken("booklet-b") }
  });

  assert.equal(result.body.hasAccess, false);
});

test("pdf-link: refuses without access, and for a booklet that is unknown, a draft, or has no file", async () => {
  const { routes } = setup();
  const handler = routes["GET /api/booklets/:slug/pdf-link"];
  const token = createAccessToken("booklet-a");

  assert.equal((await call(handler, { params: { slug: "booklet-a" } })).status, 401);
  assert.equal((await call(handler, { params: { slug: "booklet-a" }, query: { token: createAccessToken("booklet-b") } })).status, 401);
  assert.equal((await call(handler, { params: { slug: "nope" }, query: { token } })).status, 404);
  assert.equal((await call(handler, { params: { slug: "draft-booklet" }, query: { token: createAccessToken("draft-booklet") } })).status, 404);
  assert.equal((await call(handler, { params: { slug: "booklet-b" }, query: { token: createAccessToken("booklet-b") } })).status, 404);
});

test("pdf-link: with access, answers with a link, never cached", async () => {
  const { routes } = setup();
  const result = await call(routes["GET /api/booklets/:slug/pdf-link"], {
    params: { slug: "booklet-a" },
    query: { token: createAccessToken("booklet-a") }
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { url: "https://cdn.example.org/a.pdf", kind: "remote" });
  assert.equal(result.headers["Cache-Control"], "private, no-store");
});

test("pdf: streaming route applies the same access rules", async () => {
  const { routes } = setup();
  const handler = routes["GET /api/booklets/:slug/pdf"];

  assert.equal((await call(handler, { params: { slug: "booklet-a" } })).status, 401);
  assert.equal((await call(handler, { params: { slug: "nope" } })).status, 404);
});

test("track-unlock: an unverified email and name are not recorded, and the read is anonymous", async () => {
  const { routes, db } = setup();
  const result = await call(routes["POST /api/track-unlock"], {
    body: { bookletSlug: "booklet-a", email: "invented@example.invalid", name: "Invented", bookletTitle: "Forged" }
  });

  assert.equal(result.status, 200);
  assert.equal("accessToken" in result.body, false);
  assert.equal(db.data.booklet_unlocks.length, 1);
  assert.deepEqual(
    [db.data.booklet_unlocks[0].email, db.data.booklet_unlocks[0].name, db.data.booklet_unlocks[0].bookletTitle],
    [null, null, "Booklet A"]
  );
  assert.equal(db.writes.some(([name, kind]) => name === "subscribers" && kind === "update"), false);
});

test("track-unlock: a subscriber's address gets a token, and repeat calls in a sitting count once", async () => {
  const { routes, db } = setup(fakeDb([{ email: "reader@example.com", name: "Reader" }]));
  const handler = routes["POST /api/track-unlock"];
  const first = await call(handler, { body: { bookletSlug: "booklet-a", email: "reader@example.com" } });
  await call(handler, { body: { bookletSlug: "booklet-a", email: "reader@example.com" } });
  await call(handler, { body: { bookletSlug: "booklet-a", email: "reader@example.com" } });

  assert.equal(typeof first.body.accessToken, "string");
  assert.equal(db.data.booklet_unlocks.length, 1);
  assert.equal(db.data.booklet_unlocks[0].email, "reader@example.com");
});

test("track-unlock: missing and unknown booklets are rejected", async () => {
  const { routes } = setup();
  const handler = routes["POST /api/track-unlock"];

  assert.equal((await call(handler, { body: {} })).status, 400);
  assert.equal((await call(handler, { body: { bookletSlug: "nope", email: "x@example.com" } })).status, 404);
});
