// ── Alimentation à l'effort — apport glucidique par tranche de durée ──────
//
// Fichier plain, délibérément PAS 'use server' — même raison que
// home-trainer-adaptation.ts / structured-workout-syntax.ts (un fichier
// 'use server' ne peut exporter QUE des fonctions async).
//
// Retour utilisateur : "il est important de baser cette alimentation sur
// des recherches spécifiquement et pas de sortir un chiffre au pif."
// Recherche faite (WebSearch) — deux sources réelles, vérifiées (auteurs/
// année/journal/DOI) donnent un cadre par tranche de durée :
//
// - Jeukendrup AE (2014), "A Step Towards Personalized Sports Nutrition:
//   Carbohydrate Intake During Exercise", Sports Medicine 44(Suppl 1):S25-33,
//   DOI 10.1007/s40279-014-0148-z (PMC4008807, accès libre) — en dessous
//   d'environ 75 minutes, un apport glucidique n'apporte pas de bénéfice
//   physiologique clair (un simple rinçage buccal peut suffire) ; entre 1h
//   et 2h30, jusqu'à ~60g/h d'une source glucidique unique (le transporteur
//   intestinal SGLT1 plafonne l'oxydation du glucose seul autour de cette
//   valeur) ; au-delà de 2h30 à intensité soutenue, jusqu'à ~90g/h en
//   combinant glucose+fructose (ratio ~2:1 — utilise en parallèle SGLT1 et
//   le transporteur GLUT5, ce qui repousse le plafond d'oxydation).
// - Kerksick CM et al. (2017), International Society of Sports Nutrition
//   position stand: nutrient timing, Journal of the International Society
//   of Sports Nutrition 14:33, DOI 10.1186/s12970-017-0189-4 (PMC5596471,
//   accès libre) — confirme la fourchette ~30-60g/h au-delà de 70 minutes
//   d'effort >70% VO2max, sous forme de solution glucido-électrolytique
//   6-8%, ~180-360ml toutes les 10-15 minutes.
//
// ⚠️ PAS encore formalisées en Rxx dans evidence/references.ts/rules.ts —
// contrairement aux 35 références du canon (fournies et personnellement
// revues par l'utilisateur, voir CLAUDE.md/docs/OPEN_QUESTIONS.md Q5 pour
// le précédent déjà posé par home-trainer-adaptation.ts). Le plafond haut
// (jusqu'à 120g/h, ratio glucose:fructose ~1:0,8 pour les efforts les plus
// intenses) reste celui déjà sourcé R34 (Podlogar & Wallis 2022,
// carbIntakeGuidance() dans domain/cycling/metrics/nutrition.ts, règle
// nutrition-carb-intake-guidance déjà présente dans le prompt système de ce
// flow via buildSystemPrompt — scope 'interpretation', toujours actif) —
// jamais dupliqué ici. Ce fichier expose la fourchette PAR TRANCHE DE DURÉE
// (30-60g/h vs jusqu'à 90g/h), qui n'existe QUE dans ces deux études non
// encore revues — le modèle doit donc toujours répondre par une FOURCHETTE
// (min/max), jamais un chiffre unique qui ferait croire à une précision que
// la recherche ne donne pas.
export const ON_BIKE_FUELING_GUIDANCE = `Base l'alimentation à avoir PENDANT la séance sur la durée et l'intensité RÉELLES de CETTE séance précise (celle que tu viens de construire ci-dessus), jamais un chiffre générique recopié d'une séance à l'autre :
  - Moins de ~60-75 minutes, intensité modérée (endurance/récupération) : neededOnBike=false — la recherche ne montre pas de bénéfice clair à cette durée, ne mets pas de chiffre.
  - Entre ~1h et 2h30, ou en dessous mais à intensité soutenue (seuil/VO2max) : neededOnBike=true, fourchette 30-60g/h.
  - Au-delà de 2h30, ou effort long à intensité soutenue : neededOnBike=true, fourchette pouvant monter jusqu'à 90g/h (sources glucidiques multiples type glucose+fructose).
  - Ne dépasse JAMAIS 120g/h (plafond sourcé R34, réservé aux efforts les plus intenses — voir la règle nutrition-carb-intake-guidance ci-dessus).
  - Rappelle l'hydratation (hydrationNote) seulement si la durée dépasse ~60-70 minutes — pas pour une séance courte.
  - Réponds toujours par une FOURCHETTE (carbGramsPerHourMin/Max), jamais un chiffre unique — la recherche donne des plages, pas une valeur exacte.`
