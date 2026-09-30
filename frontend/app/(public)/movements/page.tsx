import type { Metadata } from "next";
import { BreadcrumbSchema } from "@/components/breadcrumb";
import { NewsletterForm } from "@/components/newsletter-form";
import { PageHeader, PageShell, Section, MovementCard } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, movementSlug } from "@/lib/site-content";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Movements | The Valluru",
  description:
    "Explore the movements of The Inward Fire Series: doorways into dharma, maya, nada, language, surrender, memory, and the inward journey.",
  alternates: { canonical: "https://www.thevalluru.org/movements" },
  openGraph: {
    title: "Movements | The Valluru",
    url: "https://www.thevalluru.org/movements",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Movements | The Valluru" }]
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] }
};

export default async function MovementsPage() {
  const content = await getSiteContent();
  const { home } = content;
  const allMovements = home.seriesOverview.movements;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  return (
    <PageShell>
      <BreadcrumbSchema crumbs={[{ label: "Home", href: "/" }, { label: "Movements", href: "/movements" }]} />
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title="Movements"
        subtitle={content.movements.heroSubtitle || "Doorways into the same inward fire."}
      />

      <section className="quiet-divider px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="responsive-section-title mb-6 font-display font-semibold text-parchment">
              {content.movements.heroTitle || home.seriesOverview.title}
            </h2>
            <p className="responsive-prose text-parchment/86">
              {home.seriesOverview.intro}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allMovements.map((movement, index) => (
            <MovementCard key={movementSlug(movement, index)} movement={movement} index={index} />
          ))}
          </div>
        </div>
      </section>

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
