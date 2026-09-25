/**
 * Booklet nine's Telugu, read off the rendered PDF pages.
 *
 * The verse font's text layer decodes glyphs to wrong Unicode, so every Telugu line of every
 * poem, every Telugu "భావము" note and every Telugu chapter subtitle came out damaged. Each
 * poem is printed as a Telugu line with its Roman transliteration beneath; the Roman line
 * extracts intact and is kept as stored, while the Telugu line and the భావము are what the
 * page shows. Each Telugu line was cross-checked against its own Roman line (a transliteration
 * of the Roman, compared by consonant skeleton) as a second reading. `key` is the English part
 * of the chapter title, which the damage does not touch.
 */
export const TRANSCRIBED_BOOKLET_NINE = [
  {
    key: "1. The Mirror of Māyā",
    title: "1. The Mirror of Māyā మాయా అద్దం",
    lines: [
      ["మాయా అద్దములోనన్", "māyā addamulōnan"],
      ["మేనిమిది నాది యనుకొంటిని ।", "mēnimidi nādi yanukoṇṭini."],
      ["నీవు చూపిన చీలికలో", "nīvu cūpina cīlikalō"],
      ["నిజమరసి నవ్వితిని తండ్రీ ॥", "nijamarasi navvitini taṇḍrī."]
    ],
    bhavam: "దేహం, రూపం, పాత్ర, గర్వం — ఇవన్నీ అద్దంలో కనిపించిన ప్రతిబింబాలే. భక్తుడు తనను తాను చూసి మోసపోయిన సంగతి గ్రహిస్తున్నాడు. అద్దం పగిలినప్పుడు నాశనం కాలేదు; అబద్ధం బయటపడింది."
  },
  {
    key: "2. The Māyā of Offering",
    title: "2. The Māyā of Offering నైవేద్య మాయ",
    lines: [
      ["నైవేద్యమని పెట్టి", "naivēdyamani peṭṭi"],
      ["నాలుకకై దాచుకొంటిని తల్లీ ।", "nālukakai dācukoṇṭini tallī."],
      ["నీదని తెలిసిన తరువాత", "nīdani telisina taruvāta"],
      ["నాకేమి మిగిలెనమ్మా? ॥", "nākēmi migilenammā?"]
    ],
    bhavam: "భక్తుడు నైవేద్యం కూడా తన భక్తి కోసం మలిచిన చిన్న మాయను నవ్వుకుంటున్నాడు. దేవునికిచ్చినట్టు చేసి, లోపల తన కోరికను దాచుకున్నాడు. చివరికి అన్నీ అమ్మవారిదే అని గ్రహిస్తున్నాడు."
  },
  {
    key: "3. Kannikattu",
    title: "3. Kannikattu కన్నికట్టు",
    lines: [
      ["కళ్లుకట్టో కన్నికట్టో", "kaḷḷukaṭṭō kannikaṭṭō"],
      ["కట్టితివి నన్ను కారుణ్యమూర్తే ।", "kaṭṭitivi nannu kāruṇyamūrtē."],
      ["జపమాల గిర్రున తిరిగె;", "japamāla girruna tirige;"],
      ["భజనలు బిర్రాయె — గుణం సోకలే ॥", "bhajanalu birrāye - guṇaṃ sōkalē."],
      ["తంతులు చేసితి; తంత్రం", "tantulu cēsiti; tantraṃ"],
      ["నేర్చితి — తాయెత్తులెల్ల తెగిపోయె ।", "nērciti - tāyettulella tegipōye."],
      ["గంటలు మ్రోగె; గంధం", "gaṇṭalu mrōge; gandhaṃ"],
      ["అరిగె; గోడు తీరలే గోపాలా ॥", "arige; gōḍu tīralē gōpālā."],
      ["కర్మంబేదో కానన్;", "karmambēdō kānan;"],
      ["ఖర్మశేషము తెలియదు కన్నా ।", "kharmaśēṣamu teliyadu kannā."],
      ["కనిపించి కాపాడుట", "kanipinci kāpāḍuṭa"],
      ["నీకు అంత కష్టమా తండ్రీ? ॥", "nīku anta kaṣṭamā taṇḍrī?"],
      ["నీదు కొడుకుతో కయ్యం", "nīdu koḍukutō kayyaṃ"],
      ["ఇంక చాలదా? దయ కొంచెము రాదా? ।", "inka cāladā? daya koñcemu rādā?"],
      ["కుచేలునితో నీ కరుణ", "kucēlunitō nī karuṇa"],
      ["ఖర్చాయెనా కృష్ణా? శరణు సారథీ! ॥", "kharcāyenā kṛṣṇā? śaraṇu sārathī!"]
    ],
    bhavam: ""
  },
  {
    key: "3. Notes",
    title: "3. Notes",
    lines: [

    ],
    bhavam: "కన్నికట్టు అంటే ఇక్కడ భక్తుని మీద కృష్ణుని మాయా-కరుణ. బయట జపమాల తిరిగింది, భజనలు పెరిగాయి, తంత్రం, తాయెత్తులు, గంటలు, గంధం అన్నీ జరిగాయి. కానీ గుణం అంతరంగంలో తగల్లేదు. చివరికి భక్తుడు సరదాగా అడుగుతున్నాడు: కుచేలునితో నీ కరుణ అంతా ఖర్చైపోయిందా?"
  },
  {
    key: "4. Invocation of Kālikā",
    title: "4. Invocation of Kālikā కాళికా ఆవాహన",
    lines: [
      ["ఖట్వాంగధరే కాళికే!", "khaṭvāṅgadharē kālikē!"],
      ["ఖోదితే ఖడ్గధారిణి!", "khōditē khaḍgadhāriṇi!"],
      ["ఖేచరసేవితే కపాలధారిణి!", "khēcarasēvitē kapāladhāriṇi!"],
      ["ముక్తకేశి మహాభీమే,", "muktakēśi mahābhīmē,"],
      ["రణరంగ మృత్యుభయంకరి ।", "raṇaraṅga mṛtyubhayaṅkari."],
      ["తవ సుతోఽహమంబే,", "tava sutō'hamambē,"],
      ["రణమధ్యే న మే భయం ॥", "raṇamadhyē na mē bhayaṃ."],
      ["యుద్ధజ్వాలాసు మాతః,", "yuddhajvālāsū mātaḥ,"],
      ["మా పరిత్యజ మాం క్వచిత్ ।", "mā parityaja māṃ kvacit."],
      ["వక్షస్థలే కట్యాంకే వా,", "vakṣasthalē kaṭyāṅkē vā,"],
      ["మా ముఞ్చ మాం స్వసుతం శివే ॥", "mā muñca māṃ svasutaṃ śivē."],
      ["కాలాగ్నిదహనమూర్తే,", "kālāgnidahanamūrtē,"],
      ["కాలాంతకసహచారిణి,", "kālāntakasahacāriṇi,"],
      ["కరుణాపయోనిధే —", "karuṇāpayōnidhē -"],
      ["మాం పాలయ జగన్మాతః ।", "māṃ pālaya jaganmātaḥ."],
      ["భైరవి భద్రకాళి త్వం,", "bhairavi bhadrakāli tvaṃ,"],
      ["ధారయ మాం లోకపావని ॥", "dhāraya māṃ lōkapāvani."]
    ],
    bhavam: ""
  },
  {
    key: "4. Notes",
    title: "4. Notes",
    lines: [

    ],
    bhavam: "ఇక్కడ భక్తి మృదువుగా లేదు; శాక్తంగా, ఉగ్రంగా, తల్లికి నేరుగా పిలుపుగా ఉంది. కాళి భయంకరురాలు కాదు. తన బిడ్డకు భయరహిత శరణ్యం."
  },
  {
    key: "5. In Kālikāmbā’s Lap",
    title: "5. In Kālikāmbā’s Lap కాళికాంబా ఒడిలో",
    lines: [
      ["కర్మంబు తోసెను; గ్రహగణంబులు గేలి చేసెను;", "karmambu tōsenu; grahagaṇambulu gēli cēsenu;"],
      ["దిక్పాలకులు చూచి దయలేక నిలిచిరమ్మా ।", "dikpālakulu cūci dayalēka nilicirammā."],
      ["దుఃఖనష్టశరములు దేహమనస్సులన్ చీల్చగా,", "duḥkhanaṣṭaśaramulu dēhamanassulan cīlcagā,"],
      ["“అంబకు చెప్పెదన్!” యని అబద్ధధైర్యమున్ నిలిచితిన్ ॥", "“ambaku ceppedan!” yani abaddhadhairyamun nilicitin."],
      ["ఇప్పుడు తవ ఒడిలోనన్, ప్రతికారాసక్తి చల్లారెను;", "ippuḍu tava oḍilōnan, pratikārāsakti callārenu;"],
      ["వారును నీ సంతతియై యుండవచ్చునమ్మా ।", "vārunu nī santatiyai yuṇḍavaccunammā."],
      ["శిక్షింతువో క్షమింతువో — తవ చిత్తమే కాళికే;", "śikṣintuvō kṣamintuvō - tava cittamē kālikē;"],
      ["వారి గుణదోషములు నీ దృష్టికే విదితము ॥", "vāri guṇadōṣamulu nī dṛṣṭikē viditamu."],
      ["నన్ను మాత్రం విడువకు; మరల భువిలో ఒంటరిగ నడువనీయకు;", "nannu mātraṃ viḍuvaku; marala bhuvilō oṇṭariga naḍuvanīyaku;"],
      ["వక్షస్థలే కట్యాంకే వా బిగిగా ధరించుమంబా ।", "vakṣasthalē kaṭyāṅkē vā bigigā dhariñcumambā."],
      ["గాయములన్నియు నీ కరస్పర్శమందు మసకబడున్;", "gāyamulanniyu nī karasparśamandu masakabaḍun;"],
      ["నీ ఒడిలో దాగిన బిడ్డను దింపవద్దు జగన్మాతః ॥", "nī oḍilō dāgina biḍḍanu dimpavaddu jaganmātaḥ."]
    ],
    bhavam: ""
  },
  {
    key: "5. Notes",
    title: "5. Notes",
    lines: [

    ],
    bhavam: "భక్తుడు మొదట తనను గాయపరిచిన వారిపై ప్రతీకారం కోరుతున్నట్టు ఉన్నాడు. కానీ అమ్మ ఒడిలో చేరగానే ప్రతీకారం చల్లారుతుంది. వారూ అమ్మ పిల్లలే కావచ్చని భావన వస్తుంది. తాను మాత్రం మళ్ళీ ఒంటరిగా దింపవద్దని అడుగుతున్నాడు."
  },
  {
    key: "6. Only in the Lap",
    title: "6. Only in the Lap ఒడిలోనే",
    lines: [
      ["శుద్ధి చేసి మేను శోభన మార్చినా", "śuddhi cēsi mēnu śōbhana mārcinā"],
      ["ఆత్మముద్ద నన్ను ఆదరింప ।", "ātmamudda nannu ādariṃpa."],
      ["లాలి పాడి నన్ను లాలించి దింపితి", "lāli pāḍi nannu lālinci dimpiti"],
      ["లాలి పాడి నన్ను లాలిపుచ్చు ॥", "lāli pāḍi nannu lālipuccu."],
      ["మాయ దాసి నన్ను మాయకు దింపకు", "māya dāsi nannu māyaku dimpaku"],
      ["మాయ దయలు మోసమగును తల్లి ।", "māya dayalu mōsamagunu talli."],
      ["నిన్ను కాని వేళ నాలో భయము నిండె", "ninnu kāni vēḷa nālō bhayamu niṇḍe"],
      ["మాయ యింట మాయ మింగు తల్లి ॥", "māya yiṇṭa māya miṅgu talli."],
      ["మాత నన్ను మాయకు మరల దింపకు", "māta nannu māyaku marala dimpaku"],
      ["మాత చెంత నన్ను మెల్ల దాచు ।", "māta centa nannu mella dācu."],
      ["కట్యమందు నన్ను కదలక దాచుము", "kaṭyamandu nannu kadalaka dācumu"],
      ["కాళి నన్ను దాచు కట్యమందు ॥", "kāli nannu dācu kaṭyamandu."]
    ],
    bhavam: "శుద్ధి, మేను మార్చుట, ఆత్మకు ముద్ద పెట్టుట, లాలి పాడుట — ఇవన్నీ అమ్మ ఒడిలోనే జరగాలి అని బిడ్డ కోరుతున్నాడు. మాయను దాసి, ఆయా, సవతి వలె భావించి అమ్మకు అప్పగించవద్దని ప్రార్థిస్తున్నాడు."
  },
  {
    key: "7. Brother Bhārgava Rāma",
    title: "7. Brother Bhārgava Rāma రామన్నా భార్గవరామా",
    lines: [
      ["విప్రుడనే విప్రోత్తమా,", "vipruḍanē viprōttamā,"],
      ["రామన్నా భార్గవరామా ।", "rāmanna bhārgavarāmā."],
      ["యుగములు చూచితివయ్యా —", "yugamulu cūcitivayyā -"],
      ["ముందరి కథలు చెప్పవే అన్నా ॥", "mundari kathalu ceppavē annā."],
      ["దత్తునొద్ద వినితివి;", "dattunoḍḍa vinitivi;"],
      ["శివునిచే పరశు పొందితివి ।", "śivunicē paraśu ponditivi."],
      ["రామచూపున్ వంగితివి —", "rāmacūpun vaṅgitivi -"],
      ["ఆ ముచ్చట్లు విప్పవే పెద్దన్నా ॥", "muccaṭlu vippavē peddannā."],
      ["నేను వారియొడిలోన", "nēnu vāriyoḍilōna"],
      ["ఇప్పుడే చేరిన బిడ్డనయ్యా ।", "ippuḍē cērina biḍḍanayyā."],
      ["నాకుముందర మన ఇంటి", "nākumundara mana iṇṭi"],
      ["కథలన్నియు చెప్పవే ఓరన్నా ॥", "kathalanniyu ceppavē ōrannā."]
    ],
    bhavam: "పరశురాముని దూర అవతారంగా కాక, పెద్ద అన్నగా పిలుస్తున్నాడు. తాను ఇప్పుడు తల్లిదండ్రుల ఒడిలో చేరిన చిన్న బిడ్డ. ముందరి ఇంటి కథలు అన్నీ చెప్పాలి."
  },
  {
    key: "8. Tell Me, Brother Vyāsa",
    title: "8. Tell Me, Brother Vyāsa వ్యాసన్నా చెప్పవే",
    lines: [
      ["వ్యాసన్నా చెప్పవే", "vyāsannā ceppavē"],
      ["వేదముల ముద్దు కథలే ।", "vēdamula muddu kathalē."],
      ["నిన్నడిగె బిడ్డనయ్యా", "ninnaḍige biḍḍanayyā"],
      ["నిజములు కాదు — మనవే ॥", "nijamulu kādu - manavē."],
      ["కృష్ణుని నవ్వెట్లుండె?", "kṛṣṇuni navveṭluṇḍe?"],
      ["రాధమ్మ చూపెంత మధురం?", "rādhamma cūpenta madhuraṃ?"],
      ["రాముని నడక వినిపించు", "rāmuni naḍaka vinipiñcu"],
      ["సీతమ్మ పలుకు చెప్పవే ॥", "sītamma paluku ceppavē."]
    ],
    bhavam: "వ్యాసుడు ఇక్కడ గ్రంథకర్త కాదు; గడ్డమన్న. బిడ్డకు వేద రహస్యాలు అవసరం లేదు. తండ్రి-తల్లి, రామ-సీత, రాధా-కృష్ణుల ఇంటి ముచ్చట్లు కావాలి."
  },
  {
    key: "9. Stories in Amma’s Lap",
    title: "9. Stories in Amma’s Lap అమ్మొడిలో కథలు",
    lines: [
      ["వ్యాసన్నా భార్గవరామా", "vyāsannā bhārgavarāmā"],
      ["వేదమర్మముల్ వద్దయ్యా ।", "vēdamarmamul vaddayyā."],
      ["సృష్టిరహస్యముల్ చాలయ్యా —", "sṛṣṭirahasyamul cālayyā -"],
      ["అమ్మొడిలో ఉండగా అవి దేనికయ్యా? ॥", "ammoḍilō uṇḍagā avi dēnikayyā?"],
      ["అస్త్రమంత్రముల్ వద్దయ్యా;", "astramantramul vaddayyā;"],
      ["అసురవధగాథల్ విననయ్యా ।", "asuravadhagāthal vinanayyā."],
      ["తల్లియొడిలో కూర్చొని", "talliyoḍilō kūrconi"],
      ["తండ్రి ముచ్చట్లు చెప్పుడయ్యా ॥", "taṇḍri muccaṭlu ceppuḍayyā."],
      ["రామసీతల నవ్వులు,", "rāmasītala navvulu,"],
      ["రాధాకృష్ణ మురిపాలు ।", "rādhākṛṣṇa muripālu."],
      ["నాకుముందర మనింటి", "nākumundara maniṇṭi"],
      ["వారింత జగన్మోహులేనా? ॥", "vārinta jaganmōhulēnā?"],
      ["ఇప్పుడున్నట్లే అప్పుడున్", "ippuḍunnatlē appuḍun"],
      ["తల్లితండ్రులింత మధురులా? ।", "tallitaṇḍrulinta madhurulā?"],
      ["చెప్పవే గడ్డమన్నా;", "ceppavē gaḍḍamannā;"],
      ["విప్పవే రామన్నా మన కథలు ॥", "vippavē rāmanna mana kathalu."]
    ],
    bhavam: ""
  },
  {
    key: "9. Notes",
    title: "9. Notes",
    lines: [

    ],
    bhavam: "అమ్మ ఒడిలో ఉన్నప్పుడు రహస్యాలు, మంత్రాలు, యుద్ధగాథలు అవసరం లేదు. మన ఇంటి ముచ్చట్లు కావాలి. ఇక్కడ భక్తి పూర్తిగా కుటుంబ సాన్నిహిత్యంలోకి మారుతుంది."
  },
  {
    key: "10. Service-Play",
    title: "10. Service-Play సేవాటలు",
    lines: [
      ["బలము నివైన దీనుల కు తృప్తి నొసంగి నిదాన వాలెదన్ ।", "balamu nivaina dīnula ku tṛpti nosaṅgi nidāna vāledan."],
      ["సలుపు కు నాది నాథున కు మోద గనైన కుమార గాంచెదన్ ।", "salupu ku nādi nāthuna ku mōda ganaina kumāra gāñcedan."],
      ["అలుపుని జూచి నాన్నయె కు నీవు కుమార నితెమ్మి భూమినన్ ।", "alupuni jūci nānnaye ku nīvu kumāra nitemmi bhūminan."],
      ["తలపు నివైన బాలుని కు నీవు నిరమ్ము నివైపు తోలుకో ॥", "talapu nivaina bāluni ku nīvu nirammu nivaipu tōlukō."]
    ],
    bhavam: "అమ్మ అనుమతితో భూమిలో ఉండి ఆడుకుంటున్న బిడ్డ సేవ చేయాలని కోరుతున్నాడు. దీనులకు తృప్తి కలిగించడం తండ్రి సేవ. అలసటను తండ్రి చూసినా, తలపును అమ్మ గుర్తించినా, చివరికి అతన్ని తిరిగి పిలుచుకోవచ్చు."
  },
  {
    key: "11. Silence the Noise Silence the Noise",
    title: "11. Silence the Noise Silence the Noise",
    lines: [
      ["మాతవి నీవె; గాచెదవు మాకు వినోదము గాని శోకమే?", "mātavi nīve; gācedavu māku vinōdamu gāni śōkamē?"],
      ["రాతలు నీకు గానమున రాగము జారక కూర్చి రాయనా", "rātalu nīku gānamuna rāgamu jāraka kūrci rāyanā"],
      ["చేతలు నీవిగా మనసు చేసెడి ఘోషను ఆర్పరాదుగా?", "cētalu nīvigā manasu cēsēḍi ghōṣanu ārparādugā?"],
      ["మోతను మోయనూ వలదు; మోహము బాపి కుమారు గాచుమా ॥", "mōtanu mōyanū valadu; mōhamu bāpi kumāru gācumā."]
    ],
    bhavam: "అమ్మ తల్లి అయితే ఈ శోకం వారి వినోదమా అని భక్తుడు అడుగుతున్నాడు. రాతలు ఆమెకై అయితే రాగం జారకూడదు. చేతలు ఆమెవే అయినా, మనసు చేసే ఘోష భరించలేనిది. కాబట్టి మోహాన్ని తొలగించి కుమారుని కాపాడమని వేడుకుంటాడు."
  },
  {
    key: "12. The Costume of Vairāgya",
    title: "12. The Costume of Vairāgya వైరాగ్యవేషం",
    lines: [
      ["విరహం నీకని భారమైమసలునే వైరాగ్యవేషంబిదో ।", "virahaṃ nīkani bhāramai masalunē vairāgyavēṣambidō."],
      ["కురులం మాపితి; కాచినా మనసులుం కౌమోదకా కింపరా? ॥", "kurulaṃ māpiti; kācinā manasuluṃ kaumōdakā kimparā?"],
      ["తిరునాముం చదివేను; కాలినడకై తీర్థాలు జేసేను నా-- ।", "tirunāmuṃ cadivēnu; kālinaḍakai tīrthālu jēsēnu nā--"],
      ["విరహాగ్నేమియు మారగా నిజము దైవాగ్నై సుశాంతైందిగా? ॥", "virahāgnēmiyu māragā nijamu daivāgnai suśāntaindigā?"]
    ],
    bhavam: "భగవద్విరహం నిజమా, లేక వైరాగ్యవేషమా అని భక్తుడు తనను తాను ప్రశ్నిస్తున్నాడు. కురులు మాపినాడు, తిరునామం చదివాడు, కాలినడక తీర్థాలు చేశాడు. కానీ మనసు ఇంకా కాలుతుందా? విరహాగ్ని దైవాగ్ని శాంతించిందా?"
  },
  {
    key: "13. Mango-Shoot Colors",
    title: "13. Mango-Shoot Colors మావిం చిగురులు",
    lines: [
      ["దేవా గాచుము నీడై", "dēvā gācumu nīḍai"],
      ["నీవే బ్రోచెడి విభువని మా నాథుడవని ॥", "nīvē brōceḍi vibhuvani mā nāthuḍavani."],
      ["నావై మోహము మాపై ।", "nāvai mōhamu māpai."],
      ["మావిం చిగురుల రంగులు మార్చే దువుగద ॥", "māviṃ cigurula raṅgulu mārcē duvugada."]
    ],
    bhavam: "మామిడి చిగురుల రంగులు ఎలా మారుస్తావో, నా మీద మోహరంగును కూడా మార్చి తొలగించవా అని దేవుని అడుగుతున్నాడు. నీడవై కాపాడు; నీవే నాథుడవు."
  },
  {
    key: "14. Lord of Kirīti",
    title: "14. Lord of Kirīti కిరీటిం పతే",
    lines: [
      ["హరునిం పూనిన భైరవం తమస మోహాకారమున్నా భళే ।", "haruniṃ pūnina bhairavaṃ tamasa mōhākāramunnā bhaḷē."],
      ["చరణం పైతడి మాపకుం దతడి కాచానే కిరీటిం పతే ॥", "caraṇaṃ paitadi māpakuṃ dataḍi kācānē kirīṭiṃ patē."],
      ["పరమోద్వేగన వైనతేయునిని నన్ వేగంబుగా పంపవే ।", "paramōdvēgana vainatēyunini nan vēgambugā pampavē."],
      ["దురహంకారము మోహముం చెరప రాద్దేవా దయాంబో హరే ॥", "durahaṅkāramu mōhamuṃ cerapa rāddēvā dayāmbō harē."]
    ],
    bhavam: "హరుని పూనిన భైరవుడు బయటకు తామస, మోహాకారంలా కనిపించినా భక్తునికి మోహనాకారుడే. ఆ రూపం కూడా ఆయనదే అనుకొని పాదతడి ఎండనీయకుండా కన్నీటి పూజ చేశాడు. ఇప్పుడు అది కూడా మాయేనని గ్రహిస్తున్నాడు: భగవంతుడు గుణాతీతుడు. కాబట్టి కిరీటి పతియైన కృష్ణుని వేడుకుంటున్నాడు: వైనతేయుని వేగంగా పంపి దురహంకారమూ మోహమూ చెరిపివేయు."
  },
  {
    key: "15. Where Your Beings Gather",
    title: "15. Where Your Beings Gather భూతాస మాగంహరే",
    lines: [
      ["భూతానా శ్రితవం గతోమి యత్ర త్వా భూతాస మాగంహరే ।", "bhūtānā śritavaṃ gatōmi yatra tvā bhūtāsa māgaṃharē."],
      ["దాతారో మమలం నిజైతు ధరిష్యా త్రాణైవ హాలాహలం ॥", "dātārō mamalaṃ nijaitu dhariṣyā trāṇaiva hālāhalaṃ."],
      ["పాత్రైర్మా మఖిలం విచ్ఛేదనకురో భంభొలెనాథంభవం ।", "pātrairmā makhilaṃ vicchēdanakurō bhaṃbholenāthaṃbhavaṃ."],
      ["సంతుష్టే భవతుం జయేతు భవతుం సంభోత మంత్వామతే ॥", "santuṣṭē bhavatuṃ jayētu bhavatuṃ saṃbhōta mantvām tē."]
    ],
    bhavam: ""
  },
  {
    key: "15. Notes",
    title: "15. Notes",
    lines: [

    ],
    bhavam: "భగవంతుడు భూతములందరికీ ఆశ్రయం. ఇక్కడ భూతములు అంటే కేవలం ప్రేతపిశాచాదులు కాదు; సమస్త జీవరాశులు, సమస్త సృష్టి. భక్తుడు ఎక్కడికి వెళ్లినా, అక్కడ ఆయన భూతములే — ఆయన సృష్టియే — ముందుగానే సమీకృతమై ఉంది. కాబట్టి ఆయన సృష్టికి అతీతంగా వెళ్లుటకు స్థలమే లేదు. ఆయనే అమలమైన జీవబలాన్ని, పవిత్రమైన జీవధారను ప్రసాదించువాడు. అదే సమయంలో హాలాహలాన్ని తన కంఠములోనే ధరించినవాడు కూడా ఆయనే. ఆ విషం పైలోకాలకూ, కింది లోకాలకూ వ్యాపించనీయకుండా, జీవరాశులను కాపాడిన నీలకంఠ తత్త్వం ఇక్కడ అంతర్లీనంగా ఉంది. ఇప్పుడు భక్తుడు తన పాత్రలన్నింటినీ — తాను ధరించిన వేషాలు, పేర్లు, పాత్రలు, అహంకారరూపాలు — విచ్ఛిన్నం చేయమని భవుని, భంభోలేనాథుని ప్రార్థిస్తున్నాడు. అంతరంగములో శంభువు సంతుష్టుడై, జయముతో, మహిమతో నిలవాలని కోరుకుంటున్నాడు."
  }
];
