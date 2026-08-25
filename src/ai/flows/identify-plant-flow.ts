'use server';
/**
 * @fileOverview Un agent IA pour identifier les plantes et proposer un plan d'entretien.
 * Supporte également le suivi d'évolution en acceptant un contexte d'analyse précédente.
 */

import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { generateJson } from '@/ai/anthropic';

const PlantContextSchema = z.object({
  name: z.string().optional(),
  species: z.string().optional(),
  previousHealthAnalysis: z.string().optional(),
  daysSinceLastAnalysis: z.number().optional(),
}).describe("Contexte de suivi pour une plante déjà enregistrée.");

const IdentifyPlantInputSchema = z.object({
  photoDataUri: z.string().describe("Photo de la plante en base64."),
  locationContext: z.string().optional().describe("Contexte optionnel (ex: intérieur, balcon)."),
  plantContext: PlantContextSchema.optional().describe("Contexte de suivi pour une analyse de suivi."),
});

const IdentifyPlantOutputSchema = z.object({
  name: z.string().describe("Nom commun de la plante."),
  species: z.string().describe("Nom scientifique."),
  healthAnalysis: z.string().describe("Analyse visuelle détaillée de l'état de santé."),
  healthScore: z.number().min(0).max(100).describe("Score de santé global de 0 (critique) à 100 (excellent)."),
  alerts: z.array(z.string()).describe("Alertes ou problèmes détectés (maladies, carences, brûlures, surhydratation…). Tableau vide si aucun problème."),
  hydrationPlan: z.object({
    frequency: z.string().describe("Fréquence d'arrosage recommandée (ex: 'tous les 7 jours')."),
    amount: z.string().describe("Quantité d'eau recommandée en millilitres, adaptée à la taille visible de la plante/pot (ex: '150 ml', '300 ml', '500 ml'). Toujours exprimer en ml avec un chiffre précis."),
    tips: z.string().describe("Conseils spécifiques pour l'hydratation."),
  }),
  generalCare: z.array(z.string()).describe("Conseils généraux d'entretien."),
});

export type IdentifyPlantInput = z.infer<typeof IdentifyPlantInputSchema>;
export type IdentifyPlantOutput = z.infer<typeof IdentifyPlantOutputSchema>;

/** Splits a `data:image/jpeg;base64,...` URI into the parts Claude's vision input needs. */
function parseDataUri(dataUri: string): { mediaType: string; data: string } {
  const match = dataUri.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) throw new Error('photoDataUri must be a base64 image data URI (data:image/...;base64,...)');
  return { mediaType: match[1], data: match[2] };
}

export async function identifyPlant(input: IdentifyPlantInput): Promise<IdentifyPlantOutput> {
  const parsedInput = IdentifyPlantInputSchema.parse(input);
  const { mediaType, data } = parseDataUri(parsedInput.photoDataUri);

  let followUpText = '';
  if (parsedInput.plantContext) {
    const ctx = parsedInput.plantContext;
    followUpText = `\nSUIVI EN COURS — Plante connue : ${ctx.name ?? '?'} (${ctx.species ?? '?'}).`;
    if (ctx.previousHealthAnalysis) {
      followUpText += `\nAnalyse précédente (il y a ${ctx.daysSinceLastAnalysis ?? '?'} jours) : ${ctx.previousHealthAnalysis}\nCompare l'évolution, note les améliorations ou dégradations, et personnalise tes recommandations en conséquence.`;
    }
  }

  const system = `Tu es un expert en botanique et phytopathologie. Analyse la photo de plante fournie.
${followUpText}

Fournis :
1. Identification précise (nom commun + espèce scientifique)
2. Score de santé de 0 à 100 (0=mort/critique, 50=malade, 75=stable, 100=parfaite santé)
3. Analyse détaillée de l'état de santé visible
4. Liste des alertes et problèmes détectés (maladies, carences, brûlures, surhydratation, manque de lumière…). Si aucun problème, retourne un tableau vide.
5. Plan d'hydratation précis : fréquence en jours (ex: "tous les 7 jours"), quantité d'eau en ml adaptée à la taille réelle du pot/plante visible sur la photo (petit pot <15cm → 100-150ml, pot moyen 15-25cm → 200-350ml, grand pot >25cm → 400-700ml), et conseils spécifiques
6. Conseils généraux d'entretien (lumière, température, rempotage, engrais…)

Contexte lieu : ${parsedInput.locationContext ?? 'non précisé'}

Réponds UNIQUEMENT avec un objet JSON (pas de balises markdown, pas de texte autour) de cette forme exacte :
{
  "name": "nom commun",
  "species": "nom scientifique",
  "healthAnalysis": "analyse détaillée",
  "healthScore": 0-100,
  "alerts": ["alerte 1", ...],
  "hydrationPlan": { "frequency": "...", "amount": "... ml", "tips": "..." },
  "generalCare": ["conseil 1", ...]
}`;

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data } },
    { type: 'text', text: 'Voici la photo à analyser.' },
  ];

  return generateJson(IdentifyPlantOutputSchema, {
    system,
    messages: [{ role: 'user', content }],
  });
}
