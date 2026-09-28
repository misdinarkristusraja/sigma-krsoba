import { describe, it, expect } from 'vitest';
import { formatNatalAnnouncementMessage } from '../natalUtils';

describe('Natal Announcement Card Logic', () => {
  it('correctly maps misa and latihan details for assigned member', () => {
    const announcement = {
      nama_lengkap: 'Theresia Avilla',
      nama_panggilan: 'Theresia',
      status_tugas: 'assigned' as const,
      misa_name: 'Malam Natal I',
      jam_tugas: '17:00',
      posisi_tugas: 'Lentera 1',
      jadwal_latihan: '21 Des 2026, 10:00 WIB',
      catatan_khusus: 'Hadir 30 menit sebelum misa',
      tahun: 2026
    };
    const formatted = formatNatalAnnouncementMessage(announcement);
    expect(formatted.isAssigned).toBe(true);
    expect(formatted.title).toBe('Selamat!');
    expect(formatted.headline).toBe('Theresia Avilla anda mendapatkan tugas Malam Natal I 17:00');
  });

  it('correctly maps unassigned member message', () => {
    const announcement = {
      nama_lengkap: 'Fransiskus Xaverius',
      nama_panggilan: 'Frans',
      status_tugas: 'unassigned' as const,
      tahun: 2026
    };
    const formatted = formatNatalAnnouncementMessage(announcement);
    expect(formatted.isAssigned).toBe(false);
    expect(formatted.title).toBe('Tetap semangat!');
    expect(formatted.headline).toBe('Fransiskus Xaverius anda belum mendapatkan tugas natal Tahun ini! Jangan menyerah dan jangan putus asa untuk melayani Tuhan!');
  });
});
