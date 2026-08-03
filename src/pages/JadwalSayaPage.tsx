import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '../lib/supabase';
const supabase = supabaseTyped as any;
import { useAuth } from '../contexts/AuthContext';
import { Calendar, RefreshCw, ChevronDown, ChevronUp, ArrowLeftRight, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { buildWALink } from '../lib/utils';
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

type EventPicRow = { slot: number; nama: string; hp?: string | null; urutan: number };

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
    event_pics: EventPicRow[] | null;
  } | null;
};

type AvailEntry = { id: string; available: boolean; keterangan: string | null };

export default function JadwalSayaPage() {
  const { user, profile } = useAuth();
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<'mendatang' | 'semua'>('mendatang');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Availability: event_id → entry
  const [avail, setAvail] = useState<Record<string, AvailEntry>>({});

  // Availability modal
  const [availModal, setAvailModal] = useState<{ eventId: string; eventLabel: string } | null>(null);
  const [availKet, setAvailKet]   = useState('');
  const [availSaving, setAvailSaving] = useState(false);

  // Swap modal state
  const [swapRow,    setSwapRow]    = useState<Row | null>(null);
  const [swapAlasan, setSwapAlasan] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [{ data, error }, { data: availData }] = await Promise.all([
        supabase
          .from('assignments')
          .select(`
            id, slot_number,
            event:events(
              id, nama_event, perayaan, tipe_event,
              tanggal_tugas, tanggal_latihan, warna_liturgi,
              latihan_times,
              event_pics(slot, nama, hp, urutan)
            )
          `)
          .eq('user_id', user.id)
          .order('id'),
        supabase
          .from('user_availability')
          .select('id, event_id, available, keterangan')
          .eq('user_id', user.id),
      ]);
      if (error) throw error;

      const filtered = (data || [])
        .filter((r: any) => r.event && r.event.tipe_event !== 'Misa_Harian')
        .filter((r: any) => filter === 'semua' || r.event.tanggal_tugas >= today)
        .sort((a: any, b: any) =>
          (a.event?.tanggal_tugas || '').localeCompare(b.event?.tanggal_tugas || '')
        );

      setRows(filtered as Row[]);

      const map: Record<string, AvailEntry> = {};
      (availData || []).forEach((a: any) => {
        map[a.event_id] = { id: a.id, available: a.available, keterangan: a.keterangan };
      });
      setAvail(map);
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

  function getPic(ev: any, slot: number): string | null {
    const pics: EventPicRow[] = (ev.event_pics || [])
      .filter((p: EventPicRow) => p.slot === slot)
      .sort((a: EventPicRow, b: EventPicRow) => a.urutan - b.urutan);
    if (!pics.length) return null;
    return pics.map(p => p.nama).join(' & ');
  }

  function getPicHp(ev: any, slot: number): string | null {
    const pics: EventPicRow[] = (ev.event_pics || [])
      .filter((p: EventPicRow) => p.slot === slot)
      .sort((a: EventPicRow, b: EventPicRow) => a.urutan - b.urutan);
    return pics[0]?.hp || null;
  }

  async function markUnavailable() {
    if (!availModal || !user?.id) return;
    setAvailSaving(true);
    try {
      const existing = avail[availModal.eventId];
      if (existing) {
        const { error } = await supabase.from('user_availability').update({
          available: false,
          keterangan: availKet.trim() || null,
        }).eq('id', existing.id);
        if (error) throw error;
        setAvail(prev => ({ ...prev, [availModal.eventId]: { ...existing, available: false, keterangan: availKet.trim() || null } }));
      } else {
        const { data, error } = await supabase.from('user_availability').insert({
          user_id:    user.id,
          event_id:   availModal.eventId,
          available:  false,
          keterangan: availKet.trim() || null,
        }).select('id').single();
        if (error) throw error;
        setAvail(prev => ({ ...prev, [availModal.eventId]: { id: data.id, available: false, keterangan: availKet.trim() || null } }));
      }
      toast.success('Keterangan berhasil disimpan. Jangan lupa kabari PIC ya 🙏');
      setAvailModal(null);
      setAvailKet('');
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setAvailSaving(false);
    }
  }

  async function clearUnavailable(eventId: string) {
    const entry = avail[eventId];
    if (!entry) return;
    const { error } = await supabase.from('user_availability').delete().eq('id', entry.id);
    if (error) { toast.error('Gagal: ' + error.message); return; }
    setAvail(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    toast.success('Keterangan dihapus');
  }

  async function submitSwap() {
    if (!swapRow || !swapAlasan.trim()) {
      toast.error('Isi alasan terlebih dahulu'); return;
    }
    setSwapLoading(true);
    try {
      const ev   = swapRow.event! as any;
      const slot = swapRow.slot_number;
      const slotPics: EventPicRow[] = (ev.event_pics || [])
        .filter((p: EventPicRow) => p.slot === slot)
        .sort((a: EventPicRow, b: EventPicRow) => a.urutan - b.urutan);
      const picNick = slotPics[0]?.nama || null;
      let picUserId: string | null = null;
      let picWaLink = '';

      if (picNick) {
        const { data: picUser } = await supabase.from('users')
          .select('id, hp_anak, hp_ortu').eq('nickname', picNick).maybeSingle();
        if (picUser) {
          picUserId = picUser.id;
          const hp = picUser.hp_anak || picUser.hp_ortu || '';
          picWaLink = buildWALink(hp,
            `Halo ${picNick}, saya ${profile?.nama_panggilan} ingin tukar jadwal ` +
            `${ev.perayaan || ev.nama_event} (${ev.tanggal_tugas}) Misa ${slot}. ` +
            `Alasan: ${swapAlasan}. Mohon konfirmasi ya 🙏`
          );
        }
      }

      const { error } = await supabase.from('swap_requests').insert({
        requester_id:  user!.id,
        assignment_id: swapRow.id,
        alasan:        swapAlasan,
        pic_user_id:   picUserId,
        pic_wa_link:   picWaLink,
        status:        'Pending',
        expires_at:    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;

      toast.success('Request tukar terkirim!');
      setSwapRow(null);
      setSwapAlasan('');
      if (picWaLink) setTimeout(() => {
        if (confirm('Buka WhatsApp untuk hubungi PIC?')) window.open(picWaLink, '_blank');
      }, 400);
    } catch (err: any) {
      toast.error('Gagal: ' + err.message);
    } finally {
      setSwapLoading(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Jadwal Saya</h1>
          <p className="page-subtitle">Semua penugasan misa kamu</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['mendatang', 'semua'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-white dark:bg-slate-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}
          >
            {f === 'mendatang' ? 'Mendatang' : 'Semua'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12 text-gray-400 dark:text-slate-500">
          <RefreshCw size={20} className="animate-spin mr-2" /> Memuat...
        </div>
      )}

      {/* Empty */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <Calendar size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold text-gray-900 dark:text-slate-200">Belum ada jadwal</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {filter === 'mendatang' ? 'Tidak ada jadwal mendatang' : 'Belum pernah ditugaskan'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-800">
              <tr className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide text-left">
                <th className="px-4 py-3 font-medium">Tanggal Tugas</th>
                <th className="px-4 py-3 font-medium">Misa / Perayaan</th>
                <th className="px-4 py-3 font-medium">Misa</th>
                <th className="px-4 py-3 font-medium">Latihan</th>
                <th className="px-4 py-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const ev = row.event;
                if (!ev) return null;
                const isPast    = ev.tanggal_tugas < today;
                const isExpand  = expanded.has(row.id);
                const warna     = WARNA_DOT[ev.warna_liturgi] || 'bg-gray-100 text-gray-600';
                const picName   = getPic(ev, row.slot_number);
                const picHp     = getPicHp(ev, row.slot_number);
                const jamLatihan = ev.latihan_times?.[0] || null;
                const availEntry = avail[ev.id];
                const isUnavail  = availEntry && !availEntry.available;

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`transition-colors cursor-pointer ${
                        isPast ? 'bg-gray-50/60 text-gray-400' : isUnavail ? 'bg-amber-50/50 hover:bg-amber-50' : 'bg-white hover:bg-blue-50/30'
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
                        <div className="flex items-center gap-2">
                          <div>
                            <p className={`font-medium ${isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                              {ev.perayaan || ev.nama_event}
                            </p>
                            <p className="text-xs text-gray-400">{ev.tipe_event?.replace('_', ' ')}</p>
                          </div>
                          {isUnavail && !isPast && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              Tidak bisa
                            </span>
                          )}
                        </div>
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

                      {/* Expand toggle + swap */}
                      <td className="px-3 py-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          {!isPast && (
                            <button
                              onClick={e => { e.stopPropagation(); setSwapRow(row); setSwapAlasan(''); }}
                              className="p-1 rounded text-gray-400 hover:text-brand-800 hover:bg-brand-50 transition-colors"
                              title="Request tukar jadwal"
                            >
                              <ArrowLeftRight size={13} />
                            </button>
                          )}
                          {isExpand ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpand && (
                      <tr className={isPast ? 'bg-gray-50/40' : isUnavail ? 'bg-amber-50/30' : 'bg-blue-50/20'}>
                        <td colSpan={5} className="px-6 py-4">
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            {/* PIC slot ini */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">PIC Misa {row.slot_number}</p>
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

                            {/* Availability section — hanya untuk mendatang */}
                            {!isPast && (
                              <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Kehadiran</p>
                                {isUnavail ? (
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                      <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium text-amber-700">Kamu tandai tidak bisa hadir</p>
                                        {availEntry.keterangan && (
                                          <p className="text-xs text-gray-500 mt-0.5">"{availEntry.keterangan}"</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">Pastikan sudah kabari PIC atau buat request tukar jadwal.</p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        onClick={e => { e.stopPropagation(); setAvailModal({ eventId: ev.id, eventLabel: ev.perayaan || ev.nama_event }); setAvailKet(availEntry.keterangan || ''); }}
                                        className="text-xs text-amber-600 hover:underline"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={e => { e.stopPropagation(); clearUnavailable(ev.id); }}
                                        className="text-xs text-gray-400 hover:text-red-500 hover:underline"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                                    <p className="text-xs text-gray-600">Belum ada keterangan khusus</p>
                                    <button
                                      onClick={e => { e.stopPropagation(); setAvailModal({ eventId: ev.id, eventLabel: ev.perayaan || ev.nama_event }); setAvailKet(''); }}
                                      className="text-xs text-amber-600 hover:underline ml-auto"
                                    >
                                      + Tandai tidak bisa hadir
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
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
            {rows.length} jadwal • Klik baris untuk detail & kehadiran
          </div>
        </div>
      )}

      {/* Availability modal */}
      {availModal && (
        <div className="modal-overlay">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                <AlertCircle size={18} className="text-amber-500" /> Tidak Bisa Hadir
              </h3>
              <button onClick={() => setAvailModal(null)} className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-semibold text-gray-800 dark:text-amber-200">{availModal.eventLabel}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Keterangan ini akan terlihat oleh pengurus saat menyusun jadwal.</p>
            </div>
            <div>
              <label className="label">Alasan / Keterangan</label>
              <textarea
                className="input h-20 resize-none"
                value={availKet}
                onChange={e => setAvailKet(e.target.value)}
                placeholder="Contoh: ada acara keluarga, sakit, ujian, dll."
                autoFocus
              />
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 mt-3 text-xs text-blue-700 dark:text-blue-300">
              Menandai "tidak bisa hadir" <strong>bukan</strong> berarti absen otomatis dimaafkan.
              Tetap buat request tukar jadwal dan kabari PIC ya 🙏
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={markUnavailable}
                disabled={availSaving}
                className="btn-primary flex-1 gap-2"
              >
                {availSaving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <AlertCircle size={15} />
                }
                Simpan
              </button>
              <button onClick={() => setAvailModal(null)} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Swap request modal */}
      {swapRow && swapRow.event && (
        <div className="modal-overlay">
          <div className="modal-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                <ArrowLeftRight size={18} className="text-brand-800 dark:text-amber-400" /> Request Tukar Jadwal
              </h3>
              <button onClick={() => setSwapRow(null)} className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-semibold text-gray-800">{swapRow.event.perayaan || swapRow.event.nama_event}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatTgl(swapRow.event.tanggal_tugas)} · Misa {swapRow.slot_number}
              </p>
            </div>
            <div>
              <label className="label">Alasan Tukar *</label>
              <textarea
                className="input h-24 resize-none"
                value={swapAlasan}
                onChange={e => setSwapAlasan(e.target.value)}
                placeholder="Contoh: ada acara keluarga, sakit, dll."
                autoFocus
              />
            </div>
            <div className="bg-blue-50 rounded-xl p-3 mt-3 text-xs text-blue-700">
              Setelah submit → tombol WA PIC muncul di halaman Tukar Jadwal → hubungi PIC → setelah deal, tawarkan ke papan.
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={submitSwap}
                disabled={swapLoading || !swapAlasan.trim()}
                className="btn-primary flex-1 gap-2"
              >
                {swapLoading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mengirim...</>
                  : <><ArrowLeftRight size={15} /> Submit Request</>
                }
              </button>
              <button onClick={() => setSwapRow(null)} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
