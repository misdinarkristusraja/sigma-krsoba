# SIGMA — Rencana Rebuild
**Sistem Informasi Penjadwalan & Manajemen Misdinar**  
Paroki Kristus Raja Solo Baru

---

## Analisis Repo Existing
https://github.com/theoutom/sigma-test LINK REPO

### Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Routing | React Router v6 (lazy + Suspense) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Deploy | Vercel + PWA (vite-plugin-pwa) |
| Export | jsPDF · html-to-image · xlsx · qrcode · jsqr |
| Charts | Recharts |
| Notif | react-hot-toast |

### Struktur File
```
src/
  App.jsx              # Routes + ProtectedRoute
  contexts/
    AuthContext.jsx    # user, profile, role, signIn, signOut
  components/
    layout/Layout.jsx  # Sidebar nav (role-filtered) + NotificationBell
    ui/               # ErrorBoundary, LoadingScreen, NotificationBell
  pages/              # 18 halaman (10k+ baris total)
  lib/
    supabase.js
    utils.js
    liturgiData2026.js
    calendarExport.js
supabase/
  migrations/         # 1 consolidated SQL (menggantikan 001-023)
```

### Halaman & Role Access
| Route | Akses | Kompleksitas |
|---|---|---|
| `/login`, `/daftar`, `/jadwal` | Public | Rendah |
| `/dashboard` | Semua | Sedang |
| `/jadwal-harian` | Semua | Sedang |
| `/tukar-jadwal` | Semua | Tinggi |
| `/rekap` | Semua | Sedang |
| `/kartu` | Semua | Rendah |
| `/daftar-ulang` | Semua | Rendah |
| `/streak` | Semua | Rendah |
| `/anggota`, `/anggota/:id` | Pelatih+ | Sedang |
| `/scan-qr` | Pelatih+ | Tinggi (kamera + jsqr) |
| `/riwayat-scan` | Pelatih+ | Sedang |
| `/jadwal-mingguan` | Pengurus+ | **Sangat Tinggi (2075 baris!)** |
| `/statistik` | Pengurus+ | Tinggi |
| `/laporan` | Pengurus+ | Tinggi |
| `/admin` | Admin | Sedang |
| `/migrasi` | Admin | Sedang |
| `/ganti-password` | User login | Rendah |

### Database Entities Utama
- `users` — profil anggota misdinar (role, status, poin, foto)
- `registrations` — pendaftaran baru (approval flow)
- `events` — jadwal misa/latihan (tipe, warna liturgi, tanggal)
- `scan_records` — absensi via QR
- `swap_requests` — tukar jadwal (status: Pending → Approved/Rejected)
- `reregistrations` — daftar ulang periodik
- `rekap_poin_mingguan` — view/table poin per minggu
- `system_config` — feature flags (e.g. `migration_enabled`)

### Issues di Kode Lama (Tercatat di Comments)
- BUG-005: `/anggota/:id` tidak ada role guard → data sensitif bisa diakses
- BUG-006: profile error beri role default → akun Pending bisa masuk
- 150ms delay workaround untuk JWT propagation ke RLS
- `ScheduleWeeklyPage` 2075 baris — God Component perlu dipecah

---

## Rencana Rebuild

### Prinsip
1. **Modular** — God Component dipecah jadi composable hooks + small components
2. **Type-safe** — migrasi ke TypeScript
3. **Test-able** — logic dipisah dari JSX
4. **Same stack** — tetap React + Supabase + Tailwind (tidak ganti)
5. **Backward-compatible DB** — skema tetap, tidak migrat ulang

---

### FASE 1 — Setup & Fondasi (Prioritas Tertinggi)

#### 1.1 TypeScript Migration
- Rename `.jsx` → `.tsx`, `.js` → `.ts`
- Buat `types/` folder:
  ```ts
  // types/index.ts
  type UserRole = 'Administrator' | 'Pengurus' | 'Pelatih' | 'Misdinar_Aktif' | 'Misdinar_Retired'
  type UserStatus = 'Active' | 'Pending' | 'Retired' | 'Suspended'
  type EventType = 'Mingguan' | 'Jumper' | 'Sabtu_Imam' | 'Misa_Khusus' | 'Misa_Harian' | 'Latihan'
  type SwapStatus = 'Pending' | 'Approved_PIC' | 'Rejected_PIC' | 'Replaced' | 'Offered' | 'Expired'
  
  interface Profile { id: string; nickname: string; nama_panggilan: string; role: UserRole; ... }
  interface Event { id: string; nama_event: string; tipe_event: EventType; tanggal_tugas: string; ... }
  ```

#### 1.2 Custom Hooks (pisah logic dari JSX)
```
src/hooks/
  useProfile.ts           # extract dari AuthContext
  useEvents.ts            # upcoming events
  useSwapRequests.ts      # swap board
  useSchedule.ts          # jadwal harian/mingguan
  useScanRecords.ts       # riwayat scan
  useMemberStats.ts       # poin, streak, rekap
  useOptinWindow.ts       # opt-in check
```

Contoh pattern:
```ts
// hooks/useEvents.ts
export function useEvents(limit = 3) {
  const [data, setData] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('events')
      .select('...')
      .gte('tanggal_tugas', today)
      .limit(limit)
      .then(({ data, error }) => { ... })
      .finally(() => setLoading(false))
  }, [limit])
  
  return { data, loading, error }
}
```

#### 1.3 Pemecahan ScheduleWeeklyPage (2075 baris)
Pecah jadi:
```
pages/schedule/
  ScheduleWeeklyPage.tsx    # <200 baris (orchestrator only)
  components/

    WeekSelector.tsx         # navigasi minggu
    EventCard.tsx            # satu event card
    AssignmentMatrix.tsx     # tabel anggota vs posisi
    OptinPanel.tsx           # panel opt-in anggota
    SwapApprovalModal.tsx    # modal approve/reject swap
    AutoAssignButton.tsx     # trigger auto-assign
    ExportToolbar.tsx        # PDF + ICS export
  hooks/
    useWeeklySchedule.ts     # data fetch + state
    useAutoAssign.ts         # algoritma auto-assign
    useSwapApproval.ts       # swap approval flow
```

#### 1.4 Supabase Client Typed
```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
export const supabase = createClient<Database>(url, key)
```
Generate `database.types.ts` dari Supabase CLI: `supabase gen types typescript`

---

### FASE 2 — UI/UX Improvements

#### 2.1 Design System
Buat `components/ui/` lebih lengkap:
```
components/ui/
  Button.tsx         # variant: primary, ghost, danger
  Input.tsx          # dengan label + error state
  Modal.tsx          # reusable modal
  Badge.tsx          # role + status badges
  Skeleton.tsx       # loading skeleton
  EmptyState.tsx     # kosong state dengan ilustrasi
  DataTable.tsx      # sortable table (gantikan tabel manual)
  Toast.tsx          # wrapper react-hot-toast
  LiturgyBadge.tsx   # warna liturgi (sudah ada di utils)
  QrScanner.tsx      # wrap jsqr logic
```

#### 2.2 Dashboard Redesign
- Widget cards dengan stat number besar
- Mini chart poin 8 minggu (pakai Recharts area chart)
- Quick action buttons (scan, tukar, rekap)
- Event countdown untuk jadwal terdekat

#### 2.3 Mobile-First Fixes
- Sidebar → bottom tab bar di mobile (`md:hidden`)
- Swipe gesture untuk tutup sidebar
- QR scanner full-screen di mobile
- Kartu anggota responsif (bisa di-share/download)

---

### FASE 3 — Feature Additions

#### 3.1 Push Notifications (PWA)
- Service worker sudah ada (vite-plugin-pwa)
- Tambah Web Push API
- Notif: jadwal baru, swap approved/rejected, opt-in window buka

#### 3.2 Offline Support
- Cache jadwal harian untuk offline read
- Queue scan QR saat offline → sync saat online
- `IndexedDB` via `idb` library

#### 3.3 Scan QR Enhancement
- **Multi-scan mode**: scan berturut-turut tanpa tutup kamera
- Beep + vibrate feedback saat scan sukses
- Fallback input manual jika kamera tidak tersedia
- History scan real-time update

#### 3.4 Analytics Dashboard (StatistikPage)
- Kehadiran per bulan (bar chart)
- Top 10 leaderboard streak
- Heatmap aktivitas (kalender view)
- Filter per lingkungan / pendidikan

#### 3.5 Export Improvements
- PDF kartu anggota batch (semua anggota sekaligus)
- Excel rekap dengan format yang lebih rapi
- ICS export per-anggota (bukan hanya per-event)

---

### FASE 4 — Security & Performance

#### 4.1 RLS Audit
- Review semua policy per tabel
- Pastikan data sensitif (hp_ortu, alamat) hanya Administrator/Pengurus
- Add `security_invoker` ke semua views

#### 4.2 Rate Limiting
- Tambah rate limit di `get_email_by_nickname` RPC (prevent username enumeration)
- Tambah CAPTCHA di `/daftar` untuk cegah spam registrasi

#### 4.3 Performance
- `React.memo` untuk komponen berat (AssignmentMatrix)
- Virtualized list untuk `/anggota` (bisa ratusan anggota)
- Pagination cursor-based di scan records
- Supabase Realtime hanya subscribe channel yang dibutuhkan

#### 4.4 Error Handling
- Replace console.error dengan proper error tracking (Sentry)
- Retry logic untuk network failures
- Optimistic updates untuk swap request

---

### FASE 5 — Testing

```
tests/
  unit/
    hooks/useSchedule.test.ts
    hooks/useSwapRequests.test.ts
    lib/utils.test.ts
    lib/calendarExport.test.ts
  integration/
    auth.test.ts           # login flow
    schedule.test.ts       # CRUD events
    swap.test.ts           # swap workflow
  e2e/ (Playwright)
    login.spec.ts
    scan-qr.spec.ts
    schedule-weekly.spec.ts
```

---

## Urutan Pengerjaan (Priority Stack)

```
1. [KRITIS] TypeScript setup + database.types.ts
2. [KRITIS] Extract hooks dari ScheduleWeeklyPage
3. [TINGGI] Pecah ScheduleWeeklyPage jadi komponen kecil
4. [TINGGI] Design system components (Button, Input, Modal, DataTable)
5. [TINGGI] RLS security audit
6. [SEDANG] Dashboard redesign + mobile-first fixes
7. [SEDANG] Multi-scan QR + offline queue
8. [SEDANG] Push notifications
9. [RENDAH] E2E tests
10. [RENDAH] Analytics heatmap
```

---

## File Yang Tidak Perlu Diubah
- `supabase/migrations/` — DB sudah solid
- `src/lib/liturgiData2026.js` — data statis, cukup rename ke .ts
- `vite.config.js` — konfigurasi sudah baik
- `tailwind.config.js` — sudah ada custom colors
- `vercel.json` — deploy config sudah benar

---

*Dokumen ini adalah living plan — update setiap fase selesai.*
