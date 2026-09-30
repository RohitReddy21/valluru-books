import { ChapterGate } from "@/components/chapter-gate";
import { ChapterArticle } from "@/components/chapter-body";
import { ChapterReader } from "@/components/chapter-reader";
import { chapterLabels, isChapterFree, isTitlePageChapter, type Booklet } from "@/lib/site-content";

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
export function BookletChapters({
  booklet,
  seriesLabel = "The Inward Fire Series"
}: {
  booklet: Booklet;
  /** Printed on the cover, the title page and the running foot. */
  seriesLabel?: string;
}) {
  const chapters = booklet.chapters ?? [];
  const free = chapters.filter((chapter) => isChapterFree(chapter) && chapter.paragraphs.length);
  const gated = chapters.filter((chapter) => !isChapterFree(chapter));
  const nextChapter = gated[0];
  // "N more chapters" counts what the booklet numbers as chapters, so it reads as the
  // total less the free three. The Epilogue and a "3. Notes" beside its chapter are parts
  // of the book, not further chapters; a booklet with no numbered titles counts them all.
  const allLabels = chapterLabels(chapters);
  const labels = new Map(chapters.map((chapter, index) => [chapter.id, allLabels[index]]));
  const numberedRemaining = new Set(
    gated.map((chapter) => labels.get(chapter.id)).filter((label) => label !== null && label !== undefined)
  ).size;
  const remainingCount = numberedRemaining || gated.length;

  if (!free.length) {
    return null;
  }


  return (
    <section className="mt-12 border-t border-gold/15 pt-8">
      <ChapterReader
        contents={chapters.map((chapter) => ({
          id: chapter.id,
          number: chapter.number,
          title: chapter.title,
          free: isChapterFree(chapter),
          hidden: isTitlePageChapter(chapter, booklet.title)
        }))}
        // The cover's art is the plate the extraction found on the booklet's first page;
        // the uploaded cover image is the fallback for a booklet without one.
        coverSrc={chapters[0]?.images?.[0]?.src || booklet.coverImage || undefined}
        numberLabel={booklet.numberLabel}
        seriesLabel={seriesLabel}
        subtitle={booklet.subtitle || undefined}
        theme={booklet.reader}
        // The admin's unlock report used to be fed by the PDF modal's button, which is no
        // longer how a booklet is opened. Reported from inside the reader so this file
        // stays a server component and the chapters are not serialised to the client on
        // top of being rendered into the HTML.
        reports={{ slug: booklet.slug, title: booklet.title }}
        slug={booklet.slug}
        title={booklet.title}
      >
        {free.map((chapter) => (
          <ChapterArticle
            chapter={chapter}
            hidden={isTitlePageChapter(chapter, booklet.title)}
            key={chapter.id}
          />
        ))}

        {nextChapter ? (
          <ChapterGate
            bookletSlug={booklet.slug}
            nextChapter={{
              number: nextChapter.number,
              title: nextChapter.title,
              teaser: nextChapter.teaser ?? ""
            }}
            remainingCount={remainingCount}
          />
        ) : null}
      </ChapterReader>
    </section>
  );
}
