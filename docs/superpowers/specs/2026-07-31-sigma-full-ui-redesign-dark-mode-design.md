# SIGMA Full UI/UX Redesign & Dark Mode System Design Spec

**Date**: 2026-07-31  
**Target Module**: Entire SIGMA Web Application UI/UX System ([index.css](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/index.css), [Layout.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/components/layout/Layout.tsx), [DashboardPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/DashboardPage.tsx), and all pages)

---

## 1. Goal Description
Transform SIGMA into a **Majestic Royal Theme** interface featuring deep burgundy red accents (`#8B0000`), warm gold highlights (`#d97706`), glassmorphism cards, and a floating **Dark Mode Toggle** button (bottom-right FAB). Ensure 100% zero functional regression while dramatically elevating aesthetics and mobile/desktop usability.

---

## 2. Design Tokens & Theme Architecture

### A. Majestic Color Palette & Tokens ([index.css](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/index.css))
* **Primary Brand**: Deep Royal Burgundy (`#8B0000` / `#7c1d1d`).
* **Secondary Accent**: Warm Sacred Gold (`#d97706` / `#f59e0b`).
* **Light Theme**: `bg-slate-50`, `text-slate-900`, `bg-white/90` glass cards.
* **Dark Theme (`.dark`)**: `bg-slate-950`, `text-slate-100`, `bg-slate-900/90` glass cards, `border-slate-800`.

### B. Floating Action Button (Dark Mode Toggle)
* A sticky floating button positioned at `bottom-6 right-6 z-50`.
* Toggles `.dark` class on `document.documentElement` and persists setting in `localStorage.setItem('sigma_theme', 'dark' | 'light')`.
* Icon transitions dynamically: 🌙 (Dark) <-> ☀️ (Light).

---

## 3. Page Redesign Highlights

### 1. Dashboard Page ([DashboardPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/DashboardPage.tsx))
* **Majestic Welcome Banner**: Personal greeting *"Berkah Dalem, [Nama]! 👋"* with gradient background, active status badge, and next mass duty Countdown Timer.
* **1-Tap Quick Action Grid**: Big intuitive action cards with vibrant icons (`Scan QR`, `Tukar Jadwal`, `Kartu Anggota`, `Dashboard Pengurus`).

### 2. Hybrid Card-Table Layouts across all Modules
* **Mobile View (`< sm`)**: High-density interactive cards with avatar badges, distinct status indicators, and 1-tap action triggers.
* **Desktop View (`>= sm`)**: Sleek tables with sticky headers, hover highlights, glassmorphism containers, and instant search/filter chips.

---

## 4. Verification & Safety Plan

* **Automated Unit Tests**: `npm run test` (15/15 passed).
* **Type Check**: `npm run lint` (`tsc --noEmit` clean with 0 errors).
* **Zero Functional Regression**: All existing routes, actions, and features remain 100% intact.
