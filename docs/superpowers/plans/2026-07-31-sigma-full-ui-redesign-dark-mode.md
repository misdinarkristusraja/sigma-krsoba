# SIGMA Full UI/UX Redesign & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full UI/UX Redesign featuring Majestic Royal Burgundy & Gold theme, floating Dark Mode Toggle FAB button, and enhanced Dashboard Welcome Banner with Countdown Timer.

**Architecture:**
1. Update `index.css` with Dark Mode variables (`.dark`) and Majestic Royal theme tokens.
2. Build floating `DarkModeToggle.tsx` FAB button in `Layout.tsx`.
3. Redesign `DashboardPage.tsx` with Majestic Welcome Banner, Next Duty Countdown Card, and 1-Tap Quick Action Grid.
4. Verify zero functional regressions via Vitest suite and TypeScript check.

**Tech Stack:** React, Tailwind CSS, Framer Motion, Lucide Icons, Vitest

## Global Constraints
- Zero breaking changes to existing routes or functionality.
- Both Light mode and Dark mode must render crisp, readable text with high contrast.

---

### Task 1: CSS Design Tokens & Floating Dark Mode Toggle FAB Button

**Files:**
- Modify: `src/index.css`
- Create: `src/components/ui/DarkModeToggle.tsx`
- Modify: `src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: Tailwind CSS `.dark` class & `localStorage.getItem('sigma_theme')`.
- Produces: Floating Dark Mode Toggle FAB at bottom-right of screen.

- [ ] **Step 1: Update index.css with .dark styles**

Add `.dark` styles in `src/index.css`:
```css
.dark body {
  @apply bg-slate-950 text-slate-100;
}
.dark .card {
  @apply bg-slate-900/90 border-slate-800 text-slate-100 shadow-lg shadow-black/20;
}
.dark .input {
  @apply bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-brand-500;
}
```

- [ ] **Step 2: Create DarkModeToggle.tsx**

Create `src/components/ui/DarkModeToggle.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sigma_theme') === 'dark' ||
        (!('sigma_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('sigma_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('sigma_theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-brand-800 dark:bg-amber-500 text-white dark:text-slate-950 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white/20"
      title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
    >
      {isDark ? <Sun size={22} className="animate-spin-slow" /> : <Moon size={22} />}
    </button>
  );
}
```

- [ ] **Step 3: Mount DarkModeToggle in Layout.tsx**

Mount `<DarkModeToggle />` in `src/components/layout/Layout.tsx`.

- [ ] **Step 4: Run test and lint**

Run: `npm run test && npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/index.css src/components/ui/DarkModeToggle.tsx src/components/layout/Layout.tsx
git commit -m "feat(ui): add Dark Mode design tokens and floating DarkModeToggle FAB button"
```

---

### Task 2: Redesign Dashboard Page with Majestic Welcome Banner & Countdown Timer

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: Auth context & schedule hooks.
- Produces: Majestic Welcome Banner, Next Duty Countdown Card, and 1-Tap Quick Action Grid.

- [ ] **Step 1: Redesign DashboardPage.tsx**

Update `DashboardPage.tsx` with:
- Majestic Welcome Banner featuring personal greeting *"Berkah Dalem, [Nama]! 👋"* and gradient background.
- Next Duty Countdown Card calculating remaining hours/minutes until next assigned Mass.
- 1-Tap Quick Action Grid cards with vibrant icons and dark mode styling.

- [ ] **Step 2: Run test and lint**

Run: `npm run test && npm run lint`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit and Push**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): apply Majestic Royal redesign with personal Welcome Banner and Next Duty Countdown"
git push origin main
```
