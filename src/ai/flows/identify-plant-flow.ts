'use server';
/**
 * @fileOverview Un agent IA pour identifier les plantes et proposer un plan d'entretien.
 * Supporte également le suivi d'évolution en acceptant un contexte d'analyse précédente.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

export async function identifyPlant(input: IdentifyPlantInput): Promise<IdentifyPlantOutput> {
  return identifyPlantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'identifyPlantPrompt',
  input: { schema: IdentifyPlantInputSchema },
  output: { schema: IdentifyPlantOutputSchema },
  prompt: `Tu es un expert en botanique et phytopathologie. Analyse cette photo de plante :
{{media url=photoDataUri}}

{{#if plantContext}}
SUIVI EN COURS — Plante connue : {{plantContext.name}} ({{plantContext.species}}).
{{#if plantContext.previousHealthAnalysis}}
Analyse précédente (il y a {{plantContext.daysSinceLastAnalysis}} jours) : {{plantContext.previousHealthAnalysis}}
Compare l'évolution, note les améliorations ou dégradations, et personnalise tes recommandations en conséquence.
{{/if}}
{{/if}}

Fournis :
1. Identification précise (nom commun + espèce scientifique)
2. Score de santé de 0 à 100 (0=mort/critique, 50=malade, 75=stable, 100=parfaite santé)
3. Analyse détaillée de l'état de santé visible
4. Liste des alertes et problèmes détectés (maladies, carences, brûlures, surhydratation, manque de lumière…). Si aucun problème, retourne un tableau vide.
5. Plan d'hydratation précis : fréquence en jours (ex: "tous les 7 jours"), quantité d'eau en ml adaptée à la taille réelle du pot/plante visible sur la photo (petit pot <15cm → 100-150ml, pot moyen 15-25cm → 200-350ml, grand pot >25cm → 400-700ml), et conseils spécifiques
6. Conseils généraux d'entretien (lumière, température, rempotage, engrais…)

Contexte lieu : {{{locationContext}}}`
});

const identifyPlantFlow = ai.defineFlow(
  {
    name: 'identifyPlantFlow',
    inputSchema: IdentifyPlantInputSchema,
    outputSchema: IdentifyPlantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("IA analysis failed");
    return output;
  }
);
