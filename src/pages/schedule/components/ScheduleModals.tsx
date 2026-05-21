import React, { useState } from 'react';
import { Check, X, UserCheck, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { supabase as supabaseTyped } from '@/lib/supabase';
const supabase = supabaseTyped as any;
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const SLOT_INFO = {
  1: { time: 'Sabtu 17:30',  label: 'Sabtu Sore',    jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'Minggu Pagi I',  jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'Minggu Sore',   jam: '17.30' },
};
const WARNA_OPTIONS  = ['Hijau','Merah','Putih','Ungu','MerahMuda','Hitam'];

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

  function toggleMember(slot: number, userId: string) {
    setAssigns((prev: any) => {
      const cur = prev[slot] || [];
      return {
        ...prev,
        [slot]: cur.includes(userId)
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
        return (
          <div key={slot} className="mb-3">
            <button type="button"
              onClick={() => setOpen((p: any) => ({...p, [slot]: !p[slot]}))}
              className="w-full flex items-center justify-between text-left px-3 py-2 rounded-xl border border-gray-200 hover:border-brand-800 transition-colors">
              <span className="text-xs font-bold text-gray-700">{info.time}</span>
              <span className="text-xs text-gray-500">{selected.length} dipilih ▾</span>
            </button>
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

export function EditEventModal({ editEvent, setEditEvent, picOptions, loadEvents, saveEditEvent }: any) {
  if (!editEvent) return null;

  // Kelola event_pics sebagai local state
  const [localPics, setLocalPics] = useState<any[]>(editEvent.event_pics || []);
  const [savingPics, setSavingPics] = useState(false);

  const nSlots = editEvent.tipe_event === 'Misa_Khusus' ? (editEvent.jumlah_misa || 1) : 4;

  async function handleSaveAll() {
    setSavingPics(true);
    try {
      // Save event fields
      await saveEditEvent();
      // Save pics: delete all for this event, re-insert
      await supabase.from('event_pics').delete().eq('event_id', editEvent.id);
      const toInsert = localPics.filter(p => p.nama && p.nama.trim());
      if (toInsert.length) {
        await supabase.from('event_pics').insert(
          toInsert.map(p => ({ event_id: editEvent.id, slot: p.slot, nama: p.nama, hp: p.hp || null, urutan: p.urutan }))
        );
      }
      toast.success('PIC disimpan!');
    } catch (e: any) {
      toast.error('Gagal simpan PIC: ' + e.message);
    } finally {
      setSavingPics(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Edit Jadwal Draft</h3>
          <button onClick={() => setEditEvent(null)}><X size={20}/></button>
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
          <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${editEvent.is_misa_besar ? 'border-brand-800 bg-brand-50' : 'border-gray-200 bg-gray-50'}`}
            onClick={()=>setEditEvent((v:any)=>({...v, is_misa_besar: !v.is_misa_besar}))}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={!!editEvent.is_misa_besar} readOnly className="w-4 h-4 accent-brand-800"/>
              <div>
                <p className="text-sm font-semibold text-gray-800">🎓 Misa Besar</p>
                <p className="text-xs text-gray-500">Aktifkan kehadiran latihan wajib</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mb-5">
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm">
            <UserCheck size={15} className="text-brand-800"/> PIC per Slot
          </h4>
          <div className="space-y-3">
            {Array.from({ length: nSlots }, (_, i) => i + 1).map(slot => (
              <PicSlotEditor
                key={slot}
                slot={slot}
                slotLabel={(SLOT_INFO as any)[slot]?.time || `Slot ${slot}`}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-3"><AlertTriangle size={24} className="text-red-500"/><h3 className="font-bold text-lg">Hapus Jadwal?</h3></div>
        <p className="text-sm text-gray-600 mb-1"><strong>"{deleteConf.perayaan||deleteConf.nama_event}"</strong><br/>{formatDate(deleteConf.tanggal_tugas,'dd MMM yyyy')}</p>
        <p className="text-xs text-red-500 mb-4">⚠️ {deleteConf.assignments?.length||0} petugas ikut terhapus. Tidak bisa dibatalkan.</p>
        <div className="flex gap-2">
          <button onClick={()=>deleteEvent(deleteConf)} className="btn-danger flex-1">Hapus</button>
          <button onClick={()=>setDeleteConf(null)} className="btn-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}
