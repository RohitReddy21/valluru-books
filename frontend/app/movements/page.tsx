import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import { BookletCard, PageHeader, PageShell, ProseBlocks, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, getBookletMovementIndex, isPublished } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
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
        title="Movements in The Inward Fire Series"
        subtitle="Five doorways into the same inward fire."
      />
      <WideSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>
        <div className="mt-12 grid gap-8">
          {groupedBooklets.map((group, index) => (
            <section key={group.movement.title} className="rounded-md border border-gold/15 bg-surface/50 p-8">
              <Link href={`/movements/${group.movement.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <h2 className="responsive-section-title mb-2 font-display font-semibold text-parchment hover:text-gold transition">
                  {group.movement.title}
                </h2>
              </Link>
              <p className="text-sm text-muted mb-6">Booklets {group.movement.booklets}</p>
              <p className="responsive-prose text-parchment/86 mb-8">
                {group.movement.description}
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                {group.booklets.map((booklet) => (
                  <BookletCard key={booklet.slug} booklet={booklet} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </WideSection>

      <Section>
        <NewsletterForm />
      </Section>
    </PageShell>
  );
}
