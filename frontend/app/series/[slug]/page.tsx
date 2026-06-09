import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookletReader } from "@/components/booklet-reader";
import { ReflectionForm } from "@/components/reflection-form";
import { BackLink, PageShell, PrimaryLink } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { defaultSiteContent, getBookletNeighbors, isPublished } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return defaultSiteContent.series.booklets.map((booklet) => ({
    slug: booklet.slug
  }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = await getSiteContent();
  const booklet = content.series.booklets.find(
    (item) => item.slug === slug && isPublished(item.status)
  );

  if (!booklet) {
    return {
      title: "Booklet Not Found — The Valluru"
    };
  }

  const title = `${booklet.title} — The Valluru`;
  const description = booklet.seo?.description || booklet.description || "A booklet from The Inward Fire Series";
  const ogImage = booklet.coverImage || "https://www.thevalluru.org/og/default.jpg";

  return {
    title,
    description,
    keywords: booklet.seo?.keywords ? booklet.seo.keywords.split(",").map(k => k.trim()) : ["dharma", "booklet"],
    openGraph: {
      type: "website",
      title,
      description,
      url: `https://www.thevalluru.org/series/${slug}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: booklet.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage]
    },
    alternates: {
      canonical: `https://www.thevalluru.org/series/${slug}`
    }
  };
}

export default async function BookletPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getSiteContent();
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const publishedBooklets = content.series.booklets.filter((item) =>
    isPublished(item.status)
  );
  const booklet = publishedBooklets.find((item) => item.slug === slug);

  if (!booklet) {
    notFound();
  }

  const neighbors = getBookletNeighbors(publishedBooklets, slug);

  // Book schema markup
  const bookSchema = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: booklet.title,
    author: {
      "@type": "Person",
      name: "Sasidhar Valluru"
    },
    bookFormat: "EBook",
    url: `https://www.thevalluru.org/series/${slug}`,
    image: booklet.coverImage || "https://www.thevalluru.org/og/default.jpg",
    description: booklet.description,
    inSeries: {
      "@type": "BookSeries",
      name: "The Inward Fire Series"
    }
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }}
      />

      <section
        className="valluru-hero-image px-4 pb-12 pt-24 sm:px-5 sm:pt-32"
        style={
          media.pageHeroImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(15, 14, 12, 0.42), rgba(15, 14, 12, 0.96)), url("${media.pageHeroImage}")`
              }
            : undefined
        }
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="max-w-3xl fade-up">
            <Breadcrumb crumbs={[
              { label: "Home", href: "/" },
              { label: "Series", href: "/series" },
              { label: booklet.title, href: `/series/${slug}` }
            ]} />

            <p className="font-label text-sm uppercase tracking-[0.24em] text-muted">
              The Series / {booklet.numberLabel}
            </p>
            <p className="mt-8 font-label text-sm uppercase tracking-[0.26em] text-gold">
              {booklet.numberLabel}
            </p>
            <h1 className="responsive-page-title mt-4 font-display font-semibold text-parchment">
              {booklet.title}
            </h1>
            <p className="mt-4 text-xl italic leading-tight text-muted sm:text-2xl">
              {booklet.subtitle}
            </p>
            {booklet.sourcesNote || booklet.authorNote || booklet.note ? (
              <p className="mt-6 text-lg italic leading-8 text-muted">
                {booklet.sourcesNote || booklet.authorNote || booklet.note}
              </p>
            ) : null}
            <p className="responsive-prose mt-8 text-parchment/88">
              {booklet.description}
            </p>
            <div className="mt-10">
              <BackLink href="/series" label="Back to the Series" />
            </div>
            <BookletReader booklet={booklet} />
          </article>

          <aside className="fade-up lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-label text-sm uppercase tracking-[0.23em] text-muted">
              Related Booklets
            </h2>
            <div className="mt-5 grid gap-4">
              {neighbors.previous ? (
                <div className="rounded-md border border-gold/15 bg-surface/70 p-5">
                  <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                    Previous
                  </p>
                  <h3 className="mt-3 font-display text-xl text-parchment">
                    {neighbors.previous.title}
                  </h3>
                  <div className="mt-4">
                    <PrimaryLink
                      cta={{
                        label: "Read",
                        href: `/series/${neighbors.previous.slug}`
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {neighbors.next ? (
                <div className="rounded-md border border-gold/15 bg-surface/70 p-5">
                  <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                    Next
                  </p>
                  <h3 className="mt-3 font-display text-xl text-parchment">
                    {neighbors.next.title}
                  </h3>
                  <div className="mt-4">
                    <PrimaryLink
                      cta={{
                        label: "Read",
                        href: `/series/${neighbors.next.slug}`
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
      <section className="quiet-divider px-4 pb-20 pt-4 sm:px-5">
        <div className="mx-auto max-w-3xl">
          <ReflectionForm bookletSlug={booklet.slug} />
        </div>
      </section>
    </PageShell>
  );
}
