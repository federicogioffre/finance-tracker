import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db';

const router = Router({ mergeParams: true });

const FeedingSchema = z.object({
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional().nullable(),
  feed_type: z.enum(['breast', 'bottle', 'solid']),
  quantity: z.number().positive().optional().nullable(),
  quantity_unit: z.enum(['ml', 'min', 'g']).optional().nullable(),
  breast_side: z.enum(['left', 'right', 'both']).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /babies/:babyId/feeding
router.get('/', async (req: Request, res: Response) => {
  const { babyId } = req.params;
  const { limit = '50', offset = '0', date, feed_type } = req.query as Record<string, string>;

  let query = db('feeding_sessions')
    .where({ baby_id: babyId })
    .orderBy('start_time', 'desc')
    .limit(Number(limit))
    .offset(Number(offset));

  if (date) {
    query = query.whereBetween('start_time', [`${date} 00:00:00`, `${date} 23:59:59`]);
  }
  if (feed_type) {
    query = query.where({ feed_type });
  }

  const sessions = await query;
  res.json(sessions);
});

// GET /babies/:babyId/feeding/active
router.get('/active', async (req: Request, res: Response) => {
  const session = await db('feeding_sessions')
    .where({ baby_id: req.params.babyId, end_time: null })
    .orderBy('start_time', 'desc')
    .first();
  res.json(session ?? null);
});

// GET /babies/:babyId/feeding/:id
router.get('/:id', async (req: Request, res: Response) => {
  const session = await db('feeding_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// POST /babies/:babyId/feeding
router.post('/', async (req: Request, res: Response) => {
  const parsed = FeedingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const baby = await db('babies').where({ id: req.params.babyId }).first();
  if (!baby) return res.status(404).json({ error: 'Baby not found' });

  const [session] = await db('feeding_sessions')
    .insert({
      baby_id: req.params.babyId,
      start_time: parsed.data.start_time ?? new Date().toISOString(),
      end_time: parsed.data.end_time ?? null,
      feed_type: parsed.data.feed_type,
      quantity: parsed.data.quantity ?? null,
      quantity_unit: parsed.data.quantity_unit ?? null,
      breast_side: parsed.data.breast_side ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning('*');

  res.status(201).json(session);
});

// PATCH /babies/:babyId/feeding/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = FeedingSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const [updated] = await db('feeding_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .update({ ...parsed.data, updated_at: db.fn.now() })
    .returning('*');

  if (!updated) return res.status(404).json({ error: 'Session not found' });
  res.json(updated);
});

// DELETE /babies/:babyId/feeding/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await db('feeding_sessions')
    .where({ id: req.params.id, baby_id: req.params.babyId })
    .delete();
  if (!deleted) return res.status(404).json({ error: 'Session not found' });
  res.status(204).send();
});

export default router;
