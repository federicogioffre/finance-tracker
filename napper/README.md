# Napper — Baby Sleep & Feeding Tracker

A React Native mobile app with a Node.js backend that predicts baby sleep and feeding times using adaptive statistical algorithms.

---

## Architecture

```
napper/
├── backend/          Node.js + TypeScript REST API
│   └── src/
│       ├── db/       Knex.js migrations (PostgreSQL)
│       ├── models/   TypeScript domain types
│       ├── routes/   Express route handlers
│       └── services/
│           └── predictionEngine.ts   ← core algorithm
├── mobile/           React Native app (TypeScript)
│   └── src/
│       ├── api/      Axios client
│       ├── components/
│       ├── screens/
│       ├── navigation/
│       ├── store/    Zustand state management
│       └── theme/    Design tokens
└── docker-compose.yml
```

---

## Prediction Engine

`backend/src/services/predictionEngine.ts`

### 1. Data Collection & Filtering

For each prediction, the engine looks back up to **14 sessions** (configurable via `LOOKBACK_SESSIONS`). Outliers are removed using **z-score filtering** (threshold: 2.5σ):

```ts
function removeOutliers(values: number[]): number[] {
  const m = mean(values);
  const sd = stdDev(values, m);
  return values.filter(v => Math.abs((v - m) / sd) <= OUTLIER_Z_THRESHOLD);
}
```

### 2. Exponential Weighted Moving Average (EWMA)

Recent sessions are weighted more heavily using exponential decay (α = 0.35):

```
weight_i = α × (1 − α)^(n−1−i)
```

The most recent observation carries ~3× the weight of one 5 sessions back. This allows predictions to adapt quickly to changes in baby's schedule (growth spurts, development leaps).

### 3. Day / Night Cluster Separation

Sessions are split into two independent clusters before computing statistics:
- **Day**: 06:00 – 20:00 → nap predictions
- **Night**: 20:00 – 06:00 → night sleep predictions

This prevents night sleep patterns from polluting nap predictions and vice versa.

### 4. Wake Window Prediction

Wake window = time from end of one sleep → start of next sleep.

```
predictedWakeWindow = 0.7 × EWMA(observed) + 0.3 × age_reference
```

The 30% age-reference blend acts as a **prior** — it prevents wild predictions when data is sparse and grounds predictions in established pediatric sleep research:

| Age        | Typical wake window |
|------------|---------------------|
| 0–6 weeks  | 45–60 min           |
| 6–12 weeks | 60–90 min           |
| 3–5 months | 75–120 min          |
| 5–8 months | 90–150 min          |
| 8–12 months| 120–180 min         |
| 1–1.5 years| 150–240 min         |
| 1.5–2 years| 180–300 min         |

### 5. Confidence Scoring

Uses the **coefficient of variation** (stdDev / mean) — lower variance = higher confidence:

```
confidence = 1 / (1 + 2 × CV)  +  sample_bonus
```

Bounded to [0.1, 1.0]. A sample bonus of up to 0.1 is added as more sessions accumulate. Displayed as a progress bar in the UI.

### 6. Feeding Interval Prediction

For each feed type (breast/bottle/solid) used by the baby:
1. Extract intervals between consecutive feedings of that type
2. Apply outlier removal (min 30 min, max 6 hours sanity check)
3. Apply EWMA
4. Predict: `lastFeedTime + EWMA_interval`

### 7. Daily Insights

Computes per-day aggregates:
- Total sleep minutes, nap count, longest nap, night sleep
- Average wake window across all naps
- Feed count

---

## API Reference

```
GET    /api/babies
POST   /api/babies
GET    /api/babies/:id
PUT    /api/babies/:id
DELETE /api/babies/:id

GET    /api/babies/:id/sleep?date=YYYY-MM-DD
POST   /api/babies/:id/sleep                  ← start sleep
GET    /api/babies/:id/sleep/active
PATCH  /api/babies/:id/sleep/:sid/end         ← end sleep
DELETE /api/babies/:id/sleep/:sid

GET    /api/babies/:id/feeding?date=YYYY-MM-DD
POST   /api/babies/:id/feeding
GET    /api/babies/:id/feeding/active
PATCH  /api/babies/:id/feeding/:fid
DELETE /api/babies/:id/feeding/:fid

GET    /api/babies/:id/predictions
GET    /api/babies/:id/predictions/wake-windows
GET    /api/babies/:id/predictions/feeding-intervals
GET    /api/babies/:id/predictions/insights?date=YYYY-MM-DD
```

---

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

### Mobile

```bash
cd mobile
npm install
npm start            # Metro bundler
npm run android      # Android
npm run ios          # iOS
```

Update `BASE_URL` in `src/api/client.ts` to point to your backend.

### Docker (full stack)

```bash
docker compose up
```

PostgreSQL on port 5432, backend API on port 3000.

---

## Database Schema

```sql
babies (id, name, birth_date, created_at, updated_at)

sleep_sessions (
  id, baby_id, start_time, end_time,
  duration_minutes, sleep_type,   -- 'nap' | 'night'
  notes, created_at, updated_at
)

feeding_sessions (
  id, baby_id, start_time, end_time,
  feed_type,        -- 'breast' | 'bottle' | 'solid'
  quantity,         -- ml | min | g
  quantity_unit,
  breast_side,      -- 'left' | 'right' | 'both'
  notes, created_at, updated_at
)
```
