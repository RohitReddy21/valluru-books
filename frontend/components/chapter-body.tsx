import Image from "next/image";
import {
  TABLE_CELL_SEPARATOR,
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
 * on the booklet page, the booklet's own paper in the reader — so both come from whichever
 * surface it sits in. See `.reading-surface` in app/globals.css.
 */
export type ReadableChapter = {
  id: string;
  number: number;
  title: string;
  paragraphs: string[];
  frontMatter?: boolean;
  images?: BookletChapterImage[];
};

/** Words the booklets use to open a section, which read better as a kicker than as a title. */
const KICKER_WORDS =
  /^(opening|prologue|introduction|epilogue|afterword|conclusion)\s*[:.\-–—]\s*(.+)$/i;
/** "CHAPTER 1 The Project-Engine of Happiness": the PDF's kicker, run into the title with only a space. */
const NUMBERED_KICKER = /^(chapter|movement|part|stanza|canto)\s+(\d{1,2}[A-Z]?)\s*[:.\-–—]?\s+(.+)$/i;
const NUMBERED = /^(\d{1,2}[A-Z]?)\.\s+(.+)$/;

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * The booklets set a small gold line above a chapter title — "OPENING" over "Between the
 * Cry and the Chore" — and the extracted titles carry it inline. Splitting it out gives the
 * page the printed hierarchy; a title with nothing to split keeps no kicker at all.
 */
export function splitChapterTitle(title: string): { kicker: string | null; title: string } {
  const clean = title.replace(/\s+/g, " ").trim();

  const worded = clean.match(KICKER_WORDS);
  if (worded) {
    return { kicker: capitalise(worded[1]), title: worded[2].trim() };
  }

  const spaced = clean.match(NUMBERED_KICKER);
  if (spaced) {
    return { kicker: `${capitalise(spaced[1])} ${spaced[2]}`, title: spaced[3].trim() };
  }

  const numbered = clean.match(NUMBERED);
  if (numbered) {
    return { kicker: `Chapter ${numbered[1]}`, title: numbered[2].trim() };
  }

  return { kicker: null, title: clean };
}

function ChapterBlocks({ blocks, chapterId }: { blocks: ChapterBlock[]; chapterId: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${chapterId}-${index}`;

        // The booklets print MEANING, భావము and AUTHOR'S CONTEXT as their own gold line
        // above the passage they introduce.
        if (block.kind === "label") {
          return (
            <p className="rd-label" key={key}>
              {block.lines[0]}
            </p>
          );
        }

        // A table the PDF printed, kept as one: the columns are the point of it.
        if (block.kind === "table") {
          const [head, ...body] = block.lines.map((row) => row.split(TABLE_CELL_SEPARATOR));

          return (
            <div className="rd-table-wrap" key={key}>
              <table className="rd-table">
                <thead>
                  <tr>
                    {head.map((cell, cellIndex) => (
                      <th key={`${key}-h${cellIndex}`} scope="col">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={`${key}-r${rowIndex}`}>
                      {row.map((cell, cellIndex) =>
                        cellIndex === 0 ? (
                          <th key={`${key}-r${rowIndex}c${cellIndex}`} scope="row">
                            {cell}
                          </th>
                        ) : (
                          <td key={`${key}-r${rowIndex}c${cellIndex}`}>{cell}</td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.kind === "verse") {
          return (
            <p className="rd-p rd-verse" key={key}>
              {block.lines.map((line, lineIndex) => (
                <span className="block" key={`${key}-${lineIndex}`}>
                  {line}
                </span>
              ))}
            </p>
          );
        }

        return (
          <p className="rd-p" key={key}>
            {block.lines[0]}
          </p>
        );
      })}
    </>
  );
}

export function ChapterArticle({
  chapter,
  hidden = false
}: {
  chapter: ReadableChapter;
  /** The cover and title page, which the reader draws itself; see isTitlePageChapter. */
  hidden?: boolean;
}) {
  const { kicker, title } = splitChapterTitle(chapter.title);
  const isCover = hidden;

  return (
    <article className="rd-chapter" data-cover={isCover ? "true" : undefined} id={chapter.id}>
      {kicker ? <p className="rd-kicker">{kicker}</p> : null}
      <h2 className="rd-title">{title}</h2>
      {/*
        The plate opens the chapter, because that is where it sits in the booklet: on its
        own page facing the chapter it was drawn to introduce.
      */}
      {chapter.images?.map((image) => (
        <figure className="plate mt-6" key={image.src}>
          {/*
            The ratio is set up front, not left to the file. A lazy image that has not
            loaded has no size, so the page reflowed as each plate arrived and a booklet
            grew from seventeen pages to sixty-eight while it was being read.
          */}
          <Image
            alt=""
            className="rounded-sm"
            height={image.height}
            sizes="(min-width: 1024px) 34rem, 100vw"
            src={image.src}
            style={{ "--plate-ratio": image.width / image.height } as React.CSSProperties}
            width={image.width}
          />
        </figure>
      ))}

      <ChapterBlocks blocks={toChapterBlocks(chapter.paragraphs)} chapterId={chapter.id} />
    </article>
  );
}
