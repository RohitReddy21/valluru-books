import { ChapterGate } from "@/components/chapter-gate";
import { ChapterArticle } from "@/components/chapter-body";
import { ChapterReader } from "@/components/chapter-reader";
import { isChapterFree, type Booklet } from "@/lib/site-content";

/**
 * Renders the free chapters as plain server HTML — this is the whole point of the chapter
 * migration: it is indexable, it needs no JavaScript, and it costs a fraction of the
 * canvas-rendered PDF it replaces. The gated chapters are never in this markup; the gate
 * below fetches them per-reader once the API says the reader is allowed them.
 */
export function BookletChapters({ booklet }: { booklet: Booklet }) {
  const chapters = booklet.chapters ?? [];

  if (!chapters.length) {
    return null;
  }

  const free = chapters.filter((chapter) => isChapterFree(chapter) && chapter.paragraphs.length);
  const gated = chapters.filter((chapter) => !isChapterFree(chapter));
  const nextChapter = gated[0];

  if (!free.length) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-gold/15 pt-8">
      <ChapterReader numberLabel={booklet.numberLabel} title={booklet.title}>
        {free.map((chapter) => (
          <ChapterArticle chapter={chapter} key={chapter.id} />
        ))}
      </ChapterReader>

      {nextChapter ? (
        <ChapterGate
          bookletNumberLabel={booklet.numberLabel}
          bookletSlug={booklet.slug}
          bookletTitle={booklet.title}
          nextChapter={{
            number: nextChapter.number,
            title: nextChapter.title,
            teaser: nextChapter.teaser ?? ""
          }}
          remainingCount={gated.length}
        />
      ) : null}
    </section>
  );
}
