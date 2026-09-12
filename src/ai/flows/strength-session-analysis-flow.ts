'use server';
/**
 * @fileOverview Analyse IA complète et automatique d'une séance de
 * musculation venant d'être terminée — chantier "repenser planification/
 * séances/feedback" (voir CLAUDE.md, pièce B3), retour utilisateur : "une
 * fois une seance realisé (identifiée soit dans l'app pour la muscu ou via
 * intervals pour le cyclisme) l'IA donne une analyse complete automatique
 * de la seance, pas seulement de l'observation de donnees mais en
 * profondeur basé sur toutes les datas de disponible intervals." Même
 * discipline que rideAnalysis (données réelles jamais inventées, le flow
 * ne fait qu'interpréter des chiffres déjà calculés côté client) — pendant
 * musculation de ce flow, avec deux différences structurelles :
 * - Pas de streams seconde par seconde à crunching : les chiffres réels
 *   sont déjà exactement ceux saisis par l'athlète (séries/répétitions/
 *   charge, voir strength-log-types.ts), aucun calcul de zones/pacing.
 * - "Toutes les données disponibles Intervals.icu" s'applique ici à la
 *   FORME CYCLISTE actuelle (CTL/ATL/TSB) — pour commenter comment CETTE
 *   séance de force s'inscrit dans la charge globale de l'athlète
 *   (interférence/complémentarité), jamais pour juger la séance de muscu
 *   elle-même (aucune métrique cycliste ne s'applique à un squat).
 *
 * - strengthSessionAnalysis - Runs the flow.
 * - StrengthSessionAnalysisInput / StrengthSessionAnalysisOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';
import { STRENGTH_TRAINING_GUIDANCE } from './strength-training-guidance';

const LoggedSetDetailInputSchema = z.object({
  reps: z.number(),
  loadKg: z.number().optional(),
});

const PreviousBestSchema = z.object({
  date: z.string().describe('yyyy-MM-dd de la dernière fois que cet exercice a été loggé.'),
  sets: z.number(),
  reps: z.string(),
  loadKg: z.number().optional(),
});

const AnalyzedExerciseSchema = z.object({
  name: z.string(),
  sets: z.number(),
  reps: z.string(),
  loadKg: z.number().optional().describe('Charge (kg) — absente pour un exercice au poids du corps.'),
  notes: z.string().optional(),
  setsDetail: z.array(LoggedSetDetailInputSchema).optional().describe('Détail série par série, présent uniquement pour une séance loguée en direct.'),
  previousBest: PreviousBestSchema.optional().describe('Dernière fois que cet exercice a été loggé — pour juger la progression réelle, jamais un 1RM estimé. Absent si jamais fait avant.'),
  isPersonalRecord: z.boolean().optional().describe('Vrai UNIQUEMENT si la charge de cette séance dépasse le record déjà connu pour cet exercice — calculé côté client, jamais laissé au modèle à déduire lui-même depuis les chiffres bruts.'),
});

const StrengthSessionAnalysisInputSchema = z.object({
  session: z.object({
    date: z.string().describe('yyyy-MM-dd'),
    title: z.string(),
    durationMinutes: z.number().optional(),
    totalWeightLiftedKg: z.number().optional().describe('Somme reps × charge sur toute la séance (totalWeightLiftedKg, strength-log-types.ts) — 0/absent pour une séance purement poids du corps.'),
    sessionRpe: z.number().optional().describe('1-10, athlète — échelle 1 = très facile → 10 = effort maximal, un chiffre BAS est un signal FAVORABLE (séance bien tolérée), jamais un ressenti négatif.'),
    sessionNotes: z.string().optional().describe("Note libre de l'athlète, saisie après la séance."),
  }),
  exercises: z.array(AnalyzedExerciseSchema),
  athlete: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
  }).optional().describe("Forme cycliste actuelle (CTL/ATL/TSB, Intervals.icu) — pour commenter l'interférence/complémentarité entre cette séance de force et la charge vélo en cours, JAMAIS pour juger la séance de muscu elle-même (aucune de ces métriques ne s'applique directement à un exercice de force)."),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, goals, lifestyle, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the strength session analysis flow.');

export type StrengthSessionAnalysisInput = z.infer<typeof StrengthSessionAnalysisInputSchema>;

const StrengthSessionAnalysisOutputSchema = withCoachOutputContract({
  headline: z.string().describe('One short, specific title for this session, e.g. "Séance force du haut du corps solide"'),
  summary: z.string().min(1).describe('2-4 sentence narrative overview of how the session went'),
  strengths: z.array(z.string()).describe('1-4 short, specific positives, referencing real numbers when possible (charges, progression vs la dernière fois)'),
  improvementAreas: z.array(z.string()).describe('1-4 short, specific things to work on next time — empty array if genuinely nothing stands out'),
  recoveryContext: z
    .string()
    .min(1)
    .describe(
      "1-2 phrases sur comment CETTE séance de force s'inscrit dans la charge/forme vélo actuelle de l'athlète (CTL/ATL/TSB si fournis) — interférence possible avec une séance vélo clé proche, ou complémentarité. Dis explicitement que la forme cycliste n'est pas fournie si athlete est absent, plutôt que d'inventer un lien."
    ),
  recommendation: z.string().min(1).describe('One concrete suggestion for the next strength session or for recovery'),
}).describe('Output of the strength session analysis flow.');

export type StrengthSessionAnalysisOutput = z.infer<typeof StrengthSessionAnalysisOutputSchema>;

function formatPreviousBest(prev: z.infer<typeof PreviousBestSchema> | undefined): string {
  if (!prev) return ''
  return ` — dernière fois (${prev.date}) : ${prev.sets}x${prev.reps}${prev.loadKg != null ? ` @ ${prev.loadKg}kg` : ''}`
}

function formatExercise(ex: z.infer<typeof AnalyzedExerciseSchema>): string {
  const detail = ex.setsDetail && ex.setsDetail.length > 0
    ? ex.setsDetail.map((d) => `${d.reps} reps${d.loadKg != null ? ` @ ${d.loadKg}kg` : ''}`).join(', ')
    : `${ex.sets}x${ex.reps}${ex.loadKg != null ? ` @ ${ex.loadKg}kg` : ''}`
  const pr = ex.isPersonalRecord ? ' 🏆 RECORD PERSONNEL' : ''
  const notes = ex.notes ? ` (note athlète : ${ex.notes})` : ''
  return `  - ${ex.name} : ${detail}${pr}${formatPreviousBest(ex.previousBest)}${notes}`
}

export async function strengthSessionAnalysis(input: StrengthSessionAnalysisInput): Promise<FlowResult<StrengthSessionAnalysisOutput>> {
  try {
    const parsed = StrengthSessionAnalysisInputSchema.parse(input);
    const s = parsed.session;

    const sections: string[] = [];
    sections.push([
      `SÉANCE DE MUSCULATION : ${s.title} (${s.date})`,
      s.durationMinutes != null ? `Durée : ${s.durationMinutes} min` : '',
      s.totalWeightLiftedKg != null && s.totalWeightLiftedKg > 0 ? `Poids total soulevé : ${Math.round(s.totalWeightLiftedKg)} kg` : '',
      s.sessionRpe != null ? `RPE de séance (athlète) : ${s.sessionRpe}/10 (échelle 1 = très facile → 10 = effort maximal ; un chiffre BAS est un signal FAVORABLE — jamais un ressenti négatif)` : '',
      s.sessionNotes ? `Note de l'athlète : "${s.sessionNotes}"` : '',
    ].filter(Boolean).join('\n'));

    sections.push(`EXERCICES :\n${parsed.exercises.map(formatExercise).join('\n')}`);

    if (parsed.athlete) {
      const a = parsed.athlete;
      const line = [
        a.ctl != null ? `CTL (fitness cycliste) : ${a.ctl}` : '',
        a.atl != null ? `ATL (fatigue) : ${a.atl}` : '',
        a.tsb != null ? `TSB (forme) : ${a.tsb}` : '',
      ].filter(Boolean).join(', ');
      if (line) sections.push(`FORME CYCLISTE ACTUELLE DE L'ATHLÈTE (pour le contexte d'interférence, pas pour juger la séance de muscu elle-même) : ${line}`);
    }

    const coachContextBlock = parsed.coachContext ? `${parsed.coachContext}\n\n` : '';

    const system = `${coachContextBlock}Tu es un coach de force expert en entraînement concurrent (force + endurance cycliste) qui analyse une séance de musculation terminée par un cycliste, à partir de vraies données saisies par l'athlète (jamais inventées). Réponds entièrement en français.

Analyse les données ci-dessous et produis une analyse honnête, concrète et encourageante de cette séance. Réfère-toi aux vrais chiffres fournis plutôt que de rester vague (ex. "squat monté à 80kg, +5kg par rapport à la dernière fois" plutôt que "bonne progression"). Un exercice marqué RECORD PERSONNEL mérite d'être célébré explicitement dans "strengths".

Guidance sur l'entraînement de force pour un cycliste (applique ces principes pour juger la qualité des choix d'exercices/charges, sans jamais inventer un chiffre au-delà de ce qui suit) :
- ${STRENGTH_TRAINING_GUIDANCE}

Le RPE de séance est une mesure subjective — un chiffre bas (proche de 1) est un signal FAVORABLE (séance bien tolérée), jamais un ressenti négatif à investiguer. Ne le confonds jamais avec un signe de mauvaise séance.

"recoveryContext" doit relier CETTE séance de force à la forme cycliste actuelle de l'athlète (CTL/ATL/TSB) si elle est fournie : une séance de force lourde le jour d'un TSB déjà très négatif mérite d'être signalée comme un ajout de fatigue à surveiller ; à l'inverse une séance de force en période de forme fraîche (TSB positif) ou de repos vélo est une bonne fenêtre. Si "athlete" est absent, dis-le simplement plutôt que d'inventer un lien avec une forme cycliste non fournie.

Réponds UNIQUEMENT avec un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme exacte
(plus les champs de contrat obligatoires décrits plus haut) :
{
  "headline": "titre court et parlant",
  "summary": "2-4 phrases de synthèse",
  "strengths": ["1-4 points forts précis"],
  "improvementAreas": ["1-4 points à travailler, tableau vide si rien ne ressort vraiment"],
  "recoveryContext": "1-2 phrases sur comment cette séance s'inscrit dans la charge/forme vélo actuelle",
  "recommendation": "une suggestion concrète pour la prochaine séance de force ou pour la récupération"
}`;

    return invokeCoachJson(StrengthSessionAnalysisOutputSchema, {
      flowId: 'strengthSessionAnalysis',
      taskSystemPrompt: system,
      messages: [{ role: 'user', content: sections.join('\n\n') }],
    });
  } catch (e) {
    console.error('[strengthSessionAnalysis] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
