import { PageHeader, PageShell, ProseBlocks, Section } from "@/components/ui";
import { getSiteContent } from "@/lib/content-store";
import { defaultSiteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const content = await getSiteContent();
  const { about } = content;
  const media = { ...defaultSiteContent.media, ...(content.media || {}) };
  return (
    <PageShell>
      <PageHeader
        backgroundImage={media.pageHeroImage}
        title={about.title}
        subtitle={about.subtitle}
      />
      <Section className="pt-0">
        {media.authorImage ? (
          <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={about.title}
            className="mb-10 aspect-square w-44 rounded-md border border-gold/20 object-cover shadow-quiet"
            src={media.authorImage}
          />
          </>
        ) : (
          <div className="mb-10 aspect-square w-44 rounded-md border border-gold/20 bg-surface shadow-quiet" />
        )}
        <ProseBlocks blocks={about.bio} />
      </Section>
      <Section>
        <div className="grid gap-6">
          {about.pullQuotes.map((quote) => (
            <blockquote
              className="border-l border-gold/40 pl-6 font-display text-2xl italic leading-tight text-parchment sm:text-3xl"
              key={quote}
            >
              {quote}
            </blockquote>
          ))}
        </div>
      </Section>
      <Section>
        <h2 className="responsive-section-title font-display text-parchment">What This Work Is Not</h2>
        <div className="responsive-prose mt-7 grid gap-3 text-parchment/86">
          {about.whatThisIsNot.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <div className="responsive-prose mt-12 border-t border-gold/15 pt-8 text-parchment/86">
          <p>{about.contact.intro}</p>
          <a
            className="mt-3 block text-gold transition hover:text-parchment"
            href={`mailto:${about.contact.email}`}
          >
            {about.contact.email}
          </a>
          <p>{about.contact.website}</p>
        </div>
      </Section>
    </PageShell>
  );
}
