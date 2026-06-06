import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { parseQRValue } from '../lib/utils';
import {
  CheckCircle, XCircle, AlertTriangle, Camera, QrCode,
  Clock, Shield, Keyboard, User, ChevronDown, CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Konstanta ──────────────────────────────────────────────
const AUTO_RETURN_SEC  = 4;
const SCAN_COOLDOWN_MS = 60 * 60 * 1000; // anti-duplikat 60 menit

const SLOT_TIMES_MIN = {
  slot1: 17 * 60 + 30,  // 17:30 sabtu sore
  slot2:  6 * 60,       // 06:00 minggu
  slot3:  8 * 60,       // 08:00 minggu
  slot4: 17 * 60 + 30,  // 17:30 minggu
};
// Window scan: H-1 jam s/d H+3 jam
const WINDOW_BEFORE_MIN = 1 * 60;  // boleh scan 1 jam sebelum
const WINDOW_AFTER_MIN  = 3 * 60;  // boleh scan 3 jam sesudah

// Parse "HH:MM" atau "HH.MM" string → menit dari tengah malam
function parseJamToMin(jam: string | null | undefined, fallback = 8 * 60): number {
  if (!jam) return fallback;
  const m = jam.match(/(\d{1,2})[.:](\d{2})/);
  if (!m) return fallback;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

// ─── Helpers ────────────────────────────────────────────────
function toLocalISO(date: any) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function nowMinutesWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}

// H-1 s/d H+2: now >= slot-60 && now <= slot+120
function isInTimeWindow(slotMinutes: number) {
  const now = nowMinutesWIB();
  return now >= slotMinutes - WINDOW_BEFORE_MIN && now <= slotMinutes + WINDOW_AFTER_MIN;
}

// Ambil jam latihan dari event (latihan_times[0]) atau fallback ke default
function getLatihanMin(ev: any, defaultMin: number): number {
  if (ev.latihan_times?.length) return parseJamToMin(ev.latihan_times[0], defaultMin);
  return defaultMin;
}

function getActiveWindows(events: any[], today: string, latihanDefaultMin: number) {
  const activeWindows: string[] = [];
  for (const ev of events) {
    const isSaturday = ev.tanggal_latihan === today;
    const isSunday   = ev.tanggal_tugas   === today;
    if (isSaturday) {
      const lMin = getLatihanMin(ev, latihanDefaultMin);
      const lJamStr = `${String(Math.floor(lMin/60)).padStart(2,'0')}:${String(lMin%60).padStart(2,'0')}`;
      if (isInTimeWindow(lMin))             activeWindows.push(`Latihan (${lJamStr})`);
      if (isInTimeWindow(SLOT_TIMES_MIN.slot1)) activeWindows.push('Sabtu 17:30');
    }
    if (isSunday) {
      if (isInTimeWindow(SLOT_TIMES_MIN.slot2)) activeWindows.push('Minggu 06:00');
      if (isInTimeWindow(SLOT_TIMES_MIN.slot3)) activeWindows.push('Minggu 08:00');
      if (isInTimeWindow(SLOT_TIMES_MIN.slot4)) activeWindows.push('Minggu 17:30');
    }
    if (ev.tipe_event === 'Misa_Harian' && ev.tanggal_tugas === today) {
      if (isInTimeWindow(7 * 60)) activeWindows.push('Misa Harian (07:00)');
    }
    if (ev.tipe_event === 'Misa_Khusus' && ev.tanggal_tugas === today) {
      // Coba ambil dari draft_note per slot (format Slot N: HH.MM|date), ambil paling awal
      const slotMatches = [...(ev.draft_note || '').matchAll(/Slot\s+\d+:\s*(\d{2})\.(\d{2})/gi)];
      const mins = slotMatches.length
        ? slotMatches.map((m: any) => parseInt(m[1]) * 60 + parseInt(m[2]))
        : [7 * 60];
      if (mins.some((m: number) => isInTimeWindow(m))) activeWindows.push(ev.perayaan || 'Misa Khusus');
    }
  }
  return [...new Set(activeWindows)];
}

function getNextWindowLabel(events: any[], today: string, latihanDefaultMin: number) {
  const now = nowMinutesWIB();
  const all: { label: string; min: number }[] = [];
  for (const ev of events) {
    if (ev.tanggal_latihan === today) {
      const lMin = getLatihanMin(ev, latihanDefaultMin);
      const lJamStr = `${String(Math.floor(lMin/60)).padStart(2,'0')}:${String(lMin%60).padStart(2,'0')}`;
      all.push({ label: `Latihan ${lJamStr}`, min: lMin });
      all.push({ label: 'Sabtu 17:30', min: SLOT_TIMES_MIN.slot1 });
    }
    if (ev.tanggal_tugas === today) {
      if (ev.tipe_event === 'Misa_Harian') {
        all.push({ label: 'Misa Harian (07:00)', min: 7 * 60 });
      } else if (ev.tipe_event === 'Misa_Khusus') {
        const slotMatches = [...(ev.draft_note || '').matchAll(/Slot\s+\d+:\s*(\d{2})\.(\d{2})/gi)];
        const mins = slotMatches.length
          ? slotMatches.map((m: any) => parseInt(m[1]) * 60 + parseInt(m[2]))
          : [7 * 60];
        const earliest = Math.min(...mins);
        all.push({ label: ev.perayaan || 'Misa Khusus', min: earliest });
      } else {
        all.push({ label: 'Minggu 06:00', min: SLOT_TIMES_MIN.slot2 });
        all.push({ label: 'Minggu 08:00', min: SLOT_TIMES_MIN.slot3 });
        all.push({ label: 'Minggu 17:30', min: SLOT_TIMES_MIN.slot4 });
      }
    }
  }
  // "belum masuk window" = slot - WINDOW_BEFORE_MIN masih di depan sekarang
  const upcoming = all.filter(a => a.min - WINDOW_BEFORE_MIN > now).sort((a, b) => a.min - b.min);
  if (!upcoming.length) return null;
  const next = upcoming[0];
  const diff = next.min - WINDOW_BEFORE_MIN - now;
  const hours = Math.floor(diff / 60);
  const mins  = diff % 60;
  return `${next.label} (lagi ${hours > 0 ? `${hours}j ` : ''}${mins}m)`;
}

// ═══════════════════════════════════════════════════════════
export default function ScanPage() {
  const { profile, canScan, isAdmin } = useAuth();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const animRef   = useRef<number|null>(null);
  const returnRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Default jam latihan dari system_config (fallback 08:00 = 480 min)
  const [latihanDefaultMin, setLatihanDefaultMin] = useState(8 * 60);
  useEffect(() => {
    supabase.from('system_config').select('value').eq('key', 'latihan_jam_default').maybeSingle()
      .then(({ data }: { data: { value: string } | null }) => {
        if (data?.value) setLatihanDefaultMin(parseJamToMin(data.value, 8 * 60));
      });
  }, []);

  const [scanning,  setScanning]  = useState(false);
  const [result,    setResult]    = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [camError,  setCamError]  = useState('');
  const [showManual,    setShowManual]    = useState(false);
  const [manualNick,    setManualNick]    = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // ── Override panel state ────────────────────────────────────
  // Muncul saat: (a) di luar window waktu, (b) tidak ada jadwal hari ini,
  // (c) user tidak ada di jadwal (walk-in), (d) input manual
  const [override, setOverride] = useState<{
    member:     any;
    parsed:     any;
    raw:        string;
    isAnomaly:  boolean;
    events:     any[];   // candidate events untuk dipilih
    reason:     string;  // alasan otomatis (kenapa override muncul)
    scanTypeHint: 'tugas' | 'latihan'; // default berdasarkan QR / waktu
  } | null>(null);

  // Form state di dalam override panel
  const [ovEventId,    setOvEventId]    = useState('');
  const [ovDatetime,   setOvDatetime]   = useState(''); // "YYYY-MM-DDTHH:mm" WIB
  const [ovReason,     setOvReason]     = useState('');
  const [ovCustom,     setOvCustom]     = useState('');
  const [ovScanType,   setOvScanType]   = useState<'tugas'|'latihan'>('tugas');
  const [ovSubmitting, setOvSubmitting] = useState(false);

  // Preset alasan override
  const OVERRIDE_PRESETS = [
    'Hadir tapi lupa scan',
    'Scan telat setelah misa',
    'Menggantikan mendadak',
    'Kamera tidak bisa baca QR',
    'Lainnya...',
  ];

  const startCamera = useCallback(async () => {
    // FIX BUG-012: Cancel RAF loop yang mungkin masih berjalan dari sesi sebelumnya
    // sebelum memulai kamera baru. Tanpa ini, dua RAF loop bisa berjalan bersamaan
    // saat handleReset() memanggil startCamera() berulang kali, menyebabkan CPU spike
    // dan deteksi QR yang tidak konsisten.
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current         = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch (e: any) {
      setCamError('Tidak dapat mengakses kamera. Izinkan akses di browser.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setScanning(false);
  }, []);

  useEffect(() => {
    if (canScan) startCamera();
    return () => { stopCamera(); if (returnRef.current) clearInterval(returnRef.current); };
  }, [canScan]);

  function scanLoop() {
    animRef.current = requestAnimationFrame(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) { scanLoop(); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const code = jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data, canvas.width, canvas.height, { inversionAttempts:'dontInvert' });
      if (code?.data) { stopCamera(); processQR(code.data); }
      else scanLoop();
    });
  }

  // ── Validasi & proses QR ───────────────────────────────────
  async function processQR(raw: any) {
    const parsed = parseQRValue(raw);
    if (!parsed) {
      showResult({ status:'error', message:'QR tidak dikenali. Format tidak valid.', raw }); return;
    }

    // 1. Cari user
    const { data: member } = await supabase
      .from('users')
      .select('id, nickname, myid, nama_panggilan, lingkungan, role, status, is_suspended')
      .eq('nickname', parsed.nickname.toLowerCase())
      .maybeSingle();
    if (!member) {
      showResult({ status:'error', message:`Misdinar "${parsed.nickname}" tidak ditemukan.` }); return;
    }
    if (member.is_suspended) {
      showResult({ status:'error', message:`${member.nama_panggilan} sedang disuspend.`, member }); return;
    }

    const isAnomaly = member.myid !== parsed.myid?.toUpperCase();

    // 2. Anti-duplikat (60 menit) — cek SEMUA tipe scan (latihan maupun tugas)
    // Cek keduanya sekaligus: seseorang tidak bisa scan latihan+tugas dalam 60 menit,
    // dan QR tugas yang discan saat window latihan tetap ter-detect sebagai duplikat.
    const since = new Date(Date.now() - SCAN_COOLDOWN_MS).toISOString();
    const { data: dupe } = await supabase.from('scan_records')
      .select('id, timestamp, scan_type')
      .eq('user_id', member.id)
      .in('scan_type', ['latihan','walkin_latihan','tugas','walkin_tugas'])
      .gte('timestamp', since)
      .order('timestamp', { ascending:false }).limit(1).maybeSingle();
    if (dupe) {
      const minsAgo = Math.floor((Date.now() - new Date(dupe.timestamp).getTime()) / 60000);
      showResult({ status:'warning', message:`${member.nama_panggilan} sudah discan (${dupe.scan_type}) ${minsAgo} menit lalu.`, member }); return;
    }

    // 3. Cari semua event hari ini (tanggal_tugas atau tanggal_latihan = hari ini)
    const today = toLocalISO(new Date());
    const { data: todayEvents } = await supabase
      .from('events')
      .select('id, nama_event, tipe_event, tanggal_tugas, tanggal_latihan, perayaan, draft_note, status_event, latihan_times')
      .or(`tanggal_tugas.eq.${today},tanggal_latihan.eq.${today}`)
      .in('status_event', ['Akan_Datang','Berlangsung'])
      .not('is_draft', 'eq', true)
      .order('tanggal_tugas', { ascending: true });

    // 4. Validasi: ada event hari ini?
    if (!todayEvents || todayEvents.length === 0) {
      const msg = `Tidak ada event hari ini (${today}).`;
      const { data: recentEvents } = await supabase
        .from('events')
        .select('id, nama_event, perayaan, tipe_event, tanggal_tugas, tanggal_latihan')
        .not('is_draft', 'eq', true)
        .order('tanggal_tugas', { ascending: false })
        .limit(20);
      openOverride({ member, parsed, raw, isAnomaly, events: recentEvents ?? [], reason: msg });
      return;
    }

    // 5. Cek apakah ini window latihan (hari = tanggal_latihan salah satu event)
    const latihanEvents = (todayEvents as any[]).filter((ev: any) => ev.tanggal_latihan === today);
    const isLatihanWindow = latihanEvents.length > 0 &&
      latihanEvents.some((ev: any) => isInTimeWindow(getLatihanMin(ev, latihanDefaultMin)));
    const isLatihanScan = parsed.type === 'latihan' || isLatihanWindow;

    if (isLatihanScan && latihanEvents.length > 0) {
      // ── JALUR LATIHAN: tidak perlu override, tidak perlu window ketat ──
      const targetLatihanEv = latihanEvents.find((ev: any) =>
        isInTimeWindow(getLatihanMin(ev, latihanDefaultMin))
      ) || latihanEvents[0];

      // Cek apakah user dijadwalkan di event ini
      const { data: asgn } = await supabase.from('assignments')
        .select('id').eq('user_id', member.id).eq('event_id', targetLatihanEv.id).maybeSingle();

      const isScheduled = !!asgn;
      await saveScanRecord({
        member, parsed, eventId: targetLatihanEv.id, assignmentId: asgn?.id || null,
        isAnomaly, isWalkIn: !isScheduled,
        walkInReason: isScheduled ? null : 'Hadir latihan (tidak dijadwalkan minggu ini)',
        raw, activeWindows: [`Latihan`],
        forceScanType: isScheduled ? 'latihan' : 'walkin_latihan',
        forceNoAnomaly: !isScheduled, // walk-in latihan bukan anomali
      });
      return;
    }

    // 6. Validasi window waktu untuk scan TUGAS
    const activeWindows = getActiveWindows(todayEvents, today, latihanDefaultMin);
    if (activeWindows.length === 0) {
      const nextWindow = getNextWindowLabel(todayEvents, today, latihanDefaultMin);
      const msg = nextWindow
        ? `Di luar window scan. Berikutnya: ${nextWindow}`
        : `Semua window scan hari ini sudah lewat.`;
      openOverride({ member, parsed, raw, isAnomaly, events: todayEvents, reason: msg });
      return;
    }

    // 7. Cari event yang paling relevan (tempat user dijadwalkan)
    let targetEvent   = null;
    let assignmentId  = null;
    let isSwapReplace = false; // user hadir sebagai pengganti resmi (swap Replaced)

    for (const ev of todayEvents) {
      const { data: asgn } = await supabase.from('assignments')
        .select('id').eq('user_id', member.id).eq('event_id', ev.id).maybeSingle();
      if (asgn) { targetEvent = ev; assignmentId = asgn.id; break; }
    }

    // 7b. Tidak ada di assignments — cek apakah pengganti resmi via swap Replaced
    if (!targetEvent) {
      const todayEventIds = (todayEvents as any[]).map((ev: any) => ev.id);
      if (todayEventIds.length) {
        const { data: swapMatch } = await supabase
          .from('swap_requests')
          .select('id, assignment_id, assignments(event_id)')
          .eq('pengganti_id', member.id)
          .eq('status', 'Replaced')
          .in('assignments.event_id', todayEventIds)
          .not('pengganti_id', 'is', null)
          .limit(1)
          .maybeSingle();
        if (swapMatch?.assignments?.event_id) {
          const swapEventId = swapMatch.assignments.event_id;
          targetEvent = (todayEvents as any[]).find(ev => ev.id === swapEventId) || null;
          assignmentId = swapMatch.assignment_id;
          isSwapReplace = true;
        }
      }
    }

    // 8. User tidak ada di jadwal hari ini → Walk-in / override
    if (!targetEvent) {
      openOverride({
        member, parsed, raw, isAnomaly, events: todayEvents,
        reason: `${member.nama_panggilan} tidak ada di jadwal hari ini.`,
        scanTypeHint: 'tugas',
      });
      return;
    }

    // ✅ Semua validasi lulus — simpan tugas
    // Pengganti resmi (swap): scan_type = walkin_tugas, is_walk_in = true, tapi BUKAN anomali
    await saveScanRecord({
      member, parsed, eventId: targetEvent.id, assignmentId,
      isAnomaly: isSwapReplace ? false : isAnomaly,
      isWalkIn: isSwapReplace,
      walkInReason: isSwapReplace ? 'Pengganti resmi (swap disetujui)' : null,
      raw, activeWindows,
      forceNoAnomaly: isSwapReplace,
    });
  }

  // ── Simpan scan record ─────────────────────────────────────
  async function saveScanRecord({ member, parsed, eventId, assignmentId, isAnomaly, isWalkIn, walkInReason, raw, activeWindows, isAdminOverride, forceScanType, forceNoAnomaly }: any) {
    const scanType = forceScanType ?? (
      parsed.type === 'latihan'
        ? (isWalkIn ? 'walkin_latihan' : 'latihan')
        : (isWalkIn ? 'walkin_tugas'   : 'tugas')
    );
    // forceNoAnomaly: walk-in latihan tidak dianggap anomali
    const effectiveAnomaly = forceNoAnomaly ? false : (isAnomaly || isAdminOverride);

    const { error } = await supabase.from('scan_records').insert({
      user_id:         member.id,
      event_id:        eventId || null,
      scanner_user_id: profile?.id,
      scan_type:       scanType,
      is_walk_in:      isWalkIn,
      walkin_reason:   walkInReason,
      timestamp:       new Date().toISOString(),
      qr_version:      parsed.version || 'new',
      raw_qr_value:    raw,
      is_anomaly:      effectiveAnomaly,
      anomaly_reason:  isAdminOverride
        ? `Admin override: ${walkInReason||'manual'}`
        : (isAnomaly && !forceNoAnomaly) ? 'MyID tidak cocok' : null,
    });

    if (error) { showResult({ status:'error', message:'Gagal simpan: '+error.message }); return; }

    showResult({
      status: (effectiveAnomaly && !isAdminOverride) ? 'warning' : 'success',
      message: isAdminOverride
        ? `✓ Override admin — ${member.nama_panggilan} (dicatat manual)`
        : (isAnomaly && !forceNoAnomaly)
        ? `✓ Scan disimpan (anomali MyID) — ${member.nama_panggilan}`
        : scanType === 'walkin_latihan'
        ? `✓ ${member.nama_panggilan} — Mengganti Latihan`
        : `✓ ${member.nama_panggilan} — ${scanType === 'latihan' ? 'Latihan' : 'Tugas'}`,
      member, scanType,
      isLegacy: parsed.version === 'legacy',
      activeWindows,
    });
  }

  // ── Buka override panel (ganti setPendingOverride lama) ────
  function openOverride(opts: {
    member: any; parsed: any; raw: string; isAnomaly: boolean;
    events: any[]; reason: string; scanTypeHint?: 'tugas' | 'latihan';
  }) {
    const hint = opts.scanTypeHint ?? (opts.parsed?.type === 'latihan' ? 'latihan' : 'tugas');
    // Default datetime = sekarang (WIB, format datetime-local)
    const nowWIB = new Date(Date.now() + 7 * 3600 * 1000);
    const localStr = nowWIB.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    setOverride({ ...opts, scanTypeHint: hint });
    setOvEventId(opts.events?.[0]?.id || '');
    setOvDatetime(localStr);
    setOvReason('');
    setOvCustom('');
    setOvScanType(hint);
    setOvSubmitting(false);
  }

  // ── Konfirmasi override ─────────────────────────────────────
  async function doOverride() {
    if (!override) return;
    const finalReason = ovReason === 'Lainnya...' ? ovCustom.trim() : ovReason;
    if (!finalReason) { toast.error('Pilih atau isi alasan override'); return; }
    if (!ovEventId)   { toast.error('Pilih event / acara yang sesuai'); return; }

    setOvSubmitting(true);

    // Parse datetime WIB → UTC ISO
    // ovDatetime = "YYYY-MM-DDTHH:mm" WIB, convert ke UTC
    let timestamp: string;
    try {
      const wibMs = new Date(ovDatetime).getTime() - 7 * 3600 * 1000;
      timestamp = new Date(wibMs).toISOString();
    } catch {
      timestamp = new Date().toISOString();
    }

    const { member, parsed, raw, isAnomaly } = override;
    const scanType = ovScanType === 'latihan' ? 'walkin_latihan' : 'walkin_tugas';
    const auditReason = `Override oleh ${profile?.nama_panggilan} (${profile?.role}): ${finalReason}`;

    const { error } = await supabase.from('scan_records').insert({
      user_id:         member.id,
      event_id:        ovEventId,
      scanner_user_id: profile?.id,
      scan_type:       scanType,
      is_walk_in:      true,
      walkin_reason:   finalReason,
      timestamp,
      qr_version:      parsed?.version === 'legacy' ? 'legacy' : 'new',
      raw_qr_value:    raw || member.myid || '',
      is_anomaly:      true,
      anomaly_reason:  auditReason,
    });

    setOvSubmitting(false);
    if (error) { toast.error('Gagal simpan: ' + error.message); return; }

    setOverride(null);
    showResult({
      status:  'warning',
      message: `✓ Override — ${member.nama_panggilan}\n${finalReason}`,
      member,
      scanType,
      isOverride: true,
    });
  }

  // ── Show result + auto-return ──────────────────────────────
  function showResult(data: any) {
    setResult(data);
    let sec = AUTO_RETURN_SEC;
    setCountdown(sec);
    if (returnRef.current) clearInterval(returnRef.current);
    returnRef.current = setInterval(() => {
      sec -= 1; setCountdown(sec);
      if (sec <= 0) { if (returnRef.current) clearInterval(returnRef.current); handleReset(); }
    }, 1000);
  }

  // ── Input manual (tanpa kartu) ──────────────────────────
  async function handleManualInput(e: React.FormEvent) {
    e.preventDefault();
    if (!manualNick.trim()) return;
    setManualLoading(true);
    stopCamera();

    const { data: member } = await supabase
      .from('users')
      .select('id, nickname, myid, nama_panggilan, lingkungan, role, status, is_suspended')
      .eq('nickname', manualNick.trim().toLowerCase())
      .maybeSingle();

    if (!member) {
      toast.error(`Username "${manualNick}" tidak ditemukan`);
      setManualLoading(false);
      return;
    }
    if (member.is_suspended) {
      toast.error(`${member.nama_panggilan} sedang disuspend`);
      setManualLoading(false);
      return;
    }

    const fakeParsed = { nickname: member.nickname, myid: member.myid, type: 'tugas', version: 'new' };

    setShowManual(false);
    setManualNick('');
    setManualLoading(false);

    // Ambil event kandidat terbaru
    const { data: recentEvents } = await supabase
      .from('events')
      .select('id, nama_event, perayaan, tipe_event, tanggal_tugas, tanggal_latihan')
      .not('is_draft', 'eq', true)
      .order('tanggal_tugas', { ascending: false })
      .limit(20);

    openOverride({
      member,
      parsed: fakeParsed,
      raw: `manual:${member.nickname}`,
      isAnomaly: true,
      events: recentEvents ?? [],
      reason: `Input manual oleh ${profile?.nama_panggilan} (tanpa kartu QR)`,
    });
  }

  function handleReset() {
    setResult(null); setOverride(null);
    setCountdown(0); if (returnRef.current) clearInterval(returnRef.current);
    startCamera();
  }

  if (!canScan) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-center p-6">
      <div>
        <QrCode size={48} className="mx-auto mb-4 text-gray-400"/>
        <p className="text-lg font-semibold">Hanya Pelatih/Pengurus/Admin</p>
      </div>
    </div>
  );

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-2">
          <QrCode size={20} className="text-brand-400"/>
          <span className="text-white font-semibold">Scan Absensi</span>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role && <span className="text-xs bg-brand-800/80 text-white px-2 py-0.5 rounded-lg">{profile.role}</span>}
          <button
            onClick={() => { stopCamera(); setShowManual(v => !v); setResult(null); setOverride(null); }}
            className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
            title="Input manual (tanpa kartu)">
            <Keyboard size={13}/> Manual
          </button>
          <span className="text-xs text-gray-400">{profile?.nama_panggilan}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative p-4">

        {/* Manual input form */}
        {showManual && !result && !override && (
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                <Keyboard size={22} className="text-brand-400"/>
              </div>
              <h3 className="text-white font-bold">Input Manual</h3>
              <p className="text-gray-400 text-xs mt-1">Untuk anggota yang tidak membawa kartu QR</p>
            </div>
            <form onSubmit={handleManualInput} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Username / Nickname</label>
                <input
                  type="text"
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-brand-500 focus:outline-none placeholder-gray-500"
                  placeholder="Contoh: rafa, satrio, beni..."
                  value={manualNick}
                  onChange={e => setManualNick(e.target.value.toLowerCase().trim())}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <button type="submit" disabled={manualLoading || !manualNick.trim()}
                className="w-full py-3 bg-brand-800 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {manualLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Mencari...</> : <><User size={15}/> Cari &amp; Scan Manual</>}
              </button>
              <button type="button" onClick={() => { setShowManual(false); startCamera(); }}
                className="w-full py-2 text-gray-400 text-sm hover:text-white">
                ← Kembali ke Kamera
              </button>
            </form>
          </div>
        )}

        {/* Camera */}
        {!showManual && !result && !override && (
          <div className="relative">
            <video ref={videoRef} className="max-w-full max-h-[70vh] rounded-xl" playsInline muted/>
            <canvas ref={canvasRef} className="hidden"/>
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="qr-viewfinder"/>
                <p className="absolute bottom-6 text-white/80 text-sm">Arahkan QR Code ke kamera</p>
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-6 rounded-xl">
                <Camera size={48} className="text-gray-500 mb-4"/>
                <p className="text-white text-sm text-center">{camError}</p>
                <button onClick={startCamera} className="mt-4 btn-primary">Coba Lagi</button>
              </div>
            )}
          </div>
        )}

        {/* ── OVERRIDE PANEL — muncul untuk semua Pengurus+ ── */}
        {override && (
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-md overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-900/50 rounded-xl flex items-center justify-center shrink-0">
                <Shield size={20} className="text-yellow-400"/>
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Override Absensi</h3>
                <p className="text-gray-400 text-xs">Dicatat sebagai anomali + audit log</p>
              </div>
            </div>

            {/* Member card */}
            <div className="bg-gray-800 rounded-xl p-3 mb-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-800 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                {override.member?.nama_panggilan?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{override.member?.nama_panggilan}</p>
                <p className="text-gray-400 text-xs">{override.member?.lingkungan}</p>
              </div>
            </div>

            {/* Penyebab */}
            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-3 py-2 mb-4">
              <p className="text-yellow-300 text-xs leading-relaxed">{override.reason}</p>
            </div>

            <div className="space-y-3">
              {/* Pilih Event */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Acara / Event <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-brand-500 focus:outline-none appearance-none pr-8"
                    value={ovEventId}
                    onChange={e => setOvEventId(e.target.value)}
                  >
                    <option value="">— Pilih event —</option>
                    {override.events.map((ev: any) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.tanggal_tugas || ev.tanggal_latihan} · {ev.perayaan || ev.nama_event}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                </div>
              </div>

              {/* Waktu scan (bisa diubah ke waktu asli) */}
              <div>
                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                  <CalendarClock size={12}/> Waktu Hadir (WIB) <span className="text-red-400">*</span>
                  <span className="text-gray-500 ml-1">— ubah jika lupa scan</span>
                </label>
                <input
                  type="datetime-local"
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-brand-500 focus:outline-none"
                  value={ovDatetime}
                  onChange={e => setOvDatetime(e.target.value)}
                />
              </div>

              {/* Tipe scan */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Tipe Kehadiran</label>
                <div className="flex gap-2">
                  {(['tugas', 'latihan'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOvScanType(t)}
                      className={[
                        'flex-1 py-2 rounded-xl text-xs font-medium border transition-colors capitalize',
                        ovScanType === t
                          ? 'bg-brand-800 border-brand-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600',
                      ].join(' ')}
                    >
                      {t === 'tugas' ? '⛪ Tugas Misa' : '🏃 Latihan'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alasan */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Alasan <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {OVERRIDE_PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setOvReason(p)}
                      className={[
                        'text-left px-3 py-2 rounded-lg text-xs border transition-colors leading-tight',
                        ovReason === p
                          ? 'bg-brand-900 border-brand-600 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600',
                        p === 'Lainnya...' ? 'col-span-2' : '',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {ovReason === 'Lainnya...' && (
                  <input
                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-brand-500 focus:outline-none placeholder-gray-500"
                    placeholder="Tulis alasan..."
                    value={ovCustom}
                    onChange={e => setOvCustom(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 space-y-2">
              <button
                onClick={doOverride}
                disabled={ovSubmitting || !ovEventId || !ovReason || (ovReason === 'Lainnya...' && !ovCustom.trim())}
                className="w-full py-3 bg-brand-800 hover:bg-brand-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {ovSubmitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Menyimpan...</>
                  : <><Shield size={15}/> Konfirmasi Override</>
                }
              </button>
              <button onClick={handleReset} className="w-full py-2 text-gray-400 text-sm hover:text-white transition-colors">
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {result && (
          <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center">
            {result.status === 'success'  && <CheckCircle size={64}  className="text-green-400 mx-auto mb-4"/>}
            {result.status === 'warning'  && <AlertTriangle size={64} className="text-yellow-400 mx-auto mb-4"/>}
            {result.status === 'error'    && <XCircle size={64}      className="text-red-400 mx-auto mb-4"/>}
            {result.status === 'invalid'  && (
              <div className="mx-auto mb-4 w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
                <Clock size={40} className="text-red-400"/>
              </div>
            )}

            <h3 className={`font-bold text-xl mb-2 ${
              result.status === 'success' ? 'text-green-300' :
              result.status === 'warning' ? 'text-yellow-300' :
              result.status === 'invalid' ? 'text-red-300' : 'text-red-300'
            }`}>
              {result.status === 'success' ? 'Berhasil' :
               result.status === 'warning' ? 'Anomali' :
               result.status === 'invalid' ? 'Scan Tidak Valid' : 'Gagal'}
            </h3>

            <p className="text-gray-200 text-sm mb-2 whitespace-pre-line">{result.message}</p>

            {result.status === 'invalid' && result.nextWindow && (
              <div className="mt-2 py-1.5 px-3 bg-blue-900/30 rounded-lg">
                <p className="text-blue-400 text-xs flex items-center gap-1 justify-center">
                  <Clock size={11}/> {result.nextWindow}
                </p>
              </div>
            )}

            {result.member && (
              <div className="bg-gray-800 rounded-xl p-3 mt-3 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-800 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {result.member.nama_panggilan?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{result.member.nama_panggilan}</p>
                    <p className="text-gray-400 text-xs">{result.member.lingkungan}</p>
                  </div>
                </div>
                {result.activeWindows?.length > 0 && (
                  <p className="text-green-400 text-xs mt-2">Window aktif: {result.activeWindows.join(', ')}</p>
                )}
              </div>
            )}

            {result.isLegacy && (
              <div className="mt-2 py-1.5 px-3 bg-yellow-900/30 rounded-lg">
                <p className="text-yellow-400 text-xs">⚠️ QR lama — disarankan update kartu</p>
              </div>
            )}

            <div className="mt-6">
              <p className="text-gray-400 text-sm mb-2">
                Kembali dalam <span className="font-bold text-white">{countdown}</span>s
              </p>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4">
                <div className="bg-brand-600 h-1.5 rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown/AUTO_RETURN_SEC)*100}%` }}/>
              </div>
              <button onClick={handleReset} className="btn-primary w-full">Scan Berikutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
