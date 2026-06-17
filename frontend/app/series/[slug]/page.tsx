import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BookletReader } from "@/components/booklet-reader";
import { ReflectionForm } from "@/components/reflection-form";
import { BackLink, BookletCard, PageShell, PrimaryLink } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { FaqAccordion } from "@/components/faq-accordion";
// import { AddToCartButton } from "@/components/add-to-cart-button";
import {
  bookletMatchesSlug,
  bookletPublicSlug,
  defaultSiteContent,
  getBookletDetailIntro,
  getBookletDetailSubtitle,
  getBookletFaqs,
  getBookletNeighbors,
  isPublished
} from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return defaultSiteContent.series.booklets.map((booklet) => ({
    slug: bookletPublicSlug(booklet)
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
    (item) => bookletMatchesSlug(item, slug) && isPublished(item.status)
  );

  if (!booklet) {
    return {
      title: "Booklet Not Found — The Valluru"
    };
  }

  const title = `${booklet.title} — The Valluru`;
  const description = booklet.seo?.description || getBookletDetailIntro(booklet) || "A booklet from The Inward Fire Series";
  const ogImage = booklet.coverImage || "https://www.thevalluru.org/og/default.jpg";
  const publicSlug = bookletPublicSlug(booklet);

  return {
    title,
    description,
    keywords: booklet.seo?.keywords ? booklet.seo.keywords.split(",").map(k => k.trim()) : ["dharma", "booklet"],
    openGraph: {
      type: "website",
      title,
      description,
      url: `https://www.thevalluru.org/series/${publicSlug}`,
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
      canonical: `https://www.thevalluru.org/series/${publicSlug}`
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
  const booklet = publishedBooklets.find((item) => bookletMatchesSlug(item, slug));

  if (!booklet) {
    notFound();
  }

  const publicSlug = bookletPublicSlug(booklet);

  if (slug !== publicSlug) {
    permanentRedirect(`/series/${publicSlug}`);
  }

  const neighbors = getBookletNeighbors(publishedBooklets, booklet.slug);
  const relatedBooklets = (booklet.relatedBookletSlugs || [])
    .map((relatedSlug) =>
      publishedBooklets.find(
        (item) => item.slug === relatedSlug || bookletPublicSlug(item) === relatedSlug
      )
    )
    .filter((item): item is typeof publishedBooklets[number] => Boolean(item))
    .filter((item) => item.slug !== booklet.slug);
  const fallbackRelatedBooklets = [
    neighbors.previous ? { label: "Previous", booklet: neighbors.previous } : null,
    neighbors.next ? { label: "Next", booklet: neighbors.next } : null
  ].filter((item): item is { label: string; booklet: typeof publishedBooklets[number] } => Boolean(item));
  const sidebarBooklets = relatedBooklets.length
    ? relatedBooklets.map((relatedBooklet) => ({
        label: relatedBooklet.numberLabel,
        booklet: relatedBooklet
      }))
    : fallbackRelatedBooklets;

  const canonicalUrl = `https://www.thevalluru.org/series/${publicSlug}`;
  const coverImage = booklet.coverImage || "https://www.thevalluru.org/og/default.jpg";
  const faqItems = getBookletFaqs(booklet);

  const bookSchema = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: booklet.title,
    headline: booklet.title,
    description: getBookletDetailIntro(booklet),
    url: canonicalUrl,
    image: coverImage,
    inLanguage: "en",
    bookFormat: "EBook",
    genre: booklet.categories?.length ? booklet.categories : ["Spiritual Literature"],
    keywords: booklet.tags?.length ? booklet.tags.join(", ") : booklet.seo?.keywords,
    isAccessibleForFree: !booklet.price || booklet.price === 0,
    author: {
      "@type": "Person",
      name: "Sasidhar Valluru"
    },
    publisher: {
      "@type": "Organization",
      name: "The Valluru",
      url: "https://www.thevalluru.org"
    },
    offers: {
      "@type": "Offer",
      price: String(booklet.price ?? 0),
      priceCurrency: booklet.currency || "INR",
      availability: "https://schema.org/InStock",
      url: canonicalUrl
    },
    mainEntityOfPage: canonicalUrl,
    inSeries: {
      "@type": "BookSeries",
      name: "The Inward Fire Series",
      url: "https://www.thevalluru.org/series"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
              { label: booklet.title, href: `/series/${publicSlug}` }
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
              {getBookletDetailSubtitle(booklet)}
            </p>
            {booklet.sourcesNote || booklet.authorNote || booklet.note ? (
              <p className="mt-6 text-lg italic leading-8 text-muted">
                {booklet.sourcesNote || booklet.authorNote || booklet.note}
              </p>
            ) : null}
            {booklet.oneLineHook ? (
              <p className="mt-8 border-l border-gold/45 pl-5 text-xl italic leading-8 text-gold sm:text-2xl">
                {booklet.oneLineHook}
              </p>
            ) : null}
            <p className="responsive-prose mt-8 text-parchment/88">
              {getBookletDetailIntro(booklet)}
            </p>
            {booklet.readerPositioning ? (
              <section className="mt-8 rounded-md border border-gold/15 bg-surface/55 p-5">
                <p className="font-label text-xs uppercase tracking-[0.24em] text-gold">
                  Reader Positioning
                </p>
                <p className="mt-3 text-lg leading-8 text-parchment/84">
                  {booklet.readerPositioning}
                </p>
              </section>
            ) : null}
            {booklet.explores ? (
              <section className="mt-6 rounded-md border border-gold/15 bg-surface/55 p-5">
                <p className="font-label text-xs uppercase tracking-[0.24em] text-gold">
                  What This Booklet Explores
                </p>
                <p className="mt-3 text-lg leading-8 text-parchment/84">
                  {booklet.explores}
                </p>
              </section>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <BackLink href="/series" label="Back to the Series" />
              {booklet.coffeeTableEdition === "unavailable" ? (
                <span className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted cursor-not-allowed">
                  COFFEE-TABLE EDITION UNAVAILABLE
                </span>
              ) : null}
              {/* Add to cart is temporarily disabled.
                <AddToCartButton />
              */}
              {/* {booklet.pdf ? (
                <a
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-parchment transition hover:border-gold hover:text-gold"
                  href={booklet.pdf}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
              ) : null} */}
            </div>
            <BookletReader booklet={booklet} />
          </article>

          <aside className="fade-up lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-label text-sm uppercase tracking-[0.23em] text-muted">
              Related Booklets
            </h2>
            <div className="mt-5 grid gap-4">
              {sidebarBooklets.map((relatedItem) => (
                <div
                  className="rounded-md border border-gold/15 bg-surface/70 p-5"
                  key={`${relatedItem.label}-${relatedItem.booklet.slug}`}
                >
                  <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                    {relatedItem.label}
                  </p>
                  <h3 className="mt-3 font-display text-xl text-parchment">
                    {relatedItem.booklet.title}
                  </h3>
                  <div className="mt-4">
                    <PrimaryLink
                      cta={{
                        label: "Read",
                        href: `/series/${bookletPublicSlug(relatedItem.booklet)}`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
      <section className="quiet-divider px-4 pb-20 pt-4 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-12">
          <section>
            <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
              FAQ
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-parchment">
              Frequently Asked Questions
            </h2>
            <FaqAccordion items={faqItems} />
          </section>
          <ReflectionForm bookletSlug={booklet.slug} />
          {relatedBooklets.length > 0 && (
            <section>
              <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
                Related Booklets
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold text-parchment">
                Continue Your Journey
              </h2>
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {relatedBooklets.map((relatedBooklet) => (
                  <BookletCard booklet={relatedBooklet} key={relatedBooklet.slug} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </PageShell>
  );
}
