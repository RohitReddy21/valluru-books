import Link from "next/link";

interface Crumb {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  crumbs: Crumb[];
}

function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: `https://www.thevalluru.org${crumb.href}`
    }))
  };
}

/** The same markup without the visible trail, for pages whose header already says where you are. */
export function BreadcrumbSchema({ crumbs }: BreadcrumbProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
    />
  );
}

export function Breadcrumb({ crumbs }: BreadcrumbProps) {
  const schema = breadcrumbSchema(crumbs);

  return (
    <>
      <nav aria-label="breadcrumb" className="mb-6">
        <ol className="flex flex-wrap gap-2 text-sm">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.href}-${index}`} className="flex items-center gap-2">
              <Link
                href={crumb.href}
                className="text-gold hover:text-gold/80 transition"
              >
                {crumb.label}
              </Link>
              {index < crumbs.length - 1 && (
                <span className="text-muted">/</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </>
  );
}
