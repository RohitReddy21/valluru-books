"use client";

import { useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface ImageData {
  id: string;
  title: string;
  movement: number;
  booklet?: number;
  imageType: string;
  originalImage: string;
  crops: {
    square?: string;
    portrait?: string;
    mobile?: string;
    hero?: string;
  };
  createdAt: string;
}

const MOVEMENTS = [
  "1: Dharma / Silence",
  "2: Māyā / Witness",
  "3: Grief / Fire / Nāda",
  "4: Language / Surrender",
  "5: Love / Kali / Anchor"
];

const BOOKLETS = {
  "1": ["Booklet 1", "Booklet 2", "Booklet 3"],
  "2": ["Booklet 4", "Booklet 5"],
  "3": ["Booklet 6", "Booklet 7"],
  "4": ["Booklet 8", "Booklet 12"],
  "5": ["Booklet 9", "Booklet 10", "Booklet 11"]
};

export function ImageManagerPanel() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedMovement, setSelectedMovement] = useState("1");
  const [selectedBooklet, setSelectedBooklet] = useState("");
  const [imageType, setImageType] = useState("cover");
  const [title, setTitle] = useState("");
  const [uploadStatus, setUploadStatus] = useState("Ready to upload");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!uploadFile || !selectedMovement) {
      setUploadStatus("Please select a movement and image file.");
      return;
    }

    setLoading(true);
    setUploadStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);
      formData.append("movement", selectedMovement);
      if (selectedBooklet) formData.append("booklet", selectedBooklet);
      formData.append("imageType", imageType);
      formData.append("title", title || uploadFile.name);

      const response = await fetch(apiUrl("/api/admin/images/upload"), {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
          "X-Admin-Password": localStorage.getItem("adminPassword") || ""
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        setUploadStatus(`Upload failed: ${error.error}`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setUploadStatus(`✓ Image uploaded successfully. ID: ${data.imageId}`);
      setUploadFile(null);
      setTitle("");
      setSelectedBooklet("");

      // Reload images
      loadImages();
    } catch (error) {
      setUploadStatus(`Error: ${error instanceof Error ? error.message : "Upload failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const loadImages = async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/images"), {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
          "X-Admin-Password": localStorage.getItem("adminPassword") || ""
        }
      });

      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error("Failed to load images:", error);
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="mb-6 font-display text-2xl text-parchment sm:text-3xl">
          Image Manager
        </h2>
        <p className="text-muted">Upload and manage cover images with crop support.</p>
      </div>

      {/* Upload Section */}
      <div className="rounded-md border border-gold/15 bg-ink p-6">
        <p className="mb-4 font-label text-sm uppercase tracking-[0.2em] text-gold">
          Upload Image
        </p>

        <div className="grid gap-4">
          <div>
            <label className="block font-label text-xs uppercase tracking-[0.2em] text-muted mb-2">
              Movement *
            </label>
            <select
              className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-parchment outline-none focus:border-gold/60"
              value={selectedMovement}
              onChange={(e) => {
                setSelectedMovement(e.target.value);
                setSelectedBooklet("");
              }}
            >
              {MOVEMENTS.map((m, i) => (
                <option key={i} value={i + 1}>
                  Movement {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-label text-xs uppercase tracking-[0.2em] text-muted mb-2">
              Booklet (Optional)
            </label>
            <select
              className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-parchment outline-none focus:border-gold/60"
              value={selectedBooklet}
              onChange={(e) => setSelectedBooklet(e.target.value)}
            >
              <option value="">None (Hero image)</option>
              {(BOOKLETS[selectedMovement as keyof typeof BOOKLETS] || []).map((b, i) => (
                <option key={i} value={i + 1}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-label text-xs uppercase tracking-[0.2em] text-muted mb-2">
              Image Type
            </label>
            <select
              className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-parchment outline-none focus:border-gold/60"
              value={imageType}
              onChange={(e) => setImageType(e.target.value)}
            >
              <option value="cover">Cover</option>
              <option value="hero">Hero</option>
              <option value="gallery">Gallery</option>
            </select>
          </div>

          <div>
            <label className="block font-label text-xs uppercase tracking-[0.2em] text-muted mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-parchment outline-none focus:border-gold/60"
              placeholder="Image title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-label text-xs uppercase tracking-[0.2em] text-muted mb-2">
              Image File *
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full rounded-md border border-gold/20 bg-surface px-3 py-2 text-sm text-parchment file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-parchment"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>

          <button
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-4 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold disabled:opacity-50"
            disabled={!uploadFile || loading}
            onClick={handleUpload}
          >
            <Upload size={16} />
            Upload Image
          </button>
          <p className="text-sm italic text-muted">{uploadStatus}</p>
        </div>
      </div>

      {/* Images List */}
      {images.length > 0 && (
        <div className="rounded-md border border-gold/15 bg-ink p-6">
          <p className="mb-4 font-label text-sm uppercase tracking-[0.2em] text-gold">
            Uploaded Images ({images.length})
          </p>
          <div className="grid gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="rounded-md border border-gold/10 bg-surface/50 p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="aspect-square h-20 flex-shrink-0 rounded-md overflow-hidden bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.originalImage}
                      alt={img.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label text-sm text-parchment font-semibold">
                      {img.title}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Movement {img.movement}
                      {img.booklet && ` • Booklet ${img.booklet}`}
                    </p>
                    <p className="text-xs text-muted/75 mt-1">
                      Type: {img.imageType} • ID: {img.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gold/60 mt-2">
                      Status: Awaiting crop data
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={loadImages}
        className="text-sm text-gold hover:text-parchment transition"
      >
        Reload Images
      </button>
    </div>
  );
}
