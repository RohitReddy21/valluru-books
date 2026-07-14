import type { Metadata } from "next";
import { BookOpen, Flame, Mail, Layers, Quote } from "lucide-react";
import { AdsSubscriptionGate } from "@/components/ads-subscription-gate";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  BookletCard,
  MovementCard,
  PageShell,
  PrimaryLink,
  SecondaryLink,
  SectionTitle
} from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import {
  defaultSiteContent,
  isPublished,
  movementSlug
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Inward Fire Series | The Valluru",
  description:
    "Booklets and movements on dharma, grief, language, surrender, and the inner life."
};

const pillars = [
  {
    icon: Flame,
    label: "The Fire",
    heading: "Writing that does not comfort, but clarifies",
    body: "Each booklet enters a territory where easy answers have already failed. The prose stays close to the difficulty without resolving it prematurely."
  },
  {
    icon: Layers,
    label: "The Structure",
    heading: "Movements give the work a stable reading path",
    body: "Rather than a loose collection, the series is organized into movements — thematic arcs that let readers pass through the work with direction and return."
  },
  {
    icon: BookOpen,
    label: "The Practice",
    heading: "Slow reading is built into the form",
    body: "Short, dense booklets designed to be reread. The language rewards patience. A second pass through almost every page will reveal a different register."
  }
];

export default async function AdsPage() {
  const content = await getSiteContent();
  const { home, series } = content;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const publishedMovements = home.seriesOverview.movements.filter((movement) =>
    isPublished(movement.status)
  );
  const publishedBooklets = series.booklets.filter((booklet) =>
    isPublished(booklet.status)
  );
  const featuredBooklets = publishedBooklets.slice(0, 6);

  return (
    <PageShell>
      <AdsSubscriptionGate>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        className="hero-texture px-4 pb-16 pt-24 sm:px-5 sm:pb-24 sm:pt-36"
        style={
          media.homeHeroImage
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(15,14,12,0.97) 0%, rgba(15,14,12,0.90) 50%, rgba(15,14,12,0.45) 80%), linear-gradient(180deg, rgba(15,14,12,0.1), rgba(15,14,12,0.9)), url("${media.homeHeroImage}")`
              }
            : undefined
        }
      >
        <div className="mx-auto grid min-h-[min(700px,calc(100dvh-6rem))] max-w-6xl items-center">
          <div className="max-w-3xl fade-up">
            {/* Eyebrow */}
            <div className="mb-8 inline-flex items-center gap-3">
              <span className="h-px w-8 bg-gold/60" />
              <span className="font-label text-xs uppercase tracking-[0.32em] text-gold/85">
                The Valluru · The Inward Fire Series
              </span>
            </div>

            <h1 className="responsive-hero-title font-display font-semibold text-parchment">
              Writing for the reader<br />
              <em className="text-gold/90 not-italic">who has already looked inward.</em>
            </h1>

            <p className="mt-8 max-w-2xl text-xl leading-9 text-parchment/80 sm:text-2xl">
              Booklets and movements on dharma, grief, language, surrender, and
              the inner life — written for those who need the work, not the noise.
            </p>

            <div className="mt-4 max-w-xl text-base leading-7 text-parchment/58">
              A serious path into the work for readers who arrived from ads and stayed
              for the writing. Begin with the series. Understand the movements. Stay
              with quiet updates when new writing is added.
            </div>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <PrimaryLink cta={{ label: "Enter the Series", href: "/series" }} />
              <SecondaryLink cta={{ label: "View Movements", href: "/movements" }} />
            </div>

          </div>
        </div>
      </section>

      {/* ── PILLARS ───────────────────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-24">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-label text-xs uppercase tracking-[0.28em] text-gold/80">
              Why this work
            </p>
            <h2 className="responsive-section-title font-display font-semibold text-parchment">
              Three things that make the series different
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map(({ icon: Icon, label, heading, body }) => (
              <div
                key={label}
                className="group relative overflow-hidden rounded-md border border-gold/12 bg-surface/60 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-gold/35 hover:bg-surface"
              >
                {/* Subtle glow on hover */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
                  style={{ background: "radial-gradient(ellipse at top left, rgba(196,169,107,0.07), transparent 60%)" }}
                />
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-md border border-gold/25 bg-gold/8">
                  <Icon className="text-gold" size={18} />
                </div>
                <p className="mb-3 font-label text-[10px] uppercase tracking-[0.26em] text-gold/70">
                  {label}
                </p>
                <h3 className="font-display text-xl font-semibold leading-snug text-parchment transition group-hover:text-gold/95">
                  {heading}
                </h3>
                <p className="mt-4 text-sm leading-7 text-parchment/65">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PULL QUOTE ────────────────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-4xl fade-up text-center">
          <Quote className="mx-auto mb-6 text-gold/30" size={36} />
          <blockquote className="font-display text-2xl font-semibold italic leading-relaxed text-parchment/90 sm:text-3xl">
            "The inward fire does not burn for those who only look at it.
            It burns for those who walk into it."
          </blockquote>
          <p className="mt-6 font-label text-xs uppercase tracking-[0.26em] text-gold/60">
            — The Inward Fire Series, Booklet One
          </p>
        </div>
      </section>

      {/* ── MOVEMENTS ────────────────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-24">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-4 font-label text-xs uppercase tracking-[0.28em] text-gold/80">
              Reading paths
            </p>
            <SectionTitle>Movements</SectionTitle>
            <p className="responsive-prose mx-auto max-w-2xl text-parchment/80">
              {home.seriesOverview.intro}
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {publishedMovements.map((movement, index) => (
              <MovementCard
                index={index}
                key={movementSlug(movement, index)}
                movement={movement}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── BOOKLETS ─────────────────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-24">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 font-label text-xs uppercase tracking-[0.28em] text-gold/80">
                The series
              </p>
              <SectionTitle>Booklets</SectionTitle>
              <p className="responsive-prose text-parchment/80">
                A curated beginning from the published reading order. Read
                slowly — return when the language asks for another pass.
              </p>
            </div>
            <SecondaryLink cta={{ label: "View all booklets", href: "/series" }} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredBooklets.map((booklet) => (
              <BookletCard booklet={booklet} key={booklet.slug} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS STRIP ───────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-6xl fade-up">
          <p className="mb-10 text-center font-label text-xs uppercase tracking-[0.28em] text-gold/70">
            How to begin
          </p>
          <div className="grid gap-0 md:grid-cols-3">
            {[
              {
                title: "Choose a movement",
                body: "Each movement is a curated reading path through the booklets. Pick the one whose theme speaks first."
              },
              {
                title: "Read the booklets slowly",
                body: "These are not summaries. Each booklet is a sustained encounter. Give it an hour. Return the next day."
              },
              {
                title: "Stay with quiet updates",
                body: "Subscribe below. Receive a short note whenever new booklets or movements are published — nothing else."
              }
            ].map(({ title, body }, i) => (
              <div
                key={title}
                className={`relative px-8 py-8 ${i > 0 ? "md:border-l md:border-gold/12" : ""}`}
              >
                <h3 className="font-display text-xl font-semibold text-parchment">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-parchment/62">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ───────────────────────────────────────────────── */}
      <section className="quiet-divider px-4 py-16 sm:px-5 sm:py-24">
        <div className="mx-auto max-w-3xl fade-up">
          {/* Decorative rule */}
          <div className="mb-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-gold/18" />
            <Mail className="text-gold/60" size={16} />
            <span className="h-px flex-1 bg-gold/18" />
          </div>
          <p className="mb-4 text-center font-label text-xs uppercase tracking-[0.28em] text-gold/85">
            Quiet updates
          </p>
          <SectionTitle>
            <span className="block text-center">{home.newsletter.title}</span>
          </SectionTitle>
          <p className="responsive-prose mb-8 text-center text-parchment/80">
            {home.newsletter.body}
          </p>
          <NewsletterForm microcopy={home.newsletter.microcopy} />
        </div>
      </section>

      </AdsSubscriptionGate>
    </PageShell>
  );
}
