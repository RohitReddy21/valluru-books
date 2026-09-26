---
name: valluru-site-engineering
description: Engineering plan for thevalluru.org - performance fixes, depth-gated booklet reading, and the chapter migration. Use when working on the site's repo (thevalluruorgsandbox or valluru-books), or on any booklet reading, sign-up gate, caching, or chapter-extraction work for The Valluru.
---

# thevalluru.org — site engineering

Everything needed to continue this work from a cold start.

## The product context (drives every technical choice)

The Valluru publishes contemplative booklets. Instagram Reels and YouTube Shorts drive
traffic; each reel quotes one booklet and must land the viewer **on that booklet**.
Booklets are free to read after an email sign-up. The business metric is **sign-ups per
100 link clicks** (target 25%+), not pageviews.

### Locked decisions — do not relitigate

- Chapters 1–3 of **every** booklet are free and public; the gate sits at the chapter 3/4
  boundary. Gate by *depth*, never by booklet — a reel about Booklet 5 must not land
  someone on "read Booklet 1 instead".
- The sign-up moment offers something **added** (rest of the booklet, illustrated PDF,
  notice when the next is ready) rather than withholding access at the door.
- The site-wide pop-up (5s, name + email, no close button) is to be replaced by the
  in-page gate. An undismissable interstitial also risks Google's intrusive-interstitial
  penalty on mobile.
- Email only — drop the name field.
- Every reel must quote from chapters 1–3 of its booklet, so the promise in the video
  always matches what the reader can read.

### Still open

- **Interior illustrations.** Do text chapters carry the plates, or does the illustrated
  PDF stay the subscriber reward? Largest single variable in Phase 3.
- **The pop-up.** Removing an undismissable wall is Sasidhar's business call, not a
  technical one.

## Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind 3, TypeScript, ESLint at zero
  warnings. Deployed on Vercel.
- **Backend:** Express (`backend/server.js`, ~3.9k lines) on **Render free tier** — sleeps
  when idle, cold starts are slow.
- **Data:** MongoDB for site content behind an admin editor; Supabase storage for PDFs and
  images.
- **Repos:** sandbox `uppikodari/thevalluruorgsandbox`; production deploys
  `www.thevalluru.org`.

### Environment keys

Backend (`backend/.env`, from `backend/.env.example`):

| Key | Sandbox value |
| --- | --- |
| `MONGODB_URI` | sandbox cluster connection string — never production |
| `MONGODB_DB` | `valluru_sandbox` |
| `SUPABASE_URL` | sandbox Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | sandbox service key (`SUPABASE_SERVICE_KEY` also accepted) |
| `REVALIDATE_SECRET` | shared with the frontend; must match |
| `FRONTEND_REVALIDATE_URL` | frontend origin for the revalidate ping |
| `ACCESS_TOKEN_SECRET` | long random value — **the booklet gate depends on it**; see Phase 2 |
| `ADMIN_PASSWORD` | admin editor login, and the fallback signing secret when the above is unset |

Frontend (`frontend/.env.local`, from `frontend/.env.example`):

| Key | Sandbox value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | sandbox backend origin |
| `REVALIDATE_SECRET` | same value as the backend |

`getApiBaseUrl()` (`frontend/lib/api.ts`) reads `NEXT_PUBLIC_API_BASE_URL`, then
`API_BASE_URL`, then falls back to `http://127.0.0.1:4000` on the server.

## Ranked problems (found by reading the code, not guessing)

| # | Problem | Where | Status |
| --- | --- | --- | --- |
| 1 | Every public page `force-dynamic` + `/api/content` fetched `no-store`, twice per page (layout + page) | all page files; `frontend/lib/content-store.ts` | Fixed in Phase 1 |
| 2 | Booklets are PDF-only, rendered page-by-page to canvas → PNG data URLs held in React state | `frontend/components/pdf-book-modal.tsx` | Phase 3 — text path built, awaiting chapter import |
| 3 | The gate is decorative: `verifyAccessToken` defined but **never called**; `/api/booklets/:slug/pdf` checks publish status only | `backend/server.js` | Fixed in Phase 2 |
| 4 | Access lives in `localStorage` per booklet — no cross-device memory | `frontend/components/booklet-reader.tsx` | Fixed in Phase 2 (server-side; reader UI still reads localStorage as a hint) |
| 5 | Pop-up has no close button | `frontend/components/global-subscribe-popup.tsx` | Fixed in Phase 2 |
| 6 | GTM + GA4 + Meta Pixel + Ads all load in `<head>`; GA4 possibly double-counted | `frontend/app/(public)/layout.tsx` | Fixed in Phase 1. GA4 is not double-counted: the published GTM container `GTM-K6F4DJ54` has no tags (checked 2026-09-26), so the standalone gtag is the only path. The GTM snippet loaded ~330 KB that did nothing and was removed (2026-09-26); the layout carries only GA4 and the Pixel. If a container is ever wanted again, add its snippet back and delete the standalone gtag if the container sends GA4. Search Console/Ads ownership that was verified through the GTM method would need re-verifying (see the Phase 1 acceptance checklist below). |
| 7 | `next.config.mjs` empty — no image optimisation, no remote patterns, no cache headers | — | Fixed in Phase 1 |
| 8 | Reader comments fetched on page load (~1.1s measured) against the sleepy API | `frontend/components/reflection-form.tsx` | Fixed in Phase 1 |
| 9 | Runtime string-replacement patching content copy ("Seventeen" → "Eighteen booklets") | `frontend/lib/content-store.ts` | Open — clean up when the content model is next touched |
| 10 | Three Google font families; brand guidelines specify two | `frontend/app/(public)/layout.tsx` | Fixed: Cormorant Garamond dropped. Labels, nav and buttons (the `label` role, 235 uses) now use Crimson Pro; headings stay Playfair Display. Compared before/after on home, series and booklet at desktop and phone width: no overflow, page heights unchanged. |
| 11 | `admin-editor.tsx` 5.4k lines, `server.js` 3.9k lines; `console.log` in production paths | — | `console.log` done: the only request-path one now goes through `debugLog`; the startup email-config check logs on purpose. File splits remain Phase 4, only when something else touches them. |

**Problem 2 is the keystone:** no text version of any booklet exists, which simultaneously
blocks depth-gating, blocks SEO, and makes mobile heavy.

## Phase 1 — performance ✅ built

Branch `perf/phase-1`.

- **`frontend/lib/content-store.ts`** — wrapped `getSiteContent` in React `cache()` so
  layout and page share one fetch per request; swapped `cache: "no-store"` for
  `next: { revalidate: 300, tags: ["site-content"] }` plus a 6s `AbortSignal.timeout`.
  Exports `CONTENT_REVALIDATE_SECONDS` and `CONTENT_CACHE_TAG`.
- **Public pages** — `export const dynamic = "force-dynamic"` replaced with
  `export const revalidate = 300` in `(public)/page.tsx`, `series/page.tsx`,
  `series/[slug]/page.tsx`, `movements/page.tsx`, `movements/[slug]/page.tsx`,
  `inward-mirror/page.tsx`, `inward-mirror/[slug]/page.tsx`, `about/page.tsx`,
  `ads/page.tsx`. `(admin)` and `checkout` stay dynamic.
- **`frontend/app/api/revalidate/route.ts`** — POST/GET with `secret` (query or JSON
  body), compared to `process.env.REVALIDATE_SECRET` with `timingSafeEqual` over SHA-256
  digests so the comparison stays constant-time and never throws on a length mismatch.
  401 on mismatch, 503 when unconfigured. Next.js 16 deprecated the one-argument
  `revalidateTag`, so this calls `revalidateTag(CONTENT_CACHE_TAG, { expire: 0 })` —
  `{ expire: 0 }` rather than the `'max'` profile, because an admin who just published
  should see the change on the next request instead of one more stale copy.
- **`backend/server.js`** — `PUT /api/content` pings the revalidate route after a
  successful save, fire-and-forget so a failed ping never fails the admin save.
- **`frontend/app/(public)/layout.tsx`** — GA4 and Pixel moved out of `<head>` into
  `next/script` with `strategy="afterInteractive"`; preconnect hints kept. The GTM snippet was
  removed later: its container was empty.
- **`frontend/components/reflection-form.tsx`** — comments load via `IntersectionObserver`
  (`rootMargin: "600px 0px"`) with a 1.2s timeout fallback.
- **`frontend/next.config.mjs`** — was empty; Supabase remote patterns, AVIF/WebP, device
  sizes, 30-day minimum cache TTL, `poweredByHeader: false`, `compress: true`, and
  `headers()` with `nosniff` / `Referrer-Policy` / `X-Frame-Options: SAMEORIGIN`
  (`SAMEORIGIN`, not `DENY` — the reader frames `/pdfjs` itself) plus an immutable cache
  header on `/pdfjs`. Do **not** add one for `/_next/static`: Next.js already serves that
  immutable, and overriding it emits "Setting a custom Cache-Control header can break
  Next.js development behavior" at build time.

**Phase 1 acceptance:** site renders with the backend awake; site still renders with the
backend **asleep** (fallback path); GA4 / Ads / Pixel still record a sign-up; admin save →
`/api/revalidate` → change visible.

### Verified locally (2026-09-18)

`npm run build` clean, zero warnings, `tsc --noEmit` clean. Build ran with **no backend
up**, which exercises the fallback path: every page rendered with correct nav, footer and
title. The route table went from all-dynamic to `○ Static` / `● SSG` at a 5m revalidate —
18 booklet pages and 6 movement pages now prerendered — with `/admin`, `/checkout` and
`/api/revalidate` correctly still `ƒ`. Pages serve
`Cache-Control: s-maxage=300, stale-while-revalidate=31535700`, security headers present,
no `X-Powered-By`. The revalidate route answers 503 unconfigured, 401 for a missing,
wrong, or different-length secret, and 200 for the correct secret by query or body.

### Still to verify on a real deployment

- The GTM container was checked and is empty (2026-09-26), so there is no GA4 double-count and the
  GTM snippet was removed. Check Search Console / Google Ads for any property that was verified
  through the Tag Manager method and re-verify it (HTML tag, DNS or the GA4 tag works).
- GA4 / Ads / Pixel still recording a sign-up end to end.
- `admin save → /api/revalidate → change visible` against a live backend and frontend with
  a matching `REVALIDATE_SECRET`.
- Re-measure mobile and desktop load numbers against the 2026-09-17 baseline below.

### Pre-existing lint failures (not from Phase 1)

`npm run lint` runs `eslint . --max-warnings=0` and currently fails on 3 errors / 7
warnings that pre-date this work: `components/seo.tsx:58` (`no-explicit-any`),
`scripts/generate-sitemap.js:1-2` (`no-require-imports`), plus unused-variable warnings in
`cart/page.tsx`, `image-manager-panel.tsx`, `reflection-form.tsx` and `valluru-image.tsx`.
Worth clearing so the gate is meaningful, but it is a separate change.

## Phase 2 — make the gate real ✅ built

### ⚠ `ACCESS_TOKEN_SECRET` must be set, or none of this is real

`getAccessTokenSecret()` (`server.js:639`) falls back to `ADMIN_PASSWORD` and then to the
literal `"valluru-local-token"`. Production was running with no `ACCESS_TOKEN_SECRET` and
a short, guessable `ADMIN_PASSWORD`, which means every subscriber cookie and access token
was signed with that password — forgeable in seconds by anyone who guesses it. A gate on a
guessable secret is worse than no gate,
because it looks closed.

Set a long random value before trusting any of this:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The backend now logs a startup warning when it is unset. **Changing it invalidates every
existing subscriber cookie and access token**, so it is a one-time cost best paid on a
quiet day — and the grace path below is what keeps that from locking people out.

### What was built

- **`hasBookletAccess(request, slug)`** in `server.js`, called from
  `/api/booklets/:slug/pdf`. Access is granted when any of these hold, in order:
  1. the booklet is in `FREE_BOOKLET_SLUGS` (currently just `booklet-one` — mirrors the
     `isFree` rule in `booklet-reader.tsx`; the two must stay in step);
  2. a valid signed `valluru_subscriber` cookie — **the source of truth**, survives
     cleared localStorage and works on other devices;
  3. the legacy `valluru_booklet_<slug>` cookie — *grace path*;
  4. a valid access token from `?token=` or `Authorization: Bearer` — *grace path*, and a
     `"*"` token grants every booklet.
- Gated PDFs now send `Cache-Control: private, no-store` instead of
  `public, max-age=3600`, so a shared cache cannot hand a gated PDF to the next reader
  without the checks ever running.
- **Pop-up** got a close button, Escape-to-close and backdrop-click-to-close, and remembers
  the dismissal in `valluru_global_popup_dismissed`. Its copy no longer claims
  "Subscription is required to access all content" — that line was both untrue (booklet one
  is free) and the thing that makes Google treat the interstitial as intrusive.

### Two real bugs found while wiring it

- **`pdf-book-modal.tsx` set `withCredentials: !isExternal`.** In production the API *is* a
  different origin, which is precisely when the subscriber cookie needs sending — so it was
  never sent. Now unconditionally `true`.
- **The same file only attached `Authorization: Bearer` when the URL was same-origin**, so
  in production the access token never reached the server either. The token now rides in
  the query string (`?token=`), which works cross-origin and on a plain `<a href>` download.

That second one matters beyond the bug: the subscriber cookie is third-party to the site's
origin, so Safari and Chrome's third-party cookie restrictions can drop it. The URL token
is what keeps the gate working when that happens.

### Verified locally (2026-09-18)

Backend run with no database, `ACCESS_TOKEN_SECRET=test-access-secret`:

| Request | Result |
| --- | --- |
| Gated booklet, no credentials | **401** (was handing over the PDF) |
| Gated booklet, garbage token | **401** |
| Free `booklet-one`, no credentials | not 401 — passes the gate |
| Legacy `valluru_booklet_<slug>` cookie | passes — grace path holds |
| Subscriber cookie alone | passes |
| Access token alone, no cookies | passes — the cross-device case |
| `booklet-two` token against `booklet-three` | **401** — correctly scoped |

Subscribe sets both `valluru_subscriber` and the legacy per-booklet cookie.

### Known limitation

When `booklet.pdf` is a plain `https://` URL that is not in our storage, `/pdf-link` returns it as
stored (there is nothing to sign), so a subscriber receives a URL they can pass on. For our own
storage the reader now gets a 5-minute signed link (see "PDF signed links" below) — but every
booklet PDF sits in the **public** `books` bucket, so the permanent public URL still works for
anyone who has it. The signed link only becomes a real gate once the PDFs move to a private bucket.

### PDF signed links

`GET /api/booklets/:slug/pdf-link` runs the same checks as `/pdf` (published, access — one shared
`loadReadableBookletPdf`) and returns `{ url, kind }`: a 5-minute signed Supabase URL
(`kind: "signed"`), the stored URL for a file hosted elsewhere (`"remote"`), or `url: null`
meaning "stream from `/pdf`". `src/booklet-pdf.js` resolves it and is tested. `PdfBookModal` takes an
optional `pdfLinkUrl`: it asks for the link with credentials, then fetches the file from storage
**without** credentials — storage answers CORS with `Access-Control-Allow-Origin: *`, which a
credentialed request refuses, so a plain 302 from `/pdf` would not work in a browser. If no link
comes back, or the signed file will not open, it streams from `/pdf` as before (both fallbacks
tested). Measured on the sandbox for a 10.5 MB booklet: streamed first byte 3.2–4.0 s, total
6.6–7.7 s; signed link first byte 0.8 s, total 3.6 s plus about 1.6 s to get the link — and the API
no longer holds the file in memory. Only booklet twelve (no chapters) still opens this modal;
movement PDFs are public and load directly. `BookletReader` now also recovers a token for a
pre-gate subscriber (`recoverAccess`), because with third-party cookies blocked the token
`track-unlock` returned was being thrown away and the PDF request went out with no proof of access.

### Still open in Phase 2

- `localStorage` is no longer the source of truth on the server, but
  `booklet-reader.tsx` still decides what UI to show from it. Harmless — the server is
  authoritative now — but the reader does not yet handle a 401 gracefully.
- The name field is still on the pop-up and the reader. The locked decision is **email
  only**; that change belongs with the Phase 3 in-page gate rather than here.
- Whether the pop-up survives at all is Sasidhar's call.

## Phase 3 — booklets as text ◑ machinery built, content not yet imported

The pipeline, content model, rendering and gate are built and tested. **No real chapter
data exists yet** — that half is blocked, see below.

### ⚠ The booklet PDFs are not in this repo

Nothing under the repo is a PDF. Booklets are referenced by URL from content, and the
defaults point at `https://thevalluru.org/wp-content/uploads/2026/05/*.pdf` — a public
WordPress path. **8 of the 18 booklets currently have a PDF**, not seven:

```
when-the-gods-fall-silent-booklet_one        where-language-learns-to-bow-booklet_three
when-silence-became-sound-booklet_two        when-the-seeker-stops-optimizing-booklet_four
the-witnesses-who-remain-booklet_five        when-grief-became-nada-booklet_six
nadeswara-kshobhasamana-stotram-booklet_eight  in-ammas-lap-booklet_nine-1
```

So the extraction run and its human review still have to happen. Everything downstream of
it is ready and waiting.

### What was built

**1. Extraction — `backend/scripts/extract-booklet-chapters.mjs`**

```bash
node backend/scripts/extract-booklet-chapters.mjs <pdf...> --out chapters-review --slug booklet-two
```

Writes reviewable JSON and touches no database. Headings are found by **type size**, not
regex — these are typeset booklets, so a chapter opening is reliably larger than its body
— with a regex fallback for `Chapter N` / roman numerals. Repeated page furniture is
detected by looking for the same line recurring in the top or bottom 8% of at least 40% of
pages (digits normalised, so page numbers collapse together). Paragraphs break where the
vertical gap exceeds 1.5× the usual leading, and words hyphenated across a line break are
rejoined. It prints a per-chapter summary and warns when it finds suspiciously few or many
chapters, or a chapter short enough to be a pull-quote.

Verified on a synthetic typeset PDF: 4 chapters found, header and page numbers stripped,
paragraphs split at the wider gaps, depth rule applied.

**2. Content model** — `BookletChapter` (`id`, `number`, `title`, `paragraphs`, optional
`free`, optional `teaser`) on `Booklet.chapters`, plus `FREE_CHAPTER_COUNT = 3` and
`isChapterFree()` in `frontend/lib/site-content.ts`. `normalizeChapters` in
`content-store.ts` treats chapters as untrusted admin input. **A chapter with no
paragraphs is kept when it has a title** — that is exactly the shape a gated chapter
arrives in.

**3. `backend/src/content-chapters.js`** — the visibility rules, pulled out of `server.js`
because they decide what prose reaches the public internet. Covered by 9 tests
(`npm --prefix backend test`).

**4. `GET /api/booklets/:slug/chapters`** — free chapters to anyone, gated chapters only
when `hasBookletAccess` passes. Returns `hasAccess`, `totalChapters`, `freeChapters`.
Sends `private, no-store` when it carries gated prose, `public, max-age=300` otherwise.

**5. Rendering** — `BookletChapters` is a **server component**: free chapters are plain
server HTML, indexable and needing no JavaScript, which is the entire point of the
migration. `ChapterGate` is the client component at the 3/4 boundary — fading teaser of
the next chapter, one email field, and it fetches the rest once the API says the reader is
allowed them. A subscriber arriving with a valid cookie never sees the form.

### Two traps worth knowing about

- **`/api/content` is public and ISR-cached for 300s**, so putting chapters in it would
  have published every gated booklet to the world. `redactGatedChapters` strips gated
  prose from it; only numbers, titles and one teaser survive.
- **That redaction creates a data-loss bug.** The admin page loads content through the
  same public route, so the editor holds chapters with empty paragraphs — and
  `persistContent()` PUTs them straight back, which would wipe the writing from MongoDB.
  `preserveRedactedChapters` restores stored prose wherever an incoming chapter carries
  none, making the round-trip lossless. **Consequence: emptying a chapter's paragraphs
  cannot clear it — delete the chapter instead.** There is a test named for this.

**6. `Article` schema** on the booklet page, emitted only once a booklet has chapter text.
Uses Google's partial-paywall pattern: `isAccessibleForFree: false` plus a `hasPart`
`WebPageElement` whose `cssSelector` is `.valluru-gated` (the class on `ChapterGate`).
Without that declaration, showing a crawler more than a signed-out reader reads as
cloaking rather than as a declared gate.

**7. `/r/[code]` short links** — `frontend/app/r/[code]/route.ts`. `/r/b5?s=story` lands on
booklet five with UTM parameters attached server-side, so a bio link can be repointed
without editing every surface it was posted to. `b1…bN` index the published booklets in
series order. `?s=` sets `utm_medium` from the whitelist (bio, story, highlight, dm,
comment, shorts_desc, defaulting to bio); `utm_source` is youtube for `shorts_desc` and
instagram otherwise, overridable with `?src=`; `?c=` sets `utm_content`;
`utm_campaign` is the booklet slug. Unknown codes redirect to `/series` rather than 404.
**307, not 308** — a permanent redirect would be cached in browsers long after the posting
schedule moved on. `Disallow: /r/` is in robots.txt so short links do not compete with the
canonical booklet URL.

**8. `/read` hub** — `frontend/app/(public)/read/page.tsx`. Every booklet listed under the
hook line from its reel (`oneLineHook`, which already existed and is already admin-editable),
so a viewer recognises the sentence they just heard. The top slot follows
`settings.featuredBookletSlug`, editable under **Reel Posting Schedule** in the admin, and
falls back to the first published booklet. Added to the sitemap.

### Verified locally (2026-09-18)

`/r/b1` → booklet one, `utm_medium=bio`. `/r/b5?s=story` → booklet five, `utm_medium=story`.
`/r/b2?s=shorts_desc&c=hook-a` → booklet two with `utm_source=youtube` and
`utm_content=hook-a`. `/r/b3?s=nonsense` falls back to `bio`. `/r/b99` and `/r/garbage` land
on `/series`. Following a short link through returns 200. `/read` renders the featured slot
and all 18 booklets. Build clean, zero warnings; `tsc` clean; 9 backend tests pass.

> If a route handler 404s against a locally started `next start`, restart the server before
> debugging the route — a stale instance 404s every root-level handler while pages still serve.

> **A running `next start` writes its ISR revalidations back into `.next/server/app`.** If it
> is still up when you rebuild, every page it has served since is overwritten with the *old*
> markup, and the fresh build serves stale HTML for those routes and only those routes —
> which reads exactly like a change that did not take. Stop the server before building. Note
> that killing the Bash task does not always kill the node process: check the port is free
> (`Get-NetTCPConnection -LocalPort 3000`) rather than assuming.

> **After changing content in the database, `rm -rf frontend/.next/cache/fetch-cache` before
> building.** `getSiteContent` fetches with `revalidate: 300`, and Next persists that response
> across builds, so a build inside the five-minute window prerenders the *old* content with no
> warning. Verified the hard way: a chapter title fixed in Mongo, confirmed correct through
> `/api/content`, and still wrong in the built page.

### What the extractors learned from the real PDFs

Each of these was a silent defect — nothing errored, the output just was not the booklet.

- **Spaces are not always in the text.** Several booklets embed fonts whose space glyph
  pdf.js cannot map, so a line arrives as items with no spaces and the spacing expressed
  purely as position. Joining them gave `Grieffirstarrivesasinvasion.` on about a hundred
  lines. `joinLineParts` measures the gap between items and puts the spaces back; it
  recovered 4,600 words the old join had welded together.
- **A running head whose tail changes never repeats.** "The Inward Fire Series | Booklet
  Nine · 3 · Notes" varies by chapter, so whole-line furniture matching missed it and left
  it in the prose. `furnitureStem` matches on the part before the first divider.
- **A contents page is a page of chapter openings.** "12A. Brindavan and the Failure of
  Optimization" is a chapter opening wherever it is printed. What separates the listing
  from the book is density, so a page carrying four or more openings is a contents page,
  and the short-chapter exemption applies only where an opening stands alone on its page.
- **A cover page is all heading and no chapter.** Merging heading-sized lines by size
  alone titled booklet nine's first chapter "Bhakti, Self-Laughter, Māyā, and the Child's
  Surrender Sasidhar Valluru Nine I N W A R D F I R E AMMA'S S E R I E S LAP". The merge
  now requires the next line to sit one leading below, and the import gives the first
  chapter the booklet's own title rather than trusting typography at all.
- **`g_`-prefixed images live in `commonObjs`, not `page.objs`.** Asking the page for one
  waits out the timeout and returns nothing, which is how every reused plate was being
  dropped — booklet eleven yielded three images in an hour instead of four in seconds.
  And because a reused image is usually decoration, the extractor now counts the pages
  each image object appears on and treats anything on a quarter of them as furniture.

### ⚠ The plates have no home in production

313 plates, 36MB, sit in `frontend/public/booklet-plates/`, which `.gitignore` excludes —
so they exist locally and nowhere else, while the import writes `/booklet-plates/...` into
the content. **Deploy as things stand and every plate 404s.** Three ways out, and the
choice is the owner's because each costs something different:

1. Commit them. Simplest, works on Vercel unchanged, 36MB in git forever.
2. Upload to Supabase and pass that URL as `--image-base`. No repo weight, but the bucket
   is public, so a gated chapter's artwork becomes reachable by anyone with the URL — the
   same posture the booklet PDFs are already in, which the review lists as a problem.
3. Serve them from the backend behind `hasBookletAccess`, like the PDFs. Correct, and the
   most work.

### Still to do in Phase 3

- Have someone who knows the writing read a booklet through. Two known weak spots: the
  Telugu booklets carry 9–19 encoding-damaged characters each (a PDF font problem, not a
  parsing one), and booklet eight's stotram resolves to eight sections where the stanza
  boundaries are probably finer.
- Admin editor fields for chapter text (`admin-editor.tsx` — 5.4k lines, budget for it).
  The **Reel Posting Schedule** group is in; chapter editing is not.
- **Interior illustrations — decided: the plates are carried into the chapters.** Extracted
  with `extract-booklet-images.mjs` as the embedded raster objects rather than page
  renders, so the text stays text. A plate goes to the first chapter that opens at or
  after it, because these booklets set an illustration on its own page *facing* a chapter
  opening — matching on containment finds almost nothing. Plates on a gated chapter are
  redacted with its prose and released with it.

### The printed page, measured from the PDFs

The reader overlay reproduces the booklet rather than restyling it, and every value below
was read out of the PDFs with pdf.js rather than guessed. Re-measure before changing one.

| | |
|---|---|
| Page | 432 × 648pt (6 × 9in), text column x 61 → 369pt — margins 14%, measure 71% |
| Paper | `#f7f0e4` |
| Body | Noto Serif 10.5pt, ink `#2a2118`, leading 13.9pt (**1.35** — the reader sets 1.45, the one deliberate departure) |
| Telugu | Noto Serif Telugu 10.7pt, same ink |
| Chapter opening | Noto Serif Bold 24pt (2.3 × body), ink `#22180d` |
| Section header | Noto Serif Bold 11.1pt, gold `#a17a3e`, letterspaced caps |
| Running foot | Noto Serif 8.9pt, `#8d7a62` |

Two consequences worth knowing:

- **The site's three faces carry no Telugu.** Playfair, Crimson and Cormorant have no
  Telugu coverage, so the verse booklets fall back to whatever the browser has. The reader
  lists Noto Serif Telugu second in its stack; font fallback is per glyph, so Latin takes
  Noto Serif and Telugu takes the Telugu face out of one family. Both load with
  `preload: false` — a reader who never opens a booklet should not pay for them.
- **The chapters render once and are shown twice**, dark on the page and on paper in the
  reader, from one tree a portal moves. So the chapter markup names no colour and no face:
  `.reading-surface` / `.reading-surface-paper` in `globals.css` declare them and the
  markup reads them through `var(--reading-*)`. Do not put a colour back into
  `chapter-body.tsx`.
- ~~`BookletReader` (the PDF modal) and `BookletChapters` currently both render on the
  booklet page.~~ **Decided: one way in.** The page offered three separate invitations to
  read the same booklet — the PDF panel's *Read Booklet*, the chapters' *Open the reader*,
  and the gate's *Keep reading*. Now `hasReadableChapters` picks the surface: the chapter
  reader where text exists, the PDF modal where it does not (booklet twelve has no text
  layer). The gate moved inside the reader, at the foot of the third free chapter, so a
  reader meets it by reading on rather than by being sent to a panel elsewhere. The PDF
  download stays beside the one button, because a file to keep is not a way to read.
  The clipped on-page preview is `inert`: the sign-up form sits below the clip line, and
  without it a keyboard reader tabs into a field they cannot see. Unlock tracking moved
  from the PDF button to `ChapterReader`'s open, via `lib/subscriber.ts`.

  A later sweep of all 22 detail pages found the tidy-up had left two things wrong. The
  PDF sat on the page as a **Download** button that answered **401 to every reader who
  had not subscribed** — which is every reader arriving. It is now offered inside the
  reader, after the last unlocked chapter, which is the only place the answer to "may
  this reader have it?" is known. And the previous/next cards each carried a **Read**
  button of their own, so three controls saying Read sat within a few hundred pixels
  while only one of them opened the booklet you were looking at; the card is the link now.

### The reader is a paginated book with a bookmark

The download buttons are removed for now (the PDF route and its access rules are intact;
only the UI is gone — restore `pdfLabel` on `ChapterGate` when downloads return).

`chapter-reader.tsx` paginates with **CSS multi-column**: content flows through columns,
one column is one page, and turning a page sets `scrollLeft` by exactly one page pitch.
The sheet holds the booklet's 432:648 and every measure inside it is a ratio of that
(text column 71%, margins 14%). Two pages show side by side with a fold when the window is
wide enough for two, one on a phone. Arrow keys / PageUp / PageDown turn pages.

Type is deliberately **larger than print proportion** (16–20px): 10.5pt on a 310pt measure
is ~12px on a laptop-sized sheet, unreadable at arm's length. The page keeps its shape; the
type is set for the screen, as an e-reader does.

**The bookmark is a fraction (0–1) of the way through, not a page number** (`lib/bookmark.ts`),
because page count depends on window size — the same booklet is 62 pages on a laptop and
79 on a phone, so a saved "page 30" means nothing across devices. Four traps found building it:

- **The book's length is not known at open.** Plates and the two serif faces load after
  first paint and change how much fits per page: the count read at open said 17 pages, the
  settled book runs to 68. A `ResizeObserver` does not catch it (in a multi-column box the
  element's own width never changes — only `scrollWidth` grows), so the reader polls
  `scrollWidth` until it stops moving, for a minimum number of ticks (a brief false
  stability right after open stranded a bookmarked reader on page 1).
- **Do not save a bookmark until the book has settled**, and only on the reader's own turns.
  Restoring the bookmark scrolls, the scroll handler saved, and the first restore lands on
  page 1 while the length is still wrong — it overwrote the bookmark it was restoring.
- **`scrollTo({behavior:'smooth'})` did nothing** on this element in the test browser, while
  the page counter beneath updated — a dead button that looked healthy. Turn by assignment.
- **`Math.floor` on the resume position landed two pages early**; the saved value sits on a
  spread boundary and a float a hair under it floors to the spread before. Use `Math.round`.

Also fixed on the way: booklet thirteen sets its running head as `12 THE INWARD FIRE SERIES
| BOOKLET THIRTEEN` on one page and `... THIRTEEN 13` on the next, so the folio moving side
counted one head as two and neither reached the 40% furniture threshold — 33 paragraphs of
running head in the prose. `normalizeForComparison` now drops the folio from either end.

### The reader takes each booklet's own design

The booklets are **not one design**, and a single cream page could never be "like the PDF".
Measured with `backend/scripts/extract-booklet-theme.mjs` (paper sampled from pixels of
*body-text pages*, face/ink/accent from the operator list, page shape from the viewport):
EB Garamond (13), Georgia (the whole Mirror series), Arial (14–22), Noto/DejaVu Serif
(the rest); paper from white (1–8) to `#f4ebd7`; four landscape or square. Stored on each
booklet as `booklet.reader = {face, paper, ink, accent, aspect}` by the import
(`--themes themes.json`). `lib/reader-theme.ts` validates every value (six hex digits or it
is ignored — the data is admin-editable and lands in inline styles), guards ink contrast,
and maps `face` to a loaded font: EB Garamond, Gelasio (Georgia's metric twin, since
Georgia is not free to serve), Arimo (Arial's), Noto Serif. All load `preload:false`.

Traps in the measuring: reading paper from "the first fill on a page" gave **black** for
booklets whose paper is cream (that fill is a full-bleed cover); sampling by page number
gave black for 17 and 18 because they alternate full-page plates with text. Sample pixels of
pages with ≥25 text items. Confirm against a rendered page (`@napi-rs/canvas` is in
`node_modules`) — booklet one really is white paper, and my earlier guess of `#fbf8f1` was wrong.

**The reader is a book**, drawn from how the PDFs open: end-paper | cover (full-bleed art,
title plate) | title page (gold series line, rule, caps title, italic subtitle, author, logo
as a CSS mask in the accent colour) | contents (live page numbers, lock on gated) | the
writing. The end-paper exists so the cover sits on the right and even pages are left, as
in print; a single page skips it. The extracted "front matter" chapter (cover text run
together) stays in the HTML for search but is `display:none` in the book
(`isTitlePageChapter`). Running foot: series | booklet in the middle, folio on the outer
corner; on a narrow page (`@container`) only the booklet number.

- **The last spread must align.** A multi-column box's scrollable width stops at the last
  text column's right edge, *omitting that page's trailing margin*, so the final turn
  clamped a fraction of a page short — the closing spread came up half a page out. `.rd-end`
  is as wide as the missing margin; when the page count is even it also forces a column of
  its own so the last spread is a complete pair.
- **Arrow keys belong to the sign-up field** while it has focus; the key handler ignores
  input/textarea/select.
- **`html` scrolls on its own** (`overflow-x:hidden` on it stops `body` overflow
  propagating), so lock both, or a scrollbar shows behind the book.
- Persist a bookmark only in `moveTo` (the reader's own turns) — never from the scroll
  handler, or the settle loop's repositioning overwrites it.
- Text size / paper change the length of the book. `changePrefs` saves the place, clears
  `movedRef`, and the settle loop puts the reader back at the same share of it.
- **Do not trust a plausible count.** Every one of these looked fine in numbers and was wrong
  on the page; open the reader and look. The in-app Browser pane returns *stale* screenshots
  of an emulated viewport (DOM correct, image frozen) — use the Playwright browser for
  visual checks, at the real size.

The gate is a page of its own now (`.valluru-gated` in the book: `break-before:column`,
centred), not a panel in the column, where the form collapsed to a sliver and the button hung
off the edge. Copy no longer mentions the PDF (downloads are removed). A slow sign-up (Render
free tier waking) says so after six seconds. The on-page button reads **Continue reading**
with "You stopped at page N, X% through" once a bookmark exists (`useBookmark`,
`useSyncExternalStore` so it hydrates to what the server sent).

Extraction/import lessons from the same pass:

- **Logos slip past a per-book test.** Count-across-booklets missed the gold tint that
  booklet 13 carries alone. Transparency is the direct test: logos are transparent PNGs,
  artwork is opaque — drop plates whose mean alpha < 170 (`isMostlyTransparent`).
- **A section titled like the booklet is its title page**, not a chapter (it consumed a
  free chapter in booklet 13). The import marks it front matter.
- **Inward Mirror PDFs** put note, contents, caption and essay under one heading and, in
  three booklets, inside the cover chapter. `tidyMirrorChapters` splits at "Opening" into
  Author's Note (front matter) + Opening, and drops the `IM-0x-H01 · Interior plate`
  captions, the "Written by" line and the contents list (including its second half, split
  at a page break — three or more `N. Title` items in one paragraph).

### The Inward Mirror is on the same reader

The seven Inward Mirror booklets (`IM_B01…B07`, ~2,000 words and 15–17 pages each) now go
through the same extraction, import and reader as Inward Fire: 77 sections, 4 plates each,
one **Read the booklet** button, the gate at the end of the free reading, the Article
paywall schema. `import-booklet-chapters.mjs` matches both series but trusts **title only**
for the Mirror — its booklets reuse numbers like "Booklet 2", so a number fallback would
hand it Inward Fire's chapters.

Things this exposed that had been silently wrong for Inward Fire too:

- **The Valluru logo was being served as a plate.** It is drawn on the cover and closing
  pages of every booklet in several tints, so it repeats three times in seventeen pages —
  under any per-booklet threshold — and showed up as a fake illustration at chapter
  openings, dark on the cream paper. The import now hashes every extracted picture
  (48×48, greyscale, quantised) and drops any that appears in **3+ booklets**. 313 plates
  → 215.
- **Subscribers saw the free chapters twice.** `/api/booklets/:slug/chapters` returns the
  whole booklet; the free chapters are already server-rendered above the gate, and the gate
  rendered the full list again. A 17-chapter booklet showed 21 — and I read "21 chapters"
  as success. `ChapterGate` now keeps only `free === false`. **When verifying, compare
  against the expected count, not just a plausible one.**
- **A contents page is detected by heading *density*, not count.** Four openings on a page
  is normal in the Mirror (eight short sections in fifteen pages), so a count rule folded
  its chapters together. A contents page is nearly all headings: ≥4 openings *and* ≥25% of
  the page's lines, and a page continuing a listing needs only 2 (booklet six's runs over
  onto a page with three entries).
- **Plates are fitted, and reserve their space.** Portrait 2:3 plates at full column width
  were 1,100px tall, so the clipped preview showed a slice of the top edge like a broken
  banner. `.plate img` sets width from `--plate-cap × --plate-ratio` and holds the shape
  with `aspect-ratio`. The ratio also has to be set up front: an unloaded lazy image has no
  size, so pages reflowed as plates arrived — the count at open said 17, settled at 68.
  With the ratio reserved, count at open equals settled count.
- **A plate opening a chapter must share its page with the heading.** Capping it at a whole
  page's height left the heading alone on one page and the plate on the next — an empty left
  page on every cover spread. The cap leaves 9em for the heading.

A fresh visitor also gets the **global subscribe popup** (`role=dialog`), a separate modal.
When scripting the reader in a browser, select `[role="dialog"][aria-label^="Reading "]`,
not the first `[role=dialog]`.

### ⚠ Anything that proves access must carry the token, not just the cookie

The subscriber cookie is a **third-party cookie in production** — the API is on another
domain — so Safari and Firefox drop it by default. Phase 2 gave the PDF link a `?token=`
fallback for exactly this, but `ChapterGate`'s chapter fetch was left on the cookie alone,
and a subscriber whose cookie was dropped was told they had no access at all: the free
chapters and the sign-up form, with their subscription invisible. Reproduced in the
browser with a valid token in hand.

`hasBookletAccess` accepts a `?token=` query parameter, a bearer header or the cookie.
**Every request that asks whether this reader may have something must send the token**,
which `readAccessToken(slug)` in `lib/subscriber.ts` returns. `/api/subscribe` hands the
token back in its response; store it with `storeAccessToken`.
- `generate-sitemap.js` hardcodes its booklet list, so it can drift from the content in
  MongoDB. Worth driving from content when something else touches it.

Also in this phase (small, high value for the content operation):

- **`/read` hub page** whose top slot features the booklet the current reel came from,
  driven by a posting schedule in the admin. List each booklet under **the hook line from
  its reel** so viewers recognise the sentence they just heard.
- **`/r/b1` … `/r/b7` redirects** that attach UTM parameters server-side (`utm_medium` per
  surface: bio, story, highlight, dm, comment, shorts_desc).

Why this is light, not heavy: each booklet is ~4,000 words, three free chapters ~1,500
words ≈ 8–12KB gzipped — less than one PNG background the page already loads. It renders
with the page, needs no JavaScript, and removes the canvas renderer from the free path.

## Sandbox review round (2026-09-21)

The owner reviewed the sandbox and sent an action list. What it changed, and what to know
before touching any of it again.

### The gate is "after chapter 3 as the booklet numbers it"

`resolveChapterAccess` (frontend `lib/site-content.ts` and backend
`src/content-chapters.js` — keep them identical) frees everything up to the end of the
chapter *titled* "3.", "CHAPTER 3" or "STANZA 3". Front matter, the Opening and any other
unnumbered lead-in are free and do not spend one of the three; an unnumbered piece stays
with the numbered chapter it follows ("3. Notes" is chapter 3's); the Epilogue and The Gist
after it are gated. A booklet with no numbered titles falls back to counting body chapters.
The old rule counted the Opening as a body chapter, so readers got Opening + 1 + 2.

The gate's "N more chapters" is the number of *numbered* chapters left (distinct labels),
so it is the booklet's total less the free three: booklet one says 12 of 15.

**No booklet is exempt from the gate (2026-09-26).** Booklet one used to hand out its whole
PDF as a free sample (`FREE_BOOKLET_SLUGS`, a `freeSample` option on `hasBookletAccess`, and an
`isFree` flag in `booklet-reader.tsx`). That gated by booklet, not by depth, and contradicted
the review's "the PDF endpoint refuses requests without the cookie", so all three are gone:
`hasBookletAccess(request, slug)` has one rule for every booklet, and every PDF response is
`private, no-store`. The Movements pages are a separate hole: their PDFs are direct public
Supabase URLs (Movement 1's is booklet one's full PDF, Movement 3's the "Grief as Fire" print
file), which no gate can see. Whether they stay is the owner's call.

### Sign-up is email only

No Name field anywhere (newsletter, pop-up, ads, booklet reader, and since 2026-09-26 the reader reflection form, whose API no longer requires one; new reflections show as "Reader"). The API never required
one; it now leaves a stored name alone when none is sent, and the emails no longer say
"Dear ,".

### Extraction damage is repaired by rule, in one place

`backend/scripts/lib/clean-chapters.mjs`, run by `import-booklet-chapters.mjs` and by
`clean-booklet-text.mjs` (`--dry-run` prints the log). It removes running heads that landed
mid-paragraph ("Booklet Ten WHEN THE CHESSBOARD BURNS …"), the "End of Booklet N" mark, a
section heading (EPILOGUE, THE GIST, AUTHOR'S NOTE) run onto the end of the paragraph before
it — and names the next chapter with it — and the contents list left at the foot of the
Author's Note; folds lines the extractor took for chapters (a heading that is really the
middle of a sentence, a pull-quote, a repeated "CHAPTER 14") back into the prose; repairs
"Re- alignment", "RāvaṇaBrahma", and puts hyphens back in words the book itself hyphenates
elsewhere ("selfowned" beside "self-owned"). It is idempotent, and `nonduality` is left
alone because the Mirror booklets write it solid throughout.

Traps: a JS regex range `Ā-Ž` includes lowercase ā, ī, ū — list capitals explicitly. And a
Python heredoc turns `` into a backspace, silently disabling the regex; check with
`grep -c $''`.

**Tables** are stored as one paragraph — `[[table]]` then one row per line, cells split by
" | " — and rendered by `ChapterBody`. Booklet one's yoga table is written out by hand in
`TABLES` because flattened cells cannot be recovered by rule. Look at the PDF page before
adding another.

**Fixed:** the paragraph-gap threshold in `extract-booklet-chapters.mjs` never fired —
`1.5 × median(gaps)` on a page of short paragraphs makes the median *itself* the paragraph
gap, so nothing was ever wide enough to break on. It now reads the line pitch off the low
end of the sorted gap distribution (`LINE_PITCH_PERCENTILE = 0.2`) instead, which is
always plain leading whatever the paragraph length. At the finer cut, a running head can
land as several short paragraphs of its own, or fused onto the tail of real prose and
continuing through the paragraphs after it — `withoutRunningHeadParagraphs` in
`clean-chapters.mjs` handles both, scanning a growing window anchored to whichever
paragraph actually names the booklet (`RUNNING_HEAD_LEAD_IN`), never growing from an
unrelated paragraph just because a match turns up further ahead. `resplit-booklet-
paragraphs.mjs` re-cuts what is already stored against a fresh extraction, matching
chapter-for-chapter by exact spelling so nothing but paragraph boundaries changes; applied
to the sandbox, 382 of 443 chapters matched and re-cut, median paragraph length falling
from ~1,000–3,000 characters to ~100–300 across every affected booklet — run it again
after any future re-extraction, the same way.

**Fixed: column interleaving.** Several booklets set a verse and its Author's Note (or a
Telugu original and its Devanagari transcription) as two cards side by side on one page.
Reading a page by vertical position alone — all `toLines` did before — interleaves them: a
commentary line at the same height as a verse line lands next to it, and the two texts come
out spliced together mid-sentence. `findColumnSplit` in `extract-booklet-chapters.mjs`
reads where each page's text actually starts (header/footer band excluded, since a running
head can start anywhere and would corrupt the read); where that finds a gutter — a gap far
wider than ordinary word-spacing, real content on both sides — the left card is read in
full, top to bottom, then the right, rather than merged by height. The column boundary also
forces its own paragraph break (`columnBreak` on the line), since the last line of one card
and the first of the other are unrelated prose that would otherwise pass the vertical-gap
test by coincidence. Checked against the whole corpus before it went anywhere near the
database: every booklet without this problem comes out byte-for-byte identical; booklets
six and eight (confirmed two-column) come out structurally correct — verse, meaning, and
Author's Note as three separate paragraphs instead of one scrambled one, all the way
through booklet six's nested 12A–12E sub-poems. Applied via `swap-booklet-chapters.mjs`
(paragraphs swapped by chapter *position* against a fresh extraction, not by spelling —
this reorders text, so the resplit script's exact-spelling match is designed to refuse it;
`id`, `number`, `images`, `free` and `title` are left alone, and a booklet is skipped
outright if its chapter count doesn't match the fresh extraction's).

**Fixed for booklet six: character-level glyph damage in the verse.** A second embedded
font, used only for verse and captions, decodes glyphs to the wrong Unicode codepoint
(stray Latin letters, wrong vowel signs — the text layer read "కన్నేందు" where the page
prints "కన్నొందు" — and whole lines dropped: chapter 22's stored verse was its last line and
a half). No rule recovers it, so all 31 verses were read off the rendered pages
(`crop-verses`-style crops at 3× zoom, ambiguous words re-checked at 9–10×) and are stored in
`scripts/lib/transcribed-verses.mjs`; `cleanBooklet` puts them back by position
(`restoreTranscribedVerses`: the verse is the paragraph before "Meaning"; only runs when the
booklet still has exactly as many verses as were transcribed, otherwise it logs "verses NOT
restored" and leaves the text alone; safe to run twice). Chapter 9's printed caption "(the
form of Kāli standing with Her right foot upon Śiva)", which extraction had lost and the
Author's Note refers to, is restored as its own paragraph. The meter labels and the note's
"తండ్రీ" are `MEASURED_TEXT` entries. The transcription is a reading, not a copy-paste: the
consonant skeleton of each verse was compared to what survives in the damaged text as a
tripwire (verse 1 matches exactly; the rest differ only where the damaged text doubles or
drops consonants), but the author should proof it once.

**Fixed for booklet eight: stanzas, Devanagari and word-by-word.** Same font damage, plus a
structural mess the column fix left behind: the Devanagari of stanzas 1–4, 5–8 and 9–12 sat in
whichever chapter followed them (chapters "4.", "8.", "11."), so the free chapters "1."–"3."
showed no Devanagari at all. `scripts/lib/transcribed-stanzas.mjs` holds, per stanza, the
Telugu, the Devanagari, and the word-by-word *headwords* as printed; `restoreTranscribedStanzas`
rebuilds each numbered chapter as [Telugu, Devanagari], each `STANZA n` chapter as [Telugu,
word-by-word, Bhāvam], and the Phalaśruti with its Devanagari. The English glosses are **not**
transcribed — they extract correctly, so they are kept as stored and only the headwords are
replaced (counts checked against the stored glosses: 127 of 127). Two extraction defects
surfaced and are handled: the Bhāvam of stanzas 3 and 9 ran on from the last gloss (split
back out) and a leaked "PHALAŚRUTI" heading ended stanza 11's Bhāvam (stripped). Printed
spellings are kept as printed, including Telugu words that end in a halant where the
Devanagari beside them ends in a long vowel (`విగ్రహ్` / `विग्रहा`), so a proofreader sees the
book, not a correction. Only runs on the exact shape it was read from (11 numbered chapters, 11
study chapters, a Phalaśruti). Booklet seven's chapters were flagged by an early heuristic but
turned out to be ordinary single-column verse with irregular line indentation, not this bug —
checked directly against its PDF pages before ruling it out, not assumed.

**Fixed for booklets one, two and three: damaged Telugu inside running prose.** Same font
damage, in short passages rather than whole verses: booklet one's Nāda note and Harishchandra
lines (rendered as `చదువ%ల' (ెదల'` — pure symbol noise), booklet two's five Sanskrit verses
(hidden control characters, ``, where letters should be), booklet three's Telugu poems and
quoted phrases. `scripts/lib/transcribed-passages.mjs` holds 23 entries, each replacing one
*exact run of the damaged paragraphs* with what the page prints, so an entry can only ever touch
its own passage (`restoreTranscribedPassages`; a passage neither damaged nor restored is logged
"passage NOT restored"). Entries also re-join paragraphs a line wrap had split around inline
Telugu, and put verse back one printed line per paragraph, which `groupBlocks` in
`site-content.ts` regroups into a verse block. Read at 5–14x; still worth a Telugu reader's
proof — in particular booklet one's `ఔదలు` (a lone vowel glyph at print size), booklet three's
`భీష్ముపై` and the printed-as-is Tikkana/Pothana lines, which are the author's quotations and
may differ from the standard text.

**Inward Mirror back cover.** Each Mirror booklet's closing chapter ended with three lines of
printed back cover read as text: "Booklet N of seven · The Inward Mirror Series …", a tagline
(usually a repeat of the epilogue's last sentence), and the running footer. `stripBackCover`
cuts from the first of them (matched by that line's own wording) to the end of the chapter.

**Fixed for booklet nine (2026-09-25).** Every Telugu line of all 15 poems, the 15 Telugu
"భావము" notes and the Telugu chapter subtitles (and the cover chapter's contents list) came
out damaged. Each poem prints a Telugu line with its Roman transliteration beneath; the Roman
line extracts intact, so the Roman is kept as stored and the Telugu was read off the page.
The Roman line was then used as a *second reading*: a script transliterates it to Telugu and
compares consonant skeletons with what was read off the page — all 20 chapters' lines agree
within 2 consonants, so a misread consonant would have shown. (It cannot see a wrong vowel
sign, and the Roman itself has one fault, `n` + a combining macron for `ñ`, repaired.)
`scripts/lib/transcribed-booklet-nine.mjs` holds title, lines (Telugu, Roman pairs) and భావము
per chapter; `restoreTranscribedBookletNine` finds each chapter by the English start of its
title (the damage never touches it) and rebuilds everything between the Meter line — or the
భావము label in a Notes chapter — and "M E A N I N G". The layout differs by chapter (bhāvam
inside the poem chapter in some, a separate "N. Notes" chapter in others), which the data
reflects. The Telugu after `భా వ ము` keeps the PDF's own letterspaced label so
`splitSectionLabel` still lifts it out.

**Poems with a transliteration under each line (booklet nine).** `toChapterBlocks`
(`lib/site-content.ts`) called a line verse only if it was short and did not end in sentence
punctuation, so each Roman line — which ends in a full stop — broke out as its own prose
paragraph and the Telugu lines around it regrouped against the wrong partner. `classifyLines`
now (a) keeps a Telugu/Devanagari line ending in `!` or `?` as verse, and (b) treats a short
Latin line as verse when it sits inside a run that alternates Indic and Latin — the line before
is Indic verse and the line after is Indic, or an earlier Latin line already made this a
couplet run. An English sentence that merely follows a Telugu quotation has neither neighbour
and stays prose (booklet two's "To the Devī who abides…"). `chapter-body.tsx` gives those
Latin lines `.rd-roman` (italic, smaller, muted) so the transliteration reads as a gloss.

**Fixed for booklet seven (2026-09-25).** All 25 verse-sections (meter label, verse, METER
line, భావము) and the Telugu phrases quoted inside the English commentary were damaged, and —
unlike booklet nine — there is no Roman transliteration beneath them to cross-check against, so
every line is a reading off the rendered page and nothing else. `scripts/lib/transcribed-
booklet-seven.mjs` holds the 25 sections plus 16 exact-string `fixes` for quoted phrases
(`“గోవర్ధనగిÉధాÉ” → “గోవర్ధనగిరిధారి”` and so on). `restoreTranscribedBookletSeven` finds each
section by its `పద్యం —` label (25 found, in order, or it logs "NOT restored" and does
nothing), and replaces everything from the label up to the first paragraph that opens — or,
where a page break fused them, *contains* — `AUTHOR CONTEXT` or `MEANING`; the English from
that point is kept as stored. Only tripwire: the consonant skeleton of each verse against the
damaged text, which agrees within 2–18% (the damaged text is itself missing whole syllables at
line starts in places, e.g. section 12, so it is a weak check). Read at 3× per page half; a
Telugu reader must proof this one — it is the least cross-checked of all the transcriptions.
Booklets twelve and fourteen have no chapters at all, so there is nothing to fix there.

**Proofreading sheet.** `docs/telugu-proofreading-sheet.html` is a snapshot (2026-09-26) listing
all 128 transcribed passages with their PDF page, for a Telugu reader to check against the
books; tick boxes are stored in that reader's browser only. It is generated from
`backend/scripts/lib/transcribed-*.mjs`, so it goes stale the moment one of those changes:
correct the `.mjs` file first, re-run `clean-booklet-text.mjs`, and regenerate the sheet. A
correction sent by the proofreader is "booklet, page, line" — apply it in the matching module,
never in the database alone, or the next clean pass puts the old reading back.

**Where the damage ends (sweep of every booklet, 2026-09-25).** Booklets four, five, 10, 11,
the nine Movement booklets and all seven Mirror booklets contain no Telugu or Devanagari, and
their Latin text has no stray symbols; every booklet that does contain Indic text (one, two,
three, six, seven, eight, nine) has now been transcribed. The sweep only sees damage that
leaves stray symbols or Latin letters — a wrong vowel sign (booklet six's `కన్నేందు` for
`కన్నొందు`) passes it, so "not flagged" is not "proofread".

**Long paragraphs re-cut from the PDF (2026-09-26).** Some chapters still held several of the
PDF's paragraphs as one block (Author's Notes of booklets 4, 5, 14, 15, 21; booklet 21's chapters
1, 2, 6, 13 at over 3,000 characters), because resplit-booklet-paragraphs.mjs only re-cuts a
chapter whose text matches the extraction letter for letter and cleaning had changed a few
characters. `scripts/recut-long-paragraphs.mjs` splits only paragraphs over `--min` (1000)
characters, at the places a fresh extraction starts a paragraph, comparing letters and digits
only, cutting only after a sentence end, and refusing any cut whose pieces don't rejoin to the
original text. Booklet 21 sets paragraphs just 16 pt apart on a 12–13 pt line, under the
extractor's threshold, so its paragraph starts came from splitting on vertical gap > 14.5 pt
(plus the normal extraction's). Booklets 2, 3, 7, 16 and 17 were then re-cut the same way
from the normal extraction; 19 and 20 needed a 13.5 pt gap threshold. Booklet one's "15. The
Gist" flattened table is rebuilt as a second TABLES entry (four columns). Tables of three or
more columns carry `data-cols` and stack into one entry per row, each cell under its column
name, when their page is under 560px wide (a container query, so the paginated reader's page
width decides, not the window's).

**The reader is ragged-right, not justified.** `.book-flow .rd-p` was `text-align: justify`
with `hyphens: auto`. In a ~35-character column with short paragraphs and long Sanskrit words,
justification can only stretch the spaces, so lines like "Grammar.   Poetry.   Prose.   Andhra"
opened into wide gaps in every booklet — and `text-wrap: pretty` made it worse by breaking
early to avoid a short last line. Hyphenation cannot be relied on to close them: it works in
desktop Chrome and does nothing in headless Chromium and some browsers. Left-aligned text has
no gaps in any browser, so `text-align: left` is the fix; do not go back to `justify` without
a wider measure.

**`/api/content` strips gated chapters**, so a sweep or diff of text taken from the live API
only covers the free chapters and can look clean when it is not. Read the database directly
for anything that must cover a whole booklet.

**Local database trap.** `backend/.env`'s Atlas `MONGODB_URI` contains an unquoted `&`, so
`set -a; . ./.env` in bash silently does NOT set it — the shell's own preset
`MONGODB_URI=mongodb://localhost:27017` (a local mongod holding an unrelated `valluru_books`
and other databases) survives, and a script then reads an empty `valluru_sandbox` there.
Run scripts as `env -u MONGODB_URI -u MONGODB_DB node --env-file=.env scripts/…`, and
always confirm the host (masked) before any write.

**`orphans`/`widows` on `.book-flow .rd-p`** (`app/globals.css`) were `3`, the print
convention for long-form body copy. At the finer paragraph cut most paragraphs here are
one to three lines, short of what `3` can ever split, so a paragraph that didn't fit the
remaining column had to move whole rather than split — visibly stranding blank space at
the *foot* of individual columns (confirmed by screenshot: a chapter opening with three
short paragraphs, half its column left blank, the paragraph that should have followed
sitting complete on the next page instead). Now `1`. **What this does and does not fix,**
checked directly rather than assumed: it removes that per-column waste — real, visible,
worth having — but it does *not* explain a whole booklet's page count. Booklet one's full
19 chapters (6,017 words) paginate to **~110 pages at this reader's column width whether
you use the original coarse paragraphs or the finer re-cut ones** (measured 107 vs 114
side by side, same viewport, same build, only the paragraph source swapped) — that scale
comes from the column being narrow and typographically spacious, a design choice, not
regression from the paragraph-cut work above. Don't reach for "reduce the page count" as
a follow-up without measuring the *baseline* first — free-preview page counts (6 chapters)
and full-booklet counts (19) are not comparable, and it is easy to alarm yourself by
comparing them.

### `NEXT_PUBLIC_SANDBOX=1`

`lib/site-env.ts`. Set on the sandbox Vercel project only. It adds `noindex` (meta and
`X-Robots-Tag`), serves a disallow-all `robots.txt` (`app/robots.ts` replaced the static
file), and leaves out the GA4 and Pixel tags so a test sign-up cannot reach the live
analytics. **Unset is the live site.** When testing tracking locally, block the collect
endpoints in Playwright (`analytics.google.com`, `doubleclick.net`, `facebook.com/tr`,
`google.com/ccm|rmkt`) — the tags fire real hits at the real property.

### The API sleeping must not change the site

Render's free tier sleeps after 15 idle minutes. `getSiteContent` used to turn any failure
into *placeholder content*, which Next treats as a successful render — so the next
regeneration replaced the good page with a degraded one for five minutes (`/inward-mirror`
lost its booklets, booklet text vanished). Now a failure at request time returns the last
real content this instance saw or throws, and Next keeps the last generated page; the
backend marks its own fallback with `X-Content-Source: fallback`. During a *build* it waits
up to 90s for the API and falls back to placeholders only if it never answers. A forced
revalidation (`expire: 0`, an admin save) leaves no stale copy, so with the API down that
one path can still 500 on a cold instance. Inward Mirror booklet pages are prebuilt
(`generateStaticParams`) so they have a page to keep.

### Readers who subscribed before the gate

They hold a flag and an email in localStorage and nothing verifiable. `/api/track-unlock`
returns an access token when the email is already a subscriber, and `ChapterGate` calls it
once (`recoverAccess`) before showing the form.

**What track-unlock may log** (`backend/src/track-unlock.js`, tested). The endpoint is open to
anyone, so the body is not evidence of who is reading. An email and name are recorded only when
the address belongs to a subscriber or the request carries the signed subscriber cookie;
everyone else is an anonymous read (email/name null). The booklet must exist (404 otherwise)
and its title comes from the content, not the request. Repeats by an identified reader within
30 minutes are one unlock and one read. Anonymous reads are not de-duplicated: `request.ip`
behind Render is one of a few internal proxy addresses (`10.x`) shared by every visitor, so
anonymous rows keyed by it are counts, not devices. Fixing that means reading the client IP
from X-Forwarded-For, which changes `trust proxy` and was left alone.

### Sitemap

`app/sitemap.ts`, built from the published content (Inward Fire, Inward Mirror, movements).
The hand-kept `scripts/generate-sitemap.mjs` had drifted — its slugs stopped matching from
booklet six on — and has been deleted.

## Phase 4 — durability

- Move the API off Render free tier, or make every public page independent of it at
  request time (Phase 1 mostly achieves the latter).
- Serve PDFs from Supabase via signed URLs instead of streaming through the API. **Done for
  booklets** (below); the streaming route remains as the fallback.
- Split `admin-editor.tsx` (5.4k lines) and `server.js` (3.9k lines) when something else
  already touches them.
- Strip `console.log` from production request paths.

## Working agreement

- **Sandbox first:** separate Mongo database and Supabase project — never point the
  sandbox at production data.
- One phase per branch, one PR each, before/after numbers in the description.
- Vercel preview deployments are the test rig; share the preview URL rather than files.
- Production auto-deploys, so merge one phase at a time on a quiet day with the previous
  commit ready to revert.
- The stray `.playwright-mcp/` folder (screenshots and console logs from an earlier
  session) is gitignored — delete it before it reaches a public repo.

### What to test at every phase

Mobile and desktop page-load numbers, the booklet page on a real phone, the sign-up flow
end to end including the email arriving, the PDF download for a subscriber **and** for a
non-subscriber, the admin editor still saving correctly, and that GA4, Ads and the Pixel
still record a sign-up.

## Baseline measurements (2026-09-17, production)

TTFB 107ms · DOMContentLoaded 1.77s · load 2.27s (desktop) · `/api/reflections` 1.08s ·
booklet prose absent from server HTML (so invisible to search).

Re-measure before and after each phase and put both numbers in the PR.
