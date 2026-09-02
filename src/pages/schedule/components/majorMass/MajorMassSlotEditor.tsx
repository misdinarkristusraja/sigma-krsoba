import React from 'react';
import { Plus, Trash2, Clock, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { MajorMassSlotConfig } from '@/types/majorMass';

interface MajorMassSlotEditorProps {
  slots: MajorMassSlotConfig[];
  onChangeSlots: (slots: MajorMassSlotConfig[]) => void;
}

export function MajorMassSlotEditor({ slots, onChangeSlots }: MajorMassSlotEditorProps) {
  const handleAddSlot = () => {
    const today = new Date().toISOString().split('T')[0];
    const newSlot: MajorMassSlotConfig = {
      id: `custom-slot-${Date.now()}`,
      name: `Misa Baru (${slots.length + 1})`,
      date: today,
      time: '17:00',
      quota: 8,
      priorityRank: slots.length + 1,
      rehearsalDate: today,
      rehearsalTime: '18:00',
      rehearsalNotes: '',
    };
    onChangeSlots([...slots, newSlot]);
  };

  const handleRemoveSlot = (id: string) => {
    const next = slots.filter(s => s.id !== id);
    // Recalculate priority ranks
    const reordered = next.map((s, idx) => ({ ...s, priorityRank: idx + 1 }));
    onChangeSlots(reordered);
  };

  const handleUpdateSlot = (id: string, updates: Partial<MajorMassSlotConfig>) => {
    const next = slots.map(s => (s.id === id ? { ...s, ...updates } : s));
    onChangeSlots(next);
  };

  const handleMoveRank = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slots.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...slots];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    // Update priorityRank sequentially
    const reordered = next.map((s, idx) => ({ ...s, priorityRank: idx + 1 }));
    onChangeSlots(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-gray-900 dark:text-white">
          Daftar Misa & Sesi Latihan Khusus ({slots.length} Misa)
        </h4>
        <button
          type="button"
          onClick={handleAddSlot}
          className="text-xs font-semibold text-brand-600 dark:text-amber-400 hover:underline flex items-center gap-1"
        >
          <Plus size={15} /> Tambah Misa
        </button>
      </div>

      <div className="space-y-3">
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            className="p-4 rounded-2xl bg-gray-50/80 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 space-y-3"
          >
            {/* Header / Title & Priority controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-amber-900/40 text-brand-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {slot.priorityRank}
                </span>
                <input
                  type="text"
                  className="input text-sm font-semibold py-1.5 flex-1"
                  value={slot.name}
                  placeholder="Nama Misa"
                  onChange={e => handleUpdateSlot(slot.id, { name: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Naikkan Prioritas"
                  disabled={index === 0}
                  onClick={() => handleMoveRank(index, 'up')}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  title="Turunkan Prioritas"
                  disabled={index === slots.length - 1}
                  onClick={() => handleMoveRank(index, 'down')}
                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700"
                >
                  <ArrowDown size={16} />
                </button>
                {slots.length > 1 && (
                  <button
                    type="button"
                    title="Hapus Misa"
                    onClick={() => handleRemoveSlot(slot.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Misa Date, Time, and Quota */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
                  Tanggal Misa *
                </label>
                <input
                  type="date"
                  className="input text-xs py-1.5"
                  value={slot.date}
                  onChange={e => handleUpdateSlot(slot.id, { date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
                  Jam Misa
                </label>
                <input
                  type="text"
                  className="input text-xs py-1.5"
                  value={slot.time}
                  placeholder="17:00"
                  onChange={e => handleUpdateSlot(slot.id, { time: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
                  Kuota Petugas
                </label>
                <input
                  type="number"
                  min={2}
                  max={30}
                  className="input text-xs py-1.5 font-bold text-brand-700 dark:text-amber-400"
                  value={slot.quota}
                  onChange={e => handleUpdateSlot(slot.id, { quota: Math.max(1, Number(e.target.value)) })}
                />
              </div>
            </div>

            {/* Rehearsal / Gladi Bersih config */}
            <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
              <span className="font-semibold text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock size={13} /> Sesi Gladi Bersih / Latihan Khusus
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-0.5">Tanggal Latihan</label>
                  <input
                    type="date"
                    className="input text-xs py-1 bg-white dark:bg-slate-900"
                    value={slot.rehearsalDate || ''}
                    onChange={e => handleUpdateSlot(slot.id, { rehearsalDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-slate-400 block mb-0.5">Jam & Catatan Gladi</label>
                  <input
                    type="text"
                    className="input text-xs py-1 bg-white dark:bg-slate-900"
                    placeholder="18:00 (Pakaian Liturgi Lengkap)"
                    value={slot.rehearsalNotes ? `${slot.rehearsalTime ? slot.rehearsalTime + ' - ' : ''}${slot.rehearsalNotes}` : (slot.rehearsalTime || '')}
                    onChange={e => {
                      const val = e.target.value;
                      handleUpdateSlot(slot.id, { rehearsalTime: val.split(' ')[0] || '18:00', rehearsalNotes: val });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
