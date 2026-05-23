import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { generateICS, downloadICS } from '../lib/calendarExport';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, downloadCSV, hitungPoin, getWeekStartFromDate, getWeekEndFromStart, toLocalISO } from '../lib/utils';
import { BarChart2, Download, TrendingUp, Calendar, RefreshCw, Info, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

// ─── Label ramah pengguna ─────────────────────────────────
const KONDISI_INFO: Record<string, { label: string; short: string; poin: string; color: string; bar: string }> = {
  K1:  { label: 'Mengganti mendadak + hadir Latihan', short: 'Mengganti + Latihan', poin: '+5', color: 'bg-purple-100 text-purple-800',  bar: '#9333ea' },
  K2a: { label: 'Hadir Lengkap (terjadwal normal)',   short: 'Hadir Lengkap',       poin: '+4', color: 'bg-green-100 text-green-800',    bar: '#16a34a' },
  K2b: { label: 'Hadir Lengkap (pengganti resmi)',    short: 'Hadir Lengkap (Swap)',poin: '+3', color: 'bg-emerald-100 text-emerald-800', bar: '#10b981' },
  K3a: { label: 'Hadir Tugas saja (terjadwal)',       short: 'Hadir Tugas',         poin: '+3', color: 'bg-blue-100 text-blue-800',      bar: '#3b82f6' },
  K3b: { label: 'Mengganti mendadak saja',            short: 'Mengganti Mendadak',  poin: '+3', color: 'bg-sky-100 text-sky-800',        bar: '#0ea5e9' },
  K3c: { label: 'Hadir Tugas saja (pengganti resmi)', short: 'Hadir Tugas (Swap)',  poin: '+2', color: 'bg-cyan-100 text-cyan-800',      bar: '#06b6d4' },
  K4a: { label: 'Hadir Latihan saja (tidak terjadwal)',short: 'Hadir Latihan',      poin: '+2', color: 'bg-teal-100 text-teal-800',      bar: '#14b8a6' },
  K4c: { label: 'Hadir Latihan saja (terjadwal, tidak hadir tugas)', short: 'Latihan (no Tugas)', poin: '0', color: 'bg-yellow-100 text-yellow-800', bar: '#eab308' },
  K6:  { label: 'Absen (terjadwal, tidak hadir)',     short: 'Absen',               poin: '-1', color: 'bg-red-100 text-red-800',        bar: '#ef4444' },
};
const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// ─── Helpers tanggal ──────────────────────────────────────
function dateCutoff(months: any) {
  if (!months) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toLocalISO(d);
}

// ─── Raw count rekap (sesuai format Excel) ────────────────
// Jadwal = berapa kali dijadwalkan
// Latihan = berapa kali scan latihan valid
// Tugas = berapa kali scan tugas valid  
// Tukar = berapa kali mengajukan swap
function buildRawRekap({ assignments, scans, swaps, dateFrom, dateTo }: any) {
  // Jadwal = assignments yang BELUM di-replace
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

// ─── Kalkulasi rekap real-time (K1-K6 poin) ──────────────
function buildRekap({ assignments, scans, swaps, penggantiSwaps, dateFrom, dateTo }: any) {
  // Assignments replaced (user ditukar keluar dari jadwal)
  const replacedAssignmentIds = new Set(
    (swaps || [])
      .filter((sw: any) => sw.status === 'Replaced' && sw.assignment_id)
      .map((sw: any) => sw.assignment_id)
  );

  // Active assignments (not replaced)
  const activeAssignmentEventIds = new Set();
  const assignmentByEventId: Record<string,any> = {};

  (assignments || []).forEach((a: any) => {
    if (!a || !a.event_id) return;
    if (a.assignment_id && replacedAssignmentIds.has(a.assignment_id)) return;
    activeAssignmentEventIds.add(a.event_id);
    assignmentByEventId[a.event_id] = a;
  });

  // Weeks where user is pengganti (pengganti_id = uid, status Replaced)
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

  // Pass 1 — weeks from active assignments
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

  // Pass 2 — scan records
  (scans || []).forEach((s: any) => {
    if (!s) return;
    const dateStr = s.timestamp?.split('T')[0];
    if (!dateStr) return;
    if (dateFrom && dateStr < dateFrom) return;
    if (dateTo   && dateStr > dateTo)   return;
    const ws = getWeekStartFromDate(dateStr);
    if (!ws) return;
    if (!weeks[ws]) weeks[ws] = mkWeek(ws);

    const t = s.scan_type;
    if (t === 'latihan' || t === 'walkin_latihan') weeks[ws].is_hadir_latihan = true;
    if (t === 'tugas'   || t === 'walkin_tugas')   weeks[ws].is_hadir_tugas   = true;

    // Walk-in (mengganti mendadak): scan tugas at event not in active assignments
    if (t === 'walkin_tugas' || t === 'walkin_latihan') {
      weeks[ws].is_walk_in = true;
    } else if (s.event_id && !activeAssignmentEventIds.has(s.event_id)) {
      weeks[ws].is_walk_in = true;
    } else if (!s.event_id && !weeks[ws].is_dijadwalkan) {
      weeks[ws].is_walk_in = true;
    }
  });

  // Pass 3 — mark pengganti weeks
  penggantiWeeks.forEach(ws => {
    if (!weeks[ws]) weeks[ws] = mkWeek(ws);
    weeks[ws].is_swap_pengganti = true;
  });

  // Pass 4 — compute kondisi (take highest poin per week)
  return Object.values(weeks)
    .map((w: any) => {
      const { poin, kondisi } = hitungPoin({
        isDijadwalkan:   w.is_dijadwalkan,
        isHadirTugas:    w.is_hadir_tugas,
        isHadirLatihan:  w.is_hadir_latihan,
        isWalkIn:        w.is_walk_in,
        isSwapPengganti: w.is_swap_pengganti,
      });
      return { ...w, poin, kondisi };
    })
    .filter((w: any) => w.kondisi !== null)
    .sort((a: any, b: any) => b.week_start.localeCompare(a.week_start));
}

// ═════════════════════════════════════════════════════════
export default function RecapPage() {
  const { profile, isPengurus } = useAuth();

  const [tab,      setTab]    = useState('personal');
  const [loading,  setLoading]= useState(true);

  // Filter personal
  const [selUser,   setSelUser]  = useState<any>(null);
  const [dateFrom,  setDateFrom] = useState(dateCutoff(3)); // default 3 bulan
  const [dateTo,    setDateTo]   = useState(toLocalISO(new Date()));
  const [searchName,setSearch]   = useState('');

  // Data
  const [rekapMinggu, setRekap]   = useState<any[]>([]);
  const [rekapHarian, setHarian]  = useState<any[]>([]);
  const [memberList,  setMembers] = useState<any[]>([]);
  const [allRekap,    setAllRekap]= useState<any[]>([]);
  const [allLoading,  setAllLoad] = useState(false);
  const [lastUpdate,  setLastUpd] = useState<any>(null);
  const [rawRekap,    setRawRekap] = useState<any>(null);  // { jadwal, latihan, tugas, tukar }

  // Load member list
  useEffect(() => {
    if (!isPengurus) return;
    supabase.from('users').select('id, nama_panggilan, lingkungan')
      .eq('status','Active')
      .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
      .order('nama_panggilan')
      .then(({ data }: any) => setMembers(data || []));
  }, [isPengurus]);

  // ── Export ke Google Calendar ─────────────────────────
  async function exportToCalendar() {
    const uid = selUser || profile?.id;
    if (!uid) return;
    const { data: assigns } = await supabase.from('assignments')
      .select('event_id, slot_number, events(tanggal_tugas, tanggal_latihan, perayaan, nama_event)')
      .eq('user_id', uid)
      .gte('events.tanggal_tugas', new Date().toISOString().split('T')[0]);
    const ics = generateICS(assigns || [], profile?.nama_panggilan);
    downloadICS(ics, `jadwal-${profile?.nickname || 'misdinar'}.ics`);
    import('react-hot-toast').then(({default:toast}) =>
      toast.success('File .ics diunduh! Buka dengan Google Calendar / iCal')
    );
  }

  // ── Load personal rekap (real-time) ──────────────────
  const loadPersonal = useCallback(async () => {
    const uid = selUser || profile?.id;
    if (!uid) return;
    setLoading(true);

    const [{ data: assigns }, { data: scans }, { data: swapsData }, { data: userProfile }, { data: penggantiSwaps }]: any[] = await Promise.all([
      supabase.from('assignments')
        .select('id, event_id, events(tanggal_tugas, tanggal_latihan, tipe_event, is_draft)')
        .eq('user_id', uid),
      supabase.from('scan_records')
        .select('scan_type, timestamp, is_walk_in, event_id')
        .eq('user_id', uid)
        .order('timestamp', { ascending: false }),
      supabase.from('swap_requests')
        .select('assignment_id, status, created_at')
        .eq('requester_id', uid),
      supabase.from('users').select('role').eq('id', uid).single(),
      // swaps where this user is pengganti (pengganti_id = uid, status Replaced)
      supabase.from('swap_requests')
        .select('id, status, assignments(events(tanggal_tugas))')
        .eq('pengganti_id', uid)
        .eq('status', 'Replaced'),
    ]);

    // Skip rekap untuk staff (admin/pengurus/pelatih tidak punya rekap kehadiran)
    const userRole = userProfile?.role || '';
    const isStaff  = ['Administrator','Pengurus','Pelatih'].includes(userRole);

    // Filter: hanya event mingguan yang bukan draft
    const filteredAssigns = (assigns || [])
      .filter((a: any) => a.events && a.events.tipe_event !== 'Misa_Harian' && !a.events.is_draft)
      .map((a: any) => ({
        event_id:       a.event_id,
        assignment_id:  a.id,         // ← penting untuk deteksi swap
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

    // Raw rekap counts (sesuai format Excel)
    const raw = buildRawRekap({
      assignments: filteredAssigns,
      scans:       scans || [],
      swaps:       swapsData || [],
      dateFrom,
      dateTo,
    });
    if (isStaff) { setLoading(false); return; } // Staff tidak punya rekap

    setRekap(rekap);
    setHarian(harian);
    setRawRekap(raw);
    setLastUpd(new Date());
    setLoading(false);
  }, [selUser, profile?.id, dateFrom, dateTo]);

  useEffect(() => { if (tab === 'personal') loadPersonal(); }, [tab, loadPersonal]);

  // ── Load semua anggota ────────────────────────────────
  async function loadAll() {
    setAllLoad(true);
    const { data: members } = await supabase.from('users')
      .select('id, nama_panggilan, lingkungan, pendidikan')
      .eq('status','Active')
      .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
      .order('nama_panggilan');
    if (!members?.length) { setAllLoad(false); return; }

    // Supabase row limit = 1000. With many users, use range() to paginate.
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
        .select('user_id, scan_type, timestamp, is_walk_in, event_id')
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

    // Group
    const aMap: Record<string,any[]> = {}, sMap: Record<string,any[]> = {};
    const swapMap: Record<string,any[]> = {};
    const penggantiMap: Record<string,any[]> = {};
    members.forEach((m: any) => { aMap[m.id] = []; sMap[m.id] = []; swapMap[m.id] = []; penggantiMap[m.id] = []; });
    (allSwaps||[]).forEach((sw: any) => { if (swapMap[sw.requester_id]) swapMap[sw.requester_id].push(sw); });
    (allPenggantiSwaps||[]).forEach((sw: any) => { if (penggantiMap[sw.pengganti_id]) penggantiMap[sw.pengganti_id].push(sw); });
    // Must match loadPersonal: filter out Misa_Harian AND drafts
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
      const total = rows.reduce((s: any,r: any) => s+(r.poin||0), 0);
      const k6    = rows.filter((r: any) => r.kondisi === 'K6').length;
      const hadir = rows.filter((r: any) => r.is_hadir_tugas || r.is_hadir_latihan).length;
      // Compute K counts for enhanced table
      const kCounts: Record<string,any> = {};
      ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].forEach((k: any) => { kCounts[k] = rows.filter((r: any)=>r.kondisi===k).length; });
      return { ...m, rows, totalPoin: total, k6, hadir, minggu: rows.length, kCounts };
    });
    setAllRekap(result);
    setAllLoad(false);
  }
  useEffect(() => { if (tab === 'all') loadAll(); }, [tab, dateFrom, dateTo]);

  // ── Rekap harian helper ────────────────────────────────
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

  // ── Derived ───────────────────────────────────────────
  const totalPoin  = rekapMinggu.reduce((s: any,r: any) => s+(r.poin||0), 0);
  const hadirCount = rekapMinggu.filter((r: any) => r.is_hadir_tugas || r.is_hadir_latihan).length;
  const k6Count    = rekapMinggu.filter((r: any) => r.kondisi === 'K6').length;
  const kondisiCnt = Object.fromEntries(
    ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].map(k => [k, rekapMinggu.filter((r: any)=>r.kondisi===k).length])
  );

  const chartData = [...rekapMinggu].reverse().slice(-16).map(r => ({
    week: formatDate(r.week_start, 'dd/MM'), poin: r.poin||0, kondisi: r.kondisi,
  }));

  // Filter all by search
  const filteredAll = allRekap.filter((m: any) => !searchName ||
    m.nama_panggilan?.toLowerCase().includes(searchName.toLowerCase()) ||
    m.lingkungan?.toLowerCase().includes(searchName.toLowerCase())
  );

  function handleExport() {
    downloadCSV(
      rekapMinggu.map(r => ({
        minggu_mulai: r.week_start, minggu_selesai: r.week_end,
        kondisi: r.kondisi, kondisi_label: KONDISI_INFO[r.kondisi]?.label,
        poin: r.poin, dijadwalkan: r.is_dijadwalkan?'Ya':'Tidak',
        hadir_tugas: r.is_hadir_tugas?'Ya':'Tidak',
        hadir_latihan: r.is_hadir_latihan?'Ya':'Tidak',
        walk_in: r.is_walk_in?'Ya':'Tidak',
      })),
      ['minggu_mulai','minggu_selesai','kondisi','kondisi_label','poin','dijadwalkan','hadir_tugas','hadir_latihan','walk_in']
        .map(k => ({ key:k, label:k })),
      `rekap-${profile?.nickname}-${Date.now()}.csv`
    );
  }

  // ── Preset filter period ──────────────────────────────
  function setPeriod(months: any) {
    setDateFrom(months ? dateCutoff(months) : '2020-01-01');
    setDateTo(toLocalISO(new Date()));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Rekap & Poin</h1>
          <p className="page-subtitle">
            Real-time dari scan & jadwal
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
      {isPengurus && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[{key:'personal',label:'Pribadi'},{key:'all',label:'Semua Anggota'}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'bg-white text-brand-800 shadow-sm':'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Filter bar (shared) ─── */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Preset period */}
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
        {/* Rentang tanggal custom */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Dari</span>
          <input type="date" className="input input-sm text-xs w-32" value={dateFrom || ''} onChange={e=>setDateFrom(e.target.value)}/>
          <span>–</span>
          <input type="date" className="input input-sm text-xs w-32" value={dateTo || ''} onChange={e=>setDateTo(e.target.value)}/>
        </div>
        {/* Pilih user (personal tab + pengurus) */}
        {tab === 'personal' && isPengurus && (
          <select className="input w-auto text-sm" value={selUser || ''} onChange={e=>setSelUser(e.target.value||null)}>
            <option value="">Data Saya</option>
            {memberList.map(m=><option key={m.id} value={m.id}>{m.nama_panggilan}</option>)}
          </select>
        )}
        {/* Search (all tab) */}
        {tab === 'all' && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="input pl-8 text-sm w-44" placeholder="Cari nama..."
              value={searchName} onChange={e=>setSearch(e.target.value)}/>
          </div>
        )}
      </div>

      {/* ─── TAB PERSONAL ─── */}
      {tab === 'personal' && (
        <>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="skeleton h-16 rounded-xl"/>)}</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'Total Poin',     val: totalPoin > 0 ? '+'+totalPoin : totalPoin, color: totalPoin>0?'text-green-700':totalPoin<0?'text-red-700':'text-gray-400', bg:'bg-green-50' },
                  { label:'Hadir',          val: hadirCount,  color:'text-blue-700',  bg:'bg-blue-50' },
                  { label:'Absen (K6)',     val: k6Count,     color:'text-red-700',   bg:'bg-red-50' },
                  { label:'Total Minggu',   val: rekapMinggu.length, color:'text-gray-700', bg:'bg-gray-50' },
                ].map(c=>(
                  <div key={c.label} className={`card ${c.bg} border-0 text-center`}>
                    <div className={`text-3xl font-black ${c.color}`}>{c.val}</div>
                    <div className="text-xs text-gray-600 mt-1">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Raw rekap counts — sesuai format Excel */}
              {rawRekap && (
                <div className="card">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">📋 Rekap Kehadiran</h3>
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
                  <p className="text-xs text-gray-400 mt-2">
                    Total partisipasi: <strong>{rawRekap.jadwal + rawRekap.latihan + rawRekap.tugas}</strong> kali
                    {rawRekap.jadwal > 0 && rawRekap.tugas > 0 && (
                      <span className="ml-2">· Tingkat kehadiran tugas: <strong>{Math.round(rawRekap.tugas/rawRekap.jadwal*100)}%</strong></span>
                    )}
                  </p>
                </div>
              )}

              {/* Breakdown kondisi — label ramah */}
              <div className="card">
                <h3 className="font-semibold text-gray-700 mb-3 text-sm">Rincian Kehadiran</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].map(k=>{
                    const info = KONDISI_INFO[k];
                    if (!info) return null;
                    const cnt  = kondisiCnt[k]||0;
                    return (
                      <div key={k} className={`p-3 rounded-xl text-center ${info.color} ${cnt===0?'opacity-40':''}`}>
                        <div className="text-2xl font-black">{cnt}</div>
                        <div className="text-[10px] font-bold mt-0.5">{k}</div>
                        <div className="text-[10px] opacity-70 leading-tight">{info.short}</div>
                        <div className="text-[10px] opacity-60">{info.poin}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp size={15} className="text-brand-800"/> Grafik Poin
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                      <XAxis dataKey="week" tick={{fontSize:10,fill:'#9ca3af'}}/>
                      <YAxis tick={{fontSize:10,fill:'#9ca3af'}} domain={[-2,6]}/>
                      <Tooltip formatter={(v: any,_: any,{payload}: any)=>[`${v>0?'+':''}${v} (${KONDISI_INFO[payload.kondisi]?.short||'—'})`,'Poin']}
                        contentStyle={{borderRadius:8,fontSize:12}}/>
                      <Bar dataKey="poin" radius={[4,4,0,0]}>
                        {chartData.map((d,i)=><Cell key={i} fill={KONDISI_INFO[d.kondisi]?.bar||'#e5e7eb'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

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
                  <h3 className="font-semibold text-gray-700">Riwayat Mingguan</h3>
                  <span className="text-xs text-gray-400">{rekapMinggu.length} minggu</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Periode</th><th>Status</th><th>Dijadwalkan</th>
                        <th>Hadir Tugas</th><th>Hadir Latihan</th><th>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rekapMinggu.length===0 ? (
                        <tr><td colSpan={6} className="text-center py-8 text-gray-400">Tidak ada data pada rentang ini</td></tr>
                      ) : rekapMinggu.map((r,i)=>{
                        const ki = KONDISI_INFO[r.kondisi];
                        return (
                          <tr key={i}>
                            <td className="text-xs text-gray-500 whitespace-nowrap">
                              {formatDate(r.week_start,'dd MMM')} – {formatDate(r.week_end,'dd MMM')}
                            </td>
                            <td>
                              {ki ? (
                                <span className={`badge text-xs ${ki.color}`}>{ki.short}</span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="text-center">{r.is_dijadwalkan?'✓':'—'}</td>
                            <td className="text-center">{r.is_hadir_tugas?'✓':r.is_walk_in?'↑':'—'}</td>
                            <td className="text-center">{r.is_hadir_latihan?'✓':'—'}</td>
                            <td>
                              <span className={`font-bold ${r.poin>0?'text-green-600':r.poin<0?'text-red-600':'text-gray-400'}`}>
                                {r.poin>0?'+':''}{r.poin??0}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── TAB ALL ─── */}
      {tab === 'all' && isPengurus && (
        <div className="card overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">Rekap Semua Anggota</h3>
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
                  <th>Poin</th>
                  <th title="Mengganti mendadak + Latihan (+5)">K1</th>
                  <th title="Hadir Lengkap terjadwal (+4)">K2a</th>
                  <th title="Hadir Lengkap pengganti swap (+3)">K2b</th>
                  <th title="Hadir Tugas saja terjadwal (+3)">K3a</th>
                  <th title="Mengganti mendadak saja (+3)">K3b</th>
                  <th title="Hadir Tugas saja pengganti swap (+2)">K3c</th>
                  <th title="Hadir Latihan saja tidak terjadwal (+2)">K4a</th>
                  <th title="Hadir Latihan saja terjadwal (0)">K4c</th>
                  <th title="Absen (-1)" className="text-red-600">K6</th>
                  <th>Hadir</th>
                  <th>Minggu</th>
                </tr>
              </thead>
              <tbody>
                {allLoading ? (
                  <tr><td colSpan={15} className="text-center py-8 text-gray-400">Menghitung rekap semua anggota...</td></tr>
                ) : filteredAll.sort((a: any,b: any)=>b.totalPoin-a.totalPoin).map((m: any,i: any)=>{
                  const kCounts: Record<string,any> = {};
                  ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].forEach((k: any) => {
                    kCounts[k] = (m.rows||[]).filter((r: any)=>r.kondisi===k).length;
                  });
                  const kColor: Record<string,string> = {
                    K1:'text-purple-700', K2a:'text-green-700', K2b:'text-emerald-600',
                    K3a:'text-blue-600', K3b:'text-sky-600', K3c:'text-cyan-600',
                    K4a:'text-teal-600', K4c:'text-yellow-600', K6:'text-red-600',
                  };
                  return (
                    <tr key={m.id}>
                      <td className="text-gray-400 font-mono">{i+1}</td>
                      <td className="font-semibold text-gray-900">{m.nama_panggilan}</td>
                      <td className="text-gray-500">{m.lingkungan}</td>
                      <td>
                        <span className={`font-black text-sm ${m.totalPoin>0?'text-green-600':m.totalPoin<0?'text-red-600':'text-gray-400'}`}>
                          {m.totalPoin>0?'+':''}{m.totalPoin}
                        </span>
                      </td>
                      {['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].map((k: string)=>(
                        <td key={k} className="text-center">
                          {kCounts[k]>0?<span className={`font-bold ${kColor[k]}`}>{kCounts[k]}</span>:'—'}
                        </td>
                      ))}
                      <td className="text-center text-gray-600">{m.hadir}</td>
                      <td className="text-center text-gray-400">{m.minggu}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kondisi Reference table */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">📊 Keterangan Lengkap Kondisi Poin</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(KONDISI_INFO).map(([k,v])=>(
            <div key={k} className={`p-3 rounded-xl ${v.color} flex items-start gap-3`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center">
                <span className="font-black text-sm">{k}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{v.short}</span>
                  <span className="font-black text-base ml-2">{v.poin}</span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{v.label}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 border-t border-gray-200 pt-3">
          💡 Poin dihitung real-time dari data scan &amp; jadwal. K1 (Mengganti mendadak + Latihan) mendapat bonus tertinggi karena kontribusi ekstra tanpa kewajiban. K6 (Absen) mendapat penalti. "Mengganti" = hadir di event tanpa terjadwal sebelumnya.
        </p>
      </div>
    </div>
  );
}
