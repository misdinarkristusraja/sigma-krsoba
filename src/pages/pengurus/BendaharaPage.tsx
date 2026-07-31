import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Calendar, Tag, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BendaharaPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kasList, setKasList] = useState<any[]>([]);

  // Summary balances
  const [totalMasuk, setTotalMasuk] = useState(0);
  const [totalKeluar, setTotalKeluar] = useState(0);

  // Form modal
  const [showModal, setShowModal] = useState(false);
  const [tipe, setTipe] = useState<'Pemasukan' | 'Pengeluaran'>('Pemasukan');
  const [kategori, setKategori] = useState('Iuran Kas');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [buktiUrl, setBuktiUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('pengurus_kas')
        .select('*, created_user:created_by(nama_panggilan)')
        .order('tanggal', { ascending: false });

      const records = data || [];
      setKasList(records);

      let masuk = 0, keluar = 0;
      records.forEach((r: any) => {
        if (r.tipe === 'Pemasukan') masuk += Number(r.jumlah || 0);
        if (r.tipe === 'Pengeluaran') keluar += Number(r.jumlah || 0);
      });
      setTotalMasuk(masuk);
      setTotalKeluar(keluar);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const nominal = parseFloat(jumlah);
    if (isNaN(nominal) || nominal <= 0) { toast.error('Isi nominal dengan benar'); return; }
    if (!keterangan) { toast.error('Isi keterangan transaksi'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('pengurus_kas').insert({
      tipe,
      kategori,
      jumlah: nominal,
      keterangan,
      tanggal,
      bukti_url: buktiUrl,
      created_by: profile?.id
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    toast.success('Transaksi kas berhasil dicatat');
    setShowModal(false);
    setJumlah(''); setKeterangan(''); setBuktiUrl('');
    loadData();
  }

  const saldoAkhir = totalMasuk - totalKeluar;

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-white p-5 border border-gray-100 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Saldo Kas Saat Ini</span>
            <Wallet size={18} className="text-brand-800" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            Rp {saldoAkhir.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="card bg-emerald-50/50 p-5 border border-emerald-100 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Total Pemasukan</span>
            <ArrowDownRight size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-800 mt-2">
            Rp {totalMasuk.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="card bg-red-50/50 p-5 border border-red-100 rounded-2xl">
          <div className="flex items-center justify-between text-red-700 text-xs font-semibold">
            <span>Total Pengeluaran</span>
            <ArrowUpRight size={18} className="text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-800 mt-2">
            Rp {totalKeluar.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="font-bold text-gray-900 text-base">Arus Kas &amp; Pembukuan</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm gap-1">
          <Plus size={14} /> Catat Transaksi Kas
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Keterangan</th>
              <th>Jumlah</th>
              <th>Pencatat</th>
              <th>Bukti</th>
            </tr>
          </thead>
          <tbody>
            {kasList.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada transaksi kas</td></tr>
            ) : (
              kasList.map((k) => (
                <tr key={k.id}>
                  <td className="text-xs text-gray-500">{k.tanggal}</td>
                  <td>
                    <span className={`badge ${k.tipe === 'Pemasukan' ? 'badge-green' : 'badge-red'}`}>
                      {k.tipe}
                    </span>
                  </td>
                  <td className="text-xs font-semibold text-gray-700">{k.kategori}</td>
                  <td className="text-sm text-gray-900">{k.keterangan}</td>
                  <td className={`font-mono text-sm font-bold ${k.tipe === 'Pemasukan' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {k.tipe === 'Pemasukan' ? '+' : '-'} Rp {Number(k.jumlah).toLocaleString('id-ID')}
                  </td>
                  <td className="text-xs text-gray-500">{k.created_user?.nama_panggilan || '—'}</td>
                  <td>
                    {k.bukti_url ? (
                      <a href={k.bukti_url} target="_blank" rel="noreferrer" className="btn-ghost btn-xs text-brand-800 gap-1">
                        <Download size={12} /> Nota
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add Transaksi */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleAddTransaction} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-gray-900">Catat Transaksi Kas</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Jenis Transaksi</label>
                <select className="input" value={tipe} onChange={e => setTipe(e.target.value as any)}>
                  <option value="Pemasukan">Pemasukan (+)</option>
                  <option value="Pengeluaran">Pengeluaran (-)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Kategori</label>
                <select className="input" value={kategori} onChange={e => setKategori(e.target.value)}>
                  <option value="Iuran Kas">Iuran Kas</option>
                  <option value="Donasi / Kolekte">Donasi / Kolekte</option>
                  <option value="Perlengkapan Misa">Perlengkapan Misa</option>
                  <option value="Acara / Rekreasi">Acara / Rekreasi</option>
                  <option value="Konsumsi Latihan">Konsumsi Latihan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Jumlah (Rp)</label>
                <input type="number" className="input font-mono" placeholder="50000" value={jumlah} onChange={e => setJumlah(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Tanggal</label>
                <input type="date" className="input" value={tanggal} onChange={e => setTanggal(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Keterangan Transaksi</label>
              <input className="input" placeholder="misal: Pembelian arang & wiruk baru" value={keterangan} onChange={e => setKeterangan(e.target.value)} required />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">URL Bukti / Nota (Opsional)</label>
              <input className="input" placeholder="https://..." value={buktiUrl} onChange={e => setBuktiUrl(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Batal</button>
              <button type="submit" disabled={submitting} className="btn-primary">Simpan Transaksi</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
