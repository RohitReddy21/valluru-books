"use client";

import { useMemo, useState } from "react";
import { Eye, ImageIcon, Package, Plus, RefreshCw, RotateCcw, Save, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { uploadToCloudinary, getCloudinarySignature } from "@/lib/cloudinary";
import type { Booklet, Movement, PublishStatus, SiteContent } from "@/lib/site-content";
import { defaultSiteContent, getBookletMovementIndex } from "@/lib/site-content";

type Props = {
  initialContent: SiteContent;
  source: string;
};

type Tab = "dashboard" | "booklets" | "movements" | "pages" | "media" | "orders" | "settings" | "navigation";
type MediaTarget = "homeHeroImage" | "pageHeroImage" | "authorImage";

type AdminData = {
  counts: {
    content: number;
    subscribers: number;
    comments: number;
    pdfs: number;
    media: number;
    bookReaders: number;
    orders: number;
    draftBooks: number;
    publishedBooks: number;
    archivedBooks: number;
    draftPosts: number;
    publishedPosts: number;
  };
  subscribers: Array<{
    name?: string;
    email?: string;
    lastSource?: string;
    lastBookletTitle?: string | null;
    updatedAt?: string;
  }>;
  comments: Array<{
    name?: string;
    bookletSlug?: string;
    rating?: number;
    comment?: string;
    createdAt?: string;
  }>;
  bookletReaders: Array<{
    name?: string;
    email?: string;
    bookletSlug?: string;
    bookletTitle?: string | null;
    source?: string;
    readCount?: number;
    updatedAt?: string;
    lastReadAt?: string;
  }>;
  orders: Array<{
    id?: string;
    orderNumber?: string;
    status?: string;
    total?: number;
    currency?: string;
    customer?: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
    };
    items?: Array<{ title?: string; quantity?: number }>;
    createdAt?: string;
  }>;
  recentMedia?: Array<MediaAsset>;
  recentActivity?: Array<{
    type?: string;
    label?: string;
    createdAt?: string;
  }>;
};

type MediaAsset = {
  id?: string;
  name?: string;
  url?: string;
  kind?: string;
  folder?: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
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
  const [adminToken, setAdminToken] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedBookletSlug, setSelectedBookletSlug] = useState(
    initialContent.series.booklets[0]?.slug || ""
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
  const [mediaItems, setMediaItems] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaKind, setMediaKind] = useState("all");
  const [mediaFolder, setMediaFolder] = useState("valluru/media");
  const [orders, setOrders] = useState<AdminData["orders"]>([]);
  const [ordersStatus, setOrdersStatus] = useState("Load orders from the database.");

  const selectedBooklet = useMemo(
    () =>
      content.series.booklets.find((booklet) => booklet.slug === selectedBookletSlug) ||
      content.series.booklets[0],
    [content.series.booklets, selectedBookletSlug]
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

  async function login() {
    setStatus("Signing in...");
    const response = await fetch(apiUrl("/api/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const payload = (await response.json().catch(() => null)) as {
      token?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload?.token) {
      setStatus(payload?.error || "Admin login failed.");
      return;
    }

    setAdminToken(payload.token);
    setStatus("Admin signed in.");
  }

  function adminHeaders(extra?: Record<string, string>) {
    return {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      "X-Admin-Password": password,
      ...(extra || {})
    };
  }

  function persistContent() {
    return fetch(apiUrl("/api/content"), {
      method: "PUT",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify({ content })
    });
  }

  async function uploadPdf() {
    if (!pdfFile || !selectedBooklet) {
      setUploadStatus("Choose a booklet and PDF file first.");
      return;
    }

    try {
      setUploadStatus("Uploading PDF...");
      const folder = "valluru/books/pdfs";
      const cloudinaryResult = await uploadToCloudinary(
        pdfFile,
        folder,
        (f) => getCloudinarySignature(adminHeaders(), f)
      );
      
      updateBooklet(selectedBooklet.slug, { pdf: cloudinaryResult.secure_url });
      setUploadStatus(`Uploaded and attached to ${selectedBooklet.title}.`);
    } catch (err) {
      console.error("Upload failed", err);
      setUploadStatus(err instanceof Error ? err.message : "PDF upload failed");
    }
  }

  async function uploadMovementPdf(movementIndex: number, movementPdfFile: File, setMovementUploadStatus: (status: string) => void) {
    try {
      setMovementUploadStatus("Uploading PDF...");
      // Upload directly to Cloudinary using signed upload
      const folder = "valluru/movements/pdfs";
      const cloudinaryResult = await uploadToCloudinary(
        movementPdfFile,
        folder,
        (f) => getCloudinarySignature(adminHeaders(), f)
      );
      
      updateMovement(movementIndex, { pdf: cloudinaryResult.secure_url });
      setMovementUploadStatus("PDF uploaded and attached to this movement.");
    } catch (err) {
      console.error("Upload failed", err);
      setMovementUploadStatus(err instanceof Error ? err.message : "PDF upload failed");
    }
  }

  async function loadAdminData() {
    setDataStatus("Loading database data...");
    const response = await fetch(apiUrl("/api/admin/data"), {
      credentials: "include",
      headers: adminHeaders()
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
      headers: adminHeaders(),
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

  function addBooklet(movementIndex = 0) {
    const nextNumber = content.series.booklets.length + 1;
    const newBooklet: Booklet = {
      slug: `booklet-${nextNumber}`,
      numberLabel: `Booklet ${nextNumber}`,
      title: "New Booklet",
      movementIndex,
      status: "draft",
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

  function updateMovement(index: number, patch: Partial<Movement>) {
    setContent((current) => ({
      ...current,
      home: {
        ...current.home,
        seriesOverview: {
          ...current.home.seriesOverview,
          movements: current.home.seriesOverview.movements.map((movement, movementIndex) =>
            movementIndex === index ? { ...movement, ...patch } : movement
          )
        }
      }
    }));
  }

  function updateBookStatus(slug: string, statusValue: PublishStatus) {
    updateBooklet(slug, { status: statusValue });
  }

  function bulkBookStatus(statusValue: PublishStatus) {
    setContent((current) => ({
      ...current,
      series: {
        ...current.series,
        booklets: current.series.booklets.map((booklet) => ({
          ...booklet,
          status: statusValue
        }))
      }
    }));
  }

  async function loadMedia() {
    setMediaStatus("Loading media library...");
    const response = await fetch(
      apiUrl(`/api/admin/media?search=${encodeURIComponent(mediaSearch)}&kind=${mediaKind}`),
      {
        credentials: "include",
        headers: adminHeaders()
      }
    );
    const payload = (await response.json().catch(() => null)) as {
      media?: MediaAsset[];
      error?: string;
    } | null;

    if (!response.ok || !payload?.media) {
      setMediaStatus(payload?.error || "Could not load media.");
      return;
    }

    setMediaItems(payload.media);
    setMediaStatus("Media library loaded.");
  }

  async function uploadLibraryMedia(file: File | null) {
    if (!file) {
      setMediaStatus("Choose a file first.");
      return;
    }

    setMediaStatus("Uploading to media library...");
    const formData = new FormData();
    formData.append("media", file);
    formData.append("folder", mediaFolder);
    const response = await fetch(apiUrl("/api/admin/media"), {
      method: "POST",
      headers: adminHeaders(),
      credentials: "include",
      body: formData
    });
    const payload = (await response.json().catch(() => null)) as {
      media?: MediaAsset;
      error?: string;
    } | null;

    if (!response.ok || !payload?.media) {
      setMediaStatus(payload?.error || "Media upload failed.");
      return;
    }

    setMediaItems((current) => [payload.media as MediaAsset, ...current]);
    setMediaStatus("Uploaded to media library.");
  }

  async function deleteMedia(id?: string) {
    if (!id) {
      return;
    }

    const response = await fetch(apiUrl(`/api/admin/media/${id}`), {
      method: "DELETE",
      credentials: "include",
      headers: adminHeaders()
    });

    if (response.ok) {
      setMediaItems((current) => current.filter((item) => item.id !== id));
    }
  }

  async function loadOrders() {
    setOrdersStatus("Loading orders...");
    const response = await fetch(apiUrl("/api/admin/orders"), {
      credentials: "include",
      headers: adminHeaders()
    });
    const payload = (await response.json().catch(() => null)) as {
      orders?: AdminData["orders"];
      error?: string;
    } | null;

    if (!response.ok || !payload?.orders) {
      setOrdersStatus(payload?.error || "Could not load orders.");
      return;
    }

    setOrders(payload.orders);
    setOrdersStatus("Orders loaded.");
  }

  async function updateOrderStatus(id: string | undefined, nextStatus: string) {
    if (!id) {
      return;
    }

    setOrdersStatus("Updating order...");
    const response = await fetch(apiUrl(`/api/admin/orders/${id}`), {
      method: "PATCH",
      credentials: "include",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = (await response.json().catch(() => null)) as {
      order?: AdminData["orders"][number];
      error?: string;
    } | null;

    if (!response.ok || !payload?.order) {
      setOrdersStatus(payload?.error || "Order update failed.");
      return;
    }

    setOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, ...payload.order } : order))
    );
    setOrdersStatus("Order status updated.");
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
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
              onClick={login}
              type="button"
            >
              Sign In
            </button>

            <div className="mt-5 grid gap-2">
              {(["dashboard", "booklets", "movements", "pages", "media", "orders", "settings", "navigation"] as Tab[]).map((item) => (
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
                bulkBookStatus={bulkBookStatus}
                mediaItems={mediaItems}
                movements={content.home.seriesOverview.movements}
                pdfFile={pdfFile}
                selectedSlug={selectedBookletSlug}
                setPdfFile={setPdfFile}
                setSelectedSlug={setSelectedBookletSlug}
                updateBooklet={updateBooklet}
                updateBookStatus={updateBookStatus}
                uploadPdf={uploadPdf}
                uploadStatus={uploadStatus}
              />
            ) : null}

            {tab === "movements" ? (
              <MovementsPanel
                addBooklet={addBooklet}
                booklets={content.series.booklets}
                editBooklet={(slug) => {
                  setSelectedBookletSlug(slug);
                  setTab("booklets");
                }}
                movements={content.home.seriesOverview.movements}
                updateMovement={updateMovement}
                uploadMovementPdf={uploadMovementPdf}
              />
            ) : null}

            {tab === "pages" ? (
              <PagesPanel content={content} setContent={setContent} />
            ) : null}

            {tab === "media" ? (
              <MediaPanel
                content={content}
                mediaFile={mediaFile}
                mediaFolder={mediaFolder}
                mediaItems={mediaItems}
                mediaKind={mediaKind}
                mediaSearch={mediaSearch}
                mediaStatus={mediaStatus}
                mediaTarget={mediaTarget}
                deleteMedia={deleteMedia}
                loadMedia={loadMedia}
                setContent={setContent}
                setMediaFile={setMediaFile}
                setMediaFolder={setMediaFolder}
                setMediaKind={setMediaKind}
                setMediaSearch={setMediaSearch}
                setMediaTarget={setMediaTarget}
                uploadLibraryMedia={uploadLibraryMedia}
                uploadMedia={uploadMedia}
              />
            ) : null}

            {tab === "orders" ? (
              <OrdersPanel
                loadOrders={loadOrders}
                orders={orders}
                ordersStatus={ordersStatus}
                updateOrderStatus={updateOrderStatus}
              />
            ) : null}

            {tab === "settings" ? (
              <SettingsPanel content={content} setContent={setContent} />
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
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-md border border-gold/15 bg-ink p-5">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-gold">
                Books Overview
              </p>
              <p className="mt-3 text-lg text-parchment">
                {adminData.counts.publishedBooks} published, {adminData.counts.draftBooks} drafts,
                {" "}{adminData.counts.archivedBooks} archived.
              </p>
            </div>
            <div className="rounded-md border border-gold/15 bg-ink p-5">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-gold">
                Orders Overview
              </p>
              <p className="mt-3 text-lg text-parchment">
                {adminData.counts.orders} total orders in the database.
              </p>
            </div>
            <div className="rounded-md border border-gold/15 bg-ink p-5">
              <p className="font-label text-xs uppercase tracking-[0.22em] text-gold">
                Media Overview
              </p>
              <p className="mt-3 text-lg text-parchment">
                {adminData.counts.media} reusable media files and {adminData.counts.pdfs} PDFs.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Name</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Email</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Source</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Book</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData.subscribers.map((subscriber, index) => (
                    <tr className="border-t border-gold/10" key={`${subscriber.email}-${index}`}>
                      <td className="px-4 py-3 text-parchment">{subscriber.name || "-"}</td>
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

          <FieldGroup title="Recent Activity">
            <div className="grid gap-3 md:grid-cols-2">
              {(adminData.recentActivity || []).map((activity, index) => (
                <article className="rounded-md border border-gold/15 bg-ink p-4" key={`${activity.type}-${index}`}>
                  <p className="font-label text-xs uppercase tracking-[0.18em] text-gold">
                    {activity.type || "Activity"}
                  </p>
                  <p className="mt-2 text-lg text-parchment">{activity.label || "Updated record"}</p>
                  <p className="mt-1 text-sm text-muted">
                    {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "-"}
                  </p>
                </article>
              ))}
              {(adminData.recentActivity || []).length === 0 ? (
                <p className="text-muted">No recent activity found.</p>
              ) : null}
            </div>
          </FieldGroup>

          <FieldGroup title="Book Readers">
            <div className="overflow-x-auto rounded-md border border-gold/15">
              <table className="w-full min-w-[820px] text-left text-base">
                <thead className="bg-ink text-muted">
                  <tr>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Name</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Email</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Book</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Reads</th>
                    <th className="px-4 py-3 font-label uppercase tracking-[0.18em]">Last Read</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData.bookletReaders.map((reader, index) => (
                    <tr className="border-t border-gold/10" key={`${reader.email}-${reader.bookletSlug}-${index}`}>
                      <td className="px-4 py-3 text-parchment">{reader.name || "-"}</td>
                      <td className="px-4 py-3 text-parchment">{reader.email || "-"}</td>
                      <td className="px-4 py-3 text-muted">
                        {reader.bookletTitle || reader.bookletSlug || "-"}
                      </td>
                      <td className="px-4 py-3 text-muted">{reader.readCount || 1}</td>
                      <td className="px-4 py-3 text-muted">
                        {reader.lastReadAt || reader.updatedAt
                          ? new Date(reader.lastReadAt || reader.updatedAt || "").toLocaleString()
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
                    <span>{comment.name || "Reader"}</span>
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
  deleteMedia,
  loadMedia,
  mediaFile,
  mediaFolder,
  mediaItems,
  mediaKind,
  mediaSearch,
  mediaStatus,
  mediaTarget,
  setContent,
  setMediaFile,
  setMediaFolder,
  setMediaKind,
  setMediaSearch,
  setMediaTarget,
  uploadLibraryMedia,
  uploadMedia
}: {
  content: SiteContent;
  deleteMedia: (id?: string) => void;
  loadMedia: () => void;
  mediaFile: File | null;
  mediaFolder: string;
  mediaItems: MediaAsset[];
  mediaKind: string;
  mediaSearch: string;
  mediaStatus: string;
  mediaTarget: MediaTarget;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  setMediaFile: (file: File | null) => void;
  setMediaFolder: (value: string) => void;
  setMediaKind: (value: string) => void;
  setMediaSearch: (value: string) => void;
  setMediaTarget: (target: MediaTarget) => void;
  uploadLibraryMedia: (file: File | null) => void;
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
          Edit hero images, page background image, and author image. Uploads are stored in Cloudinary and reused through MongoDB metadata.
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
          Media Library Upload
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <TextField label="Folder" onChange={setMediaFolder} value={mediaFolder} />
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            File
            <input
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm normal-case tracking-normal text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
              onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!mediaFile}
            onClick={() => uploadLibraryMedia(mediaFile)}
            type="button"
          >
            <Upload size={16} />
            Upload File
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
          <TextField label="Search Media" onChange={setMediaSearch} value={mediaSearch} />
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            Filter
            <select
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) => setMediaKind(event.target.value)}
              value={mediaKind}
            >
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="pdf">PDFs</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
            </select>
          </label>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
            onClick={loadMedia}
            type="button"
          >
            <RefreshCw size={16} />
            Load Media
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mediaItems.map((item) => (
            <article className="rounded-md border border-gold/15 bg-surface p-4" key={item.id || item.url}>
              <div className="aspect-video overflow-hidden rounded-md border border-gold/10 bg-ink">
                {item.kind === "image" && item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.name || "Media"} className="h-full w-full object-cover" src={item.url} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Package size={28} />
                  </div>
                )}
              </div>
              <p className="mt-3 truncate text-base text-parchment">{item.name}</p>
              <p className="mt-1 font-label text-xs uppercase tracking-[0.18em] text-muted">
                {item.kind} · {item.folder}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.url ? (
                  <button
                    className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                    onClick={() => navigator.clipboard?.writeText(item.url || "")}
                    type="button"
                  >
                    Copy URL
                  </button>
                ) : null}
                <button
                  className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                  onClick={() => deleteMedia(item.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-3 text-base italic text-muted">{mediaStatus}</p>
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Quick Apply Image
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
      </div>
    </div>
  );
}

function MovementsPanel({
  addBooklet,
  booklets,
  editBooklet,
  movements,
  updateMovement,
  uploadMovementPdf
}: {
  addBooklet: (movementIndex?: number) => void;
  booklets: Booklet[];
  editBooklet: (slug: string) => void;
  movements: Movement[];
  updateMovement: (index: number, patch: Partial<Movement>) => void;
  uploadMovementPdf: (movementIndex: number, file: File, setStatus: (status: string) => void) => void;
}) {
  const [movementPdfFiles, setMovementPdfFiles] = useState<(File | null)[]>(movements.map(() => null));
  const [movementUploadStatuses, setMovementUploadStatuses] = useState<string[]>(movements.map(() => "Upload a PDF for this movement."));

  function handleMovementPdfFileChange(index: number, file: File | null) {
    setMovementPdfFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function handleMovementUploadStatusChange(index: number, status: string) {
    setMovementUploadStatuses((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <h2 className="font-display text-2xl text-parchment sm:text-3xl">
        Five Movements
      </h2>
      {movements.map((movement, index) => (
        <FieldGroup key={`${movement.title}-${index}`} title={`Movement ${index + 1}`}>
          <TextField label="Title" onChange={(value) => updateMovement(index, { title: value })} value={movement.title} />
          <TextField label="Booklets Label" onChange={(value) => updateMovement(index, { booklets: value })} value={movement.booklets} />
          <TextField label="Link" onChange={(value) => updateMovement(index, { href: value })} value={movement.href || ""} />
          <TextAreaField label="Description" onChange={(value) => updateMovement(index, { description: value })} value={movement.description} />
          <TextField label="PDF Path" onChange={(value) => updateMovement(index, { pdf: value })} value={movement.pdf || ""} />
          <div className="rounded-md border border-gold/15 bg-ink p-5">
            <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
              Movement PDF Upload
            </p>
            <input
              accept="application/pdf,.pdf"
              className="mt-4 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
              onChange={(event) => handleMovementPdfFileChange(index, event.target.files?.[0] || null)}
              type="file"
            />
            <button
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
              disabled={!movementPdfFiles[index]}
              onClick={() => {
                if (movementPdfFiles[index]) {
                  uploadMovementPdf(index, movementPdfFiles[index]!, (status) => handleMovementUploadStatusChange(index, status));
                }
              }}
              type="button"
            >
              <Upload size={16} />
              Upload PDF
            </button>
            <p className="mt-3 text-base italic text-muted">{movementUploadStatuses[index]}</p>
          </div>
          <div className="rounded-md border border-gold/15 bg-ink p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                  Books in this movement
                </p>
                <p className="mt-2 text-base text-muted">
                  Add a book here, then upload its PDF in the book editor.
                </p>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
                onClick={() => addBooklet(index)}
                type="button"
              >
                <Plus size={16} />
                Add Book
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {booklets
                .filter((booklet, bookletIndex) => getBookletMovementIndex(booklet, bookletIndex) === index)
                .map((booklet) => (
                  <div
                    className="flex flex-col justify-between gap-3 rounded-md border border-gold/10 bg-surface px-4 py-3 sm:flex-row sm:items-center"
                    key={booklet.slug}
                  >
                    <div>
                      <p className="text-lg text-parchment">{booklet.title}</p>
                      <p className="font-label text-xs uppercase tracking-[0.18em] text-muted">
                        {booklet.numberLabel} - {booklet.status || "published"}
                      </p>
                    </div>
                    <button
                      className="rounded-md border border-gold/25 px-3 py-2 font-label text-xs uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
                      onClick={() => editBooklet(booklet.slug)}
                      type="button"
                    >
                      Edit / Upload
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </FieldGroup>
      ))}
    </div>
  );
}

function OrdersPanel({
  loadOrders,
  orders,
  ordersStatus,
  updateOrderStatus
}: {
  loadOrders: () => void;
  orders: AdminData["orders"];
  ordersStatus: string;
  updateOrderStatus: (id: string | undefined, status: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredOrders = orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.status,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.email,
      order.customer?.address,
      ...(order.items || []).map((item) => item.title)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-display text-2xl text-parchment sm:text-3xl">
            Orders
          </h2>
          <p className="mt-2 text-lg text-muted">Search and status updates can be handled from this order list.</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={loadOrders}
          type="button"
        >
          <RefreshCw size={16} />
          Load Orders
        </button>
      </div>
      <TextField label="Search Orders" onChange={setSearch} value={search} />
      <p className="text-base italic text-muted">{ordersStatus}</p>
      <div className="grid gap-3">
        {filteredOrders.map((order, index) => (
          <article className="rounded-md border border-gold/15 bg-ink p-4" key={`${order.orderNumber}-${index}`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="flex flex-wrap gap-3 font-label text-xs uppercase tracking-[0.18em] text-gold">
                <span>{order.orderNumber}</span>
                <span>{order.status}</span>
                <span>{order.currency} {Number(order.total || 0).toFixed(2)}</span>
              </div>
              <select
                className="rounded-md border border-gold/20 bg-surface px-3 py-2 text-base text-parchment outline-none focus:border-gold/60"
                onChange={(event) => updateOrderStatus(order.id, event.target.value)}
                value={order.status || "pending"}
              >
                {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-3 text-lg text-parchment">
              {order.customer?.name || "Customer"} · {order.customer?.phone || "-"} · {order.customer?.email || "-"}
            </p>
            <p className="mt-2 text-muted">
              {(order.items || []).map((item) => `${item.title} x ${item.quantity}`).join(", ")}
            </p>
            <p className="mt-2 text-sm text-muted">
              {order.customer?.address || "No address"}
            </p>
          </article>
        ))}
        {filteredOrders.length === 0 ? (
          <p className="text-muted">No matching orders.</p>
        ) : null}
      </div>
    </div>
  );
}
/*
              <span>{order.currency} {Number(order.total || 0).toFixed(2)}</span>
            </div>
            <p className="mt-3 text-lg text-parchment">
              {order.customer?.name} · {order.customer?.phone} · {order.customer?.email}
            </p>
            <p className="mt-2 text-muted">
              {(order.items || []).map((item) => `${item.title} x ${item.quantity}`).join(", ")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
*/

function SettingsPanel({
  content,
  setContent
}: {
  content: SiteContent;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
}) {
  const settings = {
    ...defaultSiteContent.settings,
    ...(content.settings || {}),
    seo: {
      ...defaultSiteContent.settings.seo,
      ...(content.settings?.seo || {})
    }
  };

  function updateSettings(patch: Partial<SiteContent["settings"]>) {
    setContent((current) => ({
      ...current,
      settings: {
        ...settings,
        ...patch
      }
    }));
  }

  return (
    <div className="grid gap-7">
      <FieldGroup title="Checkout Settings">
        <TextField label="WhatsApp Number" onChange={(value) => updateSettings({ whatsappNumber: value })} value={settings.whatsappNumber} />
        <TextField label="Website Name" onChange={(value) => updateSettings({ websiteName: value })} value={settings.websiteName} />
      </FieldGroup>
      <FieldGroup title="Contact Information">
        <TextField label="Contact Email" onChange={(value) => updateSettings({ contactEmail: value })} value={settings.contactEmail} />
        <TextField label="Contact Phone" onChange={(value) => updateSettings({ contactPhone: value })} value={settings.contactPhone} />
        <TextAreaField label="Address" onChange={(value) => updateSettings({ address: value })} value={settings.address} />
      </FieldGroup>
      <FieldGroup title="Social Media Links">
        <TextField
          label="Website"
          onChange={(value) => updateSettings({ socialLinks: { ...(settings.socialLinks || {}), website: value } })}
          value={settings.socialLinks?.website || ""}
        />
        <TextField
          label="LinkedIn"
          onChange={(value) => updateSettings({ socialLinks: { ...(settings.socialLinks || {}), linkedin: value } })}
          value={settings.socialLinks?.linkedin || ""}
        />
        <TextField
          label="Instagram"
          onChange={(value) => updateSettings({ socialLinks: { ...(settings.socialLinks || {}), instagram: value } })}
          value={settings.socialLinks?.instagram || ""}
        />
        <TextField
          label="YouTube"
          onChange={(value) => updateSettings({ socialLinks: { ...(settings.socialLinks || {}), youtube: value } })}
          value={settings.socialLinks?.youtube || ""}
        />
      </FieldGroup>
      <FieldGroup title="SEO Settings">
        <TextField label="SEO Title" onChange={(value) => updateSettings({ seo: { ...settings.seo, title: value } })} value={settings.seo.title || ""} />
        <TextAreaField label="SEO Description" onChange={(value) => updateSettings({ seo: { ...settings.seo, description: value } })} value={settings.seo.description || ""} />
        <TextField label="SEO Keywords" onChange={(value) => updateSettings({ seo: { ...settings.seo, keywords: value } })} value={settings.seo.keywords || ""} />
      </FieldGroup>
    </div>
  );
}

function BookletPanel({
  booklet,
  booklets,
  selectedSlug,
  setSelectedSlug,
  updateBooklet,
  updateBookStatus,
  bulkBookStatus,
  addBooklet,
  mediaItems,
  movements,
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
  updateBookStatus: (slug: string, status: PublishStatus) => void;
  bulkBookStatus: (status: PublishStatus) => void;
  addBooklet: () => void;
  mediaItems: MediaAsset[];
  movements: Movement[];
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  uploadPdf: () => void;
  uploadStatus: string;
}) {
  const currentMovementIndex = getBookletMovementIndex(
    booklet,
    booklets.findIndex((item) => item.slug === booklet.slug)
  );

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
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
          onClick={() => bulkBookStatus("published")}
          type="button"
        >
          Bulk Publish
        </button>
        <button
          className="rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
          onClick={() => bulkBookStatus("archived")}
          type="button"
        >
          Bulk Archive
        </button>
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Publishing
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            Status
            <select
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) => updateBookStatus(booklet.slug, event.target.value as PublishStatus)}
              value={booklet.status || "published"}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          {([
            ["Save as Draft", "draft"],
            ["Publish", "published"],
            ["Unpublish", "draft"],
            ["Archive", "archived"]
          ] as Array<[string, PublishStatus]>).map(([label, statusValue]) => (
            <button
              className="rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
              key={label}
              onClick={() => updateBookStatus(booklet.slug, statusValue)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
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
      <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
        Movement
        <select
          className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
          onChange={(event) =>
            updateBooklet(booklet.slug, { movementIndex: Number(event.target.value) })
          }
          value={String(currentMovementIndex)}
        >
          {movements.map((movement, index) => (
            <option key={`${movement.title}-${index}`} value={index}>
              Movement {index + 1}: {movement.title}
            </option>
          ))}
        </select>
      </label>
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
      <div className="grid gap-5 md:grid-cols-3">
        <TextField
          label="Price"
          onChange={(value) => updateBooklet(booklet.slug, { price: Number(value) || 0 })}
          value={String(booklet.price ?? 0)}
        />
        <TextField
          label="Currency"
          onChange={(value) => updateBooklet(booklet.slug, { currency: value })}
          value={booklet.currency || "INR"}
        />
        <TextField
          label="Cover Image URL"
          onChange={(value) => updateBooklet(booklet.slug, { coverImage: value })}
          value={booklet.coverImage || ""}
        />
      </div>
      <TextField
        label="Gallery Image URLs (comma separated)"
        onChange={(value) =>
          updateBooklet(booklet.slug, {
            galleryImages: value.split(",").map((item) => item.trim()).filter(Boolean)
          })
        }
        value={(booklet.galleryImages || []).join(", ")}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          label="Categories (comma separated)"
          onChange={(value) =>
            updateBooklet(booklet.slug, {
              categories: value.split(",").map((item) => item.trim()).filter(Boolean)
            })
          }
          value={(booklet.categories || []).join(", ")}
        />
        <TextField
          label="Tags (comma separated)"
          onChange={(value) =>
            updateBooklet(booklet.slug, {
              tags: value.split(",").map((item) => item.trim()).filter(Boolean)
            })
          }
          value={(booklet.tags || []).join(", ")}
        />
      </div>
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
      <TextField
        label="PDF Sample Path"
        onChange={(value) => updateBooklet(booklet.slug, { samplePdf: value })}
        value={booklet.samplePdf || ""}
      />
      {mediaItems.length > 0 ? (
        <FieldGroup title="Reuse Existing Media">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mediaItems.map((item) => {
              const mediaUrl = item.url?.startsWith("/") ? apiUrl(item.url) : item.url || "";

              return (
                <article className="rounded-md border border-gold/15 bg-surface p-4" key={item.id || item.url}>
                  <p className="truncate text-base text-parchment">{item.name || "Media"}</p>
                  <p className="mt-1 font-label text-xs uppercase tracking-[0.18em] text-muted">
                    {item.kind}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.kind === "image" ? (
                      <>
                        <button
                          className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                          onClick={() => updateBooklet(booklet.slug, { coverImage: mediaUrl })}
                          type="button"
                        >
                          Use Cover
                        </button>
                        <button
                          className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                          onClick={() =>
                            updateBooklet(booklet.slug, {
                              galleryImages: [...(booklet.galleryImages || []), mediaUrl]
                            })
                          }
                          type="button"
                        >
                          Add Gallery
                        </button>
                      </>
                    ) : null}
                    {item.kind === "pdf" ? (
                      <>
                        <button
                          className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                          onClick={() => updateBooklet(booklet.slug, { pdf: mediaUrl })}
                          type="button"
                        >
                          Use PDF
                        </button>
                        <button
                          className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted"
                          onClick={() => updateBooklet(booklet.slug, { samplePdf: mediaUrl })}
                          type="button"
                        >
                          Use Sample
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-sm text-muted">
            Load media in the Media tab first, then reuse files here.
          </p>
        </FieldGroup>
      ) : null}
      <FieldGroup title="Book SEO">
        <TextField
          label="SEO Title"
          onChange={(value) =>
            updateBooklet(booklet.slug, { seo: { ...(booklet.seo || {}), title: value } })
          }
          value={booklet.seo?.title || ""}
        />
        <TextAreaField
          label="SEO Description"
          onChange={(value) =>
            updateBooklet(booklet.slug, { seo: { ...(booklet.seo || {}), description: value } })
          }
          value={booklet.seo?.description || ""}
        />
        <TextField
          label="SEO Keywords"
          onChange={(value) =>
            updateBooklet(booklet.slug, { seo: { ...(booklet.seo || {}), keywords: value } })
          }
          value={booklet.seo?.keywords || ""}
        />
      </FieldGroup>

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
