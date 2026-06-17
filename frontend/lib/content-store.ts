import { apiUrl } from "@/lib/api";
import {
  defaultSiteContent,
  movementSlug,
  type Booklet,
  type Movement,
  type SiteContent
} from "@/lib/site-content";

function sameBooklet(left: Booklet, right: Booklet) {
  return (
    left.slug === right.slug ||
    left.numberLabel === right.numberLabel ||
    left.title === right.title
  );
}

function normalizeBooklets(booklets?: Booklet[]) {
  const sourceBooklets = booklets?.length ? booklets : defaultSiteContent.series.booklets;
  const mergedBooklets = sourceBooklets.map((booklet) => {
    const defaults = defaultSiteContent.series.booklets.find((defaultBooklet) =>
      sameBooklet(defaultBooklet, booklet)
    );

    return defaults ? { ...defaults, ...booklet } : booklet;
  });

  for (const defaultBooklet of defaultSiteContent.series.booklets) {
    const exists = mergedBooklets.some((booklet) => sameBooklet(defaultBooklet, booklet));

    if (!exists) {
      mergedBooklets.push(defaultBooklet);
    }
  }

  return mergedBooklets;
}

function normalizeMovementRange(movement: Movement) {
  const isHumanFieldMovement =
    movement.slug === "return-to-people" ||
    movementSlug(movement) === "return-to-people";

  if (
    isHumanFieldMovement &&
    movement.booklets === "14-17"
  ) {
    return {
      ...movement,
      booklets: "14-18",
      title:
        movement.title === "Return to People"
          ? "The Human Field Around the Seeker"
          : movement.title
    };
  }

  if (isHumanFieldMovement && movement.title === "Return to People") {
    return { ...movement, title: "The Human Field Around the Seeker" };
  }

  return movement;
}

function normalizeBookletCountText(value: string) {
  return value
    .replaceAll("Seventeen booklets", "Eighteen booklets")
    .replaceAll("seventeen booklets", "eighteen booklets")
    .replaceAll("View All Seventeen Booklets", "View All Eighteen Booklets");
}

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
        ...normalizeMovementRange(movement),
        slug: movementSlug(movement, index)
      }))
    }
  };
  home.hero = {
    ...home.hero,
    secondaryCta: {
      ...home.hero.secondaryCta,
      label: normalizeBookletCountText(home.hero.secondaryCta.label)
    }
  };
  home.seriesOverview = {
    ...home.seriesOverview,
    intro: normalizeBookletCountText(home.seriesOverview.intro)
  };
  const series = {
    ...defaultSiteContent.series,
    ...(content?.series || {}),
    subtitle: normalizeBookletCountText(
      content?.series?.subtitle || defaultSiteContent.series.subtitle
    ),
    booklets: normalizeBooklets(content?.series?.booklets)
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
    series,
    movements: {
      ...defaultSiteContent.movements,
      ...(content?.movements || {}),
      items: (
        content?.movements?.items ||
        defaultSiteContent.movements.items
      ).map((movement, index) => ({
        ...normalizeMovementRange(movement),
        slug: movementSlug(movement, index)
      }))
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
