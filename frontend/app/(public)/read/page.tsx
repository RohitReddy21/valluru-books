import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell, Section } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import {
  bookletPublicSlug,
  defaultSiteContent,
  getBookletDetailIntro,
  isPublished,
  type Booklet
} from "@/lib/site-content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Start reading | The Valluru",
  description:
    "The booklet from the current reel, and every other booklet in the series. The first three chapters of each are free to read.",
  alternates: { canonical: "https://www.thevalluru.org/read" }
};

/**
 * The landing page for viewers arriving from a reel.
 *
 * Each booklet is listed under the hook line from its reel, so someone who just heard a
 * sentence in a video recognises it here instead of having to guess which title it came
 * from. The top slot follows settings.featuredBookletSlug — that field is the posting
 * schedule: point it at whichever booklet the current reel quotes.
 */
function hookLine(booklet: Booklet) {
  return (
    booklet.oneLineHook || booklet.cardSubtitle || booklet.subtitle || getBookletDetailIntro(booklet)
  );
}

export default async function ReadPage() {
  const content = await getSiteContent();
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const booklets = content.series.booklets.filter((booklet) => isPublished(booklet.status));

  const featuredSlug = content.settings?.featuredBookletSlug;
  const featured =
    booklets.find((booklet) => booklet.slug === featuredSlug) || booklets[0];
  const rest = booklets.filter((booklet) => booklet.slug !== featured?.slug);

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title="Start reading"
        subtitle="The first three chapters of every booklet are free."
      />

      {featured ? (
        <Section className="pt-0">
          <p className="font-label text-xs uppercase tracking-[0.24em] text-gold/90">
            From the current reel
          </p>
          <Link
            className="group mt-5 block rounded-md border border-gold/30 bg-surface/60 p-6 transition hover:border-gold/60 sm:p-8"
            href={`/series/${bookletPublicSlug(featured)}`}
          >
            <p className="font-label text-sm uppercase tracking-[0.18em] text-muted">
              {featured.numberLabel}
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-parchment group-hover:text-gold sm:text-4xl">
              {featured.title}
            </h2>
            <p className="mt-4 text-lg leading-8 text-parchment/82">{hookLine(featured)}</p>
            <p className="mt-5 font-label text-sm uppercase tracking-[0.18em] text-gold/90">
              Read it
            </p>
          </Link>
        </Section>
      ) : null}

      {rest.length ? (
        <Section className={featured ? "pt-0" : undefined}>
          <h2 className="font-label text-sm uppercase tracking-[0.23em] text-muted">
            Every booklet
          </h2>
          <div className="mt-6 grid gap-4">
            {rest.map((booklet) => (
              <Link
                className="group block rounded-md border border-gold/15 bg-surface/50 p-5 transition hover:border-gold/40"
                href={`/series/${bookletPublicSlug(booklet)}`}
                key={booklet.slug}
              >
                <p className="font-label text-xs uppercase tracking-[0.18em] text-muted">
                  {booklet.numberLabel}
                </p>
                <h3 className="mt-2 font-display text-xl leading-tight text-parchment group-hover:text-gold sm:text-2xl">
                  {booklet.title}
                </h3>
                <p className="mt-3 text-lg leading-8 text-parchment/78">{hookLine(booklet)}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </PageShell>
  );
}
