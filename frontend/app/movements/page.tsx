import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHeader, PageShell, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent } from "@/lib/site-content";

function slugifyMovement(title: string) {
  return title.toLowerCase().replace(/\s+/g, "-");
}

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
        <div className="mt-12 grid gap-8">
          {movements.map((movement) => (
            <section key={movement.title} className="rounded-md border border-gold/15 bg-surface/50 p-8">
              <Link href={`/movements/${slugifyMovement(movement.title)}`}>
                <h2 className="responsive-section-title mb-2 font-display font-semibold text-parchment hover:text-gold transition">
                  {movement.title}
                </h2>
              </Link>
              <p className="responsive-prose text-parchment/86">
                {movement.description}
              </p>
            </section>
          ))}
        </div>
      </WideSection>

      <Section>
        <NewsletterForm microcopy={home.newsletter.microcopy} />
      </Section>
    </PageShell>
  );
}
