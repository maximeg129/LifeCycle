
/**
 * Service pour interagir avec l'API Intervals.icu
 * Documentation: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
 */

// ── Types ────────────────────────────────────────────────────────────

/** Gear/bike entry from the Intervals.icu athlete profile */
export interface IntervalsGear {
  id: string;
  name?: string;
  brand_name?: string;
  model_name?: string;
  distance?: number; // total meters
  primary?: boolean;
  retired?: boolean;
}

/** Raw athlete profile from GET /api/v1/athlete/{id} */
interface IntervalsAthleteRaw {
  id: string;
  firstname?: string;
  lastname?: string;
  name?: string;
  weight?: number;
  icu_weight?: number;
  icu_resting_hr?: number;
  bikes?: IntervalsGear[];
  sportSettings?: Array<{
    types?: string[];
    ftp?: number;
    lthr?: number;
    max_hr?: number;
  }>;
}

/** Wellness data point from GET /api/v1/athlete/{id}/wellness */
interface IntervalsWellnessEntry {
  id: string; // date string e.g. "2026-03-24"
  ctl?: number;
  atl?: number;
  ctlLoad?: number;
  atlLoad?: number;
  rampRate?: number;
}

/** Merged athlete + fitness data exposed to the UI */
export interface IntervalsAthlete {
  id: string;
  name?: string;
  ftp?: number;
  weight?: number;
  ctl?: number;
  atl?: number;
  tsb?: number;
  rampRate?: number;
  trainingLoad?: number;
  bikes?: IntervalsGear[];
}

export interface IntervalsActivity {
  id: string;
  name?: string;
  type?: string;
  source?: string;
  start_date_local?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  // Confirmed via a live debug dump: the API has no top-level `gear_id`
  // field at all (requesting it via `fields=` is silently ignored) — the
  // bike/shoe ridden is nested under `gear.id` instead. Getting this
  // wrong made every gear-km computation see 0 activities for any gear,
  // regardless of date range.
  gear?: { id?: string; name?: string | null; distance?: number | null; primary?: boolean | null } | null;
  // Intervals.icu computes power fields itself (icu_-prefixed) — more
  // reliably populated than the Strava-mirrored average_watts/
  // weighted_average_watts, which the API doesn't always carry through.
  // Keep both and prefer the icu_ ones (see bestAverageWatts() below).
  icu_average_watts?: number | null;
  icu_weighted_avg_watts?: number | null;
  average_watts?: number | null;
  weighted_average_watts?: number | null;
  icu_intensity?: number | null;
  icu_training_load?: number | null;
  icu_ftp?: number | null;
  icu_weight?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  calories?: number | null;
  icu_ctl?: number | null;
  icu_atl?: number | null;
  icu_tsb?: number | null;
  // Per-session RPE/feel, entered directly on Intervals.icu's activity page
  // (its own "RPE" and "Feel" inputs — separately toggleable there via
  // showRPE/showFeel, confirmed against the platform's OpenAPI schema) —
  // the app's local sessionFeedback quick-entry is now a fallback for
  // activities not (yet) rated there, not the primary source. icu_rpe is
  // Intervals.icu's own field; perceived_exertion mirrors Strava's when an
  // activity syncs in from there without ever being edited on Intervals.icu.
  icu_rpe?: number | null;
  perceived_exertion?: number | null;
  feel?: number | null;
}

export interface IntervalsWellness {
  id: string;
  weight?: number;
  restingHR?: number;
  hrv?: number;
  hrvSDNN?: number;
  sleepSecs?: number;
  sleepScore?: number;
  sleepQuality?: number;
  readiness?: number;
  fatigue?: number;
  mood?: number;
  motivation?: number;
  injury?: number;
  spO2?: number;
  systolic?: number;
  diastolic?: number;
  ctl?: number;
  atl?: number;
  ctlLoad?: number;
  atlLoad?: number;
  rampRate?: number;
  ctl2?: number;
  atl2?: number;
}

/**
 * One best-power-for-duration curve (mean-max power), computed by
 * Intervals.icu from the athlete's real ride files — not a manually
 * entered personal record. `secs`/`values` are parallel arrays: the best
 * average power (W) the athlete has ever held for that many seconds, over
 * whatever period the curve covers (see getPowerCurve()).
 */
export interface IntervalsPowerCurve {
  id: string;
  secs: number[];
  values: number[];
}

export interface IntervalsFitnessDay {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  trainingLoad: number;
}

export interface IntervalsActivityStream {
  watts?: { data: number[] };
  heartrate?: { data: number[] };
  cadence?: { data: number[] };
  altitude?: { data: number[] };
  distance?: { data: number[] };
  time?: { data: number[] };
  latlng?: { data: [number, number][] };
}

export interface IntervalsPowerZone {
  id: number;
  name: string;
  min: number;
  max: number;
  color: string;
}

/**
 * A planned-workout event to push to the athlete's Intervals.icu calendar.
 * `externalId` drives upsertOnUid=true — sending the same id again (e.g. the
 * user edits and re-sends today's proposal) updates the existing calendar
 * entry instead of creating a duplicate, mirroring how `getActivitiesRaw`
 * already treats the API's own gotchas as things to design around rather
 * than trust blindly.
 */
export interface PlannedWorkoutEvent {
  externalId: string;
  name: string;
  /** Intervals.icu's own type vocabulary — "Ride", "VirtualRide", "Run"... */
  sportType: string;
  /** yyyy-MM-dd — Intervals.icu schedules the event on this local date. */
  startDateLocal: string;
  /**
   * Structured workout text in Intervals.icu's workout-builder syntax —
   * section header lines (plain text, optionally suffixed "Nx" for a
   * repeat), each followed by one or more "- <duration> <target>" step
   * lines, e.g.:
   *   Warmup
   *   - 15m ramp 55-65%
   *
   *   Main Set 4x
   *   - 5m 95-105%
   *   - 3m 50%
   * This is what Intervals.icu itself parses into structured steps when
   * the event is saved — an inline "4x (5m 95% / 3m 50%)" one-liner looks
   * plausible but is NOT recognized and silently produces a workout with
   * no steps (confirmed against community reports of the same failure —
   * see daily-workout-recommendation-flow.ts's system prompt for the
   * generation rules).
   */
  description: string;
  durationSeconds?: number;
}

export interface PlannedWorkoutResult {
  id: string;
}

/** Explicit field list for GET /activities — see IntervalsActivity for why. */
const ACTIVITY_FIELDS = [
  'id', 'name', 'type', 'source', 'start_date_local', 'moving_time', 'elapsed_time',
  'distance', 'gear', 'icu_average_watts', 'icu_weighted_avg_watts',
  'average_watts', 'weighted_average_watts', 'icu_intensity', 'icu_training_load',
  'icu_ftp', 'icu_weight', 'average_heartrate', 'max_heartrate',
  'total_elevation_gain', 'average_speed', 'max_speed', 'calories',
  'icu_ctl', 'icu_atl', 'icu_tsb', 'icu_rpe', 'perceived_exertion', 'feel',
].join(',');

// ── Pure helpers ─────────────────────────────────────────────────────

export interface PowerFieldsLike {
  icu_average_watts?: number | null;
  icu_weighted_avg_watts?: number | null;
  average_watts?: number | null;
  weighted_average_watts?: number | null;
}

/** Best available average-power reading, preferring Intervals.icu's own computation over the Strava-mirrored fields. Null if none present or non-positive. */
export function bestAverageWatts(activity: PowerFieldsLike): number | null {
  const watts = activity.icu_weighted_avg_watts ?? activity.weighted_average_watts ?? activity.icu_average_watts ?? activity.average_watts;
  return watts != null && watts > 0 ? watts : null;
}

export interface RpeFieldsLike {
  icu_rpe?: number | null;
  perceived_exertion?: number | null;
}

/** Best available session RPE (1-10, entered on the activity's Intervals.icu page), preferring the icu_ field over the Strava-mirrored one — same preference order as bestAverageWatts. Null if neither is present. */
export function bestRpe(activity: RpeFieldsLike): number | null {
  const rpe = activity.icu_rpe ?? activity.perceived_exertion;
  return rpe != null ? rpe : null;
}

export interface FeelFieldLike {
  feel?: number | null;
}

/**
 * Converts Intervals.icu's 1-5 "Feel" rating (1 = terrible, 5 = great — same
 * ascending-is-better convention as every comparable training app) onto the
 * -1..1 scale this app's own bien/neutre/mauvais feeling score already uses
 * (see FEELING_SCORE in session-feedback-types.ts), so the two sources can
 * be trended together. Null if the activity has no feel rating.
 */
export function feelToScore(activity: FeelFieldLike): number | null {
  if (activity.feel == null) return null;
  return (activity.feel - 3) / 2;
}

// ── Service ──────────────────────────────────────────────────────────

export class IntervalsService {
  private baseUrl = 'https://intervals.icu/api/v1/athlete';
  private authHeader: string;

  constructor(private athleteId: string, private apiKey: string) {
    this.authHeader = 'Basic ' + btoa(`API_KEY:${apiKey}`);
  }

  private async fetchIntervals<T = unknown>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${this.athleteId}${endpoint}`, {
      headers: {
        'Authorization': this.authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Intervals.icu API Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Same auth/error handling as fetchIntervals(), but for the handful of
   * endpoints that are NOT nested under /athlete/{athleteId}/... — a single
   * activity's detail and streams are addressed by their own (globally
   * unique) activity id, not scoped to an athlete. Routing them through
   * fetchIntervals() (as getActivity()/getActivityStreams() originally did)
   * produced a URL Intervals.icu's API has never served, silently 404ing —
   * this went unnoticed because both methods were unused anywhere in the
   * app until the ride-analysis feature became their first real caller.
   */
  private async fetchIntervalsAbsolute<T = unknown>(path: string): Promise<T> {
    const response = await fetch(`https://intervals.icu/api/v1${path}`, {
      headers: {
        'Authorization': this.authHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Intervals.icu API Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /** Profil athlète avec CTL/ATL/TSB/FTP actuels (fusionne /athlete et /wellness) */
  async getAthlete(): Promise<IntervalsAthlete> {
    const today = new Date().toISOString().slice(0, 10);
    const [profile, wellness] = await Promise.all([
      this.fetchIntervals<IntervalsAthleteRaw>(''),
      this.fetchIntervals<IntervalsWellnessEntry>(`/wellness/${today}`)
        .catch(() => null),
    ]);

    // Extract cycling FTP from sportSettings (find the entry whose types include "Ride")
    const cyclingSport = profile.sportSettings?.find(s => s.types?.some(t => /ride/i.test(t)));
    const ftp = cyclingSport?.ftp ?? profile.sportSettings?.[0]?.ftp;

    // Prefer icu_weight (Intervals-tracked) over weight (Strava-synced, often null)
    const weight = profile.icu_weight ?? profile.weight;

    return {
      id: profile.id,
      name: profile.name || [profile.firstname, profile.lastname].filter(Boolean).join(' ') || undefined,
      ftp,
      weight,
      ctl: wellness?.ctl,
      atl: wellness?.atl,
      tsb: wellness?.ctl != null && wellness?.atl != null ? wellness.ctl - wellness.atl : undefined,
      rampRate: wellness?.rampRate,
      trainingLoad: wellness?.ctlLoad,
      bikes: profile.bikes,
    };
  }

  /**
   * Activités entre deux dates (YYYY-MM-DD).
   * The list endpoint returns a lean default field set that silently
   * excludes power data unless requested explicitly via `fields` — without
   * it, average_watts/icu_average_watts/etc. come back undefined even on
   * activities that do have a power meter.
   */
  async getActivities(oldest: string, newest?: string): Promise<IntervalsActivity[]> {
    const params = new URLSearchParams({ oldest, fields: ACTIVITY_FIELDS });
    if (newest) params.set('newest', newest);
    return this.fetchIntervals<IntervalsActivity[]>(`/activities?${params}`);
  }

  /**
   * Same as getActivities, but WITHOUT the `fields=` sparse-fieldset param.
   * The `gear_id` mixup earlier proved this API silently drops any field
   * name it doesn't recognize from a `fields=` list rather than erroring —
   * so a nested field like `gear` may not survive that sparse-fieldset path
   * even under its correct name (unverified, and expensive to re-verify
   * live). This method sidesteps the guesswork entirely for the one caller
   * that actually needs `gear.id`: it requests the full, unfiltered
   * response shape, which is the exact shape a live debug dump already
   * confirmed does carry `gear: { id, ... }` correctly. Costs a heavier
   * payload — acceptable since it's only called once per explicit sync
   * click, not on every page load.
   */
  async getActivitiesRaw(oldest: string, newest?: string): Promise<IntervalsActivity[]> {
    const params = new URLSearchParams({ oldest });
    if (newest) params.set('newest', newest);
    return this.fetchIntervals<IntervalsActivity[]>(`/activities?${params}`);
  }



  /** Données wellness entre deux dates */
  async getWellnessRange(oldest: string, newest: string): Promise<IntervalsWellness[]> {
    const params = new URLSearchParams({ oldest, newest });
    return this.fetchIntervals<IntervalsWellness[]>(`/wellness?${params}`);
  }

  /** Données wellness pour un jour donné */
  async getWellness(date: string): Promise<IntervalsWellness> {
    return this.fetchIntervals<IntervalsWellness>(`/wellness/${date}`);
  }

  /** Courbe de fitness (CTL/ATL/TSB) entre deux dates via /wellness endpoint */
  async getFitnessChart(oldest: string, newest: string): Promise<IntervalsFitnessDay[]> {
    const params = new URLSearchParams({ oldest, newest });
    const entries = await this.fetchIntervals<IntervalsWellnessEntry[]>(`/wellness?${params}`);
    return entries
      .filter(e => e.id && (e.ctl != null || e.atl != null))
      .map(e => ({
        date: e.id,
        ctl: e.ctl ?? 0,
        atl: e.atl ?? 0,
        tsb: (e.ctl ?? 0) - (e.atl ?? 0),
        trainingLoad: e.ctlLoad ?? 0,
      }));
  }

  /**
   * Best-power-for-duration curve (mean-max power), computed by
   * Intervals.icu from the athlete's real ride history — the auto-sync
   * source for the Riegel power records, so the athlete doesn't have to
   * re-type personal bests the platform already knows (see
   * pickPowerRecordsFromCurve() in riegel-types.ts). `curves` follows
   * Intervals.icu's own shorthand ("all", "1y", "42d"...) — defaults to
   * "all" so a new athlete's whole ride history counts toward it, not just
   * the last year.
   */
  async getPowerCurve(curves = 'all'): Promise<IntervalsPowerCurve[]> {
    const params = new URLSearchParams({ type: 'Ride', curves });
    const data = await this.fetchIntervals<{ list?: IntervalsPowerCurve[] }>(`/power-curves.json?${params}`);
    return data.list ?? [];
  }

  /** Détail d'une activité — endpoint top-level (l'id d'activité est unique globalement, pas besoin de le scoper par athlète, contrairement à la liste). */
  async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.fetchIntervalsAbsolute<IntervalsActivity>(`/activity/${activityId}`);
  }

  /** Streams d'une activité (puissance, FC, altitude…) — même remarque que getActivity() sur le chemin top-level. */
  async getActivityStreams(activityId: string, types: string[] = ['watts', 'heartrate', 'cadence', 'altitude']): Promise<IntervalsActivityStream> {
    const params = new URLSearchParams();
    types.forEach(t => params.append('types', t));
    return this.fetchIntervalsAbsolute<IntervalsActivityStream>(`/activity/${activityId}/streams?${params}`);
  }

  /** Zones de puissance */
  async getPowerZones(): Promise<IntervalsPowerZone[]> {
    return this.fetchIntervals<IntervalsPowerZone[]>(`/power-zones`);
  }

  private async postIntervals<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${this.athleteId}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Intervals.icu API Error ${response.status}: ${response.statusText}${text ? ` — ${text.slice(0, 300)}` : ''}`);
    }

    return response.json();
  }

  /**
   * Pushes (or upserts, via `externalId`) a single planned workout onto the
   * athlete's calendar — see PlannedWorkoutEvent for why the upsert id
   * matters. `upsertOnUid=true` makes Intervals.icu update the existing
   * calendar entry instead of creating a duplicate when the same
   * externalId is sent again (e.g. the user edits and re-sends today's
   * proposal).
   */
  async createPlannedWorkout(event: PlannedWorkoutEvent): Promise<PlannedWorkoutResult> {
    const body = {
      category: 'WORKOUT',
      external_id: event.externalId,
      name: event.name,
      type: event.sportType,
      start_date_local: `${event.startDateLocal}T00:00:00`,
      description: event.description,
      ...(event.durationSeconds != null ? { moving_time: event.durationSeconds } : {}),
    };
    return this.postIntervals<PlannedWorkoutResult>('/events?upsertOnUid=true', body);
  }
}
