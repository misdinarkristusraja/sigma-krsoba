import React, { useState, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';
import {
  RefreshCw, Download, ChevronUp, ChevronDown, X,
  TrendingUp, AlertTriangle, Star, CheckCircle, Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── Skor kualitas (0–100) ──────────────────────────────────────────────────────
// A: Kehadiran tugas  = hadirTugas / effectiveJadwal × 40
//    effectiveJadwal  = jadwalCount - excusedCount (K5 tidak dikurangi)
// B: Kehadiran latihan = hadirLatihan / max(jadwalCount,1) × 20
// C: Rata-rata poin   = avg poin (clamp -1..5 → 0..100) × 25 (termasuk poin_bonus)
// D: Streak           = currentStreak / 8 (capped 8) × 10
// E: Kontribusi swap  = pernah jadi pengganti → +5
function hitungSkorKualitas(m: MemberAnalysis): number {
  const effectiveJadwal = Math.max(1, m.jadwalCount - m.excusedCount);
  const A = Math.min(40, Math.round((m.hadirTugas  / effectiveJadwal) * 40));
  const B = Math.min(20, Math.round((m.hadirLatihan / Math.max(1, m.jadwalCount)) * 20));
  const avgPoin = m.mingguCount > 0 ? m.totalPoin / m.mingguCount : 0;
  const C = Math.round(Math.max(0, Math.min(25, ((avgPoin + 1) / 6) * 25)));
  const D = Math.round(Math.min(10, (m.currentStreak / 8) * 10));
  const E = m.jadiBengganti > 0 ? 5 : 0;
  return A + B + C + D + E;
}

function gradeFromSkor(skor: number): { label: string; color: string; bg: string; icon: string } {
  if (skor >= 75) return { label: 'Sangat Baik',      color: 'text-green-700',  bg: 'bg-green-100',  icon: '🌟' };
  if (skor >= 55) return { label: 'Baik',              color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '✅' };
  if (skor >= 35) return { label: 'Cukup',             color: 'text-yellow-700', bg: 'bg-yellow-100', icon: '⚠️' };
  return                  { label: 'Perlu Perhatian',  color: 'text-red-700',    bg: 'bg-red-100',    icon: '🔴' };
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface MemberAnalysis {
  id:              string;
  nickname:        string;
  nama_panggilan:  string;
  lingkungan:      string;
  pendidikan:      string;
  jadwalCount:     number;  // minggu dijadwalkan (semua kondisi bertugas)
  excusedCount:    number;  // minggu K5 (absen dimaafkan — dikecualikan dari denominator)
  hadirTugas:      number;
  hadirLatihan:    number;
  walkInCount:     number;
  swapRequest:     number;
  jadiBengganti:   number;
  totalPoin:       number;  // rekap mingguan + poin_bonus
  mingguCount:     number;
  currentStreak:   number;
  longestStreak:   number;
  kondisiDist:     Record<string, number>;
  skorKualitas:    number;
  labelOverride?:  'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Perhatian' | null;
  catatanOverride?: string;
}

const RANGE_OPTIONS = [
  { label: '1 Bulan',  months: 1 },
  { label: '3 Bulan',  months: 3 },
  { label: '6 Bulan',  months: 6 },
  { label: 'All Time', months: 0 },
];

const LABEL_OPTIONS = [
  { value: 'Sangat Baik',      color: 'bg-green-100 text-green-800',  icon: '🌟' },
  { value: 'Baik',             color: 'bg-blue-100 text-blue-800',    icon: '✅' },
  { value: 'Cukup',            color: 'bg-yellow-100 text-yellow-800',icon: '⚠️' },
  { value: 'Perlu Perhatian',  color: 'bg-red-100 text-red-800',      icon: '🔴' },
];

const KONDISI_ORDER = ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K5','K6'];

const KONDISI_COLOR: Record<string, string> = {
  K1:  '#7c3aed',
  K2a: '#16a34a',
  K2b: '#059669',
  K3a: '#2563eb',
  K3b: '#0ea5e9',
  K3c: '#06b6d4',
  K4a: '#0d9488',
  K4c: '#ca8a04',
  K5:  '#f59e0b',
  K6:  '#ef4444',
};

type SortKey = 'skor' | 'poin' | 'hadir' | 'streak' | 'nama';

// ──────────────────────────────────────────────────────────────────────────────
export default function AnalisisPage() {
  const { isPengurus } = useAuth();

  const [rangeMonths, setRangeMonths] = useState(3);
  const [members,     setMembers]     = useState<MemberAnalysis[]>([]);
  const [overrides,   setOverrides]   = useState<Record<string, { label?: string; catatan?: string }>>({});
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  const [sortKey,     setSortKey]     = useState<SortKey>('skor');
  const [sortAsc,     setSortAsc]     = useState(false);
  const [selected,    setSelected]    = useState<MemberAnalysis | null>(null);
  const [editLabel,   setEditLabel]   = useState('');
  const [editCatatan, setEditCatatan] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoaded(false);

    const now = new Date();
    let dateFrom = '';
    if (rangeMonths > 0) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - rangeMonths);
      dateFrom = d.toISOString().split('T')[0];
    }
    const todayStr = now.toISOString().split('T')[0];

    const [
      { data: users },
      rekapResult,
      { data: streakData },
      { data: swapReqs },
      { data: penggantiReqs },
      { data: overrideCfg },
      { data: bonusData },
    ] = await Promise.all([
      supabase.from('users')
        .select('id, nickname, nama_panggilan, lingkungan, pendidikan')
        .eq('status', 'Active')
        .in('role', ['Misdinar_Aktif', 'Misdinar_Retired'])
        .order('nama_panggilan'),

      supabase.from('rekap_poin_mingguan')
        .select('user_id, poin, kondisi, week_start')
        .lte('week_start', todayStr)
        .then(({ data, error }: any) => {
          if (error) return { data: [] };
          if (!dateFrom) return { data: data || [] };
          return { data: (data || []).filter((r: any) => r.week_start >= dateFrom) };
        }),

      supabase.from('streaks')
        .select('user_id, current_streak, longest_streak'),

      // swap_requests: requester side
      supabase.from('swap_requests')
        .select('requester_id'),

      // swap_requests: pengganti side (kontribusi)
      supabase.from('swap_requests')
        .select('pengganti_id')
        .eq('status', 'Replaced')
        .not('pengganti_id', 'is', null),

      supabase.from('system_config')
        .select('value')
        .eq('key', 'analisis_label_overrides')
        .maybeSingle(),

      // poin_bonus: untuk total poin akurat (sama seperti LeaderboardPage)
      supabase.from('poin_bonus')
        .select('user_id, poin'),
    ]);

    if (!users?.length) { setLoading(false); return; }

    let savedOverrides: Record<string, { label?: string; catatan?: string }> = {};
    try {
      if (overrideCfg?.value) savedOverrides = JSON.parse(overrideCfg.value);
    } catch { /* ignore */ }
    setOverrides(savedOverrides);

    // Maps
    const streakMap: Record<string, { current: number; longest: number }> = {};
    (streakData || []).forEach((s: any) => {
      streakMap[s.user_id] = { current: s.current_streak || 0, longest: s.longest_streak || 0 };
    });

    const swapReqMap:  Record<string, number> = {};
    const swapDoneMap: Record<string, number> = {};
    (swapReqs || []).forEach((s: any) => {
      if (s.requester_id) swapReqMap[s.requester_id] = (swapReqMap[s.requester_id] || 0) + 1;
    });
    (penggantiReqs || []).forEach((s: any) => {
      if (s.pengganti_id) swapDoneMap[s.pengganti_id] = (swapDoneMap[s.pengganti_id] || 0) + 1;
    });

    // poin_bonus summed per user
    const bonusMap: Record<string, number> = {};
    (bonusData || []).forEach((b: any) => {
      if (b.user_id) bonusMap[b.user_id] = (bonusMap[b.user_id] || 0) + (b.poin || 0);
    });

    // Per-user rekap aggregation
    type RekapAgg = {
      totalPoin:  number;
      mingguCount: number;
      kondisi:    Record<string, number>;
      hadir:      number;  // hadir tugas (K1/K2a/K2b/K3a/K3b/K3c)
      latihan:    number;  // hadir latihan (K1/K2a/K2b/K4a/K4c)
      walkin:     number;  // K1/K3b
      jadwal:     number;  // dijadwalkan: K2a/K2b/K3a/K3c/K4c/K5/K6
      excused:    number;  // K5 (absen dimaafkan)
    };
    const rekapMap: Record<string, RekapAgg> = {};
    (users as any[]).forEach(u => {
      rekapMap[u.id] = { totalPoin: 0, mingguCount: 0, kondisi: {}, hadir: 0, latihan: 0, walkin: 0, jadwal: 0, excused: 0 };
    });
    (rekapResult.data || []).forEach((r: any) => {
      const m = rekapMap[r.user_id];
      if (!m) return;
      m.totalPoin   += r.poin || 0;
      m.mingguCount++;
      if (r.kondisi) m.kondisi[r.kondisi] = (m.kondisi[r.kondisi] || 0) + 1;
      // Hadir tugas
      if (['K1','K2a','K2b','K3a','K3b','K3c'].includes(r.kondisi)) m.hadir++;
      // Hadir latihan
      if (['K1','K2a','K2b','K4a','K4c'].includes(r.kondisi)) m.latihan++;
      // Walk-in
      if (['K1','K3b'].includes(r.kondisi)) m.walkin++;
      // Dijadwalkan (had an assignment that week — includes pengganti K2b/K3c)
      if (['K2a','K2b','K3a','K3c','K4c','K5','K6'].includes(r.kondisi)) m.jadwal++;
      // Excused (K5: absen dimaafkan — tidak dikurangi dari attendance score)
      if (r.kondisi === 'K5') m.excused++;
    });

    const result: MemberAnalysis[] = (users as any[]).map(u => {
      const rm = rekapMap[u.id];
      const sm = streakMap[u.id] || { current: 0, longest: 0 };
      const ov = savedOverrides[u.id];
      const base: MemberAnalysis = {
        id:             u.id,
        nickname:       u.nickname,
        nama_panggilan: u.nama_panggilan,
        lingkungan:     u.lingkungan || '—',
        pendidikan:     u.pendidikan || '—',
        jadwalCount:    rm.jadwal,
        excusedCount:   rm.excused,
        hadirTugas:     rm.hadir,
        hadirLatihan:   rm.latihan,
        walkInCount:    rm.walkin,
        swapRequest:    swapReqMap[u.id]  || 0,
        jadiBengganti:  swapDoneMap[u.id] || 0,
        totalPoin:      rm.totalPoin + (bonusMap[u.id] || 0),
        mingguCount:    rm.mingguCount,
        currentStreak:  sm.current,
        longestStreak:  sm.longest,
        kondisiDist:    rm.kondisi,
        skorKualitas:   0,
        labelOverride:  ov?.label as any || null,
        catatanOverride: ov?.catatan || '',
      };
      base.skorKualitas = hitungSkorKualitas(base);
      return base;
    });

    setMembers(result);
    setLoaded(true);
    setLoading(false);
  }, [rangeMonths]);

  // ── Sort + paginate ──────────────────────────────────────────────────────────
  const sorted = [...members].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    if (sortKey === 'skor')   { va = a.skorKualitas;   vb = b.skorKualitas; }
    if (sortKey === 'poin')   { va = a.totalPoin;      vb = b.totalPoin; }
    if (sortKey === 'hadir')  { va = a.hadirTugas;     vb = b.hadirTugas; }
    if (sortKey === 'streak') { va = a.currentStreak;  vb = b.currentStreak; }
    if (sortKey === 'nama')   { va = a.nama_panggilan; vb = b.nama_panggilan; }
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortAsc ? (va - (vb as number)) : ((vb as number) - va);
  });

  const pgAnalisis = usePagination(sorted, 10);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Minus size={11} className="text-gray-300"/>;
    return sortAsc ? <ChevronUp size={11} className="text-brand-700"/> : <ChevronDown size={11} className="text-brand-700"/>;
  }

  // ── Label override save ──────────────────────────────────────────────────────
  async function saveOverride(uid: string) {
    setSavingLabel(true);
    const next = {
      ...overrides,
      [uid]: {
        label:   editLabel   || undefined,
        catatan: editCatatan || undefined,
      },
    };
    // Clean up empty entries to keep the JSON compact
    if (!editLabel && !editCatatan) delete next[uid];
    const { error } = await supabase.from('system_config').upsert(
      { key: 'analisis_label_overrides', value: JSON.stringify(next) },
      { onConflict: 'key' }
    );
    setSavingLabel(false);
    if (error) { toast.error('Gagal simpan: ' + error.message); return; }
    setOverrides(next);
    setMembers(ms => ms.map(m => m.id === uid
      ? { ...m, labelOverride: (editLabel || null) as any, catatanOverride: editCatatan }
      : m
    ));
    toast.success('Evaluasi disimpan');
  }

  // ── CSV export ───────────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      'Nama','Lingkungan','Skor','Grade Otomatis','Label Pengurus',
      'Poin Total','Minggu Aktif','Hadir Tugas','Hadir Latihan','Mengganti',
      'Dijadwalkan','K5 (Dimaafkan)','K6 (Absen Tanpa Ket)','Swap Req','Jadi Pengganti','Streak','Catatan',
    ];
    const rows = sorted.map(m => {
      const grade = gradeFromSkor(m.skorKualitas);
      return [
        m.nama_panggilan, m.lingkungan, m.skorKualitas, grade.label,
        m.labelOverride || '', m.totalPoin, m.mingguCount,
        m.hadirTugas, m.hadirLatihan, m.walkInCount, m.jadwalCount,
        m.excusedCount, m.kondisiDist['K6'] || 0,
        m.swapRequest, m.jadiBengganti, m.currentStreak, m.catatanOverride || '',
      ];
    });
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analisis-kualitas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success('CSV diunduh');
  }

  if (!isPengurus) return (
    <div className="card text-center py-16 text-gray-400">
      <AlertTriangle size={40} className="mx-auto mb-3 opacity-30"/>
      <p>Hanya Pengurus / Admin yang dapat mengakses halaman ini.</p>
    </div>
  );

  const gradeDist = loaded ? {
    'Sangat Baik':     members.filter(m => (m.labelOverride || gradeFromSkor(m.skorKualitas).label) === 'Sangat Baik').length,
    'Baik':            members.filter(m => (m.labelOverride || gradeFromSkor(m.skorKualitas).label) === 'Baik').length,
    'Cukup':           members.filter(m => (m.labelOverride || gradeFromSkor(m.skorKualitas).label) === 'Cukup').length,
    'Perlu Perhatian': members.filter(m => (m.labelOverride || gradeFromSkor(m.skorKualitas).label) === 'Perlu Perhatian').length,
  } : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Analisis Kualitas Anggota</h1>
          <p className="page-subtitle">Skor gabungan kehadiran · poin · streak · swap</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {RANGE_OPTIONS.map(r => (
              <button key={r.months} onClick={() => { setRangeMonths(r.months); setLoaded(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rangeMonths === r.months ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-500'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading} className="btn-primary gap-2">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Analisis
          </button>
          {loaded && (
            <button onClick={exportCSV} className="btn-outline gap-2">
              <Download size={15}/> CSV
            </button>
          )}
        </div>
      </div>

      {/* Grade distribution */}
      {gradeDist && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'Sangat Baik',     icon: '🌟', color: 'bg-green-50  border-green-200',  text: 'text-green-800'  },
            { key: 'Baik',            icon: '✅', color: 'bg-blue-50   border-blue-200',   text: 'text-blue-800'   },
            { key: 'Cukup',           icon: '⚠️', color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800' },
            { key: 'Perlu Perhatian', icon: '🔴', color: 'bg-red-50    border-red-200',    text: 'text-red-800'    },
          ].map(g => (
            <div key={g.key} className={`card border ${g.color} text-center py-3`}>
              <div className="text-2xl mb-1">{g.icon}</div>
              <div className={`text-3xl font-black ${g.text}`}>{gradeDist[g.key as keyof typeof gradeDist]}</div>
              <div className={`text-xs font-medium mt-0.5 ${g.text}`}>{g.key}</div>
            </div>
          ))}
        </div>
      )}

      {/* Formula info */}
      <div className="card bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Skor Kualitas (0–100):</strong>{' '}
          Kehadiran Tugas ×40 + Kehadiran Latihan ×20 + Rata-rata Poin ×25 + Streak ×10 + Pernah Jadi Pengganti ×5.{' '}
          Minggu K5 (absen dimaafkan) tidak dihitung sebagai absen.{' '}
          Poin total termasuk bonus kegiatan.{' '}
          Grade: ≥75 Sangat Baik · ≥55 Baik · ≥35 Cukup · &lt;35 Perlu Perhatian.
          Pengurus bisa override label per anggota.
        </p>
      </div>

      {/* Ranking table */}
      {loaded && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Ranking Kualitas — {members.length} anggota aktif</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl text-xs w-full">
              <thead>
                <tr>
                  <th className="w-7">#</th>
                  <th className="cursor-pointer" onClick={() => toggleSort('nama')}>
                    <span className="flex items-center gap-1">Anggota <SortIcon k="nama"/></span>
                  </th>
                  <th>Ling.</th>
                  <th className="cursor-pointer" onClick={() => toggleSort('skor')}>
                    <span className="flex items-center gap-1">Skor <SortIcon k="skor"/></span>
                  </th>
                  <th>Grade</th>
                  <th className="cursor-pointer" onClick={() => toggleSort('hadir')}>
                    <span className="flex items-center gap-1">Hadir Tugas <SortIcon k="hadir"/></span>
                  </th>
                  <th>Hadir Lat.</th>
                  <th className="cursor-pointer" onClick={() => toggleSort('poin')}>
                    <span className="flex items-center gap-1">Poin <SortIcon k="poin"/></span>
                  </th>
                  <th className="cursor-pointer" onClick={() => toggleSort('streak')}>
                    <span className="flex items-center gap-1">Streak <SortIcon k="streak"/></span>
                  </th>
                  <th title="K5 = absen dimaafkan, K6 = absen tanpa ket.">Absen</th>
                </tr>
              </thead>
              <tbody>
                {pgAnalisis.paged.map((m, i) => {
                  const grade      = gradeFromSkor(m.skorKualitas);
                  const finalLabel = m.labelOverride || grade.label;
                  const effectiveJadwal = Math.max(1, m.jadwalCount - m.excusedCount);
                  const pctHadir = effectiveJadwal > 0 ? Math.round(m.hadirTugas / effectiveJadwal * 100) : 0;
                  const globalRank = (pgAnalisis.page - 1) * pgAnalisis.pageSize + i + 1;
                  const k5 = m.kondisiDist['K5'] || 0;
                  const k6 = m.kondisiDist['K6'] || 0;
                  return (
                    <tr key={m.id} className="cursor-pointer hover:bg-brand-50/40 transition-colors"
                      onClick={() => { setSelected(m); setEditLabel(m.labelOverride || ''); setEditCatatan(m.catatanOverride || ''); }}>
                      <td className="font-mono text-gray-400">{globalRank}</td>
                      <td>
                        <div className="font-semibold text-gray-900">{m.nama_panggilan}</div>
                        <div className="text-gray-400">@{m.nickname}</div>
                      </td>
                      <td className="text-gray-500">{m.lingkungan}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="w-14 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full ${
                              m.skorKualitas >= 75 ? 'bg-green-500' :
                              m.skorKualitas >= 55 ? 'bg-blue-500'  :
                              m.skorKualitas >= 35 ? 'bg-yellow-400': 'bg-red-500'
                            }`} style={{ width: `${m.skorKualitas}%` }}/>
                          </div>
                          <span className="font-bold text-gray-800">{m.skorKualitas}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.labelOverride ? 'ring-1 ring-brand-400 ' : ''
                        }${grade.bg} ${grade.color}`}>
                          {finalLabel}
                          {m.labelOverride && <span className="ml-1 text-[9px] opacity-70">✎</span>}
                        </span>
                      </td>
                      <td>
                        <span className={`font-semibold ${pctHadir >= 80 ? 'text-green-600' : pctHadir >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {m.hadirTugas}×
                        </span>
                        {m.jadwalCount > 0 && <span className="text-gray-400 ml-1">({pctHadir}%)</span>}
                      </td>
                      <td className="text-gray-600">{m.hadirLatihan}×</td>
                      <td className={`font-bold ${m.totalPoin > 0 ? 'text-green-600' : m.totalPoin < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {m.totalPoin > 0 ? '+' : ''}{m.totalPoin}
                      </td>
                      <td>
                        {m.currentStreak > 0
                          ? <span className="text-orange-500 font-bold">🔥{m.currentStreak}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {k6 > 0 && <span className="text-red-600 font-bold bg-red-50 px-1.5 rounded" title="Absen tanpa keterangan (K6)">K6×{k6}</span>}
                          {k5 > 0 && <span className="text-amber-600 font-bold bg-amber-50 px-1.5 rounded" title="Absen dimaafkan (K5)">K5×{k5}</span>}
                          {k5 === 0 && k6 === 0 && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > 0 && (
            <div className="px-4">
              <Pagination {...pgAnalisis} onPage={pgAnalisis.goTo} label="anggota" />
            </div>
          )}
        </div>
      )}

      {!loaded && !loading && (
        <div className="card text-center py-16 text-gray-400">
          <TrendingUp size={48} className="mx-auto mb-3 opacity-20"/>
          <p className="font-medium">Pilih rentang waktu lalu klik <strong>Analisis</strong></p>
        </div>
      )}

      {loading && (
        <div className="card text-center py-16 text-gray-400">
          <RefreshCw size={36} className="mx-auto mb-3 animate-spin opacity-40"/>
          <p>Menganalisis data anggota...</p>
        </div>
      )}

      {/* ── Detail panel (modal) ── */}
      {selected && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">{selected.nama_panggilan}</h2>
                <p className="text-xs text-gray-400 dark:text-slate-400">@{selected.nickname} · {selected.lingkungan} · {selected.pendidikan}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost p-2"><X size={18}/></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Skor + grade */}
              {(() => {
                const grade      = gradeFromSkor(selected.skorKualitas);
                const finalLabel = selected.labelOverride || grade.label;
                return (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className={`text-5xl font-black ${
                        selected.skorKualitas >= 75 ? 'text-green-600' :
                        selected.skorKualitas >= 55 ? 'text-blue-600'  :
                        selected.skorKualitas >= 35 ? 'text-yellow-600': 'text-red-600'
                      }`}>{selected.skorKualitas}</div>
                      <div className="text-xs text-gray-400">/ 100</div>
                    </div>
                    <div className="flex-1">
                      <span className={`px-3 py-1.5 rounded-xl text-sm font-bold ${grade.bg} ${grade.color}`}>
                        {grade.icon} {finalLabel}
                        {selected.labelOverride && <span className="ml-1 text-xs opacity-60">(override)</span>}
                      </span>
                      {selected.catatanOverride && (
                        <p className="text-xs text-gray-500 mt-2 italic">"{selected.catatanOverride}"</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Stats grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: 'Poin Total',  val: (selected.totalPoin > 0 ? '+' : '') + selected.totalPoin, color: selected.totalPoin > 0 ? 'text-green-700' : selected.totalPoin < 0 ? 'text-red-700' : 'text-gray-600' },
                  { label: 'Hadir Tugas', val: selected.hadirTugas + '×',   color: 'text-blue-700'   },
                  { label: 'Hadir Lat.',  val: selected.hadirLatihan + '×',  color: 'text-teal-700'   },
                  { label: 'Mengganti',   val: selected.walkInCount + '×',   color: 'text-purple-700' },
                  { label: 'Streak',      val: selected.currentStreak + '🔥',color: 'text-orange-600' },
                  { label: 'Best Streak', val: selected.longestStreak + '🏆',color: 'text-yellow-600' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                    <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* K5/K6 excused summary */}
              {(selected.excusedCount > 0 || (selected.kondisiDist['K6'] || 0) > 0) && (
                <div className="flex gap-3">
                  {selected.excusedCount > 0 && (
                    <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-amber-600">{selected.excusedCount}×</div>
                      <div className="text-xs text-amber-700 mt-0.5">Absen Dimaafkan (K5)</div>
                      <div className="text-[10px] text-amber-500 mt-0.5">tidak mempengaruhi skor</div>
                    </div>
                  )}
                  {(selected.kondisiDist['K6'] || 0) > 0 && (
                    <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                      <div className="text-xl font-black text-red-600">{selected.kondisiDist['K6']}×</div>
                      <div className="text-xs text-red-700 mt-0.5">Absen Tanpa Ket. (K6)</div>
                      <div className="text-[10px] text-red-500 mt-0.5">-1 poin per minggu</div>
                    </div>
                  )}
                </div>
              )}

              {/* Kondisi distribution bar chart */}
              {Object.keys(selected.kondisiDist).length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2">Distribusi Kondisi</h3>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart
                      data={KONDISI_ORDER.map(k => ({ k, v: selected.kondisiDist[k] || 0 }))}
                      margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
                    >
                      <XAxis dataKey="k" tick={{ fontSize: 10 }}/>
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false}/>
                      <Tooltip formatter={(v: any) => [v + '×', 'Minggu']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                      <Bar dataKey="v" radius={[4,4,0,0]}>
                        {KONDISI_ORDER.map(k => (
                          <Cell key={k} fill={KONDISI_COLOR[k] || '#9ca3af'}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Radar chart */}
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-2">Profil Kualitas (per dimensi)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={[
                    { dim: 'Hadir Tugas', val: (() => {
                        const ej = Math.max(1, selected.jadwalCount - selected.excusedCount);
                        return Math.min(100, ej > 0 ? Math.round(selected.hadirTugas / ej * 100) : 0);
                      })() },
                    { dim: 'Hadir Lat.',  val: Math.min(100, selected.mingguCount > 0 ? Math.round(selected.hadirLatihan / selected.mingguCount * 100) : 0) },
                    { dim: 'Poin Rata²', val: Math.min(100, Math.max(0, Math.round(((selected.mingguCount > 0 ? selected.totalPoin / selected.mingguCount : 0) + 1) / 6 * 100))) },
                    { dim: 'Streak',      val: Math.min(100, Math.round(selected.currentStreak / 8 * 100)) },
                    { dim: 'Kontribusi',  val: selected.jadiBengganti > 0 ? 100 : 0 },
                  ]}>
                    <PolarGrid/>
                    <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }}/>
                    <Radar dataKey="val" stroke="#7c1d1d" fill="#7c1d1d" fillOpacity={0.25}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Swap stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-purple-700">{selected.swapRequest}</div>
                  <div className="text-xs text-purple-600 mt-0.5">Pernah request swap</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-green-700">{selected.jadiBengganti}</div>
                  <div className="text-xs text-green-600 mt-0.5">Pernah jadi pengganti</div>
                </div>
              </div>

              {/* Override label */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <Star size={14} className="text-brand-700"/> Evaluasi Pengurus (Override)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {LABEL_OPTIONS.map(l => (
                    <button key={l.value}
                      onClick={() => setEditLabel(v => v === l.value ? '' : l.value)}
                      className={`text-xs px-3 py-2 rounded-xl border font-medium transition-all text-left ${
                        editLabel === l.value
                          ? `${l.color} ring-2 ring-brand-400 border-brand-400`
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}>
                      {l.icon} {l.value}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input text-sm h-20 resize-none"
                  placeholder="Catatan evaluasi (opsional)..."
                  value={editCatatan}
                  onChange={e => setEditCatatan(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveOverride(selected.id)}
                    disabled={savingLabel}
                    className="btn-primary flex-1 gap-2 text-sm">
                    <CheckCircle size={14}/> {savingLabel ? 'Menyimpan...' : 'Simpan Evaluasi'}
                  </button>
                  {(selected.labelOverride || selected.catatanOverride) && (
                    <button
                      onClick={async () => {
                        setEditLabel('');
                        setEditCatatan('');
                        await saveOverride(selected.id);
                      }}
                      className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50">
                      Hapus Override
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
