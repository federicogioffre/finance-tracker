import { Router, Request, Response } from 'express';
import db from '../db';
import {
  buildPredictions,
  buildWakeWindowStats,
  buildFeedingIntervalStats,
  computeDailyInsights,
} from '../services/predictionEngine';
import { FeedType } from '../models/types';

const router = Router({ mergeParams: true });

// GET /babies/:babyId/predictions — full prediction bundle
router.get('/', async (req: Request, res: Response) => {
  const { babyId } = req.params;

  const baby = await db('babies').where({ id: babyId }).first();
  if (!baby) return res.status(404).json({ error: 'Baby not found' });

  // Fetch recent sessions (last 30 days for context)
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [sleepSessions, feedingSessions] = await Promise.all([
    db('sleep_sessions')
      .where({ baby_id: babyId })
      .where('start_time', '>=', since.toISOString())
      .orderBy('start_time', 'asc'),
    db('feeding_sessions')
      .where({ baby_id: babyId })
      .where('start_time', '>=', since.toISOString())
      .orderBy('start_time', 'asc'),
  ]);

  const predictions = buildPredictions(baby, sleepSessions, feedingSessions);
  res.json(predictions);
});

// GET /babies/:babyId/predictions/wake-windows — wake window stats by cluster
router.get('/wake-windows', async (req: Request, res: Response) => {
  const { babyId } = req.params;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const sleepSessions = await db('sleep_sessions')
    .where({ baby_id: babyId })
    .where('start_time', '>=', since.toISOString())
    .orderBy('start_time', 'asc');

  res.json({
    day: buildWakeWindowStats(sleepSessions, 'day'),
    night: buildWakeWindowStats(sleepSessions, 'night'),
  });
});

// GET /babies/:babyId/predictions/feeding-intervals — feeding interval stats
router.get('/feeding-intervals', async (req: Request, res: Response) => {
  const { babyId } = req.params;

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const feedingSessions = await db('feeding_sessions')
    .where({ baby_id: babyId })
    .where('start_time', '>=', since.toISOString())
    .orderBy('start_time', 'asc');

  const feedTypes: FeedType[] = ['breast', 'bottle', 'solid'];
  const stats = Object.fromEntries(
    feedTypes.map((ft) => [ft, buildFeedingIntervalStats(feedingSessions, ft)])
  );

  res.json(stats);
});

// GET /babies/:babyId/predictions/insights?date=YYYY-MM-DD
router.get('/insights', async (req: Request, res: Response) => {
  const { babyId } = req.params;
  const date = (req.query.date as string) ?? new Date().toISOString().split('T')[0];

  const [sleepSessions, feedingSessions] = await Promise.all([
    db('sleep_sessions').where({ baby_id: babyId }).orderBy('start_time', 'asc'),
    db('feeding_sessions').where({ baby_id: babyId }).orderBy('start_time', 'asc'),
  ]);

  res.json(computeDailyInsights(date, sleepSessions, feedingSessions));
});

export default router;
