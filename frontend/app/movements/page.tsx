import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHeader, PageShell, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, movementSlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const content = await getSiteContent();
  const { home } = content;
  const movements = home.seriesOverview.movements;
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
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {movements.map((movement, index) => (
            <Link
              key={movementSlug(movement, index)}
              href={`/movements/${movementSlug(movement, index)}`}
              className="group block rounded-md border border-gold/15 bg-surface/72 p-4 transition hover:border-gold/40"
            >
              <h3 className="font-display text-lg leading-tight text-parchment group-hover:text-gold">
                {movement.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                {movement.description}
              </p>
              <span className="mt-4 inline-flex font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                View Details
              </span>
            </Link>
          ))}
        </div>
      </WideSection>

      <Section>
        <NewsletterForm microcopy={home.newsletter.microcopy} />
      </Section>
    </PageShell>
  );
}
