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
import { Zap, FileEdit, Globe, Check } from 'lucide-react';
import toast from 'react-hot-toast';

function parseSlotSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  const raw = draftNote.replace(/^Jam:\s*/i, '');
  return raw.split('|').map(part => {
    const m = part.trim().match(/Slot\s+(\d+):\s*([\d.]+)(?:\|(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    return { slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback || '' };
  }).filter(Boolean) as { slot: number; jam: string; tanggal: string }[];
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

  // PIC batch state
  const [picBatch,     setPicBatch]     = useState<Record<string, any>>({});
  const [savingPIC,    setSavingPIC]    = useState(false);
  // Pelatih batch state
  const [pelatihBatch,    setPelatihBatch]    = useState<Record<string, any>>({});
  const [latihanJamBatch, setLatihanJamBatch] = useState<Record<string, string>>({});
  const [savingPelatih,   setSavingPelatih]   = useState(false);

  const INIT_MISA_FORM = {
    tipe: 'Misa_Khusus', tanggal_tugas: '', tanggal_latihan: '',
    perayaan: '', warna_liturgi: 'Putih', jumlah_misa: 1,
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

  // ── PIC batch ──────────────────────────────────────────────
  function setPICField(eventId: string, slot: number, pos: 'a' | 'b', nick: string) {
    const found = picOptions.find(p => p.nickname === nick);
    const hp    = found ? (found.hp_anak || found.hp_ortu || '') : '';
    setPicBatch(b => ({
      ...b,
      [eventId]: { ...(b[eventId] || {}), [slot]: { ...(b[eventId]?.[slot] || {}), [pos]: nick, [pos === 'a' ? 'hpA' : 'hpB']: hp } },
    }));
  }

  async function savePICBatch() {
    const entries = Object.entries(picBatch);
    if (!entries.length) { toast('Tidak ada perubahan'); return; }
    setSavingPIC(true);
    let saved = 0;
    for (const [eventId, slots] of entries) {
      const update: Record<string, any> = {};
      for (let s = 1; s <= 4; s++) {
        const sl = (slots as any)[s];
        if (!sl) continue;
        if (sl.a   !== undefined) update[`pic_slot_${s}a`]    = sl.a   || null;
        if (sl.b   !== undefined) update[`pic_slot_${s}b`]    = sl.b   || null;
        if (sl.hpA !== undefined) update[`pic_hp_slot_${s}a`] = sl.hpA || null;
        if (sl.hpB !== undefined) update[`pic_hp_slot_${s}b`] = sl.hpB || null;
      }
      if (Object.keys(update).length) { await supabase.from('events').update(update).eq('id', eventId); saved++; }
    }
    setPicBatch({});
    setSavingPIC(false);
    toast.success(`PIC disimpan untuk ${saved} jadwal!`);
    loadEvents();
  }

  // ── Pelatih batch ──────────────────────────────────────────
  function getPelatihField(ev: any, pos: number) {
    const key = `p${pos}`;
    if (pelatihBatch[ev.id]?.[key] !== undefined) return pelatihBatch[ev.id][key];
    return ev[`pelatih_slot_${pos}`] || '';
  }
  function setPelatihField(eventId: string, pos: number, nick: string) {
    setPelatihBatch(b => ({ ...b, [eventId]: { ...(b[eventId] || {}), [`p${pos}`]: nick } }));
  }
  function getLatihanJam(ev: any) {
    if (latihanJamBatch[ev.id] !== undefined) return latihanJamBatch[ev.id];
    if (ev.latihan_times?.length) return ev.latihan_times[0];
    if (ev.latihan_notes) return ev.latihan_notes;
    return '';
  }

  async function savePelatihBatch() {
    setSavingPelatih(true);
    let saved = 0;
    // Merge eventIds dari pelatih + jam batch
    const allIds = new Set([
      ...Object.keys(pelatihBatch),
      ...Object.keys(latihanJamBatch),
    ]);
    for (const eventId of allIds) {
      const pelatih = pelatihBatch[eventId] || {};
      const jam     = latihanJamBatch[eventId];
      const payload: any = {};
      if (pelatih.p1 !== undefined) payload.pelatih_slot_1 = pelatih.p1 || null;
      if (pelatih.p2 !== undefined) payload.pelatih_slot_2 = pelatih.p2 || null;
      if (pelatih.p3 !== undefined) payload.pelatih_slot_3 = pelatih.p3 || null;
      if (jam !== undefined) payload.latihan_times = jam ? [jam] : [];
      if (!Object.keys(payload).length) continue;
      const { error } = await supabase.from('events').update(payload).eq('id', eventId);
      if (!error) saved++;
    }
    await loadEvents();
    setPelatihBatch({});
    setLatihanJamBatch({});
    setSavingPelatih(false);
    toast.success(`Pelatih piket disimpan untuk ${saved} jadwal!`);
  }

  // ── Event actions ──────────────────────────────────────────
  async function publishEvent(ev: any) {
    const missingPIC = [1,2,3,4].filter(s => !ev[`pic_slot_${s}a`] && !ev[`pic_slot_${s}b`]);
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
      pic_slot_1a: editEvent.pic_slot_1a||null, pic_hp_slot_1a: editEvent.pic_hp_slot_1a||null,
      pic_slot_1b: editEvent.pic_slot_1b||null, pic_hp_slot_1b: editEvent.pic_hp_slot_1b||null,
      pic_slot_2a: editEvent.pic_slot_2a||null, pic_hp_slot_2a: editEvent.pic_hp_slot_2a||null,
      pic_slot_2b: editEvent.pic_slot_2b||null, pic_hp_slot_2b: editEvent.pic_hp_slot_2b||null,
      pic_slot_3a: editEvent.pic_slot_3a||null, pic_hp_slot_3a: editEvent.pic_hp_slot_3a||null,
      pic_slot_3b: editEvent.pic_slot_3b||null, pic_hp_slot_3b: editEvent.pic_hp_slot_3b||null,
      pic_slot_4a: editEvent.pic_slot_4a||null, pic_hp_slot_4a: editEvent.pic_hp_slot_4a||null,
      pic_slot_4b: editEvent.pic_slot_4b||null, pic_hp_slot_4b: editEvent.pic_hp_slot_4b||null,
      is_misa_besar: editEvent.is_misa_besar || false,
    }).eq('id', editEvent.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Jadwal diperbarui!');
    setEditEvent(null);
    loadEvents();
  }
  async function addMisaKhusus() {
    const f = addMisaForm;
    if (!f.tanggal_tugas || !f.perayaan) { toast.error('Tanggal dan nama perayaan wajib diisi'); return; }
    const isMR = f.tipe === 'Mingguan_HariRaya';
    let draftNote = null;
    let tanggalLatihan = isMR ? f.tanggal_latihan : null;
    if (!isMR) {
      const schedule = f.slot_schedule || [{ tanggal: f.tanggal_tugas, jam: '07.00' }];
      draftNote = `Jam: ${schedule.map((s: any, i: number) => `Slot ${i+1}: ${s.jam||'07.00'}|${s.tanggal||f.tanggal_tugas}`).join(' | ')}`;
      tanggalLatihan = schedule[0]?.tanggal || f.tanggal_tugas;
    }
    const { error } = await supabase.from('events').insert({
      nama_event: f.perayaan.toUpperCase(), tipe_event: isMR ? 'Mingguan' : 'Misa_Khusus',
      tanggal_tugas: f.tanggal_tugas, tanggal_latihan: tanggalLatihan,
      perayaan: f.perayaan, warna_liturgi: f.warna_liturgi,
      jumlah_misa: isMR ? 4 : (f.slot_schedule?.length || 1),
      status_event: 'Akan_Datang', is_draft: true, gcatholic_fetched: false,
      draft_note: draftNote, is_misa_besar: f.is_misa_besar || false,
    });
    if (error) { toast.error('Gagal tambah: ' + error.message); return; }
    toast.success(`"${f.perayaan}" berhasil ditambahkan!`);
    setShowAddMisa(false);
    setAddMisaForm({ ...INIT_MISA_FORM });
    loadEvents();
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
    { key: 'pic',     label: `🙋 PIC${Object.keys(picBatch).length > 0 ? ` (${Object.keys(picBatch).length})` : ''}` },
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
            <div className="space-y-6">
              {mainEvents.map((ev: any) => {
                const [ey,em,ed] = ev.tanggal_tugas?.split('-').map(Number) || [0,0,0];
                const dayBefore  = ey ? `${ey}-${String(em).padStart(2,'0')}-${String(ed-1).padStart(2,'0')}` : null;
                const vigili     = vigiliEvents.find((v: any) => v.tanggal_tugas === dayBefore) || null;
                return (
                  <EventCard key={ev.id} ev={ev} vigili={vigili} picOptions={picOptions}
                    onEdit={setEditEvent} onDelete={setDeleteConf}
                    onPublish={publishEvent} onUnpublish={unpublishEvent}
                  />
                );
              })}
            </div>
          )}

          <EditEventModal editEvent={editEvent} setEditEvent={setEditEvent} picOptions={picOptions} loadEvents={loadEvents} saveEditEvent={saveEditEvent}/>
          <DeleteEventModal deleteConf={deleteConf} setDeleteConf={setDeleteConf} deleteEvent={deleteEvent}/>
          <AddMisaModal showAddMisa={showAddMisa} setShowAddMisa={setShowAddMisa} addMisaForm={addMisaForm} setAddMisaForm={setAddMisaForm} addMisaKhusus={addMisaKhusus}/>
        </>
      )}

      {/* ── TAB: PIC ── */}
      {activeTab === 'pic' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <p className="text-sm text-blue-700">Isi PIC untuk semua slot sekaligus, lalu klik <strong>Simpan Semua PIC</strong>.</p>
            <button onClick={savePICBatch} disabled={savingPIC || !Object.keys(picBatch).length} className="btn-primary gap-2 flex-shrink-0">
              <Check size={16}/> {savingPIC ? 'Menyimpan...' : 'Simpan Semua PIC'}
            </button>
          </div>
          {events.length === 0
            ? <div className="card text-center py-10 text-gray-400">Belum ada jadwal bulan ini</div>
            : events.map((ev: any) => {
              const lc     = getLiturgyClass(ev.warna_liturgi);
              const isMK   = ev.tipe_event === 'Misa_Khusus';
              const nSlots = isMK ? (ev.jumlah_misa || 1) : 4;
              const slotSched = isMK ? parseSlotSchedule(ev.draft_note, ev.tanggal_tugas) : [];
              return (
                <div key={ev.id} className={`card border-l-4 ${ev.is_draft ? 'border-yellow-400' : 'border-green-400'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${lc.dot}`}/>
                    <div>
                      <p className="font-bold text-gray-900">{ev.perayaan || ev.nama_event}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(ev.tanggal_latihan,'dd MMM')} – {formatDate(ev.tanggal_tugas,'dd MMM yyyy')}
                        {ev.is_draft ? ' · Draft' : ' · Published'}
                      </p>
                    </div>
                  </div>
                  <div className={`grid gap-3 ${nSlots <= 2 ? 'grid-cols-2' : nSlots === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
                    {Array.from({ length: nSlots }, (_,i) => i+1).map(slot => {
                      const curA = picBatch[ev.id]?.[slot]?.a ?? ev[`pic_slot_${slot}a`] ?? '';
                      const curB = picBatch[ev.id]?.[slot]?.b ?? ev[`pic_slot_${slot}b`] ?? '';
                      const sc   = slotSched.find(s => s.slot === slot);
                      const slotLabel = isMK
                        ? `Misa ${slot} · ${sc?.jam || `Slot ${slot}`}${sc?.tanggal ? ` (${new Date(sc.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'})})` : ''}`
                        : SLOT_INFO[slot]?.time || `Slot ${slot}`;
                      const adminPeng = picOptions.filter(p => p.role === 'Administrator' || p.role === 'Pengurus');
                      return (
                        <div key={slot} className="p-3 bg-gray-50 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-gray-700">{slotLabel}</p>
                          {(['a','b'] as const).map(pos => (
                            <div key={pos}>
                              <label className="text-[10px] text-gray-400">PIC {pos === 'a' ? '1' : '2'}</label>
                              <select className="input text-xs mt-0.5" value={pos === 'a' ? curA : curB}
                                onChange={e => setPICField(ev.id, slot, pos, e.target.value)}>
                                <option value="">— Pilih —</option>
                                {adminPeng.map(p => <option key={p.id} value={p.nickname}>{p.nama_panggilan}</option>)}
                              </select>
                            </div>
                          ))}
                          {(curA||curB) && <p className="text-[10px] text-brand-700 font-medium truncate">✓ {[curA,curB].filter(Boolean).join(' & ')}</p>}
                        </div>
                      );
                    })}
                  </div>
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
            <button onClick={savePelatihBatch} disabled={savingPelatih || (Object.keys(pelatihBatch).length === 0 && Object.keys(latihanJamBatch).length === 0)} className="btn-primary btn-sm gap-1 whitespace-nowrap">
              {savingPelatih ? 'Menyimpan...' : `Simpan (${new Set([...Object.keys(pelatihBatch),...Object.keys(latihanJamBatch)]).size})`}
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
                <div className="max-w-xs">
                  <label className="label text-xs">Jam Latihan (muncul di PNG export)</label>
                  <input
                    type="time"
                    className={`input text-sm ${latihanJamBatch[ev.id] !== undefined ? 'border-teal-400 bg-teal-50' : ''}`}
                    value={getLatihanJam(ev)}
                    onChange={e => setLatihanJamBatch(b => ({ ...b, [ev.id]: e.target.value }))}
                    placeholder="cth. 16:00"
                  />
                </div>
                {(ev.pelatih_slot_1||ev.pelatih_slot_2||ev.pelatih_slot_3) && (
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Tersimpan:</span>
                    {[ev.pelatih_slot_1,ev.pelatih_slot_2,ev.pelatih_slot_3].filter(Boolean).map((p: string,i: number) => {
                      const u = picOptions.find(u => u.nickname === p);
                      return <span key={i} className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg font-medium">{u?.nama_panggilan||p}</span>;
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
