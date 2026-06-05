"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { PdfBookModal } from "@/components/pdf-book-modal";
import { apiUrl } from "@/lib/api";
import type { Movement } from "@/lib/site-content";

type Props = {
  movement: Movement;
  movementIndex: number;
};

export function MovementPdfReader({ movement, movementIndex }: Props) {
  const [readerOpen, setReaderOpen] = useState(false);

  if (!movement.pdf) {
    return null;
  }

  return (
    <>
      <div className="mt-12 rounded-md border border-gold/15 bg-surface/70 p-6 sm:p-8">
        <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
          Movement Reader
        </p>
        <h2 className="mt-2 font-display text-2xl text-parchment sm:text-3xl">
          {movement.title}
        </h2>
        <p className="mt-4 text-lg leading-7 text-parchment/82">
          Open the movement PDF in an on-page reading window.
        </p>
        <button
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
          onClick={() => setReaderOpen(true)}
          type="button"
        >
          <BookOpen size={17} />
          Read Movement PDF
        </button>
      </div>

      {readerOpen ? (
        <PdfBookModal
          accessToken=""
          numberLabel={movement.booklets}
          onClose={() => setReaderOpen(false)}
          open={readerOpen}
          pdfUrl={apiUrl(`/api/movements/${movementIndex}/pdf`)}
          title={movement.title}
        />
      ) : null}
    </>
  );
}
