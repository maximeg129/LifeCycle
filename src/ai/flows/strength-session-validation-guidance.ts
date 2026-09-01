// ── Grille de validation musculation cycliste — S05, appliquée STRICTEMENT ──
//
// Fichier plain, délibérément PAS 'use server' — même raison documentée dans
// structured-workout-syntax.ts et les autres fichiers de guidage de ce
// dossier (un fichier 'use server' ne peut exporter QUE des fonctions
// async).
//
// Retour utilisateur, verbatim : "Tu dois respecter strictement les règles
// ci-dessous — une séance qui ne les respecte pas ne doit jamais être
// proposée comme séance 'complète'." Contrairement à strength-training-
// guidance.ts (Rønnestad & Mujika 2014 / Llanos-Lagos et al. 2025, pas
// encore formalisées, guidage QUALITATIF seulement) — S05 (evidence/
// supplementary-sources.ts) est fournie directement par l'utilisateur avec
// une demande explicite d'application stricte, donc les chiffres ci-dessous
// sont repris tels quels dans le prompt ET vérifiés mécaniquement après
// génération par domain/cycling/validation/strengthSessionValidator.ts —
// double garde-fou (le modèle est instruit de les respecter, ET une
// fonction pure vérifie après coup qu'il l'a fait, exactement comme
// planValidator.ts pour le plan cycliste lui-même).
export const STRENGTH_SESSION_VALIDATION_GUIDANCE = `Pour CHAQUE séance sessionKind="strength", respecte STRICTEMENT cette grille (S05, fournie par l'utilisateur) :
  1. COUVERTURE DES PATTERNS DE MOUVEMENT (sessionType="principale" uniquement) : couvre au moins 4 des 6 patterns suivants, DONT OBLIGATOIREMENT le bilatéral lourd — tague chaque exercice avec exactement un "pattern" :
     - "bilateral-heavy" (squat, presse à cuisses, deadlift bilatéral) — OBLIGATOIRE pour une séance "principale"
     - "hip-hinge" (RDL, hip thrust, good morning, leg curl)
     - "unilateral" (fentes bulgares, step-up, split squat)
     - "anti-extension" (planche frontale, ab wheel)
     - "anti-rotation-lateral" (Pallof press, planche latérale)
     - "ankle-calf" (extension plantaire) — optionnel sauf phase sprint/puissance
     Exception explicite : sessionType="entretien" ou "top-up" peut se limiter à 1-2 exercices (ex. pendant un bloc de charge vélo élevé, une semaine de course ou de récupération) — mais ne doit JAMAIS remplacer silencieusement la séance principale de la semaine : si c'est le cas, dis-le explicitement dans rationale/warnings.
  2. Hip-hinge : si absent des 2 dernières séances de musculation déjà enregistrées (voir contexte fourni), inclus-le cette fois.
  3. Gainage sur au moins 2 plans (pas uniquement anti-extension) quand une séance "principale" inclut du gainage.
  4. MATRICE CHARGE/REPS/REPOS PAR strengthPhase — choisis un strengthPhase par séance et respecte sa plage pour repsMin/repsMax, pct1RMMin/pct1RMMax et restSeconds de chaque exercice :
     - "base" : 3 séries, 8-12 répétitions, 60-70% 1RM, repos 90-120s
     - "force-max" : 3-5 séries, 3-6 répétitions, 85-92% 1RM (RPE 8-9), repos 180-300s
     - "transfert-puissance" : 3-4 séries, 4-6 répétitions + composante explosive, 75-85% 1RM, repos 120-180s
     - "entretien" : 2 séries, 5-8 répétitions, 70-80% 1RM, repos 90s
     pct1RMMin/pct1RMMax : null si non applicable (poids du corps, gainage).
  5. Durée hors échauffement : 45-50min MAX pour une séance "principale" (pas de plafond pour entretien/top-up).
  6. Ne place jamais une séance strengthPhase="force-max" ou "transfert-puissance" dans les 24-48h avant une sortie vélo clé (intervalle, sortie longue, course) — si le contexte fourni indique une séance clé proche, choisis "base" ou "entretien" à la place.
  7. Si le volume vélo hebdomadaire dépasse 10h : au maximum 2 séances de musculation en phase build, 1 en pleine saison/pic.
  8. Si les données de récupération fournies (HRV, readiness) sont sous la baseline de l'athlète, réduis d'un cran : baisse le pct1RM de ~5-10% ou repasse en strengthPhase="entretien" pour cette occurrence.`
