# Desain Sistem Penjadwalan Misa Besar (Natal & Pekan Suci)

**Tanggal:** 2 September 2026  
**Status:** Approved  
**Topik:** Penjadwalan Otomatis Rangkaian Misa Besar berbasis Skor Keaktifan (K-Score), Komposisi Jenjang, & Manajemen Gladi Bersih

---

## 1. Latar Belakang & Masalah
Pada perayaan liturgi besar (seperti Rangkaian Natal dan Pekan Suci), kebutuhan penjadwalan misdinar memiliki karakteristik khusus yang berbeda dari Misa Mingguan reguler:
1. **Prioritas Alokasi Berbasis Keaktifan (K-Score)**: Anggota dengan rekam jejak tugas dan kehadiran terbaik (akumulasi kondisi $K$) berhak mendapatkan prioritas bertugas pada misa-misa utama/paling sakral (misal: Malam Natal I/II, Vigili Paskah I/II, Kamis Putih).
2. **Kebutuhan Kuota Petugas Dinamis**: Jumlah misdinar per misa pada Misa Besar bervariasi (misal: 10–12 petugas untuk Misa Pontifikal/Utama, 6–8 untuk Misa Siang) dan tidak terpaku pada angka tetap.
3. **Aturan Multi-Penugasan (Multi-Duty) Pekan Suci**: Berbeda dari Natal di mana 1 anak umumnya bertugas 1 kali agar merata, pada Pekan Suci 1 anak dapat bertugas hingga 2 kali dengan syarat tidak terjadi bentrok hari/misa yang melelahkan (misal jeda waktu yang cukup).
4. **Komposisi Seimbang Senior & Junior**: Misa besar menuntut kepemimpinan liturgis yang baik, sehingga tiap slot harus memiliki perpaduan seimbang antara kelompok Senior (SMA/SMK/Lulus) dan Junior (SD/SMP).
5. **Manajemen Latihan Khusus (Gladi Bersih)**: Misa besar memerlukan sesi latihan khusus dengan jadwal, waktu, lokasi, dan absensi tersendiri yang terhubung langsung dengan sistem rekap poin.

---

## 2. Arsitektur & Logika Sistem (Allocation Engine)

### 2.1 Formula Perhitungan Skor K (K-Score)
Skor keaktifan dihitung dari rekam jejak `rekap_poin_mingguan` dan `scan_records` dalam rentang waktu evaluasi (cut-off period, misal 3–6 bulan terakhir):
$$\text{Total Score} = \sum (\text{Poin } K) + \text{Bonus Kehadiran Tugas} - (\text{Jumlah } K_6 \times W_{penalty})$$
- $W_{penalty}$: Bobot pengurang untuk ketidakhadiran tanpa keterangan ($K_6$), dapat dikustomisasi pengurus.
- Filter hanya menyertakan misdinar dengan status `Active` dan role `Misdinar_Aktif` / `Misdinar_Retired`.

### 2.2 Segmentasi Pool & Sorting
Anggota dibagi ke dalam 2 kelompok utama:
- **Senior Pool**: Jenjang `SMA`, `SMK`, `Lulus` (Kuliah / Bekerja).
- **Junior Pool**: Jenjang `SD`, `SMP`.
Di dalam masing-masing kelompok, anggota diurutkan secara menurun (*descending*) berdasarkan **Total Score**.

### 2.3 Algoritma Pengisian Slot Berjenjang (Priority-Fill & Multi-Duty)

```
[Mulai Alokasi]
   │
   ▼
[Loop Slot Misa sesuai Urutan Prioritas: Misa_1 -> Misa_2 -> ... -> Misa_k]
   │
   ├── Tentukan kuota senior (N_senior) & junior (N_junior) untuk Misa_i
   ├── Ambil kandidat Senior terbaik (K-Score tertinggi) yang:
   │     • Total penugasan < MaxDuty (1x utk Natal, 2x utk Pekan Suci)
   │     • Tidak ada bentrok tanggal/hari terlarang
   ├── Ambil kandidat Junior terbaik (K-Score tertinggi) yang memenuhi syarat sama
   └── Masukkan ke daftar Assignment DRAFT Misa_i
   │
[Jika Pekan Suci & Kuota belum penuh]
   └── Jalankan Putaran ke-2 untuk anggota peringkat atas yang masih eligible
```

### 2.4 Aturan Batasan (Constraints)
1. **No Concurrent / Same-Event Duty**: 1 orang tidak dapat ditugaskan 2 kali pada slot misa di hari yang sama (misal Malam Natal 1 dan Malam Natal 2).
2. **Consecutive Heavy Day Restraint**: Pada Pekan Suci, anggota yang bertugas di Misa Berat (misal Jumat Agung Malam) diprioritaskan tidak bertugas berurutan jika ada opsi lain.
3. **Minimum Leadership Guard**: Setiap slot misa besar dipastikan memiliki minimal 2–3 anggota senior.

---

## 3. Skema Data & Manajemen Latihan Khusus

### 3.1 Model Data Misa Besar (Database Schema Extensions)
- **`events` table**:
  - `is_misa_besar`: `BOOLEAN DEFAULT TRUE` untuk event dalam rangkaian misa besar.
  - `series_id` / `series_name`: Penanda grup rangkaian (misal: `"Natal 2026"`, `"Pekan Suci 2026"`).
  - `jumlah_petugas`: Kapasitas kuota petugas untuk event tersebut.
  - `latihan_times`: Array waktu sesi latihan khusus.
  - `latihan_notes`: Catatan lokasi/perlengkapan latihan khusus.
- **`scan_records` & `rekap_poin_mingguan`**:
  - Terintegrasi otomatis untuk mencatat kehadiran scan gladi bersih (`scan_type: 'latihan'`).

---

## 4. Alur Antarmuka Pengguna (UI/UX Wizard Flow)

Akses via menu **Jadwal** $\rightarrow$ Tombol **"Wizard Misa Besar"**:

### Langkah 1: Setup Rangkaian & Kuota Misa
- Pilihan template instan: **Preset Natal** (4 Misa) atau **Preset Pekan Suci** (5–7 Misa) atau Kustom.
- Konfigurasi per misa: Nama, Tanggal, Jam, Kuota Petugas ($N$), dan Urutan Prioritas ($1, 2, 3, \dots$).
- Konfigurasi Sesi Latihan Khusus (Gladi): Tanggal, Jam, Catatan.

### Langkah 2: Parameter Aturan & Bobot
- Pemilihan rentang tanggal evaluasi akumulasi tugas ($K$).
- Batas maksimal penugasan per orang ($1\times$ atau $2\times$).
- Toggle komposisi seimbang Senior–Junior.
- Slider bobot penalti absensi $K_6$.

### Langkah 3: Simulasi & Pratinjau Interaktif (Interactive Preview)
- Tampilan kartu misa dengan daftar nama petugas terpilih, skor $K$, badge jenjang (SD/SMP/SMA/Lulus), dan badge jumlah tugas ($1\times$ / $2\times$).
- Dukungan drag-and-drop / klik ganti cepat untuk penyesuaian manual oleh pengurus.
- Panel validasi otomatis (memastikan tidak ada bentrok jadwal).
- Tombol aksi: **"Simpan DRAFT"** atau **"Publish Jadwal & Notifikasi"**.

---

## 5. Rencana Pengujian (Testing Strategy)
Menggunakan pendekatan **Test-Driven Development (TDD)**:
1. **Unit Tests (Engine Logic)**:
   - Kalkulasi skor akumulasi $K$ dengan berbagai variasi riwayat scan & rekap poin.
   - Algoritma alokasi prioritas Natal (1 penugasan per anak, urutan Malam Natal 1 > 2 > Pagi > Siang).
   - Algoritma alokasi multi-duty Pekan Suci (maks 2 penugasan, pencegahan bentrok misa eksklusif).
   - Verifikasi komposisi proporsional Senior-Junior di tiap slot.
2. **Integration Tests**:
   - Pembuatan event batch DRAFT beserta sesi latihan khusus ke Supabase database.
   - Verifikasi sinkronisasi absensi gladi bersih ke scanner QR dan perhitungan rekap poin mingguan.
3. **UI Verification**:
   - Pengujian interaktif alur wizard 3 langkah, validasi input kuota, dan fitur drag-and-drop preview.
