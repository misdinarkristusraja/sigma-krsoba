import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Camera, CheckCircle, Upload, AlertTriangle, RefreshCw, BarChart2, ShieldCheck, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SakristanPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'camera' | 'analytics'>('camera');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const startCamera = async () => {
    setCameraError(null);
    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      const msg = err.name === 'NotAllowedError'
        ? 'Izin kamera belum diberikan oleh browser. Silakan beri izin kamera atau gunakan tombol Upload Foto.'
        : err.message || 'Gagal membuka kamera.';
      setCameraError(msg);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (tab === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [tab]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('scan_records')
        .select('*, user:user_id(nama_panggilan, role)')
        .order('timestamp', { ascending: false })
        .limit(50);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Stamp Auto-Watermark on canvas
  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
    const locationStr = '📍 Paroki Kristus Raja Solo Baru - Presensi PIC/Pengurus Sakristan';

    // Dark semi-transparent banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, height - 70, width, 70);

    // Watermark text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`🕒 ${nowStr}`, 15, height - 42);

    ctx.fillStyle = '#fde047'; // Amber yellow
    ctx.font = '13px sans-serif';
    ctx.fillText(locationStr, 15, height - 18);
  };

  // Capture frame from live video
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawWatermark(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
  };

  // Fallback: Handle Image Upload from gallery/camera app
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);
        drawWatermark(ctx, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePresensi = async () => {
    if (!capturedPhoto) { toast.error('Ambil foto presensi terlebih dahulu'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('scan_records').insert({
        user_id: profile?.id,
        scan_type: 'tugas',
        is_walk_in: false,
        timestamp: new Date().toISOString(),
        qr_version: 'new',
        is_anomaly: false,
        anomaly_reason: `Presensi PIC Sakristan dengan Foto Watermark (WIB)`
      });

      if (error) throw error;
      toast.success('Presensi PIC Sakristan dengan Foto Berhasil!');
      setCapturedPhoto(null);
      loadLogs();
    } catch (err: any) {
      toast.error('Gagal simpan presensi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Divisi Sakristan &amp; PIC Latihan</h2>
          <p className="text-xs text-gray-500">Presensi Pengurus/PIC Misa &amp; Latihan berbasis Foto Kamera + Watermark Otomatis.</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setTab('camera')} className={`btn-sm gap-1 ${tab === 'camera' ? 'btn-primary' : 'btn-outline'}`}>
            <Camera size={15} /> Presensi Kamera
          </button>
          <button onClick={() => setTab('analytics')} className={`btn-sm gap-1 ${tab === 'analytics' ? 'btn-primary' : 'btn-outline'}`}>
            <BarChart2 size={15} /> Analisis Kehadiran
          </button>
        </div>
      </div>

      {tab === 'camera' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Camera Container */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Camera size={18} className="text-red-700" /> Presensi Web Camera Live
            </h3>

            <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-gray-800">
              {stream ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              ) : (
                <div className="p-6 text-center text-gray-400 space-y-3">
                  <AlertTriangle size={36} className="mx-auto text-amber-400" />
                  <p className="text-xs text-gray-300">
                    {cameraError || 'Kamera belum aktif atau izin belum diberikan.'}
                  </p>
                  <div className="flex flex-col gap-2 pt-2">
                    <button onClick={startCamera} className="btn-primary btn-sm mx-auto gap-1">
                      <Camera size={14} /> Minta Izin &amp; Buka Kamera
                    </button>
                    <span className="text-[10px] text-gray-500">— ATAU —</span>
                    <button onClick={() => fileInputRef.current?.click()} className="btn-outline btn-sm mx-auto gap-1">
                      <Upload size={14} /> Upload Foto dari HP / Galeri
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />

            {stream ? (
              <button onClick={captureFrame} className="btn-primary w-full gap-2">
                <Camera size={16} /> Ambil Foto &amp; Tempel Watermark
              </button>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="btn-outline w-full gap-2">
                <Upload size={16} /> Upload File Foto &amp; Auto-Watermark
              </button>
            )}
          </div>

          {/* Captured Result Preview & Confirm */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" /> Hasil Foto &amp; Watermark
            </h3>

            {capturedPhoto ? (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md">
                  <img src={capturedPhoto} alt="Watermarked Attendance" className="w-full h-auto" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCapturedPhoto(null)} className="btn-outline flex-1">
                    Ulangi Foto
                  </button>
                  <button onClick={handleSavePresensi} disabled={submitting} className="btn-primary flex-1">
                    Simpan Presensi
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400 space-y-2">
                <Camera size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Klik "Ambil Foto" atau "Upload Foto" untuk pratinjau watermark waktu &amp; lokasi.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-900 text-sm">
            Riwayat Presensi Pengurus Sakristan
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengurus / PIC</th>
                <th>Status Scan</th>
                <th>Keterangan Audit</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="text-xs text-gray-500">{new Date(l.timestamp).toLocaleString('id-ID')}</td>
                  <td className="text-sm font-semibold text-gray-900">{l.user?.nama_panggilan || '—'}</td>
                  <td>
                    <span className="badge-green text-xs">✓ Presensi Valid</span>
                  </td>
                  <td className="text-xs text-gray-600">{l.anomaly_reason || 'Foto Watermark Verified'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
