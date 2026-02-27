import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db';

const router = Router({ mergeParams: true });

const StartSleepSchema = z.object({
  start_time: z.string().datetime().optional(),
  sleep_type: z.enum(['nap', 'night']).default('nap'),
  notes: z.string().optional(),
});

const EndSleepSchema = z.object({
  end_time: z.string().datetime().optional(),
});

// GET /babies/:babyId/sleep  — list sessions
router.get('/', async (req: Request, res: Response) => {
  const { babyId } = req.params;
  const { limit = '50', offset = '0', date } = req.query as Record<string, string>;

  let query = db('sleep_sessions')
    .where({ baby_id: babyId })
    .orderBy('start_time', 'desc')
    .limit(Number(limit))
    .offset(Number(offset));

  if (date) {
    query = query.whereBetween('start_time', [
      `${date} 00:00:00`,
      `${date} 23:59:59`,
    ]);
  }

  const sessions = await query;
  res.json(sessions);
});

// GET /babies/:babyId/sleep/active — current active session
router.get('/active', async (req: Request, res: Response) => {
  const session = await db('sleep_sessions')
    .where({ baby_id: req.params.babyId, end_time: null })
    .orderBy('start_time', 'desc')
    .first();
  res.json(session ?? null);
});

// GET /babies/:babyId/sleep/:id
router.get('/:id', async (req: Request, res: Response) => {
  const session = await db('sleep_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// POST /babies/:babyId/sleep — start a new sleep
router.post('/', async (req: Request, res: Response) => {
  const parsed = StartSleepSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const baby = await db('babies').where({ id: req.params.babyId }).first();
  if (!baby) return res.status(404).json({ error: 'Baby not found' });

  // Close any open session before starting a new one
  const open = await db('sleep_sessions')
    .where({ baby_id: req.params.babyId, end_time: null })
    .first();
  if (open) {
    return res.status(409).json({
      error: 'An active sleep session already exists. End it before starting a new one.',
      activeSessionId: open.id,
    });
  }

  const [session] = await db('sleep_sessions')
    .insert({
      baby_id: req.params.babyId,
      start_time: parsed.data.start_time ?? new Date().toISOString(),
      sleep_type: parsed.data.sleep_type,
      notes: parsed.data.notes ?? null,
    })
    .returning('*');

  res.status(201).json(session);
});

// PATCH /babies/:babyId/sleep/:id/end — end a sleep session
router.patch('/:id/end', async (req: Request, res: Response) => {
  const parsed = EndSleepSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const session = await db('sleep_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .first();

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.end_time) return res.status(409).json({ error: 'Session already ended' });

  const endTime = parsed.data.end_time ?? new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(endTime).getTime() - new Date(session.start_time).getTime()) / 60000
  );

  const [updated] = await db('sleep_sessions')
    .where({ id: req.params.id })
    .update({
      end_time: endTime,
      duration_minutes: durationMinutes,
      updated_at: db.fn.now(),
    })
    .returning('*');

  res.json(updated);
});

// DELETE /babies/:babyId/sleep/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await db('sleep_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .delete();
  if (!deleted) return res.status(404).json({ error: 'Session not found' });
  res.status(204).send();
});

export default router;
