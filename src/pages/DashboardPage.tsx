import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { useSwapRequests } from '../hooks/useSwapRequests';
import { useSchedule } from '../hooks/useSchedule';
import { useMemberStats } from '../hooks/useMemberStats';
import { useOptinWindow } from '../hooks/useOptinWindow';
import { formatDate } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { LiturgyBadge } from '../components/ui/LiturgyBadge';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Calendar, Clock, Trophy, ArrowLeftRight, QrCode,
  CheckCircle, AlertTriangle, ChevronRight, Star, Zap, Bell,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

const KONDISI_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  K1: { label: 'Tugas + Latihan',   color: 'text-green-600',  icon: '⭐' },
  K2: { label: 'Walk-in + Latihan', color: 'text-blue-600',   icon: '🌟' },
  K3: { label: 'Tugas saja',        color: 'text-yellow-600', icon: '✓'  },
  K4: { label: 'Walk-in saja',      color: 'text-orange-600', icon: '↑'  },
  K5: { label: 'Latihan saja',      color: 'text-teal-600',   icon: '+'  },
  K6: { label: 'Absen (Penalty)',   color: 'text-red-600',    icon: '✗'  },
};

export default function DashboardPage() {
  const { profile, isPengurus, isPelatih } = useAuth();

  const { data: upcomingEvents, loading: loadingEvents } = useEvents(3);
  const { data: swapBoard }                              = useSwapRequests({ mode: 'board', limit: 5 });
  const { data: mySchedule }                             = useSchedule(profile?.id);
  const { data: stats, loading: loadingStats }           = useMemberStats(profile?.id);
  const { isOpen: optinWindow }                          = useOptinWindow();

  const [pendingRegs,   setPending]      = useState(0);
  const [pengurusStats, setPengurusStats]= useState<any>(null);
  const [loadingPStats, setLoadingPStats]= useState(false);

  useEffect(() => {
    if (!isPengurus) return;
    loadPendingRegs();
    loadPengurusStats();
  }, [isPengurus]);

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
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">
            {greeting()}{nama ? `, ${nama}` : ''}!
          </h1>
          <p className="page-subtitle">Serve the Lord with Gladness</p>
        </div>

        {isPengurus && pendingRegs > 0 && (
          <Link to="/anggota" className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 hover:bg-yellow-100 transition-colors">
            <Bell size={16} className="text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-700">{pendingRegs} pendaftar baru</span>
          </Link>
        )}
      </div>

      {/* Pengurus stats */}
      {isPengurus && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Statistik Bulan Ini</h2>
            {loadingPStats && <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-800 rounded-full animate-spin"/>}
          </div>
          {pengurusStats ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label:'Misdinar Aktif',  val: pengurusStats.totalAktif,     color:'bg-brand-50 text-brand-800'   },
                { label:'Pendaftar Baru',  val: pengurusStats.totalPending,   color:'bg-yellow-50 text-yellow-700' },
                { label:'Total Scan',      val: pengurusStats.scanBulanIni,   color:'bg-green-50 text-green-700'   },
                { label:'Jadwal Dibuat',   val: pengurusStats.jadwalBulanIni, color:'bg-blue-50 text-blue-700'     },
                { label:'Tukar Jadwal',    val: pengurusStats.tukarBulanIni,  color:'bg-purple-50 text-purple-700' },
                { label:'Absen Bulan Ini', val: pengurusStats.absenBulanIni,  color:'bg-red-50 text-red-700'       },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                  <div className="text-2xl font-black">{s.val}</div>
                  <div className="text-[10px] font-medium mt-0.5 opacity-80 leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Star size={20} className="text-yellow-500" />}
          label="Total Poin"
          value={loadingStats ? '…' : stats.totalPoin}
          sub="Akumulasi"
          color="bg-yellow-50"
        />
        <StatCard
          icon={<Zap size={20} className="text-green-500" />}
          label="Poin Minggu Ini"
          value={loadingStats ? '…' : (stats.thisWeek?.poin ?? 0)}
          sub={stats.thisWeek?.kondisi ? `Kondisi ${stats.thisWeek.kondisi}` : 'Belum ada'}
          color="bg-green-50"
        />
        <StatCard
          icon={<Calendar size={20} className="text-blue-500" />}
          label="Jadwal Mendatang"
          value={mySchedule.length}
          sub="Tugas"
          color="bg-blue-50"
        />
        <StatCard
          icon={<ArrowLeftRight size={20} className="text-purple-500" />}
          label="Penawaran"
          value={swapBoard.length}
          sub="Tersedia"
          color="bg-purple-50"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upcoming events */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-brand-800" /> Misa Mendatang
              </h2>
              <Link to="/jadwal" className="text-xs text-brand-800 hover:underline flex items-center gap-1">
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
              <div className="space-y-3">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 font-medium">{formatDate(ev.tanggal_tugas, 'EEEE, dd MMM yyyy')}</p>
                      <p className="font-semibold text-gray-900 text-sm truncate">{ev.perayaan || ev.nama_event}</p>
                    </div>
                    <LiturgyBadge warna={ev.warna_liturgi} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My schedule */}
          {mySchedule.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Clock size={18} className="text-brand-800" /> Jadwal Kamu
              </h2>
              <div className="space-y-2">
                {mySchedule.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
                    <CheckCircle size={16} className="text-brand-800 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{a.events?.perayaan || a.events?.nama_event}</p>
                      <p className="text-xs text-gray-500">{formatDate(a.events?.tanggal_tugas, 'EEEE, dd MMM')} · Slot {a.slot_number}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Poin mini chart */}
          {chartData.length > 1 && (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: any) => [`${v} poin`, 'Poin']}
                  />
                  <Area type="monotone" dataKey="poin" stroke="#7c1d1d" fill="url(#poinGrad)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
              <Link to="/rekap" className="mt-2 text-xs text-brand-800 hover:underline flex items-center gap-1">
                Lihat rekap lengkap <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>

        {/* Right col */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aksi Cepat</h2>
            <div className="space-y-2">
              {isPelatih && (
                <Link to="/scan-qr" className="flex items-center gap-3 p-3 rounded-xl bg-brand-800 text-white hover:bg-brand-900 transition-colors">
                  <QrCode size={18} />
                  <span className="text-sm font-semibold">Scan QR Absensi</span>
                  <ChevronRight size={16} className="ml-auto" />
                </Link>
              )}
              {isPengurus && (
                <Link to="/jadwal-mingguan" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Calendar size={18} className="text-brand-800" />
                  <span className="text-sm font-medium text-gray-700">Buat Jadwal</span>
                  <ChevronRight size={16} className="ml-auto text-gray-400" />
                </Link>
              )}
              <Link to="/tukar-jadwal" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <ArrowLeftRight size={18} className="text-brand-800" />
                <span className="text-sm font-medium text-gray-700">Tukar Jadwal</span>
                <ChevronRight size={16} className="ml-auto text-gray-400" />
              </Link>
              <Link to="/kartu" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <QrCode size={18} className="text-brand-800" />
                <span className="text-sm font-medium text-gray-700">Kartu Anggota</span>
                <ChevronRight size={16} className="ml-auto text-gray-400" />
              </Link>
            </div>
          </div>

          {/* Swap board preview */}
          {swapBoard.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" /> Penawaran Tugas
                </h2>
                <Link to="/tukar-jadwal" className="text-xs text-brand-800 hover:underline">Lihat semua</Link>
              </div>
              <div className="space-y-2">
                {swapBoard.slice(0,3).map((s: any) => (
                  <div key={s.id} className="p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs font-semibold text-gray-800">{s.requester?.nama_panggilan}</p>
                    <p className="text-xs text-gray-500">{s.assignment?.events?.nama_event} · Slot {s.assignment?.slot_number}</p>
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

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  color: string;
}) {
  return (
    <div className={`card ${color} border-0`}>
      <div>{icon}</div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
    </div>
  );
}
