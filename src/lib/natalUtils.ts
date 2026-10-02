import { NatalAnnouncement, NatalReleaseStatus } from '../types';
import { formatDate } from './utils';

export function isNatalPortalVisible(status: NatalReleaseStatus | string | undefined, isPengurus: boolean): boolean {
  if (status === 'published') return true;
  if (status === 'trial') return Boolean(isPengurus);
  return false;
}

export function isNatalAdminVisible(isPengurus: boolean): boolean {
  return Boolean(isPengurus);
}

export interface FormattedNatalMessage {
  title: string;
  headline: string;
  isAssigned: boolean;
}

export function formatNatalAnnouncementMessage(data: Partial<NatalAnnouncement>): FormattedNatalMessage {
  if (data.status_tugas === 'assigned') {
    const misa = data.misa_name ? ` ${data.misa_name}` : '';
    const jam = data.jam_tugas ? ` ${data.jam_tugas}` : '';
    return {
      title: 'Selamat!',
      headline: `${data.nama_lengkap || ''} anda mendapatkan tugas${misa}${jam}`.trim(),
      isAssigned: true,
    };
  }

  return {
    title: 'Tetap semangat!',
    headline: `${data.nama_lengkap || ''} anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!`.trim(),
    isAssigned: false,
  };
}

export function formatNatalTargetTime(isoString: string): string {
  if (!isoString) return '-';
  try {
    return formatDate(isoString, "EEEE, dd MMMM yyyy 'pukul' HH.mm 'WIB'");
  } catch {
    return isoString;
  }
}

// ── 4 Misa Natal Resmi ───────────────────────────────────────────────
export interface FixedNatalMisa {
  id: string;
  name: string;
  tanggal: string;
  jam: string;
  badgeClass: string;
}

export const FIXED_NATAL_MISAS: FixedNatalMisa[] = [
  {
    id: 'malam-natal-1',
    name: 'Misa Malam Natal I (17.00)',
    tanggal: '2026-12-24',
    jam: '17:00',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'malam-natal-2',
    name: 'Misa Malam Natal II (20.00)',
    tanggal: '2026-12-24',
    jam: '20:00',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
  },
  {
    id: 'natal-lansia',
    name: 'Misa Natal Lansia (06.00)',
    tanggal: '2026-12-25',
    jam: '06:00',
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  {
    id: 'natal-anak',
    name: 'Misa Natal Anak (09.00)',
    tanggal: '2026-12-25',
    jam: '09:00',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
];

