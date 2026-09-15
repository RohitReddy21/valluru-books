import { NewsletterForm } from "@/components/newsletter-form";
import {
  PageShell,
  PrimaryLink,
  ProseBlocks,
  SecondaryLink,
  Section,
  SectionTitle,
  WideSection,
  MovementCard
} from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import {
  defaultSiteContent,
  isPublished,
  movementSlug,
  seriesBasePath
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getSiteContent();
  const { home, inwardMirror } = content;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const showInwardMirror = isPublished(inwardMirror.status);
  const inwardMirrorPath = seriesBasePath(inwardMirror);

  return (
    <PageShell>
      <section
        className="hero-texture px-4 pb-14 pt-24 sm:px-5 sm:pb-20 sm:pt-32"
        style={
          media.homeHeroImage
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(15, 14, 12, 0.94) 0%, rgba(15, 14, 12, 0.82) 42%, rgba(15, 14, 12, 0.2) 72%), linear-gradient(180deg, rgba(15, 14, 12, 0.18), rgba(15, 14, 12, 0.88)), url("${media.homeHeroImage}")`
              }
            : undefined
        }
      >
        <div className="mx-auto grid min-h-[min(720px,calc(100dvh-6rem))] max-w-6xl items-center fade-up">
          <div className="max-w-3xl text-left max-md:text-center">
          <p className="font-label text-sm uppercase tracking-[0.28em] text-muted">
            {home.hero.eyebrow}
          </p>
          <h1 className="responsive-hero-title mt-6 font-display font-semibold text-parchment">
            {home.hero.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-parchment/86 sm:text-2xl max-md:mx-auto">
            {home.hero.subtitle}
          </p>
          <div className="responsive-prose mt-7 max-w-2xl space-y-4 text-parchment/82 max-md:mx-auto">
            {home.hero.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row max-md:items-center max-md:justify-center">
            <PrimaryLink cta={home.hero.primaryCta} />
            <SecondaryLink cta={home.hero.secondaryCta} />
          </div>
          </div>
        </div>
      </section>

      {/* The second series introduces itself directly under the hero, but only once it
          is published — a draft series stays entirely off the public site. */}
      {showInwardMirror ? (
        <WideSection>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="fade-up">
              <p className="font-label text-sm uppercase tracking-[0.26em] text-gold">
                {inwardMirror.homeSection.eyebrow}
              </p>
              <h2 className="responsive-section-title mt-4 font-display font-semibold text-parchment">
                {inwardMirror.homeSection.title}
              </h2>
              <p className="mt-4 text-lg italic leading-8 text-muted">
                {inwardMirror.subtitle}
              </p>
              <div className="responsive-prose mt-6 space-y-4 text-parchment/84">
                {inwardMirror.homeSection.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="mt-9">
                <PrimaryLink
                  cta={{
                    label: inwardMirror.homeSection.ctaLabel,
                    href: inwardMirrorPath
                  }}
                />
              </div>
            </div>
            {inwardMirror.heroImage ? (
              <div className="relative overflow-hidden rounded-md border border-gold/15 bg-ink shadow-[0_18px_55px_rgba(0,0,0,0.3)]">
                <div className="aspect-[4/3] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={inwardMirror.title}
                    className="h-full w-full object-cover opacity-90"
                    src={inwardMirror.heroImage}
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
              </div>
            ) : null}
          </div>
        </WideSection>
      ) : null}

      <Section>
        <SectionTitle>{home.why.title}</SectionTitle>
        <ProseBlocks blocks={home.why.body} />
      </Section>

      <WideSection>
        <div className="mx-auto max-w-3xl text-center">
          <SectionTitle>{home.seriesOverview.title}</SectionTitle>
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {home.seriesOverview.movements.map((movement, index) => (
            <MovementCard key={movementSlug(movement, index)} movement={movement} index={index} />
          ))}
        </div>
      </WideSection>

      <Section>
        <SectionTitle>{home.forWhom.title}</SectionTitle>
        <ProseBlocks blocks={home.forWhom.body} />
      </Section>

      <Section className="text-center">
        <blockquote className="responsive-section-title font-display italic text-parchment">
          “{home.quote.text}”
        </blockquote>
        <p className="mt-6 font-label text-sm uppercase tracking-[0.22em] text-muted">
          — {home.quote.byline}
        </p>
      </Section>

      <Section className="scroll-mt-24" id="newsletter">
        <SectionTitle>{home.newsletter.title}</SectionTitle>
        <p className="responsive-prose text-parchment/86">{home.newsletter.body}</p>
        <NewsletterForm microcopy={home.newsletter.microcopy} />
      </Section>

      <section className="quiet-divider px-5 py-16 text-center">
        <p className="font-body text-xl italic text-muted sm:text-2xl">{home.closingLine}</p>
      </section>
    </PageShell>
  );
}
