import Image from "next/image";
import {
  toChapterBlocks,
  type BookletChapterImage,
  type ChapterBlock
} from "@/lib/site-content";

/**
 * One chapter, set as the booklet sets it.
 *
 * Shared by the free chapters in the page HTML and the gated chapters the gate fetches
 * once a subscriber is recognised, so unlocking a booklet gives the same page rather than
 * a plainer one.
 *
 * Nothing here names a colour or a face. The same markup is shown on two surfaces — dark
 * on the booklet page, cream paper in the reader — so both come from whichever surface it
 * sits in. See `.reading-surface` in app/globals.css.
 */
export type ReadableChapter = {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
  images?: BookletChapterImage[];
};

function ChapterBlocks({ blocks, chapterId }: { blocks: ChapterBlock[]; chapterId: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${chapterId}-${index}`;

        // The booklets print MEANING, భావము and AUTHOR'S CONTEXT as their own gold line
        // above the passage they introduce.
        if (block.kind === "label") {
          return (
            <p
              className="mt-8 text-[0.78em] font-semibold uppercase tracking-[0.3em] text-[color:var(--reading-label)]"
              key={key}
            >
              {block.lines[0]}
            </p>
          );
        }

        return (
          <p className="mt-5 text-[color:var(--reading-ink)]" key={key}>
            {block.kind === "verse"
              ? block.lines.map((line, lineIndex) => (
                  <span className="block" key={`${key}-${lineIndex}`}>
                    {line}
                  </span>
                ))
              : block.lines[0]}
          </p>
        );
      })}
    </>
  );
}

export function ChapterArticle({ chapter }: { chapter: ReadableChapter }) {
  return (
    <article className="mt-14 first:mt-0" id={chapter.id}>
      {/*
        A chapter opening is set at 24pt against 10.5pt of body in the booklets — 2.29
        times the body, which is what the em here keeps.
      */}
      <h2 className="font-[family-name:var(--reading-display)] text-[2.29em] leading-tight text-[color:var(--reading-head)]">
        <span className="mr-3 text-[0.55em] uppercase tracking-[0.18em] text-[color:var(--reading-label)]">
          {chapter.number}
        </span>
        {chapter.title}
      </h2>
      {/*
        The plate opens the chapter, because that is where it sits in the booklet: on its
        own page facing the chapter it was drawn to introduce.
      */}
      {chapter.images?.map((image) => (
        <figure className="mt-6" key={image.src}>
          <Image
            alt=""
            className="h-auto w-full rounded-sm"
            height={image.height}
            sizes="(min-width: 1024px) 34rem, 100vw"
            src={image.src}
            width={image.width}
          />
        </figure>
      ))}

      <ChapterBlocks blocks={toChapterBlocks(chapter.paragraphs)} chapterId={chapter.id} />
    </article>
  );
}
