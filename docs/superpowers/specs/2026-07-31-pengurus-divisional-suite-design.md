# Design Spec: Status Consolidation & Pengurus Divisional Suite

**Date:** 2026-07-31  
**Status:** Approved  
**Author:** AI Pair Programmer & User  

---

## 1. Executive Summary & Goals

This specification resolves the redundancy between Member Roles & Status, and builds a dedicated **Pengurus Divisional Suite** under `/pengurus/{divisi}`.

### Key Objectives:
1. **Consolidate Member Status & Roles**:
   - **System Role (`role`)**: `Administrator`, `Pengurus`, `Pendamping`, `Pelatih`, `Misdinar`.
   - **Divisional Role (`divisi`)**: `Ketua`, `Sekretaris`, `Bendahara`, `Penjadwalan`, `Jasroh`, `Multimedia`, `Sakristan`, `Putsankris`.
   - **System Access Status (`status`)**: `Active`, `Pending`, `Disabled`.
   - **Scheduling Eligibility Status (`status_jadwal`)**: `Siap_Bertugas`, `Cuti`, `Suspended`, `Pensiun`.
2. **Pengurus Division Suite (`/pengurus/{divisi}`)**:
   - **Ketua**: Executive Overview & full access to all divisional modules.
   - **Sekretaris**: Meeting Notes (*Notula*) & Letter/Correspondence Archiving (*Arsip Surat*).
   - **Bendahara**: Misdinar Treasury Management (*Kas Misdinar*, Inflow/Outflow, Receipts).
   - **Penjadwalan**: Existing SIGMA auto-assign & swap operations.
   - **Jasmani Rohani (Jasroh)**: Activity & Retreat Planning Registry.
   - **Multimedia**: Content Calendar & Publication Pipeline (*Draft/Desain/Published*).
   - **Sakristan**: Live Web Camera capture with auto-watermarked photo (time + location) for Pengurus/PIC training attendance, plus Pengurus attendance analytics.
   - **Putsankris**: Dynamic Liturgical Equipment & Vestments Checklist with timestamped audit logs per Misa.
3. **Strict Access Guard**:
   - Ketua, Sekretaris, Bendahara have access to ALL `/pengurus/*` routes via a Division Switcher.
   - Other Pengurus can access their respective `/pengurus/{divisi}` route.
   - Non-pengurus (Misdinar, Pending, Disabled, Retired) are strictly blocked with 403 / Redirect.

---

## 2. Database Schema Changes

### Migration `00000000000036_divisional_roles_and_status_consolidation.sql`

```sql
-- 1. Add divisi and status_jadwal columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS divisi VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_jadwal VARCHAR(30) DEFAULT 'Siap_Bertugas';

-- 2. Create pengurus_sekre_notula table
CREATE TABLE IF NOT EXISTS pengurus_sekre_notula (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul        VARCHAR(200) NOT NULL,
  tanggal      DATE NOT NULL,
  peserta      TEXT,
  isi_notula   TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create pengurus_sekre_surat table
CREATE TABLE IF NOT EXISTS pengurus_sekre_surat (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_surat  VARCHAR(100) NOT NULL,
  tipe         VARCHAR(20) CHECK (tipe IN ('Masuk', 'Keluar')),
  perihal      VARCHAR(200) NOT NULL,
  tanggal      DATE NOT NULL,
  file_url     TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create pengurus_kas table
CREATE TABLE IF NOT EXISTS pengurus_kas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe         VARCHAR(10) CHECK (tipe IN ('Pemasukan', 'Pengeluaran')),
  kategori     VARCHAR(50) NOT NULL,
  jumlah       DECIMAL(12,2) NOT NULL,
  keterangan   TEXT NOT NULL,
  bukti_url    TEXT,
  tanggal      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create pengurus_multimedia_content table
CREATE TABLE IF NOT EXISTS pengurus_multimedia_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         VARCHAR(200) NOT NULL,
  platform      VARCHAR(50) NOT NULL, -- e.g. Instagram, TikTok, YouTube
  target_date   DATE NOT NULL,
  status        VARCHAR(30) CHECK (status IN ('Draft', 'Desain', 'Revisi', 'Published')),
  link_preview  TEXT,
  pj_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create pengurus_putsankris_checklists table
CREATE TABLE IF NOT EXISTS pengurus_putsankris_checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  checked_items JSONB NOT NULL, -- { wiruk: true, torch: true, korek: true, arang: true, kipas: true, anglo: true, lentera: true, jubah: true }
  catatan       TEXT,
  checked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Policies for Staff access
ALTER TABLE pengurus_sekre_notula ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_sekre_surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_multimedia_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_putsankris_checklists ENABLE ROW LEVEL SECURITY;

-- Grant access policies to staff roles (Administrator, Pengurus, Pendamping)
CREATE POLICY pengurus_suite_access ON pengurus_sekre_notula FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_surat_access ON pengurus_sekre_surat FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_kas_access ON pengurus_kas FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_content_access ON pengurus_multimedia_content FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));

CREATE POLICY pengurus_putsankris_access ON pengurus_putsankris_checklists FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('Administrator','Pengurus','Pendamping')));
```

---

## 3. UI Components & Pages

1. **`src/pages/pengurus/PengurusDashboardLayout.tsx`**:
   - Shared layout for `/pengurus/*` with Division Switcher tabs for Ketua, Sekretaris, and Bendahara.
2. **`src/pages/pengurus/SekretarisPage.tsx`**:
   - Notula Pertemuan & Surat-menyurat archive manager.
3. **`src/pages/pengurus/BendaharaPage.tsx`**:
   - Cash Inflow/Outflow tracker, category breakdown, balance summary.
4. **`src/pages/pengurus/JasrohPage.tsx`**:
   - Activity & Retreat planner, date, PIC assignment, checklist.
5. **`src/pages/pengurus/MultimediaPage.tsx`**:
   - Content pipeline board & publication calendar.
6. **`src/pages/pengurus/SakristanPage.tsx`**:
   - Web Camera live capture with HTML5 Canvas auto-watermarking (Time + Location) for Pengurus/PIC attendance, plus Pengurus attendance analytics.
7. **`src/pages/pengurus/PutsankrisPage.tsx`**:
   - Interactive Liturgical Gear & Vestments Checklist with logged audit timestamps.
8. **Updated `src/pages/MembersPage.tsx` & `src/pages/MemberDetailPage.tsx`**:
   - Cleaned up Member Status dropdowns:
     - **Web Access Status**: `Aktif (Dapat Login)`, `Pending`, `Disabled`.
     - **Kelayakan Penjadwalan**: `Siap Bertugas`, `Cuti`, `Suspended`, `Pensiun`.
     - **Divisi Pengurus**: `Ketua`, `Sekretaris`, `Bendahara`, `Penjadwalan`, `Jasroh`, `Multimedia`, `Sakristan`, `Putsankris`.

---

## 4. Verification & Commit Plan

- Run `npm run lint` (`tsc --noEmit`) to verify 0 errors.
- Run `npm run test` (Vitest) to verify all tests pass.
- Auto-push to GitHub `main` branch upon clean build.
