import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import babiesRouter from './routes/babies';
import sleepRouter from './routes/sleep';
import feedingRouter from './routes/feeding';
import predictionsRouter from './routes/predictions';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/babies', babiesRouter);
app.use('/api/babies/:babyId/sleep', sleepRouter);
app.use('/api/babies/:babyId/feeding', feedingRouter);
app.use('/api/babies/:babyId/predictions', predictionsRouter);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Napper API running on http://localhost:${PORT}`);
});

export default app;
