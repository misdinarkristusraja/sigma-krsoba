# Smart Override & Walk-In Scan System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an automated Smart 2-Mode Override & Walk-In modal on [ScanPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/ScanPage.tsx) so scanner officers can 1-tap record substitusi mendadak or walk-in duties when a scanned member is not assigned to the event slot.

**Architecture:** 
1. Database migration 038 to add `replaced_user_id` to `scan_records`.
2. Unit tests in `override.test.ts` to test status K classification (K1 vs K3b).
3. UI implementation in `ScanPage.tsx` with automated missing-assignment fetcher and 2-mode modal (Mode A: Substitusi Mendadak 1-tap name picker, Mode B: Walk-In Sukarela).

**Tech Stack:** React, TypeScript, Supabase, Vitest, Tailwind CSS

## Global Constraints

- Preserve all existing scan anti-duplication and cooldown checks.
- Zero breaking changes to existing scan_records schema.

---

### Task 1: Database Migration 038 & K-Category Calculation Helper

**Files:**
- Create: `supabase/migrations/00000000000038_add_replaced_user_id_to_scan_records.sql`
- Modify: `src/lib/utils.ts`
- Test: `src/lib/__tests__/override.test.ts`

**Interfaces:**
- Consumes: `hitungPoin` in `utils.ts`
- Produces: `replaced_user_id` column in `scan_records` and updated `hitungPoin` returning `K1` for substitutes with training and `K3b` for substitutes without training.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/override.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hitungPoin } from '../utils';

describe('Smart Override & Walk-In K-Category Classification', () => {
  it('assigns K1 to a substitute who attended training and replaced a missing member', () => {
    const res = hitungPoin({
      isDijadwalkan: false,
      isHadirTugas: true,
      isHadirLatihan: true,
      isWalkIn: true,
      isSwapPengganti: true, // or replaced_user_id
    });
    expect(res.kondisi).toBe('K1');
  });

  it('assigns K3b to an emergency substitute or walk-in who did not attend training', () => {
    const res = hitungPoin({
      isDijadwalkan: false,
      isHadirTugas: true,
      isHadirLatihan: false,
      isWalkIn: true,
      isSwapPengganti: false,
    });
    expect(res.kondisi).toBe('K3b');
  });
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npm run test`
Expected: PASS

- [ ] **Step 3: Write migration 038**

Create `supabase/migrations/00000000000038_add_replaced_user_id_to_scan_records.sql`:
```sql
-- Migration 038: Add replaced_user_id to scan_records for Smart Override Substitusi Mendadak
ALTER TABLE scan_records
  ADD COLUMN IF NOT EXISTS replaced_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
```

- [ ] **Step 4: Commit Migration & Test**

```bash
git add supabase/migrations/00000000000038_add_replaced_user_id_to_scan_records.sql src/lib/__tests__/override.test.ts
git commit -m "feat(override): add migration 038 and unit tests for smart override classification"
```

---

### Task 2: Smart 2-Mode Override Modal in ScanPage.tsx

**Files:**
- Modify: `src/pages/ScanPage.tsx`
- Test: `src/lib/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `supabase.from('assignments')` to fetch missing members for event slot.
- Produces: Smart 2-Mode Override Modal with Mode A (Substitusi Mendadak 1-tap list) and Mode B (Walk-in Sukarela).

- [ ] **Step 1: Update ScanPage.tsx override handler**

Update `openOverride` and `doOverride` in `src/pages/ScanPage.tsx`:
- When opening override, query `assignments` for the active event ID where `is_scanned` / attendance is missing, joining `users(id, nama_panggilan, lingkungan)`.
- Render Mode A tab ("🔄 Substitusi Mendadak (Tukar di Tempat)") with 1-tap name buttons.
- Render Mode B tab ("➕ Tugas Tambahan Sukarela (Walk-In)").
- Save `replaced_user_id` into `scan_records`.

- [ ] **Step 2: Verify with vitest & lint**

Run: `npm run test && npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit and Push**

```bash
git add src/pages/ScanPage.tsx
git commit -m "feat(scan): implement Smart 2-Mode Override Modal with 1-tap missing member substitute picker"
git push origin main
```
