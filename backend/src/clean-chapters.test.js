const assert = require("node:assert/strict");
const { test } = require("node:test");

const load = () => import("../scripts/lib/clean-chapters.mjs");

function booklet(chapters, slug = "booklet-x") {
  return {
    slug,
    chapters: chapters.map((chapter, index) => ({
      id: `c${index + 1}`,
      number: index + 1,
      paragraphs: ["Text."],
      ...chapter
    }))
  };
}

test("a heading that is really the middle of a sentence is folded back", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      { title: "2. Strategy", paragraphs: ["One part may be dharma; one part fear; one"] },
      { title: "part love; one part pride; one part", paragraphs: ["genuine responsibility.", "Both understand strategy."] },
      { title: "3. Next", paragraphs: ["More."] }
    ]),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters.map((chapter) => chapter.title), ["2. Strategy", "3. Next"]);
  assert.equal(
    cleaned.chapters[0].paragraphs[0],
    "One part may be dharma; one part fear; one part love; one part pride; one part genuine responsibility."
  );
  assert.deepEqual(cleaned.chapters.map((chapter) => chapter.number), [1, 2]);
});

test("a duplicated CHAPTER heading over a page break is merged, not kept", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      { title: "CHAPTER 14 THE GIST", paragraphs: ["People mistake helpers."] },
      { title: "CHAPTER 14", paragraphs: ["And Bhagavan alone stands beyond."] }
    ]),
    buildLexicon([])
  );

  assert.equal(cleaned.chapters.length, 1);
  assert.deepEqual(cleaned.chapters[0].paragraphs, ["People mistake helpers.", "And Bhagavan alone stands beyond."]);
});

test("a section heading run onto the previous paragraph is lifted off and names the next chapter", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      { title: "CHAPTER 13 The Gist", paragraphs: ["Let the next work arrive. EPILOGUE"] },
      { title: "Before the Next Work Arrives", paragraphs: ["Text."] }
    ]),
    buildLexicon([])
  );

  assert.equal(cleaned.chapters[0].paragraphs[0], "Let the next work arrive.");
  assert.equal(cleaned.chapters[1].title, "Epilogue: Before the Next Work Arrives");
});

test("the running head, the end mark and a stray contents list are removed", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      { title: "Author's Note", frontMatter: true, paragraphs: ["A note. Contents Opening: Why 1. Alpha 2. Beta 3. Gamma"] },
      { title: "Opening: Why", paragraphs: ["Dependence with better lighting. Booklet Ten WHEN THE CHESSBOARD BURNS The Seeker and the Long Work of Bhagavān"] },
      { title: "1. Alpha", paragraphs: ["Text."] },
      { title: "2. Beta", paragraphs: ["Text."] },
      { title: "3. Gamma", paragraphs: ["Amen. End of Booklet One"] }
    ]),
    buildLexicon([])
  );

  assert.equal(cleaned.chapters[0].paragraphs[0], "A note.");
  assert.equal(cleaned.chapters[1].paragraphs[0], "Dependence with better lighting.");
  assert.equal(cleaned.chapters[4].paragraphs[0], "Amen.");
});

test("a running head fused onto real prose and spread over the paragraphs after it is removed, prose kept in order", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      {
        title: "1. The Chessboard We Build in the Head",
        paragraphs: [
          "The mind is efficient that way.",
          "Hopelessly efficient. Booklet Ten",
          "WHEN THE CHESSBOARD BURNS",
          "The Seeker and the Long Work of Bhagavān",
          "It can suffer in advance."
        ]
      }
    ]),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters[0].paragraphs, [
    "The mind is efficient that way.",
    "Hopelessly efficient.",
    "It can suffer in advance."
  ]);
});

test("a running head that cuts a sentence in two rejoins across the paragraphs it interrupted", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      {
        title: "1. Chapter",
        paragraphs: [
          "The strategist may look sharp and may build many Booklet Ten",
          "WHEN THE CHESSBOARD BURNS",
          "The Seeker and the Long Work of Bhagavān",
          "if-then branches before he ever speaks."
        ]
      }
    ]),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters[0].paragraphs, [
    "The strategist may look sharp and may build many if-then branches before he ever speaks."
  ]);
});

test("split and run-together words are repaired where the book itself shows the right form", async () => {
  const { buildLexicon, repairText } = await load();
  const lexicon = buildLexicon(["self-owned and self-ownership and reason and re-alignment", "the reason"]);

  assert.equal(repairText("we were selfowned", lexicon), "we were self-owned");
  assert.equal(repairText("Re- alignment of māyā- weapons", lexicon), "Re-alignment of māyā-weapons");
  assert.equal(repairText("RāvaṇaBrahma and worldTripura", lexicon), "Rāvaṇa Brahma and world Tripura");
  assert.equal(repairText("the thevalluru.org and WhatsApp", lexicon), "the thevalluru.org and WhatsApp");
  // Words the language spells solid stay solid.
  assert.equal(repairText("selfless selfhood nonsense", lexicon), "selfless selfhood nonsense");
});

test("the flattened yoga table becomes a table", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet(
      [{ title: "2. The Gita", paragraphs: ["They are toolkits. Yoga / Marga What it re-aligns Action is offered; duty is performed Karma Yoga without egoic ownership of results."] }],
      "booklet-one"
    ),
    buildLexicon([])
  );

  assert.equal(cleaned.chapters[0].paragraphs[0], "They are toolkits.");
  assert.ok(cleaned.chapters[0].paragraphs[1].startsWith("[[table]]\nYoga / Marga | What it re-aligns\nKarma Yoga | "));
  assert.equal(cleaned.chapters[0].paragraphs[1].split("\n").length, 11, "the marker, the header and nine rows");
});

test("a leaked contents run with no Contents heading to anchor on is stripped, scoped to its booklet", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet(
      [
        {
          title: "Author's Note",
          frontMatter: true,
          paragraphs: [
            "May grief return to the One who owns it.",
            "1. 1. The First Cry 14. 12C. Dwaraka Shores and the Ganga Ashes కందము - accusation.",
            "2. 2. Silence After the Storm 15. 12D. Barsana After Death కందము - presence mistaken."
          ]
        },
        { title: "1. Real Chapter", paragraphs: ["Text."] }
      ],
      "booklet-six"
    ),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters[0].paragraphs, ["May grief return to the One who owns it."]);
  assert.equal(cleaned.chapters[1].paragraphs[0], "Text.");

  // The same leaked opening line in a different booklet is not this booklet's leak.
  const { booklet: untouched } = cleanBooklet(
    booklet(
      [{ title: "Author's Note", frontMatter: true, paragraphs: ["A note.", "1. 1. The First Cry 14. 12C. Elsewhere"] }],
      "booklet-two"
    ),
    buildLexicon([])
  );

  assert.equal(untouched.chapters[0].paragraphs.length, 2);
});

test("a leaked CONTENTS block stripContents' title-matching misses is stripped for its booklet", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet(
      [
        {
          title: "AUTHOR’S NOTE",
          frontMatter: true,
          paragraphs: [
            "The poem begins with Rudra’s form and ends with the jīva turning Siva-facing through grief.",
            "CONTENTS",
            "Author’s Note Opening: When Grief Becomes Rhythm How to Read This Stotram 1 Stanza 1 2 Stanza 2"
          ]
        },
        { title: "1.", paragraphs: ["Verse."] }
      ],
      "booklet-eight"
    ),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters[0].paragraphs, [
    "The poem begins with Rudra’s form and ends with the jīva turning Siva-facing through grief."
  ]);
});

test("a meter label pdf.js's own text layer decoded wrong is restored, scoped to its booklet", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet(
      [{ title: "1. A Poem", paragraphs: ["Meter: łకంద పద̇కం / Kanda Padyam", "The verse follows."] }],
      "booklet-nine"
    ),
    buildLexicon([])
  );

  assert.equal(cleaned.chapters[0].paragraphs[0], "Meter: కంద పద్యం / Kanda Padyam");

  // The same corrupted text in a different booklet is not this booklet's font damage.
  const { booklet: untouched } = cleanBooklet(
    booklet([{ title: "1. A Poem", paragraphs: ["Meter: łకంద పద̇కం / Kanda Padyam"] }], "booklet-two"),
    buildLexicon([])
  );

  assert.equal(untouched.chapters[0].paragraphs[0], "Meter: łకంద పద̇కం / Kanda Padyam");
});

test("verses whose font was decoded wrong are replaced by the transcription, by position, and only when the count matches", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { TRANSCRIBED_VERSES } = await import("../scripts/lib/transcribed-verses.mjs");
  const verses = TRANSCRIBED_VERSES["booklet-six"];
  const damaged = () =>
    booklet(
      verses.map((_, index) => ({
        title: `${index + 1}. Poem`,
        paragraphs: ["Meter: మĲత్తేభవిÓక్రీడితము Bhāva: grief.", "నిĶన్నే కోరితి నæన్నేయ", "Meaning Father."]
      })),
      "booklet-six"
    );
  const { booklet: cleaned } = cleanBooklet(damaged(), buildLexicon([]));
  const verseOf = (chapter) => chapter.paragraphs[chapter.paragraphs.findIndex((p) => p.startsWith("Meaning")) - 1];
  const last = (entry) => (Array.isArray(entry) ? entry[entry.length - 1] : entry);

  assert.equal(cleaned.chapters.length, verses.length);
  cleaned.chapters.forEach((chapter, index) => assert.equal(verseOf(chapter), last(verses[index])));
  assert.equal(cleaned.chapters[0].paragraphs[0], "Meter: మత్తేభవిక్రీడితము Bhāva: grief.");

  // A caption the book prints above a verse, which extraction dropped, comes back once.
  const captioned = verses.findIndex(Array.isArray);
  assert.equal(cleaned.chapters[captioned].paragraphs.length, 4);
  assert.equal(cleaned.chapters[captioned].paragraphs[1], verses[captioned][0]);

  const again = cleanBooklet(cleaned, buildLexicon([])).booklet;
  assert.deepEqual(again, cleaned);

  // Any other verse count means the extraction changed shape: leave the text alone.
  const short = damaged();
  short.chapters.pop();
  const { booklet: untouched, log } = cleanBooklet(short, buildLexicon([]));
  assert.equal(verseOf(untouched.chapters[1]), "నిĶన్నే కోరితి నæన్నేయ");
  assert.ok(log.some((line) => line.startsWith("verses NOT restored")));

  // Another booklet's verses are not this booklet's transcription.
  const { booklet: other } = cleanBooklet({ ...damaged(), slug: "booklet-two" }, buildLexicon([]));
  assert.equal(verseOf(other.chapters[1]), "నిĶన్నే కోరితి నæన్నేయ");
});

test("booklet eight's stanzas are rebuilt from the transcription, keeping the extracted English", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { TRANSCRIBED_STANZAS } = await import("../scripts/lib/transcribed-stanzas.mjs");
  const stanzas = TRANSCRIBED_STANZAS["booklet-eight"];
  const count = stanzas.length - 1;
  const glosses = (n) => stanzas[n].words.map((_, i) => `gloss ${n + 1}.${i + 1}.`);
  const damagedWordByWord = (n, tail = "") =>
    `WORD-BY-WORD ${stanzas[n].words.map((_, i) => `జటా (ə जटा) — ${glosses(n)[i]}`).join(" ")}${tail}`;
  const build = () =>
    booklet(
      [
        ...Array.from({ length: count }, (_, n) => ({
          title: `${n + 1}.`,
          // Devanagari of neighbouring stanzas landed here, as the extraction left it.
          paragraphs: ["జటా ధరా", "जटाधरा əनिजा", "DEVANAGARI TRANSCRIPTION"]
        })),
        ...Array.from({ length: count }, (_, n) => ({
          title: n === count - 1 ? `Stanza ${n + 1}` : `STANZA ${n + 1} Stanza ${n + 1}`,
          paragraphs: [
            "జటా ధరా",
            // Stanza 3 (index 2): the Bhāvam ran on from the last gloss instead of starting its own paragraph.
            damagedWordByWord(n, n === 2 ? " BHĀVAM / INNER SENSE Run-on bhavam." : ""),
            ...(n === 2 ? [] : [`BHĀVAM / INNER SENSE Bhavam ${n + 1}.${n === count - 1 ? " PHALAŚRUTI" : ""}`])
          ]
        })),
        { title: "Phalaśruti", paragraphs: ["జటా", damagedWordByWord(count), "BHĀVAM / INNER SENSE Last.", "MEANING Fruit."] }
      ],
      "booklet-eight"
    );
  const { booklet: cleaned } = cleanBooklet(build(), buildLexicon([]));
  const words = (paragraph) => paragraph.replace(/^WORD-BY-WORD /, "");

  cleaned.chapters.slice(0, count).forEach((chapter, n) =>
    assert.deepEqual(chapter.paragraphs, [stanzas[n].te, stanzas[n].dv])
  );

  const study = (n) => cleaned.chapters[count + n];

  assert.equal(study(0).paragraphs[0], stanzas[0].te);
  assert.ok(words(study(0).paragraphs[1]).startsWith(`${stanzas[0].words[0][0]} (${stanzas[0].words[0][1]}) — gloss 1.1. `));
  assert.equal(study(0).paragraphs[2], "BHĀVAM / INNER SENSE Bhavam 1.");
  assert.deepEqual(study(2).paragraphs.slice(2), ["BHĀVAM / INNER SENSE Run-on bhavam."]);
  assert.ok(words(study(2).paragraphs[1]).endsWith(`— ${glosses(2).at(-1)}`));
  assert.equal(study(count - 1).paragraphs[2], `BHĀVAM / INNER SENSE Bhavam ${count}.`, "leaked PHALAŚRUTI heading removed");

  const phalasruti = cleaned.chapters[count * 2];
  assert.deepEqual(phalasruti.paragraphs.slice(0, 2), [stanzas[count].te, stanzas[count].dv]);
  assert.deepEqual(phalasruti.paragraphs.slice(3), ["BHĀVAM / INNER SENSE Last.", "MEANING Fruit."]);

  assert.deepEqual(cleanBooklet(cleaned, buildLexicon([])).booklet, cleaned);

  // A different shape, or a different booklet, is left alone rather than guessed at.
  const short = build();
  short.chapters.splice(3, 1);
  const { booklet: untouched, log } = cleanBooklet(short, buildLexicon([]));
  assert.equal(untouched.chapters[0].paragraphs[0], "జటా ధరా");
  assert.ok(log.some((line) => line.startsWith("stanzas NOT restored")));

  const { booklet: other } = cleanBooklet({ ...build(), slug: "booklet-two" }, buildLexicon([]));
  assert.equal(other.chapters[0].paragraphs[0], "జటా ధరా");
});

test("a Mirror booklet's back cover is cut from the closing chapter", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { booklet: cleaned } = cleanBooklet(
    booklet([
      { title: "1. Real Chapter", paragraphs: ["Text."] },
      {
        title: "Eight Things This Booklet Is Not Saying",
        paragraphs: [
          "The lamp burned. Its glow stayed.",
          "Booklet 2 of seven · The Inward Mirror Series Sasidhar Valluru",
          "Light remains; the lamp has done its work.",
          "THE INWARD MIRROR SERIES · THE GURU WHO DISAPPEARS · TheValluru.org"
        ]
      }
    ]),
    buildLexicon([])
  );

  assert.deepEqual(cleaned.chapters[1].paragraphs, ["The lamp burned. Its glow stayed."]);
  assert.deepEqual(cleaned.chapters[0].paragraphs, ["Text."]);
});

test("damaged Telugu passages are replaced only where the exact damaged run is found", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { TRANSCRIBED_PASSAGES } = await import("../scripts/lib/transcribed-passages.mjs");
  const entry = TRANSCRIBED_PASSAGES.find((candidate) => candidate.booklet === "booklet-two" && candidate.to.length === 4);
  const build = (slug) =>
    booklet(
      [{ title: "3. Verse", paragraphs: ["Before.", ...entry.from, "After."] }, { title: "4. Other", paragraphs: ["Plain."] }],
      slug
    );
  const { booklet: cleaned, log } = cleanBooklet(build("booklet-two"), buildLexicon([]));

  assert.deepEqual(cleaned.chapters[0].paragraphs, ["Before.", ...entry.to, "After."]);
  assert.ok(log.some((line) => line.startsWith("Telugu passages restored")));
  assert.deepEqual(cleaned.chapters[1].paragraphs, ["Plain."]);
  assert.deepEqual(cleanBooklet(cleaned, buildLexicon([])).booklet, cleaned);

  // A different booklet's identical text is not this booklet's damage.
  const { booklet: other } = cleanBooklet(build("booklet-six"), buildLexicon([]));
  assert.deepEqual(other.chapters[0].paragraphs, ["Before.", ...entry.from, "After."]);

  // Not damaged and not restored: reported, not silently ignored.
  const { log: missed } = cleanBooklet(booklet([{ title: "3. Verse", paragraphs: ["Just prose."] }], "booklet-two"), buildLexicon([]));
  assert.ok(missed.some((line) => line.startsWith("passage NOT restored")));
});

test("booklet nine's poems and notes are rebuilt from the transcription, found by the English part of the title", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { TRANSCRIBED_BOOKLET_NINE } = await import("../scripts/lib/transcribed-booklet-nine.mjs");
  const poem = TRANSCRIBED_BOOKLET_NINE.find((entry) => entry.key === "1. The Mirror of Māyā");
  const notes = TRANSCRIBED_BOOKLET_NINE.find((entry) => entry.key === "3. Notes");
  const build = (slug) =>
    booklet(
      [
        { title: "In Amma's Lap", paragraphs: ["Cover.", "1. 1. The Mirror of Māyā — దామగ్ద"] },
        {
          title: "1. The Mirror of Māyā మాయా అద్దం",
          paragraphs: ["Meter: కంద పద్యం", "మాయా అ ద్దమ్మ", "māyā addamulōnan", "భా వ ము గరవ్విం", "M E A N I N G The devotee sees."]
        },
        { title: "3. Notes", paragraphs: ["భా వ ము", "damaged ¥", "M E A N I N G The devotee says."] }
      ],
      slug
    );
  const { booklet: cleaned } = cleanBooklet(build("booklet-nine"), buildLexicon([]));

  assert.deepEqual(cleaned.chapters[1].paragraphs, [
    "Meter: కంద పద్యం",
    ...poem.lines.flat(),
    `భా వ ము ${poem.bhavam}`,
    "M E A N I N G The devotee sees."
  ]);
  assert.equal(cleaned.chapters[1].title, poem.title);
  assert.deepEqual(cleaned.chapters[2].paragraphs, ["భా వ ము", notes.bhavam, "M E A N I N G The devotee says."]);
  assert.equal(cleaned.chapters[0].paragraphs[1], `1. 1. The Mirror of Māyā — ${poem.title.slice(poem.key.length).trim()}`);
  assert.deepEqual(cleanBooklet(cleaned, buildLexicon([])).booklet, cleaned);

  const { booklet: other } = cleanBooklet(build("booklet-two"), buildLexicon([]));
  assert.equal(other.chapters[1].paragraphs[1], "మాయా అ ద్దమ్మ");
});

test("booklet seven's verse-sections are rebuilt between the label and the English commentary, even where a page break fused them", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const { TRANSCRIBED_BOOKLET_SEVEN } = await import("../scripts/lib/transcribed-booklet-seven.mjs");
  const sections = TRANSCRIBED_BOOKLET_SEVEN;
  const build = (slug) =>
    booklet(
      sections.map((section, index) => ({
        title: `${index + 1} Section`,
        paragraphs: [
          "English before.",
          "పద్యం — శా ర@్దూల ధో రణి",
          "damaged ¥ line",
          "METER damaged",
          // Section 3 (index 2) is the fused case: the last భావము line and the commentary share a paragraph.
          index === 2 ? "damaged భావము tail AUTHOR CONTEXT The English stays." : "భావము damaged",
          ...(index === 2 ? [] : ["AUTHOR CONTEXT The English stays."]),
          "MEANING “Kept.”"
        ]
      })),
      slug
    );
  const { booklet: cleaned } = cleanBooklet(build("booklet-seven"), buildLexicon([]));

  cleaned.chapters.forEach((chapter, index) => {
    const section = sections[index];
    const [first, ...more] = section.bhavam;

    assert.deepEqual(chapter.paragraphs, [
      "English before.",
      section.label,
      ...section.lines,
      `METER ${section.meter}`,
      `భావము ${first}`,
      ...more,
      "AUTHOR CONTEXT The English stays.",
      "MEANING “Kept.”"
    ]);
  });
  assert.deepEqual(cleanBooklet(cleaned, buildLexicon([])).booklet, cleaned);

  const short = build("booklet-seven");
  short.chapters.pop();
  const { log } = cleanBooklet(short, buildLexicon([]));
  assert.ok(log.some((line) => line.startsWith("booklet seven verses NOT restored")));

  const { booklet: other } = cleanBooklet(build("booklet-two"), buildLexicon([]));
  assert.equal(other.chapters[0].paragraphs[2], "damaged ¥ line");
});

test("cleaning twice changes nothing more", async () => {
  const { buildLexicon, cleanBooklet } = await load();
  const source = booklet([
    { title: "CHAPTER 13 The Gist", paragraphs: ["Let it arrive. EPILOGUE"] },
    { title: "Before the Next", paragraphs: ["RāvaṇaBrahma."] }
  ]);
  const once = cleanBooklet(source, buildLexicon([])).booklet;
  const twice = cleanBooklet(once, buildLexicon([])).booklet;

  assert.deepEqual(twice, once);
});
