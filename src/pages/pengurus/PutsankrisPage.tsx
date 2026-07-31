import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../../contexts/AuthContext';
import { Shirt, CheckSquare, Clock, Calendar, CheckCircle2, AlertCircle, Save } from 'lucide-react';
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: evData } = await supabase
        .from('events')
        .select('id, nama_event, perayaan, tanggal_tugas')
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
    if (!selectedEventId) { toast.error('Pilih misa/acara terlebih dahulu'); return; }
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
      toast.success('Checklist Alat & Busana Misa Berhasil Disimpan!');
      setCatatan('');
      loadData();
    } catch (err: any) {
      toast.error('Gagal simpan checklist: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900 text-base">Divisi Putsankris (Putri Sakristan)</h2>
          <p className="text-xs text-gray-500">Checklist Kesiapan Peralatan &amp; Busana Liturgi per Misa.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Checklist */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Shirt size={18} className="text-purple-700" /> Pemeriksaan Alat Liturgi Misa
          </h3>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Pilih Misa / Acara Target</label>
            <select
              className="input text-sm"
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
            >
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.perayaan || e.nama_event} ({e.tanggal_tugas})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 block">Daftar Kelengkapan Alat &amp; Jubah</label>
            <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
              {DEFAULT_ITEMS.map(item => {
                const isChecked = checkedState[item.key] ?? false;
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => toggleItem(item.key)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isChecked
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-white border-red-200 text-red-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isChecked ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-red-500" />}
                      {item.label}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {isChecked ? 'Ready' : 'Belum Siap'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Catatan Putsankris / Kondisi Alat</label>
            <input
              className="input"
              placeholder="misal: Arang tersisa 1 pax, wiruk butuh dibersihkan"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
            />
          </div>

          <button onClick={handleSaveChecklist} disabled={submitting} className="btn-primary w-full gap-2">
            <Save size={16} /> Simpan Audit Checklist
          </button>
        </div>

        {/* History Audit Log */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Clock size={18} className="text-brand-800" /> Histori Audit Kesiapan Misa
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckSquare size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada histori audit checklist.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {history.map(h => (
                <div key={h.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{h.event?.perayaan || h.event?.nama_event}</p>
                      <p className="text-[11px] text-gray-500">{h.event?.tanggal_tugas}</p>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {new Date(h.checked_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {h.catatan && (
                    <p className="text-gray-600 italic bg-white p-2 rounded border border-gray-100">
                      "{h.catatan}"
                    </p>
                  )}

                  <p className="text-[10px] text-gray-400 text-right">
                    Diperiksa oleh: <strong>{h.checked_user?.nama_panggilan || 'Putsankris'}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
