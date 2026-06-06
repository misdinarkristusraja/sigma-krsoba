import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { hitungPoin, tagDuplicateNames, getWeekStartFromDate, toLocalISO } from '../lib/utils';
import { Trophy, Crown, Medal, RefreshCw } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────
function cutoff(months: any) {
  const d = new Date(); d.setMonth(d.getMonth()-months); return toLocalISO(d);
}

// ─── Hitung leaderboard mingguan real-time ────────────────
function buildLeaderboard({ members, assigns, scans, swaps, bonuses, dateFrom, dateTo }: any) {
  const aMap: Record<string,any[]> = {};
  const sMap: Record<string,any[]> = {};
  const swMap: Record<string,any[]> = {}; // swaps as requester
  const bonusMap: Record<string,number> = {};

  members.forEach((m: any) => { aMap[m.id] = []; sMap[m.id] = []; swMap[m.id] = []; bonusMap[m.id] = 0; });

  assigns.filter((a: any) => a.events).forEach((a: any) => {
    if (aMap[a.user_id]) aMap[a.user_id].push({
      event_id:        a.event_id,
      assignment_id:   a.id,
      tanggal_tugas:   a.events.tanggal_tugas,
      tanggal_latihan: a.events.tanggal_latihan,
    });
  });
  scans.forEach((s: any)  => { if (sMap[s.user_id])  sMap[s.user_id].push(s); });
  (swaps||[]).forEach((sw: any) => { if (swMap[sw.requester_id]) swMap[sw.requester_id].push(sw); });
  (bonuses||[]).forEach((b: any) => { if (bonusMap[b.user_id] !== undefined) bonusMap[b.user_id] += (b.poin || 0); });

  // Build lookup: pengganti_id → Set of week_start where they were swap replacement
  const penggantiWeeks: Record<string, Set<string>> = {};
  members.forEach((m: any) => { penggantiWeeks[m.id] = new Set(); });
  (swaps||[]).filter((sw: any) => sw.status === 'Replaced' && sw.pengganti_id && sw.assignments?.events?.tanggal_tugas)
    .forEach((sw: any) => {
      const ws = getWeekStartFromDate(sw.assignments.events.tanggal_tugas);
      if (ws && penggantiWeeks[sw.pengganti_id]) penggantiWeeks[sw.pengganti_id].add(ws);
    });

  return members.map((m: any) => {
    const replacedIds = new Set(
      swMap[m.id].filter((sw: any) => sw.status === 'Replaced' && sw.assignment_id)
                 .map((sw: any) => sw.assignment_id)
    );
    const activeEventIds = new Set(
      aMap[m.id]
        .filter((a: any) => !a.assignment_id || !replacedIds.has(a.assignment_id))
        .map((a: any) => a.event_id).filter(Boolean)
    );

    const weeks: Record<string,any> = {};
    const mkW = () => ({ is_dijadwalkan: false, is_hadir_tugas: false, is_hadir_latihan: false, is_walk_in: false });

    // Pass 1 — dijadwalkan
    aMap[m.id].filter((a: any) => !a.assignment_id || !replacedIds.has(a.assignment_id)).forEach((a: any) => {
      const tgl = a.tanggal_tugas || a.tanggal_latihan;
      if (!tgl || (dateFrom && tgl < dateFrom) || (dateTo && tgl > dateTo)) return;
      const ws = getWeekStartFromDate(tgl); if (!ws) return;
      if (!weeks[ws]) weeks[ws] = mkW();
      weeks[ws].is_dijadwalkan = true;
    });

    // Pass 2 — scan (scans already server-filtered by date range)
    sMap[m.id].forEach((s: any) => {
      const ds = s.timestamp?.split('T')[0];
      if (!ds) return;
      const ws = getWeekStartFromDate(ds); if (!ws) return;
      if (!weeks[ws]) weeks[ws] = mkW();
      const t = s.scan_type;
      if (t === 'tugas'   || t === 'walkin_tugas')   weeks[ws].is_hadir_tugas   = true;
      if (t === 'latihan' || t === 'walkin_latihan')  weeks[ws].is_hadir_latihan = true;
      if (t === 'walkin_tugas' || t === 'walkin_latihan') {
        weeks[ws].is_walk_in = true;
      } else if ((t === 'tugas' || t === 'latihan') && s.event_id && !activeEventIds.has(s.event_id)) {
        weeks[ws].is_walk_in = true;
      } else if (!s.event_id && !weeks[ws].is_dijadwalkan) {
        weeks[ws].is_walk_in = true;
      }
    });

    // Pass 3 — poin (with swap_pengganti)
    let poinMingguan = 0, hadirCount = 0, absenCount = 0;
    Object.entries(weeks).forEach(([ws, w]: [string, any]) => {
      const { poin, kondisi } = hitungPoin({
        isDijadwalkan:   w.is_dijadwalkan,
        isHadirTugas:    w.is_hadir_tugas,
        isHadirLatihan:  w.is_hadir_latihan,
        isWalkIn:        w.is_walk_in,
        isSwapPengganti: penggantiWeeks[m.id]?.has(ws) ?? false,
      });
      if (kondisi !== null) {
        poinMingguan += poin || 0;
        if (w.is_hadir_tugas || w.is_hadir_latihan) hadirCount++;
        if (kondisi === 'K6') absenCount++;
      }
    });

    const poinBonus  = bonusMap[m.id] || 0;
    const totalPoin  = poinMingguan + poinBonus;
    return { ...m, totalPoin, poinMingguan, poinBonus, hadirCount, absenCount, minggu: Object.keys(weeks).length };
  }).sort((a: any, b: any) => b.totalPoin - a.totalPoin);
}

// ─── Hitung leaderboard harian real-time ──────────────────
function buildLeaderboardHarian({ members, scans, dateFrom, dateTo }: any) {
  const sMap: Record<string,any> = {};
  members.forEach((m: any) => { sMap[m.id] = 0; });
  scans
    .filter((s: any) => (s.scan_type==='tugas'||s.scan_type==='walkin_tugas') && s.event_id)
    .forEach((s: any) => {
      const ds = s.timestamp?.split('T')[0];
      if (!ds || (dateFrom && ds<dateFrom) || (dateTo && ds>dateTo)) return;
      if (sMap[s.user_id] !== undefined) sMap[s.user_id]++;
    });
  return members.map((m: any) => ({ ...m, hadirHarian: sMap[m.id]||0 }))
    .sort((a: any,b: any) => b.hadirHarian - a.hadirHarian);
}

// ═════════════════════════════════════════════════════════
export default function LeaderboardPage() {
  const { profile } = useAuth();

  const [tab,      setTab]    = useState('mingguan');
  const [loading,  setLoading]= useState(true);
  const [data,     setData]   = useState<any[]>([]);
  const [dateFrom, setDateFrom]= useState(cutoff(1));
  const [dateTo,   setDateTo]  = useState(toLocalISO(new Date()));

  // Static data (fetch once)
  const [members,      setMembers]      = useState<any[]>([]);
  const [assigns,      setAssigns]      = useState<any[]>([]);
  const [swaps,        setSwaps]        = useState<any[]>([]);
  const [staticLoaded, setStaticLoaded] = useState(false);

  // Dynamic data (refetch on date change)
  const [scans,   setScans]   = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [loaded,  setLoaded]  = useState(false);

  // Load static data once
  useEffect(() => {
    async function fetchStatic() {
      const [{ data: mems }, { data: asgs }, { data: swps }] = await Promise.all([
        supabase.from('users')
          .select('id, nama_panggilan, lingkungan, pendidikan')
          .eq('status','Active')
          .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
          .order('nama_panggilan'),
        supabase.from('assignments')
          .select('id, user_id, event_id, events(tanggal_tugas, tanggal_latihan, tipe_event, is_draft)')
          .not('events.tipe_event','eq','Misa_Harian'),
        // Include pengganti_id + assignment event date for swap_pengganti detection
        supabase.from('swap_requests')
          .select('requester_id, pengganti_id, assignment_id, status, assignments(events(tanggal_tugas))')
          .eq('status','Replaced'),
      ]);
      setMembers(mems || []);
      setAssigns((asgs||[]).filter((a: any) => a.events && !a.events.is_draft));
      setSwaps(swps || []);
      setStaticLoaded(true);
    }
    fetchStatic();
  }, []);

  // Fetch dynamic data (scans + bonuses) filtered server-side by date range
  useEffect(() => {
    if (!staticLoaded) return;
    setLoaded(false);
    async function fetchDynamic() {
      const fromTs = dateFrom + 'T00:00:00';
      const toTs   = dateTo   + 'T23:59:59';
      const [{ data: scs }, { data: bons }] = await Promise.all([
        supabase.from('scan_records')
          .select('user_id, scan_type, timestamp, is_walk_in, event_id')
          .gte('timestamp', fromTs)
          .lte('timestamp', toTs),
        supabase.from('poin_bonus')
          .select('user_id, poin, tanggal')
          .gte('tanggal', dateFrom)
          .lte('tanggal', dateTo),
      ]);
      setScans(scs || []);
      setBonuses(bons || []);
      setLoaded(true);
    }
    fetchDynamic();
  }, [staticLoaded, dateFrom, dateTo]);

  // Recalculate when data or tab changes
  useEffect(() => {
    if (!loaded || !members.length) return;
    setLoading(true);
    setTimeout(() => {
      if (tab === 'mingguan') {
        const lb = buildLeaderboard({ members, assigns, scans, swaps, bonuses, dateFrom, dateTo });
        setData(lb);
      } else {
        const lb = buildLeaderboardHarian({ members, scans, dateFrom, dateTo });
        setData(lb);
      }
      setLoading(false);
    }, 50);
  }, [tab, loaded]);

  // Preset periods
  function setPeriod(months: any, year?: any) {
    if (year === 'ytd') {
      setDateFrom(`${new Date().getFullYear()}-01-01`);
      setDateTo(toLocalISO(new Date()));
    } else if (months === null) {
      setDateFrom('2020-01-01');
      setDateTo(toLocalISO(new Date()));
    } else {
      setDateFrom(cutoff(months));
      setDateTo(toLocalISO(new Date()));
    }
  }

  const periods = [
    { label: '1 Bln',    action: () => setPeriod(1) },
    { label: '2 Bln',    action: () => setPeriod(2) },
    { label: '3 Bln',    action: () => setPeriod(3) },
    { label: 'Tahun Ini',action: () => setPeriod(0,'ytd') },
    { label: 'Semua',    action: () => setPeriod(null) },
  ];

  const RankIcon = ({ rank }: any) => {
    if (rank===1) return <Crown size={18} className="text-yellow-400"/>;
    if (rank===2) return <Medal size={16} className="text-gray-400"/>;
    if (rank===3) return <Medal size={16} className="text-amber-600"/>;
    return <span className="text-gray-400 text-sm font-bold text-center w-5">{rank}</span>;
  };

  // Top 3 + rest
  const top3 = data.slice(0,3);
  const rest  = data.slice(3);
  const myRank  = data.findIndex(d => d.id === profile?.id) + 1;
  // Disambiguasi nama yang sama di leaderboard
  const nameTag = tagDuplicateNames(data);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Trophy size={22} className="text-yellow-400"/> Leaderboard
          </h1>
          <p className="page-subtitle">Real-time · {data.length} anggota aktif</p>
        </div>
        <button onClick={() => { setLoaded(false); setTimeout(()=>setLoaded(true), 100); }}
          className="btn-ghost p-2"><RefreshCw size={16}/></button>
      </div>

      {/* Tabs: mingguan / harian */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{key:'mingguan',label:'🏆 Misa Mingguan'},{key:'harian',label:'📅 Misa Harian'}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key?'bg-white text-brand-800 shadow-sm':'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap">
          {periods.map(p => (
            <button key={p.label} onClick={p.action}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-brand-50 hover:text-brand-800 transition-all">
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="date" className="input input-sm text-xs w-32" value={dateFrom}
            onChange={e=>setDateFrom(e.target.value)}/>
          <span>–</span>
          <input type="date" className="input input-sm text-xs w-32" value={dateTo}
            onChange={e=>setDateTo(e.target.value)}/>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i=><div key={i} className="skeleton h-14 rounded-xl"/>)}</div>
      ) : (
        <>
          {/* Podium top 3 */}
          {top3.length >= 2 && (
            <div className="flex items-end justify-center gap-4 py-6">
              {/* Rank 2 */}
              {top3[1] && (
                <div className="text-center">
                  <div className="w-14 h-14 bg-gray-200 rounded-full mx-auto flex items-center justify-center mb-2 text-lg font-bold text-gray-700">
                    {top3[1].nama_panggilan?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-semibold text-sm text-gray-800">{nameTag[top3[1].id] || top3[1].nama_panggilan}</p>
                  <p className="text-xs text-gray-500">{top3[1].lingkungan}</p>
                  <div className="mt-2 bg-gray-200 rounded-t-xl px-4 py-3 text-center">
                    <Medal size={20} className="mx-auto text-gray-400 mb-1"/>
                    <p className="font-black text-gray-700">{tab==='mingguan' ? (top3[1].totalPoin>0?'+':'')+top3[1].totalPoin : top3[1].hadirHarian+'×'}</p>
                    <p className="text-[10px] text-gray-500">#{2}</p>
                  </div>
                </div>
              )}
              {/* Rank 1 */}
              {top3[0] && (
                <div className="text-center -mt-6">
                  <div className="w-16 h-16 bg-yellow-200 rounded-full mx-auto flex items-center justify-center mb-2 text-xl font-bold text-yellow-800 ring-4 ring-yellow-400">
                    {top3[0].nama_panggilan?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-bold text-gray-900">{nameTag[top3[0].id] || top3[0].nama_panggilan}</p>
                  <p className="text-xs text-gray-500">{top3[0].lingkungan}</p>
                  <div className="mt-2 bg-yellow-400 rounded-t-xl px-4 py-4 text-center">
                    <Crown size={22} className="mx-auto text-yellow-900 mb-1"/>
                    <p className="font-black text-yellow-900 text-lg">{tab==='mingguan' ? (top3[0].totalPoin>0?'+':'')+top3[0].totalPoin : top3[0].hadirHarian+'×'}</p>
                    <p className="text-[10px] text-yellow-800">#1</p>
                  </div>
                </div>
              )}
              {/* Rank 3 */}
              {top3[2] && (
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-2 text-base font-bold text-amber-700">
                    {top3[2].nama_panggilan?.[0]?.toUpperCase()}
                  </div>
                  <p className="font-semibold text-sm text-gray-800">{nameTag[top3[2].id] || top3[2].nama_panggilan}</p>
                  <p className="text-xs text-gray-500">{top3[2].lingkungan}</p>
                  <div className="mt-2 bg-amber-300 rounded-t-xl px-3 py-2 text-center">
                    <Medal size={18} className="mx-auto text-amber-700 mb-1"/>
                    <p className="font-black text-amber-900">{tab==='mingguan' ? (top3[2].totalPoin>0?'+':'')+top3[2].totalPoin : top3[2].hadirHarian+'×'}</p>
                    <p className="text-[10px] text-amber-700">#3</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Posisi saya (kalau bukan top 3) */}
          {myRank > 3 && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center gap-3">
              <span className="font-bold text-brand-800">#{myRank}</span>
              <span className="text-sm text-brand-700">Posisi kamu saat ini</span>
              <span className="ml-auto font-black text-brand-800">
                {tab==='mingguan'
                  ? (data[myRank-1]?.totalPoin>0?'+':'')+data[myRank-1]?.totalPoin
                  : data[myRank-1]?.hadirHarian+'×'
                }
              </span>
            </div>
          )}

          {/* Full ranking */}
          <div className="card overflow-hidden p-0">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Nama</th>
                  <th>Lingkungan</th>
                  {tab==='mingguan' ? (
                    <><th>Poin</th><th>Hadir</th><th>Absen</th></>
                  ) : (
                    <><th>Hadir Misa Harian</th></>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((d,i)=>{
                  const isMe = d.id === profile?.id;
                  return (
                    <tr key={d.id} className={isMe ? 'bg-brand-50 font-semibold' : ''}>
                      <td><div className="flex items-center justify-center"><RankIcon rank={i+1}/></div></td>
                      <td>
                        <span className="font-medium text-gray-900">{nameTag[d.id] || d.nama_panggilan}</span>
                        {isMe && <span className="ml-1.5 text-[10px] bg-brand-800 text-white px-1.5 rounded">Kamu</span>}
                      </td>
                      <td className="text-xs text-gray-500">{d.lingkungan}</td>
                      {tab==='mingguan' ? (
                        <>
                          <td>
                            <span className={`font-black ${d.totalPoin>0?'text-green-600':d.totalPoin<0?'text-red-600':'text-gray-400'}`}>
                              {d.totalPoin>0?'+':''}{d.totalPoin}
                            </span>
                            {d.poinBonus !== 0 && (
                              <span className={`ml-1 text-[10px] font-medium ${d.poinBonus>0?'text-blue-500':'text-red-400'}`}>
                                ({d.poinBonus>0?'+':''}{d.poinBonus})
                              </span>
                            )}
                          </td>
                          <td className="text-center text-sm text-gray-600">{d.hadirCount}</td>
                          <td className="text-center text-sm">{d.absenCount>0?<span className="text-red-500">{d.absenCount}</span>:'—'}</td>
                        </>
                      ) : (
                        <td>
                          <span className="font-black text-blue-600">{d.hadirHarian}×</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
