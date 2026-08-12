import React, { useState } from 'react';
import { Check, X, UserCheck, AlertTriangle, Plus, Trash2, CalendarDays } from 'lucide-react';
import { supabase as supabaseTyped } from '@/lib/supabase';
const supabase = supabaseTyped as any;
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const SLOT_INFO: Record<number, { time: string; label: string; jam: string }> = {
  1: { time: 'Sabtu 17:30',  label: 'Sabtu Sore',    jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'Minggu Pagi I',  jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'Minggu Sore',   jam: '17.30' },
};
const WARNA_OPTIONS  = ['Hijau','Merah','Putih','Ungu','MerahMuda','Hitam'];

function parseMKSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  // Format: "Jam: Slot 1: 07.00|2026-12-25 | Slot 2: 07.00|2026-12-25"
  // Use matchAll on whole string to capture slot+jam+tanggal in one pass
  const results: { slot: number; jam: string; tanggal: string }[] = [];
  const re = /Slot\s+(\d+):\s*([\d.]+)\|(\d{4}-\d{2}-\d{2})/gi;
  for (const m of draftNote.matchAll(re)) {
    results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback });
  }
  // Fallback: slots without date
  if (!results.length) {
    const re2 = /Slot\s+(\d+):\s*([\d.]+)/gi;
    for (const m of draftNote.matchAll(re2)) {
      results.push({ slot: Number(m[1]), jam: m[2] || '07.00', tanggal: fallback });
    }
  }
  return results;
}

// --- Komponen EditPetugasSection dari file asli ---
function EditPetugasSection({ ev, onSaved }: { ev: any, onSaved: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [assigns, setAssigns] = useState<any>({});
  const [search,  setSearch]  = useState<any>({});
  const [open,    setOpen]    = useState<any>({});
  const [saving,  setSaving]  = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const nSlots = ev.tipe_event === 'Misa_Khusus' ? (ev.jumlah_misa || 1) : 4;

  React.useEffect(() => {
    if (!ev?.id || loaded) return;
    (async () => {
      const [{ data: mem }, { data: asgn }] = await Promise.all([
        supabase.from('users').select('id, nickname, nama_panggilan, lingkungan, pendidikan')
          .in('status', ['Active']).in('role', ['Misdinar_Aktif', 'Misdinar_Retired']).order('nama_panggilan'),
        supabase.from('assignments').select('id, slot_number, user_id').eq('event_id', ev.id),
      ]);
      setMembers(mem || []);
      const map: any = {};
      for (let s = 1; s <= nSlots; s++) {
        map[s] = (asgn || []).filter((a: any) => a.slot_number === s).map((a: any) => a.user_id);
      }
      setAssigns(map);
      setLoaded(true);
    })();
  }, [ev?.id]);

  const [slotLimits, setSlotLimits] = useState<Record<number, number>>({});

  function toggleMember(slot: number, userId: string) {
    const limit = slotLimits[slot] || ev.jumlah_petugas || 8;
    setAssigns((prev: any) => {
      const cur = prev[slot] || [];
      const isAlreadySelected = cur.includes(userId);
      if (!isAlreadySelected && cur.length >= limit) {
        toast.error(`Slot ini sudah mencapai batas target (${limit} orang, Maksimal 30).`);
        return prev;
      }
      return {
        ...prev,
        [slot]: isAlreadySelected
          ? cur.filter((id: string) => id !== userId)
          : [...cur, userId],
      };
    });
  }

  async function savePetugas() {
    setSaving(true);
    await supabase.from('assignments').delete().eq('event_id', ev.id);
    const rows: any[] = [];
    for (let s = 1; s <= nSlots; s++) {
      (assigns[s] || []).forEach((uid: string, i: number) => {
        rows.push({ event_id: ev.id, user_id: uid, slot_number: s, position: i + 1 });
      });
    }
    if (rows.length) await supabase.from('assignments').insert(rows);
    toast.success('Petugas diperbarui!');
    setSaving(false);
    onSaved();
  }

  if (!loaded) return <div className="text-xs text-gray-400 text-center py-2">Memuat data petugas…</div>;

  return (
    <div className="border-t border-gray-100 pt-4 mt-2">
      <h4 className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2">
        <UserCheck size={15} className="text-green-600"/> Edit Petugas per Slot
      </h4>
      {Array.from({length: nSlots}, (_,i) => i+1).map(slot => {
        const info = (SLOT_INFO as any)[slot] || SLOT_INFO[1];
        const selected = assigns[slot] || [];
        const q = (search[slot] || '').toLowerCase();
        const filtered = members.filter(m =>
          m.nama_panggilan?.toLowerCase().includes(q) ||
          m.nickname?.toLowerCase().includes(q) ||
          m.lingkungan?.toLowerCase().includes(q)
        );
        const isOpen = !!open[slot];
        const curLimit = slotLimits[slot] || ev.jumlah_petugas || 8;
        return (
          <div key={slot} className="mb-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 hover:border-brand-800 transition-colors bg-white dark:bg-slate-900">
              <button type="button"
                onClick={() => setOpen((p: any) => ({...p, [slot]: !p[slot]}))}
                className="flex-1 text-left flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-200">{info.time}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400 mr-3">
                  {selected.length} / {curLimit} Terisi ▾
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-gray-400">Target:</span>
                <select
                  value={curLimit}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setSlotLimits(p => ({ ...p, [slot]: val }));
                  }}
                  className="text-[11px] bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded px-1 py-0.5 border border-gray-300 dark:border-slate-700 font-medium"
                >
                  {[4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30].map(n => (
                    <option key={n} value={n}>{n} org</option>
                  ))}
                </select>
              </div>
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                {selected.map((uid: string) => {
                  const m = members.find(x => x.id === uid);
                  return m ? (
                    <button key={uid} type="button" onClick={() => toggleMember(slot, uid)}
                      className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-red-100 hover:text-red-700 transition-colors">
                      {m.nama_panggilan} ×
                    </button>
                  ) : null;
                })}
              </div>
            )}
            {isOpen && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-lg bg-white z-20 relative">
                <div className="p-2 border-b border-gray-100">
                  <input autoFocus type="text" className="input text-sm py-1.5" placeholder="Cari nama, lingkungan…"
                    value={search[slot] || ''} onChange={e => setSearch((p:any) => ({...p, [slot]: e.target.value}))} />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Tidak ditemukan</p>}
                  {filtered.map(m => {
                    const isSel = selected.includes(m.id);
                    return (
                      <button key={m.id} type="button" onClick={() => toggleMember(slot, m.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${isSel ? 'bg-green-50' : ''}`}>
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                          {isSel && <Check size={10} className="text-white"/>}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 truncate">{m.nama_panggilan}</p>
                          <p className="text-[10px] text-gray-400">{m.pendidikan} · {m.lingkungan}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-gray-100">
                  <button type="button" onClick={() => setOpen((p:any) => ({...p, [slot]: false}))}
                    className="btn-outline btn-sm w-full text-xs">Tutup</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={savePetugas} disabled={saving} className="btn-primary btn-sm w-full gap-2 mt-2">
        <Check size={14}/> {saving ? 'Menyimpan…' : 'Simpan Petugas'}
      </button>
    </div>
  );
}

// ── PIC Editor per slot (dinamis) ────────────────────────────────
function PicSlotEditor({ slot, slotLabel, pics, setPics, picOptions }: {
  slot: number;
  slotLabel: string;
  pics: { slot: number; nama: string; hp: string; urutan: number }[];
  setPics: (fn: (prev: any[]) => any[]) => void;
  picOptions: any[];
}) {
  const staffOptions = picOptions.filter((p: any) =>
    ['Administrator', 'Pengurus'].includes(p.role)
  );

  function addPic() {
    const maxUrutan = pics.filter(p => p.slot === slot).reduce((m, p) => Math.max(m, p.urutan), 0);
    setPics(prev => [...prev, { slot, nama: '', hp: '', urutan: maxUrutan + 1 }]);
  }

  function removePic(urutan: number) {
    setPics(prev => {
      const filtered = prev.filter(p => !(p.slot === slot && p.urutan === urutan));
      // reindex urutan
      let idx = 1;
      return filtered.map(p => p.slot === slot ? { ...p, urutan: idx++ } : p);
    });
  }

  function updatePic(urutan: number, nick: string) {
    const found = staffOptions.find((p: any) => p.nickname === nick);
    const hp = found ? (found.hp_anak || found.hp_ortu || '') : '';
    const nama = found ? (found.nama_panggilan || nick) : nick;
    setPics(prev => prev.map(p =>
      p.slot === slot && p.urutan === urutan ? { ...p, nama, hp } : p
    ));
  }

  const slotPics = pics.filter(p => p.slot === slot).sort((a, b) => a.urutan - b.urutan);

  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-600">{slotLabel}</p>
        <button type="button" onClick={addPic}
          className="text-[11px] text-brand-800 hover:text-brand-600 flex items-center gap-0.5 font-medium">
          <Plus size={11}/> Tambah PIC
        </button>
      </div>
      {slotPics.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">Belum ada PIC — klik Tambah PIC</p>
      )}
      <div className="space-y-2">
        {slotPics.map((p, i) => (
          <div key={p.urutan} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}.</span>
            <select
              className="input text-xs flex-1"
              value={staffOptions.find((o: any) => o.nama_panggilan === p.nama || o.nickname === p.nama)?.nickname || ''}
              onChange={e => updatePic(p.urutan, e.target.value)}
            >
              <option value="">— Pilih PIC —</option>
              {staffOptions.map((o: any) => (
                <option key={o.id} value={o.nickname}>{o.nama_panggilan} (@{o.nickname})</option>
              ))}
            </select>
            {p.hp && <span className="text-[10px] text-gray-400 shrink-0">📱 {p.hp}</span>}
            <button type="button" onClick={() => removePic(p.urutan)}
              className="text-red-400 hover:text-red-600 shrink-0">
              <Trash2 size={13}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Jadwal Latihan Editor (untuk Misa Besar) ─────────────────────────────────
function LatihanEditor({ eventId }: { eventId: string }) {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loaded,  setLoaded]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  React.useEffect(() => {
    if (!eventId) return;
    setLoaded(false);
    supabase.from('event_latihan')
      .select('id, tanggal, jam, lokasi, catatan')
      .eq('event_id', eventId)
      .order('tanggal')
      .then(({ data }: { data: any[] | null }) => {
        setRows(data || []);
        setLoaded(true);
      });
  }, [eventId]);

  function addRow() {
    setRows(r => [...r, { _new: true, id: `tmp_${Date.now()}`, tanggal: '', jam: '16:00', lokasi: '', catatan: '' }]);
  }

  function updateRow(id: string, field: string, val: string) {
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x));
  }

  function removeRow(id: string) {
    setRows(r => r.filter(x => x.id !== id));
  }

  async function save() {
    setSaving(true);
    // Delete rows no longer in list (existing rows)
    const { data: existing } = await supabase.from('event_latihan').select('id').eq('event_id', eventId);
    const existingIds = (existing || []).map((x: any) => x.id);
    const keptIds = rows.filter(r => !r._new).map(r => r.id);
    const toDelete = existingIds.filter((id: string) => !keptIds.includes(id));
    for (const id of toDelete) await supabase.from('event_latihan').delete().eq('id', id);

    // Upsert kept + new rows
    for (const row of rows) {
      if (!row.tanggal || !row.jam) continue;
      if (row._new) {
        await supabase.from('event_latihan').insert({ event_id: eventId, tanggal: row.tanggal, jam: row.jam, lokasi: row.lokasi || null, catatan: row.catatan || null });
      } else {
        await supabase.from('event_latihan').update({ tanggal: row.tanggal, jam: row.jam, lokasi: row.lokasi || null, catatan: row.catatan || null }).eq('id', row.id);
      }
    }
    // Reload
    const { data } = await supabase.from('event_latihan').select('id, tanggal, jam, lokasi, catatan').eq('event_id', eventId).order('tanggal');
    setRows(data || []);
    setSaving(false);
    toast.success('Jadwal latihan disimpan!');
  }

  if (!loaded) return <div className="text-xs text-gray-400 py-2">Memuat sesi latihan…</div>;

  return (
    <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
          <CalendarDays size={14}/> Sesi Latihan
        </p>
        <button type="button" onClick={addRow} className="text-[11px] text-amber-700 hover:text-amber-900 flex items-center gap-0.5 font-medium">
          <Plus size={11}/> Tambah Sesi
        </button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-gray-400 italic">Belum ada sesi — klik Tambah Sesi</p>
      )}
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
            <input type="date" className="input text-xs" value={row.tanggal} onChange={e => updateRow(row.id, 'tanggal', e.target.value)} />
            <input type="time" className="input text-xs w-24" value={row.jam} onChange={e => updateRow(row.id, 'jam', e.target.value)} />
            <input type="text" className="input text-xs" placeholder="Lokasi (opsional)" value={row.lokasi || ''} onChange={e => updateRow(row.id, 'lokasi', e.target.value)} />
            <button type="button" onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <button type="button" onClick={save} disabled={saving} className="btn-primary btn-sm w-full gap-1 text-xs">
          <Check size={13}/> {saving ? 'Menyimpan…' : 'Simpan Sesi Latihan'}
        </button>
      )}
    </div>
  );
}

export function EditEventModal({ editEvent, setEditEvent, picOptions, loadEvents, saveEditEvent }: any) {
  if (!editEvent) return null;

  const [localPics, setLocalPics] = useState<any[]>(editEvent.event_pics || []);
  const [savingPics, setSavingPics] = useState(false);

  const isMK    = editEvent.tipe_event === 'Misa_Khusus';
  const nSlots  = isMK ? (editEvent.jumlah_misa || 1) : 4;

  // For Misa Khusus: derive slot labels from draft_note jam
  const mkSched = isMK ? parseMKSchedule(editEvent.draft_note, editEvent.tanggal_tugas) : [];
  function getSlotLabel(slot: number): string {
    if (isMK) {
      const sc = mkSched.find(s => s.slot === slot);
      return `Misa ${slot}${sc ? ` · ${sc.jam}` : ''}${sc?.tanggal ? ` (${sc.tanggal})` : ''}`;
    }
    return SLOT_INFO[slot]?.time || `Misa ${slot}`;
  }

  async function handleSaveAll() {
    setSavingPics(true);
    try {
      // Save PICs first (before saveEditEvent unmounts modal via setEditEvent(null))
      const eventId = editEvent.id;
      await supabase.from('event_pics').delete().eq('event_id', eventId);
      const toInsert = localPics.filter(p => p.nama && p.nama.trim());
      if (toInsert.length) {
        const { error: picErr } = await supabase.from('event_pics').insert(
          toInsert.map(p => ({ event_id: eventId, slot: p.slot, nama: p.nama, hp: p.hp || null, urutan: p.urutan }))
        );
        if (picErr) throw picErr;
      }
      // Then save event fields + close modal
      await saveEditEvent();
      toast.success('Disimpan!');
    } catch (e: any) {
      setSavingPics(false);
      toast.error('Gagal simpan: ' + e.message);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Edit Jadwal Draft</h3>
          <button onClick={() => setEditEvent(null)} className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"><X size={20}/></button>
        </div>
        <div className="space-y-4 mb-5">
          <div>
            <label className="label">Nama Perayaan</label>
            <input className="input" value={editEvent.perayaan||''}
              onChange={e=>setEditEvent((v:any)=>({...v, perayaan:e.target.value, nama_event:e.target.value.toUpperCase()}))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tanggal Latihan (Sabtu)</label>
              <input type="date" className="input" value={editEvent.tanggal_latihan||''}
                onChange={e=>setEditEvent((v:any)=>({...v, tanggal_latihan:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Warna Liturgi</label>
              <select className="input" value={editEvent.warna_liturgi||'Hijau'}
                onChange={e=>setEditEvent((v:any)=>({...v, warna_liturgi:e.target.value}))}>
                {WARNA_OPTIONS.map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${editEvent.is_misa_besar ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80' : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50'}`}
            onClick={()=>setEditEvent((v:any)=>({...v, is_misa_besar: !v.is_misa_besar}))}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={!!editEvent.is_misa_besar} readOnly className="w-4 h-4 accent-brand-800"/>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">🎓 Misa Besar</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Aktifkan kehadiran latihan wajib + scan latihan</p>
              </div>
            </div>
          </div>

          {/* Jadwal latihan sesi (only for misa besar) */}
          {editEvent.is_misa_besar && (
            <LatihanEditor eventId={editEvent.id} />
          )}
        </div>
        <div className="mb-5">
          <h4 className="font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2 text-sm">
            <UserCheck size={15} className="text-brand-800 dark:text-amber-400"/> PIC per Slot
          </h4>
          <div className="space-y-3">
            {Array.from({ length: nSlots }, (_, i) => i + 1).map(slot => (
              <PicSlotEditor
                key={slot}
                slot={slot}
                slotLabel={getSlotLabel(slot)}
                pics={localPics}
                setPics={setLocalPics}
                picOptions={picOptions}
              />
            ))}
          </div>
        </div>
        <div className="mb-5">
          <label className="label">Catatan Draft</label>
          <textarea className="input h-16 resize-none" value={editEvent.draft_note||''}
            onChange={e=>setEditEvent((v:any)=>({...v, draft_note:e.target.value}))}/>
        </div>
        <EditPetugasSection ev={editEvent} onSaved={()=>{setEditEvent(null);loadEvents();}}/>
        <div className="flex gap-2 mt-4">
          <button onClick={handleSaveAll} disabled={savingPics} className="btn-primary flex-1 gap-2">
            <Check size={16}/> {savingPics ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={()=>setEditEvent(null)} className="btn-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}

export function DeleteEventModal({ deleteConf, setDeleteConf, deleteEvent }: any) {
  if (!deleteConf) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-3"><AlertTriangle size={24} className="text-red-500"/><h3 className="font-bold text-lg text-gray-900 dark:text-white">Hapus Jadwal?</h3></div>
        <p className="text-sm text-gray-600 dark:text-slate-300 mb-1"><strong>"{deleteConf.perayaan||deleteConf.nama_event}"</strong><br/>{formatDate(deleteConf.tanggal_tugas,'dd MMM yyyy')}</p>
        <p className="text-xs text-red-500 dark:text-red-400 mb-4">⚠️ {deleteConf.assignments?.length||0} petugas ikut terhapus. Tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={()=>deleteEvent(deleteConf)} className="btn-danger flex-1">Hapus</button>
          <button onClick={()=>setDeleteConf(null)} className="btn-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}
