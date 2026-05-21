/**
 * src/pages/AdminPage.jsx
 *
 * Bagian yang dimodifikasi: fungsi massResetAllPasswords dan komponen
 * UI yang berhubungan dengan Mass Reset Password.
 *
 * PERBAIKAN dari versi sebelumnya:
 *   - Mengembalikan pemanggilan ke Edge Function via supabase.functions.invoke()
 *     (sebelumnya: supabase.rpc() yang tergantung pada permission DB yang
 *      sering bertabrakan di berbagai migrasi)
 *   - UI feedback yang detail: progress per-user, tombol WA per-user
 *   - Error handling berlapis: network error, auth error, partial failure
 *   - Loading state yang benar (tidak terkunci jika terjadi exception)
 *
 * CATATAN INTEGRASI:
 *   File ini merupakan PATCH untuk AdminPage.jsx yang sudah ada.
 *   Salin & ganti seluruh section "MASS RESET" dari komponen AdminPage
 *   dengan kode di bawah. Import yang sudah ada tidak perlu diubah.
 * ------------------------------------------------------------------
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import {
  Settings, Save, Database, KeyRound, MessageCircle,
  CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, EyeOff,
  RefreshCw, ClipboardCopy, SkipForward, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Konstanta ────────────────────────────────────────────────────────────────
const CONFIG_GROUPS = {
  'Pendaftaran Baru':    ['reg_open_date', 'reg_close_date'],
  'Daftar Ulang':        ['rereg_open_date', 'rereg_close_date', 'rereg_tahun'],
  'Opt-in Misa Harian':  ['window_optin_harian_start', 'window_optin_harian_end'],
  'Penjadwalan':         ['prioritas_sma_smk_interval', 'max_hari_tanpa_jadwal'],
  'Tukar Jadwal':        ['swap_expire_hours'],
  'Suspend':             ['max_absen_before_suspend', 'suspend_duration_days'],
  'Liturgi':             ['gcatholic_url'],
};

const ROLES = [
  'Administrator', 'Pengurus', 'Pelatih', 'Misdinar_Aktif', 'Misdinar_Retired',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSalam() {
  const h = new Date(new Date().getTime() + 7 * 3600 * 1000).getUTCHours();
  if (h >= 5  && h < 11) return 'pagi';
  if (h >= 11 && h < 15) return 'siang';
  if (h >= 15 && h < 19) return 'sore';
  return 'malam';
}

function buildWAMsg(user: any, password: string) {
  return encodeURIComponent(
    `Selamat ${getSalam()}, ${user.nama || user.nickname}!\n\n` +
    `Berikut akun SIGMA Misdinar Kristus Raja Solo Baru kamu:\n` +
    `👤 Username : ${user.nickname}\n` +
    `🔑 Password : ${password}\n` +
    `🔗 Link     : sigma-krsoba.vercel.app\n\n` +
    `Mohon segera login dan ganti password dengan yang mudah kamu ingat namun kuat.\n` +
    `Gunakan dengan bijak dan penuh tanggung jawab.\n\n` +
    `Berkah Dalem 🙏`
  );
}

function openWA(user: any, password: string) {
  const raw = (user.hp_ortu || user.hp_anak || '').replace(/\D/g, '');
  if (!raw) {
    toast.error(`Nomor HP ${user.nama || user.nickname} tidak tersedia`);
    return;
  }
  const phone = raw.startsWith('0') ? '62' + raw.slice(1) : raw;
  const url   = `https://wa.me/${phone}?text=${buildWAMsg(user, password)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Komponen: Badge status per-user ─────────────────────────────────────────
function ResultBadge({ result }: { result: any }) {
  if (result.skipped) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
        <SkipForward size={11} /> Dilewati
      </span>
    );
  }
  if (result.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={11} /> Berhasil
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle size={11} /> Gagal
    </span>
  );
}

// ── Komponen: Tabel hasil mass reset ────────────────────────────────────────
function MassResetResultsTable({ results }: { results: any[] }) {
  if (!results.length) return null;

  const success = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed  = results.filter((r) => !r.ok && !r.skipped).length;

  return (
    <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
      {/* Ringkasan */}
      <div className="bg-gray-50 px-4 py-3 flex flex-wrap gap-4 text-sm font-medium border-b border-gray-200">
        <span className="flex items-center gap-1.5 text-gray-700">
          <Users size={14} /> Total: {results.length}
        </span>
        <span className="flex items-center gap-1.5 text-green-700">
          <CheckCircle2 size={14} /> Sukses: {success}
        </span>
        <span className="flex items-center gap-1.5 text-yellow-600">
          <SkipForward size={14} /> Dilewati: {skipped}
        </span>
        <span className="flex items-center gap-1.5 text-red-700">
          <XCircle size={14} /> Gagal: {failed}
        </span>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="px-4 py-2 font-medium">Lingkungan</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Password Baru</th>
              <th className="px-4 py-2 font-medium">Kirim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <tr
                key={r.id || i}
                className={
                  r.ok
                    ? 'bg-white hover:bg-green-50/40 transition-colors'
                    : r.skipped
                    ? 'bg-yellow-50/40'
                    : 'bg-red-50/40'
                }
              >
                {/* Nama */}
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <p className="font-medium text-gray-800">{r.nama || r.nickname}</p>
                  <p className="text-xs text-gray-400">{r.nickname}</p>
                </td>

                {/* Lingkungan */}
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                  {r.lingkungan || <span className="text-gray-300 italic">—</span>}
                </td>

                {/* Status badge */}
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <ResultBadge result={r} />
                  {!r.ok && r.error && (
                    <p className="text-xs text-red-500 mt-0.5 max-w-[160px] truncate" title={r.error}>
                      {r.error}
                    </p>
                  )}
                </td>

                {/* Password */}
                <td className="px-4 py-2.5">
                  {r.ok && r.password ? (
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded select-all">
                        {r.password}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(r.password);
                          toast.success('Password disalin!');
                        }}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                        title="Salin password"
                      >
                        <ClipboardCopy size={13} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs italic">—</span>
                  )}
                </td>

                {/* Tombol WA */}
                <td className="px-4 py-2.5">
                  {r.ok && r.password && (r.hp_ortu || r.hp_anak) ? (
                    <button
                      onClick={() => openWA(r, r.password)}
                      className="inline-flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <MessageCircle size={12} /> WA
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs italic">
                      {r.ok ? 'No HP kosong' : '—'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Komponen Utama: AdminPage ─────────────────────────────────────────────────
export default function AdminPage() {
  const { user: currentUser } = useAuth();

  // State yang sudah ada (tidak diubah)
  const [users, setUsers]             = useState<any[]>([]);
  const [configs, setConfigs]         = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState(false);

  // State untuk Mass Reset
  const [massLoading, setMassLoading]   = useState(false);
  const [massResults, setMassResults]   = useState<any[]>([]);
  const [massProgress, setMassProgress] = useState<{ status: string; total?: number; success?: number; skipped?: number; failed?: number; error?: string; hint?: string } | null>(null);
  // null = belum dijalankan
  // { status: 'running' | 'done' | 'error', total?, success?, failed?, error? }

  // ── Fungsi: Load users (tidak berubah) ──────────────────────────────────
  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, nickname, nama_panggilan, email, status, role, hp_ortu, hp_anak, lingkungan')
      .order('nama_panggilan');
    if (error) {
      toast.error('Gagal memuat daftar user: ' + error.message);
      return;
    }
    setUsers(data ?? []);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ────────────────────────────────────────────────────────────────────────────
  // MASS RESET — via Edge Function admin-reset-password (sudah deployed)
  async function massResetAllPasswords() {
    const targetCount = users.filter(
      (u) => ['Active', 'Pending'].includes(u.status) && u.role !== 'Administrator'
    ).length;

    if (targetCount === 0) {
      toast('Tidak ada anggota aktif/pending yang perlu direset.', { icon: 'ℹ️' });
      return;
    }

    const confirmed = window.confirm(
      `⚠️ KONFIRMASI MASS RESET PASSWORD\n\n` +
      `Akan mereset password ${targetCount} anggota (Active + Pending).\n` +
      `Administrator tidak termasuk.\n\n` +
      `Password baru di-generate secara acak oleh server.\n` +
      `Kamu bisa kirim password baru via WhatsApp setelah proses selesai.\n\n` +
      `Lanjutkan?`
    );
    if (!confirmed) return;

    setMassLoading(true);
    setMassResults([]);
    setMassProgress({ status: 'running', total: targetCount });

    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-reset-password',
        { body: { mode: 'provision_all' } }
      );

      if (error) {
        const msg = error.message || 'Koneksi ke Edge Function gagal.';
        setMassProgress({ status: 'error', error: msg });
        toast.error('Mass reset gagal: ' + msg);
        return;
      }

      if (!data?.ok) {
        const msg = data?.message || data?.error || 'Respons tidak valid dari server.';
        setMassProgress({ status: 'error', error: msg });
        toast.error('Mass reset ditolak: ' + msg);
        return;
      }

      const { total, success, skipped, failed, results } = data;
      setMassResults(results ?? []);
      setMassProgress({ status: 'done', total: total ?? 0, success: success ?? 0, skipped: skipped ?? 0, failed: failed ?? 0 });

      if (failed === 0) {
        toast.success(`✅ ${success} password berhasil direset!`, { duration: 5000 });
      } else {
        toast(`⚠️ Selesai: ${success} sukses, ${skipped} dilewati, ${failed} gagal.`,
          { duration: 8000, icon: '⚠️' });
      }

    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setMassProgress({ status: 'error', error: msg });
      toast.error('Terjadi kesalahan: ' + msg);
    } finally {
      setMassLoading(false);
    }
  }

  // ── Load + Save configs ───────────────────────────────────────────────────
  const loadConfigs = useCallback(async () => {
    const allKeys = Object.values(CONFIG_GROUPS).flat();
    const { data } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', allKeys);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r: any) => { map[r.key] = r.value; });
      setConfigs(map);
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  async function saveConfig(key: string, value: string) {
    setSaving(true);
    const { error } = await supabase
      .from('system_config')
      .upsert({ key, value, updated_by: currentUser?.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) toast.error('Gagal simpan: ' + error.message);
    else toast.success(`${key} disimpan`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Settings className="text-indigo-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Kelola konfigurasi dan akun anggota</p>
        </div>
      </div>

      {/* ── Section: Mass Reset Password ── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <KeyRound className="text-red-600" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Mass Reset Password</h2>
              <p className="text-xs text-gray-500">
                Generate ulang password semua anggota Active &amp; Pending
              </p>
            </div>
          </div>

          <button
            onClick={massResetAllPasswords}
            disabled={massLoading}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              massLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-sm',
            ].join(' ')}
          >
            {massLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Memproses…
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Reset Semua
              </>
            )}
          </button>
        </div>

        {/* Progress / Status banner */}
        <div className="px-6 py-4">
          {/* Belum pernah dijalankan */}
          {!massProgress && !massLoading && (
            <p className="text-sm text-gray-400 italic text-center py-4">
              Klik "Reset Semua" untuk memulai. Password baru akan tampil di tabel di bawah.
            </p>
          )}

          {/* Sedang berjalan */}
          {massLoading && (
            <div className="flex items-center gap-3 bg-blue-50 text-blue-700 rounded-xl px-4 py-3">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <div>
                <p className="font-medium text-sm">Sedang memproses…</p>
                <p className="text-xs text-blue-500">
                  Proses ini bisa memakan waktu 30–120 detik tergantung jumlah anggota.
                  Jangan tutup halaman ini.
                </p>
              </div>
            </div>
          )}

          {/* Selesai — sukses penuh */}
          {massProgress?.status === 'done' && massProgress.failed === 0 && (
            <div className="flex items-start gap-3 bg-green-50 text-green-800 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">
                  ✅ {massProgress.success} password berhasil direset!
                </p>
                {(massProgress.skipped ?? 0) > 0 && (
                  <p className="text-xs text-green-600">
                    {massProgress.skipped} user dilewati (email kosong).
                  </p>
                )}
                <p className="text-xs text-green-600 mt-1">
                  Kirim password baru ke masing-masing anggota via WhatsApp di tabel di bawah.
                </p>
              </div>
            </div>
          )}

          {/* Selesai — ada kegagalan sebagian */}
          {massProgress?.status === 'done' && (massProgress.failed ?? 0) > 0 && (
            <div className="flex items-start gap-3 bg-yellow-50 text-yellow-800 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">
                  Selesai dengan peringatan — {massProgress.failed} user gagal direset
                </p>
                <p className="text-xs text-yellow-600">
                  Sukses: {massProgress.success} | Dilewati: {massProgress.skipped} | Gagal: {massProgress.failed}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Cek kolom "Gagal" di tabel untuk detail error per-user.
                </p>
              </div>
            </div>
          )}

          {/* Error total */}
          {massProgress?.status === 'error' && (
            <div className="flex items-start gap-3 bg-red-50 text-red-800 rounded-xl px-4 py-3">
              <XCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Mass reset gagal</p>
                <p className="text-xs text-red-600 mt-0.5 font-mono">
                  {massProgress.error}
                </p>
                {massProgress.hint && (
                  <p className="text-xs text-red-500 mt-1 bg-red-100 px-2 py-1 rounded">
                    💡 {massProgress.hint}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tabel hasil */}
          <MassResetResultsTable results={massResults} />
        </div>
      </section>

      {/* ── Section: Konfigurasi Sistem ── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Settings className="text-indigo-600" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Konfigurasi Sistem</h2>
            <p className="text-xs text-gray-500">Kelola window pendaftaran, daftar ulang, dan parameter sistem</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(CONFIG_GROUPS).map(([groupLabel, keys]) => (
            <div key={groupLabel}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">
                {groupLabel}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {keys.map(key => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{key}</label>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm font-mono"
                        value={configs[key] ?? ''}
                        onChange={e => setConfigs(c => ({ ...c, [key]: e.target.value }))}
                        placeholder="—"
                        type={key.endsWith('_date') ? 'date' : 'text'}
                      />
                      <button
                        onClick={() => saveConfig(key, configs[key] ?? '')}
                        disabled={saving}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Save size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
