import React from 'react';
import { Edit2, Globe, Lock, Trash2, FileEdit, UserCheck } from 'lucide-react';
import { formatDate, getLiturgyClass, getPicsForSlot } from '@/lib/utils';
import { AssignmentMatrix } from './AssignmentMatrix';
import { ExportToolbar } from './ExportToolbar';

interface EventCardProps {
  ev: any;
  vigili?: any | null;
  picOptions: any[];
  onEdit:      (ev: any) => void;
  onDelete:    (ev: any) => void;
  onPublish:   (ev: any) => void;
  onUnpublish: (ev: any) => void;
}

function VigiliSection({ vigili, picOptions, onEdit, onDelete, onPublish, onUnpublish }: {
  vigili: any;
  picOptions: any[];
  onEdit: (ev: any) => void;
  onDelete: (ev: any) => void;
  onPublish: (ev: any) => void;
  onUnpublish: (ev: any) => void;
}) {
  const va   = vigili.assignments || [];
  const vPics = getPicsForSlot(vigili.event_pics, 1);
  const vPicA = vPics[0]?.nama || null;
  const vPicB = vPics[1]?.nama || null;
  const vHpA  = vPics[0]?.hp  || null;
  const vJam  = vigili.draft_note?.match(/Jam: ([\d.]+)/)?.[1] || '17.30';
  const vTgl  = formatDate(vigili.tanggal_tugas, 'EEEE, dd MMM yyyy');

  return (
    <div className="mb-4 pb-4 border-b-2 border-dashed border-purple-200 bg-purple-50/40 -mx-4 -mt-4 px-4 pt-4 rounded-t-xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-purple text-xs">Vigili H-1</span>
          {vigili.is_draft
            ? <span className="badge-yellow text-xs gap-1 flex items-center"><FileEdit size={10}/>Draft</span>
            : <span className="badge-green text-xs gap-1 flex items-center"><Globe size={10}/>Published</span>
          }
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit({ ...vigili })} className="btn-outline btn-sm gap-1 text-xs py-1"><Edit2 size={11}/> Edit</button>
          {vigili.is_draft
            ? <button onClick={() => onPublish(vigili)} className="btn-primary btn-sm text-xs py-1"><Globe size={11}/> Publish</button>
            : <button onClick={() => onUnpublish(vigili)} className="btn-outline btn-sm text-xs py-1"><Lock size={11}/> Draft</button>
          }
          <ExportToolbar ev={vigili} picOptions={picOptions} />
          <button onClick={() => onDelete(vigili)} className="btn-ghost p-1 text-red-400 hover:bg-red-50"><Trash2 size={13}/></button>
        </div>
      </div>
      <p className="text-xs font-semibold text-purple-800 mb-0.5">Misa Vigili — {vTgl} · Jam {vJam}</p>
      {(vPicA || vPicB) && (
        <p className="text-[11px] text-purple-600 flex items-center gap-1 mb-2">
          <UserCheck size={10}/>PIC: {[vPicA, vPicB].filter(Boolean).join(' & ')}
          {vHpA && <span className="text-purple-400">· 📱 <a href={`https://wa.me/${vHpA.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{vHpA}</a></span>}
        </p>
      )}
      {va.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {va.map((a: any, i: number) => (
            <span key={i} className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">
              {a.users?.nama_panggilan}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventCard({ ev, vigili, picOptions, onEdit, onDelete, onPublish, onUnpublish }: EventCardProps) {
  const lc = getLiturgyClass(ev.warna_liturgi);

  const pelatihNicks = (ev.event_pelatih || [])
    .sort((a: any, b: any) => a.urutan - b.urutan)
    .map((p: any) => p.nama)
    .filter(Boolean);

  return (
    <div className={`card border-l-4 ${ev.is_draft ? 'border-yellow-400 bg-yellow-50/20' : 'border-green-400'}`}>
      {vigili && (
        <VigiliSection
          vigili={vigili}
          picOptions={picOptions}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
        />
      )}

      {/* Card header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${lc.dot}`}/>
          <div>
            <p className="font-bold text-gray-900">{ev.perayaan || ev.nama_event}</p>
            <p className="text-xs text-gray-500">
              {ev.tanggal_latihan
                ? `${formatDate(ev.tanggal_latihan, 'dd MMM')} – ${formatDate(ev.tanggal_tugas, 'dd MMM yyyy')}`
                : formatDate(ev.tanggal_tugas, 'dd MMM yyyy')}
            </p>
          </div>
          {ev.is_draft
            ? <span className="badge-yellow text-xs flex items-center gap-1"><FileEdit size={10}/>Draft</span>
            : <span className="badge-green text-xs flex items-center gap-1"><Globe size={10}/>Published</span>
          }
          {ev.is_misa_besar && <span className="badge badge-purple text-xs">Misa Besar</span>}
        </div>

        <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
          <button onClick={() => onEdit({ ...ev })} className="btn-outline btn-sm gap-1 text-xs py-1">
            <Edit2 size={11}/> Edit
          </button>
          {ev.is_draft
            ? <button onClick={() => onPublish(ev)} className="btn-primary btn-sm text-xs py-1">
                <Globe size={11}/> Publish
              </button>
            : <button onClick={() => onUnpublish(ev)} className="btn-outline btn-sm text-xs py-1">
                <Lock size={11}/> Draft
              </button>
          }
          <ExportToolbar ev={ev} picOptions={picOptions} />
          <button onClick={() => onDelete(ev)} className="btn-ghost p-1 text-red-400 hover:bg-red-50">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {/* Assignments grid */}
      <AssignmentMatrix ev={ev} />

      {/* Pelatih piket */}
      {pelatihNicks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mb-1.5">Pelatih Piket</p>
          <div className="flex flex-wrap gap-2">
            {pelatihNicks.map((nick: string) => {
              const p  = picOptions.find(u => u.nickname === nick);
              const hp = p?.hp_anak || p?.hp_ortu || '';
              return (
                <div key={nick} className="text-xs bg-teal-50 text-teal-800 px-2.5 py-1 rounded-xl border border-teal-100">
                  <span className="font-semibold">{p?.nama_panggilan || nick}</span>
                  {hp && <span className="ml-1.5 text-teal-500 text-[10px]">📱 <a href={`https://wa.me/${hp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{hp}</a></span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
