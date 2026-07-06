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

function normalizeSearchSnippetText(value: string) {
  return normalizeBookletCountText(value)
    .replaceAll(
      "Eighteen booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor.",
      "Booklets on dharma, grief, language, and surrender. For the seeker who still needs an inward anchor."
    )
    .replaceAll(
      "Eighteen booklets on dharma, grief, language, and surrender",
      "Booklets on dharma, grief, language, and surrender"
    );
}

const movementAssetFields = ["pdf", "coverImage"] as const;

function findMovementOverride(
  movements: Movement[] | undefined,
  defaultMovement: Movement,
  defaultIndex: number
) {
  if (!movements?.length) {
    return undefined;
  }

  const defaultSlug = movementSlug(defaultMovement, defaultIndex);

  return (
    movements.find(
      (movement, index) =>
        movement.slug === defaultSlug ||
        movementSlug(movement, index) === defaultSlug ||
        movement.title === defaultMovement.title
    ) || movements[defaultIndex]
  );
}

function codeDrivenMovement(
  defaultMovement: Movement,
  index: number,
  movementSources: Array<Movement[] | undefined>
) {
  const assetPatch: Partial<Pick<Movement, (typeof movementAssetFields)[number]>> = {};

  for (const movements of movementSources) {
    const savedMovement = findMovementOverride(movements, defaultMovement, index);

    if (!savedMovement) {
      continue;
    }

    for (const field of movementAssetFields) {
      if (savedMovement[field]) {
        assetPatch[field] = savedMovement[field];
      }
    }
  }

  return {
    ...normalizeMovementRange(defaultMovement),
    ...assetPatch,
    slug: movementSlug(defaultMovement, index)
  };
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

  const codeSeriesOverviewMovements = defaultSiteContent.home.seriesOverview.movements.map(
    (movement, index) =>
      codeDrivenMovement(movement, index, [
        content?.home?.seriesOverview?.movements,
        content?.movements?.items
      ])
  );

  const home = {
    ...defaultSiteContent.home,
    ...(content?.home || {}),
    seriesOverview: {
      ...defaultSiteContent.home.seriesOverview,
      ...(content?.home?.seriesOverview || {}),
      title: defaultSiteContent.home.seriesOverview.title,
      intro: defaultSiteContent.home.seriesOverview.intro,
      movements: codeSeriesOverviewMovements
    }
  };
  home.hero = {
    ...home.hero,
    subtitle: normalizeSearchSnippetText(home.hero.subtitle),
    body: home.hero.body.map(normalizeSearchSnippetText),
    secondaryCta: {
      ...home.hero.secondaryCta,
      label: normalizeBookletCountText(home.hero.secondaryCta.label)
    }
  };
  home.seriesOverview = {
    ...home.seriesOverview,
    intro: normalizeSearchSnippetText(home.seriesOverview.intro)
  };
  const series = {
    ...defaultSiteContent.series,
    ...(content?.series || {}),
    subtitle: normalizeSearchSnippetText(
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
      items: codeSeriesOverviewMovements
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
