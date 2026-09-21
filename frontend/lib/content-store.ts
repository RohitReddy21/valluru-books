import { cache } from "react";
import { apiUrl } from "@/lib/api";
import {
  defaultSiteContent,
  isPublished,
  movementSlug,
  resolveChapterAccess,
  seriesBasePath,
  type BookSeries,
  type Booklet,
  type BookletChapter,
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

/**
 * Chapters are written through the admin editor, so treat them as untrusted input and
 * order what survives by chapter number.
 *
 * A chapter with no paragraphs is kept as long as it has a title: that is exactly the
 * shape a gated chapter arrives in, since the public content API redacts its prose. Only
 * an entry with neither prose nor a title is dropped.
 */
function normalizeChapters(chapters: Booklet["chapters"]): BookletChapter[] | undefined {
  if (!Array.isArray(chapters)) {
    return undefined;
  }

  const normalized = chapters
    .map((chapter, index) => {
      const paragraphs = Array.isArray(chapter?.paragraphs)
        ? chapter.paragraphs.map((paragraph) => String(paragraph ?? "").trim()).filter(Boolean)
        : [];
      const title = String(chapter?.title ?? "").trim();

      if (!paragraphs.length && !title) {
        return null;
      }

      const number = Number(chapter?.number) > 0 ? Number(chapter.number) : index + 1;
      const teaser = String(chapter?.teaser ?? "").trim();

      return {
        id: String(chapter?.id || `chapter-${number}`),
        number,
        title: title || `Chapter ${number}`,
        paragraphs,
        ...(typeof chapter?.free === "boolean" ? { free: chapter.free } : {}),
        ...(chapter?.frontMatter ? { frontMatter: true } : {}),
        ...(teaser ? { teaser } : {}),
        ...(Array.isArray(chapter?.images) && chapter.images.length
          ? {
              images: chapter.images
                .filter((image) => image?.src && image.width > 0 && image.height > 0)
                .map((image) => ({
                  src: String(image.src),
                  width: Number(image.width),
                  height: Number(image.height),
                  ...(image.page ? { page: Number(image.page) } : {})
                }))
            }
          : {})
      };
    })
    .filter((chapter): chapter is BookletChapter => chapter !== null)
    .sort((left, right) => left.number - right.number);

  // Resolved here rather than per-chapter, because the depth rule needs the whole list:
  // front matter is free without spending one of the three.
  return normalized.length ? resolveChapterAccess(normalized) : undefined;
}

function normalizeBooklets(booklets?: Booklet[]) {
  const sourceBooklets = booklets?.length ? booklets : defaultSiteContent.series.booklets;
  const mergedBooklets = sourceBooklets.map((booklet) => {
    const defaults = defaultSiteContent.series.booklets.find((defaultBooklet) =>
      sameBooklet(defaultBooklet, booklet)
    );

    const merged = defaults ? { ...defaults, ...booklet } : booklet;
    const chapters = normalizeChapters(merged.chapters);

    return chapters ? { ...merged, chapters } : merged;
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

const COUNT_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three",
  "twenty-four", "twenty-five"
];

const COUNT_WORD_PATTERN = new RegExp(`\\b(${COUNT_WORDS.join("|")})(\\s+booklets)\\b`, "gi");

function matchCapitalisation(word: string, sample: string) {
  if (sample === sample.toUpperCase()) {
    return word.toUpperCase();
  }

  return sample[0] === sample[0].toUpperCase()
    ? word.replace(/(^|-)([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase())
    : word;
}

/**
 * Rewrites "Seventeen booklets" and the like to whatever the series actually holds.
 *
 * This replaces a hardcoded Seventeen-to-Eighteen swap that had drifted twice over: the
 * series now publishes twenty-one, so the patched copy was wrong by three. Deriving the
 * number from the booklets means adding one cannot leave the sentence stale again.
 *
 * The real fix is for the copy not to carry a count at all, but it lives in the admin
 * editor, so correcting it there is an editorial change rather than a code one.
 */
function normalizeBookletCountText(value: string, publishedCount?: number) {
  if (!publishedCount || publishedCount >= COUNT_WORDS.length) {
    return value;
  }

  return value.replace(COUNT_WORD_PATTERN, (_match, word: string, suffix: string) =>
    matchCapitalisation(COUNT_WORDS[publishedCount], word) + suffix
  );
}

function normalizeSearchSnippetText(value: string, publishedCount?: number) {
  return normalizeBookletCountText(value, publishedCount)
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
  atIndex: number,
  publishedCount?: number
) {
  const label = series.navLabel || "The Inward Fire";
  // Falls back to the real count rather than a number frozen at the time it was written.
  const subtitle =
    normalizeBookletCountText(series.navSubtitle || "", publishedCount) ||
    (publishedCount && publishedCount < COUNT_WORDS.length
      ? `${matchCapitalisation(COUNT_WORDS[publishedCount], "E")} booklets`
      : "Booklets");
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
      // Normalised, not just preferred: a saved nav caption carries its own count, and
      // keeping it as-is is what left "Eighteen booklets" on a series of twenty-one.
      subtitle: normalizeBookletCountText(link.subtitle || "", publishedCount) || subtitle
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
  // Counted once, up front, so every sentence and nav caption that mentions a number
  // reports the same one the series page actually lists.
  const normalizedBooklets = normalizeBooklets(content?.series?.booklets);
  const publishedBookletCount = normalizedBooklets.filter((booklet) =>
    isPublished(booklet.status)
  ).length;

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
    withSeriesLink(withInwardFireLink(navLinks, inwardFireNav, 1, publishedBookletCount), inwardMirror, "/movements"),
    ["/series", seriesBasePath(inwardMirror)],
    savedSeriesGroupLabel || seriesGroupLabel
  );
  const footerLinksWithSeries = withSeriesLink(
    withInwardFireLink(footerLinks, inwardFireNav, 0, publishedBookletCount),
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
    subtitle: normalizeSearchSnippetText(
      hero.subtitle || defaultSiteContent.home.hero.subtitle,
      publishedBookletCount
    ),
    body: asArray(hero.body, defaultSiteContent.home.hero.body).map((line) =>
      normalizeSearchSnippetText(line, publishedBookletCount)
    ),
    secondaryCta: {
      ...defaultSiteContent.home.hero.secondaryCta,
      ...(hero.secondaryCta || {}),
      label: normalizeBookletCountText(
        hero.secondaryCta?.label || defaultSiteContent.home.hero.secondaryCta.label,
        publishedBookletCount
      )
    }
  };
  home.seriesOverview = {
    ...home.seriesOverview,
    intro: normalizeSearchSnippetText(home.seriesOverview.intro, publishedBookletCount)
  };
  const series = {
    ...defaultSiteContent.series,
    ...(content?.series || {}),
    subtitle: normalizeSearchSnippetText(
      content?.series?.subtitle || defaultSiteContent.series.subtitle,
      publishedBookletCount
    ),
    booklets: normalizedBooklets
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

export const CONTENT_REVALIDATE_SECONDS = 300;
export const CONTENT_CACHE_TAG = "site-content";

/**
 * While a page is being built, a sleeping free-tier backend is worth waiting for: a build
 * that gives up after six seconds bakes placeholder content into every page. At request
 * time the ceiling stays short, so a cold start never holds a visitor.
 */
const BUILDING = process.env.NEXT_PHASE === "phase-production-build";
const CONTENT_FETCH_TIMEOUT_MS = BUILDING ? 90_000 : 6000;

/** Once the backend has failed a whole build wait, the rest of the build stops waiting. */
let backendUnreachableDuringBuild = false;

/**
 * The last real content this server instance received. A forced revalidation (an admin
 * save) expires the cached copy outright, and if the API is unreachable at that moment
 * there is no page left to keep; a warm instance can still answer from this.
 */
let lastGoodContent: SiteContent | null = null;

class ContentUnavailableError extends Error {
  constructor(reason: string) {
    super(`Site content unavailable (${reason}); keeping the last generated page.`);
    this.name = "ContentUnavailableError";
  }
}

/**
 * The backend could not give real content.
 *
 * At request time this answers from the last real content this instance saw, and throws if
 * it has seen none. Next.js treats a failed regeneration as "keep serving the page you
 * have and try again on the next request", which is what a visitor wants while the API
 * wakes up. Returning the placeholder content instead is a *successful* render, so
 * it replaces the good page and is served for the next five minutes: with Render sleeping
 * after fifteen idle minutes, the site kept losing its booklets. During the build there is
 * no earlier page to keep, so the placeholders are the right answer there.
 */
function contentUnavailable(reason: string): SiteContent {
  if (BUILDING) {
    backendUnreachableDuringBuild = true;
    return normalizeContent(null);
  }

  if (lastGoodContent) {
    return lastGoodContent;
  }

  throw new ContentUnavailableError(reason);
}

/**
 * `cache` dedupes this across one render pass, so the layout and the page share a single
 * fetch instead of making the same call twice.
 */
export const getSiteContent = cache(async function getSiteContent(): Promise<SiteContent> {
  if (BUILDING && backendUnreachableDuringBuild) {
    return normalizeContent(null);
  }

  try {
    const response = await fetch(apiUrl("/api/content"), {
      next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: [CONTENT_CACHE_TAG] },
      signal: AbortSignal.timeout(CONTENT_FETCH_TIMEOUT_MS)
    });

    // Normalize the defaults too, so an unreachable backend renders the same nav,
    // footer, and series visibility rules as a healthy one.
    if (!response.ok) {
      return contentUnavailable(`HTTP ${response.status}`);
    }

    // The backend answers 200 with placeholder content when it cannot reach its database.
    if (response.headers.get("x-content-source") === "fallback") {
      return contentUnavailable("backend is serving fallback content");
    }

    const payload = (await response.json()) as {
      content?: Partial<SiteContent> | null;
    };

    lastGoodContent = normalizeContent(payload.content);

    return lastGoodContent;
  } catch (error) {
    if (error instanceof ContentUnavailableError) {
      throw error;
    }

    return contentUnavailable(error instanceof Error ? error.message : "request failed");
  }
});

export function getContentSource() {
  return "backend API";
}
