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
        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {home.seriesOverview.movements.map((movement) => (
            <Link
              className="group block rounded-md border border-gold/15 bg-surface/72 p-4 transition hover:border-gold/40"
              href="/movements"
              key={movement.title}
            >
              <h3 className="font-display text-lg leading-tight text-parchment group-hover:text-gold">
                {movement.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                {movement.description}
              </p>
              <span className="mt-4 inline-flex font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                Explore
              </span>
            </Link>
          ))}
        </div>
      </WideSection>
      <WideSection>
        <div className="mx-auto">
          <div className="mb-6 text-center">
            <h2 className="responsive-section-title font-display font-semibold text-parchment">
              The Inward Fire Series Booklets
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">
              Explore every single booklet in the reading order.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {publishedBooklets.map((booklet) => (
              <BookletCard booklet={booklet} key={booklet.slug} />
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
