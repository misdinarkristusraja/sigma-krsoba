import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { useSwapRequests } from '../hooks/useSwapRequests';
import { useSchedule } from '../hooks/useSchedule';
import { useMemberStats } from '../hooks/useMemberStats';
import { useOptinWindow } from '../hooks/useOptinWindow';
import { useCountUp } from '../hooks/useCountUp';
import { formatDate } from '../lib/utils';
import { effectiveDate, slotLabel } from '../lib/swapUtils';
import { cardVariants, rowVariants, staggerContainer, fadeIn } from '../lib/motion';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { LiturgyBadge } from '../components/ui/LiturgyBadge';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Calendar, Clock, Trophy, ArrowLeftRight, QrCode,
  CheckCircle, AlertTriangle, ChevronRight, Star, Zap, Bell, PlayCircle, Save, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const KONDISI_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  K1:  { label: 'Mengganti + Latihan',        color: 'text-purple-600',  icon: '🌟' },
  K2a: { label: 'Hadir Lengkap',              color: 'text-green-600',   icon: '⭐' },
  K2b: { label: 'Hadir Lengkap (Pengganti)',  color: 'text-emerald-600', icon: '⭐' },
  K3a: { label: 'Hadir Tugas (Terjadwal)',    color: 'text-blue-600',    icon: '✓'  },
  K3b: { label: 'Mengganti Mendadak',         color: 'text-sky-600',     icon: '↑'  },
  K3c: { label: 'Hadir Tugas (Pengganti)',    color: 'text-cyan-600',    icon: '✓'  },
  K4a: { label: 'Hadir Latihan',              color: 'text-teal-600',    icon: '+'  },
  K4c: { label: 'Latihan (terjadwal, no tugas)', color: 'text-yellow-600', icon: '+' },
  K6:  { label: 'Absen (Penalti)',            color: 'text-red-600',     icon: '✗'  },
  // Legacy codes from old 6-kondisi system — display until cron re-calculates all rows
  K2:  { label: 'Hadir Lengkap (lama)',       color: 'text-green-600',   icon: '⭐' },
  K3:  { label: 'Hadir Tugas (lama)',         color: 'text-blue-600',    icon: '✓'  },
  K4:  { label: 'Mengganti (lama)',           color: 'text-sky-600',     icon: '↑'  },
  K5:  { label: 'Hadir Latihan (lama)',       color: 'text-teal-600',    icon: '+'  },
};

export default function DashboardPage() {
  const { profile, isPengurus, isPelatih, fetchProfile } = useAuth();

  const { data: upcomingEvents, loading: loadingEvents } = useEvents(3);
  const { data: swapBoard }                              = useSwapRequests({ mode: 'board', limit: 5, userId: profile?.id });
  const { data: mySchedule }                             = useSchedule(profile?.id);
  const { data: stats, loading: loadingStats }           = useMemberStats(profile?.id);
  const { isOpen: optinWindow }                          = useOptinWindow();

  const [pendingRegs,   setPending]      = useState(0);
  const [pengurusStats, setPengurusStats]= useState<any>(null);
  const [loadingPStats, setLoadingPStats]= useState(false);
  const [reregBanner,   setReregBanner]  = useState<'open_not_done' | 'open_done' | null>(null);
  const [nduBanner,     setNduBanner]    = useState(false);
  const [nduValue,      setNduValue]     = useState('');
  const [savingNdu,     setSavingNdu]    = useState(false);

  useEffect(() => {
    if (!isPengurus) return;
    loadPendingRegs();
    loadPengurusStats();
  }, [isPengurus]);

  useEffect(() => {
    if (!profile) return;
    checkReregBanner();
  }, [profile]);

  async function checkReregBanner() {
    const { data: cfgRows } = await (supabase as any)
      .from('system_config')
      .select('key, value')
      .in('key', ['rereg_open_date', 'rereg_close_date', 'rereg_tahun']);
    if (!cfgRows) return;
    const cfg: Record<string, string> = {};
    cfgRows.forEach((r: any) => { cfg[r.key] = r.value; });

    const tahun = parseInt(cfg.rereg_tahun || String(new Date().getFullYear()));
    if ((profile as any)?.registration_year === tahun) return;

    const { data: reregData } = await (supabase as any)
      .from('reregistrations')
      .select('id')
      .eq('user_id', profile!.id)
      .eq('tahun', tahun)
      .maybeSingle();

    const hasRereg = !!reregData;
    const hasNdu   = !!(profile as any)?.nomor_data_umat;

    // Sudah rereg tapi belum isi nomor_data_umat → prioritaskan banner NDU
    if (hasRereg && !hasNdu) {
      setNduBanner(true);
      setReregBanner('open_done');
      return;
    }

    if (!cfg.rereg_open_date || !cfg.rereg_close_date) return;
    const now   = new Date();
    const open  = new Date(cfg.rereg_open_date);
    const close = new Date(cfg.rereg_close_date + 'T23:59:59');
    if (isNaN(open.getTime()) || isNaN(close.getTime())) return;
    if (now < open || now > close) return;

    setReregBanner(hasRereg ? 'open_done' : 'open_not_done');
  }

  async function saveNdu() {
    if (!nduValue.trim() || !profile) return;
    setSavingNdu(true);
    const { error } = await (supabase as any)
      .from('users')
      .update({ nomor_data_umat: nduValue.trim() })
      .eq('id', profile.id);
    setSavingNdu(false);
    if (error) { toast.error('Gagal simpan: ' + error.message); return; }
    await fetchProfile();
    setNduBanner(false);
    toast.success('Nomor Data Umat berhasil disimpan!');
  }

  async function loadPendingRegs() {
    const { count } = await supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Pending');
    setPending(count || 0);
  }

  async function loadPengurusStats() {
    setLoadingPStats(true);
    const today      = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
    const todayStr   = today.toISOString().split('T')[0];

    const [
      { count: totalAktif },
      { count: totalPending },
      { count: scanBulanIni },
      { count: jadwalBulanIni },
      { count: tukarBulanIni },
    ] = await Promise.all([
      supabase.from('users').select('*', { count:'exact', head:true })
        .eq('status','Active').in('role',['Misdinar_Aktif','Misdinar_Retired']),
      supabase.from('users').select('*', { count:'exact', head:true }).eq('status','Pending'),
      supabase.from('scan_records').select('*', { count:'exact', head:true })
        .gte('timestamp', monthStart + 'T00:00:00'),
      supabase.from('assignments').select('*', { count:'exact', head:true })
        .gte('created_at', monthStart + 'T00:00:00'),
      supabase.from('swap_requests').select('*', { count:'exact', head:true })
        .gte('created_at', monthStart + 'T00:00:00'),
    ]);

    const { data: assignedIds } = await supabase.from('assignments')
      .select('user_id, events(tanggal_tugas)')
      .gte('events.tanggal_tugas', monthStart)
      .lte('events.tanggal_tugas', todayStr);

    const { data: scannedIds } = await supabase.from('scan_records')
      .select('user_id').gte('timestamp', monthStart + 'T00:00:00')
      .in('scan_type', ['tugas','walkin_tugas']);

    const scannedSet = new Set((scannedIds||[]).map((s: any) => s.user_id));
    const absenCount = (assignedIds||[]).filter((a: any) => a.events && !scannedSet.has(a.user_id)).length;

    setPengurusStats({
      totalAktif:     totalAktif     || 0,
      totalPending:   totalPending   || 0,
      scanBulanIni:   scanBulanIni   || 0,
      jadwalBulanIni: jadwalBulanIni || 0,
      tukarBulanIni:  tukarBulanIni  || 0,
      absenBulanIni:  absenCount,
    });
    setLoadingPStats(false);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat Pagi';
    if (h < 15) return 'Selamat Siang';
    if (h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const nama = profile?.nama_panggilan || profile?.nickname || '';

  // Recharts data: oldest first, last 8 weeks
  const chartData = [...stats.history].reverse().map(r => ({
    week: formatDate(r.week_start, 'dd/MM'),
    poin: r.poin,
  }));

  return (
    <div className="space-y-6">
      {/* Majestic Royal Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-brand-800 to-amber-700 p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none">
          <Star size={240} className="text-amber-300" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-semibold tracking-wide border border-amber-300/30">
              ✨ SIGMA v.2 — Kristus Raja
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Berkah Dalem{nama ? `, ${nama}` : ''}! 👋
            </h1>
            <p className="text-brand-100 text-xs sm:text-sm font-medium">
              "Serve the Lord with Gladness" — Melayani dengan Sukacita dan Kesetiaan.
            </p>
          </div>

          {isPengurus && pendingRegs > 0 && (
            <Link to="/anggota" className="flex items-center gap-2 bg-amber-400 text-slate-950 font-bold rounded-2xl px-4 py-2.5 shadow-lg hover:bg-amber-300 transition-all hover:scale-105">
              <Bell size={16} className="animate-bounce" />
              <span className="text-xs">{pendingRegs} Pendaftar Baru</span>
            </Link>
          )}
        </div>
      </div>

      {/* Banner Daftar Ulang */}
      {reregBanner === 'open_not_done' && (
        <Link to="/daftar-ulang"
          className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-4 hover:bg-amber-100 transition-colors">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Daftar Ulang Sedang Dibuka!</p>
            <p className="text-xs text-amber-600 mt-0.5">Kamu belum daftar ulang. Klik untuk mengisi sekarang sebelum masa daftar ulang berakhir.</p>
          </div>
          <ChevronRight size={16} className="text-amber-500 shrink-0" />
        </Link>
      )}
      {reregBanner === 'open_done' && !nduBanner && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-4">
          <CheckCircle size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Daftar Ulang Selesai</p>
            <p className="text-xs text-green-600 mt-0.5">Kamu sudah berhasil daftar ulang tahun ini.</p>
          </div>
        </div>
      )}

      {/* Banner NDU — wajib isi jika sudah rereg tapi belum ada nomor */}
      {nduBanner && (
        <div className="bg-orange-50 dark:bg-orange-950/40 border-2 border-orange-300 dark:border-orange-700/80 rounded-2xl px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-orange-800 dark:text-orange-300 text-sm">Lengkapi Nomor Data Umat</p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Kamu sudah daftar ulang, tapi <strong>Nomor Data Umat</strong> belum diisi.
                Tanyakan ke <strong>PIC Data Umat Lingkungan</strong>, lalu isi di bawah ini.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              className="input font-mono text-sm flex-1"
              placeholder="Contoh: 1111"
              maxLength={20}
              value={nduValue}
              onChange={e => setNduValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveNdu(); }}
            />
            <button
              onClick={saveNdu}
              disabled={savingNdu || !nduValue.trim()}
              className="btn-primary gap-2 px-4 disabled:opacity-50"
            >
              {savingNdu
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <Save size={15}/>
              }
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Pengurus stats */}
      {isPengurus && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Statistik Bulan Ini</h2>
            {loadingPStats && <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-800 rounded-full animate-spin"/>}
          </div>
          {pengurusStats ? (
            <motion.div
              className="grid grid-cols-3 sm:grid-cols-6 gap-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {[
                { label:'Misdinar Aktif',  val: pengurusStats.totalAktif,     color:'bg-brand-50 dark:bg-amber-950/40 text-brand-800 dark:text-amber-300'   },
                { label:'Pendaftar Baru',  val: pengurusStats.totalPending,   color:'bg-yellow-50 dark:bg-amber-950/40 text-yellow-700 dark:text-amber-400' },
                { label:'Total Scan',      val: pengurusStats.scanBulanIni,   color:'bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-300'   },
                { label:'Jadwal Dibuat',   val: pengurusStats.jadwalBulanIni, color:'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'     },
                { label:'Tukar Jadwal',    val: pengurusStats.tukarBulanIni,  color:'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' },
                { label:'Absen Bulan Ini', val: pengurusStats.absenBulanIni,  color:'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'       },
              ].map((s, i) => (
                <AnimatedStatMini key={s.label} label={s.label} val={s.val} color={s.color} index={i} />
              ))}
            </motion.div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-16 rounded-xl"/>)}
            </div>
          )}
        </div>
      )}

      {/* Opt-in alert */}
      {optinWindow && profile?.role === 'Misdinar_Aktif' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Bell size={20} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">Window Opt-in Misa Harian Terbuka!</p>
            <p className="text-xs text-blue-600">Isi kesediaan kamu untuk Misa Harian bulan depan sebelum tanggal 20.</p>
          </div>
          <Link to="/jadwal-harian" className="btn-primary btn-sm">Isi Sekarang</Link>
        </div>
      )}

      {/* Stat cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          icon={<Star size={20} className="text-yellow-500" />}
          label="Total Poin"
          value={loadingStats ? null : stats.totalPoin}
          sub="Akumulasi"
          color="bg-yellow-50"
          index={0}
        />
        <StatCard
          icon={<Zap size={20} className="text-green-500" />}
          label="Poin Minggu Ini"
          value={loadingStats ? null : (stats.thisWeek?.poin ?? 0)}
          sub={stats.thisWeek?.kondisi ? `Kondisi ${stats.thisWeek.kondisi}` : 'Belum ada'}
          color="bg-green-50"
          index={1}
        />
        <StatCard
          icon={<Calendar size={20} className="text-blue-500" />}
          label="Jadwal Mendatang"
          value={mySchedule.length}
          sub="Tugas"
          color="bg-blue-50"
          index={2}
        />
        <StatCard
          icon={<ArrowLeftRight size={20} className="text-purple-500" />}
          label="Penawaran"
          value={swapBoard.length}
          sub="Tersedia"
          color="bg-purple-50"
          index={3}
        />
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upcoming events */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-brand-800 dark:text-brand-400" /> Misa Mendatang
              </h2>
              <Link to="/jadwal" className="text-xs text-brand-800 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1">
                Lihat semua <ChevronRight size={14} />
              </Link>
            </div>
            {loadingEvents ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : upcomingEvents.length === 0 ? (
              <EmptyState title="Belum ada jadwal mendatang" />
            ) : (
              <motion.div
                className="space-y-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {upcomingEvents.map((ev, i) => (
                  <motion.div
                    key={ev.id}
                    custom={i}
                    variants={rowVariants}
                    className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{formatDate(ev.tanggal_tugas, 'EEEE, dd MMM yyyy')}</p>
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">{ev.perayaan || ev.nama_event}</p>
                    </div>
                    <LiturgyBadge warna={ev.warna_liturgi} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* My schedule */}
          {mySchedule.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock size={18} className="text-brand-800 dark:text-brand-400" /> Jadwal Kamu
                </h2>
                <Link to="/jadwal-saya" className="text-xs text-brand-800 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1">
                  Lihat semua <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-2">
                {mySchedule.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-brand-50 dark:bg-slate-800/90 rounded-xl border border-brand-100 dark:border-slate-700">
                    <CheckCircle size={16} className="text-brand-800 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{a.events?.perayaan || a.events?.nama_event}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {formatDate(effectiveDate(a.events?.tanggal_tugas, a.slot_number, a.events?.tipe_event), 'EEEE, dd MMM')} · {slotLabel(a.slot_number, a.events?.tipe_event)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Poin mini chart */}
          {chartData.length > 1 && (
            <motion.div className="card" variants={fadeIn} initial="hidden" animate="visible">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" /> Tren Poin 8 Minggu
              </h2>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="poinGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c1d1d" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#7c1d1d" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="poin" stroke="#8B0000" fillOpacity={1} fill="url(#poinGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <Link to="/rekap" className="mt-2 text-xs text-brand-800 dark:text-amber-400 hover:underline flex items-center gap-1">
                Lihat rekap lengkap <ChevronRight size={12} />
              </Link>
            </motion.div>
          )}
        </div>

        {/* Right col */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Aksi Cepat</h2>
            <div className="space-y-2">
              {isPengurus && (
                <Link to="/pengurus/ketua" className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-900 to-purple-900 text-white hover:opacity-95 transition-all shadow-md">
                  <ShieldCheck size={20} className="text-amber-300 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-bold leading-tight">Dashboard Pengurus</div>
                    <div className="text-[10px] text-red-200">Executive &amp; Divisi Suite</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-amber-300" />
                </Link>
              )}
              {isPelatih && (
                <Link to="/scan-qr" className="flex items-center gap-3 p-3 rounded-xl bg-brand-800 dark:bg-amber-600 text-white dark:text-slate-950 hover:bg-brand-900 transition-colors font-bold">
                  <QrCode size={18} />
                  <span className="text-sm">Scan QR Absensi</span>
                  <ChevronRight size={16} className="ml-auto" />
                </Link>
              )}
              {isPengurus && (
                <Link to="/jadwal-mingguan" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <Calendar size={18} className="text-brand-800 dark:text-amber-400" />
                  <span className="text-sm font-semibold">Buat Jadwal</span>
                  <ChevronRight size={16} className="ml-auto text-gray-400 dark:text-slate-400" />
                </Link>
              )}
              <Link to="/tukar-jadwal" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeftRight size={18} className="text-brand-800 dark:text-amber-400" />
                <span className="text-sm font-semibold">Tukar Jadwal</span>
                <ChevronRight size={16} className="ml-auto text-gray-400 dark:text-slate-400" />
              </Link>
              <Link to="/kartu" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <QrCode size={18} className="text-brand-800 dark:text-amber-400" />
                <span className="text-sm font-semibold">Kartu Anggota</span>
                <ChevronRight size={16} className="ml-auto text-gray-400 dark:text-slate-400" />
              </Link>
              <a href="https://youtu.be/zVN7jL6fUqQ" target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <PlayCircle size={18} className="text-brand-800 dark:text-amber-400" />
                <span className="text-sm font-semibold">Video Tutorial</span>
                <ChevronRight size={16} className="ml-auto text-gray-400 dark:text-slate-400" />
              </a>
            </div>
          </div>

          {/* Swap board preview */}
          {swapBoard.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" /> Penawaran Tugas
                </h2>
                <Link to="/tukar-jadwal" className="text-xs text-brand-800 dark:text-amber-400 hover:underline font-semibold">Lihat semua</Link>
              </div>
              <div className="space-y-2">
                {swapBoard.slice(0,3).map((s: any) => (
                  <div key={s.id} className="p-2.5 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-100 dark:border-orange-900/60">
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-100">{s.requester?.nama_panggilan}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {formatDate(effectiveDate(s.assignment?.events?.tanggal_tugas, s.assignment?.slot_number, s.assignment?.events?.tipe_event), 'dd MMM')} · {s.assignment?.events?.perayaan || s.assignment?.events?.nama_event || 'Jadwal Misa'} · {slotLabel(s.assignment?.slot_number, s.assignment?.events?.tipe_event)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Poin history */}
          {stats.history.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> Riwayat Poin
              </h2>
              <div className="space-y-1.5">
                {stats.history.slice(0,5).map((r, i) => {
                  const kl = KONDISI_LABELS[r.kondisi];
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{formatDate(r.week_start, 'dd MMM')}</span>
                      <span className={kl?.color || 'text-gray-400'}>{kl?.icon} {kl?.label || '—'}</span>
                      <span className={`font-bold ${r.poin > 0 ? 'text-green-600' : r.poin < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {r.poin > 0 ? '+' : ''}{r.poin}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, index = 0 }: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  sub: string;
  color: string;
  index?: number;
}) {
  const counted = useCountUp(value ?? 0, 800, index * 80);
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      className={`card ${color} dark:bg-slate-900 dark:border-slate-800 card-hover`}
    >
      <motion.div
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ delay: index * 0.08 + 0.4, duration: 0.5, ease: 'easeInOut' }}
      >
        {icon}
      </motion.div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {value === null ? (
            <span className="skeleton inline-block w-10 h-6 rounded align-middle" />
          ) : counted}
        </div>
        <div className="text-xs font-semibold text-gray-700 dark:text-slate-300 mt-0.5">{label}</div>
        <div className="text-xs text-gray-400 dark:text-slate-400">{sub}</div>
      </div>
    </motion.div>
  );
}

function AnimatedStatMini({ label, val, color, index }: {
  label: string; val: number; color: string; index: number;
}) {
  const counted = useCountUp(val, 700, index * 60);
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      className={`${color} dark:bg-slate-800 dark:text-slate-100 rounded-xl p-3 text-center`}
    >
      <div className="text-2xl font-black">{counted}</div>
      <div className="text-[10px] font-medium mt-0.5 opacity-80 leading-tight">{label}</div>
    </motion.div>
  );
}
