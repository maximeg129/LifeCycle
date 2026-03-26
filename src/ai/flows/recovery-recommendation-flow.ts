'use server'

import { ai } from '@/ai/genkit'
import { z } from 'genkit'

const WellnessDaySchema = z.object({
  date: z.string(),
  hrv: z.number().nullable().optional(),
  restingHR: z.number().nullable().optional(),
  sleepHours: z.number().nullable().optional(),
  sleepScore: z.number().nullable().optional(),
  readiness: z.number().nullable().optional(),
  fatigue: z.number().nullable().optional(),
  mood: z.number().nullable().optional(),
  motivation: z.number().nullable().optional(),
  ctl: z.number().nullable().optional(),
  atl: z.number().nullable().optional(),
  rampRate: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
})

const InputSchema = z.object({
  wellnessData: z.array(WellnessDaySchema),
  ftp: z.number().nullable().optional(),
})

const OutputSchema = z.object({
  readinessLevel: z.enum(['high', 'moderate', 'low', 'rest']),
  summary: z.string(),
  trainingRecommendation: z.string(),
  recoveryTips: z.array(z.string()),
  alerts: z.array(z.object({
    type: z.enum(['warning', 'danger', 'info']),
    message: z.string(),
  })),
})

export async function recoveryRecommendation(input: z.infer<typeof InputSchema>) {
  const { output } = await ai.generate({
    prompt: `Tu es un coach cycliste expert en récupération et périodisation. Analyse les données wellness des 7 derniers jours de cet athlète cycliste et fournis des recommandations personnalisées.

Données wellness (du plus ancien au plus récent) :
${JSON.stringify(input.wellnessData, null, 2)}

${input.ftp ? `FTP actuel : ${input.ftp}W` : ''}

Règles d'analyse :
- HRV en baisse >10% sur 7j + ramp rate >7 = risque de surentraînement
- Sommeil <6h sur 3 jours consécutifs = récupération insuffisante
- FC repos en hausse >5bpm vs baseline 7j = signal de fatigue/maladie
- Fatigue élevée (>3/5) + motivation basse (<3/5) = besoin de repos
- CTL-ATL (TSB) < -20 = fatigue profonde, éviter l'intensité
- Ramp rate > 8 TSS/j = montée en charge trop rapide

Fournis :
1. Un niveau de readiness (high/moderate/low/rest)
2. Un résumé concis de l'état de l'athlète (2-3 phrases max)
3. Une recommandation d'entraînement pour aujourd'hui (type de séance, zone, durée)
4. 2-3 conseils de récupération concrets et actionnables
5. Des alertes si des signaux de surentraînement sont détectés

Réponds en français. Sois direct et concret, pas de jargon inutile.`,
    output: { schema: OutputSchema },
  })

  return output
}
