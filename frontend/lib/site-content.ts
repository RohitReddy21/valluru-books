export type Cta = {
  label: string;
  href: string;
};

export type Movement = {
  slug?: string;
  title: string;
  booklets: string;
  description: string;
  href?: string;
  status?: PublishStatus;
  pdf?: string;
  coverImage?: string;
  bookletIndices?: number[];
  seo?: SeoMetadata;
  // New fields for updated copy
  pageIntro?: string;
  bookletInclusionNote?: string;
  landingHeroLine?: string;
  openingParagraph?: string;
  arcLine?: string;
  closingLine?: string;
};

export function movementSlug(movement: Pick<Movement, "slug" | "title">, index = 0) {
  return (
    movement.slug ||
    movement.title
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    `movement-${index + 1}`
  );
}

function slugSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function bookletPublicSlug(booklet: Pick<Booklet, "slug" | "numberLabel" | "title">) {
  const numberPart = slugSegment(booklet.numberLabel || "booklet");
  const titlePart = slugSegment(booklet.title || booklet.slug || "booklet");
  return `${numberPart}-${titlePart}`;
}

export function bookletMatchesSlug(booklet: Pick<Booklet, "slug" | "numberLabel" | "title">, slug: string) {
  return booklet.slug === slug || bookletPublicSlug(booklet) === slug;
}

export type PublishStatus = "draft" | "published" | "archived";

export type SeoMetadata = {
  title?: string;
  description?: string;
  keywords?: string;
};

export type BookletFaq = {
  question: string;
  answer: string;
};

export type Booklet = {
  slug: string;
  numberLabel: string;
  title: string;
  subtitle: string;
  cardSubtitle?: string;
  shortCardBody?: string;
  detailIntro?: string;
  oneLineHook?: string;
  detailSubtitle?: string;
  readerPositioning?: string;
  explores?: string;
  readButtonText?: string;
  downloadButtonText?: string;
  faqs?: BookletFaq[];
  relatedBookletSlugs?: string[];
  movementIndex?: number;
  status?: PublishStatus;
  sourcesNote?: string;
  authorNote?: string;
  note?: string;
  description: string;
  pdf?: string;
  samplePdf?: string;
  coverImage?: string;
  galleryImages?: string[];
  categories?: string[];
  tags?: string[];
  coffeeTableEdition?: boolean | "unavailable";
  tag?: string;
  badge?: string;
  price?: number;
  currency?: string;
  seo?: SeoMetadata;
};

export type SiteMedia = {
  homeHeroImage: string;
  pageHeroImage: string;
  authorImage: string;
};

export type SiteContent = {
  nav: {
    logo: string;
    links: Array<Cta>;
    button: Cta;
  };
  home: {
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      body: string[];
      primaryCta: Cta;
      secondaryCta: Cta;
    };
    why: {
      title: string;
      body: string[];
    };
    seriesOverview: {
      title: string;
      intro: string;
      movements: Movement[];
    };
    forWhom: {
      title: string;
      body: string[];
    };
    quote: {
      text: string;
      byline: string;
    };
    newsletter: {
      title: string;
      body: string;
      microcopy: string;
    };
    closingLine: string;
  };
  series: {
    title: string;
    subtitle: string;
    opening: string[];
    readingOrderNote: string;
    booklets: Booklet[];
    closing: string[];
  };
  movements: {
    items: Movement[];
  };
  about: {
    title: string;
    subtitle: string;
    bio: string[];
    pullQuotes: string[];
    whatThisIsNot: string[];
    contact: {
      intro: string;
      email: string;
      website: string;
    };
  };
  media: SiteMedia;
  settings: {
    whatsappNumber: string;
    websiteName: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    socialLinks: {
      website?: string;
      linkedin?: string;
      instagram?: string;
      youtube?: string;
    };
    seo: SeoMetadata;
  };
  footer: {
    title: string;
    links: Array<Cta>;
    website: string;
    email: string;
    bottomLine: string;
  };
};

export const defaultSiteContent: SiteContent = {
  nav: {
    logo: "The Valluru",
    links: [
      { label: "Home", href: "/" },
      { label: "The Series", href: "/series" },
      { label: "Movements", href: "/movements" },
      { label: "About", href: "/about" }
      // { label: "Cart", href: "/cart" }
    ],
    button: { label: "Begin Reading", href: "/series/booklet-one-when-the-gods-fall-silent" }
  },
  home: {
    hero: {
      eyebrow: "The Inward Fire Series · Sasidhar Valluru",
      title: "The Inward Fire Series",
      subtitle:
        "Writings on dharma, grief, language, surrender, and the inner life.",
      body: [
        "For the competent but tired seeker. For the person who has optimized career, family, duty, migration, survival, and reputation — but still needs an inward anchor when grief, silence, responsibility, and mortality arrive.",
        "No spiritual performance. No costume. No promise of instant peace.",
        "Only a set of writings for those who are still willing to look inward."
      ],
      primaryCta: { label: "Begin with Booklet One", href: "/series/booklet-one-when-the-gods-fall-silent" },
      secondaryCta: { label: "View All Eighteen Booklets", href: "/series" }
    },
    why: {
      title: "Why This Exists",
      body: [
        "Modern life teaches us how to function.",
        "It teaches us how to earn, deliver, lead, migrate, manage, respond, recover, explain, and keep moving. It teaches us how to optimize nearly everything.",
        "But it does not always teach us how to stand when grief enters the room.",
        "It does not teach us what to do when duty becomes heavy, when the gods seem silent, when language fails, when achievement does not settle the heart, when responsibility becomes another face of ego, or when the person we built ourselves to be begins to feel too small for the life we are carrying.",
        "These writings come from that place.",
        "They draw from Sanātana Dharma, the Gita, Bhagavatam, Tripura Rahasya, Vijñāna Bhairava Tantra, Telugu poetry, nāda, bhakti, Siva, Krishna, Kāli, Kāśī, grief, memory, and lived experience.",
        "Not to build a new doctrine.",
        "To return the seeker to the inward fire."
      ]
    },
    seriesOverview: {
      title: "The Series in Six Movements",
      intro:
        "Eighteen booklets on dharma, maya, nada, language, surrender, memory, the long inward journey, and the human field around the seeker.",
      movements: [
        {
          slug: "the-inward-map",
          title: "The Inward Map",
          booklets: "1-3",
          href: "/series/booklet-one-when-the-gods-fall-silent",
          description:
            "Dharma is tested. Silence becomes sound. Language learns to bow.",
          status: "published"
        },
        {
          slug: "the-seeker-and-the-long-work",
          title: "The Seeker and the Long Work of Bhagavān",
          booklets: "4-5, 10-11, 13",
          href: "/series/booklet-four-when-the-seeker-stops-optimizing",
          description:
            "Maya, responsibility, surrender, the long witnesses, and the sacred interval where questions exhaust themselves.",
          pageIntro:
            "Movement Two follows the seeker after the first inward map has been drawn. The work is no longer only conceptual. Maya appears inside planning, responsibility, happiness, strategy, witness, silence, and surrender. The seeker learns that Bhagavan’s work is long, patient, and often hidden inside ordinary life.",
          bookletInclusionNote:
            "Booklets 4, 5, 10, 11, and 13 belong here: optimization giving way to surrender, the Chiranjeevis as witnesses, strategy burning, happiness refusing to stay, and the sacred interval where the mind stops demanding immediate answers.",
          status: "published"
        },
        {
          slug: "grief-as-fire",
          title: "Grief as Fire",
          booklets: "6-7",
          href: "/series/booklet-six-when-grief-became-nada",
          description:
            "Grief enters as fire, becomes nāda, becomes vow, becomes offering.",
          status: "published"
        },
        {
          slug: "nada-as-offering",
          title: "Nāda as Offering",
          booklets: "8",
          href: "/series/booklet-eight-nadesvara-ksobhasamana-stotram",
          description:
            "The seeker turns toward Nādeśvara. The bow becomes rhythm.",
          status: "published"
        },
        {
          slug: "the-child-returns",
          title: "The Child Returns",
          booklets: "9",
          href: "/series/booklet-nine-in-ammas-lap",
          description:
            "Bhakti becomes childlike again. The child asks to be held.",
          status: "published"
        },
        {
          slug: "return-to-people",
          title: "The Human Field Around the Seeker",
          booklets: "14-18",
          description:
            "Blame, dependency, role, boundary, love, and the difficult return to people after the inward fire.",
          landingHeroLine:
            "The inward journey is tested not only in solitude, but in the human field around us.",
          openingParagraph:
            "After the seeker has gone inward, he must stand among people again. Family, colleagues, students, teams, old loyalties, wounded minds, loving minds, blaming minds, and dependent minds all become part of the field. Movement Six asks how the seeker remains compassionate without becoming available for every projection, how he helps without replacing another person’s dharma, and how he acts inside roles without being possessed by them.",
          arcLine:
            "The seeker learns that other people’s pain must be seen with compassion, but not always obeyed, absorbed, explained, or allowed into the inner sanctum.",
          closingLine:
            "This movement is not a withdrawal from people. It is a cleaner return to them.",
          status: "published"
        }
      ]
    },
    forWhom: {
      title: "For Whom",
      body: [
        "These writings are for the urban exile with a thinking mind and a wounded heart.",
        "The professional who appears fine. The immigrant who belongs everywhere and nowhere. The Indian who knows the tradition is somewhere inside, but cannot enter it through noise. The seeker who has watched too many sermons and still feels unanchored. The grieving parent, child, spouse, friend, or colleague who does not need motivational slogans. The reader who wants depth without theatrics.",
        "You do not have to agree with everything here.",
        "Sit with what speaks. Leave what does not. Return when needed."
      ]
    },
    quote: {
      text: "When the gods fall silent, the seeker finally hears himself.",
      byline: "The Inward Fire Series, Booklet One"
    },
    newsletter: {
      title: "The Inward Fire Letter",
      body:
        "A monthly letter with one short reflection, one quote, and one booklet recommendation. Plain, literary, restrained. No clickbait. No exclamation marks.",
      microcopy: "Quiet updates only. Unsubscribe any time."
    },
    closingLine:
      "Come in. Sit. Read. Carry what helps. Leave what does not."
  },
  series: {
    title: "The Inward Fire Series",
    subtitle:
      "Eighteen booklets on dharma, maya, nada, language, surrender, memory, the long inward journey, and the human field around the seeker.",
    opening: [
      "The Inward Fire Series began with a simple concern. A seeker can drown in vocabulary. Advaita. Bhakti. Tantra. Vedanta. Yoga. Surrender. Inquiry. Breath. Nāma. Śakti. Dharma. Māyā. Grace. All of these may point toward something real. But the modern seeker often stands in the middle of too many words and too little anchoring.",
      "This series does not try to exhaust Sanātana Dharma. It tries to create a set of living doorways. Each booklet asks one inward question. Each one turns toward a different instrument: duty, sound, language, responsibility, memory. Each one returns, in its own way, to surrender."
    ],
    readingOrderNote:
      "Read them in sequence first. Not because sequence is mandatory. Because the fire moves.",
    booklets: [
      {
        slug: "booklet-one",
        numberLabel: "Booklet One",
        title: "When the Gods Fall Silent",
        subtitle: "Dharma, Māyā, and the Inward Journey",
        sourcesNote:
          "A reading through the Gita, Tripura Rahasya, Vijñāna Bhairava Tantra, and Bhagavatam.",
        description:
          'This booklet begins with the core problem: the false center called "I." It asks how the seeker stands when dharma becomes costly, when power is tested, when knowledge is humbled, when māyā is named, and when even familiar gods seem silent. It brings together the Gita\'s yogic toolkits, Tripura Rahasya\'s recognition of Consciousness, Vijñāna Bhairava\'s direct entry into awareness, and Bhagavatam\'s insistence that the heart must be anchored in bhakti and surrender. This is the first map. Not the whole tradition. Enough to stop floating.',
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/when-the-gods-fall-silent-booklet_one.pdf",
        badge: "Free · Begin Here",
        tag: "AVAILABLE",
        movementIndex: 0
      },
      {
        slug: "booklet-two",
        numberLabel: "Booklet Two",
        title: "When Silence Became Sound",
        subtitle: "Nāda Brahma, Om, Nataraja, and Art as Worship",
        sourcesNote:
          "A reading through sound, rhythm, language, art, grief, and surrender.",
        description:
          "The first booklet ends in silence. This one asks what happens after that silence. Not silence as absence. Silence as pressure before sound. Silence as the field in which Om becomes audible. This booklet turns to nāda: Om, Nataraja, the damaru, rhythm, poetry, the body as instrument, art as offering, and the child's first prayer in the dark: Be with me. It asks whether art can become upāsana. Not decoration. Not performance. Offering.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/when-silence-became-sound-booklet_two.pdf",
        tag: "AVAILABLE",
        movementIndex: 0
      },
      {
        slug: "booklet-three",
        numberLabel: "Booklet Three",
        title: "Where Language Learns to Bow",
        subtitle: "Telugu Poetry, Bhakti, Courage, and Surrender",
        sourcesNote:
          "A reading through Telugu kavya, song, courage, grief, language, and śaraṇāgati.",
        description:
          "After sound comes language. Language is dangerous. It can defend ego, flatter falsehood, decorate pride, manipulate, wound, sell, argue, and hide. It can also pray, confess, praise, console, remember, surrender, and bow. This booklet turns to Telugu poetry and song — not as grammar display, not as literary vanity, but as spiritual instrument. It asks how language bows before Bhagavān. How courage enters meter. How grief enters song. How the tongue finds its place at His feet.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/where-language-learns-to-bow-booklet_three.pdf",
        tag: "AVAILABLE",
        movementIndex: 0
      },
      {
        slug: "booklet-four",
        numberLabel: "Booklet Four",
        title: "When the Seeker Stops Optimizing",
        subtitle:
          "Māyā, Responsibility, Surrender, and the Freedom to Just Be",
        description:
          "This booklet begins from a modern wound. The human being has turned life into an optimization problem. Career. Money. Reputation. Visa status. Family duty. Children. Health. Productivity. Spirituality. Even rest. Everything becomes something to improve, measure, secure, and own. But when death is certain, what exactly are we optimizing? This booklet reads māyā as the great optimization trap. It asks whether responsibility can become ego in work clothes. It returns to Śrī Rāma, Samvartaka, Arjuna, Vyāsa, Nārada, Hanuman, and the child in the train to ask what it means to just be. Not laziness. Not escape. Surrendered action without false ownership.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/when-the-seeker-stops-optimizing-booklet_four.pdf",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-five",
        numberLabel: "Booklet Five",
        title: "The Witnesses Who Remain",
        subtitle:
          "Chiranjeevis, Memory, Atonement, Mercy, and the Long Work of Bhagavān",
        description:
          "Why do some beings remain? Vyāsa. Hanuman. Mahabali. Aśvatthāma. Vibhīṣaṇa. Kṛpācārya. Paraśurāma. Mārkaṇḍeya. The point is why the tradition preserves the idea that some beings remain available to the loka. This booklet reads the Chiranjeevis as witnesses. Not ornaments. Not fantasy leftovers. Witnesses. Each one carries a lesson human beings keep failing to learn: knowledge is not enough, strength must bow, surrender can emerge where labels fail, atonement is real, mercy is not weakness, duty may have no glamour, and Bhagavān's work is long. Human stupidity is long too. Grace, thankfully, is longer.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/the-witnesses-who-remain-booklet_five.pdf",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-six",
        numberLabel: "Booklet Six",
        title: "When Grief Became Nāda",
        subtitle:
          "Padyam, Surrender, and the Realization That Nothing Is Owned",
        description:
          "Who owns grief? The verses move through Śiva, Annapūrṇa, Dakṣiṇa Kāli, Kṛṣṇa, Vṛndāvana, Kāśī, Dvārakā, the Ganga, and surrender. This booklet reads grief not as biography. Not spectacle. Not complaint. Grief as fire. Grief as teacher. Grief as nāda. The realization is severe: nothing is truly owned. Not the body. Not work. Not skill. Not language. Not children. Not grief. The movement is not from sorrow to explanation. It is from grief to surrender. From surrender to sound. From sound to offering. From offering back into silence.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/when-grief-became-nada-booklet_six.pdf",
        tag: "AVAILABLE",
        movementIndex: 2
      },
      {
        slug: "booklet-seven",
        numberLabel: "Booklet Seven",
        title: "Beyond Grief",
        subtitle: "The vow, the chariot, and movement before sunset.",
        description:
          "The seeker no longer asks only why. He stands, gathers the bow, remembers the chariot, and keeps moving before sunset. Grief becomes kinetic force: bow, chariot, horses, arrow-fence, Mādhava, vow, dusk, and protected grief.",
        tag: "AVAILABLE",
        movementIndex: 2,
        coffeeTableEdition: "unavailable"
      },
      {
        slug: "booklet-eight",
        numberLabel: "Booklet Eight",
        title: "Nādeśvara Kṣobhaśamana Stotram",
        subtitle: "A Sanskritic-Telugu Nāda-Dandakam to Siva-Nataraja",
        authorNote: "Śaśidhara-racita",
        description:
          "What happens when grief no longer argues? It chants. The seeker turns from battle-readiness to rhythm-alignment. This stotram is offered as nāda at the feet of Nādeśvara — the Lord of sound, rhythm, and the damaru, whose dance restores the broken pulse. Kṣobha is inner agitation — the disturbed movement of grief, desire, memory, ego, and restlessness. Kṣobhaśamana is the calming of turbulence by alignment with Siva's cosmic rhythm. The prayer is simple: Dance, Siva. Let Your damaru reset my rhythm. Let grief turn toward grace.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/nadeswara-kshobhasamana-stotram-booklet_eight.pdf",
        tag: "AVAILABLE",
        movementIndex: 3
      },
      {
        slug: "booklet-nine",
        numberLabel: "Booklet Nine",
        title: "In Amma's Lap",
        subtitle: "Bhakti, Self-Laughter, Māyā, and the Child's Surrender",
        note: "An illustrated poetry booklet in Telugu, Roman Telugu, and English.",
        description:
          "After the maps, the witnesses, the grief, and the stotram, the seeker becomes simpler. Māyā is no longer only a philosophical problem. It becomes a mirror, a food-offering, a costume, a joke, a knot, a noise, a mask. The seeker laughs at himself — not with cynicism, but with tenderness. Here, bhakti becomes childlike again. Krishna is teased. Kāli becomes Amma. Service becomes Father's service. The roles and masks are asked to be broken apart. The child simply asks to be held.",
        pdf:
          "https://thevalluru.org/wp-content/uploads/2026/05/in-ammas-lap-booklet_nine-1.pdf",
        tag: "AVAILABLE",
        movementIndex: 4
      },
      {
        slug: "booklet-ten",
        numberLabel: "Booklet Ten",
        title: "The Long Witnesses",
        subtitle: "Chiranjeevis, Memory, and the Work That Outlives Us",
        description:
          "The seeker meets the long witnesses: Hanuman, Vibhishana, Vyasa, Ashwatthama, Kripa, Bali, Parashurama. Not as mythological characters. As living presences who remind us that some work spans lifetimes. Memory becomes anchor, not burden. The seeker learns to bow before what outlives him.",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-eleven",
        numberLabel: "Booklet Eleven",
        title: "When Happiness Refused to Stay",
        subtitle: "Pleasure, Attachment, and the Real Happiness That Does Not Flee",
        description:
          "The seeker asks why happiness keeps leaving. Why pleasure turns to restlessness. Why comfort becomes cage. He learns to distinguish between the happiness that depends on circumstances and the happiness that comes from alignment with dharma and surrender.",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-twelve",
        numberLabel: "Booklet Twelve",
        title: "When Strategy Burned",
        subtitle: "Planning, Ego, and the Freedom to Trust the Process",
        description:
          "The seeker's strategies burn. His plans crumble. His need to control everything is exposed as another face of ego. He learns that surrender is not passivity. It is alignment with something larger than his own small mind.",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-thirteen",
        numberLabel: "Booklet Thirteen",
        title: "The Sacred Interval",
        subtitle: "When Questions Exhaust Themselves and Silence Becomes Answer",
        description:
          "The seeker reaches the place where questions no longer need answers. Where the mind stops demanding immediate solutions. Where silence itself becomes the teacher. This is the sacred interval: the space between asking and receiving, between effort and grace.",
        tag: "AVAILABLE",
        movementIndex: 1
      },
      {
        slug: "booklet-fourteen",
        numberLabel: "Booklet Fourteen",
        title: "When Blame Arrived",
        subtitle: "Projection, Responsibility, and Compassion Without Collapse",
        description:
          "Blame comes. The seeker is blamed. He feels the urge to blame others. He learns to see blame as projection, not truth. He learns how to hold space for another's pain without absorbing it, how to be compassionate without becoming available for every projection.",
        tag: "AVAILABLE",
        movementIndex: 5
      },
      {
        slug: "booklet-fifteen",
        numberLabel: "Booklet Fifteen",
        title: "When Dependency Knocked",
        subtitle: "Neediness, Boundaries, and Love That Does Not Enslave",
        description:
          "Dependency arrives in many forms: emotional, financial, psychological. The seeker learns to distinguish between healthy interdependence and unhealthy enmeshment. He learns to set boundaries with love, not anger. He learns that true love does not require sacrificing oneself.",
        tag: "AVAILABLE",
        movementIndex: 5
      },
      {
        slug: "booklet-sixteen",
        numberLabel: "Booklet Sixteen",
        title: "When Roles Became Masks",
        subtitle: "Identity, Performance, and the Freedom to Be Human",
        description:
          "The seeker sees how roles become masks: professional, parental, social, spiritual. He learns to act within roles without being possessed by them. He learns to take off the masks when needed, to be human, vulnerable, and real.",
        tag: "AVAILABLE",
        movementIndex: 5
      },
      {
        slug: "booklet-seventeen",
        numberLabel: "Booklet Seventeen",
        title: "The Cleaner Return",
        subtitle: "Love, Forgiveness, and Standing With People After the Inward Fire",
        description:
          "After the inward journey, the seeker returns to people. Not the same person. Cleaner. Clearer. He learns to love without clinging, to forgive without forgetting, to stand with people without losing himself. This is the cleaner return: coming back to the human field with compassion and clarity.",
        tag: "AVAILABLE",
        movementIndex: 5
      },
      {
        slug: "when-the-bond-becomes-a-claim",
        numberLabel: "Booklet Eighteen",
        title: "When the Bond Becomes a Claim",
        subtitle: "Love, Memory, Expectation, and the Dharma of Not Being Owned",
        cardSubtitle: "Love, Memory, Expectation, and the Dharma of Not Being Owned",
        shortCardBody:
          "Some bonds begin in affection and end in claim. This booklet explores memory, expectation, loyalty, gratitude, and the quiet way love begins asking dharma to bend.",
        detailIntro:
          "This booklet asks what happens when affection, gratitude, history, and loyalty become silent claims upon another person's dharma. Through professional memory, family expectation, childhood recollection, and Kāśī solitude, it explores how memory edits the people before us, how bonds become ownership, and how the seeker learns to return to Satya before Smṛti becomes Kathā.",
        oneLineHook:
          "A bond may give someone a place in your heart. It cannot give them ownership over your dharma.",
        detailSubtitle:
          "A meditation on bond, memory, expectation, gratitude, and the inward discipline of not being owned by the reflections others carry of us.",
        readerPositioning:
          "For anyone who has been loved, claimed, misunderstood, depended on, idolized, or expected to remain the same version of themselves forever.",
        explores:
          "When the Bond Becomes a Claim moves through the hidden grammar of human bonds: affection becoming expectation, mercy becoming precedent, gratitude becoming shrine, and memory becoming evidence. It asks how we keep love without becoming owned by love, how we honor history without letting history overrule dharma, and how Bhagavān remains with Satya before memory turns experience into story.",
        readButtonText: "READ BOOKLET →",
        downloadButtonText: "DOWNLOAD",
        description:
          "This booklet asks what happens when affection, gratitude, history, and loyalty become silent claims upon another person's dharma. Through professional memory, family expectation, childhood recollection, and Kāśī solitude, it explores how memory edits the people before us, how bonds become ownership, and how the seeker learns to return to Satya before Smṛti becomes Kathā.",
        faqs: [
          {
            question: "What is this booklet about?",
            answer:
              "It is about the moment when a real bond begins to behave like a claim. The booklet explores how affection, gratitude, loyalty, family memory, and old professional ties can slowly begin asking dharma to bend."
          },
          {
            question: "Who is this booklet for?",
            answer:
              "For readers who have carried people, been claimed by people, disappointed people by changing, or felt trapped by the version of themselves that others still remember."
          },
          {
            question: "How should this booklet be read?",
            answer:
              "Read it slowly, as a mirror. It is not a complaint against relationships. It is an inquiry into how love can remain real without becoming ownership."
          },
          {
            question: "What is the central insight?",
            answer:
              "The bond is real. The claim is not. The person before us changes through blood, time, fatigue, grief, duty, and life. Their reflection inside us remains edited by memory."
          }
        ],
        relatedBookletSlugs: [
          "booklet-fifteen",
          "booklet-sixteen",
          "booklet-seventeen"
        ],
        tag: "AVAILABLE",
        status: "published",
        movementIndex: 5
      }
    ],
    closing: [
      "The Inward Fire Series is not meant to create followers. It is meant to give the seeker a place to sit with difficult things. Dharma. Grief. Language. Responsibility. Death. Memory. Surrender. Bhagavān.",
      "Read slowly. Return when needed."
    ]
  },
  movements: {
    items: [
      {
        slug: "the-inward-map",
        title: "The Inward Map",
        booklets: "1-3",
        description:
          "Dharma is tested. Silence becomes sound. Language learns to bow.",
        status: "published"
      },
      {
        slug: "the-seeker-and-the-long-work",
        title: "The Seeker and the Long Work of Bhagavān",
        booklets: "4-5, 10-11, 13",
        description:
          "Maya, responsibility, surrender, the long witnesses, and the sacred interval where questions exhaust themselves.",
        pageIntro:
          "Movement Two follows the seeker after the first inward map has been drawn. The work is no longer only conceptual. Maya appears inside planning, responsibility, happiness, strategy, witness, silence, and surrender. The seeker learns that Bhagavan’s work is long, patient, and often hidden inside ordinary life.",
        bookletInclusionNote:
          "Booklets 4, 5, 10, 11, and 13 belong here: optimization giving way to surrender, the Chiranjeevis as witnesses, strategy burning, happiness refusing to stay, and the sacred interval where the mind stops demanding immediate answers.",
        status: "published"
      },
      {
        slug: "grief-as-fire",
        title: "Grief as Fire",
        booklets: "6-7",
        description:
          "Grief enters as fire, becomes nāda, becomes vow, becomes offering.",
        status: "published"
      },
      {
        slug: "nada-as-offering",
        title: "Nāda as Offering",
        booklets: "8",
        description:
          "The seeker turns toward Nādeśvara. The bow becomes rhythm.",
        status: "published"
      },
      {
        slug: "the-child-returns",
        title: "The Child Returns",
        booklets: "9",
        description:
          "Bhakti becomes childlike again. The child asks to be held.",
        status: "published"
      },
      {
        slug: "return-to-people",
        title: "The Human Field Around the Seeker",
        booklets: "14-18",
        description:
          "Blame, dependency, role, boundary, love, and the difficult return to people after the inward fire.",
        landingHeroLine:
          "The inward journey is tested not only in solitude, but in the human field around us.",
        openingParagraph:
          "After the seeker has gone inward, he must stand among people again. Family, colleagues, students, teams, old loyalties, wounded minds, loving minds, blaming minds, and dependent minds all become part of the field. Movement Six asks how the seeker remains compassionate without becoming available for every projection, how he helps without replacing another person’s dharma, and how he acts inside roles without being possessed by them.",
        arcLine:
          "The seeker learns that other people’s pain must be seen with compassion, but not always obeyed, absorbed, explained, or allowed into the inner sanctum.",
        closingLine:
          "This movement is not a withdrawal from people. It is a cleaner return to them.",
        status: "published"
      }
    ]
  },
  about: {
    title: "Sasidhar Valluru",
    subtitle: "Author of The Inward Fire Series",
    bio: [
      "Sasidhar Valluru writes from the intersection of Sanātana Dharma, Telugu literary memory, and lived experience. His work draws on the Gita, Bhagavatam, Tripura Rahasya, Vijñāna Bhairava Tantra, bhakti, nāda, grief, and the long tradition of dharmic inquiry — not to summarize these traditions, but to return the reader to the inward fire that already exists within them.",
      "The Inward Fire Series is not assembled or trend-optimized. It is genuinely written from the inside of spiritual struggle, professional exhaustion, grief, and surrender.",
      "His primary audience is the Indian professional and diaspora seeker — the person who appears fine, has built a competent life, and still needs an anchor when mortality, grief, silence, and meaning arrive uninvited."
    ],
    pullQuotes: [
      "Not performance. Not costume. Not instant peace.",
      "A serious author inviting serious readers into a body of work."
    ],
    whatThisIsNot: [
      "No loud guru positioning.",
      "No motivational-spam tone.",
      "No aggressive sales language.",
      "No promise of transformation in 21 days."
    ],
    contact: {
      intro: "For correspondence, review copies, or reading circle inquiries:",
      email: "sasi@theValluru.org",
      website: "thevalluru.org"
    }
  },
  media: {
    homeHeroImage: "",
    pageHeroImage: "",
    authorImage: ""
  },
  settings: {
    whatsappNumber: "",
    websiteName: "The Valluru",
    contactEmail: "sasi@theValluru.org",
    contactPhone: "",
    address: "",
    socialLinks: {},
    seo: {
      title: "The Valluru — The Inward Fire Series",
      description:
        "Writings on dharma, grief, language, surrender, and the inner life."
    }
  },
  footer: {
    title: "The Valluru — The Inward Fire Series",
    links: [
      { label: "The Books", href: "/series" },
      { label: "Movements", href: "/movements" },
      { label: "About the Author", href: "/about" },
      { label: "Newsletter", href: "/#newsletter" }
    ],
    website: "thevalluru.org",
    email: "sasi@theValluru.org",
    bottomLine:
      "A quiet archive of writings on dharma, grief, language, surrender, and the inner life. © Sasidhar Valluru 2026"
  }
};

export function isPublished(status?: PublishStatus) {
  return !status || status === "published";
}

export function getBookletCardSubtitle(booklet: Booklet) {
  return booklet.cardSubtitle || booklet.subtitle;
}

export function getBookletCardBody(booklet: Booklet) {
  return booklet.shortCardBody || booklet.description;
}

export function getBookletDetailSubtitle(booklet: Booklet) {
  return booklet.detailSubtitle || booklet.subtitle;
}

export function getBookletDetailIntro(booklet: Booklet) {
  return booklet.detailIntro || booklet.description;
}

export function getBookletReadButtonText(booklet: Booklet) {
  return booklet.readButtonText || "Read Booklet";
}

export function getBookletDownloadButtonText(booklet: Booklet) {
  return booklet.downloadButtonText || "Download";
}

export function getBookletFaqs(booklet: Booklet): BookletFaq[] {
  const customFaqs = (booklet.faqs || []).filter(
    (item) => (item.question || "").trim() && (item.answer || "").trim()
  );

  if (customFaqs.length) {
    return customFaqs;
  }

  return [
    {
      question: `What is ${booklet.title} about?`,
      answer: getBookletDetailIntro(booklet)
    },
    {
      question: "Who is this booklet for?",
      answer:
        booklet.readerPositioning ||
        booklet.subtitle ||
        "It is written for readers seeking a contemplative, literary approach to dharma, grief, language, surrender, and the inner life."
    },
    {
      question: "How should this booklet be read?",
      answer:
        "Read it slowly, as a reflective text rather than a rushed manual. Return to key passages, sit with the questions it raises, and let the language do inward work over time."
    }
  ];
}

export function getBookletMovementIndex(booklet: Booklet, fallbackIndex = 0) {
  if (typeof booklet.movementIndex === "number") {
    return Math.max(0, booklet.movementIndex);
  }

  // Original fallback logic for backward compatibility (0-based)
  if (fallbackIndex < 3) { // 0-2: Booklets 1-3
    return 0;
  }

  // 3-4 (4-5), 9-10 (10-11), 12 (13): Movement 2
  if (
    (fallbackIndex >= 3 && fallbackIndex < 5) || 
    (fallbackIndex >= 9 && fallbackIndex < 11) || 
    fallbackIndex === 12
  ) {
    return 1;
  }

  if (fallbackIndex >= 5 && fallbackIndex < 7) { //5-6: 6-7
    return 2;
  }

  if (fallbackIndex === 7) { //7:8
    return 3;
  }

  if (fallbackIndex === 8) { //8:9
    return 4;
  }

  if (fallbackIndex >= 13) { //13+: 14+
    return 5;
  }

  return 0;
}

export function getBookletNeighbors(booklets: Booklet[], slug: string) {
  const index = booklets.findIndex((booklet) => booklet.slug === slug);

  return {
    previous: index > 0 ? booklets[index - 1] : undefined,
    next: index >= 0 && index < booklets.length - 1 ? booklets[index + 1] : undefined
  };
}
