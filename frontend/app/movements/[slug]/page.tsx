import { notFound } from "next/navigation";
import { BackLink, BookletCard, PageHeader, PageShell, Section, WideSection } from "@/components/ui";
import { defaultSiteContent, getBookletMovementIndex, isPublished } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

function slugifyMovement(title: string) {
  return title.toLowerCase().replace(/\s+/g, "-");
}

export function generateStaticParams() {
  return defaultSiteContent.home.seriesOverview.movements.map((movement) => ({
    slug: slugifyMovement(movement.title)
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
    (m) => slugifyMovement(m.title) === slug
  );

  return {
    title: movement
      ? `${movement.title} — The Valluru`
      : "Movement — The Valluru"
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
    (m) => slugifyMovement(m.title) === slug
  );

  if (movementIndex === -1) {
    notFound();
  }

  const movement = content.home.seriesOverview.movements[movementIndex];
  const publishedBooklets = content.series.booklets.filter((item) =>
    isPublished(item.status)
  );
  
  const movementBooklets = publishedBooklets.filter((booklet) => {
    const sourceIndex = content.series.booklets.findIndex((item) => item.slug === booklet.slug);
    return getBookletMovementIndex(booklet, sourceIndex) === movementIndex;
  });

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={movement.title}
        subtitle={movement.description}
      />
      
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-lg italic leading-8 text-muted">
            Booklets {movement.booklets}
          </p>
          <div className="mt-8">
            <BackLink href="/movements" label="Back to all Movements" />
          </div>
        </div>
      </Section>

      <WideSection>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {movementBooklets.map((booklet) => (
            <BookletCard key={booklet.slug} booklet={booklet} />
          ))}
        </div>
      </WideSection>
    </PageShell>
  );
}
