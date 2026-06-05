import { notFound } from "next/navigation";
import { BackLink, PageShell } from "@/components/ui";
import { defaultSiteContent, isPublished } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return defaultSiteContent.essays.items.map((essay) => ({ slug: essay.slug }));
}

export default async function EssayDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getSiteContent();
  const essay = content.essays.items.find(
    (item) => item.slug === slug && isPublished(item.status)
  );

  if (!essay) {
    notFound();
  }

  const paragraphs =
    essay.content && essay.content.length > 0
      ? essay.content
      : ["This essay page is ready for the full reflection."];

  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-28 sm:pt-36">
        <p className="font-label text-sm uppercase tracking-[0.24em] text-gold">
          {essay.category} · {essay.readingTime}
        </p>
        <h1 className="responsive-page-title mt-5 font-display font-semibold text-parchment">
          {essay.title}
        </h1>
        <p className="responsive-prose mt-6 text-parchment/86">{essay.excerpt}</p>
        <div className="responsive-prose mt-10 space-y-6 text-parchment/84">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p>
            The archive is intentionally quiet: each essay can become a slow entry
            point into the same inward questions carried by the booklets.
          </p>
        </div>
        <div className="mt-12">
          <BackLink href="/essays" label="Back to Essays" />
        </div>
      </article>
    </PageShell>
  );
}
