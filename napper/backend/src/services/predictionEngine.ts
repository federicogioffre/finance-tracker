/**
 * Napper Prediction Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Replicates sleep/feeding prediction logic using:
 *   - Exponential Weighted Moving Average (EWMA)
 *   - Day/Night cluster separation (day = 06:00–20:00, night = 20:00–06:00)
 *   - Dynamic confidence scoring based on variance
 *   - Age-aware wake window adjustment
 *   - Outlier filtering (Grubbs' test approximation via z-score)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Baby,
  SleepSession,
  FeedingSession,
  FeedType,
  ClusterType,
  WakeWindowStats,
  FeedingIntervalStats,
  SleepPrediction,
  FeedingPrediction,
  DailyInsights,
  PredictionResponse,
} from '../models/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Exponential smoothing factor α. Higher = more weight on recent data. */
const EWMA_ALPHA = 0.35;

/** Hour boundary separating day and night clusters (24h). */
const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 20;

/** Minimum sessions required to make a prediction. */
const MIN_SESSIONS_FOR_PREDICTION = 3;

/** Max look-back window for predictions (sessions, not days). */
const LOOKBACK_SESSIONS = 14;

/** Z-score threshold for outlier removal. */
const OUTLIER_Z_THRESHOLD = 2.5;

/**
 * Age-based wake window reference table (minutes).
 * Derived from established pediatric sleep research.
 * Key = max weeks of age, Value = [min, max, typical] wake window in minutes.
 */
const AGE_WAKE_WINDOWS: Array<{ maxWeeks: number; minMin: number; maxMin: number; typicalMin: number }> = [
  { maxWeeks: 6,   minMin: 45,  maxMin: 60,  typicalMin: 50  },
  { maxWeeks: 12,  minMin: 60,  maxMin: 90,  typicalMin: 75  },
  { maxWeeks: 20,  minMin: 75,  maxMin: 120, typicalMin: 100 },
  { maxWeeks: 32,  minMin: 90,  maxMin: 150, typicalMin: 120 },
  { maxWeeks: 52,  minMin: 120, maxMin: 180, typicalMin: 150 },
  { maxWeeks: 78,  minMin: 150, maxMin: 240, typicalMin: 195 },
  { maxWeeks: 104, minMin: 180, maxMin: 300, typicalMin: 240 },
  { maxWeeks: Infinity, minMin: 240, maxMin: 360, typicalMin: 300 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageInWeeks(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function getHour(isoTimestamp: string): number {
  return new Date(isoTimestamp).getHours();
}

function clusterOf(isoTimestamp: string): ClusterType {
  const h = getHour(isoTimestamp);
  return h >= DAY_START_HOUR && h < NIGHT_START_HOUR ? 'day' : 'night';
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg?: number): number {
  if (values.length < 2) return 0;
  const m = avg ?? mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Remove outliers using z-score filtering.
 * Returns values within OUTLIER_Z_THRESHOLD standard deviations.
 */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const m = mean(values);
  const sd = stdDev(values, m);
  if (sd === 0) return values;
  return values.filter((v) => Math.abs((v - m) / sd) <= OUTLIER_Z_THRESHOLD);
}

/**
 * Exponential Weighted Moving Average.
 * weights[i] = α * (1-α)^(n-1-i), most recent item has highest weight.
 * Returns weighted mean.
 */
function ewma(values: number[], alpha = EWMA_ALPHA): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const n = values.length;
  let weightSum = 0;
  let weightedSum = 0;

  for (let i = 0; i < n; i++) {
    const weight = alpha * Math.pow(1 - alpha, n - 1 - i);
    weightedSum += values[i] * weight;
    weightSum += weight;
  }

  // Normalise (handles edge case where α is large)
  return weightedSum / weightSum;
}

/**
 * Confidence score: higher variance → lower confidence.
 * Maps coefficient of variation (CV) to [0, 1].
 */
function confidenceFromVariance(values: number[], weightedMean: number): number {
  if (values.length < MIN_SESSIONS_FOR_PREDICTION) {
    return 0.3; // Not enough data
  }
  const sd = stdDev(values);
  if (weightedMean === 0) return 0.5;
  const cv = sd / weightedMean; // coefficient of variation
  // CV of 0 → confidence 1.0, CV of 1.0 → confidence ~0.2
  const confidence = Math.max(0.1, Math.min(1.0, 1 / (1 + 2 * cv)));
  // Bonus for more samples
  const sampleBonus = Math.min(0.1, (values.length / LOOKBACK_SESSIONS) * 0.1);
  return Math.min(1.0, confidence + sampleBonus);
}

/**
 * Get the age-appropriate expected wake window range for a baby.
 */
function ageAppropriateWakeWindow(weeks: number): { minMin: number; maxMin: number; typicalMin: number } {
  return AGE_WAKE_WINDOWS.find((e) => weeks <= e.maxWeeks) ?? AGE_WAKE_WINDOWS[AGE_WAKE_WINDOWS.length - 1];
}

// ─── Core Calculations ────────────────────────────────────────────────────────

/**
 * Calculate wake windows from a sorted list of completed sleep sessions.
 * Wake window = time from end of one sleep to start of next sleep.
 */
function calculateWakeWindows(sessions: SleepSession[]): number[] {
  const completed = sessions.filter((s) => s.end_time !== null);
  const windows: number[] = [];

  for (let i = 0; i < completed.length - 1; i++) {
    const wakeStart = completed[i].end_time!;
    const nextSleepStart = completed[i + 1].start_time;
    const windowMinutes = minutesBetween(wakeStart, nextSleepStart);

    // Sanity check: wake windows should be between 15 min and 8 hours
    if (windowMinutes >= 15 && windowMinutes <= 480) {
      windows.push(windowMinutes);
    }
  }

  return windows;
}

/**
 * Build wake window statistics for a given cluster (day or night),
 * with outlier removal and EWMA.
 */
export function buildWakeWindowStats(
  sessions: SleepSession[],
  cluster: ClusterType
): WakeWindowStats {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const clusterSessions = sorted.filter((s) => clusterOf(s.start_time) === cluster);
  const recent = clusterSessions.slice(-LOOKBACK_SESSIONS);

  const rawWindows = calculateWakeWindows(recent);
  const filtered = removeOutliers(rawWindows);

  if (filtered.length === 0) {
    return { mean: 0, stdDev: 0, weightedMean: 0, sampleSize: 0 };
  }

  const avg = mean(filtered);
  return {
    mean: avg,
    stdDev: stdDev(filtered, avg),
    weightedMean: ewma(filtered),
    sampleSize: filtered.length,
  };
}

/**
 * Build feeding interval statistics per feed type.
 */
export function buildFeedingIntervalStats(
  sessions: FeedingSession[],
  feedType: FeedType
): FeedingIntervalStats {
  const filtered = sessions
    .filter((s) => s.feed_type === feedType)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(-LOOKBACK_SESSIONS);

  if (filtered.length < 2) {
    return { mean: 0, stdDev: 0, weightedMean: 0, sampleSize: filtered.length, feedType };
  }

  const intervals: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const interval = minutesBetween(filtered[i - 1].start_time, filtered[i].start_time);
    // Sanity: feeding intervals between 30 min and 6 hours
    if (interval >= 30 && interval <= 360) {
      intervals.push(interval);
    }
  }

  const cleaned = removeOutliers(intervals);
  if (cleaned.length === 0) {
    return { mean: 0, stdDev: 0, weightedMean: 0, sampleSize: 0, feedType };
  }

  const avg = mean(cleaned);
  return {
    mean: avg,
    stdDev: stdDev(cleaned, avg),
    weightedMean: ewma(cleaned),
    sampleSize: cleaned.length,
    feedType,
  };
}

// ─── Prediction Functions ─────────────────────────────────────────────────────

/**
 * Predict next sleep time for a baby.
 *
 * Algorithm:
 * 1. Determine current cluster (day/night) from now
 * 2. Get EWMA wake window for that cluster
 * 3. Blend with age-appropriate reference (30% age, 70% observed)
 * 4. Add wake window to last wake time
 * 5. Compute confidence from variance + sample size
 */
export function predictNextSleep(
  baby: Baby,
  sessions: SleepSession[]
): SleepPrediction | null {
  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const lastSession = sorted[sorted.length - 1];
  const isCurrentlyAsleep = lastSession.end_time === null;

  // If currently sleeping, we can't predict "next sleep" yet (predict next wake instead)
  // Return null to indicate sleep is in progress
  if (isCurrentlyAsleep) return null;

  const lastWakeTime = lastSession.end_time!;
  const now = new Date();
  const cluster: ClusterType = clusterOf(now.toISOString());

  const stats = buildWakeWindowStats(sorted, cluster);
  const weeks = ageInWeeks(baby.birth_date);
  const ageRef = ageAppropriateWakeWindow(weeks);

  let predictedWakeWindow: number;
  if (stats.sampleSize >= MIN_SESSIONS_FOR_PREDICTION) {
    // Blend observed data (70%) with age reference (30%)
    predictedWakeWindow = 0.7 * stats.weightedMean + 0.3 * ageRef.typicalMin;
  } else {
    // Fall back to age reference if not enough data
    predictedWakeWindow = ageRef.typicalMin;
  }

  const wakeWindowValues =
    stats.sampleSize > 0
      ? Array(stats.sampleSize).fill(stats.weightedMean) // Approximate for confidence
      : [];

  const predictedSleepMs =
    new Date(lastWakeTime).getTime() + predictedWakeWindow * 60000;
  const predictedSleepTime = new Date(predictedSleepMs).toISOString();

  // Estimate sleep duration from historical data
  const completedSessions = sorted.filter((s) => s.duration_minutes !== null);
  const clusterSessions = completedSessions.filter((s) => clusterOf(s.start_time) === cluster);
  const recentDurations = clusterSessions.slice(-LOOKBACK_SESSIONS).map((s) => s.duration_minutes!);
  const predictedDuration = recentDurations.length > 0 ? ewma(recentDurations) : null;

  const predictedWakeTime =
    predictedDuration !== null
      ? new Date(predictedSleepMs + predictedDuration * 60000).toISOString()
      : null;

  const confidence = confidenceFromVariance(wakeWindowValues, predictedWakeWindow);

  return {
    babyId: baby.id,
    predictedSleepTime,
    predictedWakeTime,
    wakeWindowMinutes: Math.round(predictedWakeWindow),
    confidence,
    cluster,
    basedOnSessions: stats.sampleSize,
  };
}

/**
 * Predict next feeding times for all feed types used by this baby.
 *
 * Algorithm:
 * 1. Group feedings by type
 * 2. For each type, compute EWMA of intervals
 * 3. Add interval to last feeding time
 * 4. Compute confidence
 */
export function predictNextFeedings(
  baby: Baby,
  sessions: FeedingSession[]
): FeedingPrediction[] {
  if (sessions.length === 0) return [];

  const feedTypes = [...new Set(sessions.map((s) => s.feed_type))] as FeedType[];
  const predictions: FeedingPrediction[] = [];

  for (const feedType of feedTypes) {
    const typeSessions = sessions
      .filter((s) => s.feed_type === feedType)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    if (typeSessions.length === 0) continue;

    const stats = buildFeedingIntervalStats(sessions, feedType);
    const lastFeed = typeSessions[typeSessions.length - 1];

    if (stats.sampleSize < 1 || stats.weightedMean === 0) continue;

    const nextFeedMs =
      new Date(lastFeed.start_time).getTime() + stats.weightedMean * 60000;
    const predictedNextFeedTime = new Date(nextFeedMs).toISOString();

    const intervals: number[] = [];
    for (let i = 1; i < typeSessions.length; i++) {
      const interval = minutesBetween(typeSessions[i - 1].start_time, typeSessions[i].start_time);
      if (interval >= 30 && interval <= 360) intervals.push(interval);
    }

    const confidence = confidenceFromVariance(intervals, stats.weightedMean);

    predictions.push({
      babyId: baby.id,
      predictedNextFeedTime,
      averageIntervalMinutes: Math.round(stats.weightedMean),
      feedType,
      confidence,
      basedOnSessions: stats.sampleSize,
    });
  }

  return predictions;
}

/**
 * Compute daily insights for a baby given all sessions for a specific date.
 */
export function computeDailyInsights(
  date: string,
  sleepSessions: SleepSession[],
  feedingSessions: FeedingSession[]
): DailyInsights {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const todaySleep = sleepSessions.filter((s) => {
    const t = new Date(s.start_time).getTime();
    return t >= dayStart.getTime() && t <= dayEnd.getTime();
  });

  const completedSleep = todaySleep.filter((s) => s.duration_minutes !== null);

  const naps = completedSleep.filter((s) => s.sleep_type === 'nap');
  const nightSleep = completedSleep.filter((s) => s.sleep_type === 'night');

  const totalSleepMinutes = completedSleep.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const nightSleepMinutes = nightSleep.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
  const longestNapMinutes = naps.length > 0 ? Math.max(...naps.map((s) => s.duration_minutes ?? 0)) : 0;

  // Calculate average wake window for the day
  const wakeWindows = calculateWakeWindows(
    [...todaySleep].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  );
  const averageWakeWindowMinutes = wakeWindows.length > 0 ? mean(wakeWindows) : 0;

  const todayFeedings = feedingSessions.filter((s) => {
    const t = new Date(s.start_time).getTime();
    return t >= dayStart.getTime() && t <= dayEnd.getTime();
  });

  return {
    date,
    totalSleepMinutes: Math.round(totalSleepMinutes),
    napCount: naps.length,
    longestNapMinutes: Math.round(longestNapMinutes),
    averageWakeWindowMinutes: Math.round(averageWakeWindowMinutes),
    feedCount: todayFeedings.length,
    nightSleepMinutes: Math.round(nightSleepMinutes),
  };
}

/**
 * Full prediction response combining sleep, feeding, and insights.
 */
export function buildPredictions(
  baby: Baby,
  sleepSessions: SleepSession[],
  feedingSessions: FeedingSession[]
): PredictionResponse {
  const today = new Date().toISOString().split('T')[0];

  return {
    sleep: predictNextSleep(baby, sleepSessions),
    feeding: predictNextFeedings(baby, feedingSessions),
    insights: computeDailyInsights(today, sleepSessions, feedingSessions),
    ageWeeks: ageInWeeks(baby.birth_date),
  };
}
