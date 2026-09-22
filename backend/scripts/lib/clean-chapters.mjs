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

  // 3. The Author's Note keeps no contents list; tables become tables.
  const bodyTitles = chapters.filter((chapter) => !chapter.frontMatter).map((chapter) => chapter.title);
  const repaired = chapters.map((chapter) => {
    const paragraphs = restoreTables(
      booklet,
      stripContents(chapter.paragraphs, bodyTitles, log),
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
      chapters: repaired.map((chapter, index) => ({ ...chapter, number: index + 1 }))
    },
    log
  };
}
