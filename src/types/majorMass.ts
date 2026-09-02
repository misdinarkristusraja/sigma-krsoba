export interface MajorMassSlotConfig {
  id: string;
  name: string;             // e.g. "Malam Natal I (17.00)", "Vigili Paskah I"
  date: string;             // YYYY-MM-DD
  time: string;             // HH:mm
  quota: number;            // e.g. 10 or 8
  priorityRank: number;     // 1 = highest priority, 2, 3...
  rehearsalDate?: string;   // YYYY-MM-DD
  rehearsalTime?: string;   // HH:mm
  rehearsalNotes?: string;
}

export interface MajorMassMember {
  id: string;
  nickname: string;
  nama_lengkap: string;
  nama_panggilan: string;
  pendidikan?: string;      // 'SD' | 'SMP' | 'SMA' | 'SMK' | 'Lulus'
  lingkungan?: string;
  kScore: number;
  totalHadirTugas: number;
  k6Count: number;
  isSenior: boolean;        // true for SMA, SMK, Lulus
}

export interface MajorMassRules {
  seriesType: 'natal' | 'pekan_suci' | 'custom';
  seriesName: string;
  evalStartDate: string;
  evalEndDate: string;
  maxDutyPerMember: number;     // 1 for Natal, 2 for Pekan Suci
  balanceSeniorJunior: boolean;
  seniorRatio: number;          // default 0.5 (50% senior, 50% junior)
  k6PenaltyWeight: number;      // default 5
  avoidConsecutiveDays: boolean;
}

export interface AssignedPetugas {
  slotId: string;
  member: MajorMassMember;
  position: number;
  dutyIndex: 1 | 2;
}

export interface MajorMassAllocationResult {
  slots: Array<{
    config: MajorMassSlotConfig;
    assigned: AssignedPetugas[];
  }>;
  unassignedMembers: MajorMassMember[];
  warnings: string[];
}
