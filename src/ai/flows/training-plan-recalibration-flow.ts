'use server';
/**
 * @fileOverview Recalibrates the REMAINING weeks of an already-generated
 * training plan after a week completes, based on what the athlete actually
 * rode vs. what that week targeted. Retour utilisateur : "Serais t il
 * possible de penser à automatique mais documentée on pourrais expliquer à
 * l'athlète pourquoi le plan a changé. Également on garderais un trace du
 * plan d'origine pour pouvoir comprendre les impacts des changement."
 *
 * Deliberately narrow, unlike trainingPlanGeneration:
 * - NEVER touches a week that has already ended (weekNumber <=
 *   throughWeekNumber) — training-plan-types.ts's weekNeedsRecalibration/
 *   applyRecalibration enforce this on the caller side; this flow's own
 *   input only ever contains the weeks still ahead.
 * - Does NOT re-imagine the whole plan — it adjusts phase/focus/
 *   targetWeeklyMinutes on the weeks it's given, same periodization
 *   principles as generation (taper before the event stays taper, a
 *   recovery week is still needed periodically), informed by one new
 *   signal: actual vs. target volume on the week that just finished.
 * - "summary"/"reasons" (contrat de sortie coach) ARE the explanation
 *   surfaced to the athlete ("expliquer... pourquoi le plan a changé") —
 *   see training-plan-tab.tsx's "Journal du plan".
 *
 * - trainingPlanRecalibration - Runs the flow.
 * - TrainingPlanRecalibrationInput / TrainingPlanRecalibrationOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const PlanPhaseEnum = z.enum(['base', 'build', 'peak', 'taper', 'recovery']);

const PlanWeekContentSchema = z.object({
  weekNumber: z.number(),
  phase: PlanPhaseEnum,
  focus: z.string(),
  targetWeeklyMinutes: z.number(),
  notes: z.string().optional(),
});

const TrainingPlanRecalibrationInputSchema = z.object({
  today: z.string().describe('yyyy-MM-dd'),
  eventName: z.string(),
  eventDate: z.string().describe('yyyy-MM-dd'),
  throughWeekNumber: z.number().describe('The most recently completed week — never present in remainingWeeks, never to be touched.'),
  completedWeek: z.object({
    phase: PlanPhaseEnum,
    focus: z.string(),
    targetWeeklyMinutes: z.number(),
    actualMinutes: z.number().describe('Real completed training minutes this week, from Intervals.icu activities — never invented.'),
  }).describe('How the just-finished week actually went vs. what it targeted.'),
  remainingWeeks: z.array(PlanWeekContentSchema).describe('The plan\'s current content for every week AFTER throughWeekNumber — the ONLY weeks this flow may adjust.'),
  training: z.object({
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
    ftp: z.number().optional().describe('Functional Threshold Power (W), from Intervals.icu.'),
    weightKg: z.number().optional().describe('Athlete weight (kg), from Intervals.icu.'),
  }).optional().describe('Current Intervals.icu training load and physiological reference values, if connected.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the training plan recalibration flow.');

export type TrainingPlanRecalibrationInput = z.infer<typeof TrainingPlanRecalibrationInputSchema>;

const TrainingPlanRecalibrationOutputSchema = withCoachOutputContract({
  // Redéfinit "summary" — même raison que trainingPlanGeneration : c'est le
  // texte que l'athlète lit pour comprendre pourquoi le plan a changé
  // (retour utilisateur explicite), pas un aperçu générique en une phrase.
  summary: z
    .string()
    .min(1)
    .describe(
      "Un vrai paragraphe (3-5 phrases) expliquant CE QUI a changé dans le plan et POURQUOI, en partant du " +
        "constat réel (volume ciblé vs réalisé la semaine écoulée, forme actuelle) — jamais une reformulation " +
        "vague du plan initial. Si rien n'a changé, dis-le clairement et explique pourquoi le plan initial reste " +
        'valable plutôt que de forcer un changement.'
    ),
  adjustedWeeks: z
    .array(PlanWeekContentSchema)
    .describe('EXACTLY the same weeks as remainingWeeks (same weekNumbers, same order) — adjust phase/focus/targetWeeklyMinutes/notes as needed, or leave a week identical if no change is warranted.'),
  warnings: z.array(z.string()).describe('0-3 short things the athlete should know about this recalibration. Empty array if nothing stands out.'),
}).describe('Output of the training plan recalibration flow.');

export type TrainingPlanRecalibrationOutput = z.infer<typeof TrainingPlanRecalibrationOutputSchema>;

export async function trainingPlanRecalibration(input: TrainingPlanRecalibrationInput): Promise<FlowResult<TrainingPlanRecalibrationOutput>> {
  try {
  const parsedInput = TrainingPlanRecalibrationInputSchema.parse(input);
  const cw = parsedInput.completedWeek;
  const actualPct = cw.targetWeeklyMinutes > 0 ? Math.round((cw.actualMinutes / cw.targetWeeklyMinutes) * 100) : null;

  const sections: string[] = [
    `AUJOURD'HUI : ${parsedInput.today}`,
    `OBJECTIF : ${parsedInput.eventName} le ${parsedInput.eventDate}`,
    [
      `SEMAINE ${parsedInput.throughWeekNumber} TERMINÉE (phase ${cw.phase}, focus "${cw.focus}") :`,
      `Volume ciblé : ${cw.targetWeeklyMinutes} minutes`,
      `Volume réellement réalisé (Intervals.icu) : ${cw.actualMinutes} minutes${actualPct != null ? ` (${actualPct}% de la cible)` : ''}`,
    ].join('\n'),
    `SEMAINES RESTANTES DU PLAN (les SEULES que tu peux ajuster — jamais la semaine ${parsedInput.throughWeekNumber} ni une semaine antérieure) :\n${parsedInput.remainingWeeks
      .map((w) => `  - Semaine ${w.weekNumber} (${w.phase}) : "${w.focus}", ${w.targetWeeklyMinutes} min${w.notes ? `, note: ${w.notes}` : ''}`)
      .join('\n')}`,
  ];

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CHARGE D\'ENTRAÎNEMENT ACTUELLE (Intervals.icu) :',
      `CTL (fitness) : ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue) : ${t.atl ?? 'n/a'}`,
      `TSB (forme) : ${t.tsb ?? 'n/a'}`,
      `FTP : ${t.ftp != null ? `${t.ftp} W` : 'n/a'}`,
      `Poids : ${t.weightKg != null ? `${t.weightKg} kg` : 'n/a'}`,
    ].join('\n'));
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach cycliste expert en périodisation. Une semaine du plan de l'athlète vient de se
terminer — recalibre les semaines RESTANTES du plan (jamais celles déjà passées) à la lumière de ce qui
s'est réellement passé cette semaine-là, pas seulement de ce qui était prévu à l'origine.

Règles impératives :
- Ne touche JAMAIS à une semaine déjà passée (semaine ${parsedInput.throughWeekNumber} ou antérieure) — seules les
  semaines listées dans "SEMAINES RESTANTES" peuvent être modifiées, et le tableau adjustedWeeks doit contenir
  EXACTEMENT ces mêmes numéros de semaine, dans le même ordre.
- Si le volume réalisé est significativement sous la cible (ex: <70%) de façon répétée ou avec un contexte
  de fatigue/blessure/gouverneur dégradé, NE COMPENSE PAS en gonflant les semaines suivantes pour "rattraper"
  le retard — ça reproduirait l'erreur de charge qui a probablement causé le manque. Ajuste plutôt la
  progression à la baisse ou maintiens le palier plus longtemps.
- Si le volume réalisé est proche ou au-dessus de la cible ET que la forme/récupération est bonne (TSB pas
  trop négatif, pas de blessure), le plan initial peut rester tel quel — ne change rien pour changer, dis-le
  explicitement dans summary plutôt que d'inventer un ajustement.
- Garde les principes de périodisation classiques : phase "base" → "build" → "peak" → "taper", une semaine
  "recovery" environ toutes les 3-4 semaines, les 1-2 dernières semaines avant l'objectif restent en "taper"
  avec un volume nettement réduit — ne supprime jamais le taper final même si tu ajustes le reste.
- Si la FTP/le CTL sont fournis, utilise-les pour juger si un ajustement à la hausse reste réaliste.
- N'invente pas de données manquantes — travaille avec ce qui est fourni.

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme
(plus les champs de contrat obligatoires décrits plus haut — "recommendation" donne une action concrète pour
la semaine qui vient) :
{
  "adjustedWeeks": [
    { "weekNumber": nombre, "phase": "base|build|peak|taper|recovery", "focus": "une phrase courte", "targetWeeklyMinutes": nombre, "notes": "optionnel" }
  ],
  "warnings": ["0 à 3 points d'attention courts, tableau vide si rien à signaler"]
}`;

  return invokeCoachJson(TrainingPlanRecalibrationOutputSchema, {
    flowId: 'trainingPlanRecalibration',
    taskSystemPrompt: system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
    maxTokens: 8192,
  });
  } catch (e) {
    console.error('[trainingPlanRecalibration] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
