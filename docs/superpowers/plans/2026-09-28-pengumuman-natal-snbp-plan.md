# Fitur Pengumuman Penjadwalan Natal Ala SNBP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Membangun portal pengumuman pembagian jadwal tugas Misa Natal ala SNBP dengan hitungan mundur dinamis, getaran/ketegangan visual-audio di bawah 5 menit, form pengecekan nama anggota yang terhubung dengan akun login, sistem kartu hasil ringkas (Selamat vs Tetap Semangat), manajemen input data untuk tim penjadwalan, dan kontrol akses bertahap (Uji Coba Pengurus vs Publik).

**Architecture:** Modul terintegrasi dengan Supabase (`system_config` dan tabel `natal_announcements`), dilengkapi custom Web Audio API synthesizer untuk efek heartbeat/ticking tanpa asset eksternal berat, Framer Motion untuk animasi screen shake dan transisi countdown, serta Hero Banner di Dashboard dan Tab Navigasi Khusus.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS 3, Framer Motion, Lucide React, Supabase Client, Vitest.

## Global Constraints
- Bahasa antarmuka: Bahasa Indonesia yang ramah, sopan, dan formal khas misdinar gereja.
- Salinan kata hasil lolos & tidak lolos harus tepat sesuai permintaan pengguna:
  - Lolos: `"Selamat! {nama lengkap} anda mendapatkan tugas {nama misa & jam}"`
  - Belum lolos: `"Tetap semangat! {nama lengkap} anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!"`
- Jangan menggunakan asset audio binary besar yang membutuhkan download berat; gunakan Web Audio API synthesizer sintetis untuk heartbeat dan click tick.
- Mendukung mode gelap dan terang sesuai konfigurasi Tailwind SIGMA.
- Seluruh kode harus lulus typecheck (`npm run lint` / `tsc --noEmit`) dan tes unit Vitest (`npm test`).

---

### Task 1: Tipe Data TypeScript dan Skema Database Pengumuman Natal

**Files:**
- Create: `supabase/migrations/00000000000041_natal_announcements.sql`
- Modify: `src/types/index.ts`
- Test: `src/lib/__tests__/natalTypes.test.ts`

**Interfaces:**
- Consumes: `src/types/index.ts` (`Profile`, `UserRole`)
- Produces: `NatalAnnouncement`, `NatalConfig`, `NatalStatus` types

- [x] **Step 1: Tulis tes type and helper validation**

```typescript
// src/lib/__tests__/natalTypes.test.ts
import { describe, it, expect } from 'vitest';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('formatNatalAnnouncementMessage', () => {
  it('formats assigned result correctly', () => {
    const res = formatNatalAnnouncementMessage({
      status_tugas: 'assigned',
      nama_lengkap: 'Yohanes Baptista',
      misa_name: 'Malam Natal I',
      jam_tugas: '17:00'
    });
    expect(res.title).toBe('Selamat!');
    expect(res.headline).toBe('Yohanes Baptista anda mendapatkan tugas Malam Natal I 17:00');
  });

  it('formats unassigned result correctly', () => {
    const res = formatNatalAnnouncementMessage({
      status_tugas: 'unassigned',
      nama_lengkap: 'Petrus Agung',
    });
    expect(res.title).toBe('Tetap semangat!');
    expect(res.headline).toContain('anda belum mendapatkan tugas natal Tahun ini!');
  });
});
```

- [x] **Step 2: Jalankan tes untuk memverifikasi kegagalan**

Run: `npx vitest run src/lib/__tests__/natalTypes.test.ts`
Expected: FAIL (module `../natalUtils` not found)

- [x] **Step 3: Tambahkan definisi tipe di `src/types/index.ts` dan buat migration & `src/lib/natalUtils.ts`**

Tambahkan ke `src/types/index.ts`:
```typescript
export type NatalReleaseStatus = 'disabled' | 'trial' | 'published';

export interface NatalAnnouncement {
  id: string;
  user_id?: string | null;
  nama_lengkap: string;
  nama_panggilan: string;
  status_tugas: 'assigned' | 'unassigned';
  misa_name?: string | null;
  tanggal_tugas?: string | null;
  jam_tugas?: string | null;
  lokasi_tugas?: string | null;
  posisi_tugas?: string | null;
  jadwal_latihan?: string | null;
  catatan_khusus?: string | null;
  tahun: number;
  created_at: string;
  updated_at: string;
}

export interface NatalConfig {
  status: NatalReleaseStatus;
  target_time: string;
  title: string;
  allow_search_others: boolean;
}
```

Buat file `src/lib/natalUtils.ts`:
```typescript
import { NatalAnnouncement } from '../types';

export function formatNatalAnnouncementMessage(data: Partial<NatalAnnouncement>) {
  if (data.status_tugas === 'assigned') {
    const jam = data.jam_tugas ? ` ${data.jam_tugas}` : '';
    const misa = data.misa_name ? ` ${data.misa_name}` : '';
    return {
      title: 'Selamat!',
      headline: `${data.nama_lengkap} anda mendapatkan tugas${misa}${jam}`,
      isAssigned: true,
    };
  }
  return {
    title: 'Tetap semangat!',
    headline: `${data.nama_lengkap} anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!`,
    isAssigned: false,
  };
}
```

Buat migrasi SQL `supabase/migrations/00000000000041_natal_announcements.sql`:
```sql
CREATE TABLE IF NOT EXISTS natal_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  nama_lengkap TEXT NOT NULL,
  nama_panggilan TEXT NOT NULL,
  status_tugas TEXT NOT NULL CHECK (status_tugas IN ('assigned', 'unassigned')),
  misa_name TEXT,
  tanggal_tugas DATE,
  jam_tugas TEXT,
  lokasi_tugas TEXT DEFAULT 'Gereja Paroki Kristus Raja',
  posisi_tugas TEXT,
  jadwal_latihan TEXT,
  catatan_khusus TEXT,
  tahun INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_natal_announcements_user_id ON natal_announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_natal_announcements_panggilan ON natal_announcements(lower(nama_panggilan));
CREATE INDEX IF NOT EXISTS idx_natal_announcements_tahun ON natal_announcements(tahun);

-- RLS Policies
ALTER TABLE natal_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view natal announcements"
  ON natal_announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pengurus and Admin can manage natal announcements"
  ON natal_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Administrator', 'Pengurus', 'Pendamping')
    )
  );
```

- [x] **Step 4: Jalankan tes unit untuk memverifikasi kelulusan**

Run: `npx vitest run src/lib/__tests__/natalTypes.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/natalUtils.ts src/lib/__tests__/natalTypes.test.ts supabase/migrations/00000000000041_natal_announcements.sql
git commit -m "feat(natal): add data types, helper utils and supabase migration"
```

---

### Task 2: Web Audio API & Tension State Controller

**Files:**
- Create: `src/lib/audioEffects.ts`
- Create: `src/hooks/useNatalCountdown.ts`
- Test: `src/lib/__tests__/natalCountdown.test.ts`

**Interfaces:**
- Consumes: `NatalConfig`
- Produces: `useNatalCountdown` hook returning `{ timeLeft, isExpired, isUnder5Min, isUnder1Min, isUnder10Sec, tensionLevel }`, `playHeartbeatSFX()`, `playTickSFX()`

- [x] **Step 1: Tulis tes logic countdown dan kalkulasi tension level**

```typescript
// src/lib/__tests__/natalCountdown.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCountdownState } from '../../hooks/useNatalCountdown';

describe('calculateCountdownState', () => {
  it('detects normal state (> 5 minutes)', () => {
    const state = calculateCountdownState(600); // 10 minutes
    expect(state.isUnder5Min).toBe(false);
    expect(state.tensionLevel).toBe('calm');
    expect(state.isExpired).toBe(false);
  });

  it('detects tension level 1 (< 5 minutes)', () => {
    const state = calculateCountdownState(240); // 4 minutes
    expect(state.isUnder5Min).toBe(true);
    expect(state.tensionLevel).toBe('rising');
  });

  it('detects tension level 2 (< 1 minute)', () => {
    const state = calculateCountdownState(45); // 45 seconds
    expect(state.isUnder1Min).toBe(true);
    expect(state.tensionLevel).toBe('critical');
  });

  it('detects climax level (< 10 seconds)', () => {
    const state = calculateCountdownState(5); // 5 seconds
    expect(state.isUnder10Sec).toBe(true);
    expect(state.tensionLevel).toBe('climax');
  });

  it('detects expired (0 seconds)', () => {
    const state = calculateCountdownState(0);
    expect(state.isExpired).toBe(true);
    expect(state.tensionLevel).toBe('reveal');
  });
});
```

- [x] **Step 2: Jalankan tes untuk memverifikasi kegagalan**

Run: `npx vitest run src/lib/__tests__/natalCountdown.test.ts`
Expected: FAIL (`calculateCountdownState` not defined)

- [x] **Step 3: Implementasikan Audio Synthesizer di `src/lib/audioEffects.ts` dan Hook di `src/hooks/useNatalCountdown.ts`**

Buat `src/lib/audioEffects.ts`:
```typescript
class SoundEffectsController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playHeartbeat(urgency: 'low' | 'high' = 'low') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = urgency === 'high' ? 75 : 55;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }
}

export const soundEffects = new SoundEffectsController();
```

Buat `src/hooks/useNatalCountdown.ts`:
```typescript
import { useState, useEffect } from 'react';

export type TensionLevel = 'calm' | 'rising' | 'critical' | 'climax' | 'reveal';

export interface CountdownState {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isUnder5Min: boolean;
  isUnder1Min: boolean;
  isUnder10Sec: boolean;
  isExpired: boolean;
  tensionLevel: TensionLevel;
}

export function calculateCountdownState(diffInSeconds: number): CountdownState {
  const safeDiff = Math.max(0, Math.floor(diffInSeconds));
  const days = Math.floor(safeDiff / (3600 * 24));
  const hours = Math.floor((safeDiff % (3600 * 24)) / 3600);
  const minutes = Math.floor((safeDiff % 3600) / 60);
  const seconds = safeDiff % 60;

  const isExpired = safeDiff <= 0;
  const isUnder10Sec = safeDiff > 0 && safeDiff <= 10;
  const isUnder1Min = safeDiff > 0 && safeDiff <= 60;
  const isUnder5Min = safeDiff > 0 && safeDiff <= 300;

  let tensionLevel: TensionLevel = 'calm';
  if (isExpired) tensionLevel = 'reveal';
  else if (isUnder10Sec) tensionLevel = 'climax';
  else if (isUnder1Min) tensionLevel = 'critical';
  else if (isUnder5Min) tensionLevel = 'rising';

  return {
    totalSeconds: safeDiff,
    days,
    hours,
    minutes,
    seconds,
    isUnder5Min,
    isUnder1Min,
    isUnder10Sec,
    isExpired,
    tensionLevel,
  };
}

export function useNatalCountdown(targetIsoDate: string, bypassCountdown: boolean = false) {
  const [state, setState] = useState<CountdownState>(() => {
    if (bypassCountdown) return calculateCountdownState(0);
    const targetMs = new Date(targetIsoDate).getTime();
    return calculateCountdownState((targetMs - Date.now()) / 1000);
  });

  useEffect(() => {
    if (bypassCountdown) {
      setState(calculateCountdownState(0));
      return;
    }

    const interval = setInterval(() => {
      const targetMs = new Date(targetIsoDate).getTime();
      const diffSec = (targetMs - Date.now()) / 1000;
      setState(calculateCountdownState(diffSec));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIsoDate, bypassCountdown]);

  return state;
}
```

- [x] **Step 4: Jalankan tes unit untuk memverifikasi kelulusan**

Run: `npx vitest run src/lib/__tests__/natalCountdown.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/audioEffects.ts src/hooks/useNatalCountdown.ts src/lib/__tests__/natalCountdown.test.ts
git commit -m "feat(natal): add audio synthesizer and tension countdown hook"
```

---

### Task 3: Komponen Visual Countdown & Shake Effects (< 5 Menit)

**Files:**
- Create: `src/components/natal/NatalCountdownDisplay.tsx`
- Modify: `src/index.css` (tambahkan keyframe getaran layar dramatis)
- Test: Manual visual + unit test timer display

**Interfaces:**
- Consumes: `useNatalCountdown`, `soundEffects`
- Produces: `NatalCountdownDisplay` component with interactive screen shake, audio toggle, and pulse animations

- [x] **Step 1: Tambahkan animasi CSS di `src/index.css`**

Tambahkan ke `src/index.css`:
```css
@keyframes tensionShake {
  0% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-2px, 2px) rotate(-0.5deg); }
  40% { transform: translate(-2px, -2px) rotate(0.5deg); }
  60% { transform: translate(2px, 2px) rotate(0deg); }
  80% { transform: translate(2px, -2px) rotate(0.5deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes climaxShake {
  0% { transform: translate(0, 0) rotate(0deg) scale(1); }
  15% { transform: translate(-4px, 3px) rotate(-1.5deg) scale(1.01); }
  30% { transform: translate(4px, -3px) rotate(1.5deg) scale(1.02); }
  45% { transform: translate(-5px, -2px) rotate(-1deg) scale(1.01); }
  60% { transform: translate(5px, 2px) rotate(1deg) scale(1.02); }
  75% { transform: translate(-3px, 4px) rotate(-0.5deg) scale(1.01); }
  100% { transform: translate(0, 0) rotate(0deg) scale(1); }
}

.animate-tension-rising {
  animation: tensionShake 1.8s infinite ease-in-out;
}

.animate-tension-critical {
  animation: tensionShake 0.6s infinite ease-in-out;
}

.animate-tension-climax {
  animation: climaxShake 0.25s infinite ease-in-out;
}
```

- [x] **Step 2: Buat komponen `src/components/natal/NatalCountdownDisplay.tsx`**

Implementasikan komponen lengkap:
- Kotak timer: Hari, Jam, Menit, Detik dengan border gradient.
- Tombol Mute / Unmute untuk detak jantung dan jam ticking.
- Indikator peringatan "WAKTU KURANG DARI 5 MENIT - SIAPKAN DIRI ANDA!".
- Integrasi audio otomatis memicu `soundEffects.playHeartbeat()` setiap detik saat < 1 menit dan tick saat < 10 detik jika tidak di-mute.

- [x] **Step 3: Verifikasi build & typecheck**

Run: `npm run lint`
Expected: PASS tanpa error TypeScript

- [x] **Step 4: Commit**

```bash
git add src/index.css src/components/natal/NatalCountdownDisplay.tsx
git commit -m "feat(natal): add dynamic countdown display with tension shake and heartbeat sfx"
```

---

### Task 4: Komponen Hasil Pengumuman Ala SNBP (Lolos vs Belum Lolos)

**Files:**
- Create: `src/components/natal/NatalResultCard.tsx`
- Create: `src/components/natal/NatalSearchModal.tsx`
- Test: `src/lib/__tests__/natalResult.test.ts`

**Interfaces:**
- Consumes: `NatalAnnouncement`, `Profile`
- Produces: `NatalResultCard` (Banner pop-up ringkas & bersih), `NatalSearchModal`

- [x] **Step 1: Tulis tes logic render data hasil**

```typescript
// src/lib/__tests__/natalResult.test.ts
import { describe, it, expect } from 'vitest';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('Natal Announcement Card Logic', () => {
  it('correctly maps misa and latihan details for assigned member', () => {
    const announcement = {
      nama_lengkap: 'Theresia Avilla',
      nama_panggilan: 'Theresia',
      status_tugas: 'assigned' as const,
      misa_name: 'Malam Natal I',
      jam_tugas: '17:00',
      posisi_tugas: 'Lentera 1',
      jadwal_latihan: '21 Des 2026, 10:00 WIB',
      catatan_khusus: 'Hadir 30 menit sebelum misa',
      tahun: 2026
    };
    const formatted = formatNatalAnnouncementMessage(announcement);
    expect(formatted.isAssigned).toBe(true);
    expect(formatted.headline).toContain('Theresia Avilla anda mendapatkan tugas Malam Natal I 17:00');
  });
});
```

- [x] **Step 2: Jalankan tes**

Run: `npx vitest run src/lib/__tests__/natalResult.test.ts`
Expected: PASS

- [x] **Step 3: Buat `src/components/natal/NatalResultCard.tsx`**

Desain ringkas, bersih, dan berwibawa:
- Header resmi: MISDINAR KRISTUS RAJA SURAKARTA / SOLO BARU
- **Varian Assigned (Lolos)**:
  - Background: Emerald Green gradasi Navy elegan dengan aksen emas natal.
  - Teks:
    - `"Selamat!"` (Font tebal, mencolok).
    - `"{nama_lengkap}"` (Badge nama).
    - `"anda mendapatkan tugas {misa_name} {jam_tugas}"`.
  - Detail: Posisi tugas, Jadwal latihan, dan Catatan khusus.
  - Efek konfeti Framer Motion kecil saat kartu terbuka.
- **Varian Unassigned (Belum Lolos)**:
  - Background: Coral Red gradasi Maroon hangat & khidmat.
  - Teks:
    - `"Tetap semangat!"`
    - `"{nama_lengkap}"`
    - `"anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!"`
  - Pesan peneguhan rohani misdinar.
- Tombol: "Tutup Pengumuman" dan (opsional) "Cari Anggota Lain".

- [x] **Step 4: Commit**

```bash
git add src/components/natal/NatalResultCard.tsx src/lib/__tests__/natalResult.test.ts
git commit -m "feat(natal): add snbp-style result cards for assigned and unassigned members"
```

---

### Task 5: Halaman Utama Pengumuman Natal (`/pengumuman-natal`) & Hero Banner Dashboard

**Files:**
- Create: `src/pages/NatalAnnouncementPage.tsx`
- Create: `src/components/natal/NatalHeroBanner.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useNatalCountdown`, `useAuth`, `NatalAnnouncement`, `NatalConfig`
- Produces: Integrated Natal Announcement route and dashboard trigger banner

- [x] **Step 1: Buat hook fetch data pengumuman `src/hooks/useNatalAnnouncement.ts`**

Hook untuk mengambil konfigurasi `system_config` (`natal_announcement_status`, `natal_announcement_target_time`, dll.) dan mencari baris `natal_announcements` untuk user saat ini / pencarian nama.

- [x] **Step 2: Buat `src/components/natal/NatalHeroBanner.tsx`**

Banner mencolok di bagian atas Dashboard SIGMA:
- Jika status `'disabled'`, return null.
- Jika status `'trial'` dan user bukan Pengurus/Admin, return null.
- Menampilkan countdown dinamis menuju hari pengumuman.
- Jika countdown selesai (atau mode bypass aktif), banner berubah menjadi tombol: **"Buka Pengumuman Natal Anda ✨"**.
- Tombol mengarahkan ke `/pengumuman-natal`.

- [x] **Step 3: Buat `src/pages/NatalAnnouncementPage.tsx`**

Halaman penuh dengan:
- Mode Countdown: Timer besar, efek deg-degan, audio heartbeat, dan visual natal.
- Mode Reveal: Kotak input nama anggota (otomatis terisi nama user yang sedang login), tombol suspense **"Buka Pengumuman"**, dan modal hasil `NatalResultCard`.
- Tombol simulasi **"⚡ Bypass Countdown (Khusus Pengurus)"** jika user adalah Pengurus/Admin.

- [x] **Step 4: Pasang rute di `src/App.tsx`, menu di `src/components/layout/Layout.tsx`, dan Hero Banner di `src/pages/DashboardPage.tsx`**

- Tambahkan route `/pengumuman-natal` di `src/App.tsx`.
- Tambahkan NavItem "Pengumuman Natal" di grup `jadwal` pada `src/components/layout/Layout.tsx` (dengan kontrol role trial).
- Tempatkan `<NatalHeroBanner />` di `src/pages/DashboardPage.tsx` di atas greeting/kartu statistik.

- [x] **Step 5: Verifikasi typecheck dan tes aplikasi**

Run: `npm run lint` && `npm test`
Expected: PASS tanpa error

- [x] **Step 6: Commit**

```bash
git add src/pages/NatalAnnouncementPage.tsx src/components/natal/NatalHeroBanner.tsx src/hooks/useNatalAnnouncement.ts src/pages/DashboardPage.tsx src/components/layout/Layout.tsx src/App.tsx
git commit -m "feat(natal): integrate natal announcement page, routes, layout nav, and dashboard banner"
```

---

### Task 6: Tab Khusus Manajemen Penjadwalan Natal Pengurus (`/pengurus/penjadwalan-natal`)

**Files:**
- Create: `src/pages/pengurus/NatalScheduleAdminPage.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Supabase `natal_announcements` & `system_config`
- Produces: Management UI for scheduling team to input names, mass slots, dates, rehearsal notes, mark unassigned members, and configure countdown timer

- [x] **Step 1: Buat halaman `src/pages/pengurus/NatalScheduleAdminPage.tsx`**

Fitur tim penjadwalan:
1. **Konfigurasi Rilis**:
   - Status Pengumuman: Radio (Nonaktif, Uji Coba Pengurus, Publik).
   - Waktu Pengumuman: Input DateTime-Local.
   - Izinkan Cari Anggota Lain: Switch (Ya/Tidak).
2. **Input Penugasan Misa**:
   - Form input: Pilih Nama Anggota (autocomplete dari `users`), Pilih Misa (Malam Natal I, II, Natal Pagi, dll.), Jam Tugas, Posisi, Catatan Latihan.
   - Tombol Simpan Tugas.
3. **Daftar & Tabel Penugasan**:
   - Filter per Misa.
   - Edit / Hapus baris penugasan.
4. **Alat Massal (Batch Tools)**:
   - Tombol **"Generate Status 'Tetap Semangat' untuk Anggota yang Belum Bertugas"**: Secara otomatis memasukkan seluruh misdinar aktif lainnya dengan status `unassigned`.
   - Tombol **"Sinkronisasi dari Modul Misa Besar SIGMA"**: Menarik data otomatis dari penugasan `events` natal jika sudah dibuat.

- [x] **Step 2: Daftarkan rute `/pengurus/penjadwalan-natal` di `App.tsx` dan Layout**

Tambahkan rute di sub-rute pengurus dan tambahkan di NAV_GROUPS Pengurus Suite: `{ icon: Calendar, label: 'Jadwal Misa Natal', path: '/pengurus/penjadwalan-natal', roles: PENG }`.

- [x] **Step 3: Jalankan verifikasi linting & tes**

Run: `npm run lint` && `npm test`
Expected: PASS tanpa error

- [x] **Step 4: Commit**

```bash
git add src/pages/pengurus/NatalScheduleAdminPage.tsx src/App.tsx src/components/layout/Layout.tsx
git commit -m "feat(natal): add scheduling team management portal for christmas mass announcements"
```

---

### Task 7: Verifikasi Menyeluruh & Testing Alur Lengkap

**Files:**
- Test: `src/lib/__tests__/natalFullFlow.test.ts`
- E2E / Browser check jika dev server berjalan

- [x] **Step 1: Tulis tes integrasi unit alur verifikasi data**

```typescript
// src/lib/__tests__/natalFullFlow.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCountdownState } from '../../hooks/useNatalCountdown';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('Full Natal Announcement Flow Verification', () => {
  it('handles complete transition from countdown to reveal message', () => {
    // 1. Countdown reaching 0
    const state = calculateCountdownState(0);
    expect(state.isExpired).toBe(true);

    // 2. Member checks result
    const msg = formatNatalAnnouncementMessage({
      status_tugas: 'assigned',
      nama_lengkap: 'Gabriel Michael',
      misa_name: 'Misa Fajar Natal',
      jam_tugas: '06:00'
    });
    expect(msg.title).toBe('Selamat!');
    expect(msg.headline).toBe('Gabriel Michael anda mendapatkan tugas Misa Fajar Natal 06:00');
  });
});
```

- [x] **Step 2: Jalankan seluruh suite tes**

Run: `npm test`
Expected: ALL PASS

- [x] **Step 3: Jalankan build produksi untuk memvalidasi tidak ada syntax/import error**

Run: `npm run build`
Expected: Vite build succeeds cleanly without bundle or type errors.

- [x] **Step 4: Commit final**

```bash
git add src/lib/__tests__/natalFullFlow.test.ts
git commit -m "test(natal): add full flow integration tests and verify production build"
```
