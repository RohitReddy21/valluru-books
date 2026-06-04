"use client";

import { useMemo, useState } from "react";
import { Eye, ImageIcon, Plus, RefreshCw, RotateCcw, Save, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { Booklet, Essay, SiteContent } from "@/lib/site-content";
import { defaultSiteContent } from "@/lib/site-content";

type Props = {
  initialContent: SiteContent;
  source: string;
};

type Tab = "dashboard" | "booklets" | "pages" | "essays" | "media" | "navigation";
type MediaTarget = "homeHeroImage" | "pageHeroImage" | "authorImage";

type AdminData = {
  counts: {
    content: number;
    subscribers: number;
    comments: number;
    pdfs: number;
    media: number;
  };
  subscribers: Array<{
    email?: string;
    lastSource?: string;
    lastBookletTitle?: string | null;
    updatedAt?: string;
  }>;
  comments: Array<{
    bookletSlug?: string;
    rating?: number;
    comment?: string;
    createdAt?: string;
  }>;
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "new-booklet"
  );
}

function toParagraphs(value: string) {
  return value
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fromParagraphs(value: string[]) {
  return value.join("\n\n");
}

export function AdminEditor({ initialContent, source }: Props) {
  const [content, setContent] = useState<SiteContent>(() => ({
    ...initialContent,
    media: {
      ...defaultSiteContent.media,
      ...(initialContent.media || {})
    }
  }));
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedBookletSlug, setSelectedBookletSlug] = useState(
    initialContent.series.booklets[0]?.slug || ""
  );
  const [selectedEssaySlug, setSelectedEssaySlug] = useState(
    initialContent.essays.items[0]?.slug || ""
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Edit content and save.");
  const [uploadStatus, setUploadStatus] = useState(
    "Upload a PDF and attach it to a booklet."
  );
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [dataStatus, setDataStatus] = useState("Enter password and load DB data.");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>("homeHeroImage");
  const [mediaStatus, setMediaStatus] = useState("Upload images into MongoDB.");

  const selectedBooklet = useMemo(
    () =>
      content.series.booklets.find((booklet) => booklet.slug === selectedBookletSlug) ||
      content.series.booklets[0],
    [content.series.booklets, selectedBookletSlug]
  );
  const selectedEssay = useMemo(
    () =>
      content.essays.items.find((essay) => essay.slug === selectedEssaySlug) ||
      content.essays.items[0],
    [content.essays.items, selectedEssaySlug]
  );

  function updateBooklet(slug: string, patch: Partial<Booklet>) {
    setContent((current) => ({
      ...current,
      series: {
        ...current.series,
        booklets: current.series.booklets.map((booklet) =>
          booklet.slug === slug ? { ...booklet, ...patch } : booklet
        )
      }
    }));
  }

  function updateEssay(slug: string, patch: Partial<Essay>) {
    setContent((current) => ({
      ...current,
      essays: {
        ...current.essays,
        items: current.essays.items.map((essay) =>
          essay.slug === slug ? { ...essay, ...patch } : essay
        )
      }
    }));
  }

  async function save() {
    setStatus("Saving...");
    const response = await persistContent();

    if (response.ok) {
      setStatus("Saved. Refresh public pages to see changes.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setStatus(payload?.error || "Save failed.");
  }

  function persistContent() {
    return fetch(apiUrl("/api/content"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": password
      },
      credentials: "include",
      body: JSON.stringify({ content })
    });
  }

  async function uploadPdf() {
    if (!pdfFile || !selectedBooklet) {
      setUploadStatus("Choose a booklet and PDF file first.");
      return;
    }

    setUploadStatus("Saving book content...");
    const saveResponse = await persistContent();
    if (!saveResponse.ok) {
      const payload = (await saveResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      setUploadStatus(payload?.error || "Save the book before uploading failed.");
      return;
    }

    setUploadStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("bookletSlug", selectedBooklet.slug);
    formData.append("pdf", pdfFile);

    const response = await fetch(apiUrl("/api/admin/upload-pdf"), {
      method: "POST",
      headers: {
        "X-Admin-Password": password
      },
      credentials: "include",
      body: formData
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      pdf?: string;
    } | null;

    if (!response.ok || !payload?.pdf) {
      setUploadStatus(payload?.error || "PDF upload failed.");
      return;
    }

    updateBooklet(selectedBooklet.slug, { pdf: payload.pdf });
    setUploadStatus(`Uploaded and attached to ${selectedBooklet.title}.`);
  }

  async function loadAdminData() {
    setDataStatus("Loading database data...");
    const response = await fetch(apiUrl("/api/admin/data"), {
      credentials: "include",
      headers: {
        "X-Admin-Password": password
      }
    });

    const payload = (await response.json().catch(() => null)) as
      | (AdminData & { error?: string })
      | null;

    if (!response.ok || !payload) {
      setDataStatus(payload?.error || "Could not load database data.");
      return;
    }

    setAdminData(payload);
    setDataStatus("Database data loaded.");
  }

  async function uploadMedia() {
    if (!mediaFile) {
      setMediaStatus("Choose an image file first.");
      return;
    }

    setMediaStatus("Uploading image...");
    const formData = new FormData();
    formData.append("media", mediaFile);

    const response = await fetch(apiUrl("/api/admin/upload-media"), {
      method: "POST",
      headers: {
        "X-Admin-Password": password
      },
      credentials: "include",
      body: formData
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      url?: string;
    } | null;

    if (!response.ok || !payload?.url) {
      setMediaStatus(payload?.error || "Image upload failed.");
      return;
    }

    const uploadedUrl = apiUrl(payload.url);

    setContent((current) => ({
      ...current,
      media: {
        ...defaultSiteContent.media,
        ...(current.media || {}),
        [mediaTarget]: uploadedUrl
      }
    }));
    setMediaStatus(`Uploaded and applied to ${mediaTarget}. Save content to keep it.`);
  }

  function addBooklet() {
    const nextNumber = content.series.booklets.length + 1;
    const newBooklet: Booklet = {
      slug: `booklet-${nextNumber}`,
      numberLabel: `Booklet ${nextNumber}`,
      title: "New Booklet",
      subtitle: "Subtitle",
      description: "Add the full booklet description here.",
      tag: "Available"
    };

    setContent((current) => ({
      ...current,
      series: {
        ...current.series,
        booklets: [...current.series.booklets, newBooklet]
      }
    }));
    setSelectedBookletSlug(newBooklet.slug);
    setTab("booklets");
  }

  function addEssay() {
    const newEssay: Essay = {
      slug: "new-essay",
      date: "June 2026",
      category: "Dharma",
      readingTime: "5 min",
      title: "New Essay",
      excerpt: "Add the essay excerpt here."
    };

    setContent((current) => ({
      ...current,
      essays: {
        ...current.essays,
        items: [...current.essays.items, newEssay]
      }
    }));
    setSelectedEssaySlug(newEssay.slug);
    setTab("essays");
  }

  return (
    <main className="min-h-screen bg-ink px-5 py-10 text-parchment">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 border-b border-gold/15 pb-8 md:flex-row md:items-end">
          <div>
            <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
              Admin
            </p>
            <h1 className="responsive-page-title mt-3 font-display font-semibold">
              Site Content Editor
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-7 text-muted">
              Edit the site with fields instead of code. Add booklets, upload
              PDFs, update page copy, and save changes.
            </p>
          </div>
          <div className="rounded-md border border-gold/15 bg-surface px-4 py-3 text-sm text-muted">
            Source: {source}
          </div>
        </div>

        <div className="mt-7 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="rounded-md border border-gold/15 bg-surface/70 p-5">
            <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
              Admin Password
              <input
                className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>

            <div className="mt-5 grid gap-2">
              {(["dashboard", "booklets", "pages", "essays", "media", "navigation"] as Tab[]).map((item) => (
                <button
                  className={`rounded-md border px-4 py-3 text-left font-label text-sm uppercase tracking-[0.18em] transition ${
                    tab === item
                      ? "border-gold/60 text-gold"
                      : "border-gold/15 text-muted hover:border-gold/40 hover:text-parchment"
                  }`}
                  key={item}
                  onClick={() => setTab(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
              onClick={save}
              type="button"
            >
              <Save size={16} />
              Save
            </button>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/20 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold/40 hover:text-gold"
              onClick={() => setContent(defaultSiteContent)}
              type="button"
            >
              <RotateCcw size={16} />
              Load Defaults
            </button>
            <p className="mt-5 text-base italic leading-7 text-muted">{status}</p>
          </aside>

          <section className="rounded-md border border-gold/15 bg-surface/50 p-5 sm:p-7">
            {tab === "dashboard" ? (
              <DashboardPanel
                adminData={adminData}
                dataStatus={dataStatus}
                loadAdminData={loadAdminData}
              />
            ) : null}

            {tab === "booklets" && selectedBooklet ? (
              <BookletPanel
                addBooklet={addBooklet}
                booklet={selectedBooklet}
                booklets={content.series.booklets}
                pdfFile={pdfFile}
                selectedSlug={selectedBookletSlug}
                setPdfFile={setPdfFile}
                setSelectedSlug={setSelectedBookletSlug}
                updateBooklet={updateBooklet}
                uploadPdf={uploadPdf}
                uploadStatus={uploadStatus}
              />
            ) : null}

            {tab === "pages" ? (
              <PagesPanel content={content} setContent={setContent} />
            ) : null}

            {tab === "essays" && selectedEssay ? (
              <EssaysPanel
                addEssay={addEssay}
                essay={selectedEssay}
                essays={content.essays.items}
                selectedSlug={selectedEssaySlug}
                setSelectedSlug={setSelectedEssaySlug}
                updateEssay={updateEssay}
              />
            ) : null}

            {tab === "media" ? (
              <MediaPanel
                content={content}
                mediaFile={mediaFile}
                mediaStatus={mediaStatus}
                mediaTarget={mediaTarget}
                setContent={setContent}
                setMediaFile={setMediaFile}
                setMediaTarget={setMediaTarget}
                uploadMedia={uploadMedia}
              />
            ) : null}

            {tab === "navigation" ? (
              <NavigationPanel content={content} setContent={setContent} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
      {label}
      <input
        className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-lg normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 5
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
      {label}
      <textarea
        className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-lg normal-case leading-7 tracking-normal text-parchment outline-none focus:border-gold/60"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

function DashboardPanel({
  adminData,
  dataStatus,
  loadAdminData
}: {
  adminData: AdminData | null;
  dataStatus: string;
  loadAdminData: () => void;
}) {
  return (
    <div className="grid gap-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-display text-2xl text-parchment sm:text-3xl">
            Database Dashboard
          </h2>
          <p className="mt-2 text-lg leading-7 text-muted">
            View stored subscribers, comments, uploaded PDFs, media, and content records.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={loadAdminData}
          type="button"
        >
          <RefreshCw size={16} />
          Load DB Data
        </button>
      </div>
      <p className="text-base italic text-muted">{dataStatus}</p>

      {adminData ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Object.entries(adminData.counts).map(([label, count]) => (
              <div className="rounded-md border border-gold/15 bg-ink p-4" key={label}>
                <p className="font-label text-xs uppercase tracking-[0.22em] text-muted">
                  {label}
                </p>
                <p className="mt-2 font-display text-3xl text-parchment">{count}</p>
              </div>
            ))}
          </div>

          <FieldGroup title="Subscribers">
            <div className="overflow-x-auto rounded-md border border-gold/15">
              <table className="w-full min-w-[680px] text-left text-base">
                <thead className="bg-ink text-muted">
                  <tr>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Email</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Source</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Book</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData.subscribers.map((subscriber, index) => (
                    <tr className="border-t border-gold/10" key={`${subscriber.email}-${index}`}>
                      <td className="px-4 py-3 text-parchment">{subscriber.email}</td>
                      <td className="px-4 py-3 text-muted">{subscriber.lastSource}</td>
                      <td className="px-4 py-3 text-muted">{subscriber.lastBookletTitle || "-"}</td>
                      <td className="px-4 py-3 text-muted">
                        {subscriber.updatedAt
                          ? new Date(subscriber.updatedAt).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FieldGroup>

          <FieldGroup title="Comments">
            <div className="grid gap-3">
              {adminData.comments.map((comment, index) => (
                <article className="rounded-md border border-gold/15 bg-ink p-4" key={index}>
                  <div className="flex flex-wrap gap-3 font-label text-xs uppercase tracking-[0.2em] text-gold">
                    <span>{comment.bookletSlug}</span>
                    <span>{comment.rating || 0} stars</span>
                    <span>
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "-"}
                    </span>
                  </div>
                  <p className="mt-3 text-lg leading-7 text-parchment/86">
                    {comment.comment || "No comment text."}
                  </p>
                </article>
              ))}
            </div>
          </FieldGroup>
        </>
      ) : null}
    </div>
  );
}

function MediaPanel({
  content,
  mediaFile,
  mediaStatus,
  mediaTarget,
  setContent,
  setMediaFile,
  setMediaTarget,
  uploadMedia
}: {
  content: SiteContent;
  mediaFile: File | null;
  mediaStatus: string;
  mediaTarget: MediaTarget;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  setMediaFile: (file: File | null) => void;
  setMediaTarget: (target: MediaTarget) => void;
  uploadMedia: () => void;
}) {
  const media = {
    ...defaultSiteContent.media,
    ...(content.media || {})
  };

  function updateMedia(target: MediaTarget, value: string) {
    setContent((current) => ({
      ...current,
      media: {
        ...defaultSiteContent.media,
        ...(current.media || {}),
        [target]: value
      }
    }));
  }

  return (
    <div className="grid gap-7">
      <div>
        <h2 className="font-display text-2xl text-parchment sm:text-3xl">
          Media and Backgrounds
        </h2>
        <p className="mt-2 text-lg leading-7 text-muted">
          Edit hero images, page background image, and author image. Uploads are stored in MongoDB.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {([
          ["homeHeroImage", "Home Hero"],
          ["pageHeroImage", "Page Hero / Book Pages"],
          ["authorImage", "Author Image"]
        ] as Array<[MediaTarget, string]>).map(([target, label]) => (
          <div className="rounded-md border border-gold/15 bg-ink p-4" key={target}>
            <div className="aspect-video overflow-hidden rounded-md border border-gold/10 bg-surface">
              {media[target] ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={label}
                    className="h-full w-full object-cover"
                    src={media[target]}
                  />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <ImageIcon size={28} />
                </div>
              )}
            </div>
            <TextField
              label={label}
              onChange={(value) => updateMedia(target, value)}
              value={media[target]}
            />
            {media[target] ? (
              <a
                className="mt-3 inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.18em] text-muted transition hover:text-gold"
                href={media[target]}
                rel="noreferrer"
                target="_blank"
              >
                <Eye size={14} />
                Preview
              </a>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Upload Image
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            Apply To
            <select
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) => setMediaTarget(event.target.value as MediaTarget)}
              value={mediaTarget}
            >
              <option value="homeHeroImage">Home Hero</option>
              <option value="pageHeroImage">Page Hero / Book Pages</option>
              <option value="authorImage">Author Image</option>
            </select>
          </label>
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            Image File
            <input
              accept="image/*"
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm normal-case tracking-normal text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
              onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!mediaFile}
            onClick={uploadMedia}
            type="button"
          >
            <Upload size={16} />
            Upload
          </button>
        </div>
        <p className="mt-3 text-base italic text-muted">{mediaStatus}</p>
      </div>
    </div>
  );
}

function BookletPanel({
  booklet,
  booklets,
  selectedSlug,
  setSelectedSlug,
  updateBooklet,
  addBooklet,
  pdfFile,
  setPdfFile,
  uploadPdf,
  uploadStatus
}: {
  booklet: Booklet;
  booklets: Booklet[];
  selectedSlug: string;
  setSelectedSlug: (slug: string) => void;
  updateBooklet: (slug: string, patch: Partial<Booklet>) => void;
  addBooklet: () => void;
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  uploadPdf: () => void;
  uploadStatus: string;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <label className="block flex-1 font-label text-sm uppercase tracking-[0.2em] text-muted">
          Choose Booklet
          <select
            className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
            onChange={(event) => setSelectedSlug(event.target.value)}
            value={selectedSlug}
          >
            {booklets.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.numberLabel}: {item.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={addBooklet}
          type="button"
        >
          <Plus size={16} />
          Add New Book
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          label="Slug"
          onChange={(value) => {
            const nextSlug = slugify(value);
            updateBooklet(booklet.slug, { slug: nextSlug });
            setSelectedSlug(nextSlug);
          }}
          value={booklet.slug}
        />
        <TextField
          label="Number Label"
          onChange={(value) => updateBooklet(booklet.slug, { numberLabel: value })}
          value={booklet.numberLabel}
        />
      </div>
      <TextField
        label="Title"
        onChange={(value) => updateBooklet(booklet.slug, { title: value })}
        value={booklet.title}
      />
      <TextField
        label="Subtitle"
        onChange={(value) => updateBooklet(booklet.slug, { subtitle: value })}
        value={booklet.subtitle}
      />
      <TextAreaField
        label="Description"
        onChange={(value) => updateBooklet(booklet.slug, { description: value })}
        rows={8}
        value={booklet.description}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          label="Sources Note"
          onChange={(value) => updateBooklet(booklet.slug, { sourcesNote: value })}
          value={booklet.sourcesNote || ""}
        />
        <TextField
          label="Badge / Tag"
          onChange={(value) => updateBooklet(booklet.slug, { badge: value, tag: value })}
          value={booklet.badge || booklet.tag}
        />
      </div>
      <TextField
        label="PDF Path"
        onChange={(value) => updateBooklet(booklet.slug, { pdf: value })}
        value={booklet.pdf || ""}
      />

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          PDF Upload
        </p>
        <input
          accept="application/pdf,.pdf"
          className="mt-4 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
          onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
          type="file"
        />
        <button
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
          disabled={!pdfFile}
          onClick={uploadPdf}
          type="button"
        >
          <Upload size={16} />
          Upload PDF
        </button>
        <p className="mt-3 text-base italic text-muted">{uploadStatus}</p>
      </div>
    </div>
  );
}

function PagesPanel({
  content,
  setContent
}: {
  content: SiteContent;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
}) {
  return (
    <div className="grid gap-8">
      <FieldGroup title="Home Hero">
        <TextField
          label="Hero Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, title: value } }
            }))
          }
          value={content.home.hero.title}
        />
        <TextAreaField
          label="Hero Body"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: {
                ...current.home,
                hero: { ...current.home.hero, body: toParagraphs(value) }
              }
            }))
          }
          value={fromParagraphs(content.home.hero.body)}
        />
      </FieldGroup>

      <FieldGroup title="Home Sections">
        <TextAreaField
          label="Why This Exists"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: {
                ...current.home,
                why: { ...current.home.why, body: toParagraphs(value) }
              }
            }))
          }
          rows={8}
          value={fromParagraphs(content.home.why.body)}
        />
        <TextAreaField
          label="For Whom"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: {
                ...current.home,
                forWhom: { ...current.home.forWhom, body: toParagraphs(value) }
              }
            }))
          }
          value={fromParagraphs(content.home.forWhom.body)}
        />
        <TextField
          label="Featured Quote"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, quote: { ...current.home.quote, text: value } }
            }))
          }
          value={content.home.quote.text}
        />
      </FieldGroup>

      <FieldGroup title="Series and About">
        <TextAreaField
          label="Series Opening"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, opening: toParagraphs(value) }
            }))
          }
          value={fromParagraphs(content.series.opening)}
        />
        <TextAreaField
          label="About Bio"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, bio: toParagraphs(value) }
            }))
          }
          rows={7}
          value={fromParagraphs(content.about.bio)}
        />
      </FieldGroup>
    </div>
  );
}

function EssaysPanel({
  essays,
  essay,
  selectedSlug,
  setSelectedSlug,
  updateEssay,
  addEssay
}: {
  essays: Essay[];
  essay: Essay;
  selectedSlug: string;
  setSelectedSlug: (slug: string) => void;
  updateEssay: (slug: string, patch: Partial<Essay>) => void;
  addEssay: () => void;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <label className="block flex-1 font-label text-sm uppercase tracking-[0.2em] text-muted">
          Choose Essay
          <select
            className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
            onChange={(event) => setSelectedSlug(event.target.value)}
            value={selectedSlug}
          >
            {essays.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={addEssay}
          type="button"
        >
          <Plus size={16} />
          Add Essay
        </button>
      </div>
      <TextField
        label="Slug"
        onChange={(value) => {
          const nextSlug = slugify(value);
          updateEssay(essay.slug, { slug: nextSlug });
          setSelectedSlug(nextSlug);
        }}
        value={essay.slug}
      />
      <TextField
        label="Title"
        onChange={(value) => updateEssay(essay.slug, { title: value })}
        value={essay.title}
      />
      <div className="grid gap-5 md:grid-cols-3">
        <TextField
          label="Date"
          onChange={(value) => updateEssay(essay.slug, { date: value })}
          value={essay.date}
        />
        <TextField
          label="Category"
          onChange={(value) => updateEssay(essay.slug, { category: value })}
          value={essay.category}
        />
        <TextField
          label="Reading Time"
          onChange={(value) => updateEssay(essay.slug, { readingTime: value })}
          value={essay.readingTime}
        />
      </div>
      <TextAreaField
        label="Excerpt"
        onChange={(value) => updateEssay(essay.slug, { excerpt: value })}
        value={essay.excerpt}
      />
    </div>
  );
}

function NavigationPanel({
  content,
  setContent
}: {
  content: SiteContent;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
}) {
  return (
    <div className="grid gap-8">
      <FieldGroup title="Navigation">
        <TextField
          label="Logo"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              nav: { ...current.nav, logo: value }
            }))
          }
          value={content.nav.logo}
        />
        <TextField
          label="Button Label"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              nav: { ...current.nav, button: { ...current.nav.button, label: value } }
            }))
          }
          value={content.nav.button.label}
        />
      </FieldGroup>
      <FieldGroup title="Footer">
        <TextField
          label="Footer Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, title: value }
            }))
          }
          value={content.footer.title}
        />
        <TextField
          label="Footer Email"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, email: value }
            }))
          }
          value={content.footer.email}
        />
        <TextAreaField
          label="Bottom Line"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, bottomLine: value }
            }))
          }
          value={content.footer.bottomLine}
        />
      </FieldGroup>
    </div>
  );
}

function FieldGroup({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-gold/15 pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-display text-2xl text-parchment sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}
