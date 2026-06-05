export type Cta = {
  label: string;
  href: string;
};

export type Movement = {
  slug: string;
  title: string;
  booklets: string;
  description: string;
  href?: string;
  status?: PublishStatus;
  pdf?: string;
  coverImage?: string;
  seo?: SeoMetadata;
};

export type PublishStatus = "draft" | "published" | "archived";

export type SeoMetadata = {
  title?: string;
  description?: string;
  keywords?: string;
};

export type Booklet = {
  slug: string;
  numberLabel: string;
  title: string;
  subtitle: string;
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
  price?: number;
  currency?: string;
  seo?: SeoMetadata;
  badge?: string;
  tag: string;
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
    ],
    button: { label: "Begin Reading", href: "/series/booklet-one" }
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
      primaryCta: { label: "Begin with Booklet One", href: "/series/booklet-one" },
      secondaryCta: { label: "View All Nine Booklets", href: "/series" }
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
      title: "The Inward Fire Series",
      intro:
        "Nine booklets on dharma, māyā, nāda, language, surrender, memory, and the long inward journey. Each booklet takes one doorway. Each one returns, in its own way, to surrender.",
      movements: [
        {
          slug: "the-inward-map",
          title: "The Inward Map",
          booklets: "1-3",
          href: "/series/booklet-one",
          description:
            "Dharma is tested. Silence becomes sound. Language learns to bow."
        },
        {
          slug: "the-seeker-and-the-long-work",
          title: "The Seeker and the Long Work of Bhagavān",
          booklets: "4-5",
          href: "/series/booklet-four",
          description:
            "Māyā, responsibility, surrender, and the Chiranjeevis as witnesses."
        },
        {
          slug: "grief-as-fire",
          title: "Grief as Fire",
          booklets: "6-7",
          href: "/series/booklet-six",
          description:
            "Grief enters as fire, becomes nāda, becomes vow, becomes offering."
        },
        {
          slug: "nada-as-offering",
          title: "Nāda as Offering",
          booklets: "8",
          href: "/series/booklet-eight",
          description:
            "The seeker turns toward Nādeśvara. The bow becomes rhythm."
        },
        {
          slug: "the-child-returns",
          title: "The Child Returns",
          booklets: "9",
          href: "/series/booklet-nine",
          description:
            "Bhakti becomes childlike again. The child asks to be held."
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
      "Nine booklets on dharma, māyā, nāda, language, surrender, memory, and the long inward journey.",
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
        tag: "Free"
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
        tag: "Available"
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
        tag: "Available"
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
        tag: "Available"
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
        tag: "Available"
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
        tag: "Available"
      },
      {
        slug: "booklet-seven",
        numberLabel: "Booklet Seven",
        title: "Beyond Grief",
        subtitle: "The vow, the chariot, and movement before sunset.",
        description:
          "The seeker no longer asks only why. He stands, gathers the bow, remembers the chariot, and keeps moving before sunset. Grief becomes kinetic force: bow, chariot, horses, arrow-fence, Mādhava, vow, dusk, and protected grief.",
        tag: "Available"
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
        tag: "Available"
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
        tag: "Available"
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
        booklets: "4-5",
        description:
          "Māyā, responsibility, surrender, and the Chiranjeevis as witnesses.",
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
    homeHeroImage:
      "https://thevalluru.org/wp-content/uploads/2026/05/chatgpt-image-may-22-2026-02_43_16-pm-1.png?w=1800",
    pageHeroImage:
      "https://thevalluru.org/wp-content/uploads/2026/05/chatgpt-image-may-22-2026-02_43_16-pm-1.png?w=1600",
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

export function getBookletMovementIndex(booklet: Booklet, fallbackIndex = 0) {
  if (typeof booklet.movementIndex === "number") {
    return Math.min(4, Math.max(0, booklet.movementIndex));
  }

  if (fallbackIndex < 3) {
    return 0;
  }

  if (fallbackIndex < 5) {
    return 1;
  }

  if (fallbackIndex < 7) {
    return 2;
  }

  if (fallbackIndex < 8) {
    return 3;
  }

  return 4;
}

export function getBookletNeighbors(booklets: Booklet[], slug: string) {
  const index = booklets.findIndex((booklet) => booklet.slug === slug);

  return {
    previous: index > 0 ? booklets[index - 1] : undefined,
    next: index >= 0 && index < booklets.length - 1 ? booklets[index + 1] : undefined
  };
}
