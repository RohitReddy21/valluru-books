# Making the booklet PDFs private

**Why.** Every booklet PDF sits in the public `books` bucket, so each one has a permanent link
that works for anyone who has it, gate or no gate. The signed links the site now hands out are
only a real gate once the files are somewhere a link *cannot* reach. The `books` bucket also
holds cover images, so it can't just be switched to private. The PDFs move to a new private
bucket instead.

**How it works.** The files are copied to a new private bucket **under the same paths**. A new
Render setting, `PRIVATE_PDF_BUCKET`, tells the backend to read booklet PDFs from there. No
stored URL in the database changes, so nothing in the admin editor needs editing and rollback is
one setting. With the setting unset, everything behaves exactly as it does today.

**What you need.** Access to the Supabase project, to both Render services (sandbox and
production), and Node on your computer. Nothing here needs me, and I have not touched Supabase.

> ⚠️ **One rule matters more than the rest: do not delete anything from `books` until the
> production site is running the new code with `PRIVATE_PDF_BUCKET` set (step 8).** If the
> sandbox and production use the same Supabase project, production reads those same files with
> the old code, and deleting them early breaks every booklet PDF on the live site.

---

## Before you start (5 minutes)

1. **Storage room.** Supabase dashboard → **Project Settings → Usage** (or **Billing → Usage**).
   Copying leaves two copies of every PDF until step 9, roughly one extra booklet's worth per
   file (about 10 MB each, 28 files, so **around 300 MB**). Check you have that much free.
2. **Same project?** In Render, open the sandbox service and the production service →
   **Environment** and compare `SUPABASE_URL` (it's a public address, not a secret). If they are
   the same, the warning above applies to you.
3. **Which key does Render hold?** The backend reads `SUPABASE_SERVICE_ROLE_KEY`. It must be the
   **service role** (also called **secret**) key, not the `anon`/publishable one, because only
   that key can read a private bucket. You can't see the value in Render; step 6 proves it works.

---

## Steps

### 1. Create the private bucket
Supabase dashboard → **Storage → New bucket**.
- **Name:** `booklet-pdfs`
- **Public bucket:** switch **OFF**. This is the whole point.
- *(Optional)* **Restrict file size** to `50 MB` and **Allowed MIME types** to `application/pdf`.

Do **not** add any storage policy for this bucket. With no policies, only the service role key can
touch it, which is exactly what you want.

### 2. Get the service role key, for this one job
Dashboard → **Project Settings → API**. Under the **service_role** (or **Secret**) key, click
*Reveal* and copy it. Treat it like a password: never paste it into a chat, a file or a commit.

### 3. Open PowerShell in the project folder and set two variables for this window only
```powershell
cd C:\Users\PC\Downloads\valluru-books-main\valluru-books-main
$env:SUPABASE_URL = "https://<your-project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<paste the key here>"
```
Use the same `SUPABASE_URL` that Render has. These exist only in this PowerShell window.

### 4. Dry run: see what would happen, change nothing
```powershell
node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --to booklet-pdfs
```
You should see `books/pdfs: 28 files` (or however many there are), `to copy: 28`, and a
"would copy" line per file, ending with **Dry run: nothing copied.** If it says the bucket is
public or missing, go back to step 1.

### 5. Copy (still deletes nothing)
```powershell
node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --to booklet-pdfs --apply
```
It copies each file, then checks that every one arrived at its full size. The last line must be
**VERIFIED**. If it says NOT VERIFIED, just run the same command again; it only copies what is
missing and never overwrites. Then clear the key:
```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```
At this point **nothing has changed for anyone**: the originals are all still in `books`.

### 6. Try it on the sandbox
1. Render → sandbox service → **Environment** → add `PRIVATE_PDF_BUCKET` = `booklet-pdfs` → save
   (Render restarts the service).
2. Deploy the branch `valluru-phases-1-3` to the sandbox if it isn't already there.
3. On the sandbox site, open **booklet twelve** as a subscriber and press *Read booklet*. All
   pages should load.
4. To see it working for the right reason, open the browser's Network tab: you should see a call
   to `/pdf-link` and then a request to `…supabase.co/storage/v1/object/sign/booklet-pdfs/…`.
   **If instead you see a 503, "This booklet is temporarily unavailable"**, the key on Render
   can't read a private bucket. Replace `SUPABASE_SERVICE_ROLE_KEY` on that Render service with
   the real service role key from step 2, and try again.

### 7. Test uploading
In the admin editor, upload a booklet PDF for a draft or test booklet. It must land in
`booklet-pdfs/pdfs/…` (check in Storage), not in `books/pdfs/…`. The link shown for it in the admin
looks like a public URL but won't open in a browser. That is expected: the site reads it through
a signed link.

### 8. Cut over production
1. Merge the branch to production the way you normally do (one phase at a time, on a quiet day).
2. Render → **production** service → **Environment** → add `PRIVATE_PDF_BUCKET` = `booklet-pdfs`.
3. On the live site, open booklet twelve as a subscriber and check it reads, the same as step 6.
4. Wait a day, and keep an eye on the Render logs for 503 errors. **Do not go on until
   production has read booklet PDFs from the private bucket successfully.**

### 9. Now make it real: remove the public copies
Only after step 8 is confirmed:

Supabase → **Storage → books → pdfs** → select all the PDF files → **Delete**.
*(Leave `books/covers` and `books/samples` alone. Only the `pdfs` folder goes.)*

### 10. Check it worked
Take one of the old public links, `https://<ref>.supabase.co/storage/v1/object/public/books/pdfs/<file>.pdf`,
and open it in a private window. It must now fail (400 or 404). Then check that a subscriber can
still read booklet twelve on the live site. Anyone holding an old link is now locked out, and the
gate is real.

---

## If something goes wrong

| Symptom | What to do |
|---|---|
| Script says the bucket is **public** or **missing** | Redo step 1. Public must be OFF. |
| **NOT VERIFIED** after copying | Run the same command again. It's safe to repeat. |
| 503 "temporarily unavailable" on the site | The service role key on that Render service is wrong or missing (step 6.4). |
| A booklet PDF is missing on the site after step 8 | Delete the `PRIVATE_PDF_BUCKET` setting on that service. It reverts to the public `books` bucket immediately, since nothing was deleted yet. |
| You need the files back in `books` **after** step 9 | Set the two variables from step 3 and run `node backend/scripts/copy-booklet-pdfs-to-private-bucket.mjs --from booklet-pdfs --to books --apply --allow-public`, then remove `PRIVATE_PDF_BUCKET`. |

## Things that are deliberately unchanged
- **Movement PDFs** stay public, since they aren't gated and load straight from their bucket.
- **Covers and images** in `books` stay where they are and stay public.
- **What the site opens.** Only booklet twelve opens its PDF on the site today; every other booklet
  is read as text. But all 28 illustrated PDFs sit in that public folder, and anyone who has a
  link can download one. That is what this closes.
