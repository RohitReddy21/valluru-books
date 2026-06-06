import type { HTMLAttributes } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Booklet, Cta } from "@/lib/site-content";
import { AddToCartButton } from "@/components/cart-actions";

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
  return (
    <article className="rounded-md border border-gold/15 bg-surface/72 p-6 transition hover:border-gold/40">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-label text-sm uppercase tracking-[0.24em] text-gold">
          {booklet.numberLabel}
        </span>
        <span className="rounded-md border border-gold/20 px-2.5 py-1 font-label text-xs uppercase tracking-[0.2em] text-muted">
          {booklet.badge || booklet.tag}
        </span>
      </div>
      <h2 className="responsive-card-title font-display font-semibold text-parchment">
        {booklet.title}
      </h2>
      <p className="mt-3 text-lg italic leading-7 text-muted sm:text-xl">{booklet.subtitle}</p>
      {booklet.sourcesNote ? (
        <p className="mt-4 text-base italic text-muted">{booklet.sourcesNote}</p>
      ) : null}
      {booklet.authorNote || booklet.note ? (
        <p className="mt-4 text-base italic text-muted">
          {booklet.authorNote || booklet.note}
        </p>
      ) : null}
      <p className="responsive-prose mt-5 text-parchment/86">
        {booklet.description}
      </p>
      <div className="mt-7 flex flex-wrap gap-4">
        <PrimaryLink cta={{ label: "Read Booklet", href: `/series/${booklet.slug}` }} />
        <AddToCartButton booklet={booklet} />
      </div>
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
