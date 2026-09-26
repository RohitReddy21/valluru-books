import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BookletChapters } from "@/components/booklet-chapters";
import { BookletReader } from "@/components/booklet-reader";
import { ReflectionForm } from "@/components/reflection-form";
import { BackLink, BookletCard, HeroBackground, PageShell } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { FaqAccordion } from "@/components/faq-accordion";
import {
  bookletMatchesSlug,
  bookletPublicSlug,
  defaultSiteContent,
  getBookletDetailIntro,
  getBookletDetailSubtitle,
  getBookletFaqs,
  getBookletNeighbors,
  hasReadableChapters,
  isChapterFree,
  isPublished,
  seriesBasePath,
  toCardBooklet
} from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const revalidate = 300;

/**
 * Prebuilt, so a booklet page is a cached page that survives a sleeping backend rather
 * than one rendered on demand — which has nothing to fall back to when the API is down.
 */
export async function generateStaticParams() {
  const content = await getSiteContent();

  return content.inwardMirror.booklets
    .filter((booklet) => isPublished(booklet.status))
    .map((booklet) => ({ slug: bookletPublicSlug(booklet) }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = await getSiteContent();
  const series = content.inwardMirror;

  if (!isPublished(series.status)) {
    return { title: "Not Found — The Valluru", robots: "noindex, nofollow" };
  }

  const booklet = series.booklets.find(
    (item) => bookletMatchesSlug(item, slug) && isPublished(item.status)
  );

  if (!booklet) {
    return {
      title: "Booklet Not Found — The Valluru"
    };
  }

  const title = `${booklet.title} — The Valluru`;
  const description =
    booklet.seo?.description || getBookletDetailIntro(booklet) || `A booklet from ${series.title}`;
  const ogImage = booklet.coverImage || "https://www.thevalluru.org/og/default.jpg";
  const canonical = `https://www.thevalluru.org${seriesBasePath(series)}/${bookletPublicSlug(booklet)}`;

  return {
    title,
    description,
    keywords: booklet.seo?.keywords
      ? booklet.seo.keywords.split(",").map((keyword) => keyword.trim())
      : ["dharma", "booklet"],
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
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
      canonical
    }
  };
}

export default async function InwardMirrorBookletPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getSiteContent();
  const series = content.inwardMirror;

  if (!isPublished(series.status)) {
    notFound();
  }

  const basePath = seriesBasePath(series);
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const publishedBooklets = series.booklets.filter((item) => isPublished(item.status));
  const booklet = publishedBooklets.find((item) => bookletMatchesSlug(item, slug));

  if (!booklet) {
    notFound();
  }

  const publicSlug = bookletPublicSlug(booklet);

  if (slug !== publicSlug) {
    permanentRedirect(`${basePath}/${publicSlug}`);
  }

  const neighbors = getBookletNeighbors(publishedBooklets, booklet.slug);
  const relatedBooklets = (booklet.relatedBookletSlugs || [])
    .map((relatedSlug) =>
      publishedBooklets.find(
        (item) => item.slug === relatedSlug || bookletPublicSlug(item) === relatedSlug
      )
    )
    .filter((item): item is (typeof publishedBooklets)[number] => Boolean(item))
    .filter((item) => item.slug !== booklet.slug);
  const navigationBooklets = [
    neighbors.previous ? { label: "Previous Booklet", booklet: neighbors.previous } : null,
    neighbors.next ? { label: "Next Booklet", booklet: neighbors.next } : null
  ].filter((item): item is { label: string; booklet: (typeof publishedBooklets)[number] } =>
    Boolean(item)
  );

  const canonicalUrl = `https://www.thevalluru.org${basePath}/${publicSlug}`;
  const coverImage = booklet.coverImage || "https://www.thevalluru.org/og/default.jpg";
  const backgroundImage = booklet.backgroundImage || media.pageHeroImage;
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
    // Matches the Article schema below: the first chapters are free, the rest need sign-up.
    isAccessibleForFree: !(booklet.chapters ?? []).some((chapter) => !isChapterFree(chapter)),
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
      name: series.title,
      url: `https://www.thevalluru.org${basePath}`
    }
  };

  const chapters = booklet.chapters ?? [];
  const freeChapters = chapters.filter(
    (chapter) => isChapterFree(chapter) && chapter.paragraphs.length
  );
  const hasGatedChapters = chapters.some((chapter) => !isChapterFree(chapter));

  // Declares which part of the page is withheld, so that showing a crawler more than a
  // signed-out reader reads as a declared paywall rather than as cloaking.
  const articleSchema = freeChapters.length
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: booklet.title,
        description: getBookletDetailIntro(booklet),
        url: canonicalUrl,
        image: coverImage,
        inLanguage: "en",
        wordCount: freeChapters.reduce(
          (total, chapter) => total + chapter.paragraphs.join(" ").split(/\s+/).length,
          0
        ),
        isAccessibleForFree: !hasGatedChapters,
        ...(hasGatedChapters
          ? {
              hasPart: {
                "@type": "WebPageElement",
                isAccessibleForFree: false,
                cssSelector: ".valluru-gated"
              }
            }
          : {}),
        author: { "@type": "Person", name: "Sasidhar Valluru" },
        publisher: { "@type": "Organization", name: "The Valluru", url: "https://www.thevalluru.org" },
        mainEntityOfPage: canonicalUrl
      }
    : null;

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
      {articleSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      ) : null}

      <section className="valluru-hero-image relative isolate overflow-hidden px-4 pb-12 pt-24 sm:px-5 sm:pt-32">
        {backgroundImage ? <HeroBackground priority src={backgroundImage} /> : null}
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="max-w-3xl fade-up">
            <Breadcrumb
              crumbs={[
                { label: "Home", href: "/" },
                { label: series.title, href: basePath },
                { label: booklet.title, href: `${basePath}/${publicSlug}` }
              ]}
            />

            <p className="font-label text-sm uppercase tracking-[0.24em] text-muted">
              {series.title} / {booklet.numberLabel}
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
                <p className="mt-3 text-lg leading-8 text-parchment/84">{booklet.explores}</p>
              </section>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <BackLink href={basePath} label={`Back to ${series.title}`} />
            </div>
            {/* One way into a booklet; see the Inward Fire page for why. */}
            {hasReadableChapters(booklet) ? (
              <BookletChapters booklet={booklet} seriesLabel="The Inward Mirror Series" />
            ) : (
              <BookletReader booklet={booklet} />
            )}
          </article>

          {navigationBooklets.length > 0 ? (
            <aside className="fade-up lg:sticky lg:top-28 lg:self-start">
              <h2 className="font-label text-sm uppercase tracking-[0.23em] text-muted">
                Previous / Next
              </h2>
              <div className="mt-5 grid gap-4">
                {navigationBooklets.map((navigationItem) => (
                  <Link
                    className="block rounded-md border border-gold/15 bg-surface/70 p-5 transition hover:border-gold/45"
                    href={`${basePath}/${bookletPublicSlug(navigationItem.booklet)}`}
                    key={`${navigationItem.label}-${navigationItem.booklet.slug}`}
                  >
                    <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                      {navigationItem.label}
                    </p>
                    <h3 className="mt-3 font-display text-xl text-parchment">
                      {navigationItem.booklet.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </section>
      <section className="quiet-divider px-4 pb-12 pt-4 sm:px-5">
        <div className="mx-auto max-w-3xl space-y-12">
          <section>
            <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">FAQ</p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-parchment">
              Frequently Asked Questions
            </h2>
            <FaqAccordion items={faqItems} />
          </section>
          <ReflectionForm bookletSlug={booklet.slug} />
        </div>
      </section>
      {relatedBooklets.length > 0 && (
        <section className="quiet-divider px-4 pb-20 pt-12 sm:px-5">
          <div className="mx-auto max-w-6xl">
            <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
              Related Booklets
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-parchment">
              Related Booklets
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {relatedBooklets.map((relatedBooklet) => (
                <BookletCard
                  basePath={basePath}
                  booklet={toCardBooklet(relatedBooklet)}
                  key={relatedBooklet.slug}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}
