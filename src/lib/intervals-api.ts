
/**
 * Service pour interagir avec l'API Intervals.icu
 * Documentation: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
 */

// ── Types ────────────────────────────────────────────────────────────

export interface IntervalsAthlete {
  id: string;
  name?: string;
  icu_ftp?: number;
  icu_ctl?: number;
  icu_atl?: number;
  icu_tsb?: number;
  icu_weight?: number;
  icu_ramp_rate?: number;
  icu_training_load?: number;
}

export interface IntervalsActivity {
  id: string;
  name?: string;
  type?: string;
  start_date_local: string;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  icu_average_watts: number | null;
  icu_weighted_avg_watts: number | null;
  icu_intensity: number | null;
  icu_training_load: number | null;
  icu_ftp: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  calories: number | null;
  icu_eftp: number | null;
  gap: number | null;
  icu_power_hr_z2: string | null;
  icu_power_hr_z3: string | null;
  icu_power_hr_z4: string | null;
  icu_power_hr_z5: string | null;
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

  /** Profil athlète avec CTL/ATL/TSB/FTP actuels */
  async getAthlete(): Promise<IntervalsAthlete> {
    return this.fetchIntervals<IntervalsAthlete>('');
  }

  /** Activités entre deux dates (YYYY-MM-DD) */
  async getActivities(oldest: string, newest?: string): Promise<IntervalsActivity[]> {
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

  /** Courbe de fitness (CTL/ATL/TSB) entre deux dates — dérivée du endpoint wellness */
  async getFitnessChart(oldest: string, newest: string): Promise<IntervalsFitnessDay[]> {
    const wellness = await this.getWellnessRange(oldest, newest);
    return wellness.map(w => ({
      date: w.id,
      ctl: w.ctl ?? 0,
      atl: w.atl ?? 0,
      tsb: (w.ctl ?? 0) - (w.atl ?? 0),
      trainingLoad: w.atlLoad ?? 0,
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
