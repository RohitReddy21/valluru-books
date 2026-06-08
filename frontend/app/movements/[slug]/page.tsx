import { notFound } from "next/navigation";
import { BackLink, PageShell, PrimaryLink } from "@/components/ui";
import { MovementPdfReader } from "@/components/movement-pdf-reader";
import { defaultSiteContent, movementSlug, isPublished } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return defaultSiteContent.home.seriesOverview.movements.map((movement, index) => ({
    slug: movementSlug(movement, index)
  }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getSiteContent();
  const movement = content.home.seriesOverview.movements.find(
    (item, index) => movementSlug(item, index) === slug && isPublished(item.status)
  );

  return {
    title: movement
      ? `${movement.title} — The Valluru`
      : "Movement — The Valluru",
    description: movement?.seo?.description || movement?.description
  };
}

export default async function MovementDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getSiteContent();
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };

  const movementIndex = content.home.seriesOverview.movements.findIndex(
    (item, index) => movementSlug(item, index) === slug
  );

  if (movementIndex === -1) {
    notFound();
  }

  const movement = content.home.seriesOverview.movements[movementIndex];

  if (!isPublished(movement.status)) {
    notFound();
  }

  const movements = content.home.seriesOverview.movements.filter(m => isPublished(m.status));
  const currentIndex = movements.findIndex((item, index) => movementSlug(item, index) === slug);
  const previousMovement = currentIndex > 0 ? movements[currentIndex - 1] : null;
  const nextMovement = currentIndex < movements.length - 1 ? movements[currentIndex + 1] : null;

  return (
    <PageShell>
      <section
        className="valluru-hero-image px-4 pb-12 pt-24 sm:px-5 sm:pt-32"
        style={
          media.pageHeroImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(15, 14, 12, 0.42), rgba(15, 14, 12, 0.96)), url("${media.pageHeroImage}")`
              }
            : undefined
        }
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="max-w-3xl fade-up">
            <p className="font-label text-sm uppercase tracking-[0.24em] text-muted">
              Movements
            </p>
            <h1 className="responsive-page-title mt-4 font-display font-semibold text-parchment">
              {movement.title}
            </h1>
            {movement.description && (
              <p className="mt-4 text-xl italic leading-tight text-muted sm:text-2xl">
                {movement.description}
              </p>
            )}
            <p className="responsive-prose mt-8 text-parchment/88">
              {movement.booklets || "Explore this movement through reflection and practice."}
            </p>
            <div className="mt-10">
              <BackLink href="/movements" label="Back to all Movements" />
            </div>
            {movement.pdf ? (
              <MovementPdfReader
                movement={movement}
                movementIndex={movementIndex}
              />
            ) : (
              <div className="mt-8 rounded-md border border-gold/20 bg-surface/50 p-6">
                <p className="text-muted">PDF content not yet available for this movement.</p>
              </div>
            )}
          </article>

          <aside className="fade-up lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-label text-sm uppercase tracking-[0.23em] text-muted">
              Related Movements
            </h2>
            <div className="mt-5 grid gap-4">
              {previousMovement ? (
                <div className="rounded-md border border-gold/15 bg-surface/70 p-5">
                  <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                    Previous
                  </p>
                  <h3 className="mt-3 font-display text-xl text-parchment">
                    {previousMovement.title}
                  </h3>
                  <div className="mt-4">
                    <PrimaryLink
                      cta={{
                        label: "Explore",
                        href: `/movements/${movementSlug(previousMovement, currentIndex - 1)}`
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {nextMovement ? (
                <div className="rounded-md border border-gold/15 bg-surface/70 p-5">
                  <p className="font-label text-xs uppercase tracking-[0.2em] text-gold">
                    Next
                  </p>
                  <h3 className="mt-3 font-display text-xl text-parchment">
                    {nextMovement.title}
                  </h3>
                  <div className="mt-4">
                    <PrimaryLink
                      cta={{
                        label: "Explore",
                        href: `/movements/${movementSlug(nextMovement, currentIndex + 1)}`
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </PageShell>
  );
}
