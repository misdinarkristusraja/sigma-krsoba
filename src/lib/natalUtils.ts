import { NatalAnnouncement } from '../types';

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
