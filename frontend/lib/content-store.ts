import { apiUrl } from "@/lib/api";
import {
  defaultSiteContent,
  isPublished,
  movementSlug,
  seriesBasePath,
  type BookSeries,
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

function asArray<T>(value: T[] | undefined, fallback: T[] = []) {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Unlike the Inward Fire series, a saved booklet list here is authoritative: booklets
 * removed from the admin editor stay removed instead of being merged back from defaults.
 */
function normalizeBookSeries(
  saved: Partial<BookSeries> | null | undefined,
  defaults: BookSeries
): BookSeries {
  return {
    ...defaults,
    ...(saved || {}),
    // The route segment is a filesystem path under app/(public), so it stays code-owned.
    // A stale or edited value in saved content would point links at a route that does not exist.
    routeSegment: defaults.routeSegment,
    opening: asArray(saved?.opening, defaults.opening),
    closing: asArray(saved?.closing, defaults.closing),
    booklets: Array.isArray(saved?.booklets) ? saved.booklets : defaults.booklets,
    seo: {
      ...defaults.seo,
      ...(saved?.seo || {})
    }
  };
}

function withSeriesLink(
  links: Array<{ label: string; href: string }>,
  series: BookSeries,
  afterHref: string
) {
  const href = seriesBasePath(series);
  const existingIndex = links.findIndex((link) => link.href === href);

  if (!isPublished(series.status)) {
    return existingIndex === -1 ? links : links.filter((_, index) => index !== existingIndex);
  }

  if (existingIndex !== -1) {
    return links;
  }

  const nextLinks = [...links];
  const anchorIndex = nextLinks.findIndex((link) => link.href === afterHref);
  const link = { label: series.navLabel, href };

  if (anchorIndex === -1) {
    nextLinks.push(link);
  } else {
    nextLinks.splice(anchorIndex + 1, 0, link);
  }

  return nextLinks;
}

const movementAssetFields = ["pdf", "coverImage"] as const;

function findMovementOverride(
  movements: Movement[] | undefined,
  defaultMovement: Movement,
  defaultIndex: number
) {
  const movementList = asArray(movements);

  if (!movementList.length) {
    return undefined;
  }

  const defaultSlug = movementSlug(defaultMovement, defaultIndex);
  const normalizedDefaultMovement = normalizeMovementRange(defaultMovement);

  return (
    movementList.find(
      (movement, index) =>
        movement.slug === defaultSlug ||
        movementSlug(movement, index) === defaultSlug ||
        normalizeMovementRange(movement).title === defaultMovement.title ||
        movement.title === defaultMovement.title ||
        normalizeMovementRange(movement).booklets === normalizedDefaultMovement.booklets
    )
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

function savedMovementMatchesDefault(
  movement: Movement,
  index: number,
  defaultMovement: Movement,
  defaultIndex: number
) {
  const defaultSlug = movementSlug(defaultMovement, defaultIndex);
  const normalizedMovement = normalizeMovementRange(movement);
  const normalizedDefaultMovement = normalizeMovementRange(defaultMovement);

  return (
    movement.slug === defaultSlug ||
    movementSlug(movement, index) === defaultSlug ||
    movementSlug(normalizedMovement, index) === defaultSlug ||
    movement.title === defaultMovement.title ||
    normalizedMovement.title === defaultMovement.title ||
    normalizedMovement.booklets === normalizedDefaultMovement.booklets
  );
}

function isDefaultMovement(movement: Movement, index: number) {
  return defaultSiteContent.home.seriesOverview.movements.some((defaultMovement, defaultIndex) =>
    savedMovementMatchesDefault(movement, index, defaultMovement, defaultIndex)
  );
}

function appendSavedMovements(
  codeMovements: Movement[],
  movementSources: Array<Movement[] | undefined>
) {
  const mergedMovements = [...codeMovements];
  const seenSlugs = new Set(
    mergedMovements.map((movement, index) => movementSlug(movement, index))
  );

  for (const movements of movementSources) {
    for (const [sourceIndex, movement] of (movements || []).entries()) {
      if (isDefaultMovement(movement, sourceIndex)) {
        continue;
      }

      const normalizedMovement = normalizeMovementRange(movement);
      const nextIndex = mergedMovements.length;
      const slug = movementSlug(normalizedMovement, nextIndex);

      if (seenSlugs.has(slug)) {
        continue;
      }

      mergedMovements.push({
        ...normalizedMovement,
        slug
      });
      seenSlugs.add(slug);
    }
  }

  return mergedMovements;
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

  const inwardMirror = normalizeBookSeries(
    content?.inwardMirror,
    defaultSiteContent.inwardMirror
  );

  // Ensure "Movements" is in nav links
  const navLinks = [...asArray(nav.links, defaultSiteContent.nav.links)].filter(
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
  const footerLinks = [...asArray(footer.links, defaultSiteContent.footer.links)].filter((link) => link.href !== "/essays");
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

  // Additional series only reach the nav and footer once they are published.
  const navLinksWithSeries = withSeriesLink(navLinks, inwardMirror, "/movements");
  const footerLinksWithSeries = withSeriesLink(footerLinks, inwardMirror, "/movements");

  const codeSeriesOverviewMovements = defaultSiteContent.home.seriesOverview.movements.map(
    (movement, index) =>
      codeDrivenMovement(movement, index, [
        asArray(content?.home?.seriesOverview?.movements),
        asArray(content?.movements?.items)
      ])
  );
  const seriesOverviewMovements = appendSavedMovements(codeSeriesOverviewMovements, [
    asArray(content?.home?.seriesOverview?.movements),
    asArray(content?.movements?.items)
  ]);

  const home = {
    ...defaultSiteContent.home,
    ...(content?.home || {}),
    seriesOverview: {
      ...defaultSiteContent.home.seriesOverview,
      ...(content?.home?.seriesOverview || {}),
      title: defaultSiteContent.home.seriesOverview.title,
      intro: defaultSiteContent.home.seriesOverview.intro,
      movements: seriesOverviewMovements
    }
  };
  const hero = {
    ...defaultSiteContent.home.hero,
    ...(home.hero || {})
  };
  home.hero = {
    ...hero,
    subtitle: normalizeSearchSnippetText(hero.subtitle || defaultSiteContent.home.hero.subtitle),
    body: asArray(hero.body, defaultSiteContent.home.hero.body).map(normalizeSearchSnippetText),
    secondaryCta: {
      ...defaultSiteContent.home.hero.secondaryCta,
      ...(hero.secondaryCta || {}),
      label: normalizeBookletCountText(
        hero.secondaryCta?.label || defaultSiteContent.home.hero.secondaryCta.label
      )
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
      links: navLinksWithSeries
    },
    home,
    series,
    inwardMirror,
    movements: {
      ...defaultSiteContent.movements,
      ...(content?.movements || {}),
      items: seriesOverviewMovements
    },
    about: {
      ...defaultSiteContent.about,
      ...(content?.about || {}),
      bio: asArray(content?.about?.bio, defaultSiteContent.about.bio),
      pullQuotes: asArray(content?.about?.pullQuotes, defaultSiteContent.about.pullQuotes),
      whatThisIsNot: asArray(content?.about?.whatThisIsNot, defaultSiteContent.about.whatThisIsNot),
      contact: {
        ...defaultSiteContent.about.contact,
        ...(content?.about?.contact || {})
      }
    },
    footer: {
      ...footer,
      links: footerLinksWithSeries
    }
  } as SiteContent;
}

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const response = await fetch(apiUrl("/api/content"), { cache: "no-store" });

    if (!response.ok) {
      // Normalize the defaults too, so an unreachable backend renders the same nav,
      // footer, and series visibility rules as a healthy one.
      return normalizeContent(null);
    }

    const payload = (await response.json()) as {
      content?: Partial<SiteContent> | null;
    };

    return normalizeContent(payload.content);
  } catch {
    return normalizeContent(null);
  }
}

export function getContentSource() {
  return "backend API";
}
