# The Valluru

React, Next.js, Tailwind CSS, Express, MongoDB, GridFS, and Resend implementation for The Valluru.

## Project Structure

```text
frontend/  Next.js public website and admin UI
backend/   Express API for content, subscribers, comments, PDFs, media, and email
```

## Run Locally

Install dependencies from the repo root:

```bash
npm install
```

Create backend env:

```bash
cp backend/.env.example backend/.env
```

Create frontend env:

```bash
cp frontend/.env.example frontend/.env.local
```

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3010
```

Open `http://127.0.0.1:3010`.

## Environment Variables

Backend variables:

```bash
PORT=4000
FRONTEND_ORIGIN=http://127.0.0.1:3010
MONGODB_URI=mongodb://127.0.0.1:27017/valluru_books
MONGODB_DB=valluru_books
ADMIN_PASSWORD=change-this-before-production
RESEND_API_KEY=re_your_resend_key
RESEND_FROM=The Valluru <onboarding@resend.dev>
ADMIN_NOTIFICATION_EMAIL=sasi@theValluru.org
```

Frontend variables:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
API_BASE_URL=http://127.0.0.1:4000
```

## Admin Editing

Open `/admin`, enter `ADMIN_PASSWORD`, and edit the site through form fields. The admin page can edit text, navigation, home and page images, booklets, essays, and uploaded PDFs.

All saved data goes through the backend into MongoDB:

- `content` stores site content edited from admin
- `subscribers` stores newsletter and gated-booklet readers
- `comments` stores ratings and reader comments
- `reflections` stores a compatibility copy of comments
- `booklet_pdfs.files` and `booklet_pdfs.chunks` store PDFs in GridFS
- `media_uploads.files` and `media_uploads.chunks` store uploaded images in GridFS

## Hosting

Render backend:

1. Create a Render Web Service from this GitHub repo.
2. Set Root Directory to `backend`.
3. Set Build Command to `npm install`.
4. Set Start Command to `npm run start`.
5. Add the backend environment variables above.
6. Set `FRONTEND_ORIGIN` to your Vercel frontend URL after deploying Vercel.

Vercel frontend:

1. Import this GitHub repo in Vercel.
2. Set Root Directory to `frontend`.
3. Set Build Command to `npm run build`.
4. Set Output Directory to `.next`.
5. Add `NEXT_PUBLIC_API_BASE_URL` and `API_BASE_URL` with your Render backend URL.

Booklet One is free. Other booklets require email subscription before the PDF reader opens. PDFs and media are uploaded from admin and stored in MongoDB GridFS.
