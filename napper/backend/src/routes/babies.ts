import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../db';

const router = Router();

const CreateBabySchema = z.object({
  name: z.string().min(1).max(100),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

// GET /babies
router.get('/', async (_req: Request, res: Response) => {
  const babies = await db('babies').orderBy('created_at', 'desc');
  res.json(babies);
});

// GET /babies/:id
router.get('/:id', async (req: Request, res: Response) => {
  const baby = await db('babies').where({ id: req.params.id }).first();
  if (!baby) return res.status(404).json({ error: 'Baby not found' });
  res.json(baby);
});

// POST /babies
router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateBabySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const [baby] = await db('babies').insert(parsed.data).returning('*');
  res.status(201).json(baby);
});

// PUT /babies/:id
router.put('/:id', async (req: Request, res: Response) => {
  const parsed = CreateBabySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const [baby] = await db('babies')
    .where({ id: req.params.id })
    .update({ ...parsed.data, updated_at: db.fn.now() })
    .returning('*');
  if (!baby) return res.status(404).json({ error: 'Baby not found' });
  res.json(baby);
});

// DELETE /babies/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await db('babies').where({ id: req.params.id }).delete();
  if (!deleted) return res.status(404).json({ error: 'Baby not found' });
  res.status(204).send();
});

export default router;
