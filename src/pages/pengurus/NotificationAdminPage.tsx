import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { Send, Bell, Sparkles, CheckCircle2, Clock, Trash2, Megaphone, CalendarCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationAdminPage() {
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState<any[]>([]);

  // Form Broadcast
  const [judul, setJudul]           = useState('');
  const [pesan, setPesan]           = useState('');
  const [linkUrl, setLinkUrl]       = useState('');
  const [targetRole, setTargetRole] = useState('ALL'); // ALL, Misdinar_Aktif, Pengurus

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, users(nama_panggilan, nickname)')
        .order('created_at', { ascending: false })
        .limit(30);
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Adaptive multi-schema insert helper (handles link_url / judul / title / body variations)
  const insertNotifications = async (rows: any[]) => {
    // Attempt 1: Standard schema (judul, pesan, link_url)
    let { error } = await supabase.from('notifications').insert(rows);
    if (!error) return;

    // Attempt 2: Standard schema without link_url (if link_url column does not exist)
    const noLinkRows = rows.map((r: any) => ({
      user_id: r.user_id,
      tipe: r.tipe || 'ANNOUNCEMENT',
      judul: r.judul || 'Pengumuman',
      pesan: r.pesan || '',
      is_read: false,
    }));
    let { error: err2 } = await supabase.from('notifications').insert(noLinkRows);
    if (!err2) return;

    // Attempt 3: English schema (title, body, type, link_url)
    const engRows = rows.map((r: any) => ({
      user_id: r.user_id,
      type: r.tipe || 'ANNOUNCEMENT',
      title: r.judul || 'Pengumuman',
      body: r.pesan || '',
      link_url: r.link_url,
      is_read: false,
    }));
    let { error: err3 } = await supabase.from('notifications').insert(engRows);
    if (!err3) return;

    // Attempt 4: English schema without link_url
    const engNoLinkRows = rows.map((r: any) => ({
      user_id: r.user_id,
      type: r.tipe || 'ANNOUNCEMENT',
      title: r.judul || 'Pengumuman',
      body: r.pesan || '',
      is_read: false,
    }));
    let { error: err4 } = await supabase.from('notifications').insert(engNoLinkRows);
    if (!err4) return;

    throw error || err2 || err3 || err4;
  };

  // 1. Send Manual Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !pesan.trim()) {
      toast.error('Judul dan Pesan wajib diisi!');
      return;
    }
    setLoading(true);
    try {
      // Fetch target users
      let query = supabase.from('users').select('id').eq('status', 'Active');
      if (targetRole !== 'ALL') {
        query = query.eq('role', targetRole);
      }
      const { data: users, error: userErr } = await query;
      if (userErr) throw userErr;

      if (!users || users.length === 0) {
        toast.error('Tidak ada pengguna aktif pada target ini.');
        setLoading(false);
        return;
      }

      const rows = users.map((u: any) => ({
        user_id: u.id,
        tipe: 'ANNOUNCEMENT',
        judul: judul.trim(),
        pesan: pesan.trim(),
        link_url: linkUrl.trim() || null,
        is_read: false,
      }));

      await insertNotifications(rows);

      toast.success(`✅ Pengumuman berhasil terkirim ke ${users.length} anggota!`);
      setJudul('');
      setPesan('');
      setLinkUrl('');
      loadHistory();
    } catch (err: any) {
      toast.error('Gagal mengirim broadcast: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Trigger Automated H-1 Reminders for Tomorrow's Mass & Practice
  const handleTriggerAutomatedReminders = async () => {
    setLoading(true);
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch tomorrow's active events (valid columns: id, nama_event, perayaan, tanggal_tugas, tanggal_latihan)
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, nama_event, perayaan, tanggal_tugas, tanggal_latihan')
        .or(`tanggal_tugas.eq.${tomorrow},tanggal_latihan.eq.${tomorrow}`);

      if (evErr) throw evErr;

      if (!events || events.length === 0) {
        toast('Tidak ada Jadwal Misa / Latihan untuk besok (' + tomorrow + ')', { icon: 'ℹ️' });
        setLoading(false);
        return;
      }

      let totalSent = 0;

      for (const ev of events) {
        // Fetch assigned members for this event
        const { data: assigns } = await supabase
          .from('assignments')
          .select('user_id')
          .eq('event_id', ev.id);

        if (!assigns || assigns.length === 0) continue;

        const isTugas   = ev.tanggal_tugas === tomorrow;
        const eventName = ev.perayaan || ev.nama_event;

        const notifType = isTugas ? 'REMINDER_TUGAS' : 'REMINDER_LATIHAN';
        const notifTitle = isTugas ? `⏰ Pengingat H-1 Tugas Misa (${eventName})` : `🏋️ Pengingat H-1 Latihan (${eventName})`;
        const notifBody = isTugas
          ? `Besok (${tomorrow}) Anda bertugas di ${eventName}. Mohon persiapkan diri!`
          : `Besok (${tomorrow}) ada Latihan untuk ${eventName}. Harap hadir tepat waktu!`;

        const rows = assigns.map((a: any) => ({
          user_id: a.user_id,
          tipe: notifType,
          judul: notifTitle,
          pesan: notifBody,
          link_url: '/jadwal',
          is_read: false,
        }));

        await insertNotifications(rows);
        totalSent += rows.length;
      }

      toast.success(`⚡ Pengingat H-1 berhasil terkirim ke ${totalSent} petugas Misa besok!`);
      loadHistory();
    } catch (err: any) {
      toast.error('Gagal generate pengingat: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setHistory(prev => prev.filter(h => h.id !== id));
    toast.success('Notifikasi dihapus');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Pusat Kontrol Notifikasi Pengurus</h1>
          <p className="page-subtitle">Kirim pengumuman broadcast dan picu pengingat otomatis H-1 tugas/latihan ke HP/Laptop anggota.</p>
        </div>
        <button
          onClick={handleTriggerAutomatedReminders}
          disabled={loading}
          className="btn-primary gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold shadow-lg"
        >
          <CalendarCheck size={18} />
          <span>{loading ? 'Memproses...' : '⚡ Picu Otomatis Pengingat H-1 Besok'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Send Broadcast */}
        <div className="lg:col-span-1 card p-5 space-y-4 border border-brand-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-brand-800 dark:text-amber-400 font-bold border-b border-gray-100 dark:border-slate-800 pb-3">
            <Megaphone size={20} />
            <span>Kirim Broadcast Pengumuman</span>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3.5">
            <div>
              <label className="label">Target Penerima</label>
              <select
                className="input"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
              >
                <option value="ALL">🌐 Semua Anggota Misdinar (Aktif)</option>
                <option value="Misdinar_Aktif">👦 Misdinar Regular Only</option>
                <option value="Pengurus">⭐ Pengurus Only</option>
              </select>
            </div>

            <div>
              <label className="label">Judul Pengumuman *</label>
              <input
                className="input"
                placeholder="Contoh: Perubahan Jam Latihan Sabtu"
                value={judul}
                onChange={e => setJudul(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Pesan Pengumuman *</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="Tuliskan detail pengumuman di sini..."
                value={pesan}
                onChange={e => setPesan(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Link URL Tujuan (Opsional)</label>
              <input
                className="input"
                placeholder="Contoh: /jadwal atau /pengurus/jasroh"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 gap-2 font-bold justify-center shadow-lg"
            >
              <Send size={16} /> Kirim Pengumuman Now
            </button>
          </form>
        </div>

        {/* History Notifikasi */}
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
              <Clock size={18} className="text-amber-500" />
              <span>Riwayat Notifikasi Terkirim ({history.length})</span>
            </div>
            <button onClick={loadHistory} className="text-xs text-brand-800 dark:text-brand-400 hover:underline">
              Refresh
            </button>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <Bell size={36} className="mx-auto text-gray-300 opacity-40" />
                <p className="text-xs">Belum ada notifikasi broadcast terkirim.</p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-brand-800 dark:text-brand-400">
                        {item.judul}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                        Kepada: {item.users?.nama_panggilan || item.users?.nickname || 'Anggota'}
                      </span>
                      {item.is_read ? (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 size={12} /> Dibaca
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-semibold">Belum dibaca</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-slate-300 leading-snug">{item.pesan}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNotif(item.id)}
                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
