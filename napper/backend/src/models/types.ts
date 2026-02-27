// ─── Domain Types ────────────────────────────────────────────────────────────

export type SleepType = 'nap' | 'night';
export type FeedType = 'breast' | 'bottle' | 'solid';
export type QuantityUnit = 'ml' | 'min' | 'g';
export type BreastSide = 'left' | 'right' | 'both';

export interface Baby {
  id: string;
  name: string;
  birth_date: string; // ISO date
  created_at: string;
  updated_at: string;
}

export interface SleepSession {
  id: string;
  baby_id: string;
  start_time: string; // ISO timestamp
  end_time: string | null;
  duration_minutes: number | null;
  sleep_type: SleepType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedingSession {
  id: string;
  baby_id: string;
  start_time: string;
  end_time: string | null;
  feed_type: FeedType;
  quantity: number | null;
  quantity_unit: QuantityUnit | null;
  breast_side: BreastSide | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Prediction Types ─────────────────────────────────────────────────────────

export type ClusterType = 'day' | 'night';

export interface WakeWindowStats {
  mean: number;         // minutes
  stdDev: number;       // minutes
  weightedMean: number; // exponentially weighted mean
  sampleSize: number;
}

export interface FeedingIntervalStats {
  mean: number;
  stdDev: number;
  weightedMean: number;
  sampleSize: number;
  feedType: FeedType;
}

export interface SleepPrediction {
  babyId: string;
  predictedSleepTime: string;       // ISO timestamp
  predictedWakeTime: string | null; // ISO timestamp
  wakeWindowMinutes: number;
  confidence: number;               // 0–1
  cluster: ClusterType;
  basedOnSessions: number;
}

export interface FeedingPrediction {
  babyId: string;
  predictedNextFeedTime: string;
  averageIntervalMinutes: number;
  feedType: FeedType;
  confidence: number;
  basedOnSessions: number;
}

export interface DailyInsights {
  date: string;
  totalSleepMinutes: number;
  napCount: number;
  longestNapMinutes: number;
  averageWakeWindowMinutes: number;
  feedCount: number;
  nightSleepMinutes: number;
}

export interface PredictionResponse {
  sleep: SleepPrediction | null;
  feeding: FeedingPrediction[];
  insights: DailyInsights | null;
  ageWeeks: number;
}
