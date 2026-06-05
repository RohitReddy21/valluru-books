import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import { BookletCard, PageHeader, PageShell, ProseBlocks, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, getBookletMovementIndex, isPublished } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  const content = await getSiteContent();
  const { series, home } = content;
  const publishedBooklets = series.booklets.filter((booklet) =>
    isPublished(booklet.status)
  );
  const groupedBooklets = home.seriesOverview.movements.map((movement, movementIndex) => ({
    movement,
    booklets: publishedBooklets.filter((booklet) => {
      const sourceIndex = series.booklets.findIndex((item) => item.slug === booklet.slug);

      return getBookletMovementIndex(booklet, sourceIndex) === movementIndex;
    })
  }));
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={series.title}
        subtitle={series.subtitle}
      />
      <Section className="pt-0">
        <ProseBlocks blocks={series.opening} />
        <p className="mt-8 border-l border-gold/40 pl-5 text-lg italic leading-8 text-muted">
          {series.readingOrderNote}
        </p>
      </Section>
      <WideSection>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="responsive-section-title mb-7 font-display font-semibold text-parchment">
            The Series in Five Movements
          </h2>
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {home.seriesOverview.movements.map((movement, index) => (
            <Link
              className="group block rounded-md border border-gold/15 bg-surface/72 p-5 transition hover:border-gold/40"
              href={`#movement-${index + 1}`}
              key={movement.title}
            >
              <p className="font-label text-xs uppercase tracking-[0.23em] text-gold/80">
                Booklets {movement.booklets}
              </p>
              <h3 className="mt-4 font-display text-xl leading-tight text-parchment group-hover:text-gold sm:text-2xl">
                {movement.title}
              </h3>
              <p className="mt-4 text-lg leading-7 text-muted">
                {movement.description}
              </p>
              <span className="mt-6 inline-flex font-label text-xs uppercase tracking-[0.2em] text-gold">
                View Books
              </span>
            </Link>
          ))}
        </div>
      </WideSection>
      <WideSection>
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h2 className="responsive-section-title font-display font-semibold text-parchment">
              The Inward Fire Series
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Explore every single booklet in the reading order.
            </p>
          </div>
          <div className="grid gap-12">
            {groupedBooklets.map(({ movement, booklets }, movementIndex) => (
              <section className="scroll-mt-28" id={`movement-${movementIndex + 1}`} key={movement.title}>
                <div className="border-b border-gold/15 pb-5">
                  <p className="font-label text-xs uppercase tracking-[0.24em] text-gold">
                    Booklets {movement.booklets}
                  </p>
                  <h3 className="mt-3 font-display text-3xl text-parchment">
                    {movement.title}
                  </h3>
                  <p className="mt-3 text-lg leading-7 text-muted">
                    {movement.description}
                  </p>
                </div>
                {booklets.length > 0 ? (
                  booklets.map((booklet) => (
                    <BookletCard booklet={booklet} key={booklet.slug} />
                  ))
                ) : (
                  <p className="py-8 text-lg italic text-muted">
                    No published books in this movement yet.
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </WideSection>
      <Section>
        <ProseBlocks blocks={series.closing} />
        <div className="mt-12">
          <h2 className="font-display text-3xl text-parchment">
            {home.newsletter.title}
          </h2>
          <p className="mt-4 text-xl leading-9 text-parchment/86">
            {home.newsletter.body}
          </p>
          <NewsletterForm microcopy={home.newsletter.microcopy} />
        </div>
      </Section>
    </PageShell>
  );
}
