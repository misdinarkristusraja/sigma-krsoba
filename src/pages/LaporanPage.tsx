import React, { useState, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { formatDate, hitungPoin, getWeekStartFromDate } from '../lib/utils';
import { FileText, Download, RefreshCw, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni',
                'Juli','Agustus','September','Oktober','November','Desember'];



export default function LaporanPage() {
  const { profile, isPengurus } = useAuth();
  const now     = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [data,  setData]  = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setData(null);
    const padM     = String(month).padStart(2,'0');
    const dateFrom = `${year}-${padM}-01`;
    const dateTo   = `${year}-${padM}-${new Date(year, month, 0).getDate()}`;

    // Load all active members
    const { data: members } = await supabase.from('users')
      .select('id, nama_panggilan, nickname, lingkungan, pendidikan')
      .eq('status','Active')
      .in('role', ['Misdinar_Aktif','Misdinar_Retired'])
      .order('nama_panggilan');

    if (!members?.length) { setLoading(false); return; }

    // Load all data for the month
    const [{ data: assigns }, { data: scans }, { data: swaps }, { data: events }] = await Promise.all([
      supabase.from('assignments').select('id, user_id, event_id, events(tanggal_tugas, tanggal_latihan, tipe_event, is_draft, perayaan)'),
      supabase.from('scan_records').select('user_id, scan_type, timestamp, event_id')
        .gte('timestamp', dateFrom + 'T00:00:00').lte('timestamp', dateTo + 'T23:59:59'),
      supabase.from('swap_requests').select('requester_id, assignment_id, status'),
      supabase.from('events').select('id, perayaan, nama_event, tanggal_tugas, tanggal_latihan, tipe_event')
        .gte('tanggal_tugas', dateFrom).lte('tanggal_tugas', dateTo).neq('tipe_event','Misa_Harian'),
    ]);

    // Build per-user stats
    const aMap: Record<string,any[]> = {}, sMap: Record<string,any[]> = {}, swMap: Record<string,any[]> = {};
    members.forEach((m: any) => { aMap[m.id] = []; sMap[m.id] = []; swMap[m.id] = []; });
    (assigns||[]).filter((a: any) => a.events && !a.events.is_draft && a.events.tipe_event !== 'Misa_Harian').forEach((a: any) => {
      if (aMap[a.user_id]) aMap[a.user_id].push({ event_id: a.event_id, assignment_id: a.id, tanggal_tugas: a.events.tanggal_tugas, tanggal_latihan: a.events.tanggal_latihan });
    });
    (scans||[]).forEach((s: any) => { if (sMap[s.user_id]) sMap[s.user_id].push(s); });
    (swaps||[]).forEach((sw: any) => { if (swMap[sw.requester_id]) swMap[sw.requester_id].push(sw); });

    const rows = members.map((m: any) => {
      const replacedIds = new Set((swMap[m.id]||[]).filter((sw: any)=>sw.status==='Replaced'&&sw.assignment_id).map((sw: any)=>sw.assignment_id));
      const activeAssigns = (aMap[m.id]||[]).filter((a: any) => !a.assignment_id || !replacedIds.has(a.assignment_id));
      const jadwalBulanIni = activeAssigns.filter((a: any) => { const t = a.tanggal_tugas||a.tanggal_latihan; return t >= dateFrom && t <= dateTo; }).length;
      const tugasScans  = (sMap[m.id]||[]).filter((s: any) => s.scan_type==='tugas' || s.scan_type==='walkin_tugas').length;
      const latihanScans= (sMap[m.id]||[]).filter((s: any) => s.scan_type==='latihan' || s.scan_type==='walkin_latihan').length;
      const walkIns     = (sMap[m.id]||[]).filter((s: any) => s.scan_type?.includes('walkin')).length;

      // Compute K1-K6 for this month
      const weeks: Record<string,any> = {};
      activeAssigns.forEach((a: any) => {
        const tgl = a.tanggal_tugas || a.tanggal_latihan;
        if (!tgl || tgl < dateFrom || tgl > dateTo) return;
        const ws = getWeekStartFromDate(tgl); if (!ws) return;
        if (!weeks[ws]) weeks[ws] = { is_dijadwalkan:false, is_hadir_tugas:false, is_hadir_latihan:false, is_walk_in:false };
        weeks[ws].is_dijadwalkan = true;
      });
      const activeEventIds = new Set(activeAssigns.map((a: any)=>a.event_id).filter(Boolean));
      (sMap[m.id]||[]).forEach((s: any) => {
        const ds = s.timestamp?.split('T')[0]; if (!ds || ds < dateFrom || ds > dateTo) return;
        const ws = getWeekStartFromDate(ds); if (!ws) return;
        if (!weeks[ws]) weeks[ws] = { is_dijadwalkan:false, is_hadir_tugas:false, is_hadir_latihan:false, is_walk_in:false };
        const t = s.scan_type;
        if (t==='tugas'||t==='walkin_tugas')    weeks[ws].is_hadir_tugas=true;
        if (t==='latihan'||t==='walkin_latihan') weeks[ws].is_hadir_latihan=true;
        if (t?.includes('walkin') || (s.event_id && !activeEventIds.has(s.event_id))) weeks[ws].is_walk_in=true;
      });
      const kCounts: Record<string,any> = {};
      ['K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'].forEach((k: any) => { kCounts[k] = 0; });
      let totalPoin = 0;
      Object.values(weeks).forEach((w: any) => {
        const { poin, kondisi } = hitungPoin({
          isDijadwalkan:  w.is_dijadwalkan,
          isHadirTugas:   w.is_hadir_tugas,
          isHadirLatihan: w.is_hadir_latihan,
          isWalkIn:       w.is_walk_in,
        });
        if (kondisi) { kCounts[kondisi] = (kCounts[kondisi]||0) + 1; totalPoin += poin||0; }
      });

      return { ...m, jadwalBulanIni, tugasScans, latihanScans, walkIns, totalPoin, kCounts, minggu: Object.keys(weeks).length };
    });

    // Summary stats
    const evList = (events||[]);
    setData({
      month, year, rows, events: evList,
      totalAnggota:  members.length,
      avgPoin:       rows.length ? Math.round(rows.reduce((s: any,r: any)=>s+r.totalPoin,0)/rows.length*10)/10 : 0,
      totalAbsen:    rows.reduce((s: any,r: any)=>s+(r.kCounts.K6||0),0),
      totalWalkIn:   rows.reduce((s: any,r: any)=>s+(r.walkIns||0),0),
    });
    setLoading(false);
  }, [month, year]);

  function exportCSV() {
    if (!data) return;
    const headers = ['Nama','Lingkungan','Poin','Jadwal','Tugas','Latihan','Mengganti','K1','K2a','K2b','K3a','K3b','K3c','K4a','K4c','K6'];
    const rows    = data.rows.map((r: any) => [
      r.nama_panggilan, r.lingkungan, r.totalPoin, r.jadwalBulanIni,
      r.tugasScans, r.latihanScans, r.walkIns,
      r.kCounts.K1, r.kCounts.K2a, r.kCounts.K2b,
      r.kCounts.K3a, r.kCounts.K3b, r.kCounts.K3c,
      r.kCounts.K4a, r.kCounts.K4c, r.kCounts.K6,
    ]);
    const esc = (v: any) => `"${String(v||'').replace(/"/g,'""')}"`;
    const csv = [headers.map(esc), ...rows.map((r: any)=>r.map(esc))].map((r: any)=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-${MONTHS[month-1].toLowerCase()}-${year}.csv`;
    a.click();
    toast.success('CSV laporan diunduh!');
  }

  if (!isPengurus) return <div className="card text-center py-12 text-gray-400">Hanya Pengurus yang dapat melihat laporan bulanan.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Laporan Bulanan</h1>
          <p className="page-subtitle">Rekap kehadiran & poin per bulan · Manual generate</p>
        </div>
        {data && (
          <button onClick={exportCSV} className="btn-outline gap-2 transition-all hover:scale-105 active:scale-95">
            <Download size={16}/> Unduh CSV
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="card flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Bulan:</label>
          <select className="input w-36" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Tahun:</label>
          <select className="input w-24" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={generate} disabled={loading}
          className="btn-primary gap-2 transition-all hover:scale-105 active:scale-95">
          <BarChart2 size={16}/>
          {loading ? 'Menghitung...' : `Generate Laporan ${MONTHS[month-1]} ${year}`}
        </button>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total Anggota',   val: data.totalAnggota,          color:'bg-brand-50 text-brand-800',    icon:'👥' },
              { label:'Rata-rata Poin',  val: `+${data.avgPoin}`,         color:'bg-green-50 text-green-700',   icon:'⭐' },
              { label:'Total Absen (K6)',val: data.totalAbsen,            color:'bg-red-50 text-red-700',       icon:'❌' },
              { label:'Mengganti Bulan Ini',val: data.totalWalkIn,          color:'bg-purple-50 text-purple-700', icon:'🚶' },
            ].map(c => (
              <div key={c.label} className={`${c.color} rounded-2xl p-4 text-center`}>
                <div className="text-2xl">{c.icon}</div>
                <div className="text-3xl font-black mt-1">{c.val}</div>
                <div className="text-xs font-medium mt-0.5 opacity-70">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Events this month */}
          {data.events.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">📅 Event {MONTHS[month-1]} {year}</h3>
              <div className="flex flex-wrap gap-2">
                {data.events.map((ev: any) => (
                  <span key={ev.id} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">
                    {formatDate(ev.tanggal_tugas,'dd MMM')} · {ev.perayaan||ev.nama_event}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Detail Per Anggota — {MONTHS[month-1]} {year}</h3>
              <span className="text-xs text-gray-400">{data.rows.length} anggota</span>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl text-xs">
                <thead>
                  <tr>
                    <th>#</th><th>Nama</th><th>Lingkungan</th>
                    <th>Poin</th><th>Jadwal</th><th>Tugas</th><th>Latihan</th><th>Mengganti</th>
                    <th className="text-purple-600" title="Mengganti mendadak + Latihan (+5)">K1</th>
                    <th className="text-green-600" title="Hadir Lengkap terjadwal (+4)">K2a</th>
                    <th className="text-emerald-600" title="Hadir Lengkap swap (+3)">K2b</th>
                    <th className="text-blue-600" title="Hadir Tugas terjadwal (+3)">K3a</th>
                    <th className="text-sky-600" title="Mengganti mendadak (+3)">K3b</th>
                    <th className="text-cyan-600" title="Hadir Tugas swap (+2)">K3c</th>
                    <th className="text-teal-600" title="Hadir Latihan tidak terjadwal (+2)">K4a</th>
                    <th className="text-yellow-600" title="Hadir Latihan terjadwal (0)">K4c</th>
                    <th className="text-red-600" title="Absen (-1)">K6</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.sort((a: any,b: any)=>b.totalPoin-a.totalPoin).map((r: any,i: any) => (
                    <tr key={r.id} className={r.kCounts.K6 > 0 ? 'bg-red-50/30' : ''}>
                      <td className="text-gray-400 font-mono">{i+1}</td>
                      <td className="font-semibold text-gray-900">{r.nama_panggilan}</td>
                      <td className="text-gray-500">{r.lingkungan}</td>
                      <td><span className={`font-black text-sm ${r.totalPoin>0?'text-green-600':r.totalPoin<0?'text-red-600':'text-gray-400'}`}>{r.totalPoin>0?'+':''}{r.totalPoin}</span></td>
                      <td className="text-center">{r.jadwalBulanIni||'—'}</td>
                      <td className="text-center">{r.tugasScans||'—'}</td>
                      <td className="text-center">{r.latihanScans||'—'}</td>
                      <td className="text-center">{r.walkIns>0?<span className="text-purple-600 font-bold">{r.walkIns}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K1||0)>0?<span className="text-purple-600 font-bold">{r.kCounts.K1}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K2a||0)>0?<span className="text-green-600 font-bold">{r.kCounts.K2a}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K2b||0)>0?<span className="text-emerald-600 font-bold">{r.kCounts.K2b}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K3a||0)>0?<span className="text-blue-600 font-bold">{r.kCounts.K3a}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K3b||0)>0?<span className="text-sky-600 font-bold">{r.kCounts.K3b}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K3c||0)>0?<span className="text-cyan-600 font-bold">{r.kCounts.K3c}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K4a||0)>0?<span className="text-teal-600 font-bold">{r.kCounts.K4a}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K4c||0)>0?<span className="text-yellow-600 font-bold">{r.kCounts.K4c}</span>:'—'}</td>
                      <td className="text-center">{(r.kCounts.K6||0)>0?<span className="text-red-600 font-bold">{r.kCounts.K6}</span>:'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
