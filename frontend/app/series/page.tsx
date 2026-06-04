import { NewsletterForm } from "@/components/newsletter-form";
import { BookletCard, PageHeader, PageShell, ProseBlocks, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  const content = await getSiteContent();
  const { series, home } = content;
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
        <div className="mx-auto max-w-4xl">
          {series.booklets.map((booklet) => (
            <BookletCard booklet={booklet} key={booklet.slug} />
          ))}
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
