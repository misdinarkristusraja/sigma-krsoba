import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { generateICS, downloadICS } from '../lib/calendarExport';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, downloadCSV, hitungPoin, getWeekStartFromDate, getWeekEndFromStart, toLocalISO, getWeekPeriod } from '../lib/utils';
import { BarChart2, Download, TrendingUp, Calendar, RefreshCw, Info, Search, CheckCircle2 } from 'lucide-react';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/ui/Pagination';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

// ─── Label ramah pengguna (Status K-K tanpa Poin angka) ─────────────────
const KONDISI_INFO: Record<string, { label: string; short: string; color: string; bar: string }> = {
  K1:  { label: 'Substitusi Ideal (Mengganti + Hadir Latihan)', short: 'Substitusi + Latihan', color: 'bg-purple-100 text-purple-900 border border-purple-200', bar: '#9333ea' },
  K2a: { label: 'Tugas Utama Ideal (Terjadwal Normal + Latihan)', short: 'Tugas Utama + Latihan', color: 'bg-emerald-100 text-emerald-900 border border-emerald-200', bar: '#16a34a' },
  K2b: { label: 'Tugas Swap Ideal (Pengganti Resmi + Latihan)', short: 'Tugas Swap + Latihan', color: 'bg-green-100 text-green-900 border border-green-200', bar: '#10b981' },
  K3a: { label: 'Tugas Utama Standar (Hadir Tugas saja)', short: 'Tugas Utama Only', color: 'bg-blue-100 text-blue-900 border border-blue-200', bar: '#3b82f6' },
  K3b: { label: 'Substitusi Mendadak (Hadir Mengganti saja)', short: 'Substitusi Mendadak', color: 'bg-sky-100 text-sky-900 border border-sky-200', bar: '#0ea5e9' },
  K3c: { label: 'Tugas Swap Standar (Hadir Tugas Swap saja)', short: 'Tugas Swap Only', color: 'bg-cyan-100 text-cyan-900 border border-cyan-200', bar: '#06b6d4' },
  K4a: { label: 'Partisipasi Latihan (Hadir Latihan saja)', short: 'Partisipasi Latihan', color: 'bg-teal-100 text-teal-900 border border-teal-200', bar: '#14b8a6' },
  K4c: { label: 'Latihan Mandiri (Hadir Latihan tanpa Jadwal)', short: 'Latihan (Tanpa Tugas)', color: 'bg-yellow-100 text-yellow-900 border border-yellow-200', bar: '#eab308' },
  K6:  { label: 'Absen Tanpa Keterangan (Terjadwal tidak hadir)', short: 'Absen (K6)', color: 'bg-red-100 text-red-900 border border-red-200 font-bold', bar: '#ef4444' },
  // Legacy codes fallback
  K2:  { label: 'Hadir Lengkap', short: 'Hadir Lengkap', color: 'bg-emerald-100 text-emerald-900', bar: '#16a34a' },
  K3:  { label: 'Hadir Tugas', short: 'Hadir Tugas', color: 'bg-blue-100 text-blue-900', bar: '#3b82f6' },
  K4:  { label: 'Mengganti', short: 'Mengganti', color: 'bg-sky-100 text-sky-900', bar: '#0ea5e9' },
  K5:  { label: 'Hadir Latihan', short: 'Hadir Latihan', color: 'bg-teal-100 text-teal-900', bar: '#14b8a6' },
};
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function dateCutoff(months: any) {
  if (!months) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toLocalISO(d);
}

function buildRawRekap({ assignments, scans, swaps, dateFrom, dateTo }: any) {
  const replacedIds = new Set(
    (swaps||[]).filter((sw: any)=>sw.status==='Replaced'&&sw.assignment_id).map((sw: any)=>sw.assignment_id)
  );
  const jadwal  = (assignments||[]).filter((a: any) => {
    if (a.assignment_id && replacedIds.has(a.assignment_id)) return false;
    const tgl = a.tanggal_tugas || a.tanggal_latihan;
    if (!tgl) return false;
    if (dateFrom && tgl < dateFrom) return false;
    if (dateTo   && tgl > dateTo)   return false;
    return true;
  }).length;

  const latihan = (scans||[]).filter((s: any) => {
    const ds = s.timestamp?.split('T')[0];
    if (!ds || (dateFrom && ds < dateFrom) || (dateTo && ds > dateTo)) return false;
    return s.scan_type === 'latihan' || s.scan_type === 'walkin_latihan';
  }).length;

  const tugas = (scans||[]).filter((s: any) => {
    const ds = s.timestamp?.split('T')[0];
    if (!ds || (dateFrom && ds < dateFrom) || (dateTo && ds > dateTo)) return false;
    return s.scan_type === 'tugas' || s.scan_type === 'walkin_tugas';
  }).length;

  const tukar = (swaps||[]).filter((sw: any) => {
    if (!sw.created_at) return true;
    const ds = sw.created_at.split('T')[0];
    if (dateFrom && ds < dateFrom) return false;
    if (dateTo   && ds > dateTo)   return false;
    return true;
  }).length;

  return { jadwal, latihan, tugas, tukar, total: jadwal + latihan + tugas };
}

function buildRekap({ assignments, scans, swaps, penggantiSwaps, dateFrom, dateTo }: any) {
  const replacedAssignmentIds = new Set(
    (swaps || [])
      .filter((sw: any) => sw.status === 'Replaced' && sw.assignment_id)
      .map((sw: any) => sw.assignment_id)
  );

  const activeAssignmentEventIds = new Set();
  const assignmentByEventId: Record<string,any> = {};

  (assignments || []).forEach((a: any) => {
    if (!a || !a.event_id) return;
    if (a.assignment_id && replacedAssignmentIds.has(a.assignment_id)) return;
    activeAssignmentEventIds.add(a.event_id);
    assignmentByEventId[a.event_id] = a;
  });

  const penggantiWeeks = new Set<string>();
  (penggantiSwaps || []).forEach((sw: any) => {
    const tgl = sw.assignments?.events?.tanggal_tugas;
    if (tgl) {
      const ws = getWeekStartFromDate(tgl);
      if (ws) penggantiWeeks.add(ws);
    }
  });

  const weeks: Record<string,any> = {};

  const mkWeek = (ws: any) => ({
    week_start:          ws,
    week_end:            getWeekEndFromStart(ws),
    is_dijadwalkan:      false,
    is_hadir_tugas:      false,
    is_hadir_latihan:    false,
    is_walk_in:          false,
    is_swap_pengganti:   false,
  });

  const eventIdToWeekStart: Record<string, string> = {};
  (assignments || []).forEach((a: any) => {
    if (a?.event_id && a?.tanggal_tugas) {
      const ws = getWeekStartFromDate(a.tanggal_tugas);
      if (ws) eventIdToWeekStart[a.event_id] = ws;
    }
  });
  (scans || []).forEach((s: any) => {
    if (s?.event_id && s?.events?.tanggal_tugas && !eventIdToWeekStart[s.event_id]) {
      const ws = getWeekStartFromDate(s.events.tanggal_tugas);
      if (ws) eventIdToWeekStart[s.event_id] = ws;
    }
  });

  Object.values(assignmentByEventId).forEach((a: any) => {
    const tgl = a.tanggal_tugas || a.tanggal_latihan;
    if (!tgl || typeof tgl !== 'string') return;
    if (dateFrom && tgl < dateFrom) return;
    if (dateTo   && tgl > dateTo)   return;
    const ws = getWeekStartFromDate(tgl);
    if (!ws) return;
    if (!weeks[ws]) weeks[ws] = mkWeek(ws);
    weeks[ws].is_dijadwalkan = true;
  });

  (scans || []).forEach((s: any) => {
    if (!s || !s.timestamp) return;

    const t = s.scan_type;
    const isLatihan = t === 'latihan' || t === 'walkin_latihan';

    const weekPeriod = getWeekPeriod(s.timestamp);
    const wsFromTimestamp = weekPeriod.start;

    if (dateFrom && wsFromTimestamp < dateFrom) return;
    if (dateTo   && wsFromTimestamp > dateTo)   return;

    const wsFromEvent = s.event_id ? eventIdToWeekStart[s.event_id] : null;
    const ws = wsFromEvent || wsFromTimestamp;

    if (!weeks[ws]) weeks[ws] = mkWeek(ws);

    if (isLatihan) weeks[ws].is_hadir_latihan = true;
    if (t === 'tugas'   || t === 'walkin_tugas')   weeks[ws].is_hadir_tugas   = true;

    if (t === 'walkin_tugas' || t === 'walkin_latihan') {
      weeks[ws].is_walk_in = true;
    } else if (s.event_id && !activeAssignmentEventIds.has(s.event_id)) {
      weeks[ws].is_walk_in = true;
    } else if (!s.event_id && !weeks[ws].is_dijadwalkan) {
      weeks[ws].is_walk_in = true;
    }
  });

  penggantiWeeks.forEach(ws => {
    if (!weeks[ws]) weeks[ws] = mkWeek(ws);
    weeks[ws].is_swap_pengganti = true;
  });

  return Object.values(weeks)
    .map((w: any) => {
      const { kondisi } = hitungPoin({
        isDijadwalkan:   w.is_dijadwalkan,
        isHadirTugas:    w.is_hadir_tugas,
        isHadirLatihan:  w.is_hadir_latihan,
        isWalkIn:        w.is_walk_in,
        isSwapPengganti: w.is_swap_pengganti,
      });
      return { ...w, kondisi };
    })
    .filter((w: any) => w.kondisi !== null)
    .sort((a: any, b: any) => b.week_start.localeCompare(a.week_start));
}

export default function RecapPage() {
  const { profile, isPengurus } = useAuth();

  const [tab,      setTab]    = useState('personal');
  const [loading,  setLoading]= useState(true);

  const [selUser,   setSelUser]  = useState<any>(null);
  const [dateFrom,  setDateFrom] = useState(dateCutoff(3));
  const [dateTo,    setDateTo]   = useState(toLocalISO(new Date()));
  const [searchName,setSearch]   = useState('');

  const [rekapMinggu, setRekap]   = useState<any[]>([]);
  const [rekapHarian, setHarian]  = useState<any[]>([]);
  const [memberList,  setMembers] = useState<any[]>([]);
  const [allRekap,    setAllRekap]= useState<any[]>([]);
  const [allLoading,  setAllLoad] = useState(false);
  const [lastUpdate,  setLastUpd] = useState<any>(null);
  const [rawRekap,    setRawRekap] = useState<any>(null);

  useEffect(() => {
    if (!isPengurus) return;
    supabase.from('users').select('id, nama_panggilan, lingkungan')
      .eq('status','Active')
      .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
      .order('nama_panggilan')
      .then(({ data }: any) => setMembers(data || []));
  }, [isPengurus]);

  async function exportToCalendar() {
    const uid = selUser || profile?.id;
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: evData } = await supabase.from('events')
      .select('id, perayaan, nama_event, tanggal_tugas, tanggal_latihan')
      .gte('tanggal_tugas', today)
      .eq('is_draft', false)
      .order('tanggal_tugas');
    if (!evData?.length) {
      import('react-hot-toast').then(({default:t}) => t('Tidak ada jadwal mendatang'));
      return;
    }
    const { data: asgnData } = await supabase.from('assignments')
      .select('event_id, slot_number')
      .eq('user_id', uid)
      .in('event_id', evData.map((e: any) => e.id));
    const evMap: Record<string, any> = {};
    evData.forEach((e: any) => { evMap[e.id] = e; });
    const assigns = (asgnData || [])
      .map((a: any) => ({ ...a, events: evMap[a.event_id] }))
      .filter((a: any) => a.events);
    const ics = generateICS(assigns, profile?.nama_panggilan);
    downloadICS(ics, `jadwal-${profile?.nickname || 'misdinar'}.ics`);
    import('react-hot-toast').then(({default:t}) =>
      t.success('File .ics diunduh!')
    );
  }

  const loadPersonal = useCallback(async () => {
    const uid = selUser || profile?.id;
    if (!uid) return;
    setLoading(true);

    const [{ data: assigns }, { data: scans }, { data: swapsData }, { data: userProfile }, { data: penggantiSwaps }]: any[] = await Promise.all([
      supabase.from('assignments')
        .select('id, event_id, events(tanggal_tugas, tanggal_latihan, tipe_event, is_draft)')
        .eq('user_id', uid),
      supabase.from('scan_records')
        .select('scan_type, timestamp, is_walk_in, event_id, events(tanggal_tugas)')
        .eq('user_id', uid)
        .order('timestamp', { ascending: false }),
      supabase.from('swap_requests')
        .select('assignment_id, status, created_at')
        .eq('requester_id', uid),
      supabase.from('users').select('role').eq('id', uid).single(),
      supabase.from('swap_requests')
        .select('id, status, assignments(events(tanggal_tugas))')
        .eq('pengganti_id', uid)
        .eq('status', 'Replaced'),
    ]);

    const userRole = userProfile?.role || '';
    const isStaff  = ['Administrator','Pengurus','Pelatih'].includes(userRole);

    const filteredAssigns = (assigns || [])
      .filter((a: any) => a.events && a.events.tipe_event !== 'Misa_Harian' && !a.events.is_draft)
      .map((a: any) => ({
        event_id:       a.event_id,
        assignment_id:  a.id,
        tanggal_tugas:  a.events.tanggal_tugas,
        tanggal_latihan:a.events.tanggal_latihan,
      }));

    const rekap  = isStaff ? [] : buildRekap({
      assignments:     filteredAssigns,
      scans:           scans || [],
      swaps:           swapsData || [],
      penggantiSwaps:  penggantiSwaps || [],
      dateFrom,
      dateTo,
    });
    const harian = buildRekapHarian(scans || [], dateFrom, dateTo);

    const raw = buildRawRekap({
      assignments: filteredAssigns,
      scans:       scans || [],
      swaps:       swapsData || [],
      dateFrom,
      dateTo,
    });
    if (isStaff) { setLoading(false); return; }

    setRekap(rekap);
    setHarian(harian);
    setRawRekap(raw);
    setLastUpd(new Date());
    setLoading(false);
  }, [selUser, profile?.id, dateFrom, dateTo]);

  useEffect(() => { if (tab === 'personal') loadPersonal(); }, [tab, loadPersonal]);

  async function loadAll() {
    setAllLoad(true);
    const { data: members } = await supabase.from('users')
      .select('id, nama_panggilan, lingkungan, pendidikan')
      .eq('status','Active')
      .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
      .order('nama_panggilan');
    if (!members?.length) { setAllLoad(false); return; }

    const LIMIT = 1000;
    
    async function fetchAll(table: any, query: any) {
      const rows: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await query(table).range(from, from + LIMIT - 1);
        if (error || !data?.length) break;
        rows.push(...data);
        if (data.length < LIMIT) break;
        from += LIMIT;
      }
      return rows;
    }

    const [allAssigns, allScans, allSwaps, allPenggantiSwaps] = await Promise.all([
      fetchAll('assignments', (t: any) => supabase.from(t)
        .select('id, user_id, event_id, events(tanggal_tugas, tanggal_latihan, tipe_event, is_draft)')
        .order('id')),
      fetchAll('scan_records', (t: any) => supabase.from(t)
        .select('user_id, scan_type, timestamp, is_walk_in, event_id, events(tanggal_tugas)')
        .order('timestamp', { ascending: false })),
      fetchAll('swap_requests', (t: any) => supabase.from(t)
        .select('requester_id, assignment_id, status')
        .order('id')),
      fetchAll('swap_requests', (t: any) => supabase.from(t)
        .select('pengganti_id, assignments(events(tanggal_tugas))')
        .eq('status', 'Replaced')
        .not('pengganti_id', 'is', null)
        .order('id')),
    ]);

    const aMap: Record<string,any[]> = {}, sMap: Record<string,any[]> = {};
    const swapMap: Record<string,any[]> = {};
    const penggantiMap: Record<string,any[]> = {};
    members.forEach((m: any) => { aMap[m.id] = []; sMap[m.id] = []; swapMap[m.id] = []; penggantiMap[m.id] = []; });
    (allSwaps||[]).forEach((sw: any) => { if (swapMap[sw.requester_id]) swapMap[sw.requester_id].push(sw); });
    (allPenggantiSwaps||[]).forEach((sw: any) => { if (penggantiMap[sw.pengganti_id]) penggantiMap[sw.pengganti_id].push(sw); });
    (allAssigns||[]).filter((a: any)=>a.events && !a.events.is_draft && a.events.tipe_event !== 'Misa_Harian').forEach((a: any) => {
      if (aMap[a.user_id]) aMap[a.user_id].push({
        event_id:        a.event_id,
        assignment_id:   a.id,
        tanggal_tugas:   a.events.tanggal_tugas,
        tanggal_latihan: a.events.tanggal_latihan,
      });
    });
    (allScans||[]).forEach((s: any) => { if (sMap[s.user_id]) sMap[s.user_id].push(s); });

    const result = members.map((m: any) => {
      const rows  = buildRekap({ assignments: aMap[m.id], scans: sMap[m.id], swaps: swapMap[m.id] || [], penggantiSwaps: penggantiMap[m.id] || [], dateFrom, dateTo });
      const k6    = rows.filter((r: any) => r.kondisi === 'K6').length;
      const hadir = rows.filter((r: any) => r.is_hadir_tugas || r.is_hadir_latihan).length;
      const kCounts: Record<string,any> = {};
      ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].forEach((k: any) => { kCounts[k] = rows.filter((r: any)=>r.kondisi===k).length; });
      return { ...m, rows, k6, hadir, minggu: rows.length, kCounts };
    });
    setAllRekap(result);
    setAllLoad(false);
  }

  useEffect(() => {
    if (tab === 'all') {
      if (!isPengurus) {
        setTab('personal');
        return;
      }
      loadAll();
    }
  }, [tab, dateFrom, dateTo, isPengurus]);

  function buildRekapHarian(scans: any[], from: any, to: any) {
    const months: Record<string, { tahun: number; bulan: number; count: number }> = {};
    scans.filter((s: any) => (s.scan_type === 'tugas' || s.scan_type === 'walkin_tugas') && s.event_id)
      .forEach((s: any) => {
        const ds = s.timestamp?.split('T')[0];
        if (!ds || (from && ds < from) || (to && ds > to)) return;
        const [y, m] = ds.split('-').map(Number);
        const key = `${y}-${m}`;
        if (!months[key]) months[key] = { tahun: y, bulan: m, count: 0 };
        months[key].count++;
      });
    return Object.values(months).sort((a: any,b: any) => b.tahun-a.tahun || b.bulan-a.bulan);
  }

  const hadirCount = rekapMinggu.filter((r: any) => r.is_hadir_tugas || r.is_hadir_latihan).length;
  const k6Count    = rekapMinggu.filter((r: any) => r.kondisi === 'K6').length;
  const kondisiCnt = Object.fromEntries(
    ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].map(k => [k, rekapMinggu.filter((r: any)=>r.kondisi===k).length])
  );

  const attendanceRate = rawRekap && rawRekap.jadwal > 0
    ? Math.round((rawRekap.tugas / rawRekap.jadwal) * 100)
    : 100;

  const filteredAll = allRekap
    .filter((m: any) => !searchName ||
      m.nama_panggilan?.toLowerCase().includes(searchName.toLowerCase()) ||
      m.lingkungan?.toLowerCase().includes(searchName.toLowerCase())
    )
    .sort((a: any, b: any) => b.hadir - a.hadir);

  const pgRekap      = usePagination(rekapMinggu, 10);
  const pgAllRekap   = usePagination(filteredAll, 10);

  function handleExport() {
    downloadCSV(
      rekapMinggu.map(r => ({
        minggu_mulai: r.week_start, minggu_selesai: r.week_end,
        kondisi: r.kondisi, kondisi_label: KONDISI_INFO[r.kondisi]?.label,
        dijadwalkan: r.is_dijadwalkan?'Ya':'Tidak',
        hadir_tugas: r.is_hadir_tugas?'Ya':'Tidak',
        hadir_latihan: r.is_hadir_latihan?'Ya':'Tidak',
        walk_in: r.is_walk_in?'Ya':'Tidak',
      })),
      ['minggu_mulai','minggu_selesai','kondisi','kondisi_label','dijadwalkan','hadir_tugas','hadir_latihan','walk_in']
        .map(k => ({ key:k, label:k })),
      `rekap-kehadiran-${profile?.nickname}-${Date.now()}.csv`
    );
  }

  function setPeriod(months: any) {
    setDateFrom(months ? dateCutoff(months) : '2020-01-01');
    setDateTo(toLocalISO(new Date()));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Rekap Kehadiran &amp; Status K</h1>
          <p className="page-subtitle">
            Real-time rekapitulasi kehadiran dan klasifikasi Status Penugasan (K1-K6)
            {lastUpdate && <span className="ml-2 text-gray-400 text-xs">· {lastUpdate.toLocaleTimeString('id')}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadPersonal} className="btn-ghost p-2"><RefreshCw size={16}/></button>
          <button onClick={handleExport} className="btn-outline gap-2 transition-all hover:scale-105 active:scale-95"><Download size={16}/> CSV</button>
          <button onClick={exportToCalendar} className="btn-outline gap-2 text-sm transition-all hover:scale-105 active:scale-95">
            <Calendar size={15}/> Google Cal
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {[
          { key: 'personal', label: 'Pribadi',       show: true },
          { key: 'all',      label: 'Semua Anggota', show: isPengurus },
        ].filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'bg-white text-brand-800 shadow-sm':'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap">
          {[
            {label:'1 Bln',  months:1},
            {label:'3 Bln',  months:3},
            {label:'6 Bln',  months:6},
            {label:'1 Tahun',months:12},
            {label:'Semua',  months:null},
          ].map(p=>(
            <button key={p.label}
              onClick={()=>setPeriod(p.months)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                dateFrom === (p.months ? dateCutoff(p.months) : '2020-01-01')
                  ? 'bg-brand-800 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Dari</span>
          <input type="date" className="input input-sm text-xs w-32" value={dateFrom || ''} onChange={e=>setDateFrom(e.target.value)}/>
          <span>–</span>
          <input type="date" className="input input-sm text-xs w-32" value={dateTo || ''} onChange={e=>setDateTo(e.target.value)}/>
        </div>
        {tab === 'personal' && isPengurus && (
          <select className="input w-auto text-sm" value={selUser || ''} onChange={e=>setSelUser(e.target.value||null)}>
            <option value="">Data Saya</option>
            {memberList.map(m=><option key={m.id} value={m.id}>{m.nama_panggilan}</option>)}
          </select>
        )}
        {tab === 'all' && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="input pl-8 text-sm w-44" placeholder="Cari nama..."
              value={searchName} onChange={e=>setSearch(e.target.value)}/>
          </div>
        )}
      </div>

      {/* TAB PERSONAL */}
      {tab === 'personal' && (
        <>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="skeleton h-16 rounded-xl"/>)}</div>
          ) : (
            <>
              {/* Summary cards without points */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'Tingkat Kehadiran', val: `${attendanceRate}%`, color:'text-emerald-700', bg:'bg-emerald-50' },
                  { label:'Total Hadir',        val: hadirCount,            color:'text-blue-700',    bg:'bg-blue-50' },
                  { label:'Absen (K6)',        val: k6Count,               color:'text-red-700',     bg:'bg-red-50' },
                  { label:'Total Pekan',       val: rekapMinggu.length,    color:'text-gray-700',    bg:'bg-gray-50' },
                ].map(c=>(
                  <div key={c.label} className={`card ${c.bg} border-0 text-center`}>
                    <div className={`text-3xl font-black ${c.color}`}>{c.val}</div>
                    <div className="text-xs text-gray-600 mt-1">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Raw rekap counts */}
              {rawRekap && (
                <div className="card">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">📋 Ringkasan partisipasi</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Dijadwalkan', val: rawRekap.jadwal,  color: 'bg-brand-50 text-brand-800',   icon: '📅' },
                      { label: 'Hadir Latihan',val: rawRekap.latihan, color: 'bg-blue-50 text-blue-700',    icon: '🏋️' },
                      { label: 'Hadir Tugas',  val: rawRekap.tugas,   color: 'bg-green-50 text-green-700',  icon: '⛪' },
                      { label: 'Tukar Jadwal', val: rawRekap.tukar,   color: 'bg-purple-50 text-purple-700',icon: '🔄' },
                    ].map(c => (
                      <div key={c.label} className={`${c.color} rounded-xl p-3 text-center`}>
                        <div className="text-lg">{c.icon}</div>
                        <div className="text-2xl font-black mt-1">{c.val}</div>
                        <div className="text-xs mt-0.5 font-medium opacity-80">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Breakdown Status K-K (Clean without points) */}
              <div className="card">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">Rincian Frekuensi Kategori Kehadiran (Status K)</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].map(k=>{
                    const info = KONDISI_INFO[k];
                    if (!info) return null;
                    const cnt  = kondisiCnt[k]||0;
                    return (
                      <div key={k} className={`p-3 rounded-xl text-center ${info.color} ${cnt===0?'opacity-40':''}`}>
                        <div className="text-2xl font-black">{cnt}</div>
                        <div className="text-xs font-bold mt-0.5">{k}</div>
                        <div className="text-[10px] opacity-80 leading-tight mt-0.5">{info.short}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rekap harian */}
              {rekapHarian.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar size={15} className="text-brand-800"/> Rekap Misa Harian
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {rekapHarian.map((h,i)=>(
                      <div key={i} className="text-center p-2 bg-gray-50 rounded-xl">
                        <div className="text-lg font-bold text-brand-800">{h.count}×</div>
                        <div className="text-[10px] text-gray-500">{MONTH_NAMES[h.bulan]} {h.tahun}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabel detail */}
              <div className="card overflow-hidden p-0">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700">Riwayat Kehadiran Pekanan</h3>
                  <span className="text-xs text-gray-400">{rekapMinggu.length} minggu</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Periode Pekan</th>
                        <th>Kategori K</th>
                        <th>Keterangan Status</th>
                        <th>Dijadwalkan</th>
                        <th>Hadir Tugas</th>
                        <th>Hadir Latihan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rekapMinggu.length===0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Tidak ada data pada rentang ini</td></tr>
                      ) : pgRekap.paged.map((r,i)=>{
                        const ki = KONDISI_INFO[r.kondisi];
                        return (
                          <tr key={i}>
                            <td className="text-xs text-gray-500 whitespace-nowrap">
                              {formatDate(r.week_start,'dd MMM')} – {formatDate(r.week_end,'dd MMM')}
                            </td>
                            <td>
                              <span className="font-mono text-xs font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border">
                                {r.kondisi}
                              </span>
                            </td>
                            <td>
                              {ki ? (
                                <span className={`badge text-xs ${ki.color}`}>{ki.label}</span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="text-center">{r.is_dijadwalkan?'✓':'—'}</td>
                            <td className="text-center">{r.is_hadir_tugas?'✓':r.is_walk_in?'↑':'—'}</td>
                            <td className="text-center">{r.is_hadir_latihan?'✓':'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rekapMinggu.length > 0 && (
                  <div className="px-4">
                    <Pagination {...pgRekap} onPage={pgRekap.goTo} label="minggu" />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* TAB ALL */}
      {tab === 'all' && isPengurus && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">Rekap Status Kehadiran Semua Anggota</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{filteredAll.length} anggota</span>
              <button onClick={loadAll} className="btn-ghost p-1.5" title="Refresh"><RefreshCw size={14}/></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl text-xs">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Nama</th>
                  <th>Lingkungan</th>
                  <th>Hadir</th>
                  <th title="Substitusi Ideal (Mengganti + Latihan)">K1</th>
                  <th title="Tugas Utama Ideal">K2a</th>
                  <th title="Tugas Swap Ideal">K2b</th>
                  <th title="Tugas Utama Standar">K3a</th>
                  <th title="Substitusi Mendadak">K3b</th>
                  <th title="Tugas Swap Standar">K3c</th>
                  <th title="Partisipasi Latihan">K4a</th>
                  <th title="Latihan Mandiri">K4c</th>
                  <th title="Absen Tanpa Keterangan" className="text-red-600 font-bold">K6 (Absen)</th>
                  <th>Minggu</th>
                </tr>
              </thead>
              <tbody>
                {allLoading ? (
                  <tr><td colSpan={14} className="text-center py-8 text-gray-400">Menghitung rekap semua anggota...</td></tr>
                ) : pgAllRekap.paged.map((m: any,i: number)=>{
                  const globalIdx = (pgAllRekap.page - 1) * pgAllRekap.pageSize + i + 1;
                  return (
                    <tr key={m.id}>
                      <td className="text-gray-400 font-mono text-[10px]">{globalIdx}</td>
                      <td className="font-semibold text-gray-900">{m.nama_panggilan}</td>
                      <td className="text-gray-500 text-[11px]">{m.lingkungan}</td>
                      <td className="font-bold text-blue-700">{m.hadir}</td>
                      <td className={`text-center ${m.kCounts?.K1 > 0 ? 'font-bold text-purple-700' : 'text-gray-300'}`}>{m.kCounts?.K1 || 0}</td>
                      <td className={`text-center ${m.kCounts?.K2a > 0 ? 'font-bold text-emerald-700' : 'text-gray-300'}`}>{m.kCounts?.K2a || 0}</td>
                      <td className={`text-center ${m.kCounts?.K2b > 0 ? 'font-bold text-green-700' : 'text-gray-300'}`}>{m.kCounts?.K2b || 0}</td>
                      <td className={`text-center ${m.kCounts?.K3a > 0 ? 'font-bold text-blue-700' : 'text-gray-300'}`}>{m.kCounts?.K3a || 0}</td>
                      <td className={`text-center ${m.kCounts?.K3b > 0 ? 'font-bold text-sky-700' : 'text-gray-300'}`}>{m.kCounts?.K3b || 0}</td>
                      <td className={`text-center ${m.kCounts?.K3c > 0 ? 'font-bold text-cyan-700' : 'text-gray-300'}`}>{m.kCounts?.K3c || 0}</td>
                      <td className={`text-center ${m.kCounts?.K4a > 0 ? 'font-bold text-teal-700' : 'text-gray-300'}`}>{m.kCounts?.K4a || 0}</td>
                      <td className={`text-center ${m.kCounts?.K4c > 0 ? 'font-bold text-yellow-700' : 'text-gray-300'}`}>{m.kCounts?.K4c || 0}</td>
                      <td className={`text-center font-bold ${m.k6 > 0 ? 'text-red-600 bg-red-50' : 'text-gray-300'}`}>{m.k6}</td>
                      <td className="text-gray-500">{m.minggu}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredAll.length > 0 && (
            <div className="px-4">
              <Pagination {...pgAllRekap} onPage={pgAllRekap.goTo} label="anggota" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
