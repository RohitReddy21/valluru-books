"use client";

import type { HTMLAttributes } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Booklet, Cta } from "@/lib/site-content";
import { bookletPublicSlug, movementSlug, isPublished } from "@/lib/site-content";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="pt-20">{children}</main>;
}

export function Section({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`quiet-divider px-4 py-12 sm:px-5 sm:py-20 ${className}`} {...props}>
      <div className="mx-auto max-w-3xl fade-up">{children}</div>
    </section>
  );
}

export function WideSection({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`quiet-divider px-4 py-12 sm:px-5 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-6xl fade-up">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  backgroundImage
}: {
  title: string;
  subtitle: string;
  backgroundImage?: string;
}) {
  return (
    <section
      className="valluru-hero-image px-4 pb-12 pt-24 sm:px-5 sm:pb-16 sm:pt-32"
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(15, 14, 12, 0.42), rgba(15, 14, 12, 0.96)), url("${backgroundImage}")`
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-3xl fade-up">
        <p className="mb-5 font-label text-sm uppercase tracking-[0.26em] text-gold/85">
          The Valluru
        </p>
        <h1 className="responsive-page-title font-display font-semibold text-parchment">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted sm:text-xl">{subtitle}</p>
      </div>
    </section>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="responsive-section-title mb-7 font-display font-semibold text-parchment">
      {children}
    </h2>
  );
}

export function ProseBlocks({ blocks }: { blocks: string[] }) {
  return (
    <div className="responsive-prose space-y-5 text-parchment/88">
      {blocks.map((block) => (
        <p key={block}>{block}</p>
      ))}
    </div>
  );
}

export function PrimaryLink({ cta }: { cta: Cta }) {
  return (
    <Link
      className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/60 px-5 py-3 font-label text-sm uppercase tracking-[0.2em] text-parchment transition hover:border-gold hover:text-gold"
      href={cta.href}
    >
      {cta.label}
      <ArrowRight size={16} />
    </Link>
  );
}

export function SecondaryLink({ cta }: { cta: Cta }) {
  return (
    <Link
      className="inline-flex items-center gap-2 font-label text-sm uppercase tracking-[0.2em] text-muted transition hover:text-gold"
      href={cta.href}
    >
      {cta.label}
      <ArrowRight size={15} />
    </Link>
  );
}

export function BookletCard({ booklet }: { booklet: Booklet }) {
  const badge = booklet.badge || booklet.tag || "AVAILABLE";
  // Truncate description to ~120 chars for better card visibility
  const truncatedDescription = booklet.description
    ? booklet.description.length > 120
      ? booklet.description.substring(0, 120) + "..."
      : booklet.description
    : "";

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-md border border-gold/15 bg-surface/80 shadow-[0_18px_55px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-gold/45 hover:bg-surface">
        <div className="relative aspect-[4/5] overflow-hidden border-b border-gold/10 bg-ink flex-shrink-0">
          {booklet.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={booklet.title}
                className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                src={booklet.coverImage}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            </>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(196,169,107,0.16),rgba(15,14,12,0.96))]" />
          )}
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gold/30 bg-ink/75 px-3 py-1.5 font-label text-xs uppercase tracking-[0.24em] text-gold backdrop-blur">
              {booklet.numberLabel}
            </span>
            <span className="rounded-md border border-parchment/12 bg-parchment/8 px-3 py-1.5 font-label text-[11px] uppercase tracking-[0.2em] text-parchment/80 backdrop-blur">
              {badge}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h2 className="responsive-card-title font-display font-semibold text-parchment transition group-hover:text-gold">
            {booklet.title}
          </h2>
          <p className="mt-2 text-sm italic leading-6 text-muted/85">
            {booklet.subtitle}
          </p>
          {truncatedDescription && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-parchment/75">
              {truncatedDescription}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <PrimaryLink cta={{ label: "Read Booklet", href: `/series/${bookletPublicSlug(booklet)}` }} />
            {booklet.coffeeTableEdition === "unavailable" ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-muted cursor-not-allowed">
                COFFEE-TABLE EDITION UNAVAILABLE
              </span>
            ) : null}
            {/* Add to cart is temporarily disabled.
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/35 bg-gold/5 px-5 py-3 font-label text-sm uppercase tracking-[0.18em] text-gold transition hover:border-gold hover:bg-gold/10"
                type="button"
                onClick={() => setIsModalOpen(true)}
              >
                Add to Cart
              </button>
            */}
          </div>
        </div>
      </article>
      {/* Add to cart modal is temporarily disabled.
      <CoffeeTableUnavailableModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      */}
    </>
  );
}

export function MovementCard({ movement, index }: { movement: any; index: number }) {
  const isPublishedMovement = isPublished(movement.status);
  const slug = movementSlug(movement, index);
  const badge = movement.status === "draft" ? "Coming Soon" : "AVAILABLE";
  const truncatedDescription = movement.description
    ? movement.description.length > 120
      ? movement.description.substring(0, 120) + "..."
      : movement.description
    : "";

  if (!isPublishedMovement) {
    return (
      <article className="group flex h-full flex-col overflow-hidden rounded-md border border-gold/15 bg-surface/80 shadow-[0_18px_55px_rgba(0,0,0,0.22)] opacity-75 cursor-not-allowed">
        <div className="relative aspect-[4/5] overflow-hidden border-b border-gold/10 bg-ink flex-shrink-0">
          {movement.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={movement.title}
                className="h-full w-full object-cover opacity-90"
                src={movement.coverImage}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            </>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(196,169,107,0.16),rgba(15,14,12,0.96))]" />
          )}
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gold/30 bg-ink/75 px-3 py-1.5 font-label text-xs uppercase tracking-[0.24em] text-gold backdrop-blur">
              Movement {index + 1}
            </span>
            <span className="rounded-md border border-parchment/12 bg-parchment/8 px-3 py-1.5 font-label text-[11px] uppercase tracking-[0.2em] text-parchment/80 backdrop-blur">
              {badge}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h2 className="responsive-card-title font-display font-semibold text-muted">
            {movement.title}
          </h2>
          {movement.booklets && (
            <p className="mt-2 text-sm italic leading-6 text-muted/85">
              {movement.booklets}
            </p>
          )}
          {truncatedDescription && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted/75">
              {truncatedDescription}
            </p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-md border border-gold/15 bg-surface/80 shadow-[0_18px_55px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-gold/45 hover:bg-surface">
      <Link href={`/movements/${slug}`} className="block flex flex-col h-full">
        <div className="relative aspect-[4/5] overflow-hidden border-b border-gold/10 bg-ink flex-shrink-0">
          {movement.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={movement.title}
                className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                src={movement.coverImage}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
            </>
          ) : (
            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(196,169,107,0.16),rgba(15,14,12,0.96))]" />
          )}
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gold/30 bg-ink/75 px-3 py-1.5 font-label text-xs uppercase tracking-[0.24em] text-gold backdrop-blur">
              Movement {index + 1}
            </span>
            <span className="rounded-md border border-parchment/12 bg-parchment/8 px-3 py-1.5 font-label text-[11px] uppercase tracking-[0.2em] text-parchment/80 backdrop-blur">
              {badge}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <h2 className="responsive-card-title font-display font-semibold text-parchment transition group-hover:text-gold">
            {movement.title}
          </h2>
          {movement.booklets && (
            <p className="mt-2 text-sm italic leading-6 text-muted/85">
              {movement.booklets}
            </p>
          )}
          {truncatedDescription && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-parchment/75">
              {truncatedDescription}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <span className="inline-flex items-center justify-center gap-2 font-label text-sm uppercase tracking-[0.2em] text-gold transition group-hover:text-parchment">
              Explore Movement <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function BackLink({ href, label }: Cta) {
  return (
    <Link
      className="inline-flex items-center gap-2 font-label text-sm uppercase tracking-[0.2em] text-muted transition hover:text-gold"
      href={href}
    >
      <ArrowLeft size={15} />
      {label}
    </Link>
  );
}
