import React, { useState, useEffect, useCallback } from 'react';
import { supabase as supabaseTyped } from '@/lib/supabase';
const supabase = supabaseTyped as any;
import { formatDate, getLiturgyClass } from '@/lib/utils';
import { useWeeklySchedule } from './hooks/useWeeklySchedule';
import { useAutoAssign } from './hooks/useAutoAssign';
import { WeekSelector } from './components/WeekSelector';
import { EventCard } from './components/EventCard';
import { PriorityMonitor } from './components/PriorityMonitor';
import { EditEventModal, DeleteEventModal } from './components/ScheduleModals';
import { AddMisaModal } from './components/AddMisaModal';
import { Zap, FileEdit, Globe, Check, Pencil, Trash2, Plus, X as XIcon, ImageDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCombinedPNG } from './components/ExportToolbar';

function parseSlotSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  const results: { slot: number; jam: string; tanggal: string }[] = [];
  const re = /Slot\s+(\d+):\s*([\d.]+)\|(\d{4}-\d{2}-\d{2})/gi;
  for (const m of draftNote.matchAll(re)) {
    results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback || '' });
  }
  if (!results.length) {
    const re2 = /Slot\s+(\d+):\s*([\d.]+)/gi;
    for (const m of draftNote.matchAll(re2)) {
      results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: fallback || '' });
    }
  }
  return results;
}

const SLOT_INFO: Record<number, { time: string }> = {
  1: { time: 'Sabtu 17:30'  },
  2: { time: 'Minggu 06:00' },
  3: { time: 'Minggu 08:00' },
  4: { time: 'Minggu 17:30' },
};

export default function ScheduleWeeklyPage() {
  const { events, month, setMonth, year, setYear, loading, loadEvents } = useWeeklySchedule();
  const { generating, generate, monitorData, monitorLoad, loadMonitor } = useAutoAssign(year, month, loadEvents);

  const [activeTab,  setActiveTab]  = useState<'jadwal' | 'pic' | 'pelatih' | 'monitor'>('jadwal');
  const [editEvent,  setEditEvent]  = useState<any>(null);
  const [deleteConf, setDeleteConf] = useState<any>(null);
  const [showAddMisa,setShowAddMisa]= useState(false);
  const [picOptions, setPicOptions] = useState<any[]>([]);
  const [editPicEventId, setEditPicEventId] = useState<string | null>(null);
  const [editPicSlots, setEditPicSlots]     = useState<any[]>([]);
  const [savingPic, setSavingPic]           = useState(false);

  // Multi-select export
  const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());
  const [exportingCombined, setExportingCombined] = useState(false);

  function toggleExportSelect(id: string) {
    setSelectedExportIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  async function handleExportCombined() {
    const selected = events.filter(ev => selectedExportIds.has(ev.id));
    if (!selected.length) return;
    setExportingCombined(true);
    await exportCombinedPNG(selected, picOptions);
    setExportingCombined(false);
  }

  // Pelatih batch state
  const [pelatihBatch,    setPelatihBatch]    = useState<Record<string, any>>({});
  const [latihanJamBatch, setLatihanJamBatch] = useState<Record<string, string>>({});
  const [latihanTglBatch, setLatihanTglBatch] = useState<Record<string, string>>({});
  const [latihanAltBatch, setLatihanAltBatch] = useState<Record<string, string>>({});
  const [savingPelatih,   setSavingPelatih]   = useState(false);

  const INIT_MISA_FORM = {
    tipe: 'Misa_Khusus_Biasa', tanggal_tugas: '', tanggal_latihan: '',
    perayaan: '', warna_liturgi: 'Putih', jumlah_misa: 1,
    jumlah_petugas: 8, tanpa_latihan: false, auto_generate: false,
    slot_schedule: [{ tanggal: '', jam: '07.00' }], is_misa_besar: false,
  };
  const [addMisaForm, setAddMisaForm] = useState({ ...INIT_MISA_FORM });

  useEffect(() => {
    supabase.from('users')
      .select('id, nickname, nama_panggilan, role, hp_anak, hp_ortu')
      .in('role', ['Administrator','Pengurus','Pelatih'])
      .eq('status', 'Active')
      .order('nama_panggilan')
      .then(({ data }: { data: any[] | null }) => setPicOptions(data || []));
  }, []);

  useEffect(() => {
    if (activeTab === 'monitor') loadMonitor();
  }, [activeTab, year, month, loadMonitor]);

  // ── Month nav ──────────────────────────────────────────────
  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }

  // ── Pelatih batch ──────────────────────────────────────────
  // pelatihBatch: { [eventId]: { [urutan]: nick } }
  function getPelatihField(ev: any, pos: number) {
    if (pelatihBatch[ev.id]?.[pos] !== undefined) return pelatihBatch[ev.id][pos];
    const existing = (ev.event_pelatih || []).find((p: any) => p.urutan === pos);
    return existing?.nama || '';
  }
  function setPelatihField(eventId: string, pos: number, nick: string) {
    setPelatihBatch(b => ({ ...b, [eventId]: { ...(b[eventId] || {}), [pos]: nick } }));
  }
  function getLatihanJam(ev: any) {
    if (latihanJamBatch[ev.id] !== undefined) return latihanJamBatch[ev.id];
    if (ev.latihan_times?.length) return ev.latihan_times[0];
    if (ev.latihan_notes) return ev.latihan_notes;
    return '';
  }
  function getLatihanTgl(ev: any) {
    if (latihanTglBatch[ev.id] !== undefined) return latihanTglBatch[ev.id];
    return ev.tanggal_latihan || '';
  }
  function getLatihanAlt(ev: any) {
    if (latihanAltBatch[ev.id] !== undefined) return latihanAltBatch[ev.id];
    return ev.latihan_hari_alt || '';
  }

  async function savePelatihBatch() {
    setSavingPelatih(true);
    let saved = 0;
    const allIds = new Set([
      ...Object.keys(pelatihBatch),
      ...Object.keys(latihanJamBatch),
      ...Object.keys(latihanTglBatch),
      ...Object.keys(latihanAltBatch),
    ]);
    for (const eventId of allIds) {
      const pelatih = pelatihBatch[eventId] || {};
      const jam     = latihanJamBatch[eventId];
      const tgl     = latihanTglBatch[eventId];
      const alt     = latihanAltBatch[eventId];

      if (Object.keys(pelatih).length) {
        await supabase.from('event_pelatih').delete().eq('event_id', eventId);
        const rows = Object.entries(pelatih)
          .filter(([, nick]) => nick)
          .map(([pos, nick]) => ({ event_id: eventId, nama: nick as string, urutan: Number(pos) }));
        if (rows.length) await supabase.from('event_pelatih').insert(rows);
      }

      const evUpdate: Record<string, any> = {};
      if (jam !== undefined) evUpdate.latihan_times = jam ? [jam] : [];
      if (tgl !== undefined) evUpdate.tanggal_latihan = tgl || null;
      if (alt !== undefined) evUpdate.latihan_hari_alt = alt || null;
      if (Object.keys(evUpdate).length) {
        await supabase.from('events').update(evUpdate).eq('id', eventId);
      }
      saved++;
    }
    await loadEvents();
    setPelatihBatch({});
    setLatihanJamBatch({});
    setLatihanTglBatch({});
    setLatihanAltBatch({});
    setSavingPelatih(false);
    toast.success(`Pelatih piket disimpan untuk ${saved} jadwal!`);
  }

  // ── Event actions ──────────────────────────────────────────
  async function publishEvent(ev: any) {
    const pics = ev.event_pics || [];
    const nSlots = ev.tipe_event === 'Misa_Khusus' ? (ev.jumlah_misa || 1) : 4;
    const missingPIC = Array.from({ length: nSlots }, (_, i) => i + 1)
      .filter(s => !pics.some((p: any) => p.slot === s));
    if (missingPIC.length && !confirm(`Slot ${missingPIC.join(', ')} belum ada PIC. Publish tetap?`)) return;
    const { error } = await supabase.from('events').update({ is_draft: false, published_at: new Date().toISOString() }).eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`"${ev.perayaan}" berhasil dipublish!`);
    loadEvents();
  }
  async function unpublishEvent(ev: any) {
    const { error } = await supabase.from('events').update({ is_draft: true, published_at: null }).eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Dikembalikan ke draft');
    loadEvents();
  }
  async function deleteEvent(ev: any) {
    await supabase.from('assignments').delete().eq('event_id', ev.id);
    const { error } = await supabase.from('events').delete().eq('id', ev.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Jadwal dihapus');
    setDeleteConf(null);
    loadEvents();
  }
  async function saveEditEvent() {
    const { error } = await supabase.from('events').update({
      perayaan: editEvent.perayaan, nama_event: (editEvent.perayaan || '').toUpperCase(),
      warna_liturgi: editEvent.warna_liturgi, tanggal_latihan: editEvent.tanggal_latihan,
      draft_note: editEvent.draft_note,
      is_misa_besar: editEvent.is_misa_besar || false,
    }).eq('id', editEvent.id);
    if (error) { toast.error(error.message); return; }
    // PIC saving is handled by EditEventModal via event_pics table
    setEditEvent(null);
    loadEvents();
  }
  async function addMisaKhusus() {
    const f = addMisaForm;
    if (!f.tanggal_tugas || !f.perayaan) { toast.error('Tanggal dan nama perayaan wajib diisi'); return; }

    const isMR     = f.tipe === 'Mingguan_HariRaya';
    const isBiasa  = f.tipe === 'Misa_Khusus_Biasa';
    // Both Misa_Khusus and Misa_Khusus_Biasa stored as 'Misa_Khusus' tipe_event in DB
    const dbTipe   = isMR ? 'Mingguan' : 'Misa_Khusus';
    const nSlots   = isMR ? 4 : (f.slot_schedule?.length || 1);
    const nPetugas = f.jumlah_petugas ?? 8;

    let draftNote: string | null = null;
    let tanggalLatihan: string | null = null;

    if (isMR) {
      tanggalLatihan = f.tanggal_latihan || null;
    } else {
      const schedule = f.slot_schedule || [{ tanggal: f.tanggal_tugas, jam: '07.00' }];
      draftNote = `Jam: ${schedule.map((s: any, i: number) => `Slot ${i+1}: ${s.jam||'07.00'}|${s.tanggal||f.tanggal_tugas}`).join(' | ')}`;
      // tanggal_latihan = latihan date if applicable
      if (!f.tanpa_latihan && f.tanggal_latihan) {
        tanggalLatihan = f.tanggal_latihan;
      } else if (!f.tanpa_latihan && isBiasa) {
        // default latihan = same day as first slot (e.g. a few hours before)
        tanggalLatihan = schedule[0]?.tanggal || f.tanggal_tugas;
      }
    }

    const { data: ev, error } = await supabase.from('events').insert({
      nama_event:      f.perayaan.toUpperCase(),
      tipe_event:      dbTipe,
      tanggal_tugas:   f.tanggal_tugas,
      tanggal_latihan: tanggalLatihan,
      perayaan:        f.perayaan,
      warna_liturgi:   f.warna_liturgi,
      jumlah_misa:     nSlots,
      jumlah_petugas:  nPetugas,
      tanpa_latihan:   f.tanpa_latihan || false,
      status_event:    'Akan_Datang',
      is_draft:        true,
      gcatholic_fetched: false,
      draft_note:      draftNote,
      is_misa_besar:   f.is_misa_besar || false,
    }).select().single();
    if (error) { toast.error('Gagal tambah: ' + error.message); return; }

    // Auto-generate petugas jika diminta
    if (f.auto_generate && ev?.id) {
      await autoGeneratePetugas(ev.id, nSlots, nPetugas);
    }

    toast.success(`"${f.perayaan}" berhasil ditambahkan!${f.auto_generate ? ' Petugas otomatis di-assign.' : ''}`);
    setShowAddMisa(false);
    setAddMisaForm({ ...INIT_MISA_FORM });
    loadEvents();
  }

  async function autoGeneratePetugas(eventId: string, nSlots: number, nPetugas: number) {
    // Ambil pool anggota aktif, sort by last assignment (sama seperti generate mingguan)
    const { data: pool } = await supabase.from('users')
      .select('id').eq('status', 'Active').eq('is_suspended', false)
      .in('role', ['Misdinar_Aktif', 'Misdinar_Retired']);
    if (!pool?.length) return;

    const since60 = new Date(Date.now() - 60*24*3600*1000).toISOString();
    const { data: recent } = await supabase.from('assignments')
      .select('user_id, created_at').gte('created_at', since60);
    const lastMap: Record<string, string> = {};
    (recent || []).forEach((a: any) => {
      if (!lastMap[a.user_id] || a.created_at > lastMap[a.user_id]) lastMap[a.user_id] = a.created_at;
    });
    const scored = (pool as any[]).map(u => ({
      id: u.id,
      score: lastMap[u.id] ? (Date.now() - new Date(lastMap[u.id]).getTime()) / 86400000 : 9999,
    })).sort((a, b) => b.score - a.score);

    let poolIdx = 0;
    const assigns: any[] = [];
    for (let slot = 1; slot <= nSlots; slot++) {
      const used = new Set<string>();
      let cnt = 0, att = 0;
      while (cnt < nPetugas && att < scored.length * 4) {
        const u = scored[poolIdx % scored.length];
        poolIdx++; att++;
        if (used.has(u.id)) continue;
        used.add(u.id);
        assigns.push({ event_id: eventId, user_id: u.id, slot_number: slot, position: cnt + 1 });
        cnt++;
      }
    }
    if (assigns.length) await supabase.from('assignments').insert(assigns);
  }

  // ── Inline PIC editing (PIC tab) ──────────────────────────
  const staffOptions = picOptions.filter(p => ['Administrator','Pengurus'].includes(p.role));

  function startEditPic(ev: any) {
    setEditPicEventId(ev.id);
    setEditPicSlots(JSON.parse(JSON.stringify(ev.event_pics || [])));
  }
  function cancelEditPic() { setEditPicEventId(null); setEditPicSlots([]); }
  function addPicInline(slot: number) {
    const maxU = editPicSlots.filter(p => p.slot === slot).reduce((m, p) => Math.max(m, p.urutan), 0);
    setEditPicSlots(prev => [...prev, { slot, nama: '', hp: '', urutan: maxU + 1 }]);
  }
  function removePicInline(slot: number, urutan: number) {
    setEditPicSlots(prev => {
      const filtered = prev.filter(p => !(p.slot === slot && p.urutan === urutan));
      let idx = 1;
      return filtered.map(p => p.slot === slot ? { ...p, urutan: idx++ } : p);
    });
  }
  function updatePicInline(slot: number, urutan: number, nick: string) {
    const found = staffOptions.find((o: any) => o.nickname === nick);
    const hp   = found ? (found.hp_anak || found.hp_ortu || '') : '';
    const nama = found ? (found.nama_panggilan || nick) : nick;
    setEditPicSlots(prev => prev.map(p =>
      p.slot === slot && p.urutan === urutan ? { ...p, nama, hp } : p
    ));
  }
  async function savePicInline(eventId: string) {
    setSavingPic(true);
    try {
      await supabase.from('event_pics').delete().eq('event_id', eventId);
      const toInsert = editPicSlots.filter(p => p.nama?.trim());
      if (toInsert.length) {
        const { error } = await supabase.from('event_pics').insert(
          toInsert.map(p => ({ event_id: eventId, slot: p.slot, nama: p.nama, hp: p.hp || null, urutan: p.urutan }))
        );
        if (error) throw error;
      }
      await loadEvents();
      setEditPicEventId(null);
      setEditPicSlots([]);
      toast.success('PIC disimpan!');
    } catch (e: any) {
      toast.error('Gagal: ' + e.message);
    } finally {
      setSavingPic(false);
    }
  }

  // ── Group vigili with parent ───────────────────────────────
  const vigiliEvents = events.filter((e: any) =>
    e.tipe_event === 'Misa_Khusus' &&
    (e.perayaan?.toLowerCase().startsWith('misa vigili') || e.draft_note?.toLowerCase().includes('vigili h-1'))
  );
  const mainEvents = events.filter((e: any) => !vigiliEvents.includes(e));

  const draftCount = events.filter((e: any) => e.is_draft).length;
  const pubCount   = events.filter((e: any) => !e.is_draft).length;

  const TABS = [
    { key: 'jadwal',  label: '📅 Jadwal' },
    { key: 'pic',     label: '🙋 PIC' },
    { key: 'pelatih', label: '👨‍🏫 Pelatih Piket' },
    { key: 'monitor', label: '📊 Prioritas' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Jadwal Misa Mingguan</h1>
          <p className="page-subtitle">8 petugas/slot · 4 slot · Draft → Publish</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <WeekSelector month={month} year={year} onPrev={prevMonth} onNext={nextMonth} onRefresh={loadEvents} />
          <button onClick={() => generate()} disabled={generating} className="btn-primary gap-2">
            <Zap size={16}/> {generating ? 'Generating...' : 'Generate Draft'}
          </button>
          <button onClick={() => setShowAddMisa(true)} className="btn-outline gap-2">
            + Misa Khusus
          </button>
        </div>
      </div>

      {/* Status chips */}
      {events.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {draftCount > 0 && <div className="badge-yellow flex items-center gap-1.5 px-3 py-1.5"><FileEdit size={13}/> {draftCount} draft</div>}
          {pubCount   > 0 && <div className="badge-green  flex items-center gap-1.5 px-3 py-1.5"><Globe    size={13}/> {pubCount} published</div>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: JADWAL ── */}
      {activeTab === 'jadwal' && (
        <>
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="skeleton h-72 rounded-xl"/>)}</div>
          ) : events.length === 0 ? (
            <div className="card text-center py-14">
              <p className="text-gray-500 font-medium">Belum ada jadwal bulan ini</p>
              <button onClick={() => generate()} disabled={generating} className="btn-primary mt-4 gap-2">
                <Zap size={16}/> Generate Sekarang
              </button>
            </div>
          ) : (
            <>
            {/* Floating export bar */}
            {selectedExportIds.size > 0 && (
              <div className="sticky top-2 z-20 flex items-center gap-3 bg-brand-800 text-white px-4 py-2.5 rounded-xl shadow-lg">
                <span className="text-sm font-semibold">{selectedExportIds.size} jadwal dipilih</span>
                <button
                  onClick={handleExportCombined}
                  disabled={exportingCombined}
                  className="ml-auto flex items-center gap-1.5 bg-white text-brand-800 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-60 transition-colors"
                >
                  <ImageDown size={15}/>
                  {exportingCombined ? 'Exporting...' : 'Export Gabungan PNG'}
                </button>
                <button
                  onClick={() => setSelectedExportIds(new Set())}
                  className="text-white/70 hover:text-white"
                  title="Batal pilih semua"
                >
                  <XIcon size={16}/>
                </button>
              </div>
            )}

            <div className="space-y-6">
              {mainEvents.map((ev: any) => {
                const [ey,em,ed] = ev.tanggal_tugas?.split('-').map(Number) || [0,0,0];
                const dayBefore  = ey ? `${ey}-${String(em).padStart(2,'0')}-${String(ed-1).padStart(2,'0')}` : null;
                const vigili     = vigiliEvents.find((v: any) => v.tanggal_tugas === dayBefore) || null;
                const isSelected = selectedExportIds.has(ev.id);
                return (
                  <div key={ev.id} className={`relative rounded-2xl transition-all ${isSelected ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}>
                    <label className="absolute top-3 left-3 z-10 flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleExportSelect(ev.id)}
                        className="w-4 h-4 accent-brand-700 rounded"
                      />
                      <span className="text-xs font-medium text-gray-600 bg-white/80 px-1 rounded">pilih</span>
                    </label>
                    <EventCard ev={ev} vigili={vigili} picOptions={picOptions}
                      onEdit={setEditEvent} onDelete={setDeleteConf}
                      onPublish={publishEvent} onUnpublish={unpublishEvent}
                    />
                  </div>
                );
              })}
            </div>
            </>
          )}

          <EditEventModal editEvent={editEvent} setEditEvent={setEditEvent} picOptions={picOptions} loadEvents={loadEvents} saveEditEvent={saveEditEvent}/>
          <DeleteEventModal deleteConf={deleteConf} setDeleteConf={setDeleteConf} deleteEvent={deleteEvent}/>
          <AddMisaModal showAddMisa={showAddMisa} setShowAddMisa={setShowAddMisa} addMisaForm={addMisaForm} setAddMisaForm={setAddMisaForm} addMisaKhusus={addMisaKhusus}/>
        </>
      )}

      {/* ── TAB: PIC ── */}
      {activeTab === 'pic' && (
        <div className="space-y-4">
          {events.length === 0
            ? <div className="card text-center py-10 text-gray-400">Belum ada jadwal bulan ini</div>
            : events.map((ev: any) => {
              const lc      = getLiturgyClass(ev.warna_liturgi);
              const isMK    = ev.tipe_event === 'Misa_Khusus';
              const nSlots  = isMK ? (ev.jumlah_misa || 1) : 4;
              const isEditing = editPicEventId === ev.id;
              return (
                <div key={ev.id} className={`card border-l-4 ${ev.is_draft ? 'border-yellow-400' : 'border-green-400'}`}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${lc.dot}`}/>
                      <div>
                        <p className="font-bold text-gray-900">{ev.perayaan || ev.nama_event}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(ev.tanggal_latihan,'dd MMM')} – {formatDate(ev.tanggal_tugas,'dd MMM yyyy')}
                          {ev.is_draft ? ' · Draft' : ' · Published'}
                        </p>
                      </div>
                    </div>
                    {!isEditing
                      ? <button onClick={() => startEditPic(ev)} className="btn-outline btn-sm gap-1"><Pencil size={13}/> Edit PIC</button>
                      : <div className="flex gap-2">
                          <button onClick={() => savePicInline(ev.id)} disabled={savingPic} className="btn-primary btn-sm gap-1"><Check size={13}/> {savingPic ? '...' : 'Simpan'}</button>
                          <button onClick={cancelEditPic} className="btn-secondary btn-sm"><XIcon size={13}/></button>
                        </div>
                    }
                  </div>

                  {!isEditing ? (
                    <div className={`grid gap-3 ${nSlots <= 2 ? 'grid-cols-2' : nSlots === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
                      {Array.from({ length: nSlots }, (_,i) => i+1).map(slot => {
                        const slotPics = (ev.event_pics || []).filter((p: any) => p.slot === slot).sort((a: any, b: any) => a.urutan - b.urutan);
                        return (
                          <div key={slot} className="p-3 bg-gray-50 rounded-xl space-y-1">
                            <p className="text-xs font-bold text-gray-700">{SLOT_INFO[slot]?.time || `Slot ${slot}`}</p>
                            {slotPics.length === 0
                              ? <p className="text-[11px] text-red-400">PIC belum diisi</p>
                              : slotPics.map((p: any, i: number) => (
                                <p key={i} className="text-[11px] text-brand-700 font-medium">
                                  ✓ {p.nama}{p.hp ? <> · <a href={`https://wa.me/${p.hp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{p.hp}</a></> : ''}
                                </p>
                              ))
                            }
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`grid gap-3 ${nSlots <= 2 ? 'grid-cols-2' : nSlots === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
                      {Array.from({ length: nSlots }, (_,i) => i+1).map(slot => {
                        const slotPics = editPicSlots.filter(p => p.slot === slot).sort((a: any, b: any) => a.urutan - b.urutan);
                        return (
                          <div key={slot} className="p-3 bg-blue-50 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-gray-700">{SLOT_INFO[slot]?.time || `Slot ${slot}`}</p>
                              <button type="button" onClick={() => addPicInline(slot)} className="text-[11px] text-brand-800 hover:text-brand-600 flex items-center gap-0.5 font-medium">
                                <Plus size={11}/> Tambah
                              </button>
                            </div>
                            {slotPics.length === 0 && <p className="text-[11px] text-gray-400 italic">Belum ada PIC</p>}
                            {slotPics.map((p, i) => (
                              <div key={p.urutan} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 w-4 shrink-0">{i+1}.</span>
                                <select className="input text-xs flex-1"
                                  value={staffOptions.find((o: any) => o.nama_panggilan === p.nama || o.nickname === p.nama)?.nickname || ''}
                                  onChange={e => updatePicInline(slot, p.urutan, e.target.value)}>
                                  <option value="">— Pilih PIC —</option>
                                  {staffOptions.map((o: any) => (
                                    <option key={o.id} value={o.nickname}>{o.nama_panggilan} (@{o.nickname})</option>
                                  ))}
                                </select>
                                <button type="button" onClick={() => removePicInline(slot, p.urutan)} className="text-red-400 hover:text-red-600 shrink-0">
                                  <Trash2 size={13}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      )}

      {/* ── TAB: PELATIH ── */}
      {activeTab === 'pelatih' && (
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-teal-700 font-semibold">Kelola Pelatih Piket per Event</p>
              <p className="text-xs text-teal-600 mt-0.5">Maks 3 pelatih per minggu. Tampil di kartu jadwal dan PNG export.</p>
            </div>
            <button onClick={savePelatihBatch} disabled={savingPelatih || (Object.keys(pelatihBatch).length === 0 && Object.keys(latihanJamBatch).length === 0 && Object.keys(latihanTglBatch).length === 0 && Object.keys(latihanAltBatch).length === 0)} className="btn-primary btn-sm gap-1 whitespace-nowrap">
              {savingPelatih ? 'Menyimpan...' : `Simpan (${new Set([...Object.keys(pelatihBatch),...Object.keys(latihanJamBatch),...Object.keys(latihanTglBatch),...Object.keys(latihanAltBatch)]).size})`}
            </button>
          </div>
          {events.length === 0
            ? <div className="card text-center py-10 text-gray-400">Belum ada jadwal bulan ini</div>
            : events.map((ev: any) => (
              <div key={ev.id} className="card space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`w-3 h-3 rounded-full ${getLiturgyClass(ev.warna_liturgi).dot}`}/>
                  <h3 className="font-bold text-gray-900">{ev.perayaan || ev.nama_event}</h3>
                  <span className="text-xs text-gray-400">{formatDate(ev.tanggal_latihan,'dd MMM')} — {formatDate(ev.tanggal_tugas,'dd MMM')}</span>
                  {ev.is_draft && <span className="badge-yellow text-xs">Draft</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1,2,3].map(pos => (
                    <div key={pos}>
                      <label className="label text-xs">Pelatih {pos}{pos===1?' *':' (opsional)'}</label>
                      <select className={`input text-sm ${getPelatihField(ev,pos) ? 'border-teal-400 bg-teal-50' : ''}`}
                        value={getPelatihField(ev,pos)} onChange={e => setPelatihField(ev.id,pos,e.target.value)}>
                        <option value="">— Pilih Pelatih —</option>
                        {picOptions.map(u => <option key={u.id} value={u.nickname}>{u.nama_panggilan}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {ev.is_misa_besar ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <p className="font-semibold mb-1">🎓 Misa Besar — Jadwal Latihan dikelola di Edit Event</p>
                    <p className="text-amber-700">Klik <strong>Edit</strong> pada kartu jadwal → bagian Sesi Latihan untuk tambah/hapus sesi.</p>
                    {ev.event_latihan?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {(ev.event_latihan as any[]).map((l: any) => (
                          <p key={l.id} className="text-amber-900">• {l.tanggal} · {l.jam}{l.lokasi ? ` · ${l.lokasi}` : ''}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">Tanggal Latihan</label>
                        <input
                          type="date"
                          className={`input text-sm ${latihanTglBatch[ev.id] !== undefined ? 'border-teal-400 bg-teal-50' : ''}`}
                          value={getLatihanTgl(ev)}
                          onChange={e => setLatihanTglBatch(b => ({ ...b, [ev.id]: e.target.value }))}
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Default Sabtu, bisa pilih hari lain</p>
                      </div>
                      <div>
                        <label className="label text-xs">Jam Latihan (muncul di PNG export)</label>
                        <input
                          type="time"
                          className={`input text-sm ${latihanJamBatch[ev.id] !== undefined ? 'border-teal-400 bg-teal-50' : ''}`}
                          value={getLatihanJam(ev)}
                          onChange={e => setLatihanJamBatch(b => ({ ...b, [ev.id]: e.target.value }))}
                          placeholder="cth. 16:00"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Tanggal Latihan Alternatif</label>
                        <input
                          type="date"
                          className={`input text-sm ${latihanAltBatch[ev.id] !== undefined ? 'border-teal-400 bg-teal-50' : ''}`}
                          value={getLatihanAlt(ev)}
                          onChange={e => setLatihanAltBatch(b => ({ ...b, [ev.id]: e.target.value }))}
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Opsional — hadir di salah satu cukup</p>
                      </div>
                    </div>
                  </div>
                )}
                {(ev.event_pelatih?.length > 0) && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Tersimpan:</span>
                    {(ev.event_pelatih as any[]).sort((a,b) => a.urutan - b.urutan).map((p: any) => {
                      const u = picOptions.find(u => u.nickname === p.nama);
                      return <span key={p.urutan} className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg font-medium">{u?.nama_panggilan || p.nama}</span>;
                    })}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── TAB: MONITOR ── */}
      {activeTab === 'monitor' && (
        <PriorityMonitor data={monitorData} loading={monitorLoad} onRefresh={loadMonitor} />
      )}
    </div>
  );
}
