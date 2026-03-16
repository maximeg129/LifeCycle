
/**
 * Service pour interagir avec l'API Intervals.icu
 * Documentation: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
 */

export interface IntervalsAthlete {
  id: string;
  name: string;
  icu_ctl: number;
  icu_atl: number;
  icu_tsb: number;
}

export interface IntervalsWellness {
  weight?: number;
  restingHR?: number;
  hrv?: number;
  sleepSecs?: number;
  readiness?: number;
}

export class IntervalsService {
  private baseUrl = 'https://intervals.icu/api/v1/athlete';
  private authHeader: string;

  constructor(private athleteId: string, private apiKey: string) {
    // Authentification basique : 'API_KEY' comme utilisateur, la clé comme mot de passe
    // Ou selon le cookbook, simplement utiliser Basic Auth avec n'importe quel user et la clé
    this.authHeader = 'Basic ' + btoa(`API_KEY:${apiKey}`);
  }

  private async fetchIntervals(endpoint: string) {
    const response = await fetch(`${this.baseUrl}/${this.athleteId}${endpoint}`, {
      headers: {
        'Authorization': this.authHeader,
      }
    });

    if (!response.ok) {
      throw new Error(`Intervals.icu API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getAthleteStats(): Promise<IntervalsAthlete> {
    return this.fetchIntervals('');
  }

  async getWellness(date: string): Promise<IntervalsWellness> {
    // date format: YYYY-MM-DD
    return this.fetchIntervals(`/wellness/${date}`);
  }

  async getRecentActivities(oldest?: string) {
    const query = oldest ? `?oldest=${oldest}` : '';
    return this.fetchIntervals(`/activities${query}`);
  }
}
