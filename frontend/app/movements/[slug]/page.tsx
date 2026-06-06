import { notFound } from "next/navigation";
import { BackLink, PageHeader, PageShell, Section } from "@/components/ui";
import { MovementPdfReader } from "@/components/movement-pdf-reader";
import { defaultSiteContent } from "@/lib/site-content";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return defaultSiteContent.home.seriesOverview.movements.map((movement) => ({
    slug: movement.slug
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
    (m) => m.slug === slug
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
    (m) => m.slug === slug
  );

  if (movementIndex === -1) {
    notFound();
  }

  const movement = content.home.seriesOverview.movements[movementIndex];

  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={movement.title}
        subtitle={movement.description}
      />
      
      <Section>
        <div className="mx-auto max-w-3xl">
          <div className="mt-8">
            <BackLink href="/movements" label="Back to all Movements" />
          </div>
          
          {movement.pdf ? (
            <MovementPdfReader
              movement={movement}
              movementIndex={movementIndex}
            />
          ) : null}
        </div>
      </Section>
    </PageShell>
  );
}
