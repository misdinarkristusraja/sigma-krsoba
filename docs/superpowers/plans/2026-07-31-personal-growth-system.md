# Personal Growth & Quality Analytics System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public points system with a private, personalized growth and quality analysis model including radar charts, service tiers, lencana (badges), and confidential mentor evaluations.

**Architecture:** Create a new PostgreSQL migration (`00000000000035_personal_growth_schema.sql`) for database schema updates, build a deterministic growth metrics calculation module (`src/lib/growth.ts`), update QR scanning components (`ScanPage.tsx`, `ScanLatihanPage.tsx`) to link `event_id`/`latihan_id`, replace points UI with `MyGrowthPage.tsx`, and enhance `AnalisisPage.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Recharts (RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer), Lucide React icons, Supabase RPC/Tables, Vitest.

## Global Constraints

- Preserve TypeScript compilation with 0 errors (`npm run lint`).
- Ensure all Vitest unit tests pass (`npm run test`).
- Keep private data secure via Supabase RLS (only self and staff can view personal evaluations/badges).

---

### Task 1: Database Migration Schema (`00000000000035_personal_growth_schema.sql`)

**Files:**
- Create: `supabase/migrations/00000000000035_personal_growth_schema.sql`

**Interfaces:**
- Consumes: Existing `users`, `events`, `scan_records` tables.
- Produces: `scan_records.event_id`, `scan_records.latihan_id`, `user_badges` table, `user_evaluations` table, RLS policies.

- [ ] **Step 1: Write SQL Migration File**

Create `supabase/migrations/00000000000035_personal_growth_schema.sql`:
```sql
-- Migration 035: Personal Growth & Quality Analytics Schema
-- 1. Upgrade scan_records to include direct event_id / latihan_id links
ALTER TABLE scan_records 
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latihan_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_records_event ON scan_records(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_records_latihan ON scan_records(latihan_id);

-- 2. Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key   VARCHAR(50) NOT NULL,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name   VARCHAR(50),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_badges_select ON user_badges FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

CREATE POLICY user_badges_insert ON user_badges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

-- 3. Create user_evaluations table
CREATE TABLE IF NOT EXISTS user_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evaluator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  periode         VARCHAR(20) NOT NULL,
  skor_sikap      INTEGER CHECK (skor_sikap BETWEEN 1 AND 5),
  skor_kerapian   INTEGER CHECK (skor_kerapian BETWEEN 1 AND 5),
  catatan_pribadi TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_evaluations_user ON user_evaluations(user_id);
ALTER TABLE user_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_evaluations_select ON user_evaluations FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));

CREATE POLICY user_evaluations_insert ON user_evaluations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')
  ));
```

- [ ] **Step 2: Commit Migration File**

```bash
git add supabase/migrations/00000000000035_personal_growth_schema.sql
git commit -m "feat(db): add migration 035 for personal growth schema"
```

---

### Task 2: Growth Metrics Engine & Unit Tests (`src/lib/growth.ts` & `src/lib/__tests__/growth.test.ts`)

**Files:**
- Create: `src/lib/growth.ts`
- Create: `src/lib/__tests__/growth.test.ts`

**Interfaces:**
- Consumes: Assignment counts, scan counts, role counts, evaluations.
- Produces: `getServiceTier()`, `calculateRadarMetrics()`, TypeScript types.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/__tests__/growth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getServiceTier, calculateRadarMetrics } from '../growth';

describe('Growth Metrics & Tier Engine', () => {
  it('assigns correct Service Tier based on assignment count', () => {
    expect(getServiceTier(5)).toEqual({ name: 'Misdinar Mula', level: 1, icon: 'Shield' });
    expect(getServiceTier(20)).toEqual({ name: 'Misdinar Pratama', level: 2, icon: 'Award' });
    expect(getServiceTier(50)).toEqual({ name: 'Misdinar Utama', level: 3, icon: 'Star' });
    expect(getServiceTier(90)).toEqual({ name: 'Misdinar Senior', level: 4, icon: 'Crown' });
  });

  it('calculates 5-dimension radar metrics accurately', () => {
    const metrics = calculateRadarMetrics({
      totalAssignments: 10,
      scannedAssignments: 9,
      totalTrainings: 5,
      scannedTrainings: 4,
      uniqueEventTypes: 3,
      claimedSwapsCount: 2,
      attitudeScoreAvg: 4.5
    });

    expect(metrics).toEqual([
      { subject: 'Kedisiplinan Misa', score: 90, fullMark: 100 },
      { subject: 'Komitmen Latihan', score: 80, fullMark: 100 },
      { subject: 'Variasi Peran', score: 60, fullMark: 100 },
      { subject: 'Solidaritas Swap', score: 80, fullMark: 100 },
      { subject: 'Sikap & Kerapian', score: 90, fullMark: 100 }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL with "Cannot find module '../growth'"

- [ ] **Step 3: Implement `src/lib/growth.ts`**

Create `src/lib/growth.ts`:
```typescript
export interface ServiceTier {
  name: string;
  level: number;
  icon: string;
}

export interface RadarMetric {
  subject: string;
  score: number;
  fullMark: number;
}

export function getServiceTier(completedCount: number): ServiceTier {
  if (completedCount >= 80) return { name: 'Misdinar Senior', level: 4, icon: 'Crown' };
  if (completedCount >= 41) return { name: 'Misdinar Utama', level: 3, icon: 'Star' };
  if (completedCount >= 16) return { name: 'Misdinar Pratama', level: 2, icon: 'Award' };
  return { name: 'Misdinar Mula', level: 1, icon: 'Shield' };
}

export function calculateRadarMetrics(input: {
  totalAssignments: number;
  scannedAssignments: number;
  totalTrainings: number;
  scannedTrainings: number;
  uniqueEventTypes: number;
  claimedSwapsCount: number;
  attitudeScoreAvg: number; // 1 to 5
}): RadarMetric[] {
  const discipline = input.totalAssignments > 0
    ? Math.round((input.scannedAssignments / input.totalAssignments) * 100)
    : 100;

  const training = input.totalTrainings > 0
    ? Math.round((input.scannedTrainings / input.totalTrainings) * 100)
    : 100;

  // Max 5 event types = 100%
  const diversity = Math.min(100, Math.round((input.uniqueEventTypes / 5) * 100));

  // Max 2 claimed swaps = 100% (50% per claimed swap to encourage helping peers)
  const solidarity = Math.min(100, Math.round((input.claimedSwapsCount / 2.5) * 100));

  // 1-5 scale mapped to 0-100%
  const attitude = Math.round((input.attitudeScoreAvg / 5) * 100);

  return [
    { subject: 'Kedisiplinan Misa', score: discipline, fullMark: 100 },
    { subject: 'Komitmen Latihan', score: training, fullMark: 100 },
    { subject: 'Variasi Peran', score: diversity, fullMark: 100 },
    { subject: 'Solidaritas Swap', score: solidarity, fullMark: 100 },
    { subject: 'Sikap & Kerapian', score: attitude, fullMark: 100 }
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (All 9 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/lib/growth.ts src/lib/__tests__/growth.test.ts
git commit -m "feat(growth): add service tier & radar metrics engine with unit tests"
```

---

### Task 3: Update QR Scanning Components (`ScanPage.tsx` & `ScanLatihanPage.tsx`)

**Files:**
- Modify: `src/pages/ScanPage.tsx`
- Modify: `src/pages/ScanLatihanPage.tsx`

**Interfaces:**
- Consumes: Selected `selectedEventId` in scanner state.
- Produces: `scan_records` row with `event_id` or `latihan_id`.

- [ ] **Step 1: Modify `ScanPage.tsx`**

Pass `event_id: selectedEventId` into `supabase.from('scan_records').insert(...)`.

- [ ] **Step 2: Modify `ScanLatihanPage.tsx`**

Pass `latihan_id: selectedEventId` into `supabase.from('scan_records').insert(...)`.

- [ ] **Step 3: Run `npm run lint` to verify build**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/ScanPage.tsx src/pages/ScanLatihanPage.tsx
git commit -m "feat(scan): link event_id and latihan_id directly in scan_records"
```

---

### Task 4: Create `MyGrowthPage.tsx` & Route Navigation Updates

**Files:**
- Create: `src/pages/MyGrowthPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `calculateRadarMetrics()`, `getServiceTier()`, Supabase queries for `user_badges` & `user_evaluations`.
- Produces: My Growth UI replacing public points view.

- [ ] **Step 1: Create `src/pages/MyGrowthPage.tsx`**

Build the UI displaying Service Tier Card, Recharts RadarChart, Badges Grid, and Mentor Evaluation Notes.

- [ ] **Step 2: Update App Routes & Layout Navigation**

In `src/App.tsx`: Replace `/poin` route with `MyGrowthPage` component.
In `src/components/layout/Layout.tsx`: Change navigation label from `"Poin & Rekap"` to `"Perkembangan Saya"`.

- [ ] **Step 3: Run `npm run lint` and `npm run test`**

Run: `npm run lint` and `npm run test`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MyGrowthPage.tsx src/App.tsx src/components/layout/Layout.tsx
git commit -m "feat(ui): add MyGrowthPage replacing public points leaderboard"
```

---

### Task 5: Update `AnalisisPage.tsx` for Pengurus & Mentors

**Files:**
- Modify: `src/pages/AnalisisPage.tsx`

**Interfaces:**
- Consumes: `user_evaluations`, `user_badges`, `users`.
- Produces: Pengurus mentorship evaluation form & badge issuance modal.

- [ ] **Step 1: Enhance `AnalisisPage.tsx`**

Add an evaluation entry modal allowing Pengurus/Pendamping to write private evaluation notes (`skor_sikap`, `skor_kerapian`, `catatan_pribadi`) and award badges to misdinar members.

- [ ] **Step 2: Run `npm run lint` & `npm run test`**

Run: `npm run lint` and `npm run test`
Expected: 0 errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AnalisisPage.tsx
git commit -m "feat(analytics): add pengurus mentorship evaluation & badge assignment features"
```
