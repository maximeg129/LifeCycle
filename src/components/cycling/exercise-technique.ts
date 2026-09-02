// ── Repères techniques par pattern de mouvement ─────────────────────────
//
// Retour utilisateur : "mettre un lien aussi descriptif, condensé en
// accordéon de l'exercice qui est demandé, la bonne technique à avoir".
// Contenu STATIQUE, jamais généré à la volée par l'IA : ce sont des repères
// techniques génériques et établis (pas une donnée personnelle de
// l'athlète), donc pas soumis à la discipline "jamais un chiffre inventé"
// qui s'applique aux métriques ailleurs dans cette app — mais rédigé une
// fois et relu, plutôt qu'halluciné à chaque séance par le modèle.
//
// Keyé par `pattern` (StrengthExerciseSchema, plan-week-sessions-flow.ts /
// MovementPattern, strengthSessionValidator.ts) plutôt que par nom
// d'exercice exact — le nom est du texte libre généré par l'IA ("Squat",
// "Presse à cuisses"...), donc non énumérable, alors que les 6 patterns du
// référentiel S05 couvrent déjà tout exercice muscu que cette app génère.

import type { MovementPattern } from '@/domain/cycling/validation/strengthSessionValidator'

export interface ExerciseTechnique {
  /** Titre affiché en en-tête de l'accordéon — le pattern en langage courant, avec des exemples d'exercices concrets. */
  title: string
  /** 3-5 repères courts, condensés — pas un guide complet, juste les points qui évitent les erreurs les plus fréquentes/risquées. */
  cues: string[]
}

export const EXERCISE_TECHNIQUE: Record<MovementPattern, ExerciseTechnique> = {
  'bilateral-heavy': {
    title: 'Mouvement bilatéral lourd (squat, presse, développé...)',
    cues: [
      "Dos neutre du début à la fin — pas d'arrondi lombaire sous charge.",
      'Genoux alignés avec les orteils, jamais projetés vers l\'intérieur.',
      'Amplitude complète et contrôlée plutôt qu\'une charge trop lourde pour la tenir.',
      'Expire à l\'effort (phase concentrique), inspire en descente.',
    ],
  },
  'hip-hinge': {
    title: 'Charnière de hanche (soulevé de terre, RDL, hip thrust...)',
    cues: [
      'Le mouvement part des hanches, pas du dos — dos plat sur toute la trajectoire.',
      'Charge proche du corps du début à la fin, jamais éloignée vers l\'avant.',
      'Verrouillage en haut par les fessiers, pas par une hyperextension lombaire.',
      'Genoux légèrement fléchis, jamais bloqués en rigidité.',
    ],
  },
  unilateral: {
    title: 'Unilatéral (fentes, step-up, squat bulgare...)',
    cues: [
      'Bassin stable — pas de bascule ni de rotation en cours de mouvement.',
      'Genou avant aligné avec le pied, sans dépasser excessivement la pointe.',
      'Même amplitude des deux côtés — noter le côté faible plutôt que de compenser.',
      'Charge plus légère qu\'en bilatéral : la stabilité prime sur le poids soulevé.',
    ],
  },
  'anti-extension': {
    title: 'Anti-extension / gainage frontal (planche, ab wheel...)',
    cues: [
      'Bassin rétroversé — pas de creux lombaire pendant le maintien.',
      'Respiration continue, jamais bloquée en apnée.',
      'Ligne tête-bassin-talons droite, fessiers ni relevés ni affaissés.',
      'Arrêter dès que la position se dégrade — la durée n\'a de valeur que si la forme tient.',
    ],
  },
  'anti-rotation-lateral': {
    title: 'Anti-rotation / gainage latéral (pallof press, planche latérale...)',
    cues: [
      'Résister activement à la rotation/l\'inclinaison provoquée par la charge, ne pas juste la subir.',
      'Hanches et épaules restent alignées sur tout le mouvement.',
      'Mouvement lent et contrôlé — la vitesse triche la résistance recherchée.',
      'Même durée/résistance imposée des deux côtés.',
    ],
  },
  'ankle-calf': {
    title: 'Cheville / mollet (mollets debout, élévations...)',
    cues: [
      'Amplitude complète — descente sous l\'horizontale du pied si la stabilité le permet.',
      'Contraction marquée en haut, pas de rebond sur l\'élan.',
      'Genou stable, sans flexion parasite pour "aider" la montée.',
      'Tempo contrôlé, surtout en descente (phase excentrique).',
    ],
  },
}
