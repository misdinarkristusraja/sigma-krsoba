# Design Specification: Fitur Pengumuman Penjadwalan Natal Ala SNBP di SIGMA

- **Tanggal**: 28 September 2026
- **Status**: Proposed / Approved by User via Grill-Me
- **Target Aplikasi**: SIGMA (Sistem Informasi & Manajemen Misdinar Kristus Raja)

---

## 1. Latar Belakang & Tujuan
Menghadirkan pengalaman pengumuman tugas Misa Natal yang berkesan, transparan, dan mendebarkan seperti pengumuman kelulusan SNBP (Seleksi Nasional Berdasarkan Prestasi). Fitur ini memiliki hitungan mundur (*countdown*), efek dramatis ketika waktu mendekati 0 (< 5 menit), sistem input jadwal khusus untuk tim penjadwalan/pengurus, serta mekanisme uji coba (*trial*) bertahap sebelum dirilis ke seluruh anggota misdinar.

---

## 2. Arsitektur & Model Data

### 2.1 Konfigurasi Sistem (`system_config`)
Menggunakan tabel `system_config` yang sudah ada untuk fleksibilitas tanpa perlu migrasi rumit:
- `natal_announcement_status`: `'disabled'` | `'trial'` | `'published'`
  - `disabled`: Fitur tidak terlihat oleh siapapun.
  - `trial`: Hanya terlihat dan bisa diakses oleh role `Administrator`, `Pengurus`, dan `Pendamping` untuk pengujian.
  - `published`: Terlihat untuk seluruh anggota misdinar aktif.
- `natal_announcement_target_time`: ISO string timestamp (contoh: `2026-12-20T19:00:00+07:00`) kapan countdown berakhir dan gerbang pengumuman dibuka secara resmi.
- `natal_announcement_title`: Judul pengumuman (default: "Pengumuman Penjadwalan Tugas Misa Natal 2026").
- `natal_announcement_allow_search_others`: Boolean string `'true'` | `'false'` (apakah anggota boleh mencari jadwal teman/orang lain).

### 2.2 Tabel Data Pengumuman (`natal_announcements`)
Tabel khusus untuk menampung data penugasan Misa Natal & Misa Besar:
```sql
CREATE TABLE IF NOT EXISTS natal_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nama_lengkap TEXT NOT NULL,
  nama_panggilan TEXT NOT NULL,
  status_tugas TEXT NOT NULL CHECK (status_tugas IN ('assigned', 'unassigned')),
  misa_name TEXT,            -- Contoh: "Malam Natal I"
  tanggal_tugas DATE,        -- Contoh: '2026-12-24'
  jam_tugas TEXT,            -- Contoh: '17:00'
  lokasi_tugas TEXT,         -- Contoh: 'Gereja Utama'
  posisi_tugas TEXT,         -- Contoh: 'Lentera / Dupa / Salib'
  jadwal_latihan TEXT,       -- Contoh: 'Minggu, 21 Des 2026 - Pk 10.00 WIB'
  catatan_khusus TEXT,       -- Catatan dresscode/kehadiran
  tahun INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pencarian cepat
CREATE INDEX idx_natal_announcements_user_id ON natal_announcements(user_id);
CREATE INDEX idx_natal_announcements_panggilan ON natal_announcements(lower(nama_panggilan));
CREATE INDEX idx_natal_announcements_tahun ON natal_announcements(tahun);
```

> **Catatan Sinkronisasi**: Tim penjadwalan dapat menginput langsung per baris, import via CSV/paste nama, atau menekan tombol **"Sinkronisasi dari Misa Besar SIGMA"** untuk menarik penugasan yang sudah ada di tabel `events` dan `assignments`.

---

## 3. Alur Pengalaman Pengguna (User Flow)

### 3.1 Fase Countdown (Sebelum Waktu Pengumuman)
1. **Penempatan di Dashboard**:
   - Terdapat **Hero Banner Countdown Natal** di bagian atas Dashboard SIGMA.
   - Badge waktu hitungan mundur (Hari : Jam : Menit : Detik).
2. **Navigasi Tab**:
   - Menu baru **"Pengumuman Natal"** pada sidebar desktop dan bottom bar mobile (dengan indikator status).
3. **Efek Deg-degan & Ketegangan (< 5 Menit Terakhir)**:
   - **Tingkat 1 (> 5 Menit)**: Tampilan countdown elegan, nuansa natal biru-emas dingin yang damai.
   - **Tingkat 2 (5 Menit - 1 Menit)**:
     - Border kartu berdenyut (*subtle pulse*) merah-emas.
     - Jitter/getar halus pada elemen detik.
     - Suara detak jantung halus (*heartbeat SFX*) & suara jam berdetak (*ticking clock*), dilengkapi tombol **Mute / Unmute** yang jelas di pojok atas.
   - **Tingkat 3 (1 Menit - 10 Detik)**:
     - Efek getaran kamera layar (*camera shake*) makin terasa bertahap.
     - Warna background berdenyut lebih cepat mengikuti ritme BPM detak jantung.
     - Alert banner: *"SIAPKAN DIRI ANDA! WAKTU PENGUMUMAN SEGERA TIBA!"*.
   - **Tingkat 4 (10 Detik Terakhir)**:
     - Layar fokus / dramatis, angka countdown membesar di tengah layar dengan efek haptic/pulse.
     - Bunyi hitungan mundur final.
4. **Fase Nol (00:00:00)**:
   - Layar bertransisi dramatis ke pintu gerbang pengumuman (*Reveal Gate*).

### 3.2 Fase Buka Pengumuman (Setelah Countdown Selesai)
1. **Pengecekan Nama**:
   - Input nama otomatis terisi dengan nama user yang sedang login (`profile.nama_lengkap` & `profile.nama_panggilan`).
   - Tombol utama yang mendebarkan: **"Buka Hasil Pengumuman"**.
   - Jika opsi pencarian teman diaktifkan pengurus, terdapat tab alternatif: **"Cari Anggota Lain"** dengan input auto-complete nama panggilan.
2. **Hasil Pengumuman Ala SNBP (Ringkas, Bersih, Berwibawa)**:
   - **Jika Mendapat Tugas (Status: Assigned / "Lolos")**:
     - Tema: **SNBP Emerald Green & Royal Navy** dengan semburan konfeti (*confetti burst*).
     - Header resmi: **"MISDINAR KRISTUS RAJA - PENGUMUMAN PENUGASAN NATAL"**.
     - Teks Utama:
       > **Selamat!**
       > **{nama lengkap}**
       > Anda mendapatkan tugas **{nama misa}** ({jam tugas} WIB)
     - Rincian ringkas:
       - Posisi Tugas: *{posisi_tugas}*
       - Jadwal Latihan: *{jadwal_latihan}*
       - Catatan: *{catatan_khusus}*
   - **Jika Belum Mendapat Tugas (Status: Unassigned / "Tetap Semangat")**:
     - Tema: **SNBP Coral Red & Warm Slate** yang tenang dan menghibur.
     - Header resmi: **"MISDINAR KRISTUS RAJA"**.
     - Teks Utama:
       > **Tetap semangat!**
       > **{nama lengkap}**
       > Anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!
     - Kutipan ayat penyemangat: *"Layanilah seorang akan yang lain, sesuai dengan karunia yang telah diperoleh tiap-tiap orang sebagai pengurus yang baik dari kasih karunia Allah." (1 Petrus 4:10)*

---

## 4. Akses Uji Coba (Pengurus vs Anggota) & Pengaturan Admin

### 4.1 Kontrol Rilis di Admin Config (`/admin` atau `/pengurus/penjadwalan`)
Admin/Pengurus dapat memilih dari 3 status:
1. **Nonaktif**: Fitur disembunyikan sama sekali dari navigasi dan dashboard.
2. **Uji Coba (Pengurus Only)**:
   - Hanya user dengan role `Administrator`, `Pengurus`, atau `Pendamping` yang melihat tab dan banner.
   - Anggota biasa (`Misdinar_Aktif`) tidak akan melihat fitur ini.
   - Dilengkapi tombol **"⚡ Preview & Bypass Countdown (Mode Simulasi)"** agar pengurus dapat melihat tampilan hasil tanpa harus memajukan jam server.
3. **Publik (Semua Anggota)**:
   - Terbuka untuk seluruh user yang login di SIGMA.

---

## 5. Portal Input Tim Penjadwalan (`/pengurus/penjadwalan-natal`)
Fitur khusus tim penjadwalan untuk mengelola pengumuman:
1. **Form Input Cepat**:
   - Pilih nama anggota dari database aktif (atau ketik nama panggilan/lengkap).
   - Pilih Misa Natal (Malam Natal I, Malam Natal II, Natal Fajar, Natal Pagi, Natal Sore, dll.).
   - Isi Jam, Posisi/Peran, dan Catatan Latihan.
2. **Batch / Mass Input**:
   - Input cepat per baris atau copy-paste daftar nama per misa.
3. **Tombol "Tandai Anggota Lain Belum Bertugas"**:
   - Secara otomatis menghasilkan status `unassigned` bagi seluruh misdinar aktif yang tidak terdaftar di misa manapun, sehingga saat mereka mengecek nama, pesan "Tetap semangat!" langsung muncul sesuai nama mereka.
4. **Sinkronisasi Otomatis**:
   - Opsi satu klik: Tarik data dari modul Misa Besar SIGMA jika jadwal sudah dibuat di sistem penjadwalan.

---

## 6. Komponen & Arsitektur Frontend
- `src/components/natal/NatalHeroBanner.tsx`: Banner ringkas untuk Dashboard dengan countdown realtime.
- `src/components/natal/NatalCountdownDisplay.tsx`: Tampilan timer visual, getar dinamis (<5 mnt), audio synthesizer/ticking SFX, dan tombol mute.
- `src/components/natal/NatalResultCard.tsx`: Tampilan hasil SNBP style (Hijau Selamat / Merah Tetap Semangat).
- `src/pages/NatalAnnouncementPage.tsx`: Halaman lengkap portal pengumuman natal.
- `src/pages/pengurus/NatalScheduleAdminPage.tsx`: Tab khusus tim penjadwalan untuk input nama & konfigurasi tanggal.
- `src/hooks/useNatalAnnouncement.ts`: Hook untuk membaca konfigurasi, menghitung waktu mundur, dan query status penugasan.
- `src/lib/audioEffects.ts`: Web Audio API synthesizer ringan untuk detak jantung & clock tick (tanpa dependensi file mp3 eksternal yang besar/lambat dimuat).
