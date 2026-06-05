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
import { defaultSiteContent } from "@/lib/site-content";

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
                backgroundImage: `linear-gradient(180deg, rgba(15, 14, 12, 0.34), rgba(15, 14, 12, 0.92)), url("${media.homeHeroImage}")`
              }
            : undefined
        }
      >
        <div className="mx-auto max-w-4xl text-center fade-up">
          <p className="font-label text-sm uppercase tracking-[0.28em] text-muted">
            {home.hero.eyebrow}
          </p>
          <h1 className="responsive-hero-title mt-6 font-display font-semibold text-parchment">
            {home.hero.title}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-parchment/86 sm:text-2xl">
            {home.hero.subtitle}
          </p>
          <div className="responsive-prose mx-auto mt-7 max-w-3xl space-y-4 text-parchment/82">
            {home.hero.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <PrimaryLink cta={home.hero.primaryCta} />
            <SecondaryLink cta={home.hero.secondaryCta} />
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
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {home.seriesOverview.movements.map((movement) => (
            <Link
              className="group block rounded-md border border-gold/15 bg-surface/72 p-5 transition hover:border-gold/40"
              href={movement.href || "/series"}
              key={movement.title}
            >
              <p className="font-label text-xs uppercase tracking-[0.23em] text-gold/80">
                Booklets {movement.booklets}
              </p>
              <h3 className="mt-4 font-display text-xl leading-tight text-parchment group-hover:text-gold sm:text-2xl">
                {movement.title}
              </h3>
              <p className="mt-4 text-lg leading-7 text-muted">
                {movement.description}
              </p>
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
