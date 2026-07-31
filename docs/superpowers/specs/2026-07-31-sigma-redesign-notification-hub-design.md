# SIGMA UI/UX Redesign, Notification Hub & Jasroh Integration Design Spec

**Date**: 2026-07-31  
**Target Subsystems**: UI/UX Layout, Notification Hub, Jasmani Rohani Division Suite

---

## 1. Goal Description
Transform the SIGMA web application into a state-of-the-art, visually stunning, and highly intuitive platform by:
1. Implementing a **Hybrid Card-Table UI/UX Redesign** across all pages (responsive mobile cards + rich sticky desktop tables).
2. Building an **In-App Notification Hub & Web Push Browser System** covering H-1 Duty/Training reminders, missed duty alerts, announcements, new schedule broadcasts, and new event announcements.
3. Integrating **Acara** and **Presensi Acara** into the **Jasmani Rohani Division Suite Hub** ([JasrohPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/pengurus/JasrohPage.tsx)).

---

## 2. System Architecture & Components

### A. Notification Hub Subsystem (`notifications` Table & NotificationBell)

#### Database Schema (Migration 039)
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  tipe        VARCHAR(50) NOT NULL, -- 'REMINDER_TUGAS', 'REMINDER_LATIHAN', 'MISSED_DUTY', 'ANNOUNCEMENT', 'NEW_SCHEDULE', 'NEW_EVENT'
  judul       VARCHAR(200) NOT NULL,
  pesan       TEXT NOT NULL,
  link_url    TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_user_policy ON notifications FOR ALL
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus')));
```

#### Notification Bell Component (`NotificationBell.tsx`)
- Renders in the main application header ([Header.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/components/layout/Header.tsx)).
- Displays an unread counter badge (`🔴 N`).
- Opens a popover menu showing recent notifications with 1-tap navigation to the relevant event/schedule/swap page.
- Includes a button **"🔔 Aktifkan Push Notification Browser"** requesting browser Notification permission.

---

### B. Hybrid Card-Table UI/UX Redesign

#### Component Layout Standards
* **Mobile View (`< sm`)**: High-density interactive cards featuring avatar initials, distinct HSL badges, quick 1-tap action buttons, and collapsible details.
* **Desktop View (`>= sm`)**: Custom styled tables with sticky headers, subtle hover animations, glassmorphism cards, and instant search/filter chips.
* **Target Pages**:
  1. [MembersPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/MembersPage.tsx): Unified status dropdown + responsive member cards.
  2. [ScheduleWeeklyPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/schedule/ScheduleWeeklyPage.tsx): Visual liturgy slot cards + export helpers.
  3. [SwapPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/SwapPage.tsx): Swap request card feed with instant claim modal.
  4. [RecapPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/RecapPage.tsx): Frequency card grid + detailed history table.

---

### C. Jasroh Hub Integration ([JasrohPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/pengurus/JasrohPage.tsx))

#### Integrated Tabs
1. ⚽ **Program Kerja & Retret**: Activity and retreat planning.
2. 🎉 **Manajemen Acara**: Event creation and configuration (embedded from [AcaraPage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/AcaraPage.tsx)).
3. 📋 **Presensi Acara**: Attendance log and QR scanner for special events (embedded from [AttendancePage.tsx](file:///d:/Church/SigmaProject/Build/SigmaNEW/src/pages/AttendancePage.tsx)).

---

## 3. Verification & Safety Plan

* **Automated Unit Tests**: Test notification creation helpers and Jasroh tab navigation.
* **Type Check**: `npm run lint` (`tsc --noEmit`) clean with 0 errors.
* **Zero Functional Regression**: All existing routes (`/acara`, `/presensi`, `/rekap`, etc.) remain fully backwards-compatible.
