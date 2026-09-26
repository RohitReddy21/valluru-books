/**
 * Repairs the damage PDF extraction leaves in a booklet's chapters.
 *
 * Run by import-booklet-chapters.mjs on every import and by clean-booklet-text.mjs on
 * what is already stored, so a re-import cannot bring the damage back. Pure functions over
 * plain objects: nothing here touches a database or the network.
 *
 * Every repair is a rule about how the PDFs are laid out, never a per-booklet patch, with
 * one deliberate exception (TABLES): a table's cells cannot be recovered from flattened
 * text, so the rows are written out by hand from the printed page.
 */

import { TRANSCRIBED_VERSES } from "./transcribed-verses.mjs";
import { TRANSCRIBED_STANZAS } from "./transcribed-stanzas.mjs";
import { TRANSCRIBED_PASSAGES } from "./transcribed-passages.mjs";
import { TRANSCRIBED_BOOKLET_NINE } from "./transcribed-booklet-nine.mjs";
import { TRANSCRIBED_BOOKLET_SEVEN, BOOKLET_SEVEN_FIXES } from "./transcribed-booklet-seven.mjs";

const LATIN = "A-Za-zĀ-ſḀ-ỿ";
const LOWER = "a-zà-ÿāīūṛṝḷṅñṭḍṇśṣḥṃ";

/** The words the PDFs use for a booklet's number in a running head. */
const NUMBER_WORD = "(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty(?:[- ]One)?|\\d{1,2})";

/**
 * "Booklet Ten WHEN THE CHESSBOARD BURNS The Seeker and the Long Work of Bhagavān": the
 * running head of the movement the booklet belongs to. Where it printed in the body's text
 * band rather than the margin, the furniture filter kept it and it landed mid-paragraph.
 */
const RUNNING_HEAD = new RegExp(
  `\\s*Booklet\\s+${NUMBER_WORD}\\s+[A-Z][A-Z’'‘,.:\\- ]{6,}?\\s+The Seeker and the Long Work of Bhagavān\\b`,
  "g"
);

/**
 * A paragraph that opens a running head — "…Hopelessly efficient. Booklet Ten" — with the
 * rest of it, "WHEN THE CHESSBOARD BURNS The Seeker and the Long Work of Bhagavān", still
 * to come in the paragraphs after it. Only a paragraph that itself names its own booklet
 * this way is worth growing a window from: without this check, growing the window from
 * wherever the scan happens to be would eventually contain a running head many paragraphs
 * later and sweep in every unrelated paragraph in between as if it were part of it.
 */
const RUNNING_HEAD_LEAD_IN = new RegExp(`\\bBooklet\\s+${NUMBER_WORD}\\b`);

/**
 * Drops a running head spread across up to five paragraphs, however it landed: as
 * paragraphs of its own with nothing else in them, or fused onto the tail of a real
 * paragraph and continuing through the paragraphs after it — "Hopelessly efficient.
 * Booklet Ten" | "WHEN THE CHESSBOARD BURNS" | "The Seeker and the Long Work of
 * Bhagavān". Fine paragraph cuts (near one line each) put the running head at the head
 * or foot of almost every page, and a page break falls wherever it falls in the prose.
 *
 * The matched span collapses to whatever real prose survives outside the running head —
 * one paragraph, or none. A survivor that trails off mid-sentence (the running head cut
 * in before the sentence closed) is carried onto the next paragraph rather than left as
 * a fragment of its own.
 */
function withoutRunningHeadParagraphs(source) {
  // A local copy: a carried-over residue is spliced into the next slot ahead of it, and
  // the caller's array — original.paragraphs — must not be seen to change out from under it.
  const paragraphs = [...source];
  const out = [];

  for (let index = 0; index < paragraphs.length; ) {
    if (!RUNNING_HEAD_LEAD_IN.test(paragraphs[index])) {
      out.push(paragraphs[index]);
      index += 1;
      continue;
    }

    let consumed = 0;
    let residue;

    for (let span = 1; span <= 5 && index + span <= paragraphs.length; span += 1) {
      const window = paragraphs.slice(index, index + span).join(" ");

      // RUNNING_HEAD carries the "g" flag, so a shared lastIndex would make .test()
      // resume from a previous call instead of starting over.
      RUNNING_HEAD.lastIndex = 0;

      if (RUNNING_HEAD.test(window)) {
        residue = window.replace(RUNNING_HEAD, " ").replace(/\s{2,}/g, " ").trim();
        consumed = span;
        break;
      }
    }

    if (!consumed) {
      // Names its own booklet but never completes into the full running head within
      // reach — leave it alone rather than guess at what else might be going on.
      out.push(paragraphs[index]);
      index += 1;
      continue;
    }

    index += consumed;

    if (!residue) {
      continue;
    }

    if (unfinished(residue) && index < paragraphs.length) {
      // The running head cut into the middle of a sentence; give the rest of it to
      // whatever paragraph comes next, real or another running-head span.
      paragraphs[index] = `${residue} ${paragraphs[index]}`;
    } else {
      out.push(residue);
    }
  }

  return out;
}

/** "End of Booklet One": the PDF's last line, fused onto the last paragraph. */
const END_MARK = new RegExp(`\\s*End of Booklet\\s+${NUMBER_WORD}\\.?\\s*$`, "i");

/**
 * The heading of the next section, run onto the end of the paragraph before it because the
 * heading was set in capitals in the same text band. The word is the section it opens.
 */
const TRAILING_HEADING = /(?:^|\s+)(AUTHOR['’]S NOTE|EPILOGUE|THE GIST|CONTENTS)\s*$/;

const HEADING_KICKER = new Map([
  ["EPILOGUE", "Epilogue"],
  ["THE GIST", "The Gist"]
]);

/** Titles that are structure, whatever else they look like. */
const STRUCTURAL =
  /^(?:(?:chapter|movement|stanza|canto|part)\s+\d|\d{1,2}[A-Z]?[.\s]|opening\b|prologue\b|introduction\b|epilogue\b|afterword\b|conclusion\b|foreword\b|preface\b|author['’]?s note\b|contents\b|the gist\b|phalaśruti\b)/i;

// ── Text ───────────────────────────────────────────────────────────────────────────

/** A hyphen the line break ate a space after: "Re- alignment", "māyā- dissolution". */
const HYPHEN_SPACE = new RegExp(`([${LATIN}])- (?=[${LOWER}])`, "g");

/** Two words the extractor ran together where the PDF had a kerned space: "RāvaṇaBrahma". */
// Capitals are listed, not ranged: Ā-Ž would take in the lowercase ā, ī, ū and the rest of Latin Extended-A.
const UPPER = "A-ZÀ-ÖØ-ÞĀĪŪṚṜḶṄÑṬḌṆŚṢḤṂ";
const RUN_TOGETHER = new RegExp(`([${LOWER}]{3,})([${UPPER}][${LOWER}]{3,})`, "g");
const RUN_TOGETHER_OK = new Set([
  "WhatsApp",
  "YouTube",
  "LinkedIn",
  "PowerPoint",
  "JavaScript",
  "TypeScript",
  "GitHub",
  "DevOps"
]);

/** Prefixes the author always hyphenates; see rehyphenate(). */
const SELF_EXCEPTIONS = new Set(["selfless", "selflessness", "selfhood", "selfish", "selfishness", "selfsame", "selfie"]);
const HYPHEN_PREFIXES = ["self", "anti", "non"];

/**
 * A line-end hyphen is either part of the word or only a typesetter's break, and the text
 * layer does not say which. Where the book itself settles it — the same word hyphenated
 * elsewhere, or the prefix being one the author always hyphenates and the rest a word in
 * its own right — the hyphen is put back. "selfowned" beside "self-owned" is not a choice
 * the author made.
 */
export function buildLexicon(texts) {
  const joined = texts.join(" ");
  const hyphenated = new Set(
    (joined.match(new RegExp(`[${LATIN}]+-[${LATIN}]+`, "g")) || []).map((word) => word.toLowerCase())
  );
  const counts = new Map();

  for (const word of joined.match(new RegExp(`(?<![${LATIN}-])[${LATIN}]{4,}(?![${LATIN}-])`, "g")) || []) {
    const key = word.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return { hyphenated, counts };
}

export function rehyphenate(text, lexicon, changes) {
  return text.replace(new RegExp(`(?<![${LATIN}-])[${LATIN}]{7,}(?![${LATIN}-])`, "g"), (word) => {
    const lower = word.toLowerCase();

    for (const prefix of HYPHEN_PREFIXES) {
      if (!lower.startsWith(prefix)) {
        continue;
      }

      const rest = lower.slice(prefix.length);

      if (rest.length < 4 || SELF_EXCEPTIONS.has(lower)) {
        return word;
      }

      const attested = lexicon.hyphenated.has(`${prefix}-${rest}`);
      // "non" is left alone unless the hyphenated form is attested: the Mirror booklets
      // write nonduality and nonattachment as one word throughout, by choice.
      const restIsAWord =
        prefix !== "non" && lexicon.counts.has(rest) && (prefix === "self" || rest.length >= 6);
      // A spelling the book uses over and over is the author's, not a line-break accident.
      const habitual = (lexicon.counts.get(lower) || 0) >= 3;

      if ((attested || restIsAWord) && !habitual) {
        const fixed = `${word.slice(0, prefix.length)}-${word.slice(prefix.length)}`;
        changes?.push(`${word} → ${fixed}`);
        return fixed;
      }
    }

    return word;
  });
}

export function repairText(text, lexicon, changes) {
  let out = String(text ?? "");

  out = out.replace(HYPHEN_SPACE, (match, letter) => {
    changes?.push(`${match}… → ${letter}-…`);
    return `${letter}-`;
  });

  out = out.replace(RUN_TOGETHER, (match, left, right, offset, whole) => {
    // Not inside an address or a name that is meant to have a capital in it.
    if (RUN_TOGETHER_OK.has(match) || /[./@]/.test(whole[offset - 1] ?? "")) {
      return match;
    }

    changes?.push(`${match} → ${left} ${right}`);
    return `${left} ${right}`;
  });

  return lexicon ? rehyphenate(out, lexicon, changes) : out;
}

// ── Structure ──────────────────────────────────────────────────────────────────────

function titleWords(title) {
  return String(title).trim().split(/\s+/).filter(Boolean);
}

/**
 * A "chapter" whose title is really a line of the prose before it or after it: the
 * extractor took a bold or oversized line for a heading. Real headings here are numbered,
 * or open with a word the booklets use for a section, or are short unpunctuated phrases.
 */
function strayKind(chapter, previous) {
  const title = String(chapter.title).trim();

  if (chapter.frontMatter || STRUCTURAL.test(title) === true) {
    // "CHAPTER 14" printed again over a page break, with nothing after the number.
    const dup = title.match(/^(?:chapter|movement|part)\s+(\d{1,2})$/i);
    const before = String(previous?.title ?? "").match(/^(?:chapter|movement|part)\s+(\d{1,2})\b/i);

    return dup && before && dup[1] === before[1] ? "continuation" : null;
  }

  if (/^[a-zà-ÿāīūṛṝḷṅñṭḍṇśṣḥṃ]/.test(title)) {
    return "continuation";
  }

  if (/[.!?…]["'”’)]?$/.test(title) && titleWords(title).length >= 2) {
    return "sentence";
  }

  return null;
}

/** Whether a paragraph stops without ending its sentence. */
function unfinished(paragraph) {
  return !/[.!?…]["'”’)]*\s*$/.test(String(paragraph).trim());
}

function mergeInto(previous, chapter, mode) {
  const paragraphs = [...previous.paragraphs];
  const incoming = [...chapter.paragraphs];

  if (mode === "continuation") {
    // The title is the middle of a sentence the page break cut in two.
    const words = /^(?:chapter|movement|part)\s+\d/i.test(chapter.title) ? "" : String(chapter.title).trim();
    const last = paragraphs.length ? paragraphs.pop() : "";
    const joined = [last, words].filter(Boolean).join(" ");

    if (unfinished(joined) && incoming.length) {
      paragraphs.push(`${joined} ${incoming.shift()}`.trim());
    } else if (joined) {
      paragraphs.push(joined);
    }
  } else {
    // A pull-quote or a sentence the page set as a heading: prose, in its own paragraph.
    paragraphs.push(String(chapter.title).trim());
  }

  return {
    ...previous,
    paragraphs: [...paragraphs, ...incoming],
    ...(chapter.images?.length
      ? { images: [...(previous.images ?? []), ...chapter.images] }
      : {}),
    ...(chapter.endPage ? { endPage: chapter.endPage } : {})
  };
}

/**
 * Takes the section heading off the end of a paragraph, and remembers which it was so the
 * chapter that follows can carry it as its kicker.
 */
function takeTrailingHeading(chapter) {
  const paragraphs = [...chapter.paragraphs];
  const lastIndex = paragraphs.length - 1;
  let leaked = null;

  if (lastIndex >= 0) {
    const match = paragraphs[lastIndex].match(TRAILING_HEADING);

    if (match) {
      leaked = match[1].toUpperCase();
      paragraphs[lastIndex] = paragraphs[lastIndex].replace(TRAILING_HEADING, "").trim();

      if (!paragraphs[lastIndex]) {
        paragraphs.pop();
      }
    }
  }

  return { chapter: { ...chapter, paragraphs }, leaked };
}

/**
 * A run of paragraphs that is a leaked contents list `stripContents` cannot see, because
 * there is no "Contents" heading anywhere near it to anchor on — the PDF's own two-column
 * contents page (each entry giving its meter and a one-line gist) simply continues past
 * where the Author's Note ends, with no marker between the two. General detection risks
 * real prose: a reflective paragraph can legitimately name two or three of a booklet's own
 * chapters in passing (confirmed against the corpus — one does, elsewhere). So this is
 * matched the same way as MEASURED_TEXT and TABLES: by where a specific booklet's specific
 * run of debris starts, verified against its source. Everything in the chapter from the
 * first paragraph starting this way onward is the leak, through the end of the chapter.
 */
const LEAKED_CONTENTS_RUNS = [
  { booklet: "booklet-six", startsWith: "1. 1. The First Cry" },
  // This one does carry a literal "CONTENTS" heading, but stripContents's listing() count
  // requires matching this booklet's own chapter titles — which are bare numbers ("1.",
  // "2."), not the "Stanza 1", "Stanza 2" the contents page actually lists them as, so the
  // match never clears its threshold.
  { booklet: "booklet-eight", startsWith: "CONTENTS" }
];

function stripLeakedContentsRun(booklet, chapter, changes) {
  // Matched on the booklet and the debris's own distinctive opening text, not the
  // chapter's position — a stray-heading merge earlier in the same pass can shift which
  // chapter carries a given number, but this exact run only ever starts one way.
  const run = LEAKED_CONTENTS_RUNS.find((candidate) => candidate.booklet === booklet.slug);
  const at = run ? chapter.paragraphs.findIndex((paragraph) => paragraph.startsWith(run.startsWith)) : -1;

  if (at === -1) {
    return chapter.paragraphs;
  }

  changes?.push(`leaked contents list removed: ${chapter.paragraphs.length - at} paragraphs from "${run.startsWith}"`);

  return chapter.paragraphs.slice(0, at);
}

/**
 * The Inward Mirror booklets end with a back cover — "Booklet 2 of seven · The Inward Mirror
 * Series Sasidhar Valluru", a one-line tagline, then "THE INWARD MIRROR SERIES · TITLE ·
 * TheValluru.org" — which the extractor read as three more paragraphs of the closing chapter,
 * splitting the epilogue's last line from the rest. Printed furniture, not text: everything
 * from that first line to the end of the chapter goes. The opening line is specific enough
 * to match in any booklet.
 */
const BACK_COVER = /^Booklet\s+\d+\s+of\s+\w+\s+·\s+The Inward Mirror Series\b/;

function stripBackCover(chapter, paragraphs, changes) {
  const at = paragraphs.findIndex((paragraph) => BACK_COVER.test(paragraph));

  if (at === -1) {
    return paragraphs;
  }

  changes?.push(`${chapter.title}: back cover removed (${paragraphs.length - at} paragraphs)`);

  return paragraphs.slice(0, at);
}

/** The contents list the extractor left at the foot of the Author's Note. */
function stripContents(paragraphs, chapterTitles, log) {
  const titles = chapterTitles
    .map((title) => title.replace(/^(?:chapter\s+)?\d+[.\s]\s*/i, "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter(Boolean);
  const listing = (text) => {
    const flat = text.replace(/\s+/g, " ").toLowerCase();

    return titles.filter((title) => flat.includes(title)).length;
  };
  const out = [];
  let afterHeading = false;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (/^contents$/i.test(trimmed)) {
      afterHeading = true;
      log?.push("contents heading removed");
      continue;
    }

    // The list itself, as a paragraph of its own under a bare "Contents".
    if (afterHeading && listing(trimmed) >= 3) {
      afterHeading = false;
      log?.push("contents list removed");
      continue;
    }

    afterHeading = false;

    const at = trimmed.search(/\bContents\b(?=\s|$)/);

    if (at === -1) {
      out.push(paragraph);
      continue;
    }

    const tail = trimmed.slice(at + "Contents".length).trim();

    // Bare "Contents" at the end, or "Contents" followed by the booklet's own chapter list.
    if (!tail || listing(tail) >= 3) {
      const before = trimmed.slice(0, at).trim();

      log?.push(tail ? "contents list removed from the end of a paragraph" : "contents heading removed");

      if (before) {
        out.push(before);
      }

      afterHeading = !tail;
    } else {
      out.push(paragraph);
    }
  }

  return out;
}

// ── Tables ─────────────────────────────────────────────────────────────────────────

const TABLE_MARKER = "[[table]]";

/**
 * Tables the PDFs print whose cells the text layer flattens into one run of words, so the
 * columns cannot be recovered by rule. The rows are the printed page's, and `start` is the
 * text the flattened run opens with, so a booklet that is re-extracted differently still
 * matches on what it says rather than where it sits.
 */
const TABLES = [
  {
    // "15. The Gist", pages 22–23; the header repeats where the table breaks over the page.
    booklet: "booklet-one",
    start: "Spiritual danger it Text / Axis Entry-point Main movement corrects",
    rows: [
      ["Text / Axis", "Entry-point", "Main movement", "Spiritual danger it corrects"],
      ["Gita", "Arjuna’s collapse in duty", "From paralysis to disciplined alignment", "“I can escape action because action is difficult.”"],
      ["Rāma-Jābāli", "A clever argument against costly dharma", "From convenience to vow", "“Truth changes because opinion changes.”"],
      ["Tripura Rahasya", "Paraśurāma’s existential collapse", "From power, violence, pride to inquiry into Consciousness", "“I can conquer my way to truth.”"],
      ["Nirguna-Saguna-Guṇa", "The need to understand manifestation properly", "From childish theology to mature recognition of Śakti and guṇa-play", "“Divine beings and great beings must behave like flat moral diagrams.”"],
      ["Samvartaka", "Righteousness confronting envy and hierarchy", "From social dependence to terrifying inner freedom", "“High office means freedom from envy.”"],
      ["Vijñāna Bhairava Tantra", "Devi’s refined doubt", "From doctrine to direct experiential recognition", "“I understand the teaching, therefore I know.”"],
      ["Bhagavatam", "Vyāsa’s dissatisfaction; Parīkṣit’s death sentence", "From knowledge, duty, and mortality to loving surrender", "“I can finish the journey through knowledge alone.”"],
      ["Rāvaṇa Brahma and the great complex beings", "Power and knowledge under asura-aṁśa, curse, ego, and māyā", "From cartoon morality to discriminating reverence", "“If someone falls, nothing in him was great.”"],
      ["Harishchandra test", "Truth when gods, gurus, and consolations fall silent", "From conditional faith to dharma under fire", "“Surrender means I will always receive a visible happy ending.”"]
    ]
  },
  {
    booklet: "booklet-one",
    start: "Yoga / Marga What it re-aligns",
    rows: [
      ["Yoga / Marga", "What it re-aligns"],
      ["Karma Yoga", "Action is offered; duty is performed without egoic ownership of results."],
      ["Jñāna Yoga", "Understanding is purified; the seeker discriminates between the Self and the non-Self."],
      ["Bhakti Yoga", "The heart is anchored in love, remembrance, worship, and dependence on Bhagavan."],
      ["Dhyāna Yoga", "Attention is disciplined; the restless mind is brought into stillness."],
      ["Abhyāsa Yoga", "Repeated effort is sanctified; the mind is brought back again and again."],
      ["Vairāgya", "False dependence is weakened; craving and possessiveness lose authority."],
      [
        "Sannyāsa",
        "Egoic doership is renounced; not merely external retirement, but inner dropping of “I am the actor.”"
      ],
      ["Tyāga / Nyāsa", "Ownership of action and fruit is surrendered; the burden is placed at Bhagavan’s feet."],
      ["Śaraṇāgati / Prapatti", "The whole being takes refuge; “I am Yours” becomes the deepest truth of the seeker."]
    ]
  }
];

/**
 * Text pdf.js's own text layer gets wrong before any of the code above ever sees it — a
 * second, broken embedded font used only for these small italic captions, decoding some
 * glyphs to the wrong Unicode codepoint (stray Latin letters, combining marks, reordered
 * aksharas). Confirmed against the rendered page, not the text layer: the same "Meter:"
 * line reads correctly wherever the glyph outlines are drawn, so what is wrong is the
 * text layer's mapping, not the printed page. No rule recovers this — the fix is reading
 * the page and writing down what it says, the same as TABLES above.
 */
const MEASURED_TEXT = [
  { booklet: "booklet-nine", from: "łకంద పద̇కం / Kanda Padyam", to: "కంద పద్యం / Kanda Padyam" },
  { booklet: "booklet-nine", from: "łకంద పద̇మాలిł ధో రణి", to: "కంద పద్యమాలిక ధోరణి" },
  { booklet: "booklet-nine", from: "శాłక్త / ƱకంǕత్రిł ʛక్తőత్ర ధో రణి", to: "శాక్త / తాంత్రిక స్తోత్ర ధోరణి" },
  { booklet: "booklet-nine", from: "వచనపద̇ ధో రణి", to: "వచనపద్య ధోరణి" },
  { booklet: "booklet-nine", from: "łకంద ధో రణి", to: "కంద ధోరణి" },
  { booklet: "booklet-nine", from: "చకంపłమాల", to: "చంపకమాల" },
  { booklet: "booklet-nine", from: "ఉőత్పలమాల", to: "ఉత్పలమాల" },
  { booklet: "booklet-nine", from: "మɁక్తభవిǪత్రడిőము", to: "మత్తేభవిక్రీడితము" },
  { booklet: "booklet-nine", from: "łకంద పద̇కం", to: "కంద పద్యం" },
  { booklet: "booklet-nine", from: "శారūర్దూలవిǪత్రడిőము", to: "శార్దూలవిక్రీడితము" },
  { booklet: "booklet-six", from: "మĲత్తేభవిÓక్రీడితము", to: "మత్తేభవిక్రీడితము" },
  { booklet: "booklet-six", from: "తంßడ్రీ", to: "తండ్రీ" },
  { booklet: "booklet-six", from: "అనన్నేం", to: "అన్నం" },
  { booklet: "booklet-six", from: "నలె్లుదు్దమీద యముడు", to: "నల్లెద్దుమీద యముడు" },
  { booklet: "booklet-six", from: "కనురెపక్పావలె", to: "కనురెప్పవలె" }
];

/**
 * A verse is the paragraph after a "Meter:" line. Replaces each verse with what the page
 * prints, by position, so it only runs when the booklet still has exactly as many verses as
 * were transcribed; any other count means the extraction changed shape and guessing which
 * verse is which would be worse than leaving the text alone. Safe to run twice.
 */
function restoreTranscribedVerses(booklet, chapters, changes) {
  const verses = TRANSCRIBED_VERSES[booklet.slug];

  if (!verses) {
    return chapters;
  }

  const slots = [];

  // The verse is the paragraph just before "Meaning", so a caption already restored above it
  // is never mistaken for the verse on a second run.
  chapters.forEach((chapter, chapterIndex) =>
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      if (!/^Meter:/.test(paragraph)) {
        return;
      }

      const meaning = chapter.paragraphs.findIndex(
        (candidate, index) => index > paragraphIndex && /^Meaning\b/.test(candidate)
      );

      if (meaning > paragraphIndex + 1) {
        slots.push({ chapterIndex, paragraphIndex: meaning - 1 });
      }
    })
  );

  if (slots.length !== verses.length) {
    changes?.push(`verses NOT restored: found ${slots.length} verses, ${verses.length} transcribed`);
    return chapters;
  }

  const out = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  let restored = 0;

  for (let n = slots.length - 1; n >= 0; n -= 1) {
    const { chapterIndex, paragraphIndex } = slots[n];
    const paragraphs = out[chapterIndex].paragraphs;
    const entry = verses[n];
    const verse = Array.isArray(entry) ? entry[entry.length - 1] : entry;
    const captions = Array.isArray(entry) ? entry.slice(0, -1) : [];

    if (paragraphs[paragraphIndex] !== verse) {
      paragraphs[paragraphIndex] = verse;
      restored += 1;
    }

    for (let c = captions.length - 1; c >= 0; c -= 1) {
      if (paragraphs[paragraphIndex - (captions.length - c)] !== captions[c]) {
        paragraphs.splice(paragraphIndex, 0, captions[c]);
      }
    }
  }

  if (restored) {
    changes?.push(`verses restored from the printed page: ${restored} of ${verses.length}`);
  }

  return out;
}

function restoreMeasuredText(booklet, text, changes) {
  let out = text;

  for (const fix of MEASURED_TEXT) {
    if (fix.booklet === booklet.slug && out.includes(fix.from)) {
      out = out.split(fix.from).join(fix.to);
      changes?.push(`measured text restored: "${fix.from}" → "${fix.to}"`);
    }
  }

  return out;
}

/**
 * Puts back Telugu passages the text layer damaged, wherever they sit in a chapter. An entry
 * matches only an exact run of the damaged paragraphs, so it cannot touch anything else. A
 * passage already restored is skipped quietly; one that is neither damaged nor restored is
 * reported, since it means a re-extraction changed what the entry was read against.
 */
function restoreTranscribedPassages(booklet, chapters, changes) {
  const entries = TRANSCRIBED_PASSAGES.filter((entry) => entry.booklet === booklet.slug);

  if (!entries.length) {
    return chapters;
  }

  const out = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  const runAt = (paragraphs, run) => {
    for (let i = 0; i + run.length <= paragraphs.length; i += 1) {
      if (run.every((paragraph, k) => paragraphs[i + k] === paragraph)) {
        return i;
      }
    }

    return -1;
  };
  let restored = 0;

  for (const entry of entries) {
    let done = false;

    for (const chapter of out) {
      const at = runAt(chapter.paragraphs, entry.from);

      if (at !== -1) {
        chapter.paragraphs.splice(at, entry.from.length, ...entry.to);
        restored += 1;
        done = true;
        break;
      }
    }

    if (!done && !out.some((chapter) => runAt(chapter.paragraphs, entry.to) !== -1)) {
      changes?.push(`passage NOT restored (no match): ${entry.to[0].slice(0, 40)}`);
    }
  }

  if (restored) {
    changes?.push(`Telugu passages restored from the printed pages: ${restored} of ${entries.length}`);
  }

  return out;
}

const SPACED_MEANING = /^M\s?E\s?A\s?N\s?I\s?N\s?G\b/;
const SPACED_BHAVAM = "భా వ ము";

/**
 * Booklet nine: every Telugu line, Telugu note and Telugu subtitle. A poem chapter is its
 * Meter line, then each Telugu line with its Roman transliteration beneath, then (in some
 * chapters) the భావము note, up to the English "MEANING". A Notes chapter is the భావము alone.
 * The chapter is found by the English start of its title, which the damage never touches;
 * everything between the Meter line (or the భావము label) and "MEANING" is rebuilt, so it is
 * safe to run twice. The cover chapter's contents list takes the same Telugu subtitles.
 */
function restoreTranscribedBookletNine(booklet, chapters, changes) {
  if (booklet.slug !== "booklet-nine") {
    return chapters;
  }

  const out = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  const used = new Set();
  let rebuilt = 0;

  for (const entry of TRANSCRIBED_BOOKLET_NINE) {
    const at = out.findIndex((chapter, index) => !used.has(index) && String(chapter.title).startsWith(entry.key));

    if (at === -1) {
      changes?.push(`booklet nine chapter NOT found: ${entry.key}`);
      continue;
    }

    used.add(at);
    const chapter = out[at];
    const paragraphs = chapter.paragraphs;
    const end = paragraphs.findIndex((paragraph) => SPACED_MEANING.test(paragraph));
    const tail = end === -1 ? [] : paragraphs.slice(end);
    let head;
    let body;

    if (entry.lines.length) {
      const meter = paragraphs.findIndex((paragraph) => /^Meter:/.test(paragraph));

      if (meter === -1) {
        changes?.push(`booklet nine: no Meter line in ${entry.key}`);
        continue;
      }

      head = paragraphs.slice(0, meter + 1);
      body = entry.lines.flat();

      if (entry.bhavam) {
        body.push(`${SPACED_BHAVAM} ${entry.bhavam}`);
      }
    } else {
      const label = paragraphs.findIndex((paragraph) => /^భా\s?వ\s?ము/.test(paragraph));

      if (label === -1) {
        changes?.push(`booklet nine: no భావము in ${entry.key}`);
        continue;
      }

      head = paragraphs.slice(0, label);
      body = [SPACED_BHAVAM, entry.bhavam];
    }

    const next = [...head, ...body, ...tail];

    if (JSON.stringify(next) !== JSON.stringify(paragraphs) || chapter.title !== entry.title) {
      chapter.paragraphs = next;
      chapter.title = entry.title;
      rebuilt += 1;
    }
  }

  // "3. 3. Kannikattu — <damaged>" on the cover chapter's contents list.
  for (const chapter of out) {
    chapter.paragraphs = chapter.paragraphs.map((paragraph) => {
      const listed = paragraph.match(/^(\d+)\. \1\. (.+?) — /);
      const entry = listed && TRANSCRIBED_BOOKLET_NINE.find((candidate) => candidate.title.startsWith(`${listed[1]}. `) && !/Notes$/.test(candidate.key));
      const telugu = entry && entry.title.slice(entry.key.length).trim();

      if (!telugu) {
        return paragraph;
      }

      const next = `${listed[1]}. ${listed[1]}. ${listed[2]} — ${telugu}`;

      if (next !== paragraph) {
        rebuilt += 1;
      }

      return next;
    });
  }

  if (rebuilt) {
    changes?.push(`booklet nine Telugu restored from the printed pages: ${rebuilt} chapters/contents lines rebuilt`);
  }

  return out;
}

const VERSE_SECTION_LABEL = "పద్యం —";
const COMMENTARY_START = /(^|\s)(AUTHOR CONTEXT|MEANING)\b/;

/**
 * Booklet seven: 25 verse-sections, each a Telugu label ("పద్యం — <meter>"), the verse, a METER
 * line and the భావము, followed by the English Author Context and Meaning. A section's Telugu
 * is everything from its label up to the first paragraph that opens (or, where a page break
 * fused them, contains) "AUTHOR CONTEXT" or "MEANING"; that stretch is replaced wholesale, and
 * the English from that point on is kept exactly as stored. Sections are matched by order, and
 * only when exactly as many labels are found as were transcribed. Then the damaged Telugu
 * phrases quoted inside the English commentary are replaced one by one. Safe to run twice.
 */
function restoreTranscribedBookletSeven(booklet, chapters, changes) {
  if (booklet.slug !== "booklet-seven") {
    return chapters;
  }

  const sections = TRANSCRIBED_BOOKLET_SEVEN;
  const out = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  const found = [];

  out.forEach((chapter, chapterIndex) =>
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      if (paragraph.startsWith(VERSE_SECTION_LABEL)) {
        found.push({ chapterIndex, paragraphIndex });
      }
    })
  );

  let rebuilt = 0;

  if (found.length === sections.length) {
    // Back to front, so an earlier splice never moves a later section's position.
    for (let n = found.length - 1; n >= 0; n -= 1) {
      const { chapterIndex, paragraphIndex } = found[n];
      const section = sections[n];
      const paragraphs = out[chapterIndex].paragraphs;
      let end = paragraphIndex + 1;

      while (end < paragraphs.length && !COMMENTARY_START.test(paragraphs[end])) {
        end += 1;
      }

      if (end >= paragraphs.length) {
        changes?.push(`booklet seven section ${n + 1}: no commentary found, left alone`);
        continue;
      }

      const fused = paragraphs[end].match(COMMENTARY_START);
      const tail = fused && fused.index > 0 ? [paragraphs[end].slice(fused.index).trim()] : [paragraphs[end]];
      const [first, ...more] = section.bhavam;
      const next = [
        section.label,
        ...section.lines,
        `METER ${section.meter}`,
        ...(first ? [`భావము ${first}`, ...more] : [])
      ];
      const before = paragraphs.slice(paragraphIndex, end + 1);
      const after = [...next, ...tail];

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        paragraphs.splice(paragraphIndex, end - paragraphIndex + 1, ...after);
        rebuilt += 1;
      }
    }
  } else {
    changes?.push(`booklet seven verses NOT restored: found ${found.length} sections, ${sections.length} transcribed`);
  }

  let fixed = 0;

  for (const chapter of out) {
    chapter.paragraphs = chapter.paragraphs.map((paragraph) => {
      let text = paragraph;

      for (const [from, to] of BOOKLET_SEVEN_FIXES) {
        if (text.includes(from)) {
          text = text.split(from).join(to);
          fixed += 1;
        }
      }

      return text;
    });
  }

  if (rebuilt || fixed) {
    changes?.push(`booklet seven Telugu restored from the printed pages: ${rebuilt} sections rebuilt, ${fixed} phrases fixed`);
  }

  return out;
}

/**
 * Chapter titles extraction got wrong. "STANZA 1 Stanza 1" is the kicker and the heading of
 * the same stanza read as one line. Booklet six's chapter 22 heading wraps after "Śānta-" and
 * the second line, "Tarka", was lost (checked against the PDF, page 33 and the contents).
 */
const TITLE_FIXES = [
  { booklet: "booklet-six", from: "22. Kāśī Gurus and Śānta-", to: "22. Kāśī Gurus and Śānta-Tarka" }
];

function repairTitles(booklet, chapters, changes) {
  return chapters.map((chapter) => {
    const title = String(chapter.title || "");
    const doubled = title.match(/^STANZA (\d{1,2}) (Stanza \1)$/);
    const fix = TITLE_FIXES.find((candidate) => candidate.booklet === booklet.slug && candidate.from === title);
    const next = doubled ? doubled[2] : fix ? fix.to : title;

    if (next === title) {
      return chapter;
    }

    changes?.push(`title "${title}" → "${next}"`);
    return { ...chapter, title: next };
  });
}

/**
 * Sections the extraction left inside a neighbouring chapter because their headings were set
 * smaller than a chapter title: booklet seven's 25 verse-sections ("5 I Am Not Arjuna"
 * inside "4 …") and booklet six's 12A–12E inside "11. …". Left merged, the contents list
 * skips them and the gate's "N more chapters" undercounts. Each heading, when the line after
 * it opens a verse, starts a chapter of its own, which keeps its parent's free/gated flag.
 */
const SECTION_SPLITS = [
  { booklet: "booklet-seven", heading: /^\d{1,2} \S.{1,80}$/u, opens: /^పద్యం —/u },
  { booklet: "booklet-six", heading: /^12[A-E]\. \S.{1,80}$/u, opens: /^Meter:/ }
];

function splitEmbeddedSections(booklet, chapters, changes) {
  const rule = SECTION_SPLITS.find((candidate) => candidate.booklet === booklet.slug);

  if (!rule) {
    return chapters;
  }

  const out = [];
  let made = 0;

  for (const chapter of chapters) {
    const paragraphs = chapter.paragraphs || [];
    let current = { ...chapter, paragraphs: [] };
    let part = 0;

    paragraphs.forEach((paragraph, index) => {
      const next = paragraphs[index + 1] || "";

      if (index > 0 && rule.heading.test(paragraph) && rule.opens.test(next)) {
        out.push(current);
        part += 1;
        made += 1;
        current = {
          id: `${chapter.id}-${part}`,
          title: paragraph,
          paragraphs: [],
          ...(typeof chapter.free === "boolean" ? { free: chapter.free } : {})
        };
        return;
      }

      current.paragraphs.push(paragraph);
    });

    out.push(current);
  }

  if (made) {
    changes?.push(`sections split into their own chapters: ${made}`);
  }

  return out;
}

/**
 * An Author's Note that extraction ran into a front-matter chapter the reader hides as the
 * cover or credits page (booklet seven's cover; booklet thirteen's credits page, where the
 * heading is glued to "© … All rights reserved."). The note is moved into a chapter of its own
 * so it is read and listed. Only when the booklet has no Author's Note chapter already.
 */
const AUTHORS_NOTE_HEADING = /(^|\s)AUTHOR[’']S NOTE$/;
const isAuthorsNoteTitle = (title) => /^author[’']?s note$/i.test(String(title || "").trim());

function splitBuriedAuthorsNote(booklet, chapters, changes) {
  if (chapters.some((chapter) => isAuthorsNoteTitle(chapter.title))) {
    return chapters;
  }

  const out = [];
  let moved = false;

  for (const chapter of chapters) {
    const paragraphs = chapter.paragraphs || [];
    const at = chapter.frontMatter && !moved ? paragraphs.findIndex((paragraph) => AUTHORS_NOTE_HEADING.test(paragraph)) : -1;

    if (at === -1 || at === paragraphs.length - 1) {
      out.push(chapter);
      continue;
    }

    const before = paragraphs[at].replace(AUTHORS_NOTE_HEADING, "").trim();
    out.push({ ...chapter, paragraphs: [...paragraphs.slice(0, at), ...(before ? [before] : [])] });
    out.push({
      id: `${chapter.id}-note`,
      title: "Author’s Note",
      frontMatter: true,
      free: true,
      paragraphs: paragraphs.slice(at + 1)
    });
    moved = true;
    changes?.push(`${chapter.title}: Author’s Note moved into its own chapter`);
  }

  return out;
}

/**
 * A printed contents page left at the foot of a front-matter chapter: a run of entries that
 * each end in a page number ("3. Memory Before Memory 15", the last one often dragging the
 * next page's "OPENING" with it), the contents page's own title line, and a "CONTENTS" glued
 * to the sentence before. Four or more such lines at the very end of front matter is a
 * contents page; prose does not end that way.
 */
const CONTENTS_ENTRY = /\s\d{1,3}(?:\s+OPENING)?$/;

function stripTrailingContents(booklet, chapter, changes) {
  const paragraphs = chapter.paragraphs || [];

  if (!chapter.frontMatter) {
    return paragraphs;
  }

  let start = paragraphs.length;

  while (start > 0 && CONTENTS_ENTRY.test(paragraphs[start - 1])) {
    start -= 1;
  }

  if (paragraphs.length - start < 4) {
    return paragraphs;
  }

  const plain = (text) => String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

  if (start > 0 && plain(paragraphs[start - 1]) === plain(booklet.title)) {
    start -= 1;
  }

  if (start > 0 && /^contents$/i.test(paragraphs[start - 1].trim())) {
    start -= 1;
  }

  const kept = paragraphs.slice(0, start);

  if (kept.length) {
    kept[kept.length - 1] = kept[kept.length - 1].replace(/\s+CONTENTS$/, "");
  }

  changes?.push(`${chapter.title}: printed contents list removed (${paragraphs.length - start} lines)`);

  return kept;
}

/** The English after each " — " in a word-by-word paragraph, up to where the next entry's own headword starts. */
function englishGlosses(wordByWord) {
  return wordByWord
    .split(" — ")
    .slice(1)
    .map((part) => {
      // A token holding any Indic letter starts the next entry, even one the damage prefixed
      // with a stray symbol ("´దంబరేశ").
      const next = part.search(/\s\S*[ఀ-౿ऀ-ॿ]/);
      return (next === -1 ? part : part.slice(0, next)).trim();
    });
}

/**
 * Booklet eight sets each stanza as Telugu beside its Devanagari transcription, then again
 * with a word-by-word gloss. Extraction scattered the Devanagari of stanzas 1–4, 5–8 and 9–12
 * into whichever chapter happened to follow them, and damaged every Telugu and Devanagari
 * word. Each numbered chapter becomes [Telugu, Devanagari]; each stanza's study chapter keeps
 * its English gloss and Bhāvam as extracted and takes the transcribed headwords; the
 * Phalaśruti carries its Devanagari too. Only runs on the exact shape it was read from — eleven
 * numbered chapters, eleven stanza chapters and a Phalaśruti — and is safe to run twice.
 */
function restoreTranscribedStanzas(booklet, chapters, changes) {
  const stanzas = TRANSCRIBED_STANZAS[booklet.slug];

  if (!stanzas) {
    return chapters;
  }

  const numbered = [];
  const studies = [];
  let phalasruti = -1;

  chapters.forEach((chapter, index) => {
    const title = String(chapter.title).trim();

    if (/^\d{1,2}\.$/.test(title)) {
      numbered.push(index);
    } else if (/^stanza\s+\d+/i.test(title)) {
      studies.push(index);
    } else if (/^phala[śs]ruti$/i.test(title)) {
      phalasruti = index;
    }
  });

  const stanzaCount = stanzas.length - 1;

  if (numbered.length !== stanzaCount || studies.length !== stanzaCount || phalasruti === -1) {
    changes?.push(
      `stanzas NOT restored: found ${numbered.length} numbered, ${studies.length} study chapters, phalaśruti ${phalasruti !== -1}`
    );
    return chapters;
  }

  const out = chapters.map((chapter) => ({ ...chapter, paragraphs: [...chapter.paragraphs] }));
  let restored = 0;

  const rebuildStudy = (index, stanza, withDevanagari) => {
    const paragraphs = out[index].paragraphs;
    const at = paragraphs.findIndex((paragraph) => paragraph.startsWith("WORD-BY-WORD"));
    // In two stanzas the Bhāvam ran on from the last gloss instead of starting its own paragraph.
    const bhavam = at === -1 ? -1 : paragraphs[at].search(/\s+BHĀVAM \/ INNER SENSE\b/);
    const runOn = bhavam === -1 ? [] : [paragraphs[at].slice(bhavam).trim()];
    const english = at === -1 ? [] : englishGlosses(bhavam === -1 ? paragraphs[at] : paragraphs[at].slice(0, bhavam));

    if (english.length !== stanza.words.length) {
      changes?.push(`${out[index].title}: word-by-word NOT restored (${english.length} glosses, ${stanza.words.length} headwords)`);
      return;
    }

    const wordByWord = `WORD-BY-WORD ${stanza.words.map(([te, dv], i) => `${te} (${dv}) — ${english[i]}`).join(" ")}`;
    const rest = [...runOn, ...paragraphs.slice(at + 1)].map((paragraph) => paragraph.replace(/\s+PHALAŚRUTI$/, ""));
    const next = [stanza.te, ...(withDevanagari ? [stanza.dv] : []), wordByWord, ...rest];

    if (JSON.stringify(next) !== JSON.stringify(paragraphs)) {
      out[index].paragraphs = next;
      restored += 1;
    }
  };

  numbered.forEach((index, n) => {
    const next = [stanzas[n].te, stanzas[n].dv];

    if (JSON.stringify(next) !== JSON.stringify(out[index].paragraphs)) {
      out[index].paragraphs = next;
      restored += 1;
    }
  });
  studies.forEach((index, n) => rebuildStudy(index, stanzas[n], false));
  rebuildStudy(phalasruti, stanzas[stanzaCount], true);

  if (restored) {
    changes?.push(`stanzas restored from the printed pages: ${restored} chapters rebuilt`);
  }

  return out;
}

function restoreTables(booklet, paragraphs, changes) {
  const out = [];

  for (const paragraph of paragraphs) {
    const table = TABLES.find(
      (candidate) =>
        candidate.booklet === booklet.slug && paragraph.includes(candidate.start) && !paragraph.startsWith(TABLE_MARKER)
    );

    if (!table) {
      out.push(paragraph);
      continue;
    }

    const before = paragraph.slice(0, paragraph.indexOf(table.start)).trim();

    if (before) {
      out.push(before);
    }

    out.push(`${TABLE_MARKER}\n${table.rows.map((row) => row.join(" | ")).join("\n")}`);
    changes?.push(`table restored: ${table.rows.length - 1} rows`);
  }

  return out;
}

// ── One booklet ────────────────────────────────────────────────────────────────────

/**
 * @param booklet a booklet with `chapters`
 * @param lexicon from buildLexicon over every booklet's text
 * @returns the cleaned booklet and a log of what changed
 */
export function cleanBooklet(booklet, lexicon) {
  const log = [];
  const source = Array.isArray(booklet.chapters) ? booklet.chapters : [];

  if (!source.length) {
    return { booklet, log };
  }

  // 1. Furniture and leaked headings, per chapter.
  let leakedForNext = null;
  const stripped = [];

  for (const original of source) {
    const cleaned = {
      ...original,
      paragraphs: withoutRunningHeadParagraphs(original.paragraphs || [])
        .map((paragraph) =>
          paragraph.replace(RUNNING_HEAD, " ").replace(END_MARK, "").replace(/\s{2,}/g, " ").trim()
        )
        .filter(Boolean)
    };

    if (cleaned.paragraphs.join("") !== (original.paragraphs || []).join("")) {
      log.push(`${original.title}: running head / end mark removed`);
    }

    const { chapter, leaked } = takeTrailingHeading(cleaned);

    if (leaked) {
      log.push(`${original.title}: trailing "${leaked}" removed`);
    }

    stripped.push({ chapter, leakedBefore: leakedForNext, leaked });
    leakedForNext = leaked && HEADING_KICKER.has(leaked) ? leaked : null;
  }

  // 2. Lines the extractor took for chapters.
  const chapters = [];
  let carried = null;

  for (const { chapter, leakedBefore, leaked } of stripped) {
    const previous = chapters[chapters.length - 1];
    let current = chapter;
    const kind = previous ? strayKind(current, previous) : null;

    if (kind && previous) {
      if (kind === "sentence" && leakedBefore) {
        // "THE GIST" ended the last chapter and the section's first sentence was taken for its
        // title: the section is real, it is only missing its name.
        current = {
          ...current,
          title: HEADING_KICKER.get(leakedBefore),
          paragraphs: [String(chapter.title).trim(), ...chapter.paragraphs]
        };
        log.push(`"${chapter.title}" restored as ${current.title}`);
      } else {
        chapters[chapters.length - 1] = mergeInto(previous, current, kind);
        log.push(`"${chapter.title}" merged into "${previous.title}" (${kind})`);
        carried = leaked && HEADING_KICKER.has(leaked) ? leaked : carried;
        continue;
      }
    } else if (leakedBefore === "EPILOGUE" && !/^epilogue/i.test(current.title)) {
      current = { ...current, title: `Epilogue: ${current.title}` };
      log.push(`"${chapter.title}" titled as the Epilogue`);
    } else if (carried === "EPILOGUE" && !/^epilogue/i.test(current.title)) {
      current = { ...current, title: `Epilogue: ${current.title}` };
      log.push(`"${chapter.title}" titled as the Epilogue`);
    }

    carried = null;
    chapters.push(current);
  }

  // 3. Text the PDF's own text layer got wrong; the Author's Note keeps no contents
  // list; tables become tables.
  const bodyTitles = chapters.filter((chapter) => !chapter.frontMatter).map((chapter) => chapter.title);
  const repaired = chapters.map((chapter) => {
    const paragraphs = restoreTables(
      booklet,
      stripContents(
        stripBackCover(chapter, stripLeakedContentsRun(booklet, chapter, log), log).map((paragraph) =>
          restoreMeasuredText(booklet, paragraph, log)
        ),
        bodyTitles,
        log
      ),
      log
    ).map((paragraph) => (paragraph.startsWith(TABLE_MARKER) ? paragraph : repairText(paragraph, lexicon, log)));

    return {
      ...chapter,
      title: repairText(chapter.title, lexicon, log),
      paragraphs
    };
  });

  return {
    booklet: {
      ...booklet,
      // Numbered as they now stand, so a merge leaves no gap.
      chapters: repairTitles(booklet, splitEmbeddedSections(
        booklet,
        splitBuriedAuthorsNote(
          booklet,
          restoreTranscribedStanzas(
            booklet,
            restoreTranscribedBookletSeven(
              booklet,
              restoreTranscribedBookletNine(
                booklet,
                restoreTranscribedPassages(booklet, restoreTranscribedVerses(booklet, repaired, log), log),
                log
              ),
              log
            ),
            log
          ),
          log
        ).map((chapter) => ({ ...chapter, paragraphs: stripTrailingContents(booklet, chapter, log) })),
        log
      ), log).map((chapter, index) => ({
        ...chapter,
        number: index + 1
      }))
    },
    log
  };
}
