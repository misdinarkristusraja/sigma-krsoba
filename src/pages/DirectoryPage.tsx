import React, { useState, useEffect } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { Search, Download, RefreshCw, Phone, User, MessageCircle, Send } from 'lucide-react';

const VIDEO_TUTORIAL_LINK = 'https://youtu.be/zVN7jL6fUqQ';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';

type Member = {
  id: string;
  nickname: string;
  nama_lengkap: string;
  nama_panggilan: string;
  tanggal_lahir: string | null;
  pendidikan: string | null;
  sekolah: string | null;
  wilayah: string | null;
  lingkungan: string | null;
  email: string | null;
  hp_anak: string | null;
  hp_ortu: string | null;
  nama_ayah: string | null;
  nama_ibu: string | null;
  alamat: string | null;
  role: string;
  status: string;
};

const STATUS_COLOR: Record<string, string> = {
  Active:           'bg-green-100 text-green-700',
  Pending:          'bg-yellow-100 text-yellow-700',
  Inactive:         'bg-gray-100 text-gray-500',
  Suspended:        'bg-red-100 text-red-700',
  Retired:          'bg-purple-100 text-purple-600',
  Misdinar_Retired: 'bg-purple-100 text-purple-600',
};

function formatTgl(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function age(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function DirectoryPage() {
  const { isPengurus } = useAuth();
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('Active');
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [sendPasswordMode, setSendPasswordMode] = useState(false);

  function buildWALink(hp: string, nama: string, username: string) {
    const normalized = hp.replace(/\D/g, '');
    const videoLink  = VIDEO_TUTORIAL_LINK || '[link video]';
    const text = `Halo ${nama}! 👋\n\nKabar gembira! Saat ini, Sigma-Kr v.2 sudah resmi dirilis dan siap untuk kamu gunakan. ✨\n\nSebelum mulai menjelajah, ada beberapa langkah penting yang wajib kamu perhatikan terlebih dahulu:\n\n🔐 Login Awal: Dimohon untuk segera melakukan login setelah akun dibagikan.\n\n🔄 Ganti Password: Setelah berhasil masuk, segera ganti password default kamu dengan password baru yang aman dan mudah diingat.\n\n🔁 Re-Login: Silakan keluar lalu login kembali menggunakan password baru tersebut.\n\n📝 Daftar Ulang: Begitu masuk ke halaman dashboard, mohon segera lakukan daftar ulang SEBELUM 11 Juli 2026.\n\n🔍 Validasi Data: Pastikan seluruh data yang kamu masukkan sudah sesuai. Jika menemui kesulitan atau kendala dalam pengisian, wajib segera melaporkannya ke pengurus.\n\n🎉 Selesai: Jika langkah di atas sudah terpenuhi, akun dan aplikasi kamu sudah siap digunakan sepenuhnya!\n\n👥 Detail Akun Kamu:\n\nUsername: ${username}\n\nPassword: [password]\n\nLink Aplikasi: https://sigma-kr.vercel.app/\n\n🎬 Butuh Panduan Visual?\nUntuk alur yang lebih jelas, kamu bisa langsung menonton video tutorialnya di sini: ${videoLink}\n\nTerima kasih atas perhatiannya. Selamat mencoba Sigma-Kr v.2! 🚀`;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  }

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id,nickname,nama_lengkap,nama_panggilan,tanggal_lahir,pendidikan,sekolah,wilayah,lingkungan,email,hp_anak,hp_ortu,nama_ayah,nama_ibu,alamat,role,status')
        .order('nama_panggilan');
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = members.filter(m => {
    const matchStatus = statusF === 'Semua' || m.status === statusF;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.nama_lengkap?.toLowerCase().includes(q) ||
      m.nama_panggilan?.toLowerCase().includes(q) ||
      m.nickname?.toLowerCase().includes(q) ||
      m.lingkungan?.toLowerCase().includes(q) ||
      m.hp_anak?.includes(q) ||
      m.hp_ortu?.includes(q);
    return matchStatus && matchSearch;
  });
  const pg = usePagination(filtered, 25);

  function exportExcel() {
    const rows = filtered.map((m, i) => ({
      'No':             i + 1,
      'Nama Panggilan': m.nama_panggilan || '',
      'Nama Lengkap':   m.nama_lengkap   || '',
      'Nickname':       m.nickname       || '',
      'Tgl Lahir':      m.tanggal_lahir  ? formatTgl(m.tanggal_lahir) : '',
      'Umur':           age(m.tanggal_lahir) ?? '',
      'Pendidikan':     m.pendidikan     || '',
      'Sekolah':        m.sekolah        || '',
      'Lingkungan':     m.lingkungan     || '',
      'Wilayah':        m.wilayah        || '',
      'HP Anak':        m.hp_anak        || '',
      'HP Ortu':        m.hp_ortu        || '',
      'Nama Ayah':      m.nama_ayah      || '',
      'Nama Ibu':       m.nama_ibu       || '',
      'Alamat':         m.alamat         || '',
      'Email':          m.email          || '',
      'Role':           m.role           || '',
      'Status':         m.status         || '',
    }));
    if (!rows.length) return;
    const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const headers = Object.keys(rows[0]);
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">
<thead><tr>${headers.map(h => `<th style="background:#eee;font-weight:bold;">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(row => `<tr>${headers.map(h => `<td>${esc((row as any)[h])}</td>`).join('')}</tr>`).join('')}</tbody>
</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `direktori_anggota_${new Date().toISOString().slice(0,10)}.xls`; a.click();
    URL.revokeObjectURL(url);
    toast.success('File Excel berhasil diunduh');
  }

  const statuses = ['Active', 'Pending', 'Inactive', 'Suspended', 'Retired', 'Misdinar_Retired', 'Semua'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Direktori Anggota</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Data lengkap semua anggota — akses terbatas Admin & Pengurus</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isPengurus && (
            <button
              onClick={() => setSendPasswordMode(v => !v)}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-colors ${
                sendPasswordMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
              }`}
              title="Mode kirim pesan onboarding + password ke anggota via WA">
              <MessageCircle size={15}/>
              {sendPasswordMode ? '✓ Kirim Password: ON' : 'Kirim Password'}
            </button>
          )}
          <button onClick={exportExcel}
            className="inline-flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg transition-colors font-medium">
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            className="input pl-9 text-sm w-full"
            placeholder="Cari nama, lingkungan, HP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusF(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusF === s ? 'bg-brand-800 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {sendPasswordMode && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 rounded-xl p-3 flex items-center gap-3">
          <MessageCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0"/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">Mode Kirim Password Aktif</p>
            <p className="text-xs text-green-700 dark:text-green-300">Klik tombol "Ortu" atau "Anak" di baris anggota untuk membuka WA dengan format pesan lengkap (username &amp; password sementara).</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
                <tr className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide text-left">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Lingkungan</th>
                  <th className="px-4 py-3 font-medium">Tgl Lahir</th>
                  <th className="px-4 py-3 font-medium">HP Anak</th>
                  <th className="px-4 py-3 font-medium">HP Ortu</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {sendPasswordMode && <th className="px-4 py-3 font-medium text-green-700 dark:text-green-400">Kirim WA</th>}
                  <th className="px-4 py-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {pg.paged.map(m => {
                  const isOpen = expanded === m.id;
                  const umur = age(m.tanggal_lahir);
                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : m.id)}
                        className="cursor-pointer hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-slate-100">{m.nama_panggilan || m.nickname}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-400">{m.nama_lengkap}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                          {m.lingkungan || <span className="text-gray-300 dark:text-slate-600 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-300">
                          {m.tanggal_lahir ? (
                            <span>{formatTgl(m.tanggal_lahir)}{umur ? <span className="text-xs text-gray-400 dark:text-slate-400 ml-1">({umur}th)</span> : null}</span>
                          ) : <span className="text-gray-300 dark:text-slate-600 italic">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.hp_anak ? (
                            <a href={`https://wa.me/${m.hp_anak.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              className="text-green-600 hover:underline flex items-center gap-1 text-xs">
                              <Phone size={11} />{m.hp_anak}
                            </a>
                          ) : <span className="text-gray-300 italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {m.hp_ortu ? (
                            <a href={`https://wa.me/${m.hp_ortu.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              className="text-green-600 hover:underline flex items-center gap-1 text-xs">
                              <Phone size={11} />{m.hp_ortu}
                            </a>
                          ) : <span className="text-gray-300 italic text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status] || 'bg-gray-100 text-gray-500'}`}>
                            {m.status?.replace('_', ' ')}
                          </span>
                        </td>
                        {sendPasswordMode && (
                          <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col gap-1">
                              {m.hp_ortu && (
                                <a
                                  href={buildWALink(m.hp_ortu, m.nama_panggilan || m.nickname, m.nickname)}
                                  target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded-lg font-medium transition-colors"
                                  title={`Kirim ke Ortu: ${m.hp_ortu}`}>
                                  <Send size={11}/> Ortu
                                </a>
                              )}
                              {m.hp_anak && (
                                <a
                                  href={buildWALink(m.hp_anak, m.nama_panggilan || m.nickname, m.nickname)}
                                  target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded-lg font-medium transition-colors"
                                  title={`Kirim ke Anak: ${m.hp_anak}`}>
                                  <Send size={11}/> Anak
                                </a>
                              )}
                              {!m.hp_ortu && !m.hp_anak && (
                                <span className="text-xs text-gray-300 italic">No HP</span>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-3 py-3 text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</td>
                      </tr>

                      {/* Expanded detail */}
                      {isOpen && (
                        <tr className="bg-blue-50/20">
                          <td colSpan={sendPasswordMode ? 8 : 7} className="px-6 py-5">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                              <Field label="Nickname"    value={m.nickname} />
                              <Field label="Pendidikan"  value={m.pendidikan} />
                              <Field label="Sekolah"     value={m.sekolah} />
                              <Field label="Wilayah"     value={m.wilayah} />
                              <Field label="Email"       value={m.email} />
                              <Field label="Nama Ayah"   value={m.nama_ayah} />
                              <Field label="Nama Ibu"    value={m.nama_ibu} />
                              <Field label="Alamat"      value={m.alamat} wide />
                              <Field label="Role"        value={m.role} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={sendPasswordMode ? 8 : 7} className="px-4 py-16 text-center text-gray-400">
                      <User size={36} className="mx-auto mb-2 opacity-30" />
                      <p>Tidak ada anggota ditemukan</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4">
              <Pagination {...pg} onPage={pg.goTo} label="anggota" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-400 uppercase mb-0.5">{label}</p>
      <p className="text-gray-800">{value || <span className="text-gray-300 italic text-xs">—</span>}</p>
    </div>
  );
}
