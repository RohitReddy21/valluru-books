"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, FileText, ImageIcon, Mail, Package, Plus, RefreshCw, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { apiUrl } from "@/lib/api";
import type { Booklet, Movement, PublishStatus, SiteContent } from "@/lib/site-content";
import { defaultSiteContent, getBookletMovementIndex, isBookletInMovement } from "@/lib/site-content";
import { ImageManagerPanel } from "@/components/image-manager-panel";

type Props = {
  initialContent: SiteContent;
  source: string;
};

type Tab = "dashboard" | "booklets" | "movements" | "pages" | "pdfs" | "media" | "images" | "orders" | "settings" | "navigation";
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
  source?: string;
  provider?: string;
  storageBucket?: string;
  storagePath?: string;
  publicUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  assignedTo?: {
    type?: string;
    slug?: string;
    index?: number;
    title?: string;
    field?: string;
  } | null;
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

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function remapMovementBookletIndices(
  movements: Movement[],
  previousBooklets: Booklet[],
  nextBooklets: Booklet[]
) {
  const previousSlugs = previousBooklets.map((booklet) => booklet.slug);
  const nextIndexBySlug = new Map(
    nextBooklets.map((booklet, index) => [booklet.slug, index])
  );

  return movements.map((movement) => {
    if (!movement.bookletIndices?.length) {
      return movement;
    }

    const nextIndices = Array.from(
      new Set(
        movement.bookletIndices
          .map((index) => previousSlugs[index])
          .map((slug) => (slug ? nextIndexBySlug.get(slug) : undefined))
          .filter((index): index is number => typeof index === "number")
      )
    ).sort((left, right) => left - right);

    return { ...movement, bookletIndices: nextIndices };
  });
}

function fromParagraphs(value: string[]) {
  return value.join("\n\n");
}

function formatFileSize(bytes?: number) {
  const value = Number(bytes || 0);

  if (!value) {
    return "Unknown size";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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
  const [bookletCoverFile, setBookletCoverFile] = useState<File | null>(null);
  const [bookletCoverStatus, setBookletCoverStatus] = useState("Upload a cover image for this booklet.");
  const [bookletBackgroundFile, setBookletBackgroundFile] = useState<File | null>(null);
  const [bookletBackgroundStatus, setBookletBackgroundStatus] = useState(
    "Upload a background image for this booklet page."
  );
  const [status, setStatus] = useState("Edit content and save.");
  const [uploadStatus, setUploadStatus] = useState(
    "Upload a PDF and attach it to a booklet."
  );
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [dataStatus, setDataStatus] = useState("Enter password and load DB data.");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget>("homeHeroImage");
  const [mediaStatus, setMediaStatus] = useState("Upload files into Supabase Storage.");
  const [mediaItems, setMediaItems] = useState<MediaAsset[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaKind, setMediaKind] = useState("all");
  const [mediaFolder, setMediaFolder] = useState("media/gallery");
  const [pdfItems, setPdfItems] = useState<MediaAsset[]>([]);
  const [pdfSearch, setPdfSearch] = useState("");
  const [pdfFolder, setPdfFolder] = useState("downloads");
  const [pdfLibraryFile, setPdfLibraryFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState("Load PDFs from the database.");
  const [orders, setOrders] = useState<AdminData["orders"]>([]);
  const [ordersStatus, setOrdersStatus] = useState("Load orders from the database.");
  const [emailTestStatus, setEmailTestStatus] = useState(
    "Send a test to verify the owner notification inbox."
  );

  const selectedBooklet = useMemo(
    () =>
      content.series.booklets.find((booklet) => booklet.slug === selectedBookletSlug) ||
      content.series.booklets[0],
    [content.series.booklets, selectedBookletSlug]
  );
  const combinedMediaItems = useMemo(() => {
    const byKey = new Map<string, MediaAsset>();

    for (const item of [...mediaItems, ...pdfItems]) {
      const key = item.id || item.url || item.name || `${byKey.size}`;
      byKey.set(key, item);
    }

    return Array.from(byKey.values());
  }, [mediaItems, pdfItems]);

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

  function reorderBooklet(slug: string, targetIndex: number) {
    setContent((current) => {
      const booklets = current.series.booklets;
      const fromIndex = booklets.findIndex((booklet) => booklet.slug === slug);
      const nextIndex = Math.max(0, Math.min(targetIndex, booklets.length - 1));

      if (fromIndex === -1 || fromIndex === nextIndex) {
        return current;
      }

      const nextBooklets = moveArrayItem(booklets, fromIndex, nextIndex);

      return {
        ...current,
        series: {
          ...current.series,
          booklets: nextBooklets
        },
        home: {
          ...current.home,
          seriesOverview: {
            ...current.home.seriesOverview,
            movements: remapMovementBookletIndices(
              current.home.seriesOverview.movements,
              booklets,
              nextBooklets
            )
          }
        },
        movements: {
          ...current.movements,
          items: remapMovementBookletIndices(
            current.movements.items,
            booklets,
            nextBooklets
          )
        }
      };
    });
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

  function uploadFormData<T>(
    path: string,
    formData: FormData,
    onProgress: (percent: number) => void
  ) {
    return new Promise<{ ok: boolean; payload: (T & { error?: string }) | null; status: number }>(
      (resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl(path));
        xhr.withCredentials = true;

        Object.entries(adminHeaders()).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          let payload: (T & { error?: string }) | null = null;

          try {
            if (xhr.responseText) {
              const parsed = JSON.parse(xhr.responseText);
              payload = (parsed as T & { error?: string }) || null;
            } else {
              payload = null;
            }
          } catch (parseError) {
            const statusText = xhr.status === 404 ? "Endpoint not found. Backend may not be deployed." : "Upload failed.";
            payload = { error: statusText } as T & { error?: string };
          }

          const isOk = xhr.status >= 200 && xhr.status < 300;
          resolve({ ok: isOk, payload, status: xhr.status });
        };
        xhr.onerror = () => {
          const errorPayload: T & { error?: string } = { error: "Upload failed. Check the storage connection and try again." } as T & { error?: string };
          resolve({
            ok: false,
            payload: errorPayload,
            status: 0
          });
        };
        xhr.send(formData);
      }
    );
  }

  function sanitizeContent(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof Array) return obj.map(item => sanitizeContent(item));

    // Check if this is a plain object
    if (obj.constructor !== Object) return undefined;

    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        // Skip functions, symbols, and React-related properties
        if (typeof value === "function" || typeof value === "symbol") continue;
        if (key.startsWith("__react") || key.startsWith("_")) continue;
        sanitized[key] = sanitizeContent(value);
      }
    }
    return sanitized;
  }

  function persistContent() {
    try {
      // Sanitize content to remove any React elements or circular references
      const cleanContent = sanitizeContent(content);

      return fetch(apiUrl("/api/content"), {
        method: "PUT",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ content: cleanContent })
      });
    } catch (error) {
      console.error("Error saving content:", error);
      setStatus("Error saving. Please refresh and try again.");
      return Promise.reject(error);
    }
  }

  async function uploadPdf() {
    if (!pdfFile || !selectedBooklet) {
      setUploadStatus("Choose a booklet and PDF file first.");
      return;
    }

    setUploadStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("bookletSlug", selectedBooklet.slug);
    formData.append("pdf", pdfFile);

    try {
      const { ok, payload } = await uploadFormData<{
        error?: string;
        pdf?: string;
        media?: MediaAsset;
      }>("/api/admin/upload-pdf", formData, (percent) =>
        setUploadStatus(`Uploading PDF... ${percent}%`)
      );

      if (!ok || !payload?.pdf) {
        const errorMsg = payload?.error || "PDF upload failed.";
        setUploadStatus(typeof errorMsg === "string" ? errorMsg : "PDF upload failed.");
        return;
      }

      updateBooklet(selectedBooklet.slug, { pdf: payload.pdf });
      if (payload.media) {
        setPdfItems((current) => [payload.media as MediaAsset, ...current.filter((item) => item.id !== payload.media?.id)]);
      }
      setUploadStatus(`Uploaded and attached to ${selectedBooklet.title}.`);
    } catch (error) {
      setUploadStatus("PDF upload failed. Check your connection and try again.");
    }
  }

  async function uploadMovementPdf(movementIndex: number, movementPdfFile: File, setMovementUploadStatus: (status: string) => void) {
    setMovementUploadStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("movementIndex", String(movementIndex));
    formData.append("pdf", movementPdfFile);

    const { ok, payload } = await uploadFormData<{
      error?: string;
      pdf?: string;
      media?: MediaAsset;
    }>("/api/admin/upload-movement-pdf", formData, (percent) =>
      setMovementUploadStatus(`Uploading PDF... ${percent}%`)
    );

    if (!ok || !payload?.pdf) {
      setMovementUploadStatus(payload?.error || "PDF upload failed.");
      return;
    }

    updateMovement(movementIndex, { pdf: payload.pdf });
    if (payload.media) {
      setPdfItems((current) => [payload.media as MediaAsset, ...current.filter((item) => item.id !== payload.media?.id)]);
    }
    setMovementUploadStatus("PDF uploaded and attached to this movement.");
  }

  async function uploadBookletCover() {
    if (!bookletCoverFile || !selectedBookletSlug) {
      setBookletCoverStatus("Choose a booklet and cover image first.");
      return;
    }

    setBookletCoverStatus("Uploading cover image to storage...");
    try {
      const formData = new FormData();
      formData.append("file", bookletCoverFile);
      formData.append("slug", selectedBookletSlug);

      const headers = adminHeaders();

      const response = await fetch(apiUrl("/api/admin/upload-booklet-cover"), {
        method: "POST",
        headers,
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          setBookletCoverStatus(`Upload failed: ${error.error || "Unknown error"}`);
        } catch {
          setBookletCoverStatus(`Upload failed: ${response.statusText || "Unknown error"}`);
        }
        return;
      }

      const data = await response.json();
      updateBooklet(selectedBookletSlug, { coverImage: data.url });
      setBookletCoverStatus("✓ Image uploaded. Click the Save button to persist changes.");
      setBookletCoverFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error uploading image";
      setBookletCoverStatus(errorMessage);
    }
  }

  async function uploadBookletBackground() {
    if (!bookletBackgroundFile || !selectedBookletSlug) {
      setBookletBackgroundStatus("Choose a booklet and background image first.");
      return;
    }

    setBookletBackgroundStatus("Uploading background image to storage...");
    try {
      const formData = new FormData();
      formData.append("file", bookletBackgroundFile);
      formData.append("slug", selectedBookletSlug);
      formData.append("imageRole", "background");

      const headers = adminHeaders();

      const response = await fetch(apiUrl("/api/admin/upload-booklet-cover"), {
        method: "POST",
        headers,
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          setBookletBackgroundStatus(`Upload failed: ${error.error || "Unknown error"}`);
        } catch {
          setBookletBackgroundStatus(`Upload failed: ${response.statusText || "Unknown error"}`);
        }
        return;
      }

      const data = await response.json();
      updateBooklet(selectedBookletSlug, { backgroundImage: data.url });
      setBookletBackgroundStatus("✓ Background uploaded. Click the Save button to persist changes.");
      setBookletBackgroundFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error uploading image";
      setBookletBackgroundStatus(errorMessage);
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

  async function sendOwnerTestEmail() {
    setEmailTestStatus("Sending test owner notification...");

    const response = await fetch(apiUrl("/api/admin/test-owner-email"), {
      method: "POST",
      credentials: "include",
      headers: adminHeaders()
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!response.ok || !payload?.ok) {
      setEmailTestStatus(payload?.error || "The test email could not be sent.");
      return;
    }

    setEmailTestStatus("✓ Test accepted by Resend. Check the owner inbox and spam folder.");
  }

  async function uploadMedia() {
    if (!mediaFile) {
      setMediaStatus("Choose an image file first.");
      return;
    }

    setMediaStatus("Uploading image...");
    const formData = new FormData();
    formData.append("media", mediaFile);

    const { ok, payload } = await uploadFormData<{
      error?: string;
      url?: string;
    }>("/api/admin/upload-media", formData, (percent) =>
      setMediaStatus(`Uploading image... ${percent}%`)
    );

    if (!ok || !payload?.url) {
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

  function addMovement() {
    const newMovement: Movement = {
      title: "New Movement",
      booklets: "",
      description: "Add the movement description here.",
      status: "draft"
    };

    setContent((current) => ({
      ...current,
      home: {
        ...current.home,
        seriesOverview: {
          ...current.home.seriesOverview,
          movements: [...current.home.seriesOverview.movements, newMovement]
        }
      },
      movements: {
        ...current.movements,
        items: [...current.movements.items, newMovement]
      }
    }));
  }

  function deleteMovement(index: number) {
    if (!window.confirm("Are you sure you want to delete this movement?")) {
      return;
    }

    setContent((current) => ({
      ...current,
      home: {
        ...current.home,
        seriesOverview: {
          ...current.home.seriesOverview,
          movements: current.home.seriesOverview.movements.filter((_, i) => i !== index)
        }
      },
      movements: {
        ...current.movements,
        items: current.movements.items.filter((_, i) => i !== index)
      }
    }));
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
      },
      movements: {
        ...current.movements,
        items: current.movements.items.map((movement, movementIndex) =>
          movementIndex === index ? { ...movement, ...patch } : movement
        )
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
    const { ok, payload } = await uploadFormData<{
      media?: MediaAsset;
      error?: string;
    }>("/api/admin/media", formData, (percent) =>
      setMediaStatus(`Uploading to media library... ${percent}%`)
    );

    if (!ok || !payload?.media) {
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

  async function replaceMediaAsset(id: string | undefined, file: File | null, folder?: string) {
    if (!id || !file) {
      setMediaStatus("Choose a replacement file first.");
      return;
    }

    setMediaStatus("Replacing media...");
    const formData = new FormData();
    formData.append("media", file);
    if (folder) {
      formData.append("folder", folder);
    }

    const { ok, payload } = await uploadFormData<{
      media?: MediaAsset;
      content?: SiteContent | null;
      error?: string;
    }>(`/api/admin/media/${id}/replace`, formData, (percent) =>
      setMediaStatus(`Replacing media... ${percent}%`)
    );

    if (!ok || !payload?.media) {
      setMediaStatus(payload?.error || "Media replacement failed.");
      return;
    }

    setMediaItems((current) =>
      current.map((item) => (item.id === id ? (payload.media as MediaAsset) : item))
    );
    if (payload.content) {
      setContent(payload.content);
    }
    setMediaStatus("Media replaced.");
  }

  function upsertPdfItem(item: MediaAsset) {
    setPdfItems((current) => [item, ...current.filter((pdf) => pdf.id !== item.id)]);
  }

  async function loadPdfs() {
    setPdfStatus("Loading PDFs...");
    const response = await fetch(
      apiUrl(`/api/admin/pdfs?search=${encodeURIComponent(pdfSearch)}`),
      {
        credentials: "include",
        headers: adminHeaders()
      }
    );
    const payload = (await response.json().catch(() => null)) as {
      pdfs?: MediaAsset[];
      error?: string;
    } | null;

    if (!response.ok || !payload?.pdfs) {
      setPdfStatus(payload?.error || "Could not load PDFs.");
      return;
    }

    setPdfItems(payload.pdfs);
    setPdfStatus("PDF library loaded.");
  }

  async function uploadLibraryPdf(file: File | null) {
    if (!file) {
      setPdfStatus("Choose a PDF first.");
      return;
    }

    setPdfStatus("Uploading PDF...");
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("folder", pdfFolder);

    const { ok, payload } = await uploadFormData<{
      media?: MediaAsset;
      error?: string;
    }>("/api/admin/pdfs", formData, (percent) =>
      setPdfStatus(`Uploading PDF... ${percent}%`)
    );

    if (!ok || !payload?.media) {
      setPdfStatus(payload?.error || "PDF upload failed.");
      return;
    }

    upsertPdfItem(payload.media);
    setPdfLibraryFile(null);
    setPdfStatus("PDF uploaded to the library.");
  }

  async function updatePdfAsset(
    id: string | undefined,
    patch: {
      name?: string;
      folder?: string;
      source?: string;
      assignmentType?: string;
      bookletSlug?: string;
      movementIndex?: number;
      field?: string;
    }
  ) {
    if (!id) {
      return;
    }

    setPdfStatus("Updating PDF...");
    const response = await fetch(apiUrl(`/api/admin/pdfs/${id}`), {
      method: "PATCH",
      credentials: "include",
      headers: adminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch)
    });
    const payload = (await response.json().catch(() => null)) as {
      media?: MediaAsset;
      content?: SiteContent | null;
      error?: string;
    } | null;

    if (!response.ok || !payload?.media) {
      setPdfStatus(payload?.error || "PDF update failed.");
      return;
    }

    upsertPdfItem(payload.media);
    if (payload.content) {
      setContent(payload.content);
    }
    setPdfStatus("PDF updated.");
  }

  async function deletePdfAsset(id?: string, clearReferences = true) {
    if (!id) {
      return;
    }

    setPdfStatus("Deleting PDF...");
    const response = await fetch(
      apiUrl(`/api/admin/pdfs/${id}?clearReferences=${clearReferences ? "true" : "false"}`),
      {
        method: "DELETE",
        credentials: "include",
        headers: adminHeaders()
      }
    );
    const payload = (await response.json().catch(() => null)) as {
      content?: SiteContent | null;
      error?: string;
    } | null;

    if (!response.ok) {
      setPdfStatus(payload?.error || "PDF delete failed.");
      return;
    }

    setPdfItems((current) => current.filter((item) => item.id !== id));
    setMediaItems((current) => current.filter((item) => item.id !== id));
    if (payload?.content) {
      setContent(payload.content);
    }
    setPdfStatus("PDF deleted.");
  }

  async function replacePdfAsset(id: string | undefined, file: File | null, folder?: string) {
    if (!id || !file) {
      setPdfStatus("Choose a replacement PDF first.");
      return;
    }

    setPdfStatus("Replacing PDF...");
    const formData = new FormData();
    formData.append("pdf", file);
    if (folder) {
      formData.append("folder", folder);
    }

    const { ok, payload } = await uploadFormData<{
      media?: MediaAsset;
      content?: SiteContent | null;
      error?: string;
    }>(`/api/admin/pdfs/${id}/replace`, formData, (percent) =>
      setPdfStatus(`Replacing PDF... ${percent}%`)
    );

    if (!ok || !payload?.media) {
      setPdfStatus(payload?.error || "PDF replacement failed.");
      return;
    }

    upsertPdfItem(payload.media);
    if (payload.content) {
      setContent(payload.content);
    }
    setPdfStatus("PDF replaced.");
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
              {(["dashboard", "booklets", "movements", "pages", "pdfs", "media", "images", "orders", "settings", "navigation"] as Tab[]).map((item) => (
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
                mediaItems={combinedMediaItems}
                movements={content.home.seriesOverview.movements}
                pdfFile={pdfFile}
                selectedSlug={selectedBookletSlug}
                setPdfFile={setPdfFile}
                setSelectedSlug={setSelectedBookletSlug}
                reorderBooklet={reorderBooklet}
                updateBooklet={updateBooklet}
                updateBookStatus={updateBookStatus}
                uploadPdf={uploadPdf}
                uploadStatus={uploadStatus}
                bookletCoverFile={bookletCoverFile}
                setBookletCoverFile={setBookletCoverFile}
                uploadBookletCover={uploadBookletCover}
                bookletCoverStatus={bookletCoverStatus}
                bookletBackgroundFile={bookletBackgroundFile}
                setBookletBackgroundFile={setBookletBackgroundFile}
                uploadBookletBackground={uploadBookletBackground}
                bookletBackgroundStatus={bookletBackgroundStatus}
                fallbackBackgroundImage={content.media.pageHeroImage}
              />
            ) : null}

            {tab === "movements" ? (
              <MovementsPanel
                addBooklet={addBooklet}
                addMovement={addMovement}
                deleteMovement={deleteMovement}
                adminToken={adminToken}
                password={password}
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

            {tab === "pdfs" ? (
              <PdfsPanel
                booklets={content.series.booklets}
                deletePdfAsset={deletePdfAsset}
                loadPdfs={loadPdfs}
                movements={content.home.seriesOverview.movements}
                pdfFile={pdfLibraryFile}
                pdfFolder={pdfFolder}
                pdfItems={pdfItems}
                pdfSearch={pdfSearch}
                pdfStatus={pdfStatus}
                replacePdfAsset={replacePdfAsset}
                setPdfFile={setPdfLibraryFile}
                setPdfFolder={setPdfFolder}
                setPdfSearch={setPdfSearch}
                updatePdfAsset={updatePdfAsset}
                uploadLibraryPdf={uploadLibraryPdf}
              />
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
                replaceMediaAsset={replaceMediaAsset}
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

            {tab === "images" ? (
              <ImageManagerPanel />
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
              <SettingsPanel
                content={content}
                emailTestStatus={emailTestStatus}
                sendOwnerTestEmail={sendOwnerTestEmail}
                setContent={setContent}
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

function PdfsPanel({
  booklets,
  deletePdfAsset,
  loadPdfs,
  movements,
  pdfFile,
  pdfFolder,
  pdfItems,
  pdfSearch,
  pdfStatus,
  replacePdfAsset,
  setPdfFile,
  setPdfFolder,
  setPdfSearch,
  updatePdfAsset,
  uploadLibraryPdf
}: {
  booklets: Booklet[];
  deletePdfAsset: (id?: string, clearReferences?: boolean) => void;
  loadPdfs: () => void;
  movements: Movement[];
  pdfFile: File | null;
  pdfFolder: string;
  pdfItems: MediaAsset[];
  pdfSearch: string;
  pdfStatus: string;
  replacePdfAsset: (id: string | undefined, file: File | null, folder?: string) => void;
  setPdfFile: (file: File | null) => void;
  setPdfFolder: (value: string) => void;
  setPdfSearch: (value: string) => void;
  updatePdfAsset: (
    id: string | undefined,
    patch: {
      name?: string;
      folder?: string;
      source?: string;
      assignmentType?: string;
      bookletSlug?: string;
      movementIndex?: number;
      field?: string;
    }
  ) => void;
  uploadLibraryPdf: (file: File | null) => void;
}) {
  return (
    <div className="grid gap-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="font-display text-2xl text-parchment sm:text-3xl">
            PDF Library
          </h2>
          <p className="mt-2 text-lg leading-7 text-muted">
            Upload, read, edit, assign, and delete booklet or movement PDFs from one place.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={loadPdfs}
          type="button"
        >
          <RefreshCw size={16} />
          Load PDFs
        </button>
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Upload PDF
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <TextField label="Folder" onChange={setPdfFolder} value={pdfFolder} />
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            PDF File
            <input
              accept="application/pdf,.pdf"
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm normal-case tracking-normal text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
              onChange={(event) => setPdfFile(event.target.files?.[0] || null)}
              type="file"
            />
          </label>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!pdfFile}
            onClick={() => uploadLibraryPdf(pdfFile)}
            type="button"
          >
            <Upload size={16} />
            Upload PDF
          </button>
        </div>
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <TextField label="Search PDFs" onChange={setPdfSearch} value={pdfSearch} />
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
            onClick={loadPdfs}
            type="button"
          >
            <RefreshCw size={16} />
            Search
          </button>
        </div>
        <p className="mt-3 text-base italic text-muted">{pdfStatus}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {pdfItems.map((item) => (
          <PdfAssetCard
            booklets={booklets}
            deletePdfAsset={deletePdfAsset}
            item={item}
            key={item.id || item.url}
            movements={movements}
            replacePdfAsset={replacePdfAsset}
            updatePdfAsset={updatePdfAsset}
          />
        ))}
        {pdfItems.length === 0 ? (
          <div className="rounded-md border border-gold/15 bg-ink p-5 text-muted">
            No PDFs loaded yet. Use Load PDFs to sync existing book and movement PDFs.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PdfAssetCard({
  booklets,
  deletePdfAsset,
  item,
  movements,
  replacePdfAsset,
  updatePdfAsset
}: {
  booklets: Booklet[];
  deletePdfAsset: (id?: string, clearReferences?: boolean) => void;
  item: MediaAsset;
  movements: Movement[];
  replacePdfAsset: (id: string | undefined, file: File | null, folder?: string) => void;
  updatePdfAsset: (
    id: string | undefined,
    patch: {
      name?: string;
      folder?: string;
      source?: string;
      assignmentType?: string;
      bookletSlug?: string;
      movementIndex?: number;
      field?: string;
    }
  ) => void;
}) {
  const [name, setName] = useState(item.name || "");
  const [folder, setFolder] = useState(item.folder || "valluru/pdfs");
  const [assignmentType, setAssignmentType] = useState(
    item.assignedTo?.type === "booklet" || item.assignedTo?.type === "movement"
      ? item.assignedTo.type
      : "none"
  );
  const [bookletSlug, setBookletSlug] = useState(item.assignedTo?.slug || booklets[0]?.slug || "");
  const [movementIndex, setMovementIndex] = useState(String(item.assignedTo?.index ?? 0));
  const [field, setField] = useState(item.assignedTo?.field === "samplePdf" ? "samplePdf" : "pdf");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  return (
    <article className="rounded-md border border-gold/15 bg-ink p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-gold/15 bg-surface text-gold">
          <FileText size={30} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg text-parchment">{item.name || "Untitled PDF"}</p>
          <p className="mt-1 font-label text-xs uppercase tracking-[0.18em] text-muted">
            {item.provider || "storage"} - {formatFileSize(item.fileSize || item.size)} - {item.folder || "No folder"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Assigned to: {item.assignedTo?.title || "Not assigned"}
            {item.assignedTo?.field ? ` (${item.assignedTo.field})` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.url ? (
              <>
                <a
                  className="inline-flex items-center gap-2 rounded-md border border-gold/20 px-3 py-2 text-sm text-muted transition hover:border-gold hover:text-gold"
                  href={item.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Eye size={14} />
                  Read
                </a>
                <button
                  className="rounded-md border border-gold/20 px-3 py-2 text-sm text-muted transition hover:border-gold hover:text-gold"
                  onClick={() => navigator.clipboard?.writeText(item.url || "")}
                  type="button"
                >
                  Copy URL
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField label="PDF Name" onChange={setName} value={name} />
        <TextField label="Folder" onChange={setFolder} value={folder} />
      </div>
      <button
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
        onClick={() => updatePdfAsset(item.id, { name, folder })}
        type="button"
      >
        <Save size={16} />
        Save Details
      </button>

      <div className="mt-5 rounded-md border border-gold/10 bg-surface p-4">
        <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
          Replace PDF File
        </p>
        <input
          accept="application/pdf,.pdf"
          className="mt-4 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
          onChange={(event) => setReplacementFile(event.target.files?.[0] || null)}
          type="file"
        />
        <button
          className="mt-4 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold disabled:opacity-50"
          disabled={!replacementFile}
          onClick={() => replacePdfAsset(item.id, replacementFile, folder)}
          type="button"
        >
          Replace PDF
        </button>
      </div>

      <div className="mt-5 rounded-md border border-gold/10 bg-surface p-4">
        <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
          Assign PDF
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
            Target
            <select
              className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) => setAssignmentType(event.target.value)}
              value={assignmentType}
            >
              <option value="none">No Assignment</option>
              <option value="booklet">Booklet</option>
              <option value="movement">Movement</option>
            </select>
          </label>

          {assignmentType === "booklet" ? (
            <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
              Booklet
              <select
                className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
                onChange={(event) => setBookletSlug(event.target.value)}
                value={bookletSlug}
              >
                {booklets.map((booklet) => (
                  <option key={booklet.slug} value={booklet.slug}>
                    {booklet.numberLabel}: {booklet.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {assignmentType === "booklet" ? (
            <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
              Booklet Field
              <select
                className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
                onChange={(event) => setField(event.target.value)}
                value={field}
              >
                <option value="pdf">Full PDF</option>
                <option value="samplePdf">Sample PDF</option>
              </select>
            </label>
          ) : null}

          {assignmentType === "movement" ? (
            <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted">
              Movement
              <select
                className="mt-3 w-full rounded-md border border-gold/20 bg-ink px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
                onChange={(event) => setMovementIndex(event.target.value)}
                value={movementIndex}
              >
                {movements.map((movement, index) => (
                  <option key={`${movement.title}-${index}`} value={index}>
                    Movement {index + 1}: {movement.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <button
          className="mt-4 rounded-md border border-gold/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
          onClick={() =>
            updatePdfAsset(item.id, {
              assignmentType,
              bookletSlug,
              movementIndex: Number(movementIndex),
              field
            })
          }
          type="button"
        >
          Apply Assignment
        </button>
      </div>

      <button
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-red-400/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-red-200 transition hover:border-red-300 hover:text-red-100"
        onClick={() => {
          if (window.confirm("Delete this PDF and remove any book or movement references to it?")) {
            deletePdfAsset(item.id, true);
          }
        }}
        type="button"
      >
        <Trash2 size={16} />
        Delete PDF
      </button>
    </article>
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
  replaceMediaAsset,
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
  replaceMediaAsset: (id: string | undefined, file: File | null, folder?: string) => void;
  setContent: React.Dispatch<React.SetStateAction<SiteContent>>;
  setMediaFile: (file: File | null) => void;
  setMediaFolder: (value: string) => void;
  setMediaKind: (value: string) => void;
  setMediaSearch: (value: string) => void;
  setMediaTarget: (target: MediaTarget) => void;
  uploadLibraryMedia: (file: File | null) => void;
  uploadMedia: () => void;
}) {
  const [replacementFiles, setReplacementFiles] = useState<Record<string, File | null>>({});
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
          Edit hero images, page background image, and author image. Uploads are stored in Supabase Storage and reused through MongoDB metadata.
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
                {item.kind} - {item.folder}
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
              <div className="mt-4 rounded-md border border-gold/10 bg-ink p-3">
                <label className="block text-sm text-muted">
                  Replace file
                  <input
                    className="mt-2 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
                    onChange={(event) =>
                      setReplacementFiles((current) => ({
                        ...current,
                        [item.id || item.url || ""]: event.target.files?.[0] || null
                      }))
                    }
                    type="file"
                  />
                </label>
                <button
                  className="mt-3 rounded-md border border-gold/20 px-3 py-2 text-sm text-muted transition hover:border-gold hover:text-gold disabled:opacity-50"
                  disabled={!replacementFiles[item.id || item.url || ""]}
                  onClick={() =>
                    replaceMediaAsset(
                      item.id,
                      replacementFiles[item.id || item.url || ""],
                      item.folder || mediaFolder
                    )
                  }
                  type="button"
                >
                  Replace
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
  addMovement,
  deleteMovement,
  adminToken,
  password,
  booklets,
  editBooklet,
  movements,
  updateMovement,
  uploadMovementPdf
}: {
  addBooklet: (movementIndex?: number) => void;
  addMovement: () => void;
  deleteMovement: (index: number) => void;
  adminToken: string;
  password: string;
  booklets: Booklet[];
  editBooklet: (slug: string) => void;
  movements: Movement[];
  updateMovement: (index: number, patch: Partial<Movement>) => void;
  uploadMovementPdf: (movementIndex: number, file: File, setStatus: (status: string) => void) => void;
}) {
  const [movementPdfFiles, setMovementPdfFiles] = useState<(File | null)[]>(movements.map(() => null));
  const [movementCoverFiles, setMovementCoverFiles] = useState<(File | null)[]>(movements.map(() => null));
  const [movementUploadStatuses, setMovementUploadStatuses] = useState<string[]>(movements.map(() => "Upload a PDF for this movement."));
  const [movementCoverStatuses, setMovementCoverStatuses] = useState<string[]>(movements.map(() => "Upload a cover image."));

  function adminHeaders(extra?: Record<string, string>) {
    return {
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      "X-Admin-Password": password,
      ...(extra || {})
    };
  }

  function handleMovementPdfFileChange(index: number, file: File | null) {
    setMovementPdfFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function handleMovementCoverFileChange(index: number, file: File | null) {
    setMovementCoverFiles((prev) => {
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

  function handleMovementCoverStatusChange(index: number, status: string) {
    setMovementCoverStatuses((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  }

  async function uploadMovementCoverImage(index: number, file: File) {
    handleMovementCoverStatusChange(index, "Uploading cover image...");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const headers = adminHeaders({});
      delete (headers as any)["Content-Type"];

      const response = await fetch(apiUrl("/api/admin/upload-movement-cover"), {
        method: "POST",
        headers,
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        try {
          const error = await response.json();
          handleMovementCoverStatusChange(index, `Upload failed: ${error.error || "Unknown error"}`);
        } catch {
          handleMovementCoverStatusChange(index, `Upload failed: ${response.statusText || "Unknown error"}`);
        }
        return;
      }

      const data = await response.json();
      updateMovement(index, { coverImage: data.url });
      handleMovementCoverStatusChange(index, "✓ Image uploaded. Click Save to persist.");
      setMovementCoverFiles((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error uploading image";
      handleMovementCoverStatusChange(index, errorMessage);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <h2 className="font-display text-2xl text-parchment sm:text-3xl">
          Movements
        </h2>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={addMovement}
          type="button"
        >
          <Plus size={16} />
          Add Movement
        </button>
      </div>
      {movements.map((movement, index) => (
        <FieldGroup key={`${movement.title}-${index}`} title={`Movement ${index + 1}: ${movement.title}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Title" onChange={(value) => updateMovement(index, { title: value })} value={movement.title} />
            <select
              className="rounded-md border border-gold/20 bg-ink px-3 py-2 text-base text-parchment outline-none focus:border-gold/60"
              onChange={(event) => updateMovement(index, { status: event.target.value as PublishStatus })}
              value={movement.status || "published"}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <TextAreaField label="Description" onChange={(value) => updateMovement(index, { description: value })} value={movement.description} />
          <TextAreaField label="Page Intro" onChange={(value) => updateMovement(index, { pageIntro: value })} value={movement.pageIntro || ""} />
          <TextAreaField label="Booklet Inclusion Note" onChange={(value) => updateMovement(index, { bookletInclusionNote: value })} value={movement.bookletInclusionNote || ""} />
          <TextAreaField label="Landing Hero Line" onChange={(value) => updateMovement(index, { landingHeroLine: value })} value={movement.landingHeroLine || ""} />
          <TextAreaField label="Opening Paragraph" onChange={(value) => updateMovement(index, { openingParagraph: value })} value={movement.openingParagraph || ""} />
          <TextAreaField label="Arc Line" onChange={(value) => updateMovement(index, { arcLine: value })} value={movement.arcLine || ""} />
          <TextAreaField label="Closing Line" onChange={(value) => updateMovement(index, { closingLine: value })} value={movement.closingLine || ""} />

          <div className="rounded-md border border-gold/15 bg-ink p-5">
            <p className="font-label text-sm uppercase tracking-[0.2em] text-gold mb-4">
              Select Booklets in this Movement
            </p>
            <div className="grid gap-3">
              {booklets.map((booklet, bookletIndex) => (
                <label key={booklet.slug} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={movement.bookletIndices?.includes(bookletIndex) || false}
                    onChange={(event) => {
                      const currentIndices = movement.bookletIndices || [];
                      const newIndices = event.target.checked
                        ? Array.from(new Set([...currentIndices, bookletIndex])).sort((left, right) => left - right)
                        : currentIndices.filter(i => i !== bookletIndex).sort((left, right) => left - right);
                      updateMovement(index, { bookletIndices: newIndices });
                    }}
                    className="rounded border-gold/40 bg-surface"
                  />
                  <span className="text-parchment">{booklet.numberLabel}: {booklet.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-gold/15 bg-ink p-5">
            <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
              Cover Image
            </p>
            {movement.coverImage && (
              <div className="mt-4 overflow-hidden rounded-md border border-gold/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={movement.title}
                  className="h-40 w-full object-cover"
                  src={movement.coverImage}
                />
              </div>
            )}
            <div className="mt-4 grid gap-3">
              <input
                className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment outline-none focus:border-gold/60"
                onChange={(event) => updateMovement(index, { coverImage: event.target.value })}
                placeholder="Paste image URL or upload from device below"
                type="text"
                value={movement.coverImage || ""}
              />
            </div>
            <div className="mt-4 rounded-md border border-gold/20 bg-surface/50 p-4">
              <p className="font-label text-xs uppercase tracking-[0.2em] text-muted mb-3">
                Or upload from device
              </p>
              <input
                accept="image/*"
                className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
                onChange={(event) => handleMovementCoverFileChange(index, event.target.files?.[0] || null)}
                type="file"
              />
              <button
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
                disabled={!movementCoverFiles[index]}
                onClick={() => {
                  if (movementCoverFiles[index]) {
                    uploadMovementCoverImage(index, movementCoverFiles[index]!);
                  }
                }}
                type="button"
              >
                <ImageIcon size={16} />
                Upload Cover
              </button>
              <p className="mt-3 text-base italic text-muted">{movementCoverStatuses[index]}</p>
            </div>
          </div>

          <div className="rounded-md border border-gold/15 bg-ink p-5">
            <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
              Movement PDF
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

          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="SEO Title" onChange={(value) => updateMovement(index, { seo: { ...movement.seo, title: value } })} value={movement.seo?.title || ""} />
            <TextField label="SEO Keywords" onChange={(value) => updateMovement(index, { seo: { ...movement.seo, keywords: value } })} value={movement.seo?.keywords || ""} />
          </div>
          <TextAreaField label="SEO Description" onChange={(value) => updateMovement(index, { seo: { ...movement.seo, description: value } })} value={movement.seo?.description || ""} />

          <div className="flex justify-end gap-3 mb-4">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-500/50 px-4 py-2 font-label text-sm uppercase tracking-[0.18em] text-red-300 transition hover:border-red-500 hover:text-red-200"
              onClick={() => deleteMovement(index)}
              type="button"
            >
              <Trash2 size={14} />
              Delete Movement
            </button>
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
                .filter((booklet, bookletIndex) => isBookletInMovement(booklet, bookletIndex, movement, index))
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
  emailTestStatus,
  sendOwnerTestEmail,
  setContent
}: {
  content: SiteContent;
  emailTestStatus: string;
  sendOwnerTestEmail: () => void;
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
      <FieldGroup title="Email Notifications">
        <p className="text-base leading-7 text-muted">
          Sends a real owner-notification test using the backend Resend configuration.
        </p>
        <div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
            onClick={sendOwnerTestEmail}
            type="button"
          >
            <Mail size={16} />
            Send Owner Test Email
          </button>
          <p className="mt-3 text-base italic text-muted">{emailTestStatus}</p>
        </div>
      </FieldGroup>
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
  reorderBooklet,
  updateBooklet,
  updateBookStatus,
  bulkBookStatus,
  addBooklet,
  mediaItems,
  movements,
  pdfFile,
  setPdfFile,
  uploadPdf,
  uploadStatus,
  bookletCoverFile,
  setBookletCoverFile,
  uploadBookletCover,
  bookletCoverStatus,
  bookletBackgroundFile,
  setBookletBackgroundFile,
  uploadBookletBackground,
  bookletBackgroundStatus,
  fallbackBackgroundImage
}: {
  booklet: Booklet;
  booklets: Booklet[];
  selectedSlug: string;
  setSelectedSlug: (slug: string) => void;
  reorderBooklet: (slug: string, targetIndex: number) => void;
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
  bookletCoverFile: File | null;
  setBookletCoverFile: (file: File | null) => void;
  uploadBookletCover: () => void;
  bookletCoverStatus: string;
  bookletBackgroundFile: File | null;
  setBookletBackgroundFile: (file: File | null) => void;
  uploadBookletBackground: () => void;
  bookletBackgroundStatus: string;
  fallbackBackgroundImage: string;
}) {
  const currentBookletIndex = booklets.findIndex((item) => item.slug === booklet.slug);
  const currentMovementIndex = getBookletMovementIndex(
    booklet,
    currentBookletIndex
  );
  const faqs = booklet.faqs || [];
  const relatedBookletSlugs = new Set(booklet.relatedBookletSlugs || []);

  function updateFaq(index: number, patch: { question?: string; answer?: string }) {
    const nextFaqs = faqs.map((faq, faqIndex) =>
      faqIndex === index ? { ...faq, ...patch } : faq
    );

    updateBooklet(booklet.slug, { faqs: nextFaqs });
  }

  function addFaq() {
    updateBooklet(booklet.slug, {
      faqs: [...faqs, { question: "", answer: "" }]
    });
  }

  function removeFaq(index: number) {
    updateBooklet(booklet.slug, {
      faqs: faqs.filter((_, faqIndex) => faqIndex !== index)
    });
  }

  function toggleRelatedBooklet(slug: string) {
    const nextSlugs = new Set(relatedBookletSlugs);

    if (nextSlugs.has(slug)) {
      nextSlugs.delete(slug);
    } else {
      nextSlugs.add(slug);
    }

    updateBooklet(booklet.slug, { relatedBookletSlugs: Array.from(nextSlugs) });
  }

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

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
            Reading Order
          </p>
          <label className="block font-label text-sm uppercase tracking-[0.2em] text-muted md:w-72">
            Selected Position
            <select
              className="mt-3 w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-base normal-case tracking-normal text-parchment outline-none focus:border-gold/60"
              onChange={(event) => reorderBooklet(booklet.slug, Number(event.target.value))}
              value={Math.max(0, currentBookletIndex)}
            >
              {booklets.map((item, index) => (
                <option key={item.slug} value={index}>
                  {index + 1}. {item.numberLabel}: {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-2">
          {booklets.map((item, index) => {
            const isSelected = item.slug === booklet.slug;

            return (
              <div
                className={`flex flex-col justify-between gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center ${
                  isSelected
                    ? "border-gold/50 bg-surface"
                    : "border-gold/10 bg-surface/60"
                }`}
                key={item.slug}
              >
                <button
                  className="min-w-0 text-left"
                  onClick={() => setSelectedSlug(item.slug)}
                  type="button"
                >
                  <span className="font-label text-xs uppercase tracking-[0.18em] text-gold">
                    {index + 1}. {item.numberLabel}
                  </span>
                  <span className="mt-1 block truncate text-base text-parchment">
                    {item.title}
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    aria-label={`Move ${item.title} up`}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-gold/25 text-muted transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={index === 0}
                    onClick={() => reorderBooklet(item.slug, index - 1)}
                    title={`Move ${item.title} up`}
                    type="button"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`Move ${item.title} down`}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-gold/25 text-muted transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={index === booklets.length - 1}
                    onClick={() => reorderBooklet(item.slug, index + 1)}
                    title={`Move ${item.title} down`}
                    type="button"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
      <FieldGroup title="Website Text Package">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="Card Subtitle"
            onChange={(value) => updateBooklet(booklet.slug, { cardSubtitle: value })}
            value={booklet.cardSubtitle || ""}
          />
          <TextField
            label="Detail Page Subtitle / Secondary Line"
            onChange={(value) => updateBooklet(booklet.slug, { detailSubtitle: value })}
            value={booklet.detailSubtitle || ""}
          />
        </div>
        <TextAreaField
          label="Short Card Body"
          onChange={(value) => updateBooklet(booklet.slug, { shortCardBody: value })}
          rows={4}
          value={booklet.shortCardBody || ""}
        />
        <TextAreaField
          label="Longer Card Body / Detail Intro"
          onChange={(value) => updateBooklet(booklet.slug, { detailIntro: value })}
          rows={7}
          value={booklet.detailIntro || ""}
        />
        <TextAreaField
          label="One-Line Hook"
          onChange={(value) => updateBooklet(booklet.slug, { oneLineHook: value })}
          rows={3}
          value={booklet.oneLineHook || ""}
        />
        <TextAreaField
          label="Reader Positioning"
          onChange={(value) => updateBooklet(booklet.slug, { readerPositioning: value })}
          rows={4}
          value={booklet.readerPositioning || ""}
        />
        <TextAreaField
          label="What This Booklet Explores"
          onChange={(value) => updateBooklet(booklet.slug, { explores: value })}
          rows={7}
          value={booklet.explores || ""}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            label="Read Booklet Button Text"
            onChange={(value) => updateBooklet(booklet.slug, { readButtonText: value })}
            value={booklet.readButtonText || ""}
          />
          <TextField
            label="Optional Download Button Text"
            onChange={(value) => updateBooklet(booklet.slug, { downloadButtonText: value })}
            value={booklet.downloadButtonText || ""}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Book FAQs">
        {faqs.length ? (
          <div className="grid gap-4">
            {faqs.map((faq, index) => (
              <div
                className="rounded-md border border-gold/15 bg-ink p-4"
                key={`${booklet.slug}-faq-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-label text-xs uppercase tracking-[0.22em] text-gold">
                    FAQ {index + 1}
                  </p>
                  <button
                    aria-label={`Remove FAQ ${index + 1}`}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-red-400/30 text-red-200 transition hover:border-red-300 hover:text-red-100"
                    onClick={() => removeFaq(index)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-4 grid gap-4">
                  <TextField
                    label="Question"
                    onChange={(value) => updateFaq(index, { question: value })}
                    value={faq.question}
                  />
                  <TextAreaField
                    label="Answer"
                    onChange={(value) => updateFaq(index, { answer: value })}
                    rows={4}
                    value={faq.answer}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base leading-7 text-muted">
            No custom FAQs yet. Public pages will use the default FAQ fallback until FAQs are added here.
          </p>
        )}
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={addFaq}
          type="button"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </FieldGroup>

      <FieldGroup title="Related Booklets">
        <div className="grid gap-3 md:grid-cols-2">
          {booklets
            .filter((item) => item.slug !== booklet.slug)
            .map((item) => (
              <label
                className="flex min-h-16 items-center gap-3 rounded-md border border-gold/15 bg-ink px-4 py-3 text-base text-parchment transition hover:border-gold/35"
                key={item.slug}
              >
                <input
                  checked={relatedBookletSlugs.has(item.slug)}
                  className="size-4 accent-[#c4a96b]"
                  onChange={() => toggleRelatedBooklet(item.slug)}
                  type="checkbox"
                />
                <span>
                  <span className="block font-label text-xs uppercase tracking-[0.18em] text-gold">
                    {item.numberLabel}
                  </span>
                  <span className="mt-1 block leading-6 text-parchment/88">
                    {item.title}
                  </span>
                </span>
              </label>
            ))}
        </div>
        <p className="text-sm text-muted">
          If no related booklets are selected, the detail page falls back to previous and next booklets.
        </p>
      </FieldGroup>
      <div className="grid gap-5 md:grid-cols-2">
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
      </div>

      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Cover Image
        </p>
        {booklet.coverImage && (
          <div className="mt-4 overflow-hidden rounded-md border border-gold/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={booklet.title}
              className="h-40 w-full object-cover"
              src={booklet.coverImage}
            />
          </div>
        )}
        <div className="mt-4 grid gap-3">
          <TextField
            label="Cover Image URL"
            onChange={(value) => updateBooklet(booklet.slug, { coverImage: value })}
            value={booklet.coverImage || ""}
          />
          <p className="text-xs italic text-muted">Paste image URL or upload from device below</p>
        </div>
        <div className="mt-4 rounded-md border border-gold/20 bg-surface/50 p-4">
          <p className="font-label text-xs uppercase tracking-[0.2em] text-muted mb-3">
            Or upload from device
          </p>
          <input
            accept="image/*"
            className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
            onChange={(event) => setBookletCoverFile(event.target.files?.[0] || null)}
            type="file"
          />
          <button
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!bookletCoverFile}
            onClick={uploadBookletCover}
            type="button"
          >
            <ImageIcon size={16} />
            Upload Cover
          </button>
          <p className="mt-3 text-base italic text-muted">{bookletCoverStatus}</p>
        </div>
      </div>
      <div className="rounded-md border border-gold/15 bg-ink p-5">
        <p className="font-label text-sm uppercase tracking-[0.2em] text-gold">
          Booklet Page Background
        </p>
        <p className="mt-2 text-sm text-muted">
          Each booklet can have its own background. If this is empty, the current shared page image remains in use.
        </p>
        {(booklet.backgroundImage || fallbackBackgroundImage) && (
          <div className="mt-4 overflow-hidden rounded-md border border-gold/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${booklet.title} page background`}
              className="h-48 w-full object-cover"
              src={booklet.backgroundImage || fallbackBackgroundImage}
            />
          </div>
        )}
        <div className="mt-4 grid gap-3">
          <TextField
            label="Background Image URL"
            onChange={(value) => updateBooklet(booklet.slug, { backgroundImage: value })}
            value={booklet.backgroundImage || ""}
          />
          {!booklet.backgroundImage ? (
            <p className="text-xs italic text-muted">Using the current shared page background.</p>
          ) : null}
        </div>
        <div className="mt-4 rounded-md border border-gold/20 bg-surface/50 p-4">
          <p className="mb-3 font-label text-xs uppercase tracking-[0.2em] text-muted">
            Upload background from device
          </p>
          <input
            accept="image/*"
            className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
            onChange={(event) => setBookletBackgroundFile(event.target.files?.[0] || null)}
            type="file"
          />
          <button
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!bookletBackgroundFile}
            onClick={uploadBookletBackground}
            type="button"
          >
            <ImageIcon size={16} />
            Upload Background
          </button>
          <p className="mt-3 text-base italic text-muted">{bookletBackgroundStatus}</p>
        </div>
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
          value={booklet.badge || booklet.tag || ""}
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
                          onClick={() => updateBooklet(booklet.slug, { backgroundImage: mediaUrl })}
                          type="button"
                        >
                          Use Background
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
          label="Hero Eyebrow"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, eyebrow: value } }
            }))
          }
          value={content.home.hero.eyebrow}
        />
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
        <TextField
          label="Hero Subtitle"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, subtitle: value } }
            }))
          }
          value={content.home.hero.subtitle}
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
        <TextField
          label="Primary CTA Label"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, primaryCta: { ...current.home.hero.primaryCta, label: value } } }
            }))
          }
          value={content.home.hero.primaryCta.label}
        />
        <TextField
          label="Primary CTA Href"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, primaryCta: { ...current.home.hero.primaryCta, href: value } } }
            }))
          }
          value={content.home.hero.primaryCta.href}
        />
        <TextField
          label="Secondary CTA Label"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, secondaryCta: { ...current.home.hero.secondaryCta, label: value } } }
            }))
          }
          value={content.home.hero.secondaryCta.label}
        />
        <TextField
          label="Secondary CTA Href"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, hero: { ...current.home.hero, secondaryCta: { ...current.home.hero.secondaryCta, href: value } } }
            }))
          }
          value={content.home.hero.secondaryCta.href}
        />
      </FieldGroup>

      <FieldGroup title="Home Sections">
        <TextField
          label="The Series in Six Movements - Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, seriesOverview: { ...current.home.seriesOverview, title: value } }
            }))
          }
          value={content.home.seriesOverview.title}
        />
        <TextAreaField
          label="The Series in Six Movements - Intro"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, seriesOverview: { ...current.home.seriesOverview, intro: value } }
            }))
          }
          rows={4}
          value={content.home.seriesOverview.intro}
        />
        <TextField
          label="Why This Exists - Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, why: { ...current.home.why, title: value } }
            }))
          }
          value={content.home.why.title}
        />
        <TextAreaField
          label="Why This Exists - Body"
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
        <TextField
          label="For Whom - Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, forWhom: { ...current.home.forWhom, title: value } }
            }))
          }
          value={content.home.forWhom.title}
        />
        <TextAreaField
          label="For Whom - Body"
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
        <TextField
          label="Quote Byline"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, quote: { ...current.home.quote, byline: value } }
            }))
          }
          value={content.home.quote.byline}
        />
        <TextField
          label="Newsletter Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, newsletter: { ...current.home.newsletter, title: value } }
            }))
          }
          value={content.home.newsletter.title}
        />
        <TextAreaField
          label="Newsletter Body"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, newsletter: { ...current.home.newsletter, body: value } }
            }))
          }
          value={content.home.newsletter.body}
        />
        <TextField
          label="Newsletter Microcopy"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, newsletter: { ...current.home.newsletter, microcopy: value } }
            }))
          }
          value={content.home.newsletter.microcopy}
        />
        <TextField
          label="Home Closing Line"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              home: { ...current.home, closingLine: value }
            }))
          }
          value={content.home.closingLine}
        />
      </FieldGroup>

      <FieldGroup title="Movements Page">
        <TextField
          label="Movements Page - Hero Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              movements: { ...current.movements, heroTitle: value }
            }))
          }
          value={(content.movements as any)?.heroTitle || "Explore the Six Movements"}
        />
        <TextField
          label="Movements Page - Hero Subtitle"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              movements: { ...current.movements, heroSubtitle: value }
            }))
          }
          value={(content.movements as any)?.heroSubtitle || "Six doorways into the same inward fire."}
        />
      </FieldGroup>

      <FieldGroup title="Series Page">
        <TextField
          label="Series Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, title: value }
            }))
          }
          value={content.series.title}
        />
        <TextField
          label="Series Subtitle"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, subtitle: value }
            }))
          }
          value={content.series.subtitle}
        />
        <TextAreaField
          label="Series Opening"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, opening: toParagraphs(value) }
            }))
          }
          rows={6}
          value={fromParagraphs(content.series.opening)}
        />
        <TextField
          label="Series Reading Order Note"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, readingOrderNote: value }
            }))
          }
          value={content.series.readingOrderNote}
        />
        <TextAreaField
          label="Series Closing"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              series: { ...current.series, closing: toParagraphs(value) }
            }))
          }
          rows={6}
          value={fromParagraphs(content.series.closing)}
        />
      </FieldGroup>

      <FieldGroup title="About Page">
        <TextField
          label="About Title"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, title: value }
            }))
          }
          value={content.about.title}
        />
        <TextField
          label="About Subtitle"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, subtitle: value }
            }))
          }
          value={content.about.subtitle}
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
        <TextAreaField
          label="Pull Quotes"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, pullQuotes: toParagraphs(value) }
            }))
          }
          rows={5}
          value={fromParagraphs(content.about.pullQuotes)}
        />
        <TextAreaField
          label="What This Is NOT"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, whatThisIsNot: toParagraphs(value) }
            }))
          }
          rows={5}
          value={fromParagraphs(content.about.whatThisIsNot)}
        />
        <TextField
          label="Contact Intro"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, contact: { ...current.about.contact, intro: value } }
            }))
          }
          value={content.about.contact.intro}
        />
        <TextField
          label="Contact Email"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, contact: { ...current.about.contact, email: value } }
            }))
          }
          value={content.about.contact.email}
        />
        <TextField
          label="Contact Website"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              about: { ...current.about, contact: { ...current.about.contact, website: value } }
            }))
          }
          value={content.about.contact.website}
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
        <TextField
          label="Button Href"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              nav: { ...current.nav, button: { ...current.nav.button, href: value } }
            }))
          }
          value={content.nav.button.href}
        />
        <button
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-red-400/30 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-red-200 transition hover:border-red-300 hover:text-red-100"
          onClick={() => {
            if (window.confirm("Delete the navigation button?")) {
              setContent((current) => ({
                ...current,
                nav: { ...current.nav, button: { label: "", href: "" } }
              }));
            }
          }}
          type="button"
        >
          <Trash2 size={16} />
          Delete Button
        </button>
      </FieldGroup>
      <FieldGroup title="Navigation Links">
        <p className="text-sm text-muted mb-4">Edit the main navigation menu links</p>
        {content.nav.links.map((link, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2 p-4 rounded-md border border-gold/10 bg-ink">
            <TextField
              label={`Link ${index + 1} Label`}
              onChange={(value) =>
                setContent((current) => ({
                  ...current,
                  nav: {
                    ...current.nav,
                    links: current.nav.links.map((l, i) =>
                      i === index ? { ...l, label: value } : l
                    )
                  }
                }))
              }
              value={link.label}
            />
            <TextField
              label={`Link ${index + 1} Href`}
              onChange={(value) =>
                setContent((current) => ({
                  ...current,
                  nav: {
                    ...current.nav,
                    links: current.nav.links.map((l, i) =>
                      i === index ? { ...l, href: value } : l
                    )
                  }
                }))
              }
              value={link.href}
            />
          </div>
        ))}
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
          label="Footer Website"
          onChange={(value) =>
            setContent((current) => ({
              ...current,
              footer: { ...current.footer, website: value }
            }))
          }
          value={content.footer.website}
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
        <p className="text-sm text-muted mt-4">Edit the footer menu links</p>
        {content.footer.links.map((link, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2 p-4 rounded-md border border-gold/10 bg-ink">
            <TextField
              label={`Footer Link ${index + 1} Label`}
              onChange={(value) =>
                setContent((current) => ({
                  ...current,
                  footer: {
                    ...current.footer,
                    links: current.footer.links.map((l, i) =>
                      i === index ? { ...l, label: value } : l
                    )
                  }
                }))
              }
              value={link.label}
            />
            <TextField
              label={`Footer Link ${index + 1} Href`}
              onChange={(value) =>
                setContent((current) => ({
                  ...current,
                  footer: {
                    ...current.footer,
                    links: current.footer.links.map((l, i) =>
                      i === index ? { ...l, href: value } : l
                    )
                  }
                }))
              }
              value={link.href}
            />
          </div>
        ))}
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
