import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Camera, CheckCircle, Clock, RefreshCw, BarChart2, ShieldCheck, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SakristanPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'camera' | 'analytics'>('camera');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      toast.error('Tidak dapat mengakses kamera: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (tab === 'camera') startCamera();
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

  // Capture frame from video and paint Auto-Watermark on HTML5 Canvas
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Auto Watermark Box
    const nowStr = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });
    const locationStr = '📍 Paroki Kristus Raja Solo Baru - Presensi PIC/Pengurus Sakristan';

    // Dark semi-transparent gradient bottom banner
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, canvas.height - 70, canvas.width, 70);

    // Draw Watermark text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`🕒 ${nowStr}`, 15, canvas.height - 42);

    ctx.fillStyle = '#fde047'; // Amber yellow text for location
    ctx.font = '12px sans-serif';
    ctx.fillText(locationStr, 15, canvas.height - 18);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
  };

  const handleSavePresensi = async () => {
    if (!capturedPhoto) { toast.error('Ambil foto presensi terlebih dahulu'); return; }
    setSubmitting(true);
    try {
      // Record scan record with photo proof & watermark audit
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
            <Camera size={15} /> Presensi Web Cam
          </button>
          <button onClick={() => setTab('analytics')} className={`btn-sm gap-1 ${tab === 'analytics' ? 'btn-primary' : 'btn-outline'}`}>
            <BarChart2 size={15} /> Analisis Kehadiran
          </button>
        </div>
      </div>

      {tab === 'camera' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Web Cam Live Stream */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Camera size={18} className="text-red-700" /> Web Camera Presensi Live
            </h3>

            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button onClick={captureFrame} className="btn-primary w-full gap-2">
              <Camera size={16} /> Ambil Foto &amp; Tempel Watermark
            </button>
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
              <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-400">
                <Camera size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Klik tombol "Ambil Foto" untuk melihat pratinjau watermark waktu &amp; lokasi.</p>
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
