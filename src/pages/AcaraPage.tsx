import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import {
  CalendarPlus, Pencil, Trash2, Plus, X,
  CheckCircle2, Clock, MapPin, Tag, Loader2,
  Users, ChevronRight, ArrowLeft, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TIPE_OPTIONS = [
  'Retret', 'Novena', 'Ziarah', 'Rekoleksi', 'Misa Khusus',
  'Pertemuan', 'Kegiatan Sosial', 'Lainnya',
];

interface Acara {
  id: string;
  nama: string;
  tipe: string;
  tanggal: string;
  jam_mulai: string | null;
  jam_selesai: string | null;
  lokasi: string | null;
  deskripsi: string | null;
  is_active: boolean;
  created_at: string;
}

interface Peserta {
  id: string;
  timestamp: string;
  scan_type: string;
  is_anomaly: boolean;
  users: {
    nama_panggilan: string;
    nama_lengkap: string;
    nickname: string;
    lingkungan: string | null;
  };
}

const EMPTY_FORM = {
  nama: '',
  tipe: 'Lainnya',
  tanggal: '',
  jam_mulai: '',
  jam_selesai: '',
  lokasi: '',
  deskripsi: '',
  is_active: true,
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  });
}

export default function AcaraPage() {
  const { profile } = useAuth();

  // ── List state ───────────────────────────────────────────────
  const [acaraList, setAcaraList] = useState<Acara[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'active' | 'past'>('active');

  // ── Form state ───────────────────────────────────────────────
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  // ── Daftar hadir state ───────────────────────────────────────
  const [selectedAcara, setSelectedAcara] = useState<Acara | null>(null);
  const [peserta,       setPeserta]       = useState<Peserta[]>([]);
  const [loadingPes,    setLoadingPes]    = useState(false);

  // ── Load acara list ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('acara')
      .select('*')
      .order('tanggal', { ascending: false });
    if (error) toast.error('Gagal memuat acara: ' + error.message);
    setAcaraList(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Load peserta ─────────────────────────────────────────────
  const loadPeserta = useCallback(async (acaraId: string) => {
    setLoadingPes(true);
    // Fetch scan_records dulu, lalu join user manual — hindari ambiguitas 2 FK ke users
    const { data: scans, error } = await supabase
      .from('scan_records')
      .select('id, timestamp, scan_type, is_anomaly, user_id')
      .eq('acara_id', acaraId)
      .order('timestamp', { ascending: true });
    if (error) { toast.error('Gagal memuat daftar hadir: ' + error.message); setLoadingPes(false); return; }
    if (!scans?.length) { setPeserta([]); setLoadingPes(false); return; }

    const userIds = [...new Set(scans.map((s: any) => s.user_id))];
    const { data: usersData } = await supabase
      .from('users')
      .select('id, nama_panggilan, nama_lengkap, nickname, lingkungan')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (usersData ?? []).forEach((u: any) => { userMap[u.id] = u; });

    setPeserta(scans.map((s: any) => ({ ...s, users: userMap[s.user_id] ?? null })));
    setLoadingPes(false);
  }, []);

  function openDaftarHadir(a: Acara) {
    setSelectedAcara(a);
    loadPeserta(a.id);
  }

  function closeDaftarHadir() {
    setSelectedAcara(null);
    setPeserta([]);
  }

  // ── Export CSV ───────────────────────────────────────────────
  function exportCSV() {
    if (!selectedAcara || !peserta.length) return;
    const rows = [
      ['No', 'Nama Panggilan', 'Nama Lengkap', 'Lingkungan', 'Waktu Hadir'],
      ...peserta.map((p, i) => [
        i + 1,
        p.users?.nama_panggilan ?? '',
        p.users?.nama_lengkap ?? '',
        p.users?.lingkungan ?? '',
        fmtTime(p.timestamp),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `hadir_${selectedAcara.nama.replace(/\s+/g, '_')}_${selectedAcara.tanggal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Form handlers ────────────────────────────────────────────
  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(a: Acara) {
    setEditId(a.id);
    setForm({
      nama:        a.nama,
      tipe:        a.tipe,
      tanggal:     a.tanggal,
      jam_mulai:   a.jam_mulai ?? '',
      jam_selesai: a.jam_selesai ?? '',
      lokasi:      a.lokasi ?? '',
      deskripsi:   a.deskripsi ?? '',
      is_active:   a.is_active,
    });
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditId(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim() || !form.tanggal) { toast.error('Nama dan tanggal wajib diisi'); return; }
    setSaving(true);
    const payload = {
      nama:        form.nama.trim(),
      tipe:        form.tipe,
      tanggal:     form.tanggal,
      jam_mulai:   form.jam_mulai || null,
      jam_selesai: form.jam_selesai || null,
      lokasi:      form.lokasi.trim() || null,
      deskripsi:   form.deskripsi.trim() || null,
      is_active:   form.is_active,
      updated_at:  new Date().toISOString(),
    };
    let error: any;
    if (editId) {
      ({ error } = await supabase.from('acara').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('acara').insert({ ...payload, created_by: profile?.id }));
    }
    if (error) { toast.error('Gagal menyimpan: ' + error.message); }
    else { toast.success(editId ? 'Acara diperbarui' : 'Acara ditambahkan'); closeForm(); load(); }
    setSaving(false);
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus acara "${nama}"?\nData presensi yang terhubung akan dilepas (acara_id → null), bukan dihapus.`)) return;
    setDeleting(id);
    const { error } = await supabase.from('acara').delete().eq('id', id);
    if (error) toast.error('Gagal hapus: ' + error.message);
    else { toast.success('Acara dihapus'); load(); }
    setDeleting(null);
  }

  const today    = new Date().toISOString().slice(0, 10);
  const filtered = acaraList.filter(a => {
    if (filter === 'active') return a.is_active && a.tanggal >= today;
    if (filter === 'past')   return a.tanggal < today;
    return true;
  });

  // ── Daftar Hadir View ────────────────────────────────────────
  if (selectedAcara) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Back + header */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeDaftarHadir}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="page-title mb-0 truncate">{selectedAcara.nama}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date(selectedAcara.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
              {selectedAcara.jam_mulai ? ` · ${selectedAcara.jam_mulai}` : ''}
              {selectedAcara.lokasi ? ` · ${selectedAcara.lokasi}` : ''}
            </p>
          </div>
          {peserta.length > 0 && (
            <button
              onClick={exportCSV}
              className="btn-secondary gap-1.5 text-sm flex-shrink-0"
              title="Export CSV"
            >
              <Download size={15} /> CSV
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="card py-3 px-4 flex items-center gap-3">
          <Users size={18} className="text-brand-700 dark:text-amber-400" />
          <span className="font-semibold text-brand-800 dark:text-amber-400 text-lg">{peserta.length}</span>
          <span className="text-gray-500 dark:text-slate-400 text-sm">peserta hadir</span>
        </div>

        {/* Peserta list */}
        {loadingPes ? (
          <div className="card py-12 flex flex-col items-center gap-3 text-gray-400 dark:text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Memuat daftar hadir...</span>
          </div>
        ) : peserta.length === 0 ? (
          <div className="card py-12 text-center text-gray-400 dark:text-slate-400 text-sm">
            Belum ada yang hadir tercatat untuk acara ini.
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-400 uppercase tracking-wide text-left">
                  <th className="px-4 py-3 font-medium w-8">#</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Lingkungan</th>
                  <th className="px-4 py-3 font-medium text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                {peserta.map((p, i) => (
                  <tr key={p.id} className={p.is_anomaly ? 'bg-yellow-50/50 dark:bg-yellow-950/40' : 'hover:bg-gray-50/50 dark:hover:bg-slate-800/50'}>
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{p.users?.nama_panggilan}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-400">@{p.users?.nickname}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      {p.users?.lingkungan ?? <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-gray-600 dark:text-slate-300">{fmtTime(p.timestamp)}</span>
                      {p.is_anomaly && (
                        <span className="ml-1.5 text-[10px] bg-yellow-100 dark:bg-yellow-950/80 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded-full border border-yellow-200/50">
                          anomali
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Main List View ───────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarPlus size={22} className="text-brand-800" />
          <h1 className="page-title mb-0">Manajemen Acara</h1>
        </div>
        <button onClick={openNew} className="btn-primary gap-1.5 text-sm">
          <Plus size={16} /> Tambah Acara
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 text-sm">
        {(['active', 'past', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'px-3 py-1.5 rounded-lg font-medium transition-colors',
              filter === f
                ? 'bg-brand-800 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            {f === 'active' ? 'Akan Datang' : f === 'past' ? 'Sudah Lewat' : 'Semua'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="card py-14 text-center text-gray-400 flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin" />
          <span className="text-sm">Memuat acara...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-14 text-center text-gray-400 text-sm">
          Belum ada acara.{' '}
          <button onClick={openNew} className="text-brand-800 font-medium hover:underline">
            Tambah sekarang →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <div key={a.id} className="card flex gap-4 items-start">
              {/* Date badge */}
              <div className="flex-shrink-0 w-14 text-center rounded-xl bg-brand-50 border border-brand-100 py-2 px-1">
                <div className="text-[10px] text-brand-700 font-semibold uppercase leading-none">
                  {new Date(a.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' })}
                </div>
                <div className="text-2xl font-bold text-brand-800 leading-tight">
                  {new Date(a.tanggal + 'T00:00:00').getDate()}
                </div>
                <div className="text-[10px] text-brand-600">
                  {new Date(a.tanggal + 'T00:00:00').getFullYear()}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-800 leading-tight">{a.nama}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                        <Tag size={10} /> {a.tipe}
                      </span>
                      {!a.is_active && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          Nonaktif
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openDaftarHadir(a)}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-800"
                      title="Daftar Hadir"
                    >
                      <Users size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-brand-800"
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.nama)}
                      disabled={deleting === a.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-40"
                      title="Hapus"
                    >
                      {deleting === a.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                    <button
                      onClick={() => openDaftarHadir(a)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                {/* Detail row */}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {(a.jam_mulai || a.jam_selesai) && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {a.jam_mulai || '?'}{a.jam_selesai ? ` – ${a.jam_selesai}` : ''}
                    </span>
                  )}
                  {a.lokasi && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {a.lokasi}
                    </span>
                  )}
                  {a.deskripsi && (
                    <span className="italic text-gray-400 truncate max-w-xs">{a.deskripsi}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                {editId ? <Pencil size={17} /> : <Plus size={17} />}
                {editId ? 'Edit Acara' : 'Tambah Acara Baru'}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="label mb-1">Nama Acara <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="cth. Retret Misdinar 2026"
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label mb-1">Tipe Acara</label>
                <select
                  className="input"
                  value={form.tipe}
                  onChange={e => setForm(f => ({ ...f, tipe: e.target.value }))}
                >
                  {TIPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="label mb-1">Tanggal <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="input"
                  value={form.tanggal}
                  onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    className="input"
                    value={form.jam_mulai}
                    onChange={e => setForm(f => ({ ...f, jam_mulai: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    className="input"
                    value={form.jam_selesai}
                    onChange={e => setForm(f => ({ ...f, jam_selesai: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label mb-1">Lokasi</label>
                <input
                  className="input"
                  placeholder="cth. Aula Paroki KR"
                  value={form.lokasi}
                  onChange={e => setForm(f => ({ ...f, lokasi: e.target.value }))}
                />
              </div>

              <div>
                <label className="label mb-1">Deskripsi</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Keterangan tambahan (opsional)"
                  value={form.deskripsi}
                  onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={[
                    'relative w-10 h-5 rounded-full transition-colors',
                    form.is_active ? 'bg-brand-800' : 'bg-gray-300',
                  ].join(' ')}
                >
                  <div className={[
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    form.is_active ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')} />
                </div>
                <span className="text-sm text-gray-700">Acara aktif (tampil di daftar presensi)</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 gap-1.5">
                  {saving
                    ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</>
                    : <><CheckCircle2 size={15} /> Simpan</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
