import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { parseQRValue } from '../lib/utils';
import {
  CheckCircle, XCircle, AlertTriangle, Camera, QrCode,
  ClipboardCheck, ChevronDown, Keyboard, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const AUTO_RETURN_SEC  = 4;
const SCAN_COOLDOWN_MS = 60 * 60 * 1000;

export default function AttendancePage() {
  const { profile, canScan, isAdmin } = useAuth();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number | null>(null);
  const returnRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [events,      setEvents]      = useState<any[]>([]);
  const [selectedEv,  setSelectedEv]  = useState<any>(null);

  const selectedEvRef = useRef<any>(null);
  const profileRef = useRef<any>(profile);
  const canScanRef = useRef<boolean>(canScan);

  useEffect(() => { selectedEvRef.current = selectedEv; }, [selectedEv]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { canScanRef.current = canScan; }, [canScan]);
  const [loadingEvs,  setLoadingEvs]  = useState(true);
  const [scanning,    setScanning]    = useState(false);
  const [result,      setResult]      = useState<any>(null);
  const [countdown,   setCountdown]   = useState(0);
  const [camError,    setCamError]    = useState('');
  const [showManual,  setShowManual]  = useState(false);
  const [manualNick,  setManualNick]  = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // ── Load acara ───────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoadingEvs(true);
    const { data, error } = await supabase
      .from('acara')
      .select('id, nama, tipe, tanggal, jam_mulai, jam_selesai, lokasi, is_active')
      .eq('is_active', true)
      .order('tanggal', { ascending: false })
      .limit(60);
    if (error) toast.error('Gagal memuat acara: ' + error.message);
    setEvents(data ?? []);
    setLoadingEvs(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Camera ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (returnRef.current) clearInterval(returnRef.current);
    };
  }, [stopCamera]);

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
        { inversionAttempts: 'dontInvert' },
      );
      if (code?.data) { stopCamera(); processQR(code.data); }
      else scanLoop();
    });
  }

  // ── QR Processing ────────────────────────────────────────────────
  async function processQR(raw: string) {
    if (!selectedEvRef.current) {
      showResult({ status: 'error', message: 'Pilih acara dulu sebelum scan.' });
      return;
    }

    const parsed = parseQRValue(raw);
    let nickname = '';
    let myid     = '';

    if (parsed) {
      nickname = parsed.nickname.toLowerCase();
      myid     = parsed.myid?.toUpperCase() || '';
    } else {
      // fallback: raw mungkin hanya nickname
      nickname = raw.trim().toLowerCase();
    }

    if (!nickname) {
      showResult({ status: 'error', message: 'QR tidak dikenali.' });
      return;
    }

    await doScan(nickname, myid, raw);
  }

  async function doScan(nickname: string, myid: string, raw: string) {
    const currentEv = selectedEvRef.current;
    if (!currentEv) return;

    const { data: member } = await supabase
      .from('users')
      .select('id, nickname, myid, nama_panggilan, lingkungan, status, is_suspended')
      .eq('nickname', nickname)
      .maybeSingle();

    if (!member) {
      showResult({ status: 'error', message: `"${nickname}" tidak ditemukan.` });
      return;
    }
    if (member.status === 'Inactive' || member.is_suspended) {
      showResult({ status: 'error', message: `${member.nama_panggilan} tidak aktif / disuspend.`, member });
      return;
    }

    const isAnomaly = myid ? member.myid !== myid : false;

    // Anti-duplikat dalam 1 jam
    const since = new Date(Date.now() - SCAN_COOLDOWN_MS).toISOString();
    const { data: dupe } = await supabase
      .from('scan_records')
      .select('id, timestamp')
      .eq('user_id', member.id)
      .eq('acara_id', currentEv.id)
      .gte('timestamp', since)
      .limit(1)
      .maybeSingle();

    if (dupe) {
      const minsAgo = Math.floor((Date.now() - new Date(dupe.timestamp).getTime()) / 60000);
      showResult({
        status: 'warning',
        message: `${member.nama_panggilan} sudah hadir di acara ini ${minsAgo} menit lalu.`,
        member,
      });
      return;
    }

    // Tentukan scan_type dari tipe acara
    const scanType = currentEv.tipe === 'Latihan' ? 'latihan' : 'tugas';

    const { error } = await supabase.from('scan_records').insert({
      user_id:         member.id,
      event_id:        null,
      acara_id:        currentEv.id,
      scanner_user_id: profileRef.current?.id,
      scan_type:       scanType,
      is_walk_in:      false,
      walkin_reason:   null,
      timestamp:       new Date().toISOString(),
      qr_version:      raw.startsWith('http') ? (raw.includes('google.com') ? 'legacy' : 'new') : 'legacy',
      raw_qr_value:    member.myid || raw,
      is_anomaly:      isAnomaly,
      anomaly_reason:  isAnomaly ? 'MyID tidak cocok' : null,
    });

    if (error) {
      showResult({ status: 'error', message: 'Gagal simpan: ' + error.message });
      return;
    }

    showResult({
      status:  isAnomaly ? 'warning' : 'success',
      message: isAnomaly
        ? `✓ Disimpan (anomali MyID) — ${member.nama_panggilan}`
        : `✓ ${member.nama_panggilan} hadir`,
      member,
    });
  }

  function showResult(res: any) {
    setResult(res);
    if (returnRef.current) clearInterval(returnRef.current);
    let c = AUTO_RETURN_SEC;
    setCountdown(c);
    returnRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(returnRef.current!);
        setResult(null);
        setCountdown(0);
        if (canScanRef.current) startCamera();
      }
    }, 1000);
  }

  function handleReset() {
    if (returnRef.current) clearInterval(returnRef.current);
    setResult(null);
    setCountdown(0);
    if (canScan) startCamera();
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualNick.trim()) return;
    if (!selectedEv) { toast.error('Pilih acara dulu'); return; }
    setManualLoading(true);
    stopCamera();
    await doScan(manualNick.trim().toLowerCase(), '', manualNick.trim());
    setManualNick('');
    setShowManual(false);
    setManualLoading(false);
  }

  if (!canScan) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Presensi Acara</h1>
        <div className="card text-center py-14">
          <QrCode size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Halaman ini hanya untuk Pelatih, Pengurus, dan Administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={24} className="text-brand-800" />
        <h1 className="page-title mb-0">Presensi Acara</h1>
      </div>

      {/* Event selector */}
      <div className="card">
        <label className="label mb-1">Pilih Acara</label>
        {loadingEvs ? (
          <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
        ) : (
          <div className="relative">
            <select
              className="input pr-10 appearance-none"
              value={selectedEv?.id || ''}
              onChange={e => {
                const ev = events.find(x => x.id === e.target.value) || null;
                setSelectedEv(ev);
                setResult(null);
                stopCamera();
              }}
            >
              <option value="">— Pilih acara —</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.tanggal} · {ev.nama} ({ev.tipe})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}
        {selectedEv && (
          <p className="text-xs text-gray-400 mt-1">
            {selectedEv.tipe}
            {selectedEv.jam_mulai ? ` · ${selectedEv.jam_mulai}` : ''}
            {selectedEv.lokasi ? ` · ${selectedEv.lokasi}` : ''}
          </p>
        )}
      </div>

      {/* Scan area */}
      {selectedEv && (
        <div className="card p-0 overflow-hidden">
          {/* Result overlay */}
          {result ? (
            <div className={[
              'flex flex-col items-center justify-center py-12 px-6 text-center gap-3',
              result.status === 'success' ? 'bg-green-50'
                : result.status === 'warning' ? 'bg-yellow-50'
                : 'bg-red-50',
            ].join(' ')}>
              {result.status === 'success' && <CheckCircle size={56} className="text-green-500" />}
              {result.status === 'warning'  && <AlertTriangle size={56} className="text-yellow-500" />}
              {result.status === 'error'    && <XCircle size={56} className="text-red-500" />}
              <p className={[
                'font-bold text-lg',
                result.status === 'success' ? 'text-green-800'
                  : result.status === 'warning' ? 'text-yellow-800'
                  : 'text-red-800',
              ].join(' ')}>{result.message}</p>
              {result.member && (
                <p className="text-sm text-gray-500">{result.member.lingkungan}</p>
              )}
              <p className="text-xs text-gray-400">Lanjut otomatis dalam {countdown}s</p>
              <button onClick={handleReset} className="btn-secondary text-sm mt-1 gap-1">
                <RefreshCw size={14} /> Scan Lagi
              </button>
            </div>
          ) : (
            <>
              {/* Camera */}
              <div className="relative bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {!scanning && !camError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button onClick={startCamera} className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl font-medium text-gray-800 shadow-lg hover:bg-gray-50">
                      <Camera size={20} /> Mulai Kamera
                    </button>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white/60 rounded-2xl" />
                  </div>
                )}
                {camError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <p className="text-white text-center text-sm px-6">{camError}</p>
                  </div>
                )}
              </div>

              {/* Manual input toggle */}
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={() => setShowManual(s => !s)}
                  className="text-xs text-brand-800 font-medium flex items-center gap-1 hover:underline"
                >
                  <Keyboard size={14} /> Input manual nama panggilan
                </button>
                {showManual && (
                  <form onSubmit={handleManual} className="mt-2 flex gap-2">
                    <input
                      className="input flex-1 text-sm"
                      placeholder="nama panggilan..."
                      value={manualNick}
                      onChange={e => setManualNick(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={manualLoading}
                      className="btn-primary text-sm px-4"
                    >
                      {manualLoading ? '...' : 'Catat'}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!selectedEv && (
        <div className="card text-center py-10 text-gray-400 text-sm">
          Pilih acara di atas untuk mulai scan presensi.
        </div>
      )}
    </div>
  );
}
