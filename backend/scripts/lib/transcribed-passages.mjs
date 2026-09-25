/**
 * Telugu passages inside running prose and verse, read off the rendered PDF pages, for the
 * booklets where the text layer damaged them (booklets one, two and three).
 *
 * Each entry replaces one exact run of stored paragraphs (`from`, the damaged text as the
 * cleaned database holds it) with what the page prints (`to`). Keyed on the damaged text
 * itself rather than a position, so it can only ever touch that passage; where a passage
 * spans several stored paragraphs the entry also joins the pieces a line-wrap had split. One
 * printed verse line is one paragraph, which the reader groups back into a verse block.
 */
export const TRANSCRIBED_PASSAGES = [
  {
    booklet: "booklet-one",
    from: [
      "చదువ%ల' (ెదల' పడ,-.. పదవ%ల' /0 దల' పడ,-.."
    ],
    to: [
      "చదువులు చెదలు పడతాయి. పదవులు ఔదలు పడతాయి."
    ]
  },
  {
    booklet: "booklet-one",
    from: [
      "అమ34.. మ56 ఒక పట:; పట<;.. =>ను క@A- ఒక మ,ేCభE FారIJ లE KాL Mి వదల3O.",
      "PావణRడంతట< KాణUV Wాక/X .=- దండకం ఆయనక' [-ర/X య3\\O.",
      "ఆ ]^ల చPాచర =-దమ_P`CWa, ఆ ]రbc ణ ]PాWార =-దబLహ4Wa, ఆ నటPాfWa .. అgే ఈ నట:Ai",
      "=-ద jPాజనం ."
    ],
    to: [
      "అమ్మా.. మళ్లీ ఒక పట్టు పట్టి.. నేను కూడా ఒక మత్తేభమో శార్దూలమో వ్రాసి వదలాలి.",
      "రావణుడంతటి వాణ్ని కాకపోయినా దండకం ఆయనకు ధారపోయ్యాలి.",
      "ఆ నిఖిల చరాచర నాదమూర్తికి, ఆ నిర్గుణ నిరాకార నాదబ్రహ్మకి, ఆ నటరాజుకి.. అదే ఈ నటుడి నాద నీరాజనం."
    ]
  },
  {
    booklet: "booklet-one",
    from: [
      "ఓంWార =-దమR ఆద\\ంత రmnతమR; =-దప%రbషp] Mqవ=> పరమ3రrమR.. సరt Fuక",
      "]KారణమR , మ3య3 ]వృwC, ]PాtణమR ."
    ],
    to: [
      "ఓంకార నాదము ఆద్యంత రహితము; నాదపురుషుని సేవనే పరమార్థము.. సర్వ శోక నివారణము, మాయా నివృత్తి, నిర్వాణము."
    ]
  },
  {
    booklet: "booklet-one",
    from: [
      "సపC ఋషpల' సyయం (ేయ\\లzనప%{డ|; g}Wా{లక'ల' gేK>ందుL ] M~ౖతం gెబMినప%{డ|.",
      "న4న =-థుడ| మనం వmnంనప%{డ|. జగ=-4త క@A- ఆయన మ3ట Wాద] , Wడ|క'",
      "ిO=- కదO Pానప%{డ| . ర\\ ఆకా4తpC ా , అప%{Aే ]దL లzన భరC వదJక' Wడ|క' కబరం",
      "సుక'వ WాలమనVప%{డ| . ]లబడ,-Kా ? ]లబడగలKా ?"
    ],
    to: [
      "సప్త ఋషులు సహాయం చేయ్యలేనప్పుడు; దిక్పాలకులు దేవేంద్రుని సైతం దెబ్బతీసినప్పుడు. నమ్మిన నాథుడు మౌనం వహించినప్పుడు. జగన్మాత కూడా ఆయన మాట కాదని, కొడుకు పిలిచినా కదలి రానప్పుడు. భార్య ఆకస్మాత్తుగా, అప్పుడే నిద్ర లేచిన భర్త వద్దకు కొడుకు కళేబరం తీసుకువచ్చి కాల్చమన్నప్పుడు. నిలబడతావా? నిలబడగలవా?"
    ]
  },
  {
    booklet: "booklet-one",
    from: [
      "…P పOW మ3 అమ4 దiణ Wా5 పలకల. తంAiL సమ3[-నవtల. Wడ|క'] ఆయనW",
      "అP`{ం(ేFాను . కథ Wాదుా , యRగమR కO ా . ఆ సుఖ3ంతమR ఉండదు..."
    ],
    to: [
      "…రోజూ పలికే మా అమ్మ దక్షిణ కాళీ పలకల. తండ్రి సమాధానమివ్వల. కొడుకుని ఆయనకే అర్పించేశాను. కథ కాదుగా, యుగము కలి గా. ఆ సుఖాంతము ఉండదు..."
    ]
  },
  {
    booklet: "booklet-two",
    from: [
      "\u0002త్వ వ మాతా చ పితామే \u0002 త్వ వ ।మే \u0002త్వ వమే బం ధు\u000eశ్చ\u0010 సఖా \u0002 త్వ వ ।మే \u0002త్వ వ విమే ద్యా\u0015 ద్ర\u0017 వి ణం \u0002త్వ మేవ । \u0002త్వ వ సమే \u0002ర్వం మమ దే వ దే వ ॥"
    ],
    to: [
      "త్వమేవ మాతా చ పితా త్వమేవ ।",
      "త్వమేవ బంధుశ్చ సఖా త్వమేవ ।",
      "త్వమేవ విద్యా ద్రవిణం త్వమేవ ।",
      "త్వమేవ సర్వం మమ దేవ దేవ ॥"
    ]
  },
  {
    booklet: "booklet-two",
    from: [
      "And the Devī tradition says the same thing through another door: యా దేవీ స \u0002ర్వం భూ తే షు\u000e మా #త్వ ర్వం పే ణం స & స్థి తా । నమస(*స్యై నమస(*స్యై నమస(*స్యై నమో న మ, ॥"
    ],
    to: [
      "And the Devī tradition says the same thing through another door:",
      "యా దేవీ సర్వభూతేషు మాతృరూపేణ సంస్థితా ।",
      "నమస్తస్యై నమస్తస్యై నమస్తస్యై నమో నమః ॥"
    ]
  },
  {
    booklet: "booklet-two",
    from: [
      "ఓం ఇ\u0015తే త్వ ద్ర క్ష ర్వం మి ద్ర స\u0002ర్వం । త్వ స్యో\u0015 పవ్యా\u0015 ఖా\u0015 న భూ త్వ భూవద్ భూవి షు\u0015దితి స \u0002ర్వం మో కా ర్వం ఏవ । యచ్చా\u0010 న\u0015త్ తి< కాలాతీ త్వ త్వ ద్ర ప్యోం\u0015 కా ర్వం ఏవ ॥"
    ],
    to: [
      "ఓం ఇత్యేతదక్షరమిదం సర్వం ।",
      "తస్యోపవ్యాఖ్యానం భూతం భవద్ భవిష్యదితి సర్వమోంకార ఏవ ।",
      "యచ్చాన్యత్ త్రికాలాతీతం తదప్యోంకార ఏవ ॥"
    ]
  },
  {
    booklet: "booklet-two",
    from: [
      "డమడAమడAమడAమCన్ని నా ద్ర వడAమ\u0002ర్వం య । చకా ర్వం చ డతా డవ త్వ నో \u000eత్వ న, శి వ, వమ్ ॥ శి"
    ],
    to: [
      "డమడ్డమడ్డమడ్డమన్నినాదవడ్డమర్వయం ।",
      "చకార చండతాండవం తనోతు నః శివః శివమ్ ॥"
    ]
  },
  {
    booklet: "booklet-two",
    from: [
      "స\u0002ర్వం ధుర్మాI న్ పరి \u0015త్వ \u0015జ్య మామే కం శ్చ ర్వం ణం వNజ్య । అహం తా\u0002 స\u0002ర్వం పాపే \u0015భ్యో మోక్షయి ష్యా\u0015 మి మా శ్చ\u000e చ, ॥"
    ],
    to: [
      "సర్వధర్మాన్ పరిత్యజ్య మామేకం శరణం వ్రజ ।",
      "అహం త్వా సర్వపాపేభ్యో మోక్షయిష్యామి మా శుచః ॥"
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "నరుఁ\u0003డవునీ వు ము న\bఖిలనా థుఁ\u0003డ\u000eవై న ముకుం\u0010దుతోడ",
      "\u0014 దుస్త ర తపమా చ రిం\u0010 చి జగతీభర రక్షణకార ణ\u0010బుగా",
      "ధరణి నవత రిం\u0010 న పురాతనఋషి వనియెచి ల.నున్",
      "విచా రిం తమయె ఱుం\u0010గుదున్ న రుఁనిని ను\b జ\u0010యిం ప\u0003గనె వ8\u0003డే రుఁ:నే !"
    ],
    to: [
      "నరుఁడవు నీవు మున్నఖిలనాథుఁడవైన ముకుందుతోడ",
      "దుస్తర తప మాచరించి జగతీభర రక్షణకారణంబుగా",
      "ధరణి నవతరించిన పురాతనఋషి వని యెల్లనున్",
      "విచారితమ యెఱుంగుదున్ నరుని నిన్ను జయింపఁగ నెవ్వఁడేర్చునే!"
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "స్త వ్యే= న రశ్మీ? న్ జ గా@ హ ధనుB స్త వ్యే= నచామి తB ।",
      "\u0014 తథా తు యు ధ=మా న\u0010 త\u0010 దదIశుస్తాం \u0010 శ్చ: దానవాన్ ॥ With his left hand, he gathered the reins; with that same left hand, he held the bow. The dānavas saw him fighting like that — charioteer and warrior at once."
    ],
    to: [
      "సవ్యేన రశ్మీన్ జగ్రాహ ధనుః సవ్యేన చామితః ।",
      "తథా తు యుధ్యమానం తం దదృశుస్తాం శ్చ దానవాన్ ॥",
      "With his left hand, he gathered the reins; with that same left hand, he held the bow. The dānavas saw him fighting like that — charioteer and warrior at once."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "ధరణీచ క్ర ముR గRకుంSన\u0010 గదలది గU\u0010తావళ శ్రేR ణి క్ర\u0010",
      "ధరముల్మొ గ[\u0010 బడన్దిశా వలయ ము తS\u0010ప\u0010బుగానీ బ ల\u0010",
      "బురుఁలన్బా జ\u0010గభీ ష్ము? \u000eపై గవిసెరౌ ద్రో@ ద్రేg క్ర ము\u0010 జూచిఖే",
      "చరలో క్ర\u0010 బును \u0010స్త చలిం\u0010 ప హరిం చ\u0010చదాl హుఘోరా క్రI తిన్ .",
      "అం\u0010హోమ రrను\u0003 డాజనా రrను\u0003డుమా ద=ద్భీv ?ష్మ కుం\u0010\u0010భీ దుR \u000eపై",
      ". \u0010సిం హో ల్లా స్త విభా సిం \u000eయె క్ర యు నువి |త్సే క్ర\u0010 బునాటో పమున్",
      "ర\u0010హ~|స్త రిం\u0014 యు ద్భీ ప\u0014మ~రిం\u0014 యును \u0010స్త ర\u0010భ\u0010బు\u0003 జూడన్ జగ",
      "R త|\u0010హారో ను?ఖుఁ\u0003 \u000eడై నరుఁదుగతిరౌ దgపRక్రిR య\u0010 బొ లిం: నన్ ."
    ],
    to: [
      "ధరణీచక్రము గ్రక్కునం గదల దిగ్ధంతావళశ్రేణికం",
      "ధరముల్ మొగ్గం బడన్ దిశావలయ ముత్కంపంబుగా నీ బలం",
      "బురులన్ బాజంగ భీష్ముపై గవిసె రౌద్రోద్రేకముం జూచి ఖే",
      "చరలోకంబును సంచలింప హరి చంచద్బాహు ఘోరాకృతిన్.",
      "అంహోమర్దనుఁ డాజనార్దనుఁడు మాద్యద్భీష్మకుంభీంద్రుపై",
      "సింహోల్లాసవిభాసి యై కవియు నుత్సేకంబు నాటోపమున్",
      "రంహస్స్ఫూర్తియు దీప్తమూర్తియును సంరంభంబుఁ జూడన్ జగ",
      "త్సంహారోన్ముఖుఁ డైనరుద్రుగతి రౌద్రప్రక్రియం బొల్చినన్."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "The verse “ధరణీచ క్ర ముR …” is in Mattēbha-vikrīḍitam. The verse “అం\u0010హోమ రrను\u0003డు…” is in Śārdūlam."
    ],
    to: [
      "The verse “ధరణీచక్రము…” is in Mattēbha-vikrīḍitam. The verse “అంహోమర్దనుఁడు…” is in Śārdūlam."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      " \u0014 క్ర డగియేవీ రుఁ నేయు న స్త ములకై ననెది\u000e రిం యవ8ల నడచుజే \u0010యె డుR",
      "గడగినడచు న మ్మే? టి జగములీ నలు గడలనుగలుగు భ~త్సే శుడీ శ్చ8 రుఁ\u0010డనఘ",
      "నుమువి ."
    ],
    to: [
      "కడగి యే వీరు నేయు నస్త్రములకైననెదిరి యవ్వల నడచు జే యెంద్రు",
      "గడగినడచు నమ్మేటి జగము లీ నలు గడలనుగలుగు భూతేశు డీశ్వరుండనఘ",
      "వినుము."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "Here the repeated sound — క్ర డగి / గడగి / నడచు — matters. It creates the sense of striding. Rudra is not sitting in abstraction. He is advancing ahead."
    ],
    to: [
      "Here the repeated sound — కడగి / గడగి / నడచు — matters. It creates the sense of striding. Rudra is not sitting in abstraction. He is advancing ahead."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "జయదయాపాథోధి ! జయపుణ=మ~రిం\u0014 ! జయజయ, దశ్చ దిశా స్తాం\u0010 దgస్త తీS రిం\u0014",
      "జయద్భీ నపో ష్మ ణ! జయస్త తSI\u0010పా గ!",
      "జయజయశ్రీరా మ ! చరణా బభI\u0010గ!"
    ],
    to: [
      "జయదయాపాథోధి! జయపుణ్యమూర్తి!",
      "జయజయ, దశదిశాసాంద్రసత్కీర్తి",
      "జయదీనపోషణ! జయసత్కృపాంగ!",
      "జయజయశ్రీరామ! చరణాబ్జభృంగ!"
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "ఇం\u0010దు గల\u0003 డ\u0010దు లేఁ\u0003 డని",
      "\u0010స్త ద్రే హము వలదు చక్రిR స్త రో8 పగతు\u0010",
      "\u0010డై దెం\u0010 దు వై దక్రి చ~నచి",
      "న\u0010ద\u0010ద్రే క్ర ల\u0003డుదా నవా గRణి ! \u0010 వి టే ."
    ],
    to: [
      "ఇందు గలఁ డందు లేఁ డని",
      "సందేహము వలదు చక్రి సర్వోపగతుం",
      "డెం దెందు వెదకి చూచిన",
      "నందందే కలఁడు దానవాగ్రణి! వింటే."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "The meter is kanda padyam. Kanda gives compact certainty. It does not wander. It does not",
      "build a long philosophical thesis. The repeated spatial movement — ఇం\u0010దు / అం\u0010దు /",
      "ఎం\u0010దెం\u0010 దు / అం\u0010ద\u0010ద్రే — makes omnipresence audible."
    ],
    to: [
      "The meter is kanda padyam. Kanda gives compact certainty. It does not wander. It does not build a long philosophical thesis. The repeated spatial movement — ఇందు / అందు / ఎందెందు / అందందే — makes omnipresence audible."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "సిం రిం క్రి\u0010 జె ప¡\u0003డు; శ్చ\u0010 ఖ చక్ర R యుగము\u0010 జే ద్రో యిం \u0010స్త ధి\u0010 ప\u0003; డే",
      "పరిం వా ర\u0010బును\u0003 జీ ర\u0003 డభgగపతి\u0010 బ\b\u0010ని ప\u0003 డా క్ర రిం¤ కా\u0010",
      "తర ధమి? ల.ము\u0003 జక్రS నొ త\u0014\u0003డు; దవివా @పో తి¦ తశ్రీ కుంచో",
      "పరిం చే ల్లా\u0010 చలమై\u000e నవీ డ\u0003డు గజ@పా ణావనో |తా హి \u000eయె ."
    ],
    to: [
      "సిరికిం జెప్పఁడు; శంఖ చక్ర యుగముం జేదోయి సంధింపఁ; డే",
      "పరివారంబునుఁ జీరఁ డభ్రగపతిం బన్నింపఁ డాకర్ణికాం",
      "తర ధమ్మిల్లముఁ జక్క నొత్తఁడు; వివాద ప్రోత్థిత శ్రీ కుచో",
      "పరిచేలాంచలమైన వీడఁడు గజప్రాణావనోత్సాహియై."
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "His kīrtana “ఇం8క్ష్వా కుం కుంలతిల క్ర ” carries that anguish with astonishing intimacy:"
    ],
    to: [
      "His kīrtana “ఇక్ష్వాకు కులతిలక” carries that anguish with astonishing intimacy:"
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "మీ త\u0010gడ్రి దశ్చ రథ మహారాజు పై ²ట్టె నారా మ చ\u0010దా@",
      "లేఁ క్ర మీమా మ జన క్ర మహారాజు ప\u0010పై నారా మ చ\u0010దా@ ॥ ఇం8క్ష్వా కుం కుంలతిల క్ర ॥"
    ],
    to: [
      "మీ తండ్రి దశరథ మహారాజు పెట్టెనా రామచంద్రా",
      "లేక మీ మామ జనక మహారాజు పంపెనా రామచంద్రా ॥ ఇక్ష్వాకు కులతిలక ॥"
    ]
  },
  {
    booklet: "booklet-three",
    from: [
      "Krishna rushing at Bhishma shows language becoming divine protection. The Lord’s",
      "compassion outruns even His own stipulation. In Mattēbha-vikrīḍitam, “ధరణీచ క్ర ము…” R",
      "makes the earth tremble with elephantine force; in Śārdūlam, “అం\u0010హోమ రrను\u0003డు…” gives Krishna’s rush a leonine, Rudra-like ferocity."
    ],
    to: [
      "Krishna rushing at Bhishma shows language becoming divine protection. The Lord’s compassion outruns even His own stipulation. In Mattēbha-vikrīḍitam, “ధరణీచక్రము…” makes the earth tremble with elephantine force; in Śārdūlam, “అంహోమర్దనుఁడు…” gives Krishna’s rush a leonine, Rudra-like ferocity."
    ]
  }
];
