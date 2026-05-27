import { useState, useCallback } from 'react';
import { supabase as supabaseTyped } from '@/lib/supabase';
const supabase = supabaseTyped as any;
import { getLiturgiMinggu as getStaticLiturgi, getLiturgiByMonth } from '@/lib/liturgiData2026';
import { getWeekends } from '@/lib/utils';
import toast from 'react-hot-toast';

const PETUGAS_PER_SLOT = 8;

// ── Liturgi fetcher (static 2026, gcatholic fallback) ──────────────
async function fetchLiturgi(year: number, month: number) {
  if (year === 2026) return getLiturgiByMonth(year, month);
  return fetchGcatholic(year, month);
}

const gcatholicCache: Record<string, any[]> = {};
async function fetchGcatholic(year: number, month: number) {
  const key = `${year}-${month}`;
  if (gcatholicCache[key]?.length) return gcatholicCache[key];
  const targetUrl = `https://gcatholic.org/calendar/${year}/ID-id`;
  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
  ];
  let html = '';
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      html = json?.contents || json?.body || '';
      if (html.includes('feast1')) break;
    } catch { continue; }
  }
  const parsed = html ? parseLiturgiHTML(html, year) : [];
  gcatholicCache[key] = parsed;
  return parsed;
}

const COLOR_MAP: Record<string, string> = { v:'Ungu', r:'Merah', w:'Putih', g:'Hijau', p:'MerahMuda', b:'Hitam' };
function parseLiturgiHTML(html: string, year: number) {
  const results: any[] = [];
  const trRegex = /<tr[^>]*\sid="(\d{4})"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRegex.exec(html)) !== null) {
    const month = parseInt(m[1].slice(0,2),10);
    const day   = parseInt(m[1].slice(2,4),10);
    if (!month||!day) continue;
    const row = m[2];
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const dow = tds[1]?.[1]?.replace(/<[^>]+>/g,'').trim()||'';
    const colorSpan = row.match(/<span\s+class="feast([a-z])"\s*>/i);
    const color = colorSpan ? (COLOR_MAP[colorSpan[1]]||'Hijau') : 'Hijau';
    const nameSpan = row.match(/<span\s+class="feast\d[^"]*">([\s\S]*?)<\/span>/i);
    if (!nameSpan) continue;
    const name = nameSpan[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if (name.length < 3) continue;
    results.push({
      date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      name, color,
      isMinggu: /minggu/i.test(dow),
      isSabtu:  /sabtu/i.test(dow),
      isHariRaya: /hari raya/i.test(name),
    });
  }
  return results;
}

// ── Monitor data types ─────────────────────────────────────────────
export interface MonitorMember {
  id: string;
  nickname: string;
  nama_panggilan: string;
  pendidikan?: string;
  lingkungan?: string;
  score: number;
  daysSince: number;
  relativePct: number;
  tier: 'new' | 'high' | 'medium' | 'low';
  rank: number;
  count180: number;
  countThisMonth: number;
  k6Count: number;
  k5Count: number;
  kondisiCount: Record<string, number>;
  bonus: number;
  lastDate: string | null;
}

export interface MonitorStats {
  members: MonitorMember[];
  totalSlotsMonth: number;
  filledSlots: number;
  poolSize: number;
  idealPerPerson: string | number;
  weekendsInMonth: number;
}

export function useAutoAssign(year: number, month: number, onDone: () => void) {
  const [generating,  setGenerating]  = useState(false);
  const [monitorData, setMonitorData] = useState<MonitorStats | null>(null);
  const [monitorLoad, setMonitorLoad] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    const tid = 'gen';
    try {
      toast.loading('Mengambil kalender liturgi...', { id: tid });
      const liturgyData = await fetchLiturgi(year, month);

      if (year === 2026) {
        toast.loading(`✅ Data liturgi dari jadwal paroki (${liturgyData.length} entri). Menghitung...`, { id: tid });
      } else if (liturgyData.length === 0) {
        toast.loading('⚠️ Data liturgi tidak tersedia — nama diisi manual', { id: tid });
      } else {
        toast.loading(`✅ ${liturgyData.length} entri liturgi. Menghitung jadwal...`, { id: tid });
      }

      const { data: pool, error: pErr } = await supabase
        .from('users')
        .select('id, nickname, nama_panggilan, pendidikan, lingkungan')
        .eq('status', 'Active')
        .eq('is_suspended', false)
        .in('role', ['Misdinar_Aktif', 'Misdinar_Retired']);
      if (pErr) throw pErr;
      if (!pool?.length) throw new Error('Tidak ada anggota aktif');

      const sixtyAgo = new Date(Date.now() - 60*24*60*60*1000).toISOString();
      const { data: recent } = await supabase
        .from('assignments').select('user_id, created_at').gte('created_at', sixtyAgo);
      const lastMap: Record<string, string> = {};
      (recent || []).forEach((a: any) => {
        if (!lastMap[a.user_id] || a.created_at > lastMap[a.user_id]) lastMap[a.user_id] = a.created_at;
      });
      const scored = pool.map((u: any) => ({
        ...u,
        score: lastMap[u.id] ? (Date.now() - new Date(lastMap[u.id]).getTime()) / 86400000 : 9999,
      })).sort((a: any, b: any) => b.score - a.score);

      const weekends = getWeekends(year, month);
      let poolIdx = 0, created = 0;

      for (const wk of weekends) {
        const liturgiMinggu = year === 2026
          ? getStaticLiturgi(wk.sunday)
          : (liturgyData.find((l: any) => l.date === wk.sunday && l.isMinggu) || null);
        const eventName    = liturgiMinggu?.name  || 'Misa Mingguan';
        const warnaLiturgi = liturgiMinggu?.color || 'Hijau';

        const { data: existing } = await supabase.from('events')
          .select('id').eq('tanggal_tugas', wk.sunday)
          .not('tipe_event','eq','Misa_Harian').maybeSingle();
        if (existing) continue;

        const { data: ev, error: evErr } = await supabase.from('events').insert({
          nama_event:        eventName.toUpperCase(),
          tipe_event:        'Mingguan',
          tanggal_tugas:     wk.sunday,
          tanggal_latihan:   wk.saturday,
          perayaan:          eventName,
          warna_liturgi:     warnaLiturgi,
          jumlah_misa:       4,
          status_event:      'Akan_Datang',
          is_draft:          true,
          gcatholic_fetched: liturgyData.length > 0,
        }).select().single();
        if (evErr) throw evErr;

        const used = new Set<string>();
        const assigns: any[] = [];
        for (let slot = 1; slot <= 4; slot++) {
          let cnt = 0, att = 0;
          while (cnt < PETUGAS_PER_SLOT && att < scored.length * 4) {
            const u = scored[poolIdx % scored.length];
            poolIdx++; att++;
            if (used.has(u.id)) continue;
            used.add(u.id);
            assigns.push({ event_id: ev.id, user_id: u.id, slot_number: slot, position: cnt + 1 });
            cnt++;
          }
        }
        if (assigns.length) await supabase.from('assignments').insert(assigns);
        created++;
      }

      toast.success(
        created > 0
          ? `✅ ${created} jadwal DRAFT dibuat. Isi PIC tiap slot lalu Publish!`
          : 'Semua jadwal bulan ini sudah ada.',
        { id: tid, duration: 6000 }
      );
      onDone();
    } catch (err: any) {
      toast.error('Gagal: ' + err.message, { id: tid });
    } finally {
      setGenerating(false);
    }
  }, [year, month, onDone]);

  const loadMonitor = useCallback(async () => {
    setMonitorLoad(true);
    const now = new Date();
    const { data: pool } = await supabase.from('users')
      .select('id, nickname, nama_panggilan, pendidikan, lingkungan')
      .eq('status', 'Active').eq('is_suspended', false)
      .in('role', ['Misdinar_Aktif', 'Misdinar_Retired']);
    if (!pool?.length) { setMonitorLoad(false); return; }

    const since180str = new Date(+now - 180*24*3600*1000).toISOString().split('T')[0];
    const since180    = new Date(+now - 180*24*3600*1000).toISOString();

    const [{ data: scanTugas }, { data: recent }] = await Promise.all([
      supabase.from('scan_records')
        .select('user_id, timestamp, event_id, events(tanggal_tugas)')
        .in('scan_type', ['tugas', 'walkin_tugas'])
        .gte('timestamp', since180str + 'T00:00:00')
        .order('timestamp', { ascending: false }),
      supabase.from('assignments')
        .select('user_id, created_at, slot_number, events(tanggal_tugas)')
        .gte('created_at', since180)
        .order('created_at', { ascending: false }),
    ]);

    const countMap: Record<string, number>      = {};
    const lastScanDate: Record<string, string|null>  = {};
    const lastEventDate: Record<string, string|null> = {};
    (pool as any[]).forEach(u => {
      countMap[u.id] = 0; lastScanDate[u.id] = null; lastEventDate[u.id] = null;
    });

    (scanTugas || []).forEach((s: any) => {
      if (lastScanDate[s.user_id] === undefined) return;
      if (!lastScanDate[s.user_id] || s.timestamp > (lastScanDate[s.user_id] as string)) lastScanDate[s.user_id] = s.timestamp;
      const evTgl = s.events?.tanggal_tugas;
      if (evTgl && (!lastEventDate[s.user_id] || evTgl > (lastEventDate[s.user_id] as string))) lastEventDate[s.user_id] = evTgl;
    });
    (recent||[]).forEach((a: any) => { if (countMap[a.user_id] !== undefined) countMap[a.user_id]++; });

    const since30   = new Date(+now - 30*24*3600*1000).toISOString().split('T')[0];
    const todayStr  = now.toISOString().split('T')[0];
    const { data: recentRekap } = await supabase
      .from('rekap_poin_mingguan')
      .select('user_id, kondisi, poin')
      .gte('week_start', since30).lte('week_start', todayStr);

    // Priority delta applied to daysSince score (higher score = higher priority = scheduled sooner).
    // Hadir (K1-K3c): REDUCE score — person was recently active, lower their priority.
    // K4c: tiny reduction — attended latihan only, slight credit.
    // K6: INCREASE score — absen needs to be rescheduled sooner.
    const KONDISI_DELTA: Record<string, number> = {
      K1: -5, K2a: -4, K2b: -3, K3a: -3, K3b: -3, K3c: -2,
      K4a: -2, K4c: -1, K6: +10,
    };
    const kondisiBonus: Record<string, number> = {};
    const kondisiCount: Record<string, Record<string, number>> = {};
    (pool as any[]).forEach(u => { kondisiBonus[u.id] = 0; kondisiCount[u.id] = {}; });
    (recentRekap || []).forEach((r: any) => {
      if (kondisiBonus[r.user_id] === undefined) return;
      kondisiBonus[r.user_id] += KONDISI_DELTA[r.kondisi] || 0;
      kondisiCount[r.user_id][r.kondisi] = (kondisiCount[r.user_id][r.kondisi] || 0) + 1;
    });

    const rawScored = (pool as any[]).map(u => {
      const lc        = lastScanDate[u.id];
      const daysSince = lc ? Math.max(1, Math.floor((+now - new Date(lc).getTime()) / 86400000)) : 9999;
      const bonus     = kondisiBonus[u.id] || 0;
      const score     = daysSince >= 9999 ? 9999 : Math.max(1, daysSince + bonus);
      return { ...u, daysSince, score, count180: countMap[u.id],
        k6Count: kondisiCount[u.id]?.K6||0, k5Count: kondisiCount[u.id]?.K4c||0,
        kondisiCount: kondisiCount[u.id]||{}, bonus, lastDate: lastEventDate[u.id] };
    }).sort((a: any, b: any) => b.score - a.score);

    const nonNewScores = rawScored.filter(u => u.score < 9999).map(u => u.score);
    const minScore  = nonNewScores.length ? Math.min(...nonNewScores) : 1;
    const maxScore  = nonNewScores.length ? Math.max(...nonNewScores) : 1;
    const scoreRange = maxScore - minScore;

    const withPct = rawScored.map((u: any, i: number) => {
      let pct: number;
      if (u.score >= 9999) { pct = 100; }
      else if (scoreRange === 0) {
        const n = nonNewScores.length;
        pct = n > 1 ? Math.round(100 - ((i / (n - 1)) * 60)) : 50;
      } else {
        pct = Math.round(((u.score - minScore) / scoreRange) * 95) + 5;
      }
      pct = Math.min(100, Math.max(1, pct));
      const tier = u.score >= 9999 ? 'new' : u.score >= 30 ? 'high' : u.score >= 7 ? 'medium' : 'low';
      return { ...u, relativePct: pct, tier, rank: i + 1 } as MonitorMember;
    });

    const weekendsInMonth  = getWeekends(year, month);
    const totalSlotsMonth  = weekendsInMonth.length * 4 * PETUGAS_PER_SLOT;
    const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
    const monthEnd   = `${year}-${String(month).padStart(2,'0')}-31`;
    const { data: thisMonthAssigns } = await supabase.from('assignments')
      .select('user_id, events(tanggal_tugas, is_draft)')
      .gte('events.tanggal_tugas', monthStart).lte('events.tanggal_tugas', monthEnd);

    const assignedThisMonth: Record<string, number> = {};
    (pool as any[]).forEach(u => { assignedThisMonth[u.id] = 0; });
    (thisMonthAssigns||[]).filter((a: any) => a.events).forEach((a: any) => {
      if (assignedThisMonth[a.user_id] !== undefined) assignedThisMonth[a.user_id]++;
    });

    setMonitorData({
      members: withPct.map((u: any) => ({ ...u, countThisMonth: assignedThisMonth[u.id] || 0 })),
      totalSlotsMonth,
      filledSlots: (thisMonthAssigns||[]).filter((a: any) => a.events).length,
      poolSize: pool.length,
      idealPerPerson: pool.length > 0 ? (totalSlotsMonth / pool.length).toFixed(1) : 0,
      weekendsInMonth: weekendsInMonth.length,
    });
    setMonitorLoad(false);
  }, [year, month]);

  return { generating, generate, monitorData, monitorLoad, loadMonitor };
}
