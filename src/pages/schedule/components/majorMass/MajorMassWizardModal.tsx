import React, { useState, useEffect } from 'react';
import { X, Sparkles, Sliders, CheckCircle2, ArrowRight, ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { MajorMassSlotConfig, MajorMassRules, MajorMassAllocationResult, MajorMassMember } from '@/types/majorMass';
import { allocateMajorMassSlots } from '@/lib/majorMassEngine';
import { fetchMajorMassPoolAndScores, persistMajorMassSeries } from '@/lib/majorMassService';
import { MajorMassPresetCards } from './MajorMassPresetCards';
import { MajorMassSlotEditor } from './MajorMassSlotEditor';
import { MajorMassPreviewMatrix } from './MajorMassPreviewMatrix';

interface MajorMassWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function MajorMassWizardModal({ isOpen, onClose, onComplete }: MajorMassWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const today = new Date();
  const sixMonthsAgo = new Date(+today - 180 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [rules, setRules] = useState<MajorMassRules>({
    seriesType: 'natal',
    seriesName: 'Natal 2026',
    evalStartDate: sixMonthsAgo,
    evalEndDate: todayStr,
    maxDutyPerMember: 1,
    balanceSeniorJunior: true,
    seniorRatio: 0.5,
    k6PenaltyWeight: 5,
    avoidConsecutiveDays: false,
  });

  const [slots, setSlots] = useState<MajorMassSlotConfig[]>([]);
  const [memberPool, setMemberPool] = useState<MajorMassMember[]>([]);
  const [allocation, setAllocation] = useState<MajorMassAllocationResult | null>(null);

  // Initialize with Natal preset on first open
  useEffect(() => {
    if (isOpen && slots.length === 0) {
      const year = new Date().getFullYear();
      setSlots([
        {
          id: `natal-1`,
          name: `Malam Natal I (17.00)`,
          date: `${year}-12-24`,
          time: '17:00',
          quota: 10,
          priorityRank: 1,
          rehearsalDate: `${year}-12-22`,
          rehearsalTime: '18:00',
          rehearsalNotes: 'Gladi Bersih Pakaian Liturgi',
        },
        {
          id: `natal-2`,
          name: `Malam Natal II (20.00)`,
          date: `${year}-12-24`,
          time: '20:00',
          quota: 10,
          priorityRank: 2,
          rehearsalDate: `${year}-12-22`,
          rehearsalTime: '19:30',
          rehearsalNotes: 'Gladi Bersih Malam Natal 2',
        },
        {
          id: `natal-3`,
          name: `Misa Natal Pagi (08.00)`,
          date: `${year}-12-25`,
          time: '08:00',
          quota: 8,
          priorityRank: 3,
          rehearsalDate: `${year}-12-23`,
          rehearsalTime: '18:00',
          rehearsalNotes: 'Gladi Bersih Misa Natal Pagi',
        },
        {
          id: `natal-4`,
          name: `Misa Natal Siang/Sore (17.00)`,
          date: `${year}-12-25`,
          time: '17:00',
          quota: 8,
          priorityRank: 4,
          rehearsalDate: `${year}-12-23`,
          rehearsalTime: '19:00',
          rehearsalNotes: 'Gladi Bersih Misa Natal Sore',
        },
      ]);
    }
  }, [isOpen, slots.length]);

  if (!isOpen) return null;

  const handleSelectPreset = (
    presetType: 'natal' | 'pekan_suci' | 'custom',
    presetSlots: MajorMassSlotConfig[],
    presetRules: Partial<MajorMassRules>
  ) => {
    setSlots(presetSlots);
    setRules(r => ({ ...r, ...presetRules }));
  };

  const handleRunSimulation = async () => {
    if (slots.length === 0) {
      toast.error('Tambahkan minimal 1 misa dalam rangkaian.');
      return;
    }
    setLoading(true);
    const tid = 'sim-load';
    try {
      toast.loading('Menghitung akumulasi skor K & ketersediaan anggota...', { id: tid });
      const pool = await fetchMajorMassPoolAndScores(supabase, rules);
      if (!pool || pool.length === 0) {
        throw new Error('Tidak ada anggota misdinar aktif yang ditemukan.');
      }
      setMemberPool(pool);

      const result = allocateMajorMassSlots(pool, slots, rules);
      setAllocation(result);
      setCurrentStep(3);
      toast.success(`Simulasi berhasil! Terpilih alokasi untuk ${slots.length} misa.`, { id: tid });
    } catch (err: any) {
      toast.error('Gagal simulasi: ' + (err.message || err), { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeries = async (isDraft: boolean) => {
    if (!allocation) return;
    setSaving(true);
    const tid = 'save-series';
    try {
      toast.loading(isDraft ? 'Menyimpan sebagai Draft...' : 'Mempublikasikan Misa Besar...', { id: tid });
      const createdIds = await persistMajorMassSeries(supabase, allocation, rules, isDraft);
      toast.success(
        `✅ Berhasil membuat ${createdIds.length} jadwal Misa Besar (${isDraft ? 'DRAFT' : 'PUBLISHED'}).`,
        { id: tid, duration: 5000 }
      );
      onComplete();
      onClose();
    } catch (err: any) {
      toast.error('Gagal menyimpan: ' + (err.message || err), { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-4xl w-full max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-800 text-white dark:bg-amber-500 dark:text-slate-900 font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Wizard Penjadwalan Misa Besar
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                Natal & Pekan Suci berbasis K-Score, Senior-Junior mix & Gladi Bersih
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Wizard Step Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 dark:bg-slate-850 border-b border-gray-200 dark:border-slate-800 text-xs font-semibold flex-shrink-0">
          <button
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
              currentStep === 1
                ? 'bg-brand-800 text-white dark:bg-amber-500 dark:text-slate-900 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            <span>1. Rangkaian & Misa</span>
          </button>

          <span className="text-gray-300 dark:text-slate-700">➔</span>

          <button
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
              currentStep === 2
                ? 'bg-brand-800 text-white dark:bg-amber-500 dark:text-slate-900 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
            }`}
          >
            <span>2. Aturan & Bobot K</span>
          </button>

          <span className="text-gray-300 dark:text-slate-700">➔</span>

          <button
            onClick={() => allocation && setCurrentStep(3)}
            disabled={!allocation}
            className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
              currentStep === 3
                ? 'bg-brand-800 text-white dark:bg-amber-500 dark:text-slate-900 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 disabled:opacity-40'
            }`}
          >
            <span>3. Simulasi & Review</span>
          </button>
        </div>

        {/* Step Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* STEP 1: Rangkaian & Slot Setup */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="label">Nama Rangkaian / Perayaan *</label>
                <input
                  type="text"
                  className="input font-semibold"
                  value={rules.seriesName}
                  onChange={e => setRules(r => ({ ...r, seriesName: e.target.value }))}
                  placeholder="Contoh: Natal 2026 atau Pekan Suci 2026"
                />
              </div>

              <div>
                <label className="label mb-2">Pilih Template Rangkaian Cepat</label>
                <MajorMassPresetCards
                  selectedType={rules.seriesType}
                  onSelectPreset={handleSelectPreset}
                />
              </div>

              <MajorMassSlotEditor slots={slots} onChangeSlots={setSlots} />
            </div>
          )}

          {/* STEP 2: Aturan & Parameter K */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-brand-50 dark:bg-slate-800/80 border border-brand-200 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300 space-y-2">
                <h4 className="font-bold text-sm text-brand-900 dark:text-amber-400 flex items-center gap-2">
                  <Sliders size={16} /> Konfigurasi Algoritma Alokasi
                </h4>
                <p>
                  Sistem akan menghitung akumulasi poin dari rekap kondisi K (K1, K2a, K3a, dll.)
                  dalam rentang tanggal cut-off, lalu memprioritaskan skor tertinggi untuk slot misa teratas.
                </p>
              </div>

              {/* Evaluation Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Tanggal Awal Evaluasi (Cut-off Start) *</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={rules.evalStartDate}
                    onChange={e => setRules(r => ({ ...r, evalStartDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Tanggal Akhir Evaluasi (Cut-off End) *</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={rules.evalEndDate}
                    onChange={e => setRules(r => ({ ...r, evalEndDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Max Duty per Member */}
              <div>
                <label className="label">Batas Maksimal Tugas per Anggota</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      rules.maxDutyPerMember === 1
                        ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="maxDuty"
                      checked={rules.maxDutyPerMember === 1}
                      onChange={() => setRules(r => ({ ...r, maxDutyPerMember: 1 }))}
                      className="sr-only"
                    />
                    <div>
                      <span className="font-bold text-sm">1x Tugas Saja (Rekomendasi Natal)</span>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Setiap anggota hanya bertugas 1 kali dalam rangkaian agar merata.</p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      rules.maxDutyPerMember === 2
                        ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="maxDuty"
                      checked={rules.maxDutyPerMember === 2}
                      onChange={() => setRules(r => ({ ...r, maxDutyPerMember: 2 }))}
                      className="sr-only"
                    />
                    <div>
                      <span className="font-bold text-sm">Hingga 2x Tugas (Pekan Suci)</span>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Anggota peringkat atas boleh bertugas 2 kali pada misa yang berbeda.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Senior / Junior Balance */}
              <div
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  rules.balanceSeniorJunior
                    ? 'border-brand-800 dark:border-amber-500 bg-brand-50 dark:bg-slate-800/80'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-850'
                }`}
                onClick={() => setRules(r => ({ ...r, balanceSeniorJunior: !r.balanceSeniorJunior }))}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rules.balanceSeniorJunior}
                    readOnly
                    className="w-4 h-4 accent-brand-800 dark:accent-amber-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      Keseimbangan Senior (SMA/Lulus) & Junior (SD/SMP)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Menjamin tiap slot misa memiliki kombinasi merata antara misdinar senior dan junior.
                    </p>
                  </div>
                </div>
              </div>

              {/* K6 Penalty Weight */}
              <div>
                <label className="label">Bobot Pengurang Absen (K6 Penalty)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    className="flex-1 accent-brand-800 dark:accent-amber-500"
                    value={rules.k6PenaltyWeight}
                    onChange={e => setRules(r => ({ ...r, k6PenaltyWeight: Number(e.target.value) }))}
                  />
                  <span className="text-sm font-bold text-brand-800 dark:text-amber-400 w-16 text-right">
                    -{rules.k6PenaltyWeight} poin / K6
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview Matrix & Final Adjustment */}
          {currentStep === 3 && allocation && (
            <MajorMassPreviewMatrix
              allocation={allocation}
              onUpdateAllocation={setAllocation}
              availablePool={memberPool}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev === 3 ? 2 : 1))}
                className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
              >
                <ArrowLeft size={15} /> Kembali
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs py-2 px-3"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4"
              >
                Lanjut ke Aturan <ArrowRight size={15} />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                disabled={loading}
                onClick={handleRunSimulation}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Jalankan Simulasi & Preview
              </button>
            )}

            {currentStep === 3 && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveSeries(true)}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3 disabled:opacity-50"
                >
                  <Save size={15} /> Simpan DRAFT
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveSeries(false)}
                  className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Publish Jadwal
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
