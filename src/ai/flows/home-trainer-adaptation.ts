// ── Adaptation home trainer — guidance qualitative, PAS encore un Rxx sourcé ──
//
// Fichier plain, délibérément PAS 'use server' — même raison documentée dans
// structured-workout-syntax.ts (un fichier 'use server' ne peut exporter QUE
// des fonctions async ; une constante partagée doit vivre à côté).
//
// Retour utilisateur : "il serait bon d'adapter juste de ne pas copier like
// for like la séance, mais de l'adapter aux besoins du Home Trainer... peut-
// être qu'il faut rechercher un peu de documentation sur les impacts de la
// performance sur Home Trainer". Recherche faite (WebSearch) — trois études
// réelles, vérifiées (auteurs/année/journal/DOI), convergent sur le même
// constat qualitatif :
//
// - Lipski et al. (2022), "Differences in Performance Assessments Conducted
//   Indoors and Outdoors in Professional Cyclists", International Journal of
//   Sports Physiology and Performance, 17(7). 14 cyclistes UCI Continental/
//   World Tour, 4 sessions (2 indoor/2 outdoor) sur 14 jours : puissance
//   moyenne maximale (10s à 14min) et puissance critique systématiquement
//   plus basses en intérieur (critical power −19W, p=.005).
// - Bertucci, Betik, Duc, Grappe (2012), "Gross efficiency and cycling
//   economy are higher in the field as compared with on an Axiom stationary
//   ergometer", Journal of Applied Biomechanics, 28(6):636-644,
//   DOI 10.1123/jab.28.6.636. Économie de pédalage mesurée plus basse sur
//   home trainer stationnaire qu'en conditions réelles.
// - Vinetti et al. (2023), "Functional Threshold Power Field Test Exceeds
//   Laboratory Performance in Junior Road Cyclists", Journal of Strength and
//   Conditioning Research, 37(9):1815-1820, DOI 10.1519/JSC.0000000000004471.
//   FTP terrain (côte, extérieur) significativement supérieure à la
//   puissance critique et au seuil 4mM mesurés en laboratoire.
//
// ⚠️ PAS encore formalisé en Rxx dans evidence/references.ts/rules.ts —
// contrairement aux 35 références du canon (fournies et personnellement
// revues par l'utilisateur, voir CLAUDE.md/docs/OPEN_QUESTIONS.md Q5 pour le
// précédent), ces trois études ont été trouvées de façon autonome (recherche
// web), pas fournies par l'utilisateur. Même discipline que le reste du
// projet : ne pas se déguiser en constante scientifique tranchée avant
// revue. Ce fichier expose donc une guidance QUALITATIVE seulement (jamais
// de pourcentage/watt précis calqué sur ces études, même si elles en
// donnent) — à formaliser en Rxx si l'utilisateur confirme vouloir les
// intégrer au canon.
export const HOME_TRAINER_ADAPTATION_GUIDANCE = `Adapte le contenu à ce que le home trainer implique réellement, pas une simple copie du script extérieur :
  - Refroidissement réduit (moins de flux d'air qu'en extérieur) → température corporelle et FC plus hautes pour une puissance identique, l'effort est ressenti plus dur. Vise une intensité légèrement prudente plutôt que de calquer exactement les watts d'une séance extérieure équivalente, et rappelle l'importance d'un ventilateur/d'une bonne hydratation dans rationale ou warnings si la séance est intense.
  - Pas de récupération "gratuite" en descente ou en roue libre comme en extérieur — les phases de récupération doivent être des étapes explicites du script (pédalage très léger), jamais sous-entendues.
  - Prioriser le ressenti/la durée tenue plutôt que coller à un chiffre de watts identique à l'extérieur — un léger écart de puissance en intérieur ne signifie pas un échec de la séance.`
