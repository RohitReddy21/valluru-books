import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, PageShell, WideSection } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent, isPublished } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function EssaysPage() {
  const content = await getSiteContent();
  const { essays } = content;
  const publishedEssays = essays.items.filter((essay) => isPublished(essay.status));
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={essays.title}
        subtitle={essays.subtitle}
      />
      <WideSection className="pt-0">
        <div className="mx-auto max-w-4xl">
          {publishedEssays.map((essay) => (
            <article
              className="border-t border-gold/15 py-9 first:border-t-0"
              key={essay.slug}
            >
              <div className="flex flex-wrap gap-3 font-label text-xs uppercase tracking-[0.2em] text-muted">
                <span>{essay.date}</span>
                <span>{essay.category}</span>
                <span>{essay.readingTime}</span>
              </div>
              <Link href={`/essays/${essay.slug}`}>
                <h2 className="responsive-card-title mt-4 font-display text-parchment transition hover:text-gold">
                  {essay.title}
                </h2>
              </Link>
              <p className="responsive-prose mt-5 text-parchment/84">
                {essay.excerpt}
              </p>
            </article>
          ))}
          <Link
            className="mt-8 inline-flex items-center gap-2 font-label text-sm uppercase tracking-[0.2em] text-muted transition hover:text-gold"
            href={essays.cta.href}
          >
            {essays.cta.label}
            <ArrowRight size={15} />
          </Link>
        </div>
      </WideSection>
    </PageShell>
  );
}
