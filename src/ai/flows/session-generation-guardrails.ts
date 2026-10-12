// ── Garde-fous de vocabulaire pour la génération de séances ──────────────
//
// Fichier plain, délibérément PAS 'use server' — même raison que
// home-trainer-adaptation.ts / on-bike-fueling-guidance.ts / structured-
// workout-syntax.ts (un fichier 'use server' ne peut exporter QUE des
// fonctions async).
//
// Retour utilisateur (revue UX/engine externe) : "Two different threshold
// anchors... prescriptions use FTP, while the post-ride analysis uses CP"
// et "The day labels contradict the calendar". Root cause pour les deux,
// confirmée en lisant le code (pas seulement l'UI) :
// - `coach-context.ts` cite la puissance critique (CP/W′, R14) comme un
//   chiffre réel de plus dans le bloc "CHARGE D'ENTRAÎNEMENT ACTUELLE" —
//   sans jamais préciser qu'elle ne sert qu'à l'évidence
//   (riegel-prefer-critical-power-side-cycling, un signal informatif) et
//   JAMAIS à exprimer une cible de séance. `STRUCTURED_WORKOUT_SYNTAX`
//   force déjà le script lui-même en %FTP, mais rien n'empêchait le modèle
//   de reformuler le MÊME palier en "% de CP" dans le titre/rationale en
//   texte libre — le parseur ne lit que le script, jamais ce texte, donc
//   l'incohérence n'était visible qu'à l'écran, jamais détectée par un test.
// - `plan-week-sessions-flow.ts` est le SEUL flow qui génère plusieurs
//   séances pour une semaine entière AVANT que les dates ne soient
//   attribuées (`assignSessionDatesByAvailability`, appelé après coup dans
//   use-generate-week-sessions.ts, par bin-packing sur la durée — jamais
//   une décision du modèle). Le modèle n'a donc aucune information sur le
//   jour réel où une séance atterrira ; rien dans son prompt ne lui
//   interdisait de nommer un jour de semaine dans son titre/rationale par
//   habitude stylistique, garantissant un jour fictif dès qu'il le fait.
export const SESSION_TARGET_VOCABULARY_GUIDANCE = `Les cibles de séance (titre, rationale, script structuré) restent TOUJOURS exprimées en %FTP, jamais en %
de la puissance critique (CP) — même si la puissance critique (CP/W′) est citée plus haut comme contexte sur
la forme de l'athlète (un signal informatif distinct, jamais la référence pour fixer une cible de séance).
N'écris jamais "% CP" ou "puissance critique" en lien avec l'intensité d'UNE séance — toujours "% FTP".`

export const NO_WEEKDAY_IN_SESSION_TEXT_GUIDANCE = `N'écris JAMAIS un jour de la semaine (lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche) dans le
titre ou le rationale d'une séance, et ne base aucun raisonnement de séquencement ("24h après...", "2-3h
après...") sur un jour précis — tu ne sais PAS encore quel jour calendaire chaque séance occupera (les
dates sont attribuées après coup, par un algorithme déterministe qui équilibre la semaine, jamais par toi).
Décris le séquencement relatif entre séances type (ex. "après une séance d'intensité") sans jamais nommer
de jour.`
