import React from 'react';
import { UserCheck, AlertTriangle } from 'lucide-react';
import { formatDate, tagDuplicateNames, getPicsForSlot } from '@/lib/utils';

const SLOT_INFO: Record<number, { time: string; label: string; jam: string }> = {
  1: { time: 'Sabtu 17:30',  label: 'Sabtu Sore',    jam: '17.30' },
  2: { time: 'Minggu 06:00', label: 'Minggu Pagi I',  jam: '06.00' },
  3: { time: 'Minggu 08:00', label: 'Minggu Pagi II', jam: '08.00' },
  4: { time: 'Minggu 17:30', label: 'Minggu Sore',   jam: '17.30' },
};
const PETUGAS_PER_SLOT = 8;

function parseSlotSchedule(draftNote: string | null, fallback: string) {
  if (!draftNote) return [];
  const raw = draftNote.replace(/^Jam:\s*/i, '');
  return raw.split('|').map(part => {
    const m = part.trim().match(/Slot\s+(\d+):\s*([\d.]+)(?:\|(\d{4}-\d{2}-\d{2}))?/i);
    if (!m) return null;
    return { slot: Number(m[1]), jam: m[2] || '07.00', tanggal: m[3] || fallback || '' };
  }).filter(Boolean) as { slot: number; jam: string; tanggal: string }[];
}

interface AssignmentMatrixProps {
  ev: any;
}

export function AssignmentMatrix({ ev }: AssignmentMatrixProps) {
  const isMK     = ev.tipe_event === 'Misa_Khusus';
  const nSlots   = isMK ? (ev.jumlah_misa || 1) : 4;
  const asgn     = ev.assignments || [];
  const slotSched = isMK ? parseSlotSchedule(ev.draft_note, ev.tanggal_tugas) : [];

  const nameTag = tagDuplicateNames(
    asgn.map((a: any) => a.users).filter(Boolean).map((u: any) => ({ ...u, id: u.nickname || '' }))
  );

  return (
    <div className={`grid gap-3 ${nSlots <= 2 ? 'grid-cols-2' : nSlots === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
      {Array.from({ length: nSlots }, (_, i) => i + 1).map(slot => {
        const people   = asgn.filter((a: any) => a.slot_number === slot);
        const slotPics = getPicsForSlot(ev.event_pics, slot);
        const picNames = slotPics.map((p: any) => p.nama).join(' & ') || null;
        const hpA      = slotPics[0]?.hp || null;

        let jamLabel: string;
        let tglLabel: string;
        if (isMK) {
          const sc = slotSched.find(s => s.slot === slot);
          jamLabel = `Misa ${slot} · ${sc?.jam || '07.00'}`;
          tglLabel = sc?.tanggal ? formatDate(sc.tanggal, 'dd MMM yyyy') : '';
        } else {
          const info = SLOT_INFO[slot];
          jamLabel   = info?.label || `Misa ${slot}`;
          tglLabel   = slot === 1 && ev.tanggal_latihan
            ? formatDate(ev.tanggal_latihan, 'EEEE, dd MMM')
            : formatDate(ev.tanggal_tugas, 'EEEE, dd MMM');
        }

        return (
          <div key={slot} className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="pb-2 border-b border-gray-200/70">
              <p className="text-xs font-bold text-gray-700">{jamLabel}</p>
              <p className="text-[10px] text-gray-500">{tglLabel}</p>
              {picNames ? (
                <div className="mt-1">
                  <p className="text-[11px] text-brand-700 flex items-center gap-1">
                    <UserCheck size={11} />PIC: {picNames}
                  </p>
                  {hpA && <p className="text-[10px] text-gray-400 ml-3.5">📱 <a href={`https://wa.me/${hpA.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{hpA}</a></p>}
                </div>
              ) : (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={10} />PIC belum diisi
                </p>
              )}
            </div>
            <div className="space-y-0.5">
              {people.length === 0
                ? <p className="text-xs text-gray-400 italic">Belum ada petugas</p>
                : people.map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 w-4 text-right shrink-0">{i + 1}.</span>
                    <div>
                      <p className="text-xs font-medium text-gray-800 leading-none">
                        {(a.users?.nickname ? (nameTag as Record<string, string>)[a.users.nickname] : null) || a.users?.nama_panggilan}
                      </p>
                      <p className="text-[10px] text-gray-400">{a.users?.pendidikan} · {a.users?.lingkungan}</p>
                    </div>
                  </div>
                ))
              }
              {people.length > 0 && people.length < PETUGAS_PER_SLOT && (
                <p className="text-[10px] text-orange-400 mt-1">+{PETUGAS_PER_SLOT - people.length} kosong</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
