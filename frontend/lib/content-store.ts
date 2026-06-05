import { apiUrl } from "@/lib/api";
import { defaultSiteContent, type SiteContent } from "@/lib/site-content";

function normalizeContent(content?: Partial<SiteContent> | null): SiteContent {
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
      ...defaultSiteContent.nav,
      ...(content?.nav || {})
    },
    home: {
      ...defaultSiteContent.home,
      ...(content?.home || {})
    },
    series: {
      ...defaultSiteContent.series,
      ...(content?.series || {})
    },
    essays: {
      ...defaultSiteContent.essays,
      ...(content?.essays || {})
    },
    about: {
      ...defaultSiteContent.about,
      ...(content?.about || {})
    },
    footer: {
      ...defaultSiteContent.footer,
      ...(content?.footer || {})
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
