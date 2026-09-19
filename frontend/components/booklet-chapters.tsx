import Image from "next/image";
import { ChapterGate } from "@/components/chapter-gate";
import { ChapterReader } from "@/components/chapter-reader";
import { isChapterFree, toChapterBlocks, type Booklet } from "@/lib/site-content";

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
        <article className="mt-10 first:mt-0" id={chapter.id} key={chapter.id}>
          <h2 className="font-display text-2xl text-parchment sm:text-3xl">
            <span className="mr-3 font-label text-sm uppercase tracking-[0.18em] text-gold/80">
              {chapter.number}
            </span>
            {chapter.title}
          </h2>
          {/*
            The plate opens the chapter, because that is where it sits in the booklet: on
            its own page facing the chapter it was drawn to introduce.
          */}
          {chapter.images?.map((image) => (
            <figure className="mt-6" key={image.src}>
              <Image
                alt=""
                className="h-auto w-full rounded-md"
                height={image.height}
                sizes="(min-width: 1024px) 48rem, 100vw"
                src={image.src}
                width={image.width}
              />
            </figure>
          ))}

          {toChapterBlocks(chapter.paragraphs).map((block, index) =>
            block.kind === "verse" ? (
              <p
                className="mt-5 text-lg leading-8 text-parchment/82"
                key={`${chapter.id}-${index}`}
              >
                {block.lines.map((line, lineIndex) => (
                  <span className="block" key={`${chapter.id}-${index}-${lineIndex}`}>
                    {line}
                  </span>
                ))}
              </p>
            ) : (
              <p
                className="mt-5 text-lg leading-8 text-parchment/82"
                key={`${chapter.id}-${index}`}
              >
                {block.lines[0]}
              </p>
            )
          )}
          </article>
        ))}
      </ChapterReader>

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
    </section>
  );
}
