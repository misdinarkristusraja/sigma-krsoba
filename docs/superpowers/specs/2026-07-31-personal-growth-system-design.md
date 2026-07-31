# Design Spec: Personal Growth & Quality Analytics System

**Date:** 2026-07-31  
**Status:** Approved  
**Author:** AI Pair Programmer & User  

---

## 1. Executive Summary & Goals

This specification outlines the complete replacement of the public points system (K1–K6 Leaderboard) in the SIGMA misdinar application with a private, personalized growth and quality analysis model.

### Key Objectives:
1. **Eliminate Public Competition**: Remove public point ranks to foster a healthy, spiritual, and supportive service environment.
2. **Private Personal Growth (Service Tier)**: Introduce non-competitive service milestones (*Misdinar Mula, Pratama, Utama, Senior*) based on completed service hours and assignments.
3. **5-Dimension Quality Radar**: Provide each misdinar with a private radar chart assessing Discipline, Training Commitment, Role Diversity, Solidarity, and Attitude.
4. **Private Badges & Mentorship Notes**: Allow members to earn private achievement badges and receive confidential feedback from mentors/pengurus.
5. **Deterministic Scan Tracking**: Upgrade `scan_records` to directly store `event_id` and `latihan_id`, removing ambiguous date-range guessing.

---

## 2. Database Schema Design

### A. Upgrade `scan_records` Table
Add direct foreign key links to `events`:
```sql
ALTER TABLE scan_records 
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latihan_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_records_event ON scan_records(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_records_latihan ON scan_records(latihan_id);
```

### B. New Table: `user_badges`
Stores private badges earned by users:
```sql
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

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
```

### C. New Table: `user_evaluations`
Stores private mentor evaluation notes:
```sql
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

CREATE INDEX idx_user_evaluations_user ON user_evaluations(user_id);
```

---

## 3. Metrics & Quality Calculation Engine

### 5-Dimension Personal Quality Radar:
1. **Kedisiplinan Misa (%)**: $\frac{\text{Total Scan Hadir Tugas}}{\text{Total Penugasan}} \times 100\%$
2. **Komitmen Latihan (%)**: $\frac{\text{Total Scan Hadir Latihan}}{\text{Total Latihan Wajib}} \times 100\%$
3. **Variasi Peran (Diversity Rate)**: Count of unique event/liturgy types served.
4. **Solidaritas & Kehandalan (%)**: Punctuality rate & participation in claiming swap offers.
5. **Evaluasi Attitude (Rating 1-5)**: Average score from `user_evaluations`.

### Service Tiers:
- **Misdinar Mula**: 1–15 penugasan
- **Misdinar Pratama**: 16–40 penugasan
- **Misdinar Utama**: 41–80 penugasan
- **Misdinar Senior**: >80 penugasan

---

## 4. UI & Page Architecture

1. **`src/pages/MyGrowthPage.tsx`** (Replaces `PoinKegiatanPage.tsx` & `RecapPage.tsx`):
   - Service Tier Header Card
   - Recharts Radar Chart (5 dimensions)
   - Badge Showcase Grid
   - Attendance Summary Stats
   - Private Mentor Notes List
2. **`src/pages/AnalisisPage.tsx`**:
   - Pengurus overview of group health & attendance metrics
   - Evaluation entry modal for assigning badges and writing private notes
3. **`src/pages/ScanPage.tsx` & `src/pages/ScanLatihanPage.tsx`**:
   - Save selected `event_id` or `latihan_id` on scan insertion.

---

## 5. Verification & Testing Strategy

- **Database Migrations**: Applied via Supabase CLI or SQL runner.
- **Unit Tests**: Add tests in `src/lib/__tests__/growth.test.ts` to verify radar score calculation and service tier assignment logic.
- **TypeScript & Linting**: Run `npm run lint` and `npm run test` to ensure 100% type safety and passing tests.
