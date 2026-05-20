import React, { useState } from 'react';
import { Check, X, UserCheck, AlertTriangle } from 'lucide-react';
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

export function EditEventModal({ editEvent, setEditEvent, picOptions, loadEvents, saveEditEvent }: any) {
  if (!editEvent) return null;

  function PicSelect({ slot, pos }: any) {
    const fNick = `pic_slot_${slot}${pos}`;
    const fHp   = `pic_hp_slot_${slot}${pos}`;
    const val   = editEvent?.[fNick] || '';

    function onChange(nick: string) {
      const found = picOptions.find((p:any) => p.nickname === nick);
      const hp    = found ? (found.hp_anak || found.hp_ortu || '') : '';
      setEditEvent((v:any) => ({ ...v, [fNick]: nick, [fHp]: hp }));
    }

    return (
      <div className="flex-1">
        <label className="text-[10px] text-gray-500 font-medium">PIC {pos === 'a' ? '1' : '2'}</label>
        <select className="input text-xs mt-0.5" value={val} onChange={e => onChange(e.target.value)}>
          <option value="">— Pilih PIC —</option>
          {picOptions.filter((p:any) => p.role === 'Administrator' || p.role === 'Pengurus').map((p:any) => (
            <option key={p.id} value={p.nickname}>{p.nama_panggilan} (@{p.nickname})</option>
          ))}
        </select>
        {editEvent?.[fHp] && <p className="text-[10px] text-gray-400 mt-0.5">📞 {editEvent[fHp]}</p>}
      </div>
    );
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
            {[1,2,3,4].map(slot=>(
              <div key={slot} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-bold text-gray-600 mb-2">{(SLOT_INFO as any)[slot].time}</p>
                <div className="flex gap-3"><PicSelect slot={slot} pos="a"/><PicSelect slot={slot} pos="b"/></div>
              </div>
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
          <button onClick={saveEditEvent} className="btn-primary flex-1 gap-2"><Check size={16}/> Simpan</button>
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
