import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { Calendar, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const WARNA_DOT: Record<string, string> = {
  Putih:  'bg-gray-100 text-gray-700 border border-gray-300',
  Merah:  'bg-red-100 text-red-700',
  Hijau:  'bg-green-100 text-green-700',
  Ungu:   'bg-purple-100 text-purple-700',
  Hitam:  'bg-gray-800 text-white',
  Merah_Muda: 'bg-pink-100 text-pink-700',
};

function formatTgl(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatJam(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type Row = {
  id: string;
  slot_number: number;
  event: {
    id: string;
    nama_event: string;
    perayaan: string;
    tipe_event: string;
    tanggal_tugas: string;
    tanggal_latihan: string | null;
    warna_liturgi: string;
    latihan_times: string[] | null;
    pic_slot_1a: string | null; pic_slot_1b: string | null;
    pic_slot_2a: string | null; pic_slot_2b: string | null;
    pic_slot_3a: string | null; pic_slot_3b: string | null;
    pic_slot_4a: string | null; pic_slot_4b: string | null;
    pic_hp_slot_1a: string | null; pic_hp_slot_1b: string | null;
    pic_hp_slot_2a: string | null; pic_hp_slot_2b: string | null;
    pic_hp_slot_3a: string | null; pic_hp_slot_3b: string | null;
    pic_hp_slot_4a: string | null; pic_hp_slot_4b: string | null;
  } | null;
};

export default function JadwalSayaPage() {
  const { user } = useAuth();
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<'mendatang' | 'semua'>('mendatang');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let q = supabase
        .from('assignments')
        .select(`
          id, slot_number,
          events(
            id, nama_event, perayaan, tipe_event,
            tanggal_tugas, tanggal_latihan, warna_liturgi,
            latihan_times,
            pic_slot_1a, pic_slot_1b, pic_hp_slot_1a, pic_hp_slot_1b,
            pic_slot_2a, pic_slot_2b, pic_hp_slot_2a, pic_hp_slot_2b,
            pic_slot_3a, pic_slot_3b, pic_hp_slot_3a, pic_hp_slot_3b,
            pic_slot_4a, pic_slot_4b, pic_hp_slot_4a, pic_hp_slot_4b
          )
        `)
        .eq('user_id', user.id)
        .order('id');

      if (filter === 'mendatang') {
        q = q.gte('events.tanggal_tugas', today);
      }

      const { data, error } = await q;
      if (error) throw error;

      const filtered = (data || [])
        .filter((r: any) => r.events && r.events.tipe_event !== 'Misa_Harian')
        .filter((r: any) => filter === 'semua' || r.events.tanggal_tugas >= today)
        .sort((a: any, b: any) =>
          (a.events?.tanggal_tugas || '').localeCompare(b.events?.tanggal_tugas || '')
        );

      setRows(filtered as Row[]);
    } catch (err: any) {
      toast.error('Gagal memuat jadwal: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function getPic(ev: any, slot: number) {
    const a = ev[`pic_slot_${slot}a`];
    const b = ev[`pic_slot_${slot}b`];
    if (!a && !b) return null;
    return [a, b].filter(Boolean).join(' & ');
  }

  function getPicHp(ev: any, slot: number) {
    const a = ev[`pic_hp_slot_${slot}a`];
    const b = ev[`pic_hp_slot_${slot}b`];
    return [a, b].filter(Boolean)[0] || null;
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jadwal Saya</h1>
          <p className="text-sm text-gray-500">Semua penugasan misa kamu</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['mendatang', 'semua'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'mendatang' ? 'Mendatang' : 'Semua'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Memuat...
        </div>
      )}

      {/* Empty */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada jadwal</p>
          <p className="text-sm mt-1">
            {filter === 'mendatang' ? 'Tidak ada jadwal mendatang' : 'Belum pernah ditugaskan'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500 uppercase tracking-wide text-left">
                <th className="px-4 py-3 font-medium">Tanggal Tugas</th>
                <th className="px-4 py-3 font-medium">Misa / Perayaan</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Latihan</th>
                <th className="px-4 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const ev = row.event;
                if (!ev) return null;
                const isPast   = ev.tanggal_tugas < today;
                const isExpand = expanded.has(row.id);
                const warna    = WARNA_DOT[ev.warna_liturgi] || 'bg-gray-100 text-gray-600';
                const picName  = getPic(ev, row.slot_number);
                const picHp    = getPicHp(ev, row.slot_number);
                const jamLatihan = ev.latihan_times?.[0] || null;

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`transition-colors cursor-pointer ${
                        isPast ? 'bg-gray-50/60 text-gray-400' : 'bg-white hover:bg-blue-50/30'
                      }`}
                      onClick={() => toggleExpand(row.id)}
                    >
                      {/* Tanggal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`font-medium ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                          {formatTgl(ev.tanggal_tugas)}
                        </p>
                        {!isPast && (
                          <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${warna}`}>
                            {ev.warna_liturgi}
                          </span>
                        )}
                      </td>

                      {/* Perayaan */}
                      <td className="px-4 py-3">
                        <p className={`font-medium ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                          {ev.perayaan || ev.nama_event}
                        </p>
                        <p className="text-xs text-gray-400">{ev.tipe_event?.replace('_', ' ')}</p>
                      </td>

                      {/* Slot */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          isPast ? 'bg-gray-100 text-gray-400' : 'bg-brand-100 text-brand-800'
                        }`}>
                          {row.slot_number}
                        </span>
                      </td>

                      {/* Latihan */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ev.tanggal_latihan ? (
                          <div>
                            <p className={`text-sm ${isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                              {formatTgl(ev.tanggal_latihan)}
                            </p>
                            {jamLatihan && (
                              <p className="text-xs text-gray-400">{jamLatihan}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Expand toggle */}
                      <td className="px-3 py-3 text-gray-400">
                        {isExpand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpand && (
                      <tr className={isPast ? 'bg-gray-50/40' : 'bg-blue-50/20'}>
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            {/* PIC slot ini */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">PIC Slot {row.slot_number}</p>
                              {picName ? (
                                <div>
                                  <p className="text-gray-800 font-medium">{picName}</p>
                                  {picHp && (
                                    <a
                                      href={`https://wa.me/${picHp.replace(/\D/g,'').replace(/^0/, '62')}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:underline mt-0.5 block"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      WA: {picHp}
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <p className="text-gray-400 italic text-xs">Belum ada PIC</p>
                              )}
                            </div>

                            {/* PIC slot lain */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Semua Slot Misa Ini</p>
                              <div className="space-y-0.5">
                                {[1,2,3,4].map(s => {
                                  const name = getPic(ev, s);
                                  if (!name) return null;
                                  return (
                                    <p key={s} className="text-xs text-gray-600">
                                      <span className="font-semibold text-gray-700">Slot {s}:</span> {name}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {rows.length} jadwal • Klik baris untuk detail PIC
          </div>
        </div>
      )}
    </div>
  );
}
