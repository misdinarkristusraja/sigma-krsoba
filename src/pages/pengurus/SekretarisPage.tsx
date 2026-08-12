import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Plus, Calendar, User, FilePlus, Download, CheckCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SekretarisPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'notula' | 'surat'>('notula');
  const [loading, setLoading] = useState(true);
  const [notulaList, setNotulaList] = useState<any[]>([]);
  const [suratList, setSuratList] = useState<any[]>([]);

  // Modal form states
  const [showNotulaModal, setShowNotulaModal] = useState(false);
  const [notJudul, setNotJudul] = useState('');
  const [notTanggal, setNotTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [notPeserta, setNotPeserta] = useState('');
  const [notIsi, setNotIsi] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showSuratModal, setShowSuratModal] = useState(false);
  const [surNomor, setSurNomor] = useState('');
  const [surTipe, setSurTipe] = useState<'Masuk' | 'Keluar'>('Masuk');
  const [surPerihal, setSurPerihal] = useState('');
  const [surTanggal, setSurTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [surFileUrl, setSurFileUrl] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, sRes] = await Promise.all([
        supabase.from('pengurus_sekre_notula').select('*, created_user:created_by(nama_panggilan)').order('tanggal', { ascending: false }),
        supabase.from('pengurus_sekre_surat').select('*, created_user:created_by(nama_panggilan)').order('tanggal', { ascending: false })
      ]);
      setNotulaList(nRes.data || []);
      setSuratList(sRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddNotula(e: React.FormEvent) {
    e.preventDefault();
    if (!notJudul || !notIsi) { toast.error('Isi judul dan notula pertemuan'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('pengurus_sekre_notula').insert({
      judul: notJudul,
      tanggal: notTanggal,
      peserta: notPeserta,
      isi_notula: notIsi,
      created_by: profile?.id
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Notula berhasil dicatat');
    setShowNotulaModal(false);
    setNotJudul(''); setNotIsi('');
    loadData();
  }

  async function handleAddSurat(e: React.FormEvent) {
    e.preventDefault();
    if (!surNomor || !surPerihal) { toast.error('Isi nomor surat dan perihal'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('pengurus_sekre_surat').insert({
      nomor_surat: surNomor,
      tipe: surTipe,
      perihal: surPerihal,
      tanggal: surTanggal,
      file_url: surFileUrl,
      created_by: profile?.id
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Surat berhasil diarsipkan');
    setShowSuratModal(false);
    setSurNomor(''); setSurPerihal(''); setSurFileUrl('');
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('notula')}
            className={`btn-sm gap-1.5 ${tab === 'notula' ? 'btn-primary' : 'btn-outline'}`}
          >
            <FileText size={15} /> Notula Pertemuan ({notulaList.length})
          </button>
          <button
            onClick={() => setTab('surat')}
            className={`btn-sm gap-1.5 ${tab === 'surat' ? 'btn-primary' : 'btn-outline'}`}
          >
            <FilePlus size={15} /> Arsip Surat ({suratList.length})
          </button>
        </div>

        {tab === 'notula' ? (
          <button onClick={() => setShowNotulaModal(true)} className="btn-primary btn-sm gap-1">
            <Plus size={14} /> Catat Notula Baru
          </button>
        ) : (
          <button onClick={() => setShowSuratModal(true)} className="btn-primary btn-sm gap-1">
            <Plus size={14} /> Arsipkan Surat Baru
          </button>
        )}
      </div>

      {/* Notula Section */}
      {tab === 'notula' && (
        <div className="space-y-4">
          {notulaList.length === 0 ? (
            <div className="card text-center py-10 text-gray-400 dark:text-slate-500">
              <FileText size={40} className="mx-auto mb-2 opacity-30" />
              <p>Belum ada catatan notula pertemuan.</p>
            </div>
          ) : (
            notulaList.map((n) => (
              <div key={n.id} className="card p-5 border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{n.judul}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><Calendar size={13} /> {n.tanggal}</span>
                      {n.peserta && <span className="flex items-center gap-1"><User size={13} /> Peserta: {n.peserta}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                    Oleh: {n.created_user?.nama_panggilan || 'Sekretaris'}
                  </span>
                </div>
                <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
                  {n.isi_notula}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Surat Section */}
      {tab === 'surat' && (
        <div className="card p-0 overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>No. Surat</th>
                <th>Tipe</th>
                <th>Perihal</th>
                <th>Tanggal</th>
                <th>Diarsipkan Oleh</th>
                <th>Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {suratList.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 dark:text-slate-500">Belum ada arsip surat</td></tr>
              ) : (
                suratList.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-bold text-gray-900 dark:text-white">{s.nomor_surat}</td>
                    <td>
                      <span className={`badge ${s.tipe === 'Masuk' ? 'badge-blue' : 'badge-green'}`}>
                        {s.tipe}
                      </span>
                    </td>
                    <td className="text-sm font-medium text-gray-800 dark:text-slate-200">{s.perihal}</td>
                    <td className="text-xs text-gray-500 dark:text-slate-400">{s.tanggal}</td>
                    <td className="text-xs text-gray-500 dark:text-slate-400">{s.created_user?.nama_panggilan || '—'}</td>
                    <td>
                      {s.file_url ? (
                        <a href={s.file_url} target="_blank" rel="noreferrer" className="btn-ghost btn-xs text-brand-800 dark:text-amber-400 gap-1">
                          <Download size={12} /> Buka File
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add Notula */}
      {showNotulaModal && (
        <div className="modal-overlay">
          <form onSubmit={handleAddNotula} className="modal-card p-6 w-full max-w-lg space-y-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Catat Notula Pertemuan</h3>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Judul / Agenda Meeting</label>
              <input className="input" placeholder="misal: Rapat Evaluasi Tri Wulan" value={notJudul} onChange={e => setNotJudul(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Tanggal</label>
                <input type="date" className="input" value={notTanggal} onChange={e => setNotTanggal(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Peserta Hadir</label>
                <input className="input" placeholder="Pengurus, Pembina" value={notPeserta} onChange={e => setNotPeserta(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Isi Notula / Keputusan</label>
              <textarea className="input h-32" placeholder="Tuliskan poin-poin hasil rapat..." value={notIsi} onChange={e => setNotIsi(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNotulaModal(false)} className="btn-outline">Batal</button>
              <button type="submit" disabled={submitting} className="btn-primary">Simpan Notula</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Surat */}
      {showSuratModal && (
        <div className="modal-overlay">
          <form onSubmit={handleAddSurat} className="modal-card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Arsipkan Surat</h3>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Nomor Surat</label>
              <input className="input" placeholder="001/MIS/07/2026" value={surNomor} onChange={e => setSurNomor(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Tipe Surat</label>
                <select className="input" value={surTipe} onChange={e => setSurTipe(e.target.value as any)}>
                  <option value="Masuk">Surat Masuk</option>
                  <option value="Keluar">Surat Keluar</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Tanggal</label>
                <input type="date" className="input" value={surTanggal} onChange={e => setSurTanggal(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Perihal / Subjek</label>
              <input className="input" placeholder="Permohonan Tugas Misa Wilayah" value={surPerihal} onChange={e => setSurPerihal(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">URL Dokumen / Cloud Link (Opsional)</label>
              <input className="input" placeholder="https://drive.google.com/..." value={surFileUrl} onChange={e => setSurFileUrl(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowSuratModal(false)} className="btn-outline">Batal</button>
              <button type="submit" disabled={submitting} className="btn-primary">Arsipkan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
