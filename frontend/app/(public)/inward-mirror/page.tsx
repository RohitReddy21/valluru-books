import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsletterForm } from "@/components/newsletter-form";
import { BookletCard, PageHeader, PageShell, ProseBlocks, Section, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, isPublished, seriesBasePath } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const series = content.inwardMirror;

  if (!isPublished(series.status)) {
    return { title: "Not Found — The Valluru", robots: "noindex, nofollow" };
  }

  const title = series.seo?.title || `${series.title} — The Valluru`;
  const description = series.seo?.description || series.subtitle;
  const canonical = `https://www.thevalluru.org${seriesBasePath(series)}`;

  return {
    title,
    description,
    keywords: series.seo?.keywords
      ? series.seo.keywords.split(",").map((keyword) => keyword.trim())
      : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    },
    alternates: {
      canonical
    }
  };
}

export default async function InwardMirrorPage() {
  const content = await getSiteContent();
  const { inwardMirror: series, home } = content;

  if (!isPublished(series.status)) {
    notFound();
  }

  const basePath = seriesBasePath(series);
  const publishedBooklets = series.booklets.filter((booklet) => isPublished(booklet.status));
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  const seriesSchema = {
    "@context": "https://schema.org",
    "@type": "BookSeries",
    name: series.title,
    description: series.subtitle,
    url: `https://www.thevalluru.org${basePath}`,
    author: {
      "@type": "Person",
      name: "Sasidhar Valluru"
    }
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesSchema) }}
      />
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={series.title}
        subtitle={series.subtitle}
      />
      <Section className="pt-0">
        <ProseBlocks blocks={series.opening} />
        {series.readingOrderNote ? (
          <p className="mt-8 border-l border-gold/40 pl-5 text-lg italic leading-8 text-muted">
            {series.readingOrderNote}
          </p>
        ) : null}
      </Section>
      <WideSection>
        <div className="mx-auto">
          <div className="mb-6 text-center">
            <h2 className="responsive-section-title font-display font-semibold text-parchment">
              {series.bookletsHeading}
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted">{series.bookletsIntro}</p>
          </div>
          {publishedBooklets.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {publishedBooklets.map((booklet) => (
                <BookletCard basePath={basePath} booklet={booklet} key={booklet.slug} />
              ))}
            </div>
          ) : (
            <p className="text-center text-lg italic leading-8 text-muted">
              The booklets in this series are still being prepared.
            </p>
          )}
        </div>
      </WideSection>
      <Section>
        <ProseBlocks blocks={series.closing} />
        <div className="mt-12">
          <h2 className="font-display text-3xl text-parchment">{home.newsletter.title}</h2>
          <p className="mt-4 text-xl leading-9 text-parchment/86">{home.newsletter.body}</p>
          <NewsletterForm microcopy={home.newsletter.microcopy} />
        </div>
      </Section>
    </PageShell>
  );
}
