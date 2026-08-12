import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Users, Calendar, Wallet, FileText, Video, Camera, Shirt, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function KetuaPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalNotula: 0,
    totalSurat: 0,
    totalKas: 0,
    totalContent: 0,
    totalChecklists: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mCount, nCount, sCount, kData, cCount, chCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('pengurus_sekre_notula').select('*', { count: 'exact', head: true }),
        supabase.from('pengurus_sekre_surat').select('*', { count: 'exact', head: true }),
        supabase.from('pengurus_kas').select('tipe, jumlah'),
        supabase.from('pengurus_multimedia_content').select('*', { count: 'exact', head: true }),
        supabase.from('pengurus_putsankris_checklists').select('*', { count: 'exact', head: true })
      ]);

      let saldo = 0;
      (kData.data || []).forEach((r: any) => {
        if (r.tipe === 'Pemasukan') saldo += Number(r.jumlah || 0);
        if (r.tipe === 'Pengeluaran') saldo -= Number(r.jumlah || 0);
      });

      setStats({
        totalMembers: mCount.count || 0,
        totalNotula: nCount.count || 0,
        totalSurat: sCount.count || 0,
        totalKas: saldo,
        totalContent: cCount.count || 0,
        totalChecklists: chCount.count || 0
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Executive Dashboard Ketua &amp; Coordination</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Ringkasan status seluruh divisi dan operasional kepengurusan Misdinar.</p>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/anggota" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Anggota Aktif</span>
            <Users size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalMembers}</p>
        </Link>

        <Link to="/pengurus/bendahara" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Saldo Kas</span>
            <Wallet size={18} />
          </div>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">Rp {stats.totalKas.toLocaleString('id-ID')}</p>
        </Link>

        <Link to="/pengurus/sekretaris" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Notula &amp; Surat</span>
            <FileText size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalNotula + stats.totalSurat}</p>
        </Link>

        <Link to="/pengurus/multimedia" className="card p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Jadwal Konten</span>
            <Video size={18} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalContent}</p>
        </Link>
      </div>

      {/* Quick Division Directives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <ShieldCheck size={18} className="text-red-700 dark:text-red-400" /> Pengawasan &amp; Tata Kelola Divisi
          </h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            Sebagai Ketua / Executive, Anda memiliki akses penuh untuk memantau notula rapat dari Sekretaris, arus kas dari Bendahara, presensi foto dari Sakristan, hingga checklist busana dari Putsankris.
          </p>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Shirt size={18} className="text-purple-700 dark:text-purple-400" /> Kesiapan Alat &amp; Misa Pekan Ini
          </h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            Audit kesiapan peralatan liturgi oleh Putsankris mencatat total <strong className="text-gray-900 dark:text-slate-100">{stats.totalChecklists} kali audit Misa</strong> yang telah terverifikasi.
          </p>
        </div>
      </div>
    </div>
  );
}
