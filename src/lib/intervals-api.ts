
/**
 * Service pour interagir avec l'API Intervals.icu
 * Documentation: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
 */

// ── Types ────────────────────────────────────────────────────────────

/** Raw athlete profile from GET /api/v1/athlete/{id} */
interface IntervalsAthleteRaw {
  id: string;
  firstname?: string;
  lastname?: string;
  name?: string;
  weight?: number;
  icu_weight?: number;
  icu_resting_hr?: number;
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
}

export interface IntervalsActivity {
  id: string;
  name?: string;
  type?: string;
  start_date_local?: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
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
    };
  }

  /** Activités entre deux dates (YYYY-MM-DD) — enrichit avec les détails individuels si nécessaire */
  async getActivities(oldest: string, newest?: string): Promise<IntervalsActivity[]> {
    const params = new URLSearchParams({ oldest });
    if (newest) params.set('newest', newest);
    const list = await this.fetchIntervals<IntervalsActivity[]>(`/activities?${params}`);

    // Strava-synced activities return minimal data from the list endpoint.
    // Fetch individual details in parallel to get Intervals-computed fields (TSS, power, etc.)
    const needsEnrichment = list.some(a => a.moving_time == null && a.icu_training_load == null);
    if (!needsEnrichment) return list;

    const enriched = await Promise.all(
      list.map(a =>
        this.fetchIntervals<IntervalsActivity>(`/activities/${a.id}`)
          .catch(() => a) // fallback to list data if individual fetch fails
      ),
    );
    return enriched;
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

  /** Détail d'une activité */
  async getActivity(activityId: string): Promise<IntervalsActivity> {
    return this.fetchIntervals<IntervalsActivity>(`/activities/${activityId}`);
  }

  /** Streams d'une activité (puissance, FC, altitude…) */
  async getActivityStreams(activityId: string, types: string[] = ['watts', 'heartrate', 'cadence', 'altitude']): Promise<IntervalsActivityStream> {
    const params = new URLSearchParams();
    types.forEach(t => params.append('types', t));
    return this.fetchIntervals<IntervalsActivityStream>(`/activities/${activityId}/streams?${params}`);
  }

  /** Zones de puissance */
  async getPowerZones(): Promise<IntervalsPowerZone[]> {
    return this.fetchIntervals<IntervalsPowerZone[]>(`/power-zones`);
  }
}
