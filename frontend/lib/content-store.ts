import { apiUrl } from "@/lib/api";
import { defaultSiteContent, movementSlug, type SiteContent } from "@/lib/site-content";

function normalizeContent(content?: Partial<SiteContent> | null): SiteContent {
  const nav = {
    ...defaultSiteContent.nav,
    ...(content?.nav || {})
  };
  const footer = {
    ...defaultSiteContent.footer,
    ...(content?.footer || {})
  };

  // Ensure "Movements" is in nav links
  const navLinks = [...(nav.links || [])].filter(
    (link) => link.href !== "/essays" && link.href !== "/cart" && link.href !== "/checkout"
  );
  const hasMovementsInNav = navLinks.some((link) => link.href === "/movements");
  if (!hasMovementsInNav) {
    // Insert Movements after "The Series" (href: /series) if possible, otherwise just add it
    const seriesIndex = navLinks.findIndex((link) => link.href === "/series");
    if (seriesIndex !== -1) {
      navLinks.splice(seriesIndex + 1, 0, { label: "Movements", href: "/movements" });
    } else {
      navLinks.push({ label: "Movements", href: "/movements" });
    }
  }

  // Ensure "Movements" is in footer links
  const footerLinks = [...(footer.links || [])].filter((link) => link.href !== "/essays");
  const hasMovementsInFooter = footerLinks.some((link) => link.href === "/movements");
  if (!hasMovementsInFooter) {
    // Insert Movements after "The Books" (href: /series) if possible, otherwise just add it
    const booksIndex = footerLinks.findIndex((link) => link.href === "/series");
    if (booksIndex !== -1) {
      footerLinks.splice(booksIndex + 1, 0, { label: "Movements", href: "/movements" });
    } else {
      footerLinks.push({ label: "Movements", href: "/movements" });
    }
  }

  const home = {
    ...defaultSiteContent.home,
    ...(content?.home || {}),
    seriesOverview: {
      ...defaultSiteContent.home.seriesOverview,
      ...(content?.home?.seriesOverview || {}),
      movements: (
        content?.home?.seriesOverview?.movements ||
        defaultSiteContent.home.seriesOverview.movements
      ).map((movement, index) => ({
        ...movement,
        slug: movementSlug(movement, index)
      }))
    }
  };

  return {
    ...defaultSiteContent,
    ...(content || {}),
    media: {
      ...defaultSiteContent.media,
      ...(content?.media || {})
    },
    settings: {
      ...defaultSiteContent.settings,
      ...(content?.settings || {}),
      seo: {
        ...defaultSiteContent.settings.seo,
        ...(content?.settings?.seo || {})
      }
    },
    nav: {
      ...nav,
      links: navLinks
    },
    home,
    series: {
      ...defaultSiteContent.series,
      ...(content?.series || {})
    },
    movements: {
      ...defaultSiteContent.movements,
      ...(content?.movements || {})
    },
    about: {
      ...defaultSiteContent.about,
      ...(content?.about || {})
    },
    footer: {
      ...footer,
      links: footerLinks
    }
  } as SiteContent;
}

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const response = await fetch(apiUrl("/api/content"), { cache: "no-store" });

    if (!response.ok) {
      return defaultSiteContent;
    }

    const payload = (await response.json()) as {
      content?: Partial<SiteContent> | null;
    };

    return normalizeContent(payload.content);
  } catch {
    return defaultSiteContent;
  }
}

export function getContentSource() {
  return "backend API";
}
