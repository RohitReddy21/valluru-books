import { apiUrl } from "@/lib/api";
import {
  defaultSiteContent,
  isPublished,
  movementSlug,
  seriesBasePath,
  type BookSeries,
  type Booklet,
  type Cta,
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
    homeSection: {
      ...defaults.homeSection,
      ...(saved?.homeSection || {}),
      body: asArray(saved?.homeSection?.body, defaults.homeSection.body)
    },
    seo: {
      ...defaults.seo,
      ...(saved?.seo || {})
    }
  };
}

function withSeriesLink(links: Cta[], series: BookSeries, afterHref: string) {
  const href = seriesBasePath(series);
  const existingIndex = links.findIndex((link) => link.href === href);

  if (!isPublished(series.status)) {
    return existingIndex === -1 ? links : links.filter((_, index) => index !== existingIndex);
  }

  const link = { label: series.navLabel, href, subtitle: series.navSubtitle };

  if (existingIndex !== -1) {
    return links.map((existing, index) => (index === existingIndex ? link : existing));
  }

  const nextLinks = [...links];
  const anchorIndex = nextLinks.findIndex((existing) => existing.href === afterHref);

  if (anchorIndex === -1) {
    nextLinks.push(link);
  } else {
    nextLinks.splice(anchorIndex + 1, 0, link);
  }

  return nextLinks;
}

/** Labels for the Inward Fire nav entry that predate the two-series naming. */
const staleSeriesNavLabels = new Set([
  "The Series",
  "The Books",
  "Series",
  "Books",
  "The Inward Fire"
]);

/** Label of the nav dropdown the two series sit under. */
const seriesGroupLabel = "The Series";

/**
 * Drops group wrappers and keeps their sub-links, so saved content that was written with a
 * grouped nav can be re-grouped from scratch instead of nesting a group inside a group.
 */
function flattenNavGroups(links: Cta[]) {
  return links.flatMap((link) => (link.children?.length ? link.children : [link]));
}

/**
 * Moves the series entries under one "The Series" dropdown, in the position the first of
 * them held. The group keeps the Inward Fire path as its `href` fallback; the nav renders
 * the label as a menu trigger rather than a link.
 */
function withSeriesGroup(links: Cta[], seriesHrefs: string[], label = seriesGroupLabel) {
  const hrefs = new Set(seriesHrefs);
  const children = links.filter((link) => hrefs.has(link.href));

  if (!children.length) {
    return links;
  }

  const groupIndex = links.findIndex((link) => hrefs.has(link.href));
  const rest = links.filter((link) => !hrefs.has(link.href));

  rest.splice(groupIndex, 0, {
    label: label.trim() || seriesGroupLabel,
    href: children[0].href,
    children
  });

  return rest;
}

/**
 * Keeps the Inward Fire entry present, named, and captioned. Its label was "The Series"
 * before a second series existed, so saved content still carrying that wording is renamed.
 */
function withInwardFireLink(
  links: Cta[],
  series: Pick<SiteContent["series"], "navLabel" | "navSubtitle">,
  atIndex: number
) {
  const label = series.navLabel || "The Inward Fire";
  const subtitle = series.navSubtitle || "Eighteen booklets";
  const existingIndex = links.findIndex((link) => link.href === "/series");

  if (existingIndex === -1) {
    const nextLinks = [...links];
    nextLinks.splice(Math.min(atIndex, nextLinks.length), 0, { label, href: "/series", subtitle });

    return nextLinks;
  }

  return links.map((link, index) => {
    if (index !== existingIndex) {
      return link;
    }

    return {
      ...link,
      label: staleSeriesNavLabels.has(link.label.trim()) ? label : link.label,
      subtitle: link.subtitle || subtitle
    };
  });
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

  const inwardFireNav = {
    navLabel: content?.series?.navLabel || defaultSiteContent.series.navLabel,
    navSubtitle: content?.series?.navSubtitle || defaultSiteContent.series.navSubtitle
  };

  // "/inward-series" was never a route; drop it so saved content cannot link to a 404.
  const deadNavHrefs = new Set(["/essays", "/cart", "/checkout", "/inward-series"]);

  // A group label edited from the admin editor survives the flatten-and-regroup below.
  const savedNavLinks = asArray(nav.links, defaultSiteContent.nav.links);
  const savedSeriesGroupLabel = savedNavLinks.find((link) => link.children?.length)?.label;

  // Ensure "Movements" is in nav links
  const navLinks = flattenNavGroups(savedNavLinks).filter(
    (link) => !deadNavHrefs.has(link.href)
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

  // The Inward Fire entry is renamed and captioned; the Inward Mirror entry only reaches
  // the nav and footer once the series is published. In the nav the two then sit inside
  // one "The Series" dropdown; the footer keeps them flat.
  const navLinksWithSeries = withSeriesGroup(
    withSeriesLink(withInwardFireLink(navLinks, inwardFireNav, 1), inwardMirror, "/movements"),
    ["/series", seriesBasePath(inwardMirror)],
    savedSeriesGroupLabel || seriesGroupLabel
  );
  const footerLinksWithSeries = withSeriesLink(
    withInwardFireLink(footerLinks, inwardFireNav, 0),
    inwardMirror,
    "/movements"
  );

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
