import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../lib/utils';
import { Plus, Trash2, RefreshCw, Trophy, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';

const KATEGORI_OPTIONS = ['Prestasi', 'AOA', 'Kegiatan_Khusus', 'Hukuman', 'Lainnya'] as const;
const KATEGORI_LABELS: Record<string, string> = {
  Prestasi:        'Prestasi / Lomba',
  AOA:             'AOA',
  Kegiatan_Khusus: 'Kegiatan Khusus',
  Hukuman:         'Catatan Khusus',  // internal label, tidak ditampilkan ke misdinar
  Lainnya:         'Lainnya',
};
const KATEGORI_COLOR: Record<string, string> = {
  Prestasi:        'badge-blue',
  AOA:             'badge-purple',
  Kegiatan_Khusus: 'badge-green',
  Hukuman:         'badge-gray',     // tidak merah — tidak perlu mengintimidasi
  Lainnya:         'badge-gray',
};

export default function PoinKegiatanPage() {
  const { profile, isPengurus } = useAuth();

  const [entries,  setEntries]  = useState<any[]>([]);
  const [members,  setMembers]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search,   setSearch]   = useState('');
  const [form, setForm] = useState({
    user_id: '', poin: '', keterangan: '', kategori: 'Prestasi', tanggal: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('poin_bonus')
      .select('id, poin, keterangan, kategori, tanggal, created_at, user:user_id(nama_panggilan, nickname, lingkungan), creator:created_by(nama_panggilan)')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    setEntries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isPengurus) return;
    supabase.from('users')
      .select('id, nama_panggilan, nickname, lingkungan')
      .eq('status', 'Active')
      .in('role', ['Misdinar_Aktif', 'Misdinar_Retired'])
      .order('nama_panggilan')
      .then(({ data }: any) => setMembers(data || []));
  }, [isPengurus]);

  async function saveEntry() {
    if (!form.user_id || !form.poin || !form.keterangan) {
      toast.error('Anggota, poin, dan keterangan wajib diisi'); return;
    }
    const poinNum = parseInt(form.poin);
    if (isNaN(poinNum) || poinNum === 0) { toast.error('Poin harus angka bukan nol'); return; }

    setSaving(true);
    const { error } = await supabase.from('poin_bonus').insert({
      user_id:    form.user_id,
      poin:       poinNum,
      keterangan: form.keterangan.trim(),
      kategori:   form.kategori,
      tanggal:    form.tanggal,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) { toast.error('Gagal: ' + error.message); return; }
    toast.success('Poin berhasil ditambahkan!');
    setShowForm(false);
    setForm({ user_id: '', poin: '', keterangan: '', kategori: 'Prestasi', tanggal: new Date().toISOString().split('T')[0] });
    loadData();
  }

  async function deleteEntry(id: string, nama: string, poin: number) {
    if (!confirm(`Hapus entri poin (${poin > 0 ? '+' : ''}${poin}) untuk ${nama}?`)) return;
    const { error } = await supabase.from('poin_bonus').delete().eq('id', id);
    if (error) { toast.error('Gagal: ' + error.message); return; }
    toast.success('Entri dihapus');
    loadData();
  }

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.user?.nama_panggilan?.toLowerCase().includes(q) ||
      e.user?.nickname?.toLowerCase().includes(q) ||
      e.keterangan?.toLowerCase().includes(q) ||
      KATEGORI_LABELS[e.kategori]?.toLowerCase().includes(q)
    );
  });

  const pg = usePagination(filtered, 20);

  const totalBonus = entries.reduce((s, e) => s + e.poin, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Poin Kegiatan</h1>
          <p className="page-subtitle">Tambahan poin manual — prestasi, AOA, kegiatan khusus</p>
        </div>
        <div className="flex gap-2">
          {isPengurus && (
            <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
              <Plus size={16}/> Tambah Poin
            </button>
          )}
          <button onClick={loadData} className="btn-ghost p-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card bg-blue-50 border-0">
          <Trophy size={18} className="text-blue-600 mb-2"/>
          <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
          <div className="text-xs font-semibold text-gray-600">Total Entri</div>
        </div>
        <div className={`card border-0 ${totalBonus >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <Star size={18} className={`mb-2 ${totalBonus >= 0 ? 'text-green-600' : 'text-red-600'}`}/>
          <div className={`text-2xl font-bold ${totalBonus >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalBonus > 0 ? '+' : ''}{totalBonus}
          </div>
          <div className="text-xs font-semibold text-gray-600">Total Poin Bonus</div>
        </div>
        <div className="card bg-purple-50 border-0">
          <Star size={18} className="text-purple-600 mb-2"/>
          <div className="text-2xl font-bold text-gray-900">
            {new Set(entries.map(e => e.user_id)).size}
          </div>
          <div className="text-xs font-semibold text-gray-600">Anggota</div>
        </div>
      </div>

      {/* Search */}
      <input className="input w-full max-w-sm" placeholder="Cari nama, keterangan, kategori..."
        value={search} onChange={e => setSearch(e.target.value)}/>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Anggota</th>
                <th>Poin</th>
                <th>Keterangan</th>
                <th>Kategori</th>
                <th>Tanggal</th>
                {isPengurus && <th>Dicatat Oleh</th>}
                {isPengurus && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j}><div className="skeleton h-4 rounded w-full"/></td>
                  ))}</tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  {search ? `Tidak ada hasil untuk "${search}"` : 'Belum ada entri poin kegiatan'}
                </td></tr>
              ) : pg.paged.map((e: any) => (
                <tr key={e.id}>
                  <td>
                    <div className="font-semibold text-sm">{e.user?.nama_panggilan}</div>
                    <div className="text-xs text-gray-400">@{e.user?.nickname} · {e.user?.lingkungan}</div>
                  </td>
                  <td>
                    <span className={`font-bold text-sm ${e.poin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {e.poin > 0 ? '+' : ''}{e.poin}
                    </span>
                  </td>
                  <td className="max-w-48">
                    <p className="text-sm text-gray-700 truncate">{e.keterangan}</p>
                  </td>
                  <td>
                    <span className={`badge ${KATEGORI_COLOR[e.kategori] || 'badge-gray'} text-xs`}>
                      {KATEGORI_LABELS[e.kategori] || e.kategori}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{formatDate(e.tanggal, 'dd MMM yyyy')}</td>
                  {isPengurus && <td className="text-xs text-gray-400">{e.creator?.nama_panggilan || '—'}</td>}
                  {isPengurus && (
                    <td>
                      <button onClick={() => deleteEntry(e.id, e.user?.nama_panggilan, e.poin)}
                        className="btn-ghost p-1.5 text-red-500 hover:bg-red-50">
                        <Trash2 size={13}/>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4">
            <Pagination {...pg} onPage={pg.goTo} label="entri"/>
          </div>
        )}
      </div>

      {/* Add form modal */}
      {showForm && isPengurus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy size={18} className="text-yellow-500"/> Tambah Poin Kegiatan
            </h3>

            <div>
              <label className="label">Anggota *</label>
              <select className="input" value={form.user_id}
                onChange={e => setForm(f => ({...f, user_id: e.target.value}))}>
                <option value="">— Pilih anggota —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nama_panggilan} (@{m.nickname}) · {m.lingkungan}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Poin * <span className="text-gray-400 font-normal">(boleh negatif)</span></label>
                <input type="number" className="input" value={form.poin} placeholder="cth: 3 atau -1"
                  onChange={e => setForm(f => ({...f, poin: e.target.value}))}/>
              </div>
              <div>
                <label className="label">Tanggal *</label>
                <input type="date" className="input" value={form.tanggal}
                  onChange={e => setForm(f => ({...f, tanggal: e.target.value}))}/>
              </div>
            </div>

            <div>
              <label className="label">Kategori *</label>
              <select className="input" value={form.kategori}
                onChange={e => setForm(f => ({...f, kategori: e.target.value}))}>
                {KATEGORI_OPTIONS.map(k => (
                  <option key={k} value={k}>{KATEGORI_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Keterangan *</label>
              <textarea className="input h-20 resize-none" value={form.keterangan}
                onChange={e => setForm(f => ({...f, keterangan: e.target.value}))}
                placeholder="cth: Juara 1 Lomba Misdinar Kevikepan, AOA bulan Mei 2026"/>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveEntry} disabled={saving} className="btn-primary flex-1 gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Plus size={15}/>}
                Simpan
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
