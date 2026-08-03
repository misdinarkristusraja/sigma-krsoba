# Design Spec: Comprehensive Dark Mode & Color Contrast Fixes

## 1. Overview
This design addresses broken dark mode rendering across all pages of the SIGMA application. It resolves invisible text, high/jarring color contrast, unstyled modal popups, broken mobile navigation bars, and unhandled `bg-white` components.

---

## 2. Global CSS & Design Tokens (`src/index.css` & `tailwind.config.js`)

### Global Utility Improvements
1. **Body & Root**:
   - `body`: `@apply bg-gray-50 text-gray-900 font-sans dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200;`
2. **Cards (`.card`)**:
   - `@apply bg-white dark:bg-slate-900/90 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 dark:text-slate-100;`
3. **Modals (`.modal-overlay` & `.modal-card`)**:
   - Modal background: `bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-900 dark:text-slate-100 shadow-2xl`
   - Overlay backdrop: `bg-black/60 dark:bg-black/80 backdrop-blur-xs`
4. **Form Inputs (`.input`)**:
   - `bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 border-gray-300 dark:border-slate-700 placeholder-gray-400 dark:placeholder-slate-500`
5. **Tabs & Controls**:
   - Tab containers: `bg-gray-100 dark:bg-slate-800/80`
   - Active tab: `bg-white dark:bg-slate-900 text-brand-800 dark:text-amber-400 shadow-sm font-semibold`
   - Inactive tab: `text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200`
6. **Tables (`.tbl`)**:
   - Table header (`.tbl th`): `bg-gray-50 dark:bg-slate-800/90 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-800`
   - Table cells (`.tbl td`): `border-gray-100 dark:border-slate-800 text-gray-800 dark:text-slate-200`
   - Hover state (`.tbl tr:hover td`): `bg-gray-50/80 dark:bg-slate-800/50`

---

## 3. Component & Layout Fixes (`src/components/layout/Layout.tsx`)

1. **Mobile Bottom Navigation Bar**:
   - Change `<nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 ...">` to:
     `<nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 safe-area-inset-bottom">`
   - Active item: `text-brand-800 dark:text-amber-400`
   - Inactive item: `text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200`
2. **Mobile Header & Desktop Header**:
   - Header container: `bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800`
   - Title & badges text: `text-gray-900 dark:text-white`, `text-gray-600 dark:text-slate-300`

---

## 4. Comprehensive Page Level Color Audit & Dark Mode Support

Every page and modal dialog across `src/pages/*.tsx` and `src/pages/pengurus/*.tsx` will be audited and updated:

### Key Areas & Pages:
1. **Auth & Public Pages**:
   - `LoginPage.tsx`: Card box `dark:bg-slate-900 dark:border-slate-800`, text `dark:text-slate-100`.
   - `RegisterPage.tsx`: Form card & TOS modal `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`.
   - `ChangePasswordPage.tsx`: Form container dark mode classes.

2. **Core Schedules & Swaps**:
   - `JadwalSayaPage.tsx`: Filters, event cards, detail modal, opt-out modal `dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`.
   - `ScheduleDailyPage.tsx`: Event list, slot cards, opt-in banner, PIC links `dark:bg-slate-900 dark:border-slate-800`.
   - `SwapPage.tsx`: Swap request cards, create swap modal, approval modal `dark:bg-slate-900 dark:border-slate-800`.

3. **Attendance & Scan**:
   - `AttendancePage.tsx`: Camera control overlays, scan status alerts, modal cards.
   - `ScanPage.tsx`: Scanner box, member verify card, manual search results.
   - `ScanLatihanPage.tsx` & `ScanRecordsPage.tsx`: History tables, stats cards.

4. **Members & Directory**:
   - `MembersPage.tsx`: Search bar, filter pills, member cards, detail modals.
   - `MemberDetailPage.tsx`: Tab controls, stats, assignment history.
   - `DirectoryPage.tsx`: Directory list, filter dropdowns.
   - `AnalisisPage.tsx`: Chart containers, range selectors, member detail modal.

5. **Growth & Stats**:
   - `MyGrowthPage.tsx`: Quest cards, point history, reflection input box.
   - `PoinKegiatanPage.tsx`: Point summary cards, redeem modal.
   - `RecapPage.tsx` & `StatistikPage.tsx`: Recaps table, tab bar, chart cards.
   - `StreakPage.tsx`: Leaderboard cards, streak badges.
   - `CardsPage.tsx` & `ReregistrationPage.tsx`: Member card preview, reregistration step forms.

6. **Acara & Events**:
   - `AcaraPage.tsx`: Event cards, filter tabs, create event modal, attendee list.

7. **Pengurus Suite (`src/pages/pengurus/*`)**:
   - `KetuaPage.tsx`, `SekretarisPage.tsx`, `BendaharaPage.tsx`, `JasrohPage.tsx`, `MultimediaPage.tsx`, `SakristanPage.tsx`, `PutsankrisPage.tsx`, `NotificationAdminPage.tsx`: All dashboard summary cards, financial transaction modals, item inventory cards, proker tabs, notification forms.

8. **Admin Config**:
   - `AdminPage.tsx`: Sticky table headers, user edit modals, config toggles, reset modals.

---

## 5. Verification Plan

### Automated Testing
- Execute Vitest suite: `npm test` to verify no component or unit logic was broken by class updates.
- Execute Production Build: `npm run build` to verify Tailwind build succeeds without syntax errors.

### Manual Inspection
- Toggle Dark/Light mode using the `DarkModeToggle` button in browser.
- Verify text contrast, modal popups, mobile bottom bar, and tab indicators across pages.
