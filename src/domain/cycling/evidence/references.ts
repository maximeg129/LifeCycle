// ── Base scientifique — 35 références annotées (R01–R35) ──────────────────
//
// Transcription fidèle de docs/01_Base_Scientifique_Cyclisme.md (jointe par
// l'utilisateur, source d'autorité — voir docs/AUDIT_CYCLING.md). Chaque
// champ vient du texte du document, jamais de connaissances externes,
// jamais complété de mémoire — c'est exactement ce que ce document interdit
// ("tu ne les complètes pas avec des connaissances externes"). Quand le
// document ne donne pas un auteur, un DOI ou un PMID pour une source, le
// champ est laissé absent (doi/pmid, optionnels) ou marqué explicitement
// "(non précisé dans le document source)" (authors, obligatoire) plutôt que
// deviné — un nom d'auteur plausible mais inventé serait aussi grave qu'une
// constante inventée : invisible, et potentiellement citée comme si elle
// était vérifiée.
//
// `openAccess` n'est vrai QUE lorsque le document le dit explicitement
// ("accès libre" / "PDF libre") — 4 occurrences seulement (R02, R19, R34,
// R35). Un DOI ou un identifiant PMC ne suffit pas à l'inférer ici (beaucoup
// de PMC ne sont pas en accès libre immédiat), donc ce champ reste `false`
// partout ailleurs plutôt que déduit.
//
// Certaines entrées du document citent plusieurs articles compagnons pour
// un même Rxx (R01, R15, R21, R27) — l'article principal (celui explicitement
// désigné comme source primaire, ou le premier cité) porte les champs
// authors/year/title/source/doi/pmid ; les articles compagnons sont
// mentionnés dans `claim`, jamais perdus.

export type EvidenceLevel = 'A' | 'B' | 'C'

export interface Reference {
  id: `R${string}`
  authors: string
  year: number
  title: string
  source: string
  doi?: string
  pmid?: string
  level: EvidenceLevel
  openAccess: boolean
  claim: string // ce que la source valide, en une phrase
}

const NOT_GIVEN = '(non précisé dans le document source)'

export const REFERENCES: Record<string, Reference> = {
  R01: {
    id: 'R01',
    authors: 'Banister EW, Calvert TW, Savage MV, Bach T',
    year: 1975,
    title: 'A systems model of training for athletic performance',
    source: 'Australian Journal of Sports Medicine 7(3):57–61',
    level: 'B',
    openAccess: false,
    claim:
      "Modèle systémique originel : la charge d'entraînement produit deux effets antagonistes (fitness, fatigue) dont la résultante prédit la performance — P(t) = P₀ + k₁·e^(−t/τ₁) − k₂·e^(−t/τ₂). Voir aussi le compagnon Calvert TW, Banister EW, Savage MV, Bach T (1976), IEEE Trans Syst Man Cybern 2:94–102, doi:10.1109/tsmc.1976.5409179.",
  },
  R02: {
    id: 'R02',
    authors: 'Clarke DC, Skiba PF',
    year: 2013,
    title: 'Rationale and resources for teaching the mathematical modeling of athletic training and performance',
    source: 'Advances in Physiology Education 37(2):134–152',
    doi: '10.1152/advan.00078.2011',
    pmid: '23728131',
    level: 'B',
    openAccess: true,
    claim:
      'Présente conjointement le modèle de puissance critique (CP) et le modèle impulsion-réponse (IR) de Banister comme complémentaires — CP décrit puissances soutenables vs durées, IR décrit la dynamique temporelle de la performance ; contient code et jeux de données.',
  },
  R03: {
    id: 'R03',
    authors: NOT_GIVEN,
    year: 2022,
    title: "The Fitness–Fatigue Model: What's in the Numbers?",
    source: 'International Journal of Sports Physiology and Performance 17(5):810',
    level: 'B',
    openAccess: false,
    claim:
      "Les adaptations successives du modèle IR ont produit des formes à 1, 2 ou 3 paramètres k : la valeur d'un paramètre (donc un CTL/ATL/TSB) n'a pas de signification univoque ni comparable d'un modèle à l'autre.",
  },
  R04: {
    id: 'R04',
    authors: NOT_GIVEN,
    year: 2025,
    title:
      'The three-dimensional impulse-response model: Modeling the training process in accordance with energy system-specific adaptation',
    source: 'arXiv:2503.14841 (preprint, mars 2025)',
    level: 'C',
    // Un preprint arXiv est dans les faits en accès libre, mais le document
    // source ne le dit pas explicitement pour cette entrée (contrairement à
    // R02/R19/R34/R35, où "accès libre" est écrit noir sur blanc) — ne pas
    // l'inférer serait déjà une connaissance externe, aussi correcte soit-elle.
    openAccess: false,
    claim:
      "Preprint non revu par les pairs — décrit explicitement l'articulation TSS↔NP↔FTP : le TSS est ancré sur la FTP (1h au seuil = 100 TSS) et repose sur la NP, qui pondère des moyennes glissantes de 30s pour le caractère différé/non linéaire des réponses physiologiques.",
  },
  R05: {
    id: 'R05',
    authors: 'Impellizzeri FM, Marcora SM, Coutts AJ',
    year: 2019,
    title: 'Internal and External Training Load: 15 Years On',
    source: 'International Journal of Sports Physiology and Performance 14(2):270–273',
    doi: '10.1123/ijspp.2018-0935',
    pmid: '30614348',
    level: 'B',
    openAccess: false,
    claim:
      "Cadre fondateur : la charge externe (travail physique prescrit) diffère de la charge interne (réponse psychophysiologique individuelle) — c'est la charge interne qui médie l'adaptation.",
  },
  R06: {
    id: 'R06',
    authors: 'Maunder E, Seiler S, Mildenhall MJ, Kilding AE, Plews DJ',
    year: 2021,
    title: "The importance of 'durability' in the physiological profiling of endurance athletes",
    source: 'Sports Medicine 51(8):1619–1628',
    doi: '10.1007/s40279-021-01459-0',
    level: 'B',
    openAccess: false,
    claim:
      "Article fondateur du concept de durabilité — propose le ratio variation de FC / variation d'allure comme indice de découplage exploitable sur le terrain.",
  },
  R07: {
    id: 'R07',
    authors: 'Jones AM',
    year: 2024,
    title: 'The fourth dimension: physiological resilience as an independent determinant of endurance exercise performance',
    source: 'The Journal of Physiology 602(17):4113–4128',
    doi: '10.1113/JP284205',
    level: 'B',
    openAccess: false,
    claim:
      "VO₂max, économie et seuils métaboliques mesurés « à froid » se dégradent au cours de l'effort prolongé, avec une variabilité interindividuelle importante — la figure 5 montre l'effet du travail accumulé (kJ/kg) sur des efforts de 5 et 20 min.",
  },
  R08: {
    id: 'R08',
    authors: NOT_GIVEN,
    year: 2023,
    title: 'Durability in Professional Cyclists: A Field Study',
    source: 'International Journal of Sports Physiology and Performance 18(1):99',
    level: 'B',
    openAccess: false,
    claim:
      "CLM de 20min à froid vs après ~40kJ/kg submaximaux : performance significativement altérée au-delà d'environ 40kJ/kg, dégradation non liée aux indicateurs labo classiques (seuil ventilatoire, PMA, VO₂max).",
  },
  R09: {
    id: 'R09',
    authors: 'Spragg J, Leo P, Giorgi A, Gonzalez BM, Swart J',
    year: 2024,
    title:
      'The intensity rather than the quantity of prior work determines the subsequent downward shift in the power–duration relationship in professional cyclists',
    source: 'European Journal of Sport Science 24:449–457',
    level: 'B',
    openAccess: false,
    claim:
      "Le déplacement vers le bas de la courbe puissance-durée dépend davantage de l'intensité du travail antérieur que du total en kJ — un budget kJ non pondéré sous-estime systématiquement la fatigue après une semaine chargée en zones hautes.",
  },
  R10: {
    id: 'R10',
    authors: NOT_GIVEN,
    year: 2025,
    title:
      "Is intensity the most important factor in determining the amount of prior work accumulated that affects cyclists' acute durability? A systematic review",
    source: 'European Journal of Applied Physiology',
    doi: '10.1007/s00421-025-05885-0',
    level: 'A',
    openAccess: false,
    claim:
      "Revue PRISMA de 21 études : les efforts au-dessus de la puissance critique entraînent des baisses de puissance plus fortes pour un travail accumulé plus faible. U23 : baisses significatives sur efforts ≤12min dès 1000kJ, autres durées entre 1500–2500kJ. Professionnels : réductions sur 5/12min après 1000kJ, autres durées entre 2000–3000kJ.",
  },
  R11: {
    id: 'R11',
    authors: 'Pallarés JG, Lucia A, Valenzuela PL',
    year: 2025,
    title: 'Sex differences in durability: a field-based study in professional cyclists',
    source: 'Journal of Science and Medicine in Sport',
    level: 'B',
    openAccess: false,
    claim:
      "Réduction significative du profil de puissance record au-delà de 10kJ/kg chez les deux sexes ; décroissance relative plus marquée chez les femmes au-delà de 20kJ/kg (4/4/2% sur 1/5/20min) puis 30kJ/kg (8/6/7%).",
  },
  R12: {
    id: 'R12',
    authors: 'Riegel PS',
    year: 1981,
    title: 'Athletic records and human endurance',
    source: 'American Scientist 69(3):285–290',
    pmid: '7235349',
    level: 'B',
    openAccess: false,
    claim:
      "T₂ = T₁×(D₂/D₁)^k — Riegel a ajusté des facteurs de fatigue DISTINCTS pour la natation et le cyclisme, ainsi que par groupe d'âge et de sexe ; l'exposant de la course à pied ne s'applique pas au vélo. Plage d'ajustement d'origine : efforts d'environ 3,5 à 230 minutes, sur records du monde.",
  },
  R13: {
    id: 'R13',
    authors: 'Vickers AJ, Vertosick EA',
    year: 2016,
    title: 'An empirical study of race times in recreational endurance runners',
    source: 'BMC Sports Science, Medicine and Rehabilitation 8:26',
    level: 'B',
    openAccess: false,
    claim:
      "Sur 2303 coureurs récréatifs, Riegel prédisait le marathon >10min trop vite pour environ la moitié d'entre eux ; un modèle calibré sur 1-2 performances antérieures divisait l'erreur par deux — justifie un exposant individuel plutôt qu'une constante.",
  },
  R14: {
    id: 'R14',
    authors: 'Jones AM, Vanhatalo A, Burnley M, Morton RH, Poole DC',
    year: 2010,
    title: 'Critical power: implications for determination of V̇O₂max and exercise tolerance',
    source: 'Medicine & Science in Sports & Exercise 42(10)',
    level: 'B',
    openAccess: false,
    claim:
      "Alternative physiologique à Riegel côté vélo : relation hyperbolique puissance-temps (CP asymptote, W′ constante de courbure) — l'interprétation classique CP=aérobie/W′=anaérobie est simpliste, les deux paramètres sont interdépendants.",
  },
  R15: {
    id: 'R15',
    authors: 'Skiba PF, Chidnok W, Vanhatalo A, Jones AM',
    year: 2012,
    title: 'Modeling the expenditure and reconstitution of work capacity above critical power',
    source: 'Medicine & Science in Sports & Exercise 44(8):1526–1532',
    doi: '10.1249/MSS.0b013e3182517a80',
    pmid: '22382171',
    level: 'B',
    openAccess: false,
    claim:
      "W′ (capacité de travail finie au-dessus de CP) se reconstitue selon une exponentielle dont la constante de temps est inversement liée à l'écart CP−puissance de récupération (ordre de grandeur rapporté : τ≈377s pour une récupération à 20W) — les constantes exactes doivent être reprises dans ce papier avant codage. Voir aussi les compagnons Skiba et al. (2014) MSSE 46(7):1433–1440, doi:10.1249/MSS.0000000000000226, et Skiba et al. (2014) IJSPP 9(6):900–904, doi:10.1123/ijspp.2013-0471.",
  },
  R16: {
    id: 'R16',
    authors: 'Coggan AR',
    year: 2024,
    title: 'Normalized Power, Intensity Factor and Training Stress Score',
    source: 'TrainingPeaks (mise à jour continue)',
    level: 'C',
    openAccess: false,
    claim:
      "Algorithme propriétaire, non revu par les pairs. NP pondère des moyennes glissantes de 30s pour le caractère non instantané et la relation curvilinéaire des réponses physiologiques à l'intensité. TSS = (durée_s × NP × IF) / (FTP × 3600) × 100.",
  },
  R17: {
    id: 'R17',
    authors: NOT_GIVEN,
    year: 2023,
    title: 'Relationships between training dose and record power outputs in professional road cyclists: insights and threats to validity',
    source: 'PMC10108756',
    level: 'B',
    openAccess: false,
    claim:
      "Modélisation multi-niveaux sur 18 pros : relations positives mais FAIBLES entre tous les indices de dose (temps, eTRIMP, TSS, temps en zones) et les Record Power Outputs du mois suivant ; l'indice de polarisation ne montre pas de relation.",
  },
  R18: {
    id: 'R18',
    authors: 'Seiler S',
    year: 2010,
    title: 'What is best practice for training intensity and duration distribution in endurance athletes?',
    source: 'International Journal of Sports Physiology and Performance 5(3):276–291',
    doi: '10.1123/ijspp.5.3.276',
    pmid: '20861519',
    level: 'B',
    openAccess: false,
    claim:
      "Convergence descriptive des athlètes d'endurance national/international s'entraînant 10-13 fois/semaine : environ 80% des séances à basse intensité (sous 2mM de lactate), 20% à haute intensité.",
  },
  R19: {
    id: 'R19',
    authors: 'Tønnessen E, Sandbakk Ø, Bucher Sandbakk S, Seiler S, Haugen T',
    year: 2024,
    title: 'Training Session Models in Endurance Sports: A Norwegian Perspective on Best Practice Recommendations',
    source: 'Sports Medicine 54(11):2935–2953',
    doi: '10.1007/s40279-024-02067-4',
    pmid: '39012575',
    level: 'B',
    openAccess: true,
    claim:
      "Douze entraîneurs norvégiens de haut niveau : les modèles de séances d'intervalles réellement utilisés sont plus volumineux, plus contrôlés et moins épuisants que ce que recommandent la plupart des études d'intervention.",
  },
  R20: {
    id: 'R20',
    authors: 'Rosenblat MA, Perrotta AS, Vicenzino B',
    year: 2019,
    title: 'Polarized vs. Threshold Training Intensity Distribution on Endurance Sport Performance: A Systematic Review and Meta-Analysis of RCTs',
    source: 'Journal of Strength and Conditioning Research 33:3491–3500',
    doi: '10.1519/JSC.0000000000002618',
    level: 'A',
    openAccess: false,
    claim: 'Revue systématique avec méta-analyse comparant distribution polarisée vs par seuil sur la performance en endurance.',
  },
  R21: {
    id: 'R21',
    authors: 'Foster C, Florhaug JA, Franklin J, Gottschall L, Hrovatin LA, Parker S, Doleshal P, Dodge C',
    year: 2001,
    title: 'A new approach to monitoring exercise training',
    source: 'Journal of Strength and Conditioning Research 15(1):109–115',
    pmid: '11708692',
    level: 'B',
    openAccess: false,
    claim:
      "Valide la session-RPE (RPE×durée) comme quantification de la charge indépendante du mode/intensité, avec des relations quasi superposées à la méthode de référence basée sur la FC. Voir aussi le compagnon Foster C (1998), MSSE 30:1164–1168, qui introduit monotonie (moyenne/écart-type quotidien) et strain (charge×monotonie), reliés à l'incidence de maladies bénignes.",
  },
  R22: {
    id: 'R22',
    authors: 'Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ',
    year: 2020,
    title: 'Acute:chronic workload ratio: conceptual issues and fundamental pitfalls',
    source: 'International Journal of Sports Physiology and Performance 15(6):907–913',
    doi: '10.1123/ijspp.2019-0864',
    level: 'B',
    openAccess: false,
    claim:
      "Lecture obligatoire si le gouverneur utilise un ACWR : biais de collision, causalité inverse, artefacts mathématiques du ratio — à ne jamais utiliser comme règle de décision automatique.",
  },
  R23: {
    id: 'R23',
    authors: 'Meeusen R, Duclos M, Foster C, et al.',
    year: 2013,
    title:
      'Prevention, diagnosis and treatment of the overtraining syndrome: joint consensus statement of the European College of Sport Science and the American College of Sports Medicine',
    source: 'Medicine & Science in Sports & Exercise 45:186–205',
    doi: '10.1249/MSS.0b013e318279a10a',
    level: 'A',
    openAccess: false,
    claim:
      "Référence de consensus pour distinguer surcharge fonctionnelle, surcharge non fonctionnelle (NFOR) et syndrome de surentraînement (OTS), et définir des seuils d'alerte.",
  },
  R24: {
    id: 'R24',
    authors:
      'Kellmann M, Bertollo M, Bosquet L, Brink M, Coutts AJ, Duffield R, Erlacher D, Halson SL, Hecksteden A, Heidari J, Kallus KW, Meeusen R, Mujika I, Robazza C, Skorski S, Venter R, Beckmann J',
    year: 2018,
    title: 'Recovery and Performance in Sport: Consensus Statement',
    source: 'International Journal of Sports Physiology and Performance 13(2):240–245',
    doi: '10.1123/ijspp.2017-0759',
    level: 'A',
    openAccess: false,
    claim:
      "Un suivi systématique de la récupération vise à prévenir sous-récupération, NFOR, OTS, blessures et maladies — insiste sur la variabilité inter- et intra-individuelle des réponses.",
  },
  R25: {
    id: 'R25',
    authors: 'Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M',
    year: 2013,
    title: 'Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring',
    source: 'Sports Medicine 43(9):773–781',
    doi: '10.1007/s40279-013-0071-8',
    pmid: '23852425',
    level: 'B',
    openAccess: false,
    claim:
      "Chez les élites, des hausses COMME des baisses de HRV ont été associées à une adaptation négative — le signe seul ne suffit pas. Nécessité de moyennes glissantes (jamais des valeurs isolées) et gestion de la saturation du HRV chez l'athlète très entraîné.",
  },
  R26: {
    id: 'R26',
    authors: 'Javaloyes A, Sarabia JM, Lamberts RP, Moya-Ramón M',
    year: 2019,
    title: 'Training Prescription Guided by Heart-Rate Variability in Cycling',
    source: 'International Journal of Sports Physiology and Performance',
    pmid: '29809080',
    level: 'B',
    openAccess: false,
    claim:
      "17 cyclistes, 4 semaines réf + 8 semaines : le groupe piloté par HRV améliore PPO (+5,1%), puissance au VT2 (+13,9%) et CLM 40min (+7,3%) vs le groupe périodisation traditionnelle — mais AUCUNE différence significative entre groupes ; la supériorité n'apparaît qu'en inférence basée sur la magnitude.",
  },
  R27: {
    id: 'R27',
    authors: NOT_GIVEN,
    year: 2021,
    title:
      'Heart Rate Variability-Guided Training for Enhancing Cardiac-Vagal Modulation, Aerobic Fitness, and Endurance Performance: A Methodological Systematic Review with Meta-Analysis',
    source: 'PMC8507742',
    level: 'A',
    openAccess: false,
    claim:
      "Après contrôle méthodologique, le pilotage par HRV est supérieur pour les indices vagaux (SMD 0,50, IC95% 0,09–0,91) mais PAS pour la FC de repos (SMD 0,04) ; effet sur la performance modeste. Voir aussi le compagnon (anonyme) « Monitoring and adapting endurance training on the basis of heart rate variability monitored by wearable technologies: a systematic review with meta-analysis », J Sci Med Sport (2021).",
  },
  R28: {
    id: 'R28',
    authors:
      'Walsh NP, Halson SL, Sargent C, Roach GD, Nédélec M, Gupta L, Leeder J, Fullagar HHK, Coutts AJ, Edwards BJ, Pullinger SA, Robertson CM, Burniston JG, Lastella M, Le Meur Y, Hausswirth C, Bender AM, Grandner MA, Samuels CH',
    year: 2021,
    title: 'Sleep and the athlete: narrative review and 2021 expert consensus recommendations',
    source: 'British Journal of Sports Medicine 55(7):356–368',
    doi: '10.1136/bjsports-2020-102025',
    level: 'A',
    openAccess: false,
    claim:
      "Une approche uniforme 7–9h/nuit n'est probablement pas idéale — approche individualisée fondée sur le besoin de sommeil perçu. Contient une boîte à outils praticien (Athlete Sleep Screening Questionnaire) ; tout moniteur de sommeil doit être validé contre polysomnographie.",
  },
  R29: {
    id: 'R29',
    authors: 'Roberts SSH, Teo WP, Aisbett B, Warmington SA',
    year: 2019,
    title: 'Extended sleep maintains endurance performance better than normal or restricted sleep',
    source: 'Medicine & Science in Sports & Exercise 51:2516–2523',
    level: 'B',
    openAccess: false,
    claim:
      "9 cyclistes/triathlètes, CLM à travail fixé en kJ sur 4 jours, 3 conditions de sommeil (normal/−30%/+30%) : temps de CLM dégradés sous restriction, mais le RPE rapporté restait similaire — l'athlète ne « sent » pas la dégradation, ce qui justifie une correction algorithmique.",
  },
  R30: {
    id: 'R30',
    authors: 'Chinoy ED, Cuellar JA, Huwa KE, Jameson JT, Watson CH, Bessman SC, Hirsch DA, Cooper AD, Drummond SPA, Markwald RR',
    year: 2021,
    title: 'Performance of seven consumer sleep-tracking devices compared with polysomnography',
    source: 'Sleep 44(5):zsaa291',
    doi: '10.1093/sleep/zsaa291',
    pmid: '33378539',
    level: 'A',
    openAccess: false,
    claim:
      "Sensibilité élevée pour détecter le sommeil (≥0,93 partout), spécificité faible à moyenne pour l'éveil (0,18–0,54), résultats INCOHÉRENTS sur les stades de sommeil, performances dégradées les nuits perturbées — exploiter durée et régularité, pas les stades.",
  },
  R31: {
    id: 'R31',
    authors: 'Saw AE, Main LC, Gastin PB',
    year: 2016,
    title:
      'Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review',
    source: 'British Journal of Sports Medicine 50(5):281–291',
    doi: '10.1136/bjsports-2015-094758',
    level: 'A',
    openAccess: false,
    claim:
      "Mesures subjectives et objectives ne corrèlent généralement PAS. Le bien-être subjectif reflète les charges aiguës et chroniques avec une sensibilité/cohérence supérieures aux marqueurs objectifs courants.",
  },
  R32: {
    id: 'R32',
    authors: NOT_GIVEN,
    year: 2023,
    title: 'Accuracy of Resting Metabolic Rate Prediction Equations in Athletes: A Systematic Review with Meta-analysis',
    source: 'Sports Medicine, PMC10687135',
    doi: '10.1007/s40279-023-01896-z',
    level: 'A',
    openAccess: false,
    claim:
      "Cinq équations (Cunningham 1980/1991, Harris-Benedict 1918, De Lorenzo, Ten-Haaf) ne diffèrent pas significativement des valeurs mesurées, mais toutes présentent une forte hétérogénéité SAUF Ten-Haaf (I²=0%) — 80,2% des sujets prédits à ±10% vs 40,7–63,7% pour les autres. Harris-Benedict sous-estimait ~500kcal/j chez des rameurs/céistes élite (>1000kcal/j d'erreur potentielle sur les besoins totaux à PAL 2+).",
  },
  R33: {
    id: 'R33',
    authors: 'ten Haaf T, Weijs PJM',
    year: 2014,
    title:
      'Resting energy expenditure prediction in recreational athletes of 18–35 years: confirmation of Cunningham equation and an improved weight-based alternative',
    source: 'PLoS ONE 9(10):e108460',
    level: 'B',
    openAccess: false,
    claim:
      "Source primaire de l'équation Ten-Haaf. Les coefficients exacts (versions masse corporelle et masse maigre) doivent être repris dans le tableau du papier avant codage — ne pas les reconstituer de mémoire (avertissement explicite du document source).",
  },
  R34: {
    id: 'R34',
    authors: 'Podlogar T, Wallis GA',
    year: 2022,
    title: 'New Horizons in Carbohydrate Research and Application for Endurance Athletes',
    source: 'Sports Medicine 52(Suppl 1):5–23, PMC9734239',
    doi: '10.1007/s40279-022-01757-1',
    level: 'B',
    openAccess: true,
    claim:
      "Perspective contemporaine sur type/quantité de glucides avant/pendant/après effort intense — apports jusqu'à 120g·h⁻¹, ratios glucose:fructose (dont 1:0,8). Transparence déclarée : honoraires GSSI (PepsiCo) pour la préparation de l'article.",
  },
  R35: {
    id: 'R35',
    authors:
      'Mountjoy M, Ackerman KE, Bailey DM, Burke LM, Constantini N, Hackney AC, Heikura IA, Melin A, Pensgaard AM, Stellingwerff T, Sundgot-Borgen JK, Torstveit MK, Jacobsen AU, Verhagen E, Budgett R, Engebretsen L, Erdener U',
    year: 2023,
    title: "2023 International Olympic Committee's (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs)",
    source: 'British Journal of Sports Medicine 57(17):1073–1097',
    doi: '10.1136/bjsports-2023-106994',
    level: 'A',
    openAccess: true,
    claim:
      "Consensus IOC REDs : la faible disponibilité énergétique (LEA) existe sur un continuum entre adaptable et problématique, conséquences documentées sur métabolisme, fonction reproductive, santé osseuse, immunité, glycogène, santé cardiovasculaire/hématologique. Contient l'outil clinique en 3 étapes (dépistage, stratification, diagnostic).",
  },
}
