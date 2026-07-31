# SIGMA UI/UX Redesign, Notification Hub & Jasroh Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Notification Hub (In-App Bell + Web Push Browser), Jasroh Hub integration (sub-tabs for Acara & Presensi Acara), and Hybrid Card-Table UI/UX Redesign across SIGMA.

**Architecture:**
1. Database Migration 039 (`notifications` table & policies).
2. Unit tests in `notifications.test.ts` for notification creation and unread counter logic.
3. Notification Bell component & Browser Web Push Notification helper.
4. Jasroh Division Hub Integration with sub-tabs for Program Kerja, Acara, and Presensi Acara.
5. Hybrid Card-Table UI/UX redesign on Members, Schedule, Swap, Recap, and Admin pages.

**Tech Stack:** React, TypeScript, Supabase, Tailwind CSS, Vitest, Framer Motion

## Global Constraints
- Zero breaking changes to existing route URLs (`/acara`, `/presensi`, `/rekap`, etc. stay accessible).
- All unit tests must pass (`npm run test`), and TypeScript must compile clean (`npm run lint`).

---

### Task 1: Migration 039 & Notification Database Infrastructure

**Files:**
- Create: `supabase/migrations/00000000000039_create_notifications_table.sql`
- Create: `src/lib/__tests__/notifications.test.ts`
- Modify: `src/lib/utils.ts`

**Interfaces:**
- Consumes: Supabase client
- Produces: `notifications` table schema & helper functions for creating in-app notifications.

- [ ] **Step 1: Write the failing unit test**

Create `src/lib/__tests__/notifications.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatNotificationLabel } from '../utils';

describe('Notification Hub Helpers', () => {
  it('formats notification type labels correctly', () => {
    expect(formatNotificationLabel('REMINDER_TUGAS')).toContain('Pengingat Tugas');
    expect(formatNotificationLabel('REMINDER_LATIHAN')).toContain('Pengingat Latihan');
    expect(formatNotificationLabel('MISSED_DUTY')).toContain('Tugas Terlewat');
    expect(formatNotificationLabel('NEW_EVENT')).toContain('Event Baru');
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npm run test`
Expected: PASS after helper defined.

- [ ] **Step 3: Write migration 039**

Create `supabase/migrations/00000000000039_create_notifications_table.sql`:
```sql
-- Migration 039: Create notifications table and RLS policies
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  tipe        VARCHAR(50) NOT NULL,
  judul       VARCHAR(200) NOT NULL,
  pesan       TEXT NOT NULL,
  link_url    TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_owner_policy ON notifications FOR ALL
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus')));
```

- [ ] **Step 4: Add formatNotificationLabel in utils.ts**

Add helper in `src/lib/utils.ts`:
```typescript
export function formatNotificationLabel(type: string): string {
  switch (type) {
    case 'REMINDER_TUGAS':   return '⏰ Pengingat Tugas Misa';
    case 'REMINDER_LATIHAN': return '🏋️ Pengingat Latihan';
    case 'MISSED_DUTY':      return '⚠️ Tugas Terlewat';
    case 'ANNOUNCEMENT':     return '📢 Informasi Pengumuman';
    case 'NEW_SCHEDULE':     return '📅 Jadwal Baru Dipublikasikan';
    case 'NEW_EVENT':        return '🎉 Event Baru Diumumkan';
    default:                 return '🔔 Notifikasi';
  }
}
```

- [ ] **Step 5: Commit Task 1**

```bash
git add supabase/migrations/00000000000039_create_notifications_table.sql src/lib/__tests__/notifications.test.ts src/lib/utils.ts
git commit -m "feat(notifications): add migration 039 and notification unit test helpers"
```

---

### Task 2: Notification Bell & Web Push Integration in Header

**Files:**
- Create: `src/components/ui/NotificationBell.tsx`
- Modify: `src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `notifications` table & browser `Notification.requestPermission` API.
- Produces: Interactive Notification Bell with unread counter, dropdown menu, and browser Web Push permission prompt.

- [ ] **Step 1: Create NotificationBell.tsx**

Create `src/components/ui/NotificationBell.tsx` with popover, unread counter badge, and Web Push browser notification request.

- [ ] **Step 2: Mount NotificationBell in Header.tsx**

Update `Header.tsx` to mount `NotificationBell` next to the user profile badge.

- [ ] **Step 3: Test and Lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit Task 2**

```bash
git add src/components/ui/NotificationBell.tsx src/components/layout/Header.tsx
git commit -m "feat(notifications): implement NotificationBell component with Web Push support in Header"
```

---

### Task 3: Jasroh Hub Integration (Acara & Presensi Acara Sub-Tabs)

**Files:**
- Modify: `src/pages/pengurus/JasrohPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Acara management & Presensi Acara modules.
- Produces: Integrated Jasroh Division Hub with 3 sub-tabs (`[Program Kerja]`, `[Manajemen Acara]`, `[Presensi Acara]`).

- [ ] **Step 1: Update JasrohPage.tsx**

Update `JasrohPage.tsx` to include tab switcher:
- Tab 1: Program Kerja & Retret (Activity Planning & Budget)
- Tab 2: Manajemen Acara (Integrated Event Manager)
- Tab 3: Presensi Acara (Integrated Event Attendance Log & Scanner)

- [ ] **Step 2: Update App.tsx redirect routes**

Ensure `/acara` and `/presensi` seamlessly navigate into `/pengurus/jasroh` while maintaining standalone page capability.

- [ ] **Step 3: Test and Lint**

Run: `npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add src/pages/pengurus/JasrohPage.tsx src/App.tsx
git commit -m "feat(jasroh): integrate Acara and Presensi Acara into Jasmani Rohani Division Hub"
```

---

### Task 4: Hybrid Card-Table UI/UX Redesign Across SIGMA

**Files:**
- Modify: `src/pages/MembersPage.tsx`
- Modify: `src/pages/RecapPage.tsx`
- Modify: `src/pages/SwapPage.tsx`

**Interfaces:**
- Consumes: SIGMA Design Tokens & Tailwind CSS.
- Produces: Premium Hybrid Card-Table UI across Members, Recap, and Swap pages.

- [ ] **Step 1: Update MembersPage, RecapPage, and SwapPage UI**

Apply modern hybrid cards on mobile and sleek sticky tables on desktop with curated HSL color badges, glassmorphism cards, and smooth micro-animations.

- [ ] **Step 2: Test and Lint**

Run: `npm run test && npm run lint`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit and Push**

```bash
git add src/pages/MembersPage.tsx src/pages/RecapPage.tsx src/pages/SwapPage.tsx
git commit -m "style(ui): apply Hybrid Card-Table UI/UX redesign across Members, Recap, and Swap pages"
git push origin main
```
