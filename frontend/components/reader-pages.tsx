import { Lock } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { splitChapterTitle } from "@/components/chapter-body";

/**
 * The pages a booklet has before its first chapter, drawn from how the PDFs open: a
 * full-bleed cover with a title plate, a title page, a contents page.
 *
 * They are built from what the booklet already carries — its title, subtitle and cover
 * art — rather than from the extracted "front matter" chapter, which is the cover's text
 * run together and is kept in the page for search engines only.
 */

export type ContentsEntry = {
  id: string;
  number: number;
  title: string;
  free: boolean;
  /** The cover and title page: drawn by the reader, so not listed in the contents. */
  hidden?: boolean;
};

type Identity = {
  title: string;
  subtitle?: string;
  author: string;
  seriesLabel: string;
  numberLabel?: string;
};

/** The left-hand page of the first spread: the inside of the cover, so the cover sits on the right. */
export function Endpaper() {
  return <div aria-hidden="true" className="rd-front rd-endpaper" />;
}

export function BookCover({
  title,
  subtitle,
  author,
  seriesLabel,
  numberLabel,
  src,
  titled = false,
}: Identity & { src?: string; titled?: boolean }) {
  return (
    <section aria-label="Cover" className="rd-front rd-cover">
      {src ? (
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="(min-width: 1024px) 34rem, 100vw"
          src={src}
        />
      ) : null}
      {/* A cover that already prints its title needs no second one laid over it. */}
      {titled ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <div className="rd-cover-plate">
          <p className="rd-cover-series">
            {seriesLabel}
            {numberLabel ? ` · ${numberLabel}` : ""}
          </p>
          <p className="rd-cover-title">{title}</p>
          {subtitle ? <p className="rd-cover-sub">{subtitle}</p> : null}
          <p className="rd-cover-author">{author}</p>
        </div>
      )}
    </section>
  );
}

export function TitlePage({
  title,
  subtitle,
  author,
  seriesLabel,
  numberLabel,
}: Identity) {
  return (
    <section aria-label="Title page" className="rd-front rd-titlepage">
      <div className="rd-titlepage-top">
        <p className="rd-tp-series">{seriesLabel}</p>
        {numberLabel ? <p className="rd-tp-number">{numberLabel}</p> : null}
      </div>
      <div className="rd-tp-rule" />
      <p className="rd-tp-title">{title}</p>
      {subtitle ? <p className="rd-tp-sub">{subtitle}</p> : null}
      <p className="rd-tp-author">{author}</p>
      {/* The mark is a mask filled with the booklet's accent, so it sits on any paper. */}
      <span aria-hidden="true" className="rd-tp-mark" />
    </section>
  );
}

export function ContentsPage({
  title,
  entries,
  pageOf,
  onJump,
  fit,
}: {
  /** Anything that changes the page's size or type; the list is fitted again when it does. */
  fit: unknown;
  title: string;
  entries: ContentsEntry[];
  pageOf: (id: string) => number | null;
  onJump: (id: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  // A contents page is one page, as in the PDFs. Rather than let a long list scroll inside
  // the leaf, shrink the list until it sits above the running foot.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const settle = () => {
      let scale = 1;
      el.style.setProperty("--toc-scale", "1");
      while (el.scrollHeight > el.clientHeight + 1 && scale > 0.5) {
        scale = Math.round((scale - 0.04) * 100) / 100;
        el.style.setProperty("--toc-scale", String(scale));
      }
    };

    settle();
    // Faces arrive after the first paint and change the wrapping.
    void document.fonts?.ready.then(settle);
  }, [fit, entries]);

  return (
    <section
      aria-label="Contents"
      className="rd-front rd-contents"
      ref={ref}
      data-dense={entries.length > 11 ? "true" : undefined}
    >
      <p className="rd-kicker">Contents</p>
      <h2 className="rd-title">{title}</h2>
      <ol className="rd-toc">
        {entries.map((entry) => {
          const page = pageOf(entry.id);

          return (
            <li key={entry.id}>
              <button
                className="rd-toc-row"
                onClick={() => onJump(entry.id)}
                type="button"
              >
                <span className="rd-toc-title">
                  {splitChapterTitle(entry.title).title}
                </span>
                <span className="rd-toc-page">
                  {entry.free ? (
                    (page ?? "")
                  ) : (
                    <Lock aria-label="Opens with your email" size={11} />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
