import axios from 'axios';
import {
  Baby,
  SleepSession,
  FeedingSession,
  PredictionResponse,
} from '../types';

// Update this to your local backend URL when running on device
const BASE_URL = __DEV__ ? 'http://10.0.2.2:3000/api' : 'https://your-production-api.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Babies ───────────────────────────────────────────────────────────────────

export const babiesApi = {
  list: (): Promise<Baby[]> =>
    api.get('/babies').then((r) => r.data),

  get: (id: string): Promise<Baby> =>
    api.get(`/babies/${id}`).then((r) => r.data),

  create: (data: { name: string; birth_date: string }): Promise<Baby> =>
    api.post('/babies', data).then((r) => r.data),

  update: (id: string, data: Partial<{ name: string; birth_date: string }>): Promise<Baby> =>
    api.put(`/babies/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/babies/${id}`).then(() => undefined),
};

// ─── Sleep ────────────────────────────────────────────────────────────────────

export const sleepApi = {
  list: (babyId: string, params?: { limit?: number; offset?: number; date?: string }): Promise<SleepSession[]> =>
    api.get(`/babies/${babyId}/sleep`, { params }).then((r) => r.data),

  getActive: (babyId: string): Promise<SleepSession | null> =>
    api.get(`/babies/${babyId}/sleep/active`).then((r) => r.data),

  start: (babyId: string, data?: { start_time?: string; sleep_type?: string; notes?: string }): Promise<SleepSession> =>
    api.post(`/babies/${babyId}/sleep`, data ?? {}).then((r) => r.data),

  end: (babyId: string, sessionId: string, data?: { end_time?: string }): Promise<SleepSession> =>
    api.patch(`/babies/${babyId}/sleep/${sessionId}/end`, data ?? {}).then((r) => r.data),

  delete: (babyId: string, sessionId: string): Promise<void> =>
    api.delete(`/babies/${babyId}/sleep/${sessionId}`).then(() => undefined),
};

// ─── Feeding ──────────────────────────────────────────────────────────────────

export const feedingApi = {
  list: (babyId: string, params?: { limit?: number; offset?: number; date?: string; feed_type?: string }): Promise<FeedingSession[]> =>
    api.get(`/babies/${babyId}/feeding`, { params }).then((r) => r.data),

  getActive: (babyId: string): Promise<FeedingSession | null> =>
    api.get(`/babies/${babyId}/feeding/active`).then((r) => r.data),

  create: (babyId: string, data: Partial<FeedingSession> & { feed_type: string }): Promise<FeedingSession> =>
    api.post(`/babies/${babyId}/feeding`, data).then((r) => r.data),

  update: (babyId: string, sessionId: string, data: Partial<FeedingSession>): Promise<FeedingSession> =>
    api.patch(`/babies/${babyId}/feeding/${sessionId}`, data).then((r) => r.data),

  delete: (babyId: string, sessionId: string): Promise<void> =>
    api.delete(`/babies/${babyId}/feeding/${sessionId}`).then(() => undefined),
};

// ─── Predictions ──────────────────────────────────────────────────────────────

export const predictionsApi = {
  get: (babyId: string): Promise<PredictionResponse> =>
    api.get(`/babies/${babyId}/predictions`).then((r) => r.data),
};

export default api;
