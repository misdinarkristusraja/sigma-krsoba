# Status Consolidation & Pengurus Divisional Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate member status/roles to eliminate redundancy and build the Pengurus Divisional Suite (`/pengurus/{divisi}`) with dedicated tools for all 8 divisions.

**Architecture:** Create database migration 036 (`00000000000036_divisional_roles_and_status_consolidation.sql`), update `MembersPage.tsx` dropdowns, create `PengurusDashboardLayout.tsx` with role switcher, implement sub-pages for Sekretaris, Bendahara, Jasroh, Multimedia, Sakristan (webcam + watermark), and Putsankris, and push changes to GitHub.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, HTML5 Canvas API, Supabase RLS & Storage, Vitest.

## Global Constraints

- Preserve TypeScript compilation with 0 errors (`npm run lint`).
- Ensure all Vitest unit tests pass (`npm run test`).
- Enforce strict role-based access control: Non-pengurus (Misdinar, Pending, Disabled, Retired) cannot access `/pengurus/*`.
- Automatically commit and push all code changes to GitHub `main` branch upon completion.

---

### Task 1: Database Migration Schema (`00000000000036_divisional_roles_and_status_consolidation.sql`)

**Files:**
- Create: `supabase/migrations/00000000000036_divisional_roles_and_status_consolidation.sql`

- [ ] **Step 1: Write Migration SQL File**

```sql
-- Migration 036: Divisional Roles and Status Consolidation
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS divisi VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status_jadwal VARCHAR(30) DEFAULT 'Siap_Bertugas';

CREATE TABLE IF NOT EXISTS pengurus_sekre_notula (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul        VARCHAR(200) NOT NULL,
  tanggal      DATE NOT NULL,
  peserta      TEXT,
  isi_notula   TEXT NOT NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS pengurus_multimedia_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         VARCHAR(200) NOT NULL,
  platform      VARCHAR(50) NOT NULL,
  target_date   DATE NOT NULL,
  status        VARCHAR(30) CHECK (status IN ('Draft', 'Desain', 'Revisi', 'Published')),
  link_preview  TEXT,
  pj_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengurus_putsankris_checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  checked_items JSONB NOT NULL,
  catatan       TEXT,
  checked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pengurus_sekre_notula ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_sekre_surat ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_multimedia_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_putsankris_checklists ENABLE ROW LEVEL SECURITY;

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

### Task 2: Member Status Consolidation UI (`MembersPage.tsx` & `MemberDetailPage.tsx`)

**Files:**
- Modify: `src/pages/MembersPage.tsx`
- Modify: `src/pages/MemberDetailPage.tsx`

- [ ] **Step 1: Update Members Table & Status Dropdowns**

Consolidate status dropdowns into:
- **System Access Status**: `Aktif (Dapat Login)`, `Pending`, `Disabled`.
- **Status Penjadwalan**: `Siap Bertugas`, `Cuti`, `Suspended`, `Pensiun`.
- **Divisi Pengurus**: `Ketua`, `Sekretaris`, `Bendahara`, `Penjadwalan`, `Jasroh`, `Multimedia`, `Sakristan`, `Putsankris`.

---

### Task 3: Pengurus Suite Layout & Division Switcher (`PengurusDashboardLayout.tsx`)

**Files:**
- Create: `src/pages/pengurus/PengurusDashboardLayout.tsx`

- [ ] **Step 1: Create Layout Component**

Implement division tab switcher header for Ketua, Sekretaris, and Bendahara, with strict route guarding for non-pengurus.

---

### Task 4: Sekretaris & Bendahara Pages (`SekretarisPage.tsx` & `BendaharaPage.tsx`)

**Files:**
- Create: `src/pages/pengurus/SekretarisPage.tsx`
- Create: `src/pages/pengurus/BendaharaPage.tsx`

- [ ] **Step 1: Create Sekretaris Page (Notula & Surat)**
- [ ] **Step 2: Create Bendahara Page (Kas & Keuangan)**

---

### Task 5: Jasroh & Multimedia Pages (`JasrohPage.tsx` & `MultimediaPage.tsx`)

**Files:**
- Create: `src/pages/pengurus/JasrohPage.tsx`
- Create: `src/pages/pengurus/MultimediaPage.tsx`

- [ ] **Step 1: Create Jasroh Page (Acara & Retret Planning)**
- [ ] **Step 2: Create Multimedia Page (Content Pipeline)**

---

### Task 6: Sakristan & Putsankris Pages (`SakristanPage.tsx` & `PutsankrisPage.tsx`)

**Files:**
- Create: `src/pages/pengurus/SakristanPage.tsx`
- Create: `src/pages/pengurus/PutsankrisPage.tsx`

- [ ] **Step 1: Create Sakristan Page with Live Web Cam Canvas Auto-Watermarking**
- [ ] **Step 2: Create Putsankris Page with Liturgical Gear & Vestments Checklist**

---

### Task 7: Routing & Navigation Updates (`App.tsx` & `Layout.tsx`)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Create: `src/lib/__tests__/divisional.test.ts`

- [ ] **Step 1: Update App.tsx with `/pengurus/*` routes**
- [ ] **Step 2: Update Layout.tsx with Pengurus Suite Navigation**
- [ ] **Step 3: Create Unit Test `divisional.test.ts`**

---

### Task 8: Automated Verification & GitHub Push

- [ ] **Step 1: Run `npm run test`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Git Commit & Push to GitHub `main` branch**
