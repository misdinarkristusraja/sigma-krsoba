import React from 'react';
import { Check, X } from 'lucide-react';

const WARNA_OPTIONS = ['Hijau','Merah','Putih','Ungu','MerahMuda','Hitam'];

export function AddMisaModal({ showAddMisa, setShowAddMisa, addMisaForm, setAddMisaForm, addMisaKhusus }: any) {
  if (!showAddMisa) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-lg">Tambah Misa Khusus / Hari Raya</h3>
          <button onClick={() => setShowAddMisa(false)}><X size={20}/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="mb-5">
            <label className="label">Tipe Misa</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <label className={`flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.tipe==='Misa_Khusus'?'border-brand-800 bg-brand-50':'border-gray-200'}`}>
                <input type="radio" name="tipe" value="Misa_Khusus" className="sr-only"
                  checked={addMisaForm.tipe==='Misa_Khusus'}
                  onChange={()=>setAddMisaForm((f:any)=>({...f,tipe:'Misa_Khusus',tanggal_latihan:''}))} />
                <span className="font-semibold text-sm">Hari Raya Mandiri</span>
                <span className="text-xs text-gray-400">Misa sendiri, tidak ada latihan.</span>
              </label>
              <label className={`flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.tipe==='Mingguan_HariRaya'?'border-brand-800 bg-brand-50':'border-gray-200'}`}>
                <input type="radio" name="tipe" value="Mingguan_HariRaya" className="sr-only"
                  checked={addMisaForm.tipe==='Mingguan_HariRaya'}
                  onChange={()=>setAddMisaForm((f:any)=>({...f,tipe:'Mingguan_HariRaya',jumlah_misa:4}))} />
                <span className="font-semibold text-sm">Hari Raya + Mingguan</span>
                <span className="text-xs text-gray-400">Weekend ada misa biasa DAN hari raya.</span>
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Nama Perayaan *</label>
              <input className="input" value={addMisaForm.perayaan} placeholder="Contoh: HR. Kenaikan Tuhan"
                onChange={e=>setAddMisaForm((f:any)=>({...f,perayaan:e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  {addMisaForm.tipe==='Mingguan_HariRaya' ? 'Tanggal Misa (Minggu) *' : 'Tanggal Hari Raya *'}
                </label>
                <input type="date" className="input" value={addMisaForm.tanggal_tugas}
                  onChange={e=>setAddMisaForm((f:any)=>({...f,tanggal_tugas:e.target.value}))} />
              </div>
              {addMisaForm.tipe==='Mingguan_HariRaya' && (
                <div>
                  <label className="label">Tanggal Latihan (Sabtu)</label>
                  <input type="date" className="input" value={addMisaForm.tanggal_latihan}
                    onChange={e=>setAddMisaForm((f:any)=>({...f,tanggal_latihan:e.target.value}))} />
                </div>
              )}
              {addMisaForm.tipe==='Misa_Khusus' && (
                <div>
                  <label className="label">Jumlah Slot / Misa</label>
                  <select className="input" value={addMisaForm.slot_schedule?.length || 1}
                    onChange={e=>{
                      const n = Number(e.target.value);
                      const cur = addMisaForm.slot_schedule || [];
                      const next = Array.from({length:n}, (_,i) => cur[i] || { tanggal: addMisaForm.tanggal_tugas || '', jam: '07.00' });
                      setAddMisaForm((f:any)=>({...f, jumlah_misa: n, slot_schedule: next}));
                    }}>
                    {[1,2,3,4].map(n=><option key={n} value={n}>{n} misa</option>)}
                  </select>
                </div>
              )}
            </div>
            {addMisaForm.tipe==='Misa_Khusus' && (
              <div>
                <label className="label">Jadwal per Misa</label>
                <div className="space-y-2">
                  {(addMisaForm.slot_schedule || []).map((sc:any, idx:number) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                      <span className="text-xs font-medium text-gray-600 w-14 shrink-0">Misa {idx+1}</span>
                      <input type="date" className="input text-sm flex-1" value={sc.tanggal}
                        onChange={e => {
                          const next = [...addMisaForm.slot_schedule];
                          next[idx] = {...next[idx], tanggal: e.target.value};
                          const lastTgl = next[next.length-1].tanggal || e.target.value;
                          setAddMisaForm((f:any)=>({...f, slot_schedule: next, tanggal_tugas: lastTgl}));
                        }} />
                      <input type="text" className="input text-sm w-20" value={sc.jam} placeholder="07.00"
                        onChange={e => {
                          const next = [...addMisaForm.slot_schedule];
                          next[idx] = {...next[idx], jam: e.target.value};
                          setAddMisaForm((f:any)=>({...f, slot_schedule: next}));
                        }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Warna Liturgi</label>
              <select className="input" value={addMisaForm.warna_liturgi}
                onChange={e=>setAddMisaForm((f:any)=>({...f,warna_liturgi:e.target.value}))}>
                {WARNA_OPTIONS.map(w=><option key={w}>{w}</option>)}
              </select>
            </div>
            <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.is_misa_besar ? 'border-brand-800 bg-brand-50' : 'border-gray-200 bg-gray-50'}`}
              onClick={()=>setAddMisaForm((f:any)=>({...f, is_misa_besar: !f.is_misa_besar}))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={addMisaForm.is_misa_besar} readOnly className="w-4 h-4 accent-brand-800"/>
                <div>
                  <p className="text-sm font-semibold text-gray-800">🎓 Misa Besar</p>
                  <p className="text-xs text-gray-500">Aktifkan untuk misa yang wajib ada latihan khusus.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={addMisaKhusus} className="btn-primary flex-1 gap-2">
            <Check size={16}/> Tambahkan sebagai Draft
          </button>
          <button onClick={()=>setShowAddMisa(false)} className="btn-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}
