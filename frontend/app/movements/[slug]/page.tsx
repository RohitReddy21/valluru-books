"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { BackLink, BookletCard, PageHeader, PageShell, Section, WideSection } from "@/components/ui";
import { PdfBookModal } from "@/components/pdf-book-modal";
import { defaultSiteContent, getBookletMovementIndex, isPublished } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";
import { apiUrl } from "@/lib/api";

function slugifyMovement(title: string) {
  return title.toLowerCase().replace(/\s+/g, "-");
}

export default function MovementDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = React.use(params);
  const content = React.use(getSiteContent());
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const [readerOpen, setReaderOpen] = useState(false);
  
  const movementIndex = content.home.seriesOverview.movements.findIndex(
    (m) => slugifyMovement(m.title) === slug
  );

  if (movementIndex === -1) {
    notFound();
  }

  const movement = content.home.seriesOverview.movements[movementIndex];
  const publishedBooklets = content.series.booklets.filter((item) =>
    isPublished(item.status)
  );
  
  const movementBooklets = publishedBooklets.filter((booklet) => {
    const sourceIndex = content.series.booklets.findIndex((item) => item.slug === booklet.slug);
    return getBookletMovementIndex(booklet, sourceIndex) === movementIndex;
  });

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={movement.title}
        subtitle={movement.description}
      />
      
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-lg italic leading-8 text-muted">
            Booklets {movement.booklets}
          </p>
          <div className="mt-8">
            <BackLink href="/movements" label="Back to all Movements" />
          </div>
          
          {movement.pdf ? (
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
          ) : null}
        </div>
      </Section>

      <WideSection>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {movementBooklets.map((booklet) => (
            <BookletCard key={booklet.slug} booklet={booklet} />
          ))}
        </div>
      </WideSection>

      {readerOpen && movement.pdf ? (
        <PdfBookModal
          accessToken=""
          numberLabel={movement.booklets}
          onClose={() => setReaderOpen(false)}
          open={readerOpen}
          pdfUrl={apiUrl(`/api/movements/${movementIndex}/pdf`)}
          title={movement.title}
        />
      ) : null}
    </PageShell>
  );
}
