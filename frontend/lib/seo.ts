/** Shown in link previews for any page that has no picture of its own. */
export const DEFAULT_OG_IMAGE = "https://www.thevalluru.org/og/default.jpg";

/** Search results show about 155 characters; anything longer is cut mid-sentence. */
const META_DESCRIPTION_MAX = 158;

/**
 * A description that fits a search snippet. Content descriptions run to 300+ characters
 * because they double as the page's intro, so they are cut for the meta tag: at the last
 * sentence end that fits, else the last word, never mid-word.
 */
export function seoDescription(text: string | undefined, max = META_DESCRIPTION_MAX) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();

  if (clean.length <= max) {
    return clean;
  }

  const head = clean.slice(0, max);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));

  if (sentenceEnd >= max * 0.55) {
    return head.slice(0, sentenceEnd + 1);
  }

  const wordEnd = head.lastIndexOf(" ");
  return `${head.slice(0, wordEnd > 0 ? wordEnd : max).replace(/[,;:\-–—\s]+$/, "")}…`;
}
