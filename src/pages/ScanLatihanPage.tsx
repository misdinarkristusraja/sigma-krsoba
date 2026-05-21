import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { parseQRValue } from '../lib/utils';
import {
  CheckCircle, XCircle, Camera, QrCode, Keyboard,
  User, ChevronDown, Loader2, CalendarDays, Star,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AUTO_RETURN_SEC = 3;

function toLocalISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export default function ScanLatihanPage() {
  const { profile, canScan } = useAuth();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream|null>(null);
  const animRef     = useRef<number|null>(null);
  const returnRef   = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Setup state ─────────────────────────────────────────────
  const [events,       setEvents]       = useState<any[]>([]);
  const [selectedEvent,setSelectedEvent]= useState<any>(null);
  const [latihans,     setLatihans]     = useState<any[]>([]);
  const [selectedSesi, setSelectedSesi] = useState<any>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);

  // ── Scan state ───────────────────────────────────────────────
  const [scanning,  setScanning]  = useState(false);
  const [result,    setResult]    = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [camError,  setCamError]  = useState('');
  const [showManual,    setShowManual]    = useState(false);
  const [manualNick,    setManualNick]    = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // ── Load events misa besar ───────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingSetup(true);
      const { data } = await supabase.from('events')
        .select('id, nama_event, perayaan, tanggal_tugas, tipe_event, is_draft')
        .eq('is_misa_besar', true)
        .order('tanggal_tugas', { ascending: false })
        .limit(20);
      setEvents(data || []);
      setLoadingSetup(false);
    })();
  }, []);

  // ── Load sesi latihan saat event dipilih ─────────────────────
  useEffect(() => {
    setLatihans([]);
    setSelectedSesi(null);
    if (!selectedEvent) return;
    (async () => {
      const { data } = await supabase.from('event_latihan')
        .select('id, tanggal, jam, lokasi, catatan')
        .eq('event_id', selectedEvent.id)
        .order('tanggal', { ascending: true });
      setLatihans(data || []);
      // Auto-pilih sesi hari ini kalau ada
      const today = toLocalISO(new Date());
      const today_sesi = (data || []).find((l: any) => l.tanggal === today);
      if (today_sesi) setSelectedSesi(today_sesi);
    })();
  }, [selectedEvent?.id]);

  // ── Kamera ───────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch {
      setCamError('Tidak dapat mengakses kamera. Izinkan akses di browser.');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (returnRef.current) clearInterval(returnRef.current);
    };
  }, []);

  function scanLoop() {
    animRef.current = requestAnimationFrame(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) { scanLoop(); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const code = jsQR(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width, canvas.height,
        { inversionAttempts: 'dontInvert' }
      );
      if (code?.data) { stopCamera(); processQR(code.data); }
      else scanLoop();
    });
  }

  function handleReset() {
    if (returnRef.current) clearInterval(returnRef.current);
    setResult(null);
    setCountdown(0);
    startCamera();
  }

  function showResult(res: any) {
    setResult(res);
    setCountdown(AUTO_RETURN_SEC);
    if (returnRef.current) clearInterval(returnRef.current);
    returnRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(returnRef.current!);
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Proses QR ────────────────────────────────────────────────
  async function processQR(raw: string) {
    const parsed = parseQRValue(raw);
    if (!parsed) {
      showResult({ status: 'error', message: 'QR tidak dikenali. Format tidak valid.' });
      return;
    }
    await processNickname(parsed.nickname, raw, false);
  }

  async function processNickname(nick: string, raw: string, isManual: boolean) {
    if (!selectedEvent || !selectedSesi) {
      toast.error('Pilih event dan sesi latihan dulu');
      return;
    }

    const { data: member } = await supabase
      .from('users')
      .select('id, nickname, myid, nama_panggilan, lingkungan, role, status, is_suspended')
      .eq('nickname', nick.toLowerCase())
      .maybeSingle();

    if (!member) {
      showResult({ status: 'error', message: `Misdinar "${nick}" tidak ditemukan.` });
      return;
    }
    if (member.is_suspended) {
      showResult({ status: 'error', message: `${member.nama_panggilan} sedang disuspend.` });
      return;
    }

    // Cek apakah sudah hadir di sesi ini
    const { data: existing } = await supabase
      .from('event_latihan_attendance')
      .select('id, marked_at')
      .eq('latihan_id', selectedSesi.id)
      .eq('user_id', member.id)
      .maybeSingle();

    if (existing) {
      showResult({
        status: 'warning',
        message: `${member.nama_panggilan} sudah dicatat hadir di sesi ini.`,
        member,
      });
      return;
    }

    // Catat attendance
    const { error: attErr } = await supabase.from('event_latihan_attendance').upsert({
      latihan_id:    selectedSesi.id,
      user_id:       member.id,
      hadir:         true,
      marked_by:     profile?.id,
      marked_at:     new Date().toISOString(),
    }, { onConflict: 'latihan_id,user_id' });

    if (attErr) {
      showResult({ status: 'error', message: 'Gagal simpan attendance: ' + attErr.message });
      return;
    }

    // Catat scan_record
    const { data: scanRec } = await supabase.from('scan_records').insert({
      user_id:         member.id,
      event_id:        selectedEvent.id,
      scanner_user_id: profile?.id,
      scan_type:       'latihan',
      is_walk_in:      false,
      timestamp:       new Date().toISOString(),
      qr_version:      'new',
      raw_qr_value:    raw || null,
      is_anomaly:      false,
      latihan_id:      selectedSesi.id,
    }).select('id').single();

    // Update scan_record_id di attendance
    if (scanRec?.id) {
      await supabase.from('event_latihan_attendance')
        .update({ scan_record_id: scanRec.id })
        .eq('latihan_id', selectedSesi.id)
        .eq('user_id', member.id);
    }

    showResult({
      status: 'success',
      message: `✓ ${member.nama_panggilan} — Hadir latihan`,
      member,
    });
  }

  async function handleManualSubmit() {
    const nick = manualNick.trim().toLowerCase();
    if (!nick) return;
    setManualLoading(true);
    setShowManual(false);
    await processNickname(nick, '', true);
    setManualNick('');
    setManualLoading(false);
  }

  if (!canScan) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Scan Latihan Misa Besar</h1>
        <div className="card text-center py-14">
          <XCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-gray-600">Hanya Pelatih / Pengurus / Administrator yang bisa scan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Star size={22} className="text-yellow-500" /> Scan Latihan Misa Besar
        </h1>
        <p className="page-subtitle">Absensi latihan untuk HR Natal & Pekan Suci</p>
      </div>

      {/* ── Setup: pilih event + sesi ── */}
      {!result && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <CalendarDays size={16} className="text-brand-800" /> Pilih Event & Sesi
          </h3>

          {loadingSetup ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" /> Memuat event...
            </div>
          ) : events.length === 0 ? (
            <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
              Belum ada event Misa Besar yang dipublish.
              <br />
              <span className="text-xs">Buat event dengan flag "Misa Besar" di Jadwal Mingguan.</span>
            </div>
          ) : (
            <>
              {/* Pilih Event */}
              <div>
                <label className="label">Event Misa Besar</label>
                <div className="relative">
                  <select
                    className="input w-full pr-8"
                    value={selectedEvent?.id || ''}
                    onChange={e => {
                      const ev = events.find(x => x.id === e.target.value) || null;
                      setSelectedEvent(ev);
                    }}
                  >
                    <option value="">— Pilih Event —</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.is_draft ? '[Draft] ' : ''}{ev.perayaan || ev.nama_event} ({ev.tanggal_tugas})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Pilih Sesi Latihan */}
              {selectedEvent && (
                <div>
                  <label className="label">Sesi Latihan</label>
                  {latihans.length === 0 ? (
                    <div className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
                      Event ini belum punya sesi latihan. Tambahkan di halaman Jadwal Mingguan.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {latihans.map(l => (
                        <label
                          key={l.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedSesi?.id === l.id
                              ? 'border-brand-800 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="sesi"
                            className="mt-1"
                            checked={selectedSesi?.id === l.id}
                            onChange={() => setSelectedSesi(l)}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-gray-800 block">
                              {new Date(l.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                              })}
                              {' · '}{l.jam} WIB
                            </span>
                            {l.lokasi && <span className="text-xs text-gray-500">{l.lokasi}</span>}
                            {l.catatan && <span className="text-xs text-gray-400 block">{l.catatan}</span>}
                            {l.tanggal === toLocalISO(new Date()) && (
                              <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block">HARI INI</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Scan area ── */}
      {selectedEvent && selectedSesi && !result && (
        <div className="card space-y-3">
          {/* Status info */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-brand-800">{selectedEvent.perayaan || selectedEvent.nama_event}</p>
            <p className="text-brand-700 text-xs mt-0.5">
              Sesi: {new Date(selectedSesi.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} · {selectedSesi.jam} WIB
            </p>
          </div>

          {camError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {camError}
            </div>
          )}

          {/* Video area */}
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square max-w-sm mx-auto">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 border-4 border-white/70 rounded-3xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-2xl" />
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-brand-400/70 animate-pulse" />
                </div>
              </div>
            )}

            {!scanning && !camError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <button
                  onClick={startCamera}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-2xl px-6 py-3 flex items-center gap-2 backdrop-blur-sm transition-all"
                >
                  <Camera size={20} /> Mulai Kamera
                </button>
              </div>
            )}
          </div>

          {/* Tombol manual */}
          <div className="flex gap-2">
            {scanning && (
              <button onClick={stopCamera} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                <Camera size={16} /> Stop Kamera
              </button>
            )}
            <button
              onClick={() => setShowManual(s => !s)}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              <Keyboard size={16} /> Input Manual
            </button>
          </div>

          {/* Manual input */}
          {showManual && (
            <form
              onSubmit={e => { e.preventDefault(); handleManualSubmit(); }}
              className="flex gap-2"
            >
              <input
                className="input flex-1 text-sm"
                placeholder="Nickname misdinar..."
                value={manualNick}
                onChange={e => setManualNick(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={manualLoading || !manualNick.trim()} className="btn-primary px-4 text-sm">
                {manualLoading ? <Loader2 size={16} className="animate-spin" /> : 'Scan'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Hasil scan ── */}
      {result && (
        <div className={`card text-center py-10 space-y-4 ${
          result.status === 'success' ? 'border-green-200 bg-green-50/30' :
          result.status === 'warning' ? 'border-yellow-200 bg-yellow-50/30' :
                                        'border-red-200 bg-red-50/30'
        } border-2`}>
          {result.status === 'success' ? (
            <CheckCircle size={52} className="mx-auto text-green-500" />
          ) : result.status === 'warning' ? (
            <CheckCircle size={52} className="mx-auto text-yellow-500" />
          ) : (
            <XCircle size={52} className="mx-auto text-red-400" />
          )}

          <div>
            <p className={`font-bold text-xl ${
              result.status === 'success' ? 'text-green-800' :
              result.status === 'warning' ? 'text-yellow-800' :
                                            'text-red-700'
            }`}>{result.message}</p>

            {result.member && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-sm">
                <User size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{result.member.nama_panggilan}</span>
                <span className="text-xs text-gray-400">{result.member.lingkungan}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={handleReset} className="btn-primary px-6">
              <QrCode size={16} /> Scan Lagi
            </button>
            <span className="text-xs text-gray-400">Auto {countdown}s</span>
          </div>
        </div>
      )}

      {/* ── Belum pilih sesi ── */}
      {!selectedEvent && !loadingSetup && events.length > 0 && !result && (
        <div className="card text-center py-10">
          <CalendarDays size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Pilih event dan sesi latihan di atas untuk mulai scan.</p>
        </div>
      )}
    </div>
  );
}
