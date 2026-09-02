# Major Mass (Natal & Pekan Suci) Scheduling System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an intelligent, rule-based Major Mass Scheduling Wizard and Allocation Engine for Christmas (Natal) and Holy Week (Pekan Suci) series based on cumulative K-score, senior-junior balance, dynamic per-mass quotas, and special rehearsal sessions.

**Architecture:** A pure, testable TypeScript Allocation Engine (`majorMassEngine.ts`) handles scoring, partitioning, priority-based slot assignment, and constraint validation. A dedicated service layer (`majorMassService.ts`) handles Supabase batch queries and event/rehearsal persistence. An intuitive multi-step Wizard Modal (`MajorMassWizardModal.tsx`) provides preset configurations, rule sliders, and an interactive draft matrix with drag-and-drop / swap previews before publishing.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Supabase JS.

## Global Constraints
- Pure business logic in `majorMassEngine.ts` must have zero DOM/Supabase dependencies for 100% test coverage.
- Strictly adhere to K conditions ($K_1, K_{2a}, K_{2b}, K_{3a}, K_{3b}, K_{3c}, K_{4a}, K_{4c}, K_6$).
- Maintain senior (SMA/SMK/Lulus) and junior (SD/SMP) distribution safety.
- Natal: 1 duty max per member. Pekan Suci: up to 2 duties max with conflict prevention.

---

### Task 1: Type Definitions for Major Mass Module

**Files:**
- Create: `src/types/majorMass.ts`
- Modify: `src/types/index.ts:1-160`

**Interfaces:**
- Produces: `MajorMassSlotConfig`, `MajorMassMember`, `MajorMassRules`, `MajorMassSeriesConfig`, `MajorMassAllocationResult`

- [ ] **Step 1: Create `src/types/majorMass.ts` with complete types**

```typescript
export interface MajorMassSlotConfig {
  id: string;
  name: string;             // e.g. "Malam Natal I (17.00)", "Vigili Paskah I"
  date: string;             // YYYY-MM-DD
  time: string;             // HH:mm
  quota: number;            // e.g. 10 or 8
  priorityRank: number;     // 1 = highest priority, 2, 3...
  rehearsalDate?: string;   // YYYY-MM-DD
  rehearsalTime?: string;   // HH:mm
  rehearsalNotes?: string;
}

export interface MajorMassMember {
  id: string;
  nickname: string;
  nama_lengkap: string;
  nama_panggilan: string;
  pendidikan?: string;      // 'SD' | 'SMP' | 'SMA' | 'SMK' | 'Lulus'
  lingkungan?: string;
  kScore: number;
  totalHadirTugas: number;
  k6Count: number;
  isSenior: boolean;        // true for SMA, SMK, Lulus
}

export interface MajorMassRules {
  seriesType: 'natal' | 'pekan_suci' | 'custom';
  seriesName: string;
  evalStartDate: string;
  evalEndDate: string;
  maxDutyPerMember: number;     // 1 for Natal, 2 for Pekan Suci
  balanceSeniorJunior: boolean;
  seniorRatio: number;          // default 0.5 (50% senior, 50% junior)
  k6PenaltyWeight: number;      // default 5
  avoidConsecutiveDays: boolean;
}

export interface AssignedPetugas {
  slotId: string;
  member: MajorMassMember;
  position: number;
  dutyIndex: 1 | 2;
}

export interface MajorMassAllocationResult {
  slots: Array<{
    config: MajorMassSlotConfig;
    assigned: AssignedPetugas[];
  }>;
  unassignedMembers: MajorMassMember[];
  warnings: string[];
}
```

- [ ] **Step 2: Export from `src/types/index.ts`**

```typescript
export * from './majorMass';
```

- [ ] **Step 3: Run typecheck to verify**

Run: `npm run lint`  
Expected: PASS with 0 errors.

---

### Task 2: Core Major Mass Allocation Engine & Unit Tests (TDD)

**Files:**
- Create: `src/lib/majorMassEngine.ts`
- Test: `src/lib/__tests__/majorMassEngine.test.ts`

**Interfaces:**
- Consumes: `MajorMassSlotConfig`, `MajorMassMember`, `MajorMassRules`, `MajorMassAllocationResult`
- Produces: `calculateMemberScore()`, `allocateMajorMassSlots()`, `validateAllocation()`

- [ ] **Step 1: Write failing unit tests in `src/lib/__tests__/majorMassEngine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMemberScore, allocateMajorMassSlots } from '../majorMassEngine';
import { MajorMassMember, MajorMassSlotConfig, MajorMassRules } from '@/types/majorMass';

describe('majorMassEngine', () => {
  it('calculates member score correctly with K-points and K6 penalties', () => {
    const score = calculateMemberScore({
      rekapPoints: 20,
      hadirTugasCount: 5,
      k6Count: 2,
      k6PenaltyWeight: 5,
    });
    // 20 + 5 - (2 * 5) = 15
    expect(score).toBe(15);
  });

  it('allocates Natal slots prioritizing highest K-score (1 duty max per person)', () => {
    const members: MajorMassMember[] = [
      { id: '1', nickname: 'Alice', nama_lengkap: 'Alice A', nama_panggilan: 'Alice', pendidikan: 'SMA', kScore: 50, totalHadirTugas: 10, k6Count: 0, isSenior: true },
      { id: '2', nickname: 'Bob', nama_lengkap: 'Bob B', nama_panggilan: 'Bob', pendidikan: 'SMP', kScore: 45, totalHadirTugas: 9, k6Count: 0, isSenior: false },
      { id: '3', nickname: 'Charlie', nama_lengkap: 'Charlie C', nama_panggilan: 'Charlie', pendidikan: 'SMA', kScore: 40, totalHadirTugas: 8, k6Count: 0, isSenior: true },
      { id: '4', nickname: 'David', nama_lengkap: 'David D', nama_panggilan: 'David', pendidikan: 'SD', kScore: 35, totalHadirTugas: 7, k6Count: 0, isSenior: false },
    ];

    const slots: MajorMassSlotConfig[] = [
      { id: 'malam-1', name: 'Malam Natal 1', date: '2026-12-24', time: '17:00', quota: 2, priorityRank: 1 },
      { id: 'malam-2', name: 'Malam Natal 2', date: '2026-12-24', time: '20:00', quota: 2, priorityRank: 2 },
    ];

    const rules: MajorMassRules = {
      seriesType: 'natal',
      seriesName: 'Natal 2026',
      evalStartDate: '2026-06-01',
      evalEndDate: '2026-12-01',
      maxDutyPerMember: 1,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: false,
    };

    const result = allocateMajorMassSlots(members, slots, rules);

    expect(result.slots[0].assigned.length).toBe(2);
    expect(result.slots[1].assigned.length).toBe(2);
    // Malam Natal 1 gets top Senior (Alice) and top Junior (Bob)
    expect(result.slots[0].assigned.map(a => a.member.id)).toEqual(['1', '2']);
    // Malam Natal 2 gets second Senior (Charlie) and second Junior (David)
    expect(result.slots[1].assigned.map(a => a.member.id)).toEqual(['3', '4']);
  });

  it('allows 2 duties in Pekan Suci without concurrent day conflict', () => {
    const members: MajorMassMember[] = [
      { id: '1', nickname: 'TopLeader', nama_lengkap: 'Top Leader', nama_panggilan: 'Top', pendidikan: 'SMA', kScore: 100, totalHadirTugas: 20, k6Count: 0, isSenior: true },
      { id: '2', nickname: 'Junior1', nama_lengkap: 'Junior 1', nama_panggilan: 'J1', pendidikan: 'SMP', kScore: 90, totalHadirTugas: 18, k6Count: 0, isSenior: false },
    ];

    const slots: MajorMassSlotConfig[] = [
      { id: 'kamis-putih', name: 'Kamis Putih', date: '2026-04-02', time: '18:00', quota: 2, priorityRank: 2 },
      { id: 'vigili-paskah', name: 'Vigili Paskah', date: '2026-04-04', time: '19:00', quota: 2, priorityRank: 1 },
    ];

    const rules: MajorMassRules = {
      seriesType: 'pekan_suci',
      seriesName: 'Pekan Suci 2026',
      evalStartDate: '2026-01-01',
      evalEndDate: '2026-04-01',
      maxDutyPerMember: 2,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: true,
    };

    const result = allocateMajorMassSlots(members, slots, rules);
    expect(result.slots[0].assigned.length).toBe(2);
    expect(result.slots[1].assigned.length).toBe(2);
    // Both members served in both Vigili (duty 1) and Kamis Putih (duty 2)
    const dutiesPerUser = result.slots.flatMap(s => s.assigned).filter(a => a.member.id === '1');
    expect(dutiesPerUser.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/majorMassEngine.test.ts`  
Expected: FAIL with module not found / functions undefined.

- [ ] **Step 3: Implement `src/lib/majorMassEngine.ts`**

```typescript
import {
  MajorMassMember,
  MajorMassSlotConfig,
  MajorMassRules,
  MajorMassAllocationResult,
  AssignedPetugas,
} from '@/types/majorMass';

export function calculateMemberScore(params: {
  rekapPoints: number;
  hadirTugasCount: number;
  k6Count: number;
  k6PenaltyWeight?: number;
}): number {
  const penalty = (params.k6Count || 0) * (params.k6PenaltyWeight ?? 5);
  return params.rekapPoints + params.hadirTugasCount - penalty;
}

export function isSeniorMember(pendidikan?: string): boolean {
  if (!pendidikan) return false;
  const p = pendidikan.toUpperCase();
  return p === 'SMA' || p === 'SMK' || p === 'LULUS';
}

export function allocateMajorMassSlots(
  members: MajorMassMember[],
  slots: MajorMassSlotConfig[],
  rules: MajorMassRules
): MajorMassAllocationResult {
  // Sort slots by priorityRank ascending (rank 1 first)
  const sortedSlots = [...slots].sort((a, b) => a.priorityRank - b.priorityRank);

  // Track assignments per member
  const memberDutyCount = new Map<string, number>();
  const memberDates = new Map<string, Set<string>>();
  members.forEach(m => {
    memberDutyCount.set(m.id, 0);
    memberDates.set(m.id, new Set());
  });

  // Separate pools and sort by kScore descending
  const seniors = members
    .filter(m => m.isSenior)
    .sort((a, b) => b.kScore - a.kScore);
  const juniors = members
    .filter(m => !m.isSenior)
    .sort((a, b) => b.kScore - a.kScore);

  const slotResults = new Map<string, AssignedPetugas[]>();
  sortedSlots.forEach(s => slotResults.set(s.id, []));

  const warnings: string[] = [];

  // Allocation Rounds (Round 1: 1st duty, Round 2: 2nd duty if allowed)
  const maxRounds = rules.maxDutyPerMember;

  for (let round = 1; round <= maxRounds; round++) {
    for (const slot of sortedSlots) {
      const assigned = slotResults.get(slot.id)!;
      const needed = slot.quota - assigned.length;
      if (needed <= 0) continue;

      let seniorTarget = rules.balanceSeniorJunior
        ? Math.round(slot.quota * rules.seniorRatio)
        : needed;
      let juniorTarget = slot.quota - seniorTarget;

      const currentSeniors = assigned.filter(a => a.member.isSenior).length;
      const currentJuniors = assigned.filter(a => !a.member.isSenior).length;

      let seniorsNeeded = Math.max(0, seniorTarget - currentSeniors);
      let juniorsNeeded = Math.max(0, juniorTarget - currentJuniors);

      // Helper to pick candidates
      const pickCandidates = (pool: MajorMassMember[], count: number) => {
        const picked: MajorMassMember[] = [];
        for (const candidate of pool) {
          if (picked.length >= count) break;
          const currentDuties = memberDutyCount.get(candidate.id) || 0;
          if (currentDuties >= round) continue;
          if (currentDuties >= rules.maxDutyPerMember) continue;

          // Date check (avoid same date)
          const dates = memberDates.get(candidate.id)!;
          if (dates.has(slot.date)) continue;

          // Check already in this slot
          if (assigned.some(a => a.member.id === candidate.id)) continue;

          picked.push(candidate);
          memberDutyCount.set(candidate.id, currentDuties + 1);
          dates.add(slot.date);
        }
        return picked;
      };

      // Pick seniors
      const pickedSeniors = pickCandidates(seniors, seniorsNeeded);
      pickedSeniors.forEach(m => {
        assigned.push({
          slotId: slot.id,
          member: m,
          position: assigned.length + 1,
          dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
        });
      });

      // Pick juniors
      const pickedJuniors = pickCandidates(juniors, juniorsNeeded);
      pickedJuniors.forEach(m => {
        assigned.push({
          slotId: slot.id,
          member: m,
          position: assigned.length + 1,
          dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
        });
      });

      // Fallback: If still under quota, fill with any available candidate
      const remainingNeeded = slot.quota - assigned.length;
      if (remainingNeeded > 0) {
        const remainingPool = [...seniors, ...juniors].sort((a, b) => b.kScore - a.kScore);
        const fallbackPicked = pickCandidates(remainingPool, remainingNeeded);
        fallbackPicked.forEach(m => {
          assigned.push({
            slotId: slot.id,
            member: m,
            position: assigned.length + 1,
            dutyIndex: (memberDutyCount.get(m.id) || 1) as 1 | 2,
          });
        });
      }

      if (assigned.length < slot.quota) {
        warnings.push(`Slot ${slot.name} hanya terisi ${assigned.length}/${slot.quota} petugas (kurang kandidat).`);
      }
    }
  }

  const unassigned = members.filter(m => (memberDutyCount.get(m.id) || 0) === 0);

  return {
    slots: sortedSlots.map(s => ({
      config: s,
      assigned: slotResults.get(s.id) || [],
    })),
    unassignedMembers: unassigned,
    warnings,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/majorMassEngine.test.ts`  
Expected: PASS (all tests pass).

---

### Task 3: Supabase Service Layer & Batch Persister

**Files:**
- Create: `src/lib/majorMassService.ts`
- Test: `src/lib/__tests__/majorMassService.test.ts`

**Interfaces:**
- Consumes: `supabase`, `MajorMassRules`, `MajorMassSlotConfig`, `MajorMassAllocationResult`
- Produces: `fetchMajorMassPool()`, `persistMajorMassSeries()`

- [ ] **Step 1: Write unit/mock tests in `src/lib/__tests__/majorMassService.test.ts`**
- [ ] **Step 2: Implement `src/lib/majorMassService.ts` to fetch pool, aggregate $K$ points, and batch insert events + assignments + special rehearsals.**
- [ ] **Step 3: Run test to verify it passes.**

---

### Task 4: Major Mass Wizard UI Components

**Files:**
- Create: `src/pages/schedule/components/majorMass/MajorMassWizardModal.tsx`
- Create: `src/pages/schedule/components/majorMass/MajorMassPresetCards.tsx`
- Create: `src/pages/schedule/components/majorMass/MajorMassSlotEditor.tsx`
- Create: `src/pages/schedule/components/majorMass/MajorMassPreviewMatrix.tsx`

**Features:**
- Step 1: Preset buttons (Natal 2026, Pekan Suci 2026, Custom), editable slot table with quota, priority rank, rehearsal date/time inputs.
- Step 2: Sliders for evaluation period, max duties (1x or 2x), senior/junior toggle, and penalty weights.
- Step 3: Simulation result matrix with candidate cards, badges (Senior/Junior, $K$-Score, Rank, 1x/2x badge), drag-and-drop or swap selector, validation alert banner, and Save Draft / Publish buttons.

- [ ] **Step 1: Build sub-components (`MajorMassPresetCards`, `MajorMassSlotEditor`, `MajorMassPreviewMatrix`)**
- [ ] **Step 2: Build main orchestrator `MajorMassWizardModal.tsx`**
- [ ] **Step 3: Verify TypeScript typing with `npm run lint`**

---

### Task 5: Integration into Schedule Page & Navigation

**Files:**
- Modify: `src/pages/schedule/ScheduleWeeklyPage.tsx`
- Modify: `src/pages/schedule/components/ExportToolbar.tsx`

- [ ] **Step 1: Add "Wizard Misa Besar" trigger button in schedule management header (accessible to Admins & Pengurus)**
- [ ] **Step 2: Connect `MajorMassWizardModal` state and handle onSave/onPublish callback with automatic calendar refresh**
- [ ] **Step 3: Verify build and routing**

---

### Task 6: Full End-to-End Verification

- [ ] **Step 1: Run all unit & integration tests (`npm test`)**
- [ ] **Step 2: Run TypeScript compiler (`npm run lint`)**
- [ ] **Step 3: Verify UI workflow and responsiveness**
