// ── Musculation en complément du plan cycliste — guidance qualitative ─────
//
// Fichier plain, délibérément PAS 'use server' — même raison documentée dans
// structured-workout-syntax.ts / home-trainer-adaptation.ts / on-bike-
// fueling-guidance.ts (un fichier 'use server' ne peut exporter QUE des
// fonctions async ; une constante partagée doit vivre à côté).
//
// Retour utilisateur : "j'aimerais faire des recherches et que le coach si
// l'athlete le demande inclus des seance de musculation dans le plan
// d'entrainement." Recherche faite (WebSearch) — deux sources réelles,
// vérifiées (auteurs/année/journal/DOI), spécifiques au cyclisme :
//
// - Rønnestad BR, Mujika I (2014), "Optimizing strength training for
//   running and cycling endurance performance: A review", Scandinavian
//   Journal of Medicine & Science in Sports 24(4):603-612,
//   DOI 10.1111/sms.12104 — revue de référence sur l'entraînement concurrent
//   (force + endurance) chez le cycliste/coureur : le travail de force LOURD
//   (charges élevées, peu de répétitions) est celui qui bénéficie
//   spécifiquement à l'économie de pédalage et à la puissance à VO2max,
//   contrairement au travail de force explosif (plus pertinent en course à
//   pied). Intégré sur une saison sans déplacer les séances clés
//   d'endurance, sans nuire à la performance d'endurance.
// - Llanos-Lagos C, Ramirez-Campillo R, Sáez de Villarreal E (2025, en
//   ligne juillet 2025 / impression 2026), "Heavy strength training effects
//   on physiological determinants of endurance cyclist performance: a
//   systematic review with meta-analysis", European Journal of Applied
//   Physiology 126(1):193-222, DOI 10.1007/s00421-025-05883-2
//   (PMC12881108, accès libre) — méta-analyse RÉCENTE et SPÉCIFIQUE au
//   cyclisme (pas juste "endurance" en général) : le travail de force lourd
//   améliore significativement l'économie de pédalage et la puissance
//   anaérobie/performance cycliste, SANS effet significatif sur le VO2max
//   ni la capacité anaérobie — le bénéfice est mécanique/neuromusculaire,
//   pas une amélioration de la capacité aérobie elle-même.
//
// ⚠️ PAS encore formalisées en Sxx/Rxx dans evidence/references.ts/rules.ts
// ni evidence/supplementary-sources.ts — même précédent que home-trainer-
// adaptation.ts et l'alimentation à l'effort (formalisées en S03/S04 après
// confirmation utilisateur explicite, voir supplementary-sources.ts) : ces
// deux études sont réelles et vérifiées, trouvées par recherche autonome,
// pas encore revues/confirmées par l'utilisateur pour ce sujet précis. Ce
// fichier expose donc une guidance QUALITATIVE seulement (jamais de charge/
// %1RM/nombre de répétitions précis calqué sur ces études) — à formaliser
// en Sxx si l'utilisateur confirme vouloir les intégrer au canon, comme
// pour S03/S04.
export const STRENGTH_TRAINING_GUIDANCE = `Si des séances de musculation sont demandées pour cette semaine (INCLURE_MUSCULATION=true), applique ces principes qualitatifs à ce que tu génères :
  - Prioriser un travail de force LOURD (charges élevées, peu de répétitions, ex. squat/presse à cuisses/fentes) plutôt qu'un travail d'endurance musculaire à charge légère et haut nombre de répétitions — c'est ce type de travail qui bénéficie à l'économie de pédalage et à la puissance chez le cycliste, pas un objectif de VO2max.
  - Ne jamais faire déplacer une séance vélo clé (seuil/VO2max/spécificité de l'objectif) par la musculation — elle vient en complément, jamais à la place.
  - Réduire le volume/la fréquence de musculation en phase "taper" (l'objectif approche, la fatigue résiduelle d'une séance de force lourde doit être évitée juste avant), et peut être totalement absente en phase "peak" très proche de l'objectif.
  - Ne jamais inventer une charge précise (kg, %1RM) ou un nombre exact de répétitions au-delà de ce que la recherche fournie donne — reste qualitatif (ex. "charge lourde, 3-5 répétitions par série" est une convention d'entraînement de force classique, pas un chiffre sourcé pour CE cas précis).`
