// ─── Shared domain types (mirrors backend) ────────────────────────────────────

export type SleepType = 'nap' | 'night';
export type FeedType = 'breast' | 'bottle' | 'solid';
export type QuantityUnit = 'ml' | 'min' | 'g';
export type BreastSide = 'left' | 'right' | 'both';
export type ClusterType = 'day' | 'night';

export interface Baby {
  id: string;
  name: string;
  birth_date: string;
  created_at: string;
  updated_at: string;
}

export interface SleepSession {
  id: string;
  baby_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  sleep_type: SleepType;
  notes: string | null;
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
}

export interface SleepPrediction {
  babyId: string;
  predictedSleepTime: string;
  predictedWakeTime: string | null;
  wakeWindowMinutes: number;
  confidence: number;
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

// ─── Navigation types ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Main: undefined;
  AddBaby: undefined;
  SleepDetail: { sessionId: string };
  FeedingDetail: { sessionId: string };
};

export type TabParamList = {
  Home: undefined;
  Sleep: undefined;
  Feeding: undefined;
  History: undefined;
};
