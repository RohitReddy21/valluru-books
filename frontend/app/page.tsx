import Link from "next/link";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  PageShell,
  PrimaryLink,
  ProseBlocks,
  SecondaryLink,
  Section,
  SectionTitle,
  WideSection
} from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, movementSlug } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getSiteContent();
  const { home } = content;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

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

      <Section>
        <SectionTitle>{home.why.title}</SectionTitle>
        <ProseBlocks blocks={home.why.body} />
      </Section>

      <WideSection>
        <div className="mx-auto max-w-3xl text-center">
          <SectionTitle>The Series in Five Movements</SectionTitle>
          <p className="responsive-prose text-parchment/86">
            {home.seriesOverview.intro}
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {home.seriesOverview.movements.map((movement, index) => (
            <Link
              className="group block rounded-md border border-gold/15 bg-surface/72 p-4 transition hover:border-gold/40"
              href={`/movements/${movementSlug(movement, index)}`}
              key={movementSlug(movement, index)}
            >
              <h3 className="font-display text-lg leading-tight text-parchment group-hover:text-gold">
                {movement.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted">
                {movement.description}
              </p>
              <span className="mt-4 inline-flex font-label text-[10px] uppercase tracking-[0.2em] text-gold">
                Explore
              </span>
            </Link>
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
