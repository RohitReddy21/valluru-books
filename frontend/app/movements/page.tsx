import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHeader, PageShell, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, movementSlug, isPublished } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const content = await getSiteContent();
  const { home } = content;
  const allMovements = home.seriesOverview.movements;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title="Movements"
        subtitle="Five doorways into the same inward fire."
      />

      <WideSection>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="responsive-section-title mb-6 font-display font-semibold text-parchment">
            Explore the Five Movements
          </h2>
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allMovements.map((movement, index) => {
            const slug = movementSlug(movement, index);
            const isPublishedMovement = isPublished(movement.status);
            return (
              <div
                key={slug}
                className={`group flex flex-col overflow-hidden rounded-lg border border-gold/15 bg-surface/70 transition ${
                  isPublishedMovement
                    ? "hover:border-gold/40 hover:bg-surface/90"
                    : "opacity-80 cursor-not-allowed"
                }`}
              >
                {isPublishedMovement ? (
                  <Link href={`/movements/${slug}`} className="flex flex-col h-full">
                    {movement.coverImage && (
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface/50 border-b border-gold/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={movement.coverImage}
                          alt={movement.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-xl leading-tight text-parchment group-hover:text-gold transition">
                        {movement.title}
                      </h3>
                      {movement.description && (
                        <p className="mt-3 text-sm leading-6 text-muted line-clamp-2">
                          {movement.description}
                        </p>
                      )}
                      <span className="mt-4 inline-flex font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                        Explore Movement →
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex flex-col h-full p-5">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-xl leading-tight text-muted">
                        {movement.title}
                      </h3>
                      <span className="rounded-md border border-gold/30 px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                        Coming Soon
                      </span>
                    </div>
                    {movement.description && (
                      <p className="mt-3 text-sm leading-6 text-muted/80 line-clamp-2">
                        {movement.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </WideSection>

      <Section>
        <div>
          <h2 className="font-display text-3xl text-parchment mb-4">
            Stay Connected
          </h2>
          <p className="text-xl leading-9 text-parchment/86 mb-6">
            Subscribe to receive movement updates and reflections.
          </p>
          <NewsletterForm microcopy={home.newsletter.microcopy} />
        </div>
      </Section>
    </PageShell>
  );
}
