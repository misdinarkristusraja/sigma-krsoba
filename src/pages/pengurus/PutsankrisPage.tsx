import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Shirt, CheckSquare, Clock, Calendar, CheckCircle2, AlertCircle, Save, Copy, Share2, Sparkles, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_ITEMS = [
  { key: 'wiruk', label: 'Wiruk / Navikula', category: 'Alat Misa' },
  { key: 'torch', label: 'Lilin Processi / Torch', category: 'Alat Misa' },
  { key: 'korek_arang', label: 'Korek & Arang Misa', category: 'Alat Misa' },
  { key: 'kipas_anglo', label: 'Kipas & Anglo Arang', category: 'Alat Misa' },
  { key: 'lentera', label: 'Lentera Permulaan', category: 'Alat Misa' },
  { key: 'jubah_samir', label: 'Jubah & Samir Misdinar', category: 'Busana' },
  { key: 'piala_sibori', label: 'Piala, Sibori & Ampul', category: 'Alat Misa' },
];

function getWeeklyCycleDates() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun, 6 Sat
  const diffToSat = (day + 1) % 7;
  const startSat = new Date(d);
  startSat.setDate(d.getDate() - diffToSat);
  startSat.setHours(0, 0, 0, 0);

  const endSat = new Date(startSat);
  endSat.setDate(startSat.getDate() + 7);
  endSat.setHours(23, 59, 59, 999);

  return { startSat, endSat };
}

export default function PutsankrisPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({
    wiruk: true, torch: true, korek_arang: true, kipas_anglo: true,
    lentera: true, jubah_samir: true, piala_sibori: true
  });
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const { startSat, endSat } = getWeeklyCycleDates();
  const cycleLabel = `${startSat.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${endSat.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Filter for Misa Mingguan & Misa Hari Raya (Misa Khusus) only
      const { data: evData } = await supabase
        .from('events')
        .select('id, nama_event, perayaan, tanggal_tugas, tipe_event')
        .in('tipe_event', ['Mingguan', 'Misa_Khusus'])
        .gte('tanggal_tugas', today)
        .order('tanggal_tugas')
        .limit(20);

      const evs = evData || [];
      setEvents(evs);
      if (evs.length > 0) setSelectedEventId(evs[0].id);

      const { data: histData } = await supabase
        .from('pengurus_putsankris_checklists')
        .select('*, event:event_id(nama_event, perayaan, tanggal_tugas), checked_user:checked_by(nama_panggilan)')
        .order('checked_at', { ascending: false })
        .limit(20);

      setHistory(histData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleItem = (key: string) => {
    setCheckedState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveChecklist = async () => {
    if (!selectedEventId) { toast.error('Pilih Misa Mingguan/Hari Raya target'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('pengurus_putsankris_checklists').insert({
        event_id: selectedEventId,
        checked_items: checkedState,
        catatan,
        checked_by: profile?.id,
        checked_at: new Date().toISOString()
      });

      if (error) throw error;
      toast.success('Checklist Alat Misa Pekanan Berhasil Disimpan!');
      setCatatan('');
      loadData();
    } catch (err: any) {
      toast.error('Gagal simpan checklist: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEventInfo = events.find(e => e.id === selectedEventId);

  const generateReportText = () => {
    const itemsText = DEFAULT_ITEMS.map(i => {
      const isOk = checkedState[i.key] ?? false;
      return `${isOk ? '✅' : '❌'} ${i.label}: ${isOk ? 'READY' : 'BELUM SIAP'}`;
    }).join('\n');

    return `📋 *LAPORAN KESIAPAN ALAT & BUSANA LITURGI PUTSANKRIS*
📍 Paroki Kristus Raja Solo Baru
📅 Periode Audit Pekanan (Sabtu - Sabtu): ${cycleLabel}
⛪ Target: ${selectedEventInfo?.perayaan || selectedEventInfo?.nama_event || 'Misa Mingguan / Hari Raya'}
👤 Diperiksa oleh: ${profile?.nama_panggilan || 'Putsankris'}

*DAFTAR KELENGKAPAN ALAT & JUBAH:*
${itemsText}

💬 *Catatan Putsankris:*
${catatan || 'Semua perlengkapan dalam kondisi lengkap dan siap pakai.'}

Status Kesiapan: *READY UNTUK MISA MINGGUAN & HARI RAYA* 🌟`;
  };

  const copyReportToClipboard = () => {
    const text = generateReportText();
    navigator.clipboard.writeText(text);
    toast.success('Laporan disalin ke clipboard!');
  };

  const openWhatsAppReport = () => {
    const text = generateReportText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Divisi Putsankris (Putri Sakristan)</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Pemeriksaan Alat &amp; Busana Liturgi Khusus Misa Mingguan &amp; Hari Raya (Periode Sabtu - Sabtu).</p>
        </div>

        <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-3 py-1.5 rounded-xl text-xs font-semibold">
          <Sparkles size={14} className="text-purple-700 dark:text-purple-400" />
          <span>Siklus Audit: <strong>{cycleLabel}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Checklist */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Shirt size={18} className="text-purple-700 dark:text-purple-400" /> Pemeriksaan Alat Liturgi (Mingguan &amp; Hari Raya)
          </h3>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Pilih Misa Target Audit</label>
            <select
              className="input text-sm"
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
            >
              {events.length === 0 ? (
                <option value="">Tidak ada Misa Mingguan / Hari Raya mendatang</option>
              ) : (
                events.map(e => (
                  <option key={e.id} value={e.id}>
                    [{e.tipe_event === 'Misa_Khusus' ? 'HARI RAYA' : 'MINGGUAN'}] {e.perayaan || e.nama_event} ({e.tanggal_tugas})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 block">Daftar Kelengkapan Alat &amp; Jubah Pekan Ini</label>
            <div className="space-y-1.5 bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              {DEFAULT_ITEMS.map(item => {
                const isChecked = checkedState[item.key] ?? false;
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => toggleItem(item.key)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isChecked
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                        : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isChecked ? <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" /> : <AlertCircle size={15} className="text-red-500 dark:text-red-400" />}
                      {item.label}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isChecked ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-300'}`}>
                      {isChecked ? 'Ready' : 'Belum Siap'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">Catatan Putsankris / Kondisi Alat</label>
            <input
              className="input"
              placeholder="misal: Arang tersisa 1 pax, wiruk butuh dibersihkan"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
            />
          </div>

          <div className="space-y-2 pt-1">
            <button onClick={handleSaveChecklist} disabled={submitting} className="btn-primary w-full gap-2">
              <Save size={16} /> Simpan Audit Kesiapan Pekan Ini
            </button>

            {/* Direct Report Export / WhatsApp Share */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={copyReportToClipboard} type="button" className="btn-outline text-xs gap-1.5">
                <Copy size={14} /> Salin Laporan WA
              </button>
              <button onClick={openWhatsAppReport} type="button" className="btn-secondary text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                <MessageCircle size={14} /> Kirim ke WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* History Audit Log */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <Clock size={18} className="text-brand-800 dark:text-amber-400" /> Histori Audit Kesiapan Misa (Sabtu - Sabtu)
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500">
              <CheckSquare size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada histori audit checklist.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {history.map(h => (
                <div key={h.id} className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{h.event?.perayaan || h.event?.nama_event}</p>
                      <p className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">{h.event?.tanggal_tugas}</p>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                      {new Date(h.checked_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {h.catatan && (
                    <p className="text-gray-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2 rounded border border-gray-100 dark:border-slate-800">
                      "{h.catatan}"
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t border-gray-200/50 dark:border-slate-700/50 text-[10px] text-gray-500 dark:text-slate-400">
                    <span>Diperiksa oleh: <strong className="text-gray-700 dark:text-slate-200">{h.checked_user?.nama_panggilan || 'Putsankris'}</strong></span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓ Audit Valid</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
