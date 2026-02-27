import { create } from 'zustand';
import {
  Baby,
  SleepSession,
  FeedingSession,
  PredictionResponse,
} from '../types';
import { babiesApi, sleepApi, feedingApi, predictionsApi } from '../api/client';

interface AppState {
  // ─── Data ─────────────────────────────────────────────────────────────────
  babies: Baby[];
  activeBaby: Baby | null;
  sleepSessions: SleepSession[];
  feedingSessions: FeedingSession[];
  activeSleepSession: SleepSession | null;
  activeFeedingSession: FeedingSession | null;
  predictions: PredictionResponse | null;

  // ─── UI state ─────────────────────────────────────────────────────────────
  loading: boolean;
  error: string | null;

  // ─── Actions ──────────────────────────────────────────────────────────────
  loadBabies: () => Promise<void>;
  setActiveBaby: (baby: Baby) => void;
  createBaby: (name: string, birthDate: string) => Promise<Baby>;

  loadSleepSessions: (date?: string) => Promise<void>;
  loadActiveSleep: () => Promise<void>;
  startSleep: (sleepType?: string) => Promise<void>;
  endSleep: () => Promise<void>;

  loadFeedingSessions: (date?: string) => Promise<void>;
  loadActiveFeeding: () => Promise<void>;
  logFeeding: (data: {
    feed_type: string;
    quantity?: number;
    quantity_unit?: string;
    breast_side?: string;
    notes?: string;
  }) => Promise<void>;
  endFeeding: (quantity?: number, quantityUnit?: string) => Promise<void>;

  loadPredictions: () => Promise<void>;

  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  babies: [],
  activeBaby: null,
  sleepSessions: [],
  feedingSessions: [],
  activeSleepSession: null,
  activeFeedingSession: null,
  predictions: null,
  loading: false,
  error: null,

  // ─── Babies ──────────────────────────────────────────────────────────────

  loadBabies: async () => {
    set({ loading: true, error: null });
    try {
      const babies = await babiesApi.list();
      set({ babies, activeBaby: babies[0] ?? null, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setActiveBaby: (baby) => set({ activeBaby: baby }),

  createBaby: async (name, birthDate) => {
    const baby = await babiesApi.create({ name, birth_date: birthDate });
    set((s) => ({ babies: [baby, ...s.babies], activeBaby: baby }));
    return baby;
  },

  // ─── Sleep ────────────────────────────────────────────────────────────────

  loadSleepSessions: async (date) => {
    const { activeBaby } = get();
    if (!activeBaby) return;
    set({ loading: true });
    try {
      const sessions = await sleepApi.list(activeBaby.id, { date, limit: 50 });
      set({ sleepSessions: sessions, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadActiveSleep: async () => {
    const { activeBaby } = get();
    if (!activeBaby) return;
    try {
      const active = await sleepApi.getActive(activeBaby.id);
      set({ activeSleepSession: active });
    } catch {
      set({ activeSleepSession: null });
    }
  },

  startSleep: async (sleepType = 'nap') => {
    const { activeBaby } = get();
    if (!activeBaby) throw new Error('No active baby');
    const session = await sleepApi.start(activeBaby.id, { sleep_type: sleepType });
    set({ activeSleepSession: session });
    await get().loadPredictions();
  },

  endSleep: async () => {
    const { activeBaby, activeSleepSession } = get();
    if (!activeBaby || !activeSleepSession) throw new Error('No active sleep session');
    const ended = await sleepApi.end(activeBaby.id, activeSleepSession.id);
    set((s) => ({
      activeSleepSession: null,
      sleepSessions: [ended, ...s.sleepSessions.filter((x) => x.id !== ended.id)],
    }));
    await get().loadPredictions();
  },

  // ─── Feeding ──────────────────────────────────────────────────────────────

  loadFeedingSessions: async (date) => {
    const { activeBaby } = get();
    if (!activeBaby) return;
    set({ loading: true });
    try {
      const sessions = await feedingApi.list(activeBaby.id, { date, limit: 50 });
      set({ feedingSessions: sessions, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadActiveFeeding: async () => {
    const { activeBaby } = get();
    if (!activeBaby) return;
    try {
      const active = await feedingApi.getActive(activeBaby.id);
      set({ activeFeedingSession: active });
    } catch {
      set({ activeFeedingSession: null });
    }
  },

  logFeeding: async (data) => {
    const { activeBaby } = get();
    if (!activeBaby) throw new Error('No active baby');
    const session = await feedingApi.create(activeBaby.id, data);
    set((s) => ({
      feedingSessions: [session, ...s.feedingSessions],
      activeFeedingSession: session.end_time ? null : session,
    }));
    await get().loadPredictions();
  },

  endFeeding: async (quantity, quantityUnit) => {
    const { activeBaby, activeFeedingSession } = get();
    if (!activeBaby || !activeFeedingSession) throw new Error('No active feeding session');
    const updated = await feedingApi.update(activeBaby.id, activeFeedingSession.id, {
      end_time: new Date().toISOString(),
      quantity: quantity ?? undefined,
      quantity_unit: quantityUnit as any,
    });
    set((s) => ({
      activeFeedingSession: null,
      feedingSessions: [updated, ...s.feedingSessions.filter((x) => x.id !== updated.id)],
    }));
    await get().loadPredictions();
  },

  // ─── Predictions ──────────────────────────────────────────────────────────

  loadPredictions: async () => {
    const { activeBaby } = get();
    if (!activeBaby) return;
    try {
      const predictions = await predictionsApi.get(activeBaby.id);
      set({ predictions });
    } catch {
      // Silently fail — predictions are non-critical
    }
  },

  clearError: () => set({ error: null }),
}));
