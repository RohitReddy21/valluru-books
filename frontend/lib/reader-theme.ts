import { useCallback, useMemo, useSyncExternalStore, type CSSProperties } from "react";
import type { BookletReaderTheme } from "@/lib/site-content";

/**
 * How the reader's page is set: the booklet's own theme, then the reader's preferences on
 * top of it.
 *
 * The theme comes from content in the database, which an admin can edit, and its values
 * end up in inline styles. Every one is validated before it is used — a colour is six hex
 * digits or it is ignored — so a bad value falls back to the default page instead of
 * reaching the stylesheet.
 */

export type ReaderMode = "book" | "sepia" | "night";
export type ReaderPrefs = { size: number; mode: ReaderMode };

/** Text size steps, as a multiplier on the size the page is laid out for. */
export const SIZE_STEPS = [0.9, 1, 1.14, 1.3] as const;
export const DEFAULT_PREFS: ReaderPrefs = { size: 1, mode: "book" };

/** The page the reader uses when a booklet has no measured theme. */
export const DEFAULT_THEME = {
  face: "noto",
  paper: "#f7f0e4",
  ink: "#2a2118",
  accent: "#a17a3e",
  aspect: 432 / 648
} as const;

/**
 * The Telugu face sits second in every stack. Font fallback is per glyph, so Latin takes
 * the booklet's face and Telugu takes Noto Serif Telugu out of the same line — none of
 * the Latin faces has Telugu coverage.
 */
const FACE_STACKS: Record<NonNullable<BookletReaderTheme["face"]>, string> = {
  garamond: 'var(--font-page-garamond), var(--font-page-telugu), "EB Garamond", Georgia, serif',
  georgia: 'var(--font-page-georgia), var(--font-page-telugu), Georgia, serif',
  sans: 'var(--font-page-sans), var(--font-page-telugu), Arial, Helvetica, sans-serif',
  noto: 'var(--font-page), var(--font-page-telugu), "Noto Serif", Georgia, serif'
};

const MODES: Record<Exclude<ReaderMode, "book">, { paper: string; ink: string; accent: string }> = {
  sepia: { paper: "#efe2c6", ink: "#3a2e1f", accent: "#8a5a2b" },
  night: { paper: "#171512", ink: "#d9d0c0", accent: "#c9a96b" }
};

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string) {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type ResolvedTheme = {
  face: keyof typeof FACE_STACKS;
  paper: string;
  ink: string;
  accent: string;
  aspect: number;
  night: boolean;
};

export function resolveTheme(theme: BookletReaderTheme | undefined, mode: ReaderMode): ResolvedTheme {
  if (mode !== "book") {
    const preset = MODES[mode];

    return {
      face: theme?.face && theme.face in FACE_STACKS ? theme.face : DEFAULT_THEME.face,
      ...preset,
      aspect: clampAspect(theme?.aspect),
      night: mode === "night"
    };
  }

  const paper = theme?.paper && HEX.test(theme.paper) ? theme.paper : DEFAULT_THEME.paper;
  let ink = theme?.ink && HEX.test(theme.ink) ? theme.ink : DEFAULT_THEME.ink;
  const accent = theme?.accent && HEX.test(theme.accent) ? theme.accent : DEFAULT_THEME.accent;

  // The measured ink is the most common colour of text on the page, which for a couple of
  // booklets is a muted caption tone. Never let the page be unreadable for fidelity.
  if (contrast(ink, paper) < 4.5) {
    ink = luminance(paper) > 0.4 ? "#241d18" : "#e6dccb";
  }

  return {
    face: theme?.face && theme.face in FACE_STACKS ? theme.face : DEFAULT_THEME.face,
    paper,
    ink,
    accent,
    aspect: clampAspect(theme?.aspect),
    night: luminance(paper) < 0.18
  };
}

/** Landscape and square booklets exist; nothing outside this range is a booklet page. */
function clampAspect(aspect: number | undefined) {
  return Number.isFinite(aspect) && aspect! >= 0.6 && aspect! <= 1.8 ? aspect! : DEFAULT_THEME.aspect;
}

/**
 * The custom properties the chapters, the gate and the page furniture read. Nothing in
 * those components names a colour: they are shown on the dark site and on this page, so
 * each surface supplies its own.
 */
export function themeStyle(theme: ResolvedTheme): CSSProperties {
  const { paper, ink, accent, night } = theme;
  const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

  return {
    "--reading-display": FACE_STACKS[theme.face],
    "--reading-head": ink,
    "--reading-ink": ink,
    "--reading-label": accent,
    "--reading-rule": mix(ink, 16, paper),
    "--reading-fade": paper,
    "--reading-panel": mix(ink, 5, paper),
    "--reading-field": night ? mix(ink, 9, paper) : mix("#ffffff", 55, paper),
    "--rd-paper": paper,
    "--rd-ink": ink,
    "--rd-accent": accent,
    "--rd-muted": mix(ink, 56, paper),
    "--rd-shadow": night ? "rgba(0,0,0,0.6)" : "rgba(40,28,10,0.32)"
  } as CSSProperties;
}

/* ── Preferences ────────────────────────────────────────────────────────────────────── */

const PREFS_KEY = "valluru_reader_prefs";
const PREFS_EVENT = "valluru-reader-prefs";
/** Held in memory too, for a browser that refuses storage: the choice still lasts the session. */
let memoryPrefs = "";

function readRawPrefs() {
  try {
    return window.localStorage.getItem(PREFS_KEY) ?? memoryPrefs;
  } catch {
    return memoryPrefs;
  }
}

function subscribePrefs(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFS_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFS_EVENT, callback);
  };
}

function parsePrefs(raw: string): ReaderPrefs {
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    const size = Number(parsed.size);
    const mode = parsed.mode;

    return {
      size: SIZE_STEPS.some((step) => step === size) ? size : DEFAULT_PREFS.size,
      mode: mode === "sepia" || mode === "night" || mode === "book" ? mode : DEFAULT_PREFS.mode
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** The reader's size and mode, remembered across booklets and visits. */
export function useReaderPrefs(): [ReaderPrefs, (patch: Partial<ReaderPrefs>) => void] {
  // The snapshot is the raw string, so it is stable between renders; parsing it here keeps
  // the object identity steady too. The server renders the defaults, which is what the
  // first client render agrees with before the stored choice is read.
  const raw = useSyncExternalStore(subscribePrefs, readRawPrefs, () => "");
  const prefs = useMemo(() => parsePrefs(raw), [raw]);

  const update = useCallback((patch: Partial<ReaderPrefs>) => {
    const next = JSON.stringify({ ...parsePrefs(readRawPrefs()), ...patch });
    memoryPrefs = next;

    try {
      window.localStorage.setItem(PREFS_KEY, next);
    } catch {
      // Nothing to do: memoryPrefs already holds it.
    }

    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  return [prefs, update];
}
