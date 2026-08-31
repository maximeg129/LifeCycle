'use server';
/**
 * @fileOverview Proposes a single concrete workout for today, sized to the
 * time the athlete actually has available and adapted to their current form
 * (internal load governor, CTL/ATL/TSB, recent sessions, last night's
 * sleep/HRV/readiness) and Coach Memory (injuries, goals, lifestyle).
 * Output includes an Intervals.icu
 * workout-builder step script, ready to push to the calendar via
 * createPlannedWorkout() (see src/lib/intervals-api.ts).
 *
 * - dailyWorkoutRecommendation - Runs the flow.
 * - DailyWorkoutRecommendationInput / DailyWorkoutRecommendationOutput - Types for the above.
 */

import { z } from 'zod';
import { generateJson, type FlowResult } from '@/ai/anthropic';
import { fetchWeatherForecast, degreesToCompass, isSevereWeather, SEVERE_WIND_THRESHOLD_KMH } from '@/ai/weather';
import { STRUCTURED_WORKOUT_SYNTAX } from './structured-workout-syntax';

/** Below this, wind isn't worth routing around — asking the AI for advice on a light breeze would just invent filler. */
const WIND_ADVICE_THRESHOLD_KMH = 15;

const DailyWorkoutRecommendationInputSchema = z.object({
  date: z.string().describe('yyyy-MM-dd — the day this workout is planned for.'),
  availableMinutes: z.number().describe('Minutes the athlete actually has available today, including warmup/cooldown.'),
  sportType: z.string().optional().describe('Preferred Intervals.icu sport type (e.g. "Ride", "VirtualRide"). Defaults to "Ride".'),
  training: z.object({
    ctl: z.number().optional().describe('Chronic Training Load (fitness)'),
    atl: z.number().optional().describe('Acute Training Load (fatigue)'),
    tsb: z.number().optional().describe('Training Stress Balance (form) = ctl - atl'),
    rampRate: z.number().optional(),
  }).optional().describe('Current Intervals.icu training load, if connected.'),
  recentSessions: z.array(z.object({
    date: z.string().describe('yyyy-MM-dd'),
    type: z.string().optional(),
    durationMinutes: z.number().optional(),
    trainingLoad: z.number().optional(),
  })).describe('Last ~7 days of completed sessions, oldest first. Empty array if none.'),
  planWeek: z.object({
    weekNumber: z.number(),
    phase: z.enum(['base', 'build', 'peak', 'taper', 'recovery']),
    focus: z.string(),
    targetWeeklyMinutes: z.number(),
  }).optional().describe('The current week of the athlete\'s active mid/long-term training plan, if one exists — today\'s session should fit this week\'s phase and focus rather than being generated in a vacuum.'),
  recovery: z.object({
    sleepHours: z.number().optional(),
    sleepQuality: z.number().optional().describe('0-100'),
    hrv: z.number().optional().describe('ms'),
    readiness: z.number().optional().describe('0-100, device-reported recovery/readiness score when available (e.g. WHOOP via Intervals.icu), otherwise a lightweight local heuristic.'),
  }).optional().describe('Last night\'s sleep/HRV/readiness, auto-synced from Intervals.icu (or manually logged) — a bad night should measurably change today\'s proposal, not just training load.'),
  coachContext: z.string().optional().describe('Structured Coach Memory context block (injuries, lifestyle, goals, remembered facts, kJ budget, internal load governor) — prefixed to the system prompt when present.'),
  ride: z.object({
    location: z.string().describe('Departure location — city/place name, or "lat,lon".'),
    departureDateTime: z.string().describe('ISO date-time of departure — used to fetch the real forecast for wind-aware routing.'),
  }).optional().describe('When provided, the flow fetches the real weather forecast (temperature, wind speed/direction) via Open-Meteo and — if the wind is strong enough to matter — adds routing advice on which direction to head out first so it ends up as a tailwind on the way back.'),
}).describe('Input for the daily workout recommendation flow.');

export type DailyWorkoutRecommendationInput = z.infer<typeof DailyWorkoutRecommendationInputSchema>;

const DailyWorkoutRecommendationOutputSchema = z.object({
  title: z.string().describe('Short workout name, e.g. "Endurance 90min" or "Seuil 4x8min".'),
  sportType: z.string().describe('Intervals.icu sport type this workout is for, e.g. "Ride".'),
  durationMinutes: z.number().describe('Total planned duration including warmup/cooldown — must not exceed availableMinutes.'),
  intensityLabel: z.string().describe('One or two words describing the session, e.g. "Endurance", "Seuil", "Récupération active".'),
  rationale: z.string().describe('2-4 sentences in French explaining why this session fits today, grounded in the actual form/context data provided — not generic advice.'),
  structuredWorkout: z.string().describe('Intervals.icu workout-builder text script — section headers (optionally suffixed "Nx" for a repeat) each followed by "- " step lines. See system prompt for the exact syntax.'),
  warnings: z.array(z.string()).describe('0-3 short things the athlete should know before starting (injury caution, heavy week, etc). Empty array if nothing stands out.'),
  windAdvice: z.string().nullable().describe('1-2 French sentences of wind-aware routing advice (which general direction to head out first so the wind ends up at your back on the return leg) — null when no ride location/time was given, the forecast could not be fetched, the wind is too light to matter, or the weather was severe enough to switch the session indoors (no route to advise on).'),
  predictedWeather: z.object({
    temperatureCelsius: z.number().describe('Real temperature from the Open-Meteo forecast.'),
    windSpeedKmh: z.number().describe('Real wind speed from the Open-Meteo forecast.'),
    windDirectionCompass: z.string().describe('French 8-point compass label for the direction the wind is blowing FROM.'),
    conditions: z.string().describe('Real weather conditions from the forecast (e.g. "Pluie modérée", "Ciel dégagé").'),
  }).nullable().describe('The real weather fetched via Open-Meteo for the ride, same numbers and same "always a real pre-fetch, never invented" principle as Météo & Tenue (cyclingOutfitRecommendation) — null when no ride location/time was given or the forecast could not be fetched.'),
  weatherAlert: z.string().nullable().describe('Non-null ONLY when the real forecast is severe (heavy rain/snow, thunderstorm, or wind ≥ 40km/h) — 1-2 French sentences citing the real numbers, explaining that an outdoor ride is not advisable and that the session below has been adapted for a home trainer instead. Null when the weather is fine or no ride location/time was given.'),
}).describe('Output of the daily workout recommendation flow.');

export type DailyWorkoutRecommendationOutput = z.infer<typeof DailyWorkoutRecommendationOutputSchema>;

function formatRecentSessions(sessions: DailyWorkoutRecommendationInput['recentSessions']): string {
  if (sessions.length === 0) return '- Aucune séance enregistrée récemment.';
  return sessions.map((s) => {
    const type = s.type || 'séance';
    const duration = s.durationMinutes != null ? `${s.durationMinutes}min` : 'durée inconnue';
    const load = s.trainingLoad != null ? `, charge ${Math.round(s.trainingLoad)}` : '';
    return `- ${s.date}: ${type}, ${duration}${load}`;
  }).join('\n');
}

export async function dailyWorkoutRecommendation(input: DailyWorkoutRecommendationInput): Promise<FlowResult<DailyWorkoutRecommendationOutput>> {
  try {
  const parsedInput = DailyWorkoutRecommendationInputSchema.parse(input);

  const sections: string[] = [
    `DATE DE LA SÉANCE : ${parsedInput.date}`,
    `TEMPS DISPONIBLE : ${parsedInput.availableMinutes} minutes (échauffement et retour au calme inclus)`,
    `SPORT PRÉFÉRÉ : ${parsedInput.sportType || 'Ride'}`,
  ];

  if (parsedInput.training) {
    const t = parsedInput.training;
    sections.push([
      'CHARGE D\'ENTRAÎNEMENT (Intervals.icu) :',
      `CTL (fitness) : ${t.ctl ?? 'n/a'}`,
      `ATL (fatigue) : ${t.atl ?? 'n/a'}`,
      `TSB (forme) : ${t.tsb ?? 'n/a'}`,
      `Ramp rate : ${t.rampRate ?? 'n/a'}`,
    ].join('\n'));
  }

  sections.push(`SÉANCES RÉCENTES (7 derniers jours, du plus ancien au plus récent) :\n${formatRecentSessions(parsedInput.recentSessions)}`);

  if (parsedInput.planWeek) {
    const w = parsedInput.planWeek;
    sections.push([
      `PLAN D'ENTRAÎNEMENT EN COURS — semaine ${w.weekNumber} (phase ${w.phase}) :`,
      `Focus de la semaine : ${w.focus}`,
      `Volume cible cette semaine : ${w.targetWeeklyMinutes} minutes`,
    ].join('\n'));
  }

  if (parsedInput.recovery) {
    const r = parsedInput.recovery;
    sections.push([
      'RÉCUPÉRATION (nuit dernière) :',
      `Sommeil : ${r.sleepHours != null ? `${r.sleepHours}h` : 'n/a'}${r.sleepQuality != null ? ` (qualité ${r.sleepQuality}%)` : ''}`,
      `HRV : ${r.hrv != null ? `${r.hrv}ms` : 'n/a'}`,
      `Readiness : ${r.readiness != null ? `${r.readiness}/100` : 'n/a'}`,
    ].join('\n'));
  }

  // Wind-aware routing + severe-weather → home-trainer: only fetched when
  // the athlete gave a departure location/time (Coach > Proposition du
  // jour, champs optionnels). Fails soft — a geocoding/forecast error just
  // means no weather section (and no windAdvice/weatherAlert) rather than
  // breaking the whole proposal — this flow's weather is additive context,
  // unlike cyclingOutfitRecommendation where it's the entire point (see
  // that flow's own fail-hard behavior).
  let windIsSignificant = false;
  let weatherIsSevere = false;
  let predictedWeather: DailyWorkoutRecommendationOutput['predictedWeather'] = null;
  if (parsedInput.ride) {
    const forecast = await fetchWeatherForecast(parsedInput.ride.location, parsedInput.ride.departureDateTime);
    if (!forecast.error) {
      windIsSignificant = forecast.windSpeedKmh >= WIND_ADVICE_THRESHOLD_KMH;
      weatherIsSevere = isSevereWeather(forecast);
      const windDirectionCompass = degreesToCompass(forecast.windDirectionDeg);
      predictedWeather = {
        temperatureCelsius: forecast.temperatureCelsius,
        windSpeedKmh: forecast.windSpeedKmh,
        windDirectionCompass,
        conditions: forecast.conditions,
      };
      sections.push([
        `MÉTÉO PRÉVUE POUR LA SORTIE (${parsedInput.ride.location}, départ ${parsedInput.ride.departureDateTime}) :`,
        `Température : ${forecast.temperatureCelsius}°C`,
        `Vent : ${forecast.windSpeedKmh} km/h, venant du ${windDirectionCompass}`,
        `Conditions : ${forecast.conditions}`,
        weatherIsSevere ? `ALERTE : ces conditions sont jugées trop dégradées pour rouler dehors (seuil vent ${SEVERE_WIND_THRESHOLD_KMH}+ km/h et/ou pluie/neige forte/orage).` : '',
      ].filter(Boolean).join('\n'));
    }
  }

  const coachContextBlock = parsedInput.coachContext ? `${parsedInput.coachContext}\n\n` : '';

  const system = `${coachContextBlock}Tu es un coach cycliste expert. À partir du contexte fourni (forme actuelle, charge d'entraînement,
blessures, objectifs, style de vie, séances récentes), propose UNE séance concrète et réalisable aujourd'hui,
qui tienne dans le temps disponible.

Règles impératives :
- La durée totale proposée (durationMinutes) ne doit JAMAIS dépasser le temps disponible.
- Si le gouverneur de charge interne est dégradé (🔴) ou si le TSB est très négatif, propose une séance
  d'intensité réduite (endurance ou récupération active) plutôt qu'une séance à haute intensité, et dis-le
  explicitement dans rationale.
- S'il y a une blessure active, adapte ou évite ce qui pourrait l'aggraver, et mentionne l'adaptation dans warnings.
- S'il y a un objectif proche avec une priorité haute, oriente le contenu de la séance vers sa spécificité
  (ex: un objectif "grimpeur" appelle du travail en côte ou en seuil, pas uniquement de l'endurance plate).
- Si un plan d'entraînement en cours est fourni, la séance du jour DOIT correspondre à la phase et au focus
  de la semaine en cours (ex: en phase "base", privilégie l'endurance même si le temps disponible permettrait
  une séance plus intense ; en phase "taper", réduis délibérément l'intensité et le volume). Le plan prime
  sur une proposition générique.
- Si la récupération de la nuit dernière est mauvaise (sommeil court ou de faible qualité, HRV en baisse
  nette, readiness basse), RÉDUIS l'intensité prévue même si la charge d'entraînement et le plan suggéreraient
  autre chose, propose éventuellement une alternative (récupération active, endurance légère plutôt que
  seuil/VO2max), et dis-le explicitement dans rationale — la récupération prime sur la programmation quand
  les deux sont en tension.
- N'invente pas de données manquantes — travaille avec ce qui est fourni.
${weatherIsSevere ? `- ALERTE MÉTÉO : la météo prévue pour la sortie est jugée trop dégradée pour rouler dehors (vent
  ${SEVERE_WIND_THRESHOLD_KMH}+ km/h et/ou pluie/neige forte/orage — voir la météo fournie ci-dessus). Propose à la
  place une séance ADAPTÉE EN HOME TRAINER : sportType doit être "VirtualRide", et le contenu (durée, intensité,
  structuredWorkout) doit rester cohérent avec la forme du jour comme n'importe quelle autre proposition — ce
  n'est pas une simple annulation, c'est une vraie séance indoor équivalente. Remplis weatherAlert avec 1-2
  phrases citant les chiffres réels et expliquant que la séance a été adaptée pour cette raison, et mentionne
  aussi ce changement dans warnings. Mets windAdvice à null (pas de sens pour une séance indoor).` : windIsSignificant ? `- Une météo de sortie avec du vent significatif (${WIND_ADVICE_THRESHOLD_KMH}+ km/h) est fournie ci-dessus : remplis
  windAdvice avec 1-2 phrases indiquant la direction générale à prendre AU DÉPART pour avoir le vent de face
  à l'aller et dans le dos au retour (ex. "Partez vers le Nord-Ouest à l'aller, vous aurez le vent dans le
  dos sur le retour"). C'est un conseil de direction générale, pas un itinéraire précis — tu ne connais pas
  les routes locales. Mets weatherAlert à null : la météo n'est pas dégradée.` : '- Mets windAdvice et weatherAlert à null : soit aucune météo de sortie n\'a été fournie, soit le vent prévu est trop faible pour justifier un conseil d\'itinéraire et la météo n\'est pas dégradée.'}

${STRUCTURED_WORKOUT_SYNTAX}

Réponds en français, avec UNIQUEMENT un objet JSON (pas de balises markdown, pas d'autre texte) de cette forme :
{
  "title": "nom court de la séance",
  "sportType": "type Intervals.icu, ex. Ride",
  "durationMinutes": nombre,
  "intensityLabel": "un ou deux mots",
  "rationale": "2 à 4 phrases justifiant ce choix à partir du contexte réel fourni",
  "structuredWorkout": "script structuré en sections + étapes, voir le format ci-dessus",
  "warnings": ["0 à 3 points d'attention courts, tableau vide si rien à signaler"],
  "windAdvice": "conseil de direction pour avoir le vent dans le dos au retour, ou null",
  "predictedWeather": ${predictedWeather ? JSON.stringify(predictedWeather) : 'null'},
  "weatherAlert": "1-2 phrases si la météo a forcé un passage en home trainer, sinon null"
}`;

  return generateJson(DailyWorkoutRecommendationOutputSchema, {
    system,
    messages: [{ role: 'user', content: sections.join('\n\n') }],
  });
  } catch (e) {
    console.error('[dailyWorkoutRecommendation] failed:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue.' };
  }
}
