# Implementation Plan - Schedule Enhancements (Max 30 Petugas, Romo/Petugas Photos, PIC Availability Tab)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3 schedule feature enhancements: (1) max 30 officers limit configuration in weekly schedule modals, (2) Romo photo input and visual daily officers photo cards in daily schedule, and (3) a new monthly PIC availability checklist tab for members (e.g. studying in Solo).

**Architecture:** Extend `ScheduleModals.tsx` & `AddMisaModal.tsx` to handle officer limits up to 30. Enhance `ScheduleDailyPage.tsx` with Romo photo selector/display cards and a dedicated tab `ketersediaan` with state/local persistence for monthly PIC weekly availability checkboxes.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React icons, Supabase JS client.

## Global Constraints
- Maximum officer limit capped strictly at 30.
- Modern glassmorphism / sleek UI design with liturgical season color highlights.
- No breaking changes to existing database queries; use fallback state for new UI structures if Supabase fields are not present.

---

### Task 1: Expand Weekly Schedule Officer Capacity to 30

**Files:**
- Modify: `src/pages/schedule/components/ScheduleModals.tsx`
- Modify: `src/pages/schedule/components/AddMisaModal.tsx`
- Modify: `src/pages/schedule/ScheduleWeeklyPage.tsx`

- [ ] **Step 1: Update AddMisaModal & ScheduleModals inputs for max 30 officers**
  - Increase input max from standard 8-15 to 30.
  - Update `EditPetugasSection` in `ScheduleModals.tsx` to display real-time officer count badge (`X / N Petugas (Maks. 30)`).
  - Ensure users can search and select up to 30 officers per slot.

- [ ] **Step 2: Verify build after Task 1**
  - Run TypeScript compile check.

- [ ] **Step 3: Commit Task 1**
  - Git commit with message `feat(schedule): support officer limit up to 30 in weekly schedule modals`

---

### Task 2: Implement Romo Photo Input & Daily Officer Photo Cards in ScheduleDailyPage

**Files:**
- Modify: `src/pages/ScheduleDailyPage.tsx`

- [ ] **Step 1: Add Romo photo & name input fields to Daily Mass Edit Modal**
  - Add state for `romo_nama` and `romo_foto_url` in `editFields` modal.
  - Add quick priest selection list or custom photo URL input in edit modal.

- [ ] **Step 2: Render Premium Romo & Officer Photo Cards in Daily Mass view**
  - Render celebrant Romo card with circular photo, cassock badge, and liturgical color glow.
  - Render officers avatar grid with user photos (`foto_url`) or initials fallback with tooltips.

- [ ] **Step 3: Verify rendering and build**
  - Run build check to ensure no TS errors.

- [ ] **Step 4: Commit Task 2**
  - Git commit with message `feat(daily-schedule): add Romo photo input and visual officer photo cards`

---

### Task 3: Implement New "Ketersediaan PIC (Checklist)" Tab in ScheduleDailyPage

**Files:**
- Modify: `src/pages/ScheduleDailyPage.tsx`

- [ ] **Step 1: Add new tab button and state for PIC availability**
  - Add `'ketersediaan'` to tab state options in `ScheduleDailyPage.tsx`.
  - Add state for `picAvailabilityList` with weekly checklist columns (`pekan_1` to `pekan_5`).

- [ ] **Step 2: Build Availability Checklist UI Matrix & Self-Service Toggle**
  - Build monthly calendar/weekly availability matrix showing all PIC/officers.
  - Allow logged in user to check/uncheck their availability for each week of the selected month (Bisa, Solo/Tidak Bisa, Pas Libur, Akhir Pekan Only).
  - Provide quick filter for Pengurus (e.g., "Filter who is available in Week 2").

- [ ] **Step 3: Commit Task 3**
  - Git commit with message `feat(daily-schedule): add monthly PIC availability checklist tab for Solo officers`

---

### Task 4: End-to-End Verification & Polish

**Files:**
- All modified files

- [ ] **Step 1: Execute TypeScript compilation check**
  - Run `npx tsc --noEmit` or build command to ensure 0 errors.

- [ ] **Step 2: Final Commit & Handoff**
  - Final commit and presentation to user.
