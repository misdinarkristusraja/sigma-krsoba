/**
 * src/lib/supabase.js
 *
 * Supabase client — inisialisasi terpusat untuk seluruh aplikasi.
 * ------------------------------------------------------------------
 * PERBAIKAN dari versi sebelumnya:
 *   - HAPUS fallback ke 'placeholder.supabase.co' yang menyebabkan
 *     silent-failure: request terkirim tapi selalu gagal tanpa pesan jelas.
 *   - GANTI dengan Error eksplisit yang menghentikan aplikasi lebih awal
 *     (fail-fast) dan menunjukkan langkah perbaikan yang tepat.
 * ------------------------------------------------------------------
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/index';

// ── Validasi ENV vars secara ketat ──────────────────────────────────────────
// Dikumpulkan dulu semua yang hilang agar satu error message mencakup semuanya.
const MISSING_VARS: string[] = [];

if (!import.meta.env.VITE_SUPABASE_URL) {
  MISSING_VARS.push('VITE_SUPABASE_URL');
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  MISSING_VARS.push('VITE_SUPABASE_ANON_KEY');
}

if (MISSING_VARS.length > 0) {
  // Tidak menggunakan console.warn (mudah terlewat).
  // Menggunakan throw Error agar:
  //   - Di development : Vite langsung merah di terminal & browser overlay.
  //   - Di production  : Vercel build log menunjukkan error yang jelas.
  //   - Di CI/CD       : Pipeline gagal sebelum deploy ke production.
  throw new Error(
    `[supabase.js] ❌ ENV vars berikut BELUM diset:\n` +
    MISSING_VARS.map((v) => `  • ${v}`).join('\n') +
    `\n\nLangkah perbaikan:\n` +
    `  1. Buka Vercel Dashboard → Project → Settings → Environment Variables\n` +
    `  2. Tambahkan setiap variabel di atas (berlaku untuk: Production, Preview, Development)\n` +
    `  3. Nilai bisa ditemukan di: Supabase Dashboard → Project Settings → API\n` +
    `  4. Redeploy project Vercel setelah menyimpan ENV vars\n` +
    `\n  Untuk pengembangan lokal: buat file .env.local di root project:\n` +
    `  VITE_SUPABASE_URL=https://xxx.supabase.co\n` +
    `  VITE_SUPABASE_ANON_KEY=eyJhbGci...`
  );
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Inisialisasi client ─────────────────────────────────────────────────────
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,   // Refresh token otomatis sebelum kadaluarsa
    persistSession:   true,   // Simpan session di localStorage
    detectSessionInUrl: true, // Handle magic link & OAuth callback dari URL
  },
  global: {
    headers: {
      'x-app-name': 'sigma-krsoba', // Identifier di Supabase logs
    },
  },
});

// Alias untuk konsistensi import yang sudah ada di file lain
export const db = supabase;

// ── Util: Upload file ke Supabase Storage ───────────────────────────────────
/**
 * Upload file ke bucket tertentu.
 * Mengembalikan STORAGE PATH (bukan URL publik) sesuai SKPL N14
 * yang mengharuskan akses via signed URL sementara.
 *
 * @param {string} bucket  - Nama bucket di Supabase Storage
 * @param {string} path    - Path tujuan (mis: `surat/${userId}.pdf`)
 * @param {File}   file    - File object dari input[type=file]
 * @returns {Promise<string>} Storage path
 */
export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return data.path; // Kembalikan path, bukan URL publik
}

// ── Util: Ambil signed URL sementara ────────────────────────────────────────
/**
 * Generate URL sementara untuk mengakses file.
 * URL expire setelah `expiresIn` detik (default: 1 jam).
 * Gunakan ini setiap kali ingin menampilkan atau mendownload file.
 *
 * @param {string} bucket     - Nama bucket
 * @param {string} filePath   - Storage path yang didapat dari uploadFile()
 * @param {number} expiresIn  - Durasi URL valid dalam detik (default: 3600)
 * @returns {Promise<string>} Signed URL yang expire
 */
export async function getSignedUrl(bucket: string, filePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}
