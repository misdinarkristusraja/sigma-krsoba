import React from 'react';
import { Sparkles, Calendar, Church } from 'lucide-react';
import { MajorMassSlotConfig, MajorMassRules } from '@/types/majorMass';

interface MajorMassPresetCardsProps {
  onSelectPreset: (presetType: 'natal' | 'pekan_suci' | 'custom', slots: MajorMassSlotConfig[], rules: Partial<MajorMassRules>) => void;
  selectedType: string;
}

export function MajorMassPresetCards({ onSelectPreset, selectedType }: MajorMassPresetCardsProps) {
  const handleNatalPreset = () => {
    const year = new Date().getFullYear();
    const slots: MajorMassSlotConfig[] = [
      {
        id: `natal-1`,
        name: `Malam Natal I (17.00)`,
        date: `${year}-12-24`,
        time: '17:00',
        quota: 10,
        priorityRank: 1,
        rehearsalDate: `${year}-12-22`,
        rehearsalTime: '18:00',
        rehearsalNotes: 'Gladi Bersih Pakaian Liturgi Lengkap',
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
        rehearsalNotes: 'Gladi Bersih Misa Malam Natal 2',
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
    ];

    onSelectPreset('natal', slots, {
      seriesType: 'natal',
      seriesName: `Natal ${year}`,
      maxDutyPerMember: 1,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: false,
    });
  };

  const handlePekanSuciPreset = () => {
    const year = new Date().getFullYear();
    const slots: MajorMassSlotConfig[] = [
      {
        id: `ps-1`,
        name: `Minggu Palma (08.00)`,
        date: `${year}-03-29`,
        time: '08:00',
        quota: 8,
        priorityRank: 5,
        rehearsalDate: `${year}-03-28`,
        rehearsalTime: '17:00',
        rehearsalNotes: 'Latihan Prosesi Daun Palma',
      },
      {
        id: `ps-2`,
        name: `Kamis Putih I (17.00)`,
        date: `${year}-04-02`,
        time: '17:00',
        quota: 10,
        priorityRank: 3,
        rehearsalDate: `${year}-03-31`,
        rehearsalTime: '18:00',
        rehearsalNotes: 'Latihan Pembasuhan Kaki & Tuguran',
      },
      {
        id: `ps-3`,
        name: `Jumat Agung I (15.00)`,
        date: `${year}-04-03`,
        time: '15:00',
        quota: 10,
        priorityRank: 4,
        rehearsalDate: `${year}-04-01`,
        rehearsalTime: '18:00',
        rehearsalNotes: 'Latihan Penghormatan Salib',
      },
      {
        id: `ps-4`,
        name: `Vigili Paskah / Malam Paskah I (17.30)`,
        date: `${year}-04-04`,
        time: '17:30',
        quota: 12,
        priorityRank: 1,
        rehearsalDate: `${year}-04-03`,
        rehearsalTime: '19:00',
        rehearsalNotes: 'Latihan Upacara Cahaya & Air Suci',
      },
      {
        id: `ps-5`,
        name: `Vigili Paskah / Malam Paskah II (20.30)`,
        date: `${year}-04-04`,
        time: '20:30',
        quota: 12,
        priorityRank: 2,
        rehearsalDate: `${year}-04-03`,
        rehearsalTime: '20:30',
        rehearsalNotes: 'Latihan Upacara Cahaya & Air Suci Sesi 2',
      },
      {
        id: `ps-6`,
        name: `Misa Hari Raya Paskah (08.00)`,
        date: `${year}-04-05`,
        time: '08:00',
        quota: 8,
        priorityRank: 6,
        rehearsalDate: `${year}-04-04`,
        rehearsalTime: '10:00',
        rehearsalNotes: 'Latihan Misa Hari Raya Paskah',
      },
    ];

    onSelectPreset('pekan_suci', slots, {
      seriesType: 'pekan_suci',
      seriesName: `Pekan Suci ${year}`,
      maxDutyPerMember: 2,
      balanceSeniorJunior: true,
      seniorRatio: 0.5,
      k6PenaltyWeight: 5,
      avoidConsecutiveDays: true,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      <div
        onClick={handleNatalPreset}
        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          selectedType === 'natal'
            ? 'border-brand-600 dark:border-amber-500 bg-brand-50/70 dark:bg-slate-800/90 ring-2 ring-brand-500/20'
            : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Preset Rangkaian Natal
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium">1x Tugas / Anak</span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              4 Misa (Malam Natal 1 & 2, Natal Pagi & Siang). Prioritas peringkat tertinggi mengisi Misa Malam Natal 1 terlebih dahulu.
            </p>
          </div>
        </div>
      </div>

      <div
        onClick={handlePekanSuciPreset}
        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
          selectedType === 'pekan_suci'
            ? 'border-brand-600 dark:border-amber-500 bg-brand-50/70 dark:bg-slate-800/90 ring-2 ring-brand-500/20'
            : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0">
            <Church size={22} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Preset Rangkaian Pekan Suci
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-medium">Maks. 2x Tugas</span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              6 Misa (Palma, Kamis Putih, Jumat Agung, Vigili 1 & 2, Paskah). Multi-duty bertingkat dengan anti-bentrok tanggal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
