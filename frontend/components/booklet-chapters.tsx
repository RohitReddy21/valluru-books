import { Download } from "lucide-react";
import { ChapterGate } from "@/components/chapter-gate";
import { ChapterArticle } from "@/components/chapter-body";
import { ChapterReader } from "@/components/chapter-reader";
import { apiUrl } from "@/lib/api";
import { getBookletDownloadButtonText, isChapterFree, type Booklet } from "@/lib/site-content";

/**
 * The booklet's one reading surface.
 *
 * The free chapters are plain server HTML — this is the whole point of the chapter
 * migration: indexable, no JavaScript needed, a fraction of the canvas-rendered PDF it
 * replaces. The gated chapters are never in this markup; the gate fetches them per-reader
 * once the API says the reader is allowed them.
 *
 * The gate is rendered inside the reader, after the third free chapter, so a reader meets
 * it by reading on rather than by being sent to a panel elsewhere on the page.
 */
export function BookletChapters({ booklet }: { booklet: Booklet }) {
  const chapters = booklet.chapters ?? [];
  const free = chapters.filter((chapter) => isChapterFree(chapter) && chapter.paragraphs.length);
  const gated = chapters.filter((chapter) => !isChapterFree(chapter));
  const nextChapter = gated[0];

  if (!free.length) {
    return null;
  }

  const downloadLabel = getBookletDownloadButtonText(booklet);

  return (
    <section className="mt-12 border-t border-gold/15 pt-8">
      <ChapterReader
        numberLabel={booklet.numberLabel}
        // The admin's unlock report used to be fed by the PDF modal's button, which is no
        // longer how a booklet is opened. Reported from inside the reader so this file
        // stays a server component and the chapters are not serialised to the client on
        // top of being rendered into the HTML.
        reports={{ slug: booklet.slug, title: booklet.title }}
        secondaryAction={
          booklet.pdf && downloadLabel ? (
            <a
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gold/30 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted transition hover:border-gold hover:text-gold"
              href={apiUrl(`/api/booklets/${booklet.slug}/pdf`)}
              rel="noreferrer"
              target="_blank"
            >
              <Download size={17} />
              {downloadLabel}
            </a>
          ) : null
        }
        title={booklet.title}
      >
        {free.map((chapter) => (
          <ChapterArticle chapter={chapter} key={chapter.id} />
        ))}

        {nextChapter ? (
          <ChapterGate
            bookletSlug={booklet.slug}
            nextChapter={{
              number: nextChapter.number,
              title: nextChapter.title,
              teaser: nextChapter.teaser ?? ""
            }}
            remainingCount={gated.length}
          />
        ) : null}
      </ChapterReader>
    </section>
  );
}
