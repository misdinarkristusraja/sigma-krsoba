import React from 'react';
import { Check, X } from 'lucide-react';

const WARNA_OPTIONS = ['Hijau','Merah','Putih','Ungu','MerahMuda','Hitam'];

// Tipe misa:
//   Misa_Khusus_Biasa  = Misa Khusus standar (bisa ada latihan, bisa tidak)
//   Misa_Khusus        = Hari Raya Mandiri (default tanpa latihan, jumlah slot bebas)
//   Mingguan_HariRaya  = Hari Raya + Mingguan (latihan Sabtu, 4 slot)

export function AddMisaModal({ showAddMisa, setShowAddMisa, addMisaForm, setAddMisaForm, addMisaKhusus }: any) {
  if (!showAddMisa) return null;

  const isMK       = addMisaForm.tipe === 'Misa_Khusus';
  const isMR       = addMisaForm.tipe === 'Mingguan_HariRaya';
  const isBiasa    = addMisaForm.tipe === 'Misa_Khusus_Biasa';
  const showLatihan = isMR || (isBiasa && !addMisaForm.tanpa_latihan);

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md w-full max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Tambah Misa Khusus / Hari Raya</h3>
          <button onClick={() => setShowAddMisa(false)} className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"><X size={20}/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {/* Tipe misa */}
          <div className="mb-5">
            <label className="label">Tipe Misa</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {[
                {
                  value: 'Misa_Khusus_Biasa',
                  title: 'Misa Khusus',
                  desc: 'Misa tambahan biasa (Sabtu Imam, Misa Arwah, dll). Bisa dengan atau tanpa latihan.',
                },
                {
                  value: 'Misa_Khusus',
                  title: 'Hari Raya Mandiri',
                  desc: 'Misa Hari Raya standalone, tidak ada misa mingguan. Bisa multi-slot.',
                },
                {
                  value: 'Mingguan_HariRaya',
                  title: 'Hari Raya + Mingguan',
                  desc: 'Weekend ada misa biasa DAN Hari Raya. Latihan Sabtu, 4 slot.',
                },
              ].map(opt => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.tipe === opt.value ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100' : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'}`}>
                  <input type="radio" name="tipe" value={opt.value} className="sr-only"
                    checked={addMisaForm.tipe === opt.value}
                    onChange={() => setAddMisaForm((f: any) => ({
                      ...f,
                      tipe: opt.value,
                      tanggal_latihan: '',
                      tanpa_latihan: opt.value === 'Misa_Khusus' ? true : false,
                      jumlah_misa: opt.value === 'Mingguan_HariRaya' ? 4 : f.jumlah_misa,
                      slot_schedule: opt.value === 'Misa_Khusus' || opt.value === 'Misa_Khusus_Biasa'
                        ? [{ tanggal: f.tanggal_tugas || '', jam: '07.00' }]
                        : f.slot_schedule,
                    }))} />
                  <div>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{opt.title}</span>
                    <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {/* Nama perayaan */}
            <div>
              <label className="label">Nama Perayaan *</label>
              <input className="input" value={addMisaForm.perayaan} placeholder="Contoh: Misa Arwah, HR. Kenaikan"
                onChange={e => setAddMisaForm((f: any) => ({ ...f, perayaan: e.target.value }))} />
            </div>

            {/* Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  {isMR ? 'Tanggal Misa (Minggu) *' : 'Tanggal Misa *'}
                </label>
                <input type="date" className="input" value={addMisaForm.tanggal_tugas}
                  onChange={e => setAddMisaForm((f: any) => ({ ...f, tanggal_tugas: e.target.value }))} />
              </div>
              {showLatihan && (
                <div>
                  <label className="label">Tanggal Latihan</label>
                  <input type="date" className="input" value={addMisaForm.tanggal_latihan}
                    onChange={e => setAddMisaForm((f: any) => ({ ...f, tanggal_latihan: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Tanpa latihan toggle — hanya untuk Misa Khusus Biasa */}
            {isBiasa && (
              <div
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.tanpa_latihan ? 'border-gray-400 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50' : 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80'}`}
                onClick={() => setAddMisaForm((f: any) => ({ ...f, tanpa_latihan: !f.tanpa_latihan, tanggal_latihan: !f.tanpa_latihan ? '' : f.tanggal_latihan }))}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={!addMisaForm.tanpa_latihan} readOnly className="w-4 h-4 accent-brand-800"/>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Ada Latihan Sebelum Misa</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Centang jika ada sesi latihan. Nonaktifkan untuk Sabtu Imam / misa tanpa latihan.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-slot config — hanya Misa_Khusus dan Misa_Khusus_Biasa */}
            {(isMK || isBiasa) && (
              <>
                <div>
                  <label className="label">Jumlah Slot / Misa</label>
                  <select className="input" value={addMisaForm.slot_schedule?.length || 1}
                    onChange={e => {
                      const n = Number(e.target.value);
                      const cur = addMisaForm.slot_schedule || [];
                      const next = Array.from({ length: n }, (_, i) => cur[i] || { tanggal: addMisaForm.tanggal_tugas || '', jam: '07.00' });
                      setAddMisaForm((f: any) => ({ ...f, jumlah_misa: n, slot_schedule: next }));
                    }}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} slot misa</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Jadwal per Misa</label>
                  <div className="space-y-2">
                    {(addMisaForm.slot_schedule || []).map((sc: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-slate-300 w-14 shrink-0">Misa {idx + 1}</span>
                        <input type="date" className="input text-sm flex-1" value={sc.tanggal}
                          onChange={e => {
                            const next = [...addMisaForm.slot_schedule];
                            next[idx] = { ...next[idx], tanggal: e.target.value };
                            const lastTgl = next[next.length - 1].tanggal || e.target.value;
                            setAddMisaForm((f: any) => ({ ...f, slot_schedule: next, tanggal_tugas: lastTgl }));
                          }} />
                        <input type="text" className="input text-sm w-20" value={sc.jam} placeholder="07.00"
                          onChange={e => {
                            const next = [...addMisaForm.slot_schedule];
                            next[idx] = { ...next[idx], jam: e.target.value };
                            setAddMisaForm((f: any) => ({ ...f, slot_schedule: next }));
                          }} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Jumlah petugas per slot */}
            <div>
              <label className="label">Jumlah Petugas per Slot (Maks. 30)</label>
              <select className="input" value={addMisaForm.jumlah_petugas ?? 8}
                onChange={e => setAddMisaForm((f: any) => ({ ...f, jumlah_petugas: Number(e.target.value) }))}>
                {[4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30].map(n => (
                  <option key={n} value={n}>{n} petugas / slot</option>
                ))}
              </select>
            </div>

            {/* Generate otomatis */}
            <div
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.auto_generate ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80' : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50'}`}
              onClick={() => setAddMisaForm((f: any) => ({ ...f, auto_generate: !f.auto_generate }))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={!!addMisaForm.auto_generate} readOnly className="w-4 h-4 accent-brand-800"/>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Generate Petugas Otomatis</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Sistem pilih petugas berdasarkan prioritas. Jika tidak dicentang, isi manual setelah dibuat.</p>
                </div>
              </div>
            </div>

            {/* Misa Besar */}
            <div
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${addMisaForm.is_misa_besar ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80' : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50'}`}
              onClick={() => setAddMisaForm((f: any) => ({ ...f, is_misa_besar: !f.is_misa_besar }))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={addMisaForm.is_misa_besar} readOnly className="w-4 h-4 accent-brand-800"/>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">🎓 Misa Besar</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Aktifkan untuk misa yang wajib ada latihan khusus (Natal, Paskah, dll).</p>
                </div>
              </div>
            </div>

            {/* Warna liturgi */}
            <div>
              <label className="label">Warna Liturgi</label>
              <select className="input" value={addMisaForm.warna_liturgi}
                onChange={e => setAddMisaForm((f: any) => ({ ...f, warna_liturgi: e.target.value }))}>
                {WARNA_OPTIONS.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
          <button onClick={addMisaKhusus} className="btn-primary flex-1 gap-2">
            <Check size={16}/> Tambahkan sebagai Draft
          </button>
          <button onClick={() => setShowAddMisa(false)} className="btn-secondary">Batal</button>
        </div>
      </div>
    </div>
  );
}
