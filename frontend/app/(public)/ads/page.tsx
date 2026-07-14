import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Flame, Mail, NotepadText } from "lucide-react";
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

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function SocialPostLink({
  href,
  children
}: {
  href: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a
        className="mt-6 inline-flex font-label text-xs uppercase tracking-[0.2em] text-gold transition hover:text-parchment"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      className="mt-6 inline-flex font-label text-xs uppercase tracking-[0.2em] text-gold transition hover:text-parchment"
      href={href}
    >
      {children}
    </Link>
  );
}

export default async function AdsPage() {
  const content = await getSiteContent();
  const { home, series, settings } = content;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  const publishedMovements = home.seriesOverview.movements.filter((movement) =>
    isPublished(movement.status)
  );
  const publishedBooklets = series.booklets.filter((booklet) =>
    isPublished(booklet.status)
  );
  const featuredBooklets = publishedBooklets.slice(0, 6);
  const socialLinks = settings.socialLinks || {};
  const socialPosts = [
    {
      icon: Flame,
      eyebrow: "Short reflection",
      title: "When silence asks for steadiness",
      body:
        "A compact note on grief, dharma, and the inward posture that remains when quick answers fail.",
      href: socialLinks.instagram || "/#newsletter",
      cta: socialLinks.instagram ? "Read on Instagram" : "Receive the letter"
    },
    {
      icon: BookOpen,
      eyebrow: "Reading note",
      title: "Begin where the fire first appears",
      body:
        "Start with Booklet One, then move through sound, language, responsibility, surrender, and return.",
      href: socialLinks.youtube || "/series",
      cta: socialLinks.youtube ? "Watch the note" : "View the series"
    },
    {
      icon: NotepadText,
      eyebrow: "Movement update",
      title: "The work gathers into doorways",
      body:
        "Each movement gives readers a stable path through the booklets without turning the work into noise.",
      href: socialLinks.linkedin || "/movements",
      cta: socialLinks.linkedin ? "Read the update" : "Explore movements"
    }
  ];

  return (
    <PageShell>
      <AdsSubscriptionGate>

      <section
        className="hero-texture px-4 pb-14 pt-24 sm:px-5 sm:pb-20 sm:pt-32"
        style={
          media.homeHeroImage
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(15, 14, 12, 0.96) 0%, rgba(15, 14, 12, 0.88) 48%, rgba(15, 14, 12, 0.44) 78%), linear-gradient(180deg, rgba(15, 14, 12, 0.1), rgba(15, 14, 12, 0.9)), url("${media.homeHeroImage}")`
              }
            : undefined
          }
      >
        <div className="mx-auto grid min-h-[min(680px,calc(100dvh-6rem))] max-w-6xl items-center fade-up">
          <div className="max-w-3xl">
            <p className="font-label text-sm uppercase tracking-[0.28em] text-gold/85">
              The Valluru
            </p>
            <h1 className="responsive-hero-title mt-6 font-display font-semibold text-parchment">
              The Inward Fire Series
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-parchment/86 sm:text-2xl">
              Booklets and movements on dharma, grief, language, surrender, and
              the inner life.
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-parchment/76">
              A serious path into the work for readers arriving from ads: begin
              with the series, understand the movements, and stay with quiet
              updates when new writing is added.
            </p>
            <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <PrimaryLink cta={{ label: "Enter the Series", href: "/series" }} />
              <SecondaryLink cta={{ label: "View Movements", href: "/movements" }} />
            </div>
          </div>
        </div>
      </section>

      <section className="quiet-divider px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="mx-auto max-w-3xl text-center">
            <SectionTitle>Movements</SectionTitle>
            <p className="responsive-prose text-parchment/86">
              {home.seriesOverview.intro}
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

      <section className="quiet-divider px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <SectionTitle>Booklets</SectionTitle>
              <p className="responsive-prose text-parchment/86">
                A curated beginning from the published reading order. Read
                slowly; return when the language asks for another pass.
              </p>
            </div>
            <SecondaryLink cta={{ label: "All Booklets", href: "/series" }} />
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredBooklets.map((booklet) => (
              <BookletCard booklet={booklet} key={booklet.slug} />
            ))}
          </div>
        </div>
      </section>

      <section className="quiet-divider px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-6xl fade-up">
          <div className="max-w-3xl">
            <SectionTitle>Social Posts</SectionTitle>
            <p className="responsive-prose text-parchment/86">
              Short public notes for readers who want a smaller doorway before
              entering the full series.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {socialPosts.map((post) => {
              const Icon = post.icon;

              return (
                <article
                  className="rounded-md border border-gold/15 bg-surface/72 p-6 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-gold/40 hover:bg-surface"
                  key={post.title}
                >
                  <Icon className="text-gold" size={22} />
                  <p className="mt-5 font-label text-xs uppercase tracking-[0.22em] text-muted">
                    {post.eyebrow}
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-parchment">
                    {post.title}
                  </h2>
                  <p className="mt-4 text-base leading-7 text-parchment/74">
                    {post.body}
                  </p>
                  <SocialPostLink href={post.href}>{post.cta}</SocialPostLink>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="quiet-divider px-4 py-12 sm:px-5 sm:py-20">
        <div className="mx-auto max-w-3xl fade-up">
          <p className="mb-4 inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.24em] text-gold/90">
            <Mail size={15} />
            Quiet updates
          </p>
          <SectionTitle>{home.newsletter.title}</SectionTitle>
          <p className="responsive-prose text-parchment/86">
            {home.newsletter.body}
          </p>
          <NewsletterForm microcopy={home.newsletter.microcopy} />
        </div>
      </section>
      </AdsSubscriptionGate>
    </PageShell>
  );
}
