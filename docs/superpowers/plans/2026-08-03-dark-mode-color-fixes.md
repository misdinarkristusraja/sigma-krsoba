# Dark Mode & Color Contrast Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken dark mode text contrast, unstyled bright white popups/modals, broken mobile bottom navigation bar, and hardcoded light-mode elements across all 25+ pages of SIGMA.

**Architecture:** Enhance `src/index.css` with dark mode utility tokens and systematically update `src/components/layout/Layout.tsx`, modal overlays, forms, card containers, tab bars, and tables to support dark mode with high legibility (WCAG AA contrast).

**Tech Stack:** React, Tailwind CSS (Class-based Dark Mode), TypeScript, Vitest.

## Global Constraints
- Do not break existing light mode aesthetics or functionality.
- Ensure all text in dark mode is crisp and readable (`text-slate-100`, `text-slate-200`, `text-slate-300`, or `text-slate-400`).
- Ensure cards, popups, and modals use dark slate backgrounds (`dark:bg-slate-900`, `dark:bg-slate-950`) with borders (`dark:border-slate-800`).
- All tests in `npm test` must continue to pass.

---

### Task 1: Global CSS Utility & Design System Tokens

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Update `src/index.css` base & component utility classes for dark mode**

Add/update `.modal-overlay`, `.modal-card`, `.nav-tab`, `.badge-gray`, and ensure `.card`, `.btn-secondary`, `.input`, `.tbl` have consistent dark mode fallbacks.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 1**

```bash
git add src/index.css
git commit -m "style: update global index.css with dark mode utilities"
```

---

### Task 2: Layout & Navigation Dark Mode Fixes

**Files:**
- Modify: `src/components/layout/Layout.tsx:350-380`

- [ ] **Step 1: Update `Layout.tsx` mobile bottom bar & top header**

Add `dark:bg-slate-900`, `dark:border-slate-800`, `dark:text-amber-400` to the mobile bottom navigation bar and headers.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add src/components/layout/Layout.tsx
git commit -m "fix(layout): add dark mode support to mobile bottom nav and headers"
```

---

### Task 3: Auth & Public Pages Dark Mode Fixes

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/ChangePasswordPage.tsx`

- [ ] **Step 1: Update Auth page cards and modals with `dark:` classes**

Ensure login/register forms and TOS modal use `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 3**

```bash
git add src/pages/LoginPage.tsx src/pages/RegisterPage.tsx src/pages/ChangePasswordPage.tsx
git commit -m "fix(auth): support dark mode on login, register, and change password pages"
```

---

### Task 4: Schedules & Swaps Dark Mode Fixes

**Files:**
- Modify: `src/pages/JadwalSayaPage.tsx`
- Modify: `src/pages/ScheduleDailyPage.tsx`
- Modify: `src/pages/SwapPage.tsx`

- [ ] **Step 1: Update modals, event lists, opt-in banners, and tabs in JadwalSayaPage, ScheduleDailyPage, SwapPage**

Replace hardcoded `bg-white` popups and cards with `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 4**

```bash
git add src/pages/JadwalSayaPage.tsx src/pages/ScheduleDailyPage.tsx src/pages/SwapPage.tsx
git commit -m "fix(schedule): support dark mode on JadwalSaya, ScheduleDaily, and Swap pages"
```

---

### Task 5: Presensi & Scan Pages Dark Mode Fixes

**Files:**
- Modify: `src/pages/AttendancePage.tsx`
- Modify: `src/pages/ScanPage.tsx`
- Modify: `src/pages/ScanLatihanPage.tsx`
- Modify: `src/pages/ScanRecordsPage.tsx`

- [ ] **Step 1: Update scanner overlays, member info cards, and history tables**

Add dark mode background and border utilities to scan and attendance components.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 5**

```bash
git add src/pages/AttendancePage.tsx src/pages/ScanPage.tsx src/pages/ScanLatihanPage.tsx src/pages/ScanRecordsPage.tsx
git commit -m "fix(presensi): support dark mode on attendance and scan pages"
```

---

### Task 6: Members, Directory & Growth Pages Dark Mode Fixes

**Files:**
- Modify: `src/pages/MembersPage.tsx`
- Modify: `src/pages/MemberDetailPage.tsx`
- Modify: `src/pages/DirectoryPage.tsx`
- Modify: `src/pages/AnalisisPage.tsx`
- Modify: `src/pages/MyGrowthPage.tsx`
- Modify: `src/pages/PoinKegiatanPage.tsx`
- Modify: `src/pages/RecapPage.tsx`
- Modify: `src/pages/StatistikPage.tsx`
- Modify: `src/pages/StreakPage.tsx`
- Modify: `src/pages/CardsPage.tsx`
- Modify: `src/pages/ReregistrationPage.tsx`
- Modify: `src/pages/AcaraPage.tsx`

- [ ] **Step 1: Update member cards, detail modals, growth input boxes, chart cards, and event popups**

Apply `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100` across all member & growth pages.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 6**

```bash
git add src/pages/MembersPage.tsx src/pages/MemberDetailPage.tsx src/pages/DirectoryPage.tsx src/pages/AnalisisPage.tsx src/pages/MyGrowthPage.tsx src/pages/PoinKegiatanPage.tsx src/pages/RecapPage.tsx src/pages/StatistikPage.tsx src/pages/StreakPage.tsx src/pages/CardsPage.tsx src/pages/ReregistrationPage.tsx src/pages/AcaraPage.tsx
git commit -m "fix(members-growth): support dark mode across member, directory, growth, and event pages"
```

---

### Task 7: Pengurus Suite & Admin Pages Dark Mode Fixes

**Files:**
- Modify: `src/pages/pengurus/KetuaPage.tsx`
- Modify: `src/pages/pengurus/SekretarisPage.tsx`
- Modify: `src/pages/pengurus/BendaharaPage.tsx`
- Modify: `src/pages/pengurus/JasrohPage.tsx`
- Modify: `src/pages/pengurus/MultimediaPage.tsx`
- Modify: `src/pages/pengurus/SakristanPage.tsx`
- Modify: `src/pages/pengurus/PutsankrisPage.tsx`
- Modify: `src/pages/pengurus/NotificationAdminPage.tsx`
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Update Pengurus suite subpages and AdminPage popups, tables, and cards**

Add dark mode support to all pengurus suite dashboards, forms, sticky headers, and edit modals.

- [ ] **Step 2: Verify Vitest tests**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit Task 7**

```bash
git add src/pages/pengurus/*.tsx src/pages/AdminPage.tsx
git commit -m "fix(pengurus-admin): support dark mode across pengurus suite and admin page"
```

---

### Task 8: Build & Full Verification

- [ ] **Step 1: Run full Vitest suite**

Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 2: Run production build verification**

Run: `npm run build`
Expected: Build succeeds without TypeScript or CSS errors.

- [ ] **Step 3: Push changes to GitHub repository**

Run: `git push origin main`
Expected: Successfully pushed to github.
