import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldCheck, UserCheck, ArrowRightLeft, User } from 'lucide-react';
import { MajorMassAllocationResult, AssignedPetugas, MajorMassMember } from '@/types/majorMass';

interface MajorMassPreviewMatrixProps {
  allocation: MajorMassAllocationResult;
  onUpdateAllocation: (updated: MajorMassAllocationResult) => void;
  availablePool: MajorMassMember[];
}

export function MajorMassPreviewMatrix({
  allocation,
  onUpdateAllocation,
  availablePool,
}: MajorMassPreviewMatrixProps) {
  const [swappingPetugas, setSwappingPetugas] = useState<{
    slotId: string;
    position: number;
    currentMemberId: string;
  } | null>(null);

  const handleSwapMember = (newMemberId: string) => {
    if (!swappingPetugas) return;
    const targetMember = availablePool.find(m => m.id === newMemberId);
    if (!targetMember) return;

    const nextSlots = allocation.slots.map(s => {
      if (s.config.id !== swappingPetugas.slotId) return s;
      const updatedAssigned = s.assigned.map(a => {
        if (a.position === swappingPetugas.position) {
          return {
            ...a,
            member: targetMember,
          };
        }
        return a;
      });
      return { ...s, assigned: updatedAssigned };
    });

    onUpdateAllocation({
      ...allocation,
      slots: nextSlots,
    });
    setSwappingPetugas(null);
  };

  const totalFilled = allocation.slots.reduce((sum, s) => sum + s.assigned.length, 0);
  const totalQuota = allocation.slots.reduce((sum, s) => sum + s.config.quota, 0);

  return (
    <div className="space-y-6">
      {/* Summary status bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-900/10 to-amber-500/10 dark:from-slate-800 dark:to-slate-850 border border-brand-200/50 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
              Hasil Simulasi Penjadwalan
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Total {totalFilled} dari {totalQuota} slot petugas terisi ({Math.round((totalFilled / (totalQuota || 1)) * 100)}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
            <UserCheck size={14} /> {allocation.slots.length} Misa
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
            <User size={14} /> {availablePool.length} Pool Anggota
          </span>
        </div>
      </div>

      {/* Warnings */}
      {allocation.warnings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-sm mb-1">
            <AlertTriangle size={16} className="text-amber-600" /> Perhatian Alokasi:
          </div>
          {allocation.warnings.map((w, idx) => (
            <p key={idx}>• {w}</p>
          ))}
        </div>
      )}

      {/* Slots grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {allocation.slots.map(slot => {
          const seniorCount = slot.assigned.filter(a => a.member.isSenior).length;
          const juniorCount = slot.assigned.filter(a => !a.member.isSenior).length;

          return (
            <div
              key={slot.config.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3"
            >
              {/* Slot Header */}
              <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-800 dark:bg-amber-500 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center">
                      {slot.config.priorityRank}
                    </span>
                    <h5 className="font-bold text-sm text-gray-900 dark:text-white">
                      {slot.config.name}
                    </h5>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                    {slot.assigned.length}/{slot.config.quota} Petugas
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 mt-2">
                  <span>📅 {slot.config.date} pk {slot.config.time}</span>
                  <div className="flex gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Senior: {seniorCount}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Junior: {juniorCount}</span>
                  </div>
                </div>

                {slot.config.rehearsalDate && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg mt-2 font-medium">
                    Gladi: {slot.config.rehearsalDate} {slot.config.rehearsalTime ? `pk ${slot.config.rehearsalTime}` : ''} {slot.config.rehearsalNotes ? `(${slot.config.rehearsalNotes})` : ''}
                  </div>
                )}
              </div>

              {/* Assigned List */}
              <div className="space-y-1.5 flex-1">
                {slot.assigned.map(a => (
                  <div
                    key={`${a.slotId}-${a.position}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 text-center font-bold text-gray-400 dark:text-slate-500 text-[11px]">
                        {a.position}.
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-gray-900 dark:text-white mr-1.5">
                          {a.member.nickname || a.member.nama_panggilan}
                        </span>
                        <span className="text-gray-400 dark:text-slate-400 text-[11px] truncate hidden sm:inline">
                          ({a.member.nama_lengkap})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Education Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          a.member.isSenior
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}
                      >
                        {a.member.pendidikan || (a.member.isSenior ? 'Senior' : 'Junior')}
                      </span>

                      {/* K-Score Badge */}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
                        K: {a.member.kScore}
                      </span>

                      {/* Duty Index (if duty 2) */}
                      {a.dutyIndex === 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-bold">
                          2x
                        </span>
                      )}

                      {/* Quick Swap Button */}
                      <button
                        type="button"
                        title="Ganti Petugas Ini"
                        onClick={() =>
                          setSwappingPetugas({
                            slotId: slot.config.id,
                            position: a.position,
                            currentMemberId: a.member.id,
                          })
                        }
                        className="p-1 text-gray-400 hover:text-brand-700 dark:hover:text-amber-400 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ml-0.5"
                      >
                        <ArrowRightLeft size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Swap Modal / Overlay */}
      {swappingPetugas && (
        <div className="modal-overlay z-50">
          <div className="modal-card max-w-sm w-full p-4 space-y-3">
            <h5 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <ArrowRightLeft size={16} /> Pilih Petugas Pengganti
            </h5>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Pilih anggota dari pool aktif untuk menggantikan posisi ini:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {availablePool
                .filter(m => m.id !== swappingPetugas.currentMemberId)
                .sort((a, b) => b.kScore - a.kScore)
                .map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleSwapMember(m.id)}
                    className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white mr-1.5">
                        {m.nickname || m.nama_panggilan}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-400">
                        {m.pendidikan}
                      </span>
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                      K: {m.kScore}
                    </span>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setSwappingPetugas(null)}
              className="btn-secondary w-full text-xs py-2 mt-2"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
