# The Valluru

Next.js, React, Tailwind CSS, and MongoDB implementation for **The Valluru — The Inward Fire Series**.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If another app is already using port 3000, run:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Open `http://127.0.0.1:3010`.

## MongoDB and Admin Editing

Copy `.env.example` to `.env.local` and set:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/valluru_books
MONGODB_DB=valluru_books
ADMIN_PASSWORD=change-this-before-production
RESEND_API_KEY=re_your_resend_key
RESEND_FROM=The Valluru <onboarding@resend.dev>
ADMIN_NOTIFICATION_EMAIL=sasi@theValluru.org
```

Then open `http://localhost:3000/admin`. The admin page edits the full site content JSON: navigation, home sections, series booklets, essays, about page, footer, and PDF links.

Without `MONGODB_URI`, the public site still renders from built-in defaults. Write operations require MongoDB so content, subscribers, comments, and PDFs do not silently save outside the database.

Database collections used:

- `content` - site content edited from admin
- `subscribers` - newsletter and gated-booklet readers
- `comments` - booklet ratings and reader comments
- `reflections` - compatibility copy of booklet comments
- `booklet_pdfs.files` and `booklet_pdfs.chunks` - uploaded PDF files through Mongo GridFS

## Upload PDFs From Admin

1. Open `/admin`.
2. Enter the `ADMIN_PASSWORD` from `.env.local`.
3. Use the **PDF Upload** panel.
4. Choose the booklet and select a PDF file.
5. Click **Upload PDF**.

The uploaded file is stored in MongoDB GridFS, the selected booklet's `pdf` value is updated to `/api/booklets/{slug}/pdf`, and the public booklet page will show that PDF inside the reader popup.

## Booklet Access

Booklet One is readable for free. Booklets Two through Nine show a subscription gate before the embedded full-page PDF reader appears. The site does not show direct public PDF file links; it renders PDFs through `/api/booklets/{slug}/pdf`.

When `RESEND_API_KEY` is configured, subscriptions send a confirmation email to the reader and a notification email to `ADMIN_NOTIFICATION_EMAIL`.
