import { apiUrl } from "@/lib/api";
import { defaultSiteContent, type SiteContent } from "@/lib/site-content";

function normalizeContent(content?: Partial<SiteContent> | null): SiteContent {
  const nav = {
    ...defaultSiteContent.nav,
    ...(content?.nav || {})
  };
  const footer = {
    ...defaultSiteContent.footer,
    ...(content?.footer || {})
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
      links: (nav.links || []).filter((link) => link.href !== "/essays")
    },
    home: {
      ...defaultSiteContent.home,
      ...(content?.home || {})
    },
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
      links: (footer.links || []).filter((link) => link.href !== "/essays")
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
