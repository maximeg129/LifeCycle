'use server';
/**
 * @fileOverview Un agent IA pour identifier les plantes et proposer un plan d'entretien.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IdentifyPlantInputSchema = z.object({
  photoDataUri: z.string().describe("Photo de la plante en base64."),
  locationContext: z.string().optional().describe("Contexte optionnel (ex: intérieur, balcon)."),
});

const IdentifyPlantOutputSchema = z.object({
  name: z.string().describe("Nom commun de la plante."),
  species: z.string().describe("Nom scientifique."),
  healthAnalysis: z.string().describe("Analyse visuelle de l'état de santé."),
  hydrationPlan: z.object({
    frequency: z.string().describe("Fréquence d'arrosage recommandée."),
    amount: z.string().describe("Quantité d'eau recommandée."),
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
  prompt: `Tu es un expert en botanique. Analyse cette photo de plante :
  {{media url=photoDataUri}}
  
  Identifie la plante, analyse son état de santé apparent et propose un plan d'hydratation précis et des conseils d'entretien.
  Contexte : {{{locationContext}}}`
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
