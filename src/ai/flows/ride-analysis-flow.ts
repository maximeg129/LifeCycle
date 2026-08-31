'use server';
/**
 * @fileOverview Full narrative analysis of one completed ride, built from
 * real Intervals.icu activity + stream data (never guessed) — normalized
 * power, power/HR zone time, pacing, fitted against the athlete's current
 * CTL/ATL/TSB and Coach Memory context. See ride-analysis-types.ts
 * (components/coach/) for the pure stream-crunching that produces the
 * numbers this flow's prompt is built from — this file only formats them
 * and asks Claude for a narrative reading, exactly like every other flow's
 * split between deterministic data and the model's interpretation of it.
 *
 * - rideAnalysis - Runs the flow.
 * - RideAnalysisInput / RideAnalysisOutput - Types for the above.
 */

import { z } from 'zod';
import { type FlowResult } from '@/ai/anthropic';
import { invokeCoachJson } from '@/ai/coach/invokeCoach';
import { withCoachOutputContract } from '@/ai/coach/outputContract';

const ZoneBucketSchema = z.object({
  zone: z.number(),
  label: z.string(),
  minutes: z.number(),
  pctOfRide: z.number(),
});
type ZoneBucketInput = z.infer<typeof ZoneBucketSchema>;

// Durabilité (R07/R08/R10, ride-analysis-2-power-profile-by-accumulated-tier,
// domain/cycling/metrics/durability.ts) — profil de puissance maximale
// moyenne (MMP) à chaque palier de travail accumulé (kJ/kg) franchi PENDANT
// cette sortie. Comparaison "à froid vs fatigué" DANS la même sortie (pas
// de comparaison à l'historique d'autres sorties — non câblée, voir le
// commentaire plus bas) mais déjà une vraie lecture de durabilité au sens
// de la règle : jamais un seuil labo, jamais un autre athlète.
const DurabilityTierSchema = z.object({
  tierKJPerKg: z.number().describe('Palier de travail accumulé (kJ/kg) — 0 = à froid, en début de sortie.'),
  reached: z.boolean().describe('Ce palier a-t-il été franchi pendant la sortie.'),
  mmp: z
    .array(z.object({ durationSeconds: z.number(), watts: z.number() }))
    .describe('MMP (W) par durée testée sur le segment de la sortie APRÈS ce palier — seulement les durées calculables (segment assez long).'),
});
type DurabilityTierInput = z.infer<typeof DurabilityTierSchema>;

const RideAnalysisInputSchema = z.object({
  activity: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    date: z.string().describe('yyyy-MM-dd'),
    distanceKm: z.number().optional(),
    durationMinutes: z.number(),
    avgWatts: z.number().optional(),
    normalizedWatts: z.number().optional(),
    variabilityIndex: z.number().optional().describe('NP/avg power — pacing smoothness, ~1.0 is very even, >1.1 is spiky/punchy'),
    avgHeartrate: z.number().optional(),
    maxHeartrate: z.number().optional(),
    avgCadence: z.number().optional(),
    elevationGainM: z.number().optional(),
    trainingLoad: z.number().optional(),
    intensity: z.number().optional().describe('Intervals.icu intensity factor (NP/FTP)'),
    rpe: z.number().optional().describe('1-10, athlete-entered on Intervals.icu'),
    feel: z.number().optional().describe('-1..1, converted from the athlete-entered 1-5 Feel rating'),
  }),
  powerZones: z.array(ZoneBucketSchema).optional().describe('Coggan 7-zone power distribution, % of FTP'),
  hrZones: z.array(ZoneBucketSchema).optional().describe('5-zone heart-rate distribution, % of max HR'),
  split: z.object({
    firstHalfAvgWatts: z.number(),
    secondHalfAvgWatts: z.number(),
    fade: z.enum(['negative', 'positive', 'even']),
    fadePct: z.number(),
  }).optional(),
  decoupling: z
    .object({
      efficiencyFirstHalf: z.number().describe('Puissance/FC moyenne, 1ère moitié.'),
      efficiencySecondHalf: z.number().describe('Puissance/FC moyenne, 2e moitié.'),
      decouplingPct: z.number().describe('% de perte d\'efficience entre les deux moitiés — positif = dérive cardiaque, négatif = amélioration.'),
    })
    .optional()
    .describe('Découplage Pw:HR (R06, domain/cycling/metrics/decoupling.ts) — absent si pas de flux watts ET FC de même longueur.'),
  athlete: z.object({
    ftp: z.number().optional(),
    ctl: z.number().optional(),
    atl: z.number().optional(),
    tsb: z.number().optional(),
  }).optional().describe("Athlete's current fitness state, for context — not necessarily the FTP that produced the zones above (see intensity/normalizedWatts, which already reflect it)."),
  durability: z
    .array(DurabilityTierSchema)
    .optional()
    .describe(
      'Profil de durabilité (MMP par palier de travail accumulé kJ/kg franchi pendant cette sortie) — voir domain/cycling/metrics/durability.ts. Absent si pas de flux watts ou pas de poids athlète connu.'
    ),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, goals, lifestyle, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
}).describe('Input for the ride analysis flow.');

export type RideAnalysisInput = z.infer<typeof RideAnalysisInputSchema>;

const RideAnalysisOutputSchema = withCoachOutputContract({
  headline: z.string().describe('One short, specific title for this ride, e.g. "Sortie tempo bien négociée"'),
  summary: z.string().min(1).describe('2-4 sentence narrative overview of how the ride went'),
  strengths: z.array(z.string()).describe('1-4 short, specific positives, referencing real numbers when possible'),
  improvementAreas: z.array(z.string()).describe('1-4 short, specific things to work on next time — empty array if genuinely nothing stands out'),
  effortContext: z.string().describe("1-2 sentences on how this effort fits the athlete's current form (CTL/ATL/TSB) and any active goal"),
  recommendation: z.string().min(1).describe('One concrete suggestion for the next session or for recovery'),
}).describe('Output of the ride analysis flow.');

export type RideAnalysisOutput = z.infer<typeof RideAnalysisOutputSchema>;

function formatZones(zones: ZoneBucketInput[] | undefined, label: string): string {
  if (!zones || zones.length === 0) return '';
  const lines = zones.filter((z) => z.minutes > 0).map((z) => `  - Z${z.zone} ${z.label} : ${z.minutes} min (${z.pctOfRide}%)`);
  if (lines.length === 0) return '';
  return `${label} :\n${lines.join('\n')}`;
}

function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}min`;
}

/** Ne garde que les paliers réellement franchis avec au moins une durée de MMP calculable — un palier non atteint n'apporte rien au prompt. */
function formatDurability(tiers: DurabilityTierInput[] | undefined): string {
  if (!tiers || tiers.length === 0) return '';
  const reached = tiers.filter((t) => t.reached && t.mmp.length > 0);
  if (reached.length === 0) return '';
  const lines = reached.map((t) => {
    const mmpText = t.mmp.map((m) => `${formatDurationLabel(m.durationSeconds)} : ${Math.round(m.watts)}W`).join(', ');
    return `  - ${t.tierKJPerKg} kJ/kg franchi : ${mmpText}`;
  });
  return `DURABILITÉ — puissance maximale moyenne (MMP) par palier de travail accumulé déjà franchi pendant cette sortie (comparaison à froid vs fatigué, DANS cette même sortie) :\n${lines.join('\n')}`;
}

export async function rideAnalysis(input: RideAnalysisInput): Promise<FlowResult<RideAnalysisOutput>> {
  try {
    const parsed = RideAnalysisInputSchema.parse(input);
    const a = parsed.activity;

    const sections: string[] = [];
    sections.push([
      `SORTIE : ${a.name || 'Sans nom'} (${a.type ?? 'Ride'}, ${a.date})`,
      `Durée : ${a.durationMinutes} min${a.distanceKm != null ? `, distance ${a.distanceKm} km` : ''}`,
      a.elevationGainM != null ? `Dénivelé : ${a.elevationGainM} m` : '',
      a.avgWatts != null ? `Puissance moyenne : ${a.avgWatts} W${a.normalizedWatts != null ? ` (normalisée : ${a.normalizedWatts} W)` : ''}` : '',
      a.variabilityIndex != null ? `Indice de variabilité : ${a.variabilityIndex.toFixed(2)}` : '',
      a.intensity != null ? `Intensité (IF) : ${a.intensity.toFixed(2)}` : '',
      a.trainingLoad != null ? `Charge d'entraînement : ${a.trainingLoad}` : '',
      a.avgHeartrate != null ? `FC moyenne : ${a.avgHeartrate} bpm${a.maxHeartrate != null ? ` (max ${a.maxHeartrate})` : ''}` : '',
      a.avgCadence != null ? `Cadence moyenne : ${Math.round(a.avgCadence)} rpm` : '',
      a.rpe != null ? `RPE ressenti (athlète) : ${a.rpe}/10` : '',
      a.feel != null ? `Feeling ressenti (athlète) : ${a.feel > 0.1 ? 'positif' : a.feel < -0.1 ? 'négatif' : 'neutre'}` : '',
    ].filter(Boolean).join('\n'));

    const zonesText = [
      formatZones(parsed.powerZones, 'RÉPARTITION PAR ZONES DE PUISSANCE (% FTP)'),
      formatZones(parsed.hrZones, 'RÉPARTITION PAR ZONES DE FC (% FC max de la sortie)'),
    ].filter(Boolean).join('\n\n');
    if (zonesText) sections.push(zonesText);

    if (parsed.split) {
      const s = parsed.split;
      const pacing = s.fade === 'negative' ? `négative split, a accéléré de ${Math.abs(s.fadePct)}%`
        : s.fade === 'positive' ? `a faibli de ${s.fadePct}% sur la 2e moitié`
          : 'pacing régulier';
      sections.push(`PACING : 1ère moitié ${s.firstHalfAvgWatts} W vs 2e moitié ${s.secondHalfAvgWatts} W (${pacing})`);
    }

    if (parsed.decoupling) {
      const d = parsed.decoupling;
      const direction = d.decouplingPct > 0 ? 'dérive cardiaque' : d.decouplingPct < 0 ? 'amélioration' : 'stable';
      sections.push(
        `DÉCOUPLAGE PUISSANCE:FC (Pw:HR) : efficience 1ère moitié ${d.efficiencyFirstHalf.toFixed(2)} W/bpm vs 2e moitié ${d.efficiencySecondHalf.toFixed(2)} W/bpm (${d.decouplingPct.toFixed(1)}%, ${direction})`
      );
    }

    if (parsed.athlete) {
      const t = parsed.athlete;
      const line = [
        t.ftp != null ? `FTP : ${t.ftp} W` : '',
        t.ctl != null ? `CTL (fitness) : ${t.ctl}` : '',
        t.atl != null ? `ATL (fatigue) : ${t.atl}` : '',
        t.tsb != null ? `TSB (forme) : ${t.tsb}` : '',
      ].filter(Boolean).join(', ');
      if (line) sections.push(`FORME ACTUELLE DE L'ATHLÈTE : ${line}`);
    }

    const durabilityText = formatDurability(parsed.durability);
    if (durabilityText) sections.push(durabilityText);

    const coachContextBlock = parsed.coachContext ? `${parsed.coachContext}\n\n` : '';

    const system = `${coachContextBlock}Tu es un coach cycliste expert qui analyse une sortie terminée pour l'athlète, à partir de vraies données Intervals.icu (jamais inventées). Réponds entièrement en français.

Analyse les données ci-dessous et produis une analyse honnête, concrète et encourageante de cette sortie. Réfère-toi aux vrais chiffres fournis plutôt que de rester vague (par exemple "puissance normalisée de 210W bien tenue sur l'ensemble" plutôt que "bonne puissance"). Si peu de données sont disponibles (pas de puissance ni de FC), dis-le brièvement et analyse ce qui est disponible (durée, dénivelé, charge, ressenti) plutôt que d'inventer des observations sur la puissance ou la fréquence cardiaque.
Si un profil de durabilité est fourni, commente si la puissance tient ou décline à mesure que le travail s'accumule pendant la sortie (paliers kJ/kg) — c'est une lecture différente de la puissance moyenne globale, jamais interchangeable avec elle. Cette comparaison reste interne à CETTE sortie (à froid vs fatigué) : ne prétends JAMAIS comparer à l'historique de l'athlète ou à un seuil labo/un autre athlète, aucune de ces deux comparaisons n'est fournie ici.
Si un découplage puissance:FC est fourni, ne l'interprète JAMAIS automatiquement comme un signe de fatigue — contextualise (chaleur, hydratation/hypovolémie, dénivelé, intensité variable sur la sortie) plutôt que d'affirmer une cause précise que les données ne permettent pas de trancher.

Réponds UNIQUEMENT avec un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme exacte
(plus les champs de contrat obligatoires décrits plus haut) :
{
  "headline": "titre court et parlant",
  "summary": "2-4 phrases de synthèse",
  "strengths": ["1-4 points forts précis"],
  "improvementAreas": ["1-4 points à travailler, tableau vide si rien ne ressort vraiment"],
  "effortContext": "1-2 phrases sur comment cet effort s'inscrit dans la forme actuelle (CTL/ATL/TSB) et les objectifs",
  "recommendation": "une suggestion concrète pour la suite (prochaine séance ou récupération)"
}`;

    return invokeCoachJson(RideAnalysisOutputSchema, {
      flowId: 'rideAnalysis',
      taskSystemPrompt: system,
      messages: [{ role: 'user', content: sections.join('\n\n') }],
    });
  } catch (e) {
    console.error('[rideAnalysis] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
